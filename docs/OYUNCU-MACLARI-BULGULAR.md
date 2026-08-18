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

## Açık kalan

Fırsat oranındaki 2 katlık farkın kaynağı **tam açıklanamadı**. Boşta birimler (2-4) bunun
bir kısmını açıklıyor ama hepsini değil. Angajman yüzdeleri (canlı birimlerin %25-36'sı
menzilde) iki tarafta benzer — yani fark, hangi birimlerin ne kadar süre yaşadığı ve
nerede durduğuyla ilgili olabilir. Bir sonraki incelemenin konusu.
