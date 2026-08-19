#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 7 — KANITLANMIS UFUK 200 UZERINDE IKI YENI SORU
#
#  Ikisi de LA_UFUK=200'de olculur: sevk edilen konfigurasyon artik bu. Bir knob'u
#  sevk edilmeyen konfigurasyonda olcmek yanlis soruyu cevaplar.
#
#  Q1 EMIR OMRU — YENIDEN. Emir omru daha once DORT kapida olculdu ve ispatlanamadi;
#     ama hepsi ufuk 100'de, yani ZAYIF bir aramanin emirleriyle olculdu. Mantik:
#     zayif aramanin emrini korumak degerli degildir, GUCLU aramanin emrini korumak
#     olabilir. Ufuk 200 ile arama %50 -> %63 kazandiriyor; simdi o emirlerin
#     kontrolor tarafindan ezilmesi daha pahaliya mal olabilir.
#     ⚠ Bu bir TEKRAR DEGIL, YENI kosulda YENI bir soru — eski sonucla havuzlanmaz.
#
#  Q2 HAVA BIRIMLERI — HIC DENENMEDI. `battleLookaheadTick` suzgecinde `!u.isAir`
#     vardi: arama helo/SIHA/kesif-IHA'ya HIC dokunmuyordu. Oysa bu projede helo
#     "AI'nin 1 numarali katili" olarak olculmustu (%22) ve arama zaten emirlerin
#     yalnizca %10-19'unu veriyor. Kamikaze HARIC tutuldu (dalis taahhudunu kendi
#     mantigi yonetiyor; arama ona emir verirse bilinen titreme kusuru geri gelir).
#
#    bash tools/gece-kuyrugu-faz7.sh --bekle
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
        grep -q "=== FAZ 6 BITTI" "$LOG" && break
        sleep 30
    done
fi

# Q1 — emir omru, GUCLU arama uzerinde
kapi "Q1: BATTLE_LA_EMIR_KORUMA 0 vs 15 @ ufuk 200" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 118000 \
    --kol BATTLE_LA_EMIR_KORUMA --koldeger 0,15 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=200"

# Q2 — arama hava birimlerini de kapsasin mi
kapi "Q2: BATTLE_LA_HAVA false vs true @ ufuk 200" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 119000 \
    --kol BATTLE_LA_HAVA --koldeger false,true --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=200"

echo "=== FAZ 7 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
