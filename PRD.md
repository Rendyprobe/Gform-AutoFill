# PRD — Gform-AutoFill

**Versi:** 0.1  
**Tanggal:** 10 September 2026  
**Status:** Draft untuk diskusi  
**Jenis produk:** Aplikasi web lokal untuk pengujian berulang pada Google Form publik

## 1. Ringkasan

Gform-AutoFill membantu pemilik atau pengelola Google Form melakukan pengujian respons berbasis Excel. Pengguna memasukkan URL Google Form, aplikasi membaca struktur pertanyaannya, menghasilkan template Excel, memvalidasi file yang telah diisi, lalu menjalankan respons uji secara terkontrol.

MVP ditujukan khusus untuk form publik yang dapat diisi berulang kali oleh pengguna yang sama. Form tidak boleh mewajibkan login dan pengaturan `Batasi ke 1 respons` harus nonaktif.

Produk ini ditujukan untuk quality assurance, pengujian validasi, dan pengujian alur formulir. Produk tidak ditujukan untuk membuat respons palsu, memanipulasi survei, melewati CAPTCHA, atau menyamar sebagai banyak responden nyata.

## 2. Masalah yang diselesaikan

Pengujian Google Form dengan banyak kombinasi jawaban saat ini membutuhkan pengisian manual yang berulang. Selain memakan waktu, proses manual mudah melewatkan kasus batas, pertanyaan wajib, pilihan tidak valid, atau percabangan antarseksi.

Pengguna membutuhkan cara untuk:

1. Mengubah struktur form menjadi template data yang mudah diisi.
2. Menyiapkan beberapa skenario pengujian di Excel.
3. Menemukan kesalahan data sebelum pengiriman.
4. Menjalankan respons uji dengan batas dan jeda yang jelas.
5. Melihat hasil setiap baris tanpa menebak apakah pengiriman berhasil.

## 3. Sasaran produk

- Menghasilkan template Excel yang sesuai dengan form dalam waktu kurang dari 30 detik untuk form sederhana.
- Mendeteksi seluruh kesalahan yang dapat diketahui sebelum proses pengiriman dimulai.
- Menampilkan status akhir untuk setiap baris: `Valid`, `Terkirim`, `Gagal`, atau `Dilewati`.
- Menjaga data pengujian di perangkat pengguna pada MVP.
- Mencegah penggunaan yang tidak disengaja terhadap form yang bukan milik atau tanggung jawab pengguna.

## 4. Bukan sasaran

- Menghasilkan identitas atau opini palsu yang dibuat agar terlihat sebagai responden nyata.
- Mengisi survei pihak lain tanpa izin.
- Melewati login, pembatasan satu respons, CAPTCHA, atau mekanisme anti-penyalahgunaan Google.
- Mendukung unggahan file pada MVP.
- Menjamin kompatibilitas jika Google mengubah antarmuka atau mekanisme pengiriman internalnya.
- Menjadi alat load testing berkapasitas tinggi.

## 5. Pengguna sasaran

### Pemilik form

Membuat form dan ingin menguji pertanyaan wajib, validasi jawaban, skala, serta pengalaman pengisian sebelum form dipublikasikan.

### Anggota tim atau QA

Memiliki izin dari pemilik form dan ingin menjalankan kumpulan kasus pengujian yang telah disiapkan di Excel.

## 6. Prinsip produk

- **Local-first:** aplikasi berjalan di `localhost` pada MVP. URL form dan isi Excel tidak dikirim ke server milik produk.
- **Tanpa OAuth pada MVP:** pengguna tidak perlu masuk dengan akun Google untuk memakai aplikasi lokal.
- **Dry-run lebih dahulu:** tombol `Jalankan` baru tersedia setelah seluruh validasi selesai.
- **Transparan:** setiap baris memiliki `Test Case ID` dan tercatat pada laporan eksekusi.
- **Dibatasi:** jumlah respons, kecepatan, dan percobaan ulang dibatasi.
- **Tidak melewati pengamanan:** form yang meminta login, CAPTCHA, atau unggahan file dihentikan dan diberi penjelasan.

