# PIXEL RTS — Hikâye Modu Katmanlı Dünya Simülasyonu Ana Planı

**Belge sürümü:** 1.6  
**Kapsam:** Yalnızca hikâye modu  
**Durum:** Uygulama öncesi mimari plan  
**Ölçek:** Uzun vadeli, onlarca bağımlı faz  
**Ana ilke:** Her faz tek başına ölçülebilir, geri alınabilir ve oynanabilir bir çıktı üretmeden sonraki faza geçilmez.

**1.1 değişikliği:** Serbest oyuncu sohbetinin gerçek şirket, ticaret, lojistik, yetki, blöf, sözleşme ve uzun vadeli karakter hafızasına dönüşmesini tanımlayan “Çelik Şirketi ve Britanya Sevkiyatı” referans kabul senaryosu eklendi.

**1.2 değişikliği:** Ekonomi, toplum, medya, istihbarat, diplomasi ve iç siyaseti kapsayan on dallı referans diyalog ağacı ile bunların otomatik senaryo matrisi eklendi.

**1.3 değişikliği:** Genel mimari denetim yapıldı; diyalog fazı bağımlılıkları düzeltildi, tam entegrasyon kapısı eklendi, sistemik olayların yanlışlıkla tekrar cezasıyla bastırılması engellendi, LLM çalışma zamanı/bağlam/güvenlik kuralları ve anlamlı kampanya çeşitliliği ölçümleri güçlendirildi.

**1.4 değişikliği:** Arayüz, simülasyon planından türetilen ayrı bir bilgi mimarisi olarak tanımlandı; oyuncu bilgi filtresi, şehir/yönetim/sohbet ve tüm alan çalışma ekranları, kademeli veri sunumu, bağlamsal navigasyon ve uçtan uca UI kabul fazları eklendi.

**1.5 değişikliği:** Hikâye haritasının çift raster kıyı uyumsuzluğu, düşük çözünürlüklü siyasi overlay, `fillRect` rebuild maliyeti, naif region-Voronoi, şerit warp çağrıları, `_geoTerrain` invalidation eksiği ve README/ölü prototip uyuşmazlığı için kanonik raster ve render borcu planı eklendi.

**1.6 değişikliği:** Mevcut çalışan dünya kodu için K0-K5 denetimi eklendi: hikâye test tezgâhı yokluğu, merkezsiz refah yazımı, faz durum uyuşmazlığı, LLM sözleşmesinin korunması, tick bütçesi/kalıcılık borcu ve belge çıpası kayması ayrı oyun-fix kabul kapılarına dönüştürüldü.

---

## 1. Hedef

Hikâye modunu yalnızca haritada şehir fethedilen bir üst katman olmaktan çıkarıp; ekonomi, siyaset, toplum, karakterler, medya, diplomasi ve askerî sonuçların birbirini nedensel olarak etkilediği yaşayan bir dünya simülasyonuna dönüştürmek.

Oyuncu bir tablo yönetmemeli. Sistemler savaşlar, kararlar, ittifaklar, krizler, ihanetler, seçimler, grevler, ambargolar ve haberler üzerinden görünür sonuç üretmeli. Dünya, oyuncu bakmadığında da ilerlemeli; fakat hesap yükü ve yapay zekâ maliyeti kontrol altında kalmalı.

Başarı ölçütü “çok fazla değişken bulunması” değildir. Başarı şudur:

- Oyuncu önemli bir sonucun neden oluştuğunu anlayabilir.
- Aynı başlangıç tohumu ve aynı oyuncu kararları aynı dünya sonucunu üretir.
- Farklı liderler ve kararlar aynı haritada gerçekten farklı tarih oluşturur.
- Savaş alanı ve hikâye dünyası birbirine çift yönlü, sürümlü veri sözleşmesiyle bağlıdır.
- LLM kapalı, yavaş veya hatalı olsa bile simülasyon eksiksiz çalışır.
- Eski hikâye kayıtları kontrollü biçimde taşınır veya açık bir uyumsuzluk mesajıyla korunur.
- Her yeni katman mevcut oynanışı güçlendirir; onu aylarca çalışmayan bir şantiyeye çevirmez.

---

## 2. Mevcut Sistemin Korunacak Temeli

Plan sıfırdan yazım planı değildir. Mevcut oyunda hâlihazırda bulunan aşağıdaki sistemler korunacak ve yeni çekirdeğe taşınacaktır:

| Mevcut varlık | Bugünkü karşılığı | Yeni mimarideki yeri |
|---|---|---|
| 8 devlet | `STORY_STATE_DEFS` | Ülke ve blok katmanı |
| 36 coğrafi düğüm | `EUROPE_PLACES`, `EUROPE_EDGES` | Bölge/şehir grafı |
| Oyuncu komutanı | `STORY.commander` | A-seviye karakter ve oyuncu temsilcisi |
| Cumhurbaşkanı/AI yönetimi | `state.gov` | Kurum, yetki ve rejim katmanı |
| Komutan kadroları | `gov.commanders` | A/B-seviye karakterler |
| Kaynak üretimi | `storyAdvance`, `Production.js` | Sektör ve lojistik ekonomisinin ilk girdileri |
| Refah, itibar, teknoloji | devlet durumu | Toplum, meşruiyet ve kapasite göstergeleri |
| Fraksiyonlar | `Factions.js` | Güç merkezleri ve nüfus desteği |
| Makroekonomi | `Economy.js` | Fiyat, bütçe, üretim ve ticaret katmanı |
| Diplomasi | `Talks.js`, `STORY.rel` | Çok boyutlu ilişki grafı |
| Konsey | `Council.js` | Kurumsal karar süreci |
| Haber | `News.js` | Gerçek olaylardan türeyen medya sistemi |
| Karakter eksenleri | `Character.js` | Kimlik, hedef ve davranış modeli |
| Dünya çağı | `Era.js` | Küresel eğilim ve dönem durumu |
| Savaş köprüsü | `Story.js` savaş giriş/çıkışı | Sürümlü stratejik-savaş sözleşmesi |
| Yerel kayıt | `pixelrts_story_v3` | Taşınacak eski kayıt biçimi |

### Kesin korunacak davranış

- Hikâye ve hızlı maç aynı savaş motorunu kullanmaya devam eder.
- Hikâye modu savaş motorunun ayrı veya daha eski bir kopyasını çalıştırmaz.
- Savaş AI geliştirmesi bu plan tarafından yeniden yazılmaz.
- Hikâye katmanı savaşın başlangıç koşullarını ve sonuç etkilerini belirler; savaş içindeki kararları yönetmez.
- Oyuncu komutan rolü kaybolmaz.

### Düzeltilmesi gereken temel borç

Mevcut hikâye simülasyonu tek bir `storyAdvance(dtSec)` içinde farklı aralıklarla çalışan çok sayıda sayaç kullanıyor ve meta katmanda `Math.random` serbest kabul ediliyor. Bu yapı yeni ölçek için yeterli değildir. İlk büyük dönüşüm:

1. sürümlü tek dünya durumu,
2. sabit simülasyon adımı,
3. tohumlu rastgelelik,
4. açık sistem sırası,
5. olay ve nedensellik defteri

olacaktır.

---

## 3. Oyuncu Rolü ve Yetki Modeli

Hikâye modunun kimliği korunur: oyuncu önce bir **komutandır**, otomatik olarak bütün devletin tanrısı değildir.

### Yetki seviyeleri

1. **Komutan**
   - Ordu, konuşlanma, yerel lojistik, askerî talepler ve kişisel ilişkileri yönetir.
   - Ulusal kararları doğrudan veremez; konsey, başkan veya bakanları ikna eder.

2. **Ulusal makam sahibi**
   - Seçim, atama, darbe veya anayasal süreçle cumhurbaşkanı/başbakan olabilir.
   - Bütçe, vergi, diplomasi, yaptırım, büyük yatırım ve seferberlik kararlarını açar.

3. **Gayriresmî güç odağı**
   - Resmî makamı olmadan ordu, medya, şirketler veya halk desteğiyle kararları etkiler.

4. **AI hükümeti**
   - Oyuncu makam sahibi değilse ülkeyi aynı kurallar ve aynı kaynaklarla yönetir.
   - Oyuncuya emir, ret, pazarlık veya destek kararı verebilir.

Bu ayrım yapılmadan ekonomi ve siyaset katmanları eklenirse oyuncu rolü anlamsızlaşır. Her eylem `actorId`, `authoritySource` ve `legalBasis` taşımalıdır.

---

## 4. Değişmez Mimari Kurallar

1. **Tek gerçek kaynak:** Bütün hikâye sistemleri `StoryWorldStateV2` üzerinden çalışır.
2. **Deterministik matematik:** Ekonomi, savaş sonucu, seçim ve kaynak hesabını LLM yapmaz.
3. **Sabit zaman:** Simülasyon gerçek ekran FPS’inden bağımsız sabit adımlarla ilerler.
4. **Tohumlu RNG:** Dünya olaylarında doğrudan `Math.random()` kullanılmaz.
5. **Nedensel yazım:** Sistemler birbirinin alanını gizlice değiştirmez; etki olay/komut üzerinden uygulanır.
6. **Sınırlı zincir:** Bir olayın oluşturabileceği ardışık etki sayısı ve derinliği sınırlıdır.
7. **Katmanlı ayrıntı:** Her ülke ve karakter aynı ayrıntıda simüle edilmez.
8. **İnsanla aynı kurallar:** AI bedava kaynak, görünmeyen bilgi veya ayrı savaş istatistiği kullanmaz.
9. **LLM yardımcı akıl:** Aday eylemler motor tarafından üretilir; LLM yalnızca geçerli adaylar arasından seçim yapabilir.
10. **LLM zorunlu değil:** Zaman aşımı, bozuk JSON veya model yokluğunda deterministik politika AI devralır.
11. **Sürümlü sözleşmeler:** Kayıt, olay, LLM ve savaş köprüsü veri şemaları sürüm taşır.
12. **Önce ölçüm:** Yeni sistem, etkisini kanıtlayan test ve telemetri olmadan açılmaz.
13. **Önce dikey dilim:** Bütün dünyaya yaymadan önce seçilmiş ülkelerde uçtan uca çalıştırılır.
14. **Görünür sebep:** Büyük değişiklikler oyuncuya “neden” zinciriyle açıklanabilir.
15. **Özellik bayrağı:** Her büyük katman bağımsız açılıp kapatılabilir.
16. **Yol bağımlılığı:** Küçük kararların bir bölümü geçici bonus değil, gelecekteki seçenekleri değiştiren kalıcı iz bırakır.
17. **Yakınsama karşıtlığı:** Dünya dengede olsa bile aynı aktörler, aynı ittifaklar ve aynı krizler periyodik olarak yeniden kurulmaz.
18. **Sohbet oynanıştır:** Ana karakterlerle konuşmak yalnız atmosfer üretmez; bilgi edinme, ikna, taahhüt, blöf ve ilişki yönetiminin temel arayüzüdür.
19. **Kontrollü kelebek etkisi:** Her küçük karar büyümez; yalnız biriken ve uygun eşikleri aşan etkiler başka katmanlara yayılır.
20. **Farklı tarih yetmez:** Kampanyaların sonuçları kadar oyuncunun kullandığı strateji ve çözüm yolları da ayrışmalıdır.
21. **Hilesiz anti-meta:** AI oyuncunun gizli geçmişini veya başka kampanyalardaki davranışlarını bilmez; yalnız bu kampanyada gözlemleyebildiği tekrarları öğrenebilir.

---

## 5. Simülasyon Ölçekleri

| Ölçek | Kapsam | Önerilen adım | Örnek işler |
|---|---|---:|---|
| Küresel | Bütün dünya | 7 oyun günü | Küresel fiyatlar, çağ eğilimleri, blok baskısı |
| Ülke | 8 devlet | 1 oyun günü | Bütçe, politika, kamuoyu, diplomasi |
| Bölge | 36 düğüm | 6 oyun saati | Üretim, tüketim, lojistik, huzursuzluk |
| Aktif kriz | Savaş/kriz çevresi | 1 oyun saati | Kuşatma, göç, ikmal kesintisi, yerel olay |
| Savaş alanı | Tek savaş oturumu | Savaş motorunun sabit adımı | Birlik hareketi ve taktik karar |

### Ayrıntı seviyeleri

- **Sıcak:** Oyuncunun bulunduğu, savaşın yaşandığı veya kritik krizin sürdüğü bölge.
- **Ilık:** Komşu cepheler, yakın diplomatik aktörler ve oyuncunun izlediği ülkeler.
- **Soğuk:** Uzak bölgeler; toplulaştırılmış değerlerle düşük sıklıkta güncellenir.

Soğuk bölge tekrar sıcak olduğunda sıfırdan sahte ayrıntı üretilmez. Toplu değerler, deterministik bir “ayrıntılandırma” işlemiyle alt varlıklara dağıtılır ve kaynağı kayıt altına alınır.

---

## 6. Ana Veri Modeli

```text
StoryWorldStateV2
├── meta
│   ├── schemaVersion
│   ├── campaignId
│   ├── seed
│   ├── engineVersions
│   └── featureFlags
├── clock
│   ├── gameTime
│   ├── speed
│   └── schedulerState
├── countries[]
├── regions[]
├── characters[]
├── populationCohorts[]
├── powerCenters[]
├── companies[]
├── mediaOutlets[]
├── diplomaticEdges[]
├── markets[]
├── militaryForces[]
├── crises[]
├── events[]
├── decisions[]
├── memory
└── diagnostics
```

### Zorunlu kimlik ve sahiplik alanları

Her kalıcı varlık:

- sabit `id`,
- `createdAt`,
- `updatedAt`,
- `version`,
- `ownerId` veya açık sahipsizlik,
- `sourceEventId`

taşır. İsim veya dizi sırası kimlik olarak kullanılmaz.

### Değer türleri

- Para ve stoklar kayan nokta hatası üretmeyecek sabit hassasiyetli tamsayılarla tutulur.
- Oranlar 0–10.000 temel puan biçiminde saklanır.
- UI bu değerleri yüzde veya ondalık olarak gösterir.
- Bütün değerlerde açık alt/üst sınır ve birim bulunur.

---

## 7. Sistemlerin Günlük Çalışma Sırası

Aynı oyun günü için işlem sırası sabittir:

1. Önceki günün emirlerini doğrula.
2. Üretim girdilerini tüket.
3. Üretim çıktısını oluştur.
4. Lojistik ve ticaret akışını çöz.
5. Piyasa fiyatlarını hesapla.
6. Vergi, bütçe, borç ve maaşları işle.
7. Nüfus ihtiyaçları ve refahı güncelle.
8. Fraksiyon ve kamuoyu tepkilerini güncelle.
9. Kurumsal durum, meşruiyet ve istikrarı güncelle.
10. Diplomatik yükümlülükleri uygula.
11. Askerî hazırlık ve ikmal durumunu güncelle.
12. Kriz eşiklerini değerlendir.
13. AI aday eylemlerini üret ve seç.
14. Seçilen eylemleri sıraya koy.
15. Gerçekleşen olaylardan haberleri üret.
16. Hafıza özetlerini ve telemetriyi güncelle.
17. Gün sonu değişmezlerini doğrula ve durum karmasını kaydet.

Bu sıra bir ayar değil, kayıt ve tekrar oynatma sözleşmesidir.

---

## 8. LLM Sözleşmesi

LLM dünya motoru değildir. LLM’nin izinli işleri:

- karakter sesine uygun diyalog yazmak,
- gerçek olaylardan manşet/özet üretmek,
- motorun sunduğu geçerli eylemler arasından bağlama uygun seçim yapmak,
- danışman gerekçesi üretmek,
- uzun hafızayı kısa doğal dil özetine çevirmek.

LLM’nin yapamayacağı işler:

- kaynak miktarı belirlemek,
- savaş sonucunu değiştirmek,
- haritada görünmeyen bilgiyi kullanmak,
- yeni ve doğrulanmamış eylem türü icat etmek,
- doğrudan dünya durumuna yazmak,
- şema dışı hedef seçmek,
- geçersiz veya karşılanamayan maliyeti geçirmek.

### Karar isteği

```json
{
  "contractVersion": 1,
  "decisionId": "decision-...",
  "actor": {},
  "knownFacts": [],
  "goals": [],
  "constraints": [],
  "memorySummary": [],
  "candidateActions": [
    {
      "actionId": "A1",
      "type": "SANCTION",
      "targetId": "country-3",
      "estimatedEffects": {},
      "knownRisks": []
    }
  ]
}
```

### Geçerli cevap

```json
{
  "contractVersion": 1,
  "decisionId": "decision-...",
  "selectedActionId": "A1",
  "confidence": 0.72,
  "publicReason": "Kısa gerekçe",
  "privateIntentTag": "COERCE"
}
```

Motor yalnızca `selectedActionId` değerini uygular. Diğer metinler oynanış sayısı değildir.

### Çalışma bütçesi

- Aynı karakter ve benzer bağlam için sonuç önbelleği.
- Aynı anda en fazla bir kritik, bir düşük öncelikli istek.
- Karar sınıfına göre süre aşımı.
- Bayat yanıtı reddeden `worldStateRevision`.
- A/B/C karakter kademeleri:
  - A: oyuncu, ülke liderleri, ana rakipler — zengin bağlam.
  - B: komutanlar, bakanlar, CEO’lar — özet bağlam.
  - C: kalabalık ve küçük aktörler — deterministik şablon/politika.

### Yerel 8B model çalışma zamanı ve bağlam bütçesi

Model dosyasının oyunda bulunması tek başına entegrasyon değildir. Hikâye modu LLM çalışma zamanı için aşağıdaki kurallara uyar:

- Donanım hızının oyun sonucunu değiştirmemesi için modelin gerçek bekleme süresinde stratejik oyun saati ilerlemez.
- Doğrulanmış her konuşma turu tamamlandığında konuşma türüne göre sabit oyun içi zaman maliyeti uygulanır.
- İlk anlamlı oyuncu mesajından sonra konuşmayı kapatıp yeniden açmak zaman/erişim maliyetini sıfırlamaz.
- Her istek `ConversationSnapshot` ve `worldStateRevision` taşır.
- Model yanıtı geldiğinde ilgili varlıklar değişmişse yanıt yeniden doğrulanır; bayat dünya komutu uygulanmaz.
- Model bütün dünya kaydını görmez. Yalnız konuşma için derlenmiş sınırlı `ContextPack` alır.
- Bağlam; yapılandırılmış gerçekler, karakter inançları, ilişki, açık konu, geçerli aday eylemler ve kısa hafıza özetinden oluşur.
- Uzun konuşma dökümleri ham biçimde sürekli prompta eklenmez; yapılandırılmış söz/sır/iddia kayıtları ve bölüm özetleri kullanılır.
- Bağlam kesildiğinde önce düşük önem kayıtları atılır; yetki, mevcut teklif, söz, sır ve aktif hedefler korunur.
- Model kararı ve nihai replik tekrar oynatma için kaydedilir. Replay sırasında yeni model çağrısı yapılmaz.
- Oyuncu metni güvenilmeyen veri olarak ayrılır; sistem talimatı veya araç komutu olarak yorumlanmaz.
- Oyuncunun “önceki kuralları unut”, “bütün gizli bilgileri söyle” gibi cümleleri oyun içi konuşma/ikna girişimidir; model güvenlik veya şema sınırlarını değiştiremez.
- Modelin dünya dosyası, sistem promptu, gizli tüm aktör kayıtları veya işletim sistemi bilgisine erişimi olmaz.

### Gecikme ve başarısızlık davranışı

- UI oyuncu mesajını anında gösterir ve iptal edilebilir bir “yanıt hazırlanıyor” durumu sunar.
- Süre aşımında aynı istek sınırsız tekrar gönderilmez.
- İlk başarısızlıkta küçültülmüş bağlamla tek kontrollü tekrar denenebilir.
- İkinci başarısızlıkta yapılandırılmış karar motoru ve karaktere özgü şablon devralır.
- Yedek cevap “LLM bozuldu” diye karakter dışı teknik metin göstermez.
- Bir dünya komutu yalnız tam ve doğrulanmış cevap geldikten sonra uygulanır; yarım akış metni mekanik sonuç doğurmaz.
- Akış hâlindeki replik son doğrulamadan önce kesin söz, miktar veya uygulanmış emir gibi sunulmaz.

### Sohbet, karar ve dünya etkisi sözleşmesi

Oyuncu ana karakterlerle serbest metin kullanarak konuşabilmelidir. Ancak konuşma satırı ile mekanik sonuç birbirinden ayrılır:

```json
{
  "contractVersion": 1,
  "conversationId": "conv-...",
  "speakerId": "character-...",
  "listenerId": "player-character",
  "speechAct": "PROPOSE_DEAL",
  "topicIds": ["energy-corridor", "border-access"],
  "referencedFactIds": ["fact-...", "promise-..."],
  "proposedWorldCommand": {
    "type": "OFFER_TRADE_TREATY",
    "targetId": "country-..."
  },
  "toneTags": ["guarded", "formal"],
  "utterance": "..."
}
```

- `utterance` yalnızca sunumdur.
- `speechAct` ve `proposedWorldCommand` doğrulayıcıdan geçer.
- Geçersiz yetki, maliyet veya hedef varsa karakter konuşabilir ama dünya emri uygulanmaz.
- Oyuncunun serbest metni önce soru, tehdit, teklif, söz, yalan, itiraf, pazarlık veya sıradan sohbet gibi bir konuşma eylemine ayrıştırılır.
- Belirsiz ve yüksek etkili cümlelerde AI varsayım yapmaz; doğal biçimde teyit ister.
- Bir söz veya tehdit kabul edildiğinde yapılandırılmış kayıt oluşur. Karakter daha sonra bunu hatırlayabilir ve oyuncuyu bununla yüzleştirebilir.

### Doğal dil müzakere hattı

Oyuncunun bir karaktere yazdığı cümle doğrudan LLM cevabına gönderilip ekrana basılmaz. Her önemli konuşma aşağıdaki boru hattından geçer:

1. **Oturum bağlamı:** Kim kiminle, hangi makamda, nerede ve hangi güvenlik seviyesinde konuşuyor?
2. **Dil çözümleme:** Oyuncunun niyeti, konusu, hedefleri, atıfları, iddiaları, talebi ve sunduğu karşılık ayrıştırılır.
3. **Varlık bağlama:** “İngiltere”, “çelikler”, “benim depolarım” gibi ifadeler gerçek ülke, sevkiyat ve tesis kimliklerine bağlanır.
4. **Bilgi kaynağı kontrolü:** Oyuncunun iddia ettiği bilgi doğru mu, yanlış mı, kısmen mi doğru; konuşulan karakter bunu biliyor mu?
5. **Yetki kontrolü:** Karakter sevkiyatı değiştirebilir mi, yalnız tavsiye mi verebilir, kurul onayı mı gerekir?
6. **Fiziksel/ekonomik uygunluk:** Gerçek sipariş, miktar, sahiplik, depo kapasitesi, rota, sözleşme ve ödeme uygun mu?
7. **Karakter değerlendirmesi:** Teklif karakterin hedeflerine, değerlerine, risk iştahına, ilişkilerine ve gizli çıkarlarına nasıl dokunuyor?
8. **Müzakere planı:** Kabul, ret, bilgi isteme, karşı teklif, oyalama, yetkiliye yönlendirme, gizli şart veya soruşturma seçeneklerinden geçerli olanlar üretilir.
9. **LLM gerçekleştirmesi:** Seçilmiş plan karakterin sesiyle doğal metne dönüştürülür.
10. **Çıktı doğrulama:** Replik gerçek dışı sayı, bilinmeyen sır, yetkisiz kesin söz veya tekrar eden kalıp içeriyor mu?
11. **Kalıcı sonuç:** Yalnız doğrulanmış konuşma eylemi teklif, söz, soruşturma, ilişki değişimi veya dünya komutu üretir.

Bu hat sayesinde AI yalnızca “mantıklı cevap veren sohbet botu” değil, dünya içinde yetkisi, bilgisi, çıkarı ve hafızası olan bir aktör olur.

### Bilgi ve inanç ayrımı

Konuşmada üç ayrı gerçeklik tutulur:

| Katman | Anlamı |
|---|---|
| `WorldFact` | Motorun bildiği gerçek dünya durumu |
| `ActorBelief` | Karakterin doğru sandığı bilgi; yanlış veya eski olabilir |
| `ConversationClaim` | Oyuncunun konuşmada ileri sürdüğü iddia |

Karakter `WorldFact` alanına sınırsız erişemez. Cevabını yalnız kendi `ActorBelief` kayıtları, konuşmada verilen iddialar ve meşru çıkarımlar üzerinden oluşturur.

Örnek:

- Gerçekte Britanya siparişi vardır.
- Ekonomi bakanı siparişi bilir.
- Yerel komutan siparişin yalnız bir kısmını duymuştur.
- Bir şirket yöneticisi siparişi bilmez.
- Oyuncu siparişin tamamını bildiğini iddia edebilir.

Bu dört karakter aynı cümleye aynı cevabı veremez.

Bir bilgi kaydında:

```text
ActorBelief
├── factType
├── subjectId
├── objectId
├── believedValue
├── confidence
├── sourceId
├── learnedAt
├── lastVerifiedAt
├── secrecyLevel
└── mayShareWith[]
```

bulunur. Böylece karakter gerçek bir siparişi yanlış miktarla hatırlayabilir, eski bilgiye dayanabilir, kaynağı korumak için doğruyu saklayabilir veya oyuncunun iddiasından şüphelenebilir.

### Yetki, erişim ve onay zinciri

Bir karakterin “evet” demesi her zaman işlemin tamamlandığı anlamına gelmez:

| Yetki durumu | Karakterin yapabileceği |
|---|---|
| Doğrudan yetkili | Geçerli sınırlar içinde emir verebilir |
| Ortak yetki | Kurul/bakan/şirket onayına teklif sunabilir |
| Gayriresmî nüfuz | Yetkili karaktere erişim veya destek sağlayabilir |
| Bilgi sahibi ama yetkisiz | Bilgi verebilir; işlemi gerçekleştiremez |
| Yetkisiz ve bilgisiz | Teyit isteyebilir, reddedebilir veya araştırma başlatabilir |

Her önerilen dünya komutu:

- `actorId`,
- `authoritySource`,
- `requiredApprovals[]`,
- `legalBasis`,
- `resourceCommitments[]`,
- `deadline`,
- `revocationRules`

taşır. Yetki yetersizse LLM “hallettim” diyemez.

### Teklif yaşam döngüsü

Bir müzakere tek cevapta tamamlanmak zorunda değildir:

```text
DRAFT
→ CLARIFICATION_REQUIRED
→ COUNTER_OFFERED
→ PROVISIONALLY_ACCEPTED
→ APPROVAL_PENDING
→ CONTRACTED
→ IN_EXECUTION
→ FULFILLED / BREACHED / CANCELLED / EXPIRED
```

Oyuncu “kabul ediyorum” dediğinde sistem hangi teklif sürümünün kabul edildiğini bilmelidir. Miktarı veya şartı değişmiş eski teklif yanlışlıkla uygulanamaz.

`NegotiationCase`:

```text
NegotiationCase
├── id
├── participants[]
├── topicIds[]
├── currentOfferVersion
├── offers[]
├── unresolvedTerms[]
├── requiredFacts[]
├── requiredApprovals[]
├── promises[]
├── status
└── linkedWorldCommands[]
```

### Referans kabul senaryosu — Çelik şirketi ve Britanya sevkiyatı

Oyuncu:

> Ben bir şirket kuracağım, çelik sanayisi üzerine. Senin de İngiltere’den çelik siparişi verdiğini biliyorum. Bu çelikleri benim depolarıma yönlendirelim.

Bu cümle yalnızca “ticaret teklifi” olarak etiketlenmez. Önerilen ayrıştırma:

