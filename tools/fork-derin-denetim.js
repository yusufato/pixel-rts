'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  FORK DERİN DENETİMİ — hash'in GÖRMEDİĞİ sızıntılar
//
//  `tools/fork-kapisi.js` capture→restore sadakatini HASH ile sınar. Ama hash bir
//  seçki: `manualMoveTarget`, `_laUntilTick`, `_mineTimer`, kontrolör ağacının çoğu
//  alanı hash'te YOK. Mayın kusuru hash'e girene kadar tam da bu yüzden görünmedi.
//
//  Bu araç hash yerine DURUMUN KENDİSİNİ karşılaştırır: capture öncesi ve restore
//  sonrası tüm sim durumu derin imzaya çevrilip alan alan diff'lenir. İlk farkın
//  YOLU basılır (ör. `ctrl[battle-red-ai].taskExecutor.focusContactId`).
//
//  KAPSAM: SIM.units (tüm öz alanlar) · trenches · mines · pendingHits · ctrlPosture ·
//          activeSupports · pendingSupportSpawns · supportCooldowns · SIM.battle ·
//          para · BATTLE_CONTROLLERS ağacı (genel gezinme, whitelist DEĞİL)
//
//  Kontrolör ağacı döngüsel (unit ↔ controller). Gezinme: Unit örnekleri '#U<id>',
//  görülmüş nesneler '#DONGU', fonksiyonlar atlanır.
//
//  NEGATİF KONTROL: capture'dan mayınlar atılır → denetim YAKALAMALI.
//
//    node tools/fork-derin-denetim.js [--tohum 2] [--nokta 3]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 2)) || 2);
const TOHUM0 = Number(arg('--tohum0', 710000)) || 710000;
const NOKTA = Math.max(1, Number(arg('--nokta', 3)) || 3);
const ARA = Number(arg('--ara', 400)) || 400;
const DERINLIK = Number(arg('--derinlik', 12)) || 12;