## 7. Alur pengguna utama

### 7.1 Membaca form dan membuat template

1. Pengguna membuka aplikasi web lokal.
2. Pengguna menempel URL responder Google Form.
3. Pengguna menyatakan bahwa ia adalah pemilik atau memiliki izin pengujian.
4. Aplikasi memvalidasi domain dan format URL.
5. Aplikasi memeriksa bahwa form dapat dibuka tanpa login dan menerima pengisian berulang.
6. Aplikasi membaca judul, bagian, pertanyaan, tipe input, opsi, dan status wajib.
7. Aplikasi menampilkan ringkasan dukungan serta peringatan fitur yang belum didukung.
8. Pengguna mengunduh template Excel.

### 7.2 Mengunggah dan memvalidasi Excel

1. Pengguna mengisi satu baris untuk setiap kasus uji.
2. Pengguna mengunggah file Excel ke aplikasi.
3. Aplikasi memeriksa versi schema, kolom, tipe data, pilihan, batas angka, isian wajib, dan ID kasus.
4. Aplikasi menampilkan pratinjau baris dan kesalahan per sel.
5. Jika form berubah sejak template dibuat, aplikasi menghentikan proses dan menawarkan template baru.

### 7.3 Menjalankan respons uji

1. Pengguna memilih baris valid yang akan dijalankan.
2. Aplikasi menampilkan jumlah respons, estimasi waktu, jeda, dan form tujuan.
3. Pengguna memberikan konfirmasi akhir.
4. Worker mengisi form satu per satu melalui browser terkontrol.
5. Aplikasi menampilkan progres dan hasil setiap baris.
6. Pengguna mengunduh laporan hasil.

## 8. Ruang lingkup MVP

### 8.1 Tipe pertanyaan yang didukung

- Jawaban singkat.
- Paragraf.
- Pilihan ganda.
- Dropdown.
- Kotak centang tanpa opsi `Lainnya` yang membutuhkan struktur khusus.
- Skala linear.
- Tanggal dan waktu sederhana.
- Beberapa bagian yang berjalan lurus tanpa percabangan.

### 8.2 Belum didukung pada MVP

- Upload file.
- Form yang wajib login atau membatasi satu respons per akun.
- CAPTCHA.
- Grid pilihan ganda dan grid kotak centang.
- Percabangan berdasarkan jawaban.
- Quiz dengan penguncian khusus atau feedback yang memengaruhi alur.
- Form yang tidak dipublikasikan atau tidak dapat diakses dari browser pengujian.
- Jawaban yang memerlukan data sensitif atau kredensial.

### 8.3 Batas eksekusi awal

- Maksimal 25 baris per job.
- Jeda minimum 2 detik antarrespons.
- Maksimal satu job aktif per perangkat.
- Maksimal satu percobaan ulang otomatis per baris untuk kegagalan jaringan yang jelas.
- Tidak mengulang otomatis bila status pengiriman tidak pasti, untuk mencegah duplikasi.

## 9. Struktur template Excel

Workbook terdiri dari dua sheet.

### Sheet `Respons Uji`

- Kolom pertama: `Test Case ID`.
- Satu kolom untuk setiap pertanyaan yang dapat dijawab.
- Header memakai judul singkat yang unik.
- Data validation tersedia untuk pilihan, skala, tanggal, dan angka.
- Pertanyaan wajib diberi penanda visual.
- Satu baris contoh berlabel `TEST-001`.

### Sheet `_Form Schema`

- ID form dan URL responder.
- Judul form.
- Waktu pembuatan template.
- Hash atau versi schema.
- Pemetaan kolom ke question ID dan mekanisme input.
- Opsi serta aturan validasi.

Sheet schema dilindungi dari pengeditan tidak sengaja, tetapi tidak digunakan sebagai mekanisme keamanan.

## 10. Persyaratan fungsional

