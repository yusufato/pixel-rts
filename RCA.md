# RCA — Görüşme rerenderı aktif takip editörünü DOMdan koparıyor

## 1) Verdict

- **Root cause:** storyConversationWorkspaceRender, ana görüşme sütununu innerHTML ile yeniden kurmadan önce aktif editör durumunu yakalamıyor ve sonrasında geri yüklemiyor.
- **Confidence:** Confirmed.
- Bellek içi ölçümde takip textarea DOMda mevcut olduğu halde zorunlu render sonrasında document.activeElement BODY oldu.

## 2) Failure Definition

- Beklenen: LLM veya periyodik UI yenilemesi sırasında aktif takip editörü, taslak metni, seçim aralığı ve kendi scroll konumu korunmalı.
- Gerçek: main.innerHTML eski textarea düğümünü kaldırıyor; tarayıcı odağı BODYye düşürüyor.
- Etki: Oyuncu yazarken odak ve taslak kaybı, ilk harften sonra yazamama veya mesajı sıfırlama hissi oluşabilir.
- Blast radius görüşme workspace içindeki yeniden render edilen tüm metin editörleridir.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| Açılış focus düzeltmesi | Follow-up selector adaylara eklendi | Talks.js focusTarget |
| Zorunlu render | Harness açılıştan sonra workspace render çağırdı | story-sim-harness |
| Bellek ölçümü | hasFollowUp=true fakat activeElement=BODY | Araçlandırılmış prob |

## 4) Hypotheses (ranked)

1. **innerHTML replacement aktif editörü koparıyor.** Supported: render üç sütunu yeniden yazar ve hiçbir focus restore kodu yok.
2. **Açılış selectorü tek kök nedendi.** Refuted: selector düzeltmesinden sonra hata aynı kaldı; zorunlu render sonrasında BODY ölçüldü.
3. **Textarea DOMda yok.** Refuted: aynı anda hasFollowUp=true ve tam textarea HTMLsi mevcut.
4. **jsdom focus arızası.** Refuted: render öncesi focus ve sonraki doğrudan focus işlemleri çalışıyor.

## 5) Mechanism

1. Workspace açılışı takip textarea alanına focus verir.
2. Sonraki UI yenilemesi main.innerHTML atar.
3. Aktif textarea eski DOM ağacıyla birlikte kaldırılır.
4. Tarayıcı activeElement değerini BODYye çeker.
5. Render yeni textarea üretir fakat değer, seçim, scroll ve focus geri verilmez.
- Root cause durum korumasız DOM replacement; contributing factor render options parametresinin fiilen kullanılmaması; detection failure yalnız açılış focusunun test edilip ikinci render sınırının geçmişte ayrı ölçülmemesidir.

## 6) Remediation Options

### Mitigation

- LLM sırasında tüm renderları kapatmak cevapların görünmesini geciktirir ve diğer UI güncellemelerini bozar; tek başına yeterli değil.

### Fix

- Render öncesi aktif korumalı editörün selector, value, selectionStart, selectionEnd ve scrollTop değerlerini yakala.
- DOM yenilendikten sonra eşdeğer editöre bu durumu ve focusu geri ver.
- Editör aktif değilse hiçbir otomatik focus uygulama.

### Prevention

- Her innerHTML tabanlı form renderında focus ve draft round-trip testi zorunlu olsun.
- Açılış focusu ile rerender focusunu ayrı kapılar olarak koru.

## 7) Verification Plan

- workspaceFocusSafe=true olmalı.
- draftSurvivedRerender=true ve selection aralığı korunmalı.
- draftDeferredWithoutReplacement kapısı çalışmalı.
- Yeni konuşma ve toplantı editörleri regresyona uğramamalı.
- Sequential ve tam test paketi geçmeli.