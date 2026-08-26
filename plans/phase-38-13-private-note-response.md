---
id: phase-38-13-private-note-response
status: Draft
owner: osman
source: Faz 38.13 / 26 Ağustos 2026 aktif uygulama sırası
touches:
  - js/StoryConversationUnderstanding.js
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
  - phase-38-13-meeting-closure-routing
conflicts_with:
  - 25-agustos-hikaye-modu-toplam-bugfix-plani
  - bugfix-council-motion-atomicity
  - bugfix-story-invalid-battle-target-guard
  - electron-story-lifecycle-acceptance
created: 2026-08-26
last_touched: 2026-08-26
---

# Faz 38.13 — Görünürlük Korumalı İkili Özel Not Yanıtı

## 1) Uygulama tezi

Mevcut toplantı motoru oyuncunun doğrulanmış bir katılımcıya
`BILATERAL_PRIVATE` not göndermesini, notu yalnız iki tarafın görünürlük
satırına eklemeyi ve kamusal tutanaktan uzak tutmayı doğruluyor. Açık borç,
notun alıcısı olan karakterin bu nota kendi bilgi sınırı içinde yanıt
verebilmesidir.

Yanıt kamusal toplantı turu değildir ve konuşma sırasını ilerletmez. Aynı
`privateNotes` defterinde ayrı, değiştirilemez bir çocuk kayıt olarak tutulur;
kök oyuncu notuna `replyToPrivateNoteId` ile bağlanır. Karakterin yanıt bağlamı
yalnız kök not, gündem, karaktere görünür kamusal turlar ve karakterin mevcut
uygun `ActorBelief` görünümünden kurulacaktır. Başka ikili notlar, başka
karakterin inancı, ham dünya veya oyuncu metninden türetilmiş mekanik emir bu
bağlama giremez.

İlk dikey deterministik ve dünya-nötr olacaktır. Oyuncu notu bir iddia veya
talep olarak ele alınabilir fakat doğrulanmış gerçek, kurum kararı, emir,
taahhüt ya da uygulama yetkisi sayılmaz. Karakter; tutumunu, kanıt sınırını ve
özel kanal statüsünü açıklayan kısa bir yanıt üretir.

**Done:** Açık toplantıda kök notun gerçek alıcısı, yalnız kendi kamusal/kurumsal
inancı ve görünür toplantı bağlamıyla en fazla bir ikili yanıt üretir; başka
katılımcı yanıt veremez; yanıt ve kök not kamusal transkripte sızmaz; ikinci
yanıt ile tahrif edilmiş bağ sıfır mutasyonla reddedilir; şema göçü geçmiş
kayıtlara yanıt uydurmaz; UI ikili diziyi Türkçe ve kaynak sınırı açık biçimde
gösterir; save/load birebirdir.

**Recommendation:** Proceed after explicit human approval and conflict
serialization. Bu dilim LLM çağırmaz, ilişki puanı yazmaz, görev üretmez ve
toplantı karar zincirini değiştirmez.

## 2) Değişmezler

- Özel yanıt yalnız `OPEN_NO_DECISION_ADAPTER` toplantıda üretilebilir.
- Yanıtlanacak kök kayıt `PLAYER_NOTE` olmalı; yazarı oturum oyuncusu, alıcısı
  doğrulanmış karakter katılımcı olmalıdır.
- Yalnız kök notun alıcısı yanıt yazarı olabilir. İstemci `actorId`, yazar,
  kaynak veya görünürlük seçemez.
- Yanıt yalnız alıcı karakter kamusal söz sırasında iken üretilebilir. Yanıt
  özel kanalda kalır; kamusal `currentSpeakerIndex` ve `turns` değişmez.
- Bir kök notun en fazla bir doğrudan karakter yanıtı vardır. Yanıta yanıt,
  zincir, döngü ve ikinci çocuk bu dilimde kapalıdır.
