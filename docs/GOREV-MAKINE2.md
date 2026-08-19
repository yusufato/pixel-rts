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

### Koşacağın kapılar (bu sırayla)

Hepsi `tools/rol-dengesi-paralel.js` ile, hepsi `--tohum 128`.

```bash
# M2-1 · MENZILE GIR tekrari  (CYBORG'da M1: +748, taban 768 — 20 birim altinda kaldi!)
#        ⚠ AYAR YOK: M1 tezgah varsayilaninda kosuldu (ufuk 100/derin 2). Havuz ancak
#        AYNI kosullarda mesru — buraya LA_UFUK/LA_DERIN EKLEME.
node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 220000 \
  --kol BATTLE_MENZILE_GIR --koldeger false,true \
  --ayar "BATTLE_LOOKAHEAD_RED=true"

# M2-2 · KARAR SIKLIGI @ tam guc  (CYBORG'da P1 ufuk 200'de GECTI: +808, galibiyet %63->%75)
node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 221000 \
  --kol LA_PERIYOT_TIK --koldeger 100,50 \
  --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300;LA_DERIN=5"

# M2-3 · DERIN 5 ufuk 300'un ustune katiyor mu
node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 222000 \
  --kol LA_DERIN --koldeger 2,5 \
  --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300"

# M2-4 · TOPCU ATES DISIPLINI @ tam guc
node tools/rol-dengesi-paralel.js --tohum 128 --tohum0 223000 \
  --kol BATTLE_TOPCU_DURAGAN --koldeger false,true \
  --ayar "BATTLE_LOOKAHEAD_RED=true;LA_UFUK=300;LA_DERIN=5"
```

Her kapıyı kendi log'una yaz:
```bash
node tools/rol-dengesi-paralel.js ... 2>&1 | tee -a docs/kayit-m2/m2.log
```

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
