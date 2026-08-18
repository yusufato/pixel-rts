#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  GECE KUYRUGU — UCUNCU YARI
#
#  DURUM (2026-08-18 sabaha karsi):
#    A  koruma 15 vs 0, tohum 100000+ : +486  t 2.10   (taban 648 → ALTINDA)
#    C  koruma  1 vs 0, tohum 100000+ : +552  t 2.72   (taban 568 → ALTINDA)
#    E  koruma 15 vs 0, tohum 100192+ : kosuyor (dogrulama)
#  Iki kol da POZITIF ve BIRBIRINE YAKIN. A ve C ayni tohumlari ve AYNI kontrol kolunu
#  paylasiyor → bagimsiz degiller, ustuste toplanamaz. Karar icin iki sey lazim:
#
#    F  koruma  1 vs 0, TAZE tohum (E ile ayni tohumlar) → MOVE kolunun dogrulamasi
#    G  koruma 15 vs 1, TAZE tohum                       → hangi seviye daha iyi,
#                                                          DOGRUDAN olculur (iki ayri
#                                                          kapiyi kiyaslayarak DEGIL)
#
#  G neden ayri kosulmali: A ve C'nin farki (+486 vs +552) iki AYRI olcumun farki;
#  ortak kontrol kolu yuzunden gurultuleri korelasyonlu ve fark testi gecersiz.
#  Esleştirilmis dogrudan kapi bunu cozer.
#
#    bash tools/gece-kapi-kuyrugu-3.sh --bekle
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
    echo "  [kuyruk-3] kuyruk-2'nin BITTI damgasi bekleniyor..." >> "$LOG"
    for _i in $(seq 1 1440); do
        grep -q "=== KUYRUK-2 BITTI" "$LOG" && break
        sleep 30
    done
    echo "  [kuyruk-3] basliyor ($(date '+%H:%M'))" >> "$LOG"
fi

# F — MOVE kolunun TAZE tohumla dogrulamasi (E ile AYNI tohumlar → E ile kiyaslanabilir)
kapi "F: koruma 0 vs 1 DOGRULAMA (taze tohum 100192+)" \
    node tools/rol-dengesi-paralel.js --tohum 192 --tohum0 100192 \
    --kol BATTLE_LA_EMIR_KORUMA --koldeger 0,1 --ayar "BATTLE_LOOKAHEAD_RED=true"

# G — HANGI SEVIYE? 1 vs 15 DOGRUDAN, esleştirilmis
kapi "G: koruma 1 vs 15 DOGRUDAN (taze tohum 100384+)" \
    node tools/rol-dengesi-paralel.js --tohum 192 --tohum0 100384 \
    --kol BATTLE_LA_EMIR_KORUMA --koldeger 1,15 --ayar "BATTLE_LOOKAHEAD_RED=true"

echo "=== KUYRUK-3 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
