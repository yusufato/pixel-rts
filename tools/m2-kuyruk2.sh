#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  IKINCI MAKINE — 2. PARTI (ilk dort kapi bitince)
#
#  ⚠ `nohup` ILE BASLAT:
#        nohup bash tools/m2-kuyruk2.sh --bekle > /dev/null 2>&1 &
#  `--bekle` verilirse ilk kuyrugun "=== M2 KUYRUGU BITTI" damgasini bekler.
#
#  ILK PARTI (M2-1..M2-4) CYBORG'un kapilarinin TEKRARIYDI — havuzlama icin. Bu parti
#  farkli: **hic olculmemis** sorulari aliyor. Gerekce, gecenin tek tutarli bulgusu:
#  worker ana ipligi serbest biraktigi icin arama PAHALILASTIRILABILIR ve pahalilastirmak
#  KAZANDIRIYOR. Kanit zinciri:
#      LA_UFUK 100->200 : havuz n=256  +603  (taban 540)
#      LA_UFUK 200->300 : n=128        +980  (taban 810)
#      LA_DERIN 2->5    : havuz n=256  +607  (taban 540)
#      LA_PERIYOT 100->50: n=128       +808  (taban 783)
#  Buna karsilik UCUZLATMA girisimlerinin hepsi coktu (5Hz kaba adim -2390, isinlama,
#  ucuz puanlayiciyla siralama). Yani sinir hala yukarida olabilir — bu parti onu ariyor.
#
#  TOHUM HAVUZU 224000-227127 — CYBORG'unkilerle ve ilk partiyle AYRIK. Degistirme.
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
mkdir -p docs/kayit-m2
LOG=docs/kayit-m2/m2.log
TAM="BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300;LA_DERIN=5"

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
        grep -q "=== M2 KUYRUGU BITTI" "$LOG" && break
        sleep 30
    done
fi

echo "=== M2 2. PARTI BASLADI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"

# M2-5 — UFUK HALA ODUYOR MU? 100->200 ve 200->300 gecti. 300->400 de gecerse sinir
#        henuz gorunmemis demektir; gecmezse tepe noktasini bulmus oluruz. Ikisi de
#        degerli bilgi. HIC OLCULMEDI.
kapi "M2-5: LA_UFUK 300 vs 400 @ derin 5 (ufuk hala oduyor mu)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 224000 \
    --kol LA_UFUK --koldeger 300,400 --ayar "BATTLE_LOOKAHEAD_RED=true;LA_DERIN=5"

# M2-6 — ADAY SIRALAMASINI DEGER AGI MI KURSUN (CYBORG'daki C5'in TEKRARI, ayrik tohum).
#        Olculdu (55 birim-karari): ag, tam rollout'un birincisini %10.8 tutturuyor,
#        rastgele taban ~%18 — yani bu is icin bilgi tasimiyor. Kapatmak siralamayi
#        analitige dusurur VE ag cagrilarini kaldirir: gecerse KALITE ve MALIYET birden.
kapi "M2-6: LA_AG_KAPI true vs false @ tam guc (C5 tekrari)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 225000 \
    --kol LA_AG_KAPI --koldeger true,false --ayar "$TAM"

# M2-7 — ADAY GENISLIGI, SEVK EDILEN TABANDA. P2 bunu ufuk 200'de olcmustu; taban artik
#        ufuk 300 / derin 5. Halka 3->5 aday sayisini 24->40 yapar.
kapi "M2-7: LA_HALKA 3 vs 5 @ tam guc (aday genisligi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 226000 \
    --kol LA_HALKA --koldeger 3,5 --ayar "$TAM"

# M2-8 — ADAY ERISIMI. Ufuk 300 ile birim 15 saniyelik sonucu goruyor; 600px'lik bir
#        kutu icinde secim yapmak o ufku israf ediyor olabilir. HIC OLCULMEDI.
kapi "M2-8: LA_YARICAP 600 vs 900 @ tam guc (aday erisimi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 227000 \
    --kol LA_YARICAP --koldeger 600,900 --ayar "$TAM"

echo "=== M2 2. PARTI BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
