// ═══════════════════════════════════════════════════════════════════════════
//  OperationGrammar.v1 — kod-tabanlı taktik gramer (Faz 0/3c)
//  Durumdan 16–64 GEÇERLİ operasyon ADAYI üretir. Model bunları ÜRETMEZ, PUANLAR (§2.0).
//  Bir aday = zamana yayılan operasyon sözleşmesi: intent + mainSector + flankSector +
//  allocation(oranlar) + tempo + phases(fazlar) + abort + pursuitLimit.
//  Sektör modeli: 8×6 (WORLD_W×WORLD_H). Düşman gücü YALNIZ algılanan temaslardan (sis-güvenli).
//  Bağımsız/izole: canlı controller'a bağlı değil; ctx açıkça verilir → tek başına test edilir.
// ═══════════════════════════════════════════════════════════════════════════

const OPG_COLS = 8, OPG_ROWS = 6, OPG_SECTORS = OPG_COLS * OPG_ROWS;

function opgSectorOf(x, y) {
    const c = Math.max(0, Math.min(OPG_COLS - 1, Math.floor(x / WORLD_W * OPG_COLS)));
    const r = Math.max(0, Math.min(OPG_ROWS - 1, Math.floor(y / WORLD_H * OPG_ROWS)));
    return r * OPG_COLS + c;
}
function opgSectorCenter(i) {
    const c = i % OPG_COLS, r = (i / OPG_COLS) | 0;
    return { x: (c + 0.5) / OPG_COLS * WORLD_W, y: (r + 0.5) / OPG_ROWS * WORLD_H };
}
function opgSectorAdjacent(i) {
    const c = i % OPG_COLS, r = (i / OPG_COLS) | 0, out = [];
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc >= 0 && nc < OPG_COLS && nr >= 0 && nr < OPG_ROWS) out.push(nr * OPG_COLS + nc);
    }
    return out;
}
function _opgUnitPower(u) { return (u.atk || 0) * ((u.hp || 0) / Math.max(1, u.maxHp || 1)); }

// ── Bağlam: kendi birlikler (gerçek) + algılanan düşman temasları (sis-güvenli) → sektör özellikleri ──
// contacts: [{x, y, estimatedStrength, confidence}] — controller.lastObservation.contacts biçimi.
function opgBuildContext(side, ownUnits, contacts, role) {
    const own = new Float32Array(OPG_SECTORS), enemy = new Float32Array(OPG_SECTORS);
    let ownTotal = 0, homeR = side ? 0 : OPG_ROWS - 1;   // kırmızı(side=true) kuzey(r=0), mavi güney
    for (const u of ownUnits) { if (u.dead) continue; const s = opgSectorOf(u.x, u.y), p = _opgUnitPower(u); own[s] += p; ownTotal += p; }
    let enemyTotal = 0;
    for (const c of (contacts || [])) { if ((c.confidence ?? 1) < 0.15) continue; const s = opgSectorOf(c.x, c.y), p = c.estimatedStrength || 1; enemy[s] += p; enemyTotal += p; }
    // düşman ağırlık merkezi (mainSector adayları için)
    let ex = 0, ey = 0; for (const c of (contacts || [])) { const p = c.estimatedStrength || 1; ex += c.x * p; ey += c.y * p; }
    const enemyCoG = enemyTotal > 0 ? opgSectorOf(ex / enemyTotal, ey / enemyTotal) : null;
    const roleRaw = role || (typeof battleRoleForSide === 'function' ? battleRoleForSide(side) : null);
    const roleNorm = roleRaw ? String(roleRaw).toUpperCase() : 'ATTACKER';   // BATTLE_ROLE küçük harf olabilir → normalize
    // en zayıf / en güçlü DÜŞMAN sektörü (temas olan sektörler arasında)
    let weakest = null, strongest = null, wv = Infinity, sv = -1;
    for (let s = 0; s < OPG_SECTORS; s++) { if (enemy[s] <= 0) continue; if (enemy[s] < wv) { wv = enemy[s]; weakest = s; } if (enemy[s] > sv) { sv = enemy[s]; strongest = s; } }
    return { side, role: roleNorm,
        own, enemy, ownTotal, enemyTotal, enemyCoG, weakestEnemySector: weakest, strongestEnemySector: strongest, homeRow: homeR };
}

