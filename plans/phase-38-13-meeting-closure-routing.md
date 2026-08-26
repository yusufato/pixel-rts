---
id: phase-38-13-meeting-closure-routing
status: In Progress # User approved 2026-08-26
owner: osman
source: Faz 38.13 / 26 Ağustos 2026 aktif imleç uzlaştırması
touches:
  - js/StoryConversationUnderstanding.js
  - js/StoryCharacterRoleAdapters.js
  - js/Talks.js
  - tools/story-sim-harness.js
  - tests/story-conversation-case.test.js
  - docs/story/plans/HIKAYE_MODU_KATMANLI_DUNYA_SIMULASYONU_PLANI.md
  - docs/story/status/HIKAYE_MODU_UYGULAMA_DURUMU.md
  - plans/25-agustos-hikaye-modu-toplam-bugfix-plani.md
  - plans/bugfix-council-motion-atomicity.md
  - plans/bugfix-story-invalid-battle-target-guard.md
  - plans/electron-story-lifecycle-acceptance.md
  - LEDGER.md
depends_on:
  - 25-agustos-belge-hedefleme-duzeni
  - worktree-reconciliation-no-delete
conflicts_with:
  - 25-agustos-hikaye-modu-toplam-bugfix-plani
  - bugfix-council-motion-atomicity
  - bugfix-story-invalid-battle-target-guard
  - electron-story-lifecycle-acceptance
created: 2026-08-26
last_touched: 2026-08-26
---

# Faz 38.13 — Toplantı Kapanışı ve Yetkili Teklif Yönlendirmesi

## 1) Uygulama tezi

Faz 38.13'ün ilk on iki dikeyi toplantıyı sürüme bağlı
`MeetingOutcomeReceiptV1` sonucuna kadar getiriyor; sonuç bilinçli olarak dünyaya
uygulanmıyor. Bu dilim sonuç makbuzunu ayrı ve sürümlenebilir bir başkan kapanış
kaydına bağlayacak. Kabul edilmiş bir önerge yalnız Faz 38.9 rol adaptörünün
yeniden doğruladığı kanonik `canPropose` rotası üzerinden Faz 29 kurum isteğine
dönüşecek. Reddedilmiş önerge kapanacak fakat teklif üretmeyecek.

Oylama bittikten sonra serbest `actionType` seçmek yasaktır. Böyle bir tasarım,
örneğin sanayi yatırımı metni oylanmışken sonuç makbuzunu savaş ilanına
bağlayabilir. Bu nedenle yönlendirilebilir önerge, oylama açılmadan önce
`InstitutionProposalIntentV1` taşıyacak. Niyet; eylem türünü, ülkeyi, kanonik
teklif makamını ve gerekiyorsa hedef bölgeyi kaydeder. Oylama açıldıktan sonra
değiştirilemez; kapanışta canlı yetki şemasına karşı tekrar doğrulanır.

**Done:** Kabul/ret sonucu tek bir `MeetingClosureRecordV1` ile kapanır; kabul
sonucu en fazla bir kanonik kurum isteği üretir; ret sonucu istek üretmez;
yetkisiz veya bayat rota hiçbir defteri değiştirmez; açık toplantı ve kapanmış
toplantı save/load sonrasında aynı kalır; kurum teklif kimliğinden sonuç
makbuzuna deterministik geri izleme yapılır.

**Why now:** Ana plan ile durum belgesi aynı aktif sırayı gösteriyor. Faz 39'a
geçmeden önce Faz 38.13'ün oylama ile kurumsal karar zinciri arasındaki güvenli
sınırının kapanması gerekiyor.

**Recommendation:** Proceed after approval and conflict serialization. Bu plan
yalnız teklif kaydı açar; onay, icra veya fiziksel sonuç üretmez.

## 2) Değişmezler

- Toplantı sonucu bütçe, refah, kurum kadrosu, ordu, ilişki, nüfus, bölge
  sahipliği veya fiziksel dünya değerini doğrudan yazamaz.
- `ADOPTED`, yürütülmüş karar değildir; en fazla Faz 29'da `PENDING_APPROVAL`
  veya mevcut kanonik rota gerektiriyorsa `AUTHORIZED` kurum isteği demektir.
