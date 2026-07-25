// ═══════════════════════════════════════════════════════════════════════════
//  MapData.v2.js — 10 SAVAŞ ARENASI, GERÇEKÇİ ARAZİ VERİSİ
//  Tasarım kaynağı: "Savaş Arenaları - Gerçekçi Arazi.dc.html" (Omelette tasarımı)
//  Dünya: 3400×2300 (WORLD_W/WORLD_H). Tüm koordinatlar dünya-uzayı px.
//  sym:1 → kuzey-güney ayna (mir() ile üretilmiş) · sym:0 → kasıtlı asimetrik.
//
//  Tip eşlemesi (globals.js TERRAIN genişletmesi):
//    ridges  → MOUNTAIN  (elips: rx, ry, rot)
//    forests → FOREST    (r + edge 0.62: çekirdek sık, kenar açık koru)
//    marshes → MARSH(5) · rocks → ROCK(6) · villages → URBAN(7) · fields → FIELD(8)
//    river/creeks → WATER(4) + bridges/fords geçiş istisnası · roads/rails → ROAD(9)
//
//  applyMap(id) bu listeden okur; terrainFeatures'a IN-PLACE kaba daireler türetilir
//  (MapImage.js deseni) → AI / LOS / örtü kodu DEĞİŞMEZ.
// ═══════════════════════════════════════════════════════════════════════════
const WORLD_W_V2 = 3400, WORLD_H_V2 = 2300;

// Kuzey yarıyı yaz, aynala: adil 1v1 garantisi veri seviyesinde.
const mir = a => a.concat(a.map(r => { const c = r.slice(); c[1] = WORLD_H_V2 - c[1]; return c; }));

// Kontrol noktaları tüm arenalarda sabit (orta hat): A / B / C
const CONTROL_POINTS_V2 = [[880, 1150], [1700, 1150], [2520, 1150]];

