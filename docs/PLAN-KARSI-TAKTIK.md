# KARŞI-TAKTİK AI — rakibi okuyup karşı-plan kuran katman

**Durum:** planlanıyor (2026-08-19). Uygulama, açık maliyet kuyruğu bittikten sonra.
**Kullanıcının tanımı:** *"rakibin hareketlerinden taktiğini çıkarıp 'şunu yaparsam yenerim'
diyen bir şey lazım. Oyuncular karşıda gerçek bir profesyonel komutan olduğunu düşünsün,
basit taktiklerle AI'yı kandırıp kendini avutamasınlar."*

---

## Zincir ve nerede kopuyor

```
gözlem → İNANÇ → taktik sınıfı → karşı-plan → kalibre kazanma tahmini
     VAR ama KAPALI   ✔ YAZILDI      ✘ YOK        ✘ YOK
```

**2026-08-20 ilerleme:** `battleTaktikTespit()` yazıldı (js/globals.js) ve ilk şeması
`STANDOFF_ATIS` ölçüldü — `tools/taktik-tespit-olcum.js`, iki koşul aynı tohumda
(maviye dolaylı ateş zorlanmış vs tamamen çıkarılmış):

| koşul | tespit oranı | ort güven | ilk tespit |
|---|---|---|---|
| STANDOFF | %38,5 | 0,936 | tik 120 (6sn) |
| KONTROL | **%0,0** | — | — |

**Yanlış alarm sıfır**, şema başladıktan 6 saniye sonra yakalıyor. Ham oranın düşük
görünmesi paydadan: mavinin ateş etmediği anlar da sayılıyor, şema aralıklı uygulanıyor.
Karşı-plan tetikleyicisi için asıl ölçüt yanlış alarm + gecikme, ikisi de iyi.

**İnanç katmanı var — ama VARSAYILAN KAPALI.** ⚠ Bunu ilk yazdığımda "çalışıyor" demiştim,
yanlıştı: `js/globals.js:436` → `BATTLE_INTEL4_DELTAS = { ..., profile: false, ... }`.
Yani `updateThreatProfile` hiç koşmuyor. İlk tespit ölçümümde **0/41** çıktı ve sebep buydu.

Açıldığında çalışıyor: forensik çıkarım ("beni ne vurdu, hangi sınıf, nereden"), determinist,
sınıflar `areaAlpha / air / infiltrator / recon`, her sınıf için
`{detected, confidence, estPos, sourceIds}` ve kaynak birimler teyitli ölene dek kalıcı.
Kendi yorumu: *"Davranış-nötr (Faz A) — yalnız inanç+telemetri."*
Yani AI rakibi okuyabilir ama **ne okuyor ne de okuduğuyla bir şey yapıyor.**

`BattleSituation.js:395` bu profili `threatProfile` olarak taşıyor — yani veri planlama
katmanına **ulaşıyor**, orada kullanılmıyor.

## Elde hazır olan diğer parçalar

| parça | yer | durum |
|---|---|---|
| forensik inanç | `js/BattlePerception.js` `updateThreatProfile` | çalışıyor, davranış-nötr |
| sömürü arayıcı | `tools/somuru-arama.js`, `tools/somurucu-havuz.js` | çalışıyor |
| sömürücü davranışlar | `js/BattleExploiters.js` | çalışıyor |
| değer ağı | `js/BattleValueNet.js` | ρ 0,86 durum değerinde |
| maç kapısı tezgâhı | `tools/rol-dengesi-paralel.js` | çalışıyor |

**Ölçülmüş gerçek:** sömürü kompozisyonda değil **davranışta**. 19 aday / 32 maç taramasında
kompozisyon sömürüsü bulunamadı, ama **tek bir davranış botu AI'nın sağkalımını
%48,7 → %36,4** düşürdü. Yani "basit taktikle kandırılma" bu depoda somut olarak var.

## Eksik üç halka — bağımlılık sırasıyla

### 1. Taktik sınıfı (rakibin şeması)

Forensik "beni havan vurdu" diyor; gereken *"rakip **mesafede durup dolaylı ateşle yıpratma**
şeması uyguluyor"*. İyi haber: bu şemanın verisi ve etiketi **elimizde** — kullanıcının 4
gerçek maçından ölçüldü (`docs/OYUNCU-MACLARI-BULGULAR.md`):

