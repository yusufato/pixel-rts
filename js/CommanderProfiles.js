// ═══════════════════════════════════════════════════════════════
//  FAZ 7 — KOMUTAN PROFİLLERİ (gerçek karar ağırlıkları, kozmetik değil)
//  İnsan-tarzı 7 komutan: her biri MEVCUT düğmelere ağırlık verir (yeni karar-yolu YOK).
//  Öngörülemezlik: her maça farklı profil → oyuncu tek kör-noktayı bulamaz. Deterministik (sabit config).
//  Tükettiği düğmeler: doctrine (COA skoru), targetingWeights (Faz 4 scoreTarget), envelopBias (Faz 3 eşiği),
//  reserveMul/concentrate (Faz 2 allocation), pursuitMul (kovalama), tempoBias.
// ═══════════════════════════════════════════════════════════════
const COMMANDER_PROFILES = {
    AGGRESSIVE:        { doctrine: 'armor',    concentrate: true,  reserveMul: 0.6, pursuitMul: 1.4, envelopBias: 0.15,  tempoBias: 1.2, targetingWeights: { ttk: 45, cls: 16, wound: 8,  inrng: 10, def: 4, dist: 0.05 } },
    PATIENT_ARTILLERY: { doctrine: 'defense',  concentrate: false, reserveMul: 1.1, pursuitMul: 0.7, envelopBias: -0.1,  tempoBias: 0.8, targetingWeights: { ttk: 30, cls: 30, wound: 12, inrng: 6,  def: 8, dist: 0.03 } },
    FLANKER:           { doctrine: 'combined', concentrate: false, reserveMul: 0.9, pursuitMul: 1.1, envelopBias: 0.1,   tempoBias: 1.1, targetingWeights: { ttk: 40, cls: 18, wound: 12, inrng: 8,  def: 10, dist: 0.02 } },
    DEFENSIVE_COUNTER: { doctrine: 'defense',  concentrate: true,  reserveMul: 1.3, pursuitMul: 0.6, envelopBias: -0.15, tempoBias: 0.7, targetingWeights: { ttk: 42, cls: 22, wound: 10, inrng: 9,  def: 6, dist: 0.05 } },
    GAMBLER:           { doctrine: 'armor',    concentrate: true,  reserveMul: 0.4, pursuitMul: 1.5, envelopBias: 0.25,  tempoBias: 1.3, targetingWeights: { ttk: 48, cls: 14, wound: 6,  inrng: 12, def: 3, dist: 0.06 } },
    AMBUSHER:          { doctrine: 'combined', concentrate: false, reserveMul: 1.0, pursuitMul: 0.5, envelopBias: 0.0,   tempoBias: 0.9, targetingWeights: { ttk: 35, cls: 24, wound: 14, inrng: 7,  def: 12, dist: 0.02 } },
    FINISHER:          { doctrine: 'combined', concentrate: true,  reserveMul: 0.7, pursuitMul: 1.6, envelopBias: 0.2,   tempoBias: 1.15, targetingWeights: { ttk: 40, cls: 18, wound: 20, inrng: 8, def: 5, dist: 0.03 } }
};
const COMMANDER_PROFILE_NAMES = Object.keys(COMMANDER_PROFILES);

// Seed'li deterministik profil seçimi (her maça farklı-ama-tekrarlanabilir). SIM_RNG değil — kurulumda seed'le.
function commanderPickProfile(seed) {
    const i = ((seed | 0) >>> 0) % COMMANDER_PROFILE_NAMES.length;
    return COMMANDER_PROFILE_NAMES[i];
}
function commanderProfile(name) { return COMMANDER_PROFILES[name] || null; }

if (typeof module !== 'undefined') module.exports = { COMMANDER_PROFILES, COMMANDER_PROFILE_NAMES, commanderPickProfile, commanderProfile };
