---
id: phase-38-13-institutional-paid-task
status: Approved # Kullanıcı 26 Ağustos 2026 tarihinde onayladı
owner: osman
source: Faz 38.13 / 26 Ağustos 2026 aktif uygulama sırası
touches:
  - js/StoryInstitutions.js
  - js/StoryCharacterRoleAdapters.js
  - js/StoryBudget.js
  - js/StoryConversationUnderstanding.js
  - js/Talks.js
  - tools/story-sim-harness.js
  - tests/story-conversation-case.test.js
  - tests/story-world.test.js
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
  - phase-38-13-meeting-closure-routing
  - phase-38-13-private-note-response
conflicts_with:
  - 25-agustos-hikaye-modu-toplam-bugfix-plani
  - bugfix-council-motion-atomicity
  - bugfix-story-invalid-battle-target-guard
  - electron-story-lifecycle-acceptance
created: 2026-08-26
last_touched: 2026-08-26
---

# Faz 38.13 — Yetkili, Bedelli ve Makbuzlu Kurumsal Görev

## 1) Uygulama tezi

Mevcut `TaskOfferV1` yalnız gerçek aktörler arasında, ödülsüz ve zorlamasız
bir `PERSONAL_REQUEST` üretir. Bu sözleşme korunacaktır. Yeni dikey, kişisel
görevi ücret alanı ekleyerek gevşetmek yerine ayrı bir kurumsal görev türü
kuracaktır.

Kurumsal teklif yalnız kanonik kurum defterindeki gerçek makam sahibinden
gelebilir. Görünen unvan, rol ailesi, LLM metni veya yalnız
`CANONICAL_OFFICE_BOUND` olmak yeterli değildir. Kurum katmanı açık
`COMMISSION_PAID_CONTACT_TASK` eylem rotası ve yasal dayanak üretmeli; görev
veren aktör o rotada gerekli önerme, onay ve icra zincirini gerçekten
tamamlamalıdır.

Görev yine doğrulanmış başka bir karakterle ayrı görüşme yapma hedefiyle
sınırlıdır. Oyuncu kabul ettiğinde ücret, görev veren makam sahibinin gerçek
komutan alt hesabından kanonik devlet bütçesi escrow hesabına alınır. Görev
başarıyla tamamlandığında escrow, oyuncunun gerçek komutan alt hesabına
aktarılır; süre aşımı veya iptal halinde aynı kaynak hesaba geri döner.
Konuşma defteri para yaratmaz ve bütçe defterinin yerine geçmez.

Tamamlama, yalnız hedef görüşmenin kapanış makbuzu ile ödeme işlemlerini
birbirine bağlayan değiştirilemez bir `InstitutionalTaskReceiptV1` üretir.
Aynı görev ikinci kez tamamlanamaz veya ödenemez. Ödeme başarısızsa görev
`COMPLETED` görünmez.

**Done:** Gerçek makam sahibi ve kanonik görev-ihale yetkisi bulunan bir
karakter, gerçek bakiyesi yeterliyse oyuncuya kaynaklı bir görüşme görevi
önerir. Kabul escrow ayırır; ret para hareketi üretmez; doğru hedef görüşmesi
tek ödeme ve tek sonuç makbuzu üretir; süre aşımı escrow'u tek kez iade eder.
Yetkisiz unvan, yetersiz bakiye, tahrif edilmiş hesap/kurum/fiş, çift kabul,
çift tamamlama ve restore tekrarı sıfır yetkisiz mutasyonla reddedilir.

**Recommendation:** İnsan onayından ve çakışan planların sıraya alınmasından
sonra uygulanmalıdır. Tahmin tek geliştirici için yaklaşık **10 kişi-gün**dür.

## 2) Değişmezler

- Mevcut ödülsüz `PERSONAL_REQUEST` davranışı ve geçmiş kayıtları değişmez.
- Kurumsal görev yalnız `TASKS_JOBS` kipinde ve açık gerçek konuşma
  oturumunda oluşturulur.
