#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  PARALEL ÇAPRAZLAMA KOŞUCUSU (FAZ 0.5) — docs/OLCUM-KRIZI-TOHUM-SAYISI.md
//
//  NEDEN: marj std sapması 3114 ölçüldü → ±1000 hassasiyet ~37 tohum, ±500 ~150 tohum
//  ister. Tek süreçte 6×6 turnuva × 48 tohum ≈ 19 saat. Maçlar BİRBİRİNDEN BAĞIMSIZ
//  olduğu için iş süreçlere bölünebilir.
//
//  NEDEN GPU DEĞİL: testler zaten başsız koşuyor (SIM.headless=true, rAF iptal) — GPU
//  boşta, darboğaz saf CPU-JS. Simülasyon 50ms'lik tiklerle SIRALI (her tik bir öncekine
//  bağlı); GPU ise aynı anda binlerce bağımsız iş ister. Ayrıca A* yol bulma, uzamsal
//  ızgara, nesne grafiği ve srand durumu shader'a taşınamaz ve taşınsa byte-aynı replay
//  garantisi (tüm determinizm kapılarımızın dayanağı) kırılır. Paralellik doğru fikir,
//  yeri süreç düzeyi.
//
//  BÖLME STRATEJİSİ: TOHUMA göre bölünür (hücreye göre değil) → her süreç tüm hücreleri
//  kendi tohum diliminde koşar, birleştirmede hücre başına maçlar birleşir. Böylece her
//  hücre her süreçten eşit pay alır; bir süreç çökerse hücreler dengeli şekilde eksilir
//  (bir hücrenin tamamı kaybolmaz) ve bu RAPORLANIR.
//
//  Kullanım:
//    node tools/caprazla.js --tarifler qa-runtime/tarifler-taban.json \
//        --sal R0-attacker,H0-sezgisel --sav H0-sezgisel --seeds 48 --workers 8
//    --seeds <N>            : ilk N kanonik tohum (aşağıdaki liste) — ya da virgüllü liste
//    --disornek             : tohumları DIŞÖRNEKLEM havuzundan al (doğrulama koşusu)
// ═══════════════════════════════════════════════════════════════════════════
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// KANONİK TOHUM HAVUZLARI — sabit ve versiyonlanmış olmalı ki "hangi tohumlarda" sorusu
// her rapordan yanıtlanabilsin (plan: her iddia tohum kümesiyle birlikte raporlanır).
const TARAMA_TOHUM = [2024, 777, 909, 3141, 2718, 5150, 111, 222, 333, 444, 555, 666,
    1234, 4321, 8080, 6060, 7, 42, 99, 1001, 2222, 3333, 4444, 5555];
// ÜÇÜNCÜ HAVUZ (`--final`): eksen seçimi TARAMA+DIŞÖRNEKLEM havuzları kullanılarak yapıldığı
// için birleşim tarifleri o iki havuza karşı seçim-yanlılığı taşır. Nihai karar bu TAZE
// havuzda verilir — hiçbir seçim kararında kullanılmamıştır.
const FINAL_TOHUM = [
    9001, 9007, 9011, 9013, 9029, 9041, 9043, 9049, 9059, 9067, 9091, 9103,
    17389, 17393, 17401, 17417, 17419, 17431, 17443, 17449, 17467, 17471, 17477, 17483,
    250, 750, 1250, 1750, 2250, 2750, 3250, 3750, 4250, 4750, 5250, 5750,
    611, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673];
const DISORNEK_TOHUM = [90210, 31337, 65535, 10007, 20011, 30013, 40009, 50021,
    60013, 70003, 80021, 90001, 12007, 24001, 36007, 48017,
    13, 17, 23, 29, 31, 37, 41, 43,
    101, 103, 107, 109, 113, 127, 131, 137,
    500, 1500, 2500, 3500, 4500, 5500, 6500, 7500,
    811, 823, 827, 829, 839, 853, 857, 859];

function arg(bayrak, vars) {
    const i = process.argv.indexOf(bayrak);
    return i >= 0 ? process.argv[i + 1] : vars;
}

