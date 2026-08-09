// HELO MARUZIYETI — oyuncunun saldiri helikopteri AI hava savunmasina NE KADAR maruz kaliyor?
//
// NEDEN: tools/olduren-kaynak.js (26 OYUNCU maci, 821 olumcul olay) — AI kayiplarinin %22'si
// attack_helo'dan. Tek kalemde EN BUYUK katil. Kullanici bunu zaten bildirmisti
// ("helom cok rahat geziyor, AI'nin hava savunmasi semsiye gibi olmali").
//
// BU ARAC DEGISIKLIK ONERMEZ, TESHIS KOYAR. Uc olasilik ayrilir:
//   (A) MEKANIZMA BOSLUGU  — helo AI hava savunmasinin menziline hic girmiyor  -> konumlandirma sorunu
//   (B) GORUS BOSLUGU      — menzilde ama GORUNMUYOR                            -> tespit sorunu
//   (C) TAKAS KAYBI        — menzilde, goruluyor, atesleniyor ama olmuyor       -> denge/davranis
// Ucu farkli mudahale ister; ayirmadan mudahale etmek gecen sefer (jammerPost) bos cikmisti.
//
// VERI: ham kayit `samples` (0.5sn birim durumu: x,y,side,type,hp) + `combatEvents` (hedef=helo olanlar).
// TUZAK NOTU: menzil/gorus STATS'tan OKUNUR, elle yazilmaz (gecen sefer range'i 100 ile carpip
// tum birimleri "uzun menzilli" saymistim).
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');

const { tezgahKur } = require('./muharebe-tezgah.js');
const { ctx } = tezgahKur();
const AD = JSON.parse(vm.runInContext('JSON.stringify(UNIT_ID_BY_INDEX)', ctx));
const ST = JSON.parse(vm.runInContext(`JSON.stringify(Object.fromEntries(Object.entries(STATS).map(([k,v]) => [k, {
    kat: v.category, gorus: v.vision || 0, airRadar: !!v.airRadar,
    havaMenzil: (v.weapons||[]).filter(w => Array.isArray(w.targets) && w.targets.includes('air'))
                 .reduce((m,w) => Math.max(m, w.range||0), 0)
}])))`, ctx));

// HAVA SAVUNMASI = hava hedefleyebilen silahi olan HER birim (elle liste DEGIL, veriden turetildi)
const AD_TIPLERI = Object.keys(ST).filter(t => ST[t].havaMenzil > 0).map(Number);
console.log('HELO MARUZIYETI — teshis (A: menzile girmiyor / B: gorunmuyor / C: takasi kaybediyor)');
console.log('');
console.log('  hava hedefleyebilen tipler (veriden): ' +
    AD_TIPLERI.map(t => AD[t] + '(' + ST[t].havaMenzil + 'px)').join(', '));
console.log('');

const dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json'));
const HELO = Object.keys(ST).map(Number).filter(t => ST[t].kat === 'air' && AD[t] && /helo/.test(AD[t]));

let heloOrnek = 0, menzilde = 0, gorusAlaninda = 0;
let heloOlum = 0, heloDogum = 0;
const vurulan = {};        // heloya hasar veren tipler
let heloHasarOlay = 0;
const macBasi = [];

