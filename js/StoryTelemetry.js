// ═══════════════════════════════════════════════════════════════════════════
//  HİKÂYE DÜNYASI TELEMETRİSİ — Faz 2 gözlem hattı
//  ---------------------------------------------------------------------------
//  Dünya matematiğini belirlemez. Gerçekleşmiş değişimleri ham, sürümlü ve
//  sınırlı bir deftere yazar. LLM bu dosyaya veya dünya değerlerine yazamaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_TELEMETRY_VERSION = 1;
const STORY_TELEMETRY_EVENT_LIMIT = 2500;
const STORY_TELEMETRY_SAMPLE_LIMIT = 720;
const STORY_WELFARE_LEDGER_LIMIT = 300;
const STORY_WELFARE_CONTINUOUS_RATE = 0.12;   // devlet başına azami sürekli kayıp / dünya saniyesi
const STORY_WELFARE_CONTINUOUS_BURST = 0.36;  // farklı tick aralıklarının küçük birikim payı
const STORY_TELEMETRY_PERF_LIMIT = 600;

function storyTelemetryRound(value, digits = 4) {
    if (!Number.isFinite(Number(value))) return 0;
    const p = Math.pow(10, digits);
    return Math.round(Number(value) * p) / p;
}

function storyTelemetryStateId(stateOrId) {
    if (Number.isInteger(stateOrId)) return stateOrId;
    return stateOrId && Number.isInteger(stateOrId.id) ? stateOrId.id : -1;
}

function storyTelemetryState(stateOrId) {
    const id = storyTelemetryStateId(stateOrId);
    return id >= 0 && typeof storyState === 'function' ? storyState(id) : null;
}

function storyTelemetryActiveStateIds() {
    const ids = new Set();
    for (const node of (STORY.nodes || [])) {
        if (Number.isInteger(node.owner)) ids.add(node.owner);
    }
    return Array.from(ids).sort((a, b) => a - b);
}

function storyTelemetryUnrest(st) {
    if (!st || !st.factions) return 0;
    if (typeof storyFacUnrest === 'function') return storyFacUnrest(st);
    const f = st.factions;
    const values = [f.workers, f.business, f.military, f.intel].map(Number).filter(Number.isFinite);
    if (!values.length) return 0;
    return Math.max(0, (50 - Math.min(...values)) * 0.6 + Math.max(0, (Number(f.radicals) || 0) - 50) * 0.5);
}

