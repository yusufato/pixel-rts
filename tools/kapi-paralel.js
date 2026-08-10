// PARALEL KAPI — intel4-pro vs intel4, ISCI SAYISI KADAR PARCADA.
//
// NEDEN VAR (bugunun asil bulgusu): mac marji std ≈ 2770. 48 maclik kapinin ayirt edebildigi en kucuk
// etki ≈ ±800, oysa aranan etkiler +200..+500 bandinda. Yani her 48-maclik kapi ~8 KAT GUCSUZDU ve
// bu yuzden pozitif cikan her sey (massMatch %63, helo +493, doktrin %58) dogrulamada COKTU.
// +400'luk bir etkiyi %80 gucle yakalamak icin gereken mac sayisi:  n ≈ (2.8 × 2770 / 400)² ≈ 376.
// Tek surecte 376 mac ~2 saat. Bu arac tohumlari isçilere boler → karar verilebilir kapi.
//
// TASARIM: her isci `pro-vs-intel4.js --tohumlar <alt-kume> --json <dosya>` kosar (AYNI kod yolu,
// yani sonuc tek-surecli kosuyla BIREBIR karsilastirilabilir). Parent yalniz birlestirir.
// DETERMINIZM: her mac kendi tohumuyla bagimsiz; boluntu sonucu DEGISTIRMEZ (kanit: --dogrula).
//
// Kullanim:
//   node tools/kapi-paralel.js --tohum 96 --atla 0 --isci 8 [--kapat a,b] [--ac c] [--doktrin N]
//                              [--somurucu ad] [--ayar "X=1"] [--etiket ad]
//   node tools/kapi-paralel.js --dogrula        (8 tohum: paralel == tek-surecli mi?)
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const ROOT = path.resolve(__dirname, '..');
const GECICI = path.join(ROOT, 'qa-runtime', 'kapi-paralel');

// RAM'e gore isci tavani: her isci kendi jsdom tezgahini kurar (~250-400MB). Bellek biterse
// makine kilitlenir (yasanmis: 12 isci donma). Varsayilan cekirdek-2 ve RAM/1.5GB'in kucugu.
function varsayilanIsci() {
    const cek = Math.max(1, (os.cpus() || []).length - 2);
    const ram = Math.max(1, Math.floor((os.totalmem() / 1e9) / 1.5));
    return Math.max(1, Math.min(cek, ram, 10));
}

const N = Math.max(1, Number(arg('--tohum', 96)) || 96);
const ATLA = Math.max(0, Number(arg('--atla', 0)) || 0);
const ISCI = Math.max(1, Number(arg('--isci', varsayilanIsci())) || 1);
const ETIKET = arg('--etiket', 'kapi');
const DOGRULA = process.argv.includes('--dogrula');

const HAVUZ = []; for (let i = 0; i < 4096; i++) HAVUZ.push(100000 + i * 137);   // havuz 512 iken --atla 448 sessizce 64 tohuma dusuyordu (n=1024 sanip 256 kostum)
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + (DOGRULA ? 8 : N));

// Kosucuya AYNEN aktarilacak kol-tanimlayici bayraklar (tek degisken kurali: kollar yalniz bunlarla ayrilir)
const GECIRILEN = ['--kapat', '--ac', '--doktrin', '--somurucu', '--ayar', '--butce'];
const EKLER = [];
for (const bayrak of GECIRILEN) {
    const i = process.argv.indexOf(bayrak);
    if (i >= 0 && process.argv[i + 1] !== undefined) EKLER.push(bayrak, process.argv[i + 1]);
}

function parcala(liste, k) {
    const parcalar = Array.from({ length: k }, () => []);
    liste.forEach((t, i) => parcalar[i % k].push(t));   // serpistir: uzun/kisa maclar isçilere esit dagilsin
    return parcalar.filter(p => p.length);
}

