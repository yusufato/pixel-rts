---
status: active
owner: osman
last-reviewed: 2026-08-26
canonical: true
---

# Hikâye Modu Katmanlı Dünya Simülasyonu — Uygulama Durumu

**Başlangıç tarihi:** 30 Temmuz 2026  
**Plan:** `../plans/HIKAYE_MODU_KATMANLI_DUNYA_SIMULASYONU_PLANI.md`
**Son kapanan faz:** Faz 38.7 — Önyargı, Geçici Stres ve Kamu Personası

**Aktif çalışma zamanı:** Faz 38.13 — Oynanabilir Karakter Etkileşimi ve Resmî Toplantılar (`partial`)
**Aktif uygulama sırası:** Faz 38.13 kalan birleşik kabul borçları
**Modern dünya gap defteri:** `MODERN_DUNYA_EKSIKLERI.md`

**26 Ağustos ilerleme uzlaştırması:** Ana planın Faz 38.1 imleci ve bu belgenin
Faz 38.8 çalışma satırı bayattı. Güncel kaynak ve hedefli
`node tests/story-conversation-case.test.js` kabulü; 4 katılımcı, 37 tur, iki
önerge, üç tepki türü, iki sürüm, `MeetingOutcomeReceiptV1`,
`MeetingClosureRecordV1`, tek kanonik kurum isteği, 5 ikili özel kayıt ve 2
karakter yanıtı üretti. Bu nedenle gerçek sınır Faz 38.13 `partial`dır.
Kapanış/yetkili teklif yönlendirmesi, görünürlük-korumalı özel not yanıtı ve
gerçek kurum+komutan hesabı+escrow+sonuç makbuzlu devlet görevi tamamlandı.
Görev ve toplantı sonuçları şema-2 ilişki defterindeki kaynaklı, yönlü ve
soğumalı sonuç fişlerine bağlandı. Şirket bütçeli görevler ayrı kapsamdır;
Faz 38.13 kalan birleşik kabul borçları nedeniyle `partial`, Faz 39 pasiftir.

**14 Ağustos kanıt dikeyi:** Ekonomi FACT zincirinden sonra karakter→oyuncu yönlü
ilişki kaydı da imzalı DomainEvidence/ContextPack kaynağına bağlandı. Ters yön ve
üçüncü aktör verisi sızmaz; ilişki kenarı yoksa puan uydurmak yerine doğrulanmış
“kayıt oluşmadı” sonucu taşınır. Hafıza ContextPack'e artık her turda bütün
`PROMISE/SECRET` kayıtlarıyla girmez; sorunun konu/niyeti, muhatap sahipliği ve
oyuncuyla yönlü ilgisi birlikte zorunludur. Kaynaklı hafıza cevabı 8B doğal dil
gerçekleştirmesine açılmıştır; en az bir izinli MEMORY kimliği ve kaydın somut
konusuyla metinsel bağ yoksa model cevabı reddedilip güvenli fallback korunur.
Teknoloji gerçekleri Faz 42'yi, toplantı gerçekleri
Faz 38.13'ü bekler. Gece `100×10` koşusu doğal 8B yararlılığı geçmeden kapalıdır.

**14 Ağustos canlı oyuncu corpus düzeltmesi:** Son gerçek görüşmede baskın hata
8B'den önceki `UNKNOWN/REPAIR_REPETITION` duvarıydı. Kimlik, sağlık söylentisi,
dört ayrı iş/görev niyeti, olumsuz güven beyanı, teknoloji görüşü/projesi, yeni
sır teklifi, proaktif sohbet isteği ve üç gündelik veda ailesi birebir canlı
metinlerle ayrıldı. Yeni sır teklifi eski SECRET geri çağrımı yapmaz. Yanlış kişi
eki ve servis-botu Türkçesiyle kabul edilmiş iki 8B cümlesi sert reddedilir.
Hedefli canlı paket `50`, adversarial paket `60` senaryoda geçti. RTX/CUDA küçük
smoke sıfır hata verdi; üç tur doğallık kabulü sayılmaz.

**Tam paket durumu:** İki altı-işçili `npm test` koşusu sırasıyla yaklaşık
`677,3 sn` ve `659,3 sn` sürdü. İkincisi `46/81`de bayat boolean test sözleşmesinde
durdu; bu nedenle tam paket yeşil ilan edilmedi. Koşuların açtığı üç borç kapandı:
salt-okunur hafıza kaynağı artık ham `row.source` beklemiyor, bilinmeyen yaş
`null→0` olmuyor ve kohort profil probu string yerine boolean döndürüyor. Kariyer,
yaşam, kohort, aktivasyon bütçesi, sohbet sözleşmeleri ve 1.200 turluk sanal
laboratuvar hedefli olarak temizdir. Güncel tüm-81 yeniden koşusu açık kanıttır.

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
| Faz 32 — Patronaj, Yolsuzluk ve Soruşturma | `complete` | `js/StoryIntegrity.js`; gerçek yetki/bütçe/şirket kanıtı, iddia→ön inceleme→soruşturma→bulgu, bilgi filtreli WorldV2/UI, kayıt/göç ve `qa-runtime/story-phase32-ab.json` |
| Faz 33 — Darbe, Bölünme ve İç Çatışma | `complete` | `js/StoryPoliticalCrisis.js`; isimli aktör, hazırlık/koalisyon/karşı-güç, dört bedelli oyuncu hamlesi, deterministik teşebbüs, bilgi filtreli WorldV2/UI ve `qa-runtime/story-phase33-ab.json` |
| Faz 33.1 — Yönetim Çalışma Alanı İlk Oynanabilir Sürüm | `complete` | `js/StoryGovernance.js`; gerçek rol/makam görünümü, yetki kilidi ve alternatif yol, iki bedelli karar, kurum onayı → Faz 30 kapasite fişi → fiziksel şehir sonucu, kayıt/yükleme ve hedefli UI probu |
| Faz 34 — Karakter Kimliği ve Hedefleri | `complete` | `js/StoryCharacters.js`; 88+ kimlik, dört kararlı boyut, değer/korku/hırs/kırmızı çizgi/hedef/ses, türetilmiş rejim hizası, gerçek seçim adayları ve rol uyarlamalı 12 bedelli karar. Komutan `6/3/3`; her cevap mekanik kazanç+bedel, olay, WorldFact, ActorBelief, tepki kancası ve anında görünür sonuç üretir. Hedefli `12 olgu / 31 inanç / 0 yabancı sızıntı`; kayıt/yükleme ve V3→V2 göç kayıpsız. |
| Faz 35 — Çok Boyutlu İlişkiler | `complete` | `js/StoryRelationships.js`; 176 karakter, 627 seyrek/yönlü bağ, güven/korku/saygı/borç/husumet, A→B/B→A asimetrisi ve köken kararı etkisi. Dört oynanabilir kök kendi sorularına/kariyerine ve gerçek şirket/kurum/servis bağına sahip. WorldV2/PlayerKnowledge/göç/kayıt kapıları ve savaş AI yükü altındaki tam `56/56` regresyon geçti. |
| Faz 36 — Üç Katmanlı Hafıza | `complete` | Gerçek Talks→PROMISE, siyasi kriz→EPISODE/BETRAYAL, bütçe makbuzu+yönlü ilişki→DEBT ve özel güçlü bütünlük kanıtı→SECRET zincirleri çalışıyor. 900 sn soak `84.578/4.000.000` karakter ve tüm katman tavanlarıyla geçti. Tam 57 görev üretildi; izole raster `573,204 ms`, korunmuş sette bütün assertion'lar çıkış `0`, ana karma `145d5775…b3b72`. |
| Faz 37 — Karakter Eylem Adayları | `implemented` | `js/StoryCharacterActions.js` + `js/StoryContacts.js`; yedi adayın tamamı gerçek yürütücü taşır. Dört sosyal eyleme ek olarak emir Faz 33.1 yönetim zincirine, sabotaj 30 saniyelik gizli operasyon ve kanonik altyapı hasarına, istifa kalıcı makam geçişine bağlıdır. Bilgi-sınıflı genel temas dizini yalnız ajan rolünde kamusal kara topolojisinden sabotaj hedefi üretir; komutanda operasyon yüzeyi yoktur. Hedefli gerçek DOM probunda `197` kamusal varlık, `14` operasyon ve sıfır yabancı konum/gizli alan sızıntısı ölçüldü. Şema-6 sonrası 900 saniye `22/22` geçerli doğrulama ve `70056c2d…6d4d36e5` karma verdi. Nihai paket `59/59`, `1.139,0 sn`, çıkış `0`; tam rol navigasyonu Faz 59–60.3 borcudur. |
| Faz 38 — LLM Karakter Hakemi | `implemented` | `story-character-arbiter-3` + `StoryCharacterSpeech.js`; kodun `54` commit eşiğini geçen en çok sekiz adayından yalnız opak `Qxxxx` veya PASS kabul edilir. Aynı-bağlam sonraki-tik tüketimi ve Faz 37 yeniden doğrulaması geçerlidir. Sürüm-8 eylem defteri `512` tavanlı karar/cümle/hitap geçmişi taşır. Serbest LLM metni yerine sınırlı gerçekleştirici son altı tam cümleyi ve üçüncü ardışık hitabı engeller; yalnız oyuncuya yöneltilen söz UI'da görünür. Model kapısı `5/5 + 5/5`; tam paket `61/61`, `558,4 sn`, çıkış `0`, ana karma `70056c2d…6d4d36e5`. |
| Faz 38.1 — Oyuncu Konuşmasını Anlama | `partial` | Güvenli analiz, serbest söz, sınırlı açıklama oturumu, ayrı görüşme penceresi, iki taraflı ön-inceleme, sahipli `ActorBelief` kanıtı ve kanonik karşı teklif cevabı çalışıyor. Oyuncu UI'dan `READY_FOR_NEGOTIATION` durumuna geçebilir; fiziksel ekonomi değişmez ve aday icra edilemez kalır. Hedefli DOM/mahremiyet/save-load/v2→v3 probu temiz. Tam paket `62/62` sonucu üretti ve bütün Faz 38.1 assertion'ları geçti; fakat eşzamanlı altı askerî bina üretim değişikliğiyle ana dünyanın son-300 yaşam ortalaması `%69,28 < %70` oldu. Eşik düşürülmedi; küresel kabul, `NegotiationCase` ve görsel EXE açık. |
| Faz 38.2 — Uzun Diyalog Gerçekleştirme | `partial` | Üç gerçek karakter × 24 turda `72/72` sürümlü söz; son 12 tam cümle, son altı şablon, `%72` iki-sözcüklü ve `%86` açıklanabilir Türkçe içerik yakınlığı tavanlarıyla deterministik geçti; ölçülen en yüksek içerik yakınlığı `%37,5`. Üç ayrı gerçek ses ekseni imzası oluştu. Gerçek domain-review cevabı bu katmandan geçiyor; kaynak mekanik metin ayrıca saklanıyor. 12 eğitim + 24 anonim maddeli kör paket ve ayrı anahtar üretildi; kimlik sızıntısı yok. İnsan kör skorunun kendisi açık. |
| Faz 38.3 — Söz, Sır, Borç ve Pazarlık Defteri | `partial` | Gerçek hazır konuşmadan idempotent/sürümlü vaka çalışıyor. Süreli sözler `OPEN→KEPT/BROKEN`; özel ActorBelief ve kaynaklı sızıntı/ihanet ilişkiler ile SECRET/BETRAYAL/PROMISE/DEBT hafızasına bir kez yazılır. `MechanicalContractV1`, konuşma vakasından ayrı sürümlü kanonik defterdir; `GOODS/SERVICE/CONSTRUCTION/LOGISTICS/INSURANCE` ailelerini tanır, karakter temsilcileri ile hukuki şirket taraflarını ve kaynak vaka/sürüm/önkontrol kimliklerini ayrı taşır. İlk gerçek adaptör yalnız `GOODS`: UI'dan etkinleşen teslim şirket escrow'su, kanonik rota, dünya takvimi, ceza ve sözleşme durumunu birlikte izler. Önceden şirket escrow'uyla finanse edilmiş yükte `BUYER_TO_BUYER_RESALE` ilk sipariş/escrow'u korur, yeni alıcı eski alıcıya ayrı escrow açar, iki satış atomik kapanır ve tek fiziksel lot yeni faydalanıcıya geçer. Dört yaşam yolu müzakere, sözleşme, bütçe, şirket, commerce ve ticaret defterlerinde idempotent ve save/load birebirdir. Tam paket `64/64`, `736,8 sn`, çıkış `0`; 900 sn dünya karması `a1c2f0c9…c4d`, sekiz devlet, `%79,33/%78,31/%72,56` gıda/enerji/yaşam verdi. SERVICE/CONSTRUCTION/LOGISTICS/INSURANCE dünya adaptörleri ve insan kör ses skoru açık olduğundan faz `partial` kalır. |
| Faz 38.4 — Diyalog Ağacı Senaryo Laboratuvarı | `partial` | Temiz Faz 38.1 tabanına sekiz tek-turlu gündelik niyet (`GREETING/CHECK_IN/THANK/APOLOGIZE/FAREWELL/ASK_PERSONAL_OPINION/SMALL_TALK/REQUEST_SUPPORT`) yeniden eklendi. Gerçek modal tıklamasında “Bugün nasılsın?” doğru `CHECK_IN` cevabını üretti; dünya değişmedi, defter geçerli kaldı ve save/load aynı cevabı geri getirdi. On özel mekanik senaryonun karar matrisleri laboratuvarda deterministik ve dünya-nötrdür; ancak rollback öncesi özel speech-act/varlık bağlayıcıları canlı motorda değildir. Güncel runtime bu metinleri geçerli, komutsuz ve ham dünya defteri okumayan güvenli fallback'e bırakır. Bileşimsel domain adaptörü entegrasyonu açık borçtur; eski stash canlı başarı kanıtı sayılmaz. Bu dilim yalnız ilk gündelik mesajı kapsar; karaktere özgü çeşitlilik, LLM gerçekleştirme ve aynı oturumda takip mesajı Faz 38.5 borcudur. |
| Faz 38.5 — Sohbet Çalışma Alanı İlk Oynanabilir Sürüm | `partial` | Temiz deterministik çekirdek yeniden kuruldu: takip bestecisi ikinci ve sonraki mesajları yeni konuşma açmadan aynı `sessionId/followUps[]` altında atomik kaydeder. Üç ardışık gerçek modal tıklamasında merkez panel, bütün oyuncu ve karakter turları ile besteci birlikte kaldı; oturum sayısı `1`, takip sayısı `3`, defter geçerli ve save/load birebir oldu. Karakter üslubu kanonik `voiceProfile` ile muhatap→oyuncu yönlü ilişkiyi okuyarak `WARM/DIRECT/FORMAL/GUARDED` kayıt seçer; 12 gerçek karakter aynı soruda 6 ayrı cümle ve 11 ses parmak izi üretti. Aynı resmî karakterin dört selam turu dört farklı cümle verdi ve aynı seed'de birebir deterministik kaldı. LLM isteği artık öncelikli ortak kuyrukta çalışır; model sonucu merkezi `innerHTML` yenilemeden yalnız kendi `data-conversation-response-text` düğümünü yamalar. Gecikmeli model testinde `sessionId`, textarea düğümü, taslak, seçim ve kaydırma korundu; açılış/takip kopyaları ve save/load birebir kaldı. Mevcut 4,92 GB Turkish-Llama gerçek GPU koşusunda yaklaşık `8,48 sn` yükleme, `0,81 sn` ilk yanıt ve `5,21 GB RSS` verdi. Modelin gerçek eğitim bağlamı `8192` olduğundan 10K zorlaması reddedildi. İkinci gerçek çıktı biçimsel olarak geçmesine rağmen “yoruldum”a “sevindim” dedi; duygu çelişkisi ve kişi-ek uyumsuzluğu kapısı eklendi, bozuk çıktı reddedilip güvenli cevap korundu. Aktif hafıza motoruna salt-okunur aktör-sahipli geri çağrım yeniden eklendi. Açık geçmiş/söz sorusunda muhatap yalnız kendi ve oyuncuyla ilişkili kaynağı hatırladı; başka aktörün `SECRET` kaydı sızmadı, ham dünya okunmadı, UI kaynak sayısını gösterdi ve save/load birebir kaldı. ContextPack artık ilgisiz ekonomi/genel ilişki turuna söz veya sır taşımaz; açık söz, borç, karar, çatışma, konuşma ve gizlilik ifadeleri ayrı hafıza türlerine yönlenir. Kaynaklı hafıza güvenli fallback üstünden 8B gerçekleştirmesine açıktır; izinli kaynak kimliği ya da kayıt konusuyla bağ yoksa çıktı kabul edilmez. Olay çıpalı konuşma ve daha geniş insan kabulü açık olduğundan faz `partial`dır. |

**12 Ağustos çalışma zamanı geri dönüşü:** Oyuncu kabulünde merkez konuşma paneli sıfırlanırken sağdaki geçmişin devam ettiği hata çözülemedi. Semptom yamaları bırakıldı; `Talks.js`, `StoryConversationUnderstanding.js`, Electron/LLM köprüsü, karakter konuşma şablonları, sohbet hafızası ve modal CSS'i `10a8169` ana-faz sürümüne döndürüldü. Oynanabilir çalışma zamanı bu nedenle **Faz 38.1** seviyesindedir. Geri alınan deneyler `conversation-post-main-phase-rollback-2026-08-12` ve `conversation-runtime-post-main-phase-rollback-2026-08-12` stash'lerinde korunur. Dünya/müzakere/mekanik sözleşme ilerlemeleri geri alınmadı.

**12 Ağustos temiz Faz 38.4 yeniden kurulumu:** Geri alınan çok-turlu/LLM/DOM deneyleri açılmadan yalnız kapalı sosyal niyet sınıflandırması ve tek deterministik cevap eklendi. Önceki sorunlu “Seni dinliyorum” kalıbı geri getirilmedi. Test tezgâhındaki ilk başarısız modal tıklamasının üretim hatası değil, `DOMContentLoaded` öncesi bağlama olduğu ayrıştırıldı; doğru yaşam döngüsünde gerçek düğme tıklaması, merkez panel yenilemesi, dünya nötrlüğü, defter doğrulaması ve save/load birlikte geçti. Aktif sınır artık **Faz 38.4**; eski Faz 38.5 stash'i doğrudan geri alınmayacaktır.

**12 Ağustos temiz Faz 38.5 regresyon ayrımı:** `conversationRuntime385Probe`, geri alınmış deneysel olay zincirinden ayrıldı. Kalıcı görev `1/1`, `0,9 sn` içinde 23 takip turunu, 24. tur güvenlik reddini, `6000` yaklaşık-token geçmiş bütçesini, güncel turun üretim geçmişinden dışlanmasını, kaynaklı hafıza sahipliğini, yabancı `SECRET` gizliliğini, dünya nötrlüğünü ve birebir save/load'u geçti. Eski birleşik `conversationUnderstandingProbe`, 24 tur tavanına rağmen üç oturumda toplam 49 takip bekleyen `fiftyTurnQualityGate` ve geri alınan olay-kabul API'lerini aynı görevde taşımaya devam ediyor; tam paket bu bayat prob yeniden ayrıştırılmadan temiz kabul edilmiş sayılmayacaktır. Motor tavanı testi geçirmek için gevşetilmedi.

**11 Ağustos canlı oyuncu takip düzeltmesi:** Oyuncunun aynı oturumdaki ikinci sözü ekranda yalnız `BAĞLAMSAL YEDEK` üretti. Canlı süreçte `llm-host` yaklaşık `4,8 GB` ile gerçekten yüklüydü; bağlantı yokluğu teşhisi yanlıştı. Renderer'daki eski `LLM.inFlight >= 1 → null` kapısı, haber/Chatter/hakem üretimi sürerken oyuncu sohbetini kuyruklamadan atabiliyordu. Ortak öncelik kuyruğu eklendi; oyuncu sohbeti `priority=100` ile çalışan işi kesmeden sonraki yuvayı alır, kuyruk dolarsa daha düşük öncelikli arka plan işi düşer. Ana model bağlamı `1024→4096` yükseltildi; son on konuşma satırı sınırlı tutuldu. Turkish-Llama'nın başlık/madde iskelesi tek-cevap ayrıştırıcısında temizleniyor ve ret/üretim nedeni UI etiketine taşınıyor. Kullanıcının gerçek `Ordu topluyorum, desteğini istesem kabul eder misin?` sözü artık `REQUEST_SUPPORT / CONTINUE_REQUEST` olarak hedefli probda geçti. Bu değişiklik ana süreç+renderer yeniden başlatılmadan çalışan eski oyuna uygulanmaz.

