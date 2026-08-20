'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  TAKTİK TESPİTİ — İSABET ÖLÇÜMÜ (karşı-taktik katmanının ilk kapısı)
//
//  `battleTaktikTespit()` rakibin "mesafede durup dolaylı ateşle yıpratma" şemasını
//  (STANDOFF_ATIS) tanımaya çalışır. Bu araç onun İŞE YARAYIP YARAMADIĞINI ölçer —
//  karşı-plana bağlanmadan ÖNCE.
//
//  ⚠ NEDEN ÖNCE BU: bu depoda bir modeli/skoru "mantıken doğru" diye kullanmak iki kez
//  zarar verdi. Değer ağı (ρ 0,86, durum değerinde iyi) aday sıralamasında rastgeleden
//  KÖTÜ çıktı ve maç kapısında kapatmak +897 kazandırdı (docs/OLCUM-TUZAKLARI.md, 9. tuzak).
//  Bir tespitçinin "makul görünmesi" isabetli olduğu anlamına gelmez.
//
//  YÖNTEM — İKİ KOŞUL, AYNI TOHUM:
//    STANDOFF : maviye dolaylı ateş ZORLANIR (topçu + havan + ÇNRA) → şema VAR
//    KONTROL  : maviden dolaylı ateş TAMAMEN çıkarılır             → şema YOK
//  İkisi de AYNI tarif tabanından kurulur (qa-runtime/gercekci-taban.json), yani tek
//  değişen dolaylı ateş payıdır. Doğal orduyla kıyaslamak YANLIŞ olurdu: o zaman iki kol
//  arasında kompozisyonun her boyutu değişir ve farkın nereden geldiği ayrıştırılamaz.
//
//  ÖLÇÜT — tek sayı yetmez, üçü birden:
//    tespit oranı (standoff) : şema varken kaç örnekte yakaladık        → DUYARLILIK
//    tespit oranı (kontrol)  : şema YOKKEN kaç örnekte yanlış alarm     → YANLIŞ POZİTİF
//    AYRIM = ikisinin farkı  : sıfıra yakınsa tespitçi BİLGİ TAŞIMIYOR
//  Ayrıca ilk tespit tiki (gecikme) raporlanır: geç tespit, karşı-plan için değersizdir.
//
//    node tools/taktik-tespit-olcum.js [--mac 6] [--tohum0 140000] [--ornek 40]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 140000)) || 140000;
const ORNEK = Math.max(5, Number(arg('--ornek', 40)) || 40);   // kaç tikte bir örnek

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));
const tarif = (ad, zorunlu, tavan) => Object.assign({}, taban,
    { ad, rol: 'defender', zorunlu: zorunlu || {}, tavan: tavan || {}, artik: [] });

/* STANDOFF: dolaylı ateş ZORLANIR. KONTROL: dolaylı ateş SIFIRLANIR (tavan 0).
   Aynı tabandan kurulur — tek değişen budur. */
const TARIF_STANDOFF = tarif('STANDOFF', { artillery: 2, mortar_team: 3, mlrs: 1 }, {});
const TARIF_KONTROL  = tarif('KONTROL', {}, { artillery: 0, mortar_team: 0, mlrs: 0 });

function kos(seed, standoff) {
    const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  /* ⚠ INANC KATMANI VARSAYILAN KAPALI: BATTLE_INTEL4_DELTAS.profile = false
     (js/globals.js:436, "default-off byte-ayni"). Yani updateThreatProfile hic kosmuyor
     ve tespitci bos bir profile bakiyor — ilk kosuda tam bu oldu, 0/41 tespit.
     Olcum onu ACIK kosar; sorumuz "inanc katmani ACIKKEN tespitci ise yariyor mu". */
  BATTLE_INTEL4_DELTAS.profile = true;
  BATTLE_RECIPE_BLUE = ${JSON.stringify(standoff ? TARIF_STANDOFF : TARIF_KONTROL)};
  BATTLE_RECIPE_RED = null;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,
    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,
    { source:"tt", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;

  /* KIRMIZI KONTROLOR — tespit onun gozunden yapilir (AI = kirmizi = saldiran). */
  let kirmizi = null;
  if (typeof BATTLE_CONTROLLERS !== "undefined") {
    for (const c of BATTLE_CONTROLLERS.values()) if (c && c.side === true) kirmizi = c;
  }
  if (!kirmizi) return JSON.stringify({ hata: "kirmizi kontrolor bulunamadi" });

  let st = 0, orn = 0, tespit = 0, guvenTop = 0, ilkTik = null;
  let maviDolayli = 0;
  for (const u of SIM.units) if (!u.isRed && u.isIndirect) maviDolayli++;

  while (phase === PHASE.BATTLE && SIM.tick < 7200) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    battleLookaheadTick(st);
    if (SIM.tick % ${ORNEK} !== 0) continue;
    orn++;
    const t = battleTaktikTespit(kirmizi);
    if (t && t.taktik === "STANDOFF_ATIS") {
      tespit++; guvenTop += t.guven;
      if (ilkTik == null) ilkTik = SIM.tick;
    }
  }
  return JSON.stringify({ orn, tespit, guvenOrt: tespit ? guvenTop / tespit : 0,
    ilkTik, maviDolayli, sure: Math.round(SIM.tick * 0.05) });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'tt-' + seed + '-' + standoff + '.js' }));
}

