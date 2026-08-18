# SIRADAKİ İŞLER — bağımlılıklarıyla

Kullanıcı uyarısı: *"planlar birikiyor."* Bu projede plan bayatlığı kayıtlı bir hata
sınıfı, o yüzden liste **ölçüm durumu** ve **bağımlılık** ile birlikte tutulur.
Damgasız satır yoktur: her iş ya ÖLÇÜLDÜ, ya ÖN KAPIYI GEÇTİ, ya HENÜZ SINANMADI.

---

## Bugün kurulan ölçüm disiplini (her iş buradan geçer)

```
1. tasarım değişikliği       dakikalar
2. "karar değişti mi?"       3-5 dk    ← tools/karar-degisti-mi.js  YENİ
3. mekanizma metriği         saniyeler (GPU: ρ, sıralama doğruluğu)
4. maç kapısı                1 saat    ← yalnız 2 ve 3'ü geçenler
```

**Neden 2. adım şart:** maç marjı std ≈ 2611 ve eşleştirme varyansın yalnız %17'sini
alıyor (simülasyon kaotik). +400'lük etki için n≈485 gerekiyor — maç kapısı
ucuzlatılamaz, ama **kapıya giren aday sayısı** ucuzlatılabilir.
Ölçülen tasarruf: çok kanallı puanlama kararların %2'sini değiştiriyor → 3,4 dakikada
elendi; ben onu bir saatlik kapıya sokmuştum.

---

## A · BİTTİ — sonuç aşağıda (⛔ KAPANDI bölümü)

| iş | durum |
|---|---|
| Birim-koşullu değer ağı verisi | ✔ 42 maç, 24.480 karar, 121.331 aday |
| → eğit + **karar içi sıralama** kapısı | ✔ 4 formülasyon, hepsi taban altı |
| Bedava etiket verisi | ✔ 540 maç, 626 bin etiket, 20 dk |
| → eğit + aynı kapı | ✔ %25.5 vs taban %50.2 |

---

## B · ÖN KAPIYI GEÇMİŞ, MAÇ KAPISI BEKLİYOR

| iş | ön kapı | neden önemli |
|---|---|---|
| **Emir ömrü** (`BATTLE_LA_EMIR_KORUMA`) | ✔ mekanizma geçti | varış %13,8 → %36,2 |
| **10-15sn ufuk** | %28,6 karar değişti | ufku KISALTMAK ölçülüp öldürülmüş, UZATMAK hiç denenmemiş |

### Emir ömrü — teşhis (2026-08-17, `tools/emir-ezen.js` YENİ)

Uyarı yerindeydi: **"emir 0,6sn'de eziliyor" ölçümü üç ayrı olayı tek torbaya
koyuyordu.** Ayrıldı (varış / "yerinde kal" / gerçek ezme) ve gerçek tablo çıktı:

- ezmelerin **%85'i gerçek** ezme, %15'i hedefe VARIŞ (yani emir yerine getirilmiş)
- ezenin **tamamı** `applyBattleOrder`: MOVE %62 · ATTACK %22 · HOLD %8
- MOVE ezmeleri **tepki değil**: medyan yaş 20 tik, %45'i ters yönde, yalnız %2,8'i
  kaçan birim, %4,6'sında düşman 400px içinde
- verilen her emrin **%44,7'si** açıklanamayan ezmeye uğruyor

Bu yüzden koruma tek anahtar değil **bit maskesi** (1 MOVE · 2 HOLD · 4 ATTACK ·
8 SERBEST): ATTACK ezmesinin medyan yaşı 0 tik ve %33'ünde düşman yakında — o meşru
tepki olabilir, MOVE için aynı savunma yok.

Mekanizma kapısı (doğru ölçü "emir yaşadı mı" değil **"hedefe VARDI mı"**):

| koruma | emir hedefe VARDI | ezmenin medyan yaşı |
|---|---:|---:|
| 0 (taban) | %13,8 | 10 tik |
| 1 (MOVE) | %30,8 | 40 tik |
| 3 (+HOLD) | %30,4 | 30 tik |
| 15 (tam) | **%36,2** | 100 tik |