**11 Ağustos ikinci canlı kabul düzeltmesi:** LLM tamamlanırken çalışma alanının `innerHTML` ile yeniden kurulması, oyuncunun henüz göndermediği textarea taslağını ve odağını siliyordu. Aynı oturum renderı artık taslak, seçim aralığı, odak ve iç kaydırmayı korur; daha önemlisi aktif editörde yazı varsa LLM renderı DOM'a hiç dokunmadan odak kaybı/gönderime ertelenir. Hedefli DOM probunda textarea düğümü değişmedi ve taslak+`18..34` seçimi korundu. EXE-eşit gerçek model sınaması ilk ham çıktıda istem başlıklarını aynen yankıladığını kanıtladı; serbest parser bırakılmadı. Yanıt tek alanlı `{reply}` JSON gramerine alındı. İlk gramerli çıktı izinsiz “kabul ettim” sözü verdiği için karar sınırı ve karşı-doğrulayıcı eklendi. Son gerçek üretim `Anladım. Destek talebinizin niteliğini ve kapsamını netleştirmek için daha fazla bilgiye ihtiyacım var...` sonucunu verdi; başlık yankısı, sayı ve mekanik taahhüt yoktu. Güvenli JSON kabulü ile sayı/iç kimlik/tam tekrar/izinsiz taahhüt retleri ve taslak erteleme probu temizdir.
| Faz 38.6 — Algılanan Dünya ve Karar İzi V2 | `complete` | `js/StoryDecisionTrace.js`; yalnız karar sahibinin kaynaklı `ActorBelief` referanslarından `DecisionContextV2`, gerçek adaydan/PASS'ten `DecisionTraceV2` üretir. Otonom tarama ile kaynaklı olay tepkisi ayrı tetikleyicidir; sahte/aktörde bulunmayan olay inancı reddedilir. TARGET/AUTHORITY/DOMAIN/COST/COOLDOWN/EXECUTOR, rol-ülke-kurum-organizasyon-servis, aktif hedef, yönlü ilişki, seçicide zaten kullanılan psikoloji katkısı ve puan etkisiz risk ayrı kanıttır. MAJOR/WORLD izsiz kaydedilemez; ortak bağlam güvenli budanır; şema-8 geçmişi `LEGACY_UNAVAILABLE` olarak korunur. Oyuncu projeksiyonu yalnız ortak inancı gösterir; özel skor, ilişki, psikoloji ve risk sızmaz. “Sana Söylenenler” içindeki gerçek DOM açıklaması, gizli WorldFact enjeksiyonu, aday dışı ret, kaynak olay, çapraz referans/tavan/yetim bağlam, şema-8 göç, deterministik tekrar ve birebir save/load hedefli probda geçti; Faz 37 eylem ve Faz 38 hakem/konuşma regresyonları temizdir. |
| Faz 38.7 — Önyargı, Geçici Stres ve Kamu Personası | `complete` | `js/StoryCharacterBehavior.js`; her gerçek aktör için en çok iki `CANONICAL_CORE_AXIS` biası, kaynak ActorBelief zorunlu geçici stres ve mevcut `voiceProfile`dan kamu personası kurar. Bias, seçicide aynı eksen zaten kullanılmışsa `AXIS_ALREADY_COUNTED` ile sıfır katkı verir; bias+stres toplamı mutlak `4` puanla sınırlıdır ve Faz 38.6 karar izine kaynaklarıyla girer. Aynı `8000 bp` şok iki karakterde farklı tepki verdi; `60 sn` yarı ömürde `4000`e indi ve kaynak yenilenmeyince kapandı. Kamu/özel ifade planları ayrıdır fakat `scoreEffect:0` ve `mechanicalDecisionMutable:false` sınırını taşır. Yeni sözler konuşma şema-2 kanalını kaydeder; şema-1 tarihsel sözler sahte persona bağlamı uydurulmadan korunur. Davranış, konuşma, eylem seçici ve karar izi hedefli regresyonları temiz; dünya/refah nötr, save-load birebirdir. Tam 68-görev paketi, bayat birleşik konuşma probu borcu nedeniyle kapanış kanıtı değildir. |
| Faz 38.8 — İlişki Yorumu ve Bağlamsal Hafıza Geri Çağrımı | `partial` | `RelationshipInterpretationV1` mevcut Faz 35–36 defterlerini kopyalamaz. Sahipli söz, kaynaklı aleni aşağılama veya ortak kriz başarısı mevcut beş ilişki ekseninde sınırlı delta ve eylem ipucu önerir; başka aktör hafızası, ilgisiz hedef ve sahte etiket reddedilir. En önemli iki yorum seçiciye toplam mutlak `3` puan tavanıyla ve Faz 38.6 iziyle bağlandı. Yakın hafıza `24` tavanında hedef, olay etiketi ve kaynak kümesini koruyarak yoğunlaşır; MILESTONE silmez ve save-load birebirdir. Gerçek `COUP_DEFEATED` siyasi kriz sonucu artık en az iki kanonik sadık katılımcı ve gerçek `CRISIS_RESOLVED` olay kimliğiyle `SHARED_CRISIS_SUCCESS` üretir; darbeci zaferi bu etiketi alamaz. `NaN→null` eksen hatası ve hedefli worker sahte-yeşil açığı kapalıdır. Gerçek fail–hedef–kamusal görünürlük makbuzlu aleni aşağılama üreticisi bulunmadığından faz `partial`dır. |
| Faz 38.9 — Rol Adaptörleri ve Kurumsal Müzakere | `partial` | `js/StoryCharacterRoleAdapters.js`; rol veya görünen unvan mekanik yetki sayılmaz. Mevcut kadroda 48 şirket yöneticisi kanonik şirket defterine, 16 hükümet/askerî makam sahibi gerçek `officeHolder` kaydına bağlandı; gerçek makamı bulunmayan 96 unvanlı karakter `UNAVAILABLE` kaldı. Makamın teklif/onay/icra yolları yalnız kanonik `authorityGrants` kayıtlarından türetilir. Gerçek yürütme karakterinin seferberlik teklifi `PENDING_APPROVAL`, gerçek silahlı kuvvetler komutanının onayı `AUTHORIZED`, yürütmenin icrası `EXECUTED` üretti; ikinci kurum defteri açılmadı ve Faz 29 `RECORD_ONLY` fiziksel sınırı korundu. Makam incelemesi kaynaklı karakter eksenlerinden deterministik `APPROVE / OBJECT / REJECT` üretir. İtiraz aynı kanonik isteğe gerçek aktör/kurum, kapalı gerekçe ve zamanla yazılır; tekrar idempotenttir, sonraki onay geçmişi silmeden `SUPERSEDED_BY_APPROVAL` yapar. Yalnız zorunlu gerçek makamın reddi isteği `DENIED` yapar. LLM/rastgelelik karar vermez; fiziksel etki yok ve save-load birebirdir. Şirket defteri şema-2 oldu: gerçek genel müdür kendi şirketi için kredi/yatırım teklifi kaydedebilir. Genel müdür kanonik CEO'dur; CFO, CTO ve kurul başkanı açık `VACANT` kalır. Kredi `CFO + BOARD_CHAIR`, yatırım `CFO + CTO + BOARD_CHAIR` eksiklerini taşır ve ekonomik sonuç üretmez. Şema-1 kayıt ekonomik veriyi değiştirmeden göçer. Yasama/şirket boş makamlarının gerçek karakter yaşam döngüsü Faz 38.10–38.11'e, medya Faz 39'a bağlıdır; şirket teklifinin gerçek onay/icrası bağımlılık tamamlanana kadar açıktır. |
| Faz 38.10 — Türetilmiş Güç ve Kariyer Yaşam Döngüsü | `partial` | `js/StoryCharacterPower.js`; salt-okunur güç görünümü kurumsal/yasal yetkiyi gerçek `authorityGrants`, ekonomik gücü şirket nakdi+tesisi, askerî gücü gerçek ARMED_FORCES makamı, ağ gücünü yönlü Faz 35 ilişkileri ve bilgi gücünü aktörün tuttuğu ActorBelief kayıtlarından türetir. Eski sabit `career.influence` okunmaz; 0/100 değiştirmek sonucu değiştirmez ve saklanan yeni güç bonusu yoktur. Makamsız unvan kurumsal güç alamaz. Medya, halk tabanı ve uzmanlık yürütücüleri yokluğu `UNAVAILABLE/null` görünür; sıfır diye gizlenmez ve uygulanamayan kanallar toplamı yapay olarak düşürmez. Kariyer görünümü yeni yetki defteri açmadan güncel makamları ve Faz 37 `officeTransitions` kayıtlarını okur. Gerçek istifa sonrası aktör `ACTIVE_OFFICE → FORMER_OFFICE_HOLDER` olur, kurumsal yetki/gücü düşer; kimlik, kişilik, hedef, ilişki, hafıza ve ActorBelief silinmez. Kimlik defteri şema-4 ile yaşam sözleşmesi taşır: kaynak bulunmadığı için mevcut karakterlerin doğum tarihi/yaşı `null`, sağlık ve emeklilik uygunluğu `UNKNOWN`dur. `RETIRED/DEAD` geçişi kaynak olay kimliği ister ve tutulan tek gerçek makamı önce Faz 37 haleflik zinciriyle devreder. Emekli aktör aktif kurum/şirket/servis yetkisini kaybeder fakat kişisel ilişki eylemlerini korur; ölü aktör eylem kullanamaz ve şirket makamından düşer. Yaşam olayı kalıcı hafıza izi bırakır. Harici olay kimliği henüz kanonik olay defterinde doğrulanamadığından `EXTERNAL_EVENT_REFERENCE_UNVERIFIED`; otomatik yaş/sağlık/ölüm üreticisi ve birden çok makam için atomik haleflik açık borçtur. |
| Faz 38.11 — Karakter Katmanları ve Kohorttan Yükselme | `partial` | `js/StoryCharacterActivation.js`; salt-okunur aday katmanı gerçek Faz 23 nüfus kohortunu Faz 26 bölgesel toplumsal eylem katılımıyla kesiştirir ve `AGGREGATE/MINOR/RELEVANT/MAJOR/WORLD` düzeyi üretir. `story-character-activation-ledger-1` yalnız `RELEVANT/MAJOR/WORLD` adayı deterministik isimli temsilciye yükseltir; düşük aday zorlanamaz, aynı aday idempotenttir. Kişi yeni nüfus değildir: `REPRESENTATIVE_INCLUDED_IN_COHORT / populationDelta:0`. Kaynak hareket sönünce aktör silinmeden `DORMANT_SOURCE/MINOR` olur; hafıza ve ilişki korunur. Save/load iki tarafı ve dormancy durumunu korur; yeni kampanya promosyonları temizler, yetim defter reddedilir. Üçüncü dilim simulation LOD bütçesini scheduler'a bağladı: davranıştan sonra/eylemden önce `15 sn`, tik başına `1`, dünya `64`, ülke `8`, pahalı `MAJOR/WORLD` `16` tavanı. Dokuz aynı-ülke güçlü adayında sekiz yükseldi, dokuzuncu kota nedeniyle kaldı; LLM çağrısı `0`, nüfus değişimi `0`. Dış analizdeki “Character Mind Architecture” plana kabul edildi: skor yalnız eleme/bütçe içindir; gerçek karar ActorBelief→hedef→ilişki yorumu→korku/kırmızı çizgi→bedel→yetki→uygulama izi taşır. 8B yalnız ayrı hakemden geçen seyrek WORLD akıl yürütmesinde kullanılabilir. Aktivist dışı olay adaptörleri ve doğal uzun koşu dağılımı eksiktir. |
| Faz 38.11–38.12 — Modern Karakter Davranışı Yükseltmesinin Kalanı | `partial` | Karakter tier yükselmesinin ilk üç dilimi çalışıyor. Gizlilik korumalı sohbet QA hattı gerçek EXE görünür turlarını `qa-runtime/story-dialogue-log.jsonl` içine yazar. S0 corpus `49` vaka/`9` aile; S1 kaynak-politikalı `DialogueMoveV1`; S2 kalıcı söylem durumu; S3 beş alanlı `DomainEvidenceBundleV1`; S4 gerçek-tokenizer kapılı `ContextPackV1` olarak kabul edildi. S5 oyun-paritesi koşucusu Electron çalışma zamanı, atomik ara kayıt/resume ve watchdog ile `80 görüşme/540 tur`, `0 hata`, `0 taşma` tamamladı. `272` model-uygun çıktının `220`si kabul, `52`si fallback oldu. Ham denetim 80 oturumun yalnız 9 benzersiz metin dizisi olduğunu, 34 kabul edilmiş birebir tekrar ve 27 aynı-soru/aynı-cevap bulunduğunu gösterdi. Oyuncu yankısı, kaçamak doğrudan soru, başarısız “neden?” devamı ve totoloji artık fallback'tir. Ana davranış QA görünümü gerçek AI makbuzlarından eylem/rol/aktör/çift yoğunluğunu ve örnek yeterliliğini hesaplıyor; rastgele çeşitlilik kotası kullanmıyor. Dört tohum × 300 sn toplu kapı `33` eylemde `28 ALLY / 4 PERSUADE / 1 NEGOTIATE`, `%84,85` baskınlık ve `REVIEW` verdi; komutan rolü `%69,70`, yinelenen çift `0`. Sorun aynı çift döngüsü değil, barış dünyasında alan seçenekleri dar iken ilk kişisel ittifakların tek yaygın yüksek-değerli yol olmasıdır. Kör tekrar cezası reddedildi; Faz 38.9/38.13 gerçek alan seçeneklerinden sonra yeniden ölçülecek. S6 benzersiz adversarial corpus, aktivist dışı kanonik olay adaptörleri ve tam Faz 38.12 kabulü eksiktir. |
| Faz 38.13 — Oynanabilir Karakter Etkileşimi ve Resmî Toplantılar | `partial` | İlk on altı dikey çalışıyor. `ConversationCaseV1` altı kip; `TaskOfferV3` ödülsüz kişisel istek ile yetkili/bedelli devlet görevini ayrı union dallarında korur. Kurumsal dal yalnız gerçek Silahlı Kuvvetler makam sahibi aynı zamanda gerçek komutan payer olduğunda Faz 29 `COMMISSION_PAID_CONTACT_TASK` isteğini yürütür. Kabul 25 devlet kredisini ayrı bütçe escrow'una ayırır; hedef görüşme tek settlement ve `InstitutionalTaskReceiptV1` üretir; ret parasız, süre aşımı tek iadeli, restore yan etkisizdir. Şema-2 ilişki defteri `RelationshipResultReceiptV1` sahibidir; konuşma şema-7 görev ve `MeetingOutcomeReceiptV2` sonuçlarına yalnız fiş referanslarını bağlar. Kabul edilmiş görev başarısı/ihlali yalnız veren karakter→oyuncu yönünü değiştirir; decline ve kabul edilmemiş expiry nötrdür. Toplantıda yalnız `ADOPTED + player YES + observer YES` ortak başarı uygular, diğer katılımcılar kaynaklı `NO_CHANGE` taşır. Aynı kaynak idempotent, aynı çift+aile 300 saniye soğumalıdır; görev terminali bütçe/görev/ilişkiyi, başkan kapanışı bütün katılımcı fişlerini atomik tutar. UI yalnız insan-okunur oyuncu taraflı sonucu gösterir. Hedefli test ters yön, tahrif, duplicate, cooldown, rollback, restore ve DOM bilgi sızıntısı kapılarını geçti. Devlet kurumu görevi ve yönlü ilişki fişi dilimi kapanmıştır; şirket bütçeli görevler ayrı kapsamdır. Faz 38.13 kalan birleşik kabul borçları nedeniyle `partial`, Faz 39 pasiftir. |
| Sohbet S7 — Bağımsız Adversarial Oyuncu LLM | `partial` | Kapalı-devre “yalnız karakterin bildiğini soran oyuncu” testi reddedildi. `tools/story-dialogue-domain-maturity.json`, LIVE/PARTIAL/PLANNED alanları ayrı puanlar. 60 vakalık makine-okunur manifest yalnız 9 kamusal-bilinen tur; 51 bilinmeyen, yanlış, karışık, gelecek-faz veya gürültülü tur zorunlu kılar. Oyuncu yalnız kamusal görünüm+transkript+saldırı briefi görür; karakter özel inancı, beklenen cevap ve NLU etiketi yasaktır. Manifest hazır cümle içermez. Gerçek GPU oyuncu→karakter dönüşümlü koşucusu ve yenilik/hakem raporu henüz eksiktir. |
| Faz 42.1–42.14 — Teknoloji, Yenilik ve Toplumsal Benimseme Yükseltmesi | `planned` | Dış `1.300` düğümlük katalog nihai motor değil içerik taslağı olarak kabul edildi. Ana plan; gerçek teknoloji DAG'ı, kanıt, aktör/tesis kabiliyet erişimi, farklı transfer sonuçları, uygulama makbuzu, kanonik hukuk, kurulu taban, ActorBelief/Hype, 2032 tarihsel seed ve 2100 çeşitlilik kapılarına ayrıldı. İlk zorunlu dikey yarı iletken–AI–endüstriyel otomasyondur; Faz 38.5 ve medya Faz 39–42 tamamlanmadan aktif sıra değildir. |
| Faz 39+ | `missing` | Zorunlu sohbetten-sonuca ara kabulün kalan zinciri ve sonraki fazlar henüz tamamlanmadı. |

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
- Oyuncu karakteri seçtiği kanonik rolle karakter modeline taşınır; askerî kuvvet uyumluluğu ayrı kampanya kontrol jetonuyla korunur.
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

## Faz 32 — Patronaj, Yolsuzluk ve Soruşturma kabul sonucu

- `story-integrity-investigation-ledger-1`, `ALLEGATION → PRELIMINARY_REVIEW → FORMAL_INVESTIGATION → SUBSTANTIATED/UNSUBSTANTIATED/CLOSED` durumlarını; `160` dosya, `640` kanıt ve `640` olay bütçesini taşır. Ülke→dosya→kanıt bağları ve tek-kullanımlık yargı yetki fişi iki yönlü doğrulanır.
- Yapısal `corruptionRiskBps` suç değildir ve tek başına dosya açmaz. Rekabetçi, piyasa fiyatındaki gerçek ihale `NO_INTEGRITY_RED_FLAGS` ile sıfır dosya bıraktı. Tek teklif + `%50` fiyat sapmalı ihale `4271 bp` ön kanıtla `PRELIMINARY_REVIEW` oldu; yetkili soruşturma sonunda `UNSUBSTANTIATED` kaldı.
- Yalnız gerçek `AUTHORIZE_BUDGET` kurum kararı, `institutional.procurement` bütçe fişi ve kanonik şirket ihale incelemesine girebilir. Yetki ve ödeme fişleri `NEUTRAL` kanıttır; var olmaları suç lehine puan yazmaz. Rekabet, fiyat ve kaynaklı lobi kayıtları ayrı kırmızı bayraktır.
- `political.bribe` sınıflı gerçek çift taraflı bütçe fişi kanonik karakter öznesiyle tek dosya/kanıt üretir; tekrar taraması deduplike edilir. Hedefli probda skor `6321 bp`, sonuç `SUBSTANTIATED` oldu. Sahte yargı fişi reddedildi ve aynı gerçek yargı fişinin ikinci dosyada kullanılması engellendi.
- WorldV2 `integrityCases/integrityEvidence` koleksiyonlarını ve ülke özetini taşır. Kendi ülke görünümü kaynak/kanıt ayrıntısını; yabancı görünüm yalnız kamusal resmî soruşturma ve sonucu gösterir. Şehir `KURUMLAR` sekmesi “saptırma riski”, “iddia”, “resmî soruşturma”, “kanıtlandı” ve “kanıtlanamadı” ifadelerini ayırır; gizli özne, şirket, kırmızı bayrak ve kaynak kimliği yabancı HTML/view-model'e sızmaz.
- Kayıt/yükleme birebir, V3→V2 göç, eski kayıt backfill'i, bozuk yön/referans kurtarması, özellik ve şirket öncülü kapalı `null` yolu geçti. Dünya/knowledge/UI projeksiyonu bütünlük defterini değiştirmedi.
- `qa-runtime/story-phase32-ab.json`: `government.patronageIntegrity` açık/kapalı iki `900 sn` koşunun fiziksel karması aynı `dd4ea4786ddfdc10b26ed949213a2c2bddadc5782f1b2aa5b7d104ab0081f42c`; `changedWorldState:false`, ilk fark yok, refah/enflasyon/huzursuzluk/devlet/haber ve üç kaynak deltası `0`.
- Scheduler `24` görev taşır; bütünlük her `5 sn` seçimden sonra ve kuşatmadan önce çalışır. Kapsamı azaltılmamış `npm test` `52/52` görevle çıkış kodu `0` verdi; otomatik bellek tavanı `1` işçi seçti, toplam süre `1.664,7 sn`, ana 900 saniyelik koşu `118.958,65 ms` oldu. Sıradaki uygulama **Faz 33 — Darbe, Bölünme ve İç Çatışma**dır.

## Faz 33 — Darbe, Bölünme ve İç Çatışma kabul sonucu

- `story-political-crisis-ledger-1`, darbeyi rastgele tek olaydan çıkarıp `ORGANIZING → COALITION → ULTIMATUM → ATTEMPT → FAILED/SUCCESS/SPLIT/DISSOLVED` zincirine dönüştürdü. Kriz ancak en az iki gerçek sadakatsiz komutan ve ölçülen yapısal risk varsa açılır; isimli komplo lideri, koalisyonu, karşı gücü, istihbarat düzeyi, bölgesel kontrolü, olayları, eylemleri ve kaynak fişleri aynı sürümlü defterde tutulur.
- Darbe sonucu RNG veya LLM ile seçilmez. Komutan sadakati/yetenekleri, fraksiyon ve huzursuzluk, refah, devlet kapasitesi, güç merkezleri, seçim mandatı ve bütünlük dosyaları açıklanabilir faktörlere çevrilir. Hedefli probda zorlanan aynı durum deterministik olarak `SUCCESS / GOVERNMENT_SEIZED` verdi; doğal 900 saniyelik dünyada üç teşebbüsün üçü de başarısız oldu. Yabancı toprağı veya gizli komplo bilgisi uydurulmadı.
- Oyuncu ilk kez siyasi veriyi yalnız izlemiyor: isimli komplo lideriyle görüşme (`25` komuta puanı), isimli sadık komutanla komuta zincirini güvenceye alma (`45` puan), kamuya açıklama (`2` itibar) veya bekleyip izleme seçenekleri gerçek bedel ve karşı sonuç üretir. Eylemler Talk ekranında karakter adıyla açılır ve kanonik deftere yazılır. AI de aynı API ve kaynakları kullanır; bedava avantajı yoktur ve kriz başına en fazla bir karşı hamle yapabilir.
- WorldV2, PlayerKnowledge ve UI kendi ülkenin tam kriz kaydıyla yabancı ülkenin yalnız kamusal kriz görünümünü ayırır. Gündem isimli krizi sohbet çalışma alanına taşır. Kayıt/yükleme birebir, V3→V2 göç, eski kayıt backfill'i, bozuk defter güvenli sıfırlaması, özellik/öncül kapalı yokluk ve salt-okunur projeksiyon kapıları geçti.
- `qa-runtime/story-phase33-ab.json`: kapalı karma `d6ec566b…31bc`, açık karma `34ef8ff9…d838`; 900 saniyede `7` kriz, `3` teşebbüs, `3` başarısızlık, `4` dağılma, `5` eylem ve `43` olay üretildi. Refah deltası `-0,75`; enflasyon, huzursuzluk, etkin devlet ve haber deltaları `0`. Son erişim gıda `%80,23`, enerji `%80,34`, yaşam koşulu `%72,24`; sekiz devlet hayatta ve başlangıç toprak dağılımı korunuyor.
- Scheduler `25` görev taşır; siyasi kriz her `5 sn` bütünlükten sonra ve kuşatmadan önce çalışır. Kapsamı azaltılmamış `npm test -- --workers=6` `54/54` görevle, `487,4 sn` toplam sürede ve çıkış kodu `0` ile geçti; ana 900 saniyelik koşu `190.852,31 ms` sürdü. Sıradaki uygulama **Faz 33.1 — Yönetim Çalışma Alanı İlk Oynanabilir Sürüm**dür.
- Yeni kalıcı kabul kuralı: yalnız veri/tablo/bildirim üreten katman oynanabilir sayılmaz. Oyuncuya en az bir yetkili, bedelli ve dünya defterine yazılan eylem verilmelidir; karakter bulunan alanda bu eylem isimli karakter ve ilişki üzerinden kurulmalıdır. Faz 37'nin dört gerçek hedefli eylemi serbest sohbetten ayrıdır; henüz uygulanmayan serbest hedefli sohbet açıkça Faz 38 borcu der ve genel konuşmayı seçili karakterin cevabı gibi sunmaz.

## Faz 33.1 — Yönetim Çalışma Alanı İlk Oynanabilir Sürüm kabul sonucu

- Konsey çekmecesine `YÖNETİM` sekmesi eklendi. Görünüm oyuncunun kanonik karakter kimliğini Faz 29 makam sahipleriyle eşleştiriyor; cumhurbaşkanı, genelkurmay başkanı ve kurumsal makamı olmayan komutan aynı rolü veya aynı eylemi görmüyor. Oyuncu hiçbir kolektif makamı ya da AI makam sahibini taklit edemiyor.
- İlk iki gerçek karar `Kamu yatırım programı` ve `Yerel ihtiyatı seferber et`tir. Kamu yatırımı yalnız yürütme makamına, seferberlik yalnız silahlı kuvvetler makamına açıktır. Kilitli kart gereken makamı ve mevcut dürüst alternatif yolu açıklar; uygulanmamış hedefli sohbet varmış gibi gösterilmez.
- Kamu yatırımı başvuruda devlet bütçesinden `120` puanı gerçekten ayırır. Seferberlik oyuncunun komuta havuzundan `70` insan gücü ayırır. Karar, Faz 29’un gerçek başvuru/onay/yürütme API’sinden ve ilgili makam sahiplerinden geçer; sonra Faz 30’un `QUEUED → IMPLEMENTING → COMPLETED/DEGRADED/PAPER_ONLY` fişini bekler.
- `COMPLETED/DEGRADED` kamu yatırımı hedef şehrin kanonik `level` alanını bir artırır; seferberlik garnizon tavanına uyarak kanonik `garrison` alanını bir artırır. Yetki zinciri bayatlarsa ayrılan kaynak iade edilir; karar kâğıtta kalırsa harcama yapılmış fakat fiziksel sonuç alınamamış olarak açıkça kaydedilir. Uygulama idempotent nedensellik anahtarı taşır ve kayıt/yüklemede tekrar uygulanmaz.
- Gündemdeki kapasite, seçim ve bütünlük maddeleri artık genel konsey ekranına değil doğrudan yönetim çalışma alanına gider. Aynı ekranda rol, uygulama kapasitesi, hedef şehir, eylem maliyeti, onay ilerlemesi, makam sahipleri ve güç merkezleri bulunur. Kalıcı karakter sözleri Faz 38’den önce uydurulmaz.
- Hedefli probda genelkurmay oyuncusu seferberlik yetkisini gördü fakat kamu yatırımını kullanamadı; yürütme makamına geçen aynı oyuncu yatırımı başlattı. `120` puan gerçekten eksildi, kapasite fişi `COMPLETED` oldu ve hedef şehir seviye `2 → 3` yükseldi. Kurum ve kapasite doğrulayıcıları, özellik-kapalı yol ve kayıt/yükleme geçti.
- Kapsamı azaltılmamış `npm test -- --workers=6`, arşive taşınmış renderer için bayat kök-yol assertion’ı gerçek `_arsiv/kok-olu-kopyalar` yoluna düzeltildikten sonra `55/55` görevle, `681,1 sn` toplam sürede ve çıkış kodu `0` ile geçti. Ana 900 saniyelik koşu `262.191,86 ms`; dünya karması önceki Faz 33 ile aynı `34ef8ff959c39d0564a088679d3cc40f02f8c28261ade5f0498e11c89029d838` kaldı. Oyuncu karar vermediğinde Faz 33.1 otomatik dünya mutasyonu üretmiyor. Görsel tarayıcı bağlantısı bu oturumda mevcut değildi; 1366×768 ve paketlenmiş EXE piksel kabulü ayrıca oyuncu kontrolüne açıktır. Sıradaki uygulama **Faz 34 — Karakter Kimliği ve Hedefleri**dir.

## Faz 34 — Karakter Kimliği ve Hedefleri kabul sonucu

- `story-character-identity-ledger-2`, başkan, komutan ve seçim adaylarını aynı kimlik sözleşmesinde tutuyor: dört kararlı çekirdek boyut; değer, korku, hırs, kırmızı çizgi, rol/kişisel hedef ve ses profili. `muhalif/yandaş` sabit özellik yapılmadı; `currentRegimeAlignment` rol, sadakat ve kurumsal mesafeden türetiliyor.
- Profil eylem yasaklamıyor. Aynı iki aday bütün karakterlerde sıralamada kaldı; farklı kimlikler ölçülebilir biçimde farklı ilk adayı ve konuşma stratejisini seçti. Faz 31’in soyut liste vekilleri seçim başına isimli karaktere, kazanan liste de gerçek makam sahibine göç etti.
- Altı rolün 12 soru dağılımı sürümlü politikadır. Zar ekranında askerî komutan, şirket yöneticisi, siyasi lider ve ajan seçilebilir. Asker mevcut geniş dallanan bankayı; diğer üç yol toplam `36` özgün mesleki ikilemi kullanır. Belediye başkanı ve sivil politika kodları içerikleri bitmeden oyuncuya sahte seçim olarak sunulmaz.
- Her cevap iç sistemde gerçek kazanç ve bedel taşır; oyuncu bunları seçimden önce görmez. Kampanya kurulunca karar gerçek kaynak değişimi, `character.origin_decision_recorded`, `WorldFact`, kaynaklı `ActorBelief`, tepki kancası ve `0 sn` ilk görünür sonuç üretir. Komutan profilinde kalıcı `GEÇMİŞ İZİ · 12 KARAR` hücresi vardır.
- PlayerKnowledge ham `WorldFact` listesini açmaz; yalnız oyuncunun ülkesindeki bir karakterin ActorBelief’i varsa bilgi zarfı üretir. Hedefli prob `12` karar, `12` olay, `12` WorldFact, `31` ActorBelief, oyuncuda `12` görünür köken olgusu ve yabancı projeksiyonda `0` sızıntı verdi.
- Kayıt/yükleme defteri birebir korudu. İlk tam koşu, V3→V2 göç adaptörünün yeni iki koleksiyonu boş bırakmasını yakaladı; adaptör `legacy-save-v3-to-v2-6` ile kimlikleri/olguları/inançları koruyacak şekilde düzeltildi. Hedefli göç `12/31` kayıpsız geçti.
- Nihai `npm test -- --workers=6`, `56/56` görevle `819,6 sn`de ve çıkış kodu `0` ile geçti. Ana 900 saniyelik dünya karması `145d5775521b8ac8db834ccc76c6e417168eb0c61959cd6a8b744e3aa28b3b72`; karakter yaratım kararı olmayan referans dünya tarafsız kaldı. Tarayıcı yüzeyi bağlı olmadığı için gerçek piksel yerleşimi manuel EXE kontrolüne açıktır. Sıradaki uygulama **Faz 35 — Çok Boyutlu İlişkiler**dir.

## Faz 35 — Çok Boyutlu İlişkiler kapanış sonucu

