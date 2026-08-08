// ═══════════════════════════════════════════════════════════════════════════
//  MUHAREBE SONUCU TAHMİNİ — Lanchester kare yasası, heterojen ordu + yaralı birim
//
//  NEDEN: AI "saldırayım mı" sorusunu bugün `forceRatio` (kaba KÜRESEL değer oranı) ve elle
//  konmuş bir eşikle cevaplıyor. O eşik denendi ve ÇÖKTÜ (BATTLE_ANGAJMAN, 24 bağımsız tohum,
//  t −0.70). Kusur eşiğin değerinde değil ALETİNDE: tek bir orana bakan eşik "bu kavgadan
//  elimde ne kalır" sorusunu soramaz.
//
//  ÖLÇÜLEN KUSUR (kullanıcının 6 canlı maçı): AI 644px'te dövüşüyor (insan 1160px), 47.506 hasar
//  yiyor (insan 17.280), uzun menzillilerinin verdiği/yediği 0.63 (insanınki 6.54).
//
//  REFERANS: Stanescu ve ark., "Using Lanchester Attrition Laws for Combat Prediction in
//  StarCraft" (AIIDE 2015) — yaralı birimleri ve karışık tipleri modelliyor, sadece kazananı
//  değil GERİYE KALAN ORDUYU tahmin ediyor, muharebe simülasyonundan hızlı, ve saldır/çekil
//  kararına bağlanınca turnuva galibiyet oranını yükseltmiş.
//
//  BU SÜRÜMDE EĞİTİM YOK: katsayılar oyunun KENDİ hasar matrisinden (damageMatrix) türetiliyor.
//
//  TÜRETİM: kalan can x=H_A(t), y=H_B(t); hasar çıktısı kalan canla orantılı:
//      dx/dt = −b·y ,  dy/dt = −a·x      (a = D_A/H_A0 , b = D_B/H_B0)
//   → a·x² − b·y² sabit  ⇒  S_A = D_A·H_A0 , S_B = D_B·H_B0
//      kazanan: S büyük olan;  kalan can: x_son = H_A0·√(1 − S_B/S_A)
//
//  DETERMİNİST: RNG yok, saf fonksiyon. Sim durumunu OKUR, yazmaz.
// ═══════════════════════════════════════════════════════════════════════════

// Bir saldıranın bir hedefe karşı saniyelik hasarı (silah döngüsü + zırh çarpanı + hedef uygunluğu).
function forecastDpsVs(attackerStats, targetStats) {
    if (!attackerStats || !targetStats) return 0;
    const DB = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB : null;
    const DM = DB ? DB.damageMatrix : null;
    if (!DM) return 0;
    const arm = targetStats.armorType || 'infantry';
    let dps = 0;
    for (const w of (attackerStats.weapons || [])) {
        if (!w || !(w.damage > 0)) continue;
        // hedef uygunluğu: hava/kara alanı + tek-kullanımlık istisnaları UnitLoader'da tanımlı
        if (typeof weaponCanEngage === 'function') { if (!weaponCanEngage(w, targetStats)) continue; }
        else if (Array.isArray(w.targets)) {
            const hava = !!targetStats.air || targetStats.domain === 'air';
            if (hava && w.targets.indexOf('air') < 0) continue;
            if (!hava && w.targets.indexOf('ground') < 0 && w.targets.indexOf('air') >= 0) continue;
        }
        const eff = (DM[w.damageType] || {})[arm] || 0;
        if (eff <= 0) continue;
        const rof = (w.rof > 0) ? w.rof : 1;              // atış/sn
        const perShot = (w.perShot > 0) ? w.perShot : 1;
        // isabet: accuracyModel varsa ortalama isabet, yoksa 1
        const isabet = (w.accuracy && Number.isFinite(w.accuracy.base)) ? Math.max(0.05, Math.min(1, w.accuracy.base)) : 1;
        dps += w.damage * eff * rof * perShot * isabet;
    }
    return dps;
}

// Ordu özeti: toplam can + düşman BİLEŞİMİNE karşı toplam DPS.
// birimler: [{ stats, hp, maxHp }] — stats = STATS[type] benzeri (weapons, armorType).
function forecastArmyAggregate(birimler, dusmanBirimler) {
    let H = 0, D = 0;
    if (!birimler || !birimler.length) return { H: 0, D: 0, n: 0 };
    // düşman bileşimi CAN AĞIRLIKLI (yaralı düşman daha az "hedef payı" tutar)
    const dusmanCan = {};
    let dusmanToplam = 0;
    for (const u of (dusmanBirimler || [])) {
        const hp = Math.max(0, u.hp || 0);
        if (hp <= 0) continue;
        const k = u.stats && (u.stats.id || u.stats.key);
        if (k == null) continue;
        if (!dusmanCan[k]) dusmanCan[k] = { stats: u.stats, hp: 0 };
        dusmanCan[k].hp += hp; dusmanToplam += hp;
    }
    if (dusmanToplam <= 0) return { H: birimler.reduce((s, u) => s + Math.max(0, u.hp || 0), 0), D: 0, n: birimler.length };
    for (const u of birimler) {
        const hp = Math.max(0, u.hp || 0);
        if (hp <= 0) continue;
        H += hp;
        let d = 0;
        for (const k of Object.keys(dusmanCan).sort()) {
            const pay = dusmanCan[k].hp / dusmanToplam;
            d += pay * forecastDpsVs(u.stats, dusmanCan[k].stats);
        }
        D += d;
    }
    return { H, D, n: birimler.length };
}

