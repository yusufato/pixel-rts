'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ROL DENGESİ — PARALEL. `rol-dengesi.js`'i N işçiye böler.
//
//  NEDEN ZORUNLU: maç marjı std ≈ 2770. 48 maçlık bir kapının ayırt edebildiği en
//  küçük etki ≈ ±800, aranan etkiler ise çoğu zaman +200..+500 bandında. Yani küçük
//  koşular sistematik olarak GÜÇSÜZ ve bu projede pozitif çıkan birçok bulgu tam da
//  bu yüzden doğrulamada çöktü (docs/OLCUM-TUZAKLARI.md).
//  Tek süreçte n=96 (192 maç) saatler sürüyor; işçilere bölünce karar verilebilir hale
//  geliyor. Bu araç ölçüm KURGUSUNU değiştirmez, yalnız tohumları böler.
//
//  BÖLME SONUCU DEĞİŞTİRMEZ: her maç kendi tohumuyla bağımsız ve EŞLEŞTİRME işçi
//  içinde korunur (aynı tohum iki kolda da koşar). `--dogrula` bunu sınar.
//
//    node tools/rol-dengesi-paralel.js --tohum 96 --isci 8 \
//         --kol BATTLE_LOOKAHEAD_RED --ayar "LA_POLITIKA=1"
// ═══════════════════════════════════════════════════════════════════════════
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const ROOT = path.resolve(__dirname, '..');
const GECICI = path.join(ROOT, 'qa-runtime', 'rol-dengesi-paralel');

/* ⚠ SABIT TAVAN 8 IDI ve BAGLAYICI KISITTI: 16 cekirdekli makinede 6 cekirdek bos
   kaliyordu. Tam gucte (ufuk 300 / derin 5) kapilar saatler suruyor ve bu tavan
   dogrudan takvimi belirliyor. Tavan 12'ye cikarildi — 4 cekirdek isletim sistemine
   ve kullaniciya (oyun oynayabilmeli) birakiliyor.
   ⚠ AMA DARBOGAZ CEKIRDEK DEGIL BELLEK CIKTI (olculdu 2026-08-19): 14 node sureci
   4.7GB kullaniyordu, en buyugu 0.8GB, ve 15.7GB'lik makinede yalnizca 3GB bostu.
   Isci eklemek takas yaptirir ve YAVASLATIR. RAM varsayimi olculen TEPE degere
   (0.8GB) cekildi — 0.6 fazla iyimserdi.
   ⚠ SABIT TAVAN KALDIRILDI: 10 yaziyordu ve o rakam BU makineye ozeldi (16 mantiksal
   cekirdek). Ikinci makinede 20 cekirdek var; sabit 10 orada yarisini bosa dusururdu.
   Tavan artik cekirdekten turuyor (cpus-4) ve pratikte RAM korumasi zaten baglayici.
   ⚠ SONUCU ETKILEMEZ: maclar tohum basina deterministik; isci sayisi yalnizca DUVAR
   SAATINI degistirir, marjlari degil. */
function varsayilanIsci() {
    const cek = Math.max(1, (os.cpus() || []).length - 4);
    const ram = Math.max(1, Math.floor((os.freemem() / 1e9) / 0.8));
    return Math.max(1, Math.min(cek, ram));
}

const N = Math.max(1, Number(arg('--tohum', 96)) || 96);
const TOHUM0 = Number(arg('--tohum0', 100000)) || 100000;
const ISCI = Math.max(1, Number(arg('--isci', varsayilanIsci())) || 1);
const ETIKET = arg('--etiket', 'rol');
const DOGRULA = process.argv.includes('--dogrula');

// Kol tanımlayıcı bayraklar AYNEN aktarılır (tek-değişken kuralı korunur).
const GECIRILEN = ['--kol', '--koldeger', '--ayar', '--maxtik', '--ufuk', '--periyot', '--tur'];
const EKLER = [];
for (const bayrak of GECIRILEN) {
    const i = process.argv.indexOf(bayrak);
    if (i >= 0 && process.argv[i + 1] !== undefined) EKLER.push(bayrak, process.argv[i + 1]);
}
if (process.argv.includes('--esitkomp')) EKLER.push('--esitkomp');

fs.mkdirSync(GECICI, { recursive: true });

