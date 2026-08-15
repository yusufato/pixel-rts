# PIXEL RTS — Hikâye Modu Katmanlı Dünya Simülasyonu Ana Planı

**Belge sürümü:** 1.74
**Kapsam:** Yalnızca hikâye modu  
**Durum:** Dalga A / Faz 0–3.1, Dalga B / Faz 4–10.1, Dalga C / Faz 11–14.6, Dalga D / Faz 15–22, Dalga E / Faz 23–27, Dalga F / Faz 28–33.1 ve Dalga G / Faz 34–38 tamamlandı; aktif sıra Faz 38.1 — Oyuncu Konuşmasını Anlama
**Ölçek:** Uzun vadeli, onlarca bağımlı faz  
**Ana ilke:** Her faz tek başına ölçülebilir, geri alınabilir ve oynanabilir bir çıktı üretmeden sonraki faza geçilmez.
**Oynanabilirlik kapısı:** Yalnız veri, tablo, bildirim veya salt-okunur görünüm üreten katman tamamlanmış oyun özelliği sayılmaz. Oyuncu en az bir yetkili ve bedelli eylemle dünyaya müdahale edebilmeli; karakter bulunan alanlarda bu eylem isimli karakter, ilişki, söz, karşılık veya çatışma üzerinden kurulmalı ve sonucu kanonik dünya/olay defterine yazılmalıdır. Arayüz henüz var olmayan hedefli etkileşimi varmış gibi gösteremez.

**1.1 değişikliği:** Serbest oyuncu sohbetinin gerçek şirket, ticaret, lojistik, yetki, blöf, sözleşme ve uzun vadeli karakter hafızasına dönüşmesini tanımlayan “Çelik Şirketi ve Britanya Sevkiyatı” referans kabul senaryosu eklendi.

**1.2 değişikliği:** Ekonomi, toplum, medya, istihbarat, diplomasi ve iç siyaseti kapsayan on dallı referans diyalog ağacı ile bunların otomatik senaryo matrisi eklendi.

**1.3 değişikliği:** Genel mimari denetim yapıldı; diyalog fazı bağımlılıkları düzeltildi, tam entegrasyon kapısı eklendi, sistemik olayların yanlışlıkla tekrar cezasıyla bastırılması engellendi, LLM çalışma zamanı/bağlam/güvenlik kuralları ve anlamlı kampanya çeşitliliği ölçümleri güçlendirildi.

**1.74 değişikliği:** Faz 38 sonrası kompleks sohbet yükseltmesi `HIKAYE_SOHBET_MOTORU_GELISTIRME_PLANI.md` belgesine bağlandı. Milyonlarca cümleyi kodlama yaklaşımı reddedildi; `DialogueMove + domain adaptörü + söylem durumu + kanıt referansı + 8B gerçekleştirici` mimarisi kabul edildi. Yaklaşık 8,99 GB Coder-14B canlı ikinci model değil, oyun kapalıyken sırayla çalışan adversarial oyuncu/eleştirmen/öğretmen olarak sınırlandı. Mevcut 8B'nin gerçek `8192` bağlam tavanı korundu; 10 bin ham token yerine çalışma belleği, episodik özet ve kanonik hafıza ayrıldı. Gerçek oyuncu JSONL kayıtları nihai kabul kaynağıdır.

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

**1.38 değişikliği:** Faz 22.1E, gerçek satış uzlaşması, dört-pencere Pareto hacmi ve ülke içi hane dağıtım kabulüyle tamamlandı. Katman hane erişimini soyut bonusla yükseltmez; yalnız gerçek tahsis açığı, stok, sahipli lot, sipariş/kargo ve ortak rota kapasitesi üzerinden mevcut fiziksel ve mali defterleri kullanır. `60/300/900 sn` ve son 300 saniye kapıları, sekiz doğrulayıcı, kayıt/yükleme ve deterministik tekrar geçti. 900 saniye finali gıda `%76,55`, enerji `%77,56`, yaşam koşulu `%70,82`; karma `9dd9f7fc…4719`. Faz 25 açıldı. Talep/kaynak başına rota çözümü ölçülmüş performans borcu olarak açık tutuldu.

**1.39 değişikliği:** Faz 25, Faz 24'ün fiziksel yaşam sonuçlarını değiştirmeden 1.824 kohort için açıklanabilir kamuoyu ve şikâyet hafızasına dönüştürdü. Her kayıt sorun türü, gerçek sorumlu görülen aktör, dayanak, güven, tekrar sayısı, aktif/iyileşen durum ve unutma eğrisi taşır. Kısa iyileşme geçmişi silmez; aynı kriz geri döndüğünde tepki büyür. Kendi bölgesi doğrulanmış sosyal araştırma verisi, yabancı bölge istihbaratsız `UNKNOWN` kalır. 900 saniyelik tam kabul koşusunda 7.696 sınırlı kayıt, `%71,24` ağırlıklı ortalama şiddet ve değişmeyen fiziksel sonuçlar üretildi; kompakt kayıt `1.725.815` karakter, dünya karması `b813d8a7…a664`, tam test çıkışı `0`. Faz 26 açıldı.

**1.40 değişikliği:** Faz 26, şikâyet hafızasını rastgele zar atmadan ve eski genel refah/fraksiyon sayaçlarına ikinci kez ceza yazmadan aşamalı kolektif eyleme dönüştürdü. `story-collective-action-ledger-1`; sorun, algılanan sorumlu, yayılım, süre, tekrar, örgütlenme vekili, mobilizasyon, radikalleşme, bastırma hafızası ve devlet tepkisini tek nedensel kayıtta tutuyor. Protesto fiziksel üretimi düşürmez; yalnız gerçek gelir/istihdam grevi ilgili bölgede üretimi `%65`e, ayaklanma `%30`a indirir. Normal 900 saniyelik dünya 56 sınırlı hareket, 5 aktif protesto, 0 zorlanmış grev ve 0 zorlanmış ayaklanma üretirken ağır kriz probu protestoyu 11., grevi 16. tikte başlattı; tekrarlanan bastırma 55. tikte nedensel ayaklanma üretti. Tam karma `7a42d4d6…4b14`, politika karması `fnv1a32:bd78ac61`, A/B ilk farkı yalnız `$.collectiveAction` ve eski bütün makro/kaynak deltaları `0`; Faz 27 açıldı.

**1.41 değişikliği:** Faz 27, `story-human-migration-ledger-1` ile iç göç, sınır ötesi göç ve mülteci akışını kanıtlı itme/çekme sinyali, gerçek kara/deniz rotası, rota darboğazı, seyahat gecikmesi ve kabul kapasitesine bağladı. Nüfus yalnız varışta `StoryPopulation` üzerinden tam kişi/kohort korunumu ile atomik taşınır; ulaşılamayan hedefe ışınlanma, üçüncü ülke transit geçişi ve hileli kaynak üretimi yoktur. Zorlanmış güvenlik krizinde 90 kişilik mülteci akışı kapasite doluyken bloke oldu, kapasite açılınca sıfır nüfus farkıyla tamamlandı. Nihai 900 saniyelik koşuda 231 sınırlı akış, 167 tamamlanma ve 3.955 taşınan kişi; `%85,13/%85,36/%73,33` gıda/enerji/yaşam sonucu ve `880b861b…cb6` karma üretildi. `qa-runtime/story-phase27-ab.json` açık/kapalı dünyanın farklı olduğunu; refahın aynı, huzursuzluğun `-0,195`, kaynakların ise fiziksel dağılım nedeniyle farklı olduğunu kaydeder. Tam test 23,5 dakikada çıkış kodu `0` ile geçti. Konut varlığı, sınır politikası ve ticaretle ortak taşıma kapasitesi henüz gerçek model değildir; Faz 28 açıldı.

**1.42 değişikliği:** Faz 28, `story-power-center-ledger-1` ile sekiz devletin her birinde silahlı kuvvetler, iş dünyası konseyi, emek konfederasyonu, kamu idaresi, medya ağı, iç güvenlik ağı ve radikal ağ olmak üzere 56 kimlikli güç merkezi kurdu. Destek tabanı kanonik 1.824 nüfus kohortundan; mali ve fiziksel kaynaklar şirket/banka, bütçe, komutan ve garnizon defterlerinden gelir. Faz 26 örgütlenmesi kimlikli merkez referanslarına göç etti, fakat ilk doğrudan kapasite bağlantısının yarattığı kelebek etkisi reddedildi; nötr referans, `1.200` baz puan ölü bölge ve yalnız aşırı kurumsal sapmaya `%25` ağırlık getirildi. 900 saniyelik A/B’de bütün eski makro/kaynak deltaları `0`, kontrol `f9ce09…c4bfc`, açık dünya `52bd56…6607a`; açık yol 56 merkez ve 26 olay üretti. Tam `npm test` `1.645 sn`de çıkış kodu `0` verdi. Güç merkezleri Faz 29 öncesinde eylem icra etmez; medya, güvenlik ve beş makam lideri açık vekildir ve gerçek sahiplerine sırasıyla Faz 39, 47 ve 34’te göç edecektir. Faz 29 açıldı.

**1.43 değişikliği:** Faz 29'un ülke-bazlı anayasal yetki fişleri Faz 30'da `story-state-capacity-ledger-1` uygulama zincirine bağlandı. Meşruiyet, bürokratik kapasite, hukuk devleti, kurumsal bütünlük, yapısal yolsuzluk riski, bölgesel denetim ve uygulama kapasitesi ayrı ölçülerdir; “yolsuzluk riski” kanıtlanmış suç veya fail değildir. Yalnız gerçek kurum önericisi ve yürütücüsü olan `EXECUTED` Faz 29 kararları kimlikli uygulama bileti doğurur. Sağlıklı devlette karar `COMPLETED`, çalışan bürokrasi fakat zayıf bütünlükte `DEGRADED`, kapasitesi çökmüş devlette süre sonunda `PAPER_ONLY` olur. Sonuç fişleri henüz fiziksel ekonomi/dünya mutasyonu yapmaz; sonraki domain sahibi yalnız `effectReady` ve değişmez yetki makbuzunu tüketebilir. Hedefli prob normal/tahrip olmuş/zayıf bütünlük yollarını, gizlilik, salt-okunur UI, kayıt/yükleme, V3→V2 göç, bozuk kayıt kurtarma ve özellik/öncül kapalı yokluk sözleşmesini geçti. 900 saniyelik A/B'de eski makro ve üç kaynak deltasının tamamı `0`; açık dünya `6ab5c579…fd50`, kontrol `8f99c8f0…8d21`. Tam `npm test` kapsam azaltılmadan `1.947,9 sn`de çıkış kodu `0` verdi. Faz 31 açıldı.

**1.44 değişikliği:** Faz 31, `story-election-mandate-ledger-1` ile sekiz devletin anayasal rejimine göre oransal parlamento, halk oylu liberal yürütme, meclis seçimi veya sınırlı yürütme yarışını kurdu; askerî rejimde seçim uydurulmaz ve haleflik Faz 33'e bırakılır. Oylar kanonik yetişkin nüfus kohortlarından tam kişi düzeyinde; katılım yaş/eğitim/şikâyet/meşruiyet, tercih ise iş/kimlik/gelir, mesele hafızası, kamusal güç merkezi desteği ve ülke siyasi yönelimiyle açıklanır. Dar sonuç + zayıf hukuk itiraz üretir; sertifikalı sonuç yeni mandat ve makam kimliği doğurur, fakat Faz 34 öncesinde adaylar açıkça `POLITICAL_SLATE_PROXY_PRE_PHASE_34` listesidir. 900 saniyelik A/B'de açık yol `24` seçim kaydı, `11` sertifika ve `11` barışçıl devir üretirken refah, enflasyon, huzursuzluk, devlet/haber ve üç kaynak deltası `0` kaldı; açık karma `f7cfa97e…230d1`, kontrol `20ccfde1…d2a2`. Save/load sırasında makam imzasının iki kez değişip sahte olay üretmesi ve Faz 25'in eski A/B filtresinin yeni yönetişim defterlerini kapsamaması tam regresyonda yakalanıp düzeltildi. Tam `npm test` kapsam azaltılmadan `1.867,8 sn`de çıkış kodu `0` verdi. Faz 32 açıldı.

**1.45 değişikliği:** Faz 32, `story-integrity-investigation-ledger-1` ile yapısal saptırma riski, iddia, ön inceleme, resmî soruşturma ve kanıtlanmış/kanıtlanamamış sonucu ayrı durumlara böldü. Temiz ihale sıfır dosya bırakır; gerçek kurum yetkisi, bütçe fişi ve şirket kimliği olmadan ihale incelemesi açılamaz; yasal yetki/ödeme fişleri suç lehine değil `NEUTRAL` kanıttır. Hedefli probda tek teklif + `%50` fiyat sapması `4271 bp` ile `UNSUBSTANTIATED`, açık rüşvet fişi `6321 bp` ile `SUBSTANTIATED` oldu; sahte veya tekrar kullanılan yargı yetkisi reddedildi. WorldV2, PlayerKnowledge ve şehir `KURUMLAR` görünümü kendi kanıtı ile yabancı kamusal sonucu ayırır; kayıt/yükleme, göç, eski/bozuk/kapalı yollar geçti. `qa-runtime/story-phase32-ab.json` açık/kapalı `900 sn` fiziksel karmayı aynı `dd4ea478…f42c`, ilk farkı boş ve makro/kaynak deltalarını sıfır kaydetti. Tam `npm test` `52/52` görevle `1.664,7 sn`de geçti. Faz 33 açıldı.

**1.46 değişikliği:** Faz 33, `story-political-crisis-ledger-1` ile darbeyi isimli aktör, hazırlık, koalisyon, karşı-güç, istihbarat, kaynak fişi ve deterministik teşebbüs zincirine dönüştürdü. RNG/LLM hüküm vermez; AI aynı kaynak kapısını kullanır ve kriz başına tek karşı hamleyle sınırlıdır. Oyuncu komplo lideriyle görüşme, sadık komutanla komuta zincirini güvenceye alma, kamuya açıklama veya bekleyip izleme yoluyla gerçek bedel ve sonuç üretir. 900 saniyelik A/B `7` kriz, `3` başarısız teşebbüs, `4` dağılma, `5` eylem ve `43` olay ölçtü; tam regresyon `54/54` geçti. Yalnız veri gösteren sistemlerin tamamlanmış sayılmasını yasaklayan karakter-eylem oynanabilirlik kapısı ana ilkelere eklendi. Faz 33.1 açıldı.

**1.47 değişikliği:** Faz 34, `story-character-identity-ledger-2` ile karakteri eski dört eksen/üç beceri özetinden dört kararlı çekirdek boyut, değerler, korkular, hırslar, kırmızı çizgiler, rol/kişisel hedefler ve ses profiline yükseltti. Rejim hizası kişilikten ayrılıp güncel rol–sadakat–kurumsal mesafeden türetilir; profil hiçbir yetkili seçeneği yasaklamaz. Faz 31 liste vekilleri isimli aday karakterlerine ve gerçek makam sahiplerine göç etti. Karakter yaratımındaki 12 karar rol politikasına bağlandı; komutan `6/3/3` dağılımında ilerler, her seçenek tıklanmadan önce gerçek kazanç ve bedelini gösterir. Seçim aynı `originEventId` altında mekanik delta, `WorldFact`, bilen karakterlerde kaynaklı `ActorBelief`, tepki kancası ve anında görünür sonuç üretir. Hedefli prob `12` olgu, `31` inanç, `12` olay, yabancı bilgi sızıntısı `0` ve V3→V2 göçte `12/31` kayıpsızlık verdi. Tam `56/56` regresyon `819,6 sn`de geçti; eski 900 saniyelik dünya karması `145d5775521b8ac8db834ccc76c6e417168eb0c61959cd6a8b744e3aa28b3b72` kaldı. Faz 35 açıldı.

**1.48 değişikliği:** Karakter yaratım kararı düzeltildi: mekanik kazanç/bedel kanonik ve test edilebilir kalır, fakat oyuncuya seçimden önce gösterilmez; amaç min-max değil kişilik seçimidir. Zar ekranı askerî komutan, şirket yöneticisi, siyasi lider ve ajan rolünü seçtirir. Seçilen rol yalnız kota değil içerik değiştirir: üç yeni yol için `36` özgün ikilem eklendi ve kanonik kimlik artık zorla `PLAYER_COMMANDER` olmaz. Dünya kadrosu `176` isimli askerî, siyasi, şirket ve istihbarat aktörüne genişledi. Faz 35 adayı `story-character-relationship-ledger-1`, tam N² yerine `627` anlamlı yönlü kenarda güven/korku/saygı/borç/husumet tutar; A→B ile B→A ayrıdır ve 12 köken kararı oyuncuya yönelik `21` bağı başlangıçta etkiledi. WorldV2, PlayerKnowledge, V3→V2 göç ve birebir kayıt/yükleme hedefli testleri geçti. Şehir/ekonomi paneli çok girişli LRU ile `33` istekte `1` tam görünüm kurulumu ve `32` isabet verdi. Tam `npm test -- --workers=6`, eşzamanlı savaş AI CPU yükü altında assertion vermeden `30 dk` komut tavanına ulaştı; bu nedenle Faz 35 henüz kapanmadı.

**1.49 değişikliği:** Rol seçiminin sahte mekanik ortaklığı temizlendi. Komutan dışındaki üç başlangıç rolünün 12 cevabı artık petrol/insan gücü/komuta puanı yerine role göre adlandırılan `influence/credibility/autonomy/capability` kariyer durumunu değiştirir. Şirket sahibi gerçek ülke sanayi şirketine, ajan istihbarat servisine, siyasi lider yürütme kurumuna, komutan silahlı kuvvetler kurumuna bağlanır; şirket sahibi seçimi oyuncuyu gizlice yürütme veya ordu makamına yerleştirmez. Kariyer ve kurumsal bağ WorldV2, PlayerKnowledge ve `legacy-save-v3-to-v2-8` göçünde korunur. Faz 35 hedefli probu `176` aktör/`627` bağ ve birebir save/load ile yeniden geçti. Şehir/ekonomi paneli `64` anahtarlı LRU, DOM metin aynası ve şehirler arası paylaşılan dünya/bilgi anlık görüntüsüyle güçlendirildi; dört şehirlik tur `37 istek / 4 şehir dosyası / 1 WorldV2+PlayerKnowledge kurulumu / 33 görünüm isabeti / 0 tahliye` verdi. Tam regresyon hâlâ temiz CPU penceresini beklediği için faz `partial` kalır.

**1.50 değişikliği:** Oyuncunun işaret ettiği `Şehre Gir → Nüfus/Kurumlar` takılması ayrı ağır-sekme kapısına dönüştürüldü. Nüfus render'ındaki ikinci population-ledger klonu kaldırıldı; görünür PlayerKnowledge kohortlarından aynı işgücü sonucu türetiliyor. Tooltip hazırlığı layout tetikleyebilen `innerText` yerine `textContent` kullanıyor; ekran dışındaki uzun dosya bölümleri Chromium `content-visibility` ile erteleniyor. Hazırlanmış sekme DOM ağaçları en fazla 12 girişlik fragment önbelleğinde tutuluyor; Nüfus ve Kurumlar tekrar açılışı `0` yeni view, `0` WorldV2/PlayerKnowledge kurulumu, `0` HTML üretimi, `0` `innerHTML` yazımı ve `2` DOM geri yüklemesiyle geçti. Geniş rol seçiminin ana navigasyon/yetki/eylem yüzeyini henüz değiştirmediği açık borçtur: çözüm Faz 37 aday eylemleri ile Faz 59–60.3 rol projeksiyonudur. Bina çeşitliliği de yüzeysel yeni buton borcu değildir; EXT-ACT-012 kapsamında `ProjectV1 → WorldAssetV1`, bakım ve ilk `8–12` gerçekten farklı şablonla ele alınacaktır.

**1.51 değişikliği:** Faz 35 tam kabul kapısı kapandı. İlk tam 56-görev koşusu, başlangıç rolünü yürütme makamına kalıcı kilitleyen bir regresyon yakaladı: kampanya içinde yürütme makamını kazanan komutan hâlâ genelkurmay başkanı görünüyordu. Başlangıçta yalnız siyasi lider `state.gov.leader = player` olacak şekilde rol bağı kuruldu; kurum sahibi ise daha sonra gerçekleşen seçim/atama durumunu yeniden okuyacak biçimde düzeltildi. Hedefli karşı-test, şirket sahibinin yürütme/ordu makamını çalmadığını ve komutanın sonradan cumhurbaşkanı olabildiğini birlikte doğruladı. Ardından savaş AI yüküyle eşzamanlı ikinci `npm test -- --workers=6`, `56/56` görevle `2.185,4 sn`de, çıkış kodu `0` ve ana 900 saniyelik `145d5775521b8ac8db834ccc76c6e417168eb0c61959cd6a8b744e3aa28b3b72` karmasıyla geçti. Faz 35 tamamlandı; Faz 36 açıldı.

**1.52 değişikliği:** Faz 36'nın ilk çalışan dikey dilimi `story-character-memory-ledger-1` ile kuruldu. Aktör başına en çok `24` yakın kayıt, en çok `12` deterministik dönem özeti, açık/çözülmüş konuşma bölümleri ve budanmayan `ORIGIN/PROMISE/SECRET/BETRAYAL/DEBT` mihenk taşları ayrıldı. LLM ve kaynaklanmamış metin yazımı yasak; köken hafızası yalnız `12 WorldFact + 31 ActorBelief` zincirinden doğuyor. Gerçek `Talks.js/law-complaint` konuşması açılışta EPISODE, cevapta RESOLVED, söz veren seçenekte PROMISE üretti. Ülke 0 ve ülke 1 sırları iki yönde sızmadı; WorldV2, PlayerKnowledge v3, V3→V2 göçü ve birebir save/load geçti. Scheduler devam probunda 73. saniye kayıt/yükleme sonrası karma kesintisiz koşuyla aynı `a57155c8…1b5c` ve fark listesi boş kaldı. Faz `partial`: siyasi kriz, gerçek sır/ihanet/borç üreticileri, dönemsel yoğunlaştırma ve uzun soak kapısı henüz açık.

**1.53 değişikliği:** Faz 36 ilk dilimin tam regresyon denetimi iki entegrasyon kusurunu yakaladı ve kapattı. Karakter kimliği öncülü kapalı A/B yolunda Talks.js aktör çözümleyicisinin `null.identities` okuması null-safe yapıldı; aynı yol artık hafıza `null` iken gerçek konuşma üretir. Yeni hafıza probunun assertion importu da manifest ile eşlendi. Nihai paket `57/57` görev üretti. Eşzamanlı savaş AI yükünde raster cache duvar süresi `3.365,171 ms` ile değişmez `2.000 ms` kapısını aştı; eşik gevşetilmedi. Aynı `mapRasterProbe` tek işçide `631,22 ms`, `1350/300` çözünürlük, `%0,216102` kıyı farkı ve eşit A/B karması verdi. Korunmuş 57 sonuç üzerinde bütün assertion dosyası çıkış kodu `0` ile geçti; ana 900 saniyelik dünya karması `145d5775521b8ac8db834ccc76c6e417168eb0c61959cd6a8b744e3aa28b3b72` kaldı.

**1.54 değişikliği:** Faz 36'nın kaynaklı içerik zinciri tamamlandı. Faz 33 siyasi krizi kanonik aktörlerle açık EPISODE, her karşı hamle çözülmüş EPISODE ve gerçek ATTEMPT sonucu BETRAYAL üretir. `political.bribe` seçeneği artık gerçek bütçe işlem kimliğini döndürür; alıcının oyuncuya yönlü `debtBps` değişimi tek ve güncellenebilir DEBT mihenk taşına bağlanır. Kamuya kapalı, `SUPPORTS`, özgünlük ve ilgi eşiği en az `8000` olan bütünlük kanıtı yalnız kanonik iç-istihbarat aktörüne SECRET yazabilir. Aynı aktör/konu için yinelenen açık söz yeni kalıcı kayıt çoğaltmak yerine aynı PROMISE'ı günceller. Hafıza bütçeleri `24` yakın/aktör, `12` özet/aktör, `64` açık bölüm, `48` çözülmüş bölüm, `2048` mihenk taşı ve `4.000.000` serileştirilmiş karakter olarak doğrulanır. Gerçek 900 saniyelik koşu `84.578` karakter, `111` yakın kayıt, `12` özet, `3` açık/`30` çözülmüş bölüm ve `3` BETRAYAL ile sıfır doğrulama sorunu verdi; dünya karması `145d5775…b3b72` kaldı. Bütçe, bütünlük, kriz, hafıza, göç ve scheduler hedefli regresyonları geçti; scheduler devam karması iki yolda `d2e287bf…c3c79a` ve fark listesi boştu. Resmî Faz 36 kapanışı, kullanıcıya ait CPU-ağır oracle süreci altında `57` görevli koşunun yaklaşık `2 sa 24 dk` sonunda süreç zaman aşımına uğraması nedeniyle beklemededir; assertion hatası gözlenmedi ancak bu koşu geçmiş sayılmaz.

**1.55 değişikliği:** Oracle tamamlandıktan sonra değişmez tam kabul paketi yeniden çalıştırıldı. Altı işçi `57/57` görev sonucunu `2.594,3 sn`de üretti. Paralel yük altındaki tek başarısız assertion harita cache duvar süresiydi (`3.896,741 ms > 2.000 ms`); eşik gevşetilmedi. Aynı `mapRasterProbe` tek işçide `573,204 ms`, geçerli raster sözleşmesi ve eşit `83de27a9…a5f6` A/B karması verdi. Yalnız doğrulanmış izole raster sonucu korunmuş 57'li sete kondu; tüm `tests/story-world.test.js` assertion'ları çıkış kodu `0` ile geçti. Ana 900 saniyelik dünya karması `145d5775521b8ac8db834ccc76c6e417168eb0c61959cd6a8b744e3aa28b3b72` kaldı. Faz 36 resmen tamamlandı; Faz 37 açıldı.

**1.56 değişikliği:** Faz 37'nin ilk dikey dilimi `story-character-action-ledger-1` ile kuruldu. İkna, müzakere, emir, sabotaj, ittifak, istifa ve ihanet adaylarının tamamı kanonik aktör/hedef, makam veya servis yetkisi, kariyer bedeli, temas/yetki alanı, cooldown ve alan yürütücüsü durumunu açıklıyor. İkna, müzakere ve ittifak gerçek kariyer harcaması, yönlü ilişki değişimi, çözülmüş EPISODE ve ittifakta kalıcı RELATIONSHIP mihenk taşı üretiyor. Emir, sabotaj, istifa ve ihanet alan-sahibi yürütücüsü gelmeden `DOMAIN_EXECUTOR_NOT_AVAILABLE` ile sıfır bedel/sıfır sahte sonuç veriyor. Defter save/load, eski kayıt backfill, özellik bağımlılığı, WorldV2, PlayerKnowledge gizliliği ve V3→V2 göçünden geçti; dört etkilenen hedefli regresyon temizdir. Faz 37, kalan dört fiziksel yürütücü, deterministik AI seçimi ve oynanabilir eylem yüzeyi tamamlanmadan kapanmaz.

**1.57 değişikliği:** Faz 37 ikinci dikey diliminde defter `story-character-action-ledger-3` oldu. İhanet gerçek iki yönlü güven/saygı/husumet değişimi, kalıcı BETRAYAL izi ve varsa önceki ittifakı `BROKEN` yapan kaynaklı makbuz üretir. On saniyelik scheduler görevi oyuncu karakterini dışlayan, etkin devlet/temas/kimlik hedeflerini tarayan, kişilik-hedef katkısını ilişki bağlamıyla puanlayan ve zayıf bağlamda pas geçen deterministik seçiciyi çalıştırır. İlk naif ayarlar 900 saniyede `85/86 ALLY`, cooldown sonrası aday `23/23 NEGOTIATE` üreterek reddedildi. Güncel bağlamsal politika 89 tikte `20` eylem, `69` pas, `17 ALLY + 3 PERSUADE`, sıfır oyuncu kontrolü ve geçerli defter verdi; baskın tür `%85` ile `%90` çöküş kapısının altında kaldı. 22,5+17,5 saniye checkpoint sonucu kesintisiz 40 saniyeyle birebir eşittir; sürüm-2 kayıt dört makbuzu kaybetmeden sürüm-3 politika karmasına göçer. Faz hâlâ `partial`: `ORDER/SABOTAGE/RESIGN`, oyuncu eylem yüzeyi ve tam 58-görev kabulü açıktır.

**1.58 değişikliği:** Faz 37'nin ilk oynanabilir yüzeyi şehir dosyasındaki doğrulanmış karakterden sohbet merkezine bağlandı. Panel yalnız gerçek yürütücüsü olan `PERSUADE/NEGOTIATE/ALLY/BETRAY` eylemlerini; kanonik bedel, mevcut oyuncu kariyer kaynağı, açık ret nedeni ve aktör/çift cooldown'ıyla gösterir. Serbest hedefli sohbet hazırmış gibi sunulmaz; açıkça Faz 38 borcu olarak ayrılır. JSDOM'da gerçek `DOMContentLoaded → delegated click` yolu Kaya Komutan üzerinde `PERSUADE`, `PLAYER_UI` makbuzu, `influence 50→48`, yönlü ilişki/hafıza sonucu ve tıklama sonrası “1,5 yıl sonra yeniden kullanılabilir” durumunu üretti. UI, AI aktör kimliği kabul etmez; yürütücü oyuncu aktörünü içeride yeniden çözer. Faz hâlâ `partial`: genel konuşulabilir karakter dizini, `ORDER/SABOTAGE/RESIGN`, tam rol merceği ve tam regresyon açıktır.

**1.59 değişikliği:** Faz 37'nin dördüncü diliminde ortak “hedef karakter” varsayımı ayrıştırıldı: emir `CHARACTER_AND_REGION_COMMAND`, sabotaj `CHARACTER_AND_WORLD_ASSET`, istifa `OWN_INSTITUTION` sözleşmesi taşır. `ORDER`, askerî muhatap + `MOBILIZE_RESERVE` + sahip olunan şehir hedefiyle Faz 33.1 yönetim zincirine gerçekten bağlandı. UI tıklaması 70 insan gücünü tek ekonomi defterinde rezerve edip `PENDING_APPROVAL` talebi üretti; kurum ve uygulama kapasitesi tamamlandığında talep `EXECUTED/APPLIED`, fiziksel sonuç `garrison +1` oldu. Karakter eylem makbuzu saha sonucunu erken iddia etmez; önce `QUEUED_DOMAIN_DECISION` ve kurum talep kimliğini saklar, gerçek sonuçta `DOMAIN_DECISION_RESOLVED` olur. Emir hafızası da kuyruğa girişte kapanmaz, yalnız domain sonucu geldikten sonra çözülür. Sabotaj artık gerçek altyapı koridoru, istifa gerçekten elde tutulan makam kimliği ister; operasyon/tespit ve haleflik sözleşmeleri olmadığı için ikisi bedelsiz reddedilir. Defter `story-character-action-ledger-4` oldu; beş makbuz save/load, v2→v4 ve WorldV2/PlayerKnowledge yolunda korundu; gerçek v3 sosyal makbuzlarına `CHARACTER` hedef modeli kayıpsız backfill edildi. Hedefli Faz 37, şehir UI ve Faz 33.1 yönetim regresyonları geçti. 900 saniye yeniden `89 tik / 20 eylem / 69 pas`, `17 ALLY + 3 PERSUADE`, sıfır oyuncu kontrolü ve aynı `70056c2d…6d4d36e5` karmasını verdi; tam paket henüz yeniden koşulmadı.

**1.60 değişikliği:** Faz 37'nin beşinci diliminde `SABOTAGE`, sahte anında hasar yerine 30 saniyelik `QUEUED_COVERT_OPERATION` makbuzuna bağlandı. Ajan 6 gerçek `capability` harcar; başarı, tespit ve fail atfı hedef devlet kapasitesi ile ajan yeteneğinden türeyen ayrı olasılıklar ve kayıt-devamda değişmeyen deterministik çekilişlerle çözülür. Başarılı hedefli koşu koridor hasarını `0→2588 bps`, etkin kapasiteyi `1020→756` yaptı. Operasyon tespit edilmediyse hedef sıfır bilgi görür; tespit edilip atfedilmediyse olayı fakat faili değil, ayrıca atfedildiyse faili görür. Gizli başarı/tespit oranları hiçbir hedef projeksiyonuna sızmaz. Operasyon ortası kayıt/devam domain sonucu, hafıza ve fiziksel hasarda kesintisiz koşuyla birebirdir. Defter `story-character-action-ledger-5` oldu; altı makbuz save/load, WorldV2, PlayerKnowledge ve v2/v3→v5 göçlerinde korundu. Hedefli Faz 37, şehir gizlilik/optimizasyon ve 900 saniye regresyonları geçti; sosyal AI dağılımı ve `70056c2d…6d4d36e5` karması değişmedi. Sabotajın oyuncu ajan yüzeyi, yabancı karakter konumunu sızdırmayan genel istihbarat/karakter çalışma alanına kadar açık borçtur.

**1.61 değişikliği:** Faz 37'nin altıncı diliminde `RESIGN`, makamı yalnız arayüzden silen bir kısa yol yerine kalıcı `OFFICE_SUCCESSION_RESOLVED` geçişine bağlandı. Halef aynı ülkenin kanonik karakter sicilinden makam türü, kariyer güvenilirliği/nüfuzu ve sabit kimlik sırasıyla deterministik seçilir. Kurum katmanı her uzlaştırmada aktif geçişi kaynak olarak okur; böylece kayıt/yükleme veya kurum tiki eski sahibini geri getirmez. Yönetim → Makamlar yüzeyi ilk tıklamada yalnız kalıcı sonuç uyarısı verir, ikinci tıklamada gerçek `PLAYER_UI` makbuzu üretir. Hedefli gerçek DOM koşusunda Silahlı Kuvvetler makamı `character:0:0` oyuncusundan `character:0:1 / Kaya Komutan`a geçti; eski aktör yetkiyi kaybetti, hafıza çözüldü ve kayıt/yükleme aynı halefi korudu. Defter `story-character-action-ledger-6` oldu; yedi eylemin tamamı gerçek yürütücüye, yedi makbuz WorldV2/PlayerKnowledge/save/load hattına bağlıdır. Aktif makam geçişinin kaynak makbuzu 2.048 kayıt budamasından korunur. Tam regresyon ve 900 saniyelik uzun koşu bu şema diliminden sonra henüz yeniden çalıştırılmadı; keşif güvenli ajan yüzeyi, genel karakter dizini ve tam rol merceği açık kalır.

