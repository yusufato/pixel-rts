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
last_touched: 2026-09-01
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
