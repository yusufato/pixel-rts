// DERIN ANALIZ — ham kaydin TUM katmanlari.
//
// KULLANICI (2026-08-08): "cok az veriyi inceledin, ham jsonlarin verdigi verilerin tamamini incele"
// Haklı: onceki tarama (tools/fark-taramasi.js) yalniz samples[] uzerinden 23 ORTALAMA cikardi.
// Kullanilmayanlar: controllerDecisions (4.5MB/dosya — AI'in KENDI muhakemesi), zaman yapisi,
// birim-basi ekonomi, olum oncesi olay dizileri, emir dokumu, taskContract ilerlemesi.
//
// BU ARAC 6 KATMAN OLCER:
//   K1 INANC     : AI dusman degerini/kuvvet oranini ne saniyor vs GERCEK (istihbarat tabani)
//   K2 KARAR     : plan dagilimi, plan calkantisi, gecis sebepleri, durus zaman cizgisi, skor surucu
//   K3 EMIR      : emir dokumu, birim-basi emir, hedef sicramasi (ayni birime pes pese farkli nokta)
//   K4 ZAMAN     : metriklerin maca yayilmis seyri (ortalama degil egri) — insan vs AI
//   K5 EKONOMI   : birim TIPI basina verdirilen/yenilen hasar, olum, olum aninda cevre
//
// TUZAK NOTU: attackerType SAYISAL INDEKS'tir (bkz insan-savunma-analiz.js). Ayni esleme burada da.
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');
const SADECE = arg('--tohum', '');
const KATMAN = arg('--katman', '');   // "1,2" gibi; bos = hepsi

const _db = require(path.join(__dirname, '..', 'js', 'UnitData.js'));
const _U = (_db && (_db.UNITS_MODERN_DB || _db.UNITS_MODERN || _db)) || {};
const _L = (Array.isArray(_U.units) ? _U.units : (Array.isArray(_U) ? _U : Object.values(_U))).filter(x => x && x.id);
const TIP_ID = {}; _L.forEach((u, i) => { TIP_ID[i] = u.id; });
// DIKKAT: cost bir NESNE ({resource,supply,buildTime}) — dogrudan sayi sanmak NaN uretir (yasandi).
const TIP_MALIYET = {}; _L.forEach((u, i) => { TIP_MALIYET[i] = (u.cost && u.cost.resource) || 0; });
const TIP_MENZIL = {}; _L.forEach((u, i) => {
    let mx = 0; for (const w of (u.weapons || [])) if ((w.range || 0) > mx) mx = w.range;
    TIP_MENZIL[i] = mx; });
const tipAd = (t) => (typeof t === 'number' ? (TIP_ID[t] || ('tip' + t)) : String(t));

let dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json'));
if (SADECE) { const izin = SADECE.split(',').map(s => s.trim()); dosyalar = dosyalar.filter(f => izin.some(t => f.includes('-' + t + '-'))); }
dosyalar.sort();
if (!dosyalar.length) { console.error('kayit bulunamadi'); process.exit(1); }
const katmanAcik = (n) => !KATMAN || KATMAN.split(',').map(s => s.trim()).includes(String(n));

const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const yuz = (a, b) => b ? (a / b * 100) : 0;
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

// ---- toplayicilar (tum maclar) ----
const K1 = [];                                    // inanc hatasi kayitlari
const K2 = { plan: {}, gecis: {}, durus: {}, calkanti: [], skorSebep: {}, uygunsuz: 0, aday: 0,
             kapiAcik: 0, kapiBakilan: 0, komuta: {} };
const K3 = { emir: {}, birimEmir: [], sicrama: [], sicramaMes: [], sebep: {} };
const K4 = [];                                    // { dilim, insan:{...}, ai:{...} }
const K5 = { insan: {}, ai: {} };                 // tip -> { verdi, yedi, olum, sayi, maliyet }
const MACLAR = [];

