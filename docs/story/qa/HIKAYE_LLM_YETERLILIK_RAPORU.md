# Hikâye Modu Yerel 8B Model Yeterlilik Raporu

**Faz:** 3.1  
**Model:** `Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf`  
**Model boyutu:** 4.920.733.952 bayt  
**Ham rapor:** `qa-runtime/story-llm-benchmark.json`  
**Komut:** `npm run story:llm-bench`  
**Kabul komutu:** `npm run story:llm-gate`  
**Sonuç:** Serbest görev tezgâhında **KALDI**; Faz 38'in kod-sınırlı kapalı seçim hakemliğinde **GEÇTİ**. Bu iki sonuç birbirinin yerine kullanılamaz.

## Ölçüm ortamı

- Backend: CUDA
- CPU: 13th Gen Intel Core i7-13620H, 16 mantıksal işlemci
- Sistem belleği: 15.71 GB
- Model süreci RSS: yaklaşık 4.95–4.97 GB
- Bağlam: 2048
- Model yükleme: 4.86 sn
- Ortalama ilk token: 126.29 ms
- Ortalama görev süresi: 1.70 sn
- Gözlenen üretim: yaklaşık 34–40 token/sn

Bu değerler yalnız ölçüm yapılan bilgisayar için geçerlidir. Düşük VRAM, yalnız CPU veya daha az RAM taşıyan hedef cihazlar ayrıca profillenmeden genel minimum sistem gereksinimi sayılamaz.

## Görev sonucu

| Görev | Sonuç | Teknik teşhis |
|---|---|---|
| Bozuk Türkçe niyet ve varlık bağlama | KALDI | Çelik, İngiltere ve Ankara doğru; `intent` alanı anlamsız biçimde `Oyuncu` oldu. |
| Hafıza ve gerçek koruma | KALDI | İlk nesnede gerçekleri kopyaladı; ardından `Sahra Çelik` adlı yeni şirket uydurmaya başladı ve çıktı kesildi. |
| Kısıtlı aday eylem seçimi | KALDI | Doğru `A1` nesnesini yazdı fakat JSON öncesi/sonrası açıklama ekledi; katı sözleşme cevabı değil. |
| Karakter sesi | KALDI | Dört satır üretti fakat “Güvence değil, para” repliğini aynen tekrarladı; insan benzeri konuşma değil. |
| Diyalog tekrar/gerçek güvenliği | KALDI | Cümleler farklıydı fakat bağlamda bulunmayan `3 kat` ve `5000 lira` değerlerini uydurdu. |

Katı sonuç `0 / 5`tir. Önceki gevşek doğrulama `3 / 5` gösteriyordu; bu sahte başarıydı. İlk doğru JSON’u seçip sonrasındaki uydurmayı görmezden gelmek veya yalnız cümle benzerliğine bakıp uydurulmuş sayıları kabul etmek oyun güvenliği açısından geçerli değildir.

## Faz 38 kapalı-seçim güncellemesi — 9 Ağustos 2026

**Ham rapor:** `qa-runtime/story-character-arbiter-benchmark.json`
**Komut:** `npm run story:arbiter-bench`
**Kabul komutu:** `npm run story:arbiter-gate`

Bu ikinci ölçüm serbest niyet, doğal diyalog veya dünya üretimi değildir. Motor önce Faz 37 adaylarını üretir, `54` altı commit adaylarını eler ve en çok sekiz gerçek seçeneğe sıra çağrıştırmayan `Qxxxx` kodu verir. Model yalnız bu kodlardan birini önerebilir veya PASS diyebilir. Kanonik eylem, hedef, bedel ve sonuç model çıktısında bulunmaz; kod tarafından geri çözülür.

`node-llama-cpp` JSON şema grameri istek bazında etkinleştirildi. Gramer yalnız etkin `requestId`yi, sunulmuş opak kodları, enum konuşma planını ve iki yasal çapraz alan birleşimini üretebilir: `PROPOSE + gerçek seçim` veya `PASS + null`. Katı `StoryCharacterArbiter` doğrulayıcısı yine son otoritedir; model/gramer hatasında deterministik fallback çalışır ve dünya beklemez.

