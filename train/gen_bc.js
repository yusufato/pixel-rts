// ═══════════════════════════════════════════════════════════════════════════
//  train/gen_bc.js — NODE HEADLESS SİM KÖPRÜSÜ (davranış-klonlama veri üreteci)
//  Tarayıcı yok: stub'lar + tüm sim dosyalarını TEK eval-scope'unda yükle (üst-seviye
//  const/let paylaşılsın) + headless maç koştur (stepSim) + BrainState girdisi + kural-AI
//  etiketi (intent) topla. Çıktı: train/bc_meta.json (+ istenirse tam veri).
//  Çalıştır: node train/gen_bc.js
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// ── tarayıcı stub'ları: EVRENSEL zincirlenebilir proxy (her DOM/canvas erişimi kendini döner) ──
const noop = function () { };
const NUMERIC = new Set(['width', 'height', 'length', 'offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight',
    'innerWidth', 'innerHeight', 'scrollTop', 'scrollLeft', 'x', 'y', 'top', 'left', 'right', 'bottom', 'devicePixelRatio', 'lineWidth', 'globalAlpha']);
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
        if (p === 'style' || p === 'dataset') return domStub;
        return domStub;                               // her şey domStub → zincir + çağrı + atama hep güvenli
    },
    set: () => true,
    apply: () => domStub,
    has: () => true
});
var localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
var window = new Proxy({ innerWidth: 1366, innerHeight: 768, devicePixelRatio: 1, localStorage: localStorage, location: {}, requestAnimationFrame: noop, cancelAnimationFrame: noop, addEventListener: noop, removeEventListener: noop },
    { get: (t, p) => (p in t ? t[p] : domStub), set: (t, p, v) => { t[p] = v; return true; } });
var document = new Proxy({ readyState: 'complete', getElementById: () => domStub, createElement: () => domStub, createElementNS: () => domStub, querySelector: () => domStub, querySelectorAll: () => [], getElementsByClassName: () => [], getElementsByTagName: () => [], addEventListener: noop, removeEventListener: noop, body: domStub, documentElement: domStub, head: domStub },
    { get: (t, p) => (p in t ? t[p] : domStub), set: (t, p, v) => { t[p] = v; return true; } });
var requestAnimationFrame = noop, cancelAnimationFrame = noop, alert = noop, navigator = { userAgent: 'node' }, performance = { now: () => 0 };

var __OUT = null;   // _bc_loop.js sonucu buraya yazar (aynı eval-scope'u)

// sim dosyaları — yükleme sırası (UI/ağ dosyaları HARİÇ: Net/MP/Screens/Story/Replay)
// NOT: TEK eval-scope'unda üst-seviye let/const TDZ olur → load-anı ileri-referansları
// önlemek için MapImage (MAP_MODE tanımlar) MapData'dan (applyMap onu kullanır) ÖNCE yüklenir.
const FILES = ['brain.js', 'globals.js', 'MapImage.js', 'MapData.js', 'BrainState.js', 'NeuralBrain.js', 'HybridBrain.js',
    'NNController.js', 'TacticalAI.js', 'Telemetry.js', 'VFX.js', 'Support.js', 'Unit.js', 'AI.js',
    'Foresight.js', 'LayeredAI.js', 'Commander.js', 'ControlPoints.js', 'main.js', 'terrainData.js',
    'techTree.js', 'SelfPlay.js'];

let src = '';
for (const f of FILES) {
    const p = path.join(ROOT, 'js', f);
    if (!fs.existsSync(p)) { console.warn('ATLANDI (yok):', f); continue; }
    src += '\n;/*=== ' + f + ' ===*/\n' + fs.readFileSync(p, 'utf8');
}
src += '\n;/*=== _bc_loop.js ===*/\n' + fs.readFileSync(path.join(__dirname, '_bc_loop.js'), 'utf8');

// TARAYICI-DAVRANIŞI TAKLİDİ: tek eval-scope'unda üst-seviye let/const TDZ yapar (tarayıcıda
// ayrı script'ler global-lexical paylaşır, TDZ load-anı tetiklenmez). Üst-seviye (kolon-0)
// let/const → var (hoist=undefined, typeof guard'ları doğru çalışır), class → var X=class.
src = src.replace(/^(const|let)\s+/gm, 'var ');
src = src.replace(/^class\s+([A-Za-z_$][\w$]*)\s*\{/gm, 'var $1 = class {');
src = src.replace(/^class\s+([A-Za-z_$][\w$]*)\s+extends\s+([A-Za-z_$][\w$.]*)\s*\{/gm, 'var $1 = class extends $2 {');

const _log = console.log.bind(console);
console.log = function () { };   // sim-içi Foresight/danışman spam'ini sustur (eğitim hızı)
try {
    eval(src);   // TEK scope → tüm üst-seviye var/function birbirini görür (tarayıcı <script> davranışı)
} catch (e) {
    console.error('EVAL HATA:', e && e.message);
    _log((e && e.stack ? e.stack : '').split('\n').slice(0, 6).join('\n'));
    process.exit(1);
}

if (__OUT) {
    fs.writeFileSync(path.join(__dirname, 'bc_meta.json'), JSON.stringify(__OUT.meta, null, 2));
    if (__OUT.data && process.argv.includes('--full')) fs.writeFileSync(path.join(__dirname, 'bc_data.json'), JSON.stringify(__OUT.data));
    _log('✓ BC üretimi bitti:', JSON.stringify(__OUT.meta));
} else {
    console.error('__OUT boş — _bc_loop.js sonuç yazmadı');
}
