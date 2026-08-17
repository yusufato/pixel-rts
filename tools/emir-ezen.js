'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  EMRİ KİM EZİYOR? — `_laUntilTick` bağlanmadan ÖNCE zorunlu teşhis
//
//  Önceki ölçüm (tools/emir-omru.js) yalnız ÖMRÜ verdi: medyan 11 tik, %27'si 2 tik
//  içinde. Ama "emir öldü" tanımı `manualMoveTarget değişti` idi — bu üç FARKLI olayı
//  tek torbaya koyuyor:
//     (a) başka bir kod emri EZDİ           → gerçek kusur
//     (b) birim hedefe VARDI, hedef temizlendi → emir YERİNE GETİRİLDİ, kusur değil
//     (c) arama kendi emrini yeniledi (periyot) → normal
//  (b) özellikle tehlikeli bir karışım: arama "yerinde kal" derse hedef = birimin kendi
//  konumu olur ve bir sonraki tikte temizlenir. O da "2 tikte ezildi" diye sayılır.
//
//  Bu araç üçünü AYIRIR ve ezen kodu YERİYLE gösterir (Unit.prototype üzerine erişimci
//  konur, ezme anında yığın izi alınır). Ayrıca ezmenin MEŞRU olup olmadığına dair
//  bağlam toplar: birim kaçıyor mu, baskı altında mı, düşman ne kadar yakın, yeni hedef
//  aynı yönde mi.
//
//  ÇIKTI kararı belirler: ezme çoğunlukla (b) ise "emir ömrü" diye bir kusur YOKTUR ve
//  bağlamak zararlıdır. Gerçek ezme baskınsa, HANGİ kod yerinin kapatılacağı belli olur.
//
//    node tools/emir-ezen.js --mac 3 --tohumofs 100600
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 3)) || 3);
const OFS = Number(arg('--tohumofs', 100600)) || 100600;
const MAX_TIK = Number(arg('--maxtik', 3600)) || 3600;
// --koruma N : BATTLE_LA_EMIR_KORUMA bit maskesi (1 MOVE · 2 HOLD · 4 ATTACK · 8 SERBEST)
// Mekanizma kapısı: koruma EZME'yi VARIS'a çeviriyor mu? Yalnız ömrü uzatıp varış
// üretmiyorsa birim yerinde çakılı kalıyor demektir — o zaman koruma zararlıdır.
const KORUMA = Math.max(0, Number(arg('--koruma', 0)) || 0);

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