**1.62 değişikliği:** Faz 37'nin yedinci dikey dilimi sohbet merkezine bilgi-sınıflı genel temas dizini ve yalnız ajan rolünde açılan gerçek sabotaj çalışma alanı ekledi. Varsayılan liste oyuncunun kendi/doğrudan temaslarıyla sınırlıdır; kamusal karakter sicili isteğe bağlı açılır. Yabancı ad, kamusal unvan ve ülke görülebilirken `regionId`, kariyer, servis ve gizli kimlik eksenleri taşınmaz. `PlayerKnowledge` sürüm-4, fiziksel kara/deniz topolojisini kapasite, hasar, erişim ve etkinlik durumu olmadan kamusal varlık olarak yayımlar. Ajan yüzeyi yalnız bu kamusal kara koridorlarından yabancı hedef üretir; gerçek DOM tıklaması 6 kapasite harcayıp 30 saniyelik `QUEUED_COVERT_OPERATION` makbuzu açtı. Aynı yüzey komutanda hiç oluşmadı. Hedefli prob `197` kamusal varlık, `21/175` dar temas/sicil, `14` kara operasyonu ve sıfır yabancı konum/gizli alan sızıntısı verdi. Şema-6 sonrası 900 saniyelik tam dünya koşusu `506.231,24 ms`de tamamlandı; `22` defter/tutarlılık doğrulamasında sıfır hata, `8/8` etkin devlet ve aynı `70056c2d…6d4d36e5` karma korundu. Tam regresyon paketi henüz yeniden çalıştırılmadı; Faz 59–60.3'e ait tam rol navigasyonu bu fazın eylem kabulüymüş gibi gösterilmeyecektir.

**1.63 değişikliği:** Faz 37 kabul kapısı kapandı. İlk altı-işçi paket `59/59` sonucu üretmesine rağmen ortak kaynak baskısında terrain+overlay cache `4.112,467 ms > 2.000 ms` verdi; eşik gevşetilmedi. Aynı raster probu tek işçide `618,339 ms`, geçerli raster, sıfır kara/deniz sızıntısı ve eşit A/B karmasıyla geçti. Üç-işçili tekrar assertion zincirini daha ileri taşıyıp Faz 37'de eklenen `character-actions` görevinin manuel beklenen scheduler sırasında unutulduğunu yakaladı; fikstür gerçek sürümlü sicille eşlendi ve `14 sn` karşı-testinde görev `1`, siyasi kriz `2` kez çalıştı. Nihai korunmuş üç-işçi paket `59/59` görevi `1.139,0 sn`de üretti, bütün `tests/story-world.test.js` assertion'ları çıkış kodu `0` ile geçti. Ana 900 saniye karması `70056c2dbc6cedc8eb2980f6a3a65101f1ef75ec8ed0c7a103531f5f6d4d36e5` kaldı. Faz 37 tamamlandı; Faz 38 açıldı. Harness kaynak listesi ve scheduler beklenen sıra listesinin hâlâ manuel tutulması, test–EXE ayrışması yaratmaması için otomatik sözleşme borcu olarak kaydedildi.

**1.64 değişikliği:** Faz 38'in ilk dikey dilimi `story-character-arbiter-1` kapalı-seçim sözleşmesini kurdu. Hakem Faz 37'nin doğrulanmış aday kümesini yeniden kullanır; LLM yeni eylem, hedef, sayı, bedel, olasılık veya dünya sonucu yazamaz. Sürümlü istek aktörün kanonik hedef/ses profili, en çok altı yakın hafıza, hedeflerle ilişki bağlamı ve en çok sekiz aday taşır; `regionId`, servis, altyapı hasarı/kapasitesi ve gizli operasyon olasılıkları prompt bağlamına girmez. Çıktı yalnız `PROPOSE/PASS`, sunulmuş aday kimliği ve enum konuşma planıdır. Uydurma aday, eylem/ hedef uyuşmazlığı, şema dışı `successChanceBps`, bozuk JSON ve özellik/öncül kapalı yollar deterministik fallback'e döndü; geçerli ve markdown çitli tek JSON kabul edildi. Aynı istek ve fallback birebir, hakem kurma/doğrulama öncesi-sonrası dünya karması eşittir. Worker probe `0,7 sn`de geçti. `characters.llmArbiter` açık/kapalı 60 saniye A/B aynı `066bde9f…5c69b` karmasını verdi. Yerel LLM adaptörü `llmEnrich` üzerinden yalnız doğrulanmış öneri üretir ve 32 bağlamlık önbellek taşır; bu dilimde gerçek 5 GB model kalite/latans ölçümü, önerinin scheduler/UI tüketimi, tekrar önleme ve konuşma gerçekleştirme henüz yoktur. Faz 38 `partial`dır.

**1.65 değişikliği:** Faz 38 gerçek paketli model kapısı `story-character-arbiter-3` ile ölçüldü. Eski serbest benchmark CUDA'da hızlı olmasına rağmen yeniden `0/5` verdi; bunun üzerine hakem çıktısı kanonik eylem/hedef tekrarından arındırılıp yalnız opak `Qxxxx` seçim koduna indirildi. `54` altı commit seçenekleri modelden önce kodda elendi; aday yoksa yalnız PASS mümkündür. `node-llama-cpp` JSON şema grameri istek bazında etkinleştirildi ve `requestId`, PROPOSE+sunulmuş seçim ile PASS+null çapraz alanları üretim anında sınırlandı; katı uygulama doğrulayıcısı son otorite kalır. Beş rolü kapsayan gerçek `1024` bağlam / `110` çıktı tokenı / `0,40` sıcaklık / CUDA kapısı `5/5` şema kabulü, `5/5` semantik eşik, sıfır fallback, sıfır üretim hatası ve `5/5` dünya nötrlüğü verdi. İlk token ortalaması `779,91 ms`, toplam `2.830,74 ms`; iki ayrı opak seçim kodu görüldü. Bu yalnız kapalı-seçim yeterliliğidir; canlı scheduler/UI tüketimi, kayıtlı konuşma durumu, doğal cümle gerçekleştirme ve tekrar önleme açık olduğundan Faz 38 hâlâ `partial`dır.

**1.66 değişikliği:** Faz 38 ikinci dikeyinin tam hikâye regresyonu üç işçiyle `60/60`, çıkış `0` ve `1.688,0 sn` toplam duvar süresinde geçti. Ana 900 saniyelik koşu `494.971,56 ms`, sekiz etkin devlet, `%80,23/%80,34/%72,24` gıda/enerji/yaşam ve değişmeyen `70056c2dbc6cedc8eb2980f6a3a65101f1ef75ec8ed0c7a103531f5f6d4d36e5` karması verdi. Eşzamanlı savaş AI CPU yükü süre kaynağı olarak kaydedildi; test kapsamı ve performans eşikleri değiştirilmedi. Gerçek-model ve tam regresyon borçları kapandı; canlı karar tüketimi, kayıtlı konuşma durumu, doğal cümle gerçekleştirme ve tekrar önleme açık kaldığı için Faz 38 kapanmadı.

**1.67 değişikliği:** Faz 38'in canlı tüketim dilimi hakemi Faz 37'nin sabit on saniyelik karakter tikine bağladı. İlk tik yalnız sürümlü istek açar; sonraki tik aynı `requestId/contextHash` ve adayları yeniden kurar. Yalnız aynı bağlama ait doğrulanmış PROPOSE/PASS tüketilir; gecikme, stale bağlam ve yüklemede kayıp geçici posta deterministik fallback olur. Dünya modeli beklemez, seçim yetki/bedel/hedef/cooldown kapısından yeniden geçer ve PASS sahte makbuz üretmez.

**1.68 değişikliği:** PASS, model kabulü, fallback ve stale sonuçları `512` tavanlı kalıcı hakem karar geçmişine alındı. Makbuzlar `arbiterDecisionId` ile karara bağlandı; her aktörün son altı kararı sonraki isteğe girdi. `520` kayıt fikstürü ilk `8` sırayı budadı, `9–520` ile sayaç ve save/load birebir kaldı. Gerçek paket kapısı karar geçmişli prompt ile `5/5` şema + `5/5` semantik, sıfır fallback/hata ve `593,07 / 2.447,50 ms` ortalama verdi.

**1.69 değişikliği:** Faz 38 kabul kapısı kapandı. Yeni `StoryCharacterSpeech.js`, hakemin enum konuşma planını serbest LLM metni kullanmadan kanonik eylem/PASS, ses profili ve son altı söz üzerinden kısa Türkçe cümleye dönüştürür. Eylem defteri `story-character-action-ledger-8` oldu; yeni karar cümlesi, normalize metin, template, istenen/uygulanan hitap, ton ve vurgu kanıtını saklar. Son altı sözde tam cümle tekrarına ve aynı hitabın üçüncü ardışık kullanımına izin verilmez. Yalnız hedefi oyuncu olan sözler sohbet ekranındaki `SANA SÖYLENENLER` bölümünde görünür; AI–AI özel sözü sızmaz. Sekiz oyuncu sözü + bir özel söz probu; determinizm, gizlilik, UI ve birebir save/load kapılarını geçti. Tam altı-işçi paket `61/61`, çıkış `0`, `558,4 sn`; ana 900 saniye `219.806,34 ms`, `8/8` etkin devlet ve değişmeyen `70056c2d…6d4d36e5` karması verdi. Son gerçek paket kapısı `5/5` şema + `5/5` semantik, sıfır fallback/hata, iki farklı seçim ve `524,74 / 2.340,98 ms` ilk-token/toplam ortalamasıyla geçti. Test manifesti ile assertion sonuç anahtarları artık simülasyon başlamadan otomatik eşleştirilir. Bu kapanış serbest oyuncu metnini veya uzun pazarlığı çözmüş sayılmaz; Faz 38.1 açıldı, daha zengin n-gram/anlamsal tekrar ve kör ses ayrımı Faz 38.2'de kalır.

**1.70 değişikliği:** Faz 38.1'in ilk deterministik dikeyi `story-conversation-understanding-1` sözleşmesiyle kuruldu. Serbest Türkçe girdi kapalı konuşma eylemi, birincil/ikincil niyet, ton, kamusal/oyuncuya ait/açık oturum bilgili varlık, doğrulanmamış konuşma iddiası, istek, çözülmemiş şart, risk, belirsizlik ve teyit sorularına ayrılır; `proposedCommand` bu dilimde daima `null`, `worldMutation` daima `false`tır. Referans çelik teklifinde İngiltere kamusal bölge sahipliği üzerinden `country:2` Britanya'ya bağlandı; fakat sekiz kaynaklı katalogda çelik bulunmadığı için sahte `industrial_parts/raw_materials` eşlemesi yapılmadı. Sevkiyat kimliği ve komutanın deposu uydurulmadı; şirket sahibinin gerçek şirketi çözülürken çoklu depolar tek depo gibi seçilmedi. Ham yabancı ticaret defterine gizli bakış yasaktır; yalnız açık `knownEntityIds` sevkiyat bağlayabilir. Bozuk günlük Türkçe, tehdit, soru, söz, sır ve açık blöf; boş/aşırı uzun/kod benzeri girdi; özellik/öncül kapısı, determinizm ve dünya nötrlüğü hedefli probda geçti. İlk bulanık çözümleyici `sipariş` içinden yanlış `Paris` çıkarıyordu; şehir eşleşmesi kelime/sonek sınırı ve asgari güvenle düzeltildi. İlk tam koşu gerçek UI'daki `Faz 38.1–38.5` borç metnine karşı bayat `Faz 38` assertion'ını yakaladı; yalnız beklenti güncellenip ilgili iki prob tekrarlandı. Nihai altı-işçi paket `62/62`, çıkış `0`, `1.061,5 sn`; ana 900 saniye `418.709,45 ms`, `8/8` etkin devlet, `%80,23/%80,34/%72,24` erişim ve değişmeyen `70056c2d…6d4d36e5` karması verdi. Bu yalnız analiz zarfıdır: gerçek teyit turu, diyalog oturumu, `NegotiationCase`, yetki/uygulanabilirlik denetimi ve UI Faz 38.1'in sonraki dilimleri ile Faz 38.3–38.5'e açıktır.

**1.71 değişikliği:** Faz 38.1'in ikinci dikeyi oyuncuyu salt veri okuyucusundan ilk kez serbest söz üreten katılımcıya taşıdı. Hedefli karakter ekranı gerçek textarea ve gönderme eylemi içerir; söz `story-conversation-session-ledger-1` içinde en çok 32 oturum/24 açıklama sınırıyla kaydolur. Çelik teklifindeki kaynak, gerçek depo, miktar, ödeme, teslim süresi ve ceza sırayla cevaplanabilir; sunulmayan kapalı seçenek reddedilir. Başta çözülmüş Britanya, bilinen sevkiyat, oyuncu şirketi ve sonradan seçilen depo birleşik mekanik inceleme adayında korunur. Buna karşılık sahiplik, şirket kaydı, makam yetkisi, kapasite ve doğrulanmamış sevkiyat iddiası oyuncunun sözüyle gerçek olmaz; taslak `READY_FOR_DOMAIN_REVIEW` durumunda dahi `executable=false/worldMutation=false` kalır. Oturum, sorular, cevap karmaları, birleşik aday ve budama teşhisi save/load'da birebirdir; özellik kapalı kayıt yolu `null` ile güvenli çalışır. UI aynı anda en çok sekiz depo seçeneği gösterir; gerçek bölge bağlamıyla daraltma Faz 38.5 borcudur. Hedefli konuşma (`1,4 sn`) ve şehir→karakter (`19,5 sn`) probları temizdir. Bağlı görsel tarayıcı bulunmadığı için gerçek piksel/yerleşim incelemesi yapılmadı; EXE görsel kapısı açık tutuldu. Eşzamanlı savaş AI yükü altında tam paket altı işçiyle `1.504,1 sn`, üç işçiyle `2.404,1 sn` sonunda sonuç üretmeden zaman aşımına uğradı; iki koşu da alt işçi bırakmadan kapandı. Bu nedenle bu dikey için tam `62/62` kabulü henüz yazılmadı.

**1.72 değişikliği:** Faz 38.1'in üçüncü dikeyi `story-conversation-session-ledger-2` ve `story-conversation-domain-review-1` sözleşmelerini kurdu. Dilsel açıklamalar bitince oyuncu sözü artık otomatik olarak iki taraflı sahiplik/temsil, muhatap müzakere yetkisi, şirket kaydı, depo kapasitesi ve icra makamı ön-incelemesine girer; sonuç yine `executable=false/worldMutation=false`tır. Muhatap iddiayı ham `tradeLogistics`, WorldV2 veya küresel gerçek tablosundan öğrenemez; yalnız kendi kaynaklı `ActorBelief` kayıtlarını okur. Karşı-testte gerçek ticaret defterine sevkiyat eklemek `ASK_EVIDENCE` cevabını değiştirmedi; aynı sevkiyat için muhataba doğrulanmış inanç verildiğinde sonuç deterministik `COUNTER_OFFER` oldu ve yeni şirket kaydı istendi. Mekanik cevap, kontrol satırları ve bilgi sınırı görüşme penceresinde saklanan oturumdan gösterilir. Aynı yeniden inceleme durumunda önceki `domainReviewId` ve engel listesi yeni karmaya geri beslenmez; kimlik kararlıdır. Hedefli prob dünya karması nötrlüğü, ActorBelief mahremiyeti, çalıştırılamaz aday, UI, geçerli defter ve iki oturumlu birebir kayıt/yüklemeyi geçti. Faz 38.1 henüz kapanmadı: kanıt sunma/karşı teklif turu ve kalıcı `NegotiationCase` sınırı sıradadır.

**1.73 değişikliği:** Faz 38.1'in dördüncü dikeyi `story-conversation-session-ledger-3` ile oyuncu cevabını gerçek yaşam döngüsüne aldı. `DOMAIN_REVIEW_NEEDS_EVIDENCE` durumunda yalnız oyuncunun sahip olduğu, kaynak olguya bağlı ve en az `%50` güven taşıyan `ActorBelief` kanıt seçeneği olabilir; sunulmayan kimlik `RESPONSE_NOT_OFFERED` ile reddedilir. Kanıt sunumu fiziksel dünyayı değiştirmez fakat muhatapta kaynak inanca geri bağlı, `PLAYER_PRESENTED_EVIDENCE` kaynaklı ve en fazla `%85` güvenli `REPORTED` inanç oluşturur. Bu bilgi olayı iddiayı kabul ettirip yeni şirket kaydı karşı teklifine geçirdi. Oyuncu UI'dan “mevcut şirketim üzerinden ilerle” tavizini kabul ettiğinde yeni şirket iddiası kaldırıldı ve oturum `READY_FOR_NEGOTIATION` oldu; şirket, ödeme, sözleşme veya sevkiyat yaratılmadı, aday `executable=false` kaldı. Kanıtı geri çekme, görüşmeyi bitirme ve şirket kuruluşunu bekleme kanonik seçenekleri de aynı sözleşmede tanımlıdır. Seçenekleri yalnız görüntülemek kalıcı defteri değiştirmez. Fiziksel devlet/şirket/banka/tesis/depo/ticaret karması tur boyunca eşit; UI, save/load ve şema-2→3 güvenli göç karşı-probu temizdir. Sıradaki sınır Faz 38.1 kapanış kanıtı ve ardından `NegotiationCase` yaşam döngüsüdür.

**1.74 kapanış denemesi:** Bellek-farkında üç işçiyle kapsamı azaltılmamış paket `62/62` görev sonucunu `3.139,0 sn`de temiz üretti; `conversationUnderstandingProbe` ortak yük altında `17,8 sn` sürdü ve bütün Faz 38.1 assertion'ları geçti. Nihai assertion aşamasını eski ekonomi koruması durdurdu: ana 900 saniyelik koşunun son 300 saniye yaşam koşulu ortalaması `%69,2809` ile `%70` kapısının `71,9 bp` altında kaldı; final `%70,69`, gıda/enerji son-300 ortalamaları `%78,19/%75,57`dir. İzole `first` koşusu `642,5 sn`de aynı sonucu ve `5fb256849330e5dc654e75126c5c4790168338cc23a2c5877d55d19a152d764a` karmasını yeniden üretti. Eşik gevşetilmedi. Faz 38.1 varsayılan dünya scheduler'ına görev eklemez ve hedefli fiziksel ekonomi nötrlüğü geçmiştir; eşzamanlı kullanıcı çalışması olan altı askerî bina/bağımlılık grafiği `Production.js` üzerinden şehir yatırım/üretim akışını değiştirmektedir. Bu değişiklik geri alınmadı veya Faz 38.1'e mal edilmedi. Bu nedenle Faz 38.1 hedefli teknik dikeyleri tamam, fakat küresel tam-regresyon kabulü açık ve faz durumu `partial` kalır.

**1.75 değişikliği:** Faz 38.5'in üçüncü dikeyinin ilk yarısı karakterin sonraki görüşmede gerçek karar ve söz sonucunu hatırlamasını kurdu. Kabul edilen siyasi kriz tavsiyesi, danışman ile oyuncunun tuttuğu çözülmüş `EPISODE` kaydına; kriz, konuşma oturumu, danışman cevabı, karar makbuzu, eylem sırası ve sonuç koduyla yazılır. Yeni ortak seçici yalnız çağrılan karakterin sahibi/katılımcısı olduğu `RECENT / EPISODE / MILESTONE` kayıtlarını okur; ham dünya defterine dönmez ve kaynak kimliklerini cevapta taşır. Kriz sorusu konuşma/karar kayıtlarını, söz sorusu Faz 38.3'ün gerçek `PROMISE` mihenk taşlarını seçer; borç veya ilgisiz yüksek öncelikli kayıt konu dışı cevabı ele geçiremez. Aynı gerçek müzakere vakasındaki yeni karşı teklif `KEPT`, son tarihi geçen mekanik onay sözü `BROKEN` oldu; muhatap sonraki ayrı görüşmede ikisini kaynak kimlikleri ve uzun ufuk durumlarıyla birlikte hatırladı. Oturum defteri şema-6'ya yükseldi. Hedefli probda kısa/orta/uzun katman, gizlilik, doğrulama ve byte-byte save/load geçti (`5,5 sn`); gerçek test işçisi `4,5 sn`de tamamlandı. Söz sonuçlarının ekonomik/diplomatik kriz ve savaş/barış adaylarını farklılaştırması hâlâ açıktır. Bina sistemi dosyalarına dokunulmadı.

**1.76 değişikliği:** Oyuncunun bildirdiği takip konuşması regresyonu kapatıldı. “Bana yardım edecek misin?” artık UNKNOWN/genel fallback değil kapalı `REQUEST_SUPPORT` niyetidir. İlk ve takip turları aynı karakter ses gerçekleştiricisini ve son 12 yanıt geçmişini kullanır; aynı yardım cümlesinin ikinci tekrarı farklı geçerli yanıt üretir. “Seni dinliyorum” kalıbı canlı kaynaklardan tamamen kaldırıldı. Aynı dilimde söz sonucu için yürütülemez fakat sürümlü sonraki-adım adayları eklendi: `KEPT → COOPERATIVE_FOLLOW_UP / CONTINUE_NEGOTIATION / FORMALIZE_MECHANICAL_CONTRACT`, `BROKEN → COMMERCIAL_DISPUTE / REQUEST_CURE / SUSPEND_NEGOTIATION`; taraflar ülkeler arasıysa yalnız `DIPLOMATIC_PROTEST_REVIEW` açılır. Ticari ihlal kendiliğinden savaş nedeni yapılmaz; `warCandidate` ve `peaceCandidate` diplomatik olay yürütücüsü gelene kadar `null`, bütün adaylar `worldMutation:false/executable:false`tır. Hedefli prob sosyal tekrar, söz hafızası, iki farklı aday, idempotans ve müzakere doğrulamasını geçti.

**1.77 değişikliği:** Faz 38.5 konuşma UI'si gerçek Electron compositor görüntüsüyle yeniden düzenlendi. 1440 px tavanlı çalışma alanında profil/geçmiş rayları daraltıldı, merkez konuşma sütunu ölçümde `875 px` oldu; uzun oturum kendi içinde kayarken takip bestecisi altta sürekli erişilebilir kaldı. Dev “Yeni konuşma” ve “Devam et” eylemleri kompaktlaştırıldı, takip metin alanı koyu terminal yüzeyine alındı. Gerçek UI zinciri `menu → kurulum → karakter → dünya → dolu görüşme` sorunsuz geçti; kabuk ve besteci viewport/merkez sınırları içindeydi. Aynı dilimde `DIPLOMATIC_INCIDENT_REVIEW` gerçek söz+çözüm olayı+iki yönlü karakter ilişkisi+devlet antlaşması+kurum savaş rotasını kaynaklı dosyaya topladı. Sınır aşan BROKEN söz protesto için `AWAITING_STATE_AUTHORITY` üretir; fakat kanonik ekonomik zarar ölçülmediyse zarar eşiği `0 < 250` kalır ve savaş/barış adayı üretilemez. İnceleme ilişki veya antlaşmayı değiştirmez ve idempotenttir. Hedefli konuşma probu temizdir. Devlet makamının protestoyu gerçekten yürütmesi ve doğrulanmış zarar muhasebesi hâlâ açıktır.

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

**2 Ağustos 2026 ortak kaynak admission planı — salt-okunur sözleşme geçti, canlı aday reddedildi:** `story-production-admission-plan-1`, ülke-Pareto öncülerinden yalnız `IMMEDIATE` ve `SURVIVAL/CHAIN_RECOVERY` adaylarını kabul eder. Aynı karar penceresinde kaynak fiziksel stoğu, sahipli lot, hedefin karşılanmamış talebi ve bütün rota koridorları sanal olarak rezerve edilir; ülke başına en fazla `3`, bacak başına en fazla `1` birim ve mevcut kaynak kotaları aşılmaz. Mevcutsa bir zincir-kurtarma ve bir doğrudan-ihtiyaç yuvası ağırlıklı skordan önce ayrılır. Plan sipariş, sevkiyat, stok veya defter yazmaz; harness çağrı öncesi/sonrası dünya karmasını karşılaştırır.

Tohum `2032`, `300 sn` settlement görünümünde `107` fırsattan `43` uygun ülke öncüsü bulundu; `12` çatışmasız sevkiyat (`6` enerji, `6` sanayi parçası; `8` ülke; toplam `8,141335`) seçildi. Stok, sahiplik, hedef talep ve koridor doğrulamasında sıfır ihlal, iki zorunlu politika yuvasında tam temsil ve gözlemci tarafsızlığında aynı dünya karması elde edildi. Varsayılan 900 saniyelik tam test de değişmeden `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36` verdi.

Bu doğru admission planı tek başına doğru canlı politika değildir. Dördüncü canlı seçici adayı, planı 16 saniyelik pencerelerde eski üretim-girdisi seçicisinin yerine koydu. `60 sn`de bütün defterler geçti ve süre farkı yaklaşık `%4` kaldı; fakat `300 sn` sonucu referans `%60,73/%72,52/%64,26`dan `%34,55/%30,54/%49,45`e, tamamlanan ekonomik sonuç `18→10`a düştü. Planın birim başına marjinal kanıtı doğru olsa da `≤1` birimlik sevkiyatlar eski seçicinin yüksek hacimli boru hattını ikame edemedi; toplam enerji teslimi `18.155→9.437`, sanayi parçası teslimi `2.451→424` oldu. Özellik bayrağı ve canlı commit adaptörü tamamen geri alındı. Sıradaki aday Pareto admission’ı hacim planından ayırmayacak: her seçimin `kaç çevrim/pencere` fiziksel hacim taşıdığı, legacy yüksek hacimli akışın hangi kısmını koruduğu ve toplam kaynak teslim tabanı karar sözleşmesinde açıkça bulunacak. Salt-okunur admission planı bu hacim seçicisinin güvenlik katmanı olarak kalır.

**2 Ağustos 2026 dört-pencere hacmi + legacy tabanı — uzun dönem başarılı aday, faz henüz kapanmadı:** Admission bacağındaki sabit `≤1` birim sınırı kaldırıldı. Her hedefin mevcut reçete blokajı, bekleyen kargo düşüldükten sonra dört üretim pencerelik fiziksel hacme çevriliyor; bir tam pencereyi bile karşılayamayan kaynak kabul edilmiyor. `300 sn` salt-okunur planda aynı `12` hedef artık `74,26534` birim (`65,7` enerji + `8,56534` parça), ortalama tam `4` pencere taşıyor ve ortak stok/lot/talep/koridor doğrulaması geçiyor.

Canlı davranış `economy.paretoVolumeAdmission` ile varsayılan kapalıdır. Legacy üretim-girdisi seçicisi ve normal otomatik dengeleme önce eksiksiz çalışır; Pareto hacim adayı yalnız kalan kapasite/stok üzerinde ve yalnız `SURVIVAL` şeridinde ek sevkiyat yapar. Böylece çalışan yüksek hacimli boru hattından seçim çalmaz. `300 sn` sonuç `%60,73/%72,52/%64,26→%68,27/%74,89/%65,80`, tamamlanan ekonomik sonuç `18→23`; `900 sn` final `%63,94/%68,41/%65,52→%64,35/%71,04/%66,56`, tamamlanan sonuç `48→60` oldu. Son `600–900 sn` örnek ortalaması `%56,22/%63,61/%62,72→%64,08/%70,00/%65,48`; sekiz doğrulayıcı geçti, `2.150` ek sevkiyatta sıfır hata görüldü ve yoldaki enerji `1.345→1.185` düştü. Enerji ek kotasını `6→8` büyütmek 300 sn enerji erişimini `%69,89`a düşürdüğü için geri alındı. Aday kalıcı olarak tutulur fakat yaşam koşulu `%70` uzun dönem kapısına ulaşmadığından bayrak açılmaz, Faz 22.1E kabul edilmez ve Faz 25 başlatılmaz. Kalan kök sorun artık üretim girdisi değil, üretilmiş gıdanın hane/bölge erişimine dönüşümüdür.

**2 Ağustos 2026 hane dağıtımı kabulü — Faz 22.1E tamamlandı:** `economy.saleSettlement`, `economy.paretoVolumeAdmission` ve yeni hane dağıtım kabulü varsayılan canlı yola alındı. Hane erişimi soyut bonusla yükseltilmedi: önceki gerçek tahsis açığı dört dağıtım penceresine çevriliyor; yalnız ülke içindeki sahipli lot, gerçek stok, açık sipariş/kargo ve ortak rota kapasitesi üzerinden ayrı sipariş, manifesto, lot ve teslim fişi üretiliyor. Kaynak veya koridor yoksa sevkiyat yapılmıyor; stok, ödeme, mülkiyet ya da teslimat defteri atlanmıyor.

Sabit tohum `2032` ile `60 sn` sonucu gıda `%89,94`, enerji `%85,16`, yaşam koşulu `%75,69`; `300 sn` sonucu `%79,56/%83,42/%71,48`; `900 sn` finali `%76,55/%77,56/%70,82`; `600–900 sn` ortalaması `%79,54/%79,31/%71,24` oldu. Sekiz fiziksel/mali defter doğrulayıcısı geçti; `10.712` ek hane sevkiyatında sıfır admission/dispatch hatası görüldü. İki bağımsız 900 saniyelik koşu aynı sonucu üretti. Tam `npm test` çıkış kodu `0`, varsayılan dünya karması `9dd9f7fce2324704249cbf7e4235a526d569ae5f7dd295ff939b3a3305ae4719`; ana 900 saniyelik koşunun raporlanan duvar süresi `176.175,18 ms` oldu. İşlevsel ve denge kapıları geçtiği için Faz 22.1E kapatıldı ve Faz 25 açıldı. Talep/kaynak başına yinelenen rota çözümü belirgin performans borcudur; sonuç veya örnek sayısı azaltılarak gizlenmeyecek, ayrı profilleme ve önbellek kabulüyle çözülecektir.

Önceki enerji tanı kapısı tam regresyona bağlanmıştı: ülke fiziksel enerji toplamı, ülke sahipli-lot enerji toplamı ve dünya enerji toplamı tolerans içinde eşit olmak; blokaj sayacı bölge kimlikli listeyle birebir kapanmak zorundaydı. O aşamadaki tam `npm test`, varsayılan-kapalı 900 saniyelik `230bc647481ba13e9431a92f890def5fab0a36f1510c530256874f038a64ef36` karmasını yeniden üretmişti. Bu tarihsel sonuç yalnız tanının güvenilirliğini ve o günkü kapalı yolun değişmediğini kanıtlıyordu; güncel Faz 22.1E kabul sonucu yukarıdaki `9dd9f7fc…4719` kaydıdır.

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

**Uygulama durumu (3 Ağustos 2026):** Tamamlandı. `js/StoryOpinion.js`, `story-public-opinion-memory-1` sözleşmesiyle 1.824 kohortun gıda, enerji, gelir, istihdam, güvenlik ve kamu hizmeti baskısını ayrı hafıza kayıtlarına çeviriyor. Sorumluluk hayali bir etiket değildir: gıda ve enerji gerçek sektör şirketine, kamu/güvenlik kanalları gerçek ülke yönetimine, gelir uygun olduğunda gerçek işverene bağlanır; UI bunun kanıtlanmış kusur değil “sorumlu görülen aktör” olduğunu açıkça söyler. Hedefli kabulte ilk kriz tepkiyi `2.183` baz puana çıkardı, dört iyileşme tikiyle `1.762`ye indi, aynı kriz dönüşünde `3.457`ye yükseldi ve ikinci bölüm olarak sayıldı; tam unutma `63` iyileşme tiki sürdü. Katman Faz 24 defterini, eski refahı ve fraksiyonları değiştirmiyor; protesto/grev sonucu üretmiyor. Kayıt/yükleme birebir, eski kayıt boş ve açıklamalı backfill, bozuk kayıt dünya korunarak güvenli sıfırlama, fetih sonrası ülke bağlantısı ve V3→V2 göçü geçti. Kendi bölgesi `VERIFIED / OWN_SOCIAL_RESEARCH`, yabancı bölge `UNKNOWN/null`; şehir nüfus ekranı biriken şikâyeti, etkilenen insanı ve algılanan sorumluyu gösteriyor. 900 saniyelik kabulte 7.696 kayıt (`5.642 ACTIVE`, `2.054 RECOVERING`), 1.093 yüksek şiddetli ve 228 doygun kohort görüldü; ağırlıklı ortalama `7.124` baz puan. Kohort başına 12 kayıt tavanı ve kompakt `COMPACT_RECORD_ARRAY_V1` depolaması sınırsız büyümeyi engelliyor; kayıt `1.725.815` karakterdir. Fiziksel gıda/enerji/yaşam sonuçları `%76,55/%77,56/%70,82` kaldı, karma `b813d8a7…a664`, tam `npm test` çıkış kodu `0`. `qa-runtime/story-phase25-ab.json` kapalı `9af31ad5…fdf5`, açık `b813d8a7…a664` karmasını ve eski refah/enflasyon/huzursuzluk/devlet/kaynak deltalarının sıfır olduğunu kalıcı olarak kaydeder. Bu yüksek şikâyet düzeyi hata değildir ama ciddi siyasi basınçtır; davranışa dönüşümü Faz 26'nın işidir.

### FAZ 26 — Protesto, Grev ve Radikalleşme

**Amaç:** Şikâyeti aşamalı kolektif eyleme çevirmek.  
**Çıktı:** Barışçıl protesto, grev, ayaklanma ve örgütlenme eşikleri.  
**Kabul kapısı:** Eylemler sebepsiz rastgele çıkmıyor; bastırma ve taviz farklı uzun vadeli sonuç veriyor.  
**Bağımlılık:** Faz 25.

