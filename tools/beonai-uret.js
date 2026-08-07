'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  beonai VERİ ÜRETİMİ — oracle etiketli karar örnekleri
//
//  Öğretmen: BattleOracle'ın KARŞI-OLGUSAL rollout'u. Bir karar anında gramerin
//  ürettiği TÜM adaylar fork'tan ayrı ayrı koşturulur; her adayın gerçek ödülü
//  ölçülür. Model bu sıralamayı öğrenir (aday ÜRETMEZ, SIRALAR).
//
//  CPU DOSTU: tek süreç, varsayılan 1 maç. Kullanıcı makineyi başka iş için
//  kullanırken bu araç sessizce küçük partiler üretebilsin diye ağır varsayılan YOK.
//  Büyük üretim için --maclar ile açıkça artırılır.
//
//  MALİYET UYARISI: bir karar noktası = (aday sayısı + 1) × rollout. 30 aday ve
//  30sn rollout ≈ 31 × 600 tik. Yani karar başına maliyet bir maçın katı olabilir.
//  Araç her koşuda gerçekleşen maliyeti RAPORLAR (kaç karar, kaç rollout, ne kadar sürdü).
//
//  Kullanım:
//    node tools/beonai-uret.js --maclar 1 --tohum 2024 --karar-araligi 900 --rollout 25
//    node tools/beonai-uret.js --maclar 8 --out qa-runtime/beonai-veri.jsonl
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { tezgahKur } = require('./muharebe-tezgah.js');

const ROOT = path.resolve(__dirname, '..');
function arg(ad, vars) { const i = process.argv.indexOf(ad); return i >= 0 ? process.argv[i + 1] : vars; }

const MACLAR = Math.max(1, Number(arg('--maclar', 1)) || 1);
const TOHUMLAR = String(arg('--tohum', '')).split(',').map(Number).filter(Boolean);
const KARAR_ARALIGI = Math.max(100, Number(arg('--karar-araligi', 900)) || 900);   // tik
const ROLLOUT_SN = Math.max(5, Number(arg('--rollout', 25)) || 25);
const MIN_TICK = Math.max(0, Number(arg('--min-tick', 500)) || 500);
const KIRMIZI = arg('--taraf', 'kirmizi') !== 'mavi';
// PERCEPTION OZNITELIKLERI (olculdu: tam-bilgi ile egitilen model canli maçta %79 farkli aday
// seciyor). Ogretmen (rollout+odul) TAM BILGI kalir; modele verilen oznitelikler perception'dan.
const PERCEPTION = !process.argv.includes('--tambilgi');
const CIKTI = arg('--out', 'qa-runtime/beonai-veri.jsonl');

// Tohum havuzu — caprazla ile AYNI tarama havuzu (veri ve değerlendirme aynı dünyalardan gelsin,
// ama değerlendirme dışörneklem/final havuzlarında yapılır → eğitim verisine sızma olmaz).
const VARSAYILAN_TOHUM = [2024, 777, 909, 3141, 2718, 5150, 111, 222, 333, 444, 555, 666,
    1234, 4321, 8080, 6060, 7, 42, 99, 1001, 2222, 3333, 4444, 5555];
const SECILEN = TOHUMLAR.length ? TOHUMLAR : VARSAYILAN_TOHUM.slice(0, MACLAR);

