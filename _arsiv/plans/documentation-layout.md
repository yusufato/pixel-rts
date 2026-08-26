---
id: documentation-layout
status: Landed
owner: osman
source: ad hoc
touches:
  - README.md
  - "*.md"
  - docs/**/*.md
  - _arsiv/**/*.md
  - mockup/**/*.md
  - "Oyun tasarımı planı/**/*.md"
  - js/**/*.js
  - electron/**/*.js
  - tools/**/*.js
  - tools/**/*.py
  - tests/**/*.js
  - style.css
depends_on: []
conflicts_with: []
created: 2026-08-22
last_touched: 2026-08-23
---

# 1. Refactor Thesis

Depodaki Markdown belgeleri bilgi türüne, güncelliğine ve sahipliğine göre yeniden düzenlenecek; eksik giriş/index belgeleri eklenecek; yaşayan belgeler ile tarihsel kanıtlar ayrılacak. Bu çalışma oyun davranışını, simülasyon verisini, görsel varlıkları veya çalışma zamanını değiştirmeyecek.

Mevcut sorunlar:

- Depo kökünde plan, QA raporu, kurulum notu, tarihsel görev listesi ve güncel durum belgeleri aynı seviyede duruyor.
- `docs/` altında savaş AI planları, deney raporları, üretilmiş kayıtlar, araştırmalar ve operasyon notları tek düz dizinde karışıyor.
- Kanonik belgeleri ve güncel durumu gösteren `docs/README.md` yok.
- Hikâye modu, savaş AI, UX/QA ve operasyon belgelerinin ayrı giriş belgeleri yok.
- `github.md` Markdown değil; PNG imzalı ikili veri yanlış uzantıyla tutuluyor.
- `memory.md` eski bir yardımcı-asistan oturumuna ve bulunmadığı doğrulanması gereken `memory.json`, `task.md`, `implementation_plan.md` dosyalarına işaret ediyor.
- `../docs/battle-ai/plans/PLANLAR.md` güncel görev kuyruğu ile tamamlanmış savaş AI geçmişini ayırmıyor.
- `../docs/battle-ai/evidence/KAPI-DEFTERI.md` kendisini üretilmiş çıktı olarak tanımlıyor fakat yaşayan tasarım belgeleriyle aynı yerde.
- `docs/kayit-m2/README.md` kayıtların amacı, üreticisi, şeması ve saklama politikasını açıklayacak kadar dolu değil.
- `.agents/skills` ile `.claude/skills` altındaki benzer Markdown dosyaları proje belgesi değil, araç yapılandırmasıdır; belge tekilleştirmesine dahil edilmemelidir.

Hedef dizilim:

```text
README.md
LEDGER.md
RCA.md
plans/                         # Onay bekleyen/uygulanabilir depo çalışma planları
docs/
  README.md                    # Tek belge haritası ve yaşam döngüsü kuralları
  ARCHITECTURE.md              # Kısa sistem ve motor sınırları
  product/                     # Ürün vizyonu, genel geliştirme, teknoloji
  story/
    README.md
    plans/
    design/
    status/
    qa/
    research/
  battle-ai/
    README.md
    plans/
    design/
    research/
    reports/
    evidence/
    operations/
  ux/
    README.md
    design/
    qa/
  operations/
    README.md
_arsiv/
  README.md
  story/
  battle-ai/
  assistant-history/
  binary-dumps/
```

# 2. Invariants (must not change)

- Oyun, Electron, test, eğitim, LLM, savaş ve hikâye modu çalışma davranışı değişmeyecek.
- Hiçbir belge içeriği veya ikili veri silinmeyecek; taşınan içerik Git geçmişi ve arşiv kaydıyla izlenebilir kalacak.
- Güncel hikâye modu planı, uygulama durumu, modern dünya borçları ve savaş AI tasarımının tek birer kanonik kopyası olacak.
- `README.md` üzerinden kanonik belgelerin tamamına en fazla iki tıklamayla ulaşılabilecek.
- `LEDGER.md` ve `RCA.md`, prompt sözleşmesinin kök çıktıları olarak yerinde kalacak.
- `prompts/**`, `.agents/skills/**` ve `.claude/skills/**` içerik ve konum olarak değişmeyecek.
- Varlıklarla birlikte yaşayan `mockup/**/README.md`, `mockup/BULGULAR.md` ve tasarım teslim belgeleri, bağlamları gerektirmedikçe kendi klasörlerinde kalacak.
- Türkçe belge içeriği ve dosya kodlaması korunacak; yalnız başlık, durum etiketi, bağlantı ve konum için gerekli düzenlemeler yapılacak.
- Taşıma sırasında aktif, commitlenmemiş kullanıcı değişiklikleri ezilmeyecek veya başka içerikle birleştirilmeyecek.
- Eski belge yollarını kullanan depo içi Markdown bağlantıları, testler, araçlar ve kaynak yorumları yeni kanonik yollara güncellenecek.

