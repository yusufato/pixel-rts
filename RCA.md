# RCA — Virüllü focus selectorü aday önceliğini değil DOM sırasını kullanıyor

## 1) Verdict

- **Root cause:** Workspace açılışı farklı focus adaylarını tek virgüllü querySelector içinde veriyor; querySelector selector sırasına göre değil, eşleşen ilk DOM düğümüne göre sonuç döndürüyor.
- **Confidence:** Confirmed.
- Follow-up selector listeye eklendikten sonra bile render öncesi activeElement, DOMda textarea önünde bulunan Yeni Konuşma düğmesi olarak ölçüldü.

## 2) Failure Definition

- Beklenen: Giriş kontrolleri düğmeden öncelikli olmalı; mevcut konuşmada follow-up textarea seçilmeli.
- Gerçek: Tek birleşik sorgu DOM sırasındaki data-conversation-new düğmesini döndürüyor.
- Etki: Kullanıcı mevcut konuşmayı açınca yazı odağı yerine düğme odağı alıyor.
- Blast radius tüm birden fazla focus adayı render eden workspace modlarıdır.

## 3) Timeline

| Zaman | Olay | Kanıt |
|---|---|---|
| Focus selector | Adaylar virgüllü tek CSS sorgusunda toplandı | Talks.js |
| Follow-up eklendi | Selector metninde textarea düğmeden önce yazıldı | Güncel diff |
| Doğrudan ölçüm | Forced render öncesi activeElement Yeni Konuşma düğmesi | Bellek içi prob |

## 4) Hypotheses (ranked)

1. **Birleşik querySelector DOM sırasını seçiyor.** Supported: düğme HTMLde textarea önünde ve activeElement düğme.
2. **Selector listesindeki sıra öncelik sağlar.** Refuted: liste follow-up önce olsa da ölçüm düğmeyi seçti.
3. **Rerender ilk odağı bozuyor.** Partially supported: ikinci aşamada gerçek; fakat yeni ölçüm odağın rerenderdan önce de yanlış olduğunu gösterdi.
4. **Textarea focus kabul etmiyor.** Refuted: harness doğrudan focus verdiğinde textarea activeElement oluyor.

## 5) Mechanism

1. Modal DOMunda Yeni Konuşma düğmesi üstte, takip textarea aşağıdadır.
2. querySelector çoklu selectorlerin birleşim kümesini oluşturur.
3. Birleşim kümesindeki belge sırası ilk öğe düğmedir.
4. Açılış kodu düğmeye focus verir.
5. Sonraki render da düğümü değiştirerek odağı BODYye düşürür.
- Root cause CSS seçim semantiğinin öncelik sanılması; contributing factor giriş ve eylem düğmelerinin aynı birleşik sorguda olması; detection failure selector metin sırasının davranış sırası zannedilmesidir.

## 6) Remediation Options

### Mitigation

- Yeni Konuşma düğmesini DOM sonunda taşımak görsel yerleşimi davranış için bozar ve kırılgandır; uygulanmamalı.

### Fix

- Giriş kontrollerini ayrı querySelector çağrılarıyla açık ardışık öncelikte ara.
- Yalnız hiçbir editör yoksa Yeni Konuşma düğmesine fallback yap.
- Rerender editör durumu korumasını sürdür.

### Prevention

- Focus adaylarında virgüllü selector ile öncelik tanımlama.
- Testte açılış öncesi/sonrası activeElement türünü ayrı ölç.

## 7) Verification Plan

- Forced render öncesi activeElement follow-up textarea olmalı.
- workspaceFocusSafe ve draftSurvivedRerender true olmalı.
- Yeni taslakta conversation-input focus almalı.
- Editör bulunmayan görünümde düğme fallbacki çalışmalı.
- Sequential ve tam test paketi geçmeli.