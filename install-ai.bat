@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   FLOW - Yapay Zeka Kurulumu (opsiyonel)
echo ========================================
echo Ollama (yerel yapay zeka) kurulacak ve bir model indirilecek.
echo Model bilgisayarin RAM'ini kullanir; llama3.2 ~2GB / orta seviye PC yeterli.
echo.
echo Ollama kuruluyor (winget)...
winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
set "OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
if not exist "%OLLAMA%" (
  echo Ollama bulunamadi. Kurulum tamamlanmamis olabilir; pencereyi kapatip tekrar deneyin.
  pause
  exit /b 1
)
echo Model indiriliyor (llama3.2)... Bu biraz surebilir.
"%OLLAMA%" pull llama3.2
node scripts\enable-ai.mjs llama3.2
echo.
echo Yapay zeka hazir! Sunucuyu yeniden baslatin (start.bat).
echo (Daha guclu Turkce icin: "%OLLAMA%" pull llama3.1:8b ve enable-ai.mjs llama3.1:8b)
pause
