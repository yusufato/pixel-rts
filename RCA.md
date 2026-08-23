# RCA — Söz hafızası takip probu sosyal olmayan oturumda follow-up çağırıyor

## 1) Verdict

- **Root cause:** Prob sonraki görüşmeyi `Söz veriyorum...` cümlesiyle açıyor. Bu cümle `MAKE_PROMISE / READY_FOR_REVIEW` üretir; `conversationSessionFollowUp` ise yalnız `SOCIAL_RESPONSE_READY` oturumlarda çalışır.
- **Confidence:** Confirmed.
- Hafıza kayıtları doğrudan recall kapısında KEPT ve BROKEN olarak bulunuyor; arıza hafıza depolamada değil oturum türünde.

## 2) Failure Definition

- Beklenen: Karakter sonraki sosyal görüşmede kendi tuttuğu söz sonuçlarını hatırlamalı.
- Gerçek fikstür: Yeni görüşme mekanik söz eylemiyle açılıyor ve sosyal cevap oluşturmuyor.
- İzole ölçüm: söz cümlesi `READY_FOR_REVIEW`, selam/önceki sözler açılışı `SOCIAL_RESPONSE_READY`.
- Blast radius yalnız `promiseRecallInLaterConversation` alt ölçümüdür.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| Önceki UI testi | WASD ve serbest metin için söz cümlesi seçildi | Harness satır 16789 |
| Hafıza testi eklendi | Aynı yeni oturum follow-up için yeniden kullanıldı | Harness satır 16797 |
| 23 Ağustos 2026 | Durum kapıları geçince takip hatası görünür oldu | Sequential assertion |

## 4) Hypotheses (ranked)

1. **Takip yanlış oturum türünde çağrılıyor.** Supported: izole runtime söz açılışını `READY_FOR_REVIEW`, sosyal açılışı `SOCIAL_RESPONSE_READY` üretti.
2. **KEPT/BROKEN hafıza kayıtları yok.** Refuted: `promiseMemoryResolved` ve `promiseRecallLongHorizon` true.
3. **WASD girdi engeli mesajı bozuyor.** Refuted: `wasdTypingSafe` ayrı klavye olaylarıyla ölçülüyor; oturum sınıfını konuşma analizi belirliyor.

## 5) Mechanism

1. DOM yeni konuşma açar ve söz cümlesini gönderir.
2. NLU bunu MAKE_PROMISE olarak sınıflandırır.
3. Sosyal cevap kurulmadığı için durum READY_FOR_REVIEW olur.
4. Follow-up API güvenlik sözleşmesi gereği FOLLOW_UP_NOT_AVAILABLE döndürür.
5. Var olan hafıza cevaba hiç ulaşamaz.
- Root cause yanlış fikstür açılışı; contributing factor tek oturumun UI yazma ve hafıza amaçları için paylaşılması; detection failure follow-up öncesi durum assertionı olmamasıdır.

## 6) Remediation Options

### Mitigation

- Follow-up APIyi mekanik oturumlara açmak güvenlik sınırını gevşetir ve uygulanmamalı.

### Fix

- Yeni oturumu doğal sosyal açılışla başlat; DOM saklama kontrolünü bu metne bağla. WASD keydown kontrolü ayrı kalır.

### Prevention

- Hafıza follow-up fikstüründe `uiSession.status === SOCIAL_RESPONSE_READY` önkoşulunu ayrı tanı alanıyla doğrulamak arızayı yerinde gösterir.

## 7) Verification Plan

- Yeni UI oturumu sosyal hazır olmalı ve DOM metni kalıcı oturuma alınmalı.
- Follow-up `CHARACTER_HELD_MEMORY_RECALL` üretmeli; ham dünya okumamalı.
- Cevap hem KEPT hem BROKEN kaynaklı kaydı taşımalı.
- WASD güvenlik kapısı, sequential zincir ve temiz tam test geçmeli.
