# 🌐 İnternet Üzerinden Oynama — Tek Seferlik Kurulum (~5 dk, ÜCRETSİZ)

Bir kez yap, sonsuza dek firewall-sız internetten oyna. Kredi kartı YOK.

## Adımlar (SEN yaparsın — tek seferlik)

1. **https://render.com** → **Get Started** → **GitHub ile giriş yap** (ücretsiz, kart yok).

2. Render panelinde **New +** (sağ üst) → **Blueprint**.

3. **pixel-rts** reposunu seç → **Connect** / **Apply**.
   (render.yaml otomatik okunur: ücretsiz plan + RTS_ROLE=cloud.)

4. **2-3 dakika build** bekle → durum **"Live"** olunca üstte bir adres çıkar:
   `https://pixel-rts.onrender.com` (isim farklı olabilir).
   **BU ADRESİ KAYDET / yer-imine ekle.**

## Oynamak (her seferinde)

1. Sen + arkadaşın → **aynı Render adresini** tarayıcıda açın
   (`https://pixel-rts-XXXX.onrender.com`).
2. **Çok Oyunculu → Oyun Kur** → **4 haneli kod** çıkar (örn `KXQ7`).
3. Kodu arkadaşına ver (WhatsApp vs.).
4. Arkadaşın → **Çok Oyunculu → kodu gir → Oyuna Katıl**.
5. Maç başlar. Firewall yok, IP yok, port yok. ✅

## Notlar

- **İlk açılış yavaş (~30-60 sn):** Ücretsiz sunucu 15 dk boşta kalınca uyur;
  günün ilk bağlanışında uyanması zaman alır. Maç İÇİNDE uyumaz, akıcı oynar.
- **Aynı adres = aynı sürüm:** İkiniz de oyunu Render'dan açtığınız için
  determinizm (lockstep) garanti — "SENKRON KOPTU" olmaz.
- **LAN hâlâ çalışır:** Aynı evdeyseniz `baslat.sh`/`baslat.bat` + localhost ile
  internetsiz de oynayabilirsiniz (otomatik LAN modu).
- **Güncelleme:** Oyuna kod eklediğimde GitHub'a push → Render otomatik
  yeniden deploy eder (ekstra iş yok).
