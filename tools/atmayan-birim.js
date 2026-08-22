'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ATMAYAN BİRİM — "AI'nın kaç birimi hiç ateş etmedi ve NEDEN?"
//
//  Kullanıcının 4 gerçek maçında AI'nın fırsat oranı oyuncunun yarısı çıktı. Bir kısmı
//  MENZİL UYUMSUZLUĞU ile açıklandı (AI'nın silahı düşmanın durduğu yere yetmiyor —
//  ../docs/battle-ai/reports/OYUNCU-MACLARI-BULGULAR.md). Geriye "hiç ateş etmeyen 2-4 birim" kaldı ve o
//  kısım açıklanmadı. Bu araç onu tek tek adlandırır.
//
//  ⚠ İKİ ÖLÇÜM TUZAĞI, ikisi de daha önce yaşandı:
//   1) SİLAHSIZ BİRİMİ SUÇLAMA. Radar/ikmal/sağlık/EW/karargâh zaten ateş etmez.
//      Bir önceki sürümde bunlar sayıldı ve AI 3.1 kat kötü göründü (gerçeği 1.7×).
//   2) HAVA SAVUNMASINI SUÇLAMA. MANPADS/SAM yalnız uçağa ateş eder; maçta hiç uçak
//      yoksa ateş etmemeleri DOĞRU davranıştır. Ayrı sayılır, kusur listesine girmez.
//
//  ⚠ ÖLÇÜNÜN SINIRI: combatEvents İSABET anında yazılır, atış anında değil. Yani
//  "hiç ateş etmedi" aslında "hiç İSABET ETTİRMEDİ" demektir. Rapor bunu her seferinde
//  yazar ki bulgu olduğundan büyük görünmesin.
//
//    node tools/atmayan-birim.js --dosya <ham.json> [--taraf red]
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DOSYA = arg('--dosya', 'qa-runtime/last-match.json');
const TARAF = arg('--taraf', 'red');

const AD = { 0:'PİYADE',1:'TANKSAVAR',2:'HAVAN',3:'MANPADS',4:'KOMANDO',5:'ZIRHLI',6:'MEKANİZE',
    7:'TANK_AVCISI',8:'TOPÇU',9:'ÇNRA',10:'BALİSTİK',11:'RADAR',12:'SPAAG',13:'SAM',14:'HELO',
    15:'NAKLİYE_HELO',16:'KEŞİF_İHA',17:'SİHA',18:'KAMİKAZE',19:'KEŞİF',20:'EW',21:'SIHHİYE',
    22:'İSTİHKÂM',23:'İKMAL',24:'KARARGÂH',25:'DRON_OPERATÖRÜ' };
const ad = (t) => AD[t] || ('tip' + t);
const SILAHSIZ = new Set([11, 15, 16, 20, 21, 22, 23, 24, 25]);
const YALNIZ_HAVA = new Set([3, 13]);
const HAVA = new Set([14, 15, 16, 17, 18]);

const d = JSON.parse(fs.readFileSync(DOSYA, 'utf8'));
const r = d.replay || d;
const t = r.telemetry || {};
const sm = t.samples || [];
const co = t.combatEvents || [];
if (!sm.length) { console.log('örnek yok: ' + DOSYA); process.exit(1); }

// ── kim isabet ettirdi ───────────────────────────────────────────────────
const atan = new Map();
for (const e of co) if (e.attackerSide === TARAF) atan.set(e.attackerId, (atan.get(e.attackerId) || 0) + 1);
// maçta hiç hava hedefi var mıydı? (yalnız-hava birimleri haksız suçlanmasın)
const havaHedefVardi = sm.some(o => (o.units || []).some(u => u.side !== TARAF && HAVA.has(u.type) && (u.hp || 0) > 0));

