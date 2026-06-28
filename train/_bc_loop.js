// _bc_loop.js — gen_bc.js TARAFINDAN aynı eval-scope'unda yüklenir (units/SIM/stepSim/
// spDeployArmy/commanderDrive/BrainState/STATS... hepsi görünür). TEMİZ-KOMUTAN yolu
// (commanderDrive → cmdrOrderUnit u.intent yazar) → BrainState girdisi + kural-AI intent etiketi.
// KONSEY FIX: ÇOK-SENARYOLU veri-çeşitliliği — harita döngüsü (grid+elevation/orman) + asimetrik
// ordular (zayıf taraf DISENGAGE/regroup tetikler) → ölü kanallar canlanır, manevra çeşitlenir.
(function () {
    SIM.headless = true;

    function smallArmy() { const c = new Array(9).fill(0); c[T.INFANTRY] = 4; c[T.MECH_INFANTRY] = 2; c[T.RECON] = 1; return c; }   // küçük → kuşatılır → DISENGAGE/regroup
    function engArmy() { const c = (typeof spRandomArmy === 'function') ? spRandomArmy(1500) : smallArmy(); c[T.ENGINEER] = (c[T.ENGINEER] || 0) + 2; c[T.RECON] = (c[T.RECON] || 0) + 1; return c; }   // siper/ikmal + keşif

    // SENARYO LİSTESİ: harita × ordu-dengesi çeşidi (grid=-2; circle 0/3/8/6 = dağ/geçit/orman/köşe → elevation+orman+cover canlanır)
    const MAPSEQ = [-2, 0, 3, 8, 6];
    const scenarios = [];
    for (const m of MAPSEQ) {
        scenarios.push({ map: m, blue: (typeof spRandomArmy === 'function') ? spRandomArmy(1500) : smallArmy(), red: (typeof spRandomArmy === 'function') ? spRandomArmy(1500) : smallArmy(), ticks: 600 });   // dengeli
        scenarios.push({ map: m, blue: (typeof spRandomArmy === 'function') ? spRandomArmy(2400) : engArmy(), red: smallArmy(), ticks: 520 });   // mavi güçlü → KIRMIZI çekilir
    }
    // bir senaryoda da mühendis/siper (ikmal/trench kanalları için)
    scenarios.push({ map: 0, blue: engArmy(), red: engArmy(), ticks: 650 });

    const STEP = 64, COLLECT_EVERY = 8;
    const samples = [];
    const postureCount = {};
    let nNaN = 0, scalarLen = 0, spatialLen = 0;
    const genome = (typeof commanderGenome !== 'undefined' && commanderGenome) ? commanderGenome
        : (typeof aiGenome !== 'undefined' ? aiGenome : null);

    let seed = 1;
    for (const sc of scenarios) {
        if (typeof applyMap === 'function') applyMap(sc.map);   // harita değiş (grid/circle); initControlPoints SIM.tick=0 yapar
        units.length = 0;
        if (typeof trenches !== 'undefined') trenches.length = 0;
        player.money = 1500; enemy.money = 1500; player.kills = 0; enemy.kills = 0;
        phase = PHASE.BATTLE; if (typeof playerMeta !== 'undefined') playerMeta = {};
        if (typeof resetSimRng === 'function') resetSimRng(((seed++) * 2654435761) >>> 0);
        spDeployArmy(sc.blue, false);
        spDeployArmy(sc.red, true);
        if (typeof initControlPoints === 'function') initControlPoints();
        if (typeof commanderReset === 'function') commanderReset();

        let now = 0;
        for (let t = 0; t < sc.ticks; t++) {
            now += STEP;
            stepSim(now, STEP / 1000, function (n) {
                commanderGenome = genome; commanderDrive(true, n);
                commanderGenome = genome; commanderDrive(false, n);
            }, false);
            if (t % COLLECT_EVERY === 0) {
                for (const u of units) {
                    if (u.dead || !u.intent) continue;
                    const st = BrainState.encode(u, now);
                    for (let k = 0; k < st.scalars.length; k++) if (st.scalars[k] !== st.scalars[k]) { nNaN++; break; }
                    scalarLen = st.scalars.length; spatialLen = st.spatial.length;
                    const post = u.intent.posture || 'ATTACK';
                    postureCount[post] = (postureCount[post] || 0) + 1;
                    samples.push({ s: Array.from(st.scalars), posture: post, range: (u.intent.preferredRange != null) ? u.intent.preferredRange : 0.62, side: u.isRed ? 1 : 0 });
                }
            }
            if (typeof SIM !== 'undefined' && SIM.vpWinner != null) break;
            let r = 0, b = 0; for (const u of units) { if (u.dead) continue; if (u.isRed) r++; else b++; }
            if (r === 0 || b === 0) break;
        }
    }

    __OUT = {
        meta: {
            ornek_sayisi: samples.length,
            scalar_boyut: scalarLen, spatial_boyut: spatialLen,
            NaN_ornek: nNaN,
            posture_dagilimi: postureCount,
            senaryo_sayisi: scenarios.length
        },
        data: samples
    };
})();
