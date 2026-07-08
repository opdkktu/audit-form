/**
 * dashboard.js — Merged dashboard for all audit types
 * Reads from dedicated Dashboard GAS (Code_dashboard.gs)
 */

let RAW = { submissions: [], details: [], totalKK: 0, totalKKByDaerah: {}, totalKKWithAmbulan: 0, totalKKWithAmbulanByDaerah: {} };
let CHARTS = {};

/* ── PIN gate ─────────────────────────────────────────────────────── */
(function setupPinInputs() {
  const digits = Array.from(document.querySelectorAll(".pin-digit"));
  digits.forEach((el, i) => {
    el.addEventListener("input", () => {
      el.value = el.value.replace(/\D/g, "").slice(0, 1);
      if (el.value && digits[i + 1]) digits[i + 1].focus();
    });
    el.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !el.value && digits[i - 1]) digits[i - 1].focus();
    });
  });

  document.getElementById("pin-form").addEventListener("submit", async e => {
    e.preventDefault();
    const pin = digits.map(d => d.value).join("");
    const errorEl = document.getElementById("pin-error");
    errorEl.style.display = "none";
    if (pin.length !== 4) { errorEl.style.display = "block"; return; }

    try {
      await Loading.withLoading("Mengesahkan PIN...", async () => {
        const res = await Api.gasPost("getDashboardData", { pin });
        if (!res.success) throw new Error(res.error || "PIN_SALAH");
        RAW = res.data;
      });
      document.getElementById("pin-gate").remove();
      document.getElementById("dashboard-content").style.display = "block";
      setupFilters();
      renderTable(RAW.submissions);
      renderProgress(RAW.submissions);
      await Loading.withLoading("Menjana graf...", async () => {
        await loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js");
        renderAll();
      });
    } catch(err) {
      errorEl.textContent = err.message === "PIN_SALAH" ? "PIN salah. Sila cuba lagi." : "Ralat: " + err.message;
      errorEl.style.display = "block";
      digits.forEach(d => d.value = "");
      digits[0].focus();
    }
  });
})();

/* ── Filters ──────────────────────────────────────────────────────── */
function setupFilters() {
  const daerahSel  = document.getElementById("filter-daerah");
  const klinikSel  = document.getElementById("filter-klinik");
  const auditTypeSel = document.getElementById("filter-audit-type");

  const daerahList = [...new Set(RAW.submissions.map(s => s.daerah))].sort();
  daerahSel.innerHTML = `<option value="">Semua Daerah</option>` +
    daerahList.map(d => `<option value="${d}">${d}</option>`).join("");

  function refreshKlinik() {
    const pool = daerahSel.value ? RAW.submissions.filter(s => s.daerah === daerahSel.value) : RAW.submissions;
    const list = [...new Set(pool.map(s => s.klinik))].sort();
    klinikSel.innerHTML = `<option value="">Semua Klinik</option>` +
      list.map(k => `<option value="${k}">${k}</option>`).join("");
  }
  refreshKlinik();

  daerahSel.addEventListener("change",    () => { refreshKlinik(); renderAll(); });
  klinikSel.addEventListener("change",    renderAll);
  auditTypeSel.addEventListener("change", renderAll);
}

function filteredSubmissions() {
  const daerah    = document.getElementById("filter-daerah").value;
  const klinik    = document.getElementById("filter-klinik").value;
  const auditType = document.getElementById("filter-audit-type").value;
  return RAW.submissions.filter(s =>
    (!daerah    || s.daerah    === daerah)  &&
    (!klinik    || s.klinik    === klinik)  &&
    (!auditType || s.auditType === auditType)
  );
}

/* ── Render orchestration ─────────────────────────────────────────── */
function renderAll() {
  const subs = filteredSubmissions();
  renderProgress(subs);
  renderKpis(subs);
  renderDaerahChart(subs);
  renderKategoriChart(subs);
  renderTrendChart(subs);
  renderFailpointsChart(subs);
  renderTable(subs);
}

/* ── Progress bar ─────────────────────────────────────────────────── */
function renderProgress(subs) {
  const year = new Date().getFullYear();
  document.getElementById("prog-year-label").textContent = year;

  const auditType = document.getElementById("filter-audit-type").value;
  const daerah    = document.getElementById("filter-progress-daerah").value;

  const yearSubs  = subs.filter(s => String(s.tarikhAudit).startsWith(String(year)));
  const filtered  = daerah ? yearSubs.filter(s => s.daerah === daerah) : yearSubs;
  const auditedKK = new Set(filtered.map(s => s.klinik)).size;

  // Ambulans audit: denominator = KK with ambulan only
  // All other audits: denominator = all KK
  let totalKK;
  if (auditType === "ambulans") {
    totalKK = daerah ? (RAW.totalKKWithAmbulanByDaerah[daerah] || 0) : RAW.totalKKWithAmbulan;
  } else {
    totalKK = daerah ? (RAW.totalKKByDaerah[daerah] || 0) : RAW.totalKK;
  }

  const pct = totalKK ? Math.min(100, Math.round(auditedKK / totalKK * 100)) : 0;
  document.getElementById("prog-label").textContent = `${auditedKK} / ${totalKK} Klinik Kesihatan`;
  document.getElementById("prog-pct").textContent   = pct + "%";
  setTimeout(() => { document.getElementById("prog-fill").style.width = pct + "%"; }, 100);

  // Populate progress daerah filter once
  const sel = document.getElementById("filter-progress-daerah");
  if (sel.options.length === 1) {
    Object.keys(RAW.totalKKByDaerah).sort().forEach(d => {
      const opt = document.createElement("option");
      opt.value = d; opt.textContent = d; sel.appendChild(opt);
    });
    sel.addEventListener("change", () => renderProgress(filteredSubmissions()));
  }
}

