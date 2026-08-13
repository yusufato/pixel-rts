# Hikâye Sohbeti QA Kaydı

Gerçek EXE üzerinden yapılan görünür karakter konuşmaları ilk mesajdan itibaren
`qa-runtime/story-dialogue-log.jsonl` dosyasına satır satır yazılır. Dosya 8 MB'a
ulaşınca önceki parça `story-dialogue-log.jsonl.1` adına döndürülür.

Her satır bir JSON nesnesidir. `TURN_CREATED` oyuncuya ilk gösterilen güvenli
cevabı, `RESPONSE_ENRICHED` ise yerel LLM aynı cevabı sonradan iyileştirdiğinde
son halini taşır. `sessionId` ve `responseId` iki kaydı birleştirmek içindir.

Kayıt yalnız oyuncunun yazdığı metni, oyuncuya gösterilen karakter cevabını ve
dar tanı künyesini içerir. Sistem istemleri, gizli karakter eksenleri, ham dünya
gerçekleri, erişilmeyen anılar ve model dosyası bilgileri kayda yazılmaz.

## S0 değerlendirme corpus'u

`npm run story:dialogue-corpus`, dönen ve güncel JSONL parçalarını
`qa-runtime/story-dialogue-corpus-s0.json` içinde sürümlü `DialogueEvalCaseV1`
örneklerine dönüştürür. Bu çıktı bir eğitim doğrusu değildir: canlı motorun
`speechAct`, `discourseAct` ve görünür cevabı `OBSERVED_UNREVIEWED` olarak taşınır.
İnsan veya doğrulanmış sözleşme incelemesi olmadan altın etikete yükseltilmez.

- Muhatap adı ve ham aktör kimliği corpus'a girmez; kararlı takma ad kullanılır.
- E-posta, telefon, URL, IP ve yerel dosya yolu görünür metinden ayıklanır.
- Sistem istemi, gizli inanç, WorldFact ve model yolu şema tarafından reddedilir.
- Aynı konuşmanın bütün turları tek `conversationGroupId` içinde kalır.
- Aynı rol ve gözlenen söylem zincirini taşıyan türev senaryolar tek
  `scenarioFamilyId` üzerinden train/development/blind-test kümelerinden yalnız
  birine atanır.
- Corpus, kaynak dosyaları ve kendi içeriği için SHA-256 checksum taşır.
- `npm run story:dialogue-corpus-test` kampanya session sayacı sıfırlaması,
  zenginleştirilmiş son cevap seçimi, gizlilik, split sızıntısı, determinizm ve
  checksum bozulmasını hedefli olarak sınar.

12 Ağustos 2026 gerçek kayıt üretimi: `49` vaka, `9` konuşma grubu ve `9`
senaryo ailesi; train/development/blind-test dağılımı `34/6/9`dur. `29` vakada
LLM'in oyuncuya görünen son cevabı vardır. Corpus doğrulaması temiz, karma
`sha256:331d71276e1f0b1741205492e85bdfa0c6709e4f901338eb38abcca5eeb4fc92`.
`18` bilinmeyen-duvar ve `4` servis-botu vakası ölçüm borcudur; etiketler henüz
insan incelemesi olmadığı için altın doğru değildir.

## S1 DialogueMove ilk dikeyi

`story-dialogue-move-1`, açılış ve takip cevaplarında doğal dil üretiminden önce
kapalı bir karar kaydı oluşturur. Kayıt; cevap verilen turu, eylem/duruşu,
izinli fact-belief-claim-memory referanslarını, kullanılabilecek varlıkları,
zorunlu anlam noktalarını, yasak taahhütleri ve zorunlu `worldCommand:null`
sınırını taşır.

- Eski bütün iddialar her tura taşınmaz. Askerî, konum ve bütçe cevapları yalnız
  kendi konu türündeki güncel/kalıtılmış iddiaları alır; günlük sohbet sıfır
  ilgisiz claim yetkisiyle başlar.