// Tarayıcıda eşzamanlı kriptografik özet yok; tekrar üretilebilirlik kontrolü için
// sıralı, sayısal dünya özeti üzerinde FNV-1a kullanılır. Telemetri/perf bu özete
// bilerek girmez: ölçümün kendisi dünyayı değiştirmiş gibi görünmemelidir.
function storyTelemetryStateHash() {
    const states = (STORY.states || []).map(st => [
        st.id,
        storyTelemetryRound(st.welfare, 3),
        storyTelemetryRound(st.inflation, 3),
        storyTelemetryRound(st.res && st.res.oil, 2),
        storyTelemetryRound(st.res && st.res.manpower, 2),
        storyTelemetryRound(st.res && st.res.points, 2)
    ]);
    const nodes = (STORY.nodes || []).map(node => [
        node.id, node.owner, node.level || 1, node.garrison || 0,
        node.fac || 0, node.bar || 0
    ]);
    const rng = typeof storyRngSnapshot === 'function'
        ? storyRngSnapshot().streams
        : null;
    const scheduler = typeof storySchedulerSnapshot === 'function'
        ? storySchedulerSnapshot()
        : null;
    const text = JSON.stringify([
        storyTelemetryRound(STORY.clock, 3),
        states,
        nodes,
        rng,
        scheduler
    ]);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function storyTelemetrySample() {
    const resources = { oil: 0, manpower: 0, points: 0 };
    const states = (STORY.states || []).map(st => {
        resources.oil += Number(st.res && st.res.oil) || 0;
        resources.manpower += Number(st.res && st.res.manpower) || 0;
        resources.points += Number(st.res && st.res.points) || 0;
        return {
            id: st.id,
            welfare: storyTelemetryRound(st.welfare),
            inflation: storyTelemetryRound(st.inflation),
            unrest: storyTelemetryRound(storyTelemetryUnrest(st)),
            territory: (STORY.nodes || []).reduce((n, node) => n + (node.owner === st.id ? 1 : 0), 0)
        };
    });
    return {
        time: storyTelemetryRound(STORY.clock),
        stateHash: storyTelemetryStateHash(),
        activeStateIds: storyTelemetryActiveStateIds(),
        resources: {
            oil: storyTelemetryRound(resources.oil),
            manpower: storyTelemetryRound(resources.manpower),
            points: storyTelemetryRound(resources.points)
        },
        states
    };
}

function storyTelemetryReset(meta) {
    STORY.telemetry = {
        schemaVersion: STORY_TELEMETRY_VERSION,
        createdAtWorldTime: storyTelemetryRound(STORY.clock),
        meta: Object.assign({
            mode: 'story',
            stateCount: (STORY.states || []).length,
            nodeCount: (STORY.nodes || []).length,
            featureFlags: typeof storyFeatureSnapshot === 'function' ? storyFeatureSnapshot() : {}
        }, meta || {}),
        nextEventId: 1,
        events: [],
        samples: [],
        counters: {},
        welfareTotals: {},
        resourceTotals: {},
        performance: {
            stepCount: 0,
            totalMs: 0,
            maxMs: 0,
            over16Ms: 0,
            over33Ms: 0,
            recentMs: []
        },
        droppedEvents: 0
    };
    STORY._telemetryOwnerSnapshot = (STORY.nodes || []).map(node => node.owner);
    STORY._telemetryActiveStates = storyTelemetryActiveStateIds();
    STORY._telemetryNextSample = Number(STORY.clock) || 0;
    STORY._welfareLedger = [];
    STORY._welfareBudgets = {};
    storyTelemetryRecordSample(true);
    return STORY.telemetry;
}

function storyTelemetryEnsure() {
    if (!STORY.telemetry || STORY.telemetry.schemaVersion !== STORY_TELEMETRY_VERSION) {
        return storyTelemetryReset({ restoredFromMissingTelemetry: true });
    }
    if (!Array.isArray(STORY.telemetry.events)) STORY.telemetry.events = [];
    if (!Array.isArray(STORY.telemetry.samples)) STORY.telemetry.samples = [];
    if (!STORY.telemetry.counters) STORY.telemetry.counters = {};
    if (!STORY.telemetry.welfareTotals) STORY.telemetry.welfareTotals = {};
    if (!STORY.telemetry.resourceTotals) STORY.telemetry.resourceTotals = {};
    if (!STORY.telemetry.performance) {
        STORY.telemetry.performance = {
            stepCount: 0, totalMs: 0, maxMs: 0,
            over16Ms: 0, over33Ms: 0, recentMs: []
        };
    }
    if (!Array.isArray(STORY.telemetry.performance.recentMs)) STORY.telemetry.performance.recentMs = [];
    if (!Number.isFinite(STORY.telemetry.nextEventId)) STORY.telemetry.nextEventId = 1;
    if (!Array.isArray(STORY._welfareLedger)) STORY._welfareLedger = [];
    if (!STORY._welfareBudgets) STORY._welfareBudgets = {};
    return STORY.telemetry;
}

function storyTelemetryEvent(type, payload, meta) {
    const telemetry = storyTelemetryEnsure();
    if (typeof storyFeatureEnabled === 'function' && !storyFeatureEnabled('telemetry.world')) return null;
    const event = {
        schemaVersion: STORY_TELEMETRY_VERSION,
        id: telemetry.nextEventId++,
        time: storyTelemetryRound(STORY.clock),
        type: String(type || 'unknown'),
        correlationId: meta && meta.correlationId ? String(meta.correlationId) : null,
        causeEventId: meta && Number.isFinite(meta.causeEventId) ? meta.causeEventId : null,
        payload: payload || {}
    };
    telemetry.events.push(event);
    telemetry.counters[event.type] = (telemetry.counters[event.type] || 0) + 1;
    if (telemetry.events.length > STORY_TELEMETRY_EVENT_LIMIT) {
        const remove = telemetry.events.length - STORY_TELEMETRY_EVENT_LIMIT;
        telemetry.events.splice(0, remove);
        telemetry.droppedEvents += remove;
    }
    return event;
}

function storyResourceFlow(stateOrId, source, delta, meta) {
    const st = storyTelemetryState(stateOrId);
    if (!st || !delta) return null;
    const clean = {
        oil: storyTelemetryRound(Number(delta.oil) || 0),
        manpower: storyTelemetryRound(Number(delta.manpower) || 0),
        points: storyTelemetryRound(Number(delta.points) || 0)
    };
    if (!clean.oil && !clean.manpower && !clean.points) return null;
    meta = meta || {};
    if (meta.continuous && typeof storyCausalityAggregateResource === 'function') {
        storyCausalityAggregateResource(st.id, source, clean, meta);
    } else if (typeof storyCausalityRun === 'function') {
        const receipt = storyCausalityRun({
            type: 'resource.flow',
            eventType: 'resource.changed',
            actor: meta.actor || { type: 'state', id: st.id },
            target: { type: 'state', id: st.id },
            payload: {
                stateId: st.id,
                source: String(source || 'unknown'),
                delta: clean,
                continuous: !!meta.continuous
            },
            idempotencyKey: meta.idempotencyKey,
            correlationId: meta.correlationId || null
        }, () => {
            storyCausalityRecordEffect({
                target: { type: 'state', id: st.id },
                path: `state:${st.id}.resources`,
                operation: 'DELTA',
                before: null,
                after: null,
                delta: clean,
                source: String(source || 'unknown'),
                observed: true
            });
            return clean;
        });
        if (receipt.duplicate) return null;
    }
    if (typeof storyFeatureEnabled === 'function' && !storyFeatureEnabled('telemetry.resources')) return clean;
    const telemetry = storyTelemetryEnsure();
    const key = `${st.id}:${String(source || 'unknown')}`;
    const total = telemetry.resourceTotals[key] || (telemetry.resourceTotals[key] = {
        stateId: st.id,
        source: String(source || 'unknown'),
        oil: 0,
        manpower: 0,
        points: 0,
        count: 0
    });
    total.oil = storyTelemetryRound(total.oil + clean.oil);
    total.manpower = storyTelemetryRound(total.manpower + clean.manpower);
    total.points = storyTelemetryRound(total.points + clean.points);
    total.count++;
    telemetry.counters['resource.flow'] = (telemetry.counters['resource.flow'] || 0) + 1;
    if (!(meta && meta.continuous)) {
        storyTelemetryEvent('resource.flow', {
            stateId: st.id,
            source: total.source,
            delta: clean
        }, meta);
    }
    return clean;
}

function storyTelemetryRecordStepDuration(durationMs) {
    if (typeof storyFeatureEnabled === 'function' && !storyFeatureEnabled('telemetry.performance')) return;
    const ms = Number(durationMs);
    if (!Number.isFinite(ms) || ms < 0) return;
    const perf = storyTelemetryEnsure().performance;
    perf.stepCount++;
    perf.totalMs = storyTelemetryRound(perf.totalMs + ms, 3);
    perf.maxMs = Math.max(perf.maxMs || 0, storyTelemetryRound(ms, 3));
    if (ms > 16) perf.over16Ms++;
    if (ms > 33) perf.over33Ms++;
    perf.recentMs.push(storyTelemetryRound(ms, 3));
    if (perf.recentMs.length > STORY_TELEMETRY_PERF_LIMIT) perf.recentMs.shift();
}

function storyTelemetryPerformanceSummary() {
    const perf = storyTelemetryEnsure().performance;
    const sorted = perf.recentMs.slice().sort((a, b) => a - b);
    const percentile = p => sorted.length
        ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]
        : 0;
    return {
        stepCount: perf.stepCount,
        averageMs: perf.stepCount ? storyTelemetryRound(perf.totalMs / perf.stepCount, 3) : 0,
        maxMs: storyTelemetryRound(perf.maxMs, 3),
        p50Ms: percentile(0.50),
        p95Ms: percentile(0.95),
        p99Ms: percentile(0.99),
        over16Ms: perf.over16Ms,
        over33Ms: perf.over33Ms
    };
}

