# Pixel RTS Belge Haritası

Bu dizin projenin kanonik belge girişidir. Oyun davranışının kaynağı kod ve testlerdir; belgeler hedefi, gerçekleşen durumu, ölçümü ve tarihsel bağlamı birbirinden ayırır.

## Belge durumları

| Durum | Anlamı | Kullanım kuralı |
|---|---|---|
| **Aktif** | Uygulanmakta olan hedef veya yaşayan borç | Değişiklikten sonra gözden geçirilir |
| **Referans** | Kararlı sözleşme veya tasarım açıklaması | Kodla çelişirse uyuşmazlık açıkça raporlanır |
| **Üretilmiş** | Test, deney veya araç çıktısı | Elle kanonik tasarıma çevrilmez |
| **Arşiv** | Artık uygulanmayan tarihsel kayıt | Güncel karar kaynağı olarak kullanılmaz |
| **Karar gerekli** | Sahipliği ya da güncelliği henüz doğrulanmamış | Taşınmaz ve arşivlenmez |

## Kanonik girişler

| Alan | Durum | Kanonik belge | Açıklama |
|---|---|---|---|
| Ürün ve çalışma durumu | Aktif | [Proje README](../README.md) | Çalıştırma, doğrulama ve mevcut ürün özeti |
| Sistem sınırları | Referans | [Mimari](ARCHITECTURE.md) | Motorların ve veri sahiplerinin kısa haritası |
| Hikâye modu hedefi | Aktif | [Katmanlı dünya planı](../HIKAYE_MODU_KATMANLI_DUNYA_SIMULASYONU_PLANI.md) | Fazlar ve uzun vadeli dünya simülasyonu |
| Hikâye modu gerçekleşen durum | Aktif | [Uygulama durumu](../HIKAYE_MODU_UYGULAMA_DURUMU.md) | Kodlanan ve açık kalan işler |
| Modern dünya borçları | Aktif | [Modern dünya eksikleri](../MODERN_DUNYA_EKSIKLERI.md) | Plan ile çalışan oyun arasındaki farklar |
| Hikâye sohbeti | Aktif | [Sohbet motoru planı](../HIKAYE_SOHBET_MOTORU_GELISTIRME_PLANI.md) | Serbest metin, görev ve toplantı borçları |
| Savaş AI | Aktif | [Savaş AI tasarım planı](../SAVAS_AI_TASARIM_PLANI.md) | Hilesiz algı–karar–uygulama zinciri |
| Teknoloji | Aktif | [Teknoloji ağacı](../TEKNOLOJI_AGACI.md) | 2010–2100 teknoloji sözleşmesi |
| UX ve QA | Aktif | [UX/QA giriş noktası](ux/README.md) | Oyuncu etkileşimi ve görsel doğrulama |
| Kurulum ve işletim | Referans | [Operasyon giriş noktası](operations/README.md) | Yerel kurulum ve çalışma notları |
| Karar geçmişi | Referans | [Ledger](../LEDGER.md) | Ölçülen, doğrulanan ve reddedilen sonuçlar |
| Son kök neden analizi | Anlık rapor | [RCA](../RCA.md) | Güncel hata incelemesi; kalıcı geçmiş değildir |

## Alan girişleri

- [Hikâye modu](story/README.md)
- [Savaş AI](battle-ai/README.md)
- [UX ve QA](ux/README.md)
- [Operasyon](operations/README.md)

## Yaşam döngüsü kuralları

1. Hedef plan ile gerçekleşen durum aynı belgeye yazılmaz.
2. Test çıktısı tasarım kararı değildir; sonuç belgeye bağlanır, veri korunur.
3. Bir belgeyi arşivlemek için yerine geçen kanonik belge ve açık işlerin taşındığı yer gösterilir.
4. Arşiv içerikleri silinmez; eski yol ve taşıma gerekçesi `_arsiv/README.md` içinde tutulur.
5. Araç talimatları olan `prompts/**`, `.agents/**` ve `.claude/**` proje belgesi sınıflandırmasına dahil değildir.
6. Varlıkla birlikte yaşayan teslim/README dosyaları kendi klasöründe kalır.

## Geçiş durumu

Belge ağacı yeniden düzenlenmektedir. Bu indeks kanonik sahipliği tanımlar; kök ve düz `docs/` belgeleri doğrulandıktan sonra alan klasörlerine taşınacaktır. Belirsiz belgeler sessizce arşivlenmeyecektir.
