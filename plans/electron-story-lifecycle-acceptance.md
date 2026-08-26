---
id: electron-story-lifecycle-acceptance
status: Draft
owner: osman
source: TG-01 / TG-05 / TG-31 / TG-32 / TG-33 / 25 Ağustos Atlas Operasyonu
touches:
  - electron/main.js
  - js/Story.js
  - js/StoryRender.js
  - tools/story-electron-lifecycle-test.js
  - tools/story-sim-harness.js
  - tools/story-test-manifest.js
  - tests/story-world.test.js
  - package.json
  - docs/README.md
  - docs/operations/AKTIF-CALISMA.md
  - docs/story/design/HIKAYE_MODU_SISTEM_ATLASI.md
  - BACKLOG.md
  - TEST_GAPS.md
  - OPTIMIZATIONS.md
  - LEDGER.md
depends_on:
  - worktree-reconciliation-no-delete
  - phase-38-13-meeting-closure-routing
  - phase-38-13-private-note-response
conflicts_with:
  - bugfix-story-invalid-battle-target-guard
  - bugfix-council-motion-atomicity
  - phase-38-13-meeting-closure-routing
  - phase-38-13-private-note-response
created: 2026-08-26
last_touched: 2026-08-26
---

# Electron Hikâye Yaşam Döngüsü Kabul Planı

## Amaç

Gerçek Electron uygulamasında menüden başlayan bir hikâye kampanyasının dünya
haritasından `mode: story` savaş motoruna, motorun terminal sonucundan dünya
mutasyonuna, ödüle, kayda ve yeni süreçte `Continue` akışına tek bir kanıt
zinciriyle bağlandığını doğrulamak.

Aynı çalışma diliminde geçersiz savaş hedefi hatası kapatılacak; UITEST ve
MAPTEST'in yanlış kanıt üreten gözlem kusurları düzeltilecek. Başsız simülasyon
paketi dünya simülasyonu paketi olarak kalacak ve gerçek Electron kabulünün
yerine geçtiği iddia edilmeyecek.

## Kapsam ve sınır

Bu plan şunları kapatır:

- TG-01: başsız harness'ın savaş girişini ve yenilgiyi stub'lamasından doğan
  yanlış güven;
- TG-05: geçersiz hedefin guard öncesinde dereference edilmesi;
- TG-31: gerçek hikâye savaş yaşam döngüsü Electron kabulünün bulunmaması;
- TG-32: UITEST PNG'sinin doğrulanan DOM durumundan eski bir kareyi göstermesi;
- TG-33: MAPTEST'in ölü border sayacı, boş taşıt örneği ve beklenmeyen rAF
  nedeniyle yanlış kırmızı olması.

Bu plan şunları karara bağlamaz:

- kayıp ve beraberlikte ödül verilip verilmeyeceği (TG-02);
- alınmamış `pendingReward` kaydının Continue sırasında hangi UX ile açılacağı
  (TG-03);
- son bölge kaybının hemen yenilgi mi, sürgün başlangıcı mı olduğu (TG-04);
- harita raster belleği, doğal yüzey dilimi veya görsel revision optimizasyonu.

Saldırı kaybı ve son-bölge savunma kaybı fixture'ları bu kararlarda mevcut
davranışı ürün sözleşmesi ilan etmez. Yalnız motor sonucunun dünya katmanına bir
kez ulaşmasını, savaş bağlamının kapanmasını ve gözlenen durumun raporlanmasını
kapılar.

## Kanıtlanan başlangıç durumu

- `tools/story-sim-harness.js:297-299`, `storyLaunchBattle`,
  `storyLaunchDefense` ve yenilgi kontrolünü devre dışı bırakıyor.
- UITEST karakter yaratıp dünya ekranında bitiyor.
- BATTLETEST yalnız `mode: quick` açıyor.
- PLAYTEST bütün `confirm` çağrılarını reddediyor ve arena otomasyonunu kapsam
  dışı bırakıyor.
- `storyLaunchBattle`, `node.owner` alanını `!node` kontrolünden önce okuyor.
- Savaş motoru üretimde `checkGameOver` içinden `storyOnBattleEnd` çağırıyor;
  kabul testi bu bağlantıyı doğrudan çağrıyla atlamamalı.
