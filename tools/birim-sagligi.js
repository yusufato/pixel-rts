// 26 BIRIMIN TOPLU SAGLIK KONTROLU (kullanici: "bakilmamis birimleri sirala, sorunlarini raporla")
// Tek tek av yerine HEPSINI BIRDEN tarar. Her birim tipi icin:
//   ATIS      : silahini kullaniyor mu (0 = hic ates etmiyor -> kirmizi bayrak)
//   HEDEFLI%  : menzilinde vurulabilir hedefi olan tik orani
//   BOSTA%    : muhimmati VARKEN hedefsiz gecen tik orani
//   OMUR      : ortalama yasam suresi (sn)
//   GETIRI    : imha ettigi dusman degeri / kendi maliyeti (forensik attackerId+lethal ile atfedilir)
//   TAMYUKLE% : olurken muhimmati doluysa (hic kullanilmadan olmus)
// Silahsiz birimler (komuta/ikmal/radar/EH/saglikci/nakliye/dron-operatoru) icin ATIS/GETIRI
// anlamsizdir; onlar OMUR ile degerlendirilir ve tabloda "-" gorunur.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();

const _si = process.argv.indexOf('--seeds');
const TOHUMLAR = _si >= 0 ? process.argv[_si + 1].split(',').map(Number) : [2024, 3141, 777];

// TUM BIRIMLERI SAHAYA SOKAN TARIF: her tipten en az 1 zorunlu, butce esit dagitilir.
// loitering_munition dron-operatoru tarafindan URETILIR, dogrudan konuslandirilmaz -> disarida.
const TUM = JSON.parse(vm.runInContext(
    '(() => { const o = []; for (const t in STATS) { const s = STATS[t]; if (s && s.id) o.push(s.id); } return JSON.stringify(o); })()',
    ctx, { filename: 'roster.js' }));
