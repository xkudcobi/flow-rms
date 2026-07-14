@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo FLOW baslatiliyor... (Bu pencereyi acik birakin.)
echo Kapatmak icin bu pencereyi kapatin veya Ctrl+C.
echo.
call npm run start
pause
