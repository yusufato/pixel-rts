# RCA — Şema-2 konuşma göçü olay alanlarını undefined bırakıyor

## 1) Verdict

- **Root cause:** storyConversationSessionMigrateLedger, eski oturumlarda bulunmayan sourceEventAnchor ve eventDecision alanlarını güvenli null varsayılanına yükseltmiyor.
- **Confidence:** Confirmed.
- Bellek içi araçlandırma iki göç edilmiş oturumda diğer tüm varsayılanların doğru olduğunu, yalnız bu iki alanın JSON çıktısından tamamen düştüğünü gösterdi.

## 2) Failure Definition

- Beklenen: Eski konuşma oturumu, olay bağlantısı veya oyuncu kararı yoksa bu alanları açıkça null taşımalı.
- Gerçek: Alanlar undefined; buna rağmen ledger doğrulaması ok=true.
- Etki: Tüketiciler “bilinçli olarak olay yok” ile “alan hiç göç edilmemiş” durumunu ayıramaz; serileştirme sonrası alan tamamen kaybolur.
- Blast radius şema 1/2/3 konuşma defteri göçleridir; yeni şema-4 oturum üretimi etkilenmez.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| Şema 4 geçişi | Olay ankrajı ve karar alanları oturum sözleşmesine eklendi | Test açıklaması ve güncel oturum biçimi |
| Göç uygulaması | Liste, taviz ve çözüm varsayılanları eklendi | storyConversationSessionMigrateLedger |
| 2026-08-23 | Bellek içi prob iki alanın undefined kaldığını gösterdi | Araçlandırılmış migrated.sessions çıktısı |

## 4) Hypotheses (ranked)

1. **Göç iki olay alanını backfill etmiyor.** Supported: göç döngüsünde bu alanlar için hiçbir hasOwnProperty kontrolü yok; ölçümde ikisi de yok.
2. **Birleşik defaults testi başka alanda yanlış.** Refuted: oyuncu cevapları, kanıtlar, takipler, tavizler ve çözüm alanları ölçümde doğru.
3. **Alanların undefined kalması sözleşmeye uygun.** Refuted: test ve tüketici sözleşmesi olay yokluğunu açık null ile temsil ediyor; JSON undefined alanını korumuyor.

## 5) Mechanism

1. Şema-2 fikstüründe olay alanları mevcut değildir.
2. Göç fonksiyonu oturumu şema 4 yapar fakat bu iki anahtarı eklemez.
3. JavaScript erişimi undefined döndürür ve JSON serileştirme anahtarı atar.
4. Mevcut doğrulayıcı anahtar yokluğunu reddetmediği için göç hatası geçerli görünür.
- Root cause eksik backfill; contributing factor doğrulayıcının eksik anahtarı ayırt etmemesi; detection failure yalnız birleşik fallback assertionının alan bütünlüğünü ölçmesidir.

## 6) Remediation Options

### Mitigation

- Testi gevşeterek undefined değerini kabul etmek veri sözleşmesindeki belirsizliği kalıcılaştırır; uygulanmamalı.

### Fix

- Göç sırasında alan mevcut değilse sourceEventAnchor = null ve eventDecision = null ata.
- Var olan güncel değerleri koru; hiçbir olay veya dünya değişikliği üretme.

### Prevention

- Şema göçlerinde yeni nullable alanlar için açık anahtar varlığı ve kayıt/yükleme turu testi kullan.
- Doğrulayıcıyı gelecekte missing ile explicit null ayrımını raporlayacak şekilde sıkılaştırma borcu olarak izle.

## 7) Verification Plan

- Şema-2 probunun iki alanı da açıkça null olmalı.
- defaultsPresent=true, validation.ok=true kalmalı.
- Sequential assertion zinciri ilerlemeli.
- Tam test paketi kayıt/yükleme ve 10 güvenli-fallback senaryosuyla geçmeli.