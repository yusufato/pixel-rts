@echo off
echo ==================================================
echo Pixel RTS - Oyun Sunucusu Baslatiliyor...
echo ==================================================
echo.
echo Tarayici penceresi otomatik olarak acilacaktir...
echo (Bu siyah pencereyi oyunu oynadiginiz surece kapatmayin)
echo.

:: Tarayıcıyı başlat (Sunucunun ayaklanması için 1 saniye bekleme payı ile)
start http://127.0.0.1:8080

:: http-server kullanarak klasörü localhost'ta yayınla (önbelleksiz)
call npx --yes http-server -p 8080 -c-1 -a 127.0.0.1
pause