const TARIFLER = arg('--tarifler', 'qa-runtime/tarifler-taban.json');
const SAL = arg('--sal', '*');
const SAV = arg('--sav', '*');
const DISORNEK = process.argv.includes('--disornek');
const FINAL = process.argv.includes('--final');
const HAVUZ = FINAL ? FINAL_TOHUM : (DISORNEK ? DISORNEK_TOHUM : TARAMA_TOHUM);
const SEEDARG = String(arg('--seeds', '12'));
const TOHUMLAR = SEEDARG.indexOf(',') >= 0
    ? SEEDARG.split(',').map(Number).filter(Boolean)
    : HAVUZ.slice(0, Math.min(Number(SEEDARG) || 12, HAVUZ.length));
// ── BELLEK GÜVENLİĞİ (kullanıcı makinesi dondu: 12 işçi × ~1GB + sistem yükü = takas cehennemi) ──
// ÖLÇÜLDÜ: tek başsız Electron örneği ZİRVE ~1.04 GB (tüm alt süreçleri dahil). İşçi sayısı
// ARTIK ÇEKİRDEĞE GÖRE DEĞİL BOŞTAKİ BELLEĞE göre seçilir. Çekirdek yalnız üst sınır.
const CEKIRDEK = os.cpus().length;
// KALİBRASYON — üç kez düzeltildi, son değer DOĞRU SAYAÇLA ölçüldü:
//   1.2GB (seyrek WorkingSet örneklemesi, zirveyi kaçırdı)
//   6.2GB (Win32 FreePhysicalMemory düşüşü — YANLIŞ SAYAÇ: Windows'ta "free" bekleme-önbelleğini
//          saymaz, süreç açılışındaki disk okuması bu sayacı olduğundan çok düşürür)
//   2.0GB (Win32_PerfRawData_PerfOS_Memory.AvailableMBytes: 4 işçi 8.91GB→1.59GB = işçi başı 1.83GB)
// Electron'un kendi muhasebesi de uyumlu: Browser 119MB + GPU 704MB + Tab 192MB + Utility 49MB ≈ 1.06GB
// (aradaki fark sayfa tabloları ve paylaşılan kitaplıklar).
// MOTOR: 'tezgah' (jsdom, varsayılan) ya da 'electron' (eski yol, karşılaştırma için).
// jsdom tezgâhı DOĞRULANDI: aynı tohumlarda Electron ile BİREBİR aynı sonuç (12 tohum,
// 5/12 ve marj -1032 iki motorda da aynı), ama 12 maç 55sn / zirve 451MB —
// Electron'da TEK maç 1.8GB tutuyordu. Bellek 4 kat değil, işçi başına ~4 kat AZ.
const MOTOR = String(arg('--motor', 'tezgah'));
const TEZGAH = MOTOR !== 'electron';
// Ölçüldü: jsdom tezgâhı 12 maçlık bir süreçte ZİRVE 451MB (maç sayısıyla büyümüyor).
// 0.5GB pay ile 13 işçi ≈ 6.5GB → 16 çekirdekli / ~9GB boş makinede rahat sığar.
// İşçi belleği PARTİ BOYUNA bağlı (ölçüldü): 1 maç 227MB, 2 maç 237MB, 3 maç ~260MB,
// 12 maç 407MB. Varsayılan parti ≤3 olduğu için 0.3GB bütçe gerçekçidir.
const ISCI_GB = Number(arg('--isci-gb', TEZGAH ? 0.3 : 2.0));
// REZERV 4GB: taze-süreç kipinde bile kullanılabilir bellek koşu boyunca yavaşça iniyor
// (Windows dosya önbelleği + Electron ikilisinin tekrar tekrar yüklenmesi). 24 maçlık koşuda
// 3 işçi 15. maçta eşiğe dayandı → rezerv yükseltildi, tavan bu makinede 2-3 işçiye oturuyor.
// Rezerv motora göre: Electron'da koşu boyunca kullanılabilir bellek yavaşça iniyordu (4GB
// rezerv gerekti); jsdom tezgâhı sabit ~451MB tutuyor ve inişe yol açmıyor → 3GB yeter.
const REZERV_GB = Number(arg('--rezerv-gb', TEZGAH ? 2.5 : 4));
// KULLANILABİLİR BELLEK — os.freemem() Windows'ta YANLIŞ SİNYAL: bekleme-önbelleğini saymadığı
// için 4 işçide "0.04GB" diyordu, gerçek kullanılabilir ise ~1.6GB idi ve gözcüyü boş yere
// tetikliyordu. Windows'ta dile bağımsız performans sayacı okunur; başka platformda os.freemem().
function bosBellekGB() {
    if (process.platform !== 'win32') return os.freemem() / 1e9;
    try {
        const cikti = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
            '(Get-CimInstance Win32_PerfRawData_PerfOS_Memory).AvailableMBytes'],
            { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
        const mb = Number(String(cikti).trim());
        if (Number.isFinite(mb) && mb > 0) return mb / 1024;
    } catch (e) {}
    return os.freemem() / 1e9;   // sayaç okunamazsa geri düş (muhafazakâr yönde hata yapar)
}
const BOS_GB = bosBellekGB();
const TOPLAM_GB = os.totalmem() / 1e9;
const GUVENLI = Math.max(1, Math.floor((BOS_GB - REZERV_GB) / ISCI_GB));
// Çekirdek tavanı: kullanıcı 16 çekirdeğin 13'ünü tam kapasite kullanmak istiyor →
// 3 çekirdek sisteme/kullanıcıya bırakılır. Gerçek sınır yine bellek tarafı.
const TAVAN = Math.min(GUVENLI, Math.max(1, CEKIRDEK - 3), TOHUMLAR.length);
const ISTENEN = Number(arg('--workers', TAVAN)) || TAVAN;
const ZORLA = process.argv.includes('--zorla');
let ISCI = Math.min(ISTENEN, TOHUMLAR.length);
if (ISCI > TAVAN && !ZORLA) {
    console.log('! ' + ISTENEN + ' işçi istendi ama güvenli tavan ' + TAVAN +
        ' (boşta ' + BOS_GB.toFixed(1) + 'GB, rezerv ' + REZERV_GB + 'GB, işçi başı ' + ISCI_GB + 'GB).');
    console.log('  ' + TAVAN + ' ile koşuluyor. Bilerek aşmak için --zorla ekleyin (makine donabilir).');
    ISCI = TAVAN;
}
// İşçi bittiğinde boşta bellek bu eşiğin altındaysa kalanlar başlatılmaz/durdurulur.
// os.freemem() Windows'ta zaman zaman FreePhysical gibi davranıp gerçekte olmayan bir darlık
// gösteriyor → eşik düşürüldü ve gözcü ÜÇ ardışık ihlal istiyor (anlık sıçrama koşuyu kesmesin).
const KRITIK_GB = Number(arg('--kritik-gb', 0.7));
// NAZİK KİP (varsayılan AÇIK): işçiler DÜŞÜK ÖNCELİKLE koşar. Kullanıcı aynı makinede
// başka iş yaparken (ör. hikâye modu testi) onun işi hep önce gelsin. CPU boşken hız
// aynıdır — öncelik yalnız çekişme anında devreye girer. `--kaba` ile kapatılır.
const NAZIK = !process.argv.includes('--kaba');
const CIKTI = arg('--out', 'qa-runtime/caprazlama-sonuc.json');
const GECICI = path.join('qa-runtime', 'caprazla-parca');

