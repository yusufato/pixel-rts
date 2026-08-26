# Pixel RTS Hikâye Modu — Kaynak ve Kapsam Matrisi

> Durum: yaşayan yönlendirme belgesi
> Son envanter: 25 Ağustos 2026
> Operasyon: 25 Ağustos Atlas Operasyonu

## Amaç

Bu dosya bir sonraki çalışmada hedefe dosya arayarak değil, sistem sözleşmesinden
gidilmesini sağlar. Her satır şunları bağlar:

```text
oyuncu sonucu -> kanonik kaynak ailesi -> açıklama -> test kanıtı
              -> doğrulanmış risk -> sonraki karar/plan
```

Ayrıntılı çalışma mantığı [Oyun Mantığı, Amaç ve İşleyiş](OYUN_MANTIGI_AMAC_VE_ISLEYIS.md),
bug kanıtları [Sistem Atlası](HIKAYE_MODU_SISTEM_ATLASI.md), öncelikli eksik
testler [TEST_GAPS](../../../TEST_GAPS.md) içindedir.

## Durum dili

| Durum | Anlamı |
|---|---|
| İlk dikey tamamlandı | Kaynak, runtime karşı örneği ve hedefli test birlikte incelendi; bütün gelecek bugların bulunmuş olduğu iddiası değildir |
| Sağlıklı sözleşme | Ters örnek denenmiş ve seçilmiş invariant geçmiştir; sonraki değişiklikte korunur |
| Açık bug | Çalışan kodda karşı örnekle kanıtlanmış davranış hatası vardır |
| Ürün kararı | Birden fazla makul davranış vardır; koddan önce kullanıcı seçimi gerekir |
| Faz sınırı | Sistem güvenli biçimde taslak/non-executable veya salt veri sözleşmesidir |
| Electron kabulü gerekli | Headless kanıt, gerçek tıklama/render/ekran geçişinin yerine geçmez |

## Sistem matrisi

