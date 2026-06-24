// ═══════════════════════════════════════════════════════════════
//  HEADLESS SELF-PLAY ARENASI
//  Canlı oyunla AYNI motoru kullanır: gerçek Unit.update + gerçek
//  LayeredAIController (iki taraf için) + gerçek calculateUnitDamage.
//  Amaç: eğitim, oyunu GERÇEKTEN oynayan beyni eğitsin (tek doğruluk kaynağı).
// ═══════════════════════════════════════════════════════════════

const SP_BUDGET = 1500;
const SP_STEP = 64;          // her tick'te ilerleyen sim-ms (≈ 60fps × GAME_SPEED)
const SP_MAX_TICKS = 3000;   // ≈ 192 sim-sn üst sınır (kilitlenmeyi keser)

// Hafif yardımcılar ----------------------------------------------------------
function spSideUnits(isRed) {
    const out = [];
    for (const u of units) if (!u.dead && u.isRed === isRed) out.push(u);
    return out;
}
function spSumHp(isRed) {
    let s = 0;
    for (const u of units) if (!u.dead && u.isRed === isRed) s += u.hp;
    return s;
}

// Verilen kompozisyonu (9'luk sayım) bir tarafa yerleştirir.
// Mavi (isRed=false) alt yarı, kırmızı üst yarı. Kırmızı normalde aiDeploy ile kurulur.
function spDeployArmy(counts, isRed) {
    let placed = 0;
    for (let type = 0; type < 9; type++) {
        const n = counts[type] || 0;
        for (let i = 0; i < n; i++) {
            const col = placed % 6;
            const row = Math.floor(placed / 6);
            const rx = WORLD_W * 0.5 + (col - 2.5) * 150 + (Math.random() * 50 - 25);
            const ry = isRed
                ? 200 + row * 110 + (Math.random() * 40 - 20)
                : WORLD_H - 220 - row * 110 + (Math.random() * 40 - 20);
            placeUnit(type, rx, ry, isRed);
            placed++;
        }
    }
}

// Bütçeden basit/çeşitli bir ordu kompozisyonu üretir (rasgele tohumlu).
function spRandomArmy(budget = SP_BUDGET) {
    const counts = new Array(9).fill(0);
    // Lojistik çekirdek
    counts[T.ENGINEER] = 1; budget -= STATS[T.ENGINEER].cost;
    let attempts = 0;
    while (budget > 40 && attempts < 60) {
        const type = Math.floor(Math.random() * 9);
        if (type === T.ENGINEER) { attempts++; continue; }
        if (budget >= STATS[type].cost) { counts[type]++; budget -= STATS[type].cost; }
        attempts++;
    }
    return counts;
}

// ── REPLAY: insan kaydını mavi taraf olarak kur + oynat ──
// Mavi birimleri tam kaydedilen konumlarda yerleştirir, recId atar.
function spDeployReplay(replay) {
    player.money = 1e9;                       // tüm kayıtlı birimler kesin yerleşsin
    for (let i = 0; i < replay.deploy.length; i++) {
        const d = replay.deploy[i];
        const before = units.length;
        placeUnit(d.type, d.x, d.y, false);
        if (units.length > before) units[units.length - 1].recId = i;
    }
}

// Zamanı gelen kayıtlı emirleri mavi birimlere uygular (now = savaş başından beri ms).
function spApplyReplayCommands(replay, state, now) {
    const cmds = replay.commands;
    while (state.idx < cmds.length && cmds[state.idx].t <= now) {
        const cmd = cmds[state.idx++];
        const targets = [];
        for (const u of units) {
            if (!u.dead && !u.isRed && cmd.ids.indexOf(u.recId) !== -1) targets.push(u);
        }
        if (!targets.length) continue;
        if (cmd.kind === 'attack') {
            // Kayıt anındaki tıklama noktasına en yakın canlı kırmızıyı hedefle (attack-move).
            let foe = null, best = 280;
            for (const e of units) {
                if (e.dead || !e.isRed) continue;
                const dd = Math.hypot(e.x - cmd.x, e.y - cmd.y);
                if (dd < best) { best = dd; foe = e; }
            }
            for (const u of targets) {
                if (foe) { u.manualTarget = foe; u.manualMoveTarget = null; u.isMovingToManualTarget = false; }
                else { u.manualMoveTarget = { x: cmd.x, y: cmd.y }; u.manualTarget = null; u.isMovingToManualTarget = true; u.attackTarget = null; u.targetX = cmd.x; u.targetY = cmd.y; }
            }
        } else { // move
            for (const u of targets) {
                u.manualMoveTarget = { x: cmd.x, y: cmd.y }; u.manualTarget = null;
                u.isMovingToManualTarget = true; u.attackTarget = null; u.targetX = cmd.x; u.targetY = cmd.y;
            }
        }
    }
}