- Karakter kimlik defteri `story-character-identity-ledger-3` oldu. Sekiz ülkede `80 COMMANDER`, `8 EXECUTIVE`, `24 POLITICAL_FIGURE`, `48 COMPANY_EXECUTIVE` ve `16 AGENT`; toplam `176` isimli karakter vardır. Şirket yöneticileri gerçek 48 şirket kimliğine bağlıdır.
- `story-character-relationship-ledger-1` tam `176×176` tablo kurmaz. Yürütme erişimi ve meslek ağlarından `627` yönlü kenar kurar; her kenar güven, korku, saygı, borç ve husumeti `0–10000` baz puanda ayrı tutar. Hedefli prob A→B ile B→A'nın farklı olduğunu kanıtladı.
- Oyuncunun 12 gizli-bedelli köken kararı aynı ülkenin aktörlerinin oyuncuya bakışını etkiler; hedefli komutan örneğinde `21` kenar başlangıç geçmişi aldı. Ters yön otomatik aynalanmaz.
- Başlangıçtaki geniş karakter ağacı dört oynanabilir kökten açılır: askerî komutan, şirket sahibi, siyasi lider ve ajan. Rol, soru metinlerini ve `6/3/3`, `2/6/4`, `3/4/5`, `2/3/7` kanıt dağılımını değiştirmenin yanında gerçek kariyer kaydını da değiştirir. Komutan dışı cevaplar komuta cüzdanına dokunmaz; nüfuz, güvenilirlik, özerklik ve mesleki kapasiteyi `0–100` aralığında sürer.
- Şirket sahibi gerçek `company:0:civil_industry` siciline, ajan servis yuvasına, siyasi lider yürütme kurumuna ve komutan silahlı kuvvetler kurumuna bağlanır. Şirket sahibi hedefli probunda oyuncu ne yürütme ne de silahlı kuvvetler makamını kendiliğinden aldı; bu makamlar isimli dünya aktörlerinde kaldı. Kariyer/bağ alanları `story-v1-to-v2-adapter-9`, PlayerKnowledge v2 ve `legacy-save-v3-to-v2-8` ile korunur.
- WorldV2 `characterRelationships` koleksiyonunu taşır; PlayerKnowledge yalnız oyuncunun ülkesinin taraf olduğu bağları açar. Yabancı projeksiyonda oyuncunun özel ilişkisi `0` sızıntı verdi. V3→V2 ve birebir save/load geçti.
- Şehir/ekonomi panel cache'i `64` anahtarlı gerçek LRU'ya çıktı; tek pahalı view-model o andaki bütün sekme imzalarına bağlanıyor ve değişmeyen HTML kontrolü DOM'u yeniden serileştirmeyen WeakMap aynası kullanıyor. Tek şehir sekme turu `33 istek / 1 şehir dosyası / 32 görünüm isabeti`; dört şehir turu `37 istek / 4 şehir dosyası / 1 WorldV2+PlayerKnowledge kurulumu / 3 dünya-bilgi isabeti / 33 görünüm isabeti / 0 tahliye` verdi. Bilgi filtresi ve UI tarafsızlığı geçti.
- Kullanıcının bildirdiği ağır `Nüfus` ve `Kurumlar` sekmeleri ayrıca sıkılaştırıldı. Nüfus sekmesi aynı kohortu ikinci kez defterden klonlamaz; tooltip hazırlığı layout ölçmez; ekran dışı uzun bölümler paint/layout dışında kalabilir. Sekme DOM'ları fragment olarak saklanır. Hedefli tekrar açılışında view/world/HTML/`innerHTML` sayıları artmadı, iki hazır DOM ağacı geri takıldı ve içerik birebir kaldı.
- Açık rol borcu: başlangıç rolü doğru kimlik, kurum ve kariyeri seçiyor fakat ana navigasyon ve bütün eylem yüzeyleri henüz `RoleAuthorityProjection` ile ayrışmıyor. Bu yüzden komutan şirket ayrıntısına gereğinden fazla erişebilir veya şirket sahibi eski ordu kontrollerini görebilir. Faz 35 içinde sahte geçici menü yapılmayacak; karakter eylem adayları Faz 37'de, tam rol merceği Faz 59–60.3'te kapanacak.
- Açık bina borcu: mevcut şehir eylemleri fabrika/kışla ağırlıklıdır. Sırf çeşit görünmesi için yeni bonus düğmeleri eklenmeyecek. EXT-ACT-012'nin kanonik `ProjectV1 → WorldAssetV1 → bakım` zinciri ve karar biçimi gerçekten farklı ilk `8–12` varlık şablonu bu borcun sahibidir.
- İlk tam koşu 56 görevi tamamladıktan sonra önemli bir kurum regresyonu yakaladı: başlangıçta komutan seçilen oyuncu, kampanya durumu yürütme makamını oyuncuya verdiğinde yine `GENELKURMAY BAŞKANI` kalıyordu. Başlangıç rolünün yalnız ilk makam atamasını belirlemesi; sonraki kurum sahipliğinin gerçek `state.gov.leader` durumunu izlemesi sağlandı. Karşı-test şirket sahibinin yürütme/ordu makamını kendiliğinden almadığını ve komutanın sonradan `CUMHURBAŞKANI` olabildiğini birlikte doğruladı.
- Nihai `npm test -- --workers=6`, eşzamanlı savaş AI yüküne rağmen `56/56` görevle `2.185,4 sn`de ve çıkış kodu `0` ile geçti. Ana 900 saniyelik karma `145d5775521b8ac8db834ccc76c6e417168eb0c61959cd6a8b744e3aa28b3b72`; refah `64,625`, enflasyon `2,255`, huzursuzluk `3,09`, sekiz aktif devlet ve `16` haberle korundu. Faz 35 tamamlandı; sıradaki uygulama **Faz 36 — Üç Katmanlı Hafıza**dır.

## Faz 36 — Üç Katmanlı Hafıza

- `story-character-memory-ledger-1` üç ayrı yaşam süresi kurdu. `RECENT` aktör başına `24` kayıtla sınırlı; budanan düşük önem kayıtları sessiz silinmek yerine en çok `12` deterministik `SUMMARY` kaydına yoğunlaşır. `EPISODE` çözülmemiş konuşma konusunu, `MILESTONE` ise ORIGIN/PROMISE/SECRET/BETRAYAL/DEBT gibi silinmemesi gereken bağları tutar.
- Hafıza gerçek üretmez. `inventedFacts:false` ve `llmWrites:false` teşhisi sözleşmedir. On iki karakter köken kararı tam `12` ORIGIN mihenk taşı ve `31` ActorBelief kaynaklı yakın kayıt oluşturdu; önce görülen çift yazım `62→31` indirilerek aynı geçmişin karar ağırlığını ikiye katlaması engellendi.
- Gerçek `Talks.js` kuyruğu hafıza bölüm kimliği taşır. `law-complaint` açılışı OPEN EPISODE, oyuncunun cevabı RESOLVED sonuç ve “gelecek konseyde değiştireceğim” seçeneği kalıcı PROMISE üretti. Süresi dolan konuşma da sonsuza kadar açık kalmaz; kaynaklı “yanıt verilmeden süresi doldu” sonucu alır.
- PlayerKnowledge v3 yalnız kendi ülkesindeki gerçek hafıza sahiplerinin bildiğini açar. Ülke 0 sırrı ülke 1'e, ülke 1 sırrı ülke 0'a sızmadı; her sahibi kendi projeksiyonunda sırrı korudu. WorldV2, boş dünya, V3→V2, kaynak V3 değişmezliği ve birebir kayıt/yükleme geçti.
- Scheduler devam probu görev sırasını ve registry/legacy eşitliğini korudu. 73. saniye kaydından sonra kesintisiz ve yüklenmiş dünya aynı `a57155c8bb7db30ec33629c49a4865623c5fb371b856c5b653d23061a3fb1b5c` karmasını verdi; checkpoint ve gelecek fark listeleri boştu.
- Siyasi kriz artık açılışta kanonik aktörlerle OPEN EPISODE, her bedelli karşı hamlede sonuç kodlu RESOLVED EPISODE ve yalnız fiilî ATTEMPT sonrasında BETRAYAL üretir. Darbe sonucu RNG/LLM'den değil aynı Faz 33 defterinden gelir.
- `political.bribe` bütçe transferi gerçek işlem kimliğini döndürür. Ödeme alıcısının oyuncuya yönlü `debtBps` artışı aynı ilişki için tek güncellenebilir DEBT kaydına bağlanır; kişilik profilindeki başlangıç borç eğilimi gerçek borç diye yazılmaz.
- SECRET yalnız `public:false`, `SUPPORTS`, özgünlük ve ilgi `>=8000` olan kanonik bütünlük kanıtından doğar. Konu aktörü ve kanıt kimliği kaynakta kalır; bilen aktör aynı ülkenin gerçek iç-istihbarat yöneticisidir. Yabancı PlayerKnowledge bunu görmez.
- Aynı konuşma şablonu ve aynı aktör çifti için tekrarlanan açık söz, sınırsız PROMISE çoğaltmak yerine aynı mihenk taşını sürümleyerek günceller. Yakın hafıza tekrarın izini yine tutar.
- Hafıza bütçesi `24` yakın/aktör, `12` özet/aktör, `64` açık bölüm, `48` çözülmüş bölüm, `2048` kalıcı mihenk taşı ve `4.000.000` serileştirilmiş karakterdir. 900 saniyelik koşuda `111` yakın kayıt, `12` özet, `3` açık/`30` çözülmüş bölüm, `3` BETRAYAL ve toplam `84.578` karakter ölçüldü; doğrulama temiz, dünya karması `145d5775…b3b72` kaldı.
- Tam paket ilk olarak kimlik özelliği kapalı güç-merkezi A/B yolunda Talks.js aktör çözümleyicisinin `null.identities` erişimini yakaladı. Çözüm hafıza/kimlik yokken eski konuşmayı sürdürür; hedefli karşı-test `memory:null / talkCount:1` verdi. Sonraki 57-görev üretimi tamamlandı; eksik assertion importu manifest ile eşlendi.
- Son 57'li sonuç setinde yalnız raster cache duvar süresi eşzamanlı savaş AI yükünde `3.365,171 ms` ile sabit `2.000 ms` kapısını aştı. Eşik gevşetilmedi. Aynı `mapRasterProbe` tek işçide `631,22 ms`, terrain/overlay `1350/300`, kıyı farkı `%0,216102`, eşit A/B karması ve geçerli sözleşme verdi. Bu tek sonuç korunmuş 57'li sete alındığında bütün `tests/story-world.test.js` assertion'ları çıkış kodu `0` ile geçti. Ana karma `145d5775521b8ac8db834ccc76c6e417168eb0c61959cd6a8b744e3aa28b3b72` kaldı.
- Yeni içerik sonrası bütçe, bütünlük, siyasi kriz, hafıza, göç ve scheduler hedefli regresyonları geçti. Scheduler kesintisiz/kayıttan devam karması iki tarafta `d2e287bf2f764ab53f2fb478a52e988c094379245cebfe4aa61e852616c3c79a`; fark ve checkpoint fark listeleri boştu.
- Oracle tamamlandıktan sonra tam paket tekrarlandı. Altı işçi `57/57` sonucu `2.594,3 sn`de üretti. Paralel raster cache süresi `3.896,741 ms` ile sabit `2.000 ms` eşiğini aştı; eşik gevşetilmedi. Aynı prob tek işçide `573,204 ms`, geçerli sözleşme ve eşit A/B karması verdi. Yalnız bu doğrulanmış süre örneği korunmuş 57'li sete kondu ve tüm assertion dosyası çıkış `0` ile geçti. Faz 36 tamamlandı; Faz 37 açıldı.

## Faz 37 — Karakter Eylem Adayları

- `story-character-action-ledger-6` adayları kalıcılaştırmaz; yalnız uygulanmış/başarısız gerçek işlemlerin sınırlı makbuzlarını, cooldown zamanlarını ve aktif makam geçişlerini saklar. Sosyal karakter hedefi, emir komut+şehir hedefi, sabotaj fiziksel varlık hedefi ve istifa makam hedefi ayrı sözleşmelerdir.
- Yedi eylemin tamamı aynı kapıdan geçer: kanonik aktör, hedef veya hedefsizlik, temas/yetki alanı, kişisel/kurumsal/servis yetkisi, 0–100 kariyer kaynağı bedeli, `availableAt`, cooldown ve gerçek domain yürütücüsü. RNG ve LLM karar veya sayı yazmaz.
- Gerçek yürütücüler `PERSUADE`, `NEGOTIATE`, `ORDER`, `SABOTAGE`, `ALLY`, `RESIGN`, `BETRAY`dir. Dört sosyal eylem ilişki/hafıza sonucunu korur. `ORDER`, askerî muhatap ve sahip olunan şehirle `MOBILIZE_RESERVE` kararı açar; tek ekonomi üzerinden 70 insan gücü rezerve eder ve kurum + uygulama kapasitesi tamamlandığında hedef garnizon `+1` olur.
- Emir makbuzu `QUEUED_DOMAIN_DECISION`, kurum talep kimliği ve hedef şehri taşır; kuyruğa alınmayı fiziksel başarı diye raporlamaz. `SABOTAGE`, gerçek ajan + hedef devlet karakteri + kanonik altyapı koridoruyla 6 ajan kapasitesi harcayan `QUEUED_COVERT_OPERATION` açar. `RESIGN`, elde tutulan makamı ve isimli halefi doğrulayıp `OFFICE_SUCCESSION_RESOLVED` üretir. Halef aynı ülkenin kanonik karakterlerinden makam uyumu ve kariyer kanıtıyla deterministik seçilir; kurum uzlaştırması aktif geçişi kaynak sayar.
- Uygulanan yedi makbuz WorldV2 varlığına dönüştü. PlayerKnowledge sabotaj hedefinde tespit/atıf ayrımını korur; ilgisiz yabancı ülke hiçbir eylem görmez. Canlı adaptör ile v2/v3 göçleri yedi güncel veya dört gerçek sosyal varlığı kayıpsız sürüm-6'ya taşıdı. Aktif makam geçişinin kaynak makbuzu uzun kampanya budamasından korunur.
- On saniyelik `character-actions` scheduler görevi etkin AI aktörlerini sekizli döner pencerede ve en çok dört doğrulanmış temasla tarar. Kişilik/hedef skoru ilişki ihtiyacı, eylem eşiği, aktör/pair cooldown ve 120 saniyelik tekrar fırsat maliyetiyle birleşir. Sistem oyuncunun seçtiği karakteri asla yönetmez ve zayıf bağlamda eylem uydurmak yerine `SCORE_BELOW_THRESHOLD` ile pas geçer.
- Reddedilen iki ayar kayda geçirildi: ilk politika 900 saniyede `85/86 ALLY`; yalnız cooldown eklenen ikinci politika 300 saniyede `23/23 NEGOTIATE` üretti. Güncel bağlamsal politika 300 saniyede `29 tik / 8 eylem / 21 pas`, 900 saniyede `89 tik / 20 eylem / 69 pas` üretti. Uzun dağılım `17 ALLY + 3 PERSUADE`, baskın tür `%85`, oyuncu-kontrolü `0`, defter sorunu `0`, hafıza `164.690/4.000.000` karakterdir.
- Kayıt/yükleme eylem defteri, AI imleci, cooldownları ve aktif makam geçişini birebir korudu. `22,5+17,5 sn` ara kayıt devamı kesintisiz 40 saniyeyle aynı defter/scheduler sonucunu verdi. Operasyon ortası kayıt/devam sabotajın nihai makbuzunu, hafızasını ve `2588 bps` fiziksel hasarını kesintisiz koşuyla birebir üretti. Sürüm-2 politika karması yedi makbuz kaybetmeden sürüm-6'ya yükseltildi; gerçek sürüm-3 sosyal kayıtlar türlenmiş hedef modeline kayıpsız taşındı; eylem-deftersiz eski kayıtta geçmiş uydurulmadan boş `backfilled` defter kuruldu.
- Makbuz tavanından budanan AI sonuçları `prunedAppliedCount/prunedDeniedCount` ile toplam sayaçtan ayrıldı. Böylece 2.048 makbuzdan uzun kampanyada doğrulayıcı, budanmış geçmişi kayıp makbuz sanmaz.
- İlk oyuncu yüzeyi `Şehir → Karakterler → Görüşmeyi Aç` yolundadır. Dört sosyal eyleme, bağlam askerîyse seçili şehir için seferberlik emri eklenir. Gerçek DOM tıklaması ikna makbuzuna ek olarak kurum kuyruğu emri üretmiştir. Serbest hedefli sohbet Faz 38 borcu olarak açıkça ayrılır; genel görüşmeler seçili karakterin cevabı gibi gösterilmez.
- Genel temas çalışma alanı varsayılan olarak yalnız oyuncunun kendi/doğrudan temaslarını gösterir; `175` kişilik kamusal sicil ayrı ve kapalıdır. Yabancı aktörde ad, kamusal unvan/rol ve ülke görünür; `regionId`, kariyer, servis ve gizli kimlik eksenleri projeksiyona girmez. `PlayerKnowledge` sürüm-4, `197` fiziksel kara/deniz varlığının yalnız kamusal uç/topoloji bilgisini taşır; kapasite, hasar, erişim ve etkinlik durumu yasaktır.
- Ajan rolünde bu kamusal topolojiden ülke başına en çok iki yabancı kara koridoru üretilir. Gerçek sohbet DOM'unda sabotaj düğmesi 6 kapasite harcayıp 30 saniyelik `QUEUED_COVERT_OPERATION` açtı. Hedefli prob `21/175` dar temas/sicil, `14` kara operasyonu, sıfır yabancı konum ve sıfır gizli operasyon alanı sızıntısı verdi. Aynı dünya komutan rolünde `0` operasyon üretti. Dizin aynı dünya/bilgi anlık görüntüsü önbelleğini tekrar kullanır.
- Hedefli Faz 37 ve şehir dosyası UI probları geçti. Sabotaj hedefi `0→2588 bps` hasar, `1020→756` etkin kapasite, 6 kapasite bedeli ve geçerli altyapı mutabakatı verdi. Gerçek Yönetim DOM yolu ilk istifa tıklamasında sıfır makbuz, ikinci tıklamada geçerli `PLAYER_UI` makbuzu üretti; Silahlı Kuvvetler makamı `character:0:0` oyuncusundan `character:0:1 / Kaya Komutan`a geçti, eski aktör yetkiyi kaybetti ve yüklemede halef korundu. Defter/WorldV2 doğrulamaları, yedi çözülmüş hafıza, v2→v6 yedi ve v3→v6 dört sosyal makbuz geçti.
- Şema-6 sonrası tam 900 saniyelik dünya koşusu `506.231,24 ms` sürdü; `22` defter/tutarlılık doğrulamasının tamamı geçti, `8/8` devlet etkin kaldı, nihai gıda/enerji/yaşam erişimi `%80,23/%80,34/%72,24` ve karma `70056c2dbc6cedc8eb2980f6a3a65101f1ef75ec8ed0c7a103531f5f6d4d36e5` oldu.
- İlk altı-işçi tam paket `59/59` sonucu üretti fakat ortak kaynak baskısında terrain+overlay cache `4.112,467 ms > 2.000 ms` çıktı; eşik gevşetilmedi. İzole aynı prob `618,339 ms`, geçerli raster, sıfır kara/deniz sızıntısı ve eşit A/B karması verdi. Üç-işçi tekrar, Faz 37 scheduler görevinin manuel beklenen sıra fikstüründe unutulduğunu yakaladı. Fikstür canlı sürümlü sicille eşlendi; hedefli 14 saniye probunda `character-actions=1`, `political-crisis=2` geçti.
- Nihai korunmuş üç-işçi paket `59/59` görevi `1.139,0 sn`de üretti; bütün assertion dosyası ve süreç çıkışı `0` oldu. Fazın eylem, yetki, bedel, hedef ve cooldown kabul ölçütleri tamamlandı ve Faz 37 kapandı. Ana navigasyonun bütün roller için ayrışması Faz 59–60.3 borcudur; Faz 38 açıldı. Harness kaynak listesi ile scheduler beklenen sıra fikstürünün manuel tutulması test–EXE eşitliği için otomasyon borcu olarak kaydedildi.

## Faz 38 — LLM Karakter Hakemi

- Güncel adaptör `story-character-arbiter-3`tür. Faz 37 seçicisi ve domain doğrulayıcısı kanonik aday sahibidir. `54` altı commit kanıtı taşıyan seçenekler modelden önce elenir; model en çok sekiz adayın sıra çağrışımsız `Qxxxx` kodlarından birini önerebilir veya PASS diyebilir. Kanonik aday, eylem ve hedefi yalnız kod geri çözer.
- Model çıktısı serbest dünya emri değildir. Yalnız `PROPOSE/PASS`, opak seçim kodu ve `opening/tone/address/emphasis` enum konuşma planı kabul edilir. Model sayı, bedel, olasılık, yeni hedef, yeni eylem veya fiziksel sonuç yazamaz; çıktı `proposalOnly:true / worldMutation:false`tır.
- İstek bazlı `node-llama-cpp` JSON şema grameri etkin `requestId`yi, sunulmuş opak kodları ve çapraz alanları sınırlar: PROPOSE yalnız gerçek seçimle, PASS yalnız null seçimle üretilebilir. Katı uygulama doğrulayıcısı yine son otoritedir. Şema dışı alan, uydurma kod veya bozuk çıktı deterministik fallback'e gider.
- Bağlam yabancı `regionId`, servis kimliği, altyapı hasarı/kapasitesi veya başarı/tespit/atıf oranı taşımaz. Doğrulanmış sonuç ve fallback 32 bağlamlık salt öneri önbelleğindedir. Hikâye karakter görevi ilk ihtiyaçta paketli modeli arka planda bir kez ısıtır; hazır olana kadar deterministik seçici çalışır ve oyun beklemez.
- Hedefli prob deterministik istek/fallback, yalnız o isteğin kodlarını taşıyan gramer, sıfır gizli bağlam sızıntısı ve eşit `e90f4044…3bd6d` karma verdi; worker `0,7 sn`de geçti. Açık/kapalı 60 saniye A/B iki tarafta `066bde9f…5c69b` ve geçerli Faz 37 defteri üretti.
- Sürüm-1 bekleyen istek ilk sabit karakter tikinde açılır; modelin asenkron sonucu dünyayı değiştiremez. Sonraki on saniyelik tik aynı adayları, `requestId`yi ve `contextHash`i yeniden üretir. Yalnız doğrulanmış aynı-bağlam PROPOSE/PASS tüketilir; gecikme, stale bağlam ve yüklemede kayıp geçici posta kutusu deterministik fallback olur. Seçim Faz 37 yetki/bedel/hedef/cooldown kapısından yeniden geçer.
- Eylem defteri sürüm-8'dir. Yerel model makbuzu `LOCAL_LLM_VALIDATED` ve `arbiterDecisionId` taşır; deterministik fallback ayrı kaynak/reason kanıtıyla kalır. PASS makbuz uydurmaz. Model/fallback/stale/restore sayaçları budanmış ve canlı AI makbuzlarıyla mutabıktır.
- PASS dahil kararlar `512` tavanlı sürümlü geçmişte tutulur. Aktörün son altı kararı sonraki hakem bağlamına girer. `520` fixture ilk `8` kaydı deterministik budadı; `9–520`, sayaç ve save/load birebir kaldı. Geçerli seçim, PASS, yetişmeyen model, stale hafıza ve yarım kayıt yolları temizdir.
- Paketli `Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf` (`4.920.733.952` bayt), EXE ile eşit `1024` bağlam / `110` token / `0,40` sıcaklık / `gpuLayers:auto` ölçümünde CUDA kullandı. Güncel karar-geçmişli prompt'ta beş rolün tamamı şema ve semantik kapıyı geçti (`5/5 + 5/5`); fallback, üretim hatası ve dünya mutasyonu sıfır; iki farklı opak seçim görüldü. Ortalama ilk token `593,07 ms`, toplam `2.447,50 ms`dir.
- Tam hikâye regresyonu altı işçide `60/60`, çıkış `0` ve `846,0 sn` toplam süreyle geçti. Ana 900 saniyelik koşu `461.121,19 ms`, `8/8` etkin devlet ve değişmeyen `70056c2d…6d4d36e5` karması verdi. Kapsam veya eşikler azaltılmadı.
- `StoryCharacterSpeech.js`, doğrulanmış karar/konuşma planını serbest model metnine çevirmeden eylem/PASS ve ses profilli Türkçe cümleye dönüştürür. Karar kaydı normalize tam cümle, template, istenen/uygulanan hitap, açılış, ton ve vurguyu taşır. Son altı tam cümle içinde tekrar ve aynı hitabın üçüncü ardışık kullanımı engellenir; STALE karar konuşmaz.
- Sohbet ekranındaki `SANA SÖYLENENLER` yalnız oyuncunun hedef olduğu kararlardan türetilir. Sekiz oyuncu-yönelimli söz görünürken AI–AI özel sözü gizli kaldı; dokuz söz save/load'da birebir korundu. Hedefli determinizm, doğrulama, iç alan/sayı sızıntısı ve gerçek DOM kapıları geçti.
- İlk tam koşu mevcut 60 görevi temiz üretmesine rağmen yeni konuşma sonucunun manuel manifestte unutulduğunu assertion aşamasında yakaladı. `characterSpeechProbe` 61. görev olarak eklendi; test dosyasının istediği anahtarlarla manifest artık simülasyondan önce otomatik karşılaştırılıyor. Nihai altı-işçi paket `61/61`, çıkış `0`, `558,4 sn`; ana 900 saniye `219.806,34 ms`, `8/8` devlet ve değişmeyen `70056c2d…6d4d36e5` karma verdi.
- Son gerçek paket kapısı CUDA üzerinde `5/5` şema + `5/5` semantik, sıfır fallback/üretim hatası, `5/5` dünya nötrlüğü, iki farklı seçim ve `524,74 / 2.340,98 ms` ortalama ilk-token/toplam süre verdi. Faz 38 kapandı. Bu sonuç serbest sohbet zekâsı değildir: oyuncu metni/varlık/teyit hattı Faz 38.1; uzun diyalog n-gram/anlamsal tekrar ve kör karakter sesi ayrımı Faz 38.2 borcudur.

## Faz 38.1 ilk dikey — serbest metin analiz zarfı

