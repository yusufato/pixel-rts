---
id: phase-38-turkish-semantic-intent-router
status: In Progress # Kullanıcı 27 Ağustos 2026 tarihinde onayladı
owner: osman
source: EXT-003 / Kullanıcının 27 Ağustos 2026 embedding önerisi
touches:
  - package.json
  - package-lock.json
  - electron/main.js
  - electron/preload.js
  - js/StoryConversationUnderstanding.js
  - js/StoryConversationSemanticFrame.js
  - js/StorySemanticIntentRouter.js
  - tools/story-semantic-intent-corpus.json
  - tools/story-semantic-intent-benchmark.js
  - tools/story-semantic-review-server.js
  - tools/story-semantic-review.html
  - tools/story-sim-harness.js
  - qa-runtime/external-ai-reviews/PROTOCOL.md
  - qa-runtime/external-ai-reviews/external-review-0001/consensus.json
  - qa-runtime/external-ai-reviews/external-review-0002/consensus.json
  - tests/story-semantic-intent-router.test.js
  - tests/story-semantic-review-server.test.js
  - tests/story-conversation-semantic-frame.test.js
  - tests/story-conversation-case.test.js
  - docs/story/research/DIS_ANALIZ_VERI_DEFTERI.md
  - docs/story/status/HIKAYE_MODU_UYGULAMA_DURUMU.md
  - LEDGER.md
depends_on:
  - phase-38-13-directional-relationship-result-receipts
conflicts_with:
  - 25-agustos-hikaye-modu-toplam-bugfix-plani
  - bugfix-council-motion-atomicity
  - bugfix-story-invalid-battle-target-guard
  - electron-story-lifecycle-acceptance
created: 2026-08-27
last_touched: 2026-09-02
---

# Faz 38 — Türkçe Semantik Niyet Yönlendiricisi

## 1) Sorun ve tez

Oyuncunun doğal Türkçesi mevcut kök/eşanlam kurallarına sığmadığında konuşma
`UNKNOWN`, yanlış söylem türü veya genel onarım cevabına düşebiliyor. Çözüm
LLM'e mekanik karar yetkisi vermek değildir. Hafif, çokdilli embedding katmanı
yalnız kapalı `SemanticFrameV2` ve speech-act adaylarını sıralar; mevcut
deterministik çerçeve oyundaki bütün kapalı seçim türlerini ve domain
sözleşmelerini doğrular. Varlık, miktar, olumsuzluk, yetki ve bütçe bunların
yalnız örnekleridir; hedef, kapsam, zaman, kaynak, kanıt, ilişki, makam, rol,
gizlilik, risk, yürütücü ve diğer kanonik alanlar katalog büyüdükçe aynı kapıya
girer. LLM yalnız kabul edilmiş sonucu isteğe bağlı seslendirir.

**Done:** Gerçek oyuncu dili üzerinde mevcut tabana göre ölçülmüş Türkçe anlama
artışı vardır; bilinmeyen ve yüksek riskli sözler güvenli biçimde durur;
embedding/LLM kapalıyken mekanik oyun eşdeğer kalır; hiçbir model eylem, hedef,
miktar, yetki, sonuç veya ilişki deltası yazamaz.

**Durum:** Kullanıcı 27 Ağustos 2026 tarihinde kapsamı genişleten iki düzeltmeyle
onayladı. Kullanıcı 27 Ağustos 2026 tarihinde tek geliştiricilik iş akışı için 100 tek tek
onaylanmış gold örneğini model/runtime prototip kapısı; 1.000 tek tek
onaylanmış gold örneğini ürün entegrasyonu ve `Landed` kapısı yapmayı, ayrıca
toplu inceleme aracı kapsamını onayladı. Kullanıcı daha sonra Codex'in her
cümleyi bağlamıyla ayrı inceleyip eksiksiz etiketlediği kayıtların da açık
`CODEX_INDIVIDUAL_REVIEW` provenansıyla gold sayılmasını istedi.
`depends_on` planı Landed'dır; uygulama başlamıştır.

## 2) Önerilen kapalı zincir

1. Oyuncu metni NFKC ve Türkçe kasa kurallarıyla normalize edilir; ham metin
   kanıt için korunur.
2. Ayrı yerel süreç çokdilli embedding üretir. Model yoksa mevcut deterministik
   `SemanticFrameV2` yolu değişmeden çalışır.
3. Vektör yalnız sürümlü kapalı örnek kataloğundaki anlam adaylarıyla
   karşılaştırılır. Çıktı sabit üçle sınırlandırılmaz; corpus kalibrasyonu,
   belirsizlik marjı ve CPU/bellek bütçesiyle seçilen kapalı `top-K` aday,
   benzerlik ve katalog sürümüdür. `K` ölçülmeden ürün sabiti yapılmaz.
4. Mutlak skor veya top-1/top-2 marjı düşükse `UNKNOWN/CLARIFY`; model zorla
   eylem seçmez.
5. Mevcut semantik çerçeve ve domain adaptörleri iletişim işlevi, konu, hedef,
   olumsuzluk, zaman, epistemik durum, devamlılık, istenen sonuç ve oyundaki
   diğer bütün kapalı seçim alanlarını doğrular. Yeni bir domain alanı katalog ve
   validator kaydı olmadan embedding yolundan çalıştırılamaz.
6. Varlık/slot ve diğer seçim çözümü yalnız kanonik kamusal dizin, oyuncunun
   erişilebilir bağlamı ve ilgili domain sözleşmesinden yapılır. Model para,
   kişi, şirket, ülke, görev, kapsam, makam, kaynak veya sonuç uyduramaz.
7. Rüşvet, tehdit, savaş, ödeme, görev, sır paylaşımı ve kurumsal emir gibi
   etkili adaylar açık domain preflight ve oyuncu teyidi olmadan çalışmaz.
8. Deterministik motor sonucu ve makbuzu üretir. İlişki değişimi yalnız mevcut
   kaynaklı ilişki politikalarından gelir.
9. LLM açıksa yalnız doğrulanmış `[SONUÇ, KAMUSAL SEBEP, SES PROFİLİ]` zarfını
   1–2 doğal cümleye çevirir. Çıktı doğrulanamazsa şablon kullanılır.

### Hata ailesi sözleşmesi

- Bir yanlış cümleye özel kelime, regex veya prototip eklemek çözüm sayılmaz.
  Her bulgu `NORMALIZATION`, `SEMANTIC_RETRIEVAL`, `PRAGMATICS`, `COMPOSITION`,
  `SLOT_RESOLUTION`, `CONTEXT`, `POLICY` veya `CALIBRATION` kök katmanına ve
  sürümlü bir hata ailesine bağlanır.
- Düzeltme; görülen örnek yanında aynı niyetin farklı kelimeli olumlu örneği,
  konu bakımından yakın fakat eylemce zıt hard-negative, uygulanıyorsa
  olumsuz/varsayımsal biçim ve aile-split dışında tutulan en az bir karşı örnekle
  doğrulanmadan kabul edilmez. Aileye uymayan varyant zorla üretilmez.
- Benchmark OOD, iletişim işlevi, yüzey, konu, hedef, kutup, zaman, epistemik
  durum, devamlılık, istenen sonuç ve ikincil eylem kayıplarını ayrı sayar.
- Kaynak cümlenin tam metnine dallanan üretim kodu yasaktır. Katalog örnekleri
  yalnız aday temsilidir; yürütme kararı bütün deterministik kapılardan geçer.

## 3) Model seçimi

- İngilizce `all-MiniLM-L6-v2` ve `bge-small-en-v1.5`, Türkçe benchmarkı
  geçmeden reddedilir.
- İlk ölçüm adayı 384 boyutlu çokdilli bir model olabilir; başlangıç adayı
  `multilingual-e5-small`dır. Kimlik, dosya karması, lisans, tokenizer,
  quantization ve runtime sürümü makbuzlanır.
- Model adı başarı ölçütü değildir. En az iki çokdilli aday ve mevcut
  deterministik taban aynı kör corpus üzerinde karşılaştırılır.
- İlk uygulamada MLP yoktur. MLP ancak etiketli corpus, holdout kazancı,
  kalibrasyon ve geri alma planıyla kosinüs tabanını açıkça geçerse ayrı plandır.
- Çalışma zamanı renderer içinde kurulmaz. Ayrı süreç, kapalı IPC şeması, istek
  tavanı, timeout, bellek tavanı ve boşta unload taşır.
- Modelin resmî giriş sözleşmesi sürümlü encoding profile içinde tutulur.
  `multilingual-e5-small` için resmî `query:`/`query:` tabanı ile oyuncu=`query:`,
  çapa=`passage:` deney kolu aynı kör sette karşılaştırılır. E5 kuralı BGE'ye
  kopyalanmaz; BGE v1.5 instruction kullanımı ayrıca ölçülür.
- Kosinüs normu paydada zaten uygular. Dot-product yolu ancak açık L2
  normalizasyonundan sonra kosinüsle eşdeğer kabul edilir; eşitlik test edilir.
- Tek küresel `0,75` eşik yoktur. Eşik ve marj model, sınıf, dil/biçim ve risk
  katmanında calibration split'inden öğrenilir; blind test eşik seçmez.
- Tek kelime/kısa parça otomatik reddedilmez; uzunluğa göre ayrı ölçülür ve
  belirsizse bağlam/netleştirme kullanılır. Çapa sayısı `1/3/5/10/20` kapsama
  eğrisiyle ölçülür; `5–10` evrensel sabit değildir.
- Çapalar ham kelime listesi değil tam eylem kalıplarıdır. Olumlu, olumsuz,
  varsayımsal, iptal, soru/emir ve konu-yakın eylem-zıtı çiftler taşır.

## 4) Niyet ve karakter sözleşmesi

- Yeni serbest `RÜŞVET_TEKLİFİ` etiketi doğrudan dünya komutu değildir. Önce
  mevcut kapalı semantic-frame eksenine, sonra gerçek domain adayına eşlenir.
- Aynı cümle birden fazla niyet taşıyabilir. İlk dilim tekini gizlice seçmez;
  ayrıştırılmış adayları gösterir veya oyuncudan niyetini netleştirmesini ister.
- “Rüşvet vermeyeceğim” ile “rüşvet veriyorum”, “saldırsak mı?” ile “saldır”
  aynı eylem olamaz; olumsuzluk ve varsayım ayrı sert kapıdır.
- Dört arketip yalnız hesaplama/önbellek grubu olabilir. Kanonik karakter;
  mevcut kimlik, rol/makam, hedef, kişilik, yönlü ilişki, ActorBelief, hafıza,
  kariyer ve aktivasyon kayıtlarından okunur. İkinci karakter matrisi açılmaz.
- Son üç etkileşim bayrağı kalıcı bellek değildir; yalnız sahiplik ve konu
  filtresinden geçen türetilmiş kısa bağlam görünümüdür.
- Yeni `açgözlülük/sadakat` eksenleri bilgi kazancı kanıtlanmadan eklenmez.
  Karar mevcut kaynaklı eksenlerden ve domain politikalarından türetilir.

## 5) Aşamalar ve commit sınırları

| # | Adım | Çıktı | Commit |
|---|---|---|---|
| 1 | Gerçek Türkçe tabanı ölç | 100 tekil incelemeli prototip gold, kör ayrım, mevcut hata matrisi; 1.000 ürün kapısı korunur | `test(story): establish Turkish intent baseline` |
| 2 | Model/runtime spike | İki aday, EXE CPU/RAM/latans/paket ölçümü; ürün bağı yok | `test(story): benchmark local multilingual embeddings` |
| 3 | Kapalı katalog ve yönlendirici | Sürümlü prototipler, ölçülmüş top-K, skor/marj, OOD ret | `feat(story): add bounded semantic intent candidates` |
| 4 | SemanticFrameV2 birleşimi | Aday doğrulama, çoklu niyet ve netleştirme | `feat(story): validate embedding candidates through semantic frames` |
| 5 | Yüksek risk teyidi | Domain preflight, slot/yetki/bütçe ve açık oyuncu onayı | `feat(story): gate consequential language behind confirmation` |
| 6 | Sonuç seslendirmesi | LLM yalnız kapalı sonuç zarfı; şablon fallback | `feat(story): voice validated conversation outcomes` |
| 7 | Shadow/Electron kabulü | Feature flag, gerçek EXE ölçümü, save/load ve gizlilik | `test(story): accept Turkish semantic routing in Electron` |
| 8 | Belgeler | Ana plan, durum, araştırma ve karar defteri | `docs(story): record Turkish semantic routing contract` |

