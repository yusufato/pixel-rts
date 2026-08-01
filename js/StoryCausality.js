// ═══════════════════════════════════════════════════════════════════════════
//  HİKÂYE NEDENSELLİK DEFTERİ — Faz 9
//  ---------------------------------------------------------------------------
//  Kalıcı dünya değişimleri üç aşamada izlenir:
//      WorldCommand → WorldEvent → Effect
//
//  Bu defter simülasyonun kararını vermez. Kararı veren alan kapısının eski ve
//  yeni değerini, komutu ve kök nedeni kaybetmeden saklar. Böylece telemetri
//  değişimi sonradan tahmin etmek zorunda kalmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CAUSALITY_VERSION = 1;
const STORY_CAUSALITY_COMMAND_LIMIT = 180;
const STORY_CAUSALITY_EVENT_LIMIT = 360;
const STORY_CAUSALITY_EFFECT_LIMIT = 720;
const STORY_CAUSALITY_KEY_LIMIT = 500;
const STORY_CAUSALITY_WARNING_LIMIT = 120;
const STORY_CAUSALITY_MAX_DEPTH = 8;
const STORY_CAUSALITY_MAX_REPEAT = 3;
const STORY_CAUSALITY_EVENTS_PER_COMMAND = 32;
const STORY_CAUSALITY_EFFECTS_PER_COMMAND = 96;
const STORY_CAUSALITY_WINDOW_SECONDS = 1;
const STORY_CAUSALITY_COMMANDS_PER_WINDOW = 512;
const STORY_CAUSALITY_EVENTS_PER_WINDOW = 1024;
const STORY_CAUSALITY_EFFECTS_PER_WINDOW = 2048;

function storyCausalityEnabled() {
    return typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('causality.ledger');
}

function storyCausalityGuardsEnabled() {
    return storyCausalityEnabled()
        && (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('causality.guards'));
}

function storyCausalityRound(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 1000000) / 1000000 : null;
}

function storyCausalityClone(value) {
    if (value === undefined) return null;
    if (value === null || typeof value !== 'object') return value;
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return String(value); }
}

function storyCausalityReset(meta) {
    STORY.causality = {
        schemaVersion: STORY_CAUSALITY_VERSION,
        meta: Object.assign({
            campaignSeed: null,
            createdAtWorldTime: storyCausalityRound(STORY.clock || 0)
        }, meta || {}),
        nextCommandId: 1,
        nextEventId: 1,
        nextEffectId: 1,
        nextSequence: 1,
        commands: [],
        events: [],
        effects: [],
        resourceAggregates: {},
        welfareAggregates: {},
        idempotency: {},
        idempotencyOrder: [],
        droppedCommands: 0,
        droppedEvents: 0,
        droppedEffects: 0,
        guard: {
            schemaVersion: 1,
            windowSecond: -1,
            commandsInWindow: 0,
            eventsInWindow: 0,
            effectsInWindow: 0,
            blockedTotal: 0,
            blockedDepth: 0,
            blockedCycle: 0,
            blockedCommandBudget: 0,
            blockedEventBudget: 0,
            blockedEffectBudget: 0,
            invariantFailures: 0,
            invalidRestores: 0,
            lastBlock: null
        },
        warnings: []
    };
    STORY._causalityActive = null;
    return STORY.causality;
}

function storyCausalityEnsure() {
    const c = STORY.causality;
    if (!c || c.schemaVersion !== STORY_CAUSALITY_VERSION) {
        return storyCausalityReset({ restoredFromMissingLedger: true });
    }
    if (!Array.isArray(c.commands)) c.commands = [];
    if (!Array.isArray(c.events)) c.events = [];
    if (!Array.isArray(c.effects)) c.effects = [];
    if (!c.resourceAggregates || typeof c.resourceAggregates !== 'object') c.resourceAggregates = {};
    if (!c.welfareAggregates || typeof c.welfareAggregates !== 'object') c.welfareAggregates = {};
    if (!c.idempotency || typeof c.idempotency !== 'object') c.idempotency = {};
    if (!Array.isArray(c.idempotencyOrder)) c.idempotencyOrder = Object.keys(c.idempotency);
    if (!Array.isArray(c.warnings)) c.warnings = [];
    if (!c.guard || typeof c.guard !== 'object') c.guard = {};
    const guardDefaults = {
        schemaVersion: 1,
        windowSecond: -1,
        commandsInWindow: 0,
        eventsInWindow: 0,
        effectsInWindow: 0,
        blockedTotal: 0,
        blockedDepth: 0,
        blockedCycle: 0,
        blockedCommandBudget: 0,
        blockedEventBudget: 0,
        blockedEffectBudget: 0,
        invariantFailures: 0,
        invalidRestores: 0,
        lastBlock: null
    };
    for (const [key, value] of Object.entries(guardDefaults)) {
        if (c.guard[key] == null) c.guard[key] = value;
    }
    if (!Number.isFinite(c.nextCommandId)) c.nextCommandId = 1;
    if (!Number.isFinite(c.nextEventId)) c.nextEventId = 1;
    if (!Number.isFinite(c.nextEffectId)) c.nextEffectId = 1;
    if (!Number.isFinite(c.nextSequence)) c.nextSequence = 1;
    for (const key of ['droppedCommands', 'droppedEvents', 'droppedEffects']) {
        if (!Number.isFinite(c[key])) c[key] = 0;
    }
    return c;
}

