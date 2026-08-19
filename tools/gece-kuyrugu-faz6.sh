#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 6 — "KAPASITEYI KULLAN" EKSENINI SONUNA KADAR SUR
#
#  GECENIN TEK TUTARLI BULGUSU: worker ana ipligi serbest biraktigi icin arama
#  PAHALILASTIRILABILIR hale geldi ve pahalilastirmak KAZANDIRIYOR.
#    · ufuk 100->200  : +603 (n=256, taban 540) KANITLANDI, uygulandi
#    · derin 2->5     : +656 (t 2.43, taban 755) az altinda -> faz5'te dogrulaniyor
#  Buna karsilik gecenin bes "cevre duzeltmesi" (gozcu, lojistik, emir omru, demet,
#  yayilim kapisi) HEPSI tabanin altinda kaldi. Yani kaldirac cevrede degil ARAMADA.
#
#  Bu faz o ekseni bitirir: aramanin kalan iki buyutme knob'u.
#    P1 KARAR SIKLIGI  — periyot 100 -> 50 tik (5sn'de bir yerine 2.5sn'de bir karar)
#                        (emir omru ona bagli oldugu icin DEMET olarak olculur, bkz.
#                         tools/rol-dengesi.js icindeki aciklama)
#    P2 ADAY GENISLIGI — halka 3 -> 5 (24 -> 40 aday; menzil cesitliligi)
#
#  ⚠ IKISI DE LA_UFUK=200'DE OLCULUR. Tezgahin varsayilani hala 100; oysa oyuna sevk
#  edilen deger artik 200 (H3 kanitladi). Knob'u sevk edilmeyen bir konfigurasyonda
#  olcmek YANLIS SORUYU cevaplar: "ufuk 100 iken daha sik karar vermek kazandirir mi"
#  bizi ilgilendirmiyor. (H1b bunun ISTISNASI ve oyle kalmali: o bir TEKRAR olcumu,
#  H1 ile havuzlanacak, dolayisiyla H1'in kosullariyla ayni kalmak ZORUNDA.)
#
#  ⚠ LA_HALKA `const` idi: tezgah onu DEGISTIREMIYORDU ve kapi acilsa "fark yok" diye
#  SAHTE sonuc verecekti. `let` yapildi + tezgah artik kolun uygulandigini GERI OKUYUP
#  dogruluyor (negatif kontrol: hala const olan LA_YAYILIM_ESIK ile gurultuyle dusuyor ✓).
#
#    bash tools/gece-kuyrugu-faz6.sh --bekle
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
        grep -q "=== FAZ 5 BITTI" "$LOG" && break
        sleep 30
    done
fi

# P1 — KARAR SIKLIGI: 5sn'de bir yerine 2.5sn'de bir karar
kapi "P1: LA_PERIYOT_TIK 100 vs 50 (karar sikligi, omur birlesik)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 116000 \
    --kol LA_PERIYOT_TIK --koldeger 100,50 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=200"

# P2 — ADAY GENISLIGI: halka 3 -> 5
kapi "P2: LA_HALKA 3 vs 5 (aday genisligi 24->40)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 117000 \
    --kol LA_HALKA --koldeger 3,5 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=200"

echo "=== FAZ 6 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