// KURGU DUZELTMESI: ilk surumde 26 birimin HEPSI ayni 6500 TL'lik orduya zorlanmisti ->
// "her tipten bir tane" gibi anlamsiz bir ordu cikiyor (kutle yok) ve HER birim kotu gorunuyor
// (MBT bile getiri x0). Gercekci olcum icin ordular NORMAL kurulur; nadir birimler ise
// --zorunlu ile normal bir ordunun icine 1-2 adet sokulur.
// DOGAL ORDU KOLU: bu arac kendi TARIFINI kuruyordu; o kurgu birim omurlerini carpitiyor
// (IFV omru tarifte 57sn, AI'nin DOGAL ordusunda 228sn olculdu). Karar verilecekse AI'nin
// gercekten kurdugu ordu esas alinmali.
const DOGAL = process.argv.includes('--dogal');
const CESITSIZ = process.argv.includes('--cesitsiz');   // cesitlilik ZORLAMASI kapali (AI'nin gercek ordusu)
const NOSPOT = process.argv.includes('--nospotter');   // gozcu kurali KAPALI kolu
const _zi = process.argv.indexOf('--zorunlu');
const ZORUNLU = _zi >= 0 ? process.argv[_zi + 1].split(',').filter(Boolean) : [];
// KURGU HATASI 2 (olculdu ve duzeltildi): `zorunlu`-only tarif orduyu DOLDURMUYOR - 6500 TL ile
// yalnizca 5 birim kuruluyor (2 sinanan + 3 gozcu), butcenin cogu harcanmadan kaliyor ve HER birim
// bozuk gorunuyor. Gercek paylar (ORN-244) tabana eklenir.
const GERCEKCI_TABAN = JSON.parse(require('fs').readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));
const tarif = ZORUNLU.length ? Object.assign({ ad: 'TARAMA', rol: 'attacker', zorunlu: {}, tavan: {}, artik: [] }, GERCEKCI_TABAN) : null;
if (tarif) for (const id of ZORUNLU) tarif.zorunlu[id] = 1;

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_INTEL4PRO_DELTAS.spotterRequirement = ' + (!NOSPOT) + ';',
    'const tarif = ' + JSON.stringify(tarif) + ';',
    'const say = {};',
    'for (const seed of ' + JSON.stringify(TOHUMLAR) + ') {',
    DOGAL ? '  BATTLE_RECIPE_RED = null;' : '  BATTLE_RECIPE_RED = tarif;',
    // KURGU UYARISI (olculdu): tarif yokken BATTLE_FORCE_VARIED=true "her tipten biraz" ordusu
    // kuruyor -> kutle yok, birimler ince yayiliyor ve SORUNLU gorunuyor. IFV omru bu kipte 57sn,
    // AI'nin GERCEK ordusunda 228sn. --cesitsiz ile zorlama kapatilir (karar bu kolda verilmeli).
    (CESITSIZ ? '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;'
              : '  if (!tarif && typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;'),
    '  openBattlefieldSession({ mode:"quick", mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    '  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"bs", ally:true });',
    '  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
    '  startBattle();',
    '  const izle = new Map();',
    '  for (const u of SIM.units) { if (!u.isRed) continue; const s = STATS[u.type]; if (!s) continue;',
    '    izle.set(u.id, { id:s.id, mal:s.cost||0, maxAmmo:u.maxAmmo||0, onceki:u.ammo,',
    '      atis:0, sonAtisT:u.lastAttackTime||0, canli:0, hedefli:0, bosta:0, imha:0, oldu:null, sonAmmo:u.ammo, hp:u.hp, maxHp:u.maxHp, emilen:0 }); }',
    '  let sonSeq = -1;',
    '  const ph = SIM.headless; SIM.headless = true; let st = 0;',
    '  try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
    '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '    if (typeof BATTLE_FORENSIC !== "undefined" && BATTLE_FORENSIC.buf) {',
    '      for (const ev of BATTLE_FORENSIC.buf) { if (ev.seq <= sonSeq) continue; sonSeq = ev.seq;',
    '        if (!ev.lethal) continue; const rr = izle.get(ev.attackerId); if (!rr) continue;',
    '        const cs = STATS[ev.targetType]; rr.imha += (cs && cs.cost) || 0; } }',
    '    const gor = new Set();',
    '    for (const u of SIM.units) { const r = izle.get(u.id); if (!r) continue; gor.add(u.id);',
    '      if (u.dead) { if (r.oldu === null) r.oldu = SIM.tick; continue; }',
    '      r.canli++;',
    '      if (r.onceki != null && u.ammo < r.onceki) r.atis += (r.onceki - u.ammo);',
    // OLCUM DUZELTMESI: ATIS muhimmat AZALMASINDAN sayiliyordu; infantry/commando/engineer
    // muhimmati SINIRSIZ (ammo null) -> farki hep 0 -> "hic ates etmiyor" YANILSAMASI (SAM'deki
    // "0 atis" hatasinin ayni sinifi). Gercek sayac: lastAttackTime degisimi.
    '      if ((u.lastAttackTime||0) !== r.sonAtisT) { r.sonAtisT = u.lastAttackTime||0; if (!(r.maxAmmo > 0)) r.atis++; }',
    '      r.onceki = u.ammo; r.sonAmmo = u.ammo;',
    '      if (u.hp < r.hp) r.emilen += (r.hp - u.hp);',
    '      r.hp = u.hp;',
    '      if (SIM.tick % 10) continue;',
    '      const s = STATS[u.type];',
    '      if (!s || !s.weapons || !s.weapons.length) continue;',
    '      let hedefVar = false;',
    '      const minR = s.minRange || 0;',
    '      for (const e of SIM.units) { if (e.dead || e.loaded || e.isRed) continue;',
    '        const d = Math.hypot(e.x - u.x, e.y - u.y);',
    '        if (d > u.range || d < minR) continue;',
    '        if (typeof unitCanEngage === "function" && !unitCanEngage(s, STATS[e.type])) continue;',
    '        hedefVar = true; break; }',
    '      if (hedefVar) r.hedefli++; else if (!r.maxAmmo || u.ammo > 0) r.bosta++; }',
    '    for (const [id, r] of izle) if (!gor.has(id) && r.oldu === null) r.oldu = SIM.tick;',
    '  } } finally { SIM.headless = ph; }',
    '  for (const [, r] of izle) {',
    '    const k = r.id;',
    '    if (!say[k]) say[k] = { mal:r.mal, n:0, atis:0, canli:0, hedefli:0, bosta:0, imha:0, omurTik:0, tamYukle:0, maxAmmo:r.maxAmmo, silahli:0, emilen:0 };',
    '    const a = say[k]; a.n++; a.atis += r.atis; a.canli += r.canli; a.hedefli += r.hedefli; a.bosta += r.bosta;',
    '    a.imha += r.imha; a.omurTik += (r.oldu != null ? r.oldu : SIM.tick); a.emilen += r.emilen;',
    '    if (r.oldu != null && r.maxAmmo > 0 && r.sonAmmo >= r.maxAmmo) a.tamYukle++; }',
    '}',
    'const silahli = {};',
    'for (const t in STATS) { const s = STATS[t]; if (s && s.id) silahli[s.id] = !!(s.weapons && s.weapons.length); }',
    'return JSON.stringify({ say, silahli });',
    '})()'
].join('');