if (SEEDARG.indexOf(',') < 0 && Number(SEEDARG) > HAVUZ.length) {
    console.log('! UYARI: ' + SEEDARG + ' tohum istendi, havuzda ' + HAVUZ.length + ' var -> ' + TOHUMLAR.length + ' ile kosulacak (sessiz kirpma yok).');
}

// ── İŞ KUYRUĞU: PARTİ başına TAZE SÜREÇ ────────────────────────────────────
// ÖLÇÜLDÜ: bir işçinin belleği koştuğu maç sayısıyla büyüyor (1 maç ~1.8GB, 4 maç ~3.3GB).
// Telemetri her oturumda sıfırlansa da süreç ömrü boyunca birikim oluyor. Bu yüzden iş,
// tohumları işçilere BÖLMEK yerine küçük PARTİLERE ayrılır ve her parti TAZE bir süreçte
// koşar → bellek toplam tohum sayısından BAĞIMSIZ kalır (eşzamanlılık × parti ile sınırlı).
// VARSAYILAN 1: ölçüldü ki her ek maç süreçte ~1.4GB bırakıyor (1 maç 1.8GB, 2 maç 3.2GB,
// 4 maç 3.3GB) — yani maç başına bellek geri verilmiyor. Parti=1 → her maç taze süreçte,
// bellek maç sayısından tamamen bağımsız. Süreç açılışı ~8sn ek maliyet, karşılığı güvenlik.
// jsdom tezgâhında bellek maç sayısıyla büyümüyor (12 maç tek süreçte 451MB) → parti büyük
// olabilir, süreç açılış maliyeti amorti edilir. Electron'da 1 kalır (maç başı ~1.4GB bırakıyordu).
// PARTİ BOYU = BELLEK AYARI. Ölçülen eğri (tek süreç, zirve RSS):
//   1 maç 227MB · 2 maç 237MB · 4 maç 278MB · 8 maç 294MB · 12 maç 407MB
// (Zorlamalı GC denendi, İŞE YARAMADI: 12 maçta 401 vs 407 — bellek geri alınabilir
//  çöp değil, V8'in tuttuğu yığın.) Küçük parti = düşük bellek = DAHA ÇOK İŞÇİ.
// Süreç açılışı ~1.75sn, maç başı ~3.65sn → parti 2-3 iyi denge.
// Varsayılan: işçileri dolduracak kadar ama EN ÇOK 3 (bellek patlamasın).
const PARTI_TAVAN = Math.max(1, Number(arg('--parti-tavan', 3)) || 3);
const PARTI = Math.max(1, Number(arg('--parti',
    TEZGAH ? Math.min(PARTI_TAVAN, Math.ceil(TOHUMLAR.length / Math.max(1, TAVAN))) : 1)) || 1);
