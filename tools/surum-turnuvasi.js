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
const RAKIP = arg('--rakip', 'REF-H0-sezgisel');
const CIKTI = arg('--out', 'qa-runtime/turnuva-sonuc.json');
const ISCI = arg('--workers', '');
// Tur başına hayatta kalacak ÜST SINIR (bütçe kontrolü). Güven kuralı bundan önce gelir;
// bu sınır devreye girerse AÇIKÇA raporlanır (sessiz kırpma yok).
const TAVANLAR = String(arg('--tavan', '48,16,6,1')).split(',').map(Number);

function tarifleriYaz(adaylar, yol) {
    fs.mkdirSync(path.dirname(yol), { recursive: true });
    fs.writeFileSync(yol, JSON.stringify(adaylar, null, 1));
}

function turKos(adaylar, rakipTarif, tohumSayisi, sonTur, turNo) {
    const dosya = path.join(ROOT, 'qa-runtime', 'turnuva-tur-' + turNo + '.json');
    const tarifDosya = path.join(ROOT, 'qa-runtime', 'turnuva-tarifler-' + turNo + '.json');
    tarifleriYaz(adaylar.concat([rakipTarif]), tarifDosya);
    const argv = ['tools/caprazla.js', '--tarifler', tarifDosya,
        '--sal', adaylar.map(a => a.ad).join(','), '--sav', rakipTarif.ad,
        '--seeds', String(tohumSayisi), '--out', dosya];
    if (sonTur) argv.push('--final');               // NİHAİ TUR: dışörneklem havuzu
    else if (turNo >= 2) argv.push('--disornek');   // ara turlar tarama dışı havuzda
    if (ISCI) argv.push('--workers', ISCI);
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
    const rakip = havuz.find(a => a.ad === RAKIP);
    if (!rakip) { console.log('rakip bulunamadı: ' + RAKIP); process.exit(1); }
    let yasayan = havuz.filter(a => a.ad !== RAKIP);

    console.log('SÜRÜM TURNUVASI');
    console.log('  aday   : ' + yasayan.length + '   rakip (sabit ölçü çubuğu): ' + RAKIP);
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
        const sonuc = turKos(yasayan, rakip, tohum, sonTur, i + 1);
        if (!sonuc) { console.log('TUR BAŞARISIZ — duruldu.'); break; }
        const sure = Math.round((Date.now() - t0) / 1000);

        const hucre = new Map(sonuc.hucreler.map(h => [h.sal, h]));
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
    fs.writeFileSync(path.join(ROOT, CIKTI), JSON.stringify({ rakip: RAKIP, turlar: TURLAR, gecmis }, null, 1));
    console.log('-> ' + CIKTI);
}

main();
