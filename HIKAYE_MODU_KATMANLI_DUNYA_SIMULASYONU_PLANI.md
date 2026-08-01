# PIXEL RTS — Hikâye Modu Katmanlı Dünya Simülasyonu Ana Planı

**Belge sürümü:** 1.37
**Kapsam:** Yalnızca hikâye modu  
**Durum:** Dalga A / Faz 0–3.1, Dalga B / Faz 4–10.1, Dalga C / Faz 11–14.6 ve Dalga D / Faz 15–22 tamamlandı — Dalga E / Faz 23 sırada
**Ölçek:** Uzun vadeli, onlarca bağımlı faz  
**Ana ilke:** Her faz tek başına ölçülebilir, geri alınabilir ve oynanabilir bir çıktı üretmeden sonraki faza geçilmez.

**1.1 değişikliği:** Serbest oyuncu sohbetinin gerçek şirket, ticaret, lojistik, yetki, blöf, sözleşme ve uzun vadeli karakter hafızasına dönüşmesini tanımlayan “Çelik Şirketi ve Britanya Sevkiyatı” referans kabul senaryosu eklendi.

**1.2 değişikliği:** Ekonomi, toplum, medya, istihbarat, diplomasi ve iç siyaseti kapsayan on dallı referans diyalog ağacı ile bunların otomatik senaryo matrisi eklendi.

**1.3 değişikliği:** Genel mimari denetim yapıldı; diyalog fazı bağımlılıkları düzeltildi, tam entegrasyon kapısı eklendi, sistemik olayların yanlışlıkla tekrar cezasıyla bastırılması engellendi, LLM çalışma zamanı/bağlam/güvenlik kuralları ve anlamlı kampanya çeşitliliği ölçümleri güçlendirildi.

**1.4 değişikliği:** Arayüz, simülasyon planından türetilen ayrı bir bilgi mimarisi olarak tanımlandı; oyuncu bilgi filtresi, şehir/yönetim/sohbet ve tüm alan çalışma ekranları, kademeli veri sunumu, bağlamsal navigasyon ve uçtan uca UI kabul fazları eklendi.

**1.5 değişikliği:** Hikâye haritasının çift raster kıyı uyumsuzluğu, düşük çözünürlüklü siyasi overlay, `fillRect` rebuild maliyeti, naif region-Voronoi, şerit warp çağrıları, `_geoTerrain` invalidation eksiği ve README/ölü prototip uyuşmazlığı için kanonik raster ve render borcu planı eklendi.

**1.6 değişikliği:** Mevcut çalışan dünya kodu için K0-K5 denetimi eklendi: hikâye test tezgâhı yokluğu, merkezsiz refah yazımı, faz durum uyuşmazlığı, LLM sözleşmesinin korunması, tick bütçesi/kalıcılık borcu ve belge çıpası kayması ayrı oyun-fix kabul kapılarına dönüştürüldü.

**1.7 değişikliği:** Uygulama başlatıldı. Sabit tohumlu headless hikâye laboratuvarı, `npm test`, 900 saniyelik Faz 0 referans raporu ve 30 oyun yıllık soak kapısı eklendi. İlk ölçüm, dünyanın uzun koşuda tek devlete çöktüğünü kanıtladı; sonuçlar `HIKAYE_MODU_UYGULAMA_DURUMU.md` içinde kaydedildi.

**1.8 değişikliği:** Faz 2’nin ilk dilimi uygulandı. Sürümlü dünya olay defteri, `storyWelfareDelta` tek yazım kapısı, sürekli kayıp tavanı, fetih/devlet ölümü/konsey/toplum sayaçları ve Faz 0 karşılaştırma aracı eklendi. İlk ham kayıt, 900 saniyede 165 sahiplik değişimiyle asıl yakınsama sorunlarından birinin aşırı fetih temposu olduğunu gösterdi.

**1.9 değişikliği:** Faz 2 kabulü tamamlandı: kaynak akışları, savaş sonucu ve motor kimliği, LLM istek/kabul/ret/hata yolları, adım performansı ve motor içi durum karması aynı sürümlü telemetriye bağlandı. Faz 3 için doğrulanan özellik bayrağı sicili, bilinmeyen bayrak reddi, kayıtlı bayrak görüntüsü ve aynı tohumlu `story:ab` karşılaştırıcısı eklendi. Hedefli A/B probu refah tavanının açık/kapalı yollarını kanıtlarken 900 saniyelik standart koşuda bu tavanın fiilen tetiklenmediğini de görünür kıldı.

**1.10 değişikliği:** Faz 3.1 gerçek paket modeliyle tamamlandı. Türkçe 8B model CUDA üzerinde hızlı çalıştı fakat katı niyet, gerçek koruma, JSON, karakter sesi ve uydurma-sayı kapılarında `0/5` aldı. Model kritik karar hakemi olarak reddedildi; yalnız doğrulanan yardımcı metin rolüne sınırlandı. Ölçüm ve zorunlu Faz 38 kısıtları `HIKAYE_LLM_YETERLILIK_RAPORU.md` içine kaydedildi.

**1.11 değişikliği:** Faz 4 salt-okunur `StoryWorldStateV2` adaptörü, boş dünya varsayılanı, sabit kimlik kuralları ve açıklamalı katı doğrulayıcıyla tamamlandı. Faz 4.1 `PlayerVisibleFact` ve `PlayerKnowledgeService` sözleşmesini kurdu; gizli yabancı devlet değerinin projeksiyona sızmadığı ve bilinmeyen/tahmin/söylenti/doğrulanmış bilgi sınıflarının ayrıldığı otomatik testle kanıtlandı. Canlı kayıt biçimi henüz değiştirilmedi; bu Faz 5’in işidir.

**1.12 değişikliği:** Faz 5 güvenli V3→V2 göç hattıyla tamamlandı. Mevcut `pixelrts_story_v3` kaydı yalnız okunuyor; kaynakla byte-byte aynı yedek doğrulandıktan sonra ayrı V2 gölge kaydı ve göç raporu yazılıyor. Devlet, bölge, sahiplik, kaynak ve oyuncu komutanı mutabakatı otomatik test edildi. Bozuk JSON, yapısal bozukluk, farklı mevcut yedek ve farklı mevcut hedef senaryolarının tümü sıfır yazmayla reddediliyor. Canlı yükleme kaynağı bilinçli olarak V3’te bırakıldı; V2’nin tek gerçek dünya kaynağı olması sonraki çekirdek fazlarının kabulünü bekliyor.

**1.13 değişikliği:** Faz 6 deterministik saat ve takvim çekirdeğiyle tamamlandı. Render FPS’ine bağlı değişken dünya adımı, özellik bayrağı arkasında `0,25` saniyelik sabit tike dönüştürüldü; 1×/2×/4× hız kontrolü, duraklatma, kısmi tik kaydı ve tek takvim servisi eklendi. 30/60/144 FPS, düzensiz kare deseni ve üç hız seviyesi aynı oyun süresinde aynı dünya karmasını üretir. Eski değişken-adım A/B probu ise FPS’e göre farklı karma üreterek düzeltilen sorunu kanıtlar. Headless konsey çözümü gerçek EXE gibi tik sınırları arasına taşındı.

**1.14 değişikliği:** Faz 7 adlandırılmış ve kaydedilebilir RNG akışlarıyla tamamlandı. Hikâye domainlerindeki doğrudan `Math.random()` çağrıları kaldırıldı; dünya, karakter, askerî, ekonomi, toplum, üretim, diplomasi, anlatı ve yönetim için dokuz bağımsız `mulberry32` akışı kuruldu. Kayıt/yükleme bütün akışların state ve çağrı sayaçlarını korur. Anlatıya eklenen 100 rastgele çağrının askerî diziyi değiştirmediği, akışlar kapatıldığında ise değiştirdiği karşı-testle kanıtlandı. Eski RNG kaydı deterministik fallback ve açık uyarıyla açılır.

**1.15 değişikliği:** Faz 8 sürümlü sistem zamanlayıcısıyla tamamlandı. On altı periyodik dünya görevi tek sıralı sicile taşındı; periyot ilerlemesi, çalışma sayısı ve son sıra numarası kayda girdi. `scheduler.registry` eski sayaç yolunu A/B geri dönüşü için korur. AI hedefleri/cooldown’ları, kuşatmalar ve bekleyen konuşmalar artık yüklemede silinmez; konuşma kapanışları RNG ve seçim iziyle yeniden kurulur. `73,125` saniyede kaydedilip yeni süreçte sürdürülen dünya ile kesintisiz dünya `164` saniyede tam kayıt düzeyinde bire bir eşittir. Bu çalışma ayrıca güncel GEO kaydın kaynak dağılımını eski terrain koordinatlarıyla bozan yükleme hatasını düzeltti.

**1.16 değişikliği:** Faz 9 sürümlü `WorldCommand → WorldEvent → Effect` nedensellik defteriyle tamamlandı. Sahiplik, refah, kaynak akışı, AI komutan hareketi ve diplomasi kalıcı yazım kapılarına bağlandı; her etki eski/yeni değer, hedef yol, kaynak komut, olay ve kök olay kimliği taşır. Dış komutlarda `idempotencyKey` aynı kararın iki kez uygulanmasını engeller. Defter V3 kayıtta kesintisiz sürer, V2 olay/teşhis projeksiyonuna girer ve etkiden kök komuta geri izlenebilir. Sürekli kaynak/refah akışları defteri boğmamak için 10 saniyelik deterministik pencerelerde toplanır. `causality.ledger` açık/kapalı 900 saniyelik A/B koşusu aynı `623ba9…e1c` dünya karmasını üretir; 30 yıllık koşu da önceki `5e8d3c…403f` sonucunu korur.

**1.17 değişikliği:** Faz 10 değişmezler ve zincir sigortasıyla tamamlandı. Nedensel zincir en çok 8 derinlik ve aynı olay/hedef için 3 tekrar; komut başına 32 olay/96 etki; dünya saniyesi başına 512 komut/1024 olay/2048 etki ile sınırlandı. Limit aşımı mutatörü çalıştırmadan `BLOCKED` sonucu ve kaynak kodlu uyarı üretir. Sahiplik, refah, kaynak deltası, komutan konumu, ilişki ve antlaşma değerleri mutasyondan önce doğrulanır. Yapısal defter doğrulaması, canlı dünya–son etki mutabakatı ve bozuk defterin dünya kaydını kaybetmeden güvenli sıfırlanması eklendi. Kasıtlı döngü/taşma/geçersiz değer/kırık referans testleri geçerken normal 900 saniyelik açık/kapalı A/B sonucu yine `623ba9…e1c`, 30 yıllık sonuç `5e8d3c…403f` kaldı ve normal akış sıfır sigorta ihlali üretti.

**1.18 değişikliği:** Faz 10.1 oyuncu-görünür domain projeksiyonu ve gerçek “Değişim & Neden” paneliyle tamamlandı. `StoryProjection`, V2 dünya + `PlayerKnowledgeService` + nedensellik defterini tek salt-okunur view-model’de birleştirir. `VERIFIED` gerçek kesin önce/sonra/delta gösterir; `ESTIMATED` ve `RUMOR` yalnız değişim varlığını ve oyuncunun tahminini gösterir; `UNKNOWN` etki akışa hiç girmez. Ham komut payload’ı, aktör ve hedef UI izine taşınmaz. Aynı yabancı refah etkisinin sahibi için kesin, rakip için gizli, istihbarat tahmininde ise `OPAQUE` görünmesi; kamusal sahiplik değişiminin iki oyuncuya da görünmesi; DOM’da rozet/satır/komut→olay→etki izi; kayıt/yükleme eşitliği ve salt-okunurluk otomatik test edildi. `projection.causalityUi` açık/kapalı 900 saniyelik A/B aynı `623ba9…e1c`, 30 yıllık soak aynı `5e8d3c…403f` karmasını korudu.

**1.19 değişikliği:** Faz 11 mevcut 152 düğümü yeniden numaralandırmadan sürümlü `RegionModel` sözleşmesiyle tamamlandı. `STORY.nodes` canlı dinamik gerçek kaynak olarak korundu; kalıcı kimlik, normalleştirilmiş merkez, sınıflandırma ve komşuluk topolojisi ayrı, doğrulanan bir sidecar’da donduruldu. Sahiplik, ekonomi, garnizon ve kara lojistiği bu iki kaynağı çoğaltmadan canlı düğümden türetilir. Yeni ve eski kayıt, bozuk model fallback’i, V1/V2 kimlik-konum-komşuluk mutabakatı, kırık referanslar, çift yönlü bağlantı, özellik bayrağı ve kayıt/yükleme otomatik test edildi. `world.regionModel` açık/kapalı 900 saniyelik A/B aynı `623ba9…e1c`, 30 yıllık soak aynı `5e8d3c…403f` karmasını korudu.

**1.20 değişikliği:** Faz 12 kamera, seçili şehir ve açık panellerden tamamen bağımsız sürümlü `HOT/WARM/COLD` bölge aktivasyon bütçeleyicisiyle tamamlandı. Dünya gerçekleri komutan, savaş, kuşatma, başkent, yakın kontrol değişimi, cephe, altyapı ve nüfus önceliğine dönüştürülür; 152 bölge deterministik olarak `12/48/92` bütçesine ayrılır. Sistem ve bölge kimliğinden türetilen faz ofseti HOT/WARM/COLD bölgeleri 20 tikte tam `20/5/1` kez seçer. Yoğun kamera/panel kullanımının 60 saniyelik dünya sonucunu değiştirmediği, kayıt/yükleme ve eski/bozuk politika fallback’leri otomatik test edildi. `world.regionActivation` açık/kapalı 900 saniyelik A/B aynı `623ba9…e1c`, 30 yıllık soak aynı `5e8d3c…403f` karmasını korudu.

**1.21 değişikliği:** Faz 13 sürümlü ve checksum’lı bölge kapsülleriyle tamamlandı. Canlı 152 bölgenin nüfus, servet, garnizon, altyapı, yatak, üretim kuyruğu, eski birlik havuzu ve bekleyen olay özetleri ile ülke kaynakları için koruma imzası kuruldu; HOT→COLD→HOT geçişi tam kanonik payload’ı kayıpsız geri açar. Gelecekte eklenecek bölgesel stok/şirket alanları zengin fixture ile doğrulandı; gerçek dünyada henüz bulunmadıkları açıkça ayrıldı. Bozuk checksum, değişmiş topoloji, eski kayıt, özellik kapalı yol, kamera/panel tarafsızlığı ve deterministik sabit-ondalık dağıtım test edildi. `world.regionAggregation` açık/kapalı 900 saniyelik A/B aynı `623ba9…e1c`, 30 yıllık soak aynı `5e8d3c…403f` karmasını korudu.

**1.22 değişikliği:** Faz 14 sürümlü altyapı ve ulaşım grafıyla tamamlandı. 152 bölge üzerinde 177 kara ve açıkça tanımlanmış 20 deniz koridoru; bunların üstünde 197 enerji ve 197 veri katmanı olmak üzere 591 kalıcı koridor kuruldu. Her koridor kapasite, hasar, etkin kapasite, maliyet, gecikme, uç bölge ve canlı sahip erişimi taşır. Deterministik rota, bağlı akış çözümü, kesinti izolasyonu, katı graf doğrulama, kompakt dinamik kayıt, eski/bozuk kayıt fallback’i ve V2 teşhis projeksiyonu eklendi. Tek kara koridorunun kesilmesi bağlı akışı durdururken bağımsız kara/enerji/veri akışlarını değiştirmedi. `world.infrastructureGraph` açık/kapalı 900 saniyelik A/B aynı `623ba9…e1c`, 30 yıllık soak aynı `5e8d3c…403f` karmasını korudu.

**1.23 değişikliği:** Faz 14.1 bilgi filtreli şehir dosyasıyla tamamlandı. Haritadan oyuncu veya yabancı şehir açılabilir; genel, lojistik, tarih, karakterler ve kendi şehirleri için bina/ordu sekmeleri aynı dosyada çalışır. Nüfus, servet, garnizon, sanayi, yatak ve lojistik PlayerKnowledge üzerinden geçer; yabancı kesin olmayan değerler `UNKNOWN/null` kalır. Kendi koridorlarından bağlı şehre, şehir tarihinden nedensel olaya ve doğrulanmış karakterden sohbet merkezine bağlamsal geçiş eklendi. Doğrudan karakter görüşmesi, stok, şirket ve yerel kurum katmanları uydurulmaz; “sistem henüz yok” diye işaretlenir. Beş kasıtlı yabancı sentinel değerinin view-model/HTML’e sızmadığı, UI salt-okunurluğu ve `ui.cityDossier` A/B tarafsızlığı otomatik test edildi. 900 saniyelik karma `623ba9…e1c`, 30 yıllık soak `5e8d3c…403f` kaldı.

**1.24 değişikliği:** Faz 14.2 sürümlü `canonical-map-raster-1` sözleşmesiyle tamamlandı. `GEO.land` artık kanonik `820×645` kara maskesine yalnız bir kez rasterize edilir; `152` bölgenin kimlik rasteri, eski normalleştirilmiş mesafe semantiğini koruyan deterministik KD-tree ile aynı kaynaktan üretilir. Terrain, siyasi overlay, kıyı örneklemesi ve harita hit-test’i bu rasteri tüketir; bozuk sürüm, boyut, kara/deniz değeri, region kimliği, kaynak karması ve checksum açıklamalı doğrulama kodlarıyla reddedilir. 300×236 gerçek overlay grid’i ile kanonik resample arasında `0` region farkı ve `0` kara/deniz sızıntısı ölçüldü; ancak düşük çözünürlüklü overlay kanonik ince kara hücrelerinin `%0,7864`’ünü kaybediyor ve çözünürlükler arası kıyı örnek farkı `153/70.800` (`%0,2161`) kalıyor. Bu, Faz 14.3’ün yüksek çözünürlüklü `ImageData` overlay borcudur. Bayrak A/B karması `623ba9…e1c`, 30 yıllık soak `5e8d3c…403f` kaldı; modern dünya yakınsaması değişmedi.

**1.25 değişikliği:** Faz 14.3 `political-overlay-rgba-1` sözleşmesiyle tamamlandı. Politik renk ve devlet sınırı artık kanonik `820×645` `RegionIdRaster` üzerinden `Uint8ClampedArray RGBA` ve ayrı `Uint8Array borderMask` olarak üretilir; 300×236 çözünürlük ve hücre başına `fillRect` ana yoldan kaldırıldı. İlk çizim ve her sahiplik revizyonu tek `putImageData` kullanır; değişmeyen sahiplik aynı canvas/revision’ı korur, gerçek `storyTransferNodeOwnership` cache’i `territory-transfer` nedeniyle geçersiz kılar ve tam bir kez yeniler. Ölçümde eski fallback `47.137 fillRect`, yeni yol `0 fillRect + 1 putImageData`; `351.997` kara pikselinin tamamı renkli, `176.903` deniz pikselinin tamamı şeffaf ve denizde sınır sayısı sıfırdır. Kaynak/sahiplik/RGBA/sınır checksum’ları ile sınır topolojisi doğrulanır. jsdom gerçek Canvas/GPU maliyetini modellemediği için gerçek EXE rebuild süresi ve piksel görünümü hâlâ zorunlu manuel kapıdır; çağrı azalması kanıtlandı fakat tarayıcı hızlanması uydurulmadı. 900 saniyelik karma `623ba9…e1c`, 30 yıllık soak `5e8d3c…403f` kaldı.

**1.26 değişikliği:** Faz 14.4 build-time `canonical-map-raster-asset-1` varlığıyla tamamlandı. `820×645` ve `528.900` piksellik region rasteri `10.766` adet `int16+uint16` RLE kaydına sıkıştırılarak `43.064` bayt payload içinde paketlendi. Üretici aynı girdide byte düzeyinde aynı dosyayı verir. Açılışta asset şema/adaptör/encoding, GEO+bölge kaynak checksum’ı, payload checksum’ı, run/piksel sayısı ve çözülmüş land/region checksum’larından geçer; eksik, eski veya bozuk varlık açık hata koduyla KD-tree fallback’e döner. Ölçümlerde asset yükleme+tam doğrulama yaklaşık `54–88 ms`, runtime üretim+doğrulama `111–169 ms`; iki yol aynı `f76a938c/f63d135c/2dc42a47` checksum’larını üretir. 900 saniyelik dünya karması `623ba9…e1c`, 30 yıllık soak `5e8d3c…403f` kaldı.

**1.27 değişikliği:** Faz 14.5 adaptif warp planı ve render bütçesiyle tamamlandı. Sabit `3 px` şerit yerine 720p/1080p/1440p’de `4/5/7 px`, yakın 1080p zoom’da `4 px` band kullanılır. Terrain ve politik katman aynı önbelleklenmiş warp geometrisini paylaşır. 1080p iki katmanlı draw-call `720→432` (`%40`), 1440p `960→412` düştü. Döngü içi sessiz `try/catch` kaldırıldı; geçersiz kaynak çizim öncesinde kodlu teşhis üretir. Ekran↔dünya tersinim hatası sıfır, en yüksek ölçülen bant ölçek hatası `%0,2101` oldu. jsdom gerçek GPU p95’ini ölçmediği için EXE profili açık kapıdır. A/B karması `623ba9…e1c`, soak `5e8d3c…403f` kaldı.

**1.28 değişikliği:** Faz 14.6 sürümlü `story-map-cache-invalidation-1` kapısıyla tamamlandı. Geometri, türetilmiş render, sahiplik, çağ, palet ve viewport invalidation kapsamları tek `storyInvalidateMapCaches` sözleşmesinde ayrıldı. Sahiplik yalnız politik katmanı yeniler; terrain/raster/warp nesnelerini korur. Gerçek çağ geçişi terrain cache’ini yeniler ve altı çağın RGB profili `paletteId/paletteKey` ile piksel çıktısına girer; çağ değişimi politik revision veya warp planını gereksiz değiştirmez. README çalışan `3000 px` mimari ve gerçek index/paket sırasıyla düzeltildi; kök `StoryGeoRender.js` paketlenmeyen prototip, `js/MapData.js` aktif taktik kaynak olarak otomatik denetime bağlandı. 900 saniyelik A/B karması `623ba9…e1c`, 30 yıllık soak `5e8d3c…403f` kaldı.

**1.29 değişikliği:** Faz 15, sürümlü `story-resource-taxonomy-1` kaynak sözleşmesiyle tamamlandı. Sekiz kalıcı kaynak kimliği; açık birim, üretici, tüketici, depolama, taşıma ve faza bağlı yokluk etkileriyle tek katalogda tanımlandı. Katalog `fnv1a32:4a4ba0fe` checksum’ı ve katı doğrulayıcıyla korunur. Eski `oil/manpower/points` alanları silinmedi veya yeni ekonomi stoğuymuş gibi yeniden adlandırılmadı; yalnız `energy/labor/capital` için `LEGACY_ALIAS`, `HIGH` anlam kaybı ve eski alanın yazma yetkisini koruyan uyumluluk sınırı kuruldu. Diğer beş kaynak Faz 17’ye kadar `null / UNAVAILABLE_PHASE_17` döner. Kompakt kayıt başlığı, eski kayıt backfill’i, bozuk checksum kurtarması ve tam eski→yeni→eski dönüş otomatik test edildi. `economy.resourceTaxonomy` A/B koşusunda dünya karması `623ba9…e1c`, 30 yıllık soak `5e8d3c…403f` kaldı. Faz 15 gerçek üretim, tüketim veya stok sistemi eklemedi; modern dünya hegemonyası çözülmedi.

**1.30 değişikliği:** Faz 16, sürümlü `story-production-sectors-1` üretim sözleşmesiyle tamamlandı. Tarım, enerji, hammadde çıkarımı, sivil sanayi, ileri teknoloji ve savunma sanayisi için altı sürümlü reçete; kapasite, iş gücü ve baz/minimum/maksimum verimlilik politikalarıyla tanımlandı. Tarım, enerji ve çıkarım doğal kapasite/rezerve bağlı `ENDOWMENT_BOUND`; üç sanayi sektörü malzeme eşdeğeri çıktıyı girdiden büyük yapamayan `MASS_EQUIVALENT` koruması kullanır. Bilinmeyen kaynak, birim uyuşmazlığı, sıfır girdi, doğal kapasitesiz birincil üretim, girdisiz fiziksel çıktı, kütle kazancı ve yetkisiz üretici reddedilir. Deterministik teklif motoru `READY/PARTIAL/BLOCKED` sonucu ile kapasite, stok ve doğal kapasite darboğazlarını ayrı raporlar; çağıranın verisini veya canlı dünyayı değiştirmez. Katalog checksum’ı `fnv1a32:a4007f41`; kompakt kayıt başlığı `327` bayt, tam katalog görünümü `6.982` bayttır. `economy.productionSectors` A/B karması `623ba9…e1c`, 30 yıllık soak `5e8d3c…403f` kaldı. `liveStockSystem: false` ve `proposalsCommit: false`; gerçek stok/tüketim Faz 17’ye bırakıldı, hegemonya çözülmedi.

