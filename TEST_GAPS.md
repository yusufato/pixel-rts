MODE: AUDIT

### 1) Coverage Verdict

Mevcut hedefli oyuncu-eylemi (18/18), altyapı/lojistik (20/20) ve gerçek Electron
UITEST kendi dar sözleşmelerinde değerli kanıt sağlıyor; ancak hikâye modunun
baştan sona yaşam döngüsü güvenle kapsanmış değil. En büyük üç risk: gerçek
Electron saldırı → savaş → sonuç → ödül → kayıt/devam zincirinin hiçbir testte
çalışmaması, kayıp/beraberlikten ödül alma açığının test edilmemesi ve sonuç
kaydındaki pendingReward durumunun devam akışında yeniden açılmaması. Ekonomi
tarafında mevcut ticaret probu, gümrük gelirlerinin kimden tahsil edildiğini veya
toplam para korunumunu ölçmeden geçiyor. **Test temeliyle birleştirme kararı:
No.** Kritik yaşam döngüsü ve ekonomik korunum için kırmızı regresyonlar
yazılmadan yeşil paketler sürüm güveni sağlamıyor.

### 2) Untested Behavior Map

| Yüzey | Mevcut test | Gerçekte kanıtlanan | Boşluk | Risk |
|---|---|---|---|---|
| Menü -> kurulum -> karakter -> dünya | Parçalı unit/probe | Alt kurucular ve bazı durum alanları | Gerçek UI ile tam giriş yolu yok | Medium |
| Savaş başlatma | Tam sim harness | Yok; `storyLaunchBattle` no-op stub | Havuz tüketimi, geçersiz hedef, savaş ekranına geçiş | High |
| Savaş sonucu | Telemetri probu | Sayaç/sürüm/tohum | Sahiplik, kaynak, ödül uygunluğu ve dünya dönüşü | High |
| Kampanya yenilgisi | Tam sim harness | Yok; `storyCheckPlayerDefeat` daima false | Son bölge kaybı ve gerçek game-over | High |
| Ödül ekranı | Parçalı fonksiyon yolu | Kazanç uygulaması | Kayıp/beraberlik uygunluğu ve tekrar talep | High |
| Kayıt/devam | Saat ve scheduler probları | Deterministik saat/devamlılık | `pendingReward` UI'sinin yeniden açılması | Medium |
| Gerçek Electron hikâye yaşam döngüsü | UITEST + BATTLETEST + PLAYTEST | Kurulumdan dünyaya giriş, ayrı Hızlı Maç motoru, savaşsız yıllar | Hikâye hedefi seçimi, gerçek deploy/battle sonucu, ödül, save ve yeni runtime continue tek zincirde hiç çalışmıyor | High |
| UITEST görsel kanıtı | capturePage PNG'leri + DOM görünürlük | DOM ekran adı ve kutu boyutu | Compositor boyası beklenmediği için PNG bir önceki ekranı gösterebiliyor | Medium |
| MAPTEST kabul güvenilirliği | Harita Electron testi | Sabit render/etkileşim süreleri ve birçok harita sözleşmesi | Ölü border sayacı, hiç doldurulmayan taşıt örnek dizisi ve beklenmeyen hover rAF üç yanlış başarısızlık üretiyor | Medium |
| Karakter aktivasyonu | Scheduler probu | Kayıt/periyot + dolaylı alanlar | Metadata sırası runtime sırası sanılıyor | Medium |
| Dış ticaret vergileri | tradeProbe | Satış escrow'u, teslimat ve mülkiyet aktarımı | Vergi ödeyeni ve ekonomi toplamı korunumu | High |
| Zafer/başarı sonu | Bulunamadı | Yok | Ürün kararı olmadan test sözleşmesi kurulamaz | Needs decision |

### 3) Findings (Prioritized)

## TG-01 — Tam hikâye harness'ı savaş girişi ve yenilgiyi devre dışı bırakıyor

- **Kategori:** False Confidence
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** `tools/story-sim-harness.js:297-299`
- **Kanıt:** `storyLaunchBattle` ve `storyLaunchDefense` no-op; `storyCheckPlayerDefeat` sürekli false.
- **Neden önemli:** 88/88 sonucu bile gerçek kampanya bitişini veya savaş girişini kanıtlayamaz.
- **Öneri:** Gerçek bağlayıcılarla ayrı bir yaşam-döngüsü entegrasyon paketi kur; stub kullanılan paketi dünya-simülasyonu paketi diye adlandır.
- **Trade-off:** Test kurulumu ağırlaşır; fakat en kritik sınır gerçek kodla çalışır.

## TG-02 — Kayıp ve beraberlik ödülü için regresyon yok

- **Kategori:** Untested Shipped Behavior
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** `js/Story.js` savaş sonucu/ödül akışı, savaş sonuç UI'si
- **Kanıt:** Doğrudan runtime tekrarında loss, draw ve win için `storyClaimReward('logistics')` başarılı oldu. Sıfır öldürmeli kayıp/beraberlikte petrol +150, insan gücü net +120 ve puan +150 oluştu.
- **Neden önemli:** Oyuncu kaybederek kaynak üretebilir; ekonomi ve savaş riskini tersine çevirir.
- **Öneri:** Ürün sözleşmesine göre yalnız zaferde ödül veya sonuç türüne göre açıkça ölçekli ödül testi ekle.
- **Trade-off:** Mevcut oyuncu kayıtlarının bekleyen kayıp ödülü için göç/uyumluluk kararı gerekir.

## TG-03 — Bekleyen ödül kayıt/devam akışı kapsanmıyor

- **Kategori:** Gap
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** savaş sonu kayıt, `storyContinue`, `pendingReward`
- **Kanıt:** Savaş sonucu `pendingReward` ile kaydediliyor; devam dünya görünümüne giriyor ve bekleyen sonuç ekranını yeniden açan ikinci bir yol bulunamadı.
- **Neden önemli:** Sonuç ekranında kapanma/çökme ödülü erişilemez bırakabilir; sonraki savaş eski kaydı örtebilir.
- **Öneri:** Save -> yeni runtime -> continue testinde sonuç ekranı veya güvenli telafi akışını doğrula.
- **Trade-off:** Devam UX'i için ürün kararı gerekir.

## TG-04 — Son bölge kaybı mesajı ile yenilgi kuralı çelişiyor

- **Kategori:** Gap / Behavioral Contract
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `storyOnBattleEnd`, `storyCheckPlayerDefeat`
- **Kanıt:** Güvenli şehir kalmayınca mesaj komşu şehri geri alarak toparlanmayı söylüyor; sonraki hikâye adımı sıfır bölge nedeniyle kampanyayı bitiriyor.
- **Neden önemli:** UI mümkün olmayan bir toparlanma yolu vaat ediyor.
- **Öneri:** “hemen yenilgi” veya “sürgünden geri dönüş” sözleşmesini seçip iki yolu karşılıklı dışlayan testlerle sabitle.
- **Trade-off:** İkinci seçenek yeni oyun tasarımıdır, bugfix kapsamını aşar.

