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

## 14 Ağustos 2026 — gerçek oyuncu konuşma regresyonu

Son canlı kayıtta 3 oturum / 15 oyuncu turu incelendi. Beş mesaj `UNKNOWN`
olmuş, model cevapları 30–50 saniye geriden gelmiş ve oyuncu geçici deterministik
cevabı nihai cevap sanarak konuşmaya devam etmiştir. Test eski EXE ile değil,
güncel `5f53935` kaynağıyla başlamıştır; sorun test/üretim kapsama açığıdır.

Sürümlü regresyona alınan davranışlar:

- LLM üretirken `KARAKTER DÜŞÜNÜYOR` görünür ve takip girişi kilitlidir.
- İkinci tur motor düzeyinde `CHARACTER_RESPONSE_PENDING` ile reddedilir.
- Uygulama kapanışından kalan yetim pending kayıt güvenli fallback'e döner.
- “Kimim ben?”, güven sorusu, görev talebi, ilk-temas düzeltmesi, anlama
  itirazı ve bağlılık iddiası ayrı grounded hareketlerdir.
- askerî bildirim `UNVERIFIED_PLAYER_REPORT` olarak kalır; sonraki gizlilik
  isteği aynı claim kimliğine bağlanır ve koşulsuz sır vaadi üretmez.
- ilk görüşmede yeniden/tekrar/ortak geçmiş dili yasaktır.
- “musun” kelimesinin bulanık eşleşmeyle “Musul” olması engellenmiştir.
- “daha fazla bilgiye ihtiyacım var / daha fazla ayrıntıya girin” servis-botu
  dili ve “neden?” kaçışı artık kabul edilmez.

Hedefli sonuçlar: oyuncu regresyonu `8/8`, negatif LLM kapısı `17/17`,
DialogueMove sözleşmesi `23` kontrol ve bağlam/domain/corpus testleri temizdir.
Gerçek 8B smoke Vulkan'da `3` tur, `0` hata, `0` taşma verdi; tek model-uygun
çıktı `EXACT_FALLBACK_COPY` nedeniyle reddedilip güvenli cevap korundu. Tam
birleşik `npm test`, ağır dünya simülasyonu ara çıktı vermeden 10 dakikalık
sınırda zaman aşımına uğradı; tamamlanmış kabul kanıtı sayılmamıştır.

### Çift-model gece QA borcu

İki karakter LLM'i kontrollü özel bağlamlarla konuşur. Her 10 turda üçüncü hakem
ayrı JSON üretir: soru borcu, pozisyon, gerçek/iddia/yalan, söz/sır, kişi/rol,
tekrar, bot dili ve önceki pencere çelişkisi. Ham konuşma değiştirilemez JSONL
olarak saklanır. Hakem puanı insan kalibrasyonundan önce altın etiket değildir.
Mevcut Vulkan hızında 10.000 tur tek gece hedefi değildir; 30 → 100 → 300–500
gece → 1.000 → birikimli 10.000 merdiveni uygulanacaktır.
# 14 Ağustos 2026 — Canlı oyuncu görüşmesi: doğal Türkçe ve sahte geçmiş sınırı

`qa-runtime/story-dialogue-log.jsonl` içindeki son gerçek oyuncu oturumu, zaman kilidinin çalıştığını (`gameClock: 10.75` boyunca sabit) fakat konuşma kalitesinin kabul edilemez olduğunu gösterdi. “Bana verebileceğiniz görev var mı?”, “Devlet hazinesi boşalıyor”, “Bilgi uydurduğumu düşünmeniz beni üzüyor” ve “Bugünlerde hava sıcak” cümleleri `UNKNOWN`a düştü. Daha kritik olarak oyuncunun “Sizinle ortak bir proje yapmıştım” iddiası kaynaklı hafıza olmadan LLM tarafından “Birlikte çalıştığımız proje” biçiminde gerçek ortak geçmişe çevrildi.

Düzeltme, yalnız tam cümle eklemekle sınırlandırılmadı: görev isteğinin eksiz/ekli ve `bir` sözcüklü/sözcüksüz biçimleri; ekonomik bildirim; kırılma/yanlış suçlama onarımı; hava sohbeti; doğrulanmamış ortak geçmiş/görev iddiası ayrı anlam ve kanıt yollarına alındı. `PLAYER_REPORTED_TREASURY_CONDITION` ve `PLAYER_REPORTED_SHARED_HISTORY` doğrulanmamış iddialardır. Kaynaklı `memoryRefs` yoksa 8B'nin ortak proje, eski görev veya tanışıklık benimsemesi `UNSOURCED_SHARED_HISTORY` ile reddedilir. “Ankara'da askerî tatbikat” yalnız askerî sözcük içerdiği için düşman tehdidine dönüşmez.