- Kök not ve yanıt yalnız oyuncu ile karakterin
  `visiblePrivateNoteIds` listesinde bulunur. Üçüncü katılımcı hiçbir kimlik,
  metin veya kaynak izi göremez.
- Yanıt bağlamı yalnız kök notu, gündemi, karaktere görünür
  `MEETING_PUBLIC` turları ve karakterin kendi
  `PUBLIC / INSTITUTIONAL` ActorBelief kaydını okuyabilir.
- `PRIVATE / SECRET / HIDDEN` dünya inancı, başka aktörün ActorBelief kaydı,
  başka özel not ve ham `STORY` dünya durumu yanıt metnine veya kaynaklarına
  giremez.
- Oyuncunun özel not metni untrusted iddiadır. İçindeki emir, JSON, araç çağrısı,
  “sistem” talimatı veya eylem adı mekanik komut üretmez.
- Yanıt; bütçe, refah, ilişki, görev, kurum, ordu, nüfus, bölge veya fiziksel
  dünya değerini değiştiremez.
- Yanıt kamusal tur, önerge tepkisi, oy, sonuç, kapanış veya kurum teklifi
  değildir.
- Başarısız çağrıda konuşma defteri ve fiziksel dünya snapshot farkı sıfırdır.
- Save/load kök notu, yanıtı, bağlantıyı, kaynak politikasını ve görünürlük
  matrisini birebir korur.
- Şema-5 göçü eski notları bilinen eski API sözleşmesine göre
  `PLAYER_NOTE` olarak tanımlar fakat cevap, kaynak veya karakter değerlendirmesi
  uydurmaz.
- Yeni bağımlılık veya ağ erişimi eklenmez.
- Her commit tek amaçlı, doğrulanmış ve bağımsız geri alınabilir olur.

## 3) Kapsam dışı

- Karakterler arası özel not veya oyuncunun karakter yanıtına ikinci özel cevap
  zinciri.
- LLM tabanlı özel yanıt üretimi, serbest metinden mekanik niyet çıkarımı veya
  prompt çalıştırma.
- Özel nottan ilişki puanı, hafıza, söz, görev, kurum isteği veya domain eylemi
  üretmek.
- Kurumsal/ücretli görev ve yönlü ilişki fişleri; bunlar sonraki ayrı Faz 38.13
  dilimleridir.
- Toplantı kapanış/yönlendirme sözleşmesini veya kamusal konuşma sırasını
  değiştirmek.
- Kapalı toplantıdaki yanıtsız notları otomatik yanıtlamak.
- Eski kayıtlara tahmini yanıt backfill etmek.
- Faz 38.13'ü bütünüyle `complete` veya Faz 39'u `active` ilan etmek.
- Genel bugfix, konsey, savaş hedefi veya Electron yaşam döngüsü planlarını
  uygulamak.

## 4) Önkoşullar ve plan çakışması çözümü

- Kullanıcı bu dosyayı insan kararıyla `Draft → Approved` yapmalıdır.
- `phase-38-13-meeting-closure-routing`,
  `25-agustos-belge-hedefleme-duzeni` ve
  `worktree-reconciliation-no-delete` `Landed` olmalıdır.
- Çalışma ağacı temiz ve hedef branch
  `atlas/worktree-reconciliation-2026-08-26` olmalıdır.
- `AGENTS.md` mevcut değildir; yeni dosya bu plan kapsamında oluşturulmaz.
- Dört canlı Draft plan geniş `Story*.js`, `Talks.js`, harness ve ledger
  yüzeylerinde bu planla çakışır. Kaynak değişikliğinden önce her birine
  `phase-38-13-private-note-response` bağımlılığı ve karşılıklı conflict
  kaydı eklenir. Durumları `Draft` kalır; içerikleri uygulanmaz.
- Hiçbir plan 26 Ağustos 2026 itibarıyla bayat değildir.
- Başlangıç bazı `node tests/story-conversation-case.test.js` ile temiz
  geçmelidir. Plan yazılırken gözlenen baz: 4 katılımcı, 37 kamusal tur, iki
  önerge sürümü ve şema-5 göçü.
