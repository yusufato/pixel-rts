// _bc_loop.js — gen_bc.js TARAFINDAN aynı eval-scope'unda yüklenir (units/SIM/stepSim/
// spDeployArmy/commanderDrive/BrainState/STATS... hepsi görünür). TEMİZ-KOMUTAN yolu
// (commanderDrive → cmdrOrderUnit u.intent yazar) → BrainState girdisi + kural-AI intent
// etiketi toplar (davranış-klonlama verisi). spRunCommanderMatch (SelfPlay.js:674) aynası.
(function () {
    SIM.headless = true;
    if (typeof applyMap === 'function') applyMap(-2);          // çizilen ızgara-harita (su/köprü + T3 girdileri dolu)

    const STEP = 64, COLLECT_EVERY = 8, NUM_MATCHES = 4, MAX_TICKS = 900;
    const samples = [];
    const postureCount = {};
    let nNaN = 0, scalarLen = 0, spatialLen = 0;
    const genome = (typeof commanderGenome !== 'undefined' && commanderGenome) ? commanderGenome
        : (typeof aiGenome !== 'undefined' ? aiGenome : null);

    for (let m = 0; m < NUM_MATCHES; m++) {
        units.length = 0;
        if (typeof trenches !== 'undefined') trenches.length = 0;
        player.money = 1500; enemy.money = 1500; player.kills = 0; enemy.kills = 0;
        phase = PHASE.BATTLE; if (typeof playerMeta !== 'undefined') playerMeta = {};
        if (typeof resetSimRng === 'function') resetSimRng((((m + 1) * 1664525 + 1013904223)) >>> 0);
        spDeployArmy(spRandomArmy(), false);                  // mavi (güney)
        spDeployArmy(spRandomArmy(), true);                   // kırmızı (kuzey)
        if (typeof initControlPoints === 'function') initControlPoints();
        if (typeof commanderReset === 'function') commanderReset();

        let now = 0;
        for (let t = 0; t < MAX_TICKS; t++) {
            now += STEP;
            stepSim(now, STEP / 1000, function (n) {
                commanderGenome = genome; commanderDrive(true, n);    // kuzey/kırmızı komutan
                commanderGenome = genome; commanderDrive(false, n);   // güney/mavi komutan
            }, false);
            if (t % COLLECT_EVERY === 0) {
                for (const u of units) {
                    if (u.dead || !u.intent) continue;
                    const st = BrainState.encode(u, now);
                    for (let k = 0; k < st.scalars.length; k++) if (st.scalars[k] !== st.scalars[k]) { nNaN++; break; }
                    scalarLen = st.scalars.length; spatialLen = st.spatial.length;
                    const post = u.intent.posture || 'ATTACK';
                    postureCount[post] = (postureCount[post] || 0) + 1;
                    samples.push({
                        s: Array.from(st.scalars),
                        posture: post,
                        range: (u.intent.preferredRange != null) ? u.intent.preferredRange : 0.62,
                        side: u.isRed ? 1 : 0
                    });
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
            mac_sayisi: NUM_MATCHES,
            harita_modu: (typeof MAP_MODE !== 'undefined') ? MAP_MODE : '?'
        },
        data: samples
    };
})();