- `storySave` pendingReward dahil kanonik dünyayı localStorage'a yazıyor;
  `storyContinue` yüklemeden sonra doğrudan dünya ekranına giriyor.
- UITEST, ekran doğrulamasından önce PNG çekebiliyor.
- MAPTEST artık üretilmeyen border katmanı için `builds === 1` bekliyor,
  hiç doldurulmayan `presentationSamples` dizisini okuyor ve hover rAF'ını
  beklemiyor.

## Değişmezler

- Test, `storyOnBattleEnd` veya `storyTransferNodeOwnership` fonksiyonunu savaş
  sonucu üretmek için doğrudan çağırmaz.
- Deterministik kanca yalnız savaş motorunun terminal girdisini hazırlar;
  üretim `checkGameOver → storyOnBattleEnd → storySave` sırası aynen çalışır.
- Her senaryo ayrı geçici `userData` profili kullanır. Yalnız aynı senaryonun
  kayıt/devam fazları aynı profili paylaşır.
- Oyuncunun gerçek profili ve kayıtları okunmaz, değiştirilmez veya temizlenmez.
- Savaş sonucu dünya mutasyonu, telemetri terminali ve kayıt en fazla bir kez
  oluşur.
- Geçersiz hedef `false` döndürür ve dünya snapshot'ında sıfır fark bırakır.
- Kayıp/beraberlik ödül politikası ve son-bölge kampanya politikası bu test
  tarafından meşrulaştırılmaz.
- MAPTEST ürün eşiğini düşürerek yeşile çevrilmez; yalnız yanlış ölçüm
  kaynakları değiştirilir.
- QA dışındaki render yolunda yeni kare-başı nesne tahsisi oluşmaz.
- PNG, aynı adımda doğrulanan ekranla eşleşir ve yanında makine-okunur manifest
  bulunur.

## Test mimarisi

### Dış koşucu

Yeni `tools/story-electron-lifecycle-test.js`:

1. Her senaryo için geçici profil ve sonuç klasörü üretir.
2. Electron'u `--storylifecycletest`, senaryo, faz, profil ve sonuç dosyasıyla
   child process olarak çalıştırır.
3. Saldırı zaferinde ilk süreç kapandıktan sonra aynı profille `resume` fazını
   açar; diğer senaryolarda profil paylaşmaz.
4. Exit code, zaman aşımı, renderer ölümü ve sonuç şemasını birlikte doğrular.
5. Başarılı çalışma sonunda yalnız geçici profili temizler; hata kanıtlarını
   `qa-runtime/story-lifecycle/` altında bırakır.

`package.json` içinde tek, açık bir komut bulunur:

```text
npm run story:lifecycle-test
```

### Electron kabul modu

`electron/main.js`, `--storylifecycletest` için MAPTEST gibi izole profil
zorunluluğu uygular. Mod gerçek pencereyi ve gerçek renderer dosyalarını açar.
Ortak yardımcılar şunları sağlar:

- `waitForScreen(screen, visibleRoot, timeout)`;
- `settlePaint`: `document.fonts.ready`, iki rAF ve gizli pencere için sınırlı
  zaman aşımı fallback'i;
- `captureEvidence`: PNG ile aynı adım kimliğini taşıyan JSON manifest;
- `readCanonicalSnapshot`: sahiplik, havuz, komutan, refah, itibar,
  pendingReward, battleCtx, telemetri terminal sayısı ve kayıt özeti;
- `finishScenario`: tek sonuç dosyası ve tek exit code.

Test-only terminal hazırlığı global oyuncu koduna eklenmez. Electron kabul
bloğu renderer içinde savaş başladıktan sonra birimlerin terminal durumunu
hazırlar ve üretim `checkGameOver` fonksiyonunu çalıştırır. Sonuç adapterini
doğrudan çağırmak yasaktır.

## Senaryolar

### A — Saldırı zaferi ve ikinci süreçte Continue

1. Gerçek UI ile Yeni Hikâye → devlet → karakter → 12 soru → dünya yolu.
2. Sabit seed'de komşu ve yetkili hedef seçimi; düşmanlık gerekiyorsa üretim
   diplomasi komutuyla hazırlanır.