**Uygulama durumu (3 Ağustos 2026):** Tamamlandı. `js/StoryCollectiveAction.js`, `story-collective-action-ledger-1` sözleşmesiyle Faz 25 kayıtlarını ülke-sorun-sorumlu aktör temelinde sınırlı hareketlere topluyor. Karar zinciri anlık şiddetle sınırlı değil; etkilenen insan/pay, aktif kohort yayılımı, tekrar, sorun süresi, örgütlenme vekili, mobilizasyon, radikalleşme, bastırma hafızası ve taviz güvenini birlikte kullanıyor. Protesto `6.200` mobilizasyon / `6.000` şiddet ve üç tik kapısıyla; yalnız gelir veya istihdam sorunu olan grev `7.300` mobilizasyon / `5.200` örgütlenme / dört tik kapısıyla açılır. Ayaklanma `9.300` mobilizasyon, `9.000` radikalleşme, tekrar ve sekiz tik ister; kronik kriz tek başına otomatik ayaklanma üretmez. Histerezis ve cooldown tek eşik çevresinde aç-kapa titreşimini önler. Oyuncu taviz, müzakere, bastırma veya görmezden gelme cevabı verebilir; AI aynı doğrulanmış durumdan hilesiz seçim yapar. Bastırma kısa vadede eylemi dağıtır fakat radikalleşme/bastırma hafızasını büyütür; ağır hedefli probda protesto 11., grev 16. tikte açıldı ve ikinci bastırmadan sonra ayaklanma 55. tikte oluştu. Protesto üretim cezası değildir. Grev yalnız ilgili bölge ve gerçek iş gücü sorununda üretimi `%65`e; ayaklanma `%30`a indirir. Bu etkiler ülke geneline kopyalanmaz ve aynı şok eski `st.welfare`/fraksiyon huzursuzluğuna yeniden yazılmaz. Dünya/V2, kayıt/yükleme, V3→V2 göç, eski/bozuk kayıt kurtarma, sahiplik uzlaştırma, oyuncu bilgi filtresi, şehir dosyası ve süreli cevap bildirimi geçti; yabancı bölgede yalnız kamusal eylem görünür, gizli mobilizasyon/radikalleşme sızmaz. 900 saniyelik tam koşu 56 hareket, 5 aktif protesto, 0 grev, 0 ayaklanma ve 22 sınırlı olay üretti; bu nadir dalların eksikliği değil, normal dünyanın zorla isyana sürüklenmediğinin kanıtıdır. Fiziksel `%76,55/%77,56/%70,82`, ortalama refah `65,375`, enflasyon `2,255`, huzursuzluk `3,285`; karma `7a42d4d6e955f996be269880c9691acdaf33ee1ebc5476872a4df119e2554b14`, politika `fnv1a32:bd78ac61`, tam `npm test` çıkış kodu `0`. `qa-runtime/story-phase26-ab.json` kapalı `ebd87ca1…83bde`, açık `7a42d4d6…4b14` karmasını, ilk farkın yalnız `$.collectiveAction` olduğunu ve eski makro/kaynak deltalarının sıfır kaldığını kaydeder. Faz 28 gelene kadar örgütlenme açıkça `COHORT_NETWORK_PROXY_PRE_PHASE_28` vekilidir; gerçek sendika/güç merkezi değildir.

### FAZ 27 — Göç ve Mülteci Akışı

**Amaç:** Savaş, işsizlik ve güvenlik farklarının bölgesel nüfusu değiştirmesi.  
**Çıktı:** İç/dış göç, hedef seçimi, kapasite ve entegrasyon baskısı.  
**Kabul kapısı:** Nüfus korunuyor; ulaşılamayan bölgeye göç ışınlanmıyor.  
**Bağımlılık:** Faz 14, 24, 26.

**Uygulama durumu (4 Ağustos 2026):** Tamamlandı. `js/StoryHumanMigration.js`, sürümlü `story-human-migration-ledger-1` defterinde ekonomik iç/dış göçü ve güvenlik/ayaklanma kaynaklı mülteci akışını ayrı tür ve neden kodlarıyla tutuyor. Kaynak sinyali Faz 24 yaşam koşulu, güvenlik ve işsizlik riskiyle Faz 26 yerel eylem aşamasından; hedef kalitesi yine kanıtlı yaşam/güvenlik/kamu hizmeti sonucundan türetiliyor. Seçici rastgele veya LLM kararı kullanmıyor. Her aday gerçek `StoryInfrastructure` kara/deniz rotası, iki ülke yetkisi, üçüncü ülke transiti yasağı, darboğaz kapasitesi, seyahat gecikmesi ve kabul kapasitesinden geçiyor. Normal akış anında ışınlanmıyor; kaynak nüfus idari olarak varışa kadar kaynakta, tamamlanınca `storyPopulationTransferCohorts` ile aynı profil anahtarlarında tam tamsayı kişi olarak atomik taşınıyor. Düğüm nüfusu, ülke toplamı, ihtiyaç ve kamuoyu bağlantıları aynı save zincirinde doğrulanıyor.

Hedefli probda `region:0 → region:6` aktarımı tam `17` kişiyle kaynak `-17`, hedef `+17`, dünya farkı `0` verdi. Ağır güvenlik krizinde `region:0 → region:106` rotasında 90 kişilik `REFUGEE` akışı üretildi; beş koridorlu gerçek rota kullanıldı, hedef kapasitesi doluyken `BLOCKED / RECEPTION_CAPACITY` oldu ve kapasite açılınca `COMPLETED / populationDelta:0` ile sonuçlandı. Bütün kara/deniz koridorları kesildiğinde izole kaynaktan akış üretilmedi. Bozuk kohort toplamı, negatif/ondalıklı kapasite, bilinmeyen koridor, geçersiz sıra ve yinelenen profil kayıtları reddediliyor. Eski kayıtta geçmiş uydurulmuyor; boş ve açıklamalı backfill yapılıyor. Save/load ve V3→V2 ülke/bölge projeksiyonu birebir geçti. Oyuncu kendi rotasını/kohortunu/kapasitesini görür; yabancı görünüm yalnız kamusal tamamlanan sayıları gösterir ve gizli rota/kanıt/kapasite sızdırmaz.

Nihai 900 saniyelik kabul koşusu `231` akış (`46` etkin, `167` tamamlanan, `18` iptal), `3.955` taşınan kişi (`1.706` sınır ötesi, `2.249` iç göç) ve `256` tavanlı olay üretti. Normal barış dünyası yapay mülteci üretmedi; zorlanmış kriz nadir dalı ayrıca kanıtladı. Sekiz devlet ayakta kaldı; gıda/enerji/yaşam `%85,13/%85,36/%73,33`, ortalama refah `65,375`, enflasyon `2,255`, huzursuzluk `3,09`; karma `880b861ba56e9954cf5c319db5ce96835c606205e4c7d5af08157dc4a5c33cb6`, politika karması `fnv1a32:9dcb0ad3`. Faz 27 açık/kapalı A/B’de refah/enflasyon/devlet sayısı değişmedi; huzursuzluk `-0,195`, petrol `-1.430`, manpower `-2.375`, puan `-1.135,0121` oldu. Bu maliyetler göçün sonraki talep, lojistik ve toplum dallarını gerçekten değiştirdiğini gösterir; “bedava iyilik” değildir.

Kapsam sınırı dürüstçe açıktır: kabul kapasitesi gerçek konut varlığı değil sabit altyapı+nüfus vekilidir; sınır/vize/iltica politikası yoktur; göç ticaret sevkiyatlarıyla aynı koridor kapasite rezervasyonunu tüketmez; üçüncü ülke transit anlaşması yoktur. Bunlar mevcut sistemin varmış gibi gösterilecek özellikleri değil, Faz 28–33 kurum/güç merkezi ve sonraki varlık/politika entegrasyon borçlarıdır. Tam `npm test`, monolitik 46-problu jsdom tezgâhı için 8 GB Node test heap’iyle `1.410,9 sn`de çıkış kodu `0` verdi; bu oyun RAM gereksinimi değildir. Tezgâhın faz süreçlerine bölünmesi açık QA altyapı borcudur.

---

## DALGA F — Siyaset ve Kurumlar

### FAZ 28 — Güç Merkezleri

**Amaç:** Mevcut fraksiyonları gerçek kapasite ve çıkar taşıyan aktörlere dönüştürmek.  
**Çıktı:** Ordu, iş dünyası, sendikalar, bürokrasi, medya, güvenlik ve radikal ağlar.  
**Kabul kapısı:** Her merkezin kaynak, amaç, lider, destek tabanı ve eylem sınırı bulunuyor.  
**Bağımlılık:** Faz 21, 23.

**Uygulama durumu (5 Ağustos 2026):** Tamamlandı. `js/StoryPowerCenters.js`, `story-power-center-ledger-1` sözleşmesiyle sekiz devlet × yedi tür = 56 kalıcı merkez üretir. Destek, kayıtlı üyelik diye uydurulmaz; kanonik nüfus kohortlarının meslek, gelir, eğitim ve yaş profillerinden türetilen `WEIGHTED_CANONICAL_COHORTS` destek tabanıdır. İş dünyası nakdi ve rezervi gerçek şirket/banka defterine, kamu idaresi bütçesi gerçek devlet bütçesine, askerî kapasite gerçek komutan/garnizon/birlik varlığına bağlıdır. Her merkez üç amaç, lider/ofis, örgütlenme, etki, hizalanma, bağımsızlık, kaynak kanıtı ve kapasite taşır.

Faz 26'nın eski `COHORT_NETWORK_PROXY_PRE_PHASE_28` hareketleri kimlikli merkez kimliklerine göç eder. İlk denemede merkez örgütlenmesini eski tabanın yerine doğrudan koymak 900 saniyelik gıda/enerji/yaşamı `%85,13/%85,36/%73,33→%74,40/%76,08/%69,62` bandına düşürdü; kolektif eylemin kendi çıktısını radikal merkez girdisine geri vermesi de pozitif döngüydü. Bu aday reddedildi. Nihai sözleşme eski nötr davranış tabanını korur; problem türüne göre `4.700/5.450/3.100` kurumsal referans, `1.200` baz puan ölü bölge ve ölü bölge dışındaki sapmaya `%25` ağırlık uygular. Kolektif eylem çıktısı merkez örgütlenmesine doğrudan geri beslenmez.

Faz 28 merkez varlığıdır, kurum yetkisi değildir. `DECLARED_LIMITS_PRE_PHASE_29` altında bildirilen eylemler görünür ama `executableActionTypes: []`, `maximumConcurrentActions: 0` ve `blockedUntilPhase: 29` ile icra kapalıdır. Ordu ve iş dünyası gerçek kanonik aktöre bağlanır; diğer beş lider `OFFICEHOLDER_PROXY_PRE_PHASE_34`, medya kapasitesi `...PRE_PHASE_39`, güvenlik kapasitesi `...PRE_PHASE_47` olarak açıkça etiketlidir. LLM sayı, lider, amaç, kapasite veya karar üretmez.

WorldV2, V3→V2 göçü, kayıt/yükleme, eski/bozuk kayıt kurtarma, scheduler, özellik/prerequisite kapalı yolları ve şehir `KURUMLAR` görünümü tamamlandı. Oyuncu kendi merkezinin tam kapasitesini görür; yabancı merkezde yalnız kamusal kimlik/lider/amaç görünür ve destek, kaynak, örgütlenme, etki veya aktör kimliği sızmaz. Toprak devrinde ülke/bölge özetleri kayıt öncesi kanonik sahiplikten yeniden türetilir; bu uzlaştırma simülasyon zamanını veya merkez puanlarını ilerletmez.

`qa-runtime/story-phase28-ab.json` aynı tohumlu 900 saniyelik kontrol `f9ce09a769f9696d80c09192fbcb3bf7e620f23936026e0f521512bcdd6c4bfc` ve açık `52bd56c280cf9c2a22a0fb2698c49b059b5ab92a8d5cc86f6c83243dd8c6607a` karmalarını saklar. Refah, enflasyon, huzursuzluk, devlet/haber sayısı ve üç eski kaynak deltasının tamamı `0`; açık yol 56 etkin merkez ve 26 olay üretir. Final gıda `%85,13`, enerji `%85,36`, yaşam `%73,33`; bütün güç merkezi ve kolektif eylem doğrulayıcıları geçerlidir. Tam `npm test` çıkış kodu `0`, toplam duvar süresi `1.645 sn`, ana 900 saniyelik simülasyon süresi `132.280,69 ms`dir. Monolitik test süresi açık QA altyapı borcudur, oyun çalışma zamanı ölçüsü değildir.

### FAZ 29 — Rejim ve Kurum Şeması

**Amaç:** Kararların kimin yetkisinde olduğunu belirlemek.  
**Çıktı:** Yürütme, yasama, yargı, ordu ve yerel idare yetkileri.  
**Kabul kapısı:** Oyuncu/AI yetkisiz eylemi doğrudan uygulayamıyor.  
**Bağımlılık:** Faz 28.

**Uygulama durumu (5 Ağustos 2026):** Tamamlandı. `js/StoryInstitutions.js`, `story-institution-authority-ledger-1` sözleşmesiyle sekiz devletin her birinde yürütme, yasama, yargı, silahlı kuvvetler komutası ve yerel idare olmak üzere toplam `40` kanonik kurum kurar. Mevcut `st.constitution` etiketi beş rejim profiline çevrilir: parlamenter denge, yürütme ağırlıklı otokrasi, liberal demokrasi, askerî yönetim ve meclis yönetimi. Kurumlar fiziksel gücü veya meşruiyeti uydurmaz; yalnız 29 eylem türü için başvuru, onay ve yürütme yetkisini sürümlü yasal rotaya bağlar.

Karar zinciri `DIRECT / JOINT / PETITION / PROHIBITED / EXTERNAL_DOMAIN` ayrımını korur. Başvuru hakkı ile onay hakkı aynı değildir. Kurum içi ortak karar `JOINT`, güç merkezinden kuruma talep `PETITION` olur; merkezin kendi bildirim/koordinasyon eylemi ikinci bir sahte makam imzası istemez. Zorunlu kurumların tamamı onay vermeden istek `AUTHORIZED` olamaz ve yalnız kayıtlı yürütücü `EXECUTED` durumuna geçirebilir. Sahte aktör kimliği `ACTOR_SOURCE_MISMATCH`, yasal rotasız eylem `NO_LAWFUL_ROUTE`, yabancı yerel yetki alanı `TARGET_OUTSIDE_JURISDICTION` ile reddedildi. LLM, istemci payload'ı, fraksiyon puanı veya rastgele zar makam/yetki üretemez.

Makam imzası ülke bazındadır. Bir başka devletin rejim değişimi oyuncunun bekleyen dilekçesini bozmaz; aynı ülkenin anayasası, doğrulanmış makam sahibi veya yerel yetki alanı değişirse tamamlanmamış istek `STALE_AUTHORITY` olur. Sadakat gibi akışkan kişilik değeri makam kimliğine katılmaz. Bu ayrım hedefli probda yabancı değişim sonrası `PENDING_APPROVAL`, kendi değişimi sonrası `STALE_AUTHORITY` olarak kanıtlandı.

Faz 28'in kilitli eylem bildirimi canlı anayasal sınıra göç etti: her güç merkezi için eylemler doğrudan, onaya bağlı veya yasak kümelerine ayrılır. WorldV2 kurumları 40 tekil varlık, ülke yetki görünümü ve bölgesel yerel idare olarak taşır. Oyuncu kendi ülkesinde makam sahibi, yetki grant'leri, karar rotaları ve bekleyen onayları görür; yabancı ülkede yalnız kamusal rejim, makam adı ve kamusal yetki alanı görünür. Şehir `KURUMLAR` sekmesi anayasal düzeni gösterirken ekonomi/fraksiyon görünümü güç merkezlerini ayrı mercek olarak korur.

Kayıt/yükleme ve UI saflığı iki ayrı regresyon yakaladı. İlk yükleme sırası kolektif hareket defterini güç merkezi kimlikleri kurulmadan açarak Faz 26'nın birebir devam kapısını bozuyordu; kesin sıra `komutan → kurum → güç merkezi → kolektif hareket → göç` olarak düzeltildi. İkinci hata WorldV2/UI okumasının gecikmiş rejim uzlaştırmasını çalıştırıp dünya karmasını değiştirmesiydi; bütün kurum görünüm API'leri salt-okunur yapıldı, uzlaştırma yalnız scheduler/kayıt kapısında kaldı. Hedefli projeksiyon önce/sonra `44af8086…4224` karmasını birebir korudu.

`qa-runtime/story-phase29-ab.json`, aynı tohumlu 900 saniyede kapalı `a32befd176c0aba3c8def9eab9e3fdf22f244483ae8c5140b5b70afad5b41a45` ve açık `4a7b34ade1039f0f44ce00fa2f82a59ab9677af92709a92016525d4f361323a0` karmalarını saklar. İlk fark yalnız `$.institutions`, sonraki farklar güç merkezi eylem sınırlarıdır; refah, enflasyon, huzursuzluk, devlet/haber sayısı ve petrol/insan gücü/puan deltalarının tamamı `0`dır. Açık dünya `40` kurum, `179` kurum tiki ve normal koşuda `1` rejim/makam uzlaştırma olayı taşır. Final gıda `%85,13`, enerji `%85,36`, yaşam `%73,33`; sekiz devlet hayattadır. Tam `npm test` çıkış kodu `0`, toplam duvar süresi `1.734,8 sn`, ana 900 saniyelik koşu `134.268,9 ms`dir.

Kapsam sınırı açıktır: `AUTHORIZATION_RECORD_ONLY_PHASE_29` kararın fiziksel sonucunu uygulamaz. Bürokratik gecikme, kapasite, yolsuzluk, bölgesel sızıntı ve kararın kâğıtta kalması Faz 30'un; seçimle makam değişimi Faz 31'in; ideolojik politika üretimi Faz 32'nin sahibidir. Faz 29 bunları varmış gibi simüle etmez, fakat sonraki katmanların aşamayacağı tek yetki kapısını sağlar.

### FAZ 30 — Meşruiyet ve Devlet Kapasitesi

**Amaç:** Kâğıt üzerindeki karar ile uygulanabilen karar arasındaki farkı kurmak.  
**Çıktı:** Meşruiyet, bürokratik kapasite, yolsuzluk ve bölgesel denetim.  
**Kabul kapısı:** Düşük kapasiteli devletin kararı gecikiyor/sızdırılıyor; sonuç açıklanabiliyor.  
**Bağımlılık:** Faz 29.

**Kapanış — 5 Ağustos 2026:** `js/StoryStateCapacity.js`, Faz 29'un yetkilendirme kaydı ile gerçek alan etkisi arasına sürümlü ve deterministik bir uygulama defteri koydu. Ülke düzeyinde meşruiyet, bürokratik kapasite, hukuk devleti, kurumsal bütünlük, yapısal yolsuzluk riski ve birleşik uygulama kapasitesi; 152 bölge düzeyinde idari erişim, denetim, güvenlik, kamu hizmeti, altyapı erişimi, garnizon ve kuşatma sinyali tutulur. Altyapı erişimi her tikte tek harita geçişiyle hesaplanır; bölge × koridor karesel taraması yapılmaz.

Karar zinciri `QUEUED → IMPLEMENTING → COMPLETED/DEGRADED/PAPER_ONLY` durumlarıyla çalışır. Yalnız gerçek kurumsal önerici/yürütücüye ve aynı ülke/bölge yetki alanına sahip Faz 29 `EXECUTED` kayıtları bilet doğurur; özel güç merkezi eylemi kendiliğinden devlet uygulaması sayılmaz. Bilet, değişmez yetki makbuzunu kopyalar; eylem karmaşıklığı sabit süre ve asgari kapasite ister. Düşük kapasite kararı başlatamaz ve son tarihte kâğıt üzerinde bırakır; yeterli bürokrasi ile zayıf bütünlük/sızıntı tamamlanmayı düşürür; sağlıklı zincir tamamlanır. Sonuç gerekçeleri, kalite ve sızıntı oranı kaydedilir.

Faz sınırı özellikle korunmuştur: `CAPACITY_IMPLEMENTATION_RECORD_ONLY_PHASE_30` fiziksel mutasyon yapmaz. `physicalMutation: false` zorunludur; ekonomi, refah, kaynak, toprak veya kurum alanına doğrudan yazılmaz. Bu defter “uygulanabilir sonuç fişi” üretir; ilgili sonraki domain ancak açık tüketici sözleşmesiyle `effectReady` sonucunu işler. Yapısal yolsuzluk riski fail, rüşvet veya suç kanıtı değildir; kişi, ihale, soruşturma ve skandal Faz 32'nin sahibidir.

Bilgi sınırı oyuncunun kendi devletinde kapasite kaynakları ve biletleri doğrulanmış gösterir; yabancı devlet için yalnız kamusal meşruiyet ve bölgesel denetim görünür. Yabancı bürokrasi, bütünlük, yolsuzluk riski, kaynaklar ve uygulama biletleri sızmaz. WorldV2, şehir dosyası, kaydet/yükle, V3→V2 göç, eski kayıt backfill'i, bozuk defter kurtarma ve özellik/öncül kapalı `null` yolu doğrulandı; görünüm çağrıları dünya karmasını değiştirmedi.

Hedefli kabul probunda sağlıklı karar `COMPLETED` (`implementationCapacityBps: 6223`), çökmüş devlet kararı `PAPER_ONLY` (`231`, `IMPLEMENTATION_DEADLINE_EXCEEDED + CAPACITY_BELOW_REQUIREMENT`), zayıf bütünlüklü fakat çalışan bürokrasi kararı `DEGRADED` (`qualityBps: 4999`, `leakageBps: 5590`) oldu. 900 saniyelik doğal koşu sahte karar üretmedi: sekiz ülke ve 152 bölge ölçüldü, doğal bilet sayısı `0`. Kontrol `8f99c8f0…8d21`, açık yol `6ab5c579…fd50`; refah, enflasyon, huzursuzluk, etkin devlet, haber, petrol, insan gücü ve puan deltalarının tamamı `0`. Tam regresyon `1.947,9 sn`de çıkış kodu `0` ile geçti; scheduler 22 görev içinde devlet kapasitesini toplumdan sonra, kuşatmadan önce her 5 saniyede çalıştırıyor. Faz 31 açıldı.

### FAZ 31 — Seçim ve İktidar Değişimi

**Amaç:** Oy, koalisyon, kampanya ve barışçıl devir süreçleri.  
**Çıktı:** Seçmen tercihleri, adaylar, katılım, sonuç ve itiraz.  
**Kabul kapısı:** Sonuç kohortlar ve gerçek olaylarla açıklanıyor; tek rastgele zar değil.  
**Bağımlılık:** Faz 25, 28–30.

**Kapanış — 5 Ağustos 2026:** Bu faz tamamlandı. Her ülke için seçim modeli, takvim, kampanya, tam kişi tahsisli kohort oyları, koalisyon, dar sonuç itirazı, sertifika, mandat ve barışçıl yürütme devri aynı sürümlü defterde tutulur. Sonuç tek rastgele zar veya LLM kararı değildir; RNG ve LLM seçim hakemi değildir. Dünya/oyuncu bilgisi/şehir `KURUMLAR` görünümü kendi ülkenin doğrulanmış ayrıntısını, yabancı ülkenin yalnız kamusal sonucunu taşır; kohort pusulası, puan bileşenleri, kaynak tikleri ve etki eğilimleri sızmaz. Projeksiyon salt-okunur; kayıt/yükleme birebir, kesintisiz-kayıttan devam sonucu aynı, V3→V2 göçü, eski kayıt backfill'i, bozuk kayıt kurtarma ve özellik/öncül kapalı `null` yolu geçmiştir.

Kapsam sınırı açıktır: `MANDATE_RECORD_ONLY_PHASE_31` sonucu fiziksel ekonomi, kaynak, refah, toprak veya politika mutasyonu yapmaz. Aday “insanları” Faz 34 gelmeden uydurulmaz; dört siyasi liste, ülke yönelimi ve seçilmiş makam için açık vekildir. Kampanya medyası/dezenformasyon Faz 39'un, gerçek karakter hedefi ve sesi Faz 34–38'in, patronaj/ihale/soruşturma Faz 32'nin, askerî haleflik ve darbe Faz 33'ün sahibidir.

Hedefli prob `16` seçim kaydı, `8` sertifika, `8` devir, `2.862.026` seçmen ve `2.022.822` kullanılan oyu tam kohort toplamıyla kapattı; iki farklı kazanan liste ve sekiz koalisyon üretti. İtiraz kuralı `150 bp + hukuk 3000 → evet`, `500 bp + hukuk 3000 → hayır`, `150 bp + hukuk 7000 → hayır` verdi. 900 saniyelik A/B açık koşusu `24` kayıt, `11` sertifika, `19` mandat ve `11` devir üretti; sekiz eski makro/kaynak deltası sıfırdır. Scheduler `23` görev taşır ve seçimleri toplum/devlet kapasitesinden sonra, kuşatmadan önce her `5 sn` çalıştırır. Tam regresyon `1.867,8 sn`, ana koşu `143.630,69 ms`, karma `f7cfa97e39511a10a6bdd691d29eedeb9abd67f4c1be8a8992d3da065e8230d1` ile geçti.

### FAZ 32 — Patronaj, Yolsuzluk ve Soruşturma

**Amaç:** Kısa vadeli güç ile uzun vadeli kurum erozyonu arasında tercih yaratmak.  
**Çıktı:** Atama, ihale, rüşvet, sızıntı, soruşturma ve skandal.  
**Kabul kapısı:** Suçlama otomatik gerçek sayılmıyor; kanıt, medya ve kurum kapasitesi etkili.  
**Bağımlılık:** Faz 21, 29–30.

**Kapanış — 6 Ağustos 2026:** Bu faz tamamlandı. `story-integrity-investigation-ledger-1`, gerçek kurum yetkisi, bütçe işlemi, kanonik şirket/karakter ve kaynaklı kanıt olmadan suç veya soruşturma uydurmaz. Temiz ihale dosya açmaz; kırmızı bayrak yalnız ön incelemedir; resmî soruşturma aynı ülkenin yürütülmüş ve başka dosyada kullanılmamış yargı fişini ister. Deterministik destek/rebuttal/neutral kanıt hesabı yalnız eşiği geçen dosyaya `SUBSTANTIATED`, diğer resmî incelemeye `UNSUBSTANTIATED` der. RNG ve LLM hüküm vermez; sonuç `INTEGRITY_FINDING_RECORD_ONLY_PHASE_32` ve `physicalMutation:false` kalır.

WorldV2 ülke özeti ile `integrityCases/integrityEvidence` koleksiyonlarını taşır. PlayerKnowledge ve şehir `KURUMLAR` görünümü kendi ülkenin kaynaklı kanıtı ile yabancı ülkenin yalnız kamusal soruşturma/kararını ayırır; gizli özne, yararlanan şirket, kırmızı bayrak, skor ve kaynak kimliği sızmaz. Kayıt/yükleme birebir, V3→V2 göç, eski kayıt backfill'i, bozuk defter kurtarma, özellik/öncül kapalı yokluk ve salt-okunurluk kapıları geçmiştir.

Hedefli prob rekabetçi piyasa ihalesinde `0` dosya; tek teklif + `%50` fiyat sapmasında `4271 bp → UNSUBSTANTIATED`; gerçek rüşvet fişinde `6321 bp → SUBSTANTIATED` verdi. `qa-runtime/story-phase32-ab.json` açık/kapalı `900 sn` fiziksel karmayı aynı `dd4ea4786ddfdc10b26ed949213a2c2bddadc5782f1b2aa5b7d104ab0081f42c`, ilk farkı boş ve bütün makro/kaynak deltalarını sıfır kaydetti. Scheduler `24` görevdir. Tam regresyon `52/52`, `1.664,7 sn`, ana koşu `118.958,65 ms`, çıkış kodu `0` ile geçti. Sıradaki faz **Faz 33 — Darbe, Bölünme ve İç Çatışma**dır.

### FAZ 33 — Darbe, Bölünme ve İç Çatışma

**Amaç:** Devlet çöküşünü tek eşikli rastgele olay olmaktan çıkarmak.  
**Çıktı:** Hazırlık, koalisyon, sadakat, karşı hamle, başarısızlık ve bölgesel kontrol.  
**Kabul kapısı:** Darbenin aktör, kaynak ve hazırlık zinciri olay defterinde görülebiliyor.  
**Bağımlılık:** Faz 26, 28–32.

**Kapanış — 7 Ağustos 2026:** Faz tamamlandı. `story-political-crisis-ledger-1`, en az iki gerçek sadakatsiz komutan ve yapısal risk bulunmadan kriz açmaz; hazırlık, koalisyon, karşı-güç, istihbarat, bölgesel kontrol ve kullanılan kaynakları aynı sürümlü defterde taşır. Teşebbüs sonucu gerçek komutan sadakati/yetenekleri, toplum, refah, devlet kapasitesi, güç merkezleri, seçim mandatı ve bütünlük dosyalarından deterministik hesaplanır. `randomOutcome:false` ve `llmOutcome:false` doğrulanır; yabancı toprak sonucu uydurulmaz.

Oyuncu isimli komplo lideriyle görüşebilir, isimli sadık komutanla komuta zincirini güvenceye alabilir, kamuya açıklama yapabilir veya bekleyebilir. Dört yolun tamamı gerçek puan/itibar ya da karşı tarafın kazandığı hazırlık bedelini ve kaynak fişini üretir. AI aynı eylem kapısını kullanır, hile kaynağı almaz ve kriz başına bir kararla sınırlıdır. Gündem krizi isimli karakterle Talk ekranına taşır; henüz uygulanmamış genel hedefli karakter sohbeti ise varmış gibi davranmaz.

WorldV2, oyuncu bilgi filtresi, kayıt/yükleme, V3→V2 göç, eski/bozuk kayıt kurtarma, özellik/öncül kapalı yollar ve salt-okunur projeksiyon geçti. `qa-runtime/story-phase33-ab.json` kontrol `d6ec566b…31bc`, açık `34ef8ff9…d838`; doğal 900 saniyede `7` kriz, `3` başarısız teşebbüs, `4` dağılma, `5` eylem, `43` olay, refah `-0,75`, enflasyon/huzursuzluk `0` fark üretti. Hedefli aynı-durum probu deterministik `SUCCESS / GOVERNMENT_SEIZED` sonucunu da doğruladı. Scheduler `25` görevdir; tam regresyon `54/54`, `487,4 sn`, ana koşu `190.852,31 ms`, çıkış kodu `0` ile geçti. Sıradaki faz **Faz 33.1 — Yönetim Çalışma Alanı İlk Oynanabilir Sürüm**dür.

### FAZ 33.1 — Yönetim Çalışma Alanı İlk Oynanabilir Sürüm

**Amaç:** Kurum, makam, güç merkezi ve karar gündemini tek yönetim bağlamında oynanabilir yapmak.  
**Çıktı:** Gündem, kabine/kurum, yetki, güç merkezleri, bekleyen onaylar ve sözler için ilk gerçek view-model/UI.  
**Kabul kapısı:** Komutan ve cumhurbaşkanı aynı yönetim ekranında farklı yetki/eylem görür; kilitli eylem alternatif erişim yolunu açıklar.  
**Bağımlılık:** Faz 10.1, 28–33.

**Kapanış — 7 Ağustos 2026:** Faz tamamlandı. `js/StoryGovernance.js`, oyuncunun kanonik karakterini Faz 29 makamlarıyla eşleştirir; yürütme ve silahlı kuvvetler için farklı eylem sunar, sahip olunmayan makamı taklit ettirmez ve kilitli kararın erişim yolunu açıklar. `120` bütçe puanlı kamu yatırımı ile `70` insan gücü maliyetli yerel seferberlik; gerçek kurum onay/yürütme zincirinden, Faz 30 kapasite fişinden ve idempotent nedensellik kapısından geçmeden fiziksel sonuç üretemez. İlk sonuç şehir seviyesini, ikincisi garnizonu kanonik alanda değiştirir; kâğıtta kalan uygulama harcamayı ve başarısızlığı saklamaz. Yönetim UI rol, kapasite, hedef, maliyet, onay, makam ve güç merkezini birleştirir; henüz var olmayan karakter söz hafızasını uydurmaz. `55/55` tam regresyon, kayıt/yükleme ve özellik-kapalı yol geçti; oyuncu kararı yokken Faz 33 dünya karması değişmedi. Sıradaki faz **Faz 34 — Karakter Kimliği ve Hedefleri**dir.

---

## DALGA G — Karakterler ve Hafıza

### FAZ 34 — Karakter Kimliği ve Hedefleri

**Amaç:** Karakterleri yalnızca üç yetenek puanından çıkarmak.  
**Çıktı:** Kişilik eksenleri, değerler, korkular, hırslar, kırmızı çizgiler, ses profili, görev ve kişisel hedefler; oyuncu için role uyarlanır 12 bedelli karar ve nedensel geçmiş tohumu.
**Kabul kapısı:** Aynı durumda farklı profiller ölçülebilir biçimde farklı adaylara ve farklı konuşma stratejilerine yöneliyor; hiçbir profil yetkili eylemi sırf ideolojik etiket yüzünden yasaklamıyor; her karakter yaratım seçimi gerçek kazanç, bedel, en geç 10 dakika içinde görünür ilk sonuç ve kanonik olay/inanç kaydı üretiyor.
**Bağımlılık:** Faz 4, 29.

Faz 34’ün dört kararlı çekirdek boyutu `stateMarketOrientation`, `nationalGlobalOrientation`, `popularTechnocraticStyle` ve `institutionalPosture` olur. `muhalif/yandaş` kişilik değildir; mevcut hükümet, ideolojik mesafe, patronaj, ilişki ve olay geçmişinden türetilen `currentRegimeAlignment` alanıdır. Şahinlik, özgürlük/otorite ve benzeri konu tutumları geniş değer modelinde ayrıca tutulur. Rol bazlı soru metni ve görünür etiket değişebilir, saklanan alanın semantiği değişemez.

