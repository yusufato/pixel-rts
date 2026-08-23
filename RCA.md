# RCA — Kurumsal istifa oyuncu makbuzu kanonik defter sahibini belirtmiyor

## 1) Verdict

- **Root cause:** `INSTITUTIONS/RESIGN_OFFICE` bağlayıcısı fiziksel `domainReceipt` nesnesini doğrudan oyuncu makbuzu yapıyor; bu nesne `ledger` alanı taşımıyor.
- **Confidence:** Confirmed.
- İstifa ve halefiyet uygulanıyor, ancak 18-aile ortak izlenebilirlik sözleşmesi defter sahibini çıkaramıyor.

## 2) Failure Definition

- Beklenen: Her başarılı aile makbuzu gerçek domain defterini adlandırmalı.
- Gerçek: İstifa makbuzu `physicalMutation=true` taşıyor fakat `canonicalReceipt.ledger` boş.
- Etki: UI/QA bir kurumsal mutasyonun kaynağını ortak biçimde denetleyemiyor.

## 3) Evidence

- 18-aile kabul testi yalnız `INSTITUTIONS` için “canonical domain ledger missing” verdi.
- Makbuzda geçerli `transitionId`, `institutionId`, predecessor/successor ve `physicalMutation` alanları mevcut.

## 4) Hypotheses

1. **Bağlayıcı domain makbuzunu ortak zarf olmadan geçiriyor.** Supported.
2. **İstifa fiziksel olarak uygulanmadı.** Refuted: halefiyet ve makam geçiş kimliği mevcut.
3. **Character action defteri yok.** Refuted: kaynak makbuz `storyCharacterActionExecutePlayer` tarafından üretiliyor.

## 5) Remediation

- Domain makbuzunu `ledger: characterActions` alanıyla ortak kanonik zarfa al; fiziksel alanları koru.

## 6) Verification Plan

- 18 ailenin tamamı `canonicalReceipt.ledger` taşımalı.
- İstifa makbuzu halefiyet ve `physicalMutation=true` alanlarını korumalı.