const kod = (seed) => `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  battleDeployManifest(battleBuildArmyManifest(6500,{maxUnits:48,combatFocused:true,varied:true,
    brainIntel4:true,isAttacker:false,pro:false}), false, {source:"ez", ally:true});
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;
  BATTLE_LA_EMIR_KORUMA = ${KORUMA};

  // ── ERİŞİMCİ: manualMoveTarget yazımlarını yakala ────────────────────────
  // Prototipe konur; örnek ataması (ctor dahil) buradan geçer, gerçek değer _mmt'de.
  // Fork/restore da buradan geçer ama GÖLGE bayrağıyla elenir.
  const OLAY = [];
  let IZLE = false;
  Object.defineProperty(Unit.prototype, 'manualMoveTarget', {
    configurable: true,
    get() { return this._mmt === undefined ? null : this._mmt; },
    set(v) {
      const iz = this._laIz;
      this._mmt = v;
      if (!IZLE || !iz || BATTLE_SIM_GOLGE) return;
      if (v && Math.abs(v.x - iz.x) < 1 && Math.abs(v.y - iz.y) < 1) return;   // aynı emir
      this._laIz = null;
      // ── ezen kod yeri: yığın izinde erişimcinin ÜSTÜNDEKİ ilk js/ karesi
      let yer = '?';
      const st = (new Error()).stack || '';
      const sat = st.split('\\n');
      for (let i = 1; i < sat.length; i++) {
        const m = /\\(?((?:js|tools)[\\/\\\\][^\\s:)]+:\\d+):\\d+\\)?$/.exec(sat[i].trim());
        if (!m) continue;
        if (/BattleSession\\.js:8[0-9][0-9]/.test(m[1])) continue;    // fork/restore gürültüsü
        if (i === 1) continue;                                       // erişimcinin kendisi
        yer = m[1].replace(/\\\\/g, '/');
        break;
      }
      // ── bağlam: ezme MEŞRU mu? ──────────────────────────────────────────
      const dxE = iz.x - this.x, dyE = iz.y - this.y;
      const kalan = Math.hypot(dxE, dyE);                 // emredilen hedefe KALAN yol
      let ayniYon = null;
      if (v) {
        const dxY = v.x - this.x, dyY = v.y - this.y;
        const n1 = Math.hypot(dxE, dyE) || 1, n2 = Math.hypot(dxY, dyY) || 1;
        ayniYon = (dxE * dxY + dyE * dyY) / (n1 * n2);    // kosinüs: +1 aynı yön, -1 ters
      }
      let dus = 9999;
      for (const o of SIM.units) {
        if (o.dead || o.isRed === this.isRed) continue;
        const d = Math.hypot(o.x - this.x, o.y - this.y);
        if (d < dus) dus = d;
      }
      OLAY.push({
        yer: yer, yas: SIM.tick - iz.tik, d0: Math.round(iz.d0), kalan: Math.round(kalan),
        bosalt: v ? 0 : 1, yon: ayniYon === null ? null : +ayniYon.toFixed(3),
        kac: this.isFleeing ? 1 : 0, bas: (this.suppression || 0) > 20 ? 1 : 0,
        dus: Math.round(dus), tip: this.type
      });
    }
  });

  let st = 0, verilen = 0;
  IZLE = true;
  while (SIM.tick < ${MAX_TIK} && phase === PHASE.BATTLE) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    battleLookaheadTick(st);
    // arama bu tikte emir verdiyse izlemeye al (emir ver -> _laUntilTick damgası)
    for (const u of SIM.units) {
      if (u.dead || !u.isRed) continue;
      if ((u._laUntilTick|0) !== SIM.tick + LA_EMIR_SURESI) continue;
      const t = u.manualMoveTarget;
      if (!t) continue;
      u._laIz = { tik: SIM.tick, x: t.x, y: t.y, d0: Math.hypot(t.x - u.x, t.y - u.y) };
      verilen++;
    }
  }
  IZLE = false;
  // hâlâ yaşayan emirler: ezilmediler
  let yasayan = 0;
  for (const u of SIM.units) if (u._laIz) yasayan++;
  return JSON.stringify({ seed:${seed}, verilen, yasayan, olay: OLAY,
    periyot: (typeof LA_PERIYOT_TIK !== 'undefined' ? LA_PERIYOT_TIK : null),
    sure: LA_EMIR_SURESI, tik: SIM.tick });
})()`;

const hepsi = [];
let verilenT = 0, yasayanT = 0;
for (let i = 0; i < MAC; i++) {
    const seed = OFS + i;
    let r;
    const t0 = Date.now();
    try { r = JSON.parse(vm.runInContext(kod(seed), ctx, { filename: 'ez-' + seed + '.js' })); }
    catch (e) { console.log('  ! mac ' + seed + ': ' + e.message); continue; }
    verilenT += r.verilen; yasayanT += r.yasayan;
    for (const o of r.olay) hepsi.push(o);
    console.log('  mac ' + seed + ': ' + r.verilen + ' emir, ' + r.olay.length + ' ezme, ' +
        r.tik + ' tik, ' + Math.round((Date.now() - t0) / 1000) + 'sn' +
        (i === 0 ? '   (periyot ' + r.periyot + ' tik, emir suresi ' + r.sure + ')' : ''));
}
if (!hepsi.length) { console.log('  olay yok'); process.exit(0); }

// ── SINIFLANDIRMA ──────────────────────────────────────────────────────────
// VARIS: emredilen hedefe kalan yol < 60px  -> emir YERINE GETIRILDI (kusur degil)
// KAL  : emir zaten "yerinde kal" idi (d0 < 40) -> hedef bir sonraki tikte temizlenir
// EZME : gercek ezme
const VARIS_R = 60, KAL_R = 40;
const sinif = (o) => (o.d0 < KAL_R ? 'KAL' : (o.kalan < VARIS_R ? 'VARIS' : 'EZME'));
const grup = { KAL: [], VARIS: [], EZME: [] };
for (const o of hepsi) grup[sinif(o)].push(o);

const med = (a) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const yuz = (n, t) => '%' + (t ? (n / t * 100).toFixed(1) : '0.0');

console.log('');
console.log('TOPLAM: ' + verilenT + ' emir verildi, ' + hepsi.length + ' tanesi degisti, ' +
    yasayanT + ' mac sonunda hala yasiyordu');