- `characters.conversationUnderstanding`, karakter kimliği/hafızası/eylem adayları ile kaynak ve şirket defterlerine bağlı ayrı bir özellik kapısıdır; `characters.llmArbiter` kapalıyken de çalışır.
- `story-conversation-understanding-1`, oyuncu metnini kapalı konuşma eylemi, niyet, konu, ton, varlık, iddia, istek, çözülmemiş şart, belirsizlik ve teyit sorularına ayırır. Bu katmanda `worldMutation=false` ve `proposedCommand=null` değişmezdir.
- Çelik referans senaryosunda `İngiltere → country:2` çözülür. Katalogda çelik yoktur; yakın kaynaklardan biri sessizce seçilmez. Sipariş iddiası `UNVERIFIED_IN_CONVERSATION`, sevkiyat kimliği bilinmiyor, komutanın deposu yoktur.
- Şirket sahibi rolünde gerçek `company:0:civil_industry` çözülür; çoklu gerçek depo adayları içinden rastgele/örtük seçim yapılmaz ve belirli depo teyidi istenir.
- Analiz ham yabancı `tradeLogistics.shipments` kayıtlarını okumaz. Aynı metnin sonucuna gizli yabancı sevkiyat eklemek çıktıyı değiştirmedi; yalnız çağrıda açık `knownEntityIds` ile verilen kimlik kullanılabildi.
- İlk bulanık eşleştirme `sipariş` sözcüğünü `Paris` sanıyordu. Alt dize eşleme kaldırıldı; kelime/sonek sınırı ve şehirlerde asgari güven uygulandı. Tam/yazım hatalı örnek aynı ticari niyete bağlandı.
- Hedefli worker probu `1/1` ve tüm koşul denetimi temizdir. İlk tam koşu yalnız bayat UI borç metni assertion'ında durdu; gerçek `Faz 38.1–38.5` metniyle beklenti eşlendi ve ilgili şehir/konuşma probları tekrar geçti. Nihai altı-işçi paket `62/62`, çıkış `0`, `1.061,5 sn`; ana 900 saniyelik koşu `418.709,45 ms`, `8/8` devlet, `%80,23/%80,34/%72,24` erişim ve aynı `70056c2d…6d4d36e5` karması verdi. Faz, çok turlu teyit ve ActorBelief borçları nedeniyle `partial` kalır.

### İkinci dikey — oyuncu ilk kez serbest söz üretiyor

- Hedefli karakter kartında textarea ve `SÖZÜ ANALİZ ET VE TASLAĞA AL` eylemi vardır. Oyuncu cümlesi geçici UI metni değil, `story-conversation-session-ledger-1` oturumudur.
- Çelik taslağında kanonik kaynak seçimi, gerçek depo, miktar, ödeme, teslim süresi ve ceza altı ayrı açıklama olarak aynı oturuma işlendi. Sunulmayan `military_supplies` seçeneği reddedildi.
- Başta çözülmüş `country:2`, açık bilinen sevkiyat ve oyuncu şirketi son mekanik adayda kaybolmadı; seçilen depo `REDIRECT_SHIPMENT.destinationId` alanına taşındı.
- `READY_FOR_DOMAIN_REVIEW`, “uygulanabilir” demek değildir. Aday `executable=false/worldMutation=false`; sahiplik, şirket kaydı, makam yetkisi, depo kapasitesi ve konuşma iddiası motor denetimi olarak açık kalır.
- UI aynı anda ilk sekiz depo adayını gösterir; 25 seçeneği tek ekrana basmaz. Bölge/arama ile gerçek daraltma Faz 38.5 borcudur.
- Bir programatik çelik taslağı ve DOM üzerinden verilen oyuncu sözü, tüm soru/cevap/aday yapısıyla save/load'da birebir korundu. Özellik kapalı kampanya kaydı bozulmadı.
- Bağlı görsel tarayıcı bulunamadığı için piksel yerleşim denetimi yapılmadı. Hedefli gerçek DOM tıklaması geçti; EXE görsel/okunabilirlik kontrolü açık borçtur.
- Hedefli konuşma probu `1,4 sn`, şehir→karakter UI probu `19,5 sn` içinde geçti. Tam paket eşzamanlı savaş AI yükünde altı işçiyle `1.504,1 sn`, üç işçiyle `2.404,1 sn` sonunda dış zaman sınırına ulaştı; assertion sonucu üretemedi ve iki koşu da geride test işçisi bırakmadı. Tam kabul kapısı açık tutuldu.

### Görüşme çalışma alanı dikeyi — profil, geçmiş ve klavye odağı

- Serbest söz alanı dar sohbet çekmecesinden çıkarıldı. Hedefli karakter kartı artık profil/geçmiş/anlaşma bağlamını açan tek bir `GÖRÜŞME PENCERESİNİ AÇ` eylemi taşır.
- Ayrı modalın solunda yalnız kamusal sicil kimliği ve oyuncunun taraf olduğu yönlü ilişki bulunur; gizli kişilik, yabancı konum veya ham dünya defteri sızdırılmaz. Sağdaki anlaşma ve hafıza kayıtları `PlayerKnowledge` filtresinden gelir.
- Aynı kişiyle bütün sürümlü konuşma oturumları yeni tarihten eskiye listelenir. Açık soru taşıyan eski taslak kaldığı sorudan sürdürülebilir; tamamlanmış taslak tekrar incelenebilir; yeni konuşma eski oturumu ezmez.
- Modal içindeki bütün tuş olayları kamera/savaş kısayollarından kesilir. StoryUI de `input`, `textarea`, `select` ve `contenteditable` hedeflerinde WASD/ok/zoom kısayollarını çalıştırmaz; metnin varsayılan yazım davranışı korunur.
- İzole prob `4,9 sn` sürdü ve analiz doğrulaması, profil, iki konuşma geçmişi, eski konuşmaya dönüş, uygulanmış karakter eylemi görünümü, WASD, dünya nötrlüğü ve `2` oturumlu save/load birebirliğini geçti. Bağlı tarayıcı listesi boş olduğu için 1920×1080 piksel karşılaştırması yapılamadı; `../../ux/qa/design-qa.md` bu kapıyı `blocked` olarak kaydeder.

### Üçüncü dikey — ActorBelief sınırlı mekanik muhatap cevabı

- Açıklamalar tamamlandığında `story-conversation-domain-review-1`, konuşmacının şirket/depo temsilini ve muhatabın görüşme yetkisini gerçek kimlik, şirket ve depo defterlerinden denetler. Yeni şirket kaydı, fiziksel birim dönüşümü/kapasite ve icra makamı ayrı kontrollerdir; oyuncu bunları yalnız söyleyerek geçemez.
- Muhatap sevkiyat iddiası için yalnız kendi `ActorBelief` kayıtlarını, kaynak durumunu ve güven düzeyini okur. Ham WorldV2 ve `tradeLogistics` erişimi yoktur. Ham ticaret defterine sevkiyat fikstürü eklemek ilk `ASK_EVIDENCE` incelemesinin kararını ve kimliğini değiştirmedi.
- Aynı sevkiyatı bilen muhataba kaynaklı `EXISTING_IMPORT_ORDER` olgusu ve `%92` doğrulanmış inanç verildiğinde iddia kabul edildi; yeni çelik şirketi henüz kayıtlı olmadığı için cevap `COUNTER_OFFER` oldu. Cevap, kamuya uygun kontrol gerekçeleri ve “dünya değişmedi” sınırı ayrı görüşme penceresinde görünür.
- Domain inceleme sonucu ve cevap oturumda saklanır; aday her dalda `executable=false/worldMutation=false` kalır. Yeniden inceleme karması önceki inceleme kimliğini kendi girdisine katmaz; aynı kanıt durumu aynı kimliği üretir.
- Hedefli probda inceleme öncesi/sonrası dünya karması eşit, defter doğrulaması temiz, ham defter izolasyonu ve ActorBelief etkisi doğru, iki oturum kayıt/yüklemede birebir ve UI mekanik cevap görünümü geçerlidir. Faz 38.1'in sıradaki dikeyi oyuncunun kanıt sunması veya karşı teklifi kabul/değiştir/ret etmesi; Faz 38.3 sınırı ise ancak bundan sonra kalıcı `NegotiationCase` üretmesidir.

### Dördüncü dikey — kanıt sunma ve karşı teklif cevabı

- `story-conversation-session-ledger-3`; `playerResponses`, `evidenceSubmissions`, `concessions` ve terminal `resolution` alanlarını ekler. Şema-1/2 kayıtları boş ve güvenli varsayılanlarla şema-3'e göçer.
- Kanıt listesi küresel gerçeklerden değil oyuncu karakterinin kendi `ActorBelief` görünümünden üretilir. Oyuncuya sunulmayan sahte kimlik reddedilir. Sunulan kaynak inancı muhatapta aynı `worldFactId`ye bağlı `REPORTED` kayıt oluşturur; oyuncunun `%92` doğrulanmış bilgisi muhatapta `%78,2` raporlanan bilgiye dönüştü, kendiliğinden `VERIFIED` olmadı.
- Kanıt sonrası `ASK_EVIDENCE → COUNTER_OFFER`; UI'daki kanonik “Mevcut şirketim üzerinden ilerle” cevabı sonrası `COUNTER_OFFER → READY_FOR_NEGOTIATION` geçişi gerçekleşti. Bu taviz yalnız görüşme adayını değiştirir; yeni şirket, para, sözleşme, depo stoğu veya sevkiyat üretmez.
- Kanıtlanamayan iddiayı geri çekme, görüşmeyi reddetme ve şirket kuruluşunu beklemek üzere erteleme seçenekleri motor tarafından sunulur. Serbest DOM veri değeri eylem adı veya kanıt kimliği enjekte edemez.
- UI seçenek projeksiyonu salt-okunurdur. Hedefli karşı-probda sahte kanıt reddi, sahipli kanıt seçeneği, kaynak zinciri, karşı teklif, gerçek DOM tıklaması, fiziksel ekonomi nötrlüğü, çalıştırılamaz aday, geçerli şema, iki oturumlu birebir save/load ve şema-2→3 göçü geçti.
- Tam kapanış koşusu üç işçiyle `62/62` sonuç üretti (`3.139,0 sn`); Faz 38.1 probu `17,8 sn` ve temizdir. Paket yalnız eski son-300 yaşam koşulu assertion'ında durdu. İzole ana koşu `%69,2809` ortalama, `%70,69` final ve `5fb25684…64a` karma ile sonucu tekrarladı. Aynı çalışma ağacında altı askerî bina ve bağımlılık grafiği `Production.js` üzerinden canlı olduğundan eski `70056c2d…6d4d36e5` referansı korunmuyor. Kullanıcının eşzamanlı savaş/üretim çalışması geri alınmadı; `%70` eşiği gevşetilmedi. Faz 38.1 global kabulü bu nedenle açık kaldı.

## Faz 32 sonrası arayüz ve test tezgâhı ara teslimi

- Dünya ekranının sağ bilgi yığını `GÜNDEM / BÖLGE / AKIŞ` bağlamlarına ayrıldı. Varsayılan `GÜNDEM`, aynı anda en fazla beş konuyu önem sırasıyla gösterir; `BÖLGE` mevcut harekât brifingini, `AKIŞ` dünya günlüğünü korur. Haritada düğüm seçimi doğrudan bölge bağlamına geçer.
- Gündem yeni veya sahte bir yönetim durumu üretmez. Bekleyen fraksiyon olayı, grev, refah, enflasyon, Faz 30 uygulama bileti, Faz 31 seçim/itirazı, Faz 32 kamusal soruşturması ve seçili aktif cephe mevcut salt-okunur görünümlerden türetilir. Her konu ekonomi, konsey veya bölge çalışma alanına tek eylemle gider.
- Sekmeler `tablist/tab/tabpanel`, `aria-selected`, klavye sol/sağ/Home/End dolaşımı ve görünür odak taşır. Gündem 2 Hz simülasyon çözünürlüğünde güncellenir; 50 Hz panel döngüsünde ağır ülke/kurum görünümü yeniden klonlanmaz.
- `probeCityDossier`, gündemin simülasyon karmasını değiştirmediğini; bekleyen toplumsal olayın ilk sırada `critical` çıktığını; üç sekmenin görünürlük ve erişilebilirlik sözleşmesini ve beş maddelik yük tavanını doğruluyor. Görsel tarayıcı bu oturumda kullanılamadığı için piksel/viewport kabulü gerçek EXE üzerinde oyuncu kontrolüne açıktır.
- 8 Ağustos performans düzeltmesiyle şehir/ekonomi panelleri her 0,5 saniyelik istekte tam `WorldV2 + PlayerKnowledge` ağacını yeniden kurmuyor. Sekme bağımlı defter ve scheduler sürümleri değişmedikçe görünüm önbellekten geliyor; aynı render anahtarında HTML üretimi ve DOM yazımı atlanıyor. Ekonomi paneli bu güvenli kapıyla canlı yenileniyor. Ana bölge bilgisi, günlük, ordu, teknoloji, konsey ve değişim panellerinde değişmeyen `innerHTML` yazımları da durduruldu. Hedefli ölçüm ilk istekte `1` görünüm/`1` DOM yazımı, sonraki 25 istekte `25` görünüm isabeti/`25` DOM atlaması verdi.
- Paralel tezgâhın heap tavanı ile gerçek işçi planlama tahmini ayrıldı. Tam `npm test -- --workers=6` koşusu aynı `52/52` sonuç ve `dd4ea4786ddfdc10b26ed949213a2c2bddadc5782f1b2aa5b7d104ab0081f42c` karmasıyla `489,1 sn` sürdü; seri `1.664,7 sn` referansa göre `3,40×` hızlanma ve `%70,6` süre azalmasıdır. Kabul ayrıntısı `../qa/HIKAYE-TEST-PARALEL.md` içindedir.

## Faz 38.2 ilk dikey — uzun konuşmada kontrollü gerçekleştirme

- `storyCharacterDialogueRealize`, kapalı konuşma eylemini değiştirmeden aktörün ses profilinden `DIRECT / FORMAL / WARM / CAUTIOUS` birincil ve ikincil kayıtlarını türetir. Çıktı dünya mutasyonu yapmaz ve yeni sayı, olgu, yetki veya sonuç eklemez.
- Seçici son 12 normalize tam cümleyi, son altı şablonu, iki-sözcüklü Jaccard benzerliğini ve son iki hitabı denetler. `%72` benzerlik tavanı ve üçüncü aynı hitap açık kabul koşuludur.
- İlk prob bir gerçek hata buldu: alternatif hitap havuzu açılıyor fakat sıralama aynı hitabı açıkça cezalandırmıyordu. Ceza seçim sırasına eklendi; tekrar koşusu temiz geçti.
- Üç gerçek karakter × 24 tur = `72/72` söz geçerli, deterministik, tam-cümle tekrarsız, hitap-spamsiz, iç alan sızıntısız ve fiziksel olarak nötr kaldı. Ses imzaları `CAUTIOUS>WARM`, `FORMAL>CAUTIOUS`, `CAUTIOUS>FORMAL` oldu. Gerçek test-manifesti işçisi `1/1`, `23,6 sn`, çıkış `0` verdi.
- Gerçek Faz 38.1 ön-inceleme cevabı artık aynı gerçekleştiriciden geçer. Deterministik kural cevabı `mechanicalText` içinde değişmeden saklanır; UI `DOĞRULANMIŞ KARAKTER CEVABI` metnini gösterir. Birleşik hedefli prob gerçekleştirme doğrulaması, mekanik zemin, ekonomi eşitliği, icra engeli, kayıt doğrulaması ve save/load eşitliğini geçti.
- Türkçe ekleri sadeleştiren ve `koşul/şart`, `kabul/onay`, `bilgi/kaynak/doğrulama` gibi açık kavram kümelerini birleştiren ikinci yakınlık ölçeri eklendi. Bu bir embedding değildir ve öyle raporlanmaz. 72 turda `%86` tavanı geçildi; en yüksek değer `%37,5` oldu.
- `npm run story:dialogue-blind`, `qa-runtime/story-dialogue-blind-phase38.2` altında anahtardan ayrı kör paket üretir: üç ses, 12 etiketli öğrenme örneği ve 24 anonim madde. Paket `actorId`, `character:` veya `voiceFingerprint` sızdırmıyor. Puanlayıcının kusursuz kontrolü `%100/pass`, tek-ses kontrolü `%33,33/fail`; insan sonucu henüz yoktur.
- Bu makine kör sınıflandırma kanıtıdır; insan kör değerlendirmesi değildir. Kalıcı oturum bağlamı ve gömme tabanlı anlamsal denetim kurulmadığı için Faz 38.2 `partial` kalır. Faz 38.1'in küresel `%70` yaşam koşulu kabul borcu da ayrı ve açık kalır.

## Faz 38.3 ilk dikey — sürümlü müzakere vakası

- Yeni `characters.negotiationCases` bayrağı; konuşma anlama, karakter hafızası, gerçek ticaret ve şirket defterlerine bağımlıdır. Yeni kampanyada sıfırlanır, ana kayda ayrı `negotiations` defteri olarak girer ve konuşma oturumundan sonra geri yüklenir.
- Hazır konuşma UI'sındaki `MÜZAKERE VAKASI AÇ`, aynı oturum için yalnız tek vaka üretir. Vaka ilk teklif sürümünü, tarafları, kaynak aday karmasını, taviz ve kanıt izlerini taşır.
- Karşı teklif eski sürümü ezmez. Yalnız kapalı dört şart değişebilir; dış aktör, bilinmeyen alan, değişmeyen teklif ve eski sürüm kabulü reddedilir.
- İki taraf güncel sürümde anlaşsa bile `MECHANICAL_CONTRACT_AUTHORITY=PENDING` ve `NOT_AUTHORIZED` kalır. Bu dikey ödeme, stok, sevkiyat veya ilişki mutasyonu yapmaz.
- Gerçek UI + konuşma + kanıt + karşı teklif zincirinde hedefli manifest işçisi `1/1`, `2,2 sn`, çıkış `0` verdi. Vaka doğrulaması ve kayıt/yükleme birebirliği temizdir.
- İkinci dikey iki kapalı söz türü ekledi. Karşı teklif sözü yalnız aynı aktörün daha yüksek numaralı gerçek sürümüyle tutulur; mekanik onay sözü onay icrası olmadığı için son tarihte bozulur. Sonuçlar `KEPT/BROKEN` hafıza mihenk taşına ve yönlü ilişkiye tek sefer yazılır; ikinci tick ikinci ceza üretmez.
- Tutulan söz `+250 güven / +150 saygı / −100 husumet / +120 borç`, bozulan söz `−600 güven / −250 saygı / +350 husumet` uygular. Bu değerler kapalı sosyal sözleşmedir; fiziksel sözleşme, stok veya para vekili değildir.
- `negotiation-deadlines`, scheduler sicilinde 5 saniye aralıkla `character-actions` sonrasında ve `siege` öncesinde doğrulandı. Eski ağır scheduler A/B+devam probu mevcut CPU rekabetinde iki kez yaklaşık 185 saniyelik dış sınırı aştı; assertion başarısı verilmedi.
- Üçüncü dikey özel bir `ActorBelief`i yalnız vaka tarafları arasında `SECRET` hafıza kaydıyla paylaşır. Kaynak inanç sahibinden gelmeli, olgu `PRIVATE` ve güven en az `%50` olmalıdır; dış aktör sır başlatamaz.
- Yetkisiz ifşa yeni özel `WorldFact + ActorBelief` kanıtı üretir ama sır sahibine telepatik bilgi veya anlık ilişki cezası vermez. İlk anda yalnız ifşa eden ve alan aktör ifşa olgusunu bilir; ilgisiz dördüncü aktöre hem sır hem ifşa bilgisi sızmaz.
- İfşa olgusunu gerçekten bilen aktör kaynaklı rapor verdiğinde sır sahibinde `SOURCED_LEAK_REPORT` inancı doğar. Ancak o anda güven `−800`, saygı `−300`, husumet `+500` ve `BETRAYAL` mihenk taşı bir kez uygulanır; aynı raporun tekrarı etkisizdir. Yetkilendirilmiş ifşa ihanet sayılmaz.
- Gerçek konuşma→vaka→sır→sızıntı→rapor hedefli probunda altı sır/mahremiyet/idempotency kapısı geçti; kimlik ve müzakere defterleri `ok`, kayıt/yükleme birebir kaldı. UI açık vaka özetinde yalnız gizli paylaşım sayısını gösterir, içerik veya sahip listesini açmaz.
- Mekanik icra ön-incelemesi bir veri kaybını yakaladı: konuşma sözleşmesi ödeme ve cezayı `type`, miktar ve süreyi `unit` alanında taşıyordu; vaka dönüştürücüsü yalnız `unit` okuyup ödeme/cezayı sessizce düşürüyordu. Dönüştürücü iki kanonik alanı da kabul ediyor ve vaka artık dört şartın tamamı yoksa açılmıyor. Doğrulayıcı her teklif sürümünde pozitif miktar + açık birim/tür arıyor; hedefli gerçek runtime ilk sürümde `ton / capital / DAY / PERCENT`, geçerli defter ve birebir restore verdi.
- Dördüncü dikey vaka içine kaynak aday karmasına bağlı, sürümlü mekanik zemin koydu: gerçek `TARGET_SHIPMENT`, `DESTINATION`, `COMMODITY`, `PLAYER_ORGANIZATION`, `REDIRECT_SHIPMENT`, iddia ve domain-review bağı artık yalnız hash arkasında kaybolmuyor. Ön-kontrolü yalnız vaka tarafı ve iki tarafça kabul edilmiş güncel sürüm çalıştırabilir.
- Ön-kontrol tek yönlendirme isteği, etkin sevkiyat, kanonik sipariş+sözleşme, çalışan depo, şirket temsil/sahiplik bağı, kaynak kimliği, alıcı ülke, fiziksel miktar/birim ve nominal kapasiteyi ayrı kodlarla denetler. Ayrıca mevcut mimarinin dürüst sınırlarını zorunlu engel sayar: depo doluluk muhasebesi, pazarlık bedeli escrow yürütücüsü, teslim takvimi ve ceza icrası yoktur.
- Çelik fikstürü `ORDER_REFERENCE_MISSING`, `UNIT_CONVERSION_REQUIRED`, `WAREHOUSE_OCCUPANCY_ACCOUNTING_UNAVAILABLE`, `NEGOTIATED_PAYMENT_EXECUTOR_UNAVAILABLE`, `DELIVERY_SCHEDULE_EXECUTOR_UNAVAILABLE`, `CONTRACT_PENALTY_EXECUTOR_UNAVAILABLE` kodlarıyla `BLOCKED` kaldı; para/stok/sevkiyat karması eşittir. Aynı girdi aynı makbuzu döndürür. Yeni teklif sürümü eski ön-kontrol yetkisini sıfırlar, tarihsel makbuzu korur ve UI yalnız güncel sürüm makbuzunu gösterir.
- Mekanik zemin öncesi vaka kaydı, kaynak konuşma oturumu ve aday karması birebir eşleşiyorsa zeminini geri kazanır; hedefli eski-kayıt yükseltmesi ve güncel save/load doğrulaması temizdir.
- Beşinci dikey iki ön-kontrol engelini gerçek upstream sistemlerde kapattı. `storyResourceUnitResolve`, konuşma birimini kaynak kataloğunun `unit.id/label/symbol` ve kapalı eşanlamlarına bağlar; `industrial_parts + ton` dönüşüm kanıtı olmadan reddedilir, `lot-parça → parts_lot` ve `ton-gıda → food_ton` 1:1 kabul edilir. LLM veya kaba ortak ton katsayısı yoktur.
- `storyCompanyWarehouseOccupancy`, bölgede tek genel deponun teslim edilmiş doluluğunu kanonik bölgesel stoktan, ayrılmış gelecek doluluğunu yalnız `IN_TRANSIT/HELD` fiziksel sevkiyatlardan türetir. Açık fakat sevk edilmemiş sipariş mal sayılmaz. `capacity = stored + incoming + available` bağı aşırı dolulukta sıfıra kırpılmış kullanılabilir kapasiteyle hedefli probda geçti; ayrı stok kopyası oluşturulmadı.
- `storyBudgetReserveNegotiatedPayment`, pazarlık bedelini şirket bakım rezervini koruyarak `CASH→TRADE_ESCROW` çift taraflı fişe ve aynı anda `NEGOTIATED_CONTRACT_ESCROW` bütçe settlementına bağlar. Aynı korelasyon+tutar ikinci para çekmez; çatışan tutar reddedilir. `storyBudgetReleaseNegotiatedPayment` iptalde escrow'yu nakde birebir döndürür ve tekrar release etkisizdir. Hedefli `5` sermaye rezerv/release sonrası şirket ve bütçe doğrulaması temizdir. Bu satıcıya ödeme/teslim uzlaşması değildir; yalnız güvenli rezervasyon yürütücüsüdür.
- Çelik vakasındaki `550 sermaye`, oyuncu şirketinin bakım rezervi sonrası nakdini aştığı için ön-kontrol artık “yürütücü yok” yerine doğru `NEGOTIATED_PAYMENT_CASH_UNAVAILABLE` sonucunu verir. Teslim takvimi ve ceza yürütücüsü ile kanonik sipariş referansı hâlâ engeldir.

### Sohbet QA — sanal oyuncu kapısı

- Gerçek EXE konuşma günlüğündeki cümlelerden beslenen `virtualConversationLabProbe` zorunlu test manifestine eklendi. Beş karakter rolü × 12 gerçek senaryo × 10 yazım/üslup varyantı × iki aynı-tohum koşusu = `1.200` tur çalışır.
- Kapı; niyet/söylem eşleşmesi, genel bilinmeyen cevabına yığılmama, servis-botu dili üretmeme, olgusal sınır cevaplarını LLM'e bırakmama, sıfır dünya mutasyonu ve deterministik tekrar koşullarını birlikte arar.
- Yeni gerçek kayıt borçları kapatıldı: görev/meslek sorusu, doğrulanmamış mevcut iş, oyuncunun görev istemesi, enerji sorunu bildirimi, çekinme yorumu, açıklama talebi, kısa kabul ve cevapsızlık itirazı artık ayrı bağlamsal yanıttır.
- Açık borç: bu hızlı laboratuvar gerçek 8B üretimini çalıştırmaz. GPU üstünde daha küçük ama gerçek-model kullanan sanal diyalog turu; tekrar, kişilik tutarlılığı, Türkçe ve uzun bağlam ölçümleriyle ayrıca kurulmalıdır. İnsan JSONL kaydı nihai kabul kaynağı olmaya devam eder.
- Bu borcun uygulama planı `../plans/HIKAYE_SOHBET_MOTORU_GELISTIRME_PLANI.md` içinde S0–S12 olarak açıldı. Güncel yön, cümle başına kural yazmak veya 8B+14B'yi aynı anda canlı tutmak değildir. 8B oyun içi gerçekleştirici; Coder-14B oyun kapalıyken adversarial oyuncu ve insan-kalibreli eleştirmen; deterministik motor ise gerçek, yetki, hareket ve kalıcı söylem sahibi olacaktır.

