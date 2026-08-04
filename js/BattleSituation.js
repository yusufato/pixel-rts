// Algı snapshot'ını komutanın kullanabileceği tarafsız durum analizine çevirir.
// Düşmanın gerçek SIM birimlerini okumaz; yalnız BattlePerception.contacts kullanır.

const FORCE_POSTURE = Object.freeze({
    ADVANTAGE: 'ADVANTAGE',
    PARITY: 'PARITY',
    DISADVANTAGE: 'DISADVANTAGE',
    UNKNOWN: 'UNKNOWN'
});

const CONTACT_STATE = Object.freeze({
    NO_CONTACT: 'NO_CONTACT',
    UNCERTAIN: 'UNCERTAIN',
    CONTACT: 'CONTACT'
});

const BATTLE_PLAN_KIND = Object.freeze({
    SEARCH: 'SEARCH',
    ADVANCE: 'ADVANCE',
    HOLD: 'HOLD',
    MAIN_ATTACK: 'MAIN_ATTACK',
    FIX_AND_FLANK: 'FIX_AND_FLANK',
    FIRE_PREPARATION: 'FIRE_PREPARATION',
    COUNTERATTACK: 'COUNTERATTACK',
    REGROUP: 'REGROUP',
    DISENGAGE: 'DISENGAGE'
});

function situationUnitCategory(type) {
    if (type === T.ARMOR || type === T.ARMOR_INFANTRY || type === T.MECH_INFANTRY) return 'armor';
    if (type === T.ARTILLERY) return 'fireSupport';
    if (type === T.RECON) return 'recon';
    if (type === T.MEDIC || type === T.ENGINEER) return 'support';
    return 'line';
}

function situationSectorForX(x) {
    if (x < WORLD_W / 3) return 'left';
    if (x > WORLD_W * 2 / 3) return 'right';
    return 'center';
}

function emptySector() {
    return { friendlyValue: 0, enemyValue: 0, ratio: null, contactConfidence: 0, softenedValue: 0, softening: 0 };
}

function postureFromRatio(ratio, confidence) {
    if (confidence < 0.2 || !Number.isFinite(ratio)) return FORCE_POSTURE.UNKNOWN;
    if (ratio >= 1.25) return FORCE_POSTURE.ADVANTAGE;
    if (ratio <= 0.8) return FORCE_POSTURE.DISADVANTAGE;
    return FORCE_POSTURE.PARITY;
}