- 8B çıktı zarfı doğru `moveId`yi aynen döndürmeli ve `usedRefs` yalnız izinli
  kaynak kimliklerinden oluşmalıdır. Sahte kaynak, eksik zarf, yetkisiz taahhüt,
  yanlış karma veya dünya komutu cevabı reddettirir.
- Karar nesnesi oturumla birlikte saklanır ve ledger doğrulamasına dahildir;
  görünür QA olayına yalnız `dialogueMoveId` eklenir, gizli içerik eklenmez.
- `npm run story:dialogue-move-test` 20 sözleşme kapısını geçti. Mevcut kapsamlı
  konuşma regresyonu ve 1.200 turluk sanal laboratuvar da temizdir.

Gerçek 49-vakalık geçmiş corpus ilk otomatik sert-iddia taramasında `1` sert
bulgu verdi: oyuncunun “bencil” yorumunu eski LLM cevabı “bu bir gerçek” diye
onaylamış. Ayrıca geçmiş çıktılarda `18` unknown-duvar ve `4` servis-botu vakası
var. Bunlar silinmedi ve başarı hanesine yazılmadı. S1 henüz tamamlanmış
sayılmaz: aynı corpusun güncel motorla replay'i ve her deterministik cevap
kolunun açık kanıt evreni testi sonraki dikeydir.

Güncel deterministik motor replay'i `49/49` turu, `0` atlama ile yeniden oynattı;
sert bulgu `0`, unknown-duvar `0`, servis-botu `0` oldu. Bu sonuç 8B doğallık
kanıtı değildir; DialogueMove/anlama çekirdeğinin geçmiş vakaları güvenli
karşıladığını kanıtlar.

### S1 kabulü

S1 tamamlandı. `48` kapalı eylemin tamamı kaynak politikası taşır; kaynakta yeni
bir deterministik `discourseAct` eklenip kataloğa kaydedilmezse test kırılır.
Güncel tur claim'i ile geçmiş claim farklı yetki kurallarına sahiptir. Eski veya
tahrif olmuş türetilmiş DialogueMove, oturum silinmeden kendi analiz ve görünür
kaynaklarından yeniden kurulur. Son kabul: `49/49` replay, `0` bulgu; `1.200`
sanal tur; kapsamlı konuşma/UI/save-load regresyonu temiz.

## S2 söylem durumu — ilk dikey

`story-discourse-state-1` oturum içinde aktif konu, askıya alınmış konu geçmişi,
açık sorular, oyuncu/karakter cevap borçları ve onarım zincirini ayrı sürümlü
durum olarak taşır. Sosyal ara söz aktif ticari/askerî konuyu silmez. “Anlamadım”
gibi onarım turu `repairOfTurnId` ile önceki düğüme bağlanır; karakterin açıklama
sorusu açık borç yaratır ve içerikli sonraki oyuncu turu kaynak kimliğiyle kapatır.

Konu yalnız eski `analysis.topic` alanından okunmaz; şirket kurma niyeti,
commodity/shipment/warehouse varlığı ve bütçe claim'i `COMMERCE`, askerî destek
ve tehdit claim'i `MILITARY` üretir. Durum tavanlıdır (`12` konu, `12` soru/borç,
`16` onarım), dünya nötrdür ve save/load birebirdir. Birim probu, canlı oturum
probu, kapsamlı konuşma regresyonu ve `49/49` replay temizdir. S2 henüz kapanmadı:
20 turluk konu dönüşü, birden çok eşzamanlı soru borcu ve oyuncu düzeltmesinin
önceki claim/pozisyonu geçersiz kılması sonraki dikeydir.

### S2 kabulü

S2 tamamlandı. Canlı kabul zinciri aynı oturumda `20` takip turunu tamamladı.
Birden çok soru/borç korunuyor; “önceki konuya dönelim” askıya alınmış ticari
konuyu geri yüklüyor; “onu demiyorum” önceki claim'i `CORRECTED_BY_PLAYER`
yapıyor ve bu claim sonraki DialogueMove kaynağı olamıyor. Tavanlar, dünya
nötrlüğü ve save/load birebirliği geçti. Kapsamlı konuşma regresyonu ile
`49/49`, sıfır-bulgulu gerçek corpus replay'i yeniden temizdir.

