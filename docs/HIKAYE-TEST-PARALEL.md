# Hikâye modu paralel regresyon tezgâhı

Tarih: 6 Ağustos 2026  
Durum: Altyapı uygulandı; tam seri/paralel süre ve sonuç eşitliği, savaş AI yükü bittikten sonra ölçülecek.

## Değişmeyen kabul sözleşmesi

Paralel koşucu simülasyon süresini, örnek sayısını, tohumları, eşikleri veya assertion'ları azaltmaz. `tests/story-world.test.js` tek kanonik doğrulama kaynağıdır. Fark yalnız yürütme biçimidir:

1. `tools/story-test-manifest.js` bağımsız 51 işi adlandırır.
2. `tools/story-test-parallel.js` bu işleri ayrı Node süreçlerine dağıtır.
3. Her süreç aynı `tools/story-sim-harness.js` fonksiyonunu ve aynı argümanları çalıştırır.
4. Sonuç V8 ikili serileştirmeyle geçici dizine yazılır; koordinatör her artefaktı tekrar açarak doğrular.
5. Kanonik `story-world.test.js`, simülasyonu ikinci kez çalıştırmak yerine aynı sonuçları okuyup mevcut assertion'ların tamamını uygular.

Seri geri dönüş yolu korunur:

```powershell
npm run test:story:serial
```

## Bellek ve CPU güvenliği

Otomatik işçi sayısı şu üç tavanın en küçüğüdür:

- mantıksal çekirdek sayısı eksi bir;
- kullanılabilir RAM'den 3 GB güvenlik rezervi çıkarıldıktan sonra işçi başına 2.200 MB;
- en çok 10 işçi.

Başlangıç CPU örneği `%85+` ise havuz otomatik olarak bir işçiye, `%70+` ise en çok iki işçiye iner. Koordinatör her iki saniyede işçi RSS/heap telemetrisi alır; her 15 saniyede aktif işler, toplam işçi RSS'i ve boş RAM'i raporlar. Boş RAM rezervin altındayken yeni iş başlatılmaz. Büyük işi bitiren ve RSS tavanına yaklaşan süreç geri dönüştürülür.

6 Ağustos'taki hafif kabul probu, savaş AI süreci çalışırken `%94 CPU` ve yalnız `4,3 GiB` boş RAM gördü; otomatik bellek tavanı `1` oldu. Bu doğru davranıştır: paralel koşucu diğer ağır işi boğmaya çalışmadı. `integrityProbe` işçi içinde `2,0 sn`, süreç açılışı/CPU örneklemesi dâhil toplam `5,4 sn` sürdü ve ikili sonuç başarıyla doğrulandı.

Elle tavan verilebilir, fakat bellek-tavanı aşılırsa açık uyarı basılır:

```powershell
npm test -- --workers=4
$env:STORY_TEST_WORKERS=4; npm test
```

16 GB makinede 8–10 işçi ancak gerçek prob RSS ölçümleri bunu güvenli gösterirse kullanılmalıdır. Sayı hedef değildir; donmadan biten en yüksek toplam verim hedeftir.

## Kullanım

```powershell
# Otomatik CPU/RAM tavanlı tam paket (yeni varsayılan)
npm test

# Aynı paket, açık işçi sayısı
npm run test:story -- --workers=3

# Tek görevin işçi/serileştirme hattını doğrula
node tools/story-test-parallel.js --task integrityProbe --workers=1

# Eski tam seri referans
npm run test:story:serial
```

Koşucu geçmiş görev sürelerini `qa-runtime/story-test-timings.json` içinde tutar. Sonraki koşuda uzun işler önce başlatılır (LPT); böylece havuzun sonunda tek uzun işin boş çekirdekleri bekletmesi azaltılır. `qa-runtime/` git dışıdır.

## CPU profili

Profil komutu test davranışını değiştirmez; seçilen gerçek manifest görevini `--cpu-prof` ile çalıştırır:

```powershell
# 900 saniyelik ana kabul koşusu
npm run test:story:profile -- first

# Örneğin seçim probu
npm run test:story:profile -- electionProbe
```

Çıktı `qa-runtime/story-cpu-profiles/` altına yazılır. CPU zaten doygunken profil alınmamalıdır; çekişme sıcak nokta sırasını ve süreleri kirletir. Mevcut savaş AI yükü nedeniyle bu oturumda ağır profil bilinçli olarak çalıştırılmadı.

## Kapanmamış kabul kapıları

Altyapı henüz “5–8× hızlandı” diye kabul edilmedi. Savaş AI koşusu bittikten sonra:

1. `npm run test:story:serial` temiz makine yükünde çalıştırılacak; süre, hash ve çıkış kodu kaydedilecek.
2. `npm test -- --workers=2`, ardından RAM uygunsa `3/4` işçi denenerek aynı hash/rapor/çıkış kodu doğrulanacak.
3. Zirve sistem RAM'i, işçi RSS'i, görev süreleri, süreç geri dönüşümü ve toplam süre kaydedilecek.
4. `first` için tek CPU profili alınacak; en pahalı fonksiyonlar ölçülmeden mikro-optimizasyon yapılmayacak.
5. En hızlı güvenli işçi sayısı varsayılan politika olarak kalibre edilecek. Tam sonuç eşitliği bozulursa paralel yol kabul edilmeyecek ve seri komut kanonik geri dönüş olarak kalacak.
