---
status: active
owner: osman
last-reviewed: unknown
canonical: true
---

# Pixel RTS — Sıfırdan Savaş AI Tasarım Planı

## Amaç

Yeni sistem tek bir tarafsız savaş zekâsı olacaktır. Aynı kod:

- Hikâye modundaki düşman kuvvetlerini,
- Hikâye modundaki müttefik komutan kuvvetlerini,
- Hızlı Maç düşmanını,
- AI vs AI testlerindeki iki tarafı

yönetecektir.

Taraflara özel karar kodu bulunmayacaktır. Taraflar yalnızca görev, doktrin,
kişilik, kaynak, teknoloji, istihbarat ve başlangıç kuvvetleriyle birbirinden
ayrılacaktır.

---

## 0. Zorunlu motor temeli

AI geliştirilmeden önce savaş simülasyonu bütün çalışma ortamlarında aynı
olmalıdır.

Mevcut riskler:

- Tek oyunculu savaş değişken frame `dt` kullanabilir.
- Multiplayer sabit tick kullanır.
- Hit-stop savaş adımının dışında işlenebilir.
- Bazı destek sistemleri gerçek zamanlayıcı kullanabilir.
- Render kapalı eğitim, canlı oyundan farklı kod yollarına girebilir.

Hedef temel:

- Bütün savaş modları sabit `50 ms` simülasyon tick’i kullanır.
- Render FPS, savaş sonucunu değiştirmez.
- `GAME_SPEED` yalnız çalıştırılan simülasyon tick’i miktarını etkiler.
- Hit-stop, destek süreleri, cooldown, moral ve ikmal simülasyon saatini kullanır.
- AI yalnız simülasyon tick’lerinde karar verir.
- Aynı harita, seed, ordu ve emir kaydı bütün ortamlarda aynı sonucu üretir.
- Test, oyuncunun kullandığı gerçek menü ve savaş motorunu kullanır.

Kabul koşulu:

```text
Canlı oyun hash’i = QA hash’i = eğitim hash’i = replay hash’i
```

Bu koşul sağlanmadan öğrenen AI eğitimine başlanmayacaktır.

---

## 1. Ana mimari

```text
BattleController
├── Perception System
├── Battlefield Memory
├── Situation Analyzer
├── Commander Brain
│   ├── Mission Interpreter
│   ├── Threat Assessment
│   ├── Course of Action Generator
│   ├── Plan Evaluator
│   └── Commitment Manager
├── Force Organizer
├── Task Force Controllers
├── Tactical Order System
├── Unit Order Executor
└── Battle Recorder
```

AI doğrudan her birime bağımsız hedef vermeyecektir. Önce savaş planı
oluşturacak, kuvvetleri görev gruplarına ayıracak ve gruplara komutan niyeti
verecektir.

Her taraf için bir `BattleController` oluşturulur:

```js
{
  side,
  mission,
  doctrine,
  personality,
  perception,
  memory,
  forceState,
  enemyEstimate,
  currentPlan,
  candidatePlans,
  taskForces,
  reserve,
  decisionHistory,
  confidence,
  battlePhase
}
```

Kırmızı ve mavi taraf arasında farklı kontrol sınıfları bulunmayacaktır.

---

## 2. Algı ve savaş sisi

AI oyuncunun göremediği bilgiyi kullanmayacaktır.

### AI’nin bileceği bilgiler

- Kendi birliklerinin gerçek durumu,
- Görüş içindeki düşmanlar,
- Son görülen düşman konumları,
- Duyulan topçu ve ateş kaynakları,
- Keşif raporları,
- Temasın kaybedildiği bölgeler,
- Tahmini düşman kuvveti.

### AI’nin bilmeyeceği bilgiler

- Sis altındaki kesin düşman konumu,
- Görülmeyen düşmanın gerçek HP ve cephanesi,
- Görülmeyen topçu konumu,
- Oyuncunun seçili birlikleri,
- Oyuncunun vereceği sonraki emir,
- Keşfedilmemiş teknoloji ve bonuslar.

### Temas hafızası

```js
{
  unitClassEstimate,
  lastSeenPosition,
  lastSeenTime,
  confidence,
  estimatedStrength,
  estimatedVelocity,
  probableArea,
  threatLevel
}
```

Zaman geçtikçe temas güveni azalacak, olası konum alanı genişleyecek ve AI eski
konuma kesin atış yapamayacaktır. Keşif birimleri gerçek bilgi üretecek; keşif
kaybı karar kalitesini düşürecektir.

---

## 3. Komutanın bilişsel karar modeli

Sistem yalnız bir durum makinesi olmayacaktır. Komutan birden fazla harekât
tarzı üretip bunları karşılaştıracaktır.

### Durum analizi

- Yerel ve toplam kuvvet oranı,
- Ateş desteği üstünlüğü,
- Zırhlı üstünlüğü,
- Keşif güvenilirliği,
- Kanat açıklıkları,
- Arazi avantajı,
- Hat bütünlüğü,
- İkmal ve cephane,
- Kayıp hızı,
- Kalan süre,
- Görev başarısına uzaklık,
- Yedek kuvvet oranı,
- Düşmanın muhtemel ağırlık merkezi.

### Üretilecek plan seçenekleri

- Temas ara,
- Kontrollü ilerle,
- Ana taarruz,
- Sabitle ve kanatla,
- Yarma harekâtı,
- Ateş hazırlığı,
- Savunma hattı kur,
- Derin savunma,
- Hareketli savunma,
- Karşı taarruz,
- Toparlan,
- Muharebeden ayrıl,
- Topçu avı,
- Zayıf kanada baskı,
- Kuşatmadan çık,
- Son savunma,
- Kalan düşmanı temizle.

### Plan puanlama

```text
Plan Puanı =
  görev başarısı ihtimali
+ beklenen düşman kaybı
+ arazi kazanımı
+ zaman uygunluğu
+ doktrin uyumu
+ bilgi güveni
- beklenen kendi kaybı
- açık kanat riski
- ikmal riski
- plan değiştirme maliyeti
- yedek tüketme riski
```

Yeni plan yalnızca mevcut plandan anlamlı derecede daha iyiyse seçilecektir.
Plan değiştirme eşiği ve asgari plan süresi kararsızlığı önleyecektir.

---

## 4. Komuta niyeti ve emir sistemi

Her plan açık, denetlenebilir emirler üretir:

```js
{
  objective,
  task,
  formation,
  route,
  engagementRule,
  preferredRange,
  tempo,
  phaseLine,
  supportRequest,
  abortCondition,
  fallbackPosition,
  pursuitLimit
}
```

Örnek:

```text
Görev: Düşman tanksavar hattını sabitle
Amaç: Ana zırhlı grubun sol kanattan geçmesini sağla
Ateş kuralı: Menzil avantajını koru
İptal koşulu: Kuvvet %45’in altına düşerse ayrıl
Geri çekilme noktası: İkinci savunma hattı
Takip sınırı: 300 metre
```

---

## 5. Kuvvet organizasyonu

AI her birimi bağımsız oynatmayacaktır.

### Görev grupları

- Ana kuvvet,
- Sabitleme grubu,
- Kanat grubu,
- Ateş destek grubu,
- Keşif grubu,
- Tanksavar ekranı,
- Mühendis/ikmal grubu,
- Yedek,
- Karşı taarruz grubu.

Görev grupları savaş sırasında yeniden düzenlenebilir ancak sürekli dağıtılıp
kurulamaz.

### Yedek davranışı

- Taarruzda başlangıçta `%15–25` yedek,
- Savunmada `%20–35` yedek,
- Zayıf istihbaratta daha büyük yedek,
- Hat yarılınca kapatma kuvveti,
- Son safhada kontrollü serbest bırakma.

AI bütün ordusunu ilk temasta tek noktaya göndermeyecektir.

---

## 6. Taktik davranışlar

### Piyade

- Örtüden örtüye ilerler.
- Tank önünde gereksiz koşmaz.
- Siper kullanır.
- Baskı altında dağılır veya korunur.
- Tanksavar tehdidini işaretler.

### Zırhlı birlikler

- Tanksavar doğrulanmadan kör ilerlemez.
- Açık kanat arar.
- Piyadeden tamamen kopmaz.
- Hasarlı araçları ön hattan çıkarır.
- Dar alanda yığılmaz.
- Yarma sonrasında aşırı takip yapmaz.

### Keşif

- Savaşçı piyade gibi kullanılmaz.
- Temas kurup güvenli mesafeye döner.
- Topçuya görüş sağlar.
- Bilinen tehdide aynı rotadan tekrar girmez.
- Alternatif keşif rotaları kullanır.

### Topçu

- Görülmeyen hedefe kesin atış yapmaz.
- Gözlemci bağlantısı kullanır.
- Değerli birlik kümelerini hedefler.
- Aynı mevzide gereğinden uzun kalmaz.
- Karşı batarya tehdidinde yer değiştirir.
- Dost birliklerin üzerine ateş etmez.

### Tanksavar

- Tank kovalamaz.
- Ateş sektörü kurar.
- Piyade ekranının arkasında kalır.
- İlk atışı değerli zırhlı hedefe saklar.
- Kanat tehdidine döner.

### Sağlıkçı ve mühendis

- Ön safta hedef aramaz.
- Yaralı yoğunluğuna göre yer değiştirir.
- Savunma ve ikmal alanı kurar.
- Tehlikeli mevzide gereksiz beklemez.
- Geri çekilen kuvvetle birlikte hareket eder.

---

## 7. Hareket ve formasyon

- Görev grubu formasyon merkezi,
- Birim formasyon slotları,
- Yerel çarpışma önleme,
- Dar geçit algılama,
- Yol ve uygun arazi kullanımı,
- Tehdit alanından kaçınma,
- Dost ateş hattını kapatmama,
- Formasyon bozulma ölçümü,
- Toparlanma noktaları.

Emir temposu:

- Gizli ilerleme,
- Normal ilerleme,
- Muharebe ilerlemesi,
- Hızlı intikal,
- Geri çekilme,
- Düzensiz kaçış.

Genel denge başlangıcı olarak birlik taban hızları `1.25x`, görüş mesafeleri
`1.5x` değerlendirilecektir. AI bunların üzerinde gizli stat bonusu almayacaktır.

---

## 8. Hikâye ve Hızlı Maç entegrasyonu

### Ortak olanlar

- Aynı `BattleController`,
- Aynı algı sistemi,
- Aynı planlama sistemi,
- Aynı taktik davranış,
- Aynı fizik,
- Aynı görüş sistemi,
- Aynı karar aralıkları,
- Aynı emir yürütücüsü.

### Hızlı Maç girdileri

- Seçilen rol,
- Ordu bütçesi,
- Doktrin,
- Zorluk,
- Harita,
- Seed.

### Hikâye girdileri

- Komutan kişiliği,
- Komutan becerileri,
- Devlet doktrini,
- Teknoloji seviyesi,
- Birlik tecrübesi,
- Lojistik durumu,
- Moral,
- İstihbarat seviyesi,
- Savaşın politik önemi.

Hikâye modu farklı savaş motoru kullanmayacaktır; ortak motora daha zengin
başlangıç verisi gönderecektir.

---

## 9. Müttefik AI

Kontrol sahipliği açıkça tanımlanacaktır:

```text
PLAYER
ALLY_AI
ENEMY_AI
MULTIPLAYER_REMOTE
```

Müttefik AI:

- Oyuncunun birliklerini ele geçirmez.
- Kendi komutanına ait birlikleri yönetir.
- Yüksek seviye oyuncu emirlerini kabul eder:
  - Sol kanadı tut,
  - Beni takip et,
  - Savun,
  - Taarruza hazırlan,
  - Topçuyu koru,
  - Geri çekil.
- İntihar niteliğindeki emirlere gecikme veya itiraz gösterebilir.
- Düşman AI ile aynı algı ve taktik yeteneğine sahiptir.

AI vs AI testinde iki taraf aynı sınıftan oluşturulur. Taraf değiştirmek davranış
kalitesini değiştiremez.

---

## 10. Zorluk sistemi

Zorluk hasar, HP, hız veya görüş hilesi vermeyecektir.

Değiştirilebilecek parametreler:

- Karar gecikmesi,
- Plan değerlendirme derinliği,
- Değerlendirilen aday plan sayısı,
- Temas hafızası hata payı,
- Kuvvet tahmin doğruluğu,
- Mikro emir sıklığı,
- Risk toleransı,
- Koordinasyon hatası,
- Yedek kullanma kalitesi.

Seviyeler:

- **Acemi:** geç karar, hatalı tahmin ve zayıf yedek kullanımı.
- **Standart:** insana yakın hata oranı.
- **Usta:** iyi planlama ve koordinasyon.
- **Gazi:** güçlü karar kalitesi, fakat bilgi veya stat hilesi yok.

---

## 11. Öğrenme sistemi

İlk sürüm doğrudan uçtan uca öğrenen model olmayacaktır. Önce açıklanabilir ve
ölçülebilir komutan çekirdeği kurulacaktır.

Eğitim kaynakları:

1. İnsan replay’leri,
2. Aynı motor üzerinde self-play,
3. Kontrollü taktik senaryolar.

Öğrenilecek parametreler:

- Plan değerlendirme ağırlıkları,
- Risk toleransı,
- Commit ve abort eşikleri,
- Yedek oranı,
- Hedef öncelikleri,
- Tercih edilen temas mesafesi,
- Kanat genişliği,
- Toparlanma zamanı,
- Takip sınırı.

Model doğrudan birim koordinatı üretmeyecektir. Açıklanabilir plan ve davranış
parametrelerini ayarlayacaktır.

### Fitness hedefleri

- Görev başarısı,
- Takas oranı,
- Korunan savaş gücü,
- Boşta geçen süre,
- Temas kurma süresi,
- Topçu etkinliği,
- Keşif hayatta kalma oranı,
- Yedek kullanım kalitesi,
- Açık kanat süresi,
- Plan istikrarı,
- Gereksiz hareket miktarı,
- Tek taktiğe saplanma oranı.

Yalnız kazanma oranına göre eğitim yapılmayacaktır.

---

## 12. Telemetri ve replay

Kaydedilecek veriler:

- Her komutan kararı,
- Karar anındaki bilinen dünya,
- Aday planlar ve puanları,
- Plan seçim nedeni,
- Üretilen emirler,
- İptal koşulları,
- Temas hafızası,
- Tahmini ve gerçek kuvvet,
- Seed,
- Motor sürümü,
- Tick numarası,
- Oyuncu ve AI emirleri.

Replay simülasyon sonucu kaydetmeyecektir. Başlangıç verisi ve emirleri aynı
motor üzerinde yeniden çalıştıracaktır.

Örnek karar açıklaması:

```text
Karar: Karşı taarruz
Neden:
+ Sağ kanatta 1.42 yerel üstünlük
+ Düşman yedeği görülmedi
+ Kalan süre savunmacı lehine
- Topçu desteği düşük

Alternatifler:
Hat tut: 64
Karşı taarruz: 78
Geri çekil: 49
```

---

## 13. Geliştirme aşamaları

### Aşama 1 — Deterministik savaş çekirdeği

- Sabit tick,
- Ortak simülasyon saati,
- Seed,
- Replay olay formatı,
- Durum hash’i,
- Modlar arası hash eşitliği,
- Render ile simülasyonun ayrılması.

### Aşama 2 — Tarafsız kontrol arayüzü

- `BattleController`,
- Kontrol sahipliği,
- Kırmızı/mavi simetrisi,
- Emir veri modeli,
- AI olmadan emir yürütme testi.

### Aşama 3 — Algı ve hafıza

- Görüş tabanlı temaslar,
- Son görülen konum,
- Güven azalması,
- Tehdit ve bilgi haritası,
- Keşif raporları.

### Aşama 4 — Kuvvet organizasyonu

- Görev grupları,
- Rol dağılımı,
- Yedek,
- Formasyon,
- Toparlanma noktaları.

### Aşama 5 — Komutan beyni

- Durum analizi,
- Aday plan üretimi,
- Utility puanlama,
- Plan histerezisi,
- Commit ve abort koşulları.

### Aşama 6 — Taktik icra

- Piyade,
- Zırhlı,
- Keşif,
- Topçu,
- Tanksavar,
- Sağlıkçı,
- Mühendis davranışları.

### Aşama 7 — Müttefik AI

- Aynı controller’ın mavi tarafta çalışması,
- Oyuncu–müttefik görev paylaşımı,
- Yüksek seviye emirler,
- AI vs AI simetri testi.

### Aşama 8 — Hikâye entegrasyonu

- Kişilik,
- Doktrin,
- Teknoloji,
- Moral,
- Tecrübe,
- Lojistik,
- Komutan yetenekleri.

### Aşama 9 — Eğitim

- Replay veri seti,
- İnsan veri toplama,
- Self-play,
- Parametre optimizasyonu,
- Şampiyon arşivi,
- Aşırı uyum testleri.

### Aşama 10 — Denge ve kabul testleri

- 1000 eşit bütçeli AI vs AI maçı,
- Taraf değiştirme testi,
- Harita ve seed testi,
- Acemi/Usta/Gazi davranış testi,
- İnsan oyuncuya karşı kör test,
- Hikâye–Hızlı Maç motor hash karşılaştırması.

---

## 14. Başarı kriterleri

İlk oynanabilir AI aşağıdaki koşulları sağlamadan tamamlanmış sayılmaz:

- İlk anlamlı teması makul sürede kurar.
- Ordunun en az `%15` kısmını başlangıçta yedekte tutar.
- Her temas noktasına bütün orduyu göndermez.
- Görmediği düşmana kesin emir üretmez.
- Topçuyu ön safa sürmez.
- Keşfi intihar piyadesi olarak kullanmaz.
- Kuvvet oranı kötüleştiğinde ayrılabilir.
- Avantaj yakaladığında sonuç alacak kadar commit eder.
- Savunurken süre ve arazi avantajını anlar.
- Saldırırken bekleyerek kaybetmez.
- Müttefik ve düşman olarak aynı kaliteyi gösterir.
- Aynı seed’de test ve oyuncu maçı aynı sonucu üretir.
- Plan değişiklikleri teknik olarak açıklanabilir.
- Stat hilesi yapmaz.
- Tek bir baskın taktiğe dönüşmez.

---

## Uygulama ilkesi

Öncelik davranış yazmak değil, güvenilir savaş laboratuvarı kurmaktır. Sabit tick,
replay ve hash eşitliği tamamlanmadan oluşturulan hiçbir AI sonucu geçerli kabul
edilmeyecektir.

---

## Uygulama durumu — 26 Temmuz 2026

### Tamamlananlar