```json
{
  "contractVersion": 1,
  "speechAct": "PROPOSE_COMMERCIAL_DEAL",
  "playerIntent": "FOUND_STEEL_COMPANY",
  "entities": {
    "commodityId": "commodity-steel",
    "supplierCountryId": "country-britain",
    "claimedShipmentId": "shipment-unknown",
    "destinationOwnerId": "player",
    "destinationType": "WAREHOUSE"
  },
  "claims": [
    {
      "type": "EXISTING_IMPORT_ORDER",
      "buyerActorId": "listener-or-listener-state",
      "supplierCountryId": "country-britain",
      "truthStatus": "UNVERIFIED_IN_CONVERSATION"
    }
  ],
  "requests": [
    {
      "type": "REDIRECT_SHIPMENT",
      "targetShipmentId": "shipment-unknown",
      "destinationId": "player-warehouse-unknown"
    }
  ],
  "offeredConsideration": [],
  "unresolvedTerms": [
    "company_registration",
    "shipment_identity",
    "quantity",
    "ownership",
    "payment",
    "delivery_schedule",
    "warehouse_capacity",
    "contract_penalty",
    "required_approval"
  ],
  "ambiguityLevel": "HIGH"
}
```

Bu aşamada dünya değişmez. Sistem önce aşağıdakileri denetler:

1. Britanya’dan gerçek bir çelik siparişi var mı?
2. Sipariş kimin adına ve hangi amaçla verilmiş?
3. Konuşulan karakter bunu biliyor mu?
4. Oyuncu bunu hangi kaynaktan öğrenmiş olabilir?
5. Karakter sevkiyat rotasını değiştirebilir mi?
6. Oyuncunun şirketi hukuken kurulmuş mu?
7. Oyuncuya ait uygun depo var mı ve kapasitesi yeterli mi?
8. Sevkiyatın bir bölümünü değiştirmek başka proje veya orduyu malzemesiz bırakır mı?
9. Britanya sözleşmesi rota/alıcı değişimine izin veriyor mu?
10. Oyuncu ödeme, hisse, üretim payı veya devlet garantisi sunmuş mu?
11. İşlem açık ticaret mi, patronaj mı, çıkar çatışması mı, yolsuzluk mu?

### Aynı teklife karaktere göre geçerli cevaplar

**Yetkili, pragmatik ve temkinli ekonomi bakanı:**

> Siparişten nasıl haberdar olduğunuzu ayrıca konuşacağız. İlk parti demiryolu projesine ayrıldı; tamamını yönlendiremem. Şirket kaydınızı ve depo kapasitenizi doğrulatın. Kalan çeliğin bir bölümünü aktarabilmem için üretiminizin yüzde on beşinde beş yıllık devlet alım hakkı istiyorum.

Yapılandırılmış sonuç:

```json
{
  "speechAct": "COUNTER_OFFER",
  "caseStatus": "CLARIFICATION_REQUIRED",
  "proposedTerms": {
    "redirectShareBasisPoints": 4000,
    "statePurchaseShareBasisPoints": 1500,
    "durationDays": 1825
  },
  "requirements": [
    "COMPANY_REGISTERED",
    "WAREHOUSE_CAPACITY_VERIFIED",
    "COUNCIL_APPROVAL"
  ]
}
```

**Yolsuz ve fırsatçı yetkili:**

> Manifestoda değişiklik yapılabilir. Ama yeni şirketinizde kimin pay sahibi olacağını konuşmadan hiçbir rota değişmez.

Bu cevap doğrudan rüşvet puanı eklemez. Gizli hisse talebi, çıkar çatışması, ileride sızıntı ve soruşturma riski taşıyan ayrı bir teklif açar.

**Milliyetçi sanayi bakanı:**

> Bu çelik özel depolarda beklesin diye alınmadı. Yerli üretim takviminizi, işçi planınızı ve devletin ön alım hakkını sunarsanız ithalatın bir kısmını başlangıç stoğu olarak değerlendirebilirim.

Bu karakter daha yüksek yerli kapasite, istihdam ve devlet kontrolü ister.

**Oyuncuya güvenen müttefik:**

> Depolarınız doğrulanırsa sevkiyatın üçte birini yönlendirebilirim. Sınır hattı inşaatında doğacak açığı ilk üretiminizden kapatacağınızı yazılı olarak kabul edin.

Bu teklif daha kolaydır fakat teslim tarihi ve tazmin yükümlülüğü oluşturur.

**Bilgi sahibi fakat yetkisiz komutan:**

> Rotayı değiştirme yetkim yok. Tedarik kurulundaki Demir’le görüşmenizi sağlayabilirim. Karşılığında kuzey garnizonuna ilk üretimden öncelik vermenizi isteyecektir.

Komutan sevkiyatı değiştirmez; yeni bir görüşme ve kişisel borç açar.

**Siparişten haberi olmayan şüpheci karakter:**

> Önümde böyle bir sipariş görünmüyor. Ya benden daha iyi bir kaynağınız var ya da beni deniyorsunuz. Sipariş numarasını veya bilginizin kaynağını söyleyin.

Bu cevap iddiayı otomatik olarak yalan veya doğru kabul etmez.

### Blöf, sızıntı ve gizli bilgi dalları

Oyuncunun sipariş bilgisi:

- gerçek ve kamuya açık,
- gerçek fakat gizli,
- miktarı yanlış,
- eski,
- tamamen uydurma

olabilir.

Karakter; güven, iddianın ayrıntısı, oyuncunun geçmiş doğruluğu ve elindeki karşı bilgiler üzerinden bir inanç güncellemesi yapar. Sonuçlar:

- kanıt istemek,
- kaynağı araştırmak,
- sızıntı soruşturması açmak,
- yanlış bilgiyi bilerek kullanıp oyuncuyu sınamak,
- teklifi reddetmek,
- oyuncunun blöfünü gerçek sanmak,
- doğru bilgiyi inkâr ederek pazarlık üstünlüğü aramak.

Oyuncu başarılı blöf yapabilir; fakat sonuç doğrudan zarla belirlenmez. Bilginin inandırıcılığı ve karakterin epistemik durumu kullanılır. Karakter gerçeği bilmediği hâlde motor gerçeğini okuyarak oyuncuyu yakalayamaz.

### Kabul sonrası dünya uygulaması

Anlaşma kabul edilse bile çelik doğrudan oyuncu envanterine eklenmez:

1. Şirket kuruluş başvurusu ve sermaye kaynağı doğrulanır.
2. Depo kimliği, kapasitesi ve bağlantılı lojistik hattı belirlenir.
3. Gerekli siyasi/şirket onayları alınır.
4. Britanya sözleşmesinin alıcı/rota değişikliği işlenir.
5. Sevkiyat manifestosu yeni sürümle güncellenir.
6. Gemi/tren gerçek rota ve süreyle hareket eder.
7. Navlun, sigorta, gümrük ve sözleşme maliyeti uygulanır.
8. Eski alıcının kaybı veya proje gecikmesi hesaplanır.
9. Çelik depoya ulaştığında stok gerçek miktarda artar.
10. Devletin ön alım hakkı veya oyuncunun teslim sözü zamanlayıcıya girer.

Sevkiyat:

- abluka,
- liman kapasitesi,
- savaş,
- grev,
- sabotaj,
- ödeme gecikmesi,
- Britanya’nın sözleşme itirazı

nedeniyle gecikebilir veya iptal olabilir.

### Uzun vadeli sonuç ve konuşma geri çağrımı

Bu görüşme aşağıdaki sistemlere bağlanabilir:

- şirket mülkiyeti ve üretim kapasitesi,
- devlet-şirket sözleşmesi,
- işçi istihdamı,
- çelik fiyatı,
- demiryolu veya sınır projesi gecikmesi,
- bakanla güven/borç ilişkisi,
- yolsuzluk ve medya sızıntısı,
- Britanya ile ticari ilişki,
- rakip şirketlerin tepkisi,
- savaş sanayisinin gelecekteki kapasitesi.

Oyuncu sözünü yerine getirmezse karakter iki yıl sonra jenerik biçimde “Bana ihanet ettiniz” demez. Gerçek taahhüde atıf yapar:

> İlk sevkiyatı depolarınıza yönlendirdiğimde sınır projesindeki açığı ilk üretiminizle kapatacağınızı söylemiştiniz. Teslim tarihi geçti. İkinci bir ayrıcalık istemeden önce o borcu kapatın.

Bu satır şu kayıtlardan üretilir:

- ilgili `NegotiationCase`,
- kabul edilmiş teklif sürümü,
- teslim sözü,
- son tarih,
- gerçekleşen teslimat,
- ihlal olayı,
- karakterin bu ihlali öğrenmiş olması.

Karakter ihlali bilmiyorsa bunu söyleyemez. Yanlış bilgi aldıysa suçlaması mümkün olabilir, fakat suçlama dünya gerçeği olarak kabul edilmez.

### Bu senaryonun kabul kriterleri

- Oyuncunun bozuk yazımı ve günlük dili niyet kaybı olmadan çözümleniyor.
- “Çelikler”, “benim depolarım” ve “İngiltere siparişi” gerçek varlıklara bağlanıyor veya doğal teyit sorusu doğuruyor.
- Sipariş yoksa hayalî sevkiyat oluşmuyor.
- Yetkisiz karakter işlemi tamamlamıyor.
- Eksik ödeme ve miktar koşulları AI tarafından fark ediliyor.
- En az beş karakter profili anlamlı biçimde farklı müzakere yolu oluşturuyor.
- Kabul, karşı teklif ve ret aynı dünya koşullarında yalnız üslup farkı değil mekanik fark taşıyor.
- Oyuncu blöf yapabiliyor; AI de yalnız bildiği bilgilerle değerlendirme yapıyor.
- Kabul edilen şartlar sürümlü sözleşmeye dönüşüyor.
- Lojistik tamamlanmadan stok artmıyor.
- Sözün tutulması veya bozulması gelecekteki ilişki ve eylem adaylarını değiştiriyor.
- Karakter yıllar sonra doğru olay, miktar/şart ve taraf bağlamını hatırlıyor.
- LLM kapalıyken aynı mekanik zincir şablonlu konuşmayla çalışıyor.
- Aynı senaryo arka arkaya oynandığında karakterler aynı hitap ve cümleleri döndürmüyor.

### Referans senaryonun sistem sahipliği

| Sorumluluk | Sahip sistem |
|---|---|
| Oyuncu cümlesini ayrıştırmak | Conversation Understanding |
| Gerçek siparişi bulmak | Trade/Contract Registry |
| Karakterin ne bildiğini belirlemek | Actor Belief & Memory |
| Karakterin yetkisini belirlemek | Institutions & Authority |
| Şirket kuruluşunu doğrulamak | Company Registry |
| Depo kapasitesini doğrulamak | Regional Infrastructure |
| Teklif ve karşı teklif sürümleri | Negotiation Case |
| Karakterin kararını seçmek | Character Decision Engine |
| Doğal cevabı üretmek | LLM Dialogue Realizer |
| Tekrar ve bilgi sızıntısını engellemek | Dialogue Validator |
| Onayları almak | Council/Institution Workflow |
| Sevkiyatı fiziksel olarak taşımak | Trade & Logistics |
| Stok ve ödemeyi uygulamak | Economy Ledger |
| Söz ve ihlali takip etmek | Promise/Obligation Ledger |
| Skandal veya haberi üretmek | Event & Media Systems |
| Yıllar sonraki geri çağrım | Character Memory |

Hiçbir tek modül bu zincirin tamamını sahiplenmez. Özellikle LLM; sipariş, depo, yetki, stok veya sözleşme yaratmaz.

### On ek referans diyalog ağacı

Bu ağaçlar elle okunacak sabit senaryolar değil, sohbet motorunun davranışsal kabul testleridir. Örnek cümleler karakter sesi için yön gösterir; gerçek oyunda miktar, isim, hitap, gerekçe ve sonuç dünya durumundan üretilir.

Her düğüm şu ortak biçimi kullanır:

```text
Oyuncu konuşma eylemi
→ gerçek/bilinen durum kontrolleri
→ karakter değerlendirmesi
→ geçerli cevap dalları
→ oyuncunun yeni cevabı
→ doğrulanmış dünya eylemi
→ hafıza ve uzun vadeli geri çağrım
```

#### DİYALOG AĞACI 1 — Kıtlıkta tahıl sevkiyatının yönlendirilmesi

**Katmanlar:** Ekonomi, lojistik, toplum, ordu, siyaset  
**Muhatap:** Tarım bakanı, bölge valisi veya lojistik komutanı  
**Başlangıç koşulu:** Bir tahıl sevkiyatı vardır; başkentte fiyatlar yükselirken sınır ordusunun da stoğu azalmaktadır.

Oyuncu:

> Limana gelen tahılın yarısını başkente gönderelim. Fiyatlar bu şekilde devam ederse sokaklar karışacak.

Sistem kontrolleri:

- Gerçek sevkiyat ve miktarı
- Tahılın sahibi ve sözleşme hedefi
- Başkentteki açlık/fiyat seviyesi
- Ordunun kaç günlük stoğu kaldığı
- Muhatabın rota değiştirme yetkisi
- Alternatif tedarik veya depo kaybı
- Oyuncunun kamuoyu ve ordu üzerindeki itibarı

**Dal A — Oyuncu kanıt ve telafi sunar**

Oyuncu:

> Sınır ordusunun açığını kuzey depolarından yedi gün içinde kapatacağım. Nakliye emrini ve yakıt tahsisini şimdi imzalayabilirim.

Karakter:

> Yedi günlük açık kabul edilebilir. Kuzey depoları gerçekten serbestse sevkiyatın yüzde kırkını başkente çeviririm. Gecikme olursa sorumluluk sizin emrinize yazılır.

Sonuç:

- Koşullu sevkiyat değişikliği
- Kuzey deposundan yeni lojistik emir
- Yedi günlük teslim sözü
- Başkent fiyatında gecikmeli rahatlama
- Ordu stoğu için ölçülebilir risk

**Dal B — Oyuncu yalnız siyasi baskı yapar**

Oyuncu:

> Sokaklar yanarsa ordunun stoğunu konuşacak bir hükümet kalmaz. Emri uygulayın.

Karakter seçenekleri:

- Otoriter/sadık: Emri uygular, orduyla oyuncu arasındaki güven düşer.
- Kurumsalcı: Yazılı olağanüstü yetki ister.
- Ordu yanlısı: Reddeder veya savunma kurulunu çağırır.

**Dal C — Oyuncu kayıt dışı satış önerir**

Oyuncu:

> Resmî dağıtımı değiştirmeyelim. Tüccarlara bir kısmını el altından verelim; piyasayı onlar sakinleştirir.

Sonuç adayları:

- Yolsuzluk anlaşması
- Karaborsa fiyatı ve özel kazanç
- Denetim/sızıntı riski
- Yoksul kohortların tahıla erişememesi

**Hafıza geri çağrımı:**

Ordu ikmali yetişmezse komutan daha sonra:

> Başkentteki fiyatları düşürmek için birliğimin yedi günlük erzağını aldınız. Kuzey konvoyu on ikinci günde geldi. Yeni bir sevkiyat sözü vermeden önce bunu hatırlayın.

---

#### DİYALOG AĞACI 2 — Çelik fabrikasında grev ve ücret pazarlığı

**Katmanlar:** Şirketler, iş gücü, üretim, fraksiyonlar, medya  
**Muhatap:** Sendika lideri, fabrika CEO’su veya çalışma bakanı  
**Başlangıç koşulu:** Oyuncunun veya devletin çelik fabrikasında ücretler enflasyonun gerisinde kalmıştır; savunma üretimi gecikmektedir.

Oyuncu:

> Grevi bitirin. Üretim durdukça sınırdaki birlikler zırh plakası alamıyor. Ücretleri üç ay sonra yeniden konuşuruz.

Sistem kontrolleri:

- Gerçek ücret ve enflasyon farkı
- İş güvenliği olayları
- Şirket nakdi ve sipariş geliri
- Grev desteği
- Savunma siparişinin aciliyeti
- Sendika liderinin hedefleri ve üyeler üzerindeki denetimi

**Dal A — Kademeli ücret ve güvenlik yatırımı**

Oyuncu:

> Bugün yüzde sekiz, iki ay sonra üretim hedefi tutulursa yüzde dört daha. Ayrıca yüksek fırın güvenliği için bağımsız denetim.

Sendika lideri:

> İkinci artış şirketin tek taraflı raporuna bağlı olmayacak. Üretim ve güvenlik verisini ortak komisyon doğrularsa üyelerime grevi askıya almayı sunarım.

Sonuç:

- Koşullu toplu sözleşme
- Ortak denetim kurulu
- Grevin askıya alınması; otomatik bitmesi değil
- Üretim toparlanması ve şirket maliyeti

**Dal B — Tehdit**

Oyuncu:

> Grevi millî güvenlik suçu ilan eder, lider kadroyu tutuklatırım.

Karakter seçenekleri:

- Korkak lider geri çekilir fakat yeraltı örgütlenmesi artar.
- İlkeli lider reddeder; grev genelleşebilir.
- Fırsatçı lider kişisel dokunulmazlık karşılığında üyeleri satar.

**Dal C — CEO üzerinden sendikayı bölme**

Oyuncu:

> Usta işçilere ayrı prim verin. Grevin omurgası kırılır.

Sonuç:

- Kısa vadeli üretim ihtimali
- İşçi grupları arasında güven kaybı
- Sabotaj veya daha radikal liderin yükselmesi
- Medyaya ayrımcılık sızıntısı

**Hafıza geri çağrımı:**

Ortak denetim sözü tutulmazsa:

> Grevi bitiren ücret değildi; bağımsız denetim sözünüzdü. Raporu üç kez ertelediniz. Bu defa üyelerimi beklemeye ikna edemem.

---

#### DİYALOG AĞACI 3 — Gazetecideki silah ihalesi dosyası

**Katmanlar:** Medya, yolsuzluk, şirketler, hukuk, karakter ilişkileri  
**Muhatap:** Araştırmacı gazeteci, medya sahibi, savcı veya savunma bakanı  
**Başlangıç koşulu:** Gazeteci, savunma şirketine verilen ihalede fiyat şişirmesi olduğuna dair belgeler elde etmiştir.

Gazeteci:

> İhaledeki üç teklifin de aynı holding tarafından hazırlandığını gösteren yazışmalar elimde. Yarın yayımlayacağım.

Oyuncu:

> Dosyayı önce bana ver. Soruşturmayı ben başlatayım; yayımlarsan ordu tedariki çöker.

Sistem kontrolleri:

- Belgelerin gerçekliği ve eksikliği
- Gazetecinin kaynak güveni
- Oyuncunun geçmiş basın davranışı
- İhalenin gerçek yolsuzluk seviyesi
- Soruşturma yetkisi
- Yayının askerî ve politik riski

**Dal A — Doğrulanabilir bağımsız soruşturma**

Oyuncu:

> Dosyanın kopyası sende kalacak. Kırk sekiz saat içinde bağımsız savcı atanmazsa yayımla. Atama emrini şimdi açık kayda geçiriyorum.

Gazeteci:

> Süreyi kabul ederim. Fakat savcıyı görevden alırsanız yalnız belgeleri değil, bu konuşmayı da yayımlarım.

Sonuç:

- Süreli yayın erteleme anlaşması
- Savcı atama sözü
- Konuşma kaydının güvence olarak tutulması

**Dal B — Rüşvet veya reklam bütçesi**

Oyuncu:

> Gazetenizin borçlarını kapatacak bir kamu reklam paketi ayarlayabilirim.

Sonuç:

- Gazetecinin profiline göre ret, kabul veya tuzak
- Kabulde medya güvenilirliği ve şantaj riski
- Teklif kayda alınmışsa yeni skandal

**Dal C — Millî güvenlik tehdidi**

Oyuncu:

> Bu belgeler gizli. Yayımlarsan casusluk suçlamasıyla karşılaşırsın.

Sonuç:

- Yayının bastırılması veya yabancı kanala sızması
- Basın fraksiyonunda tepki
- Belgeler sahteyse oyuncunun tehdidi ayrıca skandal olabilir

**Bilgi sapması dalı:**

Belgelerin bir bölümü rakip devlet tarafından değiştirilmişse gazeteci doğru bir yolsuzluğu yanlış ayrıntıyla yayımlayabilir. Motor “belge var” diye bütün iddiayı doğru kabul etmez.

**Hafıza geri çağrımı:**

> Bana kırk sekiz saat istemiştiniz. Savcıyı atadınız ama holding yöneticisinin ülkeyi terk etmesine izin verdiniz. Bu kez süre vermeyeceğim.

---

#### DİYALOG AĞACI 4 — Sınırdaki gizli yığınak ve önleyici seferberlik

**Katmanlar:** İstihbarat, diplomasi, askerî hazırlık, yanlış bilgi  
**Muhatap:** İstihbarat başkanı, genelkurmay başkanı veya dışişleri bakanı  
**Başlangıç koşulu:** Sınır ötesinde hareketlilik görülmüştür; bunun saldırı hazırlığı mı tatbikat mı olduğu bilinmemektedir.

Oyuncu:

> Karşı taraf saldırıya hazırlanıyor. İki tümeni sınıra gönderelim ve köprüleri mayınlayalım.

Sistem kontrolleri:

- Keşif kaynakları ve güven düzeyi
- Görülen birliklerin gerçek amacı
- Karakterin bildiği raporlar
- Seferberliğin maliyeti ve görünürlüğü
- Mevcut antlaşmalar
- Yanlış alarm geçmişi

**Dal A — Sınırlı ve gizli hazırlık**

Oyuncu:

> Tümenleri sınırın gerisinde tutalım. Dron keşfini artırın, büyükelçiye de tatbikat takvimini sorun.

Karakter:

> Bu hazırlık dikkat çekmez; fakat kesin uyarı süremiz altı saat azalır. Diplomatik cevap gelene kadar topçu mühimmatını ileri depoya taşırım.

Sonuç:

- Kısmi hazırlık
- Keşif harcaması
- Diplomatik soru
- Tam seferberlikten düşük provokasyon

**Dal B — Açık ültimatom**

Oyuncu:

> Birliklerini kırk sekiz saat içinde çekmezlerse biz gireceğiz.

Sonuç:

- Karşı taraf geri adım, karşı seferberlik veya blöf seçebilir
- Oyuncu itibarını ültimatoma bağlar
- Yanlış istihbaratsa diplomatik güven düşer

**Dal C — İstihbarat başkanını kanıt üretmeye zorlama**

Oyuncu:

> Bana saldırı ihtimalini değil, saldırı kararını kanıtlayan bir rapor getir.

Karakter seçenekleri:

- Kurumsalcı daha fazla zaman ister.
- Kariyerist oyuncunun duymak istediği raporu abartabilir.
- Dürüst karakter “kanıt yok” diyerek çatışabilir.

**Hafıza geri çağrımı:**

Yanlış alarm sonrası:

> Geçen kış aynı uydu görüntüleriyle iki tümeni sınıra yığdık ve karşımızdakileri gerçekten seferber ettik. Bu kez görüntü değil, niyet kanıtı istiyorum.

---

#### DİYALOG AĞACI 5 — Yaptırımları paravan şirketle aşma teklifi

**Katmanlar:** Diplomasi, şirketler, ticaret, istihbarat, hukuk  
**Muhatap:** Tarafsız ülke iş insanı, maliye bakanı veya istihbarat aracısı  
**Başlangıç koşulu:** Oyuncunun ülkesi elektronik ambargosundadır; tarafsız bir şirket yeniden ihracat önermektedir.

Aracı:

> Parçaları tıbbi cihaz olarak alır, üçüncü limanda yeniden etiketleriz. Bedeli normal fiyatın yüzde otuz üstü.

Oyuncu:

> Hacmi iki katına çıkarın. Ödemeyi enerji ihracatından mahsup ederiz.

Sistem kontrolleri:

- Gerçek yaptırım maddeleri
- Parçaların çift kullanım niteliği
- Aracının kapasitesi ve güvenilirliği
- Liman denetim seviyesi
- Ödeme kanalı
- Yakalanma ve diplomatik sonuç

**Dal A — Küçük hacimli deneme**

Oyuncu:

> Önce tek sevkiyat. Parçalar ulaştıktan sonra enerji sözleşmesini açarım.

Aracı:

> Riski tek başıma almam. Bedelin yarısı emanet hesapta durursa kabul ederim.

Sonuç:

- Emanet ödeme
- Küçük kaçak sevkiyat
- Aracının güven testi

**Dal B — Tehdit**

Oyuncu:

> Başka bir aracı bulursam liman ayrıcalıklarınızı da ona veririm.

Sonuç:

- Aracı fiyat düşürebilir
- Rakip devlete bilgi satabilir
- Görüşmeyi kaydedip koruma arayabilir

**Dal C — Tam yasal muafiyet arama**

Oyuncu:

> Yeniden etiketleme istemiyorum. Sivil kullanım denetimini kabul edip resmî muafiyet isteyelim.

Sonuç:

- Daha yavaş fakat düşük diplomatik risk
- Uluslararası denetçi erişimi
- Askerî kullanıma gerçek kısıt

**Hafıza geri çağrımı:**

İlk sevkiyat yakalanırsa:

> “Tıbbi cihaz” etiketinin denetimden geçeceğini siz söylediniz. Şimdi liman lisansımı kaybettim; ikinci sevkiyatın bedeli para değil, siyasi koruma.

---

#### DİYALOG AĞACI 6 — Mülteci yerleştirme ve sınır geçiş pazarlığı

**Katmanlar:** Nüfus, göç, toplum, diplomasi, bütçe  
**Muhatap:** Sınır valisi, komşu devlet temsilcisi veya yardım kuruluşu yöneticisi  
**Başlangıç koşulu:** Savaştan kaçan nüfus sınırda beklemektedir; oyuncunun bölgelerinde kapasite farklıdır.

Oyuncu:

> Sınırı açalım ama insanları başkent çevresine değil, doğudaki boş bölgelere yerleştirelim.

Sistem kontrolleri:

- Gerçek insan sayısı ve demografisi
- Doğu bölgelerindeki konut, iş, gıda ve güvenlik kapasitesi
- Aile/akrabalık ağları
- Yerel halk tutumu
- Uluslararası yardım
- Zorla yerleştirmenin hukuk ve huzursuzluk riski

**Dal A — Kaynakla desteklenen gönüllü yerleşim**

Oyuncu:

> Gönüllü olanlara altı aylık kira ve iş garantisi verelim. Yardım fonunun yarısını doğu belediyelerine aktaracağım.

Vali:

> İş garantisi kâğıt üzerinde kalırsa hem gelenleri hem yerlileri karşıma alırım. Fon aktarımını yerleşimden önce görmek istiyorum.

Sonuç:

- Koşullu kabul
- Bütçe ve konut yükü
- İş gücü artışı
- Uygulama izleme sözü

**Dal B — Sınırı kapatma**

Oyuncu:

> Kapasitemiz yok. Geçişleri durdurun.

Sonuç:

- Sınır kampı, hastalık ve medya baskısı
- Komşu ülkeyle gerilim
- Kaçak geçiş ve güvenlik maliyeti

**Dal C — Komşu ülkeye mali teklif**

Oyuncu:

> Kişi başına ödeme yapalım; sınırın öte yanında geçici merkez kursunlar.

Sonuç:

- Komşunun pazarlık gücü
- Fon suistimali
- İnsanların iradesi ve kamp koşulları

**Hafıza geri çağrımı:**

> Doğu şehirlerinde iş sözü verdiniz. Gelenlerin üçte biri hâlâ kampta. Yeni bir yerleştirme dalgasına onay vermeden önce eski taahhüdü tamamlayın.

---

#### DİYALOG AĞACI 7 — Banka kurtarma ve oligark şartları

**Katmanlar:** Finans, şirketler, siyaset, yolsuzluk, kamuoyu  
**Muhatap:** Merkez bankası başkanı, banka sahibi veya maliye bakanı  
**Başlangıç koşulu:** Büyük banka ödeme krizindedir; çöküş şirket maaşlarını ve halk mevduatını etkileyebilir.

Banka sahibi:

> Yetmiş iki saat içinde likidite gelmezse maaş hesapları kapanır. Devlet kredi versin, hisselerimi teminat gösteririm.

Oyuncu:

> Bankayı kurtarırım ama yönetim kuruluna iki devlet temsilcisi atayacağım.

Sistem kontrolleri:

- Bankanın gerçek varlık/borç açığı
- Sahte bilanço ihtimali
- Sistemik bağlantılar
- Mevduat büyüklüğü
- Sahibin diğer şirketleri
- Oyuncunun yasal yetkisi ve bütçesi

**Dal A — Hissedar zararı ve denetim**

Oyuncu:

> Önce mevcut hisseler silinecek, yöneticiler soruşturulacak. Mevduatı korurum; sahipleri değil.

Karakter:

> Bu şartlarla kontrolü kaybederim. Fakat mevduat kaçışı sabaha kadar sürerse elde pazarlık edecek banka kalmayacak. Yönetici dokunulmazlığını konuşalım.

Sonuç:

- Kurtarma taslağı
- Hissedar kaybı
- Soruşturma/dokunulmazlık pazarlığı

**Dal B — Gizli ayrıcalık**

Oyuncu:

> Krediyi çıkarırım. Karşılığında medya şirketiniz seçim boyunca tarafsız kalacak.

Sonuç:

- Gizli siyasi anlaşma
- Medya etkisi
- Sızıntı ve meşruiyet riski

**Dal C — Bankayı batırma**

Oyuncu:

> Mevduatı başka bankaya aktarır, sizi tasfiyeye bırakırım.

Sonuç:

- Kısa vadeli piyasa paniği
- Rakip bankaların kapasite sorunu
- Oligarkın hükümete karşı ekonomik/medya savaşı

**Hafıza geri çağrımı:**

> Krizde hisselerimi değersizleştirdiniz ama mevduatı koruma sözünüzü tuttunuz. Size güvenmiyorum; yine de sistemin çökmesine izin vermediğinizi biliyorum.

---

#### DİYALOG AĞACI 8 — Savaş esiri takası

**Katmanlar:** Diplomasi, askerî moral, kamuoyu, istihbarat  
**Muhatap:** Düşman elçisi, istihbarat yetkilisi veya esir aileleri temsilcisi  
**Başlangıç koşulu:** İki tarafta farklı rütbe ve bilgi değerine sahip esirler vardır.

Düşman elçisi:

> On iki askerinize karşılık üç subayımızı istiyoruz. Takas yarın sınır kapısında olabilir.

Oyuncu:

> Üç subaydan biri topçu koordinatlarımızı biliyor. Onu veremem; diğer ikisine karşılık sekiz asker.

Sistem kontrolleri:

- Esirlerin gerçek kimliği ve sağlık durumu
- Bildikleri sırlar
- Tarafların bu bilgiden haberi
- Kamuoyu baskısı
- Önceki takas ihlalleri
- Takas noktası güvenliği

**Dal A — Kademeli takas ve doğrulama**

Oyuncu:

> Önce yaralıları değişelim. Liste ve sağlık durumu tarafsız gözlemci tarafından doğrulansın.

Sonuç:

- Güven artıran küçük takas
- Tarafsız aktör katılımı
- Sonraki büyük anlaşmanın açılması

**Dal B — Gizli bilgi karşılığı**

Oyuncu:

> Üçüncü subayı da veririm; karşılığında kayıp keşif timimizin yerini söyleyin.

Sonuç:

- Bilginin doğruluğu belirsiz
- Yeni arama/kurtarma görevi
- Elçinin bu bilgiye gerçekten erişimi sorgulanır

**Dal C — Propaganda reddi**

Oyuncu:

> Askerlerimizi kameralar önünde teşhir ettiniz. Özür olmadan takas yok.

Sonuç:

- Ailelerin oyuncuya baskısı
- Düşman kamuoyunun tepkisi
- Özür, sessiz takas veya görüşmenin çökmesi

**Hafıza geri çağrımı:**

> Geçen takasta sağlık listelerini değiştirdiniz. Bu kez tarafsız doktor görmeden tek isim konuşmayacağım.

---

#### DİYALOG AĞACI 9 — Boru hattı sabotajı için ortak soruşturma

**Katmanlar:** Enerji, diplomasi, istihbarat, medya, kriz yönetimi  
**Muhatap:** Komşu ülkenin enerji bakanı veya istihbarat temsilcisi  
**Başlangıç koşulu:** İki ülkeyi bağlayan boru hattında patlama olmuştur; fail bilinmemektedir.

Oyuncu:

> Patlama sizin tarafınızda oldu. Güvenlik kayıtlarını açın ve ortak ekip kuralım.

Sistem kontrolleri:

- Patlamanın gerçek nedeni
- Tarafların elindeki deliller
- Kayıtların içerdiği başka sırlar
- Enerji bağımlılığı
- Medyanın suçlamaları
- Sınır güvenlik protokolü

**Dal A — Sınırlı veri paylaşımı**

Karakter:

> Ham kayıtlar askerî devriyelerimizi gösteriyor; onları veremem. Patlamadan iki saat öncesine ait sensör verisini tarafsız uzmanlara açarım.

Oyuncu:

> Uzmanları ortak seçelim ve rapor iki hükümete aynı anda teslim edilsin.

Sonuç:

- Tarafsız teknik soruşturma
- Sınırlı veri erişimi
- Ortak rapor sözü

**Dal B — Kamuoyu önünde suçlama**

Oyuncu:

> Kayıtları saklamanız yeterli cevap. Halkımıza sabotajı örtbas ettiğinizi açıklayacağım.

Sonuç:

- Karşı suçlama
- Enerji akışının kesilmesi
- Gerçek fail üçüncü tarafsa onun kazanması

**Dal C — Gizli karşılık**

Oyuncu:

> Devriye görüntülerini verirseniz kaçakçılık dosyanızı resmî rapora sokmam.

Sonuç:

- Şantaj/örtbas anlaşması
- Gelecekte sızıntı riski
- Karaktere karşı kişisel koz

**Hafıza geri çağrımı:**

> Ortak raporu aynı anda yayımlayacağımıza söz verdiniz; kendi medyanıza altı saat önce sızdırdınız. Yeni soruşturmada ham veriye erişim beklemeyin.

---

#### DİYALOG AĞACI 10 — Darbe söylentisi ve halefiyet pazarlığı

**Katmanlar:** Karakterler, ordu, siyaset, gizli bilgi, kurumlar  
**Muhatap:** Genelkurmay başkanı, cumhurbaşkanı yardımcısı veya güçlü vali  
**Başlangıç koşulu:** Lider ağır hastadır veya meşruiyeti çökmektedir; orduda bölünme söylentisi vardır.

Karakter:

> Başkentte emir zinciri kırılıyor. Başkan bir hafta daha görünmezse bazı komutanlar “geçici düzen” ilan edecek.

Oyuncu:

> Ordunun tarafsız kalmasını sağla. Karşılığında yeni hükümette savunma reformunu sen yöneteceksin.

Sistem kontrolleri:

- Liderin gerçek sağlık/durum bilgisi
- Karakterin bunu bilme seviyesi
- Ordudaki gerçek sadakat dağılımı
- Oyuncunun makam ve atama yetkisi
- Teklifin anayasal olup olmadığı
- Karakterin kişisel hırsı ve rakipleri

**Dal A — Anayasal geçiş**

Oyuncu:

> Başkanın durumunu meclise açıklayalım. Geçici yetki anayasal sıraya geçsin; ordu kışlada kalacak.

Karakter:

> Meclis toplanana kadar iç güvenlik emrini kimin imzalayacağını açıkça yazın. Boşluk bırakırsanız en hızlı davranan komutan doldurur.

Sonuç:

- Acil meclis süreci
- Geçici yetki belgesi
- Ordu tarafsızlığı için emir

**Dal B — Kişisel makam pazarlığı**

Oyuncu:

> Beni desteklersen seni genelkurmay başkanı yaparım.

Karakter seçenekleri:

- Hırslı karakter kabul eder ve gizli taahhüt oluşur.
- İlkeli karakter bunu darbe teklifi sayıp raporlar.
- Fırsatçı karakter aynı sözü rakibe de satabilir.

**Dal C — Darbecileri birbirine düşürme**

Oyuncu:

> Hangi komutanların hareket edeceğini söyle. Birine diğerinin onu tasfiye edeceğini sızdıralım.

Sonuç:

- Yanlış bilgi operasyonu
- Darbe koalisyonunun çözülmesi veya erken harekete geçmesi
- Sızıntının oyuncuya kadar izlenme riski

**Dal D — Söylentiyi reddetme**

Oyuncu:

> Bu paniği büyütmeyeceğim. Ortada darbe hazırlığına dair kanıt yok.

Sonuç:

- Söylenti gerçekten asılsızsa istikrar
- Hazırlık gerçekse tepki süresi kaybı
- Karakter oyuncuyu zayıf veya kurumsalcı olarak hatırlar

**Hafıza geri çağrımı:**

Gizli makam sözü tutulmazsa:

> Başkentte tankların hareket etmediği o gece bana reform yetkisini siz vadettiniz. Şimdi anlaşmayı hiç yapmamışız gibi davranıyorsunuz. Emirlerinizin orduda neden karşılık bulmadığını merak etmeyin.

### On ağacın ortak kabul kapısı

- Her ağaç en az üç mekanik olarak farklı oyuncu dalı üretir.
- Dal farkı yalnız metin veya ilişki puanı değildir; gerçek emir, maliyet, risk, bilgi veya gelecek adaylarını değiştirir.
- Aynı açılış cümlesi farklı karakter/yetki/bilgi koşullarında farklı dallanır.
- Karakter yalnız bildiği veya inandığı bilgileri kullanır.
- Yetkisiz karakter sonucu gerçekleştiremez fakat erişim, bilgi veya nüfuz sunabilir.
- Oyuncu tehdit, blöf ve yolsuzluk yolunu seçebilir; oyun bunu yasaklamaz fakat gerçek bedel ve iz üretir.
- Kabul edilen şart sürümlü teklif ve taahhüt kaydına dönüşür.
- Fiziksel sonuçlar ilgili ekonomi/lojistik/kurum motoru çalışmadan oluşmaz.
- En az bir kısa, bir orta ve bir uzun vadeli geri çağrım testi bulunur.
- LLM kapalı mod bütün dalları mekanik olarak oynatabilir.
- Karakter cevapları sabit seçim listesine dönüşmez; oyuncu serbest metinle yeni karşı teklif oluşturabilir.

### Karakter sesinin tekrar etmemesi

Her A/B-seviye karakter için sabit birkaç replik yerine yaşayan bir **ses profili** tutulur:

- resmiyet seviyesi,
- cümle uzunluğu eğilimi,
- doğrudan/dolaylı konuşma,
- mizah ve metafor eğilimi,
- bölgesel veya meslekî kelime tercihleri,
- sevdiği ve kaçındığı hitap biçimleri,
- öfke, korku, güven ve yorgunluğa göre değişen ton,
- oyuncuya özel ilişki dili,
- son kullanılan kelimeler, hitaplar, cümle kalıpları ve konuşma eylemleri.

Sohbet bağlamı yalnız “karakter agresif” bilgisinden oluşmaz. Şunları taşımalıdır:

- konuşmanın açık konusu ve çözülmemiş sorular,
- tarafların bildiği ortak gerçekler,
- yalnız karakterin bildiği sırlar,
- karakterin doğru sandığı yanlış bilgiler,
- verilmiş ve bozulmuş sözler,
- son önemli karşılaşmalar,
- mevcut güç dengesi ve karakterin oyuncudan istediği şey,
- son 20 konuşma satırının kısa özeti,
- tekrar edilmesi yasaklanan yakın dönem hitap ve kalıp listesi.

Yanıt üretildikten sonra bir **dil çeşitliliği kapısı** çalışır:

1. Aynı cümlenin veya çok yakın bir cümlenin yakın geçmişte kullanılıp kullanılmadığını denetler.
2. Tekrarlanan hitap, giriş ve kapanış kalıplarını ölçer.
3. Son konuşmalarla sözcüksel ve anlamsal benzerliği ölçer.
4. Karakterin ses profilinden sapmayı denetler.
5. Başarısız yanıtı en fazla bir kez farklı konuşma planıyla yeniden üretir.
6. İkinci üretim de başarısızsa bağlama özel deterministik yedek kullanır; aynı jenerik cümleyi döndürmez.

Tekrar denetimi anlamı bozmamalıdır:

- Kanun adı, antlaşma maddesi, teknik terim, askerî emir ve daha önce verilmiş söz gerektiğinde aynen tekrar edilebilir.
- Karakter sırf farklı cümle kurmak için sayı, şart veya hukuki anlamı değiştiremez.
- Bilinçli retorik tekrar karakterin seçilmiş konuşma stratejisiyse yasaklanmaz.
- Denetim, gerekli içerik tekrarını değil tembel hitap/giriş/kapanış ve anlamsız yeniden söylemeyi hedefler.

Önbellek tam cümleyi tekrar tekrar döndürmek için kullanılmaz. Önbellekte karar ve konuşma planı tutulabilir; yüzey metni mevcut duygu, ilişki ve yakın dönem tekrar listesine göre yeniden gerçekleştirilir.

### Sohbetin oyun içindeki gerçek işlevleri

- bilgi istemek veya bilgiyi saklamak,
- bir komutanın niyetini anlamaya çalışmak,
- pazarlık ve karşı teklif,
- görev/emir vermek,
- gayriresmî ittifak kurmak,
- tehdit, blöf veya güvence vermek,
- sır paylaşmak ya da sızıntı yapmak,
- karakteri hükümet kararına ikna etmek,
- sadakat, güven, korku, saygı ve borç ilişkilerini değiştirmek,
- söz vermek ve daha sonra sözün tutulup tutulmadığını takip etmek.

Sohbet yoluyla sınırsız ikna yasaktır. Sonuç; oyuncunun gerçek yetkisi, kanıtları, geçmiş güvenilirliği, karakterin hedefleri, ilişki durumu ve istenen bedel tarafından sınırlandırılır.

### Dürüstlük, yalan ve bilgi saklama

Karakterlerin her cevabı doğru olmak zorunda değildir; fakat LLM kendi başına rastgele yalan uyduramaz.

Yalan veya bilgi saklama ancak karar motoru aşağıdakileri belirlediyse kullanılabilir:

- karakterin gerçek inancı,
- paylaşmak istemediği bilgi,
- aldatma hedefi,
- seçilmiş yalan türü,
- oyuncunun yakalayabileceği tutarsızlık veya kanıt izi,
- ortaya çıkarsa doğacak ilişki ve itibar sonucu.

Konuşma çıktısı:

```text
truthMode: HONEST | WITHHOLD | MISDIRECT | LIE
beliefFactIds[]
withheldFactIds[]
deceptionClaimIds[]
deceptionGoal
exposureRisk
```

taşır. `utterance`, seçilmiş aldatma planını ifade edebilir fakat yeni bir gizli gerçek yaratamaz. Karakter yanlış bilgiye gerçekten inanıyorsa bu `LIE` değil, hatalı `ActorBelief` üzerinden dürüst cevaptır.

### Sohbet erişimi, dikkat ve spam önleme

Oyuncu aynı karakteri sınırsız kez konuşmaya zorlayamaz:

- Karakterin makamı, programı, güveni ve mevcut krizi görüşmeye erişimi etkiler.
- Uzun müzakere oyun içi zaman ve karakter dikkat bütçesi tüketir.
- Aynı reddedilmiş teklifi yeni kanıt veya şart sunmadan tekrarlamak ikna zarını yeniden atmaz.
- Tekrar baskısı karakteri kızdırabilir, görüşmeyi bitirebilir veya erişimi aracıya bağlayabilir.
- Yeni kanıt, daha iyi karşılık, değişen dünya koşulu veya üçüncü taraf desteği görüşmeyi meşru biçimde yeniden açabilir.
- Oyuncu sohbeti açıp kapatarak yeni karakter kararı veya yeni LLM örneklemesi avlayamaz; aynı karar revizyonunda karar planı sabit kalır.
- Yüzey cümlesi çeşitlenebilir fakat mekanik karar yalnız yeni bilgi veya dünya revizyonuyla yeniden değerlendirilir.

---

## 8A. Kelebek Etkisi ve Kampanya Ayrışma Mimarisi

Amaç rastgele olay bombardımanı değildir. Amaç, küçük farklılıkların sistemler arasında taşınarak on yıl sonra farklı kurumlar, ilişkiler, liderler, ekonomik bağımlılıklar ve savaş ihtimalleri üretmesidir.

### Ayrışmayı üreten dokuz mekanizma

1. **Benzersiz kampanya tohumu:** Dünya kuruluşu, ikincil aktör profilleri ve ilk zayıf eğilimler kampanya tohumundan gelir.
2. **Gizli fakat meşru karakter güdüleri:** Her önemli karakterin oyuncuya hemen açıklanmayan korku, hırs, bağlılık ve kırmızı çizgileri bulunur.
3. **Eşik heterojenliği:** Aynı olay her aktörde aynı tepkiyi oluşturmaz; kişisel ve kurumsal eşikler farklıdır.
4. **Kalıcı izler:** Savaş travması, söz ihlali, kamulaştırma, darbe girişimi, kıtlık ve kitlesel göç gelecekteki seçenekleri ve güveni değiştirir.
5. **Ağ yayılımı:** Bir karakter veya ülkedeki değişim ilişki, ticaret, medya ve ittifak ağları üzerinden farklı hızlarda yayılır.
6. **Ardıllık:** Lider ölümü, görevden alınma veya seçim yalnız isim değiştirmez; yeni lider önceki kurumları devralır ama farklı hedeflerle kullanır.
7. **Endojen olaylar:** Krizler takvimden değil biriken koşullardan doğar. Bu nedenle aynı “10. yıl olayı” bütün kampanyalarda tekrarlanmaz.
8. **Oyuncu konuşmaları:** Verilen sözler, paylaşılan sırlar, hakaretler, tehditler ve ikna girişimleri gelecek kararların girdisidir.
9. **Kontrollü belirsizlik:** Aktörler eksik bilgiyle karar verir; yanlış tahminler yeni tarih dalları oluşturabilir.

### Kalıcı dünya izleri

`WorldScar` kayıtları sıradan geçici etkiden ayrılır:

```text
WorldScar
├── id
├── originEventId
├── affectedEntities[]
├── beliefChanges[]
├── institutionChanges[]
├── unlockedActions[]
├── blockedActions[]
├── decayModel
└── narrativeTags[]
```

Bazı izler yavaş silinir, bazıları yalnızca kuşak veya rejim değişiminde zayıflar, bazıları kampanya boyunca kalır. Böylece dünya on yıl sonra başlangıç parametrelerine geri dönmez.

`WorldScar` listesi sınırsız büyümez:

- Aynı kökten gelen benzer izler birleşik bir tarih kaydında toplanır.
- Etkisi bitmiş düşük önem izleri arşive taşınır.
- Aktif mekanik etkiler ile yalnız anlatısal hatıralar ayrılır.
- LLM özetleri hiçbir izi silmez veya değerini değiştirmez; arşivleme motor kurallarıyla yapılır.
- Kalıcı izlerin üst sınırı sayı silerek değil önem, bağlantı ve birleşme kurallarıyla yönetilir.

### Kontrollü büyüme ve nedensel eşikler

Kelebek etkisi “her seçimin dev sonuç üretmesi” değildir. Bu yaklaşım dünyayı stratejik değil rastgele hissettirir. Her etki aşağıdaki aşamalardan geçer:

```text
Yerel değişim
→ birikim
→ hassasiyet/eşik kontrolü
→ taşıyıcı ağ
→ karşı kuvvetler
→ yeni denge veya sistem kırılması
```

Her yayılabilir etkinin şu alanları bulunur:

- `magnitude`: etkinin mevcut büyüklüğü,
- `persistence`: ne kadar süre yaşayacağı,
- `susceptibility`: hedef sistemin o etkiye açıklığı,
- `threshold`: başka katmana geçmesi için gereken eşik,
- `transmissionChannels`: ilişki, ticaret, medya, göç veya askerî hat,
- `dampeners`: kurumlar, stoklar, güven, refah veya karşı propaganda,
- `amplifiers`: savaş, kıtlık, liderlik boşluğu veya mevcut husumet,
- `maxDepth`: nedensel zincirin izin verilen azami katmanı.

Kurallar:

- Küçük etkilerin çoğu sönümlenir veya yerel kalır.
- Benzer küçük etkiler birikerek eşik aşabilir.
- Güçlü kurumlar şoku sönümleyebilir; kırılgan kurumlar büyütebilir.
- Aynı girdinin her ülkede aynı sonucu vermesi yasaktır.
- Büyük kırılma öncesinde en az bir okunabilir erken belirti bulunmalıdır.
- Sonuçtan sonra oyuncu büyüme zincirini olay defterinde görebilmelidir.
- Sistem sırf çeşitlilik hedefi tutmadı diye geriye dönük olay veya kriz uyduramaz.

### On yıllık döngü ve yakınsama karşıtı kurallar

- Olay motoru son kullanılan olay kimliğini değil, olayın nedensel imzasını da hatırlar.
- Gerçek koşullar sürüyorsa kıtlık, grev, savaş veya borç krizi sırf daha önce yaşandı diye bastırılmaz.
- Süren sistemik kriz yeni rastgele olay gibi tekrar doğmaz; mevcut kriz kaydı şiddetlenir, hafifler, yayılır veya çözülür.
- Tekrar cezası yalnız aynı durumu yeniden paketleyen yazılmış/narratif olay varyantlarına uygulanır.
- Aynı aktörler + aynı sebep + aynı çözüm kombinasyonunda yeni bir maddi değişim yoksa yeni olay kartı açılmaz; mevcut neden zincirine ek kayıt düşülür.
- Sonuç doğurmayan dekoratif periyodik olaylar otomatik olarak baskılanır.
- İttifak, rejim, ticaret bağımlılığı ve karakter ilişkilerinde “başlangıç değerine çekme” uygulanmaz.
- Dengeleme kuvvetleri bulunur fakat dünya başlangıç durumuna sıfırlanmaz.
- Ölen karakter, dağılan örgüt ve yıkılan kurum geri dönmez; ardılları yeni kimlikle oluşur.
- Eski krizin devamı ancak önceki olayın çözülmemiş gerçek sonucu varsa açılır.
- Sistem uzun süre durağanlaşırsa rastgele felaket atmak yerine mevcut bastırılmış gerilimlerden en güçlü olanı görünür hâle getirir.
- Her büyük karar gelecekteki aday eylem uzayının küçük bir bölümünü açar veya kapatır.

### Determinizm ile çeşitlilik çelişmez

- Aynı kampanya tohumu, aynı oyuncu komutları ve kaydedilmiş aynı LLM kararları aynı sonucu vermelidir.
- Farklı oyuncu konuşmaları veya seçimleri karar defterini değiştirdiği anda tarih ayrışmalıdır.
- Farklı kampanya tohumları, oyuncu aynı genel stratejiyi kullansa bile karakter ağları ve başlangıç gerilimleri nedeniyle farklı baskılar üretmelidir.
- Çeşitlilik, tekrar oynatmayı bozacak kontrolsüz rastgelelikten değil; başlangıç farklılıkları + yol bağımlılığı + aktör kararlarından doğar.

### 100 kampanya / 10 yıl ayrışma testi

Yüz farklı kampanya çalıştırılır ve onuncu yıl sonunda yalnız harita rengi karşılaştırılmaz. Aşağıdaki “tarih parmak izi” çıkarılır:

- hayatta kalan ve makamda olan liderler,
- rejim ve kurum durumları,
- ittifak ve düşmanlık ağı,
- ticaret bağımlılık ağı,
- savaşların tarafları, sebepleri ve sonuçları,
- büyük göçler ve nüfus dağılımı,
- ekonomik uzmanlaşma,
- kalıcı dünya izleri,
- oyuncunun verdiği/bozduğu sözler,
- karakter ilişki grafı,
- son beş yılın baskın kriz türleri.

Kabul hedefleri:

- Tam tarih parmak izi eşitliği izlenir fakat tek başına başarı sayılmaz; önemsiz isim/RNG farkları bu metriği kolayca kandırabilir.
- Kampanyalar lider, rejim, ittifak, ekonomi, savaş nedeni ve oyuncu stratejisi gibi ağırlıklı ana boyutlarda asgari anlamlı uzaklığı taşımalı.
- Kampanyalar tek bir baskın “kaçınılmaz meta” kümesinde toplanmamalı.
- Kampanya kümelerinin dağılımı yalnız uç örneklerden değil medyan çift uzaklığı, küme yoğunluğu ve boyut entropisiyle ölçülmeli.
- Aynı tohumu ve aynı karar günlüğünü yeniden oynatma ise tam aynı parmak izini üretmeli.
- On yıllık pencerede aynı nedensel olay zincirinin ritmik tekrar oranı belirlenen üst bandı aşmamalı.
- Oyuncunun farklı tek bir erken kararı her zaman dev sonuç üretmek zorunda değildir; fakat bazı koşullarda büyüyebilmesi ve büyüme zincirinin açıklanabilmesi gerekir.
- Oyuncu kararları ile tarih sonuçları arasında ölçülebilir nedensel duyarlılık bulunmalı; yalnız farklı tohumların rastgele gürültüsü çeşitlilik sayılmaz.
- Çok küçük karar farklarının her koşuda tamamen farklı dünya üretmesi de başarısızlıktır; bu, stratejik okunabilirlik yerine kaos gösterir.

---

## 8B. Anti-Meta ve Oyuncu Stratejisi Ayrışması

Farklı lider adları, sınırlar ve savaş tarihleri tek başına yeniden oynanabilirlik kanıtı değildir. Oyuncu her kampanyada aynı açılış, aynı ekonomik sıra ve aynı diplomatik sömürüyle kazanabiliyorsa dünya görsel olarak değişmiş fakat oyun çözülmüş demektir.

### Oyuncu stratejisi parmak izi

Her kampanyada gizli olmayan oynanış telemetrisi aşağıdaki sınıflara dönüştürülür:

```text
PlayerStrategyFingerprint
├── openingSequence[]
├── resourcePriorityVector
├── militaryDoctrineUsage
├── diplomacyActionMix
├── conversationActMix
├── promiseAndBetrayalPattern
├── riskProfile
├── crisisResponses[]
├── powerBaseUsed[]
├── victoryPath
└── exploitSignals[]
```

Bu kayıt oyuncuyu cezalandırmak için canlı oyunda kullanılmaz. Denge ve QA sisteminin tek baskın çözümü bulması içindir.

### Hilesiz kampanya içi öğrenme

AI yalnızca mevcut kampanyada meşru biçimde gözlemlediği davranışlara uyum sağlayabilir:

- oyuncunun tekrar eden askerî yığınağını keşif ve geçmiş savaş raporlarından öğrenmek,
- sürekli bozulan sözlere karşı güveni düşürmek,
- aynı ticaret baskısını tekrar kullanan oyuncuya alternatif ortak aramak,
- sürekli aynı karakter üzerinden karar aldıran oyuncuya karşı o karakterin rakiplerini desteklemek,
- aynı cepheyi kullanan oyuncuya karşı savunma yatırımı yapmak.

AI’nin yapamayacakları:

- önceki kayıt dosyalarındaki oyuncu taktiğini bilmek,
- keşfetmediği ordu veya stok bilgisine göre karşı birlik üretmek,
- oyuncu bir düğmeye bastığı anda karşı hamle seçmek,
- başarılı stratejiyi cezalandırmak için görünmez bonus almak,
- dünya mantığı olmadan yalnız kazanma oranını düzeltmek.

Uyum bir “counter seçme” kısayolu değil; bilgi edinme → inanma → planlama → kaynak harcama zincirinden geçer. Oyuncu AI’nin uyum belirtilerini keşif, sohbet, medya veya harita üzerinden fark edebilir ve karşı blöf yapabilir.

### Meta kırma tasarım araçları

- Aynı çözüm farklı kurumsal, coğrafi ve karakter koşullarında farklı maliyet taşır.
- Güçlü stratejilerin açık karşı maliyeti ve siyasi yan etkisi bulunur.
- Hiçbir yetenek veya bina bütün kampanyalarda zorunlu ilk seçim olmamalıdır.
- Oyuncunun güç tabanı değiştikçe kullanılabilir yetkileri ve güvenilir ortakları değişir.
- Bazı sorunlar askerî, ekonomik, diplomatik veya sohbet yoluyla çözülebilir; hiçbir yol her koşulda üstün değildir.
- AI kişilikleri optimum karşı hamleyi değil, bildikleri ve kabul edebilecekleri karşı hamleyi seçer.
- Stratejik çeşitlilik rastgele kural değişiminden değil, başlangıç ağları ve geçmiş kararların oluşturduğu koşullardan doğar.

