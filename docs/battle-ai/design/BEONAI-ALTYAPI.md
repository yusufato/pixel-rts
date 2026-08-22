# beonai — öğrenen beyin soyu (altyapı)

Tarih: 2026-08-05 · Kod: `js/BattleBeonai.js`, `tools/beonai-uret.js`, `tools/beonai-egit.js`
İlgili: [../operations/TEZGAH-JSDOM.md](../operations/TEZGAH-JSDOM.md) · [../reports/OLCUM-KRIZI-TOHUM-SAYISI.md](../reports/OLCUM-KRIZI-TOHUM-SAYISI.md)

---

## 0. Yeni mimari DEĞİL

Repoda zaten çalışan bir öğrenme hattı vardı, yalnız bağlanmamıştı ve modeli bayattı:

```
OperationGrammar   → durumdan 16-64 GEÇERLİ operasyon adayı üretir (model üretmez)
BattleOracle       → her adayı fork'tan ayrı rollout eder → GERÇEK ödül = ÖĞRETMEN
BattleFeatures     → durum (105 boyut) ⊕ aday (23 boyut)
BattleSelector     → MLP sıralayıcı; listwise eğitim (selTrain/selEvaluate)
```

beonai bunu bir **soy**a çevirir: sürüm kaydı, taraf-başı bağlama, bayatlık koruması ve
kod-AI ile **aynı** çok-tohumlu değerlendirme tezgâhı.

**Neden soy, tek model değil:** öğrenen sistemde her yeniden eğitim yeni bir sürümdür ve
hangi sürümün neyi kazandığı izlenebilmelidir. `intel3 → intel4 → intel4-pro` soyu ayrı
kalır; sürüm turnuvasında karışmaz.

## 1. Üç sert kural (kod içinde uygulanır)

| kural | uygulama |
|---|---|
| **Determinizm** | Çıkarım saf fonksiyondur (özellik→skor); seçim kontrolörün karar yolunda olur ve emir olarak kaydedilir. **Replay/MP oynatımında beonai kapalıdır** (`battleBeonaiBagla` kendisi keser). |
| **Çok-tohumlu değerlendirme** | Hiçbir sürüm 12 tohumdan az ile "daha iyi" ilan edilemez; nihai karar `--final` (dışörneklem) havuzunda. Marj std sapması ~3114 ölçüldü. |
| **Bayat model kapalı durur** | Künyeye **eğitim anındaki** `BATTLE_ENGINE_VERSION` yazılır; çalışma anında uyuşmazsa model **bağlanmaz**, uyarır, kod-AI'ya düşer. |

Bayatlık koruması sınandı: künyedeki motor sürümü bilerek bozuldu →
`beonai: kırmızı: BAYAT: ESKI-MOTOR-v1 ile eğitildi … → kod-AI kullanılıyor` ve maç sonucu
saf kod-AI tabanıyla **birebir aynı** çıktı (seed2024, marj −3370) → model gerçekten uygulanmadı.

## 2. Akış

```
1) VERİ    node tools/beonai-uret.js --maclar 12 --karar-araligi 900 --rollout 25
             → her karar noktasında TÜM adaylar rollout edilir (öğretmen = oracle)
             → qa-runtime/beonai-veri.jsonl

2) EĞİTİM  node tools/beonai-egit.js --veri ... --surum beonai-v1
             → js/BattleBeonaiModels.js (sürüm kaydına yazar)

3) ÖLÇÜM   node tools/caprazla.js --tarifler qa-runtime/tarifler-beonai.json \
                  --sal H0-beonai --sav H0-kodAI --seeds 24
             → sonra --final ile dışörneklem doğrulaması
```

Tarif dosyasında beyin alanı: `{ "ad":"H0-beonai", "heuristik":true, "beyin":"beonai-v1" }`
→ **aynı ordu, farklı beyin**. Böylece kompozisyon sabitken beyin farkı izole ölçülür ve
beonai, intel4-pro ile tam aynı disiplinden geçer (ayrı tezgâh yok).

## 3. Eğitim filtreleri (sessiz değil — raporlanır)

| filtre | neden |
|---|---|
| `aktif` olmayan kararlar atılır | Temas yoksa **tüm adayların ödülü aynı** çıkıyor (ölçüldü: 64 adayın 64'ü de −3172.6) → sinyal yok, model gürültü ezberler |
| ödül varyansı sıfır olanlar atılır | aynı sebep, sayısal kontrol |
| sürüm uyuşmazlığı olan kayıtlar atılır | stateFeatures/candidateFeatures sürümü değişmişse veri karışmaz |

Eğitim/dev ayrımı **tohum bazında** yapılır (aynı maçın kararları aynı tarafa düşer) → sızıntı yok.
Rapor edilen dev skoru **karar seçme isabetidir, maç sonucu değildir**; bu ayrım kodda ve
çıktıda açıkça yazılıdır.

## 4. Ölçülen maliyet

Duman koşusu (3 tohum, karar aralığı 1500 tik, rollout 8sn):

```
12 karar, 773 rollout, 60 sn  → karar başı ~5 sn
kullanılan 7 karar (5'i "aktif değil" diye elendi)
```

Bir karar = (aday sayısı + 1) × rollout. Gramer ~64 aday üretiyor, yani karar noktası
bir maçtan pahalı olabilir. Araç gerçekleşen maliyeti her koşuda raporlar.

**CPU dostu varsayılan:** tek süreç, 1 maç. Büyük üretim `--maclar` ile açıkça istenir.

## 5. Şu anki durum

- Altyapı **hazır ve uçtan uca çalışıyor** (üret → filtrele → böl → eğit → bağla → ölç).
- `js/BattleBeonaiModels.js` şu an **boş yer tutucu** — eğitilmiş sürüm YOK.
  Duman modeli (4 örnek) atıldı; anlamlı olmadığı için repoda tutulmadı.
- Kapılar: `--forktest` ✓ `--liverepro` ✓ `--defertest` ✓; tezgâh regresyonu birebir aynı
  (3 tohum, 0/3, marj −3654).

## 6. Sıradaki adım (CPU boşta olduğunda)

1. `beonai-uret --maclar 24` ile temaslı veri (karar aralığını 600-900 tik yapıp aktif
   karar oranını yükseltmek gerekebilir — duman koşusunda 12 kararın 5'i temassızdı).
2. `beonai-egit --surum beonai-v1`.
3. 24 tohumluk tarama + 48 tohumluk `--final` doğrulaması, **aynı ordu** ile kod-AI'ya karşı.
4. Kazanırsa intel4-pro'nun B4 kompozisyonuyla birleştirip sürüm turnuvasına sokmak.