## 6) Corpus ve kabul kapıları

- Model/runtime prototipi en az 100 tek tek incelenmiş, birbirinin yeniden
  yazımı olmayan Türkçe turdan önce başlamaz. Ürün entegrasyonu ve planın
  `Landed` olması için gold set en az 1.000 tekil incelemeli tur taşır. Her iki
  kapıda da prototip, kalibrasyon ve kör test konuşmacı/şablon ailesine göre
  ayrılır.
- Gold provenansı yalnız `LOCAL_HUMAN` veya kullanıcının yetkilendirdiği,
  cümle+bağlam+bütün etiket eksenleri tek tek okunmuş
  `CODEX_INDIVIDUAL_REVIEW` olabilir. İki kaynak ayrı sayaçlanır.
- Model, gece QA'sı, toplu heuristic ve mevcut deterministik motor yalnız
  etiket adayı üretir; tekil inceleme kaydı bulunmayan satır hiçbir kapıda gold
  sayılmaz.
- Gündelik sohbet, bilgi, görüş, görev, ticaret, rüşvet, tehdit, ittifak, sır,
  rapor, toplantı ve açık `UNKNOWN/OOD` sınıfları bulunur.
- Ekli biçim, yazım hatası, eksik noktalama, argo, olumsuzluk, varsayım,
  ironi, zamir, ellipsis, takip, konu geçişi, iki niyet, sayı ve özel ad
  adversarial aileleri zorunludur.
- Başarı yalnız accuracy değildir: macro-F1, sınıf recall, OOD yanlış kabul,
  top-1/top-2 marjı, expected calibration error ve domain hata matrisi ölçülür.
- Her düzeltme için hata ailesi ve aile dışı holdout sonucu önce/sonra raporlanır.
  Tek görülen cümleyi geçirip aile holdout'unu iyileştirmeyen değişiklik reddedilir.
- `K`; recall artışı, yanlış kabul, gecikme ve bellek eğrisi birlikte ölçülerek
  seçilir. Üç aday yetersizse büyütülür; büyüyen listenin oyuncuya veya mekanik
  yürütücüye filtresiz aktarılması yasaktır.
- Rüşvet, tehdit, ödeme, savaş, görev, sır ve kurumsal emir sınıflarında mekanik
  yanlış pozitif `0`; teyitsiz dünya mutasyonu `0`; uydurma varlık/slot `0`dır.
- Çokdilli yönlendirici kör testte mevcut deterministik tabanın macro-F1'ını en
  az 15 puan artırmalı ve hiçbir yüksek risk kapısını geriletmemelidir.
- EXE CPU p95 hedefi ölçümden sonra sabitlenir; önceden “birkaç ms” ilan edilmez.
  Soğuk yükleme, sıcak p50/p95, RSS, paket boyutu ve eşzamanlı LLM etkisi ölçülür.
- Aynı model karması+katalog sürümü+metin aynı aday sırasını üretir. Save/load
  vektörü değil kaynak metin, katalog sürümü ve karar fişini korur; restore
  modeli yeniden eylem uygulamak için çağırmaz.
- Model yok, bozuk, timeout veya düşük güvenliyse oyun çökmez; mevcut
  deterministik analiz ve netleştirme yolu çalışır.

## 7) Planın çürütülmesi

### En yakın vektörü doğrudan eylem yapmak

Her metnin matematiksel olarak bir “en yakını” vardır; bu onun doğru veya oyun
içi uygulanabilir olduğu anlamına gelmez. Mutlak eşik, marj, OOD ve doğrulayıcı
olmadan yöntem bilinmeyen cümleyi güvenle yanlış komuta çevirir. Reddedildi.

### Tek yüzdeyi olasılık diye göstermek

Kosinüs skoru kalibre edilmiş olasılık değildir. `%89 rüşvet` ancak holdout
kalibrasyonu doğrularsa gösterilebilir; aksi hâlde iç benzerlik puanıdır.

### Sabit dört özellikli karar formülü

Örnek formül mevcut karakter gerçekliğini kopyalar, yeni kişilik eksenlerini
kanıtsız ekler ve yetki/bütçe/bilgi bağlamını atlar. Karar mevcut domain
politikalarından kaynaklı iz olarak türetilir.

### 2.000 karakter için 2.000 prompt

Reddedilen sorun doğru, fakat çözüm karakterleri dört stereotipe indirmek
değildir. Ortak prompt şablonu ve kapalı sonuç zarfı kullanılır; karaktere özgü
değerler mevcut kanonik kayıtlardan sınırlı doldurulur.

### Embedding ile slot çıkarmak

Embedding genel niyet adayı için uygundur; `5000`, hedef kişi, ülke, şirket,
para birimi ve olumsuzluk gibi icra slotlarını garanti etmez. Slotlar
deterministik parser+dizin+teyit yolunda kalır.

### Beş örnek doğrulama alanını bütün oyun sanmak

Varlık, miktar, olumsuzluk, yetki ve bütçe kapının anlatım örnekleridir; oyun
onlarca domain seçimi taşır. Sabit beş alanlı validator yeni domainleri sessizce
atlanmış veya güvensiz bırakır. Katalog her yürütülebilir adayın istediği kapalı
alan şemasını ve validator sürümünü taşır; bilinmeyen alan executable olamaz.

### Tek cümleye kural veya çapa ekleyerek testi geçirmek

Görülen cümleyi ezberleten regex/prototip yalnız o satırı yeşile çevirebilir.
Her değişim kök katman + hata ailesi + karşıt örnek paketiyle kabul edilir;
literal cümle dalları ve yalnız görülen satırdaki kazanç reddedilir.

### “Saldır” ve “savun”u konu yakınlığıyla ayırmak

Embedding askerî bağlamı doğru bulsa bile eylem yönünü garanti etmez. Eylem-zıtı
çiftler hard-negative olarak ölçülür; olumsuzluk, kip ve uygulanabilir eylem
deterministik kompozisyon kapısından geçmeden askerî aday çalıştırılmaz.

### Her model için aynı prefix, eşik ve çapa sayısı

E5, BGE ve diğer modellerin eğitim sözleşmeleri aynı değildir; kosinüs skoru da
kalibre edilmiş olasılık değildir. Prefix, normalizasyon, çapa eğrisi ve eşikler
model kartı + calibration ölçümüyle sürümlenir; evrensel varsayımlar reddedilir.

## 8) Durma koşulları

- Türkçe kör testte tabana göre anlamlı kazanç yoksa ürün entegrasyonu yapılmaz.
- Yüksek riskli tek yanlış kabul, gizli veri girdisi veya teyitsiz mutasyon varsa
  ilgili adım durur.
- Model renderer'ı bloke ediyor, EXE belleğini kabul tavanının üstüne çıkarıyor
  veya paket/lisans kaydı doğrulanamıyorsa runtime seçimi reddedilir.
- Mevcut deterministik fallback, save/load ya da mekanik karma değişirse plan
  `Landed` yapılmaz.

## 9) Yürütme kaydı

### 27 Ağustos 2026 — Adım 1, insan etiketleme kuyruğu hazır

- 46 benzersiz gözlenmiş oyuncu turu ve 154 model üretimi aday, toplam 200
  benzersiz cümle olarak sürümlü corpus'a alındı. Model üretimi satırlar yalnız
  adaydır; insan kararı olmadan gold değildir.
- 160 konuşmacı/şablon ailesi aynı anda birden fazla split'e düşmeyecek biçimde
  127 prototip, 27 kalibrasyon ve 46 kör test satırına ayrıldı.
- İnceleme ekranı mevcut deterministik önerinin bütün `SemanticFrameV2`
  eksenlerini ve speech-act değerini insana düzelttirir. Eksik etiketli kabul
  gold sayılmaz.
- Güncel kapı: `0/200` prototip gold, `0/1000` ürün gold. Adım 1 ve model
  spike'ı, 200 tekil incelemeli kayıt tamamlanana kadar açık kalır.

### 27 Ağustos 2026 — Codex tekil inceleme yetkisi

- Kullanıcı, Codex'in cümleleri toplu model çıktısıyla değil metin ve bağlamı
  tek tek okuyarak bütün kapalı etiketleri kararlaştırmasını ve bu kayıtların
  gold sayılmasını istedi.
- Kayıtlar `CODEX_INDIVIDUAL_REVIEW` olarak saklanır; `LOCAL_HUMAN`
  kayıtlarıyla birleştirilmez veya insan etiketi diye raporlanmaz.
- İnceleme geri alınabilir partiler halinde commit edilir. Otomatik öneriyi
  değiştirmeden kopyalamak tek başına inceleme kanıtı değildir.

### 27 Ağustos 2026 — Codex tekil inceleme partisi 1

- İlk 20 gözlenmiş oyuncu turu cümle ve son üç turluk bağlamıyla ayrı ayrı
  incelendi; bütün speech-act ve `SemanticFrameV2` eksenleri gerekçeli
  `CODEX_INDIVIDUAL_REVIEW` kayıtlarına dönüştürüldü.
- Mevcut deterministik motor ana speech-act değerini 20 kaydın 11'inde yanlış
  seçti. İlk kısmi baseline macro-F1 `0,324675`, ECE `0,2985` ölçüldü.
- Güncel kapı `20/200` prototip gold ve `20/1000` ürün gold; bu kısmi ölçüm
  model seçmek veya entegrasyona geçmek için yeterli değildir.

### 27 Ağustos 2026 — Codex tekil inceleme partisi 2

- Sonraki 20 gözlenmiş oyuncu turu bağlamıyla ayrı ayrı incelendi. Birleşik
  askerî rapor+destek isteği, destek teklifi, ekonomik miktar bildirimi, onarım,
  hakaret ve alaycı meydan okuma ayrımları açıkça etiketlendi.
- Toplam `40/200` prototip gold oldu. Deterministik kısmi baseline macro-F1
  `0,383049`, ECE `0,2455`; prototip kapısı kapalıdır.

### 27 Ağustos 2026 — Hata ailesi ve embedding deney sözleşmesi

- Kullanıcının “cümleyi değil hata mantığını düzelt” şartı bağlayıcı kabul
  sözleşmesine dönüştürüldü. Benchmark bütün `SemanticFrameV2` eksenlerindeki
  tekrar eden hata ailelerini ayrı sayar; literal cümle yaması kabul edilmez.
- Eylem-zıtı hard-negative, kısa parça dilimi, çapa kapsama eğrisi, model-özel
  prefix, normalize dot/kosinüs eşitliği ve sınıf/risk bazlı threshold kalibrasyonu
  model/runtime spike'ın zorunlu deneyleridir.
- İlk 40 gold korunur; bunlar model kabulü değildir. Yeni ölçüler bir sonraki
  tekil inceleme partilerinden önce taban raporuna eklenmiştir.
- Gerçek baseline'da tam çerçeve eşleşmesi `2/40` (`%5`) çıktı. En sık aileler:
  epistemik durum `28`, hedef `27`, konu/predicate `22`, devamlılık `22`, ana
  speech-act `21`, istenen sonuç `15` ve yanlış OOD kapısı `11`. Bu sayılar
  öncelik kanıtıdır; tek başına kök neden veya model kabulü değildir.

### 27 Ağustos 2026 — Codex tekil inceleme partisi 3

- Altı gözlenmiş oyuncu turu ve on dört model üretimi aday bağlamı, anlatım
  bozukluğu ve bütün kapalı eksenleriyle ayrı ayrı incelendi. Yazım/dilbilgisi
  bozuk fakat anlaşılır sorular OOD yapılmadı; ekonomik rapor, kurumsal suçlama,
  konu değişimi, onarım, görev isteği ve genel dünya bildirimi ayrıştırıldı.
- Toplam `60/200` prototip gold oldu. Kısmi baseline macro-F1 `0,354760`, ECE
  `0,2415`, tam çerçeve eşleşmesi `2/60` oldu. Hata ailelerinde hedef `44`,
  epistemik durum `41`, speech-act `37`, predicate `31`, yanlış OOD `26` ölçüldü.