function storyCausalityGuardWindow() {
    const guard = storyCausalityEnsure().guard;
    const nowWindow = Math.floor((Number(STORY.clock) || 0) / STORY_CAUSALITY_WINDOW_SECONDS);
    if (guard.windowSecond !== nowWindow) {
        guard.windowSecond = nowWindow;
        guard.commandsInWindow = 0;
        guard.eventsInWindow = 0;
        guard.effectsInWindow = 0;
    }
    return guard;
}

function storyCausalityWarn(code, detail) {
    const c = storyCausalityEnsure();
    const active = STORY._causalityActive;
    const warning = {
        time: storyCausalityRound(STORY.clock),
        code: String(code || 'CAUSALITY_WARNING'),
        commandId: active ? active.command.id : null,
        eventId: active ? active.event.id : null,
        detail: storyCausalityClone(detail || {})
    };
    c.warnings.push(warning);
    if (c.warnings.length > STORY_CAUSALITY_WARNING_LIMIT) {
        c.warnings.splice(0, c.warnings.length - STORY_CAUSALITY_WARNING_LIMIT);
    }
    return warning;
}

function storyCausalityGuardBlock(reason, spec, parent) {
    const guard = storyCausalityGuardWindow();
    guard.blockedTotal++;
    const counterByReason = {
        MAX_DEPTH: 'blockedDepth',
        CYCLE_REPEAT: 'blockedCycle',
        COMMAND_WINDOW_BUDGET: 'blockedCommandBudget',
        EVENT_COMMAND_BUDGET: 'blockedEventBudget',
        EVENT_WINDOW_BUDGET: 'blockedEventBudget',
        EFFECT_COMMAND_BUDGET: 'blockedEffectBudget',
        EFFECT_WINDOW_BUDGET: 'blockedEffectBudget'
    };
    const counter = counterByReason[reason];
    if (counter) guard[counter]++;
    guard.lastBlock = {
        time: storyCausalityRound(STORY.clock),
        reason,
        type: String(spec && (spec.eventType || spec.type) || 'unknown')
    };
    storyCausalityWarn(`GUARD_${reason}`, {
        type: String(spec && (spec.eventType || spec.type) || 'unknown'),
        target: storyCausalityEntity(spec && spec.target, 'unknown')
    });
    if (parent && parent.command) {
        if (!Array.isArray(parent.command.guardBlocks)) parent.command.guardBlocks = [];
        parent.command.guardBlocks.push(storyCausalityClone(guard.lastBlock));
    }
    return {
        applied: false,
        duplicate: false,
        disabled: false,
        guarded: true,
        status: 'BLOCKED',
        reason,
        commandId: parent && parent.command ? parent.command.id : null,
        eventId: null,
        result: false
    };
}

function storyCausalityTargetFingerprint(spec) {
    const target = storyCausalityEntity(spec && spec.target, 'unknown');
    return `${String(spec && (spec.eventType || spec.type) || 'unknown')}|${target ? `${target.type}:${target.id}` : '-'}`;
}

function storyCausalityActiveDepth(active) {
    let depth = -1;
    for (let cursor = active; cursor; cursor = cursor.parent) depth++;
    return depth;
}

