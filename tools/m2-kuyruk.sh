#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  IKINCI MAKINE KUYRUGU — dort tekrar kapisi, ayrik tohumda
#
#  ⚠ BU BETIK `nohup` ILE BASLATILMALI:
#        nohup bash tools/m2-kuyruk.sh > /dev/null 2>&1 &
#  Sebep: kapilar saatlerce koser ve VS Code kapatilinca Claude oturumu da kapanir.
#  On planda kosan komutlar o anda OLUR. `nohup ... &` ile baslatilinca surec yetim
#  kalir, isletim sistemine baglanir ve VS Code kapansa da devam eder. (CYBORG'da tam
#  bu sekilde 20+ saatlik kuyruk oturum kapanmasindan bagimsiz kosuyor.)
#
#  Kontrol: `tail -f docs/kayit-m2/m2.log`  ·  canli mi: `ps | grep node`
#
#  TOHUM HAVUZU 220000-223127 — CYBORG'unkilerle AYRIK. Degistirme; ayni tohum iki
#  makinede kosarsa havuzlama ayni maci IKI KEZ sayar ve etkiyi olduğundan guclu gosterir.
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
mkdir -p docs/kayit-m2
LOG=docs/kayit-m2/m2.log
TAM="BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300;LA_DERIN=5"

kapi() {
    ad="$1"; shift
    { echo ""; echo "════════════════════════════════════════════════════════════"
      echo "### $ad   basladi $(date '+%Y-%m-%d %H:%M')"
      echo "### komut: $*"
      echo "════════════════════════════════════════════════════════════"; } >> "$LOG"
    "$@" >> "$LOG" 2>&1
    echo "### $ad bitti $(date '+%H:%M')  (cikis $?)" >> "$LOG"
}

echo "=== M2 KUYRUGU BASLADI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"

# M2-1 — MENZILE GIR tekrari. EN KRITIK: CYBORG'da M1 +748 verdi, taban 768 idi;
#        yalnizca 20 birim altinda kaldi. Havuzlama bunu karara baglar.
#        ⚠ TAM GUC AYARI YOK — M1 tezgah varsayilaninda kosuldu (ufuk 100 / derin 2) ve
#        havuz ancak AYNI kosullarda mesrudur. Buraya LA_UFUK/LA_DERIN EKLEME.
kapi "M2-1: BATTLE_MENZILE_GIR false vs true (M1 tekrari, havuz icin)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 220000 \
    --kol BATTLE_MENZILE_GIR --koldeger false,true --ayar "BATTLE_LOOKAHEAD_RED=true"

# M2-2 — KARAR SIKLIGI @ tam guc. CYBORG'da P1 ufuk 200'de GECTI (+808, galibiyet
#        %63.3 -> %75.0). Sevk edilen tabanda dogrulanmali.
kapi "M2-2: LA_PERIYOT_TIK 100 vs 50 @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 221000 \
    --kol LA_PERIYOT_TIK --koldeger 100,50 --ayar "$TAM"

# M2-3 — DERIN 5, ufuk 300'un ustune katiyor mu (toplanma). Katmiyorsa derin 2'ye
#        donulur ve maliyet %60 duser.
kapi "M2-3: LA_DERIN 2 vs 5 @ ufuk 300" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 222000 \
    --kol LA_DERIN --koldeger 2,5 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300"

# M2-4 — TOPCU ATES DISIPLINI. Kullanicinin 4 gercek macindan teshis: AI'nin dolayli
#        birimleri zamanin %42'sinde HAREKET halinde (oyuncununki %13), birim basina
#        isabet 23.0 vs 44.5.
kapi "M2-4: BATTLE_TOPCU_DURAGAN false vs true @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 223000 \
    --kol BATTLE_TOPCU_DURAGAN --koldeger false,true --ayar "$TAM"

echo "=== M2 KUYRUGU BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