- Bu genişleyen kısmi corpus model seçimi değildir. Prototip kapısına `140`, ürün
  kapısına `940` tekil inceleme kalmıştır.

### 27 Ağustos 2026 — Embedding deney kapısı 100 gold oldu

- Kullanıcı model/runtime embedding deneyini `100/100` tekil gold kayıtta açma
  kararı verdi. Corpus 200 satır olarak korunur; yalnız prototip deney eşiği
  `200 → 100` değişmiştir.
- Ürün entegrasyonu, mekanik hatta bağlama ve planı `Landed` yapma eşiği
  `1.000/1.000` olarak değişmeden kalır. İlk 100 kayıt deney ve aday eleme için
  yeterlidir; ürün kalitesi veya çokdilli genelleme kanıtı değildir.
- Güncel sayaç `60/100` deney ve `60/1000` ürün gold; embedding spike'ına `40`
  tekil inceleme kalmıştır.

### 27 Ağustos 2026 — Codex tekil inceleme partisi 4

- Yirmi model üretimi aday ayrı ayrı incelendi. Tamamlanmış ithalat anlaşması ile
  yeni ticari teklif; konuşanın yardım teklifi ile dinleyiciye verilen emir;
  dolaylı bilgi sorusu ile konu açılışı; geçmiş kurum raporu ile yeni eylem
  talebi birbirinden ayrıldı.
- Toplam `80/100` deney ve `80/1000` ürün gold oldu. Kısmi baseline macro-F1
  `0,376352`, ECE `0,216875`, tam çerçeve eşleşmesi `3/80` oldu. Hata ailelerinde
  hedef `58`, epistemik durum `53`, speech-act `51`, predicate `38`, yanlış OOD
  `32` ölçüldü.
- Embedding spike kapısına `20`, ürün kapısına `920` tekil inceleme kalmıştır.
  Bu kısmi ölçümle model/runtime deneyi henüz başlatılmaz.

### 27 Ağustos 2026 — Codex tekil inceleme partisi 5 ve deney kapısı

- Son yirmi model üretimi aday tek tek incelendi. Yanlış öncül içeren neden
  soruları, duygu bildirimleri, ekonomik durum raporları, düzeltme niyeti,
  reddetme ve reddetme içeren eylem talebi birbirinden ayrıldı.
- Toplam `100/100` deney ve `100/1000` ürün gold oldu. Prototip kapısı
  açıldı; ürün entegrasyonu kapısı kapalı kalır.
- Deterministik baseline macro-F1 `0,394830`, ECE `0,2261`, tam çerçeve
  eşleşmesi `3/100` oldu. Hata ailelerinde hedef `71`, epistemik durum `69`,
  speech-act `59`, predicate `45`, yanlış OOD `37` ölçüldü.
- Sıradaki yetkili adım model/runtime embedding spike'ıdır. Bu sonuç herhangi
  bir modeli kabul etmez ve mekanik oyun hattına bağlama yetkisi vermez.

### 27 Ağustos 2026 — Adım 2 model seçimi preflight'ında corpus açığı

- Benchmark artık deney kapısı ile model seçimi kapısını ayrı raporlar.
  `100/100` deney kapısı açıktır; fakat model seçimi preflight'ı 13 kapsam
  açığı nedeniyle kapalıdır.
- Gold dağılımı prototip `67`, kalibrasyon `10`, kör test `23`tür.
  Kör `REPORT_MILITARY` sınıfının prototip çapası yoktur; beş kör sınıfın
  kalibrasyon örneği yoktur.
- Prototip, kalibrasyon ve kör test splitlerinin hiçbirinde `outOfDomain=true`
  gold bulunmaz. Bu nedenle OOD yanlış kabul oranı ve eşik kalibrasyonu
  ölçülemez.
- `THREATEN`, `SHARE_SECRET` ve `BLUFF_CANDIDATE` gold kapsamı yoktur;
  ticari teklif yalnız kalibrasyonda bir örnektir. Yüksek-risk yanlış pozitif
  sıfır şartı bu corpus ile kanıtlanamaz.
- İki geçici GGUF adayının indirmesi model sonucu üretmeden durduruldu.
  Eksik kabul verisiyle model sıralamak sahte güven oluşturacağından Adım 2
  model seçimi başlamadı.

### 27 Ağustos 2026 — Hedefli corpus genişlemesi onaylandı

- Kullanıcı, model seçimi preflight'ında ölçülen kapsam açıklarını kapatmak için
  corpusun 200 satır sınırını aşmasını onayladı. Önceki “200 satır korunur”
  kararı bu genişleme için tersine döndü.
- Gold sayılmayan 78 hedefli aday eklendi; corpus `278` benzersiz cümle ve
  `238` aileye çıktı. Split toplamları prototip `149`, kalibrasyon `61`,
  kör test `68`dir.
- Paket OOD, tehdit, sır paylaşımı, bluff, ticari teklif, askerî rapor, eksik
  kalibrasyon sınıfları ve olumsuz/varsayımsal hard-negative cümleleri kapsar.
- Yeni kayıtların hiçbiri otomatik gold değildir. Model seçimi preflight'ı,
  hedefli kayıtlar tek tek incelenene kadar kapalı kalır.

### 27 Ağustos 2026 — Hedefli tekil inceleme partisi 1

- İlk 20 hedefli aday cümle ve bağlamıyla ayrı ayrı incelendi: dokuz oyun dışı
  bilgi/eylem isteği, dokuz koşullu tehdit ve iki sır paylaşımı eksiksiz
  SemanticFrameV2 etiketleriyle `CODEX_INDIVIDUAL_REVIEW` gold oldu.
- Toplam gold `120/100` deney ve `120/1000` ürün seviyesine çıktı. Split
  dağılımı prototip `75`, kalibrasyon `16`, kör test `29`dur.
- OOD gold kapsamı her splitte `3`; tehdit kapsamı her splitte `3` oldu.
  Böylece üç OOD açığı ve tehdit yüksek-risk açığı kapandı; preflight açıkları
  `13 → 9` düştü.
- Model seçimi hâlâ kapalıdır. Kör askerî raporun prototip çapası; beş sınıfın
  kalibrasyonu ve ticari teklif, sır paylaşımı, blöf yüksek-risk split kapsamı
  tamamlanmadan embedding modeli kabul edilemez.

### 27 Ağustos 2026 — Hedefli tekil inceleme partisi 2

- Yedi sır paylaşımı, dokuz blöf adayı ve dört ticari teklif cümle ve
  bağlamıyla ayrı ayrı incelendi. Kanıtsız iddia normal rapordan, sır açıklama
  olasılığı gerçekleşmiş ifşadan ve ticari teklif salt eylem isteğinden ayrıldı.
- Toplam gold `140/100` deney ve `140/1000` ürün seviyesine çıktı. Split
  dağılımı prototip `82`, kalibrasyon `23`, kör test `35`tir.
- `SHARE_SECRET` ve `BLUFF_CANDIDATE` yüksek-risk kapsamı her splitte `3`
  oldu. Ticari teklif prototip `3`, kalibrasyon `2`, kör test `0`dır.
  Preflight açıkları `9 → 7` düştü.
- Model seçimi kapalı kalır. Sıradaki hedefli parti ticari teklifin kör testini,
  askerî rapor çapası/kalibrasyonunu ve eksik kalibrasyon sınıflarını
  tamamlamalıdır.

### 27 Ağustos 2026 — Hedefli tekil inceleme partisi 3

- Beş ticari teklif, dokuz askerî rapor, üç meydan okuma ve üç selamlaşma
  cümle ve bağlamıyla ayrı ayrı incelendi. Geçmiş askerî durum bildirimi
  emirden; kanıt talep eden meydan okuma sıradan bilgi sorusundan ayrıldı.
- Toplam gold `160/100` deney ve `160/1000` ürün seviyesine çıktı. Split
  dağılımı prototip `85`, kalibrasyon `34`, kör test `41`dir.
- Ticari teklif yüksek-risk kapsamı `3/4/3` oldu. Kör askerî rapor prototip
  çapası ve kalibrasyonu; meydan okuma ve selamlaşma kalibrasyonları kapandı.
  Preflight açıkları `7 → 2` düştü.
- Model seçimi yalnız `REPORT_ECONOMIC` ve `REQUEST_ACTION` kalibrasyon
  örnekleri eksik olduğu için kapalıdır. Sıradaki hedefli partinin ilk altı
  kaydı bu iki açığı kapatmaya ayrılmıştır.

### 27 Ağustos 2026 — Hedefli tekil inceleme partisi 4 ve preflight kabulü

- Üç ekonomik rapor, üç eylem talebi ve on iki olumsuz/varsayımsal
  hard-negative ayrı ayrı incelendi. Saldırmama sözü tehditten; sır vermeme
  sırrı paylaşmaktan; teklif inkârı ticari tekliften ayrıldı.
- Doğru hard-negative etiketleri kör testte `MAKE_PROMISE` sınıfını görünür
  kıldı ve yeni bir kalibrasyon açığı oluşturdu. Mevcut 17 etiketsiz
  kalibrasyon kaydında saf söz bulunmadığı doğrulandı; bir açık askerî söz
  adayı eklenip ayrıca tekil incelendi.
- Corpus `279` cümle, `239` aile ve `179` gold oldu. Gold dağılımı prototip
  `89`, kalibrasyon `45`, kör test `45`tir. `experimentGatePass=true`,
  `modelSelectionPass=true` ve preflight açık listesi boştur.
- Bu kabul yalnız iki aday embedding modelini ölçme yetkisidir. Model seçimi,
  runtime/EXE paketi veya ürün entegrasyonu henüz yapılmadı; ürün kapısı
  `179/1000` seviyesinde kapalıdır.

### 27 Ağustos 2026 — Adım 2 model/runtime adayları reddedildi

- Aynı `89/45/45` prototip/kalibrasyon/kör gold ayrımında mevcut deterministik
  yol, `multilingual-e5-small` Q8 ve BGE-M3 Q8 ölçüldü. Eşikler ve sınıf başına
  çapa sayısı yalnız kalibrasyon splitinden seçildi; kör test seçim yapmadı.
- Deterministik kör macro-F1 `0,233333`, OOD yanlış kabul `1,0` ve yüksek-risk
  yanlış pozitif `3`tür. E5 `query/query` ve `query/passage` kolları sırasıyla
  `0,097571` ve `0,086325` macro-F1 verdi; ikisinde de yüksek-risk yanlış
  pozitif `1`dir. E5 reddedildi.
- BGE-M3 düz giriş ve kalibrasyonun seçtiği sınıf başına `20` çapayla kör
  macro-F1 `0,348664`, OOD yanlış kabul `0` ve yüksek-risk yanlış pozitif `4`
  verdi. Tabana farkı `+0,115331`, gerekli `+0,15`in altındadır; ayrıca
  yüksek-risk kapısını `3 → 4` geriletti. BGE-M3 reddedildi.
- Nihai CPU-only E5 ölçümü: `3.529,90 ms` soğuk yükleme,
  `53,53–54,59/90,23–91,19 ms` sıcak p50/p95, `778,40 MiB` gözlenen tepe RSS
  artışı ve `126,30 MiB` model. BGE-M3: `3.464,52 ms`,
  `584,11/1.013,90 ms`, `499,04 MiB` tepe RSS artışı ve `605,16 MiB`.
- Normalize dot/kosinüs farkı her profilde `≤4,45e-16`dır. Güven, ham kosinüs
  olasılık sayılmadan kalibrasyon splitindeki skor-dilimi doğruluğundan türetildi.
- Hiçbir aday kalite ve yüksek-risk kapısını geçmediği için ürün bağı, Electron
  IPC, paketleme ve eşzamanlı LLM/EXE kabulü açılmadı. Adım 3'e geçiş durmuştur;
  sonraki çalışma yeni aday/temsil hipotezini ayrı ölçmeli veya corpus
  genişletmelidir. Ürün kapısı `179/1000` seviyesinde kapalıdır.

### 31 Ağustos 2026 — Dokunulmamış değerlendirme ve tek-sefer kilidi

