// ═══════════════════════════════════════════════════════════════
//  HEADLESS SELF-PLAY ARENASI
//  Canlı oyunla AYNI motoru kullanır: gerçek Unit.update + gerçek
//  LayeredAIController (iki taraf için) + gerçek calculateUnitDamage.
//  Amaç: eğitim, oyunu GERÇEKTEN oynayan beyni eğitsin (tek doğruluk kaynağı).
// ═══════════════════════════════════════════════════════════════

const SP_BUDGET = 1500;
const SP_STEP = 64;          // her tick'te ilerleyen sim-ms (≈ 60fps × GAME_SPEED)
let spNextSeed = 0x12345678;  // FAZ 0: seed verilmeyen maçlar için otomatik-ilerleyen tohum (deterministik çeşitlilik)
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
            const rx = WORLD_W * 0.5 + (col - 2.5) * 150 + (srand() * 50 - 25);
            const ry = isRed
                ? 200 + row * 110 + (srand() * 40 - 20)
                : WORLD_H - 220 - row * 110 + (srand() * 40 - 20);
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
        const type = srandInt(9);
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

// ═══ FAZ 2 — TEMİZ SNAPSHOT/RESTORE (SIM tek-noktadan) ═══════════════════════
// SelfPlay'in elle-bakımlı snap listesinin yerini alır → "bir alanı yedeklemeyi
// unuttum" bug'ı (panel'in yakaladığı controlPoints hatası) yapısal olarak biter.
// Maç-içi MUTASYONA uğrayan TÜM state burada: sim (units/trenches/controlPoints/
// vpScore/vpWinner/rng) + sınır-skalerleri (phase/money/kills) + render-bayrak +
// render-dizi uzunlukları (eğitim kalıntısı temizliği). Faz 5'te JSON-serialize
// (Worker'a state geçişi) buradan türetilecek.
function snapshotSIM() {
    return {
        phase, aiGenome, aiFocusTarget, playerMeta,
        simRngState: SIM.rng.state, headless: SIM.headless,
        playerMoney: player.money, enemyMoney: enemy.money,
        playerKills: player.kills, enemyKills: enemy.kills,
        unitsArr: units.slice(), trenchesArr: trenches.slice(),
        decalsLen: decals.length, cratersLen: craters.length, particlesLen: particles.length,
        btStarted: typeof battleTelemetry !== 'undefined' ? battleTelemetry.started : false,
        cpArr: SIM.controlPoints, vpScoreObj: SIM.vpScore, vpWinnerVal: SIM.vpWinner
    };
}
function restoreSIM(s) {
    units.length = 0; for (const u of s.unitsArr) units.push(u);
    trenches.length = 0; for (const f of s.trenchesArr) trenches.push(f);
    decals.length = s.decalsLen; craters.length = s.cratersLen; particles.length = s.particlesLen; // eğitim kalıntısı temizliği
    phase = s.phase; aiGenome = s.aiGenome; aiFocusTarget = s.aiFocusTarget; playerMeta = s.playerMeta;
    player.money = s.playerMoney; enemy.money = s.enemyMoney;
    player.kills = s.playerKills; enemy.kills = s.enemyKills;
    if (typeof battleTelemetry !== 'undefined') battleTelemetry.started = s.btStarted;
    SIM.controlPoints = s.cpArr; SIM.vpScore = s.vpScoreObj; SIM.vpWinner = s.vpWinnerVal;
    SIM.rng.state = s.simRngState; SIM.headless = s.headless;
}

