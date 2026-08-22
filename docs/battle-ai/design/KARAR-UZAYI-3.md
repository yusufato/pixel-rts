# ADIM 3 — "AI NEYE KARAR VEREBİLMELİ"

Bu belge adım 3'ün girişidir: karar uzayını genişletmek. Her madde bir **ölçüme** bağlıdır;
ölçümü olmayan madde listeye girmez.

---

## A. BUGÜN AI NEYE KARAR VERİYOR (ölçüldü)

| boyut | değerler | not |
|---|---|---|
| **ne zaman** | her 900 tik = **45 sn** | maç başına **7.5 karar** (ort), en çok 8 |
| **niyet** | ADVANCE · MAIN_ATTACK · FIX_AND_FLANK · REGROUP · DISENGAGE · HOLD | kod-AI'da olan **FIRE_PREPARATION adaylarda YOK** (kararların %3'ü) |
| **nereye** | **3 ayrık nokta** (~575px arası) | bir kararda seçebildiği yer sayısı üç |
| **tempo** | aggressive · cautious · normal | |
| **kuvvet bölüşümü** | MAIN/FIXING/FLANK önayarları | |

Yani karar şu: *"orduyu bir bütün olarak, 45 saniyede bir, üç yönden birine, üç hızdan biriyle sür."*

**Tavan kanıtı:** bu uzayda mükemmel seçici bile +771 (t 1.80) — yani uzayı değiştirmeden
öğrenmeyle kayda değer kazanç YOK.

---

## B. OYUNCU NE YAPIYOR DA AI YAPAMIYOR (ölçüldü)

| ölçüm | oyuncu | AI |
|---|---|---|
| **temas anında yerel oran** | **8.9 dost / 1.2 düşman** | 6.9 / 3.4 |
| verimlilik | **2.7×** | — |
| ateş odağı tepesi | 1.9-2.7 | — |
| yayılım / hareket | 1027-1087px / %5-18 | %22-36 |

Okuma: oyuncu **sektör seçerek** değil, **angajman seçerek** kazanıyor. Yayılı duruyor, sabırlı
bekliyor, sonra üstün olduğu yerde temas kuruyor ve ateşi yığıyor. AI'ın karar dilinde bunların
hiçbirinin karşılığı yok — bu yüzden ne kadar eğitilse de o davranışı üretemez.

**Bugünkü klon bunu dolaylı doğruladı:** klon kod-AI'dan daha yoğun oynayıp DAHA ÇOK kazandı
(galibiyet 11/24 → 16/24). Yoğunluk düşman değil; küresel yumak düşman.

---

## C. ÖNERİLEN YENİ KARAR BOYUTLARI (öncelik sırası)

### 1. HEDEF KÜTLE — "hangi düşman yığınını ez"  ⭐ en yüksek getiri
Bugün: "hangi sektöre git" (3 nokta). Öneri: **hangi düşman kümesine** karşı ana çabayı kur.
Doğrudan yerel-üstünlük ölçüsüne bağlanır (8.9/1.2).
*Kapı:* temas anındaki yerel oran; hedef, AI'ın 3.4'ten oyuncunun 1.2'sine doğru inmesi.

### 2. ANGAJMAN KABUL/RET — "bu takası almıyorum"  ⭐
Bugün: temas edilir, dövüşülür. Öneri: yerel oran aleyhteyse **çekil, tekrar kur**.
Oyuncunun 8.9/1.2'si "hep kazandığı yerde dövüşmek" demektir.
*Kapı:* aleyhte oranla girilen angajman yüzdesi (düşmeli).

### 3. ATEŞ KONSANTRASYONU — "kaç birim aynı hedefe"
Bugün: birim başına hedef seçimi, karar katmanında yok. Öneri: karar başına odak seviyesi.
*Kapı:* odak tepesi (oyuncu 1.9-2.7); ölü-fazlası (bugün %4.9, düşük — dikkat: yükselmemeli).