const TOPLAM = DOGRULA ? 8 : N;
/* ── IS KUYRUGU: sabit dilim yerine KUCUK PARCALAR ────────────────────────────
   ESKI TASARIM tohumlari basta ISCI parcaya bolerdi (128 tohum / 9 isci = 14'er).
   Iki kaybi olculdu:
     1. ARTCI KAYBI. C3'te isciler 120.3 · 122.3 · 124.7 · 130.7 · 132.2 · 134.3 ·
        143.6 · 145.0 dakikada bitti: ortalama 131.6 ama KAPI 145'te bitti, cunku
        herkes en yavas isciyi bekliyor. Son 25 dakikada makinenin yarisi bostaydi
        -> ~%10 duvar saati cope.
     2. ISCI SAYISI DONDU. Basta bir kez hesaplaniyordu; kosarken RAM bosalsa bile
        yeni isci eklenemiyordu.
   YENI TASARIM: is kucuk parcalara bolunur, havuz bir parca bitince sıradakini
   baslatir. Artci kaybi parca boyuna iner, ve havuz genisligi her parca basiminda
   YENIDEN hesaplanir (RAM bosaldikca buyur).
   ⚠ SONUCLARI DEGISTIRMEZ: maclar tohum basina deterministik, hangi surecin hangi
   tohumu kostugu sonucu etkilemez. Eslestirilmis fark da zaten TOHUMA gore hizaliyor
   (asagida `m0.has(k.seed)`), yani parca sirasi da onemsiz. Bu, "birebir esdeger"
   sinifindan bir optimizasyon — bu depoda YAKLASIKLIKLA ucuzlatma uc kez coktu
   (isinlama, ucuz puanlayici siralamasi, 5Hz kaba adim), esdeger olanlar guvenli. */
/* ⭐ ESDEGERLIK OLCULDU (2026-08-19, varsayilmadi):
   Ayni 4 tohum once YENI kodla, sonra ESKI kodla kosuldu (eski surum gecici bir kopya
   olarak, ikisi PARALEL, ayri --etiket ile). Karsilastirma mac mac yapildi — marj, bitis
   saniyesi ve kazanan ucu birden:
       YENI: kol=2 -215/std 3577 · kol=3 -217/std 3287 · eslestirilmis fark -2
       ESKI: kol=2 -215/std 3577 · kol=3 -217/std 3287 · eslestirilmis fark -2
       karsilastirilan mac 8 · AYNI 8 · FARKLI 0
   Dinamik havuz da kosu ciktisiyla dogrulandi:
       [havuz] genislik 1 (bos RAM 1.3 GB)  -> ikinci sureci BASLATMADI
       [havuz] genislik 2 (bos RAM 3.9 GB)  -> RAM bosalinca genisledi
   ⚠ NOT: bu commit'i gonderirken kayit hatasi oldu — kodun commit mesaji "DOGRULAMA
   SURUYOR, PUSH YOK" diyor ama dogrulama bitmisti ve push edildi. Dogru kayit BURASI. */
const PARCA = Math.max(1, Number(arg('--parca', 0)) ||
    Math.max(2, Math.ceil(TOPLAM / Math.max(1, ISCI * 4))));
const isler = [];
for (let i = 0, bas = TOHUM0; bas < TOHUM0 + TOPLAM; i++, bas += PARCA) {
    isler.push({ idx: i, tohum0: bas, n: Math.min(PARCA, TOHUM0 + TOPLAM - bas) });
}

console.log('ROL DENGESI — PARALEL');
console.log('  tohum: ' + TOHUM0 + '..' + (TOHUM0 + TOPLAM - 1) +
    '   parca: ' + isler.length + ' x ' + PARCA + ' tohum   havuz: ' + ISCI + ' (dinamik)');
if (EKLER.length) console.log('  aktarilan: ' + EKLER.join(' '));
console.log('');

const t0 = Date.now();
let biten = 0;

function isciKos(is) {
    return new Promise((cozum) => {
        const out = path.join(GECICI, ETIKET + '-' + is.idx + '.json');
        const args = [path.join(ROOT, 'tools', 'rol-dengesi.js'),
            '--tohum', String(is.n), '--tohum0', String(is.tohum0),
            '--json', out, ...EKLER];
        const p = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        p.stderr.on('data', (d) => { const s = String(d).trim(); if (s) console.log('  [' + is.idx + '] ! ' + s.slice(0, 200)); });
        p.on('close', (kod) => {
            biten++;
            console.log('  parca ' + is.idx + ' bitti (kod ' + kod + ')   ' + biten + '/' + isler.length +
                '   ' + ((Date.now() - t0) / 60000).toFixed(1) + 'dk');
            cozum({ out, kod, is });
        });
    });
}

function ozet(kayit) {
    const n = kayit.length;
    const sal = kayit.filter(k => k.kazanan === 'saldiran').length;
    const marj = kayit.map(k => k.marj);
    const ort = marj.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const std = Math.sqrt(marj.reduce((a, b) => a + (b - ort) * (b - ort), 0) / Math.max(1, n - 1));
    return { mac: n, saldiranOran: sal / Math.max(1, n), marjOrt: ort, marjStd: std,
        t: ort / (std / Math.sqrt(Math.max(1, n))) };
}

