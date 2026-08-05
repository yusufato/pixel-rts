# Hikâye Modu Katmanlı Dünya Simülasyonu — Uygulama Durumu

**Başlangıç tarihi:** 30 Temmuz 2026  
**Plan:** `HIKAYE_MODU_KATMANLI_DUNYA_SIMULASYONU_PLANI.md`  
**Son kapanan faz:** Faz 31 — Seçim ve İktidar Değişimi

**Aktif uygulama sırası:** Faz 32 — Patronaj, Yolsuzluk ve Soruşturma
**Modern dünya gap defteri:** `MODERN_DUNYA_EKSIKLERI.md`

## Faz tablosu

| Faz | Durum | Kanıt |
|---|---|---|
| Faz 0 — Mevcut davranışın dondurulması | `implemented` | `npm run story:baseline`, `qa-runtime/story-phase0-baseline.json` |
| Faz 1 — Hikâye test laboratuvarı | `implemented` | `npm test`, `npm run test:story:soak`, `npm run story:report` |
| Faz 2 — Telemetri ve dünya sağlık raporu | `implemented` | Kaynak/savaş/LLM/perf/durum karması aynı sürümlü hatta; savaş sözleşmesi hedefli probla doğrulanıyor |
| Faz 3 — Özellik bayrakları ve karşılaştırma | `implemented` | `js/StoryFeatures.js`, bilinmeyen bayrak reddi, gözlem-katmanı tarafsızlık testi, `npm run story:ab` |
| Faz 3.1 — Yerel 8B yeterlilik tezgâhı | `implemented` | `npm run story:llm-bench`, katı sonuç `0/5`; model yetkisi kısıtlandı |
| Faz 4 — StoryWorldStateV2 şeması | `implemented` | `js/StoryWorldV2.js`; boş dünya, V1 adaptörü, sabit kimlik, katı doğrulama |
| Faz 4.1 — Oyuncu bilgi görünümü | `implemented` | `js/PlayerKnowledge.js`; gizli değer sızıntısı ve bilgi sınıfı testleri |
| Faz 5 — V3 kayıt göçü | `implemented` | `js/StoryMigration.js`; byte-byte yedek, checksum, ayrı V2 hedefi, göç raporu ve sıfır-yazma hata testleri |
| Faz 6 — Deterministik saat ve takvim | `implemented` | `js/StoryClock.js`; 0,25 sn sabit tik, 1×/2×/4×, takvim, saat kaydı ve FPS/hız eşdeğerlik testleri |
| Faz 7 — Tohumlu rastgelelik | `implemented` | `js/StoryRng.js`; dokuz bağımsız akış, kayıt/yükleme devamlılığı, izolasyon karşı-testi ve doğrudan `Math.random` yasağı |
| Faz 8 — Sistem zamanlayıcısı | `implemented` | `js/StoryScheduler.js`; 18 görevlik sürümlü sıra, A/B yolu, kayıt/yükleme tam devamlılık testi |
| Faz 9 — Olay defteri ve komut hattı | `implemented` | `js/StoryCausality.js`; idempotency, geri izleme, kayıt/yükleme, sahiplik/refah/kaynak/AI hareketi/diplomasi kapıları ve tarafsızlık A/B testi |
| Faz 10 — Değişmezler ve zincir sigortası | `implemented` | Derinlik/tekrar/komut/olay/etki bütçeleri, domain değişmezleri, dünya–defter mutabakatı ve bozuk kayıt fallback testleri |
| Faz 10.1 — UI projeksiyon ve nedensellik tezgâhı | `implemented` | `js/StoryProjection.js`, bilgi-sızıntısı doğrulayıcı, DOM değişim rozeti ve komut→olay→etki izi |
| Faz 11 — Bölge veri modeli | `implemented` | `js/StoryRegions.js`; 152 kimlik/topoloji mutabakatı, kayıt backfill/kurtarma ve `qa-runtime/story-phase11-ab.json` |
| Faz 12 — Sıcak/Ilık/Soğuk aktivasyon | `implemented` | `js/StoryActivation.js`; `12/48/92` bütçe, kamera/panel tarafsızlığı ve `qa-runtime/story-phase12-ab.json` |
| Faz 13 — Toplulaştırma ve ayrıntılandırma | `implemented` | `js/StoryAggregation.js`; 152 tam gidiş-dönüş, checksum/topoloji kapısı, koruma imzası ve `qa-runtime/story-phase13-ab.json` |
| Faz 14 — Altyapı ve ulaşım grafı | `implemented` | `js/StoryInfrastructure.js`; 591 koridor, kesinti izolasyonu, kompakt kayıt ve `qa-runtime/story-phase14-ab.json` |
| Faz 14.1 — Şehir dosyası ilk oynanabilir sürüm | `implemented` | Bilgi filtreli şehir dosyası, rota/olay/karakter geçişi ve sentinel sızıntı testi |
| Faz 14.2 — Kanonik kara maskesi ve region raster | `implemented` | `js/StoryMapRaster.js`; tek `820×645` kaynak, checksum/bozuk veri kapıları, gerçek render cache probu ve `qa-runtime/story-phase14.2-ab.json` |
| Faz 14.3 — ImageData politik overlay | `implemented` | `js/StoryPoliticalOverlay.js`; kanonik RGBA/sınır maskesi, `47.137→1` Canvas çağrısı, fetih revision testi ve `qa-runtime/story-phase14.3-ab.json` |
| Faz 14.4 — Region atama ve açılış performansı | `implemented` | 43.064 bayt build-time RLE asset, checksum/fallback kapıları, deterministik üretim ve `qa-runtime/story-phase14.4-ab.json` |
| Faz 14.5 — Adaptif warp ve render bütçesi | `implemented` | 1080p `%40` draw-call azalması, ortak plan cache’i, hata-yutmayan çizim ve `qa-runtime/story-phase14.5-ab.json` |
| Faz 14.6 — Harita cache, çağ/palet ve dokümantasyon temizliği | `implemented` | `js/StoryMapCache.js`; sürümlü scope kapısı, gerçek çağ paleti, aktif/arşiv kaynak testi ve `qa-runtime/story-phase14.6-ab.json` |
| Faz 15 — Kaynak taksonomisi | `implemented` | `js/StoryResources.js`; sekiz kaynaklık sürümlü katalog, yüksek kayıplı eski alan adaptörü ve `qa-runtime/story-phase15-ab.json` |
| Faz 16 — Altı üretim sektörü | `implemented` | `js/StoryProductionSectors.js`; altı sürümlü reçete, doğal kapasite/kütle koruması, darboğaz teklif motoru ve `qa-runtime/story-phase16-ab.json` |
| Faz 17 — Bölgesel tüketim ve stok | `implemented` | `js/StoryRegionalEconomy.js`; 152 bölgelik kanonik stok, atomik üretim, öncelikli tüketim, rezerv/kıtlık yaşam döngüsü ve `qa-runtime/story-phase17-ab.json` |
| Faz 17.1 — Modern barış başlangıcı | `implemented` | 28/28 `peace` kenarı, ortak savaş/kuşatma düşmanlık kapısı, 120 sn `0↔5` sahiplik A/B karşı-testi |
| Faz 18 — Ticaret ve lojistik akışı | `implemented` | `js/StoryTrade.js`; fiziksel sevkiyat, ortak kapasite, kesinti/yönlendirme, teslimatta mülkiyet ve `qa-runtime/story-phase18-ab.json` |
| Faz 19 — Piyasa ve fiyat oluşumu | `implemented` | `js/StoryMarket.js`; 152×6 fiyat, stok günü, rota riski, yumuşatma/tavan, hane/üretici sepeti ve `qa-runtime/story-phase19-ab.json` |
| Faz 20 — Devlet bütçesi, para ve ödeme | `implemented` | `js/StoryBudget.js`; çift taraflı fiş, nakit/borç/faiz/para basımı/temerrüt, ticaret escrow’su, eski aktif yük göçü ve `qa-runtime/story-phase20-ab.json` |
| Faz 21 — Şirketler ve bankalar | `implemented` | `js/StoryCompanies.js`; 48 şirket, 8 banka, 412 tesis, 152 depo, ayrı bilanço/mülkiyet/kredi/yatırım/iflas hattı ve `qa-runtime/story-phase21-ab.json` |
| Faz 22 — Ekonomik AI politikaları | `implemented` | `js/StoryEconomicAI.js`; açıklanabilir aday/puan/seçim/sonuç defteri, hilesiz kredi-yatırım-destek kapıları ve `qa-runtime/story-phase22-ab.json` |
| Faz 22.1 — Sanayi bootstrap ve ekonomik stabilizasyon | `completed` | Faz 22.1E varsayılan canlı yol: gerçek satış uzlaşması + dört-pencere Pareto hacmi + ülke içi hane dağıtımı. `60 sn` `%89,94/%85,16/%75,69`; `300 sn` `%79,56/%83,42/%71,48`; `900 sn` final `%76,55/%77,56/%70,82`; son 300 sn `%79,54/%79,31/%71,24`. Sekiz doğrulayıcı, kayıt/yükleme, deterministik tekrar ve `10.712` hatasız sevkiyat geçti. Tam test karması `9dd9f7fc…4719`; rota çözümleme maliyeti açık performans borcu. |
| Faz 23 — Nüfus kohortları | `implemented` | `js/StoryPopulation.js`; 152 bölge × 12 kohort, tam kişi/ülke mutabakatı, kohort kaynaklı sonlu işgücü, bilgi filtreli şehir görünümü ve `qa-runtime/story-phase23-ab.json` |
| Faz 24 — İhtiyaç, refah ve güvenlik | `implemented` | `js/StoryNeeds.js`; fiziksel tahsisten türeyen 1.824 kohort sonucu, farklı ihtiyaç ağırlıkları, grev/kuşatma etkisi, bilgi filtreli UI ve `qa-runtime/story-phase24-ab.json` |
| Ara tasarım sözleşmesi — Proje, varlık, bakım ve B2B hizmet | `planned` | Dış analiz kabul edildi; `ProjectV1 → WorldAssetV1`, gerçek bakım, mekanik sözleşme ve hizmet teslim fişi omurgası ana plana işlendi. Faz 22.1E kapısı geçti; şirket sahibi merceği kabulünden sonra kodlanacak, `NegotiationCase` mekanik sözleşme sayılmayacak. |
| Faz 25 — Kamuoyu ve Şikâyet Hafızası | `implemented` | `js/StoryOpinion.js`; 1.824 kohortta sorun/algılanan aktör/dayanak/tekrar/iyileşme taşıyan sınırlı hafıza, bilgi filtreli UI, kompakt kayıt ve `qa-runtime/story-phase25-ab.json` |
| Faz 26 — Protesto, Grev ve Radikalleşme | `implemented` | `js/StoryCollectiveAction.js`; eşik+histerezisli protesto/grev/ayaklanma, bölgesel fiziksel etki, bastırma hafızası, devlet cevabı, bilgi filtreli UI ve `qa-runtime/story-phase26-ab.json` |
| Faz 27 — Göç ve Mülteci Akışı | `complete` | İç/dış göç ve mülteci akışı gerçek rota, gecikme, kapasite ve atomik kohort aktarımıyla çalışıyor |
| Faz 28 — Güç Merkezleri | `complete` | `js/StoryPowerCenters.js`; 8 devlet × 7 kimlikli merkez, kanonik destek/kaynak kanıtı, Faz 26 örgüt bağlantısı, bilgi filtreli UI ve `qa-runtime/story-phase28-ab.json` |
| Faz 29 — Rejim ve Kurum Şeması | `complete` | `js/StoryInstitutions.js`; 8 devlet × 5 kurum, 29 eylemde DIRECT/JOINT/PETITION/yasak rotası, makam doğrulama, bilgi filtreli UI ve `qa-runtime/story-phase29-ab.json` |
| Faz 30 — Meşruiyet ve Devlet Kapasitesi | `complete` | `js/StoryStateCapacity.js`; ayrı meşruiyet/bürokrasi/hukuk/bütünlük/yapısal risk/bölgesel denetim, açıklanabilir uygulama bileti yaşam döngüsü ve `qa-runtime/story-phase30-ab.json` |
| Faz 31 — Seçim ve İktidar Değişimi | `complete` | `js/StoryElections.js`; rejime bağlı model/takvim, tam kişi kohort oyu, koalisyon, itiraz, sertifika, mandat, makam devri, bilgi filtreli UI ve `qa-runtime/story-phase31-ab.json` |
| Faz 32 — Patronaj, Yolsuzluk ve Soruşturma | `next` | Atama/ihale/rüşvet/sızıntı/soruşturmayı kanıt, kurum kapasitesi ve fail kimliğiyle kuracak; suçlama otomatik gerçek olmayacak |
| Faz 33+ | `missing` | Bağımlılık sırasıyla uygulanacak |

`partial`, dosya bulunduğu fakat bütün kabul kapılarının geçilmediği anlamına gelir.

## Faz 4–4.1 dünya ve bilgi sözleşmesi

Yeni salt-okunur çekirdek:

- `js/StoryWorldV2.js`
  - `StoryWorldStateV2` üst sözleşmesi ve `schemaVersion: 2`
  - `country:`, `region:`, `character:`, `force:`, `event:` ve `decision:` sabit kimlikleri
  - yeni kampanya için eksiksiz boş varsayılan
  - mevcut V1 `STORY` durumundan kopya/adaptör
  - eksik üst alan, şema dışı üst alan, bozuk saat, çakışan kimlik ve kırık referans hata kodları
- `js/PlayerKnowledge.js`
  - `PlayerVisibleFact`
  - `UNKNOWN`, `ESTIMATED`, `RUMOR`, `VERIFIED`
  - değer yanında güven, kaynak, gözlem zamanı ve son kullanma zamanı
  - kendi ülke/bölge verisi ile yabancı gizli veriyi ayıran projeksiyon

Kabul kanıtı:

- V2 dışa aktarımı öncesi/sonrası canlı V1 dünya karması aynıdır.
- Dışa aktarılan nesneyi değiştirmek canlı dünyayı değiştirmez.
- Sekiz ülke ve 152 bölgenin tamamı adaptörde bulunur.
- Yabancı hazineye enjekte edilen `987654321` ve gizli refah işareti oyuncu görünümünde bulunmaz.
- Kendi hazine değeri `VERIFIED`; yabancı hazine `UNKNOWN` ve `value: null` olur.
- `UNKNOWN` bilgiye değer veya sıfırdan büyük güven ekleme girişimi reddedilir.

Sınır: V2 henüz canlı simülasyonun tek gerçek kaynağı değildir. Faz 5 ayrı ve doğrulanmış bir V2 gölge kaydı üretir; canlı yükleme yolu V3’ü kullanmaya devam eder. Böylece sonraki çekirdek fazları hazır olmadan oyuncu kaydı yeni çalışma zamanına zorlanmaz.

## Faz 5 güvenli kayıt göçü

Yeni aktif hat:

- `storyMigrationV3RawToV2(raw)`: depolamaya dokunmayan saf V3→V2 dönüştürücü.
- Kaynak: `pixelrts_story_v3`; göç bu anahtara hiçbir koşulda yazmaz.
- Yedek: `pixelrts_story_v3_backup_phase5`; kaynakla byte-byte aynı olmalı ve checksum doğrulamasını geçmeli.
- Hedef: `pixelrts_story_world_v2`; ayrı anahtara yazılır, tekrar okunur ve V2 şema doğrulayıcıdan geçirilir.
- Rapor: `pixelrts_story_v3_migration_report`; kaynak/hedef checksum, kayıt sayıları, backfill’ler, uyarılar ve hataları taşır.
- Mevcut anahtarın adı V3 olmasına rağmen canlı payload `v: 2` yazdığı için bu uyumsuzluk göç raporunda açık uyarı olarak korunur.

Kabul kanıtı:

- İlk başarılı göç yalnız `yedek → V2 hedef → rapor` sırasıyla üç yazma yapar.
- Kaynak kayıt ve yedek byte-byte aynıdır.
- Yazılan V2 kaydı `storyWorldV2Validate` kapısını geçer.
- Devlet ve bölge sayıları eksilmez.
- Bölge sahipliği ve devlet kaynakları bire bir korunur.
- Oyuncu komutanı `PLAYER_COMMANDER` rolüyle karakter/kuvvet modeline taşınır.
- Bozuk JSON ve eksik/bozuk kayıt göç öncesi reddedilir; yazma sayısı `0` kalır.
- Farklı mevcut yedek veya farklı mevcut hedef sessizce ezilmez; yazma sayısı `0` kalır.
- Göç probu canlı dünya karmasını değiştirmez.

Faz 5 bilinçli olarak canlı `storyLoad()` fonksiyonunu V2’ye çevirmedi. Gölge hedef, yeni çekirdek gerçek çalışma kaynağı olmadan önce veri uyumluluğunu kanıtlar; bu sınır geri dönüşsüz kayıt kaybını engeller.

## Faz 6 deterministik saat ve takvim

Yeni aktif hat:

- `js/StoryClock.js`: sürümlü saat durumu, sabit tik ve takvim servisi.
- Dünya adımı: tam `0,25` oyun saniyesi.
- Hızlar: `1×`, `2×`, `4×`; hız düğmesi hikâye komuta çubuğunda bulunur.
- Duraklatma gerçek süreyi veya kısmi tik kuyruğunu tüketmez.
- Saat kaydı: `speed`, `tick`, `accumulatorSeconds`, `fixedStepSeconds`.
- Takvim: `01.01.2032` başlangıcı, 360 gün/yıl, 30 gün/ay, 120 oyun saniyesi/yıl.
- `time.fixedStep` bayrağı eski değişken-adım yoluyla kontrollü A/B karşılaştırması sağlar.

Kabul kanıtı:

- 30, 60 ve 144 FPS desenleri 30 oyun saniyesinde tam `120` tik ve aynı dünya karmasını üretir.
- Düzensiz/jitter kare dizisi aynı karmayı üretir.
- `1×` 30 gerçek saniye, `2×` 15 gerçek saniye ve `4×` 7,5 gerçek saniye aynı dünya durumunda biter.
- Eski değişken-adım yolu 30 ve 144 FPS’te farklı karma üretir; düzeltilen hata hedefli A/B ile görünürdür.
- Duraklatılmış dünyaya 10 saniye verilmesi saat, dünya karması veya `0,125` saniyelik kısmi kuyruğu değiştirmez.
- `12,0` oyun saniyesi + `0,125` saniye kuyruk kaydedilip aynen yüklenir; yeni `0,125` saniye tek tik üretir.
- `119,999` saniye `30.12.2032`, `120` saniye `01.01.2033`, `1200` saniye `01.01.2042` olur.
- Menü veya savaş ekranından dünyaya dönüşte eski render zaman damgası hayalet dünya süresi üretmez.
- Headless konsey gerçek EXE’deki gibi tik ortasında değil, iki tik arasında çözülür.

