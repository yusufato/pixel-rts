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

## Birleşik açık kayıtlar

| Kimlik | Konu | Öncelik | Durum | En erken ilgili faz |
|---|---|---|---|---|
| EXT-ACT-001 | Gıda/enerji üretim–talep çöküşü ve üst-akış yatırım zinciri | Kritik | `resolved-phase22.1e` | Fiziksel stabilizasyon kapısı 60/300/900 sn ve kuyruk ortalamasıyla geçti; performans borcu ayrı izlenir |
| EXT-ACT-002 | Ekonomik AI için çok adımlı bağımlılık planlaması | Yüksek | `completed-phase22.1e-scope` | Reçete grafı + ülke portföyü + girdi emaneti + Pareto hacim + hane dağıtımı; daha geniş ulusal gündem sonraki fazlardadır |
| EXT-ACT-003 | Savaş manifestosunda kalıcı birlik kimliği | Kritik | `open` | Faz 47 |
| EXT-ACT-004 | `military_supplies` ve yakıtın taktik tüketim mutabakatı | Yüksek | `open` | Faz 47–50 |
| EXT-ACT-005 | Serbest metinde kapalı niyet + gramer kısıtlı deney | Kritik | `candidate` | Faz 38 öncesi |
| EXT-ACT-006 | Deterministik varlık çözümleyici ve teyit döngüsü | Kritik | `candidate` | Faz 38.1–38.2 |
| EXT-ACT-007 | LLM kalite merdiveni ve mekanik eşitlik | Yüksek | `candidate` | Faz 38.3–38.5 |
| EXT-ACT-008 | Sohbet sonrası model boşaltma/RAM ölçümü | Orta | `candidate` | Faz 38 öncesi altyapı probu |
| EXT-ACT-009 | Faz 64–66 için küçük erken prob, tam nihai kabul | Orta | `candidate` | Faz 64–66 |
| EXT-ACT-010 | Tek ekonomi üzerinde altı rol yetki/bilgi projeksiyonu | Yüksek | `accepted-design` | Faz 22.1 sonrası şirket merceği; tam birleşim Faz 59–60.3 |
| EXT-ACT-011 | Role uyarlanır bedelli 12 karar ve nedensel geçmiş tohumu | Yüksek | `accepted-design` | Faz 34; ActorBelief bağı Faz 38.1 |
| EXT-ACT-012 | Kanonik `ProjectV1 → WorldAssetV1 → bakım` yaşam döngüsü ve mevcut tesis göçü | Yüksek | `accepted-design` | Faz 22.1E + şirket merceği sonrasında; toplumsal/kamu bağları Faz 23–33.1 |
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
