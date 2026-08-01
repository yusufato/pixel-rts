// ═══════════════════════════════════════════════════════════════
//  FAZ 2c — UZAY-ZAMAN MUHAKEMESİ
//  İnsanın sezgisel yaptığını AI SAYISAL yapar: düşman N sn sonra nerede,
//  birliğim kaç sn'de varır, hedefi kaç sn'de öldürürüm, girersem/çekilirsem ne olur.
//  Hepsi SAF + DETERMİNİSTİK (Math.random YOK). Nominal saniye — karşılaştırma için tutarlı,
//  karar eşikleri kalibre edilebilir (ST_K_* sabitleri). Blackboard + anti-kuşatma + hedef-skorlama okur.
// ═══════════════════════════════════════════════════════════════
const ST_TICK = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
const ST_UPS = ((typeof GAME_SPEED !== 'undefined') ? GAME_SPEED : 1) / ST_TICK;   // hız×ST_UPS = dünya-birimi/sn
const ST_K_SPREAD = 60;   // görülmeyen hedefin belirsizlik büyümesi (px/sn)

function stUnitSpeedUPS(unit) {
    const s = (typeof STATS !== 'undefined' && STATS[unit.type]) ? STATS[unit.type].speed : 0.5;
    return Math.max(0.05, s) * ST_UPS;
}

// Düşman contact N sn sonra nerede (hız ileri + belirsizlik büyür). velocity per-TICK'tir.
function stPredictEnemyPos(contact, dtSec) {
    const ticks = dtSec / ST_TICK;
    const conf = (contact.confidence != null) ? contact.confidence : 1;
    return {
        x: contact.x + (contact.velocityX || 0) * ticks,
        y: contact.y + (contact.velocityY || 0) * ticks,
        r: (contact.uncertaintyRadius || 0) + ST_K_SPREAD * dtSec * (1 - conf)
    };
}

// İki nokta arası kat edilecek yol uzunluğu: düz-hat açıksa o, değilse A* hücre-yolu.
function stPathLen(x1, y1, x2, y2) {
    if (typeof pathBlockedBetween === 'function' && !pathBlockedBetween(x1, y1, x2, y2)) return Math.hypot(x2 - x1, y2 - y1);
    if (typeof findPath === 'function') {
        const p = findPath(x1, y1, x2, y2);
        if (p && p.length) { let L = 0, px = x1, py = y1; for (const w of p) { L += Math.hypot(w.x - px, w.y - py); px = w.x; py = w.y; } return L; }
        return Infinity;
    }
    return Math.hypot(x2 - x1, y2 - y1);
}

// Birliğin hedefe VARIŞ süresi (sn) — yol-uzunluğu / hız. Yol yoksa ∞.
function stTimeToArrive(unit, dest) {
    const L = stPathLen(unit.x, unit.y, dest.x, dest.y);
    if (!isFinite(L)) return Infinity;
    return L / stUnitSpeedUPS(unit);
}

// Tek saldırganın hedefe etkili DPS'i (kaba zırh + tanksavar-zırh eşleşmesi = calculateUnitDamage vekili).
function stEffectiveDps(attacker, target) {
    const s = (typeof STATS !== 'undefined') ? STATS[attacker.type] : null;
    if (!s || !s.atk || !s.atkSpeed) return 0;
    let dps = s.atk * 1000 / s.atkSpeed;
    const tArmor = ((typeof STATS !== 'undefined' && STATS[target.type]) ? STATS[target.type].armor : 0) || target.armor || 0;
    const tt = target.type;
    if (typeof T !== 'undefined' && attacker.type === T.ANTI_TANK && (tt === T.ARMOR || tt === T.ARMOR_INFANTRY)) dps *= 4;   // tanksavar→zırh ×4
    else dps *= Math.max(0.25, 1 - tArmor * 0.08);   // zırh hafifletir
    return dps;
}

// Bir grup saldırganın hedefi ÖLDÜRME süresi (sn). Menzil-dışı saldırganların önce yaklaşması ihmal (üst-sınır tahmini).
function stTimeToKill(attackerUnits, target) {
    let dps = 0;
    for (const a of attackerUnits) dps += stEffectiveDps(a, target);
    if (dps <= 0) return Infinity;
    const hp = (target.hp != null) ? target.hp : ((typeof STATS !== 'undefined' && STATS[target.type]) ? STATS[target.type].hp : 100);
    return hp / dps;
}

// Girersem/tutarsam kaç kayıp — Lanchester-kare vekili (büyük kuvvet orantısız üstün). exchangeRatio>1 = lehte.
function stExpectedLoss(ownVal, enemyVal, sec) {
    const k = 0.02, tot = (ownVal + enemyVal) || 1;
    const ownLoss = enemyVal * enemyVal / tot * k * sec;
    const enemyLoss = ownVal * ownVal / tot * k * sec;
    return { ownLoss, enemyLoss, exchangeRatio: enemyLoss / Math.max(1e-6, ownLoss) };
}

// Noktayı segment(a,b) üzerine dik izdüşür (çekilme hattına en yakın nokta).
function stProjectOntoLine(u, line) {
    const ax = line.a.x, ay = line.a.y, dx = line.b.x - ax, dy = line.b.y - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((u.x - ax) * dx + (u.y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return { x: ax + dx * t, y: ay + dy * t };
}

// Çekilirsem KİM sağ çıkar: hatta varış-süresi < en-yakın-kovalayanın (yaklaşma+öldürme) süresi olanlar.
function stRetreatSurvivors(ownUnits, threats, retreatLine) {
    const survivors = [];
    for (const u of ownUnits) {
        const dest = stProjectOntoLine(u, retreatLine);
        const tta = stTimeToArrive(u, dest);
        let minKill = Infinity;
        for (const th of threats) {
            const total = stTimeToArrive(th, u) + stTimeToKill([th], u);
            if (total < minKill) minKill = total;
        }
        if (tta < minKill) survivors.push(u.id);
    }
    return survivors;
}

// Topçu ateş edebilir mi (gözcü + LOS). Mevcut motoru kullanır.
function stCanArtilleryFire(unit, target) {
    if (typeof artilleryHasSight === 'function') return artilleryHasSight(unit, target);
    if (typeof checkLineOfSight === 'function') return checkLineOfSight(unit.x, unit.y, target.x, target.y, unit, target);
    return true;
}

if (typeof module !== 'undefined') module.exports = {
    stPredictEnemyPos, stPathLen, stTimeToArrive, stEffectiveDps, stTimeToKill,
    stExpectedLoss, stProjectOntoLine, stRetreatSurvivors, stCanArtilleryFire, stUnitSpeedUPS
};
