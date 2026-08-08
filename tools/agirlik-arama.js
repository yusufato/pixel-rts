// AGIRLIK TABLOSU ARAMASI — SIRA 2
//
// NEDEN SIMDI ANLAMLI: tahsis metrigi bugun duzeltilene kadar pahali sinifin agirliklari HICBIR ISE
// YARAMIYORDU (nasilsa satin alinamiyorlardi). Yani BATTLE_DEPLOY_COMBAT_WEIGHTS'teki sayilar
// yazildiklarindan beri hic sinanmadi. Artik tahsis onlara uydugu icin ilk kez olculebilirler.
//
// TASARIM KARARI: yeni bayrak EKLENMEZ. Agirliklar dosyada gecici olarak degistirilir, cocuk surecte
// olculur, sonra GERI ALINIR -> uretim kodunda sifir kalinti. (Bugun tam da birikmis bayrak/yama
// katmanlarini temizledik; arama ugruna yenisini eklemek celiski olurdu.)
//
// OLCUT: kullanicinin 6 ordusu (sabit, dissal). ARAMA ilk 4'unde, AYRIK TEST son 2'sinde.
// Hedef: insan kompozisyonunun avantajini DUSURMEK (bugun +596 -> +76; daha da dusebilir mi?)
const fs = require('fs'); const path = require('path');
const { execFileSync } = require('child_process');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const TOHUM = Number(arg('--tohum', 3)) || 3;
const KAYNAK = path.join(__dirname, '..', 'js', 'BattleDeployment.js');
const ARA = path.join(__dirname, '..', 'qa-runtime', 'agirlik-arama-ARA.json');
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };

const ORIJ = fs.readFileSync(KAYNAK, 'utf8');
const BAS = ORIJ.indexOf('const BATTLE_DEPLOY_COMBAT_WEIGHTS = Object.freeze({');
const SON = ORIJ.indexOf('});', BAS) + 3;
if (BAS < 0) { console.error('agirlik tablosu bulunamadi'); process.exit(1); }
const TABLO_METIN = ORIJ.slice(BAS, SON);
// T.X: 0.14 satirlarini cikar
const AGIRLIK = {};
for (const m of TABLO_METIN.matchAll(/\[T\.([A-Z_]+)\]:\s*([0-9.]+)/g)) AGIRLIK[m[1]] = Number(m[2]);
yaz('AGIRLIK ARAMASI — taban tablo (' + Object.keys(AGIRLIK).length + ' tip):');
yaz('  ' + Object.entries(AGIRLIK).map(([k, v]) => k + ' ' + v).join('  '));
yaz('');

function tabloYaz(ag) {
    const satir = Object.entries(ag).map(([k, v]) => '    [T.' + k + ']: ' + v).join(',\n');
    const yeni = 'const BATTLE_DEPLOY_COMBAT_WEIGHTS = Object.freeze({\n' + satir + '\n});';
    fs.writeFileSync(KAYNAK, ORIJ.slice(0, BAS) + yeni + ORIJ.slice(SON));
}
function geriAl() { fs.writeFileSync(KAYNAK, ORIJ); }

function olc(etiket, orduAtla, orduN) {
    const out = execFileSync(process.execPath, ['--max-old-space-size=6144',
        path.join(__dirname, 'ordu-takasi.js'), '--tohum', String(TOHUM),
        '--orduatla', String(orduAtla), '--ordu', String(orduN)],
        { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
    const m = out.match(/SAF AVANTAJI[\s\S]*?\n\s+([+-]?\d+)\s+std\.hata\s+(\d+)\s+t\s+([+-]?[\d.]+)/);
    if (!m) return null;
    return { avantaj: Number(m[1]), se: Number(m[2]), t: Number(m[3]) };
}

// ── ADAYLAR: bugun olculen sinyallere gore (doz taramasi + %0 kalanlar) ──
const CARP = [
    ['MLRS', 1.8], ['MLRS', 0.5], ['ATTACK_HELO', 1.8], ['DRONE_OPERATOR', 1.8],
    ['BALLISTIC', 3.0], ['SAM', 0.5], ['INFANTRY', 0.5], ['ANTI_TANK', 0.6],
    ['ARTILLERY', 1.6], ['COMMANDO', 1.5], ['MECH_INFANTRY', 0.5], ['RECON', 0.6],
    ['UCAV', 1.8], ['SUPPLY', 1.4], ['ARMOR', 0.6], ['TANK_HUNTER', 1.5]
];

const t0 = Date.now();
const sonuc = [];
try {
    const taban = olc('TABAN', 0, 4);
    yaz('  TABAN (arama kumesi, 4 ordu): insan avantaji ' + (taban ? taban.avantaj + '  t ' + taban.t : 'OLCULEMEDI'));
    yaz('');
    yaz('  ' + 'aday'.padEnd(28) + 'insan avantaji'.padStart(15) + 't'.padStart(8) + 'kazanc'.padStart(9) + '   ilerleme');
    for (let i = 0; i < CARP.length; i++) {
        const [tip, c] = CARP[i];
        if (AGIRLIK[tip] == null) { yaz('  ' + (tip + ' x' + c).padEnd(28) + '  (tabloda yok, atlandi)'); continue; }
        const ag = { ...AGIRLIK }; ag[tip] = Math.round(AGIRLIK[tip] * c * 10000) / 10000;
        tabloYaz(ag);
        const r = olc(tip, 0, 4);
        geriAl();
        if (!r) { yaz('  ' + (tip + ' x' + c).padEnd(28) + '  OLCULEMEDI'); continue; }
        const kazanc = taban ? (taban.avantaj - r.avantaj) : 0;   // + = insan avantaji DUSTU = iyi
        sonuc.push({ tip, c, ...r, kazanc });
        const gec = (Date.now() - t0) / 60000;
        yaz('  ' + (tip + ' x' + c).padEnd(28) + String(r.avantaj).padStart(15) + r.t.toFixed(2).padStart(8) +
            ((kazanc > 0 ? '+' : '') + Math.round(kazanc)).padStart(9) +
            '   [' + (i + 1) + '/' + CARP.length + '] ' + Math.round(gec) + 'dk gecti, ~' +
            Math.round(gec / (i + 1) * (CARP.length - i - 1)) + 'dk kaldi');
        fs.writeFileSync(ARA, JSON.stringify({ taban, sonuc }, null, 1));
    }
    yaz('');
    yaz('  ── SIRALAMA (insan avantajini en cok dusuren) ──');
    for (const s of sonuc.slice().sort((a, b) => b.kazanc - a.kazanc).slice(0, 8))
        yaz('    ' + ((s.kazanc > 0 ? '+' : '') + Math.round(s.kazanc)).padStart(7) + '   ' + s.tip + ' x' + s.c);
    yaz('');
    yaz('  NOT: bu ARAMA kumesi (ilk 4 ordu). Kazananlar AYRIK TEST kumesinde (son 2 ordu) dogrulanmali.');
} finally { geriAl(); yaz('  [agirlik tablosu GERI ALINDI]'); }