- `representation-stability-v1` kohortu tek tek incelenmiş `10/51/51`
  prototip/kalibrasyon/kör gold ile bütün 17 sınıfta ve OOD'de değerlendirme
  split başına en az üç bağımsız aileye ulaştı. Toplam corpus `391` cümle,
  `351` aile ve `291` gold oldu.
- Eşik, temsil ve sınıf başı çapa sayısı yalnız 51 kalibrasyon kaydıyla seçildi.
  Deterministik 51 kör taban macro-F1 `0,262698`, OOD yanlış kabul `1,0` ve
  yüksek-risk yanlış pozitif `0` verdi.
- E5 için seçilen `query/passage + single-max + N=20` kolu kör macro-F1
  `0,318783` (`+0,056085`), OOD yanlış kabul `0`, yüksek-risk yanlış pozitif
  `6` verdi. BGE-M3 için seçilen `frame-top3-mean + N=10` kolu `0,309023`
  (`+0,046324`), OOD yanlış kabul `0,333333` ve yüksek-risk yanlış pozitif `3`
  verdi. İki aday da `+0,15` kalite ve sıfır yüksek-risk kapılarını geçemedi.
- Aynı model karmaları doğrulandı: E5 `e011debc…0a877c93`, BGE-M3
  `aa473d51…4047a173`. CPU sıcak p50/p95 E5'te `92,64/127,79 ms`, BGE-M3'te
  `769,32/1.210,31 ms`; gözlenen RSS artışı yaklaşık `796,34/516,88 MiB` oldu.
- Kör sonuç görüldükten sonra politika `SPENT_AFTER_2026_08_31_ONE_SHOT`
  durumuna alındı. Preflight aynı epoch ile ikinci model koşusunu model
  yüklenmeden reddeder. Plan `In Progress` kalır; ürün/EXE/IPC entegrasyonu ve
  `%90+` anlama iddiası kapalıdır. Sonraki aday veya temsil hipotezi yeni,
  önceden mühürlü değerlendirme epoch'u gerektirir.

### 31 Ağustos 2026 — İç içe kalibrasyon yeni kör epoch'u durdurdu

- Temsil/profil/çapa sayısı seçimi, her satırı tam bir kez dış doğrulamada
  tutan aile-sızıntısız üç katlı kalibrasyona taşındı. Çalışma sınırı
  prototip/kalibrasyon/kör `99/51/0`; `blindTestAccessed=false` olarak
  makbuzlandı. Harcanmış kör kohort yeniden okunmadı.
- Deterministik kalibrasyon tabanı macro-F1 `0,303431`, OOD yanlış kabul
  `0,666667` ve yüksek-risk yanlış pozitif `3`tür.
- E5 dış seçimde `query/passage + class-top3-mean + N=3` verdi. Ortalama
  macro-F1 `0,185662`, tabana fark `-0,117770`; toplam ve en kötü kat
  yüksek-risk yanlış pozitif `0/0`dır. Güvenlik kapısını geçse de kalite
  kapısını geçmedi.
- BGE-M3 dış seçimde `plain + frame-top3-mean + N=10` verdi. Ortalama
  macro-F1 `0,467550`, tabana fark `+0,164118`; toplam/en kötü kat yüksek-risk
  yanlış pozitif `2/1`dir. Kalite kapısını geçse de güvenlik kapısını geçmedi.
- Otomatik karar `eligibleModelIds=[]` ve `createNewBlindEpoch=false` oldu.
  Yeni v2 gold/kör kohort üretilmeyecek; ürün, Electron, IPC ve LLM mekanik
  entegrasyonu kapalı kalır. Sıradaki hipotez, `perClassLimit` uygulamasının
  skorlamadan önce ilk kayıt kimliklerini kesmesi yerine yalnız prototiplerden
  deterministik ve açık bir çapa-alt-kümesi seçmesidir. Bu hipotez de yalnız
  kalibrasyonda kanıtlanmadan yeni kör epoch açılamaz.

### 31 Ağustos 2026 — Prototip kapsama seçimi kalite hipotezi reddedildi

- Sınıf başına alfabetik ilk N kaydı alan politika kaldırıldı. Yerine yalnız
  prototip vektörlerinden sınıf medoidini seçen, sonraki her çapada toplam sınıf
  kapsamasını en çok artıran `PROTOTYPE_GREEDY_COVERAGE_V1` eklendi. Seçim
  giriş sırasından ve oyuncu sorgusundan bağımsızdır; politika kimliği raporda
  makbuzlanır.
- Kör erişimsiz `99/51/0` dış-kat kalibrasyonunda E5 `query/query +
  frame-top3-mean + N=10` seçti. Ortalama macro-F1 `0,107791`, taban farkı
  `-0,195640`, toplam/en-kötü-kat yüksek-risk `0/0` ve ortalama OOD yanlış
  kabul `0`dır. Önceki dış-kat E5 kalitesi `0,185662` idi.
- BGE-M3 `plain + frame-top3-mean + N=3` seçti. Ortalama macro-F1 `0,345322`,
  taban farkı `+0,041890`, toplam/en-kötü-kat yüksek-risk `3/1` ve ortalama OOD
  yanlış kabul `1,0`dır. Önceki BGE dış-kat kalitesi `0,467550`, riski `2/1`di.
- Kapsama-açgözlü çapa alt-kümesinin kaliteyi yükselteceği hipotezi reddedildi.
  `eligibleModelIds=[]`, `createNewBlindEpoch=false`; yeni kör corpus ve ürün
  entegrasyonu açılmaz. Alfabetik ilk-N davranışına geri dönülmez; sonraki
  temsil hipotezi yeni kör veri istemeden aynı dış kalibrasyonda sınanmalıdır.

### 31 Ağustos 2026 — Sınıf centroidi kaliteyi geçti, güvenliği geçemedi

- `PROTOTYPE_CLASS_CENTROID_V1`, her eylem sınıfındaki bütün normalize prototip
  vektörlerini ortalayıp sonucu yeniden L2-normalize eder. Çapa alt-kümesi ve N
  ayarı yoktur; giriş sırasından, kalibrasyondan ve kör testten bağımsızdır.
- Kör erişimsiz `99/51/0` ölçümünde BGE-M3 centroid ortalama macro-F1
  `0,532026`, minimum kat `0,490196`, taban farkı `+0,228595` verdi. Kalite
  kapısını ilk kez geçti; ancak toplam/en-kötü-kat yüksek-risk yanlış pozitif
  `3/3` olduğu için güvenlik kapısını geçemedi. Ortalama OOD yanlış kabul
  `0,666667`dir.
- E5 `query/query` ve `query/passage` centroid kollarının ikisi de ortalama
  `0,347712`, taban farkı `+0,044281` ve toplam/en-kötü-kat risk `1/1` verdi;
  kalite ve güvenlik birlikte sağlanmadı.
- BGE hataları tek dış katta üç ayrı konu-yakın/yön-zıt ailede kümelendi:
  `BLUFF_CANDIDATE→SHARE_SECRET`, `GREETING→REQUEST_ACTION` ve
  `REPORT_ECONOMIC→PROPOSE_COMMERCIAL_DEAL`. Sonuç konu yakınlığının eylem
  yönünü tek başına korumadığını yeniden doğrular. `createNewBlindEpoch=false`;
  sonraki hipotez embedding skorundan sonra SemanticFrameV2 iletişim işlevi,
  predicate ve requested-outcome uyumsuzluğuyla yüksek-risk ön-kabulünü
  deterministik olarak engellemelidir.

### 31 Ağustos 2026 — SemanticFrameV2 vetosu riski sıfırladı, kaliteyi koruyamadı

- `PROTOTYPE_CLASS_CENTROID_FRAME_GUARD_V1`, yüksek-risk centroid adayını
  kanonik prototip çerçevelerinden biriyle beş yön ekseninin en az dördünde
  (`≥0,8`) uyuşmadan sıralamaya kabul etmez. Bir predicate/üslup farklılığına
  tolerans verir; eşik kör veriden öğrenilmez.
- Kör erişimsiz `99/51/0` dış kalibrasyonda BGE-M3 güvenli seçimi bu kol oldu:
  ortalama macro-F1 `0,383007`, minimum kat `0,317647`, taban farkı `+0,079575`,
  toplam/en-kötü-kat yüksek-risk `0/0`, ortalama OOD yanlış kabul `0,666667`.
  Saf centroidin `3/3` riski sıfıra indi fakat `+0,228595` kalite farkı
  `+0,079575`e düştü.
- E5 güvenli `query/query` seçimi `0,237908`, taban farkı `-0,065523`, risk
  `0/0` verdi. `query/passage` kolu `0,262092` ve `1/1` riskle ayrıca elendi.
- `eligibleModelIds=[]`, `createNewBlindEpoch=false`. Yön doğrulama kök nedeni
  hedefliyor fakat tek global `4/5` kuralı fazla bilgi kaybediyor. Sonraki
  hipotez yeni threshold taraması değil; her yüksek-risk eylem için zorunlu
  çekirdek eksenleri (ör. teklif=`OFFER+ACTION`, sır paylaşımı=
  `CONFIDE+CONFIDENTIAL_HANDLING`) prototip sözleşmesinden açıkça türetmektir.

### 31 Ağustos 2026 — Niyet sözleşmesi, recall kapısı ve Türkçe yön aileleri

- Sınıfa özel çerçeve sözleşmeleri global `4/5` vetosunun yerine denendi.
  İlk ölçüm BGE-M3 riskini sıfırlayıp tabana `+0,103105` fark verdi; ancak beş
  yüksek-risk sınıfının recall değeri de `0`dı. Sıfır aday kabul ederek güvenli
  görünme açığı nedeniyle karar kapısına sınıf başına tabanla yarışan ve en az
  `1/3` recall isteyen anti-vacuity şartı eklendi.
- Deterministik SemanticFrameV2'nin taze 15 yüksek-risk kalibrasyon kaydındaki
  sözleşme kapsaması başlangıçta yalnız `3/15`ti. Emir çekimleri, birinci kişi
  teklifleri, koşullu tehditler, kısıtlı-audiencelı sır paylaşımı, kontrollü
  soru biçimleri ve olumsuz açıklama vetosu cümle kimliğine dallanmadan ortak
  Türkçe aileler olarak düzeltildi. Taze kapsama beş sınıfta ayrı ayrı `3/3`,
  toplam `15/15` oldu; commit `c907137`.
- Yeni kör-erişimsiz `99/51/0` ölçümde deterministik taban macro-F1
  `0,474259` ve yüksek-risk yanlış pozitif `3`tür. E5 `0,238598`
  (`-0,235661`), toplam/en-kötü-kat risk `1/1`; tehdit ve blöf recall kapılarını
  kaçırdı. BGE-M3 intent-contract centroid `0,520915` (`+0,046656`), risk
  `2/1`; eylem talebi ve blöf recall kapılarını kaçırdı.
- `eligibleModelIds=[]`, `createNewBlindEpoch=false`. Parser yön sinyali artık
  taze güvenlik dilimini kapsıyor, fakat embedding kalite ve yanlış-pozitif
  kapıları birlikte geçmiyor. Ürün/Electron/IPC entegrasyonu kapalı kalır.

### 31 Ağustos 2026 — Teklif konusu eylem niyetinden ayrıldı

- Kalan iki BGE yanlış-pozitif ailesinde `teklif` konu adı doğrudan OFFER,
  `isterseniz` koşulu doğrudan REQUEST kanıtı oluyordu. Teklif adı artık ancak
  açık teklif fiiliyle eylem kanıtıdır; birinci kişi istek biçimleri ile
  dinleyici-koşullu destek teklifleri ayrı morfolojik ailelerdir. İki karşı
  örnek kendi yanlış yüksek-risk sözleşmelerini artık geçmez; commit `50ff12c`.
- Aynı kör-erişimsiz `99/51/0` dış kalibrasyonda BGE-M3 intent-contract
  centroid ortalama macro-F1 `0,628758`, minimum kat `0,529412`, taban farkı
  `+0,154499` ve toplam/en-kötü-kat yanlış yüksek-risk `0/0` verdi. Kalite ve
  yanlış-pozitif güvenlik kapıları ilk kez birlikte geçti.
