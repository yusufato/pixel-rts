#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  SÜRÜM TURNUVASI (RAY-2) — ardışık yarılama + GÜVEN ARALIĞIYLA eleme
//
//  KULLANICI TASARIMI korunur (kademeli eleme, futbol elemesi gibi), İSTATİSTİĞİ
//  düzeltilir. Ölçüldü (tools/turnuva-gurultu.js, 100 aday / ilk 30 / 400 tekrar):
//    adaylar BIREBIR OZDES + 20 maç → seçilenler turnuvada %62.8 kazanıyor gösteriyor,
//    gerçek güçleri %50. Yani "ilk N'i al" kuralı GÜRÜLTÜDEN SAHTE YETENEK ÜRETİYOR.
//
//  BU YÜZDEN ELEME KURALI FARKLI:
//    Bir aday ancak GÜVEN ARALIĞI liderin aralığının ALTINDA kalıyorsa elenir.
//    Belirsizse elenmez — bir sonraki turda DAHA ÇOK MAÇ alır. Böylece bütçe,
//    ayırt edilebilen yere harcanır (ardışık yarılama mantığı).
//
//  YÜRÜTME: caprazla.js yeniden kullanılır (paralel, bellek-korumalı, jsdom tezgâhı).
//  Bu araç yalnız TUR YÖNETİMİ + ELEME yapar.
//
//  Kullanım:
//    node tools/surum-turnuvasi.js --adaylar qa-runtime/adaylar.json --turlar 12,24,48,96
//    node tools/surum-turnuvasi.js --adaylar ... --hizli      (duman: 4,8 tohum)
// ═══════════════════════════════════════════════════════════════════════════
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function arg(ad, vars) { const i = process.argv.indexOf(ad); return i >= 0 ? process.argv[i + 1] : vars; }

const ADAY_YOL = arg('--adaylar', 'qa-runtime/adaylar.json');
const HIZLI = process.argv.includes('--hizli');
const TURLAR = String(arg('--turlar', HIZLI ? '4,8' : '12,24,48,96')).split(',').map(Number).filter(Boolean);
// ── RAKIP PANELI (TEK RAKIP OLCUMU GECERSIZ) ──
// OLCULDU (4 aday x 3 rakip x 24 tohum): SIRALAMA RAKIBE GORE TAMAMEN DEGISIYOR.
//   REF-R0        rakip A -671 (SONUNCU)  |  rakip B +1876 (BIRINCI)   -> 2547 savrulma
//   SUP-armor-x2  rakip A +1813 (BIRINCI) |  rakip B  +211 (UCUNCU)
//   KESIF-jammer-1 rakip A  +46 (UCUNCU)  |  rakip B  +981 (BIRINCI)
// Bu bir tas-kagit-makas uzayi; tek olcu cubugu "sampiyon" degil "O RAKIBE karsi sampiyon" verir.
// Artik --rakip virgullu liste alir ve aday skoru PANELIN TAMAMI uzerinden hesaplanir.
const RAKIPLER = String(arg('--rakip', 'REF-H0-sezgisel')).split(',').map(x => x.trim()).filter(Boolean);
const RAKIP = RAKIPLER[0];
// Panel birlestirme: 'ort' = panel ortalamasi (genel guc), 'enkotu' = en kotu rakibe karsi
// (saglamlik; tek bir rakibe karsi cokmeyi cezalandirir).
const BIRLESTIR = arg('--birlestir', 'ort');
const CIKTI = arg('--out', 'qa-runtime/turnuva-sonuc.json');
const ISCI = arg('--workers', '');
// Tur başına hayatta kalacak ÜST SINIR (bütçe kontrolü). Güven kuralı bundan önce gelir;
// bu sınır devreye girerse AÇIKÇA raporlanır (sessiz kırpma yok).
const TAVANLAR = String(arg('--tavan', '48,16,6,1')).split(',').map(Number);

function tarifleriYaz(adaylar, yol) {
    fs.mkdirSync(path.dirname(yol), { recursive: true });
    fs.writeFileSync(yol, JSON.stringify(adaylar, null, 1));
}

