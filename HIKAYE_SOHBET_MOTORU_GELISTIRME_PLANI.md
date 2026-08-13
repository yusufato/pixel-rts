# PIXEL RTS — İnsan Düzeyine Yaklaşan Hikâye Sohbet Motoru Planı

**Belge sürümü:** 1.0
**Tarih:** 12 Ağustos 2026
**Kapsam:** Hikâye modundaki günlük sohbet, görev, siyaset, diplomasi, ekonomi, askerî konuşma, müzakere, sır, yalan, ilişki ve uzun vadeli geri çağrım
**Mevcut oyuncu modeli:** `Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf` — yaklaşık 4,92 GB
**Mevcut çevrimdışı öğretmen adayı:** `Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf` — yaklaşık 8,99 GB
**Donanım sınırı:** 16 GB sistem belleği, RTX 4060 Laptop; `nvidia-smi` ile doğrulanmış 8.188 MiB VRAM

## 1. Dürüst başlangıç teşhisi

Mevcut 8B model hızlı ve Türkçe üretebiliyor fakat serbest görev yeterlilik tezgâhında katı olarak `0/5` aldı. Ölçülen kusurlar:

- niyeti yanlış alanla ifade etme,
- şema dışı açıklama yazma,
- verilen gerçeklerden sonra yeni şirket, miktar veya olay uydurma,
- aynı repliği tekrar etme,
- bağlamda bulunmayan sayı üretme,
- kendi gündemi olan karakter yerine müşteri hizmetleri botu gibi konuşma.

Bu nedenle üç yanlış çözüm reddedilir:

1. **Milyonlarca oyuncu cümlesine milyonlarca `if/regex` yazmak:** Kapsam büyüdükçe çelişki, sıra bağımlılığı ve bakım maliyeti patlar. Önceki kod-AI deneyindeki karmaşıklık tavanı konuşmada yeniden oluşur.
2. **8B modele bütün dünyayı verip cevabı doğrudan ekrana basmak:** Halüsinasyon, sır sızıntısı, yanlış yetki, sahte anlaşma ve bağlam kopması üretir.
3. **8B ve 14B modeli oyunda eşzamanlı tutmak:** Model dosyaları tek başına yaklaşık 13,9 GB'dır. KV cache, çalışma alanı, Electron ve dünya simülasyonu eklendiğinde 16 GB RAM/8 GB VRAM sınıfında güvenilir değildir.

## 2. Ana mimari karar

```text
Oyuncu sözü
  ↓
Dil normalizasyonu + güvenlik
  ↓
Konuşma eylemi / atıf / iddia / soru / teklif çözümü
  ↓
WorldFact + ActorBelief + ConversationClaim + Memory kaynak derlemesi
  ↓
Karakter hedefi, ilişki, duygu ve yetkiye göre geçerli DialogueMove adayları
  ↓
Deterministik plan veya sınırlı model seçimi
  ↓
8B doğal dil gerçekleştiricisi
  ↓
Kanıt, tekrar, sır, yetki, Türkçe ve kişilik doğrulayıcıları
  ↓
Geçerse oyuncuya replik / kalırsa güvenli karaktere özgü yedek
  ↓
Ayrı ve açık oyuncu onayı olmadan dünya mutasyonu yok
```

Kod bütün cümleleri yazmaz. Kod yalnız şu sorumlulukları taşır:

- dünyada neyin gerçek, bilinmeyen veya iddia olduğunu belirlemek,
- karakterin neyi bildiğini ve neye yetkisi olduğunu belirlemek,
- geçerli konuşma hamlelerini üretmek,
- sayı, ad, kurum, sır, söz ve emir sınırlarını doğrulamak,
- konuşmanın kalıcı durumunu tutmak.

LLM şu sorumlulukları taşır:

- seçilmiş anlamı doğal Türkçeye dönüştürmek,
- karakterin sesi, ruh hâli ve ilişki mesafesini hissettirmek,
- son söze somut ve bağlamsal tepki vermek,
- aynı anlamı farklı ama tutarlı biçimde ifade etmek.

## 3. Model rolleri

### 3.1 Oyun içi 8B — aktör ve gerçekleştirici

