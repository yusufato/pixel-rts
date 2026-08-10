// ═══════════════════════════════════════════════════════════════════════════
//  ONLINE LOCKSTEP KAPISI — iki istemci TEK süreçte, aralarinda sahte ag
//
//  NEDEN: online mod iki ayri bilgisayar gerektirdigi icin hic otomatik sinanmiyordu.
//  Lockstep'in tek kurali var: iki taraf AYNI tick'te AYNI komutlari AYNI sirada uygulamali.
//  Bir komut yolu aga baglanmayi UNUTURSA (yerel kuyruga giderse) maç sessizce ayrisir ve
//  oyuncu bunu ancak "senkron koptu" uyarisiyla, dakikalar sonra gorur.
//
//  BULUNAN KUSUR (2026-08-10): sol-panel yetenegi / M (mayin) / U (indir) komutlari
//  pendingPlayerCommands'e (YEREL kuyruk) gidiyordu; move/attack aga gidiyordu. Yani bu
//  oturumda eklenen her yetenek online modu kiriyordu.
//
//  NEGATIF KONTROL SART: kapi once ESKI davranisi taklit edip AYRISMAYI GORDUGUNU kanitlar.
//  Gormezse kapi bozuktur ve yesil isigi hicbir sey ifade etmez.
//
//  Kullanim: node tools/online-lockstep-kapi.js [--tick 400]
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { tezgahKur } = require('./muharebe-tezgah.js');

const ROOT = path.resolve(__dirname, '..');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const TICK_HEDEF = Math.max(60, Number(arg('--tick', 400)) || 400);
const TOHUM = (Number(arg('--tohum', 987654)) >>> 0) || 987654;

// ── istemci: muharebe tezgahi + Net.js/MP.js (tezgahin kendi listesinde yoklar) ──
function istemciKur(rol) {
    const t = tezgahKur();
    if (t.hatalar && t.hatalar.length) throw new Error('tezgah yuklenemedi: ' + t.hatalar.join(' | '));
    for (const rel of ['js/Net.js', 'js/MP.js']) {
        vm.runInContext(fs.readFileSync(path.resolve(ROOT, rel), 'utf8'), t.ctx, { filename: rel });
    }
    // Sahte tasima: netSend disari yazsin, gercek WebSocket hic acilmasin.
    vm.runInContext(`
        var __OUT = [];
        netSend = function (o) { __OUT.push(JSON.parse(JSON.stringify(o))); };
        netStatus = function () {};
        Net.connected = true; Net.role = ${JSON.stringify(rol)}; Net.seed = ${TOHUM};
    `, t.ctx);
    return t;
}

const calis = (t, kod) => vm.runInContext(kod, t.ctx);
const bosalt = (t) => { const o = calis(t, '__OUT.splice(0, __OUT.length)'); return JSON.parse(JSON.stringify(o)); };
const teslim = (t, m) => calis(t, 'netOnMessage(' + JSON.stringify(m) + ')');

// ── dizim: her taraf kendi ordusunu kurar (istihkam DAHIL — mayin yetenegi sinanacak) ──
function dizil(t, isRed) {
    const y = isRed ? 0.16 : 0.84;
    calis(t, `
        mpEnterDeploy();
        (function () {
            const yy = WORLD_H * ${y};
            const tipler = [T.INFANTRY, T.INFANTRY, T.INFANTRY, T.ENGINEER, T.ANTI_TANK];
            for (let i = 0; i < tipler.length; i++) {
                SIM.units.push(new Unit(tipler[i], WORLD_W * 0.5 + (i - 2) * 60, yy, ${isRed}));
            }
        })();
        mpReadyDeploy();
    `);
}

// ── yetenek emri: DUZELTILMIS yol (aga gider) vs ESKI yol (yerel kuyruk) ──
function mayinEmri(t, eskiYol) {
    return calis(t, `
        (function () {
            const eng = SIM.units.filter(u => !u.dead && u.isRed === myCanonicalSide && u.type === T.ENGINEER);
            if (!eng.length) return 0;
            const yuk = { engineerIds: eng.map(u => u.id) };
            ${eskiYol
            ? 'pendingPlayerCommands.push({ type: "player-mine", payload: yuk });'
            : 'queuePlayerCommand("player-mine", yuk);'}
            return eng.length;
        })()
    `);
}

function hash(t) { return calis(t, 'lsStateHash()'); }
function desync(t) { return calis(t, 'MP.desync'); }
function tick(t) { return calis(t, 'MP.tick'); }
function mayinSayisi(t) { return calis(t, '(SIM.mines || []).length'); }

