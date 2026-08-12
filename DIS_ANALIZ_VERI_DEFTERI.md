# Pixel RTS — Dış Analiz Veri Defteri

**Oluşturulma:** 31 Temmuz 2026  
**Amaç:** Proje dışından gelen teknik/tasarım analizlerini ana planın kesin kararı veya uygulanmış gerçekleriyle karıştırmadan, kaynak ve zaman bağlamıyla kalıcı olarak saklamak.  
**Kapsam:** Dünya simülasyonu–taktik savaş köprüsü ile serbest metin/LLM mimarisi hakkında iletilen iki analiz.

## Kayıt yöntemi

Her dış analiz dört ayrı katmanda tutulur:

1. **Kaynak iddiası:** Analistin söylediği veya önerdiği şey.
2. **Yerel kanıt:** Depodaki güncel plan, kod veya QA raporunun doğruladığı durum.
3. **Karar durumu:** Önerinin kabul edildiği anlamına gelmez; `open`, `candidate`, `accepted`, `rejected`, `superseded` veya `implemented` olabilir.
4. **Kabul kapısı:** Öneri uygulanırsa başarıyı ölçmek için gereken test.

Bu dosya bir görev listesi değildir. Buradaki hiçbir öneri yalnız kayda alındığı için uygulanmış veya onaylanmış sayılmaz.

### Ana planla kontrol düzeni

Bu defter yalnız arşiv olarak bırakılmayacaktır. Aşağıdaki noktalarda yeniden okunup ana planla karşılaştırılır:

1. Her yeni fazın kapsamı kesinleştirilmeden önce.
2. Bir fazın kabul/A-B/soak raporu yazılmadan önce.
3. Yeni ölçüm daha önceki dış iddiayı doğruladığında veya çürüttüğünde.
4. Faz sırası değiştirildiğinde ya da ara düzeltme fazı eklendiğinde.

Dış öneri ana plana kendiliğinden hükmetmez. Güncel kod ve QA kanıtıyla doğrulanan öneri `accepted-risk/active` durumuna alınır; çelişen öneri gerekçesiyle `rejected` veya `superseded` yapılır.

## Kaynak sicili

| Kayıt | Kaynak | Ana konu | Alındığı tarih | Durum |
|---|---|---|---|---|
| EXT-001 | `attachments/806d0640-3104-44de-b052-9523dafeec2f/pasted-text.txt` | Dünya simülasyonu, savaş köprüsü, ekonomik kırmızı sinyaller ve faz riski | 31.07.2026 | `recorded` |
| EXT-002 | `attachments/eca39cc6-f832-4dbe-9f2a-7ee4313b0cd0/pasted-text.txt` | Serbest metin NLU, LLM görev ayrımı, belirsizlik ve bellek maliyeti | 31.07.2026 | `recorded` |

---

## EXT-001 — Dünya simülasyonu ile savaş motorunun birleşimi

### Kaynağın ana değerlendirmesi

Analiz, taktik savaş çalışmasıyla katmanlı hikâye planının birbiriyle uyumlu olduğunu savunuyor. Özellikle Faz 47–51 arasında kurulacak `StoryBattleInputV1/ResultV1` köprüsünün şu alanları iki motor arasında taşıması gerektiğini belirtiyor:

- gerçek birlik manifestosu;
- moral;
- mühimmat ve ikmal;
- komutan kimliği;
- savaş sonrasında ham telemetri;
- sağ kalan ve kaybedilen birliklerin mutabakatı.

Bu çerçevede taktik maç içindeki mühimmatın yalnız denge parametresi olmadığı, Faz 17’deki `military_supplies` stokunun son tüketim noktası olduğu vurgulanıyor. Helikopter yakıtı da benzer şekilde Faz 48’deki stratejik yakıt/seferberlik katmanının taktik yansıması olarak değerlendiriliyor.

### Güçlü bulunan proje ilkeleri

Kaynak, projenin en güçlü yanını “öz-raporlama dürüstlüğü” olarak tanımlıyor:

- Teknik olarak geçen bir fazın otomatik olarak denge zaferi sayılmaması.
- Başarısız sonuçların açıkça yazılması.
- Yerel modelin Faz 3.1’de `0/5` almasının saklanmaması ve yetkisinin kısıtlanması.
- A/B durum karmalarının fazlar arasında taşınması.
- Savaş tarafındaki `MOTOR_DURUMU`, hasar matrisi ve deterministik beklenen-hasar ölçümlerinin aynı kültürü izlemesi.

Bu gözlem mevcut çalışma yöntemiyle uyumludur ve kayıt standardı olarak korunmalıdır.

### Bildirilen üç kırmızı sinyal

#### EXT-001-R1 — Gıda ve enerji çöküşü

**Kaynak iddiası:** Ticaret, fiyat ve ekonomik AI ayrı ayrı çalışsa bile gıda ve enerji stoklarının sıfıra çakılması toplam üretim kapasitesi ve üst-akış sanayileşme zincirinin yetersiz olduğunu gösteriyor. Sorun tek bir alt sistem değil; “makine üreten kapasiteyi önce kurma” planını hiçbir aktörün oluşturamaması.

**Güncel yerel kanıt:** Faz 24 A/B koşusunda 900 saniye sonunda ortalama gıda erişimi `%0`, enerji erişimi `%2,70`, kamu hizmeti `%27`, yaşam koşulu `%35,19` ölçüldü. 30 oyun yılı sonunda gıda ve enerji erişimi `%0` oldu. Bu nedenle dış analiz güncel veriyle doğrulanmıştır.

**Risk:** Faz 25–26 toplumsal tepki katmanları kalıcı kıtlık üzerinde kalibre edilirse, sonraki ekonomik denge düzeltmesi bütün şikâyet/protesto eşiklerini yeniden ayarlamayı gerektirebilir.

**Karar durumu:** `accepted-risk` — açık modern dünya borcu olarak kayıtlı; henüz çözülmedi.

**Önerilen kabul kapısı:** En az 900 saniyelik sekiz devlet koşusunda gıda/enerji erişimi için tasarım bandı tanımlanmalı; ekonomik AI, kronik açıkta üst-akış yatırım/ithalat/kamu müdahalesi üretmeli; çözüm bedava stok veya doğrudan kapasite enjeksiyonu kullanmamalı.

#### EXT-001-R2 — Barış başlangıcı kök çözüm değil

**Kaynak iddiası:** Faz 17.1’de bütün devletlerin barışla başlaması 152/152 fetih semptomunu durduruyor ancak devletlerin savaş dışı gündem eksikliğini çözmüyor. Uzun barış soak’ları şimdilik “kimse savaşamıyor” durumunu ölçüyor olabilir.

**Güncel yerel kanıt:** Başlangıç diplomasisi düzeltildi; ekonomi tarafında sınırlı şirket yatırımı ve devlet desteği var. Buna rağmen ekonomi, kamu hizmeti, iç siyaset, diplomasi ve güvenlik arasında ortak ulusal gündem henüz yok.

**Karar durumu:** `accepted-risk` — `MW-003 Devlet gündemi` ve `MW-002 Savaş ilanı` kayıtlarıyla uyumlu.

**Önerilen kabul kapısı:** Faz 46 ve Faz 55 sonrasında savaş ilanı ve uzun dönem toprak dengesi yeniden ölçülmeli. Barış, savaş yasağı değil; maliyet, amaç, meşruiyet ve alternatif gündem sonucunda oluşmalıdır.

#### EXT-001-R3 — Ekonomik AI ikinci kuşak plan kuramıyor

**Kaynak iddiası:** Ekonomik AI’nin 30 yılda yedi projede kalması, deterministik politika motorunun çok adımlı sanayileşme planı kuramadığını gösteriyor.

**Güncel yerel kanıt:** Faz 22 ve sonraki soak sonuçları yedi tamamlanmış projede kalıyor. Sanayi parçası darboğazı sonrasında yeni yatırım zinciri donuyor.

**Karar durumu:** `accepted-risk` — `MW-015` ve `MW-017` ile uyumlu.

**Önerilen kabul kapısı:** AI, nihai kıtlığı yalnız son ürün kapasitesiyle değil girdi bağımlılık grafıyla açıklamalı; en az iki veya üç adımlı yatırım sırası kurmalı; her adım gerçek nakit, kredi, fiziksel girdi ve tamamlanma süresinden geçmelidir.

### Riskli faz aralıkları

#### EXT-001-R4 — Faz 38.x serbest sohbet hattı

Kaynak, konuşma anlama → inanç ayrımı → yetki → müzakere yaşam döngüsü → tekrar önleme zincirini planın en iddialı ve en riskli bölümü olarak görüyor. Faz 3.1’deki `0/5` katı niyet/JSON/varlık bağlama sonucu nedeniyle serbest Türkçe ayrıştırmanın büyük el emeği doğurabileceğini söylüyor.

Önerilen yönler:

- daha güçlü modeli yalnız gerektiğinde kullanmak;
- niyet uzayını dar, kapalı bir kümeye indirmek;
- LLM başarısızlığında mekanik zinciri şablon ve deterministik ayrıştırıcıyla çalıştırmak.

Bu konu EXT-002’de daha ayrıntılı işlenmiştir.

#### EXT-001-R5 — Faz 64–66 ölçek riski

Kaynak, `100 kampanya × 10 yıl` ayrışma testi ve altı anti-meta botunun tek kişilik proje için çok pahalı olabileceğini belirtiyor. İlk turda `20 kampanya` ve `3 bot` ile başlanmasını, kabul kapısının daha sonra tam ölçeğe çıkarılmasını öneriyor.

**Karar durumu:** `candidate`. Kabul ölçüsünü küçültmek yanlış güven üretmemeli; bu nedenle küçük örnek yalnız erken hata bulma kapısı olabilir, nihai kabul sayılmamalıdır.

### Savaş köprüsü için somut veri gereksinimleri

| Konu | Stratejik kaynak | Taktik karşılık | Açık gereksinim |
|---|---|---|---|
| Mühimmat | `military_supplies` | Füze, balistik ve birlik mühimmatı | Tüketim ve sağ kalan mühimmat geri dönmeli |
| Yakıt | Gelecekteki stratejik yakıt/seferberlik | Helikopter ve motorlu birlik operasyon süresi | Savaş öncesi tahsis ve savaş sonrası tüketim mutabakatı |
| Birlik kimliği | Kalıcı kuvvet/manifesto kimliği | Maç içindeki birim örneği | Spawn’dan sonuç raporuna kadar ID değişmemeli |
| Kayıp/sağ kalan | Stratejik ordu envanteri | Taktik ölüm, hasar ve geri çekilme | Sonuç iki tarafta miktar/değer olarak korunmalı |
| Komutan | Karakter kimliği ve nitelikleri | Savaş kontrolörü/karar profili | Aynı komutan kimliği ve bağlamı geri raporlanmalı |
| Tahmin | Stratejik savaş kararı | Düello/rollout simülatörü | Gerçek manifesto ile savaş öncesi sonuç dağılımı |

### Faz 22.1 önerisinin zaman bağlamı

Kaynak, Faz 23’e geçmeden önce sanayi-parçası bootstrap kilidinin çözülmesini öneriyor. Bu tavsiye alındığında yerel uygulama Faz 24’ü tamamlamış durumdadır; dolayısıyla önerinin özgün sıralaması artık uygulanamaz.

**Güncel yorum:** Öneri `superseded-by-timeline`, fakat dayandığı risk geçerlidir. Faz 25’in şikâyet hafızası geliştirilebilir; ancak eşikler kalıcı kıtlığa göre “normal” kabul edilmemeli. Ekonomik stabilizasyon için ayrı bir ara faz veya açık denge kapısı hâlâ değerlendirilebilir.

---

## EXT-002 — Serbest metin için anlama ve gerçekleştirme ayrımı

### Temel ilke: anlama, renk katma değildir

Kaynak serbest metin özelliğini iki bağımsız probleme ayırıyor:

#### 1. Anlama / NLU

Oyuncunun cümlesini mekanik yapıya dönüştürme görevi:

- `speechAct` seçimi;
- emtia, ülke, şehir, depo, kişi ve sözleşme rollerinin çıkarılması;
- iddiaların, koşulların ve çözülmemiş belirsizliklerin ayrılması;
- yetki, bilgi, lojistik ve çıkar denetimine girecek `NegotiationCase` oluşturulması;
- verilen sözün ve sonucunun kalıcı dünya hafızasına yazılması.

Projenin asıl farklılaştırıcı değeri buradadır: oyuncunun yazdığı cümle yalnız güzel cevap üretmemeli, gerçek stok/sevkiyat/söz/ilişki sonucuna dönüşmelidir.

#### 2. Gerçekleştirme / yüzey dili

Motorun verdiği kesin kararı karakterin sesiyle ifade etme görevi:

- resmiyet;
- doğrudanlık;
- hitap tercihi;
- karaktere özgü kelime ve ritim;
- yakın geçmişteki ifadeleri tekrar etmeme.

Bu katman önemlidir fakat mekanik gerçeğin sahibi değildir. Şablon + slot doldurma tabanı üzerinde küçük veya büyük modelle zenginleştirilebilir.

### Mevcut model hakkındaki maliyet değerlendirmesi

**Kaynak iddiası:** Yaklaşık 4,5 GB yerel model, Faz 3.1 ölçümünde değerli görev olan katı niyet/JSON/varlık bağlamada `0/5`, ikame edilebilir görev olan akıcı Türkçe metinde daha başarılı oldu. Bu nedenle modelin mevcut görev dağılımında pahalı kaynak ucuz işe harcanıyor.

**Yerel kanıt:** Faz 3.1 yeterlilik raporu modelin kritik hakem veya mekanik karar sahibi yapılmamasını gerektiriyor. Mevcut LLM sözleşmesi doğrulayıcı ve şablon fallback’i kullanıyor.

**Karar durumu:** `accepted-principle` — mekanik gerçeğin sahibi deterministik motor olmalıdır; model yetkisi doğrulanan görevle sınırlanmalıdır.

### Anlama maliyetini düşüren üç kaldıraç

#### EXT-002-N1 — Teyit sorusu ve belirsizlik bütçesi

Yüksek etkili, düşük güvenli ayrıştırmada sistem tahmin yürütmemeli. Karakter doğal bir teyit sorusu sormalıdır:

> “Hangi sevkiyattan bahsediyorsunuz; Britanya siparişi mi?”

Bu tasarım ayrıştırıcının her girdide yüzde 95 doğruluk zorunluluğunu azaltır. Yaklaşık yüzde 70 doğru ayrıştırma, güven kalibrasyonu ve doğru zamanda soru sorma ile oynanabilir hâle gelebilir.

**Kabul kapısı:** Yanlış yüksek etkili işlem oranı, doğru otomatik çözüm oranı, gereksiz teyit oranı ve teyitten sonra çözüm oranı ayrı ölçülmelidir. Yalnız genel doğruluk skoru yeterli değildir.

#### EXT-002-N2 — Kapalı niyet kümesi ve gramer kısıtlı çıktı

Yaklaşık yirmi `speechAct` sınıfı serbest JSON yerine kapalı seçim olarak ele alınmalıdır. `node-llama-cpp` GBNF veya eşdeğer gramer kısıtıyla şema dışı çıktı üretimini fiziksel olarak engelleyebilir.

Beklenen kazanç:

- bozuk JSON sınıfı ortadan kalkar;
- katalog dışı niyet/alan üretimi engellenir;
- görev “serbest metin yaz”dan “doğru sınıf ve alanı seç”e dönüşür;
- doğrulayıcı hata ile anlam hatası birbirinden ayrılır.

**Kabul kapısı:** Faz 3.1 veri seti serbest JSON ve gramer-kısıtlı kipte aynı girdilerle çalıştırılmalı; şema geçerliliği, katı niyet doğruluğu ve alan doğruluğu ayrı raporlanmalıdır. Hedef öneri `4/5`; bu değer proje kararı değildir, dış analizin önerdiği eşiktir.

#### EXT-002-N3 — Varlık bağlamayı modelden ayırma

Model “bu ifadede emtia/tedarikçi ülke/hedef depo rolü var” diyebilir; fakat gerçek kimlik seçimi deterministik dünya çözümleyicisine ait olmalıdır.

Çözümleyicinin bağlamı:

- ülke, şehir, şirket, karakter, depo ve emtia sicili;
- yazım ve ek toleranslı bulanık eşleme;
- oyuncunun bulunduğu şehir/ekran;
- konuşulan karakter;
- açık `NegotiationCase`;
- son anılan varlıklar;
- oyuncunun sahip olduğu veya bildiği hedefler.

**Kabul kapısı:** Modelin uydurduğu hiçbir kimlik doğrudan dünyaya yazılamamalı. Çözümlenemeyen veya birden fazla eşleşen yüksek etkili varlık teyit istemelidir.

### Gerçekleştirme için katmanlı kalite merdiveni

| Seviye | Motor | Görev | Mekanik yetki | Beklenen kullanım |
|---|---|---|---|---|
| Taban | LLM yok | Ses profilli şablon + slot doldurma + tekrar önleme | Yok | Her makinede ve her zaman |
| Orta | Küçük 3–4B quantize model | Kesin motor kararını yeniden ifade etme | Yok | RAM/performans uygunsa sıradan sahneler |
| Üst | Mevcut 8B/14B | Yüksek bahisli A-seviye karakter sahnesinde zengin ifade | Yok | İsteğe bağlı ve seyrek |

Her seviye aynı mekanik `NegotiationCase` sonucunu ifade etmelidir. Model seviyesi değiştiğinde anlaşma, fiyat, miktar, yetki, bilgi ve söz sonucu değişmemelidir.

**Yerel uygulama güncellemesi — Faz 38, 9 Ağustos 2026:** Taban seviye uygulandı. `StoryCharacterSpeech.js`, doğrulanmış hakem kararını ses profilli fakat mekanik yetkisiz Türkçe cümleye dönüştürüyor; son altı tam cümle ve son iki gerçek hitap kalıcı karar geçmişinden denetleniyor. Özgür LLM metni, modelin önceki `0/5` gerçek/tekrar kapısını geçmediği için bu hatta kullanılmadı. Sekiz oyuncu sözü + bir özel AI–AI sözü probunda tekrar/gizlilik/save-load kapıları geçti. Bu kayıt `implemented-baseline`dır; orta/üst model zenginleştirmesi kabul edilmiş veya gerekli sayılmaz, Faz 38.1 serbest oyuncu anlaması ve Faz 38.2 uzun-diyalog kalite kapıları ayrıdır.

### Model belleği için oturumluk misafir yaklaşımı

Kaynak, modelin oyun boyunca RAM’de tutulmamasını öneriyor:

- sohbet açılırken tembel yükleme;
- sohbet kapanınca veya belirli sessizlik süresi sonunda boşaltma;
- yükleme süresini tematik kabul/geçiş sahnesiyle gizleme;
- düşük RAM’de otomatik şablon tabanına düşme;
- savaş, harita ve dünya simülasyonu sırasında model belleğini serbest bırakma.

**Karar durumu:** `candidate`. `llm-host.js` tembel yükleme davranışı ayrıca kod/proses ölçümüyle doğrulanmalı; “sohbet dışında RAM maliyeti sıfır” iddiası ölçülmeden gerçek kabul edilmemelidir.

**Kabul kapısı:** Soğuk yükleme süresi, tepe RAM, sohbet kapanışı sonrası boşaltma süresi, kalan RSS/VRAM ve yeniden yükleme süresi gerçek EXE’de raporlanmalıdır. Düşük bellek fallback’i mekanik sonucu değiştirmemelidir.

### Önerilen gelir–gider kararı

Kaynak serbest metnin değerli olduğu sonucuna üç koşulla varıyor:

1. Yatırımın ağırlığı cevap güzelliğine değil anlama, teyit ve mekanik müzakere zincirine gitmeli.
2. LLM’siz modda oyuncu serbest metin yazabilmeli ve aynı mekanik sonucu alabilmeli.
3. Model kalıcı oyun servisi değil, gerektiğinde yüklenen ifade katmanı olmalı.

Bu çerçevede projenin farklılaştırıcı iddiası “oyunda LLM var” değildir. Asıl iddia şudur:

- karakter yalnız gerçekten bildiği şeyi kullanır;
- yalnız gerçekten yetkili olduğu işlemi taahhüt eder;
- karar kendi çıkarı, kişiliği, ilişkisi ve hafızasıyla sınırlıdır;
- oyuncunun cümlesi doğrulanmış mekanik sonuç ve kalıcı kayıt üretir;
- model kapalı olsa bile bu zincir çalışır.

### Faz 38 öncesi önerilen deney

Faz 3.1 tezgâhı şu dört kipte aynı veriyle yeniden çalıştırılmalıdır:

1. mevcut serbest JSON 8B;
2. kapalı niyet + GBNF kısıtlı 8B;
3. deterministik/fuzzy varlık çözümleme + 8B niyet/rol çıkarımı;
4. LLM’siz kural tabanı + teyit döngüsü.

İsteğe bağlı beşinci kip, mevcut Qwen-14B modelini yalnız anlama kıyaslamasında kullanabilir. Karşılaştırma metrikleri:

- niyet doğruluğu;
- alan/rol doğruluğu;
- varlık bağlama doğruluğu;
- şema geçerliliği;
- yüksek etkili yanlış işlem;
- doğru teyit;
- gereksiz teyit;
- teyit sonrası çözüm;
- gecikme;
- tepe RAM/VRAM;
- mekanik sonuç eşitliği.

---

## İki analizin ortak sonucu

İki kaynak farklı sistemleri incelese de aynı mimari ilkeye ulaşıyor:

> Karmaşık veya akıllı görünen katman, fiziksel ve doğrulanabilir çekirdeğin sahibi olmamalıdır.

- Savaşta güzel taktik anlatısı, gerçek manifesto/mühimmat/yakıt/sağ kalan mutabakatının yerine geçemez.
- Ekonomide ayrı ayrı çalışan ticaret/fiyat/AI, sürdürülebilir fiziksel üretim zincirinin yerine geçemez.
- Sohbette akıcı cevap, doğru niyet/varlık/yetki/bilgi/söz zincirinin yerine geçemez.
- Uzun soak’ın çökmeden bitmesi, modern dünya veya oyun dengesi başarısı değildir.

