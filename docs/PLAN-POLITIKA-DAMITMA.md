# POLİTİKA DAMITMA (R1) — durum

AlphaZero'nun çekirdeği tek bir gözlemdir: **arama > politika ise, politikayı aramanın
çıktısıyla eğit.** Bizde bu döngü hiç kapanmadı — her maçta arama sıfırdan koşuyor ve
öğrendiğimiz hiçbir şey birikmiyor. Bu belge o döngüyü kapatma turunun kaydıdır.

Her satır ya ölçülmüş bir sayıya ya da açık bir borca dayanır. Ölçülmemiş hiçbir iddia yok.

---

## Neden damıtma (bütçe duvarı)

| konfigürasyon | marj farkı | t | canlıya sığar mı |
|---|---:|---:|---|
| **20 birim/tur, 5sn ufuk** (kanıtlanmış) | **+1262** | **4.30** | ❌ |
| 1sn ufuk | +33 | 0.08 | ✅ ama kazanç YOK |
| dönüşümlü (5 birim/tur) | +191 | 0.47 | ✅ ama kazanç YOK |
| uzun periyot (15sn) | +153 | 0.42 | ✅ ama kazanç YOK |
| ışınlama (hiç rollout) | vasat | — | ✅ ama kazanç YOK |

Ucuzlatmanın dört yolu da öldü. Kalan tek yol: aramayı **taklit eden** bir ağ.

---

## ÖLÇÜM 1 — damıtmanın değeri var mı? (273 karar)

Damıtmaya başlamadan önce sorulması gereken soru: *öğrenilecek şey, elimizde zaten
bedava olan ucuz eleyicinin kopyası mı?*

| | |
|---|---:|
| rollout, eleyicinin #1 adayını **deviriyor** | **%62.6** |
| eleyici "yerinde kal"ı birinci sıralıyor | **%0** |
| rollout "yerinde kal" diyor | **%31** |

**Sonuç: hayır, kopya değil.** Ucuz skor sistematik olarak hareket etmeye fazla hevesli;
onu geri çeken tek şey gerçek simülasyon. Damıtılacak sinyal budur.

---

## ÖLÇÜM 2 — görev 25 sınıf değil, 3 SEÇENEK (9853 karar)

Arama adayları ucuz skora göre sıralar ve **yalnız ilk ikisini** (`LA_DERIN=2`) artı
"yerinde kal"ı oynatır. Yani nihai seçim tanım gereği üç seçenekten biridir:

| seçenek | pay |
|---|---:|
| eleyici #1'i onayla | %43.6 |
| eleyici #2'ye dön | %30.7 |
| yerinde kal | %25.7 |

Toplam tam %100 → küme kapalı. Etiket, mevcut veriden **tam belirlenmiş** bir dönüşümle
türetilir; yeniden toplama gerekmedi.

### İlk sürüm neden çöktü (ölçülmüş hata)

(durum, birim) → "hangi kafes sınıfı" kurgusu **öğrenilemezdi**: ağın girdisinde
seçeneklerin *kendisi* yoktu — #1 ile #2'nin nerede olduğu, ucuz skorun onları nasıl
puanladığı hiç geçmiyordu. Aynı durum + aynı birim + farklı aday geometrisi ağ için
ayırt edilemez.

**Sonuç:** tahminlerin %94'ü tek seçeneğe yığıldı; doğruluk %42.2, bedava taban %43.4.
Veri hacmi sorunu **değildi**. Düzeltme: her seçenek kendi özniteliğiyle (geometri +
ucuz skorlar + farklar) girdiye girer; ağ seçenek başına bir puan verir.

---

## ÖLÇÜM 3 — asıl darboğaz rollout DEĞİL, eleyici

`tools/politika-kip-kapisi.js`, 60sn oyun, tek taraf:

| kip | CPU | oyun/CPU |
|---|---:|---:|
| aramasız (taban) | 6.0sn | 9.9× |
| tam arama | 235.4sn | 0.25× |
| **politika** (rollout YOK) | 61.8sn | 0.97× |
| politika, **ağ eleyicisi kapalı** | 6.0sn | 9.9× |

Rollout'u atmak maliyeti yalnız 4 kat düşürdü ve **canlı bütçeye hâlâ sığmadı**.
Ağ eleyicisi kapatılınca maliyet **tabana** indi. Yani politika kipinin maliyetinin
**%100'ü** değer ağının aday başına çağrılmasıydı: 25 aday × 20 birim = **500 CNN
geçişi/tur**. Politika ağının kendi geçişi (20/tur) ölçülebilir maliyet taşımıyor.

### Düzeltme: ağ ön süzgeci (`LA_AG_ADAY = 5`)

