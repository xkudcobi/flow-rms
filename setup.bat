@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   FLOW Restoran Yonetim Sistemi - Kurulum
echo ========================================
echo.
echo Bu islem birkac dakika surebilir (paketler, veritabani, derleme)...
echo.
call npm run setup
if errorlevel 1 (
  echo.
  echo HATA: Kurulum tamamlanamadi. Node.js LTS kurulu mu?  https://nodejs.org
  pause
  exit /b 1
)
echo.
echo ========================================
echo   Kurulum tamamlandi!
echo   1) (bir kez) firewall.bat - Yonetici olarak calistirin
echo   2) start.bat ile sistemi baslatin
echo ========================================
pause