### FR-01 — Input URL

- Hanya menerima HTTPS dari `docs.google.com/forms`.
- Menormalisasi URL `viewform` dan menolak URL yang tidak dikenali.
- Menampilkan judul form agar pengguna dapat memverifikasi tujuan.
- Menolak form yang mengarahkan pengguna ke login atau diketahui membatasi satu respons.

### FR-02 — Pembacaan schema

- Mengambil pertanyaan sesuai urutan visual.
- Menyimpan question ID, entry ID, tipe, opsi, status wajib, bagian, dan aturan validasi.
- Menandai form yang membutuhkan login atau memiliki fitur tidak didukung.

### FR-03 — Pembuatan Excel

- Menghasilkan `.xlsx` yang dapat dibuka di Excel dan LibreOffice.
- Menghindari header duplikat dengan suffix yang stabil.
- Menanamkan schema version agar upload dapat dicocokkan dengan form asal.

### FR-04 — Upload dan validasi

- Menerima `.xlsx` dengan batas ukuran awal 10 MB.
- Menolak macro-enabled workbook pada MVP.
- Tidak mengeksekusi formula atau macro dari workbook.
- Menampilkan kesalahan dengan nomor baris, kolom, nilai, dan alasan.
- Menyediakan hasil validasi yang dapat diunduh.

### FR-05 — Dry-run

- Dry-run wajib dilakukan sebelum eksekusi.
- Dry-run tidak membuka tombol submit dan tidak mengirim respons.
- Ringkasan menampilkan jumlah baris valid, invalid, kosong, dan duplikat.

### FR-06 — Eksekusi

- Mengisi setiap baris secara berurutan.
- Mematuhi jeda dan batas job.
- Menghentikan job jika CAPTCHA, login, perubahan schema, atau pola kegagalan berulang ditemukan.
- Menyimpan screenshot kegagalan secara lokal bila pengguna mengaktifkannya.

### FR-07 — Pelaporan

- Menampilkan progres real-time.
- Menghasilkan CSV atau XLSX hasil dengan Test Case ID, waktu, status, durasi, dan pesan error.
- Tidak menyimpan isi respons lebih lama dari sesi kecuali pengguna memilih menyimpan laporan.

## 11. Persyaratan nonfungsional

- UI menggunakan Bahasa Indonesia.
- Tampilan desktop-first dan tetap dapat digunakan pada tablet.
- Proses parsing form sederhana selesai dalam target 30 detik.
- Aplikasi dapat pulih dari refresh halaman tanpa mengirim ulang baris yang sudah selesai.
- Log tidak memuat cookie, token OAuth, atau isi sensitif.
- File sementara dihapus ketika sesi selesai atau maksimal setelah 24 jam.
- Dependency dan browser automation memakai versi yang dikunci.

## 12. Arsitektur yang direkomendasikan

### MVP lokal

- **Frontend dan server lokal:** Next.js dengan TypeScript.
- **Pengolahan Excel:** ExcelJS atau SheetJS pada proses lokal.
- **Pembacaan form:** adapter schema untuk form publik melalui parser HTML yang diberi version check.
- **Eksekusi:** adapter pengiriman lokal ke endpoint responder publik. Adapter menghentikan job jika halaman konfirmasi tidak dapat dikenali.
- **Queue:** satu antrean lokal berbasis SQLite.
- **Penyimpanan:** direktori sementara lokal dan SQLite untuk status job.

### Alasan pemisahan adapter

Google Forms API resmi menyediakan operasi untuk membaca isi form serta membaca respons, tetapi dokumentasi resminya tidak menyediakan metode untuk membuat sebuah respons. MVP tanpa OAuth membaca struktur form publik dan mengirim respons menggunakan adapter endpoint responder yang tidak resmi. Mekanisme ini dapat berubah sewaktu-waktu, sehingga aplikasi memakai pemeriksaan versi dan berhenti jika halaman konfirmasi tidak dikenali. Pemisahan adapter memungkinkan parser atau executor diperbarui tanpa mengubah format workbook dan UI.