- BGE recall değerleri tehdit `1`, eylem talebi `0,666667`, ticari teklif `1`,
  sır paylaşımı `0,666667` ile gereksinimleri karşıladı; blöf `0` ile gerekli
  `0,333333` değerini kaçırdı. E5 `0,390196`, `-0,084063`, risk `0/0` olsa da
  tehdit, eylem talebi ve sır recall kapılarını kaçırdı.
- Tek kalan BGE kalibrasyon engeli `BLUFF_CANDIDATE` recall'udur.
  `eligibleModelIds=[]`, `createNewBlindEpoch=false`; sıradaki hipotez farklı
  konulara yayılan blöfü tek sınıf centroidinde ezmek yerine kaynaklı epistemik
  kanıt ile deterministik/embedding aday birleşimini kalibrasyonda sınamalıdır.

### 31 Ağustos 2026 — Çerçeve ağırlıklı sözleşme centroidi reddedildi

- `PROTOTYPE_CLASS_CENTROID_INTENT_CONTRACT_FRAME_V1`, sözleşme vetosunu
  koruyup mevcut beş SemanticFrameV2 eksen uyumuna `0,08` skor ağırlığı verdi.
  Sentetik test yakın semantik eşitlikte uyumlu blöfü yükseltirken uyumsuz
  eylem talebini `-Infinity` ile veto etti; commit `574fb3b`.
- Kör-erişimsiz BGE dış kalibrasyonda blöf recall `0 → 0,333333`, eylem talebi
  recall `0,666667 → 1` oldu; bütün yüksek-risk recall şartları ve yanlış
  pozitif `0/0` kapısı geçti. Buna karşılık macro-F1 `0,628758 → 0,526517`,
  taban farkı `+0,154499 → +0,052258` ve minimum kat `0,438375` oldu.
- Ağırlıksız contract centroid `quality-pass/recall-fail`; ağırlıklı kol
  `recall-pass/quality-fail` Pareto noktasıdır. Hiçbiri bütün kapıları birlikte
  geçmedi: `eligibleModelIds=[]`, `createNewBlindEpoch=false`.
- Sonraki hipotez bütün sınıfların skorunu global ağırlıkla bozmayacaktır.
  Blöfün iddia+kanıt saklama/erteleme bileşimini ayrı, kaynaklı epistemik aday
  olarak birleştiren sınıf-yerel yaklaşım kalibrasyonda sınanmalıdır.

### 31 Ağustos 2026 — Epistemik blöf aday birleşimi kalibrasyon kapılarını geçti

- Blöf ortaklığı konu sözcüklerinden değil, bağımsız iddia ile kanıtı
  saklama/erteleme bileşiminden türetildi. `TELL + MIXED + CLAIMED_CERTAIN +
  NONE` sözleşmesi taze kalibrasyonda yalnız üç gerçek blöf ailesini eşledi;
  başka kalibrasyon satırı eşleşmedi. Çerçeve düzeltmesi `de658d8` ile,
  aday birleşimi `a3b857e` ile kaydedildi.
- Başarısız `0,08` sınıf-yerel ağırlık yükseltilmedi: sentetik yakınlık farkını
  kapatmak için yaklaşık `0,221112` gerektiği ölçüldü. Bunun yerine yalnız tam
  blöf sözleşmesi eşleştiğinde deterministik aday önceliği verildi. Diğer 16
  sınıfın kosinüs skorları ve bütün yüksek-risk sözleşme vetoları korundu.
- Kör erişimsiz `99/51/0` dış kalibrasyonda BGE-M3 ortalama macro-F1
  `0,697386`, minimum kat `0,598039`, taban farkı `+0,223126` ve toplam/
  en-kötü-kat yüksek-risk yanlış pozitif `0/0` verdi. Blöf recall `0 → 1`;
  tehdit `1`, eylem talebi `0,666667`, ticaret `1`, sır paylaşımı `0,666667`
  kaldı. Bütün kalite, yanlış-pozitif ve recall kapıları aynı kolda geçti.
- E5 seçimi `0,435948`, taban farkı `-0,038311`, risk `0/0` verdi; tehdit,
  eylem talebi ve sır paylaşımı recall gereksinimlerini kaçırdığı için elendi.
  Otomatik karar `eligibleModelIds=[bge-m3-q8_0]` ve
  `createNewBlindEpoch=true` oldu.
- Bu sonuç modelin ürün/EXE/IPC hattına girdiği veya B1 Türkçeyi anladığı
  anlamına gelmez. Faz 38 `In Progress` kalır. Sıradaki uygulama, bu hipotez
  seçildikten sonra hazırlanmış yeni, aile-sızıntısız ve önceden mühürlü kör
  epoch'tur; eski `SPENT_AFTER_2026_08_31_ONE_SHOT` kohortu yeniden kanıt
  olarak kullanılamaz.

### 31 Ağustos 2026 — V2 kör epoch kaliteyi doğruladı, recall ve OOD'yi reddetti

- `representation-stability-v2` kohortundaki `51/51` kayıt tek tek incelendi.
  Kalibrasyondaki aynı olaylara sızan üç aday ve doğal olmayan iki ifade gold
  öncesinde bağımsız ailelerle düzeltildi. Son corpus `442` benzersiz cümle,
  `402` aile ve `342` gold taşır.
- Sabit v1 kalibrasyonu ve seçilmiş tek BGE hipotezi, v2 blind'da yalnız bir
  kez çalıştırıldı. Deterministik taban macro-F1 `0,314458`, BGE sonucu
  `0,484744`, fark `+0,170286`dır. Kalite `+0,15` kapısı ve sıfır yüksek-risk
  yanlış-pozitif kapısı geçti.
- Anti-vacuity recall kapısı geçmedi: `REQUEST_ACTION=0/3` ve
  `SHARE_SECRET=0/3`; gerekli taban her ikisinde `1/3`tür. Üç OOD kaydının
  üçü de oyun içi sınıfa zorlandı (`OOD false acceptance=1,0`). Otomatik karar
  `acceptedModelIds=[]` oldu.
- Epoch `SPENT_AFTER_2026_08_31_V2_ONE_SHOT` olarak kilitlendi; yeniden koşu
  model yüklenmeden reddedilir. Runtime, Electron IPC, paketleme ve `%90+`/B1
  iddiası kapalıdır. Sıradaki hipotez harcanmış v2 satırlarını kalibrasyona
  çevirmeden, bağımsız kalibrasyonda eylem yönü + gizlilik yönü + OOD abstain
  kapılarını birlikte kanıtlamalıdır. Yeni blind ancak bu kapılar geçerse v3
  olarak hazırlanabilir.

### 1 Eylül 2026 — OOD kabul kapısı eklendi, eşik hipotezi genellemedi

- V2 ölçümünde `3/3` OOD yanlış kabulüne rağmen kalite, yüksek-risk yanlış
  pozitif ve recall kapılarının tek başına model kabulüne izin verebildiği
  bulundu. Temsil seçimi, yeni kör epoch uygunluğu ve son blind kabulü artık
  sıfır OOD yanlış kabulünü zorunlu tutar; düzeltme commit `46ac613` ile
  sentetik regresyon altında kilitlendi.
- Ayrı hipotez olarak sınıf eşikleri, sınıf F1'ı hesaplanmadan önce fit
  dilimindeki bütün OOD kabullerini reddedecek şekilde eğitildi; global marj
  seçimi de yüksek-risk yanlış pozitiften hemen sonra OOD sızıntısını
  karşılaştırır. Değişiklik commit `c4aac06` ile test edildi.
- Kör erişimsiz BGE-M3 dış kalibrasyonu `99/51/0` sınırında ve
  `blindTestAccessed=false` ile çalıştı. Seçilen sözleşme+blöf centroid kolu
  ortalama macro-F1 `0,664706`, minimum kat `0,568627`, taban farkı
  `+0,190447`, toplam/en-kötü-kat yüksek-risk yanlış pozitif `0/0` verdi;
  bütün yüksek-risk recall şartları geçti.
- Buna rağmen ortalama OOD yanlış kabul `0,666667`, en kötü kat `1` oldu.
  Üç dış kattan ikisi `UNKNOWN` girdiyi sırasıyla `SMALL_TALK` ve
  `ASK_INFORMATION` sınıfına zorladı. `eligibleModelIds=[]` ve
  `createNewBlindEpoch=false` kaldı.
- Yalnız eşik ayarı OOD genellemesi sağlamadı; aynı eşik ailesinde yeni tarama
  yapılmayacaktır. Sonraki hipotez, harcanmış v2 kör satırlarına bakmadan,
  bağımsız kalibrasyonda açık bir OOD temsil/abstention katmanını eylem ve sır
  yönüyle birlikte kanıtlamalıdır. Runtime, Electron/IPC ve `%90+`/B1 iddiası
  kapalıdır.

### 1 Eylül 2026 — En yakın OOD prototipi bağımsız katlarda genellemedi

- Tek `UNKNOWN` centroidinin ilgisiz OOD ailelerini ortalamada ezdiği hipotezi
  için oyun içi 16 sınıf centroidte bırakıldı; OOD, en yakın üç gerçek
  prototipten maksimum benzerlikle ayrı karşı-aday oldu. Sentetik çok-modlu
  örnekte centroidin kaçırdığı OOD doğru yakalandı ve giriş sırası değişmezliği
  test edildi; uygulama commit `1174129`.
- Kör erişimsiz `99/51/0` BGE-M3 ölçümünde OOD-max kolu ortalama macro-F1
  `0,641830`, minimum kat `0,588235`, taban farkı `+0,167571`, risk `0/0` ve
  geçen yüksek-risk recall kapıları verdi. Tam `51` kalibrasyona fit edildiğinde
  OOD `3/3` reddedildi.
- Dış katlarda OOD recall yalnız `1/3` oldu: ortalama yanlış kabul `0,666667`,
  en kötü kat `1`. Standart contract+bluff centroid de `0,666667/1` verdi ve
  daha yüksek `0,664706` macro-F1 nedeniyle seçili kaldı. OOD-max yeni blind
  uygunluğu açmadı: `eligibleModelIds=[]`, `createNewBlindEpoch=false`.
- Hipotez reddedildi. Üç OOD prototipinin centroid veya nearest-neighbor
  birleşimini yeniden taramak yerine, sonraki çalışma OOD'nin açık
  kapsam/taksonomi eksikliğini bağımsız kalibrasyon ailelerinde ele almalıdır.
  Harcanmış v2 satırları hâlâ kalibrasyon değildir.

### 1 Eylül 2026 — Bağımsız OOD taksonomisi reddi büyük ölçüde iyileştirdi

- Meta-oyun desteği, güncel gerçek dünya, programlama, sağlık, çeviri,
  yaratıcılık, kişisel tavsiye, seyahat, hukuk, rol aşımı, anlamsız dil ve
  akademik soru olmak üzere 12 ayrı kapsam ailesi tanımlandı. Her aile için
  ayrı prototip ve ayrı kalibrasyon cümlesi tek tek etiketlendi; 24 kayıt,
  24 aile, `24/24 CODEX_INDIVIDUAL_REVIEW`, `24/24 UNKNOWN/OOD` ve sıfır
  blind kaydı commit `62612c5` ile mühürlendi.
- Corpus `466` benzersiz cümle, `426` aile ve `366` gold oldu. Yeni dış
  kalibrasyon sınırı `111/63/0`, `blindTestAccessed=false`tır.
- Güvenlik öncelikli seçim `frame-centroid-guard` koluna geçti. Bu kol OOD
  yanlış kabulünü önceki `0,666667/1` ortalama/en-kötü değerden
  `0,066667/0,2`ye düşürdü; UNKNOWN recall `0,933333` oldu. Fakat macro-F1
  `0,511647`, taban farkı yalnız `+0,072109`, risk `1/1`; tehdit, eylem
  talebi ve blöf recall `0` olduğu için bütün kabul kapılarını geçmedi.
- Önceki contract+bluff kolu kaliteyi korudu: macro-F1 `0,719390`, minimum kat
  `0,625490`, taban farkı `+0,279852` ve yüksek-risk recall kapıları geçti.
  Ancak risk `1/1`, OOD yanlış kabul `0,133333/0,2` kaldı. OOD-max kolu daha
  kötü `0,266667/0,4` OOD sonucu verdi.
