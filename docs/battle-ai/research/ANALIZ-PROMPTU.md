# Dış analiz promptu — "AI geliştiriyoruz ama ölçütümüz kör"

> Aşağıdaki metni olduğu gibi kopyalayıp bir analiste / başka bir modele verebilirsiniz.
> Hiçbir ön bilgi varsaymaz.

---

## ROL

Sen bir oyun-AI ve deneysel metodoloji uzmanısın. Sana bir problem anlatacağım. Amacım çözüm önerisi
almak **değil sadece** — asıl istediğim **problemin doğru tanımlanıp tanımlanmadığını denetlemen**.
Anlatan kişi (bir AI asistanı) aylardır bu projede çalışıyor ve kendi çerçevesine körleşmiş olabilir.
Çerçevenin kendisini sorgulamanı özellikle istiyorum.

---

## 1. ORTAM

**Oyun:** 2D gerçek zamanlı strateji (RTS). Modern çağ, 26 birim tipi (piyade, tanksavar timi, havan,
MANPADS, komando, tank, ZMA, tank avcısı, topçu, ÇNRA, balistik füze, karşı-batarya radarı, SPAAG,
SAM, saldırı helikopteri, nakliye helikopteri, keşif İHA, silahlı İHA, kamikaze mühimmat, keşif aracı,
elektronik harp aracı, sıhhiyeci, istihkam, ikmal aracı, komuta aracı, drone operatörü).

**Muharebe kipi:** İki taraf eşit bütçeyle (6500₺) ordu kurar, harita 5100×3450 piksel, maç 360 saniye
veya bir taraf imha olana kadar. Maç içi üretim/takviye **yok** — ordu baştan kurulur.