// KISA MAC yalniz TUR 1'de: olculdu (1281 mac) t=120sn marji ile nihai marj r=0.885, isaret uyumu
// %82 ve |erken| buyudukce guvenilirlik artiyor (1500-3000 -> %95, 3000+ -> %100). Yani ELEME icin
// gecerli, SIRALAMA icin degil. Tur 1 zaten eleme; sonraki turlar tam mac kosar.
const KISA_TUR1 = Number(arg('--kisa-tur1', 2400)) || 0;
// RAKIP PANELI yalniz TUR 2'den itibaren: panel maliyeti rakip sayisiyla CARPAR (1399 aday x 24
// tohum x 3 rakip = 100k mac). Tur 1 tek olcu cubuguyla ELER, sonraki turlar panelle DOGRULAR.
function turKos(adaylar, rakipTarifler, tohumSayisi, sonTur, turNo) {
    const turRakipler = (turNo === 1 && rakipTarifler.length > 1) ? [rakipTarifler[0]] : rakipTarifler;
    const dosya = path.join(ROOT, 'qa-runtime', 'turnuva-tur-' + turNo + '.json');
    const tarifDosya = path.join(ROOT, 'qa-runtime', 'turnuva-tarifler-' + turNo + '.json');
    tarifleriYaz(adaylar.concat(turRakipler), tarifDosya);
    const argv = ['tools/caprazla.js', '--tarifler', tarifDosya,
        '--sal', adaylar.map(a => a.ad).join(','), '--sav', turRakipler.map(r => r.ad).join(','),
        '--seeds', String(tohumSayisi), '--out', dosya];
    if (sonTur) argv.push('--final');               // NİHAİ TUR: dışörneklem havuzu
    else if (turNo >= 2) argv.push('--disornek');   // ara turlar tarama dışı havuzda
    if (ISCI) argv.push('--workers', ISCI);
    if (turNo === 1 && KISA_TUR1 > 0) argv.push('--maxtik', String(KISA_TUR1));   // yalniz eleme turu
    const r = spawnSync(process.execPath, argv, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!fs.existsSync(dosya)) {
        console.log('  ✗ tur çıktısı yok. caprazla son satırlar:');
        console.log('    ' + String(r.stdout || '').split('\n').filter(Boolean).slice(-4).join('\n    '));
        console.log('    ' + String(r.stderr || '').split('\n').filter(Boolean).slice(-3).join('\n    '));
        return null;
    }
    return JSON.parse(fs.readFileSync(dosya, 'utf8'));
}

