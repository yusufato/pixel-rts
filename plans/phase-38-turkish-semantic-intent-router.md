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
last_touched: 2026-08-27
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
onayladı. Aynı tarihte, tek geliştiricilik iş akışı için 200 insan-onaylı gold
örneğini model/runtime prototip kapısı; 1.000 insan-onaylı gold örneğini ürün
entegrasyonu ve `Landed` kapısı yapmayı, ayrıca toplu inceleme aracı kapsamını
onayladı. `depends_on` planı Landed'dır; uygulama başlamıştır.

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
| 1 | Gerçek Türkçe tabanı ölç | 200 insan-onaylı prototip gold, kör ayrım, mevcut hata matrisi; 1.000 ürün kapısı korunur | `test(story): establish Turkish intent baseline` |
| 2 | Model/runtime spike | İki aday, EXE CPU/RAM/latans/paket ölçümü; ürün bağı yok | `test(story): benchmark local multilingual embeddings` |
| 3 | Kapalı katalog ve yönlendirici | Sürümlü prototipler, ölçülmüş top-K, skor/marj, OOD ret | `feat(story): add bounded semantic intent candidates` |
| 4 | SemanticFrameV2 birleşimi | Aday doğrulama, çoklu niyet ve netleştirme | `feat(story): validate embedding candidates through semantic frames` |
| 5 | Yüksek risk teyidi | Domain preflight, slot/yetki/bütçe ve açık oyuncu onayı | `feat(story): gate consequential language behind confirmation` |
| 6 | Sonuç seslendirmesi | LLM yalnız kapalı sonuç zarfı; şablon fallback | `feat(story): voice validated conversation outcomes` |
| 7 | Shadow/Electron kabulü | Feature flag, gerçek EXE ölçümü, save/load ve gizlilik | `test(story): accept Turkish semantic routing in Electron` |
| 8 | Belgeler | Ana plan, durum, araştırma ve karar defteri | `docs(story): record Turkish semantic routing contract` |

## 6) Corpus ve kabul kapıları

- Model/runtime prototipi en az 200 insan etiketli, birbirinin yeniden yazımı
  olmayan Türkçe turdan önce başlamaz. Ürün entegrasyonu ve planın `Landed`
  olması için ilk gold set en az 1.000 insan etiketli tur taşır. Her iki kapıda
  da prototip, kalibrasyon ve kör test konuşmacı/şablon ailesine göre ayrılır.
- Model, gece QA'sı ve mevcut deterministik motor yalnız etiket adayı üretir;
  açık insan kararı bulunmayan kayıt hiçbir kapıda gold sayılmaz.
- Gündelik sohbet, bilgi, görüş, görev, ticaret, rüşvet, tehdit, ittifak, sır,
  rapor, toplantı ve açık `UNKNOWN/OOD` sınıfları bulunur.
- Ekli biçim, yazım hatası, eksik noktalama, argo, olumsuzluk, varsayım,
  ironi, zamir, ellipsis, takip, konu geçişi, iki niyet, sayı ve özel ad
  adversarial aileleri zorunludur.
- Başarı yalnız accuracy değildir: macro-F1, sınıf recall, OOD yanlış kabul,
  top-1/top-2 marjı, expected calibration error ve domain hata matrisi ölçülür.
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
  spike'ı, 200 insan-onaylı kayıt tamamlanana kadar açık kalır.
