// ═══════════════════════════════════════════════════════════════════════════
//  GEODATA ÜRETİCİ — Natural Earth → gömülü js/geoData.js (BUILD ADIMI)
//  ---------------------------------------------------------------------------
//  Design teslimi ("yeni avrupa harita" spec'i) gereği: oyun file:// üzerinde
//  çalışır ve CSP dış isteği engeller → coğrafya ÇEVRİMDIŞI üretilip gömülür.
//  d3/topojson yalnız BU BETİKTE kullanılır; oyuna girmez.
//
//  Çıktı (js/geoData.js):
//    GEO = { W, H, land:[[x,y]...poligonlar], coast:[çoklu çizgi],
//            inner:[aynı-blok sınırları], front:[farklı-blok sınırları],
//            rivers, ranges (dağ), desertY, borealY, countries:[{bloc, rings}] }
//    GEO_CITIES = [{name, x, y, tier, fac, oil, bloc}]  (spec'teki 50 gerçek şehir)
//    GEO_ROADS  = [[i,j]...]  (spec'teki gerçek koridorlar, şehir indeksiyle)
//  Koordinatlar 0..W/0..H piksel uzayında (Mercator, bbox lon −12..50 lat 22..63)
//  → oyunun lx/ly (0..1) uzayına bölünerek taşınır.
//
//  Kullanım:  node tools/make-geodata.js   (d3-geo + topojson-client gerekir:
//             npm install --no-save d3-geo@3 topojson-client@3)
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const https = require('https');
const d3 = require('d3-geo');
const topojson = require('topojson-client');

const ROOT = path.join(__dirname, '..');
const W = 1500, H = 1180;                       // üretim çözünürlüğü (oran ≈ bbox oranı)
const BBOX = [[-12, 22], [50, 63]];

// Spec'ten birebir: ülke → blok eşlemesi
const CB = {
    'Turkey':'turk','Greece':'turk','Bulgaria':'turk','Cyprus':'turk','N. Cyprus':'turk','Albania':'turk','Macedonia':'turk','North Macedonia':'turk','Serbia':'turk','Kosovo':'turk','Montenegro':'turk','Bosnia and Herz.':'turk','Georgia':'turk','Armenia':'turk','Azerbaijan':'turk',
    'Spain':'iber','Portugal':'iber','France':'iber','Italy':'iber','Malta':'iber',
    'United Kingdom':'brit','Ireland':'brit','Iceland':'brit',
    'Germany':'germ','Netherlands':'germ','Belgium':'germ','Luxembourg':'germ','Switzerland':'germ','Austria':'germ','Czechia':'germ','Czech Rep.':'germ','Poland':'germ','Denmark':'germ','Hungary':'germ','Slovakia':'germ','Slovenia':'germ','Croatia':'germ',
    'Norway':'nord','Sweden':'nord','Finland':'nord','Estonia':'nord','Latvia':'nord','Lithuania':'nord',
    'Russia':'slav','Ukraine':'slav','Belarus':'slav','Moldova':'slav','Romania':'slav',
    'Morocco':'magr','Algeria':'magr','Tunisia':'magr','Libya':'magr','W. Sahara':'magr',
    'Egypt':'arab','Israel':'arab','Palestine':'arab','Jordan':'arab','Syria':'arab','Lebanon':'arab','Iraq':'arab','Saudi Arabia':'arab','Kuwait':'arab'
};
// blok → oyunun devlet indeksi (STORY_STATE_DEFS sırası)
const BLOC_STATE = { turk: 0, iber: 1, brit: 2, germ: 3, nord: 4, slav: 5, magr: 6, arab: 7 };