const { say, silahli } = JSON.parse(vm.runInContext(kod, ctx, { filename: 'bs.js' }));
const satir = Object.entries(say).map(([id, a]) => ({
    id, mal: a.mal, adet: a.n, silahli: !!silahli[id],
    atis: a.atis / a.n,
    hedefli: (a.hedefli + a.bosta) ? a.hedefli / (a.hedefli + a.bosta) : null,
    bosta: (a.hedefli + a.bosta) ? a.bosta / (a.hedefli + a.bosta) : null,
    omur: a.omurTik / a.n * 0.05,
    getiri: a.mal ? a.imha / (a.mal * a.n) : null,
    emilen: a.emilen / a.n,
    emilenBirimTL: a.mal ? a.emilen / (a.mal * a.n) : null,
    tamYukle: a.n ? a.tamYukle / a.n : 0,
    maxAmmo: a.maxAmmo
}));

console.log('BIRIM SAGLIK KONTROLU — ' + TOHUMLAR.length + ' tohum, ' + satir.length + ' birim' + (ZORUNLU.length ? '   [zorunlu: ' + ZORUNLU.join(',') + ']' : '   [normal ordular]'));
console.log('  getiri = imha edilen dusman degeri / maliyet   |   EMILEN = ustune cektigi hasar / maliyet');
console.log('  (EMILEN sutunu, PERDE/ekran birimlerini olculebilir kilar - IFV getiri x0.05 ama onu');
console.log('   orduDAN CIKARMAK kompozisyon testinde KOTU cikti: 35/48 -> 29-34/48.)');
console.log('');
console.log('  birim'.padEnd(26) + 'maliyet'.padStart(8) + '   ATIS'.padStart(7) + ' hedefli'.padStart(9) + '  bosta'.padStart(7) + '   omur'.padStart(7) + '  GETIRI'.padStart(8) + '  EMILEN'.padStart(9) + ' tamYuk'.padStart(8));
const sirali = satir.sort((a, b) => {
    if (a.silahli !== b.silahli) return a.silahli ? -1 : 1;
    return (a.getiri == null ? 9 : a.getiri) - (b.getiri == null ? 9 : b.getiri);
});
for (const x of sirali) {
    const bayrak = [];
    if (x.silahli && x.maxAmmo > 0 && x.atis < 0.5) bayrak.push('HIC ATES ETMIYOR');
    if (x.silahli && x.getiri != null && x.getiri < 0.35) bayrak.push('dusuk getiri');
    if (x.silahli && x.bosta != null && x.bosta > 0.6) bayrak.push('cogunlukla BOSTA');
    if (x.tamYukle > 0.5) bayrak.push('TAM YUKLE oluyor');
    if (!x.silahli && x.omur < 90) bayrak.push('erken oluyor');
    console.log('  ' + x.id.padEnd(24) + String(x.mal).padStart(8) +
        (x.silahli ? (Math.round(x.atis * 10) / 10).toString() : '-').padStart(7) +
        (x.hedefli != null ? '%' + Math.round(x.hedefli * 100) : '-').padStart(9) +
        (x.bosta != null ? '%' + Math.round(x.bosta * 100) : '-').padStart(7) +
        (Math.round(x.omur) + 'sn').padStart(7) +
        (x.silahli && x.getiri != null ? 'x' + (Math.round(x.getiri * 100) / 100) : '-').padStart(8) +
        (x.emilenBirimTL != null ? (Math.round(x.emilenBirimTL * 100) / 100).toString() : '-').padStart(9) +
        (x.maxAmmo > 0 ? '%' + Math.round(x.tamYukle * 100) : '-').padStart(8) +
        (bayrak.length ? '   << ' + bayrak.join(', ') : ''));
}