**1.31 değişikliği:** Faz 17, sürümlü `story-regional-stock-ledger-1` kanonik bölgesel stok sistemiyle tamamlandı. 152 bölgenin sekiz kaynağı, güvenli stok hedefi, doğal kapasitesi ve altı sektör kapasitesi tek defterde tutulur; eski `oil/manpower/points` sayaçları stoğa dönüştürülmez. Faz 16 teklifleri reçete/hash/stok/doğal kapasite yeniden doğrulanmadan yazılamaz ve bütün girdi/çıktı tek atomik commit olur. Hane, ordu, devlet ve şirket talepleri öncelik ve rezerv kullanma hakkına göre ayrılır; karşılanmayan talep tüketici/kaynak/neden/miktar/etki ile `ACTIVE`, stok yenilenince `RESOLVED` yaşam döngüsü taşır. Gıda bozulması, enerji tampon kaybı, parça/elektronik eskimesi, askerî ikmal kaybı ve stoklanamayan emek deterministik muhasebeye girdi. Oyuncu kendi bölgesel stoğunu doğrulanmış görür; yabancı stok istihbaratsız `UNKNOWN/null` kalır. Kayıt/yükleme, eski kayıt backfill’i, bozuk defter kurtarması, HOT/WARM/COLD kapsül aynası, kaynak koruma denklemi ve 30 yıllık ledger doğrulaması geçti. `economy.regionalStocks` 900 saniyelik A/B’de yeni dünya karmasını bilinçli olarak `491dae…f803 → a4acc6…ad1e` değiştirdi; eski refah/enflasyon/öfke/toprak/eski kaynak metriklerinin bütün deltaları sıfır kaldı. 30 yıllık soak karması `93ac47…ffa` oldu. Bu faz denge zaferi değildir: 900 saniyede gıda ve enerji toplamı sıfıra inerken `1.407` benzersiz kıtlık kaydı ve `2.268.902` sermaye stoğu oluştu; ticaret/fiyat/bütçe henüz yoktur ve devlet `3` uzun koşuda yine `152/152` bölgeye ulaşır. Bu açık borç Faz 18–20’ye taşındı.

**1.32 değişikliği:** Faz 17.1 modern barış başlangıcı düzeltmesiyle tamamlandı. Önceki diplomasi kodu eksik her ilişkiyi `war` kabul ediyor, ateşkes bittiğinde otomatik savaşa dönüyor ve genelkurmay hedef üretimi diplomasi kontrolünü atlayabiliyordu. Yeni kampanya sekiz devletin 28 ikili kenarını açık `peace` durumunda kurar. Ateşkes bitişi barışa döner; AI’nin barışı bozması ciddi negatif ilişki, ortak sınır, şahin doktrin ve açık olasılık kapısı gerektirir. Genelkurmay, emir uygulama, kuşatma başlatma/çözme ve oyuncu savaş ekranı aynı düşmanlık kapısını kullanır. Oyuncu barıştaki devlete saldırmak isterse önce açık savaş ilanı ve itibar sonucu görür. 120 saniyelik A/B’de barış yolu `0`, eski tüm-savaş yolu `5` sahiplik değişimi üretti. 900 saniyelik standart koşu `8/8` devleti ve başlangıçtaki `152/152` sahiplik dağılımını korudu; karma `a1935a…7ac1`. Bu düzeltme devlet AI’sini modern yapmadı: barışta ekonomi/diplomasi/kurum/karakter hedefleri arasında ulusal gündem seçen motor hâlâ yok. Bu ve diğer açıklar `MODERN_DUNYA_EKSIKLERI.md` içinde kalıcı olarak izlenecek. Tam karakter sistemi Faz 34–38.5’tedir; mevcut isimli başkan, eksen ve komutan kişiliği yalnız kısmi ön çalışmadır.

**1.33 değişikliği:** Faz 18, `story-trade-logistics-ledger-1` fiziksel ticaret defteriyle tamamlandı. Fazla stok doğrudan hedefe yazılmaz: sürümlü sözleşme ve sipariş kurulur, yük gönderici stoğundan çıkar, Faz 14 koridorlarında ayak ayak ilerler ve yalnız teslimatta alıcı stoğuna girer. Kara/deniz ve enerji ağı ayrı taşıma modlarıdır; ortak koridor kapasitesi aynı penceredeki akışlar arasında tüketilir. Hasarlı hat ilerlemeyi yavaşlatır, kapalı hat yükü `HELD` durumuna alır. Yetkili sözleşme değişikliği sevkiyatı yeni depoya yönlendirebilir; eski hedefe hayalî stok yazılmaz. Sınır ötesi yük mülkiyeti teslimata kadar satıcıda, teslimattan sonra alıcıdadır. Kayıt/yükleme yoldaki yükü birebir korur; eski veya bozuk ticaret kaydı bölgesel stoklara dokunmadan boş deftere alınır. PlayerKnowledge ve şehir dosyası yalnız oyuncunun kendi ticaret ayrıntısını doğrulanmış gösterir. 900 saniyelik A/B’de ticaret `28.844,74` kaynak birimini fiziksel olarak teslim etti ve yeni dünya karması `fabd03…7e66 → 064495…a5b` oldu; eski refah, toprak ve `oil/manpower/points` metrikleri değişmedi. Ancak gıda ve enerji yine sıfıra indi, kıtlık sayısı yalnız `1197 → 1196` düştü ve sermaye `2,20 milyon` düzeyinde kaldı. Bu sonuç taşıma zincirinin çalıştığını ama toplam üretim açığını, fiyatı, bütçeyi veya ekonomik AI’yi çözmediğini açıkça kanıtlar.

**1.34 değişikliği:** Faz 19, `story-market-price-ledger-1` bölgesel piyasa defteriyle tamamlandı. Bölgesel ekonomi her tikte kaynak bazında gerçekleşen talep, teslim, karşılanamayan miktar, üretim girdisi ve çıktısını saklar; fiyat katmanı bu akışları mevcut/güvenli stok, stok günü, yoldaki yük, bekleyen yük ve koridor hasarıyla birleştirir. Altı fiziksel mal/enerji için baz `100`, sınır `25–800`, hedef çarpanı `0,35–6`, yumuşatma `0,22` ve tek-tik hareket tavanı `%10` olan endeks fiyatları üretildi. Hane ve üretici sepetleri bölge/ülke düzeyinde nüfus ağırlıklı hesaplanır. İş gücü mevcut `NON_STOCK` modeli yüzünden `DEFERRED/null`, sermaye Faz 20’ye kadar `NUMERAIRE/1` durumundadır; eski `st.inflation` alanı değiştirilmez. Ticaret için para yaratmayan `INDICATIVE_INDEX_QUOTE / PAYMENT_PENDING_PHASE_20` görünümü eklendi. 200 küçük ters yönlü şokta toplam salınım yalnız `0,1572`; sıfır stok hedefi `600`, ilk hareket `100→110`; tam kesintili bekleyen yük aynı fiziksel koşulun fiyat hedefini `52,73→63,52` yükseltti. 900 saniyelik A/B’de yalnız piyasa defteri değişti (`3ceb63…42e4 → 412e5b…548f`); fiziksel dünya birebir aynı, refah/enflasyon/huzursuzluk/toprak/eski kaynak deltaları sıfırdır. Buna rağmen `912` aktif fiyatın `671`i kritik, ortalama endeks `414,94` oldu: Faz 19 kıtlığı görünür kıldı, çözmedi. 30 yıllık soak `a08f0a…992a` karmasıyla ve fiyat sınırları korunarak geçti.

**1.35 değişikliği:** Faz 20, `story-state-budget-ledger-1` devlet bütçesi ve çift taraflı muhasebe defteriyle tamamlandı. Legacy `points`, devlet parası diye yeniden adlandırılmadı; komutan cüzdanları kanonik `ASSET:CASH` hesabının alt hesapları olarak korundu ve toplamları her yazımda mutabakata bağlandı. Şehir puan geliri vergi geliri; konsey, üretim, bina, medya, fraksiyon tavizi ve sermaye kaçışı kaynak etiketli gider oldu. Tek taraflı her fiş, negatif nakit, eksik devlet hesabı ve bakiye üstü harcama reddedilir. Borç ihracı tavanlıdır; faiz ve anapara dünya günüyle işler, ödenmeyen faiz borca eklenir ve 60 gün gecikme temerrüt üretir. Para basımı ayrı karşı hesapta kalır, enflasyonu artırır ve güveni düşürür. Faz 18 ticareti kayıt uyumlu biçimde genişletildi: sınır ötesi fiyat sevkte kilitlenir, alıcı nakdi escrow’a alınır, teslimatta satıcıya aktarılır; kayıp yükte bloke çözülür. Faz 20 öncesinden yolda kalan dış ticaret yükü yüklemede ya finanse edilir ya `PAYMENT_RESERVATION_REQUIRED` ile bekler; mal silinmez veya bedava teslim edilmez. Otoyol önergesinin `150⭐` harcayıp yaklaşık `400⭐` yaratması, tasarruf önergesinin kişi başına `60⭐` basması ve yeni komutan atamasının karşılıksız `200⭐` üretmesi kaldırıldı. Oyuncunun kendi bütçesi V2/PlayerKnowledge/şehir `BÜTÇE` sekmesinde `VERIFIED`, yabancı bütçe `UNKNOWN/null` görünür. 900 saniyede defter geçerli kaldı: toplam nakit `17.903,29`, borç `2.163,03`, açık bloke ve temerrüt `0`; karma `29b96416…2acb`. 30 yıllık soak `4b1b3fa0…c9dac` karmasıyla; nakit `71.196,57`, borç `1.380,52`, temerrüt `0` ve geçerli muhasebeyle tamamlandı. Bu mali kimlik ve ödeme katmanıdır, dengeli modern ekonomi değildir: kamu hizmeti bütçeleri, şirket/banka hesapları, kur, ücret, kredi piyasası, bölgesel `capital` karşı hesabı ve kıtlığa yatırım tepkisi hâlâ Faz 21–23 borcudur.

**1.36 değişikliği:** Faz 21, `story-company-bank-ledger-1` şirket/banka/mülkiyet defteriyle tamamlandı. Altı sektörde sekiz devlet için `48` ayrı şirket, `8` banka, `412` şirket mülkiyetli tesis ve `152` depo oluşturuldu; şirket nakdi devlet kasasından ayrıldı. Üretim sermayesi artık dışarıdan sınırsız eklenen bir numeraire değil, ilgili sektör şirketinin gerçek işletme nakdidir; üretim gideri ve piyasa geliri çift taraflı fişle şirket bilançosuna geçer. Sınır ötesi ticaret geliri satıcı devlete değil malın sahibi şirkete ödenir. Banka kredisi rezervi azaltıp şirket borcunu artırır; borç/özkaynak tavanı, faiz, ödeme güçlüğü, iflas ve tesis kayyımlığı durumları doğrulanır. Kapasite yatırımı şirket nakdi ile gerçek sanayi parçası/elektronik stoğunu atomik olarak tüketir, `180` dünya günü inşa bekler ve ancak tamamlanınca tesis kapasitesini artırır. Şirket başvurusu sermaye ve ruhsat tamamlanmadan kaydedilemez; lobi harcaması şirket nakdinden çıkar. WorldV2, oyuncu bilgi filtresi ve şehir `ŞİRKETLER` sekmesi yalnız yetkili/doğrulanmış veriyi gösterir. Hedefli kredi, yatırım, başvuru, lobi, bozuk kayıt, bilgi sızıntısı ve özellik-kapalı testleri; 900 saniyelik A/B ve 30 yıllık soak geçti. 900 saniyede soyut sermaye `2.190.739,69` yerine şirket likiditesine bağlı `73.138,70` oldu; şirket nakdi `73.458,70`, piyasa takas hesabı `27.686,44` ve aktif iflas `0` kaldı. 30 yılda `48` şirket/`8` banka/`412` tesis korundu; şirket nakdi `94.013,60`, banka rezervi `11.200`, şirket borcu ve otomatik proje sayısı `0` oldu. Son iki sıfır başarı değildir: ekonomik aktörlerin kendi kendine yatırım/kredi/ticaret stratejisi henüz yoktur; Faz 22 bunu aynı mali ve fiziksel kurallar altında kurmalıdır.

**1.37 değişikliği:** Faz 22, `story-economic-ai-ledger-1` ekonomik karar defteriyle tamamlandı. Şirketler bölgesel stok/güvenli hedef, gerçekleşmiş dolum, fiyat primi, kâr marjı, şirket nakdi, borç tavanı, banka rezervi ve fiziksel yatırım girdilerinden deterministik aday üretir. Seçici, eşik altı veya gerçekleştirilemez adayı açık kodla reddeder; uygun olduğunda kendi nakdiyle ya da gerçek banka kredisiyle yatırım başlatır. En az `80` işletme sermayesi korunur; yatırım `140` nakit, `18` sanayi parçası ve ileri teknolojide `3` elektronik tüketip `180` dünya günü bekler. AI devletleri yalnız kendi stratejik gıda/enerji şirketlerine, özel finansman gerçekten tükenmişse ve hazinede `800` rezerv kalıyorsa hedefli destek verebilir; oyuncu hazinesi otonom AI kapsamı dışındadır. Destek devlet bütçesinden eksilir ve şirket defterine aynı tutarda girer. Adaylar, sinyaller, reddetme nedeni, seçim, uygulama ve gerçekleşen kapasite sonucu kaydedilir; eski/bozuk kayıt, bilgi filtresi ve özellik-kapalı yol doğrulanır. Hedefli koşuda `7` kredi, `7` süreli yatırım, `7` gerçekleşen kapasite artışı ve `1` bütçeli destek oluştu; iflas ve oyuncu-hazinesi müdahalesi olmadı. 900 saniyelik A/B gıda üretimini `821,04→3.046,94` yükseltti fakat gıda stoğu yine `0`, enerji `13,30→0` ve kritik fiyat `608→611` oldu. Faz karar eksikliğini kırdı; ekonomik dengeyi, emek/ücret/kur/mevduatı veya ulusal çok alanlı gündemi çözmüş sayılmayacaktır.

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

### Tek dünya, altı rol merceği

Ekonomi, siyaset veya bilgi sistemi her oyuncu rolü için yeniden yazılmaz. Tek kanonik `StoryWorldStateV2` üzerinde rol yalnız üç şeyi değiştirir: **yetki kümesi**, **bilgi projeksiyonu** ve **karar zaman ufku**. Aynı gıda kıtlığı altı ayrı stok hesabı üretmez; aynı fiziksel olay farklı aktörlere farklı görev, risk ve bilgi olarak görünür.

| Rol merceği | Kanonik sistemle temas | Doğrudan karar döngüsü | Bilgi niteliği |
|---|---|---|---|
| Şirket sahibi | Şirket, tesis, stok, satış, sözleşme, banka | Ne üretilecek, kime satılacak, stok/yatırım/finansman | Kendi defteri doğrulanmış; rakip ve piyasa tahminli |
| Belediye başkanı | Bölge, yerel bütçe, altyapı, stok ve hizmet | Yerel yatırım, dağıtım, izin, kriz müdahalesi | Yerel kurum raporu; merkez ve özel sektör kısmen gecikmeli |
| Cumhurbaşkanı/başbakan | Devlet bütçesi, kanun, vergi, gümrük, teşvik | Mikro üretim değil politika, atama ve kaynak bütçesi | Toplu ve gecikmeli; bürokratik/medya çerçevesi taşıyabilir |
| Komutan | Ordu, hazırlık, askerî stok ve lojistik talebi | Konuşlanma, ikmal talebi, harekât ve askerî ilişki | Kendi kuvveti doğrulanmış; düşman ve sivil ekonomi sınırlı |
| Ajan | `ActorBelief`, kaynak güveni, paravan ağ ve gizli faaliyet | Bilgi edinme, doğrulama, sızdırma, yanıltma, sabotaj | Gerçek yerine kaynaklı iddia ve çelişkilerle oynar |
| Sivil | Kohort ihtiyaçları, iş, fiyat, güvenlik ve yerel ağ | Geçim, hareket, örgütlenme, tanıklık ve ilişki | Kişisel deneyim güçlü; makro ve gizli sistemler zayıf |

Rol değiştirmek serbest bir geliştirici kamerası değildir. Oyuncu bir aktörü kontrol eder; makam kazanma/kaybetme, atama, seçim, darbe, şirket edinimi, görev değişimi veya senaryo devri olay/komut hattından geçerse aynı kampanyada mercek değişebilir. QA aynı dünya fotoğrafını farklı rol projeksiyonlarıyla okuyabilir, fakat bu projeksiyon dünya durumunu değiştiremez. İlk yayımlanabilir yolların derinliği eşit olmak zorunda değildir: komutan ve şirket sahibi tam dikey döngüyle; ulusal/yerel yönetici daha seyrek kurumsal kararlarla; ajan bilgi sistemi olgunlaştıktan sonra; sivil ise önce sınırlı prolog/kriz senaryosuyla kanıtlanır. Bu bir kalıcı kalite sınıfı değil teslim sırasıdır.

Rol bilgisinin ortak hattı:

```text
WorldFact / kanonik defter
→ ActorBelief ve kaynak/yaş/güven kayıtları
→ RoleAuthorityProjection
→ DomainViewModel
→ UI / sohbet bağlamı
```

Hiçbir rol kendi kopya enflasyon, stok veya şirket sayısını tutmaz. Aynı sayı farklı doğrulukta görülebilir: şirket sahibi kendi nakdini kesin, cumhurbaşkanı enflasyonu gecikmeli toplu rapor, ajan ise resmî rapor ile çalınmış kayıt arasındaki çelişki olarak görür. Görünür sayıların tamamı aynı gerçek kimliğine ve gözlem kaynağına geri bağlanır.

**Kıtlık sözleşmesi:** Hedef “hiç kıtlık olmaması” değildir; periyodik, yerel veya sektörel, nedeni izlenebilir ve oyuncu/AI müdahalesiyle iyileştirilebilir kıtlık oynanış üretir. Buna karşılık ekonominin kalıcı olarak temel ihtiyacı karşılayamaması, bütün bölgelerin aynı kıtlığa çökmesi veya hiçbir rolün geçerli karşı hamle bulamaması tasarım değil sistem arızasıdır. Bir kıtlık oynanabilir sayılmak için başlangıç nedeni, etkilenen sahipli stok/rota, rol başına en az bir meşru müdahale, erken belirti, kötüleşme eşiği ve ölçülebilir toparlanma yolu taşımalıdır.

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

**Uygulama sonucu:** `js/StoryMigration.js`, kaynağı değiştirmeyen saf dönüştürücü ile yedek→hedef→rapor sıralı depolama kapısını kurdu. İlk başarılı göç tam üç ayrı anahtar yazar; kaynak anahtarına hiçbir zaman yazmaz. Yazılan V2 tekrar parse edilip `storyWorldV2Validate` ile doğrulanır. Geçerli referans kayıtta ülke/bölge sayısı, bölge sahipleri, ülke kaynakları ve oyuncu komutanı bire bir mutabık kaldı. Bozuk veya çakışmalı dört hata sınıfında yazma sayısı `0` olarak test edildi. Bu faz V2 gölge kopyasını üretir; canlı `storyLoad()` henüz V3 kaynağını kullanır.

### FAZ 6 — Deterministik Saat ve Takvim

**Amaç:** Gerçek saniye sayaçlarını oyun takvimine bağlamak.  
**Çıktı:** Sabit adım, hız seviyeleri, duraklatma, tarih dönüşümü.  
**Kabul kapısı:** Farklı FPS ve hız ayarlarında aynı kararlar aynı dünya karmasını üretiyor.  
**Bağımlılık:** Faz 4.

**Uygulama sonucu:** `js/StoryClock.js`, dünya motorunu `0,25` saniyelik sabit adımlarla çalıştırır. Render yalnız gerçek süre sağlar; motor 1×/2×/4× hızda aynı tik dizisini tüketir. Saat şeması hız, toplam tik ve kısmi adım kuyruğuyla V3 kayda ve V2 zamanlayıcı görünümüne taşınır. Takvim `01.01.2032` başlangıcı, 360 günlük yıl ve 120 saniyelik oyun yılı için tek dönüşüm noktasıdır. 30/60/144 FPS, jitter ve üç hız düzeyinin 30 oyun saniyesindeki karması aynıdır; duraklatma dünyayı veya kuyruğu değiştirmez. Test konseyi artık gerçek oyun gibi tik tamamlandıktan sonra çözülür. Eski değişken-adım yolu yalnız A/B ve güvenli geri dönüş için `time.fixedStep` bayrağı arkasında tutulur.

### FAZ 7 — Tohumlu Rastgelelik

**Amaç:** Meta katmandaki doğrudan `Math.random()` bağımlılığını kaldırmak.  
**Çıktı:** Alt sistem akışlarına ayrılmış RNG, RNG durum kaydı.  
**Kabul kapısı:** Kayıt/yükleme sonrası rastgele olay dizisi bozulmuyor.  
**Bağımlılık:** Faz 6.

**Uygulama sonucu:** `js/StoryRng.js`, tek kök tohumdan türeyen dokuz adlandırılmış RNG akışı sağlar: `world`, `character`, `military`, `economy`, `society`, `production`, `diplomacy`, `narrative`, `governance`. Her akış kendi 32-bit durumunu ve çağrı sayısını taşır. Hikâye domainlerinde doğrudan `Math.random()` kullanımı otomatik testle yasaktır. RNG durumu V3 kayda, V2 teşhisine ve motor içi durum karmasına girer. Kaydetme noktasından sonraki her akışın sekiz değeri yükleme sonrasında aynen devam eder. Anlatı akışına 100 ek çağrı askerî diziyi değiştirmez; `rng.streams=false` A/B yolunda değiştirmesi izolasyonun gerçek etkisini kanıtlar. RNG taşımayan eski kayıt, kayıt içeriği/tohumu üzerinden aynı fallback durumuna gelir ve uyarı üretir. Tam dünya kaydet→yükle→devam eşitliği, dağınık zamanlayıcı sayaçlarının kalıcılığını kuracak Faz 8 ile kapanacaktır.

### FAZ 8 — Sistem Zamanlayıcısı

**Amaç:** Dağınık `_acc...` sayaçlarını açık bir iş sırasına taşımak.  
**Çıktı:** Global/ülke/bölge/kriz görev kuyrukları.  
**Kabul kapısı:** Görev sırası testle sabit; aynı sistem bir adımda iki kez çalışmıyor.  
**Bağımlılık:** Faz 6–7.

**Uygulama sonucu:** `js/StoryScheduler.js`, kaynak, üretim, komutan AI, sadakat, ekonomi, şehir büyümesi, fraksiyonlar, toplum, kuşatma, teknoloji, komutan sohbeti, oyuncu konuşmaları, diplomasi, çağ, şehir geliştirme ve komutan yenileme görevlerini aynı sürümlü sırada çalıştırır. Her görev `intervalSeconds`, `elapsedSeconds`, `runCount` ve `lastRunSequence` taşır; büyük adımda eski motorla aynı biçimde tek çalıştırma ve sayaç sıfırlama politikası uygulanır. Sicil V3 kayda, V2 projeksiyon/göç teşhisine ve durum karmasına girer. `scheduler.registry=false` eski `_acc...` yolunu korur ve 30 saniyelik hedefli A/B koşusunda dünya sonucu yenisiyle aynıdır. On dört saniyelik periyot probu bütün görev çalışma sayılarını doğrular; ek `0,25` saniye hiçbir görevi ikinci kez çalıştırmaz. Sicilsiz eski kayıt uyarılı fallback ile açılır.

Tam devamlılık kapısı yalnız sayaçlarla sınırlandırılmadı. Kayıt, AI genelkurmay hedefleri, komutan hareket/firar cooldown’ları, kuşatmalar, küresel istila/darbe beklemeleri ve bekleyen konuşma kuyruğunu korur. Canlı fonksiyon taşıyan konuşmalar, oluşturma öncesi RNG fotoğrafı ile şablon içi seçim izi kullanılarak yüklemede yeni RNG tüketmeden yeniden kurulur. Headless kabul testi `73,125` saniyelik kesme noktasından `90,875` saniye devam eder ve kesintisiz `164` saniyelik koşuyla telemetri performans ölçümü dışında bütün kaydı bire bir karşılaştırır. Yüklemede güncel GEO şehirlerinin petrol/maden/şehir kaynaklarını eski `STORY_TERRAIN` koordinatlarıyla yeniden dağıtan kritik hata da bu kapı sayesinde bulundu ve kaldırıldı.

### FAZ 9 — Olay Defteri ve Komut Hattı

**Amaç:** Bütün kalıcı değişiklikleri izlenebilir yapmak.  
**Çıktı:** `WorldCommand`, `WorldEvent`, `Effect`, korelasyon ve neden kimliği.  
**Kabul kapısı:** Büyük her değer değişiminin kaynak olayı bulunabiliyor.  
**Bağımlılık:** Faz 4, 8.

**Uygulama sonucu:** `js/StoryCausality.js`, `schemaVersion: 1` taşıyan sınırlı ve kaydedilebilir üç defter kurar. `WorldCommand` aktör, hedef, yük, korelasyon, kök komut ve idempotency anahtarını; `WorldEvent` kaynak komut, neden/kök olay ve durumunu; `Effect` hedef alan yolu, işlem, eski/yeni değer ve deltayı taşır. `storyCausalityTrace`, herhangi bir etki veya olay kimliğinden kaynak komut ile bütün kardeş olay/etkilere geri yürür.

