const STATE = {
  auditType: "kecemasan",
  masterData: { daerah: [], klinikByDaerah: {} },
  header: { daerah:"", klinik:"", namaPPP:"", tarikhAudit:"" },
  answers: {},
  ringkasan: { kelebihan:"", kekurangan:"", cadangan:"", penambahbaikan:"" },
  currentStep: 0,
  result: null
};

const STEPS = [
  { key:"info",      label:"Maklumat"  },
  { key:"section",   sectionIndex:0, label:"A" },
  { key:"section",   sectionIndex:1, label:"B" },
  { key:"section",   sectionIndex:2, label:"C" },
  { key:"ringkasan", label:"Ringkasan" },
  { key:"review",    label:"Semak"     }
];

function todayISO() {
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function todayDisplay() {
  const d = new Date();
  return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();
}

/* ── Init ─────────────────────────────────────────────────────────── */
async function init() {
  document.getElementById("auditor-badge").textContent = "Audit Kecemasan";
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
  const answered = Object.values(STATE.answers).filter(a => a.penilaian).length;
  const marks = totalMarks();
  document.getElementById("progress-fill").style.width = Math.round(answered/TOTAL_QUESTIONS*100)+"%";
  document.getElementById("progress-label").textContent = "Langkah "+(STATE.currentStep+1)+" / "+STEPS.length;
  document.getElementById("progress-score").textContent = marks+"/"+TOTAL_QUESTIONS;
  document.querySelectorAll(".step-pill").forEach((el,i) => {
    el.classList.toggle("is-active", i===STATE.currentStep);
    el.classList.toggle("is-done", i<STATE.currentStep);
  });
}
function totalMarks() {
  return Object.values(STATE.answers).filter(a => a.penilaian==="YA").length;
}

/* ── Navigation ───────────────────────────────────────────────────── */
function goToStep(n) {
  STATE.currentStep = n;
  const c = document.getElementById("step-container");
  c.innerHTML = "";
  const step = STEPS[n];
  if      (step.key==="info")      renderInfoStep(c);
  else if (step.key==="section")   renderSectionStep(c, step.sectionIndex);
  else if (step.key==="ringkasan") renderRingkasanStep(c);
  else if (step.key==="review")    renderReviewStep(c);
  updateProgress();
  window.scrollTo({ top:0, behavior:"smooth" });
}
function nextStep() {
  if (STEPS[STATE.currentStep].key==="info" && !validateInfo()) return;
  if (STEPS[STATE.currentStep].key==="section") {
    const si = STEPS[STATE.currentStep].sectionIndex;
    const unanswered = AUDIT_SECTIONS[si].questions.filter(q => !STATE.answers[q.no].penilaian);
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
      <div class="field"><label for="f-nama-ppp">Nama PPP / Auditor</label>
        <input type="text" id="f-nama-ppp" class="input-uppercase" placeholder="NAMA PENUH" value="${STATE.header.namaPPP}">
        <div class="field-hint">Akan ditukar huruf besar secara automatik.</div>
      </div>
      <div class="field"><label>Tarikh Audit</label>
        <input type="text" class="input-readonly" value="${todayDisplay()}" readonly>
      </div>
    </div>
    <div class="btn-row"><button class="btn btn-primary btn-block" id="btn-next">Mula Audit →</button></div>
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
  if (!STATE.header.daerah)        { toast("Sila pilih Daerah.","error"); return false; }
  if (!STATE.header.klinik)        { toast("Sila pilih Klinik.","error"); return false; }
  if (!STATE.header.namaPPP.trim()){ toast("Sila isi Nama PPP / Auditor.","error"); return false; }
  return true;
}

/* ── Steps 1-3: Questions ─────────────────────────────────────────── */
function renderSectionStep(c, si) {
  const sec = AUDIT_SECTIONS[si];
  c.insertAdjacentHTML("beforeend", `
    <div class="section-divider">
      <div class="section-divider__badge">${sec.code}</div>
      <div>
        <div class="section-divider__title">${sec.title}</div>
        <div class="section-divider__count">${sec.questions.length} soalan</div>
      </div>
    </div>
    <div id="q-list"></div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="btn-back">← Kembali</button>
      <button class="btn btn-primary" id="btn-next">Seterusnya →</button>
    </div>
  `);
  const list = document.getElementById("q-list");
  sec.questions.forEach(q => list.appendChild(buildQuestionCard(q)));
  document.getElementById("btn-back").addEventListener("click", prevStep);
  document.getElementById("btn-next").addEventListener("click", nextStep);
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
        canvas.width=w; canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        res(canvas.toDataURL("image/jpeg",quality));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── Step 4: Ringkasan ────────────────────────────────────────────── */
function renderRingkasanStep(c) {
  const r = STATE.ringkasan;
  c.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="margin-bottom:4px;">Ringkasan Laporan Audit</h2>
      <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:18px;">Sila isi rumusan dapatan audit sebelum menghantar laporan.</p>
      <div class="ringkasan-block">
        <div class="ringkasan-block__label"><span class="ringkasan-block__icon" style="background:#e4f4ec;color:#1e8e5a;">✓</span>Kelebihan</div>
        <textarea id="r-kelebihan" class="ringkasan-ta" placeholder="Nyatakan kelebihan yang diperhatikan...">${r.kelebihan}</textarea>
      </div>
      <div class="ringkasan-block">
        <div class="ringkasan-block__label"><span class="ringkasan-block__icon" style="background:#fbe8e5;color:#c0392b;">✗</span>Kekurangan</div>
        <textarea id="r-kekurangan" class="ringkasan-ta" placeholder="Nyatakan kekurangan / isu yang dikesan...">${r.kekurangan}</textarea>
      </div>
      <div class="ringkasan-block">
        <div class="ringkasan-block__label"><span class="ringkasan-block__icon" style="background:#e3eeec;color:#0b4f5c;">💡</span>Cadangan</div>
        <textarea id="r-cadangan" class="ringkasan-ta" placeholder="Nyatakan cadangan penambahbaikan...">${r.cadangan}</textarea>
      </div>
      <div class="ringkasan-block">
        <div class="ringkasan-block__label"><span class="ringkasan-block__icon" style="background:#fff3e0;color:#e8a23b;">🔧</span>Penambahbaikan</div>
        <textarea id="r-penambahbaikan" class="ringkasan-ta" placeholder="Nyatakan tindakan yang perlu dilaksanakan...">${r.penambahbaikan}</textarea>
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

/* ── Step 5: Semak ────────────────────────────────────────────────── */
function renderReviewStep(c) {
  const marks = totalMarks();
  const pct = Math.round(marks/TOTAL_QUESTIONS*100);
  const kat = getKategori(pct);

  c.insertAdjacentHTML("beforeend", `
    <div class="card">
      <h2 style="margin-bottom:10px;">Semak Sebelum Hantar</h2>
      <div style="font-size:13.5px;color:var(--color-text-muted);margin-bottom:10px;line-height:1.7;">
        <strong>${STATE.header.klinik}</strong> · ${STATE.header.daerah}<br>
        PPP / Auditor: <strong>${STATE.header.namaPPP}</strong><br>
        Tarikh: ${STATE.header.tarikhAudit}
      </div>
      ${AUDIT_SECTIONS.map(sec => {
        const ya = sec.questions.filter(q => STATE.answers[q.no].penilaian==="YA").length;
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--color-border);">
          <span>Bahagian ${sec.code} — ${sec.title}</span><strong>${ya}/${sec.questions.length}</strong></div>`;
      }).join("")}
      <div class="score-hero">
        <div class="score-hero__value">${marks}/${TOTAL_QUESTIONS}</div>
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
    const result = await Loading.withLoading("Menghantar audit & memuat naik foto...", async () => {
      const payload = {
        auditType: STATE.auditType,
        daerah: STATE.header.daerah,
        klinik: STATE.header.klinik,
        namaPPP: STATE.header.namaPPP,
        tarikhAudit: STATE.header.tarikhAudit,
        ringkasan: STATE.ringkasan,
        answers: Object.entries(STATE.answers).map(([qNo,a]) => ({
          qNo: Number(qNo),
          penilaian: a.penilaian || "",
          tindakSusul: a.tindakSusul || "",
          catatan: a.catatan,
          photos: (a.photos||[]).map(p => ({ dataUrl:p.dataUrl, filename:p.filename }))
        }))
      };
      const res = await Api.gasPost("submitAudit", payload);
      if (!res.success) throw new Error(res.error || "Gagal menghantar");
      return res;
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
        <div class="score-hero__value">${r.totalMarks}/${TOTAL_QUESTIONS}</div>
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

  renderSpectrum(document.getElementById("result-spectrum"), r.percentage);
  launchFireworks();
  document.querySelectorAll(".step-pill").forEach(el => el.classList.add("is-done"));
  document.getElementById("progress-fill").style.width = "100%";
  document.getElementById("progress-label").textContent = "Selesai";

  const STAR_LABELS = ["","Sangat Lemah","Lemah","Memuaskan","Baik","Sangat Baik"];
  let selectedStar = 0;
  const stars = document.querySelectorAll(".star-btn");
  const starLabel = document.getElementById("star-label");
  function highlightStars(n){ stars.forEach(b => b.classList.toggle("is-selected", Number(b.dataset.val)<=n)); }
  stars.forEach(btn => {
    btn.addEventListener("mouseenter", () => highlightStars(Number(btn.dataset.val)));
    btn.addEventListener("mouseleave", () => highlightStars(selectedStar));
    btn.addEventListener("click", () => { selectedStar=Number(btn.dataset.val); highlightStars(selectedStar); starLabel.textContent=STAR_LABELS[selectedStar]+" — "+selectedStar+"/5"; });
  });

  document.getElementById("btn-rate").addEventListener("click", async () => {
    if (!selectedStar) { toast("Sila pilih bintang dahulu.","error"); return; }
    try {
      await Loading.withLoading("Menghantar maklum balas...", async () => {
        await Api.gasPost("submitRating", { submissionId:r.submissionId, rating:selectedStar, comment:document.getElementById("rating-comment").value.trim() });
      });
      document.getElementById("btn-rate").style.display="none";
      document.getElementById("rating-done").style.display="block";
    } catch(err) { toast("Gagal hantar: "+err.message,"error"); }
  });

  document.getElementById("btn-pdf").addEventListener("click", async () => {
    try {
      await Loading.withLoading("Menjana PDF...", async () => {
        await generateAuditPdf({
          header: STATE.header,
          answers: STATE.answers,
          ringkasan: STATE.ringkasan,
          auditLabel: "Audit Kecemasan",
          totalMarks: r.totalMarks,
          nonTBTotal: TOTAL_QUESTIONS,
          percentage: r.percentage,
          isReaudit: false
        });
      });
    } catch(err) { toast("Gagal menjana PDF: "+err.message,"error"); }
  });

  document.getElementById("btn-new").addEventListener("click", () => location.href="index.html");
}

function launchFireworks() {
  const end = Date.now() + 4000;
  const interval = setInterval(() => {
    if (Date.now() > end) return clearInterval(interval);
    const count = 50 * ((end - Date.now()) / 4000);
    confetti({ particleCount:count, startVelocity:30, spread:360, ticks:60, zIndex:1001, origin:{ x:Math.random()*.2+.1, y:Math.random()-.2 } });
    confetti({ particleCount:count, startVelocity:30, spread:360, ticks:60, zIndex:1001, origin:{ x:Math.random()*.2+.7, y:Math.random()-.2 } });
  }, 250);
}

init();