- `REJECTED` sonuç hiçbir kurum isteği üretmez.
- Önergeye bağlı kurumsal niyet oylama açılmadan önce belirlenir ve
  `motionVersionId` ile mühürlenir. Yeni önerge sürümü eski niyeti otomatik
  miras alamaz; yeniden önizleme gerekir.
- Unvan, LLM metni, oyuncu metni veya istemci payload'u makam/yetki üretemez.
  Teklifçi aktör, kurum, ülke ve `canPropose` hakkı Faz 38.9 canlı rol
  adaptöründen gelmelidir.
- Bölge hedefli eylem, kanonik ülke yetki alanındaki gerçek bölge kimliği olmadan
  yönlendirilemez. İlk UI dilimi hedef seçicisi yoksa yalnız ülke kapsamlı
  rotaları gösterebilir; bölgesel rotayı eksik hedefle sessizce kabul edemez.
- Yetkisiz/bayat rota, eksik niyet, açık oylama, tahrif edilmiş makbuz ve ikinci
  kapanış başarısız olur; başarısızlık öncesi ve sonrası bütün ilgili defterler
  byte-eş anlamda aynı kalır.
- Bir toplantının en fazla bir kapanış kaydı vardır. Aynı sonuç makbuzu ikinci
  kurum isteği üretemez.
- Kapanış kaydı ayrı kimlik taşır; sonuç makbuzunu değiştirmez veya onun içine
  kurum sonucunu sonradan yazmaz.
- Teklif kimliğinden `meetingClosureId → outcomeReceiptId → motionVersionId`
  zinciri yerel defterlerden izlenebilir olmalıdır.
- Mevcut şema-4 kayıtları veri uydurmadan göçer. Eski yönlendirme niyetsiz
  önergeler oy/sonuç geçmişini korur fakat geriye dönük mekanik niyet kazanmaz.
- Oyuncu ve karakter aynı yetki önizleme ve kurum teklif adaptörünü kullanır.
- Her commit tek amaçlı, testli ve tek başına geri alınabilir olmalıdır.

## 3) Kapsam dışı

- Faz 29 kurum isteğini onaylamak, yürütmek veya fiziksel dünya etkisine çevirmek.
- Kabul edilmiş serbest metinden LLM, anahtar sözcük veya sezgisel eşleme ile
  `actionType` çıkarmak.
- Kurum rotası olmayan şirket, askerî saha emri, diplomasi veya ilişki etkisi
  için yeni yürütücü tasarlamak.
- Karakterin özel nota cevabı, kurumsal/ücretli görev ve yönlü ilişki fişleri;
  bunlar sonraki ayrı Faz 38.13 dilimleridir.
- Faz 38.8, 38.9, 38.10, 38.11 veya 38.12'yi `complete` ilan etmek.
- Faz 39'u başlatmak.
- Eski tüm toplantılara tahmini rota veya kapanış kaydı backfill etmek.
- Tam `npm test` paketindeki bu dilimle ilgisiz bayat prob borçlarını düzeltmek.

## 4) Önkoşullar ve plan çakışması çözümü

- Kullanıcı bu dosyayı insan kararıyla `Draft → Approved` yapmalıdır. Agent
  kendi başına durum yükseltemez.
- Çalışma ağacı uygulama başlamadan önce temiz olmalıdır. Kullanıcı değişikliği
  varsa sahipliği belirlenmeden stage, restore veya taşıma yapılmaz.
- Bu plan `js/Story*.js`, `js/Talks.js`, harness ve append-only ledger yolları
  nedeniyle dört açık Draft planla çakışır. Kaynak değişikliğinden önce dört
  planın frontmatter'ına bu plan `depends_on` olarak eklenir ve karşılıklı
  `conflicts_with` kaydı yazılır. Böylece yürütme sırası açıkça bu plan → diğer
  Draft planlar olur; içerikleri veya durumları değiştirilmez.
- Faz 29 kurum defteri ve Faz 38.9 rol adaptörü etkin, doğrulanabilir ve aynı
  kampanyada tekil olmalıdır.
