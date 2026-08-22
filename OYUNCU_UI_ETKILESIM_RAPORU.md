# Oyuncu UI etkileşim raporu

Son ölçüm: 22 Ağustos 2026  
Koşum: Electron --maptest  
Kanıt klasörü: qa-runtime/ui-player-after-final

## Sonuç

- Test edilen mekanik akış: **9**
- Başarılı akış: **9**
- Test kapsamı içi başarı: **%100**
- Görünür kontrol: **33**
- Etkin kontrol: **32**
- Görünür düğme: **26**
- İnşaat dosyasında bağlamsal eylem: **1**

Bu yüzde bütün oyunun tamamlandığı anlamına gelmez. Yalnız aşağıdaki dokuz gerçek
oyuncu akışının baştan sona çalıştığını gösterir.

1. Şehir lojistik siparişi oluşturma ve sevk etme
2. Taşıtın rota üzerinde akıcı sunumu
3. Zamanı başlatma ve durdurma
4. Orman altıgeninde ormancılık etüdü
5. Kıyı altıgeni dosyası
6. Maden yatağı dosyası
7. İdarî bölge dışındaki altıgen dosyası
8. Canlı inşaat proje dosyası
9. Harita hover ve seçim kararlılığı

## Taşıt performansı

- 80 karede 70 farklı sunum konumu üretildi.
- Kanonik hedef 8 kez değişirken ara konumlar enterpole edildi; ışınlanma yerine
  kareler arasında akış sağlandı.
- Taşıt katmanı p95 çizim süresi: **0,3 ms**.
- Test boyunca statik dünya yeniden çizim farkı: **1**. Bu ilk durum anahtarı
  kurulurken oluştu; her taşıt adımında dünya çizilmedi.
- Taşıt anlık görüntüsü sabit simülasyon tiki başına önbelleğe alındı.

## Altıgen dosyası

Her fiziksel altıgen artık seçilebilir. Siyasî bölgeye atanmamış hücreler
BAĞIMSIZ ALTIGEN olarak açılır ve yanlış bir mülkiyet uydurmak yerine en yakın
şehir dosyasına geçiş verir. Atanmış açık arazi; örtü, doğal kaynak, tarım ve
ormancılık uygunluğu, yatak, işletmeci ve arazi yönetimi kayıtlarını gösterir.

## İnşaat dosyası

İnşaat görseli seçildiğinde aşağıdaki canlı kayıtlar açılır:

- Proje türü ve kanonik proje kimliği
- Durum, yüzde ilerleme, kalan dünya günü ve tahmini bitiş tarihi
- Başlama tarihi ve toplam plan süresi
- Yatırımcı/yüklenici şirket ve başvuru sahibi karakter
- Toplam maliyet, yapım bütçesi ve arsa/kullanım hakkı
- Ayrılmış işgücü ve malzeme kalemleri
- Yetkili kurum/izin kaydı, çevresel maliyet ve planlanan kapasite

## Açık performans borcu

Taşıt donması giderildi; ancak kamera veya zoom statik dünyayı gerçekten yeniden
çizdiğinde maliyet hâlâ 60 FPS bütçesini az farkla aşıyor:

- Uzak görünüm p95: **17,0 ms**
- Orta görünüm p95: **19,0 ms**
- Yakın görünüm p95: **18,4 ms**
- Kamera etkileşimi p95: **19,1 ms**

Bu borç taşıt hareketini artık etkilemiyor. Sonraki harita optimizasyon turunda
hexSurface ve hexAndNetworks katmanları ayrı hedeflenmelidir.
