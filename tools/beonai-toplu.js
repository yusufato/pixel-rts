#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  beonai TOPLU VERİ ÜRETİMİ (paralel)
//
//  NEDEN AYRI ARAÇ: veri üretimi maç koşmaktan ÇOK daha pahalıdır. Bir karar noktası
//  = (aday sayısı + 1) × rollout ve gramer ~64 aday üretiyor. Ölçüldü (rollout 8sn):
//     karar başı ~5 sn, kararların ~%58'i "aktif" (temaslı) → kullanılabilir.
//  Yani "saatte 4300 maç" rakamı BU İŞ İÇİN GEÇERSİZDİR; tek süreçte saatte
//  ~720 karar → ~420 kullanılabilir örnek. Paralellik tek gerçek kaldıraç.
//
//  Bellek ve çekirdek disiplini caprazla.js ile AYNI: işçi sayısı KULLANILABİLİR
//  BELLEĞE göre seçilir (jsdom süreci ~450MB), canlı gözcü kritik seviyede keser,
//  kesilirse DÜŞEN TOHUMLAR açıkça raporlanır.
//
//  Kullanım:
//    node tools/beonai-toplu.js --seeds 24 --karar-araligi 700 --rollout 12
//    node tools/beonai-toplu.js --seeds 48 --workers 10 --out qa-runtime/beonai-veri.jsonl
// ═══════════════════════════════════════════════════════════════════════════
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function arg(ad, vars) { const i = process.argv.indexOf(ad); return i >= 0 ? process.argv[i + 1] : vars; }

// EĞİTİM havuzu = caprazla'nın TARAMA havuzu. Değerlendirme DIŞÖRNEK/FİNAL havuzlarında
// yapıldığı için eğitim verisi ile karar verisi ASLA aynı dünyalardan gelmez (sızıntı yok).
const EGITIM_TOHUM = [2024, 777, 909, 3141, 2718, 5150, 111, 222, 333, 444, 555, 666,
    1234, 4321, 8080, 6060, 7, 42, 99, 1001, 2222, 3333, 4444, 5555];

const SEEDARG = String(arg('--seeds', '12'));
const TOHUMLAR = SEEDARG.indexOf(',') >= 0
    ? SEEDARG.split(',').map(Number).filter(Boolean)
    : EGITIM_TOHUM.slice(0, Math.min(Number(SEEDARG) || 12, EGITIM_TOHUM.length));
const KARAR_ARALIGI = Math.max(100, Number(arg('--karar-araligi', 700)) || 700);
const ROLLOUT = Math.max(5, Number(arg('--rollout', 12)) || 12);
const MIN_TICK = Math.max(0, Number(arg('--min-tick', 500)) || 500);
const CIKTI = arg('--out', 'qa-runtime/beonai-veri.jsonl');
const GECICI = path.join('qa-runtime', 'beonai-parca');

function bosBellekGB() {
    if (process.platform !== 'win32') return os.freemem() / 1e9;
    try {
        const c = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
            '(Get-CimInstance Win32_PerfRawData_PerfOS_Memory).AvailableMBytes'],
            { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
        const mb = Number(String(c).trim());
        if (Number.isFinite(mb) && mb > 0) return mb / 1024;
    } catch (e) {}
    return os.freemem() / 1e9;
}

const ISCI_GB = Number(arg('--isci-gb', 0.5));
const REZERV_GB = Number(arg('--rezerv-gb', 2.5));
const KRITIK_GB = Number(arg('--kritik-gb', 1.0));
const BOS_GB = bosBellekGB();
const CEKIRDEK = os.cpus().length;
const TAVAN = Math.max(1, Math.min(Math.floor((BOS_GB - REZERV_GB) / ISCI_GB), CEKIRDEK - 3, TOHUMLAR.length));
const ISTENEN = Number(arg('--workers', TAVAN)) || TAVAN;
const ZORLA = process.argv.includes('--zorla');
let ISCI = Math.min(ISTENEN, TOHUMLAR.length);
if (ISCI > TAVAN && !ZORLA) {
    console.log('! ' + ISTENEN + ' işçi istendi, güvenli tavan ' + TAVAN + ' (boşta ' + BOS_GB.toFixed(1) + 'GB) → ' + TAVAN + ' kullanılıyor. Aşmak için --zorla.');
    ISCI = TAVAN;
}

// tohumları serpiştirerek dağıt (harita zorluğu işçiler arasında dengelensin)
const dilimler = Array.from({ length: ISCI }, () => []);
TOHUMLAR.forEach((s, i) => dilimler[i % ISCI].push(s));