Ağ yalnız **analitik olarak en iyi 5** adaya + "yerinde kal"a sorulur. Bu kısıtlamanın
güvenli olduğu zaten ölçülmüştü: *analitik ön eleme K=3'te kazancın %72'sini korur ve
bedavadır.*

| kip | CPU | oyun/CPU |
|---|---:|---:|
| aramasız | 5.1sn | 11.7× |
| tam arama | 105.0sn | 0.57× |
| **politika** | **15.1sn** | **3.98× ✅** |

Politika kipi artık canlı bütçeye **sığıyor** ve tam aramadan 10 kat ucuz.
Yan kazanç: tam arama da 2.2 kat ucuzladı (ama hâlâ sığmıyor).

**⚠ AÇIK BORÇ:** `LA_AG_ADAY=5` aramanın davranışını DEĞİŞTİRİYOR (atlanan karar
53 → 137). Kanıtlanmış +1262 bu konfigürasyonda **yeniden ölçülmedi**. Öğretmenin
gücü, damıtmanın tavanını belirler — bu ölçüm yapılmadan politika sonucu yorumlanamaz.

---

## Hat (hepsi kurulu ve sınanmış)

```
politika-veri{,-paralel}.js  → karar defteri (8 işçi, tohum 120000+)
politika-egit-gpu.py         → 3 seçenekli sınıflandırıcı, MAÇ-bazlı bölme
politika-model-cikar.py      → PyTorch → JS köprüsü
politika-kopru-kapisi.py     → Python ↔ JS EŞİTLİK kapısı
politika-kip-kapisi.js       → kip çalışıyor mu + maliyet
rol-dengesi.js               → ASIL KAPI (maç sonucu, n≥48, eşleştirilmiş)
```

### Köprü kapısı bir hata yakaladı (tasarım amacına uygun)

İlk köprüde max logit farkı **2.25e-3** (eşik 1e-3) → KAPI DÜŞTÜ. Sebep mantık hatası
değil, **ihracat hassasiyeti**: 488 boyutlu iç çarpım + 128 gizli birim, ağırlık başına
1e-6'lık yuvarlamayı ~1e-3'e biriktiriyor.

| basamak | max fark | dosya |
|---:|---:|---:|
| 6 | 2.25e-03 | 721KB |
| **8** | **6.67e-05** | 874KB |
| 10 | 4.18e-05 | 1027KB |

10 basamakta plato → kalan fark float32 toplama sırasından, indirilemez.
**Varsayılan 8 yapıldı; kapı geçti** (argmax uyuşması %100).

---

## Sızıntı ve tek-kaynak kapıları

- **Tohum bantları ayrık:** eğitim 120000+, ölçüm 100000+/150000+. Politika üzerinde
  puanlanacağı haritada asla eğitilmez.
- **Maç-bazlı bölme:** aynı maçın kararları birbirine çok benzer; karar-bazlı bölme
  doğruluğu sahte yükseltir. (Aynı tuzak değer ağında ve kompozisyon modelinde yaşandı.)
- **Tek kopya eleyici:** eleme+kapı `battleLookaheadEleVeKapi()`'de. Politika kipi de
  AYNI kapıyı kullanır — arama kapıya takılan birim için karar üretmez ve o durum
  deftere yazılmaz; kapısız bir politika hiç görmediği karar nüfusuna salınırdı.
  Refactor sonrası çıktı **byte-aynı** (md5) doğrulandı.
- **Yapılandırma pimi:** `LA_AG_ADAY` toplama ile canlı kipte AYNI olmak zorunda;
  toplayıcıya `--agaday` olarak geçirilir ve günlüğe yazılır.

---

## Sıradaki

1. Toplama bitsin (64 maç, iki taraf, `LA_AG_ADAY=5`).
2. Eğit → köprü kapısı → kip kapısı.
3. **ASIL KAPI:** `rol-dengesi.js --kol BATTLE_LOOKAHEAD_RED --ayar "LA_POLITIKA=1"`,
   n≥48, eşleştirilmiş. Politika aramasız AI'yı yeniyor mu?
4. Öğretmenin `LA_AG_ADAY=5`'teki gücünü ölç (açık borç).

**⚠ Sonuç varsayılmıyor.** Damıtma bu projede bir kez denendi ve geri çekildi (v2 klon,
96 bağımsız maçta t −2.85). Farkı: o klon tavanı ölçülüp ÇIKMAZ çıkmış bir *seçiciyi*
taklit ediyordu; buradaki öğretmen rollout'la doğrulanmış bir arama. Ama bu bir gerekçe,
kanıt değil — kanıt 3. maddedir.
