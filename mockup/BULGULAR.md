# Kusur defteri — UX/UI mockup turu

Bu dosya **damga defteridir**. Her satır üç durumdan birini taşır:

| Damga | Anlamı |
|---|---|
| `AÇIK` | Mockup'ta önerisi var, kullanıcı henüz kabul etmedi |
| `KABUL` | Kullanıcı öneriyi onayladı, uygulanmayı bekliyor |
| `UYGULANDI <commit>` | Oyuna girdi; commit hash'i yazılmadan bu damga geçersizdir |

**Damgasız satır güvenilmez sayılır.** Bu repoda plan/doküman bayatlaması ölçülmüş
bir sorun (`docs/OLCUM-TUZAKLARI.md`); damga onun karşı önlemidir.

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
| 1 | Seçili birim özeti hiç görünmüyor; çoklu seçim durumu yok | `js/main.js:976-989` her karede yazıyor · `style.css:1834-1836` `display:none !important` · `js/WarRoomUI.js:321` daima tek birim | Ölü `#ui-info` silinir; hedef kartı **üç duruma** çıkar (seçim yok / tek birim / N birim dökümü + en zayıf birim) | `AÇIK` |
| 2 | PARAŞÜT butonu cooldown veya bütçe yetersizken **sessizce hiçbir şey yapmıyor** | `js/WarRoomUI.js:283` gizli butona `.click()` · `js/main.js:348` erken return · `js/main.js:991-994` cooldown gizli panele yazılıyor | Emir butonları durum katmanı kazanır: `HAZIR` / `BEKLEME 18s` (dolan çubuk) / `150₺ gerek · 90₺ var` | `AÇIK` |
| 3 | Komut geri bildirimi yok: tıklama işareti, hedef onayı, ses yok | `js/main.js:186-333` sağ tık tek kanal · `js/WarRoomUI.js:360` yalnız eksen çizgisi | Hedef noktada 400 ms işaret (hareket = daire, taarruz = eşkenar) + kartta `EMİR ALINDI → hedef` satırı | `AÇIK` |
| 4 | Kısayol etiketleri butonlarda yok; kontrol grubu (Ctrl+1..9) hiç yok | `js/main.js:771-801` M/U/Esc bağlı ama etiketsiz | Butonlara kısayol rozeti; sol yığının altına 6 slotlu kontrol grubu şeridi | `AÇIK` |
| 5 | Savaşta üretim barı kalıntı olarak 76 px yer kaplıyor | `js/main.js:665-666` `opacity .3` + `pointerEvents:none` | Savaş fazında tamamen kalkar; boşalan şerit kontrol grubuna ve büyütülmüş minimap'e (200×110 → 236×130) gider | `AÇIK` |
| 6 | Kamera ipucu yalnız `startBattle()` yolunda gizleniyor → rematch/MP'de sol yığının altına giriyor | `js/main.js:667` JS ile gizleniyor, CSS'te savaş-fazı kuralı yok | Gizleme CSS'e taşınır (`body[data-phase="battle"]`), JS'e bağımlılık biter | `AÇIK` |
| 7 | Muharebe kaydı `aria-live` taşımıyor | `index.html:434` · yalnız `#battle-target-card` taşıyor | `aria-live="polite"` + `role="log"` | `AÇIK` |

### Katman B — görsel dil

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 8 | Legacy kalıntılar | `style.css:235-237` `.spawn-cat` yeşil/12px/r5 — **war-room override'ı hiç yok** · `:277` savaşta `.spawn-btn:hover` mavi glow'a düşüyor · `:130-142` kamera ipucu 7px/`#888`, yalnız `:1777` deploy'da ezilmiş | Üçü de `tokens.css` yüzeylerine çekilir | `AÇIK` |
| 9 | Duraklatma modalı ve öğrenme bildirimi **tamamen inline stil**; üstelik modalın **kendi içinde** iki font var | `js/main.js:727-739` — kutu `font-family:inherit` → body'den **Press Start 2P**, ama butonlarda `font-family` yok → **tarayıcı sans-serif**'i · `js/main.js:761-763` bildirim `#8ecbff` / `14px system-ui` / `z-index:99999` · gerçek çekim: `qa-runtime/mockup-baseline/kusur-09-duraklatma-modali.png` | İkisi de terminal diline geçer; inline stil kalkar | `AÇIK` |
| 10 | 7-9 px yazı boyutları | `style.css:1845` 8px · `:1870` 7px · `:1884` 9px · `:1893` 7px | `--wr-fs-*` ölçeği: micro 9 · small 10 · body 11 · label 13 · title 15 | `AÇIK` |
| 11 | `:focus-visible` hover ile **birebir aynı** → klavye odağı görünmüyor | `style.css:1877-1878`, `:1887-1888` | `--wr-focus: #6cc7ff` ile ayrı odak halkası | `AÇIK` |
| 12 | Yetim CSS | `style.css:188-218` `#train-ai-btn` · `:404` `#ai-training-screen` — HTML'de ve JS'te karşılığı yok | Silinir | `AÇIK` |
| 13 | CRT bazı arazi tohumlarında konsept çekimden parlak | `design-qa.md:36` — turun **tek açık P3 bulgusu** | Duraklatma modalına CRT yoğunluk kaydırıcısı (`--wr-crt-alpha`); yalnız görsel katman, sim etkilenmez | `AÇIK` |

