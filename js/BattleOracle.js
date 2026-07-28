// ═══════════════════════════════════════════════════════════════════════════
// BattleOracle.js — Faz 1: Karşı-olgusal operasyon değerlendirici + ORACLE TAVAN TESTİ
// ───────────────────────────────────────────────────────────────────────────
// Plan: SAVAS-AI-PLAN-v4-LLM.md §3A. MODEL YOK. Amaç: eğitimden ÖNCE GO/NO-GO.
//   1) Bir karar durumunda TÜM gramer adaylarını (operationGrammarGenerate) rollout et
//      (fork → adayı enjekte et → N tik koş → ödül).
//   2) Gerçekte en iyi sonucu veren = ORACLE. Kod-AI'ın varsayılan seçimi = "chosen".
//   3) regret = oracle_ödülü − chosen_ödülü. Ortalama regret büyükse → gramer+rollout
//      anlamlı fark üretiyor → ML eğitimi GO. ≈0 ise → NO-GO (önce gramer/rollout düzelt).
//
// Enjeksiyon (Explore haritası, seviye B): controller.operationalPlanner.build'i sarmala
//   → adayın kind(intent) + objective(mainSector merkezi) + allocation'ını onurlandır,
//   mevcut taskContractPlanner.build'i yeniden kullan. Fork restore metod-override'ı korur.
// ═══════════════════════════════════════════════════════════════════════════

// Aktif enjeksiyon (null = kod-AI varsayılanı çalışır). Rollout başına set/temizlenir.
let BATTLE_ORACLE_INJECTION = null;   // { controllerId, kind, sector, point:{x,y}, allocation:{main,fixing,flank,reserve} }
const BATTLE_ORACLE_REWARD_WEIGHTS_VERSION = 'oracleReward.v1';