- Görev veren, oturum muhatabıdır; istemci başka veren, kurum, ülke, ödeme
  hesabı veya yetki rotası seçemez.
- Kurumsal görev veren aktif gerçek karakter ve kanonik kurum
  `officeHolder` kaydıyla birebir eşleşmelidir. Proxy, kolektif/vacant makam
  veya yalnız görünen unvan yeterli değildir.
- `COMMISSION_PAID_CONTACT_TASK` açık kurum eylemidir. Başka bir eylemde
  `canPropose/canApprove/canExecute` sahibi olmak görev ihale yetkisine
  çevrilemez.
- Anayasal rota için gereken bütün kurum onayları gerçek kurum isteğinde
  tamamlanmadan görev teklifi açılamaz.
- İlk dikeyin hedefi yalnız `HOLD_CONVERSATION` ve minimum bir tamamlanmış
  ayrı görüşmedir. Serbest metin emir veya fiziksel iş hedefi yoktur.
- Hedef karakter kanonik, aktif, erişilebilir, oyuncu ve görev verenden farklı
  olmalıdır.
- Ücret pozitif, kapalı politika aralığında ve `STATE_CREDIT` cinsindedir;
  istemci veya doğal dil tutarı belirleyemez.
- Ödeme kaynağı görev veren aktöre karşılık gelen gerçek komutan alt hesabıdır.
  Bu eşleme kanıtlanamıyorsa ücretli görev üretilemez.
- Ödeme alıcısı oturumun oyuncu aktörüne karşılık gelen `STORY.commander`
  alt hesabıdır. Ayrı kişisel cüzdan veya görünmez para defteri kurulmaz.
- Teklif üretmek para hareketi değildir. `ACCEPT` atomik escrow
  rezervasyonudur; rezervasyon başarısızsa durum `OFFERED` kalır.
- `DECLINE` hiçbir para hareketi üretmez. Kabul edilmiş görevin süre aşımı
  escrow'u yalnız bir kez kaynak hesaba döndürür.
- Tamamlama önce escrow ödeme kapısını geçer, sonra görev durumunu
  `COMPLETED` yapar ve tek sonuç makbuzu yazar. Kısmi ödeme veya makbuzsuz
  tamamlanma yoktur.
- Aynı ülke ödemesi komutan alt hesapları arasında gerçek değer aktarır;
  ülke toplam nakdini yapay biçimde artırıp azaltmaz. Ülkeler arası ödeme iki
  ülkenin dengeli debit/credit fişlerini taşır.
- Bütçe escrow kaydı, konuşma görevi ve kurum isteği karşılıklı
  `correlationId` ile bağlanır; kimliklerden hiçbiri istemciden alınmaz.
- Başarısız yetki, rezervasyon, ödeme, iade veya restore yolunda ilgili
  defterlerin önce/sonra farkı sıfır olmalıdır.
- Save/load açık teklif, kabul edilmiş escrow, terminal görev ve sonuç
  makbuzunu birebir korur; restore ödeme veya iade çağırmaz.
- Eski `TaskOfferV1` kayıtları kişisel/ödülsüz anlamıyla göçer. Geçmişe
  kurum, ücret, escrow veya makbuz uydurulmaz.
- Şirket bütçesi, şirket yöneticisi görevi ve şirketten oyuncuya ödeme bu
  dilimde yoktur.
- LLM/rastgelelik yetki, hedef, ücret, sonuç veya ödeme kararı vermez.
- Yeni bağımlılık ve ağ erişimi eklenmez.
- Her commit tek amaçlı, doğrulanmış ve bağımsız geri alınabilir olur.

## 3) Kapsam dışı

- Şirket görevleri, şirket escrow'u, maaş bordrosu ve kişisel banka/cüzdan
  sistemi.
- Mal teslimi, inşaat, sabotaj, savaş, lojistik veya başka fiziksel görev
  hedefleri.
