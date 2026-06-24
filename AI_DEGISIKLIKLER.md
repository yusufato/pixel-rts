1# AI Savaş Sistemi — Değişiklik Günlüğü

Bu dosya, AAA AI geliştirmesinde yapılan tüm somut kod değişikliklerini kaydeder.
Hedef: AI'nın **hile yapmadan** yetenekli insan oyuncuyu yenmesi.

---

## 1. DENGE (globals.js, Unit.js)

- **Birim verileri** (globals.js STATS): gerçekçi yeniden ayar.
  - Tank: 8 sn atış, 20 hasar, +**alan hasarı (splash)** `TANK_SPLASH_RADIUS=80`, oran %30–65.
  - Topçu: 10 sn, 25 **sadece alan hasarı** (nokta atışı yok).
  - Tanksavar: 5 sn, 25, zırha ×4.0 + %85 delme.
  - Teçhizatlı piyade (mekanize/zırhlı): tanka ×1.6 + %35 delme.
  - **Tüm birim hızları ~%25 düşürüldü** (gerçekçilik).
- **calculateUnitDamage** (globals.js): AT ve teçhizatlı piyade zırh-delme dalları.
- **Tank splash** (Unit.js performAttack): birincil hedef + çevredeki düşmanlara mesafeyle azalan hasar.

## 2. SELF-PLAY & EĞİTİM (SelfPlay.js, Replay.js)

- **Headless self-play motoru**: gerçek oyun motorunda görüntüsüz maç, iki LayeredAI beyni.
- **İnsan Replay sistemi** (Replay.js): her maç otomatik kaydedilir (diziliş + zaman damgalı emirler), son 10 tutulur (FIFO). Eğitim son 6'sını kullanır.
- **spRunMatch**: `blueReplay` ile mavi tarafı insan kaydından oynatır (spDeployReplay + spApplyReplayCommands).
- **Engagement shaping** (fitness): geç temas −900, aktif dövüş +400, hiç vuramama −1000, üstün değilken zaman aşımı beraberesi −400.
- **fitHuman seçimi**: şampiyon ÖNCE insana karşı performansa göre seçilir (toplam fitness sadece eşitlik bozucu). Agresif rakibe dayanma da seçime dahil.
- **Eğitim menüsü** (buton): AI vs İnsan (~2000) / AI vs AI (288) / Gece (20.000).
- Maç süresi 1500→2400 tick; kesin galibiyet eşiği 1.1→1.05.

## 3. KOMUTA ZİNCİRİ MODERNİZASYONU (LayeredAI.js)

### Adım 1 — Birleşik-silah muharebe grubu
- **slotFor rol-derinliği**: tank +50/90 önde, piyade −25 (tank arkası), tanksavar +140 (derin destekten öne ekran), topçu 0 (derin), medic/istihkam −60.
- **selectFormation**: durumsal diziliş — wedge (yarma/üstünlük) / line (savunma/azlık) / flex.
- **manageReserve**: %30 piyade yedek (depth −220); üstünlük veya kriz'de sürer.
- **Destek tasması** (assaultAnchor + outranSupport): piyade desteği 300px'den fazla geçemez.

### Adım 2 — Gerçek manevra (pin + flank)
- **chooseEnvelopment**: düşmanın boş kanadını seçer.
- **ENVELOP dalı**: kanat birliği geniş dolanıp arka hatta (topçu/AT/medic) dalar; merkez cepheden pin.

### Adım 3 — Ordu-seviyesi odak ateş
- **pickFocusTarget**: reach (kaç birim vurabiliyor) ×850 + düşük mutlak HP ×1700 + değer/HP ×1200; zırh bonusu 1300→500.

### Adım 4 — Tahkimli savunma
- **fortifyMode + nearestFriendlyTrench**: yıpratma/toparlanmada piyade/AT sipere girip +6 zırhla döver. Siper sınırı 1→2.

