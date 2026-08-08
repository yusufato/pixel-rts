// ORACLE KARARLILIK TESTI — "ogretmen sinyal mi uretiyor, gurultu mu?"
//
// DIS ANALIST (2026-08-09): "Tavan +771'in t'si 1.80, bariniz |t|>=2 — yani 'sorun karar uzayi'
// hukmu KABUL EDILMEMIS bir olcume dayaniyor. Asil supheli: tavan, karar uzayinin degil
// OGRETMEN GURULTUSUNUN tavani olabilir. Cunku oracle'in odulu sonuc-benzeri ve sizin kendi
// olcumunuz sonuc degiskeninin oto-korelasyonunu 0.047 buldu. Gurultulu etiketin argmax'ini
// MUKEMMEL secen bir secici bile az kazandirir. Bu iki hipotez mevcut veriyle AYIRT EDILEMEZ."
//
// TEST: ayni karar aninda, ayni aday kumesini
//   (a) farkli DEVAM TOHUMU ile (rollout'un rastgeleligi degisir)
//   (b) farkli UFUK ile (25 / 45 / 70 sn)
// tekrar degerlendir. ORACLE ARGMAX kac kez degisiyor?
//   degisim orani DUSUK  -> etiket saglam, tavan gercekten karar uzayinin tavani
//   degisim orani YUKSEK -> etiket gurultu, tavan olcumu KARAR UZAYI hakkinda hicbir sey soylemiyor
//
// Not: oracle 64 aday uretiyor (gramer), commitment katmanindaki 3 plan adayi ile karistirilmamali.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N_MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const KARAR_TIK = (arg('--tikler', '600,1200,2000,3000')).split(',').map(Number);
const PERT = Math.max(2, Number(arg('--pert', 5)) || 5);     // kac farkli devam tohumu
const UFUKLAR = (arg('--ufuk', '25,45,70')).split(',').map(Number);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(0, N_MAC);
const ARA = path.join(__dirname, '..', 'qa-runtime', 'oracle-kararlilik-ARA.json');
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };

const { ctx } = tezgahKur();

// Bir macta belirtilen tiklerde oracle'i PERT x UFUK kez degerlendirir.
function kos(seed) {
    const kod = [
        '(() => { const R = [];',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"ok", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'const TIKLER = ' + JSON.stringify(KARAR_TIK) + ', UFUKLAR = ' + JSON.stringify(UFUKLAR) + ', PERT = ' + PERT + ';',
        'try {',
        '  for (const hedefTik of TIKLER) {',
        '    while (SIM.tick < hedefTik && phase === PHASE.BATTLE) {',
        '      st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '      if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st); }',
        '    if (phase !== PHASE.BATTLE) break;',
        '    const kayit = { tik: SIM.tick, olcum: [] };',
        '    for (const ufuk of UFUKLAR) {',
        '      for (let p = 0; p < PERT; p++) {',
        '        if (typeof srand === "function") srand(900000 + p * 7919 + hedefTik);',
        '        const r = battleOracleEvaluate({ sideRed: true, rolloutSec: ufuk });',
        '        if (r && !r.err && r.oracle) {',
        '          kayit.olcum.push({ ufuk, p, anahtar: r.oracle.intent + "|" + r.oracle.sector + "|" + r.oracle.tempo,',
        '            skor: r.oracle.scalar, adet: r.candidateCount, regret: r.regret });',
        '        } else kayit.olcum.push({ ufuk, p, err: (r && r.err) || "bos" });',
        '      } }',
        '    R.push(kayit);',
        '  }',
        '} finally { SIM.headless = ph; }',
        'return JSON.stringify(R); })()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ok.js' }));
}

yaz('ORACLE KARARLILIK TESTI');
yaz('  ' + TOHUMLAR.length + ' mac x ' + KARAR_TIK.length + ' karar-ani x ' + UFUKLAR.length + ' ufuk x ' + PERT + ' pertürbasyon');
yaz('  ufuklar: ' + UFUKLAR.join('/') + ' sn   karar tikleri: ' + KARAR_TIK.join(','));
yaz('');

