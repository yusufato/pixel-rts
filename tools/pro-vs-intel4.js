// INTEL4-PRO vs INTEL4 — taraf-basi, eslestirilmis.
// Mezuniyet olcutu (kullanici): >=%75 ustunluk. Bugun 6 motor degisikligi yapildi; pro'nun intel4'e
// karsi durumu yeniden olculmeli (degisikliklerin cogu IKI beyni de etkiliyor, ama pro-deltalari degil).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 12)) || 12);
const ATLA = Math.max(0, Number(arg('--atla', 64)) || 0);
const HAVUZ = []; for (let i = 0; i < 4096; i++) HAVUZ.push(100000 + i * 137);   // havuz 512 iken --atla 448 sessizce 64 tohuma dusuyordu (n=1024 sanip 256 kostum)
// `--tohumlar a,b,c` : acik tohum listesi (paralel kosucu bunu kullanir). `--json <yol>`: mac-basi
// kayitlari dosyaya yaz (birlestirilebilir). Ikisi birlikte tools/kapi-paralel.js'i mumkun kilar.
const TOHUM_LISTE = (arg('--tohumlar', '') || '').split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x) && x > 0);
const JSON_OUT = arg('--json', '');
const TOHUMLAR = TOHUM_LISTE.length ? TOHUM_LISTE : HAVUZ.slice(ATLA, ATLA + N);
// DELTA DENETIMI SONRASI (2026-08-09): 3 delta OLU (spotter/logistics/airBase, 0/24 tetiklenme),
// 5 delta kapatinca KAZANDIRIYOR (+19..+265, hicbiri tek basina anlamli degil ama HEPSI ayni yonde),
// heloHunt tek FAYDALI (-406). `--kapat a,b,c` ile pro tarafinda o deltalar kapatilir.
const KAPAT = (arg('--kapat', '') || '').split(',').map(x => x.trim()).filter(Boolean);
// `--ac a,b` : varsayilani KAPALI olan deltalari pro tarafinda ACAR (yeni yetenek sinamak icin).
// TEK DEGISKEN KURALI: iki kolda ayni --kapat kumesi verilir, yalniz --ac degisir.
const AC = (arg('--ac', '') || '').split(',').map(x => x.trim()).filter(Boolean);
// `--somurucu helo_harass` : PRO tarafinda somurucu davranisi acar (BattleExploiters). intel4 tarafi
// dokunulmaz -> tek degisken. Somurucu havuzu, aynanin insana kor kalmasini gidermek icin yazilmisti;
// burada AMAC farkli: olculmus bir insan ustunlugunu PRO'ya vermek.
const SOM = (arg('--somurucu', '') || '').trim();
// `--ayar "AD=deger;AD2=deger"` : parametre araması (doz-tepki egrisi icin).
const AYAR = (arg('--ayar', '') || '').split(';').map(x => x.trim()).filter(Boolean);
// `--doktrin N` : YALNIZ pro tarafina o doktrini zorlar (9 = 'oyuncu-meta', kullanicinin gercek
// oynayis profilinden turetilmis kompozisyon). BATTLE_FORCE_DOCTRINE global oldugu icin taraf ayrimi
// ZAMANLAMAYLA yapilir: kirmizi oturum acilirken, mavi battleDeployManifest cagrisinda kurulur.
const DOK = arg('--doktrin', '');
// `--butce N` : PRO tarafinin butcesi (intel4 hep 6500). KALIBRASYON icin: '44/48 hedefi kac
// yuzde maddi ustunluge denk geliyor?' Karar-verme ekseninin tavanlari olculdu (hepsi +400 alti);
// bu arac hedefi YORUMLANABILIR bir birime cevirir.
const BUTCE = Math.max(1000, Number(arg('--butce', 6500)) || 6500);
const _ov = KAPAT.map(k => k + ': false').concat(AC.map(k => k + ': true'));
const KAPAT_OBJ = _ov.length ? ('{ ' + _ov.join(', ') + ' }') : 'null';
const { ctx } = tezgahKur();