### Maç kapıları — 2026-08-18 gecesi (hepsi n=192 eşleştirilmiş, tohum 100000+)

| kapı | kol | saldıran % | eşleştirilmiş fark | t | saptama tabanı |
|---|---|---:|---:|---:|---:|
| A | koruma **15** vs 0 | %57,3 vs %46,4 | **+486** | 2,10 | 648 ⚠ |
| C | koruma **1** vs 0 (yalnız MOVE) | %58,9 vs %46,4 | **+552** | 2,72 | 568 ⚠ |
| D | ufuk **200** vs 100 (10sn vs 5sn) | %52,3 vs %45,3 | +357 | 1,34 | 745 ✗ |

**Okuma:**
- İki koruma kolu da pozitif ve **birbirine yakın**; MOVE-only (1) tam korumadan (15)
  geri kalmıyor — üstelik çok daha küçük bir davranış değişikliği.
- ⚠ İkisinde de ölçülen etki **saptama tabanının altında**: test bu büyüklükteki bir
  etkiyi güvenilir yakalayacak güçte değildi → kazananın-laneti riski. t 2,1–2,7 bu
  projede tek başına karar verdirmez (`docs/OLCUM-TUZAKLARI.md`).
- **A ve C üst üste TOPLANAMAZ:** aynı tohumları ve aynı kontrol kolunu paylaşıyorlar,
  gürültüleri korelasyonlu. "1, 15'ten iyi" demek için doğrudan kapı gerekir.
- D anlamsız çıktı ama **kanıt yokluğu**, yokluğun kanıtı değil: +357'yi doğrulamak
  n≈557 ister (~5 saat). Şimdilik beklemede.

**Koşan/kuyruktaki doğrulamalar** (taze tohum, A/C ile ORTAK tohum yok):
E = 15 vs 0 (100192+) · F = 1 vs 0 (100192+) · G = **1 vs 15 doğrudan** (100384+)

⚠ VARSAYILAN 0 — doğrulama kapıları geçmeden açılmaz.

---

## C · ÖLÇÜLDÜ, ELENDİ (tekrar açılmasın)

| iş | sonuç |
|---|---|
| Politika damıtma (R1) | öğretmen +839 çalışıyor, öğrenci +143 t 0.56 → damıtma değeri kaybetti |
| 25×25 ortak ışınlama | rollout'la %43 vs tek taraflı %44, z −0.28 → sinyal YOK |
| Çok kanallı puanlama | kararların %2'si değişiyor → maç etkisi beklenemez |
| Değer ağını büyütmek | ×1 ρ 0.408 · ×2 0.414 · ×4 **0.385** → sınır kapasite değil SİNYAL |
| Canlı ayar (kısılmış arama) | n=512'de +203 t 1.51 → ispatlanmadı, etiket geri çekildi |

---

## ⛔ KAPANDI — "değerlendirme, simülasyonun yerine geçebilir" (2026-08-17)

Bu, GPU yolunun dayandığı varsayımdı. **Beş formülasyon, iki veri seti, 5× ölçekleme —
hepsi düştü.** Ölçü: rollout veri setinde karar-içi sıralama.

| yöntem | sıralama |
|---|---:|
| rastgele | %20.2 |
| **bugünkü eleyici (`_ag`)** | **%50.2** |
| MSE, ham hedef | %21.5 |
| MSE, karar-içi merkezlenmiş | %21.2 |
| listewise softmax + CE | %28.8 |
| artık bağlantı (eleyicinin üstüne, başlangıçta = taban) | %29.7 |
| bedava etiket ağı (313 bin örnek, 5× veri) | %25.5 |

### Neden — ve bu bir tasarım hatası değil

`_ag`'yi "bir öznitelik" sanmıştım. Değil: **birimi aday noktaya taşıyıp değer ağını
yeniden çalıştırıyor.** Tahmin etmiyor, HESAPLIYOR — raster gerçekten değişiyor.
Eğittiğim ağlar ise zaten ucuz olan (7.87ms) bir hesabın çıktısını tahmin etmeye
çalışıyordu; kazanacak bir şey yok.