# 3. Out of Scope

- Bekletilen taşıt donması/performans düzeltmesi ve diğer oyun kodu değişiklikleri.
- Hikâye modu fazlarının, savaş AI planlarının veya tasarım kararlarının yeniden tasarlanması.
- Markdown metinlerinin baştan yazılması ya da tarihsel rapor sonuçlarının “güncel görünmesi” için değiştirilmesi.
- Görsel, ses, model, eğitim verisi veya çalışma zamanı kayıtlarının içerik optimizasyonu.
- `.agents/skills` ve `.claude/skills` kopyalarının birleştirilmesi.
- `CHANGELOG.md`, lisans veya dış katkı süreci eklemek; bunlar yayın süreci kararı gerektirir.
- Arşiv belgelerinin temizlenmesi veya Git geçmişinin yeniden yazılması.

# 4. Preconditions

1. Mevcut çalışma ağacı ve özellikle değişmiş hikâye/harita dosyaları commitlenmeli ya da güvenli bir dal/snapshot ile korunmalı. Belge taşıma adımı kirli ve çakışan bir dosya üzerinde başlamamalı.
2. `rg --files -g '*.md'` çıktısı ve her dosyanın boyutu alınarak başlangıç envanteri saklanmalı.
3. Her belge için `canonical`, `active-plan`, `status`, `design`, `qa`, `research`, `generated-evidence`, `operations` veya `archive-candidate` sınıfından biri atanmalı. Sınıflandırma yalnız dosya adına göre yapılmamalı; başlık, tarih, açık işler ve inbound referanslar okunmalı.
4. `github.md` ilk sekiz baytının PNG imzası (`89504E470D0A1A0A`) olduğu yeniden doğrulanmalı. İmza tutmazsa uzantı değiştirme adımı iptal edilmeli.
5. `memory.md` içindeki `memory.json`, `task.md` ve `implementation_plan.md` yolları doğrulanmalı. Yaşayan bir iş akışı bulunursa belge arşivlenmemeli.
6. `../docs/battle-ai/plans/PLANLAR.md` içindeki tamamlanmamış maddeler önce yaşayan savaş AI planına aktarılmalı; kalan içerik ancak bundan sonra tarihsel kabul edilmeli.
7. `../docs/battle-ai/evidence/KAPI-DEFTERI.md` dosyasını üreten/okuyan araç referansları bulunmalı. Yol çalışma zamanında sabitse taşıma öncesi üretici güncellemesi ayrı, davranış koruyan değişiklik olarak hazırlanmalı.
8. Taşıma öncesi Markdown bağlantı taraması ve `rg` ile eski yol referansları kaydedilmeli; başlangıçta zaten kırık olan bağlantılar yeni kırıklardan ayrılmalı.
9. Depoda `AGENTS.md` bulunmadığı ve mevcut `plans/` çakışması olmadığı doğrulanmıştır; yeni kural dosyası bu çalışmada eklenmeyecek.

# 5. Step Sequence

## Adım 1 — Belge sözleşmesini ve giriş noktalarını kur

- `docs/README.md` oluştur: belge sınıfları, kanonik kaynak tablosu, durum etiketleri (`Aktif`, `Referans`, `Üretilmiş`, `Arşiv`) ve arşivleme kuralını tanımla.
- `docs/ARCHITECTURE.md` oluştur: taktik savaş motoru, hikâye dünya simülasyonu, ortak runtime, LLM/sohbet ve görsel/harita katmanlarının yalnız yüksek seviyeli sınırlarını ver; ayrıntıyı mevcut kanonik belgelere bağla.
- `docs/story/README.md`, `docs/battle-ai/README.md`, `docs/ux/README.md` ve `docs/operations/README.md` girişlerini oluştur.
- Yeni girişlerde belge çoğaltma; sahip, güncel durum, kanonik yol ve arşiv yolu göster.
- Bu adım sonunda hiçbir mevcut dosyayı taşıma. Bağlantı kontrolünü çalıştır ve ayrı commit sınırı oluştur.

