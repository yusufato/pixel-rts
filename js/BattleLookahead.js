// ═══════════════════════════════════════════════════════════════════════════
//  İLERİ-BAKIŞ (LOOKAHEAD) — birime hamlesini OYNATARAK seçtirir
//
//  Kullanıcı fikri: "birimler geleceği görsün — A birimi 5sn/10sn sonra şu
//  noktalarda ne olur, cevabını verebilsin."
//
//  ÖLÇÜLMÜŞ TEMEL (tools/gelecek-yelpazesi.js, docs'ta commit geçmişi):
//    · aday nokta sayısı ~24'te doyuyor (+146 marj kazanç, t 3.0)
//    · dağılım AÇIYA değil MENZİLE yayılmalı (yön ikiye katlamak +2, halka +28)
//    · analitik ön eleme K=3'te kazancın %72'sini koruyor — ve BEDAVA
//      (1sn'lik ucuz rollout ile eleme yalnız %27 korur: mevzi değeri zamanla çıkar)
//    · maliyet: 24×~0 + 3×rollout
//
//  ─── MİMARİ KISIT ───
//  Kontrolör stepSim'İN İÇİNDE çalışır. Orada rollout yapmak stepSim'i kendi
//  içinde çağırmak olurdu: dış tikin döngüleri (SIM.units üzerinde gezinen
//  indeksler) fork/restore birimleri YENİDEN YARATTIĞI için bozulurdu.
//  Bu yüzden arama TİKLER ARASINDA çalışır: `battleLookaheadTick(now)` bir
//  tikin BİTİŞİYLE sonrakinin BAŞLANGICI arasında çağrılır.
//
//  ─── DETERMİNİZM ───
//  Arama fork alır, oynatır, GERİ YÜKLER. battleForkRestore rngState'i de geri
//  aldığı için dış simülasyon hiç etkilenmez; net etki yalnızca seçilen birime
//  verilen HAREKET EMRİdir. Emirler determinist bir sırayla üretilir (birim id,
//  aday sırası sabit; RNG yok) → replay/fork tekrar üretebilir.
//  ÖNKOŞUL: aynı fork'tan rollout'un tekrarlanabilir olması. Bu ayrı bir kapıyla
//  güvenceye alındı — tools/ileri-model-kapisi.js (27/27).
// ═══════════════════════════════════════════════════════════════════════════

let BATTLE_LOOKAHEAD_RED = false;    // saldıran (kırmızı) ileri-bakış kullansın mı
let BATTLE_LOOKAHEAD_BLUE = false;

const LA_PERIYOT_TIK = 100;   // kaç tikte bir arama (100 = 5sn)
const LA_BIRIM = 1;           // her aramada kaç birim için karar verilir (en değerliler)
const LA_YON = 8;             // aday yönü
const LA_HALKA = 3;           // aday halkası (MENZİL çeşitliliği — ölçümde asıl kaldıraç)
const LA_YARICAP = 600;       // en dış halka
const LA_DERIN = 3;           // analitik elemeden sonra GERÇEKTEN oynatılan aday
const LA_UFUK = 100;          // rollout ufku (tik) — 100 = 5sn
const LA_EMIR_SURESI = 120;   // verilen emir kaç tik korunur (AI onu hemen ezmesin)

function battleLookaheadAcik(isRed) {
    return isRed ? BATTLE_LOOKAHEAD_RED === true : BATTLE_LOOKAHEAD_BLUE === true;
}

// ── ANALİTİK SKOR: adayı oynatmadan puanla (ölçümde 1sn'lik rollout'u 2.7× yendi) ──
// "Ben onları vurabiliyorum, onlar beni vuramıyor" geometrisi.
function battleLookaheadStatik(u, px, py) {
    const benim = STATS[u.type] ? (STATS[u.type].range || 0) : 0;
    let firsat = 0, maruz = 0, dost = 0;
    for (const o of SIM.units) {
        if (o.dead || o.loaded || o.abandoned) continue;
        const d = Math.hypot(o.x - px, o.y - py);
        const c = (STATS[o.type] && STATS[o.type].cost) || 0;
        if (o.isRed === u.isRed) { if (o.id !== u.id && d < 700) dost += c * (1 - d / 700); continue; }
        if (d <= benim) firsat += c;
        const onun = STATS[o.type] ? (STATS[o.type].range || 0) : 0;
        if (d <= onun) maruz += c;
    }
    return firsat - maruz * 2 + dost * 0.15;
}

// ── ADAY NOKTALAR: halkalı yelpaze (menzile yayılır), arazi süzgeçli ──
function battleLookaheadAdaylar(u) {
    const out = [{ x: u.x, y: u.y, kal: true }];
    for (let h = 1; h <= LA_HALKA; h++) {
        const rr = LA_YARICAP * h / LA_HALKA;
        for (let k = 0; k < LA_YON; k++) {
            const a = (Math.PI * 2 * k) / LA_YON + (h % 2 ? 0 : Math.PI / LA_YON);
            const px = u.x + Math.cos(a) * rr, py = u.y + Math.sin(a) * rr;
            if (px < 60 || py < 60 || px > WORLD_W - 60 || py > WORLD_H - 60) continue;
            if (typeof isPassableAt === 'function' && !isPassableAt(px, py)) continue;
            out.push({ x: px, y: py, kal: false });
        }
    }
    return out;
}

