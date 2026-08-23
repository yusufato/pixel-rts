# RCA — HXD başlangıç envanteri sonradan eklenen ray koridorlarını saymıyor

## 1) Verdict

- **Root cause:** `hexWorldProbe` testi HXD-0'ın tarihsel `591` koridor başlangıç sayısını güncel toplam altyapı sayısı gibi sabitledi. HXD-7.3 daha sonra açık tanımlı `40` bağımsız RAIL koridoru ekledi; kanonik güncel toplam bu nedenle `631` oldu.
- **Confidence:** Confirmed.
- Runtime çoğaltma yapmıyor: fark tam olarak belgelenmiş kırk ray koridoruna eşittir ve ayrı fiziksel ray kabul testleri geçmektedir.

## 2) Failure Definition

- Beklenen: Güncel HexWorld envanter testi sevk edilmiş altyapı kataloğunun toplamını doğrulamalı.
- Gerçek: Test, HXD-0 tarihsel başlangıcını `591` olarak zorunlu tutarken runtime `177 LAND + 20 SEA + 40 RAIL + 197 ENERGY + 197 DATA = 631` koridor üretiyor.
- Etki: Planlı ve doğrulanmış demiryolu genişlemesi sahte topoloji regresyonu olarak raporlanıyor.
- Blast radius: `tests/story-world.test.js` içindeki tek toplam koridor assertionı; runtime değişikliği gerekmiyor.

## 3) Evidence

- `StoryInfrastructure.js` HXD-7.3 için açık tanımlı tam `40` RAIL bağlantısı ekliyor.
- Aynı test paketinin yerleşim/fiziksel altyapı bölümünde `sourceRailCorridorCount === 40` ve bütün ray koridorlarının fiziksel olduğu ayrıca zorunlu.
- Kanonik durum belgesi HXD-0'ın tarihsel `591` temelini ve daha sonraki `40` RAIL eklemesini ayrı ayrı kaydediyor.
- Artış `631 - 591 = 40`; beklenmeyen başka koridor yok.

## 4) Hypotheses

1. **Test tarihsel HXD-0 sayısında kaldı.** Supported.
2. **Koridor üreticisi aynı bağlantıları iki kez ekliyor.** Refuted: fark açık RAIL kataloğunun tam boyutu; kimlik tekilleştirmesi ve fiziksel ray testleri geçiyor.
3. **Eski LAND/SEA/overlay sayıları değişti.** Refuted: 591 temel bileşimi belgede hâlâ `177/20/197/197`; yalnız RAIL 40 eklendi.
4. **Runtime 591'e geri çekilmeli.** Refuted: ray ağı sevk edilmiş, fiziksel zincirleri ve ayrı mekanikleri olan tamamlanmış HXD dilimidir.

## 5) Remediation

- Güncel toplam koridor assertionını `631` yap ve mesajı tarihsel HXD-0 yerine HXD-7.3 ray genişlemesini de içeren güncel envanter olarak düzelt.
- Ayrı `40 RAIL` ve fiziksel zincir assertionlarını koru.
- Tarihsel 591 sayısını plan/status belgelerinde HXD-0 baseline olarak değiştirme.

## 6) Verification Plan

- `hexWorldProbe.inventory.infrastructureCorridorCount === 631` geçmeli.
- `sourceRailCorridorCount === 40` ve `allRailCorridorsPhysical === true` geçmeli.
- Sıralı assertion paketi sonraki kapıya ilerlemeli.
- Tam `npm test -- --keep-results` geçmeli.