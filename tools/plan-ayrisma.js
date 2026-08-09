// PLAN AYRISMASI — iki UC plan enjekte edilince birimler GERCEKTEN ayrisiyor mu?
//
// AYIRT EDICI DENEY (2026-08-09). Elimde iki celisen olcum var:
//   PLAN duzeyinde: 64 aday -> ort 38.4 FARKLI plan (etkin/nominal %60) — cesitlilik KORUNUYOR
//   ODUL duzeyinde: 64 aday -> medyan 7 farkli sonuc, en buyuk kume 20 aday — cesitlilik KAYBOLUYOR
// Cokus PLAN ile ODUL arasinda. Iki aday aciklama:
//   (a) YURUTME farkli planlardan ayni davranisi uretiyor
//   (b) 25sn'lik ufuk farki gormeye yetmiyor / odul gurultusu yutuyor
//
// Bu arac (a) ile (b)'yi ayirir: iki UC plani ayni durumdan enjekte edip 30sn kosturur ve
// birimlerin KONUM AYRISMASINI olcer. Kodun kendi notu (js/BattleOracle.js:245) bu olcumu daha once
// yapmis ve 169px bulmus (5100px haritada %3.3) — sektor etiketi eklenerek kismen duzeltilmisti.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--mac', 4)) || 4);
const TIK = Number(arg('--tik', 900)) || 900;
const SURE = Number(arg('--sure', 600)) || 600;   // 30sn
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };
const { ctx } = tezgahKur();

function kos(seed) {
    const kod = [
        '(() => { try {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"pa", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'while (SIM.tick < ' + TIK + ' && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st); }',
        'if (phase !== PHASE.BATTLE) { SIM.headless = ph; return JSON.stringify({ err: "mac bitti" }); }',
        'const ctrl = [...BATTLE_CONTROLLERS.values()].find(c => c.side === true);',
        'const cp = ctrl && ctrl.currentPlan;',
        'if (!ctrl || !cp) { SIM.headless = ph; return JSON.stringify({ err: "kontrolor/plan yok" }); }',
        'const gctx = battleOracleGrammarContext(ctrl, true);',
        'const adaylar = operationGrammarGenerate(gctx);',
        'if (!adaylar || adaylar.length < 2) { SIM.headless = ph; return JSON.stringify({ err: "aday yok" }); }',
        // EN UC IKI ADAY: niyet+sektor+tempo olarak en farkli olan cift
        'let A = null, B = null, enUzak = -1;',
        'for (let i = 0; i < adaylar.length; i++) for (let j = i + 1; j < adaylar.length; j++) {',
        '  const a = adaylar[i], b = adaylar[j];',
        '  let d = 0;',
        '  if (a.intent !== b.intent) d += 2;',
        '  if (a.tempo !== b.tempo) d += 1;',
        '  const pa = opgSectorCenter(a.mainSector), pb = opgSectorCenter(b.mainSector);',
        '  if (pa && pb) d += Math.hypot(pa.x - pb.x, pa.y - pb.y) / 1000;',
        '  if (d > enUzak) { enUzak = d; A = a; B = b; } }',
        'for (const c of BATTLE_CONTROLLERS.values()) battleOracleInstallInjection(c);',
        'const fork = battleForkCapture();',
        'const kosPlan = (aday) => {',
        '  battleForkRestore(fork);',
        '  BATTLE_ORACLE_INJECTION = battleCandidateToInjection(aday, ctrl.id);',
        '  let t = 0;',
        '  for (let i = 0; i < ' + SURE + ' && phase === PHASE.BATTLE; i++) {',
        '    t += BATTLE_TICK_MS; stepSim(t, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, t); }',
        '  const m = new Map();',
        '  for (const u of SIM.units) if (!u.dead && u.isRed) m.set(u.id, { x: u.x, y: u.y });',
        // ODUL ADAYLARI: 570px'lik davranis farkini HANGI olcut ayirt edebiliyor?
        '  const deger = (kirmizi) => { let v = 0; for (const u of SIM.units) { if (u.dead || !!u.isRed !== kirmizi) continue;',
        '    v += ((STATS[u.type]||{}).cost || 0) * (u.hp / Math.max(1, u.maxHp)); } return v; };',
        '  const K = SIM.units.filter(u => !u.dead && u.isRed), M = SIM.units.filter(u => !u.dead && !u.isRed);',
        '  const menzilIci = (a, b) => { let n = 0; for (const x of a) { for (const y of b) {',
        '    if (Math.hypot(x.x-y.x, x.y-y.y) <= (x.range||0)) { n++; break; } } } return n; };',
        '  const bask = (arr) => arr.length ? arr.reduce((t,u)=>t+(u.suppression||0),0)/arr.length : 0;',
        '  const menzilAgirlik = (arr) => arr.reduce((t,u)=>t+((STATS[u.type]||{}).cost||0)*(u.hp/Math.max(1,u.maxHp))*(u.range||0),0);',
        '  m.__olcut = {',
        '    kuvvetFarki: deger(true) - deger(false),',
        '    atesEden: K.filter(u=>u.attackTarget && !u.attackTarget.dead).length - M.filter(u=>u.attackTarget && !u.attackTarget.dead).length,',
        '    netMaruziyet: menzilIci(K, M) - menzilIci(M, K),',
        '    baskiFarki: bask(M) - bask(K),',
        '    menzilAgirlikli: (menzilAgirlik(K) - menzilAgirlik(M)) / 1000,',
        '    birimFarki: K.length - M.length };',
        '  return m; };',
        'const mA = kosPlan(A), mB = kosPlan(B);',
        'BATTLE_ORACLE_INJECTION = null; battleForkRestore(fork); SIM.headless = ph;',
        'let n = 0, top = 0, enBuyuk = 0;',
        'for (const [id, pa] of mA) { const pb = mB.get(id); if (!pb) continue;',
        '  const d = Math.hypot(pa.x - pb.x, pa.y - pb.y); n++; top += d; if (d > enBuyuk) enBuyuk = d; }',
        'const oA = mA.__olcut, oB = mB.__olcut; const olcutFark = {};',
        'for (const k of Object.keys(oA)) olcutFark[k] = { A: Math.round(oA[k]*100)/100, B: Math.round(oB[k]*100)/100, fark: Math.round((oA[k]-oB[k])*100)/100 };',
        'return JSON.stringify({ n, ortAyrisma: n ? top / n : 0, enBuyuk, olcutFark,',
        '  A: A.intent + "|" + A.mainSector + "|" + A.tempo, B: B.intent + "|" + B.mainSector + "|" + B.tempo,',
        '  kalanA: mA.size, kalanB: mB.size });',
        '} catch (e) { return JSON.stringify({ err: e.message }); } })()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'pa.js' }));
}