- Ortak `BattleSession`,
- `50 ms` sabit savaş tick’i,
- Render/simülasyon zamanı ayrımı,
- Simülasyon zamanlı destek kuyruğu,
- Replay olay kaydı,
- Replay başlangıç durumu geri yükleme,
- Tick bazlı replay emir yürütme,
- Deterministik durum hash zinciri,
- İki bağımsız replay koşusu karşılaştırması,
- Tarafsız `BattleController`,
- Kontrol sahipliği modeli,
- Ortak savaş emri yürütücüsü,
- Controller emirlerinin replay’e kaydı,
- Görüş ve LOS tabanlı `BattlePerception`,
- Sis altındaki düşman bilgisinin controller’a sızmaması,
- Tarafsız `SituationAnalyzer`,
- Sol/merkez/sağ sektör kuvvet analizi,
- Hazırlık, temas güveni ve zaman baskısı hesapları,
- Aday harekât tarzı üretimi,
- Görev/kuvvet/hazırlık/doktrin tabanlı plan puanlama,
- Deterministik `PlanCommitmentManager`,
- Plan türüne göre asgari taahhüt süresi,
- `12` puanlık plan değiştirme histerezisi,
- Temas, hazırlık, kuvvet oranı, mühimmat ve görev süresine bağlı abort koşulları,
- Kritik hazırlık ve ağır kuvvet dezavantajında kilidi aşan acil abort,
- Her plan geçişi için neden ve skor telemetrisi,
- Plan seçiminin emir üretiminden ayrılması,
- Yalnızca algılanan temasları kullanan `BattleOperationalPlanner`,
- Temas değerleriyle ağırlık merkezi ve baskın düşman sektörü hesabı,
- Plana göre görünür/son görülen temas veya görev hedefi seçimi,
- Ana kuvvet, sabitleme, kanat, ateş destek, keşif, destek ve yedek görev grupları,
- Taarruz/savunma rolü ve istihbarat güvenine göre `%15–35` yedek hedefi,
- Birlik tipi uygunluğu ve savaş değerine göre deterministik grup tahsisi,
- Aynı plan ve birlik kadrosunda gereksiz grup değişimini engelleyen organizasyon önbelleği,
- Bütün dost birliklerin yalnızca bir gruba atanmasını doğrulayan tahsis sözleşmesi,
- Her görev grubu için denetlenebilir `TaskContractPlanner`,
- Görev, hedef, formasyon, rota, ateş kuralı, tercih edilen menzil ve tempo üretimi,
- Safha hattı, destek isteği, abort koşulu, geri çekilme noktası ve takip sınırı,
- Ana kuvvet/sabitleme/kanat/ateş desteği/keşif/destek/yedek için role özgü sözleşmeler,
- Harita ızgarasındaki dağ ve suyu dikkate alan geçilebilir rota noktaları,
- Aynı hedef yaklaşık `120` dünya biriminden az oynadığında sözleşme titremesini engelleyen önbellek,
- Sözleşme üretimi ile gerçek emir yürütmenin açık biçimde ayrılması,
- `ASSEMBLE → ADVANCE → ACTION → HOLD/WITHDRAW` safhalı `TaskExecutionManager`,
- Görev grubu formasyonlarını tarafsız `MOVE` hedeflerine dönüştürme,
- Yalnızca controller algısında hâlâ görünür olan temasa `ATTACK` izni,
- Son görülen fakat görünmeyen temaslara saldırı emrinin kesin olarak reddedilmesi,
- Güç, mühimmat ve izolasyon abort koşullarının canlı değerlendirilmesi,
- Abort halinde emir yenileme süresini beklemeden geri çekilme,
- Hedef yeniden görünür olduğunda `HOLD → ACTION` geçişi,
- Controller emirlerinin deterministik replay olaylarına kaydı,
- Hızlı Maç ve Hikâye için ortak `common-battle-ai-v1` Controller bootstrap profili,
- Kırmızı düşman ve mavi müttefik AI için aynı Controller sınıfı ve karar zinciri,
- Savaş başlangıç hash’i alınmadan önce deterministik sahiplik ataması,
- Savaş sırasında sahipliği değişen/doğabilen birlikler için replay `controller-assignment` olayı,
- Oyuncu birimlerinin `PLAYER`, müttefiklerin `ALLY_AI`, düşmanların `ENEMY_AI` sahipliği,
- Müttefik AI birliklerinin oyuncu seçim ve sağ-tık komutlarından izolasyonu,
- Multiplayer oturumlarında otomatik AI Controller oluşturulmaması,
- Quick tek-para ve Story tipli kaynak bütçesini kullanan ortak `BattleDeployment`,
- Bütçeden deterministik ordu manifesti ve kompozisyon hash’i üretimi,
- Harita geçilebilirliğine göre kuzey/güney konuşlandırma noktaları,
- Quick ve Story kırmızı ordusunun ortak motorla otomatik konuşlandırılması,
- Eşit manifesti iki tarafa aynen veren `openAIVsAILab`,
- Tam `240` saniyelik ilk karşılıklı AI-vs-AI sağlık koşusu.

### Canonical test sözleşmesi

```text
Motor: battlefield-v2-fixed50
Tick: 50 ms
Replay koşusu 1 hash: 5189993a
Replay koşusu 2 hash: 5189993a
Yakın temas algılandı: evet
Uzak/sisli temas sızdı: hayır
Sapma: yok
```

Son doğrulamadaki tarafsız plan sıralaması:

```text
COUNTERATTACK: 72.6
FIRE_PREPARATION: 62
HOLD: 53
```

Plan kararlılığı sözleşmesi:

```text
İlk taahhüt: HOLD
Kilit süresinde güçlü rakip plan: HOLD korundu
Kilit bitiminde 40 puan üstün rakip: MAIN_ATTACK seçildi
Kritik hazırlıkta acil abort: DISENGAGE seçildi
Abort nedeni: CRITICAL_READINESS
Testte plan seçiminin ürettiği emir: yok
```

Operasyonel planlama sözleşmesi:

```text
Gerçek algı temasları: [1]
Operasyonel hedef teması: 1
Uzak/görünmeyen düşman hedef verisine sızdı: hayır
Bütün dost birlikler tam bir kez tahsis edildi: evet
Görev grupları: MAIN, FIXING, FLANK, FIRE_SUPPORT, RECON, SUPPORT, RESERVE
Aynı plan içinde gereksiz grup değişimi: yok
Operasyonel planın ürettiği emir: yok
```

Görev sözleşmesi doğrulaması:

```text
Üretilen sözleşme: 7
Eksik sözleşme alanı: yok
Geçilemez rota/hedef/geri çekilme noktası: yok
Aynı hedef bölgesinde sözleşme titremesi: yok
Sözleşmeler yürütülebilir işaretlendi: hayır
```

Canlı görev yürütme sözleşmesi:

```text
AI controller emir olayı: 3
Üretilen emir türleri: MOVE, ATTACK
AI birliğinin hareketi: 35.74
AI tarafından verilen hasar: 56
Gözlenen safhalar: ASSEMBLE, ADVANCE, ACTION
Görünmeyen hedefe ATTACK reddedildi: evet
Kritik kayıpta anlık abort emri alan grup: 7/7
Replay sapması: yok
```

Ortak Controller bootstrap sözleşmesi:

```text
Profil: common-battle-ai-v1
Hızlı Maç–Hikâye profil eşitliği: evet
Controller: battle-blue-ally-ai, battle-red-ai
Müttefik ve düşman Controller aynı anda emir verdi: evet
Oyuncu sahipliği: PLAYER / seçilebilir
Müttefik sahipliği: ALLY_AI / oyuncu tarafından seçilemez
Düşman sahipliği: ENEMY_AI / oyuncu tarafından seçilemez
Multiplayer otomatik AI Controller: 0
Replay sapması: yok
```

Ortak konuşlandırma sözleşmesi:

```text
Quick otomatik kırmızı birlik: 15
Quick bütçe/değer: 1500 / 1490
Quick manifest hash: bc34f27e
Aynı bütçenin tekrar hash'i: bc34f27e
Story tipli bütçe birlik/değer: 16 / 1475
Story oil/manpower/points grupları kullanıldı: evet
AI laboratuvarı mavi/kırmızı manifest: bc34f27e / bc34f27e
Başlangıç birlik sayısı: 15 / 15
Başlangıç savaş değeri: 1490 / 1490
```

### İlk tam AI-vs-AI sağlık raporu

```text
Rol: Mavi saldıran / Kırmızı savunan
Süre: 240 saniye
Sonuç: Kırmızı kazandı
Bitiş nedeni: Süre doldu
Temas kuruldu: evet
Mavi alınan hasar: 3197.8
Kırmızı alınan hasar: 714.6
Mavi sağ kalan: 14/15
Kırmızı sağ kalan: 15/15
Controller emir olayı: 1956
Son mavi plan: FIRE_PREPARATION
Son kırmızı plan: MAIN_ATTACK
```

Sorun:
Eşit kuvvetli saldıran AI süre dolarken ateş hazırlığında kaldı ve görevi zorlamadı.

Önemi: Yüksek

Nasıl oluşuyor:
Mavi saldıran taraf temas sonrasında kesin kuvvet üstünlüğü bulamayınca `FIRE_PREPARATION`
planında kaldı. Maç `time_expired` ile bitti.

Neden problem:
Saldıranın görev koşulu süre dolmadan sonuç almaktır. Son safhada kaybetmek üzereyken
riski artırmayan karar sistemi görev bilincine sahip değildir.

Oyuncuya etkisi:
AI saldırıları tehditkâr görünmez; savunmada beklemek baskın ve sıkıcı stratejiye dönüşür.

Çözüm önerisi:
Saldıran için zaman baskısına bağlı zorunlu `MAIN_ATTACK/FIX_AND_FLANK` adayları,
son safha risk toleransı ve ateş hazırlığı azami süresi eklenmeli.

Sorun:
Görev yürütücüsü 240 saniyede 1956 emir üretti.

Önemi: Yüksek

Nasıl oluşuyor:
Grup başına periyodik hareket/atak yenilemeleri ve hedef tazelemeleri iki Controller
tarafından tekrar tekrar replay olayına yazıldı.

Neden problem:
Bu yaklaşık saniyede `8.15` birleşik emir demektir. Komutan ölçeğinde insan davranışı
değildir; replay boyutunu büyütür ve büyük ordularda performansı düşürür.

Oyuncuya etkisi:
Birlikler kararsız ve robotik görünebilir; hedef/rota titremesi oluşabilir.

Çözüm önerisi:
Emir niyeti hash’i, hedef/rota değişim eşiği, grup başına emir soğuma süresi ve yalnızca
anlamlı durum geçişinde olay kaydı uygulanmalı.

Sorun:
Toplam `3912.4` hasara rağmen yalnızca bir birlik öldü.

Önemi: Orta

Nasıl oluşuyor:
Uzun temas boyunca hasar çok sayıda hedefe dağıldı; mavi `14/15`, kırmızı `15/15`
birlikle maçı bitirdi.

Neden problem:
Muharebe sonuç üretmiyor; ateş değişimi var fakat yerel üstünlük öldürmeye ve hat
çökmesine çevrilemiyor.

Oyuncuya etkisi:
Savaş uzun, gürültülü fakat sonuçsuz hissedilir.

Çözüm önerisi:
Görev grubu hedef odağı, yaralı hedefi bitirme disiplini, yerel ateş yoğunlaştırma ve
başarılı taarruz sonrası kontrollü takip uygulanmalı.

### Çift yönlü arazi ve navigasyon regresyonu

Test koşulları:

```text
Seed: 919191
Süre: 240 saniye / maç
Ordu: 15 birlik, 1490 değer / taraf
Manifest: bc34f27e / bc34f27e
Motor: battlefield-v2-fixed50
Harita: Çizilen Harita (150x100 arazi ızgarası)
```

Mavinin saldırdığı koşu:

```text
Kazanan: Kırmızı savunan
Bitiş: Süre doldu
Mavi alınan hasar: 3851.59
Kırmızı alınan hasar: 3252.10
Mavi sağ kalan: 12
Kırmızı sağ kalan: 10
Arazi ihlali: 0
A* rota başarısızlığı: 0
Çatışma dışı navigasyon kilidi: 0
Birleşik emir hızı: 9.54/sn
```

Kırmızının saldırdığı koşu:

```text
Kazanan: Mavi savunan
Bitiş: Süre doldu
Mavi alınan hasar: 1767.10
Kırmızı alınan hasar: 3733.30
Mavi sağ kalan: 15
Kırmızı sağ kalan: 11
Arazi ihlali: 0
A* rota başarısızlığı: 0
Çatışma dışı navigasyon kilidi: 0
Birleşik emir hızı: 8.30/sn
```

Başarılı mekanik:
Dağ ve köprü olmayan su hücreleri artık hareket, çarpışma ve knockback sonrasında da
sert biçimde geçilemez. Aynı seed ve aynı manifest ile iki taraf da aynı motoru,
aynı algı/planlama/icra zincirini ve aynı arazi kurallarını kullanıyor.

Başarılı mekanik:
Köprü rotaları başlangıç hücresini tekrar hedeflemiyor, zorunlu dönüş hücrelerini
atlamıyor ve A* araması gerektiğinde 15.000 hücrenin tamamını tarayabiliyor.

Başarılı mekanik:
Aktif rota izleyen dost konvoylar birbirini fiziksel olarak kilitlemiyor. Düşman
çarpışması ve arazi engeli korunuyor. Önceki çift yönlü koşuda görülen `23–26`
arazi ihlali, `17–18` engel kaynaklı sıkışma ve `4–9` rota başarısızlığı sıfıra indi.

Sorun:
Eşit ordu ve aynı seed ile saldıran renk değişse de iki maçta da savunan taraf kazandı.

Önemi: Yüksek

Nasıl oluşuyor:
Mavi saldırdığında kırmızı savunan, kırmızı saldırdığında mavi savunan süre dolumu
kararıyla kazandı. Her iki saldıran taraf da 240 saniye içinde fiziksel bitiriş veya
görev sonucu üretemedi.