## Adım 2 — Yüksek güvenli yanlış yerleşimleri karantinaya al

- PNG imzası doğrulanmışsa `github.md` dosyasını içerik değiştirmeden `_arsiv/binary-dumps/github.png` konumuna taşı; `_arsiv/README.md` içine kaynak yol, tarih, imza ve neden bilgisini ekle.
- Bağımlılığı olmadığı doğrulanırsa `memory.md` dosyasını `_arsiv/assistant-history/memory-2026-07-18.md` konumuna taşı; yanlış veya artık bulunmayan referansları tarihsel not olarak açıkla, içerik silme.
- `../docs/battle-ai/plans/PLANLAR.md` içindeki yaşayan açık işleri kanonik savaş AI planına bağla; yalnız kapalı tarihsel gövdeyi `_arsiv/battle-ai/PLANLAR-2026-08-03.md` altına taşı.
- Belirsiz herhangi bir dosyayı arşivleme; `Needs Decision` olarak `docs/README.md` tablosunda bırak.
- PNG imzasını, içerik byte eşitliğini ve bağlantıları doğrula; ayrı commit sınırı oluştur.

## Adım 3 — Kök belgeleri sahiplerine göre yerleştir

- Ürün belgelerini `docs/product/` altına taşı: genel oyun tasarımı, genel geliştirme planı ve teknoloji ağacı.
- Hikâye belgelerini amaçlarına göre `docs/story/plans`, `design`, `status`, `qa` ve `research` altına taşı. Özellikle ana katmanlı dünya planı ile uygulama durumunu ayrı tut; biri hedef, diğeri gerçekleşen durumdur.
- `../docs/story/status/MODERN_DUNYA_EKSIKLERI.md` dosyasını yaşayan borç/status belgesi olarak işaretle; arşivleme.
- `../docs/story/research/DIS_ANALIZ_VERI_DEFTERI.md` dosyasını araştırma girdisi olarak konumlandır; kanonik tasarımla karıştırma.
- UI ve harita QA belgelerini `docs/ux/qa` altında topla; tasarım QA ile uygulama durumunu ayrı etiketle.
- `../docs/operations/INTERNET-KURULUM.md` dosyasını `docs/operations/` altına taşı.
- `README.md`, `_arsiv/README.md` ve tüm depo içi inbound referansları aynı commit içinde yeni yollara güncelle.
- Eski kök yollar için boş/tekrarlı yönlendirme belgeleri bırakma; bağlantı taraması geçmeden commit oluşturma.

## Adım 4 — Savaş AI belgelerini düz dizinden ayır

- Kanonik tasarım ve aktif planları `docs/battle-ai/plans` ile `docs/battle-ai/design` altına yerleştir.
- Mimari inceleme, AR-GE ve karşılaştırma belgelerini `docs/battle-ai/research` altına yerleştir.
- Sonuç, bilanço, değerlendirme ve kalite raporlarını `docs/battle-ai/reports` altına yerleştir.
- Ham/üretilmiş kanıtları `docs/battle-ai/evidence` altına yerleştir. `../docs/battle-ai/evidence/KAPI-DEFTERI.md` için “generated; do not hand edit” başlığını ve üretici komutunu görünür kıl.
- Eğitim, gece koşusu, dağıtım ve model seçimi çalıştırma belgelerini `docs/battle-ai/operations` altına yerleştir.
- Aynı olayı anlatan belgeleri sessizce birleştirme. Biri diğerinin devamıysa üstlerine `supersedes` / `superseded-by` bağlantısı ekle.
- Dosya yollarına bağlı araç ve kaynak yorumlarını yalnız referans düzeltmesi kadar değiştir; çalışma mantığına dokunma.
- Her alt kategori tamamlandığında bağlantı kontrolü yap; plan/tasarım ve rapor/kanıt gruplarını ayrı commit sınırlarında tut.

## Adım 5 — Eksik metadata ve küçük belgeleri tamamla