**Tamamlanma — 8 Ağustos 2026:** `js/StoryCharacters.js`, başkan ve komutanları `story-character-identity-ledger-2` defterine göç ettirdi. Dört kararlı çekirdek boyut; değerler, korkular, hırslar, kırmızı çizgiler, rol/kişisel hedef ve ses profili kanonik kimlikte tutulur. `currentRegimeAlignment` kalıcı kişilik değil, rol–sadakat–kurumsal mesafeden türetilen görünümdür. Profil hiçbir yetkili seçeneği elemez. Faz 31’in siyasi liste vekilleri isimli aday karakterlerine göç etti. Altı rol için sürümlü 12-soru dağılımı kodlandı. Mekanik kazanç+bedel iç sözleşmede kalır; 1.48 kararıyla seçimden önce oyuncuya gösterilmez. Cevap kanonik olay, gerçek mekanik delta, `WorldFact`, kaynaklı `ActorBelief`, tepki kancası ve `0 sn` ilk görünür sonuç üretir. Hedefli prob `12` karar/olgu/olay, `31` inanç, yabancı sızıntısı `0`, birebir kayıt/yükleme ve V3→V2 göçte `12/31` korunum verdi; tam `56/56` regresyon `819,6 sn`de geçti.

On iki kararın kanıt alanı rol bazında dağıtılır: komutan `6/3/3`, şirket sahibi `2/6/4`, belediye başkanı `1/7/4`, cumhurbaşkanı/başbakan `3/4/5`, ajan `2/3/7`, sivil `1/5/6` (`güvenlik / yönetim-ekonomi / siyaset-toplum-bilgi`). Bu dağılım sürümlü içerik politikasıdır ve telemetriyle değişebilir; toplam her zaman 12, her seçenek kazanç+bedel taşır. Geçmiş tohumu `legacy` metniyle sınırlı kalmaz: tarihli olay, `WorldFact`, bilen aktörlerde kaynaklı `ActorBelief`, ilişki/kurum etkisi ve gelecekteki tepki kancası aynı `originEventId` altında yazılır.

### FAZ 35 — Çok Boyutlu İlişkiler

**Amaç:** Tek dostluk sayısı yerine güven, korku, saygı, borç ve husumet tutmak.  
**Çıktı:** Yönlü karakter ilişki grafı, geniş askerî/siyasi/şirket/istihbarat oyuncu dışı kadrosu, gerçek kurum/şirket/servis bağları ve olay etkileri.
**Kabul kapısı:** İki karakter birbirini farklı biçimde değerlendirebiliyor; rol seçimi gerçek bir dünya aktörüne bağlanıyor ve seçilmeyen makamı oyuncuya vermiyor.
**Bağımlılık:** Faz 34.

**Kapanış — 8 Ağustos 2026:** `js/StoryRelationships.js`, `trustBps/fearBps/respectBps/debtBps/hostilityBps` alanlarıyla yönlü ve seyrek ilişki grafı kurar. Dünya `8` yürütme, `80` askerî, `24` siyasi, `48` şirket ve `16` istihbarat aktörüyle `176` kimliğe; tam N² yerine `627` anlamlı kenara sahiptir. A→B/B→A asimetrisi, 12 köken kararından `21` gözlemci→oyuncu bağına etki, WorldV2, bilgi filtresi, göç ve birebir kayıt/yükleme geçti. Oynanabilir başlangıç ağacı askerî komutan, şirket sahibi, siyasi lider ve ajan köklerinden açılır; her kök kendi 12 ikilemini, kariyer kaynaklarını ve gerçek kurumsal bağını kullanır. Şirket sahibi probunda oyuncu `company:0:civil_industry` siciline bağlı kalırken yürütme `character:0:president`, silahlı kuvvetler `character:0:6` tarafından tutuldu. Başlangıç rolü ile kampanya içinde kazanılan makam ayrıldı; siyasi lider başlangıçta yürütmeyi alır, diğer roller makamı ancak gerçek dünya durumu değişirse kazanır. Tam `56/56` regresyon savaş AI CPU yükü altında `2.185,4 sn`de çıkış kodu `0` verdi; ana dünya karması `145d5775…b3b72` korundu. Faz 35 tamamlandı.

### FAZ 36 — Üç Katmanlı Hafıza

**Amaç:** Üç dakikalık savaş ve uzun kampanya için doğru bağlamı korumak.  
**Çıktı:** Yakın olaylar, konuşma bölümleri, ortak gerçekler, sırlar, sözler, dönem özetleri ve silinmeyen mihenk taşları.  
**Kabul kapısı:** Kayıt/yükleme sonrası önemli ihanet, sır, borç, söz ve çözülmemiş konuşma konusu unutulmuyor; gereksiz olaylar bağlamı şişirmiyor.  
**Bağımlılık:** Faz 9, 34–35.

**İlk dikey dilim — 8 Ağustos 2026:** `js/StoryMemory.js`, yakın bağlamı aktör başına `24` kayıtta tutar; taşan düşük öncelikli kayıtları en çok `12` deterministik dönem özetine yoğunlaştırır. Çözülmemiş konuşma konusu EPISODE olarak save/load'da yaşar; ORIGIN, PROMISE, SECRET, BETRAYAL ve DEBT mihenk taşları yakın bağlam budamasından etkilenmez. Köken verisi yalnız kanonik WorldFact/ActorBelief'ten backfill edilir; eski kayda söz, sır veya ihanet uydurulmaz. `Talks.js` gerçek konuşma kuyruğu EPISODE kimliğini runtime kaydında taşır, yanıt ve süre dolumu bölümü çözer; gerçek söz seçeneği PROMISE üretir. Hedefli kapılar `12` köken mihenk taşı, `31` kaynaklı yakın kayıt, `24` tavan, iki yönlü sır gizliliği, V3→V2 ve birebir save/load verdi. Scheduler devam karması birebir kaldı. Kapanış için siyasi kriz ile gerçek SECRET/BETRAYAL/DEBT üreticilerinin bağlanması, dönem özet politikası ve uzun kampanya şişme testi zorunludur.

**Kapanış adayı — 9 Ağustos 2026:** Açık içerik borçları kodlandı. Siyasi krizin açılış/karşı hamle/sonuç zinciri EPISODE ve BETRAYAL'a; siyasi ödeme bütçe makbuzu + yönlü ilişki değişimi üzerinden DEBT'e; yüksek güvenli özel bütünlük kanıtı kanonik iç-istihbarat sahibinde SECRET'a bağlandı. PROMISE aynı aktör ve konu için yoğunlaştırılır. Üretici tavanlarına ek olarak defterin açık/çözülmüş bölüm, mihenk taşı ve toplam serileştirme bütçeleri doğrulanır. 900 saniyelik gerçek soak `84.578/4.000.000` karakter bütçesiyle geçti. Altı etkilenen sınır probu temizdir; fakat CPU-ağır haricî oracle ile eşzamanlı tam `57` görev koşusu hiç sonuç dosyası üretmeden süreç zaman aşımına uğradığından faz resmen kapanmış sayılmayacaktır. CPU uygunken aynı değişmez test paketi yeniden geçmeden Faz 37 kabulü başlatılmaz.

**Kapanış — 9 Ağustos 2026:** CPU-ağır oracle tamamlandıktan sonra 57 görevlik değişmez paket tekrarlandı ve tüm sonuçlar üretildi. Paralel raster süresi yük altında eşiği aştığı için eşik değiştirilmedi; tek işçili aynı prob `573,204 ms` ile geçti, veri/doğrulama/A-B karmaları paralel sonuçla aynı kaldı. Korunmuş tam sette bütün assertion'lar geçti. Faz 36 tamamlandı; sıradaki uygulama **Faz 37 — Karakter Eylem Adayları**dır.

Tam regresyon 57 görev sonucunun tamamını üretti. İlk denetim kimlik öncülü kapalıyken Talks.js aktör çözümleyicisindeki null erişimini yakaladı; hedefli karşı-test artık hafıza `null` ve konuşma kuyruğu `1` verir. Son denetimde yalnız eşzamanlı yük altındaki raster duvar süresi `3.365,171 ms` ile değişmez `2.000 ms` kapısını aştı. Eşik değiştirilmedi; tekil aynı prob `631,22 ms` verdi ve korunmuş 57 sonuçla bütün assertion seti çıkış kodu `0` üretti. Ana karma `145d5775…b3b72` kaldı. Bu teknik kabul ilk dilimi doğrular, fakat fazın açık içerik/soak borçlarını kapatmaz.

### FAZ 37 — Karakter Eylem Adayları

**Amaç:** Karakterlerin dünyaya yalnızca konuşmayla değil geçerli eylemlerle etki etmesi.  
**Çıktı:** İkna, pazarlık, emir, sabotaj, ittifak, istifa ve ihanet aday üreticileri.  
**Kabul kapısı:** Her eylemin yetki, maliyet, hedef ve bekleme süresi doğrulanıyor.  
**Bağımlılık:** Faz 29, 34–36.

**Uygulama durumu — kabul tamamlandı, 9 Ağustos 2026:** `implemented`. Yedi adayın tamamı gerçek yürütücü taşır: dört sosyal eylem, kurum/kapasite zincirine bağlı emir, süreli gizli sabotaj ve kalıcı makam devri üreten istifa. `ORDER` hedef garnizonu `+1`; `SABOTAGE` hedefli koşuda `0→2588 bps` hasar ve `1020→756` etkin kapasite verdi. `RESIGN`, Yönetim → Makamlar içindeki iki aşamalı gerçek DOM tıklamasıyla oyuncu Silahlı Kuvvetler makamını `character:0:1 / Kaya Komutan`a devretti; eski aktör yetkiyi kaybetti ve kayıt/yükleme halefi korudu. Defter sürüm-6'da yedi makbuz, bir aktif makam geçişi ve çözülmüş yedi karakter eylemi hafızası geçerlidir; v2→v6 yedi, gerçek v3→v6 dört sosyal makbuzu kayıpsız taşır. Sabotajın tespit/atıf gizliliği ve operasyon ortası checkpoint eşitliği korunur. Genel temas dizini kendi/doğrudan temasları öne alır, kamusal sicili isteğe bağlı açar ve yabancı konum/kariyer/servis bilgisini saklar. Ajan rolü yalnız kamusal fiziksel kara topolojisinden gerçek sabotaj hedefi görür; komutan aynı operasyon yüzeyini görmez. Hedefli gerçek DOM probu `197` kamusal varlık, `14` güvenli kara operasyonu ve sıfır gizli alan sızıntısıyla geçti. Şema-6 sonrası 900 saniyelik koşu `506.231,24 ms`, `22/22` geçerli doğrulama, `8/8` etkin devlet ve `70056c2d…6d4d36e5` karma verdi. Nihai üç-işçi kabul paketi `59/59`, `1.139,0 sn`, assertion çıkışı `0` verdi. Faz 59–60.3'e ait tam rol navigasyonu ayrı borçtur; Faz 38 açılmıştır.

### FAZ 38 — LLM Karakter Hakemi

**Amaç:** A-seviye karakterlerde bağlamsal ve şaşırtıcı ama geçerli seçimler ile karaktere özgü konuşma üretmek.  
**Çıktı:** Sürümlü JSON sözleşmesi, serbest oyuncu metni ayrıştırıcısı, konuşma durumu, ses profili, tekrar önleyici, bağlam derleyici, doğrulayıcı, karar-planı önbelleği ve yedek AI.  
**Kabul kapısı:** Bozuk/kapalı model koşusunda davranış devam ediyor; LLM şema dışına çıkamıyor; karakter son konuşmaları, sözleri ve oyuncuya hitap biçimini hatırlıyor; yakın dönem aynı cümle/hitap spam’i üretmiyor.  
**Bağımlılık:** Faz 3.1, 36–37.

**Uygulama durumu — ikinci dikey dilim, 9 Ağustos 2026:** `partial`. `js/StoryCharacterArbiter.js`, Faz 37'nin kanonik adaylarından yalnız `54` ve üstü commit kanıtı taşıyan en çok sekizini aktör kimliği, hedefleri, ses profili, yönlü ilişki ve altı yakın hafızayla sürümlü isteğe dönüştürür. Model adayın kanonik kimliğini, eylemini veya hedefini tekrar yazamaz; yalnız aday kimliğinden türeyen sıra çağrışımsız `Qxxxx` kodunu `PROPOSE` edebilir ya da `PASS` diyebilir. Kod bu seçimi kanonik eylem/hedefe geri çözer. İstek bazlı JSON şema grameri `requestId`, enum konuşma planı ve PROPOSE/PASS çapraz alanlarını üretim sırasında sınırlar; katı doğrulayıcı yine son kapıdır. Model yok, bozuk veya şema dışıysa deterministik fallback çalışır. Bağlamda yabancı konum/servis/hasar/kapasite/olasılık sızıntısı ve dünya mutasyonu sıfırdır; worker `0,7 sn`, açık/kapalı 60 saniye karması `066bde9f…5c69b`dır. Paketli `4.920.733.952` bayt Türkçe 8B model, EXE ile eşit `1024` bağlam, `110` token, `0,40` sıcaklık ve CUDA ayarında beş rolün `5/5` şema ve `5/5` semantik kapısını geçti; fallback/hata sıfır, ilk token `779,91 ms`, toplam `2.830,74 ms`dir. Tam hikâye regresyonu üç işçide `60/60`, çıkış `0`, `1.688,0 sn` ve değişmeyen `70056c2d…6d4d36e5` karmasıyla geçti. Bu sonuç serbest sohbet yeterliliği değildir. Planın canlı karakter akışınca tüketimi, kayıt/yükleme, doğal cümle gerçekleştirme ve tekrar önleme açık olduğundan faz kapanmamıştır.

**Uygulama durumu — üçüncü dikey dilim, 9 Ağustos 2026:** Faz 37'nin on saniyelik karakter scheduler'ı ile duvar-saatli model üretimi iki aşamalı canlı sözleşmeyle bağlandı. İlk sabit tik yalnız sürüm-1 `pendingArbiter` zarfını açar; asenkron sonuç kanonik dünyaya yazamaz. Tam bir sonraki karakter tikinde aktör adayları, `requestId` ve `contextHash` yeniden üretilir. Yalnız aynı bağlama ait `LOCAL_LLM_VALIDATED` PROPOSE/PASS sonucu tüketilir; geciken, yüklemede geçici posta kutusu kaybolan, bozuk veya bağlamı değişen istek deterministik Faz 37 seçicisine düşer. Model sonucu tekrar yetki, hedef, bedel ve cooldown doğrulamasından geçer. Yerel model makbuzu seçim kodu, neden enum'u ve konuşma planını taşır; PASS sahte eylem makbuzu üretmez. Eylem defteri sürüm-7; model/fallback/stale/restore sayaçları ve iki AI karar kaynağı budama-doğrulama mutabakatına dahildir. Yarım istek save/load'da kimlik ve bağlam karmasını korur, fakat duvar-saatli üretim yeniden oynatılmaz. Paketli model hikâye karakter sistemi ilk ihtiyaç duyduğunda arka planda bir kez ısıtılır; açılış ve simülasyon beklemez. Geçerli seçim, PASS, yetişmeyen model, değişmiş bağlam ve yarım kayıt hedefli probları temizdir. Gerçek-model kapısı eşzamanlı yük altında yine `5/5` şema + `5/5` semantik, sıfır fallback/hata verdi; ilk token `1.449,36 ms`, toplam `4.374,88 ms`. Kapsamı azaltılmamış regresyon `60/60`, çıkış `0`, `841,3 sn`; ana 900 saniye `461.424,16 ms`, sekiz etkin devlet ve değişmeyen `70056c2d…6d4d36e5` karmasıyla geçti. Doğal cümle gerçekleştirme, hitap/cümle tekrar defteri ve serbest oyuncu metni hâlâ açık olduğundan Faz 38 kapanmamıştır.

**Uygulama durumu — dördüncü dikey dilim, 9 Ağustos 2026:** Mekanik eylem üretmeyen PASS dahil her hakem sonucu sürüm-1 karar kaydına dönüştürüldü. Kayıt; istek/bağlam karması, aktör, PROPOSE/PASS, model/fallback/stale durumu, aday/eylem/hedef, neden enum'u, fallback nedeni ve konuşma planını taşır. Makbuz üreten model/fallback kararları `arbiterDecisionId` ile bu kanıta bağlanır; PASS sahte eylem üretmeden aynı defterde yaşar. Her aktörün son altı kararı sonraki hakem bağlamına girer; böylece yeni dünya kanıtı yokken aynı düşük değerli seçimi seri tekrar etmeme talimatı gerçek geçmişe dayanır. Defter `512` canlı kayıtta sınırlıdır; `520` kayıt probunda ilk `8` sıra budandı, `9–520` korundu, budama sayacı ve save/load birebir geçti. Geçerli seçim/PASS/gecikme/stale/restore ile Faz 37 göç probları temizdir. Güncel gerçek-model kapısı `5/5` şema + `5/5` semantik, sıfır fallback/hata, `593,07 ms` ilk token ve `2.447,50 ms` toplam süre verdi. Kapsamı azaltılmamış son regresyon `60/60`, çıkış `0`, `846,0 sn`; ana koşu `461.121,19 ms`, sekiz etkin devlet ve değişmeyen `70056c2d…6d4d36e5` karmasıyla geçti. Bu karar geçmişi henüz oyuncuya gösterilen doğal cümle veya konuşma bölümü değildir; Faz 38 kapanışı için cümle/hitap gerçekleştirme ve tekrar denetimi hâlâ zorunludur.

**Uygulama durumu — kabul tamamlandı, 9 Ağustos 2026:** `implemented`. `StoryCharacterSpeech.js`, kabul edilmiş hakem kararını özgür metin üretimine geri vermeden eylem/PASS çekirdeği, karakter ses profili ve enum planla Türkçe repliğe dönüştürür. Yeni şema-2 karar kaydı cümleyi ve normalize biçimini, template kimliğini, istenen/uygulanan hitabı, açılışı, tonu, vurguyu ve `DETERMINISTIC_CONSTRAINED_REALIZER` kaynağını sürüm-8 eylem defterinde taşır. Son altı normalize tam cümle yeniden seçilemez; aynı gerçek hitap iki kez art arda geldiyse üçüncü söz güvenli alternatife döner. STALE karar hiç konuşma üretmez. Oyuncu gelen kutusu yalnız `targetActorId === playerActorId` kararlarını türetir; AI–AI özel kararları görünmez. Sekiz ardışık aynı eylem fikstüründe tam tekrar ve üçlü hitap sıfır; sekiz oyuncu sözü görünür, bir özel söz gizli, dokuz kayıt save/load'da birebirdir. Tam regresyon `61/61`, çıkış `0`, `558,4 sn`; ana dünya `219.806,34 ms`, sekiz etkin devlet, `%80,23/%80,34/%72,24` erişim ve aynı `70056c2d…6d4d36e5` karması verdi. Son gerçek model kapısı `5/5 + 5/5`, sıfır fallback/hata, iki seçim ve `524,74 / 2.340,98 ms` verdi. Manifest ön kontrolü test sonuç sicili ayrışmasını artık uzun koşudan önce reddeder. Faz 38 kapandı; serbest oyuncu metni Faz 38.1, daha zengin uzun-diyalog tekrar/ayırt edilebilir ses kapısı Faz 38.2 kapsamındadır.

### FAZ 38.1 — Oyuncu Konuşmasını Anlama

**Amaç:** Oyuncunun serbest cümlesini bağlama uygun konuşma eylemi ve olası dünya teklifine dönüştürmek.  
**Çıktı:** Niyet, konu, hedef, ton, atıf, iddia, sunulan karşılık, çözülmemiş şart, belirsizlik ve önerilen komut ayrıştırıcısı; `WorldFact`/`ActorBelief`/`ConversationClaim` ayrımı.  
**Kabul kapısı:** Tehdit, soru, pazarlık, söz, blöf ve sır paylaşımı testlerinde doğru sınıf/varlıklar bulunuyor; bozuk günlük dil işleniyor; belirsiz yüksek etkili ifadelerde teyit isteniyor; çelik sevkiyatı referans cümlesi doğru varlık ve çözülmemiş şartlara ayrılıyor.  
**Bağımlılık:** Faz 36–38.

**Uygulama durumu — ilk dikey, 9 Ağustos 2026:** `partial`. `StoryConversationUnderstanding.js`, LLM'den bağımsız ve salt-okunur sürüm-1 analiz zarfını üretir. Kapalı eylem kümesi tehdit, soru, ticari teklif, söz, sır, açık blöf adayı, suçlama, istek, destek, karşı teklif, ret ve gündelik konuşmayı kapsar. Varlık çözümü yalnız kamusal ülke/bölge/kaynak kataloğu, oyuncunun rolüne gerçekten bağlı şirket/depolar ve çağrıda açıkça sunulan bilinen kimlikleri kullanır; yabancı ham sevkiyat defterini taramaz. Çelik katalog boşluğu, bilinmeyen sevkiyat ve belirsiz depo yüksek riskli teyit borcudur; dünya komutu üretilemez. Hedefli kabul probu ve `62/62` tam regresyon temizdir; ana karma `70056c2d…6d4d36e5` kaldı. Kalan kabul borcu gerçek çok turlu teyit cevabını önceki analizle birleştirmek, atıf/koşul/karşılık dilini genişletmek, karakter bilgi kaynağını `ActorBelief` ile sınamak ve daha geniş Türkçe paraphrase/adversarial corpusudur.

**Uygulama durumu — ikinci dikey, 9 Ağustos 2026:** `partial`. Analiz artık kaybolan sonuç değildir. Hedefli karaktere yazılan söz sürümlü oturuma girer; açık dilsel şartlar kapalı aday veya doğrulanan sayı+birim cevabıyla tur tur kapanır. Birleşik `COMMERCIAL_NEGOTIATION_DRAFT`, çözülmüş bağlamı ve oyuncu açıklamalarını korur fakat gerçek sahiplik/yetki/kapasite/şirket kaydı ve iddia doğrulamasını motor incelemesine bırakır. DOM tıklamasıyla verilen söz, iki ayrı oturum, altı açıklama ve save/load birebirliği hedefli probda geçti. Altı ve üç işçili tam paketler yoğun CPU rekabetinde sırasıyla 25 ve 40 dakikalık dış zaman sınırını aştı; tam kabul açık kaldı. Bu oyuncunun ilk serbest eylem yüzeyidir; karakter henüz mekanik cevap vermediği ve teklif uygulanmadığı için Faz 38.1 kapanmaz. Sıradaki dikey `ActorBelief`/muhatap bilgisi ve yetki ön-incelemesidir.

**Uygulama durumu — görüşme çalışma alanı dikeyi, 9 Ağustos 2026:** Dar `SOHBET & DİPLOMASİ` çekmecesindeki metin formu ayrı, odaklı karakter görüşmesi penceresine taşındı. Sol sütun kamusal sicil profili ile muhatabın oyuncuya dönük doğrulanmış güven/saygı/çekince/borç/husumetini; orta sütun yeni veya seçilmiş konuşma taslağını; sağ sütun aynı kişiyle eski oturumları ve yalnız PlayerKnowledge filtresinden geçen uygulanmış söz/ittifak/müzakere kayıtlarını gösterir. Eski oturum `DEVAM ET/İNCELE` ile kaldığı soruya döner; yeni taslak ayrı açılır. Pencere içi klavye olayları kamera ve savaş kısayollarına ulaşmaz; ayrıca StoryUI metin hedefindeyken WASD/ok tuşlarını yutmaz. Hedefli DOM probu profil, iki oturum, eski konuşmaya dönüş, uygulanmış eylem kaydı, dünya nötrlüğü, save/load ve WASD varsayılan davranışını geçti. Görsel tarayıcı yüzeyi bağlı olmadığından piksel karşılaştırma kapısı açık; bu dikey Faz 38.5'in arayüz omurgasını öne alır fakat Faz 38.1'in ActorBelief/mekanik cevap borcunu kapatmaz.

### FAZ 38.2 — Diyalog Gerçekleştirme ve Tekrar Önleme

**Amaç:** Aynı karar içeriğini karaktere, ilişkiye, duyguya ve konuşma geçmişine göre doğal ve değişken biçimde ifade etmek.  
**Çıktı:** Ses profili, konuşma planı, hitap seçici, yakın dönem n-gram/anlamsal tekrar denetimi, kontrollü yeniden üretim ve bağlamsal yedek.  
**Kabul kapısı:** Uzun sohbet testinde aynı tam cümle tekrarlanmıyor; aynı hitap üst üste spam olmuyor; farklı karakterlerin sesleri kör değerlendirmede ayırt edilebiliyor.  
**Bağımlılık:** Faz 34, 36, 38.

**Uygulama durumu — ilk üç dikey, 10 Ağustos 2026:** `StoryCharacterSpeech.js` içine mekanik yetkisiz `storyCharacterDialogueRealize` sözleşmesi eklendi. Kapalı konuşma eylemi; aktörün gerçek doğrudanlık, resmiyet ve sıcaklık eksenlerinden türeyen birincil/ikincil ses kaydıyla gerçekleştirilir. Adaylar son 12 turdaki normalize tam cümle, son altı şablon, iki-sözcüklü Jaccard benzerliği ve son iki hitap üzerinden sıralanır; `%72` yakın-dönem benzerlik tavanını aşan veya üçüncü aynı hitabı üreten aday geri plana atılır. Türkçe çekim kökleri ve açık eşanlam kümeleriyle ikinci bir içerik yakınlığı ölçeri `%86` tavanıyla çalışır; embedding olmadığı için buna gömme modeli denmez. Çıktı `worldMutation=false` taşır; miktar, fiyat, yetki veya yeni dünya olgusu üretemez. Üç gerçek karakter × 24 tur hedefli probunda `72/72` söz geçerli, deterministik, tam-cümle tekrarsız, hitap-spamsiz ve iki benzerlik tavanı içinde kaldı; en yüksek içerik yakınlığı `%37,5`, üç ayrı ses imzası oluştu. İkinci dikeyde bu gerçekleştirici gerçek Faz 38.1 `domainReview.response` hattına bağlandı: kaynak mekanik cümle `mechanicalText` olarak saklanırken oyuncu doğrulanmış karakter cümlesini görür. Birleşik prob doğal cevabı, kaynak zeminini, ekonomi nötrlüğünü, icra engelini, defter geçerliliğini ve save/load eşitliğini birlikte geçti. Üçüncü dikeyde `story-dialogue-blind-eval.js`, 12 etiketli eğitim örneği ve 24 anonim değerlendirme cümlesini ayrı cevap anahtarıyla üretir; paket aktör kimliği veya ses imzası sızdırmaz. Kabul eşiği genel `%65`, her ses için `%50`dir. Puanlayıcının `%100` pozitif ve `%33,33` tek-ses negatif kontrolleri geçti; fakat insan cevapları alınmadığı için gerçek kör değerlendirme hâlâ açıktır ve Faz 38.2 `partial` kalır.

### FAZ 38.3 — Söz, Sır, Borç ve Pazarlık Defteri

**Amaç:** Konuşmayı dünyanın geleceğini değiştiren kalıcı sosyal eyleme bağlamak.  
**Çıktı:** Sürümlü `NegotiationCase`, teklifler, karşı teklifler, gerekli onaylar, verilen sözler, koşullu anlaşmalar, bilinen sırlar, doğruluk inancı, kişisel borçlar, son tarihler ve ihlal olayları.  
**Kabul kapısı:** Karakter aylar/yıllar sonra ilgili sözü ve kabul edilmiş teklif sürümünü doğru bağlamda hatırlıyor; bozulmuş söz ilişki ve aday eylemleri değiştiriyor; sır yalnız bilen aktörlerin karar bağlamına giriyor; çelik sevkiyatı anlaşması fiziksel lojistik tamamlanmadan stok üretmiyor.  
**Bağımlılık:** Faz 9, 35–38.2.

**Uygulama durumu — ilk üç dikey, 10 Ağustos 2026:** `StoryNegotiation.js`, `READY_FOR_NEGOTIATION` durumundaki gerçek konuşma oturumundan idempotent ve sürümlü `NegotiationCase` açar. İlk teklif oyuncunun doğrulanmış aday şartlarını, tavizlerini ve kanıt kimliklerini kopyalar; kaynak aday karması saklanır. Dört zorunlu şartın tamamı pozitif miktar ve açık kanonik birim/tür taşımadan vaka açılmaz; konuşma katmanındaki `payment/contract_penalty.type` alanlarının ilk sürümde sessizce düşmesi icra ön-incelemesinde yakalanıp kapatıldı. Yalnız iki vaka tarafı kapalı `quantity/payment/delivery_schedule/contract_penalty` şartlarında yeni sürüm üretebilir. Karşı teklif eski sürümü `SUPERSEDED` yapar fakat silmez; eski sürüm kabulü `STALE_VERSION`, taraf olmayan aktör `NOT_A_PARTY`, şema dışı bedava kaynak `UNKNOWN_TERM` ile reddedilir. İki taraf güncel sürümü kabul ettiğinde vaka yalnız `ACCEPTED_PENDING_APPROVAL` olur. `MECHANICAL_CONTRACT_AUTHORITY` özellikle `PENDING`, `execution.status=NOT_AUTHORIZED`, `executable=false` ve `worldMutation=false` kalır. Gerçek sohbet UI'sında `MÜZAKERE VAKASI AÇ` eylemi ve açık vaka özeti vardır. İkinci dikey `PROVIDE_COUNTER_OFFER` ve `SECURE_MECHANICAL_APPROVAL` kapalı söz türlerini; promisor/promisee, kaynak sürüm, 5–86.400 saniye son tarih, `OPEN/KEPT/BROKEN`, çözüm olayı ve hafıza kimliğiyle ekledi. Daha yeni gerçek teklif sürümü ilk sözü `KEPT` yapar; onaysız son tarih ikinci sözü `BROKEN` yapar. Tutulan söz karşı taraftan söz verene güven `+250`, saygı `+150`, husumet `−100`, kişisel borç `+120`; bozulan söz güven `−600`, saygı `−250`, husumet `+350` üretir. Üçüncü dikey, en az `%50` güvenli özel ActorBelief'i vaka tarafları arasında SECRET hafızasıyla paylaşır ve üçüncü kişi ifşasını ayrı WorldFact/ActorBelief zinciriyle izler. Yetkisiz ifşa sır sahibine anlık bilgi veya ceza vermez; yalnız ifşa eden ile alan bilir. Sır sahibi ancak ifşa olgusunu bilen aktörden kaynaklı rapor alınca öğrenir; o anda güven `−800`, saygı `−300`, husumet `+500` ve BETRAYAL hafızası bir kez uygulanır. İlgisiz aktöre bilgi sızmaz, tekrar rapor ikinci etki üretmez, yetkilendirilmiş aktarım ihanet değildir. Fiziksel ekonomi/stok/sevkiyat değişmez; hedefli zincir, iki defter ve birebir save/load temizdir. `negotiation-deadlines` doğru sıradadır fakat ağır scheduler devam/A-B probu eşzamanlı CPU yükünde iki kez 185 saniyelik dış sınırı aştığı için küresel scheduler kabulü açık. Mekanik onay/icra tamamlanmadığından Faz 38.3 `partial`dır.

**Dördüncü dikey — mekanik zemin ve ön-kontrol, 10 Ağustos 2026:** Vaka artık kaynak aday karmasına bağlı gerçek sevkiyat, depo, kaynak, şirket, yönlendirme, iddia ve domain-review kimliklerini sürümlü mekanik zeminde korur. Yalnız iki tarafça kabul edilmiş güncel sürüm ve vaka tarafı idempotent ön-kontrol çalıştırabilir. Kontrol; etkin sevkiyat, sipariş/sözleşme zinciri, çalışan depo, temsil+sahiplik, kaynak, alıcı ülke, fiziksel birim/miktar ve nominal kapasiteyi ayrı doğrular. Çelik fikstürü kopuk sipariş referansı, `ton` dönüşümü, depo doluluk muhasebesi, pazarlık bedeli escrow'su, teslim takvimi ve ceza yürütücüsü eksikleriyle açıklanabilir `BLOCKED` kaldı; hiçbir fiziksel/mali değişim oluşmadı. Yeni teklif eski sürümün ön-kontrol yetkisini sıfırlar fakat tarihsel makbuzu saklar; UI yalnız güncel sürüm sonucunu gösterir. Güncel save/load birebir, zemin öncesi vaka kaynak konuşma karması eşleştiğinde güvenle yükselir. Bu kontrol eksik yürütücülerin yerine geçmez; mekanik onay ve icra hâlâ açık olduğundan Faz 38.3 `partial` kalır.

**Beşinci dikey — katalog birimi, fiziksel doluluk ve escrow rezervi, 10 Ağustos 2026:** Konuşma miktarı kaynak kataloğunun birim kimliğine bağlandı; kanıtsız kaynaklar arası dönüşüm yapılmaz. `industrial_parts` için ton reddedilirken lot-parça, gıda için ton-gıda kanonik birime 1:1 bağlanır. Depo kullanılabilir kapasitesi ayrı bir stok kopyasından değil bölgesel teslim edilmiş stok ve hedefe giden `IN_TRANSIT/HELD` sevkiyatlardan türetilir; sevk edilmemiş sipariş fiziksel doluluk değildir. Pazarlık bedeli şirket bakım rezervi korunarak mevcut `ASSET:CASH→ASSET:TRADE_ESCROW` posting'i ve bütçede idempotent `NEGOTIATED_CONTRACT_ESCROW` settlementıyla rezerve/release edilebilir. Çatışan tekrar reddedilir ve iptal para korumasını sağlar. Bu yalnız alıcı escrow rezervidir; satıcıya teslim uzlaşması, takvim, ceza ve kanonik ticaret referansı tamamlanmadan mekanik onay oluşmaz.