// PARÇA BAŞINA HEDEF MAÇ: iş yalnız TOHUMA göre bölünürse aday listesi uzadığında
// parça sayısı sabit kalır (ör. 256 aday × 12 tohum, parti 3 → yalnız 4 parça, her biri
// 768 maç → hem paralellik ölür hem bellek patlar). Bu yüzden ADAY LİSTESİ DE bölünür.
const HEDEF_MAC = Math.max(1, Number(arg('--parca-mac', 6)) || 6);
// İŞ = (aday dilimi × tohum dilimi). Önce tohumlar PARTI'lik dilimlere ayrılır; sonra
// aday listesi, bir parçanın maç sayısı HEDEF_MAC'i aşmayacak şekilde bölünür.
// Böylece 256 aday × 12 tohum → 4 parça değil, ~128 parça olur: paralellik ve düşük bellek.
const SAL_ADLAR = SAL === '*' ? null : SAL.split(',').filter(Boolean);
const SAV_SAYI = (SAV === '*' ? 0 : SAV.split(',').filter(Boolean).length) || 1;
const tohumDilim = [];
for (let i = 0; i < TOHUMLAR.length; i += PARTI) tohumDilim.push(TOHUMLAR.slice(i, i + PARTI));
const dilimler = [];
if (!SAL_ADLAR || SAL_ADLAR.length <= 1) {
    for (const td of tohumDilim) dilimler.push({ tohum: td, sal: SAL });
} else {
    // bir parçada: adaySayisi × SAV_SAYI × tohumDilimBoyu ≤ HEDEF_MAC
    const adayBasi = Math.max(1, Math.floor(HEDEF_MAC / Math.max(1, SAV_SAYI * PARTI)));
    for (const td of tohumDilim) {
        for (let i = 0; i < SAL_ADLAR.length; i += adayBasi) {
            dilimler.push({ tohum: td, sal: SAL_ADLAR.slice(i, i + adayBasi).join(',') });
        }
    }
}