- `eligibleModelIds=[]`, `createNewBlindEpoch=false`. Taksonomi hipotezi güçlü
  iyileşme üretti fakat tek başına kabul değildir. Sonraki kök, oyun dışı gezi
  planının `REQUEST_ACTION` sayılması örneğinde görülen kanonik eylem/varlık
  kapsam kapısıdır; blind kullanılmadan kalibrasyonda sınanmalıdır.

### 1 Eylül 2026 — Eylem kapsamı ve hareket-emri ailesi birlikte doğrulandı

- Yüksek-risk `REQUEST_ACTION` sözleşmesi artık yalnız `REQUEST + ACTION`
  biçimine güvenmez; kanonik oyun predicate'i de ister (`aac006e`). Böylece
  predicate'i `UNSPECIFIED` olan gerçek dünya gezi planı etkili oyun emri
  sayılamaz.
- İlk ölçüm bu kapsam düzeltmesinin OOD yüksek-risk yanlış pozitifini `1 → 0`
  indirdiğini, fakat gerçek “Elçiyi ... getirin” kalibrasyon emrinin nihai
  yönlendiricide `UNKNOWN` kaldığını gösterdi. Kök neden cümle değil;
  `getir/götür/taşı/sevk et/yönlendir/gönder` hareket ailesinin konum
  predicate'i, emir yüzeyi ve istek işlevi kanıtlarının eksik olmasıydı.
- Hareket ailesi tek bir ortak semantik kuralla kapatıldı ve dört yeni varyant
  tam yönlendirici sonucuna kadar doğrulandı (`67b89dc`). Semantic-frame,
  router ve review-server testleri geçti.
- Kör erişimsiz BGE sınırı yine `111/63/0` ve `blindTestAccessed=false`tır.
  Güvenlik öncelikli seçilen contract-frame kolu ortalama macro-F1 `0,567021`,
  minimum kat `0,426759`, taban farkı `+0,128875`, risk `0/0`, OOD yanlış
  kabul `0,066667/0,2` ve `REQUEST_ACTION` recall `1` verdi. Kalite ve sıfır
  OOD kapıları geçmedi.
- Daha kaliteli contract+bluff kolu ortalama macro-F1 `0,723965`, minimum kat
  `0,639216`, taban farkı `+0,285819`, risk `0/0` ve bütün yüksek-risk recall
  kapılarını geçti; `REQUEST_ACTION=0,666667` oldu. Buna rağmen OOD yanlış
  kabul `0,133333/0,2` kaldı.
- `eligibleModelIds=[]`, `createNewBlindEpoch=false`. OOD makbuzu artık oranla
  birlikte satır kimliği ve zorlanan sınıfı verir (`47dd784`). Seçilen koldaki
  tek kaçak gerçek basketbol skoru isteğinin `SMALL_TALK` olmasıdır; kaliteli
  kolda anlamsız parça `ASK_INFORMATION`, gezi planı `SMALL_TALK` olur.
- Eylem kapsamı ve hareket ailesi hataları çözülmüştür. Yalnız predicate
  zorunluluğu geçerli fakat parser'ın konusu belirsiz Cermen Federasyonu
  sorularını da keseceği için reddedildi. Sıradaki kök açık oyun-alanı/varlık
  kanıtıdır. Runtime, Electron/IPC ve `%90+`/B1 iddiası kapalı kalır.

### 1 Eylül 2026 — Sınırlı domain sözleşmesi bütün kalibrasyon kapılarını geçti

- `ASK_INFORMATION` ve `SMALL_TALK` için yalnız deneysel yeni temsil kolunda
  yön sözleşmesine kaynaklı oyun-alanı kanıtı eklendi (`5f5bc9c`). Kanıt;
  kanonik predicate, açık hedef, devam/onarım bağı veya yalnız
  `EXACT_NORMALIZED_ALIAS` ile çözülmüş kamusal varlıktır. Typo-tolerant varlık
  eşleşmesi kanıt değildir. Mevcut temsil kolları değiştirilmedi.
- Kör erişimsiz BGE-M3 dış kalibrasyonu `111/63/0` sınırında çalıştı.
  `bounded-domain-contract-bluff-centroid-guard` ortalama macro-F1 `0,747109`,
  minimum kat `0,653092`, standart sapma `0,077599` ve deterministik tabana
  `+0,308963` fark verdi.
- OOD yanlış kabul ortalama/en-kötü `0/0`, UNKNOWN recall `1`; yüksek-risk
  yanlış pozitif toplam/en-kötü `0/0`dır. Recall değerleri tehdit `1`, eylem
  talebi `1`, ticari teklif `1`, sır paylaşımı `0,666667`, blöf `1` olup bütün
  anti-vacuity kapıları geçti.
- Düşük-risk ASK_INFORMATION ve SMALL_TALK recall'u ayrı ayrı `0,333333`tür;
  bu kayıp macro-F1 içinde hesaba katılmış olsa da yeni blind'da özellikle
  izlenecektir. Sonuç `eligibleModelIds=[bge-m3-q8_0]` ve
  `createNewBlindEpoch=true`tır.
- Bu yalnız v3 blind hazırlama kapısını açar. Model runtime/EXE/IPC hattına
  bağlanmamış, ürün için kabul edilmemiş ve `%90+`/B1 iddiası kanıtlanmamıştır.
  Sıradaki adım seçilmiş hipotezden sonra üretilen, aile-sızıntısız, önceden
  mühürlü v3 değerlendirme epoch'udur; v1/v2 blind tekrar kullanılmaz.

### 1 Eylül 2026 — V3 tek-seferlik blind bounded-domain hipotezini reddetti

- V3 cohort `51/51` kayıt, `51` benzersiz aile ve `17 × 3` sınıf dengesiyle
  tek tek incelendi (`c9e0e7b`). Kör içerik
  `c043ffa3735c6901d868a5917fe0620372727d85a1c1fbc4935b6b173955a05e`
  checksum'ıyla mühürlendi (`7237cf0`).
- Mevcut koşucunun blind'da bütün temsil kollarını puanladığı ölçüm öncesinde
  fark edildi. `--representation` filtresi bilinmeyen kimliği model yüklenmeden
  reddedecek ve yalnız önceden seçilmiş kolu çalıştıracak şekilde eklendi
  (`73fdff3`). V3 koşusu tek model, tek profil ve tek
  `bounded-domain-contract-bluff-centroid-guard` eğrisi taşıdı.
- Deterministik blind tabanı macro-F1 `0,340017`; BGE sonucu `0,309900`, fark
  `-0,030117` oldu. OOD yanlış kabul `0/3` ile geçti; fakat iki yüksek-risk
  yanlış pozitif oluştu (`blindv30026 → REQUEST_ACTION`,
  `blindv30037 → THREATEN`). Recall değerleri `REQUEST_ACTION=0`,
  `SHARE_SECRET=0`, `BLUFF_CANDIDATE=0`; gerekli kapılar sırasıyla
  `0,666667/0,333333/0,333333`tür. `acceptedModelIds=[]`.
- Epoch `SPENT_AFTER_2026_09_01_V3_ONE_SHOT` olarak kilitlendi (`7419381`).
  BGE SHA-256 `aa473d51…4047a173`; ham makbuz yerel geçici çalışma alanındaki
  `representation-stability-v3-result.json` dosyasındadır. V3 yeniden eşik,
  parser veya temsil seçimi için kullanılamaz.
- Runtime/Electron/IPC entegrasyonu açılmadı; `%90+` veya B1 günlük Türkçe
  iddiası desteklenmiyor. Sonraki araştırma, v3 hatalarını ezberlemeden yeni
  eylem-gizlilik-blöf yön hipotezini yalnız bağımsız kalibrasyonda kurmalıdır.
  Yeni blind gerekirse seçilmiş yeni hipotezden sonra bağımsız v4 olmalıdır.

### 1 Eylül 2026 — Çerçeve-otoriteli yüksek-risk kolu v4 hazırlama kapısını geçti

- Embedding sınıf skorlarını üretmeye devam eder; deterministik yön yalnız
  `speechAct` adayla birebir aynıysa ve sınıfın yüksek-risk çerçeve sözleşmesi
  tutarlıysa öncelik alır (`15ff973`). Önceki temsil kolları değiştirilmedi.
- İlk dış kalibrasyonda eylem talebi yönü hem bilgi sorusuna hem düzeltmeye
  yanlış otorite verdi: ortalama macro-F1 `0,673203`, risk `2`, blöf recall
  `0`; kol reddedildi. Hata cümleye özel değil, yüzey/continuity çelişkisiydi.
- `REQUEST_ACTION` otoritesi; interrogative yüzey, düzeltme/onarım/yanıt
  continuity'si veya ikincil `ASK_INFORMATION` işareti varsa kapatıldı.
  Blöfün bağımsız polarite+epistemik sözleşmesi aynı kolda korundu (`04c5408`).
- İkinci BGE-M3 dış kalibrasyonu kör erişimsizdir (`111/63/0`, blind count
  `0`). Ortalama/minimum macro-F1 `0,773253/0,731523`, tam kalibrasyon
  macro-F1 `0,819468`, taban farkı `+0,335107`dir. Risk `0/0`, OOD `0/0`;
  beş yüksek-risk recall değerinin tamamı `1`dir.
- `eligibleModelIds=[bge-m3-q8_0]`, `createNewBlindEpoch=true`. Bu yalnız
  aile-sızıntısız ve önceden mühürlü v4 blind hazırlama iznidir. V3 spent
  kalır; runtime/Electron/IPC ve `%90+`/B1 kabulü hâlâ kapalıdır.

### 1 Eylül 2026 — V4 blind gold kohortu tek tek tamamlandı

- Önceden seçilmiş `bounded-domain-authoritative-high-risk-centroid-guard`
  kolundan sonra `51` yeni Türkçe aday, `51` benzersiz aile ve `17 × 3` sınıf
  dengesiyle üretildi (`39bf443`). Üretim aşamasında hiçbir aday gold değildi.
- Kayıtların tamamı model tahminine bakılmadan tek tek incelendi. Her kayda
  `SemanticFrameV2` eksenleri, ayrım gerekçesi ve
  `CODEX_INDIVIDUAL_REVIEW` provenansı eklendi (`1c9c6ef`, `d7d6818`,
  `4e09c26`, `31a2e5f`, `1afc683`, `11c8b90`). V4 sayaç `51/51`, her sınıf
  `3/3`; corpus toplamı `468` gold oldu.
- Ret/vaat, rapor/emir, sır/gizlilik talebi, koşullu tehdit/gerçekleşmiş sonuç
  ve oyun-dışı soru/oyun içi niyet ayrımları cümle notlarında açıkça korundu.
  Semantik niyet benchmark testi bütün ara birimlerde geçti.
- V4 henüz ölçülmedi ve spent değildir. Sonraki adım, seçilmiş tek model ve
  temsil politikasını değiştirmeden v4 kanonik gold içeriğini checksum ile
  mühürlemek; ardından önceden tanımlı kabul kapılarıyla yalnız bir kez
  değerlendirmektir. Bu kayıtlar runtime/EXE/IPC veya `%90+`/B1 kabulü değildir.

### 1 Eylül 2026 — V4 tek-seferlik blind kaliteyi geçti, güvenliği reddetti

- V4 `51/51` gold ve `51` benzersiz aile olarak
  `5116021ce91d10d6bc304267bbabce760c2b805cb9c2a922d1b6e3ac131feb14`
  checksum'ıyla ölçüm öncesinde mühürlendi (`d850825`). Policy v3 spent
  durumunu önceki epoch olarak korudu ve bütün ölçüm alanlarını temizledi.
- Tek koşu yalnız SHA-256'sı `aa473d51…4047a173` olan `bge-m3-q8_0`, tek
  `bge-m3-plain` profil ve önceden seçilmiş
  `bounded-domain-authoritative-high-risk-centroid-guard` temsilini kullandı.
  Ham makbuz geçici çalışma alanındaki `representation-stability-v4-result.json`
  dosyasındadır.
- Deterministik blind tabanı macro-F1 `0,245865`, OOD yanlış kabul `2/3` ve
  yüksek-risk yanlış pozitif `5` verdi. BGE macro-F1 `0,401323`, fark
  `+0,155458` ve OOD yanlış kabul `0/3` ile kalite/OOD kapılarını geçti; ancak
  `4` yüksek-risk yanlış pozitif üretti. Hata kimlikleri `blindv40021`,
  `blindv40023`, `blindv40027`, `blindv40030`dur.