const T = { true: { orn: 0, tespit: 0, guven: 0, ilk: [], dolayli: 0 },
            false: { orn: 0, tespit: 0, guven: 0, ilk: [], dolayli: 0 } };
console.log('');
console.log('TAKTİK TESPİTİ — İSABET ÖLÇÜMÜ (' + MAC + ' tohum × 2 koşul)');
console.log('  STANDOFF = maviye dolaylı ateş zorlandı · KONTROL = maviden dolaylı ateş çıkarıldı');
console.log('');
for (let i = 0; i < MAC; i++) {
    const seed = TOHUM0 + i;
    for (const so of [true, false]) {
        const r = kos(seed, so);
        if (r.hata) { console.log('  tohum ' + seed + '  HATA: ' + r.hata); continue; }
        const t = T[so];
        t.orn += r.orn; t.tespit += r.tespit; t.guven += r.guvenOrt * r.tespit;
        t.dolayli += r.maviDolayli;
        if (r.ilkTik != null) t.ilk.push(r.ilkTik);
        console.log('  tohum ' + seed + (so ? '  STANDOFF' : '  KONTROL ') +
            '  mavi dolaylı ' + r.maviDolayli +
            '  tespit ' + r.tespit + '/' + r.orn +
            ' (%' + (r.orn ? Math.round(r.tespit / r.orn * 100) : 0) + ')' +
            '  ilk tik ' + (r.ilkTik == null ? '—' : r.ilkTik) +
            '  süre ' + r.sure + 'sn');
    }
}

const oran = (t) => t.orn ? t.tespit / t.orn : 0;
const so = T[true], ko = T[false];
console.log('');
console.log('  ' + 'koşul'.padEnd(12) + 'örnek'.padStart(7) + 'tespit'.padStart(8) + 'oran'.padStart(8) +
    'ort güven'.padStart(11) + 'ort ilk tik'.padStart(13) + '  mavi dolaylı/maç');
for (const [ad, t] of [['STANDOFF', so], ['KONTROL', ko]]) {
    const ilkOrt = t.ilk.length ? Math.round(t.ilk.reduce((a, b) => a + b, 0) / t.ilk.length) : null;
    console.log('  ' + ad.padEnd(12) + String(t.orn).padStart(7) + String(t.tespit).padStart(8) +
        ('%' + (oran(t) * 100).toFixed(1)).padStart(8) +
        (t.tespit ? (t.guven / t.tespit).toFixed(3) : '—').padStart(11) +
        String(ilkOrt == null ? '—' : ilkOrt).padStart(13) +
        ('   ' + (t.dolayli / MAC).toFixed(1)));
}
const ayrim = oran(so) - oran(ko);
console.log('');
console.log('  ⭐ AYRIM (standoff − kontrol): ' + (ayrim * 100).toFixed(1) + ' puan');

/* ⚠ HÜKMÜ TEK SAYIYA BAKARAK VERME — ilk sürümüm tam bunu yapıyordu ve tespitçiyi
   haksız yere "zayıf" diye damgaladı. Ham tespit oranı, mavinin ATEŞ ETMEDİĞİ anları da
   payda sayıyor; şema sürekli değil aralıklı uygulanıyor. Karşı-plan tetikleyicisi için
   asıl ölçüt ikisi:
     YANLIŞ ALARM — şema yokken tetiklenmemeli (kontrol oranı ~0 olmalı)
     GECİKME      — şema başlayınca hızlı yakalamalı (geç tespit karşı-plana yaramaz)
   Ayrım ise ikisinin birlikte sağlandığının kanıtı. */
const yanlisAlarm = oran(ko);
const gecikme = ko.ilk.length || so.ilk.length
    ? (so.ilk.length ? Math.round(so.ilk.reduce((a, b) => a + b, 0) / so.ilk.length) : null) : null;
console.log('     yanlış alarm (kontrolde tetikleme): %' + (yanlisAlarm * 100).toFixed(1));
console.log('     gecikme (ort ilk tespit tiki)     : ' + (gecikme == null ? '—' : gecikme + '  (' + (gecikme * 0.05).toFixed(1) + 'sn)'));
if (yanlisAlarm <= 0.05 && ayrim >= 0.20 && gecikme != null && gecikme <= 600) {
    console.log('     → KULLANILABİLİR: yanlış alarm yok, hızlı tetikleniyor. Karşı-plana bağlanabilir.');
} else if (yanlisAlarm > 0.15) {
    console.log('     → YANLIŞ ALARM YÜKSEK: şemayı değil her maçta olan bir şeyi görüyor. Tanım düzeltilmeli.');
} else if (ayrim < 0.10) {
    console.log('     → BİLGİ TAŞIMIYOR. Karşı-plana BAĞLAMA.');
} else {
    console.log('     → sınırda: eşikler ayarlanmalı, sonra tekrar ölç.');
}
console.log('');
console.log('  OKUMA: yalnız "standoff oranı"na bakma. Kontrolde de yüksekse tespitçi şemayı');
console.log('  değil, her maçta olan bir şeyi (ör. herhangi bir bastırma) görüyor demektir.');
console.log('');
