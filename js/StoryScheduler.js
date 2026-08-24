// ═══════════════════════════════════════════════════════════════════════════
//  DETERMINİSTİK HİKÂYE GÖREV SİCİLİ — Faz 8
//  ---------------------------------------------------------------------------
//  Dünya katmanlarının periyotları ve çalışma sırası tek sözleşmede yaşar.
//  Kayıt, her görevin periyot içindeki ilerlemesini de taşır; yükleme hiçbir
//  görevi erkene almaz, geciktirmez veya ikinci kez çalıştırmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_SCHEDULER_SCHEMA_VERSION = 1;
const STORY_SCHEDULER_EPSILON_SECONDS = 1e-9;
const STORY_SCHEDULER_TASKS = Object.freeze([
    Object.freeze({ id: 'resource', intervalSeconds: 2, phaseOffsetSeconds: 0.0 }),
    Object.freeze({ id: 'production', intervalSeconds: 2, phaseOffsetSeconds: 0.5 }),
    Object.freeze({ id: 'commander-ai', intervalSeconds: 2, phaseOffsetSeconds: 1.0 }),
    Object.freeze({ id: 'loyalty', intervalSeconds: 1, phaseOffsetSeconds: 0.0 }),
    Object.freeze({ id: 'economy', intervalSeconds: 4, phaseOffsetSeconds: 0.0 }),
    Object.freeze({ id: 'economy-macro', intervalSeconds: 4, phaseOffsetSeconds: 0.0 }),
    Object.freeze({ id: 'economy-regional', intervalSeconds: 4, phaseOffsetSeconds: 1.0 }),
    Object.freeze({ id: 'economy-trade-logistics', intervalSeconds: 2, phaseOffsetSeconds: 1.5 }),
    Object.freeze({ id: 'economy-market-price', intervalSeconds: 4, phaseOffsetSeconds: 2.0 }),
    Object.freeze({ id: 'economy-budget', intervalSeconds: 4, phaseOffsetSeconds: 2.5 }),
    Object.freeze({ id: 'economy-company', intervalSeconds: 4, phaseOffsetSeconds: 3.0 }),
    Object.freeze({ id: 'economy-hex-construction', intervalSeconds: 4, phaseOffsetSeconds: 3.5 }),
    Object.freeze({ id: 'economy-infrastructure-work', intervalSeconds: 4, phaseOffsetSeconds: 0.5 }),
    Object.freeze({ id: 'economy-ai', intervalSeconds: 4, phaseOffsetSeconds: 1.25 }),
    Object.freeze({ id: 'economy-hex-construction-ai', intervalSeconds: 4, phaseOffsetSeconds: 2.25 }),
    Object.freeze({ id: 'city-growth', intervalSeconds: 5, phaseOffsetSeconds: 0.0 }),
    Object.freeze({ id: 'population', intervalSeconds: 5, phaseOffsetSeconds: 0.5 }),
    Object.freeze({ id: 'human-migration', intervalSeconds: 5, phaseOffsetSeconds: 1.0 }),
    Object.freeze({ id: 'institutions', intervalSeconds: 5, phaseOffsetSeconds: 1.5 }),
    Object.freeze({ id: 'power-centers', intervalSeconds: 5, phaseOffsetSeconds: 2.0 }),
    Object.freeze({ id: 'population-needs', intervalSeconds: 5, phaseOffsetSeconds: 2.5 }),
    Object.freeze({ id: 'factions', intervalSeconds: 4, phaseOffsetSeconds: 1.75 }),
    Object.freeze({ id: 'society', intervalSeconds: 4, phaseOffsetSeconds: 2.5 }),
    Object.freeze({ id: 'state-capacity', intervalSeconds: 5, phaseOffsetSeconds: 3.0 }),
    Object.freeze({ id: 'elections', intervalSeconds: 5, phaseOffsetSeconds: 3.5 }),
    Object.freeze({ id: 'integrity', intervalSeconds: 5, phaseOffsetSeconds: 4.0 }),
    Object.freeze({ id: 'political-crisis', intervalSeconds: 5, phaseOffsetSeconds: 4.5 }),
    Object.freeze({ id: 'character-behavior', intervalSeconds: 5, phaseOffsetSeconds: 1.25 }),
    Object.freeze({ id: 'character-activation', intervalSeconds: 15, phaseOffsetSeconds: 3.75 }),
    Object.freeze({ id: 'character-actions', intervalSeconds: 10, phaseOffsetSeconds: 2.75 }),
    Object.freeze({ id: 'negotiation-deadlines', intervalSeconds: 5, phaseOffsetSeconds: 4.25 }),
    Object.freeze({ id: 'siege', intervalSeconds: 4, phaseOffsetSeconds: 2.75 }),
    Object.freeze({ id: 'technology', intervalSeconds: 8, phaseOffsetSeconds: 3.25 }),
    Object.freeze({ id: 'chatter', intervalSeconds: 9, phaseOffsetSeconds: 4.5 }),
    Object.freeze({ id: 'talks', intervalSeconds: 14, phaseOffsetSeconds: 5.25 }),
    Object.freeze({ id: 'diplomacy', intervalSeconds: 11, phaseOffsetSeconds: 1.75 }),
    Object.freeze({ id: 'era', intervalSeconds: 6, phaseOffsetSeconds: 2.25 }),
    Object.freeze({ id: 'city-development', intervalSeconds: 10, phaseOffsetSeconds: 6.25 }),
    Object.freeze({ id: 'replenishment', intervalSeconds: 12, phaseOffsetSeconds: 7.5 })
]);

