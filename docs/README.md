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
| Hikâye modu hedefi | Aktif | [Katmanlı dünya planı](story/plans/HIKAYE_MODU_KATMANLI_DUNYA_SIMULASYONU_PLANI.md) | Fazlar ve uzun vadeli dünya simülasyonu |
| Hikâye modu işleyişi | Referans | [Oyun mantığı, amaç ve işleyiş](story/design/OYUN_MANTIGI_AMAC_VE_ISLEYIS.md) | Oyuncu amacı, ana döngü ve sistemlerin çalışan kanonik mantığı |
| Hikâye modu kapsam yönlendirmesi | Aktif | [Kaynak ve kapsam matrisi](story/design/HIKAYE_MODU_KAPSAM_MATRISI.md) | Sistem, kaynak ailesi, test kanıtı, risk ve sonraki hedef eşlemesi |
| 25 Ağustos Atlas Operasyonu | Aktif | [Hikâye modu sistem atlası](story/design/HIKAYE_MODU_SISTEM_ATLASI.md) | Oyun amacı, çalışan sistemler, doğrulanmış hatalar ve açık kararlar |
| Aktif çalışma imleci | Aktif | [Aktif çalışma](operations/AKTIF-CALISMA.md) | Son tamamlanan iş, geçerli kararlar ve sıradaki inceleme |
| Bugfix döngüsü ve öncelikler | Aktif | [BACKLOG](../BACKLOG.md) | Kapasite, Now/Next, reddedilen işler ve ürün kararları |
| Hikâye modu gerçekleşen durum | Aktif | [Uygulama durumu](story/status/HIKAYE_MODU_UYGULAMA_DURUMU.md) | Kodlanan ve açık kalan işler |
| Modern dünya borçları | Aktif | [Modern dünya eksikleri](story/status/MODERN_DUNYA_EKSIKLERI.md) | Plan ile çalışan oyun arasındaki farklar |
| Hikâye sohbeti | Aktif | [Sohbet motoru planı](story/plans/HIKAYE_SOHBET_MOTORU_GELISTIRME_PLANI.md) | Serbest metin, görev ve toplantı borçları |
| Savaş AI | Aktif | [Savaş AI tasarım planı](battle-ai/design/SAVAS_AI_TASARIM_PLANI.md) | Hilesiz algı–karar–uygulama zinciri |
| Teknoloji | Aktif | [Teknoloji ağacı](product/TEKNOLOJI_AGACI.md) | 2010–2100 teknoloji sözleşmesi |
| UX ve QA | Aktif | [UX/QA giriş noktası](ux/README.md) | Oyuncu etkileşimi ve görsel doğrulama |
| Kurulum ve işletim | Referans | [Operasyon giriş noktası](operations/README.md) | Yerel kurulum ve çalışma notları |
| Karar geçmişi | Referans | [Ledger](../LEDGER.md) | Ölçülen, doğrulanan ve reddedilen sonuçlar |
| Son kök neden analizi | Anlık rapor | [RCA](../RCA.md) | Güncel hata incelemesi; kalıcı geçmiş değildir |

## Alan girişleri

- [Hikâye modu](story/README.md)
- [Savaş AI](battle-ai/README.md)
- [UX ve QA](ux/README.md)
- [Operasyon](operations/README.md)

## Hızlı çalışma rotası

| Aranan bilgi | Önce aç | Sonra aç |
|---|---|---|
| Şu an ne yapılıyor? | [Aktif çalışma](operations/AKTIF-CALISMA.md) | İlgili alan README'si |
| Oyun neyi amaçlıyor? | [Ürün tasarımı](product/OYUN_TASARIM.md) | İlgili tasarım/plan belgesi |
| Hikâye modu nasıl çalışıyor? | [Oyun mantığı ve işleyiş](story/design/OYUN_MANTIGI_AMAC_VE_ISLEYIS.md) | [Kaynak ve kapsam matrisi](story/design/HIKAYE_MODU_KAPSAM_MATRISI.md) |
| Kodda gerçekte ne çalışıyor? | [Mimari](ARCHITECTURE.md) | Alanın durum belgesi ve testleri |
| Hikâye modunun bütün resmi | [Sistem atlası](story/design/HIKAYE_MODU_SISTEM_ATLASI.md) | [Kaynak ve kapsam matrisi](story/design/HIKAYE_MODU_KAPSAM_MATRISI.md) |
| Doğrulanmış karar ve karşı kanıt | [Ledger](../LEDGER.md) | İlgili test/QA raporu |
| Son incelenen hatanın nedeni | [RCA](../RCA.md) | [Test boşlukları](../TEST_GAPS.md) |
| Savaş AI ve ikinci makine | [Savaş AI girişi](battle-ai/README.md) | [Makine 2 görevi](battle-ai/operations/GOREV-MAKINE2.md) ve [M2 kayıtları](kayit-m2/README.md) |
| Bir sonraki uygulama planı | [BACKLOG](../BACKLOG.md) | [Plan dizini](../plans/) ve planın `depends_on`, `touches`, durum alanları |

## Yaşam döngüsü kuralları

1. Hedef plan ile gerçekleşen durum aynı belgeye yazılmaz.
2. Test çıktısı tasarım kararı değildir; sonuç belgeye bağlanır, veri korunur.
3. Bir belgeyi arşivlemek için yerine geçen kanonik belge ve açık işlerin taşındığı yer gösterilir.
4. Arşiv içerikleri silinmez; eski yol ve taşıma gerekçesi `_arsiv/README.md` içinde tutulur.
5. Araç talimatları olan `prompts/**`, `.agents/**` ve `.claude/**` proje belgesi sınıflandırmasına dahil değildir.
6. Varlıkla birlikte yaşayan teslim/README dosyaları kendi klasöründe kalır.
7. Her çalışma oturumu sonunda `operations/AKTIF-CALISMA.md` güncellenir;
   ayrıntılı kanıt kendi kanonik dosyasında kalır, bu imleçte çoğaltılmaz.

## Geçiş durumu

Belge ağacının ilk tertip geçişi tamamlandı. Kök, yaşayan giriş ve prompt sözleşmesi çıktılarıyla sınırlandı; ürün, hikâye, savaş AI, UX ve operasyon belgeleri sahiplik klasörlerine taşındı. Yeni belge doğrudan doğru alanın altına eklenir.

### Karar gerekli belge

- `battle-ai/plans/PLANLAR.md`: kanonik savaş AI planından doğrudan referans alıyor ve tarihsel kapanışların yanında geleceğe bırakılmış eğitim maddeleri taşıyor; ayrıştırılmadan arşivlenmeyecek.

## 25 Ağustos kapsam kararı

- Güncele yakın dosyalar topluca arşivlenmeyecek.
- M2, gece çalışmaları ve arşiv-silme Makine 2 kayıtları korunacak.
- Yeni düzenleme odağı dosya taşımak değil; MD girişlerini tanımlamak, sahiplik
  vermek ve aktif hedefe kısa bir okuma rotası sağlamaktır.
