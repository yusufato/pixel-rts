# PLAN — Turnuva merdiveni: iki ray, tek merdiven

Tarih: 2026-08-05 · Durum: **ONAY BEKLİYOR** · Kullanıcı tasarımı + istatistik düzeltmesi
İlgili: [PLAN-BEONAI-V2-ODUL.md](PLAN-BEONAI-V2-ODUL.md) · [OLCUM-KRIZI-TOHUM-SAYISI.md](OLCUM-KRIZI-TOHUM-SAYISI.md)

---

## 0. Kullanıcının tasarımı (korunan çekirdek)

> 5000 tohum → 100'lük gruplar, her biri 20 maç → ilk 30 → 1500 → … → 1 şampiyon.
> **Her grup çıkışında eğitim çalışsın ki her kademe daha yetenekli olsun — bileşik faiz.**

İki sezgi doğru ve planın omurgası olarak KALIYOR:
1. **Kademeli eleme** — hesabı kötü adaylara harcamamak.
2. **Turlar arası eğitim** — her kademe bir öncekinden güçlü başlar (bileşik faiz).

## 1. Ölçülen sorun: eleme gürültüden sahte yetenek üretiyor

Simülasyon (100 aday, ilk 30 seçiliyor, 400 tekrar):

| senaryo | isabet/30 | seçilenlerin GERÇEK gücü | turnuvada GÖRÜNEN |
|---|---|---|---|
| **adaylar ÖZDEŞ**, 20 maç | **9.1** = saf şans | 0.500 | **0.628** |
| küçük fark (%3), 20 maç | 12.3 | 0.509 | 0.633 |
| orta fark (%8), 20 maç | 16.9 | 0.553 | 0.657 |
| orta fark (%8), 80 maç | 21.5 | 0.575 | 0.612 |

**Birebir özdeş adaylarda bile** merdiven "%62.8 kazanan" bir ilk-30 üretiyor. Bu prim
sahte; bir sonraki turda buharlaşıyor. Ama biz o sahte kazananları eğitime alıyoruz →
**bileşik faiz, bileşik yanılsamaya dönüşür.**

Kök sebep zaten ölçülmüştü: marj std sapması **3114**; ±1000 hassasiyet ~37 maç ister.
20 maç ile "ilk %30"u sıralamak mümkün değil.

## 2. Kavramsal düzeltme: tohum bir DÜNYA'dır, bir YETENEK değil

Tohum A ile tohum B savaşmaz — AI ikisini de oynar. "Tohum kazandı" demek "AI o dünyada
iyi sonuç aldı" demektir; bu **dünyanın zorluğunu** ölçer. Merdiven literal hâliyle
*en kolay senaryoları* seçer — eğitim için tam ters yön.

Çözüm merdiveni atmak değil, **iki ayrı ray**a ayırmak:

---

## 3. RAY-1 — SENARYO MERDİVENİ (5000 tohum, kullanıcının yapısı burada yaşıyor)

Tohumlar yarışmaz; **öğreticiliklerine göre** elenir. Ölçüt maç kazanmak değil:

| ölçüt | anlamı |
|---|---|
| **regret** = oracle-en-iyi − kod-AI-seçimi | AI orada ne kadar kötü seçiyor |
| **ödül yayılımı** = max − min aday ödülü | seçim orada önemli mi (ölçüldü: ort. 488) |
| **aktiflik** | temas var mı (temassızda 64 adayın 64'ü aynı ödülü alıyor) |

Bu üçü **tek maçtan** okunur ve gürültüsü maç sonucundan çok daha düşüktür — çünkü
karşı-olgusal ölçümdür, tek bir zar atışının sonucu değil.

**Merdiven (senin yapın, ölçüte bağlanmış):**

| tur | havuz | tur başına iş | kalan |
|---|---|---|---|
| 1 | 5000 tohum | her tohumda 1 maç + 3 karar noktası örneklemesi | en öğretici **1500** |
| 2 | 1500 | 6 karar noktası | 450 |
| 3 | 450 | 10 karar noktası | 180 |
| 4 | 180 | tam profil (~10 karar) | 30 |
| 5 | 30 | tam profil + rol değişimi | 10 → **çekirdek müfredat** |

**Her turdan sonra EĞİTİM** — senin bileşik faiz fikri tam burada işler ve burada
**meşrudur**: model her turda daha zor/öğretici senaryolarla eğitilir, bir sonraki tur
o güçlenmiş modelle koşulur. Bu, "hard example mining" + müfredat öğrenmesidir.

Ayrıca **bayatlama koruması**: her tur, bir önceki turun modeliyle koşulduğu için
regret haritası da güncellenir; kolaylaşan senaryolar kendiliğinden düşer.

## 4. RAY-2 — SÜRÜM TURNUVASI (kim daha iyi? — istatistik burada sert)

Adaylar **AI sürümleridir** (kompozisyon tarifi + gövde + beyin), tohum değil.
Burada eleme **güven aralığına** göre yapılır, sıralamaya göre değil:

> **Kural:** bir aday ancak **güven aralığı** lider adayın aralığının ALTINDA kalıyorsa elenir.
> Belirsizse elenmez — daha çok maç alır.

Bu, "ilk 30'u al" yerine "açıkça kötüleri at" demektir ve sahte prim üretmez.
Tur başına maç sayısı, alan daraldıkça artar (ardışık yarılama):

| tur | aday | aday başına maç | toplam maç | süre (1.38 maç/sn) |
|---|---|---|---|---|
| 1 | 256 | 12 | 3.072 | ~37 dk |
| 2 | 64 | 24 | 1.536 | ~19 dk |
| 3 | 16 | 48 | 768 | ~9 dk |
| 4 | 4 | 96 (dışörneklem) | 384 | ~5 dk |
| **toplam** | | | **5.760** | **~70 dk** |

Aynı bütçeyle 5000 adayı 20 maçta elemek (100.000 maç ≈ 20 saat) hem 17 kat pahalı
hem de yukarıda ölçüldüğü gibi **şansı seçiyor**. Ardışık yarılama bütçeyi ayırt
edebildiği yere harcar.

**Kural:** son tur **final havuzunda** (hiçbir seçimde kullanılmamış tohumlar) koşulur.

## 5. İki ray nasıl birleşir (bileşik faiz burada)

```
RAY-1 turu → müfredat güncellenir → beonai eğitilir (GPU, saniyeler)
                                          ↓
RAY-2 turu → yeni sürüm eski sürümle ve kod-AI ile YARIŞIR (güven aralığıyla)
                                          ↓
                          kazanan sürüm → RAY-1'in bir sonraki turunu koşar
```

Her döngü: daha öğretici veri → daha iyi model → daha zorlu senaryolar. Senin
"bileşik faiz" tarifinin ta kendisi, ama bileşen **şans değil ölçülmüş kazanç**.

## 6. Maliyet (ölçülen hızlarla)

| iş | hız | 5000 tohum |
|---|---|---|
| RAY-1 tur-1 (tohum başına 1 maç + 3 karar) | ~1.38 maç/sn + 5sn/karar | **~7 saat** |
| RAY-1 tur-2..5 (alan daralıyor) | — | ~2 saat |
| RAY-2 tam merdiven | 1.38 maç/sn | ~70 dk |
| beonai eğitimi (tur başına) | GPU | saniyeler |

**Toplam ~10 saat** — bir gecede biter. Kullanıcının önerdiği düz yapı (~20+ saat) ile
karşılaştırıldığında hem ucuz hem istatistiksel olarak geçerli.

**Kademeli başlangıç önerisi:** önce 500 tohumla tüm merdiveni koş (~1 saat), boru
hattının çalıştığını gör, sonra 5000'e çık. FAZ 2'de öğrendik: büyük koşuya girmeden
önce küçük koşuyla aracı doğrula.

## 7. Değişmeyen kurallar

1. Sürüm kararı **maç sonucudur**, karar-seviyesi skor değil.
2. Eleme **güven aralığıyla**; "ilk N" ile değil.
3. Final havuzu hiçbir seçim kararında kullanılmaz.
4. Her tur raporu: elenen aday sayısı, düşen tohum, kör eksen — sessiz kırpma yok.
5. Determinizm kapıları her kod değişiminde.