fs.mkdirSync(GECICI, { recursive: true });
for (const f of fs.readdirSync(GECICI)) fs.unlinkSync(path.join(GECICI, f));

console.log('PARALEL ÇAPRAZLAMA');
console.log('  tarifler : ' + TARIFLER);
console.log('  saldıran : ' + SAL);
console.log('  savunan  : ' + SAV);
console.log('  tohum    : ' + TOHUMLAR.length + ' adet' +
    (FINAL ? ' (FİNAL havuzu — hiçbir seçim kararında kullanılmadı)'
        : DISORNEK ? ' (DIŞÖRNEKLEM havuzu)' : ' (tarama havuzu)'));
console.log('  işçi     : ' + ISCI + ' süreç  (çekirdek ' + CEKIRDEK + ', RAM ' + TOPLAM_GB.toFixed(1) +
    'GB, boşta ' + BOS_GB.toFixed(1) + 'GB → güvenli tavan ' + TAVAN + ')');
console.log('  parti    : ' + PARTI + ' tohum/süreç, ' + dilimler.length + ' parti (her parti TAZE süreç → bellek sınırlı)');
console.log('  motor    : ' + (TEZGAH ? 'jsdom tezgâh (hafif)' : 'electron (eski)') +
    '  ·  tahmini bellek ~' + (ISCI * ISCI_GB).toFixed(1) + 'GB' +
    (TEZGAH ? '  (ölçüldü: 12 maç tek süreçte 451MB)' : '  (ölçüldü: 1 maç 1.8GB, +1.4GB/maç)'));
console.log('  tohumlar : ' + TOHUMLAR.join(','));
console.log('');

const t0 = Date.now();
let biten = 0;
const cocuklar = [];
// npx yerine electron ikilisini DOĞRUDAN çağır: npx çözümlemesi + shell süreç başına
// birkaç saniye ekliyordu ve 6 süreçte bu maliyet toplamın önemli kısmıydı.
let ELECTRON_BIN = null;
try { ELECTRON_BIN = require(path.join(process.cwd(), 'node_modules', 'electron')); } catch (e) {}
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
// Chromium'un test için gereksiz alt-süreçlerini kapat: başsız koşuda hiç çizim yok,
// GPU/rasterizer boşuna süreç açıp 16 çekirdeği aşırı-abone ediyordu.
const KROM_BAYRAK = ['--disable-gpu', '--disable-software-rasterizer', '--disable-dev-shm-usage',
    '--disable-extensions', '--disable-background-timer-throttling', '--in-process-gpu'];