fs.mkdirSync(GECICI, { recursive: true });
for (const f of fs.readdirSync(GECICI)) fs.unlinkSync(path.join(GECICI, f));

console.log('beonai TOPLU VERİ ÜRETİMİ');
console.log('  tohum : ' + TOHUMLAR.length + ' (eğitim havuzu — değerlendirme dışörneklem/final havuzlarında)');
console.log('  karar : her ' + KARAR_ARALIGI + ' tik (t≥' + MIN_TICK + '), rollout ' + ROLLOUT + 'sn');
console.log('  işçi  : ' + ISCI + ' süreç (çekirdek ' + CEKIRDEK + ', boşta ' + BOS_GB.toFixed(1) + 'GB, tavan ' + TAVAN + ')');
console.log('  UYARI : karar başı ~5sn ölçüldü; maliyet (aday+1)×rollout, gramer ~64 aday üretir.');
console.log('');

const t0 = Date.now();
const cocuklar = [];
let kesildi = false, ihlal = 0;
const gozcu = setInterval(() => {
    const b = bosBellekGB();
    if (b >= KRITIK_GB) { ihlal = 0; return; }
    if (++ihlal >= 3 && !kesildi) {
        kesildi = true;
        console.log('!! BELLEK KRİTİK (' + b.toFixed(2) + 'GB) — işçiler durduruluyor, o ana kadarki veri korunur.');
        for (const c of cocuklar) { try { c.kill(); } catch (e) {} }
    }
}, 6000);

const isler = dilimler.map((dilim, i) => new Promise(cozum => {
    if (!dilim.length) return cozum({ ok: true, bos: true });
    const dosya = path.join(GECICI, 'parca-' + i + '.jsonl');
    const c = spawn(process.execPath, [path.join(__dirname, 'beonai-uret.js'),
        '--tohum', dilim.join(','), '--karar-araligi', String(KARAR_ARALIGI),
        '--rollout', String(ROLLOUT), '--min-tick', String(MIN_TICK), '--out', dosya],
        { stdio: ['ignore', 'pipe', 'pipe'] });
    let son = '';
    c.stdout.on('data', d => { son += d.toString(); });
    c.stderr.on('data', () => {});
    c.on('close', kod => {
        const ok = kod === 0 && fs.existsSync(dosya);
        const sn = Math.round((Date.now() - t0) / 1000);
        const ozet = (son.match(/BEONAI_URET_OK[^\n]*/) || [''])[0];
        console.log('  işçi ' + i + ' bitti (' + dilim.length + ' tohum, ' + sn + 'sn)  ' + (ok ? ozet : '✗ KOD ' + kod));
        const ix = cocuklar.indexOf(c); if (ix >= 0) cocuklar.splice(ix, 1);
        cozum({ ok, dosya, tohum: dilim });
    });
    cocuklar.push(c);
}));

Promise.all(isler).then(sonuclar => {
    clearInterval(gozcu);
    const hedef = path.resolve(CIKTI);
    fs.mkdirSync(path.dirname(hedef), { recursive: true });
    const akis = fs.createWriteStream(hedef, { flags: 'a' });
    let satir = 0, aktif = 0;
    for (const r of sonuclar) {
        if (!r.ok || !r.dosya || !fs.existsSync(r.dosya)) continue;
        for (const s of fs.readFileSync(r.dosya, 'utf8').split('\n')) {
            if (!s.trim()) continue;
            akis.write(s + '\n'); satir++;
            try { if (JSON.parse(s).aktif) aktif++; } catch (e) {}
        }
    }
    akis.end();
    const sure = (Date.now() - t0) / 1000;
    const dusen = sonuclar.filter(r => !r.ok && !r.bos).flatMap(r => r.tohum || []);
    console.log('');
    console.log('=== TOPLAM ' + satir + ' karar kaydı, ' + aktif + ' AKTİF (kullanılabilir) — %' +
        (satir ? (aktif / satir * 100).toFixed(0) : 0) + ' verim ===');
    console.log('süre ' + sure.toFixed(0) + 'sn  →  ' + (satir / sure * 3600).toFixed(0) + ' karar/saat, ' +
        (aktif / sure * 3600).toFixed(0) + ' KULLANILABİLİR örnek/saat');
    if (kesildi) console.log('!! Koşu bellek nedeniyle KESİLDİ — veri eksiktir.');
    if (dusen.length) console.log('✗ düşen tohumlar: ' + dusen.join(',') + ' (bu tohumlardan veri YOK)');
    console.log('-> ' + CIKTI);
    console.log('sıradaki: node tools/beonai-egit.js --veri ' + CIKTI + ' --surum beonai-v1');
    process.exit(dusen.length ? 1 : 0);
});
