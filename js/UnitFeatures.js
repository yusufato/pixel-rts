'use strict';

// Ham birim verisinden BattleSelector'in tuketebilecegi sabit uzunlukta
// sayisal vektor uretir. Kural yok - her sey damageMatrix'ten turetilir.

const ARMOR = ['infantry', 'light', 'heavy', 'structure', 'air'];

class UnitFeatures {
  constructor(db) {
    this.db = db;
    this.matrix = db.damageMatrix;
    this.byId = new Map(db.units.map(u => [u.id, u]));
    this._cache = new Map();
  }

  // --- temel yardimcilar -------------------------------------------------

  // Bir silahin belirli bir zirh tipine karsi saniyedeki beklenen hasari.
  weaponDps(w, armorType, opts = {}) {
    const mult = (this.matrix[w.damageType] || {})[armorType] || 0;
    if (mult === 0) return 0;

    const salvo = w.salvo || 1;
    const acc = this.expectedAccuracy(w, opts);
    const aoeBonus = 1 + (w.aoe || 0) * (opts.enemyClustering ?? 0.3);

    return w.damage * salvo * w.rof * mult * acc * aoeBonus;
  }

  // Menzil/hareket/siper dahil beklenen isabet.
  expectedAccuracy(w, opts = {}) {
    const a = w.accuracy;
    if (!a) return 1;

    const d = opts.distance ?? a.optimalRange;
    const span = Math.max(w.range - a.optimalRange, 0.001);
    const falloff = d <= a.optimalRange
      ? 1
      : 1 - a.falloff * ((d - a.optimalRange) / span);

    const moving = 1 - a.vsMoving * ((opts.targetSpeed ?? 0) / 4);
    const cover = 1 - (opts.targetCover ?? 0) * (1 - a.ignoresCover);

    return Math.max(this.db.accuracyModel.floor, a.base * falloff * moving * cover);
  }

  // Birimin her zirh tipine karsi toplam DPS'i -> 5 elemanli vektor.
  dpsProfile(unit, opts = {}) {
    return ARMOR.map(armor => {
      let total = 0;
      for (const w of unit.weapons || []) {
        const canHit = armor === 'air'
          ? (w.targets || []).includes('air')
          : (w.targets || []).includes('ground');
        if (!canHit) continue;
        if (w.consumesSelf) {
          // tek kullanimlik: DPS yerine tek vurus degeri, sureye yayma
          total += this.weaponDps(w, armor, opts) * 0.5;
        } else {
          total += this.weaponDps(w, armor, opts);
        }
      }
      return total;
    });
  }

  // Etkin dayaniklilik: hp * zirh degerinin hasar azaltma katkisi.
  effectiveHp(unit) {
    const reduction = 1 + (unit.armorValue || 0) * 0.06;
    return unit.hp * reduction;
  }

  // Mühimmat bitmeden surdurebildigi saniye. null -> sinirsiz.
  sustainSeconds(unit) {
    if (!unit.ammo) return 999;
    const w = (unit.weapons || [])[0];
    if (!w) return 999;
    const shotsPerSec = w.rof * (w.salvo || 1);
    if (shotsPerSec <= 0) return 999;
    return unit.ammo.capacity / (shotsPerSec * (unit.ammo.perShot || 1));
  }

  // Tehdit menzili: en uzun silahin menzili, silahsizsa gorus.
  threatRange(unit) {
    const ranges = (unit.weapons || []).map(w => w.range);
    return ranges.length ? Math.max(...ranges) : 0;
  }

  minEngageRange(unit) {
    const mins = (unit.weapons || []).map(w => w.minRange || 0);
    return mins.length ? Math.min(...mins) : 0;
  }

  // --- vektor ------------------------------------------------------------