- Serbest metinden görev, ücret, kurum yetkisi ya da başarı koşulu çıkarmak.
- Zorunlu emir, ceza, görev başarısızlığı yaptırımı veya ilişki puanı.
- Kısmi ödeme, avans, prim, vergi, ücret pazarlığı ve çoklu para birimi.
- Bir görevi birden fazla oyuncu/karaktere bölmek veya alt görev zinciri.
- Mevcut kişisel görevi ücretliye dönüştürmek.
- Yönlü ilişki sonuç fişleri; Faz 38.13 içinde sonraki ayrı borçtur.
- Faz 38.13'ü bütünüyle `complete` veya Faz 39'u `active` ilan etmek.
- Dört genel Draft planın içeriklerini uygulamak.

## 4) Önkoşullar ve plan çakışması çözümü

- Kullanıcı bu dosyayı insan kararıyla `Draft → Approved` yapmalıdır.
- `phase-38-13-private-note-response`,
  `phase-38-13-meeting-closure-routing`,
  `25-agustos-belge-hedefleme-duzeni` ve
  `worktree-reconciliation-no-delete` `Landed` olmalıdır.
- Çalışma ağacı temiz ve hedef branch
  `atlas/worktree-reconciliation-2026-08-26` olmalıdır.
- `AGENTS.md` mevcut değildir; bu plan kapsamında oluşturulmaz.
- Dört canlı Draft plan geniş kurum, bütçe, `Story*.js`, `Talks.js`,
  harness, test ve ledger yüzeylerinde bu planla çakışır. Kaynak
  değişikliğinden önce her birine
  `phase-38-13-institutional-paid-task` bağımlılığı ve karşılıklı conflict
  kaydı eklenir. Durumları `Draft` kalır.
- Hiçbir plan 26 Ağustos 2026 itibarıyla bayat değildir.
- 26 Ağustos başlangıç bazı
  `node tests/story-conversation-case.test.js` ile temizdir:
  `taskCompleted:COMPLETED`, 4 toplantı katılımcısı, 37 kamusal tur,
  5 özel kayıt, 2 özel yanıt ve 2 göçmüş oturum.
- Kurum ve bütçe değişikliği nedeniyle hedefli konuşma testine ek olarak
  `tests/story-world.test.js` içindeki ilgili kurum/bütçe görevleri temiz
  geçmelidir.

## 5) Adım dizisi

| # | Adım | Tür | Ana dosyalar | Risk | Tek başına geri alınabilir |
|---|---|---|---|---|---|
| 1 | Çakışan Draft planları bu dilimin arkasına sırala | Mechanical | dört `plans/*.md` | Low | Yes |
| 2 | Açık görev-ihale eylemini kurum yetki şemasına ekle | Behavioral/Migration | Institutions, role adapter, world test | High | Yes |
| 3 | Kurumsal görev escrow rezervasyon/iadeyi bütçeye ekle | Behavioral/Migration | Budget, world test | Critical | Yes |
| 4 | `TaskOfferV2` birlik sözleşmesi ve kayıpsız göçü kur | Additive/Migration | Understanding, harness, conversation test | High | Yes |
| 5 | Yetkili kurumsal teklif ve atomik kabul/ret yolunu ekle | Behavioral | Understanding, institutions, budget, test | Critical | Yes |
| 6 | Tamamlama ödeme kapısı ve `InstitutionalTaskReceiptV1` ekle | Behavioral | Understanding, budget, test | Critical | Yes |
| 7 | Süre aşımı, iade, tahrif ve save/load kapılarını kilitle | Test/Validation | Budget, Understanding, harness, tests | Critical | Yes |
| 8 | Kişisel/kurumsal ayrımını UI'a aç | Additive | Talks, conversation test | Medium | Yes |
| 9 | Ana plan, durum ve ledger kayıtlarını uzlaştır | Documentation | iki aktif belge, LEDGER | Low | Yes |
| 10 | Hedefli ve birleşik kabul; temiz çalışma ağacı | Mechanical | çalışma ağacı | Medium | N/A |

