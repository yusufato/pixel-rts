# 1) Verdict

- **Root cause:** Dinamik rota tamamlanınca `storyInfrastructureReset` altyapı grafiğini yeni koridor kataloğu ve yeni `networkHash` ile kuruyor; yaşayan ticaret ve piyasa defterleri ise oluşturuldukları eski ağ karmasında kalıyor.
- **Confidence:** Confirmed.
- **Chain:** Ekonomik AI rota inşaatını tamamlıyor → `corridor:built:*` kataloğa ekleniyor → altyapı grafiği yeniden kuruluyor → trade/market sidecar hash'leri yenilenmiyor → normal dünya çalışmayı sürdürse de `storyTradeValidate` `TRADE_NETWORK_HASH` veriyor → tam paket 88 görev bittikten sonra toplu assertion'da başarısız oluyor.
- Hata devam ediyor; tam 900 saniyelik paket ve aynı tohumlu 180 saniyelik izole koşuda yeniden üretildi.

# 2) Failure Definition

- Görünen belirti: `Normal 900 saniyelik dünya geçerli ticaret defteri korumalı.` assertion'ı `false !== true`.
- Gerçek doğrulama sorunu: yalnız `TRADE_NETWORK_HASH`, `$.networkHash`.
- Yeniden üretim: seed 2032 ile 180 saniyelik `runStorySimulation`; `tradeValidation.ok=false`.
- Etki alanı: Kampanya sırasında yeni kara, demir yolu veya deniz koridoru tamamlanan bütün dünyalar; kayıt öncesi doğrulama da defteri sorunlu işaretler.
- Regresyon kaynağı: dinamik koridor tamamlanması `51489ec` ile eklendi; bağımlı sidecar revizyonu eklenmedi.

# 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 2026-08-20 | Dinamik kara rotası inşaatı ve tamamlanınca graph reset eklendi | `51489ec` | Ağ kataloğu çalışma sırasında değişebilir hâle geldi. |
| 2026-08-23 | Tam paket 88/88 görev sonrasında toplu trade assertion'ında durdu | `npm test` | Önceki üç regresyon geçmesine rağmen plan kapanmadı. |
| 2026-08-23 | Seed 2032, 180 saniyelik izole dünya aynı hash sorununu verdi | Doğrudan harness koşusu | Bozulmanın 900 saniyeye veya paralelliğe bağlı olmadığı doğrulandı. |

# 4) Hypotheses (ranked)

## H1 — Dinamik koridor tamamlanması altyapı hash'ini değiştiriyor, trade sidecar eski hash'te kalıyor

- **If true, we would also see:** Tamamlanmış `corridor:built:*` kayıtları, geçerli ticaret içeriği ve tek issue olarak `TRADE_NETWORK_HASH` görülür.
- **Discriminating test:** Aynı tohumda 180 saniyelik dünya çalıştırıp trade validation, summary ve koridor kullanımını yazdırmak.
- **Status:** Supported. Defter 143 sözleşme, 47 açık sipariş ve 330 aktif sevkiyat taşırken tek doğrulama sorunu ağ karması; kullanılan koridorlarda `corridor:built:rail:1` ve `corridor:built:land:2` var.

## H2 — ENERGY non-vehicle düzeltmesi geçersiz shipment biçimi üretiyor

- **If true, we would also see:** Shipment alanı, rota veya taşıt invariant issue'ları `TRADE_NETWORK_HASH` yanında raporlanır.
- **Discriminating test:** Tam `tradeValidation.issues` listesini incelemek.
- **Status:** Refuted. Doğrulayıcı yalnız ağ karması uyuşmazlığı raporluyor; ENERGY dağıtım probu tam pakette geçti.

## H3 — Ticaret grafiği veya koridor kataloğu bozuluyor

- **If true, we would also see:** Altyapı doğrulama hatası, kayıp koridor referansı veya ticaret ilerlemesinin durması beklenir.
- **Discriminating test:** Operasyonel özette teslimat, aktif kargo ve yeni built corridor kullanımını incelemek.
- **Status:** Refuted. 180 saniyede binlerce sevkiyat ilerliyor; yeni koridorlar rota kapasitesinde kullanılıyor. Sorun içerik değil revizyon bağı.

