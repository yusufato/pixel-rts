# Pixel RTS Harici AI Gold İnceleme Protokolü

## 1. Amaç ve yetki sınırı

Harici modeller yalnız önceden hazırlanmış steril partileri bağımsız biçimde
etiketler. Bir model kendi çıktısını gold ilan edemez ve ana corpus'a yazamaz.
Gold kabulü ancak ayrı model çıktıları birleştirildikten, provenans doğrulandıktan
ve merkezi geliştirici tarafından içeri alındıktan sonra mümkündür.

Bu protokol fail-closed çalışır: eksik dosya, yanlış model kimliği, belirsiz
yetki veya yasak yola erişim halinde model hiçbir dosya değiştirmeden durur.

## 2. İzin verilen modeller ve değişmez roller

Bu iş için izin verilen harici model listesi kapalıdır:

| `MODEL_ID` | Normal tur rolü | Bağımsız çıktı |
| --- | --- | --- |
| `Sonnet-4.6` | `LABELER` | Evet |
| `Opus-4.6` | `LABELER` | Evet |

`Gemini-*` dahil tabloda bulunmayan modeller bu corpus için görev alamaz,
çıktı üretemez ve uzlaşmaya katılamaz. Yeni model ancak kullanıcı kararıyla bu
tabloya açıkça eklenir. Model kendi rolünü seçmez veya tahmin etmez.

Sonnet ve Opus aynı sağlayıcıdan geldikleri için istatistiksel olarak bağımsız
model aileleri oldukları iddia edilmez. Buradaki bağımsızlık; ayrı, kör ve
birbirinin çıktısını görmeyen iki inceleme çalışması anlamındadır.

| Rol | Görev | Oy |
| --- | --- | --- |
| `LABELER` | Steril girdiyi tek tek etiketler | Bir izinli model için 1 |
| `STABILITY_AUDITOR` | Aynı model ailesinin tekrar tutarlılığını ölçer | 0 |
| `ARBITER_AND_MERGER` | İki kapalı çıktıyı karşılaştırır; harici modellere varsayılan atanmaz | 0 |

Bir model aynı partide birden fazla rol üstlenemez. Aynı sağlayıcı/model
ailesindeki ek oturumlar yeni oy sayılamaz. Normal turda stability auditor
zorunlu değildir. Sonnet veya Opus kendi çıktısının hakemi olamaz.

## 3. Kendiliğinden başlayan görev zarfı

Kullanıcı her model için rol, parti ve yol değerlerini tek tek yazmaz. Model bu
dosyadaki **Aktif görev matrisi** içinde kendi tam `MODEL_ID` satırını bulur ve
beş zorunlu değeri o satırdan alır. Satır eksiksiz ve dosyalar mevcutsa soru
sormadan çalışmaya başlar.

### Aktif görev matrisi

```yaml
ACTIVE_BATCH_ID: external-review-0001
ASSIGNMENTS:
  Sonnet-4.6:
    ROLE: LABELER
    INPUT_FILE: qa-runtime/external-ai-reviews/external-review-0001/input.json
    OUTPUT_FILE: qa-runtime/external-ai-reviews/external-review-0001/sonnet-4-6-r1.json
    STATUS: CLOSED
  Opus-4.6:
    ROLE: LABELER
    INPUT_FILE: qa-runtime/external-ai-reviews/external-review-0001/input.json
    OUTPUT_FILE: qa-runtime/external-ai-reviews/external-review-0001/opus-4-6.json
    STATUS: CLOSED
```

Bu matris bir görev zarfıdır ve her satır aşağıdaki beş değeri eksiksiz tanımlar:

```yaml
ROLE: LABELER | STABILITY_AUDITOR | ARBITER_AND_MERGER
MODEL_ID: tam-model-adı-ve-sürümü
BATCH_ID: external-review-NNNN
INPUT_FILE: qa-runtime/external-ai-reviews/<batch>/input.json
OUTPUT_FILE: qa-runtime/external-ai-reviews/<batch>/<atanmış-model>.json
```

