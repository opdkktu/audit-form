/**
 * questions-data.js
 * ------------------
 * Single source of truth for the 30 audit questions.
 * Matches "SENARAI SEMAK AUDIT TEKNIKAL AMBULANS - JKN KEDAH" (1.0/2026).
 *
 * Used by: form.js (renders the wizard) and pdf-generator.js (renders the report).
 * If the official checklist ever changes, edit ONLY this file.
 */

const AUDIT_SECTIONS = [
  {
    code: "A",
    title: "INFRASTRUKTUR  & PERSEKITARAN",
    questions: [
      { no: 1, text: "Laluan masuk Ambulans jelas dan tidak terhalang" },
      { no: 2, text: "Papan tanda / sign KECEMASAN ada" },
      { no: 3, text: "Maklumat Pegawai Bertugas Atas Panggilan dipamerkan dan dikemaskini ( fasiliti yang menyediakan perkhidmatan kecemasan selepas waktu pejabat)" },
      { no: 4, text: "Notis pemberitahuan tiada perkhidmatan kecemasan dipamerkan ( fasiliti yang TIDAK menyediakan perkhidmatan kecemasan selepas waktu pejabat )" },
      { no: 5, text: "Kemudahan OKU ( kerusi roda ) dan laluan jalan ( Ramp ) disediakan" },
      { no: 6, text: "Mempunyai sistem Pengaktifan Code Blue" },
      { no: 7, text: "Ruang / sudut khas untuk rawatan Asma disediakan" },
      { no: 8, text: "Pencahayaan mencukupi dan sistem pengudaraan / air cond berfungsi" },
      { no: 9, text: "Pelan evakuasi dipamerkan dan laluan evakuasi ditanda dengan jelas" }
    ]
  },
  {
    code: "B",
    title: "Peralatan & Ubatan",
    questions: [
      { no: 10, text: "EMTS bag mengikut senarai yang telah ditetapkan dalam garis panduan dan dikemaskini" },
      { no: 11, text: "Semua peralatan perubatan berfungsi dan dalam keadaan baik" },
      { no: 12, text: "Semua peralatan perubatan di buat PPM tahunan" },
      { no: 13, text: "Troli kecemasan mudah diakses dan tiada halangan serta dilengkapi dengan peralatan dan ubatan resusitasi" },
      { no: 14, text: "Senarai stok di troli kecemasan mengikut senarai yang telah ditetapkan dalam garis panduan dan dikemaskini" },
      { no: 15, text: "Stok ubat berada dalam keadaan baik dan tiada tarikh luput" },
      { no: 16, text: "Semua ubatan High Alert Medication ( HAM ) dalam simpanan yang baik dan berlabel" },
      { no: 17, text: "Tempat simpanan ubat psikotropik dikunci dan stok fizikal selaras dengan rekod terkini ( buku daftar / rekod ) " },
      { no: 18, text: "Pemantauan rekod suhu bilik dan peti sejuk dilakukan" },
      { no: 19, text: "Checklist harian & mingguan disemak oleh PPP dan Penyelia PPP" }
    ]
  },
  {
    code: "C",
    title: "KAWALAN INFKESI",
    questions: [
      { no: 20, text: "Kawasan bilik rawatan dalam keadaan  bersih" },
      { no: 21, text: "PPE mencukupi" },
      { no: 22, text: "Tong sisa klinikal  / Sharp bin tersedia" },
      { no: 23, text: "Hand sanitizer, tisu dan sabun basuh tangan tersedia dan mencukupi" },
      { no: 24, text: "Ruang /Bilik isolasi berfungsi" }
]
  },
  {
    code: "D",
    title: "DOKUMENTASI",
    questions: [
      
      { no: 25, text: "Jadual Oncall dan Tugasan dikemaskini, lengkap dan mudah dilihat" },
      { no: 26, text: "Mempunyai Rekod Pendaftaran Pesakit kecemasan dan penggunaan Kad Rawatan Pesakit Luar / CCMS - pengisian maklumat untuk setiap kes kecemasan" },
      { no: 27, text: "Mempunyai Rekod Laporan Respon Kes Kecemasan Waktu Pejabat dan Rekod Laporan Respon Kes Kecemasan Luar Waktu Pejabat" },
      { no: 28, text: "Rekod Penyelenggaraan PPM tersedia dan dikemaskini dan Mesin Autoclave mempunyai Sijil dandang yang terkini" },
      { no: 29, text: "Checklist harian peralatan disimpan" },
      { no: 30, text: "Rekod Latihan dalam perkhidmatan untuk meningkatkan kemahiran dan pengetahuan mengenai perkhidmatan kecemasan" },
      { no: 31, text: "Mempunyai sumber rujukan ( buku GP ), dan borang - borang yang berkaitan" },
      { no: 32, text: "Latihan simulasi kecemasan" }
    ]
  }
];

const TOTAL_QUESTIONS = AUDIT_SECTIONS.reduce((sum, s) => sum + s.questions.length, 0); // 32

/** Official 6-tier category scale (from the Ringkasan Laporan Audit page) */
const KATEGORI_SCALE = [
  { min: 91, max: 100, label: "Cemerlang", color: "#0E8C6B" },
  { min: 80, max: 90, label: "Baik", color: "#4FA37C" },
  { min: 61, max: 79, label: "Tahap Kepatuhan Memuaskan", color: "#9CAA4D" },
  { min: 41, max: 60, label: "Kurang Memuaskan", color: "#E8A23B" },
  { min: 21, max: 40, label: "Perlu Lebih Banyak Penambahbaikan", color: "#E0703A" },
  { min: 0, max: 20, label: "Gagal Mematuhi Tahap Minimum", color: "#C0392B" }
];

function getKategori(percentage) {
  for (const tier of KATEGORI_SCALE) {
    if (percentage >= tier.min && percentage <= tier.max) return tier;
  }
  return KATEGORI_SCALE[KATEGORI_SCALE.length - 1];
}