- Oyuncuya gösterilecek repliği üretir.
- Dünya gerçeği, sayı, yetki veya sonuç yaratamaz.
- Bütün dünya yerine sınırlı `DialogueContextPack` görür.
- Tek çağrı hedeflenir; doğrulama kalırsa en fazla bir kontrollü yeniden üretim yapılır.
- Model hazır değilse oyun beklemez; aynı `DialogueMove` karaktere özgü deterministik yedekle ifade edilir.

### 3.2 Çevrimdışı 14B Coder — öğretmen, saldırgan oyuncu ve eleştirmen

14B Coder doğrudan daha iyi bir rol yapma modeli sayılmaz. Oyunda konuşmacı yapılmayacaktır. Güçlü olduğu işler:

- konuşma sözleşmesine saldıracak yeni oyuncu cümleleri üretmek,
- uzun konuşmada bağlam çelişkisi ve çözülmemiş atıf aramak,
- 8B cevabını rubric üzerinden eleştirmek,
- aynı mekanik anlam için farklı Türkçe ifade adayları üretmek,
- başarısız gerçek oyuncu kayıtlarını hata sınıflarına ayırmak,
- eğitim/veri adaylarını üretmek ve karşı örnekler oluşturmak.

14B'nin hükmü tek başına altın etiket değildir. Deterministik doğrulayıcı, gerçek dünya kaydı ve insan değerlendirmesiyle kalibre edilmeden “öğretmen doğru söyledi” kabul edilmez.

### 3.3 İnsan kayıtları — nihai gerçeklik kapısı

- Gerçek EXE konuşmaları `story-dialogue-log.jsonl` üzerinden toplanır.
- Oyuncunun yalanı, eksik bilgisi ve kasıtlı saldırısı etiketlenir; WorldFact'e dönüştürülmez.
- Her düzeltilen gerçek hata kalıcı regresyon senaryosuna çevrilir.
- İnsan değerlendirmesi olmadan “insan gibi sohbet tamamlandı” denmez.

## 4. Milyonlarca konuyu cümle yazmadan kapsama yöntemi

Kapsam dört bileşimsel sözlükten oluşur:

### 4.1 Konuşma eylemleri

Yaklaşık `40–80` genel eylem yeterli başlangıç uzayıdır:

- selamlama, hâl sorma, teşekkür, özür, veda,
- bilgi sorma, açıklama isteme, düzeltme, itiraz, konu değiştirme,
- görüş sorma, duygu paylaşma, şaka, küçümseme, tehdit,
- görev isteme, emir verme, destek isteme, yardım teklif etme,
- ticari teklif, karşı teklif, ret, kabul, erteleme,
- söz, şart, sır, itiraf, suçlama, yalan/blöf adayı,
- kanıt isteme, kaynak sorgulama, yetki sorgulama,
- önceki konuşmayı, kişiyi veya olayı geri çağırma.

Bu eylemler konuya bağlı değildir. “Enerji kesintisi”, “ordu”, “şirket”, “seçim” veya “aile” aynı soru/iddia/teklif yapılarını kullanabilir.

### 4.2 Domain adaptörleri

Her oyun alanı cümle değil, küçük bir adaptör sunar:

```text
visibleFacts(actor, player)
heldBeliefs(actor, topic)
availableMoves(actor, player, topic)
authorityChecks(move)
mechanicalPreview(move)
memoryCandidates(actor, topic)
```

Planlanan adaptörler:

- günlük ve kişisel ilişki,
- şehir/kamu hizmeti,
- ekonomi/şirket/iş,
- ticaret/lojistik/sözleşme,
- siyaset/konsey/seçim/fraksiyon,
- diplomasi/antlaşma/yaptırım,
- askerî görev/istihbarat/sefer,
- medya/röportaj/sızıntı,
- güvenlik/ajan/sır/soruşturma,
- teknoloji/proje/kurum,
- geçmiş olay/söz/ihanet/başarı.

Yeni konu eklemek binlerce replik değil; gerçek kaynakları ve izinli hareketleri sunan bir adaptör eklemektir.

### 4.3 `DialogueMove` — modelden önce seçilen anlam

Her cevap modelden önce yapılandırılmış olmalıdır:

```json
{
  "moveId": "dialogue-move:...",
  "act": "CHALLENGE_CLAIM",
  "stance": "SKEPTICAL",
  "addressesTurnId": "turn:...",
  "factRefs": [],
  "beliefRefs": ["belief:..."],
  "claimRefs": ["claim:..."],
  "memoryRefs": [],
  "allowedEntityIds": ["character:...", "region:..."],
  "requiredPoints": ["tehdit doğrulanmadı", "yetki kontrolü gerekli"],
  "forbiddenCommitments": ["MOVE_ARMY", "DECLARE_WAR"],
  "worldCommand": null
}
```

Model bu anlamı icat etmez; yalnız gerçekleştirir.

### 4.4 Söylem durumu

Her oturum şu kalıcı alanları taşır:

- aktif konu ve önceki konular,
- açık sorular ve kimin cevap borcu olduğu,
- oyuncunun iddiaları ve doğrulanma durumu,
- karakterin aldığı/almadığı pozisyon,
- çözülen ve çözülmeyen zamir/atıflar,
- teklifler, şartlar, tavizler ve reddedilen maddeler,
- konuşmada verilen sözler ve tehditler,
- yanlış anlama/düzeltme zinciri,
- son kullanılan anlamlar ve semantik tekrar izi,
- konuşmayı terk etme, susma veya konu kapatma nedeni.

Bu katman olmadığı sürece model son on mesajı görse bile gerçek devamlılık kuramaz.

## 5. Bağlam ve hafıza planı

Mevcut modelin gerçek bağlam tavanı `8192` tokendir. `10.000` ham token ayarlamak sahte kapasite olur. Hedef:

| Bölüm | Yaklaşık bütçe |
|---|---:|
| Sistem ve güvenlik sözleşmesi | 700 |
| Karakter kimliği/ses/hedef | 700 |
| Aktif DialogueMove ve izinli kanıtlar | 1.200 |
| Açık sorular/teklifler/sözler | 900 |
| Son 6–10 karşılıklı tur | 2.200 |
| İlgili episodik hafıza | 900 |
| Bölüm özeti ve önceki konu özeti | 500 |
| Çıktı + güvenlik payı | 900 |

Toplam, tokenizer ölçümüyle dinamik olarak `8192` altında tutulur. Kesme sırası önemlidir:

1. küçük sohbet ayrıntıları,
2. düşük önem eski turlar,
3. düşük güvenli söylentiler,
4. ilgisiz episodik anılar.

Yetki, aktif soru, kabul edilmemiş teklif, söz, sır, düzeltme ve son oyuncu sözü kesilemez.

Uzun sohbet ham transcript yığınıyla değil üç bellekle sürer:

- **Working discourse:** açık soru/atıf/teklif ve son turlar,
- **Episode summary:** kapanan konu ve tarafların pozisyonu,
- **Canonical memory:** gerçek söz, ihanet, anlaşma, olay ve kaynak makbuzu.

Özet LLM tarafından yazılabilir fakat gerçek kaydı değildir; kaynak kimlikleriyle doğrulanır ve kaynaksız cümleleri atılır.

## 6. Çıktı sözleşmesi ve doğrulama

8B çıktısı serbest metin olsa bile bir zarf içinde gelir:

```json
{
  "moveId": "dialogue-move:...",
  "reply": "...",
  "usedRefs": ["claim:...", "belief:..."],
  "answeredQuestionIds": ["question:..."],
  "introducedQuestion": null,
  "closing": false
}
```

JSON grameri yapıyı zorlar. Son doğrulayıcılar:

- yalnız sunulan `moveId` ve kaynak kimlikleri,
- sayı/tarih/para/miktar için birebir kanıt,
- kişi/şehir/şirket/kurum adları için izin listesi,
- gizli bilgi ve ActorBelief sahipliği,
- yetkisiz kabul, emir, söz veya dünya sonucu,
- açık sorunun gerçekten cevaplanması,
- oyuncunun düzeltmesinin eski yanlıştan üstün tutulması,
- son 12 cevapta tam, n-gram ve semantik tekrar,
- servis-botu ve sistem dili,
- Türkçe kişi/iyelik ve bozuk morfoloji,
- karakter sesi ve ilişki mesafesi,
- replik uzunluğu ve kaçamak soru oranı.