function storyCausalityEffectInvariant(spec) {
    spec = spec || {};
    const path = String(spec.path || '');
    const operation = String(spec.operation || 'SET');
    if (operation !== 'SET' && operation !== 'DELTA') {
        return { code: 'INVALID_OPERATION', message: `Geçersiz etki işlemi: ${operation}` };
    }
    for (const [label, value] of [['before', spec.before], ['after', spec.after], ['delta', spec.delta]]) {
        if (typeof value === 'number' && !Number.isFinite(value)) {
            return { code: 'NON_FINITE_VALUE', message: `${label} sonlu değil.` };
        }
    }
    if (/\.ownerId$/.test(path)) {
        if (!Number.isInteger(spec.after) || typeof storyState !== 'function' || !storyState(spec.after)) {
            return { code: 'INVALID_OWNER', message: `Bilinmeyen bölge sahibi: ${spec.after}` };
        }
    } else if (/\.welfare$/.test(path)) {
        if (!Number.isFinite(Number(spec.after)) || Number(spec.after) < 0 || Number(spec.after) > 100) {
            return { code: 'WELFARE_RANGE', message: `Refah 0–100 dışında: ${spec.after}` };
        }
    } else if (/\.resources$/.test(path)) {
        const delta = spec.delta;
        if (!delta || typeof delta !== 'object') {
            return { code: 'RESOURCE_DELTA_REQUIRED', message: 'Kaynak etkisi tipli delta taşımalı.' };
        }
        for (const key of ['oil', 'manpower', 'points']) {
            if (!Number.isFinite(Number(delta[key]))) {
                return { code: 'RESOURCE_NON_FINITE', message: `${key} kaynak deltası sonlu değil.` };
            }
        }
    } else if (/\.node$/.test(path)) {
        if (!Number.isInteger(spec.after) || typeof storyNode !== 'function' || !storyNode(spec.after)) {
            return { code: 'INVALID_NODE', message: `Bilinmeyen komutan bölgesi: ${spec.after}` };
        }
    } else if (/\.value$/.test(path) && /^relation:/.test(path)) {
        if (!Number.isFinite(Number(spec.after)) || Number(spec.after) < -100 || Number(spec.after) > 100) {
            return { code: 'RELATION_RANGE', message: `İlişki -100–100 dışında: ${spec.after}` };
        }
    } else if (/\.treaty$/.test(path)) {
        if (typeof TREATIES !== 'undefined' && !Object.prototype.hasOwnProperty.call(TREATIES, spec.after)) {
            return { code: 'INVALID_TREATY', message: `Bilinmeyen antlaşma: ${spec.after}` };
        }
    } else if (/\.until$/.test(path)) {
        if (!Number.isFinite(Number(spec.after)) || Number(spec.after) < 0) {
            return { code: 'INVALID_EXPIRY', message: `Geçersiz antlaşma süresi: ${spec.after}` };
        }
    }
    return null;
}

function storyCausalityRejectInvariant(issue, spec) {
    const guard = storyCausalityGuardWindow();
    guard.invariantFailures++;
    guard.lastBlock = {
        time: storyCausalityRound(STORY.clock),
        reason: issue.code,
        type: 'invariant'
    };
    storyCausalityWarn(`INVARIANT_${issue.code}`, {
        message: issue.message,
        path: String(spec && spec.path || 'unknown'),
        after: storyCausalityClone(spec && spec.after),
        delta: storyCausalityClone(spec && spec.delta)
    });
    return false;
}

function storyCausalityCanAddEffect(spec) {
    if (!storyCausalityGuardsEnabled()) return true;
    const issue = storyCausalityEffectInvariant(spec);
    if (issue) return storyCausalityRejectInvariant(issue, spec);
    const active = STORY._causalityActive;
    if (!active) return false;
    const guard = storyCausalityGuardWindow();
    if (active.command.effectIds.length >= STORY_CAUSALITY_EFFECTS_PER_COMMAND) {
        storyCausalityGuardBlock('EFFECT_COMMAND_BUDGET', spec, active);
        return false;
    }
    if (guard.effectsInWindow >= STORY_CAUSALITY_EFFECTS_PER_WINDOW) {
        storyCausalityGuardBlock('EFFECT_WINDOW_BUDGET', spec, active);
        return false;
    }
    return true;
}

function storyCausalityEntity(value, fallbackType) {
    if (value == null) return null;
    if (typeof value === 'string' || typeof value === 'number') {
        return { type: fallbackType || 'unknown', id: value };
    }
    if (typeof value !== 'object' || value.id == null) return null;
    return {
        type: String(value.type || fallbackType || 'unknown'),
        id: value.id
    };
}

function storyCausalityPrune() {
    const c = storyCausalityEnsure();
    while (
        c.commands.length > STORY_CAUSALITY_COMMAND_LIMIT
        || c.events.length > STORY_CAUSALITY_EVENT_LIMIT
        || c.effects.length > STORY_CAUSALITY_EFFECT_LIMIT
    ) {
        const oldest = c.commands.shift();
        if (!oldest) {
            c.droppedEvents += c.events.length;
            c.droppedEffects += c.effects.length;
            c.events = [];
            c.effects = [];
            break;
        }
        c.droppedCommands++;
        const eventCount = c.events.length;
        const effectCount = c.effects.length;
        c.events = c.events.filter(event => event.commandId !== oldest.id);
        c.effects = c.effects.filter(effect => effect.commandId !== oldest.id);
        c.droppedEvents += eventCount - c.events.length;
        c.droppedEffects += effectCount - c.effects.length;
    }
    return c;
}

function storyCausalityRememberKey(key, receipt) {
    if (!key) return;
    const c = storyCausalityEnsure();
    c.idempotency[key] = {
        commandId: receipt.commandId,
        status: receipt.status,
        result: storyCausalityClone(receipt.result)
    };
    c.idempotencyOrder.push(key);
    while (c.idempotencyOrder.length > STORY_CAUSALITY_KEY_LIMIT) {
        const oldest = c.idempotencyOrder.shift();
        if (oldest != null) delete c.idempotency[oldest];
    }
}

function storyCausalityFindCommand(id) {
    return storyCausalityEnsure().commands.find(x => x.id === id) || null;
}

function storyCausalityFindEvent(id) {
    return storyCausalityEnsure().events.find(x => x.id === id) || null;
}

