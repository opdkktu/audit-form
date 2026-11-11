/**
 * mode.js — audit level (Daerah / JKN) + trial mode, shared by index.html, form.html, form2.html.
 *
 *  • Level  : "daerah" (default) or "jkn". JKN needs a PIN, which is verified by the JKN backend itself
 *             and sent again with every submit/upload (the backend re-checks it — hiding a button is not security).
 *             JKN audits go to separate backends/sheets, so their marks never mix with district marks.
 *  • Trial  : forms behave normally but NOTHING is sent to the database (no submit, no photo upload, no email,
 *             no rating). The result page and the PDF still work; the PDF is stamped as a trial copy.
 *  State lives in sessionStorage → it is forgotten when the tab closes, so a shared phone falls back to Daerah.
 */
(function () {
  const K = { level: "audit_level", pin: "audit_jkn_pin", trial: "audit_trial" };
  const get = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} };
  const CFG = () => window.APP_CONFIG || {};
  const hasJkn = () => !!(CFG().FORM1_JKN_GAS_URL && CFG().FORM2_JKN_GAS_URL);

  const M = {
    hasJkn,
    get level() { return get(K.level) === "jkn" && get(K.pin) && hasJkn() ? "jkn" : "daerah"; },
    get pin() { return get(K.pin) || ""; },
    get trial() { return get(K.trial) === "1"; },
    setTrial(on) { set(K.trial, on ? "1" : null); },
    useDaerah() { set(K.level, null); set(K.pin, null); },
    /** Backend URL for form 1 (ambulans) or 2 (kecemasan) at the current level. */
    url(n) { return M.level === "jkn" ? CFG()["FORM" + n + "_JKN_GAS_URL"] : CFG()["FORM" + n + "_GAS_URL"]; },
    /** Ask the JKN backend whether the PIN is right; on success remember JKN level for this tab. */
    async verifyJkn(pin) {
      const url = CFG().FORM1_JKN_GAS_URL;
      if (!url) throw new Error("JKN_BELUM_DISEDIAKAN");
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "verifyPin", token: CFG().SHARED_TOKEN || "", pin }) });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "PIN_SALAH");
      set(K.level, "jkn"); set(K.pin, pin);
    },
    /** Same numbers the server would compute — used for the trial result page. */
    trialResult(answers) {
      const list = Object.values(answers);
      const nonTB = list.filter(a => a.penilaian !== "TIDAK_BERKENAAN");
      const totalMarks = nonTB.filter(a => a.penilaian === "YA").length, nonTBTotal = nonTB.length;
      const percentage = nonTBTotal ? Math.round(totalMarks / nonTBTotal * 100) : 0;
      return { success: true, submissionId: "PERCUBAAN-" + Date.now(), totalMarks, nonTBTotal, percentage,
        kategori: typeof getKategori === "function" ? getKategori(percentage).label : "", photoUrls: {}, trial: true };
    },
    delay: ms => new Promise(r => setTimeout(r, ms)),
    /** Form pages: show the active mode so nobody submits to the wrong place by accident. */
    applyBanner() {
      const badge = document.getElementById("auditor-badge");
      if (badge && M.level === "jkn") badge.textContent += " · Peringkat JKN";
      if (!M.trial && M.level !== "jkn") return;
      const bar = document.createElement("div"); bar.className = "mode-bar" + (M.trial ? " mode-bar--trial" : "");
      bar.textContent = M.trial ? "🧪 MOD PERCUBAAN — tiada data disimpan. PDF masih boleh dimuat turun." : "🏛️ PERINGKAT JKN — markah disimpan berasingan daripada peringkat daerah.";
      document.body.prepend(bar);
    }
  };
  window.AuditMode = M;

  const css = document.createElement("style");
  css.textContent = `
  .mode-bar{position:sticky;top:0;z-index:90;text-align:center;font:600 12.5px/1.3 Inter,system-ui,sans-serif;padding:8px 12px;background:#0b4f5c;color:#fff}
  .mode-bar--trial{background:#f2a93b;color:#3b2a00}
  #mode-panel{max-width:760px;margin:0 auto 22px;padding:0 16px;font-family:var(--font-b,Inter,system-ui,sans-serif);color:var(--text-hi,#fff)}
  .mp-card{background:var(--glass-bg,rgba(255,255,255,.05));border:1px solid var(--glass-border,rgba(255,255,255,.12));border-radius:18px;padding:16px;display:grid;gap:14px}
  .mp-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-lo,rgba(255,255,255,.45));margin-bottom:6px}
  .mp-seg{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:rgba(0,0,0,.2);padding:5px;border-radius:14px}
  .mp-seg button{border:0;border-radius:10px;padding:11px 8px;font:600 13.5px Inter,system-ui,sans-serif;color:var(--text-mid,rgba(255,255,255,.7));background:transparent;cursor:pointer;transition:all .2s}
  .mp-seg button.is-on{background:var(--teal,#0bb88a);color:#04261d}
  .mp-seg button:not(.is-on):hover{background:rgba(255,255,255,.08)}
  .mp-seg button:disabled{opacity:.45;cursor:not-allowed}
  .mp-trial{display:flex;gap:12px;align-items:flex-start;cursor:pointer}
  .mp-trial input{position:absolute;opacity:0}
  .mp-sw{flex:none;width:44px;height:26px;border-radius:99px;background:rgba(255,255,255,.18);position:relative;transition:background .2s;margin-top:2px}
  .mp-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
  .mp-trial input:checked+.mp-sw{background:var(--amber,#f2a93b)}
  .mp-trial input:checked+.mp-sw::after{transform:translateX(18px)}
  .mp-trial input:focus-visible+.mp-sw{outline:2px solid #fff;outline-offset:2px}
  .mp-trial b{display:block;font-size:14px}.mp-trial small{color:var(--text-mid,rgba(255,255,255,.7));font-size:12.5px;line-height:1.4}
  .mp-note{font-size:12.5px;color:var(--amber,#f2a93b);min-height:0}
  .pin-back{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:grid;place-items:center;padding:16px}
  .pin-box{background:#0f2a30;border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:22px;width:100%;max-width:340px;color:#fff;font-family:Inter,system-ui,sans-serif;text-align:center}
  .pin-box h3{margin:0 0 6px;font:700 17px "Space Grotesk",Inter,sans-serif}.pin-box p{margin:0 0 14px;font-size:13px;color:rgba(255,255,255,.7)}
  .pin-box input{width:100%;box-sizing:border-box;text-align:center;letter-spacing:.6em;font:700 24px Inter,sans-serif;padding:12px;border-radius:12px;border:1.5px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:#fff}
  .pin-box input:focus{outline:2px solid var(--teal,#0bb88a);border-color:transparent}
  .pin-err{color:#ff8a80;font-size:12.5px;min-height:18px;margin:8px 0 4px}
  .pin-row{display:flex;gap:8px;margin-top:6px}.pin-row button{flex:1;border:0;border-radius:12px;padding:11px;font:600 14px Inter,sans-serif;cursor:pointer}
  .pin-ok{background:var(--teal,#0bb88a);color:#04261d}.pin-no{background:rgba(255,255,255,.12);color:#fff}.pin-row button:disabled{opacity:.6;cursor:wait}`;
  document.head.appendChild(css);

  /* ── Homepage panel ─────────────────────────────────────────────── */
  function askPin() {
    return new Promise(resolve => {
      const back = document.createElement("div"); back.className = "pin-back";
      back.innerHTML = `<form class="pin-box" role="dialog" aria-modal="true" aria-label="Pengesahan PIN JKN"><h3>🔒 Peringkat JKN</h3><p>Masukkan PIN untuk membuka audit peringkat JKN.</p>
        <input id="pin-in" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN 4 digit">
        <div class="pin-err" id="pin-err" aria-live="polite"></div><div class="pin-row"><button type="button" class="pin-no">Batal</button><button type="submit" class="pin-ok">Sahkan</button></div></form>`;
      document.body.appendChild(back);
      const form = back.firstElementChild, inp = back.querySelector("#pin-in"), err = back.querySelector("#pin-err"), ok = back.querySelector(".pin-ok");
      inp.focus();
      const done = v => { back.remove(); resolve(v); };
      back.querySelector(".pin-no").onclick = () => done(false);
      back.addEventListener("mousedown", e => { if (e.target === back) done(false); });
      back.addEventListener("keydown", e => { if (e.key === "Escape") done(false); });
      inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); err.textContent = ""; });
      form.addEventListener("submit", async e => {
        e.preventDefault();
        if (inp.value.length !== 4) { err.textContent = "Masukkan 4 digit PIN."; return; }
        ok.disabled = true; ok.textContent = "Menyemak…";
        try { await M.verifyJkn(inp.value); done(true); }
        catch (ex) {
          const m = String(ex.message);
          err.textContent = m === "PIN_SALAH" ? "PIN salah." : m === "TERLALU_BANYAK_CUBAAN" ? "Terlalu banyak cubaan. Cuba lagi dalam 10 minit."
            : m === "JKN_PIN_BELUM_DITETAPKAN" ? "PIN JKN belum ditetapkan pada pelayan." : "Tidak dapat menyemak PIN. Semak sambungan internet.";
          ok.disabled = false; ok.textContent = "Sahkan"; inp.value = ""; inp.focus();
        }
      });
    });
  }
  function mountPanel() {
    const root = document.getElementById("mode-panel"); if (!root) return;
    root.innerHTML = `<div class="mp-card">
      <div><div class="mp-label">Peringkat audit</div><div class="mp-seg" role="group" aria-label="Peringkat audit">
        <button type="button" id="lv-daerah">🏥 Daerah</button><button type="button" id="lv-jkn">🏛️ JKN 🔒</button></div></div>
      <label class="mp-trial"><input type="checkbox" id="trial-toggle"><span class="mp-sw"></span><span><b>Mod Percubaan</b>
        <small>Borang kosong untuk berlatih. Tiada data disimpan dalam pangkalan data — keputusan &amp; PDF masih boleh dijana.</small></span></label>
      <div class="mp-note" id="mp-note" aria-live="polite"></div></div>`;
    const d = root.querySelector("#lv-daerah"), j = root.querySelector("#lv-jkn"), t = root.querySelector("#trial-toggle"), note = root.querySelector("#mp-note");
    const paint = () => {
      d.classList.toggle("is-on", M.level === "daerah"); j.classList.toggle("is-on", M.level === "jkn");
      d.setAttribute("aria-pressed", M.level === "daerah"); j.setAttribute("aria-pressed", M.level === "jkn");
      t.checked = M.trial;
      if (!M.hasJkn()) { j.disabled = true; note.textContent = "Peringkat JKN belum disediakan (URL JKN belum ditetapkan dalam config.js)."; }
      else note.textContent = M.trial ? "Mod percubaan AKTIF — data tidak akan disimpan." : M.level === "jkn" ? "Peringkat JKN aktif — data disimpan di lembaran JKN." : "";
    };
    d.onclick = () => { M.useDaerah(); paint(); };
    j.onclick = async () => { if (M.level === "jkn") return; if (await askPin()) paint(); };
    t.onchange = () => { M.setTrial(t.checked); paint(); };
    paint();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountPanel); else mountPanel();
})();