| Ölçü | Sonuç |
|---|---:|
| Roller | Komutan, ajan, siyasi figür, devlet başkanı, şirket yöneticisi |
| Şema kabulü | `5 / 5` |
| Semantik eşik | `5 / 5` |
| Fallback / üretim hatası | `0 / 0` |
| Dünya nötrlüğü | `5 / 5` |
| Farklı opak seçim | `2` |
| Backend / bağlam | CUDA / `1024` |
| Çıktı bütçesi / sıcaklık | `110` / `0,40` |
| Ortalama ilk token | `779,91 ms` |
| Ortalama toplam | `2.830,74 ms` |
| Tam hikâye regresyonu | `60 / 60`, çıkış `0`, `1.688,0 sn` |

Kapıya giden başarısız ara sonuçlar özellikle korundu: ilk gerçek hakem sözleşmesi `0/2` kesilmiş/yanlış enum; kısaltılmış fakat örnekli şema `2/2` biçimsel kabulün arkasında C1 yankısı; ilk beş-rollü koşu `5/5` biçim fakat yalnız `2/5` semantik verdi. Eşik gevşetilmedi. Gereksiz kanonik tekrarlar kaldırıldı, commit eşiği kod tarafına taşındı, çapraz alan grameri eklendi ve sıra çağrıştıran C kodları opak karmalara dönüştürüldü.

Bu geçiş yalnız şunu kanıtlar: paketli model, kodun zaten doğruladığı dar seçenekler arasında güvenli ve zaman bütçesine sığan bir öneri üretebilir. Modelin insan benzeri sohbet, uzun pazarlık, özgün karakter sesi veya mekanik seçiciden daha iyi stratejik muhakeme yaptığı henüz kanıtlanmamıştır.

## Faz 38 canlı tüketim güncellemesi — 9 Ağustos 2026

Kapalı seçim artık yalnız benchmark değildir. Faz 37'nin on saniyelik karakter görevi ilk tikte sürümlü bir bekleyen istek açar; model ayrı duvar-saatinde çalışır ve sonucu doğrudan dünyaya yazamaz. Tam bir sonraki sabit tikte aday listesi, `requestId` ve `contextHash` yeniden üretilir. Yalnız aynı bağlam için doğrulanmış `LOCAL_LLM_VALIDATED` PROPOSE/PASS sonucu tüketilir. Seçilen aday bir kez daha yetki, hedef, bedel ve cooldown kapısından geçer.

- Model sonraki tike yetişmezse deterministik Faz 37 seçimi uygulanır.
- İlişki/hafıza/aday bağlamı değişmişse eski model cevabı atılır.
- Kayıt model çalışırken alınırsa istek kimliği ve bağlam karması korunur; yüklemede duvar-saatli üretim yeniden oynatılmaz ve deterministik fallback uygulanır.
- PASS hiçbir mekanik eylem veya sahte makbuz üretmez.
- Kabul edilen model kararı makbuzda `requestId`, `contextHash`, opak seçim kodu, neden enum'u ve konuşma planıyla izlenir.
- Model hikâye karakter sistemi tarafından ilk kez gerektiğinde arka planda yüklenir; oyun açılışı ve dünya tiki modeli beklemez.

Geçerli seçim, PASS, hiçbir zaman tamamlanmayan üretim, değişmiş hafıza bağlamı ve yarım kayıt senaryoları hedefli problarda geçti. Bu sonuç doğal Türkçe cümle kalitesi veya tekrar önleme kapısını değiştirmez; o borçlar hâlâ Faz 38.2 kapsamındadır.

Canlı dikey sonrasında gerçek paket kapısı aynı beş rolde yeniden geçti: `5/5` şema, `5/5` semantik, sıfır fallback/hata/mutasyon ve iki farklı seçim. Eşzamanlı sistem yükünde ortalama ilk token `1.449,36 ms`, toplam `4.374,88 ms` oldu. Ardından kapsamı azaltılmamış hikâye paketi `60/60`, çıkış `0`, `841,3 sn` ve değişmeyen `70056c2d…6d4d36e5` dünya karmasıyla geçti.

