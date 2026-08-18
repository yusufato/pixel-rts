# SIRADAKİ İŞLER — bağımlılıklarıyla

Kullanıcı uyarısı: *"planlar birikiyor."* Bu projede plan bayatlığı kayıtlı bir hata
sınıfı, o yüzden liste **ölçüm durumu** ve **bağımlılık** ile birlikte tutulur.
Damgasız satır yoktur: her iş ya ÖLÇÜLDÜ, ya ÖN KAPIYI GEÇTİ, ya HENÜZ SINANMADI.

---

---

# ⭐ 2026-08-19 GECESİ — SONUÇ TABLOSU (sabah ilk buraya bak)

## KAPIYI GEÇEN TEK ŞEY: uzun ufuk. Ve uygulandı.

| kapı | n | eşleştirilmiş fark | t | saptama tabanı | sonuç |
|---|---|---|---|---|---|
| **H3 · LA_UFUK 100→200** | 128 | **+874** | 3,13 | 783 | **TABANIN ÜSTÜNDE** |
| **D+H3 havuz** (ayrık tohum) | 256 | **+603** | 3,13 | 540 | **TABANIN ÜSTÜNDE** |
| H1 · LA_DERIN 2→5 | 128 | +656 | 2,43 | 755 | az altında → doğrulama kuyrukta |
| H2 · yayılım kapısı gevşek | 128 | +330 | 1,32 | 700 | anlamlı değil |

Saldıran galibiyeti **%50,0 → %63,3**. Tohumlar ayrık (D `100000..127`, H3 `109000..127`);
D tek başına anlamlı **değildi** (+357, t 1,34) — kararı veren önceden kararlaştırılmış
**tekrar**, havuz yalnızca onu güçlendiriyor.

**Uygulandı**: `js/lookahead-worker.js` → `LA_UFUK = 200`. Ana iplikte değil (orada donma
demek). Canlıda yalnız ÖNGÖRÜ kademesinde açılır ve o kademede işçi devrede — yani kazanç
gerçekten oyuna iniyor. Bedeli `tools/ufuk-maliyet.js` ile ölçüldü: **×1,58** (ufuk 300 ×2,22),
beklenen ×2,00'ın altında çünkü tur maliyetinin bir kısmı ufuktan bağımsız sabit iş.

## Gecenin dersi

Aynı gece beş **çevre düzeltmesi** denendi — gözcü, lojistik, emir ömrü, demet, yayılım
kapısı — **hepsi** saptama tabanının altında kaldı. Kaldıraç aramanın kendisinde çıktı.
Worker kapasiteyi açtı; kazandıran, o kapasiteyi *kullanmak*. Kuyruktaki iki faz bu
ekseni sonuna kadar sürüyor.

## Kuyrukta (sabaha kadar)

| faz | kapı | soru |
|---|---|---|
| 3 | K1 | karşı-batarya herkese açılsın mı |
| 4 | M0 / M1 | `_menzileGir` — kısa menzilli birim öne gitsin mi |
| 5 | U0 · K0b · H1b · H4 · W0 | ufuk maliyeti · düzeltilmiş mekanizma · LA_DERIN doğrulama · ufuk 200 vs 300 · canlı tarayıcı |
| 6 | P1 · P2 | karar sıklığı 100→50 tik · aday genişliği halka 3→5 |

## Ölçülüp GERİ ÇEKİLEN üç iddia (kod değişmedi)

1. **"16 birim navigasyon tıkanıklığından ateş edemedi."** `navBlocked` "takılı" demek
   değil, "hedefe düz çizgi arazi tarafından kapalı" demek. Gerçek takılma ölçüsü
   eklenince kova **tamamen boşaldı**.
2. **"MANPADS menzilinde düşman varken hedef seçmiyor."** `menzilimdeDusman` kara
   düşmanını da sayıyor; MANPADS/SAM karaya ateş edemez. Doğru davranıyordu.
3. **"Kamikaze dronları SAM şemsiyesi altında doğduğu için ölüyor."** Ölçüldü: şemsiye
   altında %20, dışında %19 → **fark yok**. Mekanizma bilinmediği için maç kapısı
   harcanmadı.

## Aletlerde bulunan üç kusur