Bu ortak ilke mevcut proje disiplinine uygundur: karar ve kaynak değişimi deterministik motorlarda; LLM ve sunum katmanları açıklama, ifade ve sınırlı öneri görevlerinde kalmalıdır.

## Faz 22.1 ara kanıt kontrolü — 31 Temmuz 2026

EXT-001-R1 ve EXT-001-R3, ara uygulama sırasında yeniden doğrulandı. İlk sistemde ayrı ayrı geçerli ticaret, fiyat, şirket ve ekonomik AI defterlerine rağmen 900 saniye sonunda gıda erişimi `%0`, enerji `%2,70` idi. Sorun tek bir puan ağırlığı değil, birbirine bağlı fiziksel ve mali zaman ölçekleriydi.

Ölçümle bulunan kök nedenler:

- Enerji üretimi sanayi parçası; sivil sanayi enerji ve ham madde; tarım enerji tüketiyor. Yatırım emaneti işletme bakım rezervini ayırmadan parça çektiğinde yeni kapasite çalışan santralleri durduruyordu.
- Üretim gideri takas havuzuna eklenmeden gelir sınırı hesaplandığı için bölge/dosya sırasına bağlı şirketler arası para aktarımı oluşuyordu. Para yaratmadan atomik takas sırası düzeltildi.
- Eski şehir büyümesi nüfusa oranlı yıllık demografi değil, gerçek saniye başına sabit nüfus ekliyordu; yaklaşık 7,5 oyun yılında gıda talebi `%74` büyüyordu. Faz 22.1 yolu yıllık, nüfusa oranlı ve temel ihtiyaç erişimine bağlı büyümeye geçirildi.
- Üretim-girdisi siparişi yalnız bir ekonomi penceresini kapsarken ortalama rota süresi `14,28` saniye, ekonomi penceresi `4` saniyeydi. Yoldaki/açık miktarı düşen dört pencerelik toplu boru hattı kuruldu.

İki hipotez kanıtla reddedildi: ticareti üretimden önce çalıştırmak erişimi düşürdü; hane kıtlığı için ihracat rezervini kör biçimde gevşetmek enerjiyi üretim merkezlerinden çekip gıda üretimini azalttı. Bu yollar kalıcı çözüm sayılmadı.

Güncel aday 900 saniyede `32` tamamlanmış gerçek proje ve geçerli fiziksel/mali defterlerle son 300 saniye ortalamasında gıda `%42,75`, enerji `%44,17`, yaşam koşulu `%52,22` üretti. Bu eski tabana göre maddi iyileşmedir fakat planın `%60/%70` kabul kapısını geçmez. Ayrıca `179` açık sipariş, `237` aktif sevkiyat ve özellik-kapalı kontrol karması uyuşmazlığı vardır. Bu nedenle EXT-ACT-001/002 durumu `active-phase22.1` olarak kalır; Faz 25 açılmaz.

### Faz 22.1 lojistik ve finans ara kanıtı — 31 Temmuz 2026

Analiz defterindeki “katman tek başına doğru görünürken birleşik sistem kötüleşebilir” uyarısı iki kez yeniden doğrulandı. Üretim girdilerinin tamamını normal kıtlık sevkiyatlarından önce çalıştırmak parça üretimini artırmasına rağmen son 300 saniye gıda/enerji erişimini `%48,47/%53,17→%47,56/%50,46` düşürdü. Koridor penceresinin yalnız dört erken sevkiyatını parçaya ayıran daha dar deney de `%44,20/%45,30` ve `18` projeye geriledi. İki sıra değişikliği geri alındı.

Kalıcı sonuç veren değişiklik, başarısız açık emirlerin her tik sınırsız denenmesini kaldıran toplam deneme tavanı ile `8–64` saniyelik artan retry aralığıdır. Tek 900 saniyelik simülasyon süresi `65,61→34,63 sn`, açık emir `179→151`, aktif sevkiyat `237→209` oldu; final gıda/enerji erişimi `%47,18/%50,58` ve bütün doğrulayıcılar geçerli kaldı. Geçici koridor/finans hatasında üretim emrini hemen iptal etmek yerine yüksek öncelikli, pending miktarı tekilleştirilmiş `OPEN` durumda tutan takip adayı son 300 saniyede gıda `%48,32`, enerji `%53,62`, yaşam koşulu `%57,00` ve `33` proje üretti. Kapı yine geçmedi.

Alıcı üretim şirketini siparişe bağlayıp şirket nakdi/banka kredisi/ticaret emaneti üzerinden ödeme yaptıran ilk finans deneyi muhasebe doğrulayıcılarını geçti, fakat birleşik ekonomi sonucunu ağır biçimde bozdu: son 300 saniye gıda/enerji `%3,94/%6,42`ye düştü, tamamlanan proje `33→12` oldu ve `10` şirket iflas etti. Satıcıya ikinci kez ödeme yapmayan, alıcı bedelini mevcut merkezî takas havuzuna geri döndüren ikinci deney de `%4,27/%4,19`, `11` proje ve `9` iflasla başarısız oldu; `marketClearingCash` yaklaşık `5,51`e indi. İki deney de geri alındı. Kök neden yalnız kredi tavanı veya ödeme hedefi değildir: üretim anında bütün çıktı gerçek alıcı olmadan otomatik olarak takas havuzuna satılıyor; nihai hane/devlet/şirket satışları gerçek ödeyenlerden üreticiye akmıyor ve para üretici şirketlerde birikiyor. Bu nedenle şirket ithalat finansmanı tek başına eklenemez. Önce hane tüketimi, şirketler arası girdi, devlet alımı ve ihracatı aynı stok-maliyet/borç-alacak/ödeme çevriminde kapatan, geliri üretim anından satış anına taşıyan dolaşım sözleşmesi kurulmalıdır. Aksi çözüm ya şirketleri iflas ettirir ya da görünmez para yaratır.

Yeni kök neden: üretim girdisi ithalatı hedefteki sanayi şirketine bağlanmıyor (`buyerCompanyId:null`); sınır ötesi ödeme `storyBudgetReserveTrade` üzerinden devlet hazinesine ve devlet borç tavanına gidiyor. Son adayda `88` üretim ithalat emri açık, enerji ithalatlarının `64`ü `TRADE_FINANCE_DENIED`. Şirket girdisini devletin sessizce ödemesi hile olur; doğru çözüm alıcı şirket kimliği, şirket nakdi/banka işletme sermayesi, sevkiyat escrow’su, teslimatta giderleşme ve kayıp/iptalde iade zinciridir. EXT-ACT-001/002 açık kalır.

## Faz 22.1E satışta gelir mikro kanıtı — 1 Ağustos 2026

Önceki iki başarısız şirket-finans deneyi, ödeme hedefinden daha temel bir kusura işaret etmişti: üretim anında gerçek alıcı olmadan otomatik gelir yazılması. Bu hipotez varsayılan-kapalı `economy.saleSettlement` yolu ile doğrudan sınandı.

- İlk ölçümde `OPERATING_CAPITAL` gider sayıldığı için maliyet hatalı biçimde `2,045` görünüyordu. Düzeltmeden sonra `2` sermaye yalnız likidite eşiği; `1` gıdanın gerçek fiziksel enerji maliyeti `0,045`, beklenen satış geliri `0,42` oldu. Üretim fişinde şirket geliri yine `0` kaldı.
- Hane `0,5` birim satın aldığında `0,21`; ikinci şirket `0,25` birim satın aldığında `0,105` satış geliri ancak mülkiyet geçişinde doğdu.
- Faturalar gerçek satıcı şirketi, `HOUSEHOLDS` veya gerçek alıcı şirketi, miktarı, satış bedelini, maliyeti ve ortak ilişki kimliğini taşıdı.
- Birleşik para üretim ve iki satış boyunca `90.880` kaldı. Şirket çift kaydı, şirket envanter maliyeti ve fiziksel stok–lot aynası geçti.
- Kayıt/yükleme envanter lotlarını ve faturaları birebir korudu.
- Varsayılan kapalı 900 saniyelik kontrol `230bc647…ef36` karmasını ve `33` projeyi aynen üretti; tam test paketi geçti.
- Gerçek simülasyon akışı mikro probdan daha sert bir eksik gösterdi: `4 sn`de `760` depolama, `8 sn`de `10` ticaret kargosu, `60 sn`de `8` yatırım emaneti stok–lot uyuşmazlığı oluşuyordu. Sırasıyla FIFO bozulma/değer düşüklüğü, `shipment:<id>` sahipli kargo ve `escrow:<preparationId>` yatırım lotu ile kapatıldı.
- Özellik açık `60` ve `120` saniyelik birleşik koşularda fiziksel stok–lot aynası, şirket muhasebesi, ticaret koruma denklemi ve ekonomik AI hazırlık defteri birlikte sıfır sorunla geçti. Tam regresyon paketine `60 sn` açık-akış kapısı eklendi.

Bu sonuç Faz 22.1E kabulü değildir. İşletme sermayesi semantiği, devlet/ordu/toplu şirket ödeyenleri ve sınır ötesi ticari mülkiyet sonraki ölçümde kapatıldı; ayrıntı aşağıdadır. 900 saniyelik açık treatment hâlâ yoktur ve bayrak varsayılan kapalı kalmalıdır.

## Faz 22.1E gerçek ödeyen ve sınır ötesi mülkiyet kanıtı — 1 Ağustos 2026

Özellik-açık eski sınır akışında alıcı devlet hazinesiydi; teslimatta ihracatçı şirket gelir yazmasına rağmen kargo lotu aynı şirkette kalıyor, hedefteki nihai satış ikinci gelir üretebiliyordu. Bu, yüksek erişim sonucunun bir bölümünü sahte yapan çift ödeme/mülkiyet hatasıydı.

- Hane, şirket, devlet ve ordu talepleri gerçek ödeyen kimliklerine ayrıldı.
- Sınır ötesi siparişte hedef ülkenin ilgili sektör şirketi gerçek `buyerCompanyId`; şirket nakdi `ASSET:TRADE_ESCROW` hesabında bloke ediliyor.
- Kargo yalnız sözleşmedeki satıcı şirketin lotlarından kuruluyor. Teslimatta satıcı gelir+COGS yazıyor; ithalatçı aynı bedelle envanter alıyor ve fiziksel lotun sahibi oluyor. Hedefteki perakende satış bundan sonra ayrı ve tek bir satış.
- Satıcı şirketi olmayan açılış/takas stoğu şirket ödemesine zorlanmıyor. Hedefte ödeme bekleyen yük terminal `HELD` durumunda geçerli ve yeniden denenebilir.
- `20 sn` kaydı `26` aktif şirket rezervasyonu ve `307,0511` escrow ile birebir açıldı; `8 sn` devamdan sonra şirket, bütçe ve ticaret doğrulamaları geçti.
- Doğru `300 sn` treatment: `464` sınır ötesi emir, `455` şirket alıcısı, `202` teslimat; gıda `%43,99`, enerji `%50,00`, yaşam koşulu `%54,83`, `7` proje, sıfır iflas. Bölgesel, şirket, commerce, ticaret, bütçe, pazar ve ekonomik AI doğrulamalarının tamamı geçti.

Bu teknik doğruluk denge kabulü değildir; doğru ödeme önceki şişkin dolaşımı kaldırdığı için erişim geriledi. Otomatik banka işletme kredisi deneyi de reddedildi: toplam şirket borcu yaklaşık `1.010→1.737`, tamamlanan proje `7→5`, gıda/enerji `%43,99/%50,00→%36,86/%40,68` oldu. Banka rezervini yatırım kapasitesinden kısa vadeli ithalata taşıyan kredi, teminat/perakende marjı/ayrı risk bütçesi olmadan açılamaz. Gıdada gerçek toplam üretim açığı, enerjide ülke-bölge dağılımı ve ödeme ufku ayrı çözülmelidir. EXT-ACT-001/002 açık kalır.

Sonraki kök-neden turunda reçete girdileriyle eski tesis işletme/bakım vekillerinin aynı enerji, parça ve elektroniği iki kez tükettiği kanıtlandı. Settlement yolunda bu üç vekil kaldırıldı; gerçek şirketler arası reçete faturaları korunarak `60 sn`de `3.996` COMPANY faturası oluştu. Güncel `300 sn` sonucu gıda `%55,21`, enerji `%65,89`, yaşam koşulu `%61,47`, `6` proje ve sıfır iflastır; bütün doğrulayıcılar geçti. Enerji kabul eşiğini geçti, gıda ve yaşam koşulu geçmedi. Son tikte `64` tarım bölgesinin enerji nedeniyle tamamen durması dağılım/tahsis borcunu açık bırakır. Enerji hedefi, ayrı şebeke bütçesi, upstream sıra, ölü operasyonel bootstrap bağlantısı ve geniş lojistik bütçesi deneyleri kötüleştiği için geri alındı.

## Faz 22.1E üretim-girdisi tahsis ve uzun dönem kanıtı — 1 Ağustos 2026

Çift tüketim düzeltmesinden sonra kalan sorun toplam enerji kapasitesi gibi görünse de son tik kayıtları daha dar bir arızayı gösterdi: kurulu kapasitenin teorik talebi kaynak bölgede rezerv sayıldığı için başka girdisi veya finansmanı eksik bölgeler enerji/parçayı kilitliyor; çalışan tarım ve enerji zinciri ise gerçek girdiye erişemiyordu.

- Settlement yolunda kaynak rezervi teorik istek yerine önceki tikte gerçekten tüketilmiş üretim girdisine bağlandı. Ters yöndeki ping-pong da kapatıldı: bu kaynak sıfır çevrimlik `BLOCKING` darboğazıysa yeni ulaşan stoktan yalnız gözlenen karşılanmamış çevrim kadar tutuluyor ve stok bir sonraki üretimden önce yeniden ihraç edilmiyor. Özellik kapalı yolun eski davranışı korunuyor.
- Üretim-girdisi talepleri yalnız dolum yüzdesine göre değil, sektör zincir kritikliğine göre sıralanıyor: sanayi parçasında enerji/extraction, enerjide civil/extraction ve kriz anında tarım öne çıkıyor.
- Hane gıda dolumu `%50` altındayken parça üretim kapsaması `%120` üstündeyse `DOWNSTREAM_FOOD`; gıda `%65`e çıkınca veya parça kapsaması `%95` altına inince `UPSTREAM_RECOVERY` uygulanıyor. `%85` çıkış eşiği parçayı çökerttiği için reddedildi.
- Faz 28’e kadar geçici gerçekleşen-marj vekili `%90` hane geliri / `%10` şirket işletme sermayesi olarak kapalı dolaşımda paylaştırılıyor. İki mevcut cüzdan arasında transferdir; para yaratmaz. `%80` uzun dönemde haneyi, `%100` şirketleri nakitsiz bıraktığı için ikisi de reddedildi.
- Düz-hat coğrafi kaynak seçimi rota gecikmesini büyüttü; tarımı sürekli enerji önceliği yapmak 300 sn sonucunu düşürdü; bakım girdisini yarıya indirmek açılış işletme sermayesini tüketip üretimi sıfırladı. Üçü de geri alındı.

Doğrulanmış `300 sn` sonucu gıda `%60,73`, enerji `%72,52`, yaşam koşulu `%64,26`; `11` tamamlanan + `4` aktif proje, sıfır iflas. `900 sn` finali `%63,94/%68,41/%65,52`; `600–900 sn` dahil örnek ortalaması `%56,22/%63,61/%62,72`. Şirket nakdi `83.756,81`, takas nakdi `73.782,77`; `39` proje tamamlandı, `1` proje aktif kaldı. Bölgesel, ihtiyaç, ticaret, piyasa, bütçe, şirket, commerce ve ekonomik-AI doğrulamaları geçti.

Bu bir denge kabulü değildir. Son tikte `66` tarım bölgesi enerji, `38` enerji bölgesi sanayi parçası nedeniyle tamamen blokeli; yaklaşık `1.012,9` enerji ve `108,3` parça üretim-girdisi kargosu hâlâ yoldadır. Kapasite özeti ve `39` tamamlanan proje yeni kapasite eklemenin tek başına kanıtlı kök nedene cevap olmadığını gösteriyor. Sıradaki çalışma, hile veya bedava ışınlama olmadan merkez stoktan bölgesel üretime sevkiyat birleştirme ve teslim fişi kuran iç dağıtım sözleşmesidir. Varsayılan özellik kapalı kaldı; değişiklik sonrası tam regresyon eski `230bc647…ef36` karmasıyla geçti.

### Ülke-içi enerji kilidi ve yanlışlanan dağıtım hipotezleri

Yeni ham kırılım rota gecikmesi varsayımını reddetti. `300 sn`de üretim-girdisi rotaları ortalama `14,44 sn`, enerji üretim girdisi `6,91 sn`; fakat dünya enerji stoğu `42.419`, enerji üretimi `4.266`, hane+kamu talebi `4.026` iken yalnız `2.602` teslim edildi. Aynı anda gıda üretimi/talebi `1.073/1.780`. Dolayısıyla gıda açığı gerçektir ama birincil nedeni tarım kapasitesi bonusu değil, mevcut enerjinin tarım bölgelerine bölge-içi tahsis edilememesidir.

| Deney | 300 sn gıda / enerji / yaşam | Karar |
|---|---:|---|
| Mevcut doğrulanmış aday | `%60,73 / %72,52 / %64,26` | Referans; korunuyor |
| Kargoyu üretimden önce ilerletme | `%62,54 / %67,31 / %62,58` | Enerji ve proje zincirini bozdu; geri alındı |
| Gerçek rotaya göre tüm kaynakları seçme | `%62,12 / %70,79 / %63,25` | Rota kısaldı, toplam yaşam düştü; geri alındı |
| Gerçek rotayı yalnız gıdaya uygulama | `%60,82 / %65,76 / %62,12` | Küçük/yakın kaynaklar ağ verimini bozdu; geri alındı |
| Tek yükte kapatan en yakın yerli gıda kaynağı | `%56,67 / %63,97 / %60,59` | Merkez stok sürekliliğini bozdu; geri alındı |
| Karşılanmayan kişi-ihtiyacına göre talep | `%58,00 / %61,05 / %60,89` | Çok sayıda küçük talep sevkiyat bütçesini tüketti; geri alındı |
| Ülke başına ilk enerji sevkiyatı + kota 8 | `%59,63 / %63,39 / %61,69` | Yüksek etkili zincirler yarım kaldı; geri alındı |
| Yalnız enerji kotası `6→8` | `%59,73 / %69,73 / %62,33` | Hammadde/parça yuvalarını dışladı; geri alındı |
| Elektronik `2→0`, hammadde `4→6` | `%61,07 / %67,06 / %63,31` | Parça arttı ama extraction/hammadde üretimi çöktü; geri alındı |
| Toplam/enerji üretim girdisi kotası `18/6→20/8` | `%57,79 / %67,62 / %61,21` | Diğer kaynak yuvaları korunsa da sistem sonucu düştü; geri alındı |
| Başarısız açık emri pending yükten çıkarma | `%60,68 / %68,32 / %62,67` | Aynı finanse edilemeyen ithalat çoğaldı, proje `11→6`; geri alındı |
| Üretim + dört hane penceresini tek enerji kargosunda taşıma | `%56,19 / %65,19 / %61,34` | Birkaç hedefte `1.870` enerji yolda yığıldı; geri alındı |
| Dört üretim + bir hane penceresini tek enerji kargosunda taşıma | `%59,36 / %70,55 / %63,69` | Enerji kısmen korundu, gıda/refah ve proje dengesi düştü; geri alındı |

Kalıcı teşhis için `regionalOperationalSummary.countryBreakdown` eklendi. Sekiz ülkenin stok, üretim, üretim tüketimi/açığı, nihai talep/teslimat ve bloklayıcı darboğazları tek raporda tutuluyor. Ülke enerji stoklarının toplamı dünya stok toplamıyla regresyon testinde mutabık olmak zorunda. `60 sn` kanıtında ülke 5 `6.333` enerji + `7` blokeli tarım, ülke 7 `4.907` + `5`, ülke 1 `3.144` + `11`; `300 sn`de sırasıyla `12.516/7`, `7.246/5`, `4.700/11`. Bu, sıradaki çözümün daha fazla dispatch değil; merkez stoktan bölgesel üretim girdisine fiziksel olarak toplulaştırılmış, teslim fişli iç dağıtım sözleşmesi olması gerektiğini gösterir.

Tanı artık ülke toplamının gerçekten kullanılabilir olup olmadığını da ayırıyor: üretim+tüketim işletme rezervi, rezerv üstü yerli sevk miktarı, sahipli commerce envanteri, üretim-girdisi emir/hata durumu, yönlü kargo ve blokeli bölge listesi aynı satırda. Ülke 5'in `12.516` enerjisinin `12.067`si sevk edilebilir; sahipli lot toplamı fiziksel stokla örtüşür. Buna karşılık blokeli yedi tarım hedefinin her birinde enerji stoğu tam `0`dır. Sorun sahipsiz veya kağıt üstü stok değil, merkez/hub stokunu bölgesel tüketim bacaklarına dağıtan admission ve teslimat sözleşmesinin olmamasıdır.

## Dış analiz — tek ekonomi/altı mercek ve karakter başlangıcı — 1 Ağustos 2026

İki dış analiz birlikte incelendi. Mimari yön kabul edildi, fakat faz numaraları ve bazı kişilik varsayımları kanıt sayılmadı.

### Kabul edilen kararlar

