# RCA — Oyuncu eylem görünümü yönetim görünümünü özyinelemeli çağırıyor

## 1) Verdict

- **Root cause:** `storyGovernancePlayerView()` 18 sistem ailesini üretirken `storyPlayerAgencyFamilyView()` çağırıyor; MARKET, PRODUCTION ve LABOR önizlemelerinin ortak `storyPlayerAgencyRegionId()` yardımcısı yeniden `storyGovernancePlayerView()` çağırıyor.
- **Confidence:** Confirmed.
- Sonuç, ilk gerçek yürütme rolü önizlemesinde `Maximum call stack size exceeded` ile tam ekran çökmesidir.

## 2) Failure Definition

- Beklenen: Yönetim görünümü 18 aileyi tek geçişte üretmeli ve seçili bölgeyi yan etkisiz okumalı.
- Gerçek: Yönetim görünümü → oyuncu eylem görünümü → bölge çözümleme → yönetim görünümü döngüsü oluşuyor.
- Etki: Yönetim paneli ve 18 sistem eylem alanı açılamıyor.
- Blast radius: `StoryGovernance` içine gömülen oyuncu eylem UI'si; simülasyon tikleri doğrudan etkilenmiyor.

## 3) Evidence

- Deterministik `createRuntime(2032)` yürütme rolü önizlemesi `StoryInstitutions.js:144` klonunda stack taşması verdi.
- Stack zinciri `storyGovernancePlayerView` → `storyPlayerAgencyFamilyView` → `storyPlayerAgencyRegionId` → `storyGovernancePlayerView` olarak tekrar ediyor.
- Kayıt sayımı testi 18/18 yeşil görünüyordu; gerçek görünüm üretimi bu hatayı ortaya çıkardı.

## 4) Hypotheses

1. **Seçili bölge yardımcısı üst seviye görünüm kurucusunu yeniden çağırıyor.** Supported.
2. **Kurum defteri döngüsel JSON veri taşıyor.** Refuted: taşma, aynı görünüm çağrı zincirinin tekrarı sırasında oluşuyor; kanonik defter klonları daha önce geçerliydi.
3. **18 bağlayıcı sayısı tek başına stack sınırını aşıyor.** Refuted: neden derinlik değil, sınırsız özyineleme.

## 5) Remediation

- Bölge varsayılanını `STORY._governanceRegionId` veya oyuncunun sahip olduğu ilk bölgeden çöz; hiçbir oyuncu eylem önizlemesi üst seviye `storyGovernancePlayerView()` çağırmasın.
- 18 aile görünümünü ve gerçek eylem kabul testini ayrı kapılarla çalıştır.

## 6) Verification Plan

- Yürütme rolünde `playerAgencyView()` stack taşması olmadan 18 benzersiz aile döndürmeli.
- Governance HTML 18 sistem çalışma alanını üretmeli.
- Yetkisiz eylem makbuz yazmamalı; başarılı eylem kanonik mutasyon makbuzu yazmalı.
- Save/load oyuncu eylem defterini doğrulayıcıdan geçirerek korumalı.