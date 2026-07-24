# MODERN DÜNYA PLANI — Karakter, Siyaset, Ekonomi, Medya, Şirketler, Hafıza

Kullanıcının mimari taslağının (karakter yaratma, siyasi spektrum, fraksiyonlar,
makroekonomi, medya/dezenformasyon, şirketler/oligarklar, kademeli hafıza, kara kuğu)
mevcut kod tabanına eşlenmiş, ölçülebilir uygulama planı. **Karar: kampanya
modern/yakın-gelecek çağa taşınır** (kullanıcı seçimi).

---

## 0. TAŞIYICI İLKELER (ölçümden gelen, pazarlıksız)

1. **Sayıları MOTOR hesaplar, LLM yalnız METİN yazar.**
   Ölçüm (gram_bench): 8B model "tam 2 satır yaz" kuralına bile uyamıyor. Şemalı JSON +
   dengeli sayı beklemek gerçekçi değil; *geçerli ama saçma* sayılar dengeyi sessizce
   çökertir ve hiçbir test yakalamaz. Kelebek etkisi zinciri deterministik kural
   motorudur; LLM o zinciri **anlatır**, kurmaz. LLM'in "seçim yapması" gereken yerde
   serbest üretim değil **çoktan seçmeli** verilir (enum-doğrulamalı tek kelime).

2. **Oyun LLM'siz de TAM oynanır.** Yapay anlatıcı varsayılan kapalı, tarayıcıda yok,
   CPU'da üretim ~45 sn. Simülasyon motorda yaşar; LLM açıksa dünyaya ses verir.
   Her LLM çıktısı doğrulayıcıdan geçer, tutmayan şablona düşer.

3. **Her aşama tek başına oynanabilir + jsdom tezgâhıyla ölçülür.** Denge değişikliği
   çoklu-kampanya kıyaslamasız işlenmez (8 devlet × 900 sn deseni). Denge bozan geri
   alınır (bu oturumlarda üç kez yapıldı).

---

## 1. ENVANTER — taslak kavramı → mevcut sistem

| Taslaktaki kavram | Mevcut karşılığı | Durum |
|---|---|---|
| Karakter yaratma / zar / soru ağacı | `STORY.commander`, yetenekler zaten 0-6 (`Story.js:262`) | EKRAN YOK → AŞAMA 1 |
| Kişilik etkisi | `personality` 24 yerde ama etkisi hafif | ZAYIF → AŞAMA 1'de motor |
| İdeolojik eksenler / kanunlar | `LAW_SLOTS` (8 slot, 23 seçenek) + anayasa (5 form) | VAR — eksen+fraksiyon bağlanacak |
| Dünya havası / dönemler | `Era.js` (5 metrik → 6 çağ, histerezis) | VAR |
| Halk desteği | `st.welfare`, komutan `loyalty` | VAR — fraksiyonlara ayrışacak |
| Fraksiyon onayı | — | YOK → AŞAMA 2 |
| Enflasyon, piyasa güveni | — | YOK → AŞAMA 3 |
| Stratejik kaynaklar | ⛽oil, ⭐pts, 👥man (düğüm geliri) | KISMEN → ⚡Elektronik + gıda |
| Tedarik zinciri → üretim | `Production.js` (fac/bar, kuyruk, sanayi merkezleri) | VAR — kaynak kapıları |
| Medya / haber | `storyLog` (ham günlük) | ÇEKİRDEK → AŞAMA 4 |
| Diplomasi / krizler | `Talks.js` (17 şablon, TREATIES, storyRel) | VAR |
| Sohbet + LLM | `Chatter.js` + `LLM.js` (doğrulayıcı+yedek) | VAR — desen kopyalanır |
| Şirketler / oligarklar | `storyIndustrialCenters` (embriyo) | YOK → AŞAMA 6 |
| Savaş → dünya | `Telemetry.js` (metrikler toplanıyor) | ÇEKİRDEK → AŞAMA 5 |
| Kademeli hafıza / kara kuğu | `STORY.log`; acil konsey altyapısı | KISMEN → AŞAMA 7 |