function storyCausalityFindEffect(id) {
    return storyCausalityEnsure().effects.find(x => x.id === id) || null;
}

function storyCausalityRecordEffect(spec) {
    if (!storyCausalityEnabled()) return null;
    const active = STORY._causalityActive;
    if (!active) return null;
    spec = spec || {};
    if (!storyCausalityCanAddEffect(spec)) return null;
    const c = storyCausalityEnsure();
    const effect = {
        schemaVersion: STORY_CAUSALITY_VERSION,
        id: `effect:${c.nextEffectId++}`,
        sequence: c.nextSequence++,
        time: storyCausalityRound(STORY.clock),
        commandId: active.command.id,
        eventId: active.event.id,
        target: storyCausalityEntity(spec.target, spec.targetType),
        path: String(spec.path || 'unknown'),
        operation: String(spec.operation || 'SET'),
        before: storyCausalityClone(spec.before),
        after: storyCausalityClone(spec.after),
        delta: storyCausalityClone(spec.delta == null ? null : spec.delta),
        source: String(spec.source || active.event.type),
        observed: !!spec.observed
    };
    c.effects.push(effect);
    active.event.effectIds.push(effect.id);
    active.command.effectIds.push(effect.id);
    if (storyCausalityGuardsEnabled()) storyCausalityGuardWindow().effectsInWindow++;
    return effect;
}

// Sürekli şehir geliri saniyede devlet başına bir komut üretirse defter,
// simülasyondan pahalı hâle gelir. Aynı kaynak ve devlet için 10 saniyelik
// pencere tek olay/etkide toplanır; toplam kaybolmaz, olay sırası korunur.
function storyCausalityAggregateResource(stateId, source, delta, meta) {
    if (!storyCausalityEnabled()) return null;
    const c = storyCausalityEnsure();
    const bucket = Math.floor((Number(STORY.clock) || 0) / 10);
    const key = `${stateId}:${String(source || 'unknown')}`;
    const aggregate = c.resourceAggregates[key];
    if (aggregate && aggregate.bucket === bucket) {
        const effect = storyCausalityFindEffect(aggregate.effectId);
        const event = storyCausalityFindEvent(aggregate.eventId);
        const command = storyCausalityFindCommand(aggregate.commandId);
        if (effect && event && command) {
            const next = {
                oil: storyCausalityRound((Number(effect.delta && effect.delta.oil) || 0) + (Number(delta.oil) || 0)),
                manpower: storyCausalityRound((Number(effect.delta && effect.delta.manpower) || 0) + (Number(delta.manpower) || 0)),
                points: storyCausalityRound((Number(effect.delta && effect.delta.points) || 0) + (Number(delta.points) || 0))
            };
            effect.delta = next;
            event.payload.delta = storyCausalityClone(next);
            command.payload.delta = storyCausalityClone(next);
            return effect;
        }
    }
    let madeEffect = null;
    const receipt = storyCausalityRun({
        type: 'resource.flow',
        eventType: 'resource.changed',
        actor: meta && meta.actor ? meta.actor : { type: 'state', id: stateId },
        target: { type: 'state', id: stateId },
        payload: {
            stateId,
            source: String(source || 'unknown'),
            delta: storyCausalityClone(delta),
            continuous: true,
            bucket
        },
        correlationId: meta && meta.correlationId ? meta.correlationId : null
    }, () => {
        madeEffect = storyCausalityRecordEffect({
            target: { type: 'state', id: stateId },
            path: `state:${stateId}.resources`,
            operation: 'DELTA',
            before: null,
            after: null,
            delta,
            source: String(source || 'unknown'),
            observed: true
        });
        return delta;
    });
    if (madeEffect) {
        c.resourceAggregates[key] = {
            bucket,
            commandId: receipt.commandId,
            eventId: receipt.eventId,
            effectId: madeEffect.id
        };
    }
    return madeEffect;
}

