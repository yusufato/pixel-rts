# İKİ MAKİNE — koordinasyon

İki Claude oturumu aynı repo üzerinde çalışır ve birbirini **git üzerinden** görür.
Bu dosya tek gerçek kaynaktır: kim ne yapıyor, hangi tohum havuzu kimin.

## Makineler

| ad | çekirdek | rol |
|---|---|---|
| **CYBORG** | 16 | bu oturum — savaş AI hattı (klonlama → eğitim → kapılar) |
| *(ikinci makine — adını buraya yazsın)* | 20 | veri üretimi + ikinci kol |

> İkinci makine ilk iş olarak bu tabloya adını ve o an ne yaptığını yazsın.

## ALTIN KURAL — tohum havuzları AYRIK

Bugün yaşandı: 12 işçi aynı maçı koştu, 3 dakika boşa gitti (`--tohum` açık liste bekliyor,
`--tohumofs` diye bir şey yok). İki makinede aynısı olursa **yarısı boşa gider**.

| havuz | sahibi | durum |
|---|---|---|
| 20000-24799 | CYBORG | kullanıldı (kısmi, ilk hatalı koşu) |
| 40000-40959 | CYBORG | kullanıldı (kısmi) |
| 50000-50899 | CYBORG | kullanıldı (kısmi) |
| **70000-71999** | CYBORG | **kullanıldı — 14.815 karar, bc3/** |
| **100000-199999** | **CYBORG** | ayrıldı, gelecek koşular |
| **200000-299999** | **ikinci makine** | ayrıldı — buradan al |

Kural: kendi bloğunun dışına ÇIKMA. Yeni blok gerekiyorsa bu dosyaya yaz ve commit et.

## İş bölümü (öneri — ikinci makine geldiğinde güncellenir)

- **CYBORG**: davranış klonlama eğitimi + üç kapı (etiket → davranış → maç). GPU burada.
- **İkinci makine (20 çekirdek)**: veri üretimi. Simülasyon CPU işi olduğu için 20 çekirdek
  doğrudan çarpan. Komut:
  ```
  node tools/bc-uret.js --bconly --isci 8 --tohum 250 --ofs 200000 --dizin qa-runtime/bc-m2
  ```
  (`--isci` sayısını KENDİ makinende ölç — bu makinede 6/9/12 aynı hızı verdi, ~18 karar/dk'da
  doyuyordu; rollout'suz kipte 8 işçi 511 karar/dk verdi.)

## Çakışma önleme

- Her makine **kendi klasörüne** yazar: `qa-runtime/bc*` CYBORG, `qa-runtime/bc-m2*` ikinci makine.
- `qa-runtime/` git'e girmez (büyük); veri paylaşımı gerekirse ayrıca konuşulur.
- **Motor dosyalarına (js/) aynı anda iki makine dokunmasın.** Kim dokunacaksa bu dosyaya yazsın.
- Ölçüm sonuçları ve kararlar `docs/` altına yazılır — ikisi de oradan okur.

## Durum defteri

| tarih | makine | ne yapıldı |
|---|---|---|
| 2026-08-07 | CYBORG | BC veri hattı kuruldu (rollout'suz, 31× hızlı); 14.815 karar üretildi, 15.014 karar etiketlendi (%100) |
