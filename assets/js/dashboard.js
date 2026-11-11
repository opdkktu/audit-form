/* dashboard.js v4 — skeleton loading, lazy animated charts, column filters,
 * click-to-view detail with real question text + resilient photo loading.
 * Works with the new Code_dashboard.gs (getAuditDetail / getPhotos) and degrades gracefully on the old one. */
(function () {
  window.Api = window.Api || {};
  const A = window.Api;
  A.driveId = A.driveId || (u => { const m = String(u || "").match(/[?&]id=([\w-]+)/) || String(u || "").match(/\/d\/([\w-]+)/); return m ? m[1] : null; });
  A.driveThumb = A.driveThumb || ((u, s) => { const i = A.driveId(u); return i ? "https://drive.google.com/thumbnail?id=" + i + "&sz=w" + (s || 300) : (u || ""); });
  A.driveAlt = A.driveAlt || ((u, s) => { const i = A.driveId(u); return i ? "https://lh3.googleusercontent.com/d/" + i + "=w" + (s || 300) : (u || ""); });
  A.escapeHtml = A.escapeHtml || (v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  if (typeof window.loadScript !== "function") window.loadScript = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
})();

let RAW = { submissions: [], details: [], totalKK: 0, totalKKByDaerah: {}, totalKKWithAmbulan: 0, totalKKWithAmbulanByDaerah: {} };
let CHARTS = {}, ACTIVE_LEVEL = "daerah", LATEST = [], SESSION_PIN = "", TABLE_LIMIT = 25, DETAILS_STATE = "idle";
const DETAIL_CACHE = new Map(), SEEN = new Set();
const $ = id => document.getElementById(id);
const esc = v => Api.escapeHtml(v);
const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const parseDmy = s => { const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(s); };
const katColor = k => (KATEGORI_SCALE.find(t => t.label === k) || {}).color || "#888";
const isUnknownAction = e => /ACTION_TIDAK_DIKENALI/.test(String((e && e.message) || e));
const CHART_URL = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js";
let chartLib; const loadChartLib = () => chartLib || (chartLib = loadScript(CHART_URL));
window.addEventListener("load", () => setTimeout(() => loadChartLib().catch(() => {}), 300)); // preload while user types PIN

/* ── Question text lookup ───────────────────────────────────────────
 * questions-data.js (ambulans) is already loaded by the page. questions-data2.js (kecemasan) ALSO declares
 * `const AUDIT_SECTIONS`, so it is fetched and evaluated in an isolated function scope instead of a 2nd <script>. */
let QMAP = null, qPromise = null;
const tidy = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
function indexSections(sections) {
  const m = {};
  (sections || []).forEach(sec => sec.questions.forEach(q => { m[q.no] = { text: tidy(q.text), code: sec.code, title: tidy(sec.title) }; }));
  return m;
}
function loadQuestions() {
  return qPromise || (qPromise = (async () => {
    const map = { ambulans: indexSections(typeof AUDIT_SECTIONS !== "undefined" ? AUDIT_SECTIONS : []), kecemasan: {} };
    try {
      const txt = await (await fetch("assets/js/questions-data2.js")).text();
      map.kecemasan = indexSections(new Function(txt + "\n;return AUDIT_SECTIONS;")());
    } catch (e) { console.warn("Soalan kecemasan gagal dimuat:", e.message); }
    return (QMAP = map);
  })());
}
const qInfo = (type, no) => ((QMAP && QMAP[type]) || {})[no] || null;
const wrapText = (s, n) => { const out = []; let line = ""; tidy(s).split(" ").forEach(w => { if ((line + " " + w).trim().length > (n || 60)) { out.push(line); line = w; } else line = (line + " " + w).trim(); }); if (line) out.push(line); return out; };

/* ── PIN gate ───────────────────────────────────────────────────── */
(function () {
  const digits = Array.from(document.querySelectorAll(".pin-digit"));
  digits.forEach((el, i) => {
    el.addEventListener("input", () => { el.value = el.value.replace(/\D/g, "").slice(0, 1); if (el.value && digits[i + 1]) digits[i + 1].focus(); });
    el.addEventListener("keydown", e => { if (e.key === "Backspace" && !el.value && digits[i - 1]) digits[i - 1].focus(); });
  });
  $("pin-form").addEventListener("submit", async e => {
    e.preventDefault();
    const pin = digits.map(d => d.value).join(""), errEl = $("pin-error");
    errEl.style.display = "none";
    if (pin.length !== 4) { errEl.style.display = "block"; return; }
    try {
      await Loading.withLoading("Mengesahkan PIN...", async () => {
        const res = await Api.gasPost("getDashboardData", { pin, lite: true });
        if (!res.success) throw new Error(res.error || "PIN_SALAH");
        RAW = res.data; SESSION_PIN = pin;
      });
    } catch (err) {
      const m = String(err.message);
      errEl.textContent = m === "PIN_SALAH" ? "PIN salah. Sila cuba lagi." : m === "TERLALU_BANYAK_CUBAAN" ? "Terlalu banyak cubaan. Cuba lagi dalam 10 minit." : "Ralat: " + m;
      errEl.style.display = "block"; digits.forEach(d => d.value = ""); digits[0].focus();
      return;
    }
    startDashboard(); // separate from the PIN try/catch so a render error is never reported as "PIN salah"
  });
})();

async function startDashboard() {
  $("pin-gate").remove();
  $("dashboard-content").style.display = "block";
  try {
    showSkeletons(); setupFilters(); wireTableFilters(); initLazyCharts();
    loadQuestions();
    try { await loadChartLib(); } catch (_) { toast("Carta tidak dapat dimuatkan. Semak sambungan internet.", "error"); }
    switchLevel("daerah");
    loadDetailsInBackground();
  } catch (err) { console.error(err); toast("Ralat paparan: " + err.message, "error"); }
}

/* ── Skeletons ──────────────────────────────────────────────────── */
function showSkeletons() {
  $("kpi-grid").innerHTML = '<div class="skel skel-kpi"></div>'.repeat(4);
  $("audit-table").querySelector("tbody").innerHTML = Array(6).fill('<tr class="skel-row">' + '<td><div class="skel"></div></td>'.repeat(8) + '</tr>').join("");
}

/* ── Lazy, animated charts (draw when scrolled into view) ───────── */
const CHART_DEFS = {
  daerah: { canvas: "chart-daerah", fn: renderDaerahChart }, kategori: { canvas: "chart-kategori", fn: renderKategoriChart },
  trend: { canvas: "chart-trend", fn: renderTrendChart }, failpoints: { canvas: "chart-failpoints", fn: renderFailpointsChart }
};
function initLazyCharts() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target); SEEN.add(e.target.dataset.chart); drawChart(e.target.dataset.chart);
  }), { rootMargin: "60px" });
  Object.entries(CHART_DEFS).forEach(([k, d]) => {
    const card = $(d.canvas).closest(".card"); card.dataset.chart = k; card.classList.add("is-loading"); io.observe(card);
  });
}
function drawChart(k) {
  if (!SEEN.has(k) || !window.Chart) return;
  const card = $(CHART_DEFS[k].canvas).closest(".card");
  if (k === "failpoints" && DETAILS_STATE !== "done") { card.classList.add("is-loading"); return; }
  CHART_DEFS[k].fn(LATEST); card.classList.remove("is-loading");
}
const barAnim = REDUCED ? false : { duration: 800, easing: "easeOutQuart", delay: c => (c.type === "data" && c.mode === "default" ? c.dataIndex * 70 : 0) };
function destroyChart(k) { if (CHARTS[k]) { CHARTS[k].destroy(); delete CHARTS[k]; } }