## Faz 22.1 çalışma günlüğü (arşiv)

**Arşiv kapanış kararı (2 Ağustos 2026):** Aşağıdaki maddeler Faz 22.1E'nin teşhis ve deney günlüğüdür. Son hane dağıtım kabulü bütün fiziksel, mali, deterministik ve uzun dönem denge kapılarını geçti; Faz 22.1E tamamlandı. O tarihte sıradaki uygulama **Faz 25 — Kamuoyu ve Şikâyet Hafızası** idi; güncel sıra belgenin üstündeki faz tablosundadır.

1. Faz 22.1A–D aday uygulamasını sertleştirmek: reçete darboğaz sayacı, ülke portföyü, fiziksel yatırım emaneti ve gerçek rota/ödeme tedariki kodlandı; henüz kabul edilmedi.
2. Faz 22.1 kapalı kontrol yolundaki karma ve davranış sızıntısını bulmak. Gereksiz sipariş şema alanı kaldırıldı fakat kontrol hâlâ `8` proje üretiyor; beklenen Faz 24 karması sağlanmadan A/B kanıtı geçerli sayılmaz.
3. Bounded retry/backoff uygulandı: tek 900 saniyelik koşu `65,61→34,63 sn`, açık emir `179→151`, aktif sevkiyat `237→209`. Üretim girdisi emrinin geçici sevk hatasında iptal edilmesi kaldırıldı; son adayda `88` üretim ithalat emri şirket yerine devlet finansmanında bekliyor. Alıcı şirket/banka/escrow’yu doğrudan satıcıya bağlayan deney `%3,94/%6,42` ve `10` iflas; satıcıya ikinci ödeme yapmayıp takas havuzuna döndüren deney `%4,27/%4,19` ve `9` iflas üretti. İkisi de geri alındı. Önce geliri üretimden gerçek satış anına taşıyan; hane, şirket ve devlet ödemelerini stok-maliyet/borç-alacakla kapatan para dolaşımı kurulmalı.
4. 900 saniye kabul koşusunun güncel adayı son 300 saniyede gıda `%48,32`, enerji `%53,62`, yaşam koşulu `%57,00` ve `33` tamamlanmış proje üretti; `%60/%70` kapısı geçmedi. Bütün üretimi öne alma ve dört erken parça sevkiyatı deneyleri daha kötü sonuç verdiği için geri alındı.
5. Proje hazırlık iptali/iadesi, eski kayıt backfill’i, bozuk emanet kurtarması ve özellik-kapalı yol için hedefli Faz 22.1 probu eklemek.
6. Son kodda `npm test` ve 30 oyun yıllık soak kapılarını geçirmek. Bounded retry ve kalıcı üretim emri değişikliklerinden sonraki tam paket `230bc647…ef36` karmasıyla geçti (`900` simülasyon saniyesi, test içi `50,16 sn`, çıkış kodu `0`); hedefli ticaret/bölgesel/korunum probları da geçiyor. Bu teknik geçiş denge kabulü değildir: final erişim gıda `%45,89`, enerji `%48,84`, yaşam koşulu `%55,51`; 30 oyun yıllık soak hâlâ yeniden koşulmalı.
7. Faz 25’e yalnız Faz 22.1 fiziksel, A/B ve denge kapıları geçtikten sonra başlamak.
8. Her faz başlangıcı ve kabul raporu öncesinde `../research/DIS_ANALIZ_VERI_DEFTERI.md` içindeki açık kayıtları ana planla karşılaştırmak; dış öneriyi kanıt olmadan uygulanmış gerçek saymamak.
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

## HXD — Altıgen dünya altyapısı tasarım kaydı (16 Ağustos 2026)

- Yeni çapraz program `../plans/HIKAYE_HEX_DUNYA_ALTYAPI_PLANI.md` içinde `HXD-0–HXD-15` olarak açıldı. Bu bir uygulama kabulü değildir; mevcut aktif ana fazın tamamlandığı anlamına gelmez.
- Karar: mevcut 152 bölge silinmeyecek, altıgen kümelerinin idarî üst görünümü olacaktır. Çalışan ekonomi, stok, lot, sipariş, ödeme, sevkiyat, şirket, karakter ve nedensellik defterleri korunacaktır.
- Altıgen yalnız görsel overlay olmayacaktır. `HexCell/HexState`, şehir/saha, altyapı segmenti, rota, sevkiyat ve hareketli araç ayrı sürümlü sözleşmelerle aynı mekânsal gerçeğe bağlanacaktır.
- Şehir çekirdekleri geçerli kara hücresine göç edecek; kıyı şehirlerinin limanı ayrı kıyı/deniz terminali olacaktır. Denizde şehir ve limansız deniz bağlantısı kabulde sıfır olmak zorundadır.
- Şehir büyümesi doğrudan ikon ölçeği veya `level +1` olmayacaktır. Nüfus, arazi, imar, finansman, malzeme, iş gücü, altyapı, inşaat ve kullanım zinciriyle yeni ilçeler/yapılar oluşacaktır.
- Yol/ray/liman; yapım, kapasite, bakım, hasar, kapanma ve onarım taşıyan fiziksel segmentlerdir. Mantıksal altıgen yol görselde sert zikzak bırakılmayacak, doğrulanmış spline geometriyle çizilecektir.
- Tır, tren ve gemi gerçek `Shipment`/manifestoya bağlı hareketli dünya varlıkları olacaktır. Araç hedefe ulaşmadan teslim fişi ve hedef stok artışı üretilemez. Ölçek için uzak sıradan akış toplulaştırılabilir fakat ilerleme, ETA ve korunum kaybolamaz.
- İlk uygulama paketi `HXD-0–HXD-4`; ilk oynanabilir dikey Ankara–İstanbul kara yolu, devamı demir yolu; deniz dikeyi İstanbul–İzmir veya İstanbul–Trabzon olacaktır. Mevcut harita sanat varlıkları silinmeyecek ve yeni fiziksel coğrafyanın render girdisine dönüştürülecektir.
- Grid çözünürlüğü tahminle kilitlenmeyecek. Yaklaşık `6.800 / 10.600 / 18.900` hücrelik üç aday kıyı doğruluğu, rota, 900 saniye simülasyon, kayıt boyutu ve gerçek EXE render p95 ile karşılaştırılacaktır.
- Ana riskler: eski/yeni fizik için uzun süreli çift yazım, her aracı küresel tam simüle ederek performansı çökertme, hücre merkezli zikzak yol görünümü, teknoloji araştırmasını kurulu taban olmadan anlık dünya dönüşümüne çevirme ve altıgeni yalnız kozmetik katman yapma. Plan bunların tümünü açıkça yasaklar.

## HXD-0/HXD-1 kabul sonucu

- `js/StoryHexWorld.js`, `POINTY_AXIAL_QR_V1` koordinatında typed-array tabanlı `story-hex-world-1` sidecar'ını kurdu. Build-time `js/StoryHexWorldAsset.js`, `tools/make-story-hex-world.js` ile üretiliyor ve gerçek EXE ile headless harness içinde aynı sırada yükleniyor.
- Gerçek `3000×2360` dünyada ölçülen üç aday `6.873 / 10.584 / 19.074` hücredir. Ana temel `16,1` yarıçap, `98` satır ve tam `10.584` hücre olarak seçildi. Koordinat typed-array'leri `127.796 bayt`; kaynak karması `fnv1a32:3f310aba`, yerleşim karması `fnv1a32:1ee6a11a`dır.
- HXD-0 baseline `152` şehir, `152` bölge, `71` görsel yol, `591` altyapı koridoru (`177 LAND / 20 SEA / 197 ENERGY / 197 DATA`), `423` tesis ve `152` depoyu dondurdu. Ayrıntı `../design/HIKAYE_HEX_DUNYA_ENVANTERI.md` içindedir.
- Ankara `hex:42:63`, İstanbul `hex:38:60` geometrik ankrajına bağlandı. Bunlar farklı hücrelerdir fakat HXD-2 kara/kıyı sınıflaması tamamlanmadan şehirlerin fiziksel olarak doğru karada olduğu iddia edilmez.
- Aynı girdide aynı checksum, merkez round-trip, sınır komşuluğu, cache, bozuk asset reddi ve dünya tarafsızlığı geçti. Runtime ilk kurulum hedefli ölçümde yaklaşık `3,2 ms`; bağımsız tüm çözünürlük testi yaklaşık `7,6 ms` verdi.
- `npm run story:hex-test` çıkış kodu `0`; gerçek hikâye runtime'ındaki `npm run test:story -- --task=hexWorldProbe --workers=1` çıkış kodu `0` ve görev süresi yaklaşık `0,3 sn` oldu. Tam regresyon bu ilk salt-okunur dilimde yeniden çalıştırılmadı.
- HXD-0 ve HXD-1 tamamlandı. Sıradaki aşama **HXD-2 — kanonik rasterden kara/su/kıyı ve geçiş topolojisi**dir.

## HXD-2 kabul sonucu

- `js/StoryHexGeography.js`, `StoryMapRaster` kara maskesini her altıgende `19` sabit alan örneğine dönüştüren `story-hex-geography-1` sidecar'ını kurdu. Gerçek EXE ve `story-sim-harness` aynı dosyayı aynı raster yükleme sırasından kullanır.
- `10.584` hücre eksiksiz sınıflandı: `6.546 LAND / 3.067 WATER / 960 COAST / 11 IMPASSABLE`. `7.009` hücre kara, `3.564` hücre su hareketine açıktır; `640` hücre kategorik `GEO.ranges` dağ koridoruna, `43` hücre `GEO.rivers` nehir yakınlığına değmektedir.
- Altı ortak kenarın kara/su/kıyı maskeleri iki komşuda ters yönlü simetriyle doğrulanır. Kapsama, arazi sınıfı, kenar simetrisi ve sahte yükseklik kaynaklarının dört bozuk örneği ayrı ayrı reddedildi. Coğrafya karması `fnv1a32:76d987bd`, typed-array yükü `127.008 bayt`, ilk runtime kurulum ölçümü yaklaşık `109–113 ms`dir.
- Ankara `hex:42:63` üzerinde `%100` kara kaldı. İstanbul'un eski `hex:38:60` geometrik hücresi yalnız `%31,58` kara ve kara hareketine kapalı çıktı. Eşik/raster değiştirilmedi; çözümleyici şehri `15,684` dünya birimi uzaktaki `%89,47` kara kapsamalı kıyı `hex:38:61` hücresine deterministik göç adayı olarak bağladı. Eski ve çözülmüş ankraj birlikte denetlenebilir kalır.
- Projede gerçek yükseklik/eğim veya iç-su türü kaynağı bulunmadığından metre, eğim ya da göl/deniz etiketi uydurulmadı; durum açıkça `UNAVAILABLE_NO_CANONICAL_SOURCE` taşır. Bu veri borcu HXD-2 sonucundan gizlenmedi ve HXD-3 idarî göçünü engellemez.
- `hexGeographyProbe`, `hexWorldProbe` ve `mapRasterProbe` ayrı ayrı çıkış kodu `0` verdi. Coğrafya probu dünya durumunu değiştirmedi, aynı girdide aynı checksum'ı üretti ve runtime cache kimliğini korudu. Tam regresyon bu sidecar diliminde yeniden çalıştırılmadı.
- HXD-0, HXD-1 ve HXD-2 tamamlandı. Sıradaki aşama **HXD-3 — 152 idarî bölgenin altıgen kümelerine kayıpsız göçü**dür.

## HXD-7.4.2b — dinamik liman ve fiziksel deniz güzergâhı (`implemented`)

- `SEA` başvurusu artık şehir merkezi arasında soyut çizgi üretmez. Her uç için geçerli kıyı kara hücresi ve ortak kenarlı seyredilebilir su hücresi çözülür; iki su terminali arasında gerçek altıgen deniz zinciri bulunamazsa başvuru reddedilir. Başlangıçta limanı olmayan fakat fiziksel kıyı sitesi bulunan şehir için proje yeni terminal gereksinimi taşır.
- İki liman ev sahibi bölgesinden geçiş/kıyı kullanım kanıtı ve ayrıca liman otoritesi kanıtı zorunludur. Deniz projesi her durumda çevresel değerlendirme + azaltım kararı ister; yeni terminal ve coğrafi fallback tarama/dolgu maliyetini mekanik olarak büyütür. Genel kurum kararı, yetkili aktör, finansman, bölgesel hammadde/parça/elektronik ve işgücü kapıları LAND/RAIL ile aynıdır.
- Aktif deniz şantiyesi haritada mavi kesikli, onaylanmış rıhtım–su yolu–rıhtım zinciriyle görünür. Süre dolduğunda makbuz liman sitelerini, otorite kanıtlarını, çevre kararını, rota hücrelerini ve tüketimi saklar. Tamamlanan SEA uçları yerleşim kaynak sözleşmesine girer; yerleşim, makro altyapı ve fiziksel segment önbellekleri bu sırayla yenilenir.
- Gerçek Nantes–Cork kabulünde Nantes başlangıçta limansızdı. Tamamlanma Nantes kara/su terminalini üretti, SEA koridoru `20 → 21` oldu; sicil `216` SEA segmenti ve `31` `PORT_ACCESS` taşıdı, başarısız deniz koridoru `0` kaldı. Save/load sonrasında aynı liman gereksinimi ve onaylı fiziksel hücre zinciri birebir korundu.
- HXD-7.4.2 inşa motorunun açık borcu artık oyuncu/AI başvuru ve ilerleme yüzeyidir. Sıradaki **HXD-7.4.3**, rol/yetki projeksiyonuna göre güzergâh seçimi, eksik izinlerin açıklanması, maliyet/süre önizlemesi, başlatma ve şantiye ilerlemesini UI ile eyleme açar.

## HXD-7.4.3a — oyuncu altyapı proje yüzeyi (`implemented-first-vertical`)

- Ekonomi panelinin `LOJİSTİK` sekmesi artık yalnız koridor verisi okumuyor. Yürütme rolü önce LAND/RAIL/SEA türünü, sonra en yakın yerli hedeflerden birini seçerek fiziksel güzergâh taslağı açabilir. Bilgi kalabalığı yaratmamak için 30 birleşik seçenek yerine iki kademeli `3 mod → en fazla 10 hedef` akışı kullanılır.
- Taslak gerçek hex kenar sayısını, süreyi, devlet kredisi maliyetini, işgücünü, malzeme kalemlerini, yeni liman sayısını ve fiziksel/yetkisel engelleri gösterir. Devlet nakdi, bölgesel stok ve ayrılabilir işgücü de başlatma tıklamasından önce ölçülür; eksik kaynak kalem/gerçek mevcut/gereken miktarla görünür ve düğme kapalı kalır.
- Komutan, ajan ve şirket rolüne yürütme imzası veya devlet bütçesi uydurulmaz. Yabancı bölgeden geçen rota otomatik hak üretmez; `FOREIGN_RIGHT_OF_WAY_REQUIRED` ile bloke olur. Yürütmenin kendi ülkesindeki rota gerçek iş emrine ve şantiyeye girer; açık emirlerin yüzde ilerlemesi, kalan günü ve durumu aynı panelde görünür.
- Runtime kabulünde varsayılan komutan rolü `EXECUTIVE_ROLE_REQUIRED` ile kilitlendi; yürütme Ankara çıkışında `24` yerli hedef gördü. Ankara–İzmir RAIL taslağı `10` kenar, `60` gün, `250` devlet kredisi, `100` işçi olarak hesaplandı; gerçek bölgesel hammadde/parça açıkları başlatmadan önce gösterildi.
- Bu ilk dikeyde açık bırakılan yabancı geçiş, ölçeklenen hedef arama ve aynı API'yi kullanan ekonomik AI başvurusu HXD-7.4.3c/d ile kapandı. HXD-7.4.3 bütününde kalan tek kabul borcu gerçek Electron ekranındaki piksel/taşma/tıklama denetimidir.

## HXD-7.4.3b — şirket teklifi, escrow ve yürütme kararı (`implemented`)

- Şirket sahibi/yöneticisi artık devlet bütçesi veya yürütme imzası taklit etmez. Yerli fiziksel rota taslağını kendi şirketi adına teklif eder; teklif anında yalnız hesaplanmış nakit `ASSET:CASH → ASSET:PROJECT_ESCROW` fişiyle bloke edilir. Kamuya ait bölgesel malzeme ve işgücü yürütme kararından önce tüketilmez.
- Teklif `PENDING_EXECUTIVE`, `RESOURCE_BLOCKED`, `COMMAND_CREATED`, `REJECTED` veya `CANCELLED` durumuyla kalıcı dosyada tutulur. Yalnız aynı ülkenin doğrulanmış `EXECUTIVE` aktörü karar verebilir. Red escrow'u şirkete bir kez iade eder; tekrarlanan red ikinci ödeme üretmez.
- Onay güzergâhı, kurum kararını, mevcut stok ve işgücünü yeniden ölçer. Kaynak yetersizse escrow korunur ve dosya `RESOURCE_BLOCKED` kalır. Kaynak sağlandığında aynı onay yeniden denenebilir; başarılı karar mevcut escrow'u ikinci kez çekmeden malzeme rezervasyonu ve fiziksel `IN_PROGRESS` rota emri üretir.
- Ekonomi/Lojistik paneli şirket rolünde teklif dosyasını ve escrow bedelini, yürütme rolünde ise onay/red düğmelerini gösterir. Şirket, gelecekteki kamu malzemesi eksikken nakit güvenceli teklif verebilir; şirket nakdi eksikse gönderim kapalıdır.
- İzole kabulte 2 kenarlı LAND teklifi `32` şirket nakdini escrow'a aldı, onay öncesi `100/100` hammadde/parçaya dokunmadı; yürütme onayında stok `94/96` oldu ve nakit ikinci kez düşmedi. Red senaryosu `68+32 escrow → 100+0` döndü. Save/load teklif–komut bağını korudu. Gerçek hikâye runtime kabulü şirket rolü → teklif → yürütme paneli → kaynak sağlama → fiziksel şantiye zincirini geçti.

### HXD-7.4.3b.1 — harita varlığı Bölge dosyası (`implemented`)

- Sağdaki `BÖLGE` sekmesi yalnız seçili şehir düğümünü göstermiyor. Normal harita tıklaması fiziksel altıgeni çözüp şehir, ilçe veya tesis bağlamını koruyor; şehir ikonu her zaman şehir dosyasına öncelik veriyor.
- Tesis dosyası bağlı şehir, tesis türü, gerçek işletmeci şirket, kapasite, çalışma durumu ve şirket sicilindeki baz puan ortaklık dağılımını gösterir. Yüzdeler UI tarafından uydurulmaz: örnek başlangıç şirketi `%88 yerli özel / %12 kamu` kaydını aynen projekte eder.
- İlçe dosyası arazi kullanımını, o altıgendeki gerçek yapı/tesis sayısını, şehir nüfusunu ve bölgesel kullanılabilir işgücünü gösterir. İlçe bazlı nüfus muhasebesi henüz yoksa şehir nüfusunu ilçe nüfusu gibi sunmaz; bu eksikliği açıkça yazar.
- Şehir dosyası nüfus, işgücü, garnizon ve yerel makamı giriş yapmadan gösterir; `ŞEHRE GİR` eylemi aynı seçili şehri mevcut şehir yönetim panelinde açar. Faz 35 öncesindeki kolektif `Yerel İdareler Kurulu`, kişisel belediye başkanıymış gibi gösterilmez ve geçici model etiketi taşır.
- İzole UI kabulü şehir/ilçe/fabrika üç görünümünü, `%88/%12` ortaklık dönüşümünü, altıgen→bölge seçimini ve şehir giriş eylemi işaretini doğruladı. Tarayıcı tabanlı gerçek ekran kabulü bu ortamın Windows tarayıcı sandbox bağlantısı kurulamadığı için açık görsel borç olarak kalır.

## HXD-7.4.3c — yabancı geçiş hakkı sözleşmesi (`implemented / open-electron-visual-acceptance`)

- Yabancı altıgenden geçen LAND/RAIL/SEA taslağı artık yalnız `FOREIGN_RIGHT_OF_WAY_REQUIRED` metniyle bitmiyor. Her yabancı bölge için rota kimliği, başvuran aktör/ülke, hedef ülke, teklif edilen tazminat ve kaynak kanıtı taşıyan kalıcı `rightOfWayRequests` dosyası açılabilir.
- Başvuru `INFRASTRUCTURE_DOSSIER`, `CONVERSATION` veya `NEGOTIATION_CASE` kaynak kimliği olmadan açılamaz. Bu kaynak yalnız talebi kanıtlar; LLM veya konuşma cümlesi izin vermez. Dosya başlangıçta `PENDING_FOREIGN_EXECUTIVE` durumundadır.
- Yalnız hedef ülkeyle aynı `countryId` taşıyan doğrulanmış `EXECUTIVE` aktörü kabul/red verebilir. Kabul `GRANTED` ve rota-özel `right-of-way-grant` kanıtı üretir; SEA için aynı karar yabancı liman erişim kanıtını da taşır. Yanlış devlet, şirket, komutan veya tekrar karar denemesi reddedilir.
- Oyuncu rota çözücüsü yalnız aynı rota, yabancı bölge ve başvuran ülke üçlüsüne ait gerçek `GRANTED` kaydını kanıt olarak kullanır. İzin verildiğinde kabul edilen tazminat güzergâh gereksiniminin nakit maliyetine eklenir; taslak her panel yenilemesinde izin sicilinden yeniden çözülür.
- Ekonomi/Lojistik UI, yabancı geçiş dosyalarını bölge bazında `GEÇİŞ HAKKI YOK / YABANCI YÜRÜTME KARARI BEKLİYOR / GEÇİŞ HAKKI VERİLDİ / TALEP REDDEDİLDİ` olarak gösterir ve ilk mekanik tazminat teklifiyle diplomatik dosya açar.
- Tamamlanma mali kapanışı proje nakdini ve yabancı tazminatını ayrı kalıcı aşamalar olarak izler. Şirket finansmanında tazminat piyasa takas havuzuna eklenmez; doğrudan hedef devlet bütçesine gelir fişi olur. Hedef hazine geçici hata verirse escrow ikinci kez kapanmaz, yalnız ödenmemiş satır yeniden denenir; ödenmiş veya tamamlanmış rota ikinci ödeme üretmez.
- Yabancı AI yürütmesi aynı `storyInfrastructureRightOfWayDecide` kapısından geçer. En az sekiz saniyelik inceleme sonrasında diplomatik ilişki, kişisel güven/husumet, antlaşma/savaş durumu, piyasa güveni, rota türü ve teklif edilen bedelin açıklanabilir bileşenleriyle kabul/red verir. Aktif savaşın güvenlik cezası yüksek bedelle satın alınamaz; oyuncu ülkesinin kararı AI tarafından alınmaz. LLM sayı veya karar üretmez.
- Kabul kararı varsayılan beş yıllık `validUntil` taşır; karar açıkça süresiz de verilebilir. Süresi dolan kayıt ilk kullanımda `REVOKED/EXPIRED` olur ve yeni rota taslağına kanıt sağlayamaz. Hedef ülkenin doğrulanmış yürütmesi ayrıca gerekçeli geri alma yapabilir; başvuran devlet kendi iznini geri alamaz. Başlamış fiziksel şantiyeyi geriye dönük yok etmek bu sözleşmenin kapsamı değildir.
- Konuşma veya müzakere kimliği artık salt metin olarak kabul edilmez. Kayıt gerçekten var olmalı; başvuran aktör taraflardan biri, karşı aktör hedef ülkeye bağlı olmalı ve oyuncunun panel seçimi kanıtı aynı rota anahtarı+yabancı bölgeye açıkça bağlamalıdır. Oyuncunun taraf olmadığı veya başka ülkeye ait kayıt aday listesine sızmaz. Rota paneli en fazla sekiz doğrulanmış görüşme/müzakere adayını gösterir ve seçilen kaynağı talep dosyasında saklar.
- AI skoru olumlu değil ama barışta pazarlığa elverişli `[-20, 0)` aralığındaysa `COUNTERED` durumunda daha yüksek bedel önerir. Bu öneri kendiliğinden izin değildir: yalnız başvuran ülkenin yürütme/şirket yetkilisi kabul ederse `GRANTED` kanıtı ve yeni maliyet oluşur; red dosyayı kapatır. Savaş güvenlik cezası karşı teklif üretmez.
- İzole kabul: transit yabancı bölge için kanıtsız ve rota-bağsız sahte dosyalar reddedildi; oyuncunun taraf olmadığı iki kayıt filtrelendi; hedef yürütme `60` krediyle izin verdi; ilk hazine hatasından sonra ödeme güvenle tamamlandı; dost politika skoru `49` ile kabul, savaş skoru `-121` ile red, orta risk skoru `-10` ile `50` kredi karşı teklif verdi. Oyuncu kararı beklemede kaldı ve açık `0` bedelli izin korundu. Kara/demir, deniz, şirket escrow ve gerçek oyuncu UI regresyonları geçti.
- Mekanik HXD-7.4.3c sözleşmesi tamamlandı. Bu ortamda bağlı tarayıcı Windows sandbox bağlantısı kurulamadığından gerçek Electron piksel/taşma/tıklama kabulü açık görsel borçtur; kod/DOM kabulü bu borcu kapatmış sayılmaz.

## HXD-7.4.3d — ölçeklenen hedef seçimi ve ekonomik AI başvurusu (`implemented / open-electron-visual-acceptance`)