### Adım 1 — Çakışan Draft planları sırala

- Dört Draft plana bu planı `depends_on` ve `conflicts_with` olarak ekle.
- Durumlarını, bulgularını veya uygulama kapsamlarını değiştirme.
- Bağımlılık döngüsü veya başka `In Progress` plan görülürse dur.
- **Doğrulama:** Frontmatter, karşılıklı conflict, döngüsüz bağımlılık ve
  yalnız metadata diff'i.
- **Commit:** `docs(plans): serialize phase 38.13 institutional paid tasks`

### Adım 2 — Görev-ihale yetkisini kanonikleştir

- Kurum eylem kataloğuna dar
  `COMMISSION_PAID_CONTACT_TASK` eylemini ekle.
- Eylem yalnız gerçek kurum rotası, anayasal gereksinimler ve gerçek
  `officeHolder` üzerinden önerilebilir/onaylanabilir/icra edilebilir.
- Role adapter bu eylemi yalnız mevcut `authorityGrants` içinden yayınlar;
  rol/unvan veya başka action grant'inden türetmez.
- Kurum isteği kaynak görev vaka kimliğini, hedef türünü ve sabit ücret
  politikasını taşır; fiziksel dünya etkisi `false` kalır.
- Eski kurum snapshotı kanıtlanmamış geçmiş istek üretmeden yeni politika
  karmasına güvenli biçimde uzlaştırılır.
- **Doğrulama:** Gerçek direkt rota başarılı; unvanlı ama makamsız karakter,
  proxy makam, yanlış kurum, eksik ortak onay ve eski/stale makam kapalı hata.
- **Commit:** `feat(story): authorize paid contact task commissions`
- **Durma koşulu:** Yetki, yalnız role/family/title veya istemci eylem adıyla
  elde edilebiliyorsa commit atma.

### Adım 3 — Bütçe escrow yaşam döngüsünü ekle

- Devlet bütçesi şemasını geriye uyumlu biçimde sürümle; kurumsal görev için
  ayrı escrow hesabı ve `INSTITUTIONAL_TASK_ESCROW` settlement türü ekle.
- `reserve/release/settle` API'leri kapalı girdi sözleşmesi, sonlu pozitif
  miktar, gerçek payer/payee state+commander ve tekil `correlationId` ister.
- Rezervasyon yalnız görev veren komutan alt hesabından para çıkarır; başka
  komutanın parasını sessizce kullanmaz.
- İade aynı payer hesabına, ödeme oyuncu komutan hesabına gider.
- Aynı ülke ve ülkeler arası çift taraflı muhasebe ayrı doğrulanır.
- Bütün uçlar idempotenttir; farklı tutar/hesapla aynı correlation kimliği
  `IDEMPOTENCY_CONFLICT` üretir.
- **Doğrulama:** Nakit+escrow korunumu, dengeli journal, yetersiz bakiye sıfır
  fark, tek iade/ödeme, ikinci çağrı duplicate ve save/load birebir.
- **Commit:** `feat(story-budget): reserve institutional task compensation`
- **Durma koşulu:** Rezervasyon bütçe mirror mismatch yaratırsa, ödeme para
  yaratırsa veya geri alma alıcının sonraki harcamasına bağlıysa dur.

### Adım 4 — `TaskOfferV2` birlik sözleşmesi ve göç

- Görev kaydını `PERSONAL_CONTACT_REQUEST | INSTITUTIONAL_PAID_CONTACT_TASK`
  ayrımını taşıyan sürüm 2 birlik sözleşmesine yükselt.
- Kişisel dal mevcut
  `PERSONAL_REQUEST / reward:NONE / worldMutation:false` değişmezlerini
  aynen korur.
- Kurumsal dal; kurum isteği, kurum/ülke, yasal dayanak, görev veren payer
  hesabı, sabit ücret, escrow kimliği ve sonuç makbuzu alanlarını açık taşır.
