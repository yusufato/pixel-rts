# İnsan vs AI — SALDIRAN karşılaştırması (temiz motor)

**Kaynak:** kullanıcının 2026-08-04 tarihli iki gerçek maçı (Downloads ham kayıtları), **bütçe kaçağı düzeltildikten sonra**
oynandı → bu veriler temiz. AI tarafı `--matchtimeline` (pro yok) aynı motorda.

| | insan saldıran | AI saldıran |
|---|---|---|
| seed2024 | **attacker_dominant, 12 v 2** | kaybetti (kırmızı saldıran) |
| seed777 | **defender_eliminated, 13 v 1** | kaybetti |
| **VERİM** (hasar/kaybedilen₺) | **2.39 · 3.21 → ort 2.80** | **ort 1.05** |
| **YEREL KUVVET ORANI** (vurulurken 600px dost/düşman) | **7.33 · 2.63** | **ort 2.04** |
| ort. angajman mesafesi | 603 · 508 | ~400-750 (benzer) |
| dolaylı hasar payı | %28 · %20 | benzer |

## Ana bulgu: fark MESAFE değil, VERİM ve YEREL ÜSTÜNLÜK

İnsan saldıran, AI saldırandan **2.7× daha verimli** (kaybettiği her ₺ karşılığı 2.80 hasar; AI 1.05).
Angajman mesafesi ve dolaylı-ateş payı neredeyse aynı → fark "nereden ateş ettiğinde" değil,
**hangi koşullarda temas ettiğinde**.

Yerel oran bunu açıklıyor: insan vurulduğunda çevresinde **8.9 dost / 1.2 düşman** (seed2024) var.
AI saldıran ortalama **6.9 dost / 3.4 düşman**. Yani insan, düşmanın ZAYIF olduğu yerde dövüşüyor —
aynı sayıda dostla ama **3× daha az düşmanla** temas ediyor.
*(Not: AI'da seed3141 oranı 6.44 olduğu halde kaybetti → oran tek başına yeterli değil, gerekli görünüyor.)*

## seed2024'te kullanıcı doktrininin izi
Savunanın **ilk atışı t=71.5sn**. O ana kadar oyuncu **626 hasar bedava** verdi ve **hiç kayıp vermedi**
(6370₺ sabit, 30 birim). İlk 100 saniye saf uzun-menzil bombardımanı (1611 → 863 px).
Kullanıcının tarif ettiği "önce dolaylı atışla yıprat" fazı **gerçekten uygulanmış ve bedava çalışmış** —
AI savunan 71 saniye boyunca karşılık vermedi.
**Ama seed777'de bu faz YOK** (savunan t=17'de ateş açtı, bedava hasar 0) ve yine de 13-1 kazanıldı
→ bedava bombardıman *yeterli sebep değil*, verim/yerel-üstünlük iki maçta da ortak.

## Dikkat çeken birim kullanımı
- seed2024'te oyuncunun **en büyük hasar kaynağı SPAAG: 2733** (toplam hasarın ~%34'ü).
  SPAAG bir hava-savunma aracı; oyuncu onu kara hedefe karşı ana silah gibi kullanmış.
  AI'ın böyle bir kullanımı yok → **incelenmesi gereken bir insan-kalıbı**.
- seed777'de kaynak daha klasik: Tank 2125, AT 1169, TD 1122, ZMA 1023.

## Çıkarım (intel4-pro için)
Kaldıraç "daha uzaktan ateş et" veya "daha çok yumuşat" değil:
**temasa girerken yerel üstünlük kur** (düşmanın zayıf olduğu noktada dövüş).
Daha önce denenen iki müdahale bunu KURAMADIĞI için başarısız oldu:
- pasif kohezyon (bekle) → kütle toplanmıyor,
- aktif toplanma (kendi merkezine git) → dostu artırıyor ama düşmanı da artırıyor, oran sabit.
Gereken **düşman-zayıflığına göre yönelme** (schwerpunkt), yani sektör/ana-çaba seviyesinde bir karar.
