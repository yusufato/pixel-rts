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
function battleOracleRunTicks(maxTicks) {
    const prevHeadless = SIM.headless;
    SIM.headless = true;
    let ran = 0;
    try {
        for (; ran < maxTicks && phase === PHASE.BATTLE; ran++) {
            simulationTime += BATTLE_TICK_MS;
            gameTime += BATTLE_TICK_SEC;
            stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, simulationTime);
            if (SIM.battle && SIM.battle.winnerSide !== null && SIM.battle.winnerSide !== undefined) { ran++; break; }
        }
    } finally { SIM.headless = prevHeadless; }
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

// operationalPlanner.build sarmalayıcısı — enjeksiyon aktifse adayı icra planına çevir.
function battleOracleInstallInjection(controller) {
    const planner = controller.operationalPlanner;
    if (!planner || planner.__oracleWrapped) return;
    const original = planner.build.bind(planner);
    planner.__oracleOriginalBuild = original;
    planner.__oracleWrapped = true;
    planner.build = function (committedPlan, observation, situation) {
        const inj = BATTLE_ORACLE_INJECTION;
        if (!inj || !committedPlan || !observation || !situation || controller.id !== inj.controllerId) {
            return original(committedPlan, observation, situation);
        }
        // 1) kind'ı adaydan zorla (objective/executor kapısı bu kind'a göre) — committedPlan'ı klonla
        const plan = Object.assign({}, committedPlan, { kind: inj.kind });
        // 2) objective: seçiciyi çalıştır sonra mainSector merkeziyle ez
        let objective = this.objectiveSelector.select(plan, observation, situation) || {};
        objective = Object.assign({}, objective, {
            kind: 'INJECTED_OBJECTIVE', x: inj.point.x, y: inj.point.y, sector: inj.sector,
            confidence: 1, contactId: null, sourceContactIds: []
        });
        // 3) gruplar: adayın allocation'ına göre böl
        const taskGroups = battleOracleOrganizeByAllocation(observation.ownUnits || [], inj.allocation);
        // 4) mevcut sözleşme planlayıcısını yeniden kullan (objective + groups parametre alıyor)
        const taskContracts = this.taskContractPlanner.build(plan, objective, taskGroups, observation);
        const assignedIds = taskGroups.flatMap(g => g.unitIds).sort((a, b) => a - b);
        const ownIds = (observation.ownUnits || []).map(u => u.id).sort((a, b) => a - b);
        this.lastPlan = {
            planId: (committedPlan.id || 'inj') + ':oracle', kind: inj.kind, generatedAtTick: observation.tick,
            objective, taskGroups, taskContracts, reserveRatioTarget: inj.allocation.reserve,
            allocationComplete: assignedIds.length === ownIds.length,
            contractsComplete: taskContracts.length === taskGroups.length &&
                taskContracts.every(c => c.unitIds.length > 0),
            issuesOrders: false, injected: true
        };
        return this.lastPlan;
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

    // 1) her adayı rollout et
    const results = [];
    for (let i = 0; i < candidates.length; i++) {
        battleForkRestore(fork);
        const cand = candidates[i];
        const center = (typeof opgSectorCenter === 'function') ? opgSectorCenter(cand.mainSector) : { x: 0, y: 0 };
        BATTLE_ORACLE_INJECTION = {
            controllerId, kind: battleOracleIntentToKind(cand.intent), sector: cand.mainSector,
            point: center, allocation: cand.allocation || { main: 0.6, fixing: 0.2, flank: 0.1, reserve: 0.1 }
        };
        const ran = battleOracleRunTicks(rolloutTicks);
        const reward = battleOracleReward(sideRed, baseline);
        results.push({ index: i, intent: cand.intent, mainSector: cand.mainSector, tempo: cand.tempo, ran, reward });
    }
    // 2) varsayılan (kod-AI, enjeksiyon YOK) = "chosen"
    BATTLE_ORACLE_INJECTION = null;
    battleForkRestore(fork);
    const chosenRan = battleOracleRunTicks(rolloutTicks);
    const chosen = battleOracleReward(sideRed, baseline);

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
    return {
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
    battleOracleOrganizeByAllocation, battleOracleIntentToKind
};
