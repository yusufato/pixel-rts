# RCA — Rota benchmarkı fiziksel olarak kapalı koridorları geçilebilir sayıyor

## Verdict

- **Root cause:** probeInfrastructureGraph, benchmark çiftlerini bütün LAND koridorlarından seçiyor; altıgen fizik sidecar'ında yolu bulunmadığı için effectiveCapacity=0 ve BLOCKED olan koridorları elemeden rota bekliyor.
- **Confidence:** Confirmed.
- **Impact:** 88/88 görev tamamlandıktan sonra birleşik kabul aşaması allBenchmarkRoutesFound=false ile düşüyor; canlı rota motoru açık koridorlarda çalışıyor.

## Evidence

- Başarısız iki çift: corridor:land:11:142 ve corridor:land:34:52.
- İkisinde de enabled=true, damageBps=0, fakat fiziksel altıgen zinciri olmadığı için effectiveCapacity=0, status=BLOCKED.
- Kesilen corridor:land:0:1 için rota motoru 0→2→3→1 alternatifini buluyor.
- storyHexInfrastructureCorridorFactorBps, bilinen fakat boş fiziksel zinciri tasarım gereği sıfır kapasiteyle kapatıyor.

## Ranked Hypotheses

1. **Benchmark kapalı koridorları filtrelemiyor — Confirmed.** İki başarısızlığın ikisi de fizik sidecar'ında BLOCKED.
2. **Dijkstra/rota motoru komşu açık kenarı bulamıyor — Refuted.** Açık doğrudan kenarlar ve kesinti alternatifi bulunuyor.
3. **Son sahiplik aynası düzeltmesi rota grafını bozdu — Refuted.** Değişiklik yalnız malzeme rezervasyonu ve commerce lot tüketimine dokunuyor.
4. **Hasar cache invalidation eksik — Refuted.** Kesilen ilk koridor rota sonucundan çıkıyor ve alternatif rota hesaplanıyor.

## Remediation

- Benchmark çiftlerini snapshotAfterCut içindeki LAND, enabled=true, effectiveCapacity>0 koridorlarından seç.
- Kabul mesajını “bütün komşu çiftler” yerine “bütün geçilebilir komşu çiftler” olarak netleştir.
- Fiziksel zinciri olmayan koridorları sihirli biçimde açma; BLOCKED sözleşmesini koru.

## Verification

- infrastructureProbe.main.allBenchmarkRoutesFound === true.
- Hedefli altyapı probu ve rota entegrasyon testleri geçmeli.
- Tam npm test sıfır koduyla tamamlanmalı.
