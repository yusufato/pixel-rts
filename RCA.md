# RCA — Kariyer yaşam döngüsü probu test kapsamına alınmamış

## 1) Verdict

- **Root cause:** `f2e3ad8` commit'i `probeCharacterCareerLifecycle` çağrısını ana assertion dosyasına ekledi fakat aynı sembolü `story-sim-harness` destructuring import listesine eklemedi.
- **Confidence:** Confirmed.
- **Zincir:** Eksik destructuring import → yerel değişken tanımsız → korunan sonuç okunmadan `ReferenceError` → assertion zinciri duruyor.
- Hata devam ediyor; yalnız test giriş noktasını etkiliyor, probun kendisi ve paralel manifest görevi mevcut.

## 2) Failure Definition

- Kesin semptom: `tests/story-world.test.js:3975` satırı `probeCharacterCareerLifecycle is not defined` ile çıkış kodu `1` verdi.
- Reproduction: Korunan 88 görev sonucuyla sequential assertion komutunda `1/1`.
- Blast radius: `tests/story-world.test.js` doğrudan/sequential çalıştırması. Paralel üretici manifest sembol adını `tools/story-sim-harness.js` ihracından çözdüğü için prob çıktısını üretebiliyor.
- İlk oluşum: Git geçmişinde çağrıyı ekleyen `f2e3ad8` commit'i; bu koşuda önceki Faz 38.4 assertionı kaldırılınca ilk kez görünür oldu.

## 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 12 Ağustos 2026 | Kariyer yaşam döngüsü probu, manifest kaydı ve assertion çağrısı eklendi | `f2e3ad8` | Test dosyasındaki import listesi güncellenmedi |
| 23 Ağustos 2026 | Faz 38.4 bayat canlı-NLU assertionı geçildi | Korunan 88 görev assertion koşusu | Daha sonraki test kodu ilk kez çalıştı |
| 23 Ağustos 2026 | `ReferenceError` deterministik üretildi | Node stack trace | Eksik sembol bağının doğrudan kanıtı |

## 4) Hypotheses (ranked)

1. **Destructuring import eksik.**
   - Eğer doğruysa harness tanımı/ihracı bulunur, test import listesinde bulunmaz.
   - Ayırıcı test: üç konumu `rg` ile karşılaştır.
   - **Supported:** Tanım `tools/story-sim-harness.js:15755`, ihracat `:18966`, manifest kaydı `tools/story-test-manifest.js:90`; test import listesinde sembol yok.
2. **Prob fonksiyonu yeniden adlandırıldı veya silindi.**
   - Eğer doğruysa harness tanımı/ihracı bulunmaz veya farklı ad taşır.
   - Ayırıcı test: tam sembol araması.
   - **Refuted:** Tanım ve ihracat aynı adla mevcut.
3. **Korunan paralel sonuç eksik olduğu için yanlış hata yüzeye çıktı.**
   - Eğer doğruysa `storyTestResult` eksik sonuç hatası vermeli, JavaScript isim çözümlemesi geçmeli.
   - Ayırıcı test: stack trace aşaması ve manifest kaydı.
   - **Refuted:** JavaScript argümanı değerlendirilirken `storyTestResult` çağrısından önce `ReferenceError` oluşuyor; manifest görevi mevcut.

## 5) Mechanism

1. `f2e3ad8`, `tests/story-world.test.js` içine `probeCharacterCareerLifecycle` değişkenini kullanan çağrı ekledi.
2. Aynı commit probu harness içinde tanımlayıp dışa aktardı ve paralel manifeste kaydetti.
3. Test dosyasının üstündeki destructuring import listesi `probeCharacterPower` sonrasında bu yeni sembolü almadı.
4. Node, `run()` içinde argüman değerlendirmesinde tanımsız yerel isme ulaştı ve sonuç dosyasını okumadan durdu.
- **Root cause:** Eksik test importu.
- **Contributing factor:** Paralel manifest probu isimle doğrudan harness ihracından çağırdığı için o yol yeşil kalabildi.
- **Detection failure:** Commit kabulünde sequential assertion yolu çalıştırılmadı veya daha erken Faz 38.4 başarısızlığı bu satıra ulaşmayı engelledi.
- En zayıf bağ yok; sembol konumları ve stack doğrudan kanıttır.

## 6) Remediation Options

### Mitigation
- **Title:** Korunan sonuç assertionını geçici olarak atlama
- **Category:** Test yürütme
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `tests/story-world.test.js:3974`
- **Evidence:** Hata bu çağrıda duruyor.
- **Why it matters:** Sonraki assertionları görünür yapar.
- **Recommended fix:** Uygulanmamalı; test kapsamını azaltır.
- **Tradeoffs / Risks:** Kariyer yaşam döngüsü regresyonlarını gizler.

### Fix
- **Title:** Eksik harness ihracını test import listesine bağla
- **Category:** Test sözleşmesi
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `tests/story-world.test.js` destructuring import listesi
- **Evidence:** Aynı sembol harness tanımı, ihracı ve manifestte var.
- **Why it matters:** Sequential assertion zincirini gerçek prob sonucuna ulaştırır.
- **Recommended fix:** `probeCharacterCareerLifecycle` öğesini `probeCharacterPower` yakınına ekle.
- **Tradeoffs / Risks:** Davranış değişmez; yalnız daha önce amaçlanan testi çalıştırır.

### Prevention
- **Title:** Manifestteki her fonksiyonun assertion girişinde bağlı olduğunu statik doğrula
- **Category:** Test altyapısı
- **Severity:** Medium
- **Confidence:** Likely
- **Location:** Test manifesti/giriş dosyası sözleşmesi
- **Evidence:** İki çağrı yolu farklı isim çözümleme mekanizması kullanıyor.
- **Why it matters:** Yeni prob eklenirken tek yolun yeşil kalmasını engeller.
- **Recommended fix:** Manifest fonksiyon adlarını harness ihracı ve test tüketicisiyle karşılaştıran hafif bir kapı tasarla.
- **Tradeoffs / Risks:** Bazı manifest görevlerinin yalnız manifestte tüketilmesi meşru olabilir; izin listesi gerekebilir.

## 7) Verification Plan

- `node --check tests/story-world.test.js` geçmeli.
- Korunan 88 görev sonucu ile sequential assertion tekrar çalışmalı ve kariyer probuna ulaşmalı.
- `characterCareerLifecycleProbe` tek görev üretimi ve gerekli true alanları ayrıca doğrulanmalı.
- Son tam `npm test` sıfır çıkış koduyla tamamlanmalı; yalnız hata mesajının kaybolması başarı sayılmamalı.
