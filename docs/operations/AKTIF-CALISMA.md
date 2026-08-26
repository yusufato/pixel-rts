# Aktif Çalışma İmleci

Son güncelleme: 26 Ağustos 2026

## Operasyon

**25 Ağustos Atlas Operasyonu** — Hikâye modunu baştan sona incelemek; oyun
amacını ve sistemlerin gerçek çalışma mantığını kanıtla açıklamak; bugfix ve
mantık hatalarını bulmak; önerilen planları karşı testle çürütmek.

Ana kayıt: [Hikâye Modu Sistem Atlası](../story/design/HIKAYE_MODU_SISTEM_ATLASI.md)

## Şu anki konum

- Yaşam döngüsü ve hikâye savaş sonucu: ilk inceleme tamamlandı.
- Ekonomi/ticaret: ilk inceleme tamamlandı; gümrükte para yaratımı doğrulandı.
- Siyaset/devlet: ilk dikey inceleme tamamlandı; EXECUTIVE seçim sahipliği,
  başarılı darbe makam devri ve governance görünüm cache'i hataları doğrulandı.
  Bütünlük yaptırım halkasının henüz kayıt-only olduğu belgelendi.
- Şirketler/karakter bağları: ilk sahiplik ve kredi dikeyi tamamlandı; oyuncu
  payı ile sahip rolü ayrışıyor, doğrudan kredi kurul yolunu atlıyor ve feshedilmiş
  şirket yeni kredi çekebiliyor.
- Karakter yaşam döngüsü: ilk dikey tamamlandı; temel kimlik/hafıza/kariyer
  defterleri sağlam, ölü veya emekli oyuncunun PlayerAgency kaçışı doğrulandı.
- Demografi ve toplum: ilk dikey tamamlandı; fiziksel kişi korunumu sağlam,
  göçte şikâyet hafızası taşınmıyor; doğum/ölüm/yaşlanma ve savaş-kohort bağı
  henüz model değil.
- Lojistik ve altyapı: ilk dikey tamamlandı; kaynakta mod değiştiren reroute
  terminal yuvası sızdırıyor, HELD sevkiyat lease'i dolunca kapasite yeniden
  ayrılabiliyor ve transit gelir dalı kanonik koridor şemasıyla bağsız.
- Dünya/diplomasi/savaş: ilk dikey tamamlandı; düşmanlık ve barış-kuşatma
  kapıları sağlam. Emekli oyuncu harita yoluyla savaş ilanı yetkisini atlıyor;
  fetih makbuzu nüfus zincirini bir sonraki tike kadar eski egemende bırakıyor;
  kamuoyu yabancı tesis sahibini değil yeni ülkenin şirketini suçluyor.
- Teknoloji/çağ/bilgi-UI: ilk dikey tamamlandı; yüksek kademe araştırma önceliği
  yürütücüsüz kalıyor, teknoloji paneli sis altında kesin rakip bilgisini sızdırıyor,
  çağ savaş metriği sınırı olmayan çiftleri sayıyor ve ahit bozmayı almıyor.
- Konuşma/müzakere: ilk dikey tamamlandı; ticari sözleşme yaşam döngüsü sağlam,
  uzun konuşma bilgi sınırını koruyor; dokuz özel senaryo güvenli lab-only.
- Fiziksel hex/imar ve ölçekleme: kaynak envanteri kapatıldı; hedefli coğrafya,
  doğal kaynak, tarım, site, inşaat, aktivasyon, toplulaştırma, projeksiyon ve
  görsel testleri geçti.
- Takvim/konsey ve askerî üretim: ilk dikey tamamlandı. Eski konsey önergeleri
  ayrıntılı domain defterlerini atlıyor; effect exception'ında ödeme kalıp sahte
  başarı dönüyor. Askerî üretim stratejik sayaçlarla ayrıntılı fiziksel ekonomi
  arasında açık uyumluluk katmanı taşıyor.
- İlk sistem dikeyleri ve toplam bugfix planı tamamlandı.
- 41 rapor bulgusu 10 kişi-gün kapasiteyle 20 kümeye ayrıldı; kullanıcı Now
  sırasını onayladı. Electron hikâye yaşam döngüsü ayrıntılı planı Draft olarak
  hazırlandı. TG-06'nın bu Electron kümesine yanlış bağlandığı karşı denetimde
  yakalandı ve karakter aktivasyon probu olarak Next'e ayrıldı.
- Kanonik [Oyun Mantığı, Amaç ve İşleyiş](../story/design/OYUN_MANTIGI_AMAC_VE_ISLEYIS.md)
  belgesi oluşturuldu.
- Yaşayan [Kaynak ve Kapsam Matrisi](../story/design/HIKAYE_MODU_KAPSAM_MATRISI.md)
  sistem→kaynak→test→risk→sonraki hedef rotası olarak oluşturuldu.

## Geçerli kararlar

- Toplu arşivleme durduruldu; güncele yakın dosyalar yerinde kalır.
- M2/gece/arşiv-silme Makine 2 kayıtları ve araçları korunur.
- `index.html` Electron'un aktif kaynağı ve paketleme girdisidir.
- `qa-runtime` içinde 10 Ağustos 2026 öncesi dosyalar silindi; daha yeni çıktılar
  aktif yola geri alındı.
- Henüz oyun kaynak koduna bugfix uygulanmıyor; önce sistem sözleşmesi ve ürün
  kararları netleştiriliyor.
- Tek geliştirici için 10 kişi-günlük döngü onaylandı: 0,5 gün belge düzeni,
  3,5 gün Electron yaşam döngüsü, 3 gün konsey atomikliği, 1 gün reroute ve
  2 gün tampon. Ayrıntılı Draft planlar ayrıca onaylanmadan uygulanmaz.

## Sıradaki tek hedef

`plans/electron-story-lifecycle-acceptance.md` Draft planını kullanıcıya sun ve
ayrı uygulama onayı iste. Onaylanırsa 0,5 günlük kırmızı temel/geçersiz hedef
dilimiyle başla; ardından iki süreçli saldırı zaferi kabulünü kur. Plan,
`bugfix-story-invalid-battle-target-guard` işini kendi ilk dilimine katmıştır.
Konsey planı bu kabul temeli Landed olduktan sonra sıradadır.

## Oturum kapatma protokolü

1. Bu dosyada “şu anki konum”, “geçerli kararlar” ve “sıradaki tek hedef”i güncelle.
2. Sistem ayrıntısını Atlas'a, test açığını `TEST_GAPS.md`ye yaz.
3. Doğrulanan veya çürütülen hipotezi `LEDGER.md`ye ekle.
4. Yalnız son kök neden incelemesini `RCA.md`de tut.
5. `docs/README.md` bağlantılarını yeni kanonik belge eklendiyse güncelle.
