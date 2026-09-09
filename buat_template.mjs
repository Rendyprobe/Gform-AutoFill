import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = "outputs/gform_qa";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const data = workbook.worksheets.add("Respons Uji");
const guide = workbook.worksheets.add("Panduan");

const headers = [
  "Nama Lengkap", "Usia", "Status", "Familiaritas",
  "Transisi", "Visualisasi", "Teks Grafik Animasi", "Editing",
  "Narasi", "Musik Efek", "Cara Kerja", "Mikroplastik",
  "Solusi dan Masalah", "Relevansi MARICYCLE", "Alur Penyampaian",
  "Klaim Kurang Tepat", "Saran", "Kualitas Keseluruhan"
];

const rows = [
  ["TEST-GENZ-001", "21–25", "Mahasiswa", "Cukup familiar", 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, "Tidak ada", "Menurutku videonya udah enak diikutin, mungkin teks pentingnya bisa dibikin sedikit lebih besar biar langsung nangkep.", 8],
  ["TEST-GENZ-002", "17–20", "Pelajar", "Kurang familiar", 3, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, "Penjelasan ukuran alat masih terasa cukup cepat.", "Bagian cara kerjanya boleh diperlambat dikit, soalnya informasinya padat banget dan takut kelewat.", 8],
  ["TEST-GENZ-003", "21–25", "Mahasiswa", "Familiar", 5, 5, 4, 5, 4, 4, 5, 5, 5, 5, 5, "Tidak ada", "Overall udah keren. Kalau ada animasi sebelum-sesudah mikroplastiknya, menurutku bakal makin ngena.", 9],
  ["TEST-GENZ-004", "17–20", "Pelajar", "Tidak familiar", 3, 4, 3, 4, 4, 3, 3, 4, 4, 4, 3, "Istilah teknisnya belum semuanya dijelasin dengan bahasa sederhana.", "Bisa tambahin arti singkat buat istilah teknisnya, biar yang awam juga nggak bingung pas nonton.", 7],
  ["TEST-GENZ-005", "21–25", "Freelancer", "Sangat familiar", 4, 5, 5, 5, 4, 4, 4, 4, 5, 5, 4, "Tidak ada", "Visualnya udah clean, cuma musiknya bisa diturunin tipis pas narasi masuk supaya fokusnya tetap ke info.", 9],
  ["TEST-GENZ-006", "26–30", "Karyawan/Pegawai", "Cukup familiar", 4, 4, 4, 4, 5, 4, 4, 5, 4, 5, 4, "Tidak ada", "Mungkin opening-nya dipadatkan sedikit biar lebih cepat masuk ke masalah utama dan nggak terasa kelamaan.", 8],
  ["TEST-GENZ-007", "21–25", "Mahasiswa", "Kurang familiar", 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 4, "Urutan proses pada alat masih agak susah kebayang sekali lihat.", "Kasih nomor di tiap tahap prosesnya bakal membantu banget, jadi alurnya lebih gampang di-track.", 8],
  ["TEST-GENZ-008", "17–20", "Mahasiswa", "Familiar", 5, 4, 4, 5, 5, 4, 5, 4, 5, 5, 5, "Tidak ada", "Videonya informatif dan nggak ngebosenin. Ending-nya bisa ditambah satu kalimat ajakan yang lebih relate.", 9],
  ["TEST-GENZ-009", "21–25", "Wiraswasta", "Cukup familiar", 4, 5, 4, 4, 4, 3, 4, 5, 5, 5, 4, "Klaim dampak solusi akan lebih kuat kalau disertai angka atau sumber.", "Boleh masukin satu data singkat yang valid supaya klaim manfaatnya terasa lebih meyakinkan, bukan cuma statement.", 8],
  ["TEST-GENZ-010", "21–25", "Mahasiswa", "Familiar", 4, 4, 5, 4, 5, 4, 5, 5, 4, 5, 5, "Tidak ada", "Udah solid sih. Transisi antarbagian tinggal dibikin lebih konsisten biar flow videonya makin mulus.", 9],
];

