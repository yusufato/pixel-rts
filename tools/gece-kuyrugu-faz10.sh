#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 10 — "TAM GUC, MINIMUM MALIYET" KAPILARI
#
#  SEVK EDILEN TABAN: isci LA_UFUK=300, LA_DERIN=5 (ikisi de ayri ayri kapidan gecti).
#  Bu fazin isi, o tam gucu UCUZLATAN yaklasikliklarin KALITEYI BOZUP BOZMADIGINI olcmek.
#
#  MALIYET PROFILI (tools/arama-profil.js): turun %94.5'i rollout · rollout'un %72.8'i
#  unit.update + %17.9'u rakip kontroloru · eleme yalnizca %2.9. Maliyet tam olarak
#  `aday × ufuk × birim × tik`.
#
#  ⚠ HER KOL AYNI TABANA KARSI OLCULUR (tam guc, yaklasikliklar KAPALI). Yaklasikliklari
#  ust uste ekleyip tek kapidan gecirmek, hangisinin ne kattigini ayristirilamaz kilardi —
#  bu depoda "demet" ile tam bu yasandi (etkiler toplanmamisti). Gecenler benimsenir,
#  sonra BIRLESIK konfigurasyon TEK bir kapiyla dogrulanir.
#
#  C3  KABA ADIM 20Hz -> 5Hz. Olculdu: birim basina 1600 -> 400 adim (kademe kapaliyken),
#      tur 2.79x hizli. Esdegerligi kanitlandi (LA_KABA_ADIM=1 iken marj BIREBIR ayni).
#      EN BUYUK TEK TASARRUF — o yuzden ilk sirada.
#  C1  KADEMELI ELEME (5 aday 60 tik -> finalist 2 tam ufuk; "yerinde kal" elenemez).
#      Olculdu: birim basina rollout tiki 1600 -> 915.
#  C2  DERIN 5 gercekten katiyor mu? Ikisi de ayri ayri kanitlandi ama bu depoda demet
#      etkileri toplanmamisti. Katmiyorsa derin 2'ye donulur ve maliyet %60 duser.
#  T0/T1 TOPCU ATES DISIPLINI — gecenin en guclu yeni teshisi (AI dolaylisi zamanin
#      %42'sinde HAREKET halinde, oyuncununki %13; birim basina isabet 23.0 vs 44.5).
#
#    bash tools/gece-kuyrugu-faz10.sh --bekle
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
        grep -q "=== FAZ 6 BITTI" "$LOG" && break
        sleep 30
    done
fi

# C3 — 20Hz vs 5Hz rollout (en buyuk tasarruf: adim 4x az)
kapi "C3: LA_KABA_ADIM 1 vs 4 (20Hz vs 5Hz rollout) @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 126000 \
    --kol LA_KABA_ADIM --koldeger 1,4 --ayar "$TABAN"

# C5 — ADAY SIRALAMASINI DEGER AGI MI KURSUN? (kalite + maliyet ayni anda)
#      OLCULDU (tools/ucuz-puan-ongoru.js, 4 tohum / 55 birim-karari): adaylarin hangi
#      LA_DERIN tanesinin rollout'a girecegini eleyicinin siralamasi belirliyor ve o
#      siralamayi `_puan = _ag ?? _s` ile DEGER AGI kuruyor. Tam rollout'un birincisini
#      tutturma orani:  analitik %19.9 · deger agi %10.8 · rastgele taban ~%18.
#      Yani ag bu is icin rastgeleden IYI DEGIL (kotu oldugu iddiasi n=55'te anlamli
#      degil, z~-1.37 — o yuzden "iyi degil" deniyor, "kotu" degil).
#      LA_AG_KAPI=false siralamayi analitige dusurur VE ag cagrilarini tamamen kaldirir.
kapi "C5: LA_AG_KAPI true vs false (aday siralamasini ag mi kursun) @ tam guc"     node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 128000     --kol LA_AG_KAPI --koldeger true,false --ayar "$TABAN"

# C4 — KARAR SIKLIGI, tam gucte. P1 bunu ufuk 200/derin 2'de olctu ve GECTI:
#      fark (100-50) = -808, yani periyot 50 lehine +808, taban 783. Galibiyet %63.3 -> %75.0
#      (gecenin en yuksegi). AMA periyodu yariya indirmek tur sayisini IKI KATINA cikarir —
#      P1 kazancini CPU ile satin aldi. 5Hz + kademe tasarrufu tam da bunu karsilamak icin;
#      once sevk edilen tabanda dogrulanmali, sonra varsayilan cevrilir.
kapi "C4: LA_PERIYOT_TIK 100 vs 50 @ tam guc (karar sikligi)"     node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 127000     --kol LA_PERIYOT_TIK --koldeger 100,50 --ayar "$TABAN"

# C2 — derin 5, ufuk 300'un ustune katiyor mu (katmiyorsa maliyet %60 duser)
kapi "C2: LA_DERIN 2 vs 5 @ ufuk 300 (toplanma var mi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 124000 \
    --kol LA_DERIN --koldeger 2,5 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300"

# C1 — kademeli eleme kaliteyi boziyor mu
kapi "C1: LA_KADEME 0 vs 60 @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 125000 \
    --kol LA_KADEME --koldeger 0,60 --ayar "$TABAN"

# T0 — topcu ates disiplini MEKANIZMA (mac kapisindan ONCE)
kapi "T0: TOPCU DURAGAN mekanizma" \
    node tools/topcu-duragan-mekanizma.js --mac 6 --tohum0 130000

# T1 — topcu ates disiplini MAC KAPISI
kapi "T1: BATTLE_TOPCU_DURAGAN kapali vs acik @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 123000 \
    --kol BATTLE_TOPCU_DURAGAN --koldeger false,true --ayar "$TABAN"

echo "=== FAZ 10 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