## S3 domain adaptör sözleşmesi — kabul

`story-conversation-domains-1`, günlük, ekonomi, siyaset, askerî ve diplomasi
konuşmalarını ayrı metin motorlarına bölmeden ortak bir `DomainEvidenceBundleV1`
zarfına çevirir. Adaptör metin yazamaz, ham dünya defteri okuyamaz ve dünya
komutu üretemez; yalnız kanıt sunup ortak `DialogueMoveV1` hareketini besler.

Canlı kabul probu beş alanı doğru sırayla çözdü, bütün zarfları aynı şemada
doğruladı ve dünya nötrlüğünü korudu. Kayıt doğrulaması yalnız zarf checksum'una
güvenmez: beklenen zarfı gerçek oturum analizi, karakter rol/yetkisi ve tutulan
hafızadan yeniden kurar. Bu yüzden checksum'u geçerli sahte yetki zarfı
`DOMAIN_EVIDENCE_SOURCE_MISMATCH` ile reddedilir. İlgisiz geçmiş bütçe iddiası
askerî zarfa, ilgisiz tehdit iddiası ekonomi zarfına taşınmaz. S1–S3 birim
kapıları, temiz 23 takip turlu Faz 38.5 regresyonu ve `49/49` güncel corpus
replay'i temizdir. Bayat birleşik `conversationUnderstandingProbe` içindeki geri
alınmış UI/olay beklentileri hâlâ kırmızıdır; S3 kabul kanıtına sayılmamıştır.

## S4 ContextPack — ilk dikey

`story-context-pack-1`, karakter kimliği, DialogueMove, gerçek yetki kaynakları,
açık soru/cevap borçları, son turlar, doğrulanmamış claim'ler ve kaynaklı hafıza
kayıtlarını tek öncelikli pakette toplar. Zorunlu bölüm bütçeye sığmıyorsa sessiz
kesme yerine `PROTECTED_CONTEXT_EXCEEDS_BUDGET` verir. Gizli/karaktere görünmeyen
bölüm prompt'a hiç alınmaz; düşük öncelikli küçük sohbet, eski ayrıntı ve söylenti
önce atılır. `8192` model tavanından `900` çıktı ve `650` sabit prompt payı
ayrılmıştır. Canlı askerî konuşma paketi geçerli, kaynaklı ve dünya nötrdür;
S3 canlı probu ile `49/49` replay gerilemedi. Bu henüz S4 kabulü değildir:
üretimde gerçek model tokenizer sayacı, söz/sır yaşam döngüsü kaynaklarının
eksiksiz adaptörü ve uzun-bağlam kesme karşı-probu açıktır.

### S4 kabulü

S4 tamamlandı. Muhatabın oyuncuyla ilgili kanonik `PROMISE/SECRET` kayıtları
holder-korumalı hafıza kapısından pakete giriyor; aynı muhatabın başka aktörle
ilgili sırrı dışarıda kalıyor. Açık soru/cevap borcu, DialogueMove, yetki ve son
oyuncu turu zorunlu; düşük önem geçmiş kontrollü kesiliyor. Güncel turun geçmişte
yinelenip yinelenmediği artık metin eşitliğiyle değil kaynak kimliğiyle ölçülüyor.

Mevcut `Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf` yeniden indirilmeden aynı
`llm-host` sürecinde CUDA ile yüklendi. Gerçek tokenizer tipik askerî oyun
prompt'unu `724` giriş tokenı olarak ölçtü; `220` çıktı ve `128` chat-wrapper
rezerviyle toplam `1072/8192`. Bilerek taşırılan metin `12820` token verdi.
Üretim kapısı taşmayı önceden reddeder veya zorunlu alanları koruyarak en fazla
iki kontrollü ContextPack yeniden derlemesi yapar. Hedefli kapılar, temiz 23 tur,
save/load, dünya nötrlüğü ve `49/49` replay temizdir. S5 gerçek-model bataryası
ayrı fazdır; S4 kabulü model doğallığı iddiası değildir.

## S5 oyunla birebir 8B koşucu — ilk dikey

