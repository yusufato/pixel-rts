MODE: PLAN

### 1) Triage Summary

- **Raporlar:** OPTIMIZATIONS.md — 7 bulgu; TEST_GAPS.md — 33 bulgu; RCA.md — 1 kök neden.
- **Önceki backlog:** Yok. Bu döngüdeki bütün ertelemeler ilk ertelemedir.
- **Kümelendirme:** 41 ham bulgu → 20 iş/karar kümesi; yüzde 51,2 daralma.
- **Kapasite:** Tek geliştirici, 10 kişi-gün. 2 kişi-gün olay/tahmin tamponu ayrıldı.
- **Tamamlanan canlı plan yükü:** Belge hedefleme planı 0,5 kişi-gün tüketerek kapatıldı.
- **Yeni Now kapasitesi:** 7,5 kişi-gün.
- **Dağılım:** Now 3 küme; Next 6; Won't Do 1; Needs Decision 10.
- **Döngü onayı:** 10 kişi-günlük kapsam ve sıra 26 Ağustos 2026'da kullanıcı tarafından onaylandı; ayrıntılı Draft planlar ayrıca onaylanmadan uygulanmaz.
- **Plan soy ağacı düzeltmesi:** Kanonik canlı ürün yolu, 29 Temmuz 2026'da
  açılan ve Faz 0–70 numaralarıyla 71 tam faz taşıyan Katmanlı Dünya
  Simülasyonu Ana Planı'dır. Sohbet ve hex programları bu planın alt/çapraz
  programlarıdır. 21 Ağustos'ta açılan 2B Harita Tamamlama Sözleşmesi ana
  plandan sonra gelen tamamlanma planıdır.
- **Uygulama kapısı:** Çalışma ağacındaki 96 durum satırı uzlaştırılmadan ve
  aşağıdaki sıra kullanıcı tarafından plan bazında onaylanmadan kaynak
  uygulaması başlamaz. Önceki 10 kişi-günlük bugfix dağılımı kapasite tahmini
  olarak korunur; kanonik yol haritasının önüne geçen otomatik yetki değildir.
- **En önemli karar:** İlk 3,5 günü gerçek Electron hikâye yaşam döngüsü ve yanlış güven üreten QA kapılarına ayırmak. Bu temel olmadan savaş, kayıt ve dünya mutasyonu düzeltmelerinin geçtiği iddia edilemez.

Efor ölçeği bu döngü için: S ≤1 gün, M 1,5–3 gün, L 3,5+ gün. İnceleme,
test, yeniden koşum ve geri alma doğrulaması efora dahildir.

### 2) Plan Register