function isciKos(tohumlar, idx) {
    return new Promise((cozum) => {
        const out = path.join(GECICI, ETIKET + '-' + idx + '.json');
        const args = [path.join(ROOT, 'tools', 'pro-vs-intel4.js'),
            '--tohumlar', tohumlar.join(','), '--json', out, ...EKLER];
        const p = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        let hata = '';
        p.stderr.on('data', d => { hata += d.toString(); });
        p.stdout.on('data', () => {});   // isci ciktisi yutulur; birlestirme JSON'dan
        p.on('close', (kod) => {
            if (kod !== 0) { console.log('  ISCI ' + idx + ' HATA (kod ' + kod + '): ' + hata.slice(0, 300)); return cozum([]); }
            try { cozum(JSON.parse(fs.readFileSync(out, 'utf8'))); }
            catch (e) { console.log('  ISCI ' + idx + ' JSON okunamadi: ' + e.message); cozum([]); }
        });
    });
}

function ozetle(kayitlar) {
    const marj = kayitlar.map(k => k.marj);
    const n = marj.length || 1;
    const o = marj.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(marj.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, n - 1));
    const se = sd / Math.sqrt(n);
    const galip = kayitlar.filter(k => k.proGalip).length;
    return { n, galip, yuzde: Math.round(galip / n * 100), marj: Math.round(o), sd: Math.round(sd),
        se: Math.round(se), t: se ? +(o / se).toFixed(2) : 0 };
}

(async () => {
    fs.mkdirSync(GECICI, { recursive: true });
    const parcalar = parcala(TOHUMLAR, ISCI);
    const bas = Date.now();
    console.log('PARALEL KAPI — ' + TOHUMLAR.length + ' tohum x 4 = ' + (TOHUMLAR.length * 4) + ' mac, ' +
        parcalar.length + ' isci');
    if (EKLER.length) console.log('  kol: ' + EKLER.join(' '));
    const sonuclar = await Promise.all(parcalar.map((p, i) => isciKos(p, i)));
    const kayitlar = sonuclar.flat();
    const sn = Math.round((Date.now() - bas) / 1000);
    if (!kayitlar.length) { console.log('  SONUC YOK (isçiler basarisiz)'); process.exit(1); }
    const z = ozetle(kayitlar);
    // GUC: bu n ile %80 gucle yakalanabilen en kucuk etki (iki-yonlu, alfa 0.05)
    const mde = Math.round(2.8 * z.sd / Math.sqrt(z.n));
    console.log('');
    console.log('  ══ PRO LEHINE ESLESTIRILMIS MARJ ══');
    console.log('     ' + (z.marj > 0 ? '+' : '') + z.marj + '   std.hata ' + z.se + '   t ' + z.t +
        '   n=' + z.n + '   lehte ' + kayitlar.filter(k => k.marj > 0).length + '/' + z.n);
    console.log('  ══ GALIBIYET: pro ' + z.galip + '/' + z.n + ' = %' + z.yuzde + '   (hedef: 44/48 = %92) ══');
    console.log('  ── GUC: std ' + z.sd + ' → bu n ile %80 gucle yakalanabilen en kucuk etki ≈ ±' + mde);
    console.log('  ── sure ' + sn + ' sn  (' + Math.round(kayitlar.length / Math.max(1, sn) * 60) + ' mac/dk)');
    if (DOGRULA) {
        console.log('');
        console.log('  DOGRULAMA: ayni 8 tohum tek surecte kosuluyor (paralel bolunme sonucu degistirmemeli)...');
        const tek = await new Promise(c => {
            const out = path.join(GECICI, 'dogrula-tek.json');
            const p = spawn(process.execPath, [path.join(ROOT, 'tools', 'pro-vs-intel4.js'),
                '--tohumlar', TOHUMLAR.join(','), '--json', out, ...EKLER], { cwd: ROOT, stdio: 'ignore' });
            p.on('close', () => { try { c(JSON.parse(fs.readFileSync(out, 'utf8'))); } catch (e) { c([]); } });
        });
        const anahtar = k => k.tohum + '|' + k.kirmiziSaldiran + '|' + k.proKirmizi;
        const harita = new Map(kayitlar.map(k => [anahtar(k), k.marj]));
        let sapan = 0;
        for (const k of tek) if (harita.get(anahtar(k)) !== k.marj) sapan++;
        console.log('  sapan mac: ' + sapan + '/' + tek.length + (sapan ? '   *** PARALEL BOLUNME SONUCU DEGISTIRIYOR ***' : '   BIREBIR AYNI ✓'));
    }
    try { for (const f of fs.readdirSync(GECICI)) if (f.startsWith(ETIKET + '-')) fs.unlinkSync(path.join(GECICI, f)); } catch (e) {}
})();