`story-dialogue-8b-runner-2`, modeli bir kez gerçek `llm-host` içinde oyunla
aynı Electron çalışma zamanında
`8192` bağlamla yükler; corpus konuşmalarını aynı oyun oturumunda kronolojik
oynatır. Her model-uygun tur gerçek ContextPack, DialogueMove, JSON grammar ve
üretim doğrulayıcısını kullanır. `UNKNOWN` ve deterministik kanıt cevapları gerçek
oyundaki gibi `NOT_REQUIRED` olur; modeli gereksiz yere çalıştırmaz. Rapor; model
seed'i, prompt/grammar/ContextPack/ham çıktı karmaları, tokenlar, gecikme, RSS,
kabul/fallback ve ret kodunu saklar.

İlk üç-tur smoke `1` model-uygun kabul, `2 NOT_REQUIRED`, sıfır fallback/hata
verdi. İlk 12-tur koşunun ham incelemesi otomatik kabulün sahte-yeşil olduğunu
gösterdi: model kaynak olmadan “iş görüşmesine hazırlanıyorum/çok meşgulüm”,
“cepheye dönmeyeceğim/burada kalacağım” dedi ve Türkçe kelime sınırından kaçan
“Neler yapmamıza yardımcı olabiliriz?” servis-botu kalıbı üretti. Üçü sürümlü
negatif regresyona çevrildi. Aynı seed yeniden koşulduğunda `4` model-uygun turun
yalnız `1`i kabul edildi; diğerleri `UNSOURCED_PERSONAL_STATE`,
`UNAUTHORIZED_FUTURE_COMMITMENT`, `SERVICE_BOT_LANGUAGE` olarak ayrı reddedildi.
`8` tur doğru biçimde `NOT_REQUIRED`; hata ve bağlam taşması `0`; CUDA p50/p95
toplam süre yaklaşık `3,33/3,53 sn` oldu. S5 `partial`dır: 50 kısa + 20 orta +
10 uzun sürümlü konuşma manifesti ve tam batarya henüz tamamlanmadı.

Tam batarya 13 Ağustos 2026'da tamamlandı: `80` görüşme, `540` tur,
`272` model-uygun üretim, `220` kabul, `52` fallback, `268 NOT_REQUIRED`,
`0` teknik hata ve `0` bağlam taşması. Ret dağılımı `26 SERVICE_BOT_LANGUAGE`,
`18 EXACT_FALLBACK_COPY`, `3 UNSOURCED_PERSONAL_STATE`,
`3 UNAUTHORIZED_FUTURE_COMMITMENT`, `2 OTHER_VALIDATION_REJECTION` oldu.
Koşu kesintilerinde veri kaybı bulunduğu için her tamamlanan görüşme sonunda
atomik `.partial.json` yazımı, checksum/model eşitliğine bağlı resume ve
90 saniyelik alt-süreç watchdog'u eklendi. Sistem Node'u ile EXE çalışma zamanı
farkı da kapatıldı; rapor artık `hostRuntime: electron-node` taşır.

Bu koşu CUDA değil `vulkan` arka ucunda bitti. CUDA tanısı hazır ikilinin
yüklenip `Expected: cuda, got: false` ile aygıtı göremediğini; aynı anda
`nvidia-smi` komutunun da aygıt bulamadığını gösterdi. Güvenli Vulkan fallback'i
GPU kullanır fakat p50/p95 toplam üretim süresi `25,40/44,42 sn` oldu. Bu gecikme
kalite metriğinden ayrı tutulur.

Otomatik ham denetim bataryanın **çeşitlilik kabulünü geçmediğini** gösterdi:
80 ayrı oturum yalnız `9` benzersiz oyuncu konuşma dizisinden türemiştir;
`71` oturum metinsel tekrardır. `220` kabulün `34`ü normalize birebir tekrar,
`27`si aynı oyuncu sözüne aynı cevaptır. Kabul edilen örneklerde oyuncu cümlesini
aynen geri okuma, “Bana güveniyor musun?” sorusundan kaçma ve “Neden?” turunda
yeniden açıklama isteme bulundu. `PLAYER_INPUT_ECHO`,
`EVASIVE_DIRECT_QUESTION`, `FAILED_REASON_CONTINUATION` ve
`TAUTOLOGICAL_REPLY` artık üretim kabulü değil açık fallback nedenidir.

