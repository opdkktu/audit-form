/* ── Safety shim: works even if a stale/cached api.js is loaded ───── */
(function () {
  window.Api = window.Api || {};
  if (typeof Api.driveId !== "function") Api.driveId = function (url) {
    const m = String(url || "").match(/[?&]id=([\w-]+)/) || String(url || "").match(/\/d\/([\w-]+)/);
    return m ? m[1] : null;
  };
  if (typeof Api.driveThumb !== "function") Api.driveThumb = function (url, size) {
    const id = Api.driveId(url);
    return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w" + (size || 300) : (url || "");
  };
  if (typeof Api.driveAlt !== "function") Api.driveAlt = function (url, size) {
    const id = Api.driveId(url);
    return id ? "https://lh3.googleusercontent.com/d/" + id + "=w" + (size || 300) : (url || "");
  };
  if (typeof Api.escapeHtml !== "function") Api.escapeHtml = function (v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  };
})();

/**
 * dashboard.js — Merged dashboard (Ambulans + Kecemasan + future forms)
 *
 * DATA SOURCES (via Code_dashboard.gs):
 *   RAW.submissions  — from Audits sheet, one entry per submitted audit
 *   RAW.details      — from AuditDetails sheet, one entry per question answer
 *   RAW.totalKK / totalKKByDaerah            — all KK count (MasterData col A+B)
 *   RAW.totalKKWithAmbulan / ByDaerah        — KK where MasterData col C = "ada"
 */

let RAW = {
  submissions: [], details: [],
  totalKK: 0, totalKKByDaerah: {},
  totalKKWithAmbulan: 0, totalKKWithAmbulanByDaerah: {}
};
let CHARTS = {};

/* ── PIN gate ─────────────────────────────────────────────────────── */
(function () {
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
    const errEl = document.getElementById("pin-error");
    errEl.style.display = "none";
    if (pin.length !== 4) { errEl.style.display = "block"; return; }

    try {
      await Loading.withLoading("Mengesahkan PIN...", async () => {
        const res = await Api.gasPost("getDashboardData", { pin });
        if (!res.success) throw new Error(res.error || "PIN_SALAH");
        RAW = res.data;
      });
      document.getElementById("pin-gate").remove();
      document.getElementById("dashboard-content").style.display = "block";
      setupFilters();
      await Loading.withLoading("Menjana graf...", async () => {
        await loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js");
        switchLevel("daerah");
      });
    } catch (err) {
      errEl.textContent = err.message === "PIN_SALAH" ? "PIN salah. Sila cuba lagi." : "Ralat: " + err.message;
      errEl.style.display = "block";
      digits.forEach(d => d.value = "");
      digits[0].focus();
    }
  });
})();

/* ── Filters ──────────────────────────────────────────────────────── */
function setupFilters() {
  const daerahSel    = document.getElementById("filter-daerah");
  const klinikSel    = document.getElementById("filter-klinik");
  const auditTypeSel = document.getElementById("filter-audit-type");

  const daerahList = [...new Set(RAW.submissions.map(s => s.daerah))].sort();
  daerahSel.innerHTML = `<option value="">Semua Daerah</option>` +
    daerahList.map(d => `<option value="${d}">${d}</option>`).join("");

  function refreshKlinik() {
    const pool = daerahSel.value
      ? RAW.submissions.filter(s => s.daerah === daerahSel.value)
      : RAW.submissions;
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
    s.level !== "jkn" &&
    (!daerah    || s.daerah    === daerah)    &&
    (!klinik    || s.klinik    === klinik)    &&
    (!auditType || s.auditType === auditType)
  );
}