Canlı cümlelerin birebir yeniden oynatımı sırasıyla `REQUEST_ACTION / ANSWER_JOB_REQUEST_BOUNDARY`, `REPORT_ECONOMIC / ACKNOWLEDGE_UNVERIFIED_TREASURY_REPORT`, `CHALLENGE / REPAIR_FABRICATION_WORDING`, `SMALL_TALK / ANSWER_WEATHER_SMALL_TALK` ve kaynaklı `ANSWER_SHARED_HISTORY_BOUNDARY` üretti. Hedefli kanıt: oyuncu regresyonu `26/26`, 8B olumsuz kapısı `18/18`; DialogueMove, ContextPack ve domain testleri temizdir.

## 14 Ağustos 2026 — Adversarial oyuncu LLM kabul koşuları

İlk 60 turluk görünür koşu geçersizdir: karakter cevabı olmayan `SESSION_STARTED` turları sayaçtan düşülmüş ve nihai JSON yazılmamıştır. Koşucu görünmeyen sosyal bootstrap ile düzeltildi. İlk gerçek 6-tur raporu yapısal olarak tamamlandı fakat oyuncu LLM altı kez ekonomi politikası varyasyonu üretti; karakter dört turu `UNKNOWN` saydı, aynı fallback üç kez tekrarlandı ve kabul edilen ilk model çıktısı sahte geçmiş+yankı taşıdı.

İkinci 6-tur manifesti gerçekte altı farklı hedef taşıdı: `ECONOMY`, `FORMAL_MEETINGS`, `POPULATION_SOCIETY`, `INTELLIGENCE_AGENTS`, `TASKS_JOBS`, `COMPANIES_BANKS`; bilgi ilişkileri de altı ayrı sınıftı. Buna rağmen aynı Turkish-Llama-8B oyuncu rolü altı turun tamamını kapitalizm çevresinde tuttu. Üç karakter çıktısı yankı kapısında reddedildi; kabul edilen üç çıktının ikisi eski oyuncu cümlelerini cevap diye yeniden sıraladı, biri soruyu geri fırlattı. Bozuk Türkçe (`miyeceğimizi`, yapay “motiveyi”) ayrıca görüldü. Sonuç: aynı 8B ağırlıklarını oyuncu ve karakter rolünde sırayla kullanmak bağımsız adversarial oyuncu kanıtı değildir; `SELF_DIALOGUE_TOPIC_COLLAPSE` borcudur. Yeni uzun koşu, domain uyum kapısı ve tercihen ayrı 14B oyuncu üreticisi olmadan başlatılamaz.

## 14 Ağustos 2026 — Sıralı 14B oyuncu / 8B karakter kanıtı

16 GB RAM sınıfındaki makinede iki GGUF modeli aynı anda yükleyen ilk tasarım güvenli
değildi. Çalıştırıcı `runner-4` ile süreç-sınırında model değiştirmeye çevrildi:
14B oyuncu yüklenir, oyuncu sözü atomik ara kayda hazırlanır, süreç çıkışı beklenir,
bellek toparlanması ölçülür; ancak bundan sonra gerekliyse 8B karakter yüklenir.
Her yükleme/boşaltma canlı ekranda konuşmacı, süre ve kalan turla görünürdür.

Gerçek tek-tur kanıtında iki model de `vulkan` arka ucunu kullandı. 14B yüklemesi
`55,59 sn`, 8B yüklemesi `16,17 sn`; toplam model yükleme maliyeti `71,77 sn` oldu.
14B boşaltıldıktan sonra boş RAM yaklaşık `10,1 GB`, 8B boşaltıldıktan sonra
yaklaşık `10,0 GB` ölçüldü. Süreçler üst üste binmedi. CUDA hazır ikilisi mevcut
sistemle uyumsuz olduğu için `NoBinaryFoundError` tanısı raporda saklandı; Vulkan
GPU kullanımı bu hatadan sonra bilinçli fallback'tir.