## TG-05 — Geçersiz savaş hedefi guard'dan önce dereference ediliyor

- **Kategori:** Gap
- **Önem:** Low
- **Güven:** Confirmed
- **Konum:** `storyLaunchBattle`
- **Kanıt:** `storyState(node.owner)`, `if (!node ...)` kontrolünden önce çalışıyor.
- **Neden önemli:** Bozuk kayıt, geliştirici komutu veya gelecekteki UI yarışı kontrollü false yerine exception üretir.
- **Öneri:** Geçersiz hedef testinde exception olmadan false bekle.
- **Trade-off:** Çok küçük; iç çağrıların bugün hedef doğruladığı varsayımını sağlamlaştırır.

## TG-06 — Karakter aktivasyon testi davranış yerine metadata ölçüyor

- **Kategori:** False Confidence
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `tools/story-sim-harness.js:16183`
- **Kanıt:** RCA.md'deki deterministik izole tekrar ve callback sırası incelemesi.
- **Neden önemli:** Doğru runtime kırmızı görünür; yanlış bir “düzeltme” gerçek sırayı bozabilir.
- **Öneri:** Kayıt/periyot ve gerçek callback trace assertionlarını ayır.
- **Trade-off:** Harness gözlem altyapısında küçük değişiklik.

## TG-07 — Ticaret probu gümrük gelirinin kaynağını ve para korunumunu ölçmüyor

- **Kategori:** False Confidence / Untested Shipped Behavior
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** storyTradeProcessCustomsAndTariffs, tradeProbe, bütçe/escrow mutabakatı
- **Kanıt:** Prob 1/1 geçerken 1,26 kargo değeri için alıcı ve satıcı devletlere toplam 0,2142 nakit kredilendi; alıcı escrow'u yalnız 3 satış bedelini tuttu ve satıcı şirket 3'ün tamamını aldı.
- **Neden önemli:** Her yabancı teslimat ithalat/ihracat tarafında açıklanmayan para üretir. Transit yüzde 2 dalı ise kanonik koridor sahiplik alanı olmadığı için çalışmıyor; geçen test iki kusuru da ayırmıyor.
- **Öneri:** Devlet + şirket + escrow + clearing toplamını önce/sonra eşitleyen, her vergi geliri için ödeyen hareketini zorunlu kılan entegrasyon testi ekle.
- **Trade-off:** Meşru para ihracı ve dış akış fixture'larda açıkça etiketlenmelidir.

## TG-08 — Seçim probu oynanabilir EXECUTIVE makam devrini kapsamıyor

- **Kategori:** False Confidence / Cross-ledger Gap
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** electionProbe, StoryElections, StoryInstitutions, StoryCharacters
- **Kanıt:** EXECUTIVE kampanyasında seçim Bora Demirel'i yürütme mandatına getirdi; kurum officeHolder ve governance yetkisi character:0:0 oyuncusunda kaldı. Mevcut electionProbe varsayılan COMMANDER rolüyle yalnız seçim defterini ölçüyor.
- **Neden önemli:** Seçim kaybetmenin oyuncu makamı ve yetkisi üzerinde sonucu yok; barışçıl iktidar devri oyuncu için sahte kalıyor.
- **Öneri:** EXECUTIVE incumbent ile kazanma ve kaybetme fixture'ları kur; election holder, institution holder, career binding ve governance permission aktörlerini eşitle.
- **Trade-off:** Seçim kaybında oyuncunun yeni rolü için ürün kararı gerekir.

## TG-09 — Governance probu yanlış başkan görünümüyle yeşil geçiyor

- **Kategori:** Vacuous / Missing Assertions
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** governanceProbe, storyGovernancePlayerView önbelleği, story-test-manifest
- **Kanıt:** Saklanan geçen sonuçta president.role GENELKURMAY BAŞKANI ve holdsExecutive=false iken publicWorksAllowed=true. Manifest governanceProbe için requiredTrue alanı tanımlamıyor.
- **Neden önemli:** Makam görünümü ile gerçek eylem yetkisi birbirini tutmazken test başarı raporluyor.
- **Öneri:** Kurum sahibini değiştiren her transition sonrası cache geçersizliğini ve role/heldInstitutions/action permission tutarlılığını zorunlu assertion yap.
- **Trade-off:** Görünüm cache anahtarı gerçek kurum revizyonuna bağlanmalıdır.

## TG-10 — Siyasi kriz probu başarılı darbede makam devrini ölçmüyor

- **Kategori:** False Confidence / Cross-ledger Gap
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** politicalCrisisProbe, StoryPoliticalCrisis, StoryInstitutions
- **Kanıt:** Prob `SUCCESS/GOVERNMENT_SEIZED`, hafıza ve kriz defteri doğrulamasını yeşil geçiriyor. Aynı fixture'da kriz lideri `character:0:1` iken kurum EXECUTIVE sahibi `character:0:president` Demir Aydoğan kaldı; kurum validatorü yine `ok=true` döndü.
- **Neden önemli:** Darbe başarı mesajı ve legacy lider bayrağı değişse de gerçek kurumsal yetki kriz liderine geçmiyor.
- **Öneri:** Başarılı, başarısız ve `SPLIT` kriz fixture'larında kriz lideri, institution holder, election mandate, career binding ve governance permission sahiplerini açık transition politikasına göre doğrula.
- **Trade-off:** Darbe sonrası seçim mandatının iptal/askı durumu ve oyuncunun yeni rolü ürün kararı gerektirir.

## TG-11 — Şirket kredi testleri kurul yoluyla PlayerAgency yolunu karşılaştırmıyor

- **Kategori:** False Confidence / Competing Command Paths
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** companyProbe, characterRoleAdaptersProbe, story-player-agency.test, StoryCompanies, StoryPlayerAgencyBindings
- **Kanıt:** Aynı `COMPANY_OWNER` ve şirket için yönetim teklifi CFO eksikliğiyle `BOARD_APPROVAL_MISSING/economicMutation=false` kaldı; PlayerAgency aynı anda 75 krediyi doğrudan uygulayıp nakdi +75, borcu −75, banka rezervini −75 değiştirdi.
- **Neden önemli:** Oyuncunun kullandığı yüzeye göre şirket yönetim kuralları değişiyor; kurul sözleşmesi kolayca atlanıyor.
- **Öneri:** UI, karakter/konuşma, AI ve PlayerAgency yollarını tek `CompanyLoanCommand` precondition/authorization hattına bağlayan çapraz-yol testi ekle.
- **Trade-off:** Kurulun gerçekten zorunlu olup olmadığı ve tutar eşikleri ürün kararıdır.

## TG-12 — Şirket probu iflas sonrası eylem kapılarını sınamıyor