Canlı pencere en çok `180` komut, `360` olay ve `720` etki tutar. Sınır aşımında listeler bağımsız kırpılmaz: en eski komut ile yalnız ona bağlı olay/etkiler tek işlem olarak düşürülür. Böylece tutulan hiçbir etki yetim komut/olay referansı taşımaz. Toplam düşürülen kayıt sayıları ayrıca korunur.

Canlı yazım kapıları:

- `storyTransferNodeOwnership`: savaş, AI soyut savaşı, kuşatma, savaşmadan bırakma ve darbe sahipliklerini mutasyon anında kaydeder; gözlem tikindeki çift telemetriyi engeller.
- `storyMoveCommander`: AI ilerleme, savunma, saldırı, takviye, geri çekilme, işgal ve firar hareketlerini kaydeder.
- `storyWelfareDelta`: refahın eski/yeni değerini kaynak etiketiyle etkiye dönüştürür.
- `storyResourceFlow`: tek seferlik harcama/iadeyi ayrı, sürekli şehir gelirini 10 saniyelik toplu kaynak etkisi olarak kaydeder.
- `storyRelAdd`, `storySetTreaty`, `storyBreakTreaty`: ilişki, antlaşma ve süre alanlarını aynı neden zincirinde tutar.

Defter V3 kayıt/yükleme yoluna eksiksiz girer; kimlik sayaçları ve idempotency geçmişi yükleme sonrasında kaldığı yerden devam eder. `StoryWorldStateV2.events` eski gözlem telemetrisiyle birlikte nedensel olayları da taşır; teşhis alanı komut/olay/etki ve düşürülen kayıt sayılarını gösterir. `causality.ledger=false` dünya mutasyonlarını aynen uygular fakat defteri boş bırakır.

Otomatik kabul kanıtı:

- Aynı idempotency anahtarlı `−5` refah komutu iki kez çağrıldığında yalnız ilk çağrı uygulanır.
- Refah, sahiplik, antlaşma ve ilişki etkileri doğru `before/after` veya delta değerleriyle bulunur.
- Sahiplik olayı mutasyon anında tam bir kez üretilir; sonraki telemetri tiki kopya üretmez.
- Etki kimliğinden komut ve kök olaya geri yürünür.
- Boş idempotency anahtarı reddedilir.
- Kayıt/yükleme defteri bire bir korur ve sonraki komut kimliği kaldığı yerden devam eder.
- AI/toplum sahipliği ve AI komutan hareketi için doğrudan alan yazımı statik testle yasaktır.
- Açık/kapalı 900 saniyelik A/B sonucunda durum fark listesi boştur.

Sınır: Bu faz bütün eski alanları bir anda merkezî komutlara taşımadı. Kabul kapsamı sahiplik, refah, kaynak akışı, AI hareketi ve diplomasiyle sınırlıdır. Ordu listesi, sadakat, itibar, üretim kuyruğu ve gelecekteki ekonomi/politika alanları kendi domain fazlarında aynı kapıya alınacaktır. Zincir derinliği, günlük olay bütçesi ve kasıtlı döngü sigortası Faz 10 kapsamıdır.

### FAZ 10 — Değişmezler ve Zincir Sigortası

**Amaç:** Ekonomik/politik zincirlerin kontrolden çıkmasını engellemek.  
**Çıktı:** Sınırlar, korunum kontrolleri, olay derinliği ve günlük olay bütçesi.  
**Kabul kapısı:** Kasıtlı döngü enjeksiyonu oyunu kilitlemeden durduruluyor ve raporlanıyor.  
**Bağımlılık:** Faz 9.

**Uygulama sonucu:** Faz 9 defterinin önüne, mutatör çalışmadan karar veren `causality.guards` kapısı eklendi. Normal motor davranışı değişmez; yalnız sınırı aşan veya domain değişmezini ihlal eden komut/olay/etki `BLOCKED` olur.

Sabit sınırlar:

- nedensel derinlik: `8`,
- aynı olay türü + hedef parmak izi: en çok `3` tekrar,
- komut başına: `32` olay ve `96` etki,
- bir dünya saniyesinde: `512` komut, `1024` olay ve `2048` etki,
- uyarı döner penceresi: `120`.

Mutasyon öncesi değişmezler:

- bölge sahibi var olan bir devlet olmalı,
- refah `0–100`,
- kaynak deltalarının petrol/insan gücü/puan alanları sonlu olmalı,
- komutan konumu var olan bir bölge olmalı,
- ilişki `−100–100`,
- antlaşma tanımlı türlerden biri, bitiş zamanı sonlu ve negatif olmayan değer olmalı,
- bütün sayısal etki değerleri sonlu olmalı.

`storyCausalityValidate` kimlik, sıra, komut–olay–etki referansı, bütçe ve etki değişmezlerini salt-okunur doğrular. `storyCausalityValidateWorldConsistency`, tutulan her alan yolundaki en yeni `SET` etkisini canlı sahiplik/refah/diplomasi değeriyle karşılaştırır; kapı dışı doğrudan yazım `WORLD_LEDGER_MISMATCH` üretir. Bozuk defter yüklemesi dünyayı veya ana kaydı reddetmez: nedensellik defteri güvenli boş duruma alınır, `restoredFromInvalidLedger`, sorun listesi ve `invalidRestores` sayacı saklanır. V2 teşhisi sigorta sayaçlarını taşır.

Enjeksiyon kabul sonuçları:

- 20 adımlık öz-döngü yalnız 3 mutatör çalıştırır, dördüncü `CYCLE_REPEAT` ile kesilir.
- 100 alt olay isteğinin kök dâhil yalnız 32’si; 150 etki isteğinin yalnız 96’sı uygulanır.
- aynı dünya saniyesindeki 600 komutun 512’si uygulanır, 88’i mutatör çalışmadan bloklanır.
- `welfare=999`, bilinmeyen devlet sahipliği, `NaN` kaynak deltası ve bilinmeyen komutan bölgesi dünyaya yazılmaz.
- doğrudan refah kaçak yazımı yapısal JSON geçerli olsa bile dünya–defter mutabakatında yakalanır.
- kırık olay referanslı kayıt açıklamalı reddedilir ve güvenli defter fallback’i sonrası tekrar doğrulanır.
- sigorta kapalı karşı-test eski doğrulamasız yazımı gerçekten uygular; bayrağın sahte olmadığı kanıtlanır.
- normal 900 saniye ve 30 yıllık koşular `blockedTotal=0`, `invariantFailures=0` ile tamamlanır.
- `causality.guards` açık/kapalı 900 saniyelik durum fark listesi boştur.

Sınır: Bu sigortalar Faz 9’da kapıya alınmış alanları korur. Henüz merkezî etki kapısında olmayan sadakat, itibar, üretim kuyruğu, ordu listesi ve gelecekteki ekonomi domainleri kendi fazlarında değişmez tanımı eklemek zorundadır. Faz 10.1 bu nedenleri oyuncu bilgi filtresinden geçen view-model ve “neden değişti?” UI sözleşmesine taşıyacaktır.

### FAZ 10.1 — UI Projeksiyon ve Nedensellik Test Tezgâhı

**Amaç:** Her sistemin oyuncuya dönük özet/ayrıntı görünümünü ve “neden değişti?” bağlantısını otomatik doğrulamak.  
**Çıktı:** Domain view-model fikstürleri, gizli bilgi sızıntısı testi, değişim rozeti ve olay izi doğrulayıcı.  
**Kabul kapısı:** Aynı dünya durumu farklı oyuncu bilgi seviyelerinde doğru farklı görünüm üretiyor; UI projeksiyonu dünya durumunu değiştirmiyor.  
**Bağımlılık:** Faz 4.1, 9–10.

**Uygulama sonucu:** `js/StoryProjection.js`, UI’nin ham `STORY`, V2 dünya veya nedensellik payload’ını okuması yerine sürümlü `PlayerDomainProjection` üretir. Görünürlük alan bazında `PlayerVisibleFact` ile belirlenir.

Bilgi kesinliği:

- `VERIFIED`: kesin önce/sonra veya kaynak deltası gösterilir.
- `ESTIMATED` / `RUMOR`: kesin etki değeri kapatılır; yalnız değişim ve oyuncunun mevcut tahmin/güven değeri gösterilir.
- `UNKNOWN`: değişim satırı, rozet ve neden izi üretilmez.
- Diplomatik gerçekler henüz `PlayerKnowledgeService` bilgi sınıfına alınmadığı için ham ilişki/antlaşma etkileri bu fazda bilinçli olarak gösterilmez.

View-model:

- toplum, ekonomi, toprak, askerî, yönetim ve diplomasi domain kartları,
- görünür değişim listesi ve son `60` dünya saniyesi rozeti,
- güven sınıfı, bilgi kaynağı, gözlem zamanı ve kesinlik,
- kaynak komut → neden olayları → kalıcı etki izi,
- bilinmeyen komut/olay türleri için ham anahtarı açmayan güvenli genel etiket,
- komut payload’ı, aktör, hedef ve doğrulanmamış gerçekleri dışarıda bırakan doğrulayıcı.

Gerçek UI:

- hikâye araç çubuğunda `08 DEĞİŞİM`,
- yakın görünür değişim sayacı,
- domain özetleri,
- oyuncu-görünür değişim satırları,
- seçili satır için “NEDEN DEĞİŞTİ?” komut→olay→etki zinciri,
- kesin ve kesin olmayan bilgi için ayrı görsel dil,
- diğer drawer’larla tek-panel davranışı, `Escape`, harita tıklaması ve mobil genişlik uyumu.

Kabul kanıtı:

- aynı yabancı refah etkisi oyuncu `0` için `UNKNOWN` olduğunda görünmez, sahibi oyuncu `1` için `EXACT` görünür;
- aynı gerçeğe istihbarat tahmini eklendiğinde satır görünür fakat `before/after/delta=null` ve `precision=OPAQUE` kalır;
- kamusal bölge kontrol değişimi iki oyuncuya da görünür;
- tahmine kesin değer enjeksiyonu `IMPRECISE_FACT_EXACT_LEAK`, bilinmeyen gerçek enjeksiyonu `HIDDEN_FACT_LEAK` üretir;
- projeksiyon verilen V2 dünya, defter ve canlı dünya karmasını değiştirmez;
- gerçek jsdom paneli değişim satırı, rozet ve en az üç neden adımı üretir; ham `payload` anahtarını basmaz;
- kayıt/yükleme sonrası view-model byte-eşdeğer yeniden üretilir;
- `projection.causalityUi` kapalıyken güvenli boş görünüm döner;
- açık/kapalı `900` saniyelik A/B dünya fark listesi boştur;
- normal `900` saniye karması `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`, `3600` saniye soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Sınır: Bu panel yalnız Faz 9’da kalıcı etki kapısına alınmış ve PlayerKnowledge alanı tanımlanmış gerçekleri gösterebilir. Diplomasi, sadakat, itibar değişimi, üretim kuyruğu ve ordu listesi kendi domain fazlarında bilgi sınıfı + etki bağlayıcısı eklenmeden kesin neden olarak açılmaz. Bu eksiklik UI’dan ham veri okuyarak aşılmayacaktır.

---

## DALGA C — Coğrafya ve Ayrıntı Seviyesi

### FAZ 11 — Bölge Veri Modeli

**Durum:** `implemented`
**Amaç:** Mevcut 152 düğümü yeniden numaralandırmadan üretim, nüfus, altyapı ve lojistik taşıyan sürümlü bölgelere dönüştürmek.
**Çıktı:** `js/StoryRegions.js`; `region:N` kalıcı kimliği, `legacyId`, normalleştirilmiş merkez, sınıflandırma, komşuluk, topoloji karması, dinamik ekonomi/askerî/lojistik görünümü ve `world.regionModel` geri dönüş bayrağı.
**Kabul kapısı:** Komşuluk, sahiplik ve şehir konumları eski haritayla birebir uyuşuyor; kimlikler tekil ve `storyNode(id)` indeks sözleşmesini koruyor; bağlantılar çift yönlü; kayıt/yükleme, eski kayıt backfill’i ve bozuk model kurtarması geçiyor.
**Bağımlılık:** Faz 4.

**Uygulama sonucu:**

- `RegionModel` yalnız sabit kimlik/topoloji alanlarını saklar; canlı sahiplik, ekonomi ve garnizon için ikinci gerçek kaynak yaratmaz.
- 152 bölgenin `region:N ↔ legacyId=N ↔ STORY.nodes[N]` eşleşmesi otomatik doğrulanır.
- Konumlar `NORMALIZED_WORLD` uzayında `0–1` aralığına, komşular tekil/açık/çift yönlü referanslara zorlanır.
- Faz 11 lojistiği kara komşuluğuyla başlar; gelecekteki koridor kimlikleri için sürümlü `corridorIds` alanı açıkça boştur.
- V2 bölge kayıtları konum, `CITY_REGION` sınıfı ve lojistik sözleşmesini taşır; V3→V2 göçü aynı alanları backfill raporuyla üretir.
- RegionModel taşımayan eski kayıt canlı düğümlerden uyarılı backfill alır; bozuk model kullanılmaz, hata listesi saklanarak güvenli biçimde yeniden kurulur.
- Sahiplik devri bölge topoloji karmasını değiştirmez; dinamik Region görünümü ve V2 projeksiyonu aynı yeni sahibi görür.
- `qa-runtime/story-phase11-ab.json`: açık/kapalı hash `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; durum farkı ve bütün metrik deltaları sıfırdır.
- 30 yıllık soak hash `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Sınır: Faz 11 bölge semantiği ve topoloji sözleşmesidir; kamera/panel kaynaklı aktivasyon bütçesi Faz 12’nin, kayıpsız toplulaştırma Faz 13’ün, kapasite/hasarlı gerçek ulaşım koridorları Faz 14’ün işidir. Mevcut 30 yıllık tek-devlet çöküşü bu fazda düzeltilmedi ve başarı gibi yorumlanamaz.

### FAZ 12 — Sıcak/Ilık/Soğuk Aktivasyon

**Durum:** `implemented`
**Amaç:** Uzak dünyayı düşük maliyetle simüle edecek deterministik ayrıntı bütçesini kurmak.
**Çıktı:** `js/StoryActivation.js`; aktivasyon kuralları, bütçeleyici, gözlem önceliği, sistem-bölge faz ofseti ve `world.regionActivation` geri dönüş bayrağı.
**Kabul kapısı:** Kamera hareketi, şehir seçimi veya panel açmak aktivasyon sınıfını ve ekonomik/siyasi sonucu değiştirmiyor; aynı sistem/tik aynı bölge dilimini üretiyor.
**Bağımlılık:** Faz 8, 11.

**Uygulama sonucu:**

- Aktivasyon girdileri yalnız dünya durumudur: oyuncu komutanı, aktif savaş, kuşatma, başkent, son 60 saniyedeki kontrol değişimi, komutana graf uzaklığı, cephe, sahiplik, bölge seviyesi, altyapı, nüfus ve garnizon.
- Kamera koordinatı/zoom, `selectedNodeId`, şehir/konsey/değişim paneli ve render görünürlüğü aktivasyon modülünde okunmaz.
- Bütçe `12 HOT / 48 WARM / 92 COLD`; kadanslar sırasıyla `1 / 4 / 20` tik, ayrıntı payları `10000 / 4000 / 1000` baz puandır.
- Oyuncu komutanının bulunduğu bölge daima HOT olur; komutan taşındığında önceden COLD olan hedef aynı dünya durumunda HOT’a yükselir.
- Sistem kimliği + bölge kimliğinden deterministik faz ofseti türetilir. 20 tiklik tam turda her HOT/WARM/COLD bölge tam `20/5/1` çalışma dilimine girer.
- Aktivasyon görünümü türetilmiştir; dinamik kopyası kayıt dosyasına yazılmaz. Yalnız sürümlü politika/topoloji bağı kaydedilir, aynı dünya yüklemede aynı görünümü yeniden üretir.
- Eski kayıt güncel politikayı uyarılı backfill ile alır; yanlış topoloji karmalı politika hata listesini saklayarak güvenli yeniden kurulur.
- 60 saniye boyunca her saniye kamera, zoom, seçili şehir ve üç panel durumu değiştirilmiş koşu ile dokunulmamış koşunun dünya karması ve alanları birebirdir.
- 250 aktivasyon dilimi tezgâhta yaklaşık `54,8 ms` toplam, `0,219 ms/dilim` üretti. Bütçeyi kullanan gelecek sistemler için teorik göreli ayrıntı iş yükü `1136 bps` (`%11,36`) düzeyindedir.
- `qa-runtime/story-phase12-ab.json`: açık/kapalı 900 saniyelik hash `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; ilk fark listesi ve bütün metrik deltaları sıfırdır.
- 30 yıllık soak hash `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Sınır: Mevcut ekonomi, toplum ve savaş sistemleri henüz aktivasyon dilimlerine geçirilmedi; bu nedenle Faz 12 tek başına gerçek CPU kazancı veya daha modern devlet davranışı üretmiş sayılmaz. Bölgesel toplamları kaybetmeden seyrek çalıştırma Faz 13 toplulaştırma/ayrıntılandırma sözleşmesinden sonra güvenle bağlanabilir. Devletlerin iç işlere savaş kadar önem vermesi ekonomi, toplum ve kurum dalgalarının açık kabul borcudur.

### FAZ 13 — Toplulaştırma ve Ayrıntılandırma

**Durum:** `implemented`
**Amaç:** Bölge ayrıntısını kayıpsız sayılabilecek biçimde azaltıp geri açmak.
**Çıktı:** `js/StoryAggregation.js`; sürümlü bölge kapsülü, doğrulanan özet, koruma imzası, deterministik dağıtım ve `world.regionAggregation` geri dönüş bayrağı.
**Kabul kapısı:** Sıcak→soğuk→sıcak turunda toplam para, nüfus, stok, üretim işi ve geleceğe dönük alanlar korunuyor.
**Bağımlılık:** Faz 12.

**Uygulama sonucu:**

- Her COLD kapsül tam kanonik bölge payload’ı, tipli özet, payload/özet checksum’ı ve Faz 11 topoloji karmasını taşır. HOT’a dönüş ancak şema, kimlik, checksum, statik konum ve komşuluk doğrulamasından sonra yapılır.
- Canlı 152 bölgenin tamamı HOT→COLD→HOT turunda byte-eşdeğer geri döndü. Beş dünya saniyesi sonrasındaki koruma imzası `3319,639963` nüfus, `1056,14` servet, `16` garnizon, `118` fabrika, `44` kışla ve `32/152/32` petrol/şehir/puan yatağını korudu.
- Dünya koruma imzası ayrıca ülke düzeyi `oil`, `manpower`, `points` ve `chips` toplamlarını kapsar; toplulaştırma bu kaynaklara yazmaz.
- Gerçek bölge modelinde henüz bölgesel şirket ve stok sistemi yoktur. Bunların kaybolmadığı; iki şirket, üç stok, iki üretim işi, iki bekleyen olay, kuşatma ve bilinmeyen gelecek alanı içeren fixture’ın kanonik olarak birebir açılmasıyla doğrulandı. Bu test, sistemlerin oyunda var olduğu iddiası değildir.
- Sabit ondalık dağıtıcı `100,007` birimi yedi anahtara giriş sırasından bağımsız dağıttı ve toplamı tam korudu.
- Payload veya özet checksum’ı bozulan kapsül HOT duruma açılmaz. Canlı statik komşuluğu değişmiş kapsül `STATIC_TOPOLOGY_MISMATCH` ile reddedilir.
- Geçerli politika ve bütün bölge özeti kayıt/yüklemede birebirdir. Eski kayıt uyarılı backfill alır; bozuk politika güvenli varsayılana döner; bayrak kapalı yol eski tam ayrıntılı davranışı korur.
- Kamera, zoom, seçili şehir ve açık panel değişiklikleri kapsülü, koruma imzasını veya dünya sonucunu değiştirmez.
- 152 bölgelik tam gidiş-dönüş ölçümü yaklaşık `16,037 ms`; ortalama `0,105509 ms/bölge` sürdü.
- `qa-runtime/story-phase13-ab.json`: açık/kapalı 900 saniyelik hash `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; ilk fark listesi ve bütün metrik deltaları sıfırdır.
- 30 yıllık soak hash `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Sınır: Bu faz geçiş ve veri koruma sözleşmesini kurdu; canlı ekonomi/toplum/AI sistemleri henüz COLD kapsüller üzerinden seyrek çalışmıyor. Dolayısıyla gerçek CPU kazancı, bölgesel stok/şirket davranışı veya modern iç politika üretilmiş değildir. 30 yıllık dünyada devlet `3` hâlâ `152/152` bölgeyi ele geçirir. Faz 14 akışların gerçek altyapıya bağlanmasını başlatacak; iç yönetim davranışının asıl dönüşümü ekonomi, toplum ve kurum dalgalarında yapılacaktır.

### FAZ 14 — Altyapı ve Ulaşım Grafı

**Durum:** `implemented`
**Amaç:** Ticaret ve askerî ikmali gerçek bağlantılara bağlayacak sürümlü omurgayı kurmak.
**Çıktı:** `js/StoryInfrastructure.js`; kara, deniz, enerji ve veri koridorları, kapasite/hasar/erişim, rota ve akış çözümleyici.
**Kabul kapısı:** Kesilen tek koridorun etkisi yalnızca bağlı akışlara yansıyor.
**Bağımlılık:** Faz 11.

**Uygulama sonucu:**

- Faz 11 komşuluklarından tekil ve çift yönlü `177` kara koridoru üretildi. GEO şehir kimliklerine bağlı, açıkça denetlenebilir `20` deniz bağlantısı eklendi; isim bulunamadığında deniz yolu uydurulmaz.
- Her fiziksel kara/deniz koridorunun üstünde ayrı enerji ve veri bağlantısı oluşturuldu. Toplam ağ `177 LAND / 20 SEA / 197 ENERGY / 197 DATA = 591` kalıcı koridordur.
- Koridor sözleşmesi kalıcı kimlik, iki sıralı uç bölge, mod, üst fiziksel koridor, temel kapasite, `0–10000` baz puan hasar, etkinlik, mesafe, birim maliyet, gecikme ve erişim politikası taşır.
- Etkin kapasite temel kapasite × kalan sağlamlık olarak tamsayı hesaplanır. `10000` baz puan hasar koridoru `BLOCKED`, ara hasar `DAMAGED`, sıfır hasar `OPEN` yapar.
- Erişilebilir ülke kimlikleri UI veya cache’den değil uç bölgelerin canlı sahiplerinden türetilir. Antlaşma/transit hakkı henüz yoktur; `ENDPOINT_OWNERS` Faz 44 yükümlülüklerine kadar dar ve açık varsayımdır.
- Deterministik rota çözümleyici maliyet + gecikmeyle en iyi yolu seçer, etkin kapasitesi sıfır koridoru kullanmaz ve eşitlikleri kalıcı koridor kimliğiyle kırar.
- Hedefli testte `corridor:land:0:1` kesilince ona bağlı akış `100→0` oldu. Ayrı kara, enerji ve veri akışları aynı kaldı; rota motoru kesilen hattı dışlayıp üç koridorlu alternatif yol buldu.
- Doğrulayıcı şema/mod, yinelenen kimlik, kendine bağlantı, kırık bölge, geçersiz kapasite/hasar, kırık üst koridor, uç eşitsizliği, eksik/fazla koridor ve ağ/topoloji karmasını denetler.
- V2 bölge lojistiği artık bağlı koridor kimliklerini taşır; V2 teşhisi ağ karması, hasar revizyonu ve mod başına kapasite/hasar özetini yayınlar.
- Tam 591 koridor her otomatik kayda yazılmaz. Topoloji RegionModel’den yeniden türetilir; kayıt yalnız ağ karması ile değişmiş hasar/etkinlik durumlarını taşır. Tek hasarlı koridor örneğinde kompakt kayıt `367 bayt`, tam çalışma grafı yaklaşık `184231 bayt` ölçüldü.
- Geçerli hasar kaydı/yüklemesi birebirdir. Graf taşımayan eski kayıt uyarılı backfill; yanlış ağ karmalı kayıt sorun listesini koruyan güvenli yeniden kurulum üretir.
- Kamera, zoom, seçili şehir ve açık paneller ağ veya erişim sonucunu değiştirmez.
- 100 komşu rota sorgusu yaklaşık `15,943 ms`, ortalama `0,159428 ms/rota` sürdü.
- `qa-runtime/story-phase14-ab.json`: açık/kapalı 900 saniyelik hash `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; ilk fark listesi ve bütün metrik deltaları sıfırdır.
- 30 yıllık soak hash `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Sınır: Faz 14 gerçek altyapı grafını kurdu fakat mevcut ekonomi, ticaret, devlet AI ve askerî ikmal henüz bu koridorlardan kaynak taşımaz. Kesinti testi sürümlü test akışlarıyla yapılmıştır; canlı fiyat, stok veya ordu ikmali etkisi olduğu iddia edilemez. Deniz bağlantıları ilk açık katalogdur, küresel liman/boğaz modeli değildir. Dünya 30 yıllık testte hâlâ devlet `3` için `152/152` fetihe çöker; modern iç yönetim sorunu çözülmedi.

