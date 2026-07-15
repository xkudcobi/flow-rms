@echo off
chcp 65001 >nul
cd /d "%~dp0"
:: Uzaktan erisim kurulumu.
:: Kalici adres (token) kuracaksaniz: SAG TIK -> "Yonetici olarak calistir".
:: Windows servisi olarak kurulum yonetici yetkisi ister; hizli test icin gerekmez.
call npm run remote:setup
pause