- Mevcut `storyConversationMeetingSendPrivateNote` görünürlük matrisi
  sözleşmesi korunmalıdır.

## 5) Adım dizisi

| # | Adım | Tür | Ana dosyalar | Risk | Tek başına geri alınabilir |
|---|---|---|---|---|---|
| 1 | Çakışan Draft planları bu dilimin arkasına sırala | Mechanical | dört `plans/*.md` | Low | Yes |
| 2 | Özel not kayıt sözleşmesini yanıt bağlantısıyla sürümle | Additive/Migration | Understanding, harness, test | Medium | Yes |
| 3 | Görünürlük-korumalı karakter yanıt bağlamı ve üreticisini ekle | Behavioral | Understanding, test | High | Yes |
| 4 | İkili not dizisini ve yanıt eylemini UI'a aç | Additive | Talks, test | Medium | Yes |
| 5 | Tahrif, idempotency, göç ve save/load kapılarını tamamla | Test/Validation | Understanding, harness, test | High | Yes |
| 6 | Ana plan, durum ve ledger kayıtlarını uzlaştır | Documentation | iki aktif belge, LEDGER | Low | Yes |
| 7 | Hedefli kabul ve temiz çalışma ağacı kapısı | Mechanical | çalışma ağacı | Low | N/A |

### Adım 1 — Çakışan Draft planları bu dilimin arkasına sırala

- Dört Draft plana `phase-38-13-private-note-response` bağımlılığı ve conflict
  kaydı ekle; `last_touched` güncel kalsın.
- Durum, içerik, tahmin veya uygulama sırası dışında başka alan değiştirme.
- Bağımlılık döngüsü ve eşzamanlı `In Progress` plan bulunursa dur.
- **Doğrulama:** Frontmatter parse, karşılıklı conflict ve döngüsüz bağımlılık
  taraması; yalnız metadata diff'i.
- **Commit:** `docs(plans): serialize phase 38.13 private note response`

### Adım 2 — Özel not kayıt sözleşmesini yanıt bağlantısıyla sürümle

- Konuşma defterini şema 5'ten 6'ya yükselt.
- `privateNotes` girdisini geriye uyumlu biçimde sürümle:
  `kind: PLAYER_NOTE | CHARACTER_REPLY`,
  nullable `replyToPrivateNoteId`, `sourceRefs`, nullable `grounding`,
  nullable `stance`, `knowledgePolicy`, `generationMode`.
- Oyuncu notu `PLAYER_NOTE`; karakter yanıtı ayrı
  `CHARACTER_REPLY` kaydıdır. Kök kayıt sonradan `replyId` ile mutate edilmez;
  çocuk bağlantısı sorguyla bulunur.
- Şema-5 göçü yalnız doğrulanabilir eski alanları dönüştürür; yanıt oluşturmaz.
- Validator; tür/yazar/alıcı, tek çocuk, kök yönü, response-to-response,
  self-link, döngü, sıra, limit ve ikili görünürlük bağlarını denetler.
- **Doğrulama:** Eski snapshot şema-6'ya yanıtsız ve geçerli göçer; sahte çocuk,
  ters taraf, ikinci çocuk ve üçüncü taraf görünürlüğü reddedilir.
- **Commit:** `feat(story): version bilateral meeting note threads`
- **Durma koşulu:** Göç eski notun yazar/alıcı anlamını kanıtlayamıyorsa veya
  validator mevcut geçerli snapshotı reddediyorsa commit atma.

### Adım 3 — Görünürlük-korumalı karakter yanıtını üret

- Yeni `storyConversationMeetingPrivateNoteRespond(meetingId, privateNoteId)`
  API'si ekle. Yazar/karakter kimliği istemciden alınmaz.
- Kök notun gerçek alıcısının güncel kamusal konuşmacı olduğunu doğrula.
- Salt-okunur yanıt bağlamını açık bir yardımcıyla kur:
  kök not, gündem, alıcı görünürlük satırındaki kamusal turlar ve mevcut
  `storyConversationMeetingBeliefGrounding` sonucu. Başka
  `visiblePrivateNoteIds` bağlama topluca verilmez.
