// ═══════════════════════════════════════════════════════════════════════════
//  PIXEL RTS — LIVE TELEMETRY & BLACKBOX PERFORMANCE FLIGHT RECORDER
//  Tracks every frame, attributes root-cause on any FPS drop, renders HUD alert,
//  and streams live telemetry to background monitoring agent.
// ═══════════════════════════════════════════════════════════════════════════

(function() {
    if (typeof window === 'undefined') return;

    const TELEMETRY_SERVER_URL = 'http://127.0.0.1:4567/telemetry';
    const SPIKE_THRESHOLD_MS = 14.0; // Captures any drop below ~70 FPS (target 144/60)

    const state = {
        lastFrameTime: performance.now(),
        fps: 144,
        history: [],
        maxHistory: 200,
        interaction: {
            isPanning: false,
            isZooming: false,
            lastMouseMove: 0,
            mouseSpeed: 0,
            hoverHexId: null,
            lastZoom: 1.0,
            activeModal: null
        },
        currentTasks: [],
        currentRenderBreakdown: {}
    };

    window.__STORY_TELEMETRY__ = state;

    // Track mouse and user interactions
    window.addEventListener('mousemove', (e) => {
        state.interaction.lastMouseMove = performance.now();
        state.interaction.hoverHexId = (typeof STORY !== 'undefined' && STORY._hoverHexCellId) || null;
    }, { passive: true });

    window.addEventListener('wheel', () => {
        state.interaction.isZooming = true;
        clearTimeout(state.zoomTimeout);
        state.zoomTimeout = setTimeout(() => { state.interaction.isZooming = false; }, 200);
    }, { passive: true });

    window.addEventListener('mousedown', () => {
        state.interaction.isPanning = true;
    }, { passive: true });

    window.addEventListener('mouseup', () => {
        state.interaction.isPanning = false;
    }, { passive: true });

    // Stream spike event to local server
    function sendSpikeTelemetry(event) {
        try {
            fetch(TELEMETRY_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
                keepalive: true
            }).catch(() => {});
        } catch (_) {}

        try {
            const raw = localStorage.getItem('STORY_PERF_SPIKES') || '[]';
            const list = JSON.parse(raw);
            list.push(event);
            if (list.length > 50) list.shift();
            localStorage.setItem('STORY_PERF_SPIKES', JSON.stringify(list));
        } catch (_) {}
    }

    // Live On-Screen HUD Badge
    let hudElement = null;
    let hudTimeout = null;

    function showOnScreenSpikeBadge(event) {
        if (!hudElement) {
            hudElement = document.createElement('div');
            hudElement.id = 'story-telemetry-spike-badge';
            hudElement.style.cssText = `
                position: fixed;
                top: 12px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(26, 6, 6, 0.92);
                border: 1.5px solid #ff3344;
                border-radius: 6px;
                color: #fff;
                font-family: 'JetBrains Mono', monospace, sans-serif;
                font-size: 12px;
                padding: 6px 14px;
                z-index: 999999;
                pointer-events: none;
                box-shadow: 0 4px 16px rgba(255, 0, 0, 0.35);
                display: none;
                transition: opacity 0.2s ease;
            `;
            document.body.appendChild(hudElement);
        }

        const culpritText = event.primaryCulprit
            ? `<b>${event.primaryCulprit.name}</b> (${event.primaryCulprit.durationMs.toFixed(1)}ms / %${event.primaryCulprit.percentage})`
            : `Render/Layout (${event.durationMs.toFixed(1)}ms)`;

        hudElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #ff4455; font-size: 14px;">⚠️ FPS DÜŞÜŞÜ</span>
                <span style="color: #ffcc00; font-weight: bold;">${event.durationMs.toFixed(1)} ms (~${event.instantFps} FPS)</span>
                <span style="color: #ccc;">| Neden: ${culpritText}</span>
                <span style="color: #88aaff; font-size: 11px;">[Eylem: ${event.userAction}]</span>
            </div>
        `;
        hudElement.style.display = 'block';
        hudElement.style.opacity = '1';

        clearTimeout(hudTimeout);
        hudTimeout = setTimeout(() => {
            if (hudElement) hudElement.style.opacity = '0';
        }, 3000);
    }

    // Hook simulation and frame lifecycle
    function initTelemetryHooks() {
        const origStoryAdvanceStep = window.storyAdvanceStep;
        if (typeof origStoryAdvanceStep === 'function') {
            window.storyAdvanceStep = function(dtSec) {
                const start = performance.now();
                const res = origStoryAdvanceStep.apply(this, arguments);
                const dur = performance.now() - start;
                return res;
            };
        }

        // Trace individual tasks
        const tasks = [
            'storyTradeLogisticsTick',
            'storyRegionalEconomyTick',
            'storyPowerCenterTick',
            'storyEconomicAITick',
            'storyHexConstructionTickSeconds',
            'storyHexConstructionEconomicAITick',
            'storyInfrastructureWorkTickSeconds',
            'storyCharacterActionTick',
            'storyHumanMigrationTick',
            'storyMarketPriceTick',
            'storyPoliticalCrisisTick',
            'storyPopulationTick',
            'storyElectionTick',
            'storyRender',
            'storyRenderTransportOverlay',
            'storyWorldVisualStateKey'
        ];

        for (const taskName of tasks) {
            if (typeof window[taskName] === 'function') {
                const orig = window[taskName];
                window[taskName] = function() {
                    const t0 = performance.now();
                    const result = orig.apply(this, arguments);
                    const d = performance.now() - t0;
                    if (d > 0.4) {
                        state.currentTasks.push({ name: taskName, durationMs: d });
                    }
                    return result;
                };
            }
        }

        // Hook frame wrapper
        const origStoryWorldFrame = window.storyWorldFrame;
        if (typeof origStoryWorldFrame === 'function') {
            window.storyWorldFrame = function(ts) {
                state.currentTasks = [];
                const frameStart = performance.now();
                const res = origStoryWorldFrame.apply(this, arguments);
                const frameDuration = performance.now() - frameStart;

                const instantFps = Math.round(1000 / Math.max(1, frameDuration));

                if (frameDuration >= SPIKE_THRESHOLD_MS) {
                    let userAction = 'SABİT (Hareketsiz)';
                    if (state.interaction.isPanning) userAction = 'HARİTA KAYDIRMA (Pan)';
                    else if (state.interaction.isZooming) userAction = 'YAKINLAŞTIRMA (Zoom)';
                    else if (performance.now() - state.interaction.lastMouseMove < 100) userAction = 'FARE HAREKETİ (Hover)';

                    let primaryCulprit = null;
                    if (state.currentTasks.length > 0) {
                        state.currentTasks.sort((a, b) => b.durationMs - a.durationMs);
                        const top = state.currentTasks[0];
                        primaryCulprit = {
                            name: top.name,
                            durationMs: top.durationMs,
                            percentage: Math.round((top.durationMs / frameDuration) * 100)
                        };
                    }

                    const event = {
                        timestamp: new Date().toISOString(),
                        gameClock: typeof STORY !== 'undefined' ? STORY.clock : 0,
                        durationMs: frameDuration,
                        instantFps,
                        userAction,
                        primaryCulprit,
                        tasks: state.currentTasks,
                        camera: typeof storyCam !== 'undefined' ? { x: storyCam.x, y: storyCam.y, zoom: storyCam.zoom } : null,
                        hoverHexId: typeof STORY !== 'undefined' ? STORY._hoverHexCellId : null
                    };

                    state.history.push(event);
                    if (state.history.length > state.maxHistory) state.history.shift();

                    console.warn(`[TELEMETRY SPIKE] ${frameDuration.toFixed(1)}ms (${instantFps} FPS) | Neden: ${primaryCulprit ? primaryCulprit.name + ' (' + primaryCulprit.durationMs.toFixed(1) + 'ms)' : 'Render/DOM'} | Eylem: ${userAction}`);
                    
                    showOnScreenSpikeBadge(event);
                    sendSpikeTelemetry(event);
                }

                return res;
            };
        }
    }

    // Expose console diagnostic reporter
    window.showPerfReport = function() {
        console.table(state.history.map(h => ({
            'Süre (ms)': h.durationMs.toFixed(1),
            'FPS': h.instantFps,
            'Ana Neden': h.primaryCulprit ? `${h.primaryCulprit.name} (${h.primaryCulprit.durationMs.toFixed(1)}ms - %${h.primaryCulprit.percentage})` : 'Render/DOM',
            'Kullanıcı Eylemi': h.userAction,
            'Zaman (Oyun)': h.gameClock ? h.gameClock.toFixed(1) + 's' : '-'
        })));
        return `${state.history.length} adet düşüş kaydedildi.`;
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initTelemetryHooks, 100);
    } else {
        window.addEventListener('DOMContentLoaded', initTelemetryHooks);
    }
})();
