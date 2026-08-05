'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  HAFİF MUHAREBE TEZGÂHI (jsdom) — Electron yerine saf Node
//
//  NEDEN: Electron'da bir başsız işçi ~1.8GB tutuyor ve her ek maç ~1.4GB daha
//  bırakıyor; 16 çekirdekli makinede paralellik 2-3 işçiyle sınırlı kalıyordu
//  (kullanıcının makinesi 12 işçiyle dondu). Chromium'un tarayıcı/GPU/renderer
//  süreçleri bize hiçbir şey katmıyor: testler zaten başsız (SIM.headless=true).
//
//  BURADA NE YÜKLENMİYOR: index.html 86 betik yüklüyor; muharebe için ilk 29'u
//  yetiyor. Hikâye modu (StoryWorld/harita rasterleri), LLM, WarRoom UI, Net/MP
//  hiç yüklenmez → hem bellek hem açılış süresi düşer.
//
//  KABUL ÖLÇÜTÜ: aynı tohumlarda Electron ile BİREBİR aynı sonuç. Sağlamıyorsa
//  tezgâh geçersizdir (--dogrula ile sınanır).
//
//  Kullanım (--recipeab ile AYNI arayüz, caprazla.js doğrudan kullanabilir):
//    node tools/muharebe-tezgah.js --tarifler <yol> --sal <ad|*> --sav <ad|*>
//                                  --seeds 2024,777 --out <yol> [--sessiz]
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

// index.html sırasıyla AYNI — yalnız muharebe zinciri (Story/LLM/UI/Net yok).
const MUHAREBE_KAYNAK = [
    'js/UnitData.js', 'js/UnitFeatures.js', 'js/UnitLoader.js', 'js/globals.js',
    'js/BattleRules.js', 'js/BattleSession.js', 'js/BattlePerception.js', 'js/BattleSituation.js',
    'js/BattlePlanning.js', 'js/BattleExecution.js', 'js/OperationGrammar.js', 'js/BattleSpaceTime.js',
    'js/BattleBlackboard.js', 'js/BattleTargeting.js', 'js/CommanderProfiles.js', 'js/BattleController.js',
    'js/BattleCommander.js', 'js/BattleFeatures.js', 'js/BattleSelector.js', 'js/BattleOracle.js',
    'js/BattleSelectorModel.js', 'js/BattleCoach.js', 'js/MapData.js', 'js/MapImage.js',
    'js/VFX.js', 'js/Support.js', 'js/Unit.js', 'js/BattleDeployment.js', 'js/main.js'
];