for (const fn of dosyalar) {
    const t = (JSON.parse(fs.readFileSync(path.join(DIZIN, fn), 'utf8')).replay || {}).telemetry || {};
    const sm = t.samples || [];
    if (!sm.length) continue;
    let mOrnek = 0, mMenzil = 0, mGorus = 0;
    const gorulenHelo = new Set();
    for (const s of sm) {
        const birimler = s.units || [];
        const helolar = birimler.filter(u => u.side === 'blue' && HELO.includes(u.type) && (u.hp === undefined || u.hp > 0));
        if (!helolar.length) continue;
        const ad = birimler.filter(u => u.side === 'red' && AD_TIPLERI.includes(u.type) && (u.hp === undefined || u.hp > 0));
        for (const h of helolar) {
            gorulenHelo.add(h.id);
            heloOrnek++; mOrnek++;
            let inRange = false, inVision = false;
            for (const a of ad) {
                const d = Math.hypot(a.x - h.x, a.y - h.y);
                if (d <= ST[a.type].havaMenzil) inRange = true;
                // GORUS: hava hedefi icin YALNIZ airRadar tasiyan birim aydinlatir (kodun kendi kurali)
                if (ST[a.type].airRadar && d <= (ST[a.type].gorus || 0)) inVision = true;
            }
            // kendi gorusuyle de gorebilir (yakin menzil): herhangi bir kirmizi birimin gorusu
            if (!inVision) {
                for (const a of ad) {
                    const d = Math.hypot(a.x - h.x, a.y - h.y);
                    if (d <= (ST[a.type].gorus || 0)) { inVision = true; break; }
                }
            }
            if (inRange) { menzilde++; mMenzil++; }
            if (inVision) { gorusAlaninda++; mGorus++; }
        }
    }
    heloDogum += gorulenHelo.size;
    for (const e of (t.combatEvents || [])) {
        if (e.targetSide !== 'blue' || !HELO.includes(e.targetType)) continue;
        heloHasarOlay++;
        const a = (e.attackerType != null) ? (AD[e.attackerType] || ('tip' + e.attackerType)) : '?';
        vurulan[a] = (vurulan[a] || 0) + 1;
        if (e.lethal === true || (e.hpAfter != null && e.hpAfter <= 0)) heloOlum++;
    }
    if (mOrnek) macBasi.push({ fn: fn.slice(26, 40), ornek: mOrnek, menzil: mMenzil / mOrnek, gorus: mGorus / mOrnek });
}

const y = (n, t) => t ? ('%' + (n / t * 100).toFixed(1)) : '-';
console.log('  ══ MARUZIYET (' + dosyalar.length + ' oyuncu maci, ' + heloOrnek + ' helo-ornegi @0.5sn) ══');
console.log('    gorulen helo sayisi        : ' + heloDogum);
console.log('    AD MENZILINDE gecen ornek  : ' + menzilde + '  ' + y(menzilde, heloOrnek));
console.log('    AD GORUSUNDE gecen ornek   : ' + gorusAlaninda + '  ' + y(gorusAlaninda, heloOrnek));
console.log('');
console.log('  ══ HELOYA GELEN ATES ══');
console.log('    heloya isabet olayi        : ' + heloHasarOlay);
console.log('    helo olumu                 : ' + heloOlum + '   (dogum ' + heloDogum + ' -> olum orani ' + y(heloOlum, heloDogum) + ')');
console.log('    vuranlar                   : ' + (Object.keys(vurulan).length
    ? Object.entries(vurulan).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + v).join('  ')
    : 'HIC KIMSE'));
console.log('');
console.log('  ══ TESHIS ══');
const mOran = heloOrnek ? menzilde / heloOrnek : 0;
const gOran = heloOrnek ? gorusAlaninda / heloOrnek : 0;
if (mOran < 0.15) console.log('    (A) MEKANIZMA BOSLUGU — helo AD menziline neredeyse hic girmiyor (' + y(menzilde, heloOrnek) + ').');
else if (gOran < mOran * 0.5) console.log('    (B) GORUS BOSLUGU — menzilde ' + y(menzilde, heloOrnek) + ' ama gorusde yalniz ' + y(gorusAlaninda, heloOrnek) + '.');
else if (heloHasarOlay === 0) console.log('    (B/C) menzilde+goruste ama HIC ATES YOK — hedefleme zinciri kopuk.');
else console.log('    (C) TAKAS — menzilde ' + y(menzilde, heloOrnek) + ', gorusde ' + y(gorusAlaninda, heloOrnek) +
    ', ates VAR (' + heloHasarOlay + ' isabet) ama helo yine de AI kayiplarinin %22 sini uretiyor.');
console.log('');
console.log('  mac basi menzil-orani: ' + macBasi.slice(0, 8).map(m => y(m.menzil * 100, 100)).join(' '));
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'helo-maruziyet.json'),
    JSON.stringify({ heloOrnek, menzilde, gorusAlaninda, heloOlum, heloDogum, vurulan, macBasi }, null, 1));