function storyTelemetryRecordSample(force) {
    const telemetry = storyTelemetryEnsure();
    const now = Number(STORY.clock) || 0;
    if (!force && now + 1e-9 < (STORY._telemetryNextSample || 0)) return null;
    const sample = storyTelemetrySample();
    telemetry.samples.push(sample);
    if (telemetry.samples.length > STORY_TELEMETRY_SAMPLE_LIMIT) telemetry.samples.shift();
    STORY._telemetryNextSample = now + 10;
    return sample;
}

function storyWelfareDelta(stateOrId, source, amount, meta) {
    const st = storyTelemetryState(stateOrId);
    const requested = Number(amount);
    if (!st || !Number.isFinite(requested) || requested === 0) return 0;
    meta = meta || {};

    let applied = requested;
    let suppressed = 0;
    if (requested < 0 && meta.continuous
        && (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('welfare.continuousCap'))) {
        const now = Number(STORY.clock) || 0;
        const key = String(st.id);
        const budgets = STORY._welfareBudgets || (STORY._welfareBudgets = {});
        const budget = budgets[key] || (budgets[key] = {
            tokens: STORY_WELFARE_CONTINUOUS_BURST,
            lastTime: now
        });
        const elapsed = Math.max(0, now - budget.lastTime);
        budget.tokens = Math.min(
            STORY_WELFARE_CONTINUOUS_BURST,
            budget.tokens + elapsed * STORY_WELFARE_CONTINUOUS_RATE
        );
        budget.lastTime = now;
        const wanted = -requested;
        const allowed = Math.min(wanted, budget.tokens);
        budget.tokens -= allowed;
        applied = -allowed;
        suppressed = wanted - allowed;
    }

    const before = Number(st.welfare) || 0;
    const after = Math.max(0, Math.min(100, before + applied));
    applied = after - before;
    if (meta.continuous && applied === 0) {
        // Sınırda kalan sürekli baskı bir istek olarak telemetride görünür,
        // fakat kalıcı değer değişmediği için boş komut/etki üretmez.
        st.welfare = after;
    } else if (meta.continuous && typeof storyCausalityApplyContinuousWelfare === 'function') {
        const receipt = storyCausalityApplyContinuousWelfare(
            st, source, before, after, requested, applied, suppressed, meta
        );
        if (receipt.duplicate) return 0;
        applied = Number(receipt.result) || 0;
    } else if (typeof storyCausalityRun === 'function') {
        const receipt = storyCausalityRun({
            type: 'welfare.adjust',
            eventType: 'welfare.changed',
            actor: meta.actor || { type: 'system', id: String(source || 'unknown') },
            target: { type: 'state', id: st.id },
            payload: {
                stateId: st.id,
                source: String(source || 'unknown'),
                requested: storyTelemetryRound(requested),
                applied: storyTelemetryRound(applied),
                suppressed: storyTelemetryRound(suppressed)
            },
            idempotencyKey: meta.idempotencyKey,
            correlationId: meta.correlationId || null,
            causeEventId: meta.causalityEventId || null
        }, () => {
            storyCausalitySet(st, 'welfare', after, {
                target: { type: 'state', id: st.id },
                path: `state:${st.id}.welfare`,
                source: String(source || 'unknown')
            });
            return applied;
        });
        if (receipt.duplicate) return 0;
        applied = Number(receipt.result) || 0;
    } else {
        st.welfare = after;
    }

    const entry = {
        time: storyTelemetryRound(STORY.clock),
        stateId: st.id,
        source: String(source || 'unknown'),
        requested: storyTelemetryRound(requested),
        applied: storyTelemetryRound(applied),
        suppressed: storyTelemetryRound(suppressed),
        before: storyTelemetryRound(before),
        after: storyTelemetryRound(after),
        continuous: !!meta.continuous,
        correlationId: meta.correlationId ? String(meta.correlationId) : null,
        causeEventId: Number.isFinite(meta.causeEventId) ? meta.causeEventId : null
    };
    const telemetry = storyTelemetryEnsure();
    const totals = telemetry.welfareTotals;
    const totalKey = `${st.id}:${entry.source}`;
    const total = totals[totalKey] || (totals[totalKey] = {
        stateId: st.id,
        source: entry.source,
        requested: 0,
        applied: 0,
        suppressed: 0,
        count: 0
    });
    total.requested = storyTelemetryRound(total.requested + requested);
    total.applied = storyTelemetryRound(total.applied + applied);
    total.suppressed = storyTelemetryRound(total.suppressed + suppressed);
    total.count++;
    const ledger = STORY._welfareLedger || (STORY._welfareLedger = []);
    ledger.push(entry);
    if (ledger.length > STORY_WELFARE_LEDGER_LIMIT) ledger.shift();
    storyTelemetryEvent('welfare.delta', entry, meta);
    return applied;
}