- Mevcut hedefli baz:
  `node tests/story-conversation-case.test.js` temiz geçmelidir.
- Uygulama öncesi kurum rotası örneği seçilir: gerçek toplantı başkanının
  `canPropose:true` taşıdığı, test fikstüründe hedef kapsamı eksiksiz
  kurulabilen bir eylem. Test, sabit unvana veya görünen role güvenemez.

Bu önkoşullar karşılanmadan Adım 1 dışındaki kaynak adımları başlamaz.

## 5) Adım dizisi

| # | Adım | Tür | Ana dosyalar | Risk | Tek başına geri alınabilir |
|---|---|---|---|---|---|
| 1 | Çakışan planları seri sıraya bağla | Mechanical | dört `plans/*.md` | Low | Yes |
| 2 | Önergeye mühürlü kurumsal niyet ekle | Behavioral/Additive | Understanding, RoleAdapters, Talks, test | Medium | Yes |
| 3 | Ayrı kapanış kaydı ve şema göçünü kur | Behavioral/Additive | Understanding, harness, test | Medium | Yes |
| 4 | Kabul sonucunu idempotent kurumsal teklife yönlendir | Behavioral | Understanding, test | High | Yes |
| 5 | Kapanış ve teklif izini oynanabilir UI'a aç | Additive | Talks, test | Medium | Yes |
| 6 | Kanonik plan/durum/ledger kaydını uzlaştır | Documentation | iki aktif belge, LEDGER | Low | Yes |
| 7 | Hedefli kabul ve temiz çalışma ağacı kapısı | Mechanical | çalışma ağacı | Low | N/A |

### Adım 1 — Çakışan planları seri sıraya bağla

- **Amaç:** Aynı kaynak ve harness yüzeyinde paralel uygulama başlamasını
  önlemek.
- **Değişiklik:** Frontmatter dışında içerik değiştirmeden dört çakışan Draft
  plana `phase-38-13-meeting-closure-routing` bağımlılığı ve karşılıklı conflict
  kaydı ekle. Durumları `Draft` kalır.
- **Doğrulama:** Plan başlıkları parse edilir; bağımlılık döngüsü yoktur; yalnız
  frontmatter diff'i vardır; `last_touched` uygulama gününe çekilir.
- **Rollback:** Yalnız bu dört metadata ekini revert et.
- **Commit:** `docs(plans): serialize phase 38.13 closure routing`
- **Commit gövdesi:** Çakışan yüzeyleri (`Story*.js`, Talks, harness, ledger),
  neden bu dilimin önce geldiğini ve hiçbir planın onay/durumunun değişmediğini
  açıkça yaz.
- **Durma koşulu:** Bağımlılık döngüsü oluşursa veya başka plan aynı anda
  `In Progress` ise kaynak koduna geçme.

### Adım 2 — Önergeye mühürlü kurumsal niyet ekle

- **Amaç:** Oylanan metin ile kapanışta açılacak kurumsal teklifin birbirinden
  kopmasını önlemek.
- **Değişiklik:** Rol adaptörünün kanonik teklif rotası görünümüne mevcut kurum
  şemasından hedef kapsamını ekle. Yönlendirilebilir önerge için
  `InstitutionProposalIntentV1` oluştur; eylem türü, hedef, ülke, teklifçi
  başkan, kurum, yetki kaynağı ve bağlı önerge sürümünü sakla. Niyet yalnız
  `storyCharacterRoleInstitutionActionPreview({phase:'PROPOSE', ...})` başarılı
  ise yazılır. Oylama açıldıktan sonra niyet değişikliğini reddet. UI'da yalnız
  eksiksiz hedeflenebilen `canPropose` rotalarını sun.
- **Doğrulama:** Sahte unvan, başka ülke, başka kurum, `canPropose:false`, eksik
  bölge hedefi ve oylama sonrası değişiklik aynı hata koduyla değil, anlamlı
  kapalı hata kodlarıyla reddedilir ve snapshot farkı sıfırdır. Yeni önerge
  sürümü eski niyeti kullanamaz. Normal yönlendirilemez eski önerge akışı
  bozulmaz.