// Tek bir headless maç çalıştırır. Kırmızı = redGenome (canlı AI gibi mavi'yi
// sayar), Mavi = blueGenome (kendi beynini kullanır, verilen kompozisyonla).
// Geri dönüş: { winner, redValueLost, blueValueLost, ticks, decisive }
function spRunMatch(redGenome, blueGenome, blueCounts = null, maxTicks = SP_MAX_TICKS, blueReplay = null) {
    // ── Global durumu yedekle (canlı oyunu bozmamak için) ──
    const snap = {
        phase, aiGenome, aiFocusTarget, playerMeta,
        playerMoney: player.money, enemyMoney: enemy.money,
        playerKills: player.kills, enemyKills: enemy.kills,
        unitsArr: units.slice(), trenchesArr: trenches.slice(),
        decalsLen: decals.length, cratersLen: craters.length, particlesLen: particles.length,
        btStarted: typeof battleTelemetry !== 'undefined' ? battleTelemetry.started : false,
        // BÖLGE durumunu da yedekle (panel bug'ı: eksikti → eğitim canlı oyunu bozuyordu)
        cpArr: typeof controlPoints !== 'undefined' ? controlPoints : null,
        vpScoreObj: typeof vpScore !== 'undefined' ? vpScore : null,
        vpWinnerVal: typeof vpWinner !== 'undefined' ? vpWinner : null
    };
    if (typeof battleTelemetry !== 'undefined') battleTelemetry.started = false; // global telemetriye kayıt olmasın

    let result;
    try {
        // ── Sahayı temizle ve kur ──
        units.length = 0;
        trenches.length = 0;
        player.money = SP_BUDGET; enemy.money = SP_BUDGET;
        player.kills = 0; enemy.kills = 0;
        phase = PHASE.BATTLE;
        playerMeta = {};                          // kırmızı sadece anlık mavi'yi saysın

        if (blueReplay) {
            spDeployReplay(blueReplay);           // mavi = insan kaydı (tam diziliş)
        } else {
            spDeployArmy(blueCounts || spRandomArmy(), false); // mavi orduyu alt yarıya yerleştir
        }

        aiGenome = redGenome;                     // kırmızı, redGenome ile mavi'yi sayarak konuşlanır
        aiDeploy();
        if (typeof initControlPoints === 'function') initControlPoints();   // FAZ 1: eğitim arenası da bölge simüle etsin

        // İlk değerler (fitness için)
        const initRedValue = spSideUnits(true).reduce((s, u) => s + STATS[u.type].cost, 0);
        const initBlueValue = spSideUnits(false).reduce((s, u) => s + STATS[u.type].cost, 0);

        // ── İki taraf için gerçek beyin + ayrı telemetri ──
        const telRed = new BattleTelemetry();
        const telBlue = new BattleTelemetry();
        telRed.start(0); telBlue.start(0);
        const redCtrl = new LayeredAIController(true, telRed);
        const blueCtrl = blueReplay ? null : new LayeredAIController(false, telBlue);
        redCtrl.reset(0); if (blueCtrl) blueCtrl.reset(0);
        const replayState = { idx: 0 };   // replay komut imleci

        let now = 0;
        let ticks = 0;
        let lastActivityTick = 0;
        let prevTotalHp = spSumHp(true) + spSumHp(false);
        let firstContactTick = -1;   // kırmızı ilk hasarı ne zaman verdi (temas hızı)
        let redActiveTicks = 0;      // kırmızının aktif hasar verdiği tick sayısı
        let prevBlueLostTrack = 0;

        while (ticks < maxTicks) {
            now += SP_STEP;
            ticks++;

            // Savaş adımı (canlı gameLoop ile aynı sıra, render yok)
            updateTrenches(now);
            spatialGrid.clear();
            for (let i = units.length - 1; i >= 0; i--) {
                if (units[i].dead) units.splice(i, 1);
                else spatialGrid.insert(units[i]);
            }
            units.forEach(u => u.update(now));
            resolveCollisions();

            // Kırmızı beyin (genom-takas hilesi)
            aiGenome = redGenome; redCtrl.update(now);
            // Mavi: ya insan replay'i oynat, ya kendi beyni
            if (blueReplay) spApplyReplayCommands(blueReplay, replayState, now);
            else { aiGenome = blueGenome; blueCtrl.update(now); }

            // FAZ 1: bölge kontrolü/zafer puanı simülasyonu (canlı oyunla aynı kural)
            if (typeof updateControlPoints === 'function') updateControlPoints(SP_STEP / 1000, now);

            // Per-side telemetriyi besle (controller kararları için yaklaşık)
            const redHp = spSumHp(true), blueHp = spSumHp(false);
            const redValNow = spSideUnits(true).reduce((s, u) => s + STATS[u.type].cost, 0);
            const blueValNow = spSideUnits(false).reduce((s, u) => s + STATS[u.type].cost, 0);
            const redLost = initRedValue - redValNow;
            const blueLost = initBlueValue - blueValNow;
            spFeedTelemetry(telRed, initRedValue - redValNow, blueLost, initRedValue, redHp, blueHp, false);
            spFeedTelemetry(telBlue, blueLost, redLost, initBlueValue, blueHp, redHp, true);

            // Temas hızı / aktiflik takibi (öğrenme fitness'ı için)
            if (firstContactTick < 0 && blueLost > 0) firstContactTick = ticks;
            if (blueLost > prevBlueLostTrack + 0.5) redActiveTicks++;
            prevBlueLostTrack = blueLost;

            // Aktivite / kilitlenme takibi
            const totalHp = redHp + blueHp;
            if (Math.abs(totalHp - prevTotalHp) > 1) lastActivityTick = ticks;
            prevTotalHp = totalHp;

            // Bitiş kontrolü
            const redAlive = redHp > 0, blueAlive = blueHp > 0;
            if (!redAlive || !blueAlive) break;
            if (typeof vpWinner !== 'undefined' && vpWinner !== null) break;   // FAZ 1: bölge puanı eşiği = maç biter
            if (ticks - lastActivityTick > 400) break; // 400 tick (~25 sn) hareketsizlik → kilitlenme
        }

        const redVal = spSideUnits(true).reduce((s, u) => s + STATS[u.type].cost, 0);
        const blueVal = spSideUnits(false).reduce((s, u) => s + STATS[u.type].cost, 0);
        const rVp = (typeof vpScore !== 'undefined') ? vpScore.red : 0;
        const bVp = (typeof vpScore !== 'undefined') ? vpScore.blue : 0;
        const vpW = (typeof vpWinner !== 'undefined') ? vpWinner : null;
        let winner = 'draw';
        // FAZ 1: KAZANAN = bölge-öncelikli, değer-ikincil
        if (vpW !== null) winner = (vpW === false) ? 'red' : 'blue';   // bölge puan eşiği aşıldı (false=kırmızı/AI)
        else if (redVal > 0 && blueVal <= 0) winner = 'red';           // yok-etme
        else if (blueVal > 0 && redVal <= 0) winner = 'blue';
        else if (rVp > bVp + 60) winner = 'red';                       // zaman aşımı: önce tutulan bölge
        else if (bVp > rVp + 60) winner = 'blue';
        else if (redVal > blueVal * 1.05) winner = 'red';              // sonra değer üstünlüğü
        else if (blueVal > redVal * 1.05) winner = 'blue';

        result = {
            winner,
            redValueLost: initRedValue - redVal,
            blueValueLost: initBlueValue - blueVal,
            redValueRemaining: redVal,
            blueValueRemaining: blueVal,
            redVp: rVp, blueVp: bVp,            // FAZ 1: bölge puanları (fitness için)
            ticks,
            decisive: !(redVal > 0 && blueVal > 0) || vpW !== null,
            contactTicks: firstContactTick < 0 ? maxTicks : firstContactTick,
            redActiveRatio: ticks > 0 ? redActiveTicks / ticks : 0,
            redDealtNoDamage: (initBlueValue - blueVal) <= 0,
            maxTicks
        };
    } finally {
        // ── Global durumu geri yükle ──
        units.length = 0; for (const u of snap.unitsArr) units.push(u);
        trenches.length = 0; for (const f of snap.trenchesArr) trenches.push(f);
        decals.length = snap.decalsLen; craters.length = snap.cratersLen; particles.length = snap.particlesLen; // eğitim kalıntılarını temizle
        phase = snap.phase;
        aiGenome = snap.aiGenome;
        aiFocusTarget = snap.aiFocusTarget;
        playerMeta = snap.playerMeta;
        player.money = snap.playerMoney; enemy.money = snap.enemyMoney;
        player.kills = snap.playerKills; enemy.kills = snap.enemyKills;
        if (typeof battleTelemetry !== 'undefined') battleTelemetry.started = snap.btStarted;
        // BÖLGE durumunu geri yükle (canlı oyun bozulmasın) — maç initControlPoints ile yeni dizi atadı
        if (snap.cpArr !== null) controlPoints = snap.cpArr;
        if (snap.vpScoreObj !== null) vpScore = snap.vpScoreObj;
        if (typeof vpWinner !== 'undefined') vpWinner = snap.vpWinnerVal;
    }
    return result;
}