// FAZ 7 — OPERASYONEL DURUŞ (SHAPE/POSITION/STRIKE/PRESERVE) + TAARRUZ-KAPISI.
// Modern doktrin: varsayılan STRIKE değil SHAPE'tir. AI "STRIKE'ta doğmaz"; taarruz sayılabilir koşullar
// sağlanınca AÇILIR (kuvvet-oranı ≥ eşik + bilgi-tazeliği + mühimmat). Eşik role+urgency ile sönümlenir:
// SALDIRAN'ın eşiği süre ilerledikçe düşer (saatı boşa harcarsa savunan kazanır); SAVUNAN yüksek tutar
// (kuvvet-koru + süreyi tüket). Deterministik: yalnız situation'daki yuvarlanmış alanlardan türer, RNG yok.
const OPERATIONAL_POSTURE = Object.freeze({
    SHAPE: 'SHAPE',           // temas yok: keşif/ilerle+sondaj, kendini gösterme
    POSITION: 'POSITION',     // temas var ama kapı kapalı (saldıran): menzilde şekillendir, pencereyi bekle
    STRIKE: 'STRIKE',         // kapı açık: konsantre kapat-ez
    CONSOLIDATE: 'CONSOLIDATE',// baskın+mühimmat-düşük+zaman-var: DORUK-noktası — dur, ikmal et, aşırı-uzanma
    PRESERVE: 'PRESERVE'      // temas var ama kapı kapalı (savunan): hattı tut, kuvvet-koru, saati tüket
});
const STRIKE_GATE = Object.freeze({
    ATTACKER_BASE: 1.15,        // saldıran temel eşik (yerel üstünlük ara)
    ATTACKER_URGENCY_DROP: 0.75,// ANALİST-FIX (assault-takvim): urgency 1'e giderken eşik 1.15→0.40 (0.5→0.75; saldıran zamanla mecbur-saldır). Felç yerine takvim.
    MAX_POSITION_TICKS: 1600,   // ANALİST-FIX: saldıran POSITION'da en çok ~80s bekler → sonra MECBUR taarruz (assembly'de erime yerine en-az-kötü-eksen)
    COMMIT_DEADLINE_TP: 0.36,   // ANALİST-KRİTER: ilk-STRIKE t<90 → deadline t≈86 (backstop bile <90). Stance-osilasyonu felce sokamaz.
    DEFENDER_BASE: 2.0,         // ANALİST-FIX(b): savunan HAZIR-MEVZİYİ ancak ~2:1 net-üstünlükte terk eder (taarruzdan yüksek kanıt ister)
    DEFENDER_VIS_MIN: 0.7,      // + görünürlük şartı: temasların ≥%70'i GÖRÜNÜR olmadan mevziden çıkma (bayat-temasa güvenme)
    PRESERVE_RATIO: 0.6,        // savunan bu oranın altında → erken PRESERVE (mevziyi tut, 0.01'e kadar bekleme)
    DEFENDER_URGENCY_DROP: 0.1, // savunan saati istiyor; urgency eşiği az kıpırdatır
    MIN_CONFIDENCE: 0.35,       // bilgi-tazeliği: kör taarruz etme (urgency override eder)
    MIN_AMMO: 0.2,              // kuru orduyla taarruz etme
    DESPERATION_TP: 0.55,       // ANALİST-FIX: saldıran daha ERKEN koşulsuz-taarruz (0.8→0.55; t=209 "ölmüş hastaya defibrilatör"du → ~t=130'a çek)
    HYSTERESIS: 0.28,           // HİSTEREZİS: aç ≥eşik, ama açıkken yalnız (eşik-0.28) altında KAPAT → titreme biter + STRIKE-penceresi oluşur (aç-kapa flicker yerine sürekli pencere)
    STRIKE_DWELL: 320,          // ANALİST-FIX(intel4): STRIKE min-kalış ~16s → şok/urgency STRIKE'ı 1-tik forceRatio-dip'i çökertmesin (t50→t51 osilasyonu bitir)
    STRIKE_ABORT_RATIO: 0.7,    // dwell içinde bile: kuvvet bu oranın altına çökerse STRIKE'ı BIRAK (kilitli-ölüm yok)
    URGENCY_ABORT_RATIO: 0.35,  // ANALİST-FIX(Suçlu-1): urgency/şok COMMIT'i oran-vetosuna KAPALI — yalnız UMUTSUZ (oran<0.35) commit'i kırar. "urgency=oran-kötü-ama-mecbur" → 0.7-veto mantıksal-çelişkiydi (t100:STRIKE→t101:POSITION 30s-askı)
    SHOCK_HOLD_TICKS: 60        // şok-sinyali min-hold ~3s (anlık-tepe-düşüş testinin tik-tik titremesini yumuşat)
});
// DOKTRİN↔POSTURE: doktrine göre taarruz-eşiği bias'ı → "her maç farklı RİTİM" (indeks BATTLE_DOCTRINE_NAMES ile hizalı).
// NEGATİF=daha erken/agresif taarruz, POZİTİF=daha uzun şekillendir/yıprat (nadir STRIKE). Analist: topçu şekillendirir,
// manevra fırsatçı vurur, drone/hava-savunma yıpratıp bekler, zırh-mızrağı erken ezer.
const DOCTRINE_STRIKE_BIAS = [
    0.00,   // 0 dengeli
   -0.15,   // 1 zirh-mizragi: erken ez (zırh kütlesiyle dal)
   -0.06,   // 2 piyade-dalgasi: hafif agresif (dalga)
   +0.22,   // 3 topcu: dolaylı-ateşle YIPRAT, geç taarruz
   +0.10,   // 4 hava-harekati: önce SEAD/hava-hakimiyeti, sonra vur
   +0.14,   // 5 tanksavar-pusu: bekle-pusu, reaktif
   -0.18,   // 6 hareketli-vurkac: fırsatçı hızlı vuruşlar
   +0.20,   // 7 hava-savunma-agi: alan-inkarı, taarruzu reddet
   +0.18    // 8 drone-yogun: sürüyle yıprat, doğrudan-taarruzdan kaçın
];
function computeOperationalPosture(o) {
    const ATT = (typeof BATTLE_ROLE !== 'undefined') ? BATTLE_ROLE.ATTACKER : 'attacker';
    const isAtt = o.role === ATT;
    const base = isAtt ? STRIKE_GATE.ATTACKER_BASE : STRIKE_GATE.DEFENDER_BASE;
    const drop = isAtt ? STRIKE_GATE.ATTACKER_URGENCY_DROP : STRIKE_GATE.DEFENDER_URGENCY_DROP;
    const dBias = DOCTRINE_STRIKE_BIAS[(o.doctrine | 0)] || 0;   // DOKTRİN↔POSTURE: eşik bias'ı (farklı ritim)
    const threshold = base - drop * (o.timePressure || 0) + dBias;
    // ASSAULT-TAKVİM (analist, 2-kez-doğrulandı): saldıranın MUTLAK-ZAMAN commit-deadline'ı — stance-osilasyonundan (SHAPE↔POSITION
    // temas-söndükçe) BAĞIMSIZ. POSITION-timer osilasyonda sıfırlanıp felç üretiyordu; artık timeProgress-tabanlı mecbur-taarruz.
    const commitDeadline = isAtt && (o.timeProgress || 0) >= STRIKE_GATE.COMMIT_DEADLINE_TP;   // ~t=91: en-az-kötü-eksenden taarruz
    const positionStuck = isAtt && o.prevStance === OPERATIONAL_POSTURE.POSITION &&
        ((o.now || 0) - (o.prevStanceTick || 0)) >= STRIKE_GATE.MAX_POSITION_TICKS;
    const desperate = isAtt && ((o.timePressure || 0) >= STRIKE_GATE.DESPERATION_TP || positionStuck || commitDeadline);
    const hasContact = o.contactState === CONTACT_STATE.CONTACT;
    // FAZ-C (analist 777): TEMAS-SOLMASI GRACE — STRIKE/gate-açıkken anlık-temas-kaybı (≤3s) STRIKE-korumasını düşürmesin (pinpon-bitir).
    // Yalnız STRIKE-TUTMA yollarında (commit/dwell/stance-SHAPE) kullanılır; STRIKE-AÇMA hâlâ GERÇEK temas ister.
    const CONTACT_GRACE_TICKS = 60;   // ~3s
    const hasContactGraced = hasContact || ((o.prevGateOpen || o.prevStance === OPERATIONAL_POSTURE.STRIKE) && (o.ticksSinceContact || 99999) <= CONTACT_GRACE_TICKS);
    // SÖMÜRÜ-TETİĞİ (şok-penceresi): son ~4s'de düşman-değeri ani düştü (kamikaze/komando/topçu bir yığını sildi) →
    // fırsat penceresini YAKALA: gate-aç + duruş-kilidini aş. Kritik-zayıf değilsek (oran≥0.85) — savunanda da geçerli (yerel kontra).
    // Analist: "AI şok YARATABİLİYOR ama HARCAYAMIYOR" → izleyenden CEVAP-VERENe geçişin vidası.
    const _dShock = (typeof BATTLE_INTEL4_DELTAS === 'undefined' || BATTLE_INTEL4_DELTAS.shock !== false);
    const shock = !!o.intel4 && _dShock && !!o.shockWindow && hasContact && (o.ammoReadiness || 0) >= STRIKE_GATE.MIN_AMMO && Number.isFinite(o.forceRatio) && o.forceRatio >= 0.85;   // INTEL4-delta 'shock': şok-sömürü tetiği (flag-off=intel3pro'da yok)
    // HİSTEREZİS: açıkken eşik DÜŞER (yalnız net-dezavantajda kapat) → 500ms'lik aç-kapa flicker biter, STRIKE bir PENCERE olur
    const effThreshold = o.prevGateOpen ? (threshold - STRIKE_GATE.HYSTERESIS) : threshold;
    const ratioOK = Number.isFinite(o.forceRatio) && o.forceRatio >= effThreshold;
    // ERKEN-KEŞİF-KİLİDİ (analist "önce sensörle savaş"): ilk fazda (recon shaping) daha YÜKSEK bilgi iste →
    // AI sisten sahte-güvenle körlemesine dalmasın; önce tarasın. Yakın-temas (düşman kapıda) veya urgency bunu geçer.
    const early = isAtt && !o.prevGateOpen && (o.timeProgress || 0) < 0.30 && !desperate;
    const infoFloor = early ? 0.55 : STRIKE_GATE.MIN_CONFIDENCE;
    const infoOK = o.prevGateOpen || (o.contactConfidence || 0) >= infoFloor || desperate;   // açıkken confidence-dip taarruzu iptal etmesin (zaten temastasın)
    const ammoOK = (o.ammoReadiness || 0) >= STRIKE_GATE.MIN_AMMO;   // kuruyunca DUR (histerezissiz — ikmal penceresi doğru)
    // ANALİST-FIX(b): SAVUNAN hazır-mevzi terk için GÖRÜNÜRLÜK şartı — temasların ≥%70'i görünmeden mevziden çıkma (bayat-temas yalanına kanma)
    const visOK = isAtt || o.visibleRatio == null || (o.visibleRatio >= STRIKE_GATE.DEFENDER_VIS_MIN);
    // ── FAZ-T1 (taarruz-doktrini, 'attack'-delta): YUMUŞATMA-KOŞULLU STRIKE ──
    // T0-ölçümü: intel4-saldıran maxDom>1.0'a ULAŞIYOR ama ERİYOR (çıplak/erken taarruz → over-extend→imha). Çözüm: kapıyı
    // SAATTEN değil HEDEF-SEKTÖR-YUMUŞATMASINDAN aç. Eşik dinamik (ana-çaba/hedef-sektör oranına göre): zayıf-sektör→az-törpü iste,
    // güçlü→çok. Urgency (t≥150) yalnız SON-ÇARE (barajla senkron T3'te; burada çıplak-mecbur kapısı). intel3pro/flag-off = eski davranış.
    let t1Active = false, t1Softened = false, t1Urgency = false, t1Threshold = 0;
    if (o.attackDelta && isAtt) {
        t1Active = true;
        const _tr = o.targetRatio || 0;
        t1Threshold = _tr >= 1.5 ? 0.20 : (_tr >= 1.0 ? 0.30 : 0.40);   // dinamik yumuşatma-eşiği (kilitli-tablo)
        t1Softened = (o.targetSoftening || 0) >= t1Threshold && hasContact && ammoOK && infoOK;
        t1Urgency = (o.timeProgress || 0) >= 0.417 && hasContact && ammoOK;   // t≈150/360 son-çare (çıplak-mecbur)
    }
    // ── FAZ-A (analist 909): ŞOK-SÖMÜRÜ R-T1'i DELMESİN ──
    // 909'da t=36 yerel-küçük-şok tüm taarruzu yumuşamamış hatta açtı → eridi (17-28). 2024'te şok BÜYÜKtü (drone 3857 hasar) → kazandı.
    // Kural: attack-delta'da şok TAM-taarruz açar ANCAK (yumuşatma ≥ eşiğin %65'i) VEYA (şok BÜYÜK: değer-kaybı ≥%25). Aksi halde şok
    // yerel kalır (gate açma → POSITION'da yumuşatmayı beklemeye devam). "Şok gördüm→herkes hücum" değil "şok kadar kuvvet".
    let shockFull = shock;
    if (t1Active && shock) {
        const _softEnough = (o.targetSoftening || 0) >= 0.65 * t1Threshold;
        const _bigShock = (o.shockMagnitude || 0) >= 0.25;
        shockFull = _softEnough || _bigShock;
    }
    let gateOpen = t1Active
        ? (t1Softened || t1Urgency || shockFull)
        : (desperate || shock || (hasContact && ratioOK && infoOK && ammoOK && visOK));
    // ANALİST-FIX(c): SAVUNAN kaybediyorsa (oran<0.6) kapıyı ZORLA-KAPAT → erken PRESERVE (mevziyi tut, 0.01'e kadar çökme bekleme)
    const losing = !isAtt && Number.isFinite(o.forceRatio) && o.forceRatio < STRIKE_GATE.PRESERVE_RATIO;
    if (losing) gateOpen = false;
    // DORUK-NOKTASI (culminating point): saldıran baskın (oran>2) ama YIPRANMIŞ (mühimmat VEYA can düşük) ve zaman VAR →
    // ezmeyi sürdürmek yerine DUR + ikmal/tamir et (aşırı-uzanan kuvvet imha olur). desperate ile çakışmaz (tp aralıkları ayrık).
    const worn = (o.ammoReadiness || 0) < 0.4 || (o.hpReadiness || 1) < 0.55;
    const consolidate = isAtt && !desperate && Number.isFinite(o.forceRatio) && o.forceRatio > 2.0
        && worn && (o.timePressure || 0) < 0.6;
    // ANALİST-FIX(intel4, flag-kapılı): STRIKE min-kalış (dwell). Şok/urgency STRIKE sıfır-kalışlıydı → 1-tik forceRatio-dip
    // (veya shockWindow/vis titremesi) STRIKE'ı çökertip osilasyon yapıyordu (t50→t51, t85-96 arası 23 geçiş). Dwell içinde
    // gate'i TUT — ama gerçek dur-koşulları (mühimmat-bitişi, savunan-kaybı, doruk-konsolide, kuvvet-çöküşü<0.7) override eder.
    let dwellHold = false;
    let strikeCommit = false;
    if (o.intel4 && (typeof BATTLE_INTEL4_DELTAS === 'undefined' || BATTLE_INTEL4_DELTAS.stance !== false)) {   // INTEL4-delta 'stance'
        // ── ANALİST-FIX Suçlu-1: URGENCY-COMMIT KİLİDİ ──
        // urgency(desperate)/şok STRIKE'ı AÇTIĞINDA, kuvvet-oranı bir-tik-dip'iyle GERİ KAPANMASIN. "urgency" zaten
        // "oran kötü ama mecbursun" demek → oranla (STRIKE_ABORT_RATIO=0.7) veto etmek mantıksal çelişki (t100:STRIKE(urgency)
        // →t101:POSITION(kuvvet-orani)→t130:STRIKE, taarruz 30s ateş-altında askıda). Commit, GERÇEK-stop'a dek STRIKE'ı tutar:
        // mühimmat-bitişi / doruk-konsolide / savunan-kaybı / oran UMUTSUZ(<0.35) / temas-yok. desperate flicker'ından bağımsız latch.
        const urgencyDrive = desperate || shockFull || t1Softened || t1Urgency;   // T1: yumuşatma/urgency/BÜYÜK-şok STRIKE'ı commit-latch'le tut (sınırlı-şok latch'lemez → FAZ-A)
        const wasCommitted = !!o.prevStrikeCommit && o.prevStance === OPERATIONAL_POSTURE.STRIKE && hasContactGraced;   // FAZ-C: grace ile anlık-temas-solmasında commit düşmez
        // FAZ0+FAZ1 (analist): urgency-commit'te KUVVET-ORANI VETOSU DEVRE-DIŞI (urgency=oran-kötü-ama-mecbur → oranla kırmak çelişki).
        // Askıya-alma YALNIZ İPTAL-KRİTERİYLE: mühimmat-bitişi / doruk-konsolide / savunan-kaybı / temas-yok / + FAZ1 KAYIP-TABANLI-İPTAL
        // (kilitli-karar "iptal=role-göre-dinamik"): kuvvet ~%70'ten çok yıprandıysa (hpReadiness<eşik) taarruzu bırak (kıyma-makinesine
        // asker atma). Oran DEĞİL kendi-kaybı bozar → "anlık-okuma planı devirmez, yalnız iptal-kriteri devirir" (operasyon-nesnesi ilkesi).
        const lossFloor = isAtt ? 0.30 : 0.22;   // saldıran daha çok yıpranmaya dayanır; savunan mevzi-kaybında zaten 'losing'→PRESERVE
        const lossAbort = Number.isFinite(o.hpReadiness) && o.hpReadiness < lossFloor;
        const commitBroken = !ammoOK || consolidate || losing || !hasContactGraced || lossAbort;   // FAZ-C: temas-yok grace'li (anlık-solma commit'i kırmaz)
        const committedHold = (urgencyDrive || wasCommitted) && !commitBroken;
        if (committedHold) { gateOpen = true; strikeCommit = true; }   // KİLİT: urgency-commit oran-vetosunu geçer

        // STRIKE min-kalış (dwell): şok/urgency-DIŞI STRIKE'ın 1-tik dip'e karşı ~16s korunması (osilasyon-bitir).
        const inStrikeDwell = o.prevStance === OPERATIONAL_POSTURE.STRIKE &&
            ((o.now || 0) - (o.prevStanceTick || 0)) < STRIKE_GATE.STRIKE_DWELL;
        const dwellHardStop = !ammoOK || losing || consolidate ||
            (Number.isFinite(o.forceRatio) && o.forceRatio < STRIKE_GATE.STRIKE_ABORT_RATIO);
        if (!gateOpen && inStrikeDwell && hasContactGraced && !dwellHardStop) { gateOpen = true; dwellHold = true; }   // FAZ-C: grace'li
    }
    let stance;
    if (losing) stance = OPERATIONAL_POSTURE.PRESERVE;   // kaybeden savunan: mevziyi tut
    else if (consolidate) { stance = OPERATIONAL_POSTURE.CONSOLIDATE; gateOpen = false; }
    else if (gateOpen) stance = OPERATIONAL_POSTURE.STRIKE;
    else if (!hasContactGraced) stance = OPERATIONAL_POSTURE.SHAPE;   // FAZ-C: anlık-temas-solmasında SHAPE'e düşme (grace) → POSITION'da kal
    else stance = isAtt ? OPERATIONAL_POSTURE.POSITION : OPERATIONAL_POSTURE.PRESERVE;
    // ANALİST-FIX: STANCE HİSTEREZİSİ (titreme=saniyede-bir-duruş bug'ı). non-STRIKE duruşlar (SHAPE/POSITION/PRESERVE)
    // arası flicker'ı kilitle: min-süre önceki duruşu tut. STRIKE giriş/çıkış gate-histerezisiyle zaten korunur;
    // losing (kriz) hemen PRESERVE'e geçer (kilit dinlemez). gateOpen non-STRIKE'ta zaten false → tutarlılık bozulmaz.
    let stanceTick = o.now || 0;
    const STANCE_LOCK = 400;   // ~20s: deliberate duruş sabit kalır, sub-saniye flicker biter (main-effort 70s kilidin muadili)
    if (o.prevStance && o.prevStance !== OPERATIONAL_POSTURE.STRIKE && stance !== OPERATIONAL_POSTURE.STRIKE
        && stance !== o.prevStance && !losing && !shock && (( o.now || 0) - (o.prevStanceTick || 0)) < STANCE_LOCK) {
        stance = o.prevStance; stanceTick = o.prevStanceTick || (o.now || 0);   // kilitli: önceki non-STRIKE duruşu koru
    } else if (stance === o.prevStance) {
        stanceTick = o.prevStanceTick || (o.now || 0);   // aynı duruş → giriş-tik'ini koru
    }
    return {
        stance,
        stanceTick,
        strikeGateOpen: gateOpen,
        strikeCommit,   // ANALİST-FIX Suçlu-1: urgency-commit latch (sonraki tik prevStrikeCommit olur)
        strikeThreshold: Math.round(threshold * 100) / 100,
        // FAZ-T1 telemetri (attack-delta): kabul-testi "STRIKE-anı ort-yumuşatma ≥ eşik" bunlardan ölçülür
        t1Threshold: t1Active ? t1Threshold : null,
        t1Softening: t1Active ? (o.targetSoftening || 0) : null,
        t1Ratio: t1Active ? (o.targetRatio || 0) : null,
        gateReason: losing ? 'kaybediyor-preserve'
                  : consolidate ? 'doruk-konsolide'
                  : gateOpen ? (t1Active ? (t1Softened ? 'yumusatma-hazir' : t1Urgency ? 'urgency-t150' : shock ? 'sok-somuru' : strikeCommit ? 'urgency-commit' : dwellHold ? 'strike-dwell' : 'kosul-sagli')
                                       : (desperate ? 'urgency' : shock ? 'sok-somuru' : strikeCommit ? 'urgency-commit' : dwellHold ? 'strike-dwell' : 'kosul-sagli'))
                  : !hasContact ? 'temas-yok'
                  : t1Active ? 'yumusatma-bekle'   // T1: kapı açık değilse sebep = hedef-sektör yeterince törpülenmedi
                  : !ratioOK ? 'kuvvet-orani'
                  : !visOK ? 'gorunurluk-dusuk'
                  : !infoOK ? 'kesif-bayat'
                  : !ammoOK ? 'muhimmat-dusuk' : 'tut'
    };
}