function main() {
    const havuz = JSON.parse(fs.readFileSync(path.join(ROOT, ADAY_YOL), 'utf8'));
    const rakipler = RAKIPLER.map(ad => havuz.find(a => a.ad === ad)).filter(Boolean);
    if (rakipler.length !== RAKIPLER.length) {
        console.log('rakip bulunamadı: ' + RAKIPLER.filter(ad => !havuz.find(a => a.ad === ad)).join(', '));
        process.exit(1);
    }
    const rakipAdSet = new Set(RAKIPLER);
    let yasayan = havuz.filter(a => !rakipAdSet.has(a.ad));

    console.log('SÜRÜM TURNUVASI');
    console.log('  aday   : ' + yasayan.length + '   RAKİP PANELİ (' + rakipler.length + '): ' + RAKIPLER.join(', '));
    console.log('  birleştirme: ' + (BIRLESTIR === 'enkotu' ? 'EN KÖTÜ rakip (sağlamlık)' : 'panel ORTALAMASI'));
    if (rakipler.length === 1) console.log('  ! UYARI: tek rakip. Ölçüldü ki sıralama rakibe göre TAMAMEN değişiyor — panel önerilir.');
    console.log('  turlar : ' + TURLAR.map((t, i) => 'T' + (i + 1) + '=' + t + ' tohum').join(', '));
    console.log('  ELEME  : güven aralığı kuralı — "açıkça kötüleri at", "ilk N'.replace("'", "'") + "'i al\" DEĞİL");
    console.log('');

    const gecmis = [];
    for (let i = 0; i < TURLAR.length && yasayan.length > 1; i++) {
        const tohum = TURLAR[i];
        const sonTur = (i === TURLAR.length - 1);
        console.log('── TUR ' + (i + 1) + ': ' + yasayan.length + ' aday × ' + tohum + ' tohum' +
            (sonTur ? '  (FİNAL havuzu — dışörneklem)' : '') + ' ──');
        const t0 = Date.now();
        const _turRakipSayi = (i === 0 && rakipler.length > 1) ? 1 : rakipler.length;
        console.log('  (rakip ' + _turRakipSayi + (i === 0 && KISA_TUR1 ? ', KISA MAC ' + KISA_TUR1 + ' tik' : '') + ')');
        const sonuc = turKos(yasayan, rakipler, tohum, sonTur, i + 1);
        if (!sonuc) { console.log('TUR BAŞARISIZ — duruldu.'); break; }
        const sure = Math.round((Date.now() - t0) / 1000);

        // PANEL BIRLESTIRME: bir adayin birden cok rakibe karsi hucresi olur -> tek skora indir.
        // 'ort' panel ortalamasi (hata birlesik), 'enkotu' en dusuk marj (saglamlik olcusu).
        const _grup = new Map();
        for (const h of sonuc.hucreler) { if (!_grup.has(h.sal)) _grup.set(h.sal, []); _grup.get(h.sal).push(h); }
        const hucre = new Map([..._grup.entries()].map(([ad, hs]) => {
            if (hs.length === 1) return [ad, hs[0]];
            const macTop = hs.reduce((s, h) => s + h.mac, 0);
            const galTop = hs.reduce((s, h) => s + h.salGalibiyet, 0);
            if (BIRLESTIR === 'enkotu') {
                const k = hs.reduce((a, b) => (a.marj <= b.marj ? a : b));
                return [ad, { sal: ad, marj: k.marj, marjHata: k.marjHata, salGalibiyet: galTop, mac: macTop, panel: hs.length }];
            }
            const marj = Math.round(hs.reduce((s, h) => s + h.marj * h.mac, 0) / Math.max(1, macTop));
            // Birlesik hata: bagimsiz hucrelerin karelerinin agirlikli ortalamasinin koku
            const hata = Math.round(Math.sqrt(hs.reduce((s, h) => s + Math.pow(h.marjHata * h.mac, 2), 0)) / Math.max(1, macTop));
            return [ad, { sal: ad, marj, marjHata: hata, salGalibiyet: galTop, mac: macTop, panel: hs.length }];
        }));
        // SONUÇSUZ ADAY = ÖLÇÜM HATASI, "kötü aday" DEĞİL. Eskiden -Infinity verilip
        // sessizce eleniyordu; bir turda tüm hücreler boş gelince araç "şampiyon" bile
        // ilan etti. Artık ölçülemeyen adaylar AYRI raporlanır ve tur GEÇERSİZ sayılır.
        const olculemeyen = yasayan.filter(a => !hucre.get(a.ad));
        if (olculemeyen.length) {
            console.log('  ✗ ÖLÇÜLEMEYEN ' + olculemeyen.length + '/' + yasayan.length + ' aday: ' +
                olculemeyen.slice(0, 6).map(a => a.ad).join(', ') + (olculemeyen.length > 6 ? ' …' : ''));
            console.log('    (düşen tohum: ' + (sonuc.dusenTohumlar || []).length +
                (sonuc.bellekKesildi ? ', BELLEK KESİNTİSİ' : '') + ')');
        }
        if (olculemeyen.length === yasayan.length) {
            console.log('  !! TUR TAMAMEN BAŞARISIZ — hiçbir aday ölçülemedi. Turnuva DURDURULUYOR.');
            console.log('     (bellek darlığı olabilir: --workers düşürün ya da koşuyu sonra tekrarlayın)');
            break;
        }
        const skor = yasayan.filter(a => hucre.get(a.ad)).map(a => {
            const h = hucre.get(a.ad);
            return { a, marj: h.marj, hata: h.marjHata, gal: h.salGalibiyet, mac: h.mac };
        }).sort((x, y) => y.marj - x.marj);

        const lider = skor[0];
        // GÜVEN KURALI: adayın ÜST sınırı liderin ALT sınırının altındaysa açıkça kötüdür.
        const liderAlt = lider.marj - lider.hata;
        const guvenleElenen = skor.filter(s => (s.marj + s.hata) < liderAlt);
        let kalan = skor.filter(s => !guvenleElenen.includes(s));
        const tavan = TAVANLAR[Math.min(i, TAVANLAR.length - 1)] || kalan.length;
        let tavanlaElenen = 0;
        if (kalan.length > tavan) { tavanlaElenen = kalan.length - tavan; kalan = kalan.slice(0, tavan); }

        console.log('  süre ' + sure + 'sn   lider: ' + lider.a.ad + '  marj ' + (lider.marj >= 0 ? '+' : '') +
            lider.marj + ' ±' + lider.hata + '  (' + lider.gal + '/' + lider.mac + ')');
        console.log('  elenen: ' + guvenleElenen.length + ' GÜVEN kuralıyla' +
            (tavanlaElenen ? ', ' + tavanlaElenen + ' BÜTÇE TAVANIYLA (ayırt edilemiyorlardı — bilgi kaybı)' : '') +
            '   → kalan ' + kalan.length);
        console.log('  ilk 5: ' + skor.slice(0, 5).map(s => s.a.ad + '(' + (s.marj >= 0 ? '+' : '') + s.marj + '±' + s.hata + ')').join('  '));
        gecmis.push({
            tur: i + 1, tohum, aday: yasayan.length, sureSn: sure, sonTur,
            lider: { ad: lider.a.ad, marj: lider.marj, hata: lider.hata, gal: lider.gal, mac: lider.mac },
            guvenleElenen: guvenleElenen.length, tavanlaElenen, olculemeyen: olculemeyen.map(a=>a.ad),
            siralama: skor.map(s => ({ ad: s.a.ad, aile: s.a.aile, marj: s.marj, hata: s.hata, gal: s.gal, mac: s.mac }))
        });
        yasayan = kalan.map(s => s.a);
        console.log('');
    }

    console.log('=== SONUÇ ===');
    const son = gecmis[gecmis.length - 1];
    if (son) {
        console.log('  ŞAMPİYON: ' + son.lider.ad + '  marj ' + (son.lider.marj >= 0 ? '+' : '') + son.lider.marj +
            ' ±' + son.lider.hata + '  (' + son.lider.gal + '/' + son.lider.mac + ')' +
            (son.sonTur ? '   [FİNAL havuzunda — dışörneklem]' : '   [UYARI: final havuzunda doğrulanmadı]'));
        const anlamli = Math.abs(son.lider.marj) > son.lider.hata;
        console.log('  sıfırdan ayırt edilebilir mi: ' + (anlamli ? 'EVET' : 'HAYIR — gürültüden ayrılamıyor'));
    }
    fs.writeFileSync(path.join(ROOT, CIKTI), JSON.stringify({ rakip: RAKIPLER, birlestir: BIRLESTIR, turlar: TURLAR, gecmis }, null, 1));
    console.log('-> ' + CIKTI);
}

main();
