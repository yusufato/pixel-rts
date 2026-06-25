#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
#  PIXEL RTS — TEK TIKLA BAŞLAT (Linux)
#  Çift tıkla (→ "Çalıştır") ya da terminalde:  ./baslat.sh
#  Sunucuyu başlatır + oyunu tarayıcıda açar. Başka iş YOK.
# ════════════════════════════════════════════════════════════
cd "$(dirname "$(readlink -f "$0")")"
python3 baslat.py