yaz('PLAN AYRISMASI — iki UC plan, ' + (SURE * 0.05) + 'sn sonra birimler ne kadar ayrisiyor?');
yaz('  karar tiki ' + TIK + '   harita eni 5100px');
yaz('  KIYAS: kodun kendi notu bu olcumu 169px bulmustu (%3.3) ve "plan icraya baglanmiyor" demisti.');
yaz('');
const R = [];
for (let i = 0; i < N; i++) {
    const r = kos(HAVUZ[i]);
    if (r.err) { yaz('  tohum ' + HAVUZ[i] + ': ' + r.err); continue; }
    R.push(r);
    yaz('  tohum ' + HAVUZ[i] + '  ort ayrisma ' + Math.round(r.ortAyrisma) + 'px   en buyuk ' + Math.round(r.enBuyuk) +
        'px   (' + r.n + ' birim)   A=' + r.A + '  B=' + r.B);
}
if (!R.length) { yaz('  olcum yok'); process.exit(0); }
const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const o = ort(R.map(r => r.ortAyrisma));
yaz('');
yaz('  ══ ORTALAMA AYRISMA: ' + Math.round(o) + 'px  (haritanin %' + (o / 5100 * 100).toFixed(1) + "'i) ══");
yaz('  en buyuk tek birim ayrismasi: ' + Math.round(ort(R.map(r => r.enBuyuk))) + 'px');
yaz('');
yaz('');
yaz('  ══ HANGI OLCUT DAVRANIS FARKINI AYIRT EDIYOR? ══');
const anahtarlar = Object.keys(R[0].olcutFark || {});
yaz('  ' + 'olcut'.padEnd(18) + 'ort |A-B|'.padStart(11) + 'isaret tutarli'.padStart(16) + '   A/B ornek');
for (const k of anahtarlar) {
    const farklar = R.map(r => r.olcutFark[k].fark);
    const mutlak = farklar.map(Math.abs);
    const ortM = mutlak.reduce((a,b)=>a+b,0)/mutlak.length;
    const poz = farklar.filter(x => x > 0).length;
    const tutarli = Math.max(poz, farklar.length - poz) + '/' + farklar.length;
    yaz('  ' + k.padEnd(18) + ortM.toFixed(1).padStart(11) + tutarli.padStart(16) +
        '   ' + R[0].olcutFark[k].A + ' / ' + R[0].olcutFark[k].B);
}
yaz('');
yaz('  YORUM: ort |A-B| BUYUK ve isaret TUTARLI olan olcut, iki plani gercekten ayirt ediyor demektir.');
yaz('         Mevcut odul `kuvvetFarki` uzerine kurulu; o ayirt edemiyorsa ODUL DEGISMELI.');
yaz('  YORUM2: kucukse (<300px) YURUTME planlari cokturuyor -> duzeltilecek yer yurutme.');
yaz('         buyukse (>800px) yurutme calisiyor -> cokus UFUK/ODUL tarafinda.');