for (const dos of dosyalar) {
    const d = JSON.parse(fs.readFileSync(path.join(DIZIN, dos), 'utf8'));
    const r = d.replay || {}; const t = r.telemetry || {};
    const sm = t.samples || [], cd = t.controllerDecisions || [], ce = t.combatEvents || [], le = t.lifeEvents || [];
    if (!sm.length) continue;
    const fin = t.finalSummary || {};
    const tohum = fin.seed;
    // AI tarafi: rakipTaraf ('kirmizi'/'mavi'); insan digeri
    const aiKirmizi = (t.rakipTaraf || 'kirmizi') !== 'mavi';
    const aiSide = aiKirmizi ? 'red' : 'blue';
    const insanSide = aiKirmizi ? 'blue' : 'red';
    MACLAR.push({ tohum, dos, aiSide, insanSide, fin, sure: fin.durationSeconds,
                  sonuc: fin.outcomeReason, rakip: t.rakipBeyin || '?',
                  saldiran: fin.attackerSide, sm, cd, ce, le });
}

console.log('DERIN ANALIZ — ' + MACLAR.length + ' mac');
for (const m of MACLAR)
    console.log('  tohum ' + String(m.tohum).padEnd(11) + m.sure.toFixed(0).padStart(4) + 'sn  ' +
        'AI=' + m.aiSide.padEnd(5) + ' saldiran=' + String(m.saldiran).padEnd(5) +
        ' rakip=' + String(m.rakip).padEnd(12) + ' ' + m.sonuc);
console.log('');