`MODEL_ID` matris anahtarıdır; ayrıca kullanıcıdan istenmez. Model kendi
kimliğini doğrulayamıyorsa, kendi satırı yoksa, `STATUS` değeri `READY` değilse,
dosya yollarından biri eksikse veya `OUTPUT_FILE` başka modele aitse işlem
başlamaz. Model bu durumda soru sormaz, yol üretmez ve dosya oluşturmaz; yalnız
hangi kapının kapanmış olduğunu konuşmada bildirir. Model kimliği tahmin edilmez;
`High`, `Flash`, `Sonnet` ve `Opus` birbirinin yerine yazılamaz.

Aktif parti değiştiğinde merkezi geliştirici yalnız bu matrisi günceller. Eski
parti yolu, sohbet geçmişindeki atama veya modelin önceki görevi yeni atama
sayılmaz. Matris ile sohbet talimatı çelişirse model hiçbir dosyaya yazmadan
durur ve çelişkiyi bildirir.

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
- Aktif görev matrisinde kendi satırı bulunan model, rol veya yol teyidi istemez.
  Matris dışındaki olası dosyaları aramak da yetki ihlalidir.

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

Yüksek-risk kararı Sonnet ve Opus arasında `2/2` eşleşse bile merkezi/human
kontrol olmadan corpus'a alınmaz.

## 8. İki-model uzlaşması ve hakemlik

Ana tur yalnız Sonnet 4.6 ve Opus 4.6'nın birbirinden kör iki çıktısından oluşur.
Notes metinleri değil, on bir etiket ekseni karşılaştırılır;
`secondarySpeechActs` sırası önemsizdir.

- `2/2` ve bütün eksenler aynı: `TWO_REVIEWER_AGREEMENT_CANDIDATE`.
- `1/2`, karar türü ayrışması veya tek eksen farkı: `NEEDS_HUMAN_DECISION`.
- Tek geçerli çıktı: beklenir; otomatik gold veya uzlaşma üretilmez.
- Stability auditor ancak merkezi geliştirici ayrıca atarsa çalışır ve oy eklemez.
- Bir model semantik tekrar bildirirse hakem bütün corpus'u açmadan yalnız steril
  template envanteri üzerinden iddiayı doğrular.

Normal turda Opus hakem değildir; kendi oyunu hakemleyemez. Birleştirme,
iki çıktı kapandıktan sonra merkezi geliştirici tarafından deterministik olarak
yapılır. Gerekirse kullanıcı anlaşmazlığı karara bağlar. Hakem de corpus'a
yazamaz; yalnız atanmış `consensus.json` dosyasını üretir.
`TWO_REVIEWER_AGREEMENT_CANDIDATE` merkezi kabul öncesinde gold sayılmaz.

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

`protocolStatus=COMPLETE` yazılmadan önce şu makine-doğrulanabilir eşitliklerin
tamamı sağlanmalıdır:

- `records.length == evaluatedIds.length == input.records.length`;
- input, `evaluatedIds` ve `records` ID kümeleri birebir aynıdır; tekrar yoktur;
- `reviewed == records.length`;
- karar sayaçlarının toplamı `reviewed` değeridir ve her sayaç kayıt gövdesinden
  yeniden hesaplanan değerle aynıdır;
- `highConfidence + mediumConfidence + lowConfidence == reviewed`;
- template kümesi üye ve karar sayaçları kayıt gövdesiyle aynıdır;
- her `ACCEPT` tam etiket çerçevesi taşır; `NEEDS_REVIEW` ve
  `SEMANTIC_NEAR_DUPLICATE` zorla gold etiketi taşımaz.

Bu eşitliklerden biri bozuksa dosya protokol ihlali nedeniyle kalıcı diskalifiye
olmaz; fakat `INVALID_RECEIPT` sayılır, uzlaşmaya giremez ve `COMPLETE` kabul
edilmez. Düzeltme gerekiyorsa mevcut dosya üzerine yazılmaz; aktif görev
matrisinde yeni bir output yolu atanır ve model yalnız steril inputtan yeniden
çalışır.

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
