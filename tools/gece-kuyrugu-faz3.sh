#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 3 — KARŞI-BATARYA (kullanıcının 4 maçından KONTROLLÜ olarak çıktı)
#
#  Üç maç AYNI tohum, AYNI AI ordusu (25 birim, 8'i tanksavar). Tek değişen oyuncunun
#  ordusu — ve sonuç onunla birlikte değişti:
#      oyuncuda dolaylı ateş YOK  → AI KAZANDI (süre doldu)
#      oyuncuda TOPÇU×3           → AI 214sn'de imha
#      oyuncuda HAVAN×3 + ÇNRA    → AI 246sn'de imha
#  AI o topçulara 214 saniyede TOPLAM 1 ATIŞ etti (%0); atışlarının %68'i ZIRHLI'ya gitti.
#  Sebep: BattleTargeting.js `hasArea` — karşı-batarya önceliği yalnız ateş eden grubun
#  KENDİSİNDE dolaylı ateş varsa uygulanıyor.
#
#  Bu bir DAVRANIŞ değişikliği (hedef önceliği), kompozisyon değil → saptama tabanı daha
#  düşük (ölçüldü: kompozisyon A/B std 3781, davranış A/B ~2600).
#
#    bash tools/gece-kuyrugu-faz3.sh --bekle
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
    echo "  [faz3] FAZ 2 BITTI damgasi bekleniyor..." >> "$LOG"
    for _i in $(seq 1 1440); do
        grep -q "=== FAZ 2 BITTI" "$LOG" && break
        sleep 30
    done
    echo "  [faz3] basliyor ($(date '+%H:%M'))" >> "$LOG"
fi

# K0 — MEKANIZMA: AI dusman topcusuna gercekten daha cok ates ediyor mu (3 dk)
kapi "K0: karsi-batarya MEKANIZMA (maviye 3 topcu zorlanir)" \
    node tools/karsi-batarya-mekanizma.js --mac 6 --tohum0 110000

# K1 — MAC KAPISI
kapi "K1: BATTLE_KARSI_BATARYA_HERKES kapali vs acik" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 111000 \
    --kol BATTLE_KARSI_BATARYA_HERKES --koldeger false,true --ayar "BATTLE_LOOKAHEAD_RED=true"

echo "=== FAZ 3 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
