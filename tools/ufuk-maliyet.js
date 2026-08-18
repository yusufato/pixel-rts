'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  UFUK MALİYETİ — "ufku 200'e çıkarmak işçiye kaça mal oluyor?"
//
//  NEDEN: ufuk 100→200 KANITLANDI (H3 tek başına +874 t 3.13 taban 783 · D+H3 havuz
//  +603 t 3.13 n=256 taban 540) ve `js/lookahead-worker.js`'te uygulandı. Ama kazanç
//  tezgâhta ölçüldü — tezgâhta GERÇEK ZAMAN YOK. Canlı oyunda ufku ikiye katlamak
//  rollout maliyetini de ikiye katlar; bu, köprünün uyarlamalı ÖNGÖRÜ PENCERESİNİ
//  büyütür, pencere büyüyünce öngörü sapması artar. Yani kazanç bedava değil.
//
//  ⚠ ÖLÇÜM TUZAĞI (bu araç ona göre tasarlandı): mutlak ms değeri makinenin o anki
//  yüküne bağlıdır — gece kuyruğu 16 node süreci koşarken alınan rakam şişer. Bu yüzden
//  üç ufuk AYNI SÜREÇTE, AYNI durumdan, sırayla ölçülür ve karar ORANA bakar. Oran
//  yükten bağımsızdır; mutlak değer yalnız bilgi olarak basılır.
//
//  Her ölçüm noktasında: fork al → ufuk U ile arama → fork'u geri yükle → sonraki U.
//  Böylece üç ufuk da BİREBİR aynı dünyadan başlar (yoksa ilk aramanın verdiği emirler
//  ikinciyi etkiler ve kıyas bozulur).
//
//    node tools/ufuk-maliyet.js [--tohum 730000] [--nokta 4] [--ufuklar 100,200,300]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--tohum', 730000)) || 730000;
const NOKTA = Math.max(1, Number(arg('--nokta', 4)) || 4);
const ARA = Number(arg('--ara', 500)) || 500;
const UFUKLAR = String(arg('--ufuklar', '100,200,300')).split(',').map(Number).filter(Boolean);

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${SEED}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"um", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;
  // İŞÇİNİN AYARI (lookahead-worker.js ile birebir) — ufuk dışında hepsi sabit
  LA_DERIN = 2; LA_TIK_BIRIM = 0; LA_BIRIM = 20; LA_TUR_BIRIM = 0;

  const UF = ${JSON.stringify(UFUKLAR)};
  const olcum = [];
  let st = 0, nokta = 0;
  while (SIM.tick < ${(NOKTA + 1) * ARA + 50} && phase === PHASE.BATTLE && nokta < ${NOKTA}) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    if (SIM.tick % ${ARA} !== 0 || SIM.tick === 0) { battleLookaheadTick(st); continue; }
    nokta++;

    const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
    const temiz = battleForkCapture();          // üç ufuk da BU durumdan başlayacak
    const sat = { tik: SIM.tick, birim: SIM.units.filter(u => !u.dead).length, sure: {}, emir: {} };
    for (const u of UF) {
      battleForkRestore(JSON.parse(JSON.stringify(temiz)));
      LA_UFUK = u;
      const e0 = (typeof BATTLE_LA_SAYAC !== "undefined") ? (BATTLE_LA_SAYAC.emir | 0) : 0;
      const t0 = Date.now(); battleLookaheadTick(st); const dt = Date.now() - t0;
      const e1 = (typeof BATTLE_LA_SAYAC !== "undefined") ? (BATTLE_LA_SAYAC.emir | 0) : 0;
      sat.sure[u] = dt; sat.emir[u] = e1 - e0;
    }
    battleForkRestore(JSON.parse(JSON.stringify(temiz)));   // gerçek maça temiz dön
    LA_UFUK = UF[0];
    BATTLE_SIM_GOLGE = _g;
    olcum.push(sat);
  }
  return JSON.stringify({ seed:${SEED}, uf:UF, olcum });
})()`;

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'um.js' }));
console.log('');
console.log('UFUK MALİYETİ — tohum ' + r.seed + '   (LA_DERIN 2 · LA_BIRIM 20 — işçi ayarı)');
console.log('');
console.log('  ' + 'tik'.padStart(6) + 'birim'.padStart(7) +
    r.uf.map(u => ('ufuk ' + u).padStart(12)).join('') + '     emir (' + r.uf.join('/') + ')');
for (const o of r.olcum) {
    console.log('  ' + String(o.tik).padStart(6) + String(o.birim).padStart(7) +
        r.uf.map(u => (o.sure[u] + 'ms').padStart(12)).join('') +
        '     ' + r.uf.map(u => o.emir[u]).join('/'));
}
if (!r.olcum.length) { console.log('  ölçüm yok'); process.exit(0); }
const ort = (u) => r.olcum.reduce((s, o) => s + o.sure[u], 0) / r.olcum.length;
const taban = ort(r.uf[0]);
console.log('');
console.log('  ORTALAMA TUR SÜRESİ:');
for (const u of r.uf) {
    console.log('    ufuk ' + String(u).padEnd(5) + Math.round(ort(u)) + 'ms' +
        '   × ' + (ort(u) / Math.max(1, taban)).toFixed(2) + ' (ufuk ' + r.uf[0] + "'e göre)");
}
console.log('');
console.log('  ⚠ MUTLAK ms MAKİNE YÜKÜNE BAĞLIDIR — karar ORAN satırına bakar.');
console.log('     Beklenti: ufuk doğrusal maliyet, yani 200 ≈ ×2.0, 300 ≈ ×3.0.');
console.log('     ×2\'den BELİRGİN büyükse ufuk yalnız rollout\'u değil başka bir şeyi de');
console.log('     büyütüyor demektir (ör. derinleşen dal) — o zaman canlı bütçe yeniden ölçülmeli.');
const o200 = r.uf.includes(200) ? ort(200) / Math.max(1, taban) : null;
if (o200 != null) {
    console.log('');
    console.log('  KARAR: ufuk 200 maliyeti ×' + o200.toFixed(2) +
        (o200 <= 2.4 ? '  → DOĞRUSAL, işçi bunu kaldırır (kazanç +603 bedeli bu).'
                     : '  → BEKLENENDEN PAHALI, canlı pencere ölçülmeli.'));
}
console.log('');