**Altıncı dikey — fiziksel yönlendirme, teslim ve ihlal yaşam döngüsü, 10 Ağustos 2026:** Kabul edilmiş güncel sürüm ön-kontrol girdisini etkinleştirme anında yeniden doğrular; eski bir `READY` makbuzu değişmiş dünyada yetki değildir. Uygun vakada şirket bedeli tek `NEGOTIATED_CONTRACT_ESCROW` fişiyle ayrılır, mevcut `storyTradeRedirectShipment` amendment/rota kapısı gerçek sevkiyatı hedef depoya yönlendirir ve ödeme aynı sevkiyatın tek settlement kimliğine bağlanır. `STORY_CALENDAR` ölçeğinde 30 gün 10, iki ay 20 oyun saniyesidir; yüzde ceza kabul edilmiş ödeme üzerinden deterministik hesaplanır. Gerçek teslimat ticaret motorunda stok ve kargo lotunu taşır, escrow'u satıcıya uzlaştırır ve vaka `FULFILLED/KEPT` olur. Son tarih aşılırsa alıcı escrow'u iade edilir, satıcıdan alıcıya çift taraflı ceza posting'i uygulanır, güven `−700`, saygı `−300`, husumet `+450` ve söz hafızası bir kez yazılır; nakit yoksa `BREACH_PAYMENT_PENDING` açık borcu korunur ve 30 dünya günü dolmadan her scheduler tikinde yeniden denenmez. Yerli B2B teslimatta muhasebe envanteri ile fiziksel lot sahibinin ayrışması probda yakalandı; settlement'a bağlı ve şirketleri farklı yükte lot alıcıya devredilerek kapatıldı. İkinci tick ikinci para/ilişki/teşhis üretmez, tamamlanmış vaka yeniden teklif alamaz. Zamanında teslim, tahsil edilmiş ihlal ve açık ceza borcu probları müzakere, bütçe, şirket, commerce ve ticaret doğrulamalarını ve ilk yüklemede byte-byte eşitliği geçti. Önceden başka escrow'a bağlı sevkiyat `SHIPMENT_PAYMENT_ALREADY_BOUND` ile açıkça bloke edilir: alıcıdan alıcıya hak/ödeme devri bu dar dikeyde uydurulmaz, genel `MechanicalContractV1` borcudur. Bu sınır ve ağır scheduler/insan kör kapıları nedeniyle Faz 38.3 hâlâ `partial`dır.

**Yedinci dikey — yoldaki malın alıcıdan alıcıya yeniden satışı, 11 Ağustos 2026:** Önceden şirket escrow'uyla finanse edilmiş aktif yük artık ödeme bağının üzerine yazılmaz. Yeni alıcı oyuncunun temsil ettiği şirket, mevcut alıcı da sohbet edilen aktörün gerçekten temsil ettiği şirket değilse ön-kontrol `CURRENT_BUYER_REPRESENTATION_REQUIRED` ile durur. Uygun durumda ilk sipariş, ilk alıcı ve özgün satıcı escrow'u tarihsel/hukuki zincir olarak korunur; yeni alıcı mevcut alıcıya ikinci `NEGOTIATED_CONTRACT_ESCROW` açar. Sevkiyat `beneficialBuyerCompanyId` ile tek fiziksel faydalanıcıyı, ayrı bir resale settlement kimliğiyle ikinci satış ayağını taşır. Teslimatta özgün satıcı→eski alıcı ve eski alıcı→yeni alıcı muhasebesi tek rollback sınırında kapanır: ikinci posting başarısızsa ilk posting de geri alınır; ara alıcıda hayalet envanter kalmaz. Kayıpta iki escrow birlikte iade edilir. Hedefli dördüncü yaşam yolu ilk escrow/sipariş koruması, iki `SETTLED` ödeme, yeni alıcı lot sahipliği, ara alıcı envanter baz çizgisi, idempotensi, beş defter doğrulaması ve byte-byte save/load'u geçti. Bu, `GOODS` içindeki dar bir hak devridir; genel `MechanicalContractV1` tür/şema defteri değildir. SERVICE/CONSTRUCTION/LOGISTICS/INSURANCE, üçüncü taraf onayları ve genel sözleşme UI'sı açık kalır; Faz 38.3 hâlâ `partial`dır.

**Sekizinci dikey — bağımsız `MechanicalContractV1` omurgası, 11 Ağustos 2026:** `NegotiationCase` ile mekanik sözleşme artık aynı kayıt değildir. Yeni `StoryMechanicalContracts.js` defteri `GOODS/SERVICE/CONSTRUCTION/LOGISTICS/INSURANCE` ailelerini, kaynak müzakere vakası+sürümü+önkontrolü, karakter temsilcisi ile hukuki tarafı, kapsamı, fiyatı, süre/SLA'yı, ihlal sonucunu, nedensel kimlikleri ve icra makbuzunu sürümlü ve hash-kilitli taşır. Yalnız iki tarafın güncel kabulünden ve gerçek şirket temsilinden türeyen `GOODS` taslağı `APPROVED_PENDING_EXECUTION` olabilir; aktif sözleşme içeriği geriye dönük değiştirilemez. Hazır fakat henüz icra edilmemiş taslak, değişen dünya nedeniyle yeni bir önkontrol makbuzu oluşursa güvenle yenilenebilir. Teslim yükümlülüğü sözleşmeyi `ACTIVE→FULFILLED/BREACHED/BREACH_PAYMENT_PENDING` zincirinde senkronlar; UI mekanik sözleşme kimliği/türü/alt türü/durumunu gösterir. Dört hedefli yol kaynak/temsil/receipt bağını, durum geçişini, defter doğrulamasını ve byte-byte save/load'u geçti; alanı olmayan eski kayıt boş ve geçerli sözleşme defterine göç etti. Altı işçili tam paket `64/64` görevi `736,8 sn`de ve çıkış `0` ile tamamladı; 900 sn ana dünya sekiz devleti koruyup `%79,33/%78,31/%72,56` gıda/enerji/yaşam verdi. Diğer dört aile yalnız şemada tanımlıdır ve dünya adaptörü olmadan etkinleştirilemez; Faz 38.3 bu nedenle `partial`dır.

### FAZ 38.4 — Diyalog Ağacı Senaryo Laboratuvarı

**Amaç:** Serbest sohbet sözleşmesini yalnız birkaç mutlu yol yerine farklı bilgi, yetki, kişilik ve dünya koşullarında sistematik olarak doğrulamak.  
**Çıktı:** Çelik sevkiyatı ana senaryosu ve on ek referans ağacı için fikstür/stub tabanlı çalıştırılabilir senaryo tanımları; karakter, bilgi, yetki, doğruluk ve kaynak varyant matrisi.  
**Kabul kapısı:** Her ağaç en az üç mekanik aday dal üretiyor; aynı oyuncu cümlesi farklı dünya/karakter koşullarında doğru biçimde ayrışıyor; yetkisiz veya bilgisiz karakter sahte sonuç üretmiyor. Henüz tamamlanmamış medya, diplomasi, istihbarat ve askerî sistemlerin gerçek entegrasyonu bu fazda başarılı sayılmaz; yalnız sözleşmeleri fikstürlerle doğrulanır.  
**Bağımlılık:** Faz 18, 21, 29, 34–38.3.

**İlk dikey — gündelik sosyal temas, 11 Ağustos 2026:** Oyuncu gözleminde ortaya çıkan sessiz başarısızlık doğrulandı: eski sınıflandırıcı `nasılsın?` gibi bir cümlede düşük puanlı `SMALL_TALK` yerine genel `ASK_INFORMATION` seçiyor, sosyal niyet seçilse dahi oturum `READY_FOR_REVIEW` durumunda karakter cevabı üretmeden kalıyordu. Sosyal sözleşme `GREETING/CHECK_IN/THANK/APOLOGIZE/FAREWELL/ASK_PERSONAL_OPINION/SMALL_TALK` olarak ayrıldı. Gerçek muhatap kimliği mevcut ses profiliyle yanıt verir; cevap oturum geçmişinde kalır, UI'da görünür ve save/load'da birebir korunur. Sosyal yol açıklama, domain denetimi, çalıştırılabilir aday, ilişki veya fiziksel dünya mutasyonu üretmez. Yedi niyetlik hedefli senaryo, karakter sesi doğrulaması, farklı cevap, UI, dünya nötrlüğü ve kayıt/yükleme kapıları geçti; uzun diyalog ve kayıt göçü yakın regresyonları da temizdir. Altı işçili tam paket `1.204 sn` dış komut sınırında sonuç dosyası üretmeden zaman aşımına uğradı; geride kalan yalnız bu koşuya ait işçiler kapatıldı, kullanıcı süreçlerine dokunulmadı ve tam kabul verilmedi. Bu yalnız sosyal açılış dikeyidir: serbest konulu uzun sohbet, güncel dünya olayına dayalı kişisel görüş, önceki cümleye anlamsal takip ve on bir mekanik referans ağacının üçer dal matrisi tamamlanmadığı için Faz 38.4 `partial`dır.

**İkinci dikey — referans katalog ve tahıl kıtlığı matrisi, 11 Ağustos 2026:** Ana çelik vakası ile on ek referans ağacı sürümlü, benzersiz kimlikli katalogda toplandı; her biri en az üç aday dal sözleşmesi taşır. Yalnız `grain-scarcity-redirect` gerçekten çalıştırılabilir laboratuvar durumundadır, kalan dokuz yeni ağaç `CONTRACT_ONLY`, çelik dikeyi `EXISTING_VERTICAL` olarak açıkça ayrılır. Tahıl ağacı; oyuncunun sevkiyatı bilmemesi, muhatabın bilmemesi, muhatabın yetkisizliği, telafili yönlendirme, otoriter/kurumsalcı/ordu yanlısı baskı tepkileri, fırsatçı/ilkeli kayıt dışı satış tepkileri ve doğruluk–inanç ayrımını on vakada ölçer. Sonuçlar daima `FIXTURE_ONLY`, `executable=false`, `worldMutation=false`tır. Muhatap sevkiyata inanırken gerçek sevkiyatın bulunmadığı vaka aynı karakter cevabını korur fakat mekanik kapıyı `SHIPMENT_NOT_ACTIVE` yapar; ActorBelief dünya gerçeğine dönüşmez. Gerçek konuşma çözümleyicisi `tahıl/buğday→food`, `trade-shipment:*`, açık oturumdan bilinen başkent `region:*` ve `PROPOSE_LOGISTICS_REDIRECT` eylemini tanır; yetki ve bölgesel kabul kapasitesi doğrulanmadan komut üretmez. Yeni prob `0,5 sn`, mevcut konuşma probu `4,6 sn`, 65 görevlik manifest ön kontrolü temizdir. Bu henüz gerçek rota değişikliği değildir; tahıl ağacının mekanik adaptörü ve diğer dokuz ağacın koşul matrisleri açıktır.

**Üçüncü dikey — çelik fabrikası grevi matrisi, 11 Ağustos 2026:** `steel-strike-bargain` ikinci çalıştırılabilir laboratuvar ağacı oldu. On iki vaka; oyuncu ve liderin grev bilgisi, liderin sendika mandatı, şirket likiditesi, ücret–enflasyon farkı, grev desteği, üretim aciliyeti, güvenlik kanıtı ve ilkeli/korkak/fırsatçı duruşu ayırır. Kademeli ücret dalının en ileri cevabı grevi bitirmez: `SUBMIT_STRIKE_SUSPENSION_TO_MEMBERS`, mekanik kapısı `MEMBER_VOTE_REQUIRED`tır. Tehdit dalı korkak/zayıf destekte geri çekilme ve radikalleşme riski, ilkeli liderde genişleme, fırsatçı liderde kişisel dokunulmazlık arayışı üretir; hiçbirinde baskı eylemi uygulanmaz. İşçileri primle bölme dalı ayrımcılık incelemesi olmadan ilerlemez. Lider aktif grev olduğuna inanırken motor kaydı çözülmüşse aynı sözlü cevap korunur fakat `STRIKE_NOT_ACTIVE` kapısı çalışır. Canlı ücret modeli `wageModelActive=false` olduğu için fikstür bu alanı etkinleştiremez; şema dışı deneme reddedilir. NLU gerçek `movement:*` kimliğini, `PROPOSE_LABOR_SETTLEMENT`, `NEGOTIATE_STRIKE_SETTLEMENT/LABOR` ve temsil/likidite/üretim/güvenlik borçlarını çıkarır. Oturum `SCENARIO_LAB_ONLY` durumunda kalır; UI grev, ücret, rota veya sevkiyatın değişmediğini açıkça söyler. İzole prob `0,64 sn`, manifest koşusu `0,6 sn`, mevcut konuşma regresyonu `2,9 sn` ve çıkışlar `0`dır. İlk manifest denemesi 80 saniye sessiz kaldığı için durduruldu; işçi artığı yoktu ve sorun doğrudan/tekrar koşularda üretilemedi. Gerçek ücret, toplu sözleşme, üye oyu ve güvenlik projesi adaptörleri açık kalır.

**Dördüncü dikey — silah ihalesi dosyası ve medya gerçeği, 11 Ağustos 2026:** `arms-tender-leak` üçüncü çalıştırılabilir laboratuvar ağacı oldu. On üç vaka; oyuncunun dosya bilgisi, gazetecinin kanıt inancı, kaynak/kopya zinciri, belgenin gerçek bütünlüğü, ihalenin gerçek durumu, soruşturma yetkisi, gazeteci duruşu, kaynak güveni, oyuncunun basın geçmişi ve yayın riskini ayırır. Bağımsız soruşturma dalı yetki yoksa bağımsız makam ister; kısmi kanıtta redakte kopya ve doğrulama, tam kanıtta koşullu 48 saatlik bekleme cevabı üretebilir. Bu cevap yayın durumunu değiştirmez çünkü isimli gazeteci ve medya sahiplik modeli yoktur. Rüşvet dalı ilkeli karakterde ret+kayıt, fırsatçı karakterde kabul veya tuzak adayıdır fakat her ikisi `CORRUPTION_ACTION_FORBIDDEN`; güvenlik tehdidi `COERCIVE_ACTION_FORBIDDEN`dır. Gazeteci belgenin gerçek olduğuna inanırken belge değiştirilmiş veya tamamen sahte olabilir: sözlü cevap aynı kalabilir, mekanik kapı sırasıyla `EVIDENCE_INTEGRITY_REVIEW_REQUIRED` veya `EVIDENCE_FALSE` olur. Mevcut `integrity-case:*`, kanıt skoru ve soruşturma fişi gerçek altyapıdır; `News.js` isimli gazeteci/medya ağı değildir. NLU `PROPOSE_PUBLICATION_DELAY`, `NEGOTIATE_PUBLICATION_DELAY/MEDIA_INTEGRITY` ve gerçek dosya kimliğini bağlar; belge bütünlüğü, kaynak, yetki, süre ve basın bağımsızlığını açık borç tutar. UI hiçbir ihale dosyası veya yayın durumunun değişmediğini söyler. Temiz doğrudan prob `0,595 sn`, manifest probu `0,6 sn`, mevcut konuşma regresyonu `3,6 sn` ve çıkışlar `0`dır. İlk iki denemede zaman aşımından kalan test işçileri yeni doğrudan koşuyu da bekletti; yalnız o test süreçleri kapatıldı, 09:15 kullanıcı süreçlerine dokunulmadı ve temiz koşuda sorun tekrarlanmadı. Araştırmacı gazeteci, medya sahibi ve savcı karakter ağları Faz 39–42 ile Faz 57/59–60 sahipliğindedir; Faz 38.4 bunları varmış gibi üretmez.

**Beşinci dikey — sınır yığınağı ve önleyici seferberlik, 11 Ağustos 2026:** `border-mobilization` dördüncü çalıştırılabilir laboratuvar ağacı oldu. On beş vaka; oyuncu ve muhatap rapor bilgisi, gerçek karşı taraf niyeti, kaynak güveni, seferberlik yetkisi, antlaşma, yanlış alarm geçmişi, karakter duruşu, hazırlık maliyeti ve görünürlüğü ayırır. Ajan/istihbarat karakterleri gerçekten vardır; fakat stratejik rapor yaşam döngüsü ve seferberlik doktrini yoktur. Sınırlı hazırlık, ültimatom ve niyet kanıtı isteme dalları bu yüzden sırasıyla `MOBILIZATION_ADAPTER_MISSING`, `DIPLOMATIC_ESCALATION_ADAPTER_MISSING` ve `STRATEGIC_REPORT_ADAPTER_MISSING` kapılarında kalabilir. Muhatap saldırı hazırlığına inanırken motor gerçeği tatbikat veya aldatma olduğunda aynı sözlü destek cevabı korunur, mekanik kapı `HOSTILE_INTENT_NOT_CONFIRMED` veya `DECEPTION_REVIEW_REQUIRED` olur. Serbest metin `PROPOSE_PREVENTIVE_MOBILIZATION`, `PREPARE_BORDER_MOBILIZATION/SECURITY_INTELLIGENCE` ve kaynaklı `actor-belief:*` raporunu bağlar; rapor güveni, niyet, yetki, maliyet, antlaşma ve tırmanmayı borç tutar. UI seferberlik, savaş ve diplomasinin değişmediğini söyler. İlk doğrudan prob, plan dal adları ile iç teklif enumlarının aynı alan sanıldığını `SELECTED_BRANCH` hatasıyla yakaladı; katalog değiştirilmeden açık dal eşlemesi eklendi. Son doğrudan prob `0,622 sn`, manifest `0,6 sn`, mevcut konuşma regresyonu `4,2 sn` ve çıkışlar `0`dır. Gerçek stratejik rapor Faz 57, seferberlik/savaş hedefi Faz 47–52 ve tam rol yetkisi Faz 59–60 borcudur.

**Altıncı dikey — yaptırım, paravan şirket ve yasal muafiyet, 11 Ağustos 2026:** `sanctions-shell-company` beşinci çalıştırılabilir laboratuvar ağacı oldu. On sekiz vaka; oyuncu ve muhatabın yaptırım bilgisi, yaptırımın gerçek yürürlüğü, malın sivil/çift kullanımlı/askerî sınıfı, aracının kapasitesi ve güvenilirliği, liman denetimi, escrow/enerji mahsubu/opak ödeme, oyuncu yetkisi, aracı duruşu ve yasal muafiyet yolunu ayırır. Küçük deneme, tehdit ve yasal muafiyet dalları karakter cevabı üretir; hiçbiri sevkiyat, şirket, ödeme veya diplomasi komutu değildir. Karakter yaptırımın aktif olduğuna inanırken gerçek kayıt sona ermişse aynı escrow karşılığı korunur fakat mekanik kapı `SANCTION_NOT_ACTIVE` olur. Gerçek şirket sahipliği, fiziksel ticaret escrow'su ve ajan karakterleri kullanılabilir; yaptırım rejimi, nihai faydalanıcı/paravan sahiplik grafiği, AML taraması ve gümrük yakalanma modeli yoktur. Bu sınırlar sonuç şemasında zorunlu `false` alanlarıdır ve fikstür girdisiyle etkinleştirilemez. NLU `PROPOSE_SANCTIONS_EVASION`, `NEGOTIATE_SANCTIONS_EVASION/SANCTIONS_TRADE` ve açık oturumdaki `actor-belief:*` yaptırım inancını bağlar; inancı dünya gerçeği saymaz. UI yaptırım, şirket ve ödemenin değişmediğini açıkça söyler. Doğrudan prob 18/18 beklenen sonuç, determinizm, şema, dünya nötrlüğü ve dürüst UI kapılarını `2,7 sn`de; hedefli manifest `0,7 sn`, mevcut sohbet regresyonu `2,9 sn`de geçti. Gerçek yaptırım/kaçakçılık/diplomatik sonuç adaptörü sonraki modern diplomasi, ticaret ve istihbarat fazlarının borcudur.

**Yedinci dikey — mülteci yerleştirme ve sınır pazarlığı, 11 Ağustos 2026:** `refugee-border-bargain` altıncı çalıştırılabilir laboratuvar ağacı oldu. Yirmi vaka; oyuncu ve muhatabın akış bilgisi, akışın gerçek durumu, insan sayısının doğruluğu, hedef kabul ve iş kapasitesi, gıda/güvenlik, yerel halk tutumu, yardım fonu, oyuncu yetkisi, gönüllülük, muhatap duruşu ve komşu güvenilirliğini ayırır. Kaynaklı gönüllü yerleşim, zorla geri gönderme ve komşuya mali transit teklifi yalnız karakter cevabı üretir. Zorla yerleştirme/geri dönüş her durumda `FORCED_DISPLACEMENT_FORBIDDEN`; üçüncü ülke merkezi `THIRD_PARTY_TRANSIT_POLICY_MISSING` kapısında kalır. Gerçek Faz 27 `REFUGEE` defteri insan sayısı, kohort, rota, gecikme, atomik nüfus transferi ve kabul kapasitesi vekili taşır. Buna karşılık gerçek konut varlığı, aile/akrabalık ağı, sınır-vize-iltica politikası, uluslararası yardım ödeme yürütücüsü ve üçüncü ülke transit anlaşması yoktur; sonuç şeması bu yoklukları zorunlu kılar. Muhatap akışın beklediğine inanırken motor kaydı tamamlanmışsa aynı koşullu kabul cevabı mekanik kapıda `REFUGEE_FLOW_NOT_ACTIONABLE` olur. NLU `migration:*`, bilinen `region:*`, `PROPOSE_REFUGEE_SETTLEMENT`, `NEGOTIATE_REFUGEE_SETTLEMENT/MIGRATION_HUMANITARIAN` ve çalıştırılamaz yerleştirme isteğini bağlar. UI sınır, göç ve nüfusun değişmediğini söyler. Doğrudan 20/20 prob `2,5 sn`, hedefli manifest `0,8 sn`, mevcut sohbet regresyonu `5,8 sn` ve çıkışlar `0`dır. Gerçek oyuncu göç komutu, yardım settlementı, rıza ve sınır politikası sonraki entegrasyon fazlarının borcudur.

**Sekizinci dikey — banka kurtarma, tasfiye ve oligark pazarlığı, 11 Ağustos 2026:** `bank-bailout-oligarch` yedinci çalıştırılabilir laboratuvar ağacı oldu. Yirmi vaka; oyuncu ve muhatabın banka krizi bilgisi, bankanın gerçek ödeme durumu, likidite açığı kanıtı, bilanço bütünlüğü, mevduat maruziyeti, sistemik bağlantı, devlet bütçesi, oyuncu yetkisi, çapraz sahiplik, muhatap duruşu, çözümleme kapasitesi ve medya karşılığını ayırır. Hissedar sulandırma+denetim, gizli ayrıcalık ve düzenli tasfiye yalnız karakter cevabı üretir. Sahte bilanço `BANK_FRAUD_INVESTIGATION_REQUIRED`, medya karşılığı kredi `CORRUPTION_ACTION_FORBIDDEN`, sistemik bağlantısı bilinmeyen tasfiye `SYSTEMIC_RISK_MODEL_REQUIRED` kapısında kalır. Gerçek Faz 21 banka defteri rezerv, kredi alacağı, özkaynak ve toplu mevduat alanı; şirket kredileri, devlet bütçesi ve integrity-case kanıtı taşır. Fakat hane kimlikli mevduat hesapları/garantisi, bankalar arası bulaşma ağı, banka sahibi ve yönetim kurulu, hissedar sulandırma, çözümleme/tasfiye ve mevduat transfer yürütücüsü yoktur. Muhatap krize inanırken gerçek banka solvent ise aynı koşullu kurtarma cevabı mekanik kapıda `BANK_CRISIS_NOT_ACTIONABLE` olur. NLU `bank:*`, `PROPOSE_BANK_RESOLUTION`, `NEGOTIATE_BANK_RESOLUTION/FINANCIAL_STABILITY` ve çalıştırılamaz çözümleme isteğini bağlar. UI banka, mevduat ve ödemenin değişmediğini söyler. Doğrudan 20/20 prob `2,7 sn`, hedefli manifest `0,8 sn`, mevcut sohbet regresyonu `2,9 sn` ve çıkışlar `0`dır. Gerçek banka krizi üretimi, garantili mevduat, çözümleme kurumu, sistemik risk ve oligark medya ağı sonraki finans/siyaset entegrasyon borcudur.

**Dokuzuncu dikey — savaş esiri takası, istihbarat ve propaganda, 11 Ağustos 2026:** `prisoner-exchange` sekizinci çalıştırılabilir laboratuvar ağacı oldu ve katalog dalları plandaki gerçek seçeneklerle `STAGED_VERIFICATION / INTELLIGENCE_BARGAIN / PROPAGANDA_REFUSAL` olarak hizalandı. Yirmi bir vaka; oyuncu ve muhatabın esir listesi bilgisi, gerçek liste durumu, kimlik/sağlık doğrulaması, esirin sır maruziyeti, karşı tarafın bilgi erişimi, aile/kamuoyu baskısı, önceki ihlal, takas noktası, tarafsız gözlemci, yetki, karakter duruşu ve özrü ayırır. ActorBelief bir esir defteri değildir. İnançta listede/gerçekte kayıp kişi aynı yaralı-takas cevabını korurken mekanik kapıda `DETAINEE_CASE_NOT_ACTIONABLE` olur. Yüksek gizli bilgi `CLASSIFIED_RELEASE_FORBIDDEN`, doğrulanmamış kayıp-tim bilgisi `INTELLIGENCE_CLAIM_UNVERIFIED`, propaganda özrü `DIPLOMATIC_APOLOGY_ADAPTER_MISSING` kapısında kalır. İsimli askerî ve istihbarat karakterleri, ActorBelief, kamuoyu ve temel diplomasi gerçektir; esir/gözaltı defteri, sağlık kaydı, kişiye bağlı sır, tarafsız doktor mandatı, eşzamanlı takas, propaganda olayı ve arama-kurtarma görevi yoktur. NLU `actor-belief:*` raporunu dünya gerçeğine çevirmeden `PROPOSE_PRISONER_EXCHANGE`, `NEGOTIATE_PRISONER_EXCHANGE/DETENTION_DIPLOMACY` ve çalıştırılamaz takas taslağına bağlar. UI esir ve takasın değişmediğini söyler. Doğrudan 21/21 prob `2,8 sn`, hedefli manifest `0,8 sn`, sohbet regresyonu `2,9 sn` ve çıkışlar `0`dır. İlk kapsamlı koşu 65 görevi tamamladıktan sonra genişletilen tek UI cümlesinin eski grev “değişmedi” alt sözleşmesini bozduğunu yakaladı; yedi alan ayrı ve kesintisiz güvenlik ifadelerine ayrıldı. İkinci kapsamı azaltılmamış paket `65/65`, `1043,0 sn`, çıkış `0`; ana 900 saniye `480458,84 ms`, sekiz devlet, `%79,33/%78,31/%72,56` gıda/enerji/yaşam ve değişmeyen `a1c2f0c9…c4d` karması verdi. Gerçek esir yaşam döngüsü, Cenevre/hukuk, sağlık, takas icrası ve moral sonuçları sonraki askerî-diplomasi entegrasyon borcudur.

**Onuncu dikey — boru hattı sabotajı ve ortak soruşturma, 11 Ağustos 2026:** `pipeline-sabotage-inquiry` dokuzuncu çalıştırılabilir laboratuvar ağacı oldu; dallar `LIMITED_DATA_SHARING / PUBLIC_ACCUSATION / SECRET_QUID_PRO_QUO` olarak planla hizalandı. Yirmi dört vaka; olay bilgisi, muhatap inancı, gerçek neden, teknik kanıt, tespit ve atıf, ham güvenlik kaydının hassasiyeti, sensör penceresi, enerji bağımlılığı, medya anlatısı, sınır protokolü, tarafsız uzman, eşzamanlı yayın güveni, yetki, kişilik ve kaçakçılık dosyasını ayrı girişler olarak taşır. İnançta sabotaj/gerçekte kaza aynı kurumsal cevabı korurken mekanik kapıda `SABOTAGE_CAUSE_NOT_CONFIRMED`; üçüncü taraf nedeni `THIRD_PARTY_CAUSE_REVIEW_REQUIRED`; doğrulanmamış aleni suçlama `ATTRIBUTION_NOT_CONFIRMED`; gizli dosya takası daima `CORRUPTION_ACTION_FORBIDDEN` olur. Kampanyanın gerçek enerji koridoru, karakter sabotaj makbuzu ve tespit/atıf sonucu mevcuttur. Buna karşılık boru hattı neden defteri, devriye/sensör kayıt sistemi, ortak teknik heyet, tarafsız uzman havuzu, eşzamanlı rapor yürütücüsü, medya suçlama adaptörü, sınır güvenliği protokolü ve kaçakçılık dosyası redaksiyonu yoktur. NLU gerçek `corridor:energy:*` kimliğini ayrı ActorBelief olay kaydıyla `PROPOSE_PIPELINE_INQUIRY`, `NEGOTIATE_PIPELINE_INQUIRY/ENERGY_SECURITY` ve çalıştırılamaz ortak soruşturma taslağına bağlar. UI boru hattı, soruşturma ve enerjinin değişmediğini açıklar. Doğrudan prob `2,9 sn`, hedefli manifest `0,9 sn`, konuşma regresyonu `2,8 sn`, çıkışlar `0`dır. Büyük paket son darbe/halefiyet ağacı sonrasında tekrar çalıştırılacaktır.

**On birinci dikey — darbe söylentisi ve halefiyet pazarlığı, 11 Ağustos 2026:** `coup-rumor-succession` onuncu ve son çalıştırılabilir referans ağacı oldu; katalog dalları planın dört gerçek seçeneğiyle `CONSTITUTIONAL_TRANSITION / PERSONAL_OFFICE_BARGAIN / SPLIT_PLOTTERS / REJECT_RUMOR` olarak hizalandı. Yirmi sekiz vaka; oyuncu ve muhatap söylenti bilgisi, gerçek kriz, lider durumu, komuta sadakati, atama yetkisi, anayasal sıra, acil imza zinciri, karakter hırsı, rakip ağı, dezenformasyon kapasitesi, önceki söz ihlali ve kriz aşamasını ayrı tutar. İnançta gerçek darbe varmış gibi aynı anayasal cevap üretilebilir; motor gerçeğinde kriz yoksa `POLITICAL_CRISIS_NOT_ACTIONABLE`, lider sağlıklıysa `LEADER_INCAPACITY_NOT_CONFIRMED` kapısı çalışır. Gizli makam teklifi daima `CORRUPT_APPOINTMENT_PROMISE_FORBIDDEN`; komutanları birbirine düşürme `COVERT_DISINFORMATION_ADAPTER_MISSING`; söylentiyi reddetme yalnız `POLITICAL_CRISIS_ACTION_REVIEW_REQUIRED` olur. Faz 33 gerçek siyasi kriz ve isimli komutan sadakati, Faz 29 kurum yetkisi, Faz 37 gönüllü istifa/halefiyet yürütücüsü ve ActorBelief gerçektir. Lider sağlık kaydı, acil anayasal geçiş, bedelli makam taahhüdü, darbe dezenformasyonu ve kışlada kal emri yoktur. NLU deterministik olarak açılmış gerçek `political-crisis:*` kimliğini ayrı `actor-belief:*` söylenti kaydıyla `PROPOSE_SUCCESSION_CRISIS_RESPONSE`, `NEGOTIATE_SUCCESSION_CRISIS/POLITICAL_SUCCESSION` ve çalıştırılamaz taslağa bağlar. UI darbe, makam ve ordunun değişmediğini söyler. Doğrudan 28/28 prob `3,4 sn`, hedefli manifest `1,4 sn`, konuşma regresyonu `2,8 sn`; kapsamı azaltılmamış paket `65/65`, `596,4 sn`, çıkış `0`; ana 900 saniye `212417,84 ms`, sekiz devlet, `%79,33/%78,31/%72,56` ve değişmeyen `a1c2f0c9…c4d` karmasıdır. On matris tamamlanmıştır; gerçek dünya adaptörleri ve ortak kabul kapısındaki serbest takip/geri çağrım işleri ayrı borçtur.

### FAZ 38.5 — Sohbet Çalışma Alanı İlk Oynanabilir Sürüm

**Amaç:** Karakter bulma, erişim, serbest metin, bağlam, teklif sürümü ve söz hafızasını tek oyuncu akışında birleştirmek.  
**Çıktı:** Konuşulabilir karakter dizini, aktif sohbet düzeni, bağlam paneli, teklif/söz kartları, yanıt bekleme ve yedek model durumları.  
**Kabul kapısı:** Oyuncu şehir veya yönetim ekranından karaktere ulaşabiliyor; kabul ettiği teklif sürümü açıkça görülüyor; konuşma metni tek başına dünya komutu uygulamıyor; bilinmeyen karakter amacı sızmıyor.  
**Bağımlılık:** Faz 3.1, 14.1, 33.1, 34–38.4.

**İlk dikey — gerçek dünya olayından açılan sürdürülebilir görüşme, 11 Ağustos 2026:** Faz 33 siyasi kriz görünümündeki gerçek kriz lideri artık ayrı görüşme penceresinde olay bağlamıyla açılabilir. Kaynak, serbest metinden veya LLM özetinden uydurulmaz: yalnız oyuncuya görünür aktif `political-crisis:*` kaydının kanonik son olay kimliği, kriz katılımcısı muhatap ve açılış durumu şema-4 konuşma oturumuna alınır. Görünmeyen/sahte kriz kimliği oturum üretmeden `EVENT_ANCHOR_NOT_VISIBLE` ile reddedilir. Oyuncu ilk sözden sonra aynı oturumda serbest takip mesajı yazabilir; genel bir “hangi kanıt?” sorusu önceki `POLITICAL_SUCCESSION` konusunu korur. Karakter cevabı yalnız görünür olay+kriz kimliklerini kanıt gösterir, ham dünya defteri okumaz ve komutanların gizli niyetini kesin gerçek diye sunmayı açıkça reddeder. İlk söz, takip sorusu ve cevap aynı akışta görünür; olay kartı kaynak bağını oyuncuya gösterir. Konuşma tek başına kriz, ilişki, kurum veya fiziksel karar uygulamaz. Olay ankrajı, takip turları, sayaçlar ve aday bağları save/load'da birebir korunur; v2 oturum kayıtları güvenli varsayılanlarla v4'e yükselir. Hedefli gerçek DOM probu `10,9 sn`, tam yükte `8,2 sn` geçti. Kapsamı azaltılmamış paket `65/65`, `1511,7 sn`, çıkış `0`; ana dünya `1050115,83 ms`, sekiz devlet, `%79,33/%78,31/%72,56` ve değişmeyen `a1c2f0c9…c4d` karması verdi. İlk tam koşunun 20 dakikalık dış sınırda takılması test sonucu değil işçi yaşam döngüsü hatasıydı: büyük sonuç yazıldıktan sonra `done` öncesi zorunlu tam GC, CPU rekabetinde dakikalar sürüyordu. Büyük sonuç işçisi artık sonucu önce bildirip havuz tarafından yenileniyor. Bu dikey Faz 38.5'i kapatmaz; üç farklı karakter/ilişki ayrışması, gerçek söz veya sır sonucu, geçerli dünya kararı, krizden savaş/barış adayına geçiş ve daha sonraki konuşmada kısa–orta–uzun geri çağrım hâlâ zorunlu ara kabul borcudur.

