// INSAN SAVUNMA MACLARI — kullanicinin GUNCEL motorda oynadigi maclarin analizi.
//
// KULLANICI (2026-08-08) uc soru sordu:
//   1) "AI savunmasi taarruzu SADECE ustun oldugunu goruyorsa yapmali" — AI ustunlugu olmadan
//      saldiriyor mu? (ben taarruz ederken rakip bana taarruz ediyor)
//   2) "Iki tarafta yumaksa gafil avlama calismaz, o zaman DOLAYLI atislar is yapar" — dolayli
//      atesin payi ne?
//   3) "Bu oyuncu seviyesine gelme yollarini incele."
//
// OLCULEN (ham kayittan, olay bazli):
//   GAFIL AVLAMA  : olumcul vurusta kurbanin 600px'inde kac KENDI dostu vardi (yalniz mi avlandi)
//   YEREL ORAN    : kurbanin cevresindeki dusman / (dost+1)
//   DOLAYLI PAY   : dolayli-ates birimlerinin hasar payi
//   ILK TEMAS     : hangi taraf once vurdu, ve o an yerel oran neydi (ustunluk olmadan saldiri)
// Kaynak: replay.telemetry.combatEvents (konumlu) + samples (0.5sn birim durumlari).
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');
const R = Number(arg('--r', 600)) || 600;
const SADECE = arg('--tohum', '');   // ornegin "9001,9002,9003"

// DIKKAT (yasandi): telemetride `attackerType` SAYISAL INDEKS'tir, id degil. String kumesiyle
// karsilastirinca hicbir sey eslesmez ve "dolayli pay %0" gibi SESSIZ bir yanlis cikar.
// Indeks -> id eslemesi veri dosyasindan kurulur.
const _db = require(path.join(__dirname, '..', 'js', 'UnitData.js'));
const _U = (_db && (_db.UNITS_MODERN_DB || _db.UNITS_MODERN || _db)) || {};
const _L = (Array.isArray(_U.units) ? _U.units : (Array.isArray(_U) ? _U : Object.values(_U))).filter(x => x && x.id);
const TIP_ID = {}; _L.forEach((u, i) => { TIP_ID[i] = u.id; });
const tipAd = (t) => (typeof t === 'number' ? (TIP_ID[t] || String(t)) : String(t));
const DOLAYLI = new Set(['mortar_team', 'artillery', 'mlrs', 'ballistic_missile']);

let dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json'));
if (SADECE) {
    const izin = SADECE.split(',').map(s => s.trim());
    dosyalar = dosyalar.filter(f => izin.some(t => f.includes('-' + t + '-')));
}
dosyalar.sort();
if (!dosyalar.length) { console.error('kayit bulunamadi'); process.exit(1); }

console.log('INSAN SAVUNMA MACLARI — ' + dosyalar.length + ' kayit, cember ' + R + 'px');
console.log('');

const genel = { insan: { olum: 0, gafil: 0, yalniz: 0, kutle: 0 }, ai: { olum: 0, gafil: 0, yalniz: 0, kutle: 0 } };

