---
id: phase-38-13-directional-relationship-result-receipts
status: Approved # Kullanıcı 26 Ağustos 2026 tarihinde onayladı
owner: osman
source: Faz 38.13 / 26 Ağustos 2026 aktif uygulama sırası
touches:
  - js/StoryRelationships.js
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
  - phase-38-13-institutional-paid-task
conflicts_with:
  - 25-agustos-hikaye-modu-toplam-bugfix-plani
  - bugfix-council-motion-atomicity
  - bugfix-story-invalid-battle-target-guard
  - electron-story-lifecycle-acceptance
created: 2026-08-26
last_touched: 2026-08-26
---

# Faz 38.13 — Yönlü İlişki Sonuç Fişleri

## 1) Uygulama tezi

Toplantı oyu veya görev durumu tek başına dostluk/husumet puanı değildir.
Bu dikey yalnız kanonik toplantı ve görev sonuçlarını, kaynağına geri izlenen
`RelationshipResultReceiptV1` kayıtlarına dönüştürür. Yön her zaman sonucu
yorumlayan karakterden oyuncuya doğrudur; oyuncunun karaktere bakışı otomatik
ve simetrik değişmez.

Görev verenin oyuncuya bakışı, oyuncunun kabul ettiği gerçek görevi
tamamlamasıyla olumlu; kabul ettiği görevi süre aşımına bırakmasıyla olumsuz
değişebilir. Teklifi reddetmek veya kabul edilmemiş teklifin süresinin dolması
taahhüt ihlali değildir. Kişisel ve kurumsal görev aynı sosyal sözleşmeyi
kullanır; ödeme makbuzu sosyal fişin yerine geçmez.

Toplantıda yalnız oyuncunun önergesinin kabul edilmesi ve hem oyuncu hem ilgili
katılımcının güncel önerge sürümüne `YES` vermesi kaynaklı ortak başarıdır.
Ret, çekimserlik, karşı oy veya reddedilmiş önerge kişisel husumet değildir.
Her oyuncu dışı katılımcı için `APPLIED` veya gerekçeli `NO_CHANGE` fişi
yazılır; böylece puanın neden değişmediği de denetlenebilir kalır.

Fiş ilişki defterinin sahipliğindedir. Konuşma defteri görev/toplantı sonucuna
yalnız fiş kimliğini bağlar. Sabit politika, yön, kaynak, önce/sonra eksenleri,
edge sürümü ve soğuma doğrulanır; restore hiçbir sonucu yeniden uygulamaz.

**Done:** Kabul edilmiş kişisel/kurumsal görev tamamlanması ve süre aşımı ile
toplantı ortak başarısı tekil, kaynaklı ve yalnız `karakter → oyuncu` yönünde
fiş üretir. Anlamsız sonuçlar açık `NO_CHANGE` taşır. Tekrar çağrı, aynı
kaynak, soğuma, ters yön, tahrif, eski kayıt göçü ve save/load ikinci mutasyon
üretmez.

**Recommendation:** İnsan `Draft → Approved` kararı ve canlı Draft planların
bu planın arkasına sıralanmasından sonra uygulanmalıdır. Tahmin tek geliştirici
için yaklaşık **7–9 kişi-gün**dür.

## 2) Değişmezler

- Mevcut beş eksen korunur; altıncı puan veya ikinci ilişki motoru açılmaz.
- Her fiş gerçek, aktif ve farklı iki kanonik aktör ister.
- Yön yalnız yorumlayan karakterden oyuncuya gider; ters ve üçüncü kenarlar
  byte-byte aynı kalır.
- İstemci, LLM, UI veya doğal dil tür, yön, delta, kaynak, süre ve uygulama
  kararı seçemez.
- `ACCEPTED → COMPLETED`, `TASK_COMMITMENT_KEPT` üretir:
  `trust +250`, `respect +150`, `hostility -100`; korku ve borç değişmez.
- `ACCEPTED → EXPIRED`, `TASK_COMMITMENT_BROKEN` üretir:
  `trust -600`, `respect -250`, `hostility +350`; korku ve borç değişmez.
- `DECLINED` veya kabul edilmemiş expiry ilişki fişi üretmez.
- Kurumsal görev fişi yalnız ödeme/tamamlama makbuzu geçerliyse yazılır; para
  hareketi ilişki fişinden türetilmez.
