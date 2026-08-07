// GECE KOSUSU — beonai odul sinyali icin durum-deger verisi topla, sonra GPU'da egit.
// Kullanici: "defteri beonai'ye baglayip sabaha (8-9 saat) calisacak kadar mac yapacak."
//
// YAPI:
//   FAZ 1  N isci paralel `tools/durum-veri.js` kosar (tohum havuzlari AYRIK: --tohumofs).
//          Her isci kendi .jsonl dosyasina yazar. Kredi defteri ACIK -> her anlik goruntude
//          21 kanalin taraf-farki, her mac sonunda taraf-basi kanal toplamlari.
//   FAZ 2  Tum dosyalar birlestirilir, `tools/durum-egit-gpu.py` ile deger agi egitilir.
//
// OLCULEN HIZ (tahmin DEGIL): 0.29 mac/sn tek cekirdek, ~34.5 anlik goruntu/mac, ~4 KB/goruntu
// -> isci basi saatte ~1044 mac ~144 MB. F1 KURALI: ilk 10 dakikada GERCEK hiz loglanir ve
// tahminle karsilastirilir; sapma varsa dosyada gorulur.
const { spawn } = require('node:child_process');
const os = require('node:os');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const ISCI = Math.max(1, Number(arg('--isci', 6)) || 6);
const SAAT = Number(arg('--saat', 5)) || 5;               // FAZ 1 hedef suresi
const EGIT = !process.argv.includes('--egitme');           // FAZ 2 atlanabilir
const DIZIN = arg('--dizin', 'qa-runtime/gece');
// OLCULDU (F1 kurali, ilk 2 dakikada yakalandi): tek isci 0.29 mac/sn, ama 6 isci paralelde
// isci basi 0.155'e duser (paralel verim ~%53 — bellek/GC ve tek jsdom baglami basina dusen
// CPU payi). Boyutlandirma GERCEKLESEN hizla yapilir, tek-cekirdek hiziyla DEGIL.
const HIZ = Number(arg('--hiz', 0.155));                   // isci basi GERCEKLESEN mac/sn
const MAC = Math.max(50, Math.round(HIZ * 3600 * SAAT));   // isci basi mac sayisi

fs.mkdirSync(DIZIN, { recursive: true });
const LOG = path.join(DIZIN, 'gece.log');
function log(m) {
    const s = '[' + new Date().toISOString().slice(11, 19) + '] ' + m;
    console.log(s); fs.appendFileSync(LOG, s + '\n');
}

log('GECE KOSUSU BASLADI — ' + ISCI + ' isci x ' + MAC + ' mac (hedef ~' + SAAT + ' saat)');
log('  beklenen toplam: ' + (ISCI * MAC) + ' mac, ~' + (ISCI * MAC * 0.138).toFixed(0) + ' MB');
log('  kredi defteri ACIK: 21 kanal (odul sinyali) her goruntude + mac sonunda');

const t0 = Date.now();
const cocuklar = [];
let biten = 0;

for (let i = 0; i < ISCI; i++) {
    const out = path.join(DIZIN, 'durum-' + i + '.jsonl');
    const c = spawn(process.execPath, ['tools/durum-veri.js',
        '--mac', String(MAC), '--tohumofs', String(i * MAC), '--out', out],
        { stdio: ['ignore', 'pipe', 'pipe'] });
    c.stdout.on('data', d => {
        const t = d.toString().trim();
        if (t.includes('mac ')) log('  isci' + i + ': ' + t.split('\n').pop().trim());
    });
    c.stderr.on('data', d => log('  isci' + i + ' HATA: ' + d.toString().trim().slice(0, 200)));
    c.on('exit', code => {
        biten++;
        const dk = ((Date.now() - t0) / 60000).toFixed(1);
        log('  isci' + i + ' bitti (kod ' + code + ') — ' + dk + ' dk, ' + biten + '/' + ISCI);
        if (biten === ISCI) faz2();
    });
    cocuklar.push(c);
}

