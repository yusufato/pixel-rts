# RCA — Yabancı aktör test fikstürü sonraki UI eylemine sızıyor

## 1) Verdict

- **Root cause:** Diplomatik alt senaryo muhatabın `countryId` alanını yabancı ülkeye çevirdi fakat anayasal blok sonunda özgün değeri geri yüklemedi.
- **Confidence:** Confirmed.
- Sonraki PERSUADE eylemi başlangıçtaki aynı ülke temas/yetki bağlamını kaybetti ve anlaşma kaydı görünmedi.

## 2) Failure Definition

- Beklenen: Diplomatik fikstür yalnız sınır aşan review/protesto/anayasal zinciri etkilemeli.
- Gerçek: Kimlik mutasyonu runtime sonuna kadar sürdü; sonraki secret, UI ve karakter eylemi kontrollerine taşındı.
- İlk görünür sonuç `agreementVisible=false`.
- Blast radius aynı uzun probda diplomatik bloktan sonra aynı aktörü kullanan kontrollerdir.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| 23 Ağustos 2026 | Yabancı ülke önkoşulu eklendi | Harness değişikliği |
| Aynı koşu | Diplomatik/anayasal kapılar geçti | Sequential ilerleme |
| Aynı koşu | Sonraki agreement UI kapısı düştü | `agreementVisible=false` |

## 4) Hypotheses (ranked)

1. **Fikstür ülke mutasyonu kapsam dışına sızdı.** Supported: atama var, geri yükleme yok; agreement bundan sonra çalışıyor.
2. **PERSUADE motoru genel olarak bozuk.** Refuted: Aynı seed başlangıcında seçilen temas PERSUADE allowed; hata yalnız geç mutasyondan sonra.
3. **UI anlaşma bölümü render etmiyor.** Refuted: assertiona verilen `agreementReceipt` yabancı bağlam sonrası üretiliyor; önce eylem önkoşulu bozuluyor.

## 5) Mechanism

1. Listener kimliği test için yabancı ülkeye atanır.
2. Diplomatik ve anayasal işlemler tamamlanır.
3. Özgün ülke saklanmadığı/geri yüklenmediği için kimlik yabancı kalır.
4. Sonraki karakter eylemi eski temas bağlamıyla değerlendirilir.
5. Uygulanmış makbuz oluşmadığından UI kaydı görünmez.
- Root cause eksik fixture teardown; contributing factor tek uzun runtime; detection failure teardown assertionı olmamasıdır.

## 6) Remediation Options

### Mitigation

- Agreement assertionını kaldırmak kapsam kaybıdır ve uygulanmamalı.

### Fix

- Orijinal listener ülkesini mutasyondan önce sakla; diplomatik/anayasal snapshot alındıktan ve fixture state restore edildikten hemen sonra geri yükle.

### Prevention

- Geçici kimlik mutasyonları için try/finally veya açık setup/teardown yardımcıları kullan; teardown sonrası ülke eşitliği tanısı ekle.

## 7) Verification Plan

- Diplomatik ve anayasal kapılar true kalmalı.
- Teardown sonrası listener ülkesi özgün değere dönmeli.
- PERSUADE makbuzu uygulanmalı ve UI anlaşma kaydını göstermeli.
- Secret, hafıza, sequential ve temiz tam test zincirleri geçmeli.
