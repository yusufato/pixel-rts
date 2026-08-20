#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  IKINCI MAKINE — 3. PARTI  (2026-08-20 aksami)
#
#  ⚠ ONCE GIT PULL. Bu parti GUNCEL TABANDA kosmali; taban bugun 08:02'de degisti
#     (commit 92ef7a9: LA_AG_KAPI true->false, BATTLE_MENZILE_GIR false->true).
#     Eski kodla kosarsa sonuclar CYBORG'unkilerle HAVUZLANAMAZ.
#
#  ⚠ `nohup` ILE BASLAT:
#        nohup bash tools/m2-kuyruk3.sh > /dev/null 2>&1 &
#
#  TOHUM HAVUZU 228000-229127 — CYBORG'unkilerle ve onceki M2 partileriyle AYRIK.
#  (M2 partileri 220000-227127 kullandi; CYBORG 100000-199999.)
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
mkdir -p docs/kayit-m2
LOG=docs/kayit-m2/m2-parti3.log       # ⚠ AYRI LOG: iki kuyruk ayni dosyaya yazarsa
                                      #   satirlar ic ice geciyor (11. tuzak, yasandi).
TAM="BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300;LA_DERIN=5"

kapi() {
    ad="$1"; shift
    { echo ""; echo "════════════════════════════════════════════════════════════"
      echo "### $ad   basladi $(date '+%Y-%m-%d %H:%M')"
      echo "### komut: $*"
      echo "### git: $(git rev-parse --short HEAD)"
      echo "════════════════════════════════════════════════════════════"; } >> "$LOG"
    "$@" >> "$LOG" 2>&1
    echo "### $ad bitti $(date '+%H:%M')  (cikis $?)" >> "$LOG"
}

echo "=== M2 3. PARTI BASLADI $(date '+%Y-%m-%d %H:%M')  git $(git rev-parse --short HEAD) ===" >> "$LOG"

# ─────────────────────────────────────────────────────────────────────────────
# M2-9 — TOPCU ATES DISIPLINI, GUNCEL TABANDA (T1 ile HAVUZLANMAK ICIN)
#
# CYBORG'un T1 kapisi bugun bitti: +318, std 1319, t 2.73, saptama tabani 326.
# Yani 8 PUANLA altinda kaldi — tek basina karar verdirmiyor.
# M2-4 ayni soruyu +349 vermisti AMA ESKI TABANDA (01:25'te bitti, taban 08:02'de
# degisti) — o yuzden M2-4 ile havuzlama MESRU DEGIL ve geri cekildi.
# Bu kapi ayni soruyu GUNCEL tabanda tekrar olcer; T1 ile havuzlanabilir -> n=256.
# Beklenen havuz tabani ~230-280. Iki olcum de +300 civarindaysa GECER.
# ─────────────────────────────────────────────────────────────────────────────
kapi "M2-9: BATTLE_TOPCU_DURAGAN false vs true @ tam guc (T1 havuzu, GUNCEL taban)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 228000 \
    --kol BATTLE_TOPCU_DURAGAN --koldeger false,true --ayar "$TAM"

# ─────────────────────────────────────────────────────────────────────────────
# M2-10 — IKMAL REFAKATI (yazilmis ama hic sevk edilmemis kuralin ONGORU'ye acilmasi)
#
# TESHIS (tools/topcu-bosta.js, 6 tohum / 1234 birim-ornegi, AI SALDIRAN):
#   topcu zamaninin %25.2'si CEPHANESIZ. Cephanesiz anlarda:
#     hic ikmal kalmamis %8.7 · ikmal 400px icinde %0.0 · ort. mesafe 1180px
#   Yani hayatta kalma degil, hale hizi degil: KONUM. Ikmal topcuyu takip etmiyor.
#
# ⚠ ONCE KENDI COZUMUMU YAZDIM, SONRA DEPODA ZATEN YAZILI OLANI BULDUM.
#   `_ikmalRefakat()` / pro-delta 'supplyEscort' ayni kusuru cozuyor ve pro deltasinda
#   BILE kapali (supplyEscort:false) — yani hic sevk edilmemis; ONGORU pro olmadigi icin
#   de hic kosmuyor. Ikisini ayni 6 tohumda yaristirdim:
#
#     metrik                   taban    benim(IKMAL_TAKIP)   mevcut(supplyEscort)
#     bosta orani              %54.6         %48.5                %32.9
#     CEPHANESIZ ornek           311            14                    2
#     ikmal araci olen mac       3/6           5/6                  2/6
#     cephanesizken mesafe     1180px        697px                420px
#
#   Mevcut kural HER EKSENDE yendi. Sebebi tasarimda: dolayli ateşe 3x agirlik,
#   kumeyi halenin %60'ina alma, ve TEHDIT KAPISI (PRO_SUPPLY_TEHDIT 900px — dusman
#   yakinsa ilerlemez). Benim surumumde tehdit kapisi yoktu ve ikmal ileri gidip
#   oluyordu. Kendi bayragimi SILDIM.
#
# Bu kapi mekanizma degil MAC sonucunu olcer: kazanc gercek mi, bedeli ne.
# ─────────────────────────────────────────────────────────────────────────────
kapi "M2-10: BATTLE_IKMAL_REFAKAT_INTEL4 false vs true @ tam guc" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 229000 \
    --kol BATTLE_IKMAL_REFAKAT_INTEL4 --koldeger false,true --ayar "$TAM"

echo "=== M2 3. PARTI BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
