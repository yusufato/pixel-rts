# RCA — Genel yardım takip sözü grounded discourse dalına bağlanmıyor

## 1) Verdict

- **Root cause:** storyConversationGroundedFollowUp askerî destek ve eylem isteğini ele alıyor, fakat genel REQUEST_SUPPORT için CONTINUE_REQUEST dalı yok; doğru tanınan yardım sözü profil fallbackine düşüyor.
- **Confidence:** Confirmed.
- Ek olarak harness, motorun 12 Ağustosta değişen güncel kaynak etiketi DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE yerine kaldırılmış DETERMINISTIC_DISCOURSE_RESPONSE değerini bekliyor.

## 2) Failure Definition

- Beklenen: “evet, bana yardım edecek misin” aynı check-in görüşmesinde yardım isteği olarak anlaşılmalı, kapsam/yetki sınırıyla doğrudan cevaplanmalı ve tekrarında yeni bir onarım cevabı üretmeli.
- Gerçek: NLU speechAct REQUEST_SUPPORT doğru; grounded fonksiyon null döndürüyor; cevap CHARACTER_PROFILE_SOCIAL_FOLLOW_UP ve discourseAct boş.
- Etki: Sistem takip bağlamında niyeti tanısa bile genel bot benzeri kalıba düşüyor; tekrar yönetimi çalışmıyor.
- Blast radius askerî olmayan genel yardım/destek takip sorularıdır.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| Doğrudan laboratuvar | CONTINUE_REQUEST ve tekrar onarımı beklendi | 4fb397e harness |
| Grounded kaynak ayrımı | Kaynak etiketi DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE oldu | f29215b source |
| Güncel prob | helpFollowUpUnderstood=false, repeatedHelpVaries=false | conversationUnderstandingProbe |

## 4) Hypotheses (ranked)

1. **Genel REQUEST_SUPPORT grounded dalı eksik.** Supported: analiz doğru, fonksiyon yalnız latestThreat varsa destek dalına giriyor.
2. **NLU yardım cümlesini tanımıyor.** Refuted: followUp.analysis.speechAct REQUEST_SUPPORT.
3. **Test yalnız eski source etiketi yüzünden düşüyor.** Partially supported: etiket bayat; fakat gerçek response discourseAct de boş ve metin beklenen yardım talebi sözleşmesini karşılamıyor.
4. **LLM gecikmesi davranışı düzeltecek.** Refuted: güvenli deterministik cevap anında doğru işlevi vermeli; gerçek model bulunmasa da fallback çalışmalı.

## 5) Mechanism

1. NLU yardım cümlesini REQUEST_SUPPORT olarak sınıflandırır.
2. Grounded fonksiyon askerî tehdit bulamaz ve genel destek dalı olmadığı için null döner.
3. Follow-up üretici profil sosyal kalıbını kullanır.
4. Discourse act boş kalır; aynı cümlenin tekrarı grounded eşitlik onarımına giremez.
5. Harness ayrıca artık üretilmeyen eski source etiketini arar.
- Root cause eksik genel destek dalı; contributing factor source etiketi drift etmiş test; detection failure açılış yardım testinin takip konuşması işlevini temsil etmemesidir.

## 6) Remediation Options

### Mitigation

- Yalnız testte profile source kabul etmek bot benzeri fallbacki kalıcılaştırır; uygulanmamalı.

### Fix

- Genel REQUEST_SUPPORT için CONTINUE_REQUEST grounded cevabı ekle; yardım talebini, kapsamı ve yetki sınırını açıkla, uygulama sözü verme.
- İkinci aynı grounded cevap mevcut listenerResponses ile eşleşince mevcut REPAIR_REPETITION mekanizması çalışsın.
- Harness source kontrollerini güncel DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE etiketiyle eşleştir.

### Prevention

- Her sosyal speech act için açılış ve aynı-oturum takip kapısını ayrı tut.
- Kaynak etiketi değişiminde doğrudan laboratuvar manifestini birlikte güncelle.

## 7) Verification Plan

- helpFollowUpUnderstood ve repeatedHelpVaries true olmalı.
- İlk cevap CONTINUE_REQUEST, ikinci cevap REPAIR_REPETITION olmalı.
- Hiçbir cevap dünya komutu veya yardım taahhüdü üretmemeli.
- Sequential ve tam test paketi geçmeli.