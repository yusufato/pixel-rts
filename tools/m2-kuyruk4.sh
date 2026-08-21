#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  IKINCI MAKINE — 4. PARTI  (2026-08-21 aksami)
#
#  ⚠ ONCE GIT PULL. Taban bugun DEGISTI: BATTLE_TOPCU_DURAGAN sevk edildi
#     (havuz +416, n=256). Eski kodla kosarsa sonuclar CYBORG'unkiyle HAVUZLANAMAZ.
#     Basliktaki `git rev-parse` damgasi bunu sonradan tartisilmaz kilar.
#
#  ⚠ `nohup` ILE BASLAT:
#        nohup bash tools/m2-kuyruk4.sh > /dev/null 2>&1 &
#
#  TOHUM HAVUZU 231000-234127 — CYBORG'unkilerle ve onceki M2 partileriyle AYRIK.
#  (M2 partileri 220000-230127 kullandi; CYBORG 100000-199999.)
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
mkdir -p docs/kayit-m2
LOG=docs/kayit-m2/m2-parti4.log       # AYRI LOG (11. tuzak: iki kuyruk ayni loga yazinca
                                      # satirlar ic ice geciyor)
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

echo "=== M2 4. PARTI BASLADI $(date '+%Y-%m-%d %H:%M')  git $(git rev-parse --short HEAD) ===" >> "$LOG"

# ─────────────────────────────────────────────────────────────────────────────
# M2-12 ve M2-13 — GRUP ARAMASI (gunun asil sorusu), IKI AYRIK TOHUM HAVUZU
#
# Aramanin aday uzayi bugune kadar TEK BIRIMDI: 20 birim x 25 halka noktasi, her
# aday "su birim 600px oteye yurusun". Olculdu ki bu darlik uc kusurun ortak koku:
#   · kararlarin %29'unda adaylar arasi yayilim SIFIR (rollout saf israf)
#   · deger agi aday siralamada rastgeleden KOTU (%10.8 vs %18)
#   · manevra ifade edilemiyor (karsi-plan ve yerel_ustunluk somurucusu bu duvara carpti)
#
# tools/grup-yelpazesi.js ile olculdu (4 tohum, ufuk 200):
#     kip                          ort yayilim  sifir yayilim  "en iyi-kal"      t
#     BIREY (1 birim)                      165          %66.7            46   1.76
#     KUTLE (8 birim, yapay)               743          %16.7           282   3.55
#     GRUP  (gercek taskContracts)         654          %11.1           248   2.00
# Yani "iyi secim yapmanin yerinde kalmaya gore kazandirdigi" tek birimle OLCULEMIYOR,
# grup adaylariyla ANLAMLI.
#
# LA_GRUP=1: manevra karari MAIN/FIXING/FLANK gruplari icin alinir (sektor merkezleri +
# objektif + kal), ve o gruplarin uyeleri BIREY gecisinden CIKARILIR — yani ustune ekleme
# degil, ayni butceyle "hangi seviyede karar verelim".
#
# BAGLANMA TEYIT EDILDI (1 tohum, arama acik): grup karari 0 -> 13, emir 101 -> 187.
#
# IKI KAPI AYRIK TOHUMDA: CYBORG ayrica 190000 havuzunda kosuyor. Uc kapi da ayni
# tabanda oldugu icin HAVUZLANABILIR -> tek gecede n=384'e kadar cikabiliriz.
# ─────────────────────────────────────────────────────────────────────────────
kapi "M2-12: LA_GRUP 0 vs 1 @ tam guc (grup aramasi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 231000 \
    --kol LA_GRUP --koldeger 0,1 --ayar "$TAM"

kapi "M2-13: LA_GRUP 0 vs 1 @ tam guc (ikinci havuz)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 232000 \
    --kol LA_GRUP --koldeger 0,1 --ayar "$TAM"

# ─────────────────────────────────────────────────────────────────────────────
# M2-14 — DEGER AGI, GRUP ADAYLARINDA ISE YARIYOR MU?
#
# LA_AG_KAPI dun KAPATILDI ve kapatmak +897 kazandirdi (havuz n=256). Sebebi olculmustu:
# ag, tam rollout'un birincisini %10.8 tutturuyor, rastgele taban ~%18 — yani BU IS ICIN
# bilgi tasimiyor. AMA sebep aciklanmisti: "adaylar birbirinden tek bir birimin nereye
# yuruyecegi kadar farkli ve GLOBAL DURUM DEGERI o farkla degismiyor."
#
# Grup adaylarinda fark GLOBAL olcekte. Ag global durum icin egitildi ve orada IYI
# (rho 0.86). Yani ag, grup adaylarinda AYIRT EDEBILIR olabilir — bu kapi onu sorar.
# ⚠ Bu bir tahmin, kazanc vaadi degil. Ters cikarsa "ag bu is icin hic uygun degil"
#   ogrenilir ve konu kapanir.
# ─────────────────────────────────────────────────────────────────────────────
kapi "M2-14: LA_AG_KAPI false vs true @ LA_GRUP=1 (ag grup adaylarinda ise yariyor mu)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 233000 \
    --kol LA_AG_KAPI --koldeger false,true --ayar "$TAM;LA_GRUP=1"

# ─────────────────────────────────────────────────────────────────────────────
# M2-15 — IKMAL REFAKATI, HAVUZ ICIN TEKRAR
#
# M2-10 dun +149 verdi, taban 328 — altinda kaldi. Mekanizma tarafi guclu (cephanesiz
# ornek 311 -> 2, ikmal araci olen mac 3/6 -> 2/6) ama maca yansimasi olculemedi.
# Ayrik tohumda bir kez daha kosulursa M2-10 ile HAVUZLANIR (n=256, taban ~230).
# Iki olcum de +150 civarindaysa yine gecmez ve konu KAPANIR — o da bir sonuctur.
# ─────────────────────────────────────────────────────────────────────────────
kapi "M2-15: BATTLE_IKMAL_REFAKAT_INTEL4 false vs true @ tam guc (M2-10 havuzu)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 234000 \
    --kol BATTLE_IKMAL_REFAKAT_INTEL4 --koldeger false,true --ayar "$TAM"

echo "=== M2 4. PARTI BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
