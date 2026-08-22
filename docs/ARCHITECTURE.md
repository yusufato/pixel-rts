# Pixel RTS Mimari Sınırları

Bu belge ayrıntılı tasarımı tekrar etmez. Çalışan motorların sahipliğini ve aralarındaki veri sınırlarını gösterir.

## Çalışma yüzeyleri

| Yüzey | Kanonik sahip | Sınır |
|---|---|---|
| Taktik savaş | `BattleController → BattlePerception → BattleSituation → BattlePlanning → BattleExecution` | Hızlı maç ve hikâye savaşı aynı birlik, fizik ve karar kaynaklarını kullanır |
| Savaş kuralları ve kayıt | `BattleRules.js`, `BattleSession.js` | Tohum, motor sürümü, olay ve sonuç sözleşmesini taşır |
| Öğrenen savaş seçicisi | `BattleOracle.js`, `BattleFeatures.js`, `BattleSelector.js`, gömülü model | İzinli özelliklerden operasyon seçer; gizli dünya bilgisi veya hile bonusu kullanmamalıdır |
| Hikâye dünya simülasyonu | `Story.js` ve ayrık hikâye katmanları | Ekonomi, devlet, şirket, nüfus, karakter, ilişki ve bilgi durumunun kanonik sahibidir |
| Hikâye haritası | `StoryHexWorld.js` ailesi, `StoryMapRendererV2.js`, `StoryRender.js` | Altıgen kimliği simülasyon gerçeğidir; ekran koordinatı gerçek üretmez |
| Lojistik ve ulaşım | `StoryTrade.js`, `StoryRoutePlanner.js`, `StoryTransportAgents.js` | Sipariş, fiziksel rota, yük ve görünür ajan projeksiyonunu ayırır |
| Sohbet ve toplantı | görüşme/karakter katmanları ile yerel LLM host | Mekanik karar doğrulayıcı kodda kalır; LLM sayı veya yetkisiz dünya sonucu üretmez |
| Yerel model çalıştırma | `electron/llm-host.js`, `node-llama-cpp` | Ana Electron döngüsünden ayrı süreç; paketlenen GGUF mevcutsa yüklenir |
| UI | hikâye ve savaş UI modülleri | Kanonik durumu gösterir ve yetkili komut kapılarını çağırır; kendi dünya gerçeğini yazmaz |

## Ana veri akışları

```text
oyuncu / AI niyeti
  → doğrulayıcı ve yetki kapısı
  → kanonik motor durumu
  → olay / receipt / telemetry
  → UI ve kayıt projeksiyonu
```

```text
hikâye ekonomi ve lojistik defterleri
  → altıgen rota ve fiziksel taşıma
  → görünür taşıt projeksiyonu
  → harita kompozisyonu
```

## Değişmezler

- Hızlı maç ile hikâye savaşı ayrı taktik motorlara bölünmez.
- LLM çıktısı mekanik gerçek veya sayı için tek başına yetkili değildir.
- Render katmanı simülasyon durumunun sahibi değildir.
- Üretilmiş test/deney raporu kanonik tasarım yerine geçmez.
- Arşiv kaynakları aktif script zincirine bağlanmaz.

## Ayrıntılı kaynaklar

- [Proje ve güncel çalışma sözleşmeleri](../README.md)
- [Hikâye modu](story/README.md)
- [Savaş AI](battle-ai/README.md)
- [UX ve QA](ux/README.md)
