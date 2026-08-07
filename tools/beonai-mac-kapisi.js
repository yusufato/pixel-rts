// BEONAI MAC KAPISI — "model kod-AI'yi MACTA yeniyor mu?"
//
// NEDEN AYRI ARAC: egitim ciktisindaki top1/regret KARAR SECME olculeridir. beonai v1 tam burada
// yanildi: karar seviyesinde kod-AI'dan iyiydi ama MAC SONUCU degismedi. Bu oturumda da mekanizma
// metriginin mac sonucunu TERS tahmin ettigi uc vaka gorduk. Karar: yalniz bu kapi baglayicidir.
//
// TASARIM (demet-savas.js ile ayni, orada eslestirilmis fark std'si 427 olculdu — marj std'si
// 3114 iken 24 macla kucuk etkiler bile gorulebiliyor):
//   * ESLESTIRILMIS FARK : ayni tohumda hem kod-AI hem model kosar, fark tohum-ici alinir.
//   * TARAF-BASI         : model YALNIZ kirmiziya verilir; mavi iki kolda da AYNI.
//   * SIZINTI YOK        : her kolun basinda TUM bayraklar acikca kurulur.
//   * DETERMINIZM        : --determinizm ayni kolu iki kez kosar, birebir ayniligi kanitlar.
//
// ONEMLI: veri uretimi pro-KAPALI yapildi (beonai-uret.js: BATTLE_INTEL4PRO_*=false), yani model
// TEMEL intel4'u gelistirmeyi ogrendi. Adil kiyas pro-KAPALI tabandir; --pro ile pro-ACIK da
// olculebilir ama o EGITIM DAGILIMI DISIDIR ve sonucu oyle okunmalidir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 24)) || 24);
const ATLA = Math.max(0, Number(arg('--atla', 0)) || 0);
const SURUMLER = String(arg('--surum', 'beonai-karisim,beonai-oracle-taban')).split(',').filter(Boolean);
const PRO = process.argv.includes('--pro');
const DET = process.argv.includes('--determinizm');
const ROL = arg('--rol', 'her');
const ORACLE_SN = Math.max(5, Number(arg('--oracle-sn', 25)) || 25);   // TAVAN kolu yuvarlama suresi
const GV2 = process.argv.includes('--gramer-v2');   // GENISLETILMIS karar uzayi (tavan bu uzayda ne kadar)
const KOTA = Math.max(16, Number(arg('--kota', 64)) || 64);

// EGITIM TOHUMLARI 7000-7899 idi -> kapi BASKA tohumlar kullanir (ezberi olcmeyelim)
const HAVUZ = [2024, 3141, 777, 11, 202, 333, 4001, 4003, 4007, 4013, 4019, 4021,
               4027, 4049, 4051, 4057, 4073, 4079, 4091, 4093, 4099, 4111, 4127, 4129,
               4133, 4139, 4157, 4159, 4177, 4201, 4211, 4217, 4219, 4229, 4231, 4241];
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);

const { ctx } = tezgahKur();