**İkinci dikey — üç karakterli kriz müzakeresi ve açık kabul makbuzu, 11 Ağustos 2026:** Aynı görünür Faz 33 krizi artık kriz lideri ve iki gerçek sadık komutanla ayrı olay görüşmesi açar; oyuncunun kendi karakteri muhatap listesinden çıkarılır. Her muhatap aynı söz için kendi `coreAxes`, değer, etkin hedef ve oyuncuya dönük güven/saygı/husumet bağından deterministik `EVENT_COUNSEL_RESPONSE` üretir. Lider müzakere kanalını, kurumsalcı komutan emir zincirini, kamucu karakter aleni hesabı, güvensiz karakter kanıt toplamayı önerebilir; yüksek husumet+düşük güven taahhüdü reddeder. UI gizli hedef enumunu göstermez; yalnız doğal gerekçe, öneri, ilişki bantları ve destek/koşul/ret duruşunu gösterir. Bu yanıt `rawWorldRead:false/worldMutation:false` kalır. Dünya ancak oyuncu ayrı `ÖNERİYİ KABUL ET VE UYGULA` düğmesine bastığında değişir: mevcut `storyPoliticalCrisisAct` maliyet/yetki/cooldown kapısı yeniden çalışır, kriz eylemi konuşma oturumu+yanıt kimliğini taşır ve karakter→oyuncu ilişkisi kaynak makbuzuyla değişir. Oturum şema-5'e yükseldi; `eventDecision` kabul/ret, kriz eylem sırası, sonuç kodu ve ilişki öncesi/sonrası makbuzunu saklar. İkinci kabul `EVENT_DECISION_EXISTS` ile eylem, maliyet ve ilişki etkisi üretmeden reddedilir. Hedefli gerçek DOM+save/load probunda üç düğme, üç farklı cevap, konuşma boyunca beş fiziksel defterde birebir hash, kabul sonrası tek kriz eylemi, tek ilişki değişimi, doğru öncesi/sonrası ilişki makbuzu, kanonik geri iz ve idempotans geçti. Nihai hedefli prob `6,7 sn` ve defter doğrulaması temizdir. Aynı çalışma ağacındaki 65 görevli tam paket, kullanıcı CPU yükü altında altı ilk ağır işçi tek sonuç vermeden `604 sn` dış sınırına ulaştığı için kabul başarısı sayılmadı; yalnız bu koşunun yetim işçileri kapatıldı. Önceki `65/65` taban geçerlidir fakat bu ikinci dikey için yeni tam paket borcu açıktır. Faz 38.5 kapanmaz: tutulmuş/bozulmuş sözün kriz adayına etkisi, savaş/barış ayrımı, sonraki konuşmada kısa–orta–uzun geri çağrım ve 50 turluk insan tekrar kapısı eksiktir.

**Üçüncü dikey A — kaynaklı karar/söz hafızası ve sonraki görüşmede geri çağrım, 11 Ağustos 2026:** Kriz tavsiyesinin açık kabulü artık yalnız ilişki ve kriz makbuzu bırakmaz; danışman ile oyuncunun ortak tuttuğu, hemen çözülmüş bir karar bölümü üretir. Kayıt `politicalCrisisId`, `conversationDecisionId`, `conversationSessionId`, `counselResponseId`, kanonik kriz eylem sırası ve sonuç kodunu birlikte taşır. `storyMemoryRecallForActor`, karakterin kendi RECENT/EPISODE/MILESTONE katmanlarını deterministik puanlar; sahibi veya katılımcısı olmadığı kaydı hiçbir koşulda döndürmez. Sonraki ayrı görüşmede “geçen krizdeki karar” sorusu orta-vadeli bölümden gerçek sonuç kodunu ve kanıt kimliklerini döndürür. Aynı seçici Faz 38.3'te gerçekten tutulan karşı-teklif sözü ile gerçekten bozulan süreli mekanik-onay sözünü uzun-vadeli `PROMISE` kayıtlarından birlikte çağırır; cevap KEPT/BROKEN durumlarını ve commitment kaynaklarını taşır. Konu filtresi kriz/karar ile söz mihenk taşını ayırır; aynı ilişkiden doğan DEBT kaydı kriz cevabının önüne geçmez. Oturum şema-6, eski şema-1..5 güvenli göçü, `memoryRecalls` teşhisi ve save/load birebirliği vardır. Hedefli Faz 38.5 probunda kısa/orta/uzun katman ve defter doğrulaması geçti. Sonraki adım söz sonuçlarını gerçek diplomatik/ekonomik uyuşmazlık adayına bağlamaktır; yeni paralel söz motoru kurulmayacaktır.

**Üçüncü dikey B — uzun görüşme UI'si, çoklu katılımcı görünümü, devlet yetkili protesto ve zarar değerlendirmesi, 11 Ağustos 2026:** Gerçek Electron compositor probunda 12 takipli konuşmanın görünmeyen biçimde modalın altına büyüdüğü ölçüldü (`overflow-y:scroll` görünürken `scrollMax=0`). Aktif konuşma kabı `minmax(0,1fr)` akış + sabit besteci grid'ine çevrildi; sıradan render kaydırmayı korur, yeni/yeniden açılan mesaj sona gider ve besteci üzerindeki tekerlek metin alanının kendi kaydırması yoksa konuşma akışına yönlenir. Nihai ölçüm `scrollTop=2206`, `scrollMax=2367`, iki yönde tekerlek başarısı ve `0` UI problemi verdi. Oturumun açık `participantActorIds` alanı sol rayda ayrı profil kartları üretir; PlayerKnowledge ile bilinen veri gösterilir, bilinmeyen katılımcıda ülke/rol/ilişki uydurulmaz. Bu yalnız UI hazırlığıdır; gerçek çok taraflı karakter karar döngüsü sonraki davranış fazlarının borcudur. Sınır aşan BROKEN sözün incelemesi de Faz 29 kurum yetkisine bağlandı: yaralı özel aktör dosyayı açabilir ama devlet adına protesto yayımlayamaz. Doğru ülkenin yürütülmüş, tek kullanımlık `ISSUE_DIPLOMATIC_PROTEST` fişi tüketilince devlet ilişkisi kaynaklı ve sınırlı `-6` değişir; antlaşma ve savaş durumu aynen kalır. Yabancı devlet fişi, yürütülmemiş fiş ve ikinci tüketim reddedilir. Zarar değerlendirmesi yalnız kanonik teslimat, escrow iadesi ve ceza ödeme makbuzlarını kullanır: sözleşme değeri ile iade edilmiş anapara, ceza tazminatı, doğrulanmış doğrudan kayıp ve tazmin edilmemiş zarar ayrı alanlardır. Fırsat maliyeti ve üretim kaybı kaynak fişi yoksa `UNVERIFIED / includedInDamage:false` kalır; bu yüzden aynı vakada savaş eşiği dürüstçe sıfırdır. Eski incelemeler bu şemaya güvenli backfill edilir. Sohbet probu ile bağımsız kurum probu temizdir. Sıradaki dikey anayasal savaş/barış adayları, ardından 50 turluk insan tekrar kapısıdır.

**Üçüncü dikey C — anayasal savaş/barış ve 50 turluk tekrar kapısı, 11 Ağustos 2026:** `DECLARE_WAR` icrası konuşma veya tek makam çağrısı değildir. Kaynaklı diplomatik incelemede hem tazmin edilmemiş zarar (`≥250`) hem güncel devlet ilişkisi (`≤-60`) hem yasal rota yeniden doğrulanır; inceleme sonrası eşik bayatlarsa yürütülmüş kurum fişi dahi savaşı açamaz. Eşikler geçtiğinde yalnız yaralı devletin rejime göre gereken bütün kurum onaylarını taşıyan `EXECUTED DECLARE_WAR` fişi tek kullanımlık tüketilir. Savaş açıldıktan sonra barış adayı iki savaşan ülkeyi açıkça listeler; tek ülkenin `SIGN_TREATY` fişi reddedilir, her iki ülkenin kendi anayasal rotasından geçmiş iki ayrı fişi `war→peace` değişimini bir kez uygular. Mutlu yol testi gerçek zarar gibi sunulmadı: harness içinde `TEST_FIXTURE` diye işaretlenen eşik kurulumu kullanıldı ve test sonunda müzakere, kurum ve diplomasi anlık görüntüsü geri yüklendi. Gerçek sıfır-zarar ticari vaka savaş üretmemeye devam etti. Sosyal konuşma kalite kapısı üç oturuma bölünmüş, açılış cevapları dahil tam 50 kronolojik turdur. Üç karşı-tohumda bütün niyetler doğru, bütün sözler karakter gerçekleştiricisinden, yan yana ve son-12 tam tekrar `0`, azami aynı hitap serisi `2`, yasak fallback `0`; benzersiz cümle sayısı `49/50`, `49/50`, `50/50`, en yüksek sözcüksel benzerlik `%22,73`, anlamsal benzerlik `%36,36` kaldı. Bu otomatik kapı metinlerin eğlenceli olduğuna dair oyuncu kabulünün yerine geçmez. Sırada kapsamı azaltılmamış tam paket ve gerçek EXE oyuncu konuşma kabulü vardır.

**Tam paket denemesi:** Altı işçili kapsamı azaltılmamış `npm test -- --workers=6`, `1204,1 sn` dış sınırında hiçbir görev sonucu bildirmeden zaman aşımına uğradı; bu başarı veya regresyon geçişi değildir. Yalnız bu koşuya ait `story-test-parallel` ve altı `story-test-worker` süreci kimlik/komut satırıyla doğrulanıp kapatıldı; diğer kullanıcı süreçlerine dokunulmadı. Aynı çalışma ağacında hedefli Faz 38.5 probu `1/1`, kurum probu `1/1`, üç tohumlu 50 tur ölçümü ve sözdizimi/diff kapıları temizdir. Faz 38.5, tam paket ve oyuncu doğallık/eğlence kabulü gelmeden `partial` kalır.

**Altıncı dikey — gerçek çok turlu söylem durumu ve yerel LLM bağlantısı, 11 Ağustos 2026:** Oyuncu testi, önceki 50 tur ölçümünün yalnız kalıp/hitap tekrarını ölçtüğünü ve anlamsal sohbet yeterliliğini kanıtlamadığını ortaya çıkardı: ilk yanıt anlamlıyken sonraki sözler aynı niyet şablonuna yığılıyordu. Oturum şema-7'ye yükseltildi; aktif konu, son oyuncu sözü, son karakter tutumu, karakterin bekleyen sorusu, son söylem eylemi ve tur sayısı kayıt/yüklemede korunur. Takipler `ANSWER_PREVIOUS_QUESTION / ASK_REASON / CHALLENGE_PREVIOUS_POSITION / CORRECT_PREVIOUS_TOPIC / REPAIR_REPETITION / ACCEPT / REJECT / CHANGE_TOPIC` dâhil kapalı söylem planına bağlanır. Model hazır olmasa bile yedek yanıt son sözü ve önceki soruyu açıkça referans alır; “Seni dinliyorum” genel kaçağı kullanılmaz. Paketli yerel model artık oyuncu sohbetinin gerçek tüketicisidir: son on konuşma satırı, karakter kimliği, aktif konu ve kodun güvenli anlam planıyla asenkron tek-cevap üretir. Çıktı sayı, iç kimlik, yeni kişi/olay/stok/anlaşma/emir/yetki veya mekanik sonuç eklerse reddedilir; dünya sonucu yalnız deterministik motorlarda kalır. `llm:start` önceki gibi yüklemeyi başlatıp hemen `ready:false` dönmez; renderer'ı dondurmadan hazır/hata durumunu bekler. Ardışık sohbet üretimleri tek model kuyruğunda sırayla işlenir. Hedefli prob; askerî cevabı önceki yardım sorusuna bağlama, “neden?” ile son tutumu açıklama, tekrar şikâyetini onarma, çelik→enerji düzeltmesi, dünya nötrlüğü, şema-7 göçü ve birebir save/load kapılarını geçti. Elli tur testi artık dürüstçe sağlamlık kapısıdır; anlamsal kalite kanıtı dört açık takip senaryosudur. Gerçek paketli model çıktısı, gecikme, ret/fallback oranı ve oyuncu doğallık kabulü EXE üzerinde henüz ölçülmediğinden Faz 38.5 `partial` kalır.

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

- En az üç farklı karakter aynı teklife farklı gerekçeyle cevap verir. **İkinci dikeyde geçti.**
- Oyuncunun aynı metni farklı ilişki koşullarında kullanması aynı sonucu garanti etmez. **İkinci dikeyde geçti.**
- Gerçek KEPT/BROKEN söz farklı ve kaynaklı sonraki-adım adayları açar. **Üçüncü dikey B'de geçti; adaylar henüz yürütülemez.**
- Tutulan ve bozulan gerçek söz sonraki görüşmede kaynak ve durumuyla hatırlanır. **Üçüncü dikey A'da geçti.**
- Aynı sosyal yardım talebi tekrarlandığında karakter aynı fallback cümlesini kopyalamaz. **Üçüncü dikey B'de geçti.**
- Kabul edilmiş gerçek kriz kararı daha sonraki ayrı görüşmede kaynağıyla hatırlanır. **Üçüncü dikey A'da geçti.**
- Sohbet olmadan seçilen mekanik karar ile sohbetle müzakere edilen karar aynı yol değildir.
- En az 50 konuşma turunda rahatsız edici replik/hitap döngüsü oluşmaz. **Üçüncü dikey C'de üç tohumlu otomatik kapı geçti; oyuncu eğlence kabulü ayrıca açık.**
- LLM kapalıyken zincir daha az zengin metinle fakat mekanik olarak çalışmaya devam eder.
- Fikstürle üretilen sonuç UI ve telemetride açıkça `TEST_FIXTURE` olarak işaretlenir; gerçek entegrasyon gibi raporlanmaz.
- Bu zincir eğlenceli ve anlaşılır bulunmazsa medya, tam diplomasi ve dünya ölçeklemesi ertelenir.

---

## DALGA G.1 — Modern Karakter Davranışı Yükseltmesi

Bu yükseltme, dış `ModernCharacterBehaviorSystem` analizinin ana plana seçici kabulüdür. Faz 34–38.5'in çalışan kimlik, ilişki, hafıza, ActorBelief, eylem, hakem ve konuşma defterleri değiştirilmez ve tek bir `CharacterV2` monolitine kopyalanmaz. Karakter kaydı yalnız kararlı kimlik ile defter referanslarını taşır; ilişki, hafıza, inanç, makam, güç ve eylem kendi kanonik sahibinde kalır.

Kabul edilen davranış zinciri:

```text
WorldFact
→ erişim kontrollü InformationItem
→ kaynaklı ActorBelief
→ kişisel + rol + organizasyon hedefleri
→ DecisionContext
→ mekanik adaptörün ürettiği ActionCandidate
→ yetki / hukuk / kaynak / fizik / gizlilik filtresi
→ açıklanabilir DecisionTrace
→ kanonik komut ve makbuz
→ WorldConsequence / yeni WorldFact
→ ilişki, hafıza, stres, kariyer ve iletişim geri beslemesi
```

Zorunlu mimari sınırlar:

- Karakter `WorldFact`ı doğrudan okuyamaz; yalnız erişebildiği `InformationItem` ve ActorBelief anlık görüntüsü karar bağlamına girer.
- Rol, kişisel, organizasyon ve ideolojik hedefler ayrı sahiplik taşır. CEO şirketin, komutan ordunun, gazeteci medya kuruluşunun kendisi değildir.
- Trait, değer, kuşak veya ideoloji doğrudan sabit yüzde bonusu ya da eylem yasağı değildir; aday skoru ve konuşma stratejisinde kaynaklı gerekçe üretir.
- Hata rastgele aptallık değildir. Eksik/yanlış inanç, kaynak yanlılığı, kariyer riski, ilişki, stres, sınırlı düşünme bütçesi ve yalnız tohumlu/kayıtlı küçük belirsizlikten açıklanmalıdır.
- LLM aday, puan, gerçek, yetki veya sonuç üretemez. Yalnız seçilmiş karar, güvenle açıklanabilir nedenler, kamu personası, izinli inanç/sırlar ve hedef kitle üzerinden dil gerçekleştirir.
- Kamu personası özel tercih değildir. Oyuncuya gösterilen karar açıklaması karakterin gizli hedef, özel inanç veya sırrını sızdırmaz; `PlayerKnowledge` projeksiyonundan geçer.
- `PowerProfile` ikinci bir güç motoru değildir. Kurum, şirket, bütçe, birlik, medya erişimi, ağ ve uzmanlık defterlerinden zaman damgalı salt-okunur görünüm olarak türetilir.
- İlişkiyi on korelasyonlu sayaca şişirmek yasaktır. Mevcut güven/korku/saygı/borç/husumet kanoniktir; sevgi, bağımlılık, rekabet, mağduriyet, ideolojik yakınlık ve profesyonel saygı önce olay etiketi veya türetilmiş bağlam görünümü olarak kanıtlanır. Ayrı eksen ancak karşı-örnek testinde mevcut beş eksenin açıklayamadığı farklı karar üretirse eklenebilir.
- `AGGREGATE/MINOR/RELEVANT/MAJOR/WORLD` karakter katmanları Faz 12 aktivasyon bütçesine bağlanır. Oyuncunun temas ettiği kişiyi ayrıntılandırmak geçmişi yeniden yazmaz; kararlı kimlik ve kaynak olaylardan deterministik açılım yapar.
- Belgedeki çok sayıdaki rol ve örnek eylem motor değildir. Domain adapter, yetki, maliyet, gerçek hedef ve makbuz yoksa rol yalnız katalog borcudur ve UI'da eylem gösteremez.
- Dış belgedeki sayısal senaryolar `TEST_FIXTURE`dır. Dünya gerçeği, denge değeri veya çalışır adaptör diye raporlanamaz.

### FAZ 38.6 — Algılanan Dünya ve Karar İzi V2

**Kapanış — 12 Ağustos 2026:** Faz tamamlandı. `StoryDecisionTrace.js`, mevcut Faz 34–38 defterlerini ikinci bir dünya/ilişki motoruna çevirmeden `DecisionContextV2` ve `DecisionTraceV2` üretir. Bağlam WorldFact içeriğini doğrudan okuyamaz; yalnız karar sahibinin kaynaklı `ActorBelief` kimlikleri, gerçek adaylar, yetki/bedel filtreleri, aktif hedefler ve yönlü ilişki anlık görüntüsü kullanılır. Otonom tarama ile kaynak ActorBelief'e bağlanan olay tepkisi ayrıdır; aktörün bilmediği olay tetikleyicisi reddedilir. Sunulmayan aday izi reddedilir; `NEGOTIATE/ALLY/BETRAY` MAJOR, `ORDER/SABOTAGE/RESIGN` WORLD sayılır ve yeni hakem kaydında iz zorunludur. TARGET/AUTHORITY/DOMAIN/COST/COOLDOWN/EXECUTOR kapıları ile rol-ülke-kurum-organizasyon-servis sınırı ayrı kaydedilir; olmayan hukuk modeli uydurulmaz. Psikoloji kanıtı seçicinin zaten kullandığı eksen/hedef nedenlerini ayrıştırır ve ikinci puan eklemez. Risk; eylem türü, yönlü ilişki maruziyeti, kaynak bedeli ve ActorBelief güveninden türetilen sınırlı açıklama kaydıdır; seçimi değiştirmez. Eylem defteri şema-9 ile bağlam+izleri saklar, tavan/referans/yetim bağlam doğrular ve ortak bağlam son izden sonra budanır. Şema-8 geçmişi `LEGACY_UNAVAILABLE` olarak kayıpsız göçer. Oyuncu projeksiyonu başka aktörün özel skor/yetki/bedel/psikoloji/risk nedenlerini açmaz; “Sana Söylenenler” kartının gerçek DOM'u yalnız ortak kaynaklı kanıtı ve gizli kalan neden sayısını gösterir. Gizli WorldFact enjeksiyonu, sahte olay kanıtı, aday dışı seçim, deterministik tekrar, şema-8 göç ve birebir save/load kabul kapıları geçti.

**Amaç:** Karakter kararını gerçek dünya yerine karakterin kaynaklı inancı üzerinden, destekleyen ve karşı çıkan nedenlerle açıklamak.
**Çıktı:** `DecisionContextV2`, `DecisionTraceV2`; tetik olayları, ActorBelief anlık görüntüsü, aday/filtre sonuçları, rol-hukuk-organizasyon sınırları, hedef deltaları, maliyet/risk, ilişki ve psikoloji katkıları.
**Kabul kapısı:** `MAJOR/WORLD` kararında iz zorunlu; aday olmayan eylem seçilemiyor; gizli WorldFact puana sızmıyor; aynı bağlam/tohum save-load sonrası aynı seçimi ve izi üretiyor. UI yalnız oyuncunun bildiği nedenleri gösteriyor.
**Bağımlılık:** Faz 4.1, 9–10, 29–30, 34–38.5.

### FAZ 38.7 — Önyargı, Geçici Stres ve Kamu Personası

**Kapanış — 12 Ağustos 2026:** `StoryCharacterBehavior.js`, karakter kimliğini kopyalamadan her aktör için en çok iki kanonik eksen önceliği, mevcut ses profilinden kamu personası ve kaynak olay+ActorBelief zorunlu geçici stres defteri kurar. Bias `2500 bp`, toplam davranış katkısı mutlak `4` puan tavanlıdır. Faz 37 seçicisinin nedenlerinde aynı eksen zaten varsa katkı `AXIS_ALREADY_COUNTED` ile sıfırlanır; diğer bias ve aktif stres katkıları kaynak kimlikleriyle Faz 38.6 karar izine girer. Aynı kaynak şok farklı karakterlerde farklı fakat deterministik tepki üretir. Stres aktör başına sekiz kayıtla sınırlı, `30–1800 sn` yarı ömürlü ve kaynak yenilenmezse üstel sönümlüdür; refah veya dünya alanına yazmaz. Persona, aynı temel konuşma planını özel görüşmede korurken kamusal açıklamada devlet-konumu odaklı ifadeye çevirir; iki kanal da `scoreEffect:0` ve `mechanicalDecisionMutable:false` taşır. Konuşma şeması 2 yeni kanal kanıtını zorunlu kılar; eski şema-1 sözlere geçmişte bilinmeyen persona bağlamı uydurulmaz. Davranış, konuşma, gerçek eylem sıralaması ve karar izi hedefli regresyonları; sahte olay reddi, `8000→4000` yarı ömür, kapanış, dünya/refah nötrlüğü ve birebir save-load ile geçti. Tam paket, Faz 38.5'ten kalan bayat birleşik konuşma probu ayrıştırılmadan küresel kanıt sayılmaz.

**Amaç:** Karakterlerin anlaşılır biçimde kusurlu davranmasını ve kamu/özel dil ayrımını kurmak.
**Çıktı:** Sınırlı, ortogonal `BiasProfileV1`; kaynak olay, yarı ömür ve tavan taşıyan `CharacterStressStateV1`; `PublicPersonaV1`; özel tercihle çelişebilen fakat gizlilik filtresini aşamayan ifade planı.
**Kabul kapısı:** Stres ikinci refah motoruna dönüşmüyor; aynı şok bütün karakterlere aynı tepkiyi vermiyor; önyargı aynı kanıtı iki kez puanlamıyor; persona mekanik gerçeği değiştirmiyor; stres kaynağı kesilince açıklanabilir biçimde sönüyor.
**Bağımlılık:** Faz 25–26, 34, 36–38.6. Medya Faz 39–42 bu sözleşmenin tüketicisidir.

### FAZ 38.8 — İlişki Yorumu ve Bağlamsal Hafıza Geri Çağrımı

**İlk iki dikey — 12 Ağustos 2026:** `StoryRelationshipInterpretation.js`, yeni ilişki veya hafıza defteri açmadan sahip olunan kanonik hafızayı yorumlayan salt-okunur `RelationshipInterpretationV1` görünümünü kurdu. Tutulmuş/bozulmuş söz doğrudan mevcut PROMISE durumundan; aleni aşağılama yalnız kaynak olaylı CONFLICT; ortak kriz başarısı yalnız kaynak makbuzlu DECISION kaydından kabul edilir. Yorum karakter eksenleriyle `8000–12000 bp` arasında farklılaşır ama yalnız Faz 35'in mevcut güven/korku/saygı/borç/husumet eksenlerinde delta önerir; ilişkiyi ikinci kez uygulamaz. Başka aktörün hafızası, ilgisiz hedef ve kaynaksız sahte olay etiketi karşı-testte reddedildi. En önemli iki sahipli yorum, gerçek Faz 37 eylem sıralamasına toplam mutlak `3` puan tavanıyla bağlandı; tutulmuş söz işbirliğini, ihlal/aşağılama mesafeyi ve ortak başarı desteği yalnız bağlamsal olarak etkiler. Katkı kaynak hafıza kimlikleriyle Faz 38.6 kalıcı izine girer, karar sahibi olmayan oyuncuya özel ayrıntı sızmaz. Yorum sonrası dünya ve ilişki karması aynı, ek hafıza sayısı sıfırdır. Yeni prob `0,5–0,6 sn`, hafıza `1,4 sn`, gerçek teslimat/müzakere `2,0 sn`, davranış `0,7 sn`, yoğun CPU altında eylem `60,7 sn` ve karar izi `0,7 sn` regresyonları temizdir. Gerçek üretim hattında aleni aşağılama/ortak kriz makbuzları ve hafıza yoğunlaştırma henüz açıktır.

**Üçüncü dikey — 12 Ağustos 2026:** Faz 36'nın mevcut RECENT budaması genişletildi; ayrı bir uzun-vade hafıza defteri açılmadı. `24` kayıt üstündeki düşük önem bağlamı SUMMARY'ye inerken tür sayısına ek olarak hedef karakter dağılımı, doğrulanmış ilişki olay etiketi dağılımı, kaynak hafıza kimlikleri ve kaynak kümesi karması korunur. SUMMARY katkısı kalıcı MILESTONE'dan düşük önemlidir, en çok iki-katkı ve toplam `±3` seçici tavanını aşamaz; söz/sır/borç/ihanet/mihenk taşı yoğunlaştırma tarafından silinmez. Yeni alanlar save-load sonrası birebirdir. Ayrıntılı prob, karakter çekirdeğinde bulunmayan `loyalty/cooperation` anahtarlarının `NaN` üretip JSON'da `null`a dönüşebildiğini yakaladı; yorum kanonik `institutionalPosture`, `nationalGlobalOrientation` ve mevcut hawkishness ile, eksik değerde nötr `50` kullanır. Ayrıca `--task` modunun yalnız sonuç üretip assertion çalıştırmadığı için false alanları yeşil gösterebildiği kanıtlandı. Manifest görevlerine isteğe bağlı `requiredTrue` kapısı eklendi; Faz 38.8 probu artık zorunlu alanlardan biri false ise worker seviyesinde kırmızı verir. Nihai yoğunlaştırma probu `0,8 sn`, Faz 36 hafıza `1,5 sn`, göç `2,0 sn`, karar izi `0,7 sn` geçti.

**Dördüncü dikey — 12 Ağustos 2026:** Faz 33 siyasi kriz motoru gerçek `SHARED_CRISIS_SUCCESS` üreticisi oldu. Yalnız terminal `FAILED / COUP_DEFEATED`, en az iki kanonik `loyalistActorId` ve gerçek `CRISIS_RESOLVED` olay makbuzu birlikteyse ayrı DECISION mihenk taşı açılır. Sahipler yalnız gerçek sadık koalisyondur; kaynakta kriz, sonuç, olay kimliği, görünürlük ve ilişki etiketi vardır. Darbecilerin `SUCCESS / GOVERNMENT_SEIZED` sonucu ortak savunma başarısı diye çerçevelenmez; mevcut BETRAYAL tarihi aynen korunur. Ayrı savunma fikstürü hafızayı Faz 38.8 yorumuna taşıdı. Doğrudan çıktı ve yeni `requiredTrue` kapılı siyasi kriz probu `5,8 sn`, ilişki yorumu `0,8 sn`, hafıza `1,5 sn` geçti. Aleni aşağılama için mevcut PUBLIC_ACCOUNT krizi görünür kılıyor fakat karakter A'nın B'yi kamusal biçimde aşağıladığı fail–hedef makbuzu üretmiyor; bu olay hazırmış gibi uydurulmadı ve açık borç bırakıldı.

**Amaç:** Aynı olayın farklı karakterlerde farklı ilişki yorumu ve gelecek davranışı üretmesini sağlamak.
**Çıktı:** İlişki olay etiketleri, yorum, duygusal ağırlık, güven, pekişme ve geri çağrım tetikleri; kişi/kurum, benzer kriz, stres, yıldönümü, medya yeniden gündemi ve yeni kanıt sorguları.
**Kabul kapısı:** Tutulan söz, bozulan söz, aleni aşağılama ve ortak kriz başarısı farklı yorum/aday üretir; düşük önem yoğunlaştırılırken ihanet/borç/sır/mihenk taşı kaybolmaz; yeni ilişki ekseni ancak mevcut beş eksene karşı bilgi kazancı kanıtıyla açılır.
**Bağımlılık:** Faz 35–36, 38.3–38.6.

### FAZ 38.9 — Rol Adaptörleri ve Kurumsal Müzakere

**İlk uygulama dilimi — 12 Ağustos 2026:** `StoryCharacterRoleAdapters.js` sürümlü ve salt-okunur rol kataloğunu açtı. Karakter profili veya görünen unvan tek başına yetki değildir: hükümet/ordu yalnız Faz 29 `institution.officeHolder.actorId`, şirket yalnız Faz 22 kanonik `companyId` üzerinden bağlanır. Mevcut seed ölçümünde 48 şirket yöneticisi gerçek şirkete, 16 siyasi/askerî aktör gerçek makama bağlandı; makam kaydı olmayan 96 unvanlı kişi yetkisiz kaldı. Makamın teklif/onay/icra rotası `authorityGrants` kaydından okunur. Aktörün ROLE ve PERSONAL hedef kimlikleri ayrıdır; kanonik organizasyon/kurum hedef defteri bulunmadığı için boş tutulur ve kişinin hedefi kuruma mal edilmez. Kimlikte servis referansı bulunan 16 ajan, ayrı istihbarat kurum/yürütücü defteri bulunmadığı için `CONTRACT_ONLY`; medya kimliği ve kurumu bulunmadığı için `UNAVAILABLE`dır. Bu boşluklar rol adıyla kapatılmadı. Genel müzakere hâlâ kişilerarası Faz 37 yürütücüsüdür ve şirket/devlet sonucuna çevrilmez. Determinizm, gerçek defter bağı, unvan reddi, hedef sınırı, yetki rotası, eksik-domain açıklığı, dünya nötrlüğü ve feature-off kapısı hedefli probe'da geçti. Bu yalnız güvenli adaptör omurgasıdır; kurumsal teklif/itiraz/onay/uygulama zinciri ve ayrıntılı alt roller gelmeden Faz 38.9 `partial` kalır.

**İkinci uygulama dilimi — 12 Ağustos 2026:** Adaptör yeni kurum motoru kurmadan Faz 29'un kanonik `submit → approve → execute` zincirine bağlandı. Gerçek yürütme makamı `MOBILIZE_FORCE` teklifini sundu, gerçek silahlı kuvvetler makamı kendi zorunlu imzasını verdi ve yürütme makamı icra etti; durum sırasıyla `PENDING_APPROVAL → AUTHORIZED → EXECUTED` oldu. Makamsız unvan sahibi aynı adaptör kapısında reddedildi. Makbuz `physicalMutation:false / AUTHORIZATION_RECORD_ONLY_PHASE_29` sınırını korur; karakter kararı askerleri gizlice seferber etmez. `ENACT_LAW` ile ilk deneme, yasama kurumunun var olmasına rağmen makam sahibinin Faz 35 isimli karakter defterinde bulunmadığını açığa çıkardı; test gevşetilmedi, rota gerçek iki isimli aktöre taşındı ve yasama karakter kadrosu açık borç bırakıldı. İtiraz/ret iradesi ile şirket yönetim kurulu zinciri hâlâ eksiktir.

**Üçüncü uygulama dilimi — 12 Ağustos 2026:** Zorunlu makam artık bekleyen isteği otomatik onaylamaz. Yalnız kimlik defterindeki kaynaklı eksenler ve eylem ailesi deterministik destek puanı üretir; sonuç `APPROVE`, `OBJECT` veya `REJECT`tir. `OBJECT` öneri düzeyinde kalır, onay imzası eklemez ve isteği terminal kapatmaz. `REJECT` yalnız gerçek zorunlu makamdan gelebilir; Faz 29 isteğini kapalı gerekçe kodu, reddeden aktör+kurum ve `physicalMutation:false` makbuzuyla `DENIED` yapar. Aynı seferberlik eylemi gerçek kadroda üç sonucun tamamını üretti. LLM, rastgele sayı ve ham dünya okuması yoktur; defter doğrulaması ve byte-byte save/load temizdir. İtiraz henüz kalıcı yeniden-müzakere kaydı değildir; şirket yönetim zinciri de açık borçtur.

