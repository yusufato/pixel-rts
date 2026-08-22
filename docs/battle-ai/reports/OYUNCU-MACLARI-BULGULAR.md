# OYUNCU MAÇLARI — DERİN İNCELEME (2026-08-18, 6 gerçek maç)

Kullanıcının oynadığı maçların ham kayıtları. Tezgâh ölçümlerinin göremediği şey burada:
**insan gerçekten nasıl oynuyor ve AI nerede kırılıyor.**

⚠ Bu belgedeki her satır ölçümdür. Çürüyen iddialar SİLİNMEDİ, geri çekme olarak duruyor —
çünkü aynı yanlışa ikinci kez düşmenin maliyeti, kaydın uzunluğundan yüksek.

---

## Kontrollü deney (üç maç, AYNI tohum 375319092)

Aynı harita, aynı AI ordusu (25 birim, 8'i tanksavar). Tek değişen oyuncunun ordusu:

| oyuncunun ordusu | sonuç |
|---|---|
| dolaylı ateş **YOK** | **AI KAZANDI** (360sn, süre doldu, 9-3) |
| **TOPÇU×3** | AI 214sn'de imha |
| **HAVAN×3 + ÇNRA** | AI 246sn'de imha |

Sonuç oyuncunun dolaylı ateşiyle birlikte değişiyor.

---

## ⭐ SAĞLAM 1 — Aramanın emirlerinin yarısı angajmanı değiştirmiyor

Emirden 5 saniye SONRA gerçekte ne olduğu (statik yaklaşıklık yok, örneklerden okundu):

| maç | emirlerin %'i hedefsiz→hedefsiz | hedefsiz başlayanların hâlâ hedefsiz oranı |
|---|---:|---:|
| 1 (AI kazandı) | %52 | %90 |
| 2 | %45 | %96 |
| 3 | %61 | %93 |
| 4 | %68 | **%98** |

Arama **kanıtlanmış tek kaldıraç** (+833, t 4,34) ve çıktısının yarısı hedefi olmayan
birime gidip onu hedefsiz bırakıyor.

⚠ Sonuç çıkarılamayan: "emir alan birim vs almayan" (%6,2 vs %7,4). Arama en değerli
birimleri seçtiği için **seçim yanlılığı** var; kıyas geçersiz.

---

## ⭐ SAĞLAM 2 — AI düşman topçusunu hedef almıyor

TOPÇU×3 maçı: oyuncunun topçusu 122 atış yaptı, zamanın %50'sinde AI'nın **menzilindeydi**.
**AI onlara 214 saniyede TOPLAM 1 ATIŞ etti (%0).** Atışlarının %68'i ZIRHLI'ya gitti.
HAVAN×3 maçı: 8 atış (%6); havanlar zamanın %83-97'sinde menzildeydi ve sona kadar yaşadı.

**Kök neden** (`js/BattleTargeting.js`): `if (hasArea && tIndirect && _cbBrain)` — karşı-batarya
önceliği yalnız ateş eden grubun KENDİSİNDE dolaylı ateş varsa uygulanıyor. AI'nın 25
biriminin 2'si dolaylı → grupların çoğu düşman topçusunu hiç öncelemiyor.

→ `BATTLE_KARSI_BATARYA_HERKES` (varsayılan kapalı). Davranış değişikliği olduğu için
saptama tabanı düşük olmalı (ölçüldü: kompozisyon A/B std 3781, davranış A/B ~2600).

---

## ⭐ SAĞLAM 3 — Fırsat oranı (yaşam süresine NORMALİZE)

| maç | fırsat/canlı-örnek AI/oyuncu | atış/canlı-örnek AI/oyuncu |
|---|---|---|
| 1 | 0,227 / 0,308 | 0,028 / 0,088 |
| 2 | 0,125 / 0,356 | 0,041 / 0,074 |
| 3 | 0,132 / 0,251 | 0,027 / 0,064 |
| 4 | 0,160 / 0,321 | 0,033 / 0,088 |

Oyuncu birim-örneği başına **~2 kat sık** hedef buluyor, **~2,4 kat** atış yapıyor.
Ham sayı yaşam süresine bağlı olduğu için normalize edildi — normalize edince bulgu AYAKTA.

---

## ⭐ SAĞLAM 4 — Öngörü sapmasının büyüklüğü (worker sorusu KAPANDI)

| maç | tur | ortalama sapma | en kötü | >100px |
|---|---:|---:|---:|---:|
| 1 | 71 | 32px | 118px | %10,0 |
| 2 | 112 | 42px | 150px | %13,6 |
| 3 | 150 | 39px | 150px | %12,9 |
| 4 | 178 | 40px | 186px | %13,0 |

Birim görüşü 600-900px, arama halkası 600px → sapma ölçeğin yanında çok küçük.
**Öngörülü worker kalıyor.** (AI-vs-AI'da 0px ölçüldü, ölçüm doğrulandı.)

Worker sağlığı 4/4: hata 0 · bekçi düşürme 0 · ısınma atlama 0 · boş tur 0 · hizasız 0 ·
TAM GÜÇ doğrulandı (ufuk 100 / derin 2 / birim 20).

---

## ✗ GERİ ÇEKMELER (üçü de ölçümle çürüdü)

**1. "Öngörü insan maçlarında tutmuyor" (52/54 hash sapması).** `battleStateHash` TAM
EŞİTLİK arar; insan oynarken tek birim 0,01px kaysa tutmaz. İkili bayrağı büyüklük ölçüsü
sandım. Gerçek sapma ~38px.

**2. "Oyuncunun topçusu AI'nın menzili dışından vuruyor."** Havanlar zamanın %83-97'sinde
AI'nın menzilindeydi. Menzil sorunu değil, **hedef seçimi** sorunu.

**3. "Lojistik AI'yı bitiriyor."** İkmal ölüm anındaki kuvvet oranı 0,83 / 1,13 / 0,72 —
üçte ikisinde AI zaten geriideydi. İkmal ölümü çoğunlukla **sonuç**, sebep değil.
Maç kapısı da ispatlamamıştı (+364, t 1,35).

**4. "AI ordusunun %28-58'i hiç ateş etmiyor."** Şişirilmiş. İki bağımsız ölçüyle
(combatEvents + örnek hedef-kilidi) çapraz doğrulanınca gerçek sayı **maç başına 2-4 birim**
(30sn+ yaşayıp hiç angaje olmayan). Oyuncuda 0-2, çoğu keşif (silahı 225px — normal).
İlk rakam kısa yaşayanları ve kilitleyip isabet ettiremeyenleri sayıyordu.

---

## İkinci tur: "boşta duran birim" tek tek adlandırıldı (2026-08-19)

`tools/atmayan-birim.js` — 4 maçın her AI birimi için "hiç isabet ettirdi mi, ettirmediyse
neden" sorusunu ham kayıttan yanıtlar. Silahsız birimler (radar/ikmal/sağlık/EW/karargâh)
ve uçak gelmemiş hava savunması rapordan **hariç**; ikisi de daha önce yapılmış haksız
suçlamalar.

Dört maçta sayılabilir 115 birimin **49'u** hiç isabet ettirmedi. Teşhis dağılımı:

| neden | birim | ne demek |
|---|---|---|
| menziline düşman hiç girmedi | **17** | konumlandırma / menzil uyumsuzluğu |
| kamikaze, hedefe varamadan öldü | **22** | aşağıda ayrı incelendi |
| bastırılmış | 5 | ateş altında kalmış |
| hava savunması, uçak gelmedi | 4 | **kusur değil** |
| menzilde ama hedef seçmemiş | 1 | hedefleme |

**En büyük tek sınıf piyade.** Menzili 300px, ama en yakın düşmana ortalama uzaklığı
1031-1397px. Yani düşman hiç 300px'e girmiyor ve piyade maç boyunca bekliyor. Tanksavar
(525px) da aynı durumda. Bu, birinci turdaki menzil-uyumsuzluğu bulgusunun birim adıyla
söylenmiş hali ve `_menzileGir` kuralının (`BATTLE_MENZILE_GIR`) hedeflediği şeyin ta
kendisi — maç kapısı M1 bunu ölçüyor.

### İki yanlış teşhis, uygulanmadan geri çekildi

**"16 birim navigasyon tıkanıklığından ateş edemedi."** YANLIŞ. `navBlocked` telemetride
"birimden hedefine DÜZ ÇİZGİ arazi tarafından kapalı" demek — birim engelin etrafından
yürüyor olabilir. Gerçek takılma ölçüsü (uzak hedefi varken ardışık örneklerde 1,5px'ten
az kıpırdama) eklendiğinde bu kova **tamamen boşaldı**: tek bir birim bile takılı değildi.

**"MANPADS menzilinde düşman varken hedef seçmiyor."** YANLIŞ. `menzilimdeDusman` alanı
kara düşmanları da sayıyor; MANPADS/SAM karaya ateş edemez. Yalnız hava düşmanına göre
yeniden hesaplandığında bu birimler **doğru davranıyor** çıktı.

## Kamikaze dronları: %19 isabet, mekanizması açıklanamadı

32 kamikaze dronun yalnız **6'sı** (%19) isabet ettirdi; ortalama ömür 6,2sn. İki maçta
8 dronun **tamamı** sıfır hasarla düştü (hepsini SAM vurdu). Toplam ürün 2025 hasar.

Bütçe kaybı **değil**: kamikaze 90₺ ama satın alınmıyor, dron operatörünün yükü
(`payload count:2, reloadMs:25000`) — yani yeniden doluyor. Kaybedilen bütçe değil, 25
saniyelik dolum döngüsü.

Doktrin **açık**: `updateOperatorAI` SEAD önceliği dahil çalışıyor (`battleDelta` intel4'te
varsayılan açık, pro gerekmiyor). Yani %19, doktrin devredeyken alınmış rakam.

**Üç ölçüm, iki çürütülmüş hipotez, bir sağlam olgu:**

*Olgu*: 32 dronun **20'si havada düşürüldü** (%63) ve düşme noktaları erken değil —
gidecekleri yolun ortalama **%72'sini** katetmişler (medyan %66; ilk üçte birde düşen
**sıfır**, son üçte birde 11). Yani sorun fırlatma yeri ya da rota değil: dron hedefin
etrafındaki kısa menzilli AA balonuna giriyor ve orada düşüyor.

*Çürütülen 1 — "şemsiye altında doğuyor"*: doğduğunda AA şemsiyesi altında olanlar %20,
dışında olanlar %19 → **fark yok**.

*Çürütülen 2 — "teker teker gidiyor, doygunluk yok"*: dalga boyu 1 olan dronlar %36,
dalga boyu 2 olanlar %0, 3+ olanlar %18 isabet ettirdi → **düzenli ilişki yok**, hatta
tekler en iyisi. (n = 11/10/11; gürültü baskın.)

**Sonuç: mekanizma bulunamadı ve bu veriyle (n=32) bulunamaz.** İki hipotez ölçülüp
elendi, kod değiştirilmedi, maç kapısı harcanmadı. Konu bilerek açık bırakılıyor —
yeniden açılacaksa daha çok maç gerekir, tahmin değil.

---

## Açık kalan

Fırsat oranındaki 2 katlık farkın kaynağı **tam açıklanamadı**. Boşta birimler (2-4) bunun
bir kısmını açıklıyor ama hepsini değil. Angajman yüzdeleri (canlı birimlerin %25-36'sı
menzilde) iki tarafta benzer — yani fark, hangi birimlerin ne kadar süre yaşadığı ve
nerede durduğuyla ilgili olabilir. Bir sonraki incelemenin konusu.
