# RCA — Görüşme renderı yazım-erteleme seçeneğini yok sayıyor

## 1) Verdict

- **Root cause:** storyConversationWorkspaceRender seçenek parametresi kabul etmiyor; harness ve LLM yerleşme akışının kullandığı deferWhileTyping isteği fonksiyona ulaşsa bile yok sayılıyor.
- **Confidence:** Confirmed.
- Fonksiyon taslağı yeniden oluşturup değeri ve odağı geri yüklüyor, fakat DOM düğümünü korumuyor ve pendingConversationRender bayrağını başta siliyor.

## 2) Failure Definition

- Beklenen: Oyuncu dolu bir sohbet editöründe yazarken ertelenebilir render çağrısı mevcut DOMu değiştirmemeli ve bekleyen yenileme bayrağı koymalı.
- Gerçek: Render options almıyor, main.innerHTML yeniden yazılıyor, eski textarea kopuyor ve pending bayrağı siliniyor.
- Etki: LLM cevabı geldiğinde oyuncunun aktif yazım yüzeyi yenileniyor; değer geri konabilse bile IME, seçim, undo zinciri ve düğüm kimliği bozuluyor.
- Blast radius: deferWhileTyping isteyen görüşme yenilemeleri; normal açık renderlar ve patchResponse yolu kapsam dışında.

## 3) Evidence

- Sıralı assertion draftDeferredWithoutReplacement=false verdi.
- Harness storyConversationWorkspaceRender({ scroll: preserve, deferWhileTyping: true }) çağırıyor.
- Ürün fonksiyon imzası parametresiz.
- Fonksiyon 1926 satırında pending bayrağını siliyor, 1955 satırında main.innerHTML yazıyor.
- Değer/odak restorasyonu yeni düğüm üzerinde çalışıyor; eski düğüm eşitliği korunmuyor.

## 4) Hypotheses

1. **deferWhileTyping seçeneği uygulanmıyor.** Supported: fonksiyon parametresiz ve koşullu erken dönüş yok.
2. **Taslak metni kayboluyor.** Refuted: draftSurvivedRerender ölçümü true; sorun değer değil düğüm yaşam döngüsü.
3. **ResponseSettled hiçbir erteleme yapmıyor.** Refuted: bu fonksiyon dolu editörde bayrak koyup dönüyor; eksik olan doğrudan render sözleşmesi.
4. **Odak selectorü hâlâ yanlış.** Refuted: workspaceFocusSafe ve draftSurvivedRerender artık true.

## 5) Mechanism

1. Aktif dolu textarea varken render deferWhileTyping seçeneğiyle çağrılır.
2. Parametre yok sayılır ve pending bayrağı silinir.
3. main.innerHTML bütün konuşma gövdesini yeniden oluşturur.
4. Değer ve seçim yeni textarea üzerine geri yazılır.
5. Görsel metin korunmuş görünse de DOM kimliği ve ertelenmiş render sözleşmesi kaybolur.

## 6) Remediation

- Render fonksiyonuna options parametresi ekle ve yalnız nesne seçenekleri kabul et.
- Aktif korumalı editörde boş olmayan değer ve deferWhileTyping=true olduğunda pendingConversationRender=1 yazıp DOM mutasyonundan önce dön.
- Normal render başlangıcında pending bayrağını temizlemeye devam et.
- Mevcut değer/odak restorasyonunu zorunlu renderlar için koru.

## 7) Verification Plan

- draftDeferredWithoutReplacement true olmalı.
- draftSurvivedRerender ve workspaceFocusSafe true kalmalı.
- Hedefli conversationUnderstandingProbe tamamlanmalı.
- Sıralı assertion ve tam npm test paketi geçmeli.