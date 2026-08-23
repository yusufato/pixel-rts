# RCA — Sequential hikâye testi altı harness probunu import etmiyor

## 1) Verdict

- **Root cause:** Faz 38.10–38.11 ve hex dünya commitleri altı prob çağrısını `tests/story-world.test.js` gövdesine ekledi fakat bu sembolleri dosyanın `story-sim-harness` destructuring import listesine hiç eklemedi.
- **Confidence:** Confirmed.
- **Zincir:** Prob çağrısı var + yerel import yok → ilk ulaşılan eksik sembolde `ReferenceError` → sequential kabul zinciri sonraki sonuçları okuyamıyor.
- Hata devam ediyor; eksik küme statik olarak tam çıkarıldı.

## 2) Failure Definition

- İlk görünen hata `probeCharacterLifeStatus is not defined` (`tests/story-world.test.js:3997`).
- Statik tüketici/import farkı şu altı eksik sembolü verdi: `probeCharacterLifeStatus`, `probeCharacterCohortActivation`, `probeCharacterCohortPromotion`, `probeCharacterActivationBudget`, `probeHexUrban`, `probeHexRender`.
- Reproduction: Korunan 88 görev sonucu ile sequential assertion komutunda `1/1`; önceki kariyer importu eklendikten sonra bir sonraki eksik sembolde deterministik durdu.
- Blast radius: Ana sequential story assertion giriş noktası. Paralel manifest üretimi harness ihracını doğrudan çözdüğü için ayrı görevler üretilebilir.
- İlk oluşumlar: 12 Ağustos karakter commitleri (`47f89d6`, `7c12721`, `cb175db`, `f2db519`) ve 19 Ağustos hex commit'i (`8697268`).

## 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 12 Ağustos 2026 | Dört karakter probu assertion gövdesine eklendi | Git blame | Import listesi güncellenmedi |
| 19 Ağustos 2026 | Hex urban/render probları assertion gövdesine eklendi | `8697268` | Aynı eksik bağ kalıbı tekrarlandı |
| 23 Ağustos 2026 | Kariyer importu düzeltildi; sonraki sembol çöktü | Sequential stack | Sorunun tek sembol değil küme olduğu görüldü |
| 23 Ağustos 2026 | Kullanım/import statik farkı çıkarıldı | PowerShell regex taraması | Eksik küme altı sembolle sınırlandı |

## 4) Hypotheses (ranked)

1. **Birden fazla prob çağrısı destructuring importta eksik.**
   - Beklenti: Kullanım/import farkı birden fazla ad verir; her biri harness tanımı/ihracı ve manifest kaydı taşır.
   - Ayırıcı test: Test gövdesindeki `probe*` kullanımlarını import bloğuyla küme farkı olarak karşılaştır.
   - **Supported:** Tam altı sembol bulundu; hepsinin harness ve manifest karşılığı mevcut.
2. **Yalnız `probeCharacterLifeStatus` eksik.**
   - Beklenti: Statik fark tek ad olmalı.
   - Ayırıcı test: Aynı küme farkı.
   - **Refuted:** Beş ek eksik sembol daha bulundu.
3. **Harness ihracı veya manifest kayıtları eksik.**
   - Beklenti: Eksik adlardan bazıları tanımsız/ihraçsız olmalı.
   - Ayırıcı test: Harness ve manifestte tam sembol araması.
   - **Refuted:** Altı sembol de tanımlı, dışa aktarılmış ve manifestte kayıtlı.

## 5) Mechanism

1. Her özellik commit'i yeni probu, manifest görevini ve ana test assertionlarını ekledi.
2. Ana test dosyasının elle tutulan uzun destructuring import listesi aynı commitlerde güncellenmedi.
3. Paralel koşucu fonksiyon adını manifestten harness ihracına çözdüğü için görev üretimi bu eksik tüketici bağını sınamadı.
4. Sequential dosya daha önce erken assertionlarda durduğu için daha aşağıdaki tanımsız semboller görünmedi.
5. İlk import eklenince yürütme bir sonraki eksik isimde durdu; statik fark taraması tüm kümeyi görünür yaptı.
- **Root cause:** Elle senkronlanan ikinci tüketici import listesinin eksikliği.
- **Contributing factor:** Paralel ve sequential yolların farklı isim çözümlemesi.
- **Detection failure:** Manifest↔harness↔sequential tüketici sembol bütünlüğü için statik kapı yok.

## 6) Remediation Options

### Mitigation
- **Title:** Eksik prob assertionlarını atla
- **Category:** Test yürütme
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `tests/story-world.test.js`
- **Evidence:** Her hata assertion çağrısına ulaşınca oluşuyor.
- **Why it matters:** Zinciri ilerletir ama gerçek regresyon kapsamını kaldırır.
- **Recommended fix:** Uygulanmamalı.
- **Tradeoffs / Risks:** Altı özellik ailesinin kabul kanıtını gizler.

### Fix
- **Title:** Altı mevcut harness probunu sequential tüketiciye import et
- **Category:** Test sözleşmesi
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `tests/story-world.test.js` import listesi
- **Evidence:** Bütün tanım/ihracat/manifest kayıtları mevcut.
- **Why it matters:** Tasarlanmış assertionların gerçek sonuçları okumasını sağlar.
- **Recommended fix:** Altı sembolü ilgili karakter/hex import kümelerine ekle.
- **Tradeoffs / Risks:** Oyun davranışı değişmez; daha önce erişilemeyen testler çalışacağı için yeni gerçek hatalar görünür olabilir.

### Prevention
- **Title:** Kullanılan bütün `probe*` sembollerinin bağlı olduğunu statik kapıyla doğrula
- **Category:** Test altyapısı
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** Story test ön-kontrolü
- **Evidence:** Küme farkı mevcut altı açığı deterministik buldu.
- **Why it matters:** Yeni prob commitinde yalnız paralel yolun yeşil kalmasını engeller.
- **Recommended fix:** Ana testin kullanılan prob adları ile import bloğunu karşılaştıran kontrol ekle veya tek kayıt kaynağından tüketici üret.
- **Tradeoffs / Risks:** Yalnız yorum/metin içindeki adların yanlış pozitif olmaması için AST ya da dar sözdizimi eşlemesi gerekir.

## 7) Verification Plan

- Statik kullanım/import farkı boş dönmeli.
- Altı hedefli manifest görevi ayrı ayrı çıkış `0` vermeli.
- Korunan 88 görev sequential assertion zinciri bu bölümü geçmeli.
- Son temiz `npm test` sıfır çıkış koduyla tamamlanmalı.
