---
id: 25-agustos-hikaye-modu-toplam-bugfix-plani
status: Draft
owner: osman
source: 25 Ağustos Atlas Operasyonu
touches:
  - js/Story*.js
  - js/Talks.js
  - js/Era.js
  - js/Council.js
  - js/Production.js
  - js/PlayerKnowledge.js
  - tests/story-world.test.js
  - tools/story-sim-harness.js
  - tools/story-test-manifest.js
  - docs/story/design/HIKAYE_MODU_SISTEM_ATLASI.md
  - TEST_GAPS.md
  - RCA.md
  - LEDGER.md
depends_on:
  - plans/25-agustos-belge-hedefleme-duzeni.md
  - worktree-reconciliation-no-delete
  - phase-38-13-meeting-closure-routing
  - phase-38-13-private-note-response
  - phase-38-13-institutional-paid-task
  - phase-38-13-directional-relationship-result-receipts
conflicts_with:
  - phase-38-13-meeting-closure-routing
  - phase-38-13-private-note-response
  - phase-38-13-institutional-paid-task
  - phase-38-13-directional-relationship-result-receipts
created: 2026-08-25
last_touched: 2026-08-26
---

# 25 Ağustos Hikâye Modu Toplam Bugfix Planı

## 1. Amaç ve statü

Bu belge ilk Atlas taramasında doğrulanan bugları uygulanabilir, küçük ve geri
alınabilir dilimlere ayırır. Bir uygulama yetkisi değildir. Ürün kararı isteyen
satırlar seçilmeden ilgili dilim başlatılmaz; her dilim ayrı uygulama planına
indirgenir ve önce kırmızı regresyon testiyle kanıtlanır.

Kaynak gerçekler:

- Oyun mantığı ve kararlar:
  `docs/story/design/HIKAYE_MODU_SISTEM_ATLASI.md`
- Test boşlukları ve öncelikler: `TEST_GAPS.md`
- Son kök neden: `RCA.md`
- Kalıcı doğrulama/çürütme geçmişi: `LEDGER.md`

## 2. Değişmezler

- Para, kişi, mal, kapasite, makam ve bölge sahipliği açıklanamayan biçimde
  artmaz; eksilmez; iki kez sahiplenilmez.
- Oyuncu ve AI aynı domain komutunun aynı yaşam, yetki ve durum kapılarından geçer.
- Başarılı makbuz ya terminal fiziksel sonuç ya da açık bekleyen/ret/iptal durumu taşır.
- UI ham dünya nesnesini değil, seçilmiş bilgi sınıfı ve kanonik görünümü gösterir.
- Kayıt/yükleme ara veya geçersiz transaction durumunu kalıcılaştırmaz.
- Her düzeltme tek başına geri alınabilir; ürün tasarımı ile zorunlu bugfix aynı
  commit/dilimde karıştırılmaz.
- Gerçek Electron kabulü, headless harness'ın savaş ve yenilgi stub'larının
  yerine geçmediği son kapıdır.

## 3. Karar kapıları

| Kapı | Kullanıcı kararı | Karar verilmeden yapılabilecek |
|---|---|---|
| K-01 Kampanya sonucu | Sonsuz sandbox mı, zafer koşulu mu; son bölge kaybı mı sürgün mü | Null guard ve sonuç bazlı ödül test fixture'ı |
| K-02 Savaş ödülü | Yalnız zafer, teselli veya sonuç bazlı farklı ödül | Mevcut istismarı kırmızı testle sabitleme |
| K-03 Yürütme kariyeri | Seçim/darbe/istifa sonrası oyuncu rolü ve halef kontrolü | Tek makam sahibi invariantı ve transition iskeleti |
| K-04 Şirket rolü/kredi | OWNER payı; CFO/kurul eşikleri; kayyım finansmanı | İflas durum kapısı ve rakip komut yolu testi |
| K-05 Gümrük/transit | Vergiyi kim öder; koridor sahibi ve geçiş hakkı | Mevcut +0,2142 para yaratımını kırmızı testle sabitleme |
| K-06 Demografi | Göç hafızası, doğum/ölüm/yaşlanma, asker başına kişi | Fiziksel kişi korunumu kapısını koruma |
| K-07 Fetih rejimi | Anlık ilhak mı işgal geçişi mi; yabancı tesisin kaderi | Geçersiz sessiz ara durum ve yanlış attribution testi |
| K-08 Diplomatik yetki | Rejime göre savaş ilanı yürütücüsü/önericisi | Emekli/ölü bypass'ını kırmızı testle sabitleme |
| K-09 Teknoloji bilgisi | Rakip araştırması kamu bilgisi, tahmin veya intel kilidi mi | Ham STORY okumasını sızıntı testiyle sabitleme |
| K-10 Çağ metriği | Bütün savaş, ortak sınır veya ağırlıklı aktif cephe | Mevcut payda ters örneklerini sabitleme |
| K-11 Konsey yürütmesi | Eski stratejik üst katman mı; bütün önergeler kanonik domain komutu mu | Effect failure atomikliği ve sahte başarı testi |
| K-12 Askerî üretim | Stratejik sayaç mı; askerî mal+enerji+işgücü+kohort reçetesi mi | Mevcut havuz/taktik köprü korunum testi |
| K-13 Araştırma yürütmesi | Kademe 3–4 önceliği konsey önerisi, oy ağırlığı veya kapalı UI mı | Yürütücüsüz başarı makbuzunu kırmızı testle sabitleme |

