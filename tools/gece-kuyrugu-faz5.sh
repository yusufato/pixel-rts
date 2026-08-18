#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 5 — GECENIN KAZANANINI SAGLAMLASTIR + kacan olcumleri tamamla
#
#  GECENIN SONUCU (2026-08-19 gecesi, qa-runtime/gece-faz2.log):
#    H3 UZUN UFUK (100->200 tik) : +874 t 3.13 (n=128) · dunku +357 ile HAVUZ:
#                                  +603 se 193 t 3.13 n=256 · saptama tabani 540
#                                  -> ETKI TABANIN USTUNDE ✓ KANITLANDI
#    H1 LA_DERIN (2->5)          : +656 t 2.43 (n=128) · taban 755 -> AZ ALTINDA
#    H2 yayilim kapisi gevsek    : +330 t 1.32 -> ANLAMLI DEGIL
#
#  H1 ve H3'un ikisi de aramayi PAHALILASTIRIYOR; worker onu karsilanabilir kildi.
#  Yani: worker kapasiteyi acti, KAPASITEYI KULLANMAK kazandiriyor.
#
#  ⚠ K0 (karsi-batarya mekanizma) COKTU (performAttack global degil, Unit metodu)
#  ve kuyruk mac kapisini YINE DE baslatti. Kural fiilen uygulanmiyordu.
#
#    bash tools/gece-kuyrugu-faz5.sh --bekle
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
    echo "  [faz5] onceki fazin bitmesi bekleniyor..." >> "$LOG"
    for _i in $(seq 1 1440); do
        grep -q "=== FAZ 4 BITTI" "$LOG" && break
        sleep 30
    done
fi

# U0 — UFUK 200'un BEDELI (yuk altinda x1.58 olculdu; bos makinede mutlak deger icin tekrar)
kapi "U0: ufuk maliyeti 100/200/300 (bos makinede)"     node tools/ufuk-maliyet.js --tohum 730000 --nokta 4

# K0b — COKEN mekanizma olcumu (duzeltildi: telemetri combatEvents'ten sayiyor,
#        yani kullanicinin gercek maclarinda kullandigim AYNI olcu)
kapi "K0b: karsi-batarya MEKANIZMA (duzeltilmis)" \
    node tools/karsi-batarya-mekanizma.js --mac 6 --tohum0 110000

# H1b — LA_DERIN dogrulamasi: TAZE tohum, havuz icin (656 tabanin az altindaydi)
kapi "H1b: LA_DERIN 2 vs 5 DOGRULAMA (taze tohum, havuz icin)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 114000 \
    --kol LA_DERIN --koldeger 2,5 --ayar "BATTLE_LOOKAHEAD_RED=true"

# H4 — UFUK 200 kanitlandi; DAHA UZUN daha iyi mi, yoksa tepe noktasi mi?
kapi "H4: LA_UFUK 200 vs 300 (kazanani zorla)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 115000 \
    --kol LA_UFUK --koldeger 200,300 --ayar "BATTLE_LOOKAHEAD_RED=true"

# W0 — CANLI TARAYICI KAPISI: ufuk 200 gercek Worker'da donma yaratiyor mu?
#      Tezgah gercek zaman bilmez; +603 orada olculdu. Canlida bedel donma/pencere olarak
#      cikar. Sunucu simdiye kadar ELLE baslatiliyordu (tools/kapi-sunucu.js onu kapatti),
#      bu yuzden bu kapi hic otomatik kosmamisti. En SONA konuldu: mutlak ms olcen tek
#      kapi bu, makine bos olmali.
{ echo ""; echo "════════════════════════════════════════════════════════════"
  echo "### W0: CANLI TARAYICI KAPISI (ufuk 200)   basladi $(date '+%Y-%m-%d %H:%M')"
  echo "════════════════════════════════════════════════════════════"; } >> "$LOG"
# 8123'te ZATEN bir sunucu olabilir (elle baslatilmis npx http-server). Varsa kendiminkini
# baslatmam (EADDRINUSE), yoksa baslatirim.
SUNUCU=""
if ! curl -s -o /dev/null --max-time 2 "http://localhost:8123/index.html"; then
    node tools/kapi-sunucu.js --port 8123 >> "$LOG" 2>&1 &
    SUNUCU=$!
    sleep 3
    echo "### (kapi-sunucu baslatildi, pid $SUNUCU)" >> "$LOG"
else
    echo "### (8123'te sunucu ZATEN var, yenisi baslatilmadi)" >> "$LOG"
fi
node tools/tarayici-kapi-kos.js --sure 900     --url http://localhost:8123/tools/worker-canli-kapisi.html >> "$LOG" 2>&1
echo "### W0 bitti $(date '+%H:%M')" >> "$LOG"
[ -n "$SUNUCU" ] && kill $SUNUCU 2>/dev/null

echo "=== FAZ 5 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