// CANLI SEÇİCİ (Faz 4/5): eğitilmiş model gerçek maçta oynar. KONTROLÖR-BAŞINA model (self-play için).
let BATTLE_SELECTOR_MODELS = {};         // { [controllerId]: model }  — boş = kapalı
let BATTLE_SELECTOR_CACHES = {};         // { [controllerId]: {tick, inj} }  — thrash azalt
// Commitment ufku EĞİTİM rollout ufkuyla eşleşmeli (~12sn). Kısa re-pick thrashing üretir → 240 tik.
let BATTLE_SELECTOR_REPICK_TICKS = 240;
// Model yalnız bu tik penceresinde karar verir (dışında kod-AI sürer). Eğitim dağıtımına (temas fazı) sınırla.
let BATTLE_SELECTOR_MIN_TICK = 0, BATTLE_SELECTOR_MAX_TICK = Infinity;
function battleSelectorSetModel(model, targetId) {
    if (model && targetId) { BATTLE_SELECTOR_MODELS[targetId] = model; BATTLE_SELECTOR_CACHES[targetId] = { tick: -1, inj: null }; }
    else if (!model && targetId) { delete BATTLE_SELECTOR_MODELS[targetId]; delete BATTLE_SELECTOR_CACHES[targetId]; }
    else if (!model && !targetId) { BATTLE_SELECTOR_MODELS = {}; BATTLE_SELECTOR_CACHES = {}; }
}
// CANLI AÇ (tek kontrolör, backward-compat): modeli set et + sarmalayıcıyı tüm kontrolörlere kur.
function battleSelectorEnable(model, targetId) {
    battleSelectorSetModel(model, targetId || 'battle-red-ai');
    if (typeof BATTLE_CONTROLLERS !== 'undefined') for (const c of BATTLE_CONTROLLERS.values()) battleOracleInstallInjection(c);
}
// CANLI AÇ (belirli kontrolör — model-vs-model self-play için: red=modelA, blue=modelB)
function battleSelectorEnableFor(controllerId, model) {
    battleSelectorSetModel(model, controllerId);
    if (typeof BATTLE_CONTROLLERS !== 'undefined') for (const c of BATTLE_CONTROLLERS.values()) battleOracleInstallInjection(c);
}
function battleSelectorDisable() {
    battleSelectorSetModel(null, null);
    if (typeof BATTLE_CONTROLLERS !== 'undefined') for (const c of BATTLE_CONTROLLERS.values()) battleOracleUninstallInjection(c);
}
// Model bir karar durumunda tüm adayları skorlar → en yüksek → enjeksiyon-spec. Cache ile thrash azaltılır.
function battleSelectorPickInjection(controller, observation, situation) {
    const model = BATTLE_SELECTOR_MODELS[controller.id];
    if (!model || typeof selForward !== 'function' ||
        typeof battleStateFeatures !== 'function' || typeof operationGrammarGenerate !== 'function') return null;
    // eğitim-dağıtımı penceresi dışında kod-AI'ya bırak (OOD erken/geç durumlarda model bozuyor)
    if (SIM.tick < BATTLE_SELECTOR_MIN_TICK || SIM.tick > BATTLE_SELECTOR_MAX_TICK) return null;
    // cache: son seçimi REPICK_TICKS boyunca koru (sürekli re-commit momentum kaybettirir)
    const cache = BATTLE_SELECTOR_CACHES[controller.id];
    if (cache && cache.inj && (SIM.tick - cache.tick) < BATTLE_SELECTOR_REPICK_TICKS) return cache.inj;
    const sideRed = controller.side;
    // EĞİTİMLE TUTARLI: aynı context kurucusu (battleOracleGrammarContext = tam-bilgi sektör görünümü).
    // Eğitim verisi de bununla üretildi → train/inference feature dağılımı eşleşir. (Sis-savaşı hizalaması
    // ayrı bir rafinasyon: model partial-info ile eğitilip partial-info ile oynatılabilir — sonraki adım.)
    const ownUnits = SIM.units.filter(u => !u.dead && (!!u.isRed === !!sideRed));
    const ctx = battleOracleGrammarContext(controller, sideRed);
    const candidates = operationGrammarGenerate(ctx);
    if (!candidates.length) return null;
    let minEnemyDist = Infinity;
    const foes = SIM.units.filter(u => !u.dead && (!!u.isRed !== !!sideRed));
    for (const a of ownUnits) for (const b of foes) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < minEnemyDist) minEnemyDist = d; }
    const maxTicks = Math.round(((typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.durationSec) || 240) / BATTLE_TICK_SEC);
    const sf = battleStateFeatures(ctx, { minEnemyDist, tick: SIM.tick, maxTicks, ownCount: ownUnits.length, enemyCount: foes.length });
    let best = null, bestScore = -Infinity;
    for (const cand of candidates) {
        const s = selForward(model, sf.concat(battleCandidateFeatures(cand, ctx))).out;
        if (s > bestScore) { bestScore = s; best = cand; }
    }
    const inj = battleCandidateToInjection(best, controller.id);
    BATTLE_SELECTOR_CACHES[controller.id] = { tick: SIM.tick, inj };
    return inj;
}

// ── Birim değeri: STATS[type].cost, sağ-kalanı hp oranıyla ağırlıklandır ──────
function battleOracleUnitValue(unit) {
    const base = (typeof STATS !== 'undefined' && STATS[unit.type] && STATS[unit.type].cost) || 50;
    return base;
}
function battleOracleForceValue(sideRed) {
    let full = 0, effective = 0, count = 0;
    for (const u of SIM.units) {
        if (u.dead || (!!u.isRed !== !!sideRed)) continue;
        const cost = battleOracleUnitValue(u);
        const hpFrac = Math.max(0, Math.min(1, u.hp / (u.maxHp || u.hp || 1)));
        full += cost; effective += cost * hpFrac; count++;
    }
    return { full, effective, count };
}

