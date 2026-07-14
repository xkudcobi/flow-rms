@echo off
chcp 65001 >nul
:: Bu dosyaya SAG TIKLAYIN -> "Yonetici olarak calistir"
:: Ayni agdaki tabletlerin/ekranların 3011 portuna baglanabilmesi icin gerekli.
net session >nul 2>&1
if errorlevel 1 (
  echo Bu dosyayi YONETICI olarak calistirmalisiniz.
  echo Sag tik -^> "Yonetici olarak calistir".
  pause
  exit /b 1
)
netsh advfirewall firewall add rule name="FLOW RMS 3011" dir=in action=allow protocol=TCP localport=3011
echo.
echo Guvenlik duvari kurali eklendi (TCP 3011 gelen izin).
pause