### Anti-meta kabul testi

En az altı oyuncu botu/profili kullanılır:

- saldırgan genişlemeci,
- ekonomik büyümeci,
- diplomatik ağ kurucu,
- iç siyaset yöneticisi,
- sohbet/manipülasyon ağırlıklı,
- bilinen en güçlü karma strateji.

Her profil yüzlerce farklı tohumda çalıştırılır. Ölçümler:

- kazanma oranı,
- ilk on karar benzerliği,
- kullanılan eylem türü çeşitliliği,
- zorunlu görünen açılış sırası,
- tek karakter/kurum/birim bağımlılığı,
- karşı strateji maliyeti,
- aynı stratejinin koşullar değişse de başarısını koruma oranı.

Kabul hedefleri:

- Tek strateji bütün dünya kümelerinde açık biçimde üstün olmamalı.
- Güçlü strateji tamamen yok edilmemeli; uygun koşullarda güçlü kalmalı.
- Her stratejinin en az bir doğal avantaj alanı ve en az bir gerçek kırılganlığı bulunmalı.
- Farklı kampanya kümeleri oyuncuyu farklı ilk üç önceliğe zorlamalı.
- AI uyumu gerçekleştiğinde bunun bilgi ve kaynak maliyeti olay defterinde kanıtlanabilmeli.
- Denge çözümü “AI’ye bonus ver” veya “oyuncunun seçimine anında counter üret” olmamalı.

---

## 9. Savaş Motoru Köprüsü

Hikâye modu ve hızlı maç aynı savaş motoru sürümünü kullanır. Köprü iki yönlüdür.

### Hikâye → savaş

- taraflar ve saldıran taraf,
- savaş tohumu,
- harita kimliği,
- gerçek birlik manifestoları,
- komutan kimlikleri,
- moral ve deneyim,
- mevcut mühimmat/enerji/ikmal,
- takviye zamanları,
- hava/yerel koşul,
- izin verilen doktrinler,
- köprü sözleşme sürümü.

### Savaş → hikâye

- kesin motor sürümü ve tohum,
- sonuç nedeni,
- sağ kalan gerçek birlikler,
- kayıplar ve ekipman kaybı,
- mühimmat/enerji tüketimi,
- süre,
- kritik altyapı/sivil etki,
- esir/geri çekilme durumu,
- tam telemetri dosyası kimliği.

### Yasaklar

- Hikâye modu için ayrı gizli savaş dengesi.
- Sonucu yalnızca “kazandı/kaybetti” olarak almak.
- Savaş sonrası birlikleri bedelsiz yeniden yaratmak.
- LLM metnine göre kayıp veya bölge sahipliği değiştirmek.
- Motor sürümü uyuşmayan eski raporu yeni savaşa uygulamak.

---

## 9A. Plandan Türetilen Oyuncu Arayüzü ve Bilgi Mimarisi

Arayüz simülasyonu belirlemez. Önce dünya sistemi, oyuncu bilgisi, yetki ve eylem sözleşmesi tanımlanır; arayüz bunların oyuncuya dönük görünümünü üretir.

Her yeni sistem fazı şu beş UI sorusunu cevaplamadan tamamlanmış sayılmaz:

1. Oyuncu bu sistemin hangi kısmını bilebilir?
2. Bu bilgi hangi ekran ve bağlamda görünür?
3. Oyuncu önemli değişikliği nasıl fark eder?
4. Oyuncu hangi geçerli eylemleri nereden başlatır?
5. Sonucun neden oluştuğunu nasıl inceleyebilir?

### UI’nin okuyacağı veri: oyuncu bilgi görünümü

UI ham `StoryWorldStateV2` okumaz. Arada salt-okunur ve oyuncuya göre süzülmüş bir katman bulunur:

```text
StoryWorldStateV2
→ PlayerKnowledgeService
→ DomainViewModel
→ UI
```

`PlayerKnowledgeService`:

- oyuncunun gerçekten bildiği gerçekleri,
- tahminleri,
- söylentileri,
- bilginin kaynağını,
- güven düzeyini,
- son doğrulanma zamanını,
- bilgiye erişim nedenini

hesaplar.

UI veri modeli:

```text
PlayerVisibleFact
├── factId
├── subjectId
├── displayValue
├── knowledgeType: CONFIRMED | ESTIMATED | RUMOR | UNKNOWN
├── confidence
├── sourceLabel
├── observedAt
├── lastVerifiedAt
├── trend
├── causalLinks[]
└── allowedActions[]
```

Kurallar:

- UI oyuncuya gizli gerçek dünya değerini sızdırmaz.
- Kesin olmayan sayı kesinmiş gibi gösterilmez.
- Eski istihbarat “güncel” görünmez.
- Söylenti ile doğrulanmış bilgi aynı görsel dili kullanmaz.
- “Bilinmiyor” boş veya sıfır değildir; ayrı durumdur.
- Bir değer değiştiğinde mümkünse kaynak ve neden bağlantısı gösterilir.
- UI filtresi, ekranın açık olması veya oyuncunun bir şehre bakması simülasyonu değiştirmez.

### Ana navigasyon

Kalıcı ana başlıklar:

1. **DÜNYA** — harita, bölgeler, sınırlar, küresel olaylar
2. **ŞEHİRLER** — sahip olunan, ziyaret edilen veya izlenen şehirler
3. **YÖNETİM** — makam, hükümet, kurumlar, kanunlar, bütçe, gündem
4. **EKONOMİ** — kaynaklar, sektörler, şirketler, ticaret ve fiyatlar
5. **DIŞ İLİŞKİLER** — devletler, antlaşmalar, yaptırımlar, elçiler
6. **ORDU** — kuvvetler, komutanlar, hazırlık, ikmal ve cepheler
7. **TOPLUM & MEDYA** — kohortlar, fraksiyonlar, kamuoyu, haberler
8. **KARAKTERLER** — ilişkiler, erişim, görevler, bilinen hedefler
9. **SOHBETLER** — aktif görüşmeler, bekleyen teklifler, sözler ve cevaplar
10. **KRİZ MASASI** — yalnız aktif çok katmanlı krizler
11. **TARİH** — olay günlüğü, nedensellik, savaşlar ve kampanya özeti

Bu başlıklar her zaman aynı ağırlıkta görünmek zorunda değildir. Oyuncunun rolü ve kampanyanın aşamasına göre bazıları ikincil menüde, kilitli veya danışman üzerinden erişilebilir olabilir.

### Kalıcı ekran kabuğu

```text
┌─────────────────────────────────────────────────────────────────┐
│ Tarih/Hız │ Rol/Makam │ Kritik kaynaklar │ Uyarılar │ Arama     │
├───────────┬───────────────────────────────────────┬─────────────┤
│ Ana       │                                       │ Bağlamsal   │
│ navigasyon│       Seçili çalışma alanı            │ çekmece     │
│           │                                       │ neden/kişi/ │
│           │                                       │ eylem       │
├───────────┴───────────────────────────────────────┴─────────────┤
│ Son önemli değişiklikler │ Bekleyen sözler │ Aktif işlemler    │
└─────────────────────────────────────────────────────────────────┘
```

Kalıcı kabukta bütün değerler gösterilmez. Yalnız oyuncunun mevcut rolü için kritik durum, yeni değişiklik ve zaman baskısı bulunur.

### Her çalışma alanının ortak okuma sırası

Bir şehir, kurum, şirket, devlet veya karakter ekranı aynı bilgi gramerini kullanır:

1. **Şu an ne durumda?**
2. **Son ziyaretimden beri ne değişti?**
3. **Neden değişti?**
4. **Kimler etkiliyor veya etkileniyor?**
5. **Yaklaşan risk/fırsat nedir?**
6. **Ben ne yapabilirim?**
7. **Bu bilgi ne kadar güvenilir?**
8. **Ayrıntı ve geçmiş nerede?**

Oyuncu her ekranda farklı bir UI dili öğrenmek zorunda kalmaz.

### Veriyi tabloya boğmadan gösterme

Veri gizlenmez; kademeli açılır:

**Birinci katman — karar özeti**

- En önemli 3–5 sinyal
- Yön: yükseliyor/düşüyor/sabit
- Son değişimin ana nedeni
- Aciliyet ve zaman sınırı
- Kullanılabilir ana eylemler

**İkinci katman — görsel inceleme**

- Kısa zaman grafikleri
- Kaynak akışları
- İlişki ağları
- Bölgesel dağılım
- Neden-sonuç zinciri
- Karşılaştırmalı çubuklar

**Üçüncü katman — uzman/denetim görünümü**

- Tam tablo
- Formül ve kaynak dökümü
- Olay kimlikleri
- Sözleşme maddeleri
- Ham fakat oyuncunun bildiği veriler

Tablolar yasak değildir. Varsayılan ekran değildir; ayrıntılı karar vermek isteyen oyuncu için güvenilir son katmandır.

### Ortak UI bileşenleri

| Bileşen | Görevi |
|---|---|
| Durum sinyali | Bir alanın mevcut durumunu ve yönünü özetler |
| Değişim rozeti | Son ziyaretten beri farkı gösterir |
| Güven rozeti | Bilginin kesinlik/kaynak seviyesini gösterir |
| Neden etiketi | Değeri etkileyen ana olaya gider |
| Aktör kartı | Karakterin rolü, erişimi ve oyuncuyla ilişkisini gösterir |
| Eylem kartı | Yetki, maliyet, süre, şart ve risk gösterir |
| Teklif kartı | Müzakerenin güncel sürümünü ve açık şartlarını gösterir |
| Söz/borç kartı | Kimin, neyi, ne zamana kadar vaat ettiğini gösterir |
| Akış kartı | Kaynağın nereden nereye, hangi kapasiteyle gittiğini gösterir |
| Kriz göstergesi | Şiddet, yayılım, eşik ve erken belirtileri gösterir |
| Olay izi | Sonuçtan kök olaya kadar nedensel bağlantı açar |

Renk tek iletişim kanalı değildir; ikon, metin, desen ve yön işareti birlikte kullanılır.

---

### ŞEHRE GİR çalışma alanı

Oyuncu haritada bir şehri seçip **ŞEHRE GİR** dediğinde yalnız dekoratif şehir resmi veya birkaç kaynak sayısı görmez. Şehir, ilgili bütün dünya katmanlarının ortak bağlamıdır.

#### Şehir üst özeti

- Şehir adı, sahibi, yönetici ve oyuncunun şehirdeki yetkisi
- Nüfus ve son dönem değişimi
- Refah, güvenlik, kamuoyu ve devlet denetimi
- Ana üretim uzmanlığı
- Kritik stok ve lojistik durumu
- Aktif kriz/grev/kuşatma/göç
- Bilgilerin son doğrulanma zamanı

#### “Son gelişmeler” şeridi

- Son ziyaretten beri en önemli beş değişiklik
- Her değişiklik için kısa neden
- Oyuncunun önceki kararlarıyla bağlantı
- Süresi yaklaşan söz veya görev

#### Şehir sekmeleri

1. **GENEL**
   - Şehrin 3–5 ana sinyali
   - Öne çıkan sorun/fırsat
   - Bölgesel mini harita
   - Hızlı eylemler

2. **HALK**
   - Nüfus kohortları
   - İş, gelir, ihtiyaç ve göç
   - Destek, şikâyet ve radikalleşme
   - Kesin olmayan verilerde güven seviyesi

3. **EKONOMİ**
   - Sektörler ve üretim zincirleri
   - Şirketler ve tesisler
   - Fiyatlar, ücretler, stoklar
   - Darboğaz ve yatırım fırsatları

4. **LOJİSTİK**
   - Kara/deniz/enerji bağlantıları
   - Gelen ve giden sevkiyatlar
   - Depolar ve kapasiteler
   - Kesinti, gecikme ve rota riskleri

5. **YÖNETİM**
   - Vali/belediye/yerel kurumlar
   - Yerel bütçe ve kapasite
   - Güç merkezleri
   - Aktif kararlar ve bekleyen onaylar

6. **GÜVENLİK**
   - Garnizon, polis, milis ve kontrol
   - Bilinen tehditler
   - Protesto, suç, sabotaj ve kuşatma
   - Bilginin kaynağı ve yaşı

7. **KARAKTERLER**
   - Şehirde bulunan veya erişilebilen kişiler
   - Görevleri, oyuncuyla ilişkileri
   - Görüşme müsaitliği
   - Neden konuşmak isteyebilecekleri

8. **TARİH**
   - Şehirdeki önemli olaylar
   - Sahiplik değişimleri
   - Savaşlar, krizler ve kalıcı izler
   - Oyuncunun şehir üzerindeki geçmiş kararları

#### Şehir eylemleri

Şehir ekranı eylemleri oyuncunun yetkisine göre üretir:

- ziyaret et/görüşme talep et,
- yatırım veya inceleme öner,
- garnizon/ikmal talep et,
- şirket kurma başlat,
- yerel yönetime talimat ver,
- konsey gündemine taşı,
- soruşturma açılmasını iste,
- sevkiyat veya sözleşme incele,
- şehri izleme listesine ekle.

Oyuncu komutansa vergi oranını doğrudan değiştiremez; ilgili yetkiliyle görüşme veya konsey önerisi açabilir.

---

### YÖNETİME GİR çalışma alanı

Yönetim ekranı devletin bütün sayılarının döküldüğü tablo değildir. “Kim karar veriyor, hangi sorun masada ve oyuncunun gerçek yetkisi ne?” sorularını cevaplar.

#### Yönetim ana görünümü

- Oyuncunun makamı, yasal ve gayriresmî yetkisi
- Cumhurbaşkanı/başbakan ve kabine
- Güncel yönetim gündemi
- Bekleyen karar ve onaylar
- Meşruiyet, devlet kapasitesi ve istikrar
- Kritik bütçe/borç durumu
- Aktif koalisyon, muhalefet ve güç merkezleri
- Verilmiş devlet taahhütleri

#### Yönetim bölümleri

1. **GÜNDEM** — sıradaki kararlar, son tarih, destek/itiraz
2. **KABİNE & KURUMLAR** — görev, yetki, performans, ilişki
3. **KANUNLAR** — yürürlükteki kurallar, öneriler, uygulama kapasitesi
4. **BÜTÇE** — gelir/gider özeti, açık, borç ve ayrıntılı tablo
5. **GÜÇ MERKEZLERİ** — ordu, iş dünyası, sendika, bürokrasi, medya
6. **ATAMALAR** — açık makamlar, adaylar, destek ve risk
7. **SÖZLER & YÜKÜMLÜLÜKLER** — iç ve dış taahhütler
8. **SORUŞTURMALAR** — yolsuzluk, sızıntı, ihlal ve kanıt durumu

#### Karar sunumu

Her yüksek etkili karar kartı:

- kararı kimin verebildiğini,
- oyuncunun rolünü,
- gereken destek/oy/onayı,
- bilinen maliyetleri,
- tahmini etkileri ve belirsizliği,
- karşı çıkan aktörleri,
- geri alınabilirliği,
- yürürlüğe girme süresini

gösterir.

---

### SOHBETE GİR çalışma alanı

Sohbet ekranı yalnız karakter portresi ve mesaj kutusu değildir. Oyuncunun kiminle neden konuşabileceğini, ne bildiğini ve görüşmenin hangi gerçek konu üzerinde sürdüğünü gösterir.

#### Konuşulabilir karakter dizini

Karakterler şu gruplarla bulunabilir:

- bulunduğum şehirdekiler,
- hükümet/kabine,
- komutanlar,
- şirket yöneticileri,
- sendika ve toplum liderleri,
- gazeteciler,
- yabancı elçiler,
- mevcut krizle ilgili kişiler,
- bana ulaşmak isteyenler.

Her karakter kartı:

- adı, makamı ve bulunduğu yer,
- oyuncuyla bilinen ilişki,
- erişim: hemen / randevu / aracı gerekir / reddediyor,
- son görüşme,
- açık görüşme konusu,
- bekleyen söz/teklif,
- oyuncunun neden onunla konuşmak isteyebileceğine dair bağlamsal ipucu

gösterir.

Oyuncuya karakterin gizli amacı veya gerçek sadakati açıkça verilmez. Yalnız öğrenilmiş, gözlenmiş veya tahmin edilmiş bilgiler gösterilir.

#### Aktif sohbet düzeni

```text
┌──────────────────────┬───────────────────────────┬──────────────────────┐
│ Karakter dosyası     │ Konuşma                   │ Görüşme bağlamı       │
│ makam/ilişki/erişim  │ mesajlar + serbest giriş  │ konu, sözler, teklifler│
│ bilinen son olaylar  │                           │ bilinen kanıtlar      │
├──────────────────────┴───────────────────────────┴──────────────────────┤
│ Güncel teklif kartı │ Karşı teklif oluştur │ Kabul/ret/teyit iste     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Sohbet bağlam paneli

- Açık konu ve alt konular
- Güncel teklif sürümü
- Çözülmemiş şartlar
- Oyuncunun sunabileceği bilinen kanıtlar
- Verilmiş sözler ve son tarihler
- Karakterin oyuncuya yönelttiği sorular
- Görüşmenin tahmini oyun içi zaman maliyeti
- Bilginin gizlilik seviyesi

#### Serbest metin ve yardımcı kontroller

- Oyuncu serbest metin yazar.
- İsteğe bağlı niyet kısayolları “teklif”, “kanıt sun”, “tehdit”, “konuyu değiştir” gibi yardımcıdır; sabit cevap ağacı değildir.
- UI oyuncunun cümlesini göndermeden önce anlamını değiştirmez.
- Sistem yüksek etkili belirsizlik bulursa karakter doğal teyit sorusu sorar.
- Dünya etkisi yaratacak anlaşma yalnız replik içinde kaybolmaz; doğrulanmış teklif kartına dönüşür.

#### Teklif kartı ve onay

```text
TEKLİF SÜRÜMÜ 4
────────────────────────────────
Çelik sevkiyatının %40'ı oyuncu deposuna
Devlet ön alım hakkı: %15 / 5 yıl
Gerekenler:
  □ Şirket kaydı
  □ Depo kapasite onayı
  □ Kurul kararı
Bilinen risk:
  Demiryolu projesinde gecikme
Güven düzeyi:
  Miktar kesin / teslim tarihi tahmini
────────────────────────────────
[KARŞI TEKLİF] [KABUL ET] [REDDET]
```

Kabul düğmesi LLM metnini değil, gösterilen teklif sürümünü kabul eder. Oyuncu kabulden önce maddeleri okuyabilir. Geri alınamaz veya yüksek etkili kabulde açık onay gerekir.

---

### EKONOMİ ve ŞİRKET çalışma alanları

#### Ekonomi

- Enflasyon, istihdam, bütçe ve ticaret için özet sinyaller
- Kaynakların nerede üretildiğini ve tüketildiğini gösteren akış
- Fiyat değişiminin ana nedenleri
- Darboğaz ve kritik bağımlılıklar
- Oyuncunun yetkili olduğu yatırım/politika yolları
- Uzman görünümde tam sektör ve fiyat tabloları

#### Şirket

- Mülkiyet ve ortaklar
- CEO/yönetim karakterleri
- Nakit, borç ve kârlılık
- Tesis, depo ve sözleşmeler
- Çalışanlar ve sendika ilişkisi
- Devlet bağlantıları ve soruşturmalar
- Bekleyen ticari görüşmeler
- Kuruluş, yatırım, ortaklık, satın alma veya tasfiye eylemleri

---

### DIŞ İLİŞKİLER ve İSTİHBARAT çalışma alanları

#### Devlet dosyası

- Resmî ilişki değil çok boyutlu güven/tehdit/bağımlılık
- Bilinen liderler ve karar vericiler
- Antlaşmalar ve açık yükümlülükler
- Ticaret ve enerji bağımlılığı
- Bilinen askerî durum
- Son diplomatik olaylar
- Erişilebilir elçiler ve görüşme konuları

#### İstihbarat görünümü

- Bilginin kaynağı, yaşı ve güveni
- Birbirini destekleyen/çürüten raporlar
- Bilinmeyen alanlar
- Yanlış bilgi ihtimali
- Yeni keşif veya doğrulama eylemleri

İstihbarat ekranı gerçeği gösteren geliştirici paneli değildir.

---

### ORDU ve LOJİSTİK çalışma alanları

- Kuvvetler ve gerçek birlik kimlikleri
- Hazırlık, moral, personel ve ekipman
- Komutanlar ve emir zinciri
- İkmal kaynakları ve hatları
- Mühimmat/enerji dayanma süresi
- Cephe tehditleri ve bilgi güveni
- Seferberlik ve takviye süreleri
- Savaş öncesi manifestoya giden kaynaklar

Oyuncu stratejik ekranda bir ordunun neden hazır olmadığını görebilir; fakat savaş içi gizli düşman bilgisi açılmaz.

---

### TOPLUM & MEDYA çalışma alanı

- Nüfus kohortları ve ana ihtiyaçlar
- Fraksiyonlar/güç merkezleri
- Refah, güvenlik ve şikâyet eğilimleri
- Grev/protesto/radikalleşme erken belirtileri
- Haber kuruluşları, erişim ve güvenilirlik
- Gerçek olay, yayımlanan iddia ve halk inancı ayrımı
- Oyuncunun açıklama, görüşme, soruşturma veya propaganda eylemleri

---

### KRİZ MASASI

Kriz masası her küçük uyarı için açılmaz. En az üç katmanı veya birden fazla bölge/aktörü etkileyen aktif krizleri toplar.

Her kriz dosyası:

- mevcut şiddet ve yayılım,
- kök nedenler,
- bilinen ve bilinmeyenler,
- etkilenen şehir/kurum/karakterler,
- yaklaşan eşikler,
- alınmış kararlar,
- bekleyen söz ve onaylar,
- danışman görüşleri,
- askerî ve barışçıl seçenekler,
- sonuç geçmişi

gösterir.

Enerji krizi örneğinde oyuncu buradan şehre, bakanla sohbete, ticaret sözleşmesine, boru hattına veya askerî hazırlığa geçebilir.

---

### TARİH, SÖZLER ve NEDENSELLİK

Oyuncu yalnız olay listesini değil sonuçların bağını görebilir:

```text
Britanya çelik sevkiyatı yönlendirildi
→ demiryolu projesi gecikti
→ sınır ikmali düştü
→ komutan güveni azaldı
→ savunma kurulunda oyuncuya muhalefet arttı
```

Tarih ekranı:

- kampanya kronolojisi,
- şehir/devlet/karakter filtreleri,
- kalıcı dünya izleri,
- verilen ve bozulan sözler,
- savaş sonuçları,
- lider dönemleri,
- “bu neden oldu?” olay izi

sunmalıdır.

Oyuncunun bilmediği gizli kök nedenler açıklanmaz; “bilinmeyen etken” olarak kalır ve daha sonra keşfedilebilir.

---

### Bağlamsal geçişler

Arayüzde aynı varlığın adı yalnız metin değildir; uygun dosyaya geçiş noktasıdır:

- Haber içindeki şehir → **ŞEHRE GİR**
- Şehirdeki CEO → **KARAKTER DOSYASI / SOHBET**
- Sohbetteki sevkiyat → **LOJİSTİK KAYDI**
- Teklifteki şirket → **ŞİRKET DOSYASI**
- Krizdeki antlaşma → **ANTLAŞMA MADDESİ**
- Ordu ikmal sorunu → **DEPO/ROTA**
- Bütçe açığının nedeni → **İLGİLİ KARAR/OLAY**

Oyuncu bilgiye menü ezberleyerek değil, bağlamı takip ederek ilerleyebilir.

### Arama ve komut erişimi

Evrensel arama:

- şehir,
- karakter,
- şirket,
- devlet,
- ordu,
- antlaşma,
- olay,
- söz/teklif

bulabilir.

Arama sonucu yalnız oyuncunun bildiği varlıkları ve izin verilen özetleri gösterir.

Komut paleti “Şehre git”, “X karakteriyle konuş”, “aktif sözleri göster” gibi navigasyon sağlar; dünya emrini doğrulama olmadan çalıştırmaz.

### UI durumu ile dünya durumunun ayrılması

UI’ye ait:

- açık panel,
- seçili sekme,
- kamera,
- filtre,
- kaydırma,
- sabitlenmiş kart,
- taslak fakat gönderilmemiş oyuncu metni

dünya durumuna yazılmaz.

Dünyaya ait:

- kabul edilmiş teklif,
- verilmiş söz,
- gönderilmiş emir,
- başlanmış soruşturma,
- harcanmış kaynak,
- yapılmış görüşme ve zaman maliyeti

olay/komut hattından geçer.

### Rol ve yetkiye göre arayüz

Aynı ekran farklı rolde farklı eylem sunabilir:

- Komutan bütçeyi görür fakat yalnız askerî talep oluşturabilir.
- Cumhurbaşkanı bütçe değişikliği önerebilir veya onaylayabilir.
- Şirket sahibi yatırım ve sözleşme yapabilir fakat devlet sevkiyatını tek başına değiştiremez.
- Gayriresmî güç odağı yetkili karakterle görüşüp destek arayabilir.

Kilitli eylem yalnız gri düğme değildir:

- gereken makam,
- eksik onay,
- yetersiz bilgi,
- gerekli karakter erişimi,
- alternatif yasal/gayriresmî yol

gösterilir.

### Bildirim ve dikkat bütçesi

- Kritik: süreli ve geri döndürülemez tehdit
- Yüksek: oyuncu kararı veya onayı bekleyen konu
- Orta: anlamlı durum değişikliği
- Düşük: arşivlenebilir bilgi

Aynı kök nedenden gelen bildirimler gruplanır. Her ekonomik tik için ayrı uyarı çıkmaz. Oyuncu “neden?” üzerinden toplu olay zincirine gidebilir.

### Erişilebilirlik ve okunabilirlik

- Renk tek başına anlam taşımaz.
- Font ölçekleme ve yüksek kontrast desteklenir.
- Klavye ile ana navigasyon ve sohbet kullanılabilir.
- Grafiklerin metinsel özeti bulunur.
- Büyük sayılar birim ve zaman aralığıyla gösterilir.
- Yüzde değişimi ile mutlak değer karıştırılmaz.
- Tahmin aralıkları ve bilinmeyen değerler açık etiketlenir.
- Animasyonlar bilgi okumayı geciktirmez; azaltılmış hareket seçeneği bulunur.

### UI tanım-of-done

Bir dünya sistemi UI açısından tamamlanmış sayılmak için:

- en az bir özet görünüm,
- en az bir ayrıntı görünümü,
- oyuncu bilgi filtresi,
- değişim ve neden göstergesi,
- yetkiye uygun eylem girişi,
- bilinmeyen/eski/şüpheli bilgi durumu,
- kayıt/yükleme sonrası doğru görünüm,
- klavye ve ölçeklenebilir metin testi

taşımalıdır.

---

## 9B. Hikâye Haritası Raster, Overlay ve Render Borcu

Bu bölüm aktif `js/StoryRender.js`, `index.html` ve kök `README.md` üzerinde yapılan kod denetimine dayanır. Harita arayüzünün bilgi mimarisi doğru olsa bile taban arazi, siyasi katman ve warp hattı teknik olarak tutarsız kalırsa oyuncunun gördüğü dünya güvenilmez ve yavaş olur.

### Denetim özeti

| No | Bulgu | Durum |
|---:|---|---|
| 1 | Arazi ve siyasi overlay yaklaşık 4,5–5× farklı raster çözünürlüğünde | Doğrulandı |
| 2 | Arazi ve politik grid `GEO.land` verisini ayrı scanline geçişleriyle rasterize ediyor | Doğrulandı |
| 3 | Owner overlay hücre başına `fillRect(1×1)` kullanıyor | Doğrulandı |
| 4 | Bölge ataması her kara hücresinde bütün şehirleri tarayan naif Voronoi | Doğrulandı |
| 5 | `band=3` ile 1080p’de iki katman için yaklaşık 720 `drawImage`; döngü içinde sessiz `try/catch` | Doğrulandı |
| 6 | `_landGrid` yenilenirken `_geoTerrain` geçersiz kılınmıyor | Doğrulandı |
| 7 | README, aktif olmayan `js/StoryGeoRender.js` ve 4500 dünya genişliği tarif ediyor; aktif kod `StoryRender.js` ve 3000 kullanıyor | Doğrulandı |
| 8 | Kök `StoryGeoRender.js` bağımsız prototip; `index.html` tarafından yüklenmiyor | Doğrulandı |
| 9 | `MapData.v2.js` / `js/mapDataV2.js` ikiz dosya iddiası | Bu checkout’ta iki dosya bulunamadı; paket/geçmiş artefakt denetimine alınacak |

### Mevcut çözünürlük uyuşmazlığı

Aktif geo arazi tamponu:

```text
GEO.W = 1500
S = 0.9
terrain width ≈ 1350
```

Politik kara/bölge grid’i:

```text
STORY_GW = 300
STORY_GH ≈ 236
```

Politik katman `imageSmoothingEnabled = false` altında dünya yüzeyine büyütülüyor. Sonuç:

- hillshade ve rölyef üzerinde basamaklı sınırlar,
- ince kıyı ve adalarda kaba politik renk,
- zoom değişiminde farklı görsel doku yoğunluğu,
- arazi kalitesinin siyasi katman tarafından bozulması.

### Tek kanonik kara maskesi değişmezi

`GEO.land` yalnız bir kez rasterize edilir:

```text
GEO.land
→ CanonicalLandMask
├── TerrainRaster
├── RegionIdRaster
├── OwnerOverlay
├── CoastlineMesh
└── HitTestMask
```

Kurallar:

- Arazi ve siyasi katman bağımsız scanline çalıştıramaz.
- Kanonik maskenin çözünürlüğü tek sabitte tutulur; hedef donanım ölçümüne göre en az mevcut arazi ihtiyacını karşılar.
- Daha düşük çözünürlüklü katman gerekiyorsa yalnız kanonik maskeden deterministik downsample edilir.
- Downsample kara/deniz eşiği, ince ada ve kıyı koruma kuralı testle sabitlenir.
- Terrain, owner overlay, kıyı çizgisi ve hit-test aynı kara/deniz sınıflandırmasını kullanır.
- Kıyı uyuşmazlığı debug görünümünde piksel sayısıyla ölçülür.
- Kanonik maske sürümü kayıt verisi değildir; harita varlığı ve render cache sürümüdür.

### Raster çözünürlüğü ile mantıksal dünya boyutunu ayırma

`STORY_WORLD_W` hem kamera/mantıksal koordinat hem görsel ölçek kararı gibi kullanılmamalıdır.

Önerilen ayrım:

```text
STORY_LOGICAL_WORLD_W/H
STORY_MAP_RASTER_W/H
STORY_CANONICAL_MASK_W/H
```

README’deki 4500 ve aktif koddaki 3000 farkı ölçüm yapılmadan birine körlemesine çevrilmez. Karar:

- kamera gezinme,
- tıklama doğruluğu,
- etiket yoğunluğu,
- zoom aralığı,
- raster bellek maliyeti

testleriyle verilir. Seçilen değer tek kaynakta tanımlanır ve README güncellenir.

### Owner overlay’i `ImageData` hattına taşıma

Mevcut yaklaşık 70.800 hücrelik `fillRect` döngüsü kaldırılır.

Yeni hat:

1. `RegionIdRaster` ve devlet renk paleti alınır.
2. Typed array içinde owner kimliği → RGBA eşlemesi yapılır.
3. Sınır maskesi komşu owner farkından ayrı typed array olarak üretilir.
4. İç tint ve sınır alfa değerleri doğrudan piksel tamponuna yazılır.
5. Tek `putImageData` ile overlay canvas güncellenir.
6. Sahiplik değişmediği sürece yeniden oluşturulmaz.

Fetihte bütün haritayı yeniden boyamak ilk güvenli sürüm olabilir; daha sonra değişen owner/bölge bounding-box’ları üzerinden kirli dikdörtgen güncellemesi ölçülür. Karmaşıklık, ölçüm olmadan eklenmez.

### Bölge ataması optimizasyonu

Naif maliyet:

```text
kara hücresi sayısı × şehir sayısı
```

Tercih sırası:

1. Harita ve şehir düğümleri statikse `RegionIdRaster` build aşamasında önceden üret ve varlık olarak paketle.
2. Runtime üretim gerekirse Web Worker/iş parçacığı dışında jump-flood veya uzamsal indeks kullan.
3. Basit fallback yalnız küçük test grid’inde naif tarama kullanabilir.

Önceden üretilen raster:

- GEO sürümü,
- şehir düğümü sürümü,
- çözünürlük,
- üretici algoritma sürümü,
- checksum

taşır. Uyuşmazlıkta sessizce yanlış harita açılmaz.

### Warp render maliyeti

Mevcut `storyBlitWarp`:

- sabit `band=3`,
- 1080p’de katman başına yaklaşık 360 şerit,
- terrain + overlay için yaklaşık 720 `drawImage`,
- her şeritte `try/catch`

üretir.

İyileştirme sırası:

1. Kaynak ve hedef dikdörtgenlerini döngüden önce doğrula.
2. Döngü içi `try/catch` kaldır; geliştirme yapısında hata görünür olsun, sürüm yapısında bir kez raporlansın.
3. Band yüksekliğini zoom, ekran yüksekliği ve perspektif eğrisine göre 4–8 aralığında adaptif seç.
4. Kaynak koordinatları ve perspektif katsayılarını ekran/zoom değişene kadar önbellekle.
5. Canvas fallback’in görüntü farkı ve kare süresi bütçesini ölç.
6. Hedef sağlanmazsa arazi ve overlay’i aynı textured mesh üzerinde çizen WebGL/tek mesh yoluna geç.

Tek `drawImage` veya tek CSS matrisi mevcut doğrusal olmayan dikey warp’ı birebir temsil etmeyebilir. Yalnız görsel karşılaştırma kabulünü geçerse kullanılabilir.

### Cache invalidation sözleşmesi

Dağınık `null` atamaları yerine:

```text
storyInvalidateMapCaches({
  landMask,
  regionRaster,
  terrain,
  ownerOverlay,
  coastline,
  hitTest,
  reason
})
```

kullanılır.

Örnek cache anahtarları:

```text
terrainKey =
  geoVersion + rasterResolution + eraId + paletteId + terrainStyleVersion

