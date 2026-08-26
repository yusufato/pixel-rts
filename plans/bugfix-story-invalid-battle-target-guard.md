---
id: bugfix-story-invalid-battle-target-guard
status: Draft
owner: osman
source: LIFE-04 / TG-05 / 25 Ağustos Atlas Operasyonu
touches:
  - js/Story.js
  - tools/story-sim-harness.js
  - tests/story-world.test.js
  - tools/story-test-manifest.js
  - docs/story/design/HIKAYE_MODU_SISTEM_ATLASI.md
  - TEST_GAPS.md
  - LEDGER.md
depends_on:
  - worktree-reconciliation-no-delete
  - phase-38-13-meeting-closure-routing
  - phase-38-13-private-note-response
  - phase-38-13-institutional-paid-task
  - phase-38-13-directional-relationship-result-receipts
  - phase-38-turkish-semantic-intent-router
conflicts_with:
  - electron-story-lifecycle-acceptance
  - phase-38-13-meeting-closure-routing
  - phase-38-13-private-note-response
  - phase-38-13-institutional-paid-task
  - phase-38-13-directional-relationship-result-receipts
  - phase-38-turkish-semantic-intent-router
created: 2026-08-25
last_touched: 2026-08-26
---

# Geçersiz Savaş Hedefi Guard Bugfix Planı

## Amaç

`storyLaunchBattle(targetNodeId)` bilinmeyen veya artık var olmayan bölge
kimliği aldığında exception yerine `false` döndürsün. Geçerli saldırının
düşmanlık, kaynak, savaş bağlamı ve ekran geçişi davranışı değişmesin.

## Kanıtlanan hata

Güncel sıra:

```js
const node = storyNode(targetNodeId);
const attacker = storyPlayerState();
const defender = storyState(node.owner);
if (!node || !attacker || !defender) return false;
```

`node` null olduğunda `node.owner`, koruma satırından önce okunur. Bu hata
normal harita tıklamasında komşuluk ve `storyNode` kontrolleriyle genellikle
gizlenir; fakat kayıt göçü, bayat UI olayı, test adaptörü veya gelecekteki
komut yüzeyi doğrudan bu fonksiyona geçersiz kimlik verebilir.

## Değişmezler

- Geçerli oyuncu saldırısı aynı `battleCtx`, deploy kaynakları ve taktik ekranı üretir.
- Barışçıl hedef `storyLaunchBattle` içinde hâlâ reddedilir; treaty kırma bu
  fonksiyonun görevi hâline getirilmez.
- Bilinmeyen oyuncu devleti veya savunan devlet `false` döndürür.
- Hata yolu state, kaynak, siege, haber, causality veya save kaydı değiştirmez.
- Savunma yolu `storyLaunchDefense` bu planın kapsamı dışındadır.

## Uygulama adımları

1. Harness'ta kaynak fonksiyon stub'lanmadan önce yalnız test için gerçek
   `storyLaunchBattle` referansını sakla.
2. `invalidBattleTargetReturnsFalse` regresyonunu ekle:
   - bilinmeyen sayısal kimlik;
   - `null`;
   - sahibi olmayan/bozuk hedef fixture'ı;
   - çağrı öncesi ve sonrası dünya snapshot eşitliği.
3. Testin mevcut kodda `TypeError` ile kırmızı olduğunu doğrula.
4. `storyLaunchBattle` içinde sırayı değiştir:
   - node ve attacker çöz;
   - `!node || !attacker` ise `false`;
   - sonra defender çöz;
   - `!defender` ise `false`.
5. Aynı fixture'da geçerli düşman hedefin gerçek fonksiyonda `true` döndüğünü
   ve battleCtx'yi doğru kurduğunu doğrula.
6. Hedefli test, battle telemetry/peace probe ve ilgili hikâye paketi dilimini çalıştır.
7. Atlas bulgusunu `Fixed`, TEST_GAPS kaydını kapalı ve LEDGER'ı kanıtla güncelle.

## Planı çürütme

| İddia | Karşı test | Çürütülürse |
|---|---|---|
| Sorun yalnız guard sırasıdır | Geçersiz hedefte stack ve state farkı | Başka yan etki guard öncesiyse kapsam yeniden açılır |
| `false` güvenli API sözleşmesidir | Mevcut çağıranların dönüş değerini nasıl kullandığını tara | Çağıran exception bekliyorsa davranış kararı gerekir |
| Değişiklik geçerli saldırıyı etkilemez | Aynı tohum/hedefte önce-sonra battleCtx ve deploy bütçesi | Fark varsa patch geri alınır |
| Harness gerçek fonksiyonu ölçebilir | Stub öncesi referansla gerçek target testi | Gerçek bağımlılıklar taşınamıyorsa küçük ayrı VM fixture kurulur |
| Bozuk sahip yalnız `false` olmalıdır | Owner'ı bilinmeyen node fixture'ı | Dünya validatorü daha erken reddetmeliyse test katmanı ayrılır |

## Doğrulama kapısı

- Önce kırmızı test mevcut `TypeError`ı yakalar.
- Düzeltme sonrası üç geçersiz hedef `false` ve sıfır dünya farkı üretir.
- Geçerli düşman hedef savaş bağlamını kurar.
- Barış hedefi `false` kalır.
- `peaceProbe`, `battleProbe` ve yeni hedefli prob yeşildir.
- `git diff --check` temizdir.

## Risk ve geri alma

Risk düşüktür; yalnız hata yolunun exception yerine `false` dönmesi davranış
değişikliğidir. Patch tek guard sırası ve test adaptörüyle sınırlı tutulur.
Beklenmeyen geçerli-saldırı farkında hem kaynak hem test adaptörü aynı küçük
değişiklik grubuyla geri alınabilir.

## Onay durumu

Plan, `electron-story-lifecycle-acceptance` planının ilk kırmızı regresyon
dilimine katıldı. İki plan aynı guard ve harness yüzeyini değiştirdiği için bu
dar plan bağımsız uygulanmamalıdır. Kaynak kod değişikliği henüz yapılmadı.
