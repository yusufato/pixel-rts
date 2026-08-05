#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ADAY ÜRETECİ — sürüm turnuvası için kompozisyon havuzu
//
//  NEDEN: kod-AI'ın doktrin çekilişi yalnız 10 aileye dayanıyor ve ÖLÇÜLDÜ ki
//  120 ordunun hiçbirinde şu birimler YOK: Balistik Füze (1050₺), Nakliye Helo (400₺),
//  Komuta Aracı (600₺). Nadir olanlar: SİHA %8, EH/Jammer %10, SAM %15, ÇNRA %17,
//  Taarruz Helo %22, Hava-Arama Radarı %27.
//  Yani 25 dizilebilir birimin 9'u hiç/nadir sınanıyor → iyi mi kötü mü BİLMİYORUZ.
//  Örüntü: neredeyse hepsi PAHALI (1050/800/700/650/600/550/480₺) — kodun kendi
//  yorumlarının uyardığı "pahalı birim yapısal dışlanması".
//
//  Bu araç adayları DÖRT AİLEDEN üretir; hepsi tarif (recipe) biçiminde, yani
//  deterministik ve bütçe-denetimli:
//    A) KEŞİF   — her az-kullanılan birimi ZORUNLU kılan tarifler (kör nokta kapanır)
//    B) SÜPÜRME — kategori paylarını geniş bantta tarayan tarifler
//    C) ÖRNEKLEM— pay uzayından deterministik rastgele çekilişler (çeşitlilik)
//    D) REFERANS— R0 (mevcut AI ortalaması), B4 (FAZ 2 kazananı), RU (kullanıcı)
//
//  Kullanım:
//    node tools/aday-uret.js --sayi 256 --out qa-runtime/adaylar.json
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function arg(ad, vars) { const i = process.argv.indexOf(ad); return i >= 0 ? process.argv[i + 1] : vars; }

const SAYI = Math.max(8, Number(arg('--sayi', 256)) || 256);
const CIKTI = arg('--out', 'qa-runtime/adaylar.json');
const TABAN_YOL = arg('--taban', 'qa-runtime/tarifler-taban.json');
const TOHUM = Number(arg('--tohum', 20260805)) || 20260805;