const ARENAS_V2 = [
      { name: 'Tuna Dirseği', biome: 'ova', sym: 1, tag: 'nehir geçidi',
        brief: 'Orta hattı boydan boya kesen dirsekli nehir; iki taş köprü ve bir sığ geçit dışında geçiş yok. Köprüyü tutan tarafı topçu ile besleyip karşı kıyıyı kilitlemek asıl mesele.',
        notes: ['Köprü ağızları doğal tıkaç: tanksavar + siperli piyade oraya oturur.', 'Sığ geçit (1700) yavaşlatır ama zırhlı geçebilir — kanat baskını burada.', 'Kıyı ormanları köprü başına gizli yaklaşma sağlar.'],
        river: [[-140, 990], [560, 1060], [1150, 1190], [1700, 1120], [2280, 1235], [2900, 1085], [3540, 1160]],
        bridges: [[880, 1122, 8, 130, 34], [2520, 1150, -12, 130, 34]],
        fords: [[1700, 1120, 200, -4]],
        ridges: mir([[420, 640, 210, 150, -20], [2980, 660, 215, 150, 16]]),
        forests: mir([[1250, 800, 215], [2160, 820, 215], [300, 1620, 180]]),
        fields: mir([[1180, 470, 560, 300, -7], [2280, 500, 600, 320, 6]]),
        villages: [[880, 880, 210, 150, 3], [2520, 1420, 200, 145, 9]],
        roads: [[[880, -60], [880, 620], [880, 1122], [880, 1680], [880, 2360]], [[2520, -60], [2520, 1150], [2520, 2360]], [[-80, 720], [900, 660], [1900, 730], [3480, 690]], [[-80, 1580], [1000, 1620], [2400, 1560], [3480, 1610]]],
        rails: [], marshes: mir([[1580, 1520, 260, 150, 12]]), rocks: [], creeks: [] },

      { name: 'Kesikköprü Bataklığı', biome: 'batak', sym: 1, tag: 'geçit tıkacı',
        brief: 'Orta kuşak kamışlı bataklık; sadece üç dolgu geçit (menfez) kuru zemin sunar. Bataklıkta hız yarıya iner, zırhlı saplanır — piyade ve istihkamın günü.',
        notes: ['Üç dolgu geçit üç kontrol noktasına birebir denk gelir.', 'Bataklıkta tank hızı %50, siper kazılamaz.', 'Yıkık köprü kalıntısı orta geçitte doğal siper verir.'],
        marshes: [[880, 1150, 620, 400, 6], [1700, 1150, 700, 430, -4], [2520, 1150, 620, 400, 8], [1290, 1150, 380, 300, 0], [2110, 1150, 380, 300, 0]],
        river: [[-140, 1330], [700, 1250], [1700, 1300], [2700, 1230], [3540, 1290]],
        bridges: [[880, 1268, -6, 120, 30], [1700, 1298, 4, 120, 30], [2520, 1242, -6, 120, 30]],
        fords: [], ridges: mir([[520, 560, 175, 130, -14], [2900, 580, 180, 130, 12]]),
        forests: mir([[1150, 700, 230], [2250, 720, 230], [300, 1100, 190], [3100, 1120, 190]]),
        fields: mir([[1750, 420, 520, 260, 4]]),
        villages: [[1700, 1560, 230, 160, 5]],
        roads: [[[880, -60], [880, 1268], [880, 2360]], [[1700, -60], [1700, 1298], [1700, 2360]], [[2520, -60], [2520, 1242], [2520, 2360]]],
        rails: [], rocks: [], creeks: [] },

      { name: 'Elmalı Ovası', biome: 'ova', sym: 1, tag: 'açık zırhlı',
        brief: 'Çitli tarla parselleri ve iki küçük koru dışında örtüsüz verimli ova. Görüş uzun, menzil kraldır; hareket eden kütle cezalanır.',
        notes: ['Örtü yok: tanksavar ve topçu menzil üstünlüğünü doğrudan kullanır.', 'Çit hatları sadece piyadeye kısmi siper verir, tankı durdurmaz.', 'Merkez kabartı (hafif sırt) görüş üstünlüğünün tek kaynağı.'],
        ridges: [[1700, 1150, 250, 165, 0]],
        forests: mir([[600, 760, 220], [2800, 780, 220]]),
        fields: mir([[1150, 520, 620, 330, -5], [2250, 540, 640, 340, 5], [430, 1180, 460, 250, 0], [2970, 1180, 460, 250, 0], [1700, 640, 520, 240, 2]]),
        villages: [[430, 620, 180, 130, 2], [2970, 1680, 180, 130, 7]],
        roads: [[[-80, 1150], [1700, 1100], [3480, 1150]], [[880, -60], [880, 2360]], [[2520, -60], [2520, 2360]]],
        rails: [], marshes: [], rocks: [], creeks: mir([[[-80, 830], [900, 880], [1750, 820], [2600, 890], [3480, 840]]]), river: [], bridges: [], fords: [] },

      { name: 'Karataş Sırtları', biome: 'yayla', sym: 1, tag: 'sırt hattı',
        brief: 'Birbirine paralel iki uzun kaya sırtı, aralarında kuru dere yatağı. Sırtı tutan görür ve vurur; vadi tabanı ölü açı ama içinde kalan kütle topçuya yem olur.',
        notes: ['Sırt tepesi +görüş/+menzil; yokuş yukarı taarruz cezalı.', 'Kuru dere yatağı gizli sevkiyat koridoru (ölü açı).', 'Kaya çıkıntıları hattı böler: tank tırmanamaz, piyade sızar.'],
        ridges: mir([[900, 700, 330, 165, -16], [2500, 700, 330, 165, 16], [1700, 470, 260, 150, 0]]),
        rocks: mir([[1350, 900, 150, 110, 22], [2050, 900, 150, 110, -22], [520, 1000, 130, 95, 8]]),
        creeks: [[[-80, 1150], [700, 1200], [1400, 1120], [1700, 1170], [2100, 1110], [2800, 1190], [3480, 1130]]],
        forests: mir([[420, 780, 175], [2980, 800, 175], [1700, 1560, 200]]),
        fields: [], villages: [[1700, 1150, 190, 130, 4]],
        roads: [[[-80, 1250], [900, 1290], [1700, 1230], [2500, 1300], [3480, 1240]], [[880, -60], [880, 1290], [880, 2360]], [[2520, -60], [2520, 1300], [2520, 2360]]],
        rails: [], marshes: [], river: [], bridges: [], fords: [] },

      { name: 'Beştepe Geçidi', biome: 'yayla', sym: 1, tag: 'üç dar geçit',
        brief: 'Dağ duvarı haritayı ikiye böler, üç dar geçit bırakır. Demiryolu orta geçitten geçer; taşocağı doğu geçidine hâkim.',
        notes: ['Geçit ağzı = tıkaç savaşı; istihkam siperi burada maç kazanır.', 'Demiryolu dolgusu piyadeye hazır siper hattı sunar.', 'Taşocağı çukuru zırhlıya kapalı, piyadeye kale.'],
        ridges: mir([[300, 820, 260, 175, -8], [1100, 800, 300, 180, 6], [1900, 800, 300, 180, -6], [2700, 820, 260, 175, 8]]),
        rocks: mir([[2980, 1010, 175, 130, 14], [640, 1010, 160, 120, -12]]),
        forests: mir([[1700, 620, 200], [420, 1560, 190], [2980, 1580, 190]]),
        fields: mir([[1250, 1720, 480, 260, -4], [2200, 1740, 480, 260, 4]]),
        villages: [[1700, 1420, 200, 140, 6]],
        roads: [[[880, -60], [880, 1010], [880, 2360]], [[1700, -60], [1700, 2360]], [[2520, -60], [2520, 1010], [2520, 2360]], [[-80, 1150], [880, 1120], [1700, 1170], [2520, 1120], [3480, 1150]]],
        rails: [[[1700, -60], [1700, 900], [1700, 1400], [1700, 2360]]],
        marshes: [], creeks: [], river: [], bridges: [], fords: [] },

      { name: 'Sarıçam Koruluğu', biome: 'ova', sym: 1, tag: 'kademeli orman',
        brief: 'Açık koruluk kenarından sık çam çekirdeğine kademelenen orman. Görüş kısa, temas ani; pusu ve kanat sızması ana taktik.',
        notes: ['Orman kenarı (açık koru) yarı örtü, çekirdek tam gizlenme sağlar.', 'Orman yolları tek hızlı sevkiyat hattı — pusu için birebir.', 'Kömürcü kulübeleri açıklık: topçu için nadir gözlem penceresi.'],
        forests: mir([[900, 760, 300], [2500, 760, 300], [1700, 900, 260], [400, 1180, 230], [3000, 1180, 230], [1250, 1450, 230], [2150, 1450, 230]]),
        ridges: mir([[1700, 520, 195, 140, 0]]),
        villages: [[1700, 1150, 175, 120, 3], [880, 1660, 150, 110, 8]],
        roads: [[[-80, 1150], [700, 1180], [1700, 1120], [2700, 1180], [3480, 1130]], [[880, -60], [880, 1180], [880, 2360]], [[2520, -60], [2520, 1180], [2520, 2360]]],
        creeks: mir([[[-80, 1550], [900, 1600], [1700, 1540], [2600, 1600], [3480, 1560]]]),
        fields: [], rails: [], marshes: [], rocks: [], river: [], bridges: [], fords: [] },

      { name: 'Demirköy Kavşağı', biome: 'ova', sym: 1, tag: 'şehir savaşı',
        brief: 'Demiryolu kavşağının etrafında büyümüş kasaba; merkezde blok blok şehir savaşı, çevrede tarla ve meyve bahçesi. Beton, zırhlıyı yavaşlatır.',
        notes: ['Kasaba blokları sokak savaşı: piyade + istihkam üstün, tank kör.', 'Demiryolu dolguları kasabaya üç yaklaşma ekseni verir.', 'Meyve bahçeleri kasaba kenarına örtülü toplanma alanı.'],
        villages: [[1700, 1150, 460, 300, 2], [1700, 900, 280, 150, 5], [1700, 1400, 280, 150, 9], [880, 1150, 210, 150, 4], [2520, 1150, 210, 150, 7]],
        rails: [[[-80, 1030], [1400, 1090], [1700, 1150], [2000, 1210], [3480, 1150]], [[1700, -60], [1700, 1150], [1700, 2360]]],
        roads: [[[-80, 1330], [1000, 1380], [1700, 1300], [2400, 1380], [3480, 1330]], [[880, -60], [880, 1150], [880, 2360]], [[2520, -60], [2520, 1150], [2520, 2360]]],
        forests: mir([[1250, 700, 200], [2150, 700, 200], [380, 1620, 185], [3020, 1640, 185]]),
        fields: mir([[600, 560, 520, 280, -5], [2800, 580, 520, 280, 5], [1700, 480, 480, 220, 0]]),
        ridges: mir([[3020, 820, 180, 130, 12]]),
        marshes: [], rocks: [], creeks: [], river: [], bridges: [], fords: [] },

      { name: 'Akyayla Taşocağı', biome: 'yayla', sym: 1, tag: 'köşe kaleleri',
        brief: 'Dört köşede kaya çıkıntısı, merkezde işletme sahası ve basamaklı taşocağı çukurları. Merkez açık ama çukurlar ateşten kaçış cebi.',
        notes: ['Köşe kayalıkları doğal kale: içine yerleşen çıkarılamaz.', 'Ocak çukurları zırhlıya kapalı, piyadeye hilal siper.', 'Hizmet dekovil hattı merkeze hızlı takviye sağlar.'],
        ridges: mir([[560, 640, 245, 165, -18], [2840, 660, 245, 165, 18]]),
        rocks: mir([[1700, 900, 230, 165, 6], [1150, 1050, 165, 120, -14], [2250, 1050, 165, 120, 14], [880, 640, 130, 95, 20], [2520, 640, 130, 95, -20]]),
        villages: [[1700, 1150, 260, 175, 4]],
        forests: mir([[400, 1200, 195], [3000, 1200, 195], [1700, 1620, 200]]),
        rails: [[[-80, 1150], [1150, 1180], [1700, 1150], [2250, 1180], [3480, 1150]]],
        roads: [[[880, -60], [880, 1180], [880, 2360]], [[2520, -60], [2520, 1180], [2520, 2360]], [[1700, -60], [1700, 900], [1700, 1400], [1700, 2360]]],
        fields: [], marshes: [], creeks: mir([[[-80, 1520], [1000, 1560], [1700, 1500], [2500, 1560], [3480, 1510]]]), river: [], bridges: [], fords: [] },

      { name: 'Kızılbozkır Cephesi', biome: 'bozkir', sym: 0, tag: 'asimetrik cephe',
        brief: 'Kurak bozkır: kuzeyde yumuşak tepeler ve derin kuru vadiler, güneyde neredeyse çıplak düzlük. Kasıtlı asimetrik — kuzey savunmaya, güney taarruza uygun.',
        notes: ['Kuru vadiler kuzeye kademeli savunma hattı verir.', 'Güney açık: saldıran taraf duman/topçu perdesi olmadan ilerleyemez.', 'Seyrek kayalıklar tek uzun-menzil mevzisi — kim tutarsa cepheyi böler.'],
        ridges: [[700, 620, 275, 175, -14], [1600, 560, 300, 165, 8], [2600, 640, 260, 170, 16], [1150, 900, 190, 130, -6], [2100, 880, 190, 130, 6]],
        creeks: [[[-80, 980], [700, 1040], [1500, 950], [2300, 1030], [3480, 960]], [[-80, 1300], [900, 1360], [1800, 1270], [2700, 1350], [3480, 1290]], [[400, 2360], [520, 1700], [700, 1360]]],
        rocks: [[880, 1150, 150, 110, 12], [2520, 1150, 150, 110, -12], [1700, 1520, 175, 125, 6]],
        forests: [[300, 1500, 175], [3080, 1420, 165], [1700, 760, 165]],
        fields: [[1250, 1900, 620, 300, -4], [2400, 1940, 560, 280, 5]],
        villages: [[880, 1780, 190, 135, 5]],
        roads: [[[-80, 1150], [880, 1200], [1700, 1130], [2520, 1200], [3480, 1140]], [[1700, -60], [1700, 2360]], [[2520, 1200], [2600, 1800], [2520, 2360]]],
        rails: [], marshes: [], river: [], bridges: [], fords: [] },

      { name: 'Çamurlu Vadi', biome: 'bozkir', sym: 0, tag: 'çamur / yıkık köprü',
        brief: 'Sonbahar yağmurlarında dağılmış vadi tabanı: çamur düzlükleri, taşan dere ve yıkılmış köprü. Tekerlek batar, paletli yavaşlar, tarih tekrar eder.',
        notes: ['Çamur düzlüğünde araç hızı ağır cezalı — yol dışına çıkmak risk.', 'Yıkık köprü: tek geçiş istihkam onarımıyla açılır (dinamik tıkaç).', 'Çukur yol (sunken road) doğal hazır siper hattı.'],
        river: [[-140, 1210], [640, 1150], [1350, 1250], [1700, 1180], [2350, 1290], [3060, 1180], [3540, 1240]],
        bridges: [[1700, 1180, 6, 90, 30], [2520, 1252, -8, 130, 32]],
        fords: [[880, 1128, 220, -6]],
        marshes: [[1150, 1420, 420, 260, 8], [2100, 1450, 460, 280, -6], [1700, 1620, 380, 230, 4], [700, 1350, 300, 190, 10]],
        ridges: [[1250, 700, 290, 175, -12], [2300, 660, 270, 170, 14], [400, 900, 200, 140, -8]],
        creeks: [[[3480, 700], [2700, 760], [2000, 700], [1400, 780], [700, 720], [-80, 790]]],
        rocks: [[3060, 940, 160, 115, 18]],
        forests: [[900, 1900, 210], [2600, 1880, 200], [1700, 480, 185], [3100, 1620, 170]],
        fields: [[520, 1880, 480, 250, -6], [2000, 2000, 520, 260, 4]],
        villages: [[1700, 900, 200, 140, 3], [2520, 1620, 175, 125, 8]],
        roads: [[[1700, -60], [1700, 1180], [1700, 2360]], [[-80, 1000], [900, 1050], [1700, 980], [2600, 1050], [3480, 1000]], [[2520, -60], [2520, 1252], [2520, 2360]]],
        rails: [], creeksDry: [] }
];

if (typeof module !== 'undefined') module.exports = { ARENAS_V2, CONTROL_POINTS_V2, WORLD_W_V2, WORLD_H_V2 };