Sabit saat bir denge düzeltmesi değildir. Yeni `900` saniyelik karma ve sonuçların eski değişken-adım tabanından farklı olması beklenir: laboratuvar artık gerçek oyunla aynı sabit tik sırasını kullanır. Bundan sonraki bütün denge karşılaştırmaları Faz 6 sonrası tabanı esas almalıdır.

## Faz 7 tohumlu ve ayrılmış rastgelelik

Yeni aktif hat:

- `js/StoryRng.js`: `mulberry32-streams-v1`, tek kök tohum ve dokuz bağımsız akış.
- Akışlar: dünya, karakter, askerî, ekonomi, toplum, üretim, diplomasi, anlatı ve yönetim.
- Her akış `state` ve `calls` alanıyla V3 kayda girer.
- V2 teşhisi kök tohum ve bütün akış durumlarını taşır.
- Motor içi durum karması gelecekteki rastgele durumu da kapsar.
- `rng.streams` bayrağı açıkken izolasyon, kapalıyken kontrollü tek-akış A/B davranışı verir.
- Hikâye domainlerinde doğrudan `Math.random()` otomatik testle yasaktır.

Kabul kanıtı:

- Aynı kök tohum kampanya kuruluşunda aynı dokuz akış durumunu üretir.
- Farklı kök tohum askerî diziyi değiştirir.
- Kayıt/yükleme bütün state ve çağrı sayaçlarını aynen korur.
- Kayıttan sonraki her akışın sekiz değeri yükleme sonrasında kesintisiz koşuyla aynıdır.
- Anlatıya eklenen 100 rastgele çağrı askerî diziyi değiştirmez.
- Akış izolasyonu bayrakla kapatıldığında aynı 100 çağrı askerî diziyi değiştirir.
- Bilinmeyen akış adı sessizce kabul edilmez.
- RNG alanı bulunmayan eski kayıt iki ayrı yüklemede aynı fallback durumunu üretir ve uyarı taşır.
- Karakter ekranındaki tekrar zarları AI dünya kuruluşunun rastgele sırasını tüketmez; kampanya aynı kök tohumla temiz başlar.

Sınır: RNG dizisinin ve bütün dünya kaydının kaydet→yükle devamlılığı Faz 8 ile tamamlandı. Bir sonraki sınır, sonucu aynı üretmekten öte her kalıcı değişimin komut/olay/etki neden zincirini kurmaktır.

## Faz 8 sistem zamanlayıcısı ve tam devamlılık

Yeni aktif hat:

- `js/StoryScheduler.js`: on sekiz periyodik görev için tek sıra ve sürümlü durum.
- Görev durumu: periyot, geçen süre, çalışma sayısı ve son çalışma sıra numarası.
- `scheduler.registry`: merkezî sicil ile eski `_acc...` yolunu karşılaştıran geri dönüş bayrağı.
- V3 kayıt: saat, RNG ve scheduler yanında dünya sonucunu etkileyen runtime cooldown/amaç alanlarını korur.
- V2 adaptör/göç: tam scheduler görünümünü teşhis alanına taşır.
- Konuşma kuyruğu: canlı seçenek fonksiyonları RNG fotoğrafı ve seçim iziyle yeniden kurulur; yükleme yeni RNG tüketmez.
- Motor içi durum karması artık scheduler durumunu da kapsar.

Kabul kanıtı:

- On dört saniyede her görevin beklenen çalışma sayısı ayrı doğrulanır.
- Ardından verilen `0,25` saniye, vadesi gelmeyen hiçbir görevi ikinci kez çalıştırmaz.
- Merkezî sicil ve eski sayaç yolu aynı 30 saniyelik dünya sonucunu üretir.
- `73,125` saniyede kaydedilen kampanya yeni süreçte yüklenip `90,875` saniye daha çalıştırıldığında, kesintisiz `164` saniyelik kampanyayla performans süreleri dışında bütün kayıt bire bir aynıdır.
- Scheduler taşımayan eski kayıt açılır ve sessiz olmayan fallback uyarısı üretir.
- AI `_objective`, `_nextT`, `_lastDefect`, devlet `_nextStaff`, kuşatma ve küresel cooldown alanları güncel kayıtta silinmez.
- Yükleme anındaki kayıt yeniden kaydedildiğinde fark listesi boştur.

Bu test kritik bir eski yükleme hatasını da ortaya çıkardı: güncel GEO haritasının kayıtlı şehir/petrol/maden dağılımı, `storyLoad()` sırasında eski `STORY_TERRAIN` koordinatlarıyla yeniden hesaplanıyordu. Güncel GEO kayıt artık kendi kaynak dağılımını korur; eski terrain backfill’i yalnız GEO olmayan eski kayıt yolunda çalışır.

## Faz 9 olay defteri ve komut hattı

Yeni aktif hat:

- `js/StoryCausality.js`: sürümlü `WorldCommand`, `WorldEvent`, `Effect` defteri.
- `causality.ledger`: dünya davranışını koruyan açık/kapalı geri dönüş bayrağı.
- Dış komutlarda boş olmayan `idempotencyKey`; yinelenen anahtar dünyayı ikinci kez değiştirmez.
- Etki kaydı: hedef kimliği, alan yolu, `SET/DELTA`, eski/yeni değer, kaynak ve gözlem niteliği.
- `storyCausalityTrace`: etkiden olay, kök olay, kaynak komut, kardeş olay ve etkilere geri izleme.
- V3 kayıt: defter, sayaçlar, toplama pencereleri ve idempotency geçmişi.
- V2 projeksiyon: nedensel olaylar ve defter teşhis sayaçları.

Bağlanan gerçek yazım kapıları:

- bölge sahipliği: oyuncu savaş sonucu, AI soyut savaş, kuşatma, savaşmadan bırakma ve AI darbesi;
- AI komutan hareketi: ilerleme, hedef savunma/saldırı, takviye, geri çekilme, işgal ve firar;
- refah: `storyWelfareDelta`;
- kaynak: tek seferlik akışlar ve 10 saniyelik deterministik sürekli gelir pencereleri;
- diplomasi: ilişki, antlaşma, antlaşma süresi ve antlaşma bozma zinciri.

Kabul kanıtı:

- Aynı `idempotencyKey` ile iki kez gönderilen `−5` refah komutu yalnız bir kez uygulanır.
- Sahiplik telemetrisi mutasyon anında bir kez çıkar; sonraki gözlem tiki kopya üretmez.
- Refah, sahiplik, antlaşma ve ilişki etkileri eski/yeni değerleriyle bulunur.
- Bir etki kimliğinden kaynak komut ve kök olaya geri yürünür.
- Boş idempotency anahtarı reddedilir.
- Defter kayıt/yüklemede bire bir korunur ve komut kimliği kesintisiz devam eder.
- AI/toplum katmanındaki doğrudan sahiplik ve AI hareket yazımları otomatik testle reddedilir.
- `causality.ledger` açık/kapalı 900 saniyelik A/B koşusunda karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, durum fark listesi boştur.
- 30 yıllık koşu `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` karmasını korur.

Performans sınırı: işlem-bazlı döner pencere sonrasında 900 saniyelik tek test koşusu bu makinede yaklaşık `2.84` saniye, paralel ham rapor koşusu `4.14` saniye; paralel 3600 saniyelik soak koşusu `6.75` saniye sürdü. Sürekli akışların 10 saniyelik pencerede toplanması ve canlı pencerenin `180 komut / 360 olay / 720 etki` ile sınırlandırılması kayıt büyümesini kontrol ediyor. En eski komut düşürülürken ona bağlı olay/etkiler birlikte düşürüldüğü için kalan kayıtlarda yetim referans oluşmuyor. Faz 10 olay bütçesi ve profil kapısı yine de bu maliyeti açıkça izlemelidir.

Kapsam sınırı: sadakat, itibar, üretim kuyruğu, ordu listesi ve gelecekte eklenecek domain alanlarının tamamı henüz merkezî etki kapısında değildir. Faz 9 kabulü yalnız sahiplik, refah, kaynak, AI hareketi ve diplomasi için verilmiştir.

## Faz 10 değişmezler ve zincir sigortası

Yeni aktif hat:

- `causality.guards`: normal davranışı değiştirmeyen geri dönüş bayrağı.
- Azami zincir derinliği `8`, aynı olay/hedef tekrarı `3`.
- Komut başına `32` olay / `96` etki.
- Dünya saniyesi başına `512` komut / `1024` olay / `2048` etki.
- Limit aşımında mutatör çalışmaz; `BLOCKED`, neden kodu, sayaç ve sınırlı uyarı oluşur.
- Sahiplik, refah, kaynak deltası, komutan bölgesi, ilişki, antlaşma ve süre değişmezleri mutasyondan önce çalışır.
- `storyCausalityValidate`: kimlik, sıra, referans, bütçe ve domain etki doğrulaması.
- `storyCausalityValidateWorldConsistency`: en son tutulan alan etkisi ile canlı dünya mutabakatı.
- Bozuk defter dünya kaydından ayrıştırılır; güvenli boş defter ve açık göç/onarım teşhisi oluşur.
- V2 teşhisinde bütün sigorta sayaçları ve uyarı sayısı görünür.

Kabul kanıtı:

- 20 adımlık kasıtlı döngü üç mutatörden sonra `CYCLE_REPEAT` ile durur.
- 100 alt olayın 69’u, 150 etkinin 54’ü limit üstünde bloklanır.
- Aynı saniyedeki 600 komutun ilk 512’si uygulanır, kalan 88’i çalıştırılmaz.
- Dört geçersiz domain enjeksiyonu canlı değerleri değiştirmez.
- Kapı dışı doğrudan yazım `WORLD_LEDGER_MISMATCH` üretir; değer onarılınca mutabakat tekrar geçer.
- Kırık olay referanslı defter yüklemede güvenli sıfırlanır ve `invalidRestores=1` olur.
- Sigorta kapalı karşı-test doğrulamasız `welfare=999` yazımını uygular.
- Normal 900 saniyelik koşu yapısal defter ve dünya mutabakatını geçer; blok/invariant sayıları sıfırdır.
- Açık/kapalı 900 saniyelik A/B karmaları `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, fark listesi boştur.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Son paralel doğrulamada 900 saniyelik ham rapor yaklaşık `5.44` saniye, 3600 saniyelik soak `8.82` saniye sürdü. Bu süreler eşzamanlı üç ağır koşu altında ölçüldü; normal testin tek 900 saniyelik örneği yaklaşık `3.68–3.92` saniyedir.

## Faz 10.1 UI projeksiyon ve nedensellik görünümü

Yeni aktif hat:

- `projection.causalityUi`: dünya davranışını değiştirmeyen geri dönüş bayrağı.
- `js/StoryProjection.js`: V2 dünya, `PlayerVisibleFact` ve nedensellik defterinden salt-okunur domain view-model.
- `VERIFIED → EXACT`, `ESTIMATED/RUMOR → OPAQUE`, `UNKNOWN → görünmez` kesinlik kapısı.
- Toplum, ekonomi, toprak, askerî, yönetim ve diplomasi domain kartları.
- Son `60` dünya saniyesi için görünür değişim rozeti.
- Ham payload/aktör/hedef taşımayan komut → olay → etki izi.
- `08 DEĞİŞİM` araç düğmesi ve gerçek “DEĞİŞİM & NEDEN” drawer’ı.
- Projeksiyon doğrulayıcı: kırık referans, gizli gerçek, yanlış kesinlik ve ham neden verisi sızıntısı.

Kabul kanıtı:

- Oyuncu `0`, oyuncu `1` ve istihbarat tahminli aynı dünya ayrı bilgi görünümleriyle projekte edildi.
- Yabancı refah etkisi rakip için yok, sahibi için kesin, tahminli oyuncu için değersiz/örtük görünür.
- Kamusal bölge sahipliği iki oyuncuya da görünür.
- `IMPRECISE_FACT_EXACT_LEAK` ve `HIDDEN_FACT_LEAK` kasıtlı enjeksiyonları yakalanır.
- Projeksiyon canlı dünya karmasını, verilen V2 dünya nesnesini ve defteri değiştirmez.
- jsdom paneli görünür satır, rozet, “NEDEN DEĞİŞTİ?” başlığı ve en az üç iz adımı üretir.
- UI HTML’i ham `payload` anahtarını içermez.
- Kayıt/yükleme sonrası view-model birebir aynıdır.
- Bayrak kapalı yol güvenli boş görünüm üretir.
- `qa-runtime/story-phase10-1-ab.json`: açık/kapalı hash `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; bütün metrik deltaları `0`.
- 30 yıllık soak hash `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f`.

Kapsam sınırı: diplomatik ilişki/antlaşma, sadakat, itibar, üretim kuyruğu ve ordu listesi PlayerKnowledge alanı ile kalıcı etki eşlemesi olmadan görünür neden yapılmaz. Eksik domainler sonraki fazlarda aynı kapıya eklenecektir; UI’nin ham dünya okumasına geri dönülmeyecektir.

## Faz 11 bölge veri modeli

Yeni aktif hat:

- `js/StoryRegions.js`: sürümlü `RegionModel`, topoloji karması ve dinamik bölge görünümü.
- `world.regionModel`: normal davranışı değiştirmeyen geri dönüş bayrağı.
- Kalıcı kimlik: `region:N`; mevcut `legacyId=N` ve `STORY.nodes[N]` indeks sözleşmesi korunur.
- Sabit alanlar: kanonik ad, normalleştirilmiş merkez, `CITY_REGION` sınıfı, harita kimliği ve komşuluk.
- Dinamik alanlar: sahiplik, seviye, nüfus, refah/servet, altyapı, yataklar, garnizon ve kara lojistiği mevcut canlı düğümden türetilir.
- V3 kayıt `regionModel` sidecar’ını taşır; V2 adaptör ve V3→V2 göçü konum/sınıflandırma/lojistik alanlarını üretir.

Kabul kanıtı:

- Güncel dünya tam `152` bölge üretir; her `region:N`, `legacyId=N` ve canlı dizi indeksi birebir eşleşir.
- Model merkezi ile canlı `lx/ly`, model komşuluğu ile canlı komşuluk birebirdir.
- Canlı komşuluk tekil, kendine bağlanmayan, geçerli ve çift yönlüdür.
- Sahiplik devri topoloji karmasını değiştirmez; Region görünümü ile V2 dışa aktarımı aynı yeni sahibi gösterir.
- Bölge modeli ve V2 dışa aktarımı salt-okunurdur; canlı dünya davranışını değiştirmez.
- Geçerli model kayıt/yüklemede birebir korunur.
- Model taşımayan eski kayıt uyarılı backfill ile; kırık komşuluk taşıyan model ise hata listesini koruyan güvenli yeniden kurulumla açılır.
- V2 doğrulayıcı konum aralığı, sınıflandırma, lojistik dizileri ve kırık lojistik referanslarını denetler.
- `qa-runtime/story-phase11-ab.json`: `world.regionModel` açık/kapalı `900` saniyelik dünya karması `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; ilk fark listesi boş, bütün metrik deltaları sıfırdır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Mimari karar: `STORY.nodes` mevcut motorun canlı dinamik gerçek kaynağı olarak bırakıldı. RegionModel aynı sahiplik ve ekonomi değerlerini ikinci kez saklamaz; yalnız ilerideki aktivasyon, toplulaştırma, ulaşım ve şehir dosyası fazlarının güvenebileceği kimlik/topoloji sözleşmesini dondurur.

Kapsam sınırı: kara komşuluğu şu an lojistiğin başlangıç grafıdır; kapasite, hasar, deniz/enerji/veri koridorları Faz 14’te gelir. Aktivasyon davranışı Faz 12’ye aittir. Uzun koşuda devlet `3` hâlâ `152/152` bölgeye ulaşır; Faz 11 bu denge sorununu çözmüş değildir.

## Faz 12 sıcak/ılık/soğuk aktivasyon

Yeni aktif hat:

- `js/StoryActivation.js`: sürümlü `region-activation-policy-1`, görünüm doğrulayıcı ve bölgesel çalışma dilimi seçici.
- `world.regionActivation`: eski her-bölge/her-tik yoluna dönen geri dönüş bayrağı.
- Dünya öncelikleri: komutan, savaş, kuşatma, başkent, yakın kontrol değişimi, graf uzaklığı, cephe, sahiplik, altyapı, nüfus ve garnizon.
- Bütçe: `12 HOT`, `48 WARM`, `92 COLD`.
- Kadans: HOT `1`, WARM `4`, COLD `20` tik.
- Deterministik faz: sistem kimliği ve kalıcı bölge kimliğinin karması.

Kabul kanıtı:

- Bütün 152 bölge tekil aktivasyon kaydı taşır; oyuncu komutanının bölgesi HOT’tur.
- Aynı sistem/tik iki kez çağrıldığında byte-eşdeğer bölge listesi çıkar.
- 20 tiklik turda her HOT/WARM/COLD bölge tam `20/5/1` kez seçilir.
- Önceden COLD bir bölgeye taşınan oyuncu komutanı hedefi HOT yapar; değişim UI’den değil dünya durumundan gelir.
- Kamera, zoom, seçili şehir ve açık panel mutasyonu aktivasyon görünümünü veya anlık dünya karmasını değiştirmez.
- Aynı tohumlu 60 saniyelik yoğun UI koşusu ile UI’siz koşunun bütün dünya alanları birebirdir.
- Geçerli politika ve türetilen görünüm kayıt/yüklemede birebirdir.
- Politika taşımayan eski kayıt uyarılı backfill, yanlış topoloji karmalı politika açık onarım teşhisi üretir.
- Şema dışı seviye ve yinelenen bölge kimliği açıklamalı hata kodlarıyla reddedilir.
- 250 dilim üretimi yaklaşık `54,8 ms`, ortalama `0,219 ms/dilim`; teorik ayrıntı iş yükü tam-HOT çalışmanın `%11,36`’sıdır.
- `qa-runtime/story-phase12-ab.json`: açık/kapalı 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, fark listesi ve metrik deltaları sıfırdır.
- 30 yıllık karma `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Mimari karar: dinamik HOT/WARM/COLD listesi kaydedilmez. Dünya durumu, topoloji ve politika aynıysa görünüm deterministik olarak yeniden türetilir. Böylece kamera/panel durumu veya bayat bir cache ekonomik sonuç kaynağı olamaz.

Kapsam sınırı: mevcut sistemler henüz bu dilimlerle seyrekleştirilmedi; Faz 13 koruma/toplulaştırma olmadan bunu yapmak stok, nüfus veya olay kaybı üretirdi. Bu faz modern iç politika eklemedi. Devlet `3` hâlâ 30 yılda `152/152` bölgeyi alıyor; fetih döngüsü ve iç işlerin zayıflığı açık tasarım hatasıdır.

