# Savaş AI — v6: Hafızalı Operasyon-Değerlendirici + Karşı-Olgusal Eğitim + Lig Self-Play + LLM Koç (döngü dışı)

> Bu sürüm, v4 taslağına yapılan detaylı teknik review'un **tamamını** benimser. v4'ün asıl
> zaafı: ortada gerçek öğrenen model yoktu (LLM-destekli manuel geliştirme), LLM istatistik
> motoru gibi kullanılmıştı, self-play/ödül/kabul tanımsızdı. Bunlar düzeltildi.
>
> **İki referans birlikte kullanılır:** bu doküman = doğru LLM sınırları + mimari çerçeve.
> `../design/SAVAS_AI_TASARIM_PLANI.md` §11 (öğrenme), §12 (telemetri/replay), fitness bileşenleri,
> şampiyon arşivi, aşırı-uyum testleri = gerçek-öğrenme ayrıntı referansı. İkisi çelişmez;
> eskisi SİLİNMEZ, bu doküman onun üstüne LLM sınırlarını ve karşı-olgusal yöntemi koyar.

---

## 0. Amaç ve çıkmazdan çıkış

- Amaç: insanı gerçekten zorlayan savaş AI'si. İnsan az emirle eziyor → sorun işlem gücü değil **yargı**.
- Çıkmaz: 3 kez motor sıfırlandı, hep altyapıya takıldık. **4. sıfırlama YOK.** Mevcut `js/Battle*.js`
  motorunun **yalnız plan-puanlama katmanı** öğrenilmiş modelle değişir; algı/planner/executor kod kalır.

---

## 1. İki-hat mimari (net sınır)

**HAT A — Gerçek zamanlı (motor içi, hızlı, deterministik) — ÜÇ KATMAN:**
```
Savaş motoru
  → Yasal gözlem/algı (sadece AI'nın hile-siz bildiği)
  → Sektör-durum + açık yapılandırılmış hafıza (§2.1, §2.5)
  ┌─────────────────────────────────────────────────────────┐
  │ KATMAN 1  KOMUTAN BEYNİ  ← ÖĞRENEN (hafızalı, özyinelemeli)│  niyet · operasyon · rakip-okuma · hafıza
  │ KATMAN 2  OPERASYON PLANLAYICI                           │  görev grupları · fazlar · tetikleyiciler · yedek
  │ KATMAN 3  TAKTİK İCRA  ← MEVCUT HIZLI KOD                │  hareket · hedef · menzil · formasyon · yol bulma
  └─────────────────────────────────────────────────────────┘
  → Karar + operasyon + sonuç telemetrisi
```
**Asıl öğrenen kısım Katman 1'dir** (statik plan-skorlayıcı DEĞİL — hafızalı komutan, §2). Katman 2
niyeti uygulanabilir operasyona çevirir. Katman 3 = mevcut kod (koordinat/mikro burada). Bu üçlü,
"küçük statik plan-puanlayıcı gerekli ama YETERLİ DEĞİL" tespitinin cevabıdır.

**HAT B — Çevrimdışı (LLM koç, döngü DIŞINDA):**
```
Ham maçlar
  → KOD-tabanlı istatistik + karar analizi (doğruluğun kaynağı burası)
  → küçük yapılandırılmış özet (aşağıda §6)
  → 8B LLM koç
  → JSON hipotez/deney önerisi (kod DEĞİL)
  → otomatik A/B deney çalıştırıcı
  → İSTATİSTİKSEL kabul/ret (LLM'den bağımsız)
```
LLM analitik doğruluğun kaynağı DEĞİL; öğretmen/yorumcu. Sayısal karşılaştırmayı KOD yapar.

---

## 2. Öğrenen komutan modeli (hafızalı — statik skorlayıcı DEĞİL)