- **Rollback:** Niyet alanı/API/UI seçicisini birlikte revert et; mevcut önerge
  ve oylama davranışı geri gelir.
- **Commit:** `feat(story): bind meeting motions to canonical proposal intent`
- **Commit gövdesi:** Oydan sonra serbest eylem seçiminin neden güvenli
  olmadığını, niyetin hangi canlı yetki kanıtlarına bağlandığını ve hangi
  bölgesel rotaların UI dışında bırakıldığını kaydet.
- **Durma koşulu:** Yetki önizlemesi defteri değiştiriyorsa, hedef kapsamı
  kanonik kaynaktan türetilemiyorsa veya niyet yeni sürüme sessizce taşınıyorsa
  commit atma.

### Adım 3 — Ayrı kapanış kaydı ve şema göçünü kur

- **Amaç:** Sonuç makbuzunu değiştirmeden toplantıyı terminal ve doğrulanabilir
  bir kayıtla kapatmak.
- **Değişiklik:** Konuşma ledger şemasını bir sürüm yükselt; tekil sıra ve ayrı
  `meetingClosures` koleksiyonu ekle. `MeetingClosureRecordV1`; toplantı,
  oturum, gündem, önerge, mühürlü sürüm, sonuç makbuzu, karar, başkan aktörü,
  başkan kurumu, kapanış turu/zamanı, rota durumu ve nullable teklif kimliğini
  taşır. Toplantı `closureId` ve terminal durum kazanır. Şema-4 göçü boş kapanış
  koleksiyonu ve null referans ekler; tarihsel sonuçtan sahte kapanış üretmez.
  Validator bütün çapraz referansları, tekilliği ve terminal durumu denetler.
- **Doğrulama:** Reddedilmiş sonuç tek kapanış üretir, teklif kimliği null kalır;
  ikinci kapanış reddedilir. Açık toplantı snapshot/restore sonrası açık ve
  devam edebilir kalır. Kapanmış toplantı birebir restore olur. Tahrif edilmiş
  karar, makbuz, sürüm, başkan ve closure referansı validator tarafından
  reddedilir.
- **Rollback:** Şema sürümü, göç, koleksiyon, validator ve testleri birlikte
  revert et; eski şema-4 kabulüne dön.
- **Commit:** `feat(story): persist terminal meeting closure records`
- **Commit gövdesi:** Kapanışın sonuç makbuzundan neden ayrı tutulduğunu,
  legacy kayıtların neden backfill edilmediğini ve açık toplantı devamlılığı
  kapısını belirt.
- **Durma koşulu:** Göç tarihsel kayda karar/rota uyduruyorsa, açık toplantı
  terminal oluyorsa veya çift kapanış ikinci kayıt oluşturabiliyorsa dur.

### Adım 4 — Kabul sonucunu idempotent kurumsal teklife yönlendir

- **Amaç:** Kabul edilmiş sonucu yalnız mevcut kanonik yetki zincirine bir kez
  teklif etmek.
- **Değişiklik:** Kapanıştan önce mühürlü niyeti canlı Faz 38.9 preview ile
  tekrar doğrula. Preview başarısızsa hiçbir ledger yazma. Başarılıysa mevcut
  `storyCharacterRoleInstitutionAction({phase:'PROPOSE', ...})` yolunu bir kez
  çağır; dönen kurum isteği kimliğini kapanışa yaz. Teklif kimliğine göre
  salt-okunur geri izleme API'si closure ve outcome receipt kimliklerini
  döndürsün. Kurum isteğini onaylama veya execute etme.
- **Doğrulama:** Yetkili kabul tam bir kurum isteği ve tam bir kapanış üretir;
  tekrar çağrı `MEETING_ALREADY_CLOSED` döner ve ikinci istek yoktur. Yetkisiz,
  bayat veya tahrif edilmiş rota öncesi/sonrası konuşma, kurum ve fiziksel dünya
  snapshot farkı sıfırdır. Geri izleme, teklif kimliğinden doğru kapanışa,
  makbuza ve önerge sürümüne gider. Ret sonucu kurum adaptörünü çağırmaz.