- Yüksek-risk recall: `THREATEN=1/3`, `REQUEST_ACTION=3/3`,
  `PROPOSE_COMMERCIAL_DEAL=1/3`, `SHARE_SECRET=1/3`,
  `BLUFF_CANDIDATE=0/3`. Sır için gereken `2/3`, blöf için gereken `1/3`
  karşılanmadı; `acceptedModelIds=[]`. Sıcak CPU p50/p95
  `481,63/674,34 ms`, vektör boyutu `1024`tür.
- Epoch `SPENT_AFTER_2026_09_01_V4_ONE_SHOT` olarak kilitlendi (`c72a22a`).
  V4 threshold, parser veya temsil ayarı için tekrar kullanılamaz. Runtime,
  Electron/IPC, `%90+` ve B1 günlük Türkçe kabulü kapalı kalır. Sonraki hipotez
  v4 hatalarına cümle bazlı kural yazmadan, yalnız prototip+kalibrasyon
  verisinde sır/blöf yönü ve yüksek-risk yanlış pozitiflerini birlikte çözmelidir.

### 1 Eylül 2026 — Yönsel sır/blöf kalibrasyonu otorite kolunu reddetti

- V4 satırları, tahminleri ve skorları ayar girdisi yapılmadan; yalnız mevcut
  prototip/v1 kalibrasyon kapsamındaki açık kalıp boşluğundan 20 bağımsız
  yönsel-risk kalibrasyon ailesi üretildi (`e4e0abb`, `273d62f`). Her cümle
  ayrı SemanticFrameV2 eksenleri ve gerekçesiyle gold yapıldı (`dde6a25`,
  `453b8fd`). Kohort 3 gerçek sır, 3 gerçek blöf ve 14 komşu eylem içerir.
- Yeni kohortta deterministik taban yalnız `3/20` doğru verdi ve `4` yüksek-risk
  yanlış pozitif üretti. Üç gerçek sırın hiçbiri `SHARE_SECRET`, üç gerçek
  blöfün hiçbiri `BLUFF_CANDIDATE` çerçevesine ulaşmadı. Bu, otorite kapısının
  açık “gizli/yalnız sana” ve “kanıt yok/gösteremem” kalıplarına aşırı bağlı
  olduğunu bağımsız kalibrasyonda gösterdi.
- İlk model denemesi `ACCUSE=1/3` dış-kat desteğinde model puanlamasından önce
  durdu; iki ayrı suçlama ailesi eklenip tek tek incelenerek destek `3/3`
  tamamlandı. Bu başarısız deneme blind erişmedi ve model sonucu üretmedi.
- Seçilmiş tek BGE kolunun nihai sınırı `111/83/0`, `blindTestAccessed=false`dır.
  Ortalama/minimum macro-F1 `0,619753/0,527778`, tabana fark `+0,255950`, OOD
  yanlış kabul `0/0` oldu. Ancak yüksek-risk yanlış pozitif toplam/en-kötü kat
  `1/1`; recall değerleri tehdit `1`, eylem talebi `0,166667`, ticari teklif
  `1`, sır `0,5`, blöf `0,5`tir. Eylem talebi gereken `0,75` değerini geçmedi;
  `eligibleModelIds=[]`, `createNewBlindEpoch=false`.
- Yeni blind açılmaz. Sonraki hipotez, sır/blöf sözcüklerine özel liste yerine
  konuşanın kendi kesin iddiası, kanıt erişilebilirliği ve eylemi kimin yapacağı
  yönlerini kompozisyon halinde çözmeli; aynı 83 satırlı dış kalibrasyonda
  kalite, sıfır risk, sıfır OOD ve bütün yüksek-risk recall kapıları birlikte
  geçmeden v5 hazırlanamaz.

### 1 Eylül 2026 — İddia sahipliği ve eylem yönü bütün kalibrasyon kapılarını geçti

- Türkçe birinci kişi iyelik/gelecek biçimleri, dinleyiciye yönelik imperative
  biçimlerden ayrıldı. Sır; sınırlı dinleyici ile gerçekten aktarılan olgunun,
  blöf ise konuşana bağlı kesin iddia ile saklanan/ertelenen kanıtın bileşimi
  olarak kuruldu. İç tutarlı soru, teklif, tehdit, sır ve blöf çerçevesinin
  çelişkili legacy kelime oyunu tarafından veto edilmesi kapatıldı (`fd59580`).
- Taze 20 ailede deterministik doğru sınıf `3/20 → 13/20`, yüksek-risk yanlış
  pozitif `4 → 0` oldu. Üç sır ve üç blöfün tamamı doğru; kalan yedi hata
  rapor/suçlama/sohbet gibi düşük-risk sınıf ayrımlarıdır.
- İlk geniş BGE ölçümünde sır/blöf recall `1`, eylem talebi `0,833333` oldu;
  tek yanlış pozitif, durum eki almış birinci kişi vaadini
  (`göndereceğime`) eylem talebi sanmaktı. Morfolojik aile durum ekiyle
  tamamlandı (`7736e6b`). Ardından `kimseye` içindeki legacy “kim” kalıntısının
  imperative isteğe ikincil soru eklediği görüldü; soru biçimi taşımayan
  imperative REQUEST'ten bu çelişkili ikincil temizlendi (`62a46ba`).
- Nihai seçilmiş BGE sınırı `111/83/0`, `blindTestAccessed=false`dır. Dış-kat
  ortalama/minimum macro-F1 `0,724507/0,643098`, standart sapma `0,062912`,
  tabana fark `+0,179736`dır. Yüksek-risk yanlış pozitif toplam/en-kötü kat
  `0/0`, OOD yanlış kabul ortalama/en-kötü `0/0`; tehdit, eylem talebi,
  ticari teklif, sır ve blöf recall değerlerinin tamamı `1`dir.
- `eligibleModelIds=[bge-m3-q8_0]`, `createNewBlindEpoch=true`. Bu yalnız seçilen
  kompozisyon hipotezinden sonra hazırlanacak aile-sızıntısız V5 blind iznidir.
  V4 spent kalır; runtime/Electron/IPC, `%90+` ve B1 kabulü hâlâ kapalıdır.

### 1 Eylül 2026 — V5 OOD ve recall kapılarını geçti, kalite ve güvenliği reddetti

- V5 kohortu `51/51` gold, `51` benzersiz aile ve `17 × 3` sınıf dengesiyle
  tek tek incelendi (`623f546`, `fa5eda9`, `32b706a`, `6895a60`, `c393e26`,
  `c6c7eac`). Kör içerik
  `550c0a8aebdca292b8871f9909c971407ddf3c1afab00627341ae61e06c48ee2`
  checksum'ıyla koşudan önce mühürlendi (`9ff5366`).
- Tek koşu yalnız SHA-256'sı `aa473d51…4047a173` olan `bge-m3-q8_0`,
  `bge-m3-plain` profil ve önceden seçilmiş
  `bounded-domain-authoritative-high-risk-centroid-guard` temsilini kullandı.
  Ham makbuz yerel geçici çalışma alanındaki
  `representation-stability-v5-result.json` dosyasındadır.
- Deterministik blind tabanı macro-F1 `0,441414`, OOD yanlış kabul `3/3` ve
  yüksek-risk yanlış pozitif `5` verdi. BGE macro-F1 `0,569901`, tabana fark
  `+0,128487`, OOD yanlış kabul `0/3` ve yüksek-risk yanlış pozitif `3` verdi.
  Kalite için gereken fark `+0,15`; güvenlik için gereken yanlış pozitif `0`dır.
  Hata kimlikleri `blindv50011`, `blindv50014`, `blindv50043`tür.
- Yüksek-risk recall değerleri `THREATEN=2/3`, `REQUEST_ACTION=3/3`,
  `PROPOSE_COMMERCIAL_DEAL=2/3`, `SHARE_SECRET=1/3` ve
  `BLUFF_CANDIDATE=1/3` ile recall kapılarını geçti. Bu başarı, kalite ve
  sıfır-yanlış-pozitif kapılarının başarısızlığını geçersiz kılmaz;
  `acceptedModelIds=[]` kaldı. Sıcak CPU p50/p95 `852,86/1198,24 ms`, vektör
  boyutu `1024`tür.
- Epoch `SPENT_AFTER_2026_09_01_V5_ONE_SHOT` olarak kilitlendi (`034edd2`).
  V5 içerikleri threshold, parser, temsil veya yeni aday üretimi için tekrar
  kullanılamaz. Sonraki hipotez yalnız prototip+kalibrasyon verisinden kurulmalı
  ve V5'e cümle/kimlik özel düzeltme yazılmamalıdır. Runtime/Electron/IPC,
  `%90+` karakter anlama ve B1 günlük Türkçe kabulü hâlâ kapalıdır.

### 1 Eylül 2026 — Geniş uzlaşma kalibrasyonu iki katı uzlaşma hipotezini reddetti

- V6 içeriği ve tahminleri kullanılmadan tek tek gold yapılan 30 bağımsız stres
  ailesi evaluation calibration sınırını `83 → 113` kayda çıkardı. Mevcut
  `bounded-domain-consensus-high-risk-centroid-guard` bu geniş sınırda yalnız
  prototype+calibration ile yeniden ölçüldü; sınır `111/113/0` ve
  `blindTestAccessed=false` kaldı.
- Eski uzlaşma kolunun dış-kat macro-F1 farkı `+0,113791` ile gereken `+0,15`
  kapısını geçmedi. Yüksek-risk yanlış pozitif `1`, OOD yanlış kabul `0` oldu;
  eylem talebi recall'u `0,277778`e düştü. Ticaret, sır ve blöf recall kapıları
  da geçmedi; `eligibleModelIds=[]` ve `createNewBlindEpoch=false` kaldı.
- Kök inceleme, eski kolun gerçek iki-sinyal uzlaşması olmadığını gösterdi:
  deterministik parser yüksek-risk sınıfını embedding sıralamasının önüne
  taşıyor, embedding yalnız son mutlak eşikte etkili oluyordu. Geçmiş ölçümü
  değiştirmemek için bu kol korunarak ayrı
  `bounded-domain-semantic-consensus-high-risk-centroid-guard` eklendi. Yeni
  kol, ham embedding birincisi ile deterministik yüksek-risk çerçevesi aynı
  sınıfta buluşmadıkça bütün yüksek-risk adayları veto eder.
- Sentetik uzlaşma ve anlaşmazlık regresyonları geçti. Geniş kalibrasyonda yeni
  kol yüksek-risk yanlış pozitifi `0` ve OOD yanlış kabulü `0` yaptı; fakat
  macro-F1 farkı `+0,026781`e, eylem/ticaret/sır/blöf recall değerleri sırasıyla
  `0,222222/0,444444/0,222222/0,111111`e düştü. Hipotez güvenli fakat aşırı
  katıdır ve reddedildi; yeni blind açılmaz.
- Sonraki araştırma yalnız calibration verisinde doğru yüksek-risk sınıfının
  ham semantik sıra ve marj dağılımını ölçmelidir. Top-K veya anlaşma bandı,
  konu-yakın eylem zıtlarında sıfır yanlış pozitifi ve mevcut recall tabanlarını
  birlikte geçmeden seçilemez. Bu sonuç runtime/Electron/IPC ya da B1 kabulü
  değildir.

### 1 Eylül 2026 — Semantik sıra makbuzu risk-grubu uzlaşmasını reddetti

- Calibration-only `CALIBRATION_CLASS_CENTROID_RAW_RANK_V1` makbuzu eklendi.
  Makbuz cümle metni veya blind satırı taşımaz; yalnız ilgili calibration
  kimliği, gold/parser sınıfı, ham centroid sırası ve top skora uzaklığı verir.
  BGE sınırı `111/113/0`, `blindTestAccessed=false` kaldı.
- `40` gerçek yüksek-risk satırın doğru sınıfı global centroid sırasında top-1
  `18`, top-2 `25`, top-3 `26`, top-5 `28` kez bulundu. Sır ve blöf için top-5
  kapsaması ayrı ayrı yalnız `4/9`dur. Bu nedenle global top-K büyütmenin bu
  temsil altında recall'u çözemeyeceği ölçüldü.