| Plan | Status | Age | Owner | Remaining effort | Disposition |
|---|---|---:|---|---:|---|
| PIXEL RTS — Hikâye Modu Katmanlı Dünya Simülasyonu Ana Planı | active / kanonik eski metadata | son commit 2 gün | osman | Uzun vadeli; Faz 38.1–70 açık/uzlaştırılacak | **Continue as the top-level live roadmap.** Faz 0–70, 71 tam fazdır. Başlık Faz 38.1'i aktif gösterirken uygulama durumunda 38.13'e kadar partial dilimler bulunduğu için ilk iş gerçek ilerleme uzlaştırmasıdır. |
| PIXEL RTS — İnsan Düzeyine Yaklaşan Hikâye Sohbet Motoru Planı | active alt plan | son commit 4 gün | osman | Ana plan Faz 38.x içinde | **Subordinate.** Bağımsız ana yol değildir; Faz 38.x kabulüne hizmet eder. |
| PIXEL RTS — Altıgen Dünya, Dinamik Şehir ve Fiziksel Lojistik Altyapı Planı | active çapraz plan | son commit 4 gün | osman | HXD-6–HXD-15 | **Subordinate/cross-cutting.** Ana planın mekânsal bağımlılıklarını sağlar; bağımsız son hedef değildir. |
| Hikâye Modu 2B Harita Tamamlama Sözleşmesi | active / sonra açılmış | son commit 4 gün | osman | G2/G3/G5/G6/G8 kabul borçları | **Sequence after the 71-phase main roadmap.** Ana planın Faz 61 harita kapısı ve ana fazları bloke eden teknik harita regresyonları istisnadır; ayrı görsel/tamamlama işi Faz 70 sonrasına sıralanır. |
| Pixel RTS — Sıfırdan Savaş AI Tasarım Planı | active / ayrı alan | son commit 4 gün | osman | Uzun vadeli | **Separate lane.** Hikâye planı onay sırasına karıştırılmaz; M2/gece kayıtları korunur. |
| 25-agustos-arsiv-duzenlemesi | Landed olarak normalize edildi | 1 gün | osman | 0 | **Land where it stands.** Kullanıcının durdurduğu geniş arşiv hedefinin tamamlanmış taşıma öneki tutarlı; kalan işler belge-hedefleme planına geçti. |
| 25-agustos-belge-hedefleme-duzeni | Landed | 1 gün | osman | 0 | **Landed.** BACKLOG yönlendirmesi, aktif imleç ve iki bağlantılık okuma rotası tamamlandı; 0,5 gün döngü kapasitesinden tüketildi. |
| 25-agustos-hikaye-modu-toplam-bugfix-plani | Draft olarak normalize edildi | 1 gün | osman | 0 gün uygulama | **Continue as Draft.** Bu bir yönlendirme/karar planıdır; §6 kararları verilmeden yürütülmez. |
| electron-story-lifecycle-acceptance | Draft | 0 gün | osman | 3,5 gün | **Hold for hierarchy approval.** 71 fazlı ana planın önüne geçirilmez; kullanıcı bunu ilgili ana faz kabulüne katmayı veya ayrı bugfix olarak sıralamayı seçmeden uygulanmaz. |
| bugfix-council-motion-atomicity | Draft olarak normalize edildi | 1 gün | osman | 3 gün | **Continue.** Electron kabul temeli sonrasında, kullanıcı Draft→Approved yaparsa Now sırası 2 olarak yürütülür. |
| bugfix-story-invalid-battle-target-guard | Draft olarak normalize edildi | 1 gün | osman | 0,5 gün | **Continue.** Guard değişikliği Electron yaşam döngüsü planının ilk kırmızı regresyon dilimine sıralanır; ayrı geri alma birimi korunur. |

- Bayat plan yoktur; bütün planlar 14 günlük Draft ve 7 günlük In Progress
  eşiklerinin içindedir.
- İki dar bugfix planının geniş Draft plana depends_on bağı onları teknik olarak
  bloke ediyor. Yeni Electron planı bu bağımlılığı yeniden düzenlemeli; insan
  onayı olmadan hiçbir Draft uygulanmaz.
- Plan status alanlarında kanonik olmayan Active, Superseded ve Draft - ...
  değerleri bu triage sırasında yalnız status ve last_touched alanları
  değiştirilerek kanonik sözlüğe alındı.

### 3) Now — This Cycle

**Uygulama beklemede.** Aşağıdaki üç küme önceki 10 kişi-günlük teknik
dağılımdır; kaynak değişikliği yetkisi değildir. Yeni önerilen üst sıra:

1. Kirli çalışma ağacındaki 96 durum satırını kayıp üretmeden uzlaştır.
2. 71 fazlı ana planın başlıkta Faz 38.1, durum belgesinde 38.13'e uzanan
   kısmi ilerlemesini gerçek kod/test kanıtıyla uzlaştır ve sıradaki tek ana
   fazı belirle.
3. Ana planı Faz 70 sürüm adayına kadar üst yol haritası olarak yürüt.
4. Ayrı 2B harita tamamlama/görsel düzeltme sözleşmesini sonra yürüt; yalnız
   ana Faz 61'i veya çalışmayı bloke eden harita regresyonlarını ana plan içinde
   çöz.
5. Aşağıdaki bugfix paketlerini kullanıcı hangi ana faza bağlayacağını
   onayladıktan sonra uygula.

#### 1. Gerçek Electron hikâye yaşam döngüsü ve güvenilir QA kapıları

- **Closes:** TEST_GAPS TG-01, TG-05, TG-31, TG-32, TG-33; OPTIMIZATIONS — ölü border assertionı, boş taşıt örneklemesi ve hover rAF yanlış başarısızlığı.
- **Why now:** Mevcut UITEST, BATTLETEST, PLAYTEST ve headless harness birlikte bile dünya→story battle→sonuç→ödül→yeni süreçte Continue yolunu çalıştırmıyor. Sonraki bütün bugfix kapanışları bu kapıya dayanacak.
- **Effort:** L — 3,5 kişi-gün.
- **Route:** 06; önce ayrıntılı plan, sonra insan onayı ve 07 uygulaması.
- **Plan slug:** electron-story-lifecycle-acceptance.
- **Done means:** İzole userData ile saldırı zaferi, saldırı kaybı ve son-bölge savunma kaybı gerçek mode:story köprüsünden geçer; havuz/sahiplik/ödül/save/Continue tek kez doğrulanır. UITEST görüntüsü doğru boyalı kareyi yakalar. MAPTEST yalnız gerçek eşiklerle karar verir. Geçersiz hedef false ve sıfır dünya farkı üretir.

