# 1) Verdict

- **Root cause:** Embedding aday seçimi, aynı 51 kalibrasyon kaydında eşikleri öğrenip aynı kayıtlarla temsil ve çapa sayısını seçtiği için resubstitution yanlılığı üretiyor; sınıf başına yalnız üç aile varken kalibrasyondaki sıfır yüksek-risk hatası yeni ailelere genellenmiyor.
- **Confidence:** Confirmed.
- **Chain:** Aynı satırlarda eşik uydurma → aynı satırlarda macro-F1/güvenlik ölçme → 15 temsil/çapa adayından en iyi görüneni seçme → iyimser kalibrasyon → bağımsız blind sette kalite düşüşü ve yüksek-risk yanlış pozitif.
- **State:** Ürün etkisi contained. İki model reddedildi, runtime'a bağlanmadı ve görülen blind epoch tekrar kullanıma kilitlendi. Seçim mekanizmasının kök kusuru henüz düzeltilmedi.

# 2) Failure Definition

- **Precise symptom:** Kalibrasyonun seçtiği E5 kolu `0,551852` macro-F1 ve `0` yüksek-risk yanlış pozitiften blind'da `0,318783` ve `6` hataya; BGE-M3 kolu `0,528070/0`dan `0,309023/3`e düşüyor. İki aday da gerekli `+0,15` blind farkını ve sıfır yüksek-risk şartını geçemiyor.
- **Correction to the reported symptom:** Bu sonuç uçtan uca karakter anlayışının `%99` bozuk veya `%90` düzelmiş olmasını doğrudan ölçmez; yalnız 17 sınıflı ana `speechAct` yönlendirmesini ölçer.
- **Reproduction:** `qa-runtime/story-semantic-embedding-untouched-evaluation.json` makbuzundaki iki modelde `2/2`; her seçili profil calibration→blind düşüşü ve yüksek-risk hata artışı gösterdi.
- **Blast radius:** Embedding aday/temsil seçimi. Mevcut oyun runtime'ı etkilenmedi çünkü kabul edilen model ve IPC bağı yoktur.
- **First occurrence:** Aynı kalibrasyon yapısı 27 Ağustos ölçümünde de calibration `0` yüksek-risk hatasına rağmen blind E5/BGE sonuçlarında `1/4` hata üretmişti; dengeli taze cohort 31 Ağustos'ta mekanizmayı yeniden gösterdi.

# 3) Timeline

| Time | Event | Source | Significance |
|---|---|---|---|
| 2026-08-27 | İlk E5/BGE spike iki adayı reddetti | `LEDGER.md` | Kalibrasyon–blind güvenlik farkının ilk ölçümü |
| 2026-08-28 | Çoklu çapa/frame ablation'ı kalibrasyonun daha iyi blind kolunu seçemediğini gösterdi | `LEDGER.md` | Temsil sinyali var, seçim kararsız |
| 2026-08-30 | 17 sınıf ve OOD için taze `10/51/51` cohort tamamlandı | `495b9ff`, `4fe193b` | Salt sınıf kapsama açığı kapandı |
| 2026-08-31 00:05 +03 | E5/BGE taze blind sette bir kez ölçüldü | Yerel spike makbuzu | Seçili kollarda `6/3` yüksek-risk yanlış pozitif |
| 2026-08-31 | Epoch tüketilmiş olarak kilitlendi | `04a5fa2` | Aynı blind sonuçla yeniden ayar engellendi |

# 4) Hypotheses (ranked)

## H1 — Aynı kalibrasyon satırlarında fit ve seçim iyimser sonuç üretiyor

- **Category:** Data / evaluation boundary
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `tools/story-semantic-intent-benchmark.js:433-482`, `485-499`, `552-566`
- **Evidence:** `fitEmbeddingCalibration` eşik ve `minimumMargin` adaylarını verilen satırlardan öğrenip `summarizeEmbeddingRows(rows, ...)` ile yine aynı satırları puanlıyor. `runEmbeddingModel` daha sonra profili yine bu kalibrasyon metriğine göre seçiyor. E5 `0,551852→0,318783`, BGE `0,528070→0,309023`; yüksek-risk yanlış pozitif `0→6/3`.
- **If true, we would also see:** Kalibrasyon liderinin bağımsız blind lideri olmaması ve kalibrasyon–blind aralığının geniş olması.
- **Discriminating test:** Her sınıftan bir aileyi dışarıda bırakan üç deterministik outer fold kur; eşikleri yalnız iki aile/sınıfta fit et, seçimi yalnız dışarıdaki ailelerde ölç. Resubstitution lideri outer-fold lideri değilse hipotez doğrulanır.
- **Status:** Supported/Confirmed. BGE kalibrasyon lideri `frame-top3-mean/N=10`; yalnız tanısal blind lideri `single-max/N=5`tir. Blind lideri yeni ayar olarak kullanılamaz.
- **Why it matters:** Kalibrasyonda sıfır güvenlik hatası gerçek yeni oyuncu cümleleri için sıfır hata anlamına gelmiyor.
- **Recommended fix:** Temsil/profil/N seçimini stratified nested calibration sonucu ile yap; yapı dondurulduktan sonra son eşikleri bütün kalibrasyonda bir kez fit et.
- **Tradeoffs / Risks:** Üç aile/sınıf outer fold için asgari düzeydedir; eğitim fold'unda iki pozitif/sınıf eşik varyansını yükseltir. Sonuç güven aralığı ve worst-fold güvenlik sayısı taşımalıdır.

