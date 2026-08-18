'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  OYUNCU MAÇI ANALİZİ — insanın oynadığı bir maçın ham kaydını okur
//
//  GİRDİ: `qa-runtime/last-match.json` (her maç sonunda otomatik yazılır) ya da
//  "Ham JSON İndir" ile alınan dosya. Tek dosya veya klasör verilebilir.
//
//  NE SORAR:
//    1) Kim kazandı, maç NE ZAMAN belirlendi (marj yörüngesi)
//    2) Takas verimi — her taraf ne kadar değer imha etti / kaybetti
//    3) ⭐ ARAMA GERÇEKTEN KOŞTU MU: `lookahead-order` olayları. Worker'lı ÖNGÖRÜ'de
//       emirler bu olayla kayda giriyor; SIFIRSA arama oyunda hiç çalışmamış demektir
//       ve "AI zayıftı" yorumu yanlış yere gider. Bu kapı ilk bakılacak şey.
//    4) AI'nın dağılımı (blob mu, yayılmış mı) — kayıtlı kusur sınıfı
//    5) Oyuncunun eylem profili (hareket / yetenek) — kıyas adil mi
//    6) Ölüm coğrafyası: kim nerede öldü
//
//  ⚠ TEK MAÇ KARAR VERDİRMEZ. Maç marjı std ≈ 2600; bir maç anekdottur. Bu araç
//  "ne oldu" sorusunu cevaplar, "hangisi daha iyi" sorusunu DEĞİL (o maç kapısının işi).
//
//    node tools/oyuncu-mac-analiz.js [--dosya qa-runtime/last-match.json] [--dizin <klasor>]
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const DOSYA = arg('--dosya', 'qa-runtime/last-match.json');
const DIZIN = arg('--dizin', null);
const ONEK = arg('--onek', 'pixel-rts-ham-savas-kaydi');

function dosyalar() {
    if (DIZIN) {
        return fs.readdirSync(DIZIN).filter(f => f.startsWith(ONEK) && f.endsWith('.json'))
            .sort().map(f => path.join(DIZIN, f));
    }
    return [DOSYA];
}

const say = (n, g = 0) => (n == null || !isFinite(n)) ? '-' : n.toFixed(g);
const yuz = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '-';