Asıl istenen, rollout'un eleyiciye yaptığı **düzeltme**ydi ("ışınlanmış birim ≠ yürüyen
birim"). O fark durum özniteliklerinden **öğrenilebilir değil**.

### Sonucu

- **GPU'nun 1600× çarpanı simülasyon satın alamaz** — artık ölçülmüş, varsayım değil.
  WebGPU portu haftalar sürecekti ve yanlış cevabı hızlandıracaktı.
- GPU'nun KALAN gerekçesi yalnız eleyicinin kendi maliyeti (`LA_AG_ADAY=0`'a dönmek) —
  daha küçük ve bağımsız ölçüm ister.
- **"Veri az" teşhisi de çürüdü:** 33 maçtan 540 maça, 121 binden 626 bin örneğe
  çıkıldı, hiçbir şey değişmedi. Kısıt veri değil, hedefin öğrenilebilirliği.

---

## D · BEDAVA ETİKET — kuruldu, kullanıldı, sonuç yukarıda

**Her gerçek maç zaten bir rollout.** Şu an her etiket için fork alıp 5 saniye simüle
ediyoruz; oysa gerçek maçta o 5 saniye zaten oynanıyor.

| | aramalı toplama | bedava etiket |
|---|---:|---:|
| maç maliyeti | ~85sn CPU | **~10sn** |
| 8 işçiyle 1000 maç | ~3 saat | **~20 dk** |
| toplam etiket | ~100 bin | **~3,2 milyon** |

Atıf sorunu kredi defteriyle çözülüyor: her birimin **kendi** ürettiği ayrı tutuluyor.

**Tuzak:** karşı-olgusal yok (yalnız gidilen yerler görülüyor) → dağılım kayması.
Çözüm: toplamada keşif gürültüsü.

**SONUÇ:** 540 maç, 626 bin etiket, 20 dakikada toplandı (aramalı toplamanın 5 katı veri,
1/3 sürede). Ama karar-içi sıralamada %25.5 — tabanın 25 puan altında.
Hat çalışıyor ve tekrar kullanılabilir; ama bu hedef için yetmedi.

⚠ Etiket seyrek: birimin kendi kredi hanesi 10 saniyede %83 oranında hiç değişmiyor.

---

## E · AÇIK BORÇ / DÖNGÜSELLİK

**Tavan ölçümü kendi ölçütüyle ölçülüyor.** "Masada 60,6 var" derken, kusurlu olduğunu
zaten ölçtüğümüz bir skora göre söylüyoruz. Aramanın onu maksimize etmesi +839
kazandırıyor, yani skor çöp değil — ama "4 katı masada" iddiası doğrusallık varsayıyor.

**Dürüst testi:** 25 adayın hepsini oynatan arama, GERÇEK maçta 2 oynatandan çok mu
kazanıyor? Tam ayarda ~25 saat; kısa maçlarla (120sn) 8 işçide **~1 saat** → yapılabilir.

---

## E2 · ⚠ ARAMANIN FORK'U MAYINLARI SİLİYORDU (2026-08-17, ölçüldü ve düzeltildi)

Emir ömrü işine başlarken zorunlu replay kapısı koşuldu ve **taban durumda düştü**
(4/4 geçmesi gerekirken 2/4). Sapma alanı tahminle değil ölçümle bulundu
(`tools/replay-sapma-teshis.js` YENİ — hangi birimin hangi alanı, tik çözünürlüğünde).

**İki bağımsız kök neden çıktı:**

| # | kusur | kanıt |
|---|---|---|
| 1 | `battleForkRestore` mayın dizisini **temizliyor**, `battleForkCapture` mayınları **hiç almıyordu** | tohum 500003, tik 801: canlı 0 mayın / replay 1 |
| 2 | Sahiplik senkronu replay'de koşmuyor; **ele geçirme** `controllerId`'yi siliyor | tik 1047 ele geçirme → tik 1049 canlı `PLAYER` / replay `ENEMY_AI` |