// ── Ödül: rollout başındaki baseline'a göre çok bileşenli vektör (§4) + tek skalar ──
function battleOracleBaseline(sideRed) {
    return { own: battleOracleForceValue(sideRed), enemy: battleOracleForceValue(!sideRed), tick: SIM.tick };
}
function battleOracleReward(sideRed, baseline) {
    const own = battleOracleForceValue(sideRed);
    const enemy = battleOracleForceValue(!sideRed);
    const ownLost = Math.max(0, baseline.own.effective - own.effective);      // kaybettiğimiz değer
    const enemyLost = Math.max(0, baseline.enemy.effective - enemy.effective); // yok ettiğimiz değer
    const tradeDiff = enemyLost - ownLost;                                     // + = lehte takas
    let terminal = 0;
    const winner = (SIM.battle && SIM.battle.winnerSide !== undefined) ? SIM.battle.winnerSide : null;
    if (winner !== null) terminal = (!!winner === !!sideRed) ? 1 : -1;
    const forceLead = own.effective - enemy.effective;                         // kalan üstünlük
    const raw = {
        ownLost: Math.round(ownLost), enemyLost: Math.round(enemyLost), tradeDiff: Math.round(tradeDiff),
        terminal, ownRemain: Math.round(own.effective), enemyRemain: Math.round(enemy.effective),
        ownCount: own.count, enemyCount: enemy.count, forceLead: Math.round(forceLead), ticks: SIM.tick - baseline.tick
    };
    // rewardWeights.v1: takas farkı ana sinyal + kalan üstünlük + terminal galibiyet bonusu
    const scalar = tradeDiff + forceLead * 0.5 + terminal * 800;
    return { raw, scalar, weights: BATTLE_ORACLE_REWARD_WEIGHTS_VERSION };
}

// ── Headless rollout: N tik ilerlet (her iki taraf battleControllersDrive) ────
let BATTLE_ORACLE_IN_ROLLOUT = false;   // rollout içinde canlı-snapshot yakalamayı engelle
function battleOracleRunTicks(maxTicks) {
    const prevHeadless = SIM.headless, prevRollout = BATTLE_ORACLE_IN_ROLLOUT;
    SIM.headless = true; BATTLE_ORACLE_IN_ROLLOUT = true;
    let ran = 0;
    try {
        for (; ran < maxTicks && phase === PHASE.BATTLE; ran++) {
            simulationTime += BATTLE_TICK_MS;
            gameTime += BATTLE_TICK_SEC;
            stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, simulationTime);
            if (SIM.battle && SIM.battle.winnerSide !== null && SIM.battle.winnerSide !== undefined) { ran++; break; }
        }
    } finally { SIM.headless = prevHeadless; BATTLE_ORACLE_IN_ROLLOUT = prevRollout; }
    return ran;
}

// ── Aday → operationalPlan enjeksiyonu ────────────────────────────────────────
// grammar intent'leri BATTLE_PLAN_KIND ile birebir örtüşüyor (HOLD/ADVANCE/MAIN_ATTACK/
// FIX_AND_FLANK/COUNTERATTACK/REGROUP/DISENGAGE). Doğrulayıp geçir.
function battleOracleIntentToKind(intent) {
    return (typeof BATTLE_PLAN_KIND !== 'undefined' && BATTLE_PLAN_KIND[intent]) ? BATTLE_PLAN_KIND[intent] : 'HOLD';
}