const hepsi = [];
const t0 = Date.now();
for (let i = 0; i < TOHUMLAR.length; i++) {
    const R = kos(TOHUMLAR[i]);
    hepsi.push({ tohum: TOHUMLAR[i], kararlar: R });
    const gec = (Date.now() - t0) / 60000;
    yaz('  [' + (i + 1) + '/' + TOHUMLAR.length + '] tohum ' + TOHUMLAR[i] + '  karar-ani ' + R.length +
        '   gecen ' + gec.toFixed(1) + 'dk, tahmini kalan ' + (gec / (i + 1) * (TOHUMLAR.length - i - 1)).toFixed(1) + 'dk');
    try { fs.writeFileSync(ARA, JSON.stringify(hepsi, null, 1)); } catch (e) { }
}

// ── ANALIZ ──
const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
let ufukIci = { degisen: 0, toplam: 0 }, ufukArasi = { degisen: 0, toplam: 0 };
const skorDagilim = [];
const perUfuk = {};
for (const m of hepsi) for (const k of m.kararlar) {
    const gecerli = k.olcum.filter(o => o.anahtar);
    if (gecerli.length < 2) continue;
    // (a) AYNI ufuk, farkli pertürbasyon
    for (const u of UFUKLAR) {
        const g = gecerli.filter(o => o.ufuk === u);
        if (g.length < 2) continue;
        const tepe = g[0].anahtar;
        for (let i = 1; i < g.length; i++) { ufukIci.toplam++; if (g[i].anahtar !== tepe) ufukIci.degisen++; }
        (perUfuk[u] = perUfuk[u] || { d: 0, t: 0 });
        for (let i = 1; i < g.length; i++) { perUfuk[u].t++; if (g[i].anahtar !== tepe) perUfuk[u].d++; }
        const sk = g.map(o => o.skor).filter(Number.isFinite);
        if (sk.length > 1) { const o = ort(sk); const sd = Math.sqrt(ort(sk.map(x => (x - o) ** 2))); skorDagilim.push(sd / Math.max(1, Math.abs(o))); }
    }
    // (b) UFUKLAR arasi (her ufkun p=0'i)
    const ilkler = UFUKLAR.map(u => gecerli.find(o => o.ufuk === u && o.p === 0)).filter(Boolean);
    for (let i = 1; i < ilkler.length; i++) { ufukArasi.toplam++; if (ilkler[i].anahtar !== ilkler[0].anahtar) ufukArasi.degisen++; }
}

yaz('');
yaz('  ══ SONUC ══');
const y = (d, t) => t ? ('%' + Math.round(d / t * 100) + '  (' + d + '/' + t + ')') : 'olcum yok';
yaz('  ARGMAX DEGISIM ORANI — ayni ufuk, farkli devam tohumu : ' + y(ufukIci.degisen, ufukIci.toplam));
for (const u of UFUKLAR) if (perUfuk[u]) yaz('      ufuk ' + u + 'sn: ' + y(perUfuk[u].d, perUfuk[u].t));
yaz('  ARGMAX DEGISIM ORANI — ufuklar arasi (25 vs 45 vs 70) : ' + y(ufukArasi.degisen, ufukArasi.toplam));
yaz('  oracle skorunun pertürbasyonlar arasi bagil std sapmasi: ' + (ort(skorDagilim) * 100).toFixed(1) + '%');
yaz('');
yaz('  KARAR KURALI (analist): degisim orani >%30-40 ise ETIKETLER GURULTUDUR ve');
yaz('  "+771 tavani = sorun karar uzayi" hukmu GECERSIZDIR.');
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'oracle-kararlilik.json'),
    JSON.stringify({ tohumlar: TOHUMLAR, ufuklar: UFUKLAR, pert: PERT, hepsi, ufukIci, ufukArasi }, null, 1));
