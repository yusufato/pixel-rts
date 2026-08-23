# RCA — Görüşme açılış odağı takip editörünü seçmiyor

## 1) Verdict

- **Root cause:** storyConversationWorkspaceOpen içindeki focus selector, mevcut oturumun data-conversation-follow-up editörünü hiç içermiyor ve eşleşen ilk öğe olarak Yeni Konuşma düğmesine düşüyor.
- **Confidence:** Confirmed.
- Harness mevcut bir session kimliğiyle workspace açıyor; DOMda takip editörü varken activeElement kabul edilen editörlerden biri değil.

## 2) Failure Definition

- Beklenen: Mevcut konuşma açıldığında oyuncu doğrudan takip mesajı yazabilmeli.
- Gerçek: Açılış odağı takip editörü yerine data-conversation-new düğmesine gidiyor.
- Etki: Oyuncu yazmaya başlayınca metin alanına giriş yapılmıyor; klavye akışı kırılıyor.
- Blast radius mevcut oturumla açılan karakter görüşmeleridir; yeni boş konuşma akışı etkilenmez.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| Workspace focus eklendi | Selector yeni konuşma ve bazı form alanlarını kapsadı | Talks.js focusTarget |
| Takip editörü UIya eklendi | data-conversation-follow-up mevcut oturumun ana girdisi oldu | Talks.js render ve harness |
| Güncel prob | workspaceFocusSafe=false | conversationUnderstandingProbe |

## 4) Hypotheses (ranked)

1. **Selector takip editörünü atlıyor.** Supported: selector metninde follow-up yok, sonunda conversation-new var.
2. **DOM takip editörünü üretmiyor.** Refuted: hemen sonraki harness sorgusu bu öğeyi bulup taslak testi yapıyor.
3. **jsdom focus desteklemiyor.** Refuted: aynı prob diğer textarea focus ve selection işlemlerini ölçüyor.

## 5) Mechanism

1. Mevcut session ile workspace render edilir.
2. querySelector sıralı adaylarda follow-up olmadığı için editörü görmez.
3. DOMdaki Yeni Konuşma düğmesi eşleşir ve focus alır.
4. Kullanıcı giriş odağı yanlış kontrol üzerinde kalır.
- Root cause eksik selector; contributing factor yeni ve mevcut konuşmanın tek selectorla ele alınması; detection failure takip editörü eklendiğinde focus sözleşmesinin güncellenmemesidir.

## 6) Remediation Options

### Mitigation

- Odağı hiçbir yere vermemek düğme sorununu gizler ama klavye kullanımını yine bozar; uygulanmamalı.

### Fix

- data-conversation-follow-up öğesini data-conversation-new öncesinde focus adaylarına ekle.
- Yeni konuşmada follow-up yoksa mevcut data-conversation-input davranışı korunsun.

### Prevention

- Yeni giriş kontrolü eklendiğinde workspace açılış focus testini mevcut ve yeni oturum için ayrı çalıştır.

## 7) Verification Plan

- workspaceFocusSafe=true olmalı.
- Yeni konuşma input odağı korunmalı.
- Taslak rerender ve klavye güvenliği kapıları yeniden çalışmalı.
- Sequential ve tam test paketi geçmeli.