## Faz 13 toplulaştırma ve ayrıntılandırma

Yeni aktif hat:

- `js/StoryAggregation.js`: sürümlü `region-aggregate-policy-1`, kanonik COLD kapsül, doğrulayıcı ve deterministik dağıtıcı.
- `world.regionAggregation`: başarısız geçişte veya kontrollü geri dönüşte eski tam ayrıntılı HOT yolunu koruyan özellik bayrağı.
- Kapsül: tam dinamik payload, tipli özet, payload/özet checksum’ı ve Faz 11 statik topoloji karması.
- Koruma imzası: bölge sayısı, nüfus, servet, garnizon, fabrika/kışla, yataklar, üretim kuyruğu, eski birlik havuzu, şirket/olay sayıları ve ülke kaynak toplamları.

Kabul kanıtı:

- Beş dünya saniyesi sonrasında canlı `152` bölgenin tamamı HOT→COLD→HOT turunda kanonik byte düzeyinde eşittir.
- Canlı koruma imzası `3319,639963` nüfus, `1056,14` servet, `16` garnizon, `118` fabrika, `44` kışla ve `32/152/32` petrol/şehir/puan yatağını tur öncesi ve sonrası aynı bulur.
- Ülke kaynakları `oil`, `manpower`, `points` ve `chips` toplamlarıyla dünya imzasına dahildir ve değişmez.
- Gerçek bölgelerde henüz bulunmayan stok/şirket alanları; iki şirket, üç stok, iki üretim işi, iki bekleyen olay, kuşatma ve bilinmeyen gelecek alanı taşıyan fixture ile kayıpsız doğrulandı.
- `100,007` değerinin yedi anahtara sabit ondalıklı dağıtımı, anahtar giriş sırası değişse de aynı sonucu ve tam toplamı verir.
- Payload/özet bozulması checksum kapısında; statik komşuluk değişimi topoloji kapısında reddedilir ve bozuk veri HOT olarak uygulanmaz.
- Geçerli kayıt birebir açılır; eski kayıt uyarılı backfill, bozuk politika açık onarım teşhisi üretir.
- Kamera, zoom, seçili şehir ve panel değişiklikleri koruma kapsülüne veya dünya sonucuna girdi değildir.
- 152 bölgelik tam gidiş-dönüş yaklaşık `16,037 ms`, ortalama `0,105509 ms/bölge` ölçüldü.
- `qa-runtime/story-phase13-ab.json`: açık/kapalı 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, fark listesi ve bütün metrik deltaları sıfırdır.
- 30 yıllık karma `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Mimari karar: COLD kapsül bir özet görünümüyle birlikte tam kanonik payload’ı saklar. Bu aşamada öncelik veri kaybetmeden sınır kurmaktır; gerçek bellek azaltımı ancak ilgili domainlerin açık ayrıntılandırma kuralları bulunduğunda yapılacaktır. Bilinmeyen gelecek alanlarının korunması, Faz 15–21 eklenirken kayıt kaybını önler.

Kapsam sınırı: Mevcut ekonomi, toplum ve devlet AI sistemleri henüz COLD kapsül üzerinde seyrek çalışmaz; bu nedenle ölçülen değer geçiş maliyetidir, CPU kazancı değildir. Canlı bölgesel şirket ve stok sistemi yoktur; fixture yalnız sözleşmenin geleceğe dayanıklılığını kanıtlar. Modern iç siyaset hâlâ oluşmadı ve 30 yıllık soak yine devlet `3` için `152/152` fetihle biter.

## Faz 14 altyapı ve ulaşım grafı

Yeni aktif hat:

- `js/StoryInfrastructure.js`: sürümlü `story-infrastructure-graph-1`, graf üretici/doğrulayıcı, rota ve akış çözümleyici.
- `world.infrastructureGraph`: eski dünya davranışını koruyan güvenli geri dönüş bayrağı.
- Fiziksel ağ: Faz 11 komşuluğundan `177 LAND`, açık GEO şehir çiftlerinden `20 SEA`.
- Katman ağı: her fiziksel bağlantı için `197 ENERGY` ve `197 DATA`; toplam `591` koridor.
- Koridor durumu: temel/etkin kapasite, `damageBps`, etkinlik, maliyet, gecikme, üst fiziksel koridor ve canlı uç-sahip erişimi.

Kabul kanıtı:

- Yeni kampanya grafı ve V2 dünya doğrulayıcıdan sıfır sorunla geçer.
- Bütün 152 V2 bölgesi kendisine bağlı kalıcı koridor kimliklerini taşır.
- Her enerji/veri koridoru aynı uçlara sahip geçerli kara veya deniz üst koridoruna bağlıdır.
- Aynı ağda aynı sorgu byte-eşdeğer rota üretir.
- `corridor:land:0:1` hasarı `10000` baz puana çıkarıldığında bağlı test akışı `100→0` olur.
- Ayrı kara koridorundaki akış ve aynı uçların ayrı enerji/veri akışları değişmez.
- Rota motoru kesilen koridoru kullanmaz; testte üç koridorlu alternatif yol bulur.
- Sıfır kapasite, aralık dışı hasar, yinelenen kimlik, kırık bölge ve kırık üst koridor açıklamalı kodlarla reddedilir.
- Uç bölge sahiplerinden türeyen erişim listesi canlı sahiplikle uyuşur; kamera/panel mutasyonu grafı değiştirmez.
- 100 komşu rota sorgusu yaklaşık `15,943 ms`, ortalama `0,159428 ms/rota`.
- Tek dinamik hasarlı koridor kaydı `367 bayt`; aynı tam çalışma grafı yaklaşık `184231 bayt`. Statik ağ her otomatik kayda çoğaltılmaz.
- Hasar kaydı/yüklemesi birebirdir; eski kayıt uyarılı backfill, yanlış ağ karması güvenli yeniden kurulum üretir.
- `qa-runtime/story-phase14-ab.json`: açık/kapalı 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, fark listesi ve bütün metrik deltaları sıfırdır.
- 30 yıllık karma `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Mimari karar: Bölge komşuluğu kara hareketi için mevcut gerçek kaynak olmaya devam eder; altyapı grafı kapasite ve akış sözleşmesini ikinci bir dinamik sahiplik kaynağı yaratmadan sidecar olarak ekler. Statik koridorlar topolojiden deterministik türetilir, kayda yalnız değişmiş dinamik durumlar girer.

Kapsam sınırı: Ekonomi, ticaret, askerî AI ve ikmal henüz grafı tüketmez. Canlı stok/fiyat/ordu kesintisi yoktur; kabul testi sürümlü test akışları üzerindedir. İlk 20 deniz hattı eksiksiz liman/boğaz simülasyonu değildir. Modern iç politika hâlâ oluşmadı; 30 yılda devlet `3` yine `152/152` bölgeyi alır.

## Faz 14.1 şehir dosyası ilk oynanabilir sürüm

Yeni aktif hat:

- `js/StoryCityDossier.js`: PlayerKnowledge tabanlı şehir view-model’i, doğrulayıcı, render ve bağlamsal navigasyon.
- `ui.cityDossier`: eski şehir paneline güvenli dönüş sağlayan özellik bayrağı.
- Genel/lojistik/tarih/karakter sekmeleri; kendi şehirlerinde mevcut bina ve ordu işlemlerinin korunması.
- Koridordan bağlı şehre, şehir değişikliğinden nedensellik ayrıntısına, doğrulanmış karakterden sohbet merkezine geçiş.

Kabul kanıtı:

- Haritada seçilen kendi veya yabancı şehir aynı dosya akışında açılır.
- Kendi nüfus/servet/garnizon/sanayi/yatak/lojistik bilgisi `VERIFIED` olur.
- Yabancı aynı alanların tamamı `UNKNOWN/null` kalır; sahte `0` üretilmez.
- Yabancı bölgeye enjekte edilen `987654321`, `876543210`, `765432109`, `654321098` ve `543210987` sentinel değerleri view-model veya HTML’e sızmaz.
- Yabancı koridor ayrıntısı ve doğrulanmamış karakter konumu gösterilmez.
- Kendi şehir probunda gerçek koridorlar listelenir; rota düğmesi hedef şehir kimliğini seçer ve kamera geçiş kapısını çağırır.
- Bölge sahiplik değişimi şehir tarihine düşer; olay düğmesi doğru `change:effect:*` ayrıntısını açar.
- Doğrulanmış karakter sohbet merkezini doğru karakter kimliğiyle açar. Hedefli serbest sohbet olmadığı açıkça belirtilir ve mevcut kuyruktan karakter adına cevap uydurulmaz.
- Eksik stok/şirket/kurum katmanları `SİSTEM HENÜZ YOK` durumuyla gösterilir.
- Tablist ve etkin sekme `aria-selected` semantiği taşır.
- Şehir dosyasını yalnız açıp gezinmek motor içi dünya karmasını değiştirmez.
- `qa-runtime/story-phase14.1-ab.json`: açık/kapalı 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, fark listesi ve metrik deltaları sıfırdır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Kapsam sınırı: Şehir dosyası yeni ekonomi veya iç siyaset simülasyonu değildir; mevcut doğrulanabilir dünya verisini güvenli bir oyuncu yüzüne taşır. Koridorların canlı ticaret/ikmal tüketicileri, şirketler, bölgesel stoklar, yerel kurumlar ve karaktere özel serbest sohbet sonraki fazlara aittir. Ortamda kullanılabilir tarayıcı olmadığı için piksel düzeyi görsel kontrol yapılmadı; DOM/erişilebilirlik testleri geçti, gerçek EXE’de görsel taşma kontrolü kalıyor. Modern dünya sorunu çözülmedi; 30 yıllık sonuç hâlâ `152/152` tek-devlet fethidir.

## Faz 14.2 kanonik kara maskesi ve region raster

Yeni aktif hat:

- `js/StoryMapRaster.js`: sürümlü `canonical-map-raster-1`, tek `GEO.land` scanline üreticisi, kara maskesi, region kimlik rasteri, checksum/doğrulama ve örnekleme API’si.
- `world.canonicalMapRaster`: GEO bulunmadığında veya özellik kapatıldığında eski yolu koruyan güvenli özellik bayrağı.
- Kanonik çözünürlük `820×645`; terrain `1350×1062`, mevcut politik grid `300×236` olarak aynı kaynaktan deterministik yeniden örneklenir.
- Region ataması eski normalleştirilmiş mesafe davranışını koruyan deterministik KD-tree ile yapılır.
- Harita hit-test’i aynı region rasterini kullanır; denize tıklama şehir seçmez.

Kabul kanıtı:

- Kanonik raster `351.997` kara ve `176.903` deniz hücresine sahiptir; bütün `152` region en az bir hücreyle temsil edilir.
- Kaynak/land/region karmaları `fnv1a32:f76a938c`, `fnv1a32:f63d135c`, `fnv1a32:2dc42a47`; tekrar üretim ve cache yeniden kullanımı deterministiktir.
- İlk raster üretimi ölçümlerde yaklaşık `57–63 ms` sürdü.
- Gerçek `storyBuildLandGrid()` ile 300×236 kanonik region resample arasında `0` hücre farkı; denizde region sızıntısı ve karada eksik region sayısı `0`.
- Gerçek terrain cache `1350×1062`, owner overlay `300×236` üretir ve ikisi de aynı kanonik kaynak karmasını yayınlar. jsdom içindeki birlikte ilk cache kurulum probu yaklaşık `551 ms` sürdü.
- Terrain merkezi örnekleriyle overlay kıyısı arasındaki sınıf farkı `153/70.800` (`%0,2161`); 300’e downsample ince kanonik kara hücrelerinin `2.768/351.997` (`%0,7864`) kısmını kaybediyor. Bu ölçüm saklanmış bir kalite borcudur, başarı diye gizlenmemiştir.
- Sürüm, uzunluk, kara değeri, denize region sızıntısı, karada region eksiği, bilinmeyen region, kaynak karması ve checksum bozulmaları açıklamalı kodlarla reddedilir.
- Özellik kapalı A/B yolu eski davranışı korur; GEO olmayan/prosedürel harita kanonik rastere zorlanmaz.
- `qa-runtime/story-phase14.2-ab.json`: açık/kapalı 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, ilk fark ve bütün metrik deltaları sıfırdır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Mimari karar: Kara/deniz ve region üyeliği artık terrain, siyasi katman ve tıklama tarafından yeniden hesaplanan üç ayrı gerçek değildir. Kanonik raster GEO + bölge merkezlerinden deterministik türeyen sidecar’dır; kayıt dosyasına çoğaltılmaz, kaynak karması değiştiğinde yeniden kurulur. Runtime KD-tree naif hücre×şehir taramasını kaldırır; Faz 14.4’te build-time raster ve açılış fallback bütçesi ayrıca değerlendirilecektir.

Kapsam sınırı: Politik renk katmanı hâlâ düşük çözünürlüklü `300×236` canvas ve hücre başına `fillRect` kullanır. İnce kıyı/kara kaybı ancak Faz 14.3’te kanonik çözünürlükle uyumlu `ImageData` RGBA/sınır maskesine geçilince kapanabilir. Ortamda kullanılabilir tarayıcı olmadığı için ekran görüntüsü/piksel görsel kabulü yapılmadı; gerçek EXE kontrolü kalıyor. Bu faz simülasyon dengesini değiştirmez: modern iç politika oluşmadı ve 30 yılda devlet `3` yine `152/152` bölgeyi alır.

## Faz 14.3 ImageData politik overlay

Yeni aktif hat:

- `js/StoryPoliticalOverlay.js`: sürümlü `political-overlay-rgba-1`, kanonik RGBA üretici, devlet sınırı maskesi, doğrulayıcı, cache/revision ve teşhis.
- `render.imageDataPoliticalOverlay`: eski 300×236 politik çizime güvenli dönüş sağlayan özellik bayrağı.
- `StoryRender.storyEnsureOwnerOverlay()`: ana yolda kanonik 820×645 canvası tüketir; eski fillRect döngüsü yalnız fallback’tir.
- `storyTransferNodeOwnership()`: başarılı bölge devrinde politik cache’i açık `territory-transfer` nedeni ile geçersiz kılar.

Kabul kanıtı:

- İlk politik canvas `820×645`; `351.997` kara pikselinin tamamında renk, `176.903` deniz pikselinin tamamında alfa `0`.
- Başlangıç sınır maskesi `2.756` devlet sınırı ve `349.241` iç bölge pikseli üretir; denize sınır sızıntısı `0`.
- İç tint alfa `51`, sınır alfa `230`; başka kara alfa değeri yoktur.
- Yeni yol `0 fillRect + 1 putImageData`; eski fallback aynı haritada `47.137 fillRect + 0 putImageData`.
- Cache hit aynı canvas ve revision’ı korur. Gerçek bölge devri owner/RGBA/sınır checksum’larını değiştirir, revision’ı `1→2` yapar ve aynı canvas belleğine yalnız bir yeni ImageData yazar.
- Şema, adaptör, boyut, dizi uzunluğu, coğrafya/sahiplik/RGBA/sınır checksum’ı, deniz alfa/sınır sızıntısı, kara alfa ve sınır topolojisi kasıtlı bozulma testlerinden geçer.
- İlk owner/RGBA/sınır karmaları `fnv1a32:196bd176`, `fnv1a32:f386e770`, `fnv1a32:89dae1e1`.
- Saf üretim döngüsü ölçümlerde yaklaşık `13–19 ms`; ilk toplam hazırlık yaklaşık `113–137 ms`. Bu jsdom ölçümü gerçek Canvas/GPU süresi değildir.
- `qa-runtime/story-phase14.3-ab.json`: açık/kapalı 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, `changedWorldState=false`, ilk fark ve bütün metrik deltaları sıfır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Mimari karar: Politik görüntü kayda yazılmaz; kanonik coğrafya + canlı sahiplik + devlet paletinden deterministik türetilir. Owner/palet karması cache anahtarıdır. Aynı sahiplikte kare başına yeniden üretim yoktur; fetih yeni revision üretir. Derin piksel/topoloji doğrulaması QA kapısında çalışır, yeni üretilmiş runtime payload’ı aynı fetih karesinde ikinci kez 528.900 piksel taramaz.

Kapsam sınırı: Çağrı sayısının `47.137→1` düştüğü kesin ölçüldü, fakat jsdom Canvas komutlarını no-op yaptığı için gerçek Chromium hızlanma yüzdesi kanıtlanmadı. Gerçek EXE’de ilk açılış, fetih sonrası frame, kıyı ve sınır kalınlığı görsel/profil kontrolü kalıyor. Faz 14.3 modern ekonomi veya iç politika eklemez; 30 yılda devlet `3` hâlâ `152/152` bölgeyi alır.

## Faz 14.4 region atama ve açılış performansı

Yeni aktif hat:

- `js/StoryMapRasterAsset.js`: otomatik üretilen, sürümlü ve checksum’lı `820×645` RLE region raster varlığı.
- `tools/make-story-map-raster.js` ve `npm run story:build-map-raster`: deterministik varlık üretim hattı.
- `world.prebuiltMapRaster`: asset ana yolu ile runtime KD-tree fallback’i arasında A/B kapısı.
- `StoryMapRaster`: base64/RLE decoder, başlık-payload-kaynak doğrulaması ve açık fallback teşhisi.

Kabul kanıtı:

- `528.900` region pikseli `10.766` koşuya, `43.064` payload baytına ve yaklaşık `65 KB` JS varlığına sıkıştırıldı.
- Üretici arka arkaya çalıştırıldığında dosya SHA-256’sı değişmedi.
- Asset ve runtime üretici aynı kaynak/land/region karmalarını verdi: `f76a938c / f63d135c / 2dc42a47`.
- Tekil ölçüm asset `54,1 ms`, runtime `111,3 ms`; paralel yükte asset `87,7 ms`, runtime `168,7 ms`.
- Eski şema, kaynak uyuşmazlığı, bilinmeyen encoding, payload checksum, run sayısı ve kesilmiş payload reddedildi.
- Eksik/eski/bozuk asset oyun açılışını durdurmadı; sırasıyla `ASSET_MISSING`, `ASSET_SOURCE_HASH`, `ASSET_PAYLOAD_HASH` kodlarıyla aynı kanonik KD-tree fallback’i üretildi.
- `qa-runtime/story-phase14.4-ab.json`: 900 saniyelik açık/kapalı karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, dünya farkı ve bütün metrik deltaları sıfır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f`.

Kapsam sınırı: Node/jsdom açılış ölçümü gerçek paketlenmiş Chromium ilk frame profili değildir. Varlık yalnız statik coğrafya ve region üyeliğini taşır; canlı sahiplik RGBA katmanı Faz 14.3’te ayrı kalır. Modern iç politika ve hegemonya sorunu değişmedi; devlet `3` yine `152/152` bölgeyi alır.

## Faz 14.5 adaptif warp ve render bütçesi

- Adaptif band: 720p `4`, 1080p `5`, 1440p `7`, yakın 1080p `4 px`.
- Terrain ve politik katman aynı warp planını paylaşır: karede bir miss, ikinci katmanda hit.
- İki katmanlı çağrı sayısı 1080p’de `720→432` (`%40`); 1440p’de `960→412`.
- Döngü içi sessiz `try/catch` kaldırıldı; geçersiz kaynak çizim öncesinde açık kodla reddedilir.
- Maksimum perspektif bant hatası `%0,2101`, dünya-ekran tersinim hatası `0`.
- `qa-runtime/story-phase14.5-ab.json`: 900 saniyelik dünya farkı ve metrik deltaları sıfır; karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f`.

