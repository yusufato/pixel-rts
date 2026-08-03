// ═══════════════════════════════════════════════════════════════════════════
//  SALDIRAN / SAVUNAN SAVAŞ KURALLARI
//  ---------------------------------------------------------------------------
//  Bölge puanı yoktur. Saldıran süre dolmadan savunmayı yok etmeli veya
//  teslim olmaya zorlamalıdır. Savunanın görevi organize savaş gücünü koruyup
//  süreyi tüketmektir. Tüm zaman hesabı simülasyon dt'siyle ilerler; headless,
//  canlı ve MP aynı sonucu üretir.
// ═══════════════════════════════════════════════════════════════════════════

const BATTLE_ROLE = Object.freeze({ ATTACKER: 'attacker', DEFENDER: 'defender' });
const BATTLE_OUTCOME = Object.freeze({
    DEFENDER_ELIMINATED: 'defender_eliminated',
    DEFENDER_SURRENDERED: 'defender_surrendered',
    ATTACKER_ELIMINATED: 'attacker_eliminated',
    ATTACKER_WITHDREW: 'attacker_withdrew',
    TIME_EXPIRED: 'time_expired',
    ATTACKER_DOMINANT: 'attacker_dominant',   // KULLANICI: süre-sonu saldıran DAHA GÜÇLÜ bitirdi (savunmayı kırdı) → saldıran kazanır
    MUTUAL_COLLAPSE: 'mutual_collapse'
});

const DEFAULT_BATTLE_DURATION_SEC = 360;   // KULLANICI-KARARI: 4dk→6dk — saldıran imhayı bitirsin (margin-zaferle birlikte); analist: süre+margin birlikte gelmeli
const BATTLE_SURRENDER_HOLD_SEC = Object.freeze({ attacker: 6, defender: 8 });

function makeEmptyBattleArmyState() {
    return {
        initialValue: 0,
        initialCombatUnits: 0,
        effectiveValue: 0,
        valueRatio: 1,
        combatUnits: 0,
        combatRatio: 1,
        routedRatio: 0,
        suppressedRatio: 0,
        supplyCutRatio: 0,
        will: 100,
        surrenderPressure: 0
    };
}

function makeBattleRuleState() {
    return {
        active: false,
        attackerSide: false,
        defenderSide: true,
        durationSec: DEFAULT_BATTLE_DURATION_SEC,
        elapsedSec: 0,
        remainingSec: DEFAULT_BATTLE_DURATION_SEC,
        winnerSide: null,
        outcomeReason: null,
        endedAt: null,
        maxDominanceRatio: 0,   // T0-TELEMETRİ: saldıran/savunan etkili-değer oranının maç-boyu tepesi (taarruz-aciz mi eşik-ulaşılmaz mı)
        red: makeEmptyBattleArmyState(),
        blue: makeEmptyBattleArmyState()
    };
}

function resetBattleRules() {
    SIM.battle = makeBattleRuleState();
    return SIM.battle;
}

function battleRulesConfigForCurrentMatch() {
    if (typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.active &&
        typeof battlefieldRulesConfig === 'function') {
        return battlefieldRulesConfig();
    }
    let attackerSide = false; // Hızlı maç / MP varsayılanı: MAVİ saldırır.
    let durationSec = DEFAULT_BATTLE_DURATION_SEC;
    if (typeof STORY !== 'undefined' && STORY && STORY.active && STORY.battleCtx) {
        // Oyuncu saldırısı: mavi saldıran. Oyuncu savunması: kırmızı saldıran.
        attackerSide = STORY.battleCtx.mode === 'defense';
        if (Number.isFinite(STORY.battleCtx.durationSec)) durationSec = STORY.battleCtx.durationSec;
    } else if (typeof QUICK_MATCH_ATTACKER_SIDE !== 'undefined') {
        attackerSide = QUICK_MATCH_ATTACKER_SIDE === true;
    }
    return { attackerSide, durationSec };
}

function battleUnitBaseValue(unit) {
    const stats = unit && STATS[unit.type];
    return stats ? stats.cost : 0;
}

function battleUnitCanFight(unit) {
    if (!unit || unit.dead || unit.hp <= 0) return false;
    const stats = STATS[unit.type];
    if (!stats || stats.atk <= 0) return false;
    return true;
}

function battleArmyObservation(side) {
    let effectiveValue = 0;
    let combatUnits = 0;
    let routed = 0;
    let suppressed = 0;
    let supplyCut = 0;
    let unitCount = 0;
    for (const unit of SIM.units) {
        if (unit.dead || unit.isRed !== side || unit.abandoned) continue;   // TERK-EDİLMİŞ araç NÖTR: hiçbir tarafın kuvvet-sayımına girmez (ele geçirilene dek)
        unitCount++;
        const hpRatio = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
        const ammoRatio = (unit.maxAmmo || 0) > 0
            ? Math.max(0, Math.min(1, (unit.ammo || 0) / Math.max(1, unit.maxAmmo)))
            : 1;
        const readiness = 0.65 + ammoRatio * 0.35;
        effectiveValue += battleUnitBaseValue(unit) * hpRatio * readiness;
        if (battleUnitCanFight(unit)) combatUnits++;
        if (unit.isFleeing) routed++;
        if ((unit.suppression || 0) > 60) suppressed++;
        if (unit.supplyCut) supplyCut++;
    }
    return {
        effectiveValue,
        combatUnits,
        unitCount,
        routedRatio: unitCount ? routed / unitCount : 1,
        suppressedRatio: unitCount ? suppressed / unitCount : 1,
        supplyCutRatio: unitCount ? supplyCut / unitCount : 1
    };
}

