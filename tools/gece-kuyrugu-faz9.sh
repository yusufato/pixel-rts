#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 9 — GECENIN IKI YENI ADAYI
#
#  M1b — MENZILE GIR TEKRARI (havuz icin). M1 SASIRTTI: kural saldiran icin +748
#        (t 2.73, n=128), galibiyet %50.8 -> %64.1 — saptama tabaninin (768) yalniz
#        20 ALTINDA. Yani neredeyse geciyor ve tekrar hak ediyor.
#        ⚠ NEDEN YANLIS BEKLEDIM: mekanizma kapisi M0 "sonuc kotulesiyor" diyordu
#        (marj +2071 -> -160) ve ben negatif bekledim. M0 kurali AI SAVUNURKEN olcuyor
#        (tools/menzile-gir-mekanizma.js:31 isAttacker:true -> kurali tasiyan taraf
#        savunan), M1 ise SALDIRANI. Savunanin menzile yurumesi yanlis, saldiranin
#        dogru. Mekanizma kapisi ile mac kapisi AYNI ROLU olcmeliydi.
#
#  T0/T1 — TOPCU ATES DISIPLINI (gecenin en guclu yeni teshisi).
#        Kullanicinin 4 gercek macinda AI'nin dolayli birimleri canli zamanin %42'sinde
#        HAREKET halinde, oyuncununkiler %13. Dolayli ates yururken atamaz; birim basina
#        isabet AI 23.0 · oyuncu 44.5. Menzilde gecen zaman ise ayni (%56/%60) — yani
#        konum degil, surekli yolda olmak. Yukun kaynagi arama degil KONTROLOR
#        (dolayli birim basina arama 6.1 emir, kontrolor 66.6).
#        `BATTLE_TOPCU_DURAGAN`: hedefi+muhimmati olan dolayli birim MOVE emrini yok sayar;
#        BASTIRILMISSA yok saymaz (shoot-and-scoot mesru birakildi).
#        2 tohumluk on-olcum: hareket %79.3 -> %53.5, dolayli isabet ~4x, marj +1000.
#
#    bash tools/gece-kuyrugu-faz9.sh --bekle
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
        grep -q "=== FAZ 8 BITTI" "$LOG" && break
        sleep 30
    done
fi

# M1b — MENZILE GIR tekrari, TAZE tohum (M1 ile havuzlanacak; kosullar M1 ile AYNI kalmali)
kapi "M1b: BATTLE_MENZILE_GIR DOGRULAMA (taze tohum, havuz icin)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 122000 \
    --kol BATTLE_MENZILE_GIR --koldeger false,true --ayar "BATTLE_LOOKAHEAD_RED=true"

# T0 — topcu ates disiplini MEKANIZMA (mac kapisindan ONCE)
kapi "T0: TOPCU DURAGAN mekanizma" \
    node tools/topcu-duragan-mekanizma.js --mac 6 --tohum0 130000

# T1 — topcu ates disiplini MAC KAPISI
kapi "T1: BATTLE_TOPCU_DURAGAN kapali vs acik (mac kapisi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 123000 \
    --kol BATTLE_TOPCU_DURAGAN --koldeger false,true --ayar "BATTLE_LOOKAHEAD_RED=true"

echo "=== FAZ 9 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