3. Gerçek `storyLaunchBattle` ile `BATTLE_SESSION.mode === 'story'` kapısı.
4. Savaş motoru kırmızı taraf terminal kaybına hazırlanır; `checkGameOver`
   üretim sonucunu işler.
5. Hedef sahipliği, şehir/komutan havuzları, refah, itibar, battleCtx,
   pendingReward, save ve terminal olay sayısı önce/sonra karşılaştırılır.
6. Bir ödül UI üzerinden seçilip bir kez alınır; ikinci talep `false` ve sıfır
   fark üretir.
7. Süreç kapatılır. Aynı profil yeni Electron sürecinde açılır; gerçek Continue
   düğmesiyle dünya yüklenir ve kanonik snapshot/hash ilk sürecin kayıt sonuyla
   eşleşir.

### B — Saldırı kaybı

Gerçek saldırı köprüsü açılır; motor mavi taraf terminal kaybına hazırlanır.
Hedef sahipliği savunanda kalmalı, havuz dönüş/kayıp hesabı ve dünya etkileri
bir kez işlenmeli, battleCtx temizlenmelidir. `pendingReward.won === false`
gözlenir; ödülün talep edilebilirliği TG-02 kararı verilmeden kapı yapılmaz.

### C — Son-bölge savunma kaybı

Fixture, diğer oyuncu bölgelerini kanonik sahiplik komutuyla savaş öncesinde
devreder; son bölgede gerçek `storyLaunchDefense` açılır. Motor mavi terminal
kaybı üretir. Son bölge devri, battleCtx temizliği, tek save ve tek terminal
olay kapılanır. Kampanyanın hemen bitmesi veya sürgüne devam etmesi yalnız
`observedCampaignState` olarak raporlanır; TG-04 kararı değildir.

## Uygulama dilimleri ve efor

### 1. Kırmızı temel ve geçersiz hedef — 0,5 kişi-gün

- Gerçek `storyLaunchBattle` referansını harness stub'ından önce yakala.
- Bilinmeyen, null ve sahibi bozuk hedeflerde exception/false ve tam dünya
  snapshot farkını ölç.
- Mevcut kodda kırmızıyı doğrula; guard sırasını düzelt.
- Ayrı geçerli düşman ve barış hedefi regresyonlarını koru.

### 2. Electron koşucu, saldırı zaferi ve devam — 1,5 kişi-gün

- Dış koşucu, izole profil, sonuç şeması ve zaman aşımı.
- Gerçek UI kampanya kurulumu ve gerçek story savaş köprüsü.
- Üretim terminal zinciri, ödülün tek talebi, süreç kapanışı ve ikinci süreçte
  Continue doğrulaması.
- İlk günün sonunda iki süreçli saldırı zaferi çalışmıyorsa kapsam sessizce
  daraltılmaz; kalan tahmin ve engel yeniden değerlendirilir.

### 3. Kayıp senaryoları — 0,5 kişi-gün

- Saldırı kaybı ve son-bölge savunma kaybı.
- Karar bekleyen ürün alanları assertion değil açık gözlem olarak raporlanır.
- Her senaryonun profili ve sonucu bağımsızdır.

### 4. UITEST boyalı-kare kanıtı — 0,5 kişi-gün

- Ortak settle/capture yardımcısını ekle.
- Görüntüyü assertion sonrasına taşı; ekran adı, görünür kök ve monoton adım
  kimliğini JSON manifestine yaz.
- Gizli pencere rAF fallback'ini süre aşımıyla sınırla.

### 5. MAPTEST yanlış alarmları — 0,5 kişi-gün

- Ölü border `builds === 1` varsayımını aktif politik overlay tanısına bağla
  veya üretici yokluğu açık sözleşmeyse kaldır.
- Taşıt hareketini önce mevcut `snapshot.displayAgents` üzerinden iki boyalı
  kare arasında ölç; yeterli değilse yalnız QA bayrağında yeniden kullanılan
  sabit kapasiteli sayısal tampon kullan.
- Hover event'inden sonra rAF/paint turunu bekle.
- Uzak/orta/yakın ve etkileşim p95 eşiklerini değiştirmeden maptesti yeniden
  çalıştır.

