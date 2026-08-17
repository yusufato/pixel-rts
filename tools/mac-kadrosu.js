'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  MAÇ KADROSU — verilen tohumda RAKİBİN ordusu ne olacak?
//
//  NEDEN: kullanıcı "aynı birliklerle savaşacağım" diyor. Hızlı Maç'ta oyuncu
//  ordusunu kendi kurar; rakibinkini görmeden eşitlemek mümkün değil.
//  Bu araç, Hızlı Maç'ın AÇTIĞI OTURUMUN AYNISINI açar ve kırmızı (AI) kadrosunu
//  basar — böylece oyuncu birebir aynı listeyi kurabilir.
//
//  ⚠ PARAMETRELER HIZLI MAÇ VARSAYILANLARIYLA AYNI OLMAK ZORUNDA (js/Screens.js
//  quickMatchStart): mapId -2, durationSec DEFAULT_BATTLE_DURATION_SEC,
//  playerMoney/enemyMoney 6500, attackerSide = (rol 'defender' mi).
//  Bir tanesi bile kayarsa üretilen ordu FARKLI olur ve liste yanıltır.
//
//  ROL: oyuncu "SALDIRAN" seçerse kırmızı SAVUNUR → attackerSide=false.
//
//    node tools/mac-kadrosu.js --tohum 424242 [--rol saldiran|savunan] [--para 6500]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const TOHUMLAR = String(arg('--tohum', '424242')).split(',').map(s => Number(s.trim()) >>> 0);
const ROL = String(arg('--rol', 'saldiran'));       // OYUNCUNUN rolü
const PARA = Number(arg('--para', 6500)) || 6500;

function kadro(ctx, seed) {
    // attackerSide: true = KIRMIZI saldırır. Oyuncu saldıransa kırmızı savunur.
    const attackerSide = (ROL === 'savunan');
    const kod = '(() => {' +
        // ÖNGÖRÜ kademesi = intel4 beyin + arama katmanı. Ordu kurulumu beyin
        // bayraklarını okuduğu için oturumdan ÖNCE ayarlanır (Screens.js ile aynı sıra).
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4PRO_RED = false;' +
        'BATTLE_INTEL4_BLUE = true; BATTLE_INTEL4PRO_BLUE = false;' +
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ',' +
        '  attackerSide:' + attackerSide + ', durationSec: DEFAULT_BATTLE_DURATION_SEC,' +
        '  playerMoney:' + PARA + ', enemyMoney:' + PARA + ',' +
        '  deployRes:null, deployPool:null, techBonus:null, techBonusRed:null });' +
        'const say = {}; let toplam = 0, adet = 0;' +
        'for (const u of SIM.units) {' +
        '  if (u.dead || !u.isRed) continue;' +
        '  const s = STATS[u.type] || {};' +
        '  const ad = s.id || ("tip" + u.type);' +
        '  if (!say[ad]) say[ad] = { n:0, maliyet: s.cost || 0, tr: s.name || ad };' +
        '  say[ad].n++; toplam += (s.cost || 0); adet++;' +
        '}' +
        'const trAd = {}; for (const k in say) trAd[k] = say[k].tr;' +
        'return JSON.stringify({ seed:' + seed + ', attackerSide:' + attackerSide + ', trAd,' +
        '  harita: (SIM.battle && SIM.battle.mapId), say, toplam, adet });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kadro-' + seed + '.js' }));
}

/* Oyundaki spawn-bar gruplari — js/main.js SPAWN_CATEGORIES ile AYNI SIRA ve AYNI
   icerik olmak zorunda. Kaydiginda liste oyuncuyu yanlis yere baktirir. */
const GRUPLAR = [
    { label: '👣 PIYADE',      ids: ['infantry', 'at_team', 'mortar_team', 'manpads_team', 'commando'] },
    { label: '🛡️ ZIRHLI',      ids: ['mbt', 'ifv', 'tank_destroyer'] },
    { label: '💥 DOLAYLI',     ids: ['artillery', 'mlrs', 'ballistic_missile'] },
    { label: '🎯 HAVA-SAV.',   ids: ['spaag', 'sam_battery'] },
    { label: '✈️ HAVA',        ids: ['attack_helo', 'transport_helo', 'recon_uav', 'armed_uav', 'drone_operator'] },
    { label: '📡 KESIF/EH',    ids: ['scout_vehicle', 'counter_battery_radar', 'ew_vehicle'] },
    { label: '🚑 DESTEK',      ids: ['medic', 'engineer', 'supply_truck', 'command_vehicle'] }
];

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('MAC KADROSU — rakip (KIRMIZI) ordusu');
    console.log('  oyuncu rolu: ' + ROL.toUpperCase() + '   butce: ' + PARA + '   (Hizli Mac varsayilanlari)');
    console.log('');
    for (const seed of TOHUMLAR) {
        const r = kadro(ctx, seed);
        const AD_TR = r.trAd || {};   // Turkce adlar MOTORDAN (STATS[].name) — elle yazilmaz
        console.log('  ══ TOHUM ' + seed + ' ══   rakip ' + (r.attackerSide ? 'SALDIRAN' : 'SAVUNAN') +
            '   toplam ' + r.adet + ' birim / ' + r.toplam + ' TL');
        /* SIRA: oyundaki SPAWN-BAR grup sirasiyla AYNI (js/main.js SPAWN_CATEGORIES).
           Maliyete gore siralamak "listeden tek tek ara" demekti; oyuncu birligi
           ekranda grup grup kuruyor, liste de o sirayla okunmali. */
        let kalan = Object.assign({}, r.say);
        for (const g of GRUPLAR) {
            const satirlar = g.ids.filter(id => kalan[id]);
            if (!satirlar.length) continue;
            let gTop = 0;
            for (const id of satirlar) gTop += kalan[id].n * kalan[id].maliyet;
            console.log('     ' + g.label + '  (' + gTop + ' TL)');
            for (const id of satirlar) {
                const v = kalan[id];
                console.log('        ' + String(v.n).padStart(2) + ' ×  ' + (AD_TR[id] || id).padEnd(22) +
                    String(v.maliyet).padStart(5) + ' TL  = ' + String(v.n * v.maliyet).padStart(5));
                delete kalan[id];
            }
        }
        // GRUPSUZ KALAN olmamali; olursa SESSIZCE dusurmek yerine gorunur yapilir.
        const artan = Object.keys(kalan);
        if (artan.length) {
            console.log('     ! GRUPSUZ (spawn-barda yok): ' + artan.join(', '));
        }
        console.log('');
    }
    console.log('  Ayni tohumu Hizli Mac > Ileri ayarlar > Tohum alanina gir.');
    console.log('  Ayni birimleri kurarsan tek fark BEYIN olur.');
}

main();