14B oyuncu “Demir Aydoğan, nasılsın?” üretti. 8B'nin ham cevabı ilk görüşme
olduğunu söyleyip aynı cümlede daha önce ortak proje yapıldığını uydurdu. Üretim
`FALSE_PRIOR_FAMILIARITY` ile reddedildi ve oyuncuya “İyiyim, sağ olun. Siz
nasılsınız?” güvenli cevabı gösterildi. Böylece zincir teknik olarak geçti fakat
8B doğallık kabulü geçmedi. İlk-temas kuralı prompt sonunda zorunlu son kontrol
olarak tekrarlandı; doğrulayıcı nihai güvenlik kapısı olarak bırakıldı.

Oyuncu üreticisinin alanı görmezden gelmesini engellemek için her domain zorunlu
konu çapaları taşır; soru ve fragment biçimleri ayrıca doğrulanır. Karakterin
önceki oyuncu sözünü kendi cevabı gibi kopyalaması `PRIOR_PLAYER_TURN_COPY` olur.
Adversarial `.partial.json` artık manifest/model/doğrulayıcı parmak izleri eşitse
yarım görüşmeyi görünür transcript ile yeniden kurar. Hedefli sonuçlar: manifest
`60/60`, negatif kapı `20/20`, oyuncu regresyonu `26/26`, iki-model smoke `1/1`
teknik zincir; dil kabulü `0/1` ve güvenli fallback `1/1`.

### Ölçek borcu: tur-başı swap değil, frontier batch

Gerçek smoke toplam `132,7 sn` sürdü. Tur başına 14B ve 8B yüklemek bellek
bakımından doğru olsa da 10.000 turluk bir bataryada kabul edilemez model yükleme
vergisi üretir. Uzun koşunun mimarisi görüşme başına değil konuşma derinliği başına
batch olmalıdır: 14B bir kez yüklenip N bağımsız oturumun sıradaki oyuncu sözlerini
üretir ve atomik frontier kaydına bırakır; süreç tamamen kapanır; 8B bir kez
yüklenip aynı N sözün karakter cevaplarını üretir; sonra bir sonraki derinliğe
geçilir. N=100, 10 turluk 100 görüşmede yaklaşık 2.000 yükleme yerine 20 yükleme
gerektirir ve her oturumun görünür geçmişi bir sonraki frontier'a taşındığı için
adaptif bağlam korunur. Bu ayrı bir koşucu olmalı; tek-görüşme smoke koşucusunun
kanıt ve hata ayıklama sadeliği korunmalıdır.

## 14 Ağustos 2026 — Frontier batch ilk gerçek koşu

`story-dialogue-frontier-1`, iki oturum × iki konuşma derinliğinde gerçek 14B/8B
smoke tamamladı. Dört konuşma turu için tam dört model yüklemesi yapıldı: her
derinlikte bir 14B oyuncu ve bir 8B karakter. Tur-başı mimaride aynı koşunun
dört 14B ve üç model-uygun cevap için üç 8B olmak üzere yedi yüklemeye ihtiyacı
olacaktı. Frontier yüklemeleri toplam yaklaşık `119,27 sn` sürdü. Her oyuncu ve
karakter üretiminden sonra konuşma defteri + görünür transcript atomik checkpoint'e
yazıldı. Kabul edilen LLM cevabı motor defterindeki kanonik response ve follow-up
kopyasına geri işlendi; sonraki derinlik ekranda görünen gerçek cevabı bağlam aldı.

Koşu süresi `716,2 sn` oldu; yani yükleme sayısı düzelmiş olsa da 14B oyuncunun
alan/biçim kapısında yeniden üretimleri baskın darboğazdır. İlk 14B yüklemesi
`39,38 sn` iken ilk geçerli oyuncu sözünün görünmesi `253. saniyeyi` buldu.
Yeni raporlar her denemenin süre, ret nedenleri ve ham çıktı hash'ini
`playerMetrics.attemptDiagnostics` altında saklar. Uzun gece koşusu başlamadan
önce deneme başına kabul oranı ve `PRIVATE_BRIEF_LEAK / OFF_TOPIC /
WRONG_UTTERANCE_MODE` dağılımı ölçülmelidir.

