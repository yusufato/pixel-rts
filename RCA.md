# 1) Verdict

- **Root cause:** `storyTransportShipmentValidate`, fiziksel taşıma ajanı için yalnız canlı durumları kabul ediyor. Ticaret motoru ise başarıyla teslim edilen ajanı `DELIVERED`, kaybolanı `LOST` durumuna geçiriyor; terminal shipmentlar bu nedenle topluca geçersiz sayılıyor.
- **Confidence:** Confirmed.
- **Chain:** Fiziksel shipment oluşturuluyor → ajan geçerli canlı durumlarda ilerliyor → teslimat/kayıp tamamlanıyor → trade motoru shipment ve ajanı terminal duruma geçiriyor → validator terminal ajan durumlarını reddediyor → yüzlerce `INVALID_SHIPMENT_TRANSPORT` issue oluşuyor.
- Ağ hash düzeltmesi bu hatayı üretmedi; daha önce `TRADE_NETWORK_HASH` erken dönüşü alttaki shipment doğrulamasını saklıyordu.

# 2) Failure Definition

- Görünen belirti: 180 saniyelik yeniden doğrulamada çok sayıda `INVALID_SHIPMENT_TRANSPORT`, mesaj `TRANSPORT_AGENT`.
- İlk örnek yollar: `$.shipments[18].transportAgent`, `$.shipments[19].transportAgent` ve devamı.
- Etki alanı: `transportVersion=2` taşıyan tamamlanmış veya kaybolmuş fiziksel shipment kayıtları; kayıt/restore doğrulaması da etkilenir.
- Regresyon kaynağı: fiziksel çok-modlu lojistik ve validator aynı `6ece5a5` commitinde uyumsuz terminal sözleşmesiyle eklendi.

# 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 2026-08-20 | Fiziksel transport agent, terminal geçişleri ve shipment validator eklendi | `6ece5a5` | Üretici `DELIVERED/LOST`, validator yalnız canlı state kabul etti. |
| 2026-08-23 | Ağ hash uyuşmazlığı 180 saniyelik doğrulamada tek issue olarak görüldü | İlk tanı koşusu | Validator hash kontrolünden erken döndüğü için ajan sorunları görünmedi. |
| 2026-08-23 | Ağ revizyon bağı düzeltildikten sonra aynı koşu tekrarlandı | İkinci tanı koşusu | Hash geçti; terminal ajan issue'ları görünür oldu. |

# 4) Hypotheses (ranked)

## H1 — Validator terminal ajan durumlarını kabul etmiyor

- **If true, we would also see:** Trade motoru `DELIVERED/LOST` atar; validator allowed listesinde bu değerler yoktur; issue'lar tamamlanmış shipmentlarda yoğunlaşır.
- **Discriminating test:** Terminal geçiş kodu ile `storyTransportShipmentValidate` allowed state listesini karşılaştırmak.
- **Status:** Supported. `StoryTrade.js` ajanı `DELIVERED` ve `LOST` yapıyor; validator yalnız `QUEUED`, `LOADING`, `MOVING`, `WAITING`, `TRANSFERRING`, `UNLOADING` kabul ediyor.

## H2 — Ajan attach eksik veya bozuk alanlarla nesne üretiyor

- **If true, we would also see:** Dikey taşıma testleri canlı durumda başarısız olur; cargo id, step index veya physical route issue'ları görülür.
- **Discriminating test:** Attach nesnesi ve mevcut kara/demir/deniz dikey testlerini incelemek.
- **Status:** Refuted. Dört altyapı testi ve daha önceki fiziksel dikey testler geçti; hata mesajı genel `TRANSPORT_AGENT` olsa da terminal state karşılaştırmasından kaynaklanıyor.

## H3 — Ağ hash senkronizasyonu ajanları bozuyor

- **If true, we would also see:** Sidecar hash ataması transportAgent alanlarını değiştirir veya sorun hash düzeltmesi olmayan koşuda bulunmaz.
- **Discriminating test:** Hash düzeltmesi diff'i ile shipment içeriğini karşılaştırmak.
- **Status:** Refuted. Düzeltme yalnız iki `networkHash` alanını yazar; terminal çelişki ilk fiziksel lojistik commitinde mevcut.