- Oyuncu güzergâh yüzeyi artık en yakın ilk on hedefte kesilmez. Oyuncunun yetkisi içindeki bütün meşru hedefler DOM'da aranabilir kalır; boş aramada en yakın `12`, metin aramasında en fazla `24` eşleşme gösterilir. Türkçe aksan ayrıştırması arama için normalize edilir, gerçek hedef kimliği değişmez.
- Filtreleme her tuşta ekonomi/şehir panelini yeniden çizmez. Mevcut hedef düğümlerinin `hidden` durumu yerinde değiştirilir; sorgu `64` karakterle sınırlı geçici UI durumunda tutulur ve zorunlu panel yenilenmesinden sonra aynı görünüm yeniden kurulur.
- İzole oyuncu UI kabulü Ankara için `24` yasal hedefin tamamının seçilebilir kaldığını, varsayılan görünümün `12` hedefle sınırlı olduğunu ve `İzmir` aramasının doğru fiziksel bölge kimliğini görünür tuttuğunu doğruladı.
- Ekonomik şirket AI'si her `90` dünya gününde en fazla iki başvuru üretir. Şirketin gerçek tesis bölgeleri başlangıç noktasıdır; kendi ülkesindeki hedefler sektörle eşleşen kıtlık, toplam lojistik baskı, nüfus ve mesafe bileşenleriyle sıralanır. Şirket başına en fazla sekiz fiziksel aday denenir ve ihtiyaç skoru `600` altında kalan gerekçesiz ağ genişlemesi escrow harcayamaz.
- Aday gerçek LAND/RAIL patikasından, mevcut koridor çakışmasından, çevre kararından, izinlerden ve şirket hesabından geçer. Kabul edilen teklif `storyInfrastructureRouteSubmitCompanyProposal` üzerinden gerçek şirket nakdini proje escrow'una taşır. Oyuncunun yönettiği şirket aday havuzundan çıkarılır; AI için ücretsiz nakit, görünmez rota veya ayrı inşaat API'si yoktur.
- Fiziksel yol yabancı bölgeden geçiyorsa AI proje uydurmaz; aynı kalıcı geçiş hakkı dosyasını açar. Yabancı yürütmenin karşı teklifini başvuran AI şirketi kendi ödeme tavanına göre aynı yanıt API'sinden kabul veya reddeder. Verilmiş izin sonraki çevrimde rota adayına bağlanır.
- AI kaynaklı teklif oyuncu ülkesindeyse yürütme kararı otomatik verilmez ve Ekonomi/Lojistik panelinde `AI ŞİRKET BAŞVURUSU`, gerekçe, skor, kıtlık ve escrow ile görünür. AI ülkesindeki yürütme ise aynı onay/ret kapısından geçer; malzeme veya işgücü eksikse teklif `RESOURCE_BLOCKED` kalır, kaynak yaratılmaz.
- En fazla `240` açıklanabilir başvuru, geçiş, karşı teklif ve yürütme inceleme kararı kalıcı `aiRouteDecisions` defterinde tutulur; sayaç ve geçmiş save/load sonrasında korunur.
- Gerçek kampanya kabulü, açık kıtlık baskısında `company:0:agriculture` için `6400` skorla LAND teklifi üretti; şirket nakdi azaldı, proje escrow'u arttı, oyuncu yürütme kararı atlandı ve AI yürütmesi aynı teklifi gerçek şantiye komutuna çevirdi. Gerekçesiz `score: 0` genişleme ilk denemede reddedilip `600` eşiğiyle kapatıldı. Tüm oyuncu UI, şirket escrow ve yabancı geçiş regresyonları geçti.
- Mekanik HXD-7.4.3d tamamlandı. Gerçek Electron görsel kabulü HXD-7.4.3c ile ortak açık borçtur.

## HXD-3.1 ara kabul — üyelik ve fiziksel sınır

- `js/StoryHexRegions.js`, `story-hex-regions-1` salt-okunur sidecar'ıyla `152/152` eski idarî kimliği korudu. `7.517` kara/kıyı hücresinin tamamı atandı; sahipsiz hücre ve temsil edilmeyen bölge sayısı sıfırdır. Bölge kümeleri `3–459` hücre aralığındadır.
- Bölge→hücre üyeliği, bölge→fiziksel komşu ve `2.953` gerçek ortak sınır kenarı ayrı typed-array/CSR dizinleridir. Toplam yük `66.667 bayt`, ilk runtime kurulum yaklaşık `152,7 ms`, üyelik karması `fnv1a32:542d7b75`tir.
- Yeni raster geometrisi `362` fiziksel komşu çifti; eski `node.neighbors` ise `177` mantıksal bağlantı çifti verdi. Yalnız `141` çift ortaktır (`221` yalnız fiziksel, `36` yalnız eski). Bu fark hata diye gizlenmedi: fiziksel sınır ile ulaşım/oyun bağlantısı farklı gerçeklerdir ve birbirinin üstüne yazılmayacaktır.
- Sidecar kurulumu canlı dünya karmasını ve prob başlangıcındaki nüfus, servet, tesis, garnizon toplamlarını değiştirmedi. Aynı girdide aynı checksum, cache kimliği, bütün bölgelerin temsili, CSR sayım korunumu ve üç bozuk üyelik/sayaç/hash ret kapısı geçti. `npm run story:hex-regions-test` çıkış kodu `0`dır.
- HXD-3.1 ara kabul anında hücre tabanlı sahiplik, kapsamlı ekonomi-varlık mutabakatı ve kayıt/göç geri dönüş kapısı açık bırakılmıştı; çalışan canlı `STORY.nodes` değiştirilmedi. Bu borçlar aşağıdaki HXD-3.2 kabulünde kapatıldı.

## HXD-3.2 kabul — politik sahiplik ve kayıpsız mutabakat

- `StoryHexRegions.js` içindeki `story-hex-political-view-1`, `7.517` atanmış kara/kıyı hücresinin tamamına canlı bölge sahibinden ülke kimliği türetti. Sahipsiz atanmış hücre yoktur; farklı ülke sahipli komşular arasında `460` fiziksel devlet sınırı kenarı oluştu. Politik diziler `32.056 bayt`, sahiplik karması `fnv1a32:a31ecf84`tür.
- Mevcut `1640×1290` piksel politik overlay HXD-5 öncesinde görsel biçimini korudu fakat artık `hexMembershipHash` ve `hexOwnershipHash` taşır. Raster ve altıgen bölge sahip tabloları birebir eşleşti; fetih sonrası cache/yeniden üretim `politicalOverlayProbe` regresyonunda geçti.
- Kaynak dünya ile yalnız temsil edilen altıgen bölge kimliklerinden yeniden kurulan projeksiyonun mutabakat karması iki tarafta da `fnv1a32:3d72d471` oldu. Kapsam: `2.976.000` kişi, sekiz stok, `48` şirket, `8` banka, `423` tesis, `152` depo, şirket/banka/devlet/takas nakdi ve `591` altyapı koridorudur. Eksik nüfus/stok bölgesi veya bozuk tesis/depo bölge referansı sıfırdır.
- Bozuk hücre sahibi, sahte devlet sınırı ve bozuk sahiplik checksum'ı reddedildi. Türetilmiş üyelik/sahiplik kayıt dosyasına yazılmadı; save/load sonrasında üyelik, sahiplik ve mutabakat karmaları birebir yeniden oluştu. HXD-3 kalıcı ikinci gerçek kaynağı yaratmadan tamamlandı.
- `story:hex-reconciliation-test`, `politicalOverlayProbe`, sözdizimi ve `git diff --check` geçti. Tam regresyon bu dilimde yeniden çalıştırılmadı. Sıradaki aşama **HXD-4 — 152 şehir çekirdeği ve kıyı limanlarının fiziksel altıgenlere göçü**dür.

## HXD-4 kabul sonucu — şehir ve liman göçü

- `js/StoryHexSettlements.js`, `152/152` şehir kimliğini kendi idarî bölgesindeki benzersiz ve geçilebilir kara çekirdeğine bağladı. Geometrik ankrajı geçersiz olan `17` şehir deterministik taşındı; en büyük mesafe Beyrut'ta `32,796` dünya birimidir. Denizde veya geçilemez dağda şehir sayısı sıfırdır.
- Kıyı mesafesi içinde kalan veya mevcut deniz koridoru nedeniyle zorunlu olan `59` şehir, ayrı kara + komşu seyredilebilir su kenarından oluşan `58` fiziksel terminale bağlandı. Eski 20 deniz hattının `29` tekil şehir ucunun tamamı liman hizmeti taşır; eksik zorunlu liman yoktur.
- Fiziksel terminal ve şehir hizmeti ayrıldı. Beyrut ile Tel Aviv aynı kara/su terminalini kullandığı için tesis yalnız bir kez kayıtlıdır; iki şehir aynı `terminalId` üzerinden hizmet alır.
- Kaynak geometri borcu açık tutuldu. İzmir'in kendi bölgesinde, Beyrut'un ise uygun mesafe içinde kendi bölgesinde kıyı terminali yoktur. Çalışan deniz hatlarını silmek veya rasterı yeniden boyamak yerine İzmir Bursa terminaline `101,944`, Beyrut Tel Aviv terminaline `89,530` birim mesafeyle `LEGACY_GEOMETRY_FALLBACK` olarak bağlandı. Bu iki kayıt ileride kaynak coğrafya düzeltildiğinde kaldırılacak borçtur.
- Ankara `hex:42:63` ve limansız; İstanbul `hex:38:61` çekirdeğiyle komşu `hex:38:60` su terminalindedir. Yerleşim typed-array yükü `3.648 bayt`, kaynak karması `fnv1a32:8bc563a0`, yerleşim karması `fnv1a32:16e636c9`dur.
- Sidecar canlı dünya durumunu değiştirmedi ve save dosyasına yazılmadı; kayıt/yüklemede birebir yeniden türedi. Geçersiz şehir çekirdeği, liman su ucu, zorunlu liman ve checksum karşı-testleri reddedildi. `story:hex-settlements-test`, sözdizimi ve diff denetimi geçti; tam regresyon yeniden çalıştırılmadı.
- HXD-4 `completed_with_source_debt` olarak kapandı. Sıradaki aşama **HXD-5 — altıgen render, seçim ve uzak/orta/yakın LOD**dur.

## HXD-5.1 ara durum — tek şehir/terminal konum kaynağı

- `storyHexSettlementNodePosition`, şehir dünya konumunun tek adaptörü oldu. Şehir sprite'ı, kamera merkezleme, konsey/panel odağı, yedek tıklama testi, yerleşim ilçeleri ve birincil/ikincil yol uçları HXD-4 çözülmüş çekirdeğini kullanır; `lx/ly` yalnız hata/rollback fallback'idir.
- Eski görsel deniz ağı, büyük şehir çevresinde sekiz hücre kıyı arayıp kendiliğinden hat uyduruyordu. Bu yol HXD sidecar mevcutken kullanılmaz: `59` şehir hizmeti `58` fiziksel terminalden, çizilecek bağlantılar ise `STORY_INFRASTRUCTURE_SEA_LINKS` içindeki mevcut `20` hattan gelir.
- Bütün `152` render ankrajı kendi çözülmüş hücre merkeziyle `0,0001` toleransta eşleşti. `story:map-v2-test`, `story:hex-settlements-test`, sözdizimi ve diff denetimi geçti.
- Bu ara kabul HXD-5'i kapatmaz. Arazi/politik rasterın hücre geometri çizimi, doğrudan altıgen hücre seçimi, LOD kalabalık/etiket bütçesi, gerçek EXE ekran görüntüsü ve p95 kare süresi hâlâ açıktır.

## HXD-5.2 ara durum — altıgen sahiplik, hit-test ve yakın LOD grid'i

- Canlı `storyEnsureOwnerOverlay`, eski piksel-Voronoi siyasi boyamasından önce `hex-political-overlay-canvas-1` adaptörünü kullanır. Mevcut arazi sanatı korunur; üstündeki ülke tint'i `7.517` atanmış altıgen hücrenin gerçek köşelerinden oluşur.
- Politik model `fnv1a32:1ee6a11a` dünya yerleşimi, `fnv1a32:542d7b75` üyelik ve `fnv1a32:a31ecf84` sahiplik karmalarına bağlıdır. Başlangıç render karması `fnv1a32:14f46a5b`dir. Sahiplik değişimi model/cache karmasını değiştirdi; geri alma aynı karmayı yeniden üretti.
- `460` devlet sınırı maskesi ortak altıgen kenar başına yalnız bir stroke üretir. Kanonik `1640×1290` canvas `8` sahip grubu halinde çizilir; hedefli gerçek build ölçümü `6,729 ms`, dış harness duvar süresi `130,348 ms` oldu.
- Harita tıklaması artık önce dünya koordinatını kanonik altıgen hücreye çevirir. Atanmış kara hücresi doğru `regionId` verir; su hücresi `-1` ile reddedilir. Eski raster seçici yalnız rollback fallback'idir.
- Yakın görünümde altıgen grid `4,2×` LOD oranında açılır; hover aynı hücre kimliğini vurgular. Görünür-hücre çözümleyicisi satır/ofset culling kullanır: `1100,800 → 1700,1300` örnek penceresinde `506/10.584` hücre işlendi.
- `story:hex-render-test`, `story:map-v2-test`, mevcut `politicalOverlayProbe`, HXD-4 regresyonu, sözdizimi ve diff denetimleri geçti. HXD-5 henüz kapanmadı; sıradaki iş arazi sanatının hücre kaynak eşlemesi ve üç LOD seviyesinin gerçek EXE görsel/p95 kabulüdür.

## HXD-5.3 kapanış — gerçek EXE LOD ve render bütçesi

- Arazi hücre semantiği `fnv1a32:160c78e9` kanonik raster kaynağı ve `fnv1a32:76d987bd` coğrafya karmasına bağlandı. Orta görünümde viewport culling `307` hücreyi (`244` kara / `63` su), yakın görünümde `73` kara hücresini çizdi; grid ve politik çokgenler aynı dünya dönüşümünü kullandı.
- `--maptest` gerçek Electron çalıştırıcısı üç LOD için 45'er senkron kare, katman p95'leri, 15 şehir hit-test'i, ekran görüntüsü ve renderer konsol hatalarını kaydetti. Kanonik `1640×1290` politik canvas ilk EXE yapımı `35,1–55,1 ms`; belgede daha önce geçen `6,729 ms` yalnız izole headless çizim maliyetidir.
- İlk katman profili uzak/orta/yakın toplam p95'i `349,9 / 438,7 / 406,0 ms` ölçtü. Yeni altıgen/politik katman darboğaz değildi: eski ağ çizimi `199–221 ms`, yerleşimler `108–205 ms`, komutanlar `34–39 ms` tüketiyordu.
- `network-screen-layer`, `settlement-screen-layer-1` ve `commander-screen-layer-1` aynı kamera/dünya sürümü boyunca tekrar kullanılır; kamera, atlas, sahiplik, şehir kapasitesi, komutan konumu veya merkezî harita revision'ı değiştiğinde anahtar yenilenir. Saldırı halkası ve konsey nabzı önbelleğe gömülmedi, her kare canlı kalır.
- Yoğun sistem yükündeki muhafazakâr gerçek EXE p95 uzak/orta/yakın `22,2 / 20,3 / 19,0 ms`, ortalama `15,084 / 13,482 / 12,520 ms` oldu. Son otomatik kabul koşusu p95'i `7,5 / 7,5 / 6,0 ms` ve ortalamayı `6,367 / 5,836 / 5,158 ms` ölçtü. `--maptest`, `33,4 ms` p95 veya `0,001` üstü seçim hatasında artık sıfırdan farklı çıkış verir. On beş seçim örneğinde ortalama/maksimum hata `0/0`, konsol problemi `0`dır.
- `qa-runtime/hxd5-perf3` uzak, orta ve yakın saf harita kanıtlarını içerir. Görsel inceleme şehir/etiket, yol, kıyı, politik altıgen ve LOD grid hizasının korunduğunu doğruladı. `story:hex-render-test`, `story:map-v2-test`, sözdizimi ve diff denetimleri geçti.
- HXD-5 tamamlandı. Sıradaki aşama **HXD-6 — nüfus, teknoloji, yapı ve arazi kapasitesiyle dinamik büyüyen şehir çekirdeği**dir.

## HXD-6.1 ara durum — nüfus ve binadan türeyen fiziksel şehir ayak izi

- `js/StoryHexUrban.js`, `story-hex-urban-footprint-1` sidecar'ını ekledi. Bütün `152` şehir HXD-4 çekirdeği, kanonik nüfus sicili, zenginlik, altı bina yatırımı, liman hizmeti ve geçilebilir kendi-bölge arazisinden deterministik olarak türetilir; kalıcı dünyayı değiştirmez ve save dosyasına yazılmaz.
- Başlangıç ayak izi `574` benzersiz hücredir: `152` çekirdek, `196` konut, `81` sanayi, `44` sivil, `44` savunma, `57` lojistik. `sourceHash fnv1a32:84ac5930`, `footprintHash fnv1a32:4999e71a`, typed-array yükü `2.028 bayt`tır.
- Nüfus sicili mevcutken legacy `level` değişimi ayak izini değiştirmez; gerçek fabrika yatırımı checksum ve ilçe dağılımını değiştirir. Girdi geri alındığında checksum birebir döner. Başlangıçta `LEGACY_LEVEL_POPULATION_FALLBACK` kullanan şehir `0`dır.
- İstenen `425` ilçenin `422`si fiziksel karaya yerleşti. Beyrut ve Tel Aviv bölgelerinde çekirdek dışında yalnız birer geçilebilir hücre bulunduğu için toplam `3` ilçe başka bölgeye taşınmadı; `truncatedCityNames` ve `unallocatedDistrictCount` ile açık kaynak borcu kaldı.
- Orta/yakın görünümde eski radyal/rastgele ekran saçılımı yerine her ilçe kendi gerçek altıgen merkezinde çizilir. Coğrafi adaylar tek geçişte şehir bazında gruplanır: soğuk prob `147,158 ms`, nüfus/bina değişimi sonrası sıcak rebuild `2,370 ms`, değişmeyen cache kontrolü `1,101 ms`dir. Gerçek Electron p95 uzak/orta/yakın `8,7 / 8,1 / 7,9 ms`; seçim hatası ve konsol problemi `0`dır.
- `story:hex-urban-test`, HXD-5 maptest kapısı ve harita V2 regresyonu geçti. HXD-6 açık: sıradaki iş fiziksel konut/lojistik inşa emrinin bedel, süre, kapasite ve dossier açıklamasıdır.

## HXD-6.2 ara durum — şehir zoom hiyerarşisi ve etkileşim performansı

- Kullanıcının beş yakın/orta harita yakalaması ölçek hatasını kesinleştirdi: eski şehir eğrisi altıgen ekranda on iki kattan fazla büyürken başkenti yalnız `32 → 58 px` büyütüyordu. Şehir matematiksel olarak büyüse bile bulunduğu hücreye göre küçülüyordu.
- Yeni nüfus/ayak izi güdümlü görsel kademe uzak/orta/yakında tier-1 için `10 / 25 / 36`, tier-2 için `23 / 57 / 82`, tier-3 için `32 / 80 / 114 px` üretir. İlçeler de büyür fakat merkezden küçük kalır. `node.level` yalnız HXD-6 kaydı yoksa fallback'tir.
- Kamera sürükleme ve tekerlek girdileri `requestAnimationFrame` ile birleştirildi. Kıyı, yol/liman, şehir/etiket ve komutan ekran katmanları etkileşim sırasında oluşturuldukları kameradan dönüştürülür; her mouse olayında tekrar rasterize edilmez.
- Son gerçek Electron kanıtı `qa-runtime/city-lod-perf-final-2/`: sabit uzak/orta/yakın p95 `10,8 / 14,6 / 10,8 ms`, etkileşim p95 `10,8 ms`, `36/36` örnekte üç pahalı katman da yeniden kullanıldı. Üç koşunun aralığı `4,5–10,8 / 6,0–14,6 / 5,3–10,8 ms`, etkileşim `4,5–12,2 ms`dir. Hit-test ortalama/maksimum `0 / 0 px`, `MAPTEST_PROBLEMS []`.
- Etkileşim sonunda kesin uzlaşma CPU yüküne göre `163,2–369,3 ms` tek kare ister; son koşu `network 230,0`, `settlement 93,4`, `commander 30,6 ms` ölçtü. Bu HXD-7 segment/tile önbelleğine taşınacak açık P1 borcudur; genel p95 iyileşmesi bu borcu gizlemez.
- Kanonik araziye gömülü ve liman çevresindeki statik dekor gemileri kaldırıldı. Tır/tren/gemi/uçak ancak HXD-9/HXD-12'de gerçek sevkiyat ve `TransportAgentV1` kaydıyla geri gelebilir. Karakterlerin fiziksel seyahati/ETA/araç bağı HXD-14 kabulüne eklendi.
- HXD-6 açık kalır: sıradaki iş fiziksel konut/lojistik inşa emrinin maliyet-süre-kapasite zinciri ve şehir siluetinin nüfus, bina bileşimi ve teknoloji çağına göre daha fazla gerçek çeşit üretmesidir.

## HXD-6.3 ara durum — kalıcı şehir bitmapleri ve mevcut tesislerin fiziksel göçü

- Şehir/ilçe kompozisyonu kamera kovasına bağlı ekran canvas'ı olmaktan çıkarıldı. `CORE` ve `DISTRICTS` dünya katmanları yalnız kaynak karma veya teknoloji görsel dönemi değiştiğinde bir kez üretilir; `1024 px` RAM karolarına ve çözülmüş `ImageBitmap` kaynaklarına ayrılır. Kamera/zoom yalnız görünür kaynak dikdörtgenlerini kopyalar. Şehir dünya koordinatları da aynı katmanda saklandığı için kare başına `152` kez yerleşim modeli/hash hesabı yapılmaz.
- Gerçek Electron sürükleme probunda kadro dışındaki Dublin fare bırakılmadan çizildi. İlk ve tekrar sürükleme karesinde yeni şehir üretimi `0/0`, katman üretim seri numarası `1`, tekrar RAM isabeti `224`, bitmap yükü yaklaşık `56,64 MB` ve seçim round-trip hatası `0/0 px`tir. Eski per-city sprite üretim yolu etkin koddan kaldırıldı.
- Ağır eşzamanlı sistem yükünde şehir yolu `100–130 ms`den yaklaşık `9–12 ms` p95'e, toplam kare ortalaması `17,48–19,59 ms` aralığına indi. Uzak/orta/yakın toplam p95 `26,1 / 24,2 / 22,8 ms`, etkileşim p95 `23,4 ms` kaldı; kesin `16,7 ms` kapısı geçmedi. Hazır şehir bitmap kopyası yaklaşık `0–0,1 ms`, canlı overlay yaklaşık `0,4 ms` olduğundan kalan ana maliyet 2× doğal yüzey ve compositor yüküdür; 60 FPS borcu kapanmış sayılmaz.
- `story-hex-land-use-sites-2`, mevcut ekonomi defterindeki tesisleri yeni kapasite yaratmadan fiziksel alana göç ettirir. Hazır sanayi/savunma ilçesi doluysa yalnız aynı idarî bölgedeki en yakın boş, geçilebilir, en az `%50` kara, orman/dağ/maden olmayan hücre `EXISTING_FACILITY_MIGRATION` kaynağıyla imara açılır. Başka bölgeye taşıma, iki tesisi tek hücreye yığma ve tarım kanıtı uydurma yasaktır.
- Gerçek başlangıç dünyasında `115` ilave göç hücresiyle fiziksel site sayısı `147→262`, arazi sicili `597→712` oldu. `124` adet `NO_FREE_COMPATIBLE_SITE_SLOT` borcu `9`a düştü. Kalan dokuz tesis kendi bölgesinde uygun hücre bulamadığı için zorlanmadı; `152` tarım tesisi de `SOIL_AND_CROP_EVIDENCE_REQUIRED` durumunda kaldı. Toplam `423` tesisin `262`si yerleşmiş, `161`i gerekçeli açık borçtur.
- Sıradaki HXD-6 dilimi mevcut tesis göçü değildir: oyuncu/AI tarafından başlatılan yeni konut, sanayi ve lojistik imarı için hedef hücre, arazi edinimi, izin/yetki, malzeme, iş gücü, süre, çevresel bedel, inşaat durumu ve tamamlanma makbuzu taşıyan kalıcı komut sözleşmesidir. Dokuz yetersiz bölge ancak bu bedelli yeniden imar/kentsel dönüşüm yolu veya kaynak coğrafya düzeltmesiyle çözülebilir.

## HXD-6.4 kabulü — kalıcı RAM harita katmanları ve 60 FPS kapısı

- Doğal altıgen yüzey `6000×4720` geçici üretim canvas'ından `30` adet `1024 px` `ImageBitmap` karosuna taşınır; bitmapler hazır olunca büyük üretim yüzeyi bırakılır. Şehir/ilçeler gibi kamera yalnız görünür karo kesitlerini çizer. Doğal yüzeyin çözülmüş RAM yükü `113,28 MB`dir.
- Kara/deniz yolları ile limanlar `OVERVIEW/LOCAL`, kıyı çizgisi `OVERVIEW/LOCAL`, siyasi sınır tek dünya katmanı olarak bir kez rasterize edilir. Bu seyrek katmanlar yarım çözünürlüklü kalıcı RAM karolarıdır: ağ `14,16 MB`, kıyı `14,16 MB`, sınır `7,08 MB`. Kamera konumu, sürükleme veya zoom bu katmanların anahtarını değiştirmez. Sınır yalnız sahiplik karması; ağ yalnız yerleşim/altyapı/liman ve atlas gerçeği değiştiğinde yenilenir.
- Ana şehir çekirdeği 4× kalırken ilçe kompozisyonu 8× çözünürlüğe çıkarıldı (`settlement-world-layers-4-core4x-district8x`). 8× katman 24.000×18.880'lik boş bir yüzey ayırmıyor; yalnız şehir kümelerinin değdiği 512 px RAM karoları üretiliyor. Böylece ilçe doğrusal çözünürlüğü gerçekten 2 katına çıkarken `CORE + DISTRICTS` yükü `1.128.009.728 bayt`ta kaldı. Geçersiz kılınan eski bitmapler `ImageBitmap.close()` ile bırakılır; kamera/zoom yeniden üretim yapmaz.
- Limanlar 0,5× yol/deniz yolu rasterinden ayrıldı ve fiziksel dünya boyutu değişmeden ayrı 2× seyrek RAM katmanına taşındı. Bu, limanların doğrusal çözünürlüğünü 4 kat artırdı; liman katmanı `17.563.648 bayt`tır. `qa-runtime/map-district-port-resolution-final` gerçek Electron kabulünde uzak/orta/yakın/etkileşim p95 yaklaşık `10,3 / 11,1 / 8,4 / 8,4 ms`, şehir yeniden üretimi `0/0`, sürüklerken görünürlük `true`, hit-test hata ortalama/maksimum `0/0 px`, raster sözleşmesi `district=8 / port=2`, bütün kalıcı katmanlar `1.294.253.376 bayt / 1234,3 MiB`, `MAPTEST_PROBLEMS []` ve sonuç `MAPTEST_OK`tur.
- HXD okunabilirlik yükseltmesi koordinat dünyasını 4500×3540'a taşımadı: bu yaklaşım gerçek Electron ölçümünde `30–36 ms p95` üreterek 60 FPS kapısını bozduğu için geri alındı. Bunun yerine kampanya kamerasının en uzak görünümü ve azami inceleme yakınlığı 1,5× ölçeklendi (`presentationScale=1.5`, `maxZoom=7.5`). Böylece 10.584 hücre, yollar, kıyılar ve save sözleşmesi değişmeden ekrandaki altıgen ile içeriği birlikte 1,5× büyür; oyuncunun gördüğü dünya alanı daha büyük hissedilir. Liman özel rasteri ayrıca 2× daha yükseltilerek 2×'ten 4×'e çıkarıldı. Yoğun arka plan savaş-AI koşusunda sekiz Node işçisi CPU'yu doyurduğu için bu revizyonun 60 FPS kabulü sakin makinede yeniden çalıştırılacak açık QA kapısıdır; birim, HexWorld ve headless render kapıları geçmiştir.
- Canlı komutan/araç, seçim/hover, saldırı halkası ve değişen metin etiketleri statik resme dondurulmaz. Bunlar dünya durumunun kendisidir; yalnız kaynak atlasları ve değişmeyen alt katmanları RAM'de kalır. Bu ayrım hem doğru animasyonu hem de cache'in bayat dünya göstermemesini korur.