// F1 KURALI: ilk 10 dakikada GERCEK hizi olc ve tahminle karsilastir.
setTimeout(() => {
    let satir = 0, bayt = 0;
    for (let i = 0; i < ISCI; i++) {
        const f = path.join(DIZIN, 'durum-' + i + '.jsonl');
        if (!fs.existsSync(f)) continue;
        const st = fs.statSync(f); bayt += st.size;
        satir += fs.readFileSync(f, 'utf8').split('\n').length - 1;
    }
    const dk = (Date.now() - t0) / 60000;
    const macTah = satir / 34.5;
    log('HIZ KONTROLU (' + dk.toFixed(1) + ' dk): ' + satir + ' goruntu ~ ' + macTah.toFixed(0) + ' mac, ' +
        (bayt / 1048576).toFixed(0) + ' MB');
    log('  gerceklesen: ' + (macTah / (dk * 60)).toFixed(2) + ' mac/sn (toplam ' + ISCI + ' isci)   ' +
        'beklenen ' + (HIZ * ISCI).toFixed(2));
    log('  bu hizla ' + SAAT + ' saatte ~' + Math.round(macTah / dk * 60 * SAAT) + ' mac');
}, 10 * 60 * 1000);

// RAM IZLEME (kullanici: "RAM sorunu var"): makinede 15.7 GB var, ~7.4 GB bos. 12 isci sinirda
// calisir. Bellek dusmeye baslarsa SABAH LOGDA GORULUR — kor uyanmaktansa kayitli uyanmak.
// (Senkron yazmaya gecildigi icin veri artik bellekte birikmiyor; bu izleme onun DOGRULAMASI.)
setInterval(() => {
    const bosGB = os.freemem() / 1073741824;
    let bayt = 0, satir = 0;
    for (let i = 0; i < ISCI; i++) {
        const f = path.join(DIZIN, 'durum-' + i + '.jsonl');
        if (fs.existsSync(f)) bayt += fs.statSync(f).size;
    }
    const dk = (Date.now() - t0) / 60000;
    const macTah = bayt / 220000;   // ~220 KB/mac (olculdu)
    log('DURUM ' + dk.toFixed(0) + ' dk: ~' + macTah.toFixed(0) + ' mac, ' +
        (bayt / 1073741824).toFixed(2) + ' GB, bos RAM ' + bosGB.toFixed(1) + ' GB, ' +
        (macTah / (dk * 60)).toFixed(2) + ' mac/sn' + (bosGB < 1.5 ? '   *** RAM KRITIK ***' : ''));
}, 15 * 60 * 1000);

function faz2() {
    const dk = ((Date.now() - t0) / 60000).toFixed(1);
    log('FAZ 1 BITTI — ' + dk + ' dk');
    const parcalar = [];
    for (let i = 0; i < ISCI; i++) {
        const f = path.join(DIZIN, 'durum-' + i + '.jsonl');
        if (fs.existsSync(f)) parcalar.push(f);
    }
    const hepsi = path.join(DIZIN, 'durum-hepsi.jsonl');
    log('  birlestiriliyor: ' + parcalar.length + ' dosya -> ' + hepsi);
    const w = fs.createWriteStream(hepsi, { flags: 'w' });
    let toplam = 0;
    for (const f of parcalar) {
        const d = fs.readFileSync(f, 'utf8');
        toplam += d.split('\n').length - 1;
        w.write(d);
    }
    w.end();
    w.on('finish', () => {
        log('  toplam ' + toplam + ' anlik goruntu (' + (fs.statSync(hepsi).size / 1048576).toFixed(0) + ' MB)');
        if (!EGIT) { log('GECE KOSUSU BITTI (egitim atlandi)'); return; }
        log('FAZ 2: GPU egitimi basliyor — kapi rho >= 0.45 ve kazanan ayrimi >= %70');
        const py = spawn('python', ['tools/durum-egit-gpu.py', '--veri', hepsi,
            '--kaydet', path.join(DIZIN, 'durum-model.pt'), '--maxsatir', '300000'], { stdio: ['ignore', 'pipe', 'pipe'] });
        py.stdout.on('data', d => log('  egitim: ' + d.toString().trim()));
        py.stderr.on('data', d => log('  egitim HATA: ' + d.toString().trim().slice(0, 300)));
        py.on('exit', c => log('GECE KOSUSU BITTI — egitim kodu ' + c + ', toplam ' +
            ((Date.now() - t0) / 3600000).toFixed(1) + ' saat'));
    });
}