function macVerisi(ctx, seed) {
    const kod = '(() => { try {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;' +
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
        'BATTLE_BEONAI_RED = null; BATTLE_BEONAI_BLUE = null;' +   // veri üretirken model KAPALI (öğretmen oracle)
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"beonai-uret", ally:true });' +
        'startBattle();' +
        'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
        'const ornekler = []; let kararSayisi = 0, rolloutSayisi = 0, hata = null;' +
        'try {' +
        '  while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
        '    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '    if (SIM.tick >= ' + MIN_TICK + ' && (SIM.tick % ' + KARAR_ARALIGI + ') === 0) {' +
        // collectDataset:true → (stateFeatures, [aday: candidateFeatures + rollout ödülü]) listwise tuple'ı
        '      const r = battleOracleEvaluate({ sideRed: ' + KIRMIZI + ', rolloutSec: ' + ROLLOUT_SN + ', collectDataset: true, collectStateFeatures: true, perceptionFeatures: ' + PERCEPTION + ' });' +
        '      if (r && !r.err) {' +
        '        kararSayisi++; rolloutSayisi += (r.candidateCount || 0) + 1;' +
        '        ornekler.push({ seed: ' + seed + ', tick: SIM.tick, sideRed: ' + KIRMIZI + ', veri: r.dataset || null,' +
        '          regret: r.regret, aktif: r.active, minDusmanMesafe: r.minEnemyDist,' +
        '          oracle: r.oracle ? { intent: r.oracle.intent, odul: r.oracle.reward && r.oracle.reward.scalar } : null });' +
        '      } else if (r && r.err && !hata) { hata = r.err; }' +
        '    }' +
        '  }' +
        '} finally { SIM.headless = ph; }' +
        'const b = SIM.battle || {};' +
        'return JSON.stringify({ seed: ' + seed + ', kararSayisi: kararSayisi, rolloutSayisi: rolloutSayisi,' +
        '  bitisSn: Math.round(SIM.tick*BATTLE_TICK_SEC), kazanan: (b.winnerSide===true?"kirmizi":b.winnerSide===false?"mavi":"-"),' +
        '  hata: hata, ornekler: ornekler });' +
        '} catch(e){ return JSON.stringify({ err: e.message, stack: (e.stack||"").slice(0,300) }); } })()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'beonai-uret-' + seed + '.js' }));
}

function main() {
    console.log('beonai VERİ ÜRETİMİ');
    console.log('  maç       : ' + SECILEN.length + '  (tohum: ' + SECILEN.join(',') + ')');
    console.log('  karar     : her ' + KARAR_ARALIGI + ' tik (t≥' + MIN_TICK + '), rollout ' + ROLLOUT_SN + 'sn');
    console.log('  taraf     : ' + (KIRMIZI ? 'kırmızı' : 'mavi') + '   çıktı: ' + CIKTI);
    console.log('  NOT: veri üretiminde model KAPALI — öğretmen oracle rollout\'udur.');
    console.log('');

    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH_YUKLEME_HATASI: ' + hatalar.join(' | ')); process.exit(1); }

    const t0 = Date.now();
    let toplamOrnek = 0, toplamKarar = 0, toplamRollout = 0;
    // DAYANIKLI YAZIM: createWriteStream TAMPONLU yazıyordu ve süreç öldürüldüğünde
    // (bellek gözcüsü) tampondaki her şey UÇUYORDU — 10 dakikalık üretim sıfır kayıtla
    // sonuçlandı. Artık her tohum bitince DİSKE SENKRON eklenir; kesilme olsa bile
    // o ana kadarki veri gerçekten korunur.
    const hedef = path.resolve(ROOT, CIKTI);
    fs.mkdirSync(path.dirname(hedef), { recursive: true });
    for (const seed of SECILEN) {
        const m0 = Date.now();
        const r = macVerisi(ctx, seed);
        if (r.err) { console.log('  seed' + seed + ' HATA: ' + r.err); continue; }
        if (r.ornekler.length) {
            fs.appendFileSync(hedef, r.ornekler.map(o => JSON.stringify(o)).join('\n') + '\n');
            toplamOrnek += r.ornekler.length;
        }
        toplamKarar += r.kararSayisi; toplamRollout += r.rolloutSayisi;
        console.log('  seed' + String(seed).padEnd(6) + r.kararSayisi + ' karar, ' + r.rolloutSayisi + ' rollout, ' +
            r.ornekler.length + ' örnek, ' + Math.round((Date.now() - m0) / 1000) + 'sn' +
            (r.hata ? '   (oracle notu: ' + r.hata + ')' : ''));
    }
    const sure = (Date.now() - t0) / 1000;
    console.log('');
    console.log('BEONAI_URET_OK  ' + toplamOrnek + ' örnek / ' + toplamKarar + ' karar / ' + toplamRollout +
        ' rollout / ' + sure.toFixed(0) + 'sn' + (toplamKarar ? '  (karar başı ' + (sure / toplamKarar).toFixed(1) + 'sn)' : ''));
    console.log('-> ' + CIKTI);
}

if (require.main === module) main();
module.exports = { macVerisi };
