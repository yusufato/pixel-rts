@echo off
rem ═══ KOMUTAN MODU — kirmizi AI'yi DIS-KOMUTAN (Claude) surer, sen mavi'yi oynarsin ═══
rem Oyun her ~4sn DURUR, canli sahayi qa-runtime\commander-state.json'a yazar, komutan
rem qa-runtime\commander-orders.json'a emir yazinca uygular + surer. (LLM-taktik vs kod-AI testi.)
rem Kullanim: bu .bat'a cift tikla -> Hizli Mac ac -> kirmizi komutani bekler. Claude'a "komutan basla" de.
cd /d "%~dp0"
echo.
echo   KOMUTAN MODU acik. Hizli Mac baslat; kirmizi dis-komutan bekleyecek.
echo   Bu pencereyi KAPATMA.
echo.
set "COMMANDER=1"
set "ELECTRON_RUN_AS_NODE="
call npx electron .
echo.
pause