function storyCausalityApplyContinuousWelfare(st, source, before, after, requested, applied, suppressed, meta) {
    if (!storyCausalityEnabled()) {
        st.welfare = after;
        return { duplicate: false, result: applied };
    }
    const c = storyCausalityEnsure();
    const bucket = Math.floor((Number(STORY.clock) || 0) / 10);
    const key = `${st.id}:${String(source || 'unknown')}`;
    const aggregate = c.welfareAggregates[key];
    if (aggregate && aggregate.bucket === bucket) {
        const effect = storyCausalityFindEffect(aggregate.effectId);
        const event = storyCausalityFindEvent(aggregate.eventId);
        const command = storyCausalityFindCommand(aggregate.commandId);
        if (effect && event && command) {
            st.welfare = after;
            effect.after = storyCausalityClone(after);
            effect.delta = storyCausalityRound((Number(effect.delta) || 0) + applied);
            for (const record of [event.payload, command.payload]) {
                record.requested = storyCausalityRound((Number(record.requested) || 0) + requested);
                record.applied = storyCausalityRound((Number(record.applied) || 0) + applied);
                record.suppressed = storyCausalityRound((Number(record.suppressed) || 0) + suppressed);
                record.after = storyCausalityRound(after);
            }
            return { duplicate: false, result: applied, aggregate: true };
        }
    }
    let madeEffect = null;
    const receipt = storyCausalityRun({
        type: 'welfare.adjust',
        eventType: 'welfare.changed',
        actor: meta && meta.actor ? meta.actor : { type: 'system', id: String(source || 'unknown') },
        target: { type: 'state', id: st.id },
        payload: {
            stateId: st.id,
            source: String(source || 'unknown'),
            requested: storyCausalityRound(requested),
            applied: storyCausalityRound(applied),
            suppressed: storyCausalityRound(suppressed),
            before: storyCausalityRound(before),
            after: storyCausalityRound(after),
            continuous: true,
            bucket
        },
        correlationId: meta && meta.correlationId ? meta.correlationId : null
    }, () => {
        storyCausalitySet(st, 'welfare', after, {
            target: { type: 'state', id: st.id },
            path: `state:${st.id}.welfare`,
            source: String(source || 'unknown')
        });
        madeEffect = STORY._causalityActive
            ? storyCausalityFindEffect(STORY._causalityActive.event.effectIds.slice(-1)[0])
            : null;
        if (madeEffect) madeEffect.delta = storyCausalityRound(applied);
        return applied;
    });
    if (madeEffect) {
        c.welfareAggregates[key] = {
            bucket,
            commandId: receipt.commandId,
            eventId: receipt.eventId,
            effectId: madeEffect.id
        };
    }
    return receipt;
}

function storyCausalitySet(target, key, value, spec) {
    if (!target || key == null) return false;
    const before = target[key];
    if (Object.is(before, value)) return false;
    const effectSpec = Object.assign({}, spec || {}, {
        before,
        after: value,
        operation: 'SET'
    });
    if (storyCausalityEnabled() && !storyCausalityCanAddEffect(effectSpec)) return false;
    target[key] = value;
    storyCausalityRecordEffect(effectSpec);
    return true;
}

function storyCausalityRun(spec, mutator) {
    spec = spec || {};
    if (typeof mutator !== 'function') throw new Error('WorldCommand mutator zorunlu.');
    const type = String(spec.type || '').trim();
    if (!type) throw new Error('WorldCommand type zorunlu.');
    if (!storyCausalityEnabled()) {
        return {
            applied: true,
            duplicate: false,
            disabled: true,
            status: 'APPLIED',
            commandId: null,
            eventId: null,
            result: mutator(null)
        };
    }

    const c = storyCausalityEnsure();
    const idempotencyKey = spec.idempotencyKey == null
        ? null
        : String(spec.idempotencyKey).trim();
    if (spec.idempotencyKey != null && !idempotencyKey) {
        throw new Error('WorldCommand idempotencyKey boş olamaz.');
    }
    if (idempotencyKey && c.idempotency[idempotencyKey]) {
        const old = c.idempotency[idempotencyKey];
        return {
            applied: false,
            duplicate: true,
            disabled: false,
            status: old.status,
            commandId: old.commandId,
            eventId: null,
            result: storyCausalityClone(old.result)
        };
    }

    const parent = STORY._causalityActive;
    const depth = parent ? storyCausalityActiveDepth(parent) + 1 : 0;
    const fingerprint = storyCausalityTargetFingerprint(spec);
    if (storyCausalityGuardsEnabled()) {
        const guard = storyCausalityGuardWindow();
        if (!parent && guard.commandsInWindow >= STORY_CAUSALITY_COMMANDS_PER_WINDOW) {
            return storyCausalityGuardBlock('COMMAND_WINDOW_BUDGET', spec, parent);
        }
        if (depth > STORY_CAUSALITY_MAX_DEPTH) {
            return storyCausalityGuardBlock('MAX_DEPTH', spec, parent);
        }
        let repeats = 1;
        for (let cursor = parent; cursor; cursor = cursor.parent) {
            if (cursor.fingerprint === fingerprint) repeats++;
        }
        if (repeats > STORY_CAUSALITY_MAX_REPEAT) {
            return storyCausalityGuardBlock('CYCLE_REPEAT', spec, parent);
        }
        if (parent && parent.command.eventIds.length >= STORY_CAUSALITY_EVENTS_PER_COMMAND) {
            return storyCausalityGuardBlock('EVENT_COMMAND_BUDGET', spec, parent);
        }
        if (guard.eventsInWindow >= STORY_CAUSALITY_EVENTS_PER_WINDOW) {
            return storyCausalityGuardBlock('EVENT_WINDOW_BUDGET', spec, parent);
        }
    }
    let command = parent ? parent.command : null;
    if (!command) {
        command = {
            schemaVersion: STORY_CAUSALITY_VERSION,
            id: `command:${c.nextCommandId++}`,
            sequence: c.nextSequence++,
            time: storyCausalityRound(STORY.clock),
            type,
            actor: storyCausalityEntity(spec.actor, 'system'),
            target: storyCausalityEntity(spec.target, 'world'),
            payload: storyCausalityClone(spec.payload || {}),
            idempotencyKey,
            correlationId: spec.correlationId == null ? null : String(spec.correlationId),
            parentCommandId: spec.parentCommandId || null,
            rootCommandId: spec.rootCommandId || null,
            status: 'PENDING',
            eventIds: [],
            effectIds: [],
            guardBlocks: [],
            result: null,
            error: null
        };
        command.rootCommandId = command.rootCommandId || command.id;
        c.commands.push(command);
        if (storyCausalityGuardsEnabled()) storyCausalityGuardWindow().commandsInWindow++;
    }

    const event = {
        schemaVersion: STORY_CAUSALITY_VERSION,
        id: `world-event:${c.nextEventId++}`,
        sequence: c.nextSequence++,
        time: storyCausalityRound(STORY.clock),
        type: String(spec.eventType || type),
        commandId: command.id,
        correlationId: spec.correlationId == null
            ? command.correlationId
            : String(spec.correlationId),
        causeEventId: spec.causeEventId || (parent ? parent.event.id : null),
        rootEventId: parent ? parent.event.rootEventId : null,
        payload: storyCausalityClone(spec.payload || {}),
        depth,
        status: 'PENDING',
        effectIds: []
    };
    event.rootEventId = event.rootEventId || event.id;
    c.events.push(event);
    command.eventIds.push(event.id);
    if (storyCausalityGuardsEnabled()) storyCausalityGuardWindow().eventsInWindow++;

    STORY._causalityActive = { command, event, parent, depth, fingerprint };
    try {
        const result = mutator({ command, event });
        event.status = 'APPLIED';
        if (!parent) {
            command.status = 'APPLIED';
            command.result = storyCausalityClone(result);
            storyCausalityRememberKey(idempotencyKey, {
                commandId: command.id,
                status: command.status,
                result
            });
        }
        return {
            applied: true,
            duplicate: false,
            disabled: false,
            status: 'APPLIED',
            commandId: command.id,
            eventId: event.id,
            result
        };
    } catch (error) {
        event.status = 'FAILED';
        if (!parent) {
            command.status = 'FAILED';
            command.error = String(error && error.message ? error.message : error);
            storyCausalityRememberKey(idempotencyKey, {
                commandId: command.id,
                status: command.status,
                result: null
            });
        }
        throw error;
    } finally {
        STORY._causalityActive = parent || null;
        if (!parent) storyCausalityPrune();
    }
}

