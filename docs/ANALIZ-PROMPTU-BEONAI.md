# Dış analiz promptu #2 — "Öğrenen AI (beonai) tavana vurdu, neden ve ne yapmalı?"

> Bu, aynı projenin ikinci analiz promptudur. Birincisi ölçüm altyapısıyla ilgiliydi
> (`docs/ANALIZ-PROMPTU.md`). Bu, **öğrenen AI** hattıyla ilgili. İkisi bağımsız okunabilir.

---

## ROL

Sen makine öğrenmesi (özellikle karar/politika öğrenme, taklit öğrenme, oyun AI'ı) ve deneysel
metodoloji uzmanısın. Sana bir öğrenen-AI hattını ve ölçülmüş sonuçlarını anlatacağım.
İstediğim üç şey:
1. **Teşhisin doğruluğunu denetle** — anlatan kişi (bir AI asistanı) kendi çerçevesine körleşmiş olabilir.
2. Hattın **nerede yanlış kurulduğunu** söyle.
3. Bu kısıtlar altında **ne yapılmalı** — sıralı ve her adımı doğrulama ölçümüyle.

Kesin konuşma, kanıtla konuş. Emin olmadığın yeri işaretle.

---

## 1. ORTAM (kısa)

2D gerçek zamanlı strateji oyunu. 26 birim tipi. İki taraf eşit bütçeyle (6500₺) ordu kurar,
harita 5100×3450 px, maç ≤360 sn. **Maç içi üretim yok** — ordu baştan kurulur, sonra savaşılır.

Motor tamamen **deterministik** (kendi RNG'si), fork/replay bit-aynı, headless tezgâhta bir maç
~3.5–7 sn. Tek oturumda 1000+ maç koşulabiliyor. Zengin telemetri: 0.5 sn'de bir tüm birim durumları,
konumlu hasar olayları, AI'ın her kararı (aday planlar, puanlar, gözlem anlık görüntüsü).

**Kod-AI mimarisi (hiyerarşik, elle yazılmış):**
`Perception → Situation → Commitment (plan seçimi) → Planning (görev grupları) → Execution (emirler) → Unit (mikro)`

---

## 2. ÖĞRENEN AI (beonai) — HAT NASIL KURULU

Amaç: **plan seçimini** öğrenmek. Yani yukarıdaki `Commitment` katmanını bir modelle değiştirmek.

**Adım adım hat:**

1. **Operasyon grameri**: her karar anında aday planlar üretilir.
   Aday = `niyet × ana-sektör × tempo × kuvvet-tahsisi`.
   Niyetler: HOLD, MAIN_ATTACK, FIX_AND_FLANK, FIRE_PREPARATION, REGROUP, DISENGAGE, COUNTERATTACK,
   ADVANCE, SEARCH. Sektör ızgarası 8×6. Pratikte **karar başına ~3 aday** üretiliyor.

2. **Oracle (öğretmen)**: her aday için **rollout** yapılır — o aday enjekte edilip maç bir süre
   (≈25 sn) ileri sarılır, sonra durum değerlendirilir. Rollout'lar fork/restore ile yapılır (deterministik).
   Ödül şu anda: `takasFarkı + kuvvetÖnderliği×0.5 + terminal×800`, artı sonradan eklenen
   **değer-ağı karışımı** (ΔV).

3. **Öznitelikler**: karar başına 27 boyutlu vektör (`candidateFeatures.v2`) — kuvvet oranı,
   hazırlık, zaman baskısı, sektör oranları, yerel üstünlük göstergeleri, kategori payları vb.

4. **Seçici (öğrenilen model)**: bir karar içindeki adaylar üzerinde **listwise softmax** ile eğitilir
   (hedef = oracle'ın en iyi bulduğu adayın indeksi). GPU'da (PyTorch) eğitiliyor.

5. **DAgger** planlandı (model açıkken veri toplayıp dağılım kaymasını kapatmak) ama tam koşulmadı.

**Kritik tasarım detayı:** öğretmen (oracle) **tam bilgiyle** hesaplar (rollout doğru olsun diye),
ama modelin gördüğü öznitelikler **perception'dan** (sis-altı) üretilir. Bu ayrım sonradan eklendi;
öncesinde model tam-bilgiyle eğitilip perception ile oynuyordu ve **kararların %79'unda farklı aday**
seçiyordu (ölçüldü).

---

## 3. ÖLÇÜLEN SONUÇLAR (hepsi ölçüm, tahmin değil)

**Yöntem:** eşleştirilmiş fark (aynı tohum, aynı rol, tek değişken), bar |t| ≥ 2,
marj standart sapması ~3100 (yani tek karar için 37+ tohum gerekiyor).

### Olumlu
- Karar seviyesinde beonai kod-AI'yı geçebiliyor: canlı maçta 6/6 üstünlük, Δ+342 ölçüldü.
- Değer ağı etiket kapısını geçti: ρ 0.830 / %86 doğruluk. Ödül = zamana göre ağırlıklı ΔV + oracle
  karışımı (oracle atılmadı çünkü geç oyunda ΔV negatife düşüyor).
- Rollout'suz veri üretimi bulundu: 18 → 562 karar/dakika (**31×**). Darboğaz işçi sayısı değil
  rollout'muş.

### Olumsuz — ve asıl mesele
- **TAVAN ÖLÇÜLDÜ:** mevcut aday kümesi üzerinde **mükemmel** seçici (yani oracle'ın en iyisini
  her seferinde bilen bir üst sınır) yalnız **+771 (t 1.80)** kazandırıyor. beonai bunun yarısını
  alıyor. Yani **sorun veri veya model değil, KARAR UZAYI.**
- Aday kümesini genişletmek tavanı yükseltmedi: DAR küme t 0.48, GENİŞ küme t 0.70.
- **Davranış klonlama v2** (oracle/insan kararlarını taklit): 48 maçta t 2.03 gibi umut verici
  görünüp **96 bağımsız maçta t −2.85** çıktı (anlamlı biçimde KÖTÜ) → geri çekildi.
- Seçici şu anda **varsayılan KAPALI** (bayat sayıldı).

### Bugün eklenen kritik bulgu (bu, ödül tasarımını doğrudan ilgilendiriyor)
Ödülün/hedefin **kendi oto-korelasyonu** ölçüldü (aynı maçta bir 20 sn penceresinden diğerine):

| değişken | oto-korelasyon |
|---|---|
| **SONUÇ: hasar oranı (log)** | **0.047** |
| DURUM: değer oranı (log) | 0.941 |
| DURUM: ateş eden birim farkı | 0.923 |
| DURUM: etkili menzil farkı | 0.887 |
| DURUM: baskı farkı | 0.474 |

Yani **sonuç değişkeni neredeyse gürültü**, ama **durum değişkenleri çok kararlı**.
Oracle'ın ödülü sonuç-benzeri bir büyüklük (takas farkı + kuvvet önderliği) üzerine kurulu.

### Bir başka bugünkü bulgu (ölçüt körlüğü)
Tezgâhta **iki tarafı da aynı kod-AI sürüyor**. Bu yüzden AI'ın ortak zayıflıkları ölçümde
sönümleniyor. Somut kanıt: tezgâh "AI'ın ordusu insanınkini 1417 marjla yener" derken, insan oyuncu
aynı gün canlı maçları **61 ölüme karşı 3 kayıpla** kazandı. Aynı silah (ÇNRA) insanın elinde
**122:1**, AI'ın elinde **0.98:1** verim veriyor.

Bu, öğrenme hattı için de geçerli: **oracle'ın rollout'ları da aynı kod-AI ile ileri sarılıyor.**

---

## 4. KISITLAR

- Tek geliştirici + bir AI asistanı. Büyük ölçekli RL altyapısı yok.
- İnsan oyuncu günde ancak **2–6 maç** oynayabiliyor (yorucu) — "gerçek" ölçüt çok yavaş.
- Motor deterministik ve hızlı; 1000+ maçlık koşular günlük rutin.
- Oyun dengesi AI'ın zayıflığına göre değiştirilmiyor (oyuncunun kararı).
- Nihai hedef: AI'ın **insan oyuncuya** karşı iyi oynaması.

---

## 5. SORULAR

1. **Tavan yorumu doğru mu?** "Mükemmel seçici bile +771" ölçümü, gerçekten "sorun karar uzayı"
   anlamına mı geliyor? Yoksa ölçümün kendisi (oracle'ın rollout değerlendirmesi, ayna rakip,
   25 sn ufuk) tavanı yapay olarak mı alçaltıyor? Bu ölçümü nasıl denetlerdin?

2. **Ödül yanlış hedefe mi bakıyor?** Oto-korelasyon verisi (sonuç 0.047, durum 0.94) ışığında,
   oracle ödülünün sonuç-benzeri değil **durum-benzeri** olması gerekir mi? Öyleyse hangi durum
   büyüklükleri ödül olmalı ve bu, "oyunu kazanmak" hedefinden sapma riski taşır mı
   (ödül hackleme / yanlış vekil ödül)?

3. **Ayna-rollout sorunu.** Oracle bir adayı değerlendirirken maçı **aynı kod-AI ile** ileri sarıyor.
   Bu, öğrenilen politikayı "kod-AI'ın oynadığı dünyada iyi" olmaya iter. İnsan gibi bir rakibe karşı
   genellemesi beklenebilir mi? Bu, off-policy değerlendirme literatüründe hangi başlık altında ele
   alınır ve pratik çaresi nedir?

4. **Davranış klonlamanın çöküşü** (48 maçta t 2.03 → 96 bağımsız maçta t −2.85) neyin işareti?
   Sadece örneklem/çoklu-karşılaştırma sorunu mu, yoksa taklit öğrenmenin bu kurulumda yapısal olarak
   başarısız olacağının işareti mi? (Veri: ~binlerce karar, ~yüzlerce maç mertebesinde.)

5. **Karar uzayı nasıl genişletilmeli?** Şu an karar = plan seçimi (3 aday, 1 ply, ~2 sn'de bir).
   Alternatifler: (a) daha zengin gramer (daha çok aday), (b) hiyerarşik/parçalı eylem uzayı
   (AlphaStar tarzı: niyet + hedef + zamanlama ayrı kafalar), (c) daha alt katmanda karar
   (görev grubu seviyesi yerine birim/manga seviyesi), (d) arama/lookahead. Bu kısıtlarla hangisi?

6. **Bu ölçekte öğrenme gerçekçi mi?** Tek geliştirici, ~1000 maç/gün simülasyon kapasitesi, kör bir
   ölçüt. Öğrenme yerine (veya öncesinde) **elle yazılmış ama ölçüm-güdümlü** geliştirmeye devam etmek
   daha rasyonel mi? Hangi eşikten sonra öğrenme yatırımı geri döner?

7. **Neyi ölçmüyoruz?** Anlatılan hatta bakarak, hiç bakılmamış ama kritik olabilecek bir şey var mı?

---

## 6. EK BAĞLAM: elle yazılmış tarafta ne oluyor

Aynı gün, öğrenme hattına dokunmadan, **elle yazılmış kodda 6 yapısal kusur** bulunup düzeltildi
(hepsi "veri var / davranış yok" veya "birim karışıklığı" sınıfından):

- Tedarik tahsis metriği ağırlığı bütçe-payı sayıp sıralamayı birim-başına yapıyordu → pahalı sınıf
  (ÇNRA, SAM, helikopter) **yapısal olarak satın alınamıyordu** (ordularda %15 → %52)
- Konuşlandırma derinlik tablosu 26 birimin 6'sını adlandırıyordu; ordu 326 px derinliğe sıkışmıştı
  (silah menzilleri 300–3000 px) ve silahsız lojistik hattın önündeydi
- Keşif birimleri tehdit görünce gözlem emri hiç üretmiyordu (körlük %35)
- Hava savunma, `anti_air` etiketi yüzünden muharebe grubuna düşüp taarruzla öne gidiyordu
- Bir görev rolünün (SUPPORT) yürütmede **hiç dalı yoktu**
- Veride tanımlı **16 yetenek** kodda hiç uygulanmamıştı

Bu düzeltmeler tezgâh ölçütünü +596 → −1417'ye taşıdı (t −7.07, n=192).
**Bunların hiçbirini öğrenen model öğrenemezdi** — hiçbiri karar seçimi değil, kodun yapısı.

Bu bağlam soru 6 için önemli: öğrenme hattına yatırım yapmanın alternatif maliyeti, bu tür yapısal
denetimlerdir ve bugünkü getiri oranı yapısal denetimden yana görünüyor. Bu izlenim doğru mu,
yoksa "kolay meyveler toplandı, bundan sonra öğrenme şart" mı demeliyiz?

---

## 7. CEVAP BİÇİMİ

- Önce teşhis denetimi (soru 1–4). Çerçeve yanlışsa reddet ve gerekçelendir.
- Sonra sıralı eylem planı; her adım için **hangi ölçüm** onu doğrular/çürütür.
- Proje kuralları: "ölçmeden değiştirme", "bağlanma kanıtı olmadan tabloya güvenme",
  "8 tohumda anlamlı çıkan şey 24 bağımsız tohumda sınanmadan kabul edilmez".
  Önerilerin bunlarla uyumlu olsun.
