'use strict';
// POLITIKA KOPRUSU — JS TARAFI. Verilen kayitlar icin JS ileri-gecisinin logitlerini basar.
// Tek basina anlami yok; `tools/politika-kopru-kapisi.py` bunu kosturup PyTorch ciktisiyla
// karsilastirir. Ayri dosya olmasinin sebebi: JS motoru Python'dan gomulu kod olarak degil
// GERCEK require yoluyla yuklensin — kopru testi uretimdeki kod yolunun AYNISINI sinamali.
//
//   node tools/politika-kopru-js.js --veri qa-runtime/politika/veri-0.jsonl --n 64
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const VERI = arg('--veri', 'qa-runtime/politika/veri-0.jsonl');
const N = Math.max(1, Number(arg('--n', 64)) || 64);
const ROOT = path.resolve(__dirname, '..');

// battlePolicyNetHazir() ozniteligin varligini da sorar; kopru testinde r/s/b DOGRUDAN
// veriliyor, o yuzden yalnizca varlik sartini karsilayan bir yer tutucu yeterli.
global.battleDurumOzellik = function () { return null; };
const { BATTLE_POLICY_MODEL } = require(path.join(ROOT, 'js', 'BattlePolicyModel.js'));
global.BATTLE_POLICY_MODEL = BATTLE_POLICY_MODEL;
const { battlePolicyNetLogit } = require(path.join(ROOT, 'js', 'BattlePolicyNet.js'));

const satirlar = fs.readFileSync(VERI, 'utf8').split('\n').filter(Boolean);
// Bastan degil ESIT ARALIKLA ornekle: bir macin ilk N karari birbirine cok benzer,
// esit-hatanin gizlenebilecegi en kolay yer orasidir.
const adim = Math.max(1, Math.floor(satirlar.length / N));
const cikti = [];
for (let i = 0; i < satirlar.length && cikti.length < N; i += adim) {
    let d;
    try { d = JSON.parse(satirlar[i]); } catch (e) { continue; }
    if (!d.b) continue;
    const lg = battlePolicyNetLogit(d.r, d.s, d.b);
    if (!lg) { console.error('JS ileri-gecis null dondu (satir ' + i + ')'); process.exit(1); }
    cikti.push({ i, logit: Array.from(lg) });
}
process.stdout.write(JSON.stringify({ veri: VERI, n: cikti.length, ornek: cikti }));