// Spec'ten birebir: 50 gerçek şehir [ad, lon, lat, tier, fabrika, petrol]
const CITIES = [
 ['Ankara',32.85,39.93,3,2,0],['İstanbul',28.97,41.01,2,3,0],['İzmir',27.14,38.42,2,1,0],['Adana',35.32,37.0,1,1,0],
 ['Atina',23.73,37.98,2,1,0],['Sofya',23.32,42.70,2,1,0],['Belgrad',20.46,44.79,2,1,0],
 ['Madrid',-3.70,40.42,3,2,0],['Barselona',2.17,41.39,2,2,0],['Lizbon',-9.14,38.72,2,1,0],['Sevilla',-5.98,37.39,1,1,0],
 ['Paris',2.35,48.86,2,3,0],['Lyon',4.84,45.76,1,2,0],['Marsilya',5.37,43.30,2,1,0],
 ['Roma',12.50,41.90,2,1,0],['Milano',9.19,45.46,2,3,0],['Napoli',14.25,40.85,1,1,0],
 ['Londra',-0.13,51.51,3,3,0],['Manchester',-2.24,53.48,2,3,0],['Dublin',-6.26,53.35,2,1,0],
 ['Berlin',13.40,52.52,3,3,0],['Hamburg',9.99,53.55,2,2,0],['Münih',11.58,48.14,2,2,0],['Frankfurt',8.68,50.11,1,2,0],
 ['Amsterdam',4.90,52.37,2,2,0],['Brüksel',4.35,50.85,1,1,0],['Zürih',8.54,47.37,1,1,0],
 ['Viyana',16.37,48.21,2,2,0],['Prag',14.42,50.09,2,2,0],['Budapeşte',19.04,47.50,2,1,0],
 ['Varşova',21.01,52.23,2,2,0],['Kopenhag',12.57,55.68,2,1,0],
 ['Stokholm',18.07,59.33,3,2,0],['Oslo',10.75,59.91,2,1,0],['Helsinki',24.94,60.17,2,1,0],
 ['Moskova',37.62,55.76,3,3,0],['St. Petersburg',30.34,59.93,2,2,0],['Volgograd',44.50,48.70,1,1,1],
 ['Kiev',30.52,50.45,2,2,0],['Minsk',27.56,53.90,2,1,0],['Bükreş',26.10,44.43,2,1,1],
 ['Cezayir',3.06,36.75,3,1,1],['Kazablanka',-7.59,33.57,2,1,0],['Tunus',10.17,36.80,2,1,0],['Trablus',13.19,32.90,2,0,1],
 ['Kahire',31.24,30.04,2,2,0],['Şam',36.29,33.51,2,1,0],['Amman',35.93,31.95,1,0,0],
 ['Bağdat',44.36,33.31,2,1,1],['Riyad',46.72,24.63,3,1,1]
];
// hangi şehir hangi blokta (coğrafi konuma göre elle; spec CB ülke bazlıydı)
const CITY_BLOC = {
    'Ankara':'turk','İstanbul':'turk','İzmir':'turk','Adana':'turk','Atina':'turk','Sofya':'turk','Belgrad':'turk',
    'Madrid':'iber','Barselona':'iber','Lizbon':'iber','Sevilla':'iber','Paris':'iber','Lyon':'iber','Marsilya':'iber','Roma':'iber','Milano':'iber','Napoli':'iber',
    'Londra':'brit','Manchester':'brit','Dublin':'brit',
    'Berlin':'germ','Hamburg':'germ','Münih':'germ','Frankfurt':'germ','Amsterdam':'germ','Brüksel':'germ','Zürih':'germ','Viyana':'germ','Prag':'germ','Budapeşte':'germ','Varşova':'germ','Kopenhag':'germ',
    'Stokholm':'nord','Oslo':'nord','Helsinki':'nord',
    'Moskova':'slav','St. Petersburg':'slav','Volgograd':'slav','Kiev':'slav','Minsk':'slav','Bükreş':'slav',
    'Cezayir':'magr','Kazablanka':'magr','Tunus':'magr','Trablus':'magr',
    'Kahire':'arab','Şam':'arab','Amman':'arab','Bağdat':'arab','Riyad':'arab'
};
// Spec'ten birebir: gerçek yol koridorları
const ROADS = [
 ['Kazablanka','Cezayir'],['Cezayir','Tunus'],['Tunus','Trablus'],['Trablus','Kahire'],
 ['Kahire','Amman'],['Amman','Şam'],['Şam','Bağdat'],['Bağdat','Riyad'],['Şam','Adana'],
 ['Adana','Ankara'],['Ankara','İstanbul'],['Ankara','İzmir'],['İstanbul','Sofya'],['Sofya','Atina'],
 ['Sofya','Belgrad'],['Belgrad','Budapeşte'],['Budapeşte','Viyana'],['Viyana','Prag'],['Viyana','Münih'],
 ['Prag','Berlin'],['Berlin','Varşova'],['Varşova','Minsk'],['Minsk','Moskova'],['Moskova','St. Petersburg'],
 ['St. Petersburg','Helsinki'],['Stokholm','Oslo'],['Kopenhag','Hamburg'],['Hamburg','Berlin'],
 ['Hamburg','Amsterdam'],['Amsterdam','Brüksel'],['Brüksel','Paris'],['Paris','Frankfurt'],['Frankfurt','Münih'],
 ['Paris','Lyon'],['Lyon','Marsilya'],['Zürih','Milano'],['Milano','Roma'],['Roma','Napoli'],
 ['Marsilya','Barselona'],['Barselona','Madrid'],['Madrid','Lizbon'],['Madrid','Sevilla'],
 ['Londra','Manchester'],['Londra','Paris'],['Dublin','Manchester'],
 ['Kiev','Moskova'],['Kiev','Varşova'],['Kiev','Bükreş'],['Bükreş','Sofya'],['Moskova','Volgograd'],['Lyon','Zürih']
];
// Spec'ten: dağ sıraları + nehirler (çizim için)
const RANGES = [
 [[[5.5,44.2],[7,45.5],[9,46.3],[11,46.8],[13.5,47.0],[15,47.3]],1.0,1.0],
 [[[-1.5,42.9],[0.5,42.7],[2.5,42.4]],0.7,.8],
 [[[19.5,49.3],[22,49.0],[24,48.2],[25.5,47.0],[25,45.6],[23,45.4]],0.9,.8],
 [[[15.5,45.2],[17.5,43.8],[19.5,42.8],[20.5,41.8]],0.7,.7],
 [[[9.5,44.4],[11.5,43.5],[13.5,42.2],[15,41.2]],0.6,.6],
 [[[6,59.5],[7.5,61],[10,62.5]],1.1,.8],
 [[[30,37.3],[33,37.0],[36,37.5],[39,38.5],[41,39.5],[43,39.8]],0.9,.9],
 [[[35,40.8],[39,40.6]],0.6,.6],
 [[[40,43.3],[44,42.8],[47,42.0]],0.9,1.0],
 [[[-7,31.2],[-4,32.5],[-1,34.0],[2,35.0],[6,35.5],[9,35.8]],0.9,.9],
 [[[44,37.5],[46,35.0],[47.5,33.0]],0.9,.8],
 [[[-5.5,43.0],[-3,42.8]],0.6,.6],[[[-3.2,37.1]],0.5,.6],
 [[[23,42.8],[25.5,42.7]],0.6,.6],[[[3,45.2]],0.7,.5],
 [[[13.5,50.7],[16,50.4]],0.5,.4]
];
const RIVERS = [
 [[8.7,47.6],[7.75,48.58],[7.5,49.4],[6.96,50.94],[6.1,51.8],[4.5,51.9]],
 [[8.6,48.4],[10.5,48.5],[13,48.5],[16.37,48.2],[19,47.4],[19.5,46],[20.5,44.8],[24.5,44.0],[28.0,45.3]],
 [[31.2,30.1],[31.6,28.5],[32.6,26.0],[32.9,24.0]],
 [[2.35,48.86],[1.2,49.35],[0.3,49.45]],
 [[37.6,55.4],[40,54.0],[42.5,50.6],[44.5,48.7],[46.5,47.2]]
];