Kapsam sınırı: Gerçek Chromium/GPU p95 ölçülmedi; jsdom yalnız plan ve çağrı bütçesini doğrular. EXE’de çözünürlük matrisi ve görsel kıyı/sınır kontrolü kalıyor. Modern dünya hâlâ tek devlete çöker.

## Faz 14.6 harita cache, çağ/palet ve dokümantasyon temizliği

- `js/StoryMapCache.js`, `story-map-cache-invalidation-1` sözleşmesini ve `storyInvalidateMapCaches(scope, reason, details)` tek kapısını kurdu.
- Scope’lar ayrıldı: `ownership` yalnız politik veriyi, `era` yalnız terrain’i, `palette` terrain+politik veriyi, `viewport` yalnız warp planını, `geometry` bütün geometrik/türetilmiş katmanları temizler.
- Sahiplik invalidation’ında kanonik raster, terrain ve warp nesneleri aynı kaldı; politik canvas belleği korundu ve revision tam `+1` arttı.
- Gerçek `storyEraTransitionTo` yolu çağ değişimini merkezî `era` scope’una bağladı. Gri→soğuk çağ probunda terrain nesnesi ve piksel checksum’ı değişirken politik overlay revision’ı ve warp planı değişmedi.
- Altı çağ için gerçek RGB çarpanı/lift profili eklendi; terrain kaynağı sürümlü `paletteId/paletteKey` yayınlıyor.
- Devlet renk paleti değişiminde terrain ve politik veri birer kez yenilendi; canvas belleği yeniden kullanıldı.
- Bilinmeyen scope `MAP_CACHE_SCOPE_UNKNOWN`, kapalı özellik yolu `MAP_CACHE_INVALIDATION_DISABLED` koduyla mutasyonsuz reddedildi.
- README çalışan `3000 px` dünya, gerçek index yükleme sırası ve paket kurallarıyla yeniden yazıldı.
- Kök `StoryGeoRender.js` yüklenmeyen/paketlenmeyen tarihî prototip olarak ayrıldı. `js/MapData.js` ise aktif taktik savaş kaynağı olarak doğrulandı; eski MapData çiftleri mevcut değil.
- `qa-runtime/story-phase14.6-ab.json`: 900 saniyelik açık/kapalı dünya karması aynı `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; bütün metrik deltaları sıfır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f`.

Kapsam sınırı: jsdom gerçek Chromium renk birleştirmesini ve GPU maliyetini kanıtlamaz. Çağ paletleri byte düzeyinde değişiyor, fakat EXE’de her çağ için ekran görüntüsü, okunabilirlik ve p95 frame kontrolü hâlâ zorunludur. Bu faz modern ekonomi/iç yönetim eklemedi; 30 yılda devlet `3` yine `152/152` bölgeyi alır.

## Faz 15 kaynak taksonomisi

- `js/StoryResources.js`, sekiz kalıcı kaynak kimliği için sürümlü ve checksum’lı tek katalog kurdu: `food`, `energy`, `raw_materials`, `industrial_parts`, `electronics`, `military_supplies`, `labor`, `capital`.
- Her kaynak kategori, açık birim, üretici, tüketici, depolama politikası, taşıma modu ve hangi fazda etkinleşeceği belirtilen yokluk etkilerine sahiptir.
- Katalog şeması/sürümü `1/1`, adaptör kimliği `story-resource-taxonomy-1`, checksum `fnv1a32:4a4ba0fe`.
- Katı doğrulayıcı eksik/yinelenen/bilinmeyen kaynak, bozuk birim, boş üretici veya tüketici, eksik yokluk etkisi, güvensiz eski alan yazma modu ve checksum uyuşmazlığını reddeder.
- `oil → energy`, `manpower → labor`, `points → capital` yalnız `LEGACY_ALIAS` ve `semanticLoss: HIGH` olarak yayımlanır. Eski alanlar yazma otoritesi olmaya devam eder; bunlar yeni ekonominin gerçek stokları değildir.
- Eşlenmeyen beş kaynağın miktarı sıfırmış gibi gösterilmez: `null / UNAVAILABLE_PHASE_17`.
- Kompakt kayıt başlığı katalog sürümünü/checksum’ını korur. Katalog alanı olmayan eski kayıt backfill edilir; bozuk checksum güvenli statik kataloğa döner ve teşhis bırakır. Her iki yol da mevcut `oil/manpower/points` değerlerini aynen korur.
- Eski fixture `123.25 / 456.5 / 789.75`, eski→kanonik→eski dönüşünde tam eşit kaldı.
- `qa-runtime/story-phase15-ab.json`: 900 saniyelik açık/kapalı dünya karmaları aynı `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; bütün metrik deltaları sıfır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f`.

Kapsam sınırı: `liveStockSystem: false`. Faz 15 üretim, tüketim, fiyat veya bölgesel stok eklemedi. Bu nedenle eski kaynak şişmesi ve devlet `3`ün `152/152` bölgelik hegemonyası aynen sürüyor. Bunlar başarı sayılmadı; Faz 16–21’in açık borcudur.

## Faz 16 altı üretim sektörü

- `js/StoryProductionSectors.js`, altı sektör ve altı sürümlü ana reçete kurdu: tarım→gıda, enerji→enerji, çıkarım→hammadde, sivil sanayi→sanayi parçası, ileri teknoloji→elektronik, savunma sanayisi→askerî malzeme.
- Her sektör kapasite, iş gücü ve `2500–15000 BPS` verimlilik sözleşmesine sahiptir.
- Üç birincil sektör doğal kapasite/rezerve bağlıdır; üç sanayi sektörü malzeme eşdeğeri korumasına bağlıdır. Fiziksel çıktı ne girdisiz ne de malzeme girdisinden büyük üretilebilir.
- Doğrulayıcı bilinmeyen/yinelenen sektör-reçete, bilinmeyen kaynak, yanlış birim, sıfır/negatif miktar, doğal kapasitesiz birincil üretim, girdisiz çıktı, kütle kazancı, iş gücü farkı ve yetkisiz üreticiyi reddeder.
- Salt-okunur teklif motoru `READY/PARTIAL/BLOCKED` üretir; kapasite, stok ve doğal kapasite darboğazlarını kaynak, birim, gereken/mevcut miktar ve karşılanabilen çevrimle açıklar.
- Hedefli kıtlık örneği: `4` çevrim istenen sivil sanayide `0,75` hammadde yalnız `0,5` çevrim ve `0,5` parça lotuna izin verdi; darboğaz `INPUT_SHORTAGE/raw_materials`.
- Hedefli kapasite örneği: `1` kapasite ve `%50` verim, savunma sanayisini `0,5` çevrim ve `0,5` askerî ikmal tonuyla sınırladı.
- Aynı istek byte düzeyinde aynı teklif/hash değerini üretti; giriş nesnesi ve canlı dünya değişmedi.
- Katalog checksum’ı `fnv1a32:a4007f41`, bağlı kaynak checksum’ı `fnv1a32:4a4ba0fe`. Kompakt kayıt `327` bayt, tam görünüm `6.982` bayt.
- Eski kayıt backfill’i, bozuk checksum kurtarması, özellik kapalı yolu ve V2 teşhis projeksiyonu geçti.
- `qa-runtime/story-phase16-ab.json`: açık/kapalı 900 saniyelik dünya karmaları aynı `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; bütün metrik deltaları sıfır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f`.

Kapsam sınırı: `liveStockSystem: false`, `proposalsCommit: false`. Faz 16 teklifleri gerçek stok tüketmez veya üretmez ve eski askerî birlik üretim kuyruğuna bağlanmaz. Dünya dengesi düzelmedi: devlet `3` yine `152/152`; eski `oil/manpower/points` toplamları yüz binler ölçeğine şişiyor.

## Faz 17 bölgesel tüketim ve stok

- `js/StoryRegionalEconomy.js`, 152 bölge × 8 kaynak için `story-regional-stock-ledger-1` kanonik defterini kurdu. Politika checksum’ı `fnv1a32:f0f3a43a`; kaynak/reçete/topoloji bağları da kayıtta doğrulanıyor.
- Defter gerçek stok otoritesidir; `node.stocks` yalnız bölge kapsülü aynasıdır. Eski `oil/manpower/points` değerleri stoğa materialize edilmez.
- Faz 16 üretim teklifleri reçete/hash/miktar/stok/doğal kapasite yeniden doğrulandıktan sonra tek atomik işlemle tüketim ve çıktı yazar. Tahrif edilmiş teklif `PROPOSAL_QUANTITY_MISMATCH`, bayat teklif `INSUFFICIENT_STOCK` ile stoğu hiç değiştirmeden reddedildi.
- Hane/ordu/devlet/şirket talebi `100/95/85/70` önceliğiyle ayrılır. Düşük öncelikli talep güvenli rezervi yiyemez. Tahsis sonucu ile kıtlık yaşam döngüsü ayrıdır: `SATISFIED/PARTIAL/UNMET` ve `ACTIVE/RESOLVED`.
- Gıda bozulması, enerji tampon kaybı, parça/elektronik eskimesi, askerî ikmal kaybı ve stoklanamayan emek kaynak politikasından deterministik işlenir.
- Sekiz kaynak koruma denklemi hedefli probda tam sıfır farkla kapandı. Kayıt/yükleme birebir; eski kayıt backfill’i ve bozuk defter kurtarması eski kaynakları değiştirmiyor.
- V2, PlayerKnowledge ve HOT/WARM/COLD kapsülleri gerçek stokla bağlandı. Oyuncu kendi stoklarını `VERIFIED`, yabancı stokları istihbaratsız `UNKNOWN/null` görür. Şehir dosyası aynı filtreyi uygular.
- `qa-runtime/story-phase17-ab.json`: kapalı karma `491dae2ded7c9bfcb9a1b77d870b4a5333b848a5b0cd1c6e5df8ea2f7270f803`, açık karma `a4acc60e10d98906a51dd3901aae00d1184e4f1b0e2c9f888a43421ae78cad1e`. Yeni stok durumu gerçekten değişti; eski refah/enflasyon/öfke/aktif devlet/haber/`oil-manpower-points` deltaları sıfır.
- 30 yıllık soak karması `93ac47920553f4fe316f6f7a9077a66082e40414f3d6f9fd1f02810b0e590ffa`; final stok defteri ve bölge aynaları geçerli.

Kapsam sınırı ve dürüst teşhis: 900 saniyede gıda ve enerji toplamı sıfıra inerken `1.407` kıtlık kaydı ve `2.268.902,06` sermaye stoğu oluşuyor. 30 yıllık eski dünya yine devlet `3`ün `152/152` hegemonyasına çöküyor; eski kaynaklar da büyüyor. Faz 17 mimariyi canlı hale getirdi ama ekonomiyi dengelemedi. Ticaret/lojistik Faz 18, fiyat Faz 19, bütçe/para Faz 20 ve eski askerî üretim bağlantısı gelmeden bu sonuç başarı olarak yorumlanmayacak.

## Faz 17.1 modern barış başlangıcı

- Kök hata `storyRel` varsayılanının doğrudan `war` olmasıydı. Yeni kampanya artık sekiz devletin bütün `28` ilişkisini somut `peace` kenarı olarak kuruyor.
- Ateşkes bitişi otomatik savaş üretmiyor; `peace` durumuna dönüyor.
- Genelkurmay hedef üretimi diplomasi kontrolünü atlıyordu. Hedef üretme, saldırı emri, kuşatma başlatma/çözme ve fetih artık aynı düşmanlık kapısını kullanıyor.
- Oyuncu barıştaki devlete doğrudan saldırmıyor; açık “barışı boz ve savaş ilan et” kararıyla ilişki/itibar sonucunu kabul ediyor. Savaş fonksiyonuna doğrudan çağrı da barışta reddediliyor.
- AI’nin yalnız güç farkı gördüğü için barışı bozması kaldırıldı. Geçici modern kapı negatif ilişki, ortak sınır ve şahin doktrin istiyor; gerçek casus belli/kriz/yetki sistemi hâlâ yok.
- Diplomasi dünya karmasına alındı. Barışta haber üretilmemesiyle görünür olan boş `_news` kayıt/yükleme asimetrisi düzeltildi.
- Hedefli 120 saniyelik A/B: barış açıkken `0`, eski yol açıkken `5` sahiplik değişimi.
- `qa-runtime/story-phase17.1-ab.json`: 900 saniyede eski kontrol `143` sahiplik değişimiyle `4` devlete düşerken modern barış yolu `0` sahiplik değişimiyle `8` devleti korudu.
- 900 saniyelik koşu: `8/8` devlet, `0` sahiplik değişimi, başlangıç dağılımı değişmeden korundu; karma `a1935aa5c1dcf20b924f0b9fccdf91f69d2e7df91c42dec521d825841f407ac1`.
- 30 yıllık soak da `8/8` devleti korudu; karma `4933d411d90ebca645ab381fbf41d95a0bc70db644db5e896c662c531ec15058`.

Bu düzeltme modern dünya AI’sini tamamlamadı. Barış döneminde devletlerin ekonomik, kurumsal, diplomatik ve karakter odaklı ortak gündemi yok. Ayrıntılı açıklar ve hedef fazlar `MODERN_DUNYA_EKSIKLERI.md` içinde tutuluyor. Tam karakter dalgası Faz 34–38.5; mevcut başkan/komutan isimleri ve kişilik eksenleri yalnız kısmi ön çalışma.

## Faz 2 ilk telemetri dilimi

Yeni aktif hat:

- `js/StoryTelemetry.js`: sürümlü olay defteri, sağlık örnekleri ve refah muhasebesi.
- `js/StoryFeatures.js`: doğrulanan özellik bayrağı sicili ve kayıt görüntüsü.
- `storyWelfareDelta`: refahın tek yazım kapısı.
- Sürekli refah kaybı: devlet başına `0.12/sn`, `0.36` burst tavanı.
- `npm run story:report`: güncel ham rapor.
- `npm run story:compare`: Faz 0 ile güncel koşunun otomatik farkı.
- `npm run story:ab`: aynı tohumda seçilen bayrağın kapalı/açık koşusu ve hedefli probu.
- Otomatik test: Story, StoryAI, StorySocial, Council, Economy, Factions ve News içinde doğrudan `.welfare =` yazımını reddeder.
- Otomatik test: telemetri kapalı/açıkken dünya karmasının değişmediğini; bilinmeyen bayrağın reddedildiğini doğrular.

900 saniyelik güncel koşunun ham olay sayıları:

- Şehir kazanma/kaybetme olayı: `125 / 125`
- Gerçek sahiplik değişimi: `169`
- Konsey kararı: `59`
- Komutan firarı: `140`
- Refah değişimi isteği: `1165`
- Genel grev: `13`
- Tamamen elenen devlet: `5`

Bu veri hegemonya çöküşünün yalnız refah probleminden gelmediğini gösteriyor. `900` saniyede `169` sahiplik değişimi, yaklaşık her `5.33` saniyede bir şehrin el değiştirmesi demektir. Yalnız üç devletin toprağı kalmıştır; dünya siyasi olarak hâlâ aşırı hızlı yakınsamaktadır.

Faz 0 karşılaştırması:

- Ortalama refah: `29.0664 → 16.5114` (`−12.5550`)
- Ortalama enflasyon: `16.5486 → 14.2662`
- Ortalama huzursuzluk: `20.9787 → 26.0162`
- Aktif devlet: `6 → 3`
- Petrol: `43,233 → 34,773`
- İnsan gücü: `27,300 → 21,950`
- Puan: `11,378 → 17,459`

Refahın düşmesi yeni kapının daha fazla ceza vermesinden kaynaklanmıyor. Eski konsey hesabı refah `0` olduğunda `(st.welfare || 50)` nedeniyle değeri gizlice `50` kabul edip sahte toparlanma yaratıyordu. Tek kapı gerçek sıfır değerini korudu ve bu hatayı görünür kıldı.

Refah tavanının standart `900` saniyelik koşudaki A/B sonucu **aynıdır** ve bastırılan miktar `0` çıkmıştır. Bu, bayrağın bozuk olduğu anlamına gelmez: iki eşzamanlı `−1` sürekli baskı enjeksiyonunda kapalı yol `−2`, açık yol `−0.36` uygular. Sonuç, mevcut tick düzeninde tavanın henüz doğal olarak tetiklenmediğini gösterir; standart koşudaki refah farkı tavandan değil yukarıdaki sıfır-refah hatasının kaldırılmasından gelir.

Faz 2’de eklenen diğer kayıtlar:

- Kaynak üretim/tüketim toplamları devlet ve kaynak etiketi bazında tutulur.
- `battle.completed`, savaş motor sürümü, tohum, rol, süre, sonuç ve kayıpları taşır.
- `llm.requested / used / rejected / failed`, ham istem/yanıtı saklamadan boyut ve gecikmeyi kaydeder.
- Dünya adımları p50/p95/p99, maksimum ve 16/33 ms aşımı olarak raporlanır.
- Her 10 saniyelik örnek, gözlem değerlerinden bağımsız tekrar üretilebilir motor içi durum karması taşır.

Ham telemetri oturumda en fazla `2500` olay ve `720` örnek tutar. Kayıt dosyası için son `200` olay ve `120` örnek saklanır; böylece otomatik kayıt megabaytlarca JSON’u her seferinde kopyalamaz. Tam ham akış QA raporuna ayrıca aktarılır.

## Faz 0 referans koşusu

Komut:

```text
npm run story:baseline
```

Senaryo:

- Tohum: `2032`
- Süre: `900` dünya saniyesi
- Adım: `1` saniye
- Devlet: `8`
- Bölge/şehir düğümü: `152`
- Hash: `c03e2c5459748bbebcf66e0c16201bef682349937a9c3db887dd56c930bb71a4`

900 saniye sonundaki önemli sonuçlar:

- Ortalama refah: `29.0664`
- En düşük / en yüksek refah: `0 / 97.9932`
- Ortalama enflasyon: `16.5486`
- Ortalama huzursuzluk: `20.9787`
- Toprak sahibi kalan devlet: `6 / 8`
- En büyük iki devlet: `64` ve `62` bölge
- Kaynak toplamı: `43,233 petrol / 27,300 insan gücü / 11,378 puan`

