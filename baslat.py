#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  PIXEL RTS — TEK TIKLA BAŞLAT
#  Sunucuyu başlatır + oyunu tarayıcıda otomatik açar. Terminal işi YOK.
#  Çalıştır:  python3 baslat.py   (ya da çift-tık: baslat.sh / baslat.bat)
# ════════════════════════════════════════════════════════════════════
import os, sys, time, socket, threading, subprocess, webbrowser

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 8080
URL = "http://localhost:%d" % PORT

def port_open(p):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.settimeout(0.4)
    try:
        s.connect(("127.0.0.1", p)); return True
    except Exception:
        return False
    finally:
        s.close()

def open_browser_when_ready():
    # sunucu ayağa kalkana kadar bekle (en çok ~10sn), sonra tarayıcıyı aç
    for _ in range(40):
        if port_open(PORT):
            break
        time.sleep(0.25)
    webbrowser.open(URL)

# Sunucu zaten çalışıyorsa ikinciyi başlatma — sadece oyunu aç
if port_open(PORT):
    print("✓ Sunucu zaten çalışıyor. Oyun açılıyor: " + URL)
    webbrowser.open(URL)
    sys.exit(0)

print("═" * 56)
print("  PIXEL RTS — başlatılıyor...")
print("  Oyun birazdan tarayıcıda açılacak: " + URL)
print("  KAPATMAK için bu pencereyi kapat (ya da Ctrl+C).")
print("═" * 56)
threading.Thread(target=open_browser_when_ready, daemon=True).start()
try:
    subprocess.run([sys.executable, os.path.join(os.getcwd(), "mp_server.py")])
except KeyboardInterrupt:
    print("\nKapatıldı.")
