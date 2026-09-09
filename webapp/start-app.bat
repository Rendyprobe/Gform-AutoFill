@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Instal Node.js 22.13 atau lebih baru.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Memasang dependency untuk pertama kali...
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
endlocal
