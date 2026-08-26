---
id: 25-agustos-belge-hedefleme-duzeni
status: Landed
owner: osman
source: 25 Ağustos Atlas Operasyonu kapsam düzeltmesi
touches:
  - docs/**/*.md
  - plans/**/*.md
  - LEDGER.md
  - RCA.md
  - TEST_GAPS.md
depends_on: []
conflicts_with: []
created: 2026-08-25
last_touched: 2026-08-26
---

# 25 Ağustos Belge Hedefleme Düzeni

## Amaç

Dosyaları yaşlarına bakarak topluca arşivlemek yerine, her yaşayan çalışma
alanına tanımlı bir Markdown giriş noktası vermek. İnsan veya ajan önce tek bir
imleçten mevcut hedefe ulaşmalı; plan, gerçekleşen durum ve kanıt birbirine
karışmamalıdır.

## Değişmezler

- Güncele yakın kod, test, araç, QA çıktısı veya rapor sırf kalabalık olduğu için
  taşınmaz.
- M2/gece/arşiv-silme Makine 2 araçları, görevleri ve kayıtları aktif kalır.
- `index.html`, Electron'un kaynak çalışma ve paketleme girişidir.
- `LEDGER.md` kalıcı ve append-only kanıt defteridir.
- `RCA.md` yalnız son kök neden analizidir; tarihçe değildir.
- `TEST_GAPS.md` test borcunun güncel listesidir.
- Ayrıntı tek kanonik yerde tutulur; giriş belgeleri bağlantı ve kısa durum
  taşır, içeriği kopyalamaz.

## Belge rolleri

| Rol | Kanonik yer | Güncelleme tetikleyicisi |
|---|---|---|
| Tüm proje yönlendirmesi | `docs/README.md` | Yeni alan veya kanonik belge |
| Aktif çalışma imleci | `docs/operations/AKTIF-CALISMA.md` | Her anlamlı inceleme/karar sonunda |
| Hikâye modu bütün resmi | `docs/story/design/HIKAYE_MODU_SISTEM_ATLASI.md` | Sistem incelemesi veya ürün kararı |
| Alan hedefi | `docs/<alan>/plans/*.md` | Hedef/sıra değişikliği |
| Gerçekleşen durum | `docs/<alan>/status/*.md` | Kod davranışı değişikliği |
| Test açığı | `TEST_GAPS.md` | Eksik/yanıltıcı test doğrulaması |
| Son kök neden | `RCA.md` | Yeni kök neden incelemesi |
| Kalıcı kanıt | `LEDGER.md` | Hipotez doğrulama veya çürütme |

## Uygulama sırası

1. `docs/README.md` ve alan README'lerinde kısa okuma rotalarını tamamla.
2. `AKTIF-CALISMA.md` dosyasını tek oturum imleci olarak her tur güncelle.
3. Hikâye atlasında ekonomi, siyaset/devlet, şirket, karakter, lojistik,
   demografi ve diğer sistemleri aynı kanıt şablonuyla sırayla incele.
4. Her bulguyu önem, güven ve kanıtla sınıflandır; düzeltme yapılmadan önce
   planı karşı kanıtla çürütmeye çalış.
5. Kod değişikliği onaylandığında ayrı ve dar kapsamlı uygulama planı çıkar.

## Tamamlanma ölçütü

- Ana alanların her biri `docs/README.md` üzerinden en fazla iki bağlantıda
  bulunabilir.
- Aktif çalışma imleci son tamamlanan incelemeyi, geçerli kararları ve tek
  sıradaki hedefi gösterir.
- Aynı konu için birden fazla “güncel gerçek” belgesi yoktur.
- Bozuk bağlantı taraması ve `git diff --check` temizdir.

## Planı çürütme

| İddia | Karşı test | Sonuç |
|---|---|---|
| Sorun çoğunlukla eski dosya sayısıdır | Test/tool/M2 tüketici taraması | Çürütüldü; büyük çoğunluk güncel veya canlıdır |
| Daha çok arşiv daha hızlı çalışma sağlar | Aktif referans ve benzersiz test kontrolü | Çürütüldü; yanlış taşıma arama ve onarım maliyeti doğurur |
| Tek dev plan hafıza için yeterlidir | Hedef/durum/kanıt değişim sıklıkları | Çürütüldü; roller ayrılmalı, tek imleçle bağlanmalıdır |
| Kısa MD rotası hedefe ulaşmayı hızlandırır | İki bağlantı erişim ölçütü | Uygulama sırasında doğrulanacak |

## Yürütme kaydı — 26 Ağustos 2026

- `docs/README.md`, aktif çalışma, sistem atlası, kapsam matrisi, raporlar,
  planlar ve BACKLOG arasında kısa okuma rotası kuruldu.
- Aktif imleç her anlamlı inceleme ve karar sonunda güncellenen tek oturum
  hedefi olarak kullanıldı.
- Ana alanlar belge haritasından en fazla iki bağlantıda erişilebilir durumda.
- Bağlantı taraması ve `git diff --check` temiz geçti; plan Landed yapıldı.
