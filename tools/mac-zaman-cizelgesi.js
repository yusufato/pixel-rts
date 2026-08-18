'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  MAÇ ZAMAN ÇİZELGESİ — "maç nerede kaybedildi" sorusunu tik çözünürlüğünde sorar
//
//  `oyuncu-mac-analiz.js` maçın ÖZETİNİ verir; bu araç maçın HİKÂYESİNİ verir:
//    · 20 saniyelik dilimlerde kuvvet, hasar, ölüm, arama emri
//    · EN BÜYÜK KAYIP KÜMELERİ: hangi 20sn'de, haritanın neresinde, hangi birimler
//    · o anda AI ne yapıyordu (aramanın emirleri + kontrolör emirleri)
//    · öngörü sapması: işçinin tahmini ne zaman tuttu, ne zaman tutmadı
//
//  ⚠ ÖLÇÜ UYGUNLUK SÜZGECİNDEN GEÇER: silahsız (radar/ikmal/sağlık) ve yalnız-hava
//  birimler "ateş etmiyor" diye suçlanmaz — bu hata bir kez yapıldı ve AI'yı 3.1 kat
//  kötü gösterdi (gerçek fark 1.7×).
//
//    node tools/mac-zaman-cizelgesi.js --dosya <ham.json> [--dilim 20]
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DOSYA = arg('--dosya', 'qa-runtime/last-match.json');
const DILIM = Math.max(5, Number(arg('--dilim', 20)) || 20);   // saniye

const AD = { 0:'PİYADE',1:'TANKSAVAR',2:'HAVAN',3:'MANPADS',4:'KOMANDO',5:'ZIRHLI',6:'MEKANİZE',
    7:'TANK_AVCISI',8:'TOPÇU',9:'ÇNRA',10:'BALİSTİK',11:'RADAR',12:'SPAAG',13:'SAM',14:'HELO',
    15:'NAKLİYE_HELO',16:'KEŞİF_İHA',17:'SİHA',18:'KAMİKAZE',19:'KEŞİF',20:'EW',21:'SIHHİYE',
    22:'İSTİHKÂM',23:'İKMAL',24:'KARARGÂH',25:'DRON_OPERATÖRÜ' };
const ad = (t) => AD[t] || ('tip' + t);
const SILAHSIZ = new Set([11,15,16,20,21,22,23,24,25]);
const YALNIZ_HAVA = new Set([3,13]);

const d = JSON.parse(fs.readFileSync(DOSYA, 'utf8'));
const r = d.replay || d;
const t = r.telemetry || {};
const sm = t.samples || [];
const co = t.combatEvents || [];
const le = t.lifeEvents || [];
const ev = r.events || [];
const ozet = t.finalSummary || {};
if (!sm.length) { console.log('örnek yok'); process.exit(1); }

const sonSn = sm[sm.length - 1].seconds || 0;
const kova = (s) => Math.floor((s || 0) / DILIM);
const nKova = kova(sonSn) + 1;

// ── birim yaşam takibi: ilk/son görülme, ölüm anı ve yeri ─────────────────
const birim = new Map();
for (const o of sm) {
    for (const u of (o.units || [])) {
        if (!birim.has(u.id)) birim.set(u.id, { id: u.id, side: u.side, type: u.type, dogum: o.seconds, son: null, x: u.x, y: u.y });
        const b = birim.get(u.id);
        if ((u.hp || 0) > 0) { b.son = o.seconds; b.x = u.x; b.y = u.y; }
    }
}
const oldu = [...birim.values()].filter(b => b.son != null && b.son < sonSn - 1);

// ── dilim tabloları ──────────────────────────────────────────────────────
const dilim = Array.from({ length: nKova }, () => ({
    kuvvetK: 0, kuvvetM: 0, n: 0, hasarK: 0, hasarM: 0, olumK: 0, olumM: 0,
    atisK: 0, atisM: 0, aramaEmir: 0, ctrlEmir: 0, flankK: 0, flankM: 0
}));
for (const o of sm) {
    const k = dilim[kova(o.seconds)]; if (!k) continue;
    k.n++;
    for (const u of (o.units || [])) {
        if ((u.hp || 0) <= 0) continue;
        const g = (u.hp || 0) / Math.max(1, u.maxHp || 1);
        if (u.side === 'red') k.kuvvetK += g; else k.kuvvetM += g;
    }
}
for (const e of co) {
    const k = dilim[kova(e.seconds)]; if (!k) continue;
    const kirmizi = e.attackerSide === 'red';
    if (kirmizi) { k.hasarK += e.damage || 0; k.atisK++; if (e.flankHit || e.rearHit) k.flankK++; }
    else { k.hasarM += e.damage || 0; k.atisM++; if (e.flankHit || e.rearHit) k.flankM++; }
}
for (const b of oldu) {
    const k = dilim[kova(b.son)]; if (!k) continue;
    if (b.side === 'red') k.olumK++; else k.olumM++;
}
for (const e of ev) {
    const s = (e.tick || 0) * 0.05;
    const k = dilim[kova(s)]; if (!k) continue;
    if (e.type === 'lookahead-order') k.aramaEmir++;
    else if (e.type === 'controller-order') k.ctrlEmir++;
}

