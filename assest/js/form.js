/**
 * form.js
 * -------
 * Drives the audit wizard:
 *   Step 0 — Maklumat Am (daerah/klinik dropdowns, nama PPP, auditor)
 *   Step 1 — Section A questions
 *   Step 2 — Section B questions
 *   Step 3 — Section C questions
 *   Step 4 — Semak & Hantar (review + submit)
 *   Step 5 — Result (score, category, PDF download)
 *
 * Each step's DOM is built only when the user navigates to it
 * (lazy rendering) — earlier steps are kept in `state`, not in the DOM.
 */

const STATE = {
  auditorRole: null,
  masterData: { daerah: [], klinikByDaerah: {} },
  header: { daerah: "", klinik: "", namaPPP: "", auditorName: "", tarikhAudit: "" },
  answers: {}, // qNo -> { penilaian, tindakSusul, catatan, photos: [{dataUrl, filename}] }
  currentStep: 0,
  result: null
};

const STEPS = [
  { key: "info", label: "Maklumat" },
  { key: "section", sectionIndex: 0, label: "A" },
  { key: "section", sectionIndex: 1, label: "B" },
  { key: "section", sectionIndex: 2, label: "C" },
  { key: "review", label: "Semak" }
];

function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function todayDisplay() {
  const d = new Date();
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}

/* ====================================================================== */
/* Init                                                                    */
/* ====================================================================== */

async function init() {
  const params = new URLSearchParams(location.search);
  STATE.auditorRole = params.get("auditor") === "2" ? "2" : "1";
  document.getElementById("auditor-badge").textContent = "Borang Auditor " + STATE.auditorRole;
  STATE.header.tarikhAudit = todayISO();

  AUDIT_SECTIONS.forEach(sec => sec.questions.forEach(q => {
    STATE.answers[q.no] = { penilaian: null, tindakSusul: null, catatan: "", photos: [] };
  }));

  renderStepPills();

  try {
    await Loading.withLoading("Memuatkan senarai daerah & klinik...", async () => {
      const res = await Api.gasGet("getMasterData");
      if (!res.success) throw new Error(res.error || "Gagal memuat data");
      STATE.masterData = res.data;
    });
  } catch (err) {
    toast("Gagal memuat senarai daerah/klinik: " + err.message, "error");
  }

  goToStep(0);
}

/* ====================================================================== */
/* Step pills + progress                                                  */
/* ====================================================================== */

function renderStepPills() {
  const wrap = document.getElementById("step-pills");
  wrap.innerHTML = STEPS.map((s, i) =>
    `<div class="step-pill" data-step="${i}">${s.label}</div>`
  ).join("");
}

function updateStepPillsActive() {
  document.querySelectorAll(".step-pill").forEach((el, i) => {
    el.classList.toggle("is-active", i === STATE.currentStep);
    el.classList.toggle("is-done", i < STATE.currentStep);
  });
}

function answeredCount() {
  return Object.values(STATE.answers).filter(a => a.penilaian).length;
}

function totalMarks() {
  return Object.values(STATE.answers).filter(a => a.penilaian === "YA").length;
}

function updateProgressBar() {
  const answered = answeredCount();
  const pct = Math.round((answered / TOTAL_QUESTIONS) * 100);
  document.getElementById("progress-fill").style.width = pct + "%";
  document.getElementById("progress-label").textContent =
    "Langkah " + (STATE.currentStep + 1) + " / " + STEPS.length;
  document.getElementById("progress-score").textContent = totalMarks() + "/" + TOTAL_QUESTIONS;
  updateStepPillsActive();
}

/* ====================================================================== */
/* Navigation                                                              */
/* ====================================================================== */

