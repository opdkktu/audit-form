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
    title: "Pematuhan Operasi Ambulans",
    questions: [
      { no: 1, text: "Kebersihan luaran & dalaman Ambulans" },
      { no: 2, text: "Penyelenggaraan Ambulans dilakukan mengikut jadual yang ditetapkan dan direkod" },
      { no: 3, text: "Cukai jalan tidak tamat tempoh" },
      { no: 4, text: "Senarai semak harian ambulans dilakukan (oleh pemandu)" },
      { no: 5, text: "Pemeriksaan lampu kenderaan, lampu kecemasan & siren berfungsi dengan baik, pemeriksaan tayar dan brek dalam keadaan baik" },
      { no: 6, text: "Mempunyai peralatan kecemasan kenderaan seperti alat pemadam api, kon keselamatan serta tanda amaran kenderaan berhenti" },
      { no: 7, text: "Senarai semak peralatan perubatan dalam ambulans dilakukan secara mingguan oleh PPP" },
      { no: 8, text: "Set komunikasi GIRN di dalam ambulans dalam keadaan berfungsi" },
      { no: 9, text: "Semua bahan pembersihan dan pembasmian dalam ambulans (handrub, tisu dan bekas sisa klinikal seperti sharp bin & clinical waste) hendaklah mencukupi dan menepati Garis Panduan Kawalan Infeksi" },
      { no: 10, text: "Setiap kerosakan ambulans dilaporkan dan diserah kepada pegawai yang bertanggungjawab" }
    ]
  },
  {
    code: "B",
    title: "Peralatan & Ubatan",
    questions: [
      { no: 11, text: "Mempunyai EMTS beg dan keperluan alatan mencukupi mengikut senarai semak" },
      { no: 12, text: "Peralatan perubatan dalam ambulans dilakukan PPM secara tahunan" },
      { no: 13, text: "Peralatan perubatan dan sokongan berfungsi dan dalam keadaan baik" },
      { no: 14, text: "Senarai ubat-ubatan dikemaskini dan tiada stok luput dan teratur" },
      { no: 15, text: "Senarai item consumables dikemaskini dan tiada stok luput dan teratur" },
      { no: 16, text: "Peralatan / ubat-ubatan dan item consumables mempunyai label dan diletakkan di bahagian yang betul" },
      { no: 17, text: "Memastikan stretcher mempunyai minima 3 safety strapping dan berfungsi dengan baik" }
    ]
  },
  {
    code: "C",
    title: "Dokumentasi",
    questions: [
      { no: 18, text: "Lantikan Pegawai Kenderaan (surat lantikan)" },
      { no: 19, text: "Lantikan Penyelaras Ambulans (surat lantikan)" },
      { no: 20, text: "Rekod Latihan PPP menghadiri latihan teras untuk Perawatan Kecemasan seperti PHC, BLS dan latihan lain yang berkaitan" },
      { no: 21, text: "Rekod Pemandu Ambulans telah menghadiri Kursus Pemanduan Berhemah dan Pemanduan Ambulans (sijil / rekod latihan)" },
      { no: 22, text: "Reten Status Ambulans dan data perkhidmatan Ambulans di Klinik Kesihatan" },
      { no: 23, text: "Pemeriksaan berkala dilakukan oleh Penyelia (mingguan)" },
      { no: 24, text: "Ada menjalani pemeriksaan keselamatan tahunan kenderaan di JKR" },
      { no: 25, text: "Pemandu mempunyai lesen memandu yang sah, pemeriksaan kesihatan perlu dilakukan secara tahunan dan secara berkala bagi mereka yang mempunyai masalah kesihatan" },
      { no: 26, text: "Buku Log ambulans mengikut tarikh semasa (semak dan bandingkan dengan buku rekod kes kecemasan)" },
      { no: 27, text: "Memastikan semua insiden atau kemalangan yang melibatkan ambulans dipantau serta disiasat mengikut garis panduan (bahan rujukan) / dokumentasi" },
      { no: 28, text: "Semua kawasan/parkir ambulans hendaklah ditanda dengan jelas menggunakan petak kuning dan diletakkan papan tanda parkir ambulans (Khas untuk Ambulans sahaja)" },
      { no: 29, text: "Fail PHC mempunyai jadual Tugas Tinggal Atas Panggilan, Salinan borang PHC, buku rekod Penerimaan Panggilan MECC, Interfacility dan lain-lain, Surat Akaun Pelepasan Tanggungjawab dan Borang daftar harta/wang pesakit" },
      { no: 30, text: "Mengadakan kursus, latihan simulasi, CME, latihan sangkut dan lain-lain yang berkaitan" }
    ]
  }
];

const TOTAL_QUESTIONS = AUDIT_SECTIONS.reduce((sum, s) => sum + s.questions.length, 0); // 30

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