console.log('');
console.log('  === EMIR NEDEN BITTI ===');
for (const k of ['KAL', 'VARIS', 'EZME']) {
    const g = grup[k];
    const ad = k === 'KAL' ? 'KAL emri (hedef=kendi yeri, hemen temizlenir)'
        : k === 'VARIS' ? 'VARIS (hedefe ulasti — emir YERINE GETIRILDI)'
            : 'GERCEK EZME (yol yarida kesildi)';
    console.log('    ' + k.padEnd(6) + ' ' + String(g.length).padStart(5) + '  ' +
        yuz(g.length, hepsi.length).padStart(6) + '   medyan yas ' +
        String(med(g.map(o => o.yas))).padStart(4) + ' tik   ' + ad);
}

// ── MEKANİZMA KAPISI: koruma EZME'yi VARIS'a çeviriyor mu? ────────────────
// Doğru ölçü "emir ne kadar yaşadı" DEĞİL — emir YERİNE GETİRİLDİ mi. Koruma ömrü
// uzatıp varış üretmiyorsa birim yolda çakılı kalıyordur ve koruma zarardır.
console.log('');
console.log('  === MEKANIZMA (koruma = ' + KORUMA + ') ===');
console.log('    verilen emir           : ' + verilenT);
console.log('    HEDEFE VARAN           : ' + grup.VARIS.length + '  ' + yuz(grup.VARIS.length, verilenT) + ' (verilen emre gore)');
console.log('    yolda kesilen          : ' + grup.EZME.length + '  ' + yuz(grup.EZME.length, verilenT));
console.log('    mac sonunda hala yolda : ' + yasayanT + '  ' + yuz(yasayanT, verilenT));

const ez = grup.EZME;
if (!ez.length) { console.log('\n  GERCEK EZME YOK -> "emir omru" kusuru DOGRULANMADI.'); process.exit(0); }

console.log('');
console.log('  === GERCEK EZMEYI KIM YAPIYOR (' + ez.length + ' olay) ===');
const yerG = new Map();
for (const o of ez) { if (!yerG.has(o.yer)) yerG.set(o.yer, []); yerG.get(o.yer).push(o); }
const sirali = [...yerG.entries()].sort((a, b) => b[1].length - a[1].length);
console.log('    ' + 'kod yeri'.padEnd(30) + 'adet'.padStart(6) + '   pay   medyan yas  ters yon  bosalt  kaciyor  dusman<400');
for (const [yer, g] of sirali.slice(0, 14)) {
    const ters = g.filter(o => o.yon !== null && o.yon < 0).length;
    const bos = g.filter(o => o.bosalt).length;
    const kac = g.filter(o => o.kac).length;
    const yak = g.filter(o => o.dus < 400).length;
    console.log('    ' + yer.padEnd(30) + String(g.length).padStart(6) + '  ' +
        yuz(g.length, ez.length).padStart(6) + '   ' + String(med(g.map(o => o.yas))).padStart(6) + ' tik  ' +
        yuz(ters, g.length).padStart(7) + '  ' + yuz(bos, g.length).padStart(6) + '  ' +
        yuz(kac, g.length).padStart(7) + '  ' + yuz(yak, g.length).padStart(9));
}

// ── MESRULUK ÖZETİ ─────────────────────────────────────────────────────────
const mesru = ez.filter(o => o.kac || o.bas || o.dus < 300).length;
const ayniYon = ez.filter(o => o.yon !== null && o.yon > 0.5).length;
const zararli = ez.filter(o => !(o.kac || o.bas || o.dus < 300) && (o.yon === null || o.yon < 0.5)).length;
console.log('');
console.log('  === MESRULUK ===');
console.log('    tepki sayilabilir (kaciyor / baski / dusman<300px) : ' + mesru + '  ' + yuz(mesru, ez.length));
console.log('    yeni hedef AYNI yonde (kosinus>0.5, zarar sinirli): ' + ayniYon + '  ' + yuz(ayniYon, ez.length));
console.log('    ACIKLANAMAYAN ezme (tepki yok + yon farkli)       : ' + zararli + '  ' + yuz(zararli, ez.length) +
    '   <- kapatilacak kisim BU');
console.log('    aciklanamayan ezmenin verilen emre orani          : ' + yuz(zararli, verilenT));
