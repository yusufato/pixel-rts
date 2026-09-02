# Pixel RTS Harici AI Gold İnceleme Protokolü

## 1. Amaç ve yetki sınırı

Harici modeller yalnız önceden hazırlanmış steril partileri bağımsız biçimde
etiketler. Bir model kendi çıktısını gold ilan edemez ve ana corpus'a yazamaz.
Gold kabulü ancak ayrı model çıktıları birleştirildikten, provenans doğrulandıktan
ve merkezi geliştirici tarafından içeri alındıktan sonra mümkündür.

Bu protokol fail-closed çalışır: eksik dosya, yanlış model kimliği, belirsiz
yetki veya yasak yola erişim halinde model hiçbir dosya değiştirmeden durur.

## 2. Değişmez roller

| Rol | Görev | Oy |
| --- | --- | --- |
| `LABELER` | Steril girdiyi tek tek etiketler | Bir bağımsız model ailesi için 1 |
| `STABILITY_AUDITOR` | Aynı model ailesinin tekrar tutarlılığını ölçer | 0 |
| `ARBITER_AND_MERGER` | Tamamlanmış çıktıları karşılaştırır ve anlaşmazlıkları inceler | Hakem |

Bir model aynı partide birden fazla rol üstlenemez. Aynı sağlayıcı/model
ailesindeki iki oturum iki bağımsız oy sayılamaz.

## 3. Zorunlu başlangıç zarfı

Her çalıştırmada kullanıcı şu beş değeri açıkça vermelidir:

```yaml
ROLE: LABELER | STABILITY_AUDITOR | ARBITER_AND_MERGER
MODEL_ID: tam-model-adı-ve-sürümü
BATCH_ID: external-review-NNNN
INPUT_FILE: qa-runtime/external-ai-reviews/<batch>/input.json
OUTPUT_FILE: qa-runtime/external-ai-reviews/<batch>/<atanmış-model>.json
```

Model kendi kimliğini doğrulayamıyorsa, dosya yollarından biri eksikse veya
`OUTPUT_FILE` başka modele aitse işlem başlamaz. Model kimliği tahmin edilmez;
`High`, `Flash`, `Sonnet` ve `Opus` birbirinin yerine yazılamaz.

## 4. Dosya yetkisi

- `INPUT_FILE` salt okunurdur.
- `OUTPUT_FILE` modelin repo içindeki tek yazma hedefidir.
- `tools/story-semantic-intent-corpus.json` bütün harici modeller için salt
  okunur değil, **yasak dosyadır**; labeler tarafından açılmaz.
- Kaynak kodu, testler, araçlar, planlar, ledger, docs, config, Electron, IPC,
  runtime, diğer model çıktıları ve `.git` kapsam dışıdır.
- Model dizin veya eksik input oluşturamaz. Eksik girdide yalnız hata raporu
  verir; corpus'tan kendi başına kayıt seçmez.
- Model git komutu, formatlayıcı, kod üretici veya toplu arama/değiştirme
  çalıştıramaz.
- Çıktı önce yeni geçici içerik olarak hazırlanır; hedefte önceden dosya varsa
  üzerine yazılmaz ve işlem durur.

Bu sınırlardan birinin ihlali çıktıyı `DISQUALIFIED_PROTOCOL_VIOLATION` yapar.
İçerik doğru görünse bile oy hakkı geri verilmez. İhlal edilmiş çıktı yalnız
adli/kurtarma kaydı olarak saklanabilir.

## 5. Körlük ve veri sınırı

Labeler yalnız `id`, `text`, `history`, `speakerFamily`, `familyId` ve `split`
alanlarını görebilir. `proposalSpeechAct`, adjudication, parser/embedding sonucu,
eşik, skor ve başka AI cevabı girdide bulunamaz.

- Yalnız `prototype` ve `calibration` kayıtları incelenir.
- `blind_test` ile spent V3–V6 içerikleri açılmaz.
- Beklenmeyen alan görülürse model onları yok sayarak devam etmez; veri sızıntısı
  olarak durur ve raporlar.
- Labeler ile stability auditor birbirlerinin sonuçlarını göremez.
- Hakem ancak bütün atanmış bağımsız çıktılar kapandıktan sonra çalışır.

## 6. Tekil inceleme ve benzersizlik

Her cümle history ve konuşmacı ailesiyle ayrı okunur. Toplu heuristic, anahtar
kelime çoğaltma, önceki etiketi kopyalama veya “hepsi aynı sınıf” varsayımı
yasaktır. Her kabul gerekçesi cümleye özgü olmalı ve en yakın karşı sınıfı neden
reddettiğini açıklamalıdır.

