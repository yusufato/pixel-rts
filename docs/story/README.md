# Hikâye Modu Belgeleri

## Kanonik belgeler

| Belge | Durum | Rolü |
|---|---|---|
| [Oyun mantığı, amaç ve işleyiş](design/OYUN_MANTIGI_AMAC_VE_ISLEYIS.md) | Yaşayan referans | Hikâye modunun oyuncu amacı, ana döngüsü ve bütün sistemlerin kanonik çalışma biçimi |
| [Kaynak ve kapsam matrisi](design/HIKAYE_MODU_KAPSAM_MATRISI.md) | Yaşayan yönlendirme | Sistemden kaynak ailesine, test kanıtına, doğrulanmış riske ve sonraki hedefe doğrudan rota |
| [25 Ağustos Sistem Atlası](design/HIKAYE_MODU_SISTEM_ATLASI.md) | Aktif | Oyun amacı, sistem sahipliği, doğrulanmış hatalar, açık kararlar ve sıradaki inceleme |
| [Katmanlı dünya simülasyonu planı](plans/HIKAYE_MODU_KATMANLI_DUNYA_SIMULASYONU_PLANI.md) | Aktif | Uzun vadeli faz hedefleri |
| [Uygulama durumu](status/HIKAYE_MODU_UYGULAMA_DURUMU.md) | Aktif | Gerçekte kodlanan faz ve borçlar |
| [Modern dünya eksikleri](status/MODERN_DUNYA_EKSIKLERI.md) | Aktif | Modern dünya hedefinden sapmalar |
| [Sohbet motoru geliştirme planı](plans/HIKAYE_SOHBET_MOTORU_GELISTIRME_PLANI.md) | Aktif | Görüşme, görev ve toplantı sistemi |
| [Hex dünya altyapı planı](plans/HIKAYE_HEX_DUNYA_ALTYAPI_PLANI.md) | Aktif/inceleme gerekli | Altıgen dünya geçişi |
| [2D harita tamamlama planı](plans/HIKAYE_2D_HARITA_TAMAMLAMA_PLANI.md) | Aktif/inceleme gerekli | Harita görünümü ve etkileşimi |
| [Hex dünya envanteri](design/HIKAYE_HEX_DUNYA_ENVANTERI.md) | Referans | Mevcut hücre ve varlık envanteri |
| [Teknoloji ağacı](../product/TEKNOLOJI_AGACI.md) | Aktif | 2010–2100 teknoloji ilerlemesi |

## Destekleyici kanıt ve QA

- [Dış analiz veri defteri](research/DIS_ANALIZ_VERI_DEFTERI.md) — araştırma girdisi; kanonik karar değildir.
- [LLM yeterlilik raporu](qa/HIKAYE_LLM_YETERLILIK_RAPORU.md) — ölçüm/QA raporu.
- [Sohbet QA](qa/STORY_DIALOGUE_QA.md) — görüşme test borçları ve bulgular.
- [Hikâye haritası tasarım QA](../ux/qa/story-map-design-qa.md) — görsel ve etkileşim değerlendirmesi.

## Okuma sırası

1. Oyunun ne olduğu ve sistemlerin nasıl çalıştığı için Oyun Mantığı belgesi.
2. Belirli bir sisteme, kaynak ailesine ve test kanıtına gitmek için Kapsam Matrisi.
3. Güncel denetim, bug ve açık kararlar için Sistem Atlası.
4. Hedef için ana plan.
5. Gerçek durum için uygulama durumu.
6. Açık modern dünya farkları için borç defteri.
7. İlgili alt sistem planı ve QA kanıtı.

Belgeler geçiş tamamlanana kadar kökteki yollarını korur; bu giriş belge sahipliğini şimdiden sabitler.
