// _es_loop.js — es_train.js TARAFINDAN aynı eval-scope'unda yüklenir. ES (evrim) SELF-PLAY:
// RED = NN (NeuralBrain, posture/menzil ezer), BLUE = kural-AI. OpenAI-ES ile NN ağırlıkları
// evrimleşir; fitness = kuvvet-ekonomisi + galibiyet (RED açısından). KEŞİF KANITI: fitness'in
// başlangıç ağının üstüne çıkması = AI, kuralın ötesinde YENİ kazanan davranış buluyor.
// Determinist (seed'li RNG + sabit ordu + nesil-başı aynı maç). Çıktı: __OUT (es_train yazar).
(function () {
    SIM.headless = true;
    const E = (k, d) => (typeof process !== 'undefined' && process.env && process.env[k] != null) ? process.env[k] : d;
    let SIZES = String(E('ES_SIZES', '240,24,16,20')).split(',').map(Number);
    const POP = Math.max(2, +E('ES_POP', 8));      // çift (antithetic çift sayısı = POP/2)
    const SIGMA = +E('ES_SIGMA', 0.10);
    const LR = +E('ES_LR', 0.08);
    const GENS = +E('ES_GENS', 60);
    const TICKS = +E('ES_TICKS', 900), STEP = 64;   // UZUN maç (grid'de su/köprü maneuver sonrası çözülsün) — kısma yok
    SIZES[0] = BrainState.SCALAR_DIM; SIZES[SIZES.length - 1] = 20;

    let _s = 20240601 >>> 0;
    const rnd = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; };
    const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

    const ARMY = new Array(9).fill(0); ARMY[T.INFANTRY] = 4; ARMY[T.MECH_INFANTRY] = 2; ARMY[T.ARMOR] = 1; ARMY[T.ANTI_TANK] = 1; ARMY[T.ARTILLERY] = 1; ARMY[T.RECON] = 1;
    const genome = (typeof commanderGenome !== 'undefined' && commanderGenome) ? commanderGenome : (typeof aiGenome !== 'undefined' ? aiGenome : null);
    // HİBRİT (conv ALGI + skaler) varsayılan; ES_SCALAR=1 ile eski skaler-MLP'ye düş
    const useHybrid = (typeof HybridBrain !== 'undefined') && +E('ES_SCALAR', 0) !== 1;
    const net = useHybrid ? new HybridBrain(HybridBrain.defaultCfg(BrainState.SCALAR_DIM, BrainState.CHANNELS, BrainState.GRID_N)) : new NeuralBrain(SIZES);
    const NPAR = net.nParams;
    const INIT = +E('ES_INIT', 0.30);   // başlangıç ağırlık ölçeği — posture argmax'ı çeşitlensin (çok küçükse hep aynı)
    let w = new Float64Array(NPAR); for (let i = 0; i < NPAR; i++) w[i] = gauss() * INIT;

    function sideVal(isRed) { return spSideUnits(isRed).reduce((s, u) => s + STATS[u.type].cost, 0); }
    function fitness(weights, seed) {
        net.setWeights(weights); NN.brain = net; NN.enabled = true; NN.side = true; NN.throttleCycles = 3;   // RED = NN
        units.length = 0; if (typeof trenches !== 'undefined') trenches.length = 0;
        player.money = 1500; enemy.money = 1500; player.kills = 0; enemy.kills = 0;
        phase = PHASE.BATTLE; if (typeof playerMeta !== 'undefined') playerMeta = {};
        resetSimRng((seed >>> 0) || 1);
        const _a = spRandomArmy(1500); spDeployArmy(_a, false); spDeployArmy(_a, true);   // simetrik ama ÇEŞİTLİ ordu (seed'den deterministik) → fark=POLİTİKA + genelleme
        if (typeof initControlPoints === 'function') initControlPoints();
        if (typeof commanderReset === 'function') commanderReset();
        const initR = sideVal(true), initB = sideVal(false);
        let now = 0;
        for (let t = 0; t < TICKS; t++) {
            now += STEP;
            stepSim(now, STEP / 1000, function (n) { commanderGenome = genome; commanderDrive(true, n); commanderGenome = genome; commanderDrive(false, n); }, false);
            if (SIM.vpWinner != null) break;
            let r = 0, b = 0; for (const u of units) { if (u.dead) continue; if (u.isRed) r++; else b++; } if (r === 0 || b === 0) break;
        }
        NN.enabled = false; NN.side = null;
        const redLost = initR - sideVal(true), blueLost = initB - sideVal(false);
        let f = (blueLost - redLost);                          // RED(=NN) açısından kuvvet-ekonomisi
        if (SIM.vpWinner === false) f += 400; else if (SIM.vpWinner === true) f -= 400;   // false=RED kazandı
        let r = 0, b = 0; for (const u of units) { if (u.dead) continue; if (u.isRed) r++; else b++; }
        if (b === 0 && r > 0) f += 400; if (r === 0 && b > 0) f -= 400;
        return f;
    }

    // ÇOK-SEED ortalama (gürültü azalt) + ELİTİST (1+λ): kazanımı asla kaybetme → temiz keşif eğrisi
    const EVAL_SEEDS = [101, 202, 303, 404, 505];   // 5 çeşitli senaryo (farklı ordu+RNG) → genelleme
    const evalAvg = (weights) => { let s = 0; for (const sd of EVAL_SEEDS) s += fitness(weights, sd); return s / EVAL_SEEDS.length; };
    let bestFit = evalAvg(w);
    const baseline = bestFit;
    let nset = 0; const pc = {}; for (const u of units) { if (u.nnPosture != null) { nset++; pc[u.nnPosture] = (pc[u.nnPosture] || 0) + 1; } }
    console.error('[ES] NN-aktif birim=' + nset + ' posture-çeşidi=' + JSON.stringify(pc) + ' | param=' + NPAR);
    console.error('[ES] başlangıç fitness (çok-seed ort) = ' + baseline.toFixed(1));
    const log = [];
    let sig = SIGMA;
    for (let g = 0; g < GENS; g++) {
        let improved = false, genBest = bestFit, bestCand = null;
        for (let p = 0; p < POP; p++) {
            const cand = new Float64Array(NPAR); for (let i = 0; i < NPAR; i++) cand[i] = w[i] + sig * gauss();
            const f = evalAvg(cand);
            if (f > genBest) { genBest = f; bestCand = cand; improved = true; }
        }
        if (improved) { w = bestCand; bestFit = genBest; }       // ELİTİST: sadece iyileşirse benimse
        else sig *= 0.85;                                        // takıldı → daha ince ara
        log.push({ gen: g, best: +bestFit.toFixed(1), sigma: +sig.toFixed(3) });
        console.error('[ES] gen' + g + ' en-iyi-fitness=' + bestFit.toFixed(1) + (improved ? ' ↑' : ' (sigma↓ ' + sig.toFixed(3) + ')'));
    }
    const finalFit = bestFit;
    console.error('[ES] SON en-iyi=' + finalFit.toFixed(1) + ' (başlangıç ' + baseline.toFixed(1) + ')');

    net.setWeights(w);
    __OUT = {
        baseline: +baseline.toFixed(1), final: +finalFit.toFixed(1), kesif: +(finalFit - baseline).toFixed(1),
        nparams: NPAR, sizes: useHybrid ? 'hibrit' : SIZES, gens: log,
        brainJSON: net.toJSON()    // hibrit {hybrid,cfg,weights} ya da skaler {sizes,weights} → nnLoadBrain ikisini de yükler
    };
})();