// ── Şema (versiyonlu makine sözleşmesi) ──────────────────────────────────────
const OPERATION_GRAMMAR_V1 = Object.freeze({
    version: 1,
    intents: ['HOLD', 'ADVANCE', 'MAIN_ATTACK', 'FIX_AND_FLANK', 'COUNTERATTACK', 'REGROUP', 'DISENGAGE'],
    tempos: ['cautious', 'normal', 'aggressive'],
    groups: ['main', 'fixing', 'flank', 'reserve'],
    // rol kısıtı: hangi intent hangi rolde geçerli
    intentRoles: {
        HOLD: ['ATTACKER', 'DEFENDER'], ADVANCE: ['ATTACKER'], MAIN_ATTACK: ['ATTACKER', 'DEFENDER'],
        FIX_AND_FLANK: ['ATTACKER', 'DEFENDER'], COUNTERATTACK: ['DEFENDER'], REGROUP: ['ATTACKER', 'DEFENDER'], DISENGAGE: ['ATTACKER', 'DEFENDER']
    },
    // intent → izinli faz dizisi (safha makinesi)
    phasesByIntent: {
        HOLD: ['HOLD'], ADVANCE: ['ADVANCE', 'ACTION'], REGROUP: ['REGROUP'], DISENGAGE: ['WITHDRAW'],
        MAIN_ATTACK: ['ASSEMBLE', 'FIRE_WINDOW', 'ASSAULT', 'EXPLOIT'],
        FIX_AND_FLANK: ['PROBE', 'FIX', 'FLANK', 'EXPLOIT'],
        COUNTERATTACK: ['ASSEMBLE', 'ASSAULT', 'EXPLOIT']
    },
    phaseTriggers: ['enemy_reserve_revealed', 'enemy_center_committed', 'rear_access', 'flank_failed', 'objective_taken', 'assembled', 'fire_effect_achieved', 'timeout'],
    abortConditions: ['flank_group_losses>35%', 'enemy_counterattack_on_main_objective', 'force_ratio<0.5', 'ammo<0.25', 'group_isolated'],
    allocationBounds: { main: [0.30, 0.70], fixing: [0.00, 0.35], flank: [0.00, 0.55], reserve: [0.10, 0.35] },
    allocationSumTolerance: 0.001,
    maxPhases: 5,
    maxDurationTicks: 1200,        // 60 sn
    pursuitLimits: [150, 300, 500],
    sectors: OPG_SECTORS
});

// ── Doğrulayıcı: aday şemaya + duruma göre geçerli mi ────────────────────────
function operationGrammarValidate(c, ctx) {
    const G = OPERATION_GRAMMAR_V1, errs = [];
    if (!c || typeof c !== 'object') return { valid: false, errors: ['aday nesne değil'] };
    if (!G.intents.includes(c.intent)) errs.push('geçersiz intent: ' + c.intent);
    if (ctx && ctx.role && G.intentRoles[c.intent] && !G.intentRoles[c.intent].includes(ctx.role)) errs.push(c.intent + ' bu rolde (' + ctx.role + ') geçersiz');
    if (!G.tempos.includes(c.tempo)) errs.push('geçersiz tempo: ' + c.tempo);
    if (!Number.isInteger(c.mainSector) || c.mainSector < 0 || c.mainSector >= G.sectors) errs.push('mainSector aralık dışı');
    if (c.flankSector != null && (!Number.isInteger(c.flankSector) || c.flankSector < 0 || c.flankSector >= G.sectors)) errs.push('flankSector aralık dışı');
    if (!G.pursuitLimits.includes(c.pursuitLimit)) errs.push('geçersiz pursuitLimit');
    const a = c.allocation || {}; let sum = 0;
    for (const g of G.groups) { const v = a[g]; if (typeof v !== 'number' || v < 0) { errs.push('allocation.' + g + ' geçersiz'); continue; } const [lo, hi] = G.allocationBounds[g]; if (v < lo - 1e-6 || v > hi + 1e-6) errs.push('allocation.' + g + '=' + v + ' [' + lo + ',' + hi + '] dışında'); sum += v; }
    if (Math.abs(sum - 1) > G.allocationSumTolerance) errs.push('allocation toplamı 1 değil: ' + sum.toFixed(3));
    const phases = c.phases || [];
    if (!phases.length || phases.length > G.maxPhases) errs.push('faz sayısı 1..' + G.maxPhases + ' değil: ' + phases.length);
    const allowed = G.phasesByIntent[c.intent] || [];
    for (const ph of phases) { if (!allowed.includes(ph.name)) errs.push('faz "' + (ph && ph.name) + '" ' + c.intent + ' için geçersiz'); if (ph.until && !ph.until.split(/\s+OR\s+/i).every(t => G.phaseTriggers.includes(t.trim()) || /^\d+t$/.test(t.trim()))) errs.push('geçersiz tetikleyici: ' + ph.until); }
    if (c.abort) for (const ab of c.abort) if (!G.abortConditions.includes(ab)) errs.push('geçersiz abort: ' + ab);
    if (c.maxDurationTicks != null && (c.maxDurationTicks <= 0 || c.maxDurationTicks > G.maxDurationTicks)) errs.push('maxDurationTicks aralık dışı');
    return { valid: errs.length === 0, errors: errs };
}

