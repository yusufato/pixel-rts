// HIKAYE ROSTER KAPSAMASI — 26 birim URETILEBILIR oldu, peki FIILEN URETILIYOR MU?
//
// Kullanici: "hikaye modunda bu 25 birlik kullanilmiyor." Uretim kilidi rosterden turetilerek
// 8 → 26'ya cikarildi (bkz. Production.prodUnlockTable). AMA kilidi acmak yetmez: bir birim ancak
// sehir O SEVIYEYE ULASIRSA uretilebilir. Kod yorumu da bunu soyluyor: "sehirler nadiren yukseliyor,
// tum dunya Sv.1'de kilitleniyordu — 8 devletin 8'i de yalniz piyade+tanksavar uretebiliyordu".
//
// BU ARAC ONU OLCER: kampanya N gun kosar, sonunda
//   (a) dunyadaki bina seviyelerinin dagilimi (kac sehir hangi seviyede),
//   (b) FIILEN acik olan tip sayisi (sehir seviyelerine gore),
//   (c) komutan ordularinda GERCEKTEN bulunan tip dagilimi.
// "Uretilebilir 26/26" bir NIYET beyanidir; sahada gorunen tip sayisi GERCEKTIR.
//
// Kullanim: node tools/hikaye-roster-kapsama.js [--sn 1800] [--tohum 2032]
const path = require('node:path');
const { createRuntime } = require('./story-sim-harness.js');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SN = Math.max(60, Number(arg('--sn', 1800)) || 1800);
const TOHUM = Number(arg('--tohum', 2032)) >>> 0;

const rt = createRuntime(TOHUM);
rt.api.newCampaign({ seed: TOHUM, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });

// Harness API'si: state() -> STORY, advance(sn) -> kampanyayi ilerlet, eval ile ic degiskenler.
const STORY = rt.api.state();
let t = 0;
const DILIM = 60;
while (t < SN) { rt.api.advance(Math.min(DILIM, SN - t)); t += DILIM; }

// STATS/prodTypesFor VM baglaminda yasar; harness'in salt-okunur kancalarindan alinir.
const STATS = rt.api.stats();
const prodTypesFor = (n, k) => rt.api.prodTypes(n, k);
if (!STORY || !STATS) { console.log('HATA: STORY/STATS okunamadi'); process.exit(2); }

const nodes = (STORY.nodes || []);
const BINALAR = { bar: 'kisla', fac: 'fabrika', art: 'topcu parki', air: 'hava ussu', sup: 'destek ussu', aad: 'hava savunma' };
const seviye = {};
for (const k of Object.keys(BINALAR)) { seviye[k] = {}; for (const n of nodes) seviye[k][n[k] | 0] = (seviye[k][n[k] | 0] || 0) + 1; }

// FIILEN acik tipler: en az bir sehirde uretilebilen
const acik = new Set();
{
    for (const n of nodes) for (const k of Object.keys(BINALAR)) for (const tip of prodTypesFor(n, k)) acik.add(tip);
}

// Ordulardaki gercek tip dagilimi
const orduTip = {};
let orduToplam = 0;
// Komutanlar devletlerin ALTINDA yasar (STORY.states[].gov.commanders) — ilk surumde STORY.commanders
// okunmustu ve 0 birlik gorunuyordu; "sifir" sonucu once OLCUM HATASI diye sinandi, oyle cikti.
let komutanSayisi = 0;
for (const st of (STORY.states || [])) {
    for (const c of ((st.gov && st.gov.commanders) || [])) {
        komutanSayisi++;
        for (const k in (c.army || {})) {
            const adet = c.army[k] | 0; if (adet <= 0) continue;
            orduTip[k] = (orduTip[k] || 0) + adet; orduToplam += adet;
        }
    }
}
for (const n of nodes) {
    for (const k in (n.garrisonUnits || {})) {
        const adet = n.garrisonUnits[k] | 0; if (adet <= 0) continue;
        orduTip[k] = (orduTip[k] || 0) + adet; orduToplam += adet;
    }
}

const rosterToplam = Object.keys(STATS).map(Number).filter(Number.isFinite).length;
const ad = t => (STATS[t] && STATS[t].id) || String(t);

console.log('HIKAYE ROSTER KAPSAMASI — ' + SN + ' sn kampanya, tohum ' + TOHUM + ', ' + nodes.length + ' sehir');
console.log('');
console.log('  BINA SEVIYELERI (sehir sayisi)');
for (const k of Object.keys(BINALAR)) {
    const d = seviye[k];
    console.log('    ' + BINALAR[k].padEnd(13) + [0, 1, 2, 3].map(lv => 'Sv' + lv + ':' + String(d[lv] || 0).padStart(3)).join('  '));
}
console.log('');
console.log('  FIILEN ACIK TIP: ' + acik.size + ' / ' + rosterToplam +
    (acik.size < rosterToplam ? '   (kilitli: ' + Object.keys(STATS).map(Number).filter(Number.isFinite)
        .filter(x => !acik.has(x)).map(ad).join(', ') + ')' : ''));
console.log('');
const sirali = Object.keys(orduTip).map(Number).sort((a, b) => orduTip[b] - orduTip[a]);
console.log('  komutan sayisi: ' + komutanSayisi);
console.log('  ORDULARDA GERCEKTEN BULUNAN TIP: ' + sirali.length + ' / ' + rosterToplam + '   (toplam ' + orduToplam + ' birlik)');
for (const tp of sirali) console.log('    ' + ad(tp).padEnd(24) + String(orduTip[tp]).padStart(5));
console.log('');
console.log('  OKUMA: "uretilebilir 26/26" niyet beyanidir. Asil sayi ORDULARDA BULUNAN tip sayisidir;');
console.log('         dusukse darbogaz kilit degil SEHIR SEVIYESI / uretim tercihi demektir.');