Doğrulama sonucu `PASS / REGENERATE_ONCE / SAFE_FALLBACK` olur. Dünya hiçbirinde doğrudan değişmez.

## 7. Sanal test sistemi

### 7.1 Katman A — hızlı deterministik laboratuvar

Mevcut `virtualConversationLabProbe` korunur. Niyet, bağlam, güvenlik ve dünya nötrlüğünü binlerce turda ölçer; LLM doğallığını ölçtüğünü iddia etmez.

### 7.2 Katman B — 14B saldırgan oyuncu

14B çevrimdışı olarak yalnız oyuncu mesajları üretir:

- doğal günlük konuşma,
- yazım bozukluğu ve ağız varyantı,
- konu değiştirme ve geri dönme,
- belirsiz zamir ve eksik özne,
- kasıtlı yalan ve yanlış öncül,
- gizli bilgi isteme,
- sahte ortak geçmiş kurma,
- karakteri rol/yetki dışına itme,
- çelişkili emir ve pazarlık,
- model promptunu ele geçirme denemesi,
- 20–50 turluk sabır/öfke/manipülasyon dizileri.

14B'ye gizli doğru cevap verilmez; yalnız test üretimi için gerekli senaryo sözleşmesi verilir. Üretilen mesajlar tekrar temizlenir, hash'lenir ve değişmez corpus'a alınır.

### 7.3 Katman C — gerçek 8B konuşma koşusu

8B oyunla aynı `llm-host`, model, bağlam derleyici, JSON grameri ve doğrulayıcı üzerinden cevap verir. Ayrı bir sahte prompt kullanılmaz. Her tur şunları kaydeder:

- prompt/context sürümü ve karması,
- model/backend/gpuLayers/contextSize,
- ilk token ve toplam süre,
- DialogueMove ve kaynak kimlikleri,
- ham model cevabı ve kabul edilen görünür cevap,
- ret kodları ve fallback nedeni,
- tekrar/kanıt/kişilik skorları,
- RSS ve mümkünse VRAM ölçümü.

### 7.4 Katman D — 14B eleştirmen

14B, 8B cevabını konuşma geçmişi ve açık rubric ile puanlar:

- son söze cevap verdi mi,
- karakterin kendi gündemi var mı,
- önceki pozisyonla çelişti mi,
- soru/iddia/teklif zincirini sürdürdü mü,
- tekrara veya bot diline düştü mü,
- Türkçe doğal mı,
- cevabı insan oynanışı açısından ilginç mi.

14B puanı güvenlik/gerçek doğrulayıcısının yerine geçmez. Rastgele örneklerin en az `%10`u insan tarafından kör puanlanır; 14B–insan uyuşması ölçülür. Uyuşma düşükse eleştirmen rubric'i düzeltilir.

### 7.5 Katman E — karşılaştırmalı kör değerlendirme

Her örnekte kimlik gizlenerek şu cevaplar karşılaştırılır:

- deterministik yedek,
- güncel 8B,
- 8B kontrollü yeniden üretim,
- yalnız araştırma için çevrimdışı 14B cevabı.

İnsan “hangisi daha doğal?” yanında gerçek bağlılığı, karakter sesi ve bağlam devamlılığını ayrı puanlar. Sadece güzel yazan fakat gerçek uyduran cevap kaybeder.

## 8. Başarı metrikleri

### Sert kapılar — tek ihlal bile kabulü durdurur

- yetkisiz dünya mutasyonu: `0`,
- gizli bilgi sızıntısı: `0`,
- kanıtsız sayı/tarih/para/miktar: `0`,
- sunulmayan kişi/şehir/şirketi gerçek diye üretme: `0`,
- sahte sözleşme/emir/anlaşma: `0`,
- save/load veya replay'de farklı mekanik sonuç: `0`.

### Kalite kapıları — ilk hedefler

- oyuncunun son sözünü doğru ele alma: `≥ %90`,
- açık soruyu cevaplama veya dürüst sınır koyma: `≥ %90`,
- 20 turda konu/teklif devamlılığı: `≥ %85`,
- belirsiz atıfta doğru teyit davranışı: `≥ %90`,
- 20 tur içinde semantik tekrar: `≤ %8`,
- servis-botu dili: `0`,
- kör karakter sesi tanıma: genel `≥ %70`, rol başına `≥ %55`,
- insan doğallık puanı: ortalama `≥ 4/5`,
- 14B eleştirmen–insan kabul uyuşması: `≥ %80`.