## H2 — Sınıf kapsamasını üçe tamamlamak tek başına genellemeyi çözer

- **Category:** Data coverage
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `tools/story-semantic-intent-corpus.json`, yerel spike makbuzu
- **Evidence:** Her sınıf ve split en az üç aileye tamamlandığı halde iki seçili kol kalite ve güvenlik kapısını geçmedi.
- **If true, we would also see:** Taze dengeli cohort'ta seçili model farkının `≥+0,15`, yüksek-risk yanlış pozitifin `0` olması.
- **Discriminating test:** Tamamlanmış tek-sefer ölçümü.
- **Status:** Refuted.
- **Why it matters:** Aynı veri toplama döngüsünü sınırsız sürdürmek seçim kusurunu çözmez.
- **Recommended fix:** Yeni gold yalnız yeni hipotezin ayrı calibration/evaluation epoch'u için üretilmeli; eski algoritmayı tekrar ölçmek için değil.
- **Tradeoffs / Risks:** Yeni epoch ek inceleme maliyeti taşır.

## H3 — Çoklu çapa veya frame uyumu tek başına yeterlidir

- **Category:** Representation
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `tools/story-semantic-intent-benchmark.js:59-66`, yerel spike makbuzu
- **Evidence:** BGE kalibrasyonu `frame-top3-mean/N=10` kolunu seçti; blind farkı yalnız `+0,046324`, yüksek-risk yanlış pozitifi `3` oldu. E5'in seçili `single-max` kolu da başarısızdır.
- **If true, we would also see:** Frame/top-3 kolunun blind kalite ve güvenlik kapılarını birlikte geçmesi.
- **Discriminating test:** Tamamlanmış tek-sefer ölçümü.
- **Status:** Refuted.
- **Why it matters:** Ağırlık veya top-K sayısını görülen blind sete bakarak değiştirmek yeni kanıt değil, holdout ezberidir.
- **Recommended fix:** Yeni temsil önce nested calibration'da tanımlanmalı; yeni blind epoch açılana kadar yalnız calibration sonucu raporlanmalı.
- **Tradeoffs / Risks:** Yeni temsil hipotezi blind kabulünden önce ürün iddiası taşıyamaz.

## H4 — `perClassLimit` en temsilî veya en yakın N çapayı seçiyor

- **Category:** Boundary / anchor sampling
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `tools/story-semantic-intent-benchmark.js:339-344`
- **Evidence:** Çapalar kimliğe göre sıralanıyor ve sınıf listesi `perClassLimit` dolunca sonraki çapalar skorlanmadan atılıyor. Benzerlik sıralaması ancak bu ilk-N alt küme içinde yapılıyor.
- **If true, we would also see:** Sonradan eklenen daha yakın bir çapanın limit doluyken hiçbir skora etkisi olmaması.
- **Discriminating test:** Sentetik sorguyla aynı sınıfta ilk kimlikli uzak ve son kimlikli birebir vektör oluştur; limit `1` iken birebir çapanın dışlandığını doğrula.
- **Status:** Supported/Confirmed by direct code path; sentetik regresyon testi eksik.
- **Why it matters:** `1/3/5/10/20` eğrisi çapa miktarından başka corpus kimlik kronolojisini de değiştiriyor.
- **Recommended fix:** Çapa alt kümesini prototip-only, sınıf-dengeli ve sorgudan bağımsız deterministik medoid/çeşitlilik politikasıyla önceden seç; alternatif olarak bütün sınıf çapalarını skorlayıp top-K semantiğini açıkça yeniden adlandır.
- **Tradeoffs / Risks:** Sorguya göre top-K seçmek CPU maliyetini büyütür; medoid seçimi ayrıca calibration-dışı prototip algoritması ve test ister.

# 5) Mechanism

1. Her aday temsil/N kolu kalibrasyon cümlelerini prototip çapalarına göre sıralar (`rawEmbeddingRows`).
2. Aynı 51 satırdan margin ve sınıf eşikleri türetilir (`fitEmbeddingCalibration`, satır 433-482).
3. Aynı satırlar aynı eşiklerle puanlanır; sınıf başına yalnız üç pozitif bulunduğundan yüksek-risk sınıfında görülen yanlış kabul eşikle kesilebilir.
4. 15 kol/profil arasından bu yeniden-kullanılmış metrikte güvenlik `0`, macro-F1 en yüksek olan seçilir (`runEmbeddingModel`, satır 552-566).
5. Yeni blind ailelerde skor/margin dağılımı değişir; kalibrasyon eşikleri E5'te altı, BGE'de üç yüksek-risk yanlış kabul üretir.