// Bir tarafın telemetrisine controller kararları için yaklaşık değerleri yazar.
function spFeedTelemetry(tel, dealtValueProxy, takenValueProxy, initValue, ownHp, foeHp, swap) {
    // hp tabanlı kaba hasar vekili (oran kararları için yeterli)
    tel.damageDealt = Math.max(tel.damageDealt, dealtValueProxy * 3);
    tel.damageTaken = Math.max(tel.damageTaken, takenValueProxy * 3);
    tel.enemyValueDestroyed = takenValueProxy; // not: bu tarafın YOK ETTİĞİ düşman değeri = düşmanın kaybı
    tel.aiValueLost = dealtValueProxy;          // bu tarafın KENDİ kaybı
    // idle: hp'ler değişmiyorsa idleSeconds artsın (controller temasa zorlasın)
    if (tel._spPrevHp === undefined) tel._spPrevHp = ownHp + foeHp;
    const moved = Math.abs((ownHp + foeHp) - tel._spPrevHp) > 1;
    tel._spPrevHp = ownHp + foeHp;
    if (!moved) tel.idleSeconds += SP_STEP / 1000;
}

// ═══════════════════════════════════════════════════════════════
//  SELF-PLAY EVRİM EĞİTİMİ
//  Aday genomlar KIRMIZI olarak, mevcut şampiyona (MAVİ) karşı gerçek
//  motorda dövüşür. En iyi aday yeni şampiyon olur (elitizm → gerileme yok).
// ═══════════════════════════════════════════════════════════════
const SP_TRAIN = { GEN_MAX: 18, CANDIDATES: 6, SCENARIOS: 2, MATCH_MAX_TICKS: 2400, BATCH: 1 };
let spTraining = false;