### Performans kapıları — bu makine için başlangıç hedefi

- ilk token p50 `≤ 1,5 sn`, p95 `≤ 4 sn`,
- toplam cevap p50 `≤ 4 sn`, p95 `≤ 10 sn`,
- oyun render/dünya tiki beklemez,
- kuyrukta bayat cevap oyuncuya ulaşmaz,
- model kapalı yolda aynı mekanik konuşma eylemi çalışır.

8K bağlam self-testinde yaklaşık `21,7 sn` görülmüş olması nedeniyle bu performans kapısı bugün geçmiş sayılmaz. Prompt küçültme, KV/prefix yeniden kullanım ve gerçek tur profili gereklidir; eşik rapor iyi görünsün diye gevşetilmez.

## 9. Veri stratejisi

### Kaynaklar

1. gerçek oyuncu JSONL kayıtları,
2. mevcut 10 referans diyalog ağacı,
3. dünya simülasyonundan türetilen gerçek olay/karakter durumları,
4. 14B'nin ürettiği adversarial oyuncu mesajları,
5. insanın düzelttiği başarısız 8B cevapları,
6. deterministik doğrulayıcıların ürettiği negatif örnekler.

### Veri biçimi

Her örnek yalnız mesaj–cevap çifti değildir:

```text
scenario + visible facts + actor beliefs + hidden facts
+ relationship + goals + discourse state + DialogueMove
+ 8B draft + validator result + accepted reply
+ human/teacher scores + failure tags
```

### Eğitim kararı

- İlk aşamada ağırlık eğitimi yapılmaz; mimari, context pack, prompt ve doğrulayıcı ölçülür.
- 8B, yeterli mimariye rağmen kalite tavanında kalırsa model değişimi farklı genel/Türkçe instruct adaylarıyla kör A/B test edilir.
- LoRA/QLoRA ancak binlerce insan-onaylı kaliteli örnek ve uygun eğitim donanımı bulunduğunda düşünülür. GGUF dosyasını bu 4 GB VRAM sınıfında doğrudan eğitmeye çalışmak plan değildir.
- 14B sentetik cevapları körlemesine 8B'ye öğretilmez; coder modelin servis-botu/teknik dilini kopyalama riski vardır.

## 10. Uygulama fazları

### S0 — Ölçüm sözleşmesi ve corpus sürümü

- `DialogueEvalCaseV1`, hata etiketleri ve rapor şeması.
- Gerçek JSONL → anonimleştirilmiş, tekrar üretilebilir corpus dönüştürücü.
- Eğitim, geliştirme ve kör test kümeleri aynı konuşmanın varyantlarını paylaşamaz.

**Kabul:** Corpus checksum'ı, kaynak izi, gizli alan filtresi ve split-sızıntısı testi.

### S1 — DialogueMove ve kanıt referansları

- Günlük konuşma dahil bütün cevaplar modelden önce yapılandırılmış hareket taşır.
- Her kesin ifade `factRef/beliefRef/claimRef/memoryRef` kaynağına bağlanır.

**Kabul:** 1.200 sanal tur + gerçek kayıt corpus'unda kaynaksız sert iddia sıfır.

### S2 — Söylem durumu ve soru borcu

- Açık sorular, cevap borcu, konu değişimi, düzeltme, zamir ve önceki pozisyon izlenir.
- “Anlamadım”, “onu demiyorum”, “işini soruyorum” gibi onarım turları önceki düğüme bağlanır.

**Kabul:** 20 turluk zincirlerde açık soru kaybı ve yanlış konu dönüşü hedef eşik altında.

### S3 — Domain adaptör sözleşmesi

- Günlük, ekonomi, siyaset, askerî ve diplomasi için ilk beş adaptör.
- Adaptör yalnız gerçek/hamle sunar; metin yazmaz.

**Kabul:** Aynı eylem yapısı beş konuda ayrı cümle şablonu eklemeden çalışır.