function goToStep(n) {
  STATE.currentStep = n;
  const step = STEPS[n];
  const container = document.getElementById("step-container");
  container.innerHTML = "";

  if (step.key === "info") renderInfoStep(container);
  else if (step.key === "section") renderSectionStep(container, step.sectionIndex);
  else if (step.key === "review") renderReviewStep(container);

  updateProgressBar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function nextStep() {
  if (STATE.currentStep === 0 && !validateInfoStep()) return;
  if (STEPS[STATE.currentStep].key === "section" && !validateSectionStep(STEPS[STATE.currentStep].sectionIndex)) {
    toast("Sila jawab semua soalan dalam bahagian ini sebelum teruskan.", "error");
    return;
  }
  if (STATE.currentStep < STEPS.length - 1) goToStep(STATE.currentStep + 1);
}

function prevStep() {
  if (STATE.currentStep > 0) goToStep(STATE.currentStep - 1);
}

/* ====================================================================== */
/* Step 0 — Maklumat Am                                                   */
/* ====================================================================== */

function renderInfoStep(container) {
  const daerahOptions = STATE.masterData.daerah.map(d =>
    `<option value="${d}" ${STATE.header.daerah === d ? "selected" : ""}>${d}</option>`
  ).join("");

  container.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="margin-bottom:14px;">Maklumat Am</h2>

      <div class="field">
        <label for="f-daerah">Daerah</label>
        <select id="f-daerah">
          <option value="">— Pilih Daerah —</option>
          ${daerahOptions}
        </select>
      </div>

      <div class="field">
        <label for="f-klinik">Klinik Dilawati</label>
        <select id="f-klinik">
          <option value="">— Pilih Daerah dahulu —</option>
        </select>
      </div>

      <div class="field">
        <label for="f-nama-ppp">Nama PPP</label>
        <input type="text" id="f-nama-ppp" class="input-uppercase" placeholder="CONTOH: AHMAD BIN ALI" value="${STATE.header.namaPPP}">
        <div class="field-hint">Akan ditukar kepada huruf besar secara automatik.</div>
      </div>

      <div class="field">
        <label for="f-nama-auditor">Nama Auditor ${STATE.auditorRole}</label>
        <input type="text" id="f-nama-auditor" class="input-uppercase" placeholder="NAMA PENUH" value="${STATE.header.auditorName}">
      </div>

      <div class="field">
        <label>Tarikh Audit</label>
        <input type="text" class="input-readonly" value="${todayDisplay()}" readonly>
        <div class="field-hint">Diisi automatik mengikut tarikh hari ini.</div>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary btn-block" id="btn-next">Mula Audit →</button>
    </div>
  `);

  const daerahSel = document.getElementById("f-daerah");
  const klinikSel = document.getElementById("f-klinik");

  function refreshKlinikOptions(preserve) {
    const list = STATE.masterData.klinikByDaerah[daerahSel.value] || [];
    klinikSel.innerHTML = `<option value="">— Pilih Klinik —</option>` +
      list.map(k => `<option value="${k}" ${preserve === k ? "selected" : ""}>${k}</option>`).join("");
    klinikSel.disabled = list.length === 0;
  }
  if (STATE.header.daerah) refreshKlinikOptions(STATE.header.klinik);

  daerahSel.addEventListener("change", () => {
    STATE.header.daerah = daerahSel.value;
    STATE.header.klinik = "";
    refreshKlinikOptions(null);
  });
  klinikSel.addEventListener("change", () => { STATE.header.klinik = klinikSel.value; });

  const namaPppEl = document.getElementById("f-nama-ppp");
  namaPppEl.addEventListener("input", () => {
    const pos = namaPppEl.selectionStart;
    namaPppEl.value = namaPppEl.value.toUpperCase();
    namaPppEl.setSelectionRange(pos, pos);
    STATE.header.namaPPP = namaPppEl.value;
  });

  const namaAuditorEl = document.getElementById("f-nama-auditor");
  namaAuditorEl.addEventListener("input", () => {
    const pos = namaAuditorEl.selectionStart;
    namaAuditorEl.value = namaAuditorEl.value.toUpperCase();
    namaAuditorEl.setSelectionRange(pos, pos);
    STATE.header.auditorName = namaAuditorEl.value;
  });

  document.getElementById("btn-next").addEventListener("click", nextStep);
}

function validateInfoStep() {
  if (!STATE.header.daerah) return toast("Sila pilih Daerah.", "error"), false;
  if (!STATE.header.klinik) return toast("Sila pilih Klinik.", "error"), false;
  if (!STATE.header.namaPPP.trim()) return toast("Sila isi Nama PPP.", "error"), false;
  if (!STATE.header.auditorName.trim()) return toast("Sila isi Nama Auditor.", "error"), false;
  return true;
}

/* ====================================================================== */
/* Step 1-3 — Section questions                                           */
/* ====================================================================== */

function renderSectionStep(container, sectionIndex) {
  const section = AUDIT_SECTIONS[sectionIndex];

  container.insertAdjacentHTML("beforeend", `
    <div class="section-divider">
      <div class="section-divider__badge">${section.code}</div>
      <div>
        <div class="section-divider__title">${section.title}</div>
        <div class="section-divider__count">${section.questions.length} soalan</div>
      </div>
    </div>
    <div id="q-list"></div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="btn-back">← Kembali</button>
      <button class="btn btn-primary" id="btn-next">Seterusnya →</button>
    </div>
  `);

  const list = document.getElementById("q-list");
  section.questions.forEach(q => list.appendChild(buildQuestionCard(q)));

  document.getElementById("btn-back").addEventListener("click", prevStep);
  document.getElementById("btn-next").addEventListener("click", nextStep);
}

function validateSectionStep(sectionIndex) {
  const section = AUDIT_SECTIONS[sectionIndex];
  return section.questions.every(q => STATE.answers[q.no].penilaian);
}

function buildQuestionCard(q) {
  const ans = STATE.answers[q.no];
  const card = document.createElement("div");
  card.className = "q-card";
  card.dataset.qno = q.no;

  card.innerHTML = `
    <div class="q-card__head">
      <div class="q-card__no">${q.no}</div>
      <div class="q-card__text">${q.text}</div>
    </div>

    <div class="toggle-group-label">Penilaian</div>
    <div class="toggle-row" data-group="penilaian">
      <button type="button" class="toggle-btn choice-ya" data-val="YA">Ya</button>
      <button type="button" class="toggle-btn choice-tidak" data-val="TIDAK">Tidak</button>
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
      <label class="photo-add-btn">
        📷 Tambah Foto
        <input type="file" accept="image/*" capture="environment" multiple style="display:none;">
      </label>
    </div>
  `;

  // Wire up toggles
  card.querySelectorAll('[data-group="penilaian"] .toggle-btn').forEach(btn => {
    btn.addEventListener("click", () => {
      ans.penilaian = btn.dataset.val;
      syncToggleGroup(card, "penilaian");
      card.classList.toggle("is-answered-ya", ans.penilaian === "YA");
      card.classList.toggle("is-answered-tidak", ans.penilaian === "TIDAK");
      updateProgressBar();
    });
  });
  card.querySelectorAll('[data-group="tindakSusul"] .toggle-btn').forEach(btn => {
    btn.addEventListener("click", () => {
      ans.tindakSusul = btn.dataset.val;
      syncToggleGroup(card, "tindakSusul");
    });
  });
  syncToggleGroup(card, "penilaian");
  syncToggleGroup(card, "tindakSusul");
  card.classList.toggle("is-answered-ya", ans.penilaian === "YA");
  card.classList.toggle("is-answered-tidak", ans.penilaian === "TIDAK");

  // Catatan (no re-render — keeps caret position while typing)
  const textarea = card.querySelector("textarea");
  textarea.addEventListener("input", () => { ans.catatan = textarea.value; });

  // Photos
  renderThumbs(card, q.no);
  const fileInput = card.querySelector('input[type="file"]');
  fileInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await Loading.withLoading("Memampatkan foto...", async () => {
      for (const file of files) {
        try {
          const dataUrl = await compressImage(file);
          ans.photos.push({ dataUrl, filename: file.name });
        } catch (err) {
          console.error(err);
        }
      }
    });
    renderThumbs(card, q.no);
    fileInput.value = "";
  });

  return card;
}

function syncToggleGroup(card, group) {
  const val = STATE.answers[Number(card.dataset.qno)][group];
  card.querySelectorAll(`[data-group="${group}"] .toggle-btn`).forEach(btn => {
    btn.classList.toggle("is-selected", btn.dataset.val === val);
  });
}

function renderThumbs(card, qNo) {
  const ans = STATE.answers[qNo];
  const wrap = card.querySelector(".photo-thumbs");
  wrap.innerHTML = ans.photos.map((p, i) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" alt="Foto ${i + 1}">
      <button type="button" class="photo-thumb__remove" data-idx="${i}" aria-label="Buang foto">×</button>
    </div>
  `).join("");
  wrap.querySelectorAll(".photo-thumb__remove").forEach(btn => {
    btn.addEventListener("click", () => {
      ans.photos.splice(Number(btn.dataset.idx), 1);
      renderThumbs(card, qNo);
    });
  });
}