class SituationAnalyzer {
    constructor(controller) {
        this.controller = controller;
        this.lastAnalysis = null;
    }

    analyze(observation) {
        if (!observation) return null;
        const ownUnits = observation.ownUnits || [];
        const contacts = observation.contacts || [];
        const visibleContacts = contacts.filter(contact => contact.visible);
        const avgConfidence = contacts.length
            ? contacts.reduce((sum, contact) => sum + contact.confidence, 0) / contacts.length
            : 0;
        const contactState = visibleContacts.length
            ? CONTACT_STATE.CONTACT
            : contacts.length ? CONTACT_STATE.UNCERTAIN : CONTACT_STATE.NO_CONTACT;
        // FAZ-C (analist 777): TEMAS-SOLMASI GRACE — STRIKE-sömürü ortasında anlık-temas-kaybı duruşu düşürmesin. Son-temas tik'ini izle.
        if (contactState === CONTACT_STATE.CONTACT) this._lastContactTick = observation.tick;
        const ticksSinceContact = (this._lastContactTick != null) ? (observation.tick - this._lastContactTick) : 99999;

        const categories = {
            friendly: { armor: 0, fireSupport: 0, recon: 0, support: 0, line: 0 },
            enemy: { armor: 0, fireSupport: 0, recon: 0, support: 0, line: 0 }
        };
        const sectors = { left: emptySector(), center: emptySector(), right: emptySector() };
        let hpReadiness = 0;
        let ammoReadiness = 0;
        let friendlyX = 0;
        let friendlyY = 0;

        for (const unit of ownUnits) {
            const stats = STATS[unit.type];
            const value = (stats?.cost || 0) * Math.max(0, Math.min(1, unit.hpRatio));
            const category = situationUnitCategory(unit.type);
            categories.friendly[category] += value;
            sectors[situationSectorForX(unit.x)].friendlyValue += value;
            hpReadiness += Math.max(0, Math.min(1, unit.hpRatio));
            ammoReadiness += Math.max(0, Math.min(1, unit.ammoRatio));
            friendlyX += unit.x;
            friendlyY += unit.y;
        }

        for (const contact of contacts) {
            const stats = STATS[contact.typeEstimate];
            const healthFactor = contact.healthBand === 'HEALTHY' ? 1 :
                contact.healthBand === 'DAMAGED' ? 0.66 : 0.33;
            const value = (stats?.cost || 0) * healthFactor * contact.confidence;
            const category = situationUnitCategory(contact.typeEstimate);
            categories.enemy[category] += value;
            const sector = sectors[situationSectorForX(contact.x)];
            sector.enemyValue += value;
            sector.contactConfidence = Math.max(sector.contactConfidence, contact.confidence);
            // T0-TELEMETRİ (analist): SEKTÖR-YUMUŞATMA — hasar-görmüş(görev-dışı/imhaya-yakın) düşman değeri. healthBand intelligenceFloor'lu
            // gözlemden → hilesiz. suppressed-effekt forensik-ring'te (T1'de eklenir); şimdilik sağlık-tabanlı yumuşatma (imha/ağır-hasar).
            if (contact.healthBand && contact.healthBand !== 'HEALTHY') sector.softenedValue += value;
        }

        for (const sector of Object.values(sectors)) {
            sector.friendlyValue = Math.round(sector.friendlyValue * 100) / 100;
            sector.enemyValue = Math.round(sector.enemyValue * 100) / 100;
            sector.softening = sector.enemyValue > 0 ? Math.round((sector.softenedValue / sector.enemyValue) * 100) / 100 : 0;   // yumuşatma-oranı (0-1)
            sector.softenedValue = Math.round(sector.softenedValue * 100) / 100;
            sector.ratio = sector.enemyValue > 0
                ? Math.round((sector.friendlyValue / sector.enemyValue) * 100) / 100
                : sector.friendlyValue > 0 ? Infinity : null;
            sector.contactConfidence = Math.round(sector.contactConfidence * 1000) / 1000;
        }

        const friendlyValue = Math.max(0, observation.friendlyValue || 0);
        const estimatedEnemyValue = Math.max(0, observation.estimatedEnemyValue || 0);
        // Düşman neredeyse tamamen doğrulanmış-ölü iken payda 1-2₺'ye düşüp oran binlere fırlıyordu
        // (ölçüldü: 4798). Tüm eşikler <2 olduğu için 20'de doyurmak davranışı değiştirmez, log'u temizler.
        const forceRatio = estimatedEnemyValue > 0 ? Math.min(20, friendlyValue / estimatedEnemyValue) : null;
        const battle = SIM.battle || {};
        const role = typeof battleRoleForSide === 'function'
            ? battleRoleForSide(this.controller.side)
            : 'attacker';
        const timeProgress = battle.active
            ? Math.max(0, Math.min(1, (battle.elapsedSec || 0) / Math.max(1, battle.durationSec || 1)))
            : 0;
        const timePressure = role === BATTLE_ROLE.ATTACKER
            ? Math.max(0, Math.min(1, (timeProgress - 0.35) / 0.65))
            : Math.max(0, Math.min(1, timeProgress * 0.35));
        const friendlyCentroid = ownUnits.length ? {
            x: friendlyX / ownUnits.length,
            y: friendlyY / ownUnits.length
        } : null;
        const closestContactDistance = friendlyCentroid && contacts.length
            ? Math.min(...contacts.map(contact => Math.hypot(
                contact.x - friendlyCentroid.x,
                contact.y - friendlyCentroid.y
            )))
            : null;

        // SÖMÜRÜ-TETİĞİ verisi (şok-penceresi): düşman-değerinin son ~4s'deki DORUĞUNA göre ani-düşüşünü izle.
        // estimatedEnemyValue TEYİTLİ-imha-tabanlı (intel-fix) → kamikaze/komando/topçu bir yığını silince ANİ düşer = ŞOK.
        // AI şoku YARATABİLİYOR ama HARCAYAMIYORDU (analist: t112 PRESERVE→t117 kamikaze 5-öldürdü→sömürü GELMEDİ).
        const SHOCK_WINDOW_TICKS = 80;   // ~4s
        this._evHist = this._evHist || [];
        this._evHist.push({ t: observation.tick, v: estimatedEnemyValue });
        while (this._evHist.length && (observation.tick - this._evHist[0].t) > SHOCK_WINDOW_TICKS) this._evHist.shift();
        let _evPeak = estimatedEnemyValue;
        for (const _e of this._evHist) if (_e.v > _evPeak) _evPeak = _e.v;
        // ANALİST-KORKULUĞU: t=0'da algı-init spike'ı yerleşince sahte "tepe-düşüş" → şoksuz-STRIKE tetikliyordu. Şok ancak
        // TAM-pencere kadar geçmişse (tick≥window) + ≥3 örnekle ateşlenir (maç-başı sahte-şok önlenir). Determinist (tick-tabanlı).
        // FAZ0 (analist): şok-sömürüye t<15s KORKULUĞU — maç-açılışının algı-init/taciz-gürültüsü sahte-şok üretip erken-dalış tetiklemesin.
        const MIN_SHOCK_TICK = 300;   // ~15s
        const shockMagnitude = (_evPeak > 0) ? Math.max(0, (_evPeak - estimatedEnemyValue) / _evPeak) : 0;   // FAZ-A: şok-BÜYÜKLÜĞÜ (düşman değer-kaybı oranı) — küçük-şok tam-taarruz açmasın
        const shockWindow = observation.tick >= MIN_SHOCK_TICK && observation.tick >= SHOCK_WINDOW_TICKS && this._evHist.length >= 3 &&
            _evPeak > 0 && shockMagnitude >= 0.12;
        // INTEL4 (flag-kapılı): şok-sinyali min-hold — anlık-tepe-düşüş testinin tik-tik titremesini yumuşat (STRIKE-osilasyonunu besliyordu).
        const _brainIntel4 = (typeof battleBrainIntel4 === 'function') && battleBrainIntel4(this.controller.side);
        this._shockHoldUntil = this._shockHoldUntil || 0;
        if (shockWindow) this._shockHoldUntil = observation.tick + STRIKE_GATE.SHOCK_HOLD_TICKS;
        const _dStance = (typeof BATTLE_INTEL4_DELTAS === 'undefined' || BATTLE_INTEL4_DELTAS.stance !== false);   // şok-smoothing 'stance'-deltası
        // ANALİST-FIX (t=0 STRIKE savunma-bug'ı, 2 insan-maçı): _shockHoldUntil=0 + tick=0 → "0<=0"=TRUE → maç-başı SAHTE-şok (oyuncu
        // konuşlanınca hasContact→şok-sömürü t=0'da açılıyordu, savunma mevzisini bırakıp açık-karşılamaya çıkıyordu). MIN_SHOCK_TICK(300)
        // korkuluğu ham-shockWindow'daydı ama smoothed onu atlıyordu. Şart: _shockHoldUntil>0 (gerçek-şok onu SET etmeden smoothed true olamaz).
        const shockSmoothed = (_brainIntel4 && _dStance) ? (this._shockHoldUntil > 0 && observation.tick <= this._shockHoldUntil) : shockWindow;

        const finiteSectorEntries = Object.entries(sectors).filter(([, sector]) => Number.isFinite(sector.ratio));
        const weakestFriendlySector = finiteSectorEntries.length
            ? finiteSectorEntries.slice().sort((a, b) => a[1].ratio - b[1].ratio)[0][0]
            : null;
        const weakestEnemySector = finiteSectorEntries.length
            ? finiteSectorEntries.slice().sort((a, b) => b[1].ratio - a[1].ratio)[0][0]
            : null;

        this.lastAnalysis = {
            tick: observation.tick,
            side: this.controller.side,
            role,
            threatProfile: observation && observation.threatProfile || null,   // TEHDİT-PROFİLİ: forensik-inanç (perception'dan); reaksiyon/telemetri okur
            contactState,
            contactCount: contacts.length,
            visibleContactCount: visibleContacts.length,
            contactConfidence: Math.round(avgConfidence * 1000) / 1000,
            friendlyValue: Math.round(friendlyValue * 100) / 100,
            estimatedEnemyValue: Math.round(estimatedEnemyValue * 100) / 100,
            forceRatio: Number.isFinite(forceRatio) ? Math.round(forceRatio * 100) / 100 : null,
            forcePosture: postureFromRatio(forceRatio, avgConfidence),
            operationalPosture: computeOperationalPosture({
                role,
                forceRatio,
                contactState,
                contactConfidence: avgConfidence,
                visibleRatio: contacts.length ? (visibleContacts.length / contacts.length) : 1,   // ANALİST-FIX(b): görünür/toplam temas oranı (savunan mevzi-terk şartı)
                ammoReadiness: ownUnits.length ? (ammoReadiness / ownUnits.length) : 0,
                hpReadiness: ownUnits.length ? (hpReadiness / ownUnits.length) : 1,
                timePressure,
                timeProgress,
                doctrine: (ownUnits[0] && typeof ownUnits[0].deployDoctrine === 'number') ? ownUnits[0].deployDoctrine : 0,   // DOKTRİN-KİMLİK: kendi birimlerinden (hepsi aynı doktrin), per-side
                prevGateOpen: !!(this.lastAnalysis && this.lastAnalysis.operationalPosture && this.lastAnalysis.operationalPosture.strikeGateOpen),
                prevStance: this.lastAnalysis && this.lastAnalysis.operationalPosture && this.lastAnalysis.operationalPosture.stance,   // STANCE-HİSTEREZİS
                prevStanceTick: this.lastAnalysis && this.lastAnalysis.operationalPosture && this.lastAnalysis.operationalPosture.stanceTick,
                prevStrikeCommit: !!(this.lastAnalysis && this.lastAnalysis.operationalPosture && this.lastAnalysis.operationalPosture.strikeCommit),   // ANALİST-FIX Suçlu-1: urgency-commit latch geri-besleme
                shockWindow: shockSmoothed,   // SÖMÜRÜ-TETİĞİ: şok anı → gate-aç + duruş-kilidini aş (intel4'te min-hold yumuşatılmış)
                shockMagnitude,   // FAZ-A (analist 909): şok-büyüklüğü — R-T1'i delen küçük-şoku sınırlamak için
                ticksSinceContact,   // FAZ-C (analist 777): temas-solması grace için son-temastan beri geçen tik
                intel4: _brainIntel4,          // INTEL4 beyin-flag: STRIKE-dwell yalnız bu tarafın beyni intel4'se
                // FAZ-T1 (taarruz-doktrini): STRIKE kapısı saatten değil HEDEF-SEKTÖR YUMUŞATMA'sından açılır. Girdiler:
                attackDelta: (typeof battleDelta === 'function') && battleDelta(this.controller.side, 'attack'),
                targetSoftening: (weakestEnemySector && sectors[weakestEnemySector]) ? sectors[weakestEnemySector].softening : 0,   // hedef(en-zayıf düşman)-sektör yumuşatma-oranı
                targetRatio: (weakestEnemySector && sectors[weakestEnemySector] && sectors[weakestEnemySector].enemyValue > 0) ? Math.round((friendlyValue / sectors[weakestEnemySector].enemyValue) * 100) / 100 : (friendlyValue > 0 ? 9 : 0),   // ana-çaba / hedef-sektör düşman = dinamik-eşik girdisi
                now: observation.tick
            }),
            readiness: {
                hp: ownUnits.length ? Math.round((hpReadiness / ownUnits.length) * 1000) / 1000 : 0,
                ammo: ownUnits.length ? Math.round((ammoReadiness / ownUnits.length) * 1000) / 1000 : 0
            },
            categories: replayClone(categories),
            sectors: replayClone(sectors),
            weakestFriendlySector,
            weakestEnemySector,
            centroid: friendlyCentroid ? {
                x: Math.round(friendlyCentroid.x * 100) / 100,
                y: Math.round(friendlyCentroid.y * 100) / 100
            } : null,
            closestContactDistance: Number.isFinite(closestContactDistance)
                ? Math.round(closestContactDistance * 100) / 100
                : null,
            timeProgress: Math.round(timeProgress * 1000) / 1000,
            timePressure: Math.round(timePressure * 1000) / 1000
        };
        return this.lastAnalysis;
    }
}