// Kendi birliklerini adayın allocation oranlarına göre MAIN/FIXING/FLANK/RESERVE'e böl.
// organize() ile aynı destek-ayrımı (RECON/FIRE_SUPPORT/SUPPORT), combat birlikleri allocation'la.
function battleOracleOrganizeByAllocation(ownUnits, allocation) {
    const buckets = {
        [TASK_GROUP_ROLE.MAIN]: [], [TASK_GROUP_ROLE.FIXING]: [], [TASK_GROUP_ROLE.FLANK]: [],
        [TASK_GROUP_ROLE.RESERVE]: [], [TASK_GROUP_ROLE.FIRE_SUPPORT]: [], [TASK_GROUP_ROLE.RECON]: [], [TASK_GROUP_ROLE.SUPPORT]: []
    };
    const combat = [];
    for (const u of ownUnits.slice().sort((a, b) => a.id - b.id)) {
        if (u.type === T.RECON) buckets[TASK_GROUP_ROLE.RECON].push(u);
        else if (u.type === T.ARTILLERY) buckets[TASK_GROUP_ROLE.FIRE_SUPPORT].push(u);
        else if (u.type === T.ENGINEER || u.type === T.MEDIC) buckets[TASK_GROUP_ROLE.SUPPORT].push(u);
        else combat.push(u);
    }
    const uv = (typeof planningUnitValue === 'function') ? planningUnitValue : battleOracleUnitValue;
    const combatValue = combat.reduce((s, u) => s + uv(u), 0);
    // sırayla RESERVE → FIXING → FLANK doldur, kalanı MAIN. Değer-hedefli, deterministik (id sıralı).
    const fill = (role, frac, pool) => {
        const target = combatValue * (frac || 0);
        let acc = 0; const taken = [];
        for (const u of pool) { if (pool.length - taken.length <= 1) break; if (acc >= target || frac <= 0) break; taken.push(u); acc += uv(u); }
        for (const u of taken) buckets[role].push(u);
        return pool.filter(u => taken.indexOf(u) < 0);
    };
    let rest = combat;
    rest = fill(TASK_GROUP_ROLE.RESERVE, allocation.reserve, rest);
    rest = fill(TASK_GROUP_ROLE.FIXING, allocation.fixing, rest);
    rest = fill(TASK_GROUP_ROLE.FLANK, allocation.flank, rest);
    for (const u of rest) buckets[TASK_GROUP_ROLE.MAIN].push(u);
    return Object.values(TASK_GROUP_ROLE)
        .map(role => planningGroup(role, buckets[role]))
        .filter(g => g.unitIds.length > 0);
}

// PAYLAŞILAN: bir enjeksiyon-spec'ini (inj) icra planına çevir. Hem Oracle (sabit spec) hem canlı-seçici
// (model-seçtiği spec) bunu kullanır. inj = { kind, sector, point, allocation, flankPoint, tempoScale, tempoLabel }.
function battleBuildInjectedPlan(planner, committedPlan, observation, situation, inj) {
    const plan = Object.assign({}, committedPlan, { kind: inj.kind });
    let objective = planner.objectiveSelector.select(plan, observation, situation) || {};
    objective = Object.assign({}, objective, {
        kind: 'INJECTED_OBJECTIVE', x: inj.point.x, y: inj.point.y, sector: inj.sector,
        confidence: 1, contactId: null, sourceContactIds: []
    });
    const taskGroups = battleOracleOrganizeByAllocation(observation.ownUnits || [], inj.allocation);
    const taskContracts = planner.taskContractPlanner.build(plan, objective, taskGroups, observation);
    // SADAKAT: flankSector + tempo/pursuit'i sözleşmelere işle (executor tüketir)
    const groupCentroid = {}; for (const g of taskGroups) groupCentroid[g.role] = g.centroid;
    const clampPt = (typeof planningClampPoint === 'function') ? planningClampPoint : (p => p);
    for (const c of taskContracts) {
        if (typeof c.pursuitLimit === 'number' && c.pursuitLimit > 0) c.pursuitLimit = Math.round(c.pursuitLimit * inj.tempoScale);
        if (inj.tempoLabel) c.tempo = inj.tempoLabel;
        if (c.groupRole === TASK_GROUP_ROLE.FLANK && inj.flankPoint) {
            const origin = groupCentroid[TASK_GROUP_ROLE.FLANK] || (c.route && c.route[0]) || c.destination;
            c.destination = clampPt({ x: inj.flankPoint.x, y: inj.flankPoint.y });
            if (typeof planningRoutePoints === 'function' && origin) {
                c.route = planningRoutePoints(origin, c.destination);
                if (c.route && c.route.length) c.phaseLine = c.route[1] || c.route[c.route.length - 1];
            }
        }
    }
    const assignedIds = taskGroups.flatMap(g => g.unitIds).sort((a, b) => a - b);
    const ownIds = (observation.ownUnits || []).map(u => u.id).sort((a, b) => a - b);
    planner.lastPlan = {
        planId: (committedPlan.id || 'inj') + ':inj', kind: inj.kind, generatedAtTick: observation.tick,
        objective, taskGroups, taskContracts, reserveRatioTarget: inj.allocation.reserve,
        allocationComplete: assignedIds.length === ownIds.length,
        contractsComplete: taskContracts.length === taskGroups.length && taskContracts.every(c => c.unitIds.length > 0),
        issuesOrders: false, injected: true
    };
    return planner.lastPlan;
}