function storyTelemetryTick() {
    const telemetry = storyTelemetryEnsure();
    if (typeof storyFeatureEnabled === 'function' && !storyFeatureEnabled('telemetry.world')) return telemetry;
    const previousOwners = STORY._telemetryOwnerSnapshot || [];
    const nextOwners = (STORY.nodes || []).map(node => node.owner);
    for (let i = 0; i < nextOwners.length; i++) {
        if (previousOwners[i] === undefined || previousOwners[i] === nextOwners[i]) continue;
        storyTelemetryEvent('territory.owner_changed', {
            nodeId: i,
            fromStateId: previousOwners[i],
            toStateId: nextOwners[i]
        }, {
            correlationId: `territory:${i}:${storyTelemetryRound(STORY.clock)}`
        });
    }
    STORY._telemetryOwnerSnapshot = nextOwners;

    const previousActive = new Set(STORY._telemetryActiveStates || []);
    const nextActiveList = storyTelemetryActiveStateIds();
    const nextActive = new Set(nextActiveList);
    for (const stateId of previousActive) {
        if (!nextActive.has(stateId)) storyTelemetryEvent('state.eliminated', { stateId });
    }
    for (const stateId of nextActive) {
        if (!previousActive.has(stateId)) storyTelemetryEvent('state.restored', { stateId });
    }
    STORY._telemetryActiveStates = nextActiveList;
    storyTelemetryRecordSample(false);
    return telemetry;
}

