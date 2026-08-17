# SIRADAKİ İŞLER — bağımlılıklarıyla

Kullanıcı uyarısı: *"planlar birikiyor."* Bu projede plan bayatlığı kayıtlı bir hata
sınıfı, o yüzden liste **ölçüm durumu** ve **bağımlılık** ile birlikte tutulur.
Damgasız satır yoktur: her iş ya ÖLÇÜLDÜ, ya ÖN KAPIYI GEÇTİ, ya HENÜZ SINANMADI.

---

## Bugün kurulan ölçüm disiplini (her iş buradan geçer)

```
1. tasarım değişikliği       dakikalar
2. "karar değişti mi?"       3-5 dk    ← tools/karar-degisti-mi.js  YENİ
3. mekanizma metriği         saniyeler (GPU: ρ, sıralama doğruluğu)
4. maç kapısı                1 saat    ← yalnız 2 ve 3'ü geçenler
```

**Neden 2. adım şart:** maç marjı std ≈ 2611 ve eşleştirme varyansın yalnız %17'sini
alıyor (simülasyon kaotik). +400'lük etki için n≈485 gerekiyor — maç kapısı
ucuzlatılamaz, ama **kapıya giren aday sayısı** ucuzlatılabilir.
Ölçülen tasarruf: çok kanallı puanlama kararların %2'sini değiştiriyor → 3,4 dakikada
elendi; ben onu bir saatlik kapıya sokmuştum.

---

## A · BİTTİ — sonuç aşağıda (⛔ KAPANDI bölümü)

| iş | durum |
|---|---|
| Birim-koşullu değer ağı verisi | ✔ 42 maç, 24.480 karar, 121.331 aday |
| → eğit + **karar içi sıralama** kapısı | ✔ 4 formülasyon, hepsi taban altı |
| Bedava etiket verisi | ✔ 540 maç, 626 bin etiket, 20 dk |
| → eğit + aynı kapı | ✔ %25.5 vs taban %50.2 |

---

## B · ÖN KAPIYI GEÇMİŞ, MAÇ KAPISI BEKLİYOR

| iş | ön kapı | neden önemli |
|---|---|---|
| **Emir ömrü** (`_laUntilTick` bağla) | — | emirlerin %50'si 1 saniyede eziliyor; +839 bu israfla elde edilmiş |
| **10-15sn ufuk** | %28,6 karar değişti | ufku KISALTMAK ölçülüp öldürülmüş, UZATMAK hiç denenmemiş |

⚠ Emir ömrü için uyarı: ezmenin meşru sebepleri olabilir (düşman belirdi). Zorla
tutturmak birimi öldürebilir. Ölçülmeden bağlanmaz.

---

## C · ÖLÇÜLDÜ, ELENDİ (tekrar açılmasın)

| iş | sonuç |
|---|---|
| Politika damıtma (R1) | öğretmen +839 çalışıyor, öğrenci +143 t 0.56 → damıtma değeri kaybetti |
| 25×25 ortak ışınlama | rollout'la %43 vs tek taraflı %44, z −0.28 → sinyal YOK |
| Çok kanallı puanlama | kararların %2'si değişiyor → maç etkisi beklenemez |
| Değer ağını büyütmek | ×1 ρ 0.408 · ×2 0.414 · ×4 **0.385** → sınır kapasite değil SİNYAL |
| Canlı ayar (kısılmış arama) | n=512'de +203 t 1.51 → ispatlanmadı, etiket geri çekildi |

---

## ⛔ KAPANDI — "değerlendirme, simülasyonun yerine geçebilir" (2026-08-17)

Bu, GPU yolunun dayandığı varsayımdı. **Beş formülasyon, iki veri seti, 5× ölçekleme —
hepsi düştü.** Ölçü: rollout veri setinde karar-içi sıralama.

| yöntem | sıralama |
|---|---:|
| rastgele | %20.2 |
| **bugünkü eleyici (`_ag`)** | **%50.2** |
| MSE, ham hedef | %21.5 |
| MSE, karar-içi merkezlenmiş | %21.2 |
| listewise softmax + CE | %28.8 |
| artık bağlantı (eleyicinin üstüne, başlangıçta = taban) | %29.7 |
| bedava etiket ağı (313 bin örnek, 5× veri) | %25.5 |

### Neden — ve bu bir tasarım hatası değil

`_ag`'yi "bir öznitelik" sanmıştım. Değil: **birimi aday noktaya taşıyıp değer ağını
yeniden çalıştırıyor.** Tahmin etmiyor, HESAPLIYOR — raster gerçekten değişiyor.
Eğittiğim ağlar ise zaten ucuz olan (7.87ms) bir hesabın çıktısını tahmin etmeye
çalışıyordu; kazanacak bir şey yok.

Asıl istenen, rollout'un eleyiciye yaptığı **düzeltme**ydi ("ışınlanmış birim ≠ yürüyen
birim"). O fark durum özniteliklerinden **öğrenilebilir değil**.

### Sonucu