// ═══════════ K1 — INANC vs GERCEK ═══════════
if (katmanAcik(1)) {
    console.log('═══ K1  AI\'IN INANCI vs GERCEK (istihbarat) ═══');
    const satir = [];
    for (const m of MACLAR) {
        // gercek dusman degeri: o tikteki en yakin sample'dan, INSAN tarafinin hp-agirlikli maliyeti
        const tikler = m.sm.map(s => s.tick);
        const bul = (tik) => { let lo = 0, hi = tikler.length - 1, b = 0, bd = Infinity;
            while (lo <= hi) { const mid = (lo + hi) >> 1, dd = Math.abs(tikler[mid] - tik);
                if (dd < bd) { bd = dd; b = mid; } if (tikler[mid] < tik) lo = mid + 1; else hi = mid - 1; }
            return m.sm[b]; };
        const gercekDeger = (s, side) => { let v = 0;
            for (const u of (s.units || [])) { if (u.side !== side) continue; if (u.hp <= 0) continue;
                v += (TIP_MALIYET[u.type] || 0) * (u.hp / Math.max(1, u.maxHp)); } return v; };
        for (const c of m.cd) {
            if (!c.situation || c.side === undefined) continue;
            // yalniz AI kontrolorunun kararlari (side true=red)
            const cRed = (c.side === true || c.side === 'red');
            if ((cRed ? 'red' : 'blue') !== m.aiSide) continue;
            const s = bul(c.tick);
            const gDus = gercekDeger(s, m.insanSide), gDost = gercekDeger(s, m.aiSide);
            const o = c.observation || {}, si = c.situation || {};
            satir.push({ tohum: m.tohum, sn: c.seconds,
                sandigi: si.estimatedEnemyValue, gozledigi: o.observedEnemyValue, gercek: gDus,
                taban: o.intelligenceFloor, oranSandigi: si.forceRatio,
                oranGercek: gDost / Math.max(1, gDus), durus: (si.operationalPosture || {}).stance,
                temas: si.contactState, gorunen: si.visibleContactCount, kontak: si.contactCount });
        }
    }
    const sondaj = [0.1, 0.3, 0.5, 0.7, 0.9];
    console.log('  ' + 'mac ilerlemesi'.padEnd(16) + 'SANDIGI'.padStart(9) + 'gozledigi'.padStart(11) +
        'GERCEK'.padStart(9) + 'oran-sandigi'.padStart(13) + 'oran-GERCEK'.padStart(12) + '  durus');
    for (const p of sondaj) {
        const dilim = [];
        for (const m of MACLAR) {
            const ms = satir.filter(x => x.tohum === m.tohum); if (!ms.length) continue;
            dilim.push(ms[Math.min(ms.length - 1, Math.floor(ms.length * p))]);
        }
        if (!dilim.length) continue;
        const dm = {}; for (const x of dilim) dm[x.durus] = (dm[x.durus] || 0) + 1;
        console.log('  %' + String(Math.round(p * 100)).padEnd(14) +
            f1(ort(dilim.map(x => x.sandigi))).padStart(9) +
            f1(ort(dilim.map(x => x.gozledigi))).padStart(11) +
            f1(ort(dilim.map(x => x.gercek))).padStart(9) +
            f2(ort(dilim.map(x => x.oranSandigi))).padStart(13) +
            f2(ort(dilim.map(x => x.oranGercek))).padStart(12) + '  ' +
            Object.entries(dm).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '×' + v).join(' '));
    }
    const tabanaEsit = satir.filter(x => Math.abs(x.sandigi - x.taban) < 1).length;
    console.log('');
    console.log('  istihbarat TABANINA yapisik karar : ' + tabanaEsit + '/' + satir.length +
        ' (%' + Math.round(yuz(tabanaEsit, satir.length)) + ')  <- taban = dusmanin BASLANGIC butcesi');
    const asiri = satir.filter(x => x.sandigi > x.gercek * 1.5).length;
    const eksik = satir.filter(x => x.sandigi < x.gercek * 0.67).length;
    console.log('  dusmani ABARTMA (>1.5x gercek)    : ' + asiri + '/' + satir.length + ' (%' + Math.round(yuz(asiri, satir.length)) + ')');
    console.log('  dusmani KUCUMSEME (<0.67x gercek) : ' + eksik + '/' + satir.length + ' (%' + Math.round(yuz(eksik, satir.length)) + ')');
    const sap = satir.map(x => x.oranSandigi - x.oranGercek);
    console.log('  kuvvet orani sapmasi (sandigi-gercek): ort ' + f2(ort(sap)) +
        '   |sapma| ' + f2(ort(sap.map(Math.abs))));
    const gorunmez = satir.filter(x => x.gorunen === 0).length;
    console.log('  KOR karar (gorunen kontak = 0)    : ' + gorunmez + '/' + satir.length + ' (%' + Math.round(yuz(gorunmez, satir.length)) + ')');
    console.log('');
}

