@echo off
rem ═══ GECE-BOYU AI EĞİTİMİ — Claude'dan BAĞIMSIZ çalışır (senin butonun) ═══
rem 8 tur birikimli DAgger-lig (~4-5 saat). Her tur modeli güçlendirir + oyuna otomatik gömer.
rem Çift tıkla, bu pencereyi KAPATMA, bilgisayar açık kalsın. Sabah: git diff js/BattleSelectorModel.js
cd /d "%~dp0"
echo.
echo   GECE-BOYU AI EGITIMI (8 tur, ~4-5 saat)
echo   Bu pencereyi KAPATMA, bilgisayar acik kalsin.
echo   Ilerleme: qa-runtime\overnight-log.txt
echo.
set "BASH=bash"
where bash >nul 2>&1 || set "BASH=C:\Program Files\Git\bin\bash.exe"
"%BASH%" scripts/ai-train-overnight.sh 8 6 3
echo.
echo   ======================================================
echo   EGITIM BITTI. Yeni model oyuna gomuldu.
echo   Sabah: git diff js\BattleSelectorModel.js  ^|  qa-runtime\overnight-log.txt
echo   ======================================================
pause