### 4. KARAR SIKLIĞI — 45 sn çok kaba
Maç başına 8 karar, uzayın en sert kısıtı. 45 → 15-20 sn, karar sayısını 3× yapar.
*Maliyet:* klonlama verisi rollout'suz olduğu için üretim ucuz kalır (562 karar/dk).
*Kapı:* karar başına isabet düşmemeli (thrash riski) — mevcut `REPICK_TICKS` histerezisi korunur.

### 5. FIRE_PREPARATION'I GRAMERE EKLE — bedava
Kod-AI bunu kullanıyor (kararların %3'ü) ama aday sözlüğünde yok; klonlama o kararlarda
zorunlu olarak yanlış etiket üretiyor (405 "zayıf" etiket). Tek satırlık kazanç.

### 6. KUVVET BÖLÜŞÜMÜ GRANÜLERLİĞİ
Bugün MAIN/FIXING/FLANK önayarları. Öneri: grup başına ayrı hedef ataması.
*Not:* FAZ 0.2'de ölçülmüştü — FLANK grubu sektör odağını %55 kaybediyor. Önce o düzeltilmeli.

---

## D. NASIL KURULACAK — AlphaStar'ın parçalanması

60 adayı tek listede saymak yerine karar **ayrı başlıklara** bölünür:

```
(niyet) × (hangi düşman kütlesi) × (ne kadar kuvvet) × (tempo) × (angajman kuralı)
```

Neden: tek liste, boyut eklendikçe çarpımsal büyür (6 × 3 × 3 = 54 bugün; kütle ve angajman
eklenince binlerce olur → sayılamaz). Parçalı başlıklarda her boyut **ayrı** skorlanır, uzay
büyür ama hesap büyümez. AlphaStar'ın StarCraft'ta yaptığı tam olarak budur.

**Klonlama hattı hazır:** etiket `kodPlan`'dan geliyor, rollout gerektirmiyor. Boyut eklendikçe
`kodPlan`'a o boyutun karşılığı yazılır ve etiket kendiliğinden zenginleşir.

---

## E'. YOĞUNLUK NE DEMEK — kullanıcının ayrımı (kritik)

> *"Yoğunluk iyi derken yumak olmaktan bahsetmiyorum. Eğer onlarca birim bir füze alanının
> içine giriyorsa toplu hasat olur."*

Doğru ölçüt **soyut yayılım değil**, **tek bir düşman AoE ayak izine giren birim sayısı**.
Bu fiziksel ve sayılabilir; motorda zaten var (`BATTLE_BALANCE.localDensity`, 600px çember).

| silah | patlama yarıçapı |
|---|---|
| ÇNRA | 250px |
| topçu | 300px |
| **balistik** | **600px** |
| bastırma halkası | patlama × 1.8 |

**İki ayrı şey, karıştırılmayacak:**
- **YEREL ÜSTÜNLÜK** (istenen): temas noktasında dost/düşman oranı yüksek — oyuncunun 8.9/1.2'si.
- **AoE HASADI** (yasak): aynı anda N birim tek bir patlama yarıçapının içinde.

Bir ordu ikisini birden sağlayabilir: üstün olduğu yerde temas kurar ama **patlama yarıçapı kadar
aralıklı** durur. Kapı bunu ayırt etmeli; "dağıl" demek yerine "tek namlunun altına yığılma" demeli.

---

## E. KAPI DÜZELTMESİ (bugün ortaya çıktı)

Davranış kapısı klonu haksız yere eledi: **öz baskı %156** dedi ama mutlak değer **5.0** —
kapının kurulma sebebi olan canlı çöküş **87.6**'ydı. Sıfıra yakın tabana yüzde konmuş.

Düzeltme:
- baskı için **mutlak eşik** (ör. `PINNED_SUPPRESSION`/2 = 40), oran değil
- yoğunluk için: **maç sonucu iyileşiyorsa yoğunluk tek başına eleme sebebi değildir**
  (yerel üstünlük zaten yoğunlaşmaktır)
- kapı **patolojiyi** işaretler (küresel yumak + yüksek mutlak baskı), yayılmayı amaç saymaz
