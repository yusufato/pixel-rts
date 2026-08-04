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
    [T.ATTACK_HELO]: 0.025, [T.RECON_UAV]: 0.025, [T.UCAV]: 0.02, [T.DRONE_OPERATOR]: 0.03,   // FAZ 2 hava (drone-operatör: 2 kamikaze SALAR — redesign, tek-tek kamikaze yerine)
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
        { [T.ATTACK_HELO]: 2.0, [T.DRONE_OPERATOR]: 1.8, [T.UCAV]: 1.6, [T.RECON_UAV]: 1.5, [T.SPAAG]: 1.4, [T.SAM]: 1.3 },   // HAVA HAREKÂTI
        { [T.ANTI_TANK]: 2.0, [T.TANK_HUNTER]: 1.6, [T.COMMANDO]: 1.5, [T.MANPADS]: 1.3, [T.MORTAR]: 1.3, [T.ARMOR]: 0.5 }, // TANKSAVAR PUSU
        { [T.MECH_INFANTRY]: 1.9, [T.RECON]: 2.0, [T.ARMOR]: 1.3, [T.DRONE_OPERATOR]: 1.4, [T.ARTILLERY]: 0.6 },             // HAREKETLİ VURKAÇ
        { [T.SPAAG]: 1.8, [T.SAM]: 1.7, [T.MANPADS]: 1.6, [T.COUNTER_BATTERY]: 1.5, [T.INFANTRY]: 1.2 },               // HAVA-SAVUNMA AĞI
        { [T.DRONE_OPERATOR]: 3.0, [T.RECON_UAV]: 2.5, [T.EW]: 2.2, [T.ANTI_TANK]: 1.6, [T.MANPADS]: 1.3, [T.ARMOR]: 0.0, [T.TANK_HUNTER]: 0.0 }, // DRONE-YOĞUN YIPRATMA (drone-operatör sürüsü: her operatör 2 kamikaze salar + İHA ağı + EH, pahalı platform yok)
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

        // ANALİST-FIX (çeşitlilik-çöküşü, 2 insan-maçı aynı-ordu): floor'lar bütçeyi domine edince açgözlü-fill tek-çözüme sıkışıyordu
        // (2 tohum → ~özdeş kadro → anti-dizen oyuncu ödevini kolaylaştırıyor + 6-stil değersizleşiyor). ÇÖZÜM: varied'de çekirdek-seçime
        // TOHUM-GÜRÜLTÜSÜ (±%25 çarpımsal jitter, SIM_RNG) → yakın-denk adaylar seed'le farklı çözülür (güçlü-açık ORDER'ı korunur, bantlar
        // içinde serbestlik geri gelir). Determinist (srand). Floor'lar/imza değişmez → doktrin-dengesi + zorunlu-çekirdek korunur.
        const _jit = (config.varied && typeof srand === 'function');
        const choice = affordable.map(type => {
            const group = deploymentBudgetGroup(type, remaining);
            const peers = allowedTypes.filter(candidate =>
                deploymentBudgetGroup(candidate, remaining) === group
            );
            const weightTotal = peers.reduce((sum, candidate) =>
                sum + deployWeights[candidate], 0) || 1;
            const target = (initial[group] || 0) *
                (deployWeights[type] / weightTotal);
            const _nd = (target - (spent[type] || 0)) / Math.max(1, STATS[type].cost);
            return {
                type,
                deficit: target - (spent[type] || 0),
                normalizedDeficit: _jit ? _nd * (0.75 + srand() * 0.5) : _nd   // ±%25 tohum-gürültü (yakın-denkleri karıştır)
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
    // INTEL4-delta (flag-kapılı: config.brainIntel4). intel3pro'da imza-floor YOK → base-weight hat-ağır ordu (7-maç-sıfır-helo).
    // intel4: doktrin İMZA birimleri (çarpan≥1.4) hiç alınmadıysa BİRER tane garanti (pahalı-birim yapısal-dışlanmasını kır).
    // TAM-AÇ (kullanıcı-kararı): saldıran/savunan AYNI floor (guard 8, imza-dışı herhangi kurban; SAM/COUNTER_BATTERY korunur).
    // Helo yaşatma-güvencesi = helo-neşter-micro (Unit.js). ucuz-imza-önce (bütçe darsa en çok imza-tipi çıksın).
    const _dComp = (typeof BATTLE_INTEL4_DELTAS === 'undefined' || BATTLE_INTEL4_DELTAS.comp !== false);   // INTEL4-delta 'comp'
    const emphasis = (config.varied && config.brainIntel4 && _dComp && Array.isArray(deployWeights.__emphasis)) ? deployWeights.__emphasis.slice() : [];
    emphasis.sort((a, b) => (STATS[a] && STATS[b]) ? ((STATS[a].cost - STATS[b].cost) || (a - b)) : 0);
    if (emphasis.length && Object.prototype.hasOwnProperty.call(remaining, 'money')) {
        for (const et of emphasis) {
            if (et == null || !STATS[et] || types.includes(et)) continue;
            const cost = STATS[et].cost;
            if (cost > (initial.money || 0)) continue;   // bütçeye hiç sığmıyorsa geç
            let guard = 0;
            while ((remaining.money || 0) < cost && guard++ < 8) {   // yer aç: imza-DIŞI en-çok-tekrarlanan (eşitse en-pahalı) kurbanı sök
                const cnt = {}; for (const t of types) cnt[t] = (cnt[t] || 0) + 1;
                let victim = null;
                for (const t of Object.keys(cnt).map(Number).sort((a, b) => a - b)) {
                    if (emphasis.includes(t) || t === et || t === T.SAM || t === T.COUNTER_BATTERY) continue;   // imza + hava-savunma çekirdeği korunur
                    if (victim == null || cnt[t] > cnt[victim] || (cnt[t] === cnt[victim] && STATS[t].cost > STATS[victim].cost)) victim = t;
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
        // BÜTÇE-KAÇAĞI DÜZELTMESİ: bu takas `spent` defterini güncelliyordu ama `remaining.money`'e HİÇ dokunmuyordu →
        // SPAAG(300)→SAM(700) farkı 400₺ BEDAVA geliyordu. Ölçüldü: SAM+radar takasları birlikte her orduya sabit
        // +560₺ katıyordu (6500 tavanı fiilen 7060 oluyordu). Artık fark bütçeden düşülür; para yetmezse takas YAPILMAZ.
        if (aaIdx >= 0) {
            const _fark = STATS[T.SAM].cost - STATS[types[aaIdx]].cost;
            if (_fark <= (remaining.money || 0)) {
                remaining.money -= _fark;
                spent[types[aaIdx]] = (spent[types[aaIdx]] || 0) - STATS[types[aaIdx]].cost;
                types[aaIdx] = T.SAM; spent[T.SAM] = (spent[T.SAM] || 0) + STATS[T.SAM].cost;
            }
        }
    }
    // ANALİST-FIX (kör-SAM): SAM RADARSIZ kördür (yalnız 900px görüşü; helo dışarıdan vurup öldürür). SAM varsa RADAR da al
    // (350₺ radar = 700₺ SAM'ın gözü). Radar yoksa ikinci-AA/ikmal/en-ucuz-fazlalığı radar ile değiştir.
    if (typeof T !== 'undefined' && T.COUNTER_BATTERY != null && STATS[T.COUNTER_BATTERY] && types.includes(T.SAM) && !types.includes(T.COUNTER_BATTERY)) {
        let swapIdx = -1;   // önce ikinci-AA (spaag/manpads), sonra supply, sonra en-çok-tekrar-eden savaş-dışı
        for (const cand of [T.SPAAG, T.MANPADS, T.SUPPLY]) { if (cand != null) { const ix = types.lastIndexOf(cand); if (ix >= 0 && (cand !== T.SAM)) { swapIdx = ix; break; } } }
        // BÜTÇE-KAÇAĞI DÜZELTMESİ (yukarıdakiyle aynı sınıf): fark artık bütçeden düşülür, yetmezse takas yapılmaz.
        if (swapIdx >= 0) {
            const _fark = STATS[T.COUNTER_BATTERY].cost - STATS[types[swapIdx]].cost;
            if (_fark <= (remaining.money || 0)) {
                remaining.money -= _fark;
                spent[types[swapIdx]] = (spent[types[swapIdx]] || 0) - STATS[types[swapIdx]].cost;
                types[swapIdx] = T.COUNTER_BATTERY; spent[T.COUNTER_BATTERY] = (spent[T.COUNTER_BATTERY] || 0) + STATS[T.COUNTER_BATTERY].cost;
            }
        }
    }
    // ANALİST-ŞABLON (39-maç damıtması, SIRA-KURALI ÖNCE ÇEKİRDEK): SERT TABANLAR → degenerate-çekiliş (14-piyade, topçusuz, ikmalsiz,
    // kör) YAPISAL-İMKANSIZ. "Bantlar geniş, tabanlar sert." Zorunlu-çekirdek (ikmal/spaag/keşif/sıhhiye/istihkam) + indirect(havan≥2,
    // analistin %100-sinyali) + hat(piyade≥4,AT≥2) + drone(operatör≥1). MIZRAK/rol-tabanından ÖNCE rezerve edilir (çekirdek mızrağa yem-olmaz).
    // Eksik-tipi ekle; yer gerekirse HAT-FAZLASI piyadeden (piyade-min 4 korunur → omurga sağlam).
    if (Object.prototype.hasOwnProperty.call(remaining, 'money')) {
        // SIRA = analist-frekans: en-güçlü değişmezler ÖNCE (bütçe darsa en-kritik-olmayanlar eksik kalsın, çekirdek değil).
        // 2havan+ikmal=%100, spaag=%80. Sonra hat/AT/drone tabanları, en son 2.keşif/istihkam (lüks-çekirdek).
        const HARD_FLOORS = [
            [T.MORTAR, 2], [T.SUPPLY, 1], [T.SPAAG, 1], [T.ANTI_TANK, 2], [T.INFANTRY, 4], [T.DRONE_OPERATOR, 1],   // güçlü-değişmezler
            [T.RECON, 1], [T.MEDIC, 1], [T.ENGINEER, 1], [T.RECON_UAV, 1]                                            // ikincil-çekirdek
        ];
        for (const [ty, minN] of HARD_FLOORS) {
            if (ty == null || !STATS[ty]) continue;
            let guard = 0;
            while (types.filter(t => t === ty).length < minN && guard++ < 12) {
                if (STATS[ty].cost <= (remaining.money || 0)) { remaining.money -= STATS[ty].cost; spent[ty] = (spent[ty] || 0) + STATS[ty].cost; types.push(ty); continue; }
                const infCount = types.filter(t => t === T.INFANTRY).length;   // yer aç: yalnız HAT-FAZLASI piyade (piyade-min 4 korunur)
                if (ty === T.INFANTRY || infCount <= 4) break;
                const ix = types.lastIndexOf(T.INFANTRY); if (ix < 0) break;
                remaining.money += STATS[T.INFANTRY].cost; spent[T.INFANTRY] = (spent[T.INFANTRY] || 0) - STATS[T.INFANTRY].cost; if (spent[T.INFANTRY] <= 0) delete spent[T.INFANTRY];
                types.splice(ix, 1);
            }
        }
    }
    // ANALİST-FIX (MIZRAKSIZ-TAARRUZ, deneysel-kanıt): TAARRUZ ordusu asgari ZIRH-MIZRAĞI olmadan kurulamaz. Deterministik-üretici
    // seed2024'te kırmızı-taarruza %5-zırh (0 MBT/TD, 9 piyade+6 AT) çekti → BEYİN-BAĞIMSIZ ölü-ordu (ayna-maçta eski-beyin de aynı
    // kadroyla 3-31 kaybetti; tek-yenilgi zar'ın suçu). Zırh-tabanı: MBT/TD/mekanize ≥ %18 bütçe (analistin galip-ordusu %29'du,
    // mızraksızı %5). Eksikse en-ucuz zırh al, en-PAHALI non-zırh fazlalığı takas (imza≥1 + SAM + radar korunur). İki-taraf, deterministik.
    // YALNIZ TAARRUZ (config.isAttacker): analistin reçetesi "TAARRUZ rolü mızraksız kadro kuramaz". Savunanı ZORLAMA (savunma
    // doktrini mızrak istemeyebilir → zorlarsan regresyon: ölçümde savunma-777 flip oldu). Kırmızı-AI attacker'sa floor devrede.
    // ── INTEL4-PRO 'atCap': SALDIRANDA TANKSAVAR TİMİ TAVANI (kullanıcı gözlemi, 2026-08-04) ──
    // Ölçüldü: saldıran ordunun EN BÜYÜK kalemi 7 AT timi (1190₺ = %18.3) iken mızrağı (MBT+TD) %14.2'de
    // kalıyor ve kodun kendi %18 mızrak-tabanı TUTMUYOR. Kullanıcı: "7 AT fazla; canları az, dolaylı ateş
    // karşısında etkisiz; 3-4 fazlasıyla yeter, kalan para daha iyi değerlendirilir (ÇNRA/drone-operatör/helo)."
    // Tavanın ÜSTÜ sökülür ve para İADE EDİLİR → hemen ardından gelen MIZRAK TABANI o parayı MBT/TD'ye çevirir
    // (yani bu tavan, tutmayan mızrak-tabanını da besler). Yalnız SALDIRAN + pro. Deterministik.
    if (config.pro === true && config.isAttacker === true && T.ANTI_TANK != null && STATS[T.ANTI_TANK] &&
        Object.prototype.hasOwnProperty.call(remaining, 'money')) {
        let guard = 0;
        while (types.filter(t => t === T.ANTI_TANK).length > PRO_AT_CAP && guard++ < 24) {
            const ix = types.lastIndexOf(T.ANTI_TANK); if (ix < 0) break;
            remaining.money += STATS[T.ANTI_TANK].cost;
            spent[T.ANTI_TANK] = (spent[T.ANTI_TANK] || 0) - STATS[T.ANTI_TANK].cost;
            if (spent[T.ANTI_TANK] <= 0) delete spent[T.ANTI_TANK];
            types.splice(ix, 1);
        }
    }
    if (config.isAttacker === true && Object.prototype.hasOwnProperty.call(remaining, 'money')) {
        // MIZRAK = AĞIR zırh: MBT(T.ARMOR) + TD(T.TANK_HUNTER) YALNIZ. IFV(MECH_INFANTRY) HARİÇ — analist "0 MBT/TD, tek ZMA(IFV)"yi
        // mızraksız saydı → IFV mızrak sayılırsa floor IFV'lerle dolup gerçek-mızrak eklemez (seed2024 tam bu tuzağa düştü).
        const SPEAR = [T.ARMOR, T.TANK_HUNTER].filter(t => t != null && STATS[t]);
        const isSpear = t => SPEAR.includes(t);
        const spearValue = () => types.reduce((s, t) => s + (isSpear(t) ? STATS[t].cost : 0), 0);
        const target = 0.18 * (initial.money || 0);
        const buyOrder = [T.ARMOR, T.TANK_HUNTER].filter(t => t != null && STATS[t]);   // MBT-ÖNCELİKLİ (yarma-mızrağı; TD=tanksavar ikincil)
        let guard = 0;
        while (spearValue() < target && guard++ < 24) {
            let buy = null;
            for (const t of buyOrder) { if (STATS[t].cost <= (remaining.money || 0)) { buy = t; break; } }
            if (buy == null) {   // ANALİST-FIX (omurga-yeme bug'ı): mızrak YALNIZ HAT-FAZLASI piyadeden beslenir. OMURGA KORUNUR:
                // topçu/havan/ÇNRA (ateş-desteği) + ikmal (lojistik) + AT + hava-savunma + destek ASLA sökülmez (o kadro savaşamaz kalırsa
                // mızrak boş). Kurban = fazla PİYADE (hat-min ≥4 korunur). Serbest-bütçe+piyade-fazlası bitince DUR (omurga sağlam kalsın).
                const infCount = types.filter(t => t === T.INFANTRY).length;
                if (infCount <= 4) break;   // hat-minimumu koru → omurga sökmeden dur (mızrak eksik kalsa da kadro sağlam)
                const ix = types.lastIndexOf(T.INFANTRY); if (ix < 0) break;
                remaining.money += STATS[T.INFANTRY].cost; spent[T.INFANTRY] = (spent[T.INFANTRY] || 0) - STATS[T.INFANTRY].cost; if (spent[T.INFANTRY] <= 0) delete spent[T.INFANTRY];
                types.splice(ix, 1); continue;
            }
            remaining.money -= STATS[buy].cost; spent[buy] = (spent[buy] || 0) + STATS[buy].cost; types.push(buy);
        }
    }
    // ANALİST-FIX (reçete-2, SAVUNAN-TABANI): savunan da omurgasız kurulamaz — ANTI-TANK kapasitesi (AT+TD) ≥ %15 bütçe. "14-piyade"
    // savunması hiçbir doktrinde meşru değil (small_arms→ağır ×0.05 → mızrağı matematiksel durduramaz). Hat-fazlası piyadeden beslenir
    // (omurga=topçu/ikmal/hava-sav KORUNUR). Yalnız SAVUNAN (config.isAttacker===false). Deterministik.
    if (config.isAttacker === false && Object.prototype.hasOwnProperty.call(remaining, 'money')) {
        const AT = [T.ANTI_TANK, T.TANK_HUNTER].filter(t => t != null && STATS[t]);
        const isAT = t => AT.includes(t);
        const atValue = () => types.reduce((s, t) => s + (isAT(t) ? STATS[t].cost : 0), 0);
        const target = 0.15 * (initial.money || 0);
        const buyOrder = [T.ANTI_TANK, T.TANK_HUNTER].filter(t => t != null && STATS[t]);   // ucuz AT-timi önce, sonra TD
        let guard = 0;
        while (atValue() < target && guard++ < 24) {
            let buy = null;
            for (const t of buyOrder) { if (STATS[t].cost <= (remaining.money || 0)) { buy = t; break; } }
            if (buy == null) {   // yer aç: yalnız hat-fazlası piyade (omurga korunur, hat-min ≥4)
                const infCount = types.filter(t => t === T.INFANTRY).length;
                if (infCount <= 4) break;
                const ix = types.lastIndexOf(T.INFANTRY); if (ix < 0) break;
                remaining.money += STATS[T.INFANTRY].cost; spent[T.INFANTRY] = (spent[T.INFANTRY] || 0) - STATS[T.INFANTRY].cost; if (spent[T.INFANTRY] <= 0) delete spent[T.INFANTRY];
                types.splice(ix, 1); continue;
            }
            remaining.money -= STATS[buy].cost; spent[buy] = (spent[buy] || 0) + STATS[buy].cost; types.push(buy);
        }
    }
    // ANALİST-FIX (reçete-3, SAVUNAN ATEŞ-DESTEĞİ ALT-TÜR TABANI): savunan-3141 "topçu-yok/ÇNRA-yok/spaag-yok, dolaylı=yalnız-2-havan"
    // ile sahaya çıktı → ATEŞSİZ savunma ŞOK üretemedi (kazanılan savunmalar t=78/135'te şok-sömürü ateşlemişti) → PRESERVE'de oturup
    // ezme-paketine (AT2227+TD2088+MBT1872) yuvarlandı. Doğrulama alt-tür şartı: dolaylı = havan(HARD_FLOOR) ARTI ≥1 (topçu|ÇNRA);
    // AA = ≥1 (spaag|manpads). Eksik alt-türü EN-UCUZUNDAN al (hat-fazlası piyadeden besle, omurga korunur). YALNIZ SAVUNAN. Determinist.
    if (config.isAttacker === false && Object.prototype.hasOwnProperty.call(remaining, 'money')) {
        // KORUNAN-ÇEKİRDEK: ateş-desteği/AT/AA/lojistik/destek ASLA sökülmez (onları eklemeye çalışıyoruz zaten). Kurban = en-PAHALI
        // korunmayan fazlalık (fazla armor/helo/İHA/mekanize/komando/EW/hat-fazlası-piyade) → topçu(450)/spaag(300) için yeterli bütçe açar.
        const PROTECT = [T.ARTILLERY, T.MLRS, T.SPAAG, T.SAM, T.MANPADS, T.MORTAR, T.SUPPLY, T.ANTI_TANK, T.TANK_HUNTER, T.DRONE_OPERATOR, T.COUNTER_BATTERY, T.RECON, T.MEDIC, T.ENGINEER, T.RECON_UAV].filter(t => t != null);
        const _ensureOneOf = (opts) => {
            const order = opts.filter(t => t != null && STATS[t]).sort((a, b) => STATS[a].cost - STATS[b].cost);   // en-ucuz alt-tür önce
            if (!order.length) return;
            let guard = 0;
            while (!order.some(t => types.includes(t)) && guard++ < 30) {
                const buy = order.find(t => STATS[t].cost <= (remaining.money || 0));
                if (buy != null) { remaining.money -= STATS[buy].cost; spent[buy] = (spent[buy] || 0) + STATS[buy].cost; types.push(buy); break; }
                // BÜTÇE AÇ: en-PAHALI korunmayan-fazlalığı sök (hat-min ≥4 korunur). Zayıf hat-fazlası-piyade takası yetmezdi (450>fazla-piyade).
                let vIdx = -1, vCost = -1; const infCount = types.filter(t => t === T.INFANTRY).length;
                for (let i = 0; i < types.length; i++) {
                    const t = types[i];
                    if (PROTECT.includes(t)) continue;
                    if (t === T.INFANTRY && infCount <= 4) continue;   // hat-minimumu koru
                    const c = STATS[t] ? STATS[t].cost : 0;
                    if (c > vCost) { vCost = c; vIdx = i; }
                }
                if (vIdx < 0) break;   // sökülecek korunmayan-fazlalık yok → dur
                const vt = types[vIdx];
                remaining.money += STATS[vt].cost; spent[vt] = (spent[vt] || 0) - STATS[vt].cost; if (spent[vt] <= 0) delete spent[vt];
                types.splice(vIdx, 1);
            }
        };
        _ensureOneOf([T.ARTILLERY, T.MLRS]);   // AĞIR-DOLAYLI: havan tek başına şok-üreten-ateş değil (topçu|ÇNRA şart)
        _ensureOneOf([T.SPAAG, T.MANPADS]);    // KISA-AA: SAM tek-katman kalmasın (drone/helo cevabı)
    }
    // FAZ2 OMURGA-TABANI (analist Suçlu-2/görev-rol, `backbone`-delta): comp-floor pahalı-imzayı garantiler ama HATTI aç bırakabiliyor
    // (maç-kanıtı savunma-777: 930₺ drone/EW + hat yalnız 2-piyade → ucuz-simetrik cevaba yenildi). KURAL: hat+AT karması ≥ %30 bütçe —
    // "ana çabanın ucu asla çıplak değil". Eksikse en-ucuz omurga al, en-PAHALI non-omurga fazlalığı takas ederek (imza≥1 + SAM + radar korunur).
    // Her iki tarafa (saldıran+savunan). Deterministik (sıralı, RNG yok). Gated default-false → byte-aynı.
    const _dBackbone = (typeof BATTLE_INTEL4_DELTAS !== 'undefined' && BATTLE_INTEL4_DELTAS.backbone === true);
    if (_dBackbone && config.brainIntel4 && Object.prototype.hasOwnProperty.call(remaining, 'money')) {
        const BACKBONE = [T.ARMOR, T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.ANTI_TANK].filter(t => t != null && STATS[t]);
        const isBb = t => BACKBONE.includes(t);
        const bbValue = () => types.reduce((s, t) => s + (isBb(t) ? STATS[t].cost : 0), 0);
        const target = 0.30 * (initial.money || 0);
        const buyOrder = BACKBONE.slice().sort((a, b) => (STATS[a].cost - STATS[b].cost) || (a - b));   // en ucuz omurga önce
        let guard = 0;
        while (bbValue() < target && guard++ < 24) {
            let buy = null;
            for (const t of buyOrder) { if (STATS[t].cost <= (remaining.money || 0)) { buy = t; break; } }
            if (buy == null) {   // yer aç: en-PAHALI non-omurga fazlalık kurbanı (imza son-kopyası + SAM + radar KORUNUR)
                const cnt = {}; for (const t of types) cnt[t] = (cnt[t] || 0) + 1;
                let victim = null;
                for (const t of Object.keys(cnt).map(Number)) {
                    if (isBb(t) || t === T.SAM || t === T.COUNTER_BATTERY) continue;
                    if (emphasis.includes(t) && cnt[t] <= 1) continue;   // imza son-kopyasını koru (çeşitlilik bozulmasın)
                    if (victim == null || STATS[t].cost > STATS[victim].cost || (STATS[t].cost === STATS[victim].cost && t < victim)) victim = t;
                }
                if (victim == null) break;
                const ix = types.lastIndexOf(victim); if (ix < 0) break;
                remaining.money += STATS[victim].cost; spent[victim] = (spent[victim] || 0) - STATS[victim].cost; if (spent[victim] <= 0) delete spent[victim];
                types.splice(ix, 1);
                continue;   // artık omurga sığabilir → tekrar dene
            }
            remaining.money -= STATS[buy].cost; spent[buy] = (spent[buy] || 0) + STATS[buy].cost; types.push(buy);
        }
    }
    // INTEL4-PRO: AT-tavanından ve tabanlardan ARTAN parayı boşa bırakma — kullanıcı: "kalan para daha iyi
    // değerlendirilebilir (ÇNRA / bir drone operatörü daha / helikopter), AI nasıl dizmek isterse."
    // Burada AI'ın KENDİ tercihine bırakılır: uygun tipler arasından en YÜKSEK doktrin-ağırlıklısı alınır
    // (eşitlikte pahalı olan, sonra küçük indeks) → doktrin karakteri korunur. Deterministik, RNG yok.
    if (config.pro === true && Object.prototype.hasOwnProperty.call(remaining, 'money')) {
        // KABİLİYET LİSTESİ (kullanıcının kendi örnekleri + mızrak): artan para BUNLARA gider.
        // `allowedTypes` kullanılmıyordu çünkü doktrin ağırlık-haritasında olmayan tip (ör. tank) aday olamıyor
        // ve para PİYADEYE akıyordu (ilk denemede 900₺ → 9 piyade). Liste boşsa hiç harcama YAPMA (spam yok).
        const PRO_ARTIK = [T.MLRS, T.ATTACK_HELO, T.ARMOR, T.TANK_HUNTER, T.ARTILLERY, T.DRONE_OPERATOR, T.UCAV]
            .filter(t => t != null && STATS[t]);
        let guard = 0;
        while (types.length < maxUnits && guard++ < 24) {
            const uygun = PRO_ARTIK.filter(t => STATS[t].cost <= (remaining.money || 0));
            if (!uygun.length) break;
            // KABİLİYET ÖNCELİĞİ: en PAHALI uygun tip alınır (eşitlikte doktrin-ağırlığı, sonra küçük indeks).
            // İlk sürüm "en yüksek ağırlık" seçiyordu → 900₺'yi 9 PİYADEYE harcadı (kodun kendi uyardığı
            // degenerate "piyade spam"ı). Kullanıcının kastı kabiliyetti: "ÇNRA / bir drone operatörü daha /
            // helikopter". Pahalıdan başlamak doğal olarak bunları alır, artık kuruş piyadeye kalır.
            let pick = null;
            for (const t of uygun) {
                if (pick == null) { pick = t; continue; }
                const ct = STATS[t].cost, cp = STATS[pick].cost;
                const wt = deployWeights[t] || 0, wp = deployWeights[pick] || 0;
                if (ct > cp || (ct === cp && (wt > wp || (wt === wp && t < pick)))) pick = t;
            }
            if (pick == null) break;
            remaining.money -= STATS[pick].cost; spent[pick] = (spent[pick] || 0) + STATS[pick].cost; types.push(pick);
        }
    }
    const counts = types.reduce((result, type) => {
        result[type] = (result[type] || 0) + 1;
        return result;
    }, {});
    // ANALİST-FIX (reçete-3, KADRO-DOĞRULAMA): taraf-başı kategori-payı dökümü (₺). "fire-support %0" = kırmızı-bayrak → degenerate
    // çekilişler maç KOŞULMADAN tek-satırdan görünür (deterministik-üreticide bedava kontrol). fireSupport/logistics/at/armor/infantry.
    const _tv = types.reduce((s, t) => s + STATS[t].cost, 0) || 1;
    const _catCost = (pred) => Math.round(types.reduce((s, t) => s + (pred(t) ? STATS[t].cost : 0), 0) / _tv * 100);
    const composition = {
        fireSupport: _catCost(t => STATS[t] && (STATS[t].category === 'indirect' || (STATS[t].roleTags || []).includes('indirect_fire'))),
        logistics: _catCost(t => t === T.SUPPLY),
        antiTank: _catCost(t => t === T.ANTI_TANK || t === T.TANK_HUNTER),
        armor: _catCost(t => t === T.ARMOR || t === T.TANK_HUNTER || t === T.MECH_INFANTRY),
        infantry: _catCost(t => t === T.INFANTRY),
        airDefense: _catCost(t => t === T.SAM || t === T.SPAAG || t === T.MANPADS || t === T.COUNTER_BATTERY)
    };
    return {
        types,
        counts,
        totalUnits: types.length,
        totalValue: types.reduce((sum, type) => sum + STATS[type].cost, 0),
        initialBudget: initial,
        remaining,
        composition,   // kategori-payı (kadro-doğrulama; degenerate-çekiliş kırmızı-bayrağı)
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
    // INTEL4-delta (flag-kapılı): SAM-radar konuşlanma-geometrisi intel3pro'da yok (radar rastgele serpiştirilir).
    if (typeof T !== 'undefined' && T.SAM != null && (typeof battleDelta === 'function') && battleDelta(side, 'comp')) {
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
    // KADRO-DOĞRULAMA (analist reçete-3): taraf-başı kategori-payını session'a yaz → kayıttan (features.composition) okunur, degenerate yakalanır
    if (typeof BATTLE_SESSION !== 'undefined' && manifest && manifest.composition) {
        BATTLE_SESSION.composition = BATTLE_SESSION.composition || {};
        BATTLE_SESSION.composition[side ? 'red' : 'blue'] = manifest.composition;
    }
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
        varied: (typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.interactive === true) || BATTLE_FORCE_VARIED === true,
        // INTEL4 BEYİN-FLAG: kırmızı-AI (side=true) intel4-beyni ise imza-floor+SAM-koloc devrede (flag-off=intel3pro base-ordu).
        brainIntel4: (typeof battleBrainIntel4 === 'function') && battleBrainIntel4(true),
        // ANALİST-FIX (mızraksız-taarruz): kırmızı-AI SALDIRAN ise zırh-mızrağı-tabanı devrede (savunanda değil). NOT: SIM.battle.attackerSide
        // autoDeploy anında HENÜZ set-edilmemiş (initBattleRules startBattle'da) → session-CONFIG'in attackerSide'ını oku (doğru kaynak).
        isAttacker: (config.attackerSide === true),
        // INTEL4-PRO kompozisyon katmanı (kırmızı taraf): AT-tavanı vb. yalnız pro-beyinli tarafta.
        pro: (typeof BATTLE_INTEL4PRO_RED !== 'undefined') && BATTLE_INTEL4PRO_RED === true
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
