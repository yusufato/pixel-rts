@echo off
rem ═══ AI'yı SANA adapte et — oyunda toplanan maçlarınla eğit (Faz 6) ═══
rem Once oyunda birkac Hizli Mac oyna ("bu mactan ogren" varsayilan ACIK, L ile kapatilir).
rem Sonra bunu cift tikla → AI senin tarzindan ogrenir + oyuna gomulur. Claude'dan bagimsiz.
cd /d "%~dp0"
echo.
echo   AI senin maclarindan ogreniyor (warm-start v4 + insan-verisi)...
echo.
set "BASH=bash"
where bash >nul 2>&1 || set "BASH=C:\Program Files\Git\bin\bash.exe"
"%BASH%" scripts/human-train.sh
echo.
pause