// ═══════════ K2 — KARAR KATMANI ═══════════
if (katmanAcik(2)) {
    console.log('═══ K2  KARAR: plan / calkanti / durus / skor ═══');
    for (const m of MACLAR) {
        let oncekiPlan = null, degisim = 0, kararSayi = 0;
        for (const c of m.cd) {
            const cRed = (c.side === true || c.side === 'red');
            if ((cRed ? 'red' : 'blue') !== m.aiSide) continue;
            kararSayi++;
            const cp = c.committedPlan || {};
            K2.plan[cp.kind || '?'] = (K2.plan[cp.kind || '?'] || 0) + 1;
            if (oncekiPlan !== null && cp.id !== oncekiPlan) {
                degisim++;
                K2.gecis[cp.transitionReason || '?'] = (K2.gecis[cp.transitionReason || '?'] || 0) + 1;
            }
            oncekiPlan = cp.id;
            const op = (c.situation || {}).operationalPosture || {};
            K2.durus[op.stance || '?'] = (K2.durus[op.stance || '?'] || 0) + 1;
            if (op.strikeGateOpen !== undefined) { K2.kapiBakilan++; if (op.strikeGateOpen) K2.kapiAcik++; }
            for (const rp of (c.rankedPlans || [])) {
                K2.aday++;
                if (!rp.eligible) K2.uygunsuz++;
                for (const sr of (rp.scoreReasons || [])) {
                    const ad = String(sr).split('=')[0];
                    K2.skorSebep[ad] = (K2.skorSebep[ad] || 0) + 1;
                }
            }
            // sektor-komuta izi
            const ex = c.execution || {};
            if (ex.telemetry && ex.telemetry.operation) K2.komuta.op = (K2.komuta.op || 0) + 1;
        }
        K2.calkanti.push({ tohum: m.tohum, degisim, kararSayi, sure: m.sure });
    }
    const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    const tPlan = Object.values(K2.plan).reduce((a, b) => a + b, 0);
    console.log('  PLAN dagilimi (baglanilan):  ' + top(K2.plan, 8).map(([k, v]) => k + ' %' + Math.round(yuz(v, tPlan))).join('  '));
    const tDurus = Object.values(K2.durus).reduce((a, b) => a + b, 0);
    console.log('  DURUS dagilimi:              ' + top(K2.durus, 8).map(([k, v]) => k + ' %' + Math.round(yuz(v, tDurus))).join('  '));
    console.log('  TAARRUZ KAPISI acik:         %' + Math.round(yuz(K2.kapiAcik, K2.kapiBakilan)) +
        '  (' + K2.kapiAcik + '/' + K2.kapiBakilan + ')');
    console.log('  aday planlarin UYGUNSUZ payi: %' + Math.round(yuz(K2.uygunsuz, K2.aday)) + ' (' + K2.uygunsuz + '/' + K2.aday + ')');
    console.log('  plan gecis SEBEPLERI:        ' + top(K2.gecis, 6).map(([k, v]) => k + '×' + v).join('  '));
    console.log('  skor SURUCULERI:             ' + top(K2.skorSebep, 8).map(([k, v]) => k).join(', '));
    const cd = K2.calkanti;
    console.log('  PLAN CALKANTISI: ' + cd.map(x => x.degisim + '/' + x.kararSayi).join('  ') +
        '   ort ' + f1(ort(cd.map(x => x.degisim))) + ' degisim/mac (' +
        f2(ort(cd.map(x => x.degisim / Math.max(1, x.sure / 60)))) + ' /dk)');
    console.log('');
}

// ═══════════ K3 — EMIR KATMANI ═══════════
if (katmanAcik(3)) {
    console.log('═══ K3  EMIR: dokum / birim-basi / hedef sicramasi ═══');
    for (const m of MACLAR) {
        const sonHedef = new Map();     // unitId -> {x,y,tick}
        let sicrama = 0, toplamEmir = 0;
        const birimEmir = new Map();
        for (const c of m.cd) {
            const cRed = (c.side === true || c.side === 'red');
            if ((cRed ? 'red' : 'blue') !== m.aiSide) continue;
            const ex = c.execution || {};
            for (const o of (ex.orders || [])) {
                K3.emir[o.kind || '?'] = (K3.emir[o.kind || '?'] || 0) + 1;
                const kok = String(o.reason || '').split(':').slice(2, 4).join(':');
                K3.sebep[kok || '?'] = (K3.sebep[kok || '?'] || 0) + 1;
                for (const id of (o.unitIds || [])) {
                    toplamEmir++;
                    birimEmir.set(id, (birimEmir.get(id) || 0) + 1);
                }
                for (const dst of (o.destinations || [])) {
                    const s = sonHedef.get(dst.id);
                    if (s) { const dd = Math.hypot(dst.x - s.x, dst.y - s.y);
                        if (dd > 300 && (c.tick - s.tick) <= 60) { sicrama++; K3.sicramaMes.push(dd); } }
                    sonHedef.set(dst.id, { x: dst.x, y: dst.y, tick: c.tick });
                }
            }
        }
        K3.birimEmir.push({ tohum: m.tohum, toplamEmir, birim: birimEmir.size,
            basi: toplamEmir / Math.max(1, birimEmir.size), sure: m.sure });
        K3.sicrama.push({ tohum: m.tohum, sicrama, sure: m.sure });
    }
    const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    const tE = Object.values(K3.emir).reduce((a, b) => a + b, 0);
    console.log('  emir TURU:      ' + top(K3.emir, 8).map(([k, v]) => k + ' %' + Math.round(yuz(v, tE))).join('  ') + '   (n=' + tE + ')');
    console.log('  emir SEBEBI:    ' + top(K3.sebep, 8).map(([k, v]) => (k || '?') + ' ×' + v).join('  '));
    console.log('  birim basi emir: ' + K3.birimEmir.map(x => f1(x.basi)).join('  ') + '   ort ' + f1(ort(K3.birimEmir.map(x => x.basi))));
    const sicToplam = K3.sicrama.reduce((a, b) => a + b.sicrama, 0);
    console.log('  HEDEF SICRAMASI (3sn icinde >300px hedef degisimi): ' + sicToplam +
        '  (' + K3.sicrama.map(x => x.sicrama).join(',') + ')   ort mesafe ' + f1(ort(K3.sicramaMes)) + 'px');
    console.log('  -> dakikada ' + f1(ort(K3.sicrama.map(x => x.sicrama / Math.max(1, x.sure / 60)))) + ' sicrama');
    console.log('');
}