// ── Üreteç: durumdan 16–64 geçerli aday ──────────────────────────────────────
function _opgPhases(intent) { return (OPERATION_GRAMMAR_V1.phasesByIntent[intent] || ['HOLD']).map((name, i, arr) => ({ name, until: i < arr.length - 1 ? 'timeout' : 'objective_taken OR timeout' })); }
function operationGrammarGenerate(ctx) {
    const G = OPERATION_GRAMMAR_V1;
    const role = ctx.role || 'ATTACKER';
    // rol'e uygun intent'ler — statik/savunma yedekleri ÖNCE (64 cap'inde starve olmasın),
    // sonra çok-varyantlı taarruz intent'leri.
    const order = ['HOLD', 'REGROUP', 'DISENGAGE', 'COUNTERATTACK', 'ADVANCE', 'FIX_AND_FLANK', 'MAIN_ATTACK'];
    const intents = order.filter(k => G.intents.includes(k) && (!G.intentRoles[k] || G.intentRoles[k].includes(role)));
    // hedef sektör adayları: düşman ağırlık merkezi, en zayıf/güçlü düşman sektörü + kendi ön hattı
    const targets = [...new Set([ctx.enemyCoG, ctx.weakestEnemySector, ctx.strongestEnemySector].filter(s => s != null))];
    if (!targets.length) { // temas yok → görev yönünde ileri sektör
        const fwdRow = ctx.side ? OPG_ROWS - 2 : 1;
        for (let cc = 1; cc < OPG_COLS - 1; cc += 2) targets.push(fwdRow * OPG_COLS + cc);
    }
    // allocation önayarları (dengeli / ana-ağır / kanat-ağır)
    const allocs = [
        { main: 0.55, fixing: 0.20, flank: 0.15, reserve: 0.10 },
        { main: 0.65, fixing: 0.15, flank: 0.05, reserve: 0.15 },
        { main: 0.35, fixing: 0.25, flank: 0.30, reserve: 0.10 },
    ];
    const out = [], seen = new Set();
    for (const intent of intents) {
        // sabit-postür intent'ler tek aday (sektör/allocation önemsiz)
        const staticIntent = (intent === 'HOLD' || intent === 'REGROUP' || intent === 'DISENGAGE');
        const tgtList = staticIntent ? [targets[0] ?? 0] : targets;
        const allocList = staticIntent ? [{ main: 0.40, fixing: 0.20, flank: 0.10, reserve: 0.30 }] : allocs;
        const tempoList = staticIntent ? ['normal'] : G.tempos;
        for (const mainSector of tgtList) for (const alloc of allocList) for (const tempo of tempoList) {
            const flankSector = staticIntent ? null : (opgSectorAdjacent(mainSector).sort((a, b) => (ctx.enemy[a] || 0) - (ctx.enemy[b] || 0))[0] ?? null);
            const pursuitLimit = tempo === 'aggressive' ? 500 : tempo === 'cautious' ? 150 : 300;
            const cand = { intent, mainSector, flankSector, allocation: alloc, tempo, pursuitLimit, phases: _opgPhases(intent), abort: ['force_ratio<0.5', 'ammo<0.25'], maxDurationTicks: G.maxDurationTicks };
            const key = intent + ':' + mainSector + ':' + flankSector + ':' + tempo + ':' + alloc.main;
            if (seen.has(key)) continue; seen.add(key);
            if (operationGrammarValidate(cand, ctx).valid) out.push(cand);
            if (out.length >= 64) return out;
        }
    }
    return out;
}

if (typeof module !== 'undefined') module.exports = { OPERATION_GRAMMAR_V1, opgSectorOf, opgSectorCenter, opgBuildContext, operationGrammarGenerate, operationGrammarValidate };
