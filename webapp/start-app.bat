@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Instal Node.js 22.13 atau lebih baru.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm belum tersedia. Instal ulang Node.js dengan npm, lalu buka kembali file ini.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vinext.cmd" (
  echo Memasang dependency yang belum lengkap...
  call npm.cmd install
  if errorlevel 1 (
    echo Instalasi gagal. Periksa koneksi internet dan pesan error di atas.
    pause
    exit /b 1
  )
)

echo.
echo Gform-AutoFill akan tersedia di http://localhost:3000
echo Tekan Ctrl+C untuk menghentikan aplikasi.
echo.
call npm.cmd run dev
if errorlevel 1 (
  echo.
  echo Aplikasi gagal dijalankan. Periksa pesan error di atas.
  echo Untuk memperbaiki dependency, jalankan npm.cmd install di folder webapp.
  pause
  exit /b 1
)
endlocal
