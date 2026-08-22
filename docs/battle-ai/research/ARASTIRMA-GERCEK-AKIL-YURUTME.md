# ARAŞTIRMA — "OYUN AI'Sİ" DEĞİL, AKIL YÜRÜTEN AI

> Kullanıcı: *"mutlak AI tarzı bir şeyi denememiş olmamız üzdü, bunun gibi çok önemli şeyler
> vardır. AI'mizi oyun AI'si olarak düşünme, gerçek akıl yürüten bir AI yapacağız."*

Bu belge alan taraması yapar ve bulunanları **bizim ölçülmüş gerçeklerimize** bağlar.
Genel tavsiye yok; her madde ya elimizdeki bir ölçümü açıklıyor ya da somut bir eksiği
adlandırıyor.

---

## 0. ÖNCE İYİ HABER — sandığımızdan ileriyiz

Üzülmeye gerek yok: son turda kurduğumuz şey, literatürdeki **AlphaZero tarifinin
kendisidir**. Eksik olan iki parça var, ikisi de adı konmuş.

| AlphaZero bileşeni | bizde | durum |
|---|---|---|
| Kusursuz simülatör (ileri model) | fork/restore, 27/27 birebir | ✅ **VAR** |
| Değer ağı (durumdan sonuç) | ρ 0.864, JS'e bağlı | ✅ **VAR** |
| **Politika ağı** (nereye bakılacağını söyler) | elle yazılmış analitik skor | ❌ **YOK** |
| **Ağaç araması** (çok katmanlı) | 1 katman, argmax | ❌ **YOK** |
| **Kendiyle oynama döngüsü** (arama→politika→arama) | yok | ❌ **YOK** |

**Kritik ayrım:** MuZero dinamiği *öğrenmek* zorundadır çünkü simülatöre erişemez.
Bizim **kusursuz simülatörümüz var** — bu nadir ve değerli bir konum. Yani MuZero
rejiminde değil, **AlphaZero rejimindeyiz** ve oradaki tarif bizde doğrudan uygulanabilir.
([MuZero'nun öğrenilmiş modelini çözümleyen çalışma](https://arxiv.org/abs/2411.04580),
[UniZero](https://openreview.net/forum?id=Gl6dF9soQo))

---

## 1. ALTI EKSİK — her biri bir ölçümümüzü açıklıyor

### 1.1 Politika ağı yok → "hangi adaylara bakayım" elle yazılı
**Ölçümümüz:** analitik eleyici K=3'te kazancın %72'sini koruyor; ağ-doğrudan %50-79.
Yani aday seçimi **kaba** ve bunu biliyoruz.

**Literatür:** AlphaZero'da aramayı bir **politika önceliği** yönlendirir — ağ "bu hamleler
bakmaya değer" der, arama de o dalları derinleştirir. Elle yazılmış sezgisel yerine
öğrenilmiş öncelik, arama bütçesini onlarca kat verimli kullandırır.

**Bizde karşılığı:** 25 adayı analitikle sıralamak yerine, politika ağıyla sırala.
Eğitim verisi **zaten üretiliyor**: aramanın seçtiği hamle, politikanın hedefidir.

### 1.2 Ağaç yok → 1 katman arama
**Ölçümümüz:** aday sayısı ~24'te doyuyor (+146'dan sonra artmıyor).
Bu bir **1-katman doyması**; daha çok aday aynı derinlikte bakmak demek.

**Literatür:** MCTS aynı bütçeyi *derinliğe* yatırır — umut veren dalı uzatır, kötüyü keser.
"24'te doyuyor" bulgusu ağaçla birlikte geçersizleşir.

### 1.3 Kendiyle oynama döngüsü kapalı değil ← **EN BÜYÜK KAYIP**
**Ölçümümüz:** arama, aramasız AI'yı **+1369 marj** yeniyor (t 3.15).

Bu şu demek: **aramanın çıktısı, mevcut politikadan daha iyi.** AlphaZero'nun tüm motoru
bu tek gözlemden ibarettir:

```
arama > politika  →  politikayı aramanın çıktısıyla eğit  →  politika güçlenir
                  →  aynı bütçeyle arama daha da güçlenir  →  tekrarla
```

Biz bu döngüyü **hiç kapatmadık**. Ölçtük, kanıtladık, orada bıraktık. Değer ağını
mevcut AI'ın maçlarından eğittik — aramanın maçlarından değil. Yani modelimiz *eski*
politikayı öğrendi.

### 1.4 Eylem uzayı ayrıştırılmamış
**Ölçümümüz:** 25 birim × 25 aday = 10³⁵ → imkânsız dedik ve orada durduk.

**Literatür:** AlphaStar'ın eylem uzayı adım başına ~**10²⁶**. Çözüm: **özyinelemeli
(autoregressive) ayrıştırma** — "ne yapayım" tek seferde değil, koşullu bir dizi karar
olarak üretilir (önce eylem türü, sonra hangi birim, sonra nereye). Kombinatoryal uzay
böylece doğrusal hale gelir.
([AlphaStar](https://deepmind.google/blog/alphastar-grandmaster-level-in-starcraft-ii-using-multi-agent-reinforcement-learning/))

Yani 10³⁵ bir duvar **değil**; yanlış sorulmuş bir soru.

### 1.5 Zamansal soyutlama yok
**Ölçümümüz:** üst-seviye plan zorlama **no-op** çıktı (yayılım 0); birim-hareket seviyesi
işe yaradı ama doydu. İki uç da tıkandı.

**Literatür:** bu, klasik **granülerlik** sorunudur. **Options** çerçevesi değişken süreli,
kapalı-döngü makro-eylemler tanımlar; planlama derinliğini doğrusal, karmaşıklığı üstel
azaltır. [OptionZero](https://arxiv.org/pdf/2502.16634) bunu MuZero üstüne kurar.
([Hiyerarşik RL derlemesi](https://thegradient.pub/the-promise-of-hierarchical-reinforcement-learning/),
[MAGIC — makro-eylem öğrenme](https://arxiv.org/pdf/2011.03813))

**Bizde karşılığı:** "şu noktaya git" (çok küçük) ile "MAIN_ATTACK" (çok büyük) arasında
bir katman yok. Öğrenilmiş makro-eylemler tam o boşluğa oturur.

### 1.6 Rakip çeşitliliği yok → strateji uzayı çökmüş
**Ölçümümüz:** demet savaşında 6 güçlendirme birimli orduda galibiyet **3 katı**, doğal
orduda **sıfır** — çünkü AI o birimleri hiç almıyor.

**Literatür:** bu tam bir **strateji uzayı çöküşü**. AlphaStar'ın **lig eğitimi**
(prioritized fictitious self-play) tam bunun için var: çeşitli rakipler seçilerek
döngüsel/dar öğrenme kırılır.

---

## 2. "AKIL YÜRÜTEN AI" — ne demek, ne değil

Kullanıcının istediği şeyi somutlaştırmak gerekiyor, yoksa slogan kalır.

**Değil:** LLM'e "ne yapayım" diye sormak. 2026 taraması bunun sınırını açıkça yazıyor —
[uzun ufuklu planlamada akıl yürütme modelleri başarısız oluyor](https://arxiv.org/pdf/2601.22311).
Bizim zaten *gerçek* bir dünya modelimiz var; LLM'i simülatör yerine koymak geriye gitmek olur.

**Öyle:** akıl yürütme = **iç modeli üzerinde arama yapıp kendi çıkarımını doğrulayabilmek.**
Üç ölçülebilir yetenek:

| yetenek | ölçütü | bizdeki durum |
|---|---|---|
| **Öngörü** | eylem → sonuç tahmini doğru mu | ✅ ρ 0.864 |
| **Seçim** | daha iyi eylemi bulabiliyor mu | ✅ +1369, t 3.15 |
| **Doğrulama** | kendi seçimini sınayıp reddedebiliyor mu | ❌ **YOK** |
| **Gerekçe** | neden seçtiğini söyleyebiliyor mu | ❌ **YOK** |

Son ikisi literatürde **süreç ödül modelleri (PRM)** ve **öz-yansıma** olarak geçiyor:
sonucu değil her adımı doğrulamak, başarısız gidişatı geri besleyip yeniden aramak
([LATS](https://dl.acm.org/doi/10.5555/3692070.3694642),
[arama + öz-geri bildirim](https://arxiv.org/pdf/2502.12094)).

**Bizde somut karşılığı:** aramanın seçtiği hamle, *baskın* mı? (planda tanımlandı ama
ölçülmedi) Baskın değilse AI "emin değilim" diyebilmeli ve daha çok bütçe harcamalı.
Bu, oyun AI'sinde nadir ama akıl yürüten sistemin tanımı.

---

## 3. UYGULAMA SIRASI — getiri/maliyet

| # | iş | dayanak | maliyet |
|---|---|---|---|
| **R1** | **Kendiyle oynama döngüsünü kapat**: aramanın seçtiği hamleleri topla → politika ağı eğit → aramanın önceliği yap | +1369 zaten kanıtlı; veri üretimi hattı kurulu (`tools/durum-veri.js` deseni) | orta |
| **R2** | **Değer ağını arama maçlarından yeniden eğit** | mevcut ağ ESKİ politikayı öğrendi | düşük |
| **R3** | **Ağaç araması** (1 katman → MCTS) | "24 adayda doyma" 1-katman artefaktı | orta |
| **R4** | **Baskınlık + emin-değilim** ölçümü ve bütçe uyarlaması | akıl yürütmenin ölçülebilir tanımı; maliyeti ~0 | düşük |
| **R5** | **Makro-eylemler** (options) | plan seviyesi no-op, hareket seviyesi doydu — arası boş | yüksek |
| **R6** | **Lig eğitimi / rakip çeşitliliği** | "AI o birimleri hiç almıyor" | yüksek |
| **R7** | **Eylem uzayı ayrıştırma** (autoregressive) | 10³⁵ duvarı aslında yanlış soru | yüksek |

**R1 açık ara ilk.** Sebebi: kanıtlanmış bir üstünlüğü (arama > politika) kalıcı hale
getiren tek mekanizma o. Şu an her maçta aramayı sıfırdan koşuyoruz ve öğrendiğimiz
hiçbir şey birikmiyor.

---

## 4. DÜRÜST UYARILAR

1. **AlphaZero tarifi bizde birebir çalışmayabilir.** O tarif çift taraflı, sıra tabanlı,
   tam bilgili oyunlar için. Bizimki gerçek zamanlı, sis var, eşzamanlı hareket var.
   Uyarlama gerekir; kopyalama değil.
2. **Kendiyle oynama döngüsü sessizce bozulabilir.** Politika kendi çıktısını öğrenirse
   dar bir stratejiye kilitlenir. Lig eğitimi (R6) bunun panzehiri — R1'i açarken
   çeşitlilik ölçüsü de izlenmeli.
3. **Ölçüm disiplini bırakılmamalı.** Bu turda beş kol boyunca gürültüyü optimize ettik ve
   sebebini ancak hedefin kararsızlığını ölçünce anladık. Yeni her mekanizma için önce
   "bu gerçekten farklı bir şey üretiyor mu" ölçülmeli.
4. **"Ölçüldü ama bağlanmadı" hatası tekrarlanmasın.** Değer ağı aylarca öyle durdu;
   arama şu an öyle duruyor (yol haritası madde 0).

---

## KAYNAKLAR

- [UniZero: Generalized and Efficient Planning with Scalable Latent World Models](https://openreview.net/forum?id=Gl6dF9soQo)
- [Demystifying MuZero Planning: Interpreting the Learned Model](https://arxiv.org/abs/2411.04580)
- [OptionZero: Planning with Learned Options](https://arxiv.org/pdf/2502.16634)
- [AlphaStar: Grandmaster level in StarCraft II](https://deepmind.google/blog/alphastar-grandmaster-level-in-starcraft-ii-using-multi-agent-reinforcement-learning/)
- [Language Agent Tree Search (LATS)](https://dl.acm.org/doi/10.5555/3692070.3694642)
- [Why Reasoning Fails to Plan: Long-Horizon Decision Making in LLM Agents](https://arxiv.org/pdf/2601.22311)
- [A Study on Leveraging Search and Self-Feedback for Agent Reasoning](https://arxiv.org/pdf/2502.12094)
- [The Promise of Hierarchical Reinforcement Learning](https://thegradient.pub/the-promise-of-hierarchical-reinforcement-learning/)
- [MAGIC: Learning Macro-Actions for Online POMDP Planning](https://arxiv.org/pdf/2011.03813)
- [Learning Multi-Timescale Abstractions for Hierarchical Combinatorial Planning](https://arxiv.org/html/2605.17058)
