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
// jsdom TEMBEL yüklenir: mini kipte hiç require edilmez — 107MB tasarrufun kaynağı budur
// (ölçüldü: `require('jsdom')` tek başına +102MB, örnek yalnız +5MB).
let JSDOM = null;

const ROOT = path.resolve(__dirname, '..');

// index.html sırasıyla AYNI — yalnız muharebe zinciri (Story/LLM/UI/Net yok).
const MUHAREBE_KAYNAK = [
    'js/UnitData.js', 'js/UnitFeatures.js', 'js/UnitLoader.js', 'js/globals.js',
    'js/BattleRules.js', 'js/BattleSession.js', 'js/BattlePerception.js', 'js/BattleSituation.js',
    'js/BattlePlanning.js', 'js/BattleExecution.js', 'js/BattleExploiters.js', 'js/OperationGrammar.js', 'js/BattleSpaceTime.js',
    'js/BattleStateFeatures.js', 'js/BattleBlackboard.js', 'js/BattleTargeting.js', 'js/CommanderProfiles.js', 'js/BattleController.js',
    'js/BattleCommander.js', 'js/BattleFeatures.js', 'js/BattleSelector.js', 'js/BattleOracle.js',
    'js/BattleSelectorModel.js', 'js/BattleCoach.js', 'js/BattleBeonai.js',
    'js/MapData.js', 'js/MapImage.js',
    'js/VFX.js', 'js/Support.js', 'js/Unit.js', 'js/BattleDeployment.js', 'js/main.js',
    'js/BattleLookahead.js',
    'js/BattleValueModel.js', 'js/BattleValueNet.js'
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

// ── MİNİ DOM DENENDİ ve KAYBETTİ (negatif sonuç, kayda geçirildi) ──────────
// Hipotez: jsdom işçi belleğinin %41'i (katman ölçümü: require +102MB, örnek +5MB,
// oyun +71MB, 1 maç +21MB = 262MB) → atarsak aynı bellekte ~3 kat işçi.
// ÖLÇÜM (12 maç, aynı tohumlar):
//     mini-DOM : zirve 348MB, süre 147sn
//     jsdom    : zirve 338MB, süre  40sn
// Sonuçlar BİREBİR aynı (5/12, marj −1032) yani mini-DOM doğru — ama ne bellek
// kazandırıyor ne hız; üstelik 3.6 KAT YAVAŞ. Nedenleri:
//   1) jsdom'un sabit maliyeti, 12 maçlık koşuda V8'in kendi büyümesinin ALTINDA kalıyor
//      (katman ölçümü tek maç içindi — yanıltıcı genelleme yapmışım).
//   2) vm.createContext(düz nesne) her GLOBAL erişimi yavaşlatıyor; oyun kodu sürekli
//      global okuyor (SIM, STATS, WORLD_W...). jsdom'un iç bağlamı bunu yaşamıyor.
// KARAR: varsayılan jsdom. mini-DOM `--minidom` ile durur (tekrar denenmesin diye kayıt).
const JSDOM_KIPI = !process.argv.includes('--minidom');

function tezgahKurMini() {
    const { pencereKur } = require('./mini-dom.js');
    const g = pencereKur();
    const ctx = vm.createContext(g);
    const hatalar = [];
    const kaynaklar = MUHAREBE_KAYNAK.slice();
    if (fs.existsSync(path.resolve(ROOT, 'js/BattleBeonaiModels.js'))) kaynaklar.push('js/BattleBeonaiModels.js');
    if (fs.existsSync(path.resolve(ROOT, 'js/BattleBeonaiModelBC.js'))) kaynaklar.push('js/BattleBeonaiModelBC.js');
    if (fs.existsSync(path.resolve(ROOT, 'js/BattleBeonaiModelBCv2.js'))) kaynaklar.push('js/BattleBeonaiModelBCv2.js');
    for (const rel of kaynaklar) {
        try { vm.runInContext(fs.readFileSync(path.resolve(ROOT, rel), 'utf8'), ctx, { filename: rel }); }
        catch (e) { hatalar.push(rel + ': ' + e.message); }
    }
    return { dom: null, window: g, ctx, hatalar };
}

function tezgahKur() {
    if (!JSDOM_KIPI) return tezgahKurMini();
    if (!JSDOM) ({ JSDOM } = require('jsdom'));
    const dom = new JSDOM(HTML,{ url: 'https://pixel-rts.invalid/', runScripts: 'outside-only', pretendToBeVisual: false });
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
    // beonai model dosyası VARSA yüklenir (yoksa sorun değil: beyin belirtilmedikçe kullanılmaz).
    // Eğitim çıktısı olduğu için repoda bulunmayabilir → listeye koşullu eklenir.
    const kaynaklar = MUHAREBE_KAYNAK.slice();
    if (fs.existsSync(path.resolve(ROOT, 'js/BattleBeonaiModels.js'))) kaynaklar.push('js/BattleBeonaiModels.js');
    if (fs.existsSync(path.resolve(ROOT, 'js/BattleBeonaiModelBC.js'))) kaynaklar.push('js/BattleBeonaiModelBC.js');
    if (fs.existsSync(path.resolve(ROOT, 'js/BattleBeonaiModelBCv2.js'))) kaynaklar.push('js/BattleBeonaiModelBCv2.js');
    for (const rel of kaynaklar) {
        const p = path.resolve(ROOT, rel);
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
const GC_ZORLA = process.argv.includes('--gc');
// ERKEN DUR: kazanan belli olunca simulasyonu kes. OLCULDU: kazanan 172-271sn arasi belli
// oluyor ama sim 365sn ye kadar donuyor -> %29 israf. Galibiyet/maglubiyet AYNI kalir
// (winnerSide zaten kayitli); yalnizca MARJ degisir cunku birimler dovusmeye devam ediyordu.
const ERKEN_DUR = process.argv.includes('--erkendur');
// ── MARJ-KESME (--marjkes N): |deger marji| N'i astigi anda dur ──
// OLCULDU (tools/erken-kesme-olc.js, 12 mac): esik 1500'de sure %60 kisaliyor ve o andaki
// marj ISARETI nihai kazananla 12/12 ORTUSUYOR. Daha dusuk esikler cok daha fazla kazandiriyor
// ama isaret guvenilmez (1000 -> %73, 500 -> %67) - yani kullanilamaz.
// DETERMINIZMI BOZMAZ: sim aynen kosar, yalnizca NE ZAMAN OKUMAYI BIRAKTIGIMIZ degisir.
// KULLANIM: yalniz ELEME turlarinda. Nihai turda tam mac kosulur (marj DEGERI kesmede
// nihai degerinden farkli olur; kazanan ayni kalir).
const _mkIx = process.argv.indexOf('--marjkes');
const MARJ_KES = _mkIx >= 0 ? Math.max(0, Number(process.argv[_mkIx + 1]) || 0) : 0;
// KISA MAÇ (tarama turları için): maçı erken kes ve o andaki marjı kullan.
// GEREKÇE ÖLÇÜLDÜ (1281 maç): t=120sn'deki marj ile nihai marj arasında r = 0.885;
// işaret uyumu %82, ve |erken marj| büyüdükçe güvenilirlik artıyor:
//   0-500 → %54 (yazı-tura) · 500-1500 → %75 · 1500-3000 → %95 · 3000+ → %100
// Yani ELEME turlarında tam maç koşmak israf; NİHAİ karar yine tam maçla verilir.
const _mt = process.argv.indexOf('--maxtik');
const MAX_TIK = _mt >= 0 ? Math.max(200, Number(process.argv[_mt + 1]) || 7300) : 7300;   // `node --expose-gc` ile birlikte anlamlı
function macKos(ctx, tSal, tSav, seed) {
    const kod = '(() => {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;' +
        // GÖVDE SEÇİMİ: tarifin `govde` alanı hangi kod-AI gövdesinin koşacağını belirler
        // ('intel4' varsayılan, 'intel4pro' = pro-delta katmanı açık). beonai bir GÖVDE DEĞİL,
        // gövdenin üstünde operasyon seçen beyindir → ikisi birlikte kullanılır:
        //   { ad:"B4+pro+beonai", paylar:{...}, govde:"intel4pro", beyin:"beonai-v1" }
        'BATTLE_INTEL4PRO_RED = ' + (tSal.govde === 'intel4pro') + ';' +
        'BATTLE_INTEL4PRO_BLUE = ' + (tSav.govde === 'intel4pro') + ';' +
        // DENGE-ANAHTARI EZME: tarif `kurallar: { BATTLE_JAM_PARTIAL:false }` verirse o global ezilir.
        // BEYAZ LISTE ile sinirli - keyfi global yazimi determinizmi ve olcumu sessizce bozabilir.
        // Bunlar TARAF-BASI DEGIL, mac genelindedir; A/B'de iki kola da ayni deger verilmelidir
        // (farkli verilirse SALDIRANINKI kazanir - test kurgusu hatasi olur).
        ((tSal.kurallar || tSav.kurallar) ? (() => {
            const IZIN = ['BATTLE_JAM_PARTIAL', 'BATTLE_JAM_RECON', 'BATTLE_SPAWN_LOADED', 'BATTLE_POSTURE_GATE', 'BATTLE_SECTOR_COMMAND', 'BATTLE_SECTOR_COMMAND_RED', 'BATTLE_SECTOR_COMMAND_BLUE'];
            const _k = Object.assign({}, tSav.kurallar || {}, tSal.kurallar || {});
            let out = '';
            for (const k in _k) {
                if (!IZIN.includes(k)) { console.warn('UYARI: kural beyaz-listede degil, yok sayildi: ' + k); continue; }
                out += k + ' = ' + JSON.stringify(_k[k]) + ';';
            }
            return out;
        })() : '') +
        // DELTA EZME (Katman 4 demet kapisi icin): tarif `deltalar: { standoff:false, heloHunt:false }`
        // verirse o anahtarlar ezilir. UYARI: BATTLE_INTEL4PRO_DELTAS GLOBAL, taraf-basi DEGIL -
        // bu yuzden yalnizca TEK taraf intel4pro iken anlamlidir (digeri intel4 ise deltalar hic
        // baglamaz). Iki taraf da pro ve ikisi de `deltalar` verirse SALDIRAN kazanir + uyarilir.
        ((tSal.deltalar || tSav.deltalar) ? (
            'if (typeof BATTLE_INTEL4PRO_DELTAS !== "undefined") {' +
            '  const _dz = ' + JSON.stringify(Object.assign({}, tSav.deltalar || {}, tSal.deltalar || {})) + ';' +
            '  for (const k in _dz) BATTLE_INTEL4PRO_DELTAS[k] = _dz[k];' +
            '}'
        ) : '') +
        // BEYİN SEÇİMİ: tarifte `beyin` alanı varsa o taraf beonai sürümüyle koşar
        // (ör. { ad:"H0+beonai-v1", heuristik:true, beyin:"beonai-v1" }). Böylece öğrenen
        // beyin, kod-AI ile TAM AYNI çok-tohumlu değerlendirmeden geçer — ayrı tezgâh yok.
        'BATTLE_BEONAI_RED = ' + (tSal.beyin ? JSON.stringify(tSal.beyin) : 'null') + ';' +
        'BATTLE_BEONAI_BLUE = ' + (tSav.beyin ? JSON.stringify(tSav.beyin) : 'null') + ';' +
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
        // Replay olay kaydı da A/B'de okunmuyor (profil: replayClone %5.3) → telemetriyle
        // birlikte kapanır. Determinizm kapıları replay kullandığı için orada açık kalır.
        (TELEMETRISIZ ? 'if (typeof BATTLE_REPLAY_KAYITSIZ !== "undefined") BATTLE_REPLAY_KAYITSIZ = true;' : '') +
        'let mv;' +
        'if (sezSav) {' +
        '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = (tSav.varied !== false);' +
        // SAVUNAN da pro KOMPOZISYON katmanini alabilmeli. Eskiden `pro:false` (sezgisel yol) ve
        // `pro` alani HIC verilmemis (tarif yolu) idi -> gozcu/lojistik kurallari savunana ULASMIYORDU.
        // Oyunun kendi yolunda da (BattleDeployment ~1021) `pro: BATTLE_INTEL4PRO_RED` ile yalniz
        // KIRMIZI taraf pro kompozisyonu aliyor; savunan yapisal olarak disaridaydi.
        '  mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:(tSav.varied !== false), brainIntel4:true, isAttacker:false, pro: BATTLE_INTEL4PRO_BLUE === true });' +
        '} else { mv = battleBuildArmyManifest(6500, { maxUnits:48, recipe: tSav, pro: BATTLE_INTEL4PRO_BLUE === true }); }' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
        'battleDeployManifest(mv, false, { source:"tezgah-sav", ally:true });' +
        'const salDeger = SIM.units.filter(u => u.isRed).reduce((s,u)=>s+((STATS[u.type]&&STATS[u.type].cost)||0),0);' +
        'startBattle();' +
        'const sipKab = (isRed) => { let w=0,k=0; for (const u of SIM.units) { if (u.dead||u.isRed!==isRed) continue;' +
        '  const c=(STATS[u.type]&&STATS[u.type].cost)||1; w+=c; if (u._canDigIn) k+=c; } return w?k/w:0; };' +
        'const kabSal = sipKab(true), kabSav = sipKab(false);' +
        'const ph = SIM.headless; SIM.headless = true; let st = 0, erken = null, marjKesildi = false;' +
        'try { while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE) {' +
        (ERKEN_DUR ? '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' : '') +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '  if (SIM.tick === 2400) { const a=battleArmyObservation(true), d=battleArmyObservation(false);' +
        '    erken = { sal:Math.round(a.effectiveValue), sav:Math.round(d.effectiveValue) }; }' +
        // UCUZ MARJ: battleArmyObservation PAHALI (ilk deneme kesmeyi %18 YAVASLATTI - 126sn -> 149sn).
        // Kesme karari icin ham maliyet toplami yeter; esik (1500) zaten bu olcuyle kalibre edildi.
        (MARJ_KES > 0 ?
        '  if (SIM.tick % 40 === 0) { let _k=0,_m=0;' +
        '    for (const u of SIM.units) { if (u.dead || u.loaded) continue; const _s=STATS[u.type]; if(!_s) continue;' +
        '      if (u.isRed) _k += _s.cost||0; else _m += _s.cost||0; }' +
        '    if (Math.abs(_k - _m) >= ' + MARJ_KES + ') { marjKesildi = true; break; } }' : '') +
        '} } finally { SIM.headless = ph; }' +
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);' +
        'const b = SIM.battle || {}; BATTLE_RECIPE_RED = null;' +
        'return JSON.stringify({ seed: seed,' +
        '  kazanan:(b.winnerSide===true?"sal":b.winnerSide===false?"sav":' +
        '           (marjKesildi ? ((oS.effectiveValue-oD.effectiveValue)>0?"sal":"sav") : "-")), sebep:(marjKesildi&&b.winnerSide===null?"marj_kesme":(b.outcomeReason||null)),' +
        '  marjKesildi: marjKesildi,' +
        '  marj: Math.round(oS.effectiveValue - oD.effectiveValue), erken: erken, salDeger: salDeger,' +
        '  savDeger: mv.totalValue, savSapma: mv.tarifDenetim ? mv.tarifDenetim.maxSapma : null,' +
        '  siperKab: { sal:+kabSal.toFixed(3), sav:+kabSav.toFixed(3) }, bitisSn: Math.round(SIM.tick*BATTLE_TICK_SEC),' +
        '  beyin: (typeof battleBeonaiDurum === "function") ? battleBeonaiDurum() : null,' +
        '  govde: { sal: BATTLE_INTEL4PRO_RED ? "intel4pro" : "intel4", sav: BATTLE_INTEL4PRO_BLUE ? "intel4pro" : "intel4" } });' +
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

    const tarifler = JSON.parse(fs.readFileSync(path.resolve(ROOT, TARIF_YOL), 'utf8'));
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
                    // ZORLAMALI GC (`--gc`, node --expose-gc ile anlamlı): her maçtan sonra
                    // belleği işletim sistemine geri ver. Amaç işçi başı zirveyi düşürüp
                    // aynı RAM'e daha çok işçi sığdırmak.
                    if (GC_ZORLA && typeof global.gc === 'function') global.gc();
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
    fs.mkdirSync(path.dirname(path.resolve(ROOT, CIKTI)), { recursive: true });
    fs.writeFileSync(path.resolve(ROOT, CIKTI), JSON.stringify(hucreler, null, 1));
    if (!SESSIZ) console.log('TEZGAH_OK ' + hucreler.length + ' hucre / ' + n + ' mac -> ' + CIKTI);
}

// Başka araçlar (beonai veri üretimi/değerlendirmesi) bu tezgâhı YENİDEN KULLANIR:
// require edildiğinde main() KOŞMAZ, yalnız parçalar dışa verilir.
if (require.main === module) main();
module.exports = { tezgahKur, macKos, MUHAREBE_KAYNAK };