function storyTransferNodeOwnership(nodeOrId, toStateId, meta) {
    const node = typeof nodeOrId === 'object' ? nodeOrId : storyNode(nodeOrId);
    if (!node || !storyState(toStateId) || node.owner === toStateId) return false;
    meta = meta || {};
    const fromStateId = node.owner;
    const receipt = storyCausalityRun({
        type: 'territory.transfer',
        eventType: meta.eventType || 'territory.owner_changed',
        actor: meta.actor || { type: 'state', id: toStateId },
        target: { type: 'region', id: node.id },
        payload: Object.assign({
            nodeId: node.id,
            fromStateId,
            toStateId,
            reason: meta.reason || 'unknown'
        }, meta.payload || {}),
        idempotencyKey: meta.idempotencyKey,
        correlationId: meta.correlationId || `territory:${node.id}:${storyCausalityRound(STORY.clock)}`
    }, ctx => {
        const changed = storyCausalitySet(node, 'owner', toStateId, {
            target: { type: 'region', id: node.id },
            path: `region:${node.id}.ownerId`,
            source: meta.reason || 'territory.transfer'
        });
        if (!changed) return false;
        if (typeof storyPoliticalOverlayInvalidate === 'function') {
            storyPoliticalOverlayInvalidate('territory-transfer');
        }
        if (typeof storyCityRename === 'function') storyCityRename(node);
        if (Array.isArray(STORY._telemetryOwnerSnapshot)) {
            STORY._telemetryOwnerSnapshot[node.id] = toStateId;
        }
        if (typeof storyTelemetryEvent === 'function') {
            storyTelemetryEvent('territory.owner_changed', {
                nodeId: node.id,
                fromStateId,
                toStateId,
                causalityCommandId: ctx ? ctx.command.id : null,
                causalityEventId: ctx ? ctx.event.id : null
            }, {
                correlationId: meta.correlationId || `territory:${node.id}:${storyCausalityRound(STORY.clock)}`
            });
        }
        return true;
    });
    return receipt.duplicate ? false : !!receipt.result;
}