// Eğitim ölçeğini ayarla. total ≈ GEN_MAX × (CANDIDATES+2) × SCENARIOS
function spScaleTraining(totalTarget, batch) {
    const perGen = (SP_TRAIN.CANDIDATES + 2) * SP_TRAIN.SCENARIOS;
    SP_TRAIN.GEN_MAX = Math.max(1, Math.round(totalTarget / perGen));
    if (batch) SP_TRAIN.BATCH = batch;
    console.log(`Eğitim ölçeği: ~${SP_TRAIN.GEN_MAX * perGen} maç · ${SP_TRAIN.GEN_MAX} nesil · batch ${SP_TRAIN.BATCH}`);
    return { matches: SP_TRAIN.GEN_MAX * perGen, ...SP_TRAIN };
}
function spTrainTest() { return spScaleTraining(288, 1); }        // gelişimi izlemek için (akıcı)
function spTrainOvernight() { return spScaleTraining(20000, 16); } // sabaha kadar (batch'li, hızlı)
// Tek komutla ölçekle + başlat (konsola yapıştır):  spRunOvernight()
function spRunOvernight() { spTrainOvernight(); spStartTraining(); }

// Öğrenme şekillendirme: pasifliği cezala, hızlı/aktif teması ödüllendir.
// (Boşta bekleyip kaybeden bir beyin asla seçilmesin → canlı maçtaki %69 idle kırılır.)
// KUVVET EKONOMİSİ shaping: sabır (kuşatma/yoğunlaşma) artık MEŞRU; sadece tam atalet & hiç-vuramama cezalı.
// (Eski -900 geç-temas cezası AI'yı erken charge'a zorluyordu → yeni temelle çelişiyordu, kaldırıldı.)
function spEngagementShaping(r) {
    let s = 0;
    const ref = r.maxTicks || SP_TRAIN.MATCH_MAX_TICKS;
    if (r.redDealtNoDamage) s -= 800;            // hiç hasar vermeme = işe yaramaz
    s += (r.redActiveRatio || 0) * 120;          // aktiflik küçük ödül (baskın değil)
    s -= (r.contactTicks / ref) * 200;           // çok geç temas hafif cezalı (tam atalet engeli)
    return s;
}

const SP_LOSS_AVERSION = (typeof FORESIGHT_CALIB !== 'undefined' ? FORESIGHT_CALIB.lossAversion : 1.6);
const SP_NET_SCALE = 4.0;
const SP_VP_WEIGHT = 1.0;   // FAZ 1: bölge puan farkı ödülü (turtle-kırıcı: nokta tut → puan götür → kazan)

// Tek maç fitness'ı: kuvvet ekonomisi (net = düşman_kaybı − k×kendi_kaybım) + BÖLGE puanı. Telemetri ödülüyle aynı felsefe.
function spMatchFitness(candidateGenome, championGenome, blueCounts) {
    const r = spRunMatch(candidateGenome, championGenome, blueCounts, SP_TRAIN.MATCH_MAX_TICKS);
    let f = (r.blueValueLost - SP_LOSS_AVERSION * r.redValueLost) * SP_NET_SCALE;
    f += ((r.redVp || 0) - (r.blueVp || 0)) * SP_VP_WEIGHT;   // tutulan bölge × süre
    if (r.winner === 'red') f += 500;
    else if (r.winner === 'blue') f -= 380;
    if (r.decisive && r.winner === 'red') f += 120;
    f += spEngagementShaping(r);
    return f;
}

function spMakeScenarios(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(spRandomArmy());
    return out;
}

// Eğitim rakip havuzu. İnsan replay'i varsa → beyin DOĞRUDAN insana karşı dövüşür
// (her kayıt bir rakip) + genel sağlamlık için 1 agresif self. Yoksa eski self-play.
function spBuildOpponents(replays) {
    const out = [];
    if (replays && replays.length) {
        for (const rep of replays.slice(-6)) out.push({ kind: 'replay', replay: rep });
        out.push({ kind: 'aggressive', army: spRandomArmy() });   // genel dövüş yeteneği körelmesin
        out.push({ kind: 'turtle', army: spRandomArmy() });       // FAZ 4: turtle'ı yenmeyi öğren (insanın stratejisi)
    } else {
        for (let i = 0; i < SP_TRAIN.SCENARIOS; i++) {
            const k = i % 3;
            out.push({ kind: k === 1 ? 'aggressive' : k === 2 ? 'turtle' : 'mirror', army: spRandomArmy() });
        }
    }
    return out;
}