| Sistem / oyuncu sonucu | Kanonik kaynak ailesi | Ana test veya prob | Güncel sonuç | Açık hedef |
|---|---|---|---|---|
| Kurulum, yeni kampanya, saat | `Story.js`, `StoryClock.js`, `StoryScheduler.js`, `StoryRng.js`, `StoryMigration.js` | clock/scheduler/RNG/migration probları | Deterministik sabit adım ve migration sağlam; gerçek kurulum tıklaması ayrı | Electron setup→world kabulü |
| Kayıt, yükleme, devam | `Story.js` ve bütün `*ForSave/*Restore` defterleri | çoklu save/load probları | Alt defterler güçlü; bekleyen savaş ödülü devam UI'sında kayıp | LIFE-03 ve gerçek continue kabulü |
| Kampanya sonucu | `Story.js` savaş dönüşü ve yenilgi kontrolü | battle telemetry; harness stub denetimi | Kayıp/beraberlik ödülü ve son bölge mesajı hatalı; genel zafer kararsız | K-01/K-02, LIFE-01/02/04 |
| Makro dünya ve egemenlik | `StoryRegions.js`, `StoryWorldV2.js`, `Story.js` | world/peace/conquest karşı örnekleri | Düşmanlık kapıları sağlam; fetih bağımlı defterlerle atomik değil | WORLD-01/03, K-07 |
| Fiziksel hex coğrafya | raster, `StoryHexWorld/Geography/Regions/Settlements` | altı hedefli hex probu | Kara/kıyı/bölge/şehir ankrajı deterministik ve geçerli | Değişiklikte kanıt uydurmama invariantı |
| Doğal kaynak, tarım, arazi | `StoryHexNaturalResources/Agriculture/Sites/LandManagement` | natural/agriculture/sites testleri | Kanıtsız toprak/ürün/maden gerçeğe terfi etmiyor | Gerçek veri gelirse kaynak sürümü ve migration |
| Hex imar ve fiziksel tesis | `StoryHexConstruction`, `StoryInfrastructureWorks` | construction/application/infrastructure testleri | Başvuru→komut→rezervasyon→makbuz yolu çalışıyor | Konsey ve eski şehir binalarını bu kapıya bağlama |
| Bölge ölçekleme | `StoryActivation`, `StoryAggregation` | activation/aggregation probları | UI-neutral, deterministik ve korunumlu; COLD canlı yürütme değil | Faz sınırını koru; performans değişiminde A/B |
| Kaynak, üretim, stok, fiyat | `StoryResources`, `StoryProductionSectors`, `StoryRegionalEconomy`, `StoryMarket` | resource/production/regional/market probları | Ayrıntılı ekonomi çalışıyor; stratejik sayaçlarla çift gerçeklik var | COUNCIL-01, MIL-01 |
| Devlet bütçesi ve dış ticaret | `StoryBudget`, `StoryTrade`, `StoryCommerce` | budget/trade/sale probları ve para karşı örneği | Escrow/satış yolları güçlü; gümrük örneği +0,2142 para yaratıyor | ECON-01, K-05 |
| Şirket, banka, kredi | `StoryCompanies`, `StoryEconomicAI`, `StoryMechanicalContracts` | company/sale/credit çapraz probları | Sahip rolü payla eşleşmiyor; kurul ve faaliyet durumu bypass ediliyor | K-04 ve ortak kredi komutu |
| Devlet kapasitesi ve oyuncu ajansı | `StoryInstitutions`, `StoryStateCapacity`, `StoryGovernance`, `StoryPlayerAgency*` | institution/capacity/governance/agency probları | Domainler ayrı geçiyor; makam cache'i ve yaşam kapısı çaprazda bozuk | governance cache, CHAR-01 |
| Seçim, iktidar, bütünlük, darbe | `StoryElections`, `StoryIntegrity`, `StoryPoliticalCrisis`, `StoryPowerCenters` | election/integrity/crisis probları | Mandat/kriz kayıtları sağlam; gerçek EXECUTIVE devri ayrışıyor; yaptırım fazı yok | K-03, POL-01/02/03 |
| Takvim ve konsey | `Council.js`, `StoryClock.js`, `StoryBudget.js` | council telemetry + üç runtime karşı örneği | Eski önergeler kanonik domainleri atlıyor; exception ödeme sonrası sahte başarı | COUNCIL-01/02, K-11 |
| Karakter kimliği ve yaşam | `StoryCharacters`, role/power/career/life alt katmanları | identity/career/life/activation probları | Kimlik ve kayıt sağlam; DEAD/RETIRED PlayerAgency kullanabiliyor | CHAR-01, Atlas açık karar 11 |
| İlişki, hafıza, karar | `StoryRelationships`, `StoryMemory`, `StoryDecisionTrace`, behavior/action/arbiter | relation/memory/trace/action probları | Yönlü ilişki, sahip olunan hafıza ve açıklanabilir karar sınırı sağlam | Kaynak olay referans bütünlüğü |
| Temas, konuşma, müzakere | `StoryContacts`, conversation/discourse/domain modülleri, `Talks`, `StoryNegotiation` | uzun konuşma, understanding ve delivery probları | Ticari zincir bağlı ve güvenli; dokuz özel senaryo lab-only | K-24 ve ayrı domain adaptörleri |
| Nüfus, ihtiyaç, göç | `StoryPopulation`, `StoryNeeds`, `StoryHumanMigration` | population/needs/migration probları | Kişi korunuyor; şikâyet hafızası taşınmıyor; gerçek demografik geçiş yok | DEMO-01, K-06 |
| Kamuoyu ve kolektif eylem | `StoryOpinion`, `StoryCollectiveAction`, `StorySocial`, `StoryPowerCenters` | opinion/collective probları | Hardship→şikâyet→eylem zinciri çalışıyor; fetihte şirket attribution yanlış | WORLD-03 |
| Lojistik ve rota | `StoryInfrastructure`, `StoryRoutePlanner`, `StoryTransportAgents`, `StoryTrade` | rota/araç/multimodal/vertical testler | Temel fiziksel teslimat güçlü; reroute terminali ve lease yaşamı bozuk | LOG-01/02/03, K-15/16/17 |
| Diplomasi ve savaş ilanı | `Talks`, `StoryAI`, `StoryPlayerAgency`, `Story.js` | peace probe ve yaşam/yetki karşı örneği | Barış saldırı kapıları sağlam; harita emekli oyuncuya savaş ilanı açıyor | WORLD-02, K-08 |
| Askerî üretim ve garnizon | `Production.js`, `Story.js`, taktik havuz köprüsü | üretim/savaş havuzu kaynak denetimi | Oynanabilir tipli ordu havuzu var; ayrıntılı mal/tesis/kohortla tam mutabakat yok | MIL-01, K-12 |
| Teknoloji ve çağ | `techTree.js`, `Era.js`, `Story.js`, `Council.js` | tech/era karşı örnekleri | Kademe 3–4 önceliği yürütücüsüz; çağ paydası ve event wiring eksik | TECH-01, ERA-01/02, K-10/K-13 |
| Bilgi, haber, şehir dosyası, UI | `PlayerKnowledge`, `StoryProjection`, `StoryCityDossier`, `News`, `StoryUI/Render` | projection/city dossier/UI fixtürleri | Genel bilgi sınırı sağlam; teknoloji paneli ham rakip sayısını sızdırıyor | INFO-01 |
| Harita ve görsel katalog | map raster/cache/renderer/political overlay, `StoryVisualCatalog` | renderer/visual/overlay/cache testleri | Fiziksel varlık→görsel zinciri hedefli testlerde geçti | Gerçek Electron görsel kabulü |
| Telemetri ve performans | `StoryTelemetry`, bridge, scheduler, profiler araçları | uzun simülasyon ve hedefli performans probları | Salt gözlem hattı var; telemetry-off dünya sonucu değişmemeli | Her bugfixte p95 ve deterministik A/B |