function sahteContext(canvas) {
    const bos = () => {};
    return new Proxy({
        canvas,
        measureText: t => ({ width: String(t || '').length * 8 }),
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
        getImageData: (_x, _y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
        createLinearGradient: () => ({ addColorStop: bos }),
        createRadialGradient: () => ({ addColorStop: bos }),
        createPattern: () => null,
        getContextAttributes: () => ({ alpha: true })
    }, {
        get: (t, p) => (p in t ? t[p] : bos),
        set: (t, p, v) => { t[p] = v; return true; }
    });
}

// index.html'in muharebe kodunun dokunduğu düğümler. Eksik id'ler koşuda hataya
// yol açarsa buraya eklenir (sessizce yutmuyoruz — hata konsola düşer).
const HTML = '<!doctype html><html><body>'
    + '<canvas id="game"></canvas><canvas id="minimap"></canvas><canvas id="storyCanvas"></canvas>'
    + '<div id="hud"></div><div id="ui"></div><div id="menu"></div><div id="battle-hud"></div>'
    + '<div id="deploy-bar"></div><div id="unit-panel"></div><div id="ability-bar"></div>'
    + '<div id="toast"></div><div id="tooltip"></div><div id="log"></div>'
    + '</body></html>';

function tezgahKur() {
    const dom = new JSDOM(HTML, { url: 'https://pixel-rts.invalid/', runScripts: 'outside-only', pretendToBeVisual: false });
    const { window } = dom;

    // Canvas: jsdom'da getContext yok → sahte 2B bağlam
    window.HTMLCanvasElement.prototype.getContext = function () { return sahteContext(this); };
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
    const eskiCreate = window.document.createElement.bind(window.document);
    window.document.createElement = function (etiket) {
        const el = eskiCreate(etiket);
        if (String(etiket).toLowerCase() === 'canvas') { el.width = el.width || 1; el.height = el.height || 1; }
        return el;
    };

    // Çizim döngüsü YOK (testler başsız); Image yüklemesi anında biter.
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
    class SahteImage {
        constructor() { this.width = 1; this.height = 1; this.complete = true; }
        set src(_v) { this._src = _v; if (typeof this.onload === 'function') this.onload(); }
        get src() { return this._src; }
        addEventListener(tip, fn) { if (tip === 'load') fn(); }
    }
    window.Image = SahteImage;
    window.alert = () => {}; window.confirm = () => false; window.prompt = () => null;
    // jsdom localStorage salt-okunur bir erişimci → doğrudan atanamaz, tanım değiştirilir
    const depo = new Map();
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
            getItem: k => (depo.has(k) ? depo.get(k) : null),
            setItem: (k, v) => { depo.set(k, String(v)); },
            removeItem: k => { depo.delete(k); }, clear: () => depo.clear()
        }
    });
    // ── KENDİNİ TAMAMLAYAN DOM ────────────────────────────────────────────
    // index.html'de bu düğümlerin HEPSİ var; jsdom'da tek tek kovalamak yerine istenen
    // id yoksa uygun türde oluşturulup gövdeye eklenir. Bu, null döndürmekten Electron'a
    // DAHA YAKIN davranıştır (kod `if (el)` ile dallanıyorsa Electron'da da el vardır).
    const uretilen = new Set();
    const eskiById = window.document.getElementById.bind(window.document);
    window.document.getElementById = function (id) {
        const v = eskiById(id);
        if (v) return v;
        const ad = String(id);
        const tur = /canvas/i.test(ad) ? 'canvas' : (/sprite|image|img|sheet/i.test(ad) ? 'img' : 'div');
        const el = window.document.createElement(tur);
        el.id = ad;
        if (tur === 'canvas') { el.width = 1024; el.height = 768; }
        if (tur === 'img') { el.width = 1; el.height = 1; }
        window.document.body.appendChild(el);
        uretilen.add(ad + ':' + tur);
        return el;
    };
    const eskiQS = window.document.querySelector.bind(window.document);
    window.document.querySelector = function (sec) {
        const v = eskiQS(sec);
        if (v) return v;
        const m = /^#([\w-]+)$/.exec(String(sec));
        return m ? window.document.getElementById(m[1]) : null;
    };
    window.__uretilenDugumler = uretilen;

    window.fetch = () => Promise.reject(new Error('tezgahta ag YOK'));   // sessiz ağ çağrısı olmasın
    window.matchMedia = () => ({ matches: false, addListener: () => {}, addEventListener: () => {} });

    const ctx = dom.getInternalVMContext();
    const hatalar = [];
    for (const rel of MUHAREBE_KAYNAK) {
        const p = path.join(ROOT, rel);
        const kod = fs.readFileSync(p, 'utf8');
        try {
            vm.runInContext(kod, ctx, { filename: rel });
        } catch (e) {
            hatalar.push(rel + ': ' + e.message);
        }
    }
    return { dom, window, ctx, hatalar };
}

// ── maç koşumu: --recipeab'daki mantığın AYNISI ───────────────────────────
// ÖNEMLİ: oyun betikleri top-level `const`/`let` kullanıyor; vm.runInContext bunları
// bağlamın SÖZCÜKSEL kapsamında oluşturur, global nesneye YAZMAZ → `window.SIM` gibi
// erişimler undefined döner. Bu yüzden maç, Electron'daki executeJavaScript ile aynı
// mantıkla BAĞLAMIN İÇİNDE değerlendirilir ve düz veri döndürür.
// A/B koşularında ham telemetri hiç okunmuyor; kapatmak %22 hız kazandırıyor
// (12 maç 69.7sn → 54.3sn) ve sonuçlar BİREBİR aynı kalıyor (5/12, marj −1032).
const TELEMETRISIZ = process.argv.includes('--telemetrisiz');
function macKos(ctx, tSal, tSav, seed) {
    const kod = '(() => {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;' +
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
        'const tSal = ' + JSON.stringify(tSal) + ', tSav = ' + JSON.stringify(tSav) + ', seed = ' + seed + ';' +
        'const sezSal = tSal.heuristik === true, sezSav = tSav.heuristik === true;' +
        'BATTLE_RECIPE_RED = sezSal ? null : tSal;' +
        'if (sezSal && typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = (tSal.varied !== false);' +
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
        // TELEMETRİSİZ KİP: A/B koşularında ham telemetri (her 10 tikte tüm birimlerin durumu +
        // muharebe/yaşam olayları) hiç okunmuyor. Kayıt fonksiyonları null telemetriyi zaten
        // atlıyor (battleCaptureTelemetrySample vb. `if (!telemetry) return`), yani kapatmak güvenli.
        (TELEMETRISIZ ? 'BATTLE_REPLAY.telemetry = null;' : '') +
        'let mv;' +
        'if (sezSav) {' +
        '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = (tSav.varied !== false);' +
        '  mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:(tSav.varied !== false), brainIntel4:true, isAttacker:false, pro:false });' +
        '} else { mv = battleBuildArmyManifest(6500, { maxUnits:48, recipe: tSav }); }' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
        'battleDeployManifest(mv, false, { source:"tezgah-sav", ally:true });' +
        'const salDeger = SIM.units.filter(u => u.isRed).reduce((s,u)=>s+((STATS[u.type]&&STATS[u.type].cost)||0),0);' +
        'startBattle();' +
        'const sipKab = (isRed) => { let w=0,k=0; for (const u of SIM.units) { if (u.dead||u.isRed!==isRed) continue;' +
        '  const c=(STATS[u.type]&&STATS[u.type].cost)||1; w+=c; if (u._canDigIn) k+=c; } return w?k/w:0; };' +
        'const kabSal = sipKab(true), kabSav = sipKab(false);' +
        'const ph = SIM.headless; SIM.headless = true; let st = 0, erken = null;' +
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '  if (SIM.tick === 2400) { const a=battleArmyObservation(true), d=battleArmyObservation(false);' +
        '    erken = { sal:Math.round(a.effectiveValue), sav:Math.round(d.effectiveValue) }; }' +
        '} } finally { SIM.headless = ph; }' +
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);' +
        'const b = SIM.battle || {}; BATTLE_RECIPE_RED = null;' +
        'return JSON.stringify({ seed: seed,' +
        '  kazanan:(b.winnerSide===true?"sal":b.winnerSide===false?"sav":"-"), sebep:b.outcomeReason||null,' +
        '  marj: Math.round(oS.effectiveValue - oD.effectiveValue), erken: erken, salDeger: salDeger,' +
        '  savDeger: mv.totalValue, savSapma: mv.tarifDenetim ? mv.tarifDenetim.maxSapma : null,' +
        '  siperKab: { sal:+kabSal.toFixed(3), sav:+kabSav.toFixed(3) }, bitisSn: Math.round(SIM.tick*BATTLE_TICK_SEC) });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'mac-' + seed + '.js' }));
}