- **Root cause:** Fit, değerlendirme ve model seçiminin aynı küçük calibration örneklerinde birleşmesi.
- **Contributing factors:** Üç aile/sınıf alt sınırı; sınıf başı bağımsız threshold sayısı; 15 temsil/N adayı; ilk-ID-N çapa kırpması; ana speech-act dışındaki çerçevenin yalnız `%8` ağırlıklı dolaylı sinyal olması.
- **Detection failure:** Preflight yalnız kayıt/sınıf sayısını denetledi. Selection metriğinin threshold-fit satırlarından ayrı olduğuna veya fold kararlılığına dair test/kapı yoktu.
- **Weakest link:** Yeni nested calibration'ın ne kadar iyileştireceği henüz ölçülmedi; kök kusuru kaldırır fakat mevcut modellerin `+0,15` kalite tavanını geçeceğini garanti etmez.

# 6) Remediation Options

## Mitigation — Deterministik runtime'ı koru

- **Category:** Containment
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `tools/story-semantic-intent-corpus.json` evaluation policy
- **Evidence:** Kabul edilen model yok; epoch tüketilmiş ve tekrar koşu preflight'ta duruyor.
- **Why it matters:** Güvenlik hatalı embedding sonuçları oyuna ulaşmıyor.
- **Recommended fix:** Mevcut kilidi ve deterministik fallback'i koru.
- **Tradeoffs / Risks:** Oyuncu dilini anlama sorunu düzelmez; yalnız yanlış ürünleşmeyi engeller.

## Fix — Stratified nested calibration ve kararlılık seçimi

- **Category:** Evaluation design
- **Severity:** High
- **Confidence:** Likely
- **Location:** `fitEmbeddingCalibration`, `evaluateEmbeddingVectors`, `runEmbeddingModel`
- **Evidence:** Doğrudan resubstitution yolu ve iki bağımsız ölçümde calibration→blind çöküşü.
- **Why it matters:** Temsil/N seçimi, eşikleri öğrenirken gördüğü satırlardaki iyimser skoru kullanmaz.
- **Recommended fix:** Family-ID sıralı üç outer fold; fold başına sınıftan bir kayıt validation, kalanlar fit. Önce worst-fold yüksek-risk, sonra toplam yüksek-risk, sonra ortalama macro-F1 ve varyansla seçim. Seçim dondurulunca eşikleri bütün calibration'da yeniden fit et.
- **Tradeoffs / Risks:** İki eğitim örneği/sınıf gürültülüdür. **Verification:** Her satırın tam bir outer validation fold'unda, hiçbir zaman kendi threshold fit'inde bulunmadığını kanıtla; blind okumadan seçim makbuzu üret.

## Prevention — Çapa semantiği ve evaluation-boundary regresyonları

- **Category:** Test/detection
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `tests/story-semantic-intent-router.test.js`
- **Evidence:** Mevcut testler destek sayısı ve spent kilidini doğruluyor; fit/validation ayrışmasını veya ilk-ID-N kırpmasını doğrulamıyor.
- **Why it matters:** Aynı hata yeni model veya epoch ile sessizce tekrarlanabilir.
- **Recommended fix:** Fold ayrışması, deterministik seçim, satır sırasına duyarsızlık ve çapa-limit anlamı için sentetik regresyonlar ekle.
- **Tradeoffs / Risks:** Testler algoritma sözleşmesini sertleştirir; temsil politikasının bilinçli değişiminde açık test göçü gerekir.

# 7) Verification Plan

- Her sınıfta üç sentetik aileyle her satırın tam bir outer validation fold'unda ve kendi fit kümesinde sıfır kez bulunduğunu doğrula.
- Aynı veri farklı giriş sıralarında aynı fold, seçim ve eşikleri üretmelidir.
- Makbuz `resubstitutionMetrics` ile `outerValidationMetrics`i ayrı adlandırmalı; seçim yalnız ikincisini kullanmalıdır.
- Yüksek-risk seçim sırası worst-fold yanlış pozitif, toplam yanlış pozitif, ortalama macro-F1 ve varyans olmalıdır.
- Çapa-limit sentetik probu limit dolduktan sonra birebir yakın çapanın mevcut kodda dışlandığını göstermelidir; yeni politika seçilmeden davranış değiştirilmemelidir.
- Yeni algoritma yalnız prototype/calibration üzerinde geliştirilir; `representation-stability-v1` blind sonuçları hiçbir sabit, ağırlık veya seçim kuralına giremez.
- Hipotez dondurulduktan sonra ayrı `representation-stability-v2` epoch'u oluşturulur ve blind bir kez çalıştırılır. Başarı: tabana macro-F1 farkı `≥+0,15`, OOD kapısı ve yüksek-risk yanlış pozitif `0`.
