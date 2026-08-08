// FARK TARAMASI — HIPOTEZSIZ. "Insan ile AI ayni macta hangi boyutta ne kadar ayriliyor?"
//
// NEDEN BOYLE: 2026-08-08'de dort mudahale denendi (muhimmat rotasyonu, akin, angajman kurali,
// secici hatti). Dordu de MEKANIZMAYI hareket ettirdi, hicbiri maci degistirmedi. Onceki kalip
// hep ayniydi: once hipotez, sonra olcum. Ustelik "gafil avlama" hipotezi kullanicinin SAVUNMA
// maclarinda acikca curudu (o profil SALDIRI maclarindan geliyordu).
// Bu arac tersini yapar: ONCE her boyutu olcer, sonra "fark en buyuk nerede" diye VERIYE sorar.
//
// KAYNAK — ham kayit zaten zengin:
//   samples[].units  : 34 alan (hp, ammo, suppression, combatState, attackTargetId, inTrench,
//                      targetDistance, enemyInVision, navBlocked, panic, fleeing, ...)
//   combatEvents     : her hasar olayi (konum, hasar, olumcul, arka/yan vurus)
//   lifeEvents       : RESUPPLY / REPAIR / HEAL / PANIC / RELOAD / ABANDON / LAUNCH
//   replay.events    : OYUNCUNUN KOMUT AKISI (player-move / player-attack / player-ability)
//                      ve AI'in controller-order akisi -> "ne oldu" degil "NE YAPTI"
//
// CIKTI: her boyut icin INSAN / AI degeri ve NORMALIZE FARK (buyukten kucuge siralanir).
// Boylece mudahale, en buyuk farkin oldugu yere kurulur — tahminle degil.
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');
const SADECE = arg('--tohum', '');
const R = Number(arg('--r', 600)) || 600;

// tip indeksi -> id (TUZAK: telemetride attackerType SAYISAL INDEKS'tir, id degil)
const _db = require(path.join(__dirname, '..', 'js', 'UnitData.js'));
const _U = (_db && (_db.UNITS_MODERN_DB || _db.UNITS_MODERN || _db)) || {};
const _L = (Array.isArray(_U.units) ? _U.units : (Array.isArray(_U) ? _U : Object.values(_U))).filter(x => x && x.id);
const TIP = {}; _L.forEach((u, i) => { TIP[i] = u; });
const tipAd = (t) => (TIP[t] ? TIP[t].id : String(t));
const tipFiyat = (t) => (TIP[t] && TIP[t].cost ? (TIP[t].cost.resource || 0) : 0);
const DOLAYLI = new Set(['mortar_team', 'artillery', 'mlrs', 'ballistic_missile']);

let dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json'));
if (SADECE) {
    const izin = SADECE.split(',').map(s => s.trim());
    dosyalar = dosyalar.filter(f => izin.some(t => f.includes('-' + t + '-')));
}
dosyalar.sort();
if (!dosyalar.length) { console.error('kayit yok: ' + DIZIN); process.exit(1); }

// ── boyut toplayicisi: her boyut icin insan/ai birikimi ──
const B = {};   // ad -> { insan: {pay, payda}, ai: {pay, payda}, yon, aciklama }
function boyut(ad, aciklama, yon = 'buyuk-iyi') {
    if (!B[ad]) B[ad] = { insan: { pay: 0, payda: 0 }, ai: { pay: 0, payda: 0 }, yon, aciklama };
    return B[ad];
}
function ekle(ad, insanMi, pay, payda = 1) {
    const b = B[ad]; if (!b) return;
    const t = insanMi ? b.insan : b.ai;
    t.pay += pay; t.payda += payda;
}

for (const dos of dosyalar) {
    const d = JSON.parse(fs.readFileSync(path.join(DIZIN, dos), 'utf8'));
    const r = d.replay || {}; const t = r.telemetry || {};
    const sm = t.samples || [], ev = t.combatEvents || [], le = t.lifeEvents || [], pe = r.events || [];
    if (!sm.length || !ev.length) continue;
    const aiKirmizi = (t.rakipTaraf || 'kirmizi') !== 'mavi';
    const insanKirmizi = !aiKirmizi;
    const insanTaraf = insanKirmizi ? 'red' : 'blue';

    // ── tanimlar ──
    boyut('atesli_tik_orani', 'birimin ates edebilir durumda gecirdigi tik orani');
    boyut('dusman_gorurken_atesSIZ', 'dusman gorusunde ama ATES ETMEYEN tik orani', 'kucuk-iyi');
    boyut('baski_altinda', 'ortalama bastirilma (suppression)', 'kucuk-iyi');
    boyut('siperde', 'siperde gecirilen tik orani');
    boyut('muhimmat_dolulugu', 'ortalama mermi doluluk orani');
    boyut('mermisiz', 'mermisi BITMIS gecirilen tik orani', 'kucuk-iyi');
    boyut('panik', 'panik/kacis tik orani', 'kucuk-iyi');
    boyut('hareket_orani', 'emirli hareket halindeki tik orani');
    boyut('odak_atesi', 'ayni dusmani hedefleyen birim sayisi (tepe)');
    boyut('angajman_mesafesi', 'vurus anindaki ortalama mesafe');
    boyut('dolayli_pay', 'dolayli-ates birimlerinin hasar payi');
    boyut('arka_yan_vurus', 'arka/yan vurus orani');
    boyut('verim_hasar_basi', 'verilen hasar / kaybedilen deger');
    boyut('yerel_oran_oldururken', 'oldururken cevredeki dost/(dusman+1)');
    boyut('kurban_yalnizligi', 'oldurulen dusmanin yanindaki KENDI dostu', 'kucuk-iyi');
    boyut('ikmal_olayi', 'birim basina RESUPPLY olayi');
    boyut('tamir_iyilestirme', 'birim basina REPAIR+HEAL olayi');
    boyut('komut_yogunlugu', 'birim basina verilen komut sayisi');
    // ZENGINLESTIRME (2026-08-09) — yalniz YENI kayitlarda var; eski kayitlarda atlanir
    boyut('net_maruziyet', 'beni vurabilen - vurabildigim (POZITIF = dezavantajli mesafe)', 'kucuk-iyi');
    boyut('dusman_menzilinde', 'kac dusman BENI vurabiliyor', 'kucuk-iyi');
    boyut('menzilimde_dusman', 'kac dusmana ates edebiliyorum');
    boyut('en_yakin_dusman', 'en yakin dusmana mesafe');
    boyut('katedilen_yol', 'birim basina toplam katedilen yol');

    // ── samples uzerinden birim-durumu boyutlari ──
    const odakTepe = { insan: 0, ai: 0, n: 0 };
    for (const s of sm) {
        const hedefSay = { insan: {}, ai: {} };
        for (const u of (s.units || [])) {
            const insanMi = (u.side === insanTaraf);
            ekle('atesli_tik_orani', insanMi, (u.combatState === 'READY' || u.attackTargetId) ? 1 : 0);
            ekle('dusman_gorurken_atesSIZ', insanMi, (u.enemyInVision && !u.attackTargetId) ? 1 : 0);
            ekle('baski_altinda', insanMi, u.suppression || 0);
            ekle('siperde', insanMi, u.inTrench ? 1 : 0);
            if (u.maxAmmo > 0) {
                ekle('muhimmat_dolulugu', insanMi, (u.ammo || 0) / u.maxAmmo);
                ekle('mermisiz', insanMi, (u.ammo <= 0) ? 1 : 0);
            }
            ekle('panik', insanMi, (u.panicking || u.fleeing) ? 1 : 0);
            ekle('hareket_orani', insanMi, u.isMovingToManualTarget ? 1 : 0);
            if (u.netMaruziyet !== undefined) {
                ekle('net_maruziyet', insanMi, u.netMaruziyet);
                ekle('dusman_menzilinde', insanMi, u.dusmanMenzilinde || 0);
                ekle('menzilimde_dusman', insanMi, u.menzilimdeDusman || 0);
                if (u.enYakinDusman >= 0) ekle('en_yakin_dusman', insanMi, u.enYakinDusman);
            }
            if (u.attackTargetId) {
                const h = insanMi ? hedefSay.insan : hedefSay.ai;
                h[u.attackTargetId] = (h[u.attackTargetId] || 0) + 1;
            }
        }
        const tep = (h) => { const v = Object.values(h); return v.length ? Math.max.apply(null, v) : 0; };
        odakTepe.insan += tep(hedefSay.insan); odakTepe.ai += tep(hedefSay.ai); odakTepe.n++;
    }
    if (odakTepe.n) { ekle('odak_atesi', true, odakTepe.insan, odakTepe.n); ekle('odak_atesi', false, odakTepe.ai, odakTepe.n); }

    // ── combatEvents uzerinden ates/oldurme boyutlari ──
    const tikler = sm.map(x => x.tick);
    const enYakin = (tik) => { let lo = 0, hi = tikler.length - 1, b = 0, bd = Infinity;
        while (lo <= hi) { const m = (lo + hi) >> 1, dd = Math.abs(tikler[m] - tik);
            if (dd < bd) { bd = dd; b = m; } if (tikler[m] < tik) lo = m + 1; else hi = m - 1; } return sm[b]; };
    const kayipDeger = { insan: 0, ai: 0 }, verilenHasar = { insan: 0, ai: 0 };
    for (const e of ev) {
        const insanMi = (e.attackerSide === insanTaraf);
        const dz = Math.hypot((e.attackerX - e.targetX), (e.attackerY - e.targetY));
        ekle('angajman_mesafesi', insanMi, dz);
        ekle('dolayli_pay', insanMi, DOLAYLI.has(tipAd(e.attackerType)) ? (e.damage || 0) : 0, (e.damage || 0));
        ekle('arka_yan_vurus', insanMi, (e.rearHit || e.flankHit) ? 1 : 0);
        (insanMi ? verilenHasar : { }) , (insanMi ? verilenHasar.insan += (e.damage || 0) : verilenHasar.ai += (e.damage || 0));
        if (!e.lethal) continue;
        const kurbanInsan = (e.targetSide === insanTaraf);
        if (kurbanInsan) kayipDeger.insan += tipFiyat(e.targetType); else kayipDeger.ai += tipFiyat(e.targetType);
        const s = enYakin(e.tick);
        let dost = 0, dusman = 0;
        for (const u of (s.units || [])) {
            if (u.id === e.targetId) continue;
            if (Math.hypot(u.x - e.targetX, u.y - e.targetY) > R) continue;
            if ((u.side === e.targetSide)) dost++; else dusman++;
        }
        ekle('kurban_yalnizligi', insanMi, dost);
        ekle('yerel_oran_oldururken', insanMi, dusman / (dost + 1));
    }
    ekle('verim_hasar_basi', true, verilenHasar.insan, Math.max(1, kayipDeger.insan));
    ekle('verim_hasar_basi', false, verilenHasar.ai, Math.max(1, kayipDeger.ai));

    // ── lifeEvents ──
    const birimSay = { insan: 0, ai: 0 };
    for (const u of (sm[Math.floor(sm.length / 3)].units || []))
        (u.side === insanTaraf) ? birimSay.insan++ : birimSay.ai++;
    const say = { insan: { ikmal: 0, bakim: 0 }, ai: { ikmal: 0, bakim: 0 } };
    for (const e of le) {
        const insanMi = (e.side === insanTaraf);
        const k = insanMi ? say.insan : say.ai;
        if (e.kind === 'RESUPPLY') k.ikmal++;
        if (e.kind === 'REPAIR' || e.kind === 'HEAL') k.bakim++;
    }
    ekle('ikmal_olayi', true, say.insan.ikmal, Math.max(1, birimSay.insan));
    ekle('ikmal_olayi', false, say.ai.ikmal, Math.max(1, birimSay.ai));
    ekle('tamir_iyilestirme', true, say.insan.bakim, Math.max(1, birimSay.insan));
    ekle('tamir_iyilestirme', false, say.ai.bakim, Math.max(1, birimSay.ai));

    // katedilen yol: SON ornekte birim basina (kumulatif)
    {
        const son = sm[sm.length - 1];
        for (const u of (son.units || [])) if (u.katedilenYol !== undefined)
            ekle('katedilen_yol', (u.side === insanTaraf), u.katedilenYol);
    }

    // ── KOMUT AKISI: insanin gercek komutlari vs AI'in controller-order'lari ──
    let insanKomut = 0, aiKomut = 0;
    for (const e of pe) {
        if (e.type === 'player-move' || e.type === 'player-attack' || e.type === 'player-ability') insanKomut++;
        else if (e.type === 'controller-order') aiKomut++;
    }
    ekle('komut_yogunlugu', true, insanKomut, Math.max(1, birimSay.insan));
    ekle('komut_yogunlugu', false, aiKomut, Math.max(1, birimSay.ai));
}

