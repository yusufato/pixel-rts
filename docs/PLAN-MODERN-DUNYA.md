# MODERN DÜNYA PLANI — Siyaset, Ekonomi, Medya, Şirketler, Hafıza

Kullanıcının 5 aşamalı mimari taslağının (siyasi spektrum, fraksiyonlar, makroekonomi,
medya/dezenformasyon, şirketler/oligarklar, kademeli hafıza, kara kuğu) mevcut kod
tabanına eşlenmiş, ölçülebilir uygulama planı. **Karar: kampanya modern/yakın-gelecek
çağa taşınır** (kullanıcı seçimi).

---

## 0. TAŞIYICI İLKELER (ölçümden gelen, pazarlıksız)

Bu oturumların ölçümleri üç kural dayatıyor. Taslaktaki her fikir bu üç süzgeçten
geçirilerek uyarlandı:

1. **Sayıları MOTOR hesaplar, LLM yalnız METİN yazar.**
   Taslak "LLM JSON dönsün, `working_class:+15` uygulansın" diyor. Ölçüm: 8B model
   "tam 2 satır yaz" kuralına bile uyamıyor (Türkçe-Llama her çıktıya iskele ekliyor,
   prompt'la kırılamadı — gram_bench). Şemalı JSON + dengeli sayı beklemek gerçekçi
   değil; *geçerli ama saçma* sayılar dengeyi sessizce çökertir ve hiçbir test yakalamaz
   (konsey sisteminin ilk hâli devletleri nasıl çökerttiyse). Kelebek etkisi zinciri
   deterministik kural motorudur; LLM o zinciri **anlatır**, kurmaz.
   LLM'in "seçim yapması" gereken yerde serbest üretim değil **çoktan seçmeli** verilir
   (arketip listesinden tek kelime; enum'a karşı doğrulanır).

2. **Oyun LLM'siz de TAM oynanır.** Yapay anlatıcı varsayılan kapalı, tarayıcıda hiç
   yok, CPU'da üretim ~45 sn. Simülasyon motorda yaşar; LLM açıksa dünyaya ses verir.
   Her LLM çıktısı doğrulayıcıdan geçer (llmParseDialog deseni), tutmayan şablona düşer.

3. **Her aşama tek başına oynanabilir + jsdom tezgâhıyla ölçülür.** Denge değişikliği
   çoklu-kampanya kıyaslamasız işlenmez (8 devlet × 900 sn deseni).

---

## 1. ENVANTER — taslak kavramı → mevcut sistem

| Taslaktaki kavram | Mevcut karşılığı | Durum |
|---|---|---|
| İdeolojik eksenler / kanunlar | `LAW_SLOTS` (8 slot, 23 seçenek) + anayasa (5 form) | VAR — fraksiyon tepkisi eklenecek |
| Dünya havası / dönemler | `Era.js` (5 metrik → 6 çağ, histerezis) | VAR — aynen kullanılır |
| Halk desteği | `st.welfare`, komutan `loyalty` | VAR — fraksiyonlara ayrıştırılacak |
| Fraksiyon onayı | — | YOK → AŞAMA 2 |
| Enflasyon, piyasa güveni | — | YOK → AŞAMA 3 |
| Stratejik kaynaklar | ⛽oil, ⭐pts, 👥man (düğüm bazlı gelir) | KISMEN → Elektronik + gıda endeksi eklenecek |
| Tedarik zinciri → üretim | `Production.js` (fac/bar, kuyruk, sanayi merkezleri) | VAR — kaynak kapıları eklenecek |
| Medya / haber akışı | `storyLog` (ham günlük) | ÇEKİRDEK VAR → gazete sistemi AŞAMA 4 |
| Diplomasi / krizler | `Talks.js` (17 şablon, TREATIES, storyRel) | VAR — modern arketipler eklenecek |
| Komutan sohbeti + LLM | `Chatter.js` + `LLM.js` (doğrulayıcı, şablon yedek) | VAR — desen yeni üreticilere kopyalanır |
| Şirketler / oligarklar | `storyIndustrialCenters` (embriyo) | YOK → AŞAMA 6 |
| Savaş → dünya geri beslemesi | `Telemetry.js` (maç metrikleri zaten toplanıyor!) | ÇEKİRDEK VAR → AŞAMA 5 |
| Kademeli hafıza | `STORY.log`, `_chatter` (ham) | KISMEN → AŞAMA 7 |
| Kara kuğu | `COUNCIL_MOTIONS` acil oturum altyapısı | ALTYAPI VAR → AŞAMA 7 |
| Karakter arketipi (Halkın Adamı…) | `CommanderTree.js` (HARP/İDARE/SİYASET dalları) | KISMEN — etiket sistemi eklenecek |

Sonuç: taslağın ~yarısı embriyo hâlinde kurulu. Sıfırdan inşa değil, katmanlama.

---

## AŞAMA 0 — MODERN ÇAĞ GEÇİŞİ (küçük, önce bu)

Envanter taraması: dönem izi sanılandan az. Çağ adları (KAOS ÇAĞI, SOĞUK DENGE…),
devlet adları (Slav Federasyonu, Cermen Birliği — kurgusal bloklar), rütbeler
(Tümgeneral, Mareşal) ve birimler (tank, mekanize, tanksavar) modern-uyumlu.

Değişecekler (yalnız metin/tema — **hiçbir effect/denge değeri değişmez**):

- `STORY_START_YEAR 1904 → 2032` (kurgusal yakın gelecek: gerçek-dünya siyasetine
  çakışmaz, dron/elektronik teması meşrulaşır). Takvim mekaniği aynı (1 yıl = 120 sn).
- `STORY_CMD_TITLES ['Bey','Paşa','Komutan','Ağa'] → ['General','Komutan','Paşa']`
  ("Paşa" modern TSK ağzında yaşıyor; "Ağa/Bey" düşer).
- LLM promptları: "1900'lerin başında" → "yakın gelecekte"; few-shot örnekler modern
  ağza yeniden yazılır (Kemal Paşa/cephane → General/İHA-mühimmat tonunda).
- Teknoloji ağacı AD güncellemeleri (effect aynı): Palet→Aktif Süspansiyon,
  Eğimli Zırh→Kompozit Zırh, Yıldırım Harbi→Ağ Merkezli Harekât, Şarapnel→Misket
  Mühimmatı, Roketatar→ÇNRA, Demiryolu Ağı→Lojistik Koridorları, Siper Kazısı→Mevzi
  Tahkimatı, Aristokrat Subaylık→Kurmay Kastı, Toprak Düzeni→Tarım Politikası,
  Halk Mektepleri→Devlet Okulları… (uygulamada tam liste).
- `Chatter.js`/`Talks.js`/`StoryRender.js` dönem kokan ~22 satır (kışla, telgraf vb.)
  modern eşdeğerine çevrilir.
- Kaynak yeniden adlandırma (görsel): ⛽ petrol → **ENERJİ** (mekanik aynı).

Doğrulama: 12 jsdom takımı + dönem-terimi grep taraması temiz + SMOKE_OK.

---

## AŞAMA 1 — FRAKSİYON KATMANI (temel; taslağın 1-B'si)

**Veri modeli** (`js/Factions.js`, yeni):
```js
st.factions = {
  workers:   { ap: 55 },   // İşçiler & Sendikalar
  business:  { ap: 55 },   // Sermaye & Şirketler
  military:  { ap: 55 },   // Ordu & Emniyet
  intel:     { ap: 55 },   // Aydınlar & Basın
  radicals:  { ap: 30 },   // Militan Gruplar (taban düşük; kriz yükseltir)
}
```
`storySave` içinde `states` zaten serileşiyor → kalıcılık bedava; eski kayıt için
`storyFactionBackfill` (mevcut backfill deseni).

**Girdiler** (hepsi mevcut olaylardan; deterministik):
- Kanun/anayasa seçimlerine `fac:` deltaları eklenir (LAW_SLOTS 23 seçenek + 5 form).
  Örn. Ağır Vergi: business −8 workers −5; Sıkı Sansür: intel −10 military +6.
- Savaş durumu: uzun savaş → workers/intel ↓, military ↑; yenilgi → hepsi ↓, radicals ↑.
- Refah değişimi: workers refahı izler; radicals ters izler (kriz radikalleştirir).
- Vergi/ekonomi tikleri, fetih, darbe/firar olayları (StorySocial kancaları).

**Etkiler** (mevcut kanallara bağlanır — yeni paralel sistem icat edilmez):
- Ağırlıklı ortalama → `unrest` endeksi → refah/sadakat erimesine çarpan
  (mevcut `loyaltyHold` boru hattı).
- Konseyde komutan oyları fraksiyon baskısından etkilenir
  (`storyCouncilVoteScore`'a terim: komutan tipi ↔ fraksiyon eşlemesi).
- `radicals.ap` yüksek + refah düşük → **grev/protesto olayı**: N saniye üretim
  cezası + haber kaydı; darbe riski (mevcut darbe sistemi) military.ap'den beslenir.
- AI simetrisi: `storyCouncilContext`'e fraksiyon dengesi girer — AI yönetici de
  fraksiyon yatıştırmayı öğrenir (oyuncuyla aynı kural).

**UI**: Konsey çekmecesine "FRAKSİYONLAR" sekmesi (5 çubuk + eğilim oku + son etki).

**Ölçüm**: 8 devlet × 900 sn — çöküş yok (şehir/refah mevcut denge ±%10);
kanun değişimi → beklenen fraksiyonun tepki verdiği; grev sayısı/kampanya 2-6 bandında.

---

## AŞAMA 2 — MAKROEKONOMİ (taslağın 2'si; yalın tutulmuş)

Devlet başına iki gösterge + bir yeni kaynak + bir endeks. (Taslaktaki 5-kaynaklı tam
ağ bir kerede kurulmaz — denge riski; kademeli.)

- **Enflasyon (%0-30)**: sürükleyenler = kumanda ekonomisi + savaş harcaması + hazine
  açığı. Etki: gelir çarpanı ↓, refah ↓, workers.ap ↓. Görünür: panel + haber.
- **Piyasa Güveni (0-100)**: sürükleyenler = istikrar (savaş/darbe/kamulaştırma ↓,
  barış/zafer ↑). Etki: ⭐gelir çarpanı; eşik altında **sermaye kaçışı olayı**
  (tek seferlik hazine kaybı + haber). business.ap ile çift yönlü bağ.
- **⚡ELEKTRONİK** (yeni kaynak, tek eklenen): yüksek seviyeli şehir + teknoloji
  üretir; tier-3+ birimler ve ileri teknolojiler elektronik STOK ister. Ambargo/kriz
  → stok kesilir → arenaya yansır (AŞAMA 5). Ekran: mevcut kaynak şeridine 4. kalem.
- **GIDA ENDEKSİ** (kaynak değil, oran): şehir sayısı / (ordu + nüfus vekili).
  Eşik altı → kıtlık olayı: refah −, radicals +, haber. Kuraklık kara-kuğusuyla bağ.

Kelebek zinciri artık gerçek ve **motor içinde**: kuraklık → gıda ↓ → enflasyon ↑ →
workers ↓ → grev → üretim ↓ → elektronik stok ↓ → arenada tier-3 kilidi.

**Ölçüm**: ekonomi tezgâhı — kriz yokken gelirler mevcut dengenin ±%15'inde kalmalı;
kriz senaryosu enjekte edilip 2 yıl içinde toparlanma ölçülür; AI devletler
enflasyonda batmamalı (özellikle: AI'nın enflasyona TEPKİ kuralı test edilir).

---

## AŞAMA 3 — MEDYA & GAZETE (taslağın 4-1'i; LLM'in yeni evi)

**Motor tarafı** (`js/News.js`): önemli olaylar (savaş ilanı, şehir düşmesi, kanun,
grev, darbe, antlaşma, kriz) yapılandırılmış **haber kaydı** üretir:
`{ arketip, taraflar, yer, tarih, gerçek_özet, önem }`. `storyLog`'un üstüne kurulur.

**Gazete paneli**: 3 kanal — Devlet Basını / Bağımsız Basın / Sosyal Ağ.
- Devlet basını oyuncunun **çarpıtma (spin)** aksiyonunu sunar: ⭐maliyet;
  başarı → huzursuzluk etkisi yumuşar; bedel → basın güvenilirlik puanı ↓, intel.ap ↓;
  güvenilirlik dibe vurursa çarpıtmalar ters teper (deterministik tablo).
- Bağımsız basın gerçeği yazar; sansür kanunu onu bastırır ama intel/radicals bedeli
  mevcut kanun sisteminden gelir (zaten var: press slotu!).
- Sosyal ağ: hızlı, kısa, çalkantı çarpanı — radicals.ap'yi diğerlerinden hızlı oynatır.

**LLM rolü** (açıksa): her haber kaydı için **manşet + 1 cümle** yazar; çarpıtılmış
sürümde "hükümet ağzı" tonunda yazar. Doğrulayıcı: `llmParseHeadline` — tek satır,
≤14 kelime, Türkçe, Latin-dışı/EN kaçak süzgeci; tutmazsa arketip şablonundan basılır.
Kuyruk önceliği: haber > özet > sohbet (`LLM.maxInFlight=1` korunur, bayat istek düşer).

**Ölçüm**: haber üretim oranı (kampanya başına 30-80 kayıt bandı), çarpıtmanın refah
etkisi A/B ölçümü, LLM açıkken manşet kullanılabilirlik ≥%80 (e2e deseniyle).

---

## AŞAMA 4 — MAKRO↔MİKRO SAVAŞ KÖPRÜSÜ (taslağın 3'ü)

**Makro → Arena** (`storyBattleModifiers(st)` — savaş girişinde tek nesne):
- Moral: meşruiyet + military.ap + refahtan → panik direnci / kaçma eşiği çarpanı
  (mevcut morale/suppression kancaları).
- Mühimmat: enflasyon/hazine krizi → deploy bütçesi kısıtı (mevcut `DEPLOY_RES` yolu).
- Elektronik ambargosu → tier-3 birimler o savaşta KİLİTLİ (spawn bar'da gri + neden).
- Enerji krizi → zırhlı sınıf deploy maliyeti ↑ (mevcut oilCost kancası).

**Arena → Makro** (savaş sonu; `Telemetry.js` zaten topluyor):
`{ sonuç, kayıp_oranı, sivil_hasar_vekili, süre, kilit_olay }` → deterministik tablo:
- Pirus zaferi (kayıp >%50): workers/intel ↓, "matem" haberi; karizma yerine mevcut
  rütbe/LP sistemine ceza-ödül.
- Sivil hasar: dünya itibarı ↓ (mevcut `storyRel` dünya-çapı mekanizması — ihanet
  cezasıyla aynı boru), ambargo olayı tetiklenebilir (elektronik stok kilidi).
- Zafer + düşük kayıp: military.ap ↑, piyasa güveni ↑.
LLM: savaş sonucu haberini yazar (AŞAMA 3 hattından).

**Ölçüm**: aynı savaş, farklı makro durumlarla jsdom'da koşulur — modifikatörlerin
yön ve büyüklüğü doğrulanır; dünya dengesi 900 sn testinde bozulmamalı.

---

## AŞAMA 5 — ŞİRKETLER & OLİGARKLAR (taslağın 5'i)

Devlet başına 2-3 **şirket aktörü** (`js/Corps.js`):
`{ ad, sektör(savunma|teknoloji|enerji|perakende), ceo_adı, align(-100..+100), lobi(0-100), kasa }`

- **Motor davranışı** (10 sn tiki): align'a göre yatırım (sanayi merkezlerine —
  mevcut `storyInvestCenter` ödeme kaynağına eklenir), medya etkisi (sahip olduğu
  kanal çarpıtma bonusu/cezası), kriz aksiyonları (düşmanken: fiyat artışı → refah ↓;
  sermaye kaçışı → piyasa güveni ↓; rakibe fon → ordu havuzuna sızıntı).
- **Oyuncu hamleleri** (konsey/panel): Teşvik-ihale (align ↑, yolsuzluk izi → intel ↓,
  skandal riski), Kamulaştırma (kasa hazineye, piyasa güveni ÇÖKER, workers ↑),
  Şantaj (istihbarat teknolojisi ister; başarısızsa skandal olayı → meşruiyet ↓).
- **AI simetrisi**: AI devletlerde aynı tik; align devlet politikalarına tepkiyle kayar.
- **LLM**: CEO'lar Chatter havuzuna girer (komutan-CEO diyalogları, tehdit mektupları,
  basın açıklamaları) — hepsi mevcut doğrulayıcı hattından.

**Ölçüm**: şirketli/şirketsiz kampanya kıyası — dünya dengesi korunmalı; kamulaştırma
zincirinin (güven çöküşü → kaçış → toparlanma) süresi ölçülür.

---

## AŞAMA 6 — HAFIZA + KARA KUĞU + KARAKTER ETİKETLERİ (taslağın 1-4 + 2-4'ü)

**3 kademeli hafıza** (`STORY.memory`):
- `recent[]`: son ~6 önemli olayın ham kaydı (motor yazar).
- `mid[]`: her 5 yılda 2 cümlelik dünya özeti — LLM açıksa yazar
  (`llmParseSummary`: ≤2 cümle, Türkçe süzgeçleri; yoksa şablon özetleyici).
- `legacy[]`: mihenk etiketleri — "darbeyi bastırdı", "X'i kamulaştırdı",
  "pirus zaferi-1936" (motor yazar, silinmez). Komutan ağacının SİYASET dalı ve
  karakter arketipi (Halkın Adamı / Teknokrat / Demir Yumruk / Oligark Dostu)
  bu etiketlerden türetilir; LLM promptlarına `llmSceneContext` üzerinden girer.

**Kara kuğu motoru**: yıl başına düşük olasılık zarı (motor). Gelirse arketip
TABLOSUNDAN seçim: pandemi, borsa çöküşü, denizaltı kablo sabotajı, çip fabrikası
yangını, kuraklık… Etkiler arketip başına deterministik. LLM rolü: (a) 6 arketipten
birini seçebilir (enum-doğrulamalı tek kelime), (b) olayı haber diliyle anlatır.
Acil konsey mevcut `storyCouncilCall` hattıyla toplanır.

**Ölçüm**: kara kuğu enjeksiyon testi (her arketip → beklenen etki zinciri);
hafıza kayıt/yükleme; LLM özet kullanılabilirliği.

---

## LLM SÖZLEŞMESİ (tüm aşamalar için ortak)

| Kullanım | Doğrulayıcı | Yedek | Öncelik |
|---|---|---|---|
| Komutan/CEO diyaloğu | `llmParseDialog` (mevcut) | Chatter şablonları | düşük |
| Haber manşeti + özet | `llmParseHeadline` (yeni) | arketip şablonu | yüksek |
| Dünya özeti (hafıza) | `llmParseSummary` (yeni) | şablon özetleyici | orta |
| Arketip seçimi | `llmParsePick` (enum) | motor RNG | orta |

Kurallar: hepsi `llmEnrich` üzerinden (ateşle-unut), `maxInFlight=1`, bayat istek
düşer, her doğrulayıcıda Latin-dışı + EN-kaçak süzgeci, sayı/etki ASLA LLM'den gelmez.

---

## SIRA, BÜYÜKLÜK, BAĞIMLILIK

| Aşama | Büyüklük | Bağımlı olduğu | Oynanır çıktı |
|---|---|---|---|
| 0 Modern tema | S (1 oturum) | — | aynı oyun, modern ses |
| 1 Fraksiyonlar | M | 0 | konsey/kanunların canlı bedeli |
| 2 Makroekonomi | M | 1 | enflasyon/güven/elektronik/gıda |
| 3 Medya | M | 1 | gazete + çarpıtma + LLM manşet |
| 4 Savaş köprüsü | M | 2 | makro durum arenada hissedilir |
| 5 Şirketler | L | 1+2+3 | oligark siyaseti |
| 6 Hafıza+kara kuğu | M | 3 | her kampanya farklı tarih yazar |

Her aşama kendi kıyaslama ölçümüyle kapanır; denge bozan değişiklik geri alınır
(bu oturumlarda üç kez yapıldığı gibi).