### FAZ 14.1 — Şehir Dosyası İlk Oynanabilir Sürüm

**Durum:** `implemented`
**Amaç:** Şehir katmanlarını beklemeden temel “Şehre Gir” akışını gerçek bölge verisi üzerinde kurmak.  
**Çıktı:** Şehir üst özeti, genel/lojistik/tarih sekmeleri, son değişiklikler ve karakter giriş noktası; tamamlanmamış katmanlar açıkça kilitli/boş değil “henüz sistem yok” durumunda.  
**Kabul kapısı:** Haritadan şehir dosyasına, şehirden bağlantılı rota/karakter/olaya gidilebiliyor; oyuncunun bilmediği bölge verisi sızmıyor.  
**Bağımlılık:** Faz 10.1, 11–14.

**Uygulama sonucu:**

- `js/StoryCityDossier.js` sürümlü ve salt-okunur şehir view-model’i, doğrulayıcı, render katmanı ve rota/olay/karakter navigasyon kapılarını taşır.
- Eski panelin yalnız oyuncu şehrini kabul eden sahiplik engeli kaldırıldı. Haritada seçilen herhangi bir geçerli bölge şehir dosyasında açılır; yabancı şehir otomatik olarak salt-okunur olur.
- Gösterilen seviye, nüfus, servet, garnizon, sanayi, kaynak yatağı ve lojistik gerçekleri `PlayerKnowledge` üzerinden geçer. Kendi verisi `VERIFIED`; yabancı idari/askerî/ekonomik veri `UNKNOWN/null` olur.
- Genel, lojistik, tarih ve karakter sekmeleri bütün şehirlerde görünür. Bina ve ordu yönetimi yalnız oyuncunun sahip olduğu şehirlerde görünür ve mevcut üretim işlevlerini korur.
- Kendi lojistik ekranı koridor modu, hedef şehir, etkin kapasite, hasar ve `OPEN/DAMAGED/BLOCKED` durumunu gösterir. Koridordan hedef şehir dosyasına ve kameraya geçilebilir.
- Faz 14.1 tesliminde lojistik ekranı grafın henüz canlı tüketicisi olmadığını açıkça söylüyordu. Faz 18 ile aynı ekran artık gerçek gelen/giden sevkiyatı ve ticaretin koridor kapasitesini tükettiğini gösterir; fiyat ve askerî ikmal hâlâ açıkça sonraki fazlara aittir.
- Tarih yalnız `StoryProjection` içinden oyuncuya görünür nedensel etkileri bölge kimliğiyle filtreler. Olay satırı “Değişim & Neden” ayrıntısını açar.
- Karakter listesi yalnız doğrulanmış konumu aynı şehir olan kendi karakterlerini gösterir. Giriş sohbet merkezini karakter bağlamıyla açar; karaktere özel serbest görüşme henüz bulunmadığı için mevcut konuşma kuyruğundan sahte cevap üretilmez.
- Bölgesel stok, şirket ve yerel kurum alanları sahte `0` veya boş kart değil `NOT_IMPLEMENTED / SİSTEM HENÜZ YOK` olarak görünür.
- Beş yabancı gizli değere `987654321` ve benzeri sentinel’ler enjekte edildi; view-model ve HTML’de hiçbir değer sızmadı. Yabancı lojistik koridoru ve bilinmeyen karakter konumu da görünmedi.
- Rota, olay ve karakter geçişleri; tablist/aria seçimi; özellik kapalı fallback’i; view-model doğrulaması ve DOM metni otomatik teste alındı.
- `qa-runtime/story-phase14.1-ab.json`: `ui.cityDossier` açık/kapalı 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; ilk fark ve bütün metrik deltaları sıfırdır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korundu.

Sınır: Bu faz oyuncunun mevcut dünya verisini güvenli biçimde okuyup gezmesini sağlar; stok, şirket, kurum, gerçek ticaret/ikmal etkisi veya karaktere özel serbest sohbet üretmez. Tarayıcı arayüzü çalışma ortamında bulunmadığı için piksel düzeyi görsel taşma kontrolü yapılmadı; DOM ve erişilebilirlik kapıları geçti, gerçek EXE görsel kontrolü ayrıca gereklidir. Modern iç politika sorunu çözülmedi ve 30 yıllık dünya hâlâ devlet `3` için `152/152` fetihe çöker.

### FAZ 14.2 — Kanonik Kara Maskesi ve Region Raster

**Durum:** `implemented`
**Amaç:** Terrain, siyasi overlay, kıyı ve hit-test için tek raster kaynağı oluşturmak.  
**Çıktı:** Sürümlü `CanonicalLandMask`, `RegionIdRaster`, downsample kuralları ve kıyı fark debug görünümü.  
**Kabul kapısı:** Terrain ve overlay ayrı `GEO.land` scanline çalıştırmıyor; kara/deniz uyumsuzluğu sıfır veya belgelenmiş ince-geometri istisnasında.  
**Bağımlılık:** Faz 11–14.

Uygulanan sözleşme ve ölçüm:

- `js/StoryMapRaster.js`, `canonical-map-raster-1` adaptörüyle `820×645` boyutunda kanonik `Uint8Array landMask` ve `Int16Array regionIds` üretir.
- `GEO.land` scanline işlemi tek üretim noktasındadır. Terrain `1350×1062`, siyasi grid `300×236` çıktısını aynı kanonik kaynaktan deterministik örnekler; iki katman artık bağımsız kıyı rasterizasyonu yapmaz.
- Region ataması, eski kodun normalleştirilmiş koordinat mesafesini değiştirmeyen deterministik KD-tree kullanır. Bütün `152` region rasterde temsil edilir; ölçülen ilk kurulum yaklaşık `57–63 ms` aralığındadır.
- Kaynak/maske/region karmaları sırasıyla `fnv1a32:f76a938c`, `fnv1a32:f63d135c`, `fnv1a32:2dc42a47` olarak sabitlendi. Kaynak geometrisi değiştiğinde cache anahtarı da değişir.
- Şema sürümü, dizi uzunluğu, `0/1` dışı kara değeri, denizde region, karada eksik/bilinmeyen region, kaynak karması ve iki veri checksum’ı ayrı hata kodlarıyla doğrulanır.
- Gerçek `storyBuildLandGrid`, terrain cache ve owner overlay cache kaynak kimliği yayınlar. Harita tıklaması da kanonik rasterden region seçer; deniz hücresi şehir seçmez. Özellik kapalı veya GEO bulunmayan haritada eski güvenli yol korunur.
- Gerçek 300×236 overlay grid’i ile aynı çözünürlükteki kanonik region resample karşılaştırmasında `0` hücre farkı, `0` denize region sızıntısı ve `0` karada region eksiği vardır.
- Terrain merkezi örnekleri ile 300×236 overlay kıyısı arasında `153/70.800` (`%0,2161`) sınıf farkı; 300 çözünürlüğe inerken kanonik kara hücrelerinde `2.768/351.997` (`%0,7864`) ince-geometri kaybı ölçüldü. Bu kabul edilen bir nihai kalite değildir; Faz 14.3’ün çözmesi gereken açık görsel borçtur.
- `qa-runtime/story-phase14.2-ab.json`: `world.canonicalMapRaster` kapalı/açık 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; ilk fark ve bütün metrik deltaları sıfırdır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Sınır: Politik overlay hâlâ `300×236` ve hücre başına `fillRect` kullanır; Faz 14.2 yalnız iki bağımsız coğrafya gerçeğini kaldırdı. Yüksek çözünürlüklü RGBA overlay, sınır maskesi ve tek `putImageData` Faz 14.3’e aittir. Çalışma ortamında tarayıcı bulunmadığı için piksel ekran görüntüsü karşılaştırması yapılamadı; gerçek EXE’de kıyı/sınır görsel kontrolü zorunludur. Runtime KD-tree naif hücre×şehir taramasını kaldırdı; Faz 14.4 yine build-time varlık, açılış benchmark’ı ve checksum’lı fallback üzerinde çalışacaktır. Modern dünya sorunu çözülmedi; 30 yıllık dünya yine devlet `3` için `152/152` fetihe çöker.

### FAZ 14.3 — ImageData Politik Overlay

**Durum:** `implemented`
**Amaç:** Hücre başına `fillRect` maliyetini kaldırmak ve sınır/tint çözünürlüğünü kanonik rasterle uyumlu yapmak.  
**Çıktı:** Typed-array RGBA overlay, sınır maskesi, tek `putImageData`, sahiplik revizyon cache’i.  
**Kabul kapısı:** Fetihte politik katman doğru yenileniyor; denize taşma/renksiz kara yok; rebuild süresi eski sürüme göre ölçülebilir büyük oranda düşüyor.  
**Bağımlılık:** Faz 14.2.

Uygulanan sözleşme ve ölçüm:

- `js/StoryPoliticalOverlay.js`, sürümlü `political-overlay-rgba-1` çıktısını kanonik `820×645` raster üzerinde üretir.
- Her kanonik kara pikseli sahibinin paletinden RGBA alır; iç tint alfa `51`, devlet sınırı alfa `230`; deniz alfa `0` kalır. Sınır yalnız dört komşudan en az biri farklı ve kara sahibi olduğunda yazılır, kıyı devlet sınırı sayılmaz.
- Başlangıç örneğinde `349.241` iç bölge ve `2.756` devlet sınırı pikseli üretildi. `351.997` kara pikselinde renksiz hücre, `176.903` deniz pikselinde politik alfa ve denizde sınır sayısı sıfırdır.
- Eski 300×236 fallback `47.137` ayrı `fillRect` çağrısı yapar. Yeni 820×645 ana yol `0 fillRect` ve tek `putImageData` kullanır; böylece önceki `%0,7864` ince-kara downsample kaybı politik katmandan kaldırılmıştır.
- Değişmeyen sahiplik aynı canvas, owner checksum ve revision’ı korur. Gerçek sahiplik transferi `territory-transfer` nedeniyle cache’i geçersiz kılar; canvas belleği yeniden kullanılır, revision yalnız bir artar ve yeni RGBA tek kez yazılır.
- Başlangıç owner/RGBA/sınır karmaları ölçüm koşusunda `fnv1a32:196bd176`, `fnv1a32:f386e770`, `fnv1a32:89dae1e1` oldu. Fetihte owner/RGBA/sınır karmalarının üçü de değişir.
- Doğrulayıcı şema/adaptör, kanonik boyut, RGBA/sınır uzunluğu, kaynak ve sahiplik checksum’ı, RGBA/sınır checksum’ı, deniz alfa/sınır sızıntısı, kara alfa değeri ve sahiplik-sınır topolojisini denetler.
- Özellik bayrağı kapalıyken yeni üretici canvas oluşturmaz ve eski 300×236 yol güvenli fallback olarak çalışır.
- Headless ölçümde saf RGBA üretim döngüsü yaklaşık `13–19 ms`, ilk toplam hazırlık yaklaşık `113–137 ms` aralığındadır. jsdom Canvas çizimini no-op yaptığı ve yeni yol 7,47 kat fazla piksel işlediği için eski/yeni gerçek render süresi hakkında güvenilir tarayıcı hükmü vermez; kanıtlanan performans sonucu Canvas çağrı sayısının `47.137→1` düşmesidir.
- `qa-runtime/story-phase14.3-ab.json`: `render.imageDataPoliticalOverlay` kapalı/açık 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; `changedWorldState=false`, ilk fark ve bütün metrik deltaları sıfırdır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Sınır: Otomatik test RGBA ve sınır topolojisini byte düzeyinde doğrular fakat gerçek Chromium renk birleştirmesini, warp içindeki görsel sınır kalınlığını ve GPU/Canvas süresini ölçmez. Çalışma ortamında kullanılabilir tarayıcı bulunmadığı için EXE ekran görüntüsü ve gerçek fetih-frame profili hâlâ gereklidir; bu yapılmadan görsel kalite ve cihaz hızlanması tamamlanmış sayılmaz. Faz 14.4 açılış varlığı/fallback bütçesine, Faz 14.5 warp draw-call bütçesine devam eder. Modern dünya sorunu değişmedi; devlet `3` 30 yılda yine `152/152` bölgeyi alır.

### FAZ 14.4 — Region Atama ve Açılış Performansı

**Durum:** `implemented`
**Amaç:** Hücre×şehir naif Voronoi taramasını açılış yolundan çıkarmak.  
**Çıktı:** Build-time region raster veya doğrulanmış hızlı runtime fallback; sürüm/checksum kontrolü.  
**Kabul kapısı:** Hedef cihazda harita açılışı hissedilir ana-thread donması üretmiyor; raster sürümü uyuşmazsa açık hata/fallback oluşuyor.  
**Bağımlılık:** Faz 14.2.

Uygulama ve kabul kanıtı:

- `tools/make-story-map-raster.js`, runtime KD-tree üreticisini `world.prebuiltMapRaster=false` ile çalıştırıp `js/StoryMapRasterAsset.js` varlığını üretir. `npm run story:build-map-raster` aynı girdide aynı SHA-256 dosyasını verdi.
- Varlık `canonical-map-raster-asset-1` / `rle-int16-le-v1` sözleşmesindedir. `528.900` ham piksel `10.766` koşuya ve `43.064` payload baytına iner; üretilen JS dosyası yaklaşık `65 KB`’tır.
- Asset kaynak/land/region/payload karmaları `fnv1a32:f76a938c`, `fnv1a32:f63d135c`, `fnv1a32:2dc42a47`, `fnv1a32:0b4b6af6`.
- Ana yol base64 payload’ı çözer, RLE taşma/piksel/run sayılarını ve bütün checksum’ları doğrular. Geçerli asset `loadMode=asset`; runtime KD-tree yalnız `runtime-fallback` veya özellik kapalı `runtime-disabled` yoludur.
- Eski şema, yanlış GEO/bölge kaynağı, bilinmeyen encoding, bozuk payload checksum’ı, yanlış run sayısı ve kesilmiş payload ayrı testlerle reddedildi.
- Eksik asset `ASSET_MISSING`, eski kaynak `ASSET_SOURCE_HASH`, bozuk payload `ASSET_PAYLOAD_HASH` teşhisi üretip oyun açılışını durdurmadan aynı kanonik rasteri runtime’da kurar.
- Tekil ölçümlerde asset yükleme+tam doğrulama `54,1 ms`, runtime yol `111,3 ms`; paralel A/B yükünde sırasıyla `87,7 ms` ve `168,7 ms`. Asset yaklaşık iki kat hızlıdır ve iki yolun bütün raster checksum’ları aynıdır.
- `qa-runtime/story-phase14.4-ab.json`: `world.prebuiltMapRaster` kapalı/açık 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; `changedWorldState=false`, ilk fark ve metrik deltaları sıfırdır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak korunur.

Sınır: Bu ölçüm jsdom/Node hedefindedir; gerçek paketlenmiş EXE’nin script parse ve ilk frame süresi ayrıca profillenmelidir. Asset statik coğrafya/bölge geometrisini hızlandırır, sahiplik değişimini içermez ve kayda yazılmaz. GEO veya bölge merkezleri değiştiğinde kaynak checksum’ı eski asset’i reddeder; geliştirici üretici komutunu yeniden çalıştırmalıdır. Modern dünya dengesi değişmedi ve 30 yılda devlet `3` yine `152/152` bölgeyi alır.

### FAZ 14.5 — Adaptif Warp ve Render Bütçesi

**Durum:** `implemented`
**Amaç:** Sabit üç piksellik şerit ve kare başına yüzlerce hata-yutan çizim çağrısını azaltmak.  
**Çıktı:** Döngü dışı doğrulama, adaptif band, önbelleklenmiş warp katsayıları, Canvas benchmark ve gerekirse WebGL textured-mesh prototipi.  
**Kabul kapısı:** Döngü içinde sessiz `try/catch` yok; 1080p hedef cihazda p95 kare süresi bütçede; görsel fark testi perspektif ve tıklama doğruluğunu koruyor.  
**Bağımlılık:** Faz 14.2–14.3.

Uygulama ve kabul kanıtı:

- `storyWarpBandSize`, ekran yüksekliği ve zoom’a göre 720p/1080p/1440p için `4/5/7 px`; yakın 1080p görünüm için `4 px` band seçer. Özellik kapalı fallback `3 px` kalır.
- `storyWarpPlan`, perspektif katsayılarını bir kez üretir; terrain ilk cache miss’i, politik overlay aynı plan üzerinde cache hit’i kullanır.
- İki katmanda 720p `360`, 1080p `432`, 1440p `412`, yakın 1080p `540` `drawImage` çağrısı ölçüldü. Eski 1080p yol `720`; normal 1080p azalma `%40`’tır.
- Döngü içinde `try/catch` yoktur. Context, kaynak, viewport, dünya ve kamera çizim öncesi doğrulanır; bozuk kaynak `SOURCE_DIMENSIONS` ile çizime girmez.
- 720p/1080p/1440p uzak görünümde bant ölçek hatası sıfır; en zor yakın zoom örneğinde `0,00210023` (`%0,2101`), kabul bütçesi `%1` altındadır.
- Üç dünya noktasında `storyW2S→storyS2W` maksimum hata `0`; hit-test matematiği render planıyla uyumludur.
- `qa-runtime/story-phase14.5-ab.json`: `render.adaptiveMapWarp` açık/kapalı 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; dünya farkı ve metrik deltaları sıfırdır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f`.

Sınır: jsdom `drawImage` çağrılarını sayar ve CPU plan süresini ölçer fakat gerçek Chromium compositor/GPU p50-p95 kare süresi vermez. Bu nedenle gerçek EXE’de 720p/1080p/1440p profil ve kıyı/sınır ekran görüntüsü hâlâ zorunludur. Cache/çağ/palet invalidation ve aktif kaynak temizliği Faz 14.6’da tamamlandı. Modern dünya dengesi değişmedi; devlet `3` yine 30 yılda `152/152` bölgeyi alır.

### FAZ 14.6 — Harita Cache, Çağ/Palet ve Dokümantasyon Temizliği

**Amaç:** `_geoTerrain` dâhil bütün harita cache’lerini sürümlü geçersiz kılmak ve aktif/ölü kaynak karmaşasını bitirmek.  
**Çıktı:** `storyInvalidateMapCaches`, cache anahtarları, çağ/palet testleri, aktif render mimarisi README’si, prototip/çift varlık denetimi.  
**Kabul kapısı:** Çağ/palet değişimi terrain’i yeniliyor; sahiplik değişimi terrain’i gereksiz yenilemiyor; README/index/dosya yapısı uyuşuyor; yüklenmeyen prototip aktif kaynak gibi paketlenmiyor.  
**Bağımlılık:** Faz 14.2–14.5.

**Uygulama sonucu:**

- `js/StoryMapCache.js`, `storyInvalidateMapCaches` ve `ownership/era/palette/derived/geometry/viewport` scope’ları eklendi.
- Sahiplik probunda raster, terrain ve warp aynı nesne kaldı; owner canvas belleği korundu, revision yalnız `+1` arttı.
- Çağ geçişinde terrain nesnesi ve gerçek ImageData checksum’ı değişti; owner revision ve warp planı aynı kaldı.
- Altı çağ paleti terrain RGB çıktısına bağlandı; kaynak teşhisi sürümlü palet anahtarını taşıyor.
- Devlet paleti değişimi terrain+politik katmanı yenilerken canvas belleğini korudu; bilinmeyen/kapalı scope mutasyonsuz kodlu hata verdi.
- README, index, paket dosya listesi, kök prototip ve aktif `js/MapData.js` ilişkisi otomatik kaynak testiyle eşleştirildi.
- `qa-runtime/story-phase14.6-ab.json`: açık/kapalı 900 saniyelik karma `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; dünya farkı ve metrik deltaları sıfır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f`.

Sınır: Headless Canvas piksel verisini ve çağ zincirini doğrular; gerçek Chromium compositor/GPU p95’ini ve çağ paletlerinin insan gözüyle okunabilirliğini doğrulamaz. EXE ekran görüntüsü/profil kapısı açıktır. Faz 14.6 ekonomi veya iç yönetim davranışı eklemedi; devlet `3` uzun koşuda yine `152/152` bölgeyi alır.

---

## DALGA D — Ekonomi

### FAZ 15 — Kaynak Taksonomisi

**Amaç:** Başlangıç için sekiz anlaşılır kaynak tanımlamak.  
**Öneri:** Gıda, enerji, maden, sanayi parçası, elektronik, askerî malzeme, insan gücü, sermaye.  
**Kabul kapısı:** Her kaynağın üreticisi, tüketicisi, birimi ve yokluk sonucu tanımlı.  
**Bağımlılık:** Faz 4.

**Uygulama sonucu — tamamlandı:**

- `js/StoryResources.js`, sekiz kalıcı kimliği `food`, `energy`, `raw_materials`, `industrial_parts`, `electronics`, `military_supplies`, `labor`, `capital` olarak tanımlar.
- Her tanım açık kategori, birim, üretici, tüketici, depolama politikası, taşıma modu ve `activationPhase` taşıyan yokluk etkilerine sahiptir.
- Katalog şeması `1`, katalog sürümü `1`, adaptör kimliği `story-resource-taxonomy-1`, checksum `fnv1a32:4a4ba0fe` değeridir. Eksik, yinelenen, bilinmeyen veya checksum’ı bozuk katalog açıklamalı hata koduyla reddedilir.
- Eski `oil → energy`, `manpower → labor`, `points → capital` ilişkileri yalnız `LEGACY_ALIAS` olarak okunur. Ölçek bire birdir fakat semantik kayıp `HIGH`; yazma yetkisi eski alanlarda kalır. Bu eşlemeler yeni ekonominin doğru fiziksel/finansal stokları sayılmaz.
- `food`, `raw_materials`, `industrial_parts`, `electronics` ve `military_supplies` için mevcut oyundan miktar uydurulmaz; Faz 17’ye kadar değer `null`, durum `UNAVAILABLE_PHASE_17` olur.
- Kayıt dosyası statik kataloğun kopyasını değil sürüm/checksum/teşhis başlığını taşır. Eski kayıt deterministik backfill edilir; bozuk başlık güvenli statik kataloğa döner ve kurtarma teşhisi üretir.
- `qa-runtime/story-phase15-ab.json` içinde 900 saniyelik açık/kapalı koşular aynı `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c` dünya karmasını ve sıfır metrik farkını üretir.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f` olarak değişmeden kaldı.

Kapsam sınırı: `liveStockSystem: false`. Faz 15 yalnız ortak dili ve göç sınırını kurar. Üretim reçeteleri Faz 16’da, gerçek bölgesel tüketim ve stok Faz 17’de başlayacaktır. Devlet `3` uzun koşuda yine `152/152` bölgeyi alır; bu faz iç siyaset, hegemonya veya ekonomik denge çözümü değildir.

### FAZ 16 — Altı Üretim Sektörü

**Amaç:** Tarım, enerji, hammadde, sivil sanayi, ileri teknoloji ve savunma üretimini kurmak.  
**Çıktı:** Girdi/çıktı reçeteleri, kapasite, iş gücü ve verimlilik.  
**Kabul kapısı:** Hiçbir üretim yoktan kaynak yaratmıyor; darboğazlar raporda görülüyor.  
**Bağımlılık:** Faz 15.

**Uygulama sonucu — tamamlandı:**

- `js/StoryProductionSectors.js`, `agriculture`, `energy`, `extraction`, `civil_industry`, `advanced_tech` ve `defense_industry` kimliklerini tek sürümlü katalogda tanımlar.
- Her sektörün bir reçete sürümü, çevrim süresi, kapasite birimi, çevrim başına iş gücü, `2500–15000 BPS` verimlilik sınırı, girdileri ve tek ana çıktısı vardır.
- Tarım `arable_capacity`, enerji `energy_potential`, çıkarım `mineral_reserve` olmadan çalışmaz. Bu üç sektör `ENDOWMENT_BOUND` ile doğal kapasite sınırını aşamaz.
- Sivil sanayi, ileri teknoloji ve savunma sanayisi `MASS_EQUIVALENT` koruması kullanır; standartlaştırılmış malzeme eşdeğeri çıktı girdiden büyük olamaz.
- Doğrulayıcı bilinmeyen/yinelenen sektör veya reçeteyi, bilinmeyen kaynak kimliğini, kaynak kataloğuyla uyuşmayan birimi, sıfır/negatif miktarı, iş gücü sözleşmesi farkını, doğal kapasitesiz birincil üretimi, girdisiz fiziksel çıktıyı, kütle kazancını ve kaynak kataloğunda yetkili olmayan üreticiyi reddeder.
- `storyProductionEvaluate`, istenen çevrim, kapasite, verimlilik, kanonik stok görünümü ve doğal kapasite görünümünden salt-okunur teklif üretir. Sonuç `READY`, `PARTIAL` veya `BLOCKED`; darboğazlar `CAPACITY_LIMIT`, `INPUT_SHORTAGE`, `STOCK_UNAVAILABLE`, `ENDOWMENT_SHORTAGE` veya `ENDOWMENT_UNAVAILABLE` olarak kaynak/birim/miktar taşır.
- Hedefli probda `0,75` ton hammadde, sivil sanayiyi tam `0,5` çevrim ve `0,5` parça lotuyla sınırladı. `1` kapasite ve `%50` verim, savunma sanayisini tam `0,5` çevrimle sınırladı. Aynı girdi aynı `proposalHash` değerini üretti ve çağıranın stok nesnesi değişmedi.
- Katalog şeması/sürümü `1/1`, adaptör `story-production-sectors-1`, kaynak katalog bağı `fnv1a32:4a4ba0fe`, katalog checksum’ı `fnv1a32:a4007f41`.
- Tam statik katalog kayda kopyalanmaz: kompakt başlık `327` bayt, tam katalog görünümü `6.982` bayt. Eski kayıt backfill edilir; bozuk checksum güncel statik katalogla kurtarılır.
- `qa-runtime/story-phase16-ab.json`: 900 saniyelik açık/kapalı dünya karması aynı `623ba94260491daa9eb82c36ee817accbe9948d52d2cdd9e63a134ea9b11ee1c`; bütün metrik deltaları sıfır.
- 30 yıllık soak karması `5e8d3c7ac4f94d82a8e78636728a3681d395a67e7f2b0370d2e9ef576062403f`.

