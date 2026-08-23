# RCA — Kalıcılık assertionı hedef cevaplar yerine bütün sosyal açılışları sayıyor

## 1) Verdict

- **Root cause:** Restore probu responseCount alanında ledgerdaki tüm SOCIAL_RESPONSE açılışlarını sayıyor; assertion bunu sekiz sosyal açılış artı dört bağlamsal takip yanıtı diye yorumlayıp 12ye eşitliyor. FOLLOW_UP_RESPONSE kayıtları sayaçta hiç yer almıyor.
- **Confidence:** Confirmed.

## 2) Failure Definition

- Beklenen: Sekiz temel sosyal açılış ve dört bağlamsal takip cevabının kimlikleri save/load sonrasında bulunmalı.
- Gerçek: Sayaç yalnız kind SOCIAL_RESPONSE satırlarını bütün retained sessionlarda sayıyor; genişleyen kalite fixturelarıyla 16 oldu.
- Etki: exact restore ve validation geçmesine rağmen ilgisiz oturum sayısı assertionı kırıyor.
- Blast radius: restored.responseCount metriği ve tek assertion.

## 3) Evidence

- restored.exact=true ve restored.validation.ok=true.
- responseCount filtresi yalnız row.kind === SOCIAL_RESPONSE.
- Assertion mesajı dört takip yanıtını da saydığını söylüyor; bu kayıtlar FOLLOW_UP_RESPONSE türünde.
- Güncel fixture ek oturumlar açtığı için sosyal açılış toplamı 16.

## 4) Remediation

- Ölçülmek istenen sekiz opening response ve dört contextual response kimliğini save öncesi sakla.
- Restore sonrası bu 12 kimliğin listenerResponses içinde bulunduğunu say.
- Bütün ledger açılışlarının sayısına sabit eşitlik kurma.
- exact ve validation kapılarını koru.

## 5) Verification Plan

- restored.keyResponseCount=12.
- restored.exact=true ve validation.ok=true.
- Fixturea başka oturum eklemek bu kapıyı bozmamalı.
- Sıralı ve tam paket geçmeli.