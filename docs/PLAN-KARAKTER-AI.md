# Karakter AI — FAZ 50 İÇİN NOTLAR (plan DEĞİL)

**Bu bir plan değildir, bilerek.** Kullanıcı 2026-08-07'de faz 33.1'de; karakter gelişimi kendi
yol haritasında **faz 50**'de ve arada ~1 ay var. O süre içinde hikâye katmanı değişecek, bu yüzden
fazlı bir uygulama planı yazmak bayat olurdu (bkz. projenin kendi "plan bayatlığı" dersi).

Burada yalnız **bayatlamayacak iki şey** duruyor: (a) 2026-08-07'de kodu okuyarak ölçülen eksik
listesi, (b) savaş AI'sinden pahalıya öğrenilen ilke.

> **Kullanılmadan önce DOĞRULA.** Aşağıdaki envanter 2026-08-07 tarihlidir. Faz 50'ye gelindiğinde
> her satır yeniden okunmalı — dosyalar değişmiş olacak.

---

## Hedef (kullanıcının ifadesi)

*"Bu savaş AI'si daha ilk adım. Asıl AI, hikâye modundaki karakter AI'ler. Onlara bu denli bir zekâ
bahşedersek oyun tam olarak Crusader Kings gibi olur."*

---

## 2026-08-07 envanteri (kod okundu)

| katman | dosya | o günkü durum |
|---|---|---|
| Karakter kimliği | `js/Character.js` | 4 kişilik ekseni (şahin/otoriter/halkçı/milliyetçi 0-100) + arketip + zar (savaşçı/diplomat/ekonomist). AI liderlerine persona'dan eksen üretiliyor. |
| Karakter kararı | `js/StoryAI.js` | `storyCommanderDecide` — komutanın hedef seçimi. Yani **askerî hamle**, karakter davranışı değil. |
| Sadakat / ihanet | `js/StorySocial.js` | Sadakat kayması, firar, darbe. **Değerli tohum** — ama karakter kararı değil, sayaç eşiği. |
| Kamuoyu | `js/StoryOpinion.js` | **Kohort → mesele** kanaati (kim hangi sorundan kimi sorumlu tutuyor). Nüfus düzeyinde. |
| Güç merkezleri | `js/StoryPowerCenters.js` | Kurumsal aktörler + politika defteri. |
| Dünya | 45 dosya, ~1.9 MB | Ekonomi, ticaret, seçim, kurumlar, göç, altyapı, siyasi kriz, şirketler, devlet kapasitesi. |

**Özet: dünya simülasyonu güçlü; eksik olan karakterin kendisi.**

---

## Eksikler (algılanan zekâya katkı sırasına göre)

1. **Karakter→karakter kanaati YOK.** Kanaat kohort→mesele düzeyinde. CK'nın motoru ise
   *kim kimden ne kadar hoşlanıyor ve NEDEN* matrisidir.
2. **Kalıcı amaç YOK.** Karakterler tepki veriyor, *istemiyor*.
3. **Hafıza YOK.** "Beni sen sattın" diyemiyorlar; kin/minnet yok.
4. **Karaktere karşı eylem uzayı YOK.** Entrika, ittifak, şantaj, itibar sarsma, suikast —
   karakterin *başka bir karaktere* uygulayabildiği eylem yok.
5. **Fraksiyon YOK.** Hoşnutsuzlar birleşip talep dayatamıyor.
6. **Yaşam döngüsü / veraset YOK** (anlatı üreteci).
7. **Niyet görünürlüğü YOK.** CK'da AI'ın *neden* öyle yaptığı okunur ("+30 şu, −40 bu").
   Görünmeyen zekâ, zekâ olarak algılanmaz — ve bu, emeğe göre en yüksek getirili madde.

---

## Taşınacak tek ilke (savaş AI'sinde pahalıya öğrenildi)

**Önce karar uzayı, sonra öğrenme.**

Savaş tarafında haftalarca öğrenme algoritmasını iyileştirdik; sonra ölçtük ki *mükemmel* seçici
bile kod-AI'yı yenemiyor (+771, t 1.80) — çünkü bir kararda yalnız 3 ayrık seçenek vardı.
Darboğaz öğrenme değil, uzayın darlığıydı. Karakter tarafında aynı tuzak hazır bekliyor:
"karakterler akıllansın" denince akla önce model gelir; oysa önce sorulacak soru
**"karakter neye karar verebiliyor?"**tur.

Ek not: CK'nın kendisi öğrenme kullanmaz — fayda-tabanlı skorlama + görünür gerekçe kullanır.
Algılanan zekânın kaynağı ML değil; kalıcı amaç, ilişki ve sonuçtur.

**Determinizm kuralı korunacak:** kararlar `storyRandom` kanallarından; LLM yalnız metin üretir.
Bu kural savaş tarafında replay/hash'i kurtardı.
