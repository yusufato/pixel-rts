#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 11 — YENIDEN BASLATMADAN SONRA KALAN KAPILAR
#
#  NEDEN: 2026-08-20 02:00'de makine Norton kurulumu yuzunden YENIDEN BASLADI ve kuyruk
#  oldu (olay kaydi: id=6006 02:00:14, acilis 02:00:27, Norton surecleri 02:01). C2 kapisi
#  01:58'de baslamisti, iki dakika sonra gitti. node.exe karantinaya ALINMADI — sebep
#  antivirus degil, yeniden baslatma.
#
#  FAZ 10'DAN TAMAMLANANLAR (tekrar edilmeyecek):
#    C3 LA_KABA_ADIM 1/4   : -2390  t -9.13  taban 733  -> GECTI (-)  5Hz REDDEDILDI
#    C5 LA_AG_KAPI t/f     :  +812  t  3.97  taban 573  -> GECTI (+)  ag KAPATILMALI
#    C4 LA_PERIYOT 100/50  :  -508  t -2.38  taban 596  -> olculemedi (P1'in +808'i tam
#                             gucte TERSINE dondu; periyot 50 sevk EDILMEYECEK)
#
#    bash tools/gece-kuyrugu-faz11.sh
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
LOG=qa-runtime/gece-faz2.log
mkdir -p qa-runtime
TABAN="BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300;LA_DERIN=5"

kapi() {
    ad="$1"; shift
    { echo ""; echo "════════════════════════════════════════════════════════════"
      echo "### $ad   basladi $(date '+%Y-%m-%d %H:%M')"
      echo "### komut: $*"
      echo "════════════════════════════════════════════════════════════"; } >> "$LOG"
    "$@" >> "$LOG" 2>&1
    echo "### $ad bitti $(date '+%H:%M')  (cikis $?)" >> "$LOG"
}

echo "=== FAZ 11 BASLADI $(date '+%Y-%m-%d %H:%M') (yeniden baslatma sonrasi) ===" >> "$LOG"

kapi "C2b: LA_DERIN 2 vs 5 @ ufuk 300 (toplanma var mi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 124000 \
    --kol LA_DERIN --koldeger 2,5 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300"

kapi "T0: TOPCU DURAGAN mekanizma" \
    node tools/topcu-duragan-mekanizma.js --mac 6 --tohum0 130000

kapi "T1: BATTLE_TOPCU_DURAGAN kapali vs acik @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 123000 \
    --kol BATTLE_TOPCU_DURAGAN --koldeger false,true --ayar "$TABAN"

kapi "Q2: BATTLE_LA_HAVA false vs true @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 119000 \
    --kol BATTLE_LA_HAVA --koldeger false,true --ayar "$TABAN"

kapi "C1: LA_KADEME 0 vs 60 @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 125000 \
    --kol LA_KADEME --koldeger 0,60 --ayar "$TABAN"

echo "=== FAZ 11 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