- **Kategori:** Untested Shipped Behavior / Lifecycle Gap
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** probeCompaniesBanks, storyCompanyRequestLoan, storyCompanyTick
- **Kanıt:** Prob yalnız işletme hâlindeki şirkete 100 kredi veriyor. Gerçek runtime'da `BANKRUPT/DISSOLVED/REVOKED` ve 12 tesisi `RECEIVERSHIP` olan şirket 10 yeni kredi çekip geçerli defter üretti.
- **Neden önemli:** Tasfiye şirket faaliyetini kapatmıyor; oyuncu ölü tüzel kişilik üzerinden bankayı kullanabiliyor.
- **Öneri:** OPERATING→INSOLVENT→BANKRUPT zincirinde kredi, lobi, yatırım, üretim, sözleşme, başvuru ve karakter yetkilerinin beklenen kapılarını tablo testiyle doğrula.
- **Trade-off:** Kayyım finansmanı veya yeniden yapılandırma istenecekse ayrı komut ve açık yetki gerekir.

## TG-13 — Şirket sahibi rol testi oyuncunun pay defterindeki sahipliğini ölçmüyor

- **Kategori:** False Confidence / Semantic Contract Gap
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** characterIdentityProbe, StoryCharacters, StoryCharacterRoleAdapters, StoryCompanies owners
- **Kanıt:** Test `organizationId` ve Yönetim Kurulu Başkanı unvanını “gerçek şirket sahibi” kanıtı sayıyor. Runtime pay defterinde oyuncu yok; %88 `households:0`, %12 `country:0` sahipliği var.
- **Neden önemli:** Yönetim yetkisi, kurul makamı ve ekonomik mülkiyet birbirine karışıyor; oyuncu fantezisi ve gelecekteki temettü/devralma davranışı tanımsız.
- **Öneri:** Ürün kararı sonrası OWNER rolünde `owners.ownerId/shareBps`, EXECUTIVE rolünde kanonik officer binding ve her ikisinin farklı ekonomik haklarını assert et.
- **Trade-off:** Mevcut kayıtlar için pay devri veya rol adını “şirket yöneticisi” olarak göç ettirme kararı gerekir.

## TG-14 — Karakter yaşam testi PlayerAgency eylemlerini kapsamıyor

- **Kategori:** False Confidence / Cross-command Lifecycle Gap
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** probeCharacterLifeStatus, story-player-agency.test, StoryPlayerAgency
- **Kanıt:** Yaşam probu ölü aktörün CharacterAction ve şirket makamını doğru kapatıyor. Kanonik ölümden sonra aynı oyuncu PlayerAgency ile 20 kredi ve 10 lobi uyguladı; emekli fixture'da da iki eylem geçti.
- **Neden önemli:** UI “yalnız rolünün gerçek yetkisi” dediği hâlde ölü veya yalnız kişisel ajansı kalan karakter 18 sistem ailesinden bazılarını değiştirebilir.
- **Öneri:** PlayerAgency preview ve execute girişlerinde aktör kimliğini çözüp `storyCharacterIdentityCanAct` sonucunu zorunlu kıl; bütün 18 aileyi ACTIVE/RETIRED/DEAD matrisiyle tara.
- **Trade-off:** Emekli aktörün kişisel eylemleri CharacterAction'da kalmalı; PlayerAgency içinde bilinçli izin verilecek aileler açık allowlist ister.

## TG-15 — Göç probu şikâyet hafızasının insanlarla taşınmasını ölçmüyor

- **Kategori:** Cross-ledger Conservation Gap
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `probeHumanMigration`, `StoryPopulationTransferCohorts`, `StoryOpinionReconcilePopulationLinks`
- **Kanıt:** 17 kişilik geçerli aktarım ve save sonrasında kaynak/hedef üye sayıları değişti; iki kohortun şikâyet kayıt kimliği ve şiddetleri birebir aynı kaldı. Save başarılı ve iki validator de geçerliydi.
- **Neden önemli:** Fiziksel kişi korunurken göçmenin kıtlık, baskı ve sorumluluk algısı kaynakta kalıyor; hedefteki aynı profil hafızası yeni gelenlere anında uygulanıyor.
- **Öneri:** Farklı hafızalı iki bölge arasında profil bazlı göç kur; kişi oranıyla taşınan kayıt ağırlığını, toplam hafıza katkısını, save/load ve sonraki unutma tikini doğrula.
- **Trade-off:** Kohort düzeyinde karışım yaklaşık olacaktır; kayıt kimliği/episode geçmişi birleştirme politikası ürün kararı ister.

## TG-16 — Nüfus büyümesi demografik transition sanılabilir

- **Kategori:** Missing Behavioral Contract
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `storyCityGrowthTick`, `storyPopulationReconcile`, `storyPopulationRegionCreate`
- **Kanıt:** Şehir büyümesi yalnız `node.pop` skalerini değiştiriyor; uzlaştırma yeni toplamı korunmuş profil paylarına dağıtıyor. Doğum, yaşlanma, ölüm veya profil geçiş olayı yok.
- **Neden önemli:** Toplam nüfus değişir ama yaş yapısı, emeklilik, eğitim ve meslek dinamikleri gerçek zaman içinde evrilmez; uzun dönem seçim/işgücü sonuçları statik kalır.
- **Öneri:** Önce ürün sözleşmesini seç; sonra her demografik transition için kaynak olay, kişi korunumu ve uzun dönem dağılım testi ekle.
- **Trade-off:** Bu test mevcut davranışı kırmızıya çevirmemeli; yeni demografi fazının kabul kapısı olmalıdır.

## TG-17 — Mod değiştiren kaynak yönlendirmesi eski terminal yuvasını sızdırıyor

- **Kategori:** Untested Shipped Behavior / Resource Leak
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** `storyTradeApplyRedirect`, `storyTransportReplaceRoute`, `storyTransportAttachShipment`
- **Kanıt:** RAIL yükleme terminalinde aktif sevkiyat kaynakta LAND rotasına yönlendirildi. Aynı agent kimliği eski `RAIL:6877:LOAD` ve yeni `LAND:6877:LOAD` terminallerinde aktif kaldı; agent'ın güncel terminalKey'i yalnız LAND oldu.
- **Neden önemli:** Eski terminal kaydı artık normal release ile bulunamaz. RAIL iki yuvalı olduğu için iki yönlendirme terminali kalıcı kilitleyebilir ve sonraki meşru yükleri kuyrukta bırakabilir.
- **Öneri:** Route/agent replacement öncesi eski terminal üyeliğini serbest bırak; başarısız yeni attach'te eski rota, rezervasyon, ajan ve terminal durumunu atomik geri yükle.
- **Trade-off:** Reroute sırasında terminal sırasının korunup korunmayacağı açık bir davranış kararıdır.

## TG-18 — Aktif sevkiyat ile rota rezervasyonunun yaşam döngüsü çaprazlanmıyor

- **Kategori:** Cross-ledger Lifecycle Gap
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `storyRoutePlannerExpire`, `storyTradeValidate`, `storyTransportReleaseReservation`
- **Kanıt:** 1.051 birimlik HELD sevkiyat canlı kalırken saat 3.601'e getirildi; rezervasyonu EXPIRED oldu ve aynı rota/segmentler için ikinci 1.051 birim rezervasyon başarıyla alındı.
- **Neden önemli:** Engel kalkınca ilk yük rezervasyonsuz hareket ederken ikinci talep aynı fiziksel kapasiteye sahiptir; kapasite iki kez vaat edilmiş olur.
- **Öneri:** Canlı shipment ownerId'si taşıyan lease'i expire etme veya açık heartbeat/yenileme kullan; validator aktif sevkiyatın aktif/replaced rezervasyon bağını zorunlu kılsın.
- **Trade-off:** Süresiz blokajın kapasiteyi sonsuza dek kilitlememesi için iptal/yeniden planlama politikası gerekir.