- **GPU'nun 1600× çarpanı simülasyon satın alamaz** — artık ölçülmüş, varsayım değil.
  WebGPU portu haftalar sürecekti ve yanlış cevabı hızlandıracaktı.
- GPU'nun KALAN gerekçesi yalnız eleyicinin kendi maliyeti (`LA_AG_ADAY=0`'a dönmek) —
  daha küçük ve bağımsız ölçüm ister.
- **"Veri az" teşhisi de çürüdü:** 33 maçtan 540 maça, 121 binden 626 bin örneğe
  çıkıldı, hiçbir şey değişmedi. Kısıt veri değil, hedefin öğrenilebilirliği.

---

## D · BEDAVA ETİKET — kuruldu, kullanıldı, sonuç yukarıda

**Her gerçek maç zaten bir rollout.** Şu an her etiket için fork alıp 5 saniye simüle
ediyoruz; oysa gerçek maçta o 5 saniye zaten oynanıyor.

| | aramalı toplama | bedava etiket |
|---|---:|---:|
| maç maliyeti | ~85sn CPU | **~10sn** |
| 8 işçiyle 1000 maç | ~3 saat | **~20 dk** |
| toplam etiket | ~100 bin | **~3,2 milyon** |

Atıf sorunu kredi defteriyle çözülüyor: her birimin **kendi** ürettiği ayrı tutuluyor.

**Tuzak:** karşı-olgusal yok (yalnız gidilen yerler görülüyor) → dağılım kayması.
Çözüm: toplamada keşif gürültüsü.

**SONUÇ:** 540 maç, 626 bin etiket, 20 dakikada toplandı (aramalı toplamanın 5 katı veri,
1/3 sürede). Ama karar-içi sıralamada %25.5 — tabanın 25 puan altında.
Hat çalışıyor ve tekrar kullanılabilir; ama bu hedef için yetmedi.

⚠ Etiket seyrek: birimin kendi kredi hanesi 10 saniyede %83 oranında hiç değişmiyor.

---

## E · AÇIK BORÇ / DÖNGÜSELLİK

**Tavan ölçümü kendi ölçütüyle ölçülüyor.** "Masada 60,6 var" derken, kusurlu olduğunu
zaten ölçtüğümüz bir skora göre söylüyoruz. Aramanın onu maksimize etmesi +839
kazandırıyor, yani skor çöp değil — ama "4 katı masada" iddiası doğrusallık varsayıyor.

**Dürüst testi:** 25 adayın hepsini oynatan arama, GERÇEK maçta 2 oynatandan çok mu
kazanıyor? Tam ayarda ~25 saat; kısa maçlarla (120sn) 8 işçide **~1 saat** → yapılabilir.

---

## F · BUGÜNÜN DESENİ — "bilgi var, kullanan yok"

Üç bağımsız örnek çıktı ve muhtemelen daha var:

| ne | durum |
|---|---|
| `SIM.pendingHits` (gelen ateş: nereye, ne zaman, yarıçap) | tam kayıt, **hiç okunmuyor** |
| Kredi defteri 5 kanalı (`gorusTekil`, `tespit`, `siperTik`, `havaCaydirma`, `kapma`) | tanımlı, **hiç yazılmıyor** |
| `_laUntilTick` (emir ömrü koruması) | atanıyor, **hiç okunmuyor** |

Kullanıcının teşhisi — *"AI'nin potansiyeli var ama kullanamıyor"* — ölçüldüğü her
yerde doğrulandı. Tavan ölçümü de aynı yöne: en iyi aday kararların **%72'sinde**
oynatılan 2'nin içinde bile değil.

---

## Öncelik gerekçesi (2026-08-17 sonrası, GÜNCEL)

Değer-ağı/GPU dalı kapandığına göre kalanlar:

1. **Emir ömrü** — en ucuz aday. Emirlerin %50'si 1 saniyede eziliyor; +839 bu israfla
   elde edilmiş. Koruma (`_laUntilTick`) yazılmış ama bağlanmamış. Ön kapı gerekmez
   (kusur kesin), doğrudan maç kapısı. ⚠ Ezmenin meşru sebepleri olabilir → ölçülmeden bağlanmaz.
2. **Worker** — ölçülmüş +839'u TAM güçle oyuna taşıyan tek yol. Mühendislik işi,
   araştırma değil. Yol haritasının en baştaki cevabıydı; "bütçe duvarı çözüldü" diyerek
   erken elemiştim (verimi gecikme sanmıştım).
3. **Uzun ufuk (10-15sn)** — ön kapıyı geçti (%28.6 karar değişiyor). Ufku KISALTMAK
   ölçülüp öldürülmüş, UZATMAK hiç denenmemiş.
4. **Gerçek tavan** — 25 adayı oynatan arama gerçek maçta kazanıyor mu? Kısa maçlarla ~1 saat.
5. **Rakip modeli** — katman atfına göre insan farkının %47'si durum değerlendirmede;
   aramanın dokunduğu katmanda fark %0. En büyük ölçülmüş kaldıraç, ama en pahalı.
6. **Eylem uzayını genişletmek** (çekil / ateş kes / hedef seç) — %40'lık yürütme katmanı.
