# RCA — Genel çok katılımcılı oturum sol profilde tek kişiye düşüyor

## 1) Verdict

- **Root cause:** Workspace renderer yalnız FORMAL_MEETING ve meetingCaseId bulunan oturumlarda participant kartlarını çiziyor; oturum düzeyindeki participantActorIds listesini projekte etmiyor. ParticipantsHtml ayrıca her satırı doğrulanmış kamusal profil olarak etiketliyor ve bilinmeyen kimlik fallbacki yok.
- **Confidence:** Confirmed.

## 2) Failure Definition

- Beklenen: Bir oturum birden fazla katılımcı kimliği taşıyorsa sol sütun her kişiyi ayrı kartta göstermeli; directoryde bulunmayan kimlikler veri uydurmadan maskelenmeli.
- Gerçek: activeMeeting null olduğunda renderer doğrudan tek listener profiline dönüyor.
- Etki: Çok kişili görüşme UI’si toplantı adaptörü tamamlanmadan kullanılamıyor; bilinmeyen katılımcı ya görünmüyor ya da doğrulanmış sanılma riski taşıyor.
- Blast radius: Genel multi-party oturum önizlemesi ve bilinmeyen katılımcı güvenliği; canonical formal meeting görünümü korunmalı.

## 3) Evidence

- Fixture aktif sessiona üç participantActorIds ekliyor; renderer activeMeeting dışındaki bu alanı okumuyor.
- participantCards sayısı beklenen 3 yerine tek profil görünümü nedeniyle 0.
- storyTalkConversationParticipantsHtml her row için koşulsuz DOĞRULANMIŞ KAMUSAL PROFİL yazıyor.
- Contact directory bilinen ikinci katılımcıyı çözebiliyor; üçüncü kimlik directoryde yok.

## 4) Hypotheses

1. **Renderer yalnız meetingCase yolunu destekliyor.** Supported.
2. **İkinci karakter directoryde yok.** Refuted: fixture publicCharacters içinden seçiyor.
3. **Unknown kart CSS nedeniyle gizli.** Refuted: unknown için hiç row oluşturulmuyor.
4. **Toplantı motoru bozuk.** Refuted: hata formal meeting oluşturmadan kullanılan genel participant projectionında.

## 5) Remediation

- activeMeeting yokken ve session participantActorIds birden fazlayken salt-okunur participant preview oluştur.
- Bilinen kimlikleri contact directory kamusal alanlarıyla doldur.
- Bilinmeyen kimliği Bilinmeyen katılımcı, Bilinmiyor ve KİMLİK DOĞRULANMADI etiketleriyle göster.
- Formal meeting geldiğinde canonical meeting participants öncelikli kalmalı.
- UI projectionı ledgerı veya dünyayı değiştirmemeli.

## 6) Verification Plan

- Üç participant kartı görünmeli ve bilinen ikinci actorId ayrı kartta olmalı.
- Unknown kart güvenli üç etiketi taşımalı.
- Formal meeting UI testleri ve ledger validation geçmeli.
- Sıralı ve tam test paketi geçmeli.