function storyTelemetryRestore(saved) {
    if (!saved || saved.schemaVersion !== STORY_TELEMETRY_VERSION) {
        return storyTelemetryReset({ restoredFromMissingTelemetry: true });
    }
    STORY.telemetry = saved;
    STORY._telemetryOwnerSnapshot = (STORY.nodes || []).map(node => node.owner);
    STORY._telemetryActiveStates = storyTelemetryActiveStateIds();
    const samples = Array.isArray(saved.samples) ? saved.samples : [];
    const lastSample = samples.length ? Number(samples[samples.length - 1].time) || 0 : Number(STORY.clock) || 0;
    STORY._telemetryNextSample = lastSample + 10;
    STORY._welfareLedger = [];
    STORY._welfareBudgets = {};
    return storyTelemetryEnsure();
}

function storyTelemetryExport() {
    const telemetry = storyTelemetryEnsure();
    return JSON.parse(JSON.stringify({
        schemaVersion: telemetry.schemaVersion,
        meta: telemetry.meta,
        counters: telemetry.counters,
        welfareTotals: telemetry.welfareTotals,
        resourceTotals: telemetry.resourceTotals,
        performance: storyTelemetryPerformanceSummary(),
        droppedEvents: telemetry.droppedEvents,
        events: telemetry.events,
        samples: telemetry.samples,
        welfareLedger: STORY._welfareLedger || [],
        final: storyTelemetrySample()
    }));
}

// localStorage kaydı ham QA raporu değildir. Son bağlamı korur fakat her kayıtta
// megabaytlarca olay kopyalayarak ana thread'i durdurmaz. Tam akış açık oturumdan
// storyTelemetryExport ile ayrıca alınır.
function storyTelemetryForSave() {
    const telemetry = storyTelemetryEnsure();
    return {
        schemaVersion: telemetry.schemaVersion,
        createdAtWorldTime: telemetry.createdAtWorldTime,
        meta: telemetry.meta,
        nextEventId: telemetry.nextEventId,
        events: telemetry.events.slice(-200),
        samples: telemetry.samples.slice(-120),
        counters: telemetry.counters,
        welfareTotals: telemetry.welfareTotals,
        resourceTotals: telemetry.resourceTotals,
        performance: Object.assign({}, telemetry.performance, {
            recentMs: telemetry.performance.recentMs.slice(-120)
        }),
        droppedEvents: telemetry.droppedEvents
    };
}