- Şirket sahibi, belediye başkanı, cumhurbaşkanı/başbakan, komutan, ajan ve sivil için ayrı ekonomi sistemleri kurulmayacak. Tek kanonik stok, fiyat, şirket, bütçe ve nedensellik defteri; rol bazlı yetki, bilgi doğruluğu ve zaman ufku üretecek.
- Aynı kıtlık altı farklı görev ve risk doğurabilir. Hedef kıtlığı tamamen silmek değil; periyodik/yerel, sebebi izlenebilir, erken belirtili, rol başına meşru müdahalesi ve toparlanma yolu olan kıtlık üretmektir.
- Mevcut kronik temel ihtiyaç düşüklüğü “oynanış üreten kıtlık” diye meşrulaştırılamaz. Bütün bölgeleri uzun süre düşük erişime kilitleyen ve geçerli karşı hamle bırakmayan durum hâlâ Faz 22.1 denge arızasıdır.
- Oyuncu rolü serbest UI kamerası değildir. Aynı aktör makam/şirket/görev değişimini gerçek olayla yaşarsa mercek değişebilir; salt projeksiyon dünyayı değiştiremez.
- Altı rolün ilk sürüm derinliği aynı anda eşitlenmeyecek. Bu kalıcı kalite sınıfı değil teslim sırasıdır: komutan ve şirket sahibi tam döngü; yönetici rolleri kurumsal döngü; ajan ActorBelief hattından sonra; sivil önce sınırlı kriz/prolog kanıtı.
- Karakter yaratımında 12 karar korunacak, ancak sabit `4/4/4` yerine role göre güvenlik / yönetim-ekonomi / siyaset-toplum-bilgi dağılımı kullanılacak.
- Sorular öz-bildirim değil bedelli vinyetler olacak. Her seçenek gerçek kazanç, gerçek bedel, kanonik sistem sahibi ve en geç ilk 10 oyun dakikasında görünür sonuç taşıyacak.
- Profil eylem yasaklamayacak. Profile ters fakat yetkili karar uygulanabilecek; ilişki, medya, destek, güven ve fırsat maliyeti tepki verecek.
- Geçmiş ağacı kozmetik biyografi olmayacak. Her anlamlı geçmiş, tarihli nedensel olay, `WorldFact`, yalnız bilen aktörlerde kaynaklı `ActorBelief`, ilişki/kurum izi ve gelecek tepki kancası üretecek.

### Düzeltilen veya reddedilen varsayımlar

- “Muhalif↔yandaş” kalıcı kişilik ekseni olamaz; hükümet değişince ilişki değişirken karakter kaybolmaz. Çekirdek `institutionalPosture` (süreklilik↔kopuş) sabit kalır; `currentRegimeAlignment` mevcut iktidar, patronaj, ilişki, ideoloji ve olay geçmişinden türetilir.
- Soru metni ve görünür rol etiketi değişebilir, saklanan eksenin semantiği rol bazında değişemez. Aynı sayının ajan için “hangi tarafın ajanısın”, başkan için “eski düzenle barışık mısın” anlamına gelmesi karşılaştırma ve AI davranışını bozar; bunlar ayrı ilişki/türev alanlarıdır.
- Dış metindeki faz eşlemeleri güncel planla birebir doğru değildir: şirket çekirdeği Faz 21, bölge/ekonomi zemini Faz 11–24, kurum/yönetim Faz 28–33, bilgi/ajan hattı Faz 38.1 ve 57 çevresindedir. Kavram kabul edildi, eski numaralar uygulanmadı.
- “Simülasyonun `%70`i yazıldı” ifadesi ölçülmüş ilerleme değildir ve durum raporuna alınmadı.
- “Sivil çeyrek rol kalmalı” nihai ürün kararı yapılmadı. Yalnız ilk teslim kapsamı prolog/kriz dilimiyle sınırlanabilir; tam rol gelecekte ayrıca oynanabilirlik kanıtı ister.
- Dış analistin şirket sahibi dikey dilimini Faz 23 öncesine koyma önerisi kronolojik olarak geçmişte kalmıştır; Faz 23–24 zaten uygulanmıştır. Doğru yeni kapı, Faz 22.1E fiyat/maliyet/ödeme doğruluğu kabul edildikten sonra ve yeni katman açılmadan önce şirket sahibi merceğiyle aynı ekonomiyi sınamaktır.

### Yeni zorunlu kanıtlar

- Aynı dünya fotoğrafında altı rol aynı `factId`/kanonik deftere bağlanmalı; yalnız erişim, yaş, kaynak, güven ve eylem yetkisi ayrışmalı.
- Şirket sahibi mikro döngüsü `ne üret / kime sat / sat mı stok-yatırım mı yap` üçlüsünü oyuncuya özel bonus olmadan çalıştırmalı; AI ve oyuncu aynı eylemde aynı fiziksel/mali sonucu üretmeli.
- On iki sorunun her satırı için “bedel / ilk görünür sonuç / en geç dakika / sistem sahibi / originEventId / başlangıçta kim biliyor?” tablosu doldurulmalı. Boş satır içerik hatasıdır.
- Hükümet değişim probunda özel eğilim sabit kalmalı, rejim hizası yeniden türetilmeli; geçmişi bilmeyen NPC ve LLM geçmiş olaydan söz edememeli.

## Dış analiz — proje, varlık, bakım ve B2B hizmet ekonomisi — 1 Ağustos 2026

İki metnin ortak önerisi incelendi. “Her binaya ayrı bonus” yaklaşımı yerine karar → tedarik → kesintili inşa → kalıcı varlık → getiri + bakım zinciri kabul edildi. Bu karar aktif Faz 22.1E işini genişletmez; sonraki şirket/belediye oynanabilirliğinin mimari sözleşmesidir.

### Kabul edilen kararlar

- Şirket, belediye ve devlet yatırımları ayrı motorlar kullanmayacak. Tek `ProjectV1` gerçek mal, emek, enerji/yakıt, nakit, sözleşme ve zaman tüketecek; tamamlanınca tek `WorldAssetV1` doğuracak.
- Proje söz veya bütçe ayrılmasıyla ilerlemeyecek. Mal teslimi, hizmet teslim fişi ve emek kaydı eksikse açık neden koduyla duracak; iptal yalnız kullanılmamış emaneti iade edecek.
- Özel varlığın getirisi ürün/hizmet/kira/sözleşme geliri; kamusal varlığın getirisi çoğunlukla koridor, eğitim, sağlık, barınma, güvenlik veya yönetim kapasitesi olacak. Dolaylı vergi/refah etkisi bu kapasiteden türetilecek.
- Bakım gerçek ve yinelenen bir ekonomik faaliyet olacak. Kondisyon kademeli azalacak, kapasite/arıza/güvenlik eşikleri üretilecek ve ertelenmiş bakım ücretsiz silinmeyecek.
- İnşaat, bakım, lojistik ve tarımsal hizmet şirketleri gerçek tüzel kimlik, bilanço, çalışan, kapasite, itibar ve sözleşme portföyü taşıyabilecek.
- Rekabet ayrı bir sahte baskı sayacından değil fiyat, maliyet, kapasite, nakit/borç, sözleşme kazanma, teslim güvenilirliği ve müşteri kaybından türetilecek.
- Şirket ve varlık satılabilir; aktörün kişisel itibarı, ilişkileri, vaatleri ve siyasi geçmişi satılamaz. Bağış, ihale tercihi ve karşılıklı söz nedensel kanıt bırakacak.
- Uzak varlıklar toplulaştırılabilir, oyuncu temasında `HOT/WARM/COLD` ayrıntı açılabilir. Ayrıntı açılması toplam kapasiteyi, parayı veya geçmiş sonucu değiştirmeyecek.
- Stratejik bina ile savaş alanı hedefi ayrı gerçekler olmayacak. Taktik izdüşüm aynı `assetId` taşıyacak; savaş hasarı tek stratejik kondisyon/kapasite kaydına geri mutabakat verecek.

### Düzeltilen veya reddedilen varsayımlar

- “Her binanın çıktısı olmalı” ilkesi depolanabilir ürün zorunluluğu değildir. Yol, okul, hastane veya mahkeme ölçülebilir kapasite/hizmet/akış/risk azaltımı üretir; doğrudan `+%X refah/verim` üretmez.
- Hizmet şirketleri kaynak defteri dışında kalamaz. Stoklanabilir sahte mal üretmeleri gerekmez, fakat gerçek emek ve işletme girdisi tüketip süreli kapasite ile `ServiceDeliveryReceiptV1` üretmeleri gerekir. Aksi halde bakım ve lojistik yeniden sihirli çarpana dönüşür.
- `NegotiationCase` mekanik sözleşme değildir. Yalnız bir `MechanicalContractV1` taslağının konuşma/müzakere akışıdır. LLM sayı, kaynak, SLA, ödeme veya sonuç uyduramaz; kabul edilen taslak deterministik doğrulayıcıdan geçer.
- “15–20 bina” zorunlu sayı olarak kabul edilmedi. İlk dilim `8–12` karar-farklı şablonla sınırlanır; yeni bina yalnız yeni girdi, kısıt, kırılma veya oynanış kararı getirirse açılır.
- Otomobil ve benzeri dayanıklı ürün zinciri mevcut kaynak/talep taksonomisinde yoktur. Sırf örnekte geçtiği için hayali bir kaynak eklenmeyecek; ayrı kanıtlı dayanıklı-mal fazına ertelenecek.
- Stratejik kapasite ile taktik görsel/hedef birbirinden bağımsız kayıt olamaz. Ayrı simülasyon durumu üretmek çift hasar, kopya sahiplik ve kaydet/yükle sapması doğurur.
- Dış analistin “kohortlardan sonra binalar” sırası güncel kodda zaten sağlanmıştır; Faz 23–24 uygulanmıştır. Bu gerekçe Faz 22.1E önüne yeni uygulama işi koymaz.

### Yerel kanıt ve kapsam sınırı

- Faz 21 bugün `48` şirket, `8` banka, `412` tesis ve `152` depo taşıyor. Bunlar yok sayılıp sıfırdan binlerce nesne üretilmeyecek; ilk göç toplam kapasite, sahiplik, stok ve dünya karmasını koruyan toplulaştırılmış stratejik varlıklarla yapılacak.
- Mevcut yatırım hattı genel kapasite artışı için temel proje/emanet davranışı sağlıyor, fakat farklı bina gereksinimi, kesintili inşa, kalıcı kondisyon, bakım planı ve hizmet tedarikini henüz kanıtlamıyor. Dış analiz mevcut özelliğin adı değiştirilerek “uygulandı” sayılmayacak.
- Faz 22.1E’de üretim reçetesinin aldığı enerji/parça/elektroniğin eski tesis işletme ve bakım vekilleri tarafından ikinci kez tüketildiği gerçek bir hata bulundu. Bu, proje/varlık/bakım modelinde her maliyetin tek sahibi olması şartını doğrudan doğrulayan yerel kanıttır.
- İlk hizmet dilimi inşaat, bakım, lojistik ve tarımsal hizmetten en fazla üç-dördünü seçer. Sigorta, hukuk veya muhasebe ancak gerçek risk/uyuşmazlık/uyum sonucu ve farklı karar üretiyorsa açılır.

### Faz yönlendirmesi ve zorunlu kanıtlar

- İlk şema/prob Faz 22.1E ve şirket sahibi merceği kabulünden sonra: mevcut tesis/depo → `WorldAssetV1` gölge göçü, kapalı özellikte sıfır sonuç farkı.
- Sonraki dikey dilim: bir özel üretim projesi ve bir belediye altyapı projesi; gerçek tedarik, kesinti, iptal/iade, tamamlanma, getiri ve bakım.
- B2B hizmet kimliği/sözleşmesi aynı proje motorunun müşterisi olur; ayrı soyut ekonomi kurmaz.
- Nüfus/barınma/emek Faz 23–27’ye; kamu ruhsat/bütçe/yönetimi Faz 28–33.1’e; sözleşme konuşması Faz 38.3–38.5’e; savaş mutabakatı Faz 47–51’e; şirket devri ve rol/kariyer arayüzü Faz 34–35 ile 59–60.3’e bağlanır.
- Aynı proje AI ve oyuncuda aynı fişleri üretmeli; kaydet/yükle duraklama ve emanetleri birebir korumalı; proje maliyeti yeniden hesaplanabilmeli; bakım kesintisi ölçülebilir kademeli bozulma üretmeli; `8 devlet × 900 sn` içinde proje/sözleşme/şirket sayısı sınırsız büyümemelidir.

## Faz 29 kurum/yetki dış analiz notu — 5 Ağustos 2026

- Faz 28'de gözlenen “güç merkezi var ama eylem yetkisi yok” borcu kapandı. Çözüm merkeze doğrudan dünya yazma hakkı vermek değil; 29 eylemi başvuru/onay/yürütme olarak ayıran tek anayasal kapı oldu.
- En kritik reddedilen kısa yol, “zorunlu onay makamı aynı zamanda başvuru yapabilir” varsayımıydı. Onay yetkisi önerme yetkisi değildir; aksi halde örneğin askerî rejimde anayasa gereği imzası gereken ordu sivil yasayı kendi adına başlatabiliyordu.
- İkinci reddedilen kısa yol, kurumlar arası ortak kararla güç merkezi dilekçesini tek `PETITION` etiketi altında toplamak oldu. Son modelde kurumlar `DIRECT/JOINT`, güç merkezi dış talebi `PETITION`; merkezin kendi bildirim ve koordinasyonu gerçek `DIRECT` olur.
- Küresel makam imzası tasarımı da reddedildi. Tek ülkedeki komutan/anayasa değişimi bütün dünyanın kararlarını bayatlatıyordu. İmza ülke bazına indirildi ve sadakat gibi akışkan kişilik değerleri kimlik imzasından çıkarıldı.
- UI'nin `ensure/reconcile` çağırması gerçek bir gizli yazma hatası üretti. Ekran açılışı gecikmiş anayasa değişimini işleyip dünya hash'ini değiştirdi. Görünüm API'leri salt-okunur yapıldı; uzlaştırma scheduler veya kayıt kapısının sorumluluğunda kaldı.
- Yükleme bağımlılığı deneyle kesinleşti: kolektif hareketler güç merkezi kimliği, güç merkezleri kurum yetkisi, kurumlar komutan/makam kimliği ister. Doğru kesin sıra `komutan → kurum → güç merkezi → kolektif hareket → göç`; ters sıra valid görünen fakat birebir olmayan kayıt üretiyor.
- A/B sonucu Faz 29'un henüz fiziksel dünya davranışı olmadığını doğruluyor: sekiz eski makro/kaynak deltasının tamamı `0`. Bu başarı aynı zamanda sınırdır. Faz 30 gelmeden kararın gecikmesi, uygulanması veya sızdırılması varmış gibi raporlanmayacak.

## Faz 30 devlet kapasitesi dış analiz notu — 5 Ağustos 2026

- Yetki ile uygulama aynı sayı veya aynı durum değildir. Faz 29 `EXECUTED`, hukuken geçerli ve doğru yürütücüye teslim edilmiş karar demektir; Faz 30 ancak bundan sonra kapasite, süre, bölge ve bütünlük üzerinden uygulanabilirliği ölçer.
- “Yolsuzluk” kelimesi tek başına suç kanıtı gibi kullanılırsa Faz 32 daha doğmadan bozulur. Faz 30 alanı bu nedenle `corruptionRiskBps`: yapısal sızıntı/diversion ihtimali. Fail, rüşvet, ihale ilişkisi, soruşturma ve skandal yoktur; bunlar kanıt zinciriyle Faz 32'de doğacaktır.
- Başarısız uygulamanın tek biçimi gecikme değildir. Çökmüş devlet kararı hiç başlatamayarak `PAPER_ONLY`; çalışan fakat bütünlüğü zayıf bürokrasi `DEGRADED`; yeterli kapasite ve denetim `COMPLETED` olur. Oyuncuya tek “başarısız” etiketi yerine ölçü, eşik ve neden kodu gösterilir.
- Normal 900 saniyelik dünya sırf sistem görünür olsun diye sahte siyasi karar üretmedi. `0` doğal bilet doğru sonuçtur; davranış dalları hedefli ve deterministik fixture'larda kanıtlandı. Faz 31 gerçek seçim kararları ürettiğinde aynı tüketim hattı doğal veri almaya başlayacaktır.
- Fiziksel mutasyonun bilerek ertelenmesi eksiklik saklamak değildir. Faz 30'un terminal fişi yalnız kapasite uygulanabilirliğini kanıtlar; ekonomi, güvenlik, altyapı veya toprak sahibi domain fişi açıkça tüketmeden dünya değişmez. Bu sınır, aynı kararın iki kat uygulanmasını önler.
- 900 sn A/B bütün eski makro ve kaynak deltalarını `0` tuttu; hedefli `COMPLETED/DEGRADED/PAPER_ONLY`, yabancı gizlilik, salt-okunur UI, kayıt/yükleme ve göç kapıları geçti. Tam regresyon `1.947,9 sn` sürdü. Test süresindeki artış dürüstçe kaydedildi; kapsam veya eşik azaltılmadı.

## Faz 31 seçim ve iktidar devri dış analiz notu — 5 Ağustos 2026

- Seçim tek bir “halk desteği” zarı değildir. Oy hakkı ve katılım gerçek yetişkin kohort sayısından; tercih ise kohortun maddi/kimlik konumu, kayıtlı mesele hafızası, kamusal güç merkezi desteği, ülke yönelimi ve yönetim kanıtından gelir. Her oy tam kişi olarak bir listeye tahsis edilir ve toplamlar yeniden hesaplanabilir.
- Rejim etiketi kozmetik değildir: parlamento, liberal halk oyu, meclis seçimi ve sınırlı yürütme yarışı farklı model/takvim taşır. Askerî rejime sırf ekran dolsun diye seçim eklenmez; gerçek haleflik Faz 33'ün aktör ve güç zincirini bekler.
- Faz 34 öncesinde gerçek aday karakteri uydurmak reddedildi. Kazananlar `POLITICAL_SLATE_PROXY_PRE_PHASE_34` listesidir; makam sahibi kimliği kurum imzasını değiştirebilir fakat sahte kişilik, ilişki, hafıza veya diyalog sahibi değildir. Bu vekiller Faz 34 geldiğinde kimlikli adaylara göç etmelidir.
- Seçim sonucu kendiliğinden refah, bütçe veya politika yazmıyor. `MANDATE_RECORD_ONLY_PHASE_31` yalnız meşru makam ve mandat fişi üretir; fiziksel politika etkisi ilgili domainin açık tüketici sözleşmesini bekler. 900 sn A/B'de sekiz eski makro/kaynak deltasının sıfır kalması bu sınırı kanıtladı.
- Dar sonuç tek başına itiraz değildir; dar marj ile zayıf hukuk birlikte gerekir. Hedefli eşik karşı-testleri geçti, fakat doğal 900 saniyelik koşunun mutlaka itiraz üretmesi beklenmedi. Nadir dalın görünürlüğü için sayı eğip sahte kriz çıkarılmadı.
- Restore sırası yeni bir genel ders verdi: kurum yetki imzası seçilmiş makamı okuyorsa, doğrulanmış seçim görüntüsü kurum restore'undan önce hazırlanmalıdır. Ters sıra önce eski, sonra yeni makamı kurup sahte uzlaştırma olayları üretir. Düzeltme sonrası checkpoint ve kesintisiz kayıt birebir oldu.
- Eski Faz 25 fiziksel A/B filtresi de yeni ardıl defterlerin yalnız bir kısmını ayırdığı için yanlış alarm verdi. Kamuoyu kapatıldığında güç merkezi, kurum, kapasite ve seçim zinciri birlikte kapanır; eski faz kıyası bunların tümünü dışlamalıdır. Bu hata tam kapsam korunarak bulundu ve hedefli karşı-testle kapatıldı.
- Açık borçlar saklanmıyor: kampanya medyası/dezenformasyon Faz 39, gerçek aday karakterleri Faz 34, patronaj ve soruşturma Faz 32, darbe/askerî haleflik Faz 33 sahibidir. Mevcut dört liste çeşitlilik tabanı sağlar; uzun kampanyada tekrar kör noktası gerçek karakter ve medya katmanları gelmeden çözülmüş sayılmaz.

## Birleşik açık kayıtlar