## 4. TURTLE-KIR + GÜÇLÜ MERKEZ (Faz 1)

- **assign**: kanat EN FAZLA %40 (gen daha yüksek dese de) → merkez ≥%60 güçlü pin.
- **DEFENSE duruşu**: ATTRITION 2.6→1.2, ADVANCE +0.4, ENCIRCLE +0.8 (turtle yerine yoğunlaş+karşı vur).
- **DELAY duruşu**: REGROUP 2.2→1.2, ATTRITION 1.8→1.4.
- **Kötü takas**: ATTRITION 2.0→1.2, REGROUP sadece HP<0.6, ENCIRCLE +0.5.
- **Anti-topçu** temel skoru 4.6→3.4; idle override ADVANCE+4 / anti-topçu −2.5.
- **Kesin saldırı eşiği** tavanı `min(decisiveForceRatio, 1.3)`; geri çekilme eşiği <0.6.

## 5. UZMAN BİRİM MİKROSU (LayeredAI.js)

### Mikro 1 — Kuvvet koruma
- **nearestLivingMedic + unit.preserving (hysteresis)**: yaralı birim (HP<%32, kazanmıyorsak, medic varsa) dövüşü bırakıp medic'e çekilir; HP>%60'ta geri döner. Medic yoksa tetiklenmez.

### Mikro 2 — Sert odak ateş
- **pickUnitTarget**: ordu odak hedefi menzildeyse (range×1.25 + LoS) birim ONU vurur (tanksavar hariç — tankı vurur). Lanchester: yoğunlaş ve sil.
- **pickFocusTarget**: öldürülebilir hedef seçer (değer/HP) — tank yerine topçu/AT/medic/yaralı.

### Mikro 3 — Kuvvet konsantrasyonu (uzayda yoğunlaşma)
- **chooseEnvelopment** artık `combatAnalysis.forceRatio` alıyor: kanat manevrası YALNIZCA yerel üstünlük varken (forceRatio > 1.1) açılır. Eşit/geride isek tüm ordu tek yumruk olarak dövüşür — kuvvet uzayda dağılmaz (Lanchester). Kuşatma genişliği 360→260, derinlik 220→200.
  - **Neden:** brain8 sonrası canlı maçta ordunun %40'ı (kanat) maç boyu geniş dolanıp toplam 1 vuruş/91 hasar verdi. Boşta %70 + 1500'e 400 kötü takasın ana sebebi buydu.
- **Saldırı tasması çapası** artık yalnızca TANKSAVAR (eski: tanksavar+topçu). Topçu max menzilden atar ve çok yavaştır (0.27); çapaya katılması cepheyi sürünen topçuyu beklerken boşta bırakıyordu.

## 6. İLERİYE-BAKIŞ DANIŞMANI (Foresight.js — YENİ DOSYA) ⭐ TEMEL DEĞİŞİKLİK

**Neden:** Mikro 3'ten sonra da eşit düelloyu kaybettik (40 değer / 1500 kayıp, boşta %65). Teşhis: yamalar yakınsamıyor; mimari kuvveti DAĞITMAK üzerine kurulu, AI hiçbir zaman temas noktasında YEREL ÜSTÜNLÜK kuramıyor (Lanchester). Çözüm yönü (kullanıcı seçimi, soru-cevap):
- Çekirdek: **ileriye-bakış / muharebe simülasyonu** ("şunu yaparsam ne olur?")
- Hesap: **hibrit** (hızlı Lanchester tahmincisi her tick + ara sıra gerçek-motor kalibrasyonu)
- İlişki: **danışman** (mevcut zincirin üstünde, karar noktalarına güçlü girdi)
- Plan uzayı: **manevra dahil** (düşman kümesi × cephe/kanat/kuşatma × gir/tut/çekil)

