'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  BEDAVA ETİKET — "her gerçek maç zaten bir rollout"
//
//  Şu ana kadar her etiket için fork alıp 5 saniye SİMÜLE ettik. Oysa gerçek maçta
//  o 5 saniye ZATEN oynanıyor. Bir birim bir yere gitti, 5 saniye geçti, ne olduğunu
//  GÖRDÜK — ek maliyet sıfır.
//
//  ÖLÇÜLEN MALİYET FARKI:
//      aramalı toplama   ~85sn CPU/maç → 8 işçide 1000 maç ≈ 3 saat, ~100 bin etiket
//      BU ARAÇ           ~10sn CPU/maç → 8 işçide 1000 maç ≈ 20 dk,  ~3 milyon etiket
//
//  ═══ NEDEN ŞİMDİ: BUGÜN ÜÇ ÖLÇÜM "VERİ AZ" DEDİ ═══
//    · genişlik ×4 doğruluğu DÜŞÜRÜYOR (61 bin örnekte ezberleme)
//    · birim-koşullu ağ 33 maçtan genelleyemedi (4 formülasyon, hepsi taban altı)
//    · kısa-ufuk ağı ρ 0.416'da platoda
//  Üçü de aynı kısıt. Ve bu, referans çözümün ilk aşamasının ta kendisi:
//  AlphaStar ARAMA KULLANMADI — 971.000 oynanmış maçtan gözetimli öğrenmeyle başladı.
//
//  ═══ ETİKET SEÇİMİ (kritik) ═══
//  "Sonraki 5sn'deki GLOBAL marj değişimi" KULLANILAMAZ: o sayı o andaki TÜM birimler
//  için AYNIdır; ona "hangi birim" girdisi eklenirse ağ onu GÜRÜLTÜ olarak öğrenir.
//  (Bugün politika ağında ve birim-koşullu ağda bu hata iki kez yaşandı.)
//  DOĞRU ETİKET: birimin KENDİ kredi hanesi — ödül defteri her birimin ürettiğini ayrı
//  tutuyor. imhaDeger − emilen = "yok ettiği değer eksi kaybettiği", TL biriminde.
//
//  ═══ DAĞILIM TUZAĞI ve ÇÖZÜMÜ ═══
//  Yalnız birimlerin GERÇEKTEN gittiği yerleri görüyoruz, gidebilecekleri yerleri değil.
//  Çıkarımda AI'nın normalde seçmeyeceği adayları soracağız → dağılım kayması.
//  ÇÖZÜM: --kesif ile birimlerin bir kısmına RASTGELE sapma verilir; hedef dağılımı
//  genişler. Determinizm için srand (sim RNG) kullanılır, Math.random DEĞİL.
//
//    node tools/bedava-etiket.js --mac 20 --tohumofs 200000 --kesif 0.25 --out ...
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 20)) || 20);
const OFS = Number(arg('--tohumofs', 200000)) || 200000;
const OUT = arg('--out', 'qa-runtime/bedava/veri.jsonl');
const MAX_TIK = Number(arg('--maxtik', 7200)) || 7200;
const ARALIK = Number(arg('--aralik', 100)) || 100;    // örnekleme aralığı (arama periyoduyla aynı)
const UFUK = Number(arg('--ufuk', 100)) || 100;        // etiket penceresi (5sn)
const KESIF = Math.max(0, Math.min(0.9, Number(arg('--kesif', 0.25)) || 0));

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const fd = fs.openSync(OUT, 'w');
    let toplam = 0;
    const t0 = Date.now();
    console.log('BEDAVA ETIKET — oynanan maclardan (arama YOK)');
    console.log('  mac: ' + MAC + '   tohum: ' + OFS + '..' + (OFS + MAC - 1) +
        '   aralik: ' + ARALIK + '   ufuk: ' + UFUK + '   kesif: ' + KESIF);

    for (let i = 0; i < MAC; i++) {
        const seed = OFS + i;
        const kod = '(() => {' +
            'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
            'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
            'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
            'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
            'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
            'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,' +
            '  durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
            'BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;' +
            'const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,' +
            '  brainIntel4:true, isAttacker:false, pro:false });' +
            'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
            'battleDeployManifest(mv, false, { source:"bedava", ally:true });' +
            'startBattle(); SIM.headless = true;' +
            'BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;' +   // ARAMA YOK: bedava olmasinin sebebi
            // ── KREDI DEFTERI: etiketin kaynagi. Birim basi hane tutar.
            'BATTLE_CREDIT.on = true; battleKrediSifirla();' +
            'for (const u of SIM.units) battleKrediKayit(u);' +
            'const _hane = (u) => { const b = BATTLE_CREDIT.birim[u.id];' +
            '  return b ? ((b.imhaDeger || 0) - (b.emilen || 0)) : 0; };' +
            'const bekleyen = [];' +   // {uid, oz, b, dx, dy, hane0, tik}
            'const out = [];' +
            'let st = 0;' +
            'while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE) {' +
            '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
            '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
            '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
            // ── ETIKETI OLGUNLASAN kayitlari kapat ──
            '  for (let k = bekleyen.length - 1; k >= 0; k--) {' +
            '    const w = bekleyen[k];' +
            '    if (SIM.tick < w.tik + ' + UFUK + ') continue;' +
            '    const u = SIM.units.find(x => x.id === w.uid);' +
            '    bekleyen.splice(k, 1);' +
            // Birim oldiyse etiket YINE gecerli: kaybettigi deger emilen'e yazilmis olur.
            '    const hane1 = u ? _hane(u) : w.hane0;' +
            '    const oldu = (!u || u.dead) ? 1 : 0;' +
            '    out.push({ r: w.r, s: w.s, b: w.b, d: [w.dx, w.dy], y: hane1 - w.hane0,' +
            '      oldu: oldu, tik: w.tik });' +
            '  }' +
            '  if (SIM.tick % ' + ARALIK + ') continue;' +
            '  const _oz = battleDurumOzellik(16, 10);' +
            '  if (!_oz) continue;' +
            '  const _yuv = (v) => Math.round(v * 1e4) / 1e4;' +
            '  for (const u of SIM.units) {' +
            '    if (u.dead || u.loaded || u.abandoned || u.isAir) continue;' +
            '    if (u.controlOwner === "PLAYER") continue;' +
            // ── KESIF GURULTUSU: hedef dagilimi genislesin (determinist: srand) ──
            (KESIF > 0 ? (
            '    if (srand() < ' + KESIF + ') {' +
            '      const a = srand() * Math.PI * 2, r = 200 + srand() * 400;' +
            '      const nx = Math.max(60, Math.min(WORLD_W - 60, u.x + Math.cos(a) * r));' +
            '      const ny = Math.max(60, Math.min(WORLD_H - 60, u.y + Math.sin(a) * r));' +
            '      if (typeof isPassableAt !== "function" || isPassableAt(nx, ny)) {' +
            '        u.targetX = nx; u.targetY = ny;' +
            '        u.manualMoveTarget = { x: nx, y: ny };' +
            '        u.isMovingToManualTarget = true; u._holdingPos = false;' +
            '      }' +
            '    }'
            ) : '') +
            // GITTIGI YER: manuel hedef varsa o, yoksa mevcut hedefi
            '    const hx = (u.manualMoveTarget ? u.manualMoveTarget.x : (u.targetX != null ? u.targetX : u.x));' +
            '    const hy = (u.manualMoveTarget ? u.manualMoveTarget.y : (u.targetY != null ? u.targetY : u.y));' +
            '    const st2 = STATS[u.type] || {};' +
            '    bekleyen.push({ uid: u.id, tik: SIM.tick, hane0: _hane(u),' +
            '      r: _oz.r.map(_yuv), s: _oz.s.map(_yuv),' +
            '      b: [u.x / WORLD_W, u.y / WORLD_H, u.type / 26, u.hp / Math.max(1, u.maxHp),' +
            '          u.isRed ? 1 : 0, (st2.range || 0) / 2000, (st2.cost || 0) / 1000,' +
            '          u.maxAmmo ? (u.ammo || 0) / u.maxAmmo : 1, (u.suppression || 0) / 100,' +
            '          u.isFleeing ? 1 : 0, u.inForest ? 1 : 0, u.inTrench ? 1 : 0].map(_yuv),' +
            '      dx: _yuv((hx - u.x) / 600), dy: _yuv((hy - u.y) / 600) });' +
            '  }' +
            '}' +
            'BATTLE_CREDIT.on = false;' +
            'return JSON.stringify({ seed:' + seed + ', n: out.length, ornek: out });' +
            '})()';
        let r;
        try { r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'be-' + seed + '.js' })); }
        catch (e) { console.log('\n  ! mac ' + seed + ' hata: ' + e.message); continue; }
        let blok = '';
        for (const o of r.ornek) blok += JSON.stringify(Object.assign({ seed }, o)) + '\n';
        if (blok) fs.writeSync(fd, blok);
        toplam += r.n;
        process.stdout.write('  ' + (i + 1) + '/' + MAC + ' mac   ' + toplam + ' etiket   ' +
            Math.round((Date.now() - t0) / 1000) + 'sn\r');
    }
    fs.closeSync(fd);
    console.log('\n  TOPLAM: ' + toplam + ' etiket -> ' + OUT);
    console.log('  (her kayit: durum + birim + GITTIGI YON -> kendi kredi hanesindeki degisim)');
}

main();
