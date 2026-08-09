// KATMAN ATFI — canli yenilgide zincir HANGI KATMANDA kopuyor?
//
// DIS ANALIST (2026-08-09, olculmeyenler listesi): "Canli yenilgide zincirin hangi katmanda
// koptugunun sistematik olcumu yok: Perception tehdidi gordu mu -> Situation dogru etiketledi mi
// -> secilen plan makul muydu -> Execution ifade edebildi mi? Telemetriniz bunu destekliyor ama
// metrik yok. Bu olcum, 'ogrenmeye mi yurutmeye mi yatirim' sorusunu tartismadan cikarip veriye baglar."
//
// YONTEM: AI'in her OLUMCUL kaybi icin, o andaki controllerDecisions anlik goruntusune bakilir:
//   K1 PERCEPTION : oldureni AI GORUYOR muydu? (contacts icinde, visible/confidence)
//   K2 SITUATION  : durum degerlendirmesi tehdidi yansitiyor muydu? (contactState, threatProfile,
//                   hava tehdidi varsa kategorilerde gorunuyor mu)
//   K3 COMMITMENT : o an baglanilan plan, duruma makul muydu? (kuvvet orani dusukken MAIN_ATTACK gibi)
//   K4 EXECUTION  : kurban plana uygun emir aliyor muydu, yoksa tehdide DOGRU mu ilerliyordu?
//
// Cikti: olumlerin katmanlara dagilimi. En cok kopan katman, yatirimin gitmesi gereken yerdir.
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DIZIN = arg('--dizin', 'C:/Users/osman/Downloads');
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi-');
const SADECE = arg('--tohum', '');
const SAY_HARCANABILIR = process.argv.includes('--harcanabilir');   // varsayilan: kamikaze/kesif-IHA HARIC

const _db = require(path.join(__dirname, '..', 'js', 'UnitData.js'));
const _U = (_db && (_db.UNITS_MODERN_DB || _db.UNITS_MODERN || _db)) || {};
const _L = (Array.isArray(_U.units) ? _U.units : Object.values(_U)).filter(x => x && x.id);
const AD = {}; _L.forEach((u, i) => { AD[i] = u.id; });
const HAVA = new Set(['attack_helo', 'armed_uav', 'recon_uav', 'loitering_munition', 'transport_helo']);

let dosyalar = fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json'));
if (SADECE) { const izin = SADECE.split(',').map(s => s.trim()); dosyalar = dosyalar.filter(f => izin.some(t => f.includes('-' + t + '-'))); }
dosyalar.sort();
if (!dosyalar.length) { console.error('kayit bulunamadi'); process.exit(1); }

const KAT = { gormedi: 0, gordu_etiketlemedi: 0, etiketledi_plan_uygunsuz: 0, plan_uygun_yurutme: 0, belirsiz: 0 };
const detay = [];
let toplamOlum = 0;
const gorulenOran = [];

