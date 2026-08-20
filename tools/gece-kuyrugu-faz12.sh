#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 12 — SEVK SONRASI KALAN DORT SORU
#
#  ⭐ BU FAZ YENI TABANA KARSI OLCER. 2026-08-20'de iki kazanan SEVK EDILDI:
#      LA_AG_KAPI = false        (havuz +897, t 6.32, taban 398)
#      BATTLE_MENZILE_GIR = true (havuz +975, t 4.93, taban 554)
#  Yani asagidaki kapilar bu iki ayar ACIKKEN kosuyor — sevk edilen konfigurasyon budur.
#
#  KANITLANMIS GEREKSIZ OLDUGU ICIN CIKARILDI:
#    C2 (LA_DERIN 2 vs 5 @ ufuk 300) — makine2'nin M2-3'u cevapladi: +954 t 4.05 taban 660,
#       GECTI. Tam guc dogrulandi, tekrar israf olur.
#
#  KAPANMIS OLANLAR (tekrar edilmeyecek):
#    LA_KABA_ADIM 5Hz          : -2390 t -9.13 -> REDDEDILDI
#    LA_PERIYOT_TIK 50         : havuz -595 t -3.90 taban 427 -> REDDEDILDI (P1'in +808'i
#                                ufuk 200'e ozeldi, tam gucte TERSINE dondu)
#    BATTLE_KARSI_BATARYA_HERKES: etki yok (std 366)
#
#    bash tools/gece-kuyrugu-faz12.sh
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

echo "=== FAZ 12 BASLADI $(date '+%Y-%m-%d %H:%M') (sevk sonrasi taban) ===" >> "$LOG"

# 1) T1 — TOPCU ATES DISIPLINI. makine2'nin M2-4'u +349 verdi ama taban 521'di.
#    Bu kapi onunla HAVUZLANIP karara baglayacak. Teshis gucluydu: AI dolaylisi zamanin
#    %42'sinde HAREKET halinde (oyuncu %13), birim basina isabet 23.0 vs 44.5.
kapi "T1: BATTLE_TOPCU_DURAGAN false vs true @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 123000 \
    --kol BATTLE_TOPCU_DURAGAN --koldeger false,true --ayar "$TABAN"

# 2) U400b — UFUK 300 vs 400. makine2'nin M2-5'i +440 verdi, taban 527 — ALTINDA kaldi.
#    Havuzlanirsa "ufuk hala oduyor mu" sorusu karara baglanir. Ufuk bu projede uc kez
#    kazandi (100->200->300); tepe noktasini henuz gormedik.
kapi "U400b: LA_UFUK 300 vs 400 @ derin 5 (M2-5 tekrari, havuz icin)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 131000 \
    --kol LA_UFUK --koldeger 300,400 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_DERIN=5"

# 3) Q2 — ARAMA HAVA BIRIMLERINI KAPSASIN MI. HIC OLCULMEDI. Suzgecte `!u.isAir` vardi:
#    arama helo/SIHA/kesif-IHA'ya dokunmuyor. Helo bu projede "AI'nin 1 numarali katili"
#    olarak olculmustu (%22). KAMIKAZE haric (dalis taahhudu kendi mantiginda).
kapi "Q2: BATTLE_LA_HAVA false vs true @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 119000 \
    --kol BATTLE_LA_HAVA --koldeger false,true --ayar "$TABAN"

# 4) C1 — KADEMELI ELEME. Beklenti NEGATIF ve gerekcesi olculu: kisa rollout, tam
#    rollout'un birincisini yalnizca %47 oraninda ilk 2'de tutuyor (rastgele %36). Ayrica
#    5Hz'in -2390'i "yaklasiklikla ucuzlatma bu motorda coker" dersini verdi. Yine de
#    kalan TEK maliyet-dusurme adayi oldugu icin en sona konuldu.
kapi "C1: LA_KADEME 0 vs 60 @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 125000 \
    --kol LA_KADEME --koldeger 0,60 --ayar "$TABAN"

echo "=== FAZ 12 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