## H4 — ENERGY grid shipmentları fiziksel ajanmış gibi doğrulanıyor

- **If true, we would also see:** Hatalı shipmentlarda `transportVersion`/agent bulunmaz veya ENERGY legacy yoluna ait olurlar.
- **Discriminating test:** Validatorın yalnız `transportVersion != null` shipmentlarda çağrıldığını ve issue mesajını incelemek.
- **Status:** Refuted. ENERGY grid shipmentları fiziksel ajan taşımıyor; issue'lar agent taşıyan v2 shipmentlardan geliyor.

# 5) Mechanism

1. `storyTransportAttachShipment`, v2 fiziksel rota ve canlı `transportAgent` oluşturur.
2. `storyTransportAdvanceShipment` ajanı yükleme, hareket, transfer ve boşaltma durumlarından geçirir.
3. `storyTradeDeliverShipment` başarı sonunda shipment status ve agent state'i `DELIVERED` yapar.
4. `storyTradeLoseShipment` aynı eşleşmeyi `LOST` için yapar.
5. `storyTransportShipmentValidate`, shipment statusunu hesaba katmadan agent state'i yalnız canlı durum listesine karşı sınar.
6. `storyTradeValidate`, tüm geçmiş shipmentları doğruladığı için her terminal fiziksel kayıt issue üretir.

- **Root cause:** Transport agent yaşam döngüsü için status-pair invariantı tanımlanmadı; validator canlı ve terminal kayıtları ayırmıyor.
- **Contributing factor:** Hata mesajı yalnız `TRANSPORT_AGENT` diyerek hangi alt alanın bozuk olduğunu saklıyor.
- **Detection failure:** Dikey testler teslimat animasyonunu ve agent final state'ini ölçüyor, fakat teslimat sonrası bütün trade ledger doğrulamasını kapılamıyor.

# 6) Remediation Options

## Fix

- **Title:** Ajan durumunu shipment yaşam döngüsüne göre doğrulamak
- **Category:** Fix
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/StoryTransportAgents.js`, `storyTransportShipmentValidate`
- **Recommended fix:** Aktif `IN_TRANSIT/HELD` shipmentlarda yalnız canlı agent state'lerini; `DELIVERED`, `LOST`, gelecekte `RETURNED` shipmentlarda yalnız aynı isimli terminal agent state'ini kabul et. Kimlik, rota ve step index kontrollerini koru.
- **Tradeoffs / Risks:** `RETURNED` bugün fiziksel akışta üretilmiyor; eşleşmeli kabul ilerideki açık shipment enumuyla tutarlılık sağlar, fakat dönüş uygulaması ayrıca agentı terminal duruma geçirmek zorunda olmalı.

## Prevention

- **Title:** Fiziksel teslimat sonrası trade ledger doğrulamasını dikey testlere eklemek
- **Category:** Prevention
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** Kara, demir, deniz ve multimodal dikey testler
- **Recommended fix:** Canlı hareket assertion'larından sonra `storyTradeValidate` çağır ve terminal shipment-agent status eşleşmesini doğrula.
- **Tradeoffs / Risks:** Küçük test maliyeti; geniş regresyon yakalama değeri yüksek.

# 7) Verification Plan

- `tests/story-transport-agents.test.js` ve kara/demir/deniz/multimodal dikey testler geçmeli.
- Seed 2032, 180 saniyelik dünya `tradeValidation.ok=true` ve `marketValidation.ok=true` vermeli.
- Teslim edilmiş v2 shipmentlarda `shipment.status=DELIVERED` ve `agent.state=DELIVERED`; kayıplarda `LOST/LOST` korunmalı.
- Aktif shipment üzerinde sahte terminal agent state validator tarafından reddedilmeli.
- Son olarak `npm test` toplu assertion dahil sıfır koduyla tamamlanmalı.