Sonuç: S5'in gerçek oyun-paritesi koşucu ve yeniden oynatılabilir rapor kabulü
tamamlandı; dil çeşitliliği/insan-benzeri kalite kabulü tamamlanmadı. Aktif sıra
S6 sert doğrulayıcıları ve gerçekten benzersiz adversarial konuşma bataryasıdır.

S6 manifesti aynı metni farklı seed altında çoğaltmıyor: `50/20/10` sınıfında
`80/80` benzersiz oyuncu konuşma dizisi ve `540` tur üretir. Konular gündelik
temas, güven, özür, doğrudanlık, doğrulanmamış tehdit, blöf, şirket/tedarik,
siyasi takas, sır, yetki, taahhüt, düzeltme, konu dönüşü ve özetlemeyi kapsar.
Muhataplar canlı temas dizinindeki `EXECUTIVE`, `POLITICAL_FIGURE`,
`COMPANY_EXECUTIVE`, `AGENT`, `COMMANDER` rollerine dağılır; bulunmayan rol artık
ilk karaktere sessizce düşmez, `LISTENER_ROLE_UNAVAILABLE` olur. Checksum
`sha256:4e7fc1e23785433c31579a74123cf106113c425c79bd7cac4dab69d5b9cf992c`.

İlk 12 turluk S6 smoke yeni karşı-vakalar buldu: kaynak olmadan “Halep tarihi ve
kültürü hakkında çok şey biliyorum”, doğrudanlık isteğine yeniden açıklama
isteme ve totolojik güven açıklaması. Bunlar sırasıyla
`UNSOURCED_KNOWLEDGE_CLAIM`, `FAILED_DIRECTNESS_REQUEST` ve
`TAUTOLOGICAL_REPLY` retlerine bağlandı; negatif kapı `9/9` geçti. Runner artık
`llm-host`un ilk chunk olayını atmaz; ayrı smoke Vulkan'da ilk-token/toplam
`8,88/18,26 sn` ölçtü. Tam S6 bataryası ayrı raporda çalışacaktır.

İlk benzersiz S6 koşusu `44` turda bilerek durduruldu; doğrulayıcının kaçırdığı
altı sınıf ham kabulden bulundu: varsayımı ortak hafıza yapma, doğrulanmamış
iddianın doğruluğunu onaylama, kaynaksız “güncellemelerim var” doğrulama yetkisi,
kaynaksız güncel şehir altyapısı, düzeltme teyidini cevapsız bırakma ve gizlilik
isteğini atlama. Asker görüldüğü bildirimini oyuncunun tehdidi gibi yeniden
çerçeveleme ve sosyal check-in'e yeniden açıklama isteme de eklendi. Yeni retler:
`HYPOTHETICAL_ADOPTED_AS_MEMORY`, `UNVERIFIED_CLAIM_ADOPTED`,
`UNSOURCED_VERIFICATION_CLAIM`, `UNSOURCED_WORLD_STATE`,
`FAILED_CONFIRMATION_QUESTION`, `FAILED_CONFIDENTIALITY_REQUEST`,
`REPORT_RECAST_AS_THREAT`, `FAILED_SOCIAL_CHECK_IN`. Negatif regresyon `17/17`.

Ara kaydın doğrulayıcı değişiminden sonra eski kabul kararlarını taşıması da
engellendi: `story-dialogue-8b-runner-3` raporu validator kaynak parmak izi taşır
ve resume ancak checksum + model + validator fingerprint birlikte eşitse yapılır.
Yeni 12-tur gerçek smoke `4 kabul / 4 fallback / 4 NOT_REQUIRED / 0 hata / 0
taşma`; Vulkan ilk-token p50/p95 `11,59/13,44 sn`, toplam `25,33/31,99 sn`.
Tam S6 yeniden koşusu henüz açık kabul borcudur.
