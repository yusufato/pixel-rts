#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  GECE KUYRUGU — IKINCI YARI (birinci kuyruk bittikten SONRA)
#
#  E kapisi NEDEN VAR: A kapisi (koruma 15 vs 0) +486 / t 2.10 verdi ve aracin kendi
#  uyarisi "bu n ile ancak |etki| >= 648 guvenle yakalanir" dedi — yani olculen etki
#  saptama tabaninin ALTINDA. Bu projede t 2.1 tek basina karar verdirmez; onceki
#  boyle sonuclarin cogu dogrulamada COKTU (48-maclik kapilar 8x gucsuzdu).
#  E, TAZE tohumlarla (100192+) ayni kolu tekrar kosar. Birlesince n=384 → taban ±458.
#
#    bash tools/gece-kapi-kuyrugu-2.sh --bekle
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

# BEKLEME: surec SAYISINA bakmak YANLIS — kuyruk-1'in kapilari arasinda node sayisi
# bir an sifira duser ve kuyruk-2 erken baslar (iki kapi ayni anda = isçiler dovusur).
# Dogru isaret kuyruk-1'in loga yazdigi BITTI damgasi.
if [ "${1:-}" = "--bekle" ]; then
    echo "  [kuyruk-2] kuyruk-1'in BITTI damgasi bekleniyor..." >> "$LOG"
    for _i in $(seq 1 1440); do   # en fazla 12 saat
        grep -q "=== GECE KUYRUGU BITTI" "$LOG" && break
        sleep 30
    done
    echo "  [kuyruk-2] kuyruk-1 bitti, basliyor ($(date '+%H:%M'))" >> "$LOG"
fi

# E — KORUMA=15 DOGRULAMA, TAZE TOHUMLAR (A ile ORTAK TOHUM YOK)
kapi "E: emir omru koruma 0 vs 15 DOGRULAMA (taze tohum 100192+)" \
    node tools/rol-dengesi-paralel.js --tohum 192 --tohum0 100192 \
    --kol BATTLE_LA_EMIR_KORUMA --koldeger 0,15 --ayar "BATTLE_LOOKAHEAD_RED=true"

echo "=== KUYRUK-2 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