### Versi hosted di masa depan

Layanan publik baru dipertimbangkan setelah tersedia:

- Login pengguna.
- Verifikasi kepemilikan atau hak edit form melalui Google OAuth.
- Rate limit per pengguna dan per form.
- Job queue terisolasi.
- Audit log dan mekanisme pelaporan penyalahgunaan.
- Kebijakan retensi serta penghapusan data.

## 13. Model data ringkas

### FormSchema

- `formId`
- `title`
- `responderUrl`
- `schemaHash`
- `requiresLogin`
- `hasUnsupportedFeatures`
- `sections[]`
- `questions[]`

### Question

- `questionId`
- `entryId`
- `title`
- `columnKey`
- `type`
- `required`
- `options[]`
- `validationRule`
- `sectionId`

### TestJob

- `jobId`
- `formId`
- `schemaHash`
- `createdAt`
- `status`
- `rowCount`
- `delaySeconds`
- `results[]`

### RowResult

- `testCaseId`
- `rowNumber`
- `status`
- `startedAt`
- `finishedAt`
- `attemptCount`
- `errorCode`
- `message`

## 14. Keamanan dan pencegahan penyalahgunaan

- Pengguna wajib menyatakan memiliki izin sebelum schema diproses.
- MVP menambahkan dan mewajibkan `Test Case ID`; penamaan rekomendasi memakai prefix `TEST-`.
- Tidak tersedia fitur pembuatan identitas atau jawaban agar terlihat seperti responden asli.
- Tidak ada randomisasi fingerprint, proxy rotation, CAPTCHA solving, atau penyamaran browser.
- Form yang menuntut login diserahkan kepada pengguna atau dinyatakan tidak didukung; aplikasi tidak menangani kata sandi.
- Tombol eksekusi menampilkan domain, judul, jumlah baris, dan estimasi durasi sebelum konfirmasi.
- Tombol berhenti tersedia selama job berlangsung.
- Riwayat job lokal mencatat form, jumlah baris, dan hasil tanpa menyimpan kredensial.

## 15. UX awal

### Halaman 1 — Pilih form

- Input URL.
- Checkbox pernyataan izin.
- Tombol `Baca Form`.
- Kartu ringkasan form dan daftar fitur yang didukung/tidak didukung.
- Tombol `Unduh Template Excel`.

### Halaman 2 — Upload data

- Dropzone Excel.
- Ringkasan schema dan nama file.
- Tabel preview dengan filter `Semua`, `Valid`, dan `Error`.
- Panel kesalahan per sel.
- Tombol `Validasi Ulang` dan `Lanjutkan`.

### Halaman 3 — Jalankan

- Form tujuan.
- Jumlah baris dipilih.
- Input jeda dengan minimum 2 detik.
- Estimasi durasi.
- Konfirmasi akhir.
- Tombol `Jalankan` dan `Hentikan`.
- Progress bar serta tabel status per Test Case ID.

### Halaman 4 — Hasil

- Jumlah berhasil, gagal, dilewati, dan tidak pasti.
- Detail error yang dapat ditindaklanjuti.
- Tombol `Unduh Laporan`.
- Tidak ada tombol untuk mengirim ulang seluruh job secara otomatis.

## 16. Acceptance criteria MVP

1. Pengguna dapat memasukkan URL form publik yang valid dan melihat judul serta daftar pertanyaannya.
2. Aplikasi menghasilkan template dengan urutan dan aturan pilihan yang sesuai.
3. Template yang diisi dapat diunggah dan divalidasi tanpa mengirim data.
4. Perubahan form setelah template dibuat terdeteksi sebelum eksekusi.
5. Pengguna dapat menjalankan 1–25 respons uji yang valid dengan jeda minimal 2 detik.
6. Setiap baris menghasilkan status yang dapat dilacak dengan Test Case ID.
7. Job berhenti saat ditemukan login, CAPTCHA, fitur tidak didukung, atau status submit yang tidak pasti.
8. Refresh UI tidak menyebabkan respons terkirim dua kali.
9. Tidak ada file, jawaban, cookie, atau token yang keluar dari komputer pengguna pada mode lokal.