// ═══════════ K4 — ZAMAN SEYRI ═══════════
if (katmanAcik(4)) {
    console.log('═══ K4  ZAMAN SEYRI (ortalama degil EGRI) ═══');
    const DILIM = 10;
    // hareket/ates olculeri fark-taramasi.js ile AYNI alanlara baglanir (u.speed BIRIM STATI, anlik hiz degil)
    const olc = (u) => ({ hareket: u.isMovingToManualTarget ? 1 : 0, bask: u.suppression || 0,
        net: u.netMaruziyet || 0, yol: u.katedilenYol || 0, menzil: u.enYakinDusman || 0,
        panik: (u.panicking || u.fleeing) ? 1 : 0, ates: u.attackTargetId != null ? 1 : 0 });
    const cizgi = [];
    for (let i = 0; i < DILIM; i++) {
        const I = { hareket: [], bask: [], net: [], yol: [], menzil: [], panik: [], ates: [], sayi: [] };
        const A = { hareket: [], bask: [], net: [], yol: [], menzil: [], panik: [], ates: [], sayi: [] };
        for (const m of MACLAR) {
            const a = Math.floor(m.sm.length * i / DILIM), b = Math.floor(m.sm.length * (i + 1) / DILIM);
            for (let k = a; k < b; k++) {
                const s = m.sm[k]; let ic = 0, ac = 0;
                for (const u of (s.units || [])) {
                    if (u.hp <= 0) continue;
                    const hedef = (u.side === m.insanSide) ? I : A; const o = olc(u);
                    hedef.hareket.push(o.hareket); hedef.bask.push(o.bask); hedef.net.push(o.net);
                    hedef.yol.push(o.yol); hedef.menzil.push(o.menzil); hedef.panik.push(o.panik); hedef.ates.push(o.ates);
                    if (u.side === m.insanSide) ic++; else ac++;
                }
                I.sayi.push(ic); A.sayi.push(ac);
            }
        }
        cizgi.push({ i, I, A });
    }
    console.log('  dilim | ' + 'CANLI'.padStart(11) + ' | ' + 'hareket%'.padStart(13) + ' | ' + 'baski'.padStart(13) +
        ' | ' + 'net maruziyet'.padStart(15) + ' | ' + 'ates%'.padStart(13));
    console.log('        | ' + 'ins   ai'.padStart(11) + ' | ' + 'ins    ai'.padStart(13) + ' | ' + 'ins    ai'.padStart(13) +
        ' | ' + 'ins     ai'.padStart(15) + ' | ' + 'ins    ai'.padStart(13));
    for (const c of cizgi) {
        console.log('   %' + String((c.i + 1) * 10).padEnd(4) + ' | ' +
            (f1(ort(c.I.sayi)) + ' ' + f1(ort(c.A.sayi))).padStart(11) + ' | ' +
            (f1(ort(c.I.hareket) * 100) + ' ' + f1(ort(c.A.hareket) * 100)).padStart(13) + ' | ' +
            (f1(ort(c.I.bask)) + ' ' + f1(ort(c.A.bask))).padStart(13) + ' | ' +
            (f2(ort(c.I.net)) + ' ' + f2(ort(c.A.net))).padStart(15) + ' | ' +
            (f1(ort(c.I.ates) * 100) + ' ' + f1(ort(c.A.ates) * 100)).padStart(13));
    }
    console.log('');
}