- Durum makinesi kurumsal dal için
  `OFFERED → ACCEPTED → COMPLETED|EXPIRED` akışını; ret yolunu ve ödeme
  alt durumunu doğrular.
- Konuşma defteri şeması yalnız gerekiyorsa yükseltilir; şema-6 ve
  `TaskOfferV1` göçü hiçbir kurum/ücret/fiş uydurmaz.
- **Doğrulama:** Eski kişisel görev aynı davranışla göçer; union dal alanları
  karıştırılırsa validator reddeder; açık/terminal snapshot birebir.
- **Commit:** `feat(story): version personal and institutional task offers`

### Adım 5 — Yetkili teklif ve atomik karar

- Kurumsal preview; muhatabın gerçek kurum binding'ini, görev ihale rotasını,
  tamamlanabilir hedefi, payer commander hesabını ve politika ücretini
  salt-okunur çözer.
- Create, kanonik kurum isteğini gerekli gerçek onay/icra zincirinden geçirir
  ve sonuç kimliğini göreve mühürler. Rota tek konuşma eyleminde tamamlanamıyorsa
  açık hata verir; sahte onay üretmez.
- Aynı oturumda açık kişisel veya kurumsal görev çoğaltılmaz.
- `ACCEPT` önce bütçe escrow rezervasyonunu yapar; yalnız başarıdan sonra
  görev `ACCEPTED` olur. `DECLINE` rezervasyon oluşturmaz.
- **Doğrulama:** Yetkili+yeterli bakiye kabul; yetkisiz makam, sahte unvan,
  yanlış payer, yetersiz bakiye ve çift kabul sıfır kısmi durum.
- **Commit:** `feat(story): open authority-bound paid contact tasks`
- **Durma koşulu:** Kurum isteği başarılı olup görev yazımı başarısız
  olduğunda güvenli geri dönüş/iptal kaydı üretilemiyorsa dur.

### Adım 6 — Makbuzlu tamamlama ve ödeme

- Doğru hedefle, görev teklifinden farklı bir oturumun gerçek kapanışı tek
  tamamlanma adayıdır.
- Escrow settlement başarıyla oyuncu komutan hesabına geçmeden görev
  `COMPLETED` yapılmaz.
- `InstitutionalTaskReceiptV1`; task, source session, completion session,
  kurum request, authority legal basis, reservation, payer/payee transaction,
  amount/currency ve zaman kimliklerini taşır.
- Makbuz görevden ve bütçe settlement'ından karşılıklı doğrulanır.
- Aynı tamamlanma oturumu veya tekrar hedef görüşmesi ikinci ödeme üretmez.
- **Doğrulama:** Tamamlama öncesi/sonrası payer, payee, escrow ve toplam değer
  denklemi; tek makbuz; ikinci çağrı duplicate; bozuk settlement kapalı hata.
- **Commit:** `feat(story): settle receipt-backed institutional tasks`
- **Durma koşulu:** Ödeme ile görev durum/makbuz yazımı atomik veya güvenli
  telafi edilebilir değilse `COMPLETED` yazma.

### Adım 7 — Süre aşımı ve adversarial bütünlük

- `OFFERED` süre aşımı para hareketi olmadan kapanır.
- `ACCEPTED` süre aşımı escrow'u tek kez iade ettikten sonra `EXPIRED`
  olur; iade başarısızsa terminal durum yazılmaz.
- Restore yalnız veri doğrular; settle/release yan etkisi çalıştırmaz.
- Tahrif testleri kurum, actor↔commander, payer/payee, ücret, correlation,
  escrow, completion session ve receipt çapraz bağlarını kapsar.
- Aynı/ülkeler arası ödeme, yetersiz bakiye, çift tıklama, tekrar tick,
  save-load ve eski göç fixture'ları eklenir.
- **Doğrulama:** `node tests/story-conversation-case.test.js` ve ilgili
  `tests/story-world.test.js` görevleri.