- Toplantıda yalnız `ADOPTED + player YES + observer YES` uygulanır.
- `MEETING_SHARED_SUCCESS`, `trust +180`, `respect +160`,
  `hostility -80` uygular; korku ve borç değişmez.
- `NO/ABSTAIN`, oyuncunun `NO/ABSTAIN` oyu veya `REJECTED` sonuç sıfır
  delta ve gerekçeli `NO_CHANGE` fişi üretir.
- Aynı kaynak+yorumlayan+hedef yalnız tek fiş üretebilir.
- Aynı çift ve aynı yorum ailesi 300 saniye `STORY.clock` soğuması taşır.
  Soğumadaki gerçek sonuç `NO_CHANGE / COOLDOWN_ACTIVE` olarak saklanır.
- Görev ve toplantı aileleri birbirinin soğumasını tüketmez.
- Delta yalnız sabit politika tablosundan gelir ve mevcut 0–10000 clamp'ini
  kullanır; gerçek önce/sonra değerleri fişte tutulur.
- Fiş kaynak türü/kimliği, yön, yorum, karar, delta, önce/sonra, ilişki
  kimliği/sürümü, soğuma anahtarı ve zamanı taşır.
- `APPLIED` fişi `relationshipMutation:true`; `NO_CHANGE` false taşır.
  İkisi de `physicalMutation:false`tır.
- Toplantı kapanışı bütün katılımcı fişlerini veya hiçbirini yazar.
- Görev terminal geçişi bütçe/görev/ilişki kayıtlarını atomik doğrular.
- Canlı kaynakça işaretlenen fiş budanamaz; fiş tavanı konuşma tavanlarını
  karşılayacak büyüklükte ve kapalıdır.
- İlişki şema-1 defteri kayıpsız göçer; geçmişe sonuç fişi uydurulmaz.
- Konuşma şema-6, `TaskOfferV2` ve `MeetingOutcomeReceiptV1` boş fiş
  referanslarıyla göçer; eski sonuçlar yeniden uygulanmaz.
- Selamlaşma, tekrar cümlesi, kip değişimi, özel not ve teklif oluşturma sonuç
  fişi üretmez.
- UI yalnız oyuncunun taraf olduğu anlaşılır sonucu gösterir; ham/gizli ilişki
  verisini sızdırmaz.
- Yeni bağımlılık ve ağ erişimi eklenmez.
- Her commit tek amaçlı, doğrulanmış ve bağımsız geri alınabilir olur.

## 3) Kapsam dışı

- Doğrulanmış yalan, tehdit, hakaret, gizlilik ihlali veya söz sonucunu yeni
  konuşma semantiği olarak üretmek.
- Oy farklılığını sadakatsizlik/ihanet saymak veya oyuncu→karakter kenarını
  otomatik değiştirmek.
- Devletler arası `STORY.rel` puanları ya da yeni kişilik/itibar eksenleri.
- Kurumsal görev ödeme/escrow politikasını değiştirmek ve şirket görevi eklemek.
- Önergeyi kurum teklifinden doğrudan fiziksel uygulamaya çevirmek.
- Eski kayıtları geriye dönük puanlamak.
- Faz 38.13'ü tamamen `complete` veya Faz 39'u `active` ilan etmek.
- Dört genel Draft planın bulgularını uygulamak.
- Kullanıcının onayladığı krizli dünyaları engellemek için genel gıda/yaşam
  eşiklerini değiştirmek veya testleri zayıflatmak.

## 4) Önkoşullar ve plan çakışması çözümü

- Kullanıcı bu dosyayı insan kararıyla `Draft → Approved` yapmalıdır.
- Beş `depends_on` planı `Landed` olmalıdır.
- Ağaç temiz, branch `atlas/worktree-reconciliation-2026-08-26` olmalıdır.
- `AGENTS.md` mevcut değildir ve bu kapsamda oluşturulmaz.
- Dört canlı Draft plan çakışır. Kaynak değişikliğinden önce her birine bu plan
  `depends_on` ve karşılıklı `conflicts_with` olarak eklenir; Draft kalırlar.
- 26 Ağustos 2026 itibarıyla bayat canlı plan yoktur.
- Başlangıç `node tests/story-conversation-case.test.js` temizdir: görev
  `COMPLETED`, 4 katılımcı, 37 tur, 5 özel kayıt, 2 yanıt, 2 göçmüş oturum.
