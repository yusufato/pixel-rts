// ODUL DEFTERI DENETIMI — "26 birimin tamamini inceledim" diyebilmek icin SON KONTROL.
// Kullanici: "defteri son kez birimlerle dogru mu eslesiyor ve odullendiriyor diye kontrol et."
//
// YONTEM: her birimin TASARIM ROLU (UnitData roleTags) bir BEKLENEN KANAL kumesine cevrilir.
// Defterin o birime yazdigi en guclu kanal (kanal-ici z-skoru) bu kumeyle KESISIYOR mu?
//   ESLESTI      -> defter o birimi dogru odullendiriyor
//   SUPHELI      -> en guclu kanal tasarim roluyle uyusmuyor (ya birim bozuk, ya odul eksik)
//   URETIM YOK   -> hicbir kanalda olculebilir uretim yok (birim ya issiz ya olcusuz)
const fs = require('fs');

const DOSYALAR = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!DOSYALAR.length) { console.error('kullanim: node tools/odul-denetim.js qa-runtime/odul-p*.json'); process.exit(1); }

// ── BEKLENTI TABLOSU: birim -> tasarim rolunun karsiligi olan kanallar ──
// (UnitData roleTags'ten turetildi; "bu birim isini yapiyorsa BURADA gorunmeli")
// KULLANICI NOTU: 25 BIRIM vardir. loitering_munition SATIN ALINAN bir birim degil, drone
// operatorunun SARF MALZEMESIDIR. Denetimde ayri birim SAYILMAZ; urettigi hasar zaten
// `droneHasar` kanaliyla OPERATORE yazilir. Ayri satir yalnizca teshis icin gosterilir.
const SARF = ['loitering_munition'];
const BEKLENTI = {
    infantry:              ['emilen', 'GORUS', 'BASKI'],          // line_holder, cheap_mass
    at_team:               ['imha/TL', 'hasar/TL'],               // anti_armor, ambush
    mortar_team:           ['BASKI', 'PANIK', 'hasar/TL'],        // indirect_fire, cover_breaker
    manpads_team:          ['havaHsr', 'HAVA', 'imha/TL'],        // anti_air, anti_drone
    commando:              ['imha/TL', 'hasar/TL', 'tespit'],     // raider, backline_hunter
    mbt:                   ['emilen', 'hasar/TL', 'imha/TL'],     // breakthrough, frontline
    ifv:                   ['emilen', 'hasar/TL'],                // screen, flanker
    tank_destroyer:        ['imha/TL', 'hasar/TL'],               // anti_armor, overwatch
    artillery:             ['BASKI', 'PANIK', 'hasar/TL'],        // suppression, siege
    mlrs:                  ['BASKI', 'hasar/TL', 'imha/TL'],      // burst_damage, anti_mass
    ballistic_missile:     ['hasar/TL', 'imha/TL'],               // strategic
    counter_battery_radar: ['tespit', 'GORUS'],                   // intel, air_search
    spaag:                 ['havaHsr', 'HAVA', 'imha/TL'],        // anti_air, escort
    sam_battery:           ['havaHsr', 'HAVA', 'imha/TL'],        // anti_air, area_denial
    attack_helo:           ['imha/TL', 'hasar/TL'],               // anti_armor, rapid_response
    transport_helo:        ['tasinan'],                           // mobility, insertion
    recon_uav:             ['GORUS', 'tespit'],                   // intel, spotter
    armed_uav:             ['imha/TL', 'hasar/TL', 'GORUS'],      // anti_armor, persistent, intel
    scout_vehicle:         ['GORUS', 'tespit'],                   // intel, spotter, fast
    ew_vehicle:            ['jam'],                               // anti_drone, denial
    medic:                 ['kurtar', 'iyiles'],                  // sustain
    engineer:              ['siper', 'dolum', 'mayin'],           // engineering, terrain_shaper
    supply_truck:          ['muhim', 'kuruEng'],                  // logistics, enabler
    command_vehicle:       ['hale', 'rally'],                     // command, force_multiplier
    drone_operator:        ['droneHsr'],                          // drone_control
};

const KANAL = [
    { ad: 'imha/TL',  alan: 'imhaDeger',    bol: true,  k: 1 },
    { ad: 'hasar/TL', alan: 'hasar',        bol: true,  k: 1 },
    { ad: 'PANIK',    alan: 'panik',        bol: true,  k: 100 },
    { ad: 'BASKI',    alan: 'baski',        bol: true,  k: 100 },
    { ad: 'emilen',   alan: 'emilen',       bol: true,  k: 1 },
    { ad: 'GORUS',    alan: 'gorusTekil',   bol: true,  k: 0.05 },
    { ad: 'tespit',   alan: 'tespit',       bol: false, k: 1 },
    { ad: 'HAVA',     alan: 'havaCaydirma', bol: true,  k: 0.05 },
    { ad: 'havaHsr',  alan: 'havaHasar',    bol: true,  k: 1 },
    { ad: 'jam',      alan: 'jamTik',       bol: false, k: 0.05 },
    { ad: 'iyiles',   alan: 'iyilestirme',  bol: false, k: 1 },
    { ad: 'kurtar',   alan: 'kurtarma',     bol: false, k: 1 },
    { ad: 'muhim',    alan: 'muhimmat',     bol: false, k: 1 },
    { ad: 'kuruEng',  alan: 'kuruEngel',    bol: false, k: 1 },
    { ad: 'siper',    alan: 'siperTik',     bol: false, k: 0.05 },
    { ad: 'dolum',    alan: 'yakitDolum',   bol: false, k: 1 },
    { ad: 'mayin',    alan: 'mayin',        bol: false, k: 1 },
    { ad: 'tasinan',  alan: 'tasinan',      bol: false, k: 1 },
    { ad: 'droneHsr', alan: 'droneHasar',   bol: false, k: 1 },
    { ad: 'hale',     alan: 'haleTik',      bol: false, k: 0.05 },
    { ad: 'rally',    alan: 'rally',        bol: false, k: 1 },
];