**Motor garantileri:**
- 50 ms tick, tamamen deterministik (kendi RNG'si, `srand`)
- Fork/replay bit-aynı (doğrulama kapısı var: `--forktest`)
- Regresyon kapısı var (`--battletest`)
- Headless (jsdom) tezgâh: 360 saniyelik bir maç ~3.5–7 saniyede koşuyor
- Tek oturumda 1000+ maç koşulabiliyor
- Zengin telemetri: 0.5 sn'de bir tüm birimlerin durumu, konumlu hasar olayları, AI'ın her kararı
  (aday planlar, puanlar, seçilen plan, gözlem anlık görüntüsü)

**AI mimarisi (hiyerarşik):**
`Perception (sis-altı gözlem) → Situation (durum değerlendirme) → Commitment (plan seçimi) →
Planning (görev grupları + sözleşmeler) → Execution (emirler) → Unit (birim mikrosu)`

Plan seçimi: her karar anında **3 aday plan** üretilip puanlanıyor (HOLD, MAIN_ATTACK, FIX_AND_FLANK,
FIRE_PREPARATION, REGROUP, DISENGAGE, COUNTERATTACK, ADVANCE, SEARCH arasından). **1 ply, arama yok.**

---

## 2. HEDEF

AI'ın insan oyuncuya (projenin sahibi) karşı iyi oynaması. Uzun vadede hikâye modunda
Crusader Kings tarzı "karakter AI" hedefi var ama şu anki iş savaş AI'ı.

---

## 3. ÖLÇÜM YÖNTEMİ (bunu da denetle)

- **Eşleştirilmiş fark:** aynı tohum, aynı rol, tek değişken; A ve B kollarının marj farkı
- **Bar:** |t| ≥ 2
- **Taraf-başı bayrak:** değişiklik yalnız bir tarafa uygulanır, yoksa etki karşılıklı sönümlenir
- **Bağlanma kanıtı (bind proof):** her yeni kural bir sayaç yazar; sayaç sıfırsa kural hiç çalışmamıştır
  ve sonuç tablosu anlamsızdır
- **Marj standart sapması ~3100** → tek bir kararı sağlam vermek için 37+ tohum gerekiyor
- **Ölçüt (benchmark):** insan oyuncunun gerçek maçlarından çıkarılan 6 ordu, tarif olarak yeniden
  kuruluyor; **iki tarafı da aynı kod-AI sürüyor**, tek değişken ordu bileşimi. "İnsan
  kompozisyonunun saf avantajı" bu şekilde ölçülüyor.

---

## 4. ASIL PROBLEM

**Tezgâhtaki kazanç canlı oyuna geçmiyor. Ve bunun yapısal bir sebebi var.**

Bir günde altı motor düzeltmesi yapıldı, hepsi ölçüldü, hepsi kapılardan geçti:

| # | düzeltme | mekanizma kanıtı |
|---|---|---|
| 1 | Tedarik tahsis metriği (ağırlık bütçe-payıydı, sıralama birim-başınaydı → pahalı sınıf yapısal dışlıydı) | ÇNRA ordularda %15 → %52 |
| 2 | Konuşlandırma derinliği (26 birimin 6'sı adlandırılmıştı; yayılım 326px, silahsız lojistik hattın önündeydi) | yayılım 326 → 625px |
| 3 | Keşif önceliği (tehdit görünce gözlem hareketi hiç üretilmiyordu) | körlük %35 → %17 |
| 4 | Hava savunma kovası (anti_air etiketi yüzünden muharebe grubuna düşüp taarruzla öne gidiyordu) | dolaylı ateş kapsaması %57 → %73 |
| 5 | SUPPORT rolünün yürütmede hiç dalı yoktu | sağlık kapsaması %7 → %20 |
| 6 | Birim adetleri (SPAAG, ikmal) | kapsama %72, mermi doluluk %69 → %77 |

**Ölçüt sonucu:** insan kompozisyonunun avantajı **+596 (t 2.89) → −1417 (t −7.07)**, n=192,
ayrık tohumlarda. Yani tezgâha göre AI'ın ordusu artık insanınkini açık ara yeniyor.

**Aynı gün, canlı oyun:** insan oyuncu 2 maç oynadı ve **61 birim ölümüne karşı 3 kayıpla** kazandı.
Maçlar eskisinden **daha hızlı** bitti (138–155 sn).

### Kör noktanın mekanizması

Tezgâhta **iki tarafı da aynı kod-AI sürüyor.** Dolayısıyla AI'ın bir yeteneği kötü kullanması
**karşılıklı sönümleniyor** ve ölçümde görünmüyor. Somut kanıt:

- **Aynı silah, iki farklı sonuç:** ÇNRA — insanın elinde 3 adet, 3065 hasar verdi / 25 hasar yedi
  (oran **122:1**), 0 kayıp. AI'ın elinde 2 adet, 511 hasar / 520 yedi (oran **0.98:1**), 2/2 öldü.
- **Bir kuralın A/B'si bağlanmadı** çünkü kusur tezgâhta yok: "uzun menzilli birim menzilinin ucunda
  dursun" kuralı açıldı; bağlanma kanıtı gösterdi ki tezgâhta uzun menzilliler **zaten 1.33× menzilde
  duruyor**. Kusur yalnız insana karşı ortaya çıkıyor (0.28–0.45× menzil, baskı 84.9).
- **Zincir ölçüldü:** insanın saldırı helikopteri serbest geziyor → AI'ın topçusunu kesiyor (topçuya
  gelen hasarın %47'si, 8 ölümün 4'ü) → AI'ın dolaylı ateşi bastırılıp ölüyor → AI 193 atış yapabiliyor,
  insan 453 → AI'ın uzun menzilli çıktısı 511, insanınki 3065.

---

## 5. DENENENLER VE ÖLÇÜLEN SONUÇLARI

Hiçbiri tahmin değil, hepsi ölçüldü:

### Öğrenme yaklaşımları
- **Öğrenen seçici** (aday planlar arasından seçim öğreniyor): **tavan ölçüldü** — mevcut aday
  kümesinde **mükemmel** seçici bile yalnız **+771 (t 1.80)** kazandırıyor. Aday kümesini genişletmek
  tavanı yükseltmedi.
- **Davranış klonlama** (insanın/oracle'ın kararlarını taklit): 96 bağımsız maçta **t −2.85** (anlamlı
  biçimde daha kötü), geri çekildi.
- **Değer fonksiyonu**: etiket kapısını geçti (ρ 0.830) ama davranışa çevrilince kazanç vermedi.

### Karar-anı taktik kuralları (4/4 çöktü)
- Gafil avlama akını: mekanizma çalıştı (gafil oran %15→%21) ama **maç etkisi t 0.10**
- Angajman eşiği ("sadece üstünsen saldır"): 8 tohumda +1033 (t 2.06), **24 bağımsız tohumda −333 (t −0.70)**
- Mühimmat rotasyonu: t −1.36
- Helikopter hasar-çekilmesi: kural bağlandı (4/4 birim tetikledi) ama eşik %45'te de %75'te de
  **ölüm oranı %100** kaldı

### Muharebe sonucu tahmini
- **Lanchester çekilme yasası** modeli kuruldu (literatürde StarCraft botlarında galibiyet oranını
  yükseltmiş). 29 gerçek maç kaydına karşı sınandı: korelasyon **0.08–0.12**, oysa AI'ın hâlihazırda
  kullandığı basit kuvvet oranı **0.16**. Kazanan tahmini **4/29**. Karara bağlanmadı.

### Kritik metodolojik bulgu
- **Hedefin kendi oto-korelasyonu ölçüldü:** 10–60 saniyelik pencerelerde "kim daha çok hasar verecek"
  sorusunun bir pencereden diğerine korelasyonu **0.04–0.36**. Yani kısa vadeli sonuç **özünde
  öngörülemez**; hiçbir öznitelik onu yordayamaz. Bu, karar-anı müdahalelerinin neden hep çöktüğünü
  açıklıyor ve yordama tavanını baştan sınırlıyor.

### Ölçütü görür yapma denemesi
- Motorda "taktik vekili" var (insan gibi oynaması beklenen bot) + oyuncu profilinden türetilmiş
  ordu doktrini. Sınandı: vekil açıkken **kod-AI'dan çok daha kötü** oynuyor (saldıran kipinde marj
  −72 → **−3869**; savunanda +480 → **−706**), ve insanın imzalarının **hiçbirini** üretmiyor
  (helolarının hepsi ölüyor, AI'ın topçusuna hiç dokunmuyor).

### Yapısal denetim
- "Veride tanımlı ama kodda karşılığı yok" taraması yapıldı: **16 yetenek ölü veri**
  (topçu barajı, duman, keşifin topçuya göz olması, helikopterin üsse dönmesi, SAM'in radar sessizliği,
  balistiğin yer değiştirmesi, sıhhiyecinin diriltmesi, EH'nin jamlaması...), 3 silah alanı okunmuyor,
  bir görev rolünün (SUPPORT) yürütmede hiç dalı yoktu.
- 5 telafi yamasının 2⁵ faktöriyeli koşuldu (1024 maç): kanıta dayanarak kaldırılacak yama çıkmadı.
- İki AI sürümü karşılaştırıldı (intel4-pro vs intel4, 48 maç): pro **%44 galibiyet, t −1.04** —
  yani gelişmiş sürümün ölçülebilir üstünlüğü **yok**.

---

## 6. KISITLAR

- İnsan oyuncu günde ancak **2–6 maç** oynayabiliyor (yorucu). Yani "gerçek" ölçüt çok yavaş.
- Tezgâh çok hızlı ama (yukarıda anlatıldığı gibi) insana karşı kör.
- Oyun dengesi insan oyuncuya göre ayarlı; AI'ın zayıflığını telafi etmek için denge değiştirilmiyor
  (oyuncunun açık kararı: "ben iyi kullanıyorsam AI da kullanabilir").
- Tek geliştirici + bir AI asistanı. Büyük ölçekli self-play/RL altyapısı yok.

---

## 7. SORULAR

Sırayla ve gerekçeli cevap bekliyorum:

1. **Problem doğru mu tanımlanmış?** "Ölçüt insana kör" teşhisi doğru mu, yoksa asıl sorun başka bir
   yerde mi? Anlatılan kanıtlar bu teşhisi gerçekten destekliyor mu, yoksa aynı veriler başka bir
   teşhisle daha iyi mi açıklanır?

2. **İki taraflı sönümleme argümanı sağlam mı?** "Aynı AI iki tarafı sürünce ortak zayıflık görünmez"
   iddiası doğru mu? Bu, self-play temelli tüm yaklaşımları (AlphaZero dâhil) geçersiz kılar mıydı?
   Değilse, onlarda neden sorun olmuyor da burada oluyor?

3. **Ölçütü nasıl görür hale getirirsin?** İnsan günde 2–6 maç oynayabiliyorken, insana karşı
   performansı hızlı ölçmenin yolu nedir? (Değerlendirilmesini istediğim seçenekler: gerçek maç
   kayıtlarından öğrenilen rakip modeli; rakip **ligi**/popülasyon; senaryo/birim-testi tarzı mikro
   ölçütler; insanın kayıtlarından türetilen sabit "sınav" durumları; başka bir şey.)

4. **Kısa vadeli sonucun öngörülemez olması (oto-korelasyon 0.04–0.36)** ne anlama geliyor? Bu,
   karar-anı iyileştirmelerinin tavanının gerçekten düşük olduğunu mu gösterir, yoksa ölçüm hedefi mi
   yanlış seçilmiş? Doğru hedef ne olmalı?

5. **"Mükemmel seçici bile +771" tavanı** doğru yorumlanmış mı? Bu, arama/lookahead yatırımının
   getirisinin düşük olacağı anlamına gelir mi? Eylem uzayını genişletmek bu tavanı nasıl değiştirir?

6. **Sıralama önerisi:** eldeki kanıtla, sınırlı zamanla, sırayla ne yapılmalı? Özellikle şunlar
   arasında: (a) rakip modeli/lig kurmak, (b) eylem uzayını genişletmek, (c) arama/lookahead eklemek,
   (d) kalan ölü yetenekleri hayata geçirmek, (e) tamamen başka bir şey.

7. **Neyi ölçmüyoruz?** Anlatılanlara bakarak, hiç bakılmamış ama kritik olabilecek bir şey var mı?

---

## 8. CEVAP BİÇİMİ

- Önce **teşhisi denetle** (soru 1–2), gerekiyorsa çerçeveyi reddet ve niye reddettiğini yaz.
- Sonra somut, sıralı bir eylem planı ver; her adım için **hangi ölçümle doğrulanacağını** belirt.
- Emin olmadığın yerleri açıkça işaretle. Kesin konuşma, kanıtla konuş.
- Bu projede "ölçmeden değiştirme" ve "bağlanma kanıtı olmadan tabloya güvenme" kuralları var;
  önerilerin bu kurallarla uyumlu olsun.
