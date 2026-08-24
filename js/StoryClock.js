// ═══════════════════════════════════════════════════════════════════════════
//  DETERMINİSTİK HİKÂYE SAATİ VE TAKVİMİ — Faz 6
//  ---------------------------------------------------------------------------
//  Render kareleri yalnız gerçek zaman sağlar. Dünya motoru her koşulda aynı
//  0,25 sn'lik adımları işler; FPS ve hız, karar sırasını değiştiremez.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CLOCK_SCHEMA_VERSION = 1;
const STORY_FIXED_STEP_SECONDS = 0.25;
const STORY_CLOCK_EPSILON_SECONDS = 1e-8;
const STORY_CLOCK_SPEEDS = Object.freeze([1, 2, 4]);
const STORY_CLOCK_MAX_STEPS_PER_ADVANCE = 120;
const STORY_CALENDAR = Object.freeze({
    startYear: 2032,
    secondsPerYear: 120,
    daysPerYear: 360,
    monthsPerYear: 12,
    daysPerMonth: 30
});

function storyClockRound(value, digits) {
    const factor = 10 ** (digits == null ? 12 : digits);
    return Math.round((Number(value) || 0) * factor) / factor;
}

function storyClockValidSpeed(value) {
    const speed = Number(value);
    return STORY_CLOCK_SPEEDS.includes(speed) ? speed : 1;
}

function storyClockEnsure() {
    const state = STORY.time && typeof STORY.time === 'object' ? STORY.time : {};
    STORY.time = state;
    state.schemaVersion = STORY_CLOCK_SCHEMA_VERSION;
    state.fixedStepSeconds = STORY_FIXED_STEP_SECONDS;
    state.speed = storyClockValidSpeed(state.speed);
    const pending = Math.max(0, storyClockRound(state.accumulatorSeconds));
    state.accumulatorSeconds = pending <= STORY_CLOCK_EPSILON_SECONDS ? 0 : pending;
    state.tick = Math.max(0, Number.isInteger(state.tick)
        ? state.tick
        : Math.round((Number(STORY.clock) || 0) / STORY_FIXED_STEP_SECONDS));
    state.maxStepsPerAdvance = STORY_CLOCK_MAX_STEPS_PER_ADVANCE;
    state.droppedGameSeconds = Math.max(0, storyClockRound(state.droppedGameSeconds));
    return state;
}

function storyClockReset(options) {
    options = options || {};
    STORY.time = {
        schemaVersion: STORY_CLOCK_SCHEMA_VERSION,
        fixedStepSeconds: STORY_FIXED_STEP_SECONDS,
        speed: storyClockValidSpeed(options.speed),
        accumulatorSeconds: 0,
        tick: Math.max(0, Math.round((Number(STORY.clock) || 0) / STORY_FIXED_STEP_SECONDS)),
        maxStepsPerAdvance: STORY_CLOCK_MAX_STEPS_PER_ADVANCE,
        droppedGameSeconds: 0
    };
    STORY._lastFrameT = 0;
    return storyClockSnapshot();
}

function storyClockSetSpeed(value) {
    const state = storyClockEnsure();
    state.speed = storyClockValidSpeed(value);
    return state.speed;
}

function storyClockCycleSpeed() {
    const state = storyClockEnsure();
    const index = STORY_CLOCK_SPEEDS.indexOf(state.speed);
    state.speed = STORY_CLOCK_SPEEDS[(index + 1) % STORY_CLOCK_SPEEDS.length];
    return state.speed;
}

function storyClockSnapshot() {
    const state = storyClockEnsure();
    return {
        schemaVersion: STORY_CLOCK_SCHEMA_VERSION,
        fixedStepSeconds: STORY_FIXED_STEP_SECONDS,
        speed: state.speed,
        accumulatorSeconds: storyClockRound(state.accumulatorSeconds),
        tick: state.tick,
        maxStepsPerAdvance: STORY_CLOCK_MAX_STEPS_PER_ADVANCE,
        droppedGameSeconds: storyClockRound(state.droppedGameSeconds)
    };
}

function storyClockForSave() {
    return storyClockSnapshot();
}