function fetchJson(url) {
    return new Promise((res, rej) => {
        https.get(url, r => {
            if (r.statusCode >= 300 && r.headers.location) return fetchJson(r.headers.location).then(res, rej);
            let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } });
        }).on('error', rej);
    });
}

// GeoJSON geometrisini piksel poligon halkalarına çevir (yoğunluk azaltmalı)
function ringsOf(geom, proj, every = 1) {
    const out = [];
    const doRing = ring => {
        const r = [];
        for (let i = 0; i < ring.length; i += every) {
            const p = proj(ring[i]); if (!p) continue;
            r.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
        }
        if (r.length >= 3) out.push(r);
    };
    const walk = g => {
        if (!g) return;
        if (g.type === 'Polygon') g.coordinates.forEach(doRing);
        else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(doRing));
        else if (g.type === 'LineString') doRing(g.coordinates);
        else if (g.type === 'MultiLineString') g.coordinates.forEach(doRing);
        else if (g.type === 'GeometryCollection') g.geometries.forEach(walk);
    };
    walk(geom);
    return out;
}
function linesOf(geom, proj, every = 1) { return ringsOf(geom, proj, every); }   // aynı yapı, anlamsal ad

(async () => {
    console.log('Natural Earth 110m indiriliyor…');
    const topo = await fetchJson('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json');
    const obj = topo.objects.countries;
    const features = topojson.feature(topo, obj).features;
    const blocOf = f => CB[f.properties.name] || null;

    const proj = d3.geoMercator().fitSize([W, H], {
        type: 'MultiPoint',
        coordinates: [[BBOX[0][0], BBOX[0][1]], [BBOX[1][0], BBOX[0][1]], [BBOX[1][0], BBOX[1][1]], [BBOX[0][0], BBOX[1][1]]]
    });
    const P = (lon, lat) => { const p = proj([lon, lat]); return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; };

    const land = topojson.merge(topo, obj.geometries);
    const frontMesh = topojson.mesh(topo, obj, (a, b) => a !== b && blocOf(a) !== blocOf(b));
    const innerMesh = topojson.mesh(topo, obj, (a, b) => a !== b && blocOf(a) === blocOf(b));
    const coastMesh = topojson.mesh(topo, obj, (a, b) => a === b);

    const countries = features.map(f => {
        const b = blocOf(f);
        return { bloc: b ? BLOC_STATE[b] : -1, rings: ringsOf(f.geometry, proj) };
    }).filter(c => c.rings.length);

    const GEO = {
        W, H,
        land: ringsOf(land, proj),
        coast: linesOf(coastMesh, proj),
        inner: linesOf(innerMesh, proj),
        front: linesOf(frontMesh, proj),
        rivers: RIVERS.map(rv => rv.map(pt => P(pt[0], pt[1]))),
        ranges: RANGES.map(([pts, r, str]) => ({ pts: pts.map(pt => P(pt[0], pt[1])), r: Math.round(r * Math.abs(P(11, 48)[0] - P(10, 48)[0])), str })),
        desertY: Math.round(P(0, 35)[1]), desertY2: Math.round(P(0, 28)[1]),
        borealY: Math.round(P(0, 57)[1]),
        countries,
    };
    const GEO_CITIES = CITIES.map(([name, lon, lat, tier, fac, oil]) => {
        const p = P(lon, lat);
        return { name, x: p[0], y: p[1], tier, fac, oil, st: BLOC_STATE[CITY_BLOC[name]] };
    });
    const CI = {}; CITIES.forEach((c, i) => CI[c[0]] = i);
    const GEO_ROADS = ROADS.map(([a, b]) => [CI[a], CI[b]]);

    const out = `// ═══ OTOMATİK ÜRETİLDİ — elle düzenleme: tools/make-geodata.js ═══
// Natural Earth 110m → Mercator (lon −12..50, lat 22..63) → ${W}×${H} piksel uzayı.
// Oyun lx/ly (0..1) uzayına GEO.W/GEO.H bölünerek geçilir.
const GEO = ${JSON.stringify(GEO)};
const GEO_CITIES = ${JSON.stringify(GEO_CITIES)};
const GEO_ROADS = ${JSON.stringify(GEO_ROADS)};
`;
    fs.writeFileSync(path.join(ROOT, 'js', 'geoData.js'), out);
    const kb = (fs.statSync(path.join(ROOT, 'js', 'geoData.js')).size / 1024).toFixed(0);
    console.log(`✓ js/geoData.js yazıldı (${kb} KB) — ${GEO_CITIES.length} şehir, ${GEO_ROADS.length} yol, ${countries.length} ülke poligonu`);
    // hızlı doğrulama: tüm şehirler kara sınırları içinde mi (kabaca bbox)
    const bad = GEO_CITIES.filter(c => c.x < 0 || c.y < 0 || c.x > W || c.y > H);
    if (bad.length) { console.error('⚠ bbox dışı şehir:', bad.map(c => c.name).join(', ')); process.exit(1); }
    const dup = new Set(); for (const c of GEO_CITIES) { if (dup.has(c.name)) { console.error('⚠ tekrar eden şehir: ' + c.name); process.exit(1); } dup.add(c.name); }
    console.log('✓ doğrulama: bbox + benzersiz adlar temiz');
})();
