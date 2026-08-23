# RCA — Göç testi ürünün şema-4 sözleşmesine rağmen şema-7 bekliyor

## 1) Verdict

- **Root cause:** `tests/story-world.test.js` içindeki tek bir assertion, konuşma oturumu defteri göçünün sonucunu yanlışlıkla `7` bekliyor.
- **Confidence:** Confirmed.
- Canlı ürün sabiti, yeni defter üretimi, göç fonksiyonu, doğrulayıcı ve aynı testteki bir önceki açıklama şema `4` sözleşmesinde uzlaşıyor.

## 2) Failure Definition

- Beklenen ürün davranışı: Şema 1/2/3 kayıtları güncel `STORY_CONVERSATION_SESSION_SCHEMA_VERSION = 4` değerine göçmeli ve doğrulamayı geçmeli.
- Gerçek çalışma: Göç sonucu `schemaVersion=4`, `validation.ok=true`.
- Hatalı test davranışı: Başarılı göçün hemen ardından `schemaVersion === 7` bekleniyor.
- Blast radius yalnız bayat test sabitidir; kayıt biçimini ya da oyuncu verisini değiştiren bir ürün kusuru yoktur.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| 2026-08-23 öncesi | Oturum defteri sözleşmesi şema 4 olarak tanımlandı | `STORY_CONVERSATION_SESSION_SCHEMA_VERSION = 4` |
| 2026-08-23 | Göç probu geçerli şema-4 kayıt üretti | `legacySessionMigration.validation.ok=true`, `schemaVersion=4` |
| 2026-08-23 | Assertion bağımsız `7` literalinde durdu | `tests/story-world.test.js:4463` |

## 4) Hypotheses (ranked)

1. **Assertion literalı bayat/yanlış.** Supported: ürünün tüm sözleşme noktaları ve komşu test açıklaması 4 diyor.
2. **Göç fonksiyonu şema 7’ye yükseltilmeliydi.** Refuted: şema 5/6/7 için ürün sabiti, adapter veya doğrulayıcı sözleşmesi yok.
3. **Korunan prob çıktısı eski.** Refuted: güncel kaynak şema 4 üretiyor ve sonuç güncel doğrulayıcıdan geçiyor.

## 5) Mechanism

1. Eski şema-2 defteri göç fonksiyonuna girer.
2. Göç fonksiyonu güncel sabiti kullanarak şema 4 yazar.
3. Doğrulayıcı aynı sabitle kaydı geçerli kabul eder.
4. Testteki bağımsız `7` literali bu tutarlı sonucu hatalı biçimde reddeder.
- Root cause yanlış test sabiti; contributing factor şema değerinin assertion içinde tekrar edilmesi; detection failure komşu açıklamayla literal arasındaki çelişkinin daha önce yakalanmamasıdır.

## 6) Remediation Options

### Mitigation

- Assertionı kaldırmak hatayı gizler ve göç sözleşmesini korumasız bırakır; uygulanmamalı.

### Fix

- Beklenen değeri `4`, açıklamayı `şema-4` yap.
- Ürün göç koduna dokunma.

### Prevention

- Şema göç testlerini mümkün olduğunda dışa aktarılan/gözlenen güncel adapter sözleşmesiyle eşleştir; açıklama ve literal çelişkisini diff incelemesinde kontrol et.

## 7) Verification Plan

- Korunan güncel prob çıktısıyla sequential assertion zinciri bu noktayı geçmeli.
- Göç doğrulaması `ok=true`, şema değeri `4`, güvenli varsayılanlar mevcut kalmalı.
- Ardından 10 senaryolu güvenli-fallback ve tam `npm test -- --keep-results` çalışmalı.