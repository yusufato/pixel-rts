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
        '  if (!say[ad]) say[ad] = { n:0, maliyet: s.cost || 0 };' +
        '  say[ad].n++; toplam += (s.cost || 0); adet++;' +
        '}' +
        'return JSON.stringify({ seed:' + seed + ', attackerSide:' + attackerSide + ',' +
        '  harita: (SIM.battle && SIM.battle.mapId), say, toplam, adet });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kadro-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('MAC KADROSU — rakip (KIRMIZI) ordusu');
    console.log('  oyuncu rolu: ' + ROL.toUpperCase() + '   butce: ' + PARA + '   (Hizli Mac varsayilanlari)');
    console.log('');
    for (const seed of TOHUMLAR) {
        const r = kadro(ctx, seed);
        console.log('  ══ TOHUM ' + seed + ' ══   rakip ' + (r.attackerSide ? 'SALDIRAN' : 'SAVUNAN') +
            '   toplam ' + r.adet + ' birim / ' + r.toplam + ' TL');
        const sirali = Object.entries(r.say).sort((a, b) => (b[1].n * b[1].maliyet) - (a[1].n * a[1].maliyet));
        for (const [ad, v] of sirali) {
            console.log('     ' + String(v.n).padStart(2) + ' ×  ' + ad.padEnd(20) +
                String(v.maliyet).padStart(5) + ' TL   = ' + String(v.n * v.maliyet).padStart(5));
        }
        console.log('');
    }
    console.log('  Ayni tohumu Hizli Mac > Ileri ayarlar > Tohum alanina gir.');
    console.log('  Ayni birimleri kurarsan tek fark BEYIN olur.');
}

main();