function analiz(yol) {
    const d = JSON.parse(fs.readFileSync(yol, 'utf8'));
    const r = d.replay || d;
    const t = r.telemetry || {};
    const s = r.session || {};
    const olaylar = r.events || [];
    const ornekler = t.samples || [];
    const ozet = t.finalSummary || {};

    console.log('');
    console.log('═'.repeat(78));
    console.log('  ' + path.basename(yol) + '   tohum ' + (s.seed != null ? s.seed : '?') +
        '   motor ' + (r.engineVersion || '?').slice(-28));
    console.log('═'.repeat(78));

    // ── 1) ⭐ ARAMA KOŞTU MU (ilk bakılacak) ──────────────────────────────
    const laEmir = olaylar.filter(e => e.type === 'lookahead-order');
    const ctrlEmir = olaylar.filter(e => e.type === 'controller-order');
    console.log('');
    console.log('  ⭐ ARAMA (ÖNGÖRÜ) KOŞTU MU');
    if (!laEmir.length) {
        console.log('     lookahead-order olayı: 0  →  ARAMA HİÇ ÇALIŞMAMIŞ');
        console.log('     (ÖNGÖRÜ kademesi seçilmedi ya da worker açılamadı. Bu maçtan');
        console.log('      "arama zayıf" sonucu ÇIKARILAMAZ — arama yok.)');
    } else {
        const tikler = laEmir.map(e => e.tick).sort((a, b) => a - b);
        const birimler = new Set(laEmir.map(e => (e.payload || {}).id));
        const aralik = [];
        for (let i = 1; i < tikler.length; i++) if (tikler[i] !== tikler[i - 1]) aralik.push(tikler[i] - tikler[i - 1]);
        console.log('     lookahead-order: ' + laEmir.length + ' emir · ' + birimler.size + ' ayrı birim');
        console.log('     ilk tik ' + tikler[0] + '  son tik ' + tikler[tikler.length - 1] +
            '  (maç ' + (ozet.endTick || (ornekler.length ? ornekler[ornekler.length - 1].tick : '?')) + ' tik)');
        console.log('     kontrolör emri ' + ctrlEmir.length + ' · arama emri ' + laEmir.length +
            '  → aramanın payı ' + yuz(laEmir.length, laEmir.length + ctrlEmir.length));
    }

    // ── 2) SONUÇ + MARJ YÖRÜNGESİ ────────────────────────────────────────
    /* ⚠ ALAN ADLARI TAHMIN EDILMEZ, KAYITTAN OKUNUR. Ilk surumde `winnerSide`,
       `endTick`, `redValue` gibi adlar VARSAYILMISTI; kayitta yoklar ve arac "berabere,
       0sn, 0₺ takas" diye YANLIS ama inandirici bir tablo bastı. Gercek semа:
         finalSummary: durationSeconds · outcomeReason · attackerSide · blue/redSurvivors
         samples[i]  : tick · seconds · pMoney/eMoney · battle{winnerSide,...} · units[]
         units[i]    : side('red'|'blue') · hp · maxHp · type · owner · x,y
         combatEvents: kind · attackerSide · targetSide · damage · lethal · flankHit/rearHit */
    console.log('');
    console.log('  SONUÇ');
    const sonOrnek = ornekler.length ? ornekler[ornekler.length - 1] : null;
    const ws = (sonOrnek && sonOrnek.battle) ? sonOrnek.battle.winnerSide : null;
    const kazanan = ws === true ? 'KIRMIZI (AI)' : ws === false ? 'MAVİ' : 'karara bağlanmadı';
    console.log('     kazanan: ' + kazanan + '   sebep: ' + (ozet.outcomeLabel || ozet.outcomeReason || '-'));
    console.log('     süre: ' + say(ozet.durationSeconds, 1) + 'sn   ·   saldıran taraf: ' +
        (ozet.attackerSide || '?') + '   ·   sağ kalan  kırmızı ' + (ozet.redSurvivors != null ? ozet.redSurvivors : '?') +
        ' / mavi ' + (ozet.blueSurvivors != null ? ozet.blueSurvivors : '?'));

    /* MARJ = ayakta kalan birimlerin HP-agirlikli sayisi (kayitta ₺ degeri yok; `pMoney`
       oyuncunun parasi, kuvvet degeri DEGIL). Mutlak ₺ yerine ORAN raporlanir. */
    if (ornekler.length) {
        const kuvvet = (o, taraf) => (o.units || []).filter(u => u.side === taraf && (u.hp || 0) > 0)
            .reduce((a, u) => a + (u.hp || 0) / Math.max(1, u.maxHp || 1), 0);
        const noktalar = [0, 0.25, 0.5, 0.75, 1].map(q =>
            ornekler[Math.min(ornekler.length - 1, Math.floor((ornekler.length - 1) * q))]);
        console.log('     kuvvet yörüngesi (kırmızı / mavi, HP-ağırlıklı birim):');
        console.log('        ' + noktalar.map(o =>
            say(o.seconds, 0) + 'sn ' + say(kuvvet(o, 'red'), 1) + '/' + say(kuvvet(o, 'blue'), 1)).join('   ·   '));
    }

    // ── 3) TAKAS VERİMİ ──────────────────────────────────────────────────
    const co = t.combatEvents || [];
    if (co.length) {
        let kHasar = 0, mHasar = 0, kOldurdu = 0, mOldurdu = 0, kFlank = 0, mFlank = 0;
        const tur = {};
        for (const e of co) {
            const kirmiziVurdu = e.attackerSide === 'red';
            if (kirmiziVurdu) { kHasar += e.damage || 0; if (e.lethal) kOldurdu++; if (e.flankHit || e.rearHit) kFlank++; }
            else { mHasar += e.damage || 0; if (e.lethal) mOldurdu++; if (e.flankHit || e.rearHit) mFlank++; }
            tur[e.kind || '?'] = (tur[e.kind || '?'] || 0) + 1;
        }
        console.log('');
        console.log('  ATEŞ  (combatEvents ' + co.length + ' kayıt — ÖRNEKLEM, tam kayıt değil)');
        console.log('     kırmızı(AI): hasar ' + say(kHasar, 0) + ' · öldürme ' + kOldurdu +
            ' · yan/arka vuruş ' + kFlank + ' (' + yuz(kFlank, co.filter(e => e.attackerSide === 'red').length) + ')');
        console.log('     mavi       : hasar ' + say(mHasar, 0) + ' · öldürme ' + mOldurdu +
            ' · yan/arka vuruş ' + mFlank + ' (' + yuz(mFlank, co.filter(e => e.attackerSide !== 'red').length) + ')');
        console.log('     atış türleri: ' + Object.entries(tur).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '×' + v).join(' · '));
    }

    // ── 4) AI DAĞILIMI (blob kusuru) ─────────────────────────────────────
    if (ornekler.length) {
        const dag = [];
        for (const o of ornekler) {
            const us = (o.units || []).filter(u => u.side === 'red' && (u.hp || 0) > 0);
            if (us.length < 4) continue;
            let top = 0, n = 0;
            for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
                top += Math.hypot((us[i].x || 0) - (us[j].x || 0), (us[i].y || 0) - (us[j].y || 0)); n++;
            }
            if (n) dag.push(top / n);
        }
        if (dag.length) {
            const ort = dag.reduce((a, b) => a + b, 0) / dag.length;
            console.log('');
            console.log('  AI DAĞILIMI (kırmızı birimlerin ortalama ikili mesafesi): ' + say(ort, 0) + 'px');
            console.log('     (düşükse BLOB — kayıtlı kusur sınıfı; ölçüm kıyas içindir, tek maç karar vermez)');
        }
    }

    // ── 5) OYUNCU EYLEM PROFİLİ ──────────────────────────────────────────
    const pm = olaylar.filter(e => e.type === 'player-move');
    const pa = olaylar.filter(e => e.type === 'player-ability');
    const pAtk = olaylar.filter(e => e.type === 'player-attack');
    console.log('');
    console.log('  OYUNCU: ' + pm.length + ' hareket · ' + pAtk.length + ' saldır · ' + pa.length + ' yetenek');
    if (pa.length) {
        const say2 = {};
        for (const e of pa) { const a = (e.payload || {}).ability || '?'; say2[a] = (say2[a] || 0) + 1; }
        console.log('     yetenekler: ' + Object.entries(say2).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => k + '×' + v).join(' · '));
    }

    // ── 6) ÖLÜM COĞRAFYASI ───────────────────────────────────────────────
    const le = t.lifeEvents || [];
    if (le.length) {
        const kinds = {};
        for (const e of le) {
            const a = (e.kind || '?') + ' ' + (e.side || '?');
            kinds[a] = (kinds[a] || 0) + 1;
        }
        console.log('');
        console.log('  YAŞAM OLAYLARI: ' + Object.entries(kinds).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => k + '×' + v).join(' · '));
    }
    return { yol, laEmir: laEmir.length, kazanan: kazanan, sure: ozet.durationSeconds };
}

const liste = dosyalar();
const sonuc = [];
for (const y of liste) {
    if (!fs.existsSync(y)) { console.log('dosya yok: ' + y); continue; }
    try { sonuc.push(analiz(y)); }
    catch (e) { console.log('okunamadi ' + y + ': ' + e.message); }
}
if (sonuc.length > 1) {
    console.log('');
    console.log('  ═══ TOPLU ═══');
    for (const s of sonuc) console.log('     ' + path.basename(s.yol) + '   kazanan ' + s.kazanan +
            '   sure ' + say(s.sure, 0) + 'sn   arama emri ' + s.laEmir);
}
console.log('');
console.log('  ⚠ TEK MAÇ KARAR VERDİRMEZ (marj std ≈ 2600). Bu araç "ne oldu" der,');
console.log('    "hangisi daha iyi" demez — o maç kapısının işi (tools/rol-dengesi-paralel.js).');
