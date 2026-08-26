---
id: bugfix-council-motion-atomicity
status: Draft
owner: osman
source: COUNCIL-02 / TG-29 / 25 Ağustos Atlas Operasyonu
touches:
  - js/Council.js
  - tools/story-sim-harness.js
  - tests/story-world.test.js
  - tools/story-test-manifest.js
  - docs/story/design/HIKAYE_MODU_SISTEM_ATLASI.md
  - TEST_GAPS.md
  - RCA.md
  - LEDGER.md
depends_on:
  - electron-story-lifecycle-acceptance
  - worktree-reconciliation-no-delete
  - phase-38-13-meeting-closure-routing
  - phase-38-13-private-note-response
conflicts_with:
  - phase-38-13-meeting-closure-routing
  - phase-38-13-private-note-response
created: 2026-08-25
last_touched: 2026-08-26
---

# Konsey Önergesi Atomikliği Bugfix Planı

## Amaç

Bir konsey önergesi uygulanamaz veya effect yürütmesi hata verirse oyuncu/AI
kaynak kaybetmesin, kısmi dünya etkisi kalmasın ve başarı metni üretilmesin.
Başarılı önerge tam bir ödeme, tam bir sonuç ve açık bir makbuz üretsin.

Bu plan COUNCIL-01'deki bütün eski önergeleri ayrıntılı ekonomi/altyapı
komutlarına taşımayı içermez. O geçiş K-11 ürün kararıdır. Buradaki hedef,
mevcut görünen önerge sonuçlarını koruyarak hata yolunu atomik yapmaktır.

## Kanıtlanan hata

Güncel sıra:

```text
fon yeterliliği
  -> storyCouncilPayFromState (kalıcı debit)
  -> try { motion.apply(state) }
  -> catch { hata sessizce yutulur }
  -> koşulsuz “kabul edildi” metni
```

Kontrollü `roads.apply` exception fixtüründe nakit 3.000→2.850 düştü, dünya
etkisi oluşmadı ve fonksiyon başarı metni döndürdü.

## Değişmezler

- Mevcut başarılı önerge maliyetleri ve oyuncuya görünen sonuçları değişmez.
- Oyuncu ve AI aynı prepare/commit/makbuz yolunu kullanır.
- Başarısız prepare sıfır bütçe, cüzdan, refah, sadakat, şehir, garnizon,
  teknoloji, kurum, altyapı ve telemetri farkı üretir.
- Başarılı karar tek `correlationId` altında bir ödeme ve bir terminal sonuç üretir.
- Teknik exception oyuncuya stack göstermez; teşhise yazılır ve açık başarısız
  durum döner.
- Kayıt sırasında açık/yarım önerge transaction'ı kalmaz; yürütme senkrondur.
- COUNCIL-01/K-11 kapsamındaki fiziksel domain anlamı bu bugfixte değiştirilmez.

## Neden yalnız try/catch düzeltmesi yetmez?

- Catch'i kaldırmak ödemeyi geri getirmez ve oyuncu oturumunu exception ile keser.
- Ödemeyi callback sonrasına taşımak, ödeme beklenmedik biçimde reddedilirse
  ücretsiz dünya etkisi bırakır.
- Yalnız ödeme iadesi, callback birkaç alanı değiştirip sonra düşerse kısmi
  şehir/refah/sadakat etkisini geri almaz.
- Bütün `STORY` nesnesini JSON snapshot ile geri koymak canlı referans, cache,
  DOM ve typed yapı kimliklerini bozabilir.

Bu nedenle keyfî `apply` callback'i atomik sınır olamaz.

## Uygulama tasarımı

### 1. Önce kırmızı failure-injection testi

Harness gerçek `storyCouncilApply` yolunu açacak. Test en az şu kesme
noktalarını çalıştıracak:

1. Fon yetersizliği.
2. Effect hazırlama sırasında geçersiz hedef.
3. Effect ilk alanı seçtikten fakat commit başlamadan önce kontrollü hata.
4. Bütçe/cüzdan ödeme preflight reddi.
5. Başarılı normal önerge.

Her başarısızlıkta bütün ilgili snapshotlar birebir eşit olmalı; dönüş
`REJECTED` veya `ROLLED_BACK` olmalı ve “kabul edildi” içermemeli.

### 2. Keyfî callback'i hazırlanmış işlem planına dönüştür

`COUNCIL_MOTIONS[].apply` yerine önerge kimliğini alan saf bir
`storyCouncilMotionPrepare(state, motion, context)` üret:

```text
prepare sonucu
  -> ok / reason
  -> paymentPlan
  -> effectOperations[]
  -> expectedPostconditions[]
  -> correlationId
```