#### 2. Konsey önergesi ödeme–etki atomikliği

- **Closes:** TEST_GAPS TG-29; RCA.md güncel kök neden; bugfix-council-motion-atomicity planı.
- **Why now:** Exception sonrası ödeme kalıyor ve başarı metni dönüyor; oyuncu kaynağı kaybedip sonuç alamıyor. Tekrar ikinci ödeme üretebilir.
- **Effort:** M — 3 kişi-gün.
- **Route:** 07; mevcut plan yalnız kullanıcı Draft→Approved yaptıktan sonra.
- **Plan slug:** bugfix-council-motion-atomicity.
- **Done means:** Her katalog önergesinin ödeme, prepare ve effect failure injectionı sıfır kalıcı fark ve açık ret/rollback üretir; başarı tek ödeme, tek etki ve tek makbuzdur.
- **Sequence:** Now 1 sonrasında; tools/story-sim-harness.js, tests/story-world.test.js ve manifest yüzeyleri çakışıyor.

#### 3. Reroute eski terminal üyeliği sızıntısı

- **Closes:** TEST_GAPS TG-17.
- **Why now:** İki yuvalı RAIL terminali iki yönlendirmeyle kalıcı dolabilir; meşru yükler kuyrukta kilitlenir.
- **Effort:** S — 1 kişi-gün.
- **Route:** 06; dar plan ve ardından insan onaylı 07.
- **Plan slug:** bugfix-logistics-reroute-terminal-release.
- **Done means:** RAIL→LAND ve LAND→SEA yönlendirmesinde eski terminal, rota, lease ve agent sahipliği tek kez bırakılır; yeni attach başarısızsa eski durum atomik geri gelir.
- **Sequence:** Now 2 sonrasında; ortak harness değişikliği varsa yeniden tabanlanır.

Now toplamı 7,5 kişi-gün; plan kaydındaki 0,5 günlük canlı belge işiyle
birlikte 8 gün. 2 gün tampon korunmuştur.

### 4) Next — Deferred With Trigger

| Item | Closes | Trigger | Aging |
|---|---|---|---|
| Doğal yüzey kopyasını bırak ve 109,6 ms dilimi bütçele | OPTIMIZATIONS — doğal yüzey çift kopyası ve 4 ms dilim aşımı | Now 1 MAPTEST kapısı güvenilir ve üç soğuk başlangıç aynı ölçümü üretir | Deferred once |
| 8x şehir/ilçe rasterini görünür-karo LRU'ya indir | OPTIMIZATIONS — 986,3 MiB şehir rasteri | 8 GiB hedef makine kabulü başlar, renderer private working set 1,5 GiB'ı aşar veya süreç bellek baskısıyla kapanır | Deferred once |
| Canlı shipment lease yaşam döngüsü | TEST_GAPS TG-18 | Now 3 reroute sahiplik düzeltmesi Landed olur; HELD/MOVING/save-load fixture'ı aynı owner modelini kullanır | Deferred once |
| pendingReward devam ve tek-talep akışı | TEST_GAPS TG-03 | Now 1 Electron yaşam döngüsü fixture'ı Landed olur; sonuç kaydı ikinci süreçte yeniden açılabilir hâle gelir | Deferred once |
| Görsel durum anahtarını revision'a çevirme ölçümü | OPTIMIZATIONS — storyWorldVisualStateKey tahsisi | Allocation profili görsel dünya tahsislerinin en az yüzde 10'unu bu fonksiyona bağlar | Deferred once |
| Karakter aktivasyon probunu gerçek callback izine bağla | TEST_GAPS TG-06 | Karakter aktivasyon/periyot kodu değişmeden önce veya probe yeniden kırmızı verdiğinde | Deferred once |

### 5) Won't Do