## HXD-7.1 ara kabul — kara yollarının altıgen topolojiye bağlanması

- `js/StoryHexRoads.js` GEO yol niyetini doğrudan ekran eğrisine çevirmeyi kaldırdı. Her kara bağlantısı iki şehrin kanonik çekirdek hücresi arasında A* ile çözülür; yalnız ortak kenarlı ve `STORY_HEX_MOVEMENT_LAND` taşıyan hücrelere basabilir. Dağ yoğunluğu ve karma kıyı hücresi maliyete girer, fakat sahte su/dağ geçişi açmaz. Görsel çizgi bu doğrulanmış hücre merkezlerinden geçen yuvarlatılmış rotadır; altıgen topoloji korunurken sert zikzak gösterilmez.
- Gerçek dünya kabulünde `166` kara rotası `987` bitişik hücre adımı üretti. Su/geçilemez adım `0`, komşuluk atlaması `0`; hedefli sentetik prob engelli hücreyi dolaşmayı ve kopuk kara kütlesinde yol uydurmamayı doğruladı.
- Eski GEO_ROADS içinde kara yolu diye duran `7` çift fiziksel kara zinciri üretemedi ve artık kara yolu olarak çizilmiyor: Hamburg–Kopenhag, Paris–Londra, Manchester–Dublin, Napoli–Palermo, Palermo–Tunus, Antalya–Lefkoşa, Lefkoşa–Beyrut. Son dördü mevcut deniz sicilinde; ilk üçü deniz/tünel/köprü türü açık koridor sınıflandırması ister. Bu borç çözülmeden normal kara yolu veya bedelsiz köprü uydurulmayacak.
- `qa-runtime/map-hires-hexroads-final` gerçek Electron kabulü `MAPTEST_OK` verdi. Uzak/orta/yakın/etkileşim p95 `9,2 / 9,6 / 10,1 / 7,1 ms`; şehir tekrar üretimi `0/0`, hit-test hatası `0/0 px`tir. Sıradaki ana borç yeniden HXD-6 fiziksel inşaat emri sözleşmesidir; HXD-7'nin kapasite/bakım/hasar/onarım segmentleri daha sonra devam eder.

## HXD-6.6 ara kabul — kalıcı fiziksel imar ve inşaat komutu

- `js/StoryHexConstruction.js`, `story-hex-construction-command-1` sözleşmesini ekledi. Yeni `RESIDENTIAL / INDUSTRIAL / LOGISTICS` projesi; hedef altıgen ve bölge, başvuran aktör/şirket/devlet, arazi edinim kanıtı, yetkili aktör-kurum-karar üçlüsü, para/malzeme/iş gücü rezervasyonu, süre, kapasite ve çevre değerlendirmesi taşır. Su, geçilemez dağ, yanlış idarî bölge, dolu hücre ve maden yatağı reddedilir; orman için değerlendirme ve azaltım kaydı zorunludur.
- Şirket rezervasyon kapısı arazi bedelini yapım maliyetine ekler, şirket nakdini proje escrow'una ve bölgesel malzemeyi komuta atomik bağlar; ara adım başarısızsa kesintiler geri alınır. Aynı bölgedeki etkin inşaatların iş gücü taahhütleri birlikte sayılır. İptal para ve malzemeyi muhasebe kapılarından iade eder; tamamlanma escrow'u yatırım giderine kapatmadan fiziksel makbuz üretemez.
- Komut `AWAITING_REQUIREMENTS → AUTHORIZED → BUILDING → COMPLETED/CANCELLED` yaşam döngüsüyle gerçek hikâye takviminde ilerler, save/load içinde kalır ve tamamlandığında izin, arazi, tüketim, çevre bedeli ve yaratılan kapasiteyi taşıyan değişmez bir makbuz üretir. `BUILDING/COMPLETED` kayıtları `story-hex-land-use-sites-2` sicilinde `NEW_CONSTRUCTION_COMMAND` kaynaklı gerçek `LandUseCellV1 + PhysicalSiteV1` olur; harita ve simülasyon ayrı gerçeklik tutmaz.
- Hedefli testler; su/dağ/bölge/dolu hücre/maden reddini, eksik yetkinin kendiliğinden onaylanmamasını, önizlemenin dünyayı değiştirmemesini, atomik rezervasyon ve rollback'i, zaman ilerlemesini, tamamlanma muhasebesini, save/load'u ve tek hücre-tek site kuralını doğrular. `story:hex-construction-test`, `story:hex-sites-test`, `story:map-v2-test` ve `story:hex-render-test` geçti.
- Açık borç: oyuncu ve ekonomik AI henüz bu komutu bir imar/başvuru ekranından üretmiyor; yetki kararı Faz 29/33 kurum eylemine, şirket seçimi Faz 22 ekonomik adayına bağlanmalı. Konut kapasitesinin nüfus/konut stokuna, lojistiğin HXD-7/HXD-9 kapasitesine ve sanayinin gerçek şirket tesis/üretim kapasitesine devreye alma makbuzuyla yansıması sıradaki HXD-6.7 dikeyidir. Dokuz yetersiz eski tesis kendiliğinden çözülmüş sayılmaz.

## HXD-6.7 ara kabul — tamamlanan yapının gerçek kapasiteye devreye alınması

- İnşaat defteri bölge başına makbuz kaynaklı `residential / logistics / industrialBySector` fiziksel kapasitesinin tek sahibidir. `BUILDING` durumundaki resim kapasite üretmez; yalnız finansal kapanışı ve devreye alma denetimi geçen `COMPLETED` komut kaynak makbuz kimliğiyle kapasiteye yazılır. Save/load bu toplamları ve kaynak makbuzlarını birlikte korur.
- Konut kapasitesi eski dünyanın `140 bin` uyumluluk nüfus tavanını her tamamlanan kapasite birimi için `5 bin` artırır. Böylece organik nüfus büyümesi konut yapılmadan eski tavanın üstüne çıkamaz; sahte ilçe resmi barınma kapasitesine dönüşmez.
- Sanayi komutu gerçek, lisanslı şirketin sektörünü kullanır. Yalnız `energy / civil_industry / advanced_tech / defense_industry` şirketleri devreye alınabilir. Aynı bölge-sektörde tesis varsa ve sahibi aynıysa kapasite artırılır; yoksa kanonik `facility:<region>:<sector>` tesisi oluşturulup şirket `facilityIds` kaydına ve bölgesel `sectorCapacity` üretim sahibine aynı işlemde bağlanır. Başka şirketin tesisine el koyma ve sektör uydurma reddedilir.
- Tamamlanma şirket escrow'unu yatırım giderine kapatır, `marketClearingCash` ile şirketin kümülatif gider/yatırım sayaçlarını günceller. Bu kapanış veya devreye alma önkoşulu başarısızsa tamamlanma makbuzu üretilemez. Lojistik yapı bölgesel fiziksel terminal kapasitesine kaydolur; HXD-7 segment bağı kurulmadan mevcut bütün koridorlara bedelsiz bonus dağıtmaz.
- `story:hex-construction-test`; konut nüfus tavanını, lojistik kapasite makbuzunu, yeni sanayi tesisi oluşumunu, bölgesel üretim artışını, şirket sahipliğini, escrow/takas/kümülatif yatırım muhasebesini ve save/load'u doğrular. Site ve harita regresyonları da geçti. Sonraki HXD-6.8 borcu oyuncu/AI imar başvuru yüzeyi ile Faz 29/33 kurum yetki kararının bu komuta bağlanmasıdır.

## HXD-6.8 ilk dikey — ortak imar adayı ve kurum karar zinciri

- Oyuncu ile ekonomik AI aynı `storyHexConstructionCandidates` sorgusunu kullanır. Sorgu su, geçilemez arazi, maden, dolu site, açık inşaat ve açık başvuru çakışmasını eler; orman adayını çevresel değerlendirme gerektiren daha düşük öncelikli seçenek olarak açıkça işaretler. Aday önizlemesi ve bölge görünümü salt-okunurdur; boş dünyada kendiliğinden defter üretmez.
- Başvuru `PLAYER / ECONOMIC_AI` kaynağını, gerçek başvuranı, şirketi, hedef altıgeni ve arazi kanıtını korur; ardından yeni bir yerel yetki puanı uydurmak yerine Faz 29'un gerçek `ISSUE_LOCAL_ORDER` kurum isteğini açar. İstek `EXECUTED` olmadan şirket nakdi, malzeme ve iş gücü değişmez.
- Gerçek yürütücü aktör ve makam kurum isteğine kaydedilir. Ret, bayat yetki veya kapsam uyuşmazlığı fiziksel emir üretmez ve gerekçesini başvuruda bırakır. Uygulanmış karar atomik rezervasyon kapısından geçerse aynı korelasyonla `BUILDING` komutuna dönüşür; kaynak yoksa karar kaybolmadan `RESOURCE_BLOCKED` kalır.
- Şehir dosyasının şirketler sekmesi fiziksel imar başvurularını, ret/kaynak engelini, hedef hücreyi ve gerçek inşaat ilerlemesini gösterir. `hexConstruction.version` panel önbelleğinin yalnız gerçek defter değiştiğinde yenilenmesini sağlar.
- `story:hex-construction-application-test` ve mevcut `story:hex-construction-test` geçti. Kurum modülü için bağımsız adlandırılmış test dosyası bulunmadığından hayalî bir regresyon sonucu raporlanmadı; sözdizimi ve diff denetimi temizdir.
- Açık HXD-6.8 borcu, harita/şehir panelinde şirket ve hedef hücreyi seçen oyuncu akışı ile ekonomik AI'nın başvuru zamanlama politikasıdır. Bunlar kapanınca HXD-6.9 görsel üretim dalgası A (`80–150` kanonik kaynak) başlar; HXD-7/8 ile `300–500`, bütün 2010–2100 dönem/durum varyantlarıyla `1.000+` katalog girdisine çıkılır.

## HXD-6.8 ikinci dikey — oynanabilir hedef seçimi ve ekonomik AI (`implemented_pending_exe_ui_acceptance`)

- Ekonomi / Şirketler sekmesinde imar başvurusu yalnız oyuncunun kanonik rolü `COMPANY_OWNER / COMPANY_EXECUTIVE` ve `organizationId` ile gerçek çalışan/lisanslı şirkete bağlanıyorsa açılır. Komutan, devlet başkanı veya başka rol oyuncu olduğu için şirket kasasını kullanamaz; arayüz kilit gerekçesini açıkça gösterir.
- Oyuncu konut, sanayi veya lojistik projesini seçince aynı fiziksel aday sorgusundan gelen boş altıgenler yakın haritada yeşil çizilir. Haritaya tıklanan geçerli hedef sarıya döner; onaydan önce yalnız UI taslağıdır ve save/simülasyon gerçeği değildir. Başvuruyu gönderme gerçek şirket, aktör, ülke, arazi kirası ve kurum isteği bağını tekrar doğrular.
- Başvuru API'si artık yalnız UI'ya güvenmez: kanonik karakter rolü ve şirket bağı, oyuncu kimliği, şirket ülkesi ve hedef kurum kapsamı motor tarafında yeniden denetlenir. Sahte `companyId` veya başka ülke şirketiyle başvuru reddedilir.
- Yerel inceleme `30` dünya günü sürer. Süre dolunca gereken gerçek kurum makam sahipleri Faz 29 API'si üzerinden onay verir ve gerçek yürütücü isteği uygular; bundan sonra aynı başvuru atomik kaynak kapısına geçer. Makam boşsa, yetki bayatsa veya kaynak yoksa bedelsiz inşaat doğmaz.
- Ekonomik AI her `90` dünya gününde en fazla bir fiziksel imar başvurusu açabilir. Konut yalnız nüfus gerçek konut tavanının `%92` üstündeyse; lojistik çoklu bölgesel kıtlık varsa; sanayi yalnız kendi sektör kaynaklarında kaydedilmiş kıtlık varsa aday olur. Oyuncunun yönettiği şirket otomasyondan çıkarılır. AI da aynı hücre, kurum, para, malzeme, iş gücü ve süre kapısından geçer.
- Otomatik test oyuncu rol/şirket bağını, harita hedef taslağını, başvuru öncesi sıfır kaynak değişimini, ekonomik AI'nın nüfus baskısından aday üretmesini, kurum incelemesi sonrasında gerçek şirket parasının bloke edilmesini ve `BUILDING` emrini doğruladı. Temel inşaat regresyonu da geçti.
- Bu oturumda in-app browser Windows erişim katmanında kurulamadığı için şirketler paneli otomatik tıklanıp görsel kabul edilmiş sayılmadı. İlk iki Electron performans koşusunu dört artık maptest süreci ve kilitli GPU cache bozdu; PID/komut satırı doğrulandıktan sonra yalnız test artıkları kapatıldı. Temiz gerçek Electron koşusunda uzak/orta/yakın/etkileşim p95 `11,9 / 10,3 / 8,5 / 8,4 ms`, hit-test `0 px`, şehir yeniden üretimi `0`, `MAPTEST_PROBLEMS []` ve `MAPTEST_OK` alındı. HXD-6.8 kod ve performans kabulü tamam; gerçek EXE'de şirketler sekmesi ile yeşil/sarı hedef tıklamasının görsel kabulü açık. Sıradaki aşama **HXD-6.9 görsel üretim dalgası A**dır.

## HXD-6.9 A1 — ilk gerçek üretim atlası (`implemented_pending_idle_perf_and_exe_visual_acceptance`)

- `assets/maps/urban-construction-atlas-modern-v1.png` eklendi: `1536×1024`, alfa kanallı, `2.833.380` bayt ve dört aile × dört yaşam hali = `16` farklı sprite hücresi.
- `StoryVisualCatalog` v2 artık önceki altı şehir fallback'iyle birlikte `22` kayıt taşır. İnşaat varlığı proje türü, gerçek komut ilerlemesi, fiziksel site durumu ve dönem fallback'iyle çözülür; yalnız yıl/araştırma görüntüyü yükseltemez.
- `StoryRender`, yalnız `sourceConstructionId` taşıyan fiziksel siteleri kendi hedef altıgeninde çizer. Temel/iskelet seçimi `remainingDays / durationDays`, işletme `COMPLETED`, hasar fiziksel yaşam durumundan gelir. Yakın görünüm gerçek baz-puan ilerleme çubuğu gösterir.
- `remainingDays` fiziksel site `sourceHash`ından çıkarıldı. Canlı ilerleme statik `906 MB` şehir bitmap katmanını her ekonomi tikinde geçersiz kılamaz; render yalnız küçük `constructionSites` dizisini dolaşır.
- Maptest süreç başına geçici `userData` profiline ayrıldı; böylece açık oyunun Chromium/GPU cache kilidi oyuncu oturumunu kapatmadan önlendi. Eşzamanlı açık oyun yükündeki izole koşuda cache hatası yok, etkileşim p95 `15,1 ms`; uzak/orta/yakın p95 `29,3 / 25,8 / 22,6 ms` olduğu için 60 FPS kapısı henüz kabul edilmedi.
- `story-visual-catalog`, `story-hex-sites`, `story-hex-construction`, `story-hex-construction-application` ve `story-map-renderer-v2` kapıları geçer. Açık kabul: sakin makinede gerçek Electron p95 tekrarı ve oyuncu EXE'sinde inşaatın temel → iskelet → işletme geçişinin görsel kontrolü.
- Sıradaki iş **HXD-6.9 A2**: ilk dalgayı `80–150` kanonik kaynağa tamamlayacak modern şehir aileleri, iklim varyantları ve temel hasar paketleri. Binlerce varlık HXD-7/8 fiziksel seçicileri ve 2010–2100 teknoloji kademeleri geldikçe üretilecek; seçilme nedeni olmayan kopya kabul edilmeyecek.

## HXD-6.9 A2 — ilk 80 varlık dalgası (`implemented_pending_idle_perf_and_exe_visual_acceptance`)

- Dört yeni 4×4 gerçek-alfa atlası eklendi: şehir × iklim, şehir × hasar, özel tesis × iklim ve arazi kullanımı × yaşam döngüsü. A2 `64`, A1 `16` yeni kanonik hücre; altı kontrollü eski fallback ile `StoryVisualCatalog` toplamı tam `86` benzersiz kayıttır.
- Katalog şeması `3`, sürümü `story-visual-catalog-2010-2100-v3` oldu. İklim, fiziksel durum, özel tesis ailesi ve arazi yaşam döngüsü bağımsız deterministik seçicilerdir. 2030+ özgün dönem resmi yoksa modern atlas `fallbackDepth:1 / PERIOD_ASSET_MISSING` ile açıkça raporlanır.
- Şehir çekirdeği ve ilçeler yeni iklim/hasar/özel tesis atlaslarını gerçekten kullanır. Bütün şehir atlasları hazır olmadan `906.240.000` baytlık şehir RAM katmanı kurulmaz; atlas decode sırası aynı katmanı tekrar tekrar üretmez.
- Arazi kullanım atlası yalnız `PhysicalSiteV1` kaydı bulunan tarım/ormancılık/maden/açıkça yenilenebilir hücreye bağlandı. Genel enerji kaydı yenilenebilir sayılmaz; kanıtsız tarım haritaya basılmaz. Kaynak sicili ve yaşam döngüsü doğal yüzey anahtarına dahil edildi.
- Beş proje atlasının boyutu `>=1024`, PNG renk türü `6` (RGBA) ve köşe alfa kanalı gerçektir. `story-visual-catalog`, `story-map-v2`, `story-hex-render` ve `story-hex-sites` testleri geçti.
- İşlevsel Electron kabulünde atlas ve şehir RAM katmanı hazır, sürükleme sırasında şehir görünür, hit-test hatası `0 px`, canlı şehir yeniden üretimi `0` oldu. Aynı anda CPU `%77` ve boş RAM `2,5 GiB` olduğundan p95 uzak/orta/yakın/etkileşim `33,1 / 28,2 / 30,5 / 28,8 ms` ile 60 FPS kapısını geçmedi. Sakin makine tekrarı ve oyuncu EXE görsel kabulü açıktır.
- Açık sanat borcu: hasar atlasındaki `BURNED` sütunu yer yer aktif alev/duman taşır; ileride `BURNING` ile `BURNED` ayrılacaktır. İlk varlık dalgası hedefi tamamdır; sıradaki sahip iş **HXD-7 fiziksel ulaşım segmentleri ve hareketli lojistik**tir. HXD-7/8 mekanik kimlikleri oluşmadan binlerce seçilemeyen resim üretilmeyecektir.

## HXD-7.1 — fiziksel kara segmenti sicili (`implemented`)

- `story-hex-infrastructure-segments-1`, `177` makro kara koridorunu `955` benzersiz komşu-altıgen kenarına ayırır. `84` segment paylaşılan güzergâh, `84` segment `BRIDGE`, `9` segment `TUNNEL`; kalanlar `ROAD`dur. Topoloji karması `fnv1a32:eb824264`.
- Segmentler kapasite, bakım, hasar, açık/kapalı durum, fiziksel yaşam döngüsü ve onarım süresi taşır. Makro `storyInfrastructureEffectiveCapacity`, segment zincirinin en kötü katsayısını tüketir; tek fiziksel hasar yalnız o kenardan geçen koridor ve açıkça miras alan enerji/veri katmanını düşürür.
- Hasarlı fiziksel kenar yolun tamamını sahte biçimde boyamaz; yalnız ilgili altıgen kenarında sarı/turuncu, kapalıysa kırmızı kesikli görünür. Segment revizyonu kalıcı ağ RAM katmanını hedefli geçersiz kılar.
- Fiziksel kara zinciri olmayan `12` eski koridor artık kapasite üretmez ve `NO_PHYSICAL_LAND_PATH` olarak raporlanır. Bunların içinde Paris–Londra, Hamburg–Kopenhag, Napoli–Palermo ve ada geçişleri vardır; köprü/tünel/feribot/deniz segmenti kurulmadan su üstünden kara yolu uydurulmaz.
- Kompakt kayıt yalnız varsayılandan sapmış segmentleri taşır. Hasar `%60`, bakım `%80`, onarım `45 sn` kayıt-yükleme karşı testi; paylaşılan güzergâh, enerji mirası, fiziksel zincirsiz koridor ve kapasite regresyonları geçti.
- Gerçek Electron `qa-runtime/hxd71-physical-segments-gate` kabulünde `955` segment, `84` paylaşım, `12` açık coğrafya borcu; yol su adımı ve geçersiz komşuluk `0` oldu. P95 uzak/orta/yakın/etkileşim `15,8 / 10,2 / 11,4 / 15,6 ms`, hit-test `0 px`, `MAPTEST_OK`.
- İlk kapsamlı ticaret probu kapasite okumasındaki yinelenen `ensure` zinciri nedeniyle `15+ dakika` zaman aşımına uğradı. Yerleşik segment sidecar'ı için doğrudan sıcak okuma eklendikten sonra aynı `tradeProbe` stok/escrow/sevkiyat korunumuyla `30,4 sn`, `infrastructureProbe` `21,3 sn` içinde geçti. Fiziksel zincirsiz koridorlar performans uğruna yeniden açılmadı.
- Sıradaki iş **HXD-7.2 fiziksel deniz segmentleri, liman uçları ve feribot/boğaz sözleşmesi**dir. Ray, bakım iş emri ve segment inşa ekonomisi HXD-7.3–7.4'te; hareketli araç ve teslimat HXD-9'da açılır.

## HXD-7.2 — fiziksel deniz segmentleri ve liman uçları (`implemented`)

- `story-hex-infrastructure-segments-2`, açık tanımlı `20` SEA koridorunun tamamını fiziksel liman kara ucu → liman su ucu → komşu deniz altıgenleri → karşı liman zincirine bağlar. Gerçek 152 şehir probunda `202` SEA segmenti, `29` paylaşılan `PORT_ACCESS` ve `21` kayıtlı `STRAIT` darboğazı üretildi; başarısız deniz koridoru `0`dır.
- Deniz ve liman segmentleri kara segmentleriyle aynı kapasite, bakım, hasar, kapanma, onarım ve kompakt kayıt sözleşmesini kullanır. ENERGY/DATA katmanı bir SEA koridoruna bağlıysa yeni geometri uydurmaz; aynı fiziksel deniz zincirini miras alır. HXD-7.1 şema-1 kayıtları, uyumlu kara hasar durumlarını kaybetmeden şema-2'ye göçer.
- Atina–İzmir eski kıyı rasterinde saf su bileşeni kopuktu. Eşik gevşetilip kara üzerinden gemi yürütülmedi: yalnız en çok `7000 bps` kara örnekli karma kıyı hücresi yüksek maliyetli ve açık `STRAIT` segmenti olabilir; daha katı kara hücresi kesin yasaktır.
- Harita artık iki liman arasında dekoratif Bezier eğrisi çizmez. Kalıcı ağ RAM katmanı fiziksel `corridorCellPaths` zincirini rasterize eder; motorun kapasite gördüğü rota ile oyuncunun gördüğü rota aynıdır.
- Tek işçili gerçek dünya `hexSettlementsProbe` zorunlu `allSeaCorridorsPhysical` kapısıyla geçti. Ağır Electron/FPS kabulü, eşzamanlı sekiz savaş-AI işçisi CPU'yu doyurduğu için ertelendi.
- Sıradaki iş **HXD-7.3 ray segmentleri ve modal altyapı kimliği**dir. Bakım/inşa ekonomisi HXD-7.4, hareketli taşıt ve gerçek teslimat HXD-9 kapsamındadır.

## HXD-7.3 — ray segmentleri ve modal altyapı kimliği (`implemented`)

- Ray ağı kara yollarından türetilmedi. Ankara–İstanbul omurgası, Balkan/Orta Avrupa bağlantıları, Doğu Avrupa kolları ve seçili Akdeniz/Ortadoğu hatlarından oluşan açık tanımlı `40` RAIL koridoru ayrı katalog kimliğiyle kuruldu. Gerçek dünya probunda bu koridorların tamamı fiziksel altıgen zincirine bağlandı; başarısız ray koridoru `0`dır.
- Fiziksel sicil `277` ray segmenti taşır: `13` `RAIL_BRIDGE`, `2` `RAIL_TUNNEL`, kalanları `RAIL_TRACK`tır. Aynı altıgen kenarından geçen ROAD ve RAIL ayrı segment kimliği, kapasite, hasar, bakım ve kapanma durumu taşır; yolun vurulması paralel rayı kendiliğinden bozmaz.
- Kalıcı ağ RAM katmanı motorun `corridorCellPaths` zincirinden ray altlığı ve kesikli ray merkezi üretir. Hasarlı/kapalı ray yalnız kendi fiziksel kenarında durum rengi taşır; çizilen rota ile kapasite motorunun kullandığı rota aynıdır.
- Ray kataloğu eklenmeden önce üretilmiş kompakt altyapı kayıtları yalnız tanınan eski ağ karmasıyla kabul edilir. Bilinen eski koridor hasarı korunur, `40` yeni ray varsayılan durumla eklenir ve kayıt teşhisine açık backfill uyarısı yazılır. Rastgele veya bozuk ağ karması bu ayrıcalığı alamaz; güvenli yeniden kurulum davranışı korunur.
- Mevcut `railways` teknoloji etkisi fiziksel hat kaynağı sayılmadı. Ticaret ve göç henüz RAIL'i otomatik seçmez; aksi davranış tamamlanmamış ağı sahte ekonomik kapasiteye dönüştürürdü. Modal rota seçimi, tren/araç hareketi ve teslimat HXD-9 kapsamındadır.
- Sıradaki iş **HXD-7.4 bakım iş emri, segment onarımı ve yeni altyapı inşa ekonomisi**dir. İnşa emri gerçek kurum yetkisi, şirket/Devlet finansmanı, malzeme, işgücü, süre ve fiziksel hedef segment olmadan sonuç üretemez.