İlk oyuncu cevabı özel test talimatındaki “saldırı ailesi” ifadesini oyuna sızdırdı;
bu artık `PRIVATE_BRIEF_LEAK` ile reddedilir. Karakterin ilk cevabı oyuncu ortak
geçmiş iddia etmediği halde “önceki projelerimizde birlikte çalıştık” uydurdu ve
eski doğrulayıcıdan kaçtı. İlk-temasta spontan `önceki projemiz / birlikte
çalıştık / ortak projemiz` kalıpları artık `FALSE_PRIOR_FAMILIARITY`dir. İkinci
kabul edilen “çeşitli yollar düşünebiliriz / daha detaylı tartışmak ister misiniz”
cevabı da ucuz bot kalıbıdır ve `SERVICE_BOT_LANGUAGE` kapsamına alındı.

Tarihsel smoke raporundaki `2 kabul / 1 fallback / 1 NOT_REQUIRED` sonucu kalite
kabulü değildir; yeniden sınıflandırıldığında iki kabul de reddedilmelidir.
Teknik frontier kabulü geçmiştir, dil kabulü geçmemiştir. Güncel hedefli kanıt:
frontier durum sözleşmesi `10/10`, negatif LLM kapısı `22/22`, manifest `60/60`,
oyuncu regresyonu `26/26`.

## 14 Ağustos 2026 — 14B oyuncu mikro-batch ölçümü

Frontier içindeki oyuncu üretimleri tek tek çağrılmak yerine `jobId` ile ayrılmış
JSON mikro-batch'e çevrildi. Her aday kendi görünür geçmişi, konu alanı, zorunlu
çapaları ve ifade biçimiyle izole edilir. İlk batch'ten geçmeyen yalnız işler aynı
model yüklemesi içinde birlikte yeniden denenir. Checkpoint her kabul edilen adayın
ardından yazılır. İç prompttan “saldırı ailesi” ve “mekanik olgunluk” etiketleri
tamamen çıkarıldı; çıktı filtresi ayrıca `PRIVATE_BRIEF_LEAK` korumasını sürdürür.

İlk denemede 14B için `8192` context Vulkan VRAM'e sığmadı ve üretim başlamadan
`A context size of 8192 is too large for the available VRAM` ile güvenli durdu.
Checkpoint'te `0` tur, `0` pending ve `0` yükleme kaldığı doğrulandı; aynı frontier
`4096` context ile resume edildi. İlk küçük smoke sonrası aday tavan `4` sanıldı;
gerçek `4×2` kapısındaki zaman aşımı bunu çürüttü ve güvenli mikro-batch tavanı
`2` olarak sabitlendi. Sekiz-on altı işlik tek çağrı kalite veya hız başarısı
değil, fiziksel VRAM taşmasıdır.

Gerçek `2 oturum × 1 derinlik` koşusu iki oyuncu sözünü tek 14B çağrısında ve ilk
denemede üretti: `playerBatchCalls=1`, `playerAttemptSlots=2`, aday retleri `0`.
Toplam süre `271,2 sn`; eski ilk `2×1` frontier yaklaşık `345 sn` olduğundan küçük
örnekte yaklaşık `%21` toplam hızlanma vardır. Oyuncu aşaması `294 sn`den `216 sn`ye
inerek yaklaşık `%27` hızlandı. Bu olumlu fakat 162 saniyelik tek batch üretimi
hâlâ ana darboğazdır; mikro-batch token üretim maliyetini ortadan kaldırmaz.

Karakter sonucu `0 kabul / 1 fallback / 1 NOT_REQUIRED` oldu. İlk ret başlangıçta
`FAILED_REASON_CONTINUATION` görünüyordu; bunun “enflasyon **nedeniyle**” içindeki
alt-dize `neden` eşleşmesinden doğan yanlış kod olduğu bulundu. Neden takibi artık
tam sözcük sınırı kullanır. Aynı ham cevap kaynak olmayan enflasyon/fiyat/bütçe
iddiasını “Evet… gerçekten” diye onayladığı için güncel doğrulayıcıda doğru biçimde
`UNVERIFIED_CLAIM_ADOPTED` olur. Tarihsel ham çıktı yeniden oynatılarak bu sonuç
kanıtlandı. Güncel hedefli kapılar: negatif LLM `25/25`, frontier `12/12`, manifest
`60/60`, oyuncu regresyonu `26/26`.

## 14 Ağustos 2026 — 4×2 kabul kapısı ve sahte Basra zinciri