function kos(surum, seed, kirmiziSaldiran) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_GRAMMAR_V2 = ' + GV2 + '; BATTLE_GRAMMAR_KOTA = ' + KOTA + ';',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = ' + PRO + '; BATTLE_INTEL4PRO_BLUE = ' + PRO + ';',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        // TAVAN KOLU: surum "ORACLE" ise secimi MODEL degil ORACLE yapar (mukemmel secici ust siniri)
        (surum === 'ORACLE'
            ? 'BATTLE_BEONAI_RED = null; BATTLE_BEONAI_BLUE = null;'
            : 'BATTLE_BEONAI_RED = ' + (surum ? JSON.stringify(surum) : 'null') + '; BATTLE_BEONAI_BLUE = null;'),
        'BATTLE_RECIPE_RED = null;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"bk", ally:true });',
        'startBattle();',
        (surum === 'ORACLE'
            ? 'battleSelectorOracleEnableFor(([...BATTLE_CONTROLLERS.values()].find(c => c.side === true) || {}).id, ' + ORACLE_SN + ');'
            : 'if (typeof battleSelectorOracleDisable === "function") battleSelectorOracleDisable();'),
        // BAGLANMA KANITI: model gercekten devrede mi (sessizce hicbir sey yapmiyor olabilir)
        'const bagli = (typeof battleBeonaiDurum === "function") ? battleBeonaiDurum() : null;',
        // FAZ 0.1 — YAYILIM OLCUMU. Canli maclarda beonai 240px'e buzulup eridi (kendi baskisi 87.6).
        // Ayni tanim burada da kullanilir: KIRMIZI birimlerin ortalama IKILI mesafesi + 600px
        // cemberdeki en kalabalik birim sayisi (balistigin aoe'si tam bu) + ortalama oz baski.
        'const _yay = { mesafe: 0, yogun: 0, baski: 0, n: 0 };',
        'const _yayOlc = () => {',
        '  const a = SIM.units.filter(u => !u.dead && !u.loaded && u.isRed);',
        '  if (a.length < 2) return;',
        '  let t = 0, c = 0, maxY = 0;',
        '  for (let i = 0; i < a.length; i++) { let yakin = 0;',
        '    for (let j = 0; j < a.length; j++) { if (i === j) continue;',
        '      const d = Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y);',
        '      if (j > i) { t += d; c++; }',
        '      if (d <= 600) yakin++; }',
        '    if (yakin + 1 > maxY) maxY = yakin + 1; }',
        '  _yay.mesafe += c ? t / c : 0; _yay.yogun += maxY;',
        '  _yay.baski += a.reduce((x, u) => x + (u.suppression || 0), 0) / a.length; _yay.n++;',
        '};',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  if (SIM.tick % 100 === 0) _yayOlc();',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        'BATTLE_BEONAI_RED = null;',
        'return JSON.stringify({ marj: Math.round(oS.effectiveValue - oD.effectiveValue),',
        '  bitisTik: SIM.tick, kazanan: b.winnerSide === true ? 1 : (b.winnerSide === false ? 0 : -1),',
        '  yayilim: _yay.n ? Math.round(_yay.mesafe / _yay.n) : 0,',
        '  yogunluk: _yay.n ? +(_yay.yogun / _yay.n).toFixed(1) : 0,',
        '  ozBaski: _yay.n ? +(_yay.baski / _yay.n).toFixed(1) : 0,',
        '  bagli: ' + (surum === 'ORACLE' ? '"ORACLE-POLITIKA"' : '(bagli ? (bagli.kirmizi || null) : null)') + ' });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'bk.js' }));
}

console.log('BEONAI MAC KAPISI — ' + TOHUMLAR.length + ' tohum' + (ROL === 'her' ? ' x 2 rol' : '') +
    '   pro: ' + (PRO ? 'ACIK' : 'KAPALI') + '   gramer: ' + (GV2 ? 'v2 GENIS' : 'v1') + '   kota: ' + KOTA);
console.log('  surumler: ' + SURUMLER.join(', ') + '   taban: kod-AI (model YOK)');
console.log('');

if (DET) {
    const a1 = kos(SURUMLER[0], TOHUMLAR[0], true), a2 = kos(SURUMLER[0], TOHUMLAR[0], true);
    console.log('  DETERMINIZM: ' + (JSON.stringify(a1) === JSON.stringify(a2) ? 'BIREBIR AYNI' : '*** SAPMA ***'));
    console.log('    ' + JSON.stringify(a1));
    console.log('');
    if (JSON.stringify(a1) !== JSON.stringify(a2)) process.exit(1);
}

const roller = ROL === 'her' ? [true, false] : [ROL === 'saldiran'];
const sonuc = {};
for (const s of SURUMLER) sonuc[s] = [];
let baglantiKanit = null;

const t0 = Date.now();
for (const kirmiziSaldiran of roller) {
    for (const seed of TOHUMLAR) {
        const taban = kos(null, seed, kirmiziSaldiran);
        for (const s of SURUMLER) {
            const m = kos(s, seed, kirmiziSaldiran);
            if (!baglantiKanit && m.bagli) baglantiKanit = m.bagli;
            sonuc[s].push({ seed, rol: kirmiziSaldiran ? 'sal' : 'sav',
                taban: taban.marj, model: m.marj, fark: m.marj - taban.marj,
                yayTaban: taban.yayilim, yayModel: m.yayilim,
                yogTaban: taban.yogunluk, yogModel: m.yogunluk,
                bskTaban: taban.ozBaski, bskModel: m.ozBaski,
                kazTaban: taban.kazanan, kazModel: m.kazanan });
        }
    }
}
const gecen = ((Date.now() - t0) / 1000).toFixed(0);

console.log('  BAGLANMA KANITI (model gercekten devrede mi): ' +
    (baglantiKanit ? JSON.stringify(baglantiKanit) : '*** MODEL BAGLANMADI — sonuc anlamsiz ***'));
console.log('');

function ist(xs) {
    const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n;
    const v = n > 1 ? xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1) : 0;
    return { n, ort: m, std: Math.sqrt(v), sh: Math.sqrt(v / n) };
}
console.log('  ' + 'surum'.padEnd(24) + 'esl.fark'.padStart(10) + 'std.hata'.padStart(10) +
    '     t'.padStart(8) + '  lehte'.padStart(9) + '   galibiyet (taban->model)'.padStart(28));