**Dördüncü uygulama dilimi — 12 Ağustos 2026:** Faz 21 şirket defteri şema-2'ye yükseltildi ve sınırlı yönetim karar kuyruğu eklendi. Yalnız kanonik `COMPANY_EXECUTIVE`, yalnız kendi `organizationId` şirketi için `REQUEST_LOAN` veya `START_INVESTMENT` teklifi sunabilir. Tek mevcut yönetici, şirketin bütünü veya hayalî kurul sayılmadı: CFO/CTO/BOARD_MEMBER kimliği bulunmadığından teklifler `BOARD_APPROVAL_MISSING`, `executable:false`, `economicMutation:false` kalır. Kredi hesabı, nakit, borç, proje, fiziksel girdi ve kapasite değişmez. Başka şirket adına teklif reddedilir. Şema-1 kayıt, şirket/banka/tesis/proje/hesap verisini aynen koruyup yalnız boş sayaç+kuyruk ekleyerek şema-2'ye göçer. Hedefli rol probe'u ve kapsamlı şirket regresyonu temizdir. Sonraki borç, şirket sahipliğiyle kaynaklanan gerçek CEO/CFO/CTO/yönetim kurulu kadrosu ve bu kadronun ayrı teklif/inceleme/onay zinciridir.

**Beşinci uygulama dilimi — 12 Ağustos 2026:** Şirket makamları karakter sayısını yapay şişirmeden türetiliyor. Kanonik `COMPANY_EXECUTIVE` CEO makamını doldurur; CFO, CTO ve `BOARD_CHAIR` yalnız aynı gerçek `organizationId` bağında uygun rol karakteri varsa dolar. Hane/devlet gibi toplulaştırılmış sahipler isimli insan sayılmaz. Mevcut dünyada her şirkette CEO dolu, diğer üç makam `VACANT`tır. Bu nedenle kredi kararı `CFO + BOARD_CHAIR`, yatırım kararı `CFO + CTO + BOARD_CHAIR` eksiklerini makbuzunda açıkça taşır. Faz 38.11'in kohorttan karakter yükseltme politikası gelmeden yüzlerce bedava yönetici yaratılmadı. Gerçek kadro ve kariyer yaşam döngüsü 38.10–38.11 borcudur; Faz 38.9 bu bağımlılık yüzünden `partial` kalır.

**Altıncı uygulama dilimi — 12 Ağustos 2026:** `OBJECT` artık geçici return değeri değildir. Gerçek zorunlu makamın itirazı aynı Faz 29 isteğinin `reviewRecords` alanına aktör, kurum, kapalı gerekçe, zaman ve `physicalMutation:false` ile yazılır. Aynı makamın aynı aktif itirazı idempotenttir. Sonraki onay itirazı silmez; `SUPERSEDED_BY_APPROVAL` ve çözüm zamanı olarak korur. Eski kurum kayıtlarında `reviewRecords` bulunmaması doğrulamadan önce boş diziyle göçer; anayasa imzası değişmemiş olsa bile backfill atlanmaz. Ret ve icra kuralları değişmedi. Hedefli rol, kurum ve şirket regresyonları temizdir.

**Amaç:** Devlet, şirket, ordu, medya ve istihbaratı tek kişilik AI olmaktan çıkarmak.
**Çıktı:** Sürümlü rol kataloğu ve gerçek domain adapter kayıtları; ilk dikeylerde hükümet başkanı/bakan, CEO/CFO/CTO/yönetim kurulu, genelkurmay/saha komutanı, gazeteci/editör/patron ve istihbarat şefi/analist ayrımı.
**Kabul kapısı:** Kurum sonucu yetkili karakterlerin teklif, itiraz, onay ve uygulama zincirinden çıkıyor; rol kataloğundaki fakat adaptersiz eylem görünmüyor; organizasyon hedefi kişinin özel hedefi diye kopyalanmıyor.
**Bağımlılık:** Faz 21–22, 28–33.1, 34–38.8, medya Faz 39–42.

### FAZ 38.10 — Türetilmiş Güç ve Kariyer Yaşam Döngüsü

**İlk uygulama dilimi — 12 Ağustos 2026:** `StoryCharacterPower.js` gücü kalıcı puan yerine salt-okunur kanonik sorgu yaptı. Kurumsal/yasal kanal gerçek makam `authorityGrants`, ekonomik kanal şirket nakdi+tesisleri, askerî kanal ARMED_FORCES makam/rotaları, ağ kanalı aktöre yönelen seyrek ilişki kenarları, bilgi kanalı yalnız aktörün tuttuğu ActorBelief kayıtlarıyla hesaplanır. Eski `career.influence=50` kaynak değildir; testte 0/100 değiştirilmesi sonucu değiştirmedi. Makamsız unvan sahibinin kurumsal gücü sıfır kanıtlıdır. Medya, halk tabanı ve uzmanlık henüz yürütücüsüz olduğundan `UNAVAILABLE/null` görünür; toplamın içine sahte sıfır kanalı gibi kanıt sayılmaz. Bütün değerler 0–10000 bandında, deterministik ve dünya nötrdür. Bu ilk görünüm kariyer yaşam döngüsü değildir; makam kaybı, seçim/istifa/emeklilik, sağlık/ölüm ve geçmiş koruma sıradadır.

**İkinci uygulama dilimi — 12 Ağustos 2026:** Kariyer görünümü yeni ve çelişen bir makam defteri açmadı; güncel makamları rol adaptöründen, geçmiş makam değişimlerini Faz 37'nin kalıcı `officeTransitions` kayıtlarından türetiyor. Kabul probunda gerçek `RESIGN` makbuzu makamı halefe devretti, eski sahip `ACTIVE_OFFICE` durumundan `FORMER_OFFICE_HOLDER` durumuna geçti ve kurumsal güç kanalı düştü. Buna karşılık aktör kimliği, dört ekseni, değerleri, hedefleri, yönlü ilişki kenarı ve istifadan önceki hafıza kaydı birebir kaldı. Kariyer geçişi kaynak makbuzunu açıkça taşır; sorgu tekrarında dünyaya yazmaz. Yaş/sağlık/emeklilik/ölüm için kanonik zaman ve olay yürütücüsü bulunmadığından bunlar uydurulmadı, `UNAVAILABLE` olarak raporlandı; Faz bu yüzden `partial`dır.

**Üçüncü uygulama dilimi — 12 Ağustos 2026:** Kimlik defteri `story-character-identity-ledger-4` oldu ve her aktör açık yaşam sözleşmesi aldı. Eski kayıtlar `ACTIVE / SOURCE_ACTOR_PRESENT` durumuna göçer; kaynakta bulunmayan doğum tarihi ve yaş `null`, sağlık ile emeklilik uygunluğu `UNKNOWN` kalır. `RETIRED` veya `DEAD` geçişi boş gerekçeyle uygulanamaz, kaynak olay kimliği ister. Aktör tek bir kanonik devlet makamı tutuyorsa yaşam geçişinden önce mevcut Faz 37 `RESIGN → OFFICE_SUCCESSION_RESOLVED` zinciri çalışır; halef başarısızsa yaşam durumu değişmez. Birden fazla makamın kısmi devri atomik olmadığı için açıkça reddedilir. Emeklilik karakteri sosyal olarak yok etmez: kurum/şirket/servis yetkisi kapanır ama `PERSONAL_AGENCY` korunur. Ölüm bütün aktif eylemleri kapatır; ölü şirket yöneticisi makam görünümünden çıkar ve koltuk `VACANT` olur. Kimlik, eksenler, hedefler, ilişki, eski hafıza ve yeni kalıcı yaşam mihenk taşı korunur. Harici kaynak olayın kanonik olay defteri karşılığı henüz doğrulanamadığı için kayıt `EXTERNAL_EVENT_REFERENCE_UNVERIFIED` taşır; otomatik yaşlanma, sağlık şoku ve ölüm üretimi hâlâ sonraki demografi/sağlık adaptörüne bağlıdır.

**Amaç:** Makam dışı gücü ve karakterin 2010–2100 boyunca rol değiştiren yaşamını modellemek.
**Çıktı:** Kurumsal/ekonomik/askerî/medya/ağ/halk/uzmanlık/bilgi/zorlama/hukuk kaynaklarından türetilmiş güç görünümü; terfi, görevden alma, seçim, istifa, emeklilik, skandal, yaş, sağlık, ölüm ve haleflik olayları.
**Kabul kapısı:** Güç saklanan keyfî bonus değil kanonik varlık/yetki/ağ sorgusudur; makam kaybı bütün nüfuzu sıfırlamaz; kariyer geçişi geçmiş, ilişki, söz ve sırları korur; ölü/emekli karakter aktif yetki kullanamaz.
**Bağımlılık:** Faz 23, 28–37, 38.6–38.9, sonraki sağlık ve demografi adaptörleri.

### FAZ 38.11 — Karakter Katmanları ve Kohorttan Yükselme

**İlk uygulama dilimi — 12 Ağustos 2026:** `StoryCharacterActivation.js` henüz insan üretmeyen, salt-okunur aktivasyon aday kapısını kurdu. Kaynak yalnız Faz 23'ün gerçek bölgesel kohortu ile Faz 26'nın aynı bölgedeki gerçek `PROTEST/STRIKE/UPRISING` katılımıdır. Yerel sorun şiddeti, seferberlik ve eylem aşaması sınırlı `0–10000` puana; puan kapalı `AGGREGATE/MINOR/RELEVANT/MAJOR/WORLD` kataloğuna çevrilir. Meslek/eğitim seçimi olay türü ve gerçek kohort büyüklüğünden deterministik yapılır. Kabul fikstüründe `WORKING_CONDITIONS + UPRISING` gerçek çalışan kohortundan `WORLD` adayı üretti. Buna rağmen kimlik defterine aktör eklenmedi, nüfus eksilmedi ve aday açıkça `CANDIDATE_ONLY_NO_PERSON_CREATED` kaldı. Böylece “olay oldu, bedava ünlü doğdu” kısa yolu açılmadı. Kalıcı yükseltme kimliği, kişi-kohort muhasebesi, activation/deactivation yaşam döngüsü, aktivist/ihbarcı/yerel lider/viral medya gibi ayrı olay adaptörleri ve ayrıntı kapanınca hafıza korunumu sonraki dilimlerdir.

**İkinci uygulama dilimi — 12 Ağustos 2026:** `story-character-activation-ledger-1` aday ile kalıcı aktör arasındaki kanonik bağı kurdu. Yalnız `RELEVANT/MAJOR/WORLD` adayı yükseltilebilir; düşük `AGGREGATE/MINOR` aday doğrudan API çağrısıyla da reddedilir. Aktör kimliği aday kimliğinden deterministik türetilir, aynı adayın ikinci çağrısı aynı makbuzu döndürür ve ikinci insan yaratmaz. Kimlikteki `activationOrigin` ile aktivasyon defterindeki promotion kaydı kohort, bölge ve kaynak hareket üzerinden çapraz doğrulanır. İsimli temsilci kohorttan çıkarılan veya nüfusa eklenen ayrı kişi değildir: zaten kohort içinde sayılan bireyin ayrıntılı temsili olarak `populationDelta:0` taşır. Yükselme kalıcı CAREER hafızası üretir. Kaynak hareket görünümden kalktığında aktör `DORMANT_SOURCE / MINOR` düzeyine iner ve pahalı karar uygunluğunu kaybeder; kimlik, köken hafızası ve yönlü ilişkisi silinmez. Save/load kohort–aktör bağını ve dormancy durumunu korur; yeni kampanya önceki promosyonları sıfırlar. Restore, yetim aktör referanslı aktivasyon defterini kabul etmez. Aday/roster sorguları salt-okunurdur; gerçek defter yalnız reset, yükseltme veya yüklemede oluşur. Faz hâlâ `partial`: toplumsal hareket dışı olay adaptörleri, otomatik yükseltme bütçesi, scheduler ve uzun koşu karakter sayısı dağılımı yoktur.

**Character Mind Architecture / simulation LOD ilkesi — dış analiz sonrası yükseltme, 12 Ağustos 2026:** Dünya “devlet başına tek AI” veya “her karakter başına sürekli LLM” olmayacaktır. Karakter ↔ organizasyon ↔ devlet ↔ toplum geri beslemesi korunur; devlet kararı başkan, bürokrasi, komutan, şirket, medya, muhalefet ve toplumun gerçek yetki/çıkar çatışmasından çıkar. Karar skoru yasaklanmaz: aday eleme ve hesap bütçesi için gereklidir. Yasaklanan şey, açıklamasız `score=82` sonucunun karakter iradesi gibi sunulmasıdır. Yüksek çözünürlükte karar izi sırasıyla aktörün bildiği ActorBelief, aktif hedefleri, yönlü ilişki yorumu, korku/kırmızı çizgi, beklenen sonuç, bedel, yetki ve yürütücü kanıtını taşımalıdır. Rasyonel optimum ile karakter seçimi ayrılabilir; fakat intikam, korku, arkadaş koruma veya ideolojik zarar kabulü yeni tek-sayı modifier ile uydurulmaz, gerçek hafıza+ilişki+hedef+yanlış bilgi zincirinden doğar. Cesaret/açgözlülük/kıskançlık/intikam gibi yeni eksenler mevcut dört kişilik ekseni, hedefler, stres ve beş ilişki kanalına karşı ölçülebilir bilgi kazancı kanıtlanmadan eklenmez. Simulation LOD üç yürütme düzeyi taşır: ucuz toplu simülasyon tüm dünya, bilişsel karar planlaması sınırlı `MAJOR/WORLD` aktörler, yerel 8B/BeonAI ise yalnız ayrı hakem kapısından geçen seyrek `WORLD` anlatım/akıl yürütme istekleri. LLM sayı, gerçek, yetki veya mekanik sonuç yazamaz.

**Üçüncü uygulama dilimi — 12 Ağustos 2026:** Otomatik yükseltme LOD bütçesiyle scheduler'a bağlandı. Görev `character-behavior` sonrasında ve `character-actions` öncesinde her `15` dünya saniyesinde çalışır. Tek tik en fazla `1` kişi yükseltir; dünya isimli temsilci tavanı `64`, ülke tavanı `8`, aynı anda pahalı `MAJOR/WORLD` çözünürlük tavanı `16`dır. Aynı ülkede dokuz güçlü ayaklanma adayı fikstüründe sekiz kişi yükseldi, dokuzuncu `COUNTRY_NAMED_BUDGET_EXHAUSTED` ile kaldı. Her tikte en fazla bir yükselme ve fiziksel nüfusta sıfır değişim doğrulandı. Simulation LOD görevi LLM çağırmaz (`llmCalls:0`); `WORLD` aktörün LLM kullanabilmesi ayrıca Faz 38.12 hakem/gizlilik kapısı ister. Scheduler görev sicili yeni periyodu save/load ile taşır. Bu kota denge finali değildir; 900 saniye/30 yıl doğal dağılımı görülmeden artırılamaz.

**Amaç:** Modern dünyada binlerce kişiyi tam karar döngüsüyle çalıştırmadan önemli bireyleri kalıcı aktöre dönüştürmek.
**Çıktı:** `AGGREGATE/MINOR/RELEVANT/MAJOR/WORLD` aktivasyon politikası; olay tetikli değerlendirme; aktivist, ihbarcı, sembolik işçi, yerel lider ve viral medya figürünün kohorttan isimli karaktere deterministik yükselmesi.
**Kabul kapısı:** Boşta karakter pahalı karar çalıştırmıyor; yükselme kişi yaratmıyor veya nüfusu eksiltmiyor; aynı seed/olay aynı kimliği açıyor; ayrıntı kapanınca önemli hafıza ve ilişkiler kaybolmuyor.
**Bağımlılık:** Faz 12–13, 23–28, 34–38.10.

### FAZ 38.12 — Davranış QA, Gizlilik ve Oyuncu Açıklaması

**İlk uygulama dilimi — 15 Ağustos 2026:** Karakter eylem özeti Faz 38.12 için
yeniden hesaplanabilir bir davranış QA görünümü taşır. Yalnız gerçek uygulanmış AI
makbuzlarından eylem türü, rol, aktör ve aktör çifti yoğunluğu; baskın pay ve örnek
yeterliliği çıkarılır. `30` eylem altı sonuç dürüstçe `INSUFFICIENT_SAMPLE`, yeterli
örnekte `%75` üstü tek eylem baskınlığı `REVIEW` olur; bu eşikler seçiciyi değiştirmez.
Rastgele çeşitlilik kotası yoktur. İlk gerçek ölçümde aynı tohum `300 sn`de `8`
eylem (`7 ALLY / 1 PERSUADE`, `%87,5`), `900 sn`de `18` eylem
(`16 ALLY / 2 PERSUADE`, `%88,89`) üretti. Bu, ALLY baskınlığına dair ciddi bir
işarettir fakat iki koşu da asgari örneğin altındadır; sonuç denge kabulü veya kör
ceza gerekçesi yapılmadı. Sıradaki kapı çok-tohumlu toplu örnek, aktif ittifak
doygunluğu ve rol maruziyetini birlikte ölçmektir.

**Çok-tohumlu kapı — 15 Ağustos 2026:** Dört izole `300 sn` dünya dört işçiyle
`61,4 sn`de tamamlandı. Toplam `33` gerçek AI eyleminin `28 ALLY / 4 PERSUADE /
1 NEGOTIATE` olması `%84,85` baskınlık ve `REVIEW` verdi. Rol dağılımı
`23 COMMANDER / 7 COMPANY_EXECUTIVE / 2 AGENT / 1 EXECUTIVE`; baskın komutan payı
`%69,70`, yinelenen aktör çifti `0`dır. Bu sonuç seçicinin aynı çifti döndürdüğünü
değil, barışçıl başlangıçta gerçek alan eylemleri dar kalırken çok sayıda ilk
kişisel ittifakın tek mevcut yüksek değerli yol olduğunu gösterir. Global tekrar
cezasını büyütmek veya rastgele kota eklemek reddedildi. Kapanış için Faz 38.9'un
şirket/kurum seçenekleri ve 38.13'ün görev/toplantı çıktıları aynı ölçüme girmeli;
ardından eylem ve rol maruziyeti yeniden değerlendirilmelidir.

**Amaç:** İnsan benzerliğini yalnız “farklı seçim yaptı” gözlemine bırakmamak.
**Çıktı:** Senaryo regresyonları, karşı-olgusal profil testleri, korelasyon/double-count denetimi, uzun dönem davranış dağılımı, gizli neden sızıntı testi, 50+ turluk dil/karar tekrarı ve “neden böyle davrandı?” bilgi filtreli UI.
**Kabul kapısı:** Aynı eylem farklı kaynaklı nedenlerle ayrışabiliyor; farklı profil hiçbir koşul değişmeden kozmetik metin farkına indirgenmiyor; tek eylem/rol uzun koşuda baskınlaşmıyor; oyuncu bilmediği gizli hedefi karar izinden öğrenmiyor; LLM kapalı yol mekanik olarak eşdeğer kalıyor.
**Bağımlılık:** Faz 38.6–38.11 ve ilgili domain adapterleri.

### FAZ 38.13 — Oynanabilir Karakter Etkileşimi ve Resmî Toplantılar

**Amaç:** Sohbeti yalnız metin üreten bir ekrandan çıkarıp karakter ilişkilerinin, görevlerin ve kurumsal kararların oynanabilir giriş kapısı yapmak. Tek kişilik görüşme ile çok kişili resmî toplantı ayrı gerçeklik motorları kurmaz; ikisi de aynı konuşma, inanç, ilişki, yetki, hafıza ve nedensellik defterlerini kullanır.

**Zaman sözleşmesi:** Karakter görüşmesi veya resmî toplantı açıkken dünya saati ilerlemez. Açılışta olay ve katılımcı görünümü aynı dünya anına kilitlenir; pencere kapanınca sohbet öncesindeki duraklatma durumu geri gelir. Konuşma sürerken arka planda savaş, fiyat, olay, görev süresi veya karakter kararı ilerleyemez. Kabul edilmiş sonuçlar tek atomik kapanış fişiyle aynı dünya anına uygulanır; sırf oyuncu uzun düşündü diye bedel doğmaz.

**Tek kişilik görüşme çıktıları:**

- Karakterin oyuncuya bakışı yönlüdür: `karakter → oyuncu` güven, saygı, çekince, borç ve husumet eksenleri konuşmanın anlamlı sonuçlarından etkilenebilir; oyuncunun karaktere bakışı otomatik ve simetrik değişmez.
- Selamlaşma veya aynı cümleyi tekrarlama ilişki çiftçiliği yapamaz. Değişim; gerçek fedakârlık, doğrulanmış yalan, tutulmuş/bozulmuş söz, saygı sınırı, ortak başarı, tehdit veya çıkar çatışması gibi kaynaklı bir olaya dayanır; görüşme/tik başına tavan ve soğuma taşır.
- `GÜNLÜK_SOHBET`, `GÖREV_İŞ`, `GİZLİLİK`, `BİLDİRİM_RAPOR`, `TEKLİF_MÜZAKERE` ve `RESMÎ_TOPLANTI` aynı `ConversationCaseV1` içindeki konuşma kipleridir. Kip değişimi eski konuşmayı silmez.
- Görev/iş kaydı; gerçek veren aktör ve yetki, hedef, kapsam, son tarih, bedel/ödül, kabul durumu, yürütücü ve kaynak olay olmadan üretilemez. LLM görev, para, makam veya emir uyduramaz.
- Oyuncu bildirimi önce `UNVERIFIED_CLAIM`dır. Kaynak, yer, zaman, iddia ve güven ayrı tutulur; karakter inanabilir, şüphelenebilir veya doğrulama işi açabilir fakat iddia dünya gerçeğine dönüşmez.
- Gizlilik isteği garanti değildir. Katılımcı, yasal/kurumsal yükümlülük, mevcut sadakat, korku ve çıkarına göre kabul, sınırlı kabul veya ret verebilir. Gerçek görünürlük matrisi hangi aktörün hangi sözü bildiğini taşır; UI “kayıt altına alındı” ile “gizli kalacağı garanti edildi”yi ayırır.
- Bildirge/resmî açıklama konuşmada taslak olabilir; yayımlanma, imza ve mekanik sonuç ayrı yetki ve medya kapılarından geçer.

**Çok kişili resmî toplantı:** `MeetingCaseV1`; toplantı türü, başkan, gündem maddeleri, zorunlu/davetli katılımcılar, temsil yetkileri, konuşma sırası, açık sorular, öneriler, itirazlar, çekinceler, oylama/onay durumu, özel notlar ve resmî tutanak taşır. Oyuncu herkese hitap edebilir, tek kişiye soru yöneltebilir, söz isteyebilir, itiraz edebilir, önerge sunabilir, oylama isteyebilir, maddeyi erteleyebilir veya ayrı görüşme talep edebilir. Karakterler birbirine cevap verebilir; fakat yalnız kendi `ActorBelief` kayıtlarını, toplantıda duyduklarını ve yetkili oldukları kurumsal kayıtları okuyabilir. Başka katılımcının gizli prompt bağlamı ortak toplantı bağlamına sızamaz.

Toplantı metni mekanik karar değildir. LLM yalnız doğrulanmış `DialogueMoveV1` ve toplantı durumunu doğal Türkçeyle gerçekleştirir. Gündem, söz hakkı, önerge geçerliliği, oy, yetki, görev, sır erişimi ve dünya etkisini deterministik motor belirler. Her katılımcının sözü aktör kimliğiyle kaydedilir; aynı cevap iki karakter adına gösterilemez. Toplantı sonunda `MeetingOutcomeReceiptV1`, kabul/ret/erteleme, muhalefet şerhi, açılan görevler, verilen sözler, gizlilik kapsamı, yönlü ilişki yorumları ve kanonik nedensellik kimliklerini atomik olarak yazar. Tutanak oyuncunun bilmediği özel niyetleri göstermez.

**Arayüz:** Sol katılımcı sütunu birden fazla gerçek karakteri bilinen/bilinmeyen alanlarıyla gösterir; aktif konuşmacı ve düşünüyor durumu görünürdür. Orta akışta konuşmacı adı, hitap edilen kişi, gündem maddesi ve bekleyen soru kaybolmaz. Sağ sütun gündem, açık kararlar, görev/söz/gizlilik kayıtları ve bilgi filtreli tutanağı ayırır. Günlük sohbet resmî toplantı görünümüne zorlanmaz; oyuncu veri tablosu okumadan eylem seçebilir, ayrıntı fare üstü veya dosya görünümünde kalır.

**Kabul kapısı:** Açık pencere boyunca dünya saati byte-byte değişmez ve kapanış önceki duraklatma durumunu geri getirir. En az üç katılımcılı 20 turluk toplantıda konuşmacı/hitap/gündem bağı korunur; özel sır sızıntısı, hayalî yetki, kaynaksız görev ve çift uygulama sıfırdır. Aynı seed ve girişler aynı yapılandırılmış sonucu verir; doğal metin değişse bile mekanik sonuç değişmez. Save/load açık görüşmeyi, taslağı, konuşma sırasını, gündemi ve bekleyen kararı korur. Selam tekrarıyla ilişki büyütülemez; doğrulanmış yalan, tutulmuş söz ve ortak başarı farklı yönlü ilişki fişleri üretir. Toplantı tutanağı yalnız oyuncunun erişebildiği bilgiyi gösterir.

**Bağımlılık:** Faz 9–10.1, 25, 34–38.12; görev/iş için Faz 37–38.10, bildirge ve kamusal yayılım için Faz 39–42.

**15 Ağustos 2026 — ilk uygulama dilimi:** Mevcut tek kişilik görüşme defteri
ikinci bir sohbet motoru açılmadan `ConversationCaseV1` şema-1 omurgasına
yükseltildi. `GÜNLÜK SOHBET`, `GÖREV & İŞ`, `GİZLİLİK`, `BİLDİRİM & RAPOR`,
`TEKLİF & MÜZAKERE` ve `RESMÎ TOPLANTI` kipleri aynı oturumda seçilebilir;
kip geçişlerinin kaynağı ve sırası kalıcı geçmişte tutulur. Takip sözü açık bir
alan taşıyorsa kip bağlamsal olarak değişebilir, sıradan günlük söz ise etkin özel
bağlamı sessizce silemez. Arayüz aktif kipi ve gerçek mekanik olgunluğunu gösterir.
İlk dilimde görev ve resmî toplantı `ADAPTÖR BEKLİYOR` durumundaydı; sistem
hayalî görev, ödül, katılımcı veya toplantı sonucu üretmedi. Şema-3 kayıtları
şema-4 oturum defterine kayıpsız göçer. Hedefli prob; altı UI seçeneğini, önceki
duraklatma halinin geri gelmesini, kip geçmişini, geçersiz kip reddini,
save/restore birebirliğini ve fiziksel dünya+saat değişmezliğini doğruladı.
İkinci dikeyde ilk gerçek `TaskOfferV1` yolu açıldı. Muhatap yalnız kanonik ve
erişilebilir karakter dizininden, oyuncunun mevcut karakter eylem kapısıyla
gerçekten temas edebildiği başka bir karakter için görüşme talebi oluşturabilir.
Veren, üstlenen, hedef, `300 sn` son tarih, kaynak vaka ve yetki biçimi kayıtlıdır.
Bu ilk görev kişisel taleptir (`canCompel:false`) ve gerçek ödül sistemi olmadığı
için açıkça `reward:NONE` taşır. Oyuncu kabul/ret verir; kabulden sonra hedef
karakterle açılan ayrı gerçek görüşme görevi deterministik olarak tamamlar ve
tamamlama oturumunu fişe bağlar. Tekrar teklif açık görevi çoğaltmaz; süre aşımı
görevi kapatır. Görev üretimi, kabulü ve tamamlanması fiziksel dünya veya saat
yazımı değildir. Kurumsal/ücretli görev çeşitleri, çok katılımcılı
`MeetingCaseV1` ve yönlü ilişki sonuç fişleri açık borçtur; Faz 38.13 tamamlanmadı.

**Üçüncü dikey — kaynaklı resmî toplantı kabuğu:** `MeetingCaseV1` şema-1
aynı `ConversationCaseV1` içinde açılır; ayrı sohbet veya konsey gerçekliği
kurmaz. Oyuncunun `8–240` karakterlik gündemi aynen `PLAYER_PROPOSED_AGENDA`
olarak kaydedilir ve resmî karar sayılmaz. Başkan, görünen unvandan değil gerçek
`StoryInstitutions.officeHolder` bağını yayımlayan rol adaptöründen seçilir;
kanonik makam sahibi yoksa toplantı açılamaz. Oyuncu, muhatap, başkan ve gerekirse
aynı ülkenin erişilebilir karakterleriyle en az üç, en çok dört doğrulanmış
katılımcı kurulur. UI tek kişi profilini toplantı kipinde katılımcı listesine
çevirir; başkan, gündem ve etkin söz sırası görünür. Söz sırası deterministik
döner fakat bugün yalnız usul kaydıdır: karakter sözü, önerge, itiraz, oy veya
sonuç üretmez. `motions`, `votes` boş ve `outcomeReceiptId:null` değişmezleri
doğrulanır. Hedefli kabul; sahte gündem reddi, kanonik başkan, 3+ katılımcı,
katılımcı/UI eşitliği, söz sırası, fiziksel dünya+saat nötrlüğü, şema-3 göçü ve
save/restore birebirliğini geçti. Gerçek çok taraflı tur üretimi, bilgi görünürlük
matrisi, önerge/itiraz/oy ve `MeetingOutcomeReceiptV1` sonraki dikeylerdir.

**Beşinci dikey — aktör bilgisiyle kaynaklı görüş:** Karakter toplantı sözü üretirken ham dünya
defterini veya başka katılımcının özel bağlamını okuyamaz. Yalnız konuşmacının tuttuğu, çelişmiş
olmayan, güven eşiğini geçen ve `PUBLIC`/`INSTITUTIONAL` görünürlükteki `ActorBelief` kayıtları
gündem terimleriyle sıralanır. Seçilen inanç ile bağlı `WorldFact` kimliği kamusal turun
`sourceRefs` alanına yazılır; görünür metin bunun karakterin bilgisi olduğunu açıkça söyler ve
kesin dünya gerçeği gibi sunmaz. `PRIVATE` olgu daha yüksek güvenli veya daha güncel olsa bile
otomatik konuşmaya giremez. UI yalnız “kaynaklı görüş / kayıt türü / güven” rozetini gösterir;
teknik kimlikleri ve özel içeriği açmaz. Kaynak kimliğinin turdan çıkarılması doğrulayıcıda
`MEETING_TURNS` ihlalidir. Kaynak yoksa rol tabanlı, açıkça bağlayıcı olmayan usul sözü güvenli
geri dönüş olarak kalır. Ayrıca asenkron model sonucu, oyuncunun odaktaki toplantı taslağını ve
imleç seçimini sıfırlayamaz; gönderim `Ctrl+Enter` ile yapılabilir.

Bu dikey karakterlerin farklı bilgiyle farklı konuşabilmesini başlatır; fakat henüz kanaat
çıkarımı veya gündemdeki teklif lehine/aleyhine tutum hesabı üretmez.

**Altıncı dikey — ikili özel not kanalı:** Oyuncu açık toplantı sürerken yalnız doğrulanmış bir
katılımcıyı seçip kısa bir özel not gönderebilir. `MeetingCaseV1.privateNotes`; yazar, alıcı,
metin, sıra, zaman ve `BILATERAL_PRIVATE` görünürlüğünü taşır. Not kamusal `turns` dizisine ve
ortak transkripte girmez. Her katılımcının `visiblePrivateNoteIds` listesi bağımsız hesaplanır;
yalnız yazar ile alıcı kimliği alır, üçüncü katılımcıya kimlik veya içerik sızmaz. Toplantı dışı
alıcı ve kendine not reddedilir, toplantı başına üst sınır 24'tür. UI bunu kapalı bir ayrıntı
alanında açıkça “kamusal tutanağa girmez” uyarısıyla sunar. Asenkron yeniden çizim koruması bu
metin alanını da kapsar ve `Ctrl+Enter` notu yollar. Bu kanal şimdilik tek yönlü oyuncu eylemidir;
karakterin özel yanıtı, nottan doğan sır/hafıza ve ikili pazarlık sonucu ayrıca kapatılacaktır.

Sıradaki borç, katılımcının kaynakları ile kişiliğinden gündem tutumu çıkarmak; ardından geçerli
önerge, itiraz ve oy kapısını açmaktır.

**Dördüncü dikey — sıra kontrollü çok taraflı transkript ve görünürlük matrisi:**
Toplantı artık yalnız katılımcı listesi değildir. En çok `40` turluk döngü,
kanonik konuşma sırasını zorunlu tutar; oyuncu yalnız kendi sırasında serbest metin
yazabilir, karakter sözü yalnız o karakterin sırasında üretilebilir. Sıra dışı
oyuncu sözü ve katılımcı olmayan muhatap reddedilir. Her tur konuşmacı, muhatap,
tür, kamusal görünürlük, gündem/kaynak referansı ve bilgi politikasıyla kaydolur.
İlk sürümde bütün turlar `MEETING_PUBLIC`tır. Katılımcı başına görünürlük matrisi
aynı kamusal katılımcı/gündem/tur kimliklerini taşır; `privateContextOwnerActorId`
yalnız kendisidir, `mayReadOtherPrivateContext:false` ve `rawWorldRead:false`
değişmezleri doğrulanır. Karakterler henüz mekanik müzakere yapmaz; rolüne göre
yetki ve kanıt sınırını bildiren deterministik usul sözü verir. Aynı karakterin
ilk üç sözünde birebir tekrar engellenir. UI hedef kişi seçimi, oyuncu bestecisi,
karakter konuşma eylemi ve aktör isimli transkripti gösterir. Sekiz turluk kabul;
sıra dışı ret, doğru aktör rotasyonu, kamusal tur eşitliği, özel bağlam yalıtımı,
aynı-aktör tekrar yokluğu ve save/restore bütünlüğünü geçti. Gerçek ActorBelief
zeminli çok taraflı görüş, özel/ikili not, önerge ve oy hâlâ açık borçtur.

