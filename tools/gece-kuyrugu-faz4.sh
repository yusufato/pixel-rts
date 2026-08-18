#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  FAZ 4 — MENZİLE GİR (kullanıcının 4 maçının en açıklayıcı bulgusu)
#
#  ÖLÇÜLDÜ: AI ile oyuncu neredeyse AYNI mesafede duruyor (medyan 1137-1336px vs
#  1092-1125px) ama menzile ORANI çok farklı: AI 2.17-3.09 · oyuncu 1.24-1.82.
#  Ateş edebilir konumda geçen zaman AI %12-22 · oyuncu %23-35.
#  AI'nın 20 silahlı biriminin 12'si kısa menzilli DOĞRUDAN ateş (tanksavar×8 525px,
#  piyade×4 300px) ve onları öne çeken hiçbir kural yok — `_dolayliYaklas` yalnız
#  DOLAYLI ateşe bakıyor, üstelik o da pro-kapılı.
#
#  M0 mekanizma (3 dk) · M1 maç kapısı (~45 dk). Mekanizma geçmezse M1 KOŞULMAZ.
#
#    bash tools/gece-kuyrugu-faz4.sh --bekle
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
    echo "  [faz4] FAZ 3 BITTI damgasi bekleniyor..." >> "$LOG"
    for _i in $(seq 1 1440); do
        grep -q "=== FAZ 3 BITTI" "$LOG" && break
        sleep 30
    done
    echo "  [faz4] basliyor ($(date '+%H:%M'))" >> "$LOG"
fi

kapi "M0: MENZILE GIR mekanizma" \
    node tools/menzile-gir-mekanizma.js --mac 6 --tohum0 112000

kapi "M1: BATTLE_MENZILE_GIR kapali vs acik (mac kapisi)" \
    node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 113000 \
    --kol BATTLE_MENZILE_GIR --koldeger false,true --ayar "BATTLE_LOOKAHEAD_RED=true"

echo "=== FAZ 4 BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
