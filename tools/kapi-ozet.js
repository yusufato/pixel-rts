'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  KAPI ÖZETİ — gece kuyruğunun tüm sonuçlarını tek tabloda
//
//  Kuyruk saatlerce koşuyor ve sonuçlar `qa-runtime/gece-*.log` içine dağılıyor. Sonucu
//  okumak için her seferinde elle grep atmak, hem yavaş hem de bir kapıyı ATLAMAYA açık.
//  Bu araç log'u ayrıştırır ve her kapı için tek satır basar:
//    ad · n · eşleştirilmiş fark · t · saptama tabanı · hüküm
//
//  ⚠ HÜKÜM SAPTAMA TABANINA GÖRE VERİLİR, t'ye göre değil. Bu depoda maç marjının std'si
//  ~2600 (kompozisyon kollarında ~3781); n=128'de ancak |etki| ≳ 700 güvenle yakalanır.
//  "t 2.1 → anlamlı" demek bu gürültü seviyesinde yanıltıcıdır, o yüzden tabanın altında
//  kalan her ölçüm ETKİSİZ değil ÖLÇÜLEMEDİ diye işaretlenir — ikisi farklı şeydir.
//
//  --havuz: aynı kolu ölçen kapıları ters-varyans ağırlığıyla havuzlar (tohumlar AYRIK
//  olmalı; araç bunu doğrulayamaz, o yüzden havuz satırı UYARIYLA basılır).
//
//    node tools/kapi-ozet.js [--log qa-runtime/gece-faz2.log] [--havuz]
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const HAVUZ = process.argv.includes('--havuz');
const LOGLAR = (() => {
    const tek = arg('--log', null);
    if (tek) return [tek];
    const d = 'qa-runtime';
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter(f => /^gece.*\.log$/.test(f)).map(f => path.join(d, f)).sort();
})();
if (!LOGLAR.length) { console.log('log bulunamadi'); process.exit(1); }