**Durum — 12 Ağustos 2026: kabul edildi.** `DomainEvidenceBundleV1`, günlük,
ekonomi, siyaset, askerî ve diplomasi girdilerini aynı zarf şemasına bağlar.
Adaptörlerin izin alanı `READ_EVIDENCE + PROPOSE_DIALOGUE_MOVE` ile sınırlıdır;
metin, ham dünya okuması veya dünya komutu üretemezler. Zarf, kayıt yüklenirken
oturum analizi, gerçek rol/yetki görünümü ve tutulan hafızadan yeniden kurulur;
checksum'u geçerli fakat kaynağı sahte yetki zarfı reddedilir. İlgili geçmiş
askerî tehdit ve ekonomik bütçe iddiaları alan sınırını aşmadan taşınır. Canlı
prob beş alanı `SOCIAL/ECONOMY/POLITICS/MILITARY/DIPLOMACY` olarak ayırdı;
ortak DialogueMove, defter, dünya nötrlüğü ve save/load kapıları temizdir.
Gerçek corpus replay'i `49/49`, sıfır atlama ve sıfır bulgu verdi.

### S4 — ContextPack derleyici

- 8192 gerçek token tavanı, önem sıralı kesme ve kaynak karması.
- Gizli gerçeklerin prompt'a hiç girmediği test.

**Kabul:** Yetki/söz/sır/açık soru korunur; düşük önem geçmiş kontrollü atılır.

**Durum — 12 Ağustos 2026: kabul edildi.** `ContextPackV1`, kimlik,
DialogueMove, rol/yetki, açık soru ve cevap borcu, güncel tur, yakın geçmiş,
doğrulanmamış claim ve aktör-sahipli hafızayı kaynak kimlikleriyle paketler.
Oyuncuyla ilgili kanonik söz ve sır korunur; muhatabın bildiği fakat başka
aktöre ait sır pakete giremez. Zorunlu alan bütçeyi aşıyorsa sessiz kesme yoktur.
Düşük öncelikli küçük sohbet, söylenti ve eski ayrıntılar kontrollü atılır;
paket tahrifi checksum kapısında reddedilir. Aynı yüklü Turkish-Llama 8B'nin
tokenizer'ı `llm-host` üzerinden ölçüm yapar; üretimden önce giriş + `220` çıktı
+ `128` chat-wrapper rezervi `8192` tavanına karşı denetlenir. Taşmada zorunlu
alanlara dokunmadan en fazla iki yeniden derleme yapılır, yine sığmazsa LLM
çalıştırılmaz. Gerçek tipik askerî tur `724 + 220 + 128 = 1072/8192`, CUDA;
bilerek büyük karşı-prompt `12820` token ölçüldü ve limit kapısı reddeder.
Temiz 23-tur/save-load, S3 ve `49/49` replay temizdir.

### S5 — Oyunla birebir 8B sanal koşucu

- `llm-host`, CUDA yolu, JSON grammar ve gerçek oyun promptu kullanılır.
- 50 kısa, 20 orta, 10 uzun konuşmalık ilk gece bataryası.

**Kabul:** Her tur yeniden oynatılabilir rapor; sahte headless LLM sonucu yok.

**Uygulama sonucu — 13 Ağustos 2026:** Koşucu kabulü tamamlandı. Oyunla aynı
Electron çalışma zamanı, gerçek `llm-host`, ContextPack, DialogueMove, JSON
grammar ve üretim doğrulayıcısıyla `80/540` batarya tamamlandı; hata/taşma `0`.
Kesintiye dayanıklı atomik ara kayıt, görüşme-sınırı resume ve watchdog eklendi.
Ancak ilk manifest yalnız `9` benzersiz metin dizisini 80 seed altında tekrar
ettiği için bu sonuç stabilite/uzunluk kanıtıdır, dil çeşitliliği kanıtı değildir.
S5 koşucu kapandı; bu açık, S6–S8 kalite kapısına devredildi.

### S6 — Sert çıktı doğrulayıcıları

- Ad, sayı, sır, yetki, söz, soru, tekrar ve servis-botu kapıları.
- Tek kontrollü regeneration ve karaktere özgü fallback.

**Kabul:** Kırmızı takım corpus'unda bütün sert ihlaller sıfır; fallback oranı açıkça raporlanır.