**1'in ağırlığı replay'in ötesinde:** aramanın HER rollout turu (100 tikte bir)
haritadaki **iki tarafın da bütün mayınlarını kalıcı olarak siliyordu.** Yani:

- Canlı oyunda **ÖNGÖRÜ seviyesi mayın alanlarını yok ediyordu** (oyuncununkiler dahil).
- Arama açık koşularda mayın lehine olan taraf sessizce cezalandırılıyordu →
  **aramanın ölçülmüş +839'u bu kirlilikle elde edildi**, yeniden ölçüldü ↓

### ✔ ARAMA YENİDEN ÖLÇÜLDÜ (B kapısı, temiz kod, n=192)

| kol | saldıran % | marj ort | t |
|---|---:|---:|---:|
| arama KAPALI | %35,9 | −775 | −4,18 |
| arama AÇIK | %46,4 | −40 | −0,21 |

**Eşleştirilmiş fark: +735, t 3,55 — saptama tabanı 580, ölçülen etki TABANIN ÜSTÜNDE.**

Bu gecenin tek **tam güçlü** sonucu bu. Arama, mayın kusuru düzeltildikten sonra da
çalışıyor: eski +839 yerine +735 — aynı büyüklük sınıfı, ama artık temiz kodla ve
saptama tabanının üstünde ölçülmüş. Yani mayın kaçağı ölçümü şişirmiş ama
**yaratmamış**; aramanın değeri gerçek.

Yan bulgu: arama kapalıyken saldıran %35,9 (t −4,18) — yani bu kurulumda savunan
yapısal olarak avantajlı ve arama bu farkı büyük ölçüde kapatıyor.

Kapı neden görmedi: `battleStateHash` mayınları HİÇ saymıyordu (`battleStateHashParts`
sayıyordu — asıl hash saymıyordu). Sapma ancak dolaylı etkisi birim durumuna
yansıyınca, 240 tik sonra fark ediliyordu. **Mayınlar artık hash'te.**

Düzeltmeler: fork mayın capture/restore · `_mineTimer` snapshot'a · mayınlar hash'e ·
sahiplik değişimi `controller-assignment` olayı olarak kaydediliyor · motor sürümü
`-mayinfork` ile damgalandı. **Kapı: 6/6 temiz, 2000 tik, koruma=15, negatif kontrol
hâlâ yakalıyor.**

Ayrıca kayıtlı bir iddia çürüdü: *"ele geçirme HİÇ olmuyor"* — oluyor
(Unit.js:178-186 tetikleniyor, tohum 500003 tik 1047).

### Kusurun ASIL sebebi: KAPI YOKTU → `tools/fork-kapisi.js` (YENİ, kalıcı)

Mayın kaçağı aylarca görünmedi çünkü fork sınırını sınayan bir kapı hiç yazılmamıştı.
Yazıldı ve **iki ayrı ölçü** taşıyor (biri diğerini yakalamaz):

| ölçü | ne sınar | hangi kaçağı yakalar |
|---|---|---|
| **SADAKAT** | `hash(capture öncesi) == hash(restore sonrası)` | mayın kusuru (restore siliyordu) |
| **TEKRAR** | aynı fork'tan N rollout aynı hash | kontrolör kaçağı (rollout-1 zemini kirletiyordu) |

Negatif kontrol: capture'dan mayınlar kasten atılır → kapı DÜŞMELİ.
**Durum: SADAKAT 6/6 · TEKRAR 6/6 · negatif kontrol yakaladı → GEÇTİ.**

⚠ Bu kapı arama açıkken değil, **fork'un kendisinde** koşar — yani aramadan bağımsız
olarak fork'u kullanan her şeyi (rollout, ışınlama denemeleri, gelecekte Worker) korur.

### Hash'in görmediği alanlar için: `tools/fork-derin-denetim.js` (YENİ)

Fork kapısı hash'le sınar, ama hash bir SEÇKİ: `manualMoveTarget`, `_laUntilTick`,
kontrolör ağacının çoğu alanı hash'te yok. Mayın kusuru hash'e girene kadar tam da bu
yüzden görünmedi. Bu araç hash yerine **durumun kendisini** gezip alan alan diffliyor
(birimler + kontrolör ağacı + siper/mayın/destek/bekleyen-vuruş/duruş/para/forensik).

