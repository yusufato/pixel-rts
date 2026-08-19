# GÖREV — İKİNCİ MAKİNE (2026-08-19 sürümü)

> Bu dosya ikinci makinedeki oturum için yazıldı. **CYBORG** (16 mantıksal çekirdek) tarafından
> hazırlandı. Kullanıcı sana "işleme başla" dediğinde: **önce bu dosyayı sonuna kadar oku**,
> sonra 1. bölümden sırayla uygula.

---

## 0. KİMLİK VE SINIRLAR

Sen **ikinci makinesin** (20 çekirdek). Diğer makine **CYBORG**; şu anda kendi kapı kuyruğunu
koşuyor (faz10 → faz9) ve `js/` altında çalışıyor.

**DOKUNMA:** `js/` altındaki hiçbir dosya, `tools/gece-kuyrugu-*.sh`, `tools/rol-dengesi*.js`.
CYBORG oralarda çalışıyor; aynı anda ikimizin dokunması çakışma üretir.

**SENİN ALANIN:** `docs/kayit-m2/` (kendi log'ların) ve bu dosyanın sonundaki rapor bölümü.

**HİÇBİR ŞEY SEVK ETME.** Varsayılan değer değiştirme, bayrak açma, motor dosyası düzenleme
yok. Sen bir **ölçüm makinesisin**; hüküm birleşik kanıtla verilir.

---

## 1. İLK İŞ (sırayla, atlama)

```bash
git pull                      # CYBORG'un motoru ve araçları güncel olmalı
node --version                # 20+ bekleniyor
```

**Zorunlu okuma — bu üçü olmadan hiçbir sayıyı yorumlama:**

| dosya | neden |
|---|---|
| `docs/OLCUM-TUZAKLARI.md` | 10 tuzak. Hepsi **yaşandı**, hepsi ölçümü sessizce bozuyordu. |
| `docs/KAPI-DEFTERI.md` | bugüne kadarki bütün kapı sonuçları tek tabloda |
| `docs/PLAN-SIRADAKI.md` | en üstteki "2026-08-19 gecesi" bölümü — nerede olduğumuz |

**En kritik iki kural, özet olarak:**

1. **Hüküm `t`'ye göre değil SAPTAMA TABANINA göre verilir.** Bu depoda maç marjının std'si
   ~2600-3800; n=128'de ancak |etki| ≳ 700-900 güvenle yakalanır. `t = 2.4` görüp "anlamlı"
   demek bu gürültüde yanıltıcıdır.
2. **Taban altı iki ayrı şeydir:** std çok küçükse (<900) kol dünyayı kıpırdatmıyordur
   (*etki yok*); std normalse yalnızca bu n ile göremiyoruzdur (*ölçülemedi* — etkisiz
   demek **değil**).

---

## 2. GÖREVİN: TEKRAR KAPILARI (havuzlama için)

En büyük sorunumuz saptama tabanının yüksek olması. Aynı soruyu **ayrık tohumlarda** ikinci
kez ölçersek n=128 → 256 olur ve taban ~780'den ~550'ye iner. Bu, "ölçülemedi" damgalı
sonuçların çoğunu karara bağlar.

Bu yöntem bu projede **iki kez işe yaradı**: `LA_UFUK 100→200` ve `LA_DERIN 2→5` ikisi de tek
başına tabanın altındaydı, ayrık tohumlarla havuzlanınca geçti.

### TOHUM HAVUZUN: `200000-299999` — dışına ÇIKMA

Bu kural mutlak. Aynı tohum iki makinede koşarsa havuzlama **aynı maçı iki kez sayar** ve
etkiyi olduğundan güçlü gösterir. `tools/kapi-ozet.js --havuz` çakışmayı denetler ve
çakışma görürse havuzlamayı reddeder — ama en baştan çakıştırmamak senin işin.

### Koşacağın kapılar — TEK KOMUT, ve `nohup` ŞART

Dört kapı `tools/m2-kuyruk.sh` içinde sırayla tanımlı. **Ön planda çalıştırma:**

```bash
nohup bash tools/m2-kuyruk.sh > /dev/null 2>&1 &
```

⚠ **`nohup ... &` olmadan başlatırsan, kullanıcı VS Code'u kapattığı anda kapılar ÖLÜR.**
Saatlerce koşacak bir işi oturuma bağlamak, saatlerin çöpe gitmesi demektir. `nohup` ile
başlatılan süreç yetim kalır, işletim sistemine bağlanır ve oturum kapansa da devam eder —
CYBORG'da 20+ saatlik kuyruk tam bu şekilde oturumdan bağımsız koşuyor.

İzleme:
```bash
tail -f docs/kayit-m2/m2.log      # ilerleme
ps | grep node                     # canli mi
```

Kuyruğun içeriği (elle koşmak zorunda değilsin, betikte yazılı):

| sıra | kapı | tohum | not |
|---|---|---|---|
| M2-1 | `BATTLE_MENZILE_GIR` false/true | 220000 | **en kritik** — CYBORG'da +748, taban 768 (20 birim altında) |
| M2-2 | `LA_PERIYOT_TIK` 100/50 @ tam güç | 221000 | P1 ufuk 200'de geçti (+808) |
| M2-3 | `LA_DERIN` 2/5 @ ufuk 300 | 222000 | toplanma var mı |
| M2-4 | `BATTLE_TOPCU_DURAGAN` false/true @ tam güç | 223000 | yeni teşhis |

⚠ M2-1'e **tam güç ayarı EKLEME**. M1 tezgâh varsayılanında koşuldu (ufuk 100 / derin 2) ve
havuz ancak aynı koşullarda meşrudur. Betikte doğrusu yazılı, değiştirme.

### KOŞMA — bu ikisi CYBORG'da zaten kapandı

- `LA_KABA_ADIM` (5Hz rollout): **−2390, t −9.13** ile düştü. Tekrar gerekmiyor.
- `BATTLE_KARSI_BATARYA_HERKES`: **etki yok** (std 366). Kapandı.

---

## 3. İŞÇİ SAYISI — varsayma, ÖLÇ

`tools/rol-dengesi-paralel.js` işçi sayısını kendi seçer: `min(çekirdek−4, boşRAM/0.8GB)`.
Sabit tavan **kaldırıldı** çünkü o rakam CYBORG'a özeldi.

Senin makinende 20 çekirdek var ama kayıtta **~5 GB boş RAM** yazıyor. 0.8 GB/işçi ile bu
**6 işçi** demek — yani çekirdek değil **bellek** bağlayıcı olabilir. CYBORG'da tam bu yaşandı.

Başlamadan önce kontrol et:
```bash
node -e "const os=require('os');console.log('cekirdek',os.cpus().length,'· bos RAM GB',(os.freemem()/1e9).toFixed(1),'· secilecek isci',Math.max(1,Math.min(os.cpus().length-4,Math.floor(os.freemem()/1e9/0.8))))"
```
Boş RAM azsa **önce uygulama kapat** — CYBORG'da ölçüldü: bellek boşaltmak, işlemciyi
hızlandırmaktan daha çok kazandırıyor. Gerekirse `--isci N` ile elle ver, ama fiziksel RAM'i
**aşma**: takas başlarsa iş hızlanmaz, çakılır.

---

## 3b. ⚠ VS CODE KAPANINCA WINDOWS SENİ YAVAŞLATIR — ÖNCE BUNU KUR

**CYBORG'da yaşandı ve saatlere mal oldu.** VS Code kapatılınca etkileşimli oturum kalmıyor,
Windows node süreçlerini **arka plan** sayıp EcoQoS güç kısıtlaması uyguluyor. Sonuç ölçüldü:

| | CPU meşgul | efektif saat |
|---|---|---|
| VS Code açıkken | %62 | 3156 MHz |
| **VS Code kapandıktan sonra** | **%12** | **1392 MHz** |

Süreçler ölmüyor — **2,3 kat yavaşlıyor**. Ayrıca hibrit işlemcilerde Windows arka plan işini
bilerek **E-çekirdeklere** atar; "işler yanlışlıkla sanal işlemcilerde başladı" diye görünen
şey genelde budur ve **kendiliğinden düzelmez**, sonraki kapı da aynı yere düşer.

### Kuyruğu başlatmadan ÖNCE uygula

**Yönetici PowerShell'de** (bu komut yönetici ister):
```powershell
powercfg /powerthrottling disable /path "C:\Program Files
odejs
ode.exe"
```

Normal PowerShell'de (yönetici gerekmez):
```powershell
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 2
powercfg /setactive SCHEME_CURRENT
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

### Sonra DOĞRULA (kapatmadan önce, kapattıktan sonra)

```powershell
$d = Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation | ? { $_.Name -eq '_Total' }
"CPU %$($d.PercentProcessorTime)  ·  saat " + [math]::Round((Get-CimInstance Win32_Processor).MaxClockSpeed * $d.PercentProcessorPerformance/100) + " MHz"
```

⚠ **Tek ölçümle karar verme** — bu büyüklük ±%10 salınır. 8-10 örnek al, ortalamasına bak.
Ve kıyası **yalnız aynı işçi sayısında** yap; yük değişince rakam değişir ve karşılaştırma
anlamsızlaşır (CYBORG'da bu hata birkaç kez yapıldı).

Kapattıktan sonra CPU meşguliyeti yarıya düştüyse muafiyet tutmamıştır — yönetici komutunu
tekrar kontrol et.

---

## 4. BİTİNCE: RAPORLA VE PUSH ET

```bash
node tools/kapi-ozet.js --log docs/kayit-m2/m2.log --havuz   # kendi sonuçların
git add docs/kayit-m2/ docs/GOREV-MAKINE2.md
git commit -m "M2: <kapi adi> sonucu — <fark> (t <t>, taban <taban>)"
git push
```

CYBORG `git pull` ile senin sonuçlarını alıp kendi ölçümleriyle **havuzlayacak**
(`tools/kapi-ozet.js --havuz` ters-varyans ağırlığıyla birleştirir ve tohum çakışmasını
denetler).

### Rapor formatı — her kapı için tek satır

| kapı | n | fark | std | t | taban | hüküm |
|---|---|---|---|---|---|---|
| *(buraya yaz)* | | | | | | |

Hüküm sütununu **kendin yorumlama**: `|fark| ≥ taban` ise "geçti", değilse std'ye bakıp
"etki yok" ya da "ölçülemedi" yaz. İkisini karıştırma.

---

## 5. BİR ŞEY TERS GİDERSE

- **Kapı çöktü:** log'daki hatayı olduğu gibi yapıştır, kendi başına motor dosyası düzeltme.
- **Sonuç saçma görünüyor** (ör. iki kol birebir aynı marj): büyük ihtimalle kol
  uygulanmamıştır. `tools/rol-dengesi.js` kol atamasını geri okuyup doğruluyor ve tutmuyorsa
  gürültüyle düşüyor — ama sessiz bir durum görürsen **rapor et, yorumlama**.
- **Makine uyuyor:** prizde uyku/hazırda bekletmeyi kapat (`powercfg /change standby-timeout-ac 0`).
  CYBORG'da yaşandı; uyku ölçümü bozmaz (süreçler askıya alınır, öldürülmez) ama saat kaybettirir.

---

## 6. NEDEN BU İŞ ÖNEMLİ

CYBORG'un ölçtüğü tam güç konfigürasyonu (`ufuk 300 + derin 5`) **%79,7 saldıran galibiyeti**
verdi — bu projede ölçülen en yüksek oran. Ama sıradaki birkaç sonuç saptama tabanının hemen
altında kalmış durumda; onları karara bağlayan şey senin ayrık tohumların olacak.

Bir de bugün öğrenilen ve senin de uyman gereken ders var: bu motorda **yaklaşıklıkla
ucuzlatma** üç kez çöktü (ışınlama, ucuz puanlayıcıyla sıralama, 5Hz kaba adım).
**Birebir eşdeğer** optimizasyonlar güvenli, yaklaşıklıklar değil. Bir hızlandırma fikrin
olursa önce küçük bir kapıda sına — ucuzluğunu peşinen sayma.
