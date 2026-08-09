// OLDUREN KAYNAK KIRILIMI — birimler NEYLE ve NE KADAR UZAKTAN olduruluyor?
//
// NEDEN: tools/kuvvet-dagilimi.js (8 tohum x 2 rol, 754 olum) sunu buldu — intel4-pro olurken
// 600px cevresinde ort. yalniz 3.0 dusman var ve olumlerin %57'si YEREL USTUNLUK varken oluyor.
// Yani birimler yerel dovuste degil, CEMBERIN DISINDAN olduruluyor olabilir.
// Ayni supheyi kodun kendi notu da yazmis (js/globals.js, armorFace deltasi):
//   "hasarin cogu yonun ONEMSIZ oldugu kaynaklardan — dolayli ates/patlama alani, hava, AT.
//    Sinamak icin HASAR KAYNAGI KIRILIMI gerekir (ayri teshis)."  <- iste o teshis.
//
// VERI: telemetri `combatEvents` zaten saldiran tipi/konumu, hedef konumu ve `lethal` tutuyor
// (js/globals.js battleRecordCombatEvent). Yeni mekanizma gerekmiyor, OKUNMUYORDU.
//
// SOZLESME NOTU (dogrulandi, varsayilmadi): olay alanlari kayit surumune gore degisir; bu arac
// once SEMAYI YAZDIRIR, sonra yalnizca BULUNAN alanlari kullanir. Eksik alan sessizce 0 sayilmaz.
const fs = require('fs');
const path = require('path');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');
const YAKIN = Number(arg('--yakin', 600)) || 600;   // kuvvet-dagilimi.js ile AYNI yaricap

const dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json'));
if (!dosyalar.length) { console.error('kayit bulunamadi'); process.exit(1); }

// 1) SEMA — hangi alanlar GERCEKTEN var?
{
    const t = (JSON.parse(fs.readFileSync(path.join(DIZIN, dosyalar[0]), 'utf8')).replay || {}).telemetry || {};
    const ce = (t.combatEvents || [])[0];
    console.log('SEMA DOGRULAMA — combatEvents ornek alanlari:');
    console.log('  ' + (ce ? Object.keys(ce).join(', ') : '(olay yok)'));
    console.log('');
}

const kind = {}, olduren = {}, mesafeler = [], yakinUzak = { yakin: 0, uzak: 0 };
const tipAd = {};
let toplam = 0, olumcul = 0, mesafeliOlum = 0;
const tarafOlum = {};

for (const fn of dosyalar) {
    const t = (JSON.parse(fs.readFileSync(path.join(DIZIN, fn), 'utf8')).replay || {}).telemetry || {};
    for (const e of (t.combatEvents || [])) {
        toplam++;
        const k = e.kind || e.type || '?';
        kind[k] = (kind[k] || 0) + 1;
        const lethal = (e.lethal === true) || (e.hpAfter != null && e.hpAfter <= 0);
        if (!lethal) continue;
        olumcul++;
        const at = (e.attackerType != null) ? e.attackerType : null;
        const anahtar = k + (at != null ? ('|tip' + at) : '');
        olduren[anahtar] = (olduren[anahtar] || 0) + 1;
        if (e.targetSide) tarafOlum[e.targetSide] = (tarafOlum[e.targetSide] || 0) + 1;
        if (e.attackerX != null && e.targetX != null) {
            const d = Math.hypot(e.attackerX - e.targetX, e.attackerY - e.targetY);
            mesafeler.push(d); mesafeliOlum++;
            if (d <= YAKIN) yakinUzak.yakin++; else yakinUzak.uzak++;
        }
    }
}

const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const yuzde = (n, t) => t ? ('%' + (n / t * 100).toFixed(1)) : '-';
const dizS = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))]); };

console.log('OLDUREN KAYNAK — ' + dosyalar.length + ' kayit, ' + toplam + ' muharebe olayi, ' + olumcul + ' OLUMCUL');
console.log('');
console.log('  ══ OLAY TURU DAGILIMI (tum olaylar) ══');
for (const [k, v] of Object.entries(kind).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log('    ' + k.padEnd(24) + String(v).padStart(7) + '  ' + yuzde(v, toplam));
}
console.log('');
console.log('  ══ OLDUREN OLAY TURU (yalniz olumcul) ══');
const oldTur = {};
for (const [k, v] of Object.entries(olduren)) { const t = k.split('|')[0]; oldTur[t] = (oldTur[t] || 0) + v; }
for (const [k, v] of Object.entries(oldTur).sort((a, b) => b[1] - a[1])) {
    console.log('    ' + k.padEnd(24) + String(v).padStart(7) + '  ' + yuzde(v, olumcul));
}
console.log('');
if (mesafeliOlum) {
    console.log('  ══ OLDURME MESAFESI (' + mesafeliOlum + ' olumcul olayda konum var) ══');
    console.log('    ortalama ' + Math.round(ort(mesafeler)) + 'px    medyan ' + dizS(mesafeler, 0.5) +
        '    %25 ' + dizS(mesafeler, 0.25) + '    %75 ' + dizS(mesafeler, 0.75) + '    %90 ' + dizS(mesafeler, 0.90));
    console.log('    <=' + YAKIN + 'px (yerel cember ICI) : ' + yakinUzak.yakin + '  ' + yuzde(yakinUzak.yakin, mesafeliOlum));
    console.log('    > ' + YAKIN + 'px (cember DISI)      : ' + yakinUzak.uzak + '  ' + yuzde(yakinUzak.uzak, mesafeliOlum));
    console.log('');
    console.log('    KIYAS: kuvvet-dagilimi.js olum aninda 600px cemberde ort. 3.0 dusman saymisti.');
    console.log('           Cember DISI olum orani yuksekse "yerel ustunluk" kaldiraci YANLIS katmandir.');
} else {
    console.log('  ══ OLDURME MESAFESI — HESAPLANAMADI ══');
    console.log('    combatEvents kaydinda attackerX/targetX yok (eski sema). Mesafe kirilimi icin');
    console.log('    tezgahta yeni kosu gerekir; bu kayitlardan TURETILEMEZ (uydurmuyoruz).');
}
console.log('');
console.log('  ══ OLEN TARAF ══   ' + Object.entries(tarafOlum).map(([k, v]) => k + ' ' + v).join('   '));
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'olduren-kaynak.json'),
    JSON.stringify({ kind, olduren, oldTur, mesafeOrt: Math.round(ort(mesafeler)), yakinUzak, olumcul }, null, 1));