- `docs/kayit-m2/README.md` içine şu minimum sözleşmeyi ekle: veri amacı, üretici komut/script, şema veya örnek alanlar, yeniden üretilebilirlik, saklama süresi, kişisel veri durumu ve hangi belgenin sonucu yorumladığı.
- Yaşayan plan ve durum belgelerine, içeriklerini değiştirmeden, tutarlı üst metadata ekle: `status`, `owner`, `last-reviewed`, `canonical`, varsa `supersedes`.
- Tarihi kesin bilinmeyen belgeye uydurma tarih yazma; `unknown` veya Git geçmişinden doğrulanmış tarih kullan.
- `docs/README.md` üzerindeki “eksik ama gerekli” listesini kapat. Mimarisi başka belgede zaten açıklanan konu için yeni özet belge üretme.
- Ayrı commit sınırı oluştur.

## Adım 6 — Kökü ve arşiv indeksini sonlandır

- Kökü kullanıcı giriş noktalarıyla sınırla: `README.md`, sözleşme gereği `LEDGER.md`/`RCA.md`, `plans/` ve gerçekten kökte kalması gereken proje dosyaları.
- `_arsiv/README.md` dosyasını arşiv ağacı, taşıma gerekçeleri, geri bulma yolları ve “arşiv kanonik değildir” kuralıyla güncelle.
- `README.md` içindeki belge bölümünü `docs/README.md` merkezli sadeleştir; ana hikâye ve savaş AI belgelerine doğrudan bağlantıları koru.
- Eski yolları ve yanlış uzantılı Markdown adlarını tüm metin yüzeylerinde ara; sıfır sonuç hedefle.
- Ayrı commit sınırı oluştur.

## Adım 7 — Son doğrulama

- Markdown bağlantı denetimini yeniden çalıştır; başlangıçtan yeni kırık bağlantı kalmamalı.
- `git diff --check` çalıştır.
- `npm test` çalıştır; README veya belge yollarını okuyan testlerin geçtiğini doğrula.
- `rg` ile eski yolların yalnız arşiv provenance kayıtlarında kaldığını doğrula.
- `git status --short` ile kapsam dışı oyun kodu değişikliği bulunmadığını doğrula.
- `docs/README.md` kanonik tablo satırlarının gerçekten var olan tek dosyalara işaret ettiğini makineyle kontrol et.

# 6. Risk Register

| Risk | Olasılık | Etki | Önlem |
|---|---:|---:|---|
| Aktif, commitlenmemiş hikâye belgelerinin taşıma sırasında kaybolması/çakışması | Yüksek | Yüksek | Temiz commit/snapshot önkoşulu; çakışan dosyada dur |
| Eski ama hâlâ gerekli bir planın arşivlenmesi | Orta | Yüksek | Açık madde ve inbound referans taraması; belirsizi `Needs Decision` bırak |
| Kaynak kodu veya araçların sabit belge yoluna bağlı olması | Orta | Orta | Taşıma öncesi `rg`; aynı committe yalnız yol referansı güncellemesi |
| GitHub dış bağlantılarının eski kök yollarda 404 vermesi | Orta | Orta | README ve arşiv provenance haritası; yayınlanmış dış bağlantılar varsa ilgili kanonik dosyayı bir sürüm daha yerinde bırakma kararı al |
| `github.md` dosyasının yanlışlıkla gerçek Markdown kabul edilmesi veya ikili verinin bozulması | Düşük | Yüksek | PNG imzası ve byte eşitliği doğrulaması; silme yok |
| Üretilmiş `../docs/battle-ai/evidence/KAPI-DEFTERI.md` yolunun generator tarafından yeniden eski konuma yazılması | Orta | Orta | Üretici/okuyucu yollarını birlikte güncelle ve yeniden üretim smoke testi yap |
| Çok fazla README/özet ile yeni belge çoğaltılması | Orta | Orta | Giriş belgeleri yalnız indeks/sahiplik taşır; tasarım metni kopyalamaz |
| Araç yapılandırma Markdown'larının proje belgesi sanılıp taşınması | Düşük | Yüksek | `prompts/**`, `.agents/**`, `.claude/**` kesin kapsam dışı |
| Türkçe karakterli veya boşluklu yolların bağlantı araçlarını bozması | Orta | Düşük | Mevcut yolu zorunlu olmadıkça yeniden adlandırma; link validator ile doğrula |