| Kimlik | Konu | Öncelik | Durum | En erken ilgili faz |
|---|---|---|---|---|
| EXT-ACT-001 | Gıda/enerji üretim–talep çöküşü ve üst-akış yatırım zinciri | Kritik | `resolved-phase22.1e` | Fiziksel stabilizasyon kapısı 60/300/900 sn ve kuyruk ortalamasıyla geçti; performans borcu ayrı izlenir |
| EXT-ACT-002 | Ekonomik AI için çok adımlı bağımlılık planlaması | Yüksek | `completed-phase22.1e-scope` | Reçete grafı + ülke portföyü + girdi emaneti + Pareto hacim + hane dağıtımı; daha geniş ulusal gündem sonraki fazlardadır |
| EXT-ACT-003 | Savaş manifestosunda kalıcı birlik kimliği | Kritik | `open` | Faz 47 |
| EXT-ACT-004 | `military_supplies` ve yakıtın taktik tüketim mutabakatı | Yüksek | `open` | Faz 47–50 |
| EXT-ACT-005 | Serbest metinde kapalı niyet + gramer kısıtlı deney | Kritik | `candidate` | Faz 38 öncesi |
| EXT-ACT-006 | Deterministik varlık çözümleyici ve teyit döngüsü | Kritik | `in-progress-phase38.1` | İlk dikey güvenli varlık/iddia zarfını kurdu. İkinci dikey gerçek oyuncu metnini 32 oturum/24 tur tavanlı deftere alıyor; kaynak, depo ve sayısal şartları birleşik inceleme adayına taşıyor. Sunulmayan seçenek reddediliyor; yetki/kapasite/sahiplik/şirket kaydı ve iddia doğrulaması açık motor borcu kalıyor. ActorBelief ön-incelemesi sıradadır. |
| EXT-ACT-007 | LLM kalite merdiveni ve mekanik eşitlik | Yüksek | `candidate` | Faz 38.3–38.5 |
| EXT-ACT-008 | Sohbet sonrası model boşaltma/RAM ölçümü | Orta | `candidate` | Faz 38 öncesi altyapı probu |
| EXT-ACT-009 | Faz 64–66 için küçük erken prob, tam nihai kabul | Orta | `candidate` | Faz 64–66 |
| EXT-ACT-010 | Tek ekonomi üzerinde altı rol yetki/bilgi projeksiyonu | Yüksek | `in-progress-foundation` | Rol seçimi/kimlik/kurum bağı var; ana UI ve eylemler henüz role göre süzülmüyor. Komutanın şirket işini ast/uzman üzerinden, şirket sahibinin askerî işi yetkili komutan üzerinden yürütmesi Faz 37 + 59–60.3 borcu. |
| EXT-ACT-011 | Role uyarlanır bedelli 12 karar ve nedensel geçmiş tohumu | Yüksek | `completed-phase34` | Dört oynanabilir rol; komutan 6/3/3, şirket 2/6/4, siyasi lider 3/4/5, ajan 2/3/7. Mekanik kazanç+bedel kanonik ama oyuncudan gizli; toplam 36 yeni rol ikilemi, olay, WorldFact, ActorBelief, tepki kancası ve 0 sn ilk sonuç var. |
| EXT-ACT-015 | İsimli şirket/siyaset/asker/ajan kadrosu ve yönlü çok boyutlu ilişki | Yüksek | `completed-phase35` | 176 karakter / 627 seyrek bağ; güven-korku-saygı-borç-husumet, köken etkisi, WorldV2/knowledge/göç/save kapıları ve tam `56/56` regresyon geçti. Başlangıç rolü ile sonradan kazanılan makam ayrıldı. |
| EXT-ACT-016 | Üç katmanlı kaynaklı karakter hafızası ve konuşma bölümü | Kritik | `completed-phase36` | 24 yakın/12 özet, 64 açık/48 çözülmüş bölüm, 2048 mihenk taşı ve 4M serileştirme bütçesi; Talks→PROMISE, kriz→EPISODE/BETRAYAL, bütçe makbuzu+ilişki→DEBT, özel güçlü kanıt→SECRET çalışıyor. 900 sn `84.578` karakter, hedefli altı sınır ve tam 57-sonuç assertion paketi geçti. |
| EXT-ACT-017 | Yetki/bedel/hedef/cooldown doğrulamalı karakter eylemleri | Kritik | `completed-phase37` | Yedi aday sosyal karakter, komut+şehir, karakter+varlık ve makam hedeflerini ayrı doğrular; tamamı gerçek yürütücü taşır. Dört sosyal eyleme ek olarak emir `garrison +1`, sabotaj gerçek koridor hasarı, istifa kanonik makam geçişi üretir. Yönetim paneli istifayı iki aşamalı gerçek DOM onayına bağlar; halef isimli karakterdir ve eski aktör yetkiyi kaybeder. Bilgi-sınıflı genel dizin kendi/doğrudan temasları öne alır; ajan yalnız kamusal kara topolojisinden gerçek sabotaj hedefi görür, komutan görmez. Hedefli prob `197` kamusal varlık, `14` operasyon, sıfır yabancı konum/gizli alan sızıntısı verdi. Save/load, operasyon ortası devam, v2/v3→v6, WorldV2 ve şema-6 900 sn (`22/22`, `70056c2d…6d4d36e5`) geçti. Nihai tam regresyon `59/59`, `1.139,0 sn`, çıkış `0`; tam rol navigasyonu Faz 59–60.3 borcudur. |
| EXT-ACT-018 | Kapalı-seçim LLM karakter hakemi ve deterministik fallback | Kritik | `in-progress-phase38` | `story-character-arbiter-3`; `54` altı commit adayını kod eler, LLM yalnız sıra çağrışımsız `Qxxxx` kodu veya PASS ve enum konuşma planı üretir. İstek bazlı JSON grameri ile katı doğrulayıcı birlikte çalışır; kanonik eylem/hedef yalnız kodda çözülür. Paketli 4,9 GB modelin EXE-eşit CUDA kapısı beş rolde `5/5` şema + `5/5` semantik, sıfır fallback/hata/mutasyon verdi. Canlı tüketim; sürümlü bekleyen istek, sabit sonraki tik, yeniden Faz 37 doğrulaması ve deterministik gecikme/stale/restore fallback'iyle bağlandı. PASS dahil kararlar `512` tavanlı geçmişte saklanır ve son altısı sonraki aktör bağlamına girer. Doğal cümle, cümle/hitap tekrar önleme ve serbest metin açıktır. |
| EXT-ACT-012 | Kanonik `ProjectV1 → WorldAssetV1 → bakım` yaşam döngüsü ve mevcut tesis göçü | Yüksek | `accepted-design` | Bina çeşitliliğinin sahibi budur. Mevcut fabrika/kışla UI'sine yüzeysel bonus düğmeleri eklenmeyecek; şirket merceği sonrasında ilk `8–12` mekanik olarak farklı varlık şablonu ve bakım zinciri kurulacak. |
| EXT-ACT-013 | Gerçek kimlikli B2B hizmet şirketi, mekanik sözleşme ve teslim fişi | Yüksek | `accepted-design` | Proje dikey dilimi; konuşma adaptörü Faz 38.3–38.5 |
| EXT-ACT-014 | Şirket/varlık değerleme-devri ile aktör itibar ve kariyer sürekliliği | Orta | `accepted-design` | Faz 34–35; oyuncu rolü ve UI Faz 59–60.3 |

## Değişiklik günlüğü