## TG-19 — Transit gelir kodu kanonik koridor şemasıyla bağsız

- **Kategori:** Dead Path / Schema Mismatch
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `storyTradeProcessCustomsAndTariffs`, `StoryInfrastructure` koridor şeması
- **Kanıt:** Runtime'daki 631 koridorun hiçbirinde `ownerCountryId` yok; tümü `ENDPOINT_OWNERS`. Transit ücret dalının tek sahiplik okuması bu bulunmayan alandır.
- **Neden önemli:** UI/özet ve tarihsel kayıt transit geliri vaat ederken kanonik dünyada gelir üretilemez; üçüncü ülke geçiş hakkı ve ödeyen de tanımsız kalır.
- **Öneri:** Ürün kararı sonrası koridor sahipliği/geçiş hakkını tek şemaya ekle; rota kabulü, ücret rezervasyonu ve settlement'ı aynı transit makbuzuna bağla.
- **Trade-off:** Bu düzeltme yeni diplomasi, fiyatlandırma ve kayıt göçü davranışıdır; salt alan adı yaması değildir.

## TG-20 — İnsan göçü ticari segment kapasitesini paylaşmıyor

- **Kategori:** Confirmed Phase Boundary
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `StoryHumanMigration`, `StoryRoutePlanner`
- **Kanıt:** Göç defteri `sharedTradeCapacityReservation:false` bildirir; rota bulur fakat route planner reservation oluşturmaz.
- **Neden önemli:** Aynı yol üzerinde tam ticari kapasite ile ilave mülteci/göç akışı eşzamanlı kabul edilebilir.
- **Öneri:** Önce yolcu/tonaj kapasite birimi ve insani öncelik politikasını seç; sonra iki sistemin ortak segment rezervasyon testini kur.
- **Trade-off:** Ortak kapasite doğrudan gıda, üretim ve insani kriz dengesini değiştirir.

## TG-21 — Savaş ilanı PlayerAgency ve kurum yetki kapısını atlıyor

- **Kategori:** Competing Command Paths / Authorization Gap
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** `storyNodeClicked`, `storyBreakTreaty`, `StoryInstitutions`, `StoryPlayerAgencyBindings`
- **Kanıt:** `character:0:0` emekli edilince Diplomasi PlayerAgency görünümü `DIPLOMACY_LOCKED` ve “Yürütme makamı gerekli” dedi. Aynı karakterin sınır tıklaması treaty'yi `peace → war` yaptı; PlayerAgency makbuzu oluşmadı.
- **Neden önemli:** Seçim kaybeden, istifa eden veya emekli oyuncu devlet adına savaş başlatabilir; kurum ve yaşam döngüsü yalnız bazı UI yüzeylerinde geçerlidir.
- **Öneri:** Savaş ilanı ve treaty bozmayı tek kanonik komuta bağla; rol, yaşam durumu, rejim onayı, maliyet ve idempotency bütün oyuncu/AI/konuşma yollarında ortak olsun.
- **Trade-off:** Komutan oyuncunun yürütmeye savaş önerisi sunma akışı ürün kararıdır.

## TG-22 — Fetih makbuzu bağımlı sahiplik defterlerini atomik tutmuyor

- **Kategori:** Cross-ledger Atomicity Gap
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** `storyTransferNodeOwnership`, `storyPopulationReconcile`, `storyCausalityValidateWorldConsistency`
- **Kanıt:** Bölge sahibi `1 → 0` olduktan hemen sonra nüfus `country:1` kaldı; population validator `POPULATION_OWNER_MISMATCH` ve 12 kohort bağlantı hatası verdi. Genel causality-world validator aynı dünyayı `ok=true` saydı; nüfus ancak sonraki scheduler tikinde uzlaştı.
- **Neden önemli:** “APPLIED” fetih komutundan sonra UI, kamuoyu, ihtiyaç ve ülke toplamları kısa süre farklı egemenler gösterebilir; çapraz-defter okuyucuları geçersiz ara durumu gerçek sayar.
- **Öneri:** Sahiplik transferi commit'inde bağımlı ledger invalidation/reconcile çalıştır veya açık `OCCUPATION_TRANSITION` durumu kur; validatorü canlı node sahibiyle çaprazla.
- **Trade-off:** Anlık ilhak yerine işgal dönemi isteniyorsa eski ülke bağı sessiz bayatlık değil açık model olmalıdır.

## TG-23 — Kamuoyu gerçek bölgesel şirket yerine yeni ülkenin sektör şirketini suçluyor

- **Kategori:** Semantic Attribution Gap
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `storyOpinionAttribution`, `storyOpinionCompanyActor`, `storyCompanyRegionView`
- **Kanıt:** Fethedilen `region:25` içindeki tesislerin gerçek sahibi `country:1` şirketleri olarak kaldı; nüfus yeni egemene geçince şikâyetler `company:0:agriculture/energy/civil_industry` aktörlerine yazıldı.
- **Neden önemli:** Haber, ilişki ve siyasi tepki yanlış ekonomik aktöre yönelebilir; “işveren/tedarikçi” gerekçesi fiziksel mülkiyetle uyuşmaz.
- **Öneri:** Bölge+sektör için gerçek işletmeci/tesis sahibi çöz; hiçbiri yoksa ülke politika otoritesine açık fallback yap. Fetih, yabancı yatırım ve kamulaştırma senaryolarını tablo testiyle ayır.
- **Trade-off:** Tesis mülkiyetinin fetihteki kaderi ürün kararıdır; attribution düzeltmesi bu kararı varsaymamalıdır.

## TG-24 — Yüksek kademe araştırma önceliği yürütülemeyen başarı makbuzu üretiyor

- **Kategori:** False Success / Producer–Consumer Contract Gap
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `StoryPlayerAgencyBindings.SET_RESEARCH_PRIORITY`, `storyTechSetPriority`, `storyAIResearch`
- **Kanıt:** Available Kademe 3 `heavybat` için PlayerAgency başarı ve makbuz üretti. 40 rutin Ar-Ge çağrısı sonrasında 8.697 fon ve available durum korunurken teknoloji alınmadı; öncelik temizlenmedi. Yürütücü `tier > 2` adaylarını atlıyor.
- **Neden önemli:** Oyuncu uygulanabilir görünen stratejik karar verir, fakat oyun bunu sessizce sonsuza kadar bekletir; UI makbuzu fiziksel sonuç vaadini aşar.
- **Öneri:** Öncelik sözleşmesini Kademe 1–2 ile sınırla veya Kademe 3–4 önceliğini açık konsey gündemi/oy ağırlığı makbuzuna dönüştür; bekleyen kararın durumu görünür olsun.
- **Trade-off:** Yüksek kademe teknolojide yöneticinin son sözü ile konsey egemenliği ürün kararıdır.

