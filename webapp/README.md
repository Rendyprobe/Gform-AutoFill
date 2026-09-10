# Gform-AutoFill

Aplikasi web lokal untuk menguji Google Form menggunakan kumpulan respons dari Excel. Aplikasi membaca struktur form, membuat template `.xlsx`, memvalidasi file yang sudah diisi, lalu mengirim respons uji satu per satu dengan jeda.

## Penting sebelum menggunakan

Aplikasi ini **hanya berfungsi untuk Google Form yang dapat diisi berkali-kali oleh orang atau perangkat yang sama**.

Pastikan pengaturan form memenuhi semua syarat berikut:

- Form sudah dipublikasikan dan bisa dibuka melalui URL responder `/viewform`.
- Form dapat dibuka tanpa login akun Google.
- Opsi **Batasi ke 1 respons** atau **Limit to 1 response** dalam keadaan nonaktif.
- Form tidak menggunakan upload file.
- Form tidak menampilkan CAPTCHA.
- Form hanya terdiri dari satu bagian. Form multi-bagian diblokir sementara sampai alurnya dapat diverifikasi dengan aman.

Jangan memakai aplikasi ini untuk form pihak lain tanpa izin, membuat respons yang disamarkan sebagai responden nyata, atau memanipulasi hasil survei. Setiap baris sebaiknya memakai `Test Case ID` dengan awalan `TEST-` agar respons pengujian mudah dikenali.

## Kebutuhan sistem

- Windows, macOS, atau Linux.
- Node.js versi 22.13 atau lebih baru.
- Koneksi internet untuk membaca dan mengirim ke Google Form.
- Browser modern seperti Chrome, Edge, atau Firefox.

Microsoft Excel tidak wajib terpasang. Template dapat diisi menggunakan Excel atau aplikasi spreadsheet lain yang mempertahankan format `.xlsx` dan sheet tersembunyi.

## Menjalankan aplikasi

### Cara cepat di Windows

Klik dua kali `start-app.bat`. Setelah alamat lokal muncul, buka:

```text
http://localhost:3000
```

### Melalui terminal

Masuk ke folder `webapp`, lalu jalankan:

```powershell
npm.cmd install
npm.cmd run dev
```

Buka `http://localhost:3000` pada browser. Untuk menghentikan aplikasi, tekan `Ctrl+C` di terminal.

Di Windows PowerShell, gunakan `npm.cmd` seperti di atas. Di macOS/Linux, gunakan `npm`.
Biarkan jendela terminal tetap terbuka selama aplikasi dipakai.

## Cara menggunakan

1. Salin URL responder Google Form yang berakhiran `/viewform`.
2. Tempel URL pada halaman **Pilih form**.
3. Centang pernyataan bahwa kamu adalah pemilik form atau memiliki izin pengujian.
4. Klik **Baca form**.
5. Periksa judul, jumlah pertanyaan, dan catatan kompatibilitas.
6. Klik **Unduh template Excel**.
7. Isi satu baris untuk setiap kasus uji pada sheet `Respons Uji`.
8. Jangan mengubah header, nama sheet, atau sheet tersembunyi `_Form Schema` dan `__Options`.
9. Unggah kembali file `.xlsx` melalui aplikasi.
10. Perbaiki semua error yang muncul sampai statusnya **Semua valid**.
11. Atur jeda antarrespons. Nilai minimum adalah 2 detik.
12. Tinjau tujuan dan jumlah respons, lalu klik **Ya, jalankan**.
13. Tunggu sampai seluruh baris memiliki status akhir.
14. Unduh laporan CSV bila diperlukan.

## Format Excel

- `Test Case ID` harus terisi dan unik pada setiap baris.
- `Test Case ID` yang sudah berhasil dikirim dalam sesi browser yang sama akan ditolak untuk mencegah pengiriman ganda. Gunakan ID baru bila memang ingin menjalankan kasus baru.
- Pertanyaan wajib ditandai dengan `*` pada header.
- Pilihan harus sama persis dengan opsi dari Google Form.
- Untuk pertanyaan kotak centang, pisahkan beberapa pilihan menggunakan karakter `|`.
- Baris yang seluruhnya kosong akan diabaikan.
- Maksimal 25 baris respons per file.
- Maksimal ukuran file 10 MB.
- Formula dan macro tidak didukung untuk data respons.