  // Sabit uzunlukta, [0,1] araligina normalize edilmis ozellik vektoru.
  vector(unitOrId, opts = {}) {
    const unit = typeof unitOrId === 'string' ? this.byId.get(unitOrId) : unitOrId;
    const key = unit.id + JSON.stringify(opts);
    if (this._cache.has(key)) return this._cache.get(key);

    const dps = this.dpsProfile(unit, opts);
    const ehp = this.effectiveHp(unit);
    const cost = unit.cost.resource;
    const aura = unit.aura || {};

    const v = [
      // 0-4: zirh tipi basina DPS (kaynak basina - maliyet etkinligi)
      ...dps.map(d => norm(d / cost, 0, 0.8)),
      // 5: ham toplam DPS
      norm(Math.max(...dps), 0, 400),
      // 6: etkin dayaniklilik
      norm(ehp, 0, 1400),
      // 7: dayaniklilik / maliyet
      norm(ehp / cost, 0, 2.5),
      // 8: hiz
      norm(unit.speed, 0, 5),
      // 9: gorus
      norm(unit.vision, 0, 18),
      // 10: tehdit menzili
      norm(this.threatRange(unit), 0, 60),
      // 11: min menzil (olu bolge)
      norm(this.minEngageRange(unit), 0, 20),
      // 12: menzil / hiz orani (kacabilir mi)
      norm(this.threatRange(unit) / Math.max(unit.speed, 0.1), 0, 40),
      // 13: muhimmat dayanimi
      norm(Math.min(this.sustainSeconds(unit), 200), 0, 200),
      // 14: ikmal bagimliligi
      unit.ammo ? 1 : 0,
      // 15: gizlilik
      unit.stealth || 0,
      // 16: tespit
      unit.detect || 0,
      // 17: yayin izi (karsi-batarya / EH tarafindan bulunabilirlik)
      unit.emissions || 0,
      // 18: jammer'a hassasiyet
      unit.jammable || 0,
      // 19: dolayli ates mi
      (unit.weapons || []).some(w => w.indirect) ? 1 : 0,
      // 20: gozlemci gerektiriyor mu
      (unit.requires || []).includes('spotter') ? 1 : 0,
      // 21: gozlemci sagliyor mu
      (unit.provides || []).includes('spotter') ? 1 : 0,
      // 22: havaya vurabiliyor mu (etikete degil, gercek hasara bakar)
      dps[ARMOR.indexOf('air')] > 0 ? 1 : 0,
      // 23: kendisi hava birimi mi
      unit.armorType === 'air' ? 1 : 0,
      // 24: tek kullanimlik
      unit.singleUse ? 1 : 0,
      // 25: destek halesi var mi
      aura.type ? 1 : 0,
      // 26: hale yaricapi
      norm(aura.radius || 0, 0, 30),
      // 27: yuksek deger hedefi mi (olumu alan etkisi yaratiyor)
      unit.onDeath || unit.explodesOnDeath ? 1 : 0,
      // 28: tasima kapasitesi
      norm((unit.transport || {}).slots || 0, 0, 6),
      // 29: tier
      norm(unit.tier, 1, 4),
      // 30: nufus maliyeti
      norm(unit.cost.supply, 0, 6),
      // 31: uretim suresi
      norm(unit.cost.buildTime, 0, 60),
    ];

    this._cache.set(key, v);
    return v;
  }

  // A'nin B'ye karsi ne kadar iyi oldugu. Simetrik degil - selector'in
  // ogrenmesi gereken asil sinyal bu.
  counterScore(aId, bId, opts = {}) {
    const a = this.byId.get(aId);
    const b = this.byId.get(bId);

    // Tek kullanimlik birim bir DPS duellosu yapmaz - tek vurus takasi yapar.
    if (a.singleUse && !b.singleUse) return this._strikeTrade(a, b, opts);
    if (b.singleUse && !a.singleUse) return -this._strikeTrade(b, a, opts);

    const aDps = this.dpsProfile(a, { ...opts, targetSpeed: b.speed })[ARMOR.indexOf(b.armorType)];
    const bDps = this.dpsProfile(b, { ...opts, targetSpeed: a.speed })[ARMOR.indexOf(a.armorType)];

    if (aDps <= 0 && bDps <= 0) return 0;

    // Menzil ustunlugu = serbest ates penceresi. Uzun menzilli olan,
    // kisa menzilli kapatana kadar bedava hasar verir.
    const closing = Math.max(a.speed + b.speed, 0.2);
    const rA = this.threatRange(a), rB = this.threatRange(b);
    const freeA = rA > rB ? (rA - rB) / closing : 0;
    const freeB = rB > rA ? (rB - rA) / closing : 0;

    // Serbest pencereden sonra kalan can.
    const hpB = Math.max(this.effectiveHp(b) - aDps * freeA, 1);
    const hpA = Math.max(this.effectiveHp(a) - bDps * freeB, 1);

    const tA = aDps > 0 ? freeB + hpB / aDps : Infinity; // a'nin b'yi oldurme suresi
    const tB = bDps > 0 ? freeA + hpA / bDps : Infinity;

    // Saniyede yok edilen dusman kaynagi - maliyet-normalize takas degeri.
    const valA = tA === Infinity ? 0 : b.cost.resource / tA;
    const valB = tB === Infinity ? 0 : a.cost.resource / tB;

    // Tek kullanimlik birimler kendi maliyetini de kaybeder.
    const penA = a.singleUse ? 0.5 : 1;
    const penB = b.singleUse ? 0.5 : 1;

    const num = valA * penA - valB * penB;
    const den = valA * penA + valB * penB;
    return den > 0 ? clamp(num / den, -1, 1) : 0;
  }

