/**
 * pdf-generator.js — Audit Teknikal Ambulans
 * Fixes: unpkg CDN (reliable), photos embedded as images, single auditor
 */

const JSPDF_CDN = "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js";
const AUTOTABLE_CDN = "https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js";

async function ensurePdfLibs() {
  await loadScript(JSPDF_CDN);
  await loadScript(AUTOTABLE_CDN);
}

function slugForFilename(str) {
  return String(str || "").toUpperCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function hexToRgb(hex) {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0,2),16), parseInt(m.slice(2,4),16), parseInt(m.slice(4,6),16)];
}

async function generateAuditPdf({ header, answers, ringkasan, ambulansStatus, ambulansSebab, tbQuestions, auditLabel, totalMarks, nonTBTotal, percentage, isReaudit }) {

  await ensurePdfLibs();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const kategori = getKategori(percentage);

  // ── Header ───────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text((auditLabel || "SENARAI SEMAK AUDIT").toUpperCase(), M, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Jabatan Kesihatan Negeri Kedah" + (isReaudit ? "  |  RE-AUDIT" : ""), M, 62);
  doc.setDrawColor(11, 79, 92); doc.setLineWidth(1.2);
  doc.line(M, 70, W - M, 70);

  // ── Maklumat Am ──────────────────────────────────────────────────────
  let y = 88;
  const info = [
    ["Daerah", header.daerah], ["Klinik", header.klinik],
    ["Nama PPP", header.namaPPP], ["Tarikh Audit", header.tarikhAudit]
  ];
  doc.setFontSize(9.5);
  info.forEach(([label, val]) => {
    doc.setFont("helvetica","bold"); doc.text(label + ":", M, y);
    doc.setFont("helvetica","normal"); doc.text(String(val||"-"), M+110, y);
    y += 15;
  });

  // ── Section tables ───────────────────────────────────────────────────
  y += 6;
  const photoQueue = []; // { qNo, text, dataUrls[] }

  AUDIT_SECTIONS.forEach(sec => {
    const body = sec.questions.map(q => {
      const a = answers[q.no] || {};
      const photos = (a.photos || []).map(p => p.dataUrl).filter(Boolean);
      if (photos.length) photoQueue.push({ qNo: q.no, text: q.text, dataUrls: photos });
      return [
        q.no,
        q.text,
        a.penilaian === "YA" ? "Ya" : (a.penilaian === "TIDAK" ? "Tidak" : "-"),
        a.tindakSusul === "PERLU" ? "Perlu" : (a.tindakSusul === "TIDAK_PERLU" ? "Tidak" : "-"),
        a.catatan || "",
        photos.length ? photos.length + " foto" : ""
      ];
    });

    doc.autoTable({
      startY: y, margin: { left: M, right: M },
      head: [["Bil", `Bahagian ${sec.code}: ${sec.title}`, "Penilaian", "Tindak Susul", "Catatan", "Foto"]],
      body,
      styles: { fontSize: 8, cellPadding: 3.5, valign: "top" },
      headStyles: { fillColor: [11,79,92], textColor:255, fontStyle:"bold" },
      columnStyles: {
        0:{cellWidth:20}, 1:{cellWidth:178}, 2:{cellWidth:46,halign:"center"},
        3:{cellWidth:52,halign:"center"}, 4:{cellWidth:"auto"}, 5:{cellWidth:32,halign:"center"}
      },
      didParseCell: d => {
        if (d.section==="body" && d.column.index===2) {
          if (d.cell.raw==="Ya") d.cell.styles.textColor=[30,142,90];
          if (d.cell.raw==="Tidak") d.cell.styles.textColor=[192,57,43];
        }
      }
    });
    y = doc.lastAutoTable.finalY + 16;
    if (y > 700) { doc.addPage(); y = 50; }
  });

  // ── Score summary ────────────────────────────────────────────────────
  if (y > 680) { doc.addPage(); y = 60; }
  doc.setFont("helvetica","bold"); doc.setFontSize(12);
  doc.text(`Markah: ${totalMarks} / ${nonTBTotal}  (${percentage}%)`, M, y); y += 16;
  doc.setFillColor(...hexToRgb(kategori.color));
  doc.roundedRect(M, y-11, 290, 20, 4, 4, "F");
  doc.setTextColor(255,255,255); doc.setFontSize(10);
  doc.text("Kategori: " + kategori.label, M+8, y+3);
  doc.setTextColor(0,0,0); y += 30;

  // ── Photo appendix (embedded images) ────────────────────────────────
  if (photoQueue.length) {
    doc.addPage();
    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("Lampiran Foto", M, 46);
    doc.setDrawColor(11,79,92); doc.line(M, 52, W-M, 52);
    let py = 66;

    for (const item of photoQueue) {
      // Question label
      if (py > 730) { doc.addPage(); py = 50; }
      doc.setFont("helvetica","bold"); doc.setFontSize(9);
      doc.text(`Soalan ${item.qNo}: ${item.text}`, M, py, { maxWidth: W - M*2 });
      py += 14;

      // Photos in 2-column grid, 180×135pt each
      const imgW = 180, imgH = 135, gap = 12;
      for (let i = 0; i < item.dataUrls.length; i++) {
        const col = i % 2;
        const x = M + col * (imgW + gap);
        if (col === 0 && i > 0) py += imgH + gap;
        if (py + imgH > 770) { doc.addPage(); py = 50; }
        try {
          doc.addImage(item.dataUrls[i], "JPEG", x, py, imgW, imgH);
          doc.setDrawColor(200,200,200);
          doc.rect(x, py, imgW, imgH);
        } catch(_) {
          doc.setFont("helvetica","italic"); doc.setFontSize(8);
          doc.text("[Gagal muatkan gambar]", x+4, py+12);
        }
        doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
        doc.text(`Foto ${i+1}`, x+4, py+imgH-4);
      }
      py += imgH + 20;
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5); doc.setTextColor(160,160,160);
    doc.text(`Halaman ${p}/${pageCount}  |  Dijana automatik ${new Date().toLocaleString("ms-MY")}`,
      M, doc.internal.pageSize.getHeight()-14);
  }

const filename = [slugForFilename(header.klinik), slugForFilename(header.namaPPP), header.tarikhAudit].join("-") + ".pdf";
  doc.save(filename);
}