## Status hasil

- **Terkirim:** halaman konfirmasi Google berhasil dikenali.
- **Gagal:** respons ditolak sebelum atau saat pengiriman; pesan error ditampilkan.
- **Periksa manual:** permintaan mungkin sudah diterima, tetapi hasil akhirnya tidak dapat dipastikan. Job langsung dihentikan untuk mencegah duplikasi.
- **Dilewati:** baris tidak dijalankan karena pengguna menghentikan job atau respons sebelumnya berstatus tidak pasti.

Jangan langsung mengulang baris berstatus **Periksa manual**. Periksa tab Respons pada Google Form terlebih dahulu.

## Tipe pertanyaan

Didukung pada versi awal:

- Jawaban singkat.
- Paragraf.
- Pilihan ganda.
- Dropdown.
- Kotak centang.
- Skala linear.
- Rating (termasuk skala 1–10).

Belum didukung:

- Upload file.
- Form yang wajib login.
- Form satu akun satu respons.
- CAPTCHA.
- Grid pilihan ganda atau grid kotak centang.
- Tanggal dan waktu.
- Form dengan beberapa bagian, termasuk yang memiliki percabangan.
- Percabangan bagian berdasarkan jawaban.
- Form yang tidak dipublikasikan.

## Data dan privasi

File Excel dibaca di browser pada komputer pengguna. Aplikasi tidak mempunyai akun pengguna atau penyimpanan cloud. Ketika job dijalankan, nilai jawaban dikirim langsung oleh server lokal ke URL Google Form tujuan. Jangan masukkan kata sandi, token, data finansial, kesehatan, atau data pribadi sensitif sebagai data pengujian.

## Pemecahan masalah

### File BAT menutup atau muncul 'vinext' is not recognized

Dependency belum terpasang lengkap. Buka PowerShell di folder `webapp`, lalu jalankan:

```powershell
npm.cmd install
npm.cmd run dev
```

File `start-app.bat` juga akan mencoba instalasi jika peluncur `vinext.cmd` belum ada,
dan menahan jendela tetap terbuka jika aplikasi gagal agar pesan error dapat dibaca.

### Form mengarah ke login

Nonaktifkan **Batasi ke 1 respons**, koleksi email terverifikasi, atau pengaturan lain yang mewajibkan login. Jika form memang harus satu akun satu respons, form tersebut tidak cocok untuk aplikasi ini.

### Template dianggap berbeda

Struktur form berubah setelah template dibuat. Kembali ke langkah pertama, baca ulang form, lalu unduh template baru.

### Pilihan tidak valid

Pastikan tulisan di Excel sama persis dengan pilihan pada form. Cara paling aman adalah menggunakan dropdown yang tersedia di template.

### Status Periksa manual

Buka Google Form sebagai pemilik dan periksa daftar respons. Jangan menekan jalankan ulang sebelum mengetahui apakah baris tersebut sudah masuk.

### Port 3000 sudah dipakai

Hentikan aplikasi lain yang memakai port tersebut atau jalankan:

```powershell
npm run dev -- --port 3001
```

Lalu buka `http://localhost:3001`.

## Build produksi lokal

```powershell
npm run build
npm start
```

## Pemeriksaan pengembang

Sebelum menggabungkan perubahan, jalankan:

```powershell
npm run lint
npm test
npm run build
```

GitHub Actions menjalankan ketiga pemeriksaan tersebut pada setiap push dan pull request.

Versi ini dirancang untuk penggunaan lokal. Jangan mempublikasikannya sebagai layanan umum tanpa autentikasi, pembatasan penggunaan, audit log, dan perlindungan anti-penyalahgunaan tambahan.
