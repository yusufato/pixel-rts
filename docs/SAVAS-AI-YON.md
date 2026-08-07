# Savaş AI — YÖN VE GEREKÇE (2026-08-07)

Bu belge "ne yapacağız" değil, **"neden bu sırayla"** belgesidir. İçindeki her iddia ya ölçülmüştür
ya da kaynağı bellidir. Sayılar bu tarihe aittir; kullanmadan önce hâlâ geçerli mi diye bak.

## KARAR: sıra 1 → 3 → 2

1. **Davranış klonlama** (kod-AI'ı taklit) — beonai'yi karar isabetinde kod-AI seviyesine çıkar.
2. **Arama** (karar anında ileri sarma + değer ağıyla puanlama).
3. **Karar uzayını genişletmek** — AI'ın neye karar verebildiğini artırmak.

Sırayı kullanıcı belirledi: **1, 3, 2**. Gerekçesi aşağıdaki ölçümdür.

---

## 1. Arama neden AlphaGo'da dev, bizde küçük ölçüldü

AlphaGo'nun MCTS'i **derin** arama yapar: onlarca hamle ileri, dallanma yüzlerce. Bizim "arama"
dediğimiz şey ise **1 hamlelik**: 3 noktalı bir menüyü tek adım ileri sarıp puanlamak.

**Ölçülen (48 maç, ayrılmış tohumlar):** mükemmel seçici (oracle'ın kendisi politika olarak)
**+771 marj, t 1.80** — istatistiksel olarak anlamlı değil. Bu, *kusursuz 1-ply aramanın* tavanıdır.

**Çıkarım:** aramanın değeri, aradığı **uzayın genişliği** ve **ufkun derinliği** ile büyür.
Uzay 3 seçenek ve ufuk 1 adımken arama bulacak bir şey bulamaz. Bu yüzden 3 → 2 doğru sıradır:
uzay genişleyip karar sıklığı artınca arama, AlphaGo'daki çarpan hâline gelir.

*(Ek ölçüm: bir karar anında yalnız **3 ayrık aday noktası** var, ~575px aralıklı; kod-AI ise
serbest bir noktaya gidiyor.)*

---

## 2. Asıl referans: AlphaStar (Go değil, StarCraft II)

Problem sınıfımız Go değil: gerçek zamanlı, kısmi görüş, dev eylem uzayı, birim mikrosu.

| AlphaStar bileşeni | bizde durum |
|---|---|
| İnsan replay'lerinden **davranış klonlama** ile başlama | **adım (1)** — yalnız klonlanmış ajan bile oyuncuların büyük çoğunluğunu yenmişti |
| **Eylem uzayının parçalanması** (ne / kime / ne zaman ayrı başlıklar) | YOK — biz 60 adayı tek listede sayıyoruz. Adım (3)'ün doğru yapılışı budur |
| **Lig eğitimi** (ana ajanlar + sömürücü ajanlar) | YOK — ama kod-AI soyumuz hazır bir lig çekirdeği |
| BC politikasına **KL cezasıyla** bağlı kalma | YOK — RL ince ayarında strateji çöküşünü bu engeller |

**En çok işimize yarayacak ikisi:** eylem uzayını parçalamak ("hangi düşman kütlesi × ne kadar
kuvvet × hangi tempo" ayrı başlıklar) ve **lig** — çünkü dört farklı güçte, deterministik, bedava
rakibimiz var (intel3-pro / intel4 / intel4-pro / insan-vekili).

---

## 3. OpenAI Five: "takım ruhu"

Dota'da her kahraman kendi ödülünü alınca bencil oyun çıkıyordu. Çözüm: ödülü **bireysel katkı ile
takım katkısı arasında** bir katsayıyla harmanlamak ve eğitim ilerledikçe katsayıyı takım lehine
kaydırmak.

Bu, bizim **ölçülmüş** sorunumuzun tam karşılığı: insanın üstünlüğü **yerel üstünlük** —
temas anında **8.9 dost / 1.2 düşman**, AI'da **6.9 / 3.4**. Bir birimin doğru davranışı "kendi
takasını iyileştirmek" değil, "grubun o noktada üstün olmasına katkı vermek".
**Altyapı hazır:** 21 kanallı birim ödül defteri (`BATTLE_CREDIT`) tam bunun için kurulmuştu.

---

## 4. Uzman-yinelemesi (AlphaZero / ExIt döngüsü)

Kalıp: **arama = politikayı iyileştiren operatör** → politikayı aramanın çıktısına doğru eğit →
tekrarla. (2) ve (3) ancak bu döngüde birleşince anlam kazanır.
**Ön koşul:** aramanın politikadan gerçekten iyi olması. Şu an değil (bkz. §1). 3'ten sonra kurulur.

---

## 5. Bizde ZATEN olan, çoğu projede olmayan

- **Deterministik, forklanabilir motor** — arama yapılabilmesi bunun sayesinde. (`--forktest` byte-eş.)
- **Değer ağı** — ρ 0.830, kapıyı geçti. Aramanın yaprak değerlendiricisi hazır.
- **Ölçüm kapıları + tuzak defteri** (`docs/OLCUM-TUZAKLARI.md`) — hangi iddianın kanıtlandığını
  biliyoruz. Tek bir günde üç yanlış hipotezi bu sayede attık.
- **Hazır rakip merdiveni** — lig için müfredat.
- **Ucuz veri** — klonlama verisi rollout istemiyor: 18 → 562 karar/dk (31×).

---

## 6. Açıkça eksik olan tek şey: insan verisi ölçeği

AlphaStar milyonlarca replay'le başladı; bizde **24 maç** var. Bu yüzden "oyuncunun tarzını
klonlamak" gerçekçi değildir. Gerçekçi olan: **oyuncunun üstünlüğünün nereden geldiğini ölçüp
AI'ın karar uzayına o boyutu eklemek** — ki ölçtük (yerel üstünlük, §3).

---

## 7. Dürüst beklenti

- Klonlama beonai'yi ~%4.9'dan kod-AI bandına (%40-60) taşımalı → **intel4-pro ile eşitlenme**,
  geçme değil (taklit edenin tavanı öğretmenidir).
- **Mevcut uzayda intel4-pro'yu belirgin geçmek mümkün değil** — mükemmel seçici bile geçemedi.
- Oyuncuyu yenen AI bu katmandan çıkmaz: oyuncunun üstünlüğü operasyonel plan seçiminde değil,
  temas anındaki yerel üstünlükte. O boyut AI'ın karar uzayında YOK.
