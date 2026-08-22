# Hikâye modu paralel regresyon tezgâhı

Tarih: 6 Ağustos 2026  
Durum: Kabul edildi. Aynı 52/52 kanonik paket ve aynı durum karması altı işçiyle 489,1 saniyede tamamlandı. Varsayılan havuz altı işçiyi hedefler ve boş RAM düştüğünde yeni görev başlatmayı bekletir.

## Değişmeyen kabul sözleşmesi

Paralel koşucu simülasyon süresini, örnek sayısını, tohumları, eşikleri veya assertion'ları azaltmaz. `tests/story-world.test.js` tek kanonik doğrulama kaynağıdır. Fark yalnız yürütme biçimidir:

1. `tools/story-test-manifest.js` bağımsız 52 işi adlandırır.
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
- kullanılabilir RAM'den 1.024 MB güvenlik rezervi çıkarıldıktan sonra ölçümlere dayalı işçi başına 640 MB planlama payı;
- varsayılan hedef 6 işçi.

V8 heap güvenlik tavanı (`STORY_TEST_WORKER_HEAP_MB`, varsayılan 2.200 MB) planlama tahmininden ayrıdır. Böylece tek bir işçinin ulaşabileceği güvenli tavan korunurken havuz, her işçi baştan bu tavanı kullanıyormuş gibi hesaplanmaz. İşçiler görev sonunda, olay döngüsü müsaitse görev sırasında RSS/heap telemetrisi yollar; koordinatör her 15 saniyede aktif işler, bilinen son toplam işçi RSS'i ve boş RAM'i raporlar. CPU-bağımlı senkron bir görev sürerken ilk RSS değeri `0` görünebilir; bu “bellek kullanılmıyor” anlamına gelmez. Boş RAM rezervin altındayken yeni iş başlatılmaz. Büyük işi bitiren ve RSS tavanına yaklaşan süreç geri dönüştürülür.

Eski politika, 6,1 GiB boş RAM'de işçi başına 2,2 GiB ve 3 GiB rezerv hesabıyla havuzu `1`e kilitliyordu. 52 görevlik ölçümde yeniden kullanılan tek işçinin RSS'i çoğunlukla 0,3–1,1 GiB aralığında kaldı. Yeni 640 MB değeri bir heap limiti değil, bu gerçek örneklerden türetilmiş havuz planlama tahminidir.

Elle tavan verilebilir, fakat bellek-tavanı aşılırsa açık uyarı basılır:

```powershell
npm test -- --workers=4
$env:STORY_TEST_WORKERS=4; npm test
```

16 GB makinede altı işçi ölçülmüş üst varsayılandır. Yedi ve üstü ancak gerçek prob RSS ölçümleri bunu güvenli gösterirse kullanılmalıdır. Sayı hedef değildir; donmadan biten en yüksek toplam verim hedeftir.

## 6 işçi kabul ölçümü

6 Ağustos 2026 tarihinde tam paket açıkça `--workers=6` ile çalıştırıldı:

| Ölçüm | Seri referans | 6 işçi |
|---|---:|---:|
| Kanonik görev | 52 | 52 |
| Sonuç | 52/52 geçti | 52/52 geçti |
| Toplam süre | 1.664,7 sn | 489,1 sn |
| Hızlanma | 1,00× | 3,40× |
| Süre azalması | — | %70,6 |
| Durum karması | `dd4ea478…f42c` | `dd4ea478…f42c` |
| En yüksek raporlanan işçi RSS toplamı | — | 5,3 GiB |
| En düşük gözlenen boş RAM | — | 0,8 GiB |

Altı işçi sonuç eşitliğini bozmadı ve çökmeden tamamlandı. 1.024 MB rezerv yeni görev atamasını durdurur; zaten çalışan altı ağır görevi öldürmez. Bu nedenle ilk dalgada boş RAM kısa süre 0,8 GiB'a inebilir. Daha yüksek işçi sayısı bu makinede varsayılan yapılmamalıdır.

## Kullanım

```powershell
# Otomatik CPU/RAM tavanlı tam paket (yeni varsayılan)
npm test

# Simülasyon çalıştırmadan seçilecek havuzu göster
npm run test:story:plan

# Aynı paket, açık işçi sayısı
npm run test:story -- --workers=6

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

## Sonraki performans işi

Paralel tezgâh kabul edildi; fakat ilk tahmindeki 5–8× yerine gerçek kazanç 3,40× oldu. Kalan hız farkı ölçülmeden mikro-optimizasyon yapılmayacak:

1. Savaş AI yükü yokken `first` için tek CPU profili alınacak.
2. Uzun ilk altı görevin ortak sıcak fonksiyonları çıkarılacak.
3. Yedi işçi denenmeyecek; 0,8 GiB asgari boş RAM zaten altı işçinin makine için pratik üst sınır olduğunu gösteriyor.
4. Seri komut kanonik geri dönüş yolu olarak korunacak.