- Genel `tests/story-world.test.js` kullanıcının değişken bıraktığı kriz/gıda
  eşiğinde durur. Assertion zayıflatılmaz; hedefler ayrı işçilerle sınanır.

## 5) Adım dizisi

| # | Adım | Tür | Risk | Commit |
|---|---|---|---|---|
| 1 | Çakışan Draft planları bu dilimin arkasına sırala | Mechanical | Low | `docs(plans): serialize directional relationship receipts` |
| 2 | İlişki defterine sürümlü/idempotent sonuç fişi ekle | Behavioral/Migration | High | `feat(story-relations): add source-bound result receipts` |
| 3 | Konuşma/görev/toplantı şemalarını fiş referanslarıyla sürümle | Additive/Migration | High | `feat(story): version conversation relationship result links` |
| 4 | Görev terminal sonuçlarını atomik bağla | Behavioral | Critical | `feat(story): settle task commitments into directional relations` |
| 5 | Toplantı kapanışına ortak başarı/NO_CHANGE fişlerini bağla | Behavioral | High | `feat(story-meetings): record directional outcome interpretations` |
| 6 | Soğuma, ters yön, tahrif ve restore kapılarını kilitle | Test | Critical | `test(story): lock directional relationship receipt invariants` |
| 7 | Bilgi filtreli sonuç özetini UI'a aç | Additive | Medium | `feat(story-ui): explain directional relationship outcomes` |
| 8 | Ana plan, durum ve ledger kayıtlarını uzlaştır | Documentation | Low | `docs(story): record directional relationship outcome receipts` |
| 9 | Hedefli/birleşik kabul ve temiz ağaç | Mechanical | Medium | N/A |

### Adım 1 — Planları sırala

- Dört Draft plana bu planın karşılıklı conflict ve bağımlılığını ekle; içerik
  ve durumlarını değiştirme. Döngü veya başka `In Progress` plan varsa dur.
- **Doğrulama:** Frontmatter, döngüsüz bağımlılık ve yalnız metadata diff'i.

### Adım 2 — İlişki sonuç fişi defteri

- İlişki defterini şema-2'ye yükselt; sıra ve kapalı tavanlı fiş koleksiyonu
  ekle. Şema-1 edge/history/revision/zamanı kayıpsız göçsün.
- Uygulama API'si çağıran deltayı kabul etmesin; sabit politikayı kullansın.
- Kaynak+aktör idempotency'si, yorum ailesi soğuması, APPLIED/NO_CHANGE
  matematiği, yön, edge sürümü ve kaynak kimliğini doğrula.
- **Doğrulama:** Göç, tek uygulama, duplicate, clamp, soğuma, sahte aktör,
  ters yön, tahrif ve birebir save/load.
- **Durma koşulu:** Eski defter resetlenir, delta dışarıdan gelir veya duplicate
  edge'i değiştirirse dur.

### Adım 3 — Konuşma sonuç referansları

- Konuşmayı şema-7, görevi `TaskOfferV3`, toplantı sonucunu
  `MeetingOutcomeReceiptV2` yap.
- Görevde tek fiş kimliği; kurumsal sonuçta aynı çapraz referans; toplantı
  sonucu ve kapanışında katılımcı sıralı fiş kimlikleri taşı.
- Şema-6/V2/V1 göçleri boş alan eklesin, eski sonuçları uygulamasın.
- Validator kaynak ile ilişki fişini çift yönlü bağlasın.
- **Doğrulama:** Eski açık/terminal kayıtlar kayıpsız; karışık sürüm, yetim
  fiş ve yanlış kaynak/yön/politika reddedilir.

### Adım 4 — Görev sonuçları

- Kişisel/kurumsal kept ve broken fişlerini yalnız issuer→assignee uygula.
- Decline ve kabul edilmemiş expiry ilişkiyi değiştirmesin.
- Kurumsal settlement/result/social ve expiry refund/social tek rollback
  sınırında olsun; kişisel terminal de fişsiz yazılmasın.
- **Doğrulama:** Kept/broken, para korunumu, ters edge, nötr yollar, ikinci
  hedef görüşmesi ve tekrar tick.
- **Durma koşulu:** Fiş başarısızken görev terminal veya ödeme settled kalırsa dur.

