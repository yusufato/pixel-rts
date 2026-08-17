#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  GECE KAPI KUYRUGU — kapilari SIRAYLA kosar, sonuclari tek loga yazar.
#
#  NEDEN: her kapi ~1 saat ve tum cekirdekleri kullaniyor. Paralel kosmak isçileri
#  birbirine dusurur (RAM + CPU); sirali kosmak ve aralarda bos beklememek gerekir.
#  Bu betik uyanik biri olmadan da kuyrugu tuketir.
#
#  KOL SIRASI (onem sirasina gore):
#    B  arama YENIDEN TABAN  — mayin kusuru duzeltildikten sonra arama hala kazandiriyor mu?
#                              (+839 mayin-silen kod ile olculmustu → o sayi GUVENILMEZ)
#    C  emir omru koruma=1   — yalniz MOVE korumasi (15 riskliyse guvenli alternatif)
#    D  uzun ufuk 200 tik    — on kapiyi gecmisti (%28.6 karar degisiyor), mac kapisi yoktu
#
#    bash tools/gece-kapi-kuyrugu.sh
# ═══════════════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/.."
LOG=qa-runtime/gece-kapi.log
mkdir -p qa-runtime

kapi() {
    ad="$1"; shift
    {
        echo ""
        echo "════════════════════════════════════════════════════════════"
        echo "### $ad   basladi $(date '+%Y-%m-%d %H:%M')"
        echo "### komut: $*"
        echo "════════════════════════════════════════════════════════════"
    } >> "$LOG"
    "$@" >> "$LOG" 2>&1
    echo "### $ad bitti $(date '+%H:%M')  (cikis $?)" >> "$LOG"
}

# ── ONCEKI KOSUYU BEKLE ──────────────────────────────────────────────────
# ⚠ TUZAK (yasandi): "node islemi <= 1 olana kadar bekle" YANLIS. Bu makinede surekli
# ucu ayakta duran node islemi var (MCP sunuculari) → kosul HIC saglanmaz, kuyruk
# 6 saat bos bekler. Sayim, YALNIZ bu depodaki araclari kosan islemleri saymali.
if [ "${1:-}" = "--bekle" ]; then
    echo "  onceki kosu bekleniyor..." >> "$LOG"
    for _i in $(seq 1 720); do   # en fazla 6 saat
        n=$(powershell -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*pixel-rts*tools*' }).Count" 2>/dev/null | tr -d '\r')
        [ -z "$n" ] && n=0
        [ "$n" -le 0 ] && break
        sleep 30
    done
    echo "  ortalik bosaldi ($(date '+%H:%M')), kuyruk basliyor" >> "$LOG"
fi

echo "=== GECE KUYRUGU BASLADI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"

# B — ARAMA YENIDEN TABAN (mayin duzeltmesinden SONRA)
kapi "B: arama taban (arama kapali vs acik)" \
    node tools/rol-dengesi-paralel.js --tohum 192 \
    --kol BATTLE_LOOKAHEAD_RED --koldeger false,true

# C — EMIR OMRU, yalniz MOVE korumasi
kapi "C: emir omru koruma 0 vs 1 (yalniz MOVE)" \
    node tools/rol-dengesi-paralel.js --tohum 192 \
    --kol BATTLE_LA_EMIR_KORUMA --koldeger 0,1 --ayar "BATTLE_LOOKAHEAD_RED=true"

# D — UZUN UFUK (5sn -> 10sn). Rollout iki kat pahali → tohum sayisi dusuk tutuldu.
kapi "D: ufuk 100 vs 200 tik (5sn vs 10sn)" \
    node tools/rol-dengesi-paralel.js --tohum 128 \
    --kol LA_UFUK --koldeger 100,200 --ayar "BATTLE_LOOKAHEAD_RED=true"

echo "=== GECE KUYRUGU BITTI $(date '+%Y-%m-%d %H:%M') ===" >> "$LOG"