## 17. Metrik keberhasilan

- Persentase form sederhana yang berhasil diubah menjadi template.
- Persentase kesalahan input yang ditemukan sebelum eksekusi.
- Persentase baris dengan status akhir yang pasti.
- Waktu rata-rata dari input URL sampai template tersedia.
- Jumlah pengiriman duplikat; target harus nol.
- Jumlah penghentian aman karena login, CAPTCHA, atau schema berubah.

## 18. Risiko utama dan mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Google mengubah HTML atau endpoint responder | Parser atau executor berhenti bekerja | Pisahkan adapter, gunakan version check, integration test, dan fail closed |
| Status submit tidak pasti | Duplikasi respons | Jangan retry otomatis jika request mungkin sudah diterima |
| Penyalahgunaan untuk spam | Dampak ke pihak lain dan pemblokiran | Local-first, batas job, ownership attestation, Test Case ID, tanpa fitur penyamaran |
| Form berubah setelah Excel diunduh | Kolom atau jawaban salah | Simpan schema hash dan validasi ulang sebelum run |
| Data sensitif di Excel | Kebocoran data | Proses lokal, tanpa telemetry isi, hapus file sementara |
| Branching kompleks | Jawaban masuk ke bagian yang salah | Tidak didukung di MVP; deteksi dan hentikan |
| File berbahaya | Risiko pada perangkat | Tolak macro, batasi ukuran, parse tanpa mengeksekusi formula |

## 19. Tahapan pengembangan

### Fase 0 — Proof of concept

- Masukkan satu URL form publik.
- Baca tipe pertanyaan dasar.
- Buat template Excel.
- Upload dan validasi kembali.
- Jalankan satu respons uji berlabel.

### Fase 1 — MVP lokal

- UI empat langkah.
- Dukungan tipe pertanyaan MVP.
- Job 1–25 baris.
- Progress real-time dan laporan hasil.
- Deteksi schema berubah dan unsupported features.

### Fase 2 — Kepemilikan terverifikasi

- Google OAuth.
- Forms API untuk schema form yang dimiliki atau dapat diedit pengguna.
- Riwayat job lokal dan pilihan form dari akun pengguna.

Fase ini bersifat opsional dan baru diperlukan apabila produk diberikan kepada pengguna lain atau dihosting sebagai layanan.

### Fase 3 — Evaluasi hosted product

- Multi-user architecture.
- Abuse prevention, observability, retention policy, dan deployment.
- Dilakukan hanya jika kebutuhan nyata tidak dapat dipenuhi aplikasi lokal.

## 20. Keputusan yang perlu disepakati

### Sudah diputuskan

- Produk pertama berjalan lokal.
- Google OAuth tidak digunakan pada MVP.
- MVP hanya mendukung form publik yang bisa diisi berkali-kali oleh pengguna yang sama.

### Masih perlu diputuskan

1. Tipe pertanyaan mana yang paling penting setelah pilihan dasar dan skala linear?
2. Apakah pengguna membutuhkan screenshot kegagalan?
3. Apakah laporan hasil cukup CSV atau harus XLSX?
4. Apakah batas 25 respons per job sudah sesuai untuk kebutuhan QA?
5. Apakah form dengan percabangan harus ditolak seluruhnya atau didukung pada fase berikutnya?

## 21. Referensi teknis

- [Google Forms API overview](https://developers.google.com/workspace/forms/api/guides)
- [Google Forms API REST reference](https://developers.google.com/workspace/forms/api/reference/rest)
- [Google Forms responses resource](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.responses)
- [Google Forms publishing and responder settings](https://support.google.com/docs/answer/2839588)
- [Google Forms file upload and response errors](https://support.google.com/docs/answer/15473134)
