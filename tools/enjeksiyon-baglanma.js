// ENJEKSIYON BAGLANMA SAYACI — gramer 64 aday uretiyor ama KAC FARKLI PLAN cikiyor?
//
// GECE BULGUSU (2026-08-09, qa-runtime/beonai-oracle.jsonl, 1757 karar):
//   64 aday medyanda 7 FARKLI ODUL degerine cokuyor; adaylarin %48'i tek bir sonuca dusuyor ve
//   kararlarin %35'inde o sonuc KOD-AI'IN KENDI planinin sonucu (yani enjeksiyon hic baglanmamis).
// Bu, odulden CIKARIM'di. Bu arac ayni seyi DOGRUDAN ve ROLLOUT'SUZ olcer:
//   her aday icin enjekte plan KURULUR, ortaya cikan SOZLESMELER imzalanir, KAC FARKLI imza var sayilir.
// Rollout yok -> karar basina saniyeler, saatler degil.
//
// KODDAKI EMSAL (js/BattleOracle.js:239-246): ayni sinif kusur daha once bulunmus —
// "KARAR UZAYI DARDI CUNKU PLAN ICRAYA BAGLANMIYORDU; iki uc plan 30sn sonra birimleri
//  ortalama 169px ayiriyordu (5100px haritada %3.3)". Sektor etiketi eklenerek KISMEN duzeltilmis.
// Bu arac o duzeltmenin YETIP YETMEDIGINI olcer.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N_MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TIKLER = (arg('--tikler', '600,1200,1800,2400')).split(',').map(Number);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(0, N_MAC);
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };

const { ctx } = tezgahKur();

function kos(seed) {
    const kod = [
        '(() => { const R = [];',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"eb", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'const TIKLER = ' + JSON.stringify(TIKLER) + ';',
        'try {',
        '  for (const hedef of TIKLER) {',
        '    while (SIM.tick < hedef && phase === PHASE.BATTLE) {',
        '      st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '      if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st); }',
        '    if (phase !== PHASE.BATTLE) break;',
        // kontrolor + baglam
        '    const ctrl = [...BATTLE_CONTROLLERS.values()].find(c => c.side === true);',
        '    if (!ctrl || !ctrl.lastObservation || !ctrl.lastSituation) continue;',
        '    const obs = ctrl.lastObservation, sit = ctrl.lastSituation;',
        '    const cp = ctrl.currentPlan || null;',   // ALAN ADI: currentPlan (committedPlan DEGIL - telemetride oyle adlaniyor)
        '    if (!cp) continue;',
        '    const gctx = battleOracleGrammarContext(ctrl, true);',
        '    const adaylar = operationGrammarGenerate(gctx);',
        '    if (!adaylar || !adaylar.length) continue;',
        // KOD-AI'in KENDI plani (enjeksiyonsuz) — referans imza
        '    const planner = ctrl.operationalPlanner;',
        '    const orijBuild = planner.__oracleOriginalBuild || planner.build.bind(planner);',
        '    const imzala = (p) => { if (!p) return "-";',
        '      const par = [];',
        '      par.push(p.kind || "-");',
        '      const o = p.objective || {}; par.push(Math.round((o.x||0)/50), Math.round((o.y||0)/50), o.sector || "-");',
        '      for (const c of (p.taskContracts || []).slice().sort((a,b)=> (a.groupRole<b.groupRole?-1:1))) {',
        '        const d = c.destination || {};',
        '        par.push(c.groupRole, Math.round((d.x||0)/50), Math.round((d.y||0)/50), c.sector || "-", c.tempo || "-"); }',
        '      return par.join(","); };',
        '    const kodImza = imzala(orijBuild(cp, obs, sit));',
        '    const imzalar = [], kodEsit = [];',
        '    for (const a of adaylar) {',
        '      let p = null;',
        // ⚠ ARAC HATASI ve DUZELTMESI: ham gramer adayi (intent/mainSector/tempo) DOGRUDAN gecilemez;
        // battleBuildInjectedPlan `kind/point/sector/tempoScale` bekler -> battleCandidateToInjection sart.
        // Ham gecince yapici bos alanlarla AYNI plani uretiyordu -> sahte "64 aday -> 1 plan" (yasandi).
        // AYRICA: bu dizi join('') ile birlesiyor, yani dize ICINE // yorumu koymak satirin geri kalanini yutar.
        '      const inj = battleCandidateToInjection(a, ctrl.id);',
        '      try { p = battleBuildInjectedPlan(planner, cp, obs, sit, inj); } catch (e) { p = null; }',
        '      const im = imzala(p);',
        '      imzalar.push(im); kodEsit.push(im === kodImza ? 1 : 0);',
        '    }',
        '    const set = new Set(imzalar);',
        '    const say = {}; for (const im of imzalar) say[im] = (say[im]||0)+1;',
        '    const enBuyuk = Math.max(...Object.values(say));',
        '    R.push({ tik: SIM.tick, aday: adaylar.length, farkliPlan: set.size,',
        '      enBuyukKume: enBuyuk, kodEsitSayi: kodEsit.reduce((a,b)=>a+b,0) });',
        '  }',
        '} finally { SIM.headless = ph; }',
        'return JSON.stringify(R); })()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'eb.js' }));
}

yaz('ENJEKSIYON BAGLANMA — gramer kac FARKLI PLAN uretiyor? (rollout YOK)');
yaz('  ' + TOHUMLAR.length + ' mac x ' + TIKLER.length + ' karar-ani');
yaz('');
const hepsi = [];
for (let i = 0; i < TOHUMLAR.length; i++) {
    const R = kos(TOHUMLAR[i]);
    hepsi.push(...R);
    yaz('  [' + (i + 1) + '/' + TOHUMLAR.length + '] tohum ' + TOHUMLAR[i] + '  karar ' + R.length +
        (R.length ? ('   ornek: ' + R[0].aday + ' aday -> ' + R[0].farkliPlan + ' farkli plan') : ''));
}
const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
if (!hepsi.length) { yaz('  olcum yok'); process.exit(0); }
const aday = hepsi.map(r => r.aday), fp = hepsi.map(r => r.farkliPlan);
const eb = hepsi.map(r => r.enBuyukKume), ke = hepsi.map(r => r.kodEsitSayi);
yaz('');
yaz('  ══ SONUC (' + hepsi.length + ' karar-ani) ══');
yaz('  aday sayisi          : ort ' + ort(aday).toFixed(1) + '   medyan ' + med(aday));
yaz('  FARKLI PLAN sayisi   : ort ' + ort(fp).toFixed(1) + '   medyan ' + med(fp));
yaz('  en buyuk AYNI-PLAN kumesi: ort ' + ort(eb).toFixed(1) + '   medyan ' + med(eb));
yaz('  KOD-AI plani ile AYNI cikan aday: ort ' + ort(ke).toFixed(1) + '   medyan ' + med(ke));
yaz('  etkin/nominal oran   : %' + Math.round(ort(fp) / Math.max(1, ort(aday)) * 100));
yaz('');
yaz('  KIYAS: odulden CIKARIM medyan 7 farkli SONUC demisti. Bu olcum PLAN duzeyinde,');
yaz('         yani rollout gurultusunden bagimsiz. Ikisi yakinsa bulgu saglam.');
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'enjeksiyon-baglanma.json'), JSON.stringify(hepsi, null, 1));
