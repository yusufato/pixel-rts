// DAVRANIS KLONLAMA VERISI — N isci paralel `tools/beonai-uret.js`.
//
// NEDEN AYRI BIR URETIM: eldeki 180 macta kod-AI'in EYLEMI yok, yalnizca SONUCU (chosenReward) vardi.
// `js/BattleOracle.js` artik her karar icin `kodPlan` (kod-AI'in o anki plani: kind/sector/tempo/hedef)
// ve her aday icin `nokta` (sektor merkezi) yaziyor. Etiket bu ikisinden CEVRIMDISI kurulur:
//   ayni intent + kod-AI'in MAIN hedefine EN YAKIN aday noktasi.
// UYARI (olculdu): bir kararda YALNIZ 3 ayrik aday noktasi var (575px arali) — kod-AI ise serbest bir
// noktaya gidiyor. Yani etiket "kod-AI'in yapacagina EN YAKIN aday"dir, kod-AI'in kendisi degil.
// Klonlamanin tavani bu kabalikla sinirli; bu, olculen dusuk karar-uzayi tavaniyla (+771) tutarli.
//
// TOHUM HAVUZLARI AYRIK (--tohumofs): isciler ayni maci tekrarlamaz.
// YAZMA: her isci KENDI dosyasina yazar (birlestirme YOK — gece kosusunda birlestirme adimi
// senkron dongude diske hic yazmayip cokmustu).
const { spawn } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'qa-runtime/bc');
const TOHUM_ISCI = Math.max(1, Number(arg('--tohum', 400)) || 400);   // isci basi tohum
const BAS_OFS = Number(arg('--ofs', 20000)) || 20000;                 // eski havuzlarla cakismasin
const BCONLY = process.argv.includes('--bconly');                     // rollout'suz uretim (klonlama)

// ISCI SAYISI: RAM tavani (isci basi ~456 MB, 1 GB emniyet payi) ve CPU tavani (cekirdek-2) ile sinirli.
const PER_W = 0.456;
const bosGB = os.freemem() / 1073741824;
const ramLimit = Math.max(1, Math.floor((bosGB - 1.0) / PER_W));
const cpuLimit = Math.max(1, os.cpus().length - 2);
const istenen = Number(arg('--isci', 0)) || 0;
const ISCI = istenen > 0 ? istenen : Math.max(1, Math.min(ramLimit, cpuLimit));

fs.mkdirSync(DIZIN, { recursive: true });
console.log('BC URETIM — ' + ISCI + ' isci' + (istenen ? ' (elle secildi)' : '') +
    '   RAM tavani ' + ramLimit + ', CPU tavani ' + cpuLimit + ', bos RAM ' + bosGB.toFixed(2) + ' GB');
console.log('  isci basi ' + TOHUM_ISCI + ' tohum, havuzlar AYRIK, cikti -> ' + DIZIN + '/wN.jsonl');
console.log('  etiket: kodPlan (kod-AI eylemi) + aday noktalari -> cevrimdisi eslestirme');
console.log('');

const t0 = Date.now();
let biten = 0;
const durum = new Array(ISCI).fill('...');

for (let i = 0; i < ISCI; i++) {
    // ARAYUZ (olculdu — ilk denemede yanlis kullanildi): `beonai-uret.js` icin
    //   --maclar N   : mac sayisi
    //   --tohum a,b,c: ACIK tohum listesi (virgullu). `--tohumofs` DIYE BIR SEY YOK.
    // Ilk denemede `--tohum 400 --tohumofs 20000` verilmisti; uretici bunu "tohum 400 ile 1 mac"
    // diye okudu ve 12 iscinin HEPSI ayni maci kostu (dosyalar birebir ayni boyuttaydi: 1378782 bayt).
    // Bu yuzden tohumlar burada ACIKCA listelenir ve havuzlar AYRIK olur.
    const ofs = BAS_OFS + i * TOHUM_ISCI;
    const tohumlar = [];
    for (let k = 0; k < TOHUM_ISCI; k++) tohumlar.push(ofs + k);
    const out = path.join(DIZIN, 'w' + i + '.jsonl');
    const log = fs.openSync(path.join(DIZIN, 'w' + i + '.log'), 'w');
    // --bconly: ROLLOUT'SUZ uretim (davranis klonlama). Olculdu: karar basi 24.2sn -> 0.6sn (~40x).
    // Klonlamanin etiketi `kodPlan`'dan gelir; karsi-olgusal rollout'lar YALNIZ odul etiketi icindi.
    const bayraklar = [
        path.join(__dirname, 'beonai-uret.js'),
        '--maclar', String(TOHUM_ISCI),
        '--tohum', tohumlar.join(','),
        '--out', out
    ];
    if (BCONLY) bayraklar.push('--bconly');
    const p = spawn(process.execPath, bayraklar, { stdio: ['ignore', log, log] });
    durum[i] = 'kosuyor (tohum ' + ofs + '-' + (ofs + TOHUM_ISCI - 1) + ')';
    p.on('exit', (code) => {
        biten++;
        durum[i] = 'BITTI(' + code + ')';
        const dk = ((Date.now() - t0) / 60000).toFixed(1);
        let satir = 0;
        try { satir = fs.readFileSync(out, 'utf8').split('\n').filter(x => x.trim()).length; } catch (e) {}
        console.log('[' + dk + 'dk] isci ' + i + ' bitti (kod ' + code + ') — ' + satir + ' karar');
        if (biten === ISCI) {
            let top = 0;
            for (let k = 0; k < ISCI; k++) {
                try { top += fs.readFileSync(path.join(DIZIN, 'w' + k + '.jsonl'), 'utf8').split('\n').filter(x => x.trim()).length; } catch (e) {}
            }
            console.log('');
            console.log('BC_URET_OK  toplam ' + top + ' karar  /  ' + ((Date.now() - t0) / 60000).toFixed(1) + ' dk');
        }
    });
}

// ILERLEME: 5 dakikada bir toplam karar sayisi (F1 kurali — gercek hiz erken gorunsun)
const timer = setInterval(() => {
    let top = 0;
    for (let k = 0; k < ISCI; k++) {
        try { top += fs.readFileSync(path.join(DIZIN, 'w' + k + '.jsonl'), 'utf8').split('\n').filter(x => x.trim()).length; } catch (e) {}
    }
    const dk = (Date.now() - t0) / 60000;
    console.log('[' + dk.toFixed(0) + 'dk] toplam ' + top + ' karar   (' + (top / Math.max(0.1, dk)).toFixed(0) + ' karar/dk)');
    if (biten === ISCI) clearInterval(timer);
}, 300000);
timer.unref && timer.unref();
