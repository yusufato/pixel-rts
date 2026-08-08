// Rol seçimi yalnız kota değiştirmez. Komutan dışındaki oynanabilir
// yollar kendi mesleki yetkisi, riski ve diliyle 12 ayrı ikilem görür.
const CHAR_ROLE_SCENARIO_TAGS = Object.freeze(['sert', 'kurnaz', 'halkci', 'uzman']);
const CHAR_ROLE_SCENARIO_FX = Object.freeze({
    harp: Object.freeze({ sert: { hawk: 7, auth: 2 }, kurnaz: { auth: 3, pop: -2 }, halkci: { pop: 6, hawk: -2 }, uzman: { hawk: -3, pop: -3 } }),
    idare: Object.freeze({ sert: { auth: 6 }, kurnaz: { auth: 3, pop: -2 }, halkci: { pop: 6, auth: -2 }, uzman: { pop: -3, auth: -2 } }),
    siyaset: Object.freeze({ sert: { auth: 7 }, kurnaz: { auth: 4, pop: -3 }, halkci: { pop: 7, auth: -4 }, uzman: { pop: -2, auth: -2 } })
});
function charRoleScenario(theme, question, choices, seed) {
    return {
        q: question,
        o: CHAR_ROLE_SCENARIO_TAGS.map((tag, index) => ({
            t: choices[index], tag,
            fx: Object.assign({}, CHAR_ROLE_SCENARIO_FX[theme][tag]),
            seed: seed && index === 3 ? seed : null
        }))
    };
}
const CRS = charRoleScenario;
const CHAR_ROLE_SCENARIOS = Object.freeze({
    COMPANY_OWNER: Object.freeze({
        harp: Object.freeze([
            CRS('harp', 'Savaş riski ana çelik tedarikçinin limanını kapattı. Fabrikan on gün içinde duracak. İlk kararın?', [
                'Mevcut stoku zorla kamulaştıracak siyasi baskıyı kur.', 'Rakibin gizli stokunu aracılarla satın al.', 'İşçi ve müşterilere durumu açıkla; ortak kısıntı planı yap.', 'Alternatif alaşım ve üç tedarik rotasını maliyetle karşılaştır.'
            ]),
            CRS('harp', 'Savunma ihalesi üretim hattını büyütebilir; fakat sivil siparişlerin aylarca gecikecek. Ne yaparsın?', [
                'Savunma siparişini al; stratejik dönemde öncelik devlettir.', 'Alt yüklenici zinciriyle iki pazara da yetişmiş gibi görün.', 'Sivil müşterilerin kaybını telafi edecek kamu garantisi iste.', 'Kapasite ve teslim riskini bağımsız denetip kısmi teklif ver.'
            ])
        ]),
        idare: Object.freeze([
            CRS('idare', 'İngiltere’den gelen çelik siparişinin başka depolara gideceğini biliyorsun. Kendi tesisine yönlendirmek için ne teklif edersin?', [
                'Liman ve ruhsat baskısıyla sevkiyatı kendi depoma çevirt.', 'Karar vericiye gizli ortaklık payı sun.', 'Daha düşük fiyat ve yerel istihdam garantisini açıkça teklif et.', 'Depo kapasitesi, sigorta ve teslim takvimini bağlayıcı sözleşmeye koy.'
            ]),
            CRS('idare', 'Banka krediyi yenilemek için yönetim kurulunda koltuk istiyor. Nakit olmadan maaşlar ödenemeyecek.', [
                'Bankaya sınırlı yetkili koltuğu ver, üretimi koru.', 'Borcu başka şirket hesabına taşıyıp zaman kazan.', 'Çalışanlara hisse aç; maaş ve sahipliği birlikte yeniden kur.', 'Nakit akışını açık denetimle yeniden yapılandır.'
            ]),
            CRS('idare', 'Otomasyon yatırımı verimi artıracak ama iki bin kişinin işini bitirecek. Kararın?', [
                'Hızla uygula; ayakta kalamayan fabrika kimseyi istihdam etmez.', 'İşten çıkarmayı taşerona ve zamana yay.', 'Kârdan vazgeçip işçileri yeni hatlara eğit.', 'Pilot hat kur; verim ve yeni iş sayısını ölçmeden yayma.'
            ]),
            CRS('idare', 'Ucuz tedarikçinin parçalarında kalite sorunu var; pahallı tedarikçi teslim tarihini kurtarıyor.', [
                'Ucuzu disiplin cezasıyla standarda zorla.', 'Kusuru kabul sınırı içinde saklayıp iki kaynağı karıştır.', 'Teslimi geciktir; kullanıcı güvenliği kârdan önce gelir.', 'Numune deneyiyle parti bazında kabul sistemi kur.'
            ]),
            CRS('idare', 'Fabrikada ağır bir kaza oldu. Üretim durursa büyük sözleşme yanacak.', [
                'Alanı ayır, vardiyayı başka hatta sürdür.', 'Kazayı bakım arızası diye daralt; incelemeyi içeride tut.', 'Tesisi kapat, ailelere ve çalışanlara önce hesap ver.', 'Bağımsız kök neden incelemesi bitmeden yeniden başlatma.'
            ]),
            CRS('idare', 'Yıl sonu kârını temettü, yeni tesis ve borç azaltma arasında böleceksin.', [
                'Yeni tesise yığ; büyümeyen şirket geriler.', 'Temettü sözü verip ödemeyi sonraki döneme taşı.', 'Çalışan primi ve yerel yatırımı öne al.', 'Borç eşiği ve yatırım getirisine bağlı otomatik kural koy.'
            ], 'sermayeyi kurala bağlayan')
        ]),
        siyaset: Object.freeze([
            CRS('siyaset', 'Kamu ihalesindeki en güçlü rakibin iktidar partisinin bağışçısı. Nasıl yarışırsın?', [
                'Kendi siyasi ağımı kurup aynı güçle karşılık ver.', 'Rakibin uygunsuzluk dosyasını kapalı kanaldan servis et.', 'İhaleyi ve puanlamayı kamuya açtıracak kampanya başlat.', 'Teknik teklifi bağımsız denetim ve performans teminatıyla güçlendir.'
            ]),
            CRS('siyaset', 'Bakan senden fiyatı sabit tutmanı, karşılığında yeni ruhsat vermeyi teklif ediyor.', [
                'Anlaşmayı kabul et ve piyasaya disiplin uygula.', 'Sözlü kabul ver; maliyeti yan kalemlerde geri al.', 'Koşulları ve tüketici faydasını açık protokole dök.', 'Fiyat formülünü maliyet endeksine bağlayıp ruhsatı ayır.'
            ]),
            CRS('siyaset', 'Gazete, şirketinin siyasetçilerle gizli yemeklerini manşete taşıdı.', [
                'Gazeteye hukuk ve reklam gücüyle baskı kur.', 'Başka bir skandalı gündeme taşı.', 'Görüşmeleri kabul et, kimle neden konuştuğunu açıkla.', 'Temas ve lobi sicilini geriye dönük yayınla.'
            ]),
            CRS('siyaset', 'Kurucu ortak emekli oluyor; aile, profesyonel yönetim ve devlet fonu şirketin geleceği için çekişiyor.', [
                'Kontrolü ailede tut; dağınık otorite şirketi bitirir.', 'Tarafları birbirine karşı kullanıp fiilî kontrolü koru.', 'Çalışan ve küçük ortaklara da temsil ver.', 'Yetkiyi performans ve bağımsız kurul kurallarına bağla.'
            ], 'halefiyet mimarı')
        ])
    }),
    EXECUTIVE: Object.freeze({
        harp: Object.freeze([
            CRS('harp', 'Sınırda kimliği belirsiz bir saldırı oldu; ordu misilleme, diplomatlar kanıt bekliyor.', ['Sınırlı misillemeye hemen izin ver.', 'Faili bildiğini ima edip kapalı pazarlık aç.', 'Yaralıları ve kanıtı kamuoyuna aç.', 'Bağımsız doğrulama gelene kadar savunmayı güçlendir.']),
            CRS('harp', 'Müttefik, kendi savaşı için hava sahanı istiyor; reddetmek ittifakı sarsacak.', ['Hava sahasını aç; ittifak yükü paylaşılır.', 'Kamuya reddet, gizli lojistik geçiş ver.', 'Meclis oylaması ve açık sınırlar iste.', 'Süre, hedef ve angajman kuralı olmadan izin verme.']),
            CRS('harp', 'Savunma bütçesi deprem güçlendirme fonuyla aynı kaynağı istiyor.', ['Savunmayı koru; dış tehdit ertelenemez.', 'Savunma kalemini başka kurumlara dağıt.', 'Deprem fonunu öne al ve halka gerekçeyi anlat.', 'Ortak kullanımlı lojistik yatırıma dönüştür.'])
        ]),
        idare: Object.freeze([
            CRS('idare', 'Enflasyon düşüyor ama işsizlik artıyor; merkez bankası ve kabine ayrıştı.', ['Bankayı büyüme hedefine zorla.', 'Faizi kabul edip kamu bankalarından gizli kredi aç.', 'İşsizlik desteğini ve bedelini açıkla.', 'İki hedefli, süreli ve ölçülebilir program kur.']),
            CRS('idare', 'Büyük selde yerel yönetim merkezden emir bekliyor; saatler kritik.', ['Olağanüstü yetkiyi merkeze topla.', 'Resmî emirden önce gayriresmî kaynak aktar.', 'Yerel yönetime açık yetki ve fon ver.', 'Yetki eşiği olan afet protokolünü işlet.']),
            CRS('idare', 'Büyük altyapı ihalesinde yerli firma pahalı, yabancı firma siyasi riskli.', ['Yerli firmayı seç; stratejik kapasite fiyatı aşar.', 'Teklifi konsorsiyum görüntüsüyle birleştir.', 'Yerel istihdam şartıyla açık yarış yap.', 'Teknoloji devri ve toplam ömür maliyetini puanla.']),
            CRS('idare', 'Reformun rakamları iyi, fakat vatandaş hizmette iyileşme hissetmiyor.', ['Bakanlıkları sonuç kotasına bağla.', 'Başarı hikâyelerini yoğun iletişimle öne çıkar.', 'Sahaya inip şikâyetleri doğrudan dinle.', 'Hizmet süresini bağımsız ölç ve veriyi aç.'])
        ]),
        siyaset: Object.freeze([
            CRS('siyaset', 'Koalisyon ortağı bütçeyi geçirmek için kritik bakanlığı istiyor.', ['Bakanlığı ver, yürütme ayakta kalsın.', 'Yetkiyi verip kadro ve bütçeyi kendinde tut.', 'Koşulları koalisyon protokolüyle halka açıkla.', 'Bakanlık yerine ölçülebilir politika tavizi sun.']),
            CRS('siyaset', 'Barışçı protesto geceleri şiddete dönüşüyor.', ['Meydanı boşalt ve sokağa çıkma sınırı koy.', 'Grup liderleriyle kapalı anlaşıp marjinalleri ayır.', 'Barışçı grupla açık diyalog kur.', 'Polis yetkisi, gözlemci ve saat sınırını protokole bağla.']),
            CRS('siyaset', 'Yakın danışmanın ihale dosyasına müdahale ettiği iddia ediliyor.', ['Hemen görevden al; yönetim zafiyet göstermez.', 'Sessiz istifa ve dosyanın kapanmasını ayarla.', 'Danışmanı açığa alıp soruları cevapla.', 'Bağımsız soruşturma ve delil koruma emri ver.']),
            CRS('siyaset', 'Seçime altı ay kala ekonomik program acı veriyor ama uzun vadede gerekli.', ['Programı sürdür; liderlik popülariteye bakmaz.', 'Acıyı seçim sonrasına erteleyecek geçici fon kur.', 'Bedeli ve takvimi halka açıkça anlat.', 'Bağımsız hedefler ve otomatik koruma eşikleri koy.']),
            CRS('siyaset', 'Muhalefet lideri ulusal kriz için ortak kurul teklif ediyor; partin bunu zayıflık sayıyor.', ['Teklifi reddet; sorumluluk iktidarındır.', 'Lideri içeri alıp siyasi maliyeti ona da yükle.', 'Ortak kurulu açık yetkiyle kabul et.', 'Uzman kurulunu partilerden bağımsız tasarla.'], 'krizde ortak akıl')
        ])
    }),
    AGENT: Object.freeze({
        harp: Object.freeze([
            CRS('harp', 'Saha ekibinin kimliği açığa çıktı; operasyon hedefi hâlâ ulaşılabilir.', ['Hedefi tamamla, sonra tahliye et.', 'Ekibi sahte bir operasyona yönlendirip izi kaybettir.', 'Ekibi hemen çıkar; insanlar hedeften önce gelir.', 'Sızma kaynağını doğrulamadan yeni emir verme.']),
            CRS('harp', 'Silahlı hücrenin yeri belli ama içeride sivil kaynak bulunuyor.', ['Baskın yap; daha büyük saldırıyı önle.', 'Kaynağı başka kimlikle dışarı çekip hücreyi izle.', 'Sivil riski açıkça komuta zincirine bildir.', 'Görüntü ve sinyal doğrulamasıyla zaman penceresi kur.'])
        ]),
        idare: Object.freeze([
            CRS('idare', 'Bütçe denetçisi kayıtsız operasyon fonunu soruyor.', ['Ulusal güvenlik yetkisiyle dosyayı kapat.', 'Fon izini başka programa taşı.', 'Yetkili kapalı komisyona gerçek hesabı ver.', 'Erişim kayıtlı, katmanlı denetim sistemi kur.']),
            CRS('idare', 'En değerli kaynağın daha fazla para istiyor; yoksa karşı tarafa geçeceğini söylüyor.', ['Öde ve itaatsizliğin sonucunu hatırlat.', 'Sahte bilgi verip sadakatini test et.', 'Riski ve ailesinin güvenliğini yeniden müzakere et.', 'Bilgilerini bağımsız kanallarla doğrulayıp değer biç.']),
            CRS('idare', 'Ordu ve polis aynı hedef hakkında çelişen veri tutuyor.', ['Tek komuta belirle ve diğerini ona bağla.', 'Her iki kuruma farklı ayrıntı verip sızıntıyı ölç.', 'Ortak masa kurup kaynak çatışmasını açıkça çöz.', 'Kaynak kalitesi ve zaman damgasıyla birleşik analiz yap.'])
        ]),
        siyaset: Object.freeze([
            CRS('siyaset', 'Bir bakanın gizli hesabını buldun; dosya hükûmeti düşürebilir.', ['Dosyayı savcıya ver ve sonucu kabul et.', 'Bakanı devlet için çalışmaya zorla.', 'Kanıtı kamu yararı ve istikrar bedeliyle birlikte açıkla.', 'Delil zincirini doğrulatıp yetkili kurula sun.']),
            CRS('siyaset', 'Kaynağın muhalefetin yabancı fon aldığını söylüyor; tek kanıt onun sözü.', ['Operasyonu başlat; gecikmek daha büyük risk.', 'Söylentiyi kontrollü sızdırıp tepkileri izle.', 'Siyasi kullanıma kapat ve kimseyi suçlama.', 'İkinci bağımsız kaynak bulmadan dosyayı açma.']),
            CRS('siyaset', 'Teşkilattan biri hukuksuz dinlemeleri basına vermek istiyor.', ['Gözaltına al; devlet sırrı tartışılmaz.', 'Onu kontrollü muhbir yapıp hangi gazeteciye gittiğini izle.', 'Güvenli ihbar kanalı ve koruma teklif et.', 'Kayıtları bağımsız hukuk incelemesine devret.']),
            CRS('siyaset', 'Müttefik servis, kendi vatandaşına karşı bilgi istiyor.', ['Stratejik ittifak için ver.', 'Eksik ama kullanışlı bilgiyle karşılık iste.', 'Talebi reddet ve ilgili kişiyi yasal kanaldan bilgilendir.', 'Yetki, amaç ve saklama süresi olmadan veri verme.']),
            CRS('siyaset', 'Seçim sonucunu etkileyebilecek yabancı dezenformasyon ağını ele geçirdin.', ['Ağı kapat ve operatörleri al.', 'Ağı tersine çevirip rakibe kontrollü bilgi besle.', 'Platformlar ve kamuoyuyla tehdidi açıkça paylaş.', 'Kanıtı arşivle, bağımsız seçim kurumuyla eşgüdüm kur.']),
            CRS('siyaset', 'Yabancı ülkede yakalanan ajanın iadesi için hükûmet resmen onu inkâr etmek istiyor.', ['İnkâr et; devlet bir kişi için eğilmez.', 'Gizli takas ayarla ve kamuya sessiz kal.', 'Ailesine ve meclis denetimine gerçeği bildir.', 'Hukuki statü, risk ve takas seçeneklerini yazılı değerlendir.']),
            CRS('siyaset', 'Yeni yönetim senden eski iktidarın bütün gizli dosyalarını istiyor.', ['Emir meşrudur; arşivi teslim et.', 'En tehlikeli dosyaları ayırıp pazarlık kozu yap.', 'Kişisel dosyaları koru, suç delillerini yetkili mercie ver.', 'Erişimi yasa, amaç ve denetim protokolüne bağla.'], 'arşivin bekçisi')
        ])
    })
});
