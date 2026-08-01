// Quick, Story ve AI laboratuvarı için ortak deterministik ordu konuşlandırıcısı.
// Kompozisyon bütçeden saf manifest olarak üretilir; sahaya yerleştirme ayrı adımdır.

// 25-BİRİM ROSTER dağıtımı — 20 KARA tipi (5 hava tipi FAZ 2'ye kadar deploy-dışı: helikopterler + drone'lar).
// Birleşik-silah: piyade/AT/tank çekirdek, indirect/anti-air/support dengeli, pahalı (füze/HQ) düşük. ~5000 bütçeye ~20-28 birim.
const BATTLE_DEPLOY_WEIGHTS = Object.freeze({
    [T.INFANTRY]: 0.14, [T.ANTI_TANK]: 0.10, [T.MORTAR]: 0.05, [T.MANPADS]: 0.03, [T.COMMANDO]: 0.03,
    [T.ARMOR]: 0.10, [T.MECH_INFANTRY]: 0.08, [T.TANK_HUNTER]: 0.06,
    [T.ARTILLERY]: 0.06, [T.MLRS]: 0.03, [T.BALLISTIC]: 0.01, [T.COUNTER_BATTERY]: 0.02,
    [T.SPAAG]: 0.04, [T.SAM]: 0.03, [T.RECON]: 0.05, [T.EW]: 0.02,
    [T.MEDIC]: 0.03, [T.ENGINEER]: 0.035, [T.SUPPLY]: 0.03, [T.HQ]: 0.02,
    [T.TRANSPORT_HELO]: 0.02   // nakliye-heli: piyade takviyesini hatta taşır (bindir-indir)
});
// Muharebe-odaklı (hızlı maç/AI): çekirdek ateş gücü + FAZ 2 HAVA (helikopter/drone). Nakliye-heli FAZ3 (load-mekaniği).
const BATTLE_DEPLOY_COMBAT_WEIGHTS = Object.freeze({
    [T.INFANTRY]: 0.14, [T.ANTI_TANK]: 0.11, [T.MORTAR]: 0.04, [T.MANPADS]: 0.04, [T.COMMANDO]: 0.03,
    [T.ARMOR]: 0.10, [T.MECH_INFANTRY]: 0.07, [T.TANK_HUNTER]: 0.05,
    [T.ARTILLERY]: 0.05, [T.MLRS]: 0.025, [T.BALLISTIC]: 0.01, [T.COUNTER_BATTERY]: 0.015,
    [T.SPAAG]: 0.05, [T.SAM]: 0.025, [T.RECON]: 0.045, [T.EW]: 0.015,
    [T.MEDIC]: 0.02, [T.ENGINEER]: 0.03, [T.SUPPLY]: 0.03, [T.HQ]: 0.02,
    [T.ATTACK_HELO]: 0.025, [T.RECON_UAV]: 0.025, [T.UCAV]: 0.02, [T.KAMIKAZE]: 0.025,   // FAZ 2 hava
    [T.TRANSPORT_HELO]: 0.015   // nakliye-heli: piyade takviyesini hatta taşır
});

function deploymentCloneBudget(budget) {
    if (Number.isFinite(budget)) return { money: Math.max(0, Math.floor(budget)) };
    return {
        oil: Math.max(0, Math.floor(budget?.oil || 0)),
        manpower: Math.max(0, Math.floor(budget?.manpower || 0)),
        points: Math.max(0, Math.floor(budget?.points || 0))
    };
}

function deploymentBudgetGroup(type, budget) {
    return Object.prototype.hasOwnProperty.call(budget, 'money')
        ? 'money'
        : (UNIT_RES_GROUP[type] || 'manpower');
}

