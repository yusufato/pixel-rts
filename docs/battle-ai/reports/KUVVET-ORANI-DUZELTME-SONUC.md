# Kuvvet-oranı düzeltmesi (`trueForceRatio`) — uygulama ve ÖLÇÜM SONUCU

Tarih: 2026-08-04 · Dal: `savas-ai-mikrofix-konsantrasyon`
Öncesi: [KUVVET-ORANI-HATASI.md](KUVVET-ORANI-HATASI.md) (teşhis)

## 1. Ne değişti

`js/BattlePerception.js` — istihbarat tabanı artık **düşmanın ilan edilmiş bütçesinden** kurulur:

```
ESKİ:  floor = kendiBaslangicDegerim − dogrulanmisOldurulen
YENİ:  floor = dusmanBUTCESI          − dogrulanmisOldurulen     (pro-delta: trueForceRatio)
```

Bütçe maç kuralıdır (iki taraf da bilir, puan sınırı gibi) → hile değil; ordu **bileşimi** hâlâ gizli.
Destek: `BattleSession` artık `blueBudget`/`redBudget`'ı oturuma yazar (hash + fork'a dâhil).
Ek: `forceRatio` 20'de doyurulur — düşman neredeyse tamamen doğrulanmış-ölü iken payda 1-2₺'ye
düşüp oran 4798'e fırlıyordu (ölçüldü). Tüm eşikler <2 olduğu için davranış değişmez.

## 2. Kabul ölçütü — GEÇTİ

Kullanıcının maçıyla aynı handikap (savunan 6460₺ / saldıran 4410₺), yeni kapı `--ratiotest`:

| tohum | ESKİ t0 oranı | YENİ t0 oranı | gerçek | savunan STRIKE'a girdi mi? |
|---|---|---|---|---|
| 2024 | **1.00** | **1.46** | 1.52 | eski YOK → yeni VAR (t=128sn) |
| 777  | **1.00** | **1.43** | 1.48 | eski VAR(t=106) → yeni VAR (t=122) |
| 909  | **1.00** | **1.46** | 1.46 | eski YOK → yeni VAR (t=59sn) |

Hedef "t0 ≈1.46 ve savunan en az bir kez STRIKE" → **3/3 karşılandı**. Eski kodda oran
düşman büyüklüğünden bağımsız olarak **daima tam 1.00** çıkıyordu; yani bir kuvvet oranı değil,
AI'ın kendi sağkalım yüzdesiydi.

## 3. Eşit bütçede kazanca etkisi: ~NÖTR (dürüst rapor)

İzole A/B (`--intel4pro --only trueForceRatio`, 6500 vs 6500, ordu dizilimi iki tarafta da
pro-suz → tek değişken runtime deltası), 3 tohum × 2 rol:

- `trueForceRatio` açık taraf: **2/6**
- Kontrol (`--only _yok_`, iki taraf tamamen özdeş): **3/6**

**Neden nötr?** Eşit bütçede eski formülün tabanı (`kendiBaslangic ≈ 6500`) yeni tabana
(`dusmanButcesi = 6500`) tesadüfen zaten eşitti. Hata yalnız **kuvvet değerleri ayrıştığında**
ısırıyor — handikap maçlarında ve kullanıcının kendi maçlarında olduğu gibi. Yani bu bir
**doğruluk düzeltmesi**, kazanç özelliği değil: eşit bütçede bedeli yok (fark gürültü sınırında),
asimetrik kuvvette sayıyı düzeltiyor. 2/6 ↔ 3/6 farkı tek maç (seed777 savunan) ve kaotik.

## 4. ASIL BULGU: saldıran eşit bütçede 0/6 kaybediyor

Kontrol koşusu (iki taraf **bit-bit özdeş** intel4; her tohumda iki maç birebir aynı sonuçlandı
→ determinizm de doğrulandı):

| tohum | kazanan | sebep | bitiş |
|---|---|---|---|
| 2024 | savunan | attacker_eliminated | 356sn |
| 777  | savunan | attacker_eliminated | 124sn |
| 909  | savunan | attacker_withdrew | 354sn |
| 3141 | savunan | time_expired | 360sn |
| 2718 | savunan | attacker_withdrew | 328sn |
| 5150 | savunan | attacker_eliminated | 139sn |

**Saldıran 0/6.** (NOT: bellekteki "taarruz-erimesi ÇÖZÜLDÜ 6/6" kaydı bütçe-kaçağı
düzeltmesinden ÖNCEye ait → geçersiz.)

### Bunun mezuniyet kapısına doğrudan sonucu
Kapı 6 tohum × 2 rol; maçların yarısında pro **saldıran** rolünde. Saldıran rolü
kazanılamıyorsa pro'nun tavanı **%50**'dir → **%75 kapısı matematiksel olarak geçilemez.**

Yani intel4-pro'nun tek gerçek hedefi belli: **saldıran rolünü çözmek.** Savunanın
pasifliğini düzeltmek (P5) doğruydu ama kapıyı açan şey o değil.

## 5. Kapılar

`--forktest` ✓ · `--liverepro` ✓ · `--defertest` ✓ (201/201 hash, ihlal 0) · `--pdtest` ✓ (4/4)

## 6. Yeni araçlar

- `--ratiotest [--pro red|blue|both]` — handikap kurulumunda savunanın oranı + STRIKE'a girişi
- `--intel4pro --only <delta> --seeds a,b,c` — **tek delta izole A/B**; `--only` verildiğinde ordu
  dizilimi iki tarafta da pro-suz kurulur, böylece kompozisyon farkı ölçüme karışmaz.
  `--only _yok_` = saf kontrol (taraf/tohum yanlılığı ölçümü).