Neden problem:
Bu sonuç renk yanlılığından daha temel bir rol yanlılığı gösteriyor. Savunmak,
eşit kuvvette saldırmaktan sistematik olarak daha güvenli; saldıran AI zaman baskısını
sonuç alıcı riske çevirmiyor.

Oyuncuya etkisi:
Oyuncu savunmada pasif kalarak AI'yi yenebilir. Hücum görevi alan müttefik AI güvenilir
değildir ve savaşlar süre dolumuna sürüklenir.

Çözüm önerisi:
Saldıran için kalan süreye bağlı risk bütçesi, ateş hazırlığı azami süresi, zorunlu
son safha taarruzu, yerel kuvvet yoğunlaştırma ve hedef ele geçirme ilerleme metriği
uygulanmalı. Kabul testi yalnız kazanana değil, görev ilerlemesine de bakmalı.

Sorun:
Komutan emir trafiği hâlâ saniyede `8.30–9.54` olay üretiyor.

Önemi: Yüksek

Nasıl oluşuyor:
Periyodik görev yenilemeleri aynı hedef ve rota anlamlı biçimde değişmediğinde bile
controller-order olayı üretmeye devam ediyor.

Neden problem:
Bu komutan ölçeğinde karar değil, mikro düzeyde spamdır. Replay boyutunu ve büyük
ordu CPU maliyetini artırır; birlik davranışını robotik gösterir.

Oyuncuya etkisi:
Formasyonlar hedef çevresinde kararsız görünebilir ve gerçek taktik değişiklikler
gürültü içinde kaybolur.

Çözüm önerisi:
Grup başına emir niyeti hash'i tutulmalı; hedef, rota, safha veya angajman kuralı
değişmedikçe yeni olay yazılmamalı. Kabul eşiği birleşik olarak en fazla `2 emir/sn`
olmalı.

### Sert arazi emri ve aşamalı taarruz doğrulaması

Sorun:
Oyuncu veya başka bir emir kaynağı su/dağ koordinatını doğrudan hedef olarak
yazdığında birlik kıyıya kadar gidip ulaşılamayan hedefe yürümeye devam ediyordu.

Önemi: Kritik

Nasıl oluşuyor:
Hareket adımı geçilemez hücreye girişi reddediyordu fakat `targetX/targetY` geçilemez
koordinatta kalıyordu. Oyuncu, AI, replay, multiplayer, kaçış, spawn ve özel savaş
odası emirleri farklı yazma yollarına sahipti.

Neden problem:
Fizik ihlal edilmese bile birlik suyun içinde veya kıyıda kilitlenmiş görünüyordu.
Emir kaynağına göre farklı davranış oluşuyordu.

Oyuncuya etkisi:
Birlik emir almıyor, suya düşüyor veya dağ kenarında sonsuza kadar yürüyor izlenimi
veriyordu.

Çözüm önerisi:
Uygulandı. Bütün hedef ve spawn kaynakları merkezi `terrainSafePoint` kapısına
bağlandı. Su ve dağın içine doğrudan spawn, oyuncu emri ve AI emri veren regresyonda
hedefler geçilebilir noktaya çevrildi; `240` tick boyunca ihlal oluşmadı.

Başarılı mekanik:
Köprü hücreleri geçilebilir kalırken köprü olmayan su ve bütün dağ hücreleri artık
emir kaynağından bağımsız sert engeldir. Son Electron sonucu `BATTLETEST_OK`.

Sorun:
Saldıran AI başabaş kuvvette yalnız ateş hazırlığı düşünüyor, geç safhada görev
sonucunu zorlayacak taarruz adayını üretmiyordu.

Önemi: Yüksek

Nasıl oluşuyor:
`CourseOfActionGenerator`, `PARITY` durumunda saldıran için yalnız
`FIRE_PREPARATION` üretiyordu. Zaman baskısı skorları artsa da `MAIN_ATTACK` ve
`FIX_AND_FLANK` listede bulunmuyordu.

Neden problem:
Karar sistemi matematiksel olarak saldırıyı seçemiyordu; bu bir denge parametresi
değil, aday uzayı hatasıydı.

Oyuncuya etkisi:
Oyuncu savunmada bekleyerek süreyi tüketiyor ve AI'yi kolayca eziyordu.

Çözüm önerisi:
Aşamalı çözüm uygulandı: ilk safhada ateş hazırlığı korunuyor; zaman baskısı `0.55`
sonrasında ana taarruz ve sabitle-kanat adayları açılıyor; hazırlık `0.62` baskıda
abort ediliyor; geç safhada saldıran yedeği `%8` tabanına kadar azalıyor.

Son karşılaştırma:

```text
Mavi saldıran:
Sonuç: Savunan kazandı / süre doldu
Saldıranın verdiği hasar: 1791.6
Saldıranın aldığı hasar: 4250.1

Kırmızı saldıran:
Sonuç: Savunan kazandı / süre doldu
Saldıranın verdiği hasar: 2224.1
Saldıranın aldığı hasar: 2442.4

Su/dağ ihlali: 0 / 0
Rota başarısızlığı: 0 / 0
Çatışma dışı navigasyon kilidi: 0 / 0
```

Sorun:
Aşamalı taarruz tek başına yeterli değil; özellikle mavi saldıran hâlâ kuvvetini
verimsiz takas ediyor.

Önemi: Yüksek

Nasıl oluşuyor:
Ana kuvvet, sabitleme, kanat ve ateş desteği ayrı sözleşmelerle bağımsız ilerliyor.
Gruplar aynı hücum penceresini beklemeden temas kurabiliyor.

Neden problem:
Daha yüksek saldırganlık koordinasyonsuzsa yalnız daha hızlı kayıp üretir. İlk
agresyon denemesinde mavi saldıran `194.05` saniyede tamamen imha edildi; bu sürüm
geri çevrildi.

Oyuncuya etkisi:
AI parça parça gelir, oyuncu her grubu sırayla yok eder ve gerçek komutan baskısı
hissetmez.

Çözüm önerisi:
Plan seviyesinde `ASSEMBLE → FIRE_WINDOW → ASSAULT → EXPLOIT` ortak safha kapısı
kurulmalı. Ana/sabitleme/kanat grupları asgari hazır kuvvet oranına ulaşmadan
taarruza geçmemeli; ateş desteğinin hasar/baskı penceresi hücumu tetiklemeli.

### Sıradaki işler

