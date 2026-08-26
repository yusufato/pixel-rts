MODE: AUDIT

# 1) Verdict

- **Başlık:** Konsey önergesi etkisi başarısız olduğunda ödeme kalıyor ve başarı metni dönüyor
- **Kategori:** Transaction sınırı yokluğu / sessiz exception / sahte başarı
- **Önem:** High
- **Güven:** Confirmed
- **Konum:** `js/Council.js:378-404, 405-509`
- **Kök neden:** `storyCouncilApply` önce `storyCouncilPayFromState` ile geri
  alınamaz ödemeyi işler, sonra önergenin doğrudan mutasyon yapan `apply`
  callback'ini boş `catch` içinde çağırır. Callback sonucunu veya exception'ı
  makbuza dönüştürmeden her durumda “kabul edildi” metni üretir.

# 2) Failure

Bir konsey önergesi ödeme aşamasını geçip dünya etkisinde exception üretirse
oyuncu kaynağı kaybeder, hedeflenen sonuç oluşmaz ve UI kararı başarılı anlatır.
Bekleyen, başarısız, geri alınmış veya yeniden denenebilir durum bulunmaz. Aynı
önerge tekrar edilirse ikinci kez ödeme alınabilir.

# 3) Evidence

Kontrollü runtime fixtüründe `MOTION_BY_ID.roads.apply`, yalnız hata yolunu
ayırmak için exception üretecek biçimde geçici değiştirildi:

- Başlangıç nakdi: 3.000.
- Önerge maliyeti: 150.
- Son nakit: 2.850.
- Fiziksel/soyut hedef sonucu: toplam wealth 0; değişim yok.
- Dönüş: `📌 Otoyol Yatırım Programı kabul edildi`.
- Kaynak: `try { m.apply(st); } catch (e) { /* ... */ }` sonrasında koşulsuz
  başarı metni.

# 4) Hypotheses

| Sıra | Hipotez | Durum | Ayırt edici kanıt |
|---|---|---|---|
| 1 | Ödeme ve etki ortak transaction içinde değil | Confirmed | Ödeme kaldı, etki yoktu |
| 2 | Exception oyuncuya açık başarısızlık olarak dönüyor | Refuted | Dönüş metni “kabul edildi” |
| 3 | Callback hata verirse ödeme otomatik rollback oluyor | Refuted | Nakit 3.000→2.850 kaldı |
| 4 | Önerge etkileri saf/yan etkisiz olduğu için rollback gereksiz | Refuted | Callback'ler wealth, bina, garnizon, refah, sadakat ve cüzdanları doğrudan değiştiriyor |
| 5 | Sorun yalnız yapay fixtürde mümkün | Refuted as safety claim | Gelecek veya mevcut callback bağımlılığı exception ürettiğinde aynı koşulsuz yol çalışır; hata kapısı üretimde mevcut |

# 5) Mechanism

`storyCouncilPayFromState` bütçe puanını journal'a, petrol/insan maliyetini
komutan cüzdanlarına hemen yazar. Bu fonksiyon geri alma makbuzu veya rezervasyon
kimliği döndürmez. `storyCouncilApply` daha sonra katalog callback'ini çağırır.
Callback'ler tek kanonik domain komutu kullanmaz; bir kısmı birden fazla canlı
alanı doğrudan değiştirir. Exception yakalanıp atıldığı için çağıran taraf hata
olduğunu bilmez ve koşulsuz başarı metni alır.

Algılama başarısızlığı: mevcut uzun simülasyon yalnız `council.decision`
telemetrisinin sıfırdan büyük olduğunu sınar. Ödeme, fiziksel sonuç, makbuz ve
rollback arasında invariant kurmaz.

# 6) Remediation Options

## Dar bugfix

- `storyCouncilApply` başarısız callback'te açık başarısız makbuz döndürsün.
- Ödeme etki başarıyla hazırlanıp doğrulanana kadar rezervasyonda tutulsun veya
  güvenli geri alma makbuzu üretsin.
- Hata ayrıntısı teşhis kaydına yazılsın; oyuncuya teknik stack değil anlaşılır
  ret/geri alma nedeni gösterilsin.
- **Risk:** Mevcut callback'ler doğrudan çoklu alan değiştirdiği için exception
  etkiden sonra gelirse yalnız ödemeyi iade etmek kısmi dünya mutasyonunu çözmez.

## Yapısal düzeltme

- Her önergeyi `preview -> reserve -> canonical domain command -> validate ->
  commit/rollback -> receipt` zincirine taşı.
- Yol, cephanelik, garnizon, nüfus ve refah maddeleri kendi altyapı, hex inşaat,
  nüfus ve toplum komutlarını kullansın.
- Tek `correlationId` bütçe ve fiziksel sonucu bağlasın; doğrudan callback alan
  mutasyonu kaldırılmadan atomiklik tamamlanmış sayılmasın.
- **Risk:** Ürün davranışı, denge ve kayıt göçü değişir; COUNCIL-01/K-11 kararı
  ayrı tasarım aşamasıdır.

## Prevention

- Başarı metni veya başarı makbuzu terminal fiziksel sonuç doğrulanmadan üretilmesin.
- Domain callback exception'ları boş `catch` ile yutulmasın.
- Her kaynak harcayan komut failure-injection testine sahip olsun.
- Testler telemetri olayını değil ödeme + sonuç + makbuz atomikliğini sınasın.

# 7) Verification Plan

1. Her önergeyi ödeme öncesi, domain uygulaması ve doğrulama aşamasında kontrollü hata verdir.
2. Bütün başarısızlıklarda bütçe/cüzdan, şehir, nüfus, stok, ilişki ve altyapı snapshot farkı sıfır olsun.
3. Başarısız dönüş açık `REJECTED` veya `ROLLED_BACK` durumu ve neden taşısın.
4. Başarılı önerge tam bir kez ödeme ve tam bir kez fiziksel sonuç üretsin.
5. Aynı idempotency/correlation kimliğiyle tekrar çağrı ikinci ödeme üretmesin.
6. Hata etkiden sonra oluşursa bütün domain yan etkileri geri alınsın; yalnız ödeme iadesi yeterli sayılmasın.
7. Save/load rezervasyon veya ara transaction durumunu çift uygulamasın.
8. Oyuncu ve AI konseyleri aynı yürütme yolunu kullansın.
9. `councilMotionFailureIsAtomic`, bütçe validatorleri ve uzun simülasyon birlikte geçsin.