Toplam: 3,5 kişi-gün. Dokümantasyon ve hedefli yeniden koşum her dilimin
eforuna dahildir.

## Planı çürütme

| Plan iddiası | Karşı test | Çürütülürse yapılacak |
|---|---|---|
| Yeni kabul gerçek E2E'dir | Çağrı izi `checkGameOver → storyOnBattleEnd → storySave` göstermeli | Adapter doğrudan çağrılıyorsa kabul reddedilir |
| Deterministik sonuç motoru atlamaz | `BATTLE_SESSION.mode`, motor özeti ve terminal reason zorunlu | Yalnız `won` enjekte ediliyorsa kanca yeniden tasarlanır |
| Kayıt/devam süreçler arasıdır | PID ve Electron başlangıç kimliği farklı, userData aynı | Aynı renderer reload'u kabul edilmez |
| Senaryolar birbirini kirletmez | Profil yolları ve başlangıç save hash'leri farklı | Ortak profil kullanımı kaldırılır |
| Test ürün kararını gizlice vermez | Loss reward ve son-bölge durumu yalnız observed alanında | Assertion varsa plan TG-02/TG-04 kararına döner |
| Geçersiz hedef düzeltmesi yan etkisizdir | Üç bozuk hedefte tam snapshot eşitliği | Guard öncesi başka mutasyon varsa kapsam açılır |
| UITEST PNG'si doğrulanan ekranı gösterir | Manifest ekranı, DOM ekranı ve PNG adımı aynı | Sadece sleep artırımı kabul edilmez |
| MAPTEST düzeltilirken eşikler gevşetilmedi | Önce/sonra threshold diff'i sıfır | Eşik değişikliği ayrı performans kararı olur |
| Taşıt tanısı üretimi yavaşlatmaz | QA bayrağı kapalı allocation yolu aynı | Render tanısı geri alınır, snapshot yolu kullanılır |
| 3,5 gün yeterlidir | 1,5 gün sonunda iki süreçli zafer kapısı yeşil | Değilse tampon tüketmeden plan yeniden tahmin edilir |

## Doğrulama kapısı

- Yeni lifecycle testi mevcut kodda en az TG-05 ve eksik kabul nedeniyle kırmızı
  kanıt üretir.
- Üç senaryoda `mode: story` ve üretim terminal zinciri görülür.
- Saldırı zaferi yeni Electron sürecinde gerçek Continue ile aynı kayıt hash'ine
  döner; ödül ikinci kez alınamaz.
- Kayıp senaryoları tek terminal, tek mutasyon ve temiz battleCtx üretir.
- UITEST PNG/manifest/screen assertionı aynı adımı gösterir.
- MAPTEST yanlış border/transport/hover sorunları olmadan çalışır; gerçek bellek
  ve dilim bulgularını raporlamaya devam eder.
- Hedefli headless testler, UITEST, MAPTEST ve lifecycle testi exit 0 verir.
- `git diff --check` ve belge bağlantı taraması temizdir.
- TEST_GAPS yalnız gerçek kanıt üretildikten sonra kapatılır; OPTIMIZATIONS
  performans bulguları açık kalır.

## Risk ve geri alma

- En yüksek risk Electron ana süreç dosyasındaki test modlarının daha da
  büyümesidir. Ortak yardımcılar yalnız QA bloğunda tutulur; oyun başlangıç
  sırasına dağılmaz.
- Windows'ta child process kapanışı profil kilidini geç bırakabilir. Koşucu,
  ikinci fazdan önce temiz çıkışı ve profil kilidinin bırakılmasını bekler;
  sabit uzun sleep çözüm sayılmaz.
- Test-only terminal hazırlığı üretim oyuncu yüzeyine sızarsa bütün lifecycle
  kısmı geri alınır.
- Guard, UITEST, MAPTEST ve lifecycle koşucusu ayrı commit/geri alma dilimleri
  olarak tutulur; tek büyük patch zorunlu değildir.

## Onay durumu

10 kişi-günlük döngü ve bu işin ilk sırada olması 26 Ağustos 2026'da kullanıcı
tarafından onaylandı. Bu ayrıntılı plan henüz Draft'tır; kaynak koduna uygulama
yetkisi için planın ayrıca onaylanması gerekir.
