// TEPKI GECIKMESI DENETIMI — AI bir olayi gorduktan KAC SANIYE SONRA davranisini degistiriyor?
//
// NEDEN BU YONTEM (projenin kendi sicili):
//   · YAPISAL kusur duzeltmeleri kazandirdi: tahsis metrigi, konuslandirma derinligi, kesif onceligi,
//     durum kategorilerinde HAVA sinifinin HIC OLMAMASI, SUPPORT yurutme dali → olcut +596 → −1417.
//   · AYAR denemelerinin sicili ~0: jammerPost, jammerUmbrella, armorFace, localRatio, indirectCreep,
//     resupplyRun, supplyEscort, adUmbrella, AD payi, UNCERTAIN kesfi, kompozisyon aramasi — hepsi elendi.
//   Fark: ayar "bu sayi daha iyi olabilir mi?" diye sorar, cevap 3100 puanlik marj gurultusunde kaybolur.
//   Kusur "bu sey CALISIYOR MU?" diye sorar; cevap IKILI, gurultusuz ve ucuzdur.
//
// SORU: her olay sinifi icin AI'in TEPKI SURESI nedir? Tepki YOKSA orada bir yetenek YOKTUR —
// bu bir ayar degil KUSURDUR ve bulundugunda kazanc yapisal olur (hava kategorisi boyle bulunmustu).
//
// OLCULEN OLAYLAR (hepsi motordan, tureti yok):
//   E1 DUSMAN HAVASI GORUNDU  → ilk hava-hedefli atisimiza kadar gecen sure
//   E2 DOLAYLI BIRIM VURULDU  → yer degistiriyor mu (shoot-and-scoot), taban yer degistirmeye gore
//   E3 BIRIM KURUDU (ammo 0)  → ikmal kaynagina yaklasiyor mu
//   E4 SEKTOR COKTU (%50 kayip) → o sektordeki dost sayisi toparliyor mu (kuvvet kaydirma)
//
// ALAN SOZLESMESI (DOGRULANDI, varsayilmadi — canli SIM birimi telemetriden FARKLI):
//   canli birimde `attackTargetId` YOKTUR (o telemetri alani). Canlida: lastAttackTime, lastHitTime,
//   combatState, enemyInVision, ammo/maxAmmo, supplyCut, supplyDist, isIndirect, isAir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N_MAC = Math.max(1, Number(arg('--mac', 8)) || 8);
const BEYIN = arg('--beyin', 'pro');
const HAVUZ = []; for (let i = 0; i < 64; i++) HAVUZ.push(100000 + i * 229);
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };
const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran) {
    const kod = `(() => {
    BATTLE_RECIPE_RED = null;
    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
    BATTLE_INTEL4PRO_RED = ${BEYIN === 'pro'}; BATTLE_INTEL4PRO_BLUE = true;
    BATTLE_INTEL4PRO_DELTAS_RED = null; BATTLE_INTEL4PRO_DELTAS_BLUE = null;
    BATTLE_EXPLOITER_RED = null; BATTLE_EXPLOITER_BLUE = null;
    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${kirmiziSaldiran},
        durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
        brainIntel4:true, isAttacker:${!kirmiziSaldiran} }), false, { source:'tg', ally:true });
    startBattle();

    const SN = (tik) => Math.round(tik * BATTLE_TICK_SEC * 10) / 10;
    const havaMi = (u) => !!u.isAir;
    const R_SEKTOR = 4;                                  // x eksenini 4 sutuna bol
    const sektor = (u) => Math.min(R_SEKTOR - 1, Math.max(0, Math.floor(u.x / (WORLD_W / R_SEKTOR))));

    // ── OLAY ve TEPKI izleyicileri ──
    let e1OlayTik = null, e1TepkiTik = null;             // hava goruldu → ilk hava-hedefli atisimiz
    const e2 = [];                                       // {tik, id, x, y, tepkiPx}
    const e3 = [];                                       // {tik, id, mesafe0, mesafeSon}
    const e4 = [];                                       // {tik, sektor, adet0, adetSon}
    const izlenenVurus = new Map();                      // id -> {tik, x, y}
    const izlenenKuru = new Map();                       // id -> {tik, mesafe}
    const izlenenSektor = new Map();                     // sektor -> {tik, adet}
    let oncekiHit = new Map(), oncekiAmmo = new Map(), sonSeq = -1;
    let sektorTaban = null;
    const sektorBitti = new Set();   // her sektor mac basina EN FAZLA BIR olay

    const ikmalKaynagi = (u) => { const s = STATS[u.type]; return !!(s && s.aura && s.aura.type === 'resupply'); };
    const enYakinIkmal = (u) => {
        let en = Infinity;
        for (const f of SIM.units) { if (f.dead || f.isRed !== u.isRed || !ikmalKaynagi(f)) continue;
            const d = Math.hypot(f.x - u.x, f.y - u.y); if (d < en) en = d; }
        return en;
    };

    const ph = SIM.headless; SIM.headless = true; let st = 0;
    try {
        while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
            st += BATTLE_TICK_MS;
            stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
            if (SIM.tick % 10 !== 0) continue;
            const canli = SIM.units.filter(u => !u.dead && !u.loaded && !u.abandoned);
            const kirmizi = canli.filter(u => u.isRed);

            // ── E1: dusman havasi GORUNDU (herhangi bir kirmizi birimin gorusunde) ──
            if (e1OlayTik == null) {
                for (const h of canli) {
                    if (h.isRed || !havaMi(h)) continue;
                    for (const a of kirmizi) {
                        if (Math.hypot(a.x - h.x, a.y - h.y) <= (STATS[a.type].vision || 0)) { e1OlayTik = SIM.tick; break; }
                    }
                    if (e1OlayTik != null) break;
                }
            }
            // TEPKI: forensik olaylarda kirmizi -> HAVA hedefi ilk atis
            if (typeof BATTLE_FORENSIC !== 'undefined') {
                for (const ev of BATTLE_FORENSIC.buf) {
                    if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;
                    if (e1TepkiTik == null && ev.attackerSide === 'red') {
                        const ts = STATS[ev.targetType];
                        if (ts && (ts.category === 'air' || ts.category === 'uav')) e1TepkiTik = ev.tick;
                    }
                }
            }

            // ── E2: DOLAYLI BIRIM VURULDU → 10sn icinde yer degistiriyor mu ──
            for (const u of kirmizi) {
                if (!u.isIndirect) continue;
                const onc = oncekiHit.get(u.id);
                if (onc != null && (u.lastHitTime || 0) > onc && !izlenenVurus.has(u.id)) {
                    izlenenVurus.set(u.id, { tik: SIM.tick, x: u.x, y: u.y });
                }
                oncekiHit.set(u.id, u.lastHitTime || 0);
            }
            for (const [id, o] of [...izlenenVurus]) {
                if (SIM.tick - o.tik < 200) continue;            // 10sn
                const u = SIM.units.find(x => x.id === id);
                e2.push({ tepkiPx: (u && !u.dead) ? Math.round(Math.hypot(u.x - o.x, u.y - o.y)) : null });
                izlenenVurus.delete(id);
            }

            // ── E3: BIRIM KURUDU (ammo 0) → 20sn icinde ikmale yaklasiyor mu ──
            for (const u of kirmizi) {
                if (!u.maxAmmo) continue;
                const onc = oncekiAmmo.get(u.id);
                if (onc != null && onc > 0 && (u.ammo || 0) <= 0 && !izlenenKuru.has(u.id)) {
                    izlenenKuru.set(u.id, { tik: SIM.tick, mesafe: enYakinIkmal(u) });
                }
                oncekiAmmo.set(u.id, u.ammo || 0);
            }
            for (const [id, o] of [...izlenenKuru]) {
                if (SIM.tick - o.tik < 400) continue;            // 20sn
                const u = SIM.units.find(x => x.id === id);
                if (u && !u.dead && Number.isFinite(o.mesafe)) {
                    e3.push({ once: Math.round(o.mesafe), sonra: Math.round(enYakinIkmal(u)) });
                }
                izlenenKuru.delete(id);
            }

            // ── E4: SEKTOR COKTU (%50 kayip) → 30sn icinde toparliyor mu ──
            // ⚠ ARAC HATASI ve DUZELTMESI: taban ILK ornekten aliniyordu (ordu henuz yayilmamis) ve
            // bir sektor her tik yeniden olay uretiyordu → 4 macta 152 sahte olay, sektor basi ort. 0.6 birim.
            // DUZELTME: taban 30sn'de SABITLENIR, her sektor mac basina EN FAZLA BIR kez olay uretir.
            const say = new Array(R_SEKTOR).fill(0);
            for (const u of kirmizi) say[sektor(u)]++;
            if (sektorTaban == null && SIM.tick >= 600) sektorTaban = say.slice();
            if (sektorTaban) for (let s = 0; s < R_SEKTOR; s++) {
                if (sektorBitti.has(s)) continue;
                if (!izlenenSektor.has(s) && sektorTaban[s] >= 3 && say[s] <= sektorTaban[s] * 0.5) {
                    // TEPKI TURUNU AYIRT ET: sektordeki birimler OLUYOR MU, CEKILIYOR MU?
                    // "Takviye yok" tek basina kusur DEGIL — cokmus sektoru takviye etmek yanlis da
                    // olabilir ("yenilgiyi takviye etme"). Dogru tepki cekilme OLABILIR. Bu yuzden
                    // olay anindaki birim kimlikleri saklanir ve +30sn'de olen/cekilen/kalan ayrilir.
                    const kimlikler = kirmizi.filter(u => sektor(u) === s).map(u => u.id);
                    izlenenSektor.set(s, { tik: SIM.tick, adet: say[s], kimlikler });
                    sektorBitti.add(s);
                }
            }
            for (const [s, o] of [...izlenenSektor]) {
                if (SIM.tick - o.tik < 600) continue;            // 30sn
                let olen = 0, cekilen = 0, kalan = 0;
                for (const id of o.kimlikler) {
                    const u = SIM.units.find(x => x.id === id);
                    if (!u || u.dead) olen++;
                    else if (sektor(u) !== s) cekilen++;
                    else kalan++;
                }
                e4.push({ once: o.adet, sonra: say[s], olen, cekilen, kalan });
                izlenenSektor.delete(s);
            }
        }
    } finally { SIM.headless = ph; }

    return JSON.stringify({
        e1Olay: e1OlayTik == null ? null : SN(e1OlayTik),
        e1Tepki: e1TepkiTik == null ? null : SN(e1TepkiTik),
        e1Gecikme: (e1OlayTik != null && e1TepkiTik != null) ? SN(e1TepkiTik - e1OlayTik) : null,
        e2, e3, e4
    });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'tg.js' }));
}

yaz('TEPKI GECIKMESI DENETIMI — kod-AI [' + BEYIN + ']');
yaz('  ' + N_MAC + ' tohum x 2 rol = ' + (N_MAC * 2) + ' mac');
yaz('  SORU: olay olduktan KAC SANIYE sonra davranis degisiyor? Degismiyorsa yetenek YOKTUR (kusur).');
yaz('');
const E1 = [], E2 = [], E3 = [], E4 = [];
let e1OlayVar = 0, e1TepkiVar = 0, mac = 0;
for (let i = 0; i < N_MAC; i++) {
    for (const rol of [true, false]) {
        const r = kos(HAVUZ[i], rol);
        mac++;
        if (r.e1Olay != null) { e1OlayVar++; if (r.e1Tepki != null) { e1TepkiVar++; E1.push(r.e1Gecikme); } }
        E2.push(...r.e2); E3.push(...r.e3); E4.push(...r.e4);
        yaz('  [' + mac + '/' + (N_MAC * 2) + '] tohum ' + HAVUZ[i] + ' ' + (rol ? 'SALD' : 'SAVU') +
            '  E1 gecikme ' + (r.e1Gecikme == null ? (r.e1Olay == null ? 'olay yok' : 'TEPKI YOK') : r.e1Gecikme + 'sn') +
            '   E2 ' + r.e2.length + '  E3 ' + r.e3.length + '  E4 ' + r.e4.length);
    }
}
const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const med = (a) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
yaz('');
yaz('  ══ E1 — DUSMAN HAVASI GORUNDU → ilk hava-hedefli atisimiz ══');
yaz('    olay gerceklesen mac : ' + e1OlayVar + '/' + mac);
yaz('    TEPKI VEREN          : ' + e1TepkiVar + '/' + e1OlayVar +
    (e1OlayVar ? ('   %' + Math.round(e1TepkiVar / e1OlayVar * 100)) : ''));
yaz('    gecikme              : medyan ' + med(E1) + 'sn   ort ' + ort(E1).toFixed(1) + 'sn' +
    (E1.length ? ('   en kotu ' + Math.max(...E1) + 'sn') : ''));
yaz('');
yaz('  ══ E2 — DOLAYLI BIRIM VURULDU → 10sn icinde yer degistirme ══');
const e2v = E2.filter(x => x.tepkiPx != null).map(x => x.tepkiPx);
yaz('    olay: ' + E2.length + '   olcülebilen: ' + e2v.length);
yaz('    yer degistirme: medyan ' + med(e2v) + 'px   ort ' + Math.round(ort(e2v)) + 'px' +
    '   HIC KIMILDAMAYAN %' + (e2v.length ? Math.round(e2v.filter(x => x < 20).length / e2v.length * 100) : 0));
yaz('');
yaz('  ══ E3 — BIRIM KURUDU → 20sn icinde ikmale yaklasma ══');
yaz('    olay: ' + E3.length);
if (E3.length) {
    const fark = E3.map(x => x.sonra - x.once);
    yaz('    ikmal mesafesi: ' + Math.round(ort(E3.map(x => x.once))) + 'px -> ' +
        Math.round(ort(E3.map(x => x.sonra))) + 'px   (fark ' + Math.round(ort(fark)) + 'px)');
    yaz('    YAKLASAN birim: %' + Math.round(fark.filter(x => x < -50).length / fark.length * 100));
}
yaz('');
yaz('  ══ E4 — SEKTOR COKTU (%50 kayip) → 30sn icinde toparlanma ══');
yaz('    olay: ' + E4.length);
if (E4.length) {
    const fark = E4.map(x => x.sonra - x.once);
    yaz('    sektordeki dost: ' + ort(E4.map(x => x.once)).toFixed(1) + ' -> ' + ort(E4.map(x => x.sonra)).toFixed(1) +
        '   TAKVIYE EDILEN %' + Math.round(fark.filter(x => x > 0).length / fark.length * 100));
    const top = E4.reduce((a, x) => a + x.olen + x.cekilen + x.kalan, 0) || 1;
    yaz('    olay anindaki birimlerin 30sn sonraki hali:  OLDU %' + Math.round(E4.reduce((a,x)=>a+x.olen,0)/top*100) +
        '   CEKILDI %' + Math.round(E4.reduce((a,x)=>a+x.cekilen,0)/top*100) +
        '   YERINDE %' + Math.round(E4.reduce((a,x)=>a+x.kalan,0)/top*100));
    yaz('    (CEKILDI yuksekse AI bilincli geri cekiliyor = tepki VAR; OLDU yuksekse tepki YOK)');
}
yaz('');
yaz('  YORUM KURALI: tepki orani DUSUK ya da gecikme YUKSEK olan olay sinifi = EKSIK YETENEK (kusur).');
yaz('                Bu bir ayar sorusu DEGILDIR; bar ikilidir (tepki var/yok).');
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'tepki-gecikmesi.json'),
    JSON.stringify({ E1, E2, E3, E4, e1OlayVar, e1TepkiVar, mac }, null, 1));
