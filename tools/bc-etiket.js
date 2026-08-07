// DAVRANIS KLONLAMA ETIKETI — cevrimdisi eslestirme.
//
// Uretim her karara `kodPlan` (kod-AI'in O ANKI plani) ve her adaya `nokta` (sektor merkezi) yaziyor.
// Burada ikisi eslestirilip her karara BIR HEDEF INDEKS yazilir: `bcIndex`.
//
// ESLESTIRME KURALI (kodlamadan bagimsiz):
//   1. Ayni `intent` (kod-AI `planKind` ile aday `intent` AYNI sozlugu kullanir — %100 ortusuyor)
//   2. Bu adaylar icinde kod-AI'in MAIN hedefine EN YAKIN `nokta`
//   3. Ayni intent yoksa: yalnizca en yakin nokta (intent duser, etiket yine de kurulur) -> `zayif:true`
//
// DURUSTLUK NOTU (olculdu): bir kararda YALNIZ 3 ayrik aday noktasi var (~575px arali), kod-AI ise
// SERBEST bir noktaya gidiyor. Yani etiket "kod-AI'in yapacagina EN YAKIN ifade edilebilir aday"dir,
// kod-AI'in kendisi DEGIL. Klonlamanin tavani bu kabalikla sinirlidir — beklenti buna gore kurulmali.
// Bu yuzden cikti, eslesme mesafesinin dagilimini de basar: buyukse etiket gurultuludur.
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'qa-runtime/bc');
const CIKTI = arg('--out', 'qa-runtime/bc-etiketli.jsonl');
const MAX_MESAFE = Number(arg('--maxmesafe', 0)) || 0;   // >0 ise bu mesafenin ustundeki etiket ELENIR

// COKLU DIZIN: `--dizin a,b` — uretim birden fazla kosuya bolunebilir (isci sayisi degistiginde
// yeni klasore gecilir ki onceki veri silinmesin). Dosyalar TAM YOL olarak toplanir.
const dosyalar = [];
for (const d of String(DIZIN).split(',').map(s => s.trim()).filter(Boolean)) {
    let liste = [];
    try { liste = fs.readdirSync(d).filter(f => f.endsWith('.jsonl')).sort(); } catch (e) { continue; }
    for (const f of liste) dosyalar.push(path.join(d, f));
}
if (!dosyalar.length) { console.error('veri yok: ' + DIZIN); process.exit(1); }

let giris = 0, etiketli = 0, zayif = 0, atlanan = 0;
const mesafeler = [];
const intentDagilim = {};
const hedefDagilim = {};
const w = fs.openSync(CIKTI, 'w');

for (const f of dosyalar) {
    const satirlar = fs.readFileSync(f, 'utf8').split('\n');
    for (const ln of satirlar) {
        if (!ln.trim()) continue;
        giris++;
        let o; try { o = JSON.parse(ln); } catch (e) { atlanan++; continue; }
        const v = o.veri;
        if (!v || !v.rows || !v.rows.length) { atlanan++; continue; }
        const kp = v.kodPlan;
        if (!kp || !kp.kind || kp.hedefX == null) { atlanan++; continue; }

        const noktali = v.rows.map((r, i) => ({ r, i })).filter(x => x.r.nokta);
        if (!noktali.length) { atlanan++; continue; }

        const ayniIntent = noktali.filter(x => x.r.intent === kp.kind);
        const havuz = ayniIntent.length ? ayniIntent : noktali;
        let en = null, ed = Infinity;
        for (const x of havuz) {
            const d = Math.hypot(x.r.nokta[0] - kp.hedefX, x.r.nokta[1] - kp.hedefY);
            // BERABERLIK: kucuk indeks kazanir (determinist — ayni veri ayni etiketi verir)
            if (d < ed) { ed = d; en = x; }
        }
        if (!en) { atlanan++; continue; }
        if (MAX_MESAFE > 0 && ed > MAX_MESAFE) { atlanan++; continue; }

        v.bcIndex = en.i;
        v.bcMesafe = Math.round(ed);
        v.bcZayif = !ayniIntent.length;          // intent eslesmedi -> etiket zayif
        if (v.bcZayif) zayif++;
        etiketli++;
        mesafeler.push(Math.round(ed));
        intentDagilim[kp.kind] = (intentDagilim[kp.kind] || 0) + 1;
        const h = en.r.intent + '/' + en.r.tempo;
        hedefDagilim[h] = (hedefDagilim[h] || 0) + 1;
        fs.writeSync(w, JSON.stringify(o) + '\n');
    }
}
fs.closeSync(w);

mesafeler.sort((a, b) => a - b);
const p = (q) => mesafeler.length ? mesafeler[Math.floor((mesafeler.length - 1) * q)] : 0;
console.log('BC ETIKETLEME — ' + dosyalar.length + ' dosya');
console.log('  girdi karar      : ' + giris);
console.log('  ETIKETLENEN      : ' + etiketli + '  (%' + Math.round(etiketli / Math.max(1, giris) * 100) + ')');
console.log('  zayif (intent yok): ' + zayif);
console.log('  atlanan          : ' + atlanan);
console.log('');
console.log('  eslesme mesafesi : medyan ' + p(0.5) + 'px   %25 ' + p(0.25) + '   %75 ' + p(0.75) + '   en kotu ' + p(1));
console.log('    (aday sektorleri ~575px arali -> medyan bunun ALTINDAysa etiket saglam sayilir)');
console.log('');
console.log('  kod-AI intent dagilimi :');
for (const [k, n] of Object.entries(intentDagilim).sort((a, b) => b[1] - a[1]))
    console.log('    ' + k.padEnd(16) + n + '  (%' + Math.round(n / Math.max(1, etiketli) * 100) + ')');
console.log('  SECILEN aday dagilimi (intent/tempo):');
for (const [k, n] of Object.entries(hedefDagilim).sort((a, b) => b[1] - a[1]).slice(0, 8))
    console.log('    ' + k.padEnd(24) + n + '  (%' + Math.round(n / Math.max(1, etiketli) * 100) + ')');
console.log('');
console.log('  TABAN KIYASI: rastgele secim %' + (etiketli ? (100 / (JSON.parse(fs.readFileSync(CIKTI, 'utf8').split('\n')[0]).veri.rows.length)).toFixed(1) : '-') +
    ' dogruluk verir; egitilen model bunu ACIK ARA gecmeli.');
console.log('-> ' + CIKTI);