Bu yükseltme aktif Faz 38.5'i baştan yazdırmaz. Önce sohbetten sonuca zorunlu mini zincir kapanır. Faz 38.6–38.8 bu zincirin kanıtını genelleştirir; 38.7 ve 38.9 medya Faz 39–42 ile, 38.9–38.11 de sonraki ekonomi/askerî/diplomasi fazlarıyla çapraz ilerleyebilir.

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

## DALGA H.1 — Teknoloji, Yenilik ve Toplumsal Benimseme Yükseltmesi

Bu dalga, dış teknoloji kataloğu analizinin ana plana yükseltilmiş sürümüdür. Yaklaşık `1.300` düğümlük `100 aile × 13 seviye` veri seti nihai motor şeması veya sayı invariant'ı değildir; yalnız içerik taslağıdır. Nihai katalogda aileler eşit derinlikte olmak zorunda değildir. Ana hat, alternatif, deneysel, çıkmaz, niş, eski ve yeniden canlanan teknolojik yollar gerçek bir DAG üzerinde birlikte yaşayabilir.

Temel ayrım:

```text
TEKNOLOJİ TANIMI       Ne yapılabileceğine dair statik bilgi
ARAŞTIRMA İDDİASI      Sınanabilir bilimsel veya mühendislik iddiası
KANIT                  İddianın hangi koşullarda ne kadar desteklendiği
KABİLİYET ERİŞİMİ      Hangi aktör/kurum/şirket/tesisin neyi gerçekten yapabildiği
UYGULAMA                Kabiliyetin hangi sektörde ve amaçla kullanıldığı
KURULU VARLIK           Dünyada gerçekten inşa edilmiş ve çalışan örnek
KURUM/HUKUK             Kullanım, üretim ve transferin yetki/risk sınırı
İNANÇ                   Aktörlerin bütün bunlar hakkındaki kaynaklı tahmini
```

Kanonik dinamik zincir:

```text
TechnologyNodeV2
→ test edilebilir ResearchClaimV1
→ ResearchEvidenceV1
→ CapabilityAccessGrantV1
→ TechnologyApplicationV1
→ ApplicationDeploymentReceiptV1
→ InstalledAssetV1
→ gerçek ekonomik/toplumsal/askerî sonuç
→ WorldFact / ActorBelief / medya ve kültürel geri besleme
```

Mimari değişmezler:

- Teknoloji kataloğunda bulunmak, hiçbir ülke veya aktöre kabiliyet vermez.
- Teknoloji DAG'ı ile kabiliyet grafı aynı şey değildir; aynı kabiliyet farklı teknik yollarla, farklı fiziksel sınırlar altında sağlanabilir.
- Tek bir ülke teknoloji sayacı yoktur. Bilgi araştırma ekibinde, örtük ustalık personelde, hukuki hak şirkette, üretim yeteneği tesiste ve kullanım erişimi ithal varlıkta ayrı tutulabilir.
- Olgunluk elle akan tek yüzde değildir. Bilimsel tekrar, prototip, saha denemesi, hata oranı, pilot hat, yield, hacim, tedarikçi derinliği ve personelden kaynaklı sorgu sonucudur.
- Deney sonucu ile kamuya açıklanan iddia ayrıdır. Bir CEO başarısız sonucu saklayabilir; yalan açıklama dünya gerçeğini değiştirmez fakat ActorBelief, yatırım ve medya davranışını etkileyebilir.
- `Hype` yalnız kaynaklı ve belirsizlik taşıyan ActorBelief'tir. Zeitgeist, Faz 23–42 nüfus/şikâyet/medya/siyaset gerçeklerinden türetilen projeksiyondur; ikinci kamuoyu motoru değildir.
- Kültür araştırmaya doğrudan keyfî hız çarpanı vermez. Bütçe, yetenek göçü, ruhsat, dava, sigorta, talep, kamu satın alımı, protesto ve şirket yatırımı üzerinden etki eder.
- İthalat kullanım erişimidir; yerli üretim kabiliyeti değildir. Lisans, ortak girişim, açık kaynak, casusluk, ele geçirilen örnek ve çalışan transferi farklı kanıt/hak/tesis/personel paketleri üretir.
- `DomainAdapter` dünyaya doğrudan yazamaz. Doğrulanmış komut → maliyet/yetki → makbuz → olay → etki hattını kullanır.
- Uygulama etkisi sabit evrensel bonus değildir. Tesis uyumu, eğitim, bakım, enerji güvenliği, siber güvenlik, lisans, kanıt kalitesi ve teknoloji konfigürasyonundan hesaplanır.
- Teknoloji eskidiğinde kurulu varlık yok olmaz. Eski kömür tesisi, eski batarya kimyası veya eski yazılım gerçek ömür, bakım, retrofit ve tedarik koşullarıyla yaşamaya devam eder; kriz eski yolu yeniden ekonomik yapabilir.
- `EarliestYear` sert kilit değildir. `TemporalPriorV1`, tarihsel kayıt veya `P10/P50/P90`, güven sınıfı ve fiziksel sınır taşır. Düşük güvenli uzun gelecek kesin takvim gibi sunulmaz.
- Statik kataloglar kayda kopyalanmaz. Kayıt yalnız katalog sürüm/checksum, aktif programlar, kanıt, hak/erişim, kurulu varlık, kurum durumu ve seyrek inançları taşır.

İlk kanıt dikeyi bütün kataloğu yüklemek değildir. Yarı iletken/AI/endüstriyel otomasyon zinciri; gerçek araştırma aktörü ve tesis, kanıt, kabiliyet erişimi, mevcut fabrikaya bedelli retrofit, elektronik/sermaye/enerji tüketimi, iş gücü bileşimi, bakım/siber risk, şikâyet, medya çerçevesi ve üç karakterli müzakereyi tek nedensel hat üzerinde kanıtlamalıdır.

### FAZ 42.1 — Kanonik Teknoloji Katalog Sözleşmeleri

**Amaç:** Kimlik, sürüm, checksum, yerelleştirme ve göç temelini kurmak.
**Çıktı:** `TechnologyNodeV2`, `CapabilityDefinitionV1`, `TechnologyApplicationV1`, `InstitutionRuleDefinitionV1`, `AcquisitionPolicyV1`, `TemporalPriorV1`; build-time derleyici.
**Kabul kapısı:** Yinelenen/eksik kimlik, bilinmeyen kural veya kabiliyet, hatalı enum, bozuk sürüm ve checksum uyuşmazlığı sessizce yüklenmiyor. Türkçe görünen adlar makine enumu olarak kullanılmıyor.
**Bağımlılık:** Faz 4–5, 9–10.

### FAZ 42.2 — Teknoloji DAG'ı ve Kabiliyet İfade Derleyicisi

**Amaç:** Eşit seviyeli ağaç yerine alternatif/çıkmaz/niş/yeniden canlanan gerçek DAG kurmak.
**Çıktı:** Güvenli ifade AST'si, önkoşul ve rakip/yedek/revival bağları, aşağı yönlü tüketici reverse-index'i.
**Kabul kapısı:** Döngü, imkânsız önkoşul ve tüketicisi olmayan düğüm raporlanıyor; ifade metni `eval` ile çalıştırılmıyor; aynı kabiliyete birden fazla teknik yol izinli.
**Bağımlılık:** Faz 42.1.

### FAZ 42.3 — Kabiliyet Sahipliği, Erişim ve Örtük Bilgi

**Amaç:** “Ülke teknolojiyi açtı” kısayolunu gerçek sahiplik kapsamına ayırmak.
**Çıktı:** `CapabilityAccessGrantV1`; kişi/ekip/şirket/üniversite/kurum/tesis/ekosistem sahipliği, kaynak, kanıt, hukuki hak, örtük bilgi, üretim erişimi, aktarılabilirlik, geçerlilik ve iptal.
**Kabul kapısı:** Bir şirketteki uzmanlık bütün ülke tesislerine ışınlanmıyor; ithal ürün üretim hakkı vermiyor; personel kaybı örtük kabiliyeti açıklanabilir biçimde düşürebiliyor.
**Bağımlılık:** Faz 21, 34–36, 42.1–42.2.

### FAZ 42.4 — Araştırma Aktörleri, Ekipler, Tesisler ve Programlar

**Amaç:** Her araştırma harcamasını gerçek aktör, ekip, tesis, süre ve hedef iddiaya bağlamak.
**Çıktı:** `ResearchActorV1`, `ResearchTeamV1`, `ResearchFacilityV1`, `ResearchProgramV1`; üniversite, şirket, startup, savunma/devlet laboratuvarı, açık kaynak ve bireysel mucit türleri.
**Kabul kapısı:** Devlet doğrudan yüzde satın almıyor; program kuruyor/fonluyor. Tesis, personel, compute, malzeme ve bütçe yoksa araştırma ilerlemiş sayılmıyor. Aynı program farklı aktörlerde farklı risk ve bilgi paylaşımı üretiyor.
**Bağımlılık:** Faz 20–21, 29–30, 34–35, 42.3.

### FAZ 42.5 — Deney, Prototip, Saha Denemesi ve Kanıt Defteri

**Amaç:** Olgunluğu sayaç yerine kaynaklı ve çelişebilir kanıttan türetmek.
**Çıktı:** `ResearchClaimV1`, `ExperimentV1`, `PrototypeV1`, `FieldTrialV1`, `ResearchEvidenceV1`, bağımsız tekrar ve başarısızlık kayıtları.
**Kabul kapısı:** Tek başarılı deney teknolojiyi kitleselleştirmiyor; bağımsız başarısız tekrar güveni düşürüyor fakat geçmişi silmiyor. Sonuç, yayınlanan iddia ve aktör inancı ayrıdır. Ham rutin kanıt sınırlı özetlenirken dönüm noktası, çelişki, kaza ve sahtekârlık kalıcı tutulur.
**Bağımlılık:** Faz 9–10, 36, 42.4.

### FAZ 42.6 — Patent, Know-how ve Teknoloji Transferi

**Amaç:** Araştırmak, kullanmak, üretmek ve devretmek arasındaki farkı mekanikleştirmek.
**Çıktı:** `PatentOrKnowHowV1`, `LicenseV1`, `TechnologyTransferV1`, `AcquisitionOutcomeV1`; ithalat, lisans, ortak girişim, açık kaynak, personel transferi, casusluk ve ele geçirilen örnek.
**Kabul kapısı:** Her edinim yolu farklı kullanım/hukuk/belge/örtük bilgi/eğitim/tooling/prototip/tesis/risk paketi üretir. Aynı teknoloji bütün yolları otomatik desteklemez; casusluk fabrika veya hukuki hak yaratmaz.
**Bağımlılık:** Faz 18, 21, 35–36, 41–42, 42.3–42.5; yaptırım ve gizli faaliyet genişlemesi Faz 45'te tamamlanır.

### FAZ 42.7 — Teknoloji Uygulamaları ve Güvenli Domain Adaptörleri

**Amaç:** Kabiliyeti tooltip bonusundan gerçek üretim/varlık komutuna çevirmek.
**Çıktı:** Sektör/varlık uygunluğu, inşa ve işletme girdisi, personel/altyapı, bakım, kalite, kaynak, arıza ve `DomainAdapterID`; `ApplicationDeploymentReceiptV1`.
**Kabul kapısı:** Uygulama mevcut tesis üzerinde fiziksel girdi, süre, yetki ve uyum kontrolünden geçiyor; sabit küresel yüzde kullanmıyor; bütün değişiklikler kanonik komut/makbuz/olay hattından geçiyor ve tekrar yükleme çift etki üretmiyor.
**Bağımlılık:** Faz 9–21, 30, 42.2–42.6. Askerî ve diplomatik adaptörlerin nihai kapanışı Faz 43–51'e aittir.

### FAZ 42.8 — Hukuk, Sertifika, Dava, Sigorta ve Teknoloji Kazası

**Amaç:** Yasanın varlığı, yetki, uygulama kapasitesi ve gerçek denetimi ayırmak.
**Çıktı:** Sürümlü `InstitutionRuleDefinitionV1`, jurisdiction/effective-date/supersession; sertifika, enforcement, sorumluluk, sigorta ve olay tabloları.
**Kabul kapısı:** Bilinmeyen RuleID build'i durduruyor. Kâğıt üstü yasa düşük kurum kapasitesinde tam denetim sayılmıyor. Kaza gerçek varlık/işletme koşulundan doğuyor; tek rastgele teknoloji cezası değil.
**Bağımlılık:** Faz 29–32, 39–42, 42.1, 42.7.

### FAZ 42.9 — Benimseme, Yayılım ve Kurulu Taban

**Amaç:** Keşif/prototip/ticarileşme/kitlesel benimseme/normalleşme etiketlerini gerçek dünyadan türetmek.
**Çıktı:** `InstalledAssetV1`, retrofit ve ömür; uygulama+ülke+sektör+kohort kapsamlı kabul sorguları.
**Kabul kapısı:** Katalog düğümü açılınca varlık doğmuyor. Yayılım gerçek satış, tesis, kullanıcı, altyapı, maliyet ve yetkiden geliyor. Hayat kurtaran tıbbi kullanım ile sağlıklı insan geliştirmesi aynı kabul puanını paylaşmıyor. Eski varlık teknoloji değişince yok olmuyor.
**Bağımlılık:** Faz 17–26, 39–42, 42.7–42.8.

### FAZ 42.10 — Teknoloji İnancı, Hype ve Balonlar

**Amaç:** Gerçek olgunluk ile mühendis, şirket, yatırımcı, halk ve istihbarat algısını ayırmak.
**Çıktı:** Kaynak/belirsizlik/çıkar çatışması taşıyan ActorBelief; teknoloji iddiası, yayın, değerleme ve balon/çöküşün sistemik zinciri.
**Kabul kapısı:** Global `Hype=80` alanı yok. CEO'nun açıklaması başarısız deneyi değiştirmiyor; fakat medya ve yatırımcı inancı üzerinden gerçek finansman ve güven sonucu doğurabiliyor. Bağımsız test gerçeği ancak kaynaklı yayılım yoluyla aktörlere ulaşıyor.
**Bağımlılık:** Faz 35–42, 42.5, 42.9.

### FAZ 42.11 — Şirket ve Devlet Araştırma AI'si

**Amaç:** AI aktörlerin kabiliyet açığı, strateji, maliyet, risk, Hype ve bildikleri kanıta göre program/transfer/uygulama seçmesi.
**Çıktı:** Açıklanabilir aday üretici, bütçe portföyü, iptal/devam/eşleme kararları ve deterministik yedek.
**Kabul kapısı:** AI en ileri yıl etiketini körlemesine seçmiyor; bilmediği gizli kanıtı okumuyor; başarısız programı koşul değişmeden sonsuza dek fonlamıyor; şirket ve devlet aynı bütçe/amaç sahibi gibi davranmıyor.
**Bağımlılık:** Faz 22, 38, 42.3–42.10. Şirket seçicisi bu fazda; tam ulusal strateji entegrasyonu Faz 55–58'de kapanır.

### FAZ 42.12 — Oyuncu Teknoloji Çalışma Alanı

**Amaç:** Oyuncuya ham 1.300 satır yerine neden/kanıt/erişim/uygulama/tüketici zinciri ve yetkili eylem sunmak.
**Çıktı:** Alan görünümü, teknoloji dosyası, aşağı yönlü tüketici grafı, program/aktör/tesis/kanıt/lisans/uygulama/kurulu taban ve belirsizlik kartları.
**Kabul kapısı:** Oyuncu “EUV şu an neden önemli?”, “kim biliyor?”, “neden üretemiyorum?”, “hangi kanıta güveniyorum?” ve “hangi bedelli eylemi yapabilirim?” sorularını bulabiliyor; rolü dışında gizli şirket veya devlet bilgisi sızmıyor.
**Bağımlılık:** Faz 4.1, 10.1, 38.5, 42.1–42.11, 59–60 tam rol görünümünde genişletilir.

### FAZ 42.13 — 2032 Tarihsel Teknoloji Başlangıç Dünyası

**Amaç:** Mevcut `2032` oyun başlangıcını 2010–2031 kaynak geçmişinden türetilmiş makul teknoloji dünyasıyla başlatmak.
**Çıktı:** Başlangıç programları, kanıtlar, patent/lisanslar, şirket/kurum kabiliyet erişimleri, tesis konfigürasyonları, kurulu taban ve kaynaklı aktör inançları.
**Kabul kapısı:** 2010 oynanabilir başlangıç olarak zorla getirilmez; 2010–2031 arka planı 2032 seed'ini açıklar. Ülkeler aynı evrensel teknoloji seviyesine sahip değildir; tarihsel kaynak ve belirsizlik ayrıdır.
**Bağımlılık:** Faz 42.1–42.12.

### FAZ 42.14 — 2032–2100 Uzun Dönem Teknoloji Çeşitliliği

**Amaç:** Teknolojinin tek gelecek yoluna ve oyuncunun tek baskın açılışına yakınsamasını önlemek.
**Çıktı:** Çok tohumlu uzun koşu, teknoloji/uygulama/kurulu taban parmak izi, AI/yeşil/transhümanist/kurumsal/gözetim/uzay/post-emek/dağıtık/biyo/sanal/insancıl gelecek kümeleri.
**Kabul kapısı:** En az 100 on-yıllık kampanya aynı 2050/2100 kabiliyet, uygulama ve kurulu taban bileşimine yığılmıyor; farklılık yalnız isim değil gerçek ekonomi, toplum, kurum, medya ve varlık sonucudur. Hilesiz AI ve oyuncu aynı fiziksel kurallara tabidir.
**Bağımlılık:** Faz 42.1–42.13, Faz 55–58.2 ve tam dünya entegrasyonu sonrası nihai kabul.

### Açık teknoloji borçları

- `100 × 13 = 1.300` eski katalog yalnız içerik kaynağıdır; `TechnologyNodeV2` DAG'ına aile bazında yeniden yazılmalı ve her düğüm tarihsel/teknik kaynak denetiminden geçmelidir.
- İlk kodlama bütün katalog değil, yarı iletken–AI–otomasyon mini dikeyidir. Bu dikey geçmeden içerik sayısı başarı sayılmaz.
- `ResearchEvidenceV1`, `CapabilityAccessGrantV1` ve `ApplicationDeploymentReceiptV1` uygulama öncesi kesin şemaya bağlanmalıdır.
- Kanıt defteri için budama/toplulaştırma, negatif tekrar ve tarihsel dönüm noktası saklama politikası gereklidir.
- Kabiliyet seviyesi enerji yoğunluğu, güvenlik, maliyet veya sıcaklık gibi fiziksel olarak farklı boyutları tek puanda yanlış eşitlememelidir.
- Uygulama kuralındaki serbest `GameplayResult` metinleri makine etkisi değildir; domain adaptörü ve doğrulanmış makbuz gerekir.
- Bütün edinim yollarının her düğümde açık olması yasaktır; teknolojiye özgü edinim politikası ve farklı çıktı paketi gerekir.
- Hukuk/ruhsat string'leri kanonik RuleID kataloğuna taşınmalıdır; yetki, yürürlük ve enforcement kapasitesi ayrılmalıdır.
- Hype ve kültürel iklim Faz 39–42 medya gerçeklerinden beslenmelidir; teknoloji modülü paralel medya veya kamuoyu gerçeği üretmemelidir.
- Statik katalog kayda yazılmamalı; sürüm/checksum göçü ve bozuk/eksik katalog güvenli reddi zorunludur.
- Yalnız aktif program, değişen uygulama, yeni kanıt ve seyrek inanç tik almalıdır; `1.300 × aktör × her tik` taraması yasaktır.
- Askerî teknoloji, bonus etiketiyle taktik motoru değiştirmemeli; Faz 47–50 manifestosu ve aynı savaş motoru sözleşmesi üzerinden ekipman/kabiliyet taşımalıdır.

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

## Faz 38.5 yükseltmesi — Bileşimsel anlam ve yetkisiz LLM yorumlayıcı

Serbest sohbet, tam cümleleri kapalı niyet etiketlerine tek tek bağlayan bir
kalıp listesiyle tamamlanamaz. Üretim mimarisi `SemanticFrameV1` kullanacaktır.
Bir oyuncu sözü bağımsız konuşma işlevi, yüklem/konu, hedef, kutupluluk, zaman,
bilgi durumu, konuşma devamlılığı ve beklenen sonuç eksenlerine ayrılır. Bu
eksenlerin çarpımı milyonlarca yüzey cümlesini sonlu bir karar uzayına taşır.
Ontoloji kökleri kavramları gösterir; tam oyuncu cümleleri üretim kuralı değil
yalnız regresyon verisidir.

Deterministik derleyici yüksek güvenli açık örnekleri çözer. Düşük/orta güvenli
sözlerde paketli 8B ilk canlı kapıda kapalı enumlardan tek en-iyi
`SemanticFrameCandidate` önerir; daha büyük öğretmen çevrimdışı birden fazla
karşıt aday üretebilir. Modelin verdiği her kanıt aralığı oyuncunun gerçek metninde
bulunmalı, varlıklar kanonik çözümleyiciden geçmeli ve nihai konuşma hareketini
kod yeniden hesaplamalıdır. Model dünya gerçeği, sayı, ilişki puanı, yetki,
görev varlığı veya komut üretemez.

Çalışma sırası:

- `38.5-SF1`: bileşimsel deterministik çerçeve, legacy puanlayıcıyla kontrollü
  füzyon ve çarpım testleri;
- `38.5-SF2`: düşük güven için asenkron 8B semantik aday çağrısı, kanıt-span
  doğrulaması, `CHARACTER_THINKING` yaşam döngüsü ve güvenli fallback;
- `38.5-SF3`: 14B öğretmenin yalnız karşıt/parafraz veri üretmesi, insan-log
  holdout'u ve 8B/14B kör karşılaştırması;
- `38.5-SF4`: yeterli veri oluşursa küçük yerel çok-kafalı sınıflandırıcıya
  distilasyon; mekanik eşitlik ve aynı EXE kapısı değişmez.

Kabul ölçüsü “kaç ifade kalıbı eklendi?” değildir. Daha önce görülmemiş bileşim,
parafraz, yazım bozukluğu, konu değişimi ve bilinen/bilinmeyen varlık karışımında
eksen doğruluğu; `UNKNOWN` oranı; yanlış yüksek güven; kanıt dışı yorum; dünya
mutasyonu ve doğal görüşme kalitesi ayrı raporlanacaktır.

**14 Ağustos SF2 ara kararı:** Asenkron yaşam döngüsü, JSON grammar, atomik
oturum geri alma, kanıt/ek-alan/yetki enjeksiyonu reddi ve DialogueMove yeniden
kurulumu hedefli testte geçti. Gerçek Turkish-Llama 8B/CUDA kapısı ise dört
görülmemiş cümlede yalnız `1/4` güvenli-doğru sonuç verdi. Yanlış `CONFIDE ×
EMOTION` birleşimi çapraz alan kapısıyla reddedildi; metinde bulunmayan “benim”
kanıtı da atıldı. Eşik gevşetilmedi. `characters.semanticModelInterpretation`
üretimde varsayılan kapalıdır; SF3 öğretmen/distilasyon kapısı geçmeden oyuncu
sohbetine otomatik bağlanmayacaktır.

**14 Ağustos SF3 ara kararı — dolaylı eylem ve eksen-maskeli öğretmen:** Aynı
dört kör cümlede Qwen2.5-Coder 14B sıkı doğrulayıcıyla `3/4` verdi; 8B'nin
`1/4` sonucundan belirgin biçimde iyidir. Buna rağmen çevrimiçi kullanım için
uygun değildir: RTX 4060/CUDA üzerinde yükleme yaklaşık `10,2 sn`, ilk token
`1,6–8,2 sn`, tek semantik çıktı `37–41 sn` sürdü. Rolü yalnız çevrimdışı
öğretmen adayıdır.

İlk üretici+kör-hakem deneyi temel bir ontoloji kusuru gösterdi. “Yarın burada
olabilir misin?” dilbilgisel olarak soru, pragmatik olarak eylem isteğidir.
`SemanticFrameV2` bu nedenle `surfaceForm` (INTERROGATIVE/DECLARATIVE/
IMPERATIVE/EXCLAMATORY/FRAGMENT) ile `communicativeFunction`ı ayırır. Dolaylı
istek artık `INTERROGATIVE × REQUEST × WORK × ACTION` olarak temsil edilir;
tek bir ASK etiketine çökmez.

SF3 veri kabulü bütün çerçevede ya hep ya hiç değildir. 14B hedef bileşimden
doğal söz üretir; hedefi görmeyen ikinci 14B aynı sözü yeniden etiketler.
Çekirdek `communicativeFunction + surfaceForm + predicate` mutabakatı zorunludur.
Yalnız uyuşan yan eksenler eğitim etiketi alır; hedef, zaman, epistemik durum
veya devamlılık uyuşmazsa o eksen maskelenir. İki görevlik ilk V2 smoke'ta
çekirdek `2/2`, dokuz eksende tam mutabakat `0/2`dir. Bu küçük smoke genelleme
kanıtı değildir. 60 görevlik dengeli manifest hazırdır; geniş holdout,
doğallık denetimi, yanlış-yüksek-güven ve insan-log ayrımı açık borçtur.

**14 Ağustos SF3 sekiz-bileşim kırmızı kapısı:** Sekiz temel bileşimin gerçek
14B üretici+kör-hakem koşusu tamamlandı. Çekirdek mutabakat `4/8`, tam dokuz
eksen mutabakatı `0/8`, otomatik eğitim uygunluğu `0/8`dir. Eksen doğrulukları:
işlev `%62,5`, yüzey biçimi `%50`, konu `%62,5`, hedef `%25`, kutupluluk
`%62,5`, zaman `%50`, epistemik durum `%12,5`, devamlılık `%25`, beklenen sonuç
`%50`. Bu oranlarla 60 görevlik üretim başlatılmaz.

Türkçe 8B bağımsız kalite eleştirmeni sekiz sözün beşini geçirdi, fakat zayıf
“bir şey” ilişki kanıtını ve yapay meta-oyun cümlesini de onayladı; üç çıktıda
`false` kararına rağmen `issues:["NONE"]` üretti ve şema kapısında reddedildi.
Yerel LLM'ler bundan sonra sentetik çeşitlilik/adversary kaynağı olabilir,
hakikat veya tek başına eğitim kabul kaynağı olamaz.

Bu deneyden üretime alınan şey sentetik veri değil dilbilgisel operatördür.
Türkçe yeterlilik eki `-abilir/-ebilir` ile kişi sorusu bileşimsel işlenir:
“yardımcı olabilir misin?” `INTERROGATIVE × REQUEST`; “birlikte çalışabilir
miyiz?” `INTERROGATIVE × OFFER` olur. ASK adayında `epistemicStatus=QUESTIONED`
zorunludur; TELL/CORRECT ile beklenen sonuç çapraz kapıları sertleştirilmiştir.
Tam cümle eklenmemiş, üretken dil yapısı eklenmiştir.

**SF3 gece koşusu giriş kapısı:** Gece eğitimi süreye veya kullanıcı komutuna
göre koşmaz. Yerel `127.0.0.1:4318` inceleme kuyruğunda en az 40 insan-onaylı
altın örnek ve üretimden ayrı en az 20 holdout bulunmalıdır. Holdout çekirdek
doğruluğu `≥%85`, kanıt doğruluğu `≥%95`, doğal Türkçe `≥%90`, yanlış yüksek
güven `≤%2` olmalıdır. `story:semantic-night-gate` bu koşullardan biri eksikse
`NIGHT_TEST_BLOCKED` üretir. İlk gerçek ölçüm `0/40` altın ve `0/20` holdout
olduğu için gece eğitimi başlamamıştır. Model kararı insan onayı yerine geçmez.

**İnsan incelemesinden çıkan V3 semantik borcu:** `predicate=EMOTION` oyuncunun
ne hakkında konuştuğunu söyler, karaktere nasıl davrandığını söylemez. Ayrı
`socialStance` ekseni gerekir: `NEUTRAL`, `AFFILIATIVE`, `COMPLAINT`, `INSULT`,
`FLATTERY`, `THREAT`, `PROVOCATION`, `APPEASEMENT`. Bu eksen konuşma konusunu
değiştirmez; ilişki tepkisi, karakter sınırı ve üslup sonucunu değiştirir.
Örneğin ekonomik konuda hakaret hâlâ ECONOMY yüklemidir fakat `INSULT` tavrı
taşır. V3 uygulanmadan günlük yakınma/hakaret örnekleri altın veri sayılmaz.

Altın veri tek insan düğmesiyle oluşmaz. V2 insan kararı ile bağımsız QA
adjudikasyonu aynı örneğin işlev+biçim+konu çekirdeğinde uyuşmalıdır. İlk sekiz
örnekte insan `3` kabul, QA `3` çekirdek kabul verdi; güvenilir kesişim yalnız
`2` örnektir. “Çalışalım” gibi birinci çoğul çağrı ayrıca mevcut
INTERROGATIVE/DECLARATIVE/IMPERATIVE ayrımına sığmadı; `HORTATIVE` yüzey biçimi
SemanticFrameV3 borcuna eklendi.

Eğitim kapısı kırmızı kalırken gece donanımı boş bırakılmaz: 14B oyuncu ve 8B
karakterle `25 oturum × 40 tur = 1000` adversarial konuşma yalnız ölçüm modunda
çalışabilir. Bu koşu model veya oyun kaynağı değiştirmez; yalnız atomik
checkpoint ve ham rapor yazar. Rapor insan/QA incelemesi görmeden hiçbir örnek
eğitim verisine alınmaz.

Gece ölçümünün gerçek kapsamı iki aşamadır: `25×40=1000` tur kalibrasyon,
ardından başka senaryo aralığında `30×50=1500` tur uzun-bağlam
dayanıklılığı. Toplam `2500` turdur. İkinci aşama ilk tamamlanmış raporu atomik
olarak doğrulamadan başlamaz; 12 saat içinde kalibrasyon bitmezse sessizce
devam etmek yerine açık timeout durumu yazar.

**15 Ağustos gece ölçümü düzeltmesi:** İlk `100×10` koşusunun `802` hata
sayısı model kusuru diye kullanılamaz. Bunların `626` tanesi, kanonik görüşme
defterinin `32` oturum sınırı aşılınca ilk 68 oturumu budaması nedeniyle
`SESSION_NOT_FOUND` olmuştur. Koşucu artık 32 üzerini model yüklemeden reddeder,
oluşturulan bütün oturumların defterde yaşadığını doğrular ve altyapı hatasını
oyuncu üretim hatasından ayrı raporlar. Eski 1000 rapor tarihsel kırmızı kanıt
olarak korunur; kalite tabanı değildir.

Uzun koşu `30×50` sözleşmesine uyduğu için kapasite hatası üretmedi; `510/1500`
turda tekrar dağılımı doygunlaşınca ölçüm bilinçli durduruldu. Bu kesitte 193
oyuncu üretim hatası, 317 geçerli oyuncu sözü, 181 deterministik cevap, 42 kabul
ve 94 model fallback'i vardır. Açık sorunlar: 14B oyuncu biçim şablonuna çöküyor;
8B karakter geçmiş/fallback cümlesini tekrarlıyor ve yer yer yarım cevap
üretebiliyor. Bu veri eğitim için uygun değildir.

İlk düzeltme dilimi örnek cümle ankrajlarını prompttan çıkardı, retry sırasında
reddedilen cümleyi modele yeniden göstermeyi bıraktı, çağrı tohumlarını ayırdı ve
ayrı konuşma alanlarının mikro-batch kirlenmesini engelledi. Karakter modeli artık
hazır fallback metnini değil yapısal cevap sözleşmesini görür. Dört cümlelik
doğal oyuncu tepkisi kabul edilir; 300+ karakterde noktalamasız kesilen cevap
`TRUNCATED_REPLY` olur. Aynı iki gerçek GPU senaryosunda oyuncu üretim hatası
`1→0`, altyapı hatası `0`; önce kabul edilen kesik 8B cevap güvenli fallback'e
döndü. Bu yalnız hedefli düzeltme kanıtıdır; genel sohbet kalite kapısı hâlâ
kırmızıdır.

Smoke ayrıca konu ile konuşma eylemini ayıran yeni bir bileşim açığı buldu:
`gizli operasyon` yalnız SECRET konu sözcüğü taşıdığı için sır paylaşımı
sayılıyordu. Artık `CONFIDE` için paylaşma/verme/gizli tutma eylem kanıtı
zorunludur; operasyon hakkındaki heyecan veya kaygı `TELL×EMOTION` kalır. Gerçek
“gizli bilgi vereceğim” ve “aramızda kalsın” yolları korunmuştur.

**Faz 38 konuşma kanıtı borcu — kapsam sahipliği:** `RECENT_TURN`, `FACT` ve
`MEMORY` birbirinin yerine kullanılamaz. Önceki turdaki doğrulanmış sayı bile
yeni turun `DialogueMove.allowedRefs` listesinde yoksa yeniden ileri sürülemez.
Şirket finansmanı ülke makro göstergeleriyle cevaplanamaz; şirket bilançosu için
ayrı kanonik şirket adaptörü gerekir. Resmî toplantı gündemi, katılımcı, karar ve
sonuç da sohbet geçmişinden türetilemez; toplantı defteri oluşana kadar motor
“kayıt yok” sınırını açıkça korur. Aynı oturumun devamı yeni görüşme değildir;
karakter ortada yeniden selamlayamaz veya geçmiş tanışıklık icat edemez.

**Faz 38 kanıtsız bilgi politikası:** Model içerik kaynağı değildir. Güncel
`DialogueMove` hiçbir FACT/MEMORY taşımıyorsa ve motor soruyu bilgi isteği olarak
anladıysa 8B'den dünya cevabı istenmez; deterministik bilgi sınırı gösterilir.
Medya, nüfus, şirket veya resmî toplantı katmanı ileride kanonik kayıt açtığında
aynı soru otomatik olarak kaynaklı cevap yoluna geçmelidir. Özellikle modern
medya için haber kimliği, yayın zamanı, görünürlük sınıfı ve karakter erişimi
FACT adaptörüne bağlanmadan `SUPPORTED_PUBLIC` kabulü verilmez.