- Deterministik yanıt; notu doğrulanmış gerçek saymadan, kaynak varsa kaynak
  sınırını ve mevcut stance yönünü, yoksa doğrulama ihtiyacını belirtir.
- Yanıt `sourceRefs` içinde kök not, gündem, gerçekten okunan kamusal turlar
  ve grounding kimliklerini taşır. `knowledgePolicy` açıkça
  `rawWorldRead:false`, `otherPrivateContextReadable:false` kaydeder.
- Başarılı yanıt kamusal `turns`, konuşmacı sırası ve bütün dünya
  defterlerini değiştirmez.
- **Doğrulama:** Doğru alıcı bir yanıt üretir; yanlış konuşmacı, başka karakter,
  kapalı toplantı ve ikinci çağrı anlamlı kapalı kodlarla ve sıfır farkla
  reddedilir. Üçüncü tarafa ait tuzak özel metin yanıt/metaveri/sourceRefs'te
  görünmez.
- **Commit:** `feat(story): generate visibility-bound private note replies`
- **Durma koşulu:** Yanıt üreticisi ham dünyayı veya bütün `privateNotes`
  dizisini okuyorsa; oyuncu metnini eyleme dönüştürüyorsa; sıra ya da kamusal
  transcript değişiyorsa dur.

### Adım 4 — İkili not dizisini ve yanıt eylemini UI'a aç

- Oyuncunun gönderdiği not ile karakter yanıtını aynı ikili dizide, yön ve
  kaynak sınırı etiketiyle göster.
- “Karakterin yanıtını al” eylemini yalnız açık toplantıda, yanıtsız kök notun
  gerçek alıcısı güncel konuşmacıysa göster.
- Çift tıklamayı UI tarafında bastır; core idempotency yine yetkili sınırdır.
- Ham `PLAYER_NOTE`, `CHARACTER_REPLY`, hata veya görünürlük kodlarını
  oyuncuya sızdırma. Türkçe metin, yanıtın özel kaldığını ve karar/taahhüt
  olmadığını açıklasın.
- Kapalı toplantıda geçmiş ikili dizi okunabilir kalsın; yeni yanıt kontrolü
  görünmesin.
- **Doğrulama:** DOM testi doğru düğmeyi yalnız doğru sırada gösterir, yanıtı
  kamusal transcript dışında render eder, üçüncü taraf notunu göstermez ve çift
  tıklamada tek çocuk üretir.
- **Commit:** `feat(story-ui): expose bilateral private note replies`
- **Durma koşulu:** UI bütün özel notları filtrelemeden render ederse, yanıtı
  kamusal tur gibi gösterirse veya terminal toplantıda eylem sunarsa dur.

### Adım 5 — Tahrif, idempotency, göç ve save/load kapılarını tamamla

- Harness'a yalnız yeni public test API'sini aç.
- Hedefli testte ayrı kök notlar ve üçüncü taraf tuzak metni kur.
- Karakterin başka notu, başka ActorBelief'i, `PRIVATE/SECRET` inancı veya ham
  dünya değerini kullanmadığını sourceRefs ve cevap metniyle kanıtla.
- Yanıt öncesi/sonrası fiziksel dünya snapshotı, kamusal tur sayısı ve
  `currentSpeakerIndex` eşit olsun.
- Açık ve kapanmış toplantı save/load sonucu, şema-5→6 göçü ve validator
  tahrifleri test edilsin.
- **Doğrulama:** `node tests/story-conversation-case.test.js`; test çıktısına
  `privateNotes`, `privateReplies`, `meetingTurns`, `migratedSessions`
  özetleri eklenir.
- **Commit:** `test(story): lock private note reply isolation`
- **Durma koşulu:** Gizli tuzak metin veya kimlik herhangi bir görünür cevap,
  sourceRefs ya da kamusal DOM içinde bulunursa plan durur.