Bu sonuç denge başarısı değildir; sonraki değişikliklerin karşılaştırılacağı mevcut davranıştır.

## 30 oyun yılı soak sonucu

Komut:

```text
npm run test:story:soak
```

Teknik sonuç:

- `3600` dünya saniyesi kesintisiz tamamlandı.
- Çökme, sonlu olmayan sayı veya geçersiz bölge sahibi oluşmadı.
- Faz 18 açık son koşu yaklaşık `38,25` saniye gerçek sürede tamamlandı; ticaret rota/matching maliyeti artık headless bütçenin ana parçalarından biridir.

Tasarım sonucu:

- Barış başlangıcı sayesinde `8 / 8` devlet ve başlangıçtaki `152` bölgelik sahiplik dağılımı korundu.
- Ortalama refah `68,625`; en düşük/yüksek devlet `25 / 100`.
- Ortalama enflasyon `2,66`, huzursuzluk `4,0275`.
- Ticaret defteri, yoldaki yük koruması ve bölgesel stok doğrulaması geçti.
- Eski `oil/manpower/points` kaynakları yüz binler ölçeğine şişmeye devam etti; yeni sermaye sistemi de fiyat/bütçe olmadığı için dengeli değildir.

Dolayısıyla tek-devlet çöküşü temel düzeyde kapanmıştır; fakat bu modern, yaşayan ve çoğul dünya kabulünün tamamlandığı anlamına gelmez. Barışta devlet gündemi, fiyat/bütçe, kurum, karakter, diplomasi ve kriz kararları hâlâ eksiktir.

## Headless laboratuvarın sınırı

Laboratuvar gerçek `Story`, `StoryAI`, `StorySocial`, `Economy`, `Factions`, `Production`, `Council`, `Era`, `Talks` ve harita veri dosyalarını yükler. Sabit tohumla `Math.random` ve `Date.now` kontrol edilir. Oyuncu konseyi, varsayılan oyuncu oyu ve gerçek konsey çoğunluğu üzerinden otomatik tamamlanır.

Headless dünya koşusunda gerçek taktik savaş ekranı açılmaz. Bunun yerine Faz 2, gerçek `storyOnBattleEnd` dönüş yolunu sabit bir savaş özetiyle çalıştırıp motor sürümü ve tohumun `battle.completed` olayına geçtiğini doğrular. Gerçek EXE içindeki tam hikâye→savaş→hikâye turu Faz 49–50’de ayrıca kabul edilecektir.

## İlk ölçümün açığa çıkardığı borç

1. Uzun koşuda hegemonya karşıtı hiçbir etkili fren yok.
2. Enflasyon ile huzursuzluk korele biçimde aynı refahı tekrar cezalandırabiliyor; kaynakları artık görünür fakat denge henüz çözülmedi.
3. Eski `oil/manpower/points` sayaçları uzun koşuda sınırsız büyüyor; fiziksel ticaret çalışsa da toplam gıda/enerji üretimi talebi karşılamıyor ve dış sermaye girişi aşırı birikiyor.
4. Haber dizisi 30 kayıtta kesiliyor; bu UI için makul, telemetri için yetersiz.
5. Sahiplik, refah, kaynak, AI hareketi ve diplomasi artık kesin komut/neden kimliği taşıyor; sadakat, itibar, üretim kuyruğu ve ordu listesi henüz aynı kapsamda değil.
6. Güvenli “neden değişti?” görünümü çalışıyor; henüz etki kapısına alınmamış domainler görünür neden üretmiyor.

## Faz 18 — Ticaret ve lojistik kabul sonucu

- Sözleşme, sipariş, sevkiyat ve amendment kayıtları `story-trade-logistics-ledger-1` içinde sürümlü ve doğrulanabilir.
- Gönderici stok borcu sevkte, alıcı stok alacağı yalnız teslimatta yazılır. Hedefli prob: gönderici `−10`, sevk anında hedef `0`, kesintide hedef `0`, teslimatta hedef `+10`.
- Koridor `10000` baz puan hasarda yükü `HELD` yaptı; açıldıktan sonra yük teslim oldu ve `20` saniye kesinti kaydı korundu.
- Ortak kapasite testi aynı `1051` birimlik hattın ikinci kez kullanılmasını `CORRIDOR_CAPACITY_EXHAUSTED` ile reddetti.
- Yetkili yönlendirme eski hedefe `0`, yeni hedefe teslimatta `+5` yazdı. Sınır ötesi mülkiyet `country:0 → country:7` yalnız teslimatta değişti.
- Koruma denklemi, bozuk rota/politika/ağ, kayıt ortasında devam, eski kayıt backfill’i, bozuk defter kurtarması ve yabancı ticari bilgi sızıntısı otomatik test edildi.
- 900 saniyelik A/B: kapalı karma `fabd0348…7e66`, açık karma `06449585…a5b`; toplam `28.844,74` birim fiziksel teslimat.
- Ticaret kıtlık sayısını yalnız `1197 → 1196` düşürdü. Gıda ve enerji yine `0`; sorun artık bölgesel dağıtım kadar toplam üretim/talep dengesidir.
- 30 yıllık soak `ef162480…9c18` karmasıyla geçti; `8/8` devlet ve başlangıç sahiplik sınırları korundu. Ticaret defteri de soak sonunda geçerli kaldı.
- Headless performans borcu açık: 900 saniyelik tek koşu yaklaşık `9,96 sn`, 30 yıllık koşu yaklaşık `38,25 sn`. Bu Chromium kare süresi değildir fakat Faz 22’den önce rota/matching maliyeti profillenmelidir.

## Faz 19 — Piyasa ve fiyat oluşumu kabul sonucu

- `js/StoryMarket.js`, `story-market-price-ledger-1` sürümü ve `fnv1a32:0a61bad5` politika checksum’ıyla 152 bölge × 6 aktif fiziksel fiyatı yönetiyor.
- Bölgesel ekonomi tikleri artık kaynak bazında istenen, teslim edilen, karşılanamayan, üretilen ve üretimde tüketilen miktarı kaydediyor. Fiyat; bu gerçekleşmiş akış, mevcut/güvenli stok, stok günü, yoldaki yük, `HELD` yük ve koridor hasarından türetiliyor.
- Fiyatlar baz `100`, kesin `25–800` sınırı, hedef `0,35–6×`, `0,22` yumuşatma ve tik başına `%10` hareket tavanıyla korunuyor. Hane ve üretici sepetleri ülke düzeyine nüfus ağırlıklı toplanıyor.
- İş gücü `NON_STOCK` modelin sahte kıtlık üretmemesi için `DEFERRED/null`; sermaye para katmanı gelene kadar `NUMERAIRE/1`. Eski `st.inflation`, fiziksel stok, sipariş ve sevkiyat fiyat tikiyle değişmiyor.
- Faz 19’un o aşamadaki ticaret görünümü `INDICATIVE_INDEX_QUOTE`, `createsDebt: false`, `transfersCapital: false`, `PAYMENT_PENDING_PHASE_20` idi; fiyat teklifini ödeme yapılmış gibi göstermiyordu. Faz 20 kabul sonucu aşağıda gerçek escrow uzlaşmasını ayrıca doğrular.
- Hedefli testte 200 küçük ters şokun fiyat aralığı `0,1572`; sıfır stok hedefi `600`, ilk hareket `100→110`; arz fazlası hedefi `48,6752`, ilk hareket `100→90`.
- Tam kesilmiş koridorda yük `HELD`; risksiz fiyat hedefi `52,7292`, aynı fiziksel durumda bekleyen yük/hasar eklenince `63,5241`.
- Oyuncu kendi şehir piyasa sekmesinde fiyat, değişim, band, stok/hedef ve stok gününü `VERIFIED` görür. Yabancı piyasa `UNKNOWN/null`; UI kesin veri uydurmaz.
- Kayıt/yükleme birebir; eski/bozuk piyasa kaydı stok ve yoldaki yükü değiştirmeden baz fiyatlara döner.
- 900 saniyelik A/B: kontrol `3ceb63…42e4`, piyasa açık `412e5b…548f`; ilk ve tek fiziksel olmayan fark `$.marketPrices`. Refah, eski enflasyon, huzursuzluk, toprak, haber ve eski kaynak deltaları sıfır.
- 900 saniye sonunda ortalama fiyat `414,9427`; `671/912` aktif fiyat kritik. Gıda ve enerji hâlâ sıfır, sermaye `2.196.477,50`. Fiyat sistemi açığı görünür kıldı; mal veya denge üretmedi.
- 30 yıllık soak `a08f0ad0…992a` karmasıyla geçti. Fiyat defteri geçerli, aralık `58,2748–600`; fakat `728/912` kritik fiyat ekonomik düzeltme davranışının eksik olduğunu açıkça gösteriyor.
- Performans: aynı 900 saniyelik fiziksel dünya piyasa kapalıyken yaklaşık `12,23 sn`, açıkken `13,42 sn`; ek maliyet yaklaşık `%9,7`. Aktif sevkiyatlar tik başına tek `region|resource` indeksinde toplanıyor.

## Faz 20 — Devlet bütçesi, para ve ödeme kabul sonucu

- `js/StoryBudget.js`, `story-state-budget-ledger-1` ve `fnv1a32:e86e7ccd` politika karmasıyla sekiz devlet için nakit, ticaret escrow’su, borç, açılış özkaynağı ve para ihracı karşı hesabını tutuyor. Her fişin toplamı sıfır olmak zorunda; negatif nakit, eksik devlet hesabı ve bakiyeyi aşan keyfî harcama atomik olarak reddediliyor.
- Eski `points` alanı yeni bir para stokuna çevrilmedi. Komutan cüzdanları devlet `ASSET:CASH` hesabının alt hesaplarıdır ve her yazımdan sonra kanonik toplamla mutabakat yapılır. Şehir puan geliri vergi geliri; konsey, üretim, bina, medya, fraksiyon tavizi ve sermaye kaçışı kaynak etiketli giderdir.
- Borç ihracı son yıllık gelire bağlı tavandan geçiyor. Yıllık faiz ve `%2` anapara ödemesi dünya günüyle işliyor; ödenemeyen faiz borca ekleniyor, gecikme/temerrüt durumu kaydediliyor. Para basımı ayrı karşı hesapta izleniyor, eski makro enflasyonu yükseltiyor ve piyasa güvenini düşürüyor.
- Sınır ötesi ticarette sevk fiyatı kilitleniyor; alıcı nakdi escrow’a alınırken satıcı teslimata kadar gelir yazamıyor. Fiziksel teslimatta escrow satıcıya aktarılıyor, kayıp yükte bloke çözülüyor. Hedefli `3` birimlik probda alıcı `2000→1997`, escrow `0→3`, satıcı teslimata kadar `2000`, teslimatta `2003` oldu.
- Faz 20 alanlarını taşımayan fakat sınır ötesinde aktif kargosu bulunan eski kayıt ayrıca sınandı. Yük `IN_TRANSIT` kaldı, yeni `RESERVED` ödeme kaydına bağlandı; ticaret ve bütçe doğrulayıcıları geçti. Finansman bulunamazsa kargo silinmiyor veya bedava teslim edilmiyor, `PAYMENT_RESERVATION_REQUIRED` ile bekliyor.
- Karşılıksız kaynak üretimi yapan üç eski yol kaldırıldı: otoyol önergesi artık `150⭐` yakıp yaklaşık `400⭐` üretmiyor; tasarruf önergesi komutan başına `60⭐` basmıyor; kampanya açılışından sonra atanan komutan bedava `200⭐` almıyor.
- PlayerKnowledge ve StoryWorldV2 oyuncunun kendi bütçesini `VERIFIED`, yabancı bütçeyi `UNKNOWN/null` yayımlıyor. Şehir dosyasındaki `BÜTÇE` sekmesi nakit, bloke, borç/tavan, faiz, gelir, gider, para basımı ve ödeme durumunu gösteriyor.
- 900 saniyelik kesin koşu `29b96416…2acb` karmasıyla geçti: toplam nakit `17.903,29`, borç `2.163,03`, açık escrow `0`, temerrüt `0`, bütçe doğrulama hatası `0`. Ticaret `3.741,01` gıda, `20.349,78` enerji, `1.704,92` hammadde ve `345,76` sanayi parçasını gerçek ödeme hattıyla teslim etti.
- Faz 20 A/B raporu: kapalı `78407b6c…5294`, açık `29b96416…2acb`. Refah deltası `−0,5`, huzursuzluk `−2,0925`, petrol `+1.714,7744`, insan gücü `−4.133,8758`, puan `+102,2821`; mali kısıt yalnız defter eklemiyor, mevcut kararların gerçekleşebilirliğini değiştiriyor.
- 30 yıllık soak `4b1b3fa0…c9dac` karmasıyla geçti: nakit `71.196,57`, borç `1.380,52`, açık escrow/temerrüt `0`, sekiz devlet ve başlangıç sınırları korundu. Bu sonuç teknik dayanıklılığı kanıtlıyor fakat denge başarısı değil; hiç temerrüt olmaması ve nakdin büyümesi mali baskının zayıf olduğunu gösteriyor.

## Faz 21 — Şirketler ve bankalar kabul sonucu

- `js/StoryCompanies.js`, `story-company-bank-ledger-1` ve `fnv1a32:bf672f25` politika karmasıyla şirketleri devlet bütçesinden ayrı aktörlere dönüştürüyor. Açılışta altı sektör × sekiz ülke = `48` şirket, `8` banka, `412` şirket mülkiyetli tesis ve `152` depo var.
- Başlangıç şirketlerinin ortaklığı toplam `10.000` baz puan: `%88` yerli özel, `%12` devlet. Yeni şirket, başvuru sahibine ait oluyor. Yanlış ortaklık toplamı, sahipsiz/çift sahipli tesis ve kırık proje referansı defteri reddediyor.
- Şirket işlemleri çift taraflıdır. Nakit, proje escrow’su, alacak, borç ve özkaynak hesapları dengelenmeden yazılamıyor; toplam şirket nakdi + banka rezervi + başvuru escrow’su + piyasa takas hesabı, açılış parası ve açık dış girişle mutabık olmak zorunda.
- Bölgesel `capital` artık her tik dışarıdan eklenen soyut stok değil. Özellik açıkken bölgedeki şirketlerin harcanabilir nakdinin aynasıdır. Üretim gerçek şirket nakdiyle sınırlanır; işletme gideri ve toptan satış geliri aynı şirket bilançosuna yazılır.
- Ticaret sözleşmesi/siparişi/sevkiyatı satıcı şirket kimliği taşır. Sınır ötesi yük teslim edildiğinde alıcının devlet escrow’su malın sahibi şirkete ödenir; satıcı devlet kasası şirket geliri sayılmaz.
- Kredi probunda şirket nakdi `160→260`, borç `0→100`, banka rezervi `1400→1300`, kredi alacağı `0→100` oldu. Yetersiz rezerv veya borç/özkaynak tavanı yazımdan önce reddediliyor.
- Yatırım probunda şirket `140` nakdi escrow’a aldı ve `18` sanayi parçasını fiziksel stoktan tüketti. Tesis kapasitesi `180` dünya günü boyunca `0,9` kaldı, tamamlanınca `1,1` oldu; girdi veya nakit adımlarından biri başarısızsa işlem geri sarılıyor.
- Şirket kuruluşu başvuru → sermaye → ruhsat → kayıt zinciridir. Sermaye veya ruhsat eksikken kayıt iki ayrı denemede reddedildi; ikisi tamamlandıktan sonra şirket sayısı `48→49` oldu. Lobi harcaması da şirket nakdinden çıktı.
- Oyuncunun kendi ülke/şehir şirket verisi WorldV2, PlayerKnowledge ve `ŞİRKETLER` şehir sekmesinde `VERIFIED`; yabancı mali ayrıntı `UNKNOWN/null`. Kredi/yatırım/başvuru API sonuçları canlı nesne değil anlık kopya; sonraki tik geçmiş karar raporunu değiştiremiyor.
- Kayıt/yükleme birebir eşit; eski kayıt deterministik bilanço backfill’i, bozuk politika güvenli fallback’i ve özellik kapalı yol geçti. Şirket nakdi değiştikten sonra bölgesel sermaye, bölge düğümü ve HOT/WARM/COLD kapsülü aynı tik içinde eşitleniyor.
- 900 saniyelik A/B (`qa-runtime/story-phase21-ab.json`): kapalı `c49859b5…dfcd`, açık `a668807b…ce31`. Bölgesel sermaye `2.190.739,69→73.138,70`, kıtlık kaydı `1179→1015`, kritik fiyat `654→608`; şirket nakdi `73.458,70`, clearing `27.686,44`, açık şirket borcu/iflas `0`.
- 30 yıllık soak `5a4a5c29…513e` karmasıyla geçti: `48` şirket, `8` banka, `412` tesis, `152` depo, şirket nakdi `94.013,60`, banka rezervi `11.200`; bütün şirket/banka/bütçe/piyasa/ticaret/bölgesel doğrulayıcıları geçti.
- Bu denge zaferi değildir. 30 yılda otomatik kredi `0`, aktif/tamamlanmış proje `0`, şirket borcu ve iflas `0`; çünkü karar üreten şirket/devlet ekonomik AI’si henüz yok. Gıda yine sıfıra iniyor ve `682/912` fiyat kritik. Faz 22, bu defteri kullanarak kronik açığı fark eden, aday üreten, finansman ve fiziksel girdiye göre seçim yapan hilesiz davranışı kurmalıdır.

## Faz 22 — Ekonomik AI politikaları kabul sonucu