// İnsan gibi BASKI yapan rakip: şampiyonun agresif klonu (rush/saldırgan genler).
// Beyin sadece pasif aynaya değil, üstüne gelen bir düşmana karşı da öğrensin.
function spAggressiveGenome(g) {
    const a = cloneGenome(g);
    const t = a.tacticGenes;
    t.vanguardAggression = Math.min(2, (t.vanguardAggression || 1) * 1.6 + 0.4);
    t.flankAggression = Math.min(2, (t.flankAggression || 1) * 1.4 + 0.3);
    t.vanguardRetreat = Math.max(0, (t.vanguardRetreat || 0.1) * 0.3);
    t.flankRetreat = Math.max(0, (t.flankRetreat || 0.1) * 0.3);
    t.decisiveForceRatio = Math.max(0.6, (t.decisiveForceRatio || 1.3) * 0.6);          // daha kolay saldırı kararı
    t.tacticalRetreatForceRatio = Math.max(0.3, (t.tacticalRetreatForceRatio || 1) * 0.5);
    t.cohesion = Math.min(1, (t.cohesion || 0.5) * 0.8);                                  // hızlı, ısrarlı baskı
    return a;
}

// FAZ 4: SENTETİK TURTLE rakibi — insanın kazanan stratejisi (yoğun savunma, hattı tut, üzerine çek).
// Beyin bunu YENMEYİ öğrenmeli (bölge baskısı + pin-punch). Aksi halde turtle'a karşı pratik yapamaz.
function spTurtleGenome(g) {
    const a = cloneGenome(g);
    const t = a.tacticGenes;
    t.vanguardAggression = Math.max(0.55, (t.vanguardAggression || 1) * 0.5);   // saldırmaz, bekler
    t.flankAggression = Math.max(0.6, (t.flankAggression || 1) * 0.6);
    t.vanguardRetreat = Math.min(0.48, (t.vanguardRetreat || 0.3) + 0.2);       // baskı görünce çekilip toplanır
    t.cohesion = Math.min(0.90, (t.cohesion || 0.6) + 0.25);                    // sıkı yoğun hat
    t.threatAvoidance = Math.min(1.6, (t.threatAvoidance || 1) + 0.5);          // riske girmez
    t.lossAversion = Math.min(2.4, (t.lossAversion || 1.6) + 0.5);              // kuvvetini korur
    t.decisiveForceRatio = Math.min(1.9, (t.decisiveForceRatio || 1.35) + 0.4); // ancak ezici üstünlükte saldırır
    t.vpPressureWeight = 0.4;                                                    // bölgeyi pek zorlamaz (turtle)
    return a;
}

function spBuildPopulation(champion, stagnation) {
    const profile = getAdaptiveMutationProfile(stagnation * 200); // durgunluk arttıkça daha agresif mutasyon
    const pop = [cloneGenome(champion)];                          // 0: elit (mutasyonsuz) → şampiyon asla gerilemez
    for (let k = 0; k < SP_TRAIN.CANDIDATES; k++) pop.push(mutateGenome(champion, profile));
    pop.push(mutateGenome(crossoverGenomes(champion, mutateGenome(champion, profile)), profile)); // bir çapraz çocuk
    return pop;
}