## H4 — Paralel test worker yarışı sonuç dosyasını bozuyor

- **If true, we would also see:** İzole tek süreçte doğrulama geçer veya farklı issue'lar oluşur.
- **Discriminating test:** `runStorySimulation` fonksiyonunu doğrudan tek Node sürecinde çalıştırmak.
- **Status:** Refuted. Tek süreç 180 saniyede aynı `TRADE_NETWORK_HASH` sonucunu verdi.

# 5) Mechanism

1. `storyInfrastructureWorkTick`, tamamlanan route command için `corridor:built:<mode>:<n>` kaydını `infrastructureWorks.routes` listesine ekler.
2. En az bir rota tamamlandıysa `storyInfrastructureReset` çağrılır; `storyInfrastructureDefinitions` artık built corridor'ları da içerir.
3. Yeni graph `storyInfrastructureNetworkHash(corridors)` ile yeni hash alır.
4. `STORY.tradeLogistics.networkHash` ve `STORY.marketPrices.networkHash` eski değerde kalır.
5. Her iki defterin doğrulayıcısı yaşayan graph hash'iyle bire bir eşleşme ister; ticaret assertion'ı önce çalıştığı için paket orada durur.

- **Root cause:** Dinamik ağ revizyonunun bağımlı sidecar'lara yayınlanacağı tek sahipli adaptör sınırı eksik.
- **Contributing factor:** `storyInfrastructureReset` hem restore/backfill hem de kontrollü eklemeli canlı mutasyon için kullanılıyor; genel reset içinde kör hash düzeltmesi yapmak bozuk kayıtları gizleyebilir.
- **Detection failure:** Dinamik rota testleri koridorun oluşmasını ölçüyor, uzun dünya testinin toplu assertion'ı ise sonuç dosyaları bittikten sonra çalıştığı için hata en sonda görünür oluyor.
- **Weakest link:** Ağ revizyonuna bağlı durable sidecar listesi açık bir sözleşme olarak tanımlanmamış.

# 6) Remediation Options

## Fix

- **Title:** Kontrollü route completion sınırında ağ bağımlı sidecar hash'lerini yenilemek
- **Category:** Fix
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/StoryInfrastructureWorks.js`, `completedRoutes` graph reset bloğu
- **Recommended fix:** Graph reset sonucunun `networkHash` değerini, yalnız bu eklemeli canlı rota tamamlama yolunda mevcut `tradeLogistics` ve `marketPrices` defterlerine yaz. Defter içeriklerini sıfırlama; eski koridorlar ve aktif sevkiyatlar geçerli kalır.
- **Tradeoffs / Risks:** Gelecekte yıkıcı koridor silme desteği eklenirse kör hash ilerletme yeterli olmaz; o yol aktif shipment/contract migration gerektirmeli.

## Prevention

- **Title:** Dinamik ağ revizyonu sonrası trade ve market doğrulamasını kapılamak
- **Category:** Prevention
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** Uzun dünya ve altyapı route completion testleri
- **Recommended fix:** En az bir built corridor tamamlandıktan sonra iki sidecar'ın graph hash'iyle eşit olduğunu ve doğrulayıcıların geçtiğini ölç.
- **Tradeoffs / Risks:** Tam dünya kapısı pahalı; dar route completion probu hızlı erken uyarı sağlamalı.

# 7) Verification Plan

- Seed 2032, 180 saniyelik izole dünya `tradeValidation.ok=true` ve `marketValidation.ok=true` vermeli.
- Dinamik `corridor:built:*` rotaları korunmalı; ticaret sözleşmeleri, siparişler ve aktif shipmentlar sıfırlanmamalı.
- ENERGY `distributionProbe` ve fiziksel LAND/RAIL/SEA route testleri geçmeye devam etmeli.
- Son olarak `npm test` baştan sona, toplu assertion dahil sıfır koduyla bitmeli.