function initBattleRules(config = {}) {
    const state = resetBattleRules();
    state.active = true;
    state.attackerSide = config.attackerSide === true;
    state.defenderSide = !state.attackerSide;
    state.durationSec = Math.max(30, Number.isFinite(config.durationSec) ? config.durationSec : DEFAULT_BATTLE_DURATION_SEC);
    state.remainingSec = state.durationSec;

    for (const side of [false, true]) {
        const key = side ? 'red' : 'blue';
        const obs = battleArmyObservation(side);
        state[key].initialValue = Math.max(1, obs.effectiveValue);
        state[key].initialCombatUnits = Math.max(1, obs.combatUnits);
        state[key].effectiveValue = obs.effectiveValue;
        state[key].combatUnits = obs.combatUnits;
    }
    return state;
}

function battleRoleForSide(side) {
    const state = SIM.battle;
    if (!state || !state.active) return BATTLE_ROLE.ATTACKER;
    return side === state.attackerSide ? BATTLE_ROLE.ATTACKER : BATTLE_ROLE.DEFENDER;
}

function battleUrgencyForSide(side) {
    const state = SIM.battle;
    if (!state || !state.active || side !== state.attackerSide) return 0;
    const progress = state.elapsedSec / Math.max(1, state.durationSec);
    // İlk yarıda ölçülü, son çeyrekte hızla yükselen taarruz baskısı.
    return Math.max(0, Math.min(1, (progress - 0.35) / 0.65));
}

function battleObjectiveForSide(side) {
    const role = battleRoleForSide(side);
    const homeY = side ? WORLD_H * 0.24 : WORLD_H * 0.76;
    if (role === BATTLE_ROLE.DEFENDER) return { x: WORLD_W * 0.5, y: homeY };
    // Saldıran, savunanın ana savunma hattına doğru baskı kurar.
    const defenderY = side ? WORLD_H * 0.76 : WORLD_H * 0.24;
    return { x: WORLD_W * 0.5, y: defenderY };
}

function battleSetOutcome(winnerSide, reason, now) {
    const state = SIM.battle;
    if (!state || !state.active || state.winnerSide !== null) return;
    state.winnerSide = winnerSide === true;
    state.outcomeReason = reason;
    state.endedAt = Number.isFinite(now) ? now : null;
}

function battleUpdateArmyState(side, observation, enemyObservation, dtSec) {
    const state = SIM.battle;
    const key = side ? 'red' : 'blue';
    const army = state[key];
    const role = battleRoleForSide(side);
    army.effectiveValue = observation.effectiveValue;
    army.combatUnits = observation.combatUnits;
    army.valueRatio = Math.max(0, Math.min(1, observation.effectiveValue / Math.max(1, army.initialValue)));
    army.combatRatio = Math.max(0, Math.min(1, observation.combatUnits / Math.max(1, army.initialCombatUnits)));
    army.routedRatio = observation.routedRatio;
    army.suppressedRatio = observation.suppressedRatio;
    army.supplyCutRatio = observation.supplyCutRatio;

    const rawWill =
        army.valueRatio * 0.52 +
        army.combatRatio * 0.20 +
        (1 - army.routedRatio) * 0.12 +
        (1 - army.suppressedRatio) * 0.10 +
        (1 - army.supplyCutRatio) * 0.06;
    army.will = Math.max(0, Math.min(100, Math.round(rawWill * 100)));

    const enemyDominance = enemyObservation.effectiveValue / Math.max(1, observation.effectiveValue);
    const threshold = role === BATTLE_ROLE.DEFENDER ? 0.16 : 0.22;
    const valueFloor = role === BATTLE_ROLE.DEFENDER ? 0.20 : 0.28;
    const pressured = observation.combatUnits > 0 && enemyObservation.combatUnits > 0 &&
        army.will / 100 < threshold && army.valueRatio < valueFloor && enemyDominance > 1.35;
    if (pressured) army.surrenderPressure += dtSec;
    else army.surrenderPressure = Math.max(0, army.surrenderPressure - dtSec * 1.5);
}