**Foresight.js — `LookaheadAdvisor`:**
- `predictEngagement`: odak-ateş Lanchester sim (0.5 sn adım, ~9 sn ufuk). İki grubu klonlar, her taraf bir hedefe ateşi yığıp öldürür. Çıktı: **net değer = düşman kaybı − benim kaybım**.
- `clusterEnemies`: düşmanı mesafeyle gruplar (yarıçap 260), en değerli 3 küme = Schwerpunkt adayları.
- `evaluate`: her küme × {cephe, kanat, kuşatma} için tahmin. Kanat = düşman ilk 4 sn ×0.4 ateş (baskın); kuşatma = önce destek/topçu avı + kendi gücüm ilk 3 sn ×0.55 (yolda). HOLD yalnızca siperde. En iyi net < −160 ise **ÇEKİL**.
- `decide`: histerez (planı ≥3 sn tut, yeni plan +220 net geçmezse değişme) → salınım önler.
- `FORESIGHT_CALIB`: tahmincinin katsayıları (hibrit gerçek-motor bunları ayarlayacak — sonraki adım).

**LayeredAI bağlantısı (danışman → karar noktaları):**
- Constructor/reset: `this.advisor` kuruldu; `update()` her tick `advisor.decide(...)` → `this.advisorPlan`, state'e eklendi.
- **Posture override** (doktrin kararı sonrası): WITHDRAW → REGROUP (tek kütle çekil); COMMIT + savunma doktrini → ADVANCE (yığ ve gir); HOLD + ADVANCE → ATTRITION (ateş hattı kur). Güven ≥0.22; temizlik/son-av/arama modlarına dokunmaz.
- **Schwerpunkt** (getObjectives): COMMIT planı varsa hedef = seçilen küme merkezi (tüm-düşman-merkezi DEĞİL) → tüm ordu o noktaya yoğunlaşır.
- **Manevra** (chooseEnvelopment): danışman varsa sadece ENVELOP dediğinde kuşat; FRONTAL/FLANK'ta yoğun cepheden döv.
- Script: `js/Foresight.js`, AI.js ile LayeredAI.js arasına eklendi (index.html + oyna.html).
- **Debug:** canlı maçta konsola `layeredAI.advisorPlan` yaz → o anki posture/manevra/net görülür.

## 7. TURTLE-KARŞITI: TOPÇU KUŞATMASI + CHARGE ZORLAMASINI KALDIR ⭐

**Kritik bilgi (kullanıcı):** İnsan SADECE SAVUNMA oynuyor (hattını tutuyor, hiç saldırmıyor). Askeri gerçek: eşit kuvvette savunan üstündür. Bizim anti-idle/turtle-kır kodumuz AI'yı savunan düşmana CHARGE etmeye zorluyordu → intihar. Danışman da (savunma üstünlüğünü modellemediği için) charge öneriyordu → maç daha kötü (598 hasar, 0 kill, 18 doktrin savrulması).

**Kullanıcı kararı (soru-cevap):** Topçu kuşatması + ölçülü ilerleme. (Not: aslında danışmana güvenmek istiyor ama kararlarını göremiyordu → şeffaflık eklendi.) Çözüm hem stratejiyi uyguluyor hem danışmana bu kararı *kendi* aldırıyor.

**Sabit düşman tespiti** (LayeredAI.measureEnemyRetreat): `enemyStaticScore` — düşman merkezi neredeyse hiç kıpırdamıyorsa (turtle) `state.enemyStatic=true`.

**Charge zorlaması sabit düşmanda KAPALI:**
- `pressureFailure` artık `!enemyStatic` şartlı → turtle'a karşı boşta süre "başarısızlık" sayılmaz, backline-raid charge tetiklenmez.
- `fireBaseOverdue` artık `siegeHold` iken false → ateş üssü terk edilip charge'a kaçılmaz.