// Tek bir headless maç çalıştırır. Kırmızı = redGenome (canlı AI gibi mavi'yi
// sayar), Mavi = blueGenome (kendi beynini kullanır, verilen kompozisyonla).
// Geri dönüş: { winner, redValueLost, blueValueLost, ticks, decisive }
function spRunMatch(redGenome, blueGenome, blueCounts = null, maxTicks = SP_MAX_TICKS, blueReplay = null, matchSeed = null) {
    // ── Global durumu yedekle (canlı oyunu bozmamak için) — FAZ 2: tek-noktadan ──
    const snap = snapshotSIM();
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
        SIM.headless = true;                      // FAZ 1f: rollout — render-only VFX (particle/spark/tracer) hesaplanmaz

        // FAZ 0 (Determinizm): her maç kendi seed'iyle tekrarlanabilir.
        // matchSeed verilirse aynı seed → BİT-AYNI maç (altın test); verilmezse otomatik-ilerleyen seed (eğitimde çeşitlilik, baştan tekrarlanabilir).
        resetSimRng(matchSeed != null ? matchSeed : (spNextSeed = (spNextSeed * 1664525 + 1013904223) >>> 0));

        if (blueReplay) {
            spDeployReplay(blueReplay);           // mavi = insan kaydı (tam diziliş)
        } else {
            spDeployArmy(blueCounts || spRandomArmy(), false); // mavi orduyu alt yarıya yerleştir
        }

        aiGenome = redGenome;                     // kırmızı, redGenome ile mavi'yi sayarak konuşlanır
        aiDeploy();
        if (typeof initControlPoints === 'function') initControlPoints();   // FAZ 1: eğitim arenası da bölge simüle etsin
        if (typeof commanderReset === 'function') commanderReset();          // FAZ 4: komutan histerezi state'i sıfırla

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

            // FAZ 1g: canlı gameLoop ile AYNI birleşik tick (stepSim) — render/VFX yok (spawnDeathVfx=false)
            stepSim(now, SP_STEP / 1000, (n) => {
                aiGenome = redGenome; redCtrl.update(n);              // kırmızı beyin (genom-takas hilesi)
                if (blueReplay) spApplyReplayCommands(blueReplay, replayState, n);
                else { aiGenome = blueGenome; blueCtrl.update(n); }  // mavi: replay veya kendi beyni
            }, false);

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
            if (typeof SIM.vpWinner !== 'undefined' && SIM.vpWinner !== null) break;   // FAZ 1: bölge puanı eşiği = maç biter
            if (ticks - lastActivityTick > 400) break; // 400 tick (~25 sn) hareketsizlik → kilitlenme
        }

        const redVal = spSideUnits(true).reduce((s, u) => s + STATS[u.type].cost, 0);
        const blueVal = spSideUnits(false).reduce((s, u) => s + STATS[u.type].cost, 0);
        const rVp = (typeof SIM.vpScore !== 'undefined') ? SIM.vpScore.red : 0;
        const bVp = (typeof SIM.vpScore !== 'undefined') ? SIM.vpScore.blue : 0;
        const vpW = (typeof SIM.vpWinner !== 'undefined') ? SIM.vpWinner : null;
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
        // ── Global durumu geri yükle (FAZ 2: tek-noktadan, eksik-alan bug'ı imkansız) ──
        restoreSIM(snap);
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
        '<button class="sp-menu-btn" data-mode="nn-fast" style="border-color:#6af;">🧠 Sinir-Ağı (NN) — Kısa (15 nesil)<br><span>TAM kalite: gerçek harita + çeşitli ordular + uzun maç. UI donmaz, ara-kayıtlı. Bu PC yavaş / 4060 hızlı.</span></button>' +
        '<button class="sp-menu-btn" data-mode="nn-med" style="border-color:#6af;">🧠 Sinir-Ağı (NN) — Orta (40 nesil)<br><span>Daha güçlü (önerilen). Saatlerce sürebilir (kapatma); kaldığı yer kaybolmaz.</span></button>' +
        '<button class="sp-menu-btn" data-mode="nn-long" style="border-color:#6af;">🌙 Sinir-Ağı (NN) — Uzun/Gece (120 nesil)<br><span>EN İYİ beyin. Açık bırak. Her 5 nesilde otomatik kaydeder.</span></button>' +
        '<hr style="border-color:#2a3340;margin:10px 0;">' +
        '<button class="sp-menu-btn" data-mode="aivsai">⚡ Komutan (genom) — Hızlı (20 epoch)<br><span>Eski sistem: kural-genom evrimi. ~1-2 dk.</span></button>' +
        '<button class="sp-menu-btn" data-mode="aivsinsan">🧠 Komutan (genom) — Orta (40 epoch)<br><span>Daha güçlü genom.</span></button>' +
        '<button class="sp-menu-btn" data-mode="gece">🌙 Komutan (genom) — Uzun (80 epoch)<br><span>En güçlü genom.</span></button>' +
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
        // KOMUTAN eğitimi (canlı AI = Commander). Eski spStartTraining (LayeredAI) artık devre dışı — canlı oyun komutanı kullanıyor.
        if (mode === 'nn-fast')        spMenuTrainNN(15, 6, 900);   // TAM kalite (gerçek harita, çeşitli ordu, uzun maç)
        else if (mode === 'nn-med')    spMenuTrainNN(40, 8, 900);
        else if (mode === 'nn-long')   spMenuTrainNN(120, 12, 900);
        else if (mode === 'aivsai')    spMenuTrainCommander(20);
        else if (mode === 'aivsinsan') spMenuTrainCommander(40);
        else if (mode === 'gece')      spMenuTrainCommander(80);
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