**Sonuç: 8 kontrol noktası, nokta başına 15–43 bin alan, FARK 0 → fork sızdırmıyor.**

Araç yazılırken iki kez kendi kendini yanılttı ve ikisi de kayda değer:
1. **Sahte 2435 fark:** döngü tespiti "görülmüş her nesne" ile yapılıyordu; `replayClone`
   takma adları kırdığı için paylaşılan referanslar fark gibi görünüyordu. Doğrusu
   **ata zinciri** — yalnız gerçek döngüde tetiklenir.
2. **Kör negatif kontrol:** "40 yakalandı" sanılan sayı aslında `_seenEnemyRefs`
   artefaktıydı; mayın sabotajı hiç yakalanmamıştı çünkü o tohumda mayın yoktu.
   Düzeltme: sabotaj siperleri de düşürür + negatif kontrol **en çok içeriği olan
   tohumda** koşar (ölçülerek seçilir, tahminle değil).

Tek "fark" bilinen ve **doğrulanmış** istisna: `_seenEnemyRefs` ölü-vekili. Fork yalnız
sağ birimleri taşır, ölü düşman `{id,dead,type}` vekiliyle döner. Tüketicilerin sadece
`ref.dead` ve `ref.type` okuduğu **koddan doğrulandı** (BattlePerception.js:109 ve :206),
varsayılmadı.

---

## F · BUGÜNÜN DESENİ — "bilgi var, kullanan yok"

Üç bağımsız örnek çıktı ve muhtemelen daha var:

| ne | durum |
|---|---|
| `SIM.pendingHits` (gelen ateş: nereye, ne zaman, yarıçap) | tam kayıt, **hiç okunmuyor** |
| Kredi defteri 5 kanalı (`gorusTekil`, `tespit`, `siperTik`, `havaCaydirma`, `kapma`) | tanımlı, **hiç yazılmıyor** |
| `_laUntilTick` (emir ömrü koruması) | atanıyor, **hiç okunmuyor** → 2026-08-17 BAĞLANDI (`BATTLE_LA_EMIR_KORUMA`) |

Kullanıcının teşhisi — *"AI'nin potansiyeli var ama kullanamıyor"* — ölçüldüğü her
yerde doğrulandı. Tavan ölçümü de aynı yöne: en iyi aday kararların **%72'sinde**
oynatılan 2'nin içinde bile değil.

---

## Öncelik gerekçesi (2026-08-17 sonrası, GÜNCEL)

Değer-ağı/GPU dalı kapandığına göre kalanlar:

1. **Emir ömrü** — en ucuz aday. Emirlerin %50'si 1 saniyede eziliyor; +839 bu israfla
   elde edilmiş. Koruma (`_laUntilTick`) yazılmış ama bağlanmamış. Ön kapı gerekmez
   (kusur kesin), doğrudan maç kapısı. ⚠ Ezmenin meşru sebepleri olabilir → ölçülmeden bağlanmaz.
2. **Worker** — ölçülmüş +839'u TAM güçle oyuna taşıyan tek yol. Mühendislik işi,
   araştırma değil. Yol haritasının en baştaki cevabıydı; "bütçe duvarı çözüldü" diyerek
   erken elemiştim (verimi gecikme sanmıştım).
3. **Uzun ufuk (10-15sn)** — ön kapıyı geçti (%28.6 karar değişiyor). Ufku KISALTMAK
   ölçülüp öldürülmüş, UZATMAK hiç denenmemiş.
4. **Gerçek tavan** — 25 adayı oynatan arama gerçek maçta kazanıyor mu? Kısa maçlarla ~1 saat.
5. **Rakip modeli** — katman atfına göre insan farkının %47'si durum değerlendirmede;
   aramanın dokunduğu katmanda fark %0. En büyük ölçülmüş kaldıraç, ama en pahalı.
6. **Eylem uzayını genişletmek** (çekil / ateş kes / hedef seç) — %40'lık yürütme katmanı.
