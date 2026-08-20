#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  M2-8 ARTIK KAPI — 2. partiden yarim kalan tek kapi
#
#  ⚠ `nohup` ILE BASLAT:
#        nohup bash tools/m2-m28-artik.sh > /dev/null 2>&1 &
#
#  NEDEN AYRI DOSYA: M2-8 (LA_YARICAP 600 vs 900) 2026-08-20 07:50'de basladi ve
#  08:20'de kullanici istegiyle DURDURULDU — 64 parcanin yalnizca 3'u bitmisti,
#  kismi sonuc yok. 3. parti (M2-9..M2-11) bu soruyu icermiyor, o yuzden burada.
#
#  ⚠ 3. PARTIYI BEKLER. Iki kapi ayni anda kosarsa isciler CPU/RAM icin dovusur ve
#  ikisi de yavaslar. Bekleme kosulu SUREC SAYISI DEGIL, log'daki bitis damgasidir
#  (tuzak defteri: "node sureci kalmayana kadar bekle ASLA calismaz").
#
#  ⚠ TABAN DEGISTI. M2-8 ilk kez 08:02 ONCESI tabanda baslamisti; simdi GUNCEL tabanda
#  (LA_AG_KAPI=false, BATTLE_MENZILE_GIR=true) kosuyor. Tek basina duran bir soru
#  oldugu icin havuzlama sorunu yok, ama sonuc GUNCEL taban sonucudur — eski parti
#  sonuclariyla ayni cumlede kiyaslanmamalidir.
#
#  TOHUM HAVUZU 227000-227127 — ilk denemede hicbir tohum TAMAMLANMIS sayilmadi,
#  havuz kirlenmedi, aynen yeniden kullanilabilir.
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
mkdir -p docs/kayit-m2
LOG=docs/kayit-m2/m2-m28.log          # 3. partinin log'undan AYRI (11. tuzak)
PARTI3_LOG=docs/kayit-m2/m2-parti3.log
TAM="BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300;LA_DERIN=5"

# 3. parti bitene kadar bekle (en fazla 24 saat)
for _i in $(seq 1 2880); do
    [ -f "$PARTI3_LOG" ] && grep -q "=== M2 3. PARTI BITTI" "$PARTI3_LOG" && break
    sleep 30
done

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

echo "=== M2-8 ARTIK KAPI BASLADI $(date '+%Y-%m-%d %H:%M')  git $(git rev-parse --short HEAD) ===" >> "$LOG"

kapi "M2-8: LA_YARICAP 600 vs 900 @ tam guc (aday erisimi, GUNCEL taban)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 227000 \
    --kol LA_YARICAP --koldeger 600,900 --ayar "$TAM"

echo "=== M2-8 ARTIK KAPI BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