const kapilar = [];
for (const yol of LOGLAR) {
    const satir = fs.readFileSync(yol, 'utf8').split(/\r?\n/);
    let acik = null;
    for (const s of satir) {
        let m = s.match(/^### (.+?)\s+basladi (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
        if (m) { acik = { log: path.basename(yol), ad: m[1].trim(), bas: m[2], komut: null,
                          tohum0: null, n: null, fark: null, t: null, taban: null, bitti: null, cikis: null }; continue; }
        if (!acik) continue;
        if (/^### komut:/.test(s)) {
            acik.komut = s.replace(/^### komut:\s*/, '');
            /* --tohum0 verilmemisse tezgahin VARSAYILANI kullanilmistir (100000, CYBORG
               havuzu — tools/rol-dengesi.js:30). Bunu 'bilinmiyor' saymak, gecen gecenin
               D kapisini (varsayilan tohumla kosmustu) havuz disinda birakiyordu. */
            const t0 = acik.komut.match(/--tohum0\s+(\d+)/);
            acik.tohum0 = t0 ? Number(t0[1]) : (/rol-dengesi/.test(acik.komut) ? 100000 : null);
            continue;
        }
        m = s.match(/ESLESTIRILMIS FARK \((.+?)\):\s*n (\d+)\s+ort (-?\d+)\s+std (\d+)\s+t (-?[\d.]+)/);
        if (m) { acik.yon = m[1]; acik.n = +m[2]; acik.fark = +m[3]; acik.std = +m[4]; acik.t = +m[5]; continue; }
        m = s.match(/SAPTAMA TABANI: bu n ile ancak \|etki\| >= (\d+)/);
        if (m) { acik.taban = +m[1]; continue; }
        m = s.match(/^### .+? bitti (\d{2}:\d{2})\s+\(cikis (\d+)\)/);
        if (m) { acik.bitti = m[1]; acik.cikis = +m[2]; kapilar.push(acik); acik = null; continue; }
    }
    if (acik) { acik.bitti = 'SURUYOR'; kapilar.push(acik); }
}

const hukum = (k) => {
    if (k.cikis !== 0 && k.cikis != null) return 'COKTU';
    if (k.bitti === 'SURUYOR') return 'suruyor';
    if (k.fark == null) return 'A/B degil';
    if (k.taban == null) return '?';
    if (Math.abs(k.fark) >= k.taban) return (k.fark > 0 ? 'GECTI (+)' : 'GECTI (-)');
    /* Taban altı iki farklı duruma karşılık gelebilir ve ayrımı std verir: std çok
       küçükse kol dünyayı gerçekten kıpırdatmıyordur ("etki YOK"), normalse yalnızca
       bu n ile göremiyoruzdur ("olculemedi"). K1 tam bu ayrımı gösterdi: std 366. */
    if (k.std != null && k.std < 900) return 'ETKI YOK';
    return 'olculemedi';
};

console.log('');
console.log('KAPI ÖZETİ — ' + LOGLAR.map(l => path.basename(l)).join(', '));
console.log('');
console.log('  ' + 'kapı'.padEnd(46) + 'n'.padStart(5) + 'fark'.padStart(8) + 'std'.padStart(7) +
    't'.padStart(7) + 'taban'.padStart(7) + '  hüküm');
console.log('  ' + '─'.repeat(94));
for (const k of kapilar) {
    const h = hukum(k);
    console.log('  ' + k.ad.slice(0, 45).padEnd(46) +
        String(k.n ?? '—').padStart(5) +
        String(k.fark ?? '—').padStart(8) +
        String(k.std ?? '—').padStart(7) +
        String(k.t ?? '—').padStart(7) +
        String(k.taban ?? '—').padStart(7) + '  ' + h);
}

console.log('');
console.log('  GECTI = |fark| saptama tabanının üstünde (karar verilebilir)');
console.log('  ETKI YOK = taban altı VE std çok küçük → kol dünyayı kıpırdatmıyor (güvenle hayır)');
console.log('  olculemedi = taban altı ama std normal → bu n ile GÖREMİYORUZ (etkisiz DEMEK DEĞİL)');

if (HAVUZ) {
    /* TERS-VARYANS HAVUZU: aynı soruyu ölçen bağımsız kapılar birleştirilir.
       se_i = std_i/sqrt(n_i) · w_i = 1/se_i^2 · havuz = Σw·x / Σw · se = 1/sqrt(Σw)
       ⚠ TOHUMLARIN AYRIK OLMASI ŞART. Araç bunu komut satırındaki --tohum0 ve n'den
       KABA olarak denetler; çakışma görürse havuzu basmaz. Aynı maçı iki kez saymak
       etkiyi olduğundan güçlü gösterir — bu gecenin en kolay hatası olurdu. */
    const grup = new Map();
    for (const k of kapilar) {
        if (k.fark == null || !k.n || !k.std) continue;
        const anahtar = (k.komut || '').match(/--kol\s+(\S+)\s+--koldeger\s+(\S+)/);
        if (!anahtar) continue;
        const g = anahtar[1] + ' ' + anahtar[2];
        if (!grup.has(g)) grup.set(g, []);
        grup.get(g).push(k);
    }
    console.log('');
    console.log('  ═══ HAVUZ (ters-varyans) ═══');
    let bulundu = false;
    for (const [g, lst] of grup) {
        if (lst.length < 2) continue;
        bulundu = true;
        const araliklar = lst.map(k => [k.tohum0, (k.tohum0 ?? 0) + k.n]);
        let cakisma = false;
        for (let i = 0; i < araliklar.length; i++) for (let j = i + 1; j < araliklar.length; j++) {
            if (araliklar[i][0] == null || araliklar[j][0] == null) { cakisma = true; continue; }
            if (araliklar[i][0] < araliklar[j][1] && araliklar[j][0] < araliklar[i][1]) cakisma = true;
        }
        if (cakisma) {
            console.log('    ' + g + ': TOHUMLAR CAKISIYOR (ya da bilinmiyor) → HAVUZLANMADI');
            continue;
        }
        let sw = 0, swx = 0, n = 0;
        for (const k of lst) { const se = k.std / Math.sqrt(k.n); const w = 1 / (se * se); sw += w; swx += w * k.fark; n += k.n; }
        const ort = swx / sw, se = 1 / Math.sqrt(sw);
        const stdOrt = lst.reduce((s, k) => s + k.std * k.n, 0) / n;
        const taban = 2.8 * stdOrt / Math.sqrt(n);
        console.log('    ' + g + ': n ' + n + '  havuz ' + Math.round(ort) + '  se ' + Math.round(se) +
            '  t ' + (ort / se).toFixed(2) + '  taban ' + Math.round(taban) +
            '  → ' + (Math.abs(ort) >= taban ? 'TABANIN USTUNDE' : 'taban alti'));
    }
    if (!bulundu) console.log('    havuzlanacak tekrar yok');
}
console.log('');