function spStartTraining(cfg) {
    if (spTraining) return;
    if (phase !== PHASE.DEPLOY) { console.warn('Eğitim sadece menü/deploy ekranında başlatılabilir.'); return; }
    cfg = cfg || {};
    if (cfg.batch) SP_TRAIN.BATCH = cfg.batch;   // mod: batch (ölçek aşağıda, rakip sayısına göre)
    spTraining = true;
    const screen = document.getElementById('ai-training-screen');
    const bar = document.getElementById('train-progress-bar');
    const txt = document.getElementById('train-progress-text');
    if (screen) screen.classList.remove('hidden');

    let champion = cloneGenome(aiGenome);
    let stagnation = 0, gen = 0;
    const useReplays = cfg.useReplays !== false;   // mod: insana karşı mı, saf self-play mi
    const replays = (useReplays && typeof replayLoadAll === 'function') ? replayLoadAll() : [];
    const replayCount = Math.min(6, replays.length);
    let opponents = spBuildOpponents(replays);   // replay varsa = insana karşı eğitim
    const oppCount = opponents.length;
    let candidates = spBuildPopulation(champion, stagnation);
    let fit = new Array(candidates.length).fill(0);
    let fitHuman = new Array(candidates.length).fill(0);   // SADECE insan replay maçlarının fitness'ı (asıl hedef)
    let ci = 0, si = 0, done = 0, gensImproved = 0;
    let redWins = 0, blueWins = 0, draws = 0, sumRedLost = 0, sumBlueLost = 0, bestGenFit = -Infinity;
    let genRedWins = 0, genMatches = 0;
    let replayWins = 0, replayMatches = 0, genReplayWins = 0, genReplayMatches = 0;
    const genLog = [];                 // nesil-nesil gelişim kaydı (canlı izlenir)
    // cfg.scale = HEDEF GERÇEK maç sayısı (rakip sayısını da hesaba kat) → "2000" gerçekten ~2000 olur
    if (cfg.scale) SP_TRAIN.GEN_MAX = Math.max(1, Math.round(cfg.scale / (candidates.length * oppCount)));
    const total = SP_TRAIN.GEN_MAX * candidates.length * oppCount;
    if (replayCount) console.log(`🧑 İNSAN'A KARŞI EĞİTİM: ${replayCount} replay + 1 agresif self · aday başına ${oppCount} maç`);
    else console.log('Replay yok → klasik self-play (ayna + agresif).');
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    const fx = (v, d = 2) => (typeof v === 'number' ? v.toFixed(d) : '-');

    function renderProgress() {
        const pct = Math.round(done / total * 100);
        if (bar) bar.style.width = pct + '%';
        if (txt) {
            txt.style.whiteSpace = 'pre-line'; txt.style.textAlign = 'left'; txt.style.fontSize = '11px';
            const mode = replayCount ? `🧑 İnsana karşı (${replayCount} replay)` : 'Self-Play';
            const head = `🧠 ${mode} · %${pct} · Nesil ${gen + 1}/${SP_TRAIN.GEN_MAX} · ${done}/${total} maç · gelişen ${gensImproved}`;
            txt.textContent = head + '\n— gelişim süreci —\n' + genLog.slice(-16).join('\n');
        }
    }

    function finish() {
        const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
        try { localStorage.setItem(GENOME_KEY, JSON.stringify(aiGenome)); } catch (e) {}
        const g = aiGenome.tacticGenes || {};
        const winRate = total ? Math.round(redWins / total * 100) : 0;
        const avgTrade = total ? Math.round((sumBlueLost - sumRedLost) / total) : 0;
        const humanRate = replayMatches ? Math.round(replayWins / replayMatches * 100) : null;
        const report =
            `🧠 ${replayCount ? 'İNSANA KARŞI EĞİTİM' : 'SELF-PLAY'} TAMAMLANDI · ${Math.round((t1 - t0) / 1000)} sn · ${total} maç · ${SP_TRAIN.GEN_MAX} nesil\n` +
            (humanRate !== null ? `🧑 İNSANI YENME ORANI: %${humanRate} (${replayWins}/${replayMatches} replay maçı)\n` : '') +
            `Aday kazanma: %${winRate} (${redWins}G/${blueWins}M/${draws}B) · gelişen nesil ${gensImproved} · en iyi fit ${Math.round(bestGenFit)}\n` +
            `Ort. değer takası (lehte +): ${avgTrade}\n` +
            `Genler → sald ${fx(g.vanguardAggression)} · kanat ${fx(g.flankRatio)} · odak ${fx(g.focusFire)} · bütünlük ${fx(g.cohesion)} · zırh/destek ${fx(g.targetArmorPriority)}/${fx(g.targetSupportPriority)}\n` +
            `📥 brain.js indirildi → js/brain.js'e koy → bana "indirdim" de.\n` +
            `— gelişim süreci —\n` + genLog.join('\n');
        try { spExportBrain(true); } catch (e) {}
        console.log(report);
        if (txt) { txt.style.whiteSpace = 'pre-line'; txt.style.textAlign = 'left'; txt.style.fontSize = '11px'; txt.textContent = report; }
        if (bar) bar.style.width = '100%';
        spTraining = false;
        setTimeout(() => { if (screen) screen.classList.add('hidden'); }, 45000);
    }

    // Tek maç + nesil sonu işleme; eğitim bittiyse true döner
    function oneMatch() {
        const opp = opponents[si];
        let r;
        if (opp.kind === 'replay') {
            // Mavi = İNSAN kaydı. Aday (kırmızı) seni yenmeye çalışır.
            r = spRunMatch(candidates[ci], null, null, SP_TRAIN.MATCH_MAX_TICKS, opp.replay);
        } else {
            const oppGenome = (opp.kind === 'aggressive') ? spAggressiveGenome(champion)
                : (opp.kind === 'turtle') ? spTurtleGenome(champion)
                : champion;
            r = spRunMatch(candidates[ci], oppGenome, opp.army, SP_TRAIN.MATCH_MAX_TICKS);
        }
        let f = (r.blueValueLost - SP_LOSS_AVERSION * r.redValueLost) * SP_NET_SCALE;   // kuvvet ekonomisi (baskın)
        f += ((r.redVp || 0) - (r.blueVp || 0)) * SP_VP_WEIGHT;                         // FAZ 1: bölge puanı farkı
        if (r.winner === 'red') { f += 500; redWins++; genRedWins++; }
        else if (r.winner === 'blue') { f -= 380; blueWins++; }
        else { draws++; }
        if (r.decisive && r.winner === 'red') f += 120;
        f += spEngagementShaping(r);
        if (opp.kind === 'replay') {                      // insana karşı performans takibi
            replayMatches++; genReplayMatches++;
            fitHuman[ci] += f;                            // asıl hedef: insanı yenmek
            if (r.winner === 'red') { replayWins++; genReplayWins++; }
        } else if (opp.kind === 'aggressive' || opp.kind === 'turtle') {
            fitHuman[ci] += f;                            // agresif baskıya DAYAN + turtle'ı YEN → asıl hedefler
        }
        sumRedLost += r.redValueLost; sumBlueLost += r.blueValueLost;
        fit[ci] += f; done++; si++; genMatches++;
        if (si >= oppCount) { si = 0; ci++; }

        if (ci >= candidates.length) {
            // Nesil bitti → en iyi aday (0 = elit/şampiyon kopyası → gerileme yok)
            // SEÇİM: önce insana karşı fitness (asıl hedef), eşitlikte toplam fitness.
            // (Replay yoksa fitHuman hep 0 → otomatik toplam fitness'a düşer = eski davranış.)
            const better = (a, b) => fitHuman[a] > fitHuman[b] || (fitHuman[a] === fitHuman[b] && fit[a] > fit[b]);
            let bi = 0;
            for (let k = 1; k < candidates.length; k++) if (better(k, bi)) bi = k;
            if (fit[bi] > bestGenFit) bestGenFit = fit[bi];
            const improved = (bi !== 0 && better(bi, 0));
            if (improved) { champion = cloneGenome(candidates[bi]); stagnation = 0; gensImproved++; }
            else stagnation++;
            aiGenome = cloneGenome(champion);
            try { localStorage.setItem(GENOME_KEY, JSON.stringify(aiGenome)); } catch (e) {}
            const gwr = genMatches ? Math.round(genRedWins / genMatches * 100) : 0;
            const ghr = genReplayMatches ? Math.round(genReplayWins / genReplayMatches * 100) : null;
            const cg = aiGenome.tacticGenes || {};
            const humanPart = (ghr !== null) ? ` · 🧑insana %${ghr}` : '';
            genLog.push(`N${gen + 1}: fit ${Math.round(fit[bi])} ${improved ? '↑gelişti' : '— aynı'} · kaz %${gwr}${humanPart} · sald ${fx(cg.vanguardAggression)} · odak ${fx(cg.focusFire)} · kanat ${fx(cg.flankRatio)}`);
            gen++; genRedWins = 0; genMatches = 0; genReplayWins = 0; genReplayMatches = 0;
            if (gen >= SP_TRAIN.GEN_MAX) return true;
            opponents = spBuildOpponents(replays);   // agresif/ayna ordularını tazele (replay'ler sabit)
            candidates = spBuildPopulation(champion, stagnation);
            fit = new Array(candidates.length).fill(0);
            fitHuman = new Array(candidates.length).fill(0);
            ci = 0; si = 0;
        }
        return false;
    }

    function frame() {
        const batch = Math.max(1, SP_TRAIN.BATCH || 1);   // batch: arka planda da hızlı ilerlesin
        for (let b = 0; b < batch; b++) {
            if (oneMatch()) { renderProgress(); finish(); return; }
        }
        renderProgress();
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// ── Eğitim modu seçim menüsü (buton → pencere) ──
function spShowTrainMenu() {
    if (spTraining) { console.warn('Eğitim zaten sürüyor.'); return; }
    const old = document.getElementById('sp-train-menu');
    if (old) old.remove();
    const repCount = (typeof replayLoadAll === 'function') ? replayLoadAll().length : 0;

    if (!document.getElementById('sp-train-menu-style')) {
        const style = document.createElement('style');
        style.id = 'sp-train-menu-style';
        style.textContent =
            '#sp-train-menu{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;}' +
            '#sp-train-menu .box{background:#14181f;border:2px solid #4cff7c;border-radius:14px;padding:24px 26px;max-width:460px;width:90%;box-shadow:0 0 30px rgba(76,255,124,0.25);font-family:sans-serif;}' +
            '#sp-train-menu h2{color:#4cff7c;margin:0 0 4px;font-size:18px;}' +
            '#sp-train-menu p{color:#9aa;margin:0 0 16px;font-size:12px;}' +
            '#sp-train-menu .sp-menu-btn{display:block;width:100%;text-align:left;margin:8px 0;padding:12px 14px;background:#1d2530;color:#fff;border:1.5px solid #3a6;border-radius:9px;cursor:pointer;font-size:13px;font-weight:bold;}' +
            '#sp-train-menu .sp-menu-btn span{display:block;font-weight:normal;color:#9ab;font-size:11px;margin-top:3px;}' +
            '#sp-train-menu .sp-menu-btn:hover{background:#26303d;}' +
            '#sp-train-menu .cancel{border-color:#a33;color:#f88;}';
        document.head.appendChild(style);
    }

    const modal = document.createElement('div');
    modal.id = 'sp-train-menu';
    modal.innerHTML =
        '<div class="box">' +
        '<h2>🧠 Eğitim Modu Seç</h2>' +
        '<p>Kayıtlı insan replay\'i: <b style="color:#fff;">' + repCount + '</b></p>' +
        '<button class="sp-menu-btn" data-mode="aivsinsan">🧑 AI vs İnsan — ~2000 maç<br><span>Son 10 kaydına karşı, SENİ yenmeye odaklı. (önerilen)</span></button>' +
        '<button class="sp-menu-btn" data-mode="aivsai">🤖 AI vs AI — 288 maç<br><span>Hızlı klasik self-play (insan kaydı kullanmaz).</span></button>' +
        '<button class="sp-menu-btn" data-mode="gece">🌙 Gece Eğitimi — 20.000 maç<br><span>En güçlü. İnsan kaydın varsa SANA karşı. (çok uzun sürer)</span></button>' +
        '<button class="sp-menu-btn cancel" data-mode="cancel">İptal</button>' +
        '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) { modal.remove(); return; }      // dışına tıkla = kapat
        const b = e.target.closest('.sp-menu-btn');
        if (!b) return;
        const mode = b.dataset.mode;
        modal.remove();
        if (mode === 'cancel') return;
        if (phase !== PHASE.DEPLOY) { alert('Eğitim sadece BİRLİK YERLEŞTİRME ekranında başlatılabilir.'); return; }
        if (mode === 'aivsinsan')  spStartTraining({ scale: 2000, batch: 8, useReplays: true });
        else if (mode === 'aivsai') spStartTraining({ scale: 288, batch: 1, useReplays: false });
        else if (mode === 'gece')   spStartTraining({ scale: 20000, batch: 16, useReplays: true });
    });
}