1. Senkronize `ASSEMBLE → FIRE_WINDOW → ASSAULT → EXPLOIT` plan safhaları,
2. Ateş desteği hasar/baskı penceresinin taarruz tetiklemesi,
3. Emir niyeti hash’i ve komut spam’inin azaltılması,
4. Son görülen konum hafızasının yaşlanma testleri,
5. Temas güveni ve belirsizlik alanı doğrulaması,
6. Hedef odağı ve sonuç alıcılık sistemi,
7. Farklı harita ve seed kümelerinde çift yönlü regresyon.

## Uygulama güncellemesi — senkronize taarruz ve arazi-duyarlı harekât

Uygulanan sistem:

- Saldıran planları artık ortak `ASSEMBLE → FIRE_WINDOW → ASSAULT → EXPLOIT`
  operasyon safhalarını kullanıyor.
- Ana kuvvet, sabitleme ve kanat grupları toplanma oranı veya zaman aşımı oluşmadan
  müşterek hücuma geçmiyor.
- Ateş hazırlığı sırasında temas menziline giren birlikler pasif şekilde hasar
  yemiyor; yalnız gerçekten kendi silah menzilinde olan birlikler yakın tehdide
  karşı ateş açıyor. Grubun uzaktaki üyeleri hedefi kovalamıyor.
- Hedef seçimi bütün orduyu arkadaki tek bir birliğe koşturmak yerine grup
  merkezine yakın görünür temaslardan yapılıyor.
- Toplanma ve safha çizgileri düz koordinat interpolasyonu yerine gerçek A*
  geçilebilir rotası üzerinde oluşturuluyor.
- Kanat yönü, yalnız hedef noktasının geçilebilir olmasına göre değil, grubun
  mevcut konumundan rota maliyetine göre seçiliyor.
- `EXPLOIT` safhasında görünür temas kaybolursa ana, sabitleme, kanat, keşif ve
  yedek grupları son bilinen hedef çevresinde farklı sektörleri tarıyor.
- Simülasyon icra sırası her tick ters çevriliyor. Önce oluşturulan mavi
  birliklerin her tick ilk ateş etmesinden doğan kalıcı sıra avantajı kaldırıldı.
  Bu değişiklik ortak `stepSim` içinde olduğundan hikâye, hızlı maç, AI laboratuvarı
  ve multiplayer aynı motor davranışını kullanıyor.

Son eşit-manifest, aynı-seed, çift-yönlü sonuç:

```text
Mavi saldıran:
Resmî sonuç: Kırmızı savunan / süre doldu
Mavi alınan hasar: 1146.28
Kırmızı alınan hasar: 4938.00
Mavi sağ kalan: 12 / 15
Kırmızı sağ kalan: 2 / 15

Kırmızı saldıran:
Resmî sonuç: Mavi savunan / süre doldu
Mavi alınan hasar: 4855.40
Kırmızı alınan hasar: 1665.11
Mavi sağ kalan: 1 / 15
Kırmızı sağ kalan: 10 / 15

Su/dağ ihlali: 0 / 0
A* rota başarısızlığı: 0 / 0
Çatışma dışı navigasyon kilidi: 0 / 0
Regresyon sonucu: BATTLETEST_OK
```

Başarılı mekanik:
Arazi-duyarlı safha çizgileri öncesinde mavi veya kırmızı renkten bağımsız olarak
bir taraf sistematik biçimde eziliyordu. Yeni rotalama ile iki saldırı yönünde de
saldıran taraf hasar takasını açık farkla kazandı ve savunan ordunun en az `%87`'sini
yok etti.

Başarılı mekanik:
Karşı ateş grup çapında hedef-kovalama emri değildir. Yalnız temas kendi menzilindeyse
ilgili birlik ateş eder; diğer birlikler tertip ve yürüyüş görevini sürdürür. Bu,
taarruzun ateş altında pasif kalmasını çözerken yeni bir yığılma davranışı üretmez.

Sorun:
Saldıran iki yönde de muharebeyi fiilen kazanmasına rağmen son bir veya iki kaçan
birliği süre dolmadan bulamadığı için resmî zafer alamıyor.

Önemi: Yüksek

Nasıl oluşuyor:
Kırmızı saldırı koşusunda mavi savunan `1/15`, mavi saldırı koşusunda kırmızı
savunan `2/15` birliğe düşüyor. Kalan birlikler görünür temas alanından kaçıyor.
`EXPLOIT` sektör taraması emir üretiyor fakat sabit son-bilinen alan etrafındaki
arama, uzakta kaçmaya devam eden birliği kesmek için yeterli değil.

Neden problem:
Komutan kırılmış savunmayı teşhis ediyor ama takip kuvvetlerini kaçış koridoruna
göre yönlendiremiyor. Muharebe sonucu ile resmî görev sonucu birbirinden kopuyor.

Oyuncuya etkisi:
Oyuncu tek bir hızlı birliği haritanın uzak kenarında kaçırtarak, ordusunun geri
kalanı imha edilmiş olsa bile süre zaferi alabilir.

Çözüm önerisi:
Son görülen hız vektöründen kaçış koridoru tahmini yapılmalı; keşif ve hareketli
kanat grubu tahmini kesme noktasına, ana kuvvet görev hedefine gönderilmeli. Arama
alanı zamanla genişlemeli ve aynı sektör tekrar taranmamalı.

Sorun:
Teslim olma iradesi formülünün matematiksel tabanı, tek sağlıklı birliğin teslim
olmasını pratikte engelliyor.

Önemi: Orta

Nasıl oluşuyor:
İrade hesabındaki çatışabilir birlik, bozgunda olmama, baskılanmama ve ikmal hattı
bileşenleri; ordu değeri neredeyse sıfır olsa bile yaklaşık `%28` taban üretiyor.
Savunan teslim eşiği `%16` ve karşılaştırma katı küçüktür. Bu nedenle `1/15`
sağlıklı birlik, on kat kuvvet karşısında bile teslim basıncı biriktirmeyebiliyor.

Neden problem:
Teslim sistemi tasarlanan “organize savaş gücü çöktü” sonucunu uç durumda
üretemiyor. Fiziksel son-birlik avı zorunlu hâle geliyor.

Oyuncuya etkisi:
Bitmiş savaş gereksiz yere son saniyeye kadar uzuyor ve sonuç ekranında savunan
kazandı yazabiliyor.

Çözüm önerisi:
Teslim kararına mutlak kalan çatışabilir birlik oranı ve düşman üstünlüğü için ayrı
bir çöküş koşulu eklenmeli. Bu, AI'ye gizli hasar bonusu vermeden görev kuralını
tutarlı hâle getirir; ancak oyuncuya karşı güç kabulü için tek başına kullanılmamalıdır.