Metinsel benzersizlik semantik benzersizlik değildir. Yalnız ülke, kurum, kişi,
kaynak veya alan adı değişen; aynı cümle iskeleti, aynı iletişim eylemi ve aynı
koşul yapısını taşıyan kayıtlar tek `templateCluster` içinde değerlendirilir.
Örneğin “X desteği vereceğim, karşılığında pay teklif ediyorum” kalıbının ekonomi,
teknoloji ve nüfus sözcükleriyle yinelenmesi bağımsız üç aile değildir.

Kararlar:

- `ACCEPT`: eksiksiz, güvenilir ve bağımsız gold adayı.
- `NEEDS_REVIEW`: anlam, bağlam veya eksen kararı belirsiz.
- `SEMANTIC_NEAR_DUPLICATE`: başka kaydın şablonsal/parafraz tekrarı.

Eksik, kesik veya dilbilgisel olarak anlamı değiştirecek kadar bozuk cümleler
zorla etiketlenmez. Yazım hatası, argo veya B1 Türkçesi tek başına ret sebebi
değildir.

## 7. Etiket güvenliği

Bütün SemanticFrameV2 alanları doldurulur: `speechAct`,
`communicativeFunction`, `surfaceForm`, `predicate`, `target`, `polarity`,
`temporality`, `epistemicStatus`, `continuity`, `requestedOutcome`,
`outOfDomain` ve `secondarySpeechActs`.

Özellikle:

- Konu benzerliği eylem niyeti değildir.
- Sır vermeyi teklif etmek, sırrı gerçekten paylaşmak değildir.
- Duygu bildirmek, ekonomik konu geçtiği için ekonomik rapor olmaz.
- Ticari teklif iki tarafın karşılıklı edimini açıkça taşımalıdır.
- `THREATEN`, `REQUEST_ACTION`, `PROPOSE_COMMERCIAL_DEAL`, `SHARE_SECRET`,
  `BLUFF_CANDIDATE` ve OOD kararları yüksek risktir.

Yüksek-risk kararı 3/3 uzlaşsa bile hakem kontrolü olmadan corpus'a alınmaz.

## 8. Uzlaşma ve hakemlik

Ana oylar farklı model ailelerinden gelir. Notes metinleri değil, on bir etiket
ekseni karşılaştırılır; `secondarySpeechActs` sırası önemsizdir.

- `3/3`: `UNANIMOUS_CANDIDATE`; yüksek riskse ayrıca hakem zorunlu.
- `2/3`: otomatik gold değildir; hakem yeniden inceler.
- `1/1/1`: `NEEDS_HUMAN_DECISION`.
- Stability auditor ana modelle ayrışırsa kayıt hakeme gider.
- Bir model semantik tekrar bildirirse hakem bütün corpus'u açmadan yalnız steril
  template envanteri üzerinden iddiayı doğrular.

Hakem de corpus'a yazamaz. Yalnız atanmış `consensus.json` dosyasını üretir.
`GOLD_CANDIDATE` merkezi kabul öncesinde gold sayılmaz.

## 9. Zorunlu çıktı makbuzu

Her çıktı; `schemaVersion`, `kind`, `batchId`, tam `reviewer`, `role`,
`protocolStatus`, `blindAccessed=false`, `sourcePredictionsAccessed=false`, kayıt
kararları, template kümeleri ve özet sayaçları taşır. Model ayrıca:

- okuduğu tek input yolunu,
- yazdığı tek output yolunu,
- değerlendirdiği ID listesini,
- erişmediği yasak yolları,
- kararsız ve tekrar kayıtları,
- model kimliği doğrulamasını

makbuzlar. “Sorun yok” gibi kanıtsız toplu ifade doğrulama sayılmaz.

## 10. İhlal sonrası işlem

Bir model yasak dosyaya yazarsa:

1. Çalışma hemen durdurulur.
2. Model aynı partide yeniden çalıştırılmaz.
3. Değişiklikler silinmeden önce ayrı bir recovery dosyasına çıkarılır.
4. Recovery kaydı `eligibleForConsensus=false` olur.
5. Ana corpus doğrulanmış son duruma geri getirilir.
6. Aynı parti yeni ve bağımsız bir modelle baştan değerlendirilir.

Protokol uyumu etiket doğruluğundan önce gelir. Doğru görünen bir sonuç, yetki
sınırını çiğnediyse gold zincirine giremez.