| Tarih | Değişiklik |
|---|---|
| 31.07.2026 | EXT-001 ve EXT-002 ilk kez kaydedildi; güncel Faz 24 sonuçlarıyla zaman/kanıt ayrımı eklendi. |
| 31.07.2026 | Kullanıcı yönlendirmesiyle Faz 22.1 aktif öncelik yapıldı; EXT-ACT-001/002 `active-phase22.1` durumuna alındı ve faz başlangıcı/kabul öncesi kontrol düzeni eklendi. |
| 31.07.2026 | Faz 22.1 ara ölçümü işlendi: yatırım–bakım rezervi, atomik şirket takası, modern demografi ve lojistik zaman ufku kök nedenleri kaydedildi; `%42,75/%44,17` sonucu kabul kapısını geçmediği için açık kayıtlar kapatılmadı. |
| 31.07.2026 | Lojistik retry tavanı `65,61→34,63 sn` ölçüldü; iki erken-koridor önceliği deneyi sistem sonucunu kötüleştirdiği için reddedildi. Üretim ithalatında `buyerCompanyId:null` ve devlet finansmanına düşen `88` açık emir yeni kök neden olarak kaydedildi. |
| 31.07.2026 | Şirket alıcı + banka işletme kredisi + ticaret emaneti deneyi teknik olarak korunumlu fakat ekonomik olarak yıkıcı çıktı (`%3,94/%6,42`, `12` proje, `10` iflas); geri alındı. Şirket ithalatından önce kapalı para dolaşımı ve gerçek nihai talep ödemesi zorunlu bağımlılık olarak kaydedildi. |
| 31.07.2026 | Satıcıya çift ödeme yapmayan merkezî-takas geri ödeme adayı da `%4,27/%4,19`, `11` proje, `9` iflas ve `marketClearingCash≈5,51` ile reddedildi. Asıl kusurun üretimde otomatik gelir ve satışta ödeyen yokluğu olduğu kesinleşti. |
| 01.08.2026 | Varsayılan-kapalı Faz 22.1E mikro çekirdeği üretimde geliri `0` tuttu; hane ve şirket satışında gerçek fatura oluşturdu; birleşik para `90.880`, fiziksel lot ve stok maliyeti korundu; kayıt/yükleme birebir geçti. Açık yolun `258` fiyat-altı-maliyet tutması yeni aktif ölçüm borcu olarak kaydedildi. |
| 01.08.2026 | Faz 22.1E gerçek-akış aynası kapatıldı: `4 sn/760` depolama, `8 sn/10` kargo ve `60 sn/8` yatırım emaneti sapması sıfırlandı. Açık özellikte `60/120 sn` bütünleşik doğrulama geçti; 60 sn kapı tam teste eklendi. Varsayılan 900 sn karma `230bc647…ef36`, çıkış kodu `0`; faz hâlâ kabul edilmedi. |
| 01.08.2026 | İki dış analiz işlendi: “tek ekonomi, altı mercek” ve role uyarlanır bedelli karakter başlangıcı kabul edildi. Muhalif/yandaş kalıcı kişilikten çıkarılıp türetilmiş rejim hizasına çevrildi; geçmiş tohumu olay+WorldFact+ActorBelief sözleşmesine, her soru `≤10 dk` görünür sonuç kapısına bağlandı. EXT-ACT-010/011 açıldı. |
| 08.08.2026 | Faz 34 başladı. `story-character-identity-ledger-1`, 88 başkan/komutan kimliğini dört kararlı boyut, geniş değer, korku, hırs, kırmızı çizgi, hedef ve ses profiline göç ettirdi. Rejim hizası kişilikten ayrılıp türetilmiş görünüm kaldı; profil seçenek yasaklamıyor. Faz 31 liste vekilleri seçim başına isimli aday karakterine ve kazanan makamına bağlandı. Hedefli karakter probu bilgi gizliliği ile kayıt/yüklemeyi, seçim probu `319,7 sn / exit 0` zincir uyumunu doğruladı. EXT-ACT-011 `in-progress-phase34`; 12 bedelli kararın olay+WorldFact+ActorBelief ve `≤10 dk` fiziksel/ilişkisel sonucu kapanmadan tamamlanmış sayılmayacak. |
| 08.08.2026 | Faz 34 kabul kapısı kapandı. Defter `story-character-identity-ledger-2` oldu; altı rol için 12-soru dağılımı, komutanda `6/3/3`, açık kazanç/bedel önizlemesi ve gerçek mekanik uygulama kuruldu. Hedefli sonuç `12 karar = 12 olay = 12 WorldFact`, `31 ActorBelief`, oyuncuda `12` görünür köken olgusu, yabancıda `0` sızıntı ve `0 sn` ilk sonuçtur. İlk tam koşu yeni WorldV2 alanlarını düşüren eski göç adaptörünü yakaladı; `legacy-save-v3-to-v2-6` ile kimlik/olgu/inanç göçü `12/31` kayıpsız oldu. Nihai tam regresyon `56/56`, `819,6 sn`, karma `145d5775…b3b72`. EXT-ACT-011 kapatıldı; Faz 35 açıldı. |
| 08.08.2026 | Kullanıcı kararıyla 12 sorudaki mekanik kazanç/bedel önizlemesi kaldırıldı; iç sözleşme ve sonuç korunuyor. Zar ekranı komutan/şirket yöneticisi/siyasi lider/ajan seçtiriyor; üç yeni yol toplam 36 özgün ikilem kullanıyor ve kanonik rol zorla komutana çevrilmiyor. Faz 35 adayı dünyayı 176 isimli aktöre ve 627 yönlü çok boyutlu bağa genişletti; hedefli gizlilik, göç ve save/load geçti. Şehir/ekonomi LRU probu 33 istekte 1 build/32 hit verdi. Tam 6-worker paket, eşzamanlı savaş AI CPU yükünde assertion vermeden 30 dk tavana ulaştı; EXT-ACT-015 bu nedenle açık. |
| 08.08.2026 | Rol kaynağı ayrımı kapatıldı: komutan dışı 12 cevap artık komuta cüzdanı yerine nüfuz/güvenilirlik/özerklik/kapasite kariyerini sürüyor. Şirket sahibi gerçek sanayi şirketine bağlandı; hedefli prob yürütme ve ordu makamlarının isimli AI aktörlerinde kaldığını doğruladı. WorldV2/PlayerKnowledge/göç sürümleri yükseltildi; 176 kimlik/627 ilişki ve save/load yeniden geçti. Panel LRU 64 anahtara, DOM karşılaştırması WeakMap aynasına, şehirler de ortak dünya/bilgi anlık görüntüsüne bağlandı; dört şehir turu 37 istek/4 şehir dosyası/1 dünya-bilgi kurulumu/33 görünüm isabeti/0 tahliye verdi. Faz 35 tam paket beklediği için EXT-ACT-015 açık kalır. |
| 08.08.2026 | `Şehre Gir → Nüfus/Kurumlar` optimizasyon borcu hedefli kapıya bağlandı. İkinci nüfus-defteri klonu ve `innerText` layout okumaları kaldırıldı; uzun bölümler `content-visibility` aldı; sekme DOM'u fragment önbelleğine taşındı. Ağır iki sekmenin tekrarında 0 view/world/HTML/innerHTML artışı ve 2 DOM restore ölçüldü. Kullanıcının rol-UI ayrışması notu EXT-ACT-010'a, bina çeşitliliği notu EXT-ACT-012'ye açık kapsam olarak işlendi; ikisi Faz 35 içinde sahte kısa yol üretmeyecek. |
| 08.08.2026 | Faz 35 kabulü kapandı. İlk tam koşu, komutanın sonradan yürütme makamını kazanmasını engelleyen başlangıç-rolü kilidini yakaladı; ilk rol ataması ile canlı kurum sahipliği ayrıldı. Şirket sahibinin makam çalmadığı ve komutanın daha sonra cumhurbaşkanı olabildiği aynı karşı-testte geçti. Nihai savaş-AI-yüklü tam regresyon `56/56`, `2.185,4 sn`, çıkış `0`, karma `145d5775…b3b72`. EXT-ACT-015 kapatıldı; Faz 36 açıldı. |
| 08.08.2026 | Faz 36 ilk dikey dilimi kuruldu. `story-character-memory-ledger-1`, 24 yakın kayıt/12 deterministik özet, açık-çözülmüş EPISODE ve budanmayan ORIGIN/PROMISE/SECRET/BETRAYAL/DEBT katmanlarını ayırdı. 12 WorldFact ve 31 ActorBelief kaynaklı köken hafızası; gerçek `law-complaint` konuşmasından EPISODE→RESOLVED→PROMISE; iki yönlü sır gizliliği, WorldV2/PlayerKnowledge v3, V3→V2 ve birebir save/load geçti. Scheduler devam karması `a57155c8…1b5c` ve fark listesi boş. EXT-ACT-016 açıldı; faz `partial`. |
| 08.08.2026 | Faz 36 tam regresyon denetimi kimlik öncülü kapalı Talks.js yolundaki `null.identities` erişimini ve yeni probun eksik assertion importunu yakalayıp kapattı. Nihai paket 57/57 sonucu üretti. Eşzamanlı savaş AI yükünde raster cache `3.365,171 ms > 2.000 ms` çıktı; eşik gevşetilmedi. Tekil temiz prob `631,22 ms`, `1350/300`, `%0,216102` kıyı farkı ve eşit A/B karması verdi. Korunmuş 57 sonuçla tüm assertion dosyası çıkış `0`, ana karma `145d5775…b3b72`. Teknik dilim kabul edildi; EXT-ACT-016 içerik/soak borçları nedeniyle açık. |
| 09.08.2026 | Faz 36 içerik borçları kapatıldı: siyasi kriz OPEN/RESOLVED EPISODE ve gerçek ATTEMPT→BETRAYAL; `political.bribe` işlem makbuzu+yönlü `debtBps`→DEBT; özel, destekleyici, `>=8000` özgünlük/ilgi bütünlük kanıtı→yalnız iç-istihbarat sahibinde SECRET. Aynı konu/aktör sözü tek PROMISE'a yoğunlaştırıldı. 900 sn soak `111` yakın, `12` özet, `3/30` açık/çözülmüş bölüm, `3` mihenk taşı, `84.578/4.000.000` karakter ve değişmeyen `145d5775…b3b72` karma verdi. Altı hedefli sınır geçti; scheduler devam karması `d2e287bf…c3c79a`, fark yok. CPU-ağır kullanıcı oracle'ı altında 57-görev paket yaklaşık `2 sa 24 dk` sonunda sıfır sonuçla süreç timeout olduğu için EXT-ACT-016 resmen kapanmadı. |
| 09.08.2026 | Oracle tamamlandıktan sonra Faz 36 tam kabulü tekrarlandı. Altı işçi 57/57 görev sonucunu `2.594,3 sn`de üretti. Paralel raster süre örneği `3.896,741 ms > 2.000 ms` çıktı; eşik gevşetilmedi. Tek işçili aynı prob `573,204 ms`, geçerli sözleşme ve eşit A/B karması verdi. Korunmuş 57 sonuçla tüm assertion'lar çıkış `0`, ana karma `145d5775…b3b72`. EXT-ACT-016 kapatıldı; Faz 37 açıldı. |
| 09.08.2026 | Faz 37 ilk dikey dilimi kuruldu. `story-character-action-ledger-1` yedi aday için kanonik aktör/hedef, kişisel-makam-servis yetkisi, kariyer bedeli, temas/yetki alanı, cooldown ve domain yürütücüsü doğruluyor. İkna/müzakere/ittifak toplam `5 influence + 4 credibility`, yönlü ilişki etkisi, üç çözülmüş EPISODE ve bir RELATIONSHIP mihenk taşı üretti. Emir/sabotaj/istifa/ihanet sahte sonuç yerine sıfır bedelli `DOMAIN_EXECUTOR_NOT_AVAILABLE` verdi. Üç makbuz WorldV2/save/load/göçte korundu; oyuncu `3`, ilgisiz yabancı `0` gördü. Dört hedefli regresyon geçti; EXT-ACT-017 açıldı, Faz 37 `partial`. |
| 09.08.2026 | Faz 37 ikinci dikey dilimi `story-character-action-ledger-3`e yükseldi. İhanet gerçek ilişki hasarı, BETRAYAL mihenk taşı ve aktif ittifakı `BROKEN` yapan kaynaklı makbuz üretir. İlk seçici `85/86 ALLY`, cooldown sonrası aday `23/23 NEGOTIATE` verdiği için ikisi de reddedildi. Bağlamsal eşik + 120 sn tekrar fırsat maliyeti kullanan güncel politika 900 sn içinde `89 tik / 20 eylem / 69 pas`, `17 ALLY + 3 PERSUADE`, sıfır oyuncu kontrolü ve geçerli defter üretti; baskın tür `%85` ile otomatik `%90` çöküş kapısının altında. `22,5+17,5 sn` kayıt devamı birebir, v2→v3 göçü dört makbuz kayıpsızdır. Üç yürütücü, UI ve tam paket açık; EXT-ACT-017 kapanmadı. |
| 09.08.2026 | Faz 37 üçüncü dikey dilimi ilk oyuncu eylem yüzeyini açtı. `Şehir → Karakterler → Görüşmeyi Aç` akışı yalnız gerçek dört sosyal yürütücüyü gösterir; kariyer bedeli, mevcut kaynak, ret ve oyun-zamanı cooldown'ı aynı karttadır. JSDOM gerçek DOM hazır + delegated click yolunda Kaya Komutan'a ikna `PLAYER_UI` makbuzu, `influence 50→48`, ilişki/hafıza sonucu ve `1,5 yıl` çift cooldown üretti. Serbest hedefli sohbet Faz 38 borcu diye ayrıldı. 2.048 makbuz sonrası budama sayaç mutabakatı eklendi. Emir/sabotaj/istifa için eylem içeriği/varlık hedefi/haleflik bulunmadığından sahte yürütücü yazılmadı; genel dizin, tam rol merceği ve tam paket açık kaldı. |
| 09.08.2026 | Faz 37 dördüncü dikey dilimi ortak “hedef karakter” hatasını ayırdı. Emir askerî muhatap + `MOBILIZE_RESERVE` + sahip olunan şehir; sabotaj karakter + kanonik altyapı koridoru; istifa elde tutulan makam kimliği ister. Gerçek DOM emir tıklaması 70 insan gücünü tek ekonomi defterinde rezerve edip `PENDING_APPROVAL` kurum talebi açtı; onay/kapasite tamamlanınca `EXECUTED/APPLIED`, fiziksel mutasyon `garrison +1` oldu. Karakter makbuzu yalnız `QUEUED_DOMAIN_DECISION` dedi. Beş makbuz geçerli save/load, v2→v4 ve WorldV2/PlayerKnowledge yolunda korundu. Sabotaj için operasyon/tespit, istifa için boşalma/haleflik eksik olduğundan ikisi bedelsiz reddedildi. Faz 37 ve şehir UI hedefli probları geçti; 900 saniye aynı `89/20/69`, `17+3`, sıfır oyuncu kontrolü ve `70056c2d…6d4d36e5` karmasını verdi. Tam paket açık. |
| 09.08.2026 | Faz 37 beşinci dikey dilimi sabotajı gerçek alan yürütücüsüne bağladı. Ajan 6 kapasiteyle gerçek altyapı koridorunda 30 saniyelik `QUEUED_COVERT_OPERATION` açar; başarı, tespit ve fail atfı hedef devlet güvenliği ile ajan yeteneğinden türeyen ayrı deterministik çekilişlerdir. Hedefli sonuç `0→2588 bps` hasar ve `1020→756` etkin kapasite verdi. Tespit yoksa hedef sıfır bilgi, tespit-atıf yoksa failsiz olay, atıf varsa fail kimliği görür; hiçbir dal gizli oranları açmaz. Operasyon ortası kayıt/devam makbuz, hafıza ve fiziksel hasarda kesintisiz koşuyla aynıdır. Altı makbuz WorldV2/PlayerKnowledge/save/load ve v2/v3→v5 göçlerinde korundu. Şehir gizlilik/optimizasyon ve 900 saniye probları geçti; sosyal dağılım ile `70056c2d…6d4d36e5` karması değişmedi. `RESIGN`, keşif güvenli ajan UI'si, genel dizin/tam rol merceği ve tam paket açık. |
| 09.08.2026 | Faz 37 altıncı dikey dilimi istifayı gerçek makam devrine bağladı. `story-character-action-ledger-6`, aktif haleflik geçişini ve kaynak makbuzunu saklar; kurum uzlaştırması bu geçişi kanonik sahiplik kaynağı sayar. Halef aynı ülkenin gerçek karakterlerinden makam uyumu ve kariyer kanıtıyla deterministik seçilir. Yönetim → Makamlar gerçek DOM yolunda ilk tıklama sıfır makbuzla uyarı kurdu, ikinci tıklama oyuncu Silahlı Kuvvetler makamını `character:0:1 / Kaya Komutan`a devretti; eski aktör yetkiyi kaybetti ve hafıza çözüldü. Yedi makbuz/WorldV2/PlayerKnowledge, birebir save/load, halefin yüklemede korunması, v2→v6 yedi ve gerçek v3→v6 dört sosyal makbuz geçti. Aktif geçiş kaynağı 2.048 makbuz budamasından korunur. Şema-6 sonrası uzun koşu/tam paket, keşif güvenli ajan UI'si, genel dizin ve tam rol merceği açık. |
| 09.08.2026 | Faz 37 yedinci dikey dilimi bilgi-sınıflı genel temas dizinini ve ajan operasyon yüzeyini kurdu. Varsayılan liste `21` kendi/doğrudan temas, kapalı kamusal sicil `175` karakterdir. Yabancı `regionId`, kariyer, servis ve kimlik eksenleri gösterilmez. PlayerKnowledge v4, `197` fiziksel kara/deniz varlığını kapasite/hasar/erişim/etkinlik olmadan kamusal topoloji olarak taşır. Ajan için üretilen `14` yabancı kara hedefinden gerçek DOM tıklaması 6 kapasite harcayıp 30 saniyelik sabotaj açtı; komutan `0` operasyon gördü. Konum ve gizli alan sızıntısı sıfırdır. Şema-6 sonrası 900 sn koşu `506.231,24 ms`, `22/22` geçerli doğrulama, sekiz etkin devlet ve `70056c2d…6d4d36e5` karma verdi. EXT-ACT-017 yalnız tam regresyonu bekler; tam rol navigasyonu ayrı Faz 59–60.3 borcudur. |
| 09.08.2026 | Faz 37 kabulü kapandı. Altı-işçi ilk tam paket `59/59` sonuç üretirken ortak yükte raster cache `4.112,467 ms > 2.000 ms` verdi; eşik değişmedi. İzole prob `618,339 ms`, geçerli veri ve eşit A/B karmasıyla geçti. Üç-işçi tekrar, canlı `character-actions` scheduler görevinin manuel beklenen sıra fikstüründe unutulduğunu yakaladı; sıra düzeltildi, hedefli `character-actions=1 / political-crisis=2` geçti. Nihai korunmuş paket `59/59`, `1.139,0 sn`, tüm assertion'lar ve çıkış `0`; EXT-ACT-017 tamamlandı, Faz 38 açıldı. Manuel harness kaynak ve scheduler sıra listeleri test–EXE ayrışma riski olarak otomasyon borcuna yazıldı. |
| 09.08.2026 | Faz 38 ilk dikey dilimi `story-character-arbiter-1` ile kuruldu. Mevcut Faz 37 aday/doğrulama hattı tek mekanik otoritedir; LLM yalnız sunulmuş aday veya PASS ve enum konuşma planı döndürebilir. Geçerli/çitli JSON kabul edildi; uydurma aday, eylem-hedef uyuşmazlığı, `successChanceBps` enjeksiyonu ve bozuk JSON deterministik fallback'e döndü. İstek/fallback birebir, dünya mutasyonu ve yabancı konum/servis/altyapı sırları sızıntısı sıfırdır. Worker `0,7 sn`; özellik açık/kapalı 60 sn iki tarafta `066bde9f…5c69b`. EXT-ACT-018 açıldı; gerçek paketli model ölçümü ve canlı tüketim olmadan Faz 38 tamamlanmış sayılmayacak. |
| 09.08.2026 | Faz 38 gerçek-model dikeyi sahte ilerlemeyi üç kez yakaladı: ilk gerçek sözleşme `0/2` kesilmiş/uydurulmuş enum, kısaltılmış şema `2/2` biçim fakat C1 örnek yankısı, çok-rollü koşu `5/5` biçim fakat yalnız `2/5` semantik verdi. Eşik gevşetilmedi. Kanonik eylem/hedef çıktıdan kaldırıldı, opak `Qxxxx` kodu getirildi, `54` commit eşiği kod tarafına taşındı ve JSON grameri PROPOSE/PASS çapraz alanlarını sınırlandırdı. Nihai beş-rollü EXE-eşit CUDA kapısı `5/5` şema, `5/5` semantik, sıfır fallback/hata/mutasyon, iki seçim kodu, `779,91 ms` ilk token ve `2.830,74 ms` toplam süreyle geçti. Serbest sohbet yeterliliği veya canlı tüketim tamamlanmış sayılmadı. |
| 09.08.2026 | Faz 38 ikinci dikey tam regresyonu üç işçiyle `60/60`, çıkış `0`, `1.688,0 sn` toplam süre verdi. Ana 900 saniyelik koşu `494.971,56 ms`, sekiz etkin devlet, `%80,23/%80,34/%72,24` gıda/enerji/yaşam ve değişmeyen `70056c2d…6d4d36e5` karması üretti. Eşzamanlı savaş AI CPU yükü süre bağlamı olarak kaydedildi; test kapsamı ve eşikler değiştirilmedi. Gerçek-model ve tam regresyon borçları kapandı; canlı tüketim, konuşma kaydı ve tekrar önleme açık kaldı. |
| 09.08.2026 | Faz 38 üçüncü dikey, duvar-saatli model ile on saniyelik deterministik karakter scheduler'ını iki aşamalı bağladı. İlk tik yalnız `pendingArbiter` zarfı açar; asenkron sonuç dünyayı değiştiremez. Sonraki sabit tik aynı aktörün adaylarını ve bağlam karmasını yeniden üretir; yalnız geçerli PROPOSE/PASS tüketilir. Yetişmeyen model, değişmiş bağlam ve save/load sırasında kaybolan geçici posta kutusu Faz 37 seçicisine düşer. Yerel seçim makbuzu `requestId/contextHash/reasonCode/speechPlan` taşır; PASS makbuz uydurmaz. Eylem defteri v7'ye göçtü ve model/fallback/stale/restore sayaçlarını doğrular. Geçerli seçim, PASS, gecikme, stale hafıza ve yarım kayıt hedefli probları geçti. Model ilk gerçek karakter ihtiyacında arka planda bir kez ısınır; oyun beklemez. Gerçek-model kapısı yük altında yine `5/5 + 5/5`, sıfır fallback/hata verdi (`1.449,36 / 4.374,88 ms`). Tam paket `60/60`, çıkış `0`, `841,3 sn`; ana koşu `461.424,16 ms`, sekiz devlet, `%80,23/%80,34/%72,24` gıda/enerji/yaşam ve `70056c2d…6d4d36e5` karma verdi. Doğal cümle ve tekrar defteri açık kaldı. |
| 09.08.2026 | Faz 38 dördüncü dikey, PASS'i sayaç/son seçim içinde kaybolmaktan çıkardı. Model kabulü, PASS, deterministik fallback ve stale ret; istek/bağlam karması, aktör, aday, neden, konuşma planı ve tüketim tikiyle sürümlü karara yazılır. Mekanik makbuz `arbiterDecisionId` ile bağlanır; PASS makbuz uydurmaz. Aktörün son altı kararı yeni hakem bağlamına girer. `520` kayıt fixture'ı `512` tavanda ilk `8` kaydı sıra ile budadı; `9–520`, budama sayacı ve save/load birebir kaldı. Beş canlı senaryo ve Faz 37 göç/defter probları temizdir. Güncel model kapısı `5/5 + 5/5`, sıfır fallback/hata, `593,07 / 2.447,50 ms`; tam paket `60/60`, çıkış `0`, `846,0 sn`, ana koşu `461.121,19 ms` ve `70056c2d…6d4d36e5` karma verdi. Doğal cümle/hitap tekrar katmanı açık kaldı. |
| 01.08.2026 | Faz 22.1E sınır ötesi şirket ticareti gerçek mülkiyet ve ödeme zincirine bağlandı: satıcıya çift gelir yazan eski akış kaldırıldı; ithalatçı şirket escrow'su, satıcı COGS/geliri ve lot sahipliği devri kaydet/yüklemede korundu. Doğru 300 sn treatment `%43,99/%50,00/%54,83`, `7` proje ve sıfır iflas verdi; teknik defterler geçse de denge kapısı geçmediği için özellik varsayılan kapalı ve EXT-ACT-001/002 açık kaldı. |
| 01.08.2026 | Settlement reçeteleriyle eski tesis işletme/bakım vekillerinin çift fiziksel tüketimi kaldırıldı. `60 sn`de `3.996` gerçek şirket faturası korunurken vekil parça/elektronik talebi sıfırlandı; güncel 300 sn `%55,21/%65,89/%61,47`, `6` proje ve sıfır iflas verdi. Enerji kapısı geçti, gıda/refah geçmedi; beş kötü tahsis/lojistik deneyi geri alındı. |
| 01.08.2026 | İki bina/proje ekonomisi analizi işlendi. `ProjectV1 → WorldAssetV1 → getiri/bakım`, gerçek B2B hizmet kimliği ve şirket devri yönü kabul edildi. Hizmetlerin kaynak dışı çarpan olması, `NegotiationCase`in mekanik sözleşme sayılması, sabit 15–20 bina hedefi ve taktik/stratejik çift kayıt reddedildi. EXT-ACT-012/013/014 açıldı; aktif Faz 22.1E sırası değiştirilmedi. |
| 01.08.2026 | Faz 22.1E üretim-girdisi rezervi gerçekleşen tüketime, talep sırası sektör kritikliğine bağlandı; `%90/%10` geçici hane/işletme dolaşımı, gıda–parça histerezisi ve teslim edilen bloklayıcı girdinin tekrar ihraç edilmesini önleyen dar rezerv eklendi. 300 sn `%60,73/%72,52/%64,26`; 900 sn final `%63,94/%68,41/%65,52`, son 300 sn örnek ortalaması `%56,22/%63,61/%62,72`. Sekiz defter geçti ve varsayılan karma korundu; uzun dönem kapısı geçmediği için bayrak kapalı kaldı. |
| 01.08.2026 | Ülke bazlı stok/akış/blokaj kırılımı headless rapora ve mutabakat testine eklendi. `42.419` enerji stoğuna karşı `67` blokeli tarım bölgesi, yüksek stoklu ülkelerde sıfır iç sevkiyat kanıtlandı. Tik sırası, gerçek rota, kişi/ülke önceliği, enerji kotası ve hammadde kotası deneylerinin tamamı sistem sonucunu düşürdüğü için geri alındı; doğrulanmış aday ve `230bc647…ef36` varsayılan karma korundu. |
| 01.08.2026 | Ülke tanısı işletme rezervi, sevk edilebilir stok, sahipli lot, sipariş hata/durumu, yönlü kargo ve bölge kimlikli blokajla derinleştirildi. Ülke 5'te `12.067` kullanılabilir enerjiye karşı blokeli yedi hedefin tamamı `0` stokta. `18/6→20/8` kota, başarısız-emir pending ve iki birleşik enerji-kargo ufku `%57,79/%67,62/%61,21`, `%60,68/%68,32/%62,67`, `%56,19/%65,19/%61,34`, `%59,36/%70,55/%63,69` verdi; hepsi geri alındı. Fiziksel stok–lot ve sayaç–bölge mutabakatları tam teste bağlandı; varsayılan 900 sn `230bc647…ef36` karması geçti. Sıradaki sözleşme tek ülke kabulü + çoklu gerçek rota/teslim fişi olarak sınırlandı. |
| 01.08.2026 | `story-domestic-distribution-contract-1` varsayılan-akıştan yalıtılmış mikro çekirdek olarak kuruldu. Tek ülke admission’ı `2–8` hedef için toplam stok, sahipli kargo ve kümülatif koridor kapasitesini mutasyondan önce denetliyor; her hedef mevcut sipariş/sevkiyat motorunda ayrı rota, manifest, lot ve teslim fişi alıyor. `3+2` enerji probu kaynakta sevk anında `-5`, hedeflerde teslim anında tam `+3/+2`, iki defterde de `8.300,36` toplam korunum verdi. Sınır aşımı ve batch miktarı tahrifi reddedildi; yoldaki batch bayt-bayt geri yüklendi. Tam test geçti ve varsayılan `230bc647…ef36` karması değişmedi. Bu kayıt denge başarısı değildir: çekirdek otomatik seçiciye bağlı değil; gerçek darboğaz seçimi, yarış/rollback güvenliği ve `300/900 sn` A/B açık borçtur. |
| 01.08.2026 | Üç dağıtım seçicisi denendi ve geri alındı. LRU ülke batch’i `%60,51/%63,13/%61,41`, kısa rota + tek pencere batch’i `%51,05/%43,75/%56,05`; ikisi de mevcut tekil sevkiyatları iki-hedef kararına zorlayarak referans `%60,73/%72,52/%64,26` sonucunu bozdu. Batch bağlantıları silindi. Mevcut tekil motor üzerinde spot-marjinal-değer sırası projeyi `11→13` yükseltti fakat `%60,60/%69,79/%62,83` ile halk sonucunu düşürdü; fiyatın toplumsal amaç olmadığı kanıtlanıp o da geri alındı. Salt-okunur karşı-olgusal gözlemci tutuldu: 300 sn treatment’ta `107` fırsat = `72 IMMEDIATE + 23 PIPELINE_COVERED + 3 NO_DOMESTIC_SOURCE + 9 NO_ROUTE_CAPACITY`; ana açık stok yokluğu değil seçim kalitesidir. Yeni seçici ihtiyaç etkisi, zincir derinliği, co-blocker, gecikme ve ekonomik değeri ayrı guardrail’lerle ölçmeden canlıya bağlanmayacak. Tam regresyon `230bc647…ef36` varsayılan karması ve çıkış kodu `0` ile geçti. |
| 01.08.2026 | Karşı-olgusal gözlemci açıklanabilir beş amaçlı Pareto probuna yükseltildi; canlı seçici değiştirilmedi. 300 sn settlement treatment sonucu ve `8460df44…d431d56` karması birebir korundu. `72` sevk edilebilir adayın `19`u küresel öncü (`18` doğrudan ihtiyaç, `1` zincir; `6` parça, `13` enerji girdisi); hiçbir öncü başka aday tarafından bütün ölçütlerde ezilmedi. Mevcut kaynak-öncelikli sıranın ilk sekizinde Pareto-2/3 adaylar bulunurken öncüler eski sırada `11–56.` basamaklardan çıktı. Canlı aday için Pareto kopyası değil, ortak stok dışlama + ülke/kaynak bütçesi + upstream/ihtiyaç yuvaları + atomik admission/dispatch sözleşmesi zorunlu kılındı. |
| 01.08.2026 | Pareto tanısının ilk tüm-dünya katmanlaması test maliyetini kabul edilemez büyüttü ve geri işlendi. Karar alanı ülke stok yetkisine göre sekiz yerel katmana ayrıldı; küresel rank-1 yalnız `43` ülke öncüsü üzerinde hesaplandı. Aynı `19 küresel / 43 yerel` sonuç, sıfır geçersiz öncü/rank ve aynı `8460df44…d431d56` karma korundu; 300 sn yoğun duvar süresi `55,9→30,3 sn` indi. Harness varsayılan çağrıları artık bu raporu hesaplamıyor; yalnız `includeTradeProductionOpportunityView: true` verilen kabul/A-B koşuları hesaplıyor. İlk tam regresyon ekonomi karar kontrollerinden sonra bağımsız raster zaman kapısında `526,032 ms > 500 ms` ile durdu; eşik gevşetilmedi. Raster temiz tekil tekrarlarda `38,675 / 34,260 / 37,312 ms` verdi; temiz tam paket ardından çıkış kodu `0`, varsayılan `230bc647…ef36` hash ve ana 900 sn koşuda `39.336,97 ms` ile geçti. |
| 02.08.2026 | Pareto öncülerinin ortak kaynak admission katmanı `story-production-admission-plan-1` olarak kuruldu. 300 sn settlement görünümünde `43` uygun adaydan `12` sevkiyat (`8` ülke, `6 enerji + 6 parça`, `8,141335` birim) seçildi; fiziksel stok, sahipli lot, hedef talep, koridor, ülke/kaynak bütçesi ve iki politika yuvası çakışmasız geçti. Gözlemci dünya karmasını değiştirmedi. 16 sn aralıklı canlı ikame deneyi teknik defterleri geçti ama yüksek hacimli legacy akışı `≤1` birimlik marjinal seçimlerle değiştirdiği için 300 sn gıda/enerji/refahı `%60,73/%72,52/%64,26→%34,55/%30,54/%49,45`, ekonomik sonucu `18→10` düşürdü; canlı bayrak/commit geri alındı. Salt-okunur admission ve regresyonlar tutuldu; yeni aktif eksik hacim planı + legacy teslim tabanı korumasıdır. |
| 02.08.2026 | Dört-pencere hacmi ve legacy tabanı koruması ilk uzun dönem başarılı Faz 22.1E adayını üretti. Aynı 12 salt-okunur hedef `8,14→74,27` birime çıktı; canlı bayrak legacy üretim/normal dengeleme sonrasında yalnız `SURVIVAL` ek akışı çalıştırdı. 300 sn `%68,27/%74,89/%65,80` ve `23`, 900 sn final `%64,35/%71,04/%66,56` ve `60` ekonomik sonuç; son 300 sn ortalama `%64,08/%70,00/%65,48`. Sekiz defter ve `2.150` ek sevkiyat sıfır hatayla geçti, enerji kargosu azaldı. `6→8` enerji kotası `%69,89` enerjiye gerilediği için reddedildi. Bayrak varsayılan kapalı; yaşam koşulu `%70` olmadığı için Faz 22.1E/Faz 25 kapısı açılmadı. Kalan aktif sorun üretilmiş gıdanın bölgesel hane erişimine dönüşümüdür. |
| 02.08.2026 | Faz 22.1E hane dağıtım kabulü tamamlandı. Önceki gerçek tahsis açığı dört pencereyle sınırlandı; yalnız ülke içi gerçek stok, sahipli lot, açık kargo ve ortak rota kapasitesi mevcut sipariş/manifesto/ödeme zincirinden dağıtıldı. `60 sn` `%89,94/%85,16/%75,69`; `300 sn` `%79,56/%83,42/%71,48`; `900 sn` final `%76,55/%77,56/%70,82`; son 300 sn ortalama `%79,54/%79,31/%71,24`. Sekiz doğrulayıcı ve deterministik tekrar geçti; `10.712` sevkiyatta sıfır hata, tam `npm test` çıkış kodu `0`, varsayılan hash `9dd9f7fc…4719`. EXT-ACT-001 çözüldü, EXT-ACT-002 Faz 22.1E kapsamı için tamamlandı ve Faz 25 açıldı. Talep/kaynak başına rota çözümü ölçülmüş performans borcu olarak açık bırakıldı. |
| 03.08.2026 | Faz 25 tamamlandı. Faz 24'ün fiziksel yaşam sonuçları 1.824 kohortta gerçek aktör kimlikli, dayanak/güven/tekrar/iyileşme taşıyan şikâyet hafızasına dönüştürüldü; ihtiyaç, eski refah ve fraksiyon durumu salt-okunur kaldı. Hedefli tekrar eğrisi `2.183→1.762→3.457`, tam unutma `63` tik; 900 saniyede 7.696 sınırlı kayıt ve `%71,24` ortalama şiddet görüldü. Kompakt kayıt `1.725.815` karakter, karma `b813d8a7…a664`, tam test çıkış kodu `0`; fiziksel `%76,55/%77,56/%70,82` sonucu değişmedi. `qa-runtime/story-phase25-ab.json` ilk farkı yalnız `$.publicOpinion`, eski makro ve kaynak deltalarını `0` kaydetti. Bu yoğun hafızanın otomatik sürekli isyana dönüşmemesi Faz 26'nın ana eşik/histerezis kapısı olarak kaydedildi. |
| 03.08.2026 | Faz 26 tamamlandı. Şikâyet → hareket → eylem zinciri anlık zar yerine yayılım, süre, tekrar, etkilenen insan, örgütlenme vekili, mobilizasyon, radikalleşme ve devlet tepkisine bağlandı. Hedefli ağır krizde protesto 11., grev 16. tikte; tekrarlanan bastırma kaynaklı ayaklanma 55. tikte oluştu; kronik kriz tek başına ayaklanma üretmedi. İlk ülke-geneli grev etkisi fiziksel krizi iki kez sayıp sonucu yaklaşık `%36,39/%57,03/%52,03`e düşürdüğü için reddedildi; protesto üretimden ayrıldı, grev yalnız gelir/istihdam sorununa ve ilgili bölgeye daraltıldı, eski refah/fraksiyon/huzursuzluk köprüleri kaldırıldı. Normal 900 saniye 56 hareket ve 5 protesto üretti; zorlanmış grev/ayaklanma üretmedi. Tam karma `7a42d4d6…4b14`, politika `fnv1a32:bd78ac61`, test çıkışı `0`; `qa-runtime/story-phase26-ab.json` ilk farkı yalnız `$.collectiveAction`, bütün eski makro/kaynak deltalarını `0` kaydetti. |
| 04.08.2026 | Faz 27 tamamlandı. İç/sınır ötesi/mülteci göçü gerçek altyapı rotası, yolculuk süresi, kapasite, bloklama/yeniden deneme ve atomik kohort transferine bağlandı; ışınlanma ve nüfus üretimi engellendi. Hedefli `17` kişilik iç göç ile kapasitede bloklanıp sonra tamamlanan `90` kişilik, beş koridorlu mülteci akışı dünya nüfusunu tam korudu; bütün koridorlar kapalıyken sıfır akış oluştu. 900 saniyede `231` akış, `167` tamamlanma ve `3.955` taşınan kişi görüldü; gıda/enerji/yaşam `%85,13/%85,36/%73,33`, sekiz devlet hayatta. Tam test çıkışı `0`, karma `880b861b…33cb6`; `qa-runtime/story-phase27-ab.json` atomik transfer, nadir mülteci, kapasite ve kayıt/yükleme kapılarını sakladı. Konut, sınır politikası ve ticaretle ortak kapasite açık vekil borcu olarak Faz 28+ sahiplerine bırakıldı; 8 GB test heap'i oyun gereksinimi değil monolitik QA tezgâhı borcu olarak kaydedildi. |
| 05.08.2026 | Faz 28 tamamlandı. Sekiz devlette yedi türden 56 güç merkezi kanonik kohort, şirket/banka, bütçe, komutan ve garnizon kanıtına bağlandı; Faz 26 hareketleri kimlikli merkez referanslarına göç etti. Doğrudan örgüt kapasitesi bağlantısının yarattığı denge düşüşü ve kolektif→radikal merkez pozitif geri beslemesi reddedildi; nötr referans + ölü bölge + düşük sapma ağırlığı kabul edildi. 900 sn A/B bütün eski makro/kaynak deltalarını `0`, açık yolu 56 merkez/26 olay ve `52bd56c2…6607a` karma ile kaydetti. Tam test `1.645 sn`de çıkış kodu `0`; yetki Faz 29'a, gerçek makam karakterleri Faz 34'e, medya/güvenlik kapasitesi Faz 39/47'ye açıkça bırakıldı. |
| 05.08.2026 | Faz 29 tamamlandı. Sekiz devlet × beş kurum ve 29 eylem türü başvuru/onay/yürütme rotalarına bağlandı; sahte aktör, yasak rota ve yabancı yerel yetki alanı reddedildi. Küresel makam imzası ile “onaylayan önerir” kısa yolları reddedildi; ülke-bazlı imza ve ayrı `DIRECT/JOINT/PETITION` semantiği kabul edildi. Tam regresyon yükleme sırası ile UI gizli-yazma hatalarını buldu; ikisi düzeltildikten sonra `4a7b34ad…23a0` karmasıyla `1.734,8 sn`de geçti. 900 sn A/B bütün eski makro/kaynak deltalarını `0` tuttu; fiziksel uygulama Faz 30'a bırakıldı. |
| 05.08.2026 | Faz 30 tamamlandı. Faz 29'un geçerli kurumsal yetki fişleri ayrı meşruiyet, bürokrasi, hukuk, bütünlük, yapısal yolsuzluk riski ve bölgesel denetimle açıklanabilir uygulama biletlerine dönüştürüldü. Hedefli yollar `COMPLETED/DEGRADED/PAPER_ONLY` verdi; suç/fail uydurulmadı ve fiziksel sonuç sonraki domain tüketicisine bırakıldı. 900 sn A/B eski bütün makro/kaynak deltalarını `0`, açık yolu `6ab5c579…fd50` tuttu; doğal koşuda sahte karar/bilet üretilmedi. Tam test kapsam azaltılmadan `1.947,9 sn`de geçti; Faz 31 açıldı. |
| 05.08.2026 | Faz 31 tamamlandı. Rejime bağlı seçim modeli, tam kişi kohort oyları, koalisyon, dar sonuç itirazı, sertifika, mandat ve barışçıl makam devri sürümlü deftere bağlandı; adaylar Faz 34 öncesi açık liste vekili kaldı. 900 sn A/B `24` kayıt, `11` sertifika ve `11` devir üretirken bütün eski makro/kaynak deltaları `0` kaldı; açık karma `f7cfa97e…230d1`. Save/load makam sırası ve eski Faz 25 A/B izolasyonu tam testte yakalanıp düzeltildi. Kapsam azaltılmamış `npm test` `1.867,8 sn`de geçti; Faz 32 açıldı. |