// proKirmizi=true -> KIRMIZI pro, MAVI duz intel4.  false -> tersi (taraf yanliligi goturulur)
function kos(seed, kirmiziSaldiran, proKirmizi) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = ' + (proKirmizi ? 'true' : 'false') + ';',
        'BATTLE_INTEL4PRO_BLUE = ' + (proKirmizi ? 'false' : 'true') + ';',
        'BATTLE_INTEL4PRO_DELTAS_RED = ' + (proKirmizi ? KAPAT_OBJ : 'null') + ';',
        'BATTLE_INTEL4PRO_DELTAS_BLUE = ' + (proKirmizi ? 'null' : KAPAT_OBJ) + ';',
        SOM ? ('BATTLE_EXPLOITER_' + (proKirmizi ? 'RED' : 'BLUE') + ' = "' + SOM + '"; BATTLE_EXPLOITER_' + (proKirmizi ? 'BLUE' : 'RED') + ' = null;') : 'BATTLE_EXPLOITER_RED = null; BATTLE_EXPLOITER_BLUE = null;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        // AYAR EN SONDA: beyin/delta bayraklari yukarida kuruldu; ayar onlari EZEBILMELI.
        // (Once yukariya konmustu ve sonraki 'BATTLE_INTEL4_RED = true' satiri onu siliyordu →
        // iki kol BIREBIR AYNI cikti. Tuzak #3: iki kol ayniysa once TOGGLE BAGLIYOR MU diye bak.)
        AYAR.length ? (AYAR.join('; ') + ';') : '',
        (DOK !== '' && proKirmizi) ? ('BATTLE_FORCE_DOCTRINE = ' + Number(DOK) + ';') : 'BATTLE_FORCE_DOCTRINE = -1;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:' + (proKirmizi ? 6500 : BUTCE) + ', enemyMoney:' + (proKirmizi ? BUTCE : 6500) + ', show:false });',
        'BATTLE_FORCE_DOCTRINE = -1;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        (DOK !== '' && !proKirmizi) ? ('BATTLE_FORCE_DOCTRINE = ' + Number(DOK) + ';') : '',
        'battleDeployManifest(battleBuildArmyManifest(' + (proKirmizi ? 6500 : BUTCE) + ', { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:' + (!proKirmizi) + ' }), false, { source:"pv", ally:true });',
        'BATTLE_FORCE_DOCTRINE = -1;',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue),',
        '  kazanan: b.winnerSide === true ? "kirmizi" : (b.winnerSide === false ? "mavi" : "berabere") });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'pv.js' }));
}

console.log('INTEL4-PRO vs INTEL4 — ' + TOHUMLAR.length + ' tohum x 2 rol x 2 taraf = ' + (TOHUMLAR.length * 4) + ' mac');
console.log('  kapatilan delta: ' + (KAPAT.length ? KAPAT.join(',') : '(yok)'));
console.log('  ACILAN delta   : ' + (AC.length ? AC.join(',') : '(yok)'));
console.log('  somurucu (pro) : ' + (SOM || '(yok)'));
console.log('  ayar           : ' + (AYAR.length ? AYAR.join('; ') : '(yok)'));
console.log('  doktrin (pro)  : ' + (DOK === '' ? '(serbest)' : DOK));
console.log('  pro butcesi    : ' + BUTCE + '  (intel4: 6500)');
console.log('  tohumlar ' + TOHUMLAR[0] + '..' + TOHUMLAR[TOHUMLAR.length - 1] + '  (bugunku 6 motor degisikliginden SONRA)');
console.log('');
const proMarj = []; let proGalip = 0, mac = 0;
const kayitlar = [];
for (const s of TOHUMLAR) for (const rol of [true, false]) for (const proK of [true, false]) {
    const r = kos(s, rol, proK);
    // pro'nun lehine marj
    const _m = proK ? r.marj : -r.marj;
    proMarj.push(_m);
    const _g = (proK && r.kazanan === 'kirmizi') || (!proK && r.kazanan === 'mavi');
    kayitlar.push({ tohum: s, kirmiziSaldiran: rol, proKirmizi: proK, marj: _m, proGalip: _g });
    mac++;
    if ((proK && r.kazanan === 'kirmizi') || (!proK && r.kazanan === 'mavi')) proGalip++;
    if (mac % 12 === 0) { try { require('fs').writeSync(1, '    ...' + mac + '/' + (TOHUMLAR.length * 4) + ' mac\n'); } catch (e) { } }
}
const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const o = ort(proMarj);
const sd = Math.sqrt(proMarj.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, proMarj.length - 1));
const se = sd / Math.sqrt(proMarj.length);
console.log('');
console.log('  ══ PRO LEHINE ESLESTIRILMIS MARJ ══');
console.log('     ' + (o > 0 ? '+' : '') + Math.round(o) + '   std.hata ' + Math.round(se) +
    '   t ' + (se ? (o / se).toFixed(2) : '-') + '   n=' + proMarj.length +
    '   lehte ' + proMarj.filter(x => x > 0).length + '/' + proMarj.length);
console.log('  ══ GALIBIYET: pro ' + proGalip + '/' + mac + ' = %' + Math.round(proGalip / mac * 100) +
    '   (mezuniyet olcutu: >=%75) ══');
if (JSON_OUT) {
    try { require('fs').writeFileSync(JSON_OUT, JSON.stringify(kayitlar), 'utf8'); }
    catch (e) { console.log('JSON YAZILAMADI: ' + e.message); }
}
