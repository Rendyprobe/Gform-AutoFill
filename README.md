# Otomatisasi respons uji Google Form

## Aplikasi web adaptif

Versi utama sekarang berada di folder [`webapp`](./webapp). Aplikasi membaca Google Form yang dipilih, membuat template Excel sesuai pertanyaannya, memvalidasi file yang diunggah kembali, lalu menjalankan respons uji secara bertahap.

Baca [`webapp/README.md`](./webapp/README.md) sebelum memakai aplikasi. Versi web **hanya untuk form publik satu bagian yang dapat diisi berkali-kali oleh orang yang sama**. Form dengan opsi **Batasi ke 1 respons**, login wajib, CAPTCHA, upload file, atau beberapa bagian tidak didukung.

Jalankan versi web di Windows dengan membuka `webapp/start-app.bat`, lalu buka `http://localhost:3000`.

## Skrip awal untuk form MARICYCLE

Proyek ini membaca sheet `Respons Uji` dari Excel dan memvalidasi seluruh data sebelum mengirimkannya ke Google Form. Agar hasil pengujian mudah dikenali, kolom `Nama Lengkap` wajib diawali `TEST-`.

## Cara memakai

1. Buka `outputs/gform_qa/template_respons_uji_1_contoh.xlsx` dan ganti atau tambah data uji.
2. Jalankan validasi tanpa mengirim:

   ```powershell
   .\kirim_respons_uji.ps1 -FileExcel .\outputs\gform_qa\template_respons_uji_1_contoh.xlsx
   ```

3. Jika validasi berhasil dan kamu memang berwenang menguji form, kirim respons:

   ```powershell
   .\kirim_respons_uji.ps1 -FileExcel .\outputs\gform_qa\template_respons_uji_1_contoh.xlsx -Kirim -SayaPemilik
   ```

Secara default skrip membatasi 25 respons per eksekusi dan memberi jeda 3 detik. Batas dapat diperkecil dengan `-MaksimalRespons`, sedangkan jeda dapat diubah dengan `-JedaDetik` (minimum 2 detik).

Skrip memerlukan Microsoft Excel desktop karena file `.xlsx` dibaca melalui Excel COM. Respons tidak akan dikirim jika ada pilihan atau nilai skala yang tidak sesuai dengan form.