### Faz 26 sonrası mimari dersler

- Protesto ile grev aynı şey değildir. Politik görünürlük fiziksel üretim kaybı doğurmaz; emek çekilmesi ancak sorun türü, katılım ve bölge bağlamı kanıtlıysa üretime yansır.
- Yeni bir toplumsal katmanı eski genel `welfare/unrest/faction` alanlarına tekrar yazmak “entegrasyon” değil çift muhasebedir. Yeni defter kendi gerçeğinin sahibi olmalı; eski alanlar yalnız açık bir göç/sözleşme varsa tüketmelidir.
- Türetilmiş ülke/bölge özetleri kayıt anında upstream sahiplik uzlaştırmasından sonra yeniden kurulmalıdır. Aksi halde tek tek hareketler doğru, kayıt içindeki aggregate yanlış olabilir.
- Bir özelliğin A/B kontrolünde kapatılması, onun öncülünü değil kendisini kaldırmalıdır; öncülü kapatan eski prob yeni bağımlı defteri de temizlemelidir. Aksi halde “kapalı” dünya yarım açık kalır.
- Normal 900 saniyelik koşunun her nadir dalı üretmesi başarı değildir. Normal koşu yanlış pozitif/dengeyi, hedefli ağır senaryo ise grev, bastırma ve ayaklanma gibi nadir nedensel yolları kanıtlar.
- Faz 28 öncesi örgütlenme yalnız `COHORT_NETWORK_PROXY_PRE_PHASE_28` vekilidir. Gerçek lider, sendika, kaynak ve kurumsal ağ eklenince geçmiş hareketler kimlikli güç merkezlerine göç ettirilmelidir; bugünkü vekil “tam örgüt sistemi” diye sunulamaz.

### Faz 27 sonrası mimari dersler

- Göç skoru tek başına mekanik değildir. Nüfus değişimi yalnız kanonik kohort sahibinin atomik transfer kapısından geçerse demografi, işgücü ve tüketim aynı gerçeği paylaşır; ayrı bir “göç nüfusu” çift muhasebe üretir.
- Mesafe etiketi rota değildir. Akış; gerçek koridor kimlikleri, gecikme, kapasite rezervi ve blokaj yaşam döngüsü taşımadıkça savaş, altyapı veya coğrafya tarafından gerçekten durdurulamaz.
- Kayıt almak gözlemsel olmalıdır. `forSave` sırasında geçerli upstream defteri yeniden kurmak canlı simülasyonu sessizce değiştirir ve deterministik devamı bozar; uzlaştırma yalnız doğrulama başarısızlığında çalışmalıdır.
- Eski bir A/B probu, yeni fiziksel tüketici eklendiğinde eski sonuç eşitliğini körlemesine koruyamaz. Faz 27 nüfusu gerçekten taşıdığı için bölgesel dağıtım sonuçlarını değiştirmesi beklenir; eski ekonomi benchmark'ı yeni downstream katmanı açıkça yalıtmalıdır.
- Nadir olayın normal koşuda görünmesi zorunlu değildir. 900 saniyelik dünya yanlış pozitifleri ve dengeyi; zorlanmış deterministik güvenlik fixture'ı mülteci, kapasite blokajı ve tamamlanma yolunu ayrı kanıtlar.
- `HOUSING_PROXY_PRE_ASSET_SYSTEM`, örtük sınır kabulü ve göçe özel kapasite bütçesi nihai sistem değildir. Gerçek konut, sınır rejimi ve ortak ticaret/ulaşım kapasitesi geldiğinde vekiller kanıtlı göç sözleşmesiyle değiştirilmelidir.
- Test kapsamını azaltmak yerine 8 GB heap ile geçici olarak korumak doğru ara karardır, fakat kalıcı mimari değildir. 46 problu monolit sonuç nesnelerini süreç sonuna kadar tuttuğu için test paketi faz kümelerine ayrılıp bağımsız Node süreçlerinde çalıştırılmalıdır.