## TG-25 — Teknoloji paneli sis açıkken yabancı kesin bilgiyi ham dünyadan okuyor

- **Kategori:** Information Boundary Bypass
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `storyTechUpdate`, `StoryWorldV2.technologyIds`, `PlayerKnowledge`
- **Kanıt:** Sis açık fixtürde PlayerKnowledge yabancı kaynakları UNKNOWN tuttu ve genel projeksiyon kesin değer sızdırmadı; teknoloji paneli ham `STORY.states[].tech.length` üzerinden “İber Federasyonu 7 teknoloji” yazdı.
- **Neden önemli:** Saldırı hedefi seçimini etkileyen stratejik bilgi istihbarat yatırımı olmadan kesin görünür; bilgi sisi ekranlara göre farklı kurala dönüşür.
- **Öneri:** Rakip teknoloji görünümünü PlayerKnowledge fact'ine bağla; UNKNOWN/ESTIMATED/VERIFIED sunumunu ve intel açma politikasını açıklaştır.
- **Trade-off:** Teknoloji sayısının kamu kaydı mı askerî sır mı olduğu kullanıcı kararıdır.

## TG-26 — Çağ savaş metriği komşuluk sözleşmesini ölçmüyor

- **Kategori:** Logic Error / Metric Denominator Gap
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `storyEraMetrics`
- **Kanıt:** Sekiz devlette 10 sınır komşuluğu ve 28 bütün çift vardı. Sınırı olmayan 0–1 savaşı metriği 0 yerine `1/28` yaptı; kaynak döngüsü komşuluk filtresi taşımıyor.
- **Neden önemli:** Uzak ve fiilen cephesiz savaşlar çağı değiştirirken yoğun sınır savaşları 28 çiftlik paydada seyrelir; saldırganlık ve anlatı geri beslemesi yanlış kalibre olur.
- **Öneri:** Önce aktif cephe metriğini seç; ardından sınır ekleme/kaldırma, devlet elenmesi ve aynı savaş sayısının farklı topolojileri için tablo testi kur.
- **Trade-off:** Bütün diplomatik savaş, ortak sınır veya ağırlıklı cephe seçenekleri farklı dünya anlatısı üretir.

## TG-27 — Çağ çalkantısı belgelenen ahit bozma olayını almıyor

- **Kategori:** Missing Event Wiring
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `storyEraEvent`, `storyBreakTreaty`, siyasi kriz olayları
- **Kanıt:** Treaty `peace → war` kırıldı ve ilişki/itibar değişti; `_eraEvents` boş kaldı. Kaynak çağrıları yalnız grev, sermaye kaçışı ve komutan firarında bulundu.
- **Neden önemli:** Çağ açıklaması darbe/ahit bozmayı çalkantı saydığını söylerken metrik bunları görmez; dünya etiketi ve gerçek hikâye ayrışır.
- **Öneri:** Kanonik olay türlerinden çağ sinyal adaptörü üret; doğrudan dağınık çağrılar yerine event ledger aboneliği veya tek yönlendirme kullan.
- **Trade-off:** Olay ağırlıkları ve yinelenen/alt olayların tek mi çok mu sayılacağı kalibrasyon ister.

## TG-28 — Özel konuşma senaryoları üretim mekaniğine bağlı değil

- **Kategori:** Confirmed Phase Boundary / Missing Compositional Adapters
- **Önem:** Medium
- **Güven:** Confirmed
- **Konum:** `probeDialogueScenarioLab`, conversation domain adapters
- **Kanıt:** Grev, ihale, seferberlik, yaptırım, mülteci, banka, esir, boru hattı ve darbe katalogları deterministik/geçerli adaylar üretti; bütün oturumlar `SCENARIO_LAB_ONLY`, adaylar non-executable ve sonuç `OPEN_COMPOSITIONAL_ADAPTER_DEBT`.
- **Neden önemli:** Oyuncu bu konuları konuşmada ifade edebilir fakat söz gerçek grev, ihale, seferberlik veya kriz komutuna dönüşmez.
- **Öneri:** Öncelik kararı sonrası her senaryoyu var olan domain command/preflight/authority/receipt hattına tek tek bağla; laboratuvar fallback'i güvenli non-mutating olarak koru.
- **Trade-off:** Dokuz senaryoyu tek generic executor'a bağlamak sahte yetki ve kaynak sonucu üretir; her biri ayrı entegrasyon sözleşmesi ister.

## TG-29 — Konsey önergesi ödeme ve etkiyi atomik uygulamıyor

- **Kategori:** False Success / Missing Transaction Boundary
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** `Council.js:storyCouncilApply`, `storyCouncilPayFromState`, `COUNCIL_MOTIONS`
- **Kanıt:** Runtime fixtüründe `roads.apply` kontrollü exception üretti. Nakit 3000→2850 düştü, zenginlik/altyapı etkisi oluşmadı ve fonksiyon yine “Otoyol Yatırım Programı kabul edildi” döndürdü. Kaynak `m.apply` exception'ını boş `catch` ile yutuyor.
- **Neden önemli:** Oyuncu kaynak kaybedip hiçbir sonuç alamaz; UI ve telemetri başarısız kararı başarı gibi anlatır. Tekrar deneme ikinci ödeme üretebilir.
- **Öneri:** Önce kırmızı `councilMotionFailureIsAtomic` testi; sonra ödeme rezervasyonu + etki + commit veya güvenli rollback ve açık başarısız makbuz.
- **Trade-off:** Doğrudan alan değiştiren mevcut önergeleri geri almak genel snapshot gerektirebilir; en güvenlisi onları ayrı kanonik komutlara taşımaktır.

## TG-30 — Konsey ve askerî üretim eski stratejik sayaçlarla ayrıntılı defterleri ayırıyor

- **Kategori:** Cross-Ledger Architecture Seam / Missing Integration Contract
- **Önem:** High (konsey), Medium (askerî üretim)
- **Güven:** Confirmed
- **Konum:** `Council.js`, `Production.js`, nüfus/bölgesel ekonomi/altyapı/hex inşaat defterleri
- **Kanıt:** `census` kohort defterini byte-eşdeğer bırakıp 551.133 fiziksel kişi sabitken komutan manpower/oil toplamlarını 450'şer artırdı; bölgesel enerji sabit kaldı. `roads` 25 wealth üretti fakat yol ağı/iş emri/inşaat defteri değişmedi. `arsenal` fiziksel inşaat komutu olmadan bina toplamını artırdı. Birlik kuyruğu da stratejik cüzdan ve şehir bina seviyesini tüketir; her üretimde ayrıntılı askerî mal/kohort işlemi yoktur.
- **Neden önemli:** Aynı “insan”, “petrol”, “yol”, “tesis” ve “üretim” kavramı iki gerçeklikte farklı hareket eder; ekonomi, demografi ve harita oyuncuya birbiriyle açıklanamayan sonuç gösterebilir.
- **Öneri:** Önce kullanıcıyla stratejik üst katmanın kalıp kalmayacağını seç. Sonra her önerge/birim reçetesini gerçek domain komutu, kaynak ve makbuza eşleyen geçiş planı ve eski kayıt adaptörü hazırla.
- **Trade-off:** Sayaçları aniden kaldırmak savaş dengesi ve eski kayıtları kırar; mevcut doğrudan etkileri “kanonik” ilan etmek ise ayrıntılı simülasyon vaadini bozar.