1. `tools/karsi-batarya-mekanizma.js` **çöktü** (`performAttack` global değil, Unit metodu).
   Artık telemetri `combatEvents`'ten sayıyor — gerçek maçlarla aynı ölçü.
2. `LA_HALKA`/`LA_YON`/`LA_YARICAP` **`const`** idi: A/B tezgâhı onları değiştiremiyordu ve
   bir kapı açılsa "fark yok" diye **sahte** sonuç verirdi. `let` yapıldı; tezgâh artık kol
   atamasını **geri okuyup doğruluyor** (negatif kontrol geçti).
3. **İşçi köprüsü sayaçları maç başına sıfırlanmıyordu.** 4 gerçek maçta "emir 169/279/369/463"
   göründü; gerçek maç başına 169/110/90/94 idi. Bu, kısa süre "işçi emirleri replay'e
   yazılmıyor" gibi ciddi bir motor kusuru şüphesi doğurdu — motorda kusur **yoktu**.
   Sıfırlama eklendi + analiz aracına çapraz doğrulama nöbetçisi kondu.

## Açık uçlar (kanıt var, karar yok)

- **Aramanın payı emirlerin yalnız %10-19'u.** Gerçek maç başına: tur 29-72, emir 90-169,
  buna karşılık kontrolör emri 404-1071. Arama turda ~4 birim oynatıyor, ~8'i yayılım
  kapısına takılıyor (eleme %64-71). Kanıtlanmış kaldıraç bu kadar dar bir yüzeyden
  geliyor — payı büyütmek (faz 6 · P1) doğrudan bunu hedefliyor.
- **Arama hava birimlerine hiç dokunmuyor** (`!u.isAir` süzgeci). Helo AI'nın 1 numaralı
  katili olarak ölçülmüştü; SİHA ve kamikaze de aramanın dışında.
- **Kamikaze %19 isabet** (32 dronun 6'sı). Bütçe kaybı değil (operatör yükü, yeniden
  doluyor) ama 25 saniyelik dolum döngüsü boşa gidiyor. Mekanizma **bilinmiyor**.
- **Piyade sınıfı boşta**: menzil 300px, en yakın düşmana ortalama 1031-1397px. 4 maçta
  ateş etmeyen 49 birimin 17'si bu sınıf. `_menzileGir` kuralı (M1 kapısı) tam bunu hedefliyor.

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

### E doğrulaması — A'yı DOĞRULAMADI (kazananın laneti)

| kapı | tohum | koruma 15 vs 0 | t |
|---|---|---:|---:|
| A | 100000+ | +486 | 2,10 |
| **E** | **100192+ (taze)** | **+277** | **1,12** ✗ |
| **havuz** | n=384 | **+388** | **2,30** |

Havuz ters-varyans ağırlığıyla (`tools/kapi-birlestir.js` YENİ — ayrı tohumlu kapılar
havuzlanabilir, aynı tohumlular TOPLANAMAZ). Havuzda bile etki saptama tabanının
(±473) **altında**; bu büyüklüğü %80 güçle yakalamak **n≈572** ister (elde 384).

Bu tam beklenen desen: ilk kapı şanslı çıkmış, doğrulama küçültmüş. Karar hâlâ YOK.

### F doğrulaması da ÇÖKTÜ → emir ömrü İSPATLANMADI

| kol | ilk kapı | taze tohumla doğrulama | havuz (n=384) | saptama tabanı |
|---|---:|---:|---:|---:|
| koruma 1 (MOVE) | +552 (t 2,72) | **+64 (t 0,29)** | +328 (t 2,20) | 419 ⚠ |
| koruma 15 (tam) | +486 (t 2,10) | **+277 (t 1,12)** | +388 (t 2,30) | 473 ⚠ |

Dört bağımsız kapının dördü de pozitif (işaret tutarlı) ama **her doğrulama büyüklüğü
küçülttü** ve havuzda bile etki saptama tabanının altında. Bu etkiyi (~+350) kanıtlamak
arm başına **n≈630** ister; elde 384 → arm başına ~3 saat daha ölçüm.

**KARAR: varsayılan 0 kalıyor, iş RAFA kaldırıldı.** Gerekçe ekonomik: aramanın kendisi
zaten kanıtlanmış +735 veriyor ve oyunda KISILMIŞ koşuyor. ~+350'lik bir mikro-ayarı
5 saat ölçmektense, kanıtlanmış +735'i tam güçle oyuna sokmak (Worker) daha büyük kaldıraç.