- **Commit:** `test(story): lock institutional task payment invariants`

### Adım 8 — UI ayrımını aç

- Kişisel kart mevcut “zorlayıcı yetki yok / ödül yok” dilini korur.
- Kurumsal kart gerçek kurum, yasal dayanak, görev bedeli, para birimi,
  escrow/ödeme durumu ve hedefi Türkçe gösterir.
- UI yalnız preview'in izin verdiği kurumsal teklif eylemini sunar; kurum,
  ücret veya hesap girdisi açmaz.
- Kabul hatasında başarı bildirimi gösterilmez; yetersiz bakiye ve yetki
  eksikliği kapalı Türkçe hata olarak görünür.
- Makbuz görünümü teknik gizli veriyi değil doğrulanabilir kurum, tutar,
  tamamlanma ve ödeme durumunu gösterir.
- **Doğrulama:** DOM kişisel/kurumsal kartı ayırır; ham hata/hesap kimliği
  sızdırmaz; çift tıklama tek rezervasyon ve tek ödeme bırakır.
- **Commit:** `feat(story-ui): expose paid institutional task receipts`

### Adım 9 — Kanonik belgeleri uzlaştır

- Ana plana yeni dikeyin yetki, escrow, tamamlanma ve makbuz sözleşmesini yaz.
- Durum belgesinde Faz 38.13 `partial` kalır. Kurumsal devlet görevi kapanır;
  şirket görevleri ve yönlü ilişki fişleri açık borç kalır.
- Faz 39 aktif yapılmaz.
- `LEDGER.md` sonuna uygulanan sözleşme ile reddedilen “unvanı yetki sayma /
  konuşma defterinde para yaratma” yaklaşımını append-only kaydet.
- **Doğrulama:** İki kanonik belge aynı kapsamı ve sıradaki borcu gösterir;
  Markdown bağlantıları çözülür; ledger yalnız ek satır taşır.
- **Commit:** `docs(story): record receipt-backed institutional tasks`

### Adım 10 — Kabul ve kapanış

- `node tests/story-conversation-case.test.js`
- İlgili kurum/bütçe `tests/story-world.test.js` görevleri; görev seçimi
  kesinleştirildikten sonra plan kanıtına tam komut yazılır.
- Plan frontmatter, karşılıklı conflict ve yerel Markdown link taraması.
- `git diff --check`
- `git status --short`
- Commit zinciri metadata, yetki, bütçe, görev şeması, davranış, makbuz,
  adversarial test, UI ve belge amaçlarını ayrı göstermelidir.
- Bütün kapılar geçmeden plan `Landed` yapılmaz.

## 6) Risk kaydı ve planın çürütülmesi

### Görünen makamı görev verme yetkisi saymak yetki aklar

- **Kategori:** Authority laundering
- **Şiddet:** Critical
- **Güven:** Confirmed
- **Kanıt:** Rol adaptörü açıkça `titleGrantsAuthority:false` taşır.
- **Çürütülen yaklaşım:** `CANONICAL_OFFICE_BOUND` görülen her aktöre ücretli
  görev açtırmak veya başka action grant'ini “görev verebilir” diye yorumlamak.
- **Karar:** Ayrı `COMMISSION_PAID_CONTACT_TASK` rotası ve tamamlanmış gerçek
  kurum isteği zorunlu.

### TaskOffer içine reward amount yazmak gerçek ödeme değildir

- **Kategori:** Economic integrity
- **Şiddet:** Critical
- **Güven:** Confirmed
- **Kanıt:** Konuşma defteri karakter cüzdanı değildir; mevcut kişisel görev
  özellikle `reward:NONE` taşır.
- **Çürütülen yaklaşım:** Yalnız `reward:{amount:...}` ekleyip tamamlamada
  başarı metni göstermek.
- **Karar:** Kanonik bütçe escrow'u, gerçek payer/payee alt hesapları ve dengeli
  journal fişleri.