- **Rollback:** Yönlendirme ve geri izleme API'sini revert et; Adım 3'ün
  teklifsiz kapanış kaydı geçerli kalır.
- **Commit:** `feat(story): route adopted meetings through canonical authority`
- **Commit gövdesi:** Bunun yürütme değil teklif olduğunu, kullanılan Faz
  38.9/Faz 29 kapılarını, idempotency anahtarını ve yetkisiz sıfır-fark
  kanıtını yaz.
- **Durma koşulu:** Preview başarısızlığı olay kaydı dahil herhangi bir defteri
  değiştiriyorsa, kurum isteği kapanıştan kopuk kalabiliyorsa veya aynı makbuz
  ikinci istek üretebiliyorsa dur.

### Adım 5 — Kapanış ve teklif izini oynanabilir UI'a aç

- **Amaç:** Yeni akışı yalnız test API'sinde bırakmadan toplantı çalışma
  alanından anlaşılır ve güvenli biçimde kullanmak.
- **Değişiklik:** Oylama öncesinde kanonik, hedefi eksiksiz teklif rotasını
  Türkçe etiketle seçtir. Sonuçtan sonra yalnız geçerli durumda “toplantıyı
  kapat ve kuruma teklif et” eylemini göster. Reddedilmiş sonuçta teklif sözü
  verme; kapanış rozetini göster. Kapanınca kurum isteği kimliği ve “henüz
  uygulanmadı” sınırını göster; ham status/action kodlarını oyuncuya sızdırma.
- **Doğrulama:** DOM testi yetkisiz rotayı göstermediğini, kabul kapanışını bir
  kez çalıştırdığını, çift tıklamanın ikinci istek üretmediğini, ret metninin
  teklif/uygulama iddiası taşımadığını ve yeniden renderın taslak/odak
  korumasını bozmadığını kanıtlar.
- **Rollback:** UI kontrolleri ve olay bağlarını revert et; core API kayıtları
  save/load açısından geçerli kalır.
- **Commit:** `feat(story-ui): expose authorized meeting closure controls`
- **Commit gövdesi:** Oyuncuya hangi kanonik rotaların neden gösterildiğini,
  bölgesel hedef sınırını ve çift tıklama/idempotency korumasını kaydet.
- **Durma koşulu:** UI ham mekanik kod gösterirse, yetkisiz seçenek sunarsa,
  otomatik execute/onay çağırırsa veya editör taslağını silerse dur.

### Adım 6 — Kanonik plan, durum ve ledger kaydını uzlaştır

- **Amaç:** Ana planın hedefi ile durum belgesinin gerçekleşen kanıtını yeniden
  aynı noktaya getirmek.
- **Değişiklik:** Yalnız gerçek test sonucu sonrasında ana planda bu dikeyi
  tamamlanmış kanıt olarak yaz; durum belgesinde Faz 38.13'ü `partial` tutup
  sıradaki tek dilimi özel not cevabı olarak göster. `LEDGER.md` sonuna alınan,
  reddedilen ve ertelenen tasarım kararlarını append et; eski satırları
  değiştirme.
- **Doğrulama:** İki aktif belge aynı son kapanan dikeyi ve aynı sıradaki borcu
  gösterir. Faz 39 aktif değildir. Markdown linkleri çözülür; ledger yalnız ek
  satırlar taşır.
- **Rollback:** Docs commitini bağımsız revert et; runtime commitleri kalabilir.
- **Commit:** `docs(story): record phase 38.13 meeting closure routing`
- **Commit gövdesi:** Geçen kabul kapılarını, kalan Faz 38.13 borçlarını,
  serbest kapanış eylemi tasarımının neden reddedildiğini ve Faz 39'un neden
  başlamadığını ayrıntılı yaz.
- **Durma koşulu:** Hedefli test geçmeden `completed` kanıtı yazma; Faz 38.13'ü
  bütünüyle complete veya Faz 39'u active yapma.

### Adım 7 — Hedefli kabul ve temiz çalışma ağacı kapısı