# 7. Abort Criteria

- Çalışma ağacı, taşınacak bir dosyada sahipliği belirsiz commitlenmemiş değişiklik içeriyorsa dur.
- Bir belgenin güncel mi tarihsel mi olduğu içerikten ve referanslardan belirlenemiyorsa arşivleme; kullanıcı kararı iste.
- `github.md` PNG imzası doğrulanmazsa uzantı/konum değişikliğini durdur.
- Taşınan dosyanın byte içeriği beklenmedik biçimde değişirse ilgili adımı geri al.
- Runtime veya paketleme sürecinin bir Markdown yolunu davranışsal girdi olarak kullandığı ortaya çıkarsa o dosyayı mevcut yerinde bırak ve ayrı uyumluluk planı aç.
- Herhangi bir adım yeni kırık bağlantı üretiyor ve aynı adım içinde giderilemiyorsa commit oluşturma.
- `npm test` belge düzeninden sonra başarısız olur ve hata yalnız yol güncellemesiyle çözülemiyorsa son başarılı commit sınırına dön.
- Plan kapsamı oyun kodu, taşıt performansı, harita renderı veya simülasyon davranışı değişikliğine kayarsa bu planı durdur.

# 8. Post-Refactor Verification

Başarı ölçütleri:

- Kök dizinde geçici QA/araştırma/kapalı plan kalmaz.
- Her yaşayan belge `docs/README.md` içinde tek bir kanonik yola ve sınıfa sahiptir.
- Hikâye, savaş AI, UX ve operasyon belgelerinin ayrı giriş noktaları vardır.
- Arşivlenen her dosyanın `_arsiv/README.md` içinde eski yolu ve gerekçesi bulunur.
- `github.md` yanlış uzantısıyla artık bulunmaz; ikili içerik doğrulanmış `.png` olarak korunur.
- Yeni kırık Markdown bağlantısı sayısı sıfırdır.
- Eski yollar yalnız arşiv provenance metninde geçer.
- `git diff --check` ve `npm test` başarılıdır.
- Son diff davranışsal kaynak kodu değişikliği içermez; `.js`, `.py`, `.html` veya `.css` değişikliği varsa yalnız belge yolu referansıdır.

Önerilen doğrulama komutları:

```powershell
rg --files -g '*.md'
rg -n "HIKAYE_MODU_|SAVAS_AI_|KAPI-DEFTERI|github\.md|memory\.md|PLANLAR\.md" README.md docs _arsiv js electron tools tests mockup
git diff --check
npm test
git status --short
```

PNG doğrulaması:

```powershell
$bytes = [System.IO.File]::ReadAllBytes('_arsiv/binary-dumps/github.png')[0..7]
([System.BitConverter]::ToString($bytes) -replace '-', '') -eq '89504E470D0A1A0A'
```

Plan onaylanmadan uygulanmaz. Uygulama sırasında her adım ayrı, açıklamalı commit sınırı olarak ele alınır.

# 9. Execution Record — 2026-08-23

- Belge yerleşimi ve kanonik story plan/status yüzeyleri düzenlendi; yaşayan ve arşiv kaynak sahipliği görünür kılındı.
- Kullanıcının onayıyla kapsam, bayat canlı-NLU assertionlarının kaldırılması ve 10 doğrudan senaryo için güvenli fallback kapılarının kurulmasına genişletildi.
- Doğrudan diyalog laboratuvarı testleri korundu; tahıl, grev, ihale, seferberlik, yaptırım, göç, banka, esir takası, boru hattı ve halefiyet girdileri ayrı ayrı dünya-nötr fallback ile kapılandı.
- Konuşma devamlılığı, takip/itiraz/düzeltme hamleleri, yazarken render koruması ve çok katılımcılı görünüm güçlendirildi.
- Bayat harita/UI assertionları mevcut HXD runtime sözleşmesine uyarlandı; mevsim tooltip'i dünya karar metriklerini yeniden taşıdı.
- Hedefli sıralı assertion koşusu ve tam `npm test -- --keep-results` paketi başarılı: 88/88 dünya probu, 50 oyuncu regresyonu ve 60 adversarial konuşma senaryosu geçti.
- Tam test sonucu: `C:\Users\osman\AppData\Local\Temp\pixel-rts-story-test-DyPH47`.