Kapsam sınırı: `liveStockSystem: false`, `proposalsCommit: false`. Faz 16 üretim sonucunu ülke veya bölge stoğuna yazmaz; eski `Production.js` askerî birlik kuyruğunu da değiştirmez. Gerçek bölgesel stok, tüketici önceliği, kıtlık ve tekliflerin atomik uygulanması Faz 17’nin işidir. Devlet `3` hâlâ `152/152` bölgeyi alır ve eski kaynaklar sınırsız büyür.

### FAZ 17 — Bölgesel Tüketim ve Stok

**Amaç:** Kaynakları gerçek ihtiyaçlara bağlamak.  
**Çıktı:** Hane, devlet, şirket ve ordu tüketimi; güvenli stok hedefleri.  
**Kabul kapısı:** Kıtlık hangi tüketicinin neden karşılanamadığını gösteriyor.  
**Bağımlılık:** Faz 16.

**Uygulama sonucu:**

- `js/StoryRegionalEconomy.js`, `story-regional-stock-ledger-1` adaptörü ve `fnv1a32:f0f3a43a` politika checksum’ıyla 152 bölgenin sekiz kanonik kaynak stoğunu, güvenli hedefini, doğal kapasitesini ve sektör kapasitesini tutar.
- Defter tek otoritedir. `node.stocks` yalnız HOT/WARM/COLD kapsülü için doğrulanan aynadır. Eski `oil/manpower/points` alanları okunup gerçek stoğa dönüştürülmez; `legacyMaterialized: false` kalır.
- Yeni kampanyada stoklar bölge seviyesi, tesisleri ve coğrafi yataklarından deterministik kurulur. Kayıtta tam dinamik defter saklanır; katalog/reçete/topoloji/politika hash’lerinden biri uyuşmazsa bozuk defter kullanılmaz ve eski kaynaklara dokunmadan güvenli başlangıç kurulur.
- `storyRegionalCommitProduction`, teklif katalog/reçete sürümünü ve `proposalHash` değerini yeniden doğrular; tüketilecek/üretilecek miktarların reçeteyle tam eşleşmesini ve mevcut stok/doğal kapasiteyi commit anında tekrar kontrol eder. Herhangi bir hata bütün mutasyonu reddeder; kısmi girdi tüketimi veya negatif stok oluşmaz.
- Hane `100`, ordu `95`, devlet `85`, şirket `70` önceliğiyle talep üretir. Yüksek öncelikli temel ihtiyaç rezervi kullanabilir; düşük öncelikli tüketici güvenli stok tabanını aşamaz.
- Tahsis sonucu `SATISFIED/PARTIAL/UNMET`; kıtlık yaşam döngüsü ayrıca `ACTIVE/RESOLVED` olur. Kayıt hangi bölge, tüketici, kaynak, istenen/teslim edilen/eksik miktar, dolum oranı, neden ve beklenen etkileri taşır. Tekrarlanan aynı kıtlık yeni satır yağmuru yerine occurrence ve cumulativeUnmet sayaçlarında birleşir.
- Depolama politikası gıda raf ömrünü, enerji tampon kaybını, sanayi parçası/elektronik eskimesini, askerî ikmal hazır olma kaybını ve emeğin `NON_STOCK` sona ermesini deterministik uygular. Emek hizmeti ve dış sermaye girişi koruma denkleminde ayrı `externalInflow` olarak kaydedilir.
- Her 4 saniyelik ekonomi görevi 152 bölgeyi sabit sırada işler. 8 kaynağın tamamında `son stok = ilk stok + dış giriş + üretim − tüketim − kayıp` denklemi hedefli probda tam `0` farkla kapandı.
- Oyuncunun kendi stokları `VERIFIED / OWN_STOCK_LEDGER`; yabancı stoklar istihbarat yoksa `UNKNOWN/null`. Şehir dosyası kendi stok/hedeflerini gösterir, yabancı için açık “stok istihbaratı yok” durumu üretir.
- Geçerli/tahrif edilmiş/bayat teklif; tüketici önceliği; rezerv koruması; kıtlığın kapanması; negatif/eksik stok; yanlış politika/topoloji; kayıt/yükleme; eski/bozuk kayıt; özellik kapalı yolu; V2, PlayerKnowledge ve kapsül mutabakatı otomatik test edildi.
- `qa-runtime/story-phase17-ab.json`: kontrol `491dae2d…f803`, tedavi `a4acc60e…ad1e`; yeni bölgesel durum bilinçli olarak değişti. Eski ortalama refah, enflasyon, öfke, aktif devlet, haber ve `oil/manpower/points` deltaları tam sıfırdır.
- 30 yıllık `3.600` saniye koşu sonunda defter ve bütün bölge aynaları geçerli kaldı; karma `93ac4792…0ffa`.

Kapsam sınırı: Faz 17 ekonomik akışı canlı yaptı fakat dengeyi çözmedi. 900 saniyede `225` ekonomi tiki sonunda bölgesel gıda ve enerji toplamı `0`, kıtlık kaydı `1.407`, sermaye stoğu `2.268.902,06` oldu. Bu sonuç stok/talep sisteminin çalıştığını, fakat bölgeler arası ticaret olmadan üretim fazlasının açığı kapatamadığını ve dış sermaye girişinin henüz fiyat/bütçe tarafından emilmediğini gösterir. Faz 18 fiziksel ticaret ve lojistiği, Faz 19 fiyat sinyalini, Faz 20 bütçe/para sınırını kurmadan bu sayılar dengeli ekonomi olarak kabul edilmeyecektir. Eski askerî üretim kuyruğu ve hegemonya davranışı da henüz bu stoklara bağlı değildir.

### FAZ 17.1 — Modern Barış Başlangıcı ve Savaş Kapısı

**Amaç:** Devletlerin savaşı varsayılan günlük faaliyet değil, açık diplomatik kırılma sonucu başlatmasını sağlamak.
**Çıktı:** `peace` durumu, eksiksiz 28 diplomatik kenar, ortak düşmanlık kapısı, açık oyuncu savaş ilanı ve barış odaklı başlangıç A/B testi.
**Kabul kapısı:** Yeni kampanyada 28/28 ilişki barış; savaş ilanı yokken 120 ve 900 saniyelik koşuda sıfır sahiplik değişimi; ateşkes süresi dolunca otomatik savaş yok; özellik kapalı kontrol eski savaş davranışını gerçekten üretiyor.
**Bağımlılık:** Faz 3, 9, 17.

**Uygulama sonucu:**

- `diplomacy.peacefulStart` varsayılan açık özellik bayrağı eklendi.
- `storyInitializeDiplomacy`, sekiz devletin bütün ikili ilişkilerini `v: 0 / treaty: peace` olarak somut biçimde kurar; eksik ilişki de artık barışa backfill edilir.
- Ateşkes süresi dolduğunda ilişki `peace` olur. Süre bitişi savaş ilanı sayılmaz.
- Genelkurmay saldırı hedefi, saldırı emri, kuşatma başlatma, devam eden kuşatma ve nihai fetih aynı `storyIsHostile` kontrolünden geçer. Barış başladıktan önce üretilmiş bayat saldırı emri bile fetih yapamaz.
- AI yalnız güç farkı gördüğü için barışı bozamaz. Modern yol ciddi negatif ilişki (`≤ -35`), ortak sınır, şahin lider doktrini ve düşük olasılık kapısı ister. Tam kriz/casus belli/yetki modeli henüz Faz 43–49 borcudur.
- Oyuncunun barıştaki yabancı bölgeye tıklaması doğrudan savaş açmaz; önce barışı bozup savaş ilan etmenin ilişki/itibar sonucu açıkça sorulur. `storyLaunchBattle` ve savunma girişi doğrudan çağrılsa bile düşmanlık yoksa reddedilir.
- Diplomasi tablosu deterministik dünya karmasına eklendi. Yeni kampanyada boş haber dizisi açıkça başlatılarak barış koşusunda ortaya çıkan kayıt/yükleme asimetrisi de kapatıldı.
- Hedefli 120 saniyelik A/B: modern barış yolu `0`, eski tüm-savaş yolu `5` sahiplik değişimi. Kayıt/yükleme 28 kenarı birebir korudu.
- `qa-runtime/story-phase17.1-ab.json`: 900 saniyelik eski tüm-savaş kontrolü `368f7e0d…12da`, modern barış tedavisi `a1935aa5…7ac1`. Kontrolde `143` sahiplik değişimi ve `4` devlet; tedavide `0` sahiplik değişimi ve `8` devlet kaldı.
- 900 saniyelik standart koşu: bütün `8` devlet ve başlangıç bölge dağılımı korundu; sahiplik olayı `0`, ortalama refah `65,875`, ortalama enflasyon `2,255`, ortalama huzursuzluk `2,805`, karma `a1935aa5…7ac1`.
- 30 yıllık soak: `8/8` devlet ve başlangıç dağılımı korundu; karma `4933d411…5058`.

Kapsam sınırı: Barış başlangıcı savaş saplantısının temel tetikleyicisini kapattı, fakat devlete barışta anlamlı ulusal gündem vermedi. Ekonomik AI Faz 22, kurumlar Faz 28–33.1, karakterler Faz 34–38.5 ve gerçek diplomasi AI Faz 43–46 gelmeden devletler modern aktörler gibi çok alanlı karar vermez. Bu boşluklar `MODERN_DUNYA_EKSIKLERI.md` defterinde kapanana kadar izlenecektir.

### FAZ 18 — Ticaret ve Lojistik Akışı

**Amaç:** Fazla üretimin bağlantılar üzerinden taşınması.  
**Çıktı:** Sürümlü ticari sözleşmeler, sipariş/sevkiyat manifestosu, sahiplik devri, rota, taşıma kapasitesi, maliyet, gecikme ve kesinti.  
**Kabul kapısı:** Abluka/koridor hasarı fiyat ve stokta ölçülebilir gecikmeyle görülüyor; konuşmada yönlendirilen bir sevkiyat yalnız geçerli sözleşme değişikliği ve fiziksel teslimattan sonra hedef stokta beliriyor.  
**Bağımlılık:** Faz 14, 17.

**Uygulama sonucu:**

- `js/StoryTrade.js`, sürümlü sözleşme, sipariş, sevkiyat ve değişiklik kayıtlarının tek otoritesi olan `story-trade-logistics-ledger-1` defterini kurdu.
- Taşınabilir kaynaklar katalogdan türetilir. Gıda, hammadde, sanayi parçası, elektronik ve askerî malzeme kara/deniz; enerji enerji ağı koridorlarını kullanır. Emek fiziksel yük, sermaye ise fiyat/ödeme sistemi varmış gibi taşınmaz.
- Otomatik açık kapatma, hedef stok ve yoldaki mevcut siparişi birlikte hesaplar; gönderici güvenli stoğunun `%125` altına indirilmez. Aynı ülke içi kaynak önce, barıştaki sınır ötesi kaynak sonra değerlendirilir.
- Her sipariş geçerli ve etkin bir sözleşmeye bağlıdır. Faz 19–20 yokken finansal sonuç uydurulmaz; sözleşme açıkça `CLEARING_PENDING_PRICE`, maliyet yalnız `routeCostEstimate` durumundadır.
- Sevk commit’i gönderici stoğunu atomik borçlandırır. Manifesto kalıcı rota bölge/koridor kimlikleri, ayak, kalan gecikme, kesinti süresi, hasar gecikmesi, yük sahibi ve hedef depo taşır.
- Faz 14 rota kapısı çok taraflı yetkiye genişletildi. Sözleşme tarafları kendi toprakları ve ortak sınırları kullanabilir; imzasız üçüncü ülke transit geçişi yapılamaz.
- Koridor kapasitesi her ticaret penceresinde ortak tüketilir. Hedefli probda ilk yük `1051` birimlik hattın tamamını ayırdı; ikinci yük `CORRIDOR_CAPACITY_EXHAUSTED` ile reddedildi.
- `10000` baz puan hasar yükü `HELD` yaptı ve hedef stok değişmedi. Hat açıldıktan sonra aynı yük teslim edildi; `20` saniyelik kesinti manifestoda kaldı.
- Yetkili yönlendirme sözleşme sürümünü ve amendment kaydını artırır. `5` birimlik probda eski hedef `+0`, yeni hedef yalnız fiziksel teslimattan sonra `+5` aldı.
- Sınır ötesi probda yük sahibi `country:0 → country:7` yalnız teslimat anında değişti.
- Yoldaki koruma denklemi her kaynak için `dispatched = delivered + lost + returned + activeCargo` biçiminde doğrulanır. Sahte `+1` yük `TRADE_CARGO_CONSERVATION`, bozuk rota `INVALID_SHIPMENT_ROUTE` ile reddedildi.
- Kayıt/yükleme açık siparişi, yoldaki yükü, rota ayağını ve kapasite penceresini birebir korudu. Eski/bozuk ticaret kaydı bölgesel stok defterini ikinci kez borçlandırmadan güvenli boş deftere döndü.
- V2 dünya teşhisi ticaret özetini taşır. Kendi bölgesindeki gelen/giden yükler `VERIFIED / OWN_TRADE_LEDGER`; yabancı ayrıntılar `UNKNOWN/null` kalır. Şehir lojistik sekmesi canlı yükü ve koridorların kapasite/hasar durumunu birlikte gösterir.
- `qa-runtime/story-phase18-ab.json`: 900 saniyede `3.634,79` gıda, `23.075,16` enerji, `1.756,49` hammadde ve `378,31` sanayi parçası teslim edildi. Refah, enflasyon, huzursuzluk, toprak, haber ve eski kaynak sayaçlarında delta `0`.
- Standart 900 saniyelik karma `0644958541c7bc4e711926744c238de32bc614d506631372219fd8b72e349a5b`; 30 yıllık soak karması `ef1624804fb638fb56fcf181efde6fd1295f82ac576533a97f157e7030199c18`. Her iki koşuda da ticaret defteri ve yük koruma denklemi geçerli kaldı.

Kapsam sınırı: Bu faz fiziksel mal hareketini çözdü; ekonomik dengeyi çözmedi. 900 saniyede gıda ve enerji toplamı yine `0`, kıtlık kaydı `1196`, sermaye `2.196.477,50` oldu. Ticaret üretilemeyen malı yaratamaz. Fiyat/ödeme Faz 19–20, şirket sahibi/satıcı davranışı Faz 21, açığı görüp kapasite yatırımı seçen ekonomik AI Faz 22 kapsamındadır. Abluka için koridor kesintisi teknik olarak çalışır fakat diplomatik/askerî abluka kararı ve üçüncü ülke transit anlaşması daha sonraki diplomasi/askerî fazlara kadar yoktur.

### FAZ 19 — Piyasa ve Fiyat Oluşumu

**Amaç:** Arz, talep, stok ve riskten sınırlı fiyat üretmek.  
**Çıktı:** Bölgesel/ulusal fiyatlar, enflasyon sepeti, fiyat yumuşatma.  
**Kabul kapısı:** Küçük şok sonsuz fiyat salınımı üretmiyor; büyük kıtlık görünür fiyat baskısı üretiyor.  
**Bağımlılık:** Faz 18.

**Durum:** `implemented`

Uygulanan sözleşme:

- `js/StoryMarket.js`, 152 bölge için sürümlü `story-market-price-ledger-1` defterinin tek sahibidir. Kaynak, üretim, bölgesel ekonomi, ticaret, topoloji ve altyapı checksum bağları kayıt/yükleme sırasında doğrulanır.
- Fiyat girdisi tahminî talep değildir. `StoryRegionalEconomy`, her ekonomi tikinde kaynak bazında `demandRequested`, `demandDelivered`, `demandUnmet`, `produced` ve `productionConsumed` akışlarını kaydeder. Piyasa bunlara gerçek stok, güvenli hedef, stok günü, yoldaki/HELD yük ve koridor hasarını ekler.
- Altı aktif kalem `food`, `energy`, `raw_materials`, `industrial_parts`, `electronics`, `military_supplies` olur. Bütün fiyatlar para miktarı değil `PRICE_INDEX_POINT` birimindedir; baz `100`, kesin sınır `25–800`, hedef çarpanı `0,35–6`, üstel baskı bileşimi, `0,22` yumuşatma ve tik başına `%10` hareket tavanı kullanılır.
- `labor`, mevcut modelde her tik üretilip aynı tik `NON_STOCK` olarak silindiği için fiyatlandırılmaz; açıkça `DEFERRED / LABOR_MARKET_NOT_MODELED / null` kalır. Sıfır görünen emek stoğundan sahte ücret hiperenflasyonu türetilmez.
- `capital`, bütçe, para arzı, hesap ve ödeme Faz 20’de kurulana kadar `NUMERAIRE / 1` kalır. Piyasa tiki stok, sermaye, sipariş, sevkiyat veya eski `st.inflation` alanına yazmaz.
- Bölgesel temel hane sepeti `%60 gıda + %40 enerji`; üretici sepeti enerji/hammadde/parça/elektronik/askerî ikmalden oluşur. Ulusal endeksler sahip olunan bölgelerin nüfus ağırlığıyla hesaplanır. Eski makro enflasyonla köprü özellikle kapalıdır (`legacyInflationBridged: false`).
- Ticaret görünümü, kaynak ve hedef piyasa endeksinden `INDICATIVE_INDEX_QUOTE` üretir. Bu teklif `createsDebt: false`, `transfersCapital: false`, `PAYMENT_PENDING_PHASE_20` taşır; fiyatı ödeme yapılmış gibi göstermez.
- PlayerKnowledge ve şehir dosyasına ayrı `PİYASA` sekmesi eklendi. Oyuncunun kendi bölgesinde fiyat, son değişim, kıtlık bandı, stok/hedef oranı ve stok günü `VERIFIED`; yabancı ayrıntı istihbaratsız `UNKNOWN/null` kalır.
- Lojistik sinyali sıcak döngüde her fiyat için bütün sevkiyatları taramaz; aktif gelen yükler tik başına bir kez `region|resource` indeksine toplanır.

Kabul kanıtı:

- 200 kez dönüşümlü `0,99/1,01` stok oranı verilen fiyat `99,9017–100,0589` aralığında kaldı; sonsuz/genişleyen salınım oluşmadı.
- Sıfır stok, sıfır teslim ve tam açıkta hedef endeks sonlu `600`; ilk tik `100→110`. Açık arz fazlasında hedef `48,6752`, ilk tik `100→90`.
- Gerçek sevkiyat probunda koridor `10000` baz puan hasarla `HELD`; hedef fiyat sinyali `5` birim bekleyen yük ve `10000` hasar gördü. Aynı stok/talepte risksiz hedef `52,7292`, riskli hedef `63,5241`.
- Fiyat tiki öncesi/sonrası bölgesel stok ve ticaret defterleri byte düzeyinde aynı; eski makro enflasyon dizisi de aynı kaldı.
- Kayıt/yükleme fiyat, sinyal, olay ve ulusal sepeti birebir korudu. Eski kayda backfill ve bozuk checksum kurtarması stok veya yoldaki yükü değiştirmedi.
- `qa-runtime/story-phase19-ab.json`: kontrol `3ceb63fafdb26841424e3423f66fcefb0700fc60e50f580be14b69e19a742e4e`, açık `412e5b27ba52698b7234fa098948404dee361500555602417a17c00954be548f`. İlk fark yalnız `$.marketPrices`; fiziksel dünya ve bütün eski metrik deltaları sıfır.
- 900 saniyede `912` aktif fiyatın `671`i `CRITICAL`; ortalama `414,9427`, minimum `58,2748`, maksimum `600`. Bu bir denge başarısı değil, toplam gıda/enerji açığının ölçülmüş fiyat sonucudur.
- 30 yıllık soak `a08f0ad076cc40999e4030d9b7f59256d02cf8a98f69a0396e58bc81bb52992a` karmasıyla geçti; `728/912` fiyat kritik, ortalama `481,6425`, sınırlar `58,2748–600`.

Faz 19 kapsam sınırı: Bu aşama fiyat sinyali ve görünürlüğü kurdu; ödeme, bütçe, borç, vergi, kur, faiz, banka, gerçek ücret ve kapasite yatırımını kurmamıştı. O aşamadaki `671/912` kritik fiyat, ekonominin kendi kendini düzelttiğini değil Faz 20–22’nin ölçülebilir bir sinyale sahip olduğunu gösterdi. Eski `CLEARING_PENDING_PRICE` ticaret politika kimliği kayıt uyumluluğu için korunur; Faz 20 ile yeni sevkiyat görünümü ve gerçek uzlaşma `BUDGET_ESCROW_PRICE_LOCK` durumuna geçirilmiştir.

### FAZ 20 — Devlet Bütçesi, Vergi ve Borç

**Amaç:** Kararları gerçek mali sınıra bağlamak.  
**Çıktı:** Gelir, gider, faiz, borç servisi, para basma ve temerrüt.  
**Kabul kapısı:** Bütçe kimliği her gün sağlanıyor; bedava devlet harcaması yok.  
**Bağımlılık:** Faz 19.

**Uygulanan sözleşme:**

- `js/StoryBudget.js`, sekiz devlet için sürümlü `story-state-budget-ledger-1` ve `fnv1a32:e86e7ccd` politika karmasını taşır.
- Her işlem en az iki posting taşır ve toplamı sıfırdır. Nakit/escrow negatif olamaz; devlet ve canlı komutan cüzdanı aynaları doğrulanır.
- `points`, yeni bir fiziksel stok veya özel şirket parası değildir. Mevcut oynanışı kırmamak için komutan alt hesaplarının toplamı devlet nakdidir; bütün kanonik yazımlar bütçe kapısından geçer.
- Bakiye üstü isteğe bağlı harcama borçlanmayı gizlice tetiklemez; işlem `INSUFFICIENT_CASH` ile atomik reddedilir.
- Borç yalnız açık ihraç veya dış ticaret çalışma sermayesi isteğiyle oluşur. Tavan son yıllık gelirin `2,5×` değeri ile asgari `1.200⭐` sınırının büyüğüdür.
- Yıllık faiz tabanı `%5`, riskle en çok `%30`; yıllık anapara servisi `%2`; ödenmeyen faiz borca eklenir. Gecikme 60 dünya gününü aşarsa `DEFAULT` olur.
- Para basımı gelir sayılmaz: `ASSET:CASH ↔ CONTRA:MONEY_ISSUED` fişi üretir; miktar/nakit oranına göre eski makro enflasyonu artırır ve güveni düşürür.
- Sınır ötesi ticaret notionali `priceIndex × quantity × 0,01 STATE_CREDIT` olarak sevkte kilitlenir. Alıcı escrow’u teslimatta ithalat giderine, aynı settlement kimliğiyle satıcı ihracat gelirine dönüşür.
- Aynı devlet içi lojistik para taşımaz. Kayıp dış yük title transferi gerçekleşmeden alıcı blokesini çözer.
- Eski ticaret şema sürümü korunur. Faz 20 öncesi canlı dış yük, kayıt açılışında finansman alır; finansman alamazsa fiziksel kargo korunarak bekletilir.
- Şehir dosyasındaki `BÜTÇE` sekmesi nakit, bloke, borç/tavan, faiz, gelir, gider, basılan para ve temerrüt durumunu gösterir. Yabancı kesin mali değerler bilgi filtresini atlayamaz.

**Kapatılan ücretsiz para yolları:**

- Otoyol önergesi artık komutanlara para dağıtmaz; `150⭐` gerçek gider karşılığında sahip olunan şehirlerin zenginliğine ölçülü fiziksel etki verir.
- Tasarruf önergesi kişi başına `60⭐` üretmez; refah bedeli karşılığında güven/enflasyon etkisi yaratır.
- Kampanya açılış kadrosu dışındaki yeni komutanlar `200⭐` başlangıç parasıyla doğmaz.
- Tazminat ve haraç tek taraflı para yaratmak/silmek yerine iki devlet arasında aynı settlement kimliğiyle aktarılır.
- Şehir geliri, konsey, üretim/bina, şehir yatırımı, medya çarpıtması, fraksiyon tavizi, sermaye kaçışı, ganimet ve savaş ödülü bütçe kapısına bağlıdır. Kalan kanonik kapı dışı yazım tik/kayıt mutabakatında kaynak etiketiyle yakalanır.