G kapısı (1 vs 15 doğrudan) 65. dakikasında makine kapatılınca kesildi — sonuç yok.

**Yeniden açılırsa:** `BATTLE_LA_EMIR_KORUMA` bağlı ve çalışıyor; tek eksik n.

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

## G · WORKER — ölçüldü, ve tasarım DEĞİŞTİ (2026-08-18)

"Mühendislik işi, araştırma değil" diye sıraya koymuştum. Yazmadan önce iki şey
ölçüldü ve ikincisi tasarımı değiştirdi.

### Maliyet SORUN DEĞİL (`tools/worker-fizibilite.js`)

Anahtar içgörü: **`battleForkCapture()` zaten dünyanın tam serileştirmesi** ve
`fork-derin-denetim.js` onun eksiksiz olduğunu ölçtü. Yani worker'a ne gönderileceği
araştırılacak bir şey değil — fork'un kendisi.

| | ölçüm |
|---|---|
| fork boyutu | 612 KB (423–770) |
| stringify + parse | **10,3 ms** |
| arama turu (tam ayar) | **2834 ms** (en kötü 6622) |
| serileştirme / arama | **%0,4** |

Ana iş parçacığında kalan yük tur başına ~10ms. Kabul.

### GECİKME — ilk okumam YANLIŞTI, aracın kendi verisi çürüttü

`tools/emir-bayatlama.js` ilk sürümü "3sn gecikmede değerin **%45,9'u** korunuyor"
dedi ve ben bundan "worker öngörülü olmalı" sonucunu çıkardım. **Geri çekiyorum.**

Eğriyi çıkarınca desen bozuldu — gecikme arttıkça kayıp ARTMIYOR:

| gecikme | havuzlanmış "korunan değer" |
|---|---:|
| **1 tik (≈0 sn — KONTROL)** | **%43,5** |
| 20 tik (1,0sn) | %37,3 |
| 60 tik (3,0sn) | %45,9 |
| 100 tik (5,0sn) | %44,7 |

**Gecikme sıfırken bile %43,5.** Yani ölçtüğüm şey gecikme değil, aracın tabanı.
Karar-başı medyan oran k=1'de tam **1,00** (çoğu kararda bayat = taze, beklendiği gibi);
havuzlanmış oranı birkaç uç karar sürüklüyor.

**Kök neden:** `s_taze`, aynı anda LA_DERIN adayın **rollout skorları üzerinden max**
alıyor. Max-over-gürültü sistematik olarak şişer — skor seviyesinde kazananın laneti.
Bu yüzden oran, gecikme olmadan bile 1,0'ın çok altında çıkıyor.

**Düzeltme:** oran yerine **eşleştirilmiş ham fark** (`s_taze − s_bayat`) + t testi.
Yanlılığı taşır ama SABİT taşır → gecikmeler ARASINDAKİ fark yorumlanabilir.

| gecikme | ham fark (taze − bayat) | se | t |
|---|---:|---:|---:|
| ≈0 sn (KONTROL) | 17,6 | 8,1 | 2,18 |
| 3,0 sn | 9,9 | 8,5 | 1,16 |
| 5,0 sn | 11,4 | 5,1 | 2,22 |

**Fark gecikmeyle BÜYÜMÜYOR.** k≈0'da 17,6 çıkması aletin yanlılık tabanıdır
(yansız olsa 0 olmalıydı); 3sn ve 5sn'deki değerler bunun altında/eşit.

**Dürüst sonuç: 5 saniyeye kadar gecikme maliyeti ÖLÇÜLEMEDİ.** Ama "yok" demiyorum —
aletin çözünürlüğü ±16 puan (2×se) ve bir kararın "yerinde kal"a göre tipik değeri
~47 puan. Yani **%35'e varan bir gecikme maliyeti bu aletin altında saklanabilir.**

### Worker tasarımı: hangi seçenek?

**Düz worker artık elenmiş DEĞİL** — icat ettiğim itiraz ölçümde durmadı.