for (const dos of dosyalar) {
    const d = JSON.parse(fs.readFileSync(path.join(DIZIN, dos), 'utf8'));
    const t = (d.replay || {}).telemetry || {};
    const cd = t.controllerDecisions || [], ce = t.combatEvents || [], sm = t.samples || [];
    if (!cd.length || !ce.length) continue;
    const aiKirmizi = (t.rakipTaraf || 'kirmizi') !== 'mavi';
    const AIS = aiKirmizi ? 'red' : 'blue';
    const kendi = cd.filter(c => (((c.side === true || c.side === 'red') ? 'red' : 'blue') === AIS));
    if (!kendi.length) continue;
    const kararTik = kendi.map(c => c.tick);
    const enYakinKarar = (tik) => {
        let lo = 0, hi = kararTik.length - 1, b = 0, bd = Infinity;
        while (lo <= hi) { const m = (lo + hi) >> 1, dd = Math.abs(kararTik[m] - tik);
            if (dd < bd) { bd = dd; b = m; } if (kararTik[m] < tik) lo = m + 1; else hi = m - 1; }
        return kendi[b];
    };

    for (const e of ce) {
        if (!e.lethal || e.targetSide !== AIS) continue;
        // HARCANABILIR birimleri disla: kamikaze mühimmat zaten olmek uzere gonderiliyor, kesif IHA ucuz.
        // Bunlari "kayip" saymak katman atfini sisirir (ilk kosuda olumlerin cogu loitering_munition cikti).
        const _kurbanTip = AD[e.targetType] || String(e.targetType);
        if (!SAY_HARCANABILIR && (_kurbanTip === 'loitering_munition' || _kurbanTip === 'recon_uav')) continue;
        toplamOlum++;
        const k = enYakinKarar(e.tick);
        if (!k) { KAT.belirsiz++; continue; }
        const obs = k.observation || {}, sit = k.situation || {};
        const katilTip = AD[e.attackerType] || String(e.attackerType);

        // ── K1 PERCEPTION: oldureni goruyor muydu? ──
        // Kontaklar konumlu; oldurenin o andaki konumuna yakin GORUNUR bir kontak var mi?
        const kontaklar = obs.contacts || [];
        let gordu = false, enYakinKontak = Infinity;
        for (const c of kontaklar) {
            const dd = Math.hypot((c.x || 0) - (e.attackerX || 0), (c.y || 0) - (e.attackerY || 0));
            if (dd < enYakinKontak) enYakinKontak = dd;
            if (dd <= 400 && (c.visible || (c.confidence || 0) >= 0.5)) gordu = true;
        }
        gorulenOran.push(gordu ? 1 : 0);
        if (!gordu) {
            KAT.gormedi++;
            if (detay.length < 8) detay.push('  GORMEDI  ' + katilTip + ' -> ' + (AD[e.targetType] || '?') +
                '   en yakin kontak ' + (Number.isFinite(enYakinKontak) ? Math.round(enYakinKontak) + 'px' : 'kontak yok') +
                '  (t=' + Math.round(e.seconds) + 'sn)');
            continue;
        }

        // ── K2 SITUATION: HAVA tehdidiyse durum bunu yansitiyor mu? ──
        if (HAVA.has(katilTip)) {
            const kat = sit.categories && sit.categories.enemy;
            const havaGoruldu = kat && ((kat.air || 0) > 0 || (kat.antiAir || 0) > 0 || (kat.uav || 0) > 0);
            const tehditProfili = sit.threatProfile;
            if (!havaGoruldu && !tehditProfili) {
                KAT.gordu_etiketlemedi++;
                if (detay.length < 8) detay.push('  ETIKETLEMEDI  ' + katilTip + ' gorundu ama durumda HAVA tehdidi yok  (t=' + Math.round(e.seconds) + 'sn)');
                continue;
            }
        }

        // ── K3 COMMITMENT: plan duruma makul muydu? ──
        const plan = (k.committedPlan || {}).kind;
        const oran = sit.forceRatio;
        const uygunsuz = (plan === 'MAIN_ATTACK' || plan === 'ADVANCE') && Number.isFinite(oran) && oran < 0.8;
        if (uygunsuz) {
            KAT.etiketledi_plan_uygunsuz++;
            if (detay.length < 8) detay.push('  PLAN UYGUNSUZ  ' + plan + ' ama kuvvet orani ' + oran.toFixed(2) + '  (t=' + Math.round(e.seconds) + 'sn)');
            continue;
        }

        // ── K4 EXECUTION: gordu, etiketledi, plan makul -> kopus YURUTMEDE ──
        KAT.plan_uygun_yurutme++;
        if (detay.length < 8) detay.push('  YURUTME  ' + katilTip + ' -> ' + (AD[e.targetType] || '?') +
            '   plan ' + plan + '  oran ' + (Number.isFinite(oran) ? oran.toFixed(2) : '?') + '  (t=' + Math.round(e.seconds) + 'sn)');
    }
}

const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const top = Object.values(KAT).reduce((a, b) => a + b, 0);
console.log('KATMAN ATFI — AI olumlerinde zincir nerede kopuyor? (' + dosyalar.length + ' kayit, ' + toplamOlum + ' AI olumu)');
console.log('');
const satir = [
    ['K1 PERCEPTION — oldureni HIC GORMEDI', KAT.gormedi],
    ['K2 SITUATION  — gordu ama ETIKETLEMEDI', KAT.gordu_etiketlemedi],
    ['K3 COMMITMENT — etiketledi ama PLAN UYGUNSUZ', KAT.etiketledi_plan_uygunsuz],
    ['K4 EXECUTION  — hersey dogru, YURUTME kopardi', KAT.plan_uygun_yurutme],
    ['belirsiz', KAT.belirsiz]
];
for (const [ad, n] of satir)
    console.log('  ' + ad.padEnd(46) + String(n).padStart(5) + '  %' + (top ? Math.round(n / top * 100) : 0));
console.log('');
console.log('  AI oldurenini gorme orani: %' + Math.round(ort(gorulenOran) * 100));
console.log('');
console.log('  ORNEKLER:');
for (const x of detay) console.log(x);
console.log('');
console.log('  YORUM: en buyuk pay HANGI katmandaysa yatirim ORAYA gitmeli.');
console.log('  K4 baskinsa: plan secimi (ogrenme) degil YURUTME katmani sorunlu demektir.');