function renderDaerahChart(subs) {
  const by = {}; subs.forEach(s => (by[s.daerah] = by[s.daerah] || []).push(Number(s.percentage)));
  const labels = Object.keys(by).sort(), data = labels.map(d => Math.round(by[d].reduce((a, b) => a + b, 0) / by[d].length));
  destroyChart("daerah");
  CHARTS.daerah = new Chart($("chart-daerah"), { type: "bar",
    data: { labels, datasets: [{ label: "Purata %", data, backgroundColor: "#0B4F5C", borderRadius: 6 }] },
    options: { animation: barAnim, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } } });
}
function renderKategoriChart(subs) {
  const counts = {}; KATEGORI_SCALE.forEach(t => counts[t.label] = 0);
  subs.forEach(s => { if (counts[s.kategori] !== undefined) counts[s.kategori]++; });
  destroyChart("kategori");
  CHARTS.kategori = new Chart($("chart-kategori"), { type: "doughnut",
    data: { labels: KATEGORI_SCALE.map(t => t.label), datasets: [{ data: KATEGORI_SCALE.map(t => counts[t.label]), backgroundColor: KATEGORI_SCALE.map(t => t.color), borderWidth: 2, borderColor: "#fff" }] },
    options: { cutout: "58%", animation: REDUCED ? false : { animateRotate: true, animateScale: true, duration: 1100, easing: "easeOutCubic" },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } } } } });
}
function renderTrendChart(subs) {
  const sorted = [...subs].sort((a, b) => parseDmy(a.tarikhAudit) - parseDmy(b.tarikhAudit)); // dd/mm/yyyy-aware sort
  destroyChart("trend");
  CHARTS.trend = new Chart($("chart-trend"), { type: "line",
    data: { labels: sorted.map(s => s.tarikhAudit), datasets: [{ label: "% Markah", data: sorted.map(s => Number(s.percentage)), borderColor: "#F2A93B", backgroundColor: "#F2A93B33", fill: true, tension: 0.35, pointRadius: 3 }] },
    options: { animations: REDUCED ? false : { y: { from: c => c.chart.scales.y.getPixelForValue(0), duration: 1100, easing: "easeOutQuart" } },
      plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } } });
}
function renderFailpointsChart(subs) {
  const ids = new Set(subs.map(s => s.submissionId)), counts = {};
  RAW.details.forEach(d => { // key by type+question so ambulans Q5 and kecemasan Q5 are not merged
    if (!ids.has(d.submissionId) || d.penilaian !== "TIDAK") return;
    const k = d.auditType + "|" + d.qNo; counts[k] = (counts[k] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const lab = k => { const [t, n] = k.split("|"); return (t === "ambulans" ? "Amb" : "Kec") + " S" + n; };
  destroyChart("failpoints");
  CHARTS.failpoints = new Chart($("chart-failpoints"), { type: "bar",
    data: { labels: top.map(([k]) => lab(k)), datasets: [{ label: "Bilangan Tidak", data: top.map(([, n]) => n), backgroundColor: "#C0392B", borderRadius: 6 }] },
    options: { indexAxis: "y", animation: barAnim,
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => { // hover shows the real question text
        const [t, n] = top[items[0].dataIndex][0].split("|"), q = qInfo(t, n);
        return q ? wrapText(q.code + n + ". " + q.text, 55) : items[0].label; } } } },
      scales: { x: { beginAtZero: true } } } });
}