PASS dahil hakem sonucu artık geçici sayaç değildir. `512` tavanlı sürümlü karar geçmişi model kabulü/fallback/stale durumunu, istek ve bağlam karmasını, seçimi, gerekçeyi ve konuşma planını saklar; aktörün son altı kararı bir sonraki hakem isteğine girer. `520` kayıt tavan probu, budama sayacı ve kayıt/yükleme birebirliği geçti. Bu geçmiş doğal replik değildir; yalnız bir sonraki karar ve ilerideki konuşma gerçekleştirme katmanı için doğrulanmış bağlamdır.

Karar geçmişi prompt'a girdikten sonraki son paket kapısı yine `5/5` şema, `5/5` semantik, sıfır fallback/hata/mutasyon ve iki farklı seçim verdi; ortalama ilk token `593,07 ms`, toplam `2.447,50 ms` oldu. Son tam hikâye regresyonu `60/60`, çıkış `0`, `846,0 sn`; ana dünya karması `70056c2d…6d4d36e5` kaldı.

## Faz 38 konuşma gerçekleştirme kapanışı — 9 Ağustos 2026

Serbest metin modelinin `0/5` kalite sonucu gevşetilmedi. Doğal replik, LLM'e ikinci bir özgür çıktı çağrısı yaptırmak yerine `DETERMINISTIC_CONSTRAINED_REALIZER` tarafından yalnız doğrulanmış eylem/PASS, enum konuşma planı ve kanonik ses profilinden üretilir. Yeni karar kaydı cümle/normalize cümle, template, istenen ve uygulanan hitap, açılış, ton ve vurguyu saklar. Son altı normalize tam cümle yeniden seçilemez; aynı hitap iki kez art arda kullanılmışsa üçüncü söz alternatif hitaba döner. STALE karar söz üretmez.

Sekiz oyuncu-yönelimli aynı eylem ve bir özel AI–AI kararından oluşan probda tam cümle tekrarı, üçlü hitap, iç alan/uydurma sayı sızıntısı ve özel konuşma sızıntısı sıfırdır. Oyuncunun sekiz sözü gelen kutusunda görünür; özel söz görünmez. Dokuz replik kayıt/yüklemede birebir korunmuştur. Nihai hikâye paketi `61/61`, çıkış `0`, `558,4 sn`; ana 900 saniyelik dünya `219.806,34 ms` ve aynı `70056c2d…6d4d36e5` karmasıyla geçti. Kapanış sonrası gerçek paket kapısı `5/5` şema + `5/5` semantik, sıfır fallback/hata, iki farklı seçim ve `524,74 / 2.340,98 ms` ilk-token/toplam ortalaması verdi.

Bu sonuç yalnız Faz 38'in karar→güvenli yüzey dili kapısını kapatır. Oyuncunun serbest cümlesini anlama Faz 38.1'in; uzun diyalogta n-gram/anlamsal tekrar ve kör karakter sesi ayrımı Faz 38.2'nin kabul konusudur.

## Faz 38.1 ilk dikey — LLM'siz anlama tabanı

Serbest oyuncu metninin ilk analizi modele verilmedi. `story-conversation-understanding-1` kapalı konuşma eylemleri, kanonik varlık adayları, doğrulanmamış `ConversationClaim`, istek, eksik şart, risk ve teyit sorusu üretir. Dünya komutu ve mutasyon üretemez. Böylece LLM kapalıyken aynı mekanik analiz yolu korunur; ileride model yalnız doğrulanabilir yeniden sıralama/paraphrase yardımcısı olabilir.