### Devlet bütçesinden düşüp alıcı hesabı olmadan “ödendi” demek para yok eder

- **Kategori:** Double-entry / player reward
- **Şiddet:** Critical
- **Güven:** Confirmed
- **Kanıt:** Hikâye karakterlerinin bağımsız kişisel cüzdanı yok; oyuncu
  karakteri gerçek `STORY.commander` alt hesabına bağlıdır.
- **Çürütülen yaklaşım:** `storyBudgetDebit` çağırıp konuşma makbuzunu alıcı
  saymak veya yeni gizli kişisel bakiye açmak.
- **Karar:** Oyuncu komutan alt hesabına gerçek transfer. Eşleme yoksa teklif
  yok.

### Teklif anında ödeme yapmak kabul ve süre aşımını anlamsızlaştırır

- **Kategori:** Agency / settlement
- **Şiddet:** High
- **Güven:** Confirmed
- **Çürütülen yaklaşım:** Offer create sırasında doğrudan payer→player
  transferi.
- **Karar:** Teklif parasız; kabul escrow; tamamlama settle; expiry release.

### Kabulde doğrudan ödeme ve sonra geri istemek harcanmış paraya bağlıdır

- **Kategori:** Reversibility
- **Şiddet:** Critical
- **Güven:** Confirmed
- **Çürütülen yaklaşım:** Kabulde oyuncuya ödeme, expiry'de ters transfer.
- **Karar:** Oyuncunun harcayamadığı bütçe escrow'u kullanılmalı.

### Tamamlandı durumunu ödemeden önce yazmak hayalet başarı üretir

- **Kategori:** Atomicity
- **Şiddet:** Critical
- **Güven:** Confirmed
- **Çürütülen yaklaşım:** Önce `status=COMPLETED`, sonra bütçe settle.
- **Karar:** Ödeme kapısı ve makbuz başarıdan önce; hata halinde görev
  `ACCEPTED` kalır.

### Genel ASSET:TRADE_ESCROW hesabını sessizce yeniden kullanmak uzlaşmaları karıştırır

- **Kategori:** Accounting schema
- **Şiddet:** High
- **Güven:** Confirmed
- **Kanıt:** Bütçe validatorü aktif ülke escrow toplamını
  `ASSET:TRADE_ESCROW` ile karşılaştırır.
- **Çürütülen yaklaşım:** Yeni settlement türünü şema ve doğrulayıcıyı
  sürümlemeden mevcut ticaret escrow'una eklemek.
- **Karar:** Ayrı görev escrow hesabı/türü ve kayıpsız bütçe göçü.

### Kurum isteğini offer create içinde yarım bırakmak resmî kayıt çöpü üretir

- **Kategori:** Cross-ledger atomicity
- **Şiddet:** High
- **Güven:** Likely
- **Çürütülen yaklaşım:** Kurum isteğini oluşturup sonraki adım başarısızken
  açık `AUTHORIZED/EXECUTED` kaydı bırakmak.
- **Karar:** Ön doğrulama, tekil correlation ve başarısız görev yazımında
  açık `CANCELLED` telafi kaydı; sessiz silme yok.

### Şirket yöneticisini aynı dikeye almak iki farklı muhasebe modelini karıştırır

- **Kategori:** Scope / accounting ownership
- **Şiddet:** High
- **Güven:** Confirmed
- **Kanıt:** Şirket ödemesi `StoryCompanies` escrow'u, devlet ödemesi
  `StoryBudget` komutan alt hesaplarını kullanır.
- **Çürütülen yaklaşım:** Tek `reward` dalıyla devlet ve şirket payer'ı.
- **Karar:** İlk dikey yalnız devlet kurumu; şirket görevi ayrı plan.

### Görev metnini başarı koşulu saymak serbest metinden dünya sonucu üretir

- **Kategori:** Prompt injection / completion fraud
- **Şiddet:** High
- **Güven:** Confirmed
- **Çürütülen yaklaşım:** “X ile konuş ve Y yaptır” metnini tamamlanmış domain
  işi saymak.
