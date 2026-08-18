#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  GECE KUYRUGU — DORDUNCU YARI: "daha cok aday oynatmak KAZANDIRIYOR mu?"
#
#  Bu, aramanin CEKIRDEK VARSAYIMI ve hic mac kapisindan gecmedi. PLAN-SIRADAKI
#  E bolumundeki acik borc: tavan "kendi olcutuyle" olculmustu (rollout skoru),
#  yani dongusel. Tek durust test: LA_DERIN'i buyutup GERCEK macta kazanip
#  kazanmadigina bakmak.
#
#  NEDEN 5, 25 DEGIL: LA_DERIN=25 her karar icin 25 rollout demek (12.5x). Arama
#  turu su an 2834ms; 25'te ~35sn/tur -> tek mac ~20 dk, n=128 kapi ~3 gun.
#  LA_DERIN=5 (2.5x) ayni soruyu sorar ve gecede biter. Kazanc DOGRUSAL degilse
#  bile ISARET buradan gorunur: 2->5 hicbir sey vermiyorsa 25 de vermez.
#
#    bash tools/gece-kapi-kuyrugu-4.sh --bekle
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
LOG=qa-runtime/gece-kapi.log
mkdir -p qa-runtime

kapi() {
    ad="$1"; shift
    {
        echo ""
        echo "════════════════════════════════════════════════════════════"
        echo "### $ad   basladi $(date '+%Y-%m-%d %H:%M')"
        echo "### komut: $*"
        echo "════════════════════════════════════════════════════════════"
    } >> "$LOG"
    "$@" >> "$LOG" 2>&1
    echo "### $ad bitti $(date '+%H:%M')  (cikis $?)" >> "$LOG"
}

if [ "${1:-}" = "--bekle" ]; then
    echo "  [kuyruk-4] kuyruk-3'un BITTI damgasi bekleniyor..." >> "$LOG"
    for _i in $(seq 1 1440); do
        grep -q "=== KUYRUK-3 BITTI" "$LOG" && break
        sleep 30
    done
    echo "  [kuyruk-4] basliyor ($(date '+%H:%M'))" >> "$LOG"
fi

# H — GERCEK TAVAN: oynatilan aday sayisi 2 -> 5
kapi "H: LA_DERIN 2 vs 5 (oynatilan aday sayisi) — GERCEK TAVAN" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 100576 \
    --kol LA_DERIN --koldeger 2,5 --ayar "BATTLE_LOOKAHEAD_RED=true"

echo "=== KUYRUK-4 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
