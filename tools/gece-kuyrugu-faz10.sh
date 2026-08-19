#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 10 — TAM GUC + MINIMUM MALIYET (kullanici karari 2026-08-19)
#
#  YENI TABAN: isci artik LA_UFUK=300, LA_DERIN=5. Ikisi de AYRI AYRI kapidan gecti:
#    LA_UFUK 100->200 : havuz n=256  +603  t 3.13  taban 540
#    LA_UFUK 200->300 : n=128        +980  t 3.39  taban 810
#    LA_DERIN 2->5    : havuz n=256  +607  t 3.15  taban 540
#  FAZ 7/8/9 IPTAL EDILDI: hepsi ufuk 200 / derin 2 tabaninda olcecekti, yani artik
#  SEVK EDILMEYEN bir konfigurasyonda (docs/OLCUM-TUZAKLARI.md, 6. tuzak).
#
#  MALIYET PROFILI OLCULDU (tools/arama-profil.js):
#    tur suresinin %94.5'i rollout · rollout'un %72.8'i unit.update + %17.9'u rakip
#    kontroloru · eleyici agi yalnizca %2.9 (eski kisitli ayarda darbogaz OYDU, artik degil).
#    Maliyet tam olarak `aday × ufuk × birim`. Tam guc = birim basina 1500 tik.
#
#  C2 — TOPLANMA VAR MI? derin 5, ufuk 300'UN USTUNE bir sey katiyor mu? Ikisi de ayri
#       ayri kanitlandi ama bu depoda DEMET etkileri toplanmamisti. Katmiyorsa derin 2'ye
#       donulur ve maliyet %60 duser — en buyuk tek tasarruf firsati bu.
#  C1 — KADEMELI ELEME kaliteyi bozuyor mu? 5 adayi 60 tik oynat, finalist 2'sini 300'e
#       tamamla ("yerinde kal" hep finalist). Olculdu: birim basina rollout tiki
#       1600 -> 915 (%43 az). Kayipsizsa tam guc %43 ucuzlar.
#  T0/T1 — TOPCU ATES DISIPLINI (gecenin en guclu yeni teshisi; gerekce faz9 basliginda).
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

# C2 — derin 5, ufuk 300'un ustune katiyor mu? (katmiyorsa maliyet %60 duser)
kapi "C2: LA_DERIN 2 vs 5 @ ufuk 300 (toplanma var mi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 124000 \
    --kol LA_DERIN --koldeger 2,5 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300"

# C1 — kademeli eleme kaliteyi bozuyor mu? (bozmuyorsa tam guc %43 ucuzlar)
kapi "C1: LA_KADEME 0 vs 60 @ tam guc (ucuzlatma bedava mi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 125000 \
    --kol LA_KADEME --koldeger 0,60 --ayar "$TABAN"

# T0 — topcu ates disiplini MEKANIZMA (mac kapisindan ONCE)
kapi "T0: TOPCU DURAGAN mekanizma" \
    node tools/topcu-duragan-mekanizma.js --mac 6 --tohum0 130000

# T1 — topcu ates disiplini MAC KAPISI, yeni tabanda
kapi "T1: BATTLE_TOPCU_DURAGAN kapali vs acik @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 123000 \
    --kol BATTLE_TOPCU_DURAGAN --koldeger false,true --ayar "$TABAN"

echo "=== FAZ 10 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