function storyClockRestore(saved) {
    const source = saved && typeof saved === 'object' ? saved : {};
    const restored = {
        speed: storyClockValidSpeed(source.speed),
        accumulatorSeconds: Number(source.fixedStepSeconds) === STORY_FIXED_STEP_SECONDS
            ? source.accumulatorSeconds
            : 0,
        tick: Number.isInteger(source.tick)
            ? source.tick
            : Math.round((Number(STORY.clock) || 0) / STORY_FIXED_STEP_SECONDS),
        droppedGameSeconds: source.droppedGameSeconds
    };
    STORY.time = restored;
    STORY._lastFrameT = 0;
    return storyClockSnapshot();
}

function storyClockAdvance(realDtSec) {
    const dt = Number(realDtSec);
    if (!Number.isFinite(dt) || dt <= 0 || STORY.paused) return 0;
    const state = storyClockEnsure();

    if (STORY._session) {
        storyAdvanceStep(0);
        return 0;
    }

    if (typeof storyFeatureEnabled === 'function' && !storyFeatureEnabled('time.fixedStep')) {
        storyAdvanceStep(dt * state.speed);
        state.tick = Math.max(state.tick, Math.round((Number(STORY.clock) || 0) / STORY_FIXED_STEP_SECONDS));
        state.accumulatorSeconds = 0;
        return 1;
    }

    const isBrowser = typeof window !== 'undefined';
    state.accumulatorSeconds = storyClockRound(state.accumulatorSeconds + dt * state.speed);
    if (isBrowser) {
        // Prevent death spiral: cap accumulator so frame drops never accumulate unrecoverable debt
        state.accumulatorSeconds = Math.min(STORY_FIXED_STEP_SECONDS * 2, state.accumulatorSeconds);
    }

    const startMs = isBrowser && typeof performance !== 'undefined' ? performance.now() : 0;
    const maxSteps = isBrowser ? 2 : STORY_CLOCK_MAX_STEPS_PER_ADVANCE;

    let steps = 0;
    while (
        state.accumulatorSeconds + STORY_CLOCK_EPSILON_SECONDS >= STORY_FIXED_STEP_SECONDS
        && steps < maxSteps
    ) {
        state.accumulatorSeconds = storyClockRound(state.accumulatorSeconds - STORY_FIXED_STEP_SECONDS);
        if (Math.abs(state.accumulatorSeconds) <= STORY_CLOCK_EPSILON_SECONDS) {
            state.accumulatorSeconds = 0;
        } else if (state.accumulatorSeconds < 0) {
            state.accumulatorSeconds = 0;
        }
        storyAdvanceStep(STORY_FIXED_STEP_SECONDS);
        state.tick++;
        steps++;
        if (STORY.paused || STORY._session) {
            // Aynı render karesinin kalan süresi, modal/oyun-sonu açıldıktan sonra
            // geleceğe taşınamaz; aksi hâlde modal kapanınca dünya sıçrar.
            state.accumulatorSeconds = 0;
            break;
        }
        if (isBrowser && typeof performance !== 'undefined' && (performance.now() - startMs) > 12) {
            break;
        }
    }
    return steps;
}

function storyAdvance(dtSec) {
    return storyClockAdvance(dtSec);
}

function storyCalendarAt(gameSeconds) {
    const seconds = Math.max(0, Number(gameSeconds) || 0);
    const totalDays = Math.floor(
        seconds / STORY_CALENDAR.secondsPerYear * STORY_CALENDAR.daysPerYear + 1e-9
    );
    const yearOffset = Math.floor(totalDays / STORY_CALENDAR.daysPerYear);
    const dayOfYear = totalDays % STORY_CALENDAR.daysPerYear;
    const monthIndex = Math.floor(dayOfYear / STORY_CALENDAR.daysPerMonth);
    const day = dayOfYear % STORY_CALENDAR.daysPerMonth + 1;
    const month = monthIndex + 1;
    const year = STORY_CALENDAR.startYear + yearOffset;
    const seasonIndex = Math.min(3, Math.floor(dayOfYear / (STORY_CALENDAR.daysPerYear / 4)));
    return {
        gameSeconds: storyClockRound(seconds),
        year,
        month,
        day,
        dayOfYear,
        seasonIndex,
        label: `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
    };
}

function storyCalendarNow() {
    return storyCalendarAt(STORY.clock);
}
