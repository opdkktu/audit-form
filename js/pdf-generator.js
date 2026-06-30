/**
 * pdf-generator.js
 * ----------------
 * Builds the audit report PDF in the browser. jsPDF + the autoTable
 * plugin are only fetched from the CDN the first time a PDF is
 * requested (lazy-loaded), so they never slow down the form's initial
 * load.
 *
 * Photos are NOT embedded as images in the PDF — they live in Google
 * Drive, and embedding them would require the browser to re-fetch each
 * Drive image cross-origin, which Drive's sharing links don't reliably
 * allow. Instead, every photo is listed as a tappable link in an
 * appendix page at the end of the report.
 */

const JSPDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
const JSPDF_AUTOTABLE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";

async function ensurePdfLibs() {
  await loadScript(JSPDF_CDN);
  await loadScript(JSPDF_AUTOTABLE_CDN);
}

function slugForFilename(str) {
  return String(str || "")
    .toUpperCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function generateAuditPdf({ header, auditorRole, answers, totalMarks, percentage }) {
  await ensurePdfLibs();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const kategori = getKategori(percentage);

  // --- Header -----------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SENARAI SEMAK AUDIT TEKNIKAL AMBULANS", margin, 50);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.text("Kesihatan Awam, Jabatan Kesihatan Negeri Kedah", margin, 66);
  doc.setDrawColor(11, 79, 92);
  doc.setLineWidth(1.2);
  doc.line(margin, 76, pageWidth - margin, 76);

  // --- Maklumat Am --------------------------------------------------------
  let y = 96;
  const infoRows = [
    ["Daerah", header.daerah],
    ["Klinik Dilawati", header.klinik],
    ["Nama PPP", header.namaPPP],
    ["Tarikh Audit", header.tarikhAudit],
    ["Auditor " + auditorRole, header.auditorName]
  ];
  doc.setFontSize(10);
  infoRows.forEach(([label, val]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(val || "-"), margin + 120, y);
    y += 16;
  });

  // --- Section tables -----------------------------------------------------
  const photoAppendix = []; // { qNo, urls: [] } — filled in from the submitted result via answers' photo metadata if present

  y += 6;
  AUDIT_SECTIONS.forEach(section => {
    const body = section.questions.map(q => {
      const a = answers[q.no] || {};
      const photoCount = (a.photos && a.photos.length) || 0;
      if (photoCount) photoAppendix.push({ qNo: q.no, count: photoCount });
      return [
        q.no,
        q.text,
        a.penilaian === "YA" ? "Ya" : (a.penilaian === "TIDAK" ? "Tidak" : "-"),
        a.tindakSusul === "PERLU" ? "Perlu" : (a.tindakSusul === "TIDAK_PERLU" ? "Tidak Perlu" : "-"),
        a.catatan || "",
        photoCount ? ("📷 " + photoCount) : ""
      ];
    });

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Bil", "Bahagian " + section.code + ": " + section.title, "Penilaian", "Tindak Susul", "Catatan", "Foto"]],
      body,
      styles: { fontSize: 8.2, cellPadding: 4, valign: "top" },
      headStyles: { fillColor: [11, 79, 92], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 175 },
        2: { cellWidth: 48, halign: "center" },
        3: { cellWidth: 55, halign: "center" },
        4: { cellWidth: "auto" },
        5: { cellWidth: 32, halign: "center" }
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          if (data.cell.raw === "Ya") data.cell.styles.textColor = [30, 142, 90];
          if (data.cell.raw === "Tidak") data.cell.styles.textColor = [192, 57, 43];
        }
      }
    });
    y = doc.lastAutoTable.finalY + 18;
    if (y > 700) { doc.addPage(); y = 50; }
  });

  // --- Score summary --------------------------------------------------
  if (y > 680) { doc.addPage(); y = 60; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Markah: " + totalMarks + " / " + AUDIT_SECTIONS.reduce((s, sec) => s + sec.questions.length, 0) + "  (" + percentage + "%)", margin, y);
  y += 18;
  doc.setFillColor(...hexToRgb(kategori.color));
  doc.roundedRect(margin, y - 12, 280, 22, 5, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.text("Kategori: " + kategori.label, margin + 10, y + 3);
  doc.setTextColor(0, 0, 0);

  // --- Photo appendix ---------------------------------------------------
  if (photoAppendix.length) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Lampiran Foto", margin, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    let yy = 74;
    photoAppendix.forEach(item => {
      const a = answers[item.qNo];
      doc.setFont("helvetica", "bold");
      doc.text("Soalan " + item.qNo + ":", margin, yy);
      doc.setFont("helvetica", "normal");
      yy += 14;
      (a.photoUrls || []).forEach((url, i) => {
        doc.setTextColor(11, 79, 92);
        doc.textWithLink("Foto " + (i + 1) + " — buka di Google Drive", margin + 14, yy, { url });
        doc.setTextColor(0, 0, 0);
        yy += 14;
      });
      if (!a.photoUrls || !a.photoUrls.length) {
        doc.text("(pautan foto akan tersedia selepas dimuat naik ke Drive)", margin + 14, yy);
        yy += 14;
      }
      yy += 6;
      if (yy > 760) { doc.addPage(); yy = 50; }
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(140, 150, 148);
  doc.text("Dijana secara automatik — " + new Date().toLocaleString("ms-MY"), margin, doc.internal.pageSize.getHeight() - 20);

  const filename = [slugForFilename(header.klinik), slugForFilename(header.auditorName), header.tarikhAudit].join("-") + ".pdf";
  doc.save(filename);
}

function hexToRgb(hex) {
  const m = hex.replace("#", "");
  return [parseInt(m.substring(0, 2), 16), parseInt(m.substring(2, 4), 16), parseInt(m.substring(4, 6), 16)];
}
