@echo off
rem ═══ Uzman derin-koç LLM indirici (Qwen2.5-Coder-14B, ~9GB) — Claude'dan BAĞIMSIZ ═══
rem Teknik/ML akıl-yürütme uzmanı; KOÇLUK için kullanılır (kod yazmaz). 8GB GPU + 16GB RAM'e uygun.
rem Çift tıkla, bu pencereyi KAPATMA. Kesilirse tekrar çift tıkla → kaldığı yerden devam (curl -C -).
cd /d "%~dp0"
echo.
echo   Uzman koc modeli indiriliyor: Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf (~9 GB)
echo   Bu pencereyi KAPATMA. Kesilirse tekrar calistir, kaldigi yerden devam eder.
echo.
if not exist "models" mkdir "models"
curl -L -C - --retry 999 --retry-delay 5 -o "models\Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf" "https://huggingface.co/bartowski/Qwen2.5-Coder-14B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf"
echo.
echo   ======================================================
echo   INDIRME BITTI: models\Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf
echo   Oyun models/ klasorundeki .gguf'u otomatik bulur.
echo   ======================================================
pause
