# Kusur defteri — UX/UI mockup turu

Bu dosya **damga defteridir**. Her satır üç durumdan birini taşır:

| Damga | Anlamı |
|---|---|
| `AÇIK` | Mockup'ta önerisi var, kullanıcı henüz kabul etmedi |
| `KABUL` | Kullanıcı öneriyi onayladı, uygulanmayı bekliyor |
| `UYGULANDI <commit>` | Oyuna girdi; commit hash'i yazılmadan bu damga geçersizdir |

**Katman A kabul edildi (12 madde): 2, 3, 4, 5, 14, 15, 16, 17, 18, 20, 21, 22.**
Katman B (8, 9, 10, 13, 19, 23) kullanıcı kararıyla **bekletildi** — önce A bitecek.

**Defter kapandı: 24 madde `UYGULANDI`, 1 madde (`18`) dünya-modeli turuna
devredildi, `AÇIK` satır kalmadı.**

Kalan tek madde **18** — ölçüm öneriyi geçersiz kıldı (dört alan hiç nedensellik
etkisi üretmiyor, diplomasi bilerek kapalı); UI turunun değil dünya-modeli
turunun işi. Bu defterin UI'ya düşen her maddesi kapandı.

**Bu turun en pahalı dersi:** kabul edilen maddelerin **üçünde** iddia ölçümde
düştü ya da daraldı (8'in iki iddiası, 18'in tamamı, 1'in ilk yarısı) ve
**ikisinde** varsayım yanlış çıktı (19'da "nasılsa eziliyor", 22'de "çıkarma
geri alır"). Damgasız satıra güvenilmez kuralı yetmiyor; **damgalı satırın da
kanıtı ölçümle yenilenmeli.**

**İkinci ders — alet dört kez yanılttı**, hepsi de "kod bozuk" gibi göründü:
sabitlenmemiş tohum (19), ölçüm sırasında ilerleyen dünya (19), `scrollWidth`'i
kirleten pseudo-eleman (24), ve saniyede bir güncellenen HUD'dan okunan bayat
kart (1). Kural: **bir bulgu kodu suçlamadan önce aletin o bulguyu üretebildiği
gösterilmeli** — negatif kontrol, bu turda üç kez kararı kurtardı.

**Damgasız satır güvenilmez sayılır.** Bu repoda plan/doküman bayatlaması ölçülmüş
bir sorun (`../docs/battle-ai/research/OLCUM-TUZAKLARI.md`); damga onun karşı önlemidir.

Her kusurun **kanıtı** dosya:satır olarak verilmiştir. Kanıtı olmayan madde deftere girmez.

---

## Katman sırası

**A — bilgi mimarisi** (ne nerede duracak) → kullanıcı kabulü → **B — görsel dil** (nasıl görünecek).

A'nın dördü kabul edilmeden B'ye geçilmez. Sebep: ikisi aynı anda değişirse hangi
düzeltmenin neyi çözdüğü ölçülemez.

---

## 02 · Savaş HUD

### Katman A — bilgi mimarisi

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 1 | Savaşta seçili birim özeti görünmüyor — **iddia ölçümle daraltıldı, öneri DEĞİŞTİ** | `#ui-info` savaşta gizli (`style.css:1919` `display:none !important`) ama **dizimde GÖRÜNÜR** (ölçüldü: `display:block`) · çoklu seçim metni `js/main.js:991`'de **zaten vardı**, yalnız gizli düğüme yazılıyordu | ~~Ölü `#ui-info` silinir~~ → **panel silinmez** (dizimde canlı). Savaştaki ölü yazma kaldırıldı; bilginin savaşta nerede görüneceği hâlâ açık tasarım kararı | **`UYGULANDI`** `36c8b86` + `a044a51` |
| 2 | PARAŞÜT butonu cooldown veya bütçe yetersizken **sessizce hiçbir şey yapmıyor** | `js/WarRoomUI.js:283` gizli butona `.click()` · `js/main.js:348` erken return · bekleme göstergesi savaşta gizli `#ui-support`ta | Her buton durumunu kendisi yazar: `HAZIR · 300₺` / `BEKLEME 18s` (dolum çubuğu) / `300₺ GEREK · 40₺ VAR`; TAARRUZ ve ATEŞ SERBEST kaç birliğe gideceğini söyler | **`UYGULANDI`** `c3a7d6d` |
| 3 | Komut geri bildirimi yok: tıklama işareti, hedef onayı, ses yok | `js/main.js:186-333` sağ tık tek kanal · `js/WarRoomUI.js:360` yalnız eksen çizgisi | Hedef noktada 420 ms işaret (hareket = büzülen yeşil daire, taarruz = kırmızı çapraz, bindirme = mavi kare) + hedef kartında `EMİR ALINDI · TÜR → hedef` satırı | **`UYGULANDI`** `622c4ef` |
| 4 | Kısayol etiketleri butonlarda yok; kontrol grubu (Ctrl+1..9) hiç yok | `js/main.js:771-801` M/U/Esc bağlı ama etiketsiz · `js/globals.js:260` WASD kamerada | Rozetler `data-key` ile: **Q** taarruz · **F** ateş serbest · **T** siper · **P** paraşüt (A elendi, WASD ile çakışıyor). Ctrl+1..9 atar, 1..9 çağırır; 9 slotlu şerit canlı sayıyı gösterir | **`UYGULANDI`** `c3a7d6d` |
| 5 | Savaşta üretim barı kalıntı olarak 76 px yer kaplıyor | `js/main.js:665-666` `opacity .3` + `pointerEvents:none` | Savaş ve oyun-sonu fazında `display:none` (CSS, faza bağlı). Dizimde 84 px ve 7 kategoriyle yerinde kalıyor (ölçüldü) | **`UYGULANDI`** `c3a7d6d` |
| 6 | Kamera ipucu yalnız `startBattle()` yolunda gizleniyor — **iddia edilenden ağır çıktı** | `js/main.js:667` satır içi `display:none` yazıyor ve **hiçbir yer geri açmıyor** → ilk savaştan sonra ipucu oturum boyunca kayboluyor (ölçüldü: dizim ✓ → savaş ✗ → rematch **✗**) · `js/MP.js:120` savaş fazına `startBattle()`'a uğramadan giriyor → MP'de hiç gizlenmiyor | Gizleme faza bağlandı (`battle` + `over`); satır içi stil kaldırıldı | **`UYGULANDI`** `6e5361a` |
| 7 | Muharebe kaydı `aria-live` taşımıyor | `index.html:434` · yalnız `#battle-target-card` taşıyor | `role="log"` + `aria-live="polite"` + `aria-relevant="additions"` + `aria-label`, **kabukta değil güncellenen düğümde** (`#battle-feed-list`) | **`UYGULANDI`** `a870cb1` |

#### 3 — uygulandı (bu turda, oyunda)

**Emir yolu tek dal değil.** Sağ tık işleyicisinde komutun fiilen verildiği **beş**
ayrı çıkış var; işaret beşine de bağlandı, yoksa MP'de veya bindirmede sessiz kalırdı:

| çıkış | dosya | işaret |
|---|---|---|
| MP bindirme | `js/main.js` `mpEmitEvent('player-load')` | mavi kare |
| MP hareket/taarruz | `mpEmitCommand(...)` | daire / çapraz |
| tek oyunculu bindirme | `pendingPlayerCommands` `player-load` | mavi kare |
| taarruz | `player-attack` | kırmızı çapraz |
| hareket | `player-move` | yeşil daire |

**Determinizm.** İşaret dizisi yalnızca çizimde okunur, zamanlaması `performance.now()`;
sim ona hiçbir yerde bakmaz. Emir yolunun kendisi bilerek tik sınırına ertelenmiş
(`flushPendingPlayerCommands`) ve o mantığa dokunulmadı. Kapılar:

| kapı | sonuç |
|---|---|
| `--defertest` | `hashSayisi 201 / karşılaştırılan 201 / ilkSapma null` |
| `--forktest` | `forkTutarli true`, sapan birim 0 |
| `--battletest` | `BATTLETEST_PROBLEMS []`, determinizm `28d34b65 == 28d34b65` |
| `--uitest` | altı adım `OK` |

**Davranış ölçümü** (gerçek oyun, gerçek `contextmenu` olayı):

| adım | işaret | kart satırı |
|---|---|---|
| boş araziye sağ tık | 1 · `move` | `EMİR ALINDI · HAREKET → 4 birim` (yeşil) |
| 420 ms + bir çizim | **0** (süresi doldu) | satır kalıcı — son emir okunabilir kalır |
| düşmana sağ tık | 1 · `attack` | `EMİR ALINDI · TAARRUZ → İkmal Aracı` (kırmızı) |

Kart satırı `index.html`'de değil `warRoomEchoOrder()`'da üretiliyor: o dosyada
paralel iş hattının commit'lenmemiş değişiklikleri vardı, karıştırmamak için
dokunulmadı. Kart zaten `aria-live="polite"` taşıdığından emir ekran okuyucuya
da duyuruluyor.

**Ölçerken çıkan iki not:**

1. **Sis emri hareket yapar, bu kusur değil.** Görünmeyen düşmana sağ tık
   `canSee` false döndüğü için `player-move` üretiyor — işaret de doğru olarak
   yeşil daire çiziyor. İlk ölçümde taarruzun `move` çıkması bu yüzdendi; birimler
   düşmanın yanına taşınıp sis kalkınca `attack` geldi.
2. **Gizli pencerede çekim yalan söyler.** İlk görsel kanıtta kart satırı yoktu;
   aynı karede oyun tuvali de tamamen siyahtı — yani kare hiç boyanmamıştı
   (`show:false` → rAF dönmüyor). Pencere görünür yapılınca satır beklendiği gibi
   çıktı. Aynı sınıf `mockup/BULGULAR.md` "boyama yarışı" notunda da kayıtlı.

### Katman B — görsel dil

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 8 | Legacy kalıntılar | `style.css:235-237` `.spawn-cat` yeşil/12px/r5 — **war-room override'ı hiç yok** · `:277` savaşta `.spawn-btn:hover` mavi glow'a düşüyor · `:130-142` kamera ipucu 7px/`#888`, yalnız `:1777` deploy'da ezilmiş | Üçü de `tokens.css` yüzeylerine çekilir | **`UYGULANDI`** `b09c4d9` · **iki iddia geri çekildi, aşağıda** |
| 9 | Duraklatma modalı ve öğrenme bildirimi **tamamen inline stil**; üstelik modalın **kendi içinde** iki font var | `js/main.js:727-739` — kutu `font-family:inherit` → body'den **Press Start 2P**, ama butonlarda `font-family` yok → **tarayıcı sans-serif**'i · `js/main.js:761-763` bildirim `#8ecbff` / `14px system-ui` / `z-index:99999` · gerçek çekim: `qa-runtime/mockup-baseline/kusur-09-duraklatma-modali.png` | İkisi de terminal diline geçer; inline stil kalkar | **`UYGULANDI`** `6eb0ca5` |
| 10 | 7-9 px yazı boyutları | `style.css:1845` 8px · `:1870` 7px · `:1884` 9px · `:1893` 7px | `--wr-fs-*` ölçeği: micro 9 · small 10 · body 11 · label 13 · title 15 | **`UYGULANDI`** `2f5f62e` |
| 11 | `:focus-visible` hover ile **birebir aynı** → klavye odağı görünmüyor — **defterde yazandan yaygın** | **dokuz** kural `:focus-visible`'ı `:hover` ile aynı gruba yazıp üstüne `outline:none` diyor: `style.css:857 · 908 · 1280 · 1317 · 1336 · 1362 · 1959 · 1969` | `--wr-focus: #6cc7ff` ile ayrı odak halkası; blok dosya SONUNDA (özgüllük değil sıra meselesi) | **`UYGULANDI`** `a870cb1` |
| 12 | Yetim CSS | `style.css:188-218` `#train-ai-btn` · `:404` `#ai-training-screen` — HTML'de ve JS'te **sıfır** referans (ölçüldü) | Silindi: 29 satır. `#game-over-screen` paylaşımlı seçicisinden yalnız yetim yarısı çıkarıldı, canlı yarı yerinde | **`UYGULANDI`** `6e5361a` |
| 13 | CRT bazı arazi tohumlarında konsept çekimden parlak | `../docs/ux/qa/design-qa.md:36` — turun **tek açık P3 bulgusu** | Duraklatma modalına CRT yoğunluk kaydırıcısı (`--wr-crt-alpha`); yalnız görsel katman, sim etkilenmez | **`UYGULANDI`** `9d037ac` · **öneri genişletildi** |

#### 13 — uygulandı (`9d037ac`); kaydırıcı iki yere kondu

Tarama ve vinyet artık `--wr-crt-alpha` ile ölçekleniyor. Taban değerler
(`.24` / `.47`) `alpha = 1`'de eski davranışın birebiri — yani varsayılan
kullanıcı için hiçbir şey değişmiyor.

**Öneriden sapma:** defter kaydırıcıyı yalnız duraklatma penceresine koyuyordu.
İki yere kondu. Ayarın kanonik yeri menüdeki panel — tercih zaten orada
saklanıyor ve CRT anahtarı orada. Ama parlaklık **sahaya bakarken** fark
ediliyor ve savaş içinde menüye çıkış yolu yok; tek denetim menüde kalsaydı
ayar tam ihtiyaç duyulduğu anda erişilemez olurdu. İkisi de
`warRoomApplyCrtAlpha` üzerinden **aynı** tercihi yazar — iki ayar değil, tek
ayarın iki yüzü.

| ölçüm (`::after`'ın hesaplanmış background alfası) | tarama | vinyet |
|---|---|---|
| varsayılan (`--wr-crt-alpha: 1`) | `.24` | `.47` |
| menüden %35 | `.082` | `.165` |
| savaş içinden %80 | `.192` | `.376` |
| %0 | `0` | `0` |

| kapı | sonuç |
|---|---|
| iki kaydırıcı senkronu | savaştan %80 → menü kaydırıcısı **80'e eşitlendi** |
| kalıcılık | `{"crt":true,"crtAlpha":80,...}` |
| tembel kurulan pencere | 35 kayıtlıyken **35 açıldı** (yoksa hep %100 gösterip yalan söylerdi) |
| eski kayıt (`crtAlpha` alanı yok) | 100'e düşer, davranış değişmez |
| `--uitest` · `--hudtest` | ikisi de `PROBLEMS []` |

#### 1 — açık yarısı da kapandı (`a044a51`)

**Açık duran tasarım kararı:** savaşta seçim bilgisi nerede görünecek? Cevap:
**hedef kartında**, ayrı bir şeritte değil. Kart zaten `aria-live` taşıyor ve
"ne seçili" sorusunun tek yüzeyi o; ikinci bir panel aynı bilgiyi iki yerde
gösterirdi — kusur 20'de tam da bu deseni sökmüştük.

Kusur gerçekti ve erişilebilirdi: kart `units.find(...)` ile yalnız **ilk**
seçili birimi gösteriyordu, oysa kontrol grupları (Ctrl+1..9) tam da çok birim
seçmek için var.

**Toplamlar seçilerek alındı, körlemesine toplanmadı.** ATK toplanır — birlikte
ateş ederler. Ama menzil ve hız **minimum** alınır: grup en kısa menzillisi
kadar yaklaşmak, en yavaşı kadar yavaş gitmek zorunda. Ortalama menzil komuta
kararını yanlış yönlendirirdi.

| durum | kart |
|---|---|
| 0 seçili | `BİRİM SEÇ` boş durumu (değişmedi) |
| 1 seçili | `PIYADE` · ATK / RNG / ZIRH / HIZ (değişmedi) |
| 6 seçili | `GRUP KOMUTA` · `6 BİRLİK SEÇİLİ` · `3 PIYADE · 2 MANPADS TIMI · 1 TANK AVCISI` · gövde `1480/1480` · `ATK 712` / `EN KISA RNG 300` / `ORT ZIRH 1.0` / `EN YAVAŞ 1.13` |
| panik + mühimmat | `⚠ 1 PANİK · 1 MÜHİMMAT BİTTİ` · mühimmat `19/22` |

Kırpma: üç viewport'ta 0 kırpık hücre, kart sınır dışına çıkmıyor.
`--hudtest []` · `--uitest []` · `--forktest forkTutarli:true`.

> **Alet yine yanılttı, dördüncü kez.** HUD saniyede ~1 kez güncelleniyor; ilk
> ölçüm seçimi değiştirip 450 ms sonra okuyor ve **bayat kart** görüyordu. Bu
> "tek seçimde kart boş kalıyor" diye var olmayan bir bulgu üretti; iki tur
> boyunca kodda hata aradım. `warRoomUpdateBattle()` açıkça çağrılınca düzeldi.
> Önce dünyanın donduğunu doğrulamak (hp sabit, ölüm yok) yanlış şüpheyi eledi.

#### 10 + 23 — uygulandı (`2f5f62e`); ikisi ayrılamaz, birlikte yürütüldü

10 değişikliğin kendisi, 23 onun kapısı. Kapı önce kuruldu — ölçemeden
değiştirmek bu turda üç kez yanılttığı için (bkz. 19'un ölçüm notu).

Savaş HUD'unda **6–13 px arası sekiz ayrı boyut** elle yazılmıştı. Ölçek
adlandırılmadığı için her panel kendi kararını veriyordu ve 6–7 px okunabilirlik
sınırının altındaydı. Atama **role** göre yapıldı, "eski değeri neydi"ye göre değil:

| basamak | değer | rol | eskiden |
|---|---|---|---|
| `--wr-fs-micro` | 9px | altyazı · rozet · birim istatistik başlığı | 6–7px |
| `--wr-fs-small` | 10px | bölüm başlığı · ölçer · akış satırı | 8px |
| `--wr-fs-body` | 11px | panel gövde metni | 9px |
| `--wr-fs-label` | 13px | vurgulu sayı ve değer | 10–12px |
| `--wr-fs-title` | 15px | panel başlığı | 13px |

34 bildirim token'a bağlandı; blokta elle yazılmış `px` kalmadı.

**Kapı, mockup sahnesine değil gerçek oyuna kuruldu.** Defter "8 gerçek devlet
adı + en uzun brifing etiketleri" içeren bir kanıt sahnesi öneriyordu; sahte
sahne gerçek panel genişliklerini kanıtlamaz. Onun yerine gerçek savaş HUD'u
3 viewport × 2 fazda tarandı.

**Karar mutlak değil FARKA göre verildi** — önceden kırpık olan bir eleman bu
turun regresyonu değil:

| kapı | sonuç |
|---|---|
| yeni kırpılan | **0** (düzelen 0; taban 3 kırpık düğüm `#ui-phase`, değişmedi) |
| negatif kontrol (token'lar 15/17/19/22/26) | **6 yeni kırpılma yakalandı** → alet kör değil |
| ekran-dışı (9 HUD paneli × 3 viewport) | hepsi sınır içinde · yatay taşma **0** |
| `--hudtest` | `kesis:false` · `ekranDisi:false` · `PROBLEMS []` |
| `--uitest` | `PROBLEMS []` |

> **İki ölçüm tuzağı baştan kapatıldı.** Tarayıcı `scrollWidth`'i `::before` /
> `::after` içeriğiyle kirletiyor (bu turda kusur 24'te yaşanmıştı) ve
> `overflow:auto` olan kap kırpmaz **kaydırır**. İkisi de kapının dışında
> tutuldu; tutulmasaydı sahte kırpılma raporlanır, ölçek boşuna geri alınırdı.

#### 9 — uygulandı (`6eb0ca5`); iddia doğru çıktı, ölçüm ağırlaştırdı

Defter "iki font" diyordu. Gerçek savaş fazında ölçüldü: **tek ekranda üç font.**

| düğüm | önce | sonra |
|---|---|---|
| kutu / başlık | `Press Start 2P` 19px (body'den kalıtım) | `Share Tech Mono` 13px |
| düğmeler | **`Arial`** 14px — `font-family` hiç yazılmadığı için tarayıcı varsayılanı | `Share Tech Mono` 11px |
| öğrenme bildirimi | **`system-ui`** 14px, mavi `#8ecbff` / kenar `#49f` | `Share Tech Mono` 10px, amber |
| köşeler | 12px / 8px / 9px | 4px |
| satır-içi stil | 165–340 karakter | **6 düğümün hepsinde 0** |

JS'te yalnız **durum** kaldı: `style.display` yerine `.acik` sınıfı — durum stil
değildir. Bildirimi yalnız öğrenme değil emir geri bildirimi de kullanıyor
(`js/main.js:117`, `:231`, `:463`), o yüzden amber terminal dili doğru seçim.

**İşlevsel kapı** (stil taşımak davranışı sessizce bozabilirdi):

| adım | sonuç |
|---|---|
| `battleTogglePause(true)` | `flex` · `BATTLE_PAUSED = true` |
| DEVAM düğmesi | `none` · `false` |
| ESC | açılır |
| bildirim oto-gizleme (700 ms) | `none` |
| boş metinle çağrı | `none` |
| ÇIKIŞ düğmesi | `data-screen = menu`, örtü kapalı |

`--uitest []` · `--hudtest []` · `--forktest forkTutarli:true`

#### 8 — uygulandı (`b09c4d9`); üç iddianın ikisi ölçümde düştü

Gerçek Electron'da, gerçek fare olayıyla hover tetiklenerek ölçüldü
(`executeJavaScript` ile `:hover` tetiklenmez — bu ayrımı atlamak sahte "temiz"
sonucu verirdi). Dizim ve savaş fazları ayrı ayrı, savaş fazına gerçekten
girilerek (birim dizilmeden maç anında bitiyor ve faz `over` ölçülüyordu).

| iddia | ölçüm | sonuç |
|---|---|---|
| `.spawn-cat` yeşil/12px/r5, override yok | dizimde **GÖRÜNÜR**: font **`Arial`** 12px, kenar `rgba(120,200,140,.35)`, açık halde `rgba(70,140,70,.95)`, köşe 5px | **doğrulandı ve büyüdü** — HUD'un tek yabancı-fontlu yüzeyi |
| savaşta `.spawn-btn:hover` mavi glow'a düşüyor | dizimde hover zaten `rgb(74,222,128)`; savaşta çubuk `pointer-events:none` **ve** `checkVisibility=false` → hover hiç tetiklenemiyor | **geri çekildi** |
| kamera ipucu 7px/`#888`, yalnız deploy'da ezilmiş | renk `rgb(110,99,48)`, font Share Tech Mono, kenar amber — zaten çekilmiş; savaş/bitişte `display:none` (kusur 6) | **daraldı**: tek kalıntı köşe yarıçapı 6px |

Kategori düğmeleri war-room diline çekildi (Share Tech Mono 10px, `--wr-line` /
`--wr-muted`, hover ve açık halde `--wr-green`), kamera ipucunun köşesi 4px oldu.
**Ayrı bir override katmanı eklenmedi, kural yerinde yeniden yazıldı** — çift
tanım kusur 19'da bedeli ölçülmüş bir borç, aynı borcu yeniden açmak tutarsız olurdu.

| kapı | sonuç |
|---|---|
| taban hâli (tıklanmamış kategori) | `rgb(140,122,62)` · Share Tech Mono 10px · r4 |
| 916×572'de kırpılan etiket | **0** · yatay taşma **0** |
| `--hudtest` · `--uitest` | ikisi de `PROBLEMS []` |

> Kalan gözlem (bu kusurun kapsamı değil): 7 kategori düğmesi 916 px'te **iki
> satıra** sarıyor. Yazı küçüldüğü için önceki hâlden dar; yani bu davranış
> öncesinde de vardı, benim değişikliğimin ürünü değil.

---

## 03 · Hikaye dünyası

### Katman A

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 14 | Rol seçimi navigasyonu süzmüyor: 8 araç herkese aynı | `../docs/story/status/MODERN_DUNYA_EKSIKLERI.md` MW-014 / MW-020 · `index.html:230` sabit 8 araç | **Gizleme değil önceliklendirme**: rolün araçları öne ve numaralanmış, kalanlar tek tıklık `+N ARAÇ` şeridinde. Erişim kaybı sıfır; yalnız DOM görünürlüğü/sırası değişir → determinizm korunur | **`UYGULANDI`** `931db9d` |
| 15 | Gündem yönlendiriyor ama **karar verdirmiyor** | `js/StoryUI.js` gündem kartı yalnız panel açıyor · MW-003 | Kart artık **isimli muhatap** + motorun kendi bedelli eylemlerini gösterir; yürütme mevcut görüşme penceresinde kalır (kart dünyayı değiştirmez) | **`UYGULANDI`** `0854cad` |
| 16 | AKIŞ son 6 kayıtla sınırlı | `js/Story.js:124` `log.length > 6` kırpılıyor | Kırpma sınırı **veride** 6 → 240; panel arşive dönüştü: arama + tür filtresi + sayaç + kayıt zamanı. Tür, mesajın **baş simgesinden** çıkarılıyor (74 çağrı yerinin hiçbiri değişmedi) | **`UYGULANDI`** `f47499e` |
| 17 | Uzun aday listelerinde arama/filtre yok (ilk 8 gösteriliyor) | `js/Talks.js` `question.options.slice(0, 8)` + yalnız "N adaydan ilk 8 gösteriliyor" notu — kalanına ulaşım yok | Arama + `N / M` sayacı + "TÜMÜNÜ GÖSTER"; **8 ve altında hiçbir şey eklenmez** | **`UYGULANDI`** `e966eac` |
| 18 | "NEDEN DEĞİŞTİ?" neden-izi bazı alanlarda yok — **ölçüm maddeyi yeniden çerçeveledi** | `js/StoryProjection.js` `storyProjectionEffectBinding` yalnız 3 yol bağlıyor · gerçek kampanyada 180 etkinin **%97'si zaten izli** | ~~Rozet kapsamı beş alana genişler~~ → **UI işi değil**: dört alan hiç nedensellik etkisi üretmiyor, diplomasi ise bilgi sızıntısı gerekçesiyle bilerek kapalı (aşağıda) | `KABUL` · **öneri geçersiz, yeniden yazılmalı** |
| **24** | **Komuta çubuğu kaynak çipleri kutuyu taşırıp başlığın üstüne akıyor** | `style.css:1206` `justify-content:flex-end`, `overflow` kuralı yok · `:1207` `.story-stat-chip min-width:92px` | Dört bant: içerik-boyutlu çipler + kademe sınıfı + `overflow:hidden` | **`UYGULANDI`** `ee81aaa` + `829bf90` (kademe sırası) |

#### 15 — uygulandı (bu turda, oyunda)

**Hiçbir mekanik icat edilmedi.** Bedelli eylemler motorun kendi oyuncu
görünümünden geliyor: `storyCharacterActionPlayerView(hedefId, ...)` →
`{ actionType, label, allowed, cost, reasons }`. Aynı API görüşme penceresinde
zaten kullanılıyordu (`js/Talks.js`); bu tur onu gündem kartına da taşıdı.

**Muhatap da icat değil, kanonik kurumdan türetiliyor.** Kurumlar kendi türlerini
taşıyor (`political:0:labor-organizer`, `political:0:government-whip`,
`intelligence:0:domestic`, `institution:country:0:armed_forces` …); kart aksiyonu
bu türlerle eşleşiyor ve **yalnız oyuncunun kendi ülkesindeki** makam sahipleri
aday oluyor.

**Kart YÜRÜTMEZ.** Karar düğmesi yalnız gösterir; tıklayınca mevcut ve
doğrulanmış görüşme çalışma alanı açılır. Dünya durumunu değiştiren tek yol tek
yerde kalıyor — determinizm ve kayıt yolu riske girmiyor.

| ölçüm | sonuç |
|---|---|
| enflasyon/refah eşiği zorlanınca | 3 kart · **2 muhataplı** · 6 karar düğmesi |
| örnek | `MUHATAP Alp Özkan · Emek Bloğu Sözcüsü` → `İkna et influence 2` · `Müzakere et influence 3` · `Kişisel ittifak kur credibility 4` |
| yabancı muhatap | **0** (yalnız kendi ülken) |
| iki kez yeniden çizim | saat/log/kaynak **birebir aynı** |
| **karar düğmesine tıklama** | dünya **birebir aynı**, eylem makbuzu artmadı, görüşme penceresi açıldı |
| `--uitest` | `UITEST_PROBLEMS []` |

**Muhatabı olmayan kart bilerek boş kalır.** `talk` kartının muhatabı zaten
görüşmenin karşı tarafı; `region` kartının makamı (`armed_forces`) **oyuncunun
kendisi** olduğu için aday listesinden düşüyor. İkisinde de sahte bir muhatap
uydurmak yerine satır hiç çizilmiyor.

**Stiller satır içi:** `style.css` paralel iş hattının commit'lenmemiş
değişikliklerini taşıyordu. CSS'siz ilk sürümde satır `MUHATAPAlp ÖzkanEmek Bloğu
Sözcüsü` diye bitişik çıkıyordu (çekimle görüldü); satır içi stille düzeltildi.


#### 14 — uygulandı (bu turda, oyunda)

**Öneriden bilinçli sapma: GİZLEME YOK, İKİNCİLLEŞTİRME VAR.** Defterde "rol
süzgeci" yazıyordu; rolün dışındaki aracı tamamen kaldırmak oyuncunun gerçekten
yapabildiği bir şeyi engelleyebilir (şirket yöneticisinin de sefer ordusu var:
`STORY.commander.army`). Bu yüzden ikincil araçlar kaybolmuyor, tek tıklık
`+N ARAÇ` şeridinde toplanıyor.

| rol | öne çıkan araçlar | şeritte |
|---|---|---|
| COMMANDER | ORDU · ŞEHRE GİR · KOMUTAN · KONSEY · SOHBET | +3 |
| COMPANY_OWNER | EKONOMİ · AR-GE · ŞEHRE GİR · SOHBET · KOMUTAN | +3 |
| MAYOR | ŞEHRE GİR · EKONOMİ · KONSEY · SOHBET · GAZETE | +3 |
| EXECUTIVE | KONSEY · GAZETE · SOHBET · EKONOMİ · KOMUTAN | +3 |
| AGENT | SOHBET · GAZETE · KONSEY · KOMUTAN | +4 |
| CIVILIAN | SOHBET · GAZETE · ŞEHRE GİR · EKONOMİ | +4 |

| kapı | sonuç |
|---|---|
| **erişim kaybı** | `+N ARAÇ` tıklanınca **her rolde 8/8** erişilebilir |
| dünya durumu | rol 4 kez değiştirilip şerit açılıp kapatıldıktan sonra saat/log/kaynak/düğüm **birebir aynı** |
| bilinmeyen rol | sekizi de görünür (aşağıda) |
| numaralandırma | yedi rolde de görünen sıra `01..0N` artan |
| `--uitest` | `UITEST_PROBLEMS []` |

**Ölçüm iki kusur yakaladı, ikisi de benim:**

1. **Korumanın kendisi bozuktu.** Bilinmeyen rol için yazdığım "hiçbir şey yapma"
   dalı yalnız `return` diyordu; önceki rolün gizlemesi DOM'da kalıyordu ve
   `BILINMEYEN_ROL` **CIVILIAN düzenini miras alıyordu**. Yani yeni bir rol
   eklenip tabloya yazılmazsa araçlar sessizce kaybolurdu — tam kaçınmak için
   yazdığım korumanın yaptığı şey buydu. Artık bilinmeyen rolde sekizi de açılır.
2. **Numaralar yalan söylemeye başladı.** `01`-`08` etiketleri kısayol değil salt
   sıra göstergesi (story modunda rakam tuşu hiçbir araca bağlı değil — ölçüldü).
   Sırayı değiştirip numarayı bırakınca çubuk `02 04 06 01 05` diye okunuyordu.
   Numaralar görünen sıraya göre yeniden yazılıyor.

**Not — ölçüm tuzağı:** kusur 16 kapısı bu tur bir kez tutarsız çıktı (4 satır ama
sayaç "3"). Sebep benim değişikliğim değildi: prob dünya **akarken** ölçüyordu ve
iki render arasına giriyordu. `STORY.paused = true` ile dondurunca 3 satır / "3 / 25"
/ uymayan 0. Akan dünyada ölçen her kapı bu hataya açıktır.

**CSS'e dokunulmadı:** `style.css` bu sırada paralel iş hattının commit'lenmemiş
değişikliklerini taşıyordu, o yüzden görünürlük satır içi stille yönetiliyor.


#### 17 — önce geri çekildi, sonra ölçülüp uygulandı

**Birinci deneme geri çekilmişti** çünkü kod yolu ölçülemiyordu: sentetik oturum
defterin şema doğrulamasına takılıyor, gerçek API ise 0 netleştirme sorusu
üretiyordu. Ayrıca `js/Talks.js` o sırada paralel iş hattının commit'lenmemiş
işini taşıyordu. Üç blok tek tek geri alınmıştı.

**İkinci turda üçü de çözüldü.** Paralel hat `a938df0` ile commit'lendi (dosya
serbest) ve sorunun üretim koşulu bulundu: `storyConversationSessionQuestions`
yalnız **çözümlenmemiş terim** varsa soru üretiyor — `commodity_identity`,
`shipment_identity`, `destination_warehouse` aday listesi taşıyor. "Çelik
sevkiyatını depoya gönderelim" cümlesi dalı tetikliyor.

**Ölçüm maddeyi de düzeltti: kusur bugün LATENT.**

| terim | gerçek aday sayısı |
|---|---|
| `commodity_identity` | **2** |
| `shipment_identity` | 1 |
| `destination_warehouse` | **0** (oyuncunun 25 düğümü olmasına rağmen) |

Yani `slice(0, 8)` bugün **hiç ısırmıyor**; defterdeki "25 seçenek" öncülü
gerçekleşmiyor. Ama 25 adaya zorlandığında 8 düğme + *"25 adaydan ilk 8
gösteriliyor"* çıkıyor ve 17 aday erişilemez oluyor. Tetiklenmiyor diye sessiz
bilgi kaybı yerinde bırakılmadı.

| ölçüm | sonuç |
|---|---|
| **2 aday (bugünkü gerçek durum)** | 2 düğme · arama kutusu **yok** · ek not **yok** → görünüm birebir aynı |
| 25 aday | 8 düğme · arama · `8 / 25 aday gösteriliyor` · `17 ADAY DAHA GÖSTER` |
| tümünü göster | 25 düğme · **kayıp aday 0** |
| arama `lojistik` | hepsi eşleşiyor · sayaçta süzgeç yazılı |
| eşleşme yok | 0 düğme ama **arama kutusu duruyor** (yoksa süzgeçte kilitlenirdin) |
| seçim öznitelikleri | `option/session/question` korunuyor → tıklama hâlâ yanıtı gönderiyor |
| `--uitest` · sohbet regresyonları | `UITEST_PROBLEMS []` · ikisi de **geçti** |

**Yan bulgu (kapatılmadı):** `destination_warehouse` sorusu üretiliyor ama
**sıfır aday** taşıyor, oysa oyuncunun 25 düğümü var. Soru o zaman serbest metne
düşüyor. Bu, aday çözümleyicisinde ayrı bir eksik; sohbet motorunun alanı olduğu
için burada yalnız kayda geçiriliyor.

#### 16 — uygulandı (bu turda, oyunda)

**Kırpma UI'da değil VERİDEydi.** `storyLog` 7. olayı yazarken birinciyi kalıcı
olarak siliyordu — paneli büyütmek işe yaramazdı, çünkü kayıt zaten yoktu.
Sınır `STORY_LOG_CAP = 240`; panel varsayılan 12 satır gösterip gerisini
"N KAYIT DAHA GÖSTER" ile açıyor.

**`storyLog(msg)` imzası değişmedi** — 16 dosyada 74 çağrı yeri var, hiçbirine
dokunulmadı. Tür, mesajın **baş simgesinden** türetiliyor (35 farklı simge tarandı,
6 kategoriye eşlendi). Yeni bir çağrı eklenip kategoriye yazılmazsa kayıt
kaybolmuyor, yalnız `DİĞER`e düşüyor.

**Kayıt biçimi `{ m, t }` oldu; eski kayıtlar düz metindi.** `storyLogNormalize`
iki biçimi de kabul eder ve yükleme yolundan geçer, yani eski kayıt açılınca akış
boşalmıyor (yalnız o satırların zamanı bilinmiyor, zaman etiketi çizilmiyor).

| ölçüm | sonuç |
|---|---|
| 260 adım sonrası tutulan kayıt | **23** (eskiden tavan 6) |
| kaydet → logu boşalt → yükle | 14 → 14, metin **ve** zaman birebir aynı |
| gerçek kayıttaki log'u düz metne çevir → yükle | 3 kayıt açıldı, nesneye normalleşti, zamansız işaretlendi |
| bozuk log (`null` · `42` · `"metin"` · `[null,7]`) | çökme yok → 0 · 0 · 0 · 1 kayıt |
| tür filtresi `ASKERÎ` | 4 / 23, türe uymayan satır **0** |
| arama `konsey` | 4 / 23, aramaya uymayan **0**, **odak kutuda kalıyor** |
| `--uitest` | `UITEST_PROBLEMS []` |

**Ölçüm iki gerçek kusur yakaladı — ikisi de benim:**

1. **Özellik doğduğu gibi ölü olacaktı.** Filtre ve arama işleyicilerine
   `storyUpdateUI()` yazmıştım; **öyle bir fonksiyon yok** (doğrusu
   `storyPanelUpdate`). Tarama gösterdi ki bu ad repoda yalnız benim yeni kodumda
   geçiyor — her tıklama `ReferenceError` atacaktı. Önceki bir ölçüm probu bunu
   `typeof` ile korumalı çağırdığı için sessizce yutmuştu.
2. **Panelde yalan yazı.** `index.html`'deki alt başlık "SON 6 KAYIT" diyor ve
   sınır değişince yanlış hale geldi. `index.html` paralel iş hattının elinde
   olduğu için metin JS'ten düzeltildi.

**Not — tam test paketi:** `npm run test:story` (81 prob) turunda
`conversationContextPackProbe` düştü. Tek başına çalıştırıldığında **hem çalışma
ağacında hem temiz `HEAD` kopyasında geçiyor**, yani yalnız 6 işçilik tam yük
altında düşen bir durum. Mekanizma olarak da bende olamaz: `STORY.log` yalnız
`Story.js` ve `StoryUI.js`'te okunuyor, sohbet bağlam paketi ona hiç dokunmuyor.
Bu bulgu paralel iş hattına ait; burada kayda geçiriliyor, kapatılmıyor.


### 24 — bu turda **yeni bulundu ve ölçüldü**

Mockup'ın "ŞU AN" sahnesi gerçek 9 çiple kurulunca kusur kendiliğinden ortaya çıktı;
sonra gerçek oyunda doğrulandı.

**Gerçek oyunda ölçüm** (kampanya açık, 9 çip, Electron):

| viewport | çip satırı içeriği | kutu | taşma |
|---|---|---|---|
| 1100×700 | 1070 px | 521 px | **549 px** |
| 1280×800 | 1070 px | 701 px | **369 px** |
| 1440×900 | 1070 px | 861 px | **209 px** |
| 1600×900 | 1070 px | 1021 px | **49 px** |

`#story-stats` bir flex kutusu; `justify-content: flex-end` ve `overflow` kuralı
olmadığı için fazlalık **sola**, `.story-command-title`ın üstüne akıyor.
Yani **1650 px altındaki her masaüstü genişliğinde** üst çubuk bozuk.

**Neden bugüne dek kaçtı:** `../docs/ux/qa/design-qa.md:15`'teki kontrol *sayfa* yatay taşmasına
bakıyordu (`scrollWidth`), kutu-içi flex taşmasına değil. Sayfa taşmıyor —
içerik kutunun dışına akıyor. Kanıt: `qa-runtime/mockup-baseline/kusur-16-akis-sekmesi.png`
(1280×800, gerçek oyun — "PIXEL AVRUPA" başlığının üstünde "Türk Cumhuriyeti" ve
"PETROL 319" okunuyor).

#### 24 — uygulandı (bu turda, oyunda)

#### 18 — ölçüldü, öneri geçersiz çıktı, uygulanmadı

Defter "rozet kapsamı beş alana genişler" diyordu (diplomasi, sadakat, itibar,
üretim kuyruğu, ordu listesi). 300 adımlık gerçek kampanyada nedensellik defteri
ölçüldü — **180 etki**:

| | etki | oran |
|---|---|---|
| **neden-izi VAR** | `state:N.resources` 127 · `character:N.node` 47 | **%97** |
| **neden-izi YOK** | `relation:N\|M.value` 4 · `character:…career.credibility/influence` 2 | %3 |

**Beş alandan dördü listede hiç yok.** Sadakat, itibar, üretim kuyruğu ve ordu
listesi **hiç nedensellik etkisi üretmiyor** — yani eksik olan "rozet" değil, o
sistemlerin deftere yazması. Bu UI katmanında kapatılabilecek bir açık değil;
`storyProjectionEffectBinding`'e satır eklemek bir şey göstermez çünkü gösterecek
kayıt yok.

**Kalan tek gerçek aday diplomasi ve o bilerek kapalı.** `js/StoryProjection.js`
bağlayıcının sonunda açık gerekçe duruyor: *"Diplomatik gerçekler henüz
PlayerKnowledgeService içinde bilgi sınıfı taşımıyor. Ham ilişki/antlaşma
etkisini göstermek bilgi sızıntısı olur."* Bunu UI'dan açmak, oyunun bütün sohbet
ve müzakere tasarımının dayandığı `PlayerKnowledge` süzgecini delerdi.

**Not — gerekçe kısmen bayat olabilir:** `js/PlayerKnowledge.js` bugün `loyalty`,
`reputation`, `trustBps`, `respectBps`, `hostilityBps`, `fearBps` ve `debtBps`
alanlarını sınıflandırıyor. Yani "bilgi sınıfı yok" cümlesi yazıldığı günden beri
değişmiş olabilir. Ama bu, bağlayıcıya körlemesine satır eklemek için yeterli
değil: sınıfın **o özne için** gerçekten üretildiği ve hangi kesinlikle geldiği
ayrıca ölçülmeli. Sızıntı riski taşıyan bir değişiklik ölçülmeden yapılmaz.

**Bu madde yeniden yazılmalı.** Doğru soru "rozet nerede yok" değil:
1. Sadakat/itibar/üretim/ordu sistemleri nedensellik etkisi yazmalı mı? (ürün kararı)
2. Diplomatik ilişki değişimi oyuncuya hangi kesinlikle gösterilebilir? (bilgi tasarımı)
İkisi de UI turunun değil, dünya-modeli turunun işi.


Kutu genişliğinin kanunu ölçüldü: `#story-stats` grid'in `1fr` sütunu, yani
**kutu = pencere − 579** (270 başlık + 245 `#story-topright` + 64 boşluk/dolgu).
Başka kaldıraç yok — ya içerik küçülecek ya çip gizlenecek. Uygulanan üç bant:

| bant | ne olur | görünen çip |
|---|---|---|
| **≥1650 px** | hiçbir şey değişmez (zaten sığıyordu) | 9 |
| **1260–1650 px** | çipler sabit 92/150 px yerine `min-content`; boşluk 6→4, dolgu 8→6 px | **9** — içerik 1070 → **633 px** |
| **900–1260 px** | `t2` gizlenir: GAZİ · ELEKTRONİK · ENF · ÇAĞ | 5 (TARİH kalır) |
| **780–900 px** | `t3` gizlenir: TARİH · devlet çipi 88 px'e daralır | 4 |
| **<780 px** | devlet çipi de düşer | 3 (PETROL · İNSAN · PUAN) |

**Hangi çip önce feda edilir — gerekçe.** TARİH kademe-2'de değil kademe-3'te:
gündem panelindeki süreler ("1,25 yıl kaldı") takvime göre okunuyor, yani eyleme
dönük. GAZİ ise salt geriye dönük bir sayaç ve üst çubukta ona bağlı hiçbir karar
yok. En dar bantta düşen DEVLET çipi, çünkü oyuncu kendi devletini zaten biliyor;
PETROL/İNSAN/PUAN ise harcanabilir bütçe.

**Çip genişliği içeriğe bağlı — en kötü durum ayrıca ölçüldü.** Uzun kampanyada
kaynaklar 5 haneye çıkıyor ve `PUAN` çipinde değer zaten etiketten geniş
(21.9 px etiket / 22.9 px değer, 3 hanede). 5 hane satıra **+31 px** ekliyor.
`<b>` metni doğrudan DOM'a yazılarak 13 genişlikte yeniden ölçüldü, hepsi geçti;
en dar pay 1261 px'te **18 px**. Bu ölçüm olmasaydı 720 px bandı −8 px ile
kırpacaktı — dördüncü kademe (780 px) tam bu yüzden var.

> **Ölçüm tuzağı — dördüncü kez.** İlk denemede kaynakları `STORY.commander.res`
> üzerinden şişirdim ve "içerik hiç değişmedi, risk yok" sonucuna varacaktım.
> Doğrulayınca enjeksiyonun hiç uygulanmadığı görüldü (değerler 222/235/205'te
> kaldı) — yani test bir **no-op**'tu ve negatif sonuç sahteydi. Ölçüm modelden
> değil DOM'dan yapılınca gerçek etki (+31 px) ortaya çıktı.


Ayrıca `#story-stats { overflow: hidden }` — içerik ne olursa olsun başlığın
üstüne **asla** çıkamaz.

**Sıra tabanlı gizleme kaldırıldı.** Eski `@media (max-width:980px)` bloğu
`.story-stat-chip:nth-of-type(n+4)` ile gizliyordu; `ELEKTRONİK` ve `ENF` koşullu
üretildiği için (`me.chips` / `me.inflation` null olabilir) sıra kayıyor ve **her
dünyada farklı çipler** gizleniyordu. Kademe artık `js/StoryUI.js`'te üreten yerde
`t2` sınıfıyla işaretleniyor; CSS sıraya değil sınıfa bakıyor. Yan fayda: 980 px'te
3 yerine 4 çip kalıyor (içerik 269 / kutu 401).

**Doğrulama — gerçek oyun, gerçek dosyalar, 11 genişlik:**

| pencere | kutu | içerik | taşma | başlığı örtüyor mu | kutu dışı çip |
|---|---|---|---|---|---|
| 980 | 481 | 269 | yok | hayır | 0 |
| 1000 | 421 | 269 | yok | hayır | 0 |
| 1100 | 521 | 269 | yok | hayır | 0 |
| 1259 | 681 | 269 | yok | hayır | 0 |
| 1261 | 681 | 269 | yok | hayır | 0 |
| **1280** | 701 | **633** | yok (68 px pay) | hayır | 0 |
| 1366 | 789 | 633 | yok | hayır | 0 |
| 1440 | 861 | 633 | yok | hayır | 0 |
| 1600 | 1021 | 633 | yok | hayır | 0 |
| 1660 | 1081 | 1070 | yok | hayır | 0 |
| 1920 | 1341 | 1070 | yok | hayır | 0 |

Önce/sonra çekimi: `qa-runtime/mockup-baseline/kusur-24-komuta-cubugu-ONCE-1280.png`
ve `-SONRA-1280.png`. ÖNCE'de "…mhuriyeti" ekranın solundan taşıp kesilmiş,
"PETROL 223" doğrudan "AVRUPA" başlığının üstüne basılmış.
`electron . --uitest` altı adımda da `OK`, `UITEST_PROBLEMS []`, konsol hatası yok.

**Ölçerken çıkan iki tuzak — not:**

1. **Aleti önce doğrula.** İlk sürümde kırpma ölçütü `chip.scrollWidth > clientWidth`
   idi ve **her varyantta** 5 çip "kesik" diyordu — `.detail-hover::after` tooltip'i
   (mutlak konumlu, `max-width:390px`) `scrollWidth`'e karışıyordu. Ölçüt `Range` ile
   yalnız değer ve etiket metnine bakacak şekilde değiştirildi; ancak ondan sonra
   ŞU AN doğru şekilde "kaldı", 1920'de "geçti" verdi.
2. **Çift tanımlı seçici.** İlk uygulamada içerik 633 yerine 721 px çıktı ve 1280'de
   5 px taştı: `.story-stat-chip.wide` bu dosyada **iki kez** tanımlı
   (`style.css:2110` `min-width:150px`) ve o satır düzeltmeden *sonra* geldiği için
   eşit özgüllükteki kural eziliyordu. Kurallar `#story-stats ...` ile yazıldı;
   özgüllük sıradan bağımsız kazanıyor. Bu, kusur 19'un ("çift tanımlı seçiciler")
   somut bir maliyeti.

### Katman B

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 19 | Eski mavi hikaye bloğu duruyor | `style.css:1005-1185` ⇄ `:1188-1356` | Üç adımlı tasfiye, aşağıda ölçülmüş | **`UYGULANDI`** `db55b36` |

**19'un ölçümü** — blokta 113 selektör var:

1. **İki kez tanımlı:** `#story-hud` :1009 ⇄ :1315 · `#story-news` :1024 ⇄ :1343 · `#story-tools` :1013 ⇄ :1352
2. **Tamamen ölü** (js/ ve index.html'de hiç geçmiyor) — 9 adet:
   `#story-actions` :1039 · `.army-res` :1136 · `.city-name` :1062 · `.city-row` :1061 ·
   `.pool-grid` :1104 · `.pool-item` :1105 · `.story-cmd` :1037 · `.story-hint` :1038 ·
   `.story-state-name` :1029
3. **Sızan legacy değerler** (ezilmemiş bildirimler):
   `.tool-btn` :1014 → `font-size:23px`, `line-height:1`, `transition:all .15s` hâlâ geçerli (:1353 bunları ezmiyor).
   `.ctrl-btn` :1020 → yalnız `transition` sızıyor; :1247'deki `font` kısayolu boyut ve satır yüksekliğini sıfırlıyor.

> Ölçüm notu: ilk tarama kelime sınırı kullanmadığı için **28 yanlış-pozitif** verdi
> (`city-btn` gibi canlı adları ölü sandı). Sınırlı eşleşmeyle tekrar ölçüldü → 9.

#### 19 — uygulandı (`db55b36`)

Üç adım da yapıldı. Ama **"nasılsa eziliyor" varsayımı yanlış çıktı**: legacy
bloktan altı bildirim hâlâ etkiliydi ve silinince ekran değişti. Bunlar
war-room kurallarına **açıkça** yazıldı — kalıtım kazası yerine yazılı karar:

| taşınan | nereye | neden hâlâ etkiliydi |
|---|---|---|
| `font-size:23px` · `line-height:1` · `transition` | `#story-tools .tool-btn` | war-room kuralı bu üçünü hiç yazmıyordu |
| `transition` | `#story-topright .ctrl-btn` | `font` kısayolu boyutu eziyordu ama geçişi değil |
| `z-index:20` | `#story-hud`, `#story-news` | `position:static` ama **flex öğesi** → yığılma sırası geçerli |
| `display:flex` · `flex-direction` · `overflow` | `#story-news` | yalnız `.story-brief-view` durumunda yeniden yazılıyordu |

`.tool-btn`'in 23px'i doğrudan görünmüyor (çocuklar kendi boyutlarını taşıyor)
ama satır kutusunu ve düğme genişliğini belirliyor: kaldırıldığında araç çubuğu
daralıyor, **taşma menüsüne düşen düğme sayısı değişiyor** — yani DOM değişiyor.
Değerin kendisi sorgulanabilir; o kusur 10'un işi, bu turda davranış korundu.

**Ölçüm aleti:** hikâye dünyasında 735 düğüm × 41 hesaplanmış özellik × 10 sahne
(dünya + 9 araç çekmecesi) parmak izi.

| kapı | sonuç |
|---|---|
| sahne determinizmi (aynı ağaçta iki koşu) | **0 fark** — sabit tohum + dondurulmuş dünya |
| HEAD ⇄ tasfiye edilmiş ağaç | düğüm farkı **0** · **gerçek özellik farkı 0** |
| kalan 50 fark | 40'ı `position:static` üstünde etkisiz ofset · 10'u worktree `icons.png` yolu |
| negatif kontrol (`tool-btn` +1px) | **102 fark yakalandı** → alet kör değil |
| `--uitest` | `PROBLEMS []` |

> **Alet iki kez yanılttı, ikisi de düzeltildi.** (1) İlk koşuda tohum sabit
> değildi → dünya her koşuda başkaydı, 1583 "fark" çıktı; sabit tohumla 0'a
> indi. (2) Dünya ölçüm sırasında tıklamaya devam ediyordu → iki koşu farklı
> an ölçüyordu (`DURAKLAT` ⇄ `DEVAM` düğme genişliği, fazladan `.pool-cmd`
> düğümleri). `storyAdvance` no-op yapılınca düğüm farkı 36 → 0.

---

## 04 · Görüşme çalışma alanı

Bu yüzey projedeki en çok iterasyon görmüş ekran (`qa-runtime/conversation-ui*`, beş tur)
ve `../docs/ux/qa/design-qa.md` bölüm 2'de **passed**. Buradaki iş yeniden tasarım değil, **iki eksik mercek**.
Üç sütunlu kompozisyon korunur — kabul edilmiş bir sonucu geri almamak için.

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 20 | İlişki merceği yok: geçmiş/borç/verilen söz zinciri tek yerde görünmüyor | MW-014 · ilişki **çubukları solda**, zincir (`ANLAŞMALAR & KAYITLAR`) **sağda** ayrı blokta | Sol sütun sekmeli (`PROFİL` / `İLİŞKİ`); zincir söz → ittifak/anlaşma → borç → eylem sırasında, çubukların hemen altında | **`UYGULANDI`** `12b693c` |
| 21 | Geçmiş sütununda arama/filtre yok; oturum arttıkça sürdürme kullanılamaz oluyor | `js/Talks.js` düz liste | Arama + tür süzgeci + eşleşme sayacı (yapışkan çubuk). **"Muhataba göre gruplama" yapılmadı**: liste zaten tek muhataba ait, gruplayacak ikinci taraf yok | **`UYGULANDI`** `1f78abf` |

#### 20 — uygulandı (bu turda, oyunda)

**Veri zaten vardı, yeri yanlıştı.** `storyTalkConversationKnownRecords` sözü,
ittifakı, ihaneti, borcu ve uygulanmış eylemleri `PlayerKnowledge` süzgecinden
geçirip zaten üretiyordu — ama ilişki **durumu** (güven/saygı/borç çubukları) sol
sütunda, o durumu doğuran **zincir** sağ sütunda duruyordu. Oyuncu "borç 2 neden?"
sorusunun cevabını iki sütun arasında arıyordu.

Sol sütun sekmeli oldu: `PROFİL` kimliği, `İLİŞKİ` ise çubukları **ve** zinciri
yan yana gösterir. Sağdaki "ANLAŞMALAR & KAYITLAR" bloğu kaldırıldı (aynı zincir
iki yerde durmasın).

| ölçüm | sonuç |
|---|---|
| PROFİL sekmesi | kimlik kartı **var** · çubuk 0 · zincir 0 |
| İLİŞKİ sekmesi | kimlik kartı **yok** · **5 çubuk** · zincir · boş kayıtta açık mesaj |
| sağ sütun | tek blok kaldı: `ÖNCEKİ KONUŞMALAR` · `ANLAŞMALAR` metni **yok** |
| zincir sırası | `VERİLEN SÖZ` → `İTTİFAK & ANLAŞMA` → `BORÇ & İHANET` — defterin istediği sıra |
| 24 kayıtta kırpma | 10 gösteriliyor + **`10 / 24 kayıt gösteriliyor`** notu |
| sekme değiştirme | dünya durumu **birebir aynı** |
| `--uitest` · sohbet regresyonları | `UITEST_PROBLEMS []` · ikisi de geçti |

**Kırpma veri katmanından çizime taşındı.** `storyTalkConversationKnownRecords`
içindeki `.slice(0, 12)` kaldırıldı: veri katmanında kesilince çizen taraf kaç
kayıt kaçırdığını bilemiyor ve sessizce eksik gösteriyordu — kusur 17'de ölçülen
aynı hata sınıfı. Artık kaç kaydın gizlendiği ekranda yazıyor.

**Yetim çizici silindi.** Sağdaki blok taşınınca `storyTalkConversationRecordsHtml`
tek çağrısını kaybetti; yerinde bırakılmadı (kusur 12'de aynı sınıf temizlenmişti).


---

## 01 · Menü + kurulum

Handoff prototipinin en olgun kısmı, `../docs/ux/qa/design-qa.md` bölüm 1'de **passed**. İş dar.

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 22 | 12 soruluk akışta **geri alma yok**, ilerleme başlığa gömülü, adım göstergesi iki ekranda tutarsız | `js/Character.js:601-625` seçenek tıklanınca deftere yazılıp ilerliyor, dönüş yolu yok · `:596` sayaç başlık satırının içinde · `:392-399` tema dağılımı role göre değişiyor ama görünmüyor · `index.html:81` adım 2 = "BRİFİNG" ⇄ `:73` aynı adım = "KARAKTER" | Tema şeridi (nokta göstergeli) + `GERİ AL` + karar defteri (satıra tıkla → o soruya dön). **Geri alma çıkarma değil YENİDEN OYNATMA** (aşağıda) | **`UYGULANDI`** `d2ad747` + `ec44b66` |
| 23 | Yeni tipografi ölçeği uzun Türkçe etiketleri kırpmamalı | `../docs/ux/qa/design-qa.md:20` mevcut kabul ölçütü | Kanıt sahnesi: 8 gerçek devlet adı + en uzun gerçek brifing etiketleri büyütülmüş ölçekte; sahnedeki **kırpma denetimi** `scrollWidth > clientWidth` olan etiketi kırmızı işaretler | **`UYGULANDI`** `2f5f62e` · **kapı gerçek oyuna kuruldu, mockup sahnesine değil** |
| **25** | **⛔ Kampanyayı başlatan buton 916×572'de ekran dışında ve kaydırma yok** | aşağıda | Brifing sütunu kaydırmalı + birincil eylem yapışkan alt şeritte | **`UYGULANDI`** `67a403c` |

#### 21 — uygulandı (bu turda, oyunda)

Süzme boyutları oturumun **kendi alanlarından** geliyor: `initialText` (metin) ve
`conversationCase.mode` (tür). Tür çipleri yalnız kayıtta **gerçekten bulunan**
türler için çizilir — sürekli boş sonuç veren süzgeç sunmanın anlamı yok.

**Defterin bir isteği bilerek yapılmadı:** "muhataba göre gruplama". Bu liste
`listenerActorId` ile zaten tek muhataba süzülüyor; gruplayacak ikinci taraf yok.
Uydurma bir grup başlığı eklemek yerine madde bu notla kapatıldı.

| ölçüm | sonuç |
|---|---|
| 5 gerçek oturum (`SESSION_STARTED` ×5) | 5 satır · arama kutusu · 2 çip · `5 / 5 konuşma` |
| arama `lojistik` | 2 satır, uymayan **0**, sayaç `2 / 5`, **odak kutuda kalıyor** |
| eşleşme yok (`zzzz`) | 0 satır, **arama kutusu duruyor** (yoksa süzgeçte kilitlenirdin), boş mesaj, `0 / 5` |
| **tür ayrımı** | `TASKS_JOBS 2/2` · `DAILY_CHAT 2/2` · `CONFIDENTIALITY 1/1` — üçü de görünen = beklenen |
| dünya durumu | süzgeç/arama sonrası saat, oturum sayısı, log **birebir aynı** |
| `--uitest` · sohbet regresyonları | `UITEST_PROBLEMS []` · `story-conversation-player-regressions` ve `-context` **geçti** |

**Ayrım gücü ayrıca kanıtlandı.** İlk ölçümde beş oturum da `DAILY_CHAT` çıktı;
süzgeç "çalışıyor" görünüyordu ama hiçbir şeyi ayırmıyordu. Saklanan oturumların
türü çeşitlendirilip üç ayrı türde görünen=beklenen doğrulandı. Ayırt ettiği
gösterilmeyen süzgeç, süzgeç sayılmaz.


#### 22 — uygulandı (bu turda, oyunda)

**Öneri bir noktada yanlıştı ve ölçümle düzeltildi.** Defterde "geri alma mevcut
`decisions` defterinden son kaydı çıkarır" yazıyordu. Bu **çalışmaz**: `charClampAxes`
eksenleri 0-100'e kırpıyor, yani kayıplı. Ölçüldü:

| | eksen `hawk` |
|---|---|
| karar öncesi | **96** |
| `+8` etki → kırpıldı | 100 |
| "son kaydı çıkar" ne verirdi | **92** ← yanlış |
| doğru değer | **96** |

**Ve bu gerçek oyunda erişilebilir bir durum.** Soru bankasındaki 188 `fx` bloğu
tarandı: 12 soruda tek bir eksen `hawk` 123'e, `auth` 131'e, `pop` 126'ya kadar
çıkabiliyor — üçü de tavanı aşıyor. Yani çıkarma yaklaşımı karakteri **sessizce**
bozardı. Bu yüzden geri alma kararları baştan oynatıyor (`charRewindTo`), ileri ve
geri yol tek fonksiyondan (`charApplyDecision`) geçiyor.

**Doğrulama:**

| ölçüm | sonuç |
|---|---|
| 5 karar → 3'e geri sar, beklenen durumla karşılaştır | eksen/tag/seed/tema/aşama/qIndex **birebir eşit** |
| geri al + aynı seçeneği tekrar seç | durum **aynı** (idempotent) |
| `--uitest` | altı adım `OK`, `UITEST_PROBLEMS []` |

**Eklerken kendi düzelttiğim kusur sınıfını ürettim ve yakaladım.** Karar defteri
açıkken (11 karar) son satırın alt kenarı 950 px, viewport 572 — ekran dışında ve
panel kaymıyordu (`overflow: visible`). Bu, kusur 25'in aynı sınıfı. `.char-body`
kaydırılabilir yapıldı (`overflow-x` açıkça `hidden`, yoksa CSS diğer ekseni
`auto`ya çözüyor). Önce listeye de ayrı kaydırma vermiştim; iç içe iki kaydırma
fare tekerleğini öngörülemez yaptığı için kaldırıldı, tek kaydıran kap var.

| viewport | panel ekran dışı | ilk seçenek görünür | kaydırınca son satır görünür |
|---|---|---|---|
| 916×572 | hayır | evet | evet |
| 1024×640 | hayır | evet | evet |
| 1280×800 | hayır | evet | evet |

**İkinci yarısı — `UYGULANDI` `ec44b66`.** Adım göstergesi tutarsızlığı kapandı.
`index.html:81` 2. adımı "BRİFİNG" diye yazıyordu; brifing kurulum ekranının
**kendi bölümü** (`index.html:99` "HAREKÂT BRİFİNGİ"), ayrı bir adım değil.
Gerçek akış `kurulum → charOpen (js/WarRoomUI.js:179) → charFinish →
storyNewCampaign` olduğuna göre 2. adım KARAKTER; etiket ona çekildi.

| ölçüm | sonuç |
|---|---|
| iki ekranın şerit metinleri | birebir aynı (`1 · DEVLET & ÇAĞ` / `2 · KARAKTER` / `3 · SEFER`) |
| aktif adım | kurulum = 0, karakter = 1 |
| `charOpen()` sonrası aktif etiket | `2 · KARAKTER` |
| yatay taşma | 0 |
| `--uitest` | `PROBLEMS []` |


### 25 — bu turda **yeni bulundu ve ölçüldü** (en ağır bulgu)

`#btn-story-start` ("HİKÂYEYİ BAŞLAT"), 916×572'de **ekranın 60 px altında** kalıyor
ve o ekranda **hiçbir kaydırma yolu yok**. Yani bu boyutta oyuncu kampanya başlatamıyor.

**Ölçüm** (gerçek giriş yolu: menüde "YENİ HİKAYE" tıklandı, 8 devlet kartı dolu):

| viewport | butonun alt kenarı | durum |
|---|---|---|
| **916×572** | **632 px** | **ULAŞILAMAZ** (60 px altta) |
| 1024×640 | 633 px | görünür — **7 px** payla |
| 1600×900 | 807 px | görünür |

**Mekanizma:**
- `.wr-setup-layout` (`style.css:919`) `height: calc(100% - 92px)` sabit, `overflow` kuralı **yok**
- `.app-screen` (`style.css:589`) `overflow: hidden` → taşan kısmı kırpıyor
- Kurtarıcı kural **var ama yanlış koşulda**: `style.css:994` `overflow:auto` veriyor,
  fakat `@media (max-width: 900px)` altında — 916 px'te uygulanmıyor.

**Kök neden yükseklik, genişlik değil.** 1024×640'ta 7 px payla kurtuluyor; kırılma
noktası yalnız genişliğe baktığı için yükseklik kaynaklı arızayı göremiyor.
`../docs/ux/qa/design-qa.md` bu ekranı **916×572'de "passed"** işaretlemiş; aynı QA notu
*"kurulum ekranının yalnızca kısa masaüstü yüksekliği yüzünden tek sütuna
çökmesini engelledik"* diyor — yani kırılma noktası bilinçli olarak yükseklikten
koparılmış ve bu arıza o değişiklikle açılmış olabilir.

Kanıt: `qa-runtime/mockup-baseline/kusur-25-baslat-butonu-916x572.png`
(son görünen satır "SİS-İ HARP"; buton ve GERİ hiç yok, kaydırma çubuğu da yok).

#### 25 — uygulandı (bu turda, oyunda)

Oynanabilirliği doğrudan kestiği için mockup kabulü beklenmeden düzeltildi.
Değişiklik yalnız `style.css`'te, iki kural:

- `.wr-briefing` → `min-height:0; min-width:0; overflow-y:auto; overflow-x:hidden` + ince amber kaydırma çubuğu
- `.wr-setup-actions` → `position:sticky; bottom:0` + üstten gradyanlı zemin

Kırılma noktasına (`@media (max-width:900px)`) **dokunulmadı** — o, kurulum ekranının
kısa yükseklikte tek sütuna çökmesini engellemek için bilerek genişliğe bağlanmıştı.

**Ara tuzak (ölçüldü):** ilk denemede yalnız `overflow-y:auto` yazıldı. CSS'te bir
eksen `visible` değilse diğeri `auto`ya çözülür → yatay kaydırma çubuğu çıktı ve
"Derin Savunma" ile "FANTEZİ" etiketleri kırpıldı. `overflow-x:hidden` + `min-width:0`
ile kapatıldı.

**Sonuç ölçümü:**

| viewport | önce | sonra |
|---|---|---|
| 916×572 | buton alt kenarı **632** (60 px ekran dışı, kaydırma yok) | **488** — görünür, sütun kayıyor |
| 1280×800 | 711 — görünür | 711 — **değişmedi**, kaydırma çubuğu çıkmıyor |

**Regresyon kontrolü:** reponun kendi uçtan uca testi temiz —
`electron . --uitest` → `menu · kurulum · karakter-görünür · sorular · özet · dünya`
hepsi `OK`, `UITEST_PROBLEMS []`, `UITEST_OK`. Konsol hatası yok. Sayfa yatay taşması yok.
Çekimler: `qa-runtime/mockup-baseline/kusur-25-DUZELTILDI-916x572.png` ve `-1280x800.png`.

**Doğrulanan, kusur OLMAYAN iki şey** (ikisi de ölçüldü, iddia değil):

1. Soru sayacı `/12` doğru — her rol politikasının toplamı 12 (`js/Character.js:392-399` + `:423`).
   Sayaç yalan söylemiyor, yalnız görünürlüğü zayıf.
2. **Soru ekranı bugün kırpılmıyor.** `.app-screen` `overflow:hidden` ve `.char-body`
   kaydırmasız olduğu için "kısa ekranda içerik kesiliyor olabilir" şüphesi vardı.
   Gerçek oyunda ölçüldü (Electron, `charOpen()` + `CHAR_UI.step=1`):

   | viewport | son seçeneğin alt kenarı | sonuç |
   |---|---|---|
   | 916×572 | 497 px | sığıyor (75 px pay) |
   | 1280×800 | 501 px | sığıyor |

   Yani kusur yok. **Ama ölçülen kısıt var:** 916×572'de yalnız ~75 px boşluk kalıyor.
   Bu yüzden 22'nin önerisi tam liste değil, **tek satırlık çip şeridi** olarak
   tasarlandı — tam liste denendiğinde içerik 669 px'e çıkıp sahneyi taşırdı
   (taşma kapısı yakaladı).

---

## Kapı durumu

Her mockup sayfası üç kapı çalıştırır (araç çubuğunda canlı):

Her mockup sayfası üç kapı çalıştırır (araç çubuğunda canlı). **Gerçek Chromium'da
(Electron) 4 sayfa × 2 katman = 8 kombinasyonun tamamı geçti:**

| Kapı | Ne ölçer | Sonuç |
|---|---|---|
| **KAPSAMA** | Bu yüzeyin bu katmandaki her kusuru sahnede pin almış mı | 8/8 **tam** (25 kusur, 57 pin) |
| **TAŞMA** | Öneri sahnelerinde içerik sahne kutusunu aşıyor mu (`../docs/ux/qa/design-qa.md:15` ölçütü) | 8/8 **taşma yok** |
| **KUTU** | Esnek/ızgara kaplarında çocuklar kendi kabını aşıyor mu (kusur 24'ten sonra eklendi) | 8/8 **taşma yok** |
| **FONT** | `Share Tech Mono` + `Press Start 2P` `file://` altında çözülüyor mu | 8/8 **çözüldü** |

"ŞU AN" sahneleri taşma kapılarının **dışındadır** (`data-gate="off"`): mevcut kusurları
bilerek yeniden ürettikleri için ölçülseler kapı sürekli kırmızıda kalır ve sinyal ölür.

**KUTU kapısı neden sonradan eklendi.** TAŞMA yalnız *sahne* kutusuna bakıyordu ve
kusur 24'ü kaçırdı: çipler kendi kabını (`#story-stats`) 369 px taşırıp başlığın
üstüne akıyordu ama sahneyi taşırmadığı için kapı yeşil kalıyordu. Oyunun kendi QA'sı
da (`../docs/ux/qa/design-qa.md`) aynı körlükteydi — yalnız *sayfa* taşmasına bakıyordu. Ölçüt artık
iki kademeli; `../docs/ux/qa/design-qa.md`'nin "Üçüncü QA turu" bölümünde de aynı şekilde güncellendi.

**Kapı negatif kontrolle doğrulandı.** Yeni bir kapının asıl riski hiçbir şey
yakalamayıp sürekli yeşil yanmasıdır. Aynı mantık "ŞU AN" sahnelerine uygulandığında
kapı **yalnız** kusur 24'ü yeniden üreten kutuda ateşliyor (`stats-simdi` 253 px,
`stats-simdi2` 116 px) ve diğer üç sayfanın hem ŞU AN hem ÖNERİ sahnelerinde sessiz.
Yani ayrım gücü var.

### Kapıların yakaladıkları (mockup'ın kendi kusurları — hepsi düzeltildi)

Kapılar süs değil; gerçek-Chromium turlarında beş şey yakaladılar:

1. **FONT yanlış alarmı.** `document.fonts.check()` tek başına yetmiyor:
   `font-display:swap` fontu sayfada henüz *kullanılmadıysa* yüklenmez ve `false` döner.
   Press Start 2P yalnız katman B'deki bir başlıkta kullanıldığı için kapı kırmızı yandı.
   Kapı artık önce `fonts.load()` çağırıyor — sorduğumuz şey "dosya çözülüyor mu",
   "şu an boyanıyor mu" değil.
2. **Taşma kapısı fazla kaba idi.** Kaydırılabilir bir ata içindeki içerik erişilebilir
   durumdadır ve taşma sayılmamalı; `overflow:hidden` ata içindeki içerik ise gerçekten
   kesiliyordur. Kapı bu ayrımı yapmıyordu → hikaye gündem listesi (gerçekte kaydırmalı,
   `style.css:1298`) yanlış yere kırmızı yandı.
3. **Üç gerçek taşma** — hepsi mockup'ın kendi öneri sahnelerinde:
   01/B soru ekranı 669 px (sahne 572), 02/A üretim barı notu 586 px, 03/B gündem listesi.
   Üçü de düzeltildi; 01'deki düzeltme öneriyi de değiştirdi (tam liste → çip şeridi).
4. **Çekim harness'ında boyama yarışı** — yeniden kullanılan pencerede `capturePage()`
   boyanmamış kareyi alıyordu (03/B bomboş çıktı, DOM'u doğruydu). Harness'a çift `rAF`
   beklemesi eklendi. Bu mockup kusuru değil, ölçüm aleti kusuruydu.
5. **KUTU kapısının kendi yanlış alarmı — ölçek karışması.** Kapının ilk sürümü
   04'te dört "taşma" raporladı (1–4 px). Hepsi sahteydi: `.stage` CSS ile
   ölçekleniyor, `getBoundingClientRect()` ölçekli değer döndürüyor ama
   `getComputedStyle().paddingLeft` ölçeksiz. İkisini karıştırmak
   `dolgu × (1 − ölçek)` kadar sahte aşım üretiyor — 0.798 ölçekte 16 px dolgu
   tam 3.2 px eder, raporlanan 3.93 ile uyuşuyor. Dolgu ve kenarlık artık ölçekle
   çarpılıyor, eşik de sahne koordinatına geri çevriliyor.

### Geri çekilen iddialar (ölçüm sonrası)

Bu turda **dört** iddia ölçümle çürütüldü. Damga defterinin varlık sebebi bu:

1. **Soru sayacı yanlış** → `/12` doğruymuş (`js/Character.js:596`).
2. **12 soruluk ekran kırpılıyor** → kırpılmıyormuş, 916×572'de 75 px pay var.
3. **Kusur 8: minimap kenarlığı legacy mavi** → `style.css:1905`'te zaten eziliyormuş;
   madde gerçek kalıntılara (`.spawn-cat`, savaş `.spawn-btn:hover`, kamera ipucu) çevrildi.
4. **Kusur 1: `#ui-info` ölü panel, silinmeli** → **ölü değil**; dizim fazında görünür ve
   çalışıyor. Öneri kabul edilseydi **çalışan bir panel silinecekti**. Ayrıca "çoklu seçim
   durumu yok" da yanlış: metin `js/main.js:991`'de zaten vardı, yalnız gizli düğüme yazılıyordu.

Buna karşılık **kusur 6 ters yönde şaşırttı**: defterde yazandan *daha ağır* çıktı
(satır içi stil geri açılmıyordu → ipucu oturum boyunca kayboluyordu).
**Kusur 11 de öyle**: iki kural değil dokuz kural.

> **Ölçüm aleti dersi (bu turda üç kez tekrarlandı).** Bir kapı kırmızı yandığında
> ilk soru "tasarım mı bozuk" değil, **"alet doğru mu ölçüyor"** olmalı. Bu turda
> üç kez alet hatalıydı, tasarım değil: `fonts.check()` yüklenmemiş fontu yok sayıyordu ·
> `scrollWidth` sözde-öge tooltip'ini sayıyordu · `getBoundingClientRect` ile
> ölçeksiz `padding` karıştırılmıştı. Üçü de "düzelttiğim" şeyin aslında sağlam
> olduğu vakalardı. Karşı önlem: her yeni kapı **negatif kontrolle** doğrulanır —
> bilinen bozuk bir örnekte ateşlediği gösterilmeden kapı sayılmaz.

---

## Bulaşmazlık

Mockup turu oyuna dokunmadı; **iki istisna: kusur 25 ve kusur 24**. İkisi de
görsel tercih değil, ölçülmüş arıza — bu yüzden katman kabulü beklenmedi.

- `mockup/**` — tüm mockup dosyaları (oyuna girmez).
- `style.css`:
  - kusur 25 → `.wr-briefing`, `.wr-setup-actions` (commit `67a403c`)
  - kusur 24 → (commit `ee81aaa`) `#story-stats` + iki `@media` bandı; `@media (max-width:980px)`
    içindeki sıra tabanlı `nth-of-type(n+4)` kuralı kaldırıldı
- `js/StoryUI.js` — kusur 24 için **yalnız sınıf adı**: beş çipe `t2` kademe işareti.
  Sayı, metin veya davranış değişmedi.
- `index.html`, `electron/**` ve diğer `js/**` **değişmedi**.
- `package.json` → `build.files` listesinde `mockup/**` yok → EXE paketine girmez
  (liste: `electron/**/*`, `js/**/*`, `assets/**/*`, `icons.png`, `index.html`, `style.css`).

> **Dikkat — paralel çalışma hattı:** bu tur sırasında repoda başka bir iş hattı da
> ilerledi (`707bf9b Faz 38.8 ortak kriz hafizasini bagla` ve sonrası) ve
> `index.html` · `js/StoryFeatures.js` · `js/StoryCharacterRoleAdapters.js`
> dosyalarına dokundu. Bunlar **bu turun işi değil**.
> `index.html`'e eklenen tek satır 588. satırdaydı; bu mockup'ların atıf yaptığı
> tüm aralıklar (`:39-115`, `:190-350`, `:372-492`) bunun üstünde kaldığı için
> **satır referansları hâlâ geçerli**. Referanslar bayatlarsa pin tooltip'leri ve
> lejant tablosu yanlış yeri gösterir — uygulama turundan önce bir kez daha
> kontrol edilmeli.