// Train butonunu menüye bağla (AI.js'in eski handler'ını klonlayarak kaldır)
(function spRebindTrainButton() {
    const btn = document.getElementById('train-ai-btn');
    if (!btn) return;
    const fresh = btn.cloneNode(true);
    btn.replaceWith(fresh);
    fresh.textContent = '🧠 AI Eğit';
    fresh.addEventListener('click', spShowTrainMenu);
})();

// ── Eğitilmiş beyni brain.js dosyası formatında dışa aktar ──
// Konsolda spExportBrain() çağır → içerik panoya kopyalanır; js/brain.js'in
// TAMAMININ yerine yapıştır, kaydet, git push et. Beyin artık repoda kalıcı.
function spExportBrain(download = true) {
    const header = '// EĞİTİLMİŞ BEYİN (commit\'lenebilir genom). Güncellemek için: spExportBrain()\n';
    const content = header + 'const TRAINED_BRAIN = ' + JSON.stringify(aiGenome) + ';\n';
    try {
        if (typeof copy === 'function') copy(content);          // DevTools: panoya kopyala
        else if (navigator.clipboard) navigator.clipboard.writeText(content);
    } catch (e) {}
    if (download) {
        try {
            const blob = new Blob([content], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'brain.js'; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {}
    }
    console.log('=== js/brain.js içeriği (panoya kopyalandı + indirildi) ===');
    console.log(content);
    return content;
}

// ── Konsoldan hızlı doğrulama testi ──
function spTestMatch() {
    const g = aiGenome;
    console.log('Self-play test maçı başlıyor (redGenome vs blueGenome = mevcut genom)...');
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    const r = spRunMatch(g, g);
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    console.log('Sonuç:', r, `(${Math.round(t1 - t0)} ms)`);
    return r;
}

// Step 2 doğrulama: mevcut beyin (kırmızı) kayıtlı bir replay'e (mavi=insan) karşı.
// index verilmezse en son kayıt. Konsola: spTestReplayMatch()
function spTestReplayMatch(index) {
    const lib = (typeof replayLoadAll === 'function') ? replayLoadAll() : [];
    if (!lib.length) { console.warn('Kayıtlı replay yok. Önce bir maç oyna.'); return null; }
    const rep = lib[(index === undefined) ? lib.length - 1 : index];
    console.log(`Replay maçı: beyin vs insan kaydı (#${(index === undefined) ? lib.length - 1 : index}) · ${rep.unitCount} birim · ${rep.commandCount} emir`);
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    const r = spRunMatch(aiGenome, null, null, SP_TRAIN.MATCH_MAX_TICKS, rep);
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    const verdict = r.winner === 'red' ? '🤖 BEYİN KAZANDI' : (r.winner === 'blue' ? '🧑 İNSAN KAYDI KAZANDI' : '🤝 berabere');
    console.log(`Sonuç: ${verdict} · kırmızı kayıp ${Math.round(r.redValueLost)} / mavi kayıp ${Math.round(r.blueValueLost)} · temas ${r.contactTicks} tick · ${Math.round(t1 - t0)} ms`);
    console.log(r);
    return r;
}