// ═══════════ K5 — BIRIM TIPI EKONOMISI ═══════════
if (katmanAcik(5)) {
    console.log('═══ K5  BIRIM TIPI EKONOMISI (kim kazandiriyor kim kaybettiriyor) ═══');
    for (const m of MACLAR) {
        const kutu = (taraf, tip) => { const K = (taraf === m.insanSide) ? K5.insan : K5.ai;
            if (!K[tip]) K[tip] = { verdi: 0, yedi: 0, olum: 0, oldurme: 0, sayi: 0 }; return K[tip]; };
        for (const e of m.ce) {
            const at = tipAd(e.attackerType), tt = tipAd(e.targetType);
            const as = e.attackerSide, ts = e.targetSide;
            kutu(as, at).verdi += (e.damage || 0);
            kutu(ts, tt).yedi += (e.damage || 0);
            if (e.lethal) { kutu(as, at).oldurme++; kutu(ts, tt).olum++; }
        }
        const ilk = m.sm[0] || { units: [] };
        for (const u of (ilk.units || [])) { const k = kutu(u.side, tipAd(u.type)); k.sayi++; }
    }
    const yaz = (ad, K) => {
        const sat = Object.entries(K).filter(([, v]) => v.sayi > 0 || v.verdi > 0 || v.yedi > 0)
            .map(([tip, v]) => ({ tip, ...v, net: v.verdi - v.yedi, orn: v.verdi / Math.max(1, v.yedi) }))
            .sort((a, b) => b.net - a.net);
        console.log('  ── ' + ad + ' ──');
        console.log('    ' + 'tip'.padEnd(20) + 'adet'.padStart(5) + 'verdi'.padStart(9) + 'yedi'.padStart(9) +
            'NET'.padStart(9) + 'oran'.padStart(7) + 'oldu'.padStart(6) + 'oldurdu'.padStart(8));
        for (const s of sat.slice(0, 14))
            console.log('    ' + s.tip.padEnd(20) + String(s.sayi).padStart(5) + f1(s.verdi).padStart(9) +
                f1(s.yedi).padStart(9) + ((s.net > 0 ? '+' : '') + f1(s.net)).padStart(9) +
                f2(s.orn).padStart(7) + String(s.olum).padStart(6) + String(s.oldurme).padStart(8));
    };
    yaz('INSAN', K5.insan); console.log(''); yaz('AI', K5.ai);
    console.log('');
}