function partiKosu(dilim, i) { return new Promise((cozum) => {
    if (!dilim || !dilim.tohum.length) return cozum({ i, ok: true, dosya: null, bos: true });
    const dosya = path.join(GECICI, 'parca-' + i + '.json');
    const ortak = ['--tarifler', TARIFLER, '--sal', dilim.sal, '--sav', SAV,
        '--seeds', dilim.tohum.join(','), '--out', dosya, '--sessiz'];
    // A/B'de telemetri ve replay kaydı okunmuyor → varsayılan KAPALI (ölçüldü %9).
    if (TEZGAH && !process.argv.includes('--telemetrili')) ortak.push('--telemetrisiz');
    // ERKEN DUR: kazanan belli olunca kes. GALİBİYET/MAĞLUBİYET AYNI kalır (winnerSide
    // zaten kayıtlı), yalnız marj değişir — ve tüm adaylar AYNI ölçüyle ölçüldüğü için
    // karşılaştırma tutarlı. Ölçüldü: %10 kazanç. `--tammac` ile kapatılır.
    if (TEZGAH && !process.argv.includes('--tammac')) ortak.push('--erkendur');
    // Tarama turlarında kısa maç (opsiyonel): --maxtik <tik>
    const _mtIx = process.argv.indexOf('--maxtik');
    if (TEZGAH && _mtIx >= 0) ortak.push('--maxtik', String(process.argv[_mtIx + 1]));
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;   // electron'u node kipinde başlatmayı engelle
    let c;
    if (TEZGAH) {
        c = spawn(process.execPath, [path.join(__dirname, 'muharebe-tezgah.js')].concat(ortak),
            { env, stdio: ['ignore', 'pipe', 'pipe'] });
        // NAZİK KİP: kullanıcı aynı makinede başka iş koşarken (ör. hikâye testi) işçiler
        // DÜŞÜK ÖNCELİKLE çalışsın — CPU boşsa hız aynı kalır, dolduğunda öncelik onun olur.
        if (NAZIK) { try { os.setPriority(c.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {} }
    } else {
        const isArgv = ['.', '--recipeab'].concat(ortak).concat(KROM_BAYRAK);
        c = ELECTRON_BIN
            ? spawn(ELECTRON_BIN, isArgv, { env, stdio: ['ignore', 'pipe', 'pipe'] })
            : spawn(npxCmd, ['electron'].concat(isArgv), { env, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    }
    let son = '';
    c.stdout.on('data', d => { son += d.toString(); });
    c.stderr.on('data', () => {});
    c.on('close', (kod) => {
        biten++;
        const sure = ((Date.now() - t0) / 1000).toFixed(0);
        const ok = kod === 0 && fs.existsSync(dosya);
        console.log('  [' + biten + '/' + dilimler.length + '] parça ' + i + ' bitti (' + dilim.tohum.length + ' tohum, ' + sure + 'sn)' +
            (ok ? '' : '  ✗ KOD ' + kod + ' — ' + son.split('\n').filter(Boolean).slice(-2).join(' | ')));
        const ix = cocuklar.indexOf(c); if (ix >= 0) cocuklar.splice(ix, 1);
        cozum({ i, ok, dosya, tohum: dilim.tohum });
    });
    cocuklar.push(c);
}); }

// Sınırlı eşzamanlılıkla kuyruğu tüket: aynı anda en çok ISCI süreç yaşar.
async function kuyruguKostur() {
    const sonuc = [];
    let sira = 0;
    const kanal = async () => {
        while (sira < dilimler.length && !bellekKesildi) {
            const i = sira++;
            sonuc[i] = await partiKosu(dilimler[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(ISCI, dilimler.length) }, kanal));
    return sonuc.filter(Boolean);
}

process.on('SIGINT', () => { for (const c of cocuklar) { try { c.kill(); } catch (e) {} } process.exit(130); });

// CANLI BELLEK GÖZCÜSÜ: kullanıcının makinesi bir kez dondu — bir daha donmasın diye koşu
// kendini keser. Boşta bellek kritik eşiğin altına inerse işçiler durdurulur ve o ana kadar
// TAMAMLANAN parçalar yine birleştirilir (düşen tohumlar raporda AÇIKÇA yazılır).
let bellekKesildi = false;
let ihlal = 0;   // üst üste iki örnek: anlık sıçrama yüzünden neredeyse biten koşuyu kesme
const gozcu = setInterval(() => {
    const bos = bosBellekGB();   // güvenilir sayaç (os.freemem() değil — yanlış darlık gösteriyordu)
    if (bos >= KRITIK_GB) { ihlal = 0; return; }
    if (++ihlal >= 3 && !bellekKesildi) {
        bellekKesildi = true;
        console.log('');
        console.log('!! BELLEK KRİTİK: boşta ' + bos.toFixed(2) + 'GB < ' + KRITIK_GB + 'GB — işçiler durduruluyor.');
        console.log('   (--isci-gb / --rezerv-gb ile ayarlayın, ya da daha az --workers ile koşun)');
        for (const c of cocuklar) { try { c.kill(); } catch (e) {} }
    }
}, 2000);

kuyruguKostur().then((sonuclar) => {
    clearInterval(gozcu);
    const sure = (Date.now() - t0) / 1000;
    const basarisiz = sonuclar.filter(r => !r.ok && !r.bos);
    // BİRLEŞTİR: hücre anahtarı sal|sav; maçlar birleşir, özetler yeniden hesaplanır
    const hucre = new Map();
    for (const r of sonuclar) {
        if (!r.ok || !r.dosya) continue;
        let parca;
        try { parca = JSON.parse(fs.readFileSync(r.dosya, 'utf8')); } catch (e) { continue; }
        for (const h of parca) {
            const k = h.sal + '|' + h.sav;
            if (!hucre.has(k)) hucre.set(k, { sal: h.sal, sav: h.sav, ordu: h.ordu, siperKab: h.siperKab, maclar: [] });
            hucre.get(k).maclar.push(...h.maclar);
        }
    }
    const hucreler = [...hucre.values()].map(h => {
        h.maclar.sort((a, b) => a.seed - b.seed);
        const m = h.maclar;
        const gal = m.filter(x => x.kazanan === 'sal').length;
        const marjlar = m.map(x => x.marj);
        const ort = marjlar.length ? marjlar.reduce((a, b) => a + b, 0) / marjlar.length : 0;
        const sd = marjlar.length > 1
            ? Math.sqrt(marjlar.reduce((s, x) => s + (x - ort) * (x - ort), 0) / (marjlar.length - 1)) : 0;
        const hata = marjlar.length ? 1.96 * sd / Math.sqrt(marjlar.length) : 0;   // %95 güven yarı-aralığı
        const erk = m.filter(x => x.erken);
        return Object.assign(h, {
            mac: m.length, salGalibiyet: gal,
            marj: Math.round(ort), marjSD: Math.round(sd), marjHata: Math.round(hata),
            // ANLAMLI mı: güven aralığı sıfırı içermiyorsa evet (gürültüden ayırt edilebilir)
            anlamli: Math.abs(ort) > hata,
            erkenMarj: erk.length ? Math.round(erk.reduce((s, x) => s + (x.erken.sal - x.erken.sav), 0) / erk.length) : null
        });
    });
    hucreler.sort((a, b) => a.sal.localeCompare(b.sal) || a.sav.localeCompare(b.sav));

    const toplamMac = hucreler.reduce((s, h) => s + h.mac, 0);
    console.log('');
    console.log('=== SONUÇ (' + toplamMac + ' maç, ' + sure.toFixed(0) + 'sn, ' + (toplamMac / sure).toFixed(2) + ' maç/sn) ===');
    console.log('hücre'.padEnd(46) + 'galibiyet'.padStart(11) + 'marj±%95'.padStart(18) + '  anlamlı  erken');
    for (const h of hucreler) {
        console.log((h.sal + ' vs ' + h.sav).slice(0, 45).padEnd(46) +
            (h.salGalibiyet + '/' + h.mac).padStart(11) +
            ((h.marj >= 0 ? '+' : '') + h.marj + ' ±' + h.marjHata).padStart(18) +
            (h.anlamli ? '   EVET  ' : '   hayır ') +
            (h.erkenMarj == null ? '-' : (h.erkenMarj >= 0 ? '+' : '') + h.erkenMarj).padStart(7));
    }
    if (bellekKesildi) {
        console.log('');
        console.log('!! KOŞU BELLEK NEDENİYLE KESİLDİ — aşağıdaki sonuçlar EKSİK örneklemdir, karar için kullanmayın.');
    }
    if (basarisiz.length) {
        console.log('');
        console.log('✗ ' + basarisiz.length + ' işçi başarısız — DÜŞEN TOHUMLAR: ' +
            basarisiz.flatMap(r => r.tohum).join(',') + '  (sonuçlar bu tohumları İÇERMİYOR)');
    }
    const rapor = {
        tarifler: TARIFLER, sal: SAL, sav: SAV,
        tohumHavuzu: FINAL ? 'final' : DISORNEK ? 'disornek' : 'tarama',
        tohumlar: TOHUMLAR, istenenTohum: TOHUMLAR.length,
        dusenTohumlar: basarisiz.flatMap(r => r.tohum),
        isci: ISCI, bellekKesildi, sureSn: +sure.toFixed(1), toplamMac, hucreler
    };
    fs.mkdirSync(path.dirname(CIKTI), { recursive: true });
    fs.writeFileSync(CIKTI, JSON.stringify(rapor, null, 1));
    console.log('');
    console.log('-> ' + CIKTI);
    process.exit(basarisiz.length ? 1 : 0);
});