## TG-31 — Üç Electron testi birleşince bile gerçek hikâye savaş yaşam döngüsünü çalıştırmıyor

- **Category:** False Confidence
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** electron/main.js:4695-5336, electron/main.js:5481-5535, electron/main.js:5541-5631, tools/story-sim-harness.js:297-299
- **Evidence:** UITEST karakter yaratıp dünya ekranında biter. BATTLETEST mode:quick Hızlı Maç oturumu açar ve STORY.battleCtx/storyOnBattleEnd zincirine girmez. PLAYTEST window.confirm sonucunu sürekli false yaparak savunma tekliflerini reddeder ve arena otomasyonunu açıkça kapsam dışı bırakır. Başsız dünya harness'ı da storyLaunchBattle, storyLaunchDefense ve storyCheckPlayerDefeat fonksiyonlarını stub'lar. Paket komutlarında bu sınırları birleştiren başka bir Electron kabulü yoktur.
- **Why it matters:** Dünya→deploy→savaş motoru→dünya sonucu sınırında havuz tüketimi, fetih, kayıp, ödül, tek-talep, kayıt ve devam birlikte kırılabilir; mevcut testler yine yeşil kalır. TG-02, TG-03, TG-04 ve TG-05'in üretim yolunda yakalanmamasının temel nedeni budur.
- **Recommended fix:** İzole userData profiliyle çalışan bir --storylifecycletest kabulü ekle. Gerçek UI'dan yeni kampanya başlatsın, yetkili komşu hedefi seçsin, gerçek mode:story savaş oturumunu açsın, deterministik kısa savaş sonucu üretsin, ödülü bir kez alsın, Electron'u kapatıp yeni süreçte Continue ile dünya/defter durumunu doğrulasın. Saldırı zaferi, saldırı kaybı ve son-bölge savunma kaybı üç ayrı fixture olmalı.
- **Tradeoffs / Risks:** Gerçek savaş süresi testi yavaşlatır. Test-only deterministik bitiş kancası motor sonucunu üretmeli fakat storyOnBattleEnd veya dünya mutasyonlarını atlamamalıdır; aksi hâlde yeni bir sahte E2E oluşur.

## TG-32 — UITEST ekran görüntüsü DOM assertion'ından önce eski kareyi yakalayabiliyor

- **Category:** False Confidence
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** electron/main.js:5481-5535, qa-screenshots/atlas-uitest-20260825/04-karakter-zar.png
- **Evidence:** Güncel gerçek Electron koşusu story-character, görünür char-body ve görünür char-roll assertionlarını geçirdi; aynı adımın 04-karakter-zar.png görüntüsü hâlâ kurulum ekranını gösterdi. Test sleep sonrası doğrudan capturePage çağırıyor; paint/compositor yerleşmesini doğrulamıyor.
- **Why it matters:** İnsan gözüyle incelenmek üzere saklanan görüntü, testin doğruladığı DOM durumuyla aynı kareyi temsil etmeyebilir. Görsel regresyon ve “kullanıcı gerçekten ne gördü?” kanıtı güvenilmez olur.
- **Recommended fix:** Her çekimden önce iki requestAnimationFrame ve document.fonts.ready bekle; beklenen data-screen ile görünür kök elemanı aynı anda doğrulandıktan sonra capture al. PNG yanına ekran adı ve monoton adım kimliği içeren JSON manifest yaz.
- **Tradeoffs / Risks:** Test birkaç saniye uzar. Arka planda gizli Electron'da rAF davranışı için zaman aşımı fallback'i gerekir.

## TG-33 — MAPTEST üç bayat/asenkron ölçüm nedeniyle gerçek harita sonucunu yanlış kırmızı gösteriyor

- **Category:** False Confidence
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** electron/main.js:606-777, js/StoryRender.js:2537-2707, js/StoryUI.js:2359-2397, js/StoryMapCache.js:81-103
- **Evidence:** Gerçek Electron koşusu sabit uzak/orta/yakın p95'i 15,4/13,1/16,3 ms ve etkileşim p95'i 13,7 ms ölçtü; yine de exit 1 oldu. Test borderBuilds=1 bekliyor fakat politicalBorderWorldLayer için üretici yok. presentationSamples her kare sıfırlanıyor fakat depoda diziye yazım yok; bu yüzden sampleCount=0. Hover mousemove olayı rAF planlıyor, test ise rAF'ı beklemeden hoverHexCellId okuyup 24/24 kaçırma yazıyor.
- **Why it matters:** Performans kabulü sürekli kırmızı olduğunda gerçek 109,6 ms açılış dilimi ve yaklaşık 1,2 GiB katman belleği gibi maddi regresyonlar test altyapısı gürültüsünde kaybolur.
- **Recommended fix:** Border assertionını aktif politik overlay tanısına taşı; taşıt örneğini sabit kapasiteli QA tamponuyla üret; hover olayından sonra rAF bekle. Sonra aynı izole koşuyu tekrar çalıştırıp yalnız gerçek performans eşiklerinin sonucu belirlediğini doğrula.
- **Tradeoffs / Risks:** Taşıt tanısı üretim renderında yeni per-frame allocation yaratmamalı; QA bayrağı veya yeniden kullanılan sayısal tampon gerekir.

### 4) Priority Test List

0. **P0 — storyElectronLifecyclePersistsCanonicalOutcome**
   - **Level:** e2e / Electron
   - **Setup required:** İzole geçici userData; sabit kampanya seed'i; gerçek menü→kurulum→karakter→dünya yolu; yetkili ve komşu düşman hedef; kısa deterministik mode:story savaş sonucu; ikinci Electron süreci.
   - **The assertion:** Savaş başında kaynak şehir havuzu azalır; sonuçta yalnız sağ kalanlar döner; sahiplik/itibar/refah/pendingReward tek kez değişir; seçilen ödül tek kez uygulanır; süreç kapatılıp Continue edildiğinde aynı kanonik defter ve dünya ekranı geri gelir, eski ödül tekrar alınamaz.
   - **The bug it would catch:** Gerçek savaş köprüsünün hiç açılmaması, sonucun iki kez uygulanması, kayıp havuzunun geri gelmesi, pendingReward kaybı/örtülmesi ve save/continue sonrası dünya sapması.