// ── RAPOR: fark buyuklugune gore sirala ──
const satir = [];
for (const [ad, b] of Object.entries(B)) {
    const i = b.insan.payda ? b.insan.pay / b.insan.payda : 0;
    const a = b.ai.payda ? b.ai.pay / b.ai.payda : 0;
    if (!b.insan.payda && !b.ai.payda) continue;
    const taban = Math.max(Math.abs(i), Math.abs(a), 1e-9);
    const fark = (i - a) / taban;          // normalize fark (-1..1)
    satir.push({ ad, i, a, fark, yon: b.yon, aciklama: b.aciklama });
}
satir.sort((x, y) => Math.abs(y.fark) - Math.abs(x.fark));

console.log('FARK TARAMASI (hipotezsiz) — ' + dosyalar.length + ' kayit');
console.log('  Soru: insan ile AI ayni macta HANGI boyutta en cok ayriliyor?');
console.log('');
console.log('  ' + 'boyut'.padEnd(26) + 'INSAN'.padStart(11) + 'AI'.padStart(11) + 'NORM.FARK'.padStart(11) + '  aciklama');
for (const s of satir) {
    const im = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3));
    const isaret = s.fark > 0 ? '+' : '';
    console.log('  ' + s.ad.padEnd(26) + im(s.i).padStart(11) + im(s.a).padStart(11) +
        (isaret + (s.fark * 100).toFixed(0) + '%').padStart(11) + '  ' + s.aciklama);
}
console.log('');
console.log('  OKUMA: NORM.FARK buyuk olan boyut, mudahalenin kurulacagi yerdir.');
console.log('         Isaret yonu boyutun kendi anlamina gore okunur (aciklama sutunu).');
console.log('         Bu bir HIPOTEZ URETECIDIR; her aday yine kendi A/B kapisindan gecmelidir.');