/** Resize + re-encode an image client-side before it ever touches the network. */
function compressImage(file, maxDim = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ====================================================================== */
/* Step 4 — Review & submit                                               */
/* ====================================================================== */

function renderReviewStep(container) {
  const sectionSummaries = AUDIT_SECTIONS.map(sec => {
    const yaCount = sec.questions.filter(q => STATE.answers[q.no].penilaian === "YA").length;
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--color-border);">
      <span>Bahagian ${sec.code} — ${sec.title}</span><strong>${yaCount}/${sec.questions.length}</strong>
    </div>`;
  }).join("");

  const marks = totalMarks();
  const pct = Math.round((marks / TOTAL_QUESTIONS) * 100);
  const kategori = getKategori(pct);

  container.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="margin-bottom:10px;">Semak Sebelum Hantar</h2>
      <p style="font-size:13.5px;color:var(--color-text-muted);margin-bottom:6px;">
        ${STATE.header.klinik} · ${STATE.header.daerah}<br>PPP: ${STATE.header.namaPPP} · Auditor ${STATE.auditorRole}: ${STATE.header.auditorName}
      </p>
      ${sectionSummaries}
      <div class="score-hero">
        <div class="score-hero__value">${marks}/${TOTAL_QUESTIONS}</div>
        <div class="score-hero__sub">${pct}% markah</div>
        <div class="kategori-chip" style="background:${kategori.color}22;color:${kategori.color};">${kategori.label}</div>
      </div>
      <div class="spectrum" id="review-spectrum"></div>
    </div>

    <div class="btn-row">
      <button class="btn btn-ghost" id="btn-back">← Kembali</button>
      <button class="btn btn-accent" id="btn-submit">Hantar Audit</button>
    </div>
  `);

  renderSpectrum(document.getElementById("review-spectrum"), pct);
  document.getElementById("btn-back").addEventListener("click", prevStep);
  document.getElementById("btn-submit").addEventListener("click", submitAudit);
}

/* ====================================================================== */
/* Submit                                                                  */
/* ====================================================================== */

function buildPayload() {
  const answers = Object.entries(STATE.answers).map(([qNo, a]) => ({
    qNo: Number(qNo),
    penilaian: a.penilaian,
    tindakSusul: a.tindakSusul,
    catatan: a.catatan,
    photos: a.photos.map(p => ({ dataUrl: p.dataUrl, filename: p.filename }))
  }));
  return {
    daerah: STATE.header.daerah,
    klinik: STATE.header.klinik,
    namaPPP: STATE.header.namaPPP,
    tarikhAudit: STATE.header.tarikhAudit,
    auditorRole: STATE.auditorRole,
    auditorName: STATE.header.auditorName,
    answers
  };
}

async function submitAudit() {
  try {
    const result = await Loading.withLoading("Menghantar audit & memuat naik foto...", async () => {
      const res = await Api.gasPost("submitAudit", buildPayload());
      if (!res.success) throw new Error(res.error || "Gagal menghantar audit");
      return res;
    });
    STATE.result = result;
    if (result.photoUrls) {
      Object.entries(result.photoUrls).forEach(([qNo, urls]) => {
        if (STATE.answers[qNo]) STATE.answers[qNo].photoUrls = urls;
      });
    }
    renderResultStep();
  } catch (err) {
    toast("Gagal menghantar: " + err.message, "error");
  }
}

function renderResultStep() {
  const container = document.getElementById("step-container");
  container.innerHTML = "";
  const r = STATE.result;
  const kategori = getKategori(r.percentage);

  container.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="text-align:center;">Audit Berjaya Dihantar ✅</h2>
      <div class="score-hero">
        <div class="score-hero__value">${r.totalMarks}/${TOTAL_QUESTIONS}</div>
        <div class="score-hero__sub">${r.percentage}% markah</div>
        <div class="kategori-chip" style="background:${kategori.color}22;color:${kategori.color};">${kategori.label}</div>
      </div>
      <div class="spectrum" id="result-spectrum"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary btn-block" id="btn-pdf">⬇ Muat Turun PDF Laporan</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost btn-block" id="btn-new">Borang Baru</button>
    </div>
  `);

  renderSpectrum(document.getElementById("result-spectrum"), r.percentage);
  document.querySelectorAll(".step-pill").forEach(el => el.classList.add("is-done"));
  document.getElementById("progress-fill").style.width = "100%";
  document.getElementById("progress-label").textContent = "Selesai";

  document.getElementById("btn-pdf").addEventListener("click", async () => {
    try {
      await Loading.withLoading("Menjana PDF...", async () => {
        await generateAuditPdf({
          header: STATE.header,
          auditorRole: STATE.auditorRole,
          answers: STATE.answers,
          totalMarks: r.totalMarks,
          percentage: r.percentage
        });
      });
    } catch (err) {
      toast("Gagal menjana PDF: " + err.message, "error");
    }
  });

  document.getElementById("btn-new").addEventListener("click", () => location.href = "form.html?auditor=" + STATE.auditorRole);
}

init();