data.getRange("A1:R11").values = [headers, ...rows];
data.showGridLines = false;
data.freezePanes.freezeRows(1);
data.getRange("A1:R4").format.font = { name: "Arial", size: 10, color: "#202124" };
data.getRange("A1:R1").format = {
  fill: "#5746E3",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "inside", style: "thin", color: "#FFFFFF" },
};
data.getRange("A2:D100").format.fill = "#FFF7CC";
data.getRange("E2:R100").format.fill = "#F7F7FB";
data.getRange("A2:R100").format.verticalAlignment = "center";
data.getRange("A2:R100").format.borders = { preset: "inside", style: "thin", color: "#E6E6EF" };
data.getRange("A1:A100").format.columnWidth = 18;
data.getRange("B1:D100").format.columnWidth = 17;
data.getRange("E1:O100").format.columnWidth = 15;
data.getRange("P1:Q100").format.columnWidth = 34;
data.getRange("R1:R100").format.columnWidth = 20;
data.getRange("A1:R1").format.rowHeight = 42;

data.getRange("B2:B100").dataValidation = { rule: { type: "list", values: ["<17", "17–20", "21–25", "26–30", "31–40", ">40"] } };
data.getRange("C2:C100").dataValidation = { rule: { type: "list", values: ["Pelajar", "Mahasiswa", "Guru/Dosen", "Karyawan/Pegawai", "Wiraswasta", "Profesional", "Freelancer", "Belum bekerja", "Lainnya"] } };
data.getRange("D2:D100").dataValidation = { rule: { type: "list", values: ["Sangat familiar", "Familiar", "Cukup familiar", "Kurang familiar", "Tidak familiar"] } };
data.getRange("E2:O100").dataValidation = { rule: { type: "whole", operator: "between", formula1: 1, formula2: 5 } };
data.getRange("R2:R100").dataValidation = { rule: { type: "whole", operator: "between", formula1: 1, formula2: 10 } };
data.tabColor = "#5746E3";

guide.showGridLines = false;
guide.getRange("A2:D2").values = [["Panduan template respons uji", null, null, null]];
guide.getRange("A2:D2").format.font = { name: "Arial", size: 14, bold: true, color: "#202124" };
guide.getRange("A3:D3").format.borders = { bottom: { style: "thin", color: "#5746E3" } };
guide.getRange("A5:B10").values = [
  ["Aturan", "Keterangan"],
  ["Nama uji", "Harus diawali TEST- agar respons mudah dikenali dan dihapus."],
  ["Baris kosong", "Diabaikan oleh skrip."],
  ["Skala evaluasi", "Kolom Transisi sampai Alur Penyampaian menerima angka 1–5."],
  ["Kualitas keseluruhan", "Menerima angka 1–10."],
  ["Pengiriman", "Skrip selalu melakukan validasi dahulu. Respons baru dikirim jika -Kirim dan -SayaPemilik dipakai."],
];
guide.getRange("A12:D12").values = [["Sumber form", "https://docs.google.com/forms/d/e/1FAIpQLSeNs7hLILksxicotU0H1ZXui-qBSuitG_9kkbJY9zKgIbEL6g/viewform", null, null]];
guide.getRange("A5:B5").format = { fill: "#5746E3", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" } };
guide.getRange("A6:B10").format.font = { name: "Arial", size: 10, color: "#202124" };
guide.getRange("A5:B10").format.verticalAlignment = "top";
guide.getRange("A5:B10").format.borders = { preset: "inside", style: "thin", color: "#E6E6EF" };
guide.getRange("A1:A20").format.columnWidth = 24;
guide.getRange("B1:B20").format.columnWidth = 72;
guide.getRange("B6:B10").format.wrapText = true;
guide.getRange("A12:B12").format.font = { name: "Arial", size: 9, italic: true, color: "#5F6368" };
guide.tabColor = "#9B8DF2";

workbook.recalculate();
const check = await workbook.inspect({ kind: "table", range: "Respons Uji!A1:R11", include: "values,formulas", tableMaxRows: 12, tableMaxCols: 18 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson);
for (const sheetName of ["Respons Uji", "Panduan"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName.replaceAll(" ", "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/template_respons_uji_10_genz.xlsx`);