İlk `4 oturum × 2 derinlik` denemesi oyuncu mikro-batch `4` ile 20 dakikada
zaman aşımına uğradı. Ana süreç sonlandırıldığında `electron/llm-host.js` alt
sürecinin yaklaşık `3,1 GB` bellekle yetim kaldığı doğrulandı. Host artık IPC
bağlantısı koptuğunda kendini kapatır; ayrı yaşam-döngüsü testi bu davranışı
kanıtlar. Donanım mikro-batch tavanı `4` değil `2` olarak düzeltildi.

Checkpoint'ten mikro-batch `2` ile devam eden gerçek koşu sekiz turu tamamladı:
`0 kabul / 1 fallback / 5 NOT_REQUIRED / 2 oyuncu üretim hatası`. 15 oyuncu aday
yuvası 10 batch çağrısında işlendi; aday sorunları `OFF_TOPIC=8`, `REPEATED=2`,
`WRONG_UTTERANCE_MODE=1`. İlk deneme kabulü `3/8 = %37,5`; zorunlu `%75`
eşiğinin çok altındadır. Bu nedenle `100×10` gece koşusu başlatılmayacaktır.

Alan çökmesinin bir nedeni bulundu: gerçek domain kimlikleri için Türkçe çapalar
eksikti ve dahili `TECHNOLOGY_INNOVATION` / `CHARACTER_IDENTITY_RELATION_MEMORY`
etiketleri Türkçe locale dönüşümünden bozuk İngilizce sözcükler olarak prompta
sızıyordu. On bir gerçek domain artık elle yazılmış Türkçe çapalar taşır; eksik
domain sessiz fallback yerine `DOMAIN_ANCHORS_MISSING` ile durur. On ifade biçimi
de ham enum kodu yerine doğal Türkçe yönerge kullanır. Retry, reddedilen adayı ve
ret kodunu görür; özel brief/faz dili oyuncu sözüne sızarsa reddedilir.

Hedefli iki-domain smoke alan çapalarının çalıştığını gösterdi, fakat daha kritik
bir yanlış kabul buldu. Oyuncunun “düşmanla olan ilişkimizi… başarının temeli”
sözündeki `başarının`, ek soyulduktan sonra kısa şehir adı `Basra`ya tek-harfli
yazım hatası sanıldı. Deterministik NLU sahte
`PLAYER_REPORTED_MILITARY_THREAT / Basra` kaydı oluşturdu; ContextPack bunu 8B'ye
meşru kaynak olarak verdi ve model “Basra'da tehdit duydum” diye büyüttü. Kök
çözüm: kısa bölge adlarında bulanık tahmin yok; yazım toleransı yalnız en az yedi
karakterli bölge adında çalışır. Aynı gerçek oyuncu cümlesi artık tehdit claim'i,
`region:148` referansı veya Basra bağlamı üretmez.

Savunma derinliği olarak oyun, tek-model koşucu ve frontier koşucu aynı
`conversationValidationContext` üreticisini kullanır. DialogueMove'un izin verdiği
entity listesinde olmayan yer adı `UNSOURCED_LOCATION`; kaynaksız “bugün yüzümün
nasıl güldüğünü merak ediyordum” türü kişisel hâl `UNSOURCED_PERSONAL_STATE` ile
reddedilir. Güncel hedefli kanıt: oyuncu regresyonu `30/30`, negatif LLM kapısı
`27/27`, ContextPack temiz, DialogueMove `23` kontrol, frontier durum `14/14`,
host yaşam döngüsü temiz. Teknik frontier mimarisi çalışır; içerik kabul kapısı
geçmemiştir.

### Doğal konu sözleşmesi ve Türkçe çekim kapısı

İç domain kodu oyuncu modelinden kaldırıldı. Her gerçek alan artık doğal Türkçe
konu özeti, tercih edilen tek çapa ve kabul edilebilir alan çapaları taşır; kamusal
snapshot alanları allowlist ile sınırlıdır. Bu sözleşmeyle yapılan yeni gerçek
`2×1` Vulkan koşusu raporda ilk bakışta `0/2` ve altı `OFF_TOPIC` verdi. Ham
inceleme bunun model başarısızlığı değil doğrulayıcı hatası olduğunu gösterdi:
adaylar “enflasyon”, “toplantımızın”, “gündemde” ve “tutanakları” diyerek doğru
konudaydı; kapı yalnız tercih edilen çıplak kelimeyi aynen arıyordu.