**Aktif topçu bombardımanı** (FIRE_BASE_SETUP): menzil dışındaki topçu/AT artık geriye park etmiyor; `hedef − yön×(menzil×0.9)` bombardıman noktasına yaklaşıp sabit düşmanı dışarıdan döver. (Eskiden objectives.support ~430 geride kalıp topçu hiç ateş edemiyordu.)

**siegeHold:** danışman SIEGE veya (düşman sabit & danışman COMMIT değil) → ekran (piyade/tank) geride bekler (SCREEN_FIRE_BASE), topçu menzilden bombalar. Düşman eridikçe danışman COMMIT'e geçer → siegeHold serbest → **ölçülü ilerleme** ile bitirilir.

**Danışman SIEGE postürü** (Foresight.js):
- Düşman sabit + uzun menzil birim (topçu/AT) varsa → kuşatma planı hesaplanır (sadece uzun menzil ateş eder, düşman karşılığı ×0.15, ufuk 14 sn). Kuvvet korunur → yüksek net değer.
- COMMIT (charge) artık sabit düşmana karşı cezalı: düşman +4 zırh (kazılı) + benim ilk 4 sn ×0.5 ateş (damla-damla geliş). → Charge'ın net değeri düşer, danışman kendi kuşatmayı/çekilmeyi seçer.

**Şeffaflık:** Konsola `FORESIGHT_DEBUG = true` yaz → danışman her yeni kararda `[Danışman] SIEGE/FRONTAL · net=.. · güven=..` yazar. `layeredAI.advisorPlan` ile o anki plan görülür.