function battleLookaheadMarj(isRed) {
    const a = battleArmyObservation(isRed), d = battleArmyObservation(!isRed);
    return a.effectiveValue - d.effectiveValue;
}

/* TEK BİRİM İÇİN KARAR: adayları üret → analitik ele → ilk LA_DERIN'i OYNAT → en iyiyi seç.
   Dönüş: {x, y} veya null. Fork/restore burada yapılır; çağıran temiz durumla devam eder. */
function battleLookaheadBirimKarari(uid, isRed, now) {
    const u0 = SIM.units.find(x => x.id === uid);
    if (!u0 || u0.dead) return null;
    const adaylar = battleLookaheadAdaylar(u0);
    if (adaylar.length < 3) return null;

    // 1) ANALİTİK ELEME (bedava). Determinist sıra: skor, sonra x, sonra y.
    for (const a of adaylar) a._s = battleLookaheadStatik(u0, a.x, a.y);
    adaylar.sort((a, b) => (b._s - a._s) || (a.x - b.x) || (a.y - b.y));
    const derin = adaylar.slice(0, LA_DERIN);
    // "yerinde kal" hep sınansın: aramanın zarar vermediğini garanti eden taban.
    if (!derin.some(a => a.kal)) { const k = adaylar.find(a => a.kal); if (k) derin.push(k); }

    // 2) DERİN DEĞERLENDİRME: her adayı gerçekten oynat.
    const fork = battleForkCapture();
    const bas = battleLookaheadMarj(isRed);
    let enIyi = null, enIyiSkor = -Infinity;
    for (const a of derin) {
        battleForkRestore(fork);
        const u = SIM.units.find(x => x.id === uid);
        if (!u) continue;
        u.controlOwner = 'PLAYER';                 // rollout içinde AI onu yeniden yönlendirmesin
        u.manualTarget = null; u.attackTarget = null;
        u.targetX = a.x; u.targetY = a.y;
        u.manualMoveTarget = { x: a.x, y: a.y };
        u.isMovingToManualTarget = true; u._holdingPos = false;
        let s = now;
        for (let i = 0; i < LA_UFUK && phase === PHASE.BATTLE; i++) {
            s += BATTLE_TICK_MS;
            stepSim(s, BATTLE_TICK_SEC, battleControllersDrive, false);
        }
        const skor = battleLookaheadMarj(isRed) - bas;
        // eşitlikte determinist: önce skor, sonra x, sonra y
        if (skor > enIyiSkor || (skor === enIyiSkor && enIyi && (a.x < enIyi.x || (a.x === enIyi.x && a.y < enIyi.y)))) {
            enIyiSkor = skor; enIyi = a;
        }
    }
    battleForkRestore(fork);
    return (enIyi && !enIyi.kal) ? { x: enIyi.x, y: enIyi.y, skor: enIyiSkor } : null;
}

/* TİKLER ARASINDA çağrılır. stepSim'in İÇİNDEN ÇAĞIRMA — fork/restore birimleri
   yeniden yaratır ve dış tikin döngülerini bozar. */
function battleLookaheadTick(now) {
    if (typeof SIM === 'undefined' || !SIM.units || phase !== PHASE.BATTLE) return;
    if ((SIM.tick % LA_PERIYOT_TIK) !== 0) return;

    for (const isRed of [true, false]) {
        if (!battleLookaheadAcik(isRed)) continue;
        // En DEĞERLİ birimler: karar kaldıracı en yüksek olanlar. Determinist sıra.
        const hedefler = SIM.units
            .filter(u => !u.dead && u.isRed === isRed && !u.loaded && !u.abandoned && !u.isAir)
            .sort((a, b) => (((STATS[b.type] && STATS[b.type].cost) || 0) - ((STATS[a.type] && STATS[a.type].cost) || 0)) || (a.id - b.id))
            .slice(0, LA_BIRIM)
            .map(u => u.id);
        for (const uid of hedefler) {
            const karar = battleLookaheadBirimKarari(uid, isRed, now);
            if (!karar) continue;
            const u = SIM.units.find(x => x.id === uid);
            if (!u || u.dead) continue;
            u.targetX = karar.x; u.targetY = karar.y;
            u.manualMoveTarget = { x: karar.x, y: karar.y };
            u.isMovingToManualTarget = true; u._holdingPos = false;
            u._laUntilTick = SIM.tick + LA_EMIR_SURESI;   // emrin ömrü (AI hemen ezmesin)
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = { battleLookaheadTick, battleLookaheadBirimKarari, battleLookaheadStatik };
}