**Ölçülen kabul sonucu:**

- Hedefli örnekte `2.000⭐` açılış nakdinden `100⭐` gider ve `40⭐` gelir tam tutarda işlendi; `99.999.999⭐` harcama nakit/borç/blokeyi değiştirmeden reddedildi.
- `200⭐` tahvil tam `200⭐` borç; `50⭐` para basımı tam `50⭐` para arzı karşı hesabı üretti. Para basımı enflasyonu `2→2,0701`, güveni `50→49,8949` değiştirdi.
- Sınır ötesi üç birimlik yükte alıcı nakdi `2.000→1.997`, escrow `0→3`; satıcı teslimattan önce `2.000`, teslimatta `2.003` oldu.
- Kayıt/yükleme bütçe defterini birebir korur. Bütçe taşımayan eski kayıt canlı cüzdan toplamından açık backfill teşhisiyle geçerli açılış bilançosu kurar.
- `qa-runtime/story-phase20-ab.json`: kapalı `78407b6c…5294`, açık `29b96416…2acb`; mali sınır dünya davranışını ölçülebilir biçimde değiştirdi.
- 900 saniyede sekiz bütçe, `224` bütçe tiki, `17.903,29⭐` nakit, `2.163,03⭐` borç, sıfır açık escrow ve sıfır temerrütle doğrulandı.
- 30 yıllık soak `4b1b3fa0f9258a329ef3f62fb436b0062079cac3e0cc57d6ce23fca2d48c9dac`; `71.196,57⭐` nakit, `1.380,52⭐` borç, sıfır temerrüt.

**Dürüst kapsam sınırı:** Bu faz bütçe kimliğini kurdu, bütçe dengesini veya modern mali devleti çözmedi. Vergi mükellefi/şirket/banka karşı hesapları yok; bölgesel `capital` hâlâ dışarıdan büyüyen fiziksel-ekonomik numeraire ve devlet bütçesine bağlı değil. Otomatik kamu hizmeti tahsisleri, kur, ücret, mevduat, kredi, tahvil piyasası, merkez bankası bağımsızlığı, risk primi aktörleri ve ekonomik AI yok. 30 yılda toplam nakdin `71 bin`e büyüyüp hiçbir devletin temerrüde düşmemesi mali baskının henüz zayıf olduğunu gösterir; Faz 21–22 bu sonucu başarı diye kabul etmemelidir.

### FAZ 21 — Şirketler ve Bankalar

**Amaç:** Ekonomiye çıkarı olan aktörler eklemek.  
**Çıktı:** Şirket kuruluşu, ruhsat, sektör, ortaklık/mülkiyet, nakit, borç, depo/tesis sahipliği, ticari sözleşme, yatırım, lobi ve iflas.  
**Kabul kapısı:** Şirketler devlet kasasının kopyası değil; kâr/zarar ve kapasite üzerinden yaşıyor; konuşmada kurulacağı söylenen şirket kayıt/sermaye/ruhsat tamamlanmadan hukuken ve ekonomik olarak var sayılmıyor.  
**Bağımlılık:** Faz 16, 19–20.

**Uygulanan sözleşme ve aktör sınırı**

- `js/StoryCompanies.js`, `story-company-bank-ledger-1` şema/adaptörü ve `fnv1a32:bf672f25` politika karmasıyla tek kanonik şirket defteridir.
- Başlangıçta altı sektör × sekiz devlet olmak üzere `48` şirket ve her devlet için birer tane olmak üzere `8` banka vardır. Şirketler devlet bütçesinin alt hesabı değildir.
- Her şirketin `10.000` baz puan ortaklığı vardır: başlangıç şirketlerinde `%88` yerli özel sahiplik, `%12` devlet payı açıkça kaydedilir. Yeni şirket sahipliği başvuru sahibine aittir.
- `412` üretim tesisi ve `152` genel depo tek ve doğrulanan şirket sahibine bağlanır. Bir tesisin iki sahibi olamaz; eksik/yanlış sahip defteri reddedilir.
- Şirket hesapları nakit, proje escrow’su, alacak, borç, açılış özkaynağı ve birikmiş sonuçtan oluşur. Bütün şirket fişleri toplamı sıfırdır; negatif nakit ve para koruma farkı reddedilir.
- Banka bilançosu rezerv, kredi alacağı, mevduat ve özkaynak taşır. Faz 21’de mevduat ödeme ağı bilinçli olarak kurulmamıştır; banka, şirket kredisi veren ayrı bilanço aktörüdür.

**Üretim, ticaret ve sermaye bağlantısı**

- Bölgesel `capital`, özellik açıkken dışarıdan her tik büyüyen stok değildir. Bölgedeki şirketlerin harcanabilir nakdinin salt-okunur aynasıdır.
- Üretim önerisi ilgili bölge/sektör şirketinin gerçek nakdiyle sınırlandırılır. Commit sonrasında işletme gideri şirket nakdinden piyasa takas hesabına, satış geliri takas hesabından şirkete çift taraflı kaydedilir.
- Takas hesabı sınırsız değildir; gelir mevcut clearing bakiyesini aşamaz. Açılış para arzı, dış para girişi, şirket nakdi, banka rezervi, başvuru escrow’su ve clearing toplamıyla sürekli mutabakat edilir.
- Faz 18–20 dış ticaretinde satıcı şirket kimliği sözleşme, sipariş ve sevkiyata bağlandı. Teslimat ödemesi artık satıcı devlet kasasına değil fiziksel malın sahibi şirkete gider; alıcı devletin escrow’su korunur.
- Şirket katmanı kapatıldığında eski bölgesel sermaye yolu ve devletler arası ödeme yolu A/B geri dönüşü için çalışmaya devam eder.

**Kredi, yatırım, kuruluş ve iflas**

- Banka kredisi şirket nakdini ve borcunu aynı anda artırırken banka rezervini azaltır, kredi alacağını artırır. Yetersiz rezerv ve borç/özkaynak tavanı krediyi yazım öncesi reddeder.
- Kapasite yatırımı için şirketin tesise sahip olması, faal/ruhsatlı olması, nakit taşıması ve bölgede `18` sanayi parçası bulunması gerekir; ileri teknoloji ayrıca `3` elektronik ister.
- Yatırım nakdi proje escrow’suna, fiziksel girdiler bölgesel stoktan tek atomik işlemde alınır. Herhangi bir borç başarısızsa bütün yazımlar geri sarılır.
- Proje `180` dünya günü `BUILDING` kalır; kapasite başlangıçta artmaz. Tamamlanınca tesise `+0,2` kapasite eklenir, proje gideri gerçekleşir ve bölgesel sektör kapasitesi yeniden hesaplanır.
- Şirket başvurusu ayrı bir yaşam döngüsüdür: başvuru → doğrulanmış sermaye → yetkili ruhsat → kayıt. Sermaye veya ruhsat eksikken ekonomik aktör oluşturulmaz.
- Lobi, etkisini şirket nakdinden satın alır; para yoktan yaratılmaz. Bu faz lobi etkisini kurum/kanun kararına bağlamaz; o bağlantı Faz 28–33 kapsamındadır.
- Faiz dünya günüyle işler. Nakit sıkıntısı `90` günden sonra ödeme güçlüğü, `180` günden sonra iflas doğurabilir; iflas eden şirketin tesisleri kayyım durumuna geçer.

**Bilgi, kayıt ve arayüz**

- Şirket/banka defteri V3 kayda girer; yüklemede şema, politika, para, ortaklık ve referans değişmezleri doğrulanır. Eski kayıt deterministik başlangıç bilançosuyla backfill edilir; bozuk defter kullanılmaz.
- WorldV2 ülke/bölge ve üst düzey aktör görünümüne şirketleri taşır. Oyuncu kendi ülke ve şehrindeki veriyi `VERIFIED`, yabancı şirket mali verisini `UNKNOWN/null` görür.
- Şehir dosyasındaki `ŞİRKETLER` sekmesi şirket, tesis, sahiplik, nakit, borç, kapasite, proje ve banka özetini gösterir. Bu sekme salt okunurdur; tam ekonomi/şirket karar çalışma alanı Faz 60.3 kapsamındadır.
- Dış API sonuçları kanonik canlı nesneleri yayımlamaz; kredi, yatırım, başvuru ve kayıt sonuçları anlık kopyadır. Daha sonraki tikler eski karar kanıtını geriye dönük değiştiremez.

**Doğrulanan kabul kanıtı**

- Açılış: `48` şirket, `8` banka, `412` tesis, `152` depo; bütün sahiplik ve para değişmezleri geçerli.
- Kredi probu: şirket nakdi `160→260`, şirket borcu `0→100`, banka rezervi `1400→1300`, banka kredi alacağı `0→100`.
- Yatırım probu: kapasite `0,9` olarak inşa boyunca sabit kaldı; `18` parça tüketildi ve süre tamamlanınca `1,1` oldu.
- Kuruluş probu: eksik sermaye/ruhsatla kayıt reddedildi; iki koşuldan sonra şirket sayısı `48→49` oldu.
- Kayıt/yükleme byte-düzeyinde eşit; eski kayıt backfill’i, bozuk politika fallback’i, özellik kapalı yolu, yabancı bilgi gizliliği ve kanonik bölgesel sermaye/HOT-WARM-COLD kapsül eşitliği geçti.
- `qa-runtime/story-phase21-ab.json`: kapalı karma `c49859b5…dfcd`, açık karma `a668807b…ce31`. 900 saniyede soyut sermaye `2.190.739,69→73.138,70`, kıtlık kaydı `1179→1015`, kritik fiyat `654→608`; şirket nakdi `73.458,70`, clearing `27.686,44`.
- 30 yıllık soak karması `5a4a5c2944569a41770f43f23009237a9dda5feb9ee4275ec6438aeeac76513e`; `48` şirket, `8` banka, `412` tesis, `94.013,60` şirket nakdi, `11.200` banka rezervi ve geçerli para koruması korundu.

**Dürüst kapsam sınırı:** Faz 21 aktör, mülkiyet ve muhasebe temelidir; kendiliğinden işleyen modern piyasa değildir. 30 yılda şirket borcu `0`, aktif/tamamlanmış otomatik proje `0` ve iflas `0` kaldı. Bunun nedeni sistemin çok başarılı olması değil, şirketlerin henüz kredi/yatırım/ticaret adayı üretip seçen ekonomik AI taşımamasıdır. Gıda toplamı yine sıfıra inmekte, `682/912` fiyat kritik kalmakta ve devletlerin mali baskısı zayıf görünmektedir. Mevduat, hane/ücret/iş gücü piyasası, kur, merkez bankası, vergi mükellefi, özel alıcı ödemesi ve lobi–kurum etkisi de yoktur. Faz 22 bu gerçek mali/fiziksel kapılar üzerinde hilesiz karar davranışı kurmadan “modern ekonomi” iddiası yapılamaz.

### FAZ 22 — Ekonomik AI Politikaları

**Amaç:** AI devletlerinin aynı mali kurallarla üretim, ticaret ve bütçe kararı vermesi.  
**Çıktı:** Kural tabanlı aday üretici ve fayda puanlayıcı.  
**Kabul kapısı:** AI kronik açığı görüp en az bir geçerli düzeltme uyguluyor; hile kullanmıyor.  
**Bağımlılık:** Faz 20–21.

**Uygulanan karar sözleşmesi**

- `js/StoryEconomicAI.js`, `story-economic-ai-ledger-1` adaptörü ve `fnv1a32:99a680ff` politika checksum’ıyla şirket ve AI-devleti değerlendirmelerini tek açıklanabilir defterde tutar.
- Şirket adayları gerçek bölgesel stok açığı, sipariş dolum oranı, fiyat primi, son faaliyet marjı, nakit, borç/özkaynak tavanı, banka rezervi, sanayi parçası ve elektronik girdisini aynı bağlamda puanlar.
- Geçerli eylemler `INVEST_OWN_FUNDS`, `BORROW_AND_INVEST`, `TARGETED_CAPACITY_GRANT` ve `HOLD` ile sınırlıdır. Katalog dışı eylem, sonlu olmayan puan veya kayıttaki adayla bağlanmayan seçim doğrulamada reddedilir.
- Yatırım skoru tek başına yetmez: şirket/tesis faal olmalı, aynı tesiste proje bulunmamalı, fiziksel girdiler mevcut olmalı ve kredi gerekiyorsa hem borç tavanı hem banka rezervi yeterli olmalıdır.
- Şirket, `140` proje nakdine ek olarak `80` işletme sermayesi tamponu korur. Eksik likidite kadar kredi ister; krediyi yatırım başarısız olursa geriye dönük yok saymaz, gerçek borç ve başarısız karar olarak bırakır.
- Uygulanan proje Faz 21’in gerçek yatırım kapısından geçer. Karar sonucu `PENDING`; proje tamamlanınca tesis kapasite farkıyla `REALIZED`, proje kaybolur/iptal olursa `FAILED` olur.
- AI devleti yalnız tarım/enerji gibi stratejik sektörde, özel finansman kapısı gerçekten kapanmış ve skor daha yüksek devlet eşiğini aşmışsa destek adayı üretir. Ödeme `storyBudgetDebit → storyCompanyReceiveStateSupport` çift kapısından geçer.
- Oyuncu ülkesinin özel şirketleri piyasa aktörü olarak karar verebilir; oyuncunun devlet hazinesi adına otomatik destek/harcama kararı verilmez.
- Tekrarlanan `HOLD` kayıtları en güçlü reddedilen adayla kompakt tutulur; uygulanan kilometre taşı kararları dönen kayıt sınırında korunur. Böylece uzun kayıtlar neden bilgisini kaybetmeden sınırlı kalır.

**Bilgi, arayüz ve kabul kanıtı**

- WorldV2 ülke görünümü ekonomik karar özetini taşır. Oyuncu kendi ülkesindeki gerekçeleri `VERIFIED`, yabancı karar ayrıntısını `UNKNOWN/null` görür.
- Şehir `ŞİRKETLER` sekmesi son şirket/devlet kararlarının eylem, durum, puan, gerekçe ve gerçekleşme sonucunu gösterir. Tam yönetim çalışma alanı yine Faz 60.3 kapsamındadır.
- Karar defteri kayda girer; yüklemede politika ve şirket/piyasa/bütçe sözleşme bağları doğrulanır. Eski kayıt boş karar defteriyle backfill edilir, bozuk kayıt kullanılmaz.
- Hedefli doğal koşuda dört karar çevrimi içinde `7` şirket yatırım başlattı, `7` banka kredisi aldı, projelerin tamamı `+0,2` tesis kapasitesiyle gerçekleşti; `0` yapay iflas oluştu.
- Hedefli devlet probunda tarım şirketinin özel finansmanı borç tavanında kapandı. AI devleti `90` destek verdi: hazine `2000→1910`, şirket kasası `0→90`; bütçe ve şirket muhasebesi birlikte geçerli kaldı.
- Oyuncu hazinesi için otonom devlet kararı `0`; yabancı karar verisi sızıntısı `0`. Seçim/adayı bağlamayan kayıt, bozuk politika, negatif sıra ve sonlu olmayan skor reddedildi.
- 900 saniyelik A/B’de `30` karar çevrimi, `1.650` değerlendirme, `7` kredi/yatırım, `7` gerçekleşen sonuç ve `1` hedefli destek üretildi. Kontrolde otomatik proje ve kredi `0` kaldı.
- Fiziksel sonuç çift yönlüdür: gıda üretimi `821,04→3.046,94` yükselirken enerji stoğu `13,30→0`, kıtlık `1015→1014` ve kritik fiyat `608→611` oldu. Bu faz karar üretir; ayarları otomatik olarak “doğru denge” ilan etmez.
- 30 yıllık soak bütün ekonomik AI/şirket/bütçe/bölgesel doğrulayıcıları geçti; `7` proje tamamlandı, şirket borcu faizle `9.196,78`, aktif iflas `0` kaldı. Ancak 30 yılda yeni proje sayısının `7`de kalması sanayi parçası darboğazının ve ikinci kuşak yeniden planlamanın yetersizliğini gösterir.

**Dürüst kapsam sınırı:** Faz 22 ilk hilesiz ekonomik tepkiyi kurdu; tam modern ekonomik devlet veya öğrenen ekonomi değildir. Şirketler henüz ücret, iş gücü kalitesi, kur, mevduat, risk primi, hissedar hedefi, transit/jeopolitik risk ve uzun vadeli talep tahmini görmez. Devlet tarafı hedefli kapasite desteği dışında vergi bileşimi, kamu hizmeti, stratejik rezerv, yaptırım veya kurum yetkisi seçmez. En kritik açık, yatırım girdisi olan sanayi parçaları tükendiğinde aktörlerin koordineli “önce makine üreten kapasiteyi kur” zincirini oluşturamamasıdır. Faz 23–33 toplumsal/mali/kurumsal kanalları, Faz 43–46 dış ekonomik diplomasiyi eklemeden çok alanlı ulusal gündem tamamlanmış sayılmaz.

### FAZ 22.1 — Sanayi Bootstrap ve Ekonomik Stabilizasyon Kapısı

**Neden araya alındı:** Faz 24, daha önce yalnız stok/fiyat raporunda görünen fiziksel çöküşü insan sonucuna bağladı. 900 saniyede gıda erişimi `%0`, enerji `%2,70`, yaşam koşulu `%35,19` oldu. Son 600 ekonomik kararın `463` adayında `PHYSICAL_INPUTS_UNAVAILABLE` görüldü; bütün kapasite yatırımları tek bölgede `18` sanayi parçası isterken ilk yedi proje ağırlıkla nihai tarım kapasitesine gitti. Sivil sanayi ve enerji üst-akışı kurulmadan kalan aktörler `HOLD` döngüsüne girdi. Faz 25’i bu kalıcı kriz üzerinde kalibre etmek yanlış şikâyet/protesto eşikleri üretir; bu nedenle Faz 22.1 geriye dönük düzeltme kapısı olarak Faz 25’in önüne alınmıştır.

**Amaç:** Ekonomik aktörlerin nihai kıtlığa tek adımlı kapasite tepkisi vermek yerine gerçek reçete bağımlılıklarını izleyip, yatırım girdisini fiziksel olarak biriktirip, üst-akıştan alt-akışa uygulanabilir bir sanayileşme zinciri kurmasını sağlamak.

**Yapılacak işler:**

1. Karar defterinde ret nedenlerini sektör, ülke, bölge ve eksik fiziksel girdi bazında kalıcı sayaçlarla ölçmek.
2. Şirketleri dosya/kimlik sırasıyla harcayan küresel eylem bütçesini kaldırmak; aynı çevrimdeki bütün adayları ülke portföyünde karşılaştırmak.
3. Reçete grafından bağımlılık baskısı türetmek. Gıda açığı enerjiye; enerji açığı sanayi parçasına; sanayi parçası enerji ve hammaddeye doğru izlenmeli. Sabit “önce X” hilesi yerine darboğaz zinciri açıklanabilir olmalı.
4. `PHYSICAL_INPUTS_UNAVAILABLE` adayı kör `HOLD` olmamalı. Uygun aktör, gerçek bölgesel üretim veya gerçek lojistik teslimattan gelen sanayi parçası/elektroniği proje hazırlık emanetinde parça parça biriktirebilmeli.
5. Emanete alınan fiziksel girdiler bölgesel stoktan atomik olarak çıkmalı; kayıt/yüklemede korunmalı; proje iptalinde aynı bölgeye geri dönmeli. Bedava parça, negatif stok veya iki kez kullanım yasaktır.
6. Sivil sanayi bootstrap yatırımı kendi ürettiği parçayı tüketebilir fakat kendini yoktan var edemez. İlk parça stoğu ve devam eden üretim tükenirse sistem açıkça `BOOTSTRAP_RESOURCE_EXHAUSTED` raporlamalı.
7. Yerel arz yetersizse mevcut Faz 18 rota, kapasite, gecikme ve ödeme kapılarından yüksek öncelikli yatırım girdisi siparişi oluşturulmalı; mal hedefe ışınlanmamalı.
8. Üst-akış kapasite sonucu gerçekleşmeden alt-akış yatırımı “tamamlandı” sayılmamalı. Plan aşamaları, bağımlı proje kimlikleri ve gerçekleşen kapasite farkı kaydedilmeli.
9. Aynı darboğazda plan değiştirme histerezisi bulunmalı; her 90 günde sivil sanayi↔enerji↔tarım arasında savrulma olmamalı.
10. Oyuncu şirketi/hazinesi otomatik AI yatırımından hariç kalmaya devam etmeli; AI devletleri de gerçek bütçe rezervi ve yetki kapısından geçmeli.

**Çıktı:** Sürümlü bootstrap planı; girdi hazırlık/emanet kayıtları; reçete bağımlılık izi; ülke portföy seçimi; gerçek lojistik tedarik; plan→proje→kapasite→erişim sonuç zinciri.

**Kabul kapıları:**

- Aynı tohum ve aynı özellik bayrakları aynı karar/tedarik/proje sırasını üretir.
- Açık/kapalı A/B’de kontrol mevcut Faz 24 karmasını yeniden üretir; treatment farkı yalnız yetkili fiziksel/mali kapılardan doğar.
- Bölgesel stok + yoldaki yük + proje emaneti için sanayi parçası ve elektronik korunumu tamdır.
- 900 saniyede ilk kuşaktaki `7` projede donma kırılır; en az bir sivil sanayi, bir enerji ve bir tarım kapasite sonucu gerçekleşir.
- `PHYSICAL_INPUTS_UNAVAILABLE` ret oranı ilk ve son 300 saniye karşılaştırmasında düşer; yalnız karar geçmişini budamak başarı sayılmaz.
- Son 300 saniyelik nüfus ağırlıklı hane erişimi gıdada en az `%60`, enerjide en az `%70` olur; hiçbir kaynak dış giriş, bedava kapasite veya doğrudan erişim yazımı kullanmaz.
- Yaşam koşulu kontrol koşusuna göre en az `1.000` baz puan iyileşir. Eski `st.welfare` bu faz tarafından doğrudan değiştirilmez.
- 30 oyun yılında gıda/enerji erişimi sürekli `%0` tabanına kilitlenmez; proje, sipariş ve emanet dizileri sınırsız büyümez.
- Kayıt/yükleme, eski kayıt backfill’i, bozuk emanet kurtarması, özellik-kapalı yol ve WorldV2/PlayerKnowledge bilgi sınırı geçer.

**Bağımlılık:** Faz 16–24.
**Faz 25 geçiş şartı:** Yapısal ve fiziksel korunum kapıları pazarlıksızdır. `%60/%70` erişim bandı ilk denge hedefidir; erişim bandı geçmezse Faz 25 başlatılmaz ve başarısızlık raporu bu dosyada korunur.

**31 Temmuz 2026 ara uygulama kanıtı — kabul değildir:** Reçete darboğaz telemetrisi, ülke portföy sırası, fiziksel hazırlık emaneti, gerçek rota/teslimat tedariki, yıllık nüfusa oranlı demografi ve atomik şirket takası çalışıyor. Bounded sevk denemesi ve artan retry aralığı tek 900 saniyelik simülasyon maliyetini `65,61 sn`den `34,63 sn`ye indirdi; aynı koşuda açık emir `179→151`, aktif sevkiyat `237→209` oldu. Sonraki kalıcı-yüksek-öncelikli üretim emri adayı son 300 saniyede gıda `%48,32`, enerji `%53,62`, yaşam koşulu `%57,00` ve `33` tamamlanmış proje üretti; bütün fiziksel/mali doğrulayıcılar geçti. Buna rağmen `%60/%70` kapısı geçmedi. Ayrıca özellik-kapalı kontrol `8` proje üretip beklenen Faz 24 karmasını yeniden üretmiyor ve `88` üretim ithalat emri şirket yerine devlet finansman kapısında bekliyor. Bu iki sorun kapanmadan Faz 22.1 kabul edilmez ve Faz 25 açılmaz.

İki lojistik sıralama deneyi ölçümle reddedildi. Bütün üretim girdilerini normal kıtlık emirlerinden önce geçirmek son 300 saniye erişimini `%48,47/%53,17`den `%47,56/%50,46`ya düşürdü; yalnız dört parça sevkiyatına erken koridor rezervi ayırmak sonucu `%44,20/%45,30`a ve proje sayısını `18`e indirdi. Bu değişiklikler geri alındı; tek bir alt-katman metriğinin iyileşmesi sistem başarısı sayılmadı.

Şirket ithalatını devlet bütçesinden ayırmak için yapılan ilk alıcı-şirket/banka-kredisi/ticaret-emaneti deneyi de kabul edilmedi. Defterler matematiksel olarak geçerli kalmasına rağmen son 300 saniye gıda/enerji erişimi `%3,94/%6,42`, proje sayısı `12`, iflas eden şirket sayısı `10` oldu. Satıcıya teslimatta ikinci kez gelir yazmayıp şirket ödemesini mevcut merkezî takas havuzuna döndüren ikinci aday da `%4,27/%4,19`, `11` proje, `9` iflas ve `marketClearingCash≈5,51` üretti. Böylece sorun yalnız çift ödeme değil, üretim anında gerçek alıcı olmadan otomatik toptan gelir tanınması olarak daraltıldı. Doğru sıra: geliri üretim anından satış anına taşımak; satış faturası + stok maliyeti + borç/alacak + nihai talep ödeyeni + şirketler arası takasla kapalı para dolaşımı kurmak; ardından şirket ithalat emanetini açmak. İki yarım uygulama da geri alındı ve Faz 22.1 kabul adayı sayılmadı.