for (const dos of dosyalar) {
    const d = JSON.parse(fs.readFileSync(path.join(DIZIN, dos), 'utf8'));
    const r = d.replay || {};
    const t = r.telemetry || {};
    const ev = t.combatEvents || [];
    const sm = t.samples || [];
    if (!ev.length || !sm.length) { console.log('  ' + dos + ': telemetri yok'); continue; }
    const motor = d.engineVersion || r.engineVersion || '?';
    const rakip = t.rakipBeyin || '(etiketsiz)';
    const rakipTaraf = t.rakipTaraf || 'kirmizi';
    const aiKirmizi = rakipTaraf !== 'mavi';     // AI hangi tarafta

    // tick -> sample indeksi (en yakin)
    const tikler = sm.map(s => s.tick);
    const enYakinSample = (tik) => {
        let lo = 0, hi = tikler.length - 1, best = 0, bd = Infinity;
        while (lo <= hi) { const m = (lo + hi) >> 1; const dd = Math.abs(tikler[m] - tik);
            if (dd < bd) { bd = dd; best = m; }
            if (tikler[m] < tik) lo = m + 1; else hi = m - 1; }
        return sm[best];
    };

    const say = { insan: { olum: 0, gafil: 0, yalniz: 0, kutle: 0, hasar: 0, dolayli: 0 },
                  ai:    { olum: 0, gafil: 0, yalniz: 0, kutle: 0, hasar: 0, dolayli: 0 } };
    let ilkTemas = null;

    for (const e of ev) {
        // saldiran INSAN mi AI mi (AI tarafi rakipTaraf'tan bilinir)
        const saldiranAI = (e.attackerSide === 'red') === aiKirmizi;
        const k = saldiranAI ? say.ai : say.insan;
        k.hasar += (e.damage || 0);
        if (DOLAYLI.has(tipAd(e.attackerType))) k.dolayli += (e.damage || 0);
        if (ilkTemas == null && (e.damage || 0) > 0) ilkTemas = { saldiranAI, tik: e.tick, sn: e.seconds };
        if (!e.lethal) continue;
        k.olum++;
        // kurbanin cevresi: en yakin ornekteki birimler
        const s = enYakinSample(e.tick);
        const bir = (s && s.units) || [];
        const kurbanKirmizi = e.targetSide === 'red';
        let dost = 0, dusman = 0;
        for (const u of bir) {
            if (u.id === e.targetId) continue;
            const dd = Math.hypot((u.x - e.targetX), (u.y - e.targetY));
            if (dd > R) continue;
            if ((u.side === 'red') === kurbanKirmizi) dost++; else dusman++;
        }
        if (dost <= 1) k.yalniz++;
        if (dost <= 1 && dusman >= 3) k.gafil++;
        if (dost >= 4) k.kutle++;
    }

    const yuz = (a, b) => b ? Math.round(a / b * 100) : 0;
    console.log('  ' + dos.replace(ONEK, '').slice(0, 22));
    console.log('    motor: ' + motor.slice(-28) + '   rakip beyin: ' + rakip);
    console.log('    ' + 'taraf'.padEnd(8) + 'oldurme'.padStart(9) + 'yalniz'.padStart(9) + 'GAFIL'.padStart(8) +
        'kutle'.padStart(8) + 'dolayli pay'.padStart(13));
    for (const [ad, k] of [['INSAN', say.insan], ['AI', say.ai]]) {
        console.log('    ' + ad.padEnd(8) + String(k.olum).padStart(9) +
            ('%' + yuz(k.yalniz, k.olum)).padStart(9) + ('%' + yuz(k.gafil, k.olum)).padStart(8) +
            ('%' + yuz(k.kutle, k.olum)).padStart(8) + ('%' + yuz(k.dolayli, k.hasar)).padStart(13));
    }
    if (ilkTemas) console.log('    ilk kan: ' + (ilkTemas.saldiranAI ? 'AI' : 'INSAN') + '  t=' + Math.round(ilkTemas.sn) + 'sn');
    console.log('');
    for (const [ad, k] of [['insan', say.insan], ['ai', say.ai]]) {
        genel[ad].olum += k.olum; genel[ad].gafil += k.gafil; genel[ad].yalniz += k.yalniz; genel[ad].kutle += k.kutle;
    }
}

const yuz = (a, b) => b ? Math.round(a / b * 100) : 0;
console.log('  ══ TOPLAM ══');
console.log('  ' + 'taraf'.padEnd(8) + 'oldurme'.padStart(9) + 'yalniz'.padStart(9) + 'GAFIL'.padStart(8) + 'kutle'.padStart(8));
for (const [ad, k] of [['INSAN', genel.insan], ['AI', genel.ai]])
    console.log('  ' + ad.padEnd(8) + String(k.olum).padStart(9) + ('%' + yuz(k.yalniz, k.olum)).padStart(9) +
        ('%' + yuz(k.gafil, k.olum)).padStart(8) + ('%' + yuz(k.kutle, k.olum)).padStart(8));
console.log('');
console.log('  KIYAS — AI-vs-AI headless olcumu (tools/gafil-avlama-teshis.js): yalniz %22, gafil %14, kutle %52');