function storyMoveCommander(commander, toNodeId, meta) {
    if (!commander || !storyNode(toNodeId) || commander.node === toNodeId) return false;
    meta = meta || {};
    const fromNodeId = commander.node;
    const receipt = storyCausalityRun({
        type: 'military.commander_move',
        eventType: meta.eventType || 'military.commander_moved',
        actor: meta.actor || { type: 'character', id: commander.id },
        target: { type: 'region', id: toNodeId },
        payload: {
            commanderId: commander.id,
            fromNodeId,
            toNodeId,
            reason: meta.reason || 'movement'
        },
        idempotencyKey: meta.idempotencyKey,
        correlationId: meta.correlationId || null
    }, () => storyCausalitySet(commander, 'node', toNodeId, {
        target: { type: 'character', id: commander.id },
        path: `character:${commander.id}.node`,
        source: meta.reason || 'movement'
    }));
    return receipt.duplicate ? false : !!receipt.result;
}

function storyCausalityTrace(id) {
    const c = storyCausalityEnsure();
    let command = storyCausalityFindCommand(id);
    let event = storyCausalityFindEvent(id);
    const effect = storyCausalityFindEffect(id);
    if (effect) event = storyCausalityFindEvent(effect.eventId);
    if (event) command = storyCausalityFindCommand(event.commandId);
    return storyCausalityClone({
        command,
        event,
        effect,
        rootEvent: event ? storyCausalityFindEvent(event.rootEventId) : null,
        childEvents: command ? c.events.filter(x => x.commandId === command.id) : [],
        effects: command ? c.effects.filter(x => x.commandId === command.id) : []
    });
}

function storyCausalityValidate(ledger) {
    const c = ledger || storyCausalityEnsure();
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
        return { ok: false, issues: [{ code: 'LEDGER_OBJECT_REQUIRED', path: '$', message: 'Nedensellik defteri nesne olmalı.' }] };
    }
    if (c.schemaVersion !== STORY_CAUSALITY_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', `Beklenen nedensellik sürümü ${STORY_CAUSALITY_VERSION}.`);
    }
    for (const key of ['commands', 'events', 'effects']) {
        if (!Array.isArray(c[key])) add('ARRAY_REQUIRED', `$.${key}`, `${key} dizi olmalı.`);
    }
    if (issues.length) return { ok: false, issues };
    if (c.commands.length > STORY_CAUSALITY_COMMAND_LIMIT) add('COMMAND_LIMIT', '$.commands', 'Komut döner pencere sınırı aşılmış.');
    if (c.events.length > STORY_CAUSALITY_EVENT_LIMIT) add('EVENT_LIMIT', '$.events', 'Olay döner pencere sınırı aşılmış.');
    if (c.effects.length > STORY_CAUSALITY_EFFECT_LIMIT) add('EFFECT_LIMIT', '$.effects', 'Etki döner pencere sınırı aşılmış.');

    const commandIds = new Set();
    const eventIds = new Set();
    const effectIds = new Set();
    const checkRows = (rows, kind, ids) => {
        let lastSequence = -Infinity;
        rows.forEach((row, index) => {
            const at = `$.${kind}[${index}]`;
            if (!row || typeof row !== 'object') {
                add('ROW_OBJECT_REQUIRED', at, 'Defter satırı nesne olmalı.');
                return;
            }
            if (typeof row.id !== 'string' || !row.id) add('INVALID_ID', `${at}.id`, 'Kalıcı kimlik zorunlu.');
            else if (ids.has(row.id)) add('DUPLICATE_ID', `${at}.id`, `Yinelenen kimlik: ${row.id}`);
            else ids.add(row.id);
            if (!Number.isFinite(Number(row.sequence)) || Number(row.sequence) <= lastSequence) {
                add('SEQUENCE_ORDER', `${at}.sequence`, 'Sıra numarası kesin artmalı.');
            }
            lastSequence = Number(row.sequence);
        });
    };
    checkRows(c.commands, 'commands', commandIds);
    checkRows(c.events, 'events', eventIds);
    checkRows(c.effects, 'effects', effectIds);

    c.commands.forEach((command, index) => {
        const at = `$.commands[${index}]`;
        if (!Array.isArray(command.eventIds) || !Array.isArray(command.effectIds)) {
            add('COMMAND_REFERENCES_REQUIRED', at, 'Komut olay ve etki kimlik dizileri taşımalı.');
            return;
        }
        if (command.eventIds.length > STORY_CAUSALITY_EVENTS_PER_COMMAND) {
            add('COMMAND_EVENT_BUDGET', `${at}.eventIds`, 'Komut olay bütçesini aşmış.');
        }
        if (command.effectIds.length > STORY_CAUSALITY_EFFECTS_PER_COMMAND) {
            add('COMMAND_EFFECT_BUDGET', `${at}.effectIds`, 'Komut etki bütçesini aşmış.');
        }
        for (const id of command.eventIds) if (!eventIds.has(id)) add('BROKEN_EVENT_REFERENCE', `${at}.eventIds`, `Bilinmeyen olay: ${id}`);
        for (const id of command.effectIds) if (!effectIds.has(id)) add('BROKEN_EFFECT_REFERENCE', `${at}.effectIds`, `Bilinmeyen etki: ${id}`);
    });
    c.events.forEach((event, index) => {
        const at = `$.events[${index}]`;
        if (!commandIds.has(event.commandId)) add('BROKEN_COMMAND_REFERENCE', `${at}.commandId`, `Bilinmeyen komut: ${event.commandId}`);
        if (event.causeEventId != null && !eventIds.has(event.causeEventId)) add('BROKEN_CAUSE_REFERENCE', `${at}.causeEventId`, `Bilinmeyen neden olayı: ${event.causeEventId}`);
        if (event.rootEventId != null && !eventIds.has(event.rootEventId)) add('BROKEN_ROOT_REFERENCE', `${at}.rootEventId`, `Bilinmeyen kök olay: ${event.rootEventId}`);
        if (event.depth != null && (!Number.isInteger(event.depth) || event.depth < 0 || event.depth > STORY_CAUSALITY_MAX_DEPTH)) {
            add('INVALID_DEPTH', `${at}.depth`, `Olay derinliği 0–${STORY_CAUSALITY_MAX_DEPTH} dışında.`);
        }
        for (const id of (event.effectIds || [])) if (!effectIds.has(id)) add('BROKEN_EFFECT_REFERENCE', `${at}.effectIds`, `Bilinmeyen etki: ${id}`);
    });
    c.effects.forEach((effect, index) => {
        const at = `$.effects[${index}]`;
        if (!commandIds.has(effect.commandId)) add('BROKEN_COMMAND_REFERENCE', `${at}.commandId`, `Bilinmeyen komut: ${effect.commandId}`);
        if (!eventIds.has(effect.eventId)) add('BROKEN_EVENT_REFERENCE', `${at}.eventId`, `Bilinmeyen olay: ${effect.eventId}`);
        const invariant = storyCausalityEffectInvariant(effect);
        if (invariant) add(invariant.code, at, invariant.message);
    });
    return { ok: issues.length === 0, issues };
}

