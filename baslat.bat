@echo off
REM ════════════════════════════════════════════════════════════
REM  PIXEL RTS — TEK TIKLA BASLAT (Windows)
REM  Cift tikla. Sunucuyu baslatir + oyunu tarayicida acar.
REM  (Python kurulu olmali: python.org > "Add to PATH" isaretli)
REM ════════════════════════════════════════════════════════════
cd /d "%~dp0"
python baslat.py 2>nul || py baslat.py
pause