Öngörülü worker (fork'u al, dünyayı k tik kendin ilerlet, oradan ara) yine de tercih:
AI-vs-AI'da **tam doğru** (sim deterministik, kontrolörler + `rngState` fork'un içinde),
maliyeti k tiklik ekstra simülasyon — worker'da zaten 2,8sn arama yapılıyor, yanında
3sn'lik ilerletme ucuz. Yani ücretsiz-e-yakın doğruluk; **ölçüm zorunlu kıldığı için
değil.** "Gecikme değerin yarısını yiyor" iddiası geri çekildi.

### ✔ MİMARİ KANITLANDI: `tools/worker-kapisi.js` (YENİ)

Tarayıcı Worker'ı yazmadan önce mimari Node `worker_threads` ile provaya alındı —
işçi kendi dünyasını kurar, ana taraftan gelen **yalnız fork'u** yükler, arar, emirleri
döndürür. İki ayrı iddia ayrı ayrı sınandı:

| ölçü | soru | sonuç |
|---|---|---|
| **EMİR EŞİTLİĞİ** | fork tek başına yeterli mesaj mı? | **3/3** (11 emir, birebir) |
| **ÖNGÖRÜ EŞİTLİĞİ** | işçi geleceği birebir tahmin edebiliyor mu? | **3/3** (hash eşit) |

Negatif kontrol (fork'tan mayınlar atılır) sapmayı yakaladı → kapı kör değil.

**Öngörü eşitliği kritik olan:** işçi dünyayı 100 tik (5sn) kendi ilerletip oradan
arıyor ve vardığı durum ana iş parçacığınınkiyle **birebir aynı**. Yani öngörülü worker
bir yaklaşıklık değil, AI-vs-AI'da tam doğru — ölçüldü, varsayılmadı.

⚠ Kapı ilk koşuda **boşa geçti**: `--ileri 60` ile T+60 arama periyoduna denk gelmiyordu,
iki taraf da 0 emir üretti ve "0/0 eşit" diye YEŞİL yandı. Araca "hiç emir üretilmediyse
SONUÇSUZ" koruması eklendi. (Bu gecenin üçüncü kör-kontrol vakası.)

### ✔ WORKER BİTTİ VE OYUNA BAĞLANDI (2026-08-18)

`js/lookahead-worker.js` · `js/BattleWorkerKopru.js` · `js/MiniDom.js` (DOM shim, tek
kopya) · `js/BattleLookahead.js`'e tek kanca · `index.html`'e tek `<script>` satırı ·
ÖNGÖRÜ kademesi seçilince `BATTLE_LA_WORKER_KIP` açılıyor.

**CANLI KAPI — kullanıcının gördüğü kusur ölçülerek çözüldü** (`tools/worker-canli-kapisi.html`):

| kol | en kötü kare | p95 |
|---|---:|---:|
| arama KAPALI | 31ms | 12ms |
| tam ayar, ANA İPLİK | **4432ms** | 1555ms |
| tam ayar, **WORKER** | **37ms** | 24ms |

Arama gerçekten koştu (3 tur, 3 emir, öngörü sapması **0**). Yani donma kaybolurken
güç kaybolmadı — "donma yok ama arama da yok" tuzağı kapıda ayrıca sınanıyor.

**Kapılar:** fork (SADAKAT/TEKRAR/JSON 4/4) · arama↔replay 4/4 · worker Node 2/2 ·
worker tarayıcı 2/2 · canlı kapı GEÇTİ.

### İnşa sırasında bulunan GERÇEK kusurlar (hepsi ölçülerek)

| # | kusur | nasıl görünüyordu |
|---|---|---|
| 1 | **fork JSON'dan geçince bozuluyor** (`-Infinity` → `null`) | "işçi farklı oynuyor" — oysa ana taraf KENDİ İÇİNDE tekrarlanamıyordu |
| 2 | işçi `gameLoop`'a giriyordu (Worker'da `rAF` VAR) | işçi kendi maçını oynayıp fork'un üstüne yazıyordu |
| 3 | işçi AI ayarlarını hiç kurmuyordu | işçi başka beyinle koşuyordu |
| 4 | worker yolu sayfaya göre çözülüyordu | köprü sessizce kapanıp kısılmış aramaya düşüyordu |
| 5 | ısınma turunu ana iplik üstleniyordu | maç başında tek kare **5343ms** |
| 6 | emirler geldiği anda uygulanıyordu | öngörülen ana ait emir ERKEN iniyordu (bayattan kötü) |