| 10.08.2026 | Faz 38.1 üçüncü dikey dış analizdeki “anlama → inanç ayrımı → yetki” zincirini gerçek ön-incelemeye bağladı. Muhatap ham dünya/ticaret defterini değil yalnız kendi kaynaklı `ActorBelief` kayıtlarını okur. Ham sevkiyat kaydı cevabı değiştirmedi; `%92` doğrulanmış muhatap inancı `ASK_EVIDENCE` sonucunu `COUNTER_OFFER`a çevirdi. İki taraflı şirket/depo sahipliği, temsil, muhatap yetkisi, şirket kaydı, kapasite ve icra makamı ayrı denetlendi; sonuç hiçbir dalda dünyayı değiştirmedi veya komuta dönüşmedi. Saklanan mekanik cevap UI ve save/load'da geçti. EXT-001-R4 riski kapanmadı: kanıt/karşı teklif döngüsü ve `NegotiationCase` yaşam döngüsü sıradadır. |
| 10.08.2026 | Faz 38.1 dördüncü dikey dış analiz zincirindeki kanıt ve karşı teklif turunu uyguladı. Kanıt yalnız oyuncunun kaynaklı `ActorBelief` kaydından sunulabilir; sahte kimlik reddedilir. Muhatapta aynı olguya bağlı, oyuncu kaynaklı ve azaltılmış güvenli `REPORTED` bilgi doğar. Bu bilgi `ASK_EVIDENCE → COUNTER_OFFER`, mevcut şirket tavizi `COUNTER_OFFER → READY_FOR_NEGOTIATION` geçişini üretti. UI yalnız kanonik seçenekleri gösterir ve salt-okunur render defteri değiştirmez. Fiziksel ekonomi eşit, aday icra edilemez, save/load ve v2→v3 göç temizdir. EXT-001-R4 hâlâ açıktır: bu hazırlık `NegotiationCase` veya sözleşme değildir. |
| 10.08.2026 | Faz 38.1 kapanış paketi `62/62` görev sonucunu üç işçiyle `3.139,0 sn`de üretti; konuşma probu `17,8 sn` ve temizdir. Assertion aşaması yalnız son-300 yaşam koşulunda kaldı: `%69,2809 < %70`; final `%70,69`. İzole `first` koşusu `642,5 sn` ve aynı `5fb25684…64a` karmasıyla farkı doğruladı. Önceki kabul karması `70056c2d…6d4d36e5` idi. Eşzamanlı kullanıcı çalışması altı askerî bina/bağımlılık grafiğini `Production.js`te canlıya bağladığı için şehir yatırımı ve ana dünya karması değişmiştir. Bu çalışma geri alınmadı, eşik düşürülmedi ve denge sapması sohbet başarısı gibi yazılmadı. Faz 38.1 hedefli teknik zinciri temiz; küresel kabul `partial` kaldı. |
| 10.08.2026 | Faz 38.2 ilk izole uzun-diyalog dikeyi uygulandı. Üç gerçek karakterin her biri 24 tur konuştu; `72/72` çıktı sürümlü, deterministik, dünya-nötr ve iç alan sızıntısız kaldı. Son 12 tam cümle, son altı şablon, `%72` iki-sözcüklü Jaccard tavanı ve üçüncü hitap engeli uygulandı. İlk koşuda hitap aday havuzu doğruyken sıralama cezasının eksik olduğu yakalanıp düzeltildi. Üç ses ekseni imzası ayrıştı; gerçek manifest işçisi `1/1` geçti. Bu sonuç insan kör değerlendirmesi veya gerçek anlamsal gömme kanıtı değildir; EXT-001-R4 yalnız kısmen azaltıldı. |
| 10.08.2026 | Faz 38.2 ikinci dikeyi laboratuvar gerçekleştiricisini gerçek Faz 38.1 `domainReview.response` hattına bağladı. Kanonik kural cevabı `mechanicalText` içinde korunur; oyuncu aynı konuşma eyleminin aktör sesiyle gerçekleştirilmiş sürümünü görür. Birleşik prob doğal söz doğrulaması, mekanik zemin eşitliği, ekonomi nötrlüğü, icra engeli, defter geçerliliği ve save/load'u geçti. Metin katmanı karar üretmez; `NegotiationCase` borcu Faz 38.3'e aittir. |
| 10.08.2026 | Faz 38.2 üçüncü dikeyi sahte embedding iddiası yerine iki açık kanıt ekledi. Türkçe kök/eşanlam kümesi içerik yakınlığı 72 turda en çok `%37,5` verdi ve `%86` tavanını geçti. Ayrı anahtarlı kör paket üç ses için 12 eğitim + 24 anonim değerlendirme maddesi üretti; aktör kimliği/ses imzası sızmadı. Puanlayıcı `%100` pozitif ve `%33,33` tek-ses negatif kontrolde doğru ayrıştı. İnsan yanıtı olmadığı için kör ses kabulü verilmedi; Faz 38.2 `partial` kaldı. |
| 10.08.2026 | Faz 38.3 ilk dikeyi sürümlü `NegotiationCase` defterini gerçek hazır konuşma UI'sına bağladı. Aynı oturum ikinci vaka üretmez; yalnız taraflar kapalı dört şartta yeni sürüm açabilir. Dış aktör, bilinmeyen bedava alan ve eski sürüm kabulü reddedildi. İki taraf güncel sürümü kabul ettiğinde dahi mekanik sözleşme onayı `PENDING`, icra `NOT_AUTHORIZED` kaldı. Gerçek ekonomi/stok/sevkiyat eşit, defter ve save/load geçerlidir. Bu henüz söz, sır, borç, son tarih, ihlal veya fiziksel sözleşme icrası değildir. |
| 10.08.2026 | Faz 38.3 ikinci dikeyi söz/son tarih/ihlal hattını gerçek sürüm olayına bağladı. `PROVIDE_COUNTER_OFFER`, ancak söz verenin daha yeni gerçek teklif sürümüyle `KEPT`; `SECURE_MECHANICAL_APPROVAL`, onay icrası yokken son tarihte `BROKEN` oldu. Mevcut ilişki ve PROMISE/DEBT hafızası tek kaynak sahibi olarak kullanıldı; ikinci tick ikinci etki üretmedi. Tutulma güven/saygı/borç, ihlal güven/saygı/husumet değiştirdi; fiziksel ekonomi aynı kaldı. Beş saniyelik scheduler kaydı izole geçti. Ağır scheduler A/B+devam probu yoğun CPU altında iki kez dış zaman sınırını aştı; küresel kabul verilmedi. |
| 10.08.2026 | Faz 38.3 üçüncü dikeyi özel sır paylaşımı ve sızıntı keşfini kurdu. Yalnız vaka tarafının sahip olduğu `%50+` güvenli PRIVATE ActorBelief paylaşılabilir; alıcı kaynak inanca bağlı REPORTED inanç ve iki taraf SECRET hafızası kazanır. Yetkisiz ifşa ayrı özel WorldFact ile yalnız sızdıran/alanda kaldı: sır sahibi bilgi veya ilişki cezası almadı, ilgisiz dördüncü aktöre sızıntı olmadı. İfşa olgusunu bilen aktörün kaynaklı raporu sahibin inancını, `−800 güven / −300 saygı / +500 husumet` ve BETRAYAL hafızasını bir kez üretti; tekrar rapor etkisizdir. Altı hedefli kapı, kimlik+müzakere doğrulaması ve birebir save/load geçti. Fiziksel icra hâlâ kapalıdır. |
| 10.08.2026 | Faz 38.3 mekanik icra ön-incelemesi teklif veri kaybı buldu: konuşma `payment` ve `contract_penalty` sınıfını `type` alanında taşırken müzakere yalnız `unit` okuyordu; ilk sürüm ödeme/cezayı sessizce kaybedebiliyordu. Dönüştürücü `unit|type` kanonikleştirdi, vaka açılışı ve her sürüm doğrulaması dört şartın tamamında pozitif miktar+açık birimi zorunlu yaptı. Gerçek runtime ilk sürümde `ton/capital/DAY/PERCENT`, sonraki karşı teklif ve sır zinciri temiz, save/load birebir kaldı. Bu hata kapatılmadan mekanik onay eklenmesi sahte güvenlik olacaktı. |
| 10.08.2026 | Faz 38.3 dördüncü dikeyi kabul edilmiş metni kimlikli mekanik zemine ve idempotent ön-kontrol makbuzuna bağladı. Zemin gerçek sevkiyat, depo, kaynak, şirket, yönlendirme isteği, iddia ve domain-review kimliklerini kaynak aday karmasıyla kilitler. Çelik fikstürü fiziksel icra edilmedi: kopuk sipariş referansı, `ton` dönüşümü, gerçek depo doluluğu, pazarlık bedeli escrow'su, teslim takvimi ve ceza yürütücüsü ayrı engel kodları üretti. Dış aktör reddedildi; aynı girdi aynı makbuzu döndürdü; yeni teklif eski sürüm yetkisini sıfırlayıp tarihsel makbuzu korudu. UI yalnız güncel sonucu gösterdi; ekonomi/stok/sevkiyat eşit, save/load ve eski vaka zemin kurtarması geçerli kaldı. |
| 10.08.2026 | Faz 38.3 beşinci dikeyi katalog birimi, depo doluluğu ve pazarlık escrow rezervini kurdu. `industrial_parts + ton` reddedildi; `lot-parça→parts_lot`, `ton-gıda→food_ton` doğrulandı. Depo doluluğu ayrı stok yaratmadan bölgesel teslim edilmiş stok + yalnız yoldaki fiziksel sevkiyattan türetildi. Pazarlık bedeli mevcut şirket `CASH→TRADE_ESCROW` fişi ile bütçedeki `NEGOTIATED_CONTRACT_ESCROW` settlementına atomik bağlandı; aynı kimlik ikinci kesinti yapmadı, farklı tutar çatıştı, release nakdi birebir geri verdi. Bütçe/şirket doğrulaması temizdir. Çelik vakasının `550` bedeli yürütücü eksikliği değil gerçek nakit yetersizliği verir; satıcıya teslim uzlaşması, takvim ve ceza hâlâ açık olduğundan fiziksel onay verilmedi. |
| 10.08.2026 | Faz 38.3 altıncı dikeyi gerçek yönlendirme–teslim–ihlal yaşam döngüsünü kurdu. Etkinleştirme anında ön-kontrol tekrar edilir; şirket escrow'u ayrılır, kanonik ticaret amendment'ı rotayı değiştirir ve tek settlement sevkiyata bağlanır. 30 gün `10 sn`, iki ay `20 sn`, `%10 × 500 = 50` deterministik doğrulandı. Zamanında yol `FULFILLED/KEPT`, gecikme yolu escrow iadesi + şirketler arası ceza + `−700/−300/+450` güven/saygı/husumet ile `BREACHED/BROKEN` üretti; tekrar tick para, ilişki veya sayaç üretmedi. Satıcı nakdi `500` cezaya yetmediğinde `BREACH_PAYMENT_PENDING` save/load'da korundu ve 30 dünya günlük geri-deneme dolmadan ikinci tick çalışmadı. Prob, yerli B2B teslimatta alıcı muhasebe envanteri ile eski lot sahibinin ayrıştığını yakaladı; settlement'a bağlı farklı şirket alıcısında fiziksel lot sahipliği devriyle kapatıldı. Üç yol müzakere, bütçe, şirket, commerce ve ticaret defterlerini, UI etkinleştirme durumunu ve byte-byte ilk save/load'u geçti. Mevcut escrow'a bağlı sevkiyat çift ödeme yapılmadan `SHIPMENT_PAYMENT_ALREADY_BOUND` ile bloke edilir; gerçek alıcıdan alıcıya hak/ödeme devri genel `MechanicalContractV1` borcudur. |
| 11.08.2026 | Faz 38.3 yedinci dikeyi, bağlı escrow'u silip yeniden yazma fikrini reddederek yoldaki malı gerçek iki satış zinciriyle devretti. Özgün sipariş ve satıcı→ilk alıcı escrow'u korunuyor; yeni alıcı yalnız mevcut alıcıyı temsil eden konuşma tarafıyla anlaşırsa ilk alıcıya ikinci escrow açıyor. Teslimatta iki settlement tek rollback sınırında kapanıyor, ara alıcının edindiği envanter aynı yükün maliyetiyle satışta çıkıyor ve tek fiziksel lot yeni faydalanıcıya geçiyor. Kayıpta iki rezerv birlikte iade edilir. Dördüncü hedefli yaşam yolu iki settlement `SETTLED`, ilk sipariş/escrow değişmezliği, ara envanter baz çizgisi, yeni lot sahibi, tekrar-tik idempotensi, beş defter doğrulaması ve birebir save/load'u geçti. Bu yalnız dar `GOODS/BUYER_TO_BUYER_RESALE` uygulamasıdır; genel `MechanicalContractV1`, devlet ödemeli devir ve çok taraflı onay açık kalır. |
| 11.08.2026 | Faz 38.3 sekizinci dikeyi konuşma vakası ile mekanik sözleşmeyi ayırdı. `MechanicalContractV1` beş sözleşme ailesini tanıyan bağımsız, sürümlü, hash-kilitli defterdir; aktör temsilcisi ve hukuki şirket tarafı, kaynak vaka/sürüm/önkontrol, kapsam, fiyat, takvim/SLA, ihlal, nedensel kimlik ve icra makbuzu ayrı alanlardır. Doğrudan teslimde karşı tarafın satıcı şirket temsili artık zorunludur. Kanıtlı `GOODS` adaptörü dört yaşam yolunda `ACTIVE→FULFILLED/BREACHED/BREACH_PAYMENT_PENDING` durumlarını gerçek teslim makbuzuyla izledi; sözleşme ve müzakere kayıtları ayrı ayrı save/load'da birebir döndü. Aktif içerik değiştirilemez, yalnız henüz icra edilmemiş taslak yeni önkontrol kanıtıyla yenilenebilir. Konuşma/UI ve eski kayıt göçü hedefli regresyonları geçti. Diğer dört aileyi şemada saymak uygulamak değildir; adaptörleri açık borçtur. |
| 11.08.2026 | MechanicalContractV1 sonrası altı işçili tam kabul paketi `64/64` görev, `736,8 sn` ve çıkış `0` verdi. 900 saniyelik ana dünya karması `a1c2f0c9f6a21ce62a2b5251b7d6550d401e32a5d268eb242776acc5e5c98c4d`; sekiz devlet etkin, gıda `%79,33`, enerji `%78,31`, yaşam koşulu `%72,56`. Böylece önceki ağır scheduler kabul borcu bu çalışma ağacı için kapandı; insan kör ses değerlendirmesi ile dört sözleşme adaptörü açık kaldı. |
| 11.08.2026 | Faz 38.4 ilk senaryo laboratuvarı kullanıcı gözlemini doğruladı: günlük sözler ya genel bilgi sorusuna yanlış sınıflanıyor ya da sosyal niyet seçilse bile karakter cevabı üretmeden `READY_FOR_REVIEW` durumunda kalıyordu. Yedi kapalı sosyal niyet ayrı puanlandı ve gerçek muhatabın mevcut ses gerçekleştiricisine bağlandı. Yedi örnek; doğru niyet, karakter kimlikli cevap, sıfır mekanik soru/domain kontrolü/çalıştırılabilir aday/dünya değişimi, farklı cümle, UI görünürlüğü, defter doğrulaması ve birebir save/load ile geçti. `conversationUnderstandingProbe` `4,7 sn`, uzun diyalog yakın regresyonu `57,1 sn`, kayıt göçü `1,8 sn` ve üçü de çıkış `0` verdi. Bu bir genel sohbet modeli değildir; serbest konulu takip, dünya olayına dayalı görüş ve senaryo ağaçlarının koşul matrisi açık borç olarak tutuldu. |
| 11.08.2026 | Faz 38.4 sonrası altı işçili tam paket, yoğun makine yükünde `1.204 sn` dış komut sınırında toplu sonuç üretmeden zaman aşımına uğradı. Bu test başarısı olarak kaydedilmedi. Ana kabuk kapanınca 10:37 başlangıçlı altı hikâye işçisi kısa süre daha çalıştı; yalnız bu koşuya ait süreçler kapandı, 09:15 başlangıçlı kullanıcı Node süreçlerine dokunulmadı. Hedefli üç regresyon temizdir fakat yeni tam paket kabulü açık kalır. |
| 11.08.2026 | Faz 38.4 ikinci dikeyi, on bir referans vakayı üçer aday dallı katalogda topladı fakat yalnız tahıl kıtlığı ağacını `LAB_EXECUTABLE` yaptı; uygulanmayan ağaçlar `CONTRACT_ONLY` kaldı. On tahıl vakası aynı sözün oyuncu bilgisi, muhatap ActorBelief'i, yetki, karakter duruşu, teklif türü ve motor gerçeğine göre ayrıştığını gösterdi. Özellikle muhatap inancında aktif, motor gerçeğinde kayıp sevkiyat aynı sözlü cevabı üretirken mekanik kapıda `SHIPMENT_NOT_ACTIVE` kaldı. Fikstür sonucu asla komut değildir. NLU tarafında tahıl/buğday kanonik `food`, gerçek `trade-shipment:*`, açık oturumdaki başkent region'ı ve `PROPOSE_LOGISTICS_REDIRECT` bağlandı; yetki ve bölgesel kapasite açık kaldı. Yeni prob `0,5 sn`, konuşma yakın regresyonu `4,6 sn`, manifest `65/65` temizdir; tam paket kabulü verilmedi. |
| 11.08.2026 | Faz 38.4 üçüncü dikeyi çelik grevini 12 vakalık ikinci `LAB_EXECUTABLE` ağaca çevirdi. Bilgi, sendika mandatı, şirket likiditesi, ücret–enflasyon farkı, destek, savunma üretimi aciliyeti, güvenlik kanıtı ve üç lider duruşu ayrı girişlerdir. Liderin en olumlu cevabı dahi üye oylamasına sunumdur; grevi kapatmaz. Tehdit baskı uygulamaz, primle bölme ayrımcılık kapısını geçmez. İnançta aktif/motorda çözülmüş grev `STRIKE_NOT_ACTIVE` ile ayrılır. Mevcut ihtiyaç defteri `wageModelActive=false` dediği için fikstürün ücret modelini açmasına izin verilmedi. Serbest metin gerçek `movement:*`, labor niyeti ve dört mekanik borcu bağlar; oturum/UI `SCENARIO_LAB_ONLY` diye dürüst kalır. İlk manifest koşusu 80 sn sessizlikte elle kesildi, artık işçi bırakmadı; doğrudan `0,64 sn`, tekrar manifest `0,6 sn`, mevcut konuşma regresyonu `2,9 sn` ve çıkış `0` ile sorun tekrar üretilemedi. |
| 11.08.2026 | Faz 38.4 dördüncü dikeyi silah ihalesi dosyasını 13 vakalık üçüncü `LAB_EXECUTABLE` ağaca çevirdi. Gerçek `integrity-case:*` ve soruşturma fişi kullanılabilir; isimli gazeteci, medya sahibi ve savcı ağı henüz yoktur. Gazeteci inancı, kaynak zinciri, belge bütünlüğü, gerçek ihale durumu, yetki, basın geçmişi ve kişilik ayrı tutuldu. Değiştirilmiş ve sahte belge aynı inanç cevabından sırasıyla bütünlük incelemesi ve yanlış kanıt kapısına ayrılır. Rüşvet/yayın tehdidi yalnız tepki adayıdır; uygulanamaz. NLU yayın erteleme niyetini ve gerçek dosya kimliğini bağlar, UI hiçbir dosya/yayın durumunun değişmediğini söyler. Zaman aşımından kalan 12:05–12:07 test süreçleri temizlenince doğrudan prob `0,595 sn`, manifest `0,6 sn`, mevcut sohbet `3,6 sn` geçti. Uzman karakter sahipliği Faz 39–42 ve 57/59–60'a açıkça bırakıldı. |
| 11.08.2026 | Faz 38.4 beşinci dikeyi sınır yığınağını 15 vakalık dördüncü `LAB_EXECUTABLE` ağaca çevirdi. İstihbarat aktörleri gerçektir; stratejik rapor ve seferberlik doktrini değildir. Rapor inancı, gerçek niyet, güven, yetki, antlaşma, yanlış alarm, maliyet ve görünürlük ayrıldı. Tatbikat/aldatma, inanılan saldırı cevabından mekanik kapıda ayrışır. NLU kaynaklı `actor-belief:*` raporunu ve önleyici seferberlik niyetini bağlar; hiçbir birlik, mayın, savaş veya ültimatom üretmez. İlk prob plan dalı ile iç teklif enumu uyuşmazlığını `SELECTED_BRANCH` ile yakaladı; açık eşleme sonrası doğrudan `0,622 sn`, manifest `0,6 sn`, mevcut sohbet `4,2 sn` geçti. Gerçek sahiplik Faz 47–52, 57 ve 59–60'tadır. |
| 11.08.2026 | Faz 38.4 altıncı dikeyi yaptırım/paravan şirket vakasını 18 varyantlı beşinci `LAB_EXECUTABLE` ağaca çevirdi. Şirket sahipliği, fiziksel ticaret escrow'su ve ajan karakterleri gerçektir; yaptırım rejimi, nihai faydalanıcı grafiği, AML ve gümrük yakalanma modeli değildir. Yaptırım inancı ile gerçek yürürlük, mal sınıfı, aracı kapasitesi/güveni, ödeme kanalı, yetki, kişilik ve muafiyet yolu ayrıldı. İnanç aktifken gerçek yaptırımın sona ermesi aynı sözlü cevabı `SANCTION_NOT_ACTIVE` mekanik kapısından ayırır. Tehdit yalnız karakter tepkisi üretir; küçük deneme ve muafiyet de şirket, ödeme, sevkiyat veya diplomasi değiştirmez. NLU `actor-belief:*` kaydını dünya gerçeğine çevirmeden `PROPOSE_SANCTIONS_EVASION` niyetine bağlar; UI açıkça değişiklik olmadığını söyler. Doğrudan prob `2,7 sn`de 18/18 beklenen sonuç, determinizm, şema, bilgi/doğruluk ayrımı, dünya nötrlüğü ve UI dürüstlüğünü; hedefli manifest `0,7 sn`, mevcut sohbet regresyonu `2,9 sn`de geçti. Tam paket kabulü henüz verilmedi. |
| 11.08.2026 | Faz 38.4 yedinci dikeyi mülteci yerleştirme/sınır pazarlığını 20 varyantlı altıncı `LAB_EXECUTABLE` ağaca çevirdi. Faz 27'nin gerçek `REFUGEE` akışı, kohort, rota, gecikme ve atomik nüfus aktarımı vardır; kabul kapasitesi konut değil altyapı+nüfus vekilidir. Konut varlığı, aile ağı, sınır/iltica politikası, yardım fonu yürütücüsü ve üçüncü ülke transit anlaşması yoktur. Bilgi ile akış gerçeği, insan sayısı, hedef/iş kapasitesi, gıda-güvenlik, yerel tutum, yardım, yetki, rıza, karakter ve komşu güveni ayrıldı. İnançta bekleyen fakat gerçekte tamamlanmış akış aynı cevabı `REFUGEE_FLOW_NOT_ACTIONABLE` kapısından ayırır. Zorla yerleştirme/geri dönüş uygulanamaz; transit teklifi üçüncü ülke politikası olmadan ilerlemez. NLU gerçek `migration:*` ve `region:*` kimliğini bağlar; UI sınır, göç ve nüfusun değişmediğini söyler. Doğrudan prob `2,5 sn`, manifest `0,8 sn`, sohbet regresyonu `5,8 sn` ve çıkışlar `0`; tam paket kabulü verilmedi. |
| 11.08.2026 | Faz 38.4 sekizinci dikeyi banka kurtarma/oligark vakasını 20 varyantlı yedinci `LAB_EXECUTABLE` ağaca çevirdi. Gerçek banka bilançosu, şirket kredisi, devlet bütçesi ve integrity-case vardır; hane mevduat hesapları, sistemik bulaşma, banka sahibi/yönetim kurulu, çözümleme/tasfiye, mevduat transferi ve medya sahiplik ağı yoktur. Kriz inancı ile banka gerçeği, likidite kanıtı, bilanço, mevduat, bağlantı, bütçe, yetki, sahiplik, kişilik ve çözümleme kapasitesi ayrıldı. İnançta kriz/gerçekte solvent banka aynı cevabı `BANK_CRISIS_NOT_ACTIONABLE` kapısından ayırır. Gizli medya karşılığı kredi yolsuzluk kapısında, sahte bilanço soruşturma kapısında kalır. NLU gerçek `bank:*` kimliğini bağlar; UI banka, mevduat ve ödemenin değişmediğini söyler. Doğrudan prob `2,7 sn`, manifest `0,8 sn`, sohbet regresyonu `2,9 sn` ve çıkışlar `0`; tam paket kabulü verilmedi. |
| 11.08.2026 | Faz 38.4 dokuzuncu dikeyi savaş esiri takasını 21 varyantlı sekizinci `LAB_EXECUTABLE` ağaca çevirdi. İsimli askerî/istihbarat karakteri, ActorBelief, kamuoyu ve temel diplomasi vardır; esir/gözaltı defteri, sağlık, kişiye bağlı sır, tarafsız gözlemci, takas ve arama-kurtarma yürütücüsü yoktur. Liste inancı ile gerçek kişi durumu, kimlik/sağlık, sır, bilgi erişimi, kamuoyu, geçmiş ihlal, takas güvenliği, gözlemci, yetki, kişilik ve özür ayrıldı. İnançta listede/gerçekte kayıp kişi aynı cevabı `DETAINEE_CASE_NOT_ACTIONABLE` kapısından ayırır. Gizli bilgi ve propaganda dalları yalnız tepki üretir. NLU ActorBelief'i gerçek esir kaydına çevirmeden takas niyetine bağlar; UI esir ve takasın değişmediğini söyler. Doğrudan prob `2,8 sn`, manifest `0,8 sn`, sohbet regresyonu `2,9 sn` ve çıkışlar `0`; büyük paket sonucu ayrı kaydedilecek. |
| 11.08.2026 | Faz 38.4 onuncu dikeyi boru hattı sabotajı ortak soruşturmasını 24 varyantlı dokuzuncu `LAB_EXECUTABLE` ağaca çevirdi. Gerçek enerji koridoru, sabotaj makbuzu ve tespit/atıf vardır; ortak teknik heyet, neden defteri, sensör/devriye kayıt paylaşımı, tarafsız uzman, eşzamanlı rapor, medya suçlaması, sınır protokolü ve dosya redaksiyonu yoktur. İnanç ile gerçek neden, kanıt, kayıt hassasiyeti, sensör, bağımlılık, medya, protokol, uzman, geçmiş yayın ihlali, yetki, kişilik ve kaçakçılık dosyası ayrıldı. İnançta sabotaj/gerçekte kaza aynı cevabı `SABOTAGE_CAUSE_NOT_CONFIRMED` kapısından ayırır; doğrulanmamış suçlama ve gizli takas uygulanmaz. NLU gerçek `corridor:energy:*` kimliğini ActorBelief olay kaydından ayırarak ortak soruşturma niyetine bağlar; UI boru hattı, soruşturma ve enerjinin değişmediğini söyler. Doğrudan prob `2,9 sn`, manifest `0,9 sn`, sohbet regresyonu `2,8 sn`, çıkışlar `0`; büyük paket son ağaçtan sonra çalıştırılacak. |
| 11.08.2026 | Faz 38.4 on birinci dikeyi darbe söylentisi/halefiyeti 28 varyantlı onuncu ve son `LAB_EXECUTABLE` ağaca çevirdi. Gerçek Faz 33 siyasi kriz ve komutan sadakati, kurum yetkisi, ActorBelief ve Faz 37 istifa/halef yürütücüsü vardır; lider sağlığı, acil anayasal geçiş, makam sözü, darbeci dezenformasyonu ve ordu tarafsızlık emri yoktur. Söylenti ile gerçek kriz, lider durumu, sadakat, yetki, anayasal sıra, imza zinciri, kişilik, rakip ağ, kapasite ve geçmiş söz ayrıldı. İnançta kriz/gerçekte yok aynı cevabı `POLITICAL_CRISIS_NOT_ACTIONABLE` kapısından ayırır; kişisel makam ve dezenformasyon dalları uygulanmaz. NLU deterministik gerçek `political-crisis:*` kimliğini ActorBelief söylentisinden ayırır; UI darbe, makam ve ordunun değişmediğini söyler. Doğrudan `3,4 sn`, manifest `1,4 sn`, sohbet regresyonu `2,8 sn`; tam paket `65/65`, `596,4 sn`, çıkış `0`, ana karma `a1c2f0c9…c4d`, ihtiyaçlar `%79,33/%78,31/%72,56`. On matris tamamlandı; adaptör ve geri çağrım borcu açık. |
| 11.08.2026 | Faz 38.4 esir takası sonrası ilk altı işçili büyük koşu 65/65 görev sonucunu `720,1 sn`de üretti fakat son assertion'da başarısız oldu: laboratuvar uyarısına yeni alanlar eklenirken eski “Grev, ücret, rota veya sevkiyat değişmedi” kesintisiz sözleşmesi kırılmıştı. Bu mekanik dünya hatası değil, gerçek UI geriye uyumluluk regresyonuydu ve başarı sayılmadı. Uyarı; grev, ihale, yaptırım, göç, banka, esir ve seferberlik için ayrı açık “değişmedi” ifadelerine bölündü; karşı-prob yedi alanın tamamında geçti. İkinci kapsamı azaltılmamış paket `65/65`, `1043,0 sn`, çıkış `0`; ana dünya karması değişmeyen `a1c2f0c9f6a21ce62a2b5251b7d6550d401e32a5d268eb242776acc5e5c98c4d`, sekiz devlet ve `%79,33/%78,31/%72,56` gıda/enerji/yaşam verdi. |
| 11.08.2026 | Faz 38.5 ilk dikeyi gerçek Faz 33 siyasi krizini görüşme başlangıcına bağladı. Yalnız oyuncuya görünür aktif kriz, gerçek katılımcı muhatap ve kanonik son olay kimliği şema-4 oturuma girebilir; sahte/görünmeyen kimlik oturum üretmeden reddedilir. Aynı oturumda serbest takip sorusu önceki siyasi konuyu korur; cevap yalnız görünür olay+kriz kanıtına dayanır, ham dünya okumaz ve gizli niyeti kesin gerçek diye sızdırmaz. UI ilk söz+takip+cevabı tek akışta gösterir; konuşma dünya komutu değildir. Save/load ve v2→v4 göç temizdir. İlk tam koşuda bulunan test altyapısı kusuru da kapatıldı: büyük sonuç sonrası `done` öncesi tam GC işçileri CPU rekabetinde kilitliyordu; sonuç önce bildirilip büyük işçi yenileniyor. Nihai kapsamı azaltılmamış paket `65/65`, `1511,7 sn`, çıkış `0`; sohbet probu `8,2 sn`, ana karma `a1c2f0c9…c4d`. Zorunlu mini zincirin ilişki+dünya kararı+kriz+savaş/barış+sonraki geri çağrım bölümü açık; Faz 38.5 `partial`dır. |
| 11.08.2026 | Dış teknoloji analizi ana plana Faz 42.1–42.14 yükseltmesi olarak kabul edildi. Ayrıştırılan içerik taslağı `1.300` benzersiz düğüm, `20` domain, `100` aile, `11` benimseme profili, `60` uygulama, `40` politika, `9` inanç boyutu ve `10` kültür kanalı taşıdı; yinelenen kimlik/ad, eksik öncül, bilinmeyen capability, bozuk domain/profil ve kronoloji hatası `0`dı. Buna rağmen bütün ailelerin tam `13` seviye ve bütün düğümlerin aynı altı edinim yoluna sahip olması nihai motor kuralı olarak reddedildi. Yükseltme; statik DAG ile dinamik kanıtı, aktör/tesis kabiliyet erişimini, uygulama/kurulu varlığı, kanonik hukuk ve ActorBelief/Hype'ı ayırır. `ResearchEvidenceV1`, `CapabilityAccessGrantV1` ve `ApplicationDeploymentReceiptV1` kod öncesi zorunlu borçtur. İlk dilim yarı iletken–AI–otomasyon; aktif sıra Faz 38.5, medya bağı kullanıcı tarafından Faz 39–42'de ayrıca geliştirilmektedir. |
| 11.08.2026 | Faz 38.5 ikinci dikeyi aynı gerçek siyasi kriz için lider+iki sadık karakter görüşmesini açtı. Aynı söz, gerçek kimlik/hedef ve yönlü ilişki koşullarından üç farklı gerekçe/duruş üretti; yüksek husumet+düşük güven taahhüdü reddetti. `EVENT_COUNSEL_RESPONSE` nötr kaldı. Ayrı oyuncu kabulü mevcut Faz 33 eylemini çağırdı, konuşma oturumu+yanıtına geri izlenen tek kriz kaydı ve karakter→oyuncu ilişki makbuzu üretti; ikinci kabul idempotent reddedildi. Oturum şema-5, v2→v5 göç, gerçek DOM, beş fiziksel defter hash nötrlüğü, doğru ilişki öncesi/sonrası makbuzu ve byte-byte save/load nihai hedefli probda `6,7 sn`de geçti. Yeni 65 görevli tam paket ağır CPU paylaşımında `604 sn`de tek sonuç dosyası üretemeden dış sınırı gördü; başarı yazılmadı, yalnız bu koşunun yetim işçileri kapatıldı. Söz sonucu→kriz→savaş/barış ve sonraki kısa/orta/uzun geri çağrım Faz 38.5'in açık üçüncü dikeyidir. |
| 11.08.2026 | Dış `ModernCharacterBehaviorSystem` ana plana Faz 38.6–38.12 yükseltmesi olarak seçici kabul edildi. WorldFact→InformationItem→ActorBelief, rol/kişisel hedef ayrımı, mekanik aday önceliği, LLM yetkisizliği, açıklanabilir kusur, DecisionTrace, persona, event-driven tier ve kariyer önerileri mevcut mimariyle uyumludur. Tek `CharacterV2` içine ilişki/hafıza/inanç/güç kopyalama, on korelasyonlu ilişki sayacı, saklanan keyfî PowerProfile, adaptersiz onlarca rol eylemi ve kayıtsız bounded-noise reddedildi. Yükseltme; DecisionContext/Trace V2, sınırlı bias-stres-persona, olay etiketli ilişki/hafıza geri çağrımı, gerçek kurumsal rol adaptörleri, türetilmiş güç+kariyer, kohorttan karakter tier yükselmesi ve gizlilik korumalı QA/UI olarak bölündü. Aktif Faz 38.5 sırası değişmedi; kullanıcının bina geliştirmesi kapsam dışı bırakıldı. |
| 11.08.2026 | Faz 38.5 üçüncü dikey A, kararın sonraki konuşmada kaynaklı hatırlanmasını kurdu. Kabul edilen gerçek siyasi kriz tavsiyesi danışman+oyuncunun tuttuğu çözülmüş EPISODE kaydına kriz/oturum/yanıt/karar/eylem sırası/sonuç kimlikleriyle yazılır. Yeni `storyMemoryRecallForActor` yalnız çağrılan karakterin sahip olduğu RECENT, katıldığı EPISODE ve tuttuğu MILESTONE kayıtlarını seçer; ham dünya okumaz. Konu filtresi kriz/karar ile PROMISE geri çağrımını ayırır; DEBT kaydı konu dışı cevabı ele geçiremez. Sonraki ayrı görüşmede gerçek sonuç kodu orta-vadeli kayıttan kaynaklarıyla döndü. Oturum şema-6, v1..5 göç, sayaç ve byte-byte save/load temiz; hedefli prob `5,5 sn`. Bu söz yaşam döngüsü değildir: mevcut Faz 38.3 OPEN→KEPT/BROKEN motoru sonraki dikeyde kriz adaylarına bağlanacak, ikinci söz motoru kurulmayacak. Bina dosyalarına dokunulmadı. |
| 11.08.2026 | Aynı hafıza seçicisi Faz 38.3'ün gerçek söz yaşam döngüsüne bağlandı. Oyuncunun yeni karşı teklifiyle kapanan `PROVIDE_COUNTER_OFFER` sözü KEPT; süre sonunda mekanik onay sağlanmayan `SECURE_MECHANICAL_APPROVAL` sözü BROKEN kaldı. Muhatap sonraki ayrı görüşmede iki kalıcı PROMISE kaydını commitment kimlikleri, LONG ufku ve KEPT/BROKEN durumlarıyla birlikte hatırladı; ham dünya okuması ve yeni ilişki/dünya etkisi yok. Türkçe `söz/tuttu*/bozdu*` geri çağırma tetikleyicileri eklendi. Hedefli prob karar ve söz hatırlama kapılarının tamamını `5,5 sn`de geçti. Açık borç, bu iki sonucun gerçek ekonomik/diplomatik uyuşmazlık adaylarını farklılaştırmasıdır; mevcut kurum savaş/antlaşma yürütücüsü `RECORD_ONLY` olduğu için ticari ihlal doğrudan savaşa çevrilmedi. |
| 11.08.2026 | Canlı UI'da görülen “Seni dinliyorum” tekrarı gerçek takip-yolu hatasıydı: ilk sosyal cevap karakter gerçekleştiricisinden, devam mesajı genel fallbackten geliyordu. `REQUEST_SUPPORT` kapalı niyeti ve takip-turu gerçekleştiricisi eklendi; geçmiş son 12 realization içinden tekrar/benzerlik/hitap tavanları yeniden kullanılıyor. Aynı “evet, bana yardım edecek misin” cümlesinin iki ardışık turu farklı geçerli yanıt verdi; istenmeyen kalıp canlı kaynaklarda sıfırlandı. Aynı dilimde KEPT söz `COOPERATIVE_FOLLOW_UP`, BROKEN söz `COMMERCIAL_DISPUTE` adayı üretti. Adaylar farklı next-step kodlu, idempotent, save/load kapsamlı ve yürütülemezdir; diplomasi yürütücüsü olmadığı için savaş/barış `null` bırakıldı. Hedefli birleşik prob sosyal tekrar, müzakere doğrulaması ve söz hafızasıyla temiz geçti. |
| 11.08.2026 | Kullanıcının son görüşme ekranı gerçek Electron compositor ile yeniden üretildi. Profil/merkez/geçmiş oranı `250 / 875 / 310` mantıksal sütun düzenine çekildi; oturum akışı ayrı kaydırma alanı, takip bestecisi sabit alt satır oldu. Büyük eylem düğmeleri ve beyaz takip alanı terminal ritmine indirildi. UI otomasyonu menu→kurulum→karakter→dünya→dolu görüşmeyi geçti; kabuk viewport içinde, besteci merkez içinde ve konsol problemi `0`dı. Faz 38.5'te BROKEN sınır-aşan söz ayrıca kaynaklı `DIPLOMATIC_INCIDENT_REVIEW` dosyasına bağlandı. Gerçek söz/çözüm olayı, aktör ilişkisi, devlet ilişkisi, antlaşma ve kurum savaş rotası okunuyor; protesto devlet yetkisi bekliyor. Ölçülmüş maddi zarar bulunmadığı için `0 < 250` savaş eşiği geçilmedi, savaş/barış adayı ve dünya mutasyonu oluşmadı; tekrar inceleme idempotent geçti. |
| 11.08.2026 | Uzun görüşmede görünmeyen alt konuşmalar gerçek Electron probuyla yeniden üretildi. İlk ölçüm CSS'de `overflow-y: scroll` görünmesine rağmen `scrollMax=0` verdi: aktif besteci kabı kısıtlı yükseklik taşımadığı için konuşma listesi modalın altında büyüyordu. Kapsayıcı iki satırlı grid (`minmax(0,1fr) + besteci`) yapıldı; yeni/yeniden açılan mesaj sona giderken sıradan render mevcut konumu koruyor, besteci üzerindeki tekerlek de metin alanının kendi kaydırması yoksa konuşma listesine aktarılıyor. Nihai gerçek renderer ölçümü `12` takip, `scrollTop=2206`, `scrollMax=2367`, iki yönde tekerlek başarısı ve `0` UI problemi verdi. Sol ray artık oturumun açık `participantActorIds` listesinden çoklu profil üretir; doğrulanmış kişiler ayrı kart, bilinmeyen kimlik ise ülke/rol/ilişki uydurmadan gösterilir. Bu UI hazırlığıdır; gerçek çok taraflı konuşma karar motoru henüz kurulmuş sayılmaz. |
| 11.08.2026 | Faz 38.5 devlet makamlı protesto yürütücüsü tamamlandı. `ISSUE_DIPLOMATIC_PROTEST` Faz 29 kurum şemasında yürütme makamına ait ayrı bir ülke eylemidir. BROKEN sınır-aşan sözün yaralı özel aktörü inceleme isteyebilir fakat protesto uygulayamaz; yürütücü yalnız aynı yaralı devlete ait `EXECUTED` kurum fişini kabul eder ve fişi tek kullanımlık tüketir. Yabancı devlet fişi `INJURED_STATE_AUTHORITY_REQUIRED`, henüz yürütülmemiş fiş `STATE_PROTEST_AUTHORITY_NOT_EXECUTED` ile durdu. Geçerli icra devlet ilişkisini kaynaklı/idempotent `-6` değiştirdi; barış antlaşması ve savaş durumu aynen kaldı. Aynı fişin ikinci çağrısı etki üretmedi. Hedefli sohbet probu `1/1` yaklaşık `6,2 sn`, bağımsız kurum probu `1/1` yaklaşık `4,3 sn` ve çıkış `0`; doğrulanmış zarar defteri, anayasal savaş/barış ve 50 turluk insan tekrar kapısı açık sıradır. |
| 11.08.2026 | Diplomatik incelemeye `damageAssessment` eklendi. Kanonik BROKEN teslimatlarda sözleşme değeri zarar sayılmıyor: başarıyla iade edilmiş escrow anaparası `refundedPrincipal`, satıcının ödediği sözleşme cezası alıcının `penaltyCompensation`ı, yalnız ayrıca kaynaklanmış kayıp `verifiedDirectLoss` ve kalan tutar `uncompensatedDamage`dır. Fırsat maliyeti ile üretim kaybı ayrı `UNVERIFIED / includedInDamage:false` iddialarıdır; LLM, karakter sözü veya ilişki düşüşü bunlara sayı veremez. Mevcut vaka teslimat makbuzu taşımadığı için bütün doğrulanmış toplamlar sıfır ve savaş eşiği kapalı kaldı. Eski diplomatik incelemeler kayıt açılışında aynı güvenli şemaya backfill edilir. Güncel sohbet hedefli regresyonu `1/1`, yaklaşık `6,1 sn`, çıkış `0`; sırada anayasal savaş/barış adayları ve 50 turluk insan tekrar kapısı vardır. |
| 11.08.2026 | Faz 38.5 anayasal savaş/barış yürütücüsü tamamlandı. Savaş adayı incelemedeki sayıya kör güvenmiyor; icra anında tazmin edilmemiş zarar `≥250`, ilişki `≤-60`, yasal rota, doğru yaralı devlet ve rejimin tüm `DECLARE_WAR` imzaları yeniden doğrulanıyor. Barış, savaş sonrası açılan iki taraflı adaydır; tek ülkenin `SIGN_TREATY` fişi reddedildi, iki savaşan devletin ayrı ve eksiksiz anayasal fişleri savaşı bir kez barışa çevirdi. Mutlu yol `TEST_FIXTURE`dır ve koşudan sonra müzakere/kurum/diplomasi durumu geri yüklendi; gerçek ticari dosya zarar `0` iken savaşsız kaldı. Hedefli prob `1/1`, yaklaşık `6,2 sn`, çıkış `0`. |
| 12.08.2026 | Faz 38.9 ilk rol adaptörü dilimi kuruldu. Ölçülen 176 karakter içinde 48 şirket yöneticisi gerçek şirket defterine, 16 hükümet/askerî kişi kanonik makam sahipliğine bağlandı; 96 unvanlı fakat makamsız aktör yetkisiz bırakıldı. Makam yetki rotaları yalnız gerçek `authorityGrants` kayıtlarından geldi. Aktörün ROLE/PERSONAL hedefleri ayrıldı; kurum ve organizasyon hedef defteri bulunmadığı için kişinin hedefi kuruma kopyalanmadı. 16 ajan yalnız kimlik servis referansı taşıdığı için `CONTRACT_ONLY`; istihbarat yürütücüsü ile medya karakter/kurum defteri mevcut değil ve katalog bunları `UNAVAILABLE` gösteriyor. Genel müzakere kişilerarası kalıyor; hiçbir rol adı şirket/devlet dünya işlemi üretmiyor. On bir zorunlu kapılı hedefli probe `1/1`, yaklaşık `0,7 sn` geçti; karakter eylemi, kurum, şirket ve ilişki yorumu komşu regresyonları da temizdir. Faz; gerçek kurum teklif→itiraz→onay→uygulama zinciri ve domain alt rolleri gelene kadar `partial`dır. Test işçisi yükleme hatasının erken-sonlandırma yerine hazır sinyali bekleyebilmesi ayrı tezgâh borcu olarak not edildi. |
| 12.08.2026 | Faz 38.9 ikinci dilim, adaptörü mevcut Faz 29 kurum yaşam döngüsüne bağladı. Yürütme makamının `MOBILIZE_FORCE` teklifi, silahlı kuvvetler makamının ayrı onayı ve yürütmenin icrası tek kanonik istekte `PENDING_APPROVAL → AUTHORIZED → EXECUTED` ilerledi; makamsız unvan sahibi teklif kapısında reddedildi. Fiziksel etki hâlâ `RECORD_ONLY`dır. İlk `ENACT_LAW` rotası yasama kurumunun isimli Faz 35 makam sahibi bulunmadığını gösterdi; vekil uydurulmadı ve yasama kadrosu borç yazıldı. Hedefli probe yaklaşık `0,7 sn`de temizdir. Sıradaki Faz 38.9 borcu kurum itiraz/ret iradesi ve şirket yönetim onayıdır. |
| 12.08.2026 | Faz 38.9 üçüncü dilim kurumsal itiraz/ret iradesini ekledi. Aynı `MOBILIZE_FORCE` isteği gerçek komutanların şahinlik+kurumsal duruşundan deterministik `APPROVE / OBJECT / REJECT` ayrışması verdi. İtiraz onay imzası eklemedi ve isteği `PENDING_APPROVAL` bıraktı; yalnız zorunlu makamın reddi kapalı gerekçe, gerçek aktör/kurum ve fiziksel-etkisizlik makbuzuyla `DENIED` yaptı. LLM/rastgelelik/ham dünya okuması yok; defter doğrulaması ve save-load birebir geçti. Hedefli probe `1/1` yaklaşık `1,5 sn`, Faz 29 kurum regresyonu `15,1 sn`, karakter eylem regresyonu düşük RAM altında `104,5 sn` ile temizdir. İtirazın kalıcı yeniden görüşme kaydı ve şirket yönetim onayı açık sıradır. |
| 12.08.2026 | Faz 38.9 dördüncü dilim şirket karar kuyruğunu kurdu. Faz 21 şirket defteri şema-2'ye göçtü. Gerçek `COMPANY_EXECUTIVE` yalnız kendi şirketi için kredi veya yatırım teklifi kaydedebilir; başka şirket reddedilir. 48 şirkette CFO/CTO/kurul karakteri bulunmadığından teklif `BOARD_APPROVAL_MISSING` kalır ve nakit, borç, proje veya kapasite değiştirmez. Şema-1 göçü ekonomik veriyi aynen koruyup boş karar kuyruğu ekledi. Rol probe'u `1/1` yaklaşık `1,0 sn`, kapsamlı şirket probe'u `1/1` yaklaşık `12,3 sn` temizdir. Sırada şirket sahipliğiyle kanıtlanan gerçek yönetim kadrosu vardır. |
| 12.08.2026 | Faz 38.9 beşinci dilim türetilmiş şirket makam görünümünü ekledi. Mevcut genel müdür kanonik CEO'dur; CFO, CTO ve kurul başkanı uygun gerçek karakter bulunmadığı için `VACANT`tır. Toplulaştırılmış hane/devlet hissedarından isimli insan uydurulmadı. Kredi teklifi `CFO + BOARD_CHAIR`, yatırım `CFO + CTO + BOARD_CHAIR` eksiklerini açık taşır. Hedefli probe `1/1`, yaklaşık `1,0 sn` geçti. Gerçek makam kadrosu Faz 38.10 kariyer ve 38.11 kohort-yükselme bağımlılığına taşındı; Faz 38.9'un yakın sırası kalıcı itiraz/yeniden görüşme ve bilgi-filtreli UI'dır. |
| 12.08.2026 | Faz 38.9 altıncı dilim itirazı kanonik kurum isteğinde kalıcılaştırdı. Gerçek makam, kapalı gerekçe, zaman ve fiziksel-etkisizlik kaydı taşır; tekrar idempotenttir. Sonraki onay itirazı silmeden `SUPERSEDED_BY_APPROVAL` yapar. Eski kurum kayıtları doğrulamadan önce boş `reviewRecords` alanıyla göçer; erken-reconcile yüzünden defter sıfırlanmaz. Rol probe'u `0,9 sn`, kurum `3,3 sn`, şirket `12,4 sn` temizdir. Faz 38.9'un bağımsız kurum zinciri kapandı; şirket icrası gerçek CFO/CTO/kurul karakterlerine bağımlıdır. |
| 11.08.2026 | 50 turluk sosyal konuşma kalite kapısı üç oturumun açılışları dahil gerçek kronolojik sırayla kuruldu. İlk ölçüm açılış cevaplarını dışarıda bıraktığı için bir tohumda sahte `2` tekrar ve `4` hitap serisi raporladı; metrik düzeltildi, oyun kodu bu sahte alarma göre gevşetilmedi. `424242 / 1337 / 9001` tohumlarında 50/50 tur kabul ve niyet doğruluğu, 49/49/50 benzersiz cümle, son-12 ve yan yana tam tekrar `0`, azami aynı hitap `2`, yasak “Seni dinliyorum” `0`, en yüksek sözcüksel/anlamsal benzerlik `%22,73/%36,36` çıktı. Otomatik çeşitlilik geçti; oyuncunun eğlence ve doğallık kabulü açık kaldı. |
| 11.08.2026 | Faz 38.5 güncel kapsamı için altı işçili tam `npm test -- --workers=6` başlatıldı. Koşu `1204,1 sn` dış sınırında hiçbir görev sonucu bildirmeden exit `124` ile zaman aşımına uğradı; `65/65` veya kabul başarısı yazılmadı. Yalnız komut satırı `story-test-parallel.js --workers=6` olan parent ve ona bağlı altı `story-test-worker` doğrulanıp kapatıldı; kullanıcının savaş AI süreçlerine dokunulmadı. Hedefli sohbet `1/1`, kurum `1/1`, üç karşı-tohumlu 50 tur ve sözdizimi/diff kontrolleri temizdir. Güncel tam paket borcu açık, Faz 38.5 `partial`dır. |
| 12.08.2026 | Faz 38.7 kapandı. En çok iki kanonik bias, aynı eksenin seçicide ikinci kez puanlanmasını `AXIS_ALREADY_COUNTED` ile engeller; bias+stres toplamı mutlak `4` puandır. Yalnız aktörün tuttuğu ActorBelief'e bağlı stres karar nedenine girebilir; aynı `8000 bp` kriz iki karakterde farklı tepki verdi, `60 sn`de `4000`e düştü ve yenilenmeyince kapandı. Katkılar Faz 38.6 izinde kaynaklıdır. Kamu ve özel ifade planları ayrıldı fakat mekanik karar/gerçek değişmez. Yeni konuşma şema-2 kanal taşır; eski şema-1 sözler sahte bağlam uydurulmadan doğrulanır. Davranış `0,6 sn`, konuşma `0,8 sn`, eylem seçici `14,2 sn`, karar izi `0,7 sn` hedefli probları temizdir; dünya/refah nötr ve save-load birebirdir. Faz 38.5'in bayat birleşik konuşma probu nedeniyle tam paket başarı iddiası yapılmadı. Aktif sıra Faz 38.8 ilişki yorumu ve bağlamsal hafıza geri çağrımıdır. |
| 12.08.2026 | Faz 38.8 ilk dikeyi yeni ilişki/hafıza motoru kurmadan `RelationshipInterpretationV1` salt-okunur görünümünü ekledi. Aktörün tuttuğu söz, kaynak olaylı CONFLICT ve kaynak makbuzlu DECISION kayıtları; tutulmuş söz, bozulmuş söz, aleni aşağılama ve ortak kriz başarısı olarak ayrılır. Karaktere göre `8000–12000 bp` yorum şiddeti yalnız mevcut beş Faz 35 ekseninde delta ve eylem ipucu önerir; hiçbirini uygulamaz. Başka aktörün özel hafızası, ilgisiz hedef ve kaynaksız sahte olay etiketi reddedildi. Hedefli prob `0,5 sn`, hafıza `1,4 sn`, teslimat/müzakere `2,0 sn`, davranış `0,7 sn`; 69 görevlik manifest eşitliği temizdir. Gerçek aleni aşağılama/ortak kriz üreticileri ve aday bağlantısı açık borçtur. |
| 12.08.2026 | Faz 38.8 ikinci dikeyi ilişki yorumunu gerçek karakter eylem sıralamasına bağladı. Yalnız en önemli iki sahipli yorum kullanılır ve toplam etki mutlak `3` puandır; ilişki eksenine yeniden yazılmaz. Tutulmuş söz ALLY bağlamını yükseltirken bozulan söz ve aleni aşağılama düşürür, ortak kriz başarısı yeniden destekler. Katkılar kaynak hafıza kimliği ve türüyle Faz 38.6 karar izine girer; karar sahibi olmayan oyuncuya özel neden sızmaz. Yorum `0,6 sn`, yoğun CPU altında eylem `60,7 sn`, karar izi `0,7 sn`; tümü çıkış `0`. Faz gerçek olay üreticileri ve uzun-vade yoğunlaştırma nedeniyle `partial`dır. |
| 12.08.2026 | Faz 38.8 üçüncü dikeyi RECENT `24` tavanındaki yoğunlaştırmayı ilişki bağlamına uygun hâle getirdi. SUMMARY artık hedef aktör dağılımı, kaynaklı olay etiketleri, kaynak kimlikleri ve küme karmasını taşır; düşük ağırlıklı seçici katkısı verebilir fakat MILESTONE silmez. Save-load birebirdir. Ayrıntılı çalışma gerçek olmayan `loyalty/cooperation` eksenlerinin `NaN→JSON null` ürettiğini ve `--task` modunun assertion çalıştırmadığı için false sonucu yeşil gösterebildiğini buldu. Kanonik dört eksen+nötr fallback düzeltildi; manifest `requiredTrue` kapısı false zorunlu sonucu worker'da kırmızı yapıyor. Kapı önce `consolidatedSelectorContribution=false` hatasını doğru yakaladı; ayrı hedef fikstürü sonrası prob `0,8 sn`, hafıza `1,5 sn`, göç `2,0 sn`, karar izi `0,7 sn` temiz geçti. |
| 12.08.2026 | Faz 38.8 dördüncü dikeyi gerçek ortak kriz başarısı üreticisini Faz 33'e bağladı. Yalnız `COUP_DEFEATED`, en az iki gerçek sadık katılımcı ve gerçek `CRISIS_RESOLVED` olay kimliği varsa kaynaklı DECISION/`SHARED_CRISIS_SUCCESS` hafızası oluşur. Darbecilerin `GOVERNMENT_SEIZED` zaferi karşı-testte ortak başarı üretmedi; mevcut BETRAYAL kaydı değişmedi. Kaynaklı hafıza Faz 38.8 yorumuna girdi. Siyasi kriz `5,8 sn`, ilişki `0,8 sn`, hafıza `1,5 sn` temizdir. PUBLIC_ACCOUNT fail–hedef aleni aşağılama makbuzu değildir; eksik olay uydurulmadı ve Faz 38.8 bu nedenle `partial` kaldı. |