// ── birim birim topla ────────────────────────────────────────────────────
const B = new Map();
for (const o of sm) {
    for (const u of (o.units || [])) {
        if (u.side !== TARAF) continue;
        let b = B.get(u.id);
        if (!b) {
            b = { id: u.id, type: u.type, n: 0, canli: 0, menzilde: 0, kuru: 0, kuruVeMenzilde: 0,
                  bastirilmis: 0, panik: 0, tikali: 0, ikmalKesik: 0, hedefVar: 0, hedefsizMenzilde: 0,
                  enYakinTop: 0, etkiliMenzil: u.etkiliMenzil || 0, yol: 0, olduSn: null,
                  sabit: 0, hareketOrnek: 0, sonX: null, sonY: null };
            B.set(u.id, b);
        }
        b.n++;
        if ((u.hp || 0) <= 0) { if (b.olduSn == null) b.olduSn = o.seconds; continue; }
        b.canli++;
        b.yol = Math.max(b.yol, u.katedilenYol || 0);
        if (u.etkiliMenzil) b.etkiliMenzil = u.etkiliMenzil;
        /* ⚠ HAVA SAVUNMASI ICIN "menzilimdeDusman" YANLIS OLCU: o alan menzildeki HER
           dusmani sayar, kara dahil. MANPADS/SAM karaya ates EDEMEZ; menzilinde bir tank
           varken "menzilde ama hedef secmemis" demek onu haksiz suclamaktir (ilk surumde
           tam bu oldu: MANPADS#7 "HEDEFLEME KUSURU" diye raporlandi, oysa dogru davraniyordu).
           Bu birimler icin menzil, YALNIZ hava dusmanina gore yeniden hesaplanir. */
        let menzilde = (u.menzilimdeDusman || 0) > 0;
        if (YALNIZ_HAVA.has(u.type)) {
            const R = u.etkiliMenzil || 0;
            menzilde = R > 0 && (o.units || []).some(e => e.side !== TARAF && HAVA.has(e.type) &&
                (e.hp || 0) > 0 && Math.hypot((e.x - u.x), (e.y - u.y)) <= R);
        }
        if (menzilde) b.menzilde++;
        if ((u.maxAmmo || 0) > 0 && (u.ammo || 0) <= 0) { b.kuru++; if (menzilde) b.kuruVeMenzilde++; }
        if ((u.suppression || 0) > 0.3) b.bastirilmis++;
        if (u.panicking || (u.panic || 0) > 0.3) b.panik++;
        /* ⚠ `navBlocked` "TIKALI" DEMEK DEGIL. Telemetride o alan sadece sunu soyler:
           birimden hedef noktasina DUZ CIZGI arazi tarafindan kapali (js/BattleSession.js
           `pathBlockedBetween`). Birim pekala engelin etrafindan yuruyor olabilir — nitekim
           bu araci ilk yazdigimda 16 birimi "NAVIGASYON TIKALI" diye etiketledim, oysa
           olcu bunu soylemiyordu. Gercek takilma: UZAK bir hedefi varken YERINDEN
           KIPIRDAMIYOR. Asagidaki `sabit` sayaci onu olcer; teshis artik ona bakar. */
        if (u.navBlocked) b.tikali++;
        const uzakHedef = (u.targetDistance || 0) > 50;
        if (b.sonX != null) {
            const oynadi = Math.hypot(u.x - b.sonX, u.y - b.sonY);
            if (uzakHedef) { b.hareketOrnek++; if (oynadi < 1.5) b.sabit++; }
        }
        b.sonX = u.x; b.sonY = u.y;
        if (u.supplyCut) b.ikmalKesik++;
        if (u.targetId != null) b.hedefVar++;
        else if (menzilde) b.hedefsizMenzilde++;
        b.enYakinTop += (u.enYakinDusman || 0);
    }
}

const say = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n);
const yuzde = (a, b) => b ? '%' + say(a / b * 100, 0) : '—';

console.log('');
console.log('ATMAYAN BİRİM — ' + path.basename(DOSYA));
console.log('  taraf ' + TARAF + ' · ' + sm.length + ' örnek · ' + co.length + ' isabet olayı · maçta hava hedefi ' +
    (havaHedefVardi ? 'VARDI' : 'YOKTU'));
console.log('  uyarı: "ateş etti" = İSABET ETTİRDİ; ıskalar bu kayıtta görünmez.');
console.log('');

const hepsi = [...B.values()];
const silahli = hepsi.filter(b => !SILAHSIZ.has(b.type));
const sayilabilir = silahli.filter(b => !(YALNIZ_HAVA.has(b.type) && !havaHedefVardi));
const atmayan = sayilabilir.filter(b => !atan.has(b.id));

console.log('  toplam ' + hepsi.length + ' birim · silahsız (hariç) ' + (hepsi.length - silahli.length) +
    ' · yalnız-hava ama hedef yok (hariç) ' + (silahli.length - sayilabilir.length));