// ═══════════ K6 — ORDU BILESIMI / BUTCE ═══════════
// K5 tum tiplerin AI'da net-negatif oldugunu gosterdi. O zaman asil soru: AI NEYI SATIN ALIYOR?
if (katmanAcik(6)) {
    console.log('═══ K6  ORDU BILESIMI — butce nereye gidiyor ═══');
    const say = { insan: {}, ai: {} };
    for (const m of MACLAR) {
        const ilk = m.sm[0] || { units: [] };
        for (const u of (ilk.units || [])) {
            const K = (u.side === m.insanSide) ? say.insan : say.ai;
            const tip = tipAd(u.type);
            if (!K[tip]) K[tip] = { adet: 0, para: 0, menzil: TIP_MENZIL[u.type] || 0 };
            K[tip].adet++; K[tip].para += (TIP_MALIYET[u.type] || 0);
        }
    }
    // menzil sinifi: uzun (>=10 kare), orta (5-10), kisa (<5)
    const sinif = (r) => r >= 10 ? 'UZUN' : (r >= 5 ? 'orta' : 'kisa');
    const yaz = (ad, K) => {
        const top = Object.values(K).reduce((a, b) => a + b.para, 0);
        const sat = Object.entries(K).map(([t, v]) => ({ t, ...v })).sort((a, b) => b.para - a.para);
        console.log('  ── ' + ad + ' ── toplam ' + f1(top) + '₺ / ' + sat.reduce((a, b) => a + b.adet, 0) + ' birim (6 mac toplami)');
        for (const s of sat.slice(0, 12))
            console.log('    ' + s.t.padEnd(20) + String(s.adet).padStart(4) + ' adet' +
                f1(s.para).padStart(9) + '₺  %' + String(Math.round(yuz(s.para, top))).padStart(2) +
                '   menzil ' + String(s.menzil).padStart(3) + ' ' + sinif(s.menzil));
        const bySinif = {}; for (const s of sat) bySinif[sinif(s.menzil)] = (bySinif[sinif(s.menzil)] || 0) + s.para;
        console.log('    MENZIL SINIFI PAYI: ' + ['UZUN', 'orta', 'kisa'].map(k => k + ' %' + Math.round(yuz(bySinif[k] || 0, top))).join('   '));
        return { top, bySinif };
    };
    const I = yaz('INSAN', say.insan); console.log(''); const A = yaz('AI', say.ai);
    console.log('');
}

// ═══════════ K7 — OLUM BAGLAMI / KIM KIMI OLDURUYOR ═══════════
if (katmanAcik(7)) {
    console.log('═══ K7  OLUM BAGLAMI: kim kimi, hangi mesafeden, hangi kalabaliktan ═══');
    const olum = { insan: [], ai: [] };
    const eslesme = { insan: {}, ai: {} };
    for (const m of MACLAR) {
        const tikler = m.sm.map(s => s.tick);
        const bul = (tik) => { let lo = 0, hi = tikler.length - 1, b = 0, bd = Infinity;
            while (lo <= hi) { const mid = (lo + hi) >> 1, dd = Math.abs(tikler[mid] - tik);
                if (dd < bd) { bd = dd; b = mid; } if (tikler[mid] < tik) lo = mid + 1; else hi = mid - 1; }
            return m.sm[b]; };
        for (const e of m.ce) {
            if (!e.lethal) continue;
            const kurbanAI = (e.targetSide === m.aiSide);
            const K = kurbanAI ? olum.ai : olum.insan;
            const mes = Math.hypot((e.attackerX - e.targetX), (e.attackerY - e.targetY));
            const s = bul(e.tick); let dost = 0, dusman = 0;
            for (const u of ((s && s.units) || [])) {
                if (u.id === e.targetId || u.hp <= 0) continue;
                if (Math.hypot(u.x - e.targetX, u.y - e.targetY) > 600) continue;
                if (u.side === e.targetSide) dost++; else dusman++;
            }
            K.push({ mes, dost, dusman, rear: !!e.rearHit, flank: !!e.flankHit,
                     katil: tipAd(e.attackerType), kurban: tipAd(e.targetType) });
            const EK = kurbanAI ? eslesme.insan : eslesme.ai;   // olduren tarafin eslesmesi
            const k = tipAd(e.attackerType) + ' > ' + tipAd(e.targetType);
            EK[k] = (EK[k] || 0) + 1;
        }
    }
    console.log('  ' + 'kurban'.padEnd(8) + 'olum'.padStart(6) + 'ort mesafe'.padStart(12) +
        'YALNIZ(dost<=1)'.padStart(16) + 'KUTLE(dost>=4)'.padStart(15) + 'arka/kanat'.padStart(12));
    for (const [ad, K] of [['INSAN', olum.insan], ['AI', olum.ai]]) {
        if (!K.length) continue;
        console.log('  ' + ad.padEnd(8) + String(K.length).padStart(6) + f1(ort(K.map(x => x.mes))).padStart(12) +
            ('%' + Math.round(yuz(K.filter(x => x.dost <= 1).length, K.length))).padStart(16) +
            ('%' + Math.round(yuz(K.filter(x => x.dost >= 4).length, K.length))).padStart(15) +
            ('%' + Math.round(yuz(K.filter(x => x.rear || x.flank).length, K.length))).padStart(12));
    }
    console.log('');
    const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    console.log('  INSANIN en cok kullandigi OLDURME esleşmesi:');
    for (const [k, v] of top(eslesme.insan, 8)) console.log('    ' + String(v).padStart(4) + '  ' + k);
    console.log('  AI\'IN en cok kullandigi OLDURME esleşmesi:');
    for (const [k, v] of top(eslesme.ai, 8)) console.log('    ' + String(v).padStart(4) + '  ' + k);
    console.log('');
}