function kos(ctx, seed, sabotaj) {
    const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"fdd", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;

  ${sabotaj ? `
  /* NEGATIF KONTROL — "restore siliyor, capture almiyor" kusurunun aynisi enjekte edilir.
     MAYIN TEK BASINA YETMEZ: bazi tohumlarda sinama noktalarina kadar hic mayin
     dosenmiyor ve kontrol sessizce UYGULANMAMIS oluyor (ilk surumde tam bu yasandi —
     "40 yakalandi" sanilan sayi aslinda _seenEnemyRefs artefaktiydi). Bu yuzden her
     macta KESIN var olan siperler de birlikte dusurulur; mayin sayisi ayrica raporlanir. */
  const _eskiCapture = battleForkCapture;
  battleForkCapture = function () { const f = _eskiCapture(); f.mines = []; f.trenches = []; return f; };
  ` : ''}

  // ── DERİN İMZA: durumu düz (yol -> deger) haritasina cevirir ──────────────
  const imza = (kok) => {
    const out = {};
    /* DONGU TESPITI ATA ZINCIRIYLE olmali, "gorulen her nesne" ile DEGIL.
       Ilk surumde global bir gorulen-kumesi kullanildi ve arac 2435 SAHTE fark
       basti: canli durumda ayni nesne iki yoldan erisilebiliyor (takma ad), ikinci
       erisim '#DONGU' damgalaniyordu; replayClone ise takma adlari KIRDIGI icin
       restore sonrasi ayni yol tam aciliyordu. Yapi ayni, paylasim farkli — bu bir
       SIZINTI DEGIL. Ata zinciri yalnizca GERCEK dongude tetiklenir. */
    const ata = new Set();
    let sayac = 0;
    const yaz = (yol, v, d) => {
      if (++sayac > 600000) { out['#TASMA'] = '1'; return; }
      if (d > ${DERINLIK}) { out[yol] = '#DERIN'; return; }
      if (v === null || v === undefined) { out[yol] = String(v); return; }
      const t = typeof v;
      if (t === 'function') return;                       // metodlar durum degil
      if (t !== 'object') {
        // kayan noktayi yuvarlamadan yaz: en ufak sapma bile sizintidir
        out[yol] = (t === 'number' && !Number.isInteger(v)) ? v.toFixed(9) : String(v);
        return;
      }
      /* BILINEN ISTISNA — _seenEnemyRefs olu-vekili. Fork yalniz SAG birimleri tasir;
         olmus dusmanin kaydi {id,dead,type} vekiliyle geri konur (BattleSession ~1104,
         belgeli ve kasitli). DOGRULANDI (varsayilmadi): tuketiciler yalnizca ref.dead ve
         ref.type okuyor — BattlePerception.js:109 (teyitli-imha ₺) ve :206 (tehdit-sinifi
         kaynak dusurme). Vekil bu ikisini tam veriyor. Bu yuzden burada ANLAMA gore
         karsilastirilir; nesne kimligine gore degil. Gercek bir degisim (tip yanlis,
         sag referans kaybolmus) yine yakalanir. */
      if (/_seenEnemyRefs\\{[^}]*\\}$/.test(yol)) {
        out[yol] = '#REF ' + (v.id != null ? v.id : '-') + ' olu=' + (v.dead ? 1 : 0) + ' tip=' + (v.type != null ? v.type : '-');
        return;
      }
      // Unit ornegi -> kimlik (dongu kapatir; birimler AYRICA tam gezilir)
      if (typeof Unit === 'function' && v instanceof Unit) { out[yol] = '#U' + v.id; return; }
      if (ata.has(v)) { out[yol] = '#DONGU'; return; }
      ata.add(v);
      if (Array.isArray(v)) { out[yol + '.length'] = String(v.length); for (let i = 0; i < v.length; i++) yaz(yol + '[' + i + ']', v[i], d + 1); }
      else if (v instanceof Map) { const es = [...v.entries()].sort((p, q) => String(p[0]) < String(q[0]) ? -1 : 1); out[yol + '.size'] = String(v.size); for (const e of es) yaz(yol + '{' + String(e[0]) + '}', e[1], d + 1); }
      else if (v instanceof Set) { out[yol + '.size'] = String(v.size); out[yol + '.uye'] = [...v].map(String).sort().join(','); }
      else { for (const k of Object.keys(v).sort()) yaz(yol + '.' + k, v[k], d + 1); }
      ata.delete(v);
    };
    for (const k of Object.keys(kok)) yaz(k, kok[k], 0);
    return out;
  };

  const durumKok = () => {
    const u = {};
    for (const x of SIM.units.slice().sort((a, b) => a.id - b.id)) if (!x.dead) u['u' + x.id] = x;
    const c = {};
    if (typeof BATTLE_CONTROLLERS !== 'undefined' && BATTLE_CONTROLLERS) {
      for (const k of [...BATTLE_CONTROLLERS.keys()].sort()) c[k] = BATTLE_CONTROLLERS.get(k);
    }
    return {
      birim: u, ctrl: c,
      siper: SIM.trenches || [], mayin: SIM.mines || [],
      bekleyenVurus: SIM.pendingHits || [], vurusSeq: SIM.pendingHitSeq | 0,
      durus: SIM.ctrlPosture || {},
      destek: (typeof activeSupports !== 'undefined' ? activeSupports : []) || [],
      destekBekleyen: (typeof pendingSupportSpawns !== 'undefined' ? pendingSupportSpawns : []) || [],
      destekSoguma: (typeof supportCooldowns !== 'undefined' ? supportCooldowns : {}) || {},
      mac: SIM.battle || {}, para: { p: player.money || 0, e: enemy.money || 0 },
      tik: SIM.tick | 0, rng: SIM_RNG.state >>> 0, nextId: Unit.nextId | 0,
      forensik: (typeof BATTLE_FORENSIC !== 'undefined' && BATTLE_FORENSIC) ? BATTLE_FORENSIC : {}
    };
  };

  const bulgu = [], noktalar = [];
  let st = 0, nokta = 0;
  while (SIM.tick < ${(NOKTA + 1) * ARA + 50} && phase === PHASE.BATTLE && nokta < ${NOKTA}) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    if (SIM.tick % ${ARA} !== 0 || SIM.tick === 0) continue;
    nokta++;

    const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
    // SAYIMLAR RESTORE'DAN ONCE: sabotaj kolunda restore diziyi zaten bosaltiyor,
    // sonradan saymak "bu tohumda hic mayin yokmus" gibi YANLIS rapor uretiyordu.
    const _mOnce = (SIM.mines || []).length, _sOnce = (SIM.trenches || []).length;
    const a = imza(durumKok());
    const f = battleForkCapture();
    battleForkRestore(f);
    const b = imza(durumKok());
    BATTLE_SIM_GOLGE = _g;

    const yollar = new Set(Object.keys(a).concat(Object.keys(b)));
    const fark = [];
    for (const y of yollar) if (a[y] !== b[y]) fark.push({ y, once: a[y] === undefined ? '(yok)' : a[y], sonra: b[y] === undefined ? '(yok)' : b[y] });
    fark.sort((x, y2) => x.y < y2.y ? -1 : 1);
    noktalar.push({ tik: SIM.tick, alan: yollar.size, fark: fark.length,
      mayin: _mOnce, siper: _sOnce });
    if (fark.length) bulgu.push({ tik: SIM.tick, toplam: fark.length, ornek: fark.slice(0, 12) });
  }
  ${sabotaj ? 'battleForkCapture = _eskiCapture;' : ''}
  return JSON.stringify({ seed:${seed}, noktalar, bulgu });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'fdd-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('FORK DERIN DENETIMI — ' + N + ' tohum x ' + NOKTA + ' nokta (hash DEGIL, durumun kendisi)');
    console.log('');
    let toplamFark = 0;
    /* NEGATIF KONTROL HANGI TOHUMDA KOSMALI: sabotaj siper+mayin dizilerini dusuruyor,
       ama bazi tohumlarda sinama noktalarina kadar HIC siper/mayin yok — o tohumda
       kontrol sessizce UYGULANMAMIS olur ve "kapi kor" diye YANLIS alarm verir.
       Bu yuzden pozitif kosularda en cok icerigi olan tohum secilir (olculerek, seed
       tahminiyle degil). */
    let negSeed = TOHUM0, negIcerik = -1;
    for (let i = 0; i < N; i++) {
        const seed = TOHUM0 + i;
        const r = kos(ctx, seed, false);
        const icerik = r.noktalar.reduce((s, p) => Math.max(s, (p.mayin | 0) + (p.siper | 0)), 0);
        if (icerik > negIcerik) { negIcerik = icerik; negSeed = seed; }
        for (const n of r.noktalar) {
            console.log('  tohum ' + seed + '  tik ' + String(n.tik).padStart(5) +
                '   gezilen alan ' + String(n.alan).padStart(6) + '   FARK ' + String(n.fark).padStart(4) +
                '   (mayin ' + n.mayin + ', siper ' + n.siper + ')');
        }
        for (const b of r.bulgu) {
            toplamFark += b.toplam;
            console.log('    ! tik ' + b.tik + ' — ' + b.toplam + ' alan sapiyor:');
            for (const f of b.ornek) console.log('        ' + f.y + '   once=' + f.once + '   sonra=' + f.sonra);
        }
    }
    console.log('');
    console.log('NEGATIF KONTROL (capture siper+mayin atiyor — denetim YAKALAMALI):');
    console.log('  tohum ' + negSeed + ' secildi (en cok siper+mayin: ' + negIcerik + ')');
    if (negIcerik <= 0) console.log('  ! hicbir tohumda siper/mayin yok — kontrol UYGULANAMAZ, --nokta/--ara arttir');
    const n = kos(ctx, negSeed, true);
    const yak = n.bulgu.reduce((s, b) => s + b.toplam, 0);
    const mayinVardi = n.noktalar.some(p => p.mayin > 0);
    console.log('  yakalanan sapan alan: ' + yak + '   ' + (yak > 0 ? 'YAKALANDI (denetim CALISIYOR)' : '*** KACIRDI -> DENETIM KOR ***'));
    console.log('  mayin ozelinde sinandi mi: ' + (mayinVardi ? 'EVET' : 'HAYIR (bu tohumda mayin dosenmemis — siper uzerinden sinandi)'));
    console.log('');
    console.log('  SONUC: ' + (toplamFark === 0 && yak > 0 ? 'TEMIZ (fork sizdirmiyor)' : 'SIZINTI VAR -> yukaridaki yollar'));
    process.exit(toplamFark === 0 && yak > 0 ? 0 : 1);
}

main();
