'use strict';
// controlOwner = 'PLAYER' NEREDE SIZIYOR? (replay sapmasinin ikinci sebebi)
// Arama rollout'u birimi gecici olarak PLAYER yapiyor (BattleLookahead.js:511) ve
// battleForkRestore onu geri almasi gerekiyor. Canli kosuda kirmizi bir birimin
// controlOwner'i PLAYER'da KALIYORSA, sizinti yerini yigin iziyle bulalim.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--tohum', 500003)) || 500003;
const MAX_TIK = Number(arg('--maxtik', 1200)) || 1200;
const ARAMA = arg('--arama', '1') !== '0';   // aramasiz kontrol: sizinti aramadan mi geliyor?
const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${SEED}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY_KAYITSIZ = false;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"co", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = ${ARAMA}; BATTLE_LOOKAHEAD_BLUE = false;

  const olay = [], cid = [];
  let IZLE = false;
  // yigin izinden ilk js/ karesi (erisimcinin USTU)
  const _yigin = () => {
    const sat = ((new Error()).stack || '').split(String.fromCharCode(10));
    for (let i = 2; i < sat.length; i++) {
      const m = /\\(?((?:js|tools)[\\/\\\\][^\\s:)]+:\\d+):\\d+\\)?$/.exec(sat[i].trim());
      if (m) return m[1].replace(/\\\\/g, '/');
    }
    return '?';
  };
  Object.defineProperty(Unit.prototype, 'controlOwner', {
    configurable: true,
    get() { return this._co; },
    set(v) {
      const eski = this._co;
      this._co = v;
      if (!IZLE || BATTLE_SIM_GOLGE || v === eski) return;
      const yer = _yigin();
      olay.push({ tik: SIM.tick, id: this.id, yeni: v || '-', eski: eski || '-', yer: yer, kirmizi: this.isRed?1:0, ally: this.ally?1:0 });
    }
  });

  // controllerId de izlenir: controlOwner -> PLAYER yolu (BattleController.js:361) ancak
  // controllerId gecersizlestiginde acilir. Sizinti oradaysa BURADA gorunur.
  Object.defineProperty(Unit.prototype, 'controllerId', {
    configurable: true,
    get() { return this._cid === undefined ? null : this._cid; },
    set(v) {
      const eski = this._cid;
      this._cid = v;
      if (!IZLE || BATTLE_SIM_GOLGE || v === eski) return;
      const yer = _yigin();
      cid.push({ tik: SIM.tick, id: this.id, eski: eski === undefined ? '-' : String(eski),
                 yeni: v === null || v === undefined ? 'NULL' : String(v), yer: yer,
                 kirmizi: this.isRed?1:0, ally: this.ally?1:0 });
    }
  });

  let st = 0;
  IZLE = true;
  const kalanlar = [];
  while (SIM.tick < ${MAX_TIK} && phase === PHASE.BATTLE) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, true);
    // stepSim'den SONRA hala PLAYER kalan KIRMIZI birim = gercek sizinti
    for (const u of SIM.units) {
      if (!u.dead && u.isRed && u.controlOwner === 'PLAYER') kalanlar.push({ tik: SIM.tick, id: u.id });
    }
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    battleLookaheadTick(st);
  }
  IZLE = false;
  return JSON.stringify({ olay: olay.slice(0, 40), toplam: olay.length, cid: cid.slice(-25), cidToplam: cid.length,
    kalan: kalanlar.slice(0, 20), kalanToplam: kalanlar.length, tik: SIM.tick });
})()`;

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'co.js' }));
console.log('controlOwner=PLAYER IZI — tohum ' + SEED + ', ' + r.tik + ' tik');
console.log('  GOLGE DISI controlOwner DEGISIMI: ' + r.toplam);
for (const o of r.olay.slice(0, 25)) {
    console.log('    tik ' + String(o.tik).padStart(5) + '  birim ' + String(o.id).padStart(3) +
        '  ' + (o.kirmizi?'KIRMIZI':'mavi') + (o.ally?'/ally':'') + '  ' + o.eski + ' -> ' + o.yeni + '   ' + o.yer);
}
console.log('');
console.log('  controllerId DEGISIMI: ' + r.cidToplam + ' (son 12)');
for (const o of (r.cid||[]).slice(-12)) {
    console.log('    tik ' + String(o.tik).padStart(5) + '  birim ' + String(o.id).padStart(3) +
        '  ' + (o.kirmizi?'KIRMIZI':'mavi') + (o.ally?'/ally':'') + '  ' + o.eski + ' -> ' + o.yeni + '   ' + o.yer);
}
console.log('');
console.log('  stepSim SONRASI hala PLAYER kalan kirmizi birim-tik: ' + r.kalanToplam);
for (const k of r.kalan.slice(0, 10)) console.log('    tik ' + k.tik + '  birim ' + k.id);
