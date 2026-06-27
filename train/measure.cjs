// ── Node-headless SİM-HIZ ÖLÇÜMÜ (Aşama-2 ilk iş: ticks/sn) ──
// Her dosyayı ayrı vm.runInContext ile yükler (tarayıcı <script> davranışı: fonksiyon-hoisting dosya-başına,
// typeof-guard'lar çalışır), top-level const/let/class → var (paylaşılan global + TDZ-yok). Sonra spRunMatch'i zamanlar.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');

const NOOP = new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : (p === 'length' ? 0 : NOOP)),
  apply: () => NOOP, set: () => true, construct: () => NOOP, has: () => true,
});

// ---- vm context (oyunun global'i); vm Math/Date/JSON/Array vb. sağlar, biz host+tarayıcı objelerini ekleriz ----
const sandbox = {
  console,
  performance: { now: () => Date.now() },
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, queueMicrotask: (f) => { try { f(); } catch (e) {} },
  document: NOOP,
  navigator: { userAgent: 'node', hardwareConcurrency: os.cpus().length },
  location: { href: '', search: '', hash: '' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  addEventListener: () => {}, removeEventListener: () => {},
  Image: function () { return NOOP; }, Audio: function () { return NOOP; },
  alert: () => {}, confirm: () => true, prompt: () => null,
  Float32Array, Float64Array, Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, ArrayBuffer, DataView,
  __cores: os.cpus().length,
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// Senkron ilerleme-logu (stdout tamponunu atla → anlık görünür)
const PROG = path.join(__dirname, 'measure_progress.txt');
try { fs.writeFileSync(PROG, ''); } catch (e) {}
sandbox.__log = (m) => { try { fs.appendFileSync(PROG, m + '\n'); } catch (e) {} try { console.log(m); } catch (e) {} };

// top-level const/let/class → var (cross-file paylaşım + TDZ-yok; sadece column-0 bildirimleri)
function transform(src) {
  src = src.replace(/^(const|let)\b/gm, 'var');
  src = src.replace(/^class\s+([A-Za-z_$][\w$]*)/gm, 'var $1 = class $1');
  return src;
}

const files = ['brain.js', 'globals.js', 'MapData.js', 'TacticalAI.js', 'Telemetry.js', 'VFX.js',
  'Support.js', 'Unit.js', 'AI.js', 'Foresight.js', 'LayeredAI.js', 'Commander.js',
  'ControlPoints.js', 'main.js', 'Replay.js', 'SelfPlay.js'];

for (const f of files) {
  let src;
  try { src = transform(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')); }
  catch (e) { console.log('OKUMA HATASI [' + f + ']:', e.message); process.exit(1); }
  try { vm.runInContext(src, sandbox, { filename: f }); }
  catch (e) {
    console.log('YÜKLEME HATASI [' + f + ']:', e && e.message);
    console.log((e && e.stack ? e.stack : '').split('\n').slice(0, 5).join('\n'));
    process.exit(1);
  }
}

// ---- ÖLÇÜM (context içinde koşar; spRunMatch/aiGenome/SP_MAX_TICKS context global'leri) ----
const meas = `
try {
  if (typeof spRunMatch !== 'function') { __log('HATA: spRunMatch tanımlı değil'); }
  else {
    var g = (typeof aiGenome !== 'undefined' && aiGenome) ? aiGenome : null;
    var MAXT = 600;   // kısa maç → hızlı throughput (tick/sn maxTicks'ten bağımsız)
    __log('genome:' + (!!g) + ' MAXT:' + MAXT + ' SP_MAX_TICKS:' + (typeof SP_MAX_TICKS!=='undefined'?SP_MAX_TICKS:'?'));
    var ws = Date.now();
    var w = spRunMatch(g, g, null, MAXT, null, 1);
    __log('warm-up: ' + (Date.now()-ws) + 'ms, donus=' + ((w&&typeof w==='object')?('{'+Object.keys(w).join(',')+'}'):String(w)));
    var N = 8, t0 = Date.now(), ticks = 0;
    for (var i = 0; i < N; i++) {
      var ms0 = Date.now();
      var r = spRunMatch(g, g, null, MAXT, null, 1000 + i);
      var tk = (r && (r.ticks || r.tick || r.tickCount || r.t || r.duration)) || MAXT;
      ticks += tk;
      __log('mac ' + (i+1) + '/' + N + ': ' + tk + ' tick, ' + (Date.now()-ms0) + 'ms');
    }
    var dt = (Date.now() - t0) / 1000;
    __log('=== OLCUM === mac/sn:' + (N/dt).toFixed(2) + ' | tick/sn(1core):' + Math.round(ticks/dt) + ' | core:' + __cores + ' | tick/sn(xcore):' + Math.round(ticks/dt*__cores));
  }
} catch (e) {
  __log('CALISMA HATASI: ' + (e && e.message));
  __log((e && e.stack ? e.stack : '').split('\\n').slice(0,5).join(' | '));
}
`;
vm.runInContext(meas, sandbox, { filename: 'measure' });
