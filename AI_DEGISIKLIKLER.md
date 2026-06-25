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

---

## BÖLÜM 11 — TAM SERBESTLİK KONSEYİ: TEMİZ SAYFA (Deterministik Motor + Öğrenilmiş Politika)
**Tarih:** 2026-06-25 · **Karar:** Baroque heuristik yığını "halüsinasyon" kaynağıydı → SÖK. AI = motordan-beslenen TEK öğrenilmiş fonksiyon olacak.
**Konsey:** 10 ajan (5 tasarım → 3 jüri → birleşik sentez), ~41 dk, 1M token. Kısıtlar kaldırıldı (TS/WASM/Node/CNN hepsi masadaydı) → konsey **bilinçle** vanilla-JS + küçük MLP + tarayıcı-içi eğitimi seçti (kullanıcı makinesinde `node` YOK, doğrulandı).

### Seçilen Mimari: "İnandırıcı Komutan / FORGE-Core" — 3 katman
1. **WORLD (saf veri state):** Tek nesne `{units, trenches, controlPoints, vpScore, vpWinner, phase, gameTime, tickCount, rng, redMoney, blueMoney}`. Global okuma YOK. Tüm görsel state (decals, craters, particles, screenShake, fog-display) ayrı `view` nesnesinde → rollout'ta hesaplanmaz (determinizm + 5-20x headless hız).
2. **ENGINE (saf-fonksiyon deterministik tick):** `step(world, cmdRed, cmdBlue) -> world'`. Sabit dt=64ms (SP_STEP), accumulator; render dt'den ve GAME_SPEED'ten TAM ayrı. Tek seedli PRNG (mulberry32). Fizik %85 KORUNUR (Unit.update, calculateUnitDamage, STATS, counter-matris, SpatialGrid, LOS, fog, ControlPoints) — sadece "nereden okuduğu" world-parametreye çevrilir. `serialize/deserialize/fork(world)` API'si → SelfPlay'in kırılgan global-yedek hilesi ölür; fork = rollout/self-play temeli.
3. **COMMANDER POLICY (TEK öğrenilmiş makro beyin):** Her ~400-500ms karar. **Birim-mikro İÇERMEZ** (süper-APM'i YAPISAL imkansız kılar + öğrenilebilir kılar).
   - **Gözlem (sis-içi, hilesiz, sabit-boyut):** global ego-vektör (~50 float) + 16x11x6 ızgara (dost/görülen-düşman etki, tehdit, bölge-sahipliği, arazi). ~1100 girdi. Fog gözleme DAHİL → "her şeyi bilen hile" imkansız, keşif gerçek değer kazanır.
   - **Aksiyon (sektör-soyut makro):** her sektör (3 kontrol noktası) için {postür: COMMIT/HOLD/SIEGE/WITHDRAW} × {schwerpunkt} × {kuvvet-tahsisi %} × {manevra: FRONTAL/FLANK/ENVELOP}. Deterministik **executor** (~150 satır) niyeti birim emrine çevirir; mikro = motorun var-olan birim-AI'si.
   - **Ağ:** küçük MLP ~30-50K param (CNN DEĞİL — jüri "gereksiz ağır" dedi). Elle-yazılmış saf-JS forward (<1ms). policy head + value head. Ağırlık tek JSON commit (`TRAINED_BRAIN` → `TRAINED_POLICY`).

### Neden halüsinasyon biter
5 postür × 11 doktrin × bandit × Foresight-veto × birim-veto = çelişen ~30 kural AYNI birime savaşan emir veriyordu. Yerine TEK politika → TEK çıktı + niyet histerezi → AI plana bağlanır, her tick fikir değiştirmez. **Tutarsızlık yapısal olarak ortadan kalkar.**

### Eğitim: İKİ AŞAMA (tarayıcı-içi)
- **Aşama A — İMİTASYON/BC:** Replay.js insan kayıtlarından gözlem→makro-niyet etiketi çıkar, küçük ağı saf-JS SGD ile fit et. TEK BAŞINA "insan-gibi + tutarlı + halüsinasyonsuz" ship-edilebilir taban verir.
- **Aşama B — SELF-PLAY İNCE-AYAR:** BC ağırlığından başla. **ASIL YOL = mevcut SelfPlay genetik/CMA-ES iskeleti, ağırlık-vektörü üzerinde** (gradyansız, kanıtlanmış, çalışan-beyin garantisi). Ödül = Telemetry net (enemyValueDestroyed − k×aiValueLost) + VP farkı (ZATEN doğru). KL(imitasyon) cezası → uzaylı-optimal'den frenler. Saf-JS PPO OPSİYONEL/riskli. Lig: champion + turtle + aggressive + insan-replay.

### İnsan-gibilik (6 yapısal mekanizma)
(1) komutan-APM ~2-3 karar/sn, (2) imitasyon tohumu, (3) reaksiyon-gecikme buffer 150-300ms, (4) sis-içi gözlem, (5) niyet histerezi, (6) stokastik örnekleme (argmax değil → blöfe açık). Üstünlük refleksten değil KARARDAN gelir.

### SÖKÜLECEK (~3500-4000 satır baroque heuristik = halüsinasyon kaynağı)
- **LayeredAI.js TAMAMI** (2045 satır: 5-postür director, squad planner KARARı, arbiter, bandit, 40-dallı zincir) — slotFor niyet→birim çevirisi executor'a sadeleşir.
- **Foresight.js TAMAMI** (282 satır: Lanchester danışmanı + birim-vetosu) → öğrenilmiş value-head içselleştirir. forceRatio GÖZLEM-ÖZELLİĞİ olarak kalır.
- **AI.js'teki İKİNCİ MOCK MOTOR** (satır ~657-1601: createSimUnit/simulateSpatialMetaMatch/moveSimUnit/applySimAttack) → SİL. *Bu, eğitim≠canlı tutarsızlığının KÖK TEKNİK NEDENİ — eğitim gerçek Unit.update yerine SAPAN ikinci fizikte koşuyordu (eğitim "yalan söylüyordu").*
- aiGenome.tacticGenes (28 knob) + counterMatrix/deployMatrix + brain.js TRAINED_BRAIN → öğrenilmiş ağırlık. Genetik mutasyon/crossover iskeleti KORUNUR ama hedef ağırlık-vektörü olur.

### KORUNACAK (sağlam çekirdek ~3000 satır)
TÜM render (zaten sim'den ayrık) · Unit FİZİĞİ/combat/morale/terrain · STATS + calculateUnitDamage + counter-matris (denge İYİ — sorun denge değil AI'ydı) · SpatialGrid/LOS/fog · ControlPoints/VP (turtle-kırıcı, reward'a beslenir) · Telemetry (RL ödülü birebir) · Replay.js (imitasyon ALTINI) · TacticalAI saf matematiği (gözlem-özelliği üreteci) · SelfPlay tick-iskeleti + genetik-lig.

### Yol Haritası (her faz OYNANIR oyun bırakır — strangler + köprü)
- **FAZ 0 — DETERMİNİZM** (pazarlık dışı, ~2-3 gün): mulberry32 rng; ~45 gameplay Math.random → rng, ~18 VFX → view; gameLoop wall-clock dt → sabit 64ms accumulator. **ALTIN TEST:** aynı seed → spRunMatch iki kez bit-aynı (hash eşit).
- **FAZ 1 — WORLD nesnesi + saflaştırma:** global okumaları world-parametreye çevir (proxy-then-delete); render/decal → view. `step()` ortaya çıkar. Canlı oyun bit-aynı oynamalı.
- **FAZ 2 — FORK API + Worker rollout:** serialize/fork + clone-eşitlik altın testi; SelfPlay global-snapshot → fork; Web Worker paralel headless.
- **FAZ 3 — BAROQUE SÖK + executor + gözlem + strangler flag** (`AI_BACKEND={'layered','policy'}`): LayeredAI/Foresight/AI.js-mock devreden çıkar; gözlem-üreteci + executor + köprü scripted-niyet stub yaz. *'Aptal-ama-temiz' AI ile ara-ship edilebilir (regresyon-güvenli durak).*
- **FAZ 4 — İMİTASYON/BC (İLK GERÇEK SHIP):** Replay → gözlem→niyet etiketleri; MLP tarayıcı-içi fit; TRAINED_POLICY JSON; policy varsayılan, layered fallback.
- **FAZ 5 — SELF-PLAY İNCE-AYAR:** genetik/CMA-ES ağırlık üzerinde; ödül=Telemetry net+VP; value head; lig; gece-eğitim UI'sine bağla.
- **FAZ 6 — İNSANLAŞTIRMA + KESİN SÖKÜM:** reaksiyon-gecikme, stokastik örnekleme, 2-3 kişilik ağırlığı, DAgger-lite; playtest; LayeredAI/Foresight/mock kesin SİL; ENGINE'i `simulateBattle(armyA,armyB,map,seed)->outcome` saf-fonksiyon olarak paketle (büyük strateji oyununun yeniden-kullanılabilir taktik kütüphanesi).

### Dürüst Fizibilite
Ulaşılabilir ama "tek hafta sonu" değil — solo için **~5-9 hafta akşam-mesaisi**. ASIL MALİYET AI değil **MOTOR SAFLAŞTIRMASI** (global→world refactor). İyi haber: SelfPlay zaten gerçek Unit.update'i headless koşuyor → sıfırdan motor yazmıyoruz, var-olanı parametrize ediyoruz. GPU GEREKMEZ. En düşük-risk yol: **imitasyon-first** (BC tek başına ship-edilebilir taban).

### En Büyük Riskler
1. **Determinizm sızıntısı** (tek kaçırılan random/dt → fork sapar → öğrenme çöker) → Faz 0 bit-aynı altın test zorunlu.
2. **Motor saflaştırması** sıkıcı + sessiz davranış kayması (test YOK) → kademeli proxy-then-delete, her faz oynanır.
3. **Replay azlığı** (REPLAY_MAX=10, tek oyuncu) → BC prior'ı ince; daha çok/çeşitli replay + DAgger + self-play.
4. **Süper-insan sızması** → aksiyon-uzayı birim-emir İÇERMEZ (yapısal engel).
5. **Solo kapsam-kayması** (en olası başarısızlık: TS/WASM/CNN/MCTS/oyun-yeniden-tasarım cazibesi) → vanilla-JS + MLP + tek-politika disiplini; oyun-temeli değişiklikleri AYRI sürüme ertele.

**Durum:** Mimari onaylandı. Kullanıcı kararları: **(1) İlk hedef = Faz 3** (baroque'u sök → temiz/basit AI ship, öğrenme sonra) · **(2) Node'a açık** (self-play hızlandırması ileride) · **(3) Daha çok/çeşitli replay** toplanacak (Faz 4 imitasyon) · **(4) Oyun-temeli sonraya, ayrı sürüm.**

---

### ✅ FAZ 0 — DETERMİNİZM (TAMAMLANDI, canlı altın-test onayı bekliyor)
**Hedef:** Sim tekrarlanabilir olsun → eğitim ödül-gürültüsü bitsin (konseyin #1 riski) + Faz 2 fork'un temeli.

**Kritik içgörü (kod-okumayla doğrulandı):** Sim-yolu zaten neredeyse deterministik —
- AI karar yolu (LayeredAI/Foresight/TacticalAI) **0 Math.random**, **0 duvar-saati** → zaten deterministik.
- Birim **per-tick** yolu da random'sız; tek gameplay-random'lar **deploy/yapım-anı + olay-anı** (panik-kaçış hedefi, ikmal-düşüşü).
- Yani headless maç determinizmi için tek gereken: **bu birkaç random'ı seedlemek.** (Sabit-tick canlı gameLoop'ta GEREK YOK — headless zaten SP_STEP sabit-cadence; live-tick his-riskli, ayrı Faz 0b'ye bırakıldı.)

**Yapılanlar:**
1. **`globals.js`** — deterministik sim-RNG eklendi: `SIM_RNG = {state}` + `resetSimRng(seed)` + `srand()` (mulberry32, durumu tek 32-bit tamsayı → serialize/fork kolay) + `srandRange/srandInt` yardımcıları. Faz 1'de `world.rng`'ye taşınacak.
2. **Sim-yolu `Math.random()` → `srand()`** (~17 site): Unit.js (scanTimer, panik-kaçış hedefi) · Support.js (ikmal-düşüş x2) · SelfPlay.js (ordu-üretimi x4) · AI.js (gerçek deploy jitter x7 + gerçek AI hareket jitter x6). **Render-only KALDI** (track/blood decal, hit-spark, screen-shake) — sime girmez.
3. **`SelfPlay.spRunMatch`** — yeni `matchSeed` parametresi: verilirse `resetSimRng(seed)` → **bit-aynı maç**; verilmezse otomatik-ilerleyen seed (eğitimde çeşitlilik, baştan tekrarlanabilir). `SIM_RNG.state` snap'e yedeklenip finally'de geri yüklenir (canlı oyun bozulmaz).
4. **`SelfPlay.spGoldenTest(seed, runs)`** — konsol altın testi: aynı seed → N koşu, çıktılar birebir eşit mi? `✅ GEÇTİ` / `❌ KALDI`.
5. **`main.js startBattle`** — `resetSimRng(Date.now())` (canlı çeşitlilik; sabit sayı verilirse tekrarlanabilir maç).

**Dokunulmadı (kasıtlı):** AI.js genetik mutasyon/crossover (536-638) + champion/exploration (1970-2076) → maçlar ARASI evrim, kasıtlı stokastik. AI.js mock-motor (657-1601) → Faz 3'te zaten silinecek. globals.js:467 deployMatrix-init → genom-yapım anı, maç-içi determinizmi etkilemez.

**Doğrulama:** Sözdizimi sağlam (HEAD ile birebir aynı paren/brace dengesi; sadece dengeli paren-çiftleri eklendi). **Canlı onay:** tarayıcıda oyunu aç → F12 konsol → `spGoldenTest()` çalıştır → `✅` görmeli.

**Sıradaki:** Faz 1 (world nesnesi + global→world saflaştırma).

**Eski TDC durumu (Bölüm 7-10):** Faz 0 ile birlikte bu heuristik katman Faz 3'te SÖKÜLECEK. O zamana kadar canlı AI olarak kalır (geçişte oynanabilirlik korunsun diye).

---

### 🔧 FAZ 1 — WORLD NESNESİ + SAFLAŞTIRMA (DEVAM EDİYOR)
**Kullanıcı seçimi:** altyapı-önce (konsey sırası Faz 1→2→3). Sağlam/temiz temel. Doğrulama: tarayıcıda `spGoldenTest()` her chunk'tan sonra yeşil kalmalı + canlı oyun bit-aynı oynamalı.
**Yöntem:** proxy-then-delete, küçük güvenli alt-adımlar. `world.units === units` (alias) olduğu için sim-fonksiyonlarını `world` parametresine çevirmek davranışı DEĞİŞTİRMEZ (aynı diziyi okur) — ama fonksiyonu singleton-global'den koparır → Faz 2 fork'un forklanmış world üzerinde çalışmasını sağlar.

**Alt-adım planı:**
**⚠️ İSİM KARARI:** Konteyner **`SIM`** olarak adlandırıldı, `world` DEĞİL. Sebep: main.js'te her event handler'da yerel `const world = screenToWorld(...)` (koordinat, `.x`/`.y`) var → global `world` ile çakışır (TDZ + yanlış-nesne bug'ı, özellikle 1d'de `phase→world.phase` yapınca patlar). `SIM` çakışmasız.

- ✅ **1a — SIM iskeleti + rng (BİTTİ):** `globals.js`'te `const SIM = { rng:{state}, ... }`; `SIM_RNG = SIM.rng` (geri-uyumluluk aliası); `resetSimRng` artık `SIM.rng.state` yazar. `SIM.units`/`SIM.trenches` alias bağlandı (const diziler, reassign yok → güvenli). Davranış birebir aynı.
- ✅ **1c — controlPoints/vpScore/vpWinner → SIM canonical (BİTTİ):** ControlPoints.js'teki tanımlar SIM'e taşındı; 4 dosyada (ControlPoints/LayeredAI/SelfPlay/main) ~39 okuma word-boundary regex'le `SIM.*`'a çevrildi (büyük/küçük-harf duyarlılığı fonksiyon adlarını korudu; negatif-lookbehind çift-prefix/property-çakışmasını önledi). Reassign-alias hazardı bitti. Denetim: kalan çıplak token YOK, `SIM.x/.y` çakışması YOK, brace/paren dengesi HEAD ile birebir aynı.
- ✅ **1g — birleşik `stepSim()` (BİTTİ, sıra atlandı — en yüksek değer):** gameLoop ve spRunMatch'teki DUPLİKE tick gövdesi tek `stepSim(now, dtSec, driveAI, spawnDeathVfx)` fonksiyonunda birleşti (main.js'te tanımlı; ikisi de çağırır). Fizik sırası birebir korundu: trenches→grid→units.update→collisions→driveAI→controlPoints. AI/komut sürücüsü step'in DIŞINDAN (canlı: `updateLayeredAI`; eğitim: 2 controller/replay). **→ "eğitim ≠ canlı" kök-sorunu yapısal olarak bitti** (eğitim artık birebir oynanan oyunu öğretir). Tek ihmal-edilebilir fark: canlıda updateControlPoints 1 tick erkene kaydı (artık support/telemetri'den önce; ama canlı=eğitim tutarlı).
- ⏭️ **1d — phase/gameTime/money → SIM (ERTELENDİ, düşük değer):** İçgörü: bunlar her-tick fizik DEĞİL, rollout boyunca SABİT (phase=BATTLE, bütçe deploy-anı sabiti, gameTime neredeyse ölü). Fork'un ihtiyacı olan her-tick mutable fizik state'i ZATEN SIM'de (units/trenches/controlPoints/vp/rng). Primitifleri her okuma-yerinde taşımak yüksek-risk/düşük-değer + string-ID tuzakları (`'phase-text'`) → Faz 2 serialize'da sınır-skaleri olarak yakalanacak, read-migration YOK.
- ✅ **1e — sim-çekirdeği SIM.* okur (BİTTİ, hayatta-kalan substrat):** **Tasarım kararı: param-threading DEĞİL, global `SIM.*` okuma (Option A).** Sebep: derin metod-ağacını (`this.findBestVisibleEnemy` vb.) param'la threadlemek kör/riskli; global-SIM okuma aynı fork'u "SIM.units swap" modeliyle sağlar (SelfPlay/Worker'ın zaten kullandığı). Çevrilenler: `SIM.spatialGrid` eklendi · Unit.js (update tree + resolveCollisions + placeUnit: units×6, spatialGrid×6, trenches×2) · ControlPoints.updateControlPoints (units) · globals.canSee + checkLineOfSight (units + spatialGrid) · main.stepSim/updateTrenches · Support paraşütçü. **Denetim:** çift-prefix YOK, brace dengesi HEAD ile birebir, hayatta-kalan kodda bare-units kalmadı.
  - **ÖLÜ-KOD ATLANDI (bilinçli):** LayeredAI(2)/AI.js-battle(2)/Foresight(.units property'leri, global değil) → Faz 3'te SİLİNECEK. Bunlar snapshot-restore modeliyle çalışır (global units mutate, fork değil) → SIM'e çevirmek BOŞA emek. Gerçek eş-zamanlı fork Faz 3-sonrası yeni politikayla (o baştan SIM.units okur).
- ✅ **1f — render-only VFX rollout'ta atlanır (BİTTİ):** `SIM.headless` bayrağı eklendi (false canlı, true rollout). `spawnExplosion`/`spawnHitSparks`/`spawnTracer` (VFX.js) headless'te erken-return → particle/spark/tracer hesaplanmaz (hız + sim/view ayrımı). spRunMatch `SIM.headless=true` set/restore eder (snap'e yedekli). Sim determinizmi etkilenmez (VFX ayrı Math.random akışı). Render'ın geri kalanı (drawMap/particles/fog) zaten stepSim dışındaydı. Kalan inline decal-push'lar ucuz + maç sonrası temizleniyor (kabul edilebilir).

**Durum — FAZ 1 ÖZÜNDE TAMAMLANDI:** 1a✓ 1c✓ 1e✓ 1g✓ 1f✓ (1d ertelendi düşük-değer; ölü-kod SIM-dönüşümü Faz 3 silmesiyle doğal biter). Kazanımlar: **determinizm + SIM tek-konteyner + birleşik stepSim (eğitim=canlı) + render/sim ayrımı.** Sağlam temel.

---

### 🔧 FAZ 2 — TEMİZ SNAPSHOT/RESTORE (çekirdek BİTTİ)
- ✅ **snapshotSIM() / restoreSIM(s)** (SelfPlay.js) — SelfPlay'in elle-bakımlı 14-alanlı snap nesnesi + dağınık restore bloğu TEK fonksiyon çiftine taşındı. spRunMatch artık `const snap = snapshotSIM()` + `restoreSIM(snap)`. **Konseyin işaret ettiği "controlPoints'i yedeklemeyi unuttu → eğitim canlıyı bozdu" bug-sınıfı yapısal olarak imkansız** (tek doğruluk kaynağı). Davranış birebir aynı (golden test korunur).
- ⏭️ **Ertelendi (ihtiyaç olunca, Faz 5 eğitim):** JSON serialize/deserialize (Worker'a state geçişi) + deep-clone fork (eş-zamanlı rollout/MCTS — opsiyonel). Bunlar Unit-yeniden-yapımı gerektiriyor (delicate) → gerçek Worker-eğitimi kurulurken yapılır, spekülatif değil.

**Durum:** Faz 2 çekirdeği (temiz snapshot) tamam. Kalan Faz 2 (serialize/fork) eğitim zamanına ertelendi.

---

### 🎯 FAZ 3 — BAROQUE SÖK + TEMİZ KOMUTAN (İLK SHIP HEDEFİ — halüsinasyonun öldüğü yer)
**Kullanıcı seçimi:** komutan davranışı = **kuvvet-ekonomisi + bölge** (kendi felsefesine sadık). Strangler yöntemi (eski AI fallback kalır, flag'le geçiş).

- ✅ **3a — `AI_BACKEND` flag (BİTTİ):** globals.js `let AI_BACKEND = 'layered'` (varsayılan/fallback) | `'policy'` (yeni komutan). Konsol toggle: `useCleanAI(true/false)`. updateLayeredAI dispatch eder (LayeredAI.js): policy ise `commanderDrive(true, now)`, değilse `layeredAI.update(now)`.
- ✅ **3b+3c+3d — TEMİZ KOMUTAN (`js/Commander.js`, BİTTİ):** Baroque ~30 çelişen kural yerine **TEK tutarlı zincir**: gözlem (SİS-İÇİ, hilesiz: yalnız `canSee`) → makro niyet (schwerpunkt, **histerezi** 1.5sn → plana bağlı, her tick fikir değiştirmez) → executor (birim emri). Mantık:
  - **Schwerpunkt:** en değerli + EN ZAYIF SAVUNULAN çekişilebilir nokta (kuvvet ekonomisi: zayıf omuza yığ; `enNear*K` cezası).
  - **Topçu:** standoff bombardıman (menzil avantajı korunur, charge yok; çok yakınsa geri kayar).
  - **Kuvvet-ekonomisi vetosu:** yerel takas aleyhte (`enLocal > myLocal*1.5`) → yalnız ölme, üsse çekil (KITE).
  - **İlerle:** schwerpunkt'e yığıl + yakın temasta odak ateş (Lanchester). Deterministik yayılma (üst üste binmez).
  - 7 fonksiyon, ~150 satır, NN/genom YOK (scripted). Faz 4'te gözlem/executor aynen korunup KARAR öğrenilmiş policy+value head'le değişecek.
- ✅ **Yükleme:** `Commander.js` index.html + oyna.html'e eklendi (LayeredAI'den sonra). `pixel-rts-tek-dosya.html` (tek-dosya transfer) ESKİ kaldı → gerekirse yeniden derlenmeli; şimdilik index.html kullan.
- ✅ **3e — CANLI TEST GEÇTİ:** Kullanıcı: "her şey iyi, **aptallık bile yok**." Temiz komutan tutarlı + mantıklı oynuyor → **halüsinasyon yapısal olarak GİTTİ.** Temiz-sayfa tezi doğrulandı.
- ✅ **3f — VARSAYILAN 'policy' (BİTTİ):** `AI_BACKEND='policy'` artık varsayılan → canlı oyun temiz komutanı kullanır (konsol komutu gerekmez). `useCleanAI(false)` ile eski karşılaştırılabilir. **İLK SHIP HEDEFİ ULAŞILDI: tutarlı, halüsinasyonsuz AI canlıda.**
- ⏳ **Kalan söküm (Faz 6'ya):** LayeredAI/Foresight/AI.js-mock SİLİNMESİ eğitim sonrası. SEBEP: eğitim (SelfPlay) hâlâ LayeredAI genom kullanıyor + AI.js mock-motor (evaluateLeague→simulateSpatialMetaMatch) eski genetik yolda canlı. Önce Faz 4 (öğrenilmiş politika) → eğitim yeni beyne geçince güvenle silinir (~3500 satır).

**Durum — FAZ 3 İLK SHIP ULAŞILDI:** Canlı AI = temiz komutan (kuvvet-ekonomisi + bölge), tutarlı, halüsinasyonsuz, varsayılan. Eski baroque flag'le fallback.

---

### 🧠 FAZ 4 — KOMUTANI ÖĞRENMEYLE GÜÇLENDİR
**Kullanıcı kararı:** Faz 4 öğrenme (imitasyon + self-play). İnce-replay gerçeği → **self-play-önce** (strength hemen), imitasyon sonra.

- ✅ **4a — Komutan parametrize edildi (BİTTİ):** Commander.js'teki 12 karar-sayısı (`schwerpunktK, vetoK, massR, nearR, wNotOwned, wEnemyOwned, wMyNear, wDist, standoff, artyRange, focusR, decisionMs`) → öğrenilebilir `commanderGenome` (varsayılan = Faz 3'te çalışan el-ayar → davranış birebir aynı). `COMMANDER_GENE_LIMITS` (mutasyon sınırları). `commanderReset()` maç başına histerezi sıfırlar (startBattle + spRunMatch'e bağlı). Runtime state (schwerpunkt) gen'den ayrı.
- ✅ **4b — Komutan self-play eğitimi (BİTTİ, SelfPlay.js):** `spRunCommanderMatch(redGenes, blueGenes)` — İKİ TARAF DA temiz komutan (genome-swap), GERÇEK stepSim fiziği, RED açısından net döner. `spEvalCommander` (N-maç ortalaması), `mutateCommanderGenes` (sınır-içi). **`spTrainCommander(epochs, pop, matches)`** — champion'ı mutasyonlarla yen, en iyiyi al; setTimeout-batched (tarayıcı kilitlenmez); bitince `commanderGenome` (CANLI) güncellenir + genomu konsola yazar. Ödül = kuvvet ekonomisi (blueLost−k×redLost) + VP. **İnsan-gibi kalır** (yapı sabit: sektör-makro, süper-APM yok; sadece sayılar evrilir).
- ✅ **4c — İLK EĞİTİM ENTEGRE (BİTTİ):** Kullanıcı `spTrainCommander()` çalıştırdı → evrilmiş genom Commander.js DEFAULT_COMMANDER_GENES'e KALICI yazıldı. Eğitim yönü doğru: `wMyNear` 0.4→0.089 (olduğu yere değil ZAYIF-noktaya yığ), `schwerpunktK` 1.5→1.77 (zayıf omuza sert), `nearR/focusR`↓ (sıkı odak), `decisionMs` 1500→1804 (kararlı). Kuvvet-ekonomisi keskinleşti.
- ✅ **4c+ — TURTLE RAKİP (anti-savunma, BİTTİ):** `TURTLE_COMMANDER_GENES` (yüksek vetoK/schwerpunktK, savunmacı) eklendi. `spEvalCommander` çok-rakipli (dizi); `spTrainCommander` artık **mirror + turtle**'a karşı eğitir → kullanıcının ASIL stratejisini (savunma — "hattımı koruyarak yeniyorum") kırmayı öğrenir. Yeniden eğitim → anti-savunma genomu.
- ⏳ **4d (sonra):** imitasyon (kullanıcı replay'lerinden insan-tarzı tohum) + ileride tam MLP.

**Doğrulama:** Tüm dosyalar düzgün tokenizer ile (0,0,0). (Regex brace-checker Türkçe apostrof'ta yanlış alarm → tokenizer kullan.)

**Durum:** Komutan self-play eğitildi + kalıcı + turtle-rakip eklendi.

- 🔴 **PLAYTEST 1 (kullanıcı):** Oyuncu kazandı. AI **tüm ordusunu kaybetti (1500 vs 670)**, **%68 boşta** (201/296 sn), reward −7313. Kullanıcı teşhisi (isabetli): *"tek hedefi bölge ele geçirmek, benimle savaşmayı öğrenmemiş."*
- ✅ **KOMUTAN v2 — SAVAŞ-ÖNCELİKLİ + KONSANTRASYON (BİTTİ):** Eski sürüm bölge-saplantılı + per-birim veto üsse kaçış → dağılma + boşta + piecemeal ölüm. Yeni mantık: **ORDU TEK YUMRUK.** Makro plan 3 mod (histerezi):
  - **ATTACK** (ownVal ≥ foeVal×`commitK`): düşman kütlesine yığ, EZ (kuvvet ekonomisi).
  - **REGROUP** (ownVal < foeVal×`regroupK`): kendi yarımıza TOPLU toparlan (dağılma/boşta yok).
  - **TERRITORY** (denge/temassız): en zayıf-savunulan değerli noktayı al (turtle-kırıcı, ikincil).
  - Executor: tüm ordu plana **sıkı yumruk** olarak yığılır (`spread` küçük → Lanchester), yakın temasta odak ateş; topçu standoff. Per-birim üsse-kaçış KALDIRILDI (global mod toparlanmayı yönetir).
  - Genler yeniden: `commitK, regroupK, spread` eklendi; `vetoK, massR, wMyNear` çıktı. 12 gen, DEFAULT==LIMITS, ölü-gen yok, balance (0,0,0). Turtle güncellendi (commitK 2.0 = sadece ezici üstünlükte saldırır).
- ⏳ **PLAYTEST 2 bekliyor:** reload → `spTrainCommander()` (v2 + turtle) → oyna: artık SAVAŞIYOR mu (yığılıyor, düşmanı yok ediyor, boşta↓)?

**Not:** Eski trained genom (v1 mantığı) geçersiz; v2 DEFAULT el-ayar, yeniden eğitilecek.

---

### 🎖️ FAZ 5 (zenginleştirme) + FAZ 6 (insanlaştırma) — DEVAM
**Kullanıcı mandası:** sırasıyla Faz 6'ya kadar her detay; sonra KONSEY ile genel tarama → doktrin/formasyon ekle ("ne topak ne dağınık, gerçek askeri operasyon"). *Formasyon/doktrin = konseyin işi (Faz 6 sonrası).*

- ✅ **Faz 5 — Self-play zenginleştirme (BİTTİ):** Eğitim rakipleri artık **mirror + TURTLE (savunmacı) + AGGRO (saldırgan)** → exploit-dirençli, hem anti-savunma hem anti-baskı öğrenir.
- ✅ **Faz 6 — İnsanlaştırma kısım-1 (BİTTİ):** (a) **Kişilikler** (`COMMANDER_PERSONALITIES`: dengeli/agresif/temkinli; `commanderSetPersonality('agresif')` — maç çeşitliliği). (b) **Stokastik karar** (`COMMANDER_DECISION_JITTER ±%6`): commit/regroup eşiklerine srand-jitter → robotik-optimal değil, blöf/keşif-aldatması işler. srand → eğitimde deterministik, canlıda çeşitli.
- ⏳ **Faz 6 — kısım-2 (SIRADA, dikkatli):** baroque SİLME (LayeredAI 2045 + Foresight 282 + AI.js-mock ~950 + SelfPlay'in LayeredAI-genom eğitimi). RİSK: geri-dönülmez (git-kurtarılabilir) + runtime test edilemez (asistanda JS motoru yok). Yöntem: her sembolü grep-doğrula, FORESIGHT_CALIB inline'la, fallback'i kaldır, eğitim UI'sini komutana yönlendir; sonra kullanıcı smoke-test (reload → konsol hatasız + maç akıyor mu).
- ⏭️ **Faz 4d (imitasyon/MLP) ERTELENDİ:** ince replay verisi (kullanıcı az oynadı) + konseyin yakında mimariyi değiştireceği (doktrin/formasyon) → şimdi yapmak erken/israf. Replay biriktikçe + konsey-sonrası mimaride yapılacak.

**Durum:** Komutan v2 (savaş-öncelikli) + insanlaştırılmış (kişilik+stokastik) + 3-rakipli self-play.

---

## BÖLÜM 12 — KONSEY 2: AI-vs-İNSAN SEVİYESİ (all-arty yenilgisi + counter-deploy + doktrin)
**Tetik:** PLAYTEST 2 — v2 TAMAMEN-TOPÇU orduya KAYBETTİ (1500 kayıp / düşmana 0 öldürme / %77 boşta). Kullanıcı: "all-arty alınca AI kazanamıyor; tek-tip→AI counter alsın, çeşitli→çeşitli; ne topak ne dağınık gerçek askeri operasyon." Ultracode AÇIK → 6-lens konsey (teşhis→tasarım→adversarial doğrulama), 8 ajan.

### 8 KÖK-NEDEN (konsey)
1. **DEPLOY:** all-arty'ye özel counter dalı YOK; armor=0 olunca dallar atlanır → zayıf counterMatrix'e düşer (o da ters: INFANTRY/ENG > RECON/MECH).
2. **KOMUTAN:** foeVal = HAM cost×hp, matchup-kör → all-arty foeVal şişer → ne ATTACK ne REGROUP, idle.
3. **MOTOR+KOMUTAN:** spread(70) < ARTILLERY_SPLASH(165) → tek yumruk = splash kill-box; bastırma+panik yumruğu dağıtır (%77 boşta).
4. **KOMUTAN:** REGROUP noktası (WORLD_H×0.34) düşman topçu menzili İÇİNDE → kör+idle ölüm.
5. **MOTOR:** topçu vision(300) < range(350) → spotter yoksa kör.
6. **BRAIN:** counterMatrix[8] ters öğrenmiş.
7. **KOMUTAN:** isArty eşiği ARMOR/AT'yi de standoff yaptırıyor (kapatmaları gerekirken).
8. **DEPLOY:** monoculture (tek-tip) sinyali ölçülmüyor.

### ADVERSARIAL DOĞRULAMA (verdict: "kısmen" — rafine şart)
Yetenekli insan sömürüleri: (a) **deploy determinizmi** (karma ordu kurup eşik-altı kalır), (b) **RUSH tuzağı** (sahte-topçu yemi + gizli AT/zırh kill-box; RUSH iptal-yoksa intihar), (c) splash 200px hâlâ öldürür, (d) **spotter tek-nokta-arıza** (RECON avla → AI körleşir), (e) matchup-indirim over-commit. Eksik: ammo/reload, lojistik, terrain, ev-sahası görüş asimetrisi. **Kritik rafineler:** RUSH'a İPTAL ekle · indirim sadece KORUMASIZ topçuya · spotter çoğalt/koru · sıralı doğrula (11 değişiklik birden GİRME).

### UYGULAMA — SIRALI BATCH'LER (adversarial protokol: her batch ayrı test)
- ✅ **BATCH 1 — Komutan all-arty yetkinliği (BİTTİ, Commander.js v3):**
  - **Matchup-foeVal** (`cmdrThreatValue`): korumasız kırılgan-topçu (range>300 & hp<160, yakında dost-muhafız YOK) `artyThreatDiscount`×0.5 indirilir → all-arty foeVal düşer, AI donmaz. *Korumalıysa tam değer (over-commit önlenir — adversarial rafine).*
  - **RUSH modu + PUSU-İPTAL:** foeArtyShare ≥ `rushArtyK`(0.45) → RUSH (topçu merkezine koş, commit eşiği 0.6). RUSH'ta foeThreat `ambushK`(1.6)× artarsa (gizli birlik açıldı) → İPTAL, güvenli REGROUP (*intihar değil — adversarial rafine*).
  - **Splash-kaçınan dağılım:** foeHasArty iken `artySpread`(195) > splash(165), altın-açı halka (kill-box olmaz; "ne topak").
  - **Güvenli REGROUP:** düşman ağırlık-merkezinden maxFoeRange+220 UZAĞA (menzil dışı).
  - **effRange standoff:** kendi topçusu min(range,vision)'a gelir (kör-idle biter). RUSH'ta her birim EN YAKIN topçusunu hedefler (doğal yayılma).
  - Yeni genler: artyThreatDiscount/rushArtyK/ambushK/artySpread (+limits+varyantlar). 16 gen, balance (0,0,0).
- ✅ **BATCH 2 — Counter-deploy (BİTTİ, js/AI.js + brain.js):**
  - **all-arty avcı paketi** (oransal, kompozisyon-farkında): `huntArtyStrength = artilleryRatio − 0.9×(armorRatio+antiTankRatio)`; >0.1 ise RECON spotter satın al + RECON/MECH/INF ağırlık ×şiddet. **Eşik DEĞİL oransal → "tam eşik-altı kal" sömürüsü kapalı.** Koruma-farkında: zırh varsa AT ekle, AT varsa zırhlı-piyade ekle (adversarial rafine).
  - **Monoculture tespiti:** `dominantRatio = maxCount/liveBlue`; ≥0.7 iken playerMeta hafıza katsayısı 0.4→0.1 (sahadaki saf tek-tip sinyali bulanmasın). Kullanıcı isteği: tek-tip→sert counter, çeşitli→çeşitli (mevcut counterMatrix mix korunur).
  - **brain.js counterMatrix[8]** düzeltildi: ters-öğrenilmiş [INF2.96>ENG2.59>...] → [RECON4.5>MECH3.6>INF2.4>...] (hızlı kapatıcılar üstte). JSON geçerli doğrulandı.
- ✅ **BATCH 3 — RECON gözcü rolü (BİTTİ, Commander.js):** RECON (vision>600 & range<200) artık öne ATILMAZ → ana kütlenin gerisinde (kendi tarafına 130px) yayık konumlanır, görüş sağlar, sadece dibindekine ateş eder. **Hayati görüş kaynağı hayatta kalır** (adversarial "spotter tek-nokta-arıza" rafine). Kalan Batch-3 (staggered-salvo, terrain-rota, ev-sahası baskısı) → sonraki tur / konsey-formasyon.

**Durum — BATCH 1+2+3 CANLI:** AI artık (a) all-arty'yi "kolay av" görüp donmaz + RUSH'lar (pusuda iptal), (b) all-arty'ne karşı RECON+MECH avcı ordusu deploy eder, (c) RECON'u gözcü olarak korur.

### ✅ PLAYTEST 4 SONUCU + ayarlar
- **Counter-deploy ÇALIŞIYOR** (kullanıcı doğruladı): all-arty'ye karşı AI **full RECON** seçti = "tek-tip→counter" vizyonu gerçek.
- **DENGE:** topçu çok güçlüydü → `STATS[ARTILLERY].atk` **25→20** (globals.js; açıklama da güncellendi).
- ✅ **EĞİTİM SENARYOSU (konsey egitimTasarim, BİTTİ):** SelfPlay'e `spAllArtyArmy()` + `spArtyHunterArmy()` + ordu-override eklendi; `spEvalCommander` artık her değerlendirmeye **1 all-arty senaryosu** (aday avcı-ordusu vs all-arty rakip) katıyor → komutan genleri (artyThreatDiscount/rushArtyK) topçu-RUSH'u EĞİTİMLE ustalaşır. Yeniden `spTrainCommander()` → topçu-counter optimize.

**Durum:** all-arty cephesi kapandı (deploy-counter + tactical-rush + denge + eğitim-senaryosu). Tüm dosyalar (0,0,0).

### 🔧 EĞİTİM SİSTEMİ DÜZELTİLDİ (kritik)
**Sorun:** UI eğitim butonları ("AI vs AI" vb.) `spStartTraining`'i çağırıyordu = ESKİ LayeredAI beynini (`aiGenome`) eğitiyordu. Ama canlı AI artık KOMUTAN (`commanderGenome`) → UI eğitimi **boşaydı** (hatta export edilse counter-fix'i bozardı).
**Çözüm:** UI butonları artık `spMenuTrainCommander` → **canlı komutanı** eğitir (hızlı 20 / orta 40 / uzun 80 epoch), progress ekranı gösterir, bitince **localStorage'a kaydeder**. Commander.js açılışta localStorage'dan yükler → **eğitim reload'da KALICI**. (Reset: konsol `localStorage.removeItem('cmdrGenome')` + reload.) Eski spStartTraining konsol-fonksiyonu olarak duruyor ama butonlardan kaldırıldı.

**Sıradaki:** konsey-formasyon + baroque temizlik.

---

## BÖLÜM 13 — KONSEY 3 (GENEL YAPI) + FAZ A (DÜELLO FİNALİ / MANEVRA DOKTRİNİ)
**Konsey 3 (10 ajan, "az çıktı değil"):** `OYUN_TASARIM.md` (661 satır) yazıldı — düello-finali + eğitim + oyunun GENEL YAPISI. **Tür kararı:** iki katman (dokunulmaz taktik düello çekirdeği + üstüne meta). **Kullanıcı kararları:** önce DÜELLO bitir (Faz A+B) → AI seni gerçekten yensin, sonra meta · AI insan-gibi-ama-güçlü (hilesiz) · meta = KALICI İMPARATORLUK (Risk-vari, sonra) · kalıcılık affedici. Adversarial verdict "kısmen" → en kritik uyarı: AI-insan-yener henüz KOD değil TASARIM + genom-uzayı çatlağı (eğitim ligi farklı uzayda).

### ✅ FAZ A — MANEVRA DOKTRİNİ (BİTTİ, Commander.js v4)
"Ne topak ne dağınık, gerçek askeri operasyon." Konsey skeletonu uygulandı:
- **ROL sistemi:** ANA-ÇABA(MAIN) + SABİTLEME(PIN: topçu/AT geride sabitler) + KANAT(FLANK: hızlı birimler zayıf yarıyı sarar) + YEDEK(RESERVE: kriz/temasta dökülür). `cmdrAssignRoles` karar-tickinde rol atar (titreme yok). **Over-engineer kalkanı:** RUSH/REGROUP'ta herkes MAIN (doğrulanmış tek-kütle korunur, regresyon yok); bölme yalnız ATTACK/TERRITORY.
- **Arazi-farkında effHP:** `cmdrThreatValue`'da siper(+coverTrench)/orman(+coverForest) düşmanı tehdit-değeri ÇARPILIR → AI siperdeki savunmacıyı "kolay" sanmaz, **frontal-suicide yerine KANAT'tan sarar** (turtle-counter, kullanıcının savunma-stilini kırar).
- **FLANK kırılgan-av:** kanat birimleri `attackTarget = en yakın cmdrFragileRanged` (düşman topçu/AT'ını yandan imha).
- **Zayıf-yarı tespiti:** düşman topağının dik-eksende az-değerli yarısına flankTgt.
- **YEDEK tetiği:** ATTACK'ta MAIN-referansı; `commitReserveK` oranında erirse yedek dökülür.
- **7 yeni gen:** coverTrench/coverForest/reserveShare/flankDepth/flankMinForce/pinStandoff/commitReserveK (+limits +TURTLE/AGGRO/kişilik override). Toplam 23 gen. balance (0,0,0).
- **Korundu:** RECON-gözcü, RUSH-iptal, all-arty matchup, effRange standoff, localStorage kalıcılık, insanlaştırma.

**TEST:** reload → özellikle SAVUNMA/siper oynayarak → AI artık seni frontal-charge yerine **kanatından sarıyor mu**, yedek tutuyor mu, topçuyla sabitliyor mu? (Adversarial: 1-2 maç YETMEZ, çok-maç doğrula.) Yeni genler eğitimle tunelenir (retrain).

**✅ PLAYTEST 6 SONUCU (kullanıcı):** "AI gayet iyi oynuyor, savunmada bekleyemiyorum — merkez+kanat tutmak için dağılmak zorundayım, bu da AI'nın işine geliyor." → **MANEVRA DOKTRİNİ + BÖLGE-BASKISI ÇALIŞIYOR: turtle stratejisi kırıldı, AI insanı kabuğundan çıkarıyor.** Konseyin "ev-sahası baskısı" hedefi tutturuldu.

### ✅ FAZ B-1 — PFSP-LİTE LİG (BİTTİ, SelfPlay.js)
Konseyin #1 riski "genom-uzayı çatlağı" (eğitim ligi AI.js'in farklı uzayında) → **komutanın KENDİ genom-uzayında lig kurarak SİDESTEP edildi** (LayeredAI ligini taşımak yerine). `cmdrHallOfFame` (geçmiş-şampiyon arşivi, localStorage'da kalıcı, seanslar-arası büyür) + `cmdrArchive` (dedup, çeşitlilik koru, tavan 12) + `cmdrClearHall`. Eğitim rakipleri artık mirror+turtle+aggro + **2 rastgele geçmiş-şampiyon** + all-arty senaryo → tek-şampiyon overfit'i kırılır, genom sağlamlaşır. Periyodik (8 epoch) + final arşivleme. balance (0,0,0).

### ✅ FAZ B-2 + B-3 — EXPLOITER + REPLAY-RAKİP (BİTTİ, SelfPlay.js)
- **Adil-kıyas düzeltmesi (B-0, kritik):** Eskiden her aday FARKLI rastgele ordu alıyordu → şanslı aday seçiliyordu (gürültü, etkisiz eğitim). Artık tüm adaylar + şampiyon AYNI epoch-senaryolarında ölçülür → **gerçek seçim** (eğitim artık genuine işliyor).
- **Exploiter** (`cmdrFindExploiter`): her 12 epoch'ta champion'ı EN ÇOK YENEN genom aranır → lige eklenir → champion kendi counter'larını da yenmeyi öğrenir (zayıflık-avı, exploit-dirençli).
- **Replay-rakip (imitasyon-adjacent):** `spRunCommanderMatch` artık `blueReplay` alır → mavi=İNSAN kaydı (gerçek oyunculuk), kırmızı=AI counter-deploy. `spEvalCommander` her değerlendirmeye **kullanıcının son replay'lerine karşı 2× ağırlıklı** maç katar → **AI senin GERÇEK oyunlarını yenmeyi öğrenir** (asıl insan-yen sinyali). Replay yoksa atlanır.
- Eğitim havuzu artık: mirror + turtle + aggro + lig(geçmiş-şampiyon) + exploiter + all-arty senaryo + **insan-replay**. UI menüsü hepsini kullanır. localStorage kalıcı.

**Durum — DÜELLO + EĞİTİM DOMAİN'İ TAMAMLANDI:** Faz A (manevra: ROLE/effHP/flank) + Faz B (lig + exploiter + replay-rakip + adil-kıyas). AI hilesiz, insan-gibi-güçlü.

---

## BÖLÜM 14 — AÇIK DÜNYA (PIXEL EUROPA) — KONSEY 4 + FAZ 0/1
**Konsey 4 (11 ajan, "az çıktı değil"):** `ACIK_DUNYA_TASARIM.md` (845 satır) — pixel-Avrupa, RPG-devletler, dünya-AI, ana ekran, Hızlı Maç, 4-çağ Hikaye, ekonomi/kalıcılık, MVP, yol haritası. **Çekirdek mimari:** meta düelloya SADECE 4 değer enjekte eder {bütçe, kişilik, gen-override, veteran} via saf `stateToBattleConfig` → DÜELLO ÇEKİRDEĞİ HİÇ DEĞİŞMEZ. Harita görsel-büyük (off-screen cache) ama mantık 12-40 düğüm graf (pathfinding yok). 4 çağ = TEK motor + 4 VERİ-paketi (roster reskin + STAT override + palet), farklı mekanik YOK. Kalıcılık affedici. Adversarial: eğlencenin %90'ı zaten düelloda → meta ince/ucuz çerçeve.
**Kullanıcı kararları:** MVP çağı = **YENİ ÇAĞ (modern, +0 sanat)** · **js/ canonical** (tek-dosya öldürüldü) · Faz 0+1 başla.

- ✅ **FAZ 0 — Dosya tekliği (BİTTİ):** `pixel-rts-tek-dosya.html` (9316 satır, ayrışmış stale artefakt) SİLİNDİ. js/ + index.html tek canonical kaynak. Transfer = klasör kopyala (gerekirse `cat js/*.js`).
- ✅ **FAZ 1 — Ana ekran + Hızlı Maç (BİTTİ):** `js/Screens.js` (showScreen ekran-yöneticisi + Hızlı-Maç akışı). Ana ekran: sağda yukarıdan-aşağı [📜 Yeni Hikaye / ⚡ Hızlı Maç / ⚙️ Ayarlar]. **Hızlı Maç:** AI-puanı + senin-puan slider'ları (puan=ordu bütçesi, asimetrik=zorluk) + denge-rozeti → Savaşa Başla → `player.money=pl, enemy.money=ai` → deploy → düello. HTML overlay'ler (index+oyna), style.css (.app-screen + body[data-screen] ile oyun-HUD'u menüde gizlenir), Screens.js yüklü. Düello çekirdeğine SIFIR dokunuş. Yeni Hikaye/Ayarlar = stub (Faz 2). Screens.js (0,0,0).
- ⏳ **Sıradaki:** 10-harita sistemi (terrain const→let + applyMap), Faz 1.5 (resetBattleState — reload yerine sahne-geçiş), Faz 2 (Yeni-Çağ Hikaye + soyut-Avrupa).

**TEST:** reload → ANA EKRAN gelmeli → Hızlı Maç → puan seç → Savaşa Başla → deploy+düello çalışmalı. (Restart şimdilik reload→menü.)

### ✅ KULLANICI GERİ-BİLDİRİM DÜZELTMELERİ (ana ekran "gayet güzel")
1. **Çok Oyunculu butonu** ana ekrana eklendi (🌐, stub — gelecekte online sistem).
2. **Topçu mühimmatı %40 az:** maxAmmo 20→12 (topçu daha çabuk biter → yaklaşma penceresi).
3. **PANİK SİSTEMİ DÜZELTİLDİ (kök sorun):** Eskiden panik baskı altında TEK-YÖNLÜ artıyordu → birim sonsuza dek kaçıyordu ("düşman kovalarken birim savaşmıyor"). Artık: (a) panik HER ZAMAN net (`panicGain − panicDecay`) → baskı azalınca düşer, (b) **süre-bazlı zorunlu rally:** 4 sn'den uzun kaçan birlik baskı altında olsa bile toparlanır (`fleeSince` + `panicDecay×5`) → tekrar savaşır. Panik artık "bir süre sonra biter."
4. **TOPÇU YENİLEBİLİR (matematik gözden geçirildi):** (a) splash yarıçapı 165→135 (komutanın artySpread 195 > 135 → yayık birim splash'tan kaçar), (b) all-arty deploy avcısı düzeltildi: çok-RECON (kırılgan, erir) yerine **2-4 spotter + MECH/piyade sürüsü** (dayanıklı öldürücü). Rock-paper-scissors sağlam: AT→tank ×4, piyade-sürü→AT, RECON+MECH-rush→topçu. **Hiçbir birim yenilmez değil.**

Tüm dosyalar (0,0,0). **TEST:** all-arty'ne karşı oyna → AI artık RUSH'layıp topçunu eziyor mu (panik kaçışı bitti, MECH sürüsü ulaşıyor)? Birimler paniklediğinde bir süre sonra toparlanıyor mu?

---

## BÖLÜM 15 — ÇOK OYUNCULU (LAN 1v1, lockstep) — KONSEY 5 + LOBİ TEMELİ
**Konsey 5 (8 ajan):** Verdict "EVET çalışır". Mimari: **"deterministik motorun üstüne ince lockstep katmanı."** Doğrulandı: tüm sim-rastgeleliği SIM.rng (mulberry32); Math.random YALNIZ VFX/decal/spark/screenShake/AI-eğitiminde (sim-state'e girmiyor) → iki Chrome aynı seed+komut = birebir aynı maç. Ağdan sadece **seed+komut+hash** geçer (tam-state değil) → LAN'da ~sıfır bant. Yöntem: **yerel Python WS sunucu** (websockets 10.4 KURULU, LAN-IP 192.168.0.106 doğrulandı) — WebRTC değil (NAT yok, broker oda-listesi vermez). Tek-insan-vs-AI yolu `if(MP.active)` arkasında korunur. Kritik tuzaklar: sabit-tick ŞART (değişken dt=desync), hedef seçimi sis'siz mutlak-en-yakın (canSee=ıraksar), Support/setTimeout KAPAT, deploy-sırası=id-eşleşme, AYNI Chrome.

- ✅ **Adım 2 — `mp_server.py` (BİTTİ):** Tek dosya, websockets 10.4. Aynı port 8080: statik dosya servisi (oyunu host'lar, Node http-server'ı değiştirir) + WS lobi + lockstep relay. `python3 mp_server.py` → LAN-IP basar. Oda yönetimi (create/join/list), peer-relay (cmd/start/hash/deploy aynen iletilir), peer_left. py_compile ✓.
- ✅ **Adım 3 — Lobi UI + Net.js (BİTTİ):** `screen-multiplayer` (kutu + Host-IP + Bağlan + sunucu-listesi ortada + altta [Oluştur/Katıl/Geri] — kullanıcının istediği). `js/Net.js` (WebSocket istemci + lobi: connect/send + rooms/created/joined/peer_joined/error/peer_left dağıtımı, oda-listesi render, durum-rozeti). Screens.js `mpInit` (idempotent buton bağlama + 3sn liste tazele). CSS (.mp-box/.mp-room-list/.mp-badge). Her iki HTML + Net.js yüklü. Net.js+Screens.js (0,0,0).
- ⏳ **Adım 4-7 (SIRADA — lockstep çekirdeği):** `js/MP.js` (sabit-tick akümülatör + pending[execTick] + mpApplyTick + lsStateHash FNV-1a desync) + main.js MP-dalı (`if(MP.active)`) + uzak-komut (id-bazlı, sis'siz hedef) + taraf-atama (myCanonicalSide) + deploy/seed senkron + Support-kapat. MVP: simetrik-sabit-ordu (serbest-deploy sonra).

**TEST (lobi):** host `python3 mp_server.py` → iki PC `http://192.168.0.106:8080` → Çok Oyunculu → Bağlan → Oluştur(A)/Katıl(B) → oda listesi dolmalı, bağlantı kurulmalı. (Maç başlatma = lockstep, sonraki adım.)

### 🔑 ŞİFRE SİSTEMİ (IP yerine — kullanıcı isteği)
IP-yazma kaldırıldı. **"Oyun Kur" → sunucu bir ŞİFRE üretir** (host LAN-IP + oda → base36, örn `158V9MYOH`); **guest şifreyi girer → doğrudan host'un sunucusuna bağlanır.** Sunucu `make_code(ip,room)` ↔ istemci `netParseCode(code)` birebir aynı şema (round-trip testi tüm IP'lerde GEÇTİ). Lobi UI yenilendi: host şifre-göster+kopyala, guest şifre-giriş. `mpCreateGame` (localhost'a bağlan→create), `mpJoinByCode` (çöz→bağlan→join). **Gelecek:** internet-geneli için merkezi sunucu + şifre (port-forward / public broker) — şimdilik LAN. `git pull` her iki PC'de AYNI sürüm şart (lockstep determinizmi).

### 📦 GitHub: `141ebbb..a96511b main` puşlandı (diğer PC `git pull` ile indirir). __pycache__ .gitignore'a eklendi. Bundan sonra düzenli puş.

**TEST (şifre):** HOST: `python3 mp_server.py` → oyunu aç → Çok Oyunculu → **Oyun Kur** → şifre çıkar. GUEST: oyunu aç → şifreyi gir → **Oyuna Katıl** → bağlanmalı. (Maç motoru = lockstep, sıradaki adım.)

### ⚔️ LOCKSTEP MAÇ MOTORU (Adım 4-7 BİTTİ — ilk oynanabilir MP!)
**`js/MP.js`** — deterministik motorun üstüne ince katman. Sabit-tick **20Hz input-delay lockstep**: her sağ-tık komutu `execTick = tick+3`'e kuyruğa girer, ağa gider, İKİ PC'de aynı tick'te uygulanır. Boş tick = heartbeat + bariyer (rakip komutu gelmezse STALL = bekle, atlama yok). `mpApplyTick` MAVİ-komutları ÖNCE KIRMIZI SONRA (sabit sıra). Hedef seçimi **sis'siz mutlak-en-yakın** (canSee=ıraksar). **FNV-1a desync-hash** her 30 tick (id-sıralı x/y/hp/rng/vp) → sapma anında "SENKRON KOPTU" + dondur. `now = tick×50×GAME_SPEED` (cooldown↔hareket tutarlı). **MVP: simetrik sabit ordu** (12 birim/taraf: 4 piyade+3 mech+2 tank+2 AT+1 topçu; serbest-deploy sonraki adım).

**main.js entegrasyonu** (tek-oyunculu BOZULMADAN — hepsi `if(MP.active)`/`myCanonicalSide`):
- gameLoop BATTLE dalı: MP.active → `mpStep` (yoksa eski stepSim). MP'de Support KAPALI (setTimeout=desync), gameTime donduruldu (sim'de kullanılmıyor — doğrulandı).
- contextmenu: MP'de anında-uygula yerine `mpEmitCommand` (id-bazlı).
- Taraf-atama `myCanonicalSide` (host=MAVİ/güney, guest=KIRMIZI/kuzey): seçim(5)+sis(2)+düşman-tarama. Tek-oyunculuda false → eski `!u.isRed` ile BİREBİR aynı.
- checkGameOver: guest zafer/yenilgi etiketi düzeltildi + MP'de AI/replay eğitimi kirletilmiyor.

Tüm dosyalar (0,0,0). Puş: `67d4a0d..462a4d6`.

**TEST (GERÇEK MP — iki PC):** ① iki PC `git pull` (AYNI sürüm şart) ② HOST `python3 mp_server.py`+oyun aç+Oyun Kur → şifre ③ GUEST oyun aç+şifre gir+Katıl → **maç başlamalı**: host MAVİ (güney) guest KIRMIZI (kuzey), 12'şer birim. Sağ-tık komut ver → İKİ ekranda da AYNI hareket etmeli, senkron kalmalı (SENKRON KOPTU çıkmamalı). AYNI Chrome şart.