// ═══════════ K8 — MENZIL SINIFINA GORE MARUZIYET ═══════════
// "insanin hasari HIC maruz kalmayan birimlerden mi geliyor?" sorusunu dogrudan olcer.
if (katmanAcik(8)) {
    console.log('═══ K8  MENZIL SINIFINA GORE MARUZIYET (hasar nereden geliyor, bedelini kim oduyor) ═══');
    const sinif = (r) => r >= 10 ? 'UZUN' : (r >= 5 ? 'orta' : 'kisa');
    const K = { insan: {}, ai: {} };
    for (const m of MACLAR) {
        const kutu = (side, sn) => { const T = (side === m.insanSide) ? K.insan : K.ai;
            if (!T[sn]) T[sn] = { verdi: 0, yedi: 0, olum: 0, tik: 0, netTop: 0, baskiTop: 0 }; return T[sn]; };
        for (const e of m.ce) {
            kutu(e.attackerSide, sinif(TIP_MENZIL[e.attackerType] || 0)).verdi += (e.damage || 0);
            kutu(e.targetSide, sinif(TIP_MENZIL[e.targetType] || 0)).yedi += (e.damage || 0);
            if (e.lethal) kutu(e.targetSide, sinif(TIP_MENZIL[e.targetType] || 0)).olum++;
        }
        for (const s of m.sm) for (const u of (s.units || [])) {
            if (u.hp <= 0) continue;
            const b = kutu(u.side, sinif(TIP_MENZIL[u.type] || 0));
            b.tik++; b.netTop += (u.netMaruziyet || 0); b.baskiTop += (u.suppression || 0);
        }
    }
    for (const [ad, T] of [['INSAN', K.insan], ['AI', K.ai]]) {
        const top = Object.values(T).reduce((a, b) => a + b.verdi, 0);
        console.log('  ── ' + ad + ' ──   ' + 'sinif'.padEnd(7) + 'verdigi'.padStart(10) + 'pay'.padStart(6) +
            'yedigi'.padStart(10) + 'oran'.padStart(7) + 'olum'.padStart(6) + 'net maruz.'.padStart(12) + 'baski'.padStart(8));
        for (const sn of ['UZUN', 'orta', 'kisa']) {
            const v = T[sn]; if (!v) continue;
            console.log('             ' + sn.padEnd(7) + f1(v.verdi).padStart(10) +
                ('%' + Math.round(yuz(v.verdi, top))).padStart(6) + f1(v.yedi).padStart(10) +
                f2(v.verdi / Math.max(1, v.yedi)).padStart(7) + String(v.olum).padStart(6) +
                f2(v.netTop / Math.max(1, v.tik)).padStart(12) + f1(v.baskiTop / Math.max(1, v.tik)).padStart(8));
        }
        console.log('');
    }
}
