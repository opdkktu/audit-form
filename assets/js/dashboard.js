/* dashboard.js v2 — skeleton loading, lazy animated charts, click-to-view detail with question text.
 * Needs backend Code_dashboard.gs v2 (lite + getAuditDetail); degrades gracefully on the old one. */
(function () {
  window.Api = window.Api || {};
  const A = window.Api;
  A.driveId = A.driveId || (u => { const m = String(u || """").match(/[?&]id=([\w-]+)/) || String(u || """").match(/\/d\/([\w-]+)/); return m ? m[1] : null; });
  A.driveThumb = A.driveThumb || ((u, s) => { const i = A.driveId(u); return i ? ""https://drive.google.com/thumbnail?id="" + i + ""&sz=w"" + (s || 300) : (u || """"); });
  A.driveAlt = A.driveAlt || ((u, s) => { const i = A.driveId(u); return i ? ""https://lh3.googleusercontent.com/d/"" + i + ""=w"" + (s || 300) : (u || """"); });
  A.escapeHtml = A.escapeHtml || (v => String(v == null ? """" : v).replace(/[&<>""']/g, c => ({ ""&"": ""&amp;"", ""<"": ""&lt;"", "">"": ""&gt;"", '""': ""&quot;"", ""'"": ""&#39;"" }[c])));
  if (typeof window.loadScript !== ""function"") window.loadScript = src => new Promise((ok, no) => { const s = document.createElement(""script""); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
})();

/* ── Question text built in (no backend needed) ── */
const QTEXT = {""ambulans"":[{""code"":""A"",""title"":""Pematuhan Operasi Ambulans"",""qs"":[""Kebersihan luaran & dalaman Ambulans"",""Penyelenggaraan Ambulans dilakukan mengikut jadual yang ditetapkan dan direkod"",""Cukai jalan tidak tamat tempoh"",""Senarai semak harian ambulans dilakukan (oleh pemandu)"",""Pemeriksaan lampu kenderaan, lampu kecemasan & siren berfungsi dengan baik, pemeriksaan tayar dan brek dalam keadaan baik"",""Mempunyai peralatan kecemasan kenderaan seperti alat pemadam api, kon keselamatan serta tanda amaran kenderaan berhenti"",""Senarai semak peralatan perubatan dalam ambulans dilakukan secara mingguan oleh PPP"",""Set komunikasi GIRN di dalam ambulans dalam keadaan berfungsi"",""Semua bahan pembersihan dan pembasmian dalam ambulans (handrub, tisu dan bekas sisa klinikal seperti sharp bin & clinical waste) hendaklah mencukupi dan menepati Garis Panduan Kawalan Infeksi"",""Setiap kerosakan ambulans dilaporkan dan diserah kepada pegawai yang bertanggungjawab""]},{""code"":""B"",""title"":""Peralatan & Ubatan"",""qs"":[""Mempunyai EMTS beg dan keperluan alatan mencukupi mengikut senarai semak"",""Peralatan perubatan dalam ambulans dilakukan PPM secara tahunan"",""Peralatan perubatan dan sokongan berfungsi dan dalam keadaan baik"",""Senarai ubat-ubatan dikemaskini dan tiada stok luput dan teratur"",""Senarai item consumables dikemaskini dan tiada stok luput dan teratur"",""Peralatan / ubat-ubatan dan item consumables mempunyai label dan diletakkan di bahagian yang betul"",""Memastikan stretcher mempunyai minima 3 safety strapping dan berfungsi dengan baik""]},{""code"":""C"",""title"":""Dokumentasi"",""qs"":[""Lantikan Pegawai Kenderaan (surat lantikan)"",""Lantikan Penyelaras Ambulans (surat lantikan)"",""Rekod Latihan PPP menghadiri latihan teras untuk Perawatan Kecemasan seperti PHC, BLS dan latihan lain yang berkaitan"",""Rekod Pemandu Ambulans telah menghadiri Kursus Pemanduan Berhemah dan Pemanduan Ambulans (sijil / rekod latihan)"",""Reten Status Ambulans dan data perkhidmatan Ambulans di Klinik Kesihatan"",""Pemeriksaan berkala dilakukan oleh Penyelia (mingguan)"",""Ada menjalani pemeriksaan keselamatan tahunan kenderaan di JKR"",""Pemandu mempunyai lesen memandu yang sah, pemeriksaan kesihatan perlu dilakukan secara tahunan dan secara berkala bagi mereka yang mempunyai masalah kesihatan"",""Buku Log ambulans mengikut tarikh semasa (semak dan bandingkan dengan buku rekod kes kecemasan)"",""Memastikan semua insiden atau kemalangan yang melibatkan ambulans dipantau serta disiasat mengikut garis panduan (bahan rujukan) / dokumentasi"",""Semua kawasan/parkir ambulans hendaklah ditanda dengan jelas menggunakan petak kuning dan diletakkan papan tanda parkir ambulans (Khas untuk Ambulans sahaja)"",""Fail PHC mempunyai jadual Tugas Tinggal Atas Panggilan, Salinan borang PHC, buku rekod Penerimaan Panggilan MECC, Interfacility dan lain-lain, Surat Akaun Pelepasan Tanggungjawab dan Borang daftar harta/wang pesakit"",""Mengadakan kursus, latihan simulasi, CME, latihan sangkut dan lain-lain yang berkaitan""]}],""kecemasan"":[{""code"":""A"",""title"":""Infrastruktur & Persekitaran"",""qs"":[""Laluan masuk Ambulans jelas dan tidak terhalang"",""Papan tanda / sign KECEMASAN ada"",""Maklumat Pegawai Bertugas Atas Panggilan dipamerkan dan dikemaskini (fasiliti yang menyediakan perkhidmatan kecemasan selepas waktu pejabat)"",""Notis pemberitahuan tiada perkhidmatan kecemasan dipamerkan (fasiliti yang TIDAK menyediakan perkhidmatan kecemasan selepas waktu pejabat)"",""Kemudahan OKU (kerusi roda) dan laluan jalan (Ramp) disediakan"",""Mempunyai sistem Pengaktifan Code Blue"",""Ruang / sudut khas untuk rawatan Asma disediakan"",""Pencahayaan mencukupi dan sistem pengudaraan / air cond berfungsi"",""Pelan evakuasi dipamerkan dan laluan evakuasi ditanda dengan jelas""]},{""code"":""B"",""title"":""Peralatan & Ubatan"",""qs"":[""EMTS bag mengikut senarai yang telah ditetapkan dalam garis panduan dan dikemaskini"",""Semua peralatan perubatan berfungsi dan dalam keadaan baik"",""Semua peralatan perubatan di buat PPM tahunan"",""Troli kecemasan mudah diakses dan tiada halangan serta dilengkapi dengan peralatan dan ubatan resusitasi"",""Senarai stok di troli kecemasan mengikut senarai yang telah ditetapkan dalam garis panduan dan dikemaskini"",""Stok ubat berada dalam keadaan baik dan tiada tarikh luput"",""Semua ubatan High Alert Medication (HAM) dalam simpanan yang baik dan berlabel"",""Tempat simpanan ubat psikotropik dikunci dan stok fizikal selaras dengan rekod terkini (buku daftar / rekod)"",""Pemantauan rekod suhu bilik dan peti sejuk dilakukan"",""Checklist harian & mingguan disemak oleh PPP dan Penyelia PPP""]},{""code"":""C"",""title"":""Kawalan Infeksi"",""qs"":[""Kawasan bilik rawatan dalam keadaan bersih"",""PPE mencukupi"",""Tong sisa klinikal / Sharp bin tersedia"",""Hand sanitizer, tisu dan sabun basuh tangan tersedia dan mencukupi"",""Ruang / Bilik isolasi berfungsi""]},{""code"":""D"",""title"":""Dokumentasi"",""qs"":[""Jadual Oncall dan Tugasan dikemaskini, lengkap dan mudah dilihat"",""Mempunyai Rekod Pendaftaran Pesakit kecemasan dan penggunaan Kad Rawatan Pesakit Luar / CCMS - pengisian maklumat untuk setiap kes kecemasan"",""Mempunyai Rekod Laporan Respon Kes Kecemasan Waktu Pejabat dan Rekod Laporan Respon Kes Kecemasan Luar Waktu Pejabat"",""Rekod Penyelenggaraan PPM tersedia dan dikemaskini dan Mesin Autoclave mempunyai Sijil dandang yang terkini"",""Checklist harian peralatan disimpan"",""Rekod Latihan dalam perkhidmatan untuk meningkatkan kemahiran dan pengetahuan mengenai perkhidmatan kecemasan"",""Mempunyai sumber rujukan (buku GP), dan borang - borang yang berkaitan"",""Latihan simulasi kecemasan""]}]};
function qinfo(type, n) {
  let i = 0;
  for (const sec of (QTEXT[type] || [])) for (const t of sec.qs) { i++; if (i === Number(n)) return { text: t, code: sec.code, title: sec.title }; }
  return {};
}
let DETAILS_P = Promise.resolve();

let RAW = { submissions: [], details: [], totalKK: 0, totalKKByDaerah: {}, totalKKWithAmbulan: 0, totalKKWithAmbulanByDaerah: {} };
let CHARTS = {}, ACTIVE_LEVEL = ""daerah"", LATEST = [], SESSION_PIN = """", TABLE_LIMIT = 25, DETAILS_STATE = ""idle"";
const DETAIL_CACHE = new Map(), SEEN = new Set();
const $ = id => document.getElementById(id);
const esc = v => Api.escapeHtml(v);
const REDUCED = window.matchMedia && matchMedia(""(prefers-reduced-motion: reduce)"").matches;
const parseDmy = s => { const m = String(s || """").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(s); };
const katColor = k => (KATEGORI_SCALE.find(t => t.label === k) || {}).color || ""#888"";
const CHART_URL = ""https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"";
let chartLib; const loadChartLib = () => chartLib || (chartLib = loadScript(CHART_URL));
window.addEventListener(""load"", () => setTimeout(loadChartLib, 300)); // preload while user types PIN

/* ── PIN gate ───────────────────────────────────────────────────── */
(function () {
  const digits = Array.from(document.querySelectorAll("".pin-digit""));
  digits.forEach((el, i) => {
    el.addEventListener(""input"", () => { el.value = el.value.replace(/\D/g, """").slice(0, 1); if (el.value && digits[i + 1]) digits[i + 1].focus(); });
    el.addEventListener(""keydown"", e => { if (e.key === ""Backspace"" && !el.value && digits[i - 1]) digits[i - 1].focus(); });
  });
  $(""pin-form"").addEventListener(""submit"", async e => {
    e.preventDefault();
    const pin = digits.map(d => d.value).join(""""), errEl = $(""pin-error"");
    errEl.style.display = ""none"";
    if (pin.length !== 4) { errEl.style.display = ""block""; return; }
    try {
      await Loading.withLoading(""Mengesahkan PIN..."", async () => {
        const res = await Api.gasPost(""getDashboardData"", { pin, lite: true });
        if (!res.success) throw new Error(res.error || ""PIN_SALAH"");
        RAW = res.data; SESSION_PIN = pin;
      });
      $(""pin-gate"").remove();
      $(""dashboard-content"").style.display = ""block"";
      showSkeletons(); setupFilters(); initLazyCharts();
      await loadChartLib();
      switchLevel(""daerah"");
      DETAILS_P = loadDetailsInBackground();
    } catch (err) {
      const m = String(err.message);
      errEl.textContent = m === ""PIN_SALAH"" ? ""PIN salah. Sila cuba lagi."" : m === ""TERLALU_BANYAK_CUBAAN"" ? ""Terlalu banyak cubaan. Cuba lagi dalam 10 minit."" : ""Ralat: "" + m;
      errEl.style.display = ""block""; digits.forEach(d => d.value = """"); digits[0].focus();
    }
  });
})();

/* ── Skeletons ──────────────────────────────────────────────────── */
function showSkeletons() {
  $(""kpi-grid"").innerHTML = '<div class=""skel skel-kpi""></div>'.repeat(4);
  $(""audit-table"").querySelector(""tbody"").innerHTML = Array(6).fill('<tr class=""skel-row"">' + '<td><div class=""skel""></div></td>'.repeat(8) + '</tr>').join("""");
}

/* ── Lazy, animated charts (draw when scrolled into view) ───────── */
const CHART_DEFS = {
  daerah: { canvas: ""chart-daerah"", fn: renderDaerahChart }, kategori: { canvas: ""chart-kategori"", fn: renderKategoriChart },
  trend: { canvas: ""chart-trend"", fn: renderTrendChart }, failpoints: { canvas: ""chart-failpoints"", fn: renderFailpointsChart }
};
function initLazyCharts() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target); SEEN.add(e.target.dataset.chart); drawChart(e.target.dataset.chart);
  }), { rootMargin: ""60px"" });
  Object.entries(CHART_DEFS).forEach(([k, d]) => {
    const card = $(d.canvas).closest("".card""); card.dataset.chart = k; card.classList.add(""is-loading""); io.observe(card);
  });
}
function drawChart(k) {
  if (!SEEN.has(k) || !window.Chart) return;
  const card = $(CHART_DEFS[k].canvas).closest("".card"");
  if (k === ""failpoints"" && DETAILS_STATE !== ""done"") { card.classList.add(""is-loading""); return; }
  CHART_DEFS[k].fn(LATEST); card.classList.remove(""is-loading"");
}
const ANIM = REDUCED ? false : { duration: 900, easing: ""easeOutQuart"" };
const barAnim = REDUCED ? false : { duration: 800, easing: ""easeOutQuart"", delay: c => (c.type === ""data"" && c.mode === ""default"" ? c.dataIndex * 70 : 0) };
function destroyChart(k) { if (CHARTS[k]) { CHARTS[k].destroy(); delete CHARTS[k]; } }

function renderDaerahChart(subs) {
  const by = {}; subs.forEach(s => (by[s.daerah] = by[s.daerah] || []).push(Number(s.percentage)));
  const labels = Object.keys(by).sort(), data = labels.map(d => Math.round(by[d].reduce((a, b) => a + b, 0) / by[d].length));
  destroyChart(""daerah"");
  CHARTS.daerah = new Chart($(""chart-daerah""), { type: ""bar"",
    data: { labels, datasets: [{ label: ""Purata %"", data, backgroundColor: ""#0B4F5C"", borderRadius: 6 }] },
    options: { animation: barAnim, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } } });
}
function renderKategoriChart(subs) {
  const counts = {}; KATEGORI_SCALE.forEach(t => counts[t.label] = 0);
  subs.forEach(s => { if (counts[s.kategori] !== undefined) counts[s.kategori]++; });
  destroyChart(""kategori"");
  CHARTS.kategori = new Chart($(""chart-kategori""), { type: ""doughnut"",
    data: { labels: KATEGORI_SCALE.map(t => t.label), datasets: [{ data: KATEGORI_SCALE.map(t => counts[t.label]), backgroundColor: KATEGORI_SCALE.map(t => t.color), borderWidth: 2, borderColor: ""#fff"" }] },
    options: { cutout: ""58%"", animation: REDUCED ? false : { animateRotate: true, animateScale: true, duration: 1100, easing: ""easeOutCubic"" },
      plugins: { legend: { position: ""bottom"", labels: { boxWidth: 12, font: { size: 10 } } } } } });
}
function renderTrendChart(subs) {
  const sorted = [...subs].sort((a, b) => parseDmy(a.tarikhAudit) - parseDmy(b.tarikhAudit)); // FIX: dd/mm/yyyy parsing
  destroyChart(""trend"");
  CHARTS.trend = new Chart($(""chart-trend""), { type: ""line"",
    data: { labels: sorted.map(s => s.tarikhAudit), datasets: [{ label: ""% Markah"", data: sorted.map(s => Number(s.percentage)), borderColor: ""#F2A93B"", backgroundColor: ""#F2A93B33"", fill: true, tension: 0.35, pointRadius: 3 }] },
    options: { animations: REDUCED ? false : { y: { from: c => c.chart.scales.y.getPixelForValue(0), duration: 1100, easing: ""easeOutQuart"" } },
      plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } } });
}
function renderFailpointsChart(subs) {
  const ids = new Set(subs.map(s => s.submissionId)), counts = {};
  RAW.details.forEach(d => { // FIX: key by type+question so ambulans Q5 and kecemasan Q5 are not merged
    if (!ids.has(d.submissionId) || d.penilaian !== ""TIDAK"") return;
    const k = d.auditType + ""|"" + d.qNo; counts[k] = (counts[k] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const lab = k => { const [t, n] = k.split(""|""); return (t === ""ambulans"" ? ""Amb"" : ""Kec"") + "" S"" + n; };
  destroyChart(""failpoints"");
  CHARTS.failpoints = new Chart($(""chart-failpoints""), { type: ""bar"",
    data: { labels: top.map(([k]) => lab(k)), datasets: [{ label: ""Bilangan Tidak"", data: top.map(([, n]) => n), backgroundColor: ""#C0392B"", borderRadius: 6 }] },
    options: { indexAxis: ""y"", animation: barAnim, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } } });
}
async function loadDetailsInBackground() {
  if (RAW.details && RAW.details.length) { DETAILS_STATE = ""done""; drawChart(""failpoints""); return; }
  DETAILS_STATE = ""loading"";
  try {
    const res = await Api.gasPost(""getDashboardData"", { pin: SESSION_PIN });
    if (!res.success) throw new Error(res.error);
    RAW.details = res.data.details || [];
  } catch (e) { console.warn(""Butiran gagal dimuat:"", e.message); }
  DETAILS_STATE = ""done""; drawChart(""failpoints"");
}

/* ── Filters ────────────────────────────────────────────────────── */
function setupFilters() {
  const dSel = $(""filter-daerah""), kSel = $(""filter-klinik""), tSel = $(""filter-audit-type"");
  const opts = (first, list) => `<option value="""">${first}</option>` + list.map(v => `<option value=""${esc(v)}"">${esc(v)}</option>`).join("""");
  dSel.innerHTML = opts(""Semua Daerah"", [...new Set(RAW.submissions.map(s => s.daerah))].sort());
  const refreshKlinik = () => {
    const pool = dSel.value ? RAW.submissions.filter(s => s.daerah === dSel.value) : RAW.submissions;
    kSel.innerHTML = opts(""Semua Klinik"", [...new Set(pool.map(s => s.klinik))].sort());
  };
  refreshKlinik();
  dSel.addEventListener(""change"", () => { refreshKlinik(); renderAll(); });
  kSel.addEventListener(""change"", renderAll); tSel.addEventListener(""change"", renderAll);
}
function filteredSubmissions() {
  const d = $(""filter-daerah"").value, k = $(""filter-klinik"").value, t = $(""filter-audit-type"").value;
  return RAW.submissions.filter(s => (ACTIVE_LEVEL === ""jkn"") === (s.level === ""jkn"") && (!d || s.daerah === d) && (!k || s.klinik === k) && (!t || s.auditType === t));
}

function renderAll() {
  LATEST = filteredSubmissions(); TABLE_LIMIT = 25;
  renderProgress(LATEST); renderKpis(LATEST); renderTable(LATEST);
  Object.keys(CHART_DEFS).forEach(drawChart);
}

/* ── Progress ───────────────────────────────────────────────────── */
function renderProgress(subs) {
  const year = new Date().getFullYear(), type = $(""filter-audit-type"").value, daerah = $(""filter-progress-daerah"").value;
  $(""prog-year-label"").textContent = year;
  const ys = subs.filter(s => parseDmy(s.tarikhAudit).getFullYear() === year);
  const f = daerah ? ys.filter(s => s.daerah === daerah) : ys, audited = new Set(f.map(s => s.klinik)).size;
  const total = type === ""ambulans"" ? (daerah ? RAW.totalKKWithAmbulanByDaerah[daerah] || 0 : RAW.totalKKWithAmbulan) : (daerah ? RAW.totalKKByDaerah[daerah] || 0 : RAW.totalKK);
  const pct = total ? Math.min(100, Math.round(audited / total * 100)) : 0;
  $(""prog-label"").textContent = `${audited} / ${total} Klinik Kesihatan`;
  countUp($(""prog-pct""), pct, ""%"");
  setTimeout(() => { $(""prog-fill"").style.width = pct + ""%""; }, 100);
  const sel = $(""filter-progress-daerah"");
  if (sel.options.length === 1) {
    Object.keys(RAW.totalKKByDaerah).sort().forEach(d => sel.add(new Option(d, d)));
    sel.addEventListener(""change"", () => renderProgress(filteredSubmissions()));
  }
}

/* ── KPIs with count-up ─────────────────────────────────────────── */
function countUp(el, to, suffix) {
  suffix = suffix || """";
  if (REDUCED) { el.textContent = to + suffix; return; }
  const t0 = performance.now(), dur = 900;
  (function tick(t) { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix; if (p < 1) requestAnimationFrame(tick); })(t0);
}
function renderKpis(subs) {
  const avg = subs.length ? Math.round(subs.reduce((s, r) => s + Number(r.percentage), 0) / subs.length) : 0;
  const kc = {}; subs.forEach(s => kc[s.kategori] = (kc[s.kategori] || 0) + 1);
  const top = Object.entries(kc).sort((a, b) => b[1] - a[1])[0];
  const card = (l, id, extra) => `<div class=""kpi-card""><div class=""kpi-card__label"">${l}</div><div class=""kpi-card__value"" id=""${id}"" ${extra || """"}></div></div>`;
  $(""kpi-grid"").innerHTML = card(""Jumlah Audit"", ""k1"") + card(""Purata Markah"", ""k2"") + card(""Klinik Disemak"", ""k3"") + card(""Kategori Terkerap"", ""k4"", 'style=""font-size:13px;""');
  countUp($(""k1""), subs.length); countUp($(""k2""), avg, ""%""); countUp($(""k3""), new Set(subs.map(s => s.klinik)).size);
  $(""k4"").textContent = top ? top[0] : ""-"";
  renderSpectrum($(""dashboard-spectrum""), avg);
}

/* ── Audit table (whole row clickable) ──────────────────────────── */
const COL = { tarikh: """", daerah: """", klinik: """", ppp: """", jenis: """", markah: """", kategori: """" };
const SORT = { k: ""tarikh"", dir: -1 };
const COLKEYS = [""tarikh"", ""daerah"", ""klinik"", ""ppp"", ""jenis"", ""markah"", ""kategori""];
const GET = { tarikh: s => parseDmy(s.tarikhAudit).getTime() || 0, daerah: s => s.daerah || """", klinik: s => s.klinik || """", ppp: s => s.namaPPP || """",
  jenis: s => s.auditLabel || s.auditType || """", markah: s => Number(s.percentage) || 0, kategori: s => s.kategori || """" };
const BANDS = { ""90-100"": [90, 100], ""80-89"": [80, 89], ""61-79"": [61, 79], ""41-60"": [41, 60], ""21-40"": [21, 40], ""0-20"": [0, 20] };

function ensureColFilters(all) {
  const thead = $(""audit-table"").querySelector(""thead"");
  let tr = $(""col-filters"");
  if (!tr) {
    tr = document.createElement(""tr""); tr.id = ""col-filters""; tr.className = ""col-filters"";
    tr.innerHTML = COLKEYS.map(k => `<th>${k === ""tarikh"" || k === ""ppp"" ? `<input data-k=""${k}"" placeholder=""${k === ""tarikh"" ? ""cth: 11/2026"" : ""Cari...""}"">` : `<select data-k=""${k}""></select>`}</th>`).join("""")
      + '<th><button type=""button"" id=""col-clear"" class=""col-clear"" title=""Kosongkan penapis"">✕</button></th>';
    thead.appendChild(tr);
    tr.addEventListener(""input"", e => { const k = e.target.dataset.k; if (!k) return; COL[k] = e.target.value; TABLE_LIMIT = 25; renderTable(LATEST); });
    $(""col-clear"").onclick = () => { COLKEYS.forEach(k => COL[k] = """"); tr.querySelectorAll(""[data-k]"").forEach(el => el.value = """"); TABLE_LIMIT = 25; renderTable(LATEST); };
    thead.querySelectorAll(""tr:first-child th"").forEach((th, i) => {
      const k = COLKEYS[i]; if (!k) return;
      th.dataset.k = k; th.dataset.t = th.textContent; th.style.cursor = ""pointer""; th.title = ""Klik untuk susun"";
      th.addEventListener(""click"", () => { SORT.dir = SORT.k === k ? -SORT.dir : 1; SORT.k = k; renderTable(LATEST); });
    });
  }
  thead.querySelectorAll(""tr:first-child th[data-k]"").forEach(th => { th.textContent = th.dataset.t + (SORT.k === th.dataset.k ? (SORT.dir > 0 ? "" ▲"" : "" ▼"") : """"); });
  const uniq = f => [...new Set(all.map(f).filter(Boolean))].sort();
  const fill = (k, vals) => { const el = tr.querySelector(`select[data-k=""${k}""]`), cur = COL[k];
    el.innerHTML = '<option value="""">Semua</option>' + vals.map(([v, l]) => `<option value=""${esc(v)}"">${esc(l || v)}</option>`).join(""""); el.value = vals.some(([v]) => v === cur) ? cur : (COL[k] = """"); };
  fill(""daerah"", uniq(s => s.daerah).map(v => [v])); fill(""klinik"", uniq(s => s.klinik).map(v => [v]));
  fill(""jenis"", uniq(GET.jenis).map(v => [v])); fill(""kategori"", uniq(s => s.kategori).map(v => [v]));
  fill(""markah"", Object.keys(BANDS).map(v => [v, v + ""%""]));
}
function applyColFilters(all) {
  const t = COL.tarikh.trim().toLowerCase(), p = COL.ppp.trim().toLowerCase(), b = BANDS[COL.markah];
  return all.filter(s => (!t || String(s.tarikhAudit).toLowerCase().includes(t)) && (!p || String(s.namaPPP).toLowerCase().includes(p))
    && (!COL.daerah || s.daerah === COL.daerah) && (!COL.klinik || s.klinik === COL.klinik) && (!COL.jenis || GET.jenis(s) === COL.jenis)
    && (!COL.kategori || s.kategori === COL.kategori) && (!b || (Number(s.percentage) >= b[0] && Number(s.percentage) <= b[1])));
}
function renderTable(allSubs) {
  ensureColFilters(allSubs);
  const subs = applyColFilters(allSubs), g = GET[SORT.k];
  const sorted = [...subs].sort((a, b) => { const x = g(a), y = g(b); return (typeof x === ""number"" ? x - y : String(x).localeCompare(String(y))) * SORT.dir; });
  let cnt = $(""tbl-count"");
  if (!cnt) { cnt = document.createElement(""div""); cnt.id = ""tbl-count""; cnt.style.cssText = ""font-size:12px;color:var(--color-text-faint);margin:-4px 0 8px;""; $(""audit-table"").closest("".table-wrap"").before(cnt); }
  cnt.textContent = `Memaparkan ${subs.length} daripada ${allSubs.length} audit`;
  const shown = sorted.slice(0, TABLE_LIMIT), tb = $(""audit-table"").querySelector(""tbody"");
  tb.innerHTML = shown.map(s => `<tr data-id=""${esc(s.submissionId)}"" tabindex=""0"" title=""Klik untuk lihat butiran"">
    <td>${esc(s.tarikhAudit || ""-"")}</td><td>${esc(s.daerah || ""-"")}</td><td>${esc(s.klinik || ""-"")}</td><td>${esc(s.namaPPP || ""-"")}</td>
    <td><span style=""font-size:11px;background:var(--color-primary-tint);color:var(--color-primary-dark);padding:2px 8px;border-radius:99px;"">${esc(s.auditLabel || s.auditType || ""-"")}</span></td>
    <td>${s.totalMarks || 0}/${s.nonTBTotal || ""-""} (${s.percentage || 0}%)</td>
    <td><span class=""kat-dot"" style=""background:${katColor(s.kategori)}""></span>${esc(s.kategori || ""-"")}</td><td>🔍</td></tr>`).join("""")
    || `<tr><td colspan=""8"" class=""empty-state"">Tiada audit dijumpai.</td></tr>`;
  let more = $(""more-btn""); if (more) more.remove();
  if (sorted.length > shown.length) {
    more = document.createElement(""button""); more.id = ""more-btn""; more.className = ""btn btn-ghost more-btn"";
    more.textContent = `Papar lagi (${sorted.length - shown.length})`;
    more.onclick = () => { TABLE_LIMIT += 25; renderTable(allSubs); };
    $(""audit-table"").closest("".table-wrap"").after(more);
  }
}
document.addEventListener(""click"", e => { const tr = e.target.closest(""#audit-table tbody tr[data-id]""); if (tr) openDetail(tr.dataset.id); });
document.addEventListener(""keydown"", e => {
  if (e.key === ""Enter"") { const tr = e.target.closest && e.target.closest(""#audit-table tbody tr[data-id]""); if (tr) openDetail(tr.dataset.id); }
  if (e.key === ""Escape"") { const lb = $(""lightbox""); if (lb) lb.remove(); else { const m = $(""detail-modal""); if (m) m.remove(); } }
});

/* ── Detail modal: full-width question rows, fetched on demand ──── */
const NILAI = { YA: [""Ya"", ""ya""], TIDAK: [""Tidak"", ""tidak""], TIDAK_BERKENAAN: [""T/B"", ""tb""] };
const TINDAK = { PERLU: ""Perlu"", TIDAK_PERLU: ""Tidak perlu"", TIDAK_BERKENAAN: ""T/B"" };

async function fetchDetail(sub) {
  if (DETAIL_CACHE.has(sub.submissionId)) return DETAIL_CACHE.get(sub.submissionId);
  let rows = null;
  try {
    const res = await Api.gasPost(""getAuditDetail"", { pin: SESSION_PIN, submissionId: sub.submissionId, auditType: sub.auditType });
    if (res.success && Array.isArray(res.data) && res.data.length) rows = res.data;
  } catch (e) { console.warn(""getAuditDetail gagal:"", e.message); }
  if (!rows) { // fallback: use the details table already loaded for the dashboard
    await DETAILS_P;
    rows = RAW.details.filter(d => d.submissionId === sub.submissionId).map(d => ({ ...d, qNo: Number(d.qNo) })).sort((a, b) => a.qNo - b.qNo);
  }
  // always fill question text from the built-in list when the backend didn't supply it
  rows = rows.map(r => { const q = qinfo(sub.auditType, r.qNo); return { ...r, text: r.text || q.text || """", section: r.section || q.code || """", sectionTitle: r.sectionTitle || q.title || """" }; });
  if (rows.length) DETAIL_CACHE.set(sub.submissionId, rows);
  return rows;
}

function photoHtml(urls) {
  return urls.map(u => {
    const t1 = Api.driveThumb(u, 300), t2 = Api.driveAlt(u, 300);
    return `<a href=""${esc(u)}"" target=""_blank"" rel=""noopener""><img src=""${esc(t1)}"" data-alt=""${esc(t2)}"" referrerpolicy=""no-referrer"" alt=""Foto""></a>`;
  }).join("""");
}
function detailRowsHtml(rows) {
  if (!rows.length) return '<div class=""empty-state"">Tiada data soalan.</div>';
  let cur = """", h = """";
  rows.forEach(r => {
    if (r.section !== cur) { cur = r.section; h += `<div class=""dq-sec""><span>${esc(r.section)}</span>${esc(r.sectionTitle || ""Bahagian "" + r.section)}</div>`; }
    const [lbl, cls] = NILAI[r.penilaian] || [""-"", ""tb""];
    const photos = String(r.photoURLs || """").split("","").map(u => u.trim()).filter(Boolean);
    h += `<div class=""dq dq--${cls}""><div class=""dq__text""><span class=""dq__no"">${esc(r.section)}${r.qNo}</span><div>${esc(r.text || ""Soalan "" + r.qNo)}</div></div>
      <div class=""dq__meta""><span class=""pill pill--${cls}"">${lbl}</span>${r.tindakSusul ? `<span>Tindak susul: <b>${esc(TINDAK[r.tindakSusul] || r.tindakSusul)}</b></span>` : """"}${photos.length ? `<span class=""photo-chip"">📷 ${photos.length} foto</span>` : """"}${r.catatan ? `<div class=""dq__note"">${esc(r.catatan)}</div>` : """"}</div>
      ${photos.length ? `<div class=""dq__photos"">${photoHtml(photos)}</div>` : """"}</div>`;
  });
  return h;
}
async function openDetail(id) {
  const sub = RAW.submissions.find(s => s.submissionId === id); if (!sub) return;
  const old = $(""detail-modal""); if (old) old.remove();
  const rg = [[""Kelebihan"", sub.kelebihan], [""Kekurangan"", sub.kekurangan], [""Cadangan"", sub.cadangan], [""Penambahbaikan"", sub.penambahbaikan]].filter(x => x[1]);
  const m = document.createElement(""div""); m.className = ""dm""; m.id = ""detail-modal"";
  m.innerHTML = `<div class=""dm__box""><div class=""dm__head""><div><div class=""dm__title"">${esc(sub.klinik)} · ${esc(sub.daerah)}</div>
    <div class=""dm__sub"">${esc(sub.tarikhAudit)} | ${esc(sub.namaPPP)} | ${esc(sub.auditLabel || sub.auditType)}</div></div><button class=""dm__x"" aria-label=""Tutup"">×</button></div>
    <div class=""dm__stats""><span class=""dm__chip"">Markah: <b>${sub.totalMarks}/${sub.nonTBTotal} (${sub.percentage}%)</b></span>
    <span class=""dm__chip""><span class=""kat-dot"" style=""background:${katColor(sub.kategori)}""></span><b>${esc(sub.kategori)}</b></span></div>
    <div class=""dm__body"">${rg.length ? `<details class=""dm__sum""><summary>Ringkasan laporan audit</summary>${rg.map(([k, v]) => `<p><b>${k}:</b> ${esc(v)}</p>`).join("""")}</details>` : """"}
    <div id=""dm-rows"">${'<div class=""dq-skel""><div class=""skel"" style=""width:90%""></div><div class=""skel"" style=""width:60%""></div><div class=""skel"" style=""width:30%;height:20px""></div></div>'.repeat(6)}</div></div></div>`;
  m.addEventListener(""click"", e => { if (e.target === m || e.target.closest("".dm__x"")) m.remove(); });
  // same image fallback chain as the original: thumbnail -> googleusercontent -> ""Buka"" link
  m.addEventListener(""error"", e => {
    const t = e.target; if (t.tagName !== ""IMG"") return;
    if (!t.dataset.f) { t.dataset.f = 1; t.src = t.dataset.alt; }
    else { const s = document.createElement(""span""); s.className = ""photo-open""; s.textContent = ""📷 Buka""; t.replaceWith(s); }
  }, true);
  document.body.appendChild(m);
  const rows = await fetchDetail(sub), box = $(""dm-rows"");
  if (box && document.body.contains(m)) box.innerHTML = detailRowsHtml(rows);
}
window.showDetail = openDetail; // backward compat

/* ── Level tabs + JKN comparison ────────────────────────────────── */
function switchLevel(level) {
  ACTIVE_LEVEL = level;
  $(""tab-daerah"").classList.toggle(""is-active"", level === ""daerah"");
  $(""tab-jkn"").classList.toggle(""is-active"", level === ""jkn"");
  $(""progress-section"").style.display = level === ""daerah"" ? """" : ""none"";
  $(""jkn-section"").style.display = level === ""jkn"" ? """" : ""none"";
  renderAll();
  if (level === ""jkn"") renderJknAnalysis();
}
function renderJknAnalysis() {
  const jkn = RAW.submissions.filter(s => s.level === ""jkn""), dae = RAW.submissions.filter(s => s.level !== ""jkn"");
  const by = {}; jkn.forEach(s => by[s.auditLabel] = (by[s.auditLabel] || 0) + 1);
  $(""jkn-summary"").innerHTML = Object.entries(by).map(([l, n]) => `<div style=""display:inline-flex;align-items:center;gap:8px;background:var(--color-primary-tint);border-radius:8px;padding:8px 14px;margin:4px 4px 4px 0;font-size:13px;""><span style=""font-weight:700;font-size:18px;"">${n}</span> ${esc(l)}</div>`).join("""")
    || '<p style=""color:var(--color-text-faint);font-size:13px;"">Belum ada audit JKN.</p>';
  const cmp = $(""jkn-comparison""), note = t => cmp.innerHTML = `<p style=""color:var(--color-text-faint);font-size:13px;padding:12px 0;"">${t}</p>`;
  if (!jkn.length || !dae.length) return note(""Data tidak mencukupi untuk perbandingan. Perlukan audit daerah DAN JKN untuk KK yang sama."");
  const avgMap = subs => { const m = {}; subs.forEach(s => { const k = s.klinik + ""|"" + s.auditType; (m[k] = m[k] || { daerah: s.daerah, klinik: s.klinik, type: s.auditLabel, sc: [] }).sc.push(Number(s.percentage)); }); return m; };
  const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length), dm = avgMap(dae), jm = avgMap(jkn), g = {};
  Object.keys(jm).forEach(k => { if (!dm[k]) return; const d = dm[k], j = jm[k], da = avg(d.sc), ja = avg(j.sc); (g[d.daerah] = g[d.daerah] || []).push({ klinik: d.klinik, type: d.type, da, ja, diff: ja - da }); });
  if (!Object.keys(g).length) return note(""Tiada KK yang sama diaudit oleh kedua-dua peringkat daerah dan JKN."");
  const th = t => `<th style=""text-align:${t[1]};padding:7px 8px;color:var(--color-text-faint);font-size:11px;"">${t[0]}</th>`;
  let h = `<div style=""overflow-x:auto;""><table style=""width:100%;border-collapse:collapse;font-size:13px;""><thead><tr style=""border-bottom:2px solid var(--color-border);"">${[[""DAERAH / KLINIK"", ""left""], [""JENIS AUDIT"", ""left""], [""MARKAH DAERAH"", ""center""], [""MARKAH JKN"", ""center""], [""BEZA"", ""center""]].map(th).join("""")}</tr></thead><tbody>`;
  Object.keys(g).sort().forEach(d => {
    h += `<tr><td colspan=""5"" style=""padding:9px 8px 4px;font-weight:700;color:var(--color-primary-dark);font-size:12px;text-transform:uppercase;"">${esc(d)}</td></tr>`;
    g[d].forEach(r => { const c = r.diff > 0 ? ""#1e8e5a"" : r.diff < 0 ? ""#c0392b"" : ""#888"";
      h += `<tr style=""border-bottom:1px solid var(--color-border);""><td style=""padding:7px 8px 7px 18px;"">${esc(r.klinik)}</td><td style=""padding:7px 8px;"">${esc(r.type)}</td><td style=""padding:7px 8px;text-align:center;font-weight:600;"">${r.da}%</td><td style=""padding:7px 8px;text-align:center;font-weight:600;"">${r.ja}%</td><td style=""padding:7px 8px;text-align:center;font-weight:700;color:${c};"">${r.diff > 0 ? ""+"" : """"}${r.diff}%</td></tr>`; });
  });
  cmp.innerHTML = h + ""</tbody></table></div>"";
}