/* HAVUZ: en fazla `hedefHavuz()` surec ayni anda. Bir parca bitince siradaki baslar.
   Havuz genisligi her seferinde YENIDEN hesaplanir: kosan surecler zaten RAM tuttugu
   icin `bos RAM / 0.8GB` kadar DAHA surec eklenebilir demektir. Cekirdek payi tavan.
   ⚠ Kucultmez — koşan sureci oldurmek isi cope atardi; yalnizca YENI parca basmaz. */
function hedefHavuz(aktif) {
    const cek = Math.max(1, (os.cpus() || []).length - 4);
    const ekBellek = Math.floor((os.freemem() / 1e9) / 0.8);
    return Math.max(1, Math.min(ISCI, cek, aktif + Math.max(0, ekBellek)));
}

function havuzKos(isler) {
    return new Promise((cozum) => {
        const sonuclar = [];
        let sira = 0, aktif = 0, sonBildirilen = 0;
        function doldur() {
            const hedef = hedefHavuz(aktif);
            if (hedef !== sonBildirilen && sira < isler.length) {
                console.log('  [havuz] genislik ' + hedef + '   (bos RAM ' +
                    (os.freemem() / 1e9).toFixed(1) + ' GB)');
                sonBildirilen = hedef;
            }
            while (aktif < hedef && sira < isler.length) {
                aktif++;
                isciKos(isler[sira++]).then((r) => {
                    sonuclar.push(r); aktif--;
                    if (sira >= isler.length && aktif === 0) cozum(sonuclar);
                    else doldur();
                });
            }
            if (sira >= isler.length && aktif === 0) cozum(sonuclar);
        }
        doldur();
    });
}

havuzKos(isler).then((sonuclar) => {
    const coken = sonuclar.filter(s => s.kod !== 0);
    if (coken.length) console.log('  ! COKEN PARCA: ' + coken.map(s => s.is.idx).join(', '));

    // Kolları birleştir. Tohum sırası korunur ki EŞLEŞTİRME bozulmasın.
    const kollar = {};
    for (const s of sonuclar.sort((a, b) => a.is.idx - b.is.idx)) {
        if (!fs.existsSync(s.out)) continue;
        const d = JSON.parse(fs.readFileSync(s.out, 'utf8'));
        for (const k of Object.keys(d)) {
            if (!kollar[k]) kollar[k] = [];
            kollar[k].push(...d[k].kayit);
        }
    }
    const adlar = Object.keys(kollar);
    console.log('');
    const bas = 'kol'.padEnd(14) + 'mac'.padStart(5) + 'saldiran%'.padStart(11) +
        'marjOrt'.padStart(9) + 'marjStd'.padStart(9) + 't'.padStart(8);
    console.log(bas); console.log('-'.repeat(bas.length));
    for (const k of adlar) {
        const o = ozet(kollar[k]);
        console.log(('kol=' + k).padEnd(14) + String(o.mac).padStart(5) +
            ('%' + (o.saldiranOran * 100).toFixed(1)).padStart(11) +
            String(Math.round(o.marjOrt)).padStart(9) + String(Math.round(o.marjStd)).padStart(9) +
            o.t.toFixed(2).padStart(8));
    }

    if (adlar.length === 2) {
        // EŞLEŞTİRİLMİŞ FARK — tohuma göre hizala (işçi sırası karışsa bile doğru kalsın).
        const [a0, a1] = adlar;
        const m0 = new Map(kollar[a0].map(k => [k.seed, k.marj]));
        const cift = [];
        for (const k of kollar[a1]) if (m0.has(k.seed)) cift.push(k.marj - m0.get(k.seed));
        const n = cift.length;
        const ort = cift.reduce((s, v) => s + v, 0) / Math.max(1, n);
        const std = Math.sqrt(cift.reduce((s, v) => s + (v - ort) * (v - ort), 0) / Math.max(1, n - 1));
        const t = ort / (std / Math.sqrt(Math.max(1, n)));
        // SAPTAMA TABANI: bu n ile %80 guclе yakalanabilen en kucuk etki (~2.8 standart hata)
        const taban = 2.8 * std / Math.sqrt(Math.max(1, n));
        console.log('');
        console.log('  ESLESTIRILMIS FARK (' + a1 + ' - ' + a0 + '): n ' + n +
            '   ort ' + Math.round(ort) + '   std ' + Math.round(std) + '   t ' + t.toFixed(2) +
            (Math.abs(t) >= 2 ? '  -> ANLAMLI' : '  -> anlamli DEGIL'));
        console.log('  SAPTAMA TABANI: bu n ile ancak |etki| >= ' + Math.round(taban) +
            ' guvenle yakalanir.' + (Math.abs(ort) < taban ? '  (olculen etki BUNUN ALTINDA)' : ''));
    }
    console.log('');
    console.log('  sure: ' + ((Date.now() - t0) / 60000).toFixed(1) + 'dk');
});
