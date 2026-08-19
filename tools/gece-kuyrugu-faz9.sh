#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 9 — FAZ 10'DAN SONRA: tekrar + kalan iki soru
#
#  M1b  MENZILE GIR TEKRARI. M1 saldiran icin +748 verdi (t 2.73, n=128, galibiyet
#       %50.8 -> %64.1) ve saptama tabaninin (768) YALNIZ 20 ALTINDA kaldi. H3/H1'de
#       ayni desen tekrarla havuzlanip gecmisti.
#       ⚠ KOSULLAR M1 ILE AYNI KALMALI (tezgah varsayilani: ufuk 100, derin 2) — havuz
#       ancak ayni kosullarda mesrudur. Bu yuzden BU kapiya yeni taban UYGULANMAZ.
#
#  Q2   ARAMA HAVA BIRIMLERINI KAPSASIN MI (`BATTLE_LA_HAVA`). Suzgecte `!u.isAir` vardi:
#       arama helo/SIHA/kesif-IHA'ya HIC dokunmuyordu. Helo bu projede "AI'nin 1 numarali
#       katili" olarak olculmustu (%22). KAMIKAZE haric (dalis taahhudu kendi mantiginda).
#       YENI TABANDA olculur.
#
#  R1   ELEYICI AGINA KAC ADAY SORULSUN (`LA_AG_ADAY` 5 vs 0/hepsi). Knob'un kendi yorumu
#       "0 = hepsi (eski davranis, CANLI BUTCEYE SIGMIYOR)" diyordu. Profil bunu artik
#       CURUTUYOR: eleme turun yalnizca %2.9'u. Yani 5 kat daha iyi eleme ~%12 maliyete
#       mal olur — ucuz. 2 tohumluk on-olcum +1346 (gurultulu ama kapiyi hak ediyor).
#       YENI TABANDA olculur.
#
#    bash tools/gece-kuyrugu-faz9.sh --bekle
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

if [ "${1:-}" = "--bekle" ]; then
    for _i in $(seq 1 2880); do
        grep -q "=== FAZ 10 BITTI" "$LOG" && break
        sleep 30
    done
fi

# M1b — M1 ILE AYNI KOSULLARDA (yeni taban UYGULANMAZ; havuz icin sart)
kapi "M1b: BATTLE_MENZILE_GIR DOGRULAMA (M1 kosullari, havuz icin)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 122000 \
    --kol BATTLE_MENZILE_GIR --koldeger false,true --ayar "BATTLE_LOOKAHEAD_RED=true"

# Q2 — arama hava birimlerini de kapsasin mi (yeni tabanda)
kapi "Q2: BATTLE_LA_HAVA false vs true @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 119000 \
    --kol BATTLE_LA_HAVA --koldeger false,true --ayar "$TABAN"

# R1 — eleyici agina kac aday sorulsun (yeni tabanda; profil elemenin ucuz oldugunu gosterdi)
kapi "R1: LA_AG_ADAY 5 vs 0/hepsi @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 120000 \
    --kol LA_AG_ADAY --koldeger 5,0 --ayar "$TABAN"

echo "=== FAZ 9 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