#### FAZ 22.1E — Kapalı Para Dolaşımı ve Satışta Gelir Düzeltmesi

Bu alt faz yeni bir “ekonomi bonusu” değildir; Faz 21 şirket defterindeki yanlış zamanlanmış gelir sözleşmesini düzeltir. Fiziksel üretim, satış ve para hareketi aynı olaymış gibi davranmayacaktır.

1. **Mülkiyet sınırı:** Bölgesel fiziksel stok ile şirketin satılabilir envanteri aynı malın iki kopyası olmayacak. Her üretim çıktısı `ownerCompanyId`, edinim maliyeti, miktar, kaynak işlem ve bölge taşıyan toplulaştırılmış envanter lotuna bağlanacak. Bölgesel toplam, lotların fiziksel aynası olarak doğrulanacak.
2. **Üretim fişi:** `storyCompanyOnProductionCommitted` üretim anında `REVENUE:WHOLESALE` yazmayacak. Yalnız ücret/işletme gideri, tüketilen şirket envanteri ve üretilen mamul envanteri kaydedilecek. Gelir ancak mülkiyet alıcıya geçtiğinde doğacak.
3. **Gerçek alıcı sınıfları:** Her stok tahsisi `HOUSEHOLDS`, `COMPANY`, `STATE` veya açıkça tanımlı dış alıcı taşıyacak. Hane talebi bölgesel/kohort toplu cüzdanından, şirket girdisi şirket nakdi/kredisinden, kamu alımı ilgili devlet bütçe kaleminden ödenecek. Ödeyeni olmayan tahsis ücretsiz satış sayılamaz; yardım/sübvansiyon ise ayrı yetkili transfer fişi ister.
4. **Fatura ve teslim ayrımı:** Sipariş, sevkiyat, teslim, fatura, ödeme ve gelir ayrı durumlar olacak. Fiziksel teslim gerçekleşmeden gider/gelir kesinleşmeyecek; iptal, kayıp ve geri dönüşte emanet ve envanter atomik çözülecek.
5. **Borç/alacak:** Peşin olmayan yasal satış `ASSET:RECEIVABLE` ve `LIABILITY:PAYABLE` üretir. Vade, temerrüt, kısmi ödeme ve zarar yazımı para yaratmadan izlenir. Aynı işlem hem satıcı hem alıcı defterinde ortak `correlationId` taşır.
6. **Takas odasının rolü:** `marketClearingCash` sınırsız nihai alıcı olmayacak; yalnız kısa süreli netleştirme/emanet aracı olacak. Açılış bakiyesi, aktif emanet, netleşmemiş alacak ve kapanış bakiyesi için ayrı korunum denklemi kurulacak. Havuzun üretim hacmiyle tek yönlü tükenmesi veya sebepsiz büyümesi hata sayılacak.
7. **Para geri dönüşü:** Şirketlerden hanelere ücret ve temettü; hanelerden şirketlere tüketim; şirket/devletten vergi, kamu alımı ve destek akışları aynı para arzı içinde kapanacak. Faz 22.1 için tam vergi politikası gerekmez, fakat en azından ücret–tüketim çevrimi sonsuz üretimde likiditeyi tek aktörde kilitlememeli.
8. **İthalat finansmanı:** Yalnız 1–7 geçtikten sonra üretim ithalatına gerçek `buyerCompanyId`, banka işletme kredisi ve şirket ticaret emaneti bağlanacak. Devlet ancak açık sübvansiyon/stratejik alım kararı varsa ödeme yapabilecek; varsayılan şirket girdisini devlet borcu finanse etmeyecek.
9. **Geçiş ve özellik kapısı:** Eski kayıtta sahiplik lotu yoksa mevcut stok kontrollü açılış envanterine tek kez dönüştürülecek. `economy.bootstrapPlanning=false` yolu yeni alanlar yüzünden davranış veya karma değiştirmeyecek.
10. **Açıklanabilirlik:** UI ve teşhis çıktısı “kim üretti, kim aldı, kim ödedi, hangi fatura açık, nakit neden bitti?” sorularını tek zincirde cevaplayacak. Toplam nakit doğru olsa bile sektörler arası likidite kilidi ayrıca alarm üretecek.

**22.1E kabul kapıları:**

- Üretim tek başına şirket geliri yaratmaz; kontrollü probda satış olmadan nakit artışı tam `0`dır.
- Tek malın üretim→yerel şirket satışı→üretimde tüketim ve üretim→hane satışı zincirlerinde fiziksel miktar, envanter maliyeti ve para ayrı ayrı korunur.
- Aynı fatura iki kez ödenemez; kayıp/iptal senaryosu alıcı emanetini tam iade eder ve satıcıya gelir yazmaz.
- 900 saniyelik koşuda `marketClearingCash` sıfıra kilitlenmez, hiçbir şirket yalnız muhasebe sırası nedeniyle iflas etmez ve devlet bütçesinde örtük şirket-girdisi gideri oluşmaz.
- Şirket, banka, devlet bütçesi ve takas odası birleşik para denklemi en fazla yuvarlama toleransı kadar sapar; yalnız her defterin kendi içinde dengeli olması yeterli değildir.
- Mevcut fiziksel adayın son 300 saniyelik gıda/enerji/yaşam koşulu sonucu gerilemez; `%60/%70` ana Faz 22.1 kapısı ayrıca geçilir.
- Kayıt/yükleme, eski kayıt göçü, bozuk açık fatura/emanet kurtarması ve özellik-kapalı kontrol için hedefli testler bulunur.

**1 Ağustos 2026 ilk 22.1E uygulama kanıtı — varsayılan kapalı, kabul değildir:** `js/StoryCommerce.js` sahipli fiziksel envanter lotu, satış faturası ve `ON_TITLE_TRANSFER` gelir tanıma sözleşmesini kurdu. Yeni `economy.saleSettlement` bayrağı varsayılan olarak `false`; çalışan Faz 22.1 dünyasına henüz davranış sızdırmıyor. İlk probda `OPERATING_CAPITAL` yanlışlıkla gider sayıldığı için tarım maliyeti `2,045` görünüyordu. Düzeltmeden sonra `2` birim sermaye yalnız likidite eşiği, gerçek fiziksel enerji maliyeti `0,045`, beklenen satış `0,42` oldu. Üretim şirket gelirini `0`da tuttu; hane `0,5` birim aldığında `0,21`, ikinci şirket `0,25` birim aldığında ek `0,105` gelir yalnız mülkiyet geçişinde doğdu. Başlangıç, üretim ve satışlar boyunca birleşik para `90.880` olarak korundu; fiziksel stok–sahipli lot ve şirket envanter maliyeti aynaları geçti. Kayıt/yükleme lotları ve faturaları birebir korudu.

Mikro probdan gerçek zaman akışına geçildiğinde üç ayrı mülkiyet kaçağı ölçüldü ve kapatıldı. İlk bölgesel ekonomi tikinde (`4 sn`) `152 bölge × 5 kaynak = 760` stok–lot uyuşmazlığı depolama/bozulma kaybının yalnız fiziksel stoktan düşmesinden doğuyordu; artık FIFO lotu da yok ediyor ve şirkete ait kaybı envanter değer düşüklüğü giderine bağlıyor. `8 sn` koşusundaki `10` enerji uyuşmazlığı yoldaki ticaret kargosuydu; sevkiyat artık sahiplik ve maliyet lotlarını `shipment:<id>` emanet konumunda taşıyor, teslimatta hedef bölgeye geçiriyor, kayıpta şirket envanterini giderleştiriyor. `60 sn` koşusundaki `8` sanayi parçası uyuşmazlığı yatırım hazırlık emanetiydi; lotlar `escrow:<preparationId>` konumuna taşınıyor, iade/başlatma/gerçek tüketim zinciri aynı mülkiyetle kapanıyor. Özellik açık `60` ve `120` saniyelik birleşik koşularda fiziksel ayna, şirket, ticaret ve ekonomik AI doğrulayıcılarının tümü sıfır sorunla geçti.

`STATE`, `MILITARY` ve toplu `COMPANIES` talepleri artık gerçek devlet/ordu/şirket ödeyenlerine ayrılıyor. Sınır ötesi özellik-açık siparişte kaynak lot yalnız sözleşmedeki satıcı şirkete ait olabilir; hedef ülkenin ilgili sektör şirketi gerçek `buyerCompanyId` olur, nakdi `ASSET:TRADE_ESCROW` hesabında bloke edilir, teslimatta satıcı gelir+COGS yazar ve lot toptan maliyetle ithalatçı envanterine geçer. Satıcısı olmayan açılış/takas stoğu şirket ödemesine zorlanmaz. Hedefte ödeme bekleyen yük geçerli terminal `HELD` durumudur ve tekrar kapanabilir. `20 sn` kaydı `26` aktif şirket rezervasyonu ve `307,0511` escrow ile birebir açıldı; devam eden `8 sn` sonunda şirket, bütçe ve ticaret doğrulamaları geçti.

Doğru 300 saniyelik treatment `464` sınır ötesi emir, `455` şirket alıcısı ve `202` teslimat üretti; bütün bölgesel, şirket, commerce, ticaret, bütçe, pazar ve ekonomik AI doğrulayıcıları geçti. Sonuç gıda `%43,99`, enerji `%50,00`, yaşam koşulu `%54,83`, `7` proje ve sıfır iflastır. Bu mevcut fiziksel adaydan gerilediği ve `%60/%70` kapısını geçmediği için bayrak varsayılan kapalıdır. Otomatik ithalat kredisi deneyi borcu `1.010→1.737`, projeyi `7→5`, gıda/enerjiyi `%43,99/%50,00→%36,86/%40,68` yaptığı için geri alındı. Kredi ancak beklenen perakende marjı, teminat, ayrı risk bütçesi ve yatırım fonlamasını bozmama kapısıyla yeniden ele alınabilir; bedava likidite çözüm değildir. 900 saniyelik açık-treatment ve güncel tam regresyon hâlâ kabul borcudur.

**1 Ağustos 2026 çift-tüketim düzeltmesi:** Settlement açıkken üretim reçeteleri enerji, sanayi parçası ve elektroniği gerçek sahiplerinden gerçek şirket faturasıyla zaten satın alıyordu; `storyRegionalDemandSpecs` aynı tesislere ayrıca `FACILITY_OPERATION`, `MAINTENANCE` ve `TECH_MAINTENANCE` vekil talebi yazarak aynı işletme girdisini ikinci kez fiziksel stoktan düşüyordu. Bu vekiller yalnız settled yolundan kaldırıldı; `60 sn`de `3.996` gerçek COMPANY faturası sürerken vekil parça/elektronik talebi sıfırlandı. Güncel doğru `300 sn` treatment gıda `%55,21`, enerji `%65,89`, yaşam koşulu `%61,47`, `6` proje ve sıfır iflas verdi; yedi defter doğrulayıcısı geçti. Enerji kapısı geçildi, ancak gıda `%60` ve yaşam koşulu `%70` kapıları geçmedi. Son tikte `64` tarım bölgesi enerji girdisi yüzünden tamamen durdu. Enerji güvenli stokunu büyütme, ayrı/ani şebeke akışı, upstream üretim sırası, ölü operasyonel bootstrap planlayıcısını bağlama ve üretim-girdisi sevkiyatını `18→24` büyütme deneylerinin tamamı genel sonucu kötüleştirdiği için geri alındı. Bayrak varsayılan kapalıdır; sıradaki iş kör kapasite değil, bölgeler arası üretim-girdisi tahsisidir.

**1 Ağustos 2026 üretim-girdisi tahsis kanıtı — hâlâ kabul değildir:** Settlement yolunda kaynak bölgenin teorik kurulu kapasite talebini bütünüyle stokta tutması, başka girdisi veya parası yüzünden zaten çalışamayan bölgelerde enerji ve parçayı kilitliyordu. Kaynak rezervi yalnız önceki tikte gerçekten tüketilmiş işletme girdisine indirildi; talep kuyruğu da `parça → enerji → gıda` zincirini sektör kritikliğiyle değerlendiriyor. Bunun karşı yönündeki ping-pong açığı da kapatıldı: belirli bir kaynak `BLOCKING` darboğazıyken yeni teslim edilen stok, sonraki üretim tikinden önce yeniden “fazla” sayılıp dışarı gönderilmiyor; yalnız gözlenen karşılanmamış bir çevrim kadar dar rezerv tutuluyor. Hane gıda dolumu `%50` altına inerken sanayi parçası üretimi tüketimin `%120` üstündeyse sınırlı `DOWNSTREAM_FOOD` modu açılıyor; gıda `%65`e veya parça kapsaması `%95` altına geldiğinde `UPSTREAM_RECOVERY` moduna dönüyor. Bu histerezis yalnız `economy.saleSettlement=true` yolundadır. Faz 28 gerçek ücret/temettü/vergi çevrimini kurana kadar gerçekleşen marjın `%90`ı hane geliri, `%10`u işletme sermayesi vekili olarak iki gerçek cüzdan arasında aktarılıyor; para yaratılmıyor.

Güncel `300 sn` treatment gıda `%60,73`, enerji `%72,52`, yaşam koşulu `%64,26`, `11` tamamlanan + `4` aktif proje ve sıfır iflas üretti. `900 sn` finali `%63,94/%68,41/%65,52`; `600–900 sn` dahil örnek ortalaması `%56,22/%63,61/%62,72` oldu. Bölgesel, ihtiyaç, ticaret, piyasa, bütçe, şirket, commerce ve ekonomik-AI doğrulamalarının sekizi de geçti; şirket nakdi `83.757`, takas nakdi `73.783`, tamamlanan proje `39`, aktif proje `1` kaldı. Buna rağmen son tikte `66` tarım bölgesi enerji, `38` enerji bölgesi sanayi parçası yüzünden tamamen blokeydi; ayrıca yaklaşık `1.012,9` enerji ve `108,3` parça üretim-girdisi kargosu yoldaydı. Sorun artık kör toplam kapasite değil, ülke/bölge içi stok serbest bırakma ve zincir eşzamanlamasıdır. Düz hat coğrafi kaynak seçimi, tarımı sürekli öne alma, bakım girdisini yarıya indirme ve histereziste parça çıkış eşiğini `%85`e gevşetme deneyleri sonucu bozduğu için geri alındı. Varsayılan özellik kapalıdır; değişiklik sonrası tam regresyon `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36` eski karmasıyla geçti. Uzun dönem gıda ortalaması `%60` ve yaşam koşulu `%70` kapıları geçmeden Faz 22.1E kabul edilmez.

**1 Ağustos 2026 ülke-içi dağıtım teşhisi:** Rota gecikmesinin kök neden olduğu hipotezi yanlışlandı. `300 sn` aktif üretim-girdisi rotaları ortalama `14,44 sn`, enerji üretim-girdisi rotaları `6,91 sn`; mevcut dört üretim pencerelik boru hattı `16 sn`. Aynı tikte dünya gıda üretimi/talebi `1.073/1.780` iken enerji üretimi `4.266`, hane+kamu talebi `4.026`, fiziksel enerji stoğu `42.419` oldu. Enerji yok değildir; yanlış bölgelerde kilitlidir ve bu kilit tarım çıktısını gerçek toplam gıda açığına dönüştürür. Ülke 5’te `12.516` enerji stoğuna rağmen `7`, ülke 7’de `7.246` stoğa rağmen `5`, ülke 1’de `4.700` stoğa rağmen `11` tarım bölgesi enerji yüzünden tamamen durdu.

Tik sırasını değiştirme; gerçek rota süresine göre genel, yalnız gıda ve “tek yükte kapatabilen kaynak” seçimi; kişi-ağırlıklı talep; ülke başına ilk sevkiyat; enerji kotasını `6→8` büyütme; elektronik yuvalarını hammaddeye taşıma deneylerinin tamamı gıda/enerji/yaşam koşulu veya proje toplamını düşürdü ve geri alındı. Bu sonuç, ağ veriminin sevkiyat sayısı ve büyük merkez stoklarıyla güçlü biçimde bağlı olduğunu gösterir; sosyal öncelik veya yakınlık, sevkiyat birleştirme/merkez-depo sözleşmesi olmadan eklenemez. `tools/story-sim-harness.js` artık sekiz ülke için stok, üretim, üretim girdisi, nihai talep ve bloklayıcı darboğaz kırılımını kalıcı `countryBreakdown` alanında verir; ülke enerji toplamı dünya toplamıyla regresyon testinde mutabık olmak zorundadır. Varsayılan dünya karması yeniden `230bc647…ef36` geçti.

Tanı bir kademe daha derinleştirildi. Ülke satırı artık teorik stok toplamının yanında gerçek üretim+tüketim işletme rezervini, bu rezerv üstündeki yerli sevk edilebilir miktarı, sahipli commerce lot toplamını, üretim-girdisi sipariş durum/hata kırılımını ve içeri/dışarı fiziksel kargoyu verir. Blokeli tarım sayacı ayrıca bölge kimlikli listeyle birebir kapanır. `300 sn` referansında ülke 5'in `12.516` enerji stoğunun `12.067`si işletme rezervi üstündedir ve sahipli lot toplamı fiziksel stokla örtüşür; buna rağmen blokeli yedi tarım bölgesinin her birinde enerji stoğu tam `0`dır. Aynı desen diğer yüksek stoklu ülkelerde de vardır. Böylece “toplam stok aslında rezerve/defterde sahipsizdi” hipotezi reddedildi: arıza ülke toplamından sıfır stoklu tüketim bölgelerine fiziksel tahsis katmanındadır.

Dört yeni aday da kabul edilmedi. Enerji kotası `6→8` büyütülürken toplam üretim-girdisi bütçesini `18→20` yapmak diğer kaynak yuvalarını koruduğu halde sonucu `%57,79/%67,62/%61,21`e düşürdü. Başarısız açık emri hayalî yoldaki yük saymamak teorik olarak doğruydu, fakat mevcut aday seçici aynı finanse edilemeyen ithalatı çoğaltıp projeyi `11→6`ya, sonucu `%60,68/%68,32/%62,67`ye indirdi. Üretim ve hane enerji açığını tek kargoda dört pencere taşımak `%56,19/%65,19/%61,34`; dört üretim + bir hane penceresi taşımak `%59,36/%70,55/%63,69` verdi. İkisi de birkaç hedefte kargo yığarak kaynak/finansman zincirini bozdu ve geri alındı.

Bu kanıt, sıradaki iç dağıtım sözleşmesinin yalnız “daha büyük sipariş” olamayacağını kesinleştirir. Aday; ülke düzeyinde tek kabul kararı üretmeli, fakat her hedef bacak için gerçek rota, koridor kapasitesi, kaynak stok borcu, sahiplik lotu ve teslim fişi saklamalıdır. Aynı ülkenin küçük bölgesel taleplerini planlama açısından birleştirirken fiziksel teslimatı birleştirmemeli; hedef sayısı/admission bütçesi mevcut yüksek etkili parça-hammadde zincirini dışlamamalı; başarısız dış finansman yerli uygun kaynağı gölgeleyememelidir. Bu sözleşme ve mikro korunum probu kurulmadan yeni kota, hız veya stok bonusu denenmez.

**1 Ağustos 2026 ülke-içi çok bacaklı dağıtım çekirdeği — mikro sözleşme geçti, canlı politika değildir:** `story-domestic-distribution-contract-1` tek ülke kararını `2–8` benzersiz hedef bacağına ayırıyor. Kabul kapısı herhangi bir stok hareketinden önce toplam kaynak stokunu, sahipli ticari kargoyu ve bütün bacakların aynı koridorda biriken kapasite talebini birlikte denetliyor; farklı ülkeye açılan bacağı reddediyor. Kabul edilen her bacak mevcut ticaret motorunda ayrı sipariş, gerçek altyapı rotası, kapasite rezervasyonu, sevkiyat manifestosu, sahipli lot ve teslim fişi üretiyor. Dolayısıyla planlama toplulaştırılmış olsa da fiziksel mal toplulaştırılmıyor veya hedefe ışınlanmıyor.

Tohum `2032` mikro probunda tek kaynaktan iki enerji bacağı `3+2` birim kabul edildi. Kaynak stok sevkte `106,56→101,56` inerken hedefler değişmedi; teslimlerden sonra hedefler tam `+3/+2` arttı. İki farklı sevkiyat kimliği ve iki gerçek rota oluştu; dünya fiziksel toplamı ve ticari mülkiyet toplamı hem önce hem sonra `8.300,36` kaldı. Sınır aşan yerli dağıtım isteği `DISTRIBUTION_CROSS_BORDER_FORBIDDEN`, oynanmış batch toplamı `DISTRIBUTION_QUANTITY_CONSERVATION` ile reddedildi. Yoldaki iki bacaklı batch kayıt/yüklemede ticaret ve mülkiyet defterleriyle bayt-bayt aynı kaldı. Tam `npm test` geçti ve varsayılan 900 saniyelik karma değişmedi: `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36`.

Bu sonuç Faz 22.1E denge kabulü değildir. API varsayılan akışta kendi kendine batch üretmez; opsiyonel batch alanları yalnız açık çağrıda doğar ve yeni özellik bayrağı eklenmemiştir. Sıradaki iş, gerçek bölgesel darboğazlardan bacak seçen, parça/hammadde zincirinin admission bütçesini aç bırakmayan ve hiçbir uygun plan yoksa dürüstçe bekleyen otomatik ülke-içi dağıtım politikasıdır. Bu politika önce mikro yarış/başarısızlık senaryolarını, ardından `300/900 sn` A/B kapısını geçmeden canlı üretim seçicisine bağlanmayacaktır. Admission ile dispatch arasına ileride asenkron aktör girecekse ayrıca atomik rezervasyon/geri alma sözleşmesi kurulmalıdır.

**1 Ağustos 2026 seçici deneyleri — üç aday reddedildi:** İlk aday ülkeleri en uzun süredir hizmet almayan önce sıralayıp iki hedefli batch’i mevcut kaynak kotalarının içine yerleştirdi. Fiziksel sözleşme çalıştı (`1.784,20` planlanan, `661,67` teslim edilen), fakat 300 saniye sonucu referans `%60,73/%72,52/%64,26` gıda/enerji/yaşam koşulundan `%60,51/%63,13/%61,41`e düştü. İkinci aday açlık hafızasını bağlayıcı yaptı, kısa rotayı seçti ve batch’i tek üretim penceresiyle sınırladı; `643,87` planlanan ve `496,46` teslim edilene rağmen `%51,05/%43,75/%56,05` üretti. İki-hedef zorunluluğu değerli tekil sevkiyatları yerinden ettiği için her iki canlı bağlantı tamamen geri alındı. Üçüncü aday batch kullanmadan mevcut tekil taleplerin eşit kritikliğini spot fiyatla hesaplanan marjinal çıktıyla bozdu; proje sayısı `11→13` artsa da sonuç `%60,60/%69,79/%62,83` oldu. Spot fiyatın toplumsal amaç fonksiyonu olmadığı ve kıtlık fiyatını kendini besleyen önceliğe çevirdiği kanıtlandığı için bu değişiklik de geri alındı.

Davranıştan ayrılmış `storyTradeProductionOpportunityView()` karşı-olgusal gözlemcisi tutuldu. Her bloke sektör için bir birim girdinin açacağı çevrim/çıktı, eşzamanlı diğer blokajlar, bekleyen kargo, kaynak bölgenin işletme rezervi, fiziksel stok, sahipli lot, rota kapasitesi ve gecikmesi salt-okunur hesaplanıyor. `60 sn` önce/sonra dünya karması aynı `b0ae18f7…f640`; yedi blokajın tamamı doğru biçimde `PIPELINE_COVERED` sınıfına girdi. `300 sn` settlement treatment’ında `107` fırsatın `72`si `IMMEDIATE`, `23`ü `PIPELINE_COVERED`, `3`ü `NO_DOMESTIC_SOURCE`, `9`u `NO_ROUTE_CAPACITY`: ana açık kaynak yokluğu değildir. Hemen uygulanabilir fırsatlar enerji girdisinde `44`, sanayi parçasında `20`, hammaddede `7`, elektronikte `1`; taşınabilir miktarlar sırasıyla `120,45 / 23,61 / 51,83 / 1,10`. Bununla birlikte spot-değer toplamı tek başına güvenli sıralama değildir. Sıradaki aday; hane gıda/enerji etkisi, zincir derinliği, eşzamanlı blokaj olasılığı, teslim gecikmesi ve ekonomik değeri ayrı bileşenler/guardrail olarak taşımalı; herhangi birini tek skora kör biçimde ezdirmemelidir.

Gözlemci ve üç geri alma sonrasında tam `npm test` çıkış kodu `0` ile geçti; varsayılan 900 saniyelik karma yine tam `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36`. Dolayısıyla bu alt aşama davranış değişikliği değil, doğrulanmış karar kanıtı üretme altyapısıdır.