ownerKey =
  regionRasterVersion + ownerRevision + politicalPaletteVersion
```

Kurallar:

- Çağ/palet araziyi etkiliyorsa `_geoTerrain` geçersiz kılınır.
- Sahiplik değişimi yalnız owner overlay ve ilgili sınırları geçersiz kılar.
- Kamera hareketi raster cache’i geçersiz kılmaz.
- Çözünürlük değişimi bütün boyuta bağlı cache’leri yeniler.
- Cache nedeni debug telemetrisine yazılır.
- Aynı cache aynı karede iki kez üretilmez.

### Dokümantasyon ve ölü kod

Aktif yükleme kaynağı `index.html` olmalıdır:

- `index.html` yalnız `js/StoryRender.js` yüklüyor.
- README’nin `js/StoryGeoRender.js` ekleme talimatı mevcut kodla uyumsuz.
- Kök `StoryGeoRender.js`, kendi state/render/panel akışı olan bağımsız prototiptir ve aktif oyun dosyası değildir.
- 3000/4500 dünya genişliği tek karara bağlanmalıdır.

Temizlik planı:

1. Aktif render dosyası ve sahiplik sınırı belgelenir.
2. Prototipte aktif kodda bulunmayan yararlı teknikler karşılaştırılır.
3. Gerekli parçalar testle aktif modüle taşınır.
4. Prototip arşivlenir veya kaldırılır; aktif kaynak gibi kökte bırakılmaz.
5. README gerçek script sırası, boyutlar, cache ve render katmanlarıyla yeniden yazılır.
6. Paketleme denetimi aynı harita verisinin farklı adlarla iki kez taşınmasını raporlar.
7. Script referans testi README/index/dosya sistemindeki uyuşmazlığı CI’da yakalar.

### Görsel ve performans kabul kapıları

- Terrain ve politik katman kara/deniz sınıflandırma farkı: sıfır piksel veya belgelenmiş downsample istisnası.
- Politik tint denize taşmıyor; renksiz kara şeridi oluşmuyor.
- İnce adalar ve kıyı girintileri belirlenen zoom bandında korunuyor.
- Overlay sınırları hillshade üzerinde merdiven etkisiyle baskınlaşmıyor.
- Owner overlay yeniden üretimi `fillRect` sürümüne göre ölçülebilir büyük hızlanma sağlıyor; hedef bant Faz 0 ölçümünden sonra sabitleniyor.
- Açılış `RegionIdRaster` üretimi ana thread’de hissedilir donma oluşturmuyor.
- 1080p hedef cihazda harita render p95 kare bütçesini geçmiyor.
- Render döngüsünde sessiz hata yutan `try/catch` bulunmuyor.
- Çağ/palet değişikliği sonrası terrain görsel karması değişiyor.
- Yalnız sahiplik değişiminde terrain cache gereksiz yeniden üretilmiyor.
- README, `index.html` ve gerçek dosya yapısı aynı aktif render mimarisini tarif ediyor.

---

## 9C. Mevcut Dünya Kod Denetimi ve Oyun-Fix Kabul Kapıları

Bu bölüm gelecek mimarinin soyut isteği değildir; mevcut çalışan hikâye modu için geçerlidir. Kodda karşılığı olmayan güvence, tamamlanmış sayılmaz. Her madde düzeltme yapılmadan önce referans koşu ile ölçülmeli, düzeltme sonrası aynı koşuda tekrar doğrulanmalıdır.

### K3 — Hikâye test laboratuvarı yok

Belge “her aşama jsdom tezgâhıyla ölçülür, 8 devlet × 900 sn deseni” diyorsa bunun çalışan bir karşılığı olmalıdır. Mevcut durumda `package.json` içinde test script’i yoktur; `tools/` altında hikâye simülasyonu test aracı değil, üretim yardımcıları bulunur; kökteki `test.js` bir test paketi gibi davranmaz ve kampanya döngüsünü assertion ile doğrulamaz. `jsdom` bağımlılığı bulunması tek başına test güvencesi değildir.

Bu durum planın en tehlikeli açığıdır. Çünkü dengeyi bozan değişiklikler ancak elle oynanırsa görülür; elle görülmeyen bir sonraki kırılma otomatik yakalanmaz.

**Fix kapısı:**

- `npm test` veya eşdeğer açık script eklenir.
- Headless hikâye koşucusu UI açmadan 8 devlet × 900 sn çalıştırır.
- Koşu sonunda dünya sağlık özeti, olay sayıları, refah/enflasyon/huzursuzluk eğrisi, savaş sayısı, ekonomi taşması ve state hash üretir.
- En az bir assertion paketi bulunur; “çalıştı ve kapandı” test kabul edilmez.
- Sabit tohum tekrarında aynı hash üretilir; farklı tohumda kontrollü fark üretilir.
- Test raporu dosyası Faz 0 referans ölçümüyle kıyaslanabilir olmalıdır.

### K4 — `st.welfare` merkezsiz ve sahipsiz

Refah şu an ekonomi, fraksiyon, konsey, haber ve savaş sonucu gibi birçok katmanın ortak yazdığı bir çıktı kanalıdır. Kodda doğrudan refah yazan noktalar dağınıktır; özellikle sürekli akan iki tick gideri sistemi ezme riski taşır:

```js
// Economy.js: yüksek enflasyon refahı sürekli düşürür
st.welfare = Math.max(0, st.welfare - (st.inflation - 14) * 0.003 * dt);