(1) en önemlisi: motorda bir kusurdu, worker onu yalnızca **görünür** kıldı.

### Kalan açık

⚠ **Worker'ın maç KAZANDIRDIĞI ölçülmedi.** Kanıtlanan şey "tam ayar artık
oynanabilir"; tam ayarın değeri (+735) ayrı bir kurulumda ölçülmüştü. Canlı kurulumda
worker'lı ÖNGÖRÜ vs kısılmış ÖNGÖRÜ maç kapısı henüz koşulmadı.

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
2. **Worker** — ölçülmüş **+735**'i TAM güçle oyuna taşıyan tek yol. "Mühendislik işi,
   araştırma değil" demiştim; **yanlıştı** — ölçünce bir araştırma sorusu çıktı (aşağıda).
3. **Uzun ufuk (10-15sn)** — ön kapıyı geçti (%28.6 karar değişiyor). Ufku KISALTMAK
   ölçülüp öldürülmüş, UZATMAK hiç denenmemiş.
4. **Gerçek tavan** — 25 adayı oynatan arama gerçek maçta kazanıyor mu? Kısa maçlarla ~1 saat.
5. **Rakip modeli** — katman atfına göre insan farkının %47'si durum değerlendirmede;
   aramanın dokunduğu katmanda fark %0. En büyük ölçülmüş kaldıraç, ama en pahalı.
6. **Eylem uzayını genişletmek** (çekil / ateş kes / hedef seç) — %40'lık yürütme katmanı.

---

## H · ÖLÇÜM EKONOMİSİ — üç iş aynı yere düştü (2026-08-18)

Kullanıcının iki gerçek maçı üç ayrı düzeltme adayı üretti. Üçü de **mekanizma kapısını
geçti, maç kapısını geçemedi** ve hepsi aynı bantta:

| iş | mekanizma | maç etkisi | saptama tabanı |
|---|---|---:|---:|
| emir ömrü (koruma 1) | hedefe varış %13,8 → %30,8 | +328 (t 2,20, n=384) | 419 ⚠ |
| lojistik yedek ikmal | ikmal ölünce cephane %3 → %21 | +364 (t 1,35, n=96) | 752 ⚠ |
| gözcü eşiği 3 → 2 | "Gözcü Yok" −1,6 puan | ölçülmedi (mekanizma küçük) | — |

**Bu bir tesadüf değil, bu projenin ölçüm ekonomisi.** Maç marjı std ≈ 2600; +350'lik bir
etkiyi %80 güçle yakalamak **n ≈ 440** ister (≈3 saat). Üç işi ayrı ayrı ispatlamak
9 saat eder. Aramanın kendisi (+833, t 4,34) tabanın açık ara üstünde olduğu için tek
seferde kanıtlanmıştı — kalan işler o büyüklükte değil.

### Çıkarılan strateji: DEMET

Üçü **bağımsız mekanizmalar** (yürütme / ikmal / tespit). Bağımsızlarsa etkiler toplanır
ve ~+1000'lik bir demet n=96'da saptanabilir. `BATTLE_AI_DEMET` üçünü birlikte açar.

Bağlandığı ÖLÇÜLDÜ (gözle doğrulanmadı — bu oturumda "koda baktım, doğru" birkaç kez
yanıldı): ordu ikmal 1→2, keşif 2→3, bedel 1 birim; emir koruması demette MOVE'u koruyor,
ATTACK'i korumuyor.

⚠ Demet geçerse "hangisi taşıyor" AYRI bir soru olarak kalır — ama önce "birlikte
değerler mi" sorusunun cevabı gerekir.

### Worker — BİTTİ

Canlı kapı: en kötü kare 4432ms → 37ms · arama gerçekten koşuyor (kullanıcının 2. maçında
54 tur, 206 emir, tüm emirlerin %26,6'sı) · işçi kendi ayarını bildiriyor (ufuk 100 /
derin 2 / birim 20 = TAM GÜÇ) · öngörü sapması AI-vs-AI'da **0px** (ölçüldü).
İnsan maçındaki sapma büyüklüğü kullanıcının bir sonraki maçında ilk kez görülecek.