// Deterministik RNG (Math.random YOK — aday havuzu tekrarlanabilir olmalı)
function rng(s) { let x = s >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
const rnd = rng(TOHUM);

// ── ÖLÇÜLEN KÖR NOKTALAR (120 ordu taramasından) ──────────────────────────
// Her biri için ZORUNLU adet konur ki tarif çözücüsü onları gerçekten alsın.
// KULLANICI DÜZELTMESİ: Kamikaze Drone (loitering_munition) LİSTEDE DEĞİL — o dizilen bir
// birim değil, DRONE OPERATÖRÜNÜN ürettiği bir birim (`launch_drone`). Yani "120 orduda %0"
// ölçümü onun için yanlış okumaydı: zaten operatör üzerinden sahaya çıkıyor. Dizilebilir
// roster 25 birimdir. Onu zorunlu kılmak sahte bir keşif ekseni yaratırdı.
const KOR_NOKTA = [
    { id: 'ballistic_missile', ad: 'balistik', adet: [1], kat: 'indirect' },
    { id: 'transport_helo', ad: 'nakliyehelo', adet: [1], kat: 'air' },
    { id: 'command_vehicle', ad: 'komuta', adet: [1], kat: 'command' },
    { id: 'armed_uav', ad: 'siha', adet: [1, 2], kat: 'uav' },
    { id: 'ew_vehicle', ad: 'jammer', adet: [1, 2], kat: 'support' },
    { id: 'sam_battery', ad: 'sam', adet: [1, 2], kat: 'air_defense' },
    { id: 'mlrs', ad: 'cnra', adet: [1, 2], kat: 'indirect' },
    { id: 'attack_helo', ad: 'helo', adet: [1, 2], kat: 'air' },
    { id: 'counter_battery_radar', ad: 'radar', adet: [1], kat: 'support' }
];

const KATEGORILER = ['infantry', 'armor', 'indirect', 'support', 'air_defense', 'air', 'uav', 'recon', 'logistics', 'command'];

function normalize(p) {
    const t = Object.values(p).reduce((a, b) => a + b, 0) || 1;
    const o = {};
    for (const k of Object.keys(p).sort()) if (p[k] > 0.0005) o[k] = +(p[k] / t).toFixed(4);
    return o;
}

function main() {
    const taban = JSON.parse(fs.readFileSync(path.join(ROOT, TABAN_YOL), 'utf8'));
    const R0 = taban.find(t => t.ad === 'R0-attacker');
    if (!R0) { console.log('R0-attacker bulunamadı: ' + TABAN_YOL + ' (önce --recipebase koşun)'); process.exit(1); }
    const tip = R0.tipPaylari;
    const adaylar = [];
    const ekle = (ad, paylar, ek) => adaylar.push(Object.assign(
        { ad, rol: 'attacker', paylar: normalize(paylar), tipPaylari: tip, zorunlu: {}, tavan: {}, artik: [] }, ek || {}));

    // ── D) REFERANSLAR (karşılaştırma çapası — turnuvada mutlaka bulunmalı) ──
    ekle('REF-R0', R0.paylar, { aile: 'referans' });
    const b4 = { ...R0.paylar };
    b4.armor = R0.paylar.armor * 1.5; b4.logistics = R0.paylar.logistics * 1.5;
    ekle('REF-B4', b4, { aile: 'referans', not: 'FAZ 2 dogrulanmis kazanan' });
    adaylar.push({ ad: 'REF-H0-sezgisel', heuristik: true, aile: 'referans', paylar: {}, zorunlu: {}, tavan: {}, artik: [] });
    for (const t of taban) if (/^RU-/.test(t.ad)) ekle('REF-' + t.ad, t.paylar, { aile: 'referans', tipPaylari: t.tipPaylari });

    // ── A) KEŞİF: her kör noktayı ZORUNLU kıl ───────────────────────────────
    // `zorunlu` çekirdek olarak önce alınır; kalan bütçe paylara göre dağıtılır.
    for (const k of KOR_NOKTA) {
        for (const n of k.adet) {
            const p = { ...R0.paylar };
            // ilgili kategoriye pay aç (yoksa çözücü zorunluyu alır ama kategori 0 kalır)
            p[k.kat] = Math.max(p[k.kat] || 0, 0.08);
            ekle('KESIF-' + k.ad + '-' + n, p, {
                aile: 'kesif', zorunlu: { [k.id]: n },
                not: 'olculdu: bu birim 120 orduda ' + (k.id === 'ballistic_missile' || k.id === 'transport_helo' ||
                    k.id === 'loitering_munition' || k.id === 'command_vehicle' ? '%0' : 'nadir') + ' kullaniliyor'
            });
        }
    }
    // İKİLİ KEŞİF: kör noktaları çiftler hâlinde dene (etkileşim olabilir)
    for (let i = 0; i < KOR_NOKTA.length; i++) {
        for (let j = i + 1; j < KOR_NOKTA.length; j++) {
            if (adaylar.length >= SAYI) break;
            const a = KOR_NOKTA[i], b = KOR_NOKTA[j];
            const p = { ...R0.paylar };
            p[a.kat] = Math.max(p[a.kat] || 0, 0.08);
            p[b.kat] = Math.max(p[b.kat] || 0, 0.08);
            ekle('KESIF2-' + a.ad + '+' + b.ad, p, {
                aile: 'kesif2', zorunlu: { [a.id]: a.adet[0], [b.id]: b.adet[0] }
            });
        }
    }

    // ── B) SÜPÜRME: kategori paylarını geniş bantta tara ────────────────────
    for (const kat of KATEGORILER) {
        for (const c of [0.25, 0.5, 2.0, 3.0]) {
            if (adaylar.length >= SAYI) break;
            const p = { ...R0.paylar };
            const hedef = (R0.paylar[kat] || 0.03) * c;
            if (hedef > 0.65) continue;
            const kalanEski = Object.keys(p).reduce((s, k) => s + (k === kat ? 0 : p[k]), 0);
            if (kalanEski <= 0) continue;
            const olcek = (1 - hedef) / kalanEski;
            for (const k of Object.keys(p)) p[k] = (k === kat) ? hedef : p[k] * olcek;
            p[kat] = hedef;
            ekle('SUP-' + kat + '-x' + c, p, { aile: 'supurme' });
        }
    }

    // ── C) ÖRNEKLEM: pay uzayından deterministik çekilişler ─────────────────
    // Dirichlet-benzeri: her kategoriye üstel ağırlık, sonra normalize. R0'a yakın
    // kalması için R0 payı taban alınır (tamamen rastgele ordu = degenerate riski).
    while (adaylar.length < SAYI) {
        const p = {};
        for (const kat of KATEGORILER) {
            const taban0 = R0.paylar[kat] || 0.02;
            const carpan = Math.exp((rnd() - 0.5) * 2.2);   // ~0.33x .. 3x
            p[kat] = taban0 * carpan;
        }
        // ara sıra bir kör noktayı da zorunlu kıl (keşif çeşitliliği)
        const zor = {};
        if (rnd() < 0.35) {
            const k = KOR_NOKTA[Math.floor(rnd() * KOR_NOKTA.length)];
            zor[k.id] = k.adet[0];
            p[k.kat] = Math.max(p[k.kat] || 0, 0.08);
        }
        ekle('ORN-' + String(adaylar.length).padStart(3, '0'), p, { aile: 'orneklem', zorunlu: zor });
    }

    fs.mkdirSync(path.dirname(path.join(ROOT, CIKTI)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, CIKTI), JSON.stringify(adaylar, null, 1));

    const aileSay = {};
    for (const a of adaylar) aileSay[a.aile || '?'] = (aileSay[a.aile || '?'] || 0) + 1;
    console.log('ADAY ÜRETİMİ');
    console.log('  toplam : ' + adaylar.length + '  (tohum ' + TOHUM + ' → tekrarlanabilir)');
    console.log('  aileler: ' + Object.entries(aileSay).map(([k, v]) => k + ' ' + v).join(', '));
    console.log('  kör nokta kapsaması: ' + KOR_NOKTA.length + ' birim, her biri en az bir adayda ZORUNLU');
    console.log('-> ' + CIKTI);
    console.log('sıradaki: node tools/surum-turnuvasi.js --adaylar ' + CIKTI + ' --tohum-sayisi 500');
}

main();