/* ── Render all ───────────────────────────────────────────────────── */
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
  const year      = new Date().getFullYear();
  const auditType = document.getElementById("filter-audit-type").value;
  const daerah    = document.getElementById("filter-progress-daerah").value;

  document.getElementById("prog-year-label").textContent = year;

  const yearSubs  = subs.filter(s => {
    const parts = String(s.tarikhAudit).split("/");
    return (parts.length === 3 && parts[2] === String(year)) ||
           String(s.tarikhAudit).startsWith(String(year));
  });
  const filtered  = daerah ? yearSubs.filter(s => s.daerah === daerah) : yearSubs;
  const auditedKK = new Set(filtered.map(s => s.klinik)).size;

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
  const avg = subs.length
    ? Math.round(subs.reduce((s, r) => s + Number(r.percentage), 0) / subs.length) : 0;
  const klinikCount    = new Set(subs.map(s => s.klinik)).size;
  const kategoriCounts = {};
  subs.forEach(s => { kategoriCounts[s.kategori] = (kategoriCounts[s.kategori] || 0) + 1; });
  const topKat = Object.entries(kategoriCounts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById("kpi-grid").innerHTML = `
    <div class="kpi-card"><div class="kpi-card__label">Jumlah Audit</div><div class="kpi-card__value">${subs.length}</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Purata Markah</div><div class="kpi-card__value">${avg}%</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Klinik Disemak</div><div class="kpi-card__value">${klinikCount}</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Kategori Terkerap</div><div class="kpi-card__value" style="font-size:13px;">${topKat ? topKat[0] : "-"}</div></div>
  `;
  renderSpectrum(document.getElementById("dashboard-spectrum"), avg);
}

/* ── Charts ───────────────────────────────────────────────────────── */
function destroyChart(key) {
  if (CHARTS[key]) { CHARTS[key].destroy(); delete CHARTS[key]; }
}

function renderDaerahChart(subs) {
  const byDaerah = {};
  subs.forEach(s => { byDaerah[s.daerah] = byDaerah[s.daerah] || []; byDaerah[s.daerah].push(Number(s.percentage)); });
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
      datasets: [{ label: "% Markah", data: sorted.map(s => Number(s.percentage)), borderColor: "#F2A93B", backgroundColor: "#F2A93B33", fill: true, tension: 0.3 }]
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
    data: {
      labels: top.map(([no]) => "Soalan " + no),
      datasets: [{ label: "Bilangan Tidak", data: top.map(([, n]) => n), backgroundColor: "#C0392B", borderRadius: 6 }]
    },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
  });
}