function createCourseOfAction(kind, situation, reason, baseScore = 0) {
    return {
        kind,
        generatedAtTick: situation.tick,
        reason,
        baseScore,
        score: null,
        eligible: true,
        constraints: [],
        abortConditions: []
    };
}

class CourseOfActionGenerator {
    generate(situation) {
        if (!situation) return [];
        const candidates = [];
        if (situation.contactState === CONTACT_STATE.NO_CONTACT) {
            candidates.push(createCourseOfAction(BATTLE_PLAN_KIND.SEARCH, situation, 'Düşman teması yok', 50));
            candidates.push(createCourseOfAction(BATTLE_PLAN_KIND.ADVANCE, situation, 'Görev yönünde kontrollü temas ara', 40));
            if (situation.role === BATTLE_ROLE.DEFENDER) {
                candidates.push(createCourseOfAction(BATTLE_PLAN_KIND.HOLD, situation, 'Savunma görevinde teması bekle', 55));
            }
            return candidates;
        }

        const isAttacker = situation.role === BATTLE_ROLE.ATTACKER;
        const hasFireSupport = (situation.categories?.friendly?.fireSupport || 0) > 0;
        const closeDefensiveThreat = Number.isFinite(situation.closestContactDistance) &&
            situation.closestContactDistance <= 450;
        candidates.push(createCourseOfAction(BATTLE_PLAN_KIND.HOLD, situation, 'Mevcut düzeni koru', 35));
        if (situation.forcePosture === FORCE_POSTURE.ADVANTAGE) {
            if (isAttacker) {
                candidates.push(createCourseOfAction(BATTLE_PLAN_KIND.MAIN_ATTACK, situation, 'Tahmini kuvvet üstünlüğü', 60));
                candidates.push(createCourseOfAction(BATTLE_PLAN_KIND.FIX_AND_FLANK, situation, 'Zayıf düşman sektöründen yararlan', 65));
            } else {
                if (hasFireSupport) {
                    candidates.push(createCourseOfAction(
                        BATTLE_PLAN_KIND.FIRE_PREPARATION,
                        situation,
                        'Savunma ateş desteğiyle yaklaşan kuvveti yıprat',
                        52
                    ));
                }
                if (closeDefensiveThreat && (situation.forceRatio ?? 0) >= 1.15) {
                    candidates.push(createCourseOfAction(
                        BATTLE_PLAN_KIND.COUNTERATTACK,
                        situation,
                        'Savunma hattına giren zayıflamış kuvvete sınırlı karşı taarruz',
                        48
                    ));
                }
            }
        } else if (situation.forcePosture === FORCE_POSTURE.DISADVANTAGE) {
            if (isAttacker) {
                // Saldıranın görevi süre dolmadan sonuç üretmektir. Kuvvet oranı
                // aleyhe döndüğünde taarruz adaylarını listeden tamamen çıkarmak,
                // REGROUP → DISENGAGE kilidi yaratıyor ve AI savaşı bırakıyordu.
                candidates.push(createCourseOfAction(
                    BATTLE_PLAN_KIND.REGROUP,
                    situation,
                    'Kısa süreli düzen kur; görevi terk etme',
                    48
                ));
                if (hasFireSupport) {
                    candidates.push(createCourseOfAction(
                        BATTLE_PLAN_KIND.FIRE_PREPARATION,
                        situation,
                        'Dezavantajı ateş yoğunluğuyla dengele',
                        52
                    ));
                }
                if (situation.timePressure >= 0.25) {
                    candidates.push(createCourseOfAction(
                        BATTLE_PLAN_KIND.MAIN_ATTACK,
                        situation,
                        'Görev süresi ilerliyor; yerel üstünlük zorla',
                        54
                    ));
                }
                if (situation.timePressure >= 0.45) {
                    candidates.push(createCourseOfAction(
                        BATTLE_PLAN_KIND.FIX_AND_FLANK,
                        situation,
                        'Ana teması sabitle ve erişilebilir kanattan çevir',
                        50
                    ));
                }
                const readiness = (situation.readiness.hp + situation.readiness.ammo) * 0.5;
                if (readiness < 0.24 || (situation.forceRatio ?? 1) < 0.25) {
                    candidates.push(createCourseOfAction(
                        BATTLE_PLAN_KIND.DISENGAGE,
                        situation,
                        'Organize savaş gücü fiziksel olarak çöktü',
                        45
                    ));
                }
            } else {
                // Savunan dezavantaj görünce yüzlerce saniye geri yürüyerek hattı
                // oyuncuya bedelsiz bırakmamalı. Kısa yeniden tertip ve ateş
                // desteği mümkün; tam çözülme yoksa esas görev hattı tutmaktır.
                candidates.push(createCourseOfAction(
                    BATTLE_PLAN_KIND.REGROUP,
                    situation,
                    'Yakın savunma mevzisinde kısa yeniden tertip',
                    44
                ));
                if (hasFireSupport) {
                    candidates.push(createCourseOfAction(
                        BATTLE_PLAN_KIND.FIRE_PREPARATION,
                        situation,
                        'Yaklaşan kuvveti ateşle yıprat',
                        50
                    ));
                }
                const readiness = (situation.readiness.hp + situation.readiness.ammo) * 0.5;
                if (readiness < 0.22 || (situation.forceRatio ?? 1) < 0.2) {
                    candidates.push(createCourseOfAction(
                        BATTLE_PLAN_KIND.DISENGAGE,
                        situation,
                        'Savunma savaş gücü fiziksel olarak çöktü',
                        42
                    ));
                }
            }
        } else {
            if (hasFireSupport) {
                candidates.push(createCourseOfAction(BATTLE_PLAN_KIND.FIRE_PREPARATION, situation, 'Temas var fakat kesin üstünlük yok', 50));
            }
            if (isAttacker) {
                candidates.push(createCourseOfAction(
                    BATTLE_PLAN_KIND.ADVANCE,
                    situation,
                    'Kesin üstünlük yok; temas hattına düzenli yaklaş',
                    46
                ));
                // SALDIRAN BASKISI: temas kurulunca MAIN_ATTACK / FIX_AND_FLANK'i ERKEN sun.
                // Eski davranış bunları yalnız timePressure≥0.55'te açıyordu → saldıran ~77s
                // ateş hazırlığında oturup kuşatılıyordu. Süre baskısı arttıkça taarruz skoru
                // zaten yükselir; ama seçenek en baştan masada olmalı.
                candidates.push(createCourseOfAction(
                    BATTLE_PLAN_KIND.MAIN_ATTACK,
                    situation,
                    'Temas kuruldu; taarruzla sonuç zorla',
                    54
                ));
                candidates.push(createCourseOfAction(
                    BATTLE_PLAN_KIND.FIX_AND_FLANK,
                    situation,
                    'Sabitle ve erişilebilir kanattan çevir',
                    52
                ));
            }
            if (situation.role === BATTLE_ROLE.DEFENDER && closeDefensiveThreat &&
                (situation.forceRatio ?? 0) >= 1.05) {
                candidates.push(createCourseOfAction(BATTLE_PLAN_KIND.COUNTERATTACK, situation, 'Savunma karşı taarruz ihtimali', 42));
            }
        }
        return candidates;
    }
}

