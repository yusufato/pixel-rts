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
    Object.freeze({ id: 'resource', intervalSeconds: 1 }),
    Object.freeze({ id: 'production', intervalSeconds: 1 }),
    Object.freeze({ id: 'commander-ai', intervalSeconds: 1 }),
    Object.freeze({ id: 'loyalty', intervalSeconds: 0.5 }),
    Object.freeze({ id: 'economy', intervalSeconds: 4 }),
    Object.freeze({ id: 'city-growth', intervalSeconds: 5 }),
    Object.freeze({ id: 'population', intervalSeconds: 5 }),
    Object.freeze({ id: 'human-migration', intervalSeconds: 5 }),
    Object.freeze({ id: 'power-centers', intervalSeconds: 5 }),
    Object.freeze({ id: 'population-needs', intervalSeconds: 5 }),
    Object.freeze({ id: 'factions', intervalSeconds: 2 }),
    Object.freeze({ id: 'society', intervalSeconds: 4 }),
    Object.freeze({ id: 'siege', intervalSeconds: 2.5 }),
    Object.freeze({ id: 'technology', intervalSeconds: 8 }),
    Object.freeze({ id: 'chatter', intervalSeconds: 9 }),
    Object.freeze({ id: 'talks', intervalSeconds: 14 }),
    Object.freeze({ id: 'diplomacy', intervalSeconds: 11 }),
    Object.freeze({ id: 'era', intervalSeconds: 6 }),
    Object.freeze({ id: 'city-development', intervalSeconds: 10 }),
    Object.freeze({ id: 'replenishment', intervalSeconds: 12 })
]);

function storySchedulerRound(value) {
    return Math.round((Number(value) || 0) * 1e12) / 1e12;
}

function storySchedulerTaskState(spec, elapsedSeconds) {
    return {
        intervalSeconds: spec.intervalSeconds,
        elapsedSeconds: Math.max(0, Math.min(
            spec.intervalSeconds,
            storySchedulerRound(elapsedSeconds)
        )),
        runCount: 0,
        lastRunSequence: null
    };
}

function storySchedulerReset() {
    const tasks = {};
    for (const spec of STORY_SCHEDULER_TASKS) {
        tasks[spec.id] = storySchedulerTaskState(spec, 0);
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
        const source = state.tasks[spec.id] || storySchedulerTaskState(spec, 0);
        tasks[spec.id] = {
            intervalSeconds: spec.intervalSeconds,
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
            tasks[spec.id] = storySchedulerTaskState(spec, 0);
            warnings.push(`Eksik/uyumsuz görev yeniden başlatıldı: ${spec.id}`);
            continue;
        }
        tasks[spec.id] = {
            intervalSeconds: spec.intervalSeconds,
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

// Bir dünya adımının başında tam bir kez çağrılır. Sonuç nesnesinin anahtar
// ekleme sırası görev sicili sırasıdır; aynı anda vadesi gelen görevler daima
// aynı sırayla tüketilir.
function storySchedulerBeginStep(dtSec) {
    const dt = Number(dtSec);
    if (!Number.isFinite(dt) || dt <= 0) return {};
    const state = storySchedulerEnsure();
    state.sequence++;
    state.processedSeconds = storySchedulerRound(state.processedSeconds + dt);
    const due = {};

    for (const spec of STORY_SCHEDULER_TASKS) {
        const task = state.tasks[spec.id];
        task.elapsedSeconds = storySchedulerRound(task.elapsedSeconds + dt);
        if (task.elapsedSeconds + STORY_SCHEDULER_EPSILON_SECONDS < spec.intervalSeconds) continue;

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