---

## 03 · Hikaye dünyası

### Katman A

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 14 | Rol seçimi navigasyonu süzmüyor: 8 araç herkese aynı | `MODERN_DUNYA_EKSIKLERI.md` MW-014 / MW-020 · `index.html:230` sabit 8 araç | Rol süzgeci yalnız **görünürlüğü** değiştirir; dünya durumu değişmez → determinizm korunur (`HIKAYE_MODU_UYGULAMA_DURUMU.md:344-354`) | `AÇIK` |
| 15 | Gündem yönlendiriyor ama **karar verdirmiyor** | `js/StoryUI.js:237-251` yalnız panel açıyor · MW-003 | Gündem kartı: isimli **muhatap** + 2-3 **bedelli karar** + yetki yetersizliği görünür; "panele git" ikincil olur | `AÇIK` |
| 16 | AKIŞ son 6 kayıtla sınırlı | `js/Story.js:124` `log.length > 6` kırpılıyor | Kırpma sınırı **veride** yükselir (UI'da değil), AKIŞ arşive dönüşür: arama + tür filtresi | `AÇIK` |
| 17 | Uzun aday listelerinde arama/filtre yok (ilk 8 gösteriliyor) | `HIKAYE_MODU_UYGULAMA_DURUMU.md` Faz 38.1 açık borç | Arama kutusu + filtre çipleri + `8 / 25 gösteriliyor` sayacı | `AÇIK` |
| 18 | "NEDEN DEĞİŞTİ?" neden-izi bazı alanlarda yok | `HIKAYE_MODU_UYGULAMA_DURUMU.md:271-298` kapsam sınırı: diplomasi, sadakat, itibar, üretim kuyruğu, ordu listesi | Rozet kapsamı bu beş alana genişler | `AÇIK` |
| **24** | **Komuta çubuğu kaynak çipleri kutuyu taşırıp başlığın üstüne akıyor** | `style.css:1206` `justify-content:flex-end`, `overflow` kuralı yok · `:1207` `.story-stat-chip min-width:92px` | Öncelik kademesi + `overflow:hidden` (aşağıda) | `AÇIK` |

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

**Neden bugüne dek kaçtı:** `design-qa.md:15`'teki kontrol *sayfa* yatay taşmasına
bakıyordu (`scrollWidth`), kutu-içi flex taşmasına değil. Sayfa taşmıyor —
içerik kutunun dışına akıyor. Kanıt: `qa-runtime/mockup-baseline/kusur-16-akis-sekmesi.png`
(1280×800, gerçek oyun — "PIXEL AVRUPA" başlığının üstünde "Türk Cumhuriyeti" ve
"PETROL 319" okunuyor).

**Öneri ve doğrulaması:** kademe 1 (DEVLET · PETROL · İNSAN · PUAN) daima tam;
kademe 2 (GAZİ · ELEKTRONİK · ENF · TARİH · ÇAĞ) dar ekranda etiketini bırakıp
yalnız değeri gösterir (etiket `title` ile erişilebilir kalır); kutu `overflow:hidden`.
Mockup'ta 1280 px'te ölçüldü:

| | içerik | kutu | taşma | başlıkla örtüşme |
|---|---|---|---|---|
| ŞU AN | 954 px | 701 px | 253 px | **237 px** |
| ÖNERİ | 625 px | 764 px | yok | **yok** |

### Katman B

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 19 | Eski mavi hikaye bloğu duruyor | `style.css:1005-1185` ⇄ `:1188-1356` | Üç adımlı tasfiye, aşağıda ölçülmüş | `AÇIK` |

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

---

## 04 · Görüşme çalışma alanı

Bu yüzey projedeki en çok iterasyon görmüş ekran (`qa-runtime/conversation-ui*`, beş tur)
ve `design-qa.md` bölüm 2'de **passed**. Buradaki iş yeniden tasarım değil, **iki eksik mercek**.
Üç sütunlu kompozisyon korunur — kabul edilmiş bir sonucu geri almamak için.

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 20 | İlişki merceği yok: geçmiş/borç/verilen söz zinciri tek yerde görünmüyor | MW-014 · `js/Talks.js:1270` profil kartı statik | Sol sütun sekmeli olur (`PROFİL` / `İLİŞKİ`); zincir söz–anlaşma–borç–eylem olarak dizilir, `PlayerKnowledge` süzgecinden geçer (`HIKAYE_MODU_UYGULAMA_DURUMU.md:747, :857`) | `AÇIK` |
| 21 | Geçmiş sütununda arama/filtre yok; oturum arttıkça sürdürme kullanılamaz oluyor | `js/Talks.js:1549` düz liste | Arama + tür filtresi + muhataba göre gruplama + eşleşme sayacı | `AÇIK` |

---

## 01 · Menü + kurulum

Handoff prototipinin en olgun kısmı, `design-qa.md` bölüm 1'de **passed**. İş dar.

| # | Kusur | Kanıt | Öneri | Damga |
|---|---|---|---|---|
| 22 | 12 soruluk akışta **geri alma yok**, ilerleme başlığa gömülü, adım göstergesi iki ekranda tutarsız | `js/Character.js:601-625` seçenek tıklanınca deftere yazılıp ilerliyor, dönüş yolu yok · `:596` sayaç başlık satırının içinde · `:392-399` tema dağılımı role göre 6/3/3 ↔ 1/7/4 değişiyor ama görünmüyor · `index.html:81` adım 2 = "BRİFİNG" ⇄ `:73` aynı adım = "KARAKTER" | Tema şeridi (nokta göstergeli) + `GERİ AL` + verilen kararlar listesi (satıra tıkla → o soruya dön). Geri alma mevcut `decisions` defterinden son kaydı çıkarır; yeni veri yapısı gerekmez | `AÇIK` |
| 23 | Yeni tipografi ölçeği uzun Türkçe etiketleri kırpmamalı | `design-qa.md:20` mevcut kabul ölçütü | Kanıt sahnesi: 8 gerçek devlet adı + en uzun gerçek brifing etiketleri büyütülmüş ölçekte; sahnedeki **kırpma denetimi** `scrollWidth > clientWidth` olan etiketi kırmızı işaretler | `AÇIK` |
| **25** | **⛔ Kampanyayı başlatan buton 916×572'de ekran dışında ve kaydırma yok** | aşağıda | Brifing sütunu kaydırmalı + birincil eylem yapışkan alt şeritte | **`DÜZELTİLDİ`** (commit bekliyor) |

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
`design-qa.md` bu ekranı **916×572'de "passed"** işaretlemiş; aynı QA notu
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
| **TAŞMA** | Öneri sahnelerinde içerik sahne kutusunu aşıyor mu (`design-qa.md:15` ölçütü) | 8/8 **taşma yok** |
| **FONT** | `Share Tech Mono` + `Press Start 2P` `file://` altında çözülüyor mu | 8/8 **çözüldü** |

"ŞU AN" sahneleri taşma kapısının **dışındadır** (`data-gate="off"`): mevcut kusurları
bilerek yeniden ürettikleri için ölçülseler kapı sürekli kırmızıda kalır ve sinyal ölür.

### Kapıların yakaladıkları (mockup'ın kendi kusurları — hepsi düzeltildi)

Kapılar süs değil; ilk gerçek-Chromium turunda dört şey yakaladılar:

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

---

## Bulaşmazlık

Mockup turu oyuna dokunmadı; **tek istisna kusur 25'in düzeltmesi**:

- `mockup/**` — tüm mockup dosyaları (oyuna girmez).
- `style.css` — **iki kural değişti** (`.wr-briefing`, `.wr-setup-actions`), yalnız kusur 25 için.
  Oynanabilirliği kesen bir arıza olduğu için katman kabulü beklenmedi.
- `index.html`, `js/**`, `electron/**` **değişmedi**.
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