## HXD-7.4.1 — fiziksel bakım ve onarım iş emri (`implemented`)

- ROAD, SEA ve RAIL için ayrı maliyet/malzeme/işgücü/süre politikası taşıyan `story-infrastructure-work-order-1` defteri eklendi. Emir gerçek segment kimliği, kurum kararı, yetkili aktör, kaynak sahibi, bölgesel rezervasyon ve hedef durum olmadan `AUTHORIZED` olamaz; aynı segmente iki açık iş emri açılamaz.
- Şirket finansmanı nakdi proje escrow'una taşır; devlet finansmanı bütçe defterinden gerçek gider üretir. Bölgesel `raw_materials`, `industrial_parts` ve gerektiğinde `electronics` atomik olarak düşülür; ara adım başarısızsa stok ve nakit geri alınır. İşgücü açık emirlerle çifte rezerve edilemez. Şirket escrow'u ancak fiziksel iş tamamlandığında gidere dönüşür.
- Başlatılan segment `UNDER_REPAIR` olur ve kalan gerçek oyun saniyesini fiziksel sicilde taşır. Süre dolmadan hasar değişmez; tamamlanınca hasar sıfırlanır, bakım `10000 bps` olur ve tüketim/yetki kanıtlı kalıcı makbuz doğar. Defter ile segment durumu save/load zincirine bağlıdır; yeni kampanya eski emirleri taşımaz.
- Birim testi eksik yetki/kaynak reddi, çakışma, süre kapısı, ara kayıt, tamamlanma makbuzu ve gerçek escrow uzlaşmasını geçti. Mevcut `infrastructureProbe` ray öncesi göç ve bozuk kayıt kurtarmasıyla birlikte geçti.
- Bu alt dilim **yeni yol/ray/liman segmenti inşa etmez**. Sıradaki HXD-7.4.2; yeni güzergâh başvurusu, arazi/kıyı geçiş izni, kamulaştırma, çevre etkisi, çok-segmentli şantiye ve oyuncu/AI başvuru yüzeyidir.

## HXD-7.4.2a — yeni kara yolu/ray güzergâhı ve çok-segmentli şantiye (`implemented`)

- Yeni LAND/RAIL hattı mevcut yolun seviyesini artıran soyut bir sayı değildir. Başlangıç ve bitiş RegionModel kimliği gerçek şehir çekirdeklerine çevrilir; su ve geçilemez dağdan yürümeyen deterministik altıgen zincir üretilir. Aynı mod/uç çifti zaten varsa veya fiziksel yol bulunamazsa başvuru reddedilir.
- Zincirin geçtiği her bölge için ayrı geçiş hakkı/kamulaştırma kanıtı zorunludur. Orman, köprü veya tünel varsa çevresel değerlendirme ve azaltım kimliği olmadan emir açılamaz. Kenar sayısı, köprü ve tüneller nakit, hammadde, sanayi parçası, elektronik, işgücü ve süreyi mekanik olarak hesaplar; LLM miktar üretemez.
- Şirket escrow'u veya devlet bütçesi ile bölgesel stoklar atomik rezerve edilir. Başlayan çok-altıgenli şantiye onaylı zincir boyunca turuncu kesikli hat olarak ağ RAM katmanında görünür. Süre bitmeden koridor kapasitesi doğmaz.
- Tamamlanma makbuzu onaylı hücre zincirini, geçiş haklarını, çevre kararını ve tüketimi saklar. Ardından rota `corridor:built:<mode>:<sequence>` kimliğiyle makro altyapı grafına ve aynı zincirle fiziksel segment siciline girer. Dinamik tanım altyapı grafından önce geri yüklendiği için save/load ağ karması bozulmaz.
- Gerçek dünya kabulünde Ankara–İzmir ray hattı ray koridorlarını `40 → 41`, fiziksel ray segmentlerini `277 → 287` yaptı; başarısız ray koridoru `0` kaldı. Yükleme sonrası makro kimlik ve onaylı hücre zinciri birebir korundu. Altyapı ve render regresyon probları geçti.
- SEA/liman inşası bu alt dilimde bilerek kapalıdır. Sıradaki **HXD-7.4.2b**, kıyı kara hücresi + su terminali, liman mülkiyeti, tarama/dolgu, boğaz izni ve fiziksel deniz hattını aynı başvuruya bağlar. Ardından HXD-7.4.3 oyuncu/AI başvuru ve ilerleme arayüzüdür.

## HXD harita UI kabulü — görünür yapı kimliği ve fiziksel inşaat (`implemented / open-60fps-and-art-debt`)

- Haritada görünen şehir çekirdeği dışındaki ilçe, tesis ve şantiye resimleri artık yalnız altıgen dekoru değildir. Her karede çizilen gerçek görünür varlıklardan `siteId / districtId / cellId / nodeId` taşıyan seçim sicili üretilir; tıklama önce bu sicili, sonra şehir/altıgen fallback'ini kullanır. Böylece aynı şehir çevresindeki yapılar ayrı dosya açar ve bir altıgendeki ilk tesise yanlış düşmez.
- Gerçek Electron İstanbul kabulünde `6` ayrı görünür yapı kimliği bulundu; en yakın `5` yapı tek tek tıklanarak iki konut/kamu ilçesi ile Türk Sanayi A.Ş. ve Türk Savunma A.Ş. tesislerinin doğru fiziksel hücre ve tesis dosyasını açtığı doğrulandı. Görünür yapı seçimi oyuncu etkileşim raporuna bağımsız zorunlu akış olarak eklendi.
- Oyuncu ile ekonomik AI'nın inşaat başvuruları aynı `StoryHexConstruction` komutunu üretir. `BUILDING/COMPLETED` komutu `StoryHexSites` üzerinden fiziksel siteye dönüşür ve seçim siciline girer. İnşaat dosyası proje türü, ilerleme, tahmini bitiş, taraflar, maliyet, malzeme ve iş gücünü gösterir; yalnız bir inşaat resmi çizilmez.
- Gerçek Electron oyuncu akışı `10/10` geçti: lojistik gönderi, akan taşıt, zaman kontrolü, orman eylemi, kıyı/maden/bağımsız hücre dosyası, inşaat dosyası, hover/seçim ve görünür yapı dosyaları. Taşıt katmanı `80` örnekte `70` ayrı ara konum ve `8` hedef üretti; p95 `0,3 ms`, statik dünya yeniden çizimi `1` ve ters sprite rotasyonu `0` oldu. Taşıtın her adımda donma/ışınlanma P1 borcu kapandı.
- Yeni `geography-variety-atlas-modern-v1` on altı şeffaf kaynakla yapraklı/iğne yapraklı/Akdeniz ormanı, otlak, bozkır, çöl, kayalık yarı kurak arazi, buğday, sulamalı tarla, bağ/bahçe, sulak alan, kayalık/kar, açık maden ve petrol sahası ailelerini kanonik yüzey seçicisine bağladı. Bu ilk çeşitlilik artışıdır; bitmiş sanat kabulü değildir.
- Son sakin Electron koşusunda yakın görünüm p95 `15,8 ms` ile 60 FPS kapısını geçti; uzak `17,6`, orta `19,7`, kamera etkileşimi `19,7 ms` ile geçmedi. Taşıt animasyonu artık darboğaz değildir; kalan maliyet doğal yüzey, ağ ve çok katmanlı ekran kompozitidir. `MAPTEST_FAIL` sonucu saklanır ve 60 FPS borcu kapanmış sayılmaz.
- Görsel kalite mevcut haliyle yaklaşık `4/10` kabul edilir. Açık sanat borçları: sert/zikzak ve yer yer anlamsız kesişen yol geometrisi; tekrarlayan yerleşim/tesis aileleri; geniş düz/boş zeminler; iklim ve 2010–2100 teknoloji dönemine göre yetersiz kent/sanayi/ulaşım varyantı; arazi kullanımının mülkiyet ve üretim türünü haritada yeterince ayırt etmemesi; yeni coğrafya atlasındaki küçük kenar temizliği ihtiyacı. Bunlar mekanik UI başarısının arkasına gizlenmez.

### HXD harita kompoziti ara kabulü — ağ/doğal yüzey bitmapleri

- Yol ve liman RAM katmanları ayrı ayrı ana canvas'a kopyalanmak yerine kamera+mod+kaynak anahtarlı tek ekran kompozitinde birleşir. Sabit görünüm ve sürükleme bu kompozitin çözülmüş `ImageBitmap` kaynağını kullanır; kamera bırakılınca gerçek dünya karolarından kesin görüntü yeniden kurulur. Doğal yüzeyin sabit viewport kompoziti de aynı biçimde çözülmüş bitmap olarak tutulur; değişen kamera anahtarında eski GPU kaynağı kapatılır.
- İlk karşılaştırmada orta görünüm `19,7 → 13,6 ms`, kamera hareketi `19,7 → 15,9 ms` p95'e indi. Son üç gerçek Electron koşusunda ortalamalar `12,6–14,2 ms` bandında kaldı; tekil p95 kapıları yük durumuna göre uzak/yakın/etkileşim arasında `14,2–18,6 ms` oynadı. Bu nedenle donma sınıfı tekrar-kompozit borcu kapandı fakat kararlı 60 FPS kabulü hâlâ açık tutulur; yeşil tek koşu seçilmez.
- Yol ve ray iki geçişli stili inceltildi, kontrastı araziye yaklaştırıldı. Fiziksel altıgen segmentleri ve hasar renkleri değişmedi. İstanbul görsel kabulünde bağlantılar artık kent/zeminden daha koyu baskın şekiller değildir; tekrar eden gri yerleşim aileleri sıradaki birincil sanat borcudur.

## HXD-7.4.3c — işlevsel modern kent çeşitliliği (`implemented / open-60fps-and-era-debt`)

- `urban-functional-atlas-modern-v1.png` eklendi: `1536×1024`, gerçek RGBA ve dört işlev × dört mimari varyant = `16` yeni kanonik hücre. Aileler konut, kamusal, ticari/lojistik ve sanayidir; görsel katalog toplamı `96 → 112` kayda çıktı.
- Seçim rastgele kare titremesi üretmez. Gerçek `physicalSite.id / district.id / node.id` kimliği kararlı varyant seçer; aynı kayıt aynı resmi korur. Fiziksel sektör tesisi, özel tesis, hasar ve kuzey/kurak iklim görselleri önceliğini korur. Fiziksel site yoksa belirli şirket veya tesis uydurulmaz; yalnız genel işlevsel ilçe ailesi çizilir.
- Canlı Electron kabulünde Ankara ve İstanbul çevresindeki konut, kamusal, ticari ve sanayi yapıları ayrı silüetlere dönüştü. İstanbul'daki `6` görünür yapı kimliği ve ilk `5` doğru dosya seçimi korundu; oyuncu etkileşimi `10/10`, yapı hit-test hatası `0 px`, sürüklemede yeni sprite üretimi `0`dır.
- Tam `test:story-infrastructure` paketi geçti. Taşıt p95 `0,4 ms` ve statik katman yeniden çizimi yoktur. Harita p95 uzak/orta/yakın/etkileşim `21,1 / 17,8 / 15,7 / 26,9 ms` olduğundan kararlı 60 FPS kapısı kapanmadı.
- Açık görsel borç: 2030–2100 dönemlerinin işlevsel atlasları, kuzey/kurak ailelerde eşdeğer mimari çeşitlilik, üretim/mülkiyetin haritada bir bakışta okunması ve atlaslar arası ölçek/palet birliği.

## HXD-7.4.3d — boreal ve kurak işlevsel kent aileleri (`implemented / climate-data-debt`)

- `urban-functional-boreal-modern-v1.png` ve `urban-functional-dry-modern-v1.png` eklendi. İkisi de `1536×1024` gerçek RGBA; her biri dört işlev × dört varyant taşır. İşlevsel kent dalgası `16 → 48`, toplam katalog `112 → 144` kanonik kayda çıktı.
- Aynı ilçe/site kimliği iklim değişmediği sürece aynı varyantı kullanır. `BOREAL` kar uyumlu, `DRY` sıcak-kurak mimari atlasına; `TEMPERATE/COASTAL` temel işlevsel atlasa gider. Hasar, özel tesis ve gerçek sektör tesisi bu seçimden önce gelmeye devam eder.
- Görsel katalog ve tam `test:story-infrastructure` paketi geçti. Gerçek Electron atlas yüklemesi ve çözünürlük matrisi hatasızdır. P95 uzak/orta/yakın/etkileşim `21,8 / 17,4 / 18,1 / 24,2 ms`; 60 FPS kapısı yine kırmızıdır.
- Açık veri borcu: iklim halen şehir adı veya gerçek Köppen/veri hücresi yerine normalleştirilmiş `ly` yaklaşık değeri ve liman bayrağından türetilir. Bu yüzden örneğin Adana otomatik olarak kurak sayılmaz. Görsel seçici doğru çalışır; girdinin bilimsel iklim modeli olmadığı açıkça kaydedilir.
- Aynı koşuda taşıt p95 `0,3 ms`, `70` ara konum ve ters rotasyon `0` iken statik katman sayacı `2` arttı; taşıt dondu denmedi fakat `TRANSPORT_MOTION` kabulü `9/10` olarak kırmızı saklandı.

## 2026-08-23 — 18 sistem ailesi oyuncu erişim tabanı (`implemented-baseline`)

- Ticaret, üretim, stok/fiyat, yatırım, şirket, banka, bütçe, altyapı, göç, emek, güç merkezi, kurum, seçim, soruşturma, diplomasi, medya, stratejik askerî yönetim ve teknoloji/AR-GE için tam `18` kayıtlı oyuncu ailesi vardır.
- Ortak kapı yalnız `preview + execute` sahibi gerçek motor bağlayıcılarını kabul eder. Başarılı sonuç `worldMutation=true` ve domain defterini adlandıran kanonik makbuz taşımıyorsa oyuncu başarı makbuzu yazılmaz. Retler ayrı sayılır; dünya sonucu gibi gösterilmez.
- Yürütme, şirket sahibi ve komutan fixture'ları birlikte 18/18 gerçek mutasyon üretti. Yürütme askerî makamı miras alamadı; şirket sahibi yalnız kendi kanonik şirketiyle işlem yaptı. İstifa fiziksel halefiyet üretti. Save/load `15` yürütme makbuzunu ve sıra numarasını korudu.
- Bu kayıt **sistem derinliği tamamlandı** demek değildir. Her ailede ilk güvenli oyuncu dikeyi kapanmıştır. Çok seçenekli alan formları, kapsamlı rol navigasyonu, satış/vergilendirme/para politikası, dava yaşam döngüsü, çok taraflı diplomasi, medya kuruluşu yönetimi ve modern teknoloji DAG'ı ilgili ana faz borçlarında kalır.

## 2026-08-27 — Faz 38 Türkçe semantik embedding spike (`measured / candidates-rejected`)

- Corpus `279` cümle, `239` aile ve `179` tekil Codex gold taşır; model seçimi
  ayrımı `89/45/45`, ürün kapısı `179/1000`dır.
- Deterministik kör macro-F1 `0,233333`tür. E5'in kalibrasyonla seçilen
  `query/query` ve `query/passage` kolları `0,097571/0,086325` ile geriledi.
  BGE-M3 `0,348664` ile yalnız `+0,115331` kazandı ve gereken `+0,15`i
  karşılamadı.
- Kör yüksek-risk yanlış pozitif sayısı deterministik `3`, E5 kollarında `1`,
  BGE-M3'te `4`tür. Sıfır güvenlik kapısını hiçbir aday geçmedi.

## 2026-08-28 — Faz 38 temsil ablation'ı (`measured / not-selected`)

- Aynı BGE-M3 vektörleri üzerinde mevcut sınıf başı tek maksimum çapa,
  sınıf-dengeli en iyi üç çapa ortalaması ve beş SemanticFrameV2 ekseniyle
  yeniden sıralanan en iyi üç çapa karşılaştırıldı. Model ve `89/45/45` aile
  ayrımı değişmedi; kör test hiçbir seçim yapmadı.
- Kalibrasyon güvenlik öncelikli seçimde yine `single-max / N=20` kolunu seçti.
  Bu seçilmiş kolun kör sonucu değişmedi: macro-F1 `0,348664`, OOD yanlış kabul
  `0`, yüksek-risk yanlış pozitif `4`; model kabul edilmedi.
- Seçilmemiş `class-top3-mean / N=20` ve `frame-top3-mean / N=20` kolları kör
  sette sırasıyla `0,415212/0,428776` macro-F1 ve `1/2` yüksek-risk yanlış
  pozitif verdi. Bu değerler temsil sinyali gösterir fakat kalibrasyon onları
  seçmediği için ürün sonucu veya yeni seçim kuralı değildir.
- 45 satırlık kalibrasyonun 17 sınıfa bölünmesi temsil seçimini kararsız bıraktı.
  Bu kör set sonuçları görüldüğünden sonraki temsil ayarı aynı kör setle
  seçilemez; yeni ailelerden dengeli kalibrasyon ve dokunulmamış nihai holdout
  olmadan Adım 3 kapalı kalır.
- Yeni `representationSelectionPass`, kör sette bulunan her ana eylem sınıfı
  için prototype, calibration ve blind tarafında en az üç bağımsız gold aile
  ister. Eski `modelSelectionPass=true` tarihsel spike koşulunu korurken yeni
  kapı `false` ve 17 sınıf/split açığı raporlar; asgari açık 32 yeni tekil gold
  kayıttır.
- Sonuç olarak yönlendirici, IPC, paketleme ve mekanik entegrasyon yapılmadı;
  mevcut deterministik konuşma yolu değişmedi. Adım 3 yeni ve kabul edilmiş bir
  model/temsil hipotezi olmadan kapalıdır.

## 2026-08-31 — Faz 38 taze değerlendirme (`measured / candidates-rejected`)

- Corpus `391` benzersiz cümle, `351` aile ve `291` gold taşır. Yeni mühürlü
  kohort `10/51/51` splitindedir; 17 sınıfın tamamı ile OOD, kalibrasyon ve kör
  testte en az üç bağımsız aileye sahiptir.
- Deterministik kör taban `0,262698` macro-F1'dır. Kalibrasyonun seçtiği E5
  `query/passage + single-max + N=20` kolu `0,318783` (`+0,056085`) ve `6`
  yüksek-risk yanlış pozitif; BGE-M3 `frame-top3-mean + N=10` kolu `0,309023`
  (`+0,046324`) ve `3` yüksek-risk yanlış pozitif verdi. Gerekli fark `+0,15`,
  izin verilen yüksek-risk yanlış pozitif `0`dır; iki aday da reddedildi.
- E5 OOD yanlış kabulü `0`, BGE-M3 `0,333333`; sıcak CPU p50/p95 yaklaşık
  `92,64/127,79 ms` ve `769,32/1.210,31 ms`dir. Bunlar Node CPU spike
  değerleridir, Electron kabulü değildir.
- Kör cohort bir kez görüldüğü için `SPENT_AFTER_2026_08_31_ONE_SHOT` olarak
  kilitlendi; aynı epoch ile yeniden model koşusu preflight'ta durur. Runtime,
  IPC ve paketleme eklenmedi; mevcut deterministik konuşma davranışı değişmedi.
  Faz 38 semantik planı yeni hipotez ve yeni mühürlü epoch için `In Progress`
  kalır; `%90+` oyuncu dili anlama iddiası desteklenmemektedir.

## 2026-08-31 — Faz 38 iç içe kalibrasyon (`measured / no-new-blind-epoch`)

- Üç katlı aile-sızıntısız dış kalibrasyon, temsil/profil/çapa sayısını eşik
  öğrenilen satırlarda yeniden puanlama yanlılığından ayırdı. Çalışma
  `99/51/0` prototip/kalibrasyon/kör sınırında tamamlandı ve kör sete erişmedi.
- Kalibrasyon tabanı macro-F1 `0,303431` ve `3` yüksek-risk yanlış pozitiftir.
  E5 seçimi `0,185662` (`-0,117770`) ve `0` yüksek-risk yanlış pozitif ile
  kaliteyi; BGE-M3 seçimi `0,467550` (`+0,164118`) ve `2` yüksek-risk yanlış
  pozitif ile güvenliği geçemedi.
- Kapı `eligibleModelIds=[]`, `createNewBlindEpoch=false` verdi. Yeni gold/kör
  kohort, oyun çalışma zamanı, Electron/IPC ve LLM entegrasyonu açılmadı.
  Oyuncu dilini `%90+` anlama hedefi gerçekleşmiş değildir. Sıradaki çalışma,
  ilk N prototip kaydını körlemesine alan çapa politikasını kalibrasyon içinde
  değiştirecek ayrı ve deterministik bir hipotezdir.

## 2026-08-31 — Prototip kapsama politikası (`measured / hypothesis-rejected`)

- Alfabetik ilk-N çapa kesimi, yalnız prototip vektörlerinden deterministik
  medoid ve açgözlü sınıf kapsaması seçen `PROTOTYPE_GREEDY_COVERAGE_V1` ile
  değiştirildi. Politika benchmark makbuzunda görünür; oyun çalışma zamanına
  bağlanmadı.
- Kör erişimsiz dış kalibrasyonda E5 `0,107791` macro-F1, `-0,195640` taban
  farkı ve `0` yüksek-risk yanlış pozitif; BGE-M3 `0,345322`, `+0,041890` ve
  `3` yüksek-risk yanlış pozitif verdi. Önceki dış-kat sonuçlarından ikisi de
  daha kötüdür.
- Kalite artışı hipotezi reddedildi; `createNewBlindEpoch=false`. Mevcut oyun
  konuşma davranışı değişmedi ve `%90+` anlama hedefi hâlâ kanıtlanmadı.

## 2026-08-31 — Sınıf centroid temsili (`measured / quality-pass-safety-fail`)

- Bütün prototipleri kullanan `PROTOTYPE_CLASS_CENTROID_V1` eklendi; N ayarı
  veya değerlendirme verisinden çapa seçimi yapmaz.
- BGE-M3 dış-kat macro-F1 `0,532026`, taban farkı `+0,228595` ile kalite
  kapısını geçti; fakat tek katta kümelenen `3` yüksek-risk yanlış pozitif
  güvenlik kapısını kapattı. E5 `0,347712`, `+0,044281` ve `1` risk verdi.
- Kör erişimi yoktur (`99/51/0`); `createNewBlindEpoch=false`. Centroid oyun
  çalışma zamanına bağlanmadı. Sonraki güvenlik hipotezi SemanticFrameV2 ile
  yüksek-risk eylem yönünü deterministik ön-kabulde doğrulamaktır.

## 2026-08-31 — SemanticFrameV2 centroid vetosu (`measured / safe-but-weak`)

- BGE-M3'te yüksek-risk adaylar için en az `4/5` yön ekseni uyumu, centroid
  riskini `3 → 0` düşürdü. Dış-kat macro-F1 `0,383007`, taban farkı
  `+0,079575`; gerekli `+0,15` kalite farkı sağlanmadı.
- E5 güvenli seçimi `0,237908`, `-0,065523` ve sıfır risk verdi. Otomatik kapı
  yine `eligibleModelIds=[]`, `createNewBlindEpoch=false` üretti.
- Oyun konuşma davranışı değişmedi. Sonraki adım global eşik ayarı değil,
  yüksek-risk eylem başına zorunlu SemanticFrameV2 eksen sözleşmesidir.

## 2026-08-31 — Türkçe yön aileleri ve recall güvenlik kapısı (`implemented / models-rejected`)

- Yüksek-risk niyet sözleşmesinin bütün gerçek eylemleri reddederek sıfır
  yanlış pozitife ulaşması engellendi. Her sınıf artık en az `1/3` ve mevcut
  deterministik taban kadar recall göstermelidir.
- Türkçe emir, ticari teklif, koşullu tehdit ve sır paylaşımı yön aileleri
  deterministik SemanticFrameV2'de düzeltildi. Taze kalibrasyon kapsamı
  `3/15 → 15/15`; olumsuz gizli-ifşa blöfü karşı örnek olarak korunuyor.
- Kör erişimsiz yeni dış kalibrasyonda taban macro-F1 `0,474259` oldu. E5
  `0,238598` ve BGE-M3 `0,520915` verdi. BGE farkı yalnız `+0,046656`, toplam
  yüksek-risk yanlışı `2`; eylem talebi ve blöf recall değeri `0`dır.
- İki model de reddedildi; `createNewBlindEpoch=false`. Oyun çalışma zamanına
  embedding, Electron IPC veya yeni mekanik yetki eklenmedi. Faz 38
  `In Progress`, `%90+` anlama hedefi kanıtsız kalır.

## 2026-08-31 — Teklif yönü ayrımı (`implemented / one-recall-blocker`)

- Mevcut teklif hakkında konuşmak ile yeni teklif yapmak; oyuncunun talebi ile
  “isterseniz yapabiliriz” desteği deterministik pragmatik çerçevede ayrıldı.
  Önceki iki BGE yanlış yüksek-risk ailesi artık ilgili sözleşmeleri geçmiyor.
- Kör erişimsiz BGE ölçümü macro-F1 `0,628758`, taban farkı `+0,154499` ve
  yüksek-risk yanlış pozitif `0` verdi. Kalite ve yanlış-pozitif kapıları geçti.
- `BLUFF_CANDIDATE` recall `0` kaldığı için recall anti-vacuity kapısı modeli
  reddetti. Yeni kör epoch, runtime ve Electron/IPC entegrasyonu açılmadı.
  Faz 38'in sıradaki araştırma engeli tek sınıftır: kaynaklı epistemik blöf
  kanıtının deterministik/embedding aday birleşiminde korunması.
