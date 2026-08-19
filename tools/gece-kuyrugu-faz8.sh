#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 8 — CANLI BUTCE ICIN KISILMIS DIGER IKI KNOB
#
#  GECENIN TEZI: worker ana ipligi serbest biraktigi icin, "canli butceye sigmadigi
#  ICIN kisilmis" her ayar yeniden acilabilir. LA_UFUK tam boyleydi (5sn'ye kisilmisti,
#  200'e acildi, +603 kazandirdi). Ayni gerekcenin yazili oldugu IKI knob daha var:
#
#  R1 LA_AG_ADAY (su an 5) — js/BattleLookahead.js'teki kendi yorumu diyor ki:
#       "deger agina kac adayin sorulacagi. 0 = hepsi (eski davranis, CANLI BUTCEYE
#        SIGMIYOR)". Yani eleme kalitesi bilerek dusurulmus. Daha once olculmustu:
#       "darbogaz rollout DEGIL ELEYICIYDI; ag aday basina cagriliyordu (500 CNN/tur)".
#       Worker'da o darbogaz YOK. R1 bunu 5 vs 0 (hepsi) olarak sinar.
#
#  R2 LA_YARICAP (su an 600) — aday halkasinin dis yaricapi. Ufuk 200 ile birim artik
#       10 saniyelik sonucu goruyor; 600px'lik bir kutu icinde secim yapmasi o ufku
#       israf ediyor olabilir. 600 vs 900.
#
#  Ikisi de LA_UFUK=200'de olculur (sevk edilen konfigurasyon).
#
#    bash tools/gece-kuyrugu-faz8.sh --bekle
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
LOG=qa-runtime/gece-faz2.log
mkdir -p qa-runtime

kapi() {
    ad="$1"; shift
    { echo ""; echo "════════════════════════════════════════════════════════════"
      echo "### $ad   basladi $(date '+%Y-%m-%d %H:%M')"
      echo "### komut: $*"
      echo "════════════════════════════════════════════════════════════"; } >> "$LOG"
    "$@" >> "$LOG" 2>&1
    echo "### $ad bitti $(date '+%H:%M')  (cikis $?)" >> "$LOG"
}

if [ "${1:-}" = "--bekle" ]; then
    for _i in $(seq 1 2880); do
        grep -q "=== FAZ 7 BITTI" "$LOG" && break
        sleep 30
    done
fi

# R1 — eleyici agina kac aday sorulsun: 5 (kisilmis) vs 0 (hepsi)
kapi "R1: LA_AG_ADAY 5 vs 0/hepsi @ ufuk 200" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 120000 \
    --kol LA_AG_ADAY --koldeger 5,0 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=200"

# R2 — aday halkasinin erisimi: 600 vs 900 px
kapi "R2: LA_YARICAP 600 vs 900 @ ufuk 200" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 121000 \
    --kol LA_YARICAP --koldeger 600,900 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=200"

echo "=== FAZ 8 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
