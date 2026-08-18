#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 2 — ARAMANIN KAPASİTESİ
#
#  GEREKÇE: kanıtlanmış TEK kaldıraç arama (+833, t 4.34, n=216). Diğer her şey
#  300-500 bandında ve tabanın altında kaldı — demet kapısı da (+306, t 0.79) etkilerin
#  TOPLANMADIĞINI gösterdi, yani o üçü büyük olasılıkla gürültüydü.
#
#  Bu gece iki soru, ikisi de "arama iyi ama KISIK mı koşuyor":
#    H1  LA_DERIN 2 vs 5   — daha çok aday oynatmak kazandırıyor mu (ÇEKİRDEK VARSAYIM,
#                            hiç maç kapısından geçmedi)
#    H2  LA_KAPI_CARPAN 1 vs 0.25 — yayılım kapısı birimlerin %65'ini eliyor (ölçüldü:
#                            aranan 33 / atlanan 61). Gevşetince kazanıyor mu?
#
#  ⚠ Kapı sırası LOG DAMGASIYLA (süreç sayısıyla DEĞİL — o yöntem bir gece boşa bekletti).
#  ⚠ js/ dosyaları bu kuyruk koşarken DEĞİŞTİRİLMEZ.
#
#    bash tools/gece-kuyrugu-faz2.sh
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

echo "=== FAZ 2 BASLADI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"

# H1 — CEKIRDEK VARSAYIM: daha cok aday oynatmak kazandiriyor mu
kapi "H1: LA_DERIN 2 vs 5 (oynatilan aday sayisi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 107000 \
    --kol LA_DERIN --koldeger 2,5 --ayar "BATTLE_LOOKAHEAD_RED=true"

# H2 — YAYILIM KAPISI: %65 eleme fazla mi
kapi "H2: LA_KAPI_CARPAN 1 vs 0.25 (yayilim kapisi gevsek)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 108000 \
    --kol LA_KAPI_CARPAN --koldeger 1,0.25 --ayar "BATTLE_LOOKAHEAD_RED=true"

# H3 — UZUN UFUK: onceki +357 (n=128) tabanin altindaydi; taze tohumla havuzlanacak
kapi "H3: LA_UFUK 100 vs 200 (taze tohum, havuz icin)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 109000 \
    --kol LA_UFUK --koldeger 100,200 --ayar "BATTLE_LOOKAHEAD_RED=true"

echo "=== FAZ 2 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