  // Tek kullanimlik birimin takas degeri: vurdugu kadar kaynak yok eder,
  // kendi maliyetini her halukarda kaybeder.
  _strikeTrade(a, b, opts = {}) {
    const w = (a.weapons || [])[0];
    if (!w) return -1;

    const mult = (this.matrix[w.damageType] || {})[b.armorType] || 0;
    if (mult === 0) return -1;

    const acc = this.expectedAccuracy(w, { ...opts, targetSpeed: b.speed });
    const aoeBonus = 1 + (w.aoe || 0) * (opts.enemyClustering ?? 0.3);
    const delivered = w.damage * mult * acc * aoeBonus;

    // Onleme: savunan, saldiranin vurus menziline girmeden ates acabiliyorsa
    // yaklasma boyunca serbest ates eder.
    const bDps = this.dpsProfile(b, { ...opts, targetSpeed: a.speed })[ARMOR.indexOf(a.armorType)];
    let survival = 1;
    if (bDps > 0) {
      const bRange = this.threatRange(b);
      const window = Math.max(bRange - w.range, 0) / Math.max(a.speed, 0.1);
      survival = clamp(1 - (bDps * window) / this.effectiveHp(a), 0, 1);
    }

    const killFraction = Math.min(delivered / this.effectiveHp(b), 1) * survival;
    const gained = b.cost.resource * killFraction;
    const spent = a.cost.resource;

    return clamp((gained - spent) / (gained + spent), -1, 1);
  }

  // Tum 24x24 karsit matrisi - egitim oncesi sanity check icin.
  counterMatrix(opts = {}) {
    const ids = this.db.units.map(u => u.id);
    const out = {};
    for (const a of ids) {
      out[a] = {};
      for (const b of ids) out[a][b] = +this.counterScore(a, b, opts).toFixed(3);
    }
    return out;
  }

  // Bir ordunun toplu profili - BattleSituation seviyesinde kullanilir.
  armyVector(composition, opts = {}) {
    const dim = this.vector(this.db.units[0].id, opts).length;
    const agg = new Array(dim).fill(0);
    let totalSupply = 0;

    for (const [id, count] of Object.entries(composition)) {
      const u = this.byId.get(id);
      if (!u) continue;
      const w = u.cost.supply * count;
      const v = this.vector(id, opts);
      for (let i = 0; i < dim; i++) agg[i] += v[i] * w;
      totalSupply += w;
    }
    if (totalSupply > 0) for (let i = 0; i < dim; i++) agg[i] /= totalSupply;

    // ordu seviyesinde kritik: bosluk var mi
    const has = tag => Object.keys(composition).some(id =>
      (this.byId.get(id)?.roleTags || []).includes(tag));

    return [
      ...agg,
      has('anti_air') ? 1 : 0,
      has('anti_armor') ? 1 : 0,
      has('spotter') ? 1 : 0,
      has('logistics') ? 1 : 0,
      has('command') ? 1 : 0,
      norm(totalSupply, 0, 120),
    ];
  }
}

function norm(x, lo, hi) { return clamp((x - lo) / (hi - lo), 0, 1); }
function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

if (typeof module !== "undefined") module.exports = { UnitFeatures, ARMOR };