/* Bulk details (all rows of all audits) — only needed for the "Soalan Paling Kerap Gagal" chart and as a fallback for old backends. */
let bulkPromise = null;
function ensureBulkDetails() {
  if (RAW.details && RAW.details.length) return Promise.resolve();
  return bulkPromise || (bulkPromise = Api.gasPost("getDashboardData", { pin: SESSION_PIN })
    .then(res => { if (!res.success) throw new Error(res.error); RAW.details = res.data.details || []; })
    .finally(() => { bulkPromise = null; }));
}
async function loadDetailsInBackground() {
  DETAILS_STATE = "loading";
  await loadQuestions();
  try { await ensureBulkDetails(); } catch (e) { console.warn("Butiran gagal dimuat:", e.message); }
  DETAILS_STATE = "done"; drawChart("failpoints");
}

/* ── Top filters (these also drive KPIs + charts) ───────────────── */
function setupFilters() {
  const dSel = $("filter-daerah"), kSel = $("filter-klinik"), tSel = $("filter-audit-type");
  const opts = (first, list) => `<option value="">${first}</option>` + list.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  dSel.innerHTML = opts("Semua Daerah", [...new Set(RAW.submissions.map(s => s.daerah))].sort());
  const refreshKlinik = () => {
    const pool = dSel.value ? RAW.submissions.filter(s => s.daerah === dSel.value) : RAW.submissions;
    kSel.innerHTML = opts("Semua Klinik", [...new Set(pool.map(s => s.klinik))].sort());
  };
  refreshKlinik();
  dSel.addEventListener("change", () => { refreshKlinik(); renderAll(); });
  kSel.addEventListener("change", renderAll); tSel.addEventListener("change", renderAll);
}
function filteredSubmissions() {
  const d = $("filter-daerah").value, k = $("filter-klinik").value, t = $("filter-audit-type").value;
  return RAW.submissions.filter(s => (ACTIVE_LEVEL === "jkn") === (s.level === "jkn") && (!d || s.daerah === d) && (!k || s.klinik === k) && (!t || s.auditType === t));
}

function renderAll() {
  LATEST = filteredSubmissions(); TABLE_LIMIT = 25;
  renderProgress(LATEST); renderKpis(LATEST); renderTable(LATEST);
  Object.keys(CHART_DEFS).forEach(drawChart);
}

/* ── Progress ───────────────────────────────────────────────────── */
function renderProgress(subs) {
  const year = new Date().getFullYear(), type = $("filter-audit-type").value, daerah = $("filter-progress-daerah").value;
  $("prog-year-label").textContent = year;
  const ys = subs.filter(s => parseDmy(s.tarikhAudit).getFullYear() === year);
  const f = daerah ? ys.filter(s => s.daerah === daerah) : ys, audited = new Set(f.map(s => s.klinik)).size;
  const total = type === "ambulans" ? (daerah ? RAW.totalKKWithAmbulanByDaerah[daerah] || 0 : RAW.totalKKWithAmbulan) : (daerah ? RAW.totalKKByDaerah[daerah] || 0 : RAW.totalKK);
  const pct = total ? Math.min(100, Math.round(audited / total * 100)) : 0;
  $("prog-label").textContent = `${audited} / ${total} Klinik Kesihatan`;
  countUp($("prog-pct"), pct, "%");
  setTimeout(() => { $("prog-fill").style.width = pct + "%"; }, 100);
  const sel = $("filter-progress-daerah");
  if (sel.options.length === 1) {
    Object.keys(RAW.totalKKByDaerah).sort().forEach(d => sel.add(new Option(d, d)));
    sel.addEventListener("change", () => renderProgress(filteredSubmissions()));
  }
}

/* ── KPIs with count-up ─────────────────────────────────────────── */
function countUp(el, to, suffix) {
  suffix = suffix || "";
  if (REDUCED) { el.textContent = to + suffix; return; }
  const t0 = performance.now(), dur = 900;
  (function tick(t) { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix; if (p < 1) requestAnimationFrame(tick); })(t0);
}
function renderKpis(subs) {
  const avg = subs.length ? Math.round(subs.reduce((s, r) => s + Number(r.percentage), 0) / subs.length) : 0;
  const kc = {}; subs.forEach(s => kc[s.kategori] = (kc[s.kategori] || 0) + 1);
  const top = Object.entries(kc).sort((a, b) => b[1] - a[1])[0];
  const card = (l, id, extra) => `<div class="kpi-card"><div class="kpi-card__label">${l}</div><div class="kpi-card__value" id="${id}" ${extra || ""}></div></div>`;
  $("kpi-grid").innerHTML = card("Jumlah Audit", "k1") + card("Purata Markah", "k2") + card("Klinik Disemak", "k3") + card("Kategori Terkerap", "k4", 'style="font-size:13px;"');
  countUp($("k1"), subs.length); countUp($("k2"), avg, "%"); countUp($("k3"), new Set(subs.map(s => s.klinik)).size);
  $("k4").textContent = top ? top[0] : "-";
  renderSpectrum($("dashboard-spectrum"), avg);
}

/* ── Audit table: a filter for EVERY column + whole-row click ───── */
const TF = { from: "", to: "", daerah: "", klinik: "", ppp: "", type: "", min: "", max: "", kat: "" };
const TF_SELECTS = { daerah: "tf-daerah", klinik: "tf-klinik", type: "tf-type", kat: "tf-kat" };
const TF_TYPED = { ppp: "tf-ppp", min: "tf-min", max: "tf-max" };
const dayKey = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const inRange = s => { if (!TF.from) return true; const d = parseDmy(s.tarikhAudit); if (isNaN(d)) return false; const k = dayKey(d); return k >= TF.from && k <= TF.to; };
const normTxt = v => String(v == null ? "" : v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function applyTableFilters(subs) {
  const q = normTxt(TF.ppp).trim(), min = TF.min === "" ? null : +TF.min, max = TF.max === "" ? null : +TF.max;
  return subs.filter(s => {
    const pct = Number(s.percentage) || 0;
    return inRange(s) && (!TF.daerah || s.daerah === TF.daerah) && (!TF.klinik || s.klinik === TF.klinik)
      && (!q || normTxt(s.namaPPP).includes(q)) && (!TF.type || (s.auditLabel || s.auditType) === TF.type)
      && (min === null || pct >= min) && (max === null || pct <= max) && (!TF.kat || s.kategori === TF.kat);
  });
}
/* Dropdown options come from the rows currently in scope (level + top filters); a chosen value that is no longer valid is cleared. */
function refreshTableFilterOptions(subs) {
  const uniq = f => [...new Set(subs.map(f).filter(Boolean))];
  const lists = {
    daerah: uniq(s => s.daerah).sort().map(v => [v, v]),
    klinik: uniq(s => s.klinik).sort().map(v => [v, v]),
    type: uniq(s => s.auditLabel || s.auditType).sort().map(v => [v, v]),
    kat: KATEGORI_SCALE.map(t => t.label).filter(l => subs.some(s => s.kategori === l)).map(v => [v, v])
  };
  Object.entries(TF_SELECTS).forEach(([key, id]) => {
    const el = $(id);
    if (TF[key] && !lists[key].some(([v]) => v === TF[key])) TF[key] = "";
    el.innerHTML = '<option value="">Semua</option>' + lists[key].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
    el.value = TF[key];
  });
}
function wireTableFilters() {
  const onChange = () => { TABLE_LIMIT = 25; renderTable(LATEST, true); };
  Object.entries(TF_SELECTS).forEach(([key, id]) => $(id).addEventListener("change", e => { TF[key] = e.target.value; onChange(); }));
  let t; Object.entries(TF_TYPED).forEach(([key, id]) => $(id).addEventListener("input", e => { TF[key] = e.target.value; clearTimeout(t); t = setTimeout(onChange, 150); }));
  $("tf-tarikh").addEventListener("click", e => { e.stopPropagation(); openDatePicker(); });
  $("tf-clear").addEventListener("click", () => {
    Object.keys(TF).forEach(k => TF[k] = "");
    Object.values(TF_TYPED).forEach(id => $(id).value = "");
    Object.values(TF_SELECTS).forEach(id => $(id).value = "");
    onChange();
  });
}
function renderTable(subs, keepOptions) {
  if (!keepOptions) refreshTableFilterOptions(subs);
  const filtered = applyTableFilters(subs);
  const sorted = [...filtered].sort((a, b) => parseDmy(b.tarikhAudit) - parseDmy(a.tarikhAudit));
  const shown = sorted.slice(0, TABLE_LIMIT), tb = $("audit-table").querySelector("tbody");
  const active = Object.values(TF).some(Boolean);
  updateDateLabel();
  $("tf-clear").hidden = !active;
  $("tf-count").textContent = active ? `${filtered.length} daripada ${subs.length} audit` : `${subs.length} audit`;
  Object.entries(TF_SELECTS).forEach(([k, id]) => $(id).classList.toggle("is-set", !!TF[k]));
  Object.entries(TF_TYPED).forEach(([k, id]) => $(id).classList.toggle("is-set", !!TF[k]));
  tb.innerHTML = shown.map(s => `<tr data-id="${esc(s.submissionId)}" tabindex="0" title="Klik untuk lihat butiran">
    <td>${esc(s.tarikhAudit || "-")}</td><td>${esc(s.daerah || "-")}</td><td>${esc(s.klinik || "-")}</td><td>${esc(s.namaPPP || "-")}</td>
    <td><span class="type-pill">${esc(s.auditLabel || s.auditType || "-")}</span></td>
    <td>${s.totalMarks || 0}/${s.nonTBTotal || "-"} (${s.percentage || 0}%)</td>
    <td><span class="kat-dot" style="background:${katColor(s.kategori)}"></span>${esc(s.kategori || "-")}</td><td>🔍</td></tr>`).join("")
    || `<tr><td colspan="8" class="empty-state">Tiada audit dijumpai${active ? " untuk penapis ini" : ""}.</td></tr>`;
  let more = $("more-btn"); if (more) more.remove();
  if (sorted.length > shown.length) {
    more = document.createElement("button"); more.id = "more-btn"; more.className = "btn btn-ghost more-btn";
    more.textContent = `Papar lagi (${sorted.length - shown.length})`;
    more.onclick = () => { TABLE_LIMIT += 25; renderTable(subs, true); };
    $("audit-table").closest(".table-wrap").after(more);
  }
}
document.addEventListener("click", e => { const tr = e.target.closest("#audit-table tbody tr[data-id]"); if (tr) openDetail(tr.dataset.id); });
document.addEventListener("keydown", e => {
  if (e.key === "Enter") { const tr = e.target.closest && e.target.closest("#audit-table tbody tr[data-id]"); if (tr) openDetail(tr.dataset.id); }
  if (e.key === "Escape") { const lb = $("lightbox"); if (lb) lb.remove(); else if ($("date-picker")) closeDatePicker(); else closeDetail(); }
});

/* ── Date-range calendar (click start, click end; days in between are highlighted) ── */
const MONTHS_FULL = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const keyToDate = k => new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
const fmtKey = k => String(k % 100).padStart(2, "0") + "/" + String(Math.floor(k / 100) % 100).padStart(2, "0") + "/" + Math.floor(k / 10000);
let DP = null;
function updateDateLabel() {
  const b = $("tf-tarikh"); if (!b) return;
  b.textContent = !TF.from ? "Semua tarikh" : TF.from === TF.to ? fmtKey(TF.from) : fmtKey(TF.from) + " – " + fmtKey(TF.to);
  b.classList.toggle("is-set", !!TF.from);
}
function closeDatePicker() { const el = $("date-picker"); if (el) el.remove(); const bd = $("dp-backdrop"); if (bd) bd.remove(); DP = null; }
function openDatePicker() {
  if (DP) return closeDatePicker();
  const base = TF.from ? keyToDate(TF.from) : new Date();
  const auditDays = new Set(LATEST.map(s => { const d = parseDmy(s.tarikhAudit); return isNaN(d) ? 0 : dayKey(d); }));
  DP = { from: TF.from || 0, to: TF.to || 0, hover: 0, y: base.getFullYear(), m: base.getMonth(), auditDays };
  const bd = document.createElement("div"); bd.id = "dp-backdrop"; bd.className = "dp-backdrop"; bd.onclick = closeDatePicker;
  const el = document.createElement("div"); el.id = "date-picker"; el.className = "dp"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Pilih julat tarikh");
  el.addEventListener("click", dpClick); el.addEventListener("mouseover", dpHover);
  document.body.append(bd, el); drawDatePicker(); placeDatePicker();
}
function placeDatePicker() {
  const el = $("date-picker"), r = $("tf-tarikh").getBoundingClientRect();
  if (innerWidth < 640) { el.classList.add("dp--sheet"); el.style.left = el.style.top = ""; return; }
  el.classList.remove("dp--sheet");
  el.style.left = Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8)) + "px";
  el.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - el.offsetHeight - 8)) + "px";
}
function dpRangeNow() { // [lo, hi] shown now (includes hover preview while only the start is chosen)
  if (DP.from && DP.to) return [DP.from, DP.to];
  if (DP.from && DP.hover) return [Math.min(DP.from, DP.hover), Math.max(DP.from, DP.hover)];
  return [DP.from, DP.from];
}
function drawDatePicker() {
  const el = $("date-picker"), { y, m } = DP, [lo, hi] = dpRangeNow();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate(), today = dayKey(new Date());
  let cells = "<span></span>".repeat(lead);
  for (let d = 1; d <= days; d++) {
    const k = y * 10000 + (m + 1) * 100 + d;
    const cls = ["dp__d", k === today ? "is-today" : "", DP.auditDays.has(k) ? "has-audit" : "", DP.from && k > lo && k < hi ? "in-range" : "", DP.from && k === lo ? "is-start" : "", DP.from && k === hi ? "is-end" : ""].filter(Boolean).join(" ");
    cells += `<button type="button" class="${cls}" data-k="${k}" aria-label="${d} ${MONTHS_FULL[m]} ${y}">${d}</button>`;
  }
  const sel = DP.from ? (DP.to && DP.to !== DP.from ? fmtKey(DP.from) + " – " + fmtKey(DP.to) : fmtKey(DP.from) + (DP.to ? "" : " → pilih tarikh akhir")) : "Pilih tarikh mula";
  el.innerHTML = `<div class="dp__head"><button type="button" class="dp__nav" data-nav="-1" aria-label="Bulan sebelum">‹</button>
    <div class="dp__title">${MONTHS_FULL[m]} ${y}</div><button type="button" class="dp__nav" data-nav="1" aria-label="Bulan seterusnya">›</button></div>
    <div class="dp__presets"><button type="button" data-p="month">Bulan ini</button><button type="button" data-p="last">Bulan lepas</button><button type="button" data-p="30">30 hari</button><button type="button" data-p="year">Tahun ini</button></div>
    <div class="dp__dow">${["Isn", "Sel", "Rab", "Kha", "Jum", "Sab", "Ahd"].map(x => `<span>${x}</span>`).join("")}</div>
    <div class="dp__grid">${cells}</div>
    <div class="dp__legend"><i></i> ada audit</div>
    <div class="dp__foot"><span class="dp__sel">${sel}</span><button type="button" class="btn btn-ghost" data-act="clear">Kosongkan</button><button type="button" class="btn btn-primary" data-act="apply" ${DP.from ? "" : "disabled"}>Guna</button></div>`;
}
function dpHover(e) {
  const b = e.target.closest(".dp__d"); if (!b || !DP.from || DP.to) return;
  const k = +b.dataset.k; if (k === DP.hover) return;
  DP.hover = k; const [lo, hi] = dpRangeNow();
  $("date-picker").querySelectorAll(".dp__d").forEach(x => { const v = +x.dataset.k; x.classList.toggle("in-range", v > lo && v < hi); x.classList.toggle("is-start", v === lo); x.classList.toggle("is-end", v === hi); });
}
function dpApply(from, to) { TF.from = from || ""; TF.to = from ? (to || from) : ""; closeDatePicker(); TABLE_LIMIT = 25; renderTable(LATEST, true); }
function dpClick(e) {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.nav) { DP.m += +t.dataset.nav; if (DP.m < 0) { DP.m = 11; DP.y--; } if (DP.m > 11) { DP.m = 0; DP.y++; } return drawDatePicker(); }
  if (t.dataset.k) {
    const k = +t.dataset.k;
    if (!DP.from || DP.to) { DP.from = k; DP.to = 0; DP.hover = 0; } else if (k < DP.from) { DP.from = k; } else { DP.to = k; }
    return drawDatePicker();
  }
  if (t.dataset.p) {
    const n = new Date(), y = n.getFullYear(), m = n.getMonth();
    const r = { month: [new Date(y, m, 1), new Date(y, m + 1, 0)], last: [new Date(y, m - 1, 1), new Date(y, m, 0)], 30: [new Date(y, m, n.getDate() - 29), n], year: [new Date(y, 0, 1), new Date(y, 11, 31)] }[t.dataset.p];
    return dpApply(dayKey(r[0]), dayKey(r[1]));
  }
  if (t.dataset.act === "clear") return dpApply(0, 0);
  if (t.dataset.act === "apply" && DP.from) return dpApply(DP.from, DP.to || DP.from);
}

/* ── Detail modal ───────────────────────────────────────────────── */
const NILAI = { YA: ["Ya", "ya"], TIDAK: ["Tidak", "tidak"], TIDAK_BERKENAAN: ["T/B", "tb"] };
const TINDAK = { PERLU: "Perlu", TIDAK_PERLU: "Tidak perlu", TIDAK_BERKENAAN: "T/B" };
let BACKEND_DETAIL = true; // flips to false once the backend says it doesn't know getAuditDetail (old Code_dashboard.gs)

async function fetchDetail(sub) {
  if (DETAIL_CACHE.has(sub.submissionId)) return DETAIL_CACHE.get(sub.submissionId);
  await loadQuestions();
  let rows = null;
  if (BACKEND_DETAIL) {
    try {
      const res = await Api.gasPost("getAuditDetail", { pin: SESSION_PIN, submissionId: sub.submissionId, auditType: sub.auditType });
      if (!res.success) throw new Error(res.error);
      rows = res.data;
    } catch (e) { if (isUnknownAction(e)) BACKEND_DETAIL = false; else console.warn("getAuditDetail:", e.message); }
  }
  if (!rows) { // old backend → use the bulk rows
    try { await ensureBulkDetails(); } catch (_) {}
    rows = (RAW.details || []).filter(d => d.submissionId === sub.submissionId);
  }
  // Always attach question text + section title from the local question files (backend text wins if present)
  rows = rows.map(d => { const q = qInfo(sub.auditType, Number(d.qNo)) || {};
    return { ...d, qNo: Number(d.qNo), section: d.section || q.code || "", text: d.text || q.text || "", sectionTitle: d.sectionTitle || q.title || "" }; })
    .sort((a, b) => a.qNo - b.qNo);
  if (rows.length) DETAIL_CACHE.set(sub.submissionId, rows);
  return rows;
}
function photoHtml(u) {
  const id = Api.driveId(u);
  if (!id) return /^https?:\/\//i.test(u) ? `<a class="ph ph--fail" href="${esc(u)}" target="_blank" rel="noopener" title="Buka foto">📷</a>` : "";
  return `<span class="ph ph--wait"><img referrerpolicy="no-referrer" alt="Foto" data-id="${esc(id)}" data-src="${esc(Api.driveThumb(u, 300))}" data-alt="${esc(Api.driveAlt(u, 300))}"></span>`;
}
function detailRowsHtml(rows) {
  if (!rows.length) return '<div class="empty-state">Tiada data soalan.</div>';
  let cur = "", h = "";
  rows.forEach(r => {
    if (r.section !== cur) { cur = r.section; h += `<div class="dq-sec"><span>${esc(r.section)}</span>${esc(r.sectionTitle || "Bahagian " + r.section)}</div>`; }
    const [lbl, cls] = NILAI[r.penilaian] || ["-", "tb"];
    const photos = String(r.photoURLs || "").split(",").map(u => u.trim()).filter(Boolean);
    h += `<div class="dq dq--${cls}"><div class="dq__text"><span class="dq__no">${esc(r.section)}${r.qNo}</span><div>${esc(r.text || "Soalan " + r.qNo)}</div></div>
      <div class="dq__meta"><span class="pill pill--${cls}">${lbl}</span>${r.tindakSusul && r.tindakSusul !== "TIDAK_BERKENAAN" ? `<span>Tindak susul: <b>${esc(TINDAK[r.tindakSusul] || r.tindakSusul)}</b></span>` : ""}${r.catatan ? `<div class="dq__note">${esc(r.catatan)}</div>` : ""}</div>
      ${photos.length ? `<div class="dq__photos">${photos.map(photoHtml).join("")}</div>` : ""}</div>`;
  });
  return h;
}
const countsLine = rows => {
  const n = k => rows.filter(r => r.penilaian === k).length, ph = rows.reduce((s, r) => s + String(r.photoURLs || "").split(",").filter(x => x.trim()).length, 0);
  return `Ya ${n("YA")} · Tidak ${n("TIDAK")} · T/B ${n("TIDAK_BERKENAAN")} · 📷 ${ph} foto`;
};

/* Photo loading chain (per image):
 *   Drive thumbnail → googleusercontent → backend getPhotos (works even when the Drive file is NOT shared) → "Buka" link.
 * Once the direct routes have failed for one photo, the rest skip straight to the backend, and backend calls are batched. */
const PHOTO_CACHE = new Map(); // `${id}|${size}` -> data URL
const PQ = new Set(); let pqTimer = 0, DIRECT_OK = null, BACKEND_PHOTO = true;

function hydratePhotos(root) {
  root.querySelectorAll(".ph img").forEach(img => { if (DIRECT_OK === false) queueBackend(img); else img.src = img.dataset.src; });
}
function photoFail(img) {
  const wrap = img.closest(".ph"); if (!wrap) return;
  wrap.className = "ph ph--fail";
  wrap.innerHTML = `<a href="https://drive.google.com/file/d/${esc(img.dataset.id)}/view" target="_blank" rel="noopener" title="Foto tidak dapat dipapar — klik untuk buka di Drive">📷<small>Buka</small></a>`;
}
function onPhotoError(img) {
  if (img.dataset.mode === "backend") return photoFail(img); // even the backend copy failed to decode
  if (!img.dataset.f) { img.dataset.f = "1"; img.src = img.dataset.alt; return; }
  if (DIRECT_OK === null) DIRECT_OK = false;
  queueBackend(img);
}
function onPhotoLoad(img) {
  const w = img.closest(".ph"); if (w) w.classList.remove("ph--wait");
  if (DIRECT_OK === null && img.dataset.mode !== "backend") DIRECT_OK = true;
}
function queueBackend(img) {
  if (!BACKEND_PHOTO) return photoFail(img);
  img.dataset.mode = "backend"; PQ.add(img);
  clearTimeout(pqTimer); pqTimer = setTimeout(flushPhotoQueue, 60);
}
async function backendPhotos(ids, size) {
  const need = ids.filter(id => !PHOTO_CACHE.has(id + "|" + size));
  if (!need.length) return;
  const res = await Api.gasPost("getPhotos", { pin: SESSION_PIN, ids: need, size });
  if (!res.success) throw new Error(res.error || "getPhotos gagal");
  Object.entries(res.data || {}).forEach(([id, d]) => { if (d) PHOTO_CACHE.set(id + "|" + size, d); });
}
async function flushPhotoQueue() {
  const imgs = [...PQ].filter(i => i.isConnected); PQ.clear();
  const byId = {}; imgs.forEach(i => (byId[i.dataset.id] = byId[i.dataset.id] || []).push(i));
  const ids = Object.keys(byId), STEP = 6;
  for (let k = 0; k < ids.length; k += STEP) {
    const chunk = ids.slice(k, k + STEP);
    try { await backendPhotos(chunk, "thumb"); }
    catch (e) { if (isUnknownAction(e)) BACKEND_PHOTO = false; console.warn("Foto:", e.message); }
    chunk.forEach(id => byId[id].forEach(i => { const d = PHOTO_CACHE.get(id + "|thumb"); d ? (i.src = d) : photoFail(i); }));
    if (!BACKEND_PHOTO) { ids.slice(k + STEP).forEach(id => byId[id].forEach(photoFail)); break; }
  }
}
function openLightbox(img) {
  const id = img.dataset.id, lb = document.createElement("div"); lb.className = "lb"; lb.id = "lightbox";
  const big = document.createElement("img"); big.alt = "Foto"; big.referrerPolicy = "no-referrer"; big.src = img.currentSrc || img.src; // thumbnail first, upgrade when the big one arrives
  lb.appendChild(big); lb.onclick = () => lb.remove(); document.body.appendChild(lb);
  const upgrade = d => { if (d && lb.isConnected) big.src = d; };
  const viaBackend = () => backendPhotos([id], "full").then(() => upgrade(PHOTO_CACHE.get(id + "|full"))).catch(() => {});
  if (img.dataset.mode === "backend") return viaBackend();
  const full = Api.driveThumb("https://drive.google.com/uc?id=" + id, 1400), probe = new Image();
  probe.referrerPolicy = "no-referrer"; probe.onload = () => upgrade(full); probe.onerror = viaBackend; probe.src = full;
}

function closeDetail() { const m = $("detail-modal"); if (m) m.remove(); document.body.style.overflow = ""; }
async function openDetail(id) {
  const sub = RAW.submissions.find(s => s.submissionId === id); if (!sub) return;
  closeDetail();
  const rg = [["Kelebihan", sub.kelebihan], ["Kekurangan", sub.kekurangan], ["Cadangan", sub.cadangan], ["Penambahbaikan", sub.penambahbaikan]].filter(x => x[1]);
  const m = document.createElement("div"); m.className = "dm"; m.id = "detail-modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
  m.innerHTML = `<div class="dm__box"><div class="dm__head"><div><div class="dm__title">${esc(sub.klinik)} · ${esc(sub.daerah)}</div>
    <div class="dm__sub">${esc(sub.tarikhAudit)} | ${esc(sub.namaPPP)} | ${esc(sub.auditLabel || sub.auditType)}</div></div><button class="dm__x" aria-label="Tutup">×</button></div>
    <div class="dm__stats"><span class="dm__chip">Markah: <b>${sub.totalMarks}/${sub.nonTBTotal} (${sub.percentage}%)</b></span>
    <span class="dm__chip"><span class="kat-dot" style="background:${katColor(sub.kategori)}"></span><b>${esc(sub.kategori)}</b></span></div>
    <div class="dm__legend" id="dm-legend">&nbsp;</div>
    <div class="dm__body">${rg.length ? `<details class="dm__sum"><summary>Ringkasan laporan audit</summary>${rg.map(([k, v]) => `<p><b>${k}:</b> ${esc(v)}</p>`).join("")}</details>` : ""}
    <div id="dm-rows">${'<div class="dq-skel"><div class="skel" style="width:90%"></div><div class="skel" style="width:60%"></div><div class="skel" style="width:30%;height:20px"></div></div>'.repeat(6)}</div></div></div>`;
  m.addEventListener("click", e => {
    if (e.target === m || e.target.closest(".dm__x")) return closeDetail();
    const img = e.target.closest(".dq__photos .ph img"); if (img) openLightbox(img);
  });
  m.addEventListener("error", e => { if (e.target.tagName === "IMG" && e.target.closest(".ph")) onPhotoError(e.target); }, true);
  m.addEventListener("load", e => { if (e.target.tagName === "IMG" && e.target.closest(".ph")) onPhotoLoad(e.target); }, true);
  document.body.appendChild(m); document.body.style.overflow = "hidden";
  const rows = await fetchDetail(sub), box = $("dm-rows");
  if (box && m.isConnected) { box.innerHTML = detailRowsHtml(rows); $("dm-legend").textContent = rows.length ? countsLine(rows) : ""; hydratePhotos(box); }
}
window.showDetail = openDetail; // backward compat