// PAYLAŞILAN: bir gramer-adayını enjeksiyon-spec'ine çevir
function battleCandidateToInjection(candidate, controllerId) {
    const center = (typeof opgSectorCenter === 'function') ? opgSectorCenter(candidate.mainSector) : { x: 0, y: 0 };
    const flankPoint = (candidate.flankSector != null && typeof opgSectorCenter === 'function') ? opgSectorCenter(candidate.flankSector) : null;
    const tempoScale = candidate.tempo === 'aggressive' ? 1.5 : candidate.tempo === 'cautious' ? 0.65 : 1.0;
    return {
        controllerId, kind: battleOracleIntentToKind(candidate.intent), sector: candidate.mainSector,
        point: center, allocation: candidate.allocation || { main: 0.6, fixing: 0.2, flank: 0.1, reserve: 0.1 },
        flankPoint, tempoScale, tempoLabel: candidate.tempo, pursuitLimit: candidate.pursuitLimit
    };
}

// operationalPlanner.build sarmalayıcısı — Oracle (sabit) VEYA canlı-seçici (model) modunda adayı enjekte eder.
function battleOracleInstallInjection(controller) {
    const planner = controller.operationalPlanner;
    if (!planner || planner.__oracleWrapped) return;
    const original = planner.build.bind(planner);
    planner.__oracleOriginalBuild = original;
    planner.__oracleWrapped = true;
    planner.build = function (committedPlan, observation, situation) {
        if (committedPlan && observation && situation) {
            // ORACLE modu: sabit enjeksiyon (rollout değerlendirmesi)
            if (BATTLE_ORACLE_INJECTION && controller.id === BATTLE_ORACLE_INJECTION.controllerId)
                return battleBuildInjectedPlan(this, committedPlan, observation, situation, BATTLE_ORACLE_INJECTION);
            // CANLI SEÇİCİ modu: model adayı seçer (gerçek maçta oynar; kontrolör-başına model)
            if (BATTLE_SELECTOR_MODELS[controller.id]) {
                const inj = battleSelectorPickInjection(controller, observation, situation);
                if (inj) return battleBuildInjectedPlan(this, committedPlan, observation, situation, inj);
            }
        }
        return original(committedPlan, observation, situation);
    };
}
function battleOracleUninstallInjection(controller) {
    const planner = controller.operationalPlanner;
    if (planner && planner.__oracleWrapped && planner.__oracleOriginalBuild) {
        planner.build = planner.__oracleOriginalBuild;
        delete planner.__oracleOriginalBuild; delete planner.__oracleWrapped;
    }
}

// ── Gramer bağlamı: bir kontrolörün gözünden (Oracle tam-bilgi kullanabilir) ──
function battleOracleGrammarContext(controller, sideRed) {
    const ownUnits = SIM.units.filter(u => !u.dead && (!!u.isRed === !!sideRed));
    // Oracle tavan testi: tam-bilgi kabul (contacts = tüm düşman). Ceiling ölçümü için hile serbest.
    const contacts = SIM.units.filter(u => !u.dead && (!!u.isRed !== !!sideRed))
        .map(u => ({ x: u.x, y: u.y, confidence: 1, estimatedStrength: battleOracleUnitValue(u) }));
    let role = controller && controller.lastSituation && controller.lastSituation.role;
    if (!role && typeof battleRoleForSide === 'function') role = battleRoleForSide(sideRed);
    return opgBuildContext(sideRed, ownUnits, contacts, role);
}