- **Amaç:** Dilimin davranış, kayıt ve belge sınırlarını tek kapanışta
  doğrulamak.
- **Değişiklik:** Dosya değiştirme; doğrulama çalıştır.
- **Doğrulama:** En az:
  `node tests/story-conversation-case.test.js`, ilgili plan frontmatter/link
  taraması, `git diff --check` ve `git status --short`. Test çıktısı closure
  sayısı, kurum isteği sayısı, idempotent tekrar, yetkisiz sıfır-fark, açık
  toplantı restore ve proposal→receipt trace değerlerini raporlamalıdır.
- **Rollback:** Son başarısız committen başlayarak bağımsız revert et.
- **Commit:** Yok.
- **Durma koşulu:** Hedefli test, validator, göç, belge eşleşmesi veya temiz
  çalışma ağacı kapılarından biri başarısızsa plan `Landed` yapılmaz.

## 6) Risk kaydı ve planın çürütülmesi

### Oylama sonrası serbest eylem seçimi kabul makbuzunu kötüye bağlayabilir

- **Kategori:** Logic / authority laundering
- **Şiddet:** High
- **Güven:** Confirmed by current model
- **Kanıt:** Mevcut önerge yalnız serbest metin taşır; Faz 38.9 teklif API'si
  `actionType` alır. Bu ikisini kapanışta serbest payload ile birleştiren bir
  bağ doğrulanamaz.
- **Çürütülen yaklaşım:** `closeMeeting(meetingId, actionType)`.
- **Karar:** Eylem niyetini oylama öncesinde kanonik preview ile mühürle; oy
  açıldıktan sonra değiştirme.

### Preview başarılı olsa bile apply çağrısı ikinci bir kontrol anında değişebilir

- **Kategori:** Atomicity / stale authority
- **Şiddet:** High
- **Güven:** Plausible
- **Kanıt:** Faz 29 kurum defteri canlı anayasa/makam imzasıyla reconcile olur;
  preview ve apply iki ayrı çağrıdır.
- **Karar:** Aynı senkron kapanış çağrısında preview → apply yap; apply başarısız
  olursa kapanış yazma. Başarısız apply'nin `ACTION_DENIED` olayı üretip
  üretmediğini test et. Yetki kaynaklı beklenen retlerin tamamını mutasyonsuz
  preview aşamasında yakala.
- **Artakalan risk:** Beklenmeyen executor hatası kurum event defterine tanı
  kaydı yazabilir. Böyle bir yol görülürse bu plan durur ve Faz 29 için ayrı
  atomik proposal adaptörü planlanır; sessiz rollback uydurulmaz.

### Kapanış kaydını outcome receipt içine gömmek geçmiş kanıtı değiştirir

- **Kategori:** Auditability
- **Şiddet:** Medium
- **Güven:** Confirmed
- **Kanıt:** `MeetingOutcomeReceiptV1` bugün `worldMutation:false` oylama kanıtıdır.
  Sonradan kurum isteği eklemek aynı nesnenin anlamını zaman içinde değiştirir.
- **Çürütülen yaklaşım:** `outcomeReceipt.proposalId = ...`.
- **Karar:** Ayrı `MeetingClosureRecordV1` ve iki yönlü doğrulanan referans.

### Otomatik actionType çıkarımı metne sahte mekanik anlam verebilir

- **Kategori:** Hallucinated mechanics
- **Şiddet:** High
- **Güven:** Confirmed by contract
- **Kanıt:** Önerge metni doğal dildir; kapalı kurum eylem kataloğuyla kanıtlı
  semantik eşleme yoktur.
- **Çürütülen yaklaşım:** anahtar sözcük/LLM ile eylem seçmek.
- **Karar:** Oyuncunun açık seçimi + kanonik rota preview; model karar vermez.

### Ret sonucunu da kuruma yönlendirmek anlamsız istek üretebilir

- **Kategori:** State semantics
- **Şiddet:** Medium
- **Güven:** Confirmed
- **Karar:** Ret yalnız kapanış kaydı üretir; `proposalId:null` değişmezdir.

### UI'da bölgesel rota göstermek eksik hedef veya başka ülke hedefi doğurabilir