// ── partileri birlestir (ayni birim birden fazla partide olabilir -> topla) ──
const birlesik = {};
for (const d of DOSYALAR) {
    const { top } = JSON.parse(fs.readFileSync(d, 'utf8'));
    for (const [ad, a] of Object.entries(top)) {
        // HATA (yakalandi): maliyet de TOPLANIYORDU -> bir birim 3 partide gecince maliyeti x3
        // olup maliyete bolunen TUM kanallari yapay olarak dusuyordu. Maliyet SABITTIR, toplanmaz.
        if (!birlesik[ad]) { birlesik[ad] = Object.assign({}, a); continue; }
        for (const k in a) { if (k === 'maliyet') continue; birlesik[ad][k] = (birlesik[ad][k] || 0) + a[k]; }
    }
}

const satir = Object.entries(birlesik).map(([ad, a]) => {
    const o = { ad, mal: a.maliyet / (a.n ? 1 : 1), n: a.n, v: {} };
    o.mal = a.maliyet;
    for (const c of KANAL) o.v[c.ad] = (a[c.alan] || 0) / a.n * c.k / (c.bol ? (a.maliyet || 1) : 1);
    return o;
});

// kanal-ici z-skoru
const z = {};
for (const c of KANAL) {
    const vals = satir.map(x => x.v[c.ad]);
    const m = vals.reduce((p, q) => p + q, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((p, q) => p + (q - m) * (q - m), 0) / vals.length) || 1;
    for (const x of satir) (z[x.ad] = z[x.ad] || []).push({ kanal: c.ad, z: (x.v[c.ad] - m) / sd, v: x.v[c.ad] });
}

console.log('ODUL DEFTERI DENETIMI — ' + satir.length + '/26 birim olculdu   (' + DOSYALAR.length + ' parti birlestirildi)');
console.log('');
console.log('  ' + 'birim'.padEnd(23) + 'TL'.padStart(6) + '  DURUM'.padEnd(14) + 'en guclu kanal(lar)'.padEnd(34) + 'beklenen');
const sonuc = { esles: [], suphe: [], yok: [], eksik: [] };
const tumBirimler = Object.keys(BEKLENTI);
for (const ad of tumBirimler) {
    const x = satir.find(q => q.ad === ad);
    if (!x) { sonuc.eksik.push(ad);
        console.log('  ' + ad.padEnd(23) + '-'.padStart(6) + '  OLCULMEDI'.padEnd(14) + '(orduya hic girmedi)'.padEnd(34) + (BEKLENTI[ad] || []).join('/'));
        continue; }
    const uretim = (z[ad] || []).filter(q => q.v > 0.005).sort((a, b) => b.z - a.z);
    const bek = BEKLENTI[ad] || [];
    if (!uretim.length) { sonuc.yok.push(ad);
        console.log('  ' + ad.padEnd(23) + String(x.mal).padStart(6) + '  URETIM YOK'.padEnd(14) + '-'.padEnd(34) + bek.join('/'));
        continue; }
    const en3 = uretim.slice(0, 3);
    // ESLESME ESIGI: beklenen kanal ilk ucte olmasi YETMEZ, o kanalda ORTALAMANIN USTUNDE
    // olmali. Eski gevsek kural spaag'i imha z-0.1, SAM'i z-0.2 ile "eslesti" gosteriyordu.
    const ESIK = 0.3;
    const eslesti = en3.some(q => bek.includes(q.kanal) && q.z >= ESIK);
    (eslesti ? sonuc.esles : sonuc.suphe).push(ad);
    console.log('  ' + ad.padEnd(23) + String(x.mal).padStart(6) + '  ' + (eslesti ? 'ESLESTI' : '** SUPHELI **').padEnd(14) +
        en3.map(q => q.kanal + '(z' + (q.z >= 0 ? '+' : '') + q.z.toFixed(1) + ')').join(' ').padEnd(34) + bek.join('/'));
}
console.log('');
console.log('  OZET: ESLESTI ' + sonuc.esles.length + '   SUPHELI ' + sonuc.suphe.length +
    '   URETIM YOK ' + sonuc.yok.length + '   OLCULMEDI ' + sonuc.eksik.length + '   / ' + tumBirimler.length);
if (sonuc.suphe.length) console.log('  SUPHELILER : ' + sonuc.suphe.join(', '));
if (sonuc.yok.length)   console.log('  URETIM YOK : ' + sonuc.yok.join(', '));
if (sonuc.eksik.length) console.log('  OLCULMEDI  : ' + sonuc.eksik.join(', '));
console.log('');
for (const sad of SARF) {
    const x = satir.find(q => q.ad === sad);
    if (!x) continue;
    const ur = (z[sad] || []).filter(q => q.v > 0.005).sort((a, b) => b.z - a.z).slice(0, 3);
    console.log('  SARF MALZEMESI (birim DEGIL, operatore yazilir):');
    console.log('    ' + sad.padEnd(21) + String(x.mal).padStart(6) + '  ' +
        (ur.length ? ur.map(q => q.kanal + '(z' + (q.z >= 0 ? '+' : '') + q.z.toFixed(1) + ')').join(' ') : 'URETIM YOK'));
    console.log('');
}
console.log('  NOT: "SUPHELI" iki anlama gelebilir — (a) birim tasarim rolunu OYNAMIYOR,');
console.log('       (b) o rolun odul kanali defterde EKSIK. Ikisi de duzeltilmesi gereken seydir.');