class CourseOfActionEvaluator {
    constructor(controller) {
        this.controller = controller;
    }

    score(candidate, situation) {
        let score = candidate.baseScore || 0;
        const reasons = [];
        const readiness = (situation.readiness.hp + situation.readiness.ammo) * 0.5;
        const forceRatio = situation.forceRatio == null ? 1 : situation.forceRatio;
        const isAttacker = situation.role === BATTLE_ROLE.ATTACKER;
        const doctrine = this.controller.doctrine || 'combined';

        if (candidate.kind === BATTLE_PLAN_KIND.SEARCH) {
            score += situation.contactState === CONTACT_STATE.NO_CONTACT ? 30 : -50;
            score += categoriesReconShare(situation.categories.friendly) * 15;
        } else if (candidate.kind === BATTLE_PLAN_KIND.ADVANCE) {
            score += isAttacker ? 12 : -5;
            score += situation.timePressure * 20;
            score += readiness * 10;
        } else if (candidate.kind === BATTLE_PLAN_KIND.HOLD) {
            score += isAttacker ? -8 : 18;
            score += forceRatio < 1 ? 12 : 0;
            score += doctrine === 'defense' ? 12 : 0;
        } else if (candidate.kind === BATTLE_PLAN_KIND.MAIN_ATTACK) {
            score += (forceRatio - 1) * 28;
            score += readiness * 18;
            score += situation.timePressure * (isAttacker ? 35 : 22);
            score += doctrine === 'armor' ? 10 : 0;
            // SALDIRAN temasta hazır kuvvetle taarruzu tercih etsin (uzun ateş hazırlığında oturmasın)
            if (isAttacker && situation.contactState === CONTACT_STATE.CONTACT && readiness >= 0.4) score += 16;
        } else if (candidate.kind === BATTLE_PLAN_KIND.FIX_AND_FLANK) {
            score += (forceRatio - 0.9) * 20;
            score += categoriesMobileShare(situation.categories.friendly) * 18;
            score += situation.weakestEnemySector ? 8 : -12;
            score += doctrine === 'combined' ? 8 : 0;
            score += isAttacker ? situation.timePressure * 20 : 0;
        } else if (candidate.kind === BATTLE_PLAN_KIND.FIRE_PREPARATION) {
            const fireShare = categoriesFireShare(situation.categories.friendly);
            score += fireShare * 30;
            score += situation.contactConfidence * 12;
            score -= situation.timePressure * (isAttacker ? 25 : 12);
            // Saldıran için ateş hazırlığı KISA bir pencere olmalı, kalıcı postür değil.
            if (isAttacker) score -= 12;
        } else if (candidate.kind === BATTLE_PLAN_KIND.COUNTERATTACK) {
            score += isAttacker ? -20 : 12;
            score += Math.max(0, forceRatio - 0.85) * 20;
            score += readiness * 12;
        } else if (candidate.kind === BATTLE_PLAN_KIND.REGROUP) {
            score += Math.max(0, 1 - forceRatio) * 28;
            score += Math.max(0, 0.75 - readiness) * 25;
            score -= situation.timePressure * (isAttacker ? 15 : 8);
        } else if (candidate.kind === BATTLE_PLAN_KIND.DISENGAGE) {
            score += Math.max(0, 0.85 - forceRatio) * 35;
            score += Math.max(0, 0.55 - readiness) * 30;
            score -= isAttacker ? situation.timePressure * 24 : 0;
        }

        // FAZ 3: KUŞATMA yanlılığı — yanlardan/arkadan sarılıyorsa çekilme/toparlanmayı öne çıkar, saldırıyı bastır.
        // recommendedResponse: 'SCREEN_AND_WITHDRAW'→DISENGAGE, 'CONSOLIDATE'→REGROUP. Bayrakla A/B (varsayılan açık).
        const env = situation.envelopment;
        if ((typeof BATTLE_ANTI_ENVELOP === 'undefined' || BATTLE_ANTI_ENVELOP) && env && env.risk >= 0.5) {
            const r = env.risk;
            if (candidate.kind === BATTLE_PLAN_KIND.DISENGAGE) score += r * (env.recommendedResponse === 'SCREEN_AND_WITHDRAW' ? 60 : 35);
            else if (candidate.kind === BATTLE_PLAN_KIND.REGROUP) score += r * (env.recommendedResponse === 'CONSOLIDATE' ? 55 : 30);
            else if (candidate.kind === BATTLE_PLAN_KIND.MAIN_ATTACK || candidate.kind === BATTLE_PLAN_KIND.FIX_AND_FLANK || candidate.kind === BATTLE_PLAN_KIND.ADVANCE) score -= r * 45;
        }

        reasons.push(`base=${candidate.baseScore || 0}`);
        reasons.push(`force=${Math.round(forceRatio * 100) / 100}`);
        reasons.push(`readiness=${Math.round(readiness * 100) / 100}`);
        reasons.push(`time=${situation.timePressure}`);
        return {
            ...replayClone(candidate),
            score: Math.round(score * 100) / 100,
            scoreReasons: reasons
        };
    }

