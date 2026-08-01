// ═══════════════════════════════════════════════════════════════
//  FAZ 4 — HEDEF SKORLAMA (focus-kill): "hangi düşmanı ÖNCE öldür".
//  updateFocusContact'ın çekirdeği (histerezis sarmalı korunur). Deterministik (RNG yok).
//  Amaç hasar değil DEĞER SİLMEK: hızlı-ölen + en-tehlikeli + yaralı-bitir + menzildeki-dost çok.
//  Komutan profilleri (Faz 7) TGT_W ağırlıklarını override edebilir.
// ═══════════════════════════════════════════════════════════════
let BATTLE_TARGET_SCORING = true;   // A/B: kapatınca updateFocusContact eski (en-yakın+yaralı) skora düşer.
// KULLANICI-FORMÜLÜ (bul-sabitle-vur-bitir): cluster (alan-silahı yoğun-kümeye "kütleyi kır"), sead (AA-öncelik "hava-savunmasını sök"), counterRecon (gözcü-avla "zincirin ilk halkası").
const TGT_W = { ttk: 40, cls: 20, wound: 10, inrng: 8, def: 6, dist: 0.04, cluster: 7, sead: 28, counterRecon: 22, counterBattery: 26 };

function bbClassPriority(type) {
    if (typeof T === 'undefined') return 0;
    if (type === T.ARTILLERY) return 3;       // topçu = en tehlikeli (uzak menzil, alan hasarı)
    if (type === T.ANTI_TANK) return 2.5;
    if (type === T.ARMOR) return 2;
    if (type === T.MECH_INFANTRY) return 1;
    return 0;
}

// contact: perception contact/blackboard enemy. ownUnits: observation.ownUnits. blackboard: opsiyonel (merkez/enemies).
function scoreTarget(contact, ownUnits, blackboard, weights) {
    const W = weights || TGT_W;
    const rangeOf = t => (typeof STATS !== 'undefined' && STATS[t]) ? STATS[t].range : 110;
    // COUNTER-FARKINDA DPS: gerçek calculateUnitDamage (tanksavar→zırh/MEK ×4, mek→piyade ×1.5, strong/weak) × atış-hızı.
    // Böylece grup, birimlerinin ETKİLİ olduğu hedefe odaklanır (tanksavar mek/zırhı, piyade yumuşağı seçer).
    const tType = contact.typeEstimate, tArmor = (typeof STATS !== 'undefined' && STATS[tType]) ? STATS[tType].armor : 0;
    let ttkDps = 0, inRange = 0;
    for (const u of ownUnits) {
        const d = Math.hypot(u.x - contact.x, u.y - contact.y);
        if (d < 450) {
            const us = (typeof STATS !== 'undefined') ? STATS[u.type] : null;
            const atk = us ? us.atk : 10, rof = us && us.atkSpeed ? 1000 / us.atkSpeed : 1;
            const dmg = (typeof calculateUnitDamage === 'function' && tType != null) ? calculateUnitDamage(u.type, tType, atk, tArmor) : atk;
            ttkDps += dmg * rof;   // counter'lı gerçek DPS
        }
        if (d <= rangeOf(u.type)) inRange++;
    }
    const baseHp = (typeof STATS !== 'undefined' && STATS[contact.typeEstimate]) ? STATS[contact.typeEstimate].hp : 100;
    const hpFrac = contact.healthBand === 'CRITICAL' ? 0.33 : contact.healthBand === 'DAMAGED' ? 0.66 : 1;
    const ttk = ttkDps > 0 ? (baseHp * hpFrac) / ttkDps : Infinity;   // sn (düşük=hızlı öldür)
    const woundBonus = contact.healthBand === 'CRITICAL' ? 2 : contact.healthBand === 'DAMAGED' ? 1 : 0;
    let defended = 0;
    if (blackboard && blackboard.enemies) for (const e of blackboard.enemies) { if (e.id !== contact.id && Math.hypot(e.x - contact.x, e.y - contact.y) < 200) defended++; }
    const oc = (blackboard && blackboard.ownCentroid) ? blackboard.ownCentroid : { x: contact.x, y: contact.y };
    const distC = Math.hypot(contact.x - oc.x, contact.y - oc.y);
    let score = 0;
    score += W.ttk * (isFinite(ttk) ? 1 / (1 + ttk) : 0);
    score += W.cls * bbClassPriority(contact.typeEstimate);
    score += W.wound * woundBonus;
    score += W.inrng * inRange;
    score -= W.dist * distC;
    // KULLANICI-FORMÜLÜ (bul-sabitle-vur-bitir) — modern ateş-merkezli doktrin, scoreTarget ağırlıklarıyla:
    const tSt = (typeof STATS !== 'undefined') ? STATS[tType] : null;
    const tRoles = (tSt && tSt.roleTags) || [];
    // (a) KÜME-HEDEFLEME: grup ALAN-silahı içeriyorsa yoğun küme = fırsat ("kütleyi kır"); yoksa savunulan hedeften kaç (eski).
    const hasArea = ownUnits.some(u => { const s = (typeof STATS !== 'undefined') ? STATS[u.type] : null; return s && s.weapons && s.weapons[0] && s.weapons[0].indirect; });
    score += (hasArea ? W.cluster : -W.def) * defended;
    // (b) SEAD ("hava-savunmasını sök"): düşman AA'sı yüksek öncelik → hava-varlığı serbest kalır.
    if (tRoles.includes('anti_air') || (typeof T !== 'undefined' && (tType === T.SAM || tType === T.SPAAG || tType === T.MANPADS))) score += W.sead;
    // (c) KARŞI-KEŞİF ("gözcü-avla"): düşman keşfi zincirin ilk halkası — kör et.
    if (tRoles.includes('recon') || tRoles.includes('intel') || (typeof T !== 'undefined' && (tType === T.RECON || tType === T.RECON_UAV || tType === T.SCOUT))) score += W.counterRecon;
    // (d) KARŞI-BATARYA ("bataryayı sustur"): grup DOLAYLI-ateş içeriyorsa düşman topçusu/ÇNRA/havanı öncelikli hedef.
    // Düşman-topçusu ancak KESKİN (radar counter_battery aurası dolaylı-atıcıyı ifşa eder) → contact olarak görülür; bu bonus radar-ifşaya doğal bağlanır.
    const tIndirect = (tSt && tSt.weapons && tSt.weapons[0] && tSt.weapons[0].indirect) || tRoles.includes('artillery') || (typeof T !== 'undefined' && (tType === T.ARTILLERY || tType === T.MLRS || tType === T.MORTAR || tType === T.BALLISTIC));
    if (hasArea && tIndirect) score += W.counterBattery;
    return score * (contact.confidence != null ? contact.confidence : 1);
}

if (typeof module !== 'undefined') module.exports = { scoreTarget, bbClassPriority, TGT_W };