/* ── Level tabs + JKN comparison ────────────────────────────────── */
function switchLevel(level) {
  ACTIVE_LEVEL = level;
  $("tab-daerah").classList.toggle("is-active", level === "daerah");
  $("tab-jkn").classList.toggle("is-active", level === "jkn");
  $("progress-section").style.display = level === "daerah" ? "" : "none";
  $("jkn-section").style.display = level === "jkn" ? "" : "none";
  renderAll();
  if (level === "jkn") renderJknAnalysis();
}
function renderJknAnalysis() {
  const jkn = RAW.submissions.filter(s => s.level === "jkn"), dae = RAW.submissions.filter(s => s.level !== "jkn");
  const by = {}; jkn.forEach(s => by[s.auditLabel] = (by[s.auditLabel] || 0) + 1);
  $("jkn-summary").innerHTML = Object.entries(by).map(([l, n]) => `<div style="display:inline-flex;align-items:center;gap:8px;background:var(--color-primary-tint);border-radius:8px;padding:8px 14px;margin:4px 4px 4px 0;font-size:13px;"><span style="font-weight:700;font-size:18px;">${n}</span> ${esc(l)}</div>`).join("")
    || '<p style="color:var(--color-text-faint);font-size:13px;">Belum ada audit JKN.</p>';
  const cmp = $("jkn-comparison"), note = t => cmp.innerHTML = `<p style="color:var(--color-text-faint);font-size:13px;padding:12px 0;">${t}</p>`;
  if (!jkn.length || !dae.length) return note("Data tidak mencukupi untuk perbandingan. Perlukan audit daerah DAN JKN untuk KK yang sama.");
  const avgMap = subs => { const m = {}; subs.forEach(s => { const k = s.klinik + "|" + s.auditType; (m[k] = m[k] || { daerah: s.daerah, klinik: s.klinik, type: s.auditLabel, sc: [] }).sc.push(Number(s.percentage)); }); return m; };
  const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length), dm = avgMap(dae), jm = avgMap(jkn), g = {};
  Object.keys(jm).forEach(k => { if (!dm[k]) return; const d = dm[k], j = jm[k], da = avg(d.sc), ja = avg(j.sc); (g[d.daerah] = g[d.daerah] || []).push({ klinik: d.klinik, type: d.type, da, ja, diff: ja - da }); });
  if (!Object.keys(g).length) return note("Tiada KK yang sama diaudit oleh kedua-dua peringkat daerah dan JKN.");
  const th = t => `<th style="text-align:${t[1]};padding:7px 8px;color:var(--color-text-faint);font-size:11px;">${t[0]}</th>`;
  let h = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid var(--color-border);">${[["DAERAH / KLINIK", "left"], ["JENIS AUDIT", "left"], ["MARKAH DAERAH", "center"], ["MARKAH JKN", "center"], ["BEZA", "center"]].map(th).join("")}</tr></thead><tbody>`;
  Object.keys(g).sort().forEach(d => {
    h += `<tr><td colspan="5" style="padding:9px 8px 4px;font-weight:700;color:var(--color-primary-dark);font-size:12px;text-transform:uppercase;">${esc(d)}</td></tr>`;
    g[d].forEach(r => { const c = r.diff > 0 ? "#1e8e5a" : r.diff < 0 ? "#c0392b" : "#888";
      h += `<tr style="border-bottom:1px solid var(--color-border);"><td style="padding:7px 8px 7px 18px;">${esc(r.klinik)}</td><td style="padding:7px 8px;">${esc(r.type)}</td><td style="padding:7px 8px;text-align:center;font-weight:600;">${r.da}%</td><td style="padding:7px 8px;text-align:center;font-weight:600;">${r.ja}%</td><td style="padding:7px 8px;text-align:center;font-weight:700;color:${c};">${r.diff > 0 ? "+" : ""}${r.diff}%</td></tr>`; });
  });
  cmp.innerHTML = h + "</tbody></table></div>";
}
