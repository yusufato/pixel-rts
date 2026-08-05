#!/bin/sh
# GECE DONGUSU: turnuva kosarken, ONUN CIKTISINDAN vekil model egitir (ekstra CPU maliyeti ~yok).
# Her tur: hasat (saniyeler) + GPU egitimi (saniyeler). Aralik uzun tutuldu ki turnuvayi rahatsiz etmesin.
cd "$(dirname "$0")/.."
LOG=qa-runtime/gece-gpu.log
echo "=== GECE GPU DONGUSU basladi $(date) ===" >> "$LOG"
while :; do
  node tools/kompozisyon-veri.js >> "$LOG" 2>&1
  echo "--- egitim $(date +%H:%M) ---" >> "$LOG"
  python tools/kompozisyon-egit-gpu.py >> "$LOG" 2>&1
  echo "" >> "$LOG"
  sleep 1800
done