- `js/StoryEconomicAI.js`, `story-economic-ai-ledger-1` karar defterinde şirket ve AI-devleti adaylarını gerçek stok/fiyat/marj/nakit/borç/banka/girdi sinyalleriyle puanlıyor.
- Şirket yalnız kendi nakdiyle veya gerçek banka rezervi ve borç tavanından geçen krediyle yatırım yapabiliyor. `140` proje nakdine ek `80` işletme sermayesi tamponu korunuyor.
- Uygulanan yatırım `18` sanayi parçası, ileri teknolojide ayrıca `3` elektronik tüketiyor; kapasite `180` dünya günü tamamlanmadan artmıyor. Sonuç karar kaydına gerçek tesis kapasite farkıyla dönüyor.
- AI devleti yalnız stratejik tarım/enerji açığında, özel finansman kapalıyken ve hazine rezervi korunduğunda hedefli destek verebiliyor. Oyuncu hazinesi bu otonom yoldan açıkça çıkarıldı.
- Hedefli probda `7` kredi, `7` proje, `7` gerçekleşmiş `+0,2` kapasite artışı ve `1` devlet desteği oluştu; iflas `0`. Destekte hazine `2000→1910`, şirket `0→90`; iki defter de geçerli.
- Karar/adayı bağlamayan seçim, katalog dışı eylem, bozuk politika, negatif sıra ve sonsuz skor reddediliyor. Kayıt/yükleme birebir; eski kayıt backfill’i ve bozuk defter fallback’i geçti.
- WorldV2/PlayerKnowledge/şehir `ŞİRKETLER` görünümü kendi karar gerekçesini `VERIFIED`, yabancıyı `UNKNOWN/null` gösteriyor; oyuncu hazinesi adına otonom devlet kararı `0`.
- `qa-runtime/story-phase22-ab.json`: kontrol `a98627f0…b30b5c`, AI açık yol `c3a16e8d…dcba72`. 900 saniyede `30` çevrim, `1.650` değerlendirme, `7` kredi/yatırım, `7` gerçekleşen proje ve `1` hedefli destek üretildi. Kontrolde otomatik proje `0`.
- A/B denge sonucu karışıktır: gıda üretimi `821,04→3.046,94`, kıtlık `1015→1014`; fakat gıda yine `0`, enerji `13,30→0`, kritik fiyat `608→611`. Karar motoru çalışıyor, ekonomi dengelenmiş değil.
- 30 yıllık soak `dcae643c…94e24d` karmasıyla bütün defter doğrulamalarını geçti: `48` şirket, `8` banka, `7` tamamlanmış proje, `9.196,78` şirket borcu ve `0` iflas. Projelerin ilk kuşaktan sonra `7`de kalması sanayi parçası darboğazının üst-kademe koordinasyon eksikliğini kanıtlıyor.
- Headless 30 yıllık koşu yaklaşık `60,91 sn`; Faz 21’in yaklaşık `38,25 sn` sonucuna göre karar adayı/kayıt yolu ölçülebilir performans borcu ekledi. İlk rapor `10,24 MB`, yalnız ekonomik karar görüntüsü `2,29 MB` idi. Uygulanan kilometre taşları korunup tekrarlı `HOLD` geçmişi `600` kayıtla sınırlandıktan sonra bunlar `7,76 MB / 0,88 MB` oldu. Kayıt yükü belirgin azaldı; gerçek EXE p95 profili ve aday hesap maliyeti hâlâ açık kabul kapısıdır.

## Faz 23 — Nüfus kohortları kabul sonucu

- `js/StoryPopulation.js`, `story-population-cohort-ledger-1` ve `fnv1a32:685eab9b` politika karmasıyla 152 bölgenin her birinde 12 anlamlı kohort kuruyor. Her kayıt yaş, gelir, meslek, eğitim ve kimlik yönelimi kesişimini birlikte taşıyor; toplam `1.824` kohort var.
- Kişi sayıları kayan ondalık oran olarak bırakılmıyor. En büyük kalan yöntemiyle tamsayı kişilere dağıtılıyor; her bölgenin kohort toplamı canlı `node.pop × 1000`, her ülkenin toplamı sahip olduğu bölgelerin toplamıyla birebir uyuşuyor. 900 saniyelik kabul koşusunda toplam `7.904.639` kişi tam mutabakatla izlendi.
- Nüfus artışında kohort payları korunarak yeni tamsayı toplam yeniden dağıtılıyor. Fetihte siyasi `countryId` güncel sahibine geçiyor; yerel/ulusal/kozmopolit kimlik yönelimi fetheden devletin adıyla ezilmiyor.
- Faz 17’nin `NON_STOCK` emeği artık çalışma çağındaki tarım, sanayi, hizmet, kamu ve savunma kohortlarından türetiliyor. Kohort katmanı açıkken `externalInflow.labor = 0`; emek `cohortLaborSupply` hesabında ayrı izleniyor. Ücret piyasası kurulmadığı için `wageIndex: null` açık sözleşme olarak korunuyor.
- Sonlu emek yalnız rapor etiketi değildir. Bütün payı çocuk/bağımlı kohorta verilen geçerli stres bölgesinde kullanılabilir çalışan ve emek `0` oldu; emek isteyen altı sektörün üretim toplamı gerçekten `0` kaldı.
- WorldV2, kayıtlı kohortları kalıcı varlık olarak dışa aktarıyor. Oyuncunun kendi şehir sayımı `VERIFIED`; yabancı ayrıntılı dağılım `UNKNOWN/null`. Şehir dosyasındaki `NÜFUS` sekmesi yaş/meslek/gelir/eğitim/kimlik özetini ve üretimde kullanılabilir çalışan sayısını gösteriyor.
- Kayıt/yükleme kohortları birebir koruyor. Eski kayıt canlı bölge nüfusundan deterministik backfill alıyor; toplamı bozulmuş kayıt sessizce kabul edilmiyor. Güncel V3→V2 gölge göçü `1.824` kohortu düşürmeden geçerli dünya üretiyor.
- `qa-runtime/story-phase23-ab.json`: kontrol `e34b35ad…ceb8ec`, kohort açık yol `90e26aab…64dc3`. Kontrolün sınırsız dış emek akışı `22.103.368,25`; treatment’ın kohort emek arzı `22.587.732,32`. İki koşuda tüketilen emek `47.892,49` ve fiziksel stok sonuçları aynı kaldı; normal başlangıç dünyasında emek henüz darboğaz değildir.
- 30 yıllık soak `9f2eea16…4cd63` karmasıyla `39,35 sn` içinde geçti; 152 bölge, 1.824 kohort ve bütün ekonomi/şirket/bütçe defterleri geçerli kaldı. Fakat nüfus `7.904.639→21.277.775` oldu: mevcut `storyCityGrowthTick` düz kişi artışını refah ve altyapıyla saniye başına ekliyor. Bu yaklaşık `%169` artış modern Avrupa için inandırıcı değildir ve doğum/ölüm/göç ayrımı da yoktur.
- Bu sonuç denge zaferi değildir. Katman artık gerçek bir tavan koyuyor fakat 900 saniyelik temel koşuda üretimi sınırlayacak kadar kıt değil. Kohort payları henüz yaşlanma, eğitim, iş değişimi, ölüm/doğum veya göçle değişmiyor; refah ve güvenlik sonuçları da bütün kohortlara farklı ağırlıklarla dağılmıyor. Bunlar Faz 24–27 borcudur.

## Faz 24 — İhtiyaç, refah ve güvenlik kabul sonucu

- `js/StoryNeeds.js`, `story-cohort-needs-ledger-1` ve `fnv1a32:b4b6a957` politika karmasıyla 152 bölge × 12 kohort için toplam `1.824` ayrı yaşam koşulu sonucu üretiyor. Gıda erişimi, enerji erişimi, gelir güvenliği, işsizlik riski, fiziksel güvenlik, kamu hizmeti, toplam güçlük ve birincil baskı ayrı tutuluyor.
- Gıda ve enerji değeri soyut refahtan uydurulmuyor; Faz 17’nin gerçek `HOUSEHOLDS` tahsisindeki `fillBps` sonucunu okuyor. Kamu hizmeti devlet enerji tahsisi ve gerçek bütçe/temerrüt durumundan, güvenlik kuşatma/savaş/garnizondan, gelir güvenliği meslek ve grevden türetiliyor.
- Ücret sistemi henüz bulunmadığı için sahte maaş yazılmadı. Gelir alanı açıkça `EMPLOYMENT_SECURITY_PROXY_NO_WAGE` etiketi taşıyor; şehir UI’si de bunun ücret değil istihdam vekili olduğunu söylüyor.
- Yaş, gelir, meslek ve kimlik aynı şoku farklı ağırlıklandırıyor. Hedefli fiziksel stres testinde seçilen bölgenin gıda/enerji stokları ve bütün üretim kapasiteleri sıfırlandı; hane tahsisleri gerçekten `%0` oldu. Çocuk kohortu `3.830`, üst-orta gelirli kamu kohortu `3.545` baz puan yaşam koşulu kaybetti; çocukta gıda katkısı `2.553`, karşı kohortta `2.222` baz puandı.
- Grev, hizmet çalışanının gelir güvenliğini `7.200→4.400`; kuşatma aynı bölgenin fiziksel güvenliğini `9.140→1.140` baz puana düşürdü. Bu kanallar birbirinin etiketiyle karıştırılmıyor.
- Faz 24 eski `st.welfare` alanına sürekli yeni ceza yazmıyor. Hedefli testte ihtiyaç tiki öncesi/sonrası sekiz devletin eski refah değerleri birebir aynı kaldı. Böylece geçmişte tespit edilen korelasyonlu çift-ceza hatası yeniden kurulmadı; Faz 25 bu sonuçlardan ayrı ve açıklanabilir şikâyet hafızası üretecek.
- WorldV2 bölge özetini ve kohort sonucunu taşıyor. Kendi bölgesi `VERIFIED / OWN_SOCIAL_SERVICES`, yabancı bölge `UNKNOWN/null`. Şehir `NÜFUS` sekmesinde `YAŞAM KOŞULLARI` görünümü eklendi; ayrıntı yabancı şehirden sızmıyor.
- Kayıt/yükleme defteri birebir koruyor. Faz 24 öncesi kayıt canlı fiziksel ekonomi ve nüfustan açıklamalı backfill alıyor; `10.001` baz puan enjekte edilmiş bozuk kayıt sessizce kabul edilmeyip güvenli yeniden kurulum yapıyor. V3→V2 gölge göçü bölge ve kohort yaşam sonuçlarını düşürmüyor, `needsWelfare` bilinmeyen alan uyarısı üretmiyor.
- `qa-runtime/story-phase24-ab.json`: kapalı `b5a49a85…9fe69`, açık `df1fe535…9b65`. Eski refah, enflasyon, huzursuzluk, devlet/toprak, haber ve eski kaynak deltalarının tamamı `0`; açık yol yalnız yeni açıklayıcı toplumsal durum üretiyor. 900 saniye sonunda ortalama yaşam koşulu `%35,19`, gıda erişimi `%0`, enerji erişimi `%2,70`, gelir güvenliği `%57,52`, güvenlik `%92,05`, kamu hizmeti `%27`.
- Bu son değerler başarı değil, ciddi denge alarmıdır. Faz 24 fiziksel açığı yaratmadı; Faz 17–22 üretim/talep zincirinde zaten tükenen gıda ve enerjiyi artık insan sonucuyla görünür kıldı. Eski refahın `62,25` kalırken gerçek yaşam koşulunun `35,19` olması ayrıca eski makro refah ile fiziksel hayat arasındaki kopukluğu kanıtlıyor. Faz 25 bu baskıyı hafızaya alacak; üretim/talep ayarı ve devletin krize cevap vermesi Faz 28–33/55–58 borcudur.
- 30 oyun yılı soak `83e1174f…36f6` karmasıyla `49,27 sn` içinde geçti. 1.824 sonuç ve bütün defterler geçerli kaldı; fakat gıda ve enerji erişimi `%0`, yaşam koşulu `%34,86`, kamu hizmeti `%27` oldu. Nüfusun `21.277.775`e şişmesiyle birleşen bu durum teknik dayanıklılığın oynanış dengesi olmadığını kesinleştiriyor.

## Faz 25 — Kamuoyu ve Şikâyet Hafızası kabul sonucu

- `js/StoryOpinion.js`, `story-public-opinion-memory-1` sözleşmesiyle Faz 24'ün fiziksel sonuçlarını 1.824 kohortun ayrı toplumsal hafızasına çeviriyor. Sorun türü, sorumlu görülen gerçek aktör, dayanak kodu, güven, ilk/son gözlem, tekrar sayısı, mevcut/tepe şiddet ve aktif/iyileşen durum birlikte tutuluyor.
- Algılanan sorumluluk gerçek dünya kimliklerine bağlanıyor: gıda ve enerji ilgili sektör şirketine, kamu hizmeti ve güvenlik ülke yönetimine, gelir uygun olduğunda kohortun gerçek işverenine yazılıyor. Bu alan nesnel kusur hükmü değildir; şehir UI'si açıkça “sorumlu görülen” ifadesini kullanıyor.
- Hafıza tek tiklik ruh hâli veya sınırsız toplama değildir. Hedefli eğride üç kriz tiki ilk tepeyi `2.183` baz puana getirdi; dört iyileşme tikiyle `1.762`ye indi fakat silinmedi; aynı kriz dönüşünde `3.457`ye çıktı ve bölüm sayısı `2` oldu. Tam unutma `63` güçlü iyileşme tiki sürdü.
- Faz 25 salt toplumsal algı katmanıdır. Faz 24 ihtiyaç defterini, eski `st.welfare` değerlerini ve fraksiyonları değiştirmiyor; protesto, grev, ayaklanma veya radikalleşme üretmiyor. Bu davranış sahipliği Faz 26'da kalıyor.
- WorldV2 ülke, bölge ve kohort özetlerini taşıyor. Kendi bölgesi `VERIFIED / OWN_SOCIAL_RESEARCH`; yabancı bölge `UNKNOWN/null`. Şehir `NÜFUS` sekmesi biriken sorunları, etkilenen kohort/insan sayısını, yönü, durumu ve algılanan sorumluyu gösteriyor; yabancı ayrıntı sızmıyor.
- Kayıt/yükleme canlı defteri birebir geri kuruyor. Faz 25 öncesi kayıt geçmiş uydurmadan boş hafızayla başlıyor; bozuk baz puan, baskın kayıt ve toplulaştırma tutarsızlığı dünyayı silmeden güvenli boş hafızaya alınıyor. Fetih sonrası bölge/ülke bağları uzlaştırılıyor; V3→V2 gölge göçü bölge ve kohort özetlerini koruyor.
- 900 saniyelik tam kabulte 1.824 kohortta 7.696 kayıt oluştu: 5.642 aktif, 2.054 iyileşen; 1.093 kohort yüksek şiddetli, 228 kohort `%99+` doygun, nüfus ağırlıklı ortalama `%71,24`. Bütün kohortların doygunlaşmaması ve kohort başı 12 kayıt tavanı kabul kapılarıdır.
- Tekrarlanan alan adlarının kayıt şişirmesini önleyen `COMPACT_RECORD_ARRAY_V1` biçimi eklendi. 900 saniyelik dünya `1.725.815` karakterle 2 milyon bütçesini, hedefli prob `1.361.825` karakterle 1,5 milyon bütçesini geçti. Açılışta tam çalışma zamanı şemasına geri genişletiliyor ve katı doğrulayıcıdan geçiyor.
- Tam `npm test` çıkış kodu `0`; ana karma `b813d8a71f08ed424d59b1506de2d80750abfcbd0f21cd5cf7ff1e87bc0ac664`, test içi ana koşu `122.828 ms`. Fiziksel sonuçlar gıda `%76,55`, enerji `%77,56`, yaşam koşulu `%70,82` olarak korundu. A/B probu yeni toplumsal durumu değiştirirken fiziksel ekonomi ve eski oynanış sonucunu birebir eşit tuttu.
- `qa-runtime/story-phase25-ab.json` kalıcı kanıtı kapalı `9af31ad5…fdf5`, açık `b813d8a7…a664` karmasını kaydetti. İlk durum farkı yalnız `$.publicOpinion`; eski refah, enflasyon, huzursuzluk, etkin devlet, haber ve üç eski kaynak deltasının tamamı `0`.
- Yüksek ortalama şikâyet gerçek bir sonraki tasarım baskısıdır: Faz 26 eylem eşiklerini yalnız anlık şiddetten değil süre, tekrar, yayılım, aktör, örgütlenme kapasitesi ve devlet tepkisinden türetmeli; aksi halde 900 saniyelik normal dünyada otomatik sürekli isyan döngüsü doğar.

## Faz 26 — Protesto, Grev ve Radikalleşme kabul sonucu

- `js/StoryCollectiveAction.js`, Faz 25'in gerçek aktör kimlikli şikâyetlerini ülke + sorun + algılanan sorumlu ekseninde sınırlı hareketlere topluyor. Anlık duygu zarı yok; yayılım, süre, tekrar, etkilenen nüfus, örgütlenme vekili, mobilizasyon, radikalleşme, devlet cevabı ve geçmiş bastırma birlikte karar veriyor.
- Aşama sırası `NONE → PROTEST → STRIKE → UPRISING`. Protesto `6.200` mobilizasyon / `6.000` şiddet / üç ardışık tik; grev yalnız `income|employment` sorununda `7.300` mobilizasyon / `5.200` örgütlenme / dört tik; ayaklanma `9.300` mobilizasyon / `9.000` radikalleşme, yeterli tekrar ve sekiz tik ister. Alt kapanış eşikleri, cooldown ve kapı sayaçları eşik titreşimini kesiyor.
- Hedefli ağır gelir krizinde ilk protesto 11., ilk grev 16. tikte oluştu; kronik kriz tek başına ayaklanma üretmedi. İlk bastırma, tavize göre mobilizasyon/radikalleşmeyi daha yüksek bıraktı; ikinci bastırma sonrası aynı çözülmemiş kriz 55. tikte ayaklanmaya dönüştü. Sessiz toplum sıfır yanlış eylem üretti.
- Protesto fiziksel üretim cezası değildir. Gelir/istihdam grevi yalnız katılan bölgede üretimi `%65`e, ayaklanma `%30`a indirir. `publicServices` şikâyeti grev etiketi alamaz. Ülke geneli çarpan kaldırıldı; eski `st.welfare`, fraksiyon yazımı ve eski huzursuzluk köprüsü kapalıdır.
- İlk uygulama denemesinde bütün ülkeye grev cezası verilmesi 900 saniyede gıda/enerji/yaşamı yaklaşık `%36,39/%57,03/%52,03`e düşürüp 7 grev üretti; aynı fiziksel krizi iki kez saydığı için reddedildi. Etki bölgeye indirilince `%73,06` gıda / `%67,14` yaşam görüldü fakat kamu hizmeti protestosunun grev sayılması hâlâ yanlıştı. Grev semantiği emek kanallarına daraltıldı ve eski genel sayaç köprüleri tamamen kaldırıldı.
- Oyuncu `CONCEDE/NEGOTIATE/SUPPRESS/IGNORE` cevabı alır; bildirim zaman aşımında eski seçenek UI kuyruğundan gerçekten silinir. AI aynı doğrulanmış durumdan seçim yapar. LLM sayı, eşik veya karar üretmez; rastgele karar yoktur.
- Kayıt/yükleme birebir, eski kayıt boş/açıklamalı backfill, bozuk defter dünya korunarak güvenli sıfırlama, sahiplik sonrası türetilmiş özet yenileme, V3→V2 göç ve özellik/prerequisite kapalı yollar geçti. Kendi bölgesi tam doğrulanmış; yabancı bölgede yalnız kamusal eylem görünür, mobilizasyon/radikalleşme/örgütlenme sızmaz.
- Tam 900 saniyelik `npm test` çıkış kodu `0`; politika karması `fnv1a32:bd78ac61`, dünya karması `7a42d4d6e955f996be269880c9691acdaf33ee1ebc5476872a4df119e2554b14`. 56 hareket, 5 aktif protesto, 0 grev, 0 ayaklanma, 22 olay; ortalama mobilizasyon `5.774`, radikalleşme `4.590` baz puan. Normal koşuda nadir dallar zorlanmadı; ağır hedefli prob bunları ayrıca kanıtladı.
- `qa-runtime/story-phase26-ab.json`: kapalı `ebd87ca106eb4c02b4f63d2f5e3bf2a071ba3c0e4d32772d90f3e47678183bde`, açık `7a42d4d6e955f996be269880c9691acdaf33ee1ebc5476872a4df119e2554b14`. İlk fark yalnız `$.collectiveAction`; refah, enflasyon, huzursuzluk, etkin devlet, haber, petrol, insan gücü ve puan deltaları `0`.
- Faz 28 öncesi örgütlenme modeli bilerek `COHORT_NETWORK_PROXY_PRE_PHASE_28` olarak etiketlidir. Gerçek sendika, lider, kaynak ve güç merkezi henüz yoktur; bunları varmış gibi sunmak yerine Faz 28'de kanonik aktöre göç ettirilecektir.