function storySchedulerRound(value) {
    return Math.round((Number(value) || 0) * 1e12) / 1e12;
}

function storySchedulerTaskState(spec, elapsedSeconds) {
    const initialElapsed = elapsedSeconds != null
        ? elapsedSeconds
        : (spec.phaseOffsetSeconds || 0);
    return {
        intervalSeconds: spec.intervalSeconds,
        phaseOffsetSeconds: spec.phaseOffsetSeconds || 0,
        elapsedSeconds: Math.max(0, Math.min(
            spec.intervalSeconds,
            storySchedulerRound(initialElapsed)
        )),
        runCount: 0,
        lastRunSequence: null
    };
}

function storySchedulerReset() {
    const tasks = {};
    for (const spec of STORY_SCHEDULER_TASKS) {
        tasks[spec.id] = storySchedulerTaskState(spec);
    }
    STORY.scheduler = {
        schemaVersion: STORY_SCHEDULER_SCHEMA_VERSION,
        sequence: 0,
        processedSeconds: 0,
        tasks,
        warnings: []
    };
    return storySchedulerSnapshot();
}

function storySchedulerEnsure() {
    const state = STORY.scheduler;
    if (
        !state
        || state.schemaVersion !== STORY_SCHEDULER_SCHEMA_VERSION
        || !state.tasks
        || typeof state.tasks !== 'object'
    ) {
        storySchedulerReset();
    }
    return STORY.scheduler;
}

function storySchedulerSnapshot() {
    const state = storySchedulerEnsure();
    const tasks = {};
    for (const spec of STORY_SCHEDULER_TASKS) {
        const source = state.tasks[spec.id] || storySchedulerTaskState(spec);
        tasks[spec.id] = {
            intervalSeconds: spec.intervalSeconds,
            phaseOffsetSeconds: spec.phaseOffsetSeconds || 0,
            elapsedSeconds: storySchedulerRound(source.elapsedSeconds),
            runCount: Math.max(0, Math.floor(Number(source.runCount) || 0)),
            lastRunSequence: source.lastRunSequence == null
                ? null
                : Math.max(0, Math.floor(Number(source.lastRunSequence) || 0))
        };
    }
    return {
        schemaVersion: STORY_SCHEDULER_SCHEMA_VERSION,
        sequence: Math.max(0, Math.floor(Number(state.sequence) || 0)),
        processedSeconds: storySchedulerRound(state.processedSeconds),
        taskOrder: STORY_SCHEDULER_TASKS.map(spec => spec.id),
        tasks,
        warnings: Array.isArray(state.warnings) ? state.warnings.slice() : []
    };
}