function deploymentManifestHash(counts) {
    let hash = 2166136261 >>> 0;
    const text = Object.keys(counts)
        .map(Number)
        .sort((a, b) => a - b)
        .map(type => `${type}:${counts[type]}`)
        .join('|');
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

// DIVERSE-SELFPLAY: eğitimde de varied ordu açmak için (gerçek oyun interactive ile açar; eğitim bunu set eder).
let BATTLE_FORCE_VARIED = false;
let BATTLE_FORCE_DOCTRINE = null;   // TURNUVA: geçerli indeks (0-8) ise o doktrini zorla (yalnız ölçüm/turnuva); null=seed'li rastgele

// TAKTİK-VEKİLİ (insan-gibi rakip): kullanıcının KAZANMA taktiklerini oynar → AI onu yenmeyi (=insanı) öğrenir.
// Taktik: KONSANTRASYON + ODAKLI-ATEŞ (2v1) — kendi kütlesini toplar, EN YAKIN düşmanı seçip HEPSİ ona yüklenir
// → yerel üstünlük kurup birer birer eritir (senin "sarma + iki-birlik-tek-birliğe" tarzın). Deterministik (RNG YOK).
let BATTLE_SURROGATE_SIDE = null;        // null=kapalı, true/false = o tarafı taktik-vekili sürer (kontrolör yerine)
let BATTLE_SURROGATE_DEFENSIVE = false;  // true → SAVUNAN-vekil (usta insan savunması): pozisyonda tut + konsantre karşı-ateş
let BATTLE_SURROGATE_ENVELOP = false;    // true → SALDIRAN-vekil KUŞATIR: ana kütle önden sabitler + hızlı kanat açık-yandan arkaya dolanır (senin sarma tarzın → anti-kuşatma headless ölçülebilir)
function battleTacticalSurrogateDrive(side) {
    const own = [], foe = [];
    for (const u of SIM.units) { if (u.dead) continue; (u.isRed === side ? own : foe).push(u); }
    if (!own.length || !foe.length) return;
    own.sort((a, b) => a.id - b.id); foe.sort((a, b) => a.id - b.id);
    // kendi kütle-merkezi → EN YAKIN düşmanı hedefle (konsantrasyon; birer birer erit — 2v1 yerel üstünlük)
    let cx = 0, cy = 0; for (const u of own) { cx += u.x; cy += u.y; } cx /= own.length; cy /= own.length;
    let target = foe[0], bestD = Infinity;
    for (const f of foe) { const d = (f.x - cx) * (f.x - cx) + (f.y - cy) * (f.y - cy); if (d < bestD) { bestD = d; target = f; } }
    if (BATTLE_SURROGATE_DEFENSIVE) {
        // SAVUNAN-vekil: savunma hattını (kendi objektifi) TUT, düşmana koşma; kütleyi topla, gelen en yakın
        // düşmana HEP BİRLİKTE odaklı-ateş (senin savunma tarzın: pozisyonu koru, üzerine geleni konsantre döv).
        const anchor = (typeof battleObjectiveForSide === 'function') ? battleObjectiveForSide(side) : { x: cx, y: cy };
        // savunma hattı: kendi kütle-merkezi ile çıpa arasında, çıpaya yakın (geri çekilme değil, tutma)
        const lineX = anchor.x, lineY = (anchor.y * 0.7 + cy * 0.3);
        own.forEach((u, i) => {
            if (u.type === T.MEDIC) return;
            u.attackTarget = target; u.manualTarget = target;   // konsantre karşı-ateş (menzile girince motor ateşler)
            const spread = (i - (own.length - 1) / 2) * 42;      // sıkı savunma hattı (konsantre)
            const d = terrainSafePoint(lineX + spread, lineY);
            u.targetX = d.x; u.targetY = d.y; u.manualMoveTarget = d; u.isMovingToManualTarget = true;
        });
        return;
    }
    // SALDIRAN-vekil KUŞATMA modu (senin tarzın): ana kütle ÖNDEN sabitler, hızlı kanat AÇIK-yandan ARKAYA dolanır
    // → savunanı arka+yan kıskaca alır (surroundedPct↑). Anti-kuşatma fix'ini headless ölçülebilir kılar. RNG YOK.
    if (BATTLE_SURROGATE_ENVELOP && own.length >= 4) {
        let ex = 0, ey = 0; for (const f of foe) { ex += f.x; ey += f.y; } ex /= foe.length; ey /= foe.length;
        const dax = ex - cx, day = ey - cy, dl = Math.hypot(dax, day) || 1, fux = dax / dl, fuy = day / dl, px = -fuy, py = fux;
        // AÇIK KANAT: düşmanın hangi yanında daha az birlik var → oraya dolan (deterministik, eşitte sol)
        let leftN = 0, rightN = 0;
        for (const f of foe) { const s = (f.x - ex) * px + (f.y - ey) * py; if (s < 0) leftN++; else rightN++; }
        const dir = (leftN <= rightN) ? -1 : 1;
        // KÜÇÜK hızlı müfreze = KANAT (arkaya sızar), ÇOĞUNLUK = SABİTLEYİCİ (önden güçlü yüklenir → front tehdit kalır).
        // Senin tarzın: "birkaç birliğimle arkasını dolanıyorum" → sadece 2-3 hızlı birlik ayrılır, ana kütle güçlü kalır.
        const mob = own.filter(u => u.type !== T.MEDIC).sort((a, b) => ((STATS[b.type] ? STATS[b.type].speed : 0) - (STATS[a.type] ? STATS[a.type].speed : 0)) || (a.id - b.id));
        const nFlank = Math.min(3, Math.max(2, Math.round(mob.length * 0.2)));
        const flankers = new Set(mob.slice(0, nFlank).map(u => u.id));
        // kanat ara-noktası: düşmanın YANINDAN geçip ARKASINA (fux ile ileri geçer, dir·px ile yana açılır); dar tut
        const wp = terrainSafePoint(ex + dir * px * 230 + fux * 240, ey + dir * py * 230 + fuy * 240);
        // en ARKADAKİ düşman (kanat onu hedef alır = gerçek kuşatma)
        let rearFoe = target, rearAlong = -Infinity;
        for (const f of foe) { const a = (f.x - cx) * fux + (f.y - cy) * fuy; if (a > rearAlong) { rearAlong = a; rearFoe = f; } }
        // SABİTLEYİCİLER kırmızıyı YANAL yay (sol→sağ farklı hedefler) → left+right varlık; küçük müfreze ARKA → tam kuşatma
        const foesByLat = foe.slice().sort((a, b) => (((a.x - ex) * px + (a.y - ey) * py) - ((b.x - ex) * px + (b.y - ey) * py)) || (a.id - b.id));
        const fixers = own.filter(u => u.type !== T.MEDIC && !flankers.has(u.id)).sort((a, b) => a.id - b.id);
        fixers.forEach((u, i) => {
            const tf = foesByLat[Math.floor(i * foesByLat.length / Math.max(1, fixers.length))] || target;
            u.attackTarget = tf; u.manualTarget = tf;
            u.targetX = tf.x; u.targetY = tf.y; u.manualMoveTarget = { x: tf.x, y: tf.y }; u.isMovingToManualTarget = true;
        });
        for (const u of own) {
            if (u.type === T.MEDIC || !flankers.has(u.id)) continue;
            if (Math.hypot(u.x - wp.x, u.y - wp.y) > 130) {   // henüz dolanmadı → ara-noktaya (ateş serbest)
                u.attackTarget = null; u.manualTarget = null;
                u.targetX = wp.x; u.targetY = wp.y; u.manualMoveTarget = { x: wp.x, y: wp.y }; u.isMovingToManualTarget = true;
            } else {                                          // arkaya vardı → en arkadaki düşmanı vur (sarma tamam)
                u.attackTarget = rearFoe; u.manualTarget = rearFoe;
                u.targetX = rearFoe.x; u.targetY = rearFoe.y; u.manualMoveTarget = { x: rearFoe.x, y: rearFoe.y }; u.isMovingToManualTarget = true;
            }
        }
        return;
    }
    // SALDIRAN-vekil (varsayılan): TÜM muharip birlikler hedefe konsantre yüklen + odaklı ateş
    for (const u of own) {
        if (u.type === T.MEDIC) continue;               // sağlıkçı geride
        u.attackTarget = target; u.manualTarget = target;
        u.targetX = target.x; u.targetY = target.y;
        u.manualMoveTarget = { x: target.x, y: target.y }; u.isMovingToManualTarget = true;
    }
}
// ORDU ÇEŞİTLİLİĞİ: her maça seed'li DOKTRİN + ince gürültü uygula → farklı ama DENGELİ ordu (öngörülemez).
// SIM_RNG (srand) kullanır → deterministik (aynı seed=aynı ordu, replay/eğitim bozulmaz) ama maç-maç farklı.
function battleDeploymentVariedWeights(base) {
    const w = {}; for (const k in base) w[k] = base[k];
    // 25-BİRİM ROSTER DOKTRİNLERİ — AI her maça FARKLI-ama-dengeli ordu dizer (öngörülemez; rakibe BAKMAZ = hile yok).
    const doctrines = [
        {},                                                                                                           // DENGELİ
        { [T.ARMOR]: 2.0, [T.TANK_HUNTER]: 1.5, [T.MECH_INFANTRY]: 1.3, [T.INFANTRY]: 0.6, [T.ARTILLERY]: 0.7 },       // ZIRH MIZRAĞI
        { [T.INFANTRY]: 2.2, [T.ANTI_TANK]: 1.6, [T.MORTAR]: 1.5, [T.COMMANDO]: 1.3, [T.ARMOR]: 0.5 },                 // PİYADE DALGASI
        { [T.ARTILLERY]: 1.9, [T.MLRS]: 1.7, [T.RECON]: 1.7, [T.ANTI_TANK]: 1.3, [T.COUNTER_BATTERY]: 1.4, [T.ARMOR]: 0.6 }, // TOPÇU DOKTRİNİ
        { [T.ATTACK_HELO]: 2.0, [T.KAMIKAZE]: 1.8, [T.UCAV]: 1.6, [T.RECON_UAV]: 1.5, [T.SPAAG]: 1.4, [T.SAM]: 1.3 },   // HAVA HAREKÂTI
        { [T.ANTI_TANK]: 2.0, [T.TANK_HUNTER]: 1.6, [T.COMMANDO]: 1.5, [T.MANPADS]: 1.3, [T.MORTAR]: 1.3, [T.ARMOR]: 0.5 }, // TANKSAVAR PUSU
        { [T.MECH_INFANTRY]: 1.9, [T.RECON]: 2.0, [T.ARMOR]: 1.3, [T.KAMIKAZE]: 1.4, [T.ARTILLERY]: 0.6 },             // HAREKETLİ VURKAÇ
        { [T.SPAAG]: 1.8, [T.SAM]: 1.7, [T.MANPADS]: 1.6, [T.COUNTER_BATTERY]: 1.5, [T.INFANTRY]: 1.2 },               // HAVA-SAVUNMA AĞI
        { [T.KAMIKAZE]: 3.0, [T.RECON_UAV]: 2.5, [T.EW]: 2.2, [T.ANTI_TANK]: 1.6, [T.MANPADS]: 1.3, [T.ARMOR]: 0.0, [T.TANK_HUNTER]: 0.0 }, // DRONE-YOĞUN YIPRATMA (Ukrayna-sonrası: ucuz kamikaze sürüsü + İHA ağı + EH, pahalı platform yok)
        { [T.MORTAR]: 2.2, [T.MLRS]: 1.8, [T.BALLISTIC]: 1.2, [T.RECON_UAV]: 2.0, [T.RECON]: 1.5, [T.COMMANDO]: 1.7, [T.ATTACK_HELO]: 1.5, [T.INFANTRY]: 1.3, [T.ANTI_TANK]: 1.2, [T.SPAAG]: 0.7 } // OYUNCU-META (kullanıcının 5-maç profili: alan-ateşi 3.2/maç + ağır-keşif 2.8 + helo, ateş-merkezli bul-vur-bitir)
    ];
    // TURNUVA: BATTLE_FORCE_DOCTRINE geçerli indeksse o doktrini zorla (RPS-turnuva taraf-başı doktrin kontrolü). Yoksa seed'li rastgele.
    const idx = (typeof BATTLE_FORCE_DOCTRINE === 'number' && BATTLE_FORCE_DOCTRINE >= 0)
        ? Math.min(doctrines.length - 1, BATTLE_FORCE_DOCTRINE)
        : ((typeof srandInt === 'function') ? srandInt(doctrines.length) : 0);
    const d = doctrines[idx];
    for (const k in d) w[k] = (w[k] || 0) * d[k];
    const rnd = (typeof srand === 'function') ? srand : Math.random;
    for (const k in w) w[k] = w[k] * (0.78 + rnd() * 0.44);   // ±22% ince gürültü
    Object.defineProperty(w, '__doctrineId', { value: idx, enumerable: false });   // DOKTRİN-KİMLİK: seçilen doktrini taşı (for-in görmesin)
    // DOKTRİN-İMZASI: çarpanı ≥1.4 olan tipler = bu doktrinin karakteristik birimleri (çarpan azalanı → en-imzalı önce).
    // battleBuildArmyManifest bunları GARANTİ eder (pahalı-birim yapısal-dışlanmasını kırar). Deterministik.
    const emphasis = Object.keys(d).map(Number).filter(t => d[t] >= 1.4).sort((a, b) => (d[b] - d[a]) || (a - b));
    Object.defineProperty(w, '__emphasis', { value: emphasis, enumerable: false });
    return w;
}
// Doktrin kimlikleri (indeks battleDeploymentVariedWeights.doctrines ile HİZALI) — kimlik+posture-eşleştirme için.
const BATTLE_DOCTRINE_NAMES = ['dengeli', 'zirh-mizragi', 'piyade-dalgasi', 'topcu', 'hava-harekati', 'tanksavar-pusu', 'hareketli-vurkac', 'hava-savunma-agi', 'drone-yogun', 'oyuncu-meta'];
const BATTLE_DOCTRINE_PLAYER_META = 9;   // vekil-tuning: kullanıcının gerçek oynayış-profili (5-maç analizi) — bataryada mavi-vekil bunu kullanır

function battleBuildArmyManifest(rawBudget, config = {}) {
    const remaining = deploymentCloneBudget(rawBudget);
    const initial = { ...remaining };
    const types = [];
    const spent = {};
    const maxUnits = Math.max(1, config.maxUnits | 0 || 48);
    const baseWeights = config.combatFocused === true
        ? BATTLE_DEPLOY_COMBAT_WEIGHTS
        : BATTLE_DEPLOY_WEIGHTS;
    // ÇEŞİTLİLİK: config.varied ise her maça seed'li doktrin (farklı ama dengeli ordu → öngörülemez)
    const deployWeights = config.varied ? battleDeploymentVariedWeights(baseWeights) : baseWeights;
    const allowedTypes = Object.keys(deployWeights).map(Number)
        .filter(type => STATS[type] && config.excludeTypes?.includes(type) !== true)
        .sort((a, b) => a - b);

    while (types.length < maxUnits) {
        const affordable = allowedTypes.filter(type => {
            const group = deploymentBudgetGroup(type, remaining);
            return (remaining[group] || 0) >= STATS[type].cost;
        });
        if (!affordable.length) break;

        const choice = affordable.map(type => {
            const group = deploymentBudgetGroup(type, remaining);
            const peers = allowedTypes.filter(candidate =>
                deploymentBudgetGroup(candidate, remaining) === group
            );
            const weightTotal = peers.reduce((sum, candidate) =>
                sum + deployWeights[candidate], 0) || 1;
            const target = (initial[group] || 0) *
                (deployWeights[type] / weightTotal);
            return {
                type,
                deficit: target - (spent[type] || 0),
                normalizedDeficit: (target - (spent[type] || 0)) /
                    Math.max(1, STATS[type].cost)
            };
        }).sort((a, b) =>
            (b.normalizedDeficit - a.normalizedDeficit) ||
            (b.deficit - a.deficit) ||
            a.type - b.type
        )[0];

        const type = choice.type;
        const group = deploymentBudgetGroup(type, remaining);
        remaining[group] -= STATS[type].cost;
        spent[type] = (spent[type] || 0) + STATS[type].cost;
        types.push(type);
    }

    // ANALİST-FIX (kompozisyon-önyargısı, 7-maç-sıfır-helo): normalizedDeficit=hedef/maliyet metriği, hedef-payı birim-maliyetinden
    // KÜÇÜK olan PAHALI birimi (helo 800, ÇNRA 650, SİHA, EW...) YAPISAL DIŞLAR → doktrin "hava-harekâtı" bile helo alamaz.
    // ÇÖZÜM: doktrinin İMZA birimleri (çarpan≥1.4) hiç alınmadıysa BİRER tane garanti et — gerekirse en-çok-tekrarlanan
    // imza-DIŞI ucuz fazlalığı takas ederek. Doktrin kimliği artık sahaya çıkar (Ukrayna-sonrası: helo uçmayı ÖĞRENDİ →
    // SEAD-bekle+RTB micro hazır, açmak güvenli). Yalnız sayı-bütçe (money) yolunda; deterministik (RNG yok).
    const emphasis = (config.varied && Array.isArray(deployWeights.__emphasis)) ? deployWeights.__emphasis : [];
    if (emphasis.length && Object.prototype.hasOwnProperty.call(remaining, 'money')) {
        for (const et of emphasis) {
            if (et == null || !STATS[et] || types.includes(et)) continue;
            const cost = STATS[et].cost;
            if (cost > (initial.money || 0)) continue;   // bütçeye hiç sığmıyorsa geç
            let guard = 0;
            while ((remaining.money || 0) < cost && guard++ < 8) {   // yer aç: en-çok-tekrarlanan imza-DIŞI ucuz fazlalığı çıkar
                const cnt = {}; for (const t of types) cnt[t] = (cnt[t] || 0) + 1;
                let victim = null, vCount = 1;
                for (const t of Object.keys(cnt).map(Number).sort((a, b) => a - b)) {
                    if (emphasis.includes(t) || t === et) continue;
                    if (cnt[t] > vCount || (cnt[t] === vCount && victim != null && STATS[t].cost < STATS[victim].cost)) { victim = t; vCount = cnt[t]; }
                }
                if (victim == null) break;
                const ix = types.lastIndexOf(victim); if (ix < 0) break;
                remaining.money += STATS[victim].cost; spent[victim] = (spent[victim] || 0) - STATS[victim].cost; if (spent[victim] <= 0) delete spent[victim];
                types.splice(ix, 1);
            }
            if ((remaining.money || 0) >= cost) { remaining.money -= cost; spent[et] = (spent[et] || 0) + cost; types.push(et); }
        }
    }
    // ANALİST-FIX (SAM-tabanı): hava-savunma paketi manpads+spaag ile YETİNEMEZ — helo maks-menzil düellosunda
    // spaag'ı yener (falloff), tek gerçek caydırıcı SAM. AA yatırımı varken SAM yoksa bir AA-birimini SAM ile değiştir.
    if (typeof T !== 'undefined' && T.SAM != null && STATS[T.SAM] && !types.includes(T.SAM)) {
        let aaIdx = types.indexOf(T.SPAAG);
        if (aaIdx < 0 && T.MANPADS != null) aaIdx = types.indexOf(T.MANPADS);
        if (aaIdx >= 0) { spent[types[aaIdx]] = (spent[types[aaIdx]] || 0) - STATS[types[aaIdx]].cost; types[aaIdx] = T.SAM; spent[T.SAM] = (spent[T.SAM] || 0) + STATS[T.SAM].cost; }
    }
    // ANALİST-FIX (kör-SAM): SAM RADARSIZ kördür (yalnız 900px görüşü; helo dışarıdan vurup öldürür). SAM varsa RADAR da al
    // (350₺ radar = 700₺ SAM'ın gözü). Radar yoksa ikinci-AA/ikmal/en-ucuz-fazlalığı radar ile değiştir.
    if (typeof T !== 'undefined' && T.COUNTER_BATTERY != null && STATS[T.COUNTER_BATTERY] && types.includes(T.SAM) && !types.includes(T.COUNTER_BATTERY)) {
        let swapIdx = -1;   // önce ikinci-AA (spaag/manpads), sonra supply, sonra en-çok-tekrar-eden savaş-dışı
        for (const cand of [T.SPAAG, T.MANPADS, T.SUPPLY]) { if (cand != null) { const ix = types.lastIndexOf(cand); if (ix >= 0 && (cand !== T.SAM)) { swapIdx = ix; break; } } }
        if (swapIdx >= 0) { spent[types[swapIdx]] = (spent[types[swapIdx]] || 0) - STATS[types[swapIdx]].cost; types[swapIdx] = T.COUNTER_BATTERY; spent[T.COUNTER_BATTERY] = (spent[T.COUNTER_BATTERY] || 0) + STATS[T.COUNTER_BATTERY].cost; }
    }
    const counts = types.reduce((result, type) => {
        result[type] = (result[type] || 0) + 1;
        return result;
    }, {});
    return {
        types,
        counts,
        totalUnits: types.length,
        totalValue: types.reduce((sum, type) => sum + STATS[type].cost, 0),
        initialBudget: initial,
        remaining,
        doctrineId: (config.varied && typeof deployWeights.__doctrineId === 'number') ? deployWeights.__doctrineId : 0,   // DOKTRİN-KİMLİK (0=dengeli)
        hash: deploymentManifestHash(counts)
    };
}

function deploymentDepth(type) {
    if (type === T.ARTILLERY) return 0;
    if (type === T.ENGINEER || type === T.MEDIC) return 1;
    if (type === T.ANTI_TANK) return 2;
    if (type === T.RECON) return 4;
    return 3;
}

function deploymentSpotFree(point, occupied) {
    return occupied.every(other => Math.hypot(point.x - other.x, point.y - other.y) >= 48);
}

function deploymentFindSpot(side, type, indexInDepth, occupied, totalInDepth) {
    const depth = deploymentDepth(type);
    const forwardY = 180 + depth * 78;
    const desiredY = side ? forwardY : WORLD_H - forwardY;
    // ANALİST-FIX (anti-yumak): birimleri merkez-±525px yerine CEPHEYE (0.15W–0.85W) eşit-yay → savunma hattı,
    // alan-ateşine (ÇNRA/havan) tek-nokta mezar sunmaz. Rol-bazlı derinlik (y) korunur; yalnız x genişler. Deterministik (indeks-tabanlı).
    const MAX_COLS = 13;
    const cols = Math.max(1, Math.min(MAX_COLS, totalInDepth || 11));
    const column = indexInDepth % cols;
    const row = Math.floor(indexInDepth / cols);
    const spacing = cols > 1 ? (WORLD_W * 0.70) / (cols - 1) : 0;
    const desiredX = cols > 1 ? (WORLD_W * 0.15 + column * spacing) : (WORLD_W * 0.5);
    const rowY = desiredY + (side ? row * 58 : -row * 58);
    const first = typeof nearestPassable === 'function'
        ? nearestPassable(desiredX, rowY, 30)
        : { x: desiredX, y: rowY };
    if (deploymentSpotFree(first, occupied)) return first;

    for (let ring = 1; ring <= 12; ring++) {
        for (const xSign of [-1, 1]) {
            const candidate = {
                x: desiredX + xSign * ring * 55,
                y: rowY + (side ? ring * 18 : -ring * 18)
            };
            const safe = typeof nearestPassable === 'function'
                ? nearestPassable(candidate.x, candidate.y, 30)
                : candidate;
            if (safe.x >= UNIT_RADIUS && safe.x <= WORLD_W - UNIT_RADIUS &&
                safe.y >= UNIT_RADIUS && safe.y <= WORLD_H - UNIT_RADIUS &&
                deploymentSpotFree(safe, occupied)) return safe;
        }
    }
    return first;
}

function battleDeployManifest(manifest, side, config = {}) {
    if (!manifest?.types?.length) return { units: [], manifest: replayClone(manifest) };
    const occupied = SIM.units.filter(unit => !unit.dead).map(unit => ({ x: unit.x, y: unit.y }));
    const depthCounts = {};
    const deployed = [];
    const orderedTypes = manifest.types.slice().sort((a, b) =>
        (deploymentDepth(a) - deploymentDepth(b)) || a - b
    );
    const depthTotals = {};   // ANALİST-FIX (anti-yumak): derinlik-başı toplam → birimleri CEPHEYE eşit-yay
    for (const t of orderedTypes) { const d = deploymentDepth(t); depthTotals[d] = (depthTotals[d] || 0) + 1; }
    for (const type of orderedTypes) {
        const depth = deploymentDepth(type);
        const index = depthCounts[depth] || 0;
        depthCounts[depth] = index + 1;
        const spot = deploymentFindSpot(side, type, index, occupied, depthTotals[depth]);
        const unit = new Unit(type, spot.x, spot.y, side);
        unit.ally = side ? false : config.ally === true;
        unit.controlOwner = side
            ? CONTROL_OWNER.ENEMY_AI
            : unit.ally ? CONTROL_OWNER.ALLY_AI : CONTROL_OWNER.PLAYER;
        unit.deploymentSource = config.source || 'battle-deployer';
        unit.deployDoctrine = (typeof manifest.doctrineId === 'number') ? manifest.doctrineId : 0;   // DOKTRİN-KİMLİK: birim doktrinini taşır (situation/posture okur, per-side)
        if (typeof applyTechSpawnBonus === 'function') applyTechSpawnBonus(unit);
        SIM.units.push(unit);
        occupied.push({ x: unit.x, y: unit.y });
        deployed.push(unit);
    }
    // ANALİST-FIX (SAM konuşlanma-geometrisi): SAM hava-hedefini kendi 900px görüşü DIŞINDA ancak bir dost-sensör
    // ifşa ederse angaje eder (canSee). Radar(hava-arama 2000px) ile SAM(menzil 1650) bağımsız serpiştirilince balonlar
    // örtüşmez → helo radar-balonu kıyısını traşlayarak SAM menzilinde AMA görülmeden uçar (analistin geometri-teşhisi).
    // ÇÖZÜM: radarı en yakın SAM'ın hemen ARKASINA (~250px, kendi üssüne doğru) taşı → 2000-balon SAM'ın tüm 1650-zarfını
    // her yönde örter, radar da SAM kalkanının gerisinde güvende. Deterministik (serpiştirme sırası, RNG yok).
    if (typeof T !== 'undefined' && T.SAM != null) {
        const sams = deployed.filter(u => !u.dead && u.type === T.SAM);
        const radars = deployed.filter(u => !u.dead && ((STATS[u.type] && STATS[u.type].airRadar) || u.airRadar));
        if (sams.length && radars.length) {
            const fwd = side ? 1 : -1;   // düşmana doğru: kırmızı üssü üstte(+y), mavi altta(-y)
            for (const radar of radars) {
                let best = null, bestD = Infinity;
                for (const s of sams) { const d = Math.hypot(radar.x - s.x, radar.y - s.y); if (d < bestD) { bestD = d; best = s; } }
                if (!best) continue;
                let ty = best.y - fwd * 250;   // SAM'ın ARKASI (üsse doğru): radar güvende, 2000-balon 1650-zarfı örter
                ty = side ? Math.max(WORLD_H * 0.06, Math.min(WORLD_H * 0.5 - 30, ty))    // kırmızı: kendi üst-yarısında kal
                          : Math.min(WORLD_H * 0.94, Math.max(WORLD_H * 0.5 + 30, ty));   // mavi: kendi alt-yarısında kal
                const spot = (typeof nearestPassable === 'function') ? nearestPassable(best.x, ty, 30) : { x: best.x, y: ty };
                radar.x = spot.x; radar.y = spot.y; radar.targetX = spot.x; radar.targetY = spot.y;
                if (radar.manualMoveTarget) radar.manualMoveTarget = { x: spot.x, y: spot.y };
            }
        }
    }
    if (side) enemy.unitsSpawned += deployed.length;
    else player.unitsSpawned += deployed.length;
    if (typeof battleControllersSyncOwnership === 'function') battleControllersSyncOwnership();
    return {
        units: deployed,
        manifest: replayClone(manifest),
        side: side === true,
        value: manifest.totalValue,
        hash: manifest.hash
    };
}

function battleSessionEnemyBudget() {
    if (typeof DEPLOY_RES !== 'undefined' && DEPLOY_RES?.red) {
        return { ...DEPLOY_RES.red };
    }
    return Math.max(0, enemy.money || 0);
}

function battleConsumeEnemyManifest(manifest) {
    if (typeof DEPLOY_RES !== 'undefined' && DEPLOY_RES?.red &&
        !Object.prototype.hasOwnProperty.call(manifest.remaining, 'money')) {
        DEPLOY_RES.red = { ...manifest.remaining };
        enemy.money = Object.values(manifest.remaining)
            .reduce((sum, value) => sum + value, 0);
    } else {
        enemy.money = manifest.remaining.money || 0;
    }
}

function battleAutoDeploySession(config = {}) {
    if (config.autoDeployAI === false) return null;
    if (!['quick', 'story'].includes(config.mode)) return null;
    if (SIM.units.some(unit => !unit.dead && unit.isRed)) return null;
    const manifest = battleBuildArmyManifest(battleSessionEnemyBudget(), {
        maxUnits: config.aiMaxUnits || 48,
        combatFocused: config.mode === 'quick',
        // ÇEŞİTLİLİK: gerçek oyunda (interactive) kırmızı AI her maça farklı-ama-dengeli ordu dizsin
        // (öngörülemez olsun). DIVERSE-SELFPLAY eğitiminde de BATTLE_FORCE_VARIED ile açılır → model
        // çeşitli ordular komuta etmeyi öğrenir (gerçek oyundaki varied dağılımıyla uyumlu).
        varied: (typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.interactive === true) || BATTLE_FORCE_VARIED === true
    });
    battleConsumeEnemyManifest(manifest);
    const deployed = battleDeployManifest(manifest, true, {
        source: `${config.mode}-enemy-ai`
    });
    BATTLE_SESSION.aiDeployment = {
        side: true,
        unitCount: deployed.units.length,
        value: manifest.totalValue,
        manifestHash: manifest.hash
    };
    return deployed;
}

function openAIVsAILab(config = {}) {
    const budget = Math.max(300, Number(config.budget) || 1500);
    const hasPlayerSurrogate = config.playerSurrogateSide === true ||
        config.playerSurrogateSide === false;
    const sessionConfig = {
        mode: 'ai-lab',
        mapId: Number.isFinite(config.mapId) ? config.mapId : -2,
        seed: Number.isFinite(config.seed) ? config.seed : 515151,
        attackerSide: config.attackerSide === true,
        durationSec: Number.isFinite(config.durationSec) ? config.durationSec : 240,
        playerMoney: 0,
        enemyMoney: 0,
        deployRes: null,
        deployPool: null,
        techBonus: null,
        techBonusRed: null,
        autoDeployAI: false,
        show: config.show === true
    };
    if (hasPlayerSurrogate) {
        sessionConfig.controllers = battleDefaultControllerConfigs({ mode: 'ai-lab' })
            .filter(controller => controller.side !== config.playerSurrogateSide);
    }
    openBattlefieldSession(sessionConfig);
    const manifest = battleBuildArmyManifest(budget, {
        maxUnits: config.maxUnits || 48,
        combatFocused: true
    });
    const blue = battleDeployManifest(manifest, false, {
        ally: true,
        source: 'ai-lab-blue'
    });
    const red = battleDeployManifest(manifest, true, {
        source: 'ai-lab-red'
    });
    if (hasPlayerSurrogate) {
        const surrogateUnits = config.playerSurrogateSide ? red.units : blue.units;
        for (const unit of surrogateUnits) {
            unit.ally = false;
            unit.controlOwner = CONTROL_OWNER.PLAYER;
            unit.controllerId = null;
        }
        if (typeof battleControllersSyncOwnership === 'function') {
            battleControllersSyncOwnership();
        }
    }
    BATTLE_SESSION.aiLab = {
        budget,
        blueHash: blue.hash,
        redHash: red.hash,
        equalManifest: blue.hash === red.hash,
        unitCountPerSide: manifest.totalUnits,
        valuePerSide: manifest.totalValue,
        playerSurrogateSide: hasPlayerSurrogate ? config.playerSurrogateSide : null,
        scriptedAdvance: config.scriptedAdvance === true
    };
    if (config.start !== false && typeof startBattle === 'function') startBattle();
    return {
        session: replayClone(BATTLE_SESSION),
        manifest: replayClone(manifest),
        blue,
        red
    };
}

function deploymentForbiddenCell(type) {
    if (!terrainGrid) return null;
    for (let gy = 0; gy < GRID_H; gy++) {
        for (let gx = 0; gx < GRID_W; gx++) {
            if (terrainGrid[gy * GRID_W + gx] !== type) continue;
            if (type === TERRAIN.WATER && isBridgeCell(gx, gy)) continue;
            return {
                x: (gx + 0.5) * CELL_W,
                y: (gy + 0.5) * CELL_H
            };
        }
    }
    return null;
}

function runTerrainHardBlockDiagnostics() {
    openBattlefieldSession({
        mode: 'terrain-hard-block-lab',
        mapId: -2,
        seed: 717171,
        attackerSide: false,
        durationSec: 30,
        playerMoney: 0,
        enemyMoney: 0,
        deployRes: null,
        deployPool: null,
        autoDeployAI: false,
        show: false
    });
    const water = deploymentForbiddenCell(TERRAIN.WATER);
    const mountain = deploymentForbiddenCell(TERRAIN.MOUNTAIN);
    if (!water || !mountain) {
        return { available: false, water: !!water, mountain: !!mountain };
    }

    const rawSpawn = new Unit(T.INFANTRY, water.x, water.y, false);
    rawSpawn.controlOwner = CONTROL_OWNER.PLAYER;
    rawSpawn.controllerId = null;
    SIM.units.push(rawSpawn);
    const spawnProtected = isPassableAt(rawSpawn.x, rawSpawn.y);
    startBattle();

    const requested = [];
    const violations = [];
    for (const test of [
        { kind: 'water', point: water },
        { kind: 'mountain', point: mountain }
    ]) {
        applyBattleOrder({
            kind: BATTLE_ORDER_KIND.MOVE,
            unitIds: [rawSpawn.id],
            destinations: [{ id: rawSpawn.id, x: test.point.x, y: test.point.y }],
            reason: `TERRAIN_HARD_BLOCK:${test.kind}`
        });
        requested.push({
            kind: test.kind,
            requestedPassable: isPassableAt(test.point.x, test.point.y),
            sanitizedPassable: isPassableAt(rawSpawn.targetX, rawSpawn.targetY),
            targetChanged: Math.hypot(
                rawSpawn.targetX - test.point.x,
                rawSpawn.targetY - test.point.y
            ) > 1
        });
        for (let tick = 0; tick < 120; tick++) {
            simulationTime += BATTLE_TICK_MS;
            gameTime += BATTLE_TICK_SEC;
            stepSim(simulationTime, BATTLE_TICK_SEC, null, false);
            if (!isPassableAt(rawSpawn.x, rawSpawn.y)) {
                violations.push({ kind: test.kind, tick, x: rawSpawn.x, y: rawSpawn.y });
            }
        }
    }
    return {
        available: true,
        spawnProtected,
        requested,
        violations,
        passed: spawnProtected &&
            violations.length === 0 &&
            requested.every(test =>
                test.requestedPassable === false &&
                test.sanitizedPassable === true &&
                test.targetChanged === true
            )
    };
}

function runAIVsAILabDiagnostics(config = {}) {
    const durationSec = Number.isFinite(config.durationSec) ? config.durationSec : 240;
    const lab = openAIVsAILab({
        ...config,
        durationSec,
        start: true,
        show: false
    });
    const surrogateSide = config.playerSurrogateSide === true
        ? true
        : config.playerSurrogateSide === false ? false : null;
    if (surrogateSide !== null && config.scriptedAdvance === true) {
        const objective = battleObjectiveForSide(surrogateSide);
        for (const unit of SIM.units) {
            if (unit.dead || unit.isRed !== surrogateSide) continue;
            const destination = terrainSafePoint(unit.x, objective.y);
            unit.targetX = destination.x;
            unit.targetY = destination.y;
            unit.manualMoveTarget = destination;
            unit.isMovingToManualTarget = true;
            unit.manualTarget = null;
        }
    }
    // KANAT VEKİLİ: manevra yapan bir insan gibi önce kanada açıl, sonra düşmanın yanına/arkasına
    // yüklen. Deterministik (RNG yok). Düz-hat vekili AI'nın kanat zaafını yakalamıyordu; bu senaryo
    // yakalar. Emirler döngü içinde periyodik yeniden verilir (aşağıda driveFlankSurrogate).
    const flankManeuver = surrogateSide !== null && config.surrogateManeuver === 'flank';
    const flankStageX = WORLD_W * 0.14;   // sol kanat sahnesi (deterministik)
    const driveFlankSurrogate = (t, maxT) => {
        const own = [], foe = [];
        for (const u of SIM.units) { if (u.dead) continue; (u.isRed === surrogateSide ? own : foe).push(u); }
        if (!own.length || !foe.length) return;
        let ex = 0, ey = 0; for (const u of foe) { ex += u.x; ey += u.y; } ex /= foe.length; ey /= foe.length;
        let oy = 0; for (const u of own) oy += u.y; oy /= own.length;
        const frac = maxT ? t / maxT : 0;
        own.sort((a, b) => a.id - b.id);
        own.forEach((u, i) => {
            const spread = (i - (own.length - 1) / 2) * 46;
            let tx, ty;
            if (frac < 0.35) { tx = flankStageX; ty = (oy + ey) / 2 + spread; }   // faz1: kanada açıl
            else { tx = ex - WORLD_W * 0.10; ty = ey + spread; }                   // faz2: batı kanadından düşmana yüklen
            const d = terrainSafePoint(tx, ty);
            u.targetX = d.x; u.targetY = d.y; u.manualMoveTarget = d; u.isMovingToManualTarget = true; u.manualTarget = null;
        });
    };
    const initialHp = {
        blue: lab.blue.units.reduce((sum, unit) => sum + unit.maxHp, 0),
        red: lab.red.units.reduce((sum, unit) => sum + unit.maxHp, 0)
    };
    const trackers = new Map();
    const terrainViolationIds = new Set();
    const stuckUnitIds = new Set();
    const blockedStuckUnitIds = new Set();
    const navFailureUnitIds = new Set();
    const navigationStuckUnitIds = new Set();
    const stuckDetails = new Map();
    let maxStuckTicks = 0;
    let minimumFriendlyDistance = Infinity;
    let maxFriendlyOverlapPairs = 0;
    let contactEver = false;
    let ticks = 0;
    const maxTicks = Math.ceil(durationSec / BATTLE_TICK_SEC);
    const previousHeadless = SIM.headless;
    SIM.headless = true;
    try {
        for (; ticks < maxTicks && phase === PHASE.BATTLE; ticks++) {
            if (flankManeuver && (ticks % 20) === 0) driveFlankSurrogate(ticks, maxTicks);
            simulationTime += BATTLE_TICK_MS;
            gameTime += BATTLE_TICK_SEC;
            stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false);
            updateSupport(BATTLE_TICK_SEC, simulationTime);
            contactEver = contactEver ||
                [...BATTLE_CONTROLLERS.values()].some(controller =>
                    (controller.lastObservation?.contacts?.length || 0) > 0
                );

            if ((SIM.tick % 20) === 0) {
                for (const unit of SIM.units) {
                    if (unit.dead) continue;
                    if (typeof isPassableAt === 'function' && !isPassableAt(unit.x, unit.y)) {
                        terrainViolationIds.add(unit.id);
                    }
                    const previous = trackers.get(unit.id);
                    const targetDistance = Math.hypot(
                        (unit.targetX ?? unit.x) - unit.x,
                        (unit.targetY ?? unit.y) - unit.y
                    );
                    const moved = previous
                        ? Math.hypot(unit.x - previous.x, unit.y - previous.y)
                        : Infinity;
                    let stuckTicks = previous?.stuckTicks || 0;
                    // Ağır bastırılmış birlik bilinçli olarak yavaşlar; bunu rota
                    // kilidi diye raporlamak gerçek takılmaları gürültüye boğuyordu.
                    const tacticallyPinned = (unit.suppression || 0) > 50;
                    if (targetDistance > 120 && moved < 7 && !tacticallyPinned) stuckTicks += 20;
                    else stuckTicks = 0;
                    maxStuckTicks = Math.max(maxStuckTicks, stuckTicks);
                    if (stuckTicks >= 100) {
                        stuckUnitIds.add(unit.id);
                        const blocked = typeof pathBlockedBetween === 'function' &&
                            pathBlockedBetween(
                                unit.x,
                                unit.y,
                                unit.targetX,
                                unit.targetY
                            );
                        if (blocked) {
                            blockedStuckUnitIds.add(unit.id);
                            if (!unit._navPath || !unit._navPath.length) {
                                navFailureUnitIds.add(unit.id);
                            }
                            const engaged = unit.enemyInVision ||
                                (unit.attackTarget && !unit.attackTarget.dead) ||
                                (unit.manualTarget && !unit.manualTarget.dead);
                            if (!engaged && !unit.isFleeing &&
                                unit.combatState === 'READY') {
                                navigationStuckUnitIds.add(unit.id);
                            }
                        }
                        const controller = BATTLE_CONTROLLERS.get(unit.controllerId);
                        const contract = controller?.operationalPlan?.taskContracts?.find(item =>
                            (item.unitIds || []).includes(unit.id)
                        );
                        const waypoint = unit._navPath?.[
                            Math.min(unit._navIdx || 0, Math.max(0, unit._navPath.length - 1))
                        ] || null;
                        const existing = stuckDetails.get(unit.id);
                        if (!existing || stuckTicks >= existing.stuckTicks) {
                            stuckDetails.set(unit.id, {
                                id: unit.id,
                                side: unit.isRed ? 'red' : 'blue',
                                type: STATS[unit.type]?.name || String(unit.type),
                                controllerId: unit.controllerId,
                                role: contract?.groupRole || null,
                                task: contract?.task || null,
                                combatState: unit.combatState || null,
                                suppression: executionRound(unit.suppression || 0),
                                movementSpeed: executionRound(unit.speed || 0),
                                pinned: (unit.suppression || 0) > PINNED_SUPPRESSION,
                                x: executionRound(unit.x),
                                y: executionRound(unit.y),
                                targetX: executionRound(unit.targetX ?? unit.x),
                                targetY: executionRound(unit.targetY ?? unit.y),
                                targetDistance: executionRound(targetDistance),
                                terrain: typeof terrainTypeAt === 'function'
                                    ? terrainTypeAt(unit.x, unit.y)
                                    : null,
                                blocked,
                                navPathLength: unit._navPath?.length || 0,
                                navIndex: unit._navIdx || 0,
                                waypoint: waypoint ? {
                                    x: executionRound(waypoint.x),
                                    y: executionRound(waypoint.y)
                                } : null,
                                stuckTicks
                            });
                        }
                    }
                    trackers.set(unit.id, {
                        x: unit.x,
                        y: unit.y,
                        stuckTicks
                    });
                }
                const alive = SIM.units.filter(unit => !unit.dead);
                let overlapPairs = 0;
                for (let i = 0; i < alive.length; i++) {
                    for (let j = i + 1; j < alive.length; j++) {
                        if (alive[i].isRed !== alive[j].isRed) continue;
                        const distance = Math.hypot(
                            alive[i].x - alive[j].x,
                            alive[i].y - alive[j].y
                        );
                        minimumFriendlyDistance = Math.min(minimumFriendlyDistance, distance);
                        if (distance < UNIT_RADIUS * 0.75) overlapPairs++;
                    }
                }
                maxFriendlyOverlapPairs = Math.max(maxFriendlyOverlapPairs, overlapPairs);
            }
            if (SIM.battle && SIM.battle.winnerSide !== null) break;
        }
    } finally {
        SIM.headless = previousHeadless;
    }

    const orderEvents = BATTLE_REPLAY.events.filter(event =>
        event.type === 'controller-order'
    );
    const blueUnits = SIM.units.filter(unit => !unit.isRed);
    const redUnits = SIM.units.filter(unit => unit.isRed);
    const positionSummary = units => {
        const alive = units.filter(unit => !unit.dead);
        if (!alive.length) return null;
        return {
            minX: executionRound(Math.min(...alive.map(unit => unit.x))),
            maxX: executionRound(Math.max(...alive.map(unit => unit.x))),
            minY: executionRound(Math.min(...alive.map(unit => unit.y))),
            maxY: executionRound(Math.max(...alive.map(unit => unit.y))),
            avgX: executionRound(
                alive.reduce((sum, unit) => sum + unit.x, 0) / alive.length
            ),
            avgY: executionRound(
                alive.reduce((sum, unit) => sum + unit.y, 0) / alive.length
            )
        };
    };
    const minOpposingDistance = (() => {
        const blueAlive = blueUnits.filter(unit => !unit.dead);
        const redAlive = redUnits.filter(unit => !unit.dead);
        let distance = Infinity;
        for (const blueUnit of blueAlive) {
            for (const redUnit of redAlive) {
                distance = Math.min(distance, Math.hypot(
                    blueUnit.x - redUnit.x,
                    blueUnit.y - redUnit.y
                ));
            }
        }
        return Number.isFinite(distance) ? executionRound(distance) : null;
    })();
    const operationHistoryFor = controllerId =>
        (BATTLE_CONTROLLERS.get(controllerId)?.taskExecutor?.operationHistory || [])
            .map(entry => ({
                tick: entry.tick,
                seconds: executionRound(entry.tick * BATTLE_TICK_SEC),
                previous: entry.previous,
                current: entry.current,
                reason: entry.reason
            }));
    const winnerSide = SIM.battle?.winnerSide ?? null;
    const attackerSide = config.attackerSide === true;
    return {
        attackerSide,
        attackerColor: attackerSide ? 'red' : 'blue',
        winnerSide,
        winnerColor: winnerSide == null ? null : winnerSide ? 'red' : 'blue',
        winnerRole: winnerSide == null ? null :
            winnerSide === attackerSide ? 'attacker' : 'defender',
        outcomeReason: SIM.battle?.outcomeReason || null,
        equalManifest: lab.session.aiLab.equalManifest,
        blueHash: lab.session.aiLab.blueHash,
        redHash: lab.session.aiLab.redHash,
        unitsPerSide: lab.session.aiLab.unitCountPerSide,
        valuePerSide: lab.session.aiLab.valuePerSide,
        ticks,
        durationSeconds: Math.round((SIM.battle?.elapsedSec || 0) * 100) / 100,
        contactEver,
        controllerOrderEvents: orderEvents.length,
        ordersPerSecond: executionRound(
            orderEvents.length / Math.max(1, SIM.battle?.elapsedSec || 0)
        ),
        blueOrdered: orderEvents.some(event =>
            event.payload.issuedBy === 'battle-blue-ally-ai'
        ),
        redOrdered: orderEvents.some(event =>
            event.payload.issuedBy === 'battle-red-ai'
        ),
        blueDamageReceived: Math.round((
            initialHp.blue -
            blueUnits.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0)
        ) * 100) / 100,
        redDamageReceived: Math.round((
            initialHp.red -
            redUnits.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0)
        ) * 100) / 100,
        blueSurvivors: blueUnits.filter(unit => !unit.dead).length,
        redSurvivors: redUnits.filter(unit => !unit.dead).length,
        bluePosition: positionSummary(blueUnits),
        redPosition: positionSummary(redUnits),
        minOpposingDistance,
        minimumFriendlyDistance: Number.isFinite(minimumFriendlyDistance)
            ? executionRound(minimumFriendlyDistance)
            : null,
        maxFriendlyOverlapPairs,
        terrainViolationIds: [...terrainViolationIds].sort((a, b) => a - b),
        stuckUnitIds: [...stuckUnitIds].sort((a, b) => a - b),
        blockedStuckUnitIds: [...blockedStuckUnitIds].sort((a, b) => a - b),
        navFailureUnitIds: [...navFailureUnitIds].sort((a, b) => a - b),
        navigationStuckUnitIds: [...navigationStuckUnitIds].sort((a, b) => a - b),
        stuckDetails: [...stuckDetails.values()]
            .sort((a, b) => a.id - b.id)
            .map(detail => ({
                ...detail,
                stuckSeconds: Math.round(detail.stuckTicks * BATTLE_TICK_SEC * 100) / 100
            })),
        maxStuckSeconds: Math.round(maxStuckTicks * BATTLE_TICK_SEC * 100) / 100,
        bluePlan: BATTLE_CONTROLLERS.get('battle-blue-ally-ai')?.currentPlan?.kind || null,
        redPlan: BATTLE_CONTROLLERS.get('battle-red-ai')?.currentPlan?.kind || null,
        blueOperationPhases: [...new Set(
            (BATTLE_CONTROLLERS.get('battle-blue-ally-ai')?.taskExecutor?.operationHistory || [])
                .map(entry => entry.current)
        )],
        redOperationPhases: [...new Set(
            (BATTLE_CONTROLLERS.get('battle-red-ai')?.taskExecutor?.operationHistory || [])
                .map(entry => entry.current)
        )],
        blueOperationHistory: operationHistoryFor('battle-blue-ally-ai'),
        redOperationHistory: operationHistoryFor('battle-red-ai'),
        playerSurrogateSide: surrogateSide,
        scriptedAdvance: config.scriptedAdvance === true
    };
}

