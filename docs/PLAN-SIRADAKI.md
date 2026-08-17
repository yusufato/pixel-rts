# SIRADAKİ İŞLER — bağımlılıklarıyla

Kullanıcı uyarısı: *"planlar birikiyor."* Bu projede plan bayatlığı kayıtlı bir hata
sınıfı, o yüzden liste **ölçüm durumu** ve **bağımlılık** ile birlikte tutulur.
Damgasız satır yoktur: her iş ya ÖLÇÜLDÜ, ya ÖN KAPIYI GEÇTİ, ya HENÜZ SINANMADI.

---

## Bugün kurulan ölçüm disiplini (her iş buradan geçer)

```
1. tasarım değişikliği       dakikalar
2. "karar değişti mi?"       3-5 dk    ← tools/karar-degisti-mi.js  YENİ
3. mekanizma metriği         saniyeler (GPU: ρ, sıralama doğruluğu)
4. maç kapısı                1 saat    ← yalnız 2 ve 3'ü geçenler
```

**Neden 2. adım şart:** maç marjı std ≈ 2611 ve eşleştirme varyansın yalnız %17'sini
alıyor (simülasyon kaotik). +400'lük etki için n≈485 gerekiyor — maç kapısı
ucuzlatılamaz, ama **kapıya giren aday sayısı** ucuzlatılabilir.
Ölçülen tasarruf: çok kanallı puanlama kararların %2'sini değiştiriyor → 3,4 dakikada
elendi; ben onu bir saatlik kapıya sokmuştum.

---

## A · ÖNCE BİTMESİ GEREKEN (akışta)

| iş | durum |
|---|---|
| Birim-koşullu değer ağı verisi | toplanıyor (42 maç, `--agaday 0 --derin 4`) |
| → eğit + **karar içi sıralama** kapısı | veri bekliyor |
| → ablasyon: hangi girdi grubu taşıdı | veri bekliyor |

**Kapı:** ağ, aynı kararda en iyi adayı bugünkü eleyiciden daha sık bulabiliyor mu?
Geçerse ışınlama rollout'un yerine geçebilir → GPU çarpanı harcanabilir hale gelir.

---

## B · ÖN KAPIYI GEÇMİŞ, MAÇ KAPISI BEKLİYOR

| iş | ön kapı | neden önemli |
|---|---|---|
| **Emir ömrü** (`_laUntilTick` bağla) | — | emirlerin %50'si 1 saniyede eziliyor; +839 bu israfla elde edilmiş |
| **10-15sn ufuk** | %28,6 karar değişti | ufku KISALTMAK ölçülüp öldürülmüş, UZATMAK hiç denenmemiş |

⚠ Emir ömrü için uyarı: ezmenin meşru sebepleri olabilir (düşman belirdi). Zorla
tutturmak birimi öldürebilir. Ölçülmeden bağlanmaz.

---

## C · ÖLÇÜLDÜ, ELENDİ (tekrar açılmasın)

| iş | sonuç |
|---|---|
| Politika damıtma (R1) | öğretmen +839 çalışıyor, öğrenci +143 t 0.56 → damıtma değeri kaybetti |
| 25×25 ortak ışınlama | rollout'la %43 vs tek taraflı %44, z −0.28 → sinyal YOK |
| Çok kanallı puanlama | kararların %2'si değişiyor → maç etkisi beklenemez |
| Değer ağını büyütmek | ×1 ρ 0.408 · ×2 0.414 · ×4 **0.385** → sınır kapasite değil SİNYAL |
| Canlı ayar (kısılmış arama) | n=512'de +203 t 1.51 → ispatlanmadı, etiket geri çekildi |

---

## D · YENİ VERİ KAYNAĞI (henüz kurulmadı)

**Her gerçek maç zaten bir rollout.** Şu an her etiket için fork alıp 5 saniye simüle
ediyoruz; oysa gerçek maçta o 5 saniye zaten oynanıyor.

| | aramalı toplama | bedava etiket |
|---|---:|---:|
| maç maliyeti | ~85sn CPU | **~10sn** |
| 8 işçiyle 1000 maç | ~3 saat | **~20 dk** |
| toplam etiket | ~100 bin | **~3,2 milyon** |

Atıf sorunu kredi defteriyle çözülüyor: her birimin **kendi** ürettiği ayrı tutuluyor.

**Tuzak:** karşı-olgusal yok (yalnız gidilen yerler görülüyor) → dağılım kayması.
Çözüm: toplamada keşif gürültüsü.

**Tarif:** bedava etiketle ön eğitim (temsil) → rollout etiketiyle ince ayar (sıralama).
Bu, "genişlik ×4 kötüleştiriyor" bulgusunu da açıklıyor: sorun veri azlığıydı.

---

## E · AÇIK BORÇ / DÖNGÜSELLİK

**Tavan ölçümü kendi ölçütüyle ölçülüyor.** "Masada 60,6 var" derken, kusurlu olduğunu
zaten ölçtüğümüz bir skora göre söylüyoruz. Aramanın onu maksimize etmesi +839
kazandırıyor, yani skor çöp değil — ama "4 katı masada" iddiası doğrusallık varsayıyor.

**Dürüst testi:** 25 adayın hepsini oynatan arama, GERÇEK maçta 2 oynatandan çok mu
kazanıyor? Tam ayarda ~25 saat; kısa maçlarla (120sn) 8 işçide **~1 saat** → yapılabilir.

---

## F · BUGÜNÜN DESENİ — "bilgi var, kullanan yok"

Üç bağımsız örnek çıktı ve muhtemelen daha var:

| ne | durum |
|---|---|
| `SIM.pendingHits` (gelen ateş: nereye, ne zaman, yarıçap) | tam kayıt, **hiç okunmuyor** |
| Kredi defteri 5 kanalı (`gorusTekil`, `tespit`, `siperTik`, `havaCaydirma`, `kapma`) | tanımlı, **hiç yazılmıyor** |
| `_laUntilTick` (emir ömrü koruması) | atanıyor, **hiç okunmuyor** |

Kullanıcının teşhisi — *"AI'nin potansiyeli var ama kullanamıyor"* — ölçüldüğü her
yerde doğrulandı. Tavan ölçümü de aynı yöne: en iyi aday kararların **%72'sinde**
oynatılan 2'nin içinde bile değil.

---

## Öncelik gerekçesi

1. **A** — akışta, ve B/D'nin ne kadar değerli olduğunu belirliyor
2. **B (emir ömrü)** — en ucuz aday, kazanç zaten üretilmiş işin israfını geri alıyor
3. **E (gerçek tavan)** — GPU yatırımından ÖNCE, çünkü tüm yol o varsayıma dayanıyor
4. **D (bedava etiket)** — A zayıf çıkarsa asıl kaldıraç; veri azlığı ölçülmüş kısıt
5. **B (uzun ufuk)** — ön kapıyı geçti ama maç kapısı pahalı