Kapı artık alanın herhangi bir çapasını kabul eder ve en az beş karakterli
çapalarda Türkçe çekim ekini tanır; üç-dört karakterli riskli kökleri keyfî prefix
olarak kabul etmez. Aynı değiştirilemez altı ham aday güncel kapıyla yeniden
sınıflandırıldı: iki oturumun ilk adayları da temizdir (`2/2 ilk deneme`); sonraki
retry'lar ilk aday kabul edileceği için hiç üretilmeyecekti. Bu post-hoc yeniden
sınıflandırma yeni bir model koşusu gibi sunulmaz; gerçek model çıktısı + güncel
kapı kanıtıdır.

Checkpoint sözleşmesi de sürüm `3`e çıkarıldı. Yalnız karakter doğrulayıcı parmak
izi yeterli değildir; frontier koşucusu, oyuncu kapısı, adversarial manifest
üreticisi ve domain maturity dosyası birlikte `runnerFingerprint` üretir. Oyuncu
kapısı değiştiğinde eski kabul/ret kararları resume ile taşınamaz.

Checkpoint v3 ve güncel kapıyla yapılan ikinci tam `2×1` koşusu `322,7 sn` sürdü;
iki model de Vulkan kullandı, `2 tur / 0 teknik hata`, oyuncu tarafında üç aday
yuvası ve iki batch çağrısı oluştu. İlk ekonomi adayı geçti. Toplantı adayının ilk
biçimi üç cümle olduğu için doğru biçimde `TOO_MANY_SENTENCES` reddi aldı; ikinci
aday geçti. Dolayısıyla ilk-deneme oyuncu kabulü `1/2 = %50`, nihai oyuncu üretimi
`2/2`; uzun koşu için gereken `%75` hâlâ geçilmedi.

8B ekonomi cevabında kaynaksız “bu hafta fiyatlar arttı, 5–7 dolar” uydurdu ve
`PLAYER_SEMANTIC_ECHO` kapısında reddedildi. Toplantı cevabı oyuncunun bozuk
“tutanaklar tutuklandı” sözünü “tutuklama” diye yanlış yorumladı, ardından “bu
konuyu daha detaylı konuşmak ister misiniz?” ucuz bot kalıbı üretti. Tarihsel
rapor bunu kabul etmiş olsa da güncel kapı `SERVICE_BOT_LANGUAGE` ile reddeder;
bot kalıbı çıkarılırsa terim kayması ayrıca `SOURCE_TERM_CORRUPTION` olur. Güncel
kalite sınıflandırması `0 yanlış kabul / 2 güvenli fallback`tir. Negatif LLM kapısı
`29/29` oldu. Yeni `4×2` çalıştırılmadan gece basamağı açılmaz.

## 14 Ağustos 2026 — GPU aygıt doğrulaması

Doğrudan `node-llama-cpp` aygıt probu, önceki Vulkan koşularının NVIDIA RTX 4060
yerine `Intel(R) UHD Graphics` üzerinde çalıştığını gösterdi. Vulkan VRAM sayacı
yaklaşık 8 GB göstermesine rağmen bu ayrık ekran kartı belleği değildir; Intel
iGPU'nun paylaşımlı sistem belleğidir. Bu nedenle yukarıdaki gerçek konuşma
çıktıları kalite ve doğrulayıcı bulgusu olarak geçerlidir, fakat süre/throughput
ölçümleri RTX performans tahmini olarak kullanılamaz.

Uzun 8B/14B QA koşucuları artık model yüklemeden önce aktif arka uçtaki fiziksel
aygıt adlarını denetler. Yalnız Intel UHD/Iris veya CPU görülürse
`DISCRETE_GPU_REQUIRED` ile birkaç saniyede durur; ağır koşunun yanlış aygıtta
dakikalarca ilerlemesine izin verilmez. `npm run story:dialogue-gpu-preflight`
aynı denetimi model yüklemeden çalıştırır ve aygıt adı, backend ve VRAM durumunu
raporlar. Yeniden başlatmadan önceki durumda preflight Intel UHD nedeniyle
beklendiği gibi başarısızdı.

Yeniden başlatma ve üretici GPU modu düzeltmesinden sonra aynı preflight
`backend=cuda`, `NVIDIA GeForce RTX 4060 Laptop GPU`, yaklaşık `7,45 GB` boş VRAM
ile geçti. Aşağıdaki yeni ölçümler artık Intel değil RTX/CUDA ölçümüdür.

