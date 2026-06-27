// ── NATIVE (vm-siz) SİM-HIZ ÖLÇÜMÜ — vm ek-yükü hipotezini test eder ──
// Tüm dosyaları TEK eval'de birleştirir; top-level const/let/class→var (TDZ-yok → guard'lar çalışır,
// tek scope'ta paylaşım). Native V8 JIT (vm sınırı yok). NOT: 'use strict' YOK (oyun kodu sloppy koşsun).
const fs = require('fs');
const path = require('path');
const os = require('os');

const NOOP = new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : (p === 'length' ? 0 : NOOP)),
  apply: () => NOOP, set: () => true, construct: () => NOOP, has: () => true,
});
function shim(name, val) {
  try { if (typeof globalThis[name] === 'undefined' || globalThis[name] === null) globalThis[name] = val; }
  catch (e) { try { Object.defineProperty(globalThis, name, { value: val, writable: true, configurable: true }); } catch (_) {} }
}
shim('window', globalThis); shim('self', globalThis); shim('document', NOOP);
shim('navigator', { userAgent: 'node', hardwareConcurrency: os.cpus().length });
shim('location', { href: '', search: '', hash: '' });
shim('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
shim('sessionStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
shim('requestAnimationFrame', () => 0); shim('cancelAnimationFrame', () => {});
shim('addEventListener', () => {}); shim('removeEventListener', () => {});
shim('setTimeout', () => 0); shim('clearTimeout', () => {}); shim('setInterval', () => 0); shim('clearInterval', () => {}); shim('queueMicrotask', (f) => { try { f(); } catch (e) {} });
shim('Image', function () { return NOOP; }); shim('Audio', function () { return NOOP; });
shim('alert', () => {}); shim('confirm', () => true); shim('prompt', () => null);

const PROG = path.join(__dirname, 'measure_native_progress.txt');
try { fs.writeFileSync(PROG, ''); } catch (e) {}
globalThis.__log = (m) => { try { fs.appendFileSync(PROG, m + '\n'); } catch (e) {} try { console.log(m); } catch (e) {} };
globalThis.__cores = os.cpus().length;

const files = ['brain.js', 'globals.js', 'MapData.js', 'TacticalAI.js', 'Telemetry.js', 'VFX.js',
  'Support.js', 'Unit.js', 'AI.js', 'Foresight.js', 'LayeredAI.js', 'Commander.js',
  'ControlPoints.js', 'main.js', 'Replay.js', 'SelfPlay.js'];
function transform(src) {
  src = src.replace(/^(const|let)\b/gm, 'var');
  src = src.replace(/^class\s+([A-Za-z_$][\w$]*)/gm, 'var $1 = class $1');
  return src;
}
let bundle = '';
for (const f of files) bundle += `\n//==== ${f} ====\n` + transform(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')) + '\n';

bundle += `
;(function MEASURE(){
  try {
    if (typeof spRunMatch !== 'function') { __log('HATA: spRunMatch yok'); return; }
    var g = (typeof aiGenome !== 'undefined' && aiGenome) ? aiGenome : null;
    var MAXT = 600;
    __log('[native] genome:' + (!!g) + ' MAXT:' + MAXT);
    var ws = Date.now();
    var w = spRunMatch(g, g, null, MAXT, null, 1);
    __log('[native] warm-up: ' + (Date.now()-ws) + 'ms');
    var N = 8, t0 = Date.now(), ticks = 0;
    for (var i = 0; i < N; i++) {
      var ms0 = Date.now();
      var r = spRunMatch(g, g, null, MAXT, null, 1000 + i);
      var tk = (r && (r.ticks || r.tick || r.t)) || MAXT;
      ticks += tk;
      __log('[native] mac ' + (i+1) + '/' + N + ': ' + tk + ' tick, ' + (Date.now()-ms0) + 'ms');
    }
    var dt = (Date.now() - t0) / 1000;
    __log('=== NATIVE OLCUM === tick/sn(1core):' + Math.round(ticks/dt) + ' | core:' + __cores + ' | tick/sn(xcore):' + Math.round(ticks/dt*__cores));
  } catch (e) {
    __log('NATIVE HATA: ' + (e && e.message));
    __log((e && e.stack ? e.stack : '').split('\\n').slice(0,6).join(' | '));
  }
})();
`;

try { (0, eval)(bundle); }
catch (e) {
  console.log('YÜKLEME HATASI:', e && e.message);
  console.log((e && e.stack ? e.stack : '').split('\n').slice(0, 8).join('\n'));
}