### 7.1 — Tahminci gerçekçilik ayarı (canlı debug sonrası)
Konsol kanıtladı: tahminci **aşırı iyimser** — savunan düşmana COMMIT/charge net=+50..+200 diyordu (kazanırım sanıyor), ama canlı sonuç 1500'e 200 kayıp. Sim≈%50 / canlı≈%0 uçurumunun ta kendisi. Düzeltme:
- **COMMIT vs sabit düşman artık negatif net**: kazılı +6 zırh, savunmacı ilk vuruş üstünlüğü (ilk 6 sn ×1.3), benim damla-damla gelişim (ilk 8 sn ×0.3). → Danışman charge yerine SIEGE/HOLD seçer (intiharı durdurur).
- **HOLD her zaman sunuluyor** (eski: sadece siperde), gerçekçi küçük sabit değer (siperde 45, açıkta 12 — brawl simüle etmez; tutmak = sınırlı temas). Kaybedilecek charge yerine orduyu korur.
- Düşman eridikçe COMMIT net'i artar → bir noktada SIEGE'i geçer → ölçülü ilerleyip bitirir.
- **Not:** kuşatma İCRASI hâlâ doğrulanmalı (önceki maçta COMMIT/siege çatışması 195 sn boşa beklemeye yol açmıştı; bu ayar çatışmayı kaldırınca topçu istikrarlı bombalamalı). Asıl çözüm: hibrit gerçek-motor kalibrasyonu (replay'e karşı).

## 8. YENİ TEMEL: KUVVET EKONOMİSİ (en az kayıp / en fazla hasar) ⭐⭐ ANAYASA

**Kullanıcı kararı:** Oyunun temeli artık "düşmanı yok et" DEĞİL → **"en az kayıpla en fazla hasar"** (economy of force). Düşmanı yok etmek amaç değil, verimli takasların sonucu. Bu, "ne pahasına olursa olsun saldır/bitir" intiharını kökten çözer.

**Üç direk (soru-cevap ile kararlaştırıldı):**

1. **Çekirdek metrik — değer farkı + kayıp-kaçınması:** `net = düşman_değer_kaybı − k×kendi_değer_kaybım`, `k=1.6` (kendi birimim daha kıymetli). `FORESIGHT_CALIB.lossAversion`. Tüm tahminler (predictEngagement) artık bu k'lı net'i döndürür. (k ileride gen olacak → eğitim ayarlar.)

2. **Durumsal/"bilinçli" postür:** Avantajı bozdurma ayrı kural DEĞİL — danışman tüm postürleri (COMMIT/SIEGE/HOLD/WITHDRAW × manevra) net'e göre tartar, duruma göre en iyisini seçer. "Bitir" = COMMIT (+net olunca), "grind" = SIEGE, "düşmanı zorla" = HOLD. Bilinç buradan doğar.

3. **Aşağıdan yukarı birim vetosu (`localExchange`):** Her birim "yakınımdaki dost+düşmanla bu yerel kavga lehime mi?" diye sorar. Değilse (intihar: 1'e çok) düşman ateşine TEK BAŞINA yürümez → `MASS_WAIT` ile yerinde durur, cephe kütlesi büyür, yoğunlaşınca lehe döner → topluca girer. **Damla-damla ölümü KAYNAĞINDA keser; yoğunlaşma kendiliğinden oluşur.** Veto yumuşak eşik (enemyLoss ≥ myLoss×0.85) → eşit/lehte kavgaya izin, sadece açık kaybı engeller (paralizi yok). Stratejik k=1.6 ordu seviyesinde kalır.

**Bağlantı (LayeredAI generic combat branch):** menzilde değilsem + yerel takas aleyhte + finiş değilse → MASS_WAIT (yürüme, yoğunlaş). Menzildeysem kalıp döverim (kütleye DPS katarım). Yedek birimler ve temizlik/son-av muaf.

### 8.1 — Eğitim hedefini hizala + k'yı gen yap (eğitim öncesi şart)
Kullanıcı: "eğitim artık şart." Ama eğitim fitness'i optimize eder — ESKİ fitness "yok et/hasar ver/charge" istiyordu, yeni temeli bozardı. Hizalandı:
- **Telemetri ödülü** (calculateTacticalReward): `netValue = düşman_kaybı − 1.6×kendi_kaybım` BASKIN terim (×4). victory 950→500, defeat −900→−380, physicalFinish 700→240 (kazanmak artık intiharı haklı çıkarmıyor). **idle cezası −2→−0.35** + eşik 45→120 sn (sabır artık meşru — senin işaret ettiğin anti-idle zorlaması kalktı).
- **Self-play fitness** (SelfPlay.js): aynı kuvvet-ekonomisi (blueValueLost − 1.6×redValueLost)×4. **spEngagementShaping yumuşatıldı**: eski "geç temas −900 / aktif +400 / oturma −400" (charge'a zorluyordu) → sadece "hiç vurama −800 / aktiflik +120 / çok geç temas −200" (tam atalet engeli, ama sabra izin).
- **k bir GEN oldu** (`lossAversion`, limit 1.0–2.4, default 1.6): globals.js TACTIC_GENE_LIMITS + DEFAULT_TACTIC_GENES. Mutasyon/crossover otomatik kapsar. Danışman k'yı genomdan okur → **eğitim AI'nın temkin↔agresiflik kişiliğini kendi ayarlar.** Şu anki aşırı-pasifliğin çözümü: eğitim kazandıran k'yı bulur.

**Eğitim hazır.** Önerilen: AI vs İnsan (replay'e karşı, canlıya transfer eder) veya Gece (büyük + replay). Eğitim sonrası beyin raporu + canlı maç ver.

## 9. YAPISAL DERİNLİK: BÖLGE KONTROLÜ / ZAFER PUANLARI ⭐⭐⭐ (oyun yapısı)

**Derin analiz (kullanıcıyla):** Asıl kök sorun AI değil, **OYUN YAPISI.** Ekonomisiz + simetrik + sabit-ordulu bir oyun = saf mikro dövüşü, ve **savunma yapısal olarak baskın** (saldıran açık araziyi geçip yoğun ateşe girer → kaybeder). İnsan mikroyla değil, **savunma stratejisiyle** kazanıyor. Sezgisel AI'nın optimal-savunan insanı yenmesi bu yapıyla ~imkânsız. Çözüm: yamadan değil → **oyunu derinleştir, sonra öğrenilmiş beyin** (kullanıcı kararı).

**İlk yapısal taş — Bölge Kontrolü** (ControlPoints.js, YENİ): turtle'ı doğrudan kırar + "kuvvet ekonomisi" temelini zafere bağlar.
- **3 nokta** orta hatta (Sol/Merkez/Sağ, y=WORLD_H/2). Bir bölgede senin birimin var + düşman yok → ele geçirirsin (cap −1..+1). İkisi de → çekişmeli (donar).
- **Tutulan her nokta sn'de +5 puan; 1500'e ulaşan KAZANIR** (checkGameOver'a eklendi). Köşede oturan turtle noktaları kaptırır → puanla kaybeder → **dışarı çıkmak zorunda.**
- Görsel: bölge halkaları (sahip rengi/çekişme sarısı) + üst-orta skor HUD.
- **AI kancası** (pickTerritoryTarget): lehte kavga (COMMIT) yoksa AI en iyi kontrol noktasına yönelir (düşmanınkini geri-al > nötrü kap), `localExchange` vetosu sayesinde savunulan noktaya tek tek dalmaz (MASS_WAIT → yoğunlaş → al). getObjectives hedef önceliği: COMMIT-kavga → bölge noktası → düşman merkezi.
- **Sinerji:** değer üstünlüğü artık zafere dönüşür (önde olan noktaları tutar, puanı götürür). Savunan insan noktaları çekişmek için prepared-mevzisinden çıkmak zorunda → savunma üstünlüğü nötrleşir, hatta noktayı tutan AI'ya geçer.
- **Not:** self-play (headless) henüz bölge kullanmıyor → eğitim entegrasyonu sonraki adım. Şimdilik CANLI oyunda aktif (test edilebilir).

## 10. HARİTA REVİZYONU + HEDEF MİMARİ "TDC" (uzman paneli sentezi)

### 10.1 — Harita yeniden tasarımı (globals.js terrainFeatures)
- **Bug:** Eski haritada 3 kontrol noktasının 2'si (Sol 880, Sağ 2520) dağ içinde kalıyordu.
- **Yeni:** Simetrik (kuzey-güney ayna, adil) 3-mevzi haritası. 3 nokta birer AÇIK güçlü-mevzi, etrafları araziyle çerçeveli. Orta hat sırtları (1290/2110) 3 şeride ayırır; merkez muhafız dağları (1700,±); sol/sağ şerit dağları; kanat + köşe ormanları. Tüm noktaların araziden açıklığı OTOMATİK doğrulandı.

### 10.2 — Hedef AI mimarisi: "TERRITORIAL DILEMMA COMMANDER" (TDC)
6 uzman tasarımı → 3 jüri → sentez. Jüri en yükseğe "Bölge-Odaklı Hibrit"i koydu (fizibilite 9-10, tutarlılık 9). NN değer-ağı ve canlı-rollout (HORIZON) ELENDİ: brain.js sadece JSON genom, global-değişken mimarisi ayrık sim-instance'a izin vermiyor → saf-JS NN+SGD veya rollout aşırı riskli/pahalı. **NN YOK, GPU YOK, rollout YOK** — mevcut boruları (genetik + Foresight + SelfPlay) DOĞRU hedefe oturt.

**Turtle'ın 2 direği, TDC ikisini de çökertir:**
- Direk 1 "beklemek bedava" → **Katman 1+2** yıkar: self-play arenası VP simüle etmiyor + director VP okumuyor (DOĞRULANDI). VP'yi fitness'a + stratejik duruşa kat → "bekleme = puanla kaybetme" cezalanır → insan savunmadan çıkmaya zorlanır.
- Direk 2 "yığılı ateşi tek hedefe odaklama" → **Katman 3** (Pin-Punch çift-eksen) fiziksel böler: pin düşman ateşini kilitler, punch boşalan omuza iner; ≥1.5× yerel-üstünlük kapısı kuvvet-bölme intiharını önler; STRIKE zamana değil ÖLÇÜLEN ateş-kaymasına bağlı (insan OODA gecikmesini istismar).
- **Katman 4:** FORESIGHT_CALIB sabitleri elle değil, VP-bilinçli self-play residual'ından öğrenilir. Yeni genler: pinRatio, punchLocalSuperiority, vpPressureWeight, staggerSeconds, reactiveFeintBias. spBuildOpponents'a sentetik TURTLE rakibi.

**Panelin yakaladığı GERÇEK BUG:** spRunMatch snap'i (SelfPlay.js ~106-113, 222-234) controlPoints/vpScore'u yedeklemiyor → VP eklenince canlı oyun bölge durumu bozulur. Faz 1'de kapatılmalı.

**Yol haritası (Faz 0→6):** 0 teşhis · 1 arena VP-hizalama (EN YÜKSEK ROI, tek-değişken test) · 2 bölge-bilinçli duruş · 3 influence-gradyan + yerel-üstünlük kapısı · 4 çift-eksen ikilem + olaya-bağlı STRIKE · 5 kalibrasyon + gece eğitim · 6 gerçek insana karşı doğrulama.

**En büyük riskler:** pin/punch senkron kayması (azaltma: STRIKE olaya bağlı); insan puanı feda edip yine turtle (çift-eksen tek umut); kalibrasyon temeli (Faz 1 ön-koşul).

### 10.3 — UYGULANDI: Faz 1+2 (kademeli, kullanıcı kararı). VP temposu mevcut (~300sn) kaldı.
**Faz 1 — Hizalama (SelfPlay.js):**
- **Snap bug FIX:** spRunMatch artık controlPoints/vpScore/vpWinner'ı yedekler + finally'de geri yükler (panel'in yakaladığı canlı-oyun-bozma bug'ı kapatıldı).
- **Arena bölge sim:** maç deploy'undan sonra initControlPoints; her tick updateControlPoints. Artık eğitim VP simüle ediyor → AI noktalar için oynamayı öğrenir.
- **VP-öncelikli kazanan:** vpWinner varsa o kazanır; yoksa yok-etme; zaman aşımında önce tutulan bölge (vp farkı >60), sonra değer. VP eşiği maçı bitirir.
- **Fitness'a VP terimi:** hem spMatchFitness hem ana döngü `+ (redVp − blueVp) × SP_VP_WEIGHT(1.0)` (tutulan bölge × süre). Kuvvet-ekonomisi terimini korur.

**Faz 2 — Bölge-bilinçli duruş (LayeredAI.js):**
- update() bölge durumunu hesaplar: vpDeficit (geride miyim), vpOwn/vpEnemy/vpOpen → state'e.
- **AIStrategicDirector.decide:** bölgede geride + çekişilecek nokta varsa ADVANCE +2.4 / ENCIRCLE +1.4, ATTRITION −1.0 / REGROUP −0.8 → tempo baskısı (turtle'ı puanla zorla). pickTerritoryTarget hedefler, localExchange vetosu suicidal charge'ı önler.

**Sıradaki:** yeniden eğitim (artık VP-bilinçli arenada) → ölç (insanı-yenme oranı) → işe yararsa Faz 3 (çift-eksen Pin-Punch) + Faz 4 (kalibrasyon).

### 10.4 — Bölge boyut/tempo ayarı + UYGULANDI: Faz 3+4 (Pin-Punch + genler + turtle rakibi)
**Denge (kullanıcı geri bildirimi):** Bölgeler çok genişti + maç çok hızlı bitiyordu → `VP_POINT_RADIUS 340→250` (daha dar/odaklı bölge), `VP_TARGET 1500→3000` (maç ~2× uzun).

**Faz 3 — Pin-Punch (LayeredAI.js):**
- **PUNCH** (pickTerritoryTarget güçlendirildi): ana kuvvet artık en güçlü kümeye değil, **en ZAYIF savunulan çekişilebilir noktaya** yığılır (her nokta için yakındaki düşman değerini sayar, az olanı seçer; `punchFocus` geni eğilimi ayarlar). "Zayıf omuza vur."
- **PIN** (yeni dal, sadece topçu, pinMode≥3 düşman): topçu güçlü düşman kütlesini sabit bombardıman menzilinden (range×0.9) döver → **düşmanın ateşini kendine çeker**, punch serbest kalır. Düşman ateşi bölünür → eşit orduda yerel üstünlük (turtle'ın 2. direği çöker).

**Faz 4 — Adaptasyon (genler + eğitim rakibi):**
- **Yeni genler** (globals.js): `vpPressureWeight` [0.3–2.2] (bölge tempo şiddeti) + `punchFocus` [0.4–2.0] (zayıf-nokta eğilimi). Mutasyon/crossover otomatik kapsar → eğitim ayarlar. (Riskli "FORESIGHT_CALIB otomatik residual kalibrasyonu" şimdilik ELENDİ — mevcut çalışan dengeyi bozmasın; genler zaten adaptasyonu sağlıyor.)
- **Sentetik TURTLE rakibi** (SelfPlay.js spTurtleGenome): yüksek savunma/retreat/cohesion/lossAversion, düşük agresyon. spBuildOpponents'a eklendi; fitHuman'a sayılır → beyin **turtle'ı yenmeyi** öğrenir (insanın stratejisi). director VP tempo'su `vpPressureWeight` genini kullanır.

**Durum:** TDC Faz 1-4 mantığı yerinde (NN/GPU/rollout yok). Çift-eksen mantığı pin(topçu)+punch(zayıf nokta) olarak çalışıyor; influence-grid ve olaya-bağlı feint (en kırılgan kısımlar) sade bırakıldı, sonra eklenebilir. **Şimdi: yeniden eğit (VP+turtle arenası) → canlı test.**

---

## DURUM (İleriye-bakış danışmanı kuruldu — canlı test bekliyor)
- Duvar zaten kırık (kill çıkıyor). Asıl hedef artık: **eşit düelloda kaybetmemek.**
- Danışman, eşit kuvvette kazanmanın tek yolunu uyguluyor: Schwerpunkt (en ezilebilir kümeye yığıl) + muharebe disiplini (sadece matematik lehteyken gir, aleyhteyse tek kütle çekil).
- Hibrit'in YAVAŞ katmanı (gerçek-motor kalibrasyonu) henüz kurulmadı — şimdilik hızlı tahminci tek başına çalışıyor (FORESIGHT_CALIB elle ayarlı).
- **YENİ (Bölüm 7):** İnsan savunma oynuyor → AI artık charge etmiyor, topçuyla kuşatıyor. Charge zorlaması sabit düşmanda kapalı.
- Sıradaki test metriği: **AI charge edip ölmemeli; topçu sabit hattı dövmeli; takas oranı (AI kayıp / Oyuncu kayıp) 1500:40'tan çok daha dengeli olmalı.**

## KALAN YOL HARİTASI
1. ~~Sert odak~~ ✓ · ~~Mikro 3 konsantrasyon~~ ✓ · ~~Danışman (hızlı katman)~~ ✓ · ~~Turtle-karşıtı topçu kuşatması~~ ✓
2. **Canlı test** (turtle-karşıtı kuşatma): AI charge etmeyi bırakıp topçuyla dövüyor mu? `FORESIGHT_DEBUG` ile izle.
3. Hibrit YAVAŞ katman: gerçek-motor ile FORESIGHT_CALIB kalibrasyonu (SelfPlay).
4. Yeniden eğitim (genom danışmanlı zincire uyum).
5. Çözmezse: öğrenilmiş politika / kendi motor.