for (const s of SURUMLER) {
    const f = sonuc[s].map(x => x.fark);
    const st = ist(f);
    const kt = sonuc[s].filter(x => x.kazTaban === 1).length;
    const km = sonuc[s].filter(x => x.kazModel === 1).length;
    console.log('  ' + s.padEnd(24) + ((st.ort > 0 ? '+' : '') + st.ort.toFixed(0)).padStart(10) +
        st.sh.toFixed(0).padStart(10) + (st.sh ? (st.ort / st.sh).toFixed(2) : '-').padStart(8) +
        (f.filter(x => x > 0).length + '/' + f.length).padStart(9) +
        (kt + '/' + f.length + ' -> ' + km + '/' + f.length).padStart(28));
}
console.log('');
console.log('  FAZ 0.1 — BLOB OLCUMU (KIRMIZI = AI). Canli macta beonai 240px/87.6 baski ile eridi.');
console.log('  ' + 'surum'.padEnd(24) + 'yayilim (taban->kol)'.padStart(22) +
    '  600px-yogunluk'.padStart(18) + '   oz baski'.padStart(14));
for (const s of SURUMLER) {
    const r = sonuc[s];
    const o = (f) => (r.reduce((a, x) => a + x[f], 0) / Math.max(1, r.length));
    console.log('  ' + s.padEnd(24) +
        (Math.round(o('yayTaban')) + 'px -> ' + Math.round(o('yayModel')) + 'px').padStart(22) +
        (o('yogTaban').toFixed(1) + ' -> ' + o('yogModel').toFixed(1)).padStart(18) +
        (o('bskTaban').toFixed(1) + ' -> ' + o('bskModel').toFixed(1)).padStart(14));
}

// ── DAVRANIS KAPISI (FAZ 3'un 2. kapisi) ──────────────────────────────────────────────────────
// Dunku hata: odul yalniz ETIKET kapisinda sinandi ve "duzeldi" denildi. Modelin OYNAYISI hic
// olculmedi. Bu kapi onu olcer ve GECTI/KALDI der. Olcut kod-AI TABANINA goredir:
//   * yayilim taban seviyesinin %85'inin altina DUSMEMELI (blob yok)
//   * 600px yerel yogunluk tabani %15'ten fazla ASMAMALI (alan atesi hedefi buyumesin)
//   * oz baski tabani %25'ten fazla ASMAMALI (civilenme yok)
// Canli macta beonai: yayilim 240px (taban ~1100), oz baski 87.6 (taban ~35) -> bu kapi onu
// KESINLIKLE elerdi. Kapi gecilmeden mac kapisina guvenilmez.
console.log('');
console.log('  DAVRANIS KAPISI (FAZ 3/2) — olcut: yayilim >= taban %85, yogunluk <= %115, baski <= %125');
for (const s of SURUMLER) {
    const r = sonuc[s];
    const o = (f) => (r.reduce((a, x) => a + x[f], 0) / Math.max(1, r.length));
    const yO = o('yayTaban') ? o('yayModel') / o('yayTaban') : 1;
    const gO = o('yogTaban') ? o('yogModel') / o('yogTaban') : 1;
    const bO = o('bskTaban') > 0.5 ? o('bskModel') / o('bskTaban') : 1;
    const gecti = (yO >= 0.85) && (gO <= 1.15) && (bO <= 1.25);
    // ORNEKLEM UYARISI: yayilim tohumdan tohuma cok oynuyor. Ayni model 2 tohumda %76 (KALDI),
    // 24 macta %106 (GECTI) verdi. Hukum ancak >=24 macla anlamlidir.
    console.log('  ' + s.padEnd(24) +
        ('yayilim %' + Math.round(yO * 100)).padStart(14) +
        ('yogunluk %' + Math.round(gO * 100)).padStart(15) +
        ('baski %' + Math.round(bO * 100)).padStart(13) +
        '   ' + (r.length < 24 ? '(orneklem<24 — HUKUM YOK)' : (gecti ? 'GECTI' : '*** KALDI ***')));
}
console.log('');
console.log('  OKUMA: |t| >= 2 ~ %95 anlamli. |t| < 2 ise "fark GOSTERILEMEDI" denir, "fark yok" DENMEZ.');
console.log('  sure: ' + gecen + 'sn');
fs.writeFileSync(arg('--out', 'qa-runtime/beonai-mac-kapisi.json'),
    JSON.stringify({ tohumlar: TOHUMLAR, roller, pro: PRO, sonuc, baglantiKanit }, null, 1));
