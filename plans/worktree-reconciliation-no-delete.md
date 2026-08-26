---
id: worktree-reconciliation-no-delete
status: Landed # Kullanıcı 26 Ağustos 2026 tarihinde onayladı
owner: osman
source: BACKLOG.md plan soy ağacı düzeltmesi / kullanıcı sıralı onayı
touches:
  - .gitignore
  - .gitattributes
  - '*.bat'
  - '*.html'
  - '*.png'
  - '*.txt'
  - memory.json
  - _arsiv/**
  - mockup/**
  - qa-runtime/kompozisyonlar.json
  - qa-screenshots/**
  - docs/**
  - plans/**
  - BACKLOG.md
  - LEDGER.md
  - OPTIMIZATIONS.md
  - RCA.md
  - TEST_GAPS.md
depends_on: []
conflicts_with:
  - 25-agustos-hikaye-modu-toplam-bugfix-plani
  - bugfix-council-motion-atomicity
  - bugfix-story-invalid-battle-target-guard
  - electron-story-lifecycle-acceptance
created: 2026-08-26
last_touched: 2026-08-26
---

# Kirli Çalışma Ağacını Silmeden Uzlaştırma Planı

## 1) Refactor Thesis

Çalışma ağacı 96 durum satırı taşıyor: 58 silme, 9 staged taşıma, 6 değişiklik
ve 23 izlenmeyen yol. Bu durum yeni uygulama planlarının güvenli kapsam, diff ve
commit sınırı kurmasını engelliyor. Plan kapsamındaki izlenen oyun kaynakları
(`js/`, `electron/`, `tools/`, `tests/`, `package.json`, `index.html`,
`style.css`) temiz; kirlilik arşivleme, belge/rapor ve QA kanıtı katmanında.

Hash denetiminde 58 silmenin 21'i `_arsiv` altında byte-byte eş kaynakla
korunmuş, 9 ayrı taşıma Git indexinde `R100` olarak staged durumda. Beş tasarım
handoff metni yalnız LF→CRLF satır sonu dönüşümü nedeniyle farklı; beş harita
prototipi ise arşiv notu eklendiği için özgün blobla aynı değil. Kalan 27 yolun
arşivde byte-eş karşılığı yoktur; bunlar doğrulanmadan silme olarak
commitlenemez.

**Done:** Çalışma ağacı temiz, her eski blob ya aktif yerinde ya da checksum'lı
arşiv yolunda bulunuyor, yaşayan belge/rapor ve QA kanıtı ayrı commitlerde,
oyun kaynakları HEAD ile aynı.

**Why now:** 71 fazlı ana planın gerçek aktif noktasını uzlaştırmak ve sonraki
uygulamaları ayrı diff/commit sınırında yürütebilmek için önce güvenilir bir
taban gerekiyor.

**Recommendation:** Proceed with reduced scope. Hiçbir oyun davranışı veya plan
içeriği yeniden tasarlanmayacak; yalnız mevcut çalışma kaydı kayıpsız biçimde
sınıflandırılıp sürümlenecek.

## 2) Invariants (must not change)

- Hiçbir izlenen blob, byte-eş aktif veya arşiv karşılığı doğrulanmadan kayıp
  olarak commitlenmez.
- M2/gece araçları kullanıcı kararı gereği aktif kalır; `AI-EGIT-GECE.bat`,
  `BEYIN-TURNUVA.bat` ve `DIVERSE-SELFPLAY.bat` kökte geri yüklenir.
- `js/`, `electron/`, `tools/`, `tests/`, `package.json`, `index.html` ve
  `style.css` içerikleri HEAD ile byte düzeyinde aynı kalır.
- `index.html` Electron'un aktif/paketlenen kaynağı olarak yerinde kalır.
- 10 Ağustos ve sonrası QA runtime çıktıları yerinde kalır.
- Eski QA ve tasarım kanıtı silinmez; aktif yola dönmeyecekse `_arsiv` altında
  özgün blob karmasıyla korunur.
- 71 fazlı ana plan kanonik üst yol; sohbet ve hex alt/çapraz program; 2B harita
  tamamlaması sonraki sıra olarak kalır.
- Draft bugfix planları uygulanmaz veya içerik olarak yeniden yazılmaz.
- `LEDGER.md` yalnız mevcut append-only içeriğiyle sürümlenir; geçmiş girdiler
  düzenlenmez.
- Her commit tek amaçlıdır ve tek başına geri alınabilir.

## 3) Out of Scope

- Oyun kaynak kodu, test davranışı veya Electron çalışma zamanı değişikliği.
- 71 fazlı ana planın hangi kısmi fazda olduğunun çözülmesi; bu sonraki sıradır.
- Bugfix planlarını `Approved`, `In Progress`, `Landed` veya `Abandoned` yapmak.
- Yeni arşiv adayı aramak veya güncel dosyaları yaş/kullanım varsayımıyla taşımak.
- `node_modules`, model dosyaları veya 10 Ağustos sonrası `qa-runtime` içeriğini
  sürümlemeye çalışmak.
- QA görüntülerinin görsel doğruluğunu yeniden değerlendirmek; bu plan yalnız
  mevcut kanıtı korur.
- Geçmiş commitleri rewrite/rebase etmek.

## 4) Preconditions

- Kullanıcı bu planı insan kararıyla `Draft → Approved` yapmalıdır.
- Mevcut dal `savas-ai-mikrofix-konsantrasyon` üzerinde kirli arşiv dalgasını
  commit etmek yerine `atlas/worktree-reconciliation-2026-08-26` güvenlik dalı
  açılması onaylanmalıdır. Dal açma içerik değiştirmez ve rollback çıpasıdır.
- Dört çakışan Draft plan bu plan Landed olana kadar uygulanmayacaktır. Bu,
  kullanıcının “sıra bittikçe sonraki sıra” kararıyla çözülmüş yürütme sırasıdır;
  implementer aynı anda başka plan açmamalıdır.
- 58 silinen yol ve bunlardan ayrı 9 staged R100 taşıma için
  `HEAD blob → hedef blob` manifesti üretilmeli. Manifest tamamlanmadan hiçbir
  `git add -A` veya commit çalıştırılmamalıdır.
- Satır sonu dönüşmüş beş handoff dosyasının mevcut CRLF arşiv kopyası yerinde
  tutulur; özgün HEAD blobu aynı dizindeki `orijinaller/` altında ayrıca korunur.
- Git clean filtresinin dokuz arşiv varyantını yeniden yazmaması ve ham CRLF
  bloblarını metin whitespace denetimine sokmaması için yalnız bu yollar
  `.gitattributes` içinde `binary` olarak işaretlenir.
- Önceki açık “10 Ağustos öncesi qa-runtime sil” kararı kayıp üretmeme kuralıyla
  uzlaştırılır: `qa-runtime/kompozisyonlar.json` aktif yola dönmez, fakat özgün
  HEAD blobu arşivde korunur.
- Stale plan yoktur; bütün Draft planlar 14 günlük eşik içindedir.

Preconditions karşılanmadan Adım 1 başlamaz.

## 5) Step Sequence

| # | Step | Type | Files | Risk | Revertible alone |
|---|---|---|---|---|---|
| 1 | Güvenlik dalı ve kayıp manifesti | Mechanical | `_arsiv/25-agustos/worktree-reconciliation-manifest.json` | Low | Yes |
| 2 | Eşsiz 27 blobu geri getir/koru | Mechanical | kök gece araçları, eski harita/QA yolları, `_arsiv/**` | Medium | Yes |
| 3 | Arşiv dalgasını tek committe kapat | Mechanical | staged 9 taşıma, 26 exact taşıma, 5 anotasyonlu prototip, kurtarılan bloblar | Medium | Yes |
| 4 | Yaşayan belge ve plan kaydını commit et | Judgment | `docs/**`, `plans/**`, dört kök rapor, BACKLOG/LEDGER | Medium | Yes |
| 5 | Güncel Electron QA kanıtını commit et | Mechanical | `qa-screenshots/atlas-uitest-20260825/**` | Low | Yes |
| 6 | Temiz taban ve davranışsızlık kapısı | Mechanical | çalışma ağacı ve Git kayıtları | Low | N/A |

### Step 1 — Güvenlik dalı ve kayıp manifesti

- **Goal:** Mevcut kirli durumun geri dönüş çıpasını ve makine-okunur envanterini
  oluşturmak.
- **Changes:** Yeni güvenlik dalı aç; her silinen yol için HEAD blob karması,
  sınıf (`exact archive`, `annotated archive`, `missing archive`), hedef yol ve
  hedef karmasını manifestte kaydet. Ayrı 9 staged R100 taşımasını ve 96
  satırlık başlangıç özetini ayrıca ekle.
- **Verification:** Manifestte 58 silinen yol tam bir kez görünür; sınıf toplamı
  `21 exact archive + 5 line-ending-normalized archive + 5 annotated archive +
  27 missing archive` olarak mevcut Git görünümüyle uzlaşır. Ayrı 9 staged
  taşıma `R100`dır. Normalize edilmiş ve annotated on yol ayrıca özgün kopya
  hedefi taşır. `git status --porcelain` başlangıç
  snapshotıyla eşleşir.
- **Rollback:** Manifest dosyasını kaldır ve güvenlik dalından önceki dala dön;
  çalışma dosyalarına dokunulmamıştır.
- **Commit message:** Bu adım commit üretmez; manifest Adım 3 ile sürümlenir.
- **Stop condition:** Her silinen HEAD blobu okunamıyorsa veya sınıf toplamı 58
  değilse devam etme.

### Step 2 — Eşsiz 27 blobu geri getir/koru

- **Goal:** Arşivde byte-eş karşılığı olmayan hiçbir geçmiş içeriği kaybetmemek.
- **Changes:** `git restore --source=HEAD` ile kayıp blobları özgün yoluna geri
  getir. Üç gece BAT dosyasını kökte bırak. `_arsiv/binary-dumps/github.png`
  özgün arşiv yolunda kalır. Eski harita, pasted, terrain, memory, çizim, QA
  screenshot ve `kompozisyonlar.json` dosyalarını çözülmüş mutlak hedefleri
  doğrulandıktan sonra PowerShell `Move-Item -LiteralPath` ile
  `_arsiv/25-agustos/kurtarilan-silinmisler/<özgün-yol>` altına taşı. Beş
  anotasyonlu harita prototipinin HEAD sürümünü `orijinaller/` altında ayrıca
  koru; anotasyonlu sürümü değiştirme. Satır sonu dönüşmüş beş handoff hedefini
  değiştirme; HEAD sürümlerini yanlarındaki `orijinaller/` altında ayrıca koru.
- **Verification:** 37 archive-exact olmayan silme yolunun her HEAD blobu aktif
  veya özgün arşiv hedefinde birebir hash eşleşmesi bulur. Normalize edilmiş
  beş CRLF hedefin başlangıç hash'i de değişmeden kalır. Üç BAT dosyası kökte
  mevcuttur. Hiçbir hedef workspace dışına çözülmez. Kaynak dosya diff'i sıfırdır.
- **Rollback:** Taşınan hedefleri manifest eşlemesiyle geri taşı; geri yüklenen
  fakat önceden eksik yolları yalnız güvenlik dalında eski statüsüne döndür.
- **Commit message:** Bu adım Adım 3'ün arşiv commitine hazırlanır.
- **Stop condition:** Hedef çakışması, hash farkı veya workspace dışı çözüm varsa
  dur; üzerine yazma.

### Step 3 — Arşiv dalgasını tek committe kapat

- **Goal:** Kullanıcının tamamlanmış 25 Ağustos arşivleme önekini kayıpsız ve
  ayrı geri alınabilir commit hâline getirmek.
- **Changes:** Yalnız staged 9 `R100`, 21 exact arşiv taşıması, 5 normalize
  edilmiş handoff + özgün kopyası, 5 anotasyonlu prototip + özgün kopyası,
  kurtarılan bloblar, arşiv README, manifest ve dokuz yola daraltılmış binary
  `.gitattributes` kuralını stage et. Yaşayan docs/raporlar ve yeni QA kanıtı bu
  commite girmez.
- **Verification:** `git diff --cached --name-status` yalnız arşiv dalgasını
  gösterir; manifestte her eski yolun doğrulanmış hedefi vardır; silme durumunda
  kalan yol yoktur. `git diff --cached --check` temizdir.
- **Rollback:** `git revert <archive-commit>`; manifest bütün ters eşlemeleri
  taşır.
- **Commit message:** `chore(archive): preserve and finish 25 august moves`
- **Stop condition:** Cache diff'inde oyun kaynağı, yaşayan docs veya hedefi
  olmayan `D` görünürse commit atma.

### Step 4 — Yaşayan belge ve plan kaydını commit et

- **Goal:** Tamamlanmış inceleme/plan belgelerini arşiv taşımasından ayrı,
  okunabilir bir kayıt olarak sürümlemek.
- **Changes:** Mevcut içerikleri değiştirmeden `docs/**`, `plans/**`,
  `BACKLOG.md`, `TEST_GAPS.md`, `OPTIMIZATIONS.md`, `RCA.md` ve `LEDGER.md`
  değişikliklerini stage et. `plans/documentation-layout.md` silmesi arşiv
  commitinde zaten exact taşıma olarak bulunmalıdır.
- **Verification:** Markdown bağlantı taraması temiz; 33/33 TG kimliği
  BACKLOG'da sınıflandırılmış; plan frontmatter durumları mevcut insan
  kararlarıyla aynı; `git diff --cached --check` temiz. Cache diff'inde kaynak
  kod veya QA PNG bulunmaz.
- **Rollback:** `git revert <docs-commit>`; arşiv commitine dokunmaz.
- **Commit message:** `docs(atlas): record story audit and plan hierarchy`
- **Stop condition:** Var olan ledger girdisi silinmiş/değişmiş görünürse,
  bağlantı kırılırsa veya plan durumu kendiliğinden Approved olmuşsa dur.

### Step 5 — Güncel Electron QA kanıtını commit et

- **Goal:** TG-32'nin eski-kare kanıtını ve aynı turdaki ekran dizisini kaybetmeden
  belge değişikliğinden ayrı tutmak.
- **Changes:** Yalnız `qa-screenshots/atlas-uitest-20260825/**` sekiz PNG'sini
  stage et. Üretilmiş büyük runtime klasörlerini dahil etme.
- **Verification:** Sekiz dosya okunabilir PNG, boyutları sıfırdan büyük ve
  cache diff'inin tamamı bu klasördedir.
- **Rollback:** `git revert <qa-evidence-commit>`; oyun ve docs etkilenmez.
- **Commit message:** `test(qa): retain atlas electron ui evidence`
- **Stop condition:** Dosya sayısı sekiz değilse veya PNG imzası geçersizse
  commit atma.

### Step 6 — Temiz taban ve davranışsızlık kapısı

- **Goal:** Sonraki ana-faz uzlaştırmasının gerçekten temiz tabanda başladığını
  kanıtlamak.
- **Changes:** Dosya içeriği değiştirme; yalnız doğrulama yap.
- **Verification:** `git status --porcelain` boş; `git diff HEAD -- js electron
  tools tests package.json index.html style.css` boş; `git diff --check` temiz;
  docs bağlantı taraması temiz; üç commit ayrı amaç ve dosya kümeleri taşır.
- **Rollback:** Son başarısız committen başlayarak revert et; önceki başarılı
  commitler bağımsız kalabilir.
- **Commit message:** Yok.
- **Stop condition:** Çalışma ağacı boş değilse veya oyun kaynağı farkı varsa
  plan Landed yapılmaz.

## 6) Risk Register

### Önceden onaylanmış QA silmesi yeni “silme yok” kararıyla çakışıyor

- **Category:** Decision conflict
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `qa-runtime/kompozisyonlar.json`, `_arsiv/25-agustos/README.md`
- **Evidence:** Arşiv README'si 10 Ağustos öncesi dosyaların açık kullanıcı
  talimatıyla silindiğini kaydediyor; yeni sıra kayıp bırakmamayı tercih ediyor.
- **Why it matters:** Eski kararı sessizce geri almak veya yeni kararı sessizce
  ihlal etmek karar geçmişini bozar.
- **Recommended fix:** Dosyayı aktif `qa-runtime`a döndürmeden HEAD blobunu
  `kurtarilan-silinmisler` altında koru; manifestte önceki kararın üzerine gelen
  koruma istisnasını yaz.
- **Tradeoffs / Risks:** Arşivde küçük bir tarihsel dosya yeniden tutulur.

### Beş prototip arşiv notuyla değiştirildiği için özgün blob korunmuyor

- **Category:** Reversibility
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `_arsiv/25-agustos/harita-prototipleri/*`
- **Evidence:** Beş hedefin hash'i eski HEAD blobundan farklı; README metin
  dosyalarına arşiv nedeni eklendiğini söylüyor.
- **Why it matters:** Geri alma anotasyonu elle sökmeye bağlı kalır; byte-exact
  kaynak görünür yerde yoktur.
- **Recommended fix:** Annotated sürümü koru, özgün HEAD blobunu `orijinaller/`
  altında ayrıca sakla ve ikisini manifestte bağla.
- **Tradeoffs / Risks:** Beş küçük metin dosyası çift tutulur.

### Untracked docs ile mevcut rapor değişiklikleri aynı committe geçmişi örtebilir

- **Category:** Reviewability
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `docs/**`, `plans/**`, `BACKLOG.md`, kök raporlar
- **Evidence:** Çalışma ağacında yeni atlas belgeleri ile yeniden yazılan
  snapshot raporlar birlikte duruyor.
- **Why it matters:** Arşiv commitine karışırsa hangi değişikliğin plan, hangisinin
  fiziksel taşıma olduğu incelenemez.
- **Recommended fix:** Arşiv, yaşayan docs ve QA kanıtını üç ayrı path-sınırlı
  commit yap.
- **Tradeoffs / Risks:** Üç commit gerekir; inceleme ve geri alma güvenilir olur.

### Mevcut dal adı işin alanıyla uyuşmuyor

- **Category:** Branch coordination
- **Severity:** Low
- **Confidence:** Confirmed
- **Location:** Git branch `savas-ai-mikrofix-konsantrasyon`
- **Evidence:** Branch adı savaş AI mikrofixini gösterirken kirli durum Atlas
  arşivleme ve hikâye planı belgelerini içeriyor.
- **Why it matters:** Arşiv/docs commitleri savaş AI değişiklik geçmişine
  karışabilir.
- **Recommended fix:** İçerik değişmeden güvenlik dalı aç ve üç commiti orada
  tut; daha sonra merge kararı ayrı verilsin.
- **Tradeoffs / Risks:** Bir ek branch yönetilir; geri dönüş kolaylaşır.

Stale plan bulunmadı. Noticed, not doing: `.gitignore` statusu içerik diff'i
göstermiyor; Step 1'de index/stat normalizasyonu ölçülür, içerik değişikliği
uydurulmaz.

## 7) Abort Criteria

- Herhangi bir eski blob için HEAD kaynağı okunamaz veya hedef hash'i
  doğrulanamazsa plan tamamen durur; hiçbir commit atılmaz.
- Çözülmüş arşiv hedefi workspace dışındaysa veya mevcut farklı dosyanın üzerine
  yazmayı gerektiriyorsa durur.
- Kaynak dosya diff'i sıfır değilse arşiv/docs commitleri ilerlemez.
- Staged cache beklenen path sınıfı dışına çıkarsa commit atılmaz.
- Markdown bağlantı taraması mevcut yeni belgelerde kayıp gösterirse docs
  commitinden önce durur.
- Güvenli kalıcı duraklar: yalnız Step 3 arşiv commiti; Step 3+4; Step 3+4+5.
  Her önek kendi başına tutarlı ve revert edilebilirdir.

## 8) Post-Refactor Verification

- `git status --porcelain` boş olmalıdır.
- Bütün eski yollar manifestte tek hedef ve doğrulanmış hash taşımalıdır.
- `git log -3 --name-status` arşiv/docs/QA sınırlarını karıştırmamalıdır.
- Oyun kaynak ailesinin HEAD diff'i boş olmalıdır.
- Docs bağlantıları çözülmeli; 71 fazlı ana plan ve sonraki 2B harita sırası
  BACKLOG ile aynı kalmalıdır.
- Yeni bağımlılık, kayıt göçü, runtime flag veya davranış değişikliği yoktur.
- Plan Landed olduktan sonra sıradaki iş, 71 fazlı ana planın gerçek aktif faz
  uzlaştırmasıdır; bu plan o incelemeyi yapmaz.

Onaylayan kişi özellikle üç şeyi tartmalıdır: mevcut kirli durum için yeni
güvenlik dalı açılması, önce silinmiş `kompozisyonlar.json` blobunun yalnız
arşivde korunması ve beş anotasyonlu prototipin özgün kopyalarının ayrıca
tutulması. Onay bu üç koruma kararını kapsamalıdır.
