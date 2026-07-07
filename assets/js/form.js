/**
 * form.js — Audit wizard v3
 * Steps: Maklumat → Status Ambulans → A → B → C → Ringkasan → Semak
 */

// ─────────────────────────────────────────────────────────────────────────
// ⚠️  EDIT THIS: question numbers marked "Tidak Berkenaan" when ambulans
//     tiada di lapangan. Soalan berkaitan rekod/dokumen biasanya TIDAK
//     perlu dimasukkan di sini (boleh semak walaupun ambulans tiada).
//
//     CONTOH soalan yang LAZIMNYA tidak berkenaan jika ambulans tiada:
//       Bahagian A — fizikal kenderaan:
//         1  Kebersihan luaran & dalaman ambulans
//         3  Cukai jalan (tidak dapat semak)
//         4  Senarai semak harian (tiada ambulans utk dirujuk)
//         5  Pemeriksaan lampu, tayar, brek
//         6  Peralatan kecemasan kenderaan (kon, pemadam api)
//         8  Set komunikasi GIRN dalam ambulans
//         9  Bahan pembersihan & pembasmian dalam ambulans
//       Bahagian B — peralatan fizikal dalam ambulans:
//         11 EMTS beg & alatan
//         13 Peralatan perubatan berfungsi & dalam keadaan baik
//         15 Item consumables dalam ambulans
//         16 Label peralatan/ubat di bahagian betul
//         17 Stretcher & safety strapping
//
//     Soalan ini TIDAK perlu dimasukkan (rekod boleh disemak tanpa ambulans):
//         2, 7, 10, 12, 14, 18–30 (semua Bahagian C — Dokumentasi)
//
//     CARA EDIT: Salin nombor soalan yang bersesuaian ke dalam array bawah.
//     Contoh siap guna: const TB_WHEN_TIADA = [1,3,4,5,6,8,9,11,13,15,16,17];
// ─────────────────────────────────────────────────────────────────────────
window.APP_CONFIG.GAS_URL = window.APP_CONFIG.FORM1_GAS_URL;
const TB_WHEN_TIADA = [1,5,6,8,9,15,16,17];
const TB_VAL = "TIDAK_BERKENAAN";

const STATE = {
  auditType: "audit",
  masterData: { daerah: [], klinikByDaerah: {} },
  header: { daerah:"", klinik:"", namaPPP:"", tarikhAudit:"" },
  ambulansStatus: null,   // "bersedia" | "tiada"
  ambulansSebab: "",
  answers: {},
  ringkasan: { kelebihan:"", kekurangan:"", cadangan:"", penambahbaikan:"" },
  currentStep: 0,
  result: null
};

const STEPS = [
  { key:"ambulans",  label:"Status"   },
  { key:"info",      label:"Maklumat" },
  { key:"section",   sectionIndex:0, label:"A" },
  { key:"section",   sectionIndex:1, label:"B" },
  { key:"section",   sectionIndex:2, label:"C" },
  { key:"ringkasan", label:"Ringkasan" },
  { key:"review",    label:"Semak"    }
];