### Adım 6 — Ana plan, durum ve ledger kayıtlarını uzlaştır

- Ana planda on dördüncü dikey olarak gerçekleşen sözleşmeyi ve kanıtı yaz.
- Durum belgesinde Faz 38.13 `partial` kalır; sıradaki tek dilim
  kurumsal/ücretli görev olur. Yönlü ilişki fişleri sonraki borç olarak kalır.
- Faz 39 aktif yapılmaz.
- `LEDGER.md` sonuna uygulanan özel yanıt izolasyonu ile “bütün özel not
  defterini karakter bağlamına verme” reddini iki append-only kayıt olarak ekle.
- **Doğrulama:** İki aktif belge aynı son dikeyi ve aynı sıradaki borcu
  gösterir; ledger yalnız ek satır taşır; yerel Markdown bağlantıları çözülür.
- **Commit:** `docs(story): record phase 38.13 private note replies`

### Adım 7 — Hedefli kabul ve temiz çalışma ağacı kapısı

- `node tests/story-conversation-case.test.js`
- Plan frontmatter ve ilgili yerel Markdown bağlantı taraması.
- `git diff --check`
- `git status --short`
- Commit zinciri metadata, şema, davranış, UI, adversarial test ve belge
  amaçlarını ayrı göstermelidir.
- Bütün kapılar geçmeden plan `Landed` yapılmaz.

## 6) Risk kaydı ve planın çürütülmesi

### Yanıtı kamusal tur olarak eklemek gizli metni tutanağa sızdırır

- **Kategori:** Confidentiality / transcript integrity
- **Şiddet:** High
- **Güven:** Confirmed
- **Kanıt:** `storyConversationMeetingAppendTurn` bütün turları
  `MEETING_PUBLIC` işaretleyip her görünürlük satırına ekliyor.
- **Çürütülen yaklaşım:** Özel cevabı
  `storyConversationMeetingGenerateCharacterTurn` üzerinden üretmek.
- **Karar:** Ayrı `CHARACTER_REPLY` özel not kaydı; kamusal tur ve sıra sabit.

### Karaktere bütün privateNotes dizisini vermek üçüncü taraf sırlarını açar

- **Kategori:** Information leakage
- **Şiddet:** High
- **Güven:** Confirmed by data model
- **Kanıt:** Defter bütün ikili notları aynı `meeting.privateNotes` dizisinde
  tutuyor; izolasyon yalnız `visibilityMatrix` satırlarında ifade ediliyor.
- **Çürütülen yaklaşım:** Yanıt üreticisine doğrudan `meeting.privateNotes`
  vermek.
- **Karar:** Kök not kimliğinden tek kayıt seç; kamusal turları alıcının
  görünürlük satırıyla kesiştir; başka özel kayıt okumayı yasakla.

### Oyuncu notunu doğrulanmış gerçek veya mekanik emir saymak yetki aklar

- **Kategori:** Authority laundering / prompt injection
- **Şiddet:** High
- **Güven:** Confirmed by contract
- **Kanıt:** Not serbest oyuncu metnidir; kaynak, kurum makbuzu veya eylem
  yetkisi taşımaz.
- **Çürütülen yaklaşım:** Not metninden action type, görev, ilişki veya dünya
  mutasyonu çıkarmak.
- **Karar:** Metin yalnız bilateral iddiadır; deterministik cevap dünya-nötrdür.

### Kök nota responseId yazmak tarihsel kanıtı sonradan değiştirir

- **Kategori:** Auditability
- **Şiddet:** Medium
- **Güven:** Confirmed
- **Çürütülen yaklaşım:** `rootNote.responseId = childId`.
- **Karar:** Çocuk kaydı köke tek yönlü bağlanır; tekillik validator sorgusuyla
  doğrulanır.

### Gönderim anında otomatik yanıt karakter sırasını ve oyuncu beklentisini gizler