Çelik/Britanya örneği önemli sınırı kanıtladı: mevcut kaynak kataloğunda çelik yoktur. Model veya ayrıştırıcı bunu kendiliğinden sanayi parçasına çevirmedi; `UNRESOLVED_CATALOG_GAP` verdi. Oyuncunun bahsettiği yabancı sipariş ham ticaret defterinden aranmadı ve `UNVERIFIED_IN_CONVERSATION` kaldı. Bu, modelin şirket/sevkiyat/fiyat uydurmasını yasaklayan mimari kararın uygulamadaki ilk serbest-metin müşterisidir. Çok turlu teyit ve gerçek teklif yaşam döngüsü henüz tamamlanmadığından Faz 38.1 `partial`dır.

## Mimari karar

Yerel 8B modelin izinli rolü:

- Motorun ürettiği gerçeklerden manşet veya atmosfer metni önermek.
- Şablonla zaten çalışan diyaloğu, bütün gerçekler ve isimler doğrulanırsa zenginleştirmek.
- Geçersiz, gecikmiş veya tekrarlı çıktıda hiçbir dünya etkisi oluşturmadan şablona düşmek.

Modelin yasak rolü:

- Oyuncu niyetini tek başına sınıflandırmak.
- Şirket, sözleşme, sevkiyat, fiyat, tarih veya miktar oluşturmak.
- Stratejik/diplomatik aday eylemi doğrudan uygulamak.
- Serbest JSON cevabıyla dünya durumuna yazmak.
- Karakter hafızasının gerçek kaydı olmak.

## Faz 38 için zorunlu tasarım kısıtı

1. Niyet ve varlık çözümü deterministik ayrıştırıcı, izinli eylem sözlüğü ve oyuncu onay kartıyla yapılır.
2. Aday eylemleri motor üretir; maliyet ve uygulanabilirliği motor hesaplar.
3. LLM seçimi yalnız doğrulanan `actionId` ile sınırlıdır. Şema dışı veya ek metinli cevap reddedilir.
4. LLM başarısızsa karakterin deterministik politika skoru seçimi yapar; oyun beklemez ve sonuç değişmez.
5. Sayı, tarih, şirket, şehir ve aktör adları çıktıdan yeniden kabul edilmez; girişteki kimliklerle birebir eşleşmek zorundadır.
6. Diyalog için tam cümle, n-gram, hitap ve uydurulmuş sayı denetimi uygulanır.
7. Modelin metni teklif değildir. Dünya etkili her sonuç, motorun ürettiği sürümlü teklif kartında oyuncuya gösterilir.

## Token bütçesi bulgusu

`--quick` koşusundaki 60 token sınırı doğru yöne giden üç cevabı yarıda kesti ve gevşek puanı `2 / 5`e düşürdü. Tam koşuda 70–120 token kullanıldı; buna rağmen katı sözleşme geçmedi. Dolayısıyla yalnız token artırmak çözüm değildir. Daha büyük sınır gecikme ve uydurma alanını da büyütür.

## Faz kapanışı

```text
Faz: 3.1 — Yerel 8B Model Yeterlilik Tezgâhı
Uygulanan kapsam: Gerçek paket modeliyle ilk-token, toplam süre, token hızı, RSS ve beş görev sınıfı
Değiştirilen şemalar: story-llm-phase3.1-v1 raporu
Yeni özellik bayrağı: Yok
Kayıt göçü: Yok
Otomatik testler: Sabit üretim tohumu, katı JSON, gerçek koruma, tekrar ve sayı uydurma denetimi
Headless koşu sonucu: Teknik çalışma başarılı; model kalite kapısı 0/5
Performans farkı: Dünya motoruna etkisi yok; model ayrı süreçte
Oynanış doğrulaması: Model kritik karar vericisi olarak reddedildi
Bilinen sorunlar: CPU/düşük VRAM hedef profilleri ölçülmedi
Geri alma yöntemi: LLM kapalıyken mevcut deterministik şablonlar
Kabul kapısı: MODEL KALDI; KISITLI MİMARİ KARARI GEÇTİ
Sonraki faza geçilebilir mi: EVET — model yetkisi yukarıdaki sınırlarla
```