console.log('  SAYILABİLİR ' + sayilabilir.length + ' birimin ' + atmayan.length +
    ' tanesi hiç isabet ettirmedi (' + yuzde(atmayan.length, sayilabilir.length) + ')');
console.log('');

if (!atmayan.length) { console.log('  atmayan birim yok.'); process.exit(0); }

const KOVA = { havaBos: [], hicMenzilde: [], kuru: [], bastirilmis: [], tikali: [], erkenOldu: [], hedefsiz: [], acikYok: [] };
console.log('  ' + 'birim'.padEnd(22) + 'canlı'.padStart(7) + '  menzilde'.padStart(12) +
    'kuru'.padStart(7) + 'bastır'.padStart(8) + 'takılı'.padStart(8) + 'ikmalKsk'.padStart(10) +
    'ortMesafe'.padStart(11) + 'menzil'.padStart(8) + '   TEŞHİS');
for (const b of atmayan.sort((x, y) => y.canli - x.canli)) {
    const ortMes = b.canli ? b.enYakinTop / b.canli : 0;
    let teshis;
    if (b.canli < 20 && b.olduSn != null) { teshis = 'ERKEN ÖLDÜ (' + Math.round(b.olduSn) + 'sn)'; KOVA.erkenOldu.push(b); }
    else if (b.menzilde === 0 && YALNIZ_HAVA.has(b.type)) {
        teshis = 'HAVA SAVUNMASI — menziline UÇAK girmedi (DOĞRU davranış)'; KOVA.havaBos.push(b);
    }
    else if (b.menzilde === 0) { teshis = 'MENZİLİNE DÜŞMAN HİÇ GİRMEDİ'; KOVA.hicMenzilde.push(b); }
    else if (b.kuruVeMenzilde > b.menzilde * 0.5) { teshis = 'MÜHİMMAT BİTTİ (menzildeyken kuru)'; KOVA.kuru.push(b); }
    else if (b.bastirilmis > b.canli * 0.3) { teshis = 'BASTIRILMIŞ'; KOVA.bastirilmis.push(b); }
    else if (b.hareketOrnek >= 10 && b.sabit > b.hareketOrnek * 0.6) {
        teshis = 'TAKILI KALDI (uzak hedefi var, kıpırdamıyor %' +
            say(b.sabit / b.hareketOrnek * 100, 0) + ')'; KOVA.tikali.push(b);
    }
    else if (b.hedefsizMenzilde > b.menzilde * 0.5) { teshis = 'MENZİLDE AMA HEDEF SEÇMEMİŞ'; KOVA.hedefsiz.push(b); }
    else { teshis = 'AÇIKLANAMADI (menzildeydi, hedefi vardı, isabet yok)'; KOVA.acikYok.push(b); }
    console.log('  ' + (ad(b.type) + '#' + b.id).padEnd(22) + String(b.canli).padStart(7) +
        (String(b.menzilde) + ' ' + yuzde(b.menzilde, b.canli)).padStart(12) +
        yuzde(b.kuru, b.canli).padStart(7) + yuzde(b.bastirilmis, b.canli).padStart(8) +
        yuzde(b.sabit, b.hareketOrnek).padStart(8) + yuzde(b.ikmalKesik, b.canli).padStart(10) +
        String(Math.round(ortMes)).padStart(11) + String(Math.round(b.etkiliMenzil)).padStart(8) +
        '   ' + teshis);
}

console.log('');
console.log('  ═══ TEŞHİS ÖZETİ (kaç birim) ═══');
const etiket = {
    havaBos:     'hava savunması, uçak gelmedi  → KUSUR DEĞİL',
    hicMenzilde: 'menziline düşman hiç girmedi  → KONUMLANDIRMA/MENZİL',
    kuru:        'mühimmat bitti                → LOJİSTİK',
    bastirilmis: 'bastırılmış                   → ATEŞ ALTINDA',
    tikali:      'takılı kaldı (kıpırdamıyor)    → HAREKET',
    erkenOldu:   'erken öldü                    → hayatta kalma',
    hedefsiz:    'menzilde ama hedef seçmemiş   → HEDEFLEME KUSURU',
    acikYok:     'açıklanamadı                  → İNCELE'
};
for (const k of Object.keys(KOVA)) if (KOVA[k].length)
    console.log('    ' + String(KOVA[k].length).padStart(3) + '  ' + etiket[k]);
console.log('');