## 4. Uygulama dalgaları

### Dalga 0 — Güvenilir test zemini

Amaç: sonraki yeşil sonuçların yanlış güven üretmesini önlemek.

1. Gerçek savaş girişi ve gerçek yenilgi kontrolü için stub'sız küçük entegrasyon
   harness'ı kur: TG-01, TG-05.
2. Manifestte kritik requiredTrue alanlarını zorunlu kıl; governance ve
   activation false-positive/false-negative sözleşmelerini düzelt: TG-06, TG-09.
3. Çapraz-defter yardımcı assertionları ekle:
   - tek yürütme sahibi;
   - canlı bölge sahibi = nüfus/needs/opinion ülkesi;
   - aktif shipment = aktif reservation = tek terminal üyeliği;
   - para/mal/kişi toplamı;
   - aktif karakter ve yetkili makam.
4. Bu dalga oyun davranışını değiştirmez.

Çıkış kapısı:

- Yeni testlerin her biri mevcut doğrulanmış bug üzerinde kırmızı.
- Kırmızılık assertion eksikliğinden değil gerçek dünya farkından geliyor.
- Hedefli testler iki ardışık deterministik koşuda aynı sonucu veriyor.

### Dalga 1 — Ürün kararı istemeyen dar bugfixler

Her madde ayrı uygulama planı ve ayrı geri alma birimidir.

1. **LIFE-04:** `storyLaunchBattle` içinde node/attacker/defender null guard'ını
   dereference öncesine taşı.
2. **LOG-01:** Reroute'ta eski terminali yeni agent attach öncesi bırak; başarısız
   attach için eski rota/lease/agent/terminal rollback'i yap.
3. **Governance cache:** Var olmayan `institutions.revision` yerine gerçek artan
   sürüm veya makam sahipliği imzası kullan.
4. **TECH-01 mitigation:** Kademe 3–4 önceliğini K-13 teknoloji yönetişim
   kararı verilene kadar açık gerekçeyle reddet; sessiz ölü niyeti kapat.
5. **ERA-02 minimum wiring:** Yalnız seçilmiş K-10 olay listesi kesinleşirse;
   aksi hâlde kod yorumu/ekran iddiasını mevcut gerçek üç kaynağa indir.
6. **COUNCIL-02:** Önerge etkisi exception ürettiğinde ödemeyi bırakıp başarı
   metni döndüren yolu açık başarısızlık ve atomik rollback/rezervasyona çevir.

Çıkış kapısı:

- `invalidBattleTargetReturnsFalse`, `rerouteReleasesPreviousTerminal`,
  governance cache, `researchPriorityMustHaveExecutor` ve
  `councilMotionFailureIsAtomic` yeşil.
- Lojistik tamamlama/kayıp/save-load yollarında terminal veya lease artığı yok.
- Oyun kaynak değişiklikleri ürün davranışı kararı gerektiren alana taşmıyor.

### Dalga 2 — Ortak aktör, yaşam ve yetki kapısı

Bağımlılık sırası:

1. `storyPlayerAgencyExecute` girişinde kanonik actor çözümü ve
   ACTIVE/RETIRED/DEAD politikası: CHAR-01.
2. Şirket kredi/lobi/yatırım yollarını ortak domain precondition setine indir;
   BANKRUPT/DISSOLVED/REVOKED faaliyet kapısını uygula.
3. K-08 sonrası `DeclareWarCommand` oluştur; harita, konuşma, AI ve PlayerAgency
   treaty kırma yollarını bu komuta bağla: WORLD-02.
4. K-03 sonrası seçim, darbe, istifa ve atamayı tek `ExecutiveTransition`
   makbuzuna bağla: POL-01/02/03.

Çıkış kapısı:

- ACTIVE/RETIRED/DEAD × rol × eylem ailesi matrisi beklenen allowlist'i gösterir.
- Aynı şirket kredisi bütün yüzeylerde aynı sonucu veya aynı reddi üretir.
- Başarılı savaş ilanı tek treaty/bedel/haber/makbuz; ret sıfır dünya değişimi üretir.
- Election, institution, career, governance ve crisis tek yürütme aktöründe birleşir.

### Dalga 3 — Atomik para, kapasite ve sahiplik

1. **ECON-01:** K-05 sonrası ithalat/ihracat/transit tutarlarını ödeyen hesaptan
   rezerve edip tek settlement içinde alıcı devletlere aktar.
2. **LOG-02:** Canlı shipment lease'ini durumla bağla; heartbeat/yenileme veya
   açık iptal-yeniden planlama politikası uygula.
3. **WORLD-01:** K-07'ye göre sahiplik commit'inde nüfus/needs/opinion
   invalidation-reconcile çalıştır veya açık işgal transition'ı üret.
4. Causality-world validatorüne nüfus sahibi, shipment reservation ve
   açıklanamayan para toplamı invariantlarını ekle.

Çıkış kapısı:

- Dış ticaret toplam para farkı sıfır; her devlet geliri gerçek ödeyen fişine bağlı.
- Canlı yük aynı kapasiteyi ikinci shipment'a kullandırmaz.
- Fetih makbuzu döndüğünde bütün okuyucular aynı açık egemenlik durumunu gösterir.
- Save/load bütün settlement ve transferleri tek kez korur.

### Dalga 4 — Semantik süreklilik ve bilgi doğruluğu

1. K-07 sonrası gerçek bölgesel tesis sahibi/işletmeci attribution'ı: WORLD-03.
2. K-06 sonrası göçmen şikâyet hafızasını kişi ağırlığıyla taşı/birleştir:
   DEMO-01.
3. K-09 sonrası rakip teknoloji fact'ini PlayerKnowledge'a ekle ve teknoloji
   panelini UNKNOWN/ESTIMATED/VERIFIED üzerinden çiz: INFO-01.
4. K-10 sonrası `storyEraMetrics` paydasını ve kanonik olay adaptörünü düzelt:
   ERA-01/02.
5. LIFE-03 için kayıt/devamda bekleyen ödülü tek-talep UI durumuyla yeniden aç.

Çıkış kapısı:

- Kamuoyu hiçbir olmayan şirketi “işveren/tedarikçi” diye suçlamaz.
- Göç kişi ve seçilmiş toplumsal hafıza toplamlarını korur.
- Sis/istihbarat matrisinde hiçbir panel izin verilenden kesin bilgi göstermez.
- Çağ metriği aynı topolojide deterministik, farklı topolojide seçilmiş tanıma duyarlı.
- Bekleyen ödül save/load sonrası erişilebilir ve yalnız bir kez alınabilir.

### Dalga 5 — Ürün tasarımı gerektiren genişlemeler

Bu dalga bugfix diye başlanmaz; her konu ayrı tasarım belgesi ve simülasyon
kalibrasyonu ister:

- Zafer/başarı koşulu ve son bölge sürgünü: LIFE-02 ve kampanya amacı.
- Kayıp/beraberlik ödül tasarımı: LIFE-01.
- Şirket payı, temettü, kredi vadesi/anapara/temerrüt/tasfiye.
- Bütünlük yaptırımı ve darbe sonrası bölgesel SPLIT.
- Doğum, ölüm, yaşlanma, eğitim/meslek ve askerî nüfus kaynağı.
- Transit koridor sahipliği/geçiş hakkı: LOG-03.
- Göç ile ticari/askerî yükün ortak kapasitesi.
- Kademe 3–4 araştırmanın bağlayıcı konsey gündemi.
- K-11 sonrası eski konsey önergelerinin bütçe, nüfus, stok, altyapı ve hex
  inşaat domain komutlarına geçirilmesi: COUNCIL-01.
- K-12 sonrası askerî üretimin ayrıntılı askerî mal, enerji, tesis, işgücü ve
  kohort kaynağıyla mutabakatı: MIL-01.
- Grev, ihale, seferberlik, yaptırım, mülteci, banka, esir, boru hattı ve darbe
  konuşmalarının kanonik domain komutlarına bağlanan dokuz özel adaptörü.

## 5. Planı çürütme