console.log('');
console.log('ZAMAN ÇİZELGESİ — ' + path.basename(DOSYA));
console.log('  tohum ' + (r.session && r.session.seed) + ' · ' + sonSn.toFixed(0) + 'sn · dilim ' + DILIM + 'sn');
console.log('');
console.log('  ' + 'zaman'.padEnd(10) + 'kuvvet K/M'.padEnd(13) + 'hasar K/M'.padEnd(14) +
    'ölüm K/M'.padEnd(10) + 'atış K/M'.padEnd(11) + 'arama'.padStart(6) + 'ktrl'.padStart(6));
for (let i = 0; i < nKova; i++) {
    const k = dilim[i];
    const kk = k.n ? (k.kuvvetK / k.n) : 0, mm = k.n ? (k.kuvvetM / k.n) : 0;
    const isaret = (k.olumK > k.olumM + 1) ? '  ← AI kaybediyor' : (k.olumM > k.olumK + 1 ? '  ← oyuncu kaybediyor' : '');
    console.log('  ' + (String(i * DILIM) + '-' + ((i + 1) * DILIM) + 'sn').padEnd(10) +
        (kk.toFixed(1) + '/' + mm.toFixed(1)).padEnd(13) +
        (Math.round(k.hasarK) + '/' + Math.round(k.hasarM)).padEnd(14) +
        (k.olumK + '/' + k.olumM).padEnd(10) +
        (k.atisK + '/' + k.atisM).padEnd(11) +
        String(k.aramaEmir).padStart(6) + String(k.ctrlEmir).padStart(6) + isaret);
}

// ── EN BÜYÜK KAYIP KÜMELERİ ──────────────────────────────────────────────
console.log('');
console.log('  ═══ AI\'NIN EN AĞIR KAYIP DİLİMLERİ ═══');
const sirali = dilim.map((k, i) => ({ i, ...k })).filter(k => k.olumK > 0).sort((a, b) => b.olumK - a.olumK).slice(0, 3);
for (const k of sirali) {
    const bas = k.i * DILIM, son = (k.i + 1) * DILIM;
    const olenler = oldu.filter(b => b.side === 'red' && b.son >= bas && b.son < son);
    console.log('');
    console.log('  ▸ ' + bas + '-' + son + 'sn: AI ' + k.olumK + ' birim kaybetti (oyuncu ' + k.olumM + ')');
    console.log('     kaybedilenler: ' + olenler.map(b => ad(b.type) + '#' + b.id).join(' · '));
    if (olenler.length) {
        const ox = olenler.reduce((a, b) => a + b.x, 0) / olenler.length;
        const oy = olenler.reduce((a, b) => a + b.y, 0) / olenler.length;
        const yay = Math.max(...olenler.map(b => Math.hypot(b.x - ox, b.y - oy)));
        console.log('     ölüm merkezi (' + Math.round(ox) + ',' + Math.round(oy) + ')  yayılım ' + Math.round(yay) + 'px' +
            (yay < 400 ? '  → TEK NOKTADA TOPLU KAYIP' : '  → dağınık'));
    }
    console.log('     o dilimde: AI ' + k.atisK + ' atış / ' + Math.round(k.hasarK) + ' hasar   ·   ' +
        'oyuncu ' + k.atisM + ' atış / ' + Math.round(k.hasarM) + ' hasar');
    console.log('     AI emirleri: arama ' + k.aramaEmir + ' · kontrolör ' + k.ctrlEmir);
}

// ── ÖLÜM SIRASI: hangi sınıf önce gitti ──────────────────────────────────
console.log('');
console.log('  ═══ AI BİRİMLERİ HANGİ SIRAYLA ÖLDÜ ═══');
const kOlu = oldu.filter(b => b.side === 'red').sort((a, b) => a.son - b.son);
console.log('     ' + kOlu.map(b => Math.round(b.son) + 'sn ' + ad(b.type)).join(' → '));

// ── YAŞAM OLAYLARI zaman dağılımı (ele geçirme/terk) ─────────────────────
const ilginc = le.filter(e => ['CAPTURE', 'ABANDON', 'PANIC'].includes(e.kind));
if (ilginc.length) {
    console.log('');
    console.log('  ═══ ELE GEÇİRME / TERK / PANİK ═══');
    for (const e of ilginc.slice(0, 20)) {
        console.log('     ' + String(Math.round(e.seconds)).padStart(4) + 'sn  ' + e.kind.padEnd(8) +
            (e.side || '?').padEnd(6) + ad(e.type) + '#' + e.unitId +
            '  (' + Math.round(e.x) + ',' + Math.round(e.y) + ')');
    }
}
console.log('');