    evaluate(candidates, situation) {
        return (candidates || [])
            .filter(candidate => candidate.eligible !== false)
            .map(candidate => this.score(candidate, situation))
            .sort((a, b) => (b.score - a.score) || a.kind.localeCompare(b.kind));
    }
}

const PLAN_MIN_DURATION_TICKS = Object.freeze({
    [BATTLE_PLAN_KIND.SEARCH]: 120,
    [BATTLE_PLAN_KIND.ADVANCE]: 160,
    [BATTLE_PLAN_KIND.HOLD]: 240,
    [BATTLE_PLAN_KIND.MAIN_ATTACK]: 240,
    [BATTLE_PLAN_KIND.FIX_AND_FLANK]: 240,
    [BATTLE_PLAN_KIND.FIRE_PREPARATION]: 180,
    [BATTLE_PLAN_KIND.COUNTERATTACK]: 240,
    [BATTLE_PLAN_KIND.REGROUP]: 180,
    [BATTLE_PLAN_KIND.DISENGAGE]: 240
});
const ATTACKER_REGROUP_MAX_TICKS = Math.round(12 / BATTLE_TICK_SEC);
// Saldıran ateş hazırlığında en çok ~10s kalır; sonra hazırsa taarruza eskale eder
// (eski davranış 77s oturup kuşatılıyordu).
const ATTACKER_FIREPREP_MAX_TICKS = Math.round(10 / BATTLE_TICK_SEC);