function storyCausalityResolveCurrentValue(effect) {
    const path = String(effect && effect.path || '');
    let match = /^region:(-?\d+)\.ownerId$/.exec(path);
    if (match && typeof storyNode === 'function') {
        const node = storyNode(Number(match[1]));
        return node ? { known: true, value: node.owner } : { known: false };
    }
    match = /^state:(-?\d+)\.welfare$/.exec(path);
    if (match && typeof storyState === 'function') {
        const st = storyState(Number(match[1]));
        return st ? { known: true, value: st.welfare } : { known: false };
    }
    match = /^relation:([^\.]+)\.(value|treaty|until)$/.exec(path);
    if (match) {
        const relation = STORY.rel && STORY.rel[match[1]];
        return relation ? { known: true, value: relation[match[2] === 'value' ? 'v' : match[2]] } : { known: false };
    }
    return { known: false };
}

function storyCausalityValidateWorldConsistency(ledger) {
    const c = ledger || storyCausalityEnsure();
    const issues = [];
    const latestByPath = new Map();
    for (const effect of (c.effects || [])) {
        if (effect && effect.operation === 'SET') {
            const previous = latestByPath.get(effect.path);
            if (!previous || Number(effect.sequence) > Number(previous.sequence)) {
                latestByPath.set(effect.path, effect);
            }
        }
    }
    for (const [path, effect] of latestByPath) {
        const current = storyCausalityResolveCurrentValue(effect);
        if (!current.known) continue;
        const equal = typeof current.value === 'number' && typeof effect.after === 'number'
            ? Math.abs(current.value - effect.after) <= 1e-9
            : Object.is(current.value, effect.after);
        if (!equal) {
            issues.push({
                code: 'WORLD_LEDGER_MISMATCH',
                path,
                effectId: effect.id,
                expected: storyCausalityClone(effect.after),
                actual: storyCausalityClone(current.value)
            });
        }
    }
    return { ok: issues.length === 0, issues };
}

function storyCausalitySnapshot() {
    return storyCausalityClone(storyCausalityEnsure());
}

function storyCausalityForSave() {
    return storyCausalitySnapshot();
}

function storyCausalityRestore(saved) {
    if (!saved || saved.schemaVersion !== STORY_CAUSALITY_VERSION) {
        return storyCausalityReset({ restoredFromMissingLedger: true });
    }
    STORY.causality = storyCausalityClone(saved);
    STORY._causalityActive = null;
    storyCausalityEnsure();
    const validation = storyCausalityValidate(STORY.causality);
    if (!validation.ok) {
        const previousInvalidRestores = Number(saved.guard && saved.guard.invalidRestores) || 0;
        storyCausalityReset({
            restoredFromInvalidLedger: true,
            validationIssues: validation.issues.slice(0, 20)
        });
        STORY.causality.guard.invalidRestores = previousInvalidRestores + 1;
        storyCausalityWarn('RESTORE_INVALID_LEDGER', {
            issueCount: validation.issues.length,
            issues: validation.issues.slice(0, 10)
        });
    }
    return storyCausalityEnsure();
}
