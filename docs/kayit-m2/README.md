# İkinci Makine Ölçüm Kayıtları

Bu klasör savaş AI kapılarının ikinci makinede, ana eğitim makinesinden ayrık
tohumlarla çalıştırılmış satır tabanlı loglarını tutar. Kayıtlar tasarım veya
başarı hükmü değildir; yorumlanmadan önce üretici sürümü ve tohum ayrıklığı
doğrulanmalıdır.

## Üreticiler

- Görev ve tohum sözleşmesi: [`GOREV-MAKINE2.md`](../battle-ai/operations/GOREV-MAKINE2.md)
- Kuyruk üreticisi: `tools/m2-kuyruk.sh`
- Birleşik özetleyici: `node tools/kapi-ozet.js --havuz`
- Kanonik özet: [`KAPI-DEFTERI.md`](../battle-ai/evidence/KAPI-DEFTERI.md)

Bu README komut çalıştırma yetkisi vermez. Komutlar kullanılmadan önce mevcut
script, dal, motor sürümü ve görev sözleşmesi ayrıca doğrulanır.

## Dosyalar

| Dosya | Rolü |
|---|---|
| `m2.log` | Ana ikinci-makine kapı kuyruğu |
| `m2-m28.log` | Ayrı M28 ölçüm kaydı |
| `m2-parti3.log` | Üçüncü ölçüm partisi |
| `m2-DUSUK-jsdom-yok.log` | Düşük profil/jsdom olmayan karşılaştırma kaydı |
| `rapor-dongusu.log` | Raporlama döngüsünün çalışma kaydı |

## Kayıt biçimi

Resmî JSON şeması yoktur. Loglar en azından çalıştırılan kapı/komut, tohum
başlangıcı, örnek sayısı, eşleştirilmiş fark, standart sapma, saptama tabanı,
çıkış kodu ve başlangıç/bitiş zamanını taşımalıdır. Bu alanlardan biri yoksa
sonuç yeniden üretilebilir kabul edilmez.

## Yeniden üretilebilirlik

Bir ölçüm yorumlanırken birlikte saklanması gerekenler:

1. Git commit ve motor sürümü;
2. araç komutu ile bütün bayraklar;
3. tohum başlangıcı ve örnek sayısı;
4. makine/işçi sayısı ve yarıda kesilme bilgisi;
5. ham log ile `kapi-ozet` çıktısı.

İkinci makine için ayrılmış tarihsel tohum havuzu `200000–299999`dur. Yeni bir
çalışma bu aralığı otomatik olarak sahiplenmez; ana makinenin güncel havuzuyla
çakışmadığı yeniden doğrulanır.

## Saklama ve gizlilik

Kesin bir silme süresi tanımlanmamıştır. Ham kayıt, sonucu kapı defterine ve
karar ledger'ına aktarılıp yeniden üretilebilirliği doğrulanana kadar korunur;
sonrasında silinmez, ayrı arşiv kararı bekler.

Oyuncu konuşması veya kişisel veri beklenmez. Yine de loglar makine adı, süreç
bilgisi veya yerel dosya yolu içerebilir; depo dışına paylaşılmadan önce gözden
geçirilmelidir.