## Çapraz-defter kırmızı bölgeleri

Tek modül testi bu sınırları kapatmaz. Önce aşağıdaki ortak invariantlar aranır:

| Sınır | Birlikte okunacak gerçekler | Mevcut risk |
|---|---|---|
| İktidar | election + institution + career + governance + crisis | İki farklı yürütme sahibi |
| Fetih | node owner + population + needs + opinion + facility owner | Geçici eski egemen ve yanlış şirket attribution |
| Para | payer + budget journal + company cash + escrow + tax recipient | Gümrükte açıklanamayan artış |
| Sevkiyat | order + cargo lot + route + reservation + agent + terminal | Eski terminal ve süresi dolan canlı lease |
| Karakter yetkisi | life status + role + office + PlayerAgency + UI entry | DEAD/RETIRED ve harita bypass'ı |
| Konsey | vote + payment + domain result + receipt + UI text | Ödeme sonrası exception ve sahte başarı |
| Askerî üretim | strategic wallet + regional stock + facility + labor/cohort + army | İki üretim gerçekliği |
| Bilgi | world fact + knowledge status + projection + panel render | Panel bazlı ham dünya sızıntısı; K-09 |

## Bir sonraki oturumda kullanım

1. İstenen sistemi bu matristen seç.
2. Kaynak ailesini ve ilgili Atlas bulgusunu aç.
3. Mevcut testin neyi gerçekten kanıtladığını TEST_GAPS'ten oku.
4. Ürün kararı varsa kod yazmadan karar kapısını sonuçlandır.
5. Dar bug ise ayrı `plans/<slug>.md`, önce-kırmızı test ve geri alma sınırı oluştur.
6. Sonuçtan sonra bu matrisin “güncel sonuç” ve “açık hedef” hücrelerini güncelle.

Bu matris kaynak dosyalarının tek tek arşiv envanteri değildir. Aynı davranış
birden fazla dosyaya yayıldığı için sahiplik sistem ailesi düzeyinde tutulur;
yeni bir modül ancak oyuncu sonucu ve kanonik veri sahibiyle birlikte eklenir.