- Beş etkili sınıf kendi aralarında sıralandığında kapsama top-1 `24/40`, top-2
  `32/40`, top-3 `34/40`, top-5 `40/40` oldu. Parser'ın yanlış yüksek-risk
  sınıf seçip deterministik sözleşmeyi geçtiği iki bağımsız satırda embedding'in
  risk-grubu birincisi parser'dan farklıydı. Bu kanıttan ayrı
  `bounded-domain-risk-group-consensus-high-risk-centroid-guard` kolu üretildi:
  yalnız risk grubu içindeki ham embedding birincisi ile deterministik çerçeve
  aynı sınıfta buluşursa etkili aday yetki kazanır.
- Sentetik uzlaşma/anlaşmazlık testleri geçti. Geniş calibration'da yeni kol
  yüksek-risk yanlış pozitifi `0` ve OOD yanlış kabulü `0` tuttu; fakat dış-kat
  macro-F1 farkı `+0,060541` kaldı. Eylem/ticaret/sır/blöf recall değerleri
  `0,388889/0,444444/0,333333/0,111111` ile kapıları geçmedi.
  `eligibleModelIds=[]`, `createNewBlindEpoch=false`; hipotez reddedildi.
- Gold artışı mevcut mimaride temsili otomatik geliştirmez: calibration kayıtları
  eşik seçimi ve değerlendirme içindir, sınıf centroidleri hâlâ yalnız prototype
  çapalarından kurulur. Sonraki hipotez, dış-kat fit calibration ailelerini yalnız
  kendi validation katının dışında temsil çapası yapabilen sızıntısız fit-anchor
  düzenidir. Blind, runtime ve B1 kabulü kapalı kalır.

### 1 Eylül 2026 — Sızıntısız fit-anchor kaliteyi geçirdi, eylem talebi recall'u blind'ı kapalı tuttu

- Calibration gold artık yalnız eşik ölçmüyor: dış kattaki fit aileleri öğrenilmiş
  centroid çapalarına dönüşüyor; validation satırının bütün ailesi hem çapadan hem
  eşik-fit hesabından çıkarılıyor. Aileler katlar arasında bölünmiyor ve karışık
  etiketli tek aile fail-closed hata veriyor. Makbuz `111` prototype, `113`
  öğrenilmiş calibration çapası, `113` öğrenilmiş aile ve her katta `0` aile
  çakışması gösterir. Blind çapaları yalnız calibration'dan kurulacak olsa da bu
  koşuda evaluation blind sayısı `0` ve `blindTestAccessed=false` kaldı.
- İlk ölçüm ticari karşılıklılık ile yöneltilmiş talebi karıştıran genel parser
  açığını gösterdi. Karşı tarafın koşullu edimi + konuşanın taahhüdü veya açık
  karşılık + yöneltilmiş talep artık ticari takastır. Buna karşılık `isterseniz`,
  `dilerseniz` ve `arzu ederseniz` tercih koşulları karşılıksız desteği ticarete
  çeviremez. Ticaret, yalın talep, ekonomik rapor, tehdit ve ücretsiz destek
  aileleri birlikte regresyonla kilitlendi.
- Son BGE-M3 sınırı `111/113/0`; model SHA-256
  `aa473d51f451a22f0fcf39ba3330c14bed38a385712b1113440f69df4047a173`.
  Seçilen fit-anchor parser-uzlaşması ortalama/minimum macro-F1
  `0,674948/0,573256`, deterministik tabana fark `+0,165118`, toplam/en-kötü-kat
  yüksek-risk yanlış pozitif `0/0` ve OOD yanlış kabul `0/0` verdi. Risk-grubu
  alternatifi `0,604145` macro-F1 ile daha zayıf kaldı.
- Recall tehdit `0,722222 ≥ 0,714286`, ticari teklif `1 = 1`, sır
  `0,777778 = 0,777778` ve blöf `0,555556 = 0,555556` kapılarını geçti. İkili
  kayan-nokta gösterim farkının eşit değerleri yanlış reddetmemesi için kapıya
  `1e-12` karşılaştırma toleransı eklendi. Eylem talebi ise gerçek biçimde
  `0,611111 < 0,75` kaldı; `eligibleModelIds=[]` ve
  `createNewBlindEpoch=false` değişmedi.
- Bu sonuç gold'un sızıntısız öğrenilmiş temsilde ölçülebilir yarar sağladığını,
  fakat ürün kabulü için hâlâ yeterli olmadığını gösterir. Sonraki çalışma yeni
  threshold taraması veya spent V3–V6 verisi değil; yalnız prototype+calibration
  içinde REQUEST_ACTION ile OFFER_SUPPORT/ASK_INFORMATION ayrımının genel
  kompozisyon ve temsil hatalarını incelemelidir. Runtime/Electron/IPC ile `%90+`
  ve B1 günlük Türkçe kabulü kapalıdır.

### 2 Eylül 2026 — Harici AI incelemesi fail-closed dosya protokolüne alındı

- Gemini 3.7 Flash A, atanmış ayrı çıktı dosyası bulunmadan çalışıp ana corpus'a
  `28` adjudication ve `640` satır yazdı. Bu işlem mevcut reviewer allowlistini
  ihlal ederek router doğrulamasını bozdu; modelin iki turu içerik doğruluğundan
  bağımsız olarak `DISQUALIFIED` ve `eligibleForConsensus=false` yapıldı.
- İlk turdaki `20` karar `external-review-0001`, ikinci turdaki `8 ACCEPT + 12
  NEEDS_REVIEW` karar `external-review-0002` recovery makbuzlarına çıkarıldı.
  İki partinin steril girdisi yalnız `id`, `text`, `history`, `speakerFamily`,
  `familyId` ve `split` taşır; blind sayısı ayrı ayrı `0`dır.
- Ana corpus'taki yalnız doğrulanmış `28` Gemini bloğu hedefli yama ile kaldırıldı;
  corpus diff'i boş ve router testi yeniden geçer durumdadır. Gold toplamı `620`
  olarak değişmedi.
- `qa-runtime/external-ai-reviews/PROTOCOL.md` harici modellerin kanonik çalışma
  sözleşmesidir. Corpus model için yasaktır; eksik inputta durmak zorunludur;
  yalnız atanmış output yazılabilir. Yasak yola tek yazım bile çıktıyı kalıcı
  olarak oy dışına çıkarır. Metinsel tekillik yerine semantik şablon tekilliği,
  Sonnet/Opus kör turunda 2/2 aday uzlaşması ve yüksek-risk için ayrıca merkezi
  hakem denetimi gerekir.

### 2 Eylül 2026 — Sonnet/Opus bağımsız turu merkezi hakemlikle kapatıldı

- Sonnet 4.6 ve Opus 4.6 aynı `20` steril prototype/calibration kaydını ayrı
  `LABELER` oturumlarında tamamladı. İki makbuzun ID kümeleri, karar ve güven
  sayaçları doğrulandı; blind kayıt sayısı `0`dır. Karar türü `17/20` eşleşti,
  fakat kabul edilen çerçevelerden yalnız `1` tanesi bütün eksenlerde birebirdi.
- Merkezi inceleme yalnız parti içi tekrara bakmadı; mevcut non-blind gold
  envanterini de denetledi. Tam eşleşen deklaratif eylem talebi dahil `16` kayıt
  mevcut şablonların alan/sözcük varyantı olarak gold dışında bırakıldı.
- Üç bağımsız değer corpus'a `CODEX_INDIVIDUAL_REVIEW` ile alındı: bileşik
  `REJECT + REQUEST_ACTION`, geleceğe dönük ekonomik beklenti + duygu ve
  “gizli operasyon” konusunu gerçek sır paylaşımından ayıran `SMALL_TALK`
  hard-negative. Belirsiz bilgi-vaadi/anlaşma kaydı yüksek-risk nedeniyle
  `NEEDS_HUMAN_DECISION` kaldı.
- Gold toplamı `620 → 623`, prototype gold `111 → 114` oldu. Calibration ve
  spent blind içerikleri değişmedi. Aktif Sonnet/Opus görevleri `CLOSED` yapıldı;
  birleştirme makbuzu `external-review-0001/consensus.json` içindedir. Router
  testi `ok=true`, `issues=0` ile geçti.

### 2 Eylül 2026 — İnceleme maliyeti yenilik-öncelikli kapıya alındı

- Gold güveni gevşetilmedi: otomasyon hiçbir kaydı gold yapamaz ve her gold aday
  cümlesi bütün eksenleriyle bireysel olarak okunur. Ancak her düşük değerli
  aday için aynı uzun açıklamanın yeniden üretilmesi durduruldu.
- Ucuz ön eleme yalnız tam metin tekrarını otomatik kapatabilir. Şablon kümeleri
  karar vermez; merkezi inceleyici ortak kuralı bir kez doğrular ve her kaydın
  farklı kısmını ayrı kontrol eder. Şablon tekrarı, eksik sözce ve bozuk yön
  kayıtları kısa neden koduyla gold dışı bırakılır.
- İkinci kurtarma partisindeki 20 kayıt bu yöntemle tek tek fark kontrolünden
  geçti: 8 bileşik teklif kaydı aynı üretilmiş yön/karşılık sorununu taşıdı,
  12 üç noktalı kayıt tamamlanmış bir iletişim eylemi taşımadı. Corpus'a yeni
  gold eklenmedi; sayaç `623` kaldı. Makbuz
  `external-review-0002/consensus.json` içindedir.
- Bundan sonraki pahalı tam inceleme kuyruğu, önce doğal dil kalitesi ve semantik
  yenilik kapısını geçen adaylara ayrılır. Bu yöntem daha az kayıt üretmeyi değil,
  aynı bütçeyle daha yüksek bilgi değerine sahip gold üretmeyi hedefler.

### 2 Eylül 2026 — Eylem talebi yönü morfolojik aile düzeyinde düzeltildi

- Geniş calibration'daki 11 gerçek `REQUEST_ACTION` kaydı üzerinde deterministik
  ön-kabul yeniden çıkarıldı. Başlangıçta 4 kayıt yanlış sınıftaydı: çoğul/kibar
  emir `iletin / çekin / hazırlayın`, soru biçimli rica `tutar mısın` ve bunların
  yakın ailesi yön kanıtı üretemiyordu.
- Tek cümle istisnası yerine kanonik eylem kökü + Türkçe emir eki, eylem kökü +
  geniş zaman + ikinci kişi soru parçacığı ve gereklilik kipi ayrı kompozisyon
  kanıtları oldu. Soru biçimi pragmatik eylem isteğini silmez; ama `güveniyor
  musun`, `hazırlıyor musunuz` ve `hazırlamamı ister misin` bilgi sorusu olarak
  kaldı.
- `sınırdaki` artık duygu kökü `sinir` sayılmıyor. Doğrudan emirde icracı
  dinleyici, eylemin zamanı gelecek; soru biçimli isteklerde epistemik durum
  `QUESTIONED` olarak çıkarılıyor. Ekonomik yakıt kaydı ve rapor hazırlama
  konuları da eylem yönünden bağımsız predicate kanıtıyla ayrıldı.
- Blind açılmadan deterministik calibration sonucu `7/11 → 11/11` oldu. Hedef
  semantic-frame, conversation-case, router ve review-server testleri geçti.
  Doğrulanmış hash'e sahip BGE-M3 dosyası mevcut çalışma alanında bulunmadığı
  için fit-anchor dış-kat ölçümü bu turda yeniden çalıştırılmadı; bu sonuç yeni
  blind, runtime/Electron/IPC veya `%90+`/B1 kabulü açmaz.
- Model koşucusu artık GGUF'u yüklemeden önce sürümlü artefakt makbuzundaki dosya
  adı, byte boyutu ve SHA-256'yı birlikte doğrular. BGE-M3 makbuzu
  `bge-m3-q8_0.gguf / 634553760 / aa473d51…4047a173`, E5 makbuzu
  `twinsuns-multilingual-e5-small-q8_0.gguf / 132439008 /
  e011debc…0a877c93` olarak kod ve regresyon testinde kilitlendi. Eksik, farklı
  veya bozuk artefakt artık `node-llama-cpp` yüklenmeden açık hata verir; kayıp
  model sessizce başka GGUF ile ikame edilemez.
