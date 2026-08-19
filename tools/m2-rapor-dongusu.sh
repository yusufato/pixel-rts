#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  M2 RAPOR DONGUSU — sonuclari kendiliginden push eder
#
#  NEDEN: kapi sonuclari `docs/kayit-m2/m2.log` dosyasina yaziliyor ama git onlari
#  kendiliginden gondermiyor. Gece boyunca VS Code kapali olacagi icin push edecek
#  kimse yok — sonuclar diskte kalir ve CYBORG havuzlama yapamaz.
#
#  Bu betik 15 dakikada bir bakar: log degistiyse commit + push eder.
#  KOSAN KUYRUKLARA DOKUNMAZ, ayri bir surectir.
#
#      nohup bash tools/m2-rapor-dongusu.sh > /dev/null 2>&1 &
#
#  ⚠ Push CAKISABILIR (iki makine ayni dala yaziyor). O yuzden once `pull --rebase`
#  denenir; yine olmazsa sessizce gecilir ve bir sonraki turda tekrar denenir —
#  sonuclar kaybolmaz, yalnizca gecikir.
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
LOG=docs/kayit-m2/m2.log

while true; do
    if [ -f "$LOG" ] && [ -n "$(git status --porcelain docs/kayit-m2/ 2>/dev/null)" ]; then
        son=$(grep -E "^### M2-.* bitti" "$LOG" 2>/dev/null | tail -1 | sed 's/^### //;s/ *(cikis.*//')
        git add docs/kayit-m2/ 2>/dev/null
        git commit -q -m "M2 otomatik rapor: ${son:-ilerleme}" 2>/dev/null
        git pull --rebase -q 2>/dev/null
        git push -q 2>/dev/null && echo "$(date '+%H:%M') push OK: ${son:-ilerleme}" >> docs/kayit-m2/rapor-dongusu.log
    fi
    sleep 900
done
