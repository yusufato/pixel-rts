---
id: 25-agustos-arsiv-duzenlemesi
status: Landed
owner: osman
source: ad hoc — 25 Ağustos Atlas Operasyonu kullanıcı talimatı
touches:
  - docs/**/*.md
  - mockup/**/*.html
  - tests/**/*.js
  - tools/**/*.js
  - package.json
  - README.md
  - _arsiv/**
  - qa-screenshots/**
  - "Oyun tasarımı planı/**"
  - hikaye-modu-haritasi.png
depends_on: []
conflicts_with: []
created: 2026-08-25
last_touched: 2026-08-26
superseded_by: plans/25-agustos-belge-hedefleme-duzeni.md
---

MODE: PLAN

> **25 Ağustos 2026 kapsam kararı:** Kullanıcı, güncel dosyaların beklenenden
> fazla olduğunu doğruladı ve toplu arşivleme hedefini durdurdu. M2/gece/arşiv
> silme Makine 2 kayıtları aktif kalacaktır. Bu plan yalnız gerçekleşmiş
> taşıma kararlarının tarihsel gerekçesidir; yeni çalışma düzeni
> `25-agustos-belge-hedefleme-duzeni.md` tarafından yönetilir.

# 1) Refactor Thesis

- **Somut sorun:** Yaşayan planlar, tarihsel deney raporları, üretilmiş loglar,
  bayat test beklentileri ve halen çalışan uyumluluk yolları aynı aramalarda
  “güncel gerçek” gibi görünüyor. Bu; yanlış dosyayı düzenleme, kapanmış bir
  tasarımı yeniden uygulama ve geçersiz bir testi runtime sözleşmesi sanma
  maliyeti yaratıyor.
- **Kanıt:**
  - Kullanıcı tarafından `_arsiv/` altına taşınan savaş odası ve QA varlıklarının
    eski yolları `docs/ux/qa/design-qa.md`, `docs/battle-ai/design/3D-RENDER-SOZLESMESI.md`
    ve `mockup/*.html` içinde hâlâ referanslıdır.
  - `tests/story-hex-land-management.test.js` ve
    `tests/story-visual-placement.test.js` hiçbir npm/araç girişinde adla kayıtlı
    görünmemesine rağmen ikisi de geçer ve benzersiz sözleşme doğrular. “Girişte
    yok = geçersiz” varsayımı yanlıştır.
  - `js/BattleBeonai.js`, `BattleBeonaiModelBC.js`, `BattleBeonaiModelBCv2.js`,
    `BattlePlanning.js` ve `StoryAI.js` eski görünebilen adlarına rağmen
    `index.html` tarafından canlı yüklenir; araç ve test tüketicileri vardır.
  - Electron başlangıcı `electron/main.js:67` üzerinden doğrudan kök
    `index.html` dosyasını açar; `package.json:123` aynı dosyayı EXE paketine
    alır. Kurulu EXE içindeki kopyanın çalışması kaynak girişinin ölü olduğunu
    göstermez.
  - `js/` altında 149 JavaScript dosyası vardır: 144'ü `index.html` tarafından
    doğrudan ve eksiksiz yüklenir; kalan beş dosyanın tamamının worker,
    Electron veya aktif araç tüketicisi vardır. Güncel kanıtta `js/` altında
    doğrudan arşivlenebilir referanssız dosya yoktur.
  - 54 `tests/*.test.js` dosyasından yalnız ikisi adla bir runner'a kayıtlı
    değildir; ikisi de tekil koşuda geçmiştir. Bu iki dosya arşiv adayı değil,
    eksik test-kayıt adayıdır.
  - `docs/kayit-m2/` tarihsel log görünümündedir, fakat beş `tools/m2-*.sh`
    ailesi hâlâ bu yollara yazar. Yalnız logları taşımak eski dizini yeniden
    üretir.
  - `docs/README.md`, `battle-ai/plans/PLANLAR.md` için açıkça “karar gerekli”
    der; tarihsel kapanışlarla açık eğitim maddeleri ayrıştırılmadan taşımayı
    yasaklar.
- **Bitti tanımı:** Her aday `ACTIVE`, `REPAIR`, `ARCHIVE` veya `DECISION`
  sınıfına kanıtla atanmış; yalnız `ARCHIVE` satırları taşınmış; eski-yeni yol
  ve gerekçe `_arsiv/README.md` içinde kayıtlı; canlı referans ve benzersiz test
  kaybı sıfırdır.
- **Neden şimdi:** 25 Ağustos Atlas Operasyonu güncel oyun gerçeğini yeniden
  kurarken eski kayıt gürültüsü doğrudan yanlış teşhis üretmektedir. Kullanıcı
  ilk arşiv dalgasını zaten başlatmıştır; yarım taşıma bağlantı borcu yaratmıştır.
- **Recommendation:** `Proceed with reduced scope`. Önce mevcut taşıma dalgası
  mutabakatlı biçimde tamamlanmalı ve aday envanteri kurulmalı; savaş AI,
  hikâye ve testler kanıtsız toplu taşınmamalıdır.

# 2) Invariants (must not change)

- `index.html` script listesi/sırası ve Electron paketleme girdileri değişmez.
- Kök `index.html` aktif uygulama kaynağı olarak yerinde kalır. Yalnız mevcut
  kurulu EXE'yi dondurup kaynak projeyi yeniden derlenemez hâle getirme kararı
  açıkça alınırsa bu değişmez ayrı bir emeklilik planında kaldırılabilir.
- Oyun runtime davranışı, kayıt şemaları, eski kayıt göçleri, RNG ve scheduler
  sırası byte/davranış düzeyinde değişmez.
- `npm test`, `test:story`, oyuncu-eylemi ve altyapı komutlarının kapsadığı test
  kümesi küçülmez; geçerli fakat kayıtsız testler arşivlenmez.
- Bir test dosyası ancak bütün assertionları canlı/superseding testte eşlenmişse
  arşiv adayı olabilir. Bayat tek assertion, bütün dosyanın arşiv gerekçesi değildir.
- `LEDGER.md` taşınmaz, budanmaz veya yeniden yazılmaz; gerçekleşmiş olayların
  append-only evidencesidir. `RCA.md` ve `TEST_GAPS.md` ise güncel snapshot
  sahipleri olarak kökte kalır.
- Kanonik girişler `docs/README.md`, `docs/story/README.md` ve
  `docs/battle-ai/README.md` üzerinden bulunabilir kalır.
- Arşivlenen içerik byte olarak korunur; eski yol, yeni yol, tarih, gerekçe ve
  yerine geçen kanonik kaynak `_arsiv/README.md` içinde yer alır.
- Kullanıcının mevcut çalışma ağacı taşımaları geri alınmaz, üzerine yazılmaz ve
  yeniden yapılmaz; plan bunları başlangıç durumu kabul eder.
- Yeni kırık yerel Markdown/HTML bağlantısı ve canlı koddan `_arsiv` içeriğine
  runtime bağımlılığı oluşmaz.

# 3) Out of Scope

- Savaş ödülü, son-bölge yenilgisi, ekonomi veya diğer oyun buglarını düzeltmek;
  bunlar davranış değişikliğidir ve Atlas Operasyonu altında ayrı onay ister.
- `characterActivationBudgetProbe` içindeki bayat scheduler assertionını bu
  arşiv planında düzeltmek. Bu aktif test sözleşmesi kusurudur; dosya arşivleme
  konusu değildir.
- `js/**` altındaki runtime dosyalarını adlarında `legacy`, `old`, `BC` veya eski
  faz numarası geçtiği için taşımak.
- `index.html` dosyasını, kurulu EXE içinde gömülü bir kopyası bulunduğu için
  arşivlemek. Bu dosya Electron kaynak ve yeni paket üretim zincirinde canlıdır.
- Eski save migration/fallback kodlarını kaldırmak. Desteklenen kayıt sürümleri
  ayrıca tanımlanmadan bu kodların ölü olduğu kanıtlanamaz.
- Tarihsel içeriği silmek, sıkıştırıp erişilemez kılmak veya Git geçmişini
  “arşiv” yerine kullanmak.
- `docs/kayit-m2/` üreticilerini kullanıcı “operasyon emekli” kararı vermeden
  kaldırmak ya da log yollarını değiştirmek.
- `PLANLAR.md` içindeki açık maddelerin sahibi/önceliği hakkında ürün kararı vermek.

# 4) Preconditions

- Plan kullanıcı tarafından `Draft -> Approved` yapılmadan adım 1 başlamaz.
- Mevcut çalışma ağacı ve özellikle kullanıcı taşımaları commit/hash bazında
  envanterlenir; başka bir işlem aynı yolları değiştiriyorsa çalışma durur.
- `plans/` başlangıçta yoktu; arşivdeki `documentation-layout` planı `Landed`
  durumundadır. Canlı plan çakışması ve stale canlı plan bulunmadı.
- Başlangıç kapıları kaydedilir:
  - `git status --short`
  - `npm run test:story:plan`
  - `npm run test:story-player-agency`
  - `npm run test:story-infrastructure`
  - `node tests/story-hex-land-management.test.js`
  - `node tests/story-visual-placement.test.js`
- Tam hikâye paketi güncel olarak 85/88'de bilinen false negative ile durduğu
  için “tam yeşil” başlangıç varsayılmaz. Arşiv değişikliğinin bu sonucu daha
  erkene çekmemesi veya yeni hata üretmemesi gerekir; test-hatası düzeltmesi
  ayrı işte yapılır.
- Her aday için aşağıdaki dört kanıt satırı dolmadan `ARCHIVE` seçilemez:
  1. canlı referanslar,
  2. benzersiz davranış/bilgi,
  3. yerine geçen kanonik kaynak,
  4. geri dönüş yolu ve doğrulama komutu.

# 5) Step Sequence

| # | Step | Type (Mechanical/Judgment) | Files | Risk | Revertible alone |
|---|---|---|---|---|---|
| 1 | Arşiv denetleyicisi ve aday manifesti | Judgment | `tools/archive-audit.js`, `docs/operations/ARSIV_ADAY_ENVANTERI.md` | Low | Yes |
| 2 | Kullanıcının mevcut taşıma dalgasını mutabakatla kapat | Mechanical | mevcut taşınan yollar, referans belgeleri, `_arsiv/README.md` | Medium | Yes |
| 3 | Testleri ACTIVE/REPAIR/ARCHIVE olarak ayır | Judgment | `tests/**`, `package.json`, aday manifesti | High | Yes |
| 4 | Savaş AI plan ve raporlarını ayrıştır | Judgment | `docs/battle-ai/**`, `_arsiv/battle-ai/**` | High | Yes, dosya grubu bazında |
| 5 | Hikâye planı ve durum kayıtlarını ayrıştır | Judgment | `docs/story/**`, `_arsiv/story/**` | High | Yes, dosya grubu bazında |
| 6 | Üretilmiş log/operasyon kayıtlarını karara bağla | Judgment | `docs/kayit-m2/**`, `tools/m2-*.sh`, `_arsiv/operations/**` | Medium | Yes |
| 7 | Kanonik index ve provenance kayıtlarını yenile | Mechanical | domain README'leri, `_arsiv/README.md`, kök `README.md` | Medium | Yes |
| 8 | Bağlantı, test, paket ve diff kapılarını çalıştır | Mechanical | değişiklik yok | Low | N/A |

## Step 1 — Arşiv denetleyicisi ve aday manifesti

- **Goal:** Dosya yaşına değil canlı kullanım ve yerine-geçme kanıtına dayalı tek
  aday listesi üretmek.
- **Changes:** `tools/archive-audit.js` yerel Markdown/HTML bağlantılarını, npm ve
  manifest test girişlerini, `index.html` scriptlerini ve arşivden canlı referansı
  raporlar. `docs/operations/ARSIV_ADAY_ENVANTERI.md` her dosyayı `ACTIVE`,
  `REPAIR`, `ARCHIVE`, `DECISION` ve kanıt alanlarıyla listeler.
- **Verification:** `node tools/archive-audit.js`; çıkış kodu 0, sınıfsız aday 0,
  yeni kırık bağlantı 0 olmalı.
- **Rollback:** Bu iki yeni dosyayı tek commit ile geri al.
- **Commit message:** `chore(docs): add evidence-gated archive inventory`
- **Stop condition:** Araç dinamik, uzantısız veya string-birleşimli canlı
  referansları yakalayamıyorsa taşıma adımlarına geçme; manifestte bu yolları
  `DECISION` bırak.

## Step 2 — Mevcut taşıma dalgasını mutabakatla kapat

- **Goal:** Kullanıcının savaş odası, QA ekranları, harita görseli ve landed plan
  taşımalarını veri kaybetmeden tamamlamak.
- **Changes:** Git HEAD blobu ile `_arsiv` hedefinin hashini karşılaştır; eski
  yolları kullanan `docs/ux/qa/design-qa.md`,
  `docs/battle-ai/design/3D-RENDER-SOZLESMESI.md` ve `mockup/*.html`
  referanslarını yeni arşiv yollarına güncelle; `_arsiv/README.md`ye eski/yeni
  yol ve gerekçe tablosu ekle. `LEDGER.md`teki tarihsel kaynak metni değiştirme.
  Aynı dalgada aşağıdaki doğrulanmış harita-prototip adaylarını manifestte
  `ARCHIVE` olarak ele al:
  - `gercekci-harita.html` — HTML değil Markdown handoff; canlı referansı yok,
    arşivlenmiş `StoryGeoRender.js` ve artık bulunmayan `README-PATCH.md` yolunu
    teslim diye gösteriyor.
  - `yeni avrupa harita` — uzantısız eski hologram handoff metni.
  - `harita-yonleri.html`, `hologram-harita.html`, `Harita 2.5D.dc.html` ve
    `docs/harita-prototip.html` — Electron paketine girmez; oyun tarafından
    yüklenmez. `StoryRender.js` yalnız port edilen tekniklerin provenance'ını
    yorum satırında anıyor. Yorumlar yeni arşiv yoluna güncellenerek korunur.
  Bu gruba `tools/make-geodata.js` otomatik dahil edilmez; yeniden üretim aracı
  olarak canlı gereksinimi ayrıca kanıtlanmalıdır.
- **Verification:** `node tools/archive-audit.js`; `rg -n` ile eski savaş odası,
  `qa-screenshots/` ve kök harita yolları yaşayan dosyalarda sıfır olmalı.
- **Rollback:** Referans/provenance commitini geri al; kullanıcı taşıma commitine
  dokunma.
- **Commit message:** `docs(archive): reconcile 25 august asset moves`
- **Stop condition:** Eski ve yeni dosya hashleri uyuşmazsa veya bir hedef eksikse
  o dosyayı tamamlandı sayma; kullanıcı verisini seçerek üzerine yazma.

### 25 Ağustos 2026 kısmi yürütme kaydı

- Kaynak ve paket referansı bulunmayan altı harita prototipi
  _arsiv/25-agustos/harita-prototipleri altına taşındı.
- Harita 2.5D.dc.html içeriğinin HTML değil WebP olduğu doğrulandı ve arşivde
  Harita 2.5D.webp olarak adlandırıldı; ikili içerik değiştirilmedi.
- Eski ve yeni yol eşlemesi _arsiv/25-agustos/README.md içine kaydedildi.
- index.html taşınmadı: electron/main.js aktif pencereyi bu dosyadan yükler ve
  package.json onu EXE paketine dahil eder. Bu dosyanın taşınması ancak Electron
  giriş mimarisi ayrıca değiştirilip kaynak çalıştırma ile yeni paket üretimi
  doğrulandıktan sonra değerlendirilebilir.
- Step 2'nin kullanıcıya ait önceki taşıma mutabakatı ve yaşayan belge
  referanslarının tamamı henüz kapanmadığı için plan durumu Draft kalır.

### 25 Ağustos 2026 geniş envanter sonucu

- node_modules: 15.336 dosya ve yaklaşık 3,45 GB. Yeniden üretilebilir dependency
  cache olduğu için _arsiv'e taşınmadı.
- qa-runtime: 4.346 dosya ve yaklaşık 11,94 GB. İzlenen ve Electron tarafından
  okunan kompozisyonlar.json aktif yolunda bırakıldı; diğer yerel çıktılar,
  Git'ten dışlanan _arsiv/25-agustos/qa-runtime-gecmis alanına taşındı.
- tests: 54 dosya. 52 doğrudan package komutuna bağlıdır; iki kayıtsız test
  benzersiz davranışı tekil koşuda geçtiği için ACTIVE/REPAIR olarak tutuldu.
- tools: 248 dosya. Sırf package.json'da doğrudan görünmemek arşiv için yeterli
  sayılmadı; worker bağımlılıkları, manuel teşhisler ve kaynak provenance
  referansları korunuyor.
- scripts: 8 dosyadan çağrılmayan ve eski model varyantlarına sabitlenmiş
  pick-best.sh ile reconcile-retrain.sh arşive taşındı; kalan altı eğitim
  zincirinin yaşayan başlatıcı bağlantıları vardır.
- Kök: uzantısız PNG, eski ikon yedeği, tüketicisiz ham denge dökümü ve üç
  Electron-öncesi tarayıcı/masaüstü başlatıcısı arşivlendi.
- Tamamlanmış gece/M2 kuyrukları için karşı kanıt bulundu: yaşayan operasyon
  belgeleri hâlâ bu yolları çalıştırma talimatı olarak kullanıyor. Bunlar ancak
  ilgili docs/kayit-m2 ve battle-ai operasyon kayıtlarıyla birlikte emekliye
  ayrılacağı açıkça onaylanırsa taşınacak.

## Step 3 — Testleri ACTIVE/REPAIR/ARCHIVE olarak ayır

- **Goal:** Bayat assertionları düzeltme kuyruğuna, gerçek ölü testleri arşive,
  benzersiz geçerli testleri aktif pakete yönlendirmek.
- **Changes:** Her `tests/*.test.js` için runner referansı, assertion davranış
  eşlemesi ve tekil çalıştırma sonucu yaz. Geçen fakat kayıtsız
  `story-hex-land-management` ile `story-visual-placement` `ACTIVE` kalır ve
  uygun npm kapısına bağlanır. Aktivasyon scheduler assertionı `REPAIR` olur;
  `story-world.test.js` arşivlenmez. Yalnız tüm davranışı başka testte eşlenen
  dosyalar `ARCHIVE` adayıdır.
- **Verification:** Eski ve yeni test envanterlerinin assertion-sözleşme matrisi
  eşit veya daha geniş; ilgili npm komutları aynı/artan test sayısıyla geçer.
- **Rollback:** Test kayıt değişikliği ve varsa test taşımasını ayrı commitlerde
  geri al.
- **Commit message:** `test: classify live stale and superseded story checks`
- **Stop condition:** Bir testin yakaladığı gerçek bug adlandırılamıyorsa onu
  arşivleme; `DECISION` bırak ve test-gap incelemesine yönlendir.

## Step 4 — Savaş AI plan ve raporlarını ayrıştır

- **Goal:** Güncel savaş AI sözleşmesini tarihsel deney sonuçlarından ayırmak.
- **Changes:** `SAVAS_AI_TASARIM_PLANI.md`, `OLCUM-TUZAKLARI.md` ve
  `KAPI-DEFTERI.md` kanonik sahipler olarak kalır. `PLANLAR.md` içindeki açık
  maddeler güncel durum belgesine çıkarılmadan dosya taşınmaz. İlk inceleme
  kümesi geri bağlantısı olmayan tarihsel raporlar ve planlardır; her sonuç
  KAPI/LEDGER karşılığıyla eşlenirse `_arsiv/battle-ai/2026-08/` altına taşınır.
  Araçların doğrudan okuduğu raporlar, referans güncellenmeden taşınmaz.
- **Verification:** Savaş tezgâhı kaynak listesi değişmez; `rg` ile her taşınan
  basename için yaşayan referans 0; `node tools/archive-audit.js` geçer.
- **Rollback:** Plan ve rapor gruplarını ayrı commitlerde eski yoluna döndür.
- **Commit message:** `docs(battle-ai): archive superseded august evidence`
- **Stop condition:** Bir planın kuyruğunda açık iş, varsayılan-kapalı deney veya
  henüz kanoniğe taşınmamış metodoloji dersi varsa o dosyayı `DECISION` bırak.

## Step 5 — Hikâye planı ve durum kayıtlarını ayrıştır

- **Goal:** 25 Ağustos Atlasını güncel sistem gerçeğinin merkezi yaparken açık
  hikâye borçlarını kaybetmemek.
- **Changes:** Ana katmanlı plan, uygulama durumu, modern dünya eksikleri ve
  sohbet planı aktif kalır. `PLAN-KARAKTER-AI.md` ile
  `PLAN-HARITA-KAYNAKLARI.md`, atlasın güncel karakter/harita bölümlerine karşı
  satır satır karşılaştırılır; yalnız aktarılan ve artık çelişen tarihsel kısım
  arşivlenir. Tek belgede açık+tarihsel karışıksa önce iki belgeye ayrılır.
- **Verification:** Atlas sistem tablosunda her açık hikâye işi için kaynak veya
  açık karar bağlantısı vardır; story README bağlantıları geçer.
- **Rollback:** Hikâye alanı taşımasını tek commit olarak geri al.
- **Commit message:** `docs(story): separate current atlas from historical plans`
- **Stop condition:** Açık bir mekanik hedefin tek kaynağı taşınacak belgeyse
  arşivleme yapma.

## Step 6 — Üretilmiş log ve operasyon kayıtlarını karara bağla

- **Goal:** Tarihsel logları aktif üretici komutlardan ayırmak.
- **Changes:** `docs/kayit-m2/` için önce “operasyon devam ediyor mu?” kararı
  alınır. Devam ediyorsa `ACTIVE` kalır. Emekliyse loglar ve onları üreten/izleyen
  operasyon talimatları aynı atomik dalgada `_arsiv/operations/m2/` altına
  taşınır; çalışan genel araçlar güncel çıktı dizisine geçirilmeden eski yol
  kaldırılmaz.
- **Verification:** `rg -n "docs/kayit-m2" tools docs package.json` sonucu ya
  tamamen aktif sahipliği ya tamamen arşiv provenance'ını göstermeli; ikisi
  karışmamalı.
- **Rollback:** Log+üretici yolu commitini birlikte geri al.
- **Commit message:** `chore(operations): retire superseded m2 records`
- **Stop condition:** Kullanıcı operasyonun emekli olduğunu onaylamadıysa bu
  adım taşıma yapmadan `DECISION` ile biter.

## Step 7 — Kanonik index ve provenance kayıtlarını yenile

- **Goal:** Arama yapan insan ve araçların önce güncel kaynağa ulaşmasını sağlamak.
- **Changes:** `docs/README.md`, domain README'leri ve kök README yalnız aktif
  girişleri gösterir; tarihsel içerik `_arsiv/README.md` üzerinden bulunur.
  Her arşiv satırında `superseded-by` veya “yalnız tarihsel kanıt” açıklaması olur.
- **Verification:** `node tools/archive-audit.js`; kanonik girişlerde `DECISION`
  dışında arşivlenmiş dosya doğrudan aktif kaynak olarak sunulmaz.
- **Rollback:** Index/provenance commitini geri al.
- **Commit message:** `docs: publish canonical and archive indexes`
- **Stop condition:** Bir alanın kanonik giriş belgesi boş veya çelişkili kalırsa
  operasyonu o alanda kapatma.

## Step 8 — Son doğrulama

- **Goal:** Dosya düzeninin oyun ve test davranışını değiştirmediğini kanıtlamak.
- **Changes:** Yok.
- **Verification:** `git diff --check`; `node tools/archive-audit.js`;
  `npm run test:story-player-agency`; `npm run test:story-infrastructure`;
  `node tests/story-hex-land-management.test.js`;
  `node tests/story-visual-placement.test.js`; seçili savaş AI kaynak/tezgâh
  smoke kapıları. Tam paket bilinen aktivasyon false negative'inden daha erken
  veya farklı bir nedenle durmamalı.
- **Rollback:** Hata üreten son bağımsız adımı geri al; bütün operasyonu topluca
  geri alma.
- **Commit message:** N/A
- **Stop condition:** Yeni eksik script, test, asset, bağlantı veya farklı runtime
  hash'i görülürse plan `Landed` yapılmaz.

# 6) Risk Register

## Risk 1 — Mevcut kullanıcı taşıması yaşayan bağlantıları kırmış durumda

- **Title:** Arşiv hedefleri mevcut fakat yaşayan belgeler eski yolları kullanıyor
- **Category:** Referential integrity
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `docs/ux/qa/design-qa.md`, `docs/battle-ai/design/3D-RENDER-SOZLESMESI.md`, `mockup/*.html`
- **Evidence:** Eski `Oyun tasarımı planı/...` ve `qa-screenshots/...` yolları
  yaşayan dosyalarda bulunurken kaynaklar çalışma ağacında `_arsiv/` altındadır.
- **Why it matters:** Belge kanıtı ve mockup karşılaştırmaları açılamaz; arşiv
  yarım kalır.
- **Recommended fix:** Step 2'de hash mutabakatı sonrası bütün yaşayan referansları
  tek committe güncelle.
- **Tradeoffs / Risks:** Dışarıdan eski GitHub yoluna bağlanan linkler yine 404
  olabilir; arşiv provenance haritası depo içi keşfi korur.

## Risk 2 — Eski görünen canlı kod veya benzersiz test yanlışlıkla arşivlenebilir

- **Title:** Adlandırma ve runner kaydı ölü-kod kanıtı değildir
- **Category:** Behavior loss
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `index.html:538,564,566-567,640`; iki kayıtsız story testi
- **Evidence:** Battle/Story AI dosyaları canlı script etiketlerinde; iki npm'de
  adı geçmeyen test tekil koşuda başarıyla benzersiz sözleşme doğruladı.
- **Why it matters:** Oyun açılışı, savaş AI veya korunmayan bir davranış sessizce
  kaybolabilir.
- **Recommended fix:** Dört kanıt kapısı ve assertion eşleme matrisi olmadan
  runtime/test dosyası taşıma.
- **Tradeoffs / Risks:** Envanter çalışması arşiv hızını düşürür; yanlış taşıma
  riskini anlamlı biçimde azaltır.

## Risk 3 — Tarihsel log yolu aktif araçlarca yeniden üretilebilir

- **Title:** `docs/kayit-m2` arşivlense bile aktif shell araçları eski yolu yazar
- **Category:** Operational drift
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `tools/m2-kuyruk*.sh`, `tools/m2-rapor-dongusu.sh`
- **Evidence:** Araçlar dizini oluşturup doğrudan bu loglara yazıyor.
- **Why it matters:** Temizlikten hemen sonra aynı eski kayıt alanı yeniden doğar;
  iki kaynak sahibi oluşur.
- **Recommended fix:** Log ve üreticiyi tek karar/commit sınırında ele al; operasyon
  emekli değilse taşıma.
- **Tradeoffs / Risks:** Aktif iki-makine iş akışı varsa arşiv ertelenir.

## Risk 4 — Eski planların içinde tekil açık kararlar kaybolabilir

- **Title:** Sıfır geri bağlantılı planlar bile uygulanmamış açık mekanik taşıyor
- **Category:** Knowledge loss
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `docs/battle-ai/plans/PLAN-KARSI-TAKTIK.md`, `PLAN-PROJE-YOL-HARITASI.md`, `PLAN-TURNUVA-MERDIVENI.md`
- **Evidence:** Dosya sonlarında başlanmamış karşı-plan/tahmin, canlıya bağlanmamış
  arama ve onay bekleyen turnuva işleri yazılıdır.
- **Why it matters:** Dosyayı “eski” diye taşımak güncel backlogu görünmez yapar.
- **Recommended fix:** Açık maddeleri kanonik aktif duruma taşı; belgeyi ancak
  ardından tarihsel olarak işaretle/arşivle.
- **Tradeoffs / Risks:** Aynı maddenin iki yerde kopyalanmaması için kesim noktası
  insan incelemesi gerektirir.

## Risk 5 — Tam paket tek başına arşiv güvenlik kapısı olamaz

- **Title:** Bilinen test false negative'i yeni arşiv regresyonunu maskeleyebilir
- **Category:** Verification quality
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `tools/story-sim-harness.js:16183`, `RCA.md`
- **Evidence:** Tam paket 85/88'de metadata sırasını runtime sırası sanan assertionla
  durur.
- **Why it matters:** “Zaten kırmızıydı” denilerek yeni eksik dosya veya bağlantı
  hatası gözden kaçabilir.
- **Recommended fix:** Hedefli kapılar, archive-audit ve hata-imzası karşılaştırması
  kullan; test sözleşmesi düzeltmesini ayrı planla yap.
- **Tradeoffs / Risks:** Tam yeşil tek sayı yerine daha ayrıntılı başlangıç kaydı gerekir.

# 7) Abort Criteria

- Bir dosyanın yerine geçen kanonik sahibi veya benzersiz bilgi eşlemesi yoksa o
  dosya taşınmaz; manifestte `DECISION` kalır.
- Arşiv hedefi Git HEAD kaynağıyla hash eşleşmiyorsa Step 2 durur. Kabul edilebilir
  kalıcı durak: Step 1 tamamlanmış envanter.
- Herhangi bir taşıma yeni runtime/script/test eksikliği üretirse yalnız ilgili
  domain commit'i geri alınır. Kabul edilebilir kalıcı durak: Step 2 sonrası
  mutabakatlı mevcut kullanıcı arşivi.
- Savaş AI açık işleri tek kanonik kaynağa çıkarılamazsa Step 4 arşiv taşıması
  yapmadan biter. Step 1–3 yine net iyileşmedir.
- Hikâye planı ile Atlas arasında ürün kararı gerektiren çelişki varsa Step 5
  `DECISION` kaydıyla durur; çelişki sessizce çözülmez.
- M2 operasyonunun canlılığı belirsizse Step 6 taşımasız biter.
- Yeni kırık bağlantı, daha az test kapsamı veya farklı runtime hash'i varken
  plan `Landed` yapılmaz.

# 8) Post-Refactor Verification

- Başlangıç ve bitiş `git status`, runtime script listesi, npm script listesi ve
  test envanteri karşılaştırılır; yalnız onaylı yol/index farkları bulunmalıdır.
- `node tools/archive-audit.js` yerel bağlantı, sınıfsız aday, canlı `_arsiv`
  runtime bağı ve eski yol referansı için sıfır hata vermelidir.
- Hedefli hikâye ve altyapı testleri aynı/artan test sayısıyla geçmelidir.
- Arşivlenen her dosyadan rastgele en az bir örnek eski-yeni hash ve README
  provenance satırıyla geri getirilebilir olmalıdır.
- Electron paket dosya listesi değişmemelidir; `js/**`, `assets/**`, `index.html`
  ve `style.css` dışında belge/arşiv yolları pakete girmemelidir.
- İlk bir hafta yeni belge ve test çalışmalarında yanlış eski kaynak kullanımının
  tekrar edip etmediği `rg` ve code review ile izlenir.
- Geçici borçlar:
  - `DECISION` satırları yalnız kullanıcı/triage kararıyla kapanır.
  - Test `REPAIR` satırları ayrı test-hardening planına aktarılınca manifestten
    kaldırılır.
  - Eski yol uyumluluk notları dış bağlantı kullanımı olmadığı doğrulanınca
    sadeleştirilebilir.

Onaylayan kişi `Draft -> Approved` geçişinden önce özellikle üç şeyi tartmalıdır:
mevcut kullanıcı taşımalarının hedef yolları doğru mu, M2 operasyonu gerçekten
emekli mi ve savaş AI `PLANLAR.md` içindeki açık maddelerin yeni sahibi hangi
kanonik belge olacak?