**1 Ağustos 2026 açıklanabilir amaç vektörü — canlı seçiciye henüz bağlı değildir:** Karşı-olgusal gözlemci, tek spot puanı yerine beş ayrı ve denetlenebilir amaç taşıyor: doğrudan hane/kamu ihtiyacı rahatlaması, canlı aşağı-akış blokajlarını açma gücü, eşzamanlı blokajdan türetilen gerçekleştirilebilirlik, gerçek rota gecikmesi + teslim kapsamı ve ekonomik çıktı değeri. Mevcut seçicinin kaynak sırası/kritiklik/dolum sırası aynı fırsatların üzerinde ayrıca korunuyor. Adaylar bütün ölçütlerde en az eşit ve bir ölçütte kesin üstünlük kuralıyla Pareto katmanlarına ayrılıyor; ülke içi öncü küme de ayrıca raporlanıyor. Bu yapı amaçları tek ağırlıklı skorda gizlemiyor ve yalnız rapor üretir; sipariş, stok, lot, rota veya dünyaya yazmaz.

Tohum `2032`, 300 saniyelik settlement treatment probu referans sonucu ve dünya karmasını birebir korudu: gıda `%60,73`, enerji `%72,52`, yaşam koşulu `%64,26`, karma `8460df44a1a3cc8f4d13a937e12d2de23bd9e95f578b4ef21bb59adc8d431d56`. `107` fırsatın `72`si hemen uygulanabilir; küresel Pareto öncüsünde `19` aday var (`18 SURVIVAL`, `1 CHAIN_RECOVERY`; `6` sanayi parçası, `13` enerji girdisi). Eski sıra ilk sekizde Pareto katmanı `2–3` olan adayları öne alırken açıklanabilir öncü küme, eski sırada `11–56.` basamaklara itilmiş enerji santrali ve tarım hedeflerini ortaya çıkardı. Örneğin eski sırada `43.` olan tarım-enerji adayı `%83,71` doğrudan gıda açığı rahatlatma potansiyeliyle Pareto-1; eski sırada `15.` olan parça→enerji adayı hane ve kamu enerjisinde `10.000/10.000` baz puan rahatlama, tam teslim kapsamı ve canlı zincir açma ile Pareto-1 çıktı. Bu kanıt, mevcut seçicinin “kaynak türü önce” sırasının hedef değerini gömdüğünü gösterir; fakat öncü olmak tek başına sevk yetkisi değildir.

Sıradaki canlı aday, Pareto sırasını kör biçimde kopyalamayacak. Önce ülke/kaynak bütçesi, aynı stok için yarışan adayların karşılıklı dışlama kuralı, en az bir upstream zincir yuvası ve en az bir doğrudan ihtiyaç yuvası, admission–dispatch atomik rezervasyonu ve hiçbir uygulanabilir aday yoksa bekleme davranışı tanımlanmalıdır. Ardından yalnız özellik bayraklı tek karar penceresinde çalıştırılıp `60/300/900 sn` karşılaştırmasında referans hane sonuçlarını, proje sayısını, fiziksel/mali korunumu ve süreyi birlikte geçerse canlı üretim seçicisine aday olabilir.

Pareto hesabı tik/kare yoluna veya her headless simülasyon çağrısına bağlanmaz. Üretim API’sinde salt-okunur olarak her zaman erişilebilir; `story-sim-harness` yalnız `includeTradeProductionOpportunityView: true` isteyen ana kabul/A-B raporunda hesaplar. Ülke içi Pareto katmanları önce ayrı kurulup küresel rank-1 karşılaştırması yalnız ülke öncülerinin birleşiminde yapılır. Bu hem kararın gerçek stok yetki alanını korur hem ilk tüm-dünya katmanlamasındaki kübik maliyeti kaldırır. 300 saniyelik prob aynı `19 küresel / 43 ülke-içi` öncüyü ve aynı dünya karmasını korurken duvar süresi yoğun ilk ölçümde `55,9→30,3 sn` indi.

Temiz tam regresyon çıkış kodu `0` ile geçti. Varsayılan 900 saniyelik dünya karması tam `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36`, ana simülasyonun raporlanan duvar süresi `39.336,97 ms` kaldı. İlk yoğun koşuda bağımsız raster kapısı `526,032 ms > 500 ms` ölçerek durmuştu; aynı raster probu temiz sistemde art arda `38,675 / 34,260 / 37,312 ms`, ardından tam pakette başarılı çıktı. Eşik gevşetilmedi ve harita kodu değiştirilmedi.

Tanı kapısı tam regresyona bağlandı: ülke fiziksel enerji toplamı, ülke sahipli-lot enerji toplamı ve dünya enerji toplamı tolerans içinde eşit olmak; blokaj sayacı bölge kimlikli listeyle birebir kapanmak zorundadır. Tam `npm test` geçişi varsayılan 900 saniyelik `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36` karmasını yeniden üretti. Bu yalnız tanının güvenilirliğini ve kapalı yolun değişmediğini kanıtlar; Faz 22.1E denge kabulü değildir.

### ZORUNLU ARA KABUL — Tek Ekonomi / Şirket Sahibi Merceği

Bu dikey dilim Faz 22.1E kabul edilmeden uygulanmaz; yanlış fiyat/maliyet ve sahte ödeme zincirinin üstüne arayüz kurmak yalnız hatayı oynanabilir gösterir. Ekonomik gerçek kapandıktan sonra tek bir mevcut şirketin AI karar kapısı kontrollü biçimde oyuncuya devredilir. Ayrı şirket ekonomisi veya oyuncuya özel fiyat/üretim bonusu yazılmaz.

İlk döngü yalnız üç gerçek kararı kanıtlar:

1. **Ne üreteyim?** Mevcut tesis, reçete, işgücü, enerji, girdi ve işletme sermayesiyle.
2. **Kime ve hangi şartla satayım?** Gerçek alıcı, fatura, teslimat/title-transfer ve tahsilatla.
3. **Satayım mı, stok/yatırım mı yapayım?** Bozulma, depo maliyeti, fiyat riski, borç ve fırsat maliyetiyle.

Oyuncu ekranı her karar için “neden kâr/zarar ettim?” zincirini üretim fişi → lot maliyeti → satış faturası → ödeme → vergi/finansman → net sonuç olarak gösterebilmelidir. AI şirketleri aynı aday eylem ve kaynak sınırlarıyla oynamaya devam eder; oyuncu kontrolü yalnız seçiciyi değiştirir.

Ara kabul kapıları:

- oyuncu ve AI şirketi aynı durum/eylemde byte-eşdeğer muhasebe ve fiziksel sonuç üretir;
- oyuncuya gizli fiyat, bedava girdi, ücretsiz kredi veya garantili alıcı verilmez;
- üç kararın her biri en az iki savunulabilir seçenek, görünür bedel ve fırsat maliyeti taşır;
- fiyat, stok ve nakit değişiminin ilk üç bilinen nedeni dış tablo olmadan bulunabilir;
- aynı kıtlık şirket sahibi, belediye, yönetici, komutan, ajan ve sivil projeksiyonlarında aynı `factId`/olay zincirinden türeyen farklı fakat çelişkisiz görünümler üretir;
- şirket sahibi dikey dilimi mevcut 900 saniyelik ekonomi sonucunu yalnız ekran açık olduğu için değiştirmez.

### ZORUNLU TASARIM SÖZLEŞMESİ — Proje, Varlık, Bakım ve B2B Hizmet Omurgası

Bu sözleşme dış analizden kabul edilen bina ve proje ekonomisini tek kanonik modele bağlar. **Yeni bir Faz 22.1 kabul şartı değildir ve Faz 22.1E kapanmadan kodlanmaz.** Amaç, daha sonra belediye, şirket, devlet ve savaş motorunun birbirinden kopuk “bina bonusları” üretmesini baştan engellemektir.

#### 1. Tek yaşam döngüsü

Her kalıcı yatırım aynı zincirden geçer:

```text
karar → ProjectV1 → tedarik/sözleşme → gerçek teslimat ve emek
      → kesintiye açık inşa → WorldAssetV1 → işletme getirisi + bakım
```

Bir varlık ancak aşağıdaki üç koşulu sağlıyorsa simülasyona eklenir:

1. para dışında en az bir fiziksel girdi, emek veya doğrulanabilir hizmet tüketir;
2. fiziksel ürün ya da sınırları ölçülebilen kapasite/hizmet/akış/risk azaltımı üretir;
3. arazi, işgücü, enerji, ulaştırma, ruhsat, çevre veya bakım kısıtlarından en az birine tabidir.

Depolanabilir ürün üretmeyen okul, hastane, yol, liman veya mahkeme “çıktısız” değildir; eğitim kapasitesi, sağlık hizmeti kapasitesi, koridor kapasitesi, işlem kapasitesi veya risk azaltımı üretir. Fakat çıplak `+%10 refah/verim` bonusu yasaktır. Etki, önce kanonik kapasiteye; oradan erişim, üretim, vergi, güvenlik veya ihtiyaç sonucuna akar.

#### 2. Kanonik nesneler

- `ProjectV1`: kimlik, şablon/sürüm, sahip türü ve kimliği, bölge, gereksinimler, fiziksel mal kalemleri, emek-gün, enerji/yakıt, nakit, tedarik satırları, ilerleme, duraklama nedeni, başlangıç/bitiş zamanı ve `originEventId` taşır. Durumları en az `DRAFT → PROCUREMENT → READY → BUILDING → PAUSED → COMPLETED/CANCELLED` olur.
- `WorldAssetV1`: proje kimliği, gerçek sahip, bölge, varlık sınıfı, kapasite, kondisyon baz puanı, işletme kısıtları, bakım planı, stratejik dayanıklılık/hedef profili ve çalışma durumu taşır. Aynı varlık savaşta hedef olduğunda ikinci bir bina kaydı doğmaz.
- `MechanicalContractV1`: taraflar, `GOODS/SERVICE/CONSTRUCTION/LOGISTICS/INSURANCE` türü, kapsam, fiyat ve ödeme takvimi, süre, teslim/SLA ölçütü, ihlal sonucu, durum ve nedensel kimlikleri taşır. Sayı ve sonuçların tek mekanik kaynağı budur.
- `ServiceDeliveryReceiptV1`: hizmeti veren şirketin tükettiği emek/girdiler, teslim ettiği hizmet birimi, performans, fatura ve proje/varlık/olay bağlarını kanıtlar.
- `NegotiationCase`, mekanik sözleşmenin kendisi değildir. Yalnız doğrulanabilir bir sözleşme taslağı üzerinde müzakere akışıdır; kabul edilen sürüm deterministik doğrulayıcıdan geçerek `MechanicalContractV1` üretir. LLM dil, gerekçe ve üslup sağlar; fiyatı, kaynağı, teslimatı veya sonucu uyduramaz.

#### 3. Tedarik ve kesintili inşa

- Fiziksel proje kalemleri mevcut emir, kargo, mülkiyet ve escrow hattını; hizmet kalemleri mekanik hizmet sözleşmesini kullanır.
- Söz verilmesi ilerleme sayılmaz. Proje ancak mal teslim fişi, hizmet teslim fişi ve kullanılan emek kaydıyla ilerler.
- Mal, emek, enerji, finansman veya koridor kesildiğinde proje ücretsiz ilerlemez; açık neden koduyla `PAUSED` olur.
- İptalde yalnız kullanılmamış emanet ve malzeme iade edilir. Yapılmış iş, tüketilmiş enerji ve teslim edilmiş hizmet batık maliyettir.
- Toplam proje maliyeti kendi kullanılan girdileri + faturalar + finansman/vergi kalemleriyle yeniden hesaplanabilir olmalıdır.

#### 4. Getiri ve bakım

- Özel ticari varlıklar ürün, hizmet kapasitesi, kira veya sözleşme geliri üretir.
- Belediye/kamu varlıkları çoğunlukla dolaylı getiri üretir: yol koridor kapasitesini, okul eğitim kapasitesini, hastane sağlık erişimini, konut barınma yuvasını, mahkeme işlem/güven kapasitesini değiştirir. Vergi tabanı ve refah sonucu bu etkilerden türetilir; gişe veya ücret varsa ayrı ve açık bir politikadır.
- Bakım gerçek emek, nakit ve gerektiğinde parça/malzeme tüketir. Kondisyon kademeli düşer; eşiklerde kapasite, arıza riski ve güvenlik bozulur. Tek tikte “para yok, bina kapandı” sıçraması varsayılan değildir.
- Ertelenmiş bakım birikmiş borçtur; sonradan telafi edilebilir fakat ücretsiz sıfırlanamaz.
- Her maliyetin tek sahibi vardır. Üretim reçetesinin zaten satın aldığı enerji/parça ile varlık bakımının tükettiği kalem ikinci kez vekil taleple düşülemez. Faz 22.1E’de bulunan çift bakım tüketimi bu sözleşmenin zorunlu regresyon örneğidir.

#### 5. İlk varlık dilimi ve göç

İlk uygulama binlerce tekil bina üretmez. Mevcut `412` tesis ve `152` depo, toplam fiziksel kapasiteyi değiştirmeden toplulaştırılmış stratejik `WorldAssetV1` kayıtlarına göç eder. İlk dilim yalnız karar biçimi gerçekten farklı olan `8–12` şablonla sınanır:

- tarla/çiftlik → gıda işleme → soğuk depo;
- enerji santrali → şebeke/trafo düğümü;
- maden → işleme;
- dökümhane → makine/sanayi parçası;
- elektronik tesisi;
- mühimmat tesisi → askerî depo;
- yol/köprü ile liman/istasyon;
- konut, okul veya hastaneden bir kamu hizmeti dikey dilimi.

`15–20 bina` sabit içerik hedefi değildir. Yeni şablon ancak yeni bir girdi, kısıt, karar, kırılma veya oynanış rolü getiriyorsa eklenir. Mevcut kaynak taksonomisinde bulunmayan otomobil gibi dayanıklı ürün zincirleri, kaynak ve talep sözleşmesi kurulana kadar ertelenir.

#### 6. Stratejik/taktik kimlik ve ayrıntı seviyesi

- Stratejik varlık kanoniktir; savaş alanındaki bina onun aynı `assetId` taşıyan taktik izdüşümüdür. Taktik hasar savaş sonunda aynı kondisyon/kapasite kaydına mutabakatla geri döner.
- `HOT/WARM/COLD` ayrıntı kullanılır. Uzak bölgede hizmet kapasitesi toplulaştırılabilir; oyuncu ilişki kurduğunda deterministik adlarla şirket, yönetici, sözleşme ve varlık ayrıntısı açılır.
- Ayrıntı açılması toplam kapasiteyi, parayı, tarihi veya sonucu değiştiremez. İsim üretmek simülasyon derinliği sayılmaz.
- İlk sürümde oyuncunun doğrudan temas ettiği bir ilişki tam ayrıntıda, bir sonraki halka toplulaştırılmış çalışabilir; sınırsız kişi/şirket grafı yasaktır.

#### 7. Gerçek B2B hizmet şirketleri

İnşaat, bakım, lojistik ve tarımsal hizmet ilk aday hizmet sektörleridir; sigorta/hukuk daha sonra yalnız gerçek risk ve uyuşmazlık sonucu varsa açılır. Hizmet şirketi:

- gerçek tüzel kimlik, sahip, nakit, borç, çalışan, kapasite, itibar ve sözleşme portföyü taşır;
- emek ile enerji/yakıt/parça gibi işletme girdilerini tüketir;
- depolanabilir sahte “hizmet malı” değil, süreli kapasite ve `ServiceDeliveryReceiptV1` üretir;
- sözleşmeyi geciktirebilir, eksik teslim edebilir, ihlal edebilir, yenileyebilir veya kapasite yetersizliğinden reddedebilir;
- hiçbir koşulda kaynak defterini atlayan sihirli bakım/lojistik/verim çarpanı vermez.

#### 8. Rekabet, şirket devri ve kariyer sürekliliği

- Rekabet ayrı bir dekoratif “pazar baskısı” sayacı değildir; fiyat, maliyet, kapasite, sözleşme, nakit, borç, teslim güvenilirliği ve müşteri kaybından türetilir.
- Şirketler küçülme, yatırım, ürün/hizmet değiştirme, sözleşme arama, lobi veya çıkışla tepki verir; rakip yalnız sayısal ceza dağıtmaz.
- Şirket değeri net varlık + doğrulanmış sözleşme/backlog değeri + risk/itibar düzeltmesinden oluşur. Satış, alıcı ve satıcı bütçelerinde dengeli mülkiyet işlemidir.
- Varlık ve şirket sahipliği devredilebilir; oyuncu karakterinin kişisel itibarı, ilişkileri, vaatleri ve geçmişi devredilmez.
- Şirket desteği, siyasi bağış, kamu ihalesi tercihi veya karşılıklı vaat kullanıyorsa bunlar ayrı olay/sözleşme ve `originEventId` izi bırakır. Böylece siyaset–şirket ilişkisi bedelsiz “destek bonusu” değil, daha sonra yolsuzluk ve itibar sistemlerinin inceleyebileceği kanıt olur.

#### 9. Faz yönlendirmesi

Bu sözleşmenin ilk şema/prob işi Faz 22.1E ve şirket sahibi merceği kabulünden sonra başlar. Faz 23–24 zaten uygulanmış olduğundan dış analistin “kohortlardan sonra” bağımlılığı kronolojik olarak sağlanmıştır; eski faz önerisi yeni engel yaratmaz.

- nüfus, barınma ve işgücü etkileri: Faz 23–27;
- kamu kapasitesi, bütçe, ruhsat ve yönetim: Faz 28–33.1;
- müzakere dilimi: Faz 38.3–38.5, ancak yalnız `MechanicalContractV1` taslağı üzerinde;
- stratejik/taktik varlık mutabakatı: Faz 47–51;
- şirket satışı, makam/kariyer geçişi ve rol arayüzü: Faz 34–35 ile Faz 59–60.3.

#### 10. Kabul kapıları

- aynı proje/varlık kararı AI ve oyuncuda aynı kaynak, süre, muhasebe ve sonuç zincirini üretir;
- teslim fişi veya emek kaydı olmadan proje ilerlemez; duraklama/kesinti kaydet–yüklede birebir korunur;
- proje toplam maliyeti faturalar, kullanılan öz kaynaklar, vergi ve finansmanla mutabıktır; iptal para/malzeme yaratmaz;
- bakımı kesilen varlık öngörülebilir biçimde kondisyon ve kapasite kaybeder; bakım geri geldiğinde sınırlı telafi yolu vardır;
- kamu projesi faydası kanonik kapasite ve erişim üzerinden akar, doğrudan refah bonusu yazmaz;
- hizmet sözleşmesi teslim, ihlal, yenileme ve ödeme üretir; aynı etki başka vekil taleple ikinci kez yazılmaz;
- savaşta hasar alan izdüşüm aynı `assetId` üzerinden stratejik dünyaya geri mutabakat verir;
- `8 devlet × 900 sn` koşusunda proje, sözleşme, hizmet şirketi veya olay sayısı sınırsız büyümez; korunum ve determinizm geçer;
- kapalı özellik yolu mevcut ekonomi sonucunu değiştirmez, yalnız UI açılması simülasyonu etkilemez.

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

**Uygulama durumu (31 Temmuz 2026):** Tamamlandı. `js/StoryNeeds.js` gerçek hane tahsislerini, bütçe durumunu, grev ve kuşatmayı 1.824 kohort için farklı ihtiyaç ağırlıklarına çeviriyor. Fiziksel sıfır-stok stresinde çocuk kohortu `3.830`, üst-orta gelirli kamu kohortu `3.545` baz puan yaşam koşulu kaybetti; kabul kapısı geçti. Katman eski `st.welfare` alanına yazmıyor ve ücret bulunmadığı için gelir sonucu açıkça istihdam güvenliği vekili olarak işaretleniyor. Kanıt: `qa-runtime/story-phase24-ab.json`. Denge alarmı: 900 saniyede gıda erişimi `%0`, enerji `%2,70`, ortalama yaşam koşulu `%35,19`; bu açık sonraki fazlarda gizlenmeden taşınacaktır.

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
**Çıktı:** Kişilik eksenleri, değerler, korkular, hırslar, kırmızı çizgiler, ses profili, görev ve kişisel hedefler; oyuncu için role uyarlanır 12 bedelli karar ve nedensel geçmiş tohumu.
**Kabul kapısı:** Aynı durumda farklı profiller ölçülebilir biçimde farklı adaylara ve farklı konuşma stratejilerine yöneliyor; hiçbir profil yetkili eylemi sırf ideolojik etiket yüzünden yasaklamıyor; her karakter yaratım seçimi gerçek kazanç, bedel, en geç 10 dakika içinde görünür ilk sonuç ve kanonik olay/inanç kaydı üretiyor.
**Bağımlılık:** Faz 4, 29.

Faz 34’ün dört kararlı çekirdek boyutu `stateMarketOrientation`, `nationalGlobalOrientation`, `popularTechnocraticStyle` ve `institutionalPosture` olur. `muhalif/yandaş` kişilik değildir; mevcut hükümet, ideolojik mesafe, patronaj, ilişki ve olay geçmişinden türetilen `currentRegimeAlignment` alanıdır. Şahinlik, özgürlük/otorite ve benzeri konu tutumları geniş değer modelinde ayrıca tutulur. Rol bazlı soru metni ve görünür etiket değişebilir, saklanan alanın semantiği değişemez.

On iki kararın kanıt alanı rol bazında dağıtılır: komutan `6/3/3`, şirket sahibi `2/6/4`, belediye başkanı `1/7/4`, cumhurbaşkanı/başbakan `3/4/5`, ajan `2/3/7`, sivil `1/5/6` (`güvenlik / yönetim-ekonomi / siyaset-toplum-bilgi`). Bu dağılım sürümlü içerik politikasıdır ve telemetriyle değişebilir; toplam her zaman 12, her seçenek kazanç+bedel taşır. Geçmiş tohumu `legacy` metniyle sınırlı kalmaz: tarihli olay, `WorldFact`, bilen aktörlerde kaynaklı `ActorBelief`, ilişki/kurum etkisi ve gelecekteki tepki kancası aynı `originEventId` altında yazılır.

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
**Çıktı:** Ekonomi, toplum, siyaset, medya, diplomasi ve askerî domain view-modelleri; altı rol için ortak `WorldFact → ActorBelief → RoleAuthorityProjection → DomainViewModel` hattı; “ne değişti/neden/ne kadar eminim?” sözleşmesi.
**Kabul kapısı:** Test oyuncusu büyük bir değişikliğin ilk üç bilinen nedenini UI’dan bulabiliyor; gizli nedenler sızmıyor; eski/tahmini veri kesin gösterilmiyor. Aynı kıtlık/şirket/rota gerçeği altı rolde aynı `factId` ve kanonik deftere bağlanıyor, fakat yetki, kaynak, yaş ve güvene göre farklı ayrıntı/eylem sunuyor; hiçbir rol paralel ekonomi sayısı üretmiyor.
**Bağımlılık:** Faz 4.1, 10.1, 15–58.2.

### FAZ 59.1 — Kalıcı UI Kabuğu ve Bağlamsal Navigasyon

**Amaç:** Dünya, şehir, yönetim, ekonomi, dış ilişkiler, ordu, toplum, karakter, sohbet, kriz ve tarih alanlarını tek tutarlı navigasyonda birleştirmek.  
**Çıktı:** Kalıcı üst bar, ana navigasyon, bağlamsal çekmece, evrensel arama, derin bağlantı ve geri dönüş geçmişi.  
**Kabul kapısı:** Oyuncu haber→şehir→karakter→sohbet→teklif→sevkiyat zincirini bağlamı kaybetmeden gezebiliyor; tarayıcı benzeri geri dönüş yanlış dünya eylemi üretmiyor.  
**Bağımlılık:** Faz 14.1, 33.1, 38.5, 59.

### FAZ 60 — Yetki, Eylem ve Karar Kartları

**Amaç:** Komutan, şirket sahibi, belediye başkanı, cumhurbaşkanı/başbakan, ajan ve sivil merceklerini bütün ekranlarda anlaşılır kılmak; gayriresmî gücü ayrıca yetki kaynağı olarak göstermek.
**Çıktı:** Kullanılabilir eylem, gereken yetki, maliyet, süre, destek, belirsizlik ve sonuç önizlemesi için ortak kart sözleşmesi.  
**Kabul kapısı:** Oyuncu kilitli eylemin neden kilitli olduğunu ve doğrudan, kurumsal veya sohbet yoluyla nasıl açılacağını biliyor; yüksek etkili kararın hangi sürümünü onayladığını görüyor. Profil hiçbir yetkili eylemi tek başına kilitlemiyor; yalnız maliyet, destek, medya çerçevesi, ilişki ve risk tepkisini değiştiriyor.
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
**Kabul kapısı:** Oyuncu fiyat veya stok değişiminin ana nedenini, darboğazı ve ilgili şirket/rota/karakteri bulabiliyor; çelik sevkiyatı ekran zinciri eksiksiz. Şirket sahibi “ne üret / kime sat / sat mı stok-yatırım mı yap” döngüsünü oyuncuya özel bonus olmadan kanonik şirket defteri üzerinde oynayabiliyor; diğer roller aynı ekonomik gerçeği kendi yetki ve bilgi pencerelerinden okuyor.
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