| Plan iddiası | Karşı kanıt / test | Plan çökerse yapılacak |
|---|---|---|
| Önce ortak yetki kapısı bütün bypass'ları kapatır | Harita, konuşma, agency ve doğrudan domain çağrılarını aynı fixture'da karşılaştır | Eksik giriş yüzeylerini envanterle; merkezi kapı tamamlanmadan dalgayı bitirme |
| Fetihte hemen reconcile güvenlidir | Aynı anda çalışan migration, opinion, company ve save çağrılarını transfer ortasında zorla | Ara durum gerekiyorsa açık OCCUPATION state machine tasarla |
| Lease yenilemek kapasite çifte kullanımını çözer | HELD, MOVING, reroute, LOST ve save/load saat sınırı testleri | Owner yaşam döngüsü transaction'ını yeniden tasarla |
| Gerçek tesis sahibi doğru suçlanan aktördür | Tesis işletmecisi, lisans sahibi ve mal tedarikçisi farklı fixture kur | Attribution'ı tek owner yerine rol bazlı provider resolver yap |
| PlayerKnowledge'a tech fact eklemek sızıntıyı kapatır | Bütün UI dosyalarında `STORY.states` ve foreign alan render taraması | Panel bazlı ham okuma kalırsa bilgi sınırı tamamlanmış sayma |
| Komşu çift oranı doğru çağ metriğidir | Aynı savaş sayısı, farklı sınır uzunluğu/nüfus/toprak fixture'ları | K-10'u yeniden aç; ağırlıklı aktif cephe metriğini dene |
| Konsey exception'ında yalnız ödemeyi iade etmek atomiklik sağlar | Callback'i birinci ve son mutasyondan sonra düşür; bütün domain snapshotlarını karşılaştır | Doğrudan callback modelini bırak, prepare/commit/rollback domain komutlarına böl |
| Stratejik birlik maliyetini ayrıntılı stoğa eşlemek yeterlidir | Üretim, iptal, garnizon, savaş kaybı ve eski kayıt yollarında mal/kişi/ordu toplamını karşılaştır | K-12'yi yeniden aç; temsil ölçeği ve migration çözülmeden sayaç kaldırma |
| Tam test paketi yeterli kapanış kanıtıdır | Gerçek Electron setup→savaş→sonuç→save/continue kabulü | UI kabulü geçmeden operasyonu tamamlandı sayma |
| Bütün yüksek önemlileri tek dalgada çözmek daha hızlıdır | Değişen dosya/defter ve geri alma bağımlılık matrisi | Birbirinden bağımsız planlara böl; big-bang uygulamayı reddet |

## 6. Durdurma ve geri alma kuralları

- Yeni test mevcut kanıtlı bugı kırmızı yapmıyorsa implementasyon başlamaz.
- Bir düzeltme başka bir kanonik defterde açıklanamayan yeni fark üretirse o dilim
  geri alınır; sonraki dalgaya geçilmez.
- Ürün kararı gereken davranışta varsayım yapılıp kod yazılmaz.
- Aynı dosyada kullanıcı değişikliğiyle çakışma varsa kapsam daraltılır veya
  kullanıcı kararı istenir.
- Performans p95'i hedefli fixture'da yüzde 10'dan fazla kötüleşirse profil
  çıkarılmadan çözüm kabul edilmez.
- Save migration eski güncel kayıtları yükleyemiyorsa rollout durur.

## 7. Önerilen ilk dört ayrı uygulama planı

1. [Geçersiz Savaş Hedefi Guard Bugfix Planı](bugfix-story-invalid-battle-target-guard.md)
   — LIFE-04, düşük risk; ayrıntılı plan onaya hazır.
2. [Konsey Önergesi Atomikliği Bugfix Planı](bugfix-council-motion-atomicity.md)
   — COUNCIL-02, yüksek önem; ayrıntılı ve çürütülmüş plan onaya hazır.
3. `bugfix-logistics-reroute-terminal-release` — LOG-01, yüksek oyuncu etkisi,
   sınırı açık.
4. `bugfix-player-agency-life-gate` — CHAR-01; WORLD-02 ve şirket bypass'ının
   temel bağımlılığı, fakat izinli emekli kişisel eylemler allowlist kararı ister.

Üçüncü ve dördüncü dilim kullanıcı sırası/onayı sonrası ayrı dosyada
ayrıntılandırılacaktır. Bu toplam plan doğrudan implementasyon girdisi olarak
kullanılmayacaktır.

## 8. Tamamlanma ölçütü

- Bütün Confirmed bug kimlikleri ya düzeltilmiş ve testli, ya açık kullanıcı
  kararıyla tasarım kuyruğunda, ya da yeni karşı kanıtla Refuted durumundadır.
- P0 test listesi ve ilgili P1 çapraz-defter testleri yeşildir.
- Hedefli deterministik koşular, kayıt/devam ve gerçek Electron kabulü geçer.
- Atlas davranışı güncel kodla, TEST_GAPS gerçek boşluklarla, LEDGER tarihçeyle
  ve AKTIF-CALISMA tek sonraki hedefle uyumludur.