function planReadiness(situation) {
    return ((situation?.readiness?.hp || 0) + (situation?.readiness?.ammo || 0)) * 0.5;
}

function evaluatePlanAbort(kind, situation) {
    if (!situation || !kind) return { abort: true, emergency: true, reason: 'SITUATION_LOST' };
    if (situation.friendlyValue <= 0) {
        return { abort: true, emergency: true, reason: 'NO_COMBAT_POWER' };
    }

    const readiness = planReadiness(situation);
    const ratio = situation.forceRatio;
    const offensive = kind === BATTLE_PLAN_KIND.MAIN_ATTACK ||
        kind === BATTLE_PLAN_KIND.FIX_AND_FLANK ||
        kind === BATTLE_PLAN_KIND.COUNTERATTACK;

    if (kind === BATTLE_PLAN_KIND.SEARCH && situation.contactState === CONTACT_STATE.CONTACT) {
        return { abort: true, emergency: true, reason: 'CONTACT_GAINED' };
    }
    if (kind === BATTLE_PLAN_KIND.ADVANCE &&
        situation.contactState === CONTACT_STATE.CONTACT &&
        situation.role !== BATTLE_ROLE.ATTACKER) {
        return { abort: true, emergency: true, reason: 'CONTACT_GAINED' };
    }
    if (offensive && readiness < 0.28) {
        return { abort: true, emergency: true, reason: 'CRITICAL_READINESS' };
    }
    if (offensive && ratio != null && ratio < 0.55 && situation.contactConfidence >= 0.5) {
        return { abort: true, emergency: true, reason: 'SEVERE_FORCE_DISADVANTAGE' };
    }
    const lateAttacker = situation.role === BATTLE_ROLE.ATTACKER &&
        situation.timePressure >= 0.72;
    if (offensive && readiness < (lateAttacker ? 0.34 : 0.45)) {
        return { abort: true, emergency: false, reason: 'LOW_READINESS' };
    }
    if (offensive && situation.forcePosture === FORCE_POSTURE.DISADVANTAGE &&
        !lateAttacker) {
        return { abort: true, emergency: false, reason: 'FORCE_DISADVANTAGE' };
    }
    if (kind === BATTLE_PLAN_KIND.FIRE_PREPARATION &&
        (situation.readiness?.ammo || 0) < 0.3) {
        return { abort: true, emergency: false, reason: 'LOW_AMMUNITION' };
    }
    if (kind === BATTLE_PLAN_KIND.FIRE_PREPARATION &&
        situation.role === BATTLE_ROLE.ATTACKER &&
        situation.timePressure >= 0.62) {
        return { abort: true, emergency: false, reason: 'PREPARATION_TIME_LIMIT' };
    }
    if (kind === BATTLE_PLAN_KIND.REGROUP &&
        readiness >= 0.78 && situation.forcePosture !== FORCE_POSTURE.DISADVANTAGE) {
        return { abort: true, emergency: false, reason: 'READINESS_RECOVERED' };
    }
    if (kind === BATTLE_PLAN_KIND.REGROUP &&
        situation.role === BATTLE_ROLE.ATTACKER &&
        situation.timePressure >= 0.82 &&
        readiness >= 0.38) {
        return { abort: true, emergency: false, reason: 'MISSION_TIME_PRESSURE' };
    }
    if (kind === BATTLE_PLAN_KIND.DISENGAGE &&
        readiness >= 0.72 && ratio != null && ratio >= 1.05) {
        return { abort: true, emergency: false, reason: 'LOCAL_BALANCE_RECOVERED' };
    }
    if (kind === BATTLE_PLAN_KIND.HOLD &&
        situation.role === BATTLE_ROLE.ATTACKER && situation.timePressure >= 0.78) {
        return { abort: true, emergency: false, reason: 'MISSION_TIME_PRESSURE' };
    }
    // FAZ 3: KUŞATMA — yüksek riskte (yanlardan/arkadan sarılıyor) mevcut planı BIRAK. emergency: hemen
    // çekilme/toparlanmaya geç. DISENGAGE/REGROUP min-duration'ı geri-flip'i önler (cephe genişlerken salınım yok).
    // Saldıran: offensive'i bırak. SAVUNAN: HOLD'da 240-tik oturup sarılmasın (gerçek maç: savunma %36-60 sarıldı,
    // risk hep 0'dı → hiç tetiklemedi; artık savunan-kuşatma açık). Zaten toparlanan/çekilen planı yeniden abort etme.
    if ((typeof BATTLE_ANTI_ENVELOP === 'undefined' || BATTLE_ANTI_ENVELOP) &&
        situation.envelopment && situation.envelopment.risk >= 0.6 &&
        kind !== BATTLE_PLAN_KIND.REGROUP && kind !== BATTLE_PLAN_KIND.DISENGAGE) {
        return { abort: true, emergency: true, reason: 'ENVELOPMENT_RISK' };
    }
    return { abort: false, emergency: false, reason: null };
}