- **Kategori:** Agency / sequencing
- **Şiddet:** Medium
- **Güven:** Likely
- **Doğrulama:** Aynı gönderim çağrısında karakter cevabı üretildiğinde UI
  kullanıcısının hangi karakterin ne zaman yanıtladığını ayırt edip edemediğini
  test etmek gerekir.
- **Çürütülen yaklaşım:** `sendPrivateNote` içinde otomatik cevap.
- **Karar:** Ayrı açık eylem; yalnız alıcı karakter kamusal sıradayken.

### Yanıt için bütün özel bağlamı açmak “ownPrivateContextOnly” sözünü aşar

- **Kategori:** Scope ambiguity
- **Şiddet:** Medium
- **Güven:** Confirmed
- **Kanıt:** Bir karakter birden çok ikili notun tarafı olabilir; “kendi özel
  bağlamı” her özel notun her yanıtta gerekli olduğu anlamına gelmez.
- **Karar:** İlk dikeyde yalnız yanıtlanan kök not okunur. Çok-notlu hafıza ayrı
  tasarım ve test olmadan eklenmez.

### Şema göçünde eski notlara kaynak/yanıt uydurmak geçmişi değiştirir

- **Kategori:** Migration integrity
- **Şiddet:** High
- **Güven:** Confirmed
- **Karar:** Eski API'nin kanıtladığı oyuncu→karakter yönü dışında yeni semantik
  üretilmez; reply null ve kaynak listesi boş kalır.

## 7) İptal ölçütleri

- Kök notun gerçek alıcısını istemci girdisi olmadan çözemiyorsak uygulama
  başlamaz.
- Başka özel notları okumadan anlamlı ve kaynak-sınırlı yanıt üretilemiyorsa bu
  kapsamla devam edilmez; daha geniş özel hafıza ayrıca planlanır.
- Yanıt kaydı kamusal tur/sıra ile ayrıştırılamıyorsa plan durur.
- Şema-5 geçerli snapshot veri uydurmadan şema-6'ya göçemiyorsa şema değişikliği
  kabul edilmez.
- Tahrif edilmiş child→root bağlantısı restore sırasında kabul edilirse plan
  `Landed` olmaz.
- UI üçüncü taraf not kimliğini veya metnini render ederse plan durur.
- Dört çakışan Draft plan sıra bağı kurulmadan kaynak değişikliği başlamaz.
- Çakışan planlardan biri `In Progress` olursa sıra yeniden uzlaştırılır.

## 8) Uygulama sonrası kabul

- Doğru sıradaki gerçek alıcı: bir kök not, bir özel karakter yanıtı.
- Yanlış karakter, yanlış sıra, kapalı toplantı ve ikinci yanıt: kapalı hata,
  sıfır defter/dünya farkı.
- Kamusal `turns` ve `currentSpeakerIndex`: yanıt öncesi/sonrası aynı.
- Görünürlük: yalnız oyuncu ve alıcı iki kaydı görür; üçüncü katılımcı sıfır özel
  kayıt görür.
- Bilgi sınırı: yanıt yalnız kök not, görünür kamusal turlar ve karakterin uygun
  ActorBelief kaydına referans verir.
- Gizli tuzak: başka özel not, başka aktör inancı ve `PRIVATE/SECRET` inanç
  metni cevap/sourceRefs/DOM içinde yoktur.
- Dünya etkisi: konuşma dışındaki ilgili snapshot farkı sıfırdır.
- Save/load: açık ve kapalı toplantıda ikili dizi birebir.
- Göç: şema-5 notları yanıtsız şema-6 kök notlara dönüşür; sahte cevap yoktur.
- UI: Türkçe ikili dizi, doğru zamanda tek yanıt kontrolü, özel/karar-değil
  sınırı ve çift tıklamada tek çocuk.
- Ana plan ve durum belgesi Faz 38.13 `partial` üzerinde eşleşir; sıradaki iş
  kurumsal/ücretli görevdir, Faz 39 başlamaz.
- Çalışma ağacı kapanışta temizdir.