- **Karar:** İlk hedef yalnız gerçek ayrı görüşme kapanışı; fiziksel/domain
  sonuç yok.

### Restore sırasında tick/settle çağırmak ikinci ödeme üretebilir

- **Kategori:** Persistence / idempotency
- **Şiddet:** Critical
- **Güven:** Confirmed by lifecycle
- **Çürütülen yaklaşım:** Restore sonrasında terminal görevi yeniden reconcile
  edip ödeme çağırmak.
- **Karar:** Restore salt doğrulama; yaşam döngüsü yalnız açık kullanıcı/tick
  eyleminde ve correlation idempotency ile ilerler.

## 7) İptal ölçütleri

- Gerçek görev veren aktörü kanonik kurum office holder ve komutan alt hesabına
  aynı anda bağlayamıyorsak uygulama başlamaz.
- Açık görev-ihale yetkisi kurum şemasına rol/unvan dışı kanıtla
  eklenemiyorsa kurumsal teklif üretilmez.
- Bütçe rezervasyonu wallet mirror ve çift taraflı muhasebe değişmezlerini
  birlikte koruyamıyorsa ücretli görev kapsamdan çıkarılır; sahte ödüle
  düşülmez.
- Kurum isteği, konuşma görevi ve bütçe escrow'u arasında güvenli atomiklik
  veya açık telafi kaydı kurulamıyorsa plan durur.
- Yetersiz bakiye ya da settle/release hatası kısmi defter mutasyonu
  bırakıyorsa commit atılmaz.
- Eski bütçe/kurum/konuşma snapshotları semantik uydurmadan göçemiyorsa şema
  değişiklikleri kabul edilmez.
- Tahrif edilmiş payer/payee/amount/correlation/receipt bağı restore
  sırasında kabul edilirse plan `Landed` olmaz.
- Dört çakışan Draft plan sıra bağı kurulmadan kaynak değişikliği başlamaz.
- Çakışan planlardan biri `In Progress` olursa sıra yeniden uzlaştırılır.

## 8) Uygulama sonrası kabul

- Kişisel görev: önceki ödülsüz davranış ve test sonucu değişmez.
- Yetkili kurumsal görev: gerçek makam, açık commission action, yasal dayanak,
  gerçek payer ve gerçek hedef.
- Yetkisiz unvan/proxy/yanlış kurum/eksik onay: teklif yok, sıfır mutasyon.
- Kabul: payer nakdi ücret kadar azalır, görev escrow'u aynı miktar artar,
  ülke toplam değeri korunur.
- Ret: para, escrow ve kurum sonucu değişmez.
- Tamamlama: escrow sıfırlanır, oyuncu komutan hesabı ücret kadar artar, tek
  ödeme ve tek görev makbuzu oluşur.
- Süre aşımı: kabul edilmiş görevde para tek kez gerçek payer'a döner.
- Yetersiz bakiye: görev `OFFERED` kalır; kurum/bütçe/konuşma kısmi farkı
  yoktur.
- İdempotency: çift kabul, çift tick, çift tamamlama ve restore sonrası tekrar
  ikinci para hareketi üretmez.
- Tahrif: kurum, hesap, miktar, escrow, oturum veya makbuz bağı bozulursa save
  doğrulaması kapalı hata verir.
- Save/load: OFFERED, ACCEPTED+RESERVED, COMPLETED+SETTLED ve
  EXPIRED+RELEASED durumları birebir.
- UI: kişisel ve kurumsal kart ayrıdır; kurum, yasal dayanak, tutar, escrow ve
  makbuz durumu doğru Türkçe görünür.
- Ana plan ve durum belgesi Faz 38.13 `partial` üzerinde eşleşir; şirket
  görevleri ve yönlü ilişki fişleri açık kalır, Faz 39 başlamaz.
- Kapanış çalışma ağacı temizdir.