function storySchedulerForSave() {
    return storySchedulerSnapshot();
}

function storySchedulerRestore(saved) {
    const source = saved && typeof saved === 'object' ? saved : null;
    if (!source || source.schemaVersion !== STORY_SCHEDULER_SCHEMA_VERSION || !source.tasks) {
        storySchedulerReset();
        STORY.scheduler.warnings.push(
            'Eski/bozuk kayıtta görev sicili bulunamadı; görev periyotları sıfırdan başlatıldı.'
        );
        return storySchedulerSnapshot();
    }

    const tasks = {};
    const warnings = [];
    for (const spec of STORY_SCHEDULER_TASKS) {
        const task = source.tasks[spec.id];
        if (
            !task
            || Number(task.intervalSeconds) !== spec.intervalSeconds
            || !Number.isFinite(Number(task.elapsedSeconds))
            || Number(task.elapsedSeconds) < 0
            || Number(task.elapsedSeconds) >= spec.intervalSeconds + STORY_SCHEDULER_EPSILON_SECONDS
        ) {
            tasks[spec.id] = storySchedulerTaskState(spec);
            warnings.push(`Eksik/uyumsuz görev yeniden başlatıldı: ${spec.id}`);
            continue;
        }
        tasks[spec.id] = {
            intervalSeconds: spec.intervalSeconds,
            phaseOffsetSeconds: spec.phaseOffsetSeconds || 0,
            elapsedSeconds: storySchedulerRound(task.elapsedSeconds),
            runCount: Math.max(0, Math.floor(Number(task.runCount) || 0)),
            lastRunSequence: task.lastRunSequence == null
                ? null
                : Math.max(0, Math.floor(Number(task.lastRunSequence) || 0))
        };
    }
    STORY.scheduler = {
        schemaVersion: STORY_SCHEDULER_SCHEMA_VERSION,
        sequence: Math.max(0, Math.floor(Number(source.sequence) || 0)),
        processedSeconds: Math.max(0, storySchedulerRound(source.processedSeconds)),
        tasks,
        warnings
    };
    return storySchedulerSnapshot();
}

const STORY_SCHEDULER_HEAVY_TASK_IDS = new Set([
    'economy-regional',
    'economy-trade-logistics',
    'population-needs',
    'population',
    'power-centers',
    'human-migration',
    'political-crisis',
    'character-actions'
]);

function storySchedulerBeginStep(dtSec) {
    const dt = Number(dtSec);
    if (!Number.isFinite(dt) || dt <= 0) return {};
    const state = storySchedulerEnsure();
    state.sequence++;
    state.processedSeconds = storySchedulerRound(state.processedSeconds + dt);
    const due = {};
    let heavyDueCount = 0;

    for (const spec of STORY_SCHEDULER_TASKS) {
        const task = state.tasks[spec.id];
        task.elapsedSeconds = storySchedulerRound(task.elapsedSeconds + dt);
        if (task.elapsedSeconds + STORY_SCHEDULER_EPSILON_SECONDS < spec.intervalSeconds) continue;

        // Canlı karelerde aynı anda birden fazla ağır görev çalıştırıp 500 ms kilitlenme
        // yaratmamak için kare başına en fazla 1 ağır görev tüketilir, diğeri bir sonraki adıma ertelenir.
        const isHeavy = STORY_SCHEDULER_HEAVY_TASK_IDS.has(spec.id);
        if (isHeavy && heavyDueCount >= 1) {
            task.elapsedSeconds = spec.intervalSeconds;
            continue;
        }
        if (isHeavy) heavyDueCount++;

        // Eski motor da büyük bir dt geldiğinde görevi bir kez çalıştırıp sayacı
        // sıfırlıyordu. A/B eşitliği için burada catch-up patlaması yapılmaz.
        due[spec.id] = task.elapsedSeconds;
        task.elapsedSeconds = 0;
        task.runCount++;
        task.lastRunSequence = state.sequence;
    }
    return due;
}

function storySchedulerDue(due, taskId) {
    if (!due || !Object.prototype.hasOwnProperty.call(due, taskId)) return 0;
    return Number(due[taskId]) || 0;
}