// ═══ FAZ 6: İNSAN-MAÇI ÖĞRENME (karar-durumu snapshot → sonra Oracle-etiketle) ═══════════════
// Canlı insan-maçında (blue=insan) kırmızının karar-durumlarını yakala → maç sonrası etiketle →
// kırmızı, insanın YARATTIĞI durumlarda ne yapması gerektiğini öğrenir → o insana karşı sertleşir.
// Replay-determinizmini RİSKE ATMAZ (snapshot canlı-yakalanır, tam-durum fork'tur).
let BATTLE_TRAIN_CAPTURE = false;          // opt-in: "bu maçtan öğren" açıksa yakala
let BATTLE_DECISION_SNAPSHOTS = [];        // { tick, fork, ctxSide } — bellekte, maç boyunca
let BATTLE_SNAPSHOT_INTERVAL = 200;        // her ~10sn bir karar-durumu (maç-sonu etiketleme donmasını sınırla)
const BATTLE_SNAPSHOT_MAX = 14;            // maç başına en çok (14 × ~64 rollout ≈ ~1 dk etiketleme)
function battleTrainCaptureReset(on) { BATTLE_TRAIN_CAPTURE = !!on; BATTLE_DECISION_SNAPSHOTS = []; }
// stepSim/gameLoop kancasından çağrılır: temas-fazında periyodik tam-durum yakala
function battleMaybeCaptureDecisionSnapshot(sideRed) {
    if (!BATTLE_TRAIN_CAPTURE || BATTLE_ORACLE_IN_ROLLOUT || typeof battleForkCapture !== 'function') return;
    if ((SIM.tick % BATTLE_SNAPSHOT_INTERVAL) !== 0) return;
    if (SIM.tick < BATTLE_SELECTOR_MIN_TICK) return;   // temas-fazı (açılışta sinyal yok)
    // temas var mı (ucuz kontrol): en az bir düşman görüş-menzilinde
    const reds = SIM.units.filter(u => !u.dead && (!!u.isRed === !!sideRed));
    const foes = SIM.units.filter(u => !u.dead && (!!u.isRed !== !!sideRed));
    if (!reds.length || !foes.length) return;
    let near = false;
    for (const a of reds) { for (const b of foes) { if (Math.hypot(a.x - b.x, a.y - b.y) < 500) { near = true; break; } } if (near) break; }
    if (!near) return;
    if (BATTLE_DECISION_SNAPSHOTS.length >= BATTLE_SNAPSHOT_MAX) return;   // etiketleme-donmasını sınırla
    BATTLE_DECISION_SNAPSHOTS.push({ tick: SIM.tick, fork: battleForkCapture(), sideRed: !!sideRed });
}
// Maç sonrası: yakalanan snapshot'ları Oracle ile etiketle → eğitim tuple'ları (insan-dağılımı DAgger verisi)
function battleLabelDecisionSnapshots(config = {}) {
    const rolloutSec = config.rolloutSec || 12;
    const snaps = BATTLE_DECISION_SNAPSHOTS.slice();
    const examples = [];
    // etiketleme sırasında bu maçın snapshot'larını dondur; her biri kendi fork'undan restore edilir
    const saveModels = BATTLE_SELECTOR_MODELS; BATTLE_SELECTOR_MODELS = {};   // temiz Oracle (kod-AI baseline)
    // KRİTİK: maç sonu phase=OVER; rollout `while (phase===BATTLE)` ile gate'li → geçici BATTLE yap yoksa
    // rollout hiç koşmaz, her snapshot "inactive" olur ve etiketlenmez.
    const savePhase = (typeof phase !== 'undefined') ? phase : null;
    try {
        if (typeof PHASE !== 'undefined') phase = PHASE.BATTLE;
        for (const s of snaps) {
            battleForkRestore(s.fork);
            if (typeof PHASE !== 'undefined') phase = PHASE.BATTLE;   // fork restore sonrası da garantile
            const ev = battleOracleEvaluate({ sideRed: s.sideRed, rolloutSec, collectDataset: true });
            if (ev && ev.dataset && ev.active) { ev.dataset.human = true; ev.dataset.snapTick = s.tick; examples.push(ev.dataset); }
        }
    } finally { BATTLE_SELECTOR_MODELS = saveModels; if (savePhase !== null) phase = savePhase; }
    return { count: examples.length, examples };
}