function todayISO() {
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function todayDisplay() {
  const d = new Date();
  return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();
}
function isTB(qNo) {
  return STATE.ambulansStatus === "tiada" && TB_WHEN_TIADA.includes(qNo);
}

/* ── Init ─────────────────────────────────────────────────────────── */
async function init() {
  const params = new URLSearchParams(location.search);
  STATE.auditType = params.get("type") === "reaudit" ? "reaudit" : "audit";
  document.getElementById("auditor-badge").textContent =
    STATE.auditType === "reaudit" ? "Re-Audit (Penyelia)" : "Audit Teknikal";
  STATE.header.tarikhAudit = todayISO();

  AUDIT_SECTIONS.forEach(sec => sec.questions.forEach(q => {
    STATE.answers[q.no] = { penilaian:null, tindakSusul:null, catatan:"", photos:[] };
  }));

  renderStepPills();
  try {
    await Loading.withLoading("Memuatkan senarai daerah & klinik...", async () => {
      const res = await Api.gasGet("getMasterData");
      if (!res.success) throw new Error(res.error || "Gagal memuat data");
      STATE.masterData = res.data;
    });
  } catch(err) { toast("Gagal memuat senarai: "+err.message, "error"); }
  goToStep(0);
}

/* ── Progress ─────────────────────────────────────────────────────── */
function renderStepPills() {
  document.getElementById("step-pills").innerHTML = STEPS.map((s,i) =>
    `<div class="step-pill" data-step="${i}">${s.label}</div>`).join("");
}
function updateProgress() {
  const nonTB = Object.entries(STATE.answers).filter(([no]) => !isTB(Number(no)));
  const answered = nonTB.filter(([,a]) => a.penilaian && a.penilaian !== TB_VAL).length;
  const total = nonTB.length;
  const marks = totalMarks();
  document.getElementById("progress-fill").style.width = total ? Math.round(answered/total*100)+"%" : "0%";
  document.getElementById("progress-label").textContent = "Langkah "+(STATE.currentStep+1)+" / "+STEPS.length;
  document.getElementById("progress-score").textContent = marks+"/"+(total||TOTAL_QUESTIONS);
  document.querySelectorAll(".step-pill").forEach((el,i) => {
    el.classList.toggle("is-active", i===STATE.currentStep);
    el.classList.toggle("is-done", i<STATE.currentStep);
  });
}
function totalMarks() {
  return Object.values(STATE.answers).filter(a => a.penilaian==="YA").length;
}

/* ── Apply TB status to all relevant answers ──────────────────────── */
function applyTBStatus() {
  AUDIT_SECTIONS.forEach(sec => sec.questions.forEach(q => {
    if (isTB(q.no)) {
      STATE.answers[q.no].penilaian = TB_VAL;
      STATE.answers[q.no].tindakSusul = TB_VAL;
    } else if (STATE.answers[q.no].penilaian === TB_VAL) {
      // If user switched back to "bersedia", reset TB answers
      STATE.answers[q.no].penilaian = null;
      STATE.answers[q.no].tindakSusul = null;
    }
  }));
}

/* ── Navigation ───────────────────────────────────────────────────── */
function goToStep(n) {
  STATE.currentStep = n;
  const c = document.getElementById("step-container");
  c.innerHTML = "";
  const step = STEPS[n];
  if      (step.key==="info")      renderInfoStep(c);
  else if (step.key==="ambulans")  renderAmbulanStep(c);
  else if (step.key==="section")   renderSectionStep(c, step.sectionIndex);
  else if (step.key==="ringkasan") renderRingkasanStep(c);
  else if (step.key==="review")    renderReviewStep(c);
  updateProgress();
  window.scrollTo({ top:0, behavior:"smooth" });
}
function nextStep() {
  if (STEPS[STATE.currentStep].key==="info" && !validateInfo()) return;
  if (STEPS[STATE.currentStep].key==="ambulans" && !validateAmbulan()) return;
  if (STEPS[STATE.currentStep].key==="section") {
    const si = STEPS[STATE.currentStep].sectionIndex;
    const unanswered = AUDIT_SECTIONS[si].questions.filter(q => !isTB(q.no) && !STATE.answers[q.no].penilaian);
    if (unanswered.length) { toast("Sila jawab semua soalan dalam bahagian ini.", "error"); return; }
  }
  if (STATE.currentStep < STEPS.length-1) goToStep(STATE.currentStep+1);
}
function prevStep() { if (STATE.currentStep>0) goToStep(STATE.currentStep-1); }

/* ── Step 0: Maklumat Am ──────────────────────────────────────────── */
function renderInfoStep(c) {
  c.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="margin-bottom:14px;">Maklumat Am</h2>
      <div class="field"><label for="f-daerah">Daerah</label>
        <select id="f-daerah">
          <option value="">— Pilih Daerah —</option>
          ${STATE.masterData.daerah.map(d=>`<option value="${d}" ${STATE.header.daerah===d?"selected":""}>${d}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label for="f-klinik">Klinik Dilawati</label>
        <select id="f-klinik"><option value="">— Pilih Daerah dahulu —</option></select>
      </div>
      <div class="field"><label for="f-nama-ppp">Nama Auditor PPP</label>
        <input type="text" id="f-nama-ppp" class="input-uppercase" placeholder="NAMA PENUH" value="${STATE.header.namaPPP}">
      </div>
      <div class="field"><label>Tarikh Audit</label>
        <input type="text" class="input-readonly" value="${todayDisplay()}" readonly>
      </div>
    </div>
    <div class="btn-row"><button class="btn btn-primary btn-block" id="btn-next">Seterusnya →</button></div>
  `);


  const daerahSel = document.getElementById("f-daerah");
  const klinikSel = document.getElementById("f-klinik");
  function refreshKlinik(keep) {
    const list = STATE.masterData.klinikByDaerah[daerahSel.value] || [];
    klinikSel.innerHTML = `<option value="">— Pilih Klinik —</option>` +
      list.map(k=>`<option value="${k}" ${keep===k?"selected":""}>${k}</option>`).join("");
    klinikSel.disabled = !list.length;
  }
  if (STATE.header.daerah) refreshKlinik(STATE.header.klinik);
  daerahSel.addEventListener("change", () => { STATE.header.daerah=daerahSel.value; STATE.header.klinik=""; refreshKlinik(null); });
  klinikSel.addEventListener("change", () => { STATE.header.klinik=klinikSel.value; });

  const namaPPP = document.getElementById("f-nama-ppp");
  namaPPP.addEventListener("input", () => {
    const p = namaPPP.selectionStart; namaPPP.value = namaPPP.value.toUpperCase(); namaPPP.setSelectionRange(p,p);
    STATE.header.namaPPP = namaPPP.value;
  });
  document.getElementById("btn-next").addEventListener("click", nextStep);
}
function validateInfo() {
  if (!STATE.header.daerah)       { toast("Sila pilih Daerah.","error"); return false; }
  if (!STATE.header.klinik)       { toast("Sila pilih Klinik.","error"); return false; }
  if (!STATE.header.namaPPP.trim()){ toast("Sila isi Nama PPP / Auditor.","error"); return false; }
  return true;
}

/* ── Step 1: Status Ambulans ──────────────────────────────────────── */
function renderAmbulanStep(c) {
  c.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="margin-bottom:6px;">Status Ambulans</h2>
      <p style="font-size:13.5px;color:var(--color-text-muted);margin-bottom:18px;">
        Sila pilih status ambulans sebelum meneruskan audit.
      </p>

      <div class="ambulans-option ${STATE.ambulansStatus==="bersedia"?"is-selected":""}" id="opt-bersedia" tabindex="0" role="button">
        <div class="ambulans-option__icon">🚑</div>
        <div>
          <div class="ambulans-option__title">Ambulans bersedia di lapangan</div>
          <div class="ambulans-option__desc">Audit penuh boleh dijalankan</div>
        </div>
        <div class="ambulans-option__check">✓</div>
      </div>

      <div class="ambulans-option ${STATE.ambulansStatus==="tiada"?"is-selected":""}" id="opt-tiada" tabindex="0" role="button" style="margin-top:10px;">
        <div class="ambulans-option__icon">🚫</div>
        <div>
          <div class="ambulans-option__title">Ambulans tiada di lapangan</div>
          <div class="ambulans-option__desc">Sebahagian soalan tidak berkenaan</div>
        </div>
        <div class="ambulans-option__check">✓</div>
      </div>

      <div id="sebab-wrap" style="display:${STATE.ambulansStatus==="tiada"?"block":"none"};margin-top:14px;">
        <div class="field">
          <label for="f-sebab">Sebab Ambulans Tiada</label>
          <textarea id="f-sebab" placeholder="Contoh: Ambulans dalam penyelenggaraan, dihantar ke hospital..." style="min-height:80px;width:100%;border-radius:8px;border:1.5px solid var(--color-border-strong);padding:10px 12px;font-family:inherit;font-size:14px;">${STATE.ambulansSebab}</textarea>
        </div>
        ${TB_WHEN_TIADA.length ? `
        <div class="alert" style="background:var(--color-primary-tint);border-left:4px solid var(--color-primary);border-radius:8px;padding:10px 14px;font-size:13px;">
          <strong>Soalan tidak berkenaan akan dilangkau:</strong><br>
          ${TB_WHEN_TIADA.map(n=>"Soalan "+n).join(", ")}
        </div>` : `
        <div class="alert" style="background:#fff8e1;border-left:4px solid #f2a93b;border-radius:8px;padding:10px 14px;font-size:13px;">
          ⚠️ Senarai soalan tidak berkenaan belum ditetapkan. Edit <strong>TB_WHEN_TIADA</strong> dalam form.js.
        </div>`}
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="btn-back">← Kembali</button>
      <button class="btn btn-primary" id="btn-next">Mula Audit →</button>
    </div>
  `);

  function selectOption(val) {
    STATE.ambulansStatus = val;
    document.getElementById("opt-bersedia").classList.toggle("is-selected", val==="bersedia");
    document.getElementById("opt-tiada").classList.toggle("is-selected", val==="tiada");
    document.getElementById("sebab-wrap").style.display = val==="tiada" ? "block" : "none";
    applyTBStatus();
  }
  document.getElementById("opt-bersedia").addEventListener("click", () => selectOption("bersedia"));
  document.getElementById("opt-tiada").addEventListener("click", () => selectOption("tiada"));
  const sebabEl = document.getElementById("f-sebab");
  if (sebabEl) sebabEl.addEventListener("input", e => { STATE.ambulansSebab = e.target.value; });
  document.getElementById("btn-back").addEventListener("click", prevStep);
  document.getElementById("btn-next").addEventListener("click", nextStep);
}
function validateAmbulan() {
  if (!STATE.ambulansStatus) { toast("Sila pilih status ambulans.","error"); return false; }
  if (STATE.ambulansStatus==="tiada" && !STATE.ambulansSebab.trim()) {
    toast("Sila nyatakan sebab ambulans tiada di lapangan.","error"); return false;
  }
  return true;
}

/* ── Steps 2-4: Questions ─────────────────────────────────────────── */
function renderSectionStep(c, si) {
  const sec = AUDIT_SECTIONS[si];
  const tbCount = sec.questions.filter(q => isTB(q.no)).length;

  c.insertAdjacentHTML("beforeend", `
    <div class="section-divider">
      <div class="section-divider__badge">${sec.code}</div>
      <div>
        <div class="section-divider__title">${sec.title}</div>
        <div class="section-divider__count">
          ${sec.questions.length} soalan${tbCount ? ` · <span style="color:var(--color-text-faint)">${tbCount} tidak berkenaan</span>` : ""}
        </div>
      </div>
    </div>
    <div id="q-list"></div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="btn-back">← Kembali</button>
      <button class="btn btn-primary" id="btn-next">Seterusnya →</button>
    </div>
  `);

  const list = document.getElementById("q-list");
  sec.questions.forEach(q => {
    if (isTB(q.no)) {
      list.appendChild(buildTBCard(q));
    } else {
      list.appendChild(buildQuestionCard(q));
    }
  });
  document.getElementById("btn-back").addEventListener("click", prevStep);
  document.getElementById("btn-next").addEventListener("click", nextStep);
}

function buildTBCard(q) {
  const card = document.createElement("div");
  card.className = "q-card q-card--tb";
  card.innerHTML = `
    <div class="q-card__head">
      <div class="q-card__no" style="background:var(--color-surface-sunken);color:var(--color-text-faint);">${q.no}</div>
      <div class="q-card__text" style="color:var(--color-text-faint);">${q.text}</div>
    </div>
    <div class="tb-badge">⊘ Tidak Berkenaan — Ambulans Tiada di Lapangan</div>
  `;
  return card;
}

function buildQuestionCard(q) {
  const ans = STATE.answers[q.no];
  const card = document.createElement("div");
  card.className = "q-card"; card.dataset.qno = q.no;
  card.innerHTML = `
    <div class="q-card__head">
      <div class="q-card__no">${q.no}</div>
      <div class="q-card__text">${q.text}</div>
    </div>
    <div class="toggle-group-label">Penilaian</div>
    <div class="toggle-row" data-group="penilaian">
      <button type="button" class="toggle-btn choice-ya" data-val="YA">Ya ✓</button>
      <button type="button" class="toggle-btn choice-tidak" data-val="TIDAK">Tidak ✗</button>
    </div>
    <div class="toggle-group-label">Tindak Susul</div>
    <div class="toggle-row" data-group="tindakSusul">
      <button type="button" class="toggle-btn choice-perlu" data-val="PERLU">Perlu</button>
      <button type="button" class="toggle-btn choice-tidak_perlu" data-val="TIDAK_PERLU">Tidak Perlu</button>
    </div>
    <div class="q-card__catatan">
      <textarea placeholder="Catatan / bukti penemuan...">${ans.catatan}</textarea>
    </div>
    <div class="photo-zone">
      <div class="photo-thumbs"></div>
      <label class="photo-add-btn">📷 Tambah Foto
        <input type="file" accept="image/*" capture="environment" multiple style="display:none;">
      </label>
    </div>
  `;

  card.querySelectorAll('[data-group="penilaian"] .toggle-btn').forEach(btn => {
    btn.addEventListener("click", () => {
      ans.penilaian=btn.dataset.val; syncGroup(card,"penilaian");
      card.classList.toggle("is-answered-ya", ans.penilaian==="YA");
      card.classList.toggle("is-answered-tidak", ans.penilaian==="TIDAK");
      updateProgress();
    });
  });
  card.querySelectorAll('[data-group="tindakSusul"] .toggle-btn').forEach(btn => {
    btn.addEventListener("click", () => { ans.tindakSusul=btn.dataset.val; syncGroup(card,"tindakSusul"); });
  });
  syncGroup(card,"penilaian"); syncGroup(card,"tindakSusul");
  card.classList.toggle("is-answered-ya", ans.penilaian==="YA");
  card.classList.toggle("is-answered-tidak", ans.penilaian==="TIDAK");

  card.querySelector("textarea").addEventListener("input", e => { ans.catatan=e.target.value; });
  renderThumbs(card, q.no);
  card.querySelector('input[type="file"]').addEventListener("change", async e => {
    const files = Array.from(e.target.files||[]);
    if (!files.length) return;
    await Loading.withLoading("Memampatkan foto...", async () => {
      for (const f of files) {
        try { ans.photos.push({ dataUrl: await compressImage(f), filename: f.name }); }
        catch(err) { console.error(err); }
      }
    });
    renderThumbs(card, q.no); e.target.value="";
  });
  return card;
}

function syncGroup(card, group) {
  const val = STATE.answers[Number(card.dataset.qno)][group];
  card.querySelectorAll(`[data-group="${group}"] .toggle-btn`).forEach(btn =>
    btn.classList.toggle("is-selected", btn.dataset.val===val));
}

function renderThumbs(card, qNo) {
  const ans = STATE.answers[qNo];
  const wrap = card.querySelector(".photo-thumbs");
  wrap.innerHTML = ans.photos.map((p,i) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" alt="Foto ${i+1}">
      <button type="button" class="photo-thumb__remove" data-idx="${i}">×</button>
    </div>`).join("");
  wrap.querySelectorAll(".photo-thumb__remove").forEach(btn =>
    btn.addEventListener("click", () => { ans.photos.splice(Number(btn.dataset.idx),1); renderThumbs(card,qNo); }));
}

function compressImage(file, maxDim=1280, quality=0.72) {
  return new Promise((res,rej) => {
    const img=new Image(), reader=new FileReader();
    reader.onerror=rej;
    reader.onload=()=>{
      img.onerror=rej;
      img.onload=()=>{
        let {width:w,height:h}=img;
        if(w>h&&w>maxDim){h=Math.round(h*maxDim/w);w=maxDim;}
        else if(h>maxDim){w=Math.round(w*maxDim/h);h=maxDim;}
        const canvas=document.createElement("canvas");
        canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        res(canvas.toDataURL("image/jpeg",quality));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── Step 5: Ringkasan Laporan Audit ──────────────────────────────── */
function renderRingkasanStep(c) {
  const r = STATE.ringkasan;
  c.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="margin-bottom:4px;">Ringkasan Laporan Audit</h2>
      <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:18px;">
        Sila isi rumusan dapatan audit sebelum menghantar laporan.
      </p>

      <div class="ringkasan-block">
        <div class="ringkasan-block__label">
          <span class="ringkasan-block__icon" style="background:#e4f4ec;color:#1e8e5a;">✓</span>
          Kelebihan
        </div>
        <textarea id="r-kelebihan" class="ringkasan-ta" placeholder="Nyatakan kelebihan / perkara baik yang diperhatikan semasa audit...">${r.kelebihan}</textarea>
      </div>

      <div class="ringkasan-block">
        <div class="ringkasan-block__label">
          <span class="ringkasan-block__icon" style="background:#fbe8e5;color:#c0392b;">✗</span>
          Kekurangan
        </div>
        <textarea id="r-kekurangan" class="ringkasan-ta" placeholder="Nyatakan kekurangan / isu yang dikesan semasa audit...">${r.kekurangan}</textarea>
      </div>

      <div class="ringkasan-block">
        <div class="ringkasan-block__label">
          <span class="ringkasan-block__icon" style="background:#e3eeec;color:#0b4f5c;">💡</span>
          Cadangan
        </div>
        <textarea id="r-cadangan" class="ringkasan-ta" placeholder="Nyatakan cadangan untuk penambahbaikan...">${r.cadangan}</textarea>
      </div>

      <div class="ringkasan-block">
        <div class="ringkasan-block__label">
          <span class="ringkasan-block__icon" style="background:#fff3e0;color:#e8a23b;">🔧</span>
          Penambahbaikan
        </div>
        <textarea id="r-penambahbaikan" class="ringkasan-ta" placeholder="Nyatakan tindakan penambahbaikan yang perlu dilaksanakan...">${r.penambahbaikan}</textarea>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="btn-back">← Kembali</button>
      <button class="btn btn-primary" id="btn-next">Semak & Hantar →</button>
    </div>
  `);

  ["kelebihan","kekurangan","cadangan","penambahbaikan"].forEach(key => {
    document.getElementById("r-"+key).addEventListener("input", e => { STATE.ringkasan[key]=e.target.value; });
  });
  document.getElementById("btn-back").addEventListener("click", prevStep);
  document.getElementById("btn-next").addEventListener("click", nextStep);
}
function launchFireworks() {
          const duration = 5 * 1000; // The fireworks show will last for 5 seconds
          const animationEnd = Date.now() + duration;
          const defaults = { 
            startVelocity: 30, 
            spread: 360, 
            ticks: 60, 
            zIndex: 1001 
          };

          function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
          }

          const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
    
            // Launch a firework from the left side
            confetti(Object.assign({}, defaults, { 
              particleCount, 
              origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } 
            }));
    
            // Launch a firework from the right side
            confetti(Object.assign({}, defaults, { 
              particleCount, 
              origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } 
            }));
          }, 250); // Launch new fireworks every 250ms
        }
/* ── Step 6: Semak & Hantar ───────────────────────────────────────── */
function renderReviewStep(c) {
  const marks = totalMarks();
  const nonTBTotal = Object.keys(STATE.answers).filter(no => !isTB(Number(no))).length;
  const pct = Math.round(marks/nonTBTotal*100);
  const kat = getKategori(pct);
  const tbCount = AUDIT_SECTIONS.reduce((s,sec)=>s+sec.questions.filter(q=>isTB(q.no)).length,0);

  c.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="margin-bottom:10px;">Semak Sebelum Hantar</h2>
      <div style="font-size:13.5px;color:var(--color-text-muted);margin-bottom:10px;line-height:1.7;">
        <strong>${STATE.header.klinik}</strong> · ${STATE.header.daerah}<br>
        PPP / Auditor: <strong>${STATE.header.namaPPP}</strong><br>
        Tarikh: ${STATE.header.tarikhAudit}
        ${STATE.auditType==="reaudit"?'<span class="re-audit-tag">RE-AUDIT</span>':""}
      </div>

      <div class="review-ambulans-status ${STATE.ambulansStatus==="tiada"?"is-tiada":""}">
        ${STATE.ambulansStatus==="bersedia"
          ? "🚑 Ambulans bersedia di lapangan"
          : `🚫 Ambulans tiada di lapangan — ${STATE.ambulansSebab}`}
      </div>

      ${AUDIT_SECTIONS.map(sec=>{
        const ya=sec.questions.filter(q=>!isTB(q.no)&&STATE.answers[q.no].penilaian==="YA").length;
        const total=sec.questions.filter(q=>!isTB(q.no)).length;
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--color-border);">
          <span>Bahagian ${sec.code} — ${sec.title}</span><strong>${ya}/${total}</strong></div>`;
      }).join("")}

      ${tbCount ? `<div style="padding:8px 0;font-size:13px;color:var(--color-text-faint);">⊘ ${tbCount} soalan tidak berkenaan (diabaikan dalam pengiraan)</div>`:""}

      <div class="score-hero">
        <div class="score-hero__value">${marks}/${nonTBTotal}</div>
        <div class="score-hero__sub">${pct}% markah</div>
        <div class="kategori-chip" style="background:${kat.color}22;color:${kat.color};">${kat.label}</div>
      </div>
      <div class="spectrum" id="review-spectrum"></div>

      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--color-border);">
        <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;color:var(--color-text-faint);letter-spacing:.04em;margin-bottom:8px;">Ringkasan Laporan</div>
        ${["kelebihan","kekurangan","cadangan","penambahbaikan"].map(k=>`
          <div style="margin-bottom:6px;font-size:13px;">
            <span style="font-weight:600;text-transform:capitalize;">${k}:</span>
            <span style="color:var(--color-text-muted)">${STATE.ringkasan[k]||"—"}</span>
          </div>`).join("")}
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="btn-back">← Kembali</button>
      <button class="btn btn-accent" id="btn-submit">Hantar Audit ✓</button>
    </div>
  `);

  renderSpectrum(document.getElementById("review-spectrum"), pct);
  document.getElementById("btn-back").addEventListener("click", prevStep);
  document.getElementById("btn-submit").addEventListener("click", submitAudit);
}

/* ── Submit ───────────────────────────────────────────────────────── */
async function submitAudit() {
  try {
    const nonTBTotal = Object.keys(STATE.answers).filter(no => !isTB(Number(no))).length;
    const result = await Loading.withLoading("Menghantar audit & memuat naik foto...", async () => {
      const payload = {
        auditType: STATE.auditType,
        daerah: STATE.header.daerah,
        klinik: STATE.header.klinik,
        namaPPP: STATE.header.namaPPP,
        tarikhAudit: STATE.header.tarikhAudit,
        ambulansStatus: STATE.ambulansStatus,
        ambulansSebab: STATE.ambulansSebab,
        ringkasan: STATE.ringkasan,
        answers: Object.entries(STATE.answers).map(([qNo,a]) => ({
          qNo: Number(qNo),
          penilaian: a.penilaian || "",
          tindakSusul: a.tindakSusul || "",
          catatan: a.catatan,
          photos: (a.photos||[]).map(p=>({ dataUrl:p.dataUrl, filename:p.filename }))
        }))
      };
      const res = await Api.gasPost("submitAudit", payload);
      if (!res.success) throw new Error(res.error||"Gagal menghantar");
      return { ...res, nonTBTotal };
    });
    STATE.result = result;
    renderResultStep();
  } catch(err) { toast("Gagal menghantar: "+err.message, "error"); }
}

/* ── Result + Star Rating ─────────────────────────────────────────── */
function renderResultStep() {
  const c = document.getElementById("step-container");
  c.innerHTML = "";
  const r = STATE.result;
  const kat = getKategori(r.percentage);

  c.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="text-align:center;margin-bottom:14px;">Audit Berjaya Dihantar ✅</h2>
      <div class="score-hero">
        <div class="score-hero__value">${r.totalMarks}/${r.nonTBTotal||TOTAL_QUESTIONS}</div>
        <div class="score-hero__sub">${r.percentage}% markah</div>
        <div class="kategori-chip" style="background:${kat.color}22;color:${kat.color};">${kat.label}</div>
      </div>
      <div class="spectrum" id="result-spectrum"></div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:4px;">Maklum Balas Penggunaan</h3>
      <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:14px;">Bantu kami menambah baik sistem ini.</p>
      <div class="toggle-group-label">Penilaian Sistem</div>
      <div class="star-row" id="star-row">
        ${[1,2,3,4,5].map(n=>`<button type="button" class="star-btn" data-val="${n}">★</button>`).join("")}
      </div>
      <div style="text-align:center;font-size:12px;color:var(--color-text-faint);margin:4px 0 12px;" id="star-label">Pilih bintang</div>
      <div class="field">
        <label>Komen / Cadangan</label>
        <textarea id="rating-comment" placeholder="Pengalaman atau cadangan anda..." style="min-height:72px;width:100%;border-radius:8px;border:1.5px solid var(--color-border-strong);padding:10px 12px;font-family:inherit;font-size:14px;"></textarea>
      </div>
      <button class="btn btn-primary btn-block" id="btn-rate">Hantar Maklum Balas</button>
      <div id="rating-done" style="display:none;text-align:center;color:var(--color-success);font-weight:600;padding:12px 0;">Terima kasih! 🙏</div>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary btn-block" id="btn-pdf">⬇ Muat Turun PDF Laporan</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost btn-block" id="btn-new">← Borang Baru</button>
    </div>
  `);
launchFireworks();
  renderSpectrum(document.getElementById("result-spectrum"), r.percentage);
  document.querySelectorAll(".step-pill").forEach(el => el.classList.add("is-done"));
  document.getElementById("progress-fill").style.width="100%";
  document.getElementById("progress-label").textContent="Selesai";

  const STAR_LABELS=["","Sangat Lemah","Lemah","Memuaskan","Baik","Sangat Baik"];
  let selectedStar=0;
  const stars=document.querySelectorAll(".star-btn");
  const starLabel=document.getElementById("star-label");
  function highlightStars(n){ stars.forEach(b=>b.classList.toggle("is-selected",Number(b.dataset.val)<=n)); }
  stars.forEach(btn=>{
    btn.addEventListener("mouseenter",()=>highlightStars(Number(btn.dataset.val)));
    btn.addEventListener("mouseleave",()=>highlightStars(selectedStar));
    btn.addEventListener("click",()=>{ selectedStar=Number(btn.dataset.val); highlightStars(selectedStar); starLabel.textContent=STAR_LABELS[selectedStar]+" — "+selectedStar+"/5"; });
  });

  document.getElementById("btn-rate").addEventListener("click", async () => {
    if (!selectedStar){ toast("Sila pilih bintang dahulu.","error"); return; }
    try {
      await Loading.withLoading("Menghantar maklum balas...", async()=>{
        await Api.gasPost("submitRating",{ submissionId:r.submissionId, rating:selectedStar, comment:document.getElementById("rating-comment").value.trim() });
      });
      document.getElementById("btn-rate").style.display="none";
      document.getElementById("rating-done").style.display="block";
    } catch(err){ toast("Gagal hantar: "+err.message,"error"); }
  });

  document.getElementById("btn-pdf").addEventListener("click", async () => {
    try {
      await Loading.withLoading("Menjana PDF...", async()=>{
        await generateAuditPdf({
          header: STATE.header,
          answers: STATE.answers,
          ringkasan: STATE.ringkasan,
          ambulansStatus: STATE.ambulansStatus,
          ambulansSebab: STATE.ambulansSebab,
          tbQuestions: TB_WHEN_TIADA,
          totalMarks: r.totalMarks,
          nonTBTotal: r.nonTBTotal || TOTAL_QUESTIONS,
          percentage: r.percentage,
          isReaudit: STATE.auditType==="reaudit"
        });
      });
    } catch(err){ toast("Gagal menjana PDF: "+err.message,"error"); }
  });

  document.getElementById("btn-new").addEventListener("click", ()=>location.href="ambulans.html");
}
init();
