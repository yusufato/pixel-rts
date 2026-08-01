// ═══════════════════════════════════════════════════════════════════════════
//  HİKÂYE RNG AKIŞLARI — Faz 7
//  ---------------------------------------------------------------------------
//  Her alt sistem kendi rastgele dizisini tüketir. Sohbete eklenen bir seçim,
//  askerî sonuçları veya ekonomi tarihini kaydıramaz. Bütün durum kaydedilir.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_RNG_SCHEMA_VERSION = 1;
const STORY_RNG_STREAM_NAMES = Object.freeze([
    'world',
    'character',
    'military',
    'economy',
    'society',
    'production',
    'diplomacy',
    'narrative',
    'governance'
]);

function storyRngUint(value) {
    return Number(value) >>> 0;
}

function storyRngHashText(value) {
    const text = String(value == null ? '' : value);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    return hash >>> 0;
}

function storyRngGeneratedSeed() {
    try {
        const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
        if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
            const words = new Uint32Array(1);
            cryptoApi.getRandomValues(words);
            return words[0] >>> 0;
        }
    } catch (_) {}
    const now = Date.now() >>> 0;
    const perf = typeof performance !== 'undefined' && performance.now
        ? Math.floor(performance.now() * 1000) >>> 0
        : 0;
    return storyRngHashText(`${now}:${perf}`);
}

function storyRngResolveRootSeed(value) {
    if (Number.isFinite(Number(value))) return storyRngUint(value);
    return storyRngGeneratedSeed();
}

function storyRngDerivedState(rootSeed, streamName) {
    return storyRngHashText(`${storyRngUint(rootSeed)}:${streamName}:pixel-rts-story-rng-v1`);
}

function storyRngCreateStream(rootSeed, streamName) {
    return {
        state: storyRngDerivedState(rootSeed, streamName),
        calls: 0
    };
}

function storyRngReset(rootSeed) {
    const resolved = storyRngResolveRootSeed(rootSeed);
    const streams = {};
    for (const name of STORY_RNG_STREAM_NAMES) streams[name] = storyRngCreateStream(resolved, name);
    STORY.rng = {
        schemaVersion: STORY_RNG_SCHEMA_VERSION,
        algorithm: 'mulberry32-streams-v1',
        rootSeed: resolved,
        streams,
        warnings: []
    };
    return storyRngSnapshot();
}

function storyRngEnsure() {
    if (!STORY.rng || STORY.rng.schemaVersion !== STORY_RNG_SCHEMA_VERSION) {
        const telemetrySeed = STORY.telemetry && STORY.telemetry.meta
            ? STORY.telemetry.meta.campaignSeed
            : null;
        storyRngReset(telemetrySeed);
    }
    if (!STORY.rng.streams || typeof STORY.rng.streams !== 'object') STORY.rng.streams = {};
    for (const name of STORY_RNG_STREAM_NAMES) {
        const stream = STORY.rng.streams[name];
        if (!stream || !Number.isInteger(stream.state) || !Number.isInteger(stream.calls)) {
            STORY.rng.streams[name] = storyRngCreateStream(STORY.rng.rootSeed, name);
        }
    }
    return STORY.rng;
}

function storyRngStream(name) {
    if (!STORY_RNG_STREAM_NAMES.includes(name)) {
        throw new Error(`Bilinmeyen hikâye RNG akışı: ${name}`);
    }
    return storyRngEnsure().streams[name];
}

function storyRandom(name) {
    const selectedName = typeof storyFeatureEnabled === 'function' && !storyFeatureEnabled('rng.streams')
        ? 'world'
        : name;
    const stream = storyRngStream(selectedName);
    let value = stream.state = (stream.state + 0x6d2b79f5) >>> 0;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    stream.calls++;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function storyRandomInt(name, maxExclusive) {
    const max = Math.max(0, Math.floor(Number(maxExclusive) || 0));
    return max ? Math.floor(storyRandom(name) * max) : 0;
}

function storyRandomPick(name, values) {
    return Array.isArray(values) && values.length
        ? values[storyRandomInt(name, values.length)]
        : undefined;
}

function storyRngSnapshot() {
    const rng = storyRngEnsure();
    const streams = {};
    for (const name of STORY_RNG_STREAM_NAMES) {
        streams[name] = {
            state: rng.streams[name].state >>> 0,
            calls: Math.max(0, Math.floor(rng.streams[name].calls))
        };
    }
    return {
        schemaVersion: STORY_RNG_SCHEMA_VERSION,
        algorithm: 'mulberry32-streams-v1',
        rootSeed: rng.rootSeed >>> 0,
        streams,
        warnings: Array.isArray(rng.warnings) ? rng.warnings.slice() : []
    };
}

function storyRngForSave() {
    return storyRngSnapshot();
}

function storyRngRestore(saved, fallbackSeed) {
    if (
        !saved
        || saved.schemaVersion !== STORY_RNG_SCHEMA_VERSION
        || saved.algorithm !== 'mulberry32-streams-v1'
        || !Number.isFinite(Number(saved.rootSeed))
    ) {
        storyRngReset(fallbackSeed);
        STORY.rng.warnings.push('Eski/bozuk kayıtta RNG durumu bulunamadı; deterministik fallback tohumu kullanıldı.');
        return storyRngSnapshot();
    }
    const rootSeed = storyRngUint(saved.rootSeed);
    const streams = {};
    const warnings = [];
    for (const name of STORY_RNG_STREAM_NAMES) {
        const source = saved.streams && saved.streams[name];
        if (
            source
            && Number.isInteger(Number(source.state))
            && Number.isInteger(Number(source.calls))
            && Number(source.calls) >= 0
        ) {
            streams[name] = {
                state: storyRngUint(source.state),
                calls: Math.max(0, Math.floor(Number(source.calls)))
            };
        } else {
            streams[name] = storyRngCreateStream(rootSeed, name);
            warnings.push(`Eksik RNG akışı yeniden türetildi: ${name}`);
        }
    }
    STORY.rng = {
        schemaVersion: STORY_RNG_SCHEMA_VERSION,
        algorithm: 'mulberry32-streams-v1',
        rootSeed,
        streams,
        warnings
    };
    return storyRngSnapshot();
}