Operation türleri dar allowlist olur: sayısal alan ekleme/set, seçilmiş
komutanlara sadakat değişimi, refah domain çağrısı, garnizon/bina değişimi ve
benzeri mevcut katalog ihtiyaçları. Bilinmeyen operation prepare aşamasında
reddedilir; commit sırasında keyfî fonksiyon çalıştırılmaz.

### 3. Ödeme planını mutasyon yapmadan çöz

`storyCouncilPaymentPrepare`:

- puan için kanonik bütçe bakiyesini;
- petrol/insan için hangi komutandan ne kadar alınacağını;
- negatif, NaN, eksik cüzdan ve çifte kaynak kullanımını

önceden hesaplar. Bu aşama hiçbir defteri değiştirmez.

### 4. Önkoşulları ve postcondition'ı commit öncesi doğrula

Hedef başkent, komutan, teknoloji, bina tavanı ve gerekli alanlar operation
planı derlenirken doğrulanır. Basit ve doğrulanmış operation listesi committe
exception üretmeyecek biçimde uygulanır. Refah gibi ayrı domain çağrısı gereken
etkiler açık handler ve sonuç sözleşmesi taşır; başarısız olabilen handler keyfî
callback olarak bırakılmaz.

### 5. Tek terminal makbuz üret

`storyCouncilApply` string yerine yapılandırılmış sonuç üretir; mevcut UI için
metin adapteri geçici olarak korunur:

```text
APPLIED | REJECTED | ROLLED_BACK
motionId, countryId, correlationId
paymentReceipt, effectReceipt, reason
```

Telemetri yalnız `APPLIED` sonrasında başarı olayı; başarısızlıkta ayrı teşhis
olayı yazar. Aynı konsey oturumu/önerge kimliği ikinci kez işlenirse çift ödeme
engellenir.

### 6. Katalog maddelerini tek tek taşı

Her mevcut önerge ayrı fixture ile hazırlanmış operation'a geçirilir. Bir
önerge dönüştürülmeden eski callback fallback'i tutulmaz; aksi hâlde atomiklik
iddiası katalogun yalnız bir kısmında geçerli olur.

## Planı çürütme

| İddia | Karşı test | Çürütülürse |
|---|---|---|
| Prepare saf ve world-neutraldır | Prepare öncesi/sonrası tam ilgili-defter snapshotı | Mutasyon yapan resolver ayrılır; plan kabul edilmez |
| Operation allowlist bütün mevcut önergeleri temsil eder | Katalogdaki her motion için önce/sonra davranış eşdeğerliği | Eksik davranış açık handler olur; generic eval/callback eklenmez |
| Commit exception üretmez | Her operation türünde bozuk hedef, NaN ve boundary fixture | Transaction journal + compensating rollback tasarlanır |
| Ödeme preflight ile gerçek debit aynı sonucu verir | Cüzdan dağılımı, bütçe limiti ve eşzamanlı olmayan bütün kaynak türleri | Ödeme rezervasyonu eklenmeden commit yapılmaz |
| UI adapteri yanlış başarı göstermez | APPLIED/REJECTED/ROLLED_BACK render snapshotları | String tabanlı eski dönüş kaldırılır |
| Yalnız konsey dosyası davranışı etkilenir | 900 saniye A/B ve konsey karar dağılımı/maliyet/sonuç karşılaştırması | Önerge bazında ayrıştır; sapma açıklanmadan merge etme |
| JSON dünya snapshot rollback'i kolay çözümdür | Object identity, cache, DOM ve save/load referans testi | Bu yaklaşım reddedilir; hazırlanmış operation kullanılır |

## Doğrulama kapısı

- Mevcut kodda `councilMotionFailureIsAtomic` kırmızı ve 150 kaybı yakalar.
- Bütün hata kesme noktaları sıfır dünya/kaynak farkı üretir.
- Bütün katalog önergeleri başarı yolunda eski maliyet ve görünür sonucu korur.
- Başarı tek ödeme/tek etki; tekrar çağrı çift sonuç üretmez.
- AI ve oyuncu oturumu aynı receipt şemasını kullanır.
- Save/load ve 900 saniyelik deterministik simülasyon geçer.
- Bütçe, kaynak, causality ve WorldV2 validatorleri yeşildir.
- `git diff --check` temizdir.

## Risk ve geri alma

Risk orta-yüksektir: tek hata satırı küçük görünse de güvenli düzeltme bütün
önerge kataloğunun yürütme biçimini değiştirir. Kod değişikliği tek konsey
transaction diliminde tutulur; COUNCIL-01 fiziksel modernizasyonuyla
birleştirilmez. A/B sonucu veya önerge eşdeğerliği bozulursa kaynak ve test
adaptörü birlikte geri alınır.

## Onay durumu

Plan uygulanmaya hazırdır; kaynak kod değişikliği henüz yapılmamıştır.