- **Kategori:** Jurisdiction
- **Şiddet:** High
- **Güven:** Confirmed by Faz 29 submit contract
- **Karar:** Hedef seçicisi bu dilimde uygulanmıyorsa bölgesel rotalar UI'da
  gösterilmez. Uygulanırsa hedef yalnız kanonik aynı-ülke bölge listesinden
  gelir ve hem niyet hem kapanış anında doğrulanır.

### Ayrı konuşma ve kurum defterleri arasında tek taraflı kayıt kalabilir

- **Kategori:** Cross-ledger consistency
- **Şiddet:** High
- **Güven:** Plausible
- **Karar:** İşlem tek senkron çağrıda çalışır; proposal kimliği alındıktan sonra
  kapanış yazılır ve validator proposal→closure→receipt zincirini kontrol eder.
  Enjeksiyonla apply-sonrası hata testi tek taraflı kaydı gösterirse kapsamı
  büyütüp sahte telafi yazmak yerine plan durur; atomik domain adaptörü ayrı
  tasarlanır.

### Genel bugfix planı ve üç mikro plan aynı harness/ledger yüzeyine dokunuyor

- **Kategori:** Concurrent plan conflict
- **Şiddet:** Medium
- **Güven:** Confirmed
- **Karar:** Adım 1 ile açık bağımlılık sırası yazılmadan kaynak değişikliği
  yoktur. Diğer planların durumları değiştirilmez.

## 7) İptal ölçütleri

- Kanonik action type ile oylanan önerge sürümü arasında değiştirilemez bağ
  kurulamıyorsa plan uygulanmaz.
- Yetkisiz veya bayat rota ret yolunda konuşma/kurum defterinde olay dahil fark
  kalıyorsa kaynak commitleri durur.
- Kurum isteği yazıldıktan sonra kapanış yazımının başarısız kalabildiği bir
  test bulunursa plan bu kapsamla Landed olmaz; ayrı atomik adaptör gerekir.
- Açık toplantı save/load sonrasında kapanmış, niyetini değiştirmiş veya devam
  edemez hâle gelirse göç kabul edilmez.
- Eski şema-4 kayıtlarına tahmini niyet/kapanış yazmak gerekirse göç durur.
- UI bölgesel hedefi kanonik ülke listesi olmadan alıyorsa ilgili rota kapalı
  kalır.
- Çakışan planlardan biri uygulama sırasında `In Progress` olursa çalışma
  durur ve sıra yeniden uzlaştırılır.
- Güvenli kalıcı duraklar: Adım 1; Adım 1–2; Adım 1–3; Adım 1–4; Adım 1–5;
  Adım 1–6. Her önek kendi testleriyle tutarlı olmalıdır.

## 8) Uygulama sonrası kabul

- Yetkili ve kabul edilmiş önerge: tam bir kapanış, tam bir kurum isteği, sıfır
  doğrudan fiziksel etki.
- Reddedilmiş önerge: tam bir kapanış, sıfır kurum isteği.
- Aynı toplantıyı ikinci kapatma: kapalı hata kodu, sıfır yeni kayıt.
- Yetkisiz/bayat rota: konuşma defteri, kurum defteri ve fiziksel snapshot için
  sıfır fark.
- Teklif kimliği sorgusu: doğru kapanış, sonuç makbuzu, önerge ve aktif sürüm.
- Açık toplantı save/load: durum, sıra, oylar, niyet ve devam yeteneği birebir.
- Kapanmış toplantı save/load: kapanış ve proposal trace birebir.
- UI: yalnız kanonik/eksiksiz rota, Türkçe durum, “teklif ≠ uygulama” açıklığı,
  çift tıklamada tek istek.
- Ana plan ve durum belgesi Faz 38.13 `partial` üzerinde aynı kanıtı gösterir;
  sıradaki iş özel not cevabıdır, Faz 39 başlamaz.
- `git status --short` boş; commit geçmişi plan koordinasyonu, niyet, kapanış,
  yönlendirme, UI ve docs amaçlarını ayrı ve açıklayıcı gösterir.