/* ── Detail modal ─────────────────────────────────────────────────── */
function showDetail(submissionId) {
  const sub  = RAW.submissions.find(s => s.submissionId === submissionId);
  const rows = RAW.details
    .filter(d => d.submissionId === submissionId)
    .sort((a, b) => Number(a.qNo) - Number(b.qNo));
  if (!sub) return;
  const existing = document.getElementById("detail-modal");
  if (existing) existing.remove();

  const rowsHtml = rows.map(r => {
    const photos = r.photoURLs ? r.photoURLs.split(",").map(u => u.trim()).filter(Boolean) : [];
    const photoHtml = photos.map(u => {
      const t1 = Api.driveThumb(u, 300), t2 = Api.driveAlt(u, 300);
      return `<a href="${Api.escapeHtml(u)}" target="_blank" rel="noopener">
        <img src="${t1}" referrerpolicy="no-referrer" loading="lazy" alt="Foto"
          style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #ddd;margin:2px;"
          onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${t2}';}else{this.outerHTML='<span style=&quot;font-size:11px;color:#0b4f5c;&quot;>📷 Buka</span>';}">
      </a>`;
    }).join("");
    const pColor = r.penilaian === "YA" ? "#1e8e5a" : r.penilaian === "TIDAK" ? "#c0392b" : "#888";
    return `<tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:7px 6px;font-size:12px;color:#666;white-space:nowrap;">${r.section||""}-${r.qNo}</td>
      <td style="padding:7px 6px;font-weight:700;color:${pColor};font-size:13px;">${r.penilaian||"-"}</td>
      <td style="padding:7px 6px;font-size:12px;color:#777;">${Api.escapeHtml(r.tindakSusul||"-")}</td>
      <td style="padding:7px 6px;font-size:12px;max-width:180px;">${Api.escapeHtml(r.catatan||"")}</td>
      <td style="padding:7px 6px;">${photoHtml}</td>
    </tr>`;
  }).join("");

  const modal = document.createElement("div");
  modal.id = "detail-modal";
  modal.style.cssText = "position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);overflow-y:auto;padding:20px;";
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;max-width:780px;margin:0 auto;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3);">
      <div style="background:#0b4f5c;color:#fff;padding:18px 22px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-weight:700;font-size:16px;margin-bottom:3px;">${sub.klinik} · ${sub.daerah}</div>
          <div style="font-size:12px;opacity:.75;">${sub.tarikhAudit} &nbsp;|&nbsp; ${sub.namaPPP} &nbsp;|&nbsp; ${sub.auditLabel||sub.auditType}</div>
        </div>
        <button onclick="document.getElementById('detail-modal').remove()"
          style="background:rgba(255,255,255,.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;flex:none;margin-left:12px;">×</button>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;padding:14px 22px 4px;">
        <span style="background:#e3eeec;border-radius:8px;padding:7px 13px;font-size:13px;">
          Markah: <strong>${sub.totalMarks}/${sub.nonTBTotal} (${sub.percentage}%)</strong>
        </span>
        <span style="background:#e3eeec;border-radius:8px;padding:7px 13px;font-size:13px;">
          Kategori: <strong>${sub.kategori}</strong>
        </span>
      </div>
      <div style="overflow-x:auto;padding:10px 22px 22px;">
        <table style="width:100%;border-collapse:collapse;font-family:inherit;">
          <thead>
            <tr style="border-bottom:2px solid #eee;">
              <th style="text-align:left;padding:6px;font-size:11px;color:#999;">NO</th>
              <th style="text-align:left;padding:6px;font-size:11px;color:#999;">PENILAIAN</th>
              <th style="text-align:left;padding:6px;font-size:11px;color:#999;">TINDAK SUSUL</th>
              <th style="text-align:left;padding:6px;font-size:11px;color:#999;">CATATAN</th>
              <th style="text-align:left;padding:6px;font-size:11px;color:#999;">FOTO</th>
            </tr>
          </thead>
          <tbody>${rowsHtml||'<tr><td colspan="5" style="text-align:center;padding:20px;color:#bbb;">Tiada data soalan</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

/* ── Table ────────────────────────────────────────────────────────── */
function renderTable(subs) {
  const sorted = [...subs].sort((a, b) => new Date(b.tarikhAudit) - new Date(a.tarikhAudit));
  document.querySelector("#audit-table tbody").innerHTML = sorted.map(s => `
    <tr>
      <td>${s.tarikhAudit||"-"}</td>
      <td>${s.daerah||"-"}</td>
      <td>${s.klinik||"-"}</td>
      <td>${s.namaPPP||"-"}</td>
      <td><span style="font-size:11px;background:var(--color-primary-tint);color:var(--color-primary-dark);padding:2px 8px;border-radius:99px;">${s.auditLabel||s.auditType||"-"}</span></td>
      <td>${s.totalMarks||0}/${s.nonTBTotal||"-"} (${s.percentage||0}%)</td>
      <td>${s.kategori||"-"}</td>
      <td><button onclick="showDetail('${s.submissionId}')"
        style="background:none;border:1.5px solid var(--color-border-strong);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:13px;" title="Lihat butiran">🔍</button></td>
    </tr>
  `).join("") || `<tr><td colspan="8" class="empty-state">Tiada audit dijumpai.</td></tr>`;
}

/* ── Level tab switching ──────────────────────────────────────────── */
let ACTIVE_LEVEL = "daerah";

function switchLevel(level) {
  ACTIVE_LEVEL = level;
  document.getElementById("tab-daerah").classList.toggle("is-active", level === "daerah");
  document.getElementById("tab-jkn").classList.toggle("is-active", level === "jkn");
  document.getElementById("progress-section").style.display = level === "daerah" ? "" : "none";
  document.getElementById("jkn-section").style.display = level === "jkn" ? "" : "none";

  const mainSections = ["kpi-grid","dashboard-spectrum",".filter-row","#chart-daerah","#chart-kategori","#chart-trend","#chart-failpoints"].map(s=>document.querySelector(s)?.closest?.(".card")||document.querySelector(s));

  // Show/hide charts and table for daerah mode
  document.querySelectorAll(".chart-card").forEach(el => el.style.display = level === "daerah" ? "" : "none");
  // kpi-grid and spectrum shown always
  if (level === "jkn") {
    renderJknAnalysis();
  } else {
    renderAll();
  }
}

/* ── JKN Analysis ─────────────────────────────────────────────────── */
function renderJknAnalysis() {
  const jknSubs    = RAW.submissions.filter(s => s.level === "jkn");
  const daerahSubs = RAW.submissions.filter(s => s.level !== "jkn");

  // KPI for JKN
  renderKpis(jknSubs);

  // Summary: count per form type
  const byCat = {};
  jknSubs.forEach(s => { byCat[s.auditLabel] = (byCat[s.auditLabel]||0)+1; });
  const sumHtml = Object.entries(byCat).map(([label, n]) =>
    `<div style="display:inline-flex;align-items:center;gap:8px;background:var(--color-primary-tint);border-radius:8px;padding:8px 14px;margin:4px 4px 4px 0;font-size:13px;">
       <span style="font-weight:700;font-size:18px;">${n}</span> ${label}
     </div>`
  ).join("") || `<p style="color:var(--color-text-faint);font-size:13px;">Belum ada audit JKN.</p>`;
  document.getElementById("jkn-summary").innerHTML = sumHtml;

  // Comparison table
  const compDiv = document.getElementById("jkn-comparison");
  if (!jknSubs.length || !daerahSubs.length) {
    compDiv.innerHTML = `<p style="color:var(--color-text-faint);font-size:13px;padding:12px 0;">Data tidak mencukupi untuk perbandingan. Perlukan audit daerah DAN JKN untuk KK yang sama.</p>`;
    return;
  }

  // Build lookup: klinik+type → { daerah: avg%, jkn: avg% }
  function avgByKey(subs) {
    const map = {};
    subs.forEach(s => {
      const key = s.klinik + "|||" + s.auditType;
      if (!map[key]) map[key] = { daerah:s.daerah, klinik:s.klinik, type:s.auditLabel, scores:[] };
      map[key].scores.push(Number(s.percentage));
    });
    return map;
  }
  const daerahMap = avgByKey(daerahSubs);
  const jknMap    = avgByKey(jknSubs);

  // Find common KK+type pairs
  const rows = [];
  Object.keys(jknMap).forEach(key => {
    if (!daerahMap[key]) return;
    const d = daerahMap[key];
    const j = jknMap[key];
    const dAvg = Math.round(d.scores.reduce((a,b)=>a+b,0)/d.scores.length);
    const jAvg = Math.round(j.scores.reduce((a,b)=>a+b,0)/j.scores.length);
    rows.push({ daerah:d.daerah, klinik:d.klinik, type:d.type, daerahAvg:dAvg, jknAvg:jAvg, diff:jAvg-dAvg });
  });

  if (!rows.length) {
    compDiv.innerHTML = `<p style="color:var(--color-text-faint);font-size:13px;padding:12px 0;">Tiada KK yang sama diaudit oleh kedua-dua peringkat daerah dan JKN.</p>`;
    return;
  }

  // Group by daerah
  const grouped = {};
  rows.forEach(r => { (grouped[r.daerah] = grouped[r.daerah]||[]).push(r); });

  let html = `<div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="border-bottom:2px solid var(--color-border);">
        <th style="text-align:left;padding:7px 8px;color:var(--color-text-faint);font-size:11px;">DAERAH / KLINIK</th>
        <th style="text-align:left;padding:7px 8px;color:var(--color-text-faint);font-size:11px;">JENIS AUDIT</th>
        <th style="text-align:center;padding:7px 8px;color:var(--color-text-faint);font-size:11px;">MARKAH DAERAH</th>
        <th style="text-align:center;padding:7px 8px;color:var(--color-text-faint);font-size:11px;">MARKAH JKN</th>
        <th style="text-align:center;padding:7px 8px;color:var(--color-text-faint);font-size:11px;">BEZA</th>
      </tr></thead><tbody>`;

  Object.keys(grouped).sort().forEach(d => {
    html += `<tr><td colspan="5" style="padding:9px 8px 4px;font-weight:700;color:var(--color-primary-dark);font-size:12px;letter-spacing:.04em;text-transform:uppercase;">${d}</td></tr>`;
    grouped[d].forEach(r => {
      const diffColor = r.diff > 0 ? "#1e8e5a" : r.diff < 0 ? "#c0392b" : "#888";
      const diffText  = (r.diff > 0 ? "+" : "") + r.diff + "%";
      html += `<tr style="border-bottom:1px solid var(--color-border);">
        <td style="padding:7px 8px;padding-left:18px;">${r.klinik}</td>
        <td style="padding:7px 8px;"><span style="font-size:11px;background:var(--color-primary-tint);color:var(--color-primary-dark);padding:2px 8px;border-radius:99px;">${r.type}</span></td>
        <td style="padding:7px 8px;text-align:center;font-weight:600;">${r.daerahAvg}%</td>
        <td style="padding:7px 8px;text-align:center;font-weight:600;">${r.jknAvg}%</td>
        <td style="padding:7px 8px;text-align:center;font-weight:700;color:${diffColor};">${diffText}</td>
      </tr>`;
    });
  });

  html += `</tbody></table></div>`;
  compDiv.innerHTML = html;
}