class PlanCommitmentManager {
    constructor(controller, config = {}) {
        this.controller = controller;
        this.switchMargin = Number.isFinite(config.switchMargin)
            ? Math.max(0, config.switchMargin)
            : 18;
        this.minDurationTicks = {
            ...PLAN_MIN_DURATION_TICKS,
            ...(config.minDurationTicks || {})
        };
        this.current = null;
        this.transitionHistory = [];
        this.lastDecision = null;
        this.sequence = 0;
    }

    minimumDuration(kind) {
        return Math.max(0, this.minDurationTicks[kind] | 0);
    }

    commit(candidate, situation, tick, reason, previous = null, abort = null) {
        this.sequence += 1;
        this.current = {
            id: `${this.controller.id}:${this.sequence}`,
            kind: candidate.kind,
            selectedAtTick: tick,
            // FAZ 6: son ~30sn (timePressure≥0.82) planı KİLİTLE (min süre ×2.2) → all-in ya da düzenli çekilme;
            // yarım-saniye kararsızlık yok. İnsan da son anda ya riske girer ya bırakır.
            minUntilTick: tick + Math.round(this.minimumDuration(candidate.kind) *
                (((typeof BATTLE_ENDGAME_LOCK === 'undefined' || BATTLE_ENDGAME_LOCK) && situation && situation.timePressure >= 0.82) ? 2.2 : 1)),
            scoreAtCommit: candidate.score,
            lastScore: candidate.score,
            reason: candidate.reason,
            transitionReason: reason,
            situationTick: situation?.tick ?? tick
        };
        const transition = {
            tick,
            previousKind: previous?.kind || null,
            currentKind: candidate.kind,
            reason,
            score: candidate.score
        };
        this.transitionHistory.push(transition);
        if (this.transitionHistory.length > 100) this.transitionHistory.shift();
        return this.buildDecision(true, transition, candidate, tick, abort);
    }

    buildDecision(changed, transition, challenger, tick, abort) {
        const current = this.current;
        this.lastDecision = {
            tick,
            changed,
            previousKind: transition?.previousKind || current?.kind || null,
            currentKind: current?.kind || null,
            reason: transition?.reason || 'PLAN_RETAINED',
            currentScore: current?.lastScore ?? null,
            challengerKind: challenger?.kind || null,
            challengerScore: challenger?.score ?? null,
            switchMargin: this.switchMargin,
            lockRemainingTicks: current
                ? Math.max(0, current.minUntilTick - tick)
                : 0,
            abortReason: abort?.reason || null,
            emergencyAbort: abort?.emergency === true
        };
        return this.lastDecision;
    }

    select(rankedPlans, situation, tick = SIM.tick) {
        const ranked = (rankedPlans || []).filter(plan => Number.isFinite(plan.score));
        if (!ranked.length) {
            return this.buildDecision(false, null, null, tick, {
                abort: true,
                emergency: false,
                reason: 'NO_ELIGIBLE_PLAN'
            });
        }
        if (!this.current) {
            return this.commit(ranked[0], situation, tick, 'INITIAL_COMMIT');
        }

        const previous = this.current;
        const currentCandidate = ranked.find(plan => plan.kind === previous.kind) || null;
        if (currentCandidate) previous.lastScore = currentCandidate.score;
        let abort = evaluatePlanAbort(previous.kind, situation);
        if (previous.kind === BATTLE_PLAN_KIND.REGROUP &&
            tick - previous.selectedAtTick >= ATTACKER_REGROUP_MAX_TICKS &&
            planReadiness(situation) >= (situation?.role === BATTLE_ROLE.ATTACKER ? 0.24 : 0.22)) {
            abort = {
                abort: true,
                emergency: false,
                reason: situation?.role === BATTLE_ROLE.ATTACKER
                    ? 'ATTACKER_REGROUP_WINDOW_EXPIRED'
                    : 'DEFENDER_REGROUP_WINDOW_EXPIRED'
            };
        }
        // Saldıran ateş hazırlığı penceresi doldu ve kuvvet hâlâ görev yapabilir → taarruza eskale et.
        if (previous.kind === BATTLE_PLAN_KIND.FIRE_PREPARATION &&
            situation?.role === BATTLE_ROLE.ATTACKER &&
            tick - previous.selectedAtTick >= ATTACKER_FIREPREP_MAX_TICKS &&
            planReadiness(situation) >= 0.34) {
            abort = { abort: true, emergency: false, reason: 'ATTACKER_FIREPREP_WINDOW_EXPIRED' };
        }
        const alternative = ranked.find(plan => plan.kind !== previous.kind) || null;
        const challenger = abort.abort ? alternative : ranked[0];

        if (!challenger || challenger.kind === previous.kind) {
            return this.buildDecision(false, null, challenger, tick, abort);
        }
        // FAZ 6 ANTİ-FLIP: gerçek-acil (kuvvet-yok / durum-kayıp) HARİÇ, emergency abort'lar bile bir MİN süreye uyar
        // → 0.5sn'lik "saldır/toparlan" spazmı biter. Ayrıca son ~6sn içinde TERK edilen plana hemen geri dönme (spam
        // kilidi: MAIN_ATTACK↔FIX_AND_FLANK / ↔REGROUP salınımını keser). Endgame'de min süre uzar (aşağıda commit).
        if ((typeof BATTLE_ENDGAME_LOCK === 'undefined' || BATTLE_ENDGAME_LOCK)) {
            const trueEmergency = abort.reason === 'NO_COMBAT_POWER' || abort.reason === 'SITUATION_LOST' || abort.reason === 'NO_ELIGIBLE_PLAN';
            if (!trueEmergency) {
                if (tick - previous.selectedAtTick < 8) return this.buildDecision(false, null, challenger, tick, abort);
                if (this._recentlyLeft && this._recentlyLeft.kind === challenger.kind && tick - this._recentlyLeft.tick < 120)
                    return this.buildDecision(false, null, challenger, tick, abort);
            }
        }
        if (challenger.kind !== previous.kind) this._recentlyLeft = { kind: previous.kind, tick };
        if (abort.emergency) {
            return this.commit(
                challenger,
                situation,
                tick,
                `EMERGENCY_ABORT:${abort.reason}`,
                previous,
                abort
            );
        }
        if (tick < previous.minUntilTick) {
            return this.buildDecision(false, null, challenger, tick, abort);
        }
        if (abort.abort) {
            return this.commit(
                challenger,
                situation,
                tick,
                `ABORT:${abort.reason}`,
                previous,
                abort
            );
        }
        if (!currentCandidate) {
            return this.commit(challenger, situation, tick, 'CURRENT_PLAN_INELIGIBLE', previous);
        }

        const scoreDelta = challenger.score - currentCandidate.score;
        if (scoreDelta >= this.switchMargin) {
            return this.commit(challenger, situation, tick, 'CHALLENGER_MARGIN', previous);
        }
        return this.buildDecision(false, null, challenger, tick, abort);
    }
}

function categoryTotal(categories) {
    return Object.values(categories || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function categoriesReconShare(categories) {
    return (categories?.recon || 0) / Math.max(1, categoryTotal(categories));
}

function categoriesMobileShare(categories) {
    return ((categories?.armor || 0) + (categories?.recon || 0)) / Math.max(1, categoryTotal(categories));
}

function categoriesFireShare(categories) {
    return (categories?.fireSupport || 0) / Math.max(1, categoryTotal(categories));
}