0. **P0 — executiveElectionTransferIsCanonical (integration):** EXECUTIVE oyuncuyu gerçek incumbent yap; kazanma ve kaybetmede election, institution, career ve governance aktörlerinin tek sahibi gösterdiğini doğrula.
0. **P0 — coupExecutiveTransferIsCanonical (integration):** Başarılı darbede kriz liderini gerçek yürütme transition'ına bağla; institution, election durumu, career ve governance yetkisinin aynı sonucu gösterdiğini doğrula.
0. **P0 — companyLoanUsesSingleAuthorityPath (integration):** Aynı aktör/şirket/tutarı bütün komut yüzeylerinden çalıştır; aynı kurul, faaliyet durumu, borç tavanı ve banka kapılarını; tek idempotent mali sonucu doğrula.
0. **P0 — bankruptCompanyCannotOperate (integration):** Gerçek iflas üret; açık yeniden yapılandırma komutu dışında kredi, lobi, yatırım, üretim ve yeni sözleşmelerin reddedildiğini doğrula.
1. **P1 — companyOwnerHasCanonicalEconomicRight (integration):** Seçilen sahip/yönetici sözleşmesine göre oyuncunun pay veya kanonik makam kaydını ve ekonomik haklarını doğrula.
0. **P0 — inactivePlayerCannotUseAgency (integration):** Aynı oyuncuyu ACTIVE, RETIRED ve DEAD durumlarından geçir; 18 PlayerAgency ailesinin yaşam politikasına göre reddedildiğini ve hiçbir kanonik defterin değişmediğini doğrula.
1. **P1 — migrationCarriesComplaintMemory (integration):** Farklı hafızalı iki bölge arasında profil bazlı göç yap; fiziksel kişi ile seçilen toplumsal hafıza ağırlığının birlikte taşındığını ve save/load'da korunduğunu doğrula.
0. **P0 — rerouteReleasesPreviousTerminal (integration):** Kaynakta RAIL→LAND ve LAND→SEA yönlendirmesi yap; eski terminalde agent kimliği kalmadığını, iki tekrar sonrası yeni yükün kabul edildiğini doğrula.
1. **P1 — activeShipmentKeepsCapacityLease (integration):** Sevkiyatı rezervasyon süresini aşan blokajda tut; aynı segment kapasitesinin ikinci kez ayrılamadığını veya ilk yükün açıkça iptal/yeniden planlandığını doğrula.
1. **P1 — transitOwnershipAndPaymentAreCanonical (integration):** Üçüncü ülke rotası kur; geçiş yetkisi, koridor sahibi, ücret ödeyen ve bütçe hareketini tek makbuzla doğrula.
2. **P2 — migrationAndFreightShareCapacity (integration):** Seçilen kapasite politikasından sonra aynı segmentte ticari yük ve göç akışının toplam sınırı aşmadığını doğrula.
0. **P0 — inactivePlayerCannotDeclareWar (integration):** ACTIVE/RETIRED/DEAD ve makam sahibi/değil matrisinde harita, konuşma ve PlayerAgency yollarını çalıştır; yalnız yetkili yolun tek treaty ve tek makbuz üretmesini doğrula.
0. **P0 — conquestCommitsOwnershipAtomically (integration):** Fetih dönüşünde node, nüfus, ihtiyaç, kamuoyu, ülke toplamları ve validatorlerin aynı egemeni göstermesini; save/load'ın ara durumu kalıcılaştırmamasını doğrula.
1. **P1 — opinionBlamesActualRegionalProvider (integration):** Yerli, yabancı sahipli ve sahipsiz sektör tesisi kur; kamuoyunun gerçek işletmeciye veya açık politika fallback'ine yöneldiğini doğrula.
1. **P1 — researchPriorityMustHaveExecutor (integration):** Kademe 1–4 available teknolojileri önceliklendir; başarı makbuzu alan her kararın tanımlı yürütücü, durum geçişi ve iptal/konsey yolu olduğunu doğrula.
1. **P1 — fogAppliesToRivalTechnologyUi (UI integration):** Sis açık/kapalı ve intel yok/var matrisinde teknoloji panelinin yalnız izinli UNKNOWN/ESTIMATED/VERIFIED bilgisini gösterdiğini doğrula.
1. **P1 — eraWarMetricUsesChosenFrontier (unit/integration):** Aynı savaş sayısını farklı sınır topolojilerinde kur; seçilen paydanın ve devlet elenmesinin beklenen çağ skorunu verdiğini doğrula.
1. **P1 — eraTurmoilConsumesCanonicalEvents (integration):** Ahit bozma, darbe, firar, grev ve sermaye kaçışını kanonik olaylardan üret; her kök olayın bir kez ve doğru ağırlıkla sayıldığını doğrula.
2. **P2 — specializedDialogueUsesCanonicalDomainCommand (integration):** Seçilen her özel senaryoda konuşma adayının doğrudan mutasyon yapmadığını, gerçek domain preflight/authority komutuna bağlandığını ve ret/başarı makbuzunu doğrula.
0. **P0 — councilMotionFailureIsAtomic (integration):** Her önergeyi ödeme, etki ve makbuz aşamalarında kontrollü hataya uğrat; başarısızlıkta nakit/kaynak/dünya farkının sıfır ve durumun açık ret/rollback olduğunu doğrula.
1. **P1 — councilMotionUsesCanonicalDomain (integration):** Census, yol, cephanelik, garnizon ve şehir yatırımını çalıştır; seçilen ürün sözleşmesine göre bütçe+nüfus/stok+altyapı/inşaat defterlerinin tek correlationId ve tek fiziksel sonuçta birleştiğini doğrula.
1. **P1 — militaryProductionReconcilesPhysicalInputs (integration):** Birlik kuyruğu ve savaş kaybında seçilen reçeteye göre stratejik cüzdan, askerî mal, enerji, tesis kapasitesi, işgücü ve kohort kaynaklarının korunmasını; iptal/save-load yolunu doğrula.
0. **P0 — foreignTradeMoneyConservation (integration):** Satış, ithalat/ihracat vergisi ve transit ücretlerini tek settlement içinde çalıştır; her geliri bir ödeyenle ve toplamı sıfır açıklanamayan farkla doğrula.
1. **P0 — `battleRewardEligibilityByOutcome` (integration):** win/loss/draw kur; uygun ödül seçeneklerini ve kaynak farkını sonuç sözleşmesine göre doğrula. Kayıp çiftçiliğini yakalar.
2. **P0 — `lastRegionLossEndsOrExilesConsistently` (integration):** son bölgeyi kaybettir; mesaj, kontrol durumu ve sonraki tik sonucunun seçilen tasarımla aynı olmasını doğrula.
3. **P0 — `realBattleLaunchConsumesCanonicalPools` (integration):** stub kullanmadan saldırı başlat; birlik/komutan/kaynak aktarımını ve ekran geçişini doğrula.
4. **P1 — `pendingRewardSurvivesContinue` (save/load integration):** sonuçtan sonra kaydet, yeni runtime'da devam et; ödülün erişilebilir ve tek-talep olmasını doğrula.
5. **P1 — `invalidBattleTargetReturnsFalse` (unit):** bilinmeyen node kimliğinin exception üretmediğini doğrula.
6. **P1 — `campaignDefeatUsesRealChecker` (integration):** gerçek `storyCheckPlayerDefeat` ile sıfır bölge ve en az bir bölge durumlarını doğrula.
7. **P1 — `characterExecutionOrderTrace` (integration):** gerçek callback izinde behavior -> activation -> actions sırasını doğrula; görev listesi sırasına bağlanma.
8. **P2 — `setupToWorldSmoke` (Electron/UI):** menü, 12 karakter seçimi, yeni kampanya ve ilk harita karesini gerçek tıklamalarla doğrula.

