'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  POLİTİKA VERİSİ — PARALEL. `politika-veri.js`'i N işçiye böler.
//
//  NEDEN ZORUNLU: arama ~1 CPU-sn / oyun-sn harcıyor. 360sn'lik bir maç iki tarafta
//  aramayla ~11 dk. Tek süreçte 64 maç ≈ 12 saat. İşçilere bölünce ≈ 1.5 saat.
//
//  TOHUM AYRIMI (sızıntı kapısı): eğitim verisi 120000+ bandından toplanır.
//  Ölçüm kapısı (`tools/rol-dengesi.js`) 100000+ ve 150000+ kullandı. Bantlar AYRIK,
//  yani politika hiçbir zaman üzerinde puanlanacağı haritada eğitilmez.
//  (Makine havuzu: CYBORG 100000-199999 — ../docs/battle-ai/operations/IKI-MAKINE.md)
//
//    node tools/politika-veri-paralel.js --mac 64 --isci 8 --taraf iki
// ═══════════════════════════════════════════════════════════════════════════
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const ROOT = path.resolve(__dirname, '..');
const HEDEF = path.join(ROOT, 'qa-runtime', 'politika');

// Her işçi kendi tezgâhını kurar (~400MB). RAM biterse makine kilitlenir (yaşanmış).
function varsayilanIsci() {
    const cek = Math.max(1, (os.cpus() || []).length - 2);
    const ram = Math.max(1, Math.floor((os.freemem() / 1e9) / 0.6));
    return Math.max(1, Math.min(cek, ram, 8));
}

const MAC = Math.max(1, Number(arg('--mac', 64)) || 64);
const ISCI = Math.max(1, Number(arg('--isci', varsayilanIsci())) || 1);
const TOHUM0 = Number(arg('--tohum0', 120000)) || 120000;
const TARAF = arg('--taraf', 'iki');
const MAX_TIK = Number(arg('--maxtik', 7200)) || 7200;
// Ag on suzgeci: canli kiple AYNI olmali (bkz. politika-veri.js aciklamasi)
const AG_ADAY = Number(arg('--agaday', 5));
const DERIN = Number(arg('--derin', 0));

fs.mkdirSync(HEDEF, { recursive: true });

// Serpiştirmeden BLOK böl: her işçi bitişik bir tohum aralığı alır → parça dosyaları
// hangi haritalardan geldiği okunabilir kalır (sızıntı denetimi için gerekir).
const pay = Math.ceil(MAC / ISCI);
const isler = [];
for (let i = 0; i < ISCI; i++) {
    const bas = TOHUM0 + i * pay;
    const adet = Math.min(pay, TOHUM0 + MAC - bas);
    if (adet > 0) isler.push({ idx: i, tohum0: bas, mac: adet });
}

console.log('POLITIKA VERISI — PARALEL');
console.log('  mac: ' + MAC + '   isci: ' + isler.length + '   taraf: ' + TARAF + '   LA_AG_ADAY: ' + AG_ADAY + '   LA_DERIN: ' + (DERIN||'vars'));
console.log('  tohum bandi: ' + TOHUM0 + '..' + (TOHUM0 + MAC - 1) + '  (olcum bandi 100000+/150000+ ile AYRIK)');
console.log('  cikti: ' + HEDEF);
console.log('');

const t0 = Date.now();
let biten = 0;
const sonuc = [];

function isciKos(is) {
    return new Promise((cozum) => {
        const out = path.join(HEDEF, 'veri-' + is.idx + '.jsonl');
        const args = [path.join(ROOT, 'tools', 'politika-veri.js'),
            '--mac', String(is.mac), '--tohumofs', String(is.tohum0),
            '--taraf', TARAF, '--maxtik', String(MAX_TIK), '--agaday', String(AG_ADAY),
            ...(DERIN > 0 ? ['--derin', String(DERIN)] : []),
            '--out', out];
        const p = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        let son = '';
        p.stdout.on('data', (d) => { son = String(d).trim().split('\n').pop() || son; });
        p.stderr.on('data', (d) => { const s = String(d).trim(); if (s) console.log('  [' + is.idx + '] ! ' + s.slice(0, 200)); });
        p.on('close', (kod) => {
            biten++;
            const dk = ((Date.now() - t0) / 60000).toFixed(1);
            const sat = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).length : 0;
            console.log('  isci ' + is.idx + ' bitti (kod ' + kod + ')   ' + sat + ' karar   ' +
                biten + '/' + isler.length + ' isci   ' + dk + 'dk');
            sonuc.push({ idx: is.idx, out, sat, kod });
            cozum();
        });
    });
}

Promise.all(isler.map(isciKos)).then(() => {
    const toplam = sonuc.reduce((a, b) => a + b.sat, 0);
    const cokenler = sonuc.filter(s => s.kod !== 0);
    console.log('');
    console.log('  TOPLAM: ' + toplam + ' karar, ' + sonuc.length + ' parca dosyasi');
    if (cokenler.length) console.log('  ! COKEN ISCI: ' + cokenler.map(s => s.idx).join(', ') + ' — veri EKSIK');
    console.log('  sure: ' + ((Date.now() - t0) / 60000).toFixed(1) + 'dk');
    console.log('');
    console.log('  sonraki: python tools/politika-egit-gpu.py --veri qa-runtime/politika');
});