### Adım 5 — Toplantı kapanışı

- Oy sonucu ilişkiyi değiştirmesin; bütün fişler gerçek başkan kapanışında
  atomik yazılsın.
- Her oyuncu dışı katılımcı için güncel oyları kaynak sonuçtan çöz.
- Çift YES+ADOPTED ortak başarı; diğerleri gerekçeli NO_CHANGE olsun.
- Kapanış, sonuç ve ilişki defteri aynı fiş kimliklerini taşısın.
- **Doğrulama:** Dört katılımcı, yalnız observer→player, cezasız ret/çekimser,
  deterministik sıra, ikinci kapanış nötrlüğü ve açık/kapalı save-load.

### Adım 6 — Adversarial bütünlük

- Kaynak, yön, yorum, delta, edge, önce/sonra, sürüm, soğuma, karar ve çapraz
  referans tahriflerini test et.
- İkinci API/kapanış/tick/restore ve aynı-an aynı-aile başarısında tek mutasyon.
- Selam, takip, kip, özel not, create/decline ve karşı oyda çiftçilik sıfır.
- Harness'e yalnız gerekli salt-okunur test API'lerini aç.
- **Doğrulama:** `node tests/story-conversation-case.test.js`;
  `node tools/story-test-parallel.js --task=relationshipInterpretationProbe --workers=1`;
  `node tools/story-test-parallel.js --task=conversationUnderstandingProbe --workers=1`.

### Adım 7 — UI

- Görevde yönlü güven/saygı artışı, kabul edilmiş görev ihlali veya nötr sonucu;
  toplantıda katılımcı adlı ortak başarı/NO_CHANGE nedenini göster.
- Ham BPS, gizli kişilik, üçüncü kenar ve iç fiş kimliği sızdırma.
- Duplicate/soğuma başarı bildirimi olmasın.
- **Doğrulama:** Gerçek DOM yön/sonuç doğru, gizli/ters alan yok, restore aynı.

### Adım 8 — Belgeler

- Ana plan ve duruma sahiplik, kaynak, yön, politika, no-change, soğuma ve
  atomik sınırı yaz. Faz 38.13 partial; kalan kabul borcu açık; Faz 39 pasif.
- Ledger'a uygulanan sözleşme ile “oy eşleşmesi=dostluk / karşı oy=husumet /
  teklif reddi=ihanet” kısayolunun reddini append-only kaydet.
- **Doğrulama:** Belgeler aynı aktif imleçte; ledger yalnız ek; linkler çözülür.

### Adım 9 — Kabul

- Adım 6'nın üç hedefli komutu, `git diff --check`, frontmatter/conflict/link
  taraması ve temiz `git status --short`.
- `node tests/story-world.test.js` bilinen kriz/gıda assertion'ını gözlemlemek
  için çalışır; eşik değiştirilmez ve bu dilimin başarı kapısı sayılmaz.
- Bütün hedefli kapılar geçmeden plan `Landed` yapılmaz.

## 6) Risk kaydı ve planın çürütülmesi

### Aynı oy dostluk, karşı oy husumet değildir

- **Kategori / Şiddet / Güven:** Political logic / High / Confirmed
- **Konum ve kanıt:** `storyConversationMeetingMotionCastVote` yalnız
  `YES/NO/ABSTAIN`, zemin ve sayım üretir; kişisel hakaret/ihanet üretmez.
- **Çürütülen yaklaşım:** Her YES'e güven, her NO'ya husumet.
- **Karar:** Yalnız kabul edilmiş oyuncu önergesindeki çift YES ortak başarı.
- **Risk:** Daha zengin siyasi sürtüşme, kaynaklı olay modeli gelene dek nötrdür.

### Görev teklifini reddetmek tutulmayan söz değildir

- **Kategori / Şiddet / Güven:** Commitment semantics / High / Confirmed
- **Konum ve kanıt:** `TaskOfferV2` taahhüdü yalnız `ACCEPTED` durumunda
  taşır; decline escrow ve kabul zamanı üretmez.
- **Çürütülen yaklaşım:** Her DECLINED/EXPIRED için güven cezası.
- **Karar:** Yalnız kabul edilmiş görevin expiry'si BROKEN'dır.
- **Risk:** Teklif reddinin bağlamsal kabalık etkisi ayrı semantik bekler.