// ── tek koşu: iki istemci, N tick, istenirse ESKI yol ile ──
function kos(eskiYol) {
    const host = istemciKur('host');
    const guest = istemciKur('guest');
    const taraf = [{ ad: 'host', t: host, isRed: false }, { ad: 'guest', t: guest, isRed: true }];

    for (const s of taraf) dizil(s.t, s.isRed);
    // dizim mesajlarini karsiliklik ile tasi (host iki ordu da gelince 'start' yayar)
    for (let tur = 0; tur < 4; tur++) {
        for (const s of taraf) {
            const digeri = s.ad === 'host' ? guest : host;
            for (const m of bosalt(s.t)) teslim(digeri, m);
        }
    }
    if (!calis(host, 'MP.active && phase === PHASE.BATTLE') || !calis(guest, 'MP.active && phase === PHASE.BATTLE')) {
        return { hata: 'mac baslamadi (host/guest BATTLE fazinda degil)' };
    }

    let zaman = 0, mayinVerildi = false, ayrismaTick = null;
    const ADIM = 50;   // her yapay kare bir tick'lik zaman ilerletir
    while (Math.min(tick(host), tick(guest)) < TICK_HEDEF) {
        zaman += ADIM;
        // 30. tick'te İKİ taraf da mayin emri versin (yetenek yolu sinaniyor)
        if (!mayinVerildi && Math.min(tick(host), tick(guest)) >= 30) {
            mayinVerildi = true;
            for (const s of taraf) mayinEmri(s.t, eskiYol);
        }
        for (const s of taraf) calis(s.t, 'mpStep(' + zaman + ')');
        for (const s of taraf) {
            const digeri = s.ad === 'host' ? guest : host;
            for (const m of bosalt(s.t)) teslim(digeri, m);
        }
        if (ayrismaTick == null && tick(host) === tick(guest) && hash(host) !== hash(guest)) {
            ayrismaTick = tick(host);
        }
        if (desync(host) || desync(guest)) break;
        if (zaman > ADIM * (TICK_HEDEF * 4 + 200)) return { hata: 'ilerlemedi (stall)' };
    }
    return {
        hostTick: tick(host), guestTick: tick(guest),
        hostHash: hash(host), guestHash: hash(guest),
        hostMayin: mayinSayisi(host), guestMayin: mayinSayisi(guest),
        desync: desync(host) || desync(guest),
        ayrismaTick
    };
}

// ═══ 1) NEGATIF KONTROL: eski yol AYRISMA URETMELI (yoksa kapi kordur) ═══
console.log('ONLINE LOCKSTEP KAPISI — tohum ' + TOHUM + ', hedef ' + TICK_HEDEF + ' tick');
console.log('');
console.log('  [1/2] NEGATIF KONTROL (eski yol: yetenek YEREL kuyruga)');
const eski = kos(true);
if (eski.hata) { console.log('    HATA: ' + eski.hata); process.exit(2); }
console.log('    tick host/guest = ' + eski.hostTick + '/' + eski.guestTick
    + '   mayin host/guest = ' + eski.hostMayin + '/' + eski.guestMayin);
console.log('    hash esit mi = ' + (eski.hostHash === eski.guestHash)
    + '   ayrisma tick = ' + eski.ayrismaTick + '   desync bayragi = ' + eski.desync);
const kapiGoruyor = (eski.hostHash !== eski.guestHash) || eski.desync;
console.log('    → kapi ayrismayi ' + (kapiGoruyor ? 'GORUYOR' : 'GOREMIYOR (KAPI BOZUK)'));

// ═══ 2) ASIL KAPI: duzeltilmis yol AYRISMAMALI ═══
console.log('');
console.log('  [2/2] DUZELTILMIS YOL (yetenek aga gidiyor)');
const yeni = kos(false);
if (yeni.hata) { console.log('    HATA: ' + yeni.hata); process.exit(2); }
console.log('    tick host/guest = ' + yeni.hostTick + '/' + yeni.guestTick
    + '   mayin host/guest = ' + yeni.hostMayin + '/' + yeni.guestMayin);
console.log('    hash esit mi = ' + (yeni.hostHash === yeni.guestHash)
    + '   ayrisma tick = ' + yeni.ayrismaTick + '   desync bayragi = ' + yeni.desync);

console.log('');
const mayinIsledi = yeni.hostMayin > 0 && yeni.hostMayin === yeni.guestMayin;
const gecti = kapiGoruyor && !yeni.desync && yeni.hostHash === yeni.guestHash
    && yeni.ayrismaTick == null && mayinIsledi;
if (!kapiGoruyor) console.log('  ⛔ KAPI KOR: eski yol bile ayrisma uretmedi — sonuca guvenme.');
if (!mayinIsledi) console.log('  ⛔ Yetenek iki tarafta AYNI etkiyi uretmedi (mayin '
    + yeni.hostMayin + ' vs ' + yeni.guestMayin + ').');
console.log(gecti ? 'ONLINE_LOCKSTEP_OK' : 'ONLINE_LOCKSTEP_FAIL');
process.exit(gecti ? 0 : 1);