### 5) Not Worth Testing

- Her özellik bayrağı kombinasyonunun kartezyen çarpımı; yalnız sevk edilen ve kritik fallback kombinasyonları yeterli.
- Tarayıcının `confirm` uygulamasının kendisi; bizim karar dallarımız test edilmeli.
- Gerçek zamanlı birkaç dakikalık savaşın tamamını E2E'de beklemek; test-only deterministik motor sonucu kullanılmalı fakat üretim hikâye köprüsü ve dünya sonucu atlanmamalı.
- Headless testte piksel-piksel bütün harita görüntüsü; seçili görsel kabul örnekleri daha anlamlı.
- Davranış içermeyen tek satırlı getter/setter'lar; onları kullanan sözleşme testleri yeterli.
- Ürün kararı verilmeden varsayımsal zafer koşullarının ayrıntılı testleri.

### 6) Suite Health Notes

- Gerçek Electron UITEST 25 Ağustos'ta menü→kurulum→12 soru→dünya DOM akışını geçti; bu sonuç savaş yaşam döngüsünü kapsamaz.
- BATTLETEST savaş motorunu kapsamlı ölçer fakat sessionMode=quick sözleşmesi nedeniyle hikâye dünya bağını kanıtlamaz.
- PLAYTEST yıllar süren dünya simülasyonu üretir fakat bütün confirm kararlarını false yaparak gerçek savunma savaşını bilinçli biçimde dışarıda bırakır.
- MAPTEST'in güncel exit 1 sonucu tek başına ürün haritasının başarısız olduğu anlamına gelmez: üç doğrulanmış test altyapısı kusuru vardır; aynı koşu sabit render hedefini karşıladı ve iki gerçek performans riskini ayrıca ölçtü.
- Tam paket 88 görev planlıyor, fakat güncel koşu 85/88'de `characterActivationBudgetProbe` false negative'iyle durdu; kalan görevler için tam yeşil kanıt yok.
- Uzun dünya simülasyonları saat, determinism ve birçok alt sistemi iyi çalıştırıyor; savaş/yenilgi stub'ları nedeniyle bunlara “uçtan uca hikâye testi” denmemeli.
- `battleProbe` adı geniş görünse de doğruladığı alan telemetri sayaç/sürüm/tohum ile sınırlı.
- tradeProbe satış escrow'unu doğruluyor; vergi ödeyenini ve küresel para korunumunu doğrulamıyor.
- electionProbe mandat sayımını doğruluyor; oynanabilir EXECUTIVE makam/kariyer devrini doğrulamıyor.
- governanceProbe requiredTrue sözleşmesi taşımıyor ve saklanan sonuçtaki yanlış başkan rolüyle geçiyor.
- politicalCrisisProbe kriz sonucu ve hafızayı güçlü biçimde ölçüyor; başarılı darbenin kanonik yürütme sahibini değiştirdiğini ölçmüyor.
- companyProbe bilanço, yatırım ve başvuruyu ölçüyor; iflas veya iflas sonrası eylem kapısı kurmuyor.
- characterRoleAdaptersProbe kurul teklifinin eksik makamlarla etkisiz kalmasını, story-player-agency ise aynı kredinin doğrudan mutasyonunu ayrı ayrı başarı sayıyor.
- characterIdentityProbe `organizationId` bağını sahiplik kanıtı diye yorumluyor; `company.owners` içinde oyuncu payını kontrol etmiyor.
- characterLifeStatusProbe CharacterAction ve makam kapanışını iyi ölçüyor; PlayerAgency ailelerini ölüm/emeklilik sonrasında tekrar çalıştırmıyor.
- humanMigrationProbe rota, kapasite, bekleme ve tam kişi korunumunu güçlü ölçüyor; göçmenlerin kamuoyu/şikâyet hafızasını taşıyıp taşımadığını ölçmüyor.
- populationProbe skaler büyümenin kohort toplamına kayıpsız dağıtımını doğruluyor; bunu doğum/ölüm/yaşlanma transition'ı olarak kanıtlamıyor.
- transportAgents testi güvenli ayak sınırı ve terminal kuyruğunu ölçüyor; kaynakta farklı moda reroute sırasında eski terminal üyeliğini ölçmüyor.
- routePlanner testi eşzamanlı rezervasyon çakışmasını ölçüyor; canlı shipment owner'ının lease expiry davranışını ölçmüyor.
- tradeProbe transit gelir özetini veya kanonik koridor sahiplik alanını assertion yapmıyor.
- peaceProbe barış başlangıcını, saldırı engelini ve save/load'ı güçlü ölçüyor; savaş ilan eden oyuncunun yaşam durumu, kurumsal makamı ve komut makbuzunu ölçmüyor.
- causality ledger sahiplik alanını ve telemetriyi ölçüyor; transfer tamamlandığı anda nüfus/needs/opinion defterlerinin canlı sahiplikle aynı olmasını doğrulamıyor.
- opinionProbe normal başlangıç dünyasında aktör referanslarını doğruluyor; fethedilmiş bölgede gerçek tesis sahibi ile türetilmiş ülke şirketini karşılaştırmıyor.
- worldV2Probe ve projectionProbe yabancı kesin kaynak/refah sızıntısını güçlü ölçüyor; teknoloji panelinin ham `STORY.states` okumasını render edip sınamıyor.
- PlayerAgency kabul testi teknoloji önceliğinin makbuzunu başarı sayıyor; seçilen teknolojinin rutin/konsey tüketicilerinden biri tarafından yürütülebilir olduğunu ölçmüyor.
- Çağ için bağımsız metrik ve geçiş probu yok; map cache sözleşmesi yalnız zorlanmış çağ değişiminin görsel cache invalidasyonunu doğruluyor.
- dialogueScenarioLabProbe dokuz özel senaryonun güvenli ve non-executable olmasını doğru biçimde ölçüyor; gelecekte gerçek domain adapteri eklendiğini kanıtlayan kabul testi değildir.
- Konsey telemetri assertion'ı yalnız karar olayının yazıldığını görür; önerge ödemesinin fiziksel sonuçla atomik olduğunu veya doğru domain defterini değiştirdiğini ölçmez.
- Aktivasyon, toplulaştırma, karar izi, ilişki yorumu, şehir dosyası, projeksiyon, hex dünya ve görsel katalog hedefli testleri 25 Ağustos kapsam kapatmasında geçti; bu sonuç konsey/üretim çapraz-defter uyumunu kanıtlamaz.
- Hedefli 18/18 ve 20/20 sonuçları korunmalı, fakat yaşam döngüsü güveni için yukarıdaki P0 testlerinin yerini tutmuyor.