Sorun:
Birleşik controller emir trafiği son koşuda `6.61–8.01 emir/sn`; hedeflenen komutan
ölçeğinin üzerindedir.

Önemi: Orta

Nasıl oluşuyor:
Menzil bazlı karşı ateş, sektör taraması ve periyodik rota yenilemesi aynı anlamdaki
emirleri olay günlüğüne tekrar yazabiliyor.

Neden problem:
Replay büyür, büyük orduda CPU maliyeti artar ve taktik karar telemetrisi mikro-emir
gürültüsü altında kalır.

Oyuncuya etkisi:
Kalabalık savaşlarda birlikler gereğinden sık hedef değiştiriyormuş gibi görünebilir.

Çözüm önerisi:
Grup emri için hedef, görev safhası, birlik kümesi ve kuantize hedef koordinatından
niyet hash'i oluşturulmalı; hash değişmedikçe emir yeniden uygulanmamalı.

### Güncel sıradaki işler

1. Son görülen hız vektörüyle kaçış koridoru kesme ve genişleyen sektör araması,
2. Oyuncuya karşı canlı kabul testi: oyuncu saldıran ve oyuncu savunan,
3. Emir niyeti hash'iyle komut trafiğini `≤2 emir/sn` düzeyine indirme,
4. Farklı harita ve seed kümelerinde çift yönlü varyans regresyonu,
5. Teslim iradesi tabanının görev kuralları açısından yeniden kalibrasyonu,
6. İnsan benzeri sabit savunma ve hareketli kanat “oyuncu vekili” benchmark'ı.

## Uygulama güncellemesi — oyuncu vekili kabul testi ve geçit abort düzeltmesi

Canlı oyuncu raporlarında saldıran ve savunan AI'nın muharebenin büyük bölümünü
`REGROUP` içinde geçirdiği, saldıran tarafın ise nehir geçişinde teması kesip geri
döndüğü görüldü. Bunun iki ayrı nedeni vardı:

- Dezavantaj değerlendirmesi, sağlıklı ve görev yapabilir kuvveti de uzun süre
  `REGROUP` planına kilitliyordu.
- Köprü veya boğazdan geçen öncü grup, ordunun geometrik merkezinden uzaklaştığı
  için hasar almamış olsa bile `GROUP_ISOLATED` abort koşulunu tetikliyordu.
  Böylece A* geçidi buluyor, fakat görev sözleşmesi birlikleri başlangıç hattındaki
  fallback noktasına geri gönderiyordu.

Uygulanan değişiklikler:

- `REGROUP` için 12 saniyelik icra penceresi ve role göre zorunlu plan çıkışı eklendi.
- Plan asgari süreleri ve geçiş marjı yükseltilerek plan salınımı azaltıldı.
- Dezavantajdaki saldıran AI için ateş hazırlığı, ana taarruz ve kanat seçenekleri
  korunarak otomatik pasifleşme kaldırıldı.
- İzolasyon artık tek başına abort sebebi değil; grup aynı zamanda başlangıç
  gücünün `%72` altına düşmüşse geri çekilme üretiyor.
- `EXPLOIT` araması öldürülen ilk temasın çevresinde dönmek yerine savunma
  bölgesini role göre tarıyor.
- Sektör hedefi süre dolduğu için değişmiyor; grup mevcut geçit rotasını tamamlayıp
  hedefe vardıktan sonra sıradaki sektöre geçiyor.
- Oyuncu/AI/replay/multiplayer hedefleri için kıyı açıklığı doğrulaması eklendi;
  köprü hücreleri geçilebilir kalıyor.
- İstihkâm biriminin siper inşa noktasına doğrudan koordinat ekleyerek yürümesi
  kaldırıldı; bu hareket de ortak A* ve sert arazi duvarından geçiyor.

Son oyuncu-vekil kabul sonuçları:

```text
Oyuncu vekili savunuyor / kırmızı AI saldırıyor:
Sonuç: Kırmızı saldıran kazandı — savunma imha edildi
Süre: 116.45 sn
AI verdiği / aldığı hasar: 5023.00 / 760.77
AI sağ kalan: 13 / 15

Oyuncu vekili düz hat saldırıyor / kırmızı AI savunuyor:
Sonuç: Kırmızı savunan kazandı — süre doldu
AI verdiği / aldığı hasar: 4798.60 / 2238.29
AI sağ kalan: 9 / 15

Her iki oyuncu-vekil testinde:
Su/dağ ihlali: 0
Çatışma dışı navigasyon kilidi: 0
A* rota başarısızlığı: 0
Regresyon sonucu: BATTLETEST_OK
```

Bu sonuçlar AI'ye hasar, can, görüş veya kaynak bonusu verilmeden elde edildi.
Oyuncu vekili aynı birlik manifestini kullanıyor; saldırı vekili yalnız normal
oyuncu hareket emriyle düz hat ilerliyor ve iki taraf da ortak otomatik ateş/fizik
kurallarına tabi.

Yeni zorunlu regresyon eşiği:

- Kırmızı AI, oyuncu savunurken saldıran olarak kazanmalı.
- Kırmızı AI, oyuncu düz hat saldırırken savunan olarak kazanmalı.
- Her iki senaryoda AI'nın verdiği hasar aldığı hasarın en az `1.5x` katı olmalı.
- Su/dağ ihlali ve çatışma dışı navigasyon kilidi sıfır olmalı.

### Paket ve canlı oyun eşitliği düzeltmesi

Oyuncudan gelen sonraki iki rapor hâlâ eski `version: 6` telemetrisini ve
`68–79` saniyelik `REGROUP` sürelerini taşıdı. İncelemede bu rapor biçiminin aktif
kaynakta bulunmadığı, masaüstü kısayolunun ise var olmayan
`C:\Users\CodexSandboxOffline\...` yoluna ve 25 Temmuz tarihli eski `dist` paketine
bağlandığı doğrulandı.

- Güncel kaynak ayrı `dist-current/win-unpacked` paketine derlendi.
- Masaüstü kısayolu Windows Explorer üzerinden doğrulanmış güncel EXE yoluna bağlandı.
- Paketlenen `BattleDeployment.js`, `BattleExecution.js`, `BattleSituation.js`,
  `MapImage.js` ve `Unit.js` dosyalarının SHA-256 değerleri aktif kaynaklarla birebir
  eşleşti.
- Paket içinde eski `PIXEL RTS CANLI MAÇ RAPORU` metni bulunmadığı doğrulandı.

Bundan sonra kaynak laboratuvarı ile oyuncunun açtığı masaüstü oyunu aynı paketlenmiş
AI ve arazi kodunu kullanır.
