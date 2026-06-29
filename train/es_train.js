// ═══════════════════════════════════════════════════════════════════════════
//  train/es_train.js — ES (EVRİM) SELF-PLAY EĞİTİCİ (Node, torch GEREKMEZ → 4060 PC'de koşar)
//  Tarayıcı stub + tüm sim TEK eval-scope + _es_loop.js (RED=NN vs BLUE=kural, OpenAI-ES).
//  KEŞİF KANITI: son-fitness > başlangıç → AI kuralın ötesinde yeni kazanan davranış buldu.
//  Çalıştır (hızlı test):  node train/es_train.js
//  4060 GECE-EĞİTİM:       ES_SIZES=240,96,64,32,20 ES_POP=40 ES_GENS=400 ES_TICKS=900 node train/es_train.js
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const noop = function () { };
const NUMERIC = new Set(['width', 'height', 'length', 'offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight', 'innerWidth', 'innerHeight', 'scrollTop', 'scrollLeft', 'x', 'y', 'top', 'left', 'right', 'bottom', 'devicePixelRatio', 'lineWidth', 'globalAlpha']);
const domStub = new Proxy(function () { }, {
    get: (t, p) => {
        if (p === Symbol.iterator) return function* () { };
        if (typeof p === 'symbol') return undefined;
        if (NUMERIC.has(p)) return (p === 'devicePixelRatio') ? 1 : 0;
        if (p === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 1366, bottom: 768, width: 1366, height: 768 });
        if (p === 'getContext') return () => domStub;
        if (p === 'measureText') return () => ({ width: 0 });
        if (p === 'createRadialGradient' || p === 'createLinearGradient' || p === 'createPattern') return () => domStub;
        if (p === 'getImageData') return () => ({ data: [] });
        if (p === 'classList') return { add: noop, remove: noop, toggle: noop, contains: () => false };
        return domStub;
    }, set: () => true, apply: () => domStub, has: () => true
});
var localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
var window = new Proxy({ innerWidth: 1366, innerHeight: 768, devicePixelRatio: 1, localStorage: localStorage, location: {}, requestAnimationFrame: noop, cancelAnimationFrame: noop, addEventListener: noop, removeEventListener: noop }, { get: (t, p) => (p in t ? t[p] : domStub), set: (t, p, v) => { t[p] = v; return true; } });
var document = new Proxy({ readyState: 'complete', getElementById: () => domStub, createElement: () => domStub, createElementNS: () => domStub, querySelector: () => domStub, querySelectorAll: () => [], getElementsByClassName: () => [], getElementsByTagName: () => [], addEventListener: noop, removeEventListener: noop, body: domStub, documentElement: domStub, head: domStub }, { get: (t, p) => (p in t ? t[p] : domStub), set: (t, p, v) => { t[p] = v; return true; } });
var requestAnimationFrame = noop, cancelAnimationFrame = noop, alert = noop, navigator = { userAgent: 'node' }, performance = { now: () => 0 };

var __OUT = null;
const FILES = ['brain.js', 'globals.js', 'MapImage.js', 'MapData.js', 'BrainState.js', 'NeuralBrain.js', 'HybridBrain.js', 'NNController.js', 'TacticalAI.js', 'Telemetry.js', 'VFX.js', 'Support.js', 'Unit.js', 'AI.js', 'Foresight.js', 'LayeredAI.js', 'Commander.js', 'ControlPoints.js', 'main.js', 'terrainData.js', 'techTree.js', 'SelfPlay.js'];
let src = '';
for (const f of FILES) { const p = path.join(ROOT, 'js', f); if (fs.existsSync(p)) src += '\n;/*=== ' + f + ' ===*/\n' + fs.readFileSync(p, 'utf8'); }
src += '\n;/*=== _es_loop.js ===*/\n' + fs.readFileSync(path.join(__dirname, '_es_loop.js'), 'utf8');
src = src.replace(/^(const|let)\s+/gm, 'var ');
src = src.replace(/^class\s+([A-Za-z_$][\w$]*)\s*\{/gm, 'var $1 = class {');
src = src.replace(/^class\s+([A-Za-z_$][\w$]*)\s+extends\s+([A-Za-z_$][\w$.]*)\s*\{/gm, 'var $1 = class extends $2 {');

const _log = console.log.bind(console);
console.log = function () { };   // sim-içi spam sustur
try { eval(src); }
catch (e) { console.error('EVAL HATA:', e && e.message); _log((e && e.stack ? e.stack : '').split('\n').slice(0, 6).join('\n')); process.exit(1); }

if (__OUT) {
    fs.writeFileSync(path.join(__dirname, 'es_brain.json'), JSON.stringify(__OUT.brainJSON));
    const m = { baseline: __OUT.baseline, final: __OUT.final, kesif: __OUT.kesif, nparams: __OUT.nparams, sizes: __OUT.sizes, gens: __OUT.gens };
    fs.writeFileSync(path.join(__dirname, 'es_report.json'), JSON.stringify(m, null, 2));
    _log('\n═══ ES SONUÇ ═══');
    _log('başlangıç fitness : ' + __OUT.baseline);
    _log('son fitness       : ' + __OUT.final);
    _log('KEŞİF (Δ)         : ' + __OUT.kesif + (__OUT.kesif > 0 ? '  ✓ AI kuralın ötesinde YENİ kazanan davranış buldu' : '  ✗ iyileşme yok (daha çok nesil/pop gerek)'));
    _log('ağırlık → train/es_brain.json (' + __OUT.nparams + ' param)');
} else { console.error('__OUT boş'); }
