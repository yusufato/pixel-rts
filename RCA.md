# RCA — Faz 38.4 laboratuvar testi geri alınmış canlı NLU adaptörlerini bekliyor

## Verdict

- **Root cause:** On Faz 38.4 senaryo ağacı ve doğrudan karar matrisi kalıcıdır; fakat onları canlı `StoryConversationUnderstanding` hattına bağlayan özel NLU dilimi 12 Ağustos çalışma zamanı geri dönüşünde commitlenmedi ve yalnız problemli sohbet stash'inde kaldı. Buna rağmen `dialogueScenarioLabProbe` canlı analizden on özel speech-act, varlık ve `SCENARIO_LAB_ONLY` oturumunu hâlâ koşulsuz bekliyor.
- **Confidence:** Confirmed.
- **Impact:** Doğrudan laboratuvar bütün dalları deterministik ve güvenli sınarken güncel genel semantik motor tahıl, grev, ihale, seferberlik ve diğer örnekleri dürüstçe genel/çözümlenmemiş istek olarak bırakıyor; bayat entegrasyon assertionları tam kabul paketini yanlış negatif durduruyor.

## Evidence

- Korunan sonuçta on canlı entegrasyon dalının özel `*Act`, intent/request/check ve `SCENARIO_LAB_ONLY` alanları birlikte `false`; analizler yine geçerli, dünya nötr ve ham ticaret okumuyor.
- Git geçmişinde `PROPOSE_LOGISTICS_REDIRECT` hiçbir commitli `StoryConversationUnderstanding.js` sürümünde yok; özel kurallar yalnız `stash@{1}` içinde bulunuyor.
- `4fb397e` senaryo laboratuvarı/testlerini eklerken commit mesajında runtime'ı Faz 38.1'e dondurdu; dosya durumunda `StoryConversationUnderstanding.js` değişikliği yok.
- Güncel durum belgesi geri dönüşü ve ardından yalnız temiz günlük sosyal Faz 38.4 dikeyini açıkça kaydediyor. Eski stash tümden geri alınmamalı.
- Doğrudan `story-dialogue-scenario-lab.js` matrisi beklenen yanıtları, doğruluk ayrımını, yetki kapılarını ve `worldMutation:false` sınırını ayrı olarak ölçmeye devam ediyor.

## Ranked Hypotheses

1. **Canlı özel NLU entegrasyonu rollback sırasında kayboldu, test kaldı — Confirmed.** Kaynak git geçmişinde yok, stash'te var ve bütün özel dallar aynı anda düşüyor.
2. **Tahıl eşanlamlısı veya tek sınıflandırma ağırlığı bozuk — Refuted.** Grevden darbeye on bağımsız özel sınıfın tamamı yok; sorun tek sözcük/ağırlık değil.
3. **Senaryo karar laboratuvarı bozuldu — Refuted.** Doğrudan matris sonuçları beklenen, deterministik, doğrulanmış ve dünya nötr.
4. **Eski stash'i tümden geri almak güvenli çözüm — Refuted.** Stash güncel semantik/anlamsal devamlılık motorundan binlerce satır sapıyor ve çözülemeyen DOM/LLM reset deneylerini taşıyor.

## Remediation

- Doğrudan on senaryo karar matrisi kabul kapılarını koru.
- Canlı NLU entegrasyon bölümünü “uygulanmış başarı” kapısından çıkar; güncel genel motorun geçerli, dünya-nötr, ham defter okumayan ve özel mekanik sonuç uydurmayan güvenli fallback'ini ölç.
- Ana plan/durum belgesinde özel senaryo NLU bağlarını açık entegrasyon borcu olarak düzelt; geçmiş başarı iddiasını geri dönüş sonrası canlı durumdan ayır.
- Gelecekte entegrasyonu eski kalıp listesini kopyalayarak değil, güncel bileşimsel semantic-frame/domain adapter mimarisine ayrı planla kur.

## Verification

- Yenilenen prob on doğrudan senaryo matrisini aynı kapsamda doğrulamalı.
- Canlı fallback analizlerinin tamamı geçerli ve dünya nötr olmalı; `proposedCommand` üretmemeli, ham ticaret okumamalı ve bilinmeyen kanonik kimlik uydurmamalı.
- Korunan 88 görev sonucu assertion zinciri yeniden çalışmalı; ardından temiz tam paket sıfır koduyla tamamlanmalı.
