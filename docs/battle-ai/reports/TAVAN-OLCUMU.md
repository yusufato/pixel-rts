# TAVAN ÖLÇÜMÜ — mükemmel seçici kod-AI'yı yenebiliyor mu?

**Tarih:** 2026-08-08 · **Makine:** CYBORG (ikinci makine bugün çalışmadı, iş buraya alındı)

## Soru

Projedeki her karar şu sayıya dayanıyordu: her karar noktasında TÜM adayları gerçekten yuvarlayıp
en iyisini seçen **mükemmel seçici** (hile yapan üst sınır), kod-AI'yı yenebiliyor mu?
Önceki tahmin +771 / t 1.80 idi — anlamlı değil, ve yalnız dar uzayda.

## Kurulum

`tools/beonai-mac-kapisi.js --surum ORACLE --rol her`, iki AYRIK tohum dilimi (`--atla 0` ve
`--atla 12`), sonra **havuzlandı**. Kol başına **48 maç**. Bağlanma kanıtı: `ORACLE-POLITIKA`.

## Sonuç

| uzay | eşl. fark | std.hata | **t** | lehte | galibiyet (taban→oracle) |
|---|---|---|---|---|---|
| **DAR** (gramer v1, kota 64) | +244 | 503 | **0.48** | 25/48 | 24/48 → **25/48** |
| **GENİŞ** (gramer v2, kota 96) | +387 | 549 | **0.70** | 23/48 | 24/48 → **23/48** |

**Dilimler kendi içinde çelişti** — tek dilime bakmak yanıltıcıdır:

| kol | dilim 0-11 | dilim 12-23 |
|---|---|---|
| DAR | +831 (t 1.05) | −344 (t −0.56) |
| GENİŞ | +1576 (t 2.33) | −801 (t −0.99) |

## Okuma

1. **Mükemmel seçici kod-AI'yı yenmiyor.** Ne marjda (t 0.48 / 0.70) ne de galibiyet sayısında
   (25/48 ve 23/48, taban 24/48).
2. **Uzayı genişletmek tavanı yükseltmedi.** +244 → +387; fark gürültünün (se ~500) çok altında.
3. Mükemmel seçici kazanamıyorsa **öğrenilmiş hiçbir seçici kazanamaz.**

## Sonuç: yön değişikliği

"Operasyon grameri üzerinde seçici" yaklaşımının ölçülebilir başlığı yok. Darboğaz *hangi
operasyon planını seçtiğin* değil; kod-AI'ın **yürütme katmanı** işi yapıyor ve 45 saniyelik plan
seçimi sonucu neredeyse hiç değiştirmiyor.

Oyuncunun ölçülen üstünlüğü de zaten yürütme katmanındadır: temas anında **8.9 dost / 1.2 düşman**
(AI 6.9 / 3.4). Sıradaki iş oraya taşınmalı — angajman davranışı, ateş konsantrasyonu, kötü takası
reddetme. Altyapı hazır: `BATTLE_CREDIT` (21 kanallı birim ödül defteri).

## Yan sonuç: v2 klon geri çekildi

`beonai-klon-v2` ilk 48 maçta +972 / t 2.03 verip "geçti" denmişti. **96 maçlık bağımsız** tohum
diliminde **−907 / t −2.85**, galibiyet 52→38/96. İddia geri çekildi. Teyit koşusu tam bunu
yakalamak için başlatılmıştı.