### Ödeme fişi sosyal fiş değildir

- **Kategori / Şiddet / Güven:** Ledger ownership / Critical / Confirmed
- **Konum ve kanıt:** `InstitutionalTaskReceiptV1` settlement kanıtıdır,
  ilişki edge önce/sonra değerlerini taşımaz.
- **Çürütülen yaklaşım:** Transaction kimliğini ilişki history'si saymak.
- **Karar:** Ödeme kaynak; ayrı ilişki fişi sosyal sonuç sahibidir.
- **Risk:** Çapraz doğrulama maliyeti doğar.

### storyRelationshipAdjust tek başına idempotent değildir

- **Kategori / Şiddet / Güven:** Duplicate mutation / Critical / Confirmed
- **Konum ve kanıt:** `StoryRelationships.js` her çağrıda sürüm/history artırır;
  önceden görülen sourceReceiptId'yi reddetmez.
- **Çürütülen yaklaşım:** Tick/kapanıştan doğrudan adjust çağırmak.
- **Karar:** Önce tekil sonuç fişi kapısı, sonra tek adjust ve atomik doğrulama.
- **Risk:** Şema göçü ve yeni tavan gerekir.

### Yalnız APPLIED kaydı nötr nedenini yok eder

- **Kategori / Şiddet / Güven:** Auditability / Medium / Confirmed
- **Konum ve kanıt:** NO/ABSTAIN/REJECTED gerçek ama bilinçli nötr sonuçlardır.
- **Çürütülen yaklaşım:** Yalnız puanı değişen katılımcıyı kaydetmek.
- **Karar:** Her oyuncu dışı katılımcıya gerekçeli toplantı fişi.
- **Risk:** Fiş sayısı artar; tavan buna göre boyutlanır.

### Edge history kalıcı fiş deposu değildir

- **Kategori / Şiddet / Güven:** Persistence / High / Confirmed
- **Konum ve kanıt:** Edge history son 24 kayıtla sınırlıdır.
- **Çürütülen yaklaşım:** Fişi yalnız history içine gömmek.
- **Karar:** Kalıcı ayrı fiş koleksiyonu; history son değişiklik görünümüdür.
- **Risk:** Ayrı tavan ve kaynak yaşatma gerekir.

### Restore'da eski sonucu puanlamak çift uygulama riski taşır

- **Kategori / Şiddet / Güven:** Migration safety / Critical / Confirmed
- **Konum ve kanıt:** Eski şema-6/şema-1 kaydında hangi edge sürümünün sonucu
  taşıdığı bilinmez.
- **Çürütülen yaklaşım:** Yüklemede eski terminal kayıtları tarayıp puan vermek.
- **Karar:** Göç boş referans ekler; restore uygulama çağırmaz.
- **Risk:** Eski oyunlarda geçmiş sosyal etkiler geriye dönük görünmez.

### Ortak soğuma farklı gerçek sonuçları yutabilir

- **Kategori / Şiddet / Güven:** Anti-farming / Medium / Likely
- **Konum ve kanıt:** Görev ve toplantı başarısı aynı dünya anında ayrı olaydır.
- **Çürütülen yaklaşım:** Bütün olumlu olaylar için tek çift soğuması.
- **Karar:** Soğuma yorum ailesi bazında; aileler birbirini engellemez.
- **Doğrulama:** Aynı anda görev+toplantı ikisi de uygulanır; iki toplantı
  başarısı bir APPLIED + bir COOLDOWN_ACTIVE üretir.
- **Risk:** Yeni kaynak aileleri geldikçe uzun koşu dağılımı ölçülmelidir.

### Genel gıda assertion'ını değiştirmek kapsam ihlalidir

- **Kategori / Şiddet / Güven:** Test integrity / High / Confirmed
- **Konum ve kanıt:** `tests/story-world.test.js` genel yaşam/gıda eşiği;
  kullanıcı kriz, kıtlık ve yok oluşu açıkça onayladı.
- **Çürütülen yaklaşım:** Paket yeşil olsun diye eşiği düşürmek veya atlamak.
- **Karar:** Eşik değişmez; bu dilim hedefli ilişki/konuşma problarıyla geçer.
- **Risk:** Sonraki assertion'lar ayrı işçilerle doğrulanır.