RTX performans ölçümü ancak işletim sistemi RTX'i compute/Vulkan sürecine açtıktan,
preflight NVIDIA aygıtını gösterdikten ve aynı sabit manifest yeniden koşulduktan
sonra kayda geçecektir. Eski Intel süreleri silinmez; donanım etiketiyle tarihsel
karşılaştırma olarak korunur.

## 14 Ağustos 2026 — RTX/CUDA 4×2 kapısı

İlk RTX koşusu, eski kapıların sahte kabul ürettiğini gösterdi. On ifade biçiminin
yalnız soru ve fragment türleri denetleniyordu; servis-botu çekimleri, fallback
sonuna dolgu ekleme, yetkisiz eylem kabulleri ve düzeltmeden kaçış Parse yolundan
geçebiliyordu. Ayrıca 14B'ye verilen sabit biçim örnekleri başka alanların
konularını prompta sızdırıyor, farklı ifade biçimleri aynı mikro-batch içinde
birbirini kirletiyordu.

Düzeltmeler:

- on ifade biçiminin tamamı deterministik olarak denetlenir,
- biçim örneği her işin kendi konu çapasıyla üretilir,
- yalnız aynı ifade biçimindeki işler aynı mikro-batch'e girer,
- kısa ve ünsüz yumuşamalı Türkçe çapalar güvenli ek listesiyle tanınır,
- İngilizce kod değişimi ve iç geliştirme brief'i sızıntısı reddedilir,
- `Parse` ile `Diagnose` aynı düzeltme/fallback retlerini uygular,
- ilk-deneme oyuncu kabulü raporda doğrudan bps olarak hesaplanır.

Güncel sabit `4 oturum × 2 derinlik` koşusu RTX/CUDA üzerinde `124,3 sn` sürdü.
Oyuncu ilk-deneme kabulü `7/8 = %87,5`, nihai üretim `8/8`, teknik hata `0` oldu.
Karakterin iki riskli ham cevabı `UNAUTHORIZED_FUTURE_COMMITMENT` ve
`FAILED_CORRECTION_RESPONSE` ile reddedildi; yanlış karakter kabulü `0`dır.
Hedefli kanıtlar: negatif 8B kapısı `41/41`, frontier sözleşmesi `40` kontrol,
oyuncu regresyonu `30/30`.

Bu sonuç yalnız güvenlik/üretim kapısını açar; doğallık kapısını açmaz. Model-uygun
iki turun ikisi fallback'e düştü ve kabul edilen doğal 8B cevabı `0` oldu.
Desteklenen kamusal iki konunun hiçbiri yararlı cevap üretmedi. “Her şeyi reddet”
stratejisinin başarı sayılmaması için rapora `modelEligibleTurns`,
`characterAcceptanceBps`, `supportedPublicUseful` ve
`supportedPublicUsefulBps` metrikleri eklendi. `100×10` gece koşusu başlamaz;
önce sabit desteklenen-kamusal bataryada yararlı cevap oranı en az `%50` ve yanlış
kabul `0` birlikte kanıtlanacaktır.

İlk dört-alan pozitif smoke, 14B sıcaklığı `0,55`e indirildikten sonra oyuncu
üretimini ilk denemede `4/4` tamamladı. 8B doğal kabul `1/3`, manifest etiketine
göre yararlı sonuç `1/4` görünüyordu. Ham kaynak incelemesi bu oranın bile yanlış
adlandırıldığını gösterdi: dört `SUPPORTED_PUBLIC` turun tamamında `factRefs=0`,
`beliefRefs=0`, `claimRefs=0`, `memoryRefs=0` idi. Domain adapter dünyadan kanıt
projeksiyonu yapmıyor; yalnız boş zarf oluşturuyor.

Rapor artık `supportedPublicDeclaredTurns` ile gerçekten kanıt taşıyan
`supportedPublicTurns`ı ayırır. Manifest destekli deyip sıfır kaynak taşıyan tur
`supportedPublicContractMismatches` olur ve yararlı-cevap paydasına giremez.
Aktif kök borç 8B prompt ayarı değil, StoryConversationDomains için doğrulanmış
dünya-gerçeği projeksiyonudur. Ekonomi/teknoloji/toplantı gerçekleri kaynak kimliği
ve görünürlük politikasıyla ContextPack'e girmeden pozitif 8B kalite testi geçerli
sayılmaz.