// ── FAZ 0 ALTIN TEST: aynı seed → BİT-AYNI maç (determinizm doğrulaması) ──
// Konsoldan: spGoldenTest()  → ✅ ise sim deterministik (fork + eğitim-ödülü güvenli).
// ❌ ise bir yerde seedlenmemiş Math.random / duvar-saati / kaymış iterasyon var.
function spGoldenTest(seed = 1234567, runs = 3) {
    const g = aiGenome;
    const counts = spRandomArmy();   // ordu kompozisyonu sabit; deploy jitter seed'e bağlı olacak
    const sig = r => `kayıp R/B=${r.redValueLost}/${r.blueValueLost} | tick=${r.ticks} | VP R/B=${r.redVp}/${r.blueVp} | kazanan=${r.winner} | kesin=${r.decisive}`;
    console.log(`Altın test: ${runs} koşu, seed=${seed}, ordu=[${counts.join(',')}]`);
    let first = null, ok = true;
    for (let i = 0; i < runs; i++) {
        const r = spRunMatch(g, g, counts.slice(), SP_MAX_TICKS, null, seed);
        const s = sig(r);
        console.log(`  koşu ${i + 1}: ${s}`);
        if (first === null) first = s; else if (s !== first) ok = false;
    }
    console.log(ok
        ? `✅ ALTIN TEST GEÇTİ — sim deterministik (aynı seed → bit-aynı sonuç). Fork/eğitim güvenli.`
        : `❌ ALTIN TEST KALDI — determinizm sızıntısı! (seedlenmemiş random / duvar-saati / kaymış iterasyon ara).`);
    return ok;
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

// ═══════════════════════════════════════════════════════════════════════════
//  FAZ 4b — KOMUTAN SELF-PLAY EĞİTİMİ
//  ----------------------------------------------------------------------------
//  commanderGenome'un 12 karar-parametresini genetik (mutate-and-keep-best) ile
//  evirir. Maç: İKİ TARAF DA temiz komutan (genome-swap), GERÇEK stepSim fiziği.
//  Ödül: kuvvet ekonomisi (blueLost − k×redLost) + VP farkı, RED açısından.
//  İnsan-gibi kalır: yapı sabit (sektör-makro, süper-APM yok), sadece sayılar evrilir.
//  Konsoldan: spTrainCommander()  → bitince commanderGenome (canlı) güncellenir.
// ═══════════════════════════════════════════════════════════════════════════
const CMDR_TRAIN_TICKS = 1200;   // eğitim maçı üst sınırı (≈77 sim-sn, hız için kısa)

// Tek komutan maçı: redGenes (kuzey) vs blueGenes (güney). RED açısından net döner.
// Senaryo orduları (komutan eğitimi: belirli kompozisyonlara karşı taktik öğren — konsey egitimTasarim)
function spAllArtyArmy()   { const c = new Array(9).fill(0); c[T.ENGINEER] = 1; c[T.RECON] = 1; c[T.ARTILLERY] = 8; return c; }      // "tamamen topçu"
function spArtyHunterArmy() { const c = new Array(9).fill(0); c[T.ENGINEER] = 1; c[T.RECON] = 4; c[T.MECH_INFANTRY] = 8; c[T.INFANTRY] = 4; return c; }  // all-arty counter

function spRunCommanderMatch(redGenes, blueGenes, maxTicks = CMDR_TRAIN_TICKS, matchSeed = null, redArmy = null, blueArmy = null, blueReplay = null) {
    const savedGenome = commanderGenome;       // canlı genomu koru
    const snap = snapshotSIM();
    try {
        units.length = 0; trenches.length = 0;
        player.money = SP_BUDGET; enemy.money = SP_BUDGET; player.kills = 0; enemy.kills = 0;
        phase = PHASE.BATTLE; playerMeta = {}; SIM.headless = true;
        resetSimRng(matchSeed != null ? matchSeed : (spNextSeed = (spNextSeed * 1664525 + 1013904223) >>> 0));
        if (blueReplay) { spDeployReplay(blueReplay); aiDeploy(); }   // mavi=İNSAN kaydı, kırmızı=AI counter-deploy (canlı akış)
        else { spDeployArmy(blueArmy || spRandomArmy(), false); spDeployArmy(redArmy || spRandomArmy(), true); }
        if (typeof initControlPoints === 'function') initControlPoints();
        commanderReset();

        const initRed  = spSideUnits(true).reduce((s, u) => s + STATS[u.type].cost, 0);
        const initBlue = spSideUnits(false).reduce((s, u) => s + STATS[u.type].cost, 0);

        const replayState = { idx: 0 };
        let now = 0;
        for (let t = 0; t < maxTicks; t++) {
            now += SP_STEP;
            stepSim(now, SP_STEP / 1000, (n) => {
                commanderGenome = redGenes; commanderDrive(true, n);                // kuzey = AI komutan
                if (blueReplay) spApplyReplayCommands(blueReplay, replayState, n);   // güney = İNSAN kaydı (gerçek oyun)
                else { commanderGenome = blueGenes; commanderDrive(false, n); }      // güney = AI komutan
            }, false);
            if (SIM.vpWinner !== null) break;
            if (spSideUnits(true).length === 0 || spSideUnits(false).length === 0) break;
        }

        const redVal  = spSideUnits(true).reduce((s, u) => s + STATS[u.type].cost, 0);
        const blueVal = spSideUnits(false).reduce((s, u) => s + STATS[u.type].cost, 0);
        const redLost = initRed - redVal, blueLost = initBlue - blueVal;
        let net = (blueLost - SP_LOSS_AVERSION * redLost) * SP_NET_SCALE;   // kuvvet ekonomisi (baskın)
        net += ((SIM.vpScore.red || 0) - (SIM.vpScore.blue || 0)) * SP_VP_WEIGHT;   // bölge
        return { net, redLost, blueLost, redVp: SIM.vpScore.red, blueVp: SIM.vpScore.blue };
    } finally {
        commanderGenome = savedGenome;          // canlı genomu geri yükle
        restoreSIM(snap);
    }
}

// Bir genomu, RAKİP(ler)e karşı N maç ortalamasıyla değerlendir. opponents tek genom veya dizi olabilir.
// Dizi → her rakibe karşı matchesEach maç (ör. [champion, turtle] = mirror + anti-savunma).
function spEvalCommander(genes, opponents, matchesEach = 2, seedBase = 0, replays = null) {
    const opps = Array.isArray(opponents) ? opponents : [opponents];
    let sum = 0, cnt = 0;
    for (let oi = 0; oi < opps.length; oi++)
        for (let i = 0; i < matchesEach; i++) {
            sum += spRunCommanderMatch(genes, opps[oi], CMDR_TRAIN_TICKS, seedBase + (oi * 31 + i) * 7919).net;
            cnt++;
        }
    // SENARYO: aday (RECON+MECH avcı ordusu) vs ALL-ARTY rakip → topçu-RUSH genlerini eğit/ölç (konsey egitimTasarim)
    sum += spRunCommanderMatch(genes, opps[0], CMDR_TRAIN_TICKS, seedBase + 99991, spArtyHunterArmy(), spAllArtyArmy()).net;
    cnt++;
    // İNSAN REPLAY'LERİNE KARŞI (varsa): AI senin GERÇEK oyunlarını yenmeyi öğrenir — asıl insan-yen sinyali (2× ağırlık)
    if (replays && replays.length) {
        const nR = Math.min(2, replays.length);
        for (let i = 0; i < nR; i++) {
            sum += spRunCommanderMatch(genes, null, CMDR_TRAIN_TICKS, seedBase + 70000 + i * 333, null, null, replays[replays.length - 1 - i]).net * 2;
            cnt += 2;
        }
    }
    return cnt ? sum / cnt : 0;
}

// Gen mutasyonu: her parametreyi sınırları içinde rastgele oynat (evrim gürültüsü → Math.random).
function mutateCommanderGenes(base, scale) {
    const g = Object.assign({}, base);
    for (const k in COMMANDER_GENE_LIMITS) {
        const lim = COMMANDER_GENE_LIMITS[k], span = lim[1] - lim[0];
        let v = g[k] + (Math.random() * 2 - 1) * span * scale;
        g[k] = Math.max(lim[0], Math.min(lim[1], v));
    }
    return g;
}

// ── PFSP-LİTE LİG (konsey Faz B): geçmiş-şampiyon arşivi (hall of fame). Aday yalnız mevcut
// şampiyona değil, ÇEŞİTLİ geçmiş şampiyonlara karşı eğitilir → tek-şampiyon overfit'i kırılır,
// genom sağlamlaşır. localStorage'da kalıcı; seanslar arası BÜYÜR (sürekli güçlenen rakip havuzu).
let cmdrHallOfFame = [];
try { const _h = localStorage.getItem('cmdrHall'); if (_h) cmdrHallOfFame = JSON.parse(_h) || []; } catch (_) {}
function cmdrGeneDist(a, b) {
    let d = 0; for (const k in COMMANDER_GENE_LIMITS) { const lim = COMMANDER_GENE_LIMITS[k]; d += Math.abs((a[k] || 0) - (b[k] || 0)) / ((lim[1] - lim[0]) || 1); }
    return d;
}
function cmdrArchive(genome) {
    for (const g of cmdrHallOfFame) if (cmdrGeneDist(g, genome) < 1.5) return;   // çok benzer → ekleme (çeşitlilik koru)
    cmdrHallOfFame.push(Object.assign({}, genome));
    if (cmdrHallOfFame.length > 12) cmdrHallOfFame.shift();                       // tavan
    try { localStorage.setItem('cmdrHall', JSON.stringify(cmdrHallOfFame)); } catch (_) {}
}
function cmdrClearHall() { cmdrHallOfFame = []; try { localStorage.removeItem('cmdrHall'); } catch (_) {} return 'Hall of Fame temizlendi.'; }

// EXPLOITER (konsey Faz B): champion'ı EN ÇOK YENEN genomu ara (yalnız champion'a karşı) → lige ekle.
// Böylece champion KENDİ counter-stratejisini de yenmeyi öğrenir (zayıflık-avı = exploit-dirençli, sağlam).
function cmdrFindExploiter(champion, tries, seed) {
    let best = null, bestFit = -Infinity;
    for (let i = 0; i < tries; i++) {
        const cand = mutateCommanderGenes(champion, 0.20 + 0.35 * Math.random());
        const fit = spEvalCommander(cand, [champion], 2, seed + i * 311);
        if (fit > bestFit) { bestFit = fit; best = cand; }
    }
    return best;
}

// ── ANA EĞİTİM: champion'ı mutasyonlarla yen, en iyiyi al. Konsoldan: spTrainCommander() ──
function spTrainCommander(epochs = 30, pop = 10, matches = 2, onDone, onProgress) {
    let champion = Object.assign({}, commanderGenome);
    // İNSAN REPLAY'LERİ (varsa): eğitim senin GERÇEK oyunlarını yenmeyi de hedefler (imitasyon-adjacent, insan-yen)
    const cmdrReplays = (typeof replayLoadAll === 'function') ? (replayLoadAll() || []) : [];
    // LİG RAKİPLERİ: mirror + TURTLE + AGGRO + 2 rastgele GEÇMİŞ-ŞAMPİYON (hall of fame) + all-arty senaryo.
    // → genel + anti-savunma + anti-baskı + ÇEŞİTLİ geçmiş stratejilere karşı sağlam (overfit kırılır).
    const opponents = () => {
        const o = [champion, TURTLE_COMMANDER_GENES, AGGRO_COMMANDER_GENES];
        for (let i = 0; i < Math.min(2, cmdrHallOfFame.length); i++) o.push(cmdrHallOfFame[Math.floor(Math.random() * cmdrHallOfFame.length)]);
        return o;
    };
    let championFit = spEvalCommander(champion, opponents(), matches, 1009, cmdrReplays);
    let e = 0;
    console.log(`🧠 Komutan eğitimi: ${epochs} epoch × ${pop} aday · lig(${cmdrHallOfFame.length} şampiyon) + ${cmdrReplays.length} insan-replay. Başlangıç fit≈${championFit.toFixed(0)}.`);
    function epochStep() {
        const opps = opponents();
        // ADİL KIYAS (gerçek-eğitim düzeltmesi): bu epoch'un SABİT senaryoları — şampiyon VE tüm adaylar
        // AYNI ordular/seed'lerde ölçülür. Eskiden her aday FARKLI seed alıyordu → şanslı aday seçiliyordu
        // (gürültü, etkisiz eğitim). Şampiyonu da bu senaryolarda yeniden ölç (taze, adil baz).
        const epochSeed = 3000 + e * 9173;
        let bestG = champion, bestFit = spEvalCommander(champion, opps, matches, epochSeed, cmdrReplays);
        for (let k = 0; k < pop; k++) {
            const cand = mutateCommanderGenes(champion, 0.08 + 0.14 * Math.random());
            const fit = spEvalCommander(cand, opps, matches, epochSeed, cmdrReplays);   // AYNI senaryo → GENUINE seçim
            if (fit > bestFit) { bestFit = fit; bestG = cand; }
        }
        champion = bestG; championFit = bestFit;
        e++;
        console.log(`  epoch ${e}/${epochs}: en iyi fit=${championFit.toFixed(0)}`);
        if (onProgress) onProgress(e, epochs, championFit);
        if (e % 8 === 0) cmdrArchive(champion);   // periyodik arşivle → lig havuzu büyür (PFSP)
        if (e % 12 === 0 && e > 0) { const ex = cmdrFindExploiter(champion, 5, 60000 + e * 7); if (ex) cmdrArchive(ex); }   // exploiter: zayıflık-avcısını lige ekle
        if (e < epochs) { setTimeout(epochStep, 0); }   // tarayıcıyı kilitleme (epoch'lar arası nefes)
        else {
            commanderGenome = champion;                 // CANLI komutan artık evrilmiş genomu kullanır
            cmdrArchive(champion);                       // final şampiyonu lige ekle
            try { localStorage.setItem('cmdrGenome', JSON.stringify(champion)); } catch (_) {}   // KALICILIK
            console.log(`✅ Eğitim bitti. commanderGenome CANLI + kalıcı. Lig havuzu: ${cmdrHallOfFame.length} şampiyon.`);
            console.log(JSON.stringify(champion, null, 2));
            if (onDone) onDone(champion);
        }
    }
    setTimeout(epochStep, 0);
    return 'Eğitim başladı — konsolu izle (epoch fit artmalı). Bitince commanderGenome güncellenir.';
}

// ═══════════════════════════════════════════════════════════════════════════
//  SİNİR-AĞI (NN) EĞİTİMİ — TARAYICI İÇİ (butondan; konsola/terminale gerek yok)
//  NeuralBrain ağırlıklarını self-play ES ile evrimleştirir: RED=NN vs BLUE=kural.
//  Fitness = spRunCommanderMatch().net (kuvvet-ekonomisi+VP, RED açısından). Async (setTimeout
//  ile nesil-arası nefes → UI donmaz). Bitince NN CANLI + localStorage'a kalıcı.
// ═══════════════════════════════════════════════════════════════════════════
function spTrainNNBrain(gens, pop, sizesArg, ticks, onProgress, onDone) {
    if (typeof NeuralBrain === 'undefined' || typeof BrainState === 'undefined') { alert('NN modülleri yüklü değil'); return; }
    // TAM KALİTE (KISMA YOK): oyuncunun GERÇEK haritasında (çizilen grid) + ÇEŞİTLİ ordular (spRandomArmy) +
    // UZUN maçlar (grid'de çözülsün) + her nesil DÖNEN senaryolar (genelleme, ezber değil). Bu PC'de yavaş,
    // 4060'ta hızlı. MAÇ-BAŞI ASYNC (her maç sonra setTimeout) → tek maç 10 dk sürse bile UI KİLİTLENMEZ.
    const sizes = (sizesArg || [BrainState.SCALAR_DIM, 96, 64, 32, 20]).slice();
    sizes[0] = BrainState.SCALAR_DIM; sizes[sizes.length - 1] = 20;
    // HİBRİT (conv ALGI + skaler) varsayılan — kullanıcı seçimi; yoksa skaler-MLP fallback
    const useHybrid = (typeof HybridBrain !== 'undefined');
    const net = useHybrid ? new HybridBrain(HybridBrain.defaultCfg(BrainState.SCALAR_DIM, BrainState.CHANNELS, BrainState.GRID_N)) : new NeuralBrain(sizes);
    const NPAR = net.nParams;
    const saveBrain = () => { net.setWeights(w); try { localStorage.setItem('nnBrain', JSON.stringify(net.toJSON())); } catch (_) { } };
    let w = new Float64Array(NPAR);
    for (let i = 0; i < NPAR; i++) w[i] = (Math.random() - 0.5) * 0.6;   // ±0.3 init → posture çeşitlensin
    let sigma = 0.12;
    const SEEDS_PER = 3;                                // çok-senaryo denoise (3 ordu/maç ortalaması)
    const TTL = ticks || 900;                          // UZUN maç → grid'de su/köprü maneuver sonrası çarpışma çözülsün
    const genome = (typeof commanderGenome !== 'undefined' && commanderGenome) ? commanderGenome : aiGenome;
    const gauss = () => { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

    // SABİT senaryolar: SEÇİM seti (elitist bunlardan seçer) + AYRI SINAV seti (held-out: seçimde KULLANILMAZ,
    // sadece raporlanır). Sınav-fit de yükseliyorsa → genelleme GERÇEK, EZBER DEĞİL. Per-birim politika zaten
    // senaryo-kimliği değil yerel-durum öğrenir; sınav seti bunu görünür-kanıt yapar.
    const SEL_N = 4, VAL_N = 2;
    const FIXED = [];
    for (let s = 0; s < SEL_N + VAL_N; s++) {
        const seed = (7001 + s * 977) >>> 0;
        if (typeof resetSimRng === 'function') resetSimRng(seed);
        FIXED.push({ seed, army: spRandomArmy(1500), val: s >= SEL_N });   // son VAL_N tanesi held-out (sınav)
    }
    let g = 0, baseTr = null, baseVal = null, bestFit = -Infinity, bestVal = -Infinity, ph = 'init';
    let candList = [], results = [], queue = [], qi = 0;
    function startEval(list) { candList = list; results = list.map(() => ({ sel: 0, val: 0 })); queue = []; for (let ci = 0; ci < list.length; ci++) for (let si = 0; si < FIXED.length; si++) queue.push([ci, si]); qi = 0; }
    function nextGen() {
        const cs = [];
        for (let p = 0; p < pop; p++) { const c = new Float64Array(NPAR); for (let i = 0; i < NPAR; i++) c[i] = w[i] + sigma * gauss(); cs.push({ w: c }); }
        startEval(cs); setTimeout(step, 0);
    }
    function step() {
        if (qi < queue.length) {
            const pr = queue[qi++], ci = pr[0], sc = FIXED[pr[1]];
            net.setWeights(candList[ci].w); NN.brain = net; NN.enabled = true; NN.side = true; NN.throttleCycles = 4;   // RED = NN (sık karar)
            const r = spRunCommanderMatch(genome, genome, TTL, sc.seed, sc.army, sc.army).net;
            NN.enabled = false; NN.side = null;
            if (sc.val) results[ci].val += r; else results[ci].sel += r;
            if (onProgress) onProgress((ph === 'init' ? 0 : g) + qi / queue.length, gens, bestFit === -Infinity ? 0 : bestFit, bestVal === -Infinity ? 0 : bestVal);
            setTimeout(step, 0);   // HER MAÇ ARASI NEFES → uzun maç olsa bile UI donmaz
        } else {
            const sel = results.map(r => r.sel / SEL_N), val = results.map(r => r.val / VAL_N);
            if (ph === 'init') {                                  // şampiyonu BİR KEZ ölç → baseline (eğitim + sınav)
                bestFit = sel[0]; bestVal = val[0]; baseTr = sel[0]; baseVal = val[0]; ph = 'gen';
                console.log(`🧠 başlangıç: eğitim-fit=${baseTr.toFixed(0)} | SINAV-fit=${baseVal.toFixed(0)} (${NPAR} param)`);
                nextGen();
            } else {
                let bi = -1, bv = bestFit;                        // SEÇİM yalnız eğitim-fit'ten (sınav held-out)
                for (let ci = 0; ci < sel.length; ci++) if (sel[ci] > bv) { bv = sel[ci]; bi = ci; }
                if (bi >= 0) { w = candList[bi].w; bestFit = sel[bi]; bestVal = val[bi]; sigma = Math.min(0.20, sigma * 1.05); } else sigma *= 0.85;
                g++;
                if (onProgress) onProgress(g, gens, bestFit, bestVal);
                console.log(`  nesil ${g}/${gens}: eğitim=${bestFit.toFixed(0)} SINAV=${bestVal.toFixed(0)}${bi >= 0 ? ' ↑' : ''}`);
                if (g % 5 === 0) saveBrain();   // ARA-KAYIT (kesilirse kaybolmaz)
                if (g < gens) nextGen();
                else {
                    saveBrain(); NN.brain = net; NN.enabled = true; NN.side = null;   // CANLI + kalıcı
                    console.log(`✅ NN eğitimi bitti. eğitim ${baseTr.toFixed(0)}→${bestFit.toFixed(0)} · SINAV ${baseVal.toFixed(0)}→${bestVal.toFixed(0)}.`);
                    if (onDone) onDone({ sizes, fit: bestFit, baseline: baseTr, valFit: bestVal, valBase: baseVal });
                }
            }
        }
    }
    console.log(`🧠 NN eğitimi (TAM kalite, ${SEL_N} seçim + ${VAL_N} SINAV senaryo): ${gens} nesil × ${pop} aday · ${TTL} tick · ${NPAR} param.`);
    startEval([{ w }]);   // önce şampiyon (baseline: eğitim + sınav)
    setTimeout(step, 0);
}

// UI'dan NN eğitimi: progress ekranı + bitince uyarı.
function spMenuTrainNN(gens, pop, ticks) {
    const screen = document.getElementById('ai-training-screen');
    const bar = document.getElementById('train-progress-bar');
    const txt = document.getElementById('train-progress-text');
    if (screen) screen.classList.remove('hidden');
    spTrainNNBrain(gens, pop, null, ticks,
        (e, total, fit, val) => { if (bar) bar.style.width = Math.min(100, Math.round(e / total * 100)) + '%'; if (txt) txt.textContent = `🧠 NN eğitimi: nesil ${Math.floor(e)}/${total} · eğitim ${Math.round(fit)} · SINAV ${Math.round(val)} (ara-kayıtlı)`; },
        (r) => { if (screen) screen.classList.add('hidden'); const genel = r.valFit > r.valBase; alert(`✅ Sinir-ağı eğitimi bitti!\n\nEğitim-fit: ${Math.round(r.baseline)} → ${Math.round(r.fit)}\nSINAV-fit (held-out): ${Math.round(r.valBase)} → ${Math.round(r.valFit)}\n\n${genel ? '✓ SINAV da yükseldi → GERÇEK öğrenme (ezber değil).' : '⚠ Sınav yükselmedi → ezber olabilir, daha çok senaryo/nesil gerek.'}\n\nNN CANLI (reload\'da kalır). Oyna ve gör.`); }
    );
}

// UI'dan KOMUTAN eğitimi: progress ekranını gösterir, bitince kaydeder + uyarır.
function spMenuTrainCommander(epochs) {
    const screen = document.getElementById('ai-training-screen');
    const bar = document.getElementById('train-progress-bar');
    const txt = document.getElementById('train-progress-text');
    if (screen) screen.classList.remove('hidden');
    spTrainCommander(epochs, 10, 2,
        () => {
            if (screen) screen.classList.add('hidden');
            alert('✅ Komutan eğitimi bitti! Yeni beyin CANLI + kalıcı (reload\'da kalır). Oyna ve gör.');
        },
        (e, total, fit) => {
            if (bar) bar.style.width = Math.round(e / total * 100) + '%';
            if (txt) txt.textContent = `🧠 Komutan eğitimi: ${e}/${total} epoch · fit ${Math.round(fit)}`;
        }
    );
}
