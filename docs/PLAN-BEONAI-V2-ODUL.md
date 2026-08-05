# PLAN — beonai v2: ödülü AI'ın kendisi öğrensin + ölçek + intel4-pro sinerjisi

Tarih: 2026-08-05 · Durum: **ONAY BEKLİYOR**
Öncesi: [BEONAI-ALTYAPI.md](BEONAI-ALTYAPI.md) · [OLCUM-KRIZI-TOHUM-SAYISI.md](OLCUM-KRIZI-TOHUM-SAYISI.md) · [TEZGAH-JSDOM.md](TEZGAH-JSDOM.md)

---

## 0. Neyi çözüyoruz

v1 ölçüldü: **karar seviyesinde kod-AI'dan iyi (regret 103 vs 216) ama maç sonucu aynı
(10/24 vs 10/24).** Tek cümlelik teşhis: **model doğru öğrendi, yanlış şeyi.**
Öğretmenin ödülü 12 saniyelik rollout — kısa vadeli takası ölçüyor, KAZANMAYI değil.

Bu planın omurgası bu ödülü düzeltmek. İkincil iki eksen: ölçek ve intel4-pro sinerjisi.

---

## 1. ÖDÜL — AI kendi değer ölçüsünü öğrensin (FAZ A, ana iş)

### 1.1 İlke: yer gerçeği zaten var, uydurmayacağız

Oyunun **kazanma koşulu** zaten tanımlı (`BattleRules`: effectiveValue karşılaştırması,
imha, çekilme, süre). Yani "neyin iyi olduğunu" elle yazmamıza gerek yok — **maç sonucu
yer gerçeğidir.** Sorun ödülün ne olduğu değil, **kredi ataması**: hangi karar kazandırdı?

v1 bunu 12sn'lik rollout ile çözüyordu (ucuz ama miyop). v2'de şöyle çözülecek:

```
V(durum) → maçın nihai marjı              ← AI'ın KENDİ öğrendiği değer ölçüsü
oracle ödülü := V(rollout sonrası) − V(rollout öncesi)     ← avantaj
```

`V` elle yazılmış bir kural değil; **binlerce maçın gerçek sonucundan öğrenilir.**
Senin "AI neyin ödül olduğunu kendi bulsun" dediğin şeyin uygulanabilir hâli budur:
neyin *değerli* olduğuna maç sonuçları karar verir, biz değil.

**Tam-içsel (self-invented) ödülü ÖNERMİYORUM.** Tanımlı bir kazanma koşulu olan oyunda
içsel motivasyon araştırma sapağıdır; ölçülebilir bir hedefi olmayan AI, ölçemediğimiz
bir şeyde iyileşir. Yer gerçeği elimizdeyken onu kullanmamak israf olur.

### 1.2 Veri: bedava

Her tam maç, sonuçla etiketlenmiş yüzlerce durum üretir (telemetri zaten 0.5sn'de bir
örnekliyor). Ölçülen hız **1.38 maç/sn** → 1000 maç ≈ **12 dakika** → ~700.000 etiketli durum.
Oracle verisinin aksine bu **ucuz**.

### 1.3 GO/NO-GO kapısı (bu şart)

`V` eğitildikten sonra, **görülmemiş tohumlarda** nihai marjı tahmin edebiliyor mu?

| ölçüt | eşik |
|---|---|
| erken durumdan (t≈1500) nihai marjı tahmin — Spearman ρ | **≥ 0.45** |
| kazanan/kaybeden ayırma (t≈3000) — isabet | **≥ %70** |

Geçemezse **DUR**: V maçı temsil etmiyorsa, V-tabanlı ödül v1'den iyi olmaz.
Bu, oracle'ın kendi GO/NO-GO mantığının aynısı — önce aracın işe yaradığını kanıtla.

### 1.4 Determinizm

`V` veri üretimi ve çıkarım anında **donmuş** bir ağdır (sabit sayılar). Sim'e RNG
girmez, replay garantisi etkilenmez — GPU eğitimi de aynı sebeple güvenliydi.

---

## 2. ÖLÇEK — "1000 tohum" ne verir, ne vermez (FAZ B)

### 2.1 Ölçülen maliyetler

| iş | hız | 1000 tohum |
|---|---|---|
| tam maç (V verisi, değerlendirme) | 1.38 maç/sn | **~12 dakika** |
| oracle kararı (aday sıralama verisi) | 1445 kullanılabilir/saat | **~3.5 saat** |

Yani **1000 tohum V için bedava, oracle için pahalı.** Kademeli gidilecek:
V → 1000 tohum hemen; oracle → önce 100 tohum, sonuç iyiyse büyüt.

### 2.2 ⚠ TEK HARİTA KISITI (bu, "insan seviyesi" hedefini doğrudan sınırlar)

`MapData.js`: `-2 = çizilen harita (tek harita)`. **Oyunda tek arazi var.**
Tohum yalnız dizilimi, RNG'yi ve `varied` doktrin çekilişini değiştiriyor.

Sonuç: 1000 tohum = **aynı arazide 1000 farklı dizilim**. Bu, bu haritada güçlü bir AI
üretir; **genelleme kanıtlamaz.** "İnsan seviyesi" iddiası için arazi çeşitliliği şart —
prosedürel arazi üretimi ayrı bir iş olarak plana konur (FAZ E, opsiyonel).

Şimdilik dürüst çerçeve: **"bu haritada insan seviyesi"** hedefliyoruz.

### 2.3 Aşırı-uyum koruması

Havuzlar ayrık kalır: eğitim (tarama) · doğrulama (dışörneklem) · nihai karar (final).
1000 tohuma çıkarken bu ayrım korunur; V ve beonai **asla** final havuzunu görmez.

---

## 3. SİNERJİ — beonai, intel4-pro'nun teşhis aleti (FAZ C)

Haklıydın: beonai'nin intel4-pro'dan daha kıymetli bir özelliği var. **Oracle, her kararda
kod-AI'ın ne kadar kötü seçtiğini ölçüyor** (regret) — bu, galibiyet/mağlubiyetten çok
daha bilgilendirici bir sinyal. Mevcut 124 aktif kararla hemen çalıştırdım:

```
TÜM AKTİF     n=124  ort.regret 243   kod-AI zaten en iyi: %23
```

**Maç fazına göre — çarpıcı olan burada:**

| faz | n | ort. regret | kod-AI en iyiyi seçme oranı |
|---|---|---|---|
| **erken (t<1500)** | 46 | **469** | **%7** |
| orta (1500-3500) | 39 | 92 | %23 |
| geç (t≥3500) | 39 | 128 | %41 |

**Kod-AI'ın en zayıf yeri AÇILIŞ.** İlk ~75 saniyede oracle'ın en iyisini yalnız **%7**
oranında buluyor ve ortalama regret orta oyunun **5 katı**. Oracle o fazda ne istiyor?
**ADVANCE 26, FIX_AND_FLANK 16** — ve en büyük regretli kararların çoğunda tempo `cautious`.

En pahalı 8 karar:
```
seed222  t=1400  regret 1901  oracle: ADVANCE/cautious      (mesafe 374)
seed8080 t=700   regret 1363  oracle: ADVANCE/cautious      (mesafe 877)
seed555  t=700   regret 1304  oracle: FIX_AND_FLANK/aggressive
seed444  t=1400  regret 1256  oracle: ADVANCE/normal        (mesafe 165)
```

Bu, intel4-pro için **doğrudan delta adayı**: açılış doktrini (ilk 1500 tik) yanlış.
Ve bu bulgu maç kazanma/kaybetmeden değil, **karar başına karşı-olgusal ölçümden** geldi —
yani FAZ 3 turnuvasının asla veremeyeceği çözünürlükte.

**Kalıcı araç:** `--regretprofil` — oracle verisini role/duruş/faz/sektör/kuvvet-oranı
bandına göre gruplar, en yüksek regretli bantları listeler. intel4-pro'nun delta üretimi
artık tahminle değil bu haritayla yapılır.

---

## 4. Fazlar, sıra ve kapılar

| faz | iş | maliyet | kapı |
|---|---|---|---|
| **A1** | V veri seti: 1000 maç, durum+nihai sonuç | ~12 dk | veri bütünlüğü, tohum ayrımı |
| **A2** | V eğitimi (GPU) + tahmin gücü ölçümü | saniyeler | **ρ≥0.45 ve %70 ayırma — GEÇEMEZSE DUR** |
| **A3** | Oracle v2: ödül = V-avantajı; 100 tohum veri | ~45 dk | üretim hatasız, aktif oran ≥%50 |
| **A4** | beonai-v2 eğitimi + **maç ölçümü** (24 tohum) | ~10 dk | **v1'i ve kod-AI'yı geçmeli** |
| **A5** | Geçerse: 48 tohum dışörneklem doğrulaması | ~5 dk | anlamlı pozitif marj |
| **C1** | `--regretprofil` aracı + açılış-doktrini deltası | ~1 sa | caprazla ile 24+48 tohum |
| **E** | (opsiyonel) prosedürel arazi çeşitliliği | büyük | genelleme iddiası için şart |

**Sıra gerekçesi:** A önce, çünkü ödül düzelmeden ölçek de gramer de işe yaramaz —
v1 bunu kanıtladı. C paralel yürüyebilir (veri zaten var) ve intel4-pro'yu hemen besler.

## 5. Başarısızlık senaryoları (önceden yazılıyor)

- **V tahmin edemezse (A2 kapısı):** durum-özellikleri maçı temsil etmiyor demektir.
  O zaman iş "daha çok veri" değil **özellik tasarımı**dır; plan oraya döner.
- **V iyi ama beonai-v2 yine nötrse:** darboğaz ödül değil **gramer tavanı**dır
  (model 64 adayı sıralıyor, yeni operasyon üretmiyor). Sıradaki iş grameri genişletmek.
- **v2 tarama havuzunda kazanıp final havuzunda çökerse:** aşırı-uyum; havuz ayrımı
  bunu yakalar (FAZ 2'de `support↑` ile bir kez yaşandı).

## 6. Değişmeyen kurallar

1. Hiçbir sürüm **karar-seviyesi skorla** iyi ilan edilmez — karar maç sonucudur.
2. Hiçbir iddia 12 tohumdan az ile kurulmaz; nihai karar dışörneklem havuzunda.
3. Determinizm kapıları (`--forktest`, `--liverepro`, `--defertest`) her kod değişiminde.
4. Sessiz kırpma yok: elenen veri, düşen tohum, kör eksen — hepsi raporlanır.