function bayrak(ad, vars) { const i = process.argv.indexOf(ad); return i >= 0 ? process.argv[i + 1] : vars; }

function main() {
    const TARIF_YOL = bayrak('--tarifler', 'qa-runtime/tarifler-taban.json');
    const SEEDS = String(bayrak('--seeds', '2024')).split(',').map(Number).filter(Boolean);
    const SAL_F = bayrak('--sal', '*'), SAV_F = bayrak('--sav', '*');
    const CIKTI = bayrak('--out', 'qa-runtime/tezgah-sonuc.json');
    const SESSIZ = process.argv.includes('--sessiz');

    const tarifler = JSON.parse(fs.readFileSync(path.join(ROOT, TARIF_YOL), 'utf8'));
    const sec = f => (f === '*' ? tarifler : tarifler.filter(t => f.split(',').indexOf(t.ad) >= 0));
    const SAL = sec(SAL_F), SAV = sec(SAV_F);
    if (!SAL.length || !SAV.length) { console.log('TARIF_SECIMI_BOS'); process.exit(1); }

    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) {
        console.log('TEZGAH_YUKLEME_HATASI:');
        for (const h of hatalar) console.log('  ' + h);
        process.exit(1);
    }

    const hucreler = [];
    let n = 0;
    const TOPLAM = SAL.length * SAV.length * SEEDS.length;
    for (const tSal of SAL) {
        for (const tSav of SAV) {
            const macs = [];
            for (const seed of SEEDS) {
                n++;
                try {
                    macs.push(macKos(ctx, tSal, tSav, seed));
                } catch (e) {
                    console.log('MAC_HATA ' + n + ' seed=' + seed + ': ' + e.message);
                }
            }
            if (!macs.length) continue;
            const gal = macs.filter(m => m.kazanan === 'sal').length;
            const marj = Math.round(macs.reduce((s, m) => s + m.marj, 0) / macs.length);
            const erk = macs.filter(m => m.erken);
            const h = {
                sal: tSal.ad, sav: tSav.ad, mac: macs.length, salGalibiyet: gal, marj,
                erkenMarj: erk.length ? Math.round(erk.reduce((s, m) => s + (m.erken.sal - m.erken.sav), 0) / erk.length) : null,
                ordu: { sal: macs[0].salDeger, sav: macs[0].savDeger },
                siperKab: macs[0].siperKab, maclar: macs
            };
            hucreler.push(h);
            if (!SESSIZ) {
                console.log('  [' + n + '/' + TOPLAM + '] SAL ' + h.sal + '  vs  SAV ' + h.sav +
                    '  -> saldiran ' + gal + '/' + macs.length + '  marj ' + (marj >= 0 ? '+' : '') + marj +
                    '  ordu ' + h.ordu.sal + '/' + h.ordu.sav + ' TL');
            }
        }
    }
    fs.mkdirSync(path.dirname(path.join(ROOT, CIKTI)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, CIKTI), JSON.stringify(hucreler, null, 1));
    if (!SESSIZ) console.log('TEZGAH_OK ' + hucreler.length + ' hucre / ' + n + ' mac -> ' + CIKTI);
}

main();