- oyuncunun dolaylı isabeti 490, AI'nın 207 (2,4×)
- AI birim başına oyuncunun **2 katı** panikliyor (3,1 / 1,5)
- AI'nın kısa menzilli birimleri düşmana ortalama 2,79× menzil uzakta

### 2. Karşı-plan — ve bu MÜFREZE seviyesini zorunlu kılar

"Mesafede topçuyla yıpratma"ya karşı-plan, birim başına *"nerede durayım"* sorusuyla
kurulamaz. Karşı-plan bir **manevra nesnesidir**: *topçuyu bul → hızlı kanattan bas →
kalanı dağıt.* Bugünkü aramada böyle bir nesne yok; arama tek birimin 15 saniyelik
konumunu seçiyor. Müfreze soyutlaması bu yüzden "iyi olurdu" değil **zorunlu halka**.

### 3. Kalibre kazanma tahmini

*"%90 yenerim"* bir **kalibrasyon** iddiasıdır: %90 dediğinde 10 seferin 9'unda kazanmalı.
Ölçütü var (güvenilirlik eğrisi / Brier skoru) ve maç tezgâhı bunu ölçebilir.

⚠ **Bugün öğrenilen kritik sınır** (`docs/OLCUM-TUZAKLARI.md` 9. tuzak): değer ağı, bir
birimin 5-6 hedef noktasını sıralamada **rastgeleden iyi değil** (ilk-1 %10,8 vs taban %18,
n=55). Sebep kategorik — adaylar birbirinden tek birimin yürüyüşü kadar farklı, global
durum değeri bu farkla değişmiyor.

**Ama bu, karşı-plan sorusunu kolaylaştırıyor:** planlar birbirinden çok daha kaba farklarla
ayrılır. Ağın başarısız olduğu sorudan kategorik olarak daha kolay bir soru. Yine de
**varsayılmayacak, ölçülecek** — rastgele tabana karşı.

## "Kandırılmasın" ayrı bir mekanizma — zekâyla gelmiyor

Her akıllandırma yeni bir sömürü yüzeyi açar. Elde etme yolu döngüdür:
**sömürüyü sen ara, bul, kapat.** (AlphaStar'ın ligindeki "exploiter" ajanlarının işi buydu.)

Somut hedef: sömürü havuzunu **sürekli koşan bir kapıya** bağla — her sürümde koştur,
AI'yı eşikten fazla düşüren bir davranış bulunursa **sürüm geçmez**. Arayıcı zaten yazılı;
eksik olan kapı disiplini.

## İlk adım — tek taktik-karşıtaktik çifti, uçtan uca

Zinciri baştan sona kurmak haftalar. Ama **tek bir çift** uçtan uca kurulabilir ve
mimarinin çalıştığını kanıtlar (ya da ucuza yanlışlar):

**Tespit:** "menzilim dışından dolaylı ateşle bastırılıyorum"
— üç girdi de zaten telemetride: bastırılma oranı · vuran silah sınıfı (forensik) ·
mesafe/menzil oranı.

**Karşı-plan:** topçu avı önceliği + dağılma + kapatma hamlesi.

**Kapı:** bu davranışı uygulayan bir **sömürücü bota karşı** A/B. Sömürücü var, kapı var,
ölçü var. Geçerse elimizde *"inanç → sınıf → karşı-plan → ölçülmüş kazanç"* zincirinin
çalışan bir örneği olur; sonrası aynı kalıbı çoğaltmak.

## Bu katmanı kurarken uyulacak ölçüm kısıtları

- Maç marjı std'si **2600-3800** → n=128'de saptama tabanı ~700-900. Karşı-plan kazancı
  bunun altındaysa **tek maç kapısıyla görülemez**; mekanizma metrikleri (tespit isabeti,
  karşı-plan tetiklenme oranı) ayrıca ölçülmeli.
- Tespit doğruluğu **rastgele tabana karşı** raporlanmalı (9. tuzak).
- Mekanizma kapısı, maç kapısının ölçeceği **aynı rolü** kurmalı (8. tuzak — `_menzileGir`
  bu yüzden yanlış yorumlandı).
- AI-vs-AI kapısı oyuncunun tarzını üretmez; karşı-taktik kapıları **sömürücü bota karşı**
  kurulmalı, doğal AI'ya karşı değil.