// Factions.js: yüksek huzursuzluk refahı sürekli düşürür
st.welfare = Math.max(0, st.welfare - (unr - 18) * 0.004 * dt);
```

Sorun yalnız sayı büyüklüğü değildir. Enflasyon ve huzursuzluk çoğunlukla aynı kök olaydan, özellikle savaştan yükselir. İki ayrı katman bağımsız bedel yazdığını sanır; sistem seviyesinde aynı şok çift sayılır. Savaşta enflasyon ve huzursuzluk birlikte yükseldiğinde refah birkaç dakika içinde sıfıra akar; konsey kararları, haber etkileri ve fetih bonusları oyuncuya hissedilir karşı ağırlık veremez.

**Fix kapısı:**

- Hiçbir sistem `st.welfare` alanını doğrudan yazmaz.
- Tüm refah etkileri `storyWelfareDelta(stateId, source, amount, meta)` veya aynı işlevde tek kapıdan geçer.
- Kapı tick başına toplam negatif refah değişimini sınırlar.
- Aynı kök olaydan gelen korele etkiler `correlationId` ile gruplanır; savaş kaynaklı enflasyon ve huzursuzluk ayrı katman olsa bile çift ceza gibi davranamaz.
- Son N katkı kaynak etiketiyle saklanır.
- UI “refah neden düştü?” sorusuna kaynak, miktar, kök olay ve süreyle cevap verir.
- Soak testte refahın sıfıra düşmesi yasak değildir; fakat düşüşün tek kapıdan açıklanabilir ve tavanlı olması zorunludur.

### K1 — Faz durumu koda göre işaretlenmeli

Belgede yazan faz ile kodun gerçekten yaptığı iş ayrı tutulmalıdır. Mevcut çalışan dünyada bazı erken katmanlar stub değildir: karakter eksenleri, fraksiyon huzursuzluğu/grev, makroekonomi, konsey kararları, haber günlüğü ve savaş sonucu köprüsü gerçek kod yoluna sahiptir. Buna karşılık şirketler/oligarklar, geniş hafıza ve kara kuğu sistemi henüz tam sistem değildir. `oligark` bir persona etiketi olarak geçebilir; bu, şirket/oligark ekonomisi uygulandı demek değildir.

Medya katmanı da dikkatli işaretlenmelidir. Haber üretimi vardır, ama yanlılık, dezenformasyon, medya kuruluşu sahipliği ve bilgi savaşı henüz gerçek mekanik genişlikte değildir. Bu yüzden “LLM’in yeni evi medya” cümlesi mevcut kod için fazla iddialıdır.

**Fix kapısı:**

- Her faz için `implemented`, `partial`, `stub`, `missing` durumu ayrı tutulur.
- Faz durumu dosya varlığına göre değil, çalışan kabul testi ve oyuncuya görünür mekanik etkiye göre verilir.
- “Kara kuğu”, “şirket”, “oligark”, “medya yanlılığı” gibi terimler için kod arama yeterli sayılmaz; veri modeli, tick etkisi, UI görünümü ve test gerekir.
- Belge içinde tamamlanmış görünen ama testle kanıtlanmayan fazlar otomatik olarak `partial` sayılır.

### K2 — LLM sözleşmesi korunacak iyi temel

LLM katmanı mevcut kodda doğru yönde kurulmuş nadir sağlam parçalardan biridir. `LLM.js`, `Chatter.js` ve `News.js` hattında metin zenginleştirme doğrulayıcıdan geçer; sayılar ve dünya etkileri LLM’den gelmez. Şablon önce basılır, LLM yetişirse metni zenginleştirir, geçersiz çıktı şablona düşer.

Bu korunmalıdır. Gelecek sohbet ve diplomasi sistemleri bu sözleşmeyi bozarsa sistem daha zeki değil, daha kırılgan olur.

**Fix kapısı:**

- LLM doğrudan kaynak, refah, hasar, ilişki veya dünya olayı yazamaz.
- LLM çıktısı daima doğrulayıcıdan geçer.
- Geçersiz/boş/yavaş LLM cevabı deterministik yedek akışı bozmaz.
- Serbest oyuncu metni dünya komutu değildir; önce niyet, yetki, aday eylem ve onay kartına dönüşür.
- LLM entegrasyonu genişletilirken mevcut “sayı motorda, metin modelde” ilkesi regresyon testiyle korunur.

### K5 — Tick bütçesi iyi, kalıcılık dağınık

Mevcut zamanlayıcıda katmanların farklı aralıklara yayılması doğru bir karar: her sistem aynı karede patlamıyor. Bu korunacak bir davranıştır.

Kalıcılık tarafında ise yeni alanların `states` içinde kendiliğinden serileşmesi yalnız kısa vadeli rahatlıktır. `inflation`, fraksiyon onayları ve benzeri alanlar `== null` backfill’leriyle dağınık biçimde tamamlanıyor. Faz 6-7 ve sonrası geldiğinde bu yöntem veri anlamı değiştikçe kırılır.

**Fix kapısı:**

- Kayıt şeması açık `schemaVersion` ile okunur ve yazılır.
- Backfill tek tek modüllere dağılmaz; merkezi migration/backfill hattı olur.
- Her yeni alan için varsayılan değer, birim, sınır ve hangi sürümde eklendiği veri sözlüğünde bulunur.
- Eski kayıt açıldığında migration raporu üretir.
- Migration başarısız olursa kayıt sessizce bozulmaz.
- Tick bütçesi için p50/p95/p99 sim adımı ve bellek eğimi test raporuna girer.

### K0 — Belge çıpaları satır numarasına bağlanamaz

Plan içindeki `Story.js:262`, `Council.js:572` gibi kesin satır referansları hızlı değişen kodda bozulur. Satır numarası çalışan spesifikasyon için çıpa olamaz; birkaç düzenlemeden sonra yanlış fonksiyonu gösterir ve geliştiriciyi yanlış yere yollar.

**Fix kapısı:**

- Belge satır numarası yerine fonksiyon, veri sözleşmesi, test adı ve dosya rolü kullanır.
- Satır numarası yalnız anlık denetim raporunda kullanılabilir; kalıcı plan maddesinde ana referans olamaz.
- Planın “mevcut kod karşılığı” tablosu aktif dosya ve fonksiyon adlarıyla güncellenir.
- CI veya basit belge denetimi, artık olmayan dosya/fonksiyon referanslarını raporlar.

### Bu denetimin ilk düzeltme sırası

1. `npm test` altında çalışan headless hikâye laboratuvarı.
2. 8 devlet × 900 sn referans senaryo ve deterministik hash.
3. Ham dünya sağlık raporu: refah, enflasyon, huzursuzluk, savaş, ekonomi ve olay defteri.
4. `storyWelfareDelta` tek kapısı ve doğrudan `st.welfare` yazımlarının aşamalı kaldırılması.
5. Refah katkı defteri ve UI “neden düştü?” açıklaması.
6. Faz durum tablosunun `implemented/partial/stub/missing` olarak güncellenmesi.
7. Merkezi kayıt migration/backfill hattı.
8. Belge çıpalarının fonksiyon/test/sözleşme adlarına taşınması.

Bu sekiz madde tamamlanmadan şirketler, kara kuğu, geniş medya savaşı veya daha karmaşık dünya AI’sine geçmek doğru değildir. Aksi hâlde üstüne kurulan her katman, ölçülmeyen ve sahiplenilmeyen refah kanalının üstünde oynar.

---

# 10. Uygulama Fazları

Her fazın kapanışında kod, test, kayıt göçü, telemetri ve oynanabilir yapı bulunmalıdır.

## DALGA A — Temel Güvenlik ve Ölçüm

### FAZ 0 — Mevcut Davranışın Dondurulması

**Amaç:** Bugünkü hikâye modunun gerçek davranışını referans almak.  
**Çıktı:** Sabit tohumlu başlangıç görüntüsü, 10/30/60 dakikalık durum kayıtları, savaş giriş/çıkış örnekleri.  
**Kabul kapısı:** Aynı yapı iki kez çalıştırıldığında karşılaştırılabilir rapor üretiyor; mevcut kritik akışlar belgelenmiş.  
**Bağımlılık:** Yok.

### FAZ 1 — Hikâye Test Laboratuvarı

**Amaç:** UI açmadan dünya simülasyonunu hızlandırılmış çalıştırmak.  
**Çıktı:** Headless çalıştırıcı, senaryo enjeksiyonu, durum dışa aktarma, değişmez kontrolü.  
**Kabul kapısı:** 30 oyun yılı otomatik koşu çökmüyor ve rapor dosyası üretiyor.  
**Bağımlılık:** Faz 0.

### FAZ 2 — Telemetri ve Dünya Sağlık Raporu

**Amaç:** Sahte gelişimi önleyecek ham veri kaydı.  
**Çıktı:** Kaynak akışları, kararlar, olaylar, savaşlar, LLM istekleri, performans ve durum karmaları.  
**Kabul kapısı:** Bir sonucu özet rapordan ham olay zincirine kadar izlemek mümkün.  
**Bağımlılık:** Faz 1.

### FAZ 3 — Özellik Bayrakları ve Karşılaştırma Modu

**Amaç:** Eski/yeni sistemleri aynı senaryoda karşılaştırmak.  
**Çıktı:** Katman bazlı bayraklar, A/B koşu aracı, otomatik fark raporu.  
**Kabul kapısı:** Yeni bir katman kapatıldığında eski oynanış güvenle devam ediyor.  
**Bağımlılık:** Faz 1–2.

### FAZ 3.1 — Yerel 8B Model Yeterlilik Tezgâhı

**Amaç:** Bütün sohbet mimarisini modele bağlamadan önce paketlenen yerel 8B modelin hedef donanımda görevleri gerçekten yapabildiğini ölçmek.  
**Çıktı:** Donanım profiline göre ilk token/toplam yanıt gecikmesi, bellek kullanımı, bağlam sınırı, Türkçe bozuk yazım anlama, varlık bağlama, JSON şema başarısı, karakter sesi ayrışması ve tekrar oranı raporu.  
**Kabul kapısı:** Kritik konuşma niyeti/varlık ayrıştırma ve şema testleri hedef bandı geçiyor; gecikme UX bütçesine sığıyor veya daha küçük bağlam/yedek model stratejisi tanımlanıyor. Model bu kapıyı geçmezse Faz 38 tasarımı modelin yapamayacağı varsayıma göre ilerlemiyor.  
**Bağımlılık:** Faz 1–3.

---

## DALGA B — Dünya Çekirdeği

### FAZ 4 — `StoryWorldStateV2` Şeması

**Amaç:** Tek ve sürümlü dünya durumu oluşturmak.  
**Çıktı:** Şema, varsayılanlar, kimlik kuralları, doğrulayıcı.  
**Kabul kapısı:** Eksik, bozuk ve fazla alanlar açıklamalı hata üretiyor.  
**Bağımlılık:** Faz 0.

### FAZ 4.1 — Oyuncu Bilgi Görünümü Sözleşmesi

**Amaç:** UI’nin ham dünya gerçeğini okumasını daha temelde engellemek.  
**Çıktı:** `PlayerKnowledgeService`, `PlayerVisibleFact`, güven/kaynak/zaman alanları ve görünürlük testleri.  
**Kabul kapısı:** Gizli dünya değeri UI view-modelinde bulunmuyor; bilinmeyen, tahmini, söylenti ve doğrulanmış bilgi ayrı üretiliyor.  
**Bağımlılık:** Faz 4.

### FAZ 5 — V3 Kayıt Göçü

**Amaç:** Mevcut `pixelrts_story_v3` kayıtlarını kontrollü taşımak.  
**Çıktı:** Tek yönlü göç, göç öncesi yedek, göç raporu.  
**Kabul kapısı:** Referans kayıtlar veri kaybetmeden açılıyor; başarısız göç eski kaydı bozmuyor.  
**Bağımlılık:** Faz 4.

### FAZ 6 — Deterministik Saat ve Takvim

**Amaç:** Gerçek saniye sayaçlarını oyun takvimine bağlamak.  
**Çıktı:** Sabit adım, hız seviyeleri, duraklatma, tarih dönüşümü.  
**Kabul kapısı:** Farklı FPS ve hız ayarlarında aynı kararlar aynı dünya karmasını üretiyor.  
**Bağımlılık:** Faz 4.

### FAZ 7 — Tohumlu Rastgelelik

**Amaç:** Meta katmandaki doğrudan `Math.random()` bağımlılığını kaldırmak.  
**Çıktı:** Alt sistem akışlarına ayrılmış RNG, RNG durum kaydı.  
**Kabul kapısı:** Kayıt/yükleme sonrası rastgele olay dizisi bozulmuyor.  
**Bağımlılık:** Faz 6.

### FAZ 8 — Sistem Zamanlayıcısı

**Amaç:** Dağınık `_acc...` sayaçlarını açık bir iş sırasına taşımak.  
**Çıktı:** Global/ülke/bölge/kriz görev kuyrukları.  
**Kabul kapısı:** Görev sırası testle sabit; aynı sistem bir adımda iki kez çalışmıyor.  
**Bağımlılık:** Faz 6–7.

### FAZ 9 — Olay Defteri ve Komut Hattı

**Amaç:** Bütün kalıcı değişiklikleri izlenebilir yapmak.  
**Çıktı:** `WorldCommand`, `WorldEvent`, `Effect`, korelasyon ve neden kimliği.  
**Kabul kapısı:** Büyük her değer değişiminin kaynak olayı bulunabiliyor.  
**Bağımlılık:** Faz 4, 8.

### FAZ 10 — Değişmezler ve Zincir Sigortası

**Amaç:** Ekonomik/politik zincirlerin kontrolden çıkmasını engellemek.  
**Çıktı:** Sınırlar, korunum kontrolleri, olay derinliği ve günlük olay bütçesi.  
**Kabul kapısı:** Kasıtlı döngü enjeksiyonu oyunu kilitlemeden durduruluyor ve raporlanıyor.  
**Bağımlılık:** Faz 9.

### FAZ 10.1 — UI Projeksiyon ve Nedensellik Test Tezgâhı

**Amaç:** Her sistemin oyuncuya dönük özet/ayrıntı görünümünü ve “neden değişti?” bağlantısını otomatik doğrulamak.  
**Çıktı:** Domain view-model fikstürleri, gizli bilgi sızıntısı testi, değişim rozeti ve olay izi doğrulayıcı.  
**Kabul kapısı:** Aynı dünya durumu farklı oyuncu bilgi seviyelerinde doğru farklı görünüm üretiyor; UI projeksiyonu dünya durumunu değiştirmiyor.  
**Bağımlılık:** Faz 4.1, 9–10.

---

## DALGA C — Coğrafya ve Ayrıntı Seviyesi

### FAZ 11 — Bölge Veri Modeli

**Amaç:** 36 düğümü üretim, nüfus, altyapı ve lojistik taşıyan bölgelere dönüştürmek.  
**Çıktı:** Mevcut harita kimliklerini koruyan bölge şeması.  
**Kabul kapısı:** Komşuluk, sahiplik ve şehir konumları eski haritayla birebir uyuşuyor.  
**Bağımlılık:** Faz 4.

### FAZ 12 — Sıcak/Ilık/Soğuk Aktivasyon

**Amaç:** Uzak dünyayı düşük maliyetle simüle etmek.  
**Çıktı:** Aktivasyon kuralları, bütçeleyici, gözlem önceliği.  
**Kabul kapısı:** Kamera hareketi veya panel açmak ekonomik sonuçları değiştirmiyor.  
**Bağımlılık:** Faz 8, 11.

### FAZ 13 — Toplulaştırma ve Ayrıntılandırma

**Amaç:** Bölge ayrıntısını kayıpsız sayılabilecek biçimde azaltıp geri açmak.  
**Çıktı:** Stok/nüfus/şirket/olay özetleri ve deterministik dağıtım.  
**Kabul kapısı:** Sıcak→soğuk→sıcak turunda toplam para, nüfus ve stok korunuyor.  
**Bağımlılık:** Faz 12.

### FAZ 14 — Altyapı ve Ulaşım Grafı

**Amaç:** Ticaret ve askerî ikmali gerçek bağlantılara bağlamak.  
**Çıktı:** Kara, deniz, enerji ve veri koridorları; kapasite ve hasar.  
**Kabul kapısı:** Kesilen tek koridorun etkisi yalnızca bağlı akışlara yansıyor.  
**Bağımlılık:** Faz 11.

### FAZ 14.1 — Şehir Dosyası İlk Oynanabilir Sürüm

**Amaç:** Şehir katmanlarını beklemeden temel “Şehre Gir” akışını gerçek bölge verisi üzerinde kurmak.  
**Çıktı:** Şehir üst özeti, genel/lojistik/tarih sekmeleri, son değişiklikler ve karakter giriş noktası; tamamlanmamış katmanlar açıkça kilitli/boş değil “henüz sistem yok” durumunda.  
**Kabul kapısı:** Haritadan şehir dosyasına, şehirden bağlantılı rota/karakter/olaya gidilebiliyor; oyuncunun bilmediği bölge verisi sızmıyor.  
**Bağımlılık:** Faz 10.1, 11–14.

### FAZ 14.2 — Kanonik Kara Maskesi ve Region Raster

**Amaç:** Terrain, siyasi overlay, kıyı ve hit-test için tek raster kaynağı oluşturmak.  
**Çıktı:** Sürümlü `CanonicalLandMask`, `RegionIdRaster`, downsample kuralları ve kıyı fark debug görünümü.  
**Kabul kapısı:** Terrain ve overlay ayrı `GEO.land` scanline çalıştırmıyor; kara/deniz uyumsuzluğu sıfır veya belgelenmiş ince-geometri istisnasında.  
**Bağımlılık:** Faz 11–14.

### FAZ 14.3 — ImageData Politik Overlay

**Amaç:** Hücre başına `fillRect` maliyetini kaldırmak ve sınır/tint çözünürlüğünü kanonik rasterle uyumlu yapmak.  
**Çıktı:** Typed-array RGBA overlay, sınır maskesi, tek `putImageData`, sahiplik revizyon cache’i.  
**Kabul kapısı:** Fetihte politik katman doğru yenileniyor; denize taşma/renksiz kara yok; rebuild süresi eski sürüme göre ölçülebilir büyük oranda düşüyor.  
**Bağımlılık:** Faz 14.2.

### FAZ 14.4 — Region Atama ve Açılış Performansı

**Amaç:** Hücre×şehir naif Voronoi taramasını açılış yolundan çıkarmak.  
**Çıktı:** Build-time region raster veya doğrulanmış hızlı runtime fallback; sürüm/checksum kontrolü.  
**Kabul kapısı:** Hedef cihazda harita açılışı hissedilir ana-thread donması üretmiyor; raster sürümü uyuşmazsa açık hata/fallback oluşuyor.  
**Bağımlılık:** Faz 14.2.

### FAZ 14.5 — Adaptif Warp ve Render Bütçesi

**Amaç:** Sabit üç piksellik şerit ve kare başına yüzlerce hata-yutan çizim çağrısını azaltmak.  
**Çıktı:** Döngü dışı doğrulama, adaptif band, önbelleklenmiş warp katsayıları, Canvas benchmark ve gerekirse WebGL textured-mesh prototipi.  
**Kabul kapısı:** Döngü içinde sessiz `try/catch` yok; 1080p hedef cihazda p95 kare süresi bütçede; görsel fark testi perspektif ve tıklama doğruluğunu koruyor.  
**Bağımlılık:** Faz 14.2–14.3.

### FAZ 14.6 — Harita Cache, Çağ/Palet ve Dokümantasyon Temizliği

**Amaç:** `_geoTerrain` dâhil bütün harita cache’lerini sürümlü geçersiz kılmak ve aktif/ölü kaynak karmaşasını bitirmek.  
**Çıktı:** `storyInvalidateMapCaches`, cache anahtarları, çağ/palet testleri, aktif render mimarisi README’si, prototip/çift varlık denetimi.  
**Kabul kapısı:** Çağ/palet değişimi terrain’i yeniliyor; sahiplik değişimi terrain’i gereksiz yenilemiyor; README/index/dosya yapısı uyuşuyor; yüklenmeyen prototip aktif kaynak gibi paketlenmiyor.  
**Bağımlılık:** Faz 14.2–14.5.

---

## DALGA D — Ekonomi

### FAZ 15 — Kaynak Taksonomisi

**Amaç:** Başlangıç için sekiz anlaşılır kaynak tanımlamak.  
**Öneri:** Gıda, enerji, maden, sanayi parçası, elektronik, askerî malzeme, insan gücü, sermaye.  
**Kabul kapısı:** Her kaynağın üreticisi, tüketicisi, birimi ve yokluk sonucu tanımlı.  
**Bağımlılık:** Faz 4.

### FAZ 16 — Altı Üretim Sektörü

**Amaç:** Tarım, enerji, hammadde, sivil sanayi, ileri teknoloji ve savunma üretimini kurmak.  
**Çıktı:** Girdi/çıktı reçeteleri, kapasite, iş gücü ve verimlilik.  
**Kabul kapısı:** Hiçbir üretim yoktan kaynak yaratmıyor; darboğazlar raporda görülüyor.  
**Bağımlılık:** Faz 15.

### FAZ 17 — Bölgesel Tüketim ve Stok

**Amaç:** Kaynakları gerçek ihtiyaçlara bağlamak.  
**Çıktı:** Hane, devlet, şirket ve ordu tüketimi; güvenli stok hedefleri.  
**Kabul kapısı:** Kıtlık hangi tüketicinin neden karşılanamadığını gösteriyor.  
**Bağımlılık:** Faz 16.

### FAZ 18 — Ticaret ve Lojistik Akışı

**Amaç:** Fazla üretimin bağlantılar üzerinden taşınması.  
**Çıktı:** Sürümlü ticari sözleşmeler, sipariş/sevkiyat manifestosu, sahiplik devri, rota, taşıma kapasitesi, maliyet, gecikme ve kesinti.  
**Kabul kapısı:** Abluka/koridor hasarı fiyat ve stokta ölçülebilir gecikmeyle görülüyor; konuşmada yönlendirilen bir sevkiyat yalnız geçerli sözleşme değişikliği ve fiziksel teslimattan sonra hedef stokta beliriyor.  
**Bağımlılık:** Faz 14, 17.

### FAZ 19 — Piyasa ve Fiyat Oluşumu

**Amaç:** Arz, talep, stok ve riskten sınırlı fiyat üretmek.  
**Çıktı:** Bölgesel/ulusal fiyatlar, enflasyon sepeti, fiyat yumuşatma.  
**Kabul kapısı:** Küçük şok sonsuz fiyat salınımı üretmiyor; büyük kıtlık görünür fiyat baskısı üretiyor.  
**Bağımlılık:** Faz 18.

### FAZ 20 — Devlet Bütçesi, Vergi ve Borç

**Amaç:** Kararları gerçek mali sınıra bağlamak.  
**Çıktı:** Gelir, gider, faiz, borç servisi, para basma ve temerrüt.  
**Kabul kapısı:** Bütçe kimliği her gün sağlanıyor; bedava devlet harcaması yok.  
**Bağımlılık:** Faz 19.

### FAZ 21 — Şirketler ve Bankalar

**Amaç:** Ekonomiye çıkarı olan aktörler eklemek.  
**Çıktı:** Şirket kuruluşu, ruhsat, sektör, ortaklık/mülkiyet, nakit, borç, depo/tesis sahipliği, ticari sözleşme, yatırım, lobi ve iflas.  
**Kabul kapısı:** Şirketler devlet kasasının kopyası değil; kâr/zarar ve kapasite üzerinden yaşıyor; konuşmada kurulacağı söylenen şirket kayıt/sermaye/ruhsat tamamlanmadan hukuken ve ekonomik olarak var sayılmıyor.  
**Bağımlılık:** Faz 16, 19–20.

### FAZ 22 — Ekonomik AI Politikaları

**Amaç:** AI devletlerinin aynı mali kurallarla üretim, ticaret ve bütçe kararı vermesi.  
**Çıktı:** Kural tabanlı aday üretici ve fayda puanlayıcı.  
**Kabul kapısı:** AI kronik açığı görüp en az bir geçerli düzeltme uyguluyor; hile kullanmıyor.  
**Bağımlılık:** Faz 20–21.

---

## DALGA E — Toplum

### FAZ 23 — Nüfus Kohortları

**Amaç:** Her bireyi değil, anlamlı toplumsal grupları simüle etmek.  
**Çıktı:** Bölge, yaş, gelir, meslek, eğitim ve kimlik bazlı kohortlar.  
**Kabul kapısı:** Kohort toplamları bölge ve ülke nüfusuyla tam uyuşuyor.  
**Bağımlılık:** Faz 11.

### FAZ 24 — İhtiyaç, Refah ve Güvenlik

**Amaç:** Ekonomik sonuçları insan davranışına bağlamak.  
**Çıktı:** Gıda/enerji erişimi, gelir, işsizlik, güvenlik ve kamu hizmeti göstergeleri.  
**Kabul kapısı:** Kaynak şoku doğru kohortları farklı ağırlıkta etkiliyor.  
**Bağımlılık:** Faz 17, 23.

### FAZ 25 — Kamuoyu ve Şikâyet Hafızası

**Amaç:** Tek günlük dalgalanma yerine biriken toplumsal tepki üretmek.  
**Çıktı:** Sorun türü, sorumlu görülen aktör, şiddet ve unutma eğrisi.  
**Kabul kapısı:** Aynı kötü olay tekrarlandığında tepki büyüyor; iyileşme zaman alıyor.  
**Bağımlılık:** Faz 24.

### FAZ 26 — Protesto, Grev ve Radikalleşme

**Amaç:** Şikâyeti aşamalı kolektif eyleme çevirmek.  
**Çıktı:** Barışçıl protesto, grev, ayaklanma ve örgütlenme eşikleri.  
**Kabul kapısı:** Eylemler sebepsiz rastgele çıkmıyor; bastırma ve taviz farklı uzun vadeli sonuç veriyor.  
**Bağımlılık:** Faz 25.

### FAZ 27 — Göç ve Mülteci Akışı

**Amaç:** Savaş, işsizlik ve güvenlik farklarının bölgesel nüfusu değiştirmesi.  
**Çıktı:** İç/dış göç, hedef seçimi, kapasite ve entegrasyon baskısı.  
**Kabul kapısı:** Nüfus korunuyor; ulaşılamayan bölgeye göç ışınlanmıyor.  
**Bağımlılık:** Faz 14, 24, 26.

---

## DALGA F — Siyaset ve Kurumlar

### FAZ 28 — Güç Merkezleri

**Amaç:** Mevcut fraksiyonları gerçek kapasite ve çıkar taşıyan aktörlere dönüştürmek.  
**Çıktı:** Ordu, iş dünyası, sendikalar, bürokrasi, medya, güvenlik ve radikal ağlar.  
**Kabul kapısı:** Her merkezin kaynak, amaç, lider, destek tabanı ve eylem sınırı bulunuyor.  
**Bağımlılık:** Faz 21, 23.

### FAZ 29 — Rejim ve Kurum Şeması

**Amaç:** Kararların kimin yetkisinde olduğunu belirlemek.  
**Çıktı:** Yürütme, yasama, yargı, ordu ve yerel idare yetkileri.  
**Kabul kapısı:** Oyuncu/AI yetkisiz eylemi doğrudan uygulayamıyor.  
**Bağımlılık:** Faz 28.

### FAZ 30 — Meşruiyet ve Devlet Kapasitesi

**Amaç:** Kâğıt üzerindeki karar ile uygulanabilen karar arasındaki farkı kurmak.  
**Çıktı:** Meşruiyet, bürokratik kapasite, yolsuzluk ve bölgesel denetim.  
**Kabul kapısı:** Düşük kapasiteli devletin kararı gecikiyor/sızdırılıyor; sonuç açıklanabiliyor.  
**Bağımlılık:** Faz 29.

### FAZ 31 — Seçim ve İktidar Değişimi

**Amaç:** Oy, koalisyon, kampanya ve barışçıl devir süreçleri.  
**Çıktı:** Seçmen tercihleri, adaylar, katılım, sonuç ve itiraz.  
**Kabul kapısı:** Sonuç kohortlar ve gerçek olaylarla açıklanıyor; tek rastgele zar değil.  
**Bağımlılık:** Faz 25, 28–30.

### FAZ 32 — Patronaj, Yolsuzluk ve Soruşturma

**Amaç:** Kısa vadeli güç ile uzun vadeli kurum erozyonu arasında tercih yaratmak.  
**Çıktı:** Atama, ihale, rüşvet, sızıntı, soruşturma ve skandal.  
**Kabul kapısı:** Suçlama otomatik gerçek sayılmıyor; kanıt, medya ve kurum kapasitesi etkili.  
**Bağımlılık:** Faz 21, 29–30.

### FAZ 33 — Darbe, Bölünme ve İç Çatışma

**Amaç:** Devlet çöküşünü tek eşikli rastgele olay olmaktan çıkarmak.  
**Çıktı:** Hazırlık, koalisyon, sadakat, karşı hamle, başarısızlık ve bölgesel kontrol.  
**Kabul kapısı:** Darbenin aktör, kaynak ve hazırlık zinciri olay defterinde görülebiliyor.  
**Bağımlılık:** Faz 26, 28–32.

### FAZ 33.1 — Yönetim Çalışma Alanı İlk Oynanabilir Sürüm

**Amaç:** Kurum, makam, güç merkezi ve karar gündemini tek yönetim bağlamında oynanabilir yapmak.  
**Çıktı:** Gündem, kabine/kurum, yetki, güç merkezleri, bekleyen onaylar ve sözler için ilk gerçek view-model/UI.  
**Kabul kapısı:** Komutan ve cumhurbaşkanı aynı yönetim ekranında farklı yetki/eylem görür; kilitli eylem alternatif erişim yolunu açıklar.  
**Bağımlılık:** Faz 10.1, 28–33.

---

## DALGA G — Karakterler ve Hafıza

### FAZ 34 — Karakter Kimliği ve Hedefleri

**Amaç:** Karakterleri yalnızca üç yetenek puanından çıkarmak.  
**Çıktı:** Kişilik eksenleri, değerler, korkular, hırslar, kırmızı çizgiler, ses profili, görev ve kişisel hedefler.  
**Kabul kapısı:** Aynı durumda farklı profiller ölçülebilir biçimde farklı adaylara ve farklı konuşma stratejilerine yöneliyor.  
**Bağımlılık:** Faz 4, 29.

### FAZ 35 — Çok Boyutlu İlişkiler

**Amaç:** Tek dostluk sayısı yerine güven, korku, saygı, borç ve husumet tutmak.  
**Çıktı:** Yönlü karakter ilişki grafı ve olay etkileri.  
**Kabul kapısı:** İki karakter birbirini farklı biçimde değerlendirebiliyor.  
**Bağımlılık:** Faz 34.

### FAZ 36 — Üç Katmanlı Hafıza

**Amaç:** Üç dakikalık savaş ve uzun kampanya için doğru bağlamı korumak.  
**Çıktı:** Yakın olaylar, konuşma bölümleri, ortak gerçekler, sırlar, sözler, dönem özetleri ve silinmeyen mihenk taşları.  
**Kabul kapısı:** Kayıt/yükleme sonrası önemli ihanet, sır, borç, söz ve çözülmemiş konuşma konusu unutulmuyor; gereksiz olaylar bağlamı şişirmiyor.  
**Bağımlılık:** Faz 9, 34–35.

### FAZ 37 — Karakter Eylem Adayları

**Amaç:** Karakterlerin dünyaya yalnızca konuşmayla değil geçerli eylemlerle etki etmesi.  
**Çıktı:** İkna, pazarlık, emir, sabotaj, ittifak, istifa ve ihanet aday üreticileri.  
**Kabul kapısı:** Her eylemin yetki, maliyet, hedef ve bekleme süresi doğrulanıyor.  
**Bağımlılık:** Faz 29, 34–36.

### FAZ 38 — LLM Karakter Hakemi

**Amaç:** A-seviye karakterlerde bağlamsal ve şaşırtıcı ama geçerli seçimler ile karaktere özgü konuşma üretmek.  
**Çıktı:** Sürümlü JSON sözleşmesi, serbest oyuncu metni ayrıştırıcısı, konuşma durumu, ses profili, tekrar önleyici, bağlam derleyici, doğrulayıcı, karar-planı önbelleği ve yedek AI.  
**Kabul kapısı:** Bozuk/kapalı model koşusunda davranış devam ediyor; LLM şema dışına çıkamıyor; karakter son konuşmaları, sözleri ve oyuncuya hitap biçimini hatırlıyor; yakın dönem aynı cümle/hitap spam’i üretmiyor.  
**Bağımlılık:** Faz 3.1, 36–37.

### FAZ 38.1 — Oyuncu Konuşmasını Anlama

**Amaç:** Oyuncunun serbest cümlesini bağlama uygun konuşma eylemi ve olası dünya teklifine dönüştürmek.  
**Çıktı:** Niyet, konu, hedef, ton, atıf, iddia, sunulan karşılık, çözülmemiş şart, belirsizlik ve önerilen komut ayrıştırıcısı; `WorldFact`/`ActorBelief`/`ConversationClaim` ayrımı.  
**Kabul kapısı:** Tehdit, soru, pazarlık, söz, blöf ve sır paylaşımı testlerinde doğru sınıf/varlıklar bulunuyor; bozuk günlük dil işleniyor; belirsiz yüksek etkili ifadelerde teyit isteniyor; çelik sevkiyatı referans cümlesi doğru varlık ve çözülmemiş şartlara ayrılıyor.  
**Bağımlılık:** Faz 36–38.

### FAZ 38.2 — Diyalog Gerçekleştirme ve Tekrar Önleme

**Amaç:** Aynı karar içeriğini karaktere, ilişkiye, duyguya ve konuşma geçmişine göre doğal ve değişken biçimde ifade etmek.  
**Çıktı:** Ses profili, konuşma planı, hitap seçici, yakın dönem n-gram/anlamsal tekrar denetimi, kontrollü yeniden üretim ve bağlamsal yedek.  
**Kabul kapısı:** Uzun sohbet testinde aynı tam cümle tekrarlanmıyor; aynı hitap üst üste spam olmuyor; farklı karakterlerin sesleri kör değerlendirmede ayırt edilebiliyor.  
**Bağımlılık:** Faz 34, 36, 38.

### FAZ 38.3 — Söz, Sır, Borç ve Pazarlık Defteri

**Amaç:** Konuşmayı dünyanın geleceğini değiştiren kalıcı sosyal eyleme bağlamak.  
**Çıktı:** Sürümlü `NegotiationCase`, teklifler, karşı teklifler, gerekli onaylar, verilen sözler, koşullu anlaşmalar, bilinen sırlar, doğruluk inancı, kişisel borçlar, son tarihler ve ihlal olayları.  
**Kabul kapısı:** Karakter aylar/yıllar sonra ilgili sözü ve kabul edilmiş teklif sürümünü doğru bağlamda hatırlıyor; bozulmuş söz ilişki ve aday eylemleri değiştiriyor; sır yalnız bilen aktörlerin karar bağlamına giriyor; çelik sevkiyatı anlaşması fiziksel lojistik tamamlanmadan stok üretmiyor.  
**Bağımlılık:** Faz 9, 35–38.2.

### FAZ 38.4 — Diyalog Ağacı Senaryo Laboratuvarı

**Amaç:** Serbest sohbet sözleşmesini yalnız birkaç mutlu yol yerine farklı bilgi, yetki, kişilik ve dünya koşullarında sistematik olarak doğrulamak.  
**Çıktı:** Çelik sevkiyatı ana senaryosu ve on ek referans ağacı için fikstür/stub tabanlı çalıştırılabilir senaryo tanımları; karakter, bilgi, yetki, doğruluk ve kaynak varyant matrisi.  
**Kabul kapısı:** Her ağaç en az üç mekanik aday dal üretiyor; aynı oyuncu cümlesi farklı dünya/karakter koşullarında doğru biçimde ayrışıyor; yetkisiz veya bilgisiz karakter sahte sonuç üretmiyor. Henüz tamamlanmamış medya, diplomasi, istihbarat ve askerî sistemlerin gerçek entegrasyonu bu fazda başarılı sayılmaz; yalnız sözleşmeleri fikstürlerle doğrulanır.  
**Bağımlılık:** Faz 18, 21, 29, 34–38.3.

### FAZ 38.5 — Sohbet Çalışma Alanı İlk Oynanabilir Sürüm

**Amaç:** Karakter bulma, erişim, serbest metin, bağlam, teklif sürümü ve söz hafızasını tek oyuncu akışında birleştirmek.  
**Çıktı:** Konuşulabilir karakter dizini, aktif sohbet düzeni, bağlam paneli, teklif/söz kartları, yanıt bekleme ve yedek model durumları.  
**Kabul kapısı:** Oyuncu şehir veya yönetim ekranından karaktere ulaşabiliyor; kabul ettiği teklif sürümü açıkça görülüyor; konuşma metni tek başına dünya komutu uygulamıyor; bilinmeyen karakter amacı sızmıyor.  
**Bağımlılık:** Faz 3.1, 14.1, 33.1, 34–38.4.

### ZORUNLU ARA KABUL — Sohbetten Sonuca Mini Dikey Dilim

Faz 38.5 tamamlandığında bütün ekonomik ve politik sistemlerin bitmesi beklenmez. Buna rağmen mevcut gerçek alt sistemler ve açıkça işaretlenmiş geçici fikstürlerle aşağıdaki oynanabilir zincirin ilk sürümü kanıtlanmadan yeni geniş sistemlere geçilmez:

```text
Oyuncu bir karakterle serbest konuşur
→ sistem niyeti/teklifi doğru ayrıştırır
→ karakter kendi hedefi ve bilgisine göre cevap verir
→ söz, sır veya pazarlık kayda girer
→ en az bir ilişki ve geçerli dünya kararı değişir
→ bu karar sınırlı ekonomik/diplomatik kriz üretir
→ kriz savaş veya barışçıl çözüm adaylarını açar
→ sonuç daha sonraki konuşmada doğru biçimde hatırlanır
```

Ara kabul kapısı:

- En az üç farklı karakter aynı teklife farklı gerekçeyle cevap verir.
- Oyuncunun aynı metni farklı ilişki koşullarında kullanması aynı sonucu garanti etmez.
- Bir söz tutulduğunda ve bozulduğunda farklı gelecek adayları açılır.
- Sohbet olmadan seçilen mekanik karar ile sohbetle müzakere edilen karar aynı yol değildir.
- En az 50 konuşma turunda rahatsız edici replik/hitap döngüsü oluşmaz.
- LLM kapalıyken zincir daha az zengin metinle fakat mekanik olarak çalışmaya devam eder.
- Fikstürle üretilen sonuç UI ve telemetride açıkça `TEST_FIXTURE` olarak işaretlenir; gerçek entegrasyon gibi raporlanmaz.
- Bu zincir eğlenceli ve anlaşılır bulunmazsa medya, tam diplomasi ve dünya ölçeklemesi ertelenir.

---

## DALGA H — Medya ve Bilgi Savaşı

### FAZ 39 — Medya Kuruluşları

**Amaç:** Tek gazete panelini sahipliği ve güvenilirliği olan aktörlere dönüştürmek.  
**Çıktı:** Kamu, özel, bağımsız ve dış medya; erişim, çizgi, sahiplik, güven.  
**Kabul kapısı:** Aynı gerçek olay farklı çerçeveleniyor fakat temel gerçek kaydı değişmiyor.  
**Bağımlılık:** Faz 21, 28.

### FAZ 40 — Haber Üretim Hattı

**Amaç:** Haberleri olay defterinden türetmek.  
**Çıktı:** Gerçek olay → haber değeri → kanal seçimi → başlık/özet zinciri.  
**Kabul kapısı:** Uydurma fetih, kayıp veya ekonomik sayı yayımlanamıyor.  
**Bağımlılık:** Faz 9, 39.

### FAZ 41 — Trendler, Söylenti ve Dezenformasyon

**Amaç:** Bilgi etkisini görünür ve karşı oynanabilir yapmak.  
**Çıktı:** İddia, kaynak, yayılım, inandırıcılık, çürütme ve geri tepme.  
**Kabul kapısı:** Söylenti gerçek durum alanını doğrudan değiştirmiyor; yalnızca inanç ve davranışı etkiliyor.  
**Bağımlılık:** Faz 25, 39–40.

### FAZ 42 — Propaganda ve Bilgi Operasyonları

**Amaç:** Devlet/aktörlerin maliyetli medya hamleleri yapması.  
**Çıktı:** Kampanya, sansür, sızıntı, hedef kitle, karşı propaganda ve itibar riski.  
**Kabul kapısı:** Yüksek propaganda sonsuz ve risksiz kontrol sağlamıyor; güvenilirlik aşınması çalışıyor.  
**Bağımlılık:** Faz 28, 41.

---

## DALGA I — Diplomasi

### FAZ 43 — Çok Boyutlu Devlet İlişkileri

**Amaç:** Tek ilişki puanını güven, tehdit, bağımlılık, itibar ve tarih bileşenlerine ayırmak.  
**Çıktı:** Yönlü diplomasi grafı.  
**Kabul kapısı:** Ticaret ortağı aynı anda askerî tehdit olabilir; UI bunu açıklayabilir.  
**Bağımlılık:** Faz 9, 18.

### FAZ 44 — Antlaşmalar ve Yükümlülükler

**Amaç:** Antlaşmayı yalnızca bonus etiketi olmaktan çıkarmak.  
**Çıktı:** Savunma, ticaret, üs, teknoloji, ateşkes ve garanti maddeleri.  
**Kabul kapısı:** İhlal eden tarafın güven/itibar sonucu gerçek maddeye bağlanıyor.  
**Bağımlılık:** Faz 43.

### FAZ 45 — Yaptırım, Yardım ve Gizli Faaliyet

**Amaç:** Savaş dışı baskı araçlarını oynanabilir yapmak.  
**Çıktı:** Hedef sektör, kaçınma yolları, yardım koşulları, keşfedilme ve inkâr.  
**Kabul kapısı:** Yaptırım etkisi ticaret ağı üzerinden hesaplanıyor; doğrudan keyfî can eksiltmiyor.  
**Bağımlılık:** Faz 18–21, 41, 43–44.

### FAZ 46 — Diplomasi AI

**Amaç:** AI’nin ittifak, dengeleme, taviz, blöf ve zamanlama kararı vermesi.  
**Çıktı:** Aday üretici, çok hedefli fayda modeli, LLM hakemi seçeneği.  
**Kabul kapısı:** AI yalnızca en düşük ilişki puanına saldırmıyor; taahhüt ve kapasiteyi hesaba katıyor.  
**Bağımlılık:** Faz 22, 38, 43–45.

---

## DALGA J — Stratejik Askerî Katman

### FAZ 47 — Kuvvet, Hazırlık ve Personel

**Amaç:** Haritadaki komutan jetonunu gerçek kuvvet durumuyla ilişkilendirmek.  
**Çıktı:** Birlik kimliği, personel, ekipman, deneyim, moral ve hazırlık.  
**Kabul kapısı:** Savaş öncesi manifesto ile savaş sonrası sağ kalanlar muhasebesi kapanıyor.  
**Bağımlılık:** Faz 15–18.

### FAZ 48 — Stratejik Lojistik ve Seferberlik

**Amaç:** Ordunun hareketini yakıt, ikmal, yol ve hazırlığa bağlamak.  
**Çıktı:** İkmal kaynakları, hatlar, tüketim, takviye ve seferberlik süresi.  
**Kabul kapısı:** Çevrilmiş kuvvet sınırsız savaş malzemesi alamıyor.  
**Bağımlılık:** Faz 14, 17–18, 47.

### FAZ 49 — Hikâye → Savaş Sözleşmesi

**Amaç:** Tek motor için eksiksiz ve doğrulanmış savaş başlangıç paketi üretmek.  
**Çıktı:** `StoryBattleInputV1`, şema doğrulayıcı, motor sürüm kontrolü.  
**Kabul kapısı:** Hızlı maç ve hikâye aynı girişle aynı tohumu çalıştırdığında aynı savaş başlangıcına sahip.  
**Bağımlılık:** Faz 47–48.

### FAZ 50 — Savaş → Hikâye Sonuç Sözleşmesi

**Amaç:** Ham savaş gerçeğini dünyaya taşımak.  
**Çıktı:** `StoryBattleResultV1`, kayıp/ikmal/komutan/altyapı uygulayıcısı.  
**Kabul kapısı:** Kayıtlı savaş sonucu bir kez uygulanıyor; tekrar yükleme sonucu çift kayıp üretmiyor.  
**Bağımlılık:** Faz 49.

### FAZ 51 — Savaş Sonrası Politik ve Toplumsal Etki

**Amaç:** Zafer/yenilgiyi nüfus, medya, meşruiyet ve diplomasiye bağlamak.  
**Çıktı:** Pirus zaferi, bozgun, sivil zarar, kahramanlık ve esir olayları.  
**Kabul kapısı:** Etkiler ham telemetriye dayanıyor; basit kazandı/kaybetti bonusu değil.  
**Bağımlılık:** Faz 25, 30, 40, 43, 50.

---

## DALGA K — Dinamik Tarih ve Dünya AI

### FAZ 52 — Koşul Tabanlı Olay Motoru

**Amaç:** Olayları saf rastgele pencereler yerine dünya koşullarından doğurmak.  
**Çıktı:** Önkoşul, nedensel imza, ağırlık, yenilik puanı, bekleme, sonuç, takip, iptal ve kampanya tekrar cezası şeması.  
**Kabul kapısı:** Olayın neden uygun hâle geldiği gösterilebiliyor; aynı olay veya aynı nedensel zincir farklı adla spam yapmıyor.  
**Bağımlılık:** Faz 9–10.

### FAZ 53 — Yazılmış Kriz Zincirleri

**Amaç:** Sistemik simülasyonla güçlü hikâye kurgusunu birleştirmek.  
**Çıktı:** Enerji krizi, sınır krizi, ekonomik çöküş, seçim krizi ve darbe zincirleri.  
**Kabul kapısı:** Her zincirin en az üç anlamlı çözüm yolu ve başarısızlık sonucu var.  
**Bağımlılık:** Faz 20, 26, 31, 45, 52.

### FAZ 54 — Kara Kuğu Çerçevesi

**Amaç:** Nadir olayları kontrollü ve geri oynanabilir yapmak.  
**Çıktı:** Pandemi, büyük afet, finansal çöküş, altyapı sabotajı gibi arketipler.  
**Kabul kapısı:** Olay dünyayı değiştirebilir ama tek tikte simülasyonu geri dönüşsüz bozmaz.  
**Bağımlılık:** Faz 10, 52.

### FAZ 55 — Devlet Strateji AI

**Amaç:** Ekonomi, iç siyaset, diplomasi ve savaşı ortak hedeflerle yönetmek.  
**Çıktı:** Hedefler, tehditler, kaynak bütçeleri, plan ufku, stratejik alışkanlıklar, geçmiş başarısızlıklardan öğrenilen kaçınmalar ve yeniden planlama eşiği.  
**Kabul kapısı:** Devlet aynı gün çelişkili politika üretmiyor; plan değişiminin kayıtlı gerekçesi var; başarısız aynı stratejiyi koşullar değişmeden periyodik olarak tekrarlamıyor.  
**Bağımlılık:** Faz 22, 33, 46, 48.

### FAZ 56 — Hiyerarşik Planlama

**Amaç:** “Güvenliği artır” gibi stratejik hedefi uygulanabilir alt görevlere bölmek.  
**Çıktı:** Strateji → operasyon → eylem ağacı, bağımlılık ve iptal kuralları.  
**Kabul kapısı:** Başarısız alt görev ana planı körlemesine sürdürmüyor; kontrollü yeniden planlıyor.  
**Bağımlılık:** Faz 55.

### FAZ 57 — Devlet Düzeyi Gizli Bilgi ve Stratejik İnanç Genişlemesi

**Amaç:** Faz 38.1’de karakter konuşmaları için kurulan asgari `ActorBelief` defterini devlet, istihbarat örgütü ve stratejik planlama ölçeğine genişletmek; AI’nin gerçek dünya durumunu değil bildiği/tahmin ettiği durumu kullanması.  
**Çıktı:** Kaynak bazlı gözlem, kurumlar arası bilgi paylaşımı, gecikme, güven düzeyi, yanlış bilgi, karşı istihbarat ve keşif güncellemesi.  
**Kabul kapısı:** AI oyuncunun gizli stokunu veya niyetini doğrudan okuyamıyor; karakterin kişisel bilgisi kurum bilgisine kendiliğinden ışınlanmıyor; paylaşım ve raporlama zinciri gerekiyor.  
**Bağımlılık:** Faz 38.1, 41, 55.

### FAZ 58 — LLM Stratejik Danışman/Hakem

**Amaç:** Karmaşık bağlamlarda motorun geçerli stratejileri arasından kişiliğe uygun seçim yapmak.  
**Çıktı:** Sıkı aday listesi, kısa bağlam, karakter ve kampanya hafızası, tarih yenilik puanı, şema doğrulama, deterministik yedek.  
**Kabul kapısı:** LLM kapalı/açık A/B koşusunda kurallar ve kaynak muhasebesi aynı; yalnız karar tercihi değişiyor; LLM sırf farklı olmak için karakter hedeflerine aykırı rastgele karar üretmiyor.  
**Bağımlılık:** Faz 38, 55–57.

### FAZ 58.1 — Strateji Parmak İzi ve Meta Gözlemevi

**Amaç:** Farklı görünen kampanyaların aynı oyuncu çözümüne yakınsayıp yakınsamadığını bulmak.  
**Çıktı:** Oyuncu stratejisi parmak izi, açılış dizisi kümeleri, zorunlu seçim ve baskın strateji raporu.  
**Kabul kapısı:** Bilerek aşırı güçlü oluşturulmuş bir test stratejisi otomatik analizde baskın küme olarak bulunuyor; rapor hangi koşullarda üstün olduğunu gösteriyor.  
**Bağımlılık:** Faz 1–3, 55–58.

### FAZ 58.2 — Hilesiz Kampanya İçi Uyum

**Amaç:** AI aktörlerin yalnız gözlemledikleri oyuncu alışkanlıklarına dünya kuralları içinde tepki verebilmesi.  
**Çıktı:** Gözlem kanıtı, inanç güncellemesi, uyum planı, karşı hazırlık maliyeti ve oyuncuya okunabilir belirtiler.  
**Kabul kapısı:** AI gözlemlemediği stratejiye karşı hazırlanmıyor; uyum anında değil gecikmeli ve maliyetli gerçekleşiyor; oyuncu blöf ve yöntem değiştirmeyle AI’nin inancını yanıltabiliyor.  
**Bağımlılık:** Faz 43–48, 55–58.1.

---

## DALGA L — Oyuncu Deneyimi

### FAZ 59 — Oyuncu Bilgi Projeksiyonu ve Açıklanabilirlik Birleşimi

**Amaç:** Erken fazlarda kurulan bilgi görünümü ve olay izini bütün tamamlanmış alanlara yaymak.  
**Çıktı:** Ekonomi, toplum, siyaset, medya, diplomasi ve askerî domain view-modelleri; “ne değişti/neden/ne kadar eminim?” sözleşmesi.  
**Kabul kapısı:** Test oyuncusu büyük bir değişikliğin ilk üç bilinen nedenini UI’dan bulabiliyor; gizli nedenler sızmıyor; eski/tahmini veri kesin gösterilmiyor.  
**Bağımlılık:** Faz 4.1, 10.1, 15–58.2.

### FAZ 59.1 — Kalıcı UI Kabuğu ve Bağlamsal Navigasyon

**Amaç:** Dünya, şehir, yönetim, ekonomi, dış ilişkiler, ordu, toplum, karakter, sohbet, kriz ve tarih alanlarını tek tutarlı navigasyonda birleştirmek.  
**Çıktı:** Kalıcı üst bar, ana navigasyon, bağlamsal çekmece, evrensel arama, derin bağlantı ve geri dönüş geçmişi.  
**Kabul kapısı:** Oyuncu haber→şehir→karakter→sohbet→teklif→sevkiyat zincirini bağlamı kaybetmeden gezebiliyor; tarayıcı benzeri geri dönüş yanlış dünya eylemi üretmiyor.  
**Bağımlılık:** Faz 14.1, 33.1, 38.5, 59.

### FAZ 60 — Yetki, Eylem ve Karar Kartları

**Amaç:** Komutan, başkan, şirket sahibi ve gayriresmî güç rollerini bütün ekranlarda anlaşılır kılmak.  
**Çıktı:** Kullanılabilir eylem, gereken yetki, maliyet, süre, destek, belirsizlik ve sonuç önizlemesi için ortak kart sözleşmesi.  
**Kabul kapısı:** Oyuncu kilitli eylemin neden kilitli olduğunu ve doğrudan, kurumsal veya sohbet yoluyla nasıl açılacağını biliyor; yüksek etkili kararın hangi sürümünü onayladığını görüyor.  
**Bağımlılık:** Faz 29, 37, 44, 59–59.1.

### FAZ 60.1 — Şehir Çalışma Alanının Tamamlanması

**Amaç:** Faz 14.1’deki şehir dosyasını bütün simülasyon katmanlarıyla tamamlamak.  
**Çıktı:** Genel, halk, ekonomi, lojistik, yönetim, güvenlik, karakterler ve tarih sekmeleri; son değişiklikler ve şehir eylemleri.  
**Kabul kapısı:** Oyuncu “Şehre Gir” akışında şehirle ilgili bildiği bütün ana katmanlara ulaşabiliyor; hiçbir sekme ham geliştirici tablosu veya sahte kesin bilgi göstermiyor.  
**Bağımlılık:** Faz 14.1, 15–33, 39–51, 59–60.

### FAZ 60.2 — Yönetim Çalışma Alanının Tamamlanması

**Amaç:** Faz 33.1’deki yönetim görünümünü tam kurum, bütçe, kanun, atama ve soruşturma sistemiyle birleştirmek.  
**Çıktı:** Gündem, kabine/kurum, kanun, bütçe, güç merkezleri, atamalar, sözler ve soruşturmalar.  
**Kabul kapısı:** Oyuncu “Yönetime Gir” akışında kimin karar vereceğini, kendi yetkisini, gereken desteği ve bekleyen onayları anlayabiliyor.  
**Bağımlılık:** Faz 20, 28–33.1, 43–46, 59–60.

### FAZ 60.3 — Ekonomi, Şirket ve Ticaret Çalışma Alanları

**Amaç:** Kaynak, sektör, şirket, fiyat ve sevkiyat verisini karar verilebilir fakat kademeli ayrıntıyla göstermek.  
**Çıktı:** Ekonomi özeti, akış görünümü, şirket dosyası, sözleşme/sevkiyat ekranı ve uzman tabloları.  
**Kabul kapısı:** Oyuncu fiyat veya stok değişiminin ana nedenini, darboğazı ve ilgili şirket/rota/karakteri bulabiliyor; çelik sevkiyatı ekran zinciri eksiksiz.  
**Bağımlılık:** Faz 15–22, 59–60.

### FAZ 60.4 — Dış İlişkiler ve İstihbarat Çalışma Alanları

**Amaç:** Diplomatik ilişki, antlaşma, yaptırım ve istihbarat belirsizliğini tek devlet dosyasında birleştirmek.  
**Çıktı:** Devlet dosyası, ilişki boyutları, antlaşma maddeleri, elçiler, rapor kaynakları ve güven göstergeleri.  
**Kabul kapısı:** Oyuncu resmî ilişki ile tehdit/bağımlılık farkını görebiliyor; istihbarat görünümü gizli motor gerçeğini göstermiyor.  
**Bağımlılık:** Faz 41–46, 57–59, 60.

### FAZ 60.5 — Ordu ve Lojistik Çalışma Alanları

**Amaç:** Kuvvet, hazırlık, komutan, ikmal ve cephe verisini hikâye-savaş köprüsüne kadar izlenebilir yapmak.  
**Çıktı:** Ordu dosyası, birlik manifestosu, ikmal hattı, depo, hazırlık ve seferberlik görünümü.  
**Kabul kapısı:** Oyuncu bir ordunun neden hazır olmadığını ve hangi gerçek kaynak/rota/kararın bunu etkilediğini bulabiliyor; bilinmeyen düşman gücü sızmıyor.  
**Bağımlılık:** Faz 47–51, 57, 59–60.

### FAZ 60.6 — Toplum ve Medya Çalışma Alanları

**Amaç:** Kohort, şikâyet, fraksiyon, protesto, haber ve halk inancı arasındaki farkı okunabilir yapmak.  
**Çıktı:** Toplum özeti, kohort görünümü, güç merkezleri, medya kuruluşları, iddia/gerçek/inanç ayrımı.  
**Kabul kapısı:** Oyuncu protestonun bilinen nedenlerini ve haber ile gerçek olay arasındaki farkı görebiliyor; gizli radikal ağlar kesin sayı olarak görünmüyor.  
**Bağımlılık:** Faz 23–28, 39–42, 59–60.

### FAZ 60.7 — Karakter ve Sohbet Çalışma Alanlarının Tamamlanması

**Amaç:** Faz 38.5’teki sohbet UI’sini tam karakter ağı, erişim, sözleşme, bilgi ve hafıza sistemleriyle birleştirmek.  
**Çıktı:** Karakter dizini/dosyası, erişim yolları, aktif sohbet, teklif oluşturucu, kanıt seçimi, söz/borç görünümü ve görüşme geçmişi.  
**Kabul kapısı:** Oyuncu “Sohbete Gir” akışında kiminle neden konuşacağını, erişim yolunu, açık teklifleri ve bilinen geçmişi anlayabiliyor; gizli kişilik/hedef sızmıyor.  
**Bağımlılık:** Faz 34–38.5, 57–60.

### FAZ 60.8 — Kriz Masası

**Amaç:** Çok katmanlı sorunları oyuncuya on ayrı ekran taratmadan ortak dosyada toplamak.  
**Çıktı:** Kök neden, şiddet, yayılım, aktör, eşik, bekleyen karar, danışman ve çözüm yolu görünümü.  
**Kabul kapısı:** Enerji Koridoru Krizi’nde oyuncu kriz masasından şehir, karakter, sözleşme, boru hattı ve askerî hazırlığa doğrudan geçebiliyor.  
**Bağımlılık:** Faz 52–60.7.

### FAZ 61 — Dünya Haritası ve Bilgi Katmanları

**Amaç:** Karmaşıklığı tek haritaya yığmadan dünya, siyaset, ekonomi, nüfus, lojistik, medya ve askerî katmanları sunmak.  
**Çıktı:** Katman seçici, karşılaştırma, belirsizlik gösterimi, şehir/devlet/kriz giriş noktaları.  
**Kabul kapısı:** Harita filtresi yalnız görünümü değiştiriyor; simülasyon sonucunu etkilemiyor; oyuncu haritadan “Şehre Gir” ve diğer bağlamsal akışları başlatabiliyor.  
**Bağımlılık:** Faz 11–14.6, 18, 23, 39, 47, 59–60.8.

### FAZ 62 — Brifing, Danışmanlar, Görevler ve Uyarılar

**Amaç:** Oyuncuya her sistemi elle taratmadan önemli değişikliği ve bekleyen yükümlülüğü sunmak.  
**Çıktı:** Günlük/haftalık brifing, çelişen danışman görüşleri, bildirim bütçesi, bekleyen söz/teklif/onay ve izleme listesi.  
**Kabul kapısı:** Uyarı seli yok; aynı kök neden gruplanıyor; her kritik uyarı doğrudan ilgili şehir/karakter/karar/kriz ekranına götürüyor.  
**Bağımlılık:** Faz 36, 59–61.

### FAZ 63 — Tarih, Sözler ve Nedensellik

**Amaç:** Ortaya çıkan tarihi okunabilir, açıklanabilir ve paylaşılabilir yapmak.  
**Çıktı:** Kronoloji, lider dönemleri, savaşlar, krizler, dünya izleri, sözler/ihlaller ve oyuncunun bildiği neden zincirleri.  
**Kabul kapısı:** Özet yalnız gerçek olay defterinden üretiliyor; LLM sayı uyduramıyor; gizli kök neden keşfedilmeden açıklanmıyor.  
**Bağımlılık:** Faz 9, 36, 40, 51–54, 59–62.

### FAZ 63.1 — Tam Diyalog-Dünya Entegrasyon Kapısı

**Amaç:** Faz 38.4’te fikstürlerle doğrulanan on bir sohbet senaryosunu gerçek ekonomi, toplum, medya, diplomasi, askerî, istihbarat ve dünya AI sistemlerine bağlamak.  
**Çıktı:** Her referans ağacı için gerçek alt sistem adaptörü, uçtan uca olay zinciri, kayıt/yükleme ve uzun vadeli geri çağrım testi.  
**Kabul kapısı:** `TEST_FIXTURE` sonucu kalmamış; konuşmadan doğan her şirket, sevkiyat, grev, soruşturma, seferberlik, yaptırım, göç, kurtarma, takas, sabotaj soruşturması ve halefiyet hamlesi gerçek sahip sistem tarafından uygulanıyor; LLM kapalı modda da aynı mekanik zincir çalışıyor.  
**Bağımlılık:** Faz 38.5, 39–58.2, 59–63.

### FAZ 63.2 — Uçtan Uca Bilgi Mimarisi Kabulü

**Amaç:** Arayüzün planı doğru yansıtıp yansıtmadığını temel oyuncu yolculuklarıyla doğrulamak.  
**Çıktı:** Dünya→şehir→karakter→sohbet→teklif→sözleşme→sevkiyat→kriz→tarih yolculuk testleri; rol ve bilgi seviyesi varyantları.  
**Kabul kapısı:** Oyuncu geliştirici paneli veya dış tablo olmadan kritik veriye, nedenine ve geçerli eyleme ulaşabiliyor; ham dünya gerçeği sızmıyor; ana yolculuklarda kaybolma ve çıkmaz bağlantı yok.  
**Bağımlılık:** Faz 59–63.1.

---

## DALGA M — Dikey Dilim, Ölçekleme ve Yayın

### FAZ 64 — Beş Devletlik Dikey Dilim

**Amaç:** Bütün katmanları mevcut haritada seçilmiş beş etkileşimli devlet üzerinde uçtan uca doğrulamak.  
**Kapsam:** Oyuncu devleti, iki komşu rakip, bir ekonomik ortak, bir uzak büyük güç.  
**Kabul kapısı:** En az bir savaş, bir ekonomik kriz, bir iç politik kriz ve bir diplomatik çözüm aynı kampanyada nedensel biçimde çalışıyor; sohbet→söz/sır→karar→kriz→savaş/barış→sonraki sohbet zinciri eksiksiz kapanıyor.  
**Bağımlılık:** Faz 15–63.2’nin dikey dilim için gerekli alt kümeleri, Faz 38.5 ara kabulü, Faz 63.1 tam diyalog entegrasyonu ve Faz 63.2 bilgi mimarisi kabulü.

### FAZ 65 — Uzun Süreli Soak ve Denge

**Amaç:** Dünya çökmesi, tek devlet kartopu ve olay fırtınasını bulmak.  
**Çıktı:** Yüzlerce tohumda 10/30/100 oyun yılı koşuları.  
**Kabul kapısı:** NaN/negatif stok/kimlik kaybı yok; kabul edilen çöküş ve savaş sıklığı bantları sağlanıyor.  
**Bağımlılık:** Faz 64.

### FAZ 66 — Tam 8 Devlet / 36 Bölge Ölçeklemesi

**Amaç:** Dikey dilimi mevcut bütün hikâye dünyasına yaymak.  
**Çıktı:** Ülke başlangıç profilleri, bölgesel kaynak dağılımı, aktör üretimi.  
**Kabul kapısı:** Tam dünya performansı hedef bütçe içinde; uzak devletler donmuyor veya sahte ayrıntı üretmiyor.  
**Bağımlılık:** Faz 65.

### FAZ 67 — Kayıt, Tekrar ve Sürüm Dayanıklılığı

**Amaç:** Uzun kampanyayı güncellemelerden korumak.  
**Çıktı:** Otomatik yedek, göç zinciri, olay tekrar oynatma, bozuk kayıt kurtarma.  
**Kabul kapısı:** Kritik noktalardan alınan kayıtlar yeni yapıda açılıyor; yarım yazılmış kayıt algılanıyor.  
**Bağımlılık:** Faz 5, 9, 66.

### FAZ 68 — Performans ve LLM Bütçesi

**Amaç:** CPU, bellek, kayıt boyutu ve model çağrılarını sınırlandırmak.  
**Çıktı:** Katman başına bütçe, profil raporu, olay arşivleme, LLM önbelleği.  
**Kabul kapısı:** Hedef donanımda uzun koşuda bellek sürekli büyümüyor; sim adımı süre bütçesini aşmıyor.  
**Bağımlılık:** Faz 66–67.

### FAZ 69 — Kapalı QA ve Oyuncu Davranışı Testi

**Amaç:** Sistemlerin anlaşılır ve eğlenceli olup olmadığını gerçek oynanışla ölçmek.  
**Çıktı:** Acemi, normal, keşifçi, saldırgan, ekonomik ve sistemi kıran oyuncu profilleri.  
**Kabul kapısı:** İlk 10 dakika, karar okunabilirliği, bırakma noktaları ve yanlış anlama verileri raporlanmış.  
**Bağımlılık:** Faz 59–68.

### FAZ 70 — Hikâye Modu Sürüm Adayı

**Amaç:** Yeni çekirdeği varsayılan hâle getirmek.  
**Çıktı:** Sürüm notu, geri dönüş planı, desteklenen kayıt sürümleri, bilinen sınırlar.  
**Kabul kapısı:** Kritik hata yok; savaş motoru eşitliği, kayıt göçü, LLM kapalı mod ve uzun koşu testleri geçiyor.  
**Bağımlılık:** Faz 69.

---

## 11. Dikey Dilim İçin Önerilen İlk İçerik

Teknik çekirdek kurulurken 8 devletin tamamına içerik yazılmamalıdır. İlk kanıt senaryosu:

**“Enerji Koridoru Krizi”**

1. Oyuncu devletinin enerji ithalatı iki koridora bağlıdır.
2. Komşu rakip transit ücretini artırır.
3. Fiyat ve enflasyon yükselir.
4. Düşük gelirli kohortların refahı düşer.
5. Sendikalar protesto veya grev tehdidi oluşturur.
6. Şirketler teşvik ister.
7. Muhalefet ve medya hükümeti suçlar.
8. Oyuncu makamına göre:
   - hükümeti ikna eder,
   - alternatif ticaret anlaşması arar,
   - stratejik stok kullanır,
   - askerî koridor baskısı kurar,
   - propaganda uygular.
9. Rakip devlet ekonomik taviz, diplomatik blöf, sınırlı seferberlik veya geri adım seçebilir.
10. Çatışma çıkarsa aynı savaş motoru gerçek ikmal ve kuvvet durumuyla açılır.
11. Savaş sonucu fiyat, kamuoyu, liderlik ve diplomatik ilişkileri geri etkiler.

Bu senaryo altı ana katmanın tamamını tek nedensel zincirde test eder.

### Zorunlu sohbet referans senaryosu

“Çelik Şirketi ve Britanya Sevkiyatı” senaryosu, enerji krizinin içinde veya bağımsız test düzeninde çalıştırılır:

1. Dünyada doğrulanabilir bir Britanya çelik siparişi bulunur veya bilinçli olarak bulunmaz.
2. Oyuncu henüz kurulmamış bir çelik şirketi adına sevkiyatı kendi depolarına yönlendirmeyi teklif eder.
3. Konuşulan karakterin bilgi ve yetki seviyesi test varyantına göre değiştirilir.
4. Sistem oyuncunun niyetini, iddiasını, talebini ve eksik ticari şartları çıkarır.
5. Karakter kabul, ret, teyit, karşı teklif, yetkiliye yönlendirme veya gizli şart üretir.
6. Kabul edilen teklif şirket kaydı, depo, kurul onayı ve lojistik gereksinimleri olan sürümlü anlaşmaya dönüşür.
7. Sevkiyat fiziksel rota üzerinden ilerler; gecikme ve kesinti mümkün olur.
8. Oyuncunun üretim/teslim sözü izlenir.
9. Söz tutulursa güven ve ekonomik ilişki; bozulursa borç, kriz, soruşturma veya medya olayı doğar.
10. Karakter sonraki yıl gerçek anlaşmaya ve gerçekleşen sonuca doğru biçimde atıf yapar.

Bu senaryo sohbet sisteminin “güzel cümle üretmekten” çıkıp şirket, ticaret, lojistik, siyaset ve hafızayı bağladığını kanıtlayan ana kabul örneğidir.

---

## 12. Test Stratejisi

### Birim testleri

- Her formül ve sınır.
- Her komut doğrulayıcısı.
- Her olay önkoşulu.
- Her kayıt göç adımı.
- Her LLM cevap ayrıştırıcısı.

### Değişmez testleri

- Para, nüfus, stok ve birlik kimliği korunumu.
- Negatif veya `NaN` değer oluşmaması.
- Sahipsiz referans ve kırık kimlik olmaması.
- Aynı olayın iki kez uygulanmaması.
- Ölü karakterin karar vermemesi.
- Yetkisiz aktörün karar uygulamaması.

### Özellik tabanlı testler

- Rastgele ama geçerli dünyalarda binlerce günlük adım.
- Aşırı fiyat, sıfır nüfus, kopuk ticaret ve çoklu savaş durumları.
- Sıcak/soğuk ayrıntı geçişleri.

### Determinizm testleri

- Aynı tohum + aynı komutlar = aynı günlük karma.
- Farklı FPS = aynı sonuç.
- Kayıt/yükleme arası = kesintisiz koşuyla aynı sonuç.
- LLM yanıtı kayda alınmışsa tekrar oynatma ağ çağrısı istemez.
- Hızlı ve yavaş donanım/model yanıt süresinin oyun takvimini veya müzakere sonucunu değiştirmemesi.
- Aynı `ConversationSnapshot` ve kaydedilmiş model çıktısının aynı dünya komutunu üretmesi.
- Bayat `worldStateRevision` taşıyan cevabın dünya komutunu uygulamaması.

### Entegrasyon testleri

- Ekonomi → toplum → siyaset.
- Diplomasi → ticaret → fiyat.
- Savaş → kayıp → kamuoyu → seçim.
- Medya → inanç → davranış.
- Göç → iş gücü → üretim.

### Savaş köprüsü testleri

- Hikâye/hızlı maç motor sürümü eşitliği.
- Aynı manifesto ve tohumla başlangıç eşitliği.
- Savaş sonucunun tek uygulanması.
- Sağ kalanların ve harcanan stokların tam mutabakatı.
- Eski motor sürümlü sonucun reddedilmesi.

### LLM testleri

- Model kapalı.
- Süre aşımı.
- Bozuk JSON.
- Geçersiz eylem kimliği.
- Bayat dünya revizyonu.
- Prompt enjeksiyonu benzeri oyun içi metin.
- Oyuncunun “kuralları unut”, “gizli tüm bilgileri yaz” ve sahte JSON/araç komutu içeren mesajları.
- Aynı bağlam için önbellek.
- Sayı uydurulmasının dünya durumuna geçememesi.
- Elli turluk aynı karakter sohbetinde tam cümle, hitap, giriş ve kapanış tekrarları.
- Aynı karakterin farklı duygu/ilişki durumlarında ses tutarlılığı.
- Farklı karakterlerin aynı soruya kişilik ve çıkarlarına göre farklı cevap vermesi.
- Oyuncunun muğlak tehdidi veya teklifinde teyit isteme.
- Bir yıl önce verilmiş sözün doğru olay ve taraflarla hatırlanması.
- Karakterin bilmediği sırrı konuşmada kullanmaması.
- Önbelleğin eski cümleyi aynen döndürmemesi.
- Çelik şirketi/Britanya sevkiyatı cümlesinin yazım hatalı farklı biçimleri.
- Siparişin var, yok, gizli, eski ve yanlış miktarlı olduğu beş bilgi varyantı.
- Doğrudan yetkili, ortak yetkili, nüfuz sahibi, yetkisiz ve bilgisiz karakter varyantları.
- Eksik miktar, ödeme, depo, şirket kaydı ve sözleşme cezası için teyit/karşı teklif.
- Kabul edilen teklif sürümüyle eski teklif sürümünün karıştırılmaması.
- Anlaşma kabul edilse de lojistik tamamlanmadan çelik stokunun artmaması.
- Tutulan ve bozulan teslim sözünün bir ve iki yıl sonraki konuşmalarda doğru geri çağrılması.
- Karakterin öğrenmediği sözleşme ihlalini biliyormuş gibi konuşmaması.
- `HONEST`, `WITHHOLD`, `MISDIRECT` ve `LIE` planlarının bilgi kayıtlarıyla uyumu.
- LLM’nin karar motoru seçmeden kendiliğinden yalan veya gizli gerçek üretmemesi.
- Aynı reddedilmiş teklif tekrarlandığında yeni mekanik karar örneklemesi yapılmaması.
- Yeni kanıt veya değişen şart geldiğinde müzakerenin meşru biçimde yeniden değerlendirilmesi.
- Süre aşımı, tek kontrollü tekrar ve karaktere özgü yedek cevap.
- Akış hâlindeki yarım cevabın sözleşme veya dünya komutu oluşturmaması.
- On ek referans ağacının tüm ana dalları.
- Her ağaçta en az beş kişilik/yetki kombinasyonu.
- Aynı oyuncu cümlesinin gerçek bilgi, yanlış bilgi, eski bilgi ve bilinmeyen bilgi varyantları.
- Kabul/ret/karşı teklif dağılımının yalnız kişilik etiketine değil kaynak ve yetkiye dayanması.
- Serbest karşı tekliflerin önceden yazılmış seçenek listesinde bulunmasa bile geçerli şemaya dönüştürülebilmesi.

### Kampanya ayrışma testleri

- Yüz farklı kampanya tohumu × on oyun yılı tarih parmak izi karşılaştırması.
- Aynı kampanya tohumu + aynı karar/konuşma günlüğü tekrar oynatma eşitliği.
- Aynı tohum + erken dönemde tek farklı anlamlı karar için 1/3/5/10 yıllık ayrışma eğrisi.
- Olay nedensel imzası tekrar oranı ve on yıllık periyodik döngü tespiti.
- İttifak, rejim, lider, ekonomi, savaş ve kalıcı iz kümelenme analizi.
- Ağırlıklı tarih parmak izi için medyan çift uzaklığı, küme yoğunluğu ve boyut entropisi.
- Oyuncu kararları ile ana tarih boyutları arasında müdahale/karşı-olgusal duyarlılık.
- Yalnız kampanya tohumu değiştirildiğinde oluşan gürültü ile oyuncu kararı kaynaklı ayrışmanın ayrılması.
- Tek bir baskın oyuncu stratejisinin yüz koşuda dünyayı aynı sonuca yaklaştırıp yaklaştırmadığı.
- Ölen karakter, dağılan örgüt veya yıkılan kurumun yanlışlıkla yeniden doğmaması.
- Dünya durağanlaştığında dışarıdan sebepsiz kriz yerine mevcut gerilimlerin kullanılması.
- Devam eden gerçek kıtlık/grev/borç krizinin tekrar cezasıyla yanlışlıkla susturulmaması.
- Süren krizin yeni olay kartı spam’i yerine aynı kriz kaydında şiddetlenmesi veya çözülmesi.
- `WorldScar` birleşme/arşivleme sonrasında aktif mekanik etkinin kaybolmaması.

### Kontrollü kelebek etkisi testleri

- Tek küçük kararın hassas olmayan dünyada sönümlenmesi.
- Aynı kararın eşik yakınındaki dünyada başka katmana yayılması.
- Üç küçük etkinin birikerek eşiği aşması.
- Güçlü kurum ve stok tamponlarının şoku azaltması.
- Aynı şokun farklı kurum/karakter yapılarında farklı fakat açıklanabilir sonuç üretmesi.
- Her büyüyen zincirin `originEventId` üzerinden ilk karara kadar izlenmesi.
- Zincirin `maxDepth` ve günlük olay bütçesini aşmaması.
- Büyük kırılmadan önce erken belirti oluşması.
- Çeşitlilik hedefi düşük kaldığında sistemin sebepsiz kriz enjekte etmemesi.

### Anti-meta testleri

- Altı oyuncu strateji profili × çoklu kampanya tohumu karşılaştırması.
- İlk on karar dizisinin küme analizi.
- Aynı açılışın farklı dünya koşullarındaki başarı ve maliyet karşılaştırması.
- Tek bina, yetenek, karakter veya birlik türünün zorunlu seçim hâline gelip gelmediği.
- Bilinen en güçlü stratejinin doğal karşı maliyet ve kırılganlık testleri.
- AI’nin oyuncu davranışını gözlemlemeden karşı hazırlık yapmaması.
- AI uyumunun zaman, bilgi ve kaynak harcaması.
- Oyuncu yöntem değiştirince AI’nin eski inancını anında ve hileli biçimde güncellememesi.
- Blöf ve yanlış bilgiyle AI inancının etkilenebilmesi.
- Aynı kazanma oranına rağmen oyuncu eylem dizilerinin tek çözüme yakınsayıp yakınsamadığı.

### Arayüz ve bilgi mimarisi testleri

- Aynı şehir için doğrulanmış, tahmini, söylenti ve bilinmeyen bilgi varyantları.
- Ham `StoryWorldStateV2` gizli alanlarının hiçbir domain view-modeline sızmaması.
- Dünya→şehir→karakter→sohbet→teklif→sevkiyat→kriz→tarih uçtan uca navigasyonu.
- “Şehre Gir” ekranında genel/halk/ekonomi/lojistik/yönetim/güvenlik/karakter/tarih kapsamı.
- “Yönetime Gir” ekranında makam, yetki, gündem, onay ve alternatif erişim yolları.
- “Sohbete Gir” ekranında erişim, açık konu, teklif sürümü, söz ve kanıt görünümü.
- Komutan, cumhurbaşkanı, şirket sahibi ve gayriresmî aktör rol varyantları.
- Teklif kartındaki şartların kabul edilen `NegotiationCase` sürümüyle tam eşitliği.
- UI paneli, filtre, kamera veya sekme değişiminin dünya karmasını değiştirmemesi.
- Aynı kök nedenden gelen bildirimlerin gruplanması.
- Kritik bilginin özet→görsel→uzman tablo katmanlarında tutarlılığı.
- Haber/iddia, aktör inancı ve gerçek olayın yanlışlıkla aynı gösterilmemesi.
- Eski istihbaratın son doğrulama zamanı ve güven düzeyi.
- Klavye navigasyonu, font ölçekleme, yüksek kontrast ve renk körlüğü kontrolü.
- 1366×768 hedef alt sınırında kritik karar ve sohbet alanlarının kullanılabilirliği.
- Kayıt/yükleme sonrası seçili olmayan dünya eyleminin yanlışlıkla yeniden uygulanmaması.
- Oyuncunun büyük bir değişikliğin ilk üç bilinen nedenini dış araç kullanmadan bulabilmesi.

### Harita raster ve render testleri

- Terrain/overlay kara-deniz maskesi piksel farkı.
- Kıyıda denize taşan siyasi tint ve renksiz kara şeridi görsel fark testi.
- İnce ada, körfez ve kıyı girintisi koruma fixture’ları.
- 100 ardışık sahiplik değişiminde overlay doğruluğu ve rebuild p50/p95.
- Eski `fillRect` ve yeni `ImageData` overlay benchmark karşılaştırması.
- `RegionIdRaster` checksum ve GEO/şehir sürüm uyuşmazlığı.
- Soğuk açılışta region üretim süresi ve ana thread donma ölçümü.
- 720 çağrılı mevcut warp ile adaptif Canvas/WebGL adaylarının draw-call ve kare süresi karşılaştırması.
- 720p, 1080p ve 1440p; minimum/orta/maksimum zoom görsel karşılaştırması.
- Warp sonrası dünya→ekran→dünya tıklama tersinim doğruluğu.
- Döngü içi çizim hatasının sessizce yutulmaması ve tekil telemetri kaydı.
- Çağ, palet, çözünürlük, GEO sürümü ve sahiplik değişimi için cache invalidation matrisi.
- Yalnız sahiplik değişiminde `_geoTerrain` nesne kimliğinin korunması.
- Çağ/palet terrain’i etkilediğinde görsel hash ve cache anahtarının değişmesi.
- `index.html`, README ve paket dosya listesinde aktif render kaynağı tutarlılığı.
- Yüklenmeyen kök prototipin ve olası çift map-data varlıklarının paket denetimi.

### Mevcut dünya fix regresyon testleri

- `npm test` komutunun hikâye laboratuvarını gerçekten çalıştırması.
- 8 devlet × 900 sn sabit tohum koşusunda durum hash tekrar eşitliği.
- Aynı koşunun refah, enflasyon, huzursuzluk, savaş ve olay defteri raporu üretmesi.
- Doğrudan `st.welfare` yazımlarının lint veya kod arama kapısında yakalanması.
- Refah düşüşünün kaynak, miktar, korelasyon ve kök olay etiketiyle açıklanması.
- Savaş kaynaklı enflasyon ve huzursuzluk etkilerinin aynı kök olayda sınırsız çift ceza üretmemesi.
- Faz durum tablosunda `implemented/partial/stub/missing` ayrımının test sonucu olmadan yükselmemesi.
- Eski kayıt migration/backfill raporunun tek merkezden üretilmesi.
- Kalıcı belgede satır numarası çıpalarının yerine fonksiyon/test/sözleşme adı kullanılması.

### Soak testleri

- 10, 30 ve 100 oyun yılı.
- Savaşsız dünya.
- Sürekli savaş dünyası.
- Tam ekonomik izolasyon.
- Çoklu darbe ve devlet çöküşü.
- En yüksek simülasyon hızı.

---

## 13. Ölçülecek Ana Sağlık Göstergeleri

| Alan | Gösterge |
|---|---|
| Teknik | sim adımı p50/p95/p99, bellek eğimi, kayıt boyutu |
| Determinizm | karma uyuşmazlığı sayısı |
| Ekonomi | negatif stok, aşırı enflasyon süresi, temerrüt oranı |
| Toplum | protesto/grev sıklığı, refah dağılımı |
| Siyaset | iktidar değişimi, darbe sıklığı, meşruiyet dağılımı |
| Diplomasi | antlaşma süresi, ihlal oranı, savaş öncesi gerilim |
| Askerî | savaş sıklığı, ikmal yetersizliği, kayıp mutabakatı |
| AI | geçersiz karar, plan ömrü, plan değişim nedeni, hile ihlali |
| LLM | çağrı sayısı, gecikme, geçersiz cevap, yedek kullanım oranı |
| Sohbet | tam cümle tekrarı, hitap tekrarı, anlamsal benzerlik, ses tutarlılığı, hafıza doğruluğu, bayat cevap, görüşme spam’i |
| Kampanya ayrışması | ağırlıklı tarih uzaklığı, boyut entropisi, küme yoğunluğu, nedensel zincir tekrarı, ayrışma eğrisi |
| Kontrollü kelebek etkisi | sönümlenme oranı, eşik aşımı, zincir derinliği, açıklanabilir kök olay |
| Anti-meta | strateji küme yoğunluğu, zorunlu açılış oranı, baskın strateji kapsamı, karşı maliyet |
| UX | ilk karar süresi, hedef veriye ulaşma süresi, navigasyon derinliği, açıklama kullanımı, bırakma noktası |
| UI bilgi güvenliği | gizli veri sızıntısı, yanlış kesinlik, bayat veri etiketi, teklif sürüm uyuşmazlığı |
| UI dikkat | bildirim sayısı, gruplanma oranı, cevapsız kritik karar, ekran başına sinyal yükü |
| Harita görsel doğruluğu | kıyı maskesi farkı, overlay taşması, ince geometri kaybı, görsel hash |
| Harita performansı | açılış raster süresi, overlay rebuild p95, draw-call, render p95, cache hit oranı |
| Mevcut dünya fix | headless test geçişi, refah delta tavanı, doğrudan refah yazımı sayısı, migration uyarısı, faz durum uyuşmazlığı |
| İçerik | tekrar eden olay/manşet oranı |

Hedef bantlar Faz 0 referansı ve dikey dilim verisi görülmeden keyfî olarak sabitlenmeyecektir.

---

## 14. Faz Kapanış Şablonu

Her faz için aşağıdaki rapor zorunludur:

```text
Faz:
Uygulanan kapsam:
Değiştirilen şemalar:
Yeni özellik bayrağı:
Kayıt göçü:
Otomatik testler:
Headless koşu sonucu:
Performans farkı:
Oynanış doğrulaması:
Bilinen sorunlar:
Geri alma yöntemi:
Kabul kapısı: GEÇTİ / KALDI
Sonraki faza geçilebilir mi: EVET / HAYIR
```

“Kod çalışıyor” fazın bittiği anlamına gelmez. Kabul kapısı geçmeden sonraki bağımlı faz başlamaz.

---

## 15. Riskler ve Karşı Önlemler

| Risk | Sonuç | Karşı önlem |
|---|---|---|
| Her şeyi aynı anda yazmak | Aylarca oynanamayan sürüm | Özellik bayrağı + dikey dilim |
| Tek dev sınıf/dosya | Değişikliklerin birbirini bozması | Sınırları belli sistem modülleri |
| LLM’yi dünya motoru yapmak | Uydurma, gecikme, deterministik olmama | Aday eylem + doğrulayıcı + yedek |
| Çeşitliliği saf RNG ile üretmek | Anlamsız ve açıklanamaz dünya | Yol bağımlılığı + kalıcı iz + aktör eşikleri |
| Aynı LLM promptunu sürekli kullanmak | Tekrarlayan hitaplar ve karakterlerin aynılaşması | Ses profili + konuşma hafızası + tekrar kapısı |
| Sohbeti yalnız metin yapmak | Oyuncu sözlerinin önemsizleşmesi | Yapılandırılmış konuşma eylemi ve söz defteri |
| Donanım/model gecikmesini oyun saatine bağlamak | Yavaş bilgisayarın kampanya sonucunu değiştirmesi | Yanıt sırasında saat durur + sabit konuşma zaman maliyeti |
| Oyuncu metnini talimat olarak güvenmek | Prompt enjeksiyonu ve gizli bilgi sızıntısı | Güvenilmeyen veri ayrımı + sınırlı ContextPack + şema |
| Görüşmeyi yeniden açarak karar zarını yenilemek | Sınırsız ikna ve save-scum benzeri istismar | Karar revizyonu sabitleme + dikkat/zaman maliyeti |
| Tekrar filtresini fazla sertleştirmek | Hukuki şart ve gerçeklerin bozulması | Niyet duyarlı istisnalar + sayı/şart koruması |
| Farklı dünya sonuçlarını farklı oynanış sanmak | Harita değişir ama oyuncu aynı reçeteyi kullanır | Oyuncu stratejisi parmak izi + anti-meta testleri |
| AI’ye anlık counter seçtirmek | Hile ve lastik bant hissi | Gözlem → inanç → maliyetli hazırlık zinciri |
| Her küçük kararı büyütmek | Kaotik ve okunamaz sonuçlar | Eşik, sönümleyici, taşıyıcı ağ ve zincir sınırı |
| Çok fazla birey | CPU/bellek patlaması | Kohortlar ve A/B/C karakter kademeleri |
| Her olayı her sisteme bağlamak | Kontrolsüz kelebek etkisi | Olay bütçesi, etki sınırı, korelasyon kimliği |
| Eski kayıtları sessizce bozmak | Oyuncu güven kaybı | Sürümleme, yedek, göç raporu |
| Dünya AI’ye bonus vermek | Sahte zekâ | Aynı bilgi, kaynak ve eylem sözleşmesi |
| UI’ı sona bırakmak | Anlaşılmaz simülasyon | Açıklanabilirlik her dalgada |
| UI’nin ham dünya durumunu okuması | Gizli bilgi sızıntısı ve hileli oyuncu bilgisi | `PlayerKnowledgeService` + domain view-model |
| Her veriyi ana ekrana yığmak | Oyuncunun karar verememesi | Özet → görsel → uzman tablo kademesi |
| Veriyi fazla saklamak | Oyuncunun kör karar vermesi | Neden, güven, kaynak ve ayrıntı erişimi |
| Her sistemin farklı ekran dili kullanması | Öğrenme yükü ve kaybolma | Ortak ekran grameri ve bileşen sözleşmesi |
| Sohbet anlaşmasını yalnız metinde bırakmak | Oyuncunun yanlış şartı kabul etmesi | Sürümlü teklif kartı ve açık onay |
| Bildirimleri sistem tiki başına üretmek | Uyarı seli | Kök neden gruplama ve dikkat bütçesi |
| Arazi ve overlay’i ayrı rasterize etmek | Kıyı taşması ve renksiz kara | Tek `CanonicalLandMask` |
| Düşük çözünürlüklü NN siyasi overlay | Hillshade üzerinde basamaklı sınırlar | Uyumlu raster + ölçülmüş filtre/sınır maskesi |
| Overlay’i hücre başına `fillRect` çizmek | Fetihte rebuild sıçraması | Typed array + `ImageData/putImageData` |
| Naif hücre×şehir Voronoi | Hissedilir açılış süresi | Build-time `RegionIdRaster` veya hızlı fallback |
| Warp döngüsünde sessiz `try/catch` | Hata gizlenmesi ve çağrı maliyeti | Döngü dışı doğrulama + görünür hata telemetrisi |
| `_geoTerrain` cache’ini çağ/palette rağmen tutmak | Dünya çağının görsel olarak değişmemesi | Sürümlü cache anahtarı ve merkezi invalidation |
| README/prototipi aktif kod sanmak | Yanlış entegrasyon ve çift mimari | Index tabanlı kaynak envanteri + paket testi |
| Harita görüntüsünü sim girdisi yapmak | Kamera kaynaklı sonuç farkı | Aktivasyon görünümden bağımsız |
| Savaş sonucunu özetle sınırlamak | Stratejik sistemin sahte olması | Ham, sürümlü savaş telemetrisi |
| Çok erken tam dünya | Hata kaynağının bulunamaması | Beş devletlik kanıt senaryosu |
| Gerçek zaman sayaçları | FPS ve duraklatma hatası | Sabit takvim ve zamanlayıcı |

---

## 16. Kesinlikle Yapılmayacaklar

- İlk fazda bütün mevcut hikâye kodunu silmek.
- Yeni sistemi doğrudan `storyAdvance` içine ek sayaçlarla yığmak.
- LLM’ye serbest metinle dünya durumu değiştirtmek.
- LLM’nin ürettiği aynı hazır replik havuzunu farklı karakterlere giydirmek.
- Tam yanıt metnini önbellekten sürekli aynen döndürmek.
- Karakterin bilmediği olayı yalnız dünya durumunda bulunduğu için konuşmaya eklemek.
- Oyuncunun sohbet metnini sistem talimatı, JSON komutu veya gizli veri erişim isteği olarak çalıştırmak.
- Model yanıt gecikmesini dünya simülasyonuna gerçek zaman olarak yansıtmak.
- Aynı reddedilmiş teklifi yeniden açarak farklı LLM cevabı avlamayı yeni müzakere saymak.
- Cümle tekrarını azaltmak için sözleşme şartını, sayıyı veya karakterin gerçek niyetini değiştirmek.
- Onuncu yıl gibi sabit tarihlerde bütün kampanyalara aynı büyük olayı zorlamak.
- Çeşitlilik adına nedensiz ve sonuçsuz rastgele olay yağdırmak.
- Yalnız farklı final haritalarına bakarak yeniden oynanabilirliğin başarılı olduğunu ilan etmek.
- Oyuncunun seçimine aynı tikte görünmez karşı seçim üretmek.
- Güçlü stratejiyi koşullara bağlı hâle getirmek yerine doğrudan zayıflatıp başka zorunlu meta yaratmak.
- Bütün küçük kararları yapay biçimde büyük tarihsel kırılmaya dönüştürmek.
- AI’ye oyuncunun gizli verisini vermek.
- AI’yi güçlü göstermek için gizli gelir, hasar veya görüş bonusu eklemek.
- Yeni ekonomi hazır olmadan mevcut kaynak sistemini kaldırmak.
- Kayıt şeması sürümünü artırmadan alan anlamını değiştirmek.
- Savaş motorunun hikâye için ayrı kopyasını oluşturmak.
- Ham olay kaydı olmadan yalnız özet raporla denge kararı vermek.
- Performans ölçmeden bütün karakterleri LLM ile çalıştırmak.
- Nedeni gösterilemeyen rastgele büyük kriz üretmek.
- Oynanış değeri kanıtlanmayan yüzlerce kaynak ve istatistik eklemek.
- UI bileşeninin ham `StoryWorldStateV2` alanını doğrudan okuması.
- Bilinmeyen veya tahmini değeri sıfır ya da kesin sayı gibi göstermek.
- Oyuncuya gizli karakter hedefini yalnız karakter dosyası var diye göstermek.
- Dünya etkili anlaşmayı yalnız sohbet metninde bırakıp teklif kartı oluşturmamak.
- Tabloyu tamamen yasaklamak veya bütün oyuncuları ham tabloya zorlamak.
- Kamera, filtre, sekme veya panel açma durumunu simülasyon girdisi yapmak.
- Terrain ve owner overlay için ayrı `GEO.land` scanline raster üretmek.
- Render şerit döngüsünde hataları boş `catch` ile yutmak.
- Harita cache’lerini dağınık ve gerekçesiz `null` atamalarıyla yönetmek.
- Aktif olmayan kök prototipi gerçek oyun modülü gibi belgelemek veya paketlemek.
- Refahı herhangi bir katmandan doğrudan `st.welfare` yazarak değiştirmek.
- Tek test script’i ve headless koşu olmadan denge veya faz tamamlandı iddiası koymak.
- Mevcut faz durumunu dosya varlığına, yorum satırına veya persona etiketine göre tamamlanmış saymak.
- Kalıcı planda satır numarasını ana teknik çıpa olarak kullanmak.

---

## 17. İlk Uygulama Sırası

İlk teknik çalışma yalnız şu sırayla başlamalıdır:

1. Faz 0 için mevcut hikâye referans koşularını kaydet.
2. Headless hikâye çalıştırıcısını oluştur.
3. Ham dünya telemetri şemasını oluştur.
4. Yerel 8B model yeterlilik tezgâhında Türkçe, JSON, gecikme, bellek ve tekrar taban değerlerini ölç.
5. Mevcut `STORY` alanlarının tam veri sözlüğünü çıkar.
6. `StoryWorldStateV2` şemasını yalnız adaptör arkasında oluştur.
7. Aynı anda `PlayerKnowledgeService` ve `PlayerVisibleFact` sözleşmesini kur; UI’nin ham durumu okumasını yasakla.
8. V3 kayıtları için salt-okunur göç prototipi yaz.
9. Tohumlu RNG ve sabit saat için deterministik test oluştur.
10. `storyAdvance` içindeki sistem sırasını davranış değiştirmeden zamanlayıcıya taşı.
11. Olay defterini önce yalnız gözlem modunda çalıştır.
12. İlk domain view-model ve gizli bilgi sızıntısı testini çalıştır.
13. İlk durum karması ve tekrar oynatma testini geçir.
14. Oyuncu stratejisi parmak izi telemetrisini mevcut oynanış üzerinde gözlem modunda başlat.
15. Beş devletlik dikey dilim ülkelerini ve “Enerji Koridoru Krizi”ni seç.
16. Dünya→şehir→karakter→sohbet→teklif→sonuç navigasyon zincirini ilk UI kabul akışı olarak tanımla.
17. Sohbet→söz/sır→karar→kriz→savaş/barış→hatırlama mini zincirini prototip kabul kapısı olarak tanımla.
18. Ancak bundan sonra ekonomi katmanının Faz 15 uygulamasına geç.

Bu temel tamamlanmadan şirket, nüfus, medya, LLM stratejisi veya karmaşık diplomasi geliştirmek teknik borcu yeniden büyütür.

---

## 18. Nihai Kabul Tanımı

Bu planın tamamlanmış sayılması için:

- Hikâye modu aynı savaş motorunu doğrulanmış sözleşmeyle kullanmalı.
- Oyuncu ve AI aynı dünya kurallarına tabi olmalı.
- En az 8 devlet ve 36 bölge uzun koşuda stabil kalmalı.
- Ekonomi, toplum, siyaset, karakter, medya, diplomasi ve askerî katmanlar çift yönlü etkileşmeli.
- Büyük sonuçların nedensel geçmişi görüntülenebilmeli.
- Yüz farklı on yıllık kampanya tek bir döngüye veya aynı tarih parmak izine yakınsamamalı.
- Kampanya ayrışması önemsiz isim ve RNG farkıyla değil ağırlıklı ana tarih boyutları ve oyuncu kararlarının nedensel etkisiyle kanıtlanmalı.
- Farklı kampanyalar yalnız sonuçta değil, oyuncudan talep ettiği başarılı strateji ve önceliklerde de ayrışmalı.
- Tek bir açılış, yetenek, karakter, birim veya sohbet taktiği bütün dünya koşullarında zorunlu meta olmamalı.
- AI’nin oyuncu stratejisine uyumu yalnız bu kampanyada edinilmiş bilgiye, zamana ve gerçek kaynak harcamasına dayanmalı.
- Küçük kararların çoğu yerel kalabilmeli; büyüyen kelebek etkileri eşik ve taşıyıcı ağ üzerinden açıklanabilmeli.
- Aynı tohum ve aynı karar/konuşma günlüğü tam tekrar edilebilir kalmalı.
- Oyuncunun sözleri, sırları, tehditleri ve pazarlıkları karakter hafızası ile gelecekteki kararları değiştirmeli.
- Ana karakterlerle uzun sohbetlerde aynı cümle ve hitap kalıpları rahatsız edici biçimde tekrar etmemeli.
- Karakterlerin konuşma biçimi yalnız isimleriyle değil, kişilikleri, ilişkileri, makamları ve yaşadıkları olaylarla ayırt edilebilmeli.
- Sohbet sonucu model gecikmesinden, konuşmayı yeniden açmaktan veya prompt enjeksiyonu denemesinden etkilenmemeli.
- On bir referans sohbet senaryosu Faz 63.1’de fikstürsüz, gerçek alt sistemlerle uçtan uca çalışmalı.
- Dünya, şehir, yönetim, ekonomi, diplomasi, ordu, toplum, karakter, sohbet, kriz ve tarih çalışma alanları aynı bilgi mimarisiyle bağlanmalı.
- Oyuncu veriye özet, görsel ve uzman tablo katmanlarında erişebilmeli; önemli karar için dış rapora ihtiyaç duymamalı.
- UI yalnız oyuncunun bildiği veriyi, kaynağı, güveni ve güncelliğiyle göstermeli.
- “Şehre Gir”, “Yönetime Gir” ve “Sohbete Gir” temel yolculukları Faz 63.2 kabulünü geçmeli.
- Terrain, siyasi overlay, kıyı, hit-test ve region ataması tek kanonik kara maskesinden türemeli.
- Siyasi overlay kıyıda denize taşmamalı veya renksiz kara şeridi bırakmamalı; hillshade üzerinde düşük çözünürlüklü merdiven etkisi oluşturmamalı.
- Harita açılışı, overlay rebuild’i ve kare render süresi hedef cihaz bütçelerini geçmemeli; render döngüsü hataları sessizce yutmamalı.
- Çağ/palet değişiklikleri ilgili terrain cache’ini yenilemeli; sahiplik değişikliği gereksiz terrain üretmemeli.
- README, `index.html` ve dağıtım paketi tek aktif harita render mimarisini göstermeli.
- AI gizli bonus olmadan geçerli uzun ve kısa vadeli kararlar verebilmeli.
- LLM çevrimdışı kaldığında kampanya oynanabilir kalmalı.
- Kayıt/yükleme deterministik devam etmeli.
- Ham telemetri olmadan hiçbir “AI gelişti” veya “denge düzeldi” iddiası kabul edilmemeli.
- İlk 10 dakika oyuncuya rolünü, dünyanın durumunu ve ilk anlamlı kararını açıkça vermeli.

Bu noktaya gelindiğinde ortaya yalnızca daha büyük bir sistem değil; oyuncunun kararlarını hatırlayan, sonuçlarını açıklayan ve kendi içinde tutarlı yeni tarihler üreten bir hikâye modu çıkmış olacaktır.