---

## AŞAMA 0 — MODERN ÇAĞ GEÇİŞİ (S; önce bu)

Dönem izi sanılandan az: çağ adları, devlet blokları, rütbeler, birimler modern-uyumlu.
Değişecekler (yalnız metin/tema — **hiçbir effect/denge değeri değişmez**):

- `STORY_START_YEAR 1904 → 2032` (kurgusal yakın gelecek; gerçek siyasete çakışmaz,
  dron/elektronik teması meşrulaşır). Takvim mekaniği aynı (1 yıl = 120 sn).
- Unvanlar: `['Bey','Paşa','Komutan','Ağa'] → ['General','Komutan','Paşa']`.
- LLM promptları "1900'lerin başında" → "yakın gelecekte"; few-shot örnekler modern ağza.
- Teknoloji ağacı AD güncellemeleri (effect aynı): Palet→Aktif Süspansiyon, Eğimli
  Zırh→Kompozit Zırh, Yıldırım Harbi→Ağ Merkezli Harekât, Şarapnel→Misket Mühimmatı,
  Roketatar→ÇNRA, Demiryolu→Lojistik Koridorları, Siper Kazısı→Mevzi Tahkimatı,
  Aristokrat Subaylık→Kurmay Kastı, Toprak Düzeni→Tarım Politikası, Halk
  Mektepleri→Devlet Okulları…
- `Chatter/Talks/StoryRender` dönem kokan ~22 satır modern eşdeğerine.
- ⛽ petrol → **ENERJİ** (görsel; mekanik aynı).

Doğrulama: 12 jsdom takımı + dönem-terimi grep + SMOKE_OK.

---

## AŞAMA 1 — KARAKTER YARATMA & KİŞİLİK MOTORU (M-L)

Kullanıcı isteği + tespiti: "komutanların karakter özellikleri var ama oyuna etkisi
zayıftı." Bu aşama iki iş yapar: (A) harekât kurulumundan sonra **karakter ekranı**,
(B) kişiliği süs olmaktan çıkarıp **tüm dünyayı süren motora** çevirmek. Sonraki her
aşama (fraksiyon tavrı, medya etkisi, şirket ilişkisi, LLM sesi) bu profilden okur —
o yüzden fraksiyonlardan ÖNCE gelir.

### 1A. Akış ve zar ekranı

`Kurulum (devlet & çağ → brifing) → KARAKTER → sefer başlar` — `screen-story-setup`
adımlarının arasına yeni ekran (`screen-story-character`).

- **İsim** girişi (varsayılan öneri: mevcut isim havuzundan).
- **Üç yetenek zarı**: ⚔ Savaş / 🕊 Diplomasi / ⚙ İktisat — **1-6** (mevcut 0-6
  ölçeğinin oynanır aralığı; `Math.min(6,…)` boru hattı aynen çalışır).
- **RASTGELE** düğmesi: her basışta üçü yeniden atılır (4/5/6, 2/6/3…).
- *Tasarım kararı — sınırsız zar neden bozmaz:* sınırsız yeniden atma "6/6/6 gelene
  kadar bas" demektir; zar anlamsızlaşır. Çözüm: **denkleştirme** — başlangıç Liderlik
  Puanı `LP = 21 − (zar toplamı)` (taban 3). Düşük zar = güçlü gelişim bütçesi
  (komutan ağacından erken düğüm), yüksek zar = hazır yetenek ama yavaş gelişim.
  Her atış oynanabilir; seçim zevk meselesi olur, istismar kapanır.

### 1B. Yol Ayrımları — uyarlanır 12 soru

Kullanıcının tarifi: A/B/C ağacı, 12 soru, **bir sonraki soru önceki cevaba göre
değişsin**; 4 seçenek × 12 derinlik = 4¹² ≈ **16.7 milyon farklı sonuç**.

*Mimari dürüstlük:* 16.7M sonuç kombinasyonu evet; ama 16.7M **elle yazılmış soru**
fiziksel olarak imkânsız (ve gereksiz). Aynı hissi veren doğru yapı:

- **Tema = komutan ağacının 3 dalı** (A=HARP, B=İDARE, C=SİYASET; `CommanderTree.js`
  ile birebir hizalı). Her temadan 4 soru → koşuda 12 soru.
- **Zincirleme kural: N+1'inci soru, N'inci CEVABIN etiketine göre seçilir** (tüm
  geçmişe göre değil). Yazım modeli tema başına: 1 kök + 4+4+4 takip = **13 soru/tema,
  toplam 39 yazılı soru · 156 seçenek.** Yazılabilir; ve oyuncunun yaşadığı şey aynen
  istenen: 1. soruda 2. şıkkı seçtiysen 2. soru o şıkkın DEVAMI olarak gelir
  ("Madem gazeteciyi tutuklattın — şimdi yabancı ajanslar süreci soruyor…").
  Sonuç uzayı yine 4¹²: profil, eksenler, tohum etiketleri kombinasyonu.
- Sorular modern vinyetler: sınır karakoluna dron saldırısı, grev dalgası, sızdırılmış
  ses kaydı, ambargo ültimatomu, ordu içi hizip…
- **Otomatik ağaç doğrulaması** (test): her düğüm erişilebilir, çıkmaz yok, her yol
  tam 12 soru — jsdom testi graf üzerinde gezer.

### 1C. Cevapların dünyaya bağlanması (etkiler — hepsi motor, sayı LLM'den gelmez)

Her seçenek şu alanlara yazar:

| Alan | Ne yapar |
|---|---|
| **4 ideolojik eksen (0-100)** | Şahin↔Güvercin · Otoriter↔Özgürlükçü · Halkçı↔Teknokrat · Milliyetçi↔Küreselci — taslaktaki spektrumun kendisi. Profilin kalbi. |
| Yetenek düzeltmesi | Tema ağırlıklı küçük +1'ler (zarı ezmez, renklendirir) |
| **Fraksiyon ön-tavrı** | AŞAMA 2 açılış değerleri: halkçı cevaplar işçiyi ısındırır, sermayeyi soğutur… |
| **Arketip unvanı** | Baskın eksen kombinasyonundan: Halkın Adamı / Gölge Teknokrat / Demir Yumruk / Oligark Dostu (taslaktaki 4 profil). Profil kartında, haber dilinde, LLM bağlamında görünür. |
| **Geçmiş tohumları** | 1-2 `legacy` etiketi ("darbe bastırdı", "sürgünden döndü") → AŞAMA 7 hafızasına doğar; LLM ve haberler sana geçmişinle hitap eder. |
| Başlangıç kaynağı/perki | Tek küçük somut avantaj (örn. İDARE ağırlıklı yol → başkentte +1 bina seviyesi) |

### 1D. KİŞİLİK MOTORU — "etkisi zayıftı"nın cevabı, tüm dünya için

Eksen/zar profili yalnız oyuncuya değil **tüm komutanlara ve 7 AI devletin
liderlerine** atanır. Kişilik artık davranış üretir:

- **AI devlet doktrini liderinden türer**: Şahin lider → saldırı eşiği düşük, geç
  çekilir (`storyEvalTarget`'a eksen terimi); Güvercin → tampon/pakt arar
  (`Talks` ağırlıkları); Teknokrat → Ar-Ge/sanayi önceliği (`storyCouncilContext` +
  yatırım tiki); Otoriter → sansür/baskı kanunlarına oy. **Lider değişince (darbe,
  seçim, ölüm) devletin karakteri gözle görülür değişir** — dinamik dünyanın
  bel kemiği: aynı harita, farklı liderler, farklı tarih.
- **Konsey**: `storyCouncilVoteScore`'daki `appeal` sistemi eksenlere oturtulur
  (bugünkü warrior/diplomat/aggr çarpanları 4 eksene genelleşir).
- **Sadakat**: fırsatçı profil zayıf devletten hızlı soğur (`StorySocial` erime
  çarpanı); ilkeli profil istikrarlı ama kırılınca (ihanet görürse) sert kopar.
- **Bağlar/husumet**: eksen mesafesi `cmd.bonds` sürüklenmesini yönetir — yakın
  profiller kliknleşir, uzaklar rekabet üretir → darbe koalisyonları kişilikten doğar.
- **Arenada** (küçük ve ölçülü): savunan/saldıran komutanın profili moral/çekilme
  eşiğine küçük çarpan (denge tezgâhıyla ayarlanır; büyük çarpan YASAK).
- **Sohbet/LLM**: `llmCommanderLine` eksenleri ve arketipi bağlama koyar — Demir
  Yumruk lider başka, Halkın Adamı başka konuşur.

### 1E. İsimli dünya + zar görünümü (kullanıcının iki somut isteği)

- **"AI Cumhurbaşkanı" → gerçek isim** (`Council.js:572`): karar ekranı, konsey
  paneli ve haberlerde yöneticinin ADI yazar ("Kararı Cumhurbaşkanı **Kaan General**
  verir"); darbe/seçimle değişince her yerde değişir (tek kaynak: `gov.leader` →
  isim çözücü yardımcı).
- **Barlar → zarlar**: komutan listelerindeki yetenek barları yerine `⚔4 🕊2 ⚙5`
  sayı rozetleri (1-6). Tüm komutanlar üretimde zar atar (bugünkü rastgele üretim
  1-6'ya oturtulur, `Story.js:238-264`). Profil kartında eksen mini-pusulası.

### Ölçüm

- Soru ağacı graf testi (erişilebilirlik, çıkmazsızlık, 12-derinlik).
- Eksen dağılımı: 1000 rastgele koşuda arketiplerin hepsi çıkabiliyor mu (tekele düşmemeli).
- **AI doktrin çeşitliliği ölçümü**: aynı haritada Şahin-ağırlıklı vs Güvercin-ağırlıklı
  lider kadrosuyla 900 sn — saldırı sayısı/pakt sayısı anlamlı ayrışmalı (bu, "kişilik
  gerçekten işliyor"un kanıtıdır).
- Denge: kişilik motoru açıkken 8 devlet dengesi mevcut bandın ±%10'unda.

---

## AŞAMA 2 — FRAKSİYON KATMANI (M)

**Veri** (`js/Factions.js`): devlet başına 5 grup, onay 0-100:
`workers` İşçiler & Sendikalar · `business` Sermaye · `military` Ordu & Emniyet ·
`intel` Aydınlar & Basın · `radicals` Militan Gruplar (taban düşük; kriz besler).
Açılış değerleri **oyuncuda karakter ekranından** (1C), AI devletlerde lider
profilinden türer. `storySave`'de `states` zaten serileşiyor → kalıcılık bedava;
eski kayıt `storyFactionBackfill`.

**Girdiler** (deterministik): kanun/anayasa seçeneklerine `fac:` deltaları (23+5
seçenek); savaş süresi/sonucu; refah değişimi; vergi; fetih; darbe/firar olayları.

**Etkiler** (mevcut kanallara bağlanır): ağırlıklı onay → `unrest` → refah/sadakat
erime çarpanı (mevcut `loyaltyHold` borusu); konseyde komutan oyları fraksiyon
baskısından etkilenir; `radicals` yüksek + refah düşük → **grev** (N sn üretim cezası
+ haber) ve darbe riski `military.ap`'den beslenir. AI simetrisi: `storyCouncilContext`
fraksiyon dengesini görür — AI yönetici de yatıştırmayı öğrenir.

**UI**: Konsey çekmecesine FRAKSİYONLAR sekmesi (5 çubuk + eğilim + son etki).

**Ölçüm**: 8×900 sn çöküşsüz (±%10); kanun→beklenen fraksiyon tepkisi; grev sayısı
kampanya başına 2-6 bandı.

---

## AŞAMA 3 — MAKROEKONOMİ (M)

İki gösterge + bir kaynak + bir endeks (taslaktaki 5-kaynaklı tam ağ bir kerede
kurulmaz — denge riski; kademeli):

- **Enflasyon (%0-30)**: kumanda ekonomisi + savaş harcaması + hazine açığı sürükler.
  Gelir çarpanı ↓, refah ↓, workers ↓.
- **Piyasa Güveni (0-100)**: istikrarla oynar (savaş/darbe/kamulaştırma ↓, barış ↑).
  ⭐gelir çarpanı; eşik altı → **sermaye kaçışı** olayı. business ile çift yönlü.
- **⚡ELEKTRONİK**: yüksek seviyeli şehir + teknoloji üretir; tier-3+ birim ve ileri
  teknoloji STOK ister; ambargo/kriz stoku keser → arenaya yansır (AŞAMA 5).
- **GIDA ENDEKSİ**: şehir/(ordu+nüfus vekili) oranı; eşik altı kıtlık: refah −,
  radicals +, haber. Kuraklık kara-kuğusuyla bağ.

Kelebek zinciri motor içinde: kuraklık → gıda ↓ → enflasyon ↑ → workers ↓ → grev →
üretim ↓ → elektronik ↓ → arenada tier-3 kilidi.

**Ölçüm**: krizsizken gelirler mevcut dengenin ±%15'inde; enjekte kriz 2 yılda
toparlanmalı; AI'nın enflasyona tepki kuralı test edilir.

---

## AŞAMA 4 — MEDYA & GAZETE (M; LLM'in yeni evi)

**Motor** (`js/News.js`): önemli olaylar yapılandırılmış haber kaydı üretir
`{arketip, taraflar, yer, tarih, gerçek_özet, önem}` (`storyLog` üstüne).

**Gazete paneli**: 3 kanal — Devlet Basını / Bağımsız Basın / Sosyal Ağ.
Devlet basınında **çarpıtma**: ⭐maliyet; başarı huzursuzluğu yumuşatır; bedel basın
güvenilirliği ↓ + intel ↓; güvenilirlik dibe vurursa çarpıtma ters teper (tablo).
Sansür kanunu bağımsız basını bastırır (press slotu ZATEN var). Sosyal ağ radicals'ı
hızlı oynatır. Çarpıtma etkinliği **arketiple** oynar (1C): Halkın Adamı işçiye,
Teknokrat piyasaya iyi satar.

**LLM**: haber başına manşet + 1 cümle; çarpıtılmışta "hükümet ağzı".
`llmParseHeadline`: tek satır, ≤14 kelime, Türkçe/Latin-dışı/EN süzgeçleri; tutmazsa
arketip şablonu. Öncelik: haber > özet > sohbet.

**Ölçüm**: kampanya başına 30-80 haber; çarpıtma A/B etkisi; LLM manşet
kullanılabilirlik ≥%80 (e2e deseni).

---

## AŞAMA 5 — MAKRO↔MİKRO SAVAŞ KÖPRÜSÜ (M)

**Makro→Arena** (`storyBattleModifiers(st)`): moral (meşruiyet + military.ap + refah →
panik/kaçma çarpanı, komutan profili terimi 1D'den); mühimmat (hazine krizi → deploy
kısıtı); elektronik ambargosu → tier-3 o savaşta kilitli (spawn bar'da gri + neden);
enerji krizi → zırhlı deploy maliyeti ↑.

**Arena→Makro** (`Telemetry.js` zaten topluyor): `{sonuç, kayıp%, sivil vekili, süre,
kilit olay}` → deterministik tablo: Pirus zaferi → workers/intel ↓ + matem haberi;
sivil hasar → dünya itibarı ↓ (mevcut `storyRel` dünya-çapı borusu) + ambargo riski;
temiz zafer → military ↑, güven ↑. LLM savaş haberini yazar (AŞAMA 4 hattı).

**Ölçüm**: aynı savaş × farklı makro durumlar jsdom'da — yön/büyüklük doğrulanır;
900 sn dünya dengesi korunur.

---

## AŞAMA 6 — ŞİRKETLER & OLİGARKLAR (L)

Devlet başına 2-3 aktör (`js/Corps.js`): `{ad, sektör(savunma|teknoloji|enerji|
perakende), ceo, align(-100..+100), lobi, kasa}`.

**Motor tiki**: align'a göre sanayi merkezine yatırım (`storyInvestCenter` ödeme
kaynağına eklenir); medya sahipliği (çarpıtma bonusu/cezası); düşmanken kriz
aksiyonları (fiyat artışı → refah ↓; sermaye kaçışı → güven ↓; rakibe fon).
**Oyuncu hamleleri**: Teşvik-ihale (align ↑, intel ↓, skandal riski) · Kamulaştırma
(kasa hazineye, güven ÇÖKER, workers ↑) · Şantaj (istihbarat teknolojisi ister;
başarısızsa skandal → meşruiyet ↓). CEO tavrı oyuncunun ARKETİPİNE tepki verir
(Oligark Dostu'na yanaşır, Halkın Adamı'ndan ürker). AI simetrisi tam.
**LLM**: CEO'lar Chatter havuzunda; tehdit/açıklama metinleri doğrulayıcı hattından.

**Ölçüm**: şirketli/şirketsiz kıyas — denge korunmalı; kamulaştırma zincirinin
(çöküş→kaçış→toparlanma) süresi ölçülür.

---

## AŞAMA 7 — HAFIZA + KARA KUĞU (M)

**3 kademe** (`STORY.memory`): `recent[]` son ~6 olay (motor) · `mid[]` 5 yılda bir
2 cümlelik dünya özeti (LLM açıksa `llmParseSummary`, yoksa şablon) · `legacy[]`
mihenk etiketleri (motor, silinmez; **karakter ekranının tohumları buraya doğar**,
arketip güncellemeleri buradan türer). Hepsi `llmSceneContext` üzerinden LLM'e girer.

**Kara kuğu**: yılda düşük olasılık zarı (motor); arketip tablosu (pandemi, borsa
çöküşü, kablo sabotajı, çip fabrikası yangını, kuraklık…); etkiler arketip başına
deterministik; LLM (a) 6 arketipten seçebilir (enum-doğrulamalı), (b) haber diliyle
anlatır. Acil konsey mevcut `storyCouncilCall` hattı.

**Ölçüm**: arketip enjeksiyon testleri; hafıza kayıt/yükleme; özet kullanılabilirliği.

---

## LLM SÖZLEŞMESİ (ortak)

| Kullanım | Doğrulayıcı | Yedek | Öncelik |
|---|---|---|---|
| Komutan/CEO diyaloğu | `llmParseDialog` (mevcut) | Chatter şablonları | düşük |
| Haber manşeti + özet | `llmParseHeadline` (yeni) | arketip şablonu | yüksek |
| Dünya özeti | `llmParseSummary` (yeni) | şablon özetleyici | orta |
| Arketip seçimi | `llmParsePick` (enum) | motor RNG | orta |

Hepsi `llmEnrich` (ateşle-unut), `maxInFlight=1`, bayat düşer, Latin-dışı+EN süzgeci
her yerde, **sayı/etki asla LLM'den gelmez**. Karakter profili/arketip/legacy her
prompta `llmSceneContext` ile girer — LLM oyuncuyu geçmişiyle tanır.

---

## SIRA, BÜYÜKLÜK, BAĞIMLILIK

| Aşama | Boy | Bağımlılık | Oynanır çıktı |
|---|---|---|---|
| 0 Modern tema | S | — | aynı oyun, modern ses |
| 1 Karakter + kişilik motoru | M-L | 0 | zar+soru ekranı; kişilikli dünya; isimli liderler |
| 2 Fraksiyonlar | M | 1 | kanunların canlı bedeli |
| 3 Makroekonomi | M | 2 | enflasyon/güven/⚡/gıda |
| 4 Medya | M | 2 | gazete + çarpıtma + LLM manşet |
| 5 Savaş köprüsü | M | 3 | makro durum arenada |
| 6 Şirketler | L | 2+3+4 | oligark siyaseti |
| 7 Hafıza + kara kuğu | M | 4 | her kampanya farklı tarih |

Her aşama kendi kıyaslamasıyla kapanır; denge bozan geri alınır.