## Faz 27 — Göç ve Mülteci Akışı kabul sonucu

- `js/StoryHumanMigration.js`, `story-human-migration-ledger-1` şemasıyla ülke içi göç, sınır ötesi göç ve mülteci akışını aynı sınırlı defterde yürütüyor. Karar yalnız kanonik nüfus/iş/gelir/gıda/enerji/güvenlik sonuçlarından türetiliyor; LLM ve rastgele zar kullanılmıyor.
- Göç ışınlanma değildir. Her akış gerçek `StoryInfrastructure` koridor rotası, yolculuk süresi, ortak akış kapasitesi, `PLANNED/IN_TRANSIT/BLOCKED/COMPLETED/CANCELLED` durumu, sınırlı retry ve açıklanabilir neden kodları taşır. Kara ve deniz koridorları kapalı zorlamada sıfır akış üretildi.
- Nüfus sahipliği `StoryPopulation.storyPopulationTransferCohorts` atomik kapısından değişiyor. Hedefli probda 17 kişi bölge 0'dan 6'ya tam taşındı ve dünya nüfus deltası `0` kaldı. Zorlanmış güvenlik krizinde 90 kişilik mülteci akışı bölge 0'dan 106'ya gerçek beş koridorlu rotada önce kapasite yüzünden bloklandı, sonra tamamlandı; toplam nüfus yine korundu.
- Kayıt/yükleme yoldaki akışları, kapasite rezervlerini ve sayaçları birebir geri kuruyor. Faz 27 öncesi kayıt güvenli boş defterle açılıyor; bozuk defter dünyayı silmeden sıfırlanıyor. Kayıt alma artık geçerli ihtiyaç/kamuoyu defterini gereksiz uzlaştırarak canlı durumu değiştirmiyor; uzlaştırma yalnız doğrulama başarısızsa çalışıyor.
- Bilgi sınırı korunuyor: oyuncunun kendi ülkesindeki akışlar tam doğrulanmış görünür; yabancı ülkede yalnız tamamlanmış ve kamusal sonuçlar gösterilir. Aktif rota, niyet, aday hedef ve hassas nüfus ayrıntısı yabancı şehir UI'sine sızmaz.
- 900 saniyelik tam koşuda `231` akış oluştu: `46` aktif, `167` tamamlanmış, `18` iptal; toplam `3.955` kişi taşındı (`1.706` sınır ötesi, `2.249` ülke içi), `256` olay kaydedildi. Normal koşuda mülteci oluşmaması eksik dal sayılmadı; nadir güvenlik yolu hedefli deterministik probla kanıtlandı.
- Tam `npm test` çıkış kodu `0`; dünya karması `880b861ba56e9954cf5c319db5ce96835c606205e4c7d5af08157dc4a5c33cb6`. Final gıda `%85,13`, enerji `%85,36`, yaşam koşulu `%73,33`; sekiz devlet hayatta kaldı. 19 görevli scheduler kayıt/devam koşusunda birebir aynı sıra ve sonuç üretildi.
- `qa-runtime/story-phase27-ab.json` kontrol/treatment kanıtını ve atomik nüfus, mülteci, kapasite, kayıt/yükleme kapılarını saklıyor. Faz 27 açık dünyada huzursuzluk `3,285→3,090`; gıda/enerji/yaşam `%76,55/%77,56/%70,82→%85,13/%85,36/%73,33` oldu. Bu fark fiziksel nüfusun gerçekten yer değiştirmesinden doğuyor; eski Faz 22 salt dağıtım benchmark'ı Faz 27'yi açık bırakıp artık aynı sonucu beklemiyor.
- İlk dilim konut varlığı, sınır politikası ve ticaretle ortak koridor kapasitesi varmış gibi davranmıyor. Çekim/itme içinde `HOUSING_PROXY_PRE_ASSET_SYSTEM`, sınır kabulünde açık politika yerine güvenli deterministik vekil ve yalnız göçe ait kapasite bütçesi kullanılıyor. Bunlar sonraki fazların gerçek sahipleri geldiğinde göç ettirilecek.
- Monolitik 46 problu test dosyası sonuç nesnelerini uzun süre tuttuğu için Node'un 4 GB heap sınırına ulaştı. Test komutu davranışı azaltmadan `--max-old-space-size=8192 --expose-gc` ile tam kapsamı koruyor; bu oyun çalışma zamanı gereksinimi değil, QA tezgâhı borcudur. Kalıcı çözüm probları ayrı süreçlere bölmektir.
- Faz 28 bu örgütlenme vekilini kimlikli güç merkezi referansına bağladı. Faz 27'nin konut, sınır rejimi ve ortak kapasite vekilleri ise Faz 28 kapsamında uydurulmadı; kendi varlık/politika sahiplerini bekliyor.

## Faz 28 — Güç Merkezleri kabul sonucu

- `js/StoryPowerCenters.js`, sekiz devlet için yedi türde toplam `56` kimlikli merkez kuruyor: silahlı kuvvetler, iş dünyası konseyi, emek konfederasyonu, kamu idaresi, medya ağı, iç güvenlik ağı ve radikal ağ. Defter şeması `story-power-center-ledger-1`, politika karması `fnv1a32:436a24d1`.
- Destek tabanı kayıtlı üyelik iddiası değildir; 1.824 kanonik kohortun meslek/gelir/eğitim/yaş profillerinden ağırlıklı kişi desteğidir. İş dünyası nakdi şirket defteriyle birebir, kamu idaresi bütçesi devlet bütçesiyle, ordu kapasitesi gerçek komutan/garnizon/birlikle kaynaklanır.
- Her merkez lider/ofis, üç açıklanabilir amaç, destek, kaynak kanıtı, örgütlenme, etki, hizalanma, bağımsızlık ve kapasite taşır. Ordu/iş dünyası gerçek aktöre bağlıdır; beş lider açık `OFFICEHOLDER_PROXY_PRE_PHASE_34`, medya ve güvenlik kapasitesi sırasıyla Faz 39/47 vekilidir.
- Merkezler henüz eylem uygulamaz. Faz 29 öncesi `executableActionTypes: []`, eşzamanlı eylem tavanı `0` ve `blockedUntilPhase: 29`; böylece kurum varlığı ile anayasal/yasal yetki birbirine karıştırılmaz.
- Faz 26 hareketleri merkez kimliklerine göç etti. İlk ham bağlantı örgütlenme kapasitesini doğrudan davranış tabanına koyup gıda/enerji/yaşamı yaklaşık `%74,40/%76,08/%69,62`ye indirdiği için reddedildi. Nihai bağlantı nötr referans + `1.200` baz puan ölü bölge + yalnız aşırı sapmaya `%25` ağırlık kullanır; kolektif çıktı kendi merkez girdisine geri bağlanmaz.
- Kendi ülke/şehir görünümü tam doğrulanmış kapasiteyi, yabancı görünüm yalnız kamusal merkez/lider/amaç bilgisini taşır. Yabancı destek, kaynak, örgütlenme, etki, kapasite, öncelik ve aktör kimliği sızmadı. Şehir dosyasındaki `KURUMLAR` sekmesi gerçek defteri gösteriyor; ekonomi içindeki eski fraksiyon görünümü de aynı kaynağa yönlendirildi.
- Kayıt/yükleme birebir; Faz 28 öncesi kayıt açıklamalı backfill; bozuk defter dünya kaybı olmadan yeniden kurulum; özellik veya şirket öncülü kapalıyken açık `null`; V3→V2 ülke/bölge/üst düzey projeksiyonu ve scheduler sırası geçti. Toprak devrinde bayat türetilmiş özet kaydı engellemiyor ve yeni sahip gerçekten yükleniyor.
- Nihai 900 saniyede 56 etkin merkez ve 26 olay vardır. Gıda `%85,13`, enerji `%85,36`, yaşam `%73,33`; ortalama refah `65,375`, enflasyon `2,255`, huzursuzluk `3,09`; sekiz devlet hayatta. Normal dünyada 6 protesto, 0 grev, 0 ayaklanma ile Faz 27 sonuçları korunmuştur.
- `qa-runtime/story-phase28-ab.json`: kapalı `f9ce09a7…c4bfc`, açık `52bd56c2…6607a`; dünya durumu yeni ledger nedeniyle farklıdır fakat refah, enflasyon, huzursuzluk, devlet/haber ve petrol/insan gücü/puan deltalarının tamamı `0`. Açık/kapalı doğrulayıcılar, kayıt/yükleme ve gizlilik kapısı geçti.
- Tam `npm test` çıkış kodu `0`; toplam duvar süresi `1.645 sn`, test içi ana 900 saniyelik simülasyon `132.280,69 ms`. Önceki 30 dakikalık zaman aşımı eşzamanlı 12-worker savaş benchmark’ıyla CPU rekabetiydi; kapsam veya eşik azaltılmadan temiz koşu tamamlandı. Sıradaki uygulama **Faz 29 — Rejim ve Kurum Şeması**dır.

## Faz 29 — Rejim ve Kurum Şeması kabul sonucu

- `js/StoryInstitutions.js`, sekiz devlette yürütme, yasama, yargı, silahlı kuvvetler komutası ve yerel idare olmak üzere `40` kimlikli kurum kuruyor. Beş mevcut anayasa etiketi farklı onay zincirlerine sahip rejim profillerine dönüştürülüyor; toplam `29` eylem türü sürümlü rotaya bağlı.
- `DIRECT`, `JOINT`, `PETITION`, `PROHIBITED` ve dış-domain ayrımı gerçek davranış taşıyor. Başvuru hakkı onay hakkına eşitlenmiyor; bütün zorunlu makamlar imzalamadan karar yetkilendirilmiyor ve yalnız kayıtlı yürütücü tamamlayabiliyor. Sahte aktör, yasal rotasız eylem ve yabancı yerel yetki alanı hedefli probda ayrı ret kodlarıyla durduruldu.
- Faz 28 merkezlerinin eski `DECLARED_LIMITS_PRE_PHASE_29` kilidi canlı anayasal sınıra göç etti. Merkez eylemleri doğrudan, kurumsal onaya bağlı veya yasak olarak bölünüyor; merkezin kendi koordinasyonu sahte ikinci makam istemiyor, lobi/dilekçe kurumsal onaysız yürümüyor.
- Makam imzası küresel değil ülke bazında. Başka devletin rejim değişimi bekleyen oyuncu kararını etkilemedi; kendi devletinin rejim/makam zinciri değiştiğinde istek `STALE_AUTHORITY` oldu. Sadakat gibi akışkan değerler makam imzasından çıkarıldı.
- WorldV2 `40` tekil kurum, ülke yetki şeması ve bölgesel yerel idare taşıyor. Kendi görünüm tam yetki/onay kaydını, yabancı görünüm yalnız kamusal rejim/makam/yetki alanını gösteriyor; aktör kimliği ve bekleyen onaylar sızmadı. Şehir `KURUMLAR` sekmesi anayasal düzeni gösteriyor, ekonomi/fraksiyon görünümü güç merkezlerini ayrı tutuyor.
- Kayıt/yükleme birebir; eski kayıt canlı anayasa ve makamlardan açıklamalı backfill alıyor; bozuk makam sahibi kaydı güvenli yeniden kurulumla reddediliyor; özellik veya güç merkezi öncülü kapalı yol `null`. Scheduler 21 görevli sicilde kurumu göçten sonra, güç merkezinden önce 5 saniyelik ritimde çalıştırıyor.
- Tam regresyon iki gerçek hatayı buldu ve düzeltme sonrası sıfırdan yeniden geçti. Yükleme sırası `komutan → kurum → güç merkezi → kolektif hareket → göç` yapıldı; Faz 26 hareket kaydı tekrar birebir oldu. WorldV2/UI görünümü salt-okunur yapıldı; hedefli projeksiyon `44af8086…4224` karmasını önce/sonra korudu.
- `qa-runtime/story-phase29-ab.json`: kapalı `a32befd1…1a45`, açık `4a7b34ad…23a0`. İlk fark yalnız `$.institutions`; refah, enflasyon, huzursuzluk, devlet/haber ve üç kaynak deltasının tamamı `0`. Açık koşuda `40` kurum, `179` tik ve `1` uzlaştırma olayı vardır.
- Nihai 900 saniyede gıda `%85,13`, enerji `%85,36`, yaşam `%73,33`; ortalama refah `65,375`, enflasyon `2,255`, huzursuzluk `3,09`; sekiz devlet hayatta. Tam `npm test` çıkış kodu `0`, toplam süre `1.734,8 sn`, ana koşu `134.268,9 ms`, dünya karması `4a7b34ade1039f0f44ce00fa2f82a59ab9677af92709a92016525d4f361323a0`.
- Faz 29 fiziksel karar uygulaması değildir. `AUTHORIZATION_RECORD_ONLY_PHASE_29` yalnız geçerli yetki fişi üretir. Kapasite, gecikme, yolsuzluk ve bölgesel uygulama farkı uydurulmadı; sıradaki uygulama **Faz 30 — Meşruiyet ve Devlet Kapasitesi**dir.

## Faz 30 — Meşruiyet ve Devlet Kapasitesi kabul sonucu

- `js/StoryStateCapacity.js`, sekiz ülke ve 152 bölge için `story-state-capacity-ledger-1` defterini kurdu. Meşruiyet, bürokratik kapasite, hukuk devleti, kurumsal bütünlük, yapısal yolsuzluk riski, bölgesel denetim ve birleşik uygulama kapasitesi ayrı kaynaklarla açıklanıyor; risk kanıtlanmış suç sayılmıyor.
- Yalnız Faz 29'da gerçek kurum önericisi/yürütücüsüyle `EXECUTED` olmuş yetki kayıtları uygulama bileti doğuruyor. `QUEUED`, `IMPLEMENTING`, `COMPLETED`, `DEGRADED`, `PAPER_ONLY` durumları; eylem karmaşıklığı, sabit süre, kapasite eşiği, son tarih, kalite, sızıntı ve neden kodlarıyla deterministik ilerliyor.
- Hedefli probda normal devlet `COMPLETED` (`6223` kapasite), çökmüş devlet `PAPER_ONLY` (`231` kapasite), çalışan bürokrasi/zayıf bütünlük `DEGRADED` (`4999` kalite, `5590` sızıntı) verdi. Kaybedilmiş bölge ve son tarih aşımı ayrıca kâğıt-üzeri sonuç üretir; RNG veya LLM kararı yoktur.
- `CAPACITY_IMPLEMENTATION_RECORD_ONLY_PHASE_30` fiziksel etki uygulamaz. Ekonomi, refah, kaynak, toprak ve kurum alanına doğrudan yazma yasaktır; terminal fiş `physicalMutation: false` taşır. Sonraki domain yalnız açık sözleşmeyle `effectReady` sonucunu tüketebilir.
- Kendi ülke görünümü kapasite kaynakları ile uygulama biletlerini doğrulanmış gösterir. Yabancı görünüm yalnız kamusal meşruiyet ve bölgesel denetimi taşır; bürokrasi, bütünlük, yapısal risk, kaynaklar ve biletler sızmaz. Şehir `KURUMLAR` sekmesi aynı bilgi filtresini kullanır ve ekran açılışı dünya durumunu değiştirmez.
- WorldV2 üst düzey biletleri ve ülke/bölge kapasitesini taşıyor. Kayıt/yükleme birebir, V3→V2 göç, eski kayıt backfill'i, bozuk kayıt kurtarma, özellik veya kurum öncülü kapalı `null` yolu ve salt-okunur projeksiyon geçti.
- `qa-runtime/story-phase30-ab.json`: kontrol `8f99c8f0…8d21`, açık `6ab5c579…fd50`; ilk fark yalnız `$.stateCapacity`. Refah, enflasyon, huzursuzluk, etkin devlet/haber ve petrol/insan gücü/puan deltalarının tamamı `0`. Doğal koşu sahte karar üretmedi: `179` tik, `8` ülke, `152` bölge, `0` bilet.
- Scheduler artık `22` görev taşır; devlet kapasitesi her `5 sn` toplumdan sonra, kuşatmadan önce çalışır. Tam kapsamlı `npm test` çıkış kodu `0`; toplam duvar süresi `1.947,9 sn`, ana 900 saniyelik simülasyon `135.999,11 ms`, dünya karması `6ab5c57982878f71bd7c8cb0a4c41025d095ea21ed8db40806aba1b9c906fd50`. Sıradaki uygulama **Faz 31 — Seçim ve İktidar Değişimi**dir.

## Faz 31 — Seçim ve İktidar Değişimi kabul sonucu