function runRecordedPlayerVsAIDiagnostics(recordingDocument) {
    const source = recordingDocument?.replay || recordingDocument;
    if (!source?.session || !source?.initialState) {
        throw new Error('Geçerli Pixel RTS savaş kaydı gerekli.');
    }
    const durationSec = Number.isFinite(source.session.durationSec)
        ? source.session.durationSec
        : 240;
    openBattlefieldSession({
        mode: 'recorded-player-lab',
        mapId: source.session.requestedMapId ?? source.session.mapId ?? -2,
        seed: source.session.seed,
        attackerSide: source.session.attackerSide === true,
        durationSec,
        playerMoney: 0,
        enemyMoney: 0,
        deployRes: null,
        deployPool: null,
        techBonus: null,
        techBonusRed: null,
        autoDeployAI: false,
        show: false
    });
    battleRestoreInitialState(source.initialState);
    if (typeof battleControllersSyncOwnership === 'function') {
        battleControllersSyncOwnership();
    }
    phase = PHASE.BATTLE;
    document.body.setAttribute('data-phase', PHASE.BATTLE);
    initBattleRules({
        attackerSide: source.session.attackerSide === true,
        durationSec
    });
    battleCaptureInitialState();
    battleRecordEvent('battle-start', battlefieldRulesConfig(), SIM.tick);

    const playerEvents = (source.events || [])
        .filter(event => [
            'player-move',
            'player-attack',
            'player-free-fire',
            'player-load',
            'player-unload',
            'player-mine',
            'player-ability',
            'support-paradrop'
        ].includes(event.type))
        .sort((a, b) => (a.tick - b.tick));
    const initialHp = {
        blue: SIM.units.filter(unit => !unit.isRed)
            .reduce((sum, unit) => sum + unit.maxHp, 0),
        red: SIM.units.filter(unit => unit.isRed)
            .reduce((sum, unit) => sum + unit.maxHp, 0)
    };
    const terrainViolationIds = new Set();
    let eventIndex = 0;
    let ticks = 0;
    const maxTicks = Math.ceil(durationSec / BATTLE_TICK_SEC);
    const previousHeadless = SIM.headless;
    SIM.headless = true;
    try {
        for (; ticks < maxTicks && phase === PHASE.BATTLE; ticks++) {
            while (eventIndex < playerEvents.length &&
                playerEvents[eventIndex].tick <= SIM.tick) {
                battleApplyRecordedEvent(playerEvents[eventIndex++]);
            }
            simulationTime += BATTLE_TICK_MS;
            gameTime += BATTLE_TICK_SEC;
            stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false);
            updateSupport(BATTLE_TICK_SEC, simulationTime);
            if ((SIM.tick % 20) === 0) {
                for (const unit of SIM.units) {
                    if (!unit.dead && !isPassableAt(unit.x, unit.y)) {
                        terrainViolationIds.add(unit.id);
                    }
                }
            }
            if (SIM.battle?.winnerSide !== null) break;
        }
    } finally {
        SIM.headless = previousHeadless;
    }

    const blueUnits = SIM.units.filter(unit => !unit.isRed);
    const redUnits = SIM.units.filter(unit => unit.isRed);
    const combat = BATTLE_REPLAY.telemetry?.combatEvents || [];
    const redDamage = combat
        .filter(event => event.attackerSide === 'red')
        .reduce((sum, event) => sum + event.damage, 0);
    const blueDamage = combat
        .filter(event => event.attackerSide === 'blue')
        .reduce((sum, event) => sum + event.damage, 0);
    const redDecisions = BATTLE_REPLAY.telemetry?.controllerDecisions
        ?.filter(item => item.controllerId === 'battle-red-ai') || [];
    const planTimeline = [];
    let previousPlan;
    for (const decision of redDecisions) {
        const current = decision.committedPlan?.kind || null;
        if (current === previousPlan) continue;
        planTimeline.push({ seconds: decision.seconds, plan: current });
        previousPlan = current;
    }
    const redOrders = BATTLE_REPLAY.events.filter(event =>
        event.type === 'controller-order' &&
        event.payload.issuedBy === 'battle-red-ai'
    );
    const firstRedHit = combat.find(event => event.attackerSide === 'red');
    const firstBlueHit = combat.find(event => event.attackerSide === 'blue');
    return {
        sourceEngineVersion: source.engineVersion,
        currentEngineVersion: BATTLE_ENGINE_VERSION,
        seed: source.session.seed,
        attackerSide: source.session.attackerSide ? 'red' : 'blue',
        sourceOutcome: source.telemetry?.finalSummary || null,
        newOutcome: {
            winnerSide: SIM.battle?.winnerSide ?? null,
            winnerColor: SIM.battle?.winnerSide == null
                ? null
                : SIM.battle.winnerSide ? 'red' : 'blue',
            outcomeReason: SIM.battle?.outcomeReason || null,
            durationSeconds: Math.round((SIM.battle?.elapsedSec || 0) * 100) / 100,
            blueSurvivors: blueUnits.filter(unit => !unit.dead).length,
            redSurvivors: redUnits.filter(unit => !unit.dead).length,
            blueDamageReceived: Math.round((
                initialHp.blue -
                blueUnits.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0)
            ) * 100) / 100,
            redDamageReceived: Math.round((
                initialHp.red -
                redUnits.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0)
            ) * 100) / 100,
            recordedRedDamage: Math.round(redDamage * 100) / 100,
            recordedBlueDamage: Math.round(blueDamage * 100) / 100
        },
        firstBlueHitSecond: firstBlueHit?.seconds ?? null,
        firstRedHitSecond: firstRedHit?.seconds ?? null,
        redOrders: redOrders.length,
        redAttackOrders: redOrders.filter(event => event.payload.kind === 'ATTACK').length,
        planTimeline,
        terrainViolationIds: [...terrainViolationIds].sort((a, b) => a - b),
        playerEventsApplied: eventIndex,
        playerEventsTotal: playerEvents.length,
        playerEventsPendingAfterBattle: Math.max(0, playerEvents.length - eventIndex)
    };
}
