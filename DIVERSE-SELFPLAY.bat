@echo off
rem ═══ DIVERSE-SELFPLAY (r1 beyni) — Claude'dan BAGIMSIZ ═══
rem AI, SENIN taktigini (konsantre+odakli-ates) oynayan vekile karsi + varied ordularla kendini egitir.
rem Cikti: qa-runtime\selector-model-r1.json (ADAY). Oyuna GOMMEZ — sonra BEYIN-TURNUVA.bat sampiyonu secer.
rem Cift tikla, bu pencereyi KAPATMA, bilgisayar acik kalsin. ~2-3 saat.
cd /d "%~dp0"
echo.
echo   DIVERSE-SELFPLAY (r1 beyni uretiliyor) — insan-taktigi vekile karsi
echo   Bu pencereyi KAPATMA, bilgisayar acik kalsin. ~2-3 saat.
echo   Ilerleme: qa-runtime\diverse-selfplay-log.txt
echo.
set "BASH=bash"
where bash >nul 2>&1 || set "BASH=C:\Program Files\Git\bin\bash.exe"
"%BASH%" scripts/diverse-selfplay.sh 6 8
echo.
echo   ======================================================
echo   r1 HAZIR: qa-runtime\selector-model-r1.json
echo   Simdi BEYIN-TURNUVA.bat calistir (b1 vs v4 vs r1).
echo   ======================================================
pause
