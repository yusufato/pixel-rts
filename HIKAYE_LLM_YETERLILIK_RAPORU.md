# Hikâye Modu Yerel 8B Model Yeterlilik Raporu

**Faz:** 3.1  
**Model:** `Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf`  
**Model boyutu:** 4.920.733.952 bayt  
**Ham rapor:** `qa-runtime/story-llm-benchmark.json`  
**Komut:** `npm run story:llm-bench`  
**Kabul komutu:** `npm run story:llm-gate`  
**Sonuç:** Model tek başına kritik hikâye kararları için **KALDI**; yalnız doğrulanan yardımcı metin görevlerinde kullanılabilir.

## Ölçüm ortamı

- Backend: CUDA
- CPU: 13th Gen Intel Core i7-13620H, 16 mantıksal işlemci
- Sistem belleği: 15.71 GB
- Model süreci RSS: yaklaşık 4.95–4.97 GB
- Bağlam: 2048
- Model yükleme: 4.86 sn
- Ortalama ilk token: 126.29 ms
- Ortalama görev süresi: 1.70 sn
- Gözlenen üretim: yaklaşık 34–40 token/sn

Bu değerler yalnız ölçüm yapılan bilgisayar için geçerlidir. Düşük VRAM, yalnız CPU veya daha az RAM taşıyan hedef cihazlar ayrıca profillenmeden genel minimum sistem gereksinimi sayılamaz.

## Görev sonucu

| Görev | Sonuç | Teknik teşhis |
|---|---|---|
| Bozuk Türkçe niyet ve varlık bağlama | KALDI | Çelik, İngiltere ve Ankara doğru; `intent` alanı anlamsız biçimde `Oyuncu` oldu. |
| Hafıza ve gerçek koruma | KALDI | İlk nesnede gerçekleri kopyaladı; ardından `Sahra Çelik` adlı yeni şirket uydurmaya başladı ve çıktı kesildi. |
| Kısıtlı aday eylem seçimi | KALDI | Doğru `A1` nesnesini yazdı fakat JSON öncesi/sonrası açıklama ekledi; katı sözleşme cevabı değil. |
| Karakter sesi | KALDI | Dört satır üretti fakat “Güvence değil, para” repliğini aynen tekrarladı; insan benzeri konuşma değil. |
| Diyalog tekrar/gerçek güvenliği | KALDI | Cümleler farklıydı fakat bağlamda bulunmayan `3 kat` ve `5000 lira` değerlerini uydurdu. |

Katı sonuç `0 / 5`tir. Önceki gevşek doğrulama `3 / 5` gösteriyordu; bu sahte başarıydı. İlk doğru JSON’u seçip sonrasındaki uydurmayı görmezden gelmek veya yalnız cümle benzerliğine bakıp uydurulmuş sayıları kabul etmek oyun güvenliği açısından geçerli değildir.

## Mimari karar

Yerel 8B modelin izinli rolü:

- Motorun ürettiği gerçeklerden manşet veya atmosfer metni önermek.
- Şablonla zaten çalışan diyaloğu, bütün gerçekler ve isimler doğrulanırsa zenginleştirmek.
- Geçersiz, gecikmiş veya tekrarlı çıktıda hiçbir dünya etkisi oluşturmadan şablona düşmek.

Modelin yasak rolü:

- Oyuncu niyetini tek başına sınıflandırmak.
- Şirket, sözleşme, sevkiyat, fiyat, tarih veya miktar oluşturmak.
- Stratejik/diplomatik aday eylemi doğrudan uygulamak.
- Serbest JSON cevabıyla dünya durumuna yazmak.
- Karakter hafızasının gerçek kaydı olmak.

## Faz 38 için zorunlu tasarım kısıtı

1. Niyet ve varlık çözümü deterministik ayrıştırıcı, izinli eylem sözlüğü ve oyuncu onay kartıyla yapılır.
2. Aday eylemleri motor üretir; maliyet ve uygulanabilirliği motor hesaplar.
3. LLM seçimi yalnız doğrulanan `actionId` ile sınırlıdır. Şema dışı veya ek metinli cevap reddedilir.
4. LLM başarısızsa karakterin deterministik politika skoru seçimi yapar; oyun beklemez ve sonuç değişmez.
5. Sayı, tarih, şirket, şehir ve aktör adları çıktıdan yeniden kabul edilmez; girişteki kimliklerle birebir eşleşmek zorundadır.
6. Diyalog için tam cümle, n-gram, hitap ve uydurulmuş sayı denetimi uygulanır.
7. Modelin metni teklif değildir. Dünya etkili her sonuç, motorun ürettiği sürümlü teklif kartında oyuncuya gösterilir.

## Token bütçesi bulgusu

`--quick` koşusundaki 60 token sınırı doğru yöne giden üç cevabı yarıda kesti ve gevşek puanı `2 / 5`e düşürdü. Tam koşuda 70–120 token kullanıldı; buna rağmen katı sözleşme geçmedi. Dolayısıyla yalnız token artırmak çözüm değildir. Daha büyük sınır gecikme ve uydurma alanını da büyütür.

## Faz kapanışı

```text
Faz: 3.1 — Yerel 8B Model Yeterlilik Tezgâhı
Uygulanan kapsam: Gerçek paket modeliyle ilk-token, toplam süre, token hızı, RSS ve beş görev sınıfı
Değiştirilen şemalar: story-llm-phase3.1-v1 raporu
Yeni özellik bayrağı: Yok
Kayıt göçü: Yok
Otomatik testler: Sabit üretim tohumu, katı JSON, gerçek koruma, tekrar ve sayı uydurma denetimi
Headless koşu sonucu: Teknik çalışma başarılı; model kalite kapısı 0/5
Performans farkı: Dünya motoruna etkisi yok; model ayrı süreçte
Oynanış doğrulaması: Model kritik karar vericisi olarak reddedildi
Bilinen sorunlar: CPU/düşük VRAM hedef profilleri ölçülmedi
Geri alma yöntemi: LLM kapalıyken mevcut deterministik şablonlar
Kabul kapısı: MODEL KALDI; KISITLI MİMARİ KARARI GEÇTİ
Sonraki faza geçilebilir mi: EVET — model yetkisi yukarıdaki sınırlarla
```
