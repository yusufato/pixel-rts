@echo off
rem ═══ KOC-IZLE — 14B koç, SON N maçini KARE-KARE 3.sahis izleyip TOPLU taktik analiz yapar ═══
rem Birkac mac oyna (her biri otomatik qa-runtime\matches\ gecmisine kaydedilir), sonra buna cift tikla.
rem Koc SON 8 maci birden okur: maç-maç ozet + ortalama + TEKRARLAYAN zaaf + en-ogretici macin kare-karesi.
rem KIRMIZI(AI) hangi hatayi SUREKLI yapiyor diye somut duzeltmeler onerir. ~2 dk (RTX 4060 GPU).
cd /d "%~dp0"
echo.
echo   KOC-IZLE — 14B kocu SON MACLARI birden izliyor (tek mac degil, DESEN)
echo   Once birkac mac oyna. Bu pencereyi KAPATMA. ~2 dk (GPU).
echo.
rem Coklu-mac gecmisi: qa-runtime\matches\ (her mac otomatik eklenir, son 8 tutulur).
rem Gecmis yoksa tek son-maca duser (geriye-uyumlu).
if exist "%CD%\qa-runtime\matches\match-*.json" (
  set "TARGET=all"
) else (
  if not exist "%CD%\qa-runtime\last-match.json" ( echo   HATA: hic mac kaydi yok. Once birkac mac oyna. & pause & exit /b )
  set "TARGET=qa-runtime/last-match.json"
)
rem GPU-offload: RTX 4060 8GB'a 14B'nin sigan katmanlarini yukler (28) → CPU'dan cok daha hizli.
rem "Failed to load"/VRAM hatasi verirse: 28 yerine dusur (orn 24).
set "ELECTRON_RUN_AS_NODE="
call npx electron . --coachwatch "%TARGET%" 28
echo.
pause