- **Dokuz özel konuşma senaryosunu bu bugfix döngüsünde executable yapmak —
  TEST_GAPS TG-28.** Mevcut lab-only davranışı güvenli ve açık; dokuz ayrı domain
  yetki/preflight/makbuz tasarımı 10 günlük kapasiteyi aşar. Kullanıcı tek bir
  senaryoyu ürün hedefi olarak seçerse yeni kanıtla yeniden açılır.

### 6) Needs Decision

| Cluster | Findings | Decision required | Options | Decider |
|---|---|---|---|---|
| Kampanya sonucu ve savaş ödülü | TG-02, TG-04 | Son bölge ve loss/draw ödül sözleşmesi | Hemen yenilgi / sürgün; yalnız zafer ödülü / teselli / sonuç bazlı ölçek | Osman |
| Gümrük ve transit muhasebesi | TG-07, TG-19 | Vergiyi kim öder ve koridor hakkı kimindir | Alıcı/satıcı şirket veya devlet hesabı; endpoint owner / üçüncü ülke lisansı | Osman |
| Yürütme makamı geçişi | TG-08, TG-09, TG-10 | Seçim/darbe sonrası oyuncu kontrolü ve makam sahibi | Rol kaybı, halef kontrolü veya farklı kariyer; darbe mandatını iptal/askı | Osman |
| Şirket rolü ve yaşam döngüsü | TG-11, TG-12, TG-13 | OWNER ekonomik pay mı, yönetim makamı mı; kayyım kredisi var mı | Pay sahipliği / officer; tam faaliyet kilidi / özel restructuring finance | Osman |
| Karakter yaşamı ve savaş ilanı yetkisi | TG-14, TG-21 | RETIRED/DEAD aktör hangi kişisel/devlet eylemlerini yapabilir | Açık allowlist; yürütme makamı zorunlu; komutan yalnız teklif sunar | Osman |
| Demografi ve ortak kapasite | TG-15, TG-16, TG-20 | Hafıza taşıma, gerçek demografik geçiş ve yolcu/ton kapasitesi | Kohort ağırlıklı aktarım; skaler model / doğum-ölüm; ayrı / ortak kapasite | Osman |
| Fetih rejimi ve şirket attributionı | TG-22, TG-23 | Anlık ilhak mı açık işgal dönemi mi; yabancı tesisin kaderi | Atomik reconcile / OCCUPATION state; eski sahip / kamulaştırma / lisans | Osman |
| Teknoloji yürütmesi ve bilgi sisi | TG-24, TG-25 | Kademe 3–4 önceliğini kim yürütür; rakip teknoloji bilgisi ne kadar açıktır | Reddet / konsey gündemi; UNKNOWN / ESTIMATED / VERIFIED | Osman |
| Çağ savaş ve çalkantı metriği | TG-26, TG-27 | Payda ve olay kataloğu | Bütün savaş / ortak sınır / ağırlıklı cephe; dar olay / kanonik event adapteri | Osman |
| Konsey ve askerî üretimin temsil ölçeği | TG-30 | Stratejik sayaçlar kanonik mi, ayrıntılı fiziksel defterlere mi bağlanacak | Üst katmanı koru ve açık uyumluluk; tam domain komutu ve reçete geçişi | Osman |

### 7) Cross-Cutting Observations

- En sık hata sınıfı aynı kavramın iki komut/defterde farklı gerçeklik
  üretmesidir: şirket kredisi, savaş ilanı, yürütme makamı, fetih, konsey ve
  askerî üretim. Tek UI yaması bu sınıfı kapatmaz; ortak domain komutu ve makbuz
  gerekir.
- Test paketi “çalıştı” ile davranışın doğrulandığını karıştırıyor. Now 1,
  TG-01/TG-31 yaşam döngüsü boşluğunu ve TG-32/TG-33 gözlem kusurlarını
  tek güvenilir kabul temelinde kümeler.
- Para, kişi, kapasite ve sahiplik bulguları ortak invariant diline ihtiyaç
  duyuyor. Electron kabulü ve konsey transactionı bu assertion yardımcılarını
  paylaşmalı; ikinci kez farklı adlarla yazılmamalı.
- Plan kayıtlarında status değerleri ve depends_on kimlik biçimi drift etmişti.
  Statuslar kanonikleştirildi; bağımlılıklar plan yolu değil stabil id kullanacak
  biçimde, ilgili plan ilk kez güncellendiğinde düzeltilmelidir.
- SECURITY.md yoktu ve güvenlik bulgusu bu triage kapsamına alınmadı; bu durum
  güvenlik açığı olmadığına dair kanıt değildir.