// ── ORACLE DEĞERLENDİRME: mevcut durumda tüm adayları + varsayılanı rollout, regret hesapla ──
function battleOracleEvaluate(config = {}) {
    if (typeof battleForkCapture !== 'function') return { err: 'fork yok' };
    const sideRed = config.sideRed !== false;
    const rolloutTicks = config.rolloutTicks || Math.round((config.rolloutSec || 30) / BATTLE_TICK_SEC);
    const controllerId = config.controllerId ||
        ([...BATTLE_CONTROLLERS.values()].find(c => c.side === sideRed && c.owner === (typeof CONTROL_OWNER !== 'undefined' ? CONTROL_OWNER.ENEMY_AI : 'ENEMY_AI'))?.id) ||
        ([...BATTLE_CONTROLLERS.values()].find(c => c.side === sideRed)?.id);
    const controller = BATTLE_CONTROLLERS.get(controllerId);
    if (!controller) return { err: 'kontrolör yok (side=' + sideRed + ')' };

    // adayları mevcut durumdan üret
    const ctx = battleOracleGrammarContext(controller, sideRed);
    const candidates = operationGrammarGenerate(ctx);
    if (!candidates.length) return { err: '0 aday', ctxRole: ctx.role, ownTotal: ctx.ownTotal, enemyTotal: ctx.enemyTotal };

    // enjeksiyon sarmalayıcısını tüm kontrolörlere kur (fork restore metod'u korur)
    for (const c of BATTLE_CONTROLLERS.values()) battleOracleInstallInjection(c);

    const fork = battleForkCapture();
    const baseline = battleOracleBaseline(sideRed);

    // 0) VARSAYILAN (kod-AI, enjeksiyon YOK) = "chosen" — ÖNCE ve pristine fork'tan koş ki hiçbir aday
    //    rollout'u onu perturbe etmesin (fork-izolasyon boşluğuna karşı baseline'ı temiz tut).
    BATTLE_ORACLE_INJECTION = null;
    battleForkRestore(fork);
    const chosenRan = battleOracleRunTicks(rolloutTicks);
    const chosen = battleOracleReward(sideRed, baseline);

    // 1) her adayı rollout et
    const results = [];
    for (let i = 0; i < candidates.length; i++) {
        battleForkRestore(fork);
        const cand = candidates[i];
        BATTLE_ORACLE_INJECTION = battleCandidateToInjection(cand, controllerId);
        const ran = battleOracleRunTicks(rolloutTicks);
        const reward = battleOracleReward(sideRed, baseline);
        results.push({ index: i, intent: cand.intent, mainSector: cand.mainSector, tempo: cand.tempo, ran, reward });
    }

    // 3) orijinali geri yükle + temizle
    battleForkRestore(fork);
    BATTLE_ORACLE_INJECTION = null;
    for (const c of BATTLE_CONTROLLERS.values()) battleOracleUninstallInjection(c);

    // temas göstergesi: karar anında en yakın düşman mesafesi + rollout'larda çarpışma oldu mu
    let minEnemyDist = Infinity;
    const reds = SIM.units.filter(u => !u.dead && !!u.isRed === !!sideRed);
    const blues = SIM.units.filter(u => !u.dead && !!u.isRed !== !!sideRed);
    for (const a of reds) for (const b of blues) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < minEnemyDist) minEnemyDist = d; }

    // 4) oracle = en iyi aday; regret = oracle − chosen
    results.sort((a, b) => b.reward.scalar - a.reward.scalar);
    const oracle = results[0] || null;
    const regret = oracle ? (oracle.reward.scalar - chosen.scalar) : 0;
    // "aktif" nokta = oracle veya chosen rollout'unda gerçek çarpışma oldu (aksi halde regret anlamsız)
    const combatVolume = (oracle ? (oracle.reward.raw.enemyLost + oracle.reward.raw.ownLost) : 0) +
        (chosen.raw.enemyLost + chosen.raw.ownLost);
    const active = combatVolume > 0;
    // TAVAN regret'i: mükemmel seçici varsayılanı "sürdür"meyi de seçebilir → hiç varsayılandan kötü yapmaz.
    // regretCeiling = max(0, en_iyi_aday − chosen). İşaretli regret ise gramerin varsayılanı yendiği/kaybettiği
    // noktaları gösterir (negatif = taze-operasyon enjeksiyonu momentum kaybettiriyor, tipik mid-icra).
    const regretCeiling = Math.max(0, regret);

    // FAZ 3 VERİSİ: seçici model eğitim tuple'ı — (stateFeatures, [her aday: candidateFeatures + rollout ödülü]).
    // Öğretmen = karşı-olgusal rollout ödülü. Listwise: bir karar durumu, N aday, gerçek sıralama.
    let dataset = null;
    if (config.collectDataset && typeof battleStateFeatures === 'function') {
        const maxTicks = Math.round(((typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.durationSec) || 240) / BATTLE_TICK_SEC);
        const stateFeatures = battleStateFeatures(ctx, { minEnemyDist, tick: SIM.tick, maxTicks, ownCount: baseline.own.count, enemyCount: baseline.enemy.count });
        dataset = {
            stateVersion: STATE_FEATURES_VERSION, candidateVersion: CANDIDATE_FEATURES_VERSION,
            sideRed, decisionTick: SIM.tick, minEnemyDist: Math.round(minEnemyDist), active,
            chosenReward: +chosen.scalar.toFixed(2), stateFeatures,
            rows: results.map(r => ({
                intent: r.intent, mainSector: r.mainSector, tempo: r.tempo,
                features: battleCandidateFeatures(candidates[r.index], ctx),
                reward: +r.reward.scalar.toFixed(2), rewardRaw: r.reward.raw
            }))
        };
    }

    return {
        dataset,
        active, minEnemyDist: Math.round(minEnemyDist), combatVolume: Math.round(combatVolume),
        sideRed, controllerId, decisionTick: SIM.tick, rolloutTicks, candidateCount: candidates.length,
        chosen: { scalar: +chosen.scalar.toFixed(1), raw: chosen.raw, ran: chosenRan },
        oracle: oracle ? { intent: oracle.intent, mainSector: oracle.mainSector, tempo: oracle.tempo, scalar: +oracle.reward.scalar.toFixed(1), raw: oracle.reward.raw } : null,
        regret: +regret.toFixed(1), regretCeiling: +regretCeiling.toFixed(1),
        top5: results.slice(0, 5).map(r => ({ intent: r.intent, sector: r.mainSector, tempo: r.tempo, scalar: +r.reward.scalar.toFixed(1) })),
        worst: results.length ? { intent: results[results.length - 1].intent, scalar: +results[results.length - 1].reward.scalar.toFixed(1) } : null
    };
}

if (typeof module !== 'undefined') module.exports = {
    battleOracleEvaluate, battleOracleReward, battleOracleForceValue, battleOracleRunTicks,
    battleOracleOrganizeByAllocation, battleOracleIntentToKind,
    battleSelectorEnable, battleSelectorEnableFor, battleSelectorDisable, battleSelectorSetModel, battleCandidateToInjection
};
