# Hafif muharebe tezgâhı (jsdom) — ölçüm kapasitesi 13 katına çıktı

Tarih: 2026-08-05 · `tools/muharebe-tezgah.js` + `tools/caprazla.js --motor tezgah`
Bağlam: [OLCUM-KRIZI-TOHUM-SAYISI.md](OLCUM-KRIZI-TOHUM-SAYISI.md) (kaç tohum gerektiği)

---

## 1. Sorun

Marj std sapması 3114 → bir karar için 12-48 tohum gerekiyor. Ama Electron tezgâhında:

| ölçüm | değer |
|---|---|
| tek başsız işçi zirve bellek | **1.83 GB** |
| her ek maçın bıraktığı | **~1.4 GB** (geri verilmiyor) |
| makinede güvenli işçi (16 çekirdek / 15.7GB) | **2-3** |
| verim | ~0.05-0.17 maç/sn |

Kullanıcının makinesi 12 işçiyle **dondu**. Chromium'un tarayıcı/GPU/renderer süreçleri
teste hiçbir şey katmıyordu: koşular zaten başsız (`SIM.headless = true`, rAF iptal).

Teşhis (`--membreak`): sayfanın JS yığını yalnız **54 MB**, canvas'lar **6 MB** —
yani **oyun kodu hafif**, şişkinlik tamamen Chromium tarafındaydı
(Browser 119MB + GPU 704MB + Tab 192MB + Utility 49MB, üstüne süreç yükü).

## 2. Çözüm

`index.html` **86 betik** yüklüyor. Muharebe için ilk **29**'u yetiyor. Tezgâh yalnız
onları saf Node + jsdom içine yükler; **yüklenmeyenler**: hikâye modu (StoryWorld, harita
rasterleri), LLM, WarRoom UI, Net/MP, Screens.

Teknik notlar:
- Oyun betikleri top-level `const`/`let` kullanıyor → `vm.runInContext` bunları bağlamın
  **sözcüksel kapsamında** oluşturur, global nesneye yazmaz. Bu yüzden maç kodu, Electron'daki
  `executeJavaScript` ile aynı mantıkla **bağlamın içinde** değerlendirilir.
- **Kendini tamamlayan DOM**: istenen id yoksa uygun türde (canvas/img/div) oluşturulup
  gövdeye eklenir. index.html'de bu düğümlerin hepsi var → null döndürmekten Electron'a
  daha yakın davranış.
- Sahte 2B bağlam (Proxy, bilinmeyen her metot no-op), `Image` anında yükleniyor,
  `fetch` reddediyor (sessiz ağ çağrısı olmasın), `localStorage` bellekte.

## 3. KABUL ÖLÇÜTÜ — geçti

Tezgâh, aynı tohumlarda Electron ile **birebir aynı** sonucu vermeli:

| | Electron | jsdom tezgâh |
|---|---|---|
| seed2024 tek maç | sav / attacker_eliminated / marj −3370 / 365sn | **aynı** |
| 12 tohum | 5/12, marj −1032 | **5/12, marj −1032** |
| 24 tohum | 10/24, marj −688 | **10/24, marj −688** |

## 4. Kazanç

| | Electron | jsdom tezgâh |
|---|---|---|
| 12 maç (tek süreç) | ~240 sn | **55 sn** |
| zirve bellek | 1.83 GB (1 maç) | **451 MB (12 maç)** |
| bellek maç sayısıyla büyüyor mu | **evet, +1.4GB/maç** | hayır |
| güvenli işçi sayısı | 2-3 | **7-10** |
| 48 maç paralel | ölçülemedi (donma riski) | **68 sn (0.71 maç/sn)** |

Kabaca **13 kat** verim. 48 tohumluk doğrulama koşuları artık dakikalar sürüyor.

## 5. Kullanım

```
# tek süreç
node tools/muharebe-tezgah.js --tarifler qa-runtime/tarifler-taban.json \
     --sal R0-attacker --sav H0-sezgisel --seeds 2024,777 --out qa-runtime/x.json

# paralel (varsayılan motor artık tezgah)
node tools/caprazla.js --tarifler qa-runtime/tarifler-taban.json \
     --sal '*' --sav H0-sezgisel --seeds 24
node tools/caprazla.js ... --disornek --seeds 48      # dışörneklem doğrulama
node tools/caprazla.js ... --motor electron           # eski yol (karşılaştırma)
```

Koşucu işçi sayısını **kullanılabilir belleğe** göre seçer, canlı gözcüyle kesilme
yapar ve kesilirse **düşen tohumları açıkça raporlar**.

## 6. İlk bilimsel sonuç

Yeni kapasiteyle FAZ 1'in ana iddiası 24 tohumda sınandı:

| hücre | sonuç |
|---|---|
| H0-sezgisel (mevcut AI) vs H0-sezgisel | 10/24, marj −688 ±1246 |
| R0-attacker (ortalanmış tarif) vs H0-sezgisel | **9/24**, marj −559 ±1045 |

İkisi de sıfırdan ve birbirinden ayırt edilemiyor. **"Kompozisyon saldıranı 0/6'dan 4/6'ya
çıkarıyor" iddiası çürüdü** — 6 tohumluk örneklemin ürettiği bir yanılsamaymış.
Bu, ölçüm krizinin bağımsız doğrulaması.

## 7. Açık kalan (ayrı iş)

Electron'da **maç başına ~1.4GB geri verilmiyor**. Tezgâhta bu yok, yani sızıntı JS
tarafında değil Chromium/Electron katmanında. Gerçek oyunda kullanıcının gördüğü
"5GB" büyük olasılıkla aynı birikim — testlerden bağımsız, ayrıca ele alınmalı.
