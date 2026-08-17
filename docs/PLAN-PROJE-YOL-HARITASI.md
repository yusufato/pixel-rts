# PROJE YOL HARİTASI

Bu belge projenin **tamamı** için öncelik sırası verir. Her madde ya ölçülmüş bir bulguya
ya da açık bir borca dayanır; tahmine dayanan hiçbir madde yoktur.

Öncelik ölçütü: **kanıtlanmış kazanç > açık borç > keşif.**

---

## ⛔ 0. ACİL — arama gerçek oyunda YOK

**Bulgu:** `js/BattleLookahead.js` ve `js/BattleValueNet.js` **`index.html`'de yüklenmiyor**;
`gameLoop` içinde `battleLookaheadTick` çağrısı **yok**. Yani ölçülen +1369 marjlık kazanç
(t 3.15) yalnız test tezgâhında geçerli — **oyuncunun oynadığı oyunda arama çalışmıyor.**

Bu, "ölçüldü ama bağlanmadı" hatasının aynısı: değer ağı da aylarca böyle durmuştu
(ρ 0.830, motora hiç bağlanmamış).

### ⛔ BÜTÇE DUVARI ÖLÇÜLDÜ — ucuzlatma denemelerinin ÜÇÜ DE ÖLDÜ

Kanıtlanmış kazanç, tezgâhta **80sn oyun için 79sn CPU** harcıyor — bir çekirdeğin tamamı.
Canlı oyuna sığdırmak için üç yol denendi, **hiçbiri kazancı korumadı**:

| konfigürasyon | marj farkı | t | canlıya sığar mı |
|---|---:|---:|---|
| **20 birim/tur, 5sn ufuk** (kanıtlanmış) | **+1369** | **3.15** | ❌ %100 çekirdek |
| 1sn ufuk | +33 | 0.08 | ✅ ama kazanç YOK |
| dönüşümlü (5 birim/tur, emir 20sn) | +191 | 0.47 | ✅ ama kazanç YOK |
| **uzun periyot** (20 birim, 15sn'de bir) | +153 | 0.42 | ✅ ama kazanç YOK |
| ışınlama (hiç rollout, A1) | eleyici olarak vasat | — | ✅ ama kazanç YOK |

**Sonuç:** kazanç ÜÇ boyutun ÇARPIMINDAN geliyor ve hangisi kısılırsa kısılsın ölüyor:

```
GERÇEK SİMÜLASYON (5sn)  ×  TAM KAPSAM (20 birim)  ×  YÜKSEK SIKLIK (5sn'de bir)
     1sn → +33                  5 birim → +191            15sn → +153
```

Bu, mekanizmanın ne olduğunu da söylüyor: kazanç birkaç akıllı hamleden değil, **tüm
kuvvetin sürekli yeniden yönlendirilmesinden** geliyor. Değer ağı rollout'un YERİNE
geçmiyor, sonunu PUANLIYOR.

### ⚠ BU BÖLÜMÜN TEŞHİSİ DÜZELTİLDİ (2026-08-17)

Yukarıdaki tablo doğru ama **sebep yanlış atfedilmişti**. "Maliyet rollout'tan geliyor"
varsayılıyordu; ölçüldü, öyle değilmiş.

`tools/politika-kip-kapisi.js` (60sn oyun, tek taraf):

| kip | CPU | oyun/CPU |
|---|---:|---:|
| aramasız (taban) | 6.0sn | 9.9× |
| tam arama | 235.4sn | 0.25× |
| **rollout'suz** (politika kipi) | 61.8sn | 0.97× |
| rollout'suz **+ ağ eleyicisi kapalı** | **6.0sn** | **9.9×** |

Rollout tümüyle atıldığında maliyet yalnız 4 kat düştü. Ağ eleyicisi de kapatılınca
**tabana** indi. Yani maliyetin çoğu, değer ağının **aday başına** çağrılmasıydı:
25 aday × 20 birim = **500 CNN geçişi/tur**.

**Düzeltme (`LA_AG_ADAY = 5`):** ağ yalnız analitik en iyi 5 adaya sorulur — bu kısıtın
güvenli olduğu zaten ölçülmüştü (*analitik ön eleme K=3 kazancın %72'sini korur, bedava*).

| kip | CPU | oyun/CPU |
|---|---:|---:|
| tam arama | 105.0sn | 0.57× (hâlâ sığmıyor) |
| **politika kipi** | **15.1sn** | **3.98× ✅ SIĞIYOR** |

**Karar değişti:** Web Worker ZORUNLU DEĞİL. Damıtılmış politika canlı bütçeye zaten
sığıyor. Worker, tam aramayı canlıya taşımak istenirse hâlâ bir seçenek — ama artık
tek yol değil ve öncelikli de değil.

**AÇIK BORÇ:** `LA_AG_ADAY=5` aramanın davranışını değiştiriyor (atlanan karar 53→137).
Kanıtlanmış +1262 bu konfigürasyonda **yeniden ölçülmedi**.

Ayrıntı: `docs/PLAN-POLITIKA-DAMITMA.md`.

### Alternatif (artık zorunlu değil): ayrı iş parçacığı (Web Worker)

```
ana iplik:  fork al (2.1ms) → worker'a yolla → oyun akmaya devam eder
worker:     aramayı tam konfigürasyonla koş (~5sn)
ana iplik:  gelen emirleri KAYITLI OLAY olarak kuyruğa al
```

**Determinizm:** emirler oyuncu komutlarıyla aynı yoldan (`player-ability` deseni) tik
sınırında uygulanır ve replay'e KAYDEDİLİR. Replay yeniden arama yapmaz, kaydı oynatır →
tekrar üretilebilir kalır.
**Çok oyunculu:** her istemci bağımsız arama yaparsa sapar. MP'de ya kapatılmalı ya da
host yetkili olmalı — ayrı karar.

### Yapılacaklar
0. **Politika damıtma kapısı** (`docs/PLAN-POLITIKA-DAMITMA.md`) — canlıya sığan tek
   aday bu; sonucu 1. maddenin hangi dosyaları yükleyeceğini belirler.
1. `index.html`'e üç dosya: `BattleStateFeatures` (varsa), `BattleValueModel`, `BattleValueNet`, `BattleLookahead`
   (+ politika kapıyı geçerse `BattlePolicyModel`, `BattlePolicyNet`)
2. `gameLoop`'ta **tikler arasına** `battleLookaheadTick(now)` — `stepSim`'in İÇİNE ASLA
   (fork/restore birimleri yeniden yaratır, dış tikin döngüleri bozulur)
3. **Çok oyunculu kilit adım:** arama emir üretiyor; lockstep'te iki taraf aynı emri üretmeli.
   Determinizm sağlanmış (fork rngState'i geri alıyor) ama `npm run test:online` ile
   doğrulanmalı.
4. Bütçe kontrolü: canlı oyunda kare bütçesi var. Tezgâhta 357sn/maç kabul edilebilir,
   60 FPS'te değil. Karar başına iş dilimlenmeli ya da periyot uzatılmalı.

**KAPI:** `--forktest` · `--battletest` · `npm run test:online` · gözle 1 maç (kare düşmesi yok).

---

## 1. DENGE — arama dengeyi bozuyor

**Ölçüldü:** arama saldıranda açıkken saldıran %41.7 → **%62.5**. Yani rol dengesi %50'yi aştı.

- Simetrik aç (iki tarafta da) → denge geri gelmeli ama **ölçülmeli**, varsayılmamalı.
- Zorluk kademesi olarak kullanılabilir: kolay = arama kapalı, zor = açık.

**KAPI:** `tools/rol-dengesi.js`, arama İKİ tarafta açık, saldıran oranı %45-55 bandında.

---

## 2. BİRİM DENGESİ — ölçülmüş uçlar duruyor

26 birimin maliyet/getiri eğrisi çıkarıldı. Uçlar:

| birim | maliyet | getiri | kullanım |
|---|---:|---:|---:|
| spaag | 300 | x1.89 | %15 |
| attack_helo | 800 | x1.70 | %52 |
| tank_destroyer | 420 | x1.41 | %50 |
| … | | | |
| armed_uav | 550 | **x0.15** | %25 |
| artillery | 450 | **x0.04** | %44 |

**Uyarı:** getiri TEK LENS. Topçunun ürünü imha değil baskı (ödül defteri bunu ölçüyor).
x0.04 yine de baskıyla açıklanamayacak kadar uçta.

**Açık şüpheliler (ölçüldü, kovalanmadı):**
- **balistik füze** — 1050₺, hedefi %100, ölmüyor, yine de maç başına **1.5 atış**
- **SİHA** — 550₺, ömür 85sn, kullanım %25
- **ÇNRA** — görüş 600, asgari menzil 600 → gözcüsüz asla kendi göremez

**KAPI:** her düzeltme için 1v1 mekanizma ölçümü + `tools/birim-sagligi.js` yeniden koşusu.

---

## 3. AÇIKLANMAMIŞ OLGU — temas anındaki takas çöküşü

```
0-30sn   1.61:1  (saldıran önde)
60-90sn  0.52:1  (çöküş)
```

Yedi hipotez elendi: taarruz kapısı · siperlenme · savunanın pasifliği · parçalı varış ·
mission-kill · kompozisyon · hat kapanmaması. Hiçbiri açıklamıyor.

Kalan adaylar (hiç ölçülmedi): hareket hâlindeki birimin ateş verimi · ateş hattı tıkanması
(`Hat Kapalı` saldıranda %6.8 vs savunanda %5.6) · savunanın üs/ikmal yakınlığı.

---

## 4. SATIN ALMA — yetenek katmanının gerçek darboğazı

Beceri/demet ölçümü: 6 güçlendirme birimli orduda galibiyet **3 katına** çıkıyor,
**doğal orduda sıfır** — çünkü AI o birimleri hiç almıyor.

Yani yetenek geliştirmeden önce **kompozisyon seçimi** düzeltilmeli. Aksi hâlde her
yetenek işi aynı duvara çarpar.

---

## 5. DEĞER AĞI — ikinci tur

- **Erken oyun zayıf:** 0-30sn ρ 0.389. Arama o pencerede ağa güvenemiyor.
- **Model anında doyuyor:** 5 epok 0.841, 300 epok 0.840 → sınır kapasite/veri çeşitliliği.
  Daha büyük ağ veya daha çeşitli ordu dağılımı denenebilir.
- **Işınlama uyumsuzluğu:** ağ "bu durumdan sonuç ne" diye eğitildi, arama "bu noktaya
  gidersem ne olur" diye soruyor. Hamle-koşullu bir ağ (girdiye hedef nokta eklenir)
  A1'i kurtarabilir — A1 bu yüzden düşmüştü.

---

## 6. HİKÂYE MODU — kullanıcının açık işi

Hex dünya altyapısı çalışma ağacında (StoryHexWorld/Geography/Regions/Settlements).
`docs/PLAN-HARITA-KAYNAKLARI.md`'de **2 aşama AÇIK**: `labor` kaynağının canlandırılması,
118 şehre coğrafi karakter. Kullanıcı bu alanı kendisi sürüyor — koordinasyon gerektirir.

---

## 7. TEKNİK BORÇ

- `js/BattleValueModel.js` **688 KB** ve `build.files` `js/**` içerdiği için EXE'ye giriyor.
  Kabul edilebilir ama farkında olunmalı.
- `SIM.mines` fork'a **yazılmıyor** (restore'da siliniyor). Bugün zararsız; mayın artık
  oyuncunun aktif aracı olduğu için ileride ısırır.
- Hikâye testleri temiz HEAD'de de **her koşuda farklı bir probda** düşüyor — kaydedildi,
  kovalanmadı.

---

## ÖNCELİK SIRASI — gerekçeli

| # | iş | neden bu sırada |
|---|---|---|
| **1** | Aramayı gerçek oyuna bağla | Kanıtlanmış +1369 kazanç oyuncuya HİÇ ulaşmıyor |
| **2** | Simetrik denge ölçümü | 1 bitmeden oyun dengesiz kalır (%62.5) |
| **3** | Satın alma | 4 ve 5'in önkoşulu; tek başına da kazanç |
| **4** | Birim uçları (balistik/SİHA/ÇNRA) | Ucuz, mekanizma düzeyinde net |
| **5** | Temas çöküşü | En büyük açıklanmamış olgu ama pahalı |
| **6** | Değer ağı 2. tur | 1-4 bitmeden getirisi belirsiz |

---

## YÖNTEM KURALLARI (bu turda pahalıya öğrenildi)

1. **Ölçmeden değiştirme, değiştirmeden ölçme.** Çift yönlü sıra 3.5× maliyetle no-op'tu
   çünkü çeşitlendirme önce doğrulanmadı.
2. **Tekrarlanabilirlik ≠ atfedilebilirlik.** Rollout deterministikti ama ölçtüğü şey
   birimin katkısı değil haritanın geri kalanıydı.
3. **Saptama tabanını her raporda yaz.** `t < 2` başarısızlık değil, çoğu zaman güçsüz test.
4. **Negatif sonuç bütçe kaynağıdır.** İki ölçülmüş negatifin kapatılması, kapsamı 4 kat
   büyütecek bütçeyi verdi ve ilk anlamlı sonucu finanse etti.
5. **"Ölçüldü ama bağlanmadı" en pahalı hata.** Değer ağı aylarca öyle durdu; arama şu an
   öyle duruyor (madde 0).
