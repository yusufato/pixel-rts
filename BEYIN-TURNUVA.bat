@echo off
rem ═══ BEYIN-TURNUVA — b1 (senin-adapte) vs v4 vs r1 → sampiyon = yeni beyin ═══
rem Once DIVERSE-SELFPLAY.bat calistir (r1 uretsin), sonra bunu. r1 yoksa b1 vs v4 kapisir.
rem Sampiyon: INSAN-GIBI rakibi en iyi yenen beyin. Otomatik oyuna gomulur. ~15-20 dk.
cd /d "%~dp0"
echo.
echo   BEYIN TURNUVASI — b1 vs v4 vs r1
echo   Sampiyon (insan-gibiyi en iyi yenen) otomatik oyuna gomulur. ~15-20 dk.
echo   Sonuc: qa-runtime\brain-tournament-log.txt
echo.
set "BASH=bash"
where bash >nul 2>&1 || set "BASH=C:\Program Files\Git\bin\bash.exe"
"%BASH%" scripts/brain-tournament.sh
echo.
echo   ======================================================
echo   TURNUVA BITTI. Sampiyon oyuna gomuldu.
echo   git diff js\BattleSelectorModel.js  ^|  qa-runtime\brain-tournament-log.txt
echo   ======================================================
pause