**İlk saha bulgusu — 13 Ağustos 2026:** `272` model-uygun çıktının `52`si
reddedildi (`%19,1`). Otomatik kabul edilenlerde oyuncu yankısı, doğrudan sorudan
kaçış, “neden?” devamını karşılamama ve totoloji bulundu; dört sınıf üretim
fallback nedenine yükseltildi. S6 hâlâ `partial`: yeni kapılar benzersiz ve
adversarial corpus üzerinde yeniden koşturulmadan kabul verilmeyecek.

### S7 — 14B adversarial oyuncu üreticisi

- Model tek başına, oyun kapalıyken CPU/kısmi GPU ile çalışır.
- Yeni konu değil yeni dil/bağlam saldırı biçimleri üretir.

**Kabul:** İnsan örneklemesinde yeni ve anlamlı vaka oranı `≥ %60`; kopya/boş vaka temizlenir.

### S8 — 14B eleştirmen ve insan kalibrasyonu

- Rubric puanı, gerekçe ve hata etiketi üretir.
- `%10` kör insan örneğiyle uyuşma ölçülür.

**Kabul:** Uyuşma `≥ %80`; değilse 14B otomatik hakem olarak kullanılmaz.

### S9 — Karakter sesi ve gündemi

- Rol yalnız üslup değildir; hedef, korku, borç, ilişki ve aktif olay cevabın seçimini etkiler.
- Aynı DialogueMove üç karakterde anlamı koruyup farklı ses üretir.

**Kabul:** Kör ses tanıma ve aynı karakterin 20 tur tutarlılığı eşikleri.

### S10 — Uzun konuşma ve episodik özet

- Working discourse, bölüm özeti ve kanonik hafıza ayrılır.
- 50 tur, konu kapatma/açma ve daha sonra geri dönme testleri.

**Kabul:** Eski söz/teklif doğru kaynakla çağrılır; yanlış miktar veya ortak geçmiş uydurulmaz.

### S11 — Model turnuvası ve tavan kararı

- Güncel 8B, alternatif 8–12B genel/Türkçe adaylar ve araştırma amaçlı 14B kör karşılaştırılır.
- Kalite, bellek, gecikme ve paket boyutu birlikte ölçülür.

**Kabul:** Güncel 8B ancak toplam Pareto sınırında kalırsa dağıtım modeli olur. “Zaten indirdik” gerekçesi kalite kanıtı değildir.

### S12 — Canlı oyuncu döngüsü

```text
test → JSONL analiz → hata etiketi → corpus → düzeltme
→ sanal batarya → kör insan testi → yeni canlı test
```

Her döngü sürümlenir. Genel kalite artarken belirli eski konuşmalar bozulursa sürüm kabul edilmez.

## 11. İlk uygulanacak sıra

1. Önce S0–S2: test verisi, DialogueMove ve söylem durumu.
2. Sonra S4–S6: gerçek 8B koşucu ve sert doğrulama.
3. Ardından S7: 14B saldırgan oyuncu.
4. 14B eleştirmen yalnız insan kalibrasyonundan sonra açılır.
5. Model eğitimi veya model değişimi, ilk gerçek 8B bataryasının hata dağılımı görülmeden yapılmaz.

## 12. Başarı tanımı

Başarı “AI her cümleyi anlıyor” değildir. Başarı:

- bilmediğinde neyi bilmediğini doğru söylemesi,
- bildiği şeyi kendi inancı ve çıkarı içinden yorumlaması,
- oyuncunun son sözünü ve önceki konuşmayı gerçekten takip etmesi,
- karakterden karaktere karar ve ses farkı üretmesi,
- yalanı otomatik gerçek kabul etmemesi,
- gerektiğinde basit, gerektiğinde karmaşık konuşması,
- söz, sır, teklif ve çatışmayı yıllar sonra kaynaklı biçimde hatırlaması,
- bütün bunları dünya motorunun gerçeğini ve oyuncunun iradesini çiğnemeden yapmasıdır.

Bu hedef milyonlarca cümle yazılarak değil; az sayıda genel konuşma eylemi, gerçek domain adaptörleri, yapılandırılmış hafıza, sınırlı LLM rolü ve sürekli insan-kalibreli sanal test döngüsüyle ulaşılabilir.
