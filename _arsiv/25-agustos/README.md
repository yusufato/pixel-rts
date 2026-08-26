# 25 Ağustos Arşiv Düzenlemesi

Bu klasör, aktif Electron çalışma zamanı ve paketleme girdilerinden bağımsız
olduğu kaynak taramasıyla doğrulanan eski tasarım/prototip dosyalarını tutar.
Arşivleme silme değildir; aşağıdaki eski yol eşlemesiyle geri alınabilir.

## 25 Ağustos 2026 — Harita prototipleri

| Eski yol | Arşiv yolu | Gerekçe |
|---|---|---|
| gercekci-harita.html | harita-prototipleri/gercekci-harita.html | HTML uzantılı Markdown handoff; canlı yükleyeni yok |
| yeni avrupa harita | harita-prototipleri/yeni avrupa harita | Uzantısız eski hologram handoff; canlı yükleyeni yok |
| harita-yonleri.html | harita-prototipleri/harita-yonleri.html | Paketlenmeyen görsel yön prototipi |
| hologram-harita.html | harita-prototipleri/hologram-harita.html | Paketlenmeyen görsel yön prototipi |
| Harita 2.5D.dc.html | harita-prototipleri/Harita 2.5D.webp | Gerçekte WebP ikili dosyası; yanlış HTML uzantısı düzeltildi |
| docs/harita-prototip.html | harita-prototipleri/docs-harita-prototip.html | Paketlenmeyen harita prototipi |

Metin tabanlı beş dosyaya arşiv nedeni eklendi. WebP dosyasının ikili içeriği
değiştirilmedi. Aktif index.html bu dalgaya dahil değildir: electron/main.js
onu doğrudan yükler ve package.json yeni EXE üretiminde paketler.

## Doğrulama

- Altı eski yol çalışma ağacında artık yoktur.
- Altı hedef dosya bu klasörün harita-prototipleri altındadır.
- Taşıma öncesi taramada aktif runtime veya paketleme referansı bulunmamıştır.
- Geri alma: tablodaki eşlemeyi ters yönde uygula; metin dosyalarındaki arşiv
  notlarını kaldır; WebP için eski yanlış uzantıyı yalnız gerçekten gerekiyorsa
  geri ver.

## 25 Ağustos 2026 — Yerel QA runtime yaş sınırı

- İlk taramada 4.345 üretilmiş dosya geçici olarak
  `qa-runtime-gecmis` altına taşındı.
- Kullanıcının kapsam düzeltmesiyle 10 Ağustos 2026 ve sonrası 2.981 dosya
  özgün `qa-runtime` yollarına geri alındı. Bugün üretilmiş
  `story-test-timings.json` çakışmasında aktif kopya korundu.
- 10 Ağustos 2026 öncesi 1.363 arşiv kopyası ve aktif yoldaki 4 Ağustos tarihli
  `kompozisyonlar.json` kalıcı olarak silindi.
- `qa-runtime-gecmis` artık bir arşiv hedefi değildir. Yeni kural: güncel QA
  çıktıları yerinde kalır; yaş sınırıyla silme ancak açık kullanıcı talimatıyla
  yapılır.

## 25 Ağustos 2026 — Kök eski dosyalar

| Eski yol | Arşiv yolu | Gerekçe |
|---|---|---|
| DENGE-HAM-VERI.json | kok-eski-dosyalar/DENGE-HAM-VERI.json | Yaşayan tüketicisi olmayan eski savaş denge dökümü |
| download | kok-eski-dosyalar/download.png | Uzantısız bırakılmış 1048×731 PNG; yaşayan yol referansı yok |
| icons.png.bak9 | kok-eski-dosyalar/icons.png.bak9 | Eski ikon yedeği; aktif icons.png ayrı ve paketleniyor |
| Pixel RTS.desktop | kok-eski-dosyalar/Pixel RTS.desktop | Geçersiz mutlak Linux/Firefox yoluna bağlı |
| oyunu_baslat.bat | kok-eski-dosyalar/oyunu_baslat.bat | Electron yerine eski localhost tarayıcı sunucusunu açıyor |
| create_shortcut.vbs | kok-eski-dosyalar/create_shortcut.vbs | Eski baslat.bat tarayıcı yoluna kısayol üretiyor |

Aktif index.html, icons.png, Electron giriş dosyaları, multiplayer sunucu
dosyaları ve Electron tarafından çağrılan yardımcı BAT dosyaları taşınmadı.

## 25 Ağustos 2026 — Eski eğitim scriptleri

- scripts/pick-best.sh -> eski-egitim-scriptleri/pick-best.sh
- scripts/reconcile-retrain.sh -> eski-egitim-scriptleri/reconcile-retrain.sh

İki script de package.json, kök başlatıcılar veya başka yaşayan dosyalardan
çağrılmıyordu. Eski, sabit selector-model varyant adlarıyla doğrudan aktif
BattleSelectorModel.js dosyasını yeniden yazdıkları için yanlışlıkla çalıştırılma
riskleri vardı.

## İncelendi, taşınmadı

- node_modules: 15.336 dosya / yaklaşık 3,45 GB; package-lock.json ile yeniden
  üretilebilir ve Git tarafından dışlanır. Arşive kopyalanması yalnız şişkinliktir.
- tests: 54 testin 52'si package komutlarına bağlıdır. Kalan
  story-hex-land-management ve story-visual-placement benzersiz davranış sınar
  ve tekil geçer; arşiv değil test kayıt onarımı adayıdır.
- tools: 248 araç içinde paket girişleri, test worker'ları, üretim araçları ve
  kaynak yorumlarında kanıt olarak kullanılan teşhisler vardır. Yetim görünmek
  tek başına arşiv kanıtı sayılmadı.
- M2/gece/arşiv-silme Makine 2 kayıtları ve araçları kullanıcı kararıyla aktif
  tutulur; arşiv adayı değildir.
