# GÖREV — İKİNCİ MAKİNE

> Bu dosya ikinci makinedeki oturum için yazıldı. **CYBORG** (16 çekirdek, GPU) tarafından
> hazırlandı. Kullanıcı sana muhtemelen "bu dosyayı oku ve uygula" dedi — aşağısı görevin.

---

## 0. KİMLİK VE SINIRLAR

Sen **ikinci makinesin** (20 çekirdek, Intel i5 14. nesil, ~5 GB boş RAM).
Diğer makinenin adı **CYBORG**; şu anda savaş AI'sinin **karar uzayını genişletiyor**.

**DOKUNMA:** `js/` altındaki hiçbir dosya. Orada CYBORG çalışıyor, aynı anda ikimizin dokunması
çakışma üretir.
**SENİN ALANIN:** `docs/` ve `qa-runtime/`.

---

## 1. İLK İŞ (sırayla, atlama)

```
git fetch && git checkout savas-ai-mikrofix-konsantrasyon && git pull
```

1. **`docs/IKI-MAKINE.md`** oku. Makine tablosundaki ikinci satıra **kendi adını** ve o an ne
   yaptığını yaz (commit'i sona bırakabilirsin).
2. **`docs/OLCUM-TUZAKLARI.md`** oku. Bu projede aynı ölçüm hataları **defalarca** tekrarlandı;
   teşhis kurmadan önce okunması kuraldır.
3. **`docs/SAVAS-AI-YON.md`** oku — neden bu işi yaptığımızı orada bulursun.
4. Determinizmi doğrula (kendi checkout'unun sağlam olduğunun kanıtı):
   - `ELECTRON_RUN_AS_NODE` ortam değişkenini **temizle**
   - `npx electron . --forktest`
   - **`FORKTEST_OK`** görmelisin. Görmezsen **DUR ve bildir** — ölçüme başlama.

---

## 2. ASIL GÖREV — "tavan" karşılaştırması

### Soru
**Mükemmel seçici** (her kararda tüm adayları gerçekten yuvarlayıp en iyisini seçen, yani hile
yapan bir üst sınır) kod-AI'yı yenebiliyor mu?

Şu anki cevap: **+771 marj, t 1.80** → *anlamlı değil*. Ve bu **dar** bir uzayda ölçüldü: bir
kararda AI'ın seçebildiği yalnız **3 ayrık nokta** var, 45 saniyede bir, maç başına 7.5 karar.

CYBORG şu an o uzayı genişletiyor. Senin işin şunu ölçmek:

> **Uzayı genişletmek tavanı yükseltiyor mu?**

Cevap "hayır" ise, haftalarca yanlış yöne gitmekten kurtuluruz. Bu yüzden bu ölçüm projenin en
kritik sayısıdır.

### İki kol, AYNI tohumlar

```
DAR:
node tools/beonai-mac-kapisi.js --surum ORACLE --tohum 12 --atla <OFS> --rol her \
  --out qa-runtime/tavan-dar-<OFS>.json

GENİŞ:
node tools/beonai-mac-kapisi.js --surum ORACLE --tohum 12 --atla <OFS> --rol her \
  --gramer-v2 --kota 96 --out qa-runtime/tavan-genis-<OFS>.json
```

`--atla` tohum dilimini kaydırır. Havuz **72 tohum**; `--atla` değerlerini **0, 12, 24, 36, 48, 60**
diye ayır ki paralel örnekler **aynı maçı koşmasın**.

> ⚠ Bu projede 12 işçinin **hepsi aynı maçı koştu** ve koşu boşa gitti (dosya boyutları birebir
> aynıydı). Başlattığın örneklerin çıktılarındaki tohumların **farklı olduğunu doğrula**.

---

## 3. RAM — TAHMİN ETME, ÖLÇ

Bu makinede ~5 GB boş. CYBORG'da ölçülen: veri-üretim aracı **süreç başına 700-850 MB** ve koşu
ilerledikçe **büyüyor**. Bu araç ayrıca **fork alıyor** (sahnenin tam kopyası), daha çok yiyebilir.

- **2 örnekle başla.**
- 10 dakika sonra gerçek tüketimi ölç:
  ```powershell
  Get-Process node | Select-Object Id,@{N='MB';E={[math]::Round($_.WorkingSet64/1MB)}}
  ```
- **Boş-RAM farkından hesaplama** — yanıltıyor (CYBORG bu hatayı iki kez yaptı).
- Boş RAM **1 GB'ın altına inerse bir örnek kapat**. Sayfalama hızı **düşürür**: CYBORG'da 6/9/12
  işçi aynı hızı verdi, yani çekirdek eklemek bir noktadan sonra kazandırmıyor.

---

## 4. SÜRE BEKLENTİSİ

ORACLE kolu her kararda tüm adayları yuvarlar → maç başına **~200 sn** beklenir.
`--tohum 12 --rol her` = 24 maç ≈ **80 dk**.

**Önce BİR dilim bitir, gerçek süreyi gör, sonra devam et.** (Tahmine göre gece planlama.)

---

## 5. ÇIKTI

`docs/TAVAN-OLCUMU.md` dosyası oluştur. Her kol (DAR / GENİŞ) için şunları yaz:

| alan | not |
|---|---|
| eşleştirilmiş marj | |
| std. hata | |
| **t** | |
| lehte kaç/kaç | |
| galibiyet oranı (taban → oracle) | |
| kaç maç | |
| kullanılan tohum dilimleri | çakışma kanıtı |

Sonra `docs/IKI-MAKINE.md` durum defterine satır ekle, **commit + push** et.

---

## 6. KURALLAR (bu proje bunlarda ısrarcı)

- `|t| < 2` ise **"fark yok" DEME**, **"fark GÖSTERİLEMEDİ"** de. İkisi aynı şey değil.
- **Bağlanma kanıtı olmadan tablo okuma.** ORACLE kolunda çıktıdaki `bagli` alanı
  `"ORACLE-POLITIKA"` olmalı; değilse ölçüm boştur.
- Örneklem < 24 maç ise **hüküm verme**.
- Bir şey ters giderse **DUR ve bildir**; sessizce devam etme, tahminle doldurma.
- Ölçmediğin bir şeyi ölçmüş gibi yazma.

---

## 7. BİTİNCE

Kullanıcıya şunu söyle: **geniş uzayın tavanı dar uzayınkinden yüksek mi, ve fark anlamlı mı.**
Tek cümlelik cevap yeterli; ayrıntı `docs/TAVAN-OLCUMU.md`'de dursun.

Bu sonuç CYBORG'un adım 3'ü sürdürüp sürdürmeyeceğini belirleyecek.
