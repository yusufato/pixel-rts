// ═══════════════════════════════════════════════════════════════
//  KOMUTAN MODU — kırmızıyı kod-AI yerine DIŞ komutan (Claude/LLM) sürer.
//  Gerçek-zamanlı micro YOK; "dur-komuta-sür" temposu: her COMMANDER_INTERVAL saniyede sim DURUR,
//  canlı saha bir dosyaya yazılır (yalnız GÖRÜLEN düşman — hile yok), komutan emir dosyası yazar, uygulanır, sürer.
//  İnsan mavi'yi canlı oynar; komutan kırmızıyı aralıklarla komuta eder (LLM-taktik vs kod-AI testi).
// ═══════════════════════════════════════════════════════════════

let BATTLE_COMMANDER_MODE = false;      // açıksa kırmızı kontrolörü atlanır, emirler dosyadan gelir
let BATTLE_COMMANDER_SIDE = true;       // komuta edilen taraf (true=kırmızı)
const COMMANDER_INTERVAL_TICKS = 80;    // 80 tik × 0.05sn = ~4sn komuta aralığı

let commanderPhase = 'PLAYING';         // 'PLAYING' | 'WAITING'
let commanderTurn = 0;
let commanderNextTurnTick = 0;
let commanderReadInFlight = false;
let commanderInited = false;

// Lazy init: preload'un commanderMode bayrağını battle başında bir kez oku.
function commanderMaybeInit() {
    if (commanderInited) return;
    commanderInited = true;
    if (typeof window !== 'undefined' && window.PIXEL && window.PIXEL.commanderMode) {
        BATTLE_COMMANDER_MODE = true;
        BATTLE_COMMANDER_SIDE = true;
        commanderNextTurnTick = (typeof SIM !== 'undefined' ? SIM.tick : 0);   // ilk turu HEMEN iste
        commanderPhase = 'PLAYING';
        if (typeof battleLearnMessage === 'function') battleLearnMessage('🎖️ KOMUTAN MODU: kırmızıyı dış-komutan sürüyor (dur-komuta-sür ~4sn).', 6000);
    }
}

// Canlı saha durumu (yalnız kırmızının GÖRDÜĞÜ düşman → hile yok).
function commanderBuildState() {
    const red = [], enemies = [];
    for (const u of SIM.units) {
        if (u.dead) continue;
        if (u.isRed === BATTLE_COMMANDER_SIDE) {
            red.push({ id: u.id, type: u.type, x: Math.round(u.x), y: Math.round(u.y),
                hpRatio: +(u.hp / (u.maxHp || u.hp || 1)).toFixed(2), ammo: u.ammo,
                state: u.combatState || null, target: u.attackTarget ? u.attackTarget.id : null });
        } else {
            const seen = (typeof canSee === 'function') ? canSee(BATTLE_COMMANDER_SIDE, u.x, u.y) : true;
            if (seen) enemies.push({ id: u.id, type: u.type, x: Math.round(u.x), y: Math.round(u.y),
                hpRatio: +(u.hp / (u.maxHp || u.hp || 1)).toFixed(2) });
        }
    }
    const obj = (typeof battleObjectiveForSide === 'function') ? battleObjectiveForSide(BATTLE_COMMANDER_SIDE) : null;
    return {
        turn: commanderTurn, tick: SIM.tick, seconds: +((SIM.tick || 0) * (typeof BATTLE_TICK_SEC !== 'undefined' ? BATTLE_TICK_SEC : 0.05)).toFixed(1),
        red, enemies,
        objective: obj ? { x: Math.round(obj.x), y: Math.round(obj.y) } : null,
        worldW: (typeof WORLD_W !== 'undefined' ? WORLD_W : 0), worldH: (typeof WORLD_H !== 'undefined' ? WORLD_H : 0),
        typeNames: { 0: 'Piyade', 1: 'Mekanize', 2: 'ZırhlıPiyade', 3: 'Keşif', 4: 'İstihkam', 5: 'Sağlıkçı', 6: 'Tank', 7: 'Tanksavar', 8: 'Topçu' }
    };
}

// Komutan emirlerini uygula (applyBattleOrder üzerinden). MOVE: unitIds hepsi (x,y)'ye. ATTACK: unitIds → targetId.
function commanderApplyOrders(orders) {
    if (!Array.isArray(orders)) return;
    for (const o of orders) {
        try {
            if (o.kind === 'ATTACK') applyBattleOrder({ kind: 'ATTACK', unitIds: o.unitIds || [], targetId: o.targetId, reason: 'CMDR', issuedBy: 'commander' });
            else if (o.kind === 'MOVE') applyBattleOrder({ kind: 'MOVE', destinations: (o.unitIds || []).map(id => ({ id, x: o.x, y: o.y })), reason: 'CMDR', issuedBy: 'commander' });
            else if (o.kind === 'HOLD') applyBattleOrder({ kind: 'HOLD', unitIds: o.unitIds || [], reason: 'CMDR' });
            else if (o.kind === 'FREE_FIRE') applyBattleOrder({ kind: 'FREE_FIRE', unitIds: o.unitIds || [], reason: 'CMDR' });
        } catch (e) { /* geçersiz emir atla */ }
    }
}

function commanderExport() {
    commanderTurn++;
    const state = commanderBuildState();
    if (typeof window !== 'undefined' && window.PIXEL && window.PIXEL.commander) {
        try { window.PIXEL.commander.writeState(state); } catch (e) {}
    }
}

function commanderPoll() {
    if (commanderReadInFlight) return;
    if (!(typeof window !== 'undefined' && window.PIXEL && window.PIXEL.commander)) return;
    commanderReadInFlight = true;
    window.PIXEL.commander.readOrders(commanderTurn).then(res => {
        commanderReadInFlight = false;
        if (res && res.turn === commanderTurn && Array.isArray(res.orders)) {
            commanderApplyOrders(res.orders);
            commanderPhase = 'PLAYING';
            commanderNextTurnTick = SIM.tick + COMMANDER_INTERVAL_TICKS;
            if (typeof battleAccumulatorMs !== 'undefined') battleAccumulatorMs = 0;   // uzun duraklamadan sonra patlama yok
        }
    }).catch(() => { commanderReadInFlight = false; });
}

// Her frame, sim adımından ÖNCE çağrılır. true → sim ilerleyebilir; false → DURDUR (komuta bekleniyor).
function commanderPreStep() {
    commanderMaybeInit();
    if (!BATTLE_COMMANDER_MODE) return true;
    if (commanderPhase === 'WAITING') { commanderPoll(); return false; }
    if (SIM.tick >= commanderNextTurnTick) {   // komuta zamanı → sahayı yaz, duraklat
        commanderExport();
        commanderPhase = 'WAITING';
        return false;
    }
    return true;
}

// while-döngü sınırı: komuta tik'ine varınca o frame'de daha fazla adım atma (turlar aralıkta kalsın).
function commanderShouldStopStepping() {
    return BATTLE_COMMANDER_MODE && commanderPhase === 'PLAYING' && SIM.tick >= commanderNextTurnTick;
}

if (typeof module !== 'undefined') module.exports = { commanderPreStep, commanderShouldStopStepping, commanderBuildState };
