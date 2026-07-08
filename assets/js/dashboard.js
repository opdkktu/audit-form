/**
 * dashboard.js
 * ------------
 * PIN-gated state-level analytics view. Chart.js is fetched from the
 * CDN only after the PIN is verified (lazy-loaded) — nobody pays the
 * cost of the charting library just to see the PIN screen.
 */

let RAW = { submissions: [], details: [] };
let CHARTS = {};

/* ---------------------------------------------------------------------- */
/* PIN gate                                                                */
/* ---------------------------------------------------------------------- */

(function setupPinInputs() {
  const digits = Array.from(document.querySelectorAll(".pin-digit"));
  digits.forEach((el, i) => {
    el.addEventListener("input", () => {
      el.value = el.value.replace(/\D/g, "").slice(0, 1);
      if (el.value && digits[i + 1]) digits[i + 1].focus();
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !el.value && digits[i - 1]) digits[i - 1].focus();
    });
  });

  document.getElementById("pin-form").addEventListener("submit", async (e) => {
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

      // Populate dropdowns + table immediately — no Chart.js needed
      setupFilters();
      renderTable(RAW.submissions);

      // Load Chart.js then render charts
      await Loading.withLoading("Menjana graf...", async () => {
        await loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js");
        renderAll();
      });
    } catch (err) {
      errorEl.textContent = "PIN salah. Sila cuba lagi.";
      errorEl.style.display = "block";
      digits.forEach(d => d.value = "");
      digits[0].focus();
    }
  });
})();

/* ---------------------------------------------------------------------- */
/* Filters                                                                 */
/* ---------------------------------------------------------------------- */

function setupFilters() {
  const daerahSel = document.getElementById("filter-daerah");
  const klinikSel = document.getElementById("filter-klinik");

  const daerahList = [...new Set(RAW.submissions.map(s => s.daerah))].sort();
  daerahSel.innerHTML = `<option value="">Semua Daerah</option>` +
    daerahList.map(d => `<option value="${d}">${d}</option>`).join("");

  function refreshKlinik() {
    const pool = daerahSel.value ? RAW.submissions.filter(s => s.daerah === daerahSel.value) : RAW.submissions;
    const klinikList = [...new Set(pool.map(s => s.klinik))].sort();
    klinikSel.innerHTML = `<option value="">Semua Klinik</option>` +
      klinikList.map(k => `<option value="${k}">${k}</option>`).join("");
  }
  refreshKlinik();

  daerahSel.addEventListener("change", () => { refreshKlinik(); renderAll(); });
  klinikSel.addEventListener("change", renderAll);
}

function filteredSubmissions() {
  const daerah = document.getElementById("filter-daerah").value;
  const klinik = document.getElementById("filter-klinik").value;
  return RAW.submissions.filter(s =>
    (!daerah || s.daerah === daerah) && (!klinik || s.klinik === klinik)
  );
}

/* ---------------------------------------------------------------------- */
/* Render orchestration                                                    */
/* ---------------------------------------------------------------------- */

function renderAll() {
  const subs = filteredSubmissions();
  renderKpis(subs);
  renderDaerahChart(subs);
  renderKategoriChart(subs);
  renderTrendChart(subs);
  renderFailpointsChart(subs);
  renderTable(subs);
}

function renderKpis(subs) {
  const avg = subs.length ? Math.round(subs.reduce((s, r) => s + r.percentage, 0) / subs.length) : 0;
  const klinikCount = new Set(subs.map(s => s.klinik)).size;
  const kategoriCounts = {};
  subs.forEach(s => { kategoriCounts[s.kategori] = (kategoriCounts[s.kategori] || 0) + 1; });
  const topKategori = Object.entries(kategoriCounts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById("kpi-grid").innerHTML = `
    <div class="kpi-card"><div class="kpi-card__label">Jumlah Audit</div><div class="kpi-card__value">${subs.length}</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Purata Markah</div><div class="kpi-card__value">${avg}%</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Klinik Disemak</div><div class="kpi-card__value">${klinikCount}</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Kategori Terkerap</div><div class="kpi-card__value" style="font-size:15px;">${topKategori ? topKategori[0] : "-"}</div></div>
  `;
  renderSpectrum(document.getElementById("dashboard-spectrum"), avg);
}

function destroyChart(key) {
  if (CHARTS[key]) { CHARTS[key].destroy(); delete CHARTS[key]; }
}

function renderDaerahChart(subs) {
  const byDaerah = {};
  subs.forEach(s => {
    byDaerah[s.daerah] = byDaerah[s.daerah] || [];
    byDaerah[s.daerah].push(s.percentage);
  });
  const labels = Object.keys(byDaerah).sort();
  const data = labels.map(d => Math.round(byDaerah[d].reduce((a, b) => a + b, 0) / byDaerah[d].length));

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
    data: {
      labels: KATEGORI_SCALE.map(t => t.label),
      datasets: [{ data: KATEGORI_SCALE.map(t => counts[t.label]), backgroundColor: KATEGORI_SCALE.map(t => t.color) }]
    },
    options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } } } }
  });
}

function renderTrendChart(subs) {
  const sorted = [...subs].sort((a, b) => new Date(a.tarikhAudit) - new Date(b.tarikhAudit));
  destroyChart("trend");
  CHARTS.trend = new Chart(document.getElementById("chart-trend"), {
    type: "line",
    data: {
      labels: sorted.map(s => s.tarikhAudit),
      datasets: [{ label: "% Markah", data: sorted.map(s => s.percentage), borderColor: "#F2A93B", backgroundColor: "#F2A93B33", fill: true, tension: 0.3 }]
    },
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
function renderProgress(subs) {
  const year = new Date().getFullYear();
  document.getElementById("prog-year-label").textContent = year;

  const daerah = document.getElementById("filter-progress-daerah").value;
  const yearSubs = subs.filter(s => String(s.tarikhAudit).startsWith(String(year)));
  const filtered = daerah ? yearSubs.filter(s => s.daerah === daerah) : yearSubs;

  const auditedKK = new Set(filtered.map(s => s.klinik)).size;
  const totalKK = daerah
    ? (RAW.totalKKByDaerah[daerah] || 0)
    : (RAW.totalKK || 0);

  const pct = totalKK ? Math.min(100, Math.round(auditedKK / totalKK * 100)) : 0;

  document.getElementById("prog-label").textContent = `${auditedKK} / ${totalKK} Klinik Kesihatan`;
  document.getElementById("prog-pct").textContent = pct + "%";

  // Animate after short delay so CSS transition fires
  setTimeout(() => {
    document.getElementById("prog-fill").style.width = pct + "%";
  }, 100);

  // Populate daerah filter
  const sel = document.getElementById("filter-progress-daerah");
  const daerahList = Object.keys(RAW.totalKKByDaerah || {}).sort();
  if (sel.options.length === 1) { // only "Seluruh Negeri"
    daerahList.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d; opt.textContent = d;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => renderProgress(filteredSubmissions()));
  }
}
function renderTable(subs) {
  const sorted = [...subs].sort((a, b) => new Date(b.tarikhAudit) - new Date(a.tarikhAudit));
  document.querySelector("#audit-table tbody").innerHTML = sorted.map(s => `
    <tr>
      <td>${s.tarikhAudit}</td>
      <td>${s.daerah}</td>
      <td>${s.klinik}</td>
      <td>${s.namaPPP || "-"}</td>
      <td>${s.totalMarks}/30 (${s.percentage}%)</td>
      <td>${s.kategori}</td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="empty-state">Tiada audit dijumpai.</td></tr>`;
}