/* ── KPIs ─────────────────────────────────────────────────────────── */
function renderKpis(subs) {
  const avg = subs.length ? Math.round(subs.reduce((s, r) => s + r.percentage, 0) / subs.length) : 0;
  const klinikCount = new Set(subs.map(s => s.klinik)).size;
  const kategoriCounts = {};
  subs.forEach(s => { kategoriCounts[s.kategori] = (kategoriCounts[s.kategori] || 0) + 1; });
  const topKat = Object.entries(kategoriCounts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById("kpi-grid").innerHTML = `
    <div class="kpi-card"><div class="kpi-card__label">Jumlah Audit</div><div class="kpi-card__value">${subs.length}</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Purata Markah</div><div class="kpi-card__value">${avg}%</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Klinik Disemak</div><div class="kpi-card__value">${klinikCount}</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Kategori Terkerap</div><div class="kpi-card__value" style="font-size:15px;">${topKat ? topKat[0] : "-"}</div></div>
  `;
  renderSpectrum(document.getElementById("dashboard-spectrum"), avg);
}

/* ── Charts ───────────────────────────────────────────────────────── */
function destroyChart(key) {
  if (CHARTS[key]) { CHARTS[key].destroy(); delete CHARTS[key]; }
}

function renderDaerahChart(subs) {
  const byDaerah = {};
  subs.forEach(s => { byDaerah[s.daerah] = byDaerah[s.daerah] || []; byDaerah[s.daerah].push(s.percentage); });
  const labels = Object.keys(byDaerah).sort();
  const data   = labels.map(d => Math.round(byDaerah[d].reduce((a, b) => a + b, 0) / byDaerah[d].length));
  destroyChart("daerah");
  CHARTS.daerah = new Chart(document.getElementById("chart-daerah"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Purata %", data, backgroundColor: "#0B4F5C", borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
  });
}

function renderKategoriChart(subs) {
  const counts = {};
  KATEGORI_SCALE.forEach(t => counts[t.label] = 0);
  subs.forEach(s => { if (counts[s.kategori] !== undefined) counts[s.kategori]++; });
  destroyChart("kategori");
  CHARTS.kategori = new Chart(document.getElementById("chart-kategori"), {
    type: "doughnut",
    data: { labels: KATEGORI_SCALE.map(t => t.label), datasets: [{ data: KATEGORI_SCALE.map(t => counts[t.label]), backgroundColor: KATEGORI_SCALE.map(t => t.color) }] },
    options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } } } }
  });
}

function renderTrendChart(subs) {
  const sorted = [...subs].sort((a, b) => new Date(a.tarikhAudit) - new Date(b.tarikhAudit));
  destroyChart("trend");
  CHARTS.trend = new Chart(document.getElementById("chart-trend"), {
    type: "line",
    data: { labels: sorted.map(s => s.tarikhAudit), datasets: [{ label: "% Markah", data: sorted.map(s => s.percentage), borderColor: "#F2A93B", backgroundColor: "#F2A93B33", fill: true, tension: 0.3 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
  });
}

function renderFailpointsChart(subs) {
  const ids = new Set(subs.map(s => s.submissionId));
  const counts = {};
  RAW.details.forEach(d => {
    if (!ids.has(d.submissionId) || d.penilaian !== "TIDAK") return;
    counts[d.qNo] = (counts[d.qNo] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  destroyChart("failpoints");
  CHARTS.failpoints = new Chart(document.getElementById("chart-failpoints"), {
    type: "bar",
    data: { labels: top.map(([no]) => "Soalan " + no), datasets: [{ label: "Bilangan Tidak", data: top.map(([, n]) => n), backgroundColor: "#C0392B", borderRadius: 6 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
  });
}

/* ── Table ────────────────────────────────────────────────────────── */
function renderTable(subs) {
  const sorted = [...subs].sort((a, b) => new Date(b.tarikhAudit) - new Date(a.tarikhAudit));
  document.querySelector("#audit-table tbody").innerHTML = sorted.map(s => `
    <tr>
      <td>${s.tarikhAudit}</td>
      <td>${s.daerah}</td>
      <td>${s.klinik}</td>
      <td>${s.namaPPP || "-"}</td>
      <td><span style="font-size:11px;background:var(--color-primary-tint);color:var(--color-primary-dark);padding:2px 8px;border-radius:99px;">${s.auditLabel || s.auditType}</span></td>
      <td>${s.totalMarks} (${s.percentage}%)</td>
      <td>${s.kategori}</td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="empty-state">Tiada audit dijumpai.</td></tr>`;
}