### 2.0 ÇELİŞKİYİ ÇÖZ — model ÜRETMEZ, SIRALAR (bu, tüm mimarinin belkemiği)
Önceki taslakta model üç farklı iş yapıyormuş gibi yazılmıştı (plan-skorla / grup-oranı-üret / faz-dizisi
üret / DSL-üret). Bunlar farklı problemler; belirsiz kalırsa mimari kodlanırken yeniden tartışılır. **Karar:**
- **KOD-tabanlı taktik gramer** durumdan **16–64 GEÇERLİ operasyon ADAYI** üretir (her aday = tam operasyon
  sözleşmesi: intent+fazlar+oranlar+tetikleyici+abort; §2.2'deki JSON = bir ADAYIN şeması).
- **Hafızalı model** girdi olarak `durum(sektör) + açık hafıza + rakip profili + BİR aday operasyon` alır ve
  o adaya **tek beklenen değer** verir. Model **serbest JSON ÜRETMEZ**; adayları **SIRALAR** (satranç motorunun
  yasal hamleleri değerlendirmesi gibi).
- Kazançlar: karmaşık taktik seçilebilir · geçersiz JSON imkânsız · mevcut planner/executor korunur ·
  karşı-olgusal rollout doğrudan eğitim etiketi verir · açıklanabilir · eylem uzayı patlamaz.
- Bu, "plan puanlama" (§1) ile "karmaşık operasyon" (§2.2) hedeflerini uzlaştırır: **model, kodun ürettiği
  zengin operasyon adaylarını puanlar.**

### 2.1 Durum temsili = SEKTÖRLER (ham koordinat DEĞİL)
Model yüzlerce birim koordinatını anlamaya çalışmaz; **askeri durum** görür. Harita **8×6 sektör**
(ya da erişilebilirlik grafiği). Sektör başına: dost gücü · tahmini düşman gücü · piyade/zırhlı/
tanksavar/topçu **yoğunlukları** · arazi · geçit/köprü/engel · görüş güveni · son temas zamanı ·
ateş üstünlüğü · **açık kanat riski** · hedefe stratejik uzaklık. Sisin altı kesin bilgi ASLA girmez.

### 2.2 Çıktı = OPERASYON (tek atımlık plan seçimi DEĞİL)
Yalnız `ATTACK`/`HOLD` seçmek insan gibi görünmez. **Bir aday operasyon** = zamana yayılan sözleşme:
niyet + hipotez + ana-çaba sektörü + grup oranları + **fazlar (until-tetikleyicileriyle)** + **abort koşulları**.
Kod-gramer bunlardan 16–64 geçerli aday üretir; **model her adayı puanlar (§2.0)**.
```json
{ "intent": "FIX_AND_FLANK", "hypothesis": "Oyuncu sağ kanadını erken terk ediyor",
  "mainEffort": "RIGHT_APPROACH",
  "groups": { "fixing": 0.25, "flank": 0.45, "support": 0.20, "reserve": 0.10 },
  "phases": [ {"name":"PROBE","until":"enemy_reserve_revealed OR 8s"},
              {"name":"FIX","until":"enemy_center_committed"},
              {"name":"FLANK","until":"rear_access OR flank_failed"},
              {"name":"EXPLOIT","until":"objective_taken OR force_ratio<0.75"} ],
  "abort": ["flank_group_losses>35%","enemy_counterattack_on_main_objective"] }
```
Bu, insan komutanın çekirdeğini verir: **niyet oluştur → birkaç saniye bağlı kal → beklediği koşulları
izle → başarısızsa NEDENİNİ anlayarak değiştir.** Koordinat/mikro üretmez; Katman 2/3 (kod) uygular.

### 2.3 Model = HAFIZALI (özyinelemeli) — İLK SÜRÜM KESİN SEÇİM
**VERİ AKIŞI (kritik — GRU her aday için ayrı ÇALIŞMAZ):**
```
2 Hz gözlem akışı → Observation Encoder → GRU-128 → TEK komutan gizli durumu h(t)
h(t) + açık hafıza + rakip profili
        └→ her aday için: Candidate Encoder → Scoring MLP → {değer, terminal değer, risk}
```
GRU **0.5 sn'de bir defa** güncellenir; operasyon adayları GRU'yu DEĞİŞTİRMEZ, yalnız mevcut `h(t)`
üzerinden puanlanır (aksi halde: aynı gözlem 64× işlenir, adaylar farklı gizli durum yaratır, seçilmeyen
adaylar hafızayı kirletir, eğitim↔canlı ayrışır). **Seçilen** operasyon sonra açık plan hafızasına (§2.5) yazılır.
- **İlk sürüm = GRU** (LSTM/transformer/recurrent-PPO SONRAYA). Gizli durum **128**. Gözlem güncellemesi
  **saniyede 2**. Operasyon kararı: **tetikleyici oluşunca ya da en erken 3–5 sn**. Gizli durum maç başında
  **sıfırlanır**; açık hafıza (§2.5) ayrıca girişe verilir.
- Çıkarım hedefi **<1 ms** — *ölçülmeden gerçek sayılmaz* (Faz 0 benchmark).
- **Özellik sözleşmesi tek sürümlü:** `stateFeatures.v1` (sayı sabitlenip belgelenir; "60-100/100-200"
  belirsizliği kapatılır). Ağırlıklar oyuna **binary** gömülür + küçük JS inference (ağır ML runtime YOK).
  Model **sürüm+hash'i replay'e yazılır**.

### 2.4 Rakibi OKU = Bayesçi hipotez (AI oyuncuyu düşünür)
AI oyuncu hakkında hipotez tutar ve kanıtla günceller:
`H1 sol-kanat %40 · H2 merkez %35 · H3 topçu %25` → *sol kanatta 3 mekanize görülür* → `H1 %72 · H2 %18 · H3 %10`.
Planını bu inanca göre seçer; yanlış tahmin riskinde **yedek bırakır** (tamamen dağılmaz). Ayrıca oyuncu
alışkanlığı profili (kanat/zırhlı-önce/topçu-koruması/yedek-erken/feint-takip/koridor-tekrarı) girdiye eklenir.
Sonuç: AI ezber senaryo değil, oyuncuyu okur ve **tekrar eden davranışı maç içinde cezalandırır.**

### 2.5 Açık, yapılandırılmış maç hafızası (modelin gizli durumuna TAM güvenme)
Dört tür, küçük ve okunur:
- **Düşman hafızası:** son görülen birlikler+güven, ana kuvvet hangi tarafta, yedek görüldü mü, topçu en son nerede, muhtemel hasarlılar, tekrar kullanılan koridorlar.
- **Davranış hafızası:** temastan sonra yığılıyor mu, kanat tehdidine cevabı, geri çekileni takip ediyor mu, AT keşfi yapmadan zırhlı gönderiyor mu, yedeği erken mi, topçuyu koruyor mu.
- **Kendi plan hafızası:** ne deniyorum, neden seçtim, hangi varsayım, doğrulandı mı, hangi faz, kabul ettiğim kayıp, hangi koşulda bırakırım.
- **Sonuç hafızası:** yoklama ne gösterdi, feint çekti mi, önceki saldırı neden başarısız, hangi hedefe ateş yoğunlaştırmak işe yaradı.

### 2.6 Taktik GRAMER (7 sabit plana hapsetme; serbest emir de verme)
Model, birleştirilebilir yapı taşlarını duruma göre dizer: yokla · sabitle · yığ · kanadı reddet · yan geç ·
geri çekil · yem bırak · pusu kur · ateş yoğunlaştır · yedeği tut · yedeği kullan · hedef değiştir · takibi
sınırla · iki-eksenli saldır · topçu avla. Örn. *yokla → düşman yedeğini çek → merkezi sabitle → sağa yığ →
topçuyu bastır → kanattan saldır.* **Yapı taşlarını KOD grameri fazlar hâlinde dizerek adayları üretir;
MODEL adayları seçer** (§2.0). Önceden yazılmış tek "karmaşık taktik" yok; kombinasyonlar duruma göre çıkar.

### 2.7 Karmaşıklık AMAÇ değil, SONUÇTUR
Modeli "karmaşık ol" diye ödüllendirmek yanlış (ritüel-bot üretir). Karmaşa **problemi çözmenin sonucu**
olmalı: basit saldırı düşük değer alır → model düşman yedeğini bağlaması gerektiğini öğrenir → küçük kuvvetle
yoklar → tepkiyi hafızaya yazar → ana kuvveti başka sektöre taşır → uygun anda saldırır. **Düşman merkezi zaten
çökmüşse en iyi karar: bütün ateşi merkeze yığ ve bitir.** Her durumda kanat deneyen AI zeki değil, bottur.

---

## 2A. Kuvvet yoğunlaştırma — TEMEL yetenek (model gelmeden de güçlendirir)
İnsanların AI'yı ezmesinin ana nedeni genelde daha iyi mikro değil, **yerel üstünlük**. AI sürekli
`yerel güç oranı = dost etkili güç / tahmini düşman etkili güç` hesaplar; global 1.0 olsa bile **tek
sektörde 1.6–2.0** kurmaya çalışır. Bunun için 5 davranış:
1. Her birim BAĞIMSIZ hedef seçmez. 2. Görev grupları ortak hedef penceresi kullanır.
3. Ana kuvvet aynı anda menzile girer. 4. Sabitleme grubu erken ölmez.
5. Kanat grubu, ana grup temas kurmadan saldırmaz; yedek ilk çatışmada otomatik tüketilmez.
Bu beşi düzgün çalışırsa AI "zeki görünmeden önce bile" ciddi güçlenir.

## 2B. Geri çekilme = ARAÇ (yenilgi değil)
Kötü AI ya sürekli saldırıp ölür ya sürekli toparlanıp hiçbir şey yapmaz. Her REGROUP/DISENGAGE'in
**tanımlı amacı** olmalı: ateş menzilinden çıkmak · düşmanı tanksavar hattına çekmek · açık kanadı
kapatmak · iki grubu birleştirmek · topçu ateş penceresi açmak · yeni yerel üstünlük kurmak.
Bir geri çekilme planı **10–15 sn** içinde bunlardan birini gerçekleştiremezse **iptal edilir**.

---

## 3. Eğitim yöntemi: KARŞI-OLGUSAL plan rollout (review'un "en güçlü yöntem"i)

PPO ile başlamıyoruz. Deterministik motorun gerçek avantajını kullanıyoruz:

1. Bir karar anındaki durumu **dondur** (tam sim durumu).
2. Her **geçerli plan adayından** ayrı simülasyon dalı başlat.
3. Her planı, **birkaç rakip politikası + gizli-durum varyasyonuyla** 20–40 sn çalıştır.
4. Sonucu **çok bileşenli ödül vektörüyle** (§4) ölç → planların gerçek sıralaması.
5. Küçük modeli bu **plan sıralamasını tahmin edecek** şekilde eğit (öğretmen = simülasyonun
   karşı-olgusal sonucu, LLM'in görüşü DEĞİL).
6. Model yalnız plan-puanlama katmanının yerine geçer.

Bu, credit-assignment sorununu (review #3) doğrudan çözer: değeri "sonraki 5-10 sn" tahmininden
değil, **o planın gerçekten dallandırılmış sonucundan** öğrenir.

---

## 3A. ORACLE TAVAN TESTİ — eğitimden ÖNCE GO/NO-GO (4. başarısızlığa karşı en güçlü sigorta)

Model yalnız **kodun ürettiği** adaylardan birini seçebilir. Gramer kötü aday üretiyorsa dünyanın en iyi
modeli bile başarısız olur. Bu yüzden **model eğitmeden** tavanı ölçeriz:
1. Her karar durumunda **bütün adayları rollout** ile değerlendir.
2. Gerçekte en iyi sonucu veren adayı seçen **kusursuz `OracleSelector`** kur.
3. Oracle'ı **mevcut kod AI'a karşı** çalıştır.
4. **NO-GO:** Oracle belirgin gelişim sağlayamıyorsa **ML eğitimine BAŞLANMAZ** — sorun modelde değil,
   **taktik gramerinde veya rollout değerlendirmesinde**. Önce onlar düzeltilir.

Bu üç şeyi ayırır: gramer yeterli mi · rollout sonuçları anlamlı mı · model sıralamayı öğrenebiliyor mu.
Ana metrik (kazanma oranı yetmez): **`regret = oracle_op_değeri − model_seçtiği_op_değeri`** — modelin
oracle'a göre **ortalama regret'i** raporlanır. Oracle testi **hiç eğitim kodu yazmadan** çalışmalı (Faz 1 kapısı).

### ✅ UYGULANDI + İLK SONUÇ (`js/BattleOracle.js`, `electron --oracletest`)
- **Enjeksiyon:** `operationalPlanner.build` sarmalayıcısı — gramer-adayının `intent`(→BATTLE_PLAN_KIND) +
  `mainSector`(→objective) + `allocation`(→grup bölme) değerlerini icra planına çevirir; mevcut
  `taskContractPlanner`'ı yeniden kullanır. Fork restore metodu korur (yalnız data restore).
- **Rollout+ödül:** `battleForkCapture/Restore` → aday enjekte → 15-20sn koş → çok-bileşenli ödül
  (`rewardWeights.v1`: takas farkı + kalan üstünlük + terminal).
- **İki metrik:** işaretli `regret = en_iyi_aday − chosen`; **tavan** `regretCeiling = max(0, regret)`
  (mükemmel seçici "sürdür"meyi de seçebilir → mid-icra momentum artifaktını temizler). Yalnız
  **çarpışma olan** (aktif) karar noktaları sayılır.
- **Sadakat (tamamlandı):** `intent`+`objective`+`allocation`+`flankSector`(→FLANK destination)+`tempo`
  (→pursuit ölçeği) artık icra ediliyor. `phases` executor'ın sabit kind-makinesine bağlı (invaziv → ertelendi).
- **Tekrarlanabilirlik (tamamlandı):** her (seed,karar-noktası) için TAZE izole maç + varsayılan-önce rollout
  → iki koşu BİREBİR özdeş (eval'in fork-artığı ana zaman çizgisini kirletmiyor).
- **Kesin ölçüm (3 seed × temas-bölgesi 3 nokta, red=attacker, 7 aktif nokta):** tavan regret ort **≈60**,
  **5/7 noktada** varsayılanı anlamlı yenme → **GO**. Headroom **temas** kararlarında tutarlı (tick~750: 3/3
  seed'de +40..+71); geç-savaşta varsayılan momentum'u fresh-recommit'i geçiyor (tavan 0'a kırpar).
  **Faz 1 kapısı: GEÇTİ** — seçici model eğitmek (Faz 3) gerekçeli.
- **Açık (Faz 3 sonrası opsiyonel):** `phases` executor-binding, reward kalibrasyonu, Wilson/bootstrap CI (§9).

---

## 4. Ödül: çok bileşenli vektör (review #5)

Tek gizemli skor YOK (AI saklanmayı/intiharı öğrenir). Ham bileşenler DAİMA korunur:
- Maç sonucu (terminal), yok edilen/kaybedilen değer, görev-alanı ilerlemesi, **açık-kanat süresi**,
  yerel kuvvet yoğunluğu, boşta geçen süre, plan/emir salınımı, korunan yedek, temas-kurma gecikmesi,
  hilesiz-bilgi kullanımı (ihlal = ağır ceza).
- Tek skora çeviren ağırlıklar **sürümlenir** (`rewardWeights.vN`); ham bileşenler her zaman saklanır →
  ağırlık değişince eski veriden yeniden hesaplanabilir.

---

## 5. Veri sözleşmesi: İKİ AYRI AKIŞ (GRU için gözlem + ranking için karar)

Ranking için "yalnız plan-değişimleri" doğru; ama **GRU aradaki gözlemleri de görmeli.** İki akış:

**(a) Observation stream** — her 0.5 sn (GRU'yu besler):
`{ episodeId, tick, stateFeatures.v1[], openMemoryFeatures[], opponentProfile[] }`

**(b) Decision dataset** — yalnız karar noktalarında (ranking etiketi):
`{ episodeId, tick, candidateOperations[], rolloutValues[], selectedOperation, terminalOutcome{},
   sonuç_pencereleri{2,5,10,20,40} }`

- Eğitimde GRU, gizli durumu **bölümün gözlem dizisinden yeniden üretir.** Eski modelden kaydedilmiş
  gizli durum eğitim girdisi YAPILMAZ (model değişince geçersizleşir).
- Çok-pencereli sonuç (2/5/10/20/40 sn) + terminal ayrı sütunlar. Aynı operasyonun 4/sn tekrar-değerlendirmesi
  karar satırı SAYILMAZ (yalnız plan/operasyon değişimleri + önemli icra geçişleri).

---

## 6. LLM koç: yalnız özet görür, deney önerir (review #2, #6)

**LLM korpusu DOĞRUDAN taramaz** (1024 token bağlam, maç ~15 MB, CPU'da yanıt ~15 sn, sayısal
karşılaştırmada sahte-neden üretir). KOD istatistiği çıkarır; LLM yalnız küçük özeti görür:
- En kötü 5 karar, en iyi 5 karar, plan-değişim noktaları, kuvvet/alan değişimi, kanat/yığılma/
  hedef-önceliği göstergeleri, benzer 3 geçmiş durum, **istatistiksel güven seviyesi**.

**LLM KOD YAZMAZ.** Yalnız doğrulanan JSON şemasında deney önerir:
```json
{ "hypothesis": "AI sağ kanatta yerel üstünlüğü kullanmıyor",
  "parameterChanges": { "flankThreatThreshold": 0.62, "reserveCommitRatio": 0.28 },
  "expectedMetrics": ["openFlankSeconds", "exchangeRatio"] }
```
Geçersiz parametre reddedilir. Deney çalıştırıcı ölçer. **Kabul mekanizması LLM'den bağımsız.**

**LLM'in tam rol listesi:** yeni **taktik-gramer bileşimleri** öner · karar zincirini askerî yorumla ·
modelin **sistematik kör noktalarını** tarif et · yeni **rakip doktrinleri** üret · insan-okunur plan
açıklaması yaz ("sol kanatta oran 0.71 olduğu için merkezden kuvvet aktardım") · maç öncesi **komutan
karakteri/doktrin profili** üret. Örn: *"Oyuncu geri çekileni aşırı takip ediyor → kontrollü geri çekilme +
AT pususu senaryosu üret."* Önerinin gerçek değerini **simülasyon + öğrenen model** sınar; LLM'in dediği
otomatik doğru sayılmaz. **YAPMAZ:** birlik sürmek · zorunlu periyodik karar · ham 15MB'ı yorumlamak · kod
değiştirmek · kazandı/kaybetti kararını tek başına vermek.

---

## 7. Self-play = LİG (review #4) + şampiyon arşivi

Kendiyle tek-politika oyun ~%50 verir, tek rakip taş-kâğıt-makas + aşırı uyum. **Rakip ligi:**
- Mevcut sabit kod AI · eski şampiyon modeller (arşiv) · agresif doktrin · savunmacı doktrin ·
  kanat-ağırlıklı · yığılma-ağırlıklı · gerçek oyuncu komut kayıtları · rastgele-ama-geçerli plan seçici.
- Her aday model **tüm ligle**, **iki tarafı değiştirerek**, **aynı seed çiftleriyle** oynar.
- Kazanan şampiyon arşive girer; sonraki adaylar ona karşı da ölçülür.

---

## 8. İnsan kayıtları: train / dev / kör (review #7)

- **Eğitim** kayıtları · **geliştirme** kayıtları · **hiç dokunulmayan kör kabul** kayıtları.
- Eğitimde/geliştirmede kullanılan kayıt, **nihai başarı kanıtı olamaz** (iki maça aşırı uyumu önler).

---

## 9. Kabul kapısı: İSTATİSTİKSEL (review #8)

Bir model ancak **hepsinden** geçerse şampiyon olur:
- ≥ **500 eşleştirilmiş seed** · her seed'de kırmızı/mavi **taraf değişimi** · harita+ordu **katmanlı örnekleme** ·
  önceki şampiyona **güven aralığıyla** üstünlük · navigasyon/terrain ihlali **sıfır** ·
  boşta-kalma ve plan-salınımında **≤%5 gerileme** · kör insan kayıtlarında **gerileme yok** ·
  en az **birkaç yeni canlı oyuncu maçı**.

---

## 9A. Başarı tanımı ve HEDEF galibiyet oranı (hep kazanmak = kötü tasarım)

**AI insanı ne zaman yenmeye başlar? — 4 koşul (AGI GEREKMEZ):**
1. İnsan gibi **yerel kuvvet yığabiliyorsa**. 2. Kanat tehdidini **grup düzeyinde** okuyabiliyorsa.
3. Bütün birlikleri **aynı hedefe aynı anda** sokabiliyorsa. 4. Oyuncunun **tekrar eden davranışını maç
içinde cezalandırabiliyorsa.** Yeter: doğru durum temsili + küçük eylem uzayı + çok güçlü test sistemi.

**Hedef galibiyet oranı (stat/bilgi hilesi YOK):**
- Ortalama oyuncuya ~**%60–70** · iyi oyuncuya ~**%45–55** · oyunu geliştiren/açıkları bilen kişiye ~**%35–45**.
- Mağlubiyette bile **ciddi kayıp verdirmeli**. **Hep kazanmak = kötü tasarım.** Taktik değişince sonuç değişmeli.

**Gerçekçi hedef — YAPILABİLİR:** oyuncu davranışını hatırlamak · aynı numaraya ikinci kez düşmemek · sahte
saldırı · bir kanadı sabitleyip diğerine kuvvet kaydırmak · geri çekilerek AT hattına çekmek · topçuyu susturmak
için hızlı birlik ayırmak · yedeği görünce ekseni değiştirmek · gerekmiyorsa tüm gücü zayıf noktaya yığıp
doğrudan kazanmak · **maçtan maça farklı stratejik kişilik** · maç-içi adaptasyon.
**YAPILAMAZ:** her haritada her oyuncuya karşı insandan ayırt edilemeyen genel zekâ. **Hedef budur zaten değil** —
Pixel RTS sınırında iyi oyuncuya benzeyen, adapte olan, zaman zaman yaratıcı görünen bir komutan.

**İnsan-hissi ölçümü (kazanma oranı yetmez) — KÖR değerlendirme:** oyunculara bazı savaş kayıtları gösterilir
(bir kısmı insan, bir kısmı AI); hangisi insan sorulur. Ayrıca: plan çeşitliliği · aynı taktiğe 2. kez farklı
tepki · oyuncu davranış değiştirince adaptasyon. **Gerçek başarı:** kaybeden oyuncu "AI bonusluydu" değil,
**"yedeklerimi yanlış yerde bağladım, sağ kanadımdan geçti"** diyorsa sistem çalışmıştır.

---

## 10. Determinizm: artık gerçek amacı var

Karşı-olgusal rollout, tekrar-üretilebilir lig ve modelin/analizin öz-incelemesi **deterministik
motor gerektirir.** O yüzden tutulur — ama yalnız bunun için. **Ölçülen:** canlı-oyuncu kayıtları
replay'de ~4-5 sn'de sapıyor ve sapma tik'inde birim fiziği eşleşiyor (pozisyon/hp/ammo/suppression
farkı = 0). **HİPOTEZ (henüz kanıtlanmadı):** görünmez bir bookkeeping (RNG akış konumu / nişan noktası)
canlı↔headless desenkronu. Kök neden Faz 0'da kesinleştirilip tek noktadan kapatılır. Self-play headless →
orada zaten temiz; karşı-olgusal eğitim de headless.

---

## 11. LLM'in gerçek-zamanlı SINIRI (review #9)

- LLM gerçek-zamanlı mikro/plan YAPAMAZ (CPU'da ~15-50 sn; yanıt gelince durum değişmiş; kayıtlanmazsa
  determinizm bozulur).
- **Canlı LLM stratejisti (eski Faz 4) ŞİMDİLİK KALDIRILDI / en sona ertelendi.** Kullanılırsa: tek istek +
  son-kullanma tick'i + geçerlilik kontrolü + yanıt **replay olayı olarak kaydedilir** + geç cevap atılır +
  model hazır değilse hızlı kod kesintisiz devam eder.

---

## 12. Fazlar + eğitim sırası (sıfırdan rastgele RL YOK)

**Eğitim sırası (kritik — her adım öncekine dayanır):**
1. Karşı-olgusal simülasyonlarla **doğru plan/operasyon sıralamasını** öğret.
2. Eski AI + kayıtlı insan emirlerine karşı **temel eğitim**.
3. **Hafızalı modele operasyon sonuçlarını** öğret.
4. Şampiyon arşivli **self-play ligine** geçir.
5. Farklı **doktrinlere** karşı eğit.
6. **Kör insan** maçlarıyla değerlendir.
7. Yalnız **güvenilir** adayları oyuna terfi ettir.
> İleride recurrent-PPO benzeri yöntem eklenebilir — ama model önce karşı-olgusal veriyle **ön-eğitilir**;
> sıfırdan rastgele davranışla BAŞLAMAZ.

**Fazlar:**
- **Faz 0** — Veri sözleşmeleri + replay doğruluğu + throughput. **KABUL KAPILARI (hepsi geçmeden bitmez):**
  `stateFeatures.v1` sabit · `candidateFeatures.v1` sabit · `operationGrammar.v1` şema+doğrulayıcı ·
  `BattleForkState.v1` eksiksiz serialize/restore · **aynı fork iki koşuda aynı hash** · canlı↔headless
  sapmasının **gerçek kök nedeni bulundu** · headless throughput ölçüldü · 10.000 örnek maliyeti hesaplandı ·
  **Oracle tavan testi (§3A) hiç eğitim kodu olmadan çalışıyor.** (§17 açık maddeleri bu sürümlü dosyalara döner.)
- **Faz 1** — Karşı-olgusal operasyon değerlendiricisi (dallandır-ölç) + **§3A Oracle GO/NO-GO**. Model yok.
- **Faz 2** — LLM koç: yapılandırılmış özet + JSON hipotez (§6). Kod-A/B ile ölçülür.
- **Faz 3** — **Hafızalı komutan modeli** eğitimi (adım 1-3): sektör-durum + hafıza → operasyon.
- **Faz 4** — Şampiyon arşivli **lig self-play** (§7) + istatistiksel kabul (§9).
- **Faz 5** — İnsan kayıtlarıyla ince ayar + **kör insan-hissi** testi (§8, §9A).
- **Faz 6** — (gerekirse) düşük-frekanslı LLM stratejisti (§11 kısıtlarıyla).

## 12A. GENEL FAZ ÖZETİ — YOL HARİTASI (uygulama, sadeleştirilmiş)

**Yaklaşım:** her karar noktasında kod-gramer aday üretir → model SIRALAR (öğretmen = karşı-olgusal Oracle
rollout ödülü) → DAgger + lig ile sağlamlaştır → oyuna göm → LLM koç ve insan-maçlarıyla derinleştir.

### ✅ TAMAMLANAN FAZLAR (bu oturumda implement + ölçüldü)
| Faz | İçerik | Kanıt |
|---|---|---|
| **0** | Determinizm + fork + gramer + precision fix | self-play/fork/canlı-oyuncu sıfır sapma |
| **1** | Oracle tavan testi (dallandır-ölç + regret) | GO: tavan ~60, 5/7 |
| **3a** | Seçici model (MLP) + feature + DAgger + lig | kod-AI'yı yeniyor (DEV regret 3.1; canlı Δ+342; lig genelleme Δ≈+234) |
| **3b** | GRU-128 hafızalı model | implement + BPTT doğrulandı (sentetik regret 0.1; lig-hacim bekliyor) |
| **4a** | Canlı entegrasyon (oyuna gömülü) | Hızlı Maç kırmızı AI temas-fazında modeli kullanır |
| **4b** | Self-play altyapı (kontrolör-başına model) + defender modeli | bulgu: dengeli matchup'ta arms-race zayıf |

### ✅ EK TAMAMLANAN (bu oturum, devam)
| Faz | İçerik | Kanıt |
|---|---|---|
| **7a** | 8B veri-koçu (metrik→deney önerisi) | `js/BattleCoach.js` iskelet + parser ✓ |
| **8** | AI-Eğit orkestratörü (DAgger→retrain→ölç→otomatik-göm) | `scripts/ai-train.sh` VALIDATED: r1>v4 (vs1700 Δ+860), r2 DEV-regret↓ |
| **6** | İnsan-maçı DAgger — OYUNA BAĞLI + KULLANICI DOĞRULADI | 2 maç→12 durum→adapte model gömüldü. Oyun-içi 'bu maçtan öğren' + INSAN-EGIT.bat |
| **7** | KOÇ — Coder-14B metrikleri analiz→deney önerir (kod YAZMAZ) | `electron --coach`: 1600 zayıf noktayı bulup odaklandı. Koç-güdümlü döngü (ai-train-coach.sh) vs1600 Δ-324→+154 |

### 🔜 KALAN İŞ (çoğunlukla UI + insan-döngüsü; motorlar HAZIR)
- **Faz 5 — Dengeli-matchup self-play + GRU lig-ölçek eğitim.** Arms-race için matchup dengele (savunmaya
  bütçe/terrain avantajı veya karşılıklı-taarruz) → iki taraf da kazanabilsin → tavan yükselsin. GRU'yu
  lig-hacminde (çok sekans) eğit → hafıza avantajı açılsın.
- **Faz 6 — İNSAN-MAÇI DAgger.** ✅ ÇEKİRDEK HAZIR (snapshot yaklaşımı — replay-mimarisini riske atmadan):
  canlı maçta kırmızının karar-durumlarını fork'la yakala → maç sonrası Oracle-etiketle → insan-dağılımı verisi.
  **Kalan:** oyun-içi "bu maçtan öğren" tetiği + orkestratör merge (etiketleme ağır → arka planda). (Alternatif
  tam-çözüm — deterministik-replay, PLANLAR A-artığı — daha zarif ama delikanlı; snapshot yeterli ve güvenli.)
- **Faz 7 — İKİ-KATMANLI LLM KOÇ (döngü-dışı, buton-tetikli).** Gerçek-zamanlı mikro DEĞİL (§11 çok yavaş).
  - **7a) 8B veri-koçu (`js/BattleCoach.js` ✅ iskelet):** her turdan sonra **metrikleri** (regret, rakip-başına
    galibiyet, modelin nerede battığı) 8B yerel modele ver → **KISITLI-format deney önerir** (RAKIP/ODAK/GEREKCE;
    8B karmaşık JSON'da zayıf → toleranslı parser). Hat öneriyi **ÖLÇER** → iyileştiren kalır. Hızlı, hafif.
  - **7b) DERİN-KOÇ LLM (yalnız "AI Eğit" butonunda — ağır, KOD YAZMAZ).** Kullanıcı kararı: **LLM kod yazmasın,
    koçluğu daha iyi yapsın.** Daha büyük/güçlü bir model buton-tetikli devreye girer; 8B'nin yapamadığı **DERİN
    analiz** yapar: metrik-trendleri + bulgular + (varsa) telemetri özeti → **daha iyi STRATEJİK deney önerileri**
    (hangi rakip-müfredatı, reward-ağırlık dengesi, DAgger odak fazı, model zaaf-hipotezleri). Çıktısı yine
    **parametre-önerisi** (kod değil): orkestratörün tur-ayarlarına çevrilir → hat **ÖLÇER** → iyileştiren kalır.
    KOD/mimari değişikliği önerse bile **insan (geliştirici) uygular** — LLM otonom kod yazıp uygulamaz (§14
    güvensiz-kod riski). Rol: hızlı 8B'nin sığ önerilerini, güçlü modelin derin stratejik koçluğuyla değiştirmek.
  > İki LLM de MODEL DEĞİL, KOD DA YAZMAZ — credit-assignment yine Oracle rollout'ta. LLM'ler yalnız **koçluk
  > yapar** (hangi deney/müfredat/ödül-dengesi); hat hepsini **ölçer**; körlemesine hiçbir şey uygulanmaz.
- **Faz 8 — "AI EĞİT" BUTONU (eğitim döngüsü UX).** Oyun-içi buton → arka planda tam döngü: **çeşitli ordu +
  rastgele rol (atak/defans) + dengeli matchup** self-play → her maçta birkaç karar noktasında Oracle-etiket
  (~1-2k etiketli nokta, 10k ham maç DEĞİL — 90 saat yerine makul) → DAgger retrain → lig → yeni model otomatik
  gömülür. İlerleme çubuğu. Motor zaten kurulu (rollout/Oracle/DAgger/lig/per-controller-model); buton orkestre eder.
- **Faz 9 — Kör insan-hissi değerlendirme (§8, §9A).** İnsan, hangi tarafın model hangi tarafın kod olduğunu
  bilmeden oynar/izler → "insan gibi mi" + hedef galibiyet oranı (§9A: 60-70/45-55/35-45).

> **NOT (bugünkü kanıt):** Kullanıcı fikri "çift-AI, farklı ordu, atak/defans, çok maç" = Faz 5+8'in özü ve
> DOĞRU yön. Kritik: gelişme maç *sayısından* değil, her maçtan çıkan **öğrenme sinyalinden** (Oracle-etiket) +
> **dengeli matchup**'tan gelir. Salt 10k win/loss zayıf sinyal (credit-assignment çözülmez).

### ⚠️ 2026-08-03 DENETİMİ — aşağıdaki durum listesi KISMEN BAYAT

Koda karşı doğrulandı; iki madde artık **yanlış**:

1. **"Oyuna gömüldü ✅ — Hızlı Maç kırmızı AI v4 lig-modelini kullanır"** → **ARTIK DEĞİL.**
   `js/BattleSelectorModel.js:3` → `const BATTLE_SELECTOR_AUTO_ENABLE = false;`
   Gerekçe (kodun kendi yorumu): *"v3-roster25: eski 9-tip model BAYAT → kapalı, AI kod-mantığını kullanır.
   Retrain sonrası tekrar açılır."* 25-birim roster geçişi modeli geçersiz kıldı. **Şu an oyunda öğrenen model YOK**,
   kod-AI (kural + intel4-deltaları) sürüyor.
2. **"Sıradaki: (2) ⭐ Deterministik controller-replay"** → **gerekmiyor.** Hedeflediği canlı↔replay sapması
   başka yolla çözüldü (`SIM.ctrlPosture`, bkz. [PLANLAR.md](PLANLAR.md) A-artığı). Eğitim kaldıracı olarak
   (kompakt kayıt + insan-maçı DAgger) hâlâ değerli olabilir ama determinizm gerekçesi düştü.

**Bütçe notu:** güncel Hızlı Maç varsayılanı **6500₺ ve iki taraf EŞİT** (`js/Screens.js:22-23,49-50`).
Belgede/ölçümlerde geçen 1400/1600/1800 ve 5000 rakamları eski eğitim-lig bütçeleridir; güncel dengeye
uygulanamaz. Kayıp/verim hedefleri 6500'e normalize edilmeli.

### 📍 GÜNCEL UYGULAMA DURUMU (kod + ölçümler) — *aşağısı yazıldığı tarihteki durumdur, yukarıdaki denetimle oku*
- **Faz 0 ✅** — determinizm (self-play/fork/canlı-oyuncu), `operationGrammar.v1` (64 aday), `BattleForkState.v1`,
  precision fix (canlı-replay kök nedeni bulundu+düzeltildi). Dosyalar: BattleSession/OperationGrammar.js.
- **Faz 1 ✅** — Oracle tavan testi (`js/BattleOracle.js`, `electron --oracletest`): enjeksiyon (intent+sektör+
  allocation+flank+tempo) + karşı-olgusal rollout + tavan-regret. İzole/tekrarlanabilir. **GO** (tavan ~60, 5/7).
- **Faz 3 ✅ (PoC→robust)** — `stateFeatures.v1`+`candidateFeatures.v1` (`js/BattleFeatures.js`) + seçici MLP
  (`js/BattleSelector.js`, karşı-olgusal ödülle eğitim). **48 örnek → DEV regret 3.1** (near-oracle). GRU-128 de
  implement+BPTT doğrulandı (veri-aç). Veri: `electron --oracledata/--oracleseq`.
- **Faz 4 ✅ (canlı + on-policy)** — model controller'a bağlı (`battleSelectorEnable`, `electron --selectorlive`).
  - **v1 (off-policy):** hibrit (kod-AI açılış + model dar temas-penceresi 550-1050) → 6/6, ortFark 1095>916 (Δ+178).
  - **Bulgu:** full-maç override dağıtım-kaymasıyla kötü (model kendi OOD trajesini ziyaret ediyor).
  - **DAgger (on-policy, `electron --oracledagger`):** model SÜRERKEN kendi durumlarını Oracle ile etiketle →
    48 off-policy + 43 on-policy karışık eğit → **v2**.
  - **v2 sonuç:** genişletilmiş pencere [temas→son] → **6/6, ortFark 1258>916 (Δ+342, iyileşme ~2×)**;
    TAM override [0→son] bile baseline'ı yeniyor (Δ+131, 5/6). Dağıtım kayması **kapandı**; en iyi konfig
    v2 + temas-sonrası pencere. DAgger turu tasarlandığı gibi çalıştı.
- **Pre-contact DAgger (denendi, RED):** erken (temassız) durumlar düşük-sinyalli (tüm adaylar ~eşit ödül)
  → gürültülü etiketler modeli HER YERDE bozdu (v3 Δ-234 temas penceresinde bile). **Ders: model rolü =
  temas-fazı komutanı, full-maç sürücüsü DEĞİL.** Pre-contact'ı kod-AI sürsün. v2 en iyi model.
- **Lig ihtiyacı KANITLANDI:** v2 sadece blue-1400'e karşı eğitildi → **güçlü blue-1600'e karşı çöküyor**
  (Δ-1121, 0/5) = tek-rakibe aşırı-uyum. **Lig self-play (§7) çözümü:** çeşitli rakiplere (blue 1100-1800,
  karışık kompozisyon, ileride kendi eski sürümleri) karşı DAgger → genelleşen model. Rakip-çeşitliliği
  altyapısı hazır (`--oracledagger <..> <blueBudget> <combat|mixed>`, `--selectorlive` BLUE_BUDGET/BLUE_COMBAT env).
- **Lig turu ✅ (v4):** çok-rakip DAgger (blue 1400+1600+1800) → **v4 genelleşiyor:** vs1400 Δ+328(5/5),
  vs1800 Δ+697(5/0, baseline zorlanırken model baskın), vs1600 Δ-324(3/5, çöküşten ~3.5× kurtuldu; baseline
  burada en güçlü). Ortalama Δ≈+234. **Lig aşırı-uyumu kırdı** (v2 tek-rakip dışında çöküyordu). v4 = kanonik model.
- **Self-play denendi (kısıtlı) — ÖNEMLİ bulgu:** kontrolör-başına model altyapısı kuruldu
  (`battleSelectorEnableFor`, `--selfplay`). Defender modeli eğitildi (blue-defender, kendi rol/tarafında).
  Ama **v4-attacker vs defender-model** → red her durumda ~1250 farkla domine (defender-model kod-AI'dan
  sadece ~75 iyi). Kök: (1) **savunma headroom'u küçük** (defender Oracle-regret ~11 — kod-AI defender zaten
  iyi), (2) **dengeli-bütçe matchup'ta attacker yapısal baskın**. → **Bu matchup'ta self-play arms-race ZAYIF.**
  Gerçek arms-race için **dengeli/simetrik matchup** (savunmaya terrain/bütçe avantajı, veya meeting-engagement)
  gerekir — yoksa öğretmen-tavanı (kod-AI) aşılamaz. İnsanı zorlamak için asıl kaldıraç: **insan-maçı DAgger**
  (aşağıdaki deterministik-replay avantajı → oyuncunun gerçek maçlarından öğren, self-play değil).
- **Oyuna gömüldü ✅** — Hızlı Maç kırmızı AI temas-fazında v4 lig-modelini kullanır (`js/BattleSelectorModel.js`
  gömülü + `startBattle` kancası; interactive+mode='quick' gated, MP/replay/hikâye/headless-test'te kapalı).
- **Sıradaki:** (1) model-vs-model self-play (blue de model/eski-sürüm) + 1600-boşluğu verisi + GRU lig-hacim;
  (2) **⭐ Deterministik controller-replay** (PLANLAR A-artığı temiz çözümü): replay'de kontrolörleri (model dahil)
  seed'den ÇALIŞTIR → tam maç `(seed+oyuncu-event)`'ten reprodüksiyon. **Eğitim kaldıracı:** insan-maçlarını
  birebir üretip her karar noktasında Oracle-etiketle → **gerçek-insan-dağılımı DAgger** (self-play değil) +
  model-maçı karşı-olgusal analiz. Faz 5 (insan kayıtları) ile eşleşir. Altyapı (fork/rollout/feature/MLP+GRU/
  canlı/DAgger/lig/oyun-entegrasyonu) tam kurulu.

---

## 13. Ölçülmüş yargı boşlukları (kod-AI zaten iyileşebilir; model gelene kadar temel)

1. ✅ Pasiflik — düzeldi (saldıran taarruza eskale; `redAttacks` imha→kazandı).
2. Kuşatma savunması — kayıp ≈2×; naif facing refleksi ölçümde kötüleşti→revert; grup-konumlanma gerek.
3. Kuvvet yığma. 4. Tempo/okuma. 5. Aldatma/yemleme.
(Bunlar hem kod-AI için erken düzeltme, hem plan-değerlendiricinin öğrenmesi gereken davranışlar.)

---

## 14. Yapmayacaklarımız

- LLM'i gerçek-zamanlı mikro/plana sokmak. · LLM'e kod yazdırmak. · LLM'i istatistik kaynağı yapmak.
- Sıfırdan 4. motor. · Ölçmeden değişiklik. · Tek maça aşırı-uyumu başarı sanmak. · Determinizmi self-play
  dışında bir yük olarak tutmak.

---

## 15. Review skorları → hedef

Yön 8/10, LLM-sınırı 8/10 korunuyor. Zayıf olanlar bu sürümde kapatıldı: gerçek-ML tanımı (§2-3),
self-play tasarımı (§7), değerlendirme güvenilirliği (§9). Başlamaya hazırlık: **Faz 0 + Faz 1**
(veri sözleşmesi + karşı-olgusal değerlendirici) net; oradan başlanır.

---

## 16. Dürüst olasılık — GEREKLİ BİRLEŞİM

Hedef imkânsız değil; ama **yalnız LLM koç + büyüyen kurallarla** ulaşılamaz, **yalnız küçük statik
plan-skorlayıcıyla** da ulaşılamaz. Gereken tam birleşim (hepsi birlikte):
1. **Hafızalı öğrenen komutan** (§2.3) · 2. **Birleştirilebilir taktik grameri** (§2.6) ·
3. **Zamana yayılan operasyonlar** (§2.2) · 4. **Kod-tabanlı güvenilir icra** (Katman 3) ·
5. **Rakip modeli** (§2.4) · 6. **Şampiyon arşivli self-play ligi** (§7) · 7. **Gerçek oyuncu kayıtları**
(§8) · 8. **LLM koç ve araştırmacı** (§6). Biri eksikse sistem "iyi oyuncu" seviyesine çıkmaz.

---

## 17. UYGULAMA KESİNLİĞİ (review'un 9 eksiği — kodlamadan önce netleşmeli)

**(1) Model seçimi** → §2.3 (GRU-128, 2 gözlem/sn, 3–5 sn karar, binary+JS inference). **(7) Runtime** → §2.3.

**(2) Operasyon gramerinin MAKİNE ŞEMASI** (fikir değil, kod sözleşmesi): izin verilen fazlar + max faz sayısı +
faz-sırası kuralları (hangi faz hangisinden sonra) + hangi birlik kompozisyonunda hangi taktik geçerli +
izinli tetikleyiciler + abort koşulları + grup-oranı alt/üst sınırları + operasyon azami süresi + **bir birim iki
gruba atanamaz** kuralı. Gramer bu şemadan 16–64 geçerli aday üretir.

**(3) Fork durumu EKSİKSİZ olmalı** (replay başlangıç snapshot'ı YETMEZ): tüm birim iç durumu · saldırı
cooldown'ları · hedefler · nav rotaları · bastırma/panik · controller hafızaları · geçerli operasyon+faz ·
görev grupları · RNG durumu · mermiler/bekleyen fizik · savaş kuralları+zaman · açık oyuncu modeli.
**Kapı:** aynı durumu fork edip değiştirmeden iki kez çalıştır → **hash'ler eşleşmezse eğitim verisi ÜRETME.**
**ÖLÇÜLDÜ (`--forktest`):** mevcut `battleCaptureInitialState` snapshot'ı bir fork için GEÇERSİZ — orta-savaş
fork'u orijinalden **+20 tik'te ayrılıyor**, 20 birim sapıyor. Kaybolan: **attackTarget** (`battleRestoreUnit`
null'lıyor → birimler dövüşmeyi bırakıyor), **controller durumu** (nextDecisionTick/plan/görev-grupları/algı).
BattleForkState.v1 bunları eklemeli; öncelik: (a) birim attackTarget/manualTarget/combat-cooldown/combatState,
(b) her controller'ın tam iç durumu, (c) supports/mermi. Sonra fork-iki-kez-hash kapısı geçmeli.
**✅ YAPILDI (commit 1b28ab6):** `battleForkCapture`/`battleForkRestore` — jenerik tam birim snapshot
(ref'ler id ile) + controller durumu (nextDecisionTick, planCommitment, perception contact-Map,
taskExecutor, ForceOrganizer/TaskContractPlanner cache'leri). Doğrulandı: null-sürücü VE AI-sürücü
senaryolarında fork orijinal devamıyla **SIFIR sapma** (`forkTutarli=true`) — fork-iki-kez-hash kapısından
güçlü sadakat (fork==orijinal). Faz 1 hazır.

**(4) Gizli-bilgi varyasyonu = inanç-durum örnekleme (hile ÖNLENİR):** AI'ın göremediği gerçek düşman
konumunu öğretmene VERME. Temas hafızasından **olası gizli durumlar örnekle** (kayıp birlik için birkaç
muhtemel sektör); her operasyonu bu olasılıkların **tümüne** karşı dene; sonucu **beklenen değer + kötü-durum
riski** olarak sakla. Model belirsizlik altında riski de görsün.

**(5) Ödül SIRALAMA kuralı** (bileşenler §4, ama karşılaştırma sırası şart): görev sonucu → yok/kayıp değer →
alan ilerleme → korunan savaş gücü → açık-kanat+boşta cezası → plan salınımı. **Her bileşen normalize** (ör.
"500 hasar" vs "20 sn açık kanat" hangi ölçekte? → `norm.v1` tanımlanır).

**(6) Eğitim kaybı — İLK SÜRÜM SEÇİLDİ:** **listwise softmax cross-entropy** (en iyi aday üstte; pairwise
SONRAYA). Ayrı **değer kafası** (uzun-vadeli terminal) + ayrı **risk/varyans** çıktısı.

**(8) Hesap bütçesi — ÖLÇÜLDÜ (Faz 0/2, electron `--benchmark`, 24 birim + AI):**
- Ham throughput: **2.728 tik/sn = 136× gerçek-zaman** · Fork (capture+clone+restore): **0.97 ms** (darboğaz değil) ·
  Rollout (600 tik=30 sim-sn): **105 ms**.
- **Bir örnek** (192 rollout = 32 aday × 6 varyasyon): **~20.2 sn** ← dominant maliyet. **10.000 örnek:** tek
  proses **56 sa**, 8 paralel **~7 sa**.
- **Ölçek levyeleri** (gerekirse): rollout 30→15 sn (~2×) · aday 32→16 & varyasyon 6→3 (~4×) · erken-durdurma ·
  worker-havuzu paralelleştirme. Oracle testi (Faz 1) aynı rollout makinesini kullanır → aynı birim maliyet.

**(9) Kabul CI formülü** (§9 sayısal): **kazanma oranı → Wilson %95 GA**; **eşleştirilmiş fayda/hasar farkı →
paired bootstrap %95** (ikisi aynı şey İÇİN kullanılmaz). Önceki şampiyona fayda farkının **alt sınırı > 0** ·
kritik güvenlik ihlali sıfır · **ağır çöküş sayısal:** hiçbir harita/doktrin alt-grubunda fayda farkı **−%10
altına düşemez** (toplamda iyi ama tek altgrupta çöken model REDDEDİLİR).

> **Not:** Dosya adı hâlâ `v4`, içerik v5→v6. `<1 ms` ve tüm süreler ölçülene kadar HEDEF'tir, kanıt değil.