- `js/StoryElections.js`, sekiz ülke için `story-election-mandate-ledger-1` kurdu. Rejime göre oransal parlamento, liberal halk oyu, meclis seçimi veya sınırlı yürütme yarışı kullanılıyor; askerî rejimde seçim uydurulmuyor ve haleflik Faz 33'e bırakılıyor.
- Oy hakkı çocuklar çıkarılmış gerçek Faz 23 kohortlarından tam kişi olarak hesaplanıyor. Katılım yaş/eğitim/şikâyet/meşruiyet; tercih iş/kimlik/gelir, Faz 25 mesele hafızası, kamusal Faz 28 desteği, ülke siyasi yönelimi ve yönetim kanıtından türetiliyor. RNG/LLM karar vermiyor.
- Dört liste `POLITICAL_SLATE_PROXY_PRE_PHASE_34` olarak açıkça vekildir; gerçek aday karakteri, hedefi, ilişkisi veya sesi uydurulmaz. Oransal modelde çoğunluk yoksa oy sırasına göre koalisyon kurulur.
- Dar marj ve zayıf hukuk birlikte itiraz açar; süre sonunda yargısal/idari onayla sertifika oluşur. Sertifika yeni mandat ve makam kimliği üretir; kurumun ülke-bazlı yetki imzası değişir ve eski bekleyen karar bayatlar. Sonuç `MANDATE_RECORD_ONLY_PHASE_31`, `physicalMutation:false` olduğu için politika/ekonomi iki kez uygulanmaz.
- Kendi ülke görünümü kohort ve hesap kanıtını doğrulanmış taşır. Yabancı görünüm yalnız kamusal yarış, katılım, sonuç, koalisyon ve makam devrini gösterir; pusula, puan bileşenleri, kaynak tikleri ve örgüt etkisi sızmaz. Şehir `KURUMLAR` sekmesi aynı filtreyi kullanır ve ekran açılışı dünyayı değiştirmez.
- Hedefli prob `16` seçim, `8` sertifika, `8` barışçıl devir, `2.862.026` seçmen ve `2.022.822` tam tahsisli oy üretti; iki farklı kazanan liste ve sekiz koalisyon oluştu. İtiraz eşik karşı-testleri, makam imza değişimi, WorldV2/knowledge/UI gizliliği ve salt-okunurluk geçti.
- Kayıt/yükleme birebir, kesintisiz koşu ile checkpoint'ten devam aynı, V3→V2 göç, eski kayıt backfill'i, bozuk kayıt kurtarma, özellik/öncül kapalı `null` yolu geçti. Yüklemede seçim mandatını kurumdan sonra bağlayan ilk sıra iki sahte yetki olayı üretiyordu; seçim görüntüsü kurum restore'undan önce hazırlanarak düzeltildi.
- `qa-runtime/story-phase31-ab.json`: kontrol `20ccfde1…d2a2`, açık `f7cfa97e…230d1`; ilk fark `$.elections`. Açık 900 saniyelik koşu `24` seçim kaydı, `11` sertifika, `19` mandat ve `11` devir üretti. Refah, enflasyon, huzursuzluk, etkin devlet, haber, petrol, insan gücü ve puan deltalarının tamamı `0`.
- Scheduler artık `23` görev taşır; seçim her `5 sn` devlet kapasitesinden sonra ve kuşatmadan önce çalışır. Tam kapsamlı `npm test` çıkış kodu `0`; toplam süre `1.867,8 sn`, ana 900 saniyelik simülasyon `143.630,69 ms`, dünya karması `f7cfa97e39511a10a6bdd691d29eedeb9abd67f4c1be8a8992d3da065e8230d1`. Sıradaki uygulama **Faz 32 — Patronaj, Yolsuzluk ve Soruşturma**dır.

## Faz 22.1 çalışma günlüğü (arşiv)

**Arşiv kapanış kararı (2 Ağustos 2026):** Aşağıdaki maddeler Faz 22.1E'nin teşhis ve deney günlüğüdür. Son hane dağıtım kabulü bütün fiziksel, mali, deterministik ve uzun dönem denge kapılarını geçti; Faz 22.1E tamamlandı. O tarihte sıradaki uygulama **Faz 25 — Kamuoyu ve Şikâyet Hafızası** idi; güncel sıra belgenin üstündeki faz tablosundadır.

1. Faz 22.1A–D aday uygulamasını sertleştirmek: reçete darboğaz sayacı, ülke portföyü, fiziksel yatırım emaneti ve gerçek rota/ödeme tedariki kodlandı; henüz kabul edilmedi.
2. Faz 22.1 kapalı kontrol yolundaki karma ve davranış sızıntısını bulmak. Gereksiz sipariş şema alanı kaldırıldı fakat kontrol hâlâ `8` proje üretiyor; beklenen Faz 24 karması sağlanmadan A/B kanıtı geçerli sayılmaz.
3. Bounded retry/backoff uygulandı: tek 900 saniyelik koşu `65,61→34,63 sn`, açık emir `179→151`, aktif sevkiyat `237→209`. Üretim girdisi emrinin geçici sevk hatasında iptal edilmesi kaldırıldı; son adayda `88` üretim ithalat emri şirket yerine devlet finansmanında bekliyor. Alıcı şirket/banka/escrow’yu doğrudan satıcıya bağlayan deney `%3,94/%6,42` ve `10` iflas; satıcıya ikinci ödeme yapmayıp takas havuzuna döndüren deney `%4,27/%4,19` ve `9` iflas üretti. İkisi de geri alındı. Önce geliri üretimden gerçek satış anına taşıyan; hane, şirket ve devlet ödemelerini stok-maliyet/borç-alacakla kapatan para dolaşımı kurulmalı.
4. 900 saniye kabul koşusunun güncel adayı son 300 saniyede gıda `%48,32`, enerji `%53,62`, yaşam koşulu `%57,00` ve `33` tamamlanmış proje üretti; `%60/%70` kapısı geçmedi. Bütün üretimi öne alma ve dört erken parça sevkiyatı deneyleri daha kötü sonuç verdiği için geri alındı.
5. Proje hazırlık iptali/iadesi, eski kayıt backfill’i, bozuk emanet kurtarması ve özellik-kapalı yol için hedefli Faz 22.1 probu eklemek.
6. Son kodda `npm test` ve 30 oyun yıllık soak kapılarını geçirmek. Bounded retry ve kalıcı üretim emri değişikliklerinden sonraki tam paket `230bc647…ef36` karmasıyla geçti (`900` simülasyon saniyesi, test içi `50,16 sn`, çıkış kodu `0`); hedefli ticaret/bölgesel/korunum probları da geçiyor. Bu teknik geçiş denge kabulü değildir: final erişim gıda `%45,89`, enerji `%48,84`, yaşam koşulu `%55,51`; 30 oyun yıllık soak hâlâ yeniden koşulmalı.
7. Faz 25’e yalnız Faz 22.1 fiziksel, A/B ve denge kapıları geçtikten sonra başlamak.
8. Her faz başlangıcı ve kabul raporu öncesinde `DIS_ANALIZ_VERI_DEFTERI.md` içindeki açık kayıtları ana planla karşılaştırmak; dış öneriyi kanıt olmadan uygulanmış gerçek saymamak.
9. Faz 22.1E’de `OPERATING_CAPITAL` anlamı düzeltildi: tarım çevriminde `2` birim sermaye bir gider değil likidite eşiği; gerçek fiziksel enerji maliyeti `0,045`, beklenen satış `0,42`. Beş sivil sektör bu semantikte pozitif marjlı; savunma üretimi gerçek maliyet + `%12` devlet sözleşmesiyle çalışıyor. Üretim satış olmadan gelir yazmıyor; depolama, ticaret kargosu ve yatırım emaneti sahipli lotlarla kapanıyor.
10. Hane, şirket, devlet ve ordu talepleri gerçek ödeyen kimliklerine ayrıldı. Sınır ötesi özellik-açık akışta satıcı şirket lotu, gerçek ithalatçı sektör şirketi, şirket nakit escrow’su, teslimatta satıcı COGS/gelir ve ithalatçı envanter devri tek zincirde kapanıyor; devlet varsayılan şirket girdisini ödemiyor. `20+8 sn` kayıt/devam probu `26` aktif şirket rezervasyonu ve `307,0511` escrow ile birebir geçti. Reçetelerin zaten satın aldığı enerji/parça/elektroniği ikinci kez tüketen eski `FACILITY_OPERATION`/`MAINTENANCE`/`TECH_MAINTENANCE` vekilleri settlement yolundan çıkarıldı; şirketler arası gerçek faturalar devam etti (`60 sn`de `3.996` COMPANY faturası). Güncel 300 sn treatment gıda `%55,21`, enerji `%65,89`, yaşam koşulu `%61,47`, `6` proje ve sıfır iflas üretti; bütün doğrulayıcılar geçti fakat iki kabul kapısı açık kaldı.
11. Sıradaki 22.1E işi fiyat bonusu, otomatik kredi veya kör lojistik artışı değildir. Kredi deneyi borcu `1.010→1.737`, projeyi `7→5`, gıda/enerjiyi `%43,99/%50,00→%36,86/%40,68` yaptığı için geri alındı. Enerji hedefini büyütme, ayrı şebeke dispatch’i, upstream sektör sırası ve `18→24` üretim-girdisi sevkiyatı da genel dengeyi kötüleştirdi; hiçbiri tutulmadı. Güncel kök açık, son tikte `64` tarım bölgesinin enerji nedeniyle tamamen durması ve ihtiyaç sonuçlarının bölgeler arasında eşitsiz dağılmasıdır. Bu tahsis problemi çözülmeden 900 sn treatment kabul adayı sayılmaz.
12. Dış analizden kabul edilen “tek ekonomi, altı mercek” sözleşmesi yalnız tasarımdır, uygulanmış özellik değildir. Faz 22.1E kabulünden sonra ilk ekonomik oynanabilirlik kanıtı tek şirket üzerinde `ne üret / kime sat / sat mı stok-yatırım mı yap` döngüsüdür; ayrı oyuncu ekonomisi, bedava kaynak ve gizli fiyat yasaktır. Tam altı-rol bilgi/yetki birleşimi Faz 59–60.3’e bağlandı.
13. Karakter başlangıcı Faz 34’e sıkılaştırıldı: role göre dağıtılan 12 bedelli karar, `≤10` dakika ilk görünür sonuç, profilin eylem yasaklamaması ve geçmişin olay+`WorldFact`+`ActorBelief` olarak doğması zorunlu. `muhalif/yandaş` kalıcı kişilik değil türetilmiş rejim hizasıdır. Henüz kodlanmadı.
14. Yeni dış bina/proje analizi tasarım düzeyinde kabul edildi; aktif iş sırasını değiştirmedi. Faz 22.1E kapanınca önce mevcut `412` tesis ve `152` depoyu toplam kapasiteyi bozmayan kanonik varlık şeması/probuyla temsil etmek, sonra kesintili proje–tedarik–bakım çevrimini, ardından gerçek kimlikli B2B hizmet şirketleri ile `MechanicalContractV1`/teslim fişini açmak planlandı. Hizmetler fiziksel ve mali defteri atlayan çarpan olmayacak; `NegotiationCase` yalnız deterministik sözleşme taslağının konuşma katmanı olacak. Şirket devri ile oyuncunun kişisel itibar/kariyer sürekliliği daha sonraki Faz 34–35 ve 59–60.3 bağlarına bırakıldı.
15. Ülke tanısı artık `productionInputOperatingReserve`, `productionInputDomesticAvailable`, `commerceInventory`, sipariş hata/durumları, yönlü fiziksel kargo ve bölge kimlikli tarım-enerji blokajını birlikte veriyor. `300 sn`de ülke 5 enerjisinin `12.067` birimi gerçekten sevk edilebilirken blokeli yedi hedefin tamamı `0` stokta kaldı. Fiziksel stok–sahipli lot ve blokaj sayacı–bölge listesi mutabakatları tam teste eklendi; `npm test` varsayılan `230bc647…ef36` karmasıyla geçti. Sıradaki uygulama kota/hız artışı değil; tek ülke kabul kararını çoklu gerçek rota bacağına ve ayrı teslim fişlerine bölen, mevcut parça-hammadde admission bütçesini dışlamayan iç dağıtım sözleşmesi + mikro korunum probudur.
16. `story-domestic-distribution-contract-1` mikro çekirdeği tamamlandı fakat otomatik üretim seçicisine bağlanmadı. Tek admission `2–8` aynı ülke hedefini; toplam kaynak stok, sahipli kargo ve paylaşılan koridor kapasitesi üzerinden mutasyondan önce doğruluyor. `3+2` enerji probunda kaynak sevkte `-5`, hedefler teslimden önce `0`, teslimde tam `+3/+2`; fiziksel ve ticari toplamlar `8.300,36` ile korundu. İki ayrı rota/manifesto/lot fişi üretildi, sınır aşımı ve batch toplamı tahrifi reddedildi, yoldaki kayıt bayt-bayt geri yüklendi. Tam paket çıkış kodu `0`, varsayılan hash tam `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36`. Sıradaki kabul borcu gerçek darboğaz seçicisi, admission–dispatch yarış güvenliği ve `300/900 sn` A/B’dir; bunlar olmadan Faz 22.1E kabul edilmiş veya denge düzelmiş sayılmaz.
17. Üç otomatik seçici adayı ölçülüp geri alındı. LRU-ülke batch’i `%60,51/%63,13/%61,41`, kısa-rota/tek-pencere batch’i `%51,05/%43,75/%56,05`, spot marjinal-değerli tekil sıra `%60,60/%69,79/%62,83`; referans `%60,73/%72,52/%64,26`. Son aday projeyi `11→13` artırdı ama halk sonucunu düşürdü; “daha çok yatırım” başarı sayılmadı. Canlı davranış eski seçiciye döndü. Salt-okunur karşı-olgusal görünüm tutuldu: 300 saniyelik treatment’ta `107` fırsatın `72`si hemen uygulanabilir, `23`ü yoldaki kargoyla kapsanmış, yalnız `3`ünde ülke içi kaynak ve `9`unda rota/kapasite yok. Sıradaki skor spot fiyat değildir; hane ihtiyaç etkisi, üretim zinciri derinliği, eşzamanlı blokaj, gecikme ve ekonomik değeri ayrı guardrail’lerle birleştirmelidir. Geri almalar sonrası tam test geçti; varsayılan hash `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36` olarak kaldı.
18. Salt-okunur gözlemci artık tek spot puan yerine açıklanabilir amaç vektörü ve Pareto karşılaştırması üretir: doğrudan ihtiyaç, canlı zincir açma, gerçekleştirilebilirlik, teslim kapsamı/gecikmesi ve ekonomik değer ayrı alanlardır; eski seçici sırası yan yana tutulur. 300 sn treatment sonucu/hash değişmedi (`%60,73/%72,52/%64,26`, `8460df44…d431d56`). `72` sevk edilebilir fırsattan `19` küresel öncü çıktı: `18 SURVIVAL`, `1 CHAIN_RECOVERY`; eski ilk sekiz bazı ülke-Pareto-2/3 adaylarını taşırken gerçek küresel öncüler eski sırada `11–56.` basamaklardaydı. Ön kümeye dâhil hiçbir aday başka adayca bütün ölçütlerde ezilmiyor. Tüm-dünya katmanlaması ülke-içi katman + yalnız `43` yerel öncünün küresel rank-1 karşılaştırmasına indirildi; aynı `19/43` sonuç korunurken 300 sn yoğun probu `55,9→30,3 sn` indi. Harness bu pahalı raporu yalnız açık `includeTradeProductionOpportunityView` isteğinde üretir; canlı API hazırdır. Temiz tam paket geçti: varsayılan 900 sn hash `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36`, ana koşu `39.336,97 ms`. Bu henüz davranış değildir. Sıradaki borç aynı stok için karşılıklı dışlama, ülke/kaynak kotası, upstream + doğrudan ihtiyaç guardrail’i ve atomik admission–dispatch rezervasyonu olan özellik-bayraklı tek-pencere seçicisini kurup `60/300/900 sn`de ölçmektir.
19. `story-production-admission-plan-1` salt-okunur karar penceresi tamamlandı. Kaynak fiziksel stok/sahipli lot, hedef talep ve paylaşılan koridor kapasitesi birlikte sanal rezerve ediliyor; yalnız `IMMEDIATE` ülke-Pareto öncüleri, `SURVIVAL/CHAIN_RECOVERY` şeritleri, ülke başına `≤3`, bacak başına `≤1` ve mevcut kaynak kotaları kabul ediliyor. `300 sn`de `43` uygun adaydan `12` çatışmasız sevkiyat (`8` ülke, `6 enerji + 6 parça`, `8,141335` birim) seçildi; iki politika yuvası temsil edildi, doğrulama ve salt-okunur hash kapısı geçti. Dördüncü canlı seçici deneyi 16 sn aralıkla legacy akışın yerini aldı; defterler ve süre kapısı geçmesine rağmen 300 sn sonucu `%60,73/%72,52/%64,26→%34,55/%30,54/%49,45`, tamamlanan ekonomik sonuç `18→10` düştü. `≤1` birimlik marjinal sevkiyatlar legacy yüksek hacimli boru hattını ikame edemediği için canlı bayrak/commit geri alındı; admission planı ve regresyonları tutuldu. Sıradaki borç güvenli aday seçimi değil, seçilen aday için çevrim/pencere tabanlı hacim planı ve legacy teslim tabanı korumasıdır.
20. Hacim ve legacy tabanı borcu kapatıldı. Admission artık seçilen hedefe bekleyen kargo düşülmüş dört üretim pencerelik hacim verir ve en az bir tam pencereyi karşılayamayan kaynağı reddeder; 300 sn salt-okunur pencere `74,26534` birimi çatışmasız planladı. Varsayılan-kapalı `economy.paretoVolumeAdmission`, legacy üretim ve normal dengeleme sonrasında yalnız `SURVIVAL` ek sevkiyatı yapıyor. 300 sn `%68,27/%74,89/%65,80`, `23` sonuç; 900 sn final `%64,35/%71,04/%66,56`, son 300 sn ortalama `%64,08/%70,00/%65,48`, `60` sonuç verdi. Sekiz defter ve `2.150` sevkiyat sıfır hatayla geçti; `6→8` enerji kotası kötüleştiği için geri alındı. Bu ilk uzun dönem başarılı 22.1E adayıdır ancak yaşam koşulu `%70` kapısı hâlâ açık; Faz 25 bekliyor. Yeni aktif teşhis, artan gıda üretiminin hane/bölge erişimine neden tam dönüşmediğidir.
21. Hane dağıtım katmanı son açığı kapattı ve Faz 22.1E kabul edildi. Varsayılan canlı yol, önceki gerçek hane tahsis açığını dört pencereyle sınırlar; yalnız ülke içindeki gerçek stok/sahipli lot, açık kargo ve ortak rota kapasitesini kullanır, her teslimatı mevcut sipariş–manifesto–lot–ödeme zincirinden geçirir. `60 sn` `%89,94/%85,16/%75,69`; `300 sn` `%79,56/%83,42/%71,48`; `900 sn` final `%76,55/%77,56/%70,82`; son 300 saniye ortalaması `%79,54/%79,31/%71,24`. Sekiz doğrulayıcı, kayıt/yükleme ve deterministik tekrar geçti; `10.712` ek sevkiyatta sıfır hata görüldü. Tam `npm test` çıkış kodu `0`, hash `9dd9f7fce2324704249cbf7e4235a526d569ae5f7dd295ff939b3a3305ae4719`, raporlanan ana koşu `176.175,18 ms`. Açık teknik borç, talep/kaynak başına rota çözümünün maliyetidir; sonraki fazın davranışını değiştirmeden ayrıca profillenecektir. Sıradaki faz **Faz 25 — Kamuoyu ve Şikâyet Hafızası**dır.