### Faz 28 sonrası mimari dersler

- Ağırlıklı toplumsal destek, kayıtlı üyelik değildir. Kohorttan türeyen kişi sayısı `supportPeople` olarak adlandırılmalı; sendika üyesi, parti üyesi veya güvenlik personeli diye sunulmamalıdır.
- Kurumsal kapasite, yerleşmiş davranış eşiğinin doğrudan yerine konamaz. Aynı nominal sayı farklı ölçek/semantik taşıyabilir; nötr referans, ölü bölge ve sınırlı sapma ağırlığı olmadan küçük fark kaotik ekonomiyi yeniden yönlendirir.
- Bir sistemin çıktısını aynı tik zincirinde kendi kapasite girdisine bağlamak entegrasyon değil pozitif geri beslemedir. Kolektif mobilizasyon radikal ağ örgütlenmesini, o örgütlenme de aynı kolektif mobilizasyonu doğrudan büyütemez.
- Güç merkezinin var olması eylem yetkisine sahip olduğu anlamına gelmez. Faz 29 öncesinde ilan edilmiş eylemler görünür fakat icra listesi boş ve tavan sıfır kalmalıdır.
- `LEGAL_ACTOR`, `CHARACTER`, `OFFICE` ve geçici `OFFICEHOLDER_PROXY` aynı şey değildir. Gerçek karakter fazı gelmeden ofis vekilini insanmış gibi kalıcı hafıza veya diyalog sahibi yapmak sahte bütünlük üretir.
- Medya ve güvenlik ağı adı, gerçek medya/istihbarat kapasitesinin kurulduğu anlamına gelmez. Vekil model adı ve gelecekteki sahip fazı kayıt/UI/teşhiste açık kalmalıdır.
- Türetilmiş ülke/bölge özeti kanonik gerçek değildir. Toprak devrinden sonra kayıt öncesi sahiplikten yeniden kurulmalı; bayat aggregate yüzünden bütün kayıt reddedilmemeli ve uzlaştırma davranış puanlarını ilerletmemelidir.
- Eski fazın “fiziksel eşitlik” A/B filtresi, sonradan eklenen açıklayıcı downstream ledger'ları açıkça kapsam dışına almalıdır. Aksi halde fiziksel dünya birebir aynıyken yalnız yeni gözlem durumu yanlış regresyon alarmı üretir.
- Özellik kapalı yokluk sözleşmesi `undefined` değil açık `null` olmalıdır. JSON'da alanın kaybolması, kapalı sistem ile eksik entegrasyonu ayırt etmeyi zorlaştırır.
- Uzun QA koşusu başka 12-worker benchmark ile aynı anda çalıştırıldığında 30 dakikalık zaman aşımı üretti; tek başına aynı kapsam `1.645 sn`de geçti. Faz kabul ölçümü için makine yükü kaydedilmeli, fakat kullanıcı süreçleri izinsiz durdurulmamalıdır.