function updateBattleRules(dtSec, now) {
    const state = SIM.battle;
    if (!state || !state.active || state.winnerSide !== null || dtSec <= 0) return;
    state.elapsedSec += dtSec;
    state.remainingSec = Math.max(0, state.durationSec - state.elapsedSec);

    const blueObs = battleArmyObservation(false);
    const redObs = battleArmyObservation(true);
    battleUpdateArmyState(false, blueObs, redObs, dtSec);
    battleUpdateArmyState(true, redObs, blueObs, dtSec);

    const attackerObs = state.attackerSide ? redObs : blueObs;
    const defenderObs = state.defenderSide ? redObs : blueObs;
    const attacker = state[state.attackerSide ? 'red' : 'blue'];
    const defender = state[state.defenderSide ? 'red' : 'blue'];

    // T0-TELEMETRİ (analist): DOMINANCE-YAKLAŞMA — saldıran/savunan etkili-değer oranının maç-boyu TEPESİ. Süre-sonu eşiği (>1.0)
    // hiç aşılmadıysa: maxDom<1.0 = "taarruz ACİZ" (yaklaşamadı bile); maxDom≈0.95-1.0 = "eşik ULAŞILMAZ" (yaklaştı, geçemedi). İki hastalığı ayırır.
    const _dom = defenderObs.effectiveValue > 0 ? (attackerObs.effectiveValue / defenderObs.effectiveValue) : (attackerObs.effectiveValue > 0 ? 9 : 0);
    if (_dom > (state.maxDominanceRatio || 0)) state.maxDominanceRatio = Math.round(_dom * 1000) / 1000;

    // TEST MERHAMET KURALI (yalnız KOMUTAN modu): bir taraf diğerinden %75 daha güçlüyse (etkili-değer ≥1.75×) maç biter.
    if (typeof BATTLE_COMMANDER_MODE !== 'undefined' && BATTLE_COMMANDER_MODE && redObs.combatUnits > 0 && blueObs.combatUnits > 0) {
        if (redObs.effectiveValue >= 1.75 * Math.max(1, blueObs.effectiveValue)) battleSetOutcome(true, 'MERCY_75_RED', now);
        else if (blueObs.effectiveValue >= 1.75 * Math.max(1, redObs.effectiveValue)) battleSetOutcome(false, 'MERCY_75_BLUE', now);
        if (state.winnerSide !== null) return;
    }
    // Beraber çöküş saldırana fetih sayılmaz: işgal edecek organize kuvvet kalmamıştır.
    if (attackerObs.combatUnits <= 0 && defenderObs.combatUnits <= 0) {
        battleSetOutcome(state.defenderSide, BATTLE_OUTCOME.MUTUAL_COLLAPSE, now);
    } else if (defenderObs.combatUnits <= 0) {
        battleSetOutcome(state.attackerSide, BATTLE_OUTCOME.DEFENDER_ELIMINATED, now);
    } else if (attackerObs.combatUnits <= 0) {
        battleSetOutcome(state.defenderSide, BATTLE_OUTCOME.ATTACKER_ELIMINATED, now);
    } else if (defender.surrenderPressure >= BATTLE_SURRENDER_HOLD_SEC.defender) {
        battleSetOutcome(state.attackerSide, BATTLE_OUTCOME.DEFENDER_SURRENDERED, now);
    } else if (attacker.surrenderPressure >= BATTLE_SURRENDER_HOLD_SEC.attacker) {
        battleSetOutcome(state.defenderSide, BATTLE_OUTCOME.ATTACKER_WITHDREW, now);
    } else if (state.remainingSec <= 1e-6) {
        // KULLANICI-KURAL: süre-sonu artık "savunan OTOMATİK kazanır" DEĞİL. Kim daha GÜÇLÜ bitirdiyse (etkili-değer) o kazanır.
        // Savunan yalnız hayatta-kalmakla değil KUVVETİNİ KORUYARAK kazanır (kamp bitti); saldıran savunmayı KIRIP domine
        // ederse kazanır (saldıran-blokajı bitti). Beraberlik/savunan-önde → savunan (hazır-mevzi + belirsizlik-avantajı korunur).
        if (attackerObs.effectiveValue > defenderObs.effectiveValue) battleSetOutcome(state.attackerSide, BATTLE_OUTCOME.ATTACKER_DOMINANT, now);
        else battleSetOutcome(state.defenderSide, BATTLE_OUTCOME.TIME_EXPIRED, now);
    }
}

// main.js'in mevcut mavi-perspektifli sonucuyla uyumlu: true=MAVİ, false=KIRMIZI.
function battleOutcomeBluePerspective() {
    const state = SIM.battle;
    if (!state || state.winnerSide === null) return null;
    return state.winnerSide ? false : true;
}

function battleOutcomeLabel(reason) {
    const labels = {
        [BATTLE_OUTCOME.DEFENDER_ELIMINATED]: 'Savunma imha edildi',
        [BATTLE_OUTCOME.DEFENDER_SURRENDERED]: 'Savunma teslim oldu',
        [BATTLE_OUTCOME.ATTACKER_ELIMINATED]: 'Taarruz kuvveti imha edildi',
        [BATTLE_OUTCOME.ATTACKER_WITHDREW]: 'Saldıran geri çekildi',
        [BATTLE_OUTCOME.TIME_EXPIRED]: 'Savunma süreyi doldurdu',
        [BATTLE_OUTCOME.MUTUAL_COLLAPSE]: 'İki ordu da çöktü; savunma dayandı'
    };
    return labels[reason] || 'Savaş sona erdi';
}

resetBattleRules();