// ── ANA TAHMİN ──
// Dönen: { kazanan: 'A'|'B'|'berabere', SA, SB, oran, kalanA, kalanB, kalanOranA, kalanOranB, sure }
// kalanOran = kazananın canının yüzde kaçı kalır (0-1). Kaybeden için 0.
function battleForecastCombat(birimlerA, birimlerB) {
    const A = forecastArmyAggregate(birimlerA, birimlerB);
    const B = forecastArmyAggregate(birimlerB, birimlerA);
    const SA = A.D * A.H, SB = B.D * B.H;
    const bos = { kazanan: 'berabere', SA, SB, oran: 1, kalanA: A.H, kalanB: B.H, kalanOranA: 1, kalanOranB: 1, sure: 0, A, B };
    if (A.H <= 0 && B.H <= 0) return bos;
    if (B.H <= 0) return { ...bos, kazanan: 'A', kalanB: 0, kalanOranB: 0, oran: Infinity };
    if (A.H <= 0) return { ...bos, kazanan: 'B', kalanA: 0, kalanOranA: 0, oran: 0 };
    // iki taraf da vuramıyorsa (menzil/uygunluk yok) → berabere
    if (SA <= 0 && SB <= 0) return bos;
    if (SB <= 0) return { ...bos, kazanan: 'A', kalanB: 0, kalanOranB: 0, oran: Infinity };
    if (SA <= 0) return { ...bos, kazanan: 'B', kalanA: 0, kalanOranA: 0, oran: 0 };

    const oran = SA / SB;
    if (Math.abs(SA - SB) < 1e-9) return bos;
    if (SA > SB) {
        const kalanOran = Math.sqrt(Math.max(0, 1 - SB / SA));
        const kalanA = A.H * kalanOran;
        // süre: y=0 anı — kapalı çözüm yerine güvenli yaklaşıklık (kaybedenin canı / kazananın DPS'i)
        const sure = B.H / Math.max(1e-6, A.D);
        return { kazanan: 'A', SA, SB, oran, kalanA, kalanB: 0, kalanOranA: kalanOran, kalanOranB: 0, sure, A, B };
    }
    const kalanOran = Math.sqrt(Math.max(0, 1 - SA / SB));
    const kalanB = B.H * kalanOran;
    const sure = A.H / Math.max(1e-6, B.D);
    return { kazanan: 'B', SA, SB, oran, kalanA: 0, kalanB, kalanOranA: 0, kalanOranB: kalanOran, sure, A, B };
}

// ── KARAR YARDIMCISI ──
// "Bu kavgaya girersem elimde ne kalır?" — angajman kararına bağlanacak sayı.
// Dönen: net takas beklentisi (kendi kalan DEĞERİM − düşmanın kalan DEĞERİ), değer birimi ₺.
// Not: kalan can oranı ile maliyet çarpılır (yaralı hayatta kalan tam değer saymaz).
function battleForecastTradeValue(birimlerA, birimlerB) {
    const f = battleForecastCombat(birimlerA, birimlerB);
    const deger = (birimler, kalanOran) => {
        let v = 0;
        for (const u of (birimler || [])) {
            const hp = Math.max(0, u.hp || 0);
            if (hp <= 0) continue;
            v += ((u.stats && u.stats.cost) || 0) * (hp / Math.max(1, u.maxHp || hp));
        }
        return v * kalanOran;
    };
    const benimKalan = deger(birimlerA, f.kalanOranA);
    const onunKalan = deger(birimlerB, f.kalanOranB);
    const benimBaslangic = deger(birimlerA, 1), onunBaslangic = deger(birimlerB, 1);
    return {
        ...f,
        benimKalan, onunKalan,
        benimKayip: benimBaslangic - benimKalan,
        onunKayip: onunBaslangic - onunKalan,
        netTakas: (onunBaslangic - onunKalan) - (benimBaslangic - benimKalan)   // + = kârlı kavga
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { battleForecastCombat, battleForecastTradeValue, forecastArmyAggregate, forecastDpsVs };
}
