// Tek savaş alanı oturumu.
// Hızlı Maç, Hikâye, Multiplayer ve QA aynı reset, harita, RNG ve kural
// kurulumundan geçer. Modlar yalnız başlangıç verisi sağlar; motor değiştiremez.

const BATTLE_ENGINE_VERSION = 'battlefield-v4-roster25-intel4-deferdmg-s2-posture-pdair-a2a-tedarik6';   // 2026-08-08 ALTI DAVRANIS DEGISIKLIGI: tahsis metrigi (para bazli en-buyuk-kalan), konuslandirma
// derinligi (nitelikten turetilir + 150px adim + geriye-de-bakan carpisma aramasi), kesif onceligi
// (gozlem > kendini-savunma), hava savunma kovasi (air_defense -> FIRE_SUPPORT), SUPPORT yurutme dali,
// birim agirliklari (SPAAG 0.09, SUPPLY 0.05).
// SURUM BUMP SART: bayat surum dizesi, kayitlarin kendilerini ureten motora karsi dogrulanmasini
// imkansiz kilar. Bugun bu yuzden kullanicinin canli maci 120. tikte sapti (kayit eski motordandi).
const BATTLE_TICK_MS = 50;
const BATTLE_TICK_SEC = BATTLE_TICK_MS / 1000;
const BATTLE_MAX_STEPS_PER_FRAME = 8;

const BATTLE_SESSION = {
    active: false,
    engineVersion: BATTLE_ENGINE_VERSION,
    mode: null,
    requestedMapId: -2,
    mapId: -2,
    seed: 1,
    attackerSide: false,
    durationSec: 360
};

const BATTLE_REPLAY = {
    version: 1,
    engineVersion: BATTLE_ENGINE_VERSION,
    session: null,
    initialState: null,
    events: [],
    hashes: [],
    telemetry: {
        schemaVersion: 1,
        sampleIntervalTicks: 10,
        samples: [],
        combatEvents: [],
        lifeEvents: [],
        controllerDecisions: [],
        performance: [],
        finalSummary: null
    },
    playback: false
};

const BATTLE_REPLAY_DRIVER = {
    active: false,
    eventIndex: 0,
    source: null,
    divergence: null
};

// SICAK YOL — PROFILDE %8.6 ama IKI OPTIMIZASYON DENENDI VE IKISI DE DAHA YAVAS CIKTI.
// Bu fonksiyon replay icin DEGIL: AI planlama/yurutme katmani her kontrolor tikinde onbellegi
// savunma amacli derin kopyaliyor (BattlePlanning cachedGroups/cachedContracts,
// BattleController decisionHistory, BattlePerception lastObservation, ...).
// OLCULDU (10 tohum, ayni is):
//   JSON.parse(JSON.stringify())        29.4 sn   <- MEVCUT, en hizlisi
//   structuredClone                     38.4 sn   (%31 YAVAS)
//   elle yazilmis JSON-semantikli klon  36.7 sn   (%25 YAVAS)
// Ikisinde de sonuclar 10/10 BIREBIR ayniydi; sorun dogruluk degil HIZ idi.
// SEBEP: V8'de JSON.stringify/parse C++ hizli-yoluna sahip ve elle yazilmis JS ozyinelemesini
// yeniyor. Yani KLONU HIZLANDIRMAK mumkun degil; tek yol DAHA AZ KLONLAMAK (cagri yerlerinde
// savunma kopyasi gercekten gerekli mi diye denetim - riskli, yapilmadi).
function replayClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}



function battleResetReplay() {
    // ZENGINLESTIRME: kumulatif yol sayaci mac basina SIFIRLANIR (yoksa onceki macin yolu tasar)
    if (typeof battleTelemetrySifirla === 'function') battleTelemetrySifirla();
    BATTLE_REPLAY.version = 1;
    BATTLE_REPLAY.engineVersion = BATTLE_ENGINE_VERSION;
    BATTLE_REPLAY.session = null;
    BATTLE_REPLAY.initialState = null;
    BATTLE_REPLAY.events.length = 0;
    BATTLE_REPLAY.hashes.length = 0;
    BATTLE_REPLAY.telemetry = {
        schemaVersion: 1,
        sampleIntervalTicks: 10,
        samples: [],
        combatEvents: [],
        lifeEvents: [],
        controllerDecisions: [],
        performance: [],
        finalSummary: null,
        // HANGI RAKIP BEYINLE OYNANDI (ham JSON'dan analiz icin). Sifirlamaya dayanikli.
        rakipBeyin: (typeof BATTLE_RAKIP_BEYIN !== 'undefined') ? BATTLE_RAKIP_BEYIN : null,
        rakipTaraf: 'kirmizi'
    };
    if (typeof battleForensicReset === 'function') battleForensicReset();   // TEHDİT-PROFİLİ: forensik-ring maç-başı sıfırla (maçlar-arası sızma yok)
    BATTLE_REPLAY.playback = false;
    BATTLE_REPLAY_DRIVER.active = false;
    BATTLE_REPLAY_DRIVER.eventIndex = 0;
    BATTLE_REPLAY_DRIVER.source = null;
    BATTLE_REPLAY_DRIVER.divergence = null;
    if (typeof battlePerformanceWindow !== 'undefined') {
        battlePerformanceWindow = {
            startedAt: 0,
            frames: 0,
            totalFrameMs: 0,
            maxFrameMs: 0,
            simulationSteps: 0,
            cappedFrames: 0
        };
    }
}

function battleTelemetryRound(value) {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

// ══ TELEMETRİ ZENGİNLEŞTİRME (2026-08-09) ═══════════════════════════════════════════════════
// KULLANICI: "ham json'u ne kadar detaylandırırsan o kadar iyi analiz edersin."
// FARK TARAMASI (kullanıcının 3 savunma maçı) şu hikâyeyi çıkardı: insan DURUP UZAKTAN vuruyor
// (hareket %9, mesafe 1317px, baskı 2.2), AI YÜRÜYÜP YAKINA giriyor ve eziliyor (%43, 700px, 8.6).
// KULLANICI HİPOTEZİ: "AI'ın bu kadar hareketi onun aleyhine işliyor."
// Bu hipotezi sınamak için eksik olan tam şu: birim HANGİ AN düşman menzilinde, ne kadar yol
// katetti, kendi menzilinde hedefi var mıydı. Aşağıdaki alanlar tam bunu verir.
//
// TASARIM: her şey TELEMETRİ KATMANINDA hesaplanır — `Unit` nesnesine alan EKLENMEZ, sim durumu
// DEĞİŞMEZ, RNG tüketilmez. Böylece determinizm/fork/replay riski SIFIRDIR (yalnız gözlem).
const _telemYol = new Map();        // id -> {x, y, yol}  kümülatif katedilen yol
let _telemCanli = null;             // örnek başına canlı birim listesi (O(n²)'yi tek geçişe indirir)
function battleTelemetrySifirla() { _telemYol.clear(); _telemCanli = null; }
function _telemMenzil(u) {
    const s = (typeof STATS !== 'undefined') ? STATS[u.type] : null;
    return s ? (s.range || 0) : 0;
}
function battleTelemetryUnit(unit) {
    const targetDistance = Math.hypot(
        (unit.targetX ?? unit.x) - unit.x,
        (unit.targetY ?? unit.y) - unit.y
    );
    const pathBlocked = targetDistance > 2 &&
        typeof pathBlockedBetween === 'function'
        ? pathBlockedBetween(unit.x, unit.y, unit.targetX, unit.targetY)
        : false;
    return {
        id: unit.id,
        side: unit.isRed ? 'red' : 'blue',
        type: unit.type,
        owner: unit.controlOwner || null,
        controllerId: unit.controllerId || null,
        x: battleTelemetryRound(unit.x),
        y: battleTelemetryRound(unit.y),
        targetX: battleTelemetryRound(unit.targetX ?? unit.x),   // teşhis + karar-veri-seti (§5)
        targetY: battleTelemetryRound(unit.targetY ?? unit.y),
        attackTargetId: (unit.attackTarget && !unit.attackTarget.dead) ? unit.attackTarget.id : 0,
        isMovingToManualTarget: !!unit.isMovingToManualTarget,
        hp: battleTelemetryRound(Math.max(0, unit.hp)),
        maxHp: battleTelemetryRound(unit.maxHp),
        ammo: battleTelemetryRound(unit.ammo),
        maxAmmo: battleTelemetryRound(unit.maxAmmo),
        suppression: battleTelemetryRound(unit.suppression || 0),
        panic: battleTelemetryRound(unit.panic || 0),
        speed: battleTelemetryRound(unit.speed || 0),
        facingAngle: battleTelemetryRound(unit.facingAngle || 0),
        combatState: unit.combatState || null,
        fleeing: !!unit.isFleeing,
        panicking: !!unit.isPanicking,
        enemyInVision: !!unit.enemyInVision,
        inForest: !!unit.inForest,
        inTrench: !!unit.inTrench,
        supplyCut: !!unit.supplyCut,
        targetId: unit.attackTarget && !unit.attackTarget.dead ? unit.attackTarget.id : null,
        manualTargetId: unit.manualTarget && !unit.manualTarget.dead ? unit.manualTarget.id : null,
        targetX: battleTelemetryRound(unit.targetX ?? unit.x),
        targetY: battleTelemetryRound(unit.targetY ?? unit.y),
        targetDistance: battleTelemetryRound(targetDistance),
        movingToManualTarget: !!unit.isMovingToManualTarget,
        navPathLength: unit._navPath?.length || 0,
        navIndex: unit._navIdx || 0,
        navBlocked: !!pathBlocked,
        terrain: typeof terrainTypeAt === 'function'
            ? terrainTypeAt(unit.x, unit.y)
            : null,
        // ── ZENGİNLEŞTİRME (2026-08-09) — "hareket aleyhe mi işliyor?" hipotezi için ──
        ...(function () {
            const canli = _telemCanli || [];
            const benimMenzil = _telemMenzil(unit);
            let enYakin = Infinity, menzilimde = 0, menzillerinde = 0, dostYakin = 0;
            for (const o of canli) {
                if (o === unit || o.dead) continue;
                const d = Math.hypot(o.x - unit.x, o.y - unit.y);
                if (!!o.isRed === !!unit.isRed) { if (d <= 600) dostYakin++; continue; }
                if (d < enYakin) enYakin = d;
                if (benimMenzil > 0 && d <= benimMenzil) menzilimde++;      // ATEŞ EDEBİLİRİM
                const om = _telemMenzil(o);
                if (om > 0 && d <= om) menzillerinde++;                     // BENİ VURABİLİR
            }
            // kümülatif yol (telemetri-yerel; birim nesnesine yazılmaz)
            const onc = _telemYol.get(unit.id);
            let yol = onc ? onc.yol : 0;
            if (onc) yol += Math.hypot(unit.x - onc.x, unit.y - onc.y);
            _telemYol.set(unit.id, { x: unit.x, y: unit.y, yol });
            return {
                etkiliMenzil: battleTelemetryRound(benimMenzil),
                enYakinDusman: enYakin === Infinity ? -1 : battleTelemetryRound(enYakin),
                menzilimdeDusman: menzilimde,        // kaç düşmana ateş edebilirim
                dusmanMenzilinde: menzillerinde,     // kaç düşman BENİ vurabilir  ← MARUZİYET
                dostYakin600: dostYakin,             // yerel üstünlük payı
                katedilenYol: battleTelemetryRound(yol),
                // NET MARUZİYET: beni vurabilenler − vurabildiklerim. Pozitifse birim DEZAVANTAJLI
                // bir mesafede duruyor demektir; kullanıcının hipotezi tam bunun üzerine.
                netMaruziyet: menzillerinde - menzilimde
            };
        })()
    };
}

// TEHDİT-PROFİLİ telemetri-serialize: sınıf-başı inanç + KABUL-METRİKLERİ (detection-latency = ilk-sinyal − ilk-etki;
// reaction-latency = ilk-reaksiyon − ilk-sinyal, Faz B doldurur). sourceIds obje → sıralı-dizi. Set yok, replayClone-güvenli.
function threatProfileToTelemetry(tp) {
    if (!tp || !tp.classes) return null;
    const out = {};
    for (const cn of Object.keys(tp.classes).sort()) {
        const c = tp.classes[cn];
        out[cn] = {
            detected: !!c.detected,
            confidence: battleTelemetryRound(c.confidence),
            firstSignalTick: c.firstSignalTick, lastSignalTick: c.lastSignalTick,
            estPos: c.estPos ? { x: c.estPos.x, y: c.estPos.y } : null,
            sourceIds: Object.keys(c.sourceIds || {}).map(Number).sort((a, b) => a - b),
            reactionsTriggered: (c.reactionsTriggered || []).slice(),
            detectionLatencyTicks: (c._detectedTick != null && c._firstEffectTick != null) ? (c._detectedTick - c._firstEffectTick) : null,
            reactionLatencyTicks: (c._firstReactionTick != null && c.firstSignalTick != null) ? (c._firstReactionTick - c.firstSignalTick) : null
        };
    }
    return out;
}
function battleTelemetryController(controller) {
    const operation = controller.taskExecutor?.operation || null;
    return {
        threatProfile: threatProfileToTelemetry(controller.lastSituation?.threatProfile),   // TEHDİT-PROFİLİ inanç + gecikme-kabul-metrikleri
        id: controller.id,
        side: controller.side ? 'red' : 'blue',
        owner: controller.owner,
        currentPlan: controller.currentPlan?.kind || null,
        planId: controller.currentPlan?.id || null,
        role: controller.lastSituation?.role || null,
        contactState: controller.lastSituation?.contactState || null,
        forceRatio: battleTelemetryRound(controller.lastSituation?.forceRatio),
        contactConfidence: battleTelemetryRound(controller.lastSituation?.contactConfidence),
        timePressure: battleTelemetryRound(controller.lastSituation?.timePressure),
        visibleContactIds: (controller.lastObservation?.contacts || [])
            .filter(contact => contact.visible)
            .map(contact => contact.id)
            .sort((a, b) => a - b),
        operationPhase: operation?.phase || null,
        operationPlanKind: operation?.planKind || null,
        operationReadyRatio: battleTelemetryRound(operation?.readyRatio),
        taskStates: [...(controller.taskExecutor?.states?.values?.() || [])]
            .map(state => ({
                contractId: state.contractId,
                phase: state.phase,
                waypointIndex: state.waypointIndex,
                lastOrderKind: state.lastOrderKind,
                lastTargetId: state.lastTargetId,
                abortReason: state.abortReason
            }))
            .sort((a, b) => a.contractId.localeCompare(b.contractId))
    };
}

function battleCaptureTelemetrySample() {
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback || !BATTLE_REPLAY.initialState) return;
    const telemetry = BATTLE_REPLAY.telemetry;
    if (!telemetry || (SIM.tick % telemetry.sampleIntervalTicks) !== 0) return;
    telemetry.samples.push({
        tick: SIM.tick || 0,
        seconds: battleTelemetryRound((SIM.tick || 0) * BATTLE_TICK_SEC),
        simRng: SIM_RNG.state >>> 0,                              // teşhis: RNG akış konumu (sapma izole için)
        pMoney: Math.round((player.money || 0) * 100) / 100,
        eMoney: Math.round((enemy.money || 0) * 100) / 100,
        hashParts: (typeof battleStateHashParts === 'function') ? battleStateHashParts() : null,   // teşhis: hangi hash-parçası sapıyor
        battle: {
            elapsedSec: battleTelemetryRound(SIM.battle?.elapsedSec || 0),
            remainingSec: battleTelemetryRound(SIM.battle?.remainingSec || 0),
            winnerSide: SIM.battle?.winnerSide ?? null,
            outcomeReason: SIM.battle?.outcomeReason || null
        },
        units: (function () {
            // ZENGINLESTIRME: canli listeyi ORNEK BASINA bir kez kur; her birim onu tarar.
            _telemCanli = SIM.units.filter(u => !u.dead && !u.loaded);
            const out = _telemCanli.map(battleTelemetryUnit).sort((a, b) => a.id - b.id);
            _telemCanli = null;
            return out;
        })(),
        controllers: [...BATTLE_CONTROLLERS.values()]
            .map(battleTelemetryController)
            .sort((a, b) => a.id.localeCompare(b.id))
    });
}

// ── AI KABUL-BATARYASI: hafif, gate'li per-tip savaş-katkısı toplayıcı (deterministik; hash-dışı) ──
// battleBalanceEnable() ile açılır (yalnız ölçüm-harness'i). Kapalıyken normal oyunu HİÇ etkilemez.
const BATTLE_BALANCE = { on: false, dmg: {}, kills: {}, deaths: {}, killValue: { red: 0, blue: 0 },
    destroyedByType: {}, abandoned: 0, captured: { red: 0, blue: 0 },   // analist-sayaçları: gri-araç + ele-geçirme + kamikaze-₺
    assaultTicks: 0, assaultSuppTicks: 0, heloSorties: 0, fieldsBuilt: 0, minesLaid: 0, mineKills: 0,   // + inşa/mayın
    posture: { red: { SHAPE: 0, POSITION: 0, STRIKE: 0, CONSOLIDATE: 0, PRESERVE: 0 }, blue: { SHAPE: 0, POSITION: 0, STRIKE: 0, CONSOLIDATE: 0, PRESERVE: 0 } },   // FAZ 7 duruş histogramı
    firstStrikeTick: { red: -1, blue: -1 },   // saldıranın ilk taarruz-tik'i (donuyor mu / geç mi kapatıyor)
    intensity: {}, strikeWindows: { red: 0, blue: 0 }, _prevStance: {},   // ANALİST: dakika-başı aktif-çatışma% eğrisi (düz=posture çalışmıyor, dalgalı=çalışıyor) + STRIKE-pencere sayısı
    dispersal: { red: { sum: 0, n: 0 }, blue: { sum: 0, n: 0 } },   // ANTI-BLOB: dağılım-endeksi (centroid'e ort.uzaklık/WORLD_W — düşük=blob)
    localDensity: { red: { sum: 0, n: 0, max: 0 }, blue: { sum: 0, n: 0, max: 0 } },   // ANALİST #4-METRİK: en kalabalık 600px-çemberdeki birim (balistik aoe600 tam bunu vurur; küresel-dağılım kör-nokta)
    sectorOcc: { red: { left: 0, center: 0, right: 0, n: 0 }, blue: { left: 0, center: 0, right: 0, n: 0 } },   // sektör-doluluk (x-band ₺%)
    mainEffortShifts: { red: 0, blue: 0 } };   // FAZ 4: ana-çaba kayma sayısı (histerezis çalışıyor mu — düşük=iyi, <5)
function battleBalanceReset(on) {
    BATTLE_BALANCE.on = !!on; BATTLE_BALANCE.dmg = {}; BATTLE_BALANCE.kills = {}; BATTLE_BALANCE.deaths = {};
    BATTLE_BALANCE.killValue = { red: 0, blue: 0 };
    BATTLE_BALANCE.destroyedByType = {}; BATTLE_BALANCE.abandoned = 0; BATTLE_BALANCE.captured = { red: 0, blue: 0 };
    BATTLE_BALANCE.assaultTicks = 0; BATTLE_BALANCE.assaultSuppTicks = 0; BATTLE_BALANCE.heloSorties = 0; BATTLE_BALANCE.fieldsBuilt = 0;
    BATTLE_BALANCE.minesLaid = 0; BATTLE_BALANCE.mineKills = 0;
    BATTLE_BALANCE.posture = { red: { SHAPE: 0, POSITION: 0, STRIKE: 0, CONSOLIDATE: 0, PRESERVE: 0 }, blue: { SHAPE: 0, POSITION: 0, STRIKE: 0, CONSOLIDATE: 0, PRESERVE: 0 } };
    BATTLE_BALANCE.firstStrikeTick = { red: -1, blue: -1 };
    BATTLE_BALANCE.intensity = {}; BATTLE_BALANCE.strikeWindows = { red: 0, blue: 0 }; BATTLE_BALANCE._prevStance = {};
    BATTLE_BALANCE.dispersal = { red: { sum: 0, n: 0 }, blue: { sum: 0, n: 0 } };
    BATTLE_BALANCE.localDensity = { red: { sum: 0, n: 0, max: 0 }, blue: { sum: 0, n: 0, max: 0 } };
    BATTLE_BALANCE.sectorOcc = { red: { left: 0, center: 0, right: 0, n: 0 }, blue: { left: 0, center: 0, right: 0, n: 0 } };
    BATTLE_BALANCE.mainEffortShifts = { red: 0, blue: 0 };
    BATTLE_BALANCE.proCohesionEval = 0; BATTLE_BALANCE.proCohesionHold = 0;   // intel4-pro kohezyon teşhis sayaçları
    BATTLE_BALANCE.proCohesionBind = 0; BATTLE_BALANCE.proCohesionDostSum = 0; BATTLE_BALANCE.proRally = 0;
}
// Per-tik örnekleyici (yalnız gate açıkken): taarruz eden birimlerin bastırılmış-süre oranı
function battleBalanceSample() {
    if (!BATTLE_BALANCE.on) return;
    let engaged = 0, aliveCombat = 0;
    for (const u of SIM.units) {
        if (u.dead || u.abandoned) continue;
        if ((SIM.tick - (u._pressingAssault || -99)) <= 2) {
            BATTLE_BALANCE.assaultTicks++;
            if ((u.suppression || 0) > 50) BATTLE_BALANCE.assaultSuppTicks++;
        }
        // ANALİST çatışma-yoğunluğu: savaş birimi aktif firefight'ta mı (hedefi menzilde VEYA ateş yiyor)
        if (u.atk > 0) {
            aliveCombat++;
            const inFight = (u.attackTarget && !u.attackTarget.dead) || (u.suppression || 0) > 20;
            if (inFight) engaged++;
        }
    }
    // dakika-başı ortalama aktif-çatışma oranı (eğri düz mü dalgalı mı → posture tempo-evreliyor mu)
    const minute = Math.floor(((SIM.battle && SIM.battle.elapsedSec) || 0) / 60);
    const bucket = BATTLE_BALANCE.intensity[minute] || (BATTLE_BALANCE.intensity[minute] = { sum: 0, n: 0 });
    bucket.sum += aliveCombat ? (engaged / aliveCombat) : 0; bucket.n++;
    // ANTI-BLOB (FAZ 0): dağılım-endeksi (centroid'e ort.uzaklık/WORLD_W) + sektör-doluluk (x-band ₺%) — her 10 tik (yavaş-metrik)
    if (SIM.tick % 10 === 0) {
        for (const side of ['red', 'blue']) {
            const isRed = side === 'red';
            let cx = 0, cy = 0, cnt = 0, vL = 0, vC = 0, vR = 0, vTot = 0;
            const pos = [];
            for (const u of SIM.units) {
                if (u.dead || u.abandoned || u.isRed !== isRed || !(u.atk > 0)) continue;
                cx += u.x; cy += u.y; cnt++; pos.push(u);
                const val = (STATS[u.type] && STATS[u.type].cost) || 1; vTot += val;
                if (u.x < WORLD_W / 3) vL += val; else if (u.x > WORLD_W * 2 / 3) vR += val; else vC += val;
            }
            if (cnt === 0) continue;
            cx /= cnt; cy /= cnt;
            let dsum = 0;
            for (const u of pos) dsum += Math.hypot(u.x - cx, u.y - cy);
            const disp = BATTLE_BALANCE.dispersal[side];
            disp.sum += (dsum / cnt) / WORLD_W; disp.n++;
            // YEREL-YOĞUNLUK (analist #4-metrik): en kalabalık 600px-çemberdeki birim (balistik area=6=600px tam bunu vurur)
            let maxLocal = 0;
            for (const a of pos) { let c = 0; for (const b of pos) if (Math.hypot(a.x - b.x, a.y - b.y) <= 600) c++; if (c > maxLocal) maxLocal = c; }
            const ld = BATTLE_BALANCE.localDensity[side];
            ld.sum += maxLocal; ld.n++; if (maxLocal > ld.max) ld.max = maxLocal;
            if (vTot > 0) { const so = BATTLE_BALANCE.sectorOcc[side]; so.left += vL / vTot; so.center += vC / vTot; so.right += vR / vTot; so.n++; }
        }
    }
    // FAZ 7: duruş histogramı + ilk-taarruz + STRIKE-pencere sayısı (kontrolör-başına, per-tik örnek)
    if (typeof BATTLE_CONTROLLERS !== 'undefined') {
        for (const ctrl of BATTLE_CONTROLLERS.values()) {
            const p = ctrl.lastSituation && ctrl.lastSituation.operationalPosture;
            if (!p) continue;
            const sk = ctrl.side ? 'red' : 'blue';
            const h = BATTLE_BALANCE.posture[sk];
            if (h && h[p.stance] != null) h[p.stance]++;
            if (p.strikeGateOpen && BATTLE_BALANCE.firstStrikeTick[sk] < 0) BATTLE_BALANCE.firstStrikeTick[sk] = SIM.tick;
            const prev = BATTLE_BALANCE._prevStance[ctrl.id];   // STRIKE-penceresi = non-STRIKE→STRIKE geçişi sayısı
            if (p.stance === 'STRIKE' && prev !== 'STRIKE') BATTLE_BALANCE.strikeWindows[sk]++;
            BATTLE_BALANCE._prevStance[ctrl.id] = p.stance;
            if (ctrl.sectorState) BATTLE_BALANCE.mainEffortShifts[sk] = ctrl.sectorState.mainEffortShiftCount || 0;   // FAZ 4: kümülatif kayma (histerezis metriği)
        }
    }
}
function battleSectorOccAvg(side) {   // ANTI-BLOB: sektör-doluluk ortalaması (left/center/right ₺%)
    const so = BATTLE_BALANCE.sectorOcc[side];
    if (!so || !so.n) return { left: 0, center: 0, right: 0 };
    return { left: +(so.left / so.n).toFixed(2), center: +(so.center / so.n).toFixed(2), right: +(so.right / so.n).toFixed(2) };
}
function battleBalanceReport() {
    const alive = {};
    for (const u of SIM.units) if (!u.dead) alive[u.type] = (alive[u.type] || 0) + 1;
    const types = new Set([...Object.keys(BATTLE_BALANCE.dmg), ...Object.keys(BATTLE_BALANCE.deaths), ...Object.keys(alive)].map(Number));
    const rows = [];
    for (const t of types) {
        const st = STATS[t]; if (!st) continue;
        const dep = (alive[t] || 0) + (BATTLE_BALANCE.deaths[t] || 0);
        const cost = st.cost || 1;
        const dmg = Math.round(BATTLE_BALANCE.dmg[t] || 0);
        const kills = BATTLE_BALANCE.kills[t] || 0;
        const combat = !!(st.weapons && st.weapons.length);
        rows.push({
            id: st.id, dep, dmg, kills, deaths: BATTLE_BALANCE.deaths[t] || 0, cost, combat,
            dmgPerCost: dep ? +(dmg / (dep * cost)).toFixed(3) : 0,
            killsPer100: dep ? +(kills / (dep * cost / 100)).toFixed(2) : 0
        });
    }
    rows.sort((a, b) => b.dmgPerCost - a.dmgPerCost);
    // KIRMIZI BAYRAK: HASAR-ROLLÜ savaş birimi ama katkısı ~sıfır. Utility (istihkam/keşif/destek/lojistik/komuta/anti-air-only) hariç — onlar hasarla değil işle katkı verir.
    const utilCats = new Set(['support', 'logistics', 'command', 'recon']);
    const redFlags = rows.filter(r => {
        if (!r.combat || r.dep <= 0) return false;
        const st = Object.values(STATS).find(x => x && x.id === r.id);
        if (st && (utilCats.has(st.category) || (st.roleTags || []).includes('anti_air'))) return false;   // rol-gereği düşük-hasar
        return r.dmg < r.dep * r.cost * 0.001;
    }).map(r => r.id);
    const kv = BATTLE_BALANCE.killValue;
    // ANALİST 4 SAYACI: gri-araç, ele-geçirme, kamikaze-₺, taarruz-bastırılmış%, helo-sorti
    let vehDestroyed = 0;
    for (const t of types) {
        const st = STATS[t]; if (!st) continue;
        const crewed = st.domain !== 'air' && (st.armorType === 'heavy' || st.armorType === 'light') && !!(st.weapons && st.weapons.length);
        if (crewed) vehDestroyed += (BATTLE_BALANCE.deaths[t] || 0);
    }
    const kamiId = Object.keys(STATS).find(k => STATS[k] && STATS[k].id === 'loitering_munition');
    const kamiDep = kamiId != null ? ((alive[kamiId] || 0) + (BATTLE_BALANCE.deaths[kamiId] || 0)) : 0;
    const kamiVal = kamiId != null ? (BATTLE_BALANCE.destroyedByType[kamiId] || 0) : 0;
    return {
        tick: SIM.tick || 0,
        winner: SIM.battle ? (SIM.battle.winnerSide === true ? 'red' : SIM.battle.winnerSide === false ? 'blue' : null) : null,
        outcomeReason: SIM.battle ? SIM.battle.outcomeReason : null,
        maxDominanceRatio: SIM.battle ? (SIM.battle.maxDominanceRatio || 0) : 0,   // T0: taarruz-aciz(<1.0) mi eşik-ulaşılmaz(≈1.0) mi
        tradeRatio: { redDestroyed: Math.round(kv.red), blueDestroyed: Math.round(kv.blue), ratio: +((kv.red || 0) / (kv.blue || 1)).toFixed(2) },
        grayVehicle: { abandoned: BATTLE_BALANCE.abandoned, captured: BATTLE_BALANCE.captured, vehDestroyed, abandonRatio: vehDestroyed + BATTLE_BALANCE.abandoned > 0 ? +(BATTLE_BALANCE.abandoned / (vehDestroyed + BATTLE_BALANCE.abandoned)).toFixed(2) : 0 },
        kamikaze: { deployed: kamiDep, valueDestroyed: Math.round(kamiVal), valuePerUnit: kamiDep ? +(kamiVal / kamiDep).toFixed(2) : 0 },
        assaultSuppressedPct: BATTLE_BALANCE.assaultTicks ? +(BATTLE_BALANCE.assaultSuppTicks / BATTLE_BALANCE.assaultTicks).toFixed(2) : 0,
        heloSorties: BATTLE_BALANCE.heloSorties, fieldsBuilt: BATTLE_BALANCE.fieldsBuilt,
        minesLaid: BATTLE_BALANCE.minesLaid, mineKills: BATTLE_BALANCE.mineKills,
        posture: BATTLE_BALANCE.posture, firstStrikeTick: BATTLE_BALANCE.firstStrikeTick,
        strikeWindows: BATTLE_BALANCE.strikeWindows,
        intensityCurve: Object.keys(BATTLE_BALANCE.intensity).sort((a, b) => a - b).map(mi => {
            const b = BATTLE_BALANCE.intensity[mi]; return { min: +mi, pct: b.n ? +(b.sum / b.n).toFixed(2) : 0 };
        }),
        localDensity: {   // ANALİST #4-METRİK: en kalabalık 600px-çemberdeki ort./tepe birim (yayılma-yamasının GERÇEK ölçüsü — düşük=iyi)
            red: { avg: BATTLE_BALANCE.localDensity.red.n ? +(BATTLE_BALANCE.localDensity.red.sum / BATTLE_BALANCE.localDensity.red.n).toFixed(2) : 0, max: BATTLE_BALANCE.localDensity.red.max },
            blue: { avg: BATTLE_BALANCE.localDensity.blue.n ? +(BATTLE_BALANCE.localDensity.blue.sum / BATTLE_BALANCE.localDensity.blue.n).toFixed(2) : 0, max: BATTLE_BALANCE.localDensity.blue.max }
        },
        dispersalIndex: {   // ANTI-BLOB: düşük=blob, yüksek=yayılmış
            red: BATTLE_BALANCE.dispersal.red.n ? +(BATTLE_BALANCE.dispersal.red.sum / BATTLE_BALANCE.dispersal.red.n).toFixed(3) : 0,
            blue: BATTLE_BALANCE.dispersal.blue.n ? +(BATTLE_BALANCE.dispersal.blue.sum / BATTLE_BALANCE.dispersal.blue.n).toFixed(3) : 0
        },
        sectorOccupancy: { red: battleSectorOccAvg('red'), blue: battleSectorOccAvg('blue') },
        mainEffortShifts: BATTLE_BALANCE.mainEffortShifts,
        redFlags, rows
    };
}

// YAŞAM-DÖNGÜSÜ OLAYLARI (analist için): panik/ikmal/iyileşme/ölüm/terk — combat-akışından ayrı (tüketiciler bozulmasın).
// Sürekli süreçler (ikmal/heal) çağıran tarafta throttle'lanır. Determinizm-güvenli (yalnız telemetri, sim-etkisiz).
function battleRecordLifeEvent(details = {}) {
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback || !BATTLE_REPLAY.telemetry) return;
    if (BATTLE_REPLAY.telemetry.lifeEvents.length >= 50000) return;
    BATTLE_REPLAY.telemetry.lifeEvents.push({
        tick: SIM.tick || 0,
        seconds: battleTelemetryRound((SIM.tick || 0) * BATTLE_TICK_SEC),
        ...details
    });
}
function battleRecordCombatEvent(details = {}) {
    // TEHDİT-PROFİLİ FORENSİK-FEED (her-zaman-açık, telemetri-kapısından ÖNCE): replay-playback'te de dolmalı (Unit.js-emisyonu aynı çalışır),
    // yoksa inanç-katmanı canlı≠playback sapar. Saf-veri (sim-mutasyon yok) → determinist. Tüketiciler tick-ile okur; cap-shift + maç-başı reset.
    if (typeof BATTLE_FORENSIC !== 'undefined' && typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.active) {
        const _b = BATTLE_FORENSIC;
        _b.buf.push({ seq: _b.seq++, tick: SIM.tick || 0, kind: details.kind,
            attackerId: details.attackerId, attackerSide: details.attackerSide, attackerType: details.attackerType,
            targetId: details.targetId, targetSide: details.targetSide, targetType: details.targetType, lethal: !!details.lethal,
            damage: details.damage || 0,   // EKLENDİ: hasar-atfı ölçümleri için (komuta halesi vb.). Saf veri; sim'e dokunmaz, hash'e girmez.
            attackerX: details.attackerX, attackerY: details.attackerY, targetX: details.targetX, targetY: details.targetY });
        if (_b.buf.length > _b.cap) _b.buf.shift();
    }
    if (BATTLE_BALANCE.on) {   // KABUL-BATARYASI toplayıcı (gate'li)
        const at = details.attackerType, tt = details.targetType;
        if (at != null) { BATTLE_BALANCE.dmg[at] = (BATTLE_BALANCE.dmg[at] || 0) + (details.damage || 0); if (details.lethal) BATTLE_BALANCE.kills[at] = (BATTLE_BALANCE.kills[at] || 0) + 1; }
        if (tt != null && details.lethal) {
            BATTLE_BALANCE.deaths[tt] = (BATTLE_BALANCE.deaths[tt] || 0) + 1;
            const side = details.attackerSide; const c = (STATS[tt] && STATS[tt].cost) || 0;
            if (side === 'red') BATTLE_BALANCE.killValue.red += c; else if (side === 'blue') BATTLE_BALANCE.killValue.blue += c;
            if (at != null) BATTLE_BALANCE.destroyedByType[at] = (BATTLE_BALANCE.destroyedByType[at] || 0) + c;   // kamikaze-₺ için
        }
    }
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback || !BATTLE_REPLAY.telemetry) return;
    if (BATTLE_REPLAY.telemetry.combatEvents.length >= 50000) return;
    BATTLE_REPLAY.telemetry.combatEvents.push({
        tick: SIM.tick || 0,
        seconds: battleTelemetryRound((SIM.tick || 0) * BATTLE_TICK_SEC),
        ...replayClone(details)
    });
}

function battleRecordControllerDecision(controller, decision) {
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback || !BATTLE_REPLAY.telemetry) return;
    if (BATTLE_REPLAY.telemetry.controllerDecisions.length >= 4000) return;
    BATTLE_REPLAY.telemetry.controllerDecisions.push({
        tick: SIM.tick || 0,
        seconds: battleTelemetryRound((SIM.tick || 0) * BATTLE_TICK_SEC),
        controllerId: controller.id,
        side: controller.side ? 'red' : 'blue',
        observation: replayClone(controller.lastObservation),
        situation: replayClone(controller.lastSituation),
        candidatePlans: replayClone(controller.candidatePlans),
        rankedPlans: replayClone(controller.rankedPlans),
        committedPlan: replayClone(controller.currentPlan),
        operationalPlan: replayClone(controller.operationalPlan),
        execution: replayClone(decision)
    });
}

function battleRecordPerformanceSample(sample = {}) {
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback || !BATTLE_REPLAY.telemetry) return;
    if (BATTLE_REPLAY.telemetry.performance.length >= 2000) return;
    BATTLE_REPLAY.telemetry.performance.push({
        tick: SIM.tick || 0,
        seconds: battleTelemetryRound((SIM.tick || 0) * BATTLE_TICK_SEC),
        ...replayClone(sample)
    });
}

function battleFinalizeTelemetry(summary) {
    if (!BATTLE_REPLAY.telemetry) return;
    battleCaptureTelemetrySample();
    BATTLE_REPLAY.telemetry.finalSummary = replayClone(summary);
}

// ANALİST-İSTEĞİ: build'de HANGİ MEKANİKLER aktifti kayıttan OKUNABİLİR olsun → hangi karşılaştırmanın hangi mekanik-kümesinde
// koştuğu bulanıklaşmasın ("jammer çalışmıyor" gibi keşifler playtest-hissine değil kayıt-satırına dayansın).
function battleActiveFeatures() {
    const f = { engineVersion: (typeof BATTLE_ENGINE_VERSION !== 'undefined') ? BATTLE_ENGINE_VERSION : null };
    if (typeof BATTLE_INTEL4_DELTAS !== 'undefined') f.intel4Deltas = { ...BATTLE_INTEL4_DELTAS };   // stance/shock/.../defense/backbone/range/drone
    if (typeof BATTLE_INTEL4_RED !== 'undefined') f.intel4Red = !!BATTLE_INTEL4_RED;
    if (typeof BATTLE_INTEL4_BLUE !== 'undefined') f.intel4Blue = !!BATTLE_INTEL4_BLUE;
    if (typeof BATTLE_POSTURE_GATE !== 'undefined') f.postureGate = !!BATTLE_POSTURE_GATE;
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') f.sectorCommand = !!BATTLE_SECTOR_COMMAND;
    if (typeof BATTLE_UNIT_MICRO !== 'undefined') f.unitMicro = BATTLE_UNIT_MICRO !== false;
    if (typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.composition) f.composition = BATTLE_SESSION.composition;   // KADRO-DOĞRULAMA: taraf-başı kategori-payı (fireSupport %0 = kırmızı-bayrak)
    return f;
}
function exportBattleDiagnosticReport(summary = null) {
    if (summary) battleFinalizeTelemetry(summary);
    return {
        format: 'pixel-rts-battle-diagnostic',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        engineVersion: BATTLE_ENGINE_VERSION,
        features: battleActiveFeatures(),   // ANALİST: build'in aktif-mekanik kümesi (kayıttan okunur)
        replay: exportBattleReplay()
    };
}

// A/B ve veri-üretim koşularında replay KAYDI hiç okunmuyor ama her olayda payload
// derin kopyalanıyor (profil: replayClone %5.3). Bu bayrak kaydı kapatır.
// GÜVENLİ: BATTLE_REPLAY.events yalnız TEŞHİS/RAPOR fonksiyonlarında okunuyor
// (BattleDeployment.js:1244/1464 — sim döngüsünden SONRA özet üretirler), karar
// yolunda DEĞİL. Determinizm kapıları replay'i kullandığı için orada AÇIK kalmalı.
let BATTLE_REPLAY_KAYITSIZ = false;
function battleRecordEvent(type, payload = {}, tick = null) {
    if (BATTLE_REPLAY_KAYITSIZ) return;
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback) return;
    BATTLE_REPLAY.events.push({
        tick: Number.isFinite(tick) ? tick : (SIM.tick || 0),
        type,
        payload: replayClone(payload)
    });
}

function battleUnitSnapshot(unit) {
    return {
        id: unit.id,
        type: unit.type,
        isRed: !!unit.isRed,
        ally: !!unit.ally,
        controlOwner: unit.controlOwner || null,
        controllerId: unit.controllerId || null,
        // TAM PRECISION (yuvarlama YOK): initialState'ten yeniden başlayan replay, canlının kullandığı
        // birebir aynı pozisyondan başlamalı. x/y'yi 2 ondalığa yuvarlamak, tick-0 hash'i (o da yuvarlar)
        // eşleşse bile tam-precision simülasyonu saptırıyordu → sapma birikip hash sınırını geçiyordu.
        // Kanıt: u14 başlangıç x'ini 0.005 nudge'lamak kayıtlı hash'i birebir yeniden üretti. targetX/targetY
        // zaten tam precision'dı (asimetri buydu).
        x: unit.x,
        y: unit.y,
        hp: unit.hp,
        maxHp: unit.maxHp,
        atk: unit.atk,
        baseSpeed: unit.baseSpeed,
        speed: unit.speed,
        range: unit.range,
        vision: unit.vision,
        atkSpeed: unit.atkSpeed,
        baseArmor: unit.baseArmor,
        armor: unit.armor,
        maxAmmo: unit.maxAmmo,
        ammo: unit.ammo,
        veteran: unit.veteran || 0,
        level: unit.level || 0,
        xpBonus: unit.xpBonus || 1,
        panicResistance: unit.panicResistance || 0,
        facingAngle: unit.facingAngle || 0,
        targetX: unit.targetX,
        targetY: unit.targetY,
        scanTimer: unit.scanTimer,
        lastAttackTime: unit.lastAttackTime || 0,
        // BATTLE_SPAWN_LOADED: "henüz hiç ateş etmedi" (ilk atış dolum beklemez). Fork/replay'e YAZILMAK ZORUNDA —
        // aksi halde geri yüklenen birim yapıcıdan true alıp BEDAVA bir atış kazanır ve fork eşitliği bozulur.
        _hicAtesEtmedi: unit._hicAtesEtmedi !== false,
        // KISMİ KARIŞTIRMA görev-döngüsü durumu: birikim + karıştırılan-tik sayacı. Fork'a YAZILMAK ZORUNDA —
        // yoksa geri yüklenen dron temiz birikimle başlar (jam fazı kayar) ve fork eşitliği bozulur.
        _jamAcc: unit._jamAcc || 0,
        _jamTik: unit._jamTik || 0,
        jammedLoss: unit.jammedLoss != null ? unit.jammedLoss : null,
        // DRONE-OPERATÖR/DRONE (fork-güvenli): operatör-bağı + mühimmat-sayısı + ikmal-sayacı + fırlatma-noktası
        operatorId: unit.operatorId != null ? unit.operatorId : null,
        payloadCount: unit.payloadCount != null ? unit.payloadCount : null,
        _reloadTimer: unit._reloadTimer || 0,
        launchX: unit.launchX != null ? unit.launchX : null,   // drone son-atılan konum (kontrollü+hedef-yok → oraya ilerle)
        launchY: unit.launchY != null ? unit.launchY : null,
        _ctrlLostTick: unit._ctrlLostTick || 0,   // kontrol-kaybı/jam sayacı (5sn → infilak)
        _cmdShockUntil: unit._cmdShockUntil || 0,   // komuta-şoku emir-felci penceresi (HQ öldü)
        _deathFxDone: unit._deathFxDone ? 1 : 0,    // onDeath-efekti işlendi mi (command_shock tek-seferlik)
        _diveLastX: unit._diveLastX != null ? unit._diveLastX : null,   // drone taahhüt-hedef son-konumu (hedef-ölünce oraya-git+patla; re-derive edilemez)
        _diveLastY: unit._diveLastY != null ? unit._diveLastY : null
    };
}

function battleCaptureInitialState() {
    BATTLE_REPLAY.session = replayClone(BATTLE_SESSION);
    BATTLE_REPLAY.initialState = {
        units: SIM.units.filter(unit => !unit.dead).map(battleUnitSnapshot).sort((a, b) => a.id - b.id),
        trenches: (SIM.trenches || []).map(field => ({
            x: field.x,                 // TAM PRECISION (birim x/y ile aynı gerekçe — hash sınır-kayması)
            y: field.y,
            isRed: !!field.isRed,
            hp: field.hp,
            maxHp: field.maxHp || field.hp,
            r: field.r || 72,
            providesSupply: field.providesSupply !== false,
            providesAir: !!field.providesAir,                                    // HELO-ÜSSÜ: hava-ikmal yeteneği (fork'ta korunmalı)
            refuelsLeft: field.refuelsLeft != null ? field.refuelsLeft : null,   // kalan dolum-hakkı (hash'lenir → replay-fork sapmaz)
            createdAt: field.createdAt || 0,
            expiresAt: field.expiresAt || 0
        })),
        terrain: typeof terrainGrid !== 'undefined' && terrainGrid
            ? {
                gridWidth: GRID_W,
                gridHeight: GRID_H,
                cellWidth: CELL_W,
                cellHeight: CELL_H,
                worldWidth: WORLD_W,
                worldHeight: WORLD_H,
                cells: Array.from(terrainGrid),
                bridges: typeof bridgeSet !== 'undefined' && bridgeSet
                    ? [...bridgeSet].sort()
                    : []
            }
            : null,
        playerMoney: Math.round(player.money || 0),
        enemyMoney: Math.round(enemy.money || 0),
        rngState: SIM_RNG.state >>> 0
    };
    BATTLE_REPLAY.hashes.push({ tick: SIM.tick || 0, hash: battleStateHash() });
    return BATTLE_REPLAY.initialState;
}

function battleHashMix(hash, value) {
    const textValue = String(value);
    for (let i = 0; i < textValue.length; i++) {
        hash ^= textValue.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

function battleStateHash() {
    let hash = 2166136261 >>> 0;
    const mix = value => { hash = battleHashMix(hash, value); };
    mix(BATTLE_ENGINE_VERSION);
    mix(SIM.tick || 0);
    mix(SIM_RNG.state >>> 0);
    mix(Math.round((player.money || 0) * 100));
    mix(Math.round((enemy.money || 0) * 100));
    mix(Math.round((supportCooldowns?.paradrop || 0) * 1000));

    const battle = SIM.battle || {};
    mix(battle.attackerSide ? 1 : 0);
    mix(Math.round((battle.elapsedSec || 0) * 1000));
    mix(battle.winnerSide === null || battle.winnerSide === undefined ? '-' : battle.winnerSide ? 1 : 0);
    mix(battle.outcomeReason || '-');

    const orderedUnits = SIM.units.filter(unit => !unit.dead).slice().sort((a, b) => a.id - b.id);
    for (const unit of orderedUnits) {
        mix(unit.id); mix(unit.type); mix(unit.isRed ? 1 : 0); mix(unit.ally ? 1 : 0);
        mix(unit.controlOwner || '-'); mix(unit.controllerId || '-');
        mix(Math.round(unit.x * 100)); mix(Math.round(unit.y * 100));
        mix(Math.round(unit.hp * 100)); mix(Math.round((unit.ammo || 0) * 100));
        mix(Math.round((unit.suppression || 0) * 100));
        mix(unit.isFleeing ? 1 : 0);
        mix(unit.attackTarget && !unit.attackTarget.dead ? unit.attackTarget.id : 0);
        mix(Math.round((unit.targetX || 0) * 100)); mix(Math.round((unit.targetY || 0) * 100));
        mix(unit.operatorId != null ? unit.operatorId : '-');   // drone kontrol-bağı
        mix(unit.launchX != null ? Math.round(unit.launchX * 100) : '-'); mix(unit.launchY != null ? Math.round(unit.launchY * 100) : '-');   // drone fırlatma-noktası
        mix(unit._ctrlLostTick || 0);   // drone kontrol-kaybı/jam sayacı
        mix(unit._cmdShockUntil || 0); mix(unit._deathFxDone ? 1 : 0);   // komuta-şoku penceresi + onDeath-işlendi
        mix(unit._diveLastX != null ? Math.round(unit._diveLastX * 100) : '-'); mix(unit._diveLastY != null ? Math.round(unit._diveLastY * 100) : '-');   // drone taahhüt-hedef son-konumu
        mix(unit.payloadCount != null ? unit.payloadCount : '-'); mix(Math.round(unit._reloadTimer || 0));   // operatör mühimmat+ikmal-sayacı
        mix(unit._retired ? 1 : 0); mix(unit._refuelBaseKey || '-');   // helo emeklilik + üs-rezervasyon-bağı
    }

    const orderedFields = (SIM.trenches || []).slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    for (const field of orderedFields) {
        mix(Math.round(field.x * 100)); mix(Math.round(field.y * 100));
        mix(field.isRed ? 1 : 0); mix(Math.round((field.hp || 0) * 100)); mix(field.expiresAt || 0);
        mix(field.refuelsLeft == null ? '-' : field.refuelsLeft);   // helo-üssü kalan dolum-hakkı (değişir → hash-şart)
    }
    for (const spawn of pendingSupportSpawns || []) {
        mix(spawn.spawnAt); mix(spawn.type); mix(spawn.isRed ? 1 : 0);
        mix(Math.round(spawn.x * 100)); mix(Math.round(spawn.y * 100));
    }
    for (const support of activeSupports || []) {
        mix(support.type || '-'); mix(Math.round((support.x || 0) * 100));
        mix(Math.round((support.y || 0) * 100)); mix(Math.round((support.life || 0) * 1000));
        mix(support.payloadDropped ? 1 : 0);
    }
    // KONTROLÖR DURUŞU hash'e: birim hareketini belirliyor → sapma dedektörü görmeli (id-sıralı, ayrık alanlar).
    for (const cid of Object.keys(SIM.ctrlPosture || {}).sort()) {
        const p = SIM.ctrlPosture[cid];
        mix(cid); mix(p.open === null || p.open === undefined ? '-' : (p.open ? 1 : 0));
        mix(p.role == null ? '-' : p.role); mix(p.stance == null ? '-' : p.stance); mix(p.win ? 1 : 0);
    }
    // DEFERRED-DAMAGE: bekleyen-vuruşlar hash'e (divergence-dedektörü in-flight sapmayı yakalasın). Dizi-sırası deterministik (push/splice determinist).
    for (const ph of SIM.pendingHits || []) {
        mix(ph.arriveTick); mix(ph.seq); mix(ph.kind || '-');
        mix(ph.atkId != null ? ph.atkId : '-'); mix(ph.atkType != null ? ph.atkType : '-'); mix(ph.atkIsRed ? 1 : 0); mix(Math.round((ph.atkPower || 0) * 100));
        mix(Math.round((ph.atkX || 0) * 100)); mix(Math.round((ph.atkY || 0) * 100));   // fırlatma konumu (varışta distressX/Y'yi besler → AI davranışı)
        mix(ph.tgtId != null ? ph.tgtId : '-'); mix(Math.round((ph.dmg || 0) * 100)); mix(ph.isCrit ? 1 : 0); mix(ph.willAbandon ? 1 : 0); mix(ph.isRear ? 1 : 0); mix(ph.isFlank ? 1 : 0);
        mix(Math.round((ph.supp || 0) * 100)); mix(Math.round((ph.splashR || 0) * 100));
        mix(Math.round((ph.cx || 0) * 100)); mix(Math.round((ph.cy || 0) * 100)); mix(Math.round((ph.blastR || 0) * 100)); mix(Math.round((ph.suppR || 0) * 100)); mix(Math.round((ph.indAcc || 0) * 1000));
        mix(ph.killTick == null ? '-' : ph.killTick); mix(Math.round((ph.killX || 0) * 100)); mix(Math.round((ph.killY || 0) * 100));   // havada-önleme (kuyruktan düşme tik'i)
    }
    return hash.toString(16).padStart(8, '0');
}

// TEŞHİS: hash'i PARÇALARA böler (hangi bölüm canlı↔replay sapıyor?). battleStateHash ile birebir
// aynı mix'ler, ama global/battle/birimler/trench/destek ayrı hash'lenir.
function battleStateHashParts() {
    const h = (fn) => { let x = 2166136261 >>> 0; const mix = v => { x = battleHashMix(x, v); }; fn(mix); return (x >>> 0).toString(16).padStart(8, '0'); };
    const battle = SIM.battle || {};
    const g = h(mix => { mix(BATTLE_ENGINE_VERSION); mix(SIM.tick || 0); mix(SIM_RNG.state >>> 0); mix(Math.round((player.money || 0) * 100)); mix(Math.round((enemy.money || 0) * 100)); mix(Math.round((supportCooldowns?.paradrop || 0) * 1000)); });
    const b = h(mix => { mix(battle.attackerSide ? 1 : 0); mix(Math.round((battle.elapsedSec || 0) * 1000)); mix(battle.winnerSide === null || battle.winnerSide === undefined ? '-' : battle.winnerSide ? 1 : 0); mix(battle.outcomeReason || '-');
        for (const cid of Object.keys(SIM.ctrlPosture || {}).sort()) { const p = SIM.ctrlPosture[cid]; mix(cid); mix(p.open == null ? '-' : (p.open ? 1 : 0)); mix(p.role == null ? '-' : p.role); mix(p.stance == null ? '-' : p.stance); mix(p.win ? 1 : 0); } });   // kontrolör duruşu (birim hareketini belirler)
    const u = h(mix => { for (const unit of SIM.units.filter(x => !x.dead).slice().sort((a, b2) => a.id - b2.id)) { mix(unit.id); mix(unit.type); mix(unit.isRed ? 1 : 0); mix(unit.ally ? 1 : 0); mix(unit.controlOwner || '-'); mix(unit.controllerId || '-'); mix(Math.round(unit.x * 100)); mix(Math.round(unit.y * 100)); mix(Math.round(unit.hp * 100)); mix(Math.round((unit.ammo || 0) * 100)); mix(Math.round((unit.suppression || 0) * 100)); mix(unit.isFleeing ? 1 : 0); mix(unit.attackTarget && !unit.attackTarget.dead ? unit.attackTarget.id : 0); mix(Math.round((unit.targetX || 0) * 100)); mix(Math.round((unit.targetY || 0) * 100)); mix(unit.operatorId != null ? unit.operatorId : '-'); mix(unit.payloadCount != null ? unit.payloadCount : '-'); mix(Math.round(unit._reloadTimer || 0)); mix(unit._retired ? 1 : 0); mix(unit._refuelBaseKey || '-'); } });
    const t = h(mix => { for (const f of (SIM.trenches || []).slice().sort((a, b2) => (a.x - b2.x) || (a.y - b2.y))) { mix(Math.round(f.x * 100)); mix(Math.round(f.y * 100)); mix(f.isRed ? 1 : 0); mix(Math.round((f.hp || 0) * 100)); mix(f.expiresAt || 0); mix(f.refuelsLeft == null ? '-' : f.refuelsLeft); } for (const m of (SIM.mines || []).slice().sort((a, b2) => (a.x - b2.x) || (a.y - b2.y))) { mix(Math.round(m.x * 100)); mix(Math.round(m.y * 100)); mix(m.isRed ? 1 : 0); mix(m.armed ? 1 : 0); } });
    const s = h(mix => { for (const sp of pendingSupportSpawns || []) { mix(sp.spawnAt); mix(sp.type); mix(sp.isRed ? 1 : 0); mix(Math.round(sp.x * 100)); mix(Math.round(sp.y * 100)); } for (const su of activeSupports || []) { mix(su.type || '-'); mix(Math.round((su.x || 0) * 100)); mix(Math.round((su.y || 0) * 100)); mix(Math.round((su.life || 0) * 1000)); mix(su.payloadDropped ? 1 : 0); } for (const ph of SIM.pendingHits || []) { mix(ph.arriveTick); mix(ph.seq); mix(ph.kind || '-'); mix(ph.atkId != null ? ph.atkId : '-'); mix(Math.round((ph.atkX || 0) * 100)); mix(Math.round((ph.atkY || 0) * 100)); mix(ph.tgtId != null ? ph.tgtId : '-'); mix(Math.round((ph.dmg || 0) * 100)); mix(Math.round((ph.cx || 0) * 100)); mix(Math.round((ph.cy || 0) * 100)); } });
    return { g, b, u, t, s };
}

function battleMaybeRecordHash() {
    battleCaptureTelemetrySample();
    if (!BATTLE_SESSION.active || !BATTLE_REPLAY.initialState || (SIM.tick % 20) !== 0) return;
    const actual = battleStateHash();
    BATTLE_REPLAY.hashes.push({ tick: SIM.tick, hash: actual });
    if (BATTLE_REPLAY_DRIVER.active && !BATTLE_REPLAY_DRIVER.divergence) {
        const expected = battleExpectedHashAtTick(SIM.tick);
        if (expected && expected !== actual) {
            BATTLE_REPLAY_DRIVER.divergence = { tick: SIM.tick, expected, actual };
        }
    }
}

function exportBattleReplay() {
    return replayClone(BATTLE_REPLAY);
}

function battleRestoreUnit(snapshot) {
    const unit = new Unit(snapshot.type, snapshot.x, snapshot.y, !!snapshot.isRed);
    for (const key of [
        'maxHp', 'hp', 'atk', 'baseSpeed', 'speed', 'range', 'vision', 'atkSpeed',
        'baseArmor', 'armor', 'maxAmmo', 'ammo', 'veteran', 'level', 'xpBonus',
        'panicResistance', 'facingAngle', 'targetX', 'targetY', 'scanTimer', 'lastAttackTime',
        '_reloadTimer', '_hicAtesEtmedi', '_jamAcc', '_jamTik',
        '_ferryKalkti', '_ferryPickId', '_ferryHover', '_ferryBosaltiyor', '_ferryTeslimX', '_ferryTeslimY'
    ]) {
        if (snapshot[key] !== undefined) unit[key] = snapshot[key];
    }
    if (snapshot.operatorId != null) unit.operatorId = snapshot.operatorId;   // drone kontrol-bağı
    if (snapshot.launchX != null) unit.launchX = snapshot.launchX;   // drone fırlatma-noktası
    if (snapshot.launchY != null) unit.launchY = snapshot.launchY;
    if (snapshot._ctrlLostTick != null) unit._ctrlLostTick = snapshot._ctrlLostTick;   // drone kontrol-kaybı/jam sayacı
    if (snapshot.jammedLoss != null) unit.jammedLoss = snapshot.jammedLoss;   // kısmi-karıştırma: halenin ilan ettiği kontrol-kaybı oranı
    if (snapshot._cmdShockUntil != null) unit._cmdShockUntil = snapshot._cmdShockUntil;   // komuta-şoku penceresi
    if (snapshot._deathFxDone) unit._deathFxDone = true;   // onDeath-efekti işlendi (tek-seferlik)
    if (snapshot._diveLastX != null) unit._diveLastX = snapshot._diveLastX;   // drone taahhüt-hedef son-konumu
    if (snapshot._diveLastY != null) unit._diveLastY = snapshot._diveLastY;
    if (snapshot.payloadCount != null) unit.payloadCount = snapshot.payloadCount;   // operatör mühimmat-sayısı
    unit.id = snapshot.id;
    unit.ally = !!snapshot.ally;
    unit.controlOwner = snapshot.controlOwner || (unit.isRed ? CONTROL_OWNER.ENEMY_AI : CONTROL_OWNER.PLAYER);
    unit.controllerId = snapshot.controllerId || null;
    unit.dead = false;
    unit.selected = false;
    unit.attackTarget = null;
    unit.manualTarget = null;
    unit.manualMoveTarget = null;
    unit.isMovingToManualTarget = false;
    return unit;
}

function battleRestoreInitialState(initialState) {
    SIM.units.length = 0;
    SIM.trenches.length = 0; if (SIM.mines) SIM.mines.length = 0;
    if (SIM.pendingHits) { SIM.pendingHits.length = 0; SIM.pendingHitSeq = 0; }   // DEFERRED-DAMAGE: t0'da boş (initialState'te tutulmaz, pendingSupportSpawns-analogu)
    if (SIM.ctrlPosture) { for (const k in SIM.ctrlPosture) delete SIM.ctrlPosture[k]; }   // kontrolör duruşu t0'da boş (ilk tikte kontrolör/kayıt doldurur)
    Unit.nextId = 0;
    let maxId = 0;
    for (const snapshot of initialState.units || []) {
        const unit = battleRestoreUnit(snapshot);
        SIM.units.push(unit);
        maxId = Math.max(maxId, unit.id);
    }
    Unit.nextId = maxId;
    for (const field of initialState.trenches || []) {
        SIM.trenches.push(replayClone(field));
    }
    player.money = initialState.playerMoney || 0;
    enemy.money = initialState.enemyMoney || 0;
    SIM.tick = 0;
    simulationTime = 0;
    gameTime = 0;
    battleAccumulatorMs = 0;
    SIM_RNG.state = initialState.rngState >>> 0;
}

// ═══ BattleForkState.v1 — karşı-olgusal rollout için EKSİKSİZ fork ═══════════════════════
// initialState snapshot'ından FARKLI: tik/zaman + TÜM birim iç durumu (attackTarget dahil) +
// supports + rng korunur. Birim ref'leri (attackTarget/manualTarget) id ile serileşir, geri bağlanır.
function battleForkUnitSnapshot(u) {
    const s = {};
    for (const k in u) {
        if (!Object.prototype.hasOwnProperty.call(u, k)) continue;
        const v = u[k];
        if (typeof v === 'function') continue;
        if (k === 'attackTarget') { s.__attackTargetId = (v && !v.dead) ? v.id : null; continue; }
        if (k === 'manualTarget') { s.__manualTargetId = (v && !v.dead) ? v.id : null; continue; }
        // TAŞIMA BAĞI — KİMLİĞE ÇEVRİLİR (yoksa fork ÇÖKER). `cargo` yolcu Unit'lerini, yolcunun
        // `carrier`'ı da taşıyıcıyı işaret eder → DAİRESEL yapı; replayClone (JSON.stringify)
        // bunu klonlayamaz. Hata ferry düzeltmesinden SONRA görünür oldu: eskiden helo yükü
        // hemen bırakıyordu, artık gerçekten taşıyor ve döngü kapanıyor.
        if (k === 'cargo') { s.__cargoIds = Array.isArray(v) ? v.filter(z => z && !z.dead).map(z => z.id) : []; continue; }
        if (k === 'carrier') { s.__carrierId = (v && !v.dead) ? v.id : null; continue; }
        s[k] = (v && typeof v === 'object') ? replayClone(v) : v;
    }
    return s;
}
function battleForkRestoreUnit(s) {
    const u = new Unit(s.type, s.x, s.y, !!s.isRed);   // ctor srandInt tüketir → rng SONRA resetlenir
    for (const k in s) {
        if (k === '__attackTargetId' || k === '__manualTargetId') continue;
        if (k === '__cargoIds' || k === '__carrierId') continue;
        u[k] = (s[k] && typeof s[k] === 'object') ? replayClone(s[k]) : s[k];
    }
    u.dead = false;
    return u;
}
function battleForkCapture() {
    return {
        v: 1, tick: SIM.tick | 0,
        simTime: (typeof simulationTime !== 'undefined') ? simulationTime : 0,
        gTime: (typeof gameTime !== 'undefined') ? gameTime : 0,
        accMs: (typeof battleAccumulatorMs !== 'undefined') ? battleAccumulatorMs : 0,
        rngState: SIM_RNG.state >>> 0,
        playerMoney: player.money || 0, enemyMoney: enemy.money || 0,
        nextId: Unit.nextId || 0,
        units: SIM.units.filter(u => !u.dead).map(battleForkUnitSnapshot),
        trenches: (SIM.trenches || []).map(replayClone),
        activeSupports: (typeof activeSupports !== 'undefined') ? replayClone(activeSupports) : null,
        pendingSupportSpawns: (typeof pendingSupportSpawns !== 'undefined') ? replayClone(pendingSupportSpawns) : null,
        pendingHits: SIM.pendingHits ? replayClone(SIM.pendingHits) : null,   // DEFERRED-DAMAGE: uçuşta-vuruşlar fork-sınırından geçmeli (skaler → replayClone güvenli)
        pendingHitSeq: SIM.pendingHitSeq | 0,
        ctrlPosture: SIM.ctrlPosture ? replayClone(SIM.ctrlPosture) : null,   // kontrolör duruşu = sim-durumu (birim hareketi buna bağlı)
        supportCooldowns: (typeof supportCooldowns !== 'undefined') ? replayClone(supportCooldowns) : null,
        battle: SIM.battle ? replayClone(SIM.battle) : null,
        controllers: (typeof battleForkCaptureControllers === 'function') ? battleForkCaptureControllers() : null
    };
}
function battleForkRestore(fork) {
    SIM.units.length = 0; SIM.trenches.length = 0; if (SIM.mines) SIM.mines.length = 0;
    const byId = new Map();
    const snaps = fork.units || [];
    for (const s of snaps) { const u = battleForkRestoreUnit(s); SIM.units.push(u); byId.set(u.id, u); }
    for (let i = 0; i < snaps.length; i++) {
        const s = snaps[i], u = SIM.units[i];
        u.attackTarget = (s.__attackTargetId != null) ? (byId.get(s.__attackTargetId) || null) : null;
        u.manualTarget = (s.__manualTargetId != null) ? (byId.get(s.__manualTargetId) || null) : null;
        // TAŞIMA BAĞI geri kurulur: kimlikler ancak TÜM birimler yaratıldıktan sonra çözülebilir.
        if (Object.prototype.hasOwnProperty.call(s, '__cargoIds')) {
            u.cargo = (s.__cargoIds || []).map(id => byId.get(id)).filter(Boolean);
        }
        if (Object.prototype.hasOwnProperty.call(s, '__carrierId')) {
            u.carrier = (s.__carrierId != null) ? (byId.get(s.__carrierId) || null) : null;
        }
    }
    for (const f of fork.trenches || []) SIM.trenches.push(replayClone(f));
    const restoreArr = (live, saved) => { if (typeof live === 'undefined' || !live || !saved) return; live.length = 0; for (const x of saved) live.push(replayClone(x)); };
    if (typeof activeSupports !== 'undefined') restoreArr(activeSupports, fork.activeSupports);
    if (typeof pendingSupportSpawns !== 'undefined') restoreArr(pendingSupportSpawns, fork.pendingSupportSpawns);
    if (SIM.pendingHits) { restoreArr(SIM.pendingHits, fork.pendingHits); SIM.pendingHitSeq = fork.pendingHitSeq | 0; }   // DEFERRED-DAMAGE: uçuşta-vuruşlar + sıra-sayacı
    if (SIM.ctrlPosture) { for (const k in SIM.ctrlPosture) delete SIM.ctrlPosture[k]; if (fork.ctrlPosture) Object.assign(SIM.ctrlPosture, replayClone(fork.ctrlPosture)); }   // kontrolör duruşu
    if (typeof supportCooldowns !== 'undefined' && supportCooldowns && fork.supportCooldowns) { for (const k in supportCooldowns) delete supportCooldowns[k]; Object.assign(supportCooldowns, replayClone(fork.supportCooldowns)); }
    if (SIM.battle && fork.battle) Object.assign(SIM.battle, replayClone(fork.battle));
    player.money = fork.playerMoney || 0; enemy.money = fork.enemyMoney || 0;
    SIM.tick = fork.tick | 0;
    if (typeof simulationTime !== 'undefined') simulationTime = fork.simTime || 0;
    if (typeof gameTime !== 'undefined') gameTime = fork.gTime || 0;
    if (typeof battleAccumulatorMs !== 'undefined') battleAccumulatorMs = fork.accMs || 0;
    Unit.nextId = fork.nextId || 0;
    if (fork.controllers && typeof battleForkRestoreControllers === 'function') battleForkRestoreControllers(fork.controllers, byId);
    SIM_RNG.state = fork.rngState >>> 0;   // birim yaratımının tükettiği srand'ı geri al (EN SON)
}

// Controller iç durumu (nextDecisionTick + planCommitment + perception contact-hafızası + taskExecutor safha)
// — Map'ler entry-dizisine serileşir. Alt-sistem NESNELERİ korunur (yalnız veri alanları yüklenir → metodlar kalır).
function _forkCloneMap(m) { const out = []; if (m instanceof Map) for (const [k, v] of m) out.push([k, replayClone(v)]); return out; }
function _forkLoadMap(target, entries) { if (!(target instanceof Map)) return; target.clear(); for (const e of (entries || [])) target.set(e[0], replayClone(e[1])); }
function battleForkCaptureControllers() {
    if (typeof BATTLE_CONTROLLERS === 'undefined' || !BATTLE_CONTROLLERS) return null;
    const out = [];
    for (const c of BATTLE_CONTROLLERS.values()) {
        const cs = { id: c.id, nextDecisionTick: c.nextDecisionTick,
            currentPlan: replayClone(c.currentPlan), lastSituation: replayClone(c.lastSituation),
            lastObservation: replayClone(c.lastObservation), operationalPlan: replayClone(c.operationalPlan),
            candidatePlans: replayClone(c.candidatePlans), rankedPlans: replayClone(c.rankedPlans),
            lastPlanDecision: replayClone(c.lastPlanDecision), decisionHistory: replayClone(c.decisionHistory) };
        if (c.perception) cs.perc = { contacts: _forkCloneMap(c.perception.contacts), lastObservation: replayClone(c.perception.lastObservation), initialFriendlyValue: c.perception.initialFriendlyValue };
        if (c.planCommitment) cs.commit = { current: replayClone(c.planCommitment.current), sequence: c.planCommitment.sequence, transitionHistory: replayClone(c.planCommitment.transitionHistory), lastDecision: replayClone(c.planCommitment.lastDecision) };
        if (c.taskExecutor) cs.exec = { states: _forkCloneMap(c.taskExecutor.states), transitionHistory: replayClone(c.taskExecutor.transitionHistory), operation: replayClone(c.taskExecutor.operation), operationHistory: replayClone(c.taskExecutor.operationHistory), lastFireWindowTick: c.taskExecutor.lastFireWindowTick, lastTelemetry: replayClone(c.taskExecutor.lastTelemetry) };
        const op = c.operationalPlanner;
        if (op) cs.plan = { lastPlan: replayClone(op.lastPlan),
            fo: op.forceOrganizer ? { cachedPlanId: op.forceOrganizer.cachedPlanId, cachedUnitSignature: op.forceOrganizer.cachedUnitSignature, cachedGroups: replayClone(op.forceOrganizer.cachedGroups) } : null,
            tcp: op.taskContractPlanner ? { cachedKey: op.taskContractPlanner.cachedKey, cachedContracts: replayClone(op.taskContractPlanner.cachedContracts) } : null };
        out.push(cs);
    }
    return out;
}
function battleForkRestoreControllers(saved) {
    if (typeof BATTLE_CONTROLLERS === 'undefined' || !BATTLE_CONTROLLERS || !saved) return;
    for (const cs of saved) {
        const c = BATTLE_CONTROLLERS.get(cs.id); if (!c) continue;
        c.nextDecisionTick = cs.nextDecisionTick;
        c.currentPlan = replayClone(cs.currentPlan); c.lastSituation = replayClone(cs.lastSituation);
        c.lastObservation = replayClone(cs.lastObservation); c.operationalPlan = replayClone(cs.operationalPlan);
        c.candidatePlans = replayClone(cs.candidatePlans) || []; c.rankedPlans = replayClone(cs.rankedPlans) || [];
        c.lastPlanDecision = replayClone(cs.lastPlanDecision); c.decisionHistory = replayClone(cs.decisionHistory) || [];
        if (c.perception && cs.perc) { _forkLoadMap(c.perception.contacts, cs.perc.contacts); c.perception.lastObservation = replayClone(cs.perc.lastObservation); c.perception.initialFriendlyValue = cs.perc.initialFriendlyValue; }
        if (c.planCommitment && cs.commit) { c.planCommitment.current = replayClone(cs.commit.current); c.planCommitment.sequence = cs.commit.sequence; c.planCommitment.transitionHistory = replayClone(cs.commit.transitionHistory) || []; c.planCommitment.lastDecision = replayClone(cs.commit.lastDecision); }
        if (c.taskExecutor && cs.exec) { _forkLoadMap(c.taskExecutor.states, cs.exec.states); c.taskExecutor.transitionHistory = replayClone(cs.exec.transitionHistory) || []; c.taskExecutor.operation = replayClone(cs.exec.operation); c.taskExecutor.operationHistory = replayClone(cs.exec.operationHistory) || []; c.taskExecutor.lastFireWindowTick = cs.exec.lastFireWindowTick; c.taskExecutor.lastTelemetry = replayClone(cs.exec.lastTelemetry); }
        const op = c.operationalPlanner;
        if (op && cs.plan) { op.lastPlan = replayClone(cs.plan.lastPlan);
            if (op.forceOrganizer && cs.plan.fo) { op.forceOrganizer.cachedPlanId = cs.plan.fo.cachedPlanId; op.forceOrganizer.cachedUnitSignature = cs.plan.fo.cachedUnitSignature; op.forceOrganizer.cachedGroups = replayClone(cs.plan.fo.cachedGroups) || []; }
            if (op.taskContractPlanner && cs.plan.tcp) { op.taskContractPlanner.cachedKey = cs.plan.tcp.cachedKey; op.taskContractPlanner.cachedContracts = replayClone(cs.plan.tcp.cachedContracts) || []; } }
    }
}

function battleUnitById(id) {
    for (const unit of SIM.units) if (!unit.dead && unit.id === id) return unit;
    return null;
}

function battleApplyRecordedEvent(event) {
    const payload = event.payload || {};
    if (event.type === 'player-move') {
        for (const destination of payload.destinations || []) {
            const unit = battleUnitById(destination.id);
            if (!unit) continue;
            // KÖK NEDEN DÜZELTMESİ (canlı↔headless replay sapması): kayıttaki `destinations`
            // CANLI'da zaten terrainSafePoint'ten geçmiş NİHAİ hedeflerdir. Burada ikinci kez
            // terrainSafePoint uygulamak (fonksiyon idempotent değil) hedefi kaydırıp targetX/targetY
            // hash'ini saptırıyordu → replay ilk oyuncu-hareketinden sonra ~4-5 sn'de ayrılıyordu.
            // Kayıtlı nihai hedefi OLDUĞU GİBİ uygula (canlıyla bit-birebir).
            unit.targetX = destination.x;
            unit.targetY = destination.y;
            unit.manualTarget = null;
            unit.manualMoveTarget = { x: destination.x, y: destination.y };
            unit.isMovingToManualTarget = true;
            unit.attackTarget = null;
            // KUSUR (kullanici raporu 2026-08-09): "birligi kendine cok yakin bir konuma gondermeye
            // calistigimda gitmiyor." KOK NEDEN: birim varinca `_holdingPos` olur ve o modda yeniden
            // hareket esigi UNIT_RADIUS*2.6'ya cikar (Unit.js:540) — carpisma-itmesi kaynakli titremeyi
            // yutmak icin konmus histerezis. Ama OYUNCUNUN ACIK EMRINI de yutuyordu.
            // Histerezis KORUNUR (titreme dusmesin); yalniz acik emir onu SIFIRLAR.
            unit._holdingPos = false;
        }
    } else if (event.type === 'player-attack') {
        const target = battleUnitById(payload.targetId);
        if (!target) return;
        for (const id of payload.unitIds || []) {
            const unit = battleUnitById(id);
            if (!unit) continue;
            unit.manualTarget = target;
            unit.manualMoveTarget = null;
            unit.isMovingToManualTarget = false;
        }
    } else if (event.type === 'player-free-fire') {
        for (const id of payload.unitIds || []) {
            const unit = battleUnitById(id);
            if (!unit) continue;
            unit.manualTarget = null;
            unit.manualMoveTarget = null;
            unit.isMovingToManualTarget = false;
        }
    } else if (event.type === 'player-load') {   // TAŞIMA: seçili taşıyıcı(lar) hedef piyadeyi BİNDİRSİN (oyuncu emri)
        const target = battleUnitById(payload.targetId);
        if (!target) return;
        for (const id of payload.transportIds || []) {
            const u = battleUnitById(id);
            if (!u || !u.transportSlots) continue;
            u._loadOrderTargetId = target.id;
            u._unloadFlag = false;
            u.manualTarget = null; u.attackTarget = null;
        }
    } else if (event.type === 'player-unload') {   // TAŞIMA: seçili taşıyıcı(lar) yolcuları bulunduğu yere İNDİRSİN
        for (const id of payload.transportIds || []) {
            const u = battleUnitById(id);
            if (!u || !u.transportSlots) continue;
            u._unloadFlag = true;
            u._loadOrderTargetId = null;
        }
    } else if (event.type === 'player-mine') {   // MAYIN: seçili istihkam bulunduğu yere mayın döşer
        for (const id of payload.engineerIds || []) {
            const u = battleUnitById(id);
            if (!u || u.dead || u.type !== T.ENGINEER) continue;
            SIM.mines.push({ x: u.x, y: u.y, r: (typeof MINE_TRIGGER_R !== 'undefined' ? MINE_TRIGGER_R : 46), isRed: u.isRed, armed: false, createdAt: SIM.tick * BATTLE_TICK_MS, armDelay: 1500 });
        }
    } else if (event.type === 'player-ability') {   // SOL-PANEL YETENEK: seçili uygun birimler aktif-yeteneği tetikler (replay-güvenli, RNG/mutasyon BURADA)
        const ab = payload.ability;
        for (const id of payload.unitIds || []) {
            const u = battleUnitById(id);
            if (!u || u.dead) continue;
            if (ab === 'lay_mines') {
                if (u.type !== T.ENGINEER && u.type !== T.RECON) continue;   // keşif aracı da döşer (kullanıcı isteği)
                SIM.mines.push({ x: u.x, y: u.y, r: (typeof MINE_TRIGGER_R !== 'undefined' ? MINE_TRIGGER_R : 46), isRed: u.isRed, armed: false, createdAt: SIM.tick * BATTLE_TICK_MS, armDelay: 1500 });
            } else if (ab === 'build_fortification') {
                if (u.type !== T.ENGINEER) continue;
                u.buildTrenchTarget = { x: payload.x, y: payload.y };
                u.manualTarget = null; u.manualMoveTarget = null; u.attackTarget = null;
            } else if (ab === 'build_hospital') {   // SAHRA HASTANESİ: sağlıkçı sabit tesis kurar (siperle aynı listeye)
                if (u.type !== T.MEDIC) continue;
                u.buildTrenchTarget = { x: payload.x, y: payload.y };
                u.manualTarget = null; u.manualMoveTarget = null; u.attackTarget = null;
            } else if (ab === 'unload') {
                if (!u.transportSlots) continue;
                u._unloadFlag = true; u._loadOrderTargetId = null;
            } else if (ab === 'launch_drone') {   // DRONE-OPERATÖR: hedef-noktaya kamikaze-drone FIRLAT (determinist spawn burada)
                if (typeof battleLaunchDrones === 'function') battleLaunchDrones(u, payload.x, payload.y);
            }
        }
    } else if (event.type === 'support-paradrop') {
        triggerParadrop(payload.x, payload.y);
    } else if (event.type === 'network-commands' && typeof mpApplyCmds === 'function') {
        mpApplyCmds(payload.blue || [], false);
        mpApplyCmds(payload.red || [], true);
    } else if (event.type === 'controller-assignment') {
        const unit = battleUnitById(payload.unitId);
        if (!unit) return;
        unit.controllerId = payload.controllerId || null;
        unit.controlOwner = payload.owner || unit.controlOwner;
    } else if (event.type === 'controller-order' && typeof applyBattleOrder === 'function') {
        applyBattleOrder(payload);
    } else if (event.type === 'controller-posture') {
        // KONTROLÖR DURUŞU: replay'de kontrolör KOŞMAZ; birimlerin okuduğu duruşu kayıttan geri koy (canlı=replay).
        if (SIM.ctrlPosture && payload.controllerId) {
            SIM.ctrlPosture[payload.controllerId] = {
                open: (typeof payload.open === 'boolean') ? payload.open : null,
                role: payload.role != null ? payload.role : null,
                stance: payload.stance != null ? payload.stance : null,
                win: !!payload.win
            };
        }
    }
}

function battleReplayDrive() {
    const driver = BATTLE_REPLAY_DRIVER;
    if (!driver.active || !driver.source) return;
    const events = driver.source.events || [];
    while (driver.eventIndex < events.length && events[driver.eventIndex].tick <= SIM.tick) {
        const event = events[driver.eventIndex++];
        if (event.type !== 'battle-start') battleApplyRecordedEvent(event);
    }
}

function battleExpectedHashAtTick(tick) {
    const source = BATTLE_REPLAY_DRIVER.source;
    if (!source) return null;
    const entry = (source.hashes || []).find(item => item.tick === tick);
    return entry ? entry.hash : null;
}

function startBattleReplay(replay) {
    const source = replayClone(replay);
    if (!source || source.version !== 1 || source.engineVersion !== BATTLE_ENGINE_VERSION ||
        !source.session || !source.initialState) {
        throw new Error('Replay bu savaş motoru sürümüyle uyumlu değil.');
    }

    openBattlefieldSession({
        mode: 'replay',
        mapId: source.session.requestedMapId ?? source.session.mapId,
        seed: source.session.seed,
        attackerSide: source.session.attackerSide,
        durationSec: source.session.durationSec,
        playerMoney: source.initialState.playerMoney,
        enemyMoney: source.initialState.enemyMoney,
        deployRes: null,
        deployPool: null,
        techBonus: null,
        techBonusRed: null,
        show: false
    });
    battleRestoreInitialState(source.initialState);
    phase = PHASE.BATTLE;
    document.body.setAttribute('data-phase', PHASE.BATTLE);
    initBattleRules({
        attackerSide: source.session.attackerSide,
        durationSec: source.session.durationSec
    });

    BATTLE_REPLAY.version = source.version;
    BATTLE_REPLAY.engineVersion = source.engineVersion;
    BATTLE_REPLAY.session = replayClone(source.session);
    BATTLE_REPLAY.initialState = replayClone(source.initialState);
    BATTLE_REPLAY.events = replayClone(source.events || []);
    BATTLE_REPLAY.hashes = [{ tick: 0, hash: battleStateHash() }];
    BATTLE_REPLAY.playback = true;

    BATTLE_REPLAY_DRIVER.active = true;
    BATTLE_REPLAY_DRIVER.eventIndex = 0;
    BATTLE_REPLAY_DRIVER.source = source;
    BATTLE_REPLAY_DRIVER.divergence = null;

    const expected = battleExpectedHashAtTick(0);
    const actual = battleStateHash();
    if (expected && expected !== actual) {
        BATTLE_REPLAY_DRIVER.divergence = { tick: 0, expected, actual };
    }
    return {
        expected,
        actual,
        matched: !expected || expected === actual
    };
}

function battleReplayStatus() {
    return {
        active: BATTLE_REPLAY_DRIVER.active,
        eventIndex: BATTLE_REPLAY_DRIVER.eventIndex,
        eventCount: BATTLE_REPLAY_DRIVER.source?.events?.length || 0,
        divergence: replayClone(BATTLE_REPLAY_DRIVER.divergence),
        tick: SIM.tick,
        hash: battleStateHash()
    };
}

function runBattleReplayTicks(replay, tickLimit = null) {
    const source = replayClone(replay);
    const recordedLastTick = Math.max(0, ...(source.hashes || []).map(item => item.tick || 0));
    const maxTicks = Number.isFinite(tickLimit) ? Math.max(0, tickLimit | 0) : recordedLastTick;
    const initial = startBattleReplay(source);

    while (SIM.tick < maxTicks && !BATTLE_REPLAY_DRIVER.divergence) {
        simulationTime += BATTLE_TICK_MS;
        gameTime += BATTLE_TICK_SEC;
        stepSim(simulationTime, BATTLE_TICK_SEC, battleReplayDrive, false);
        updateSupport(BATTLE_TICK_SEC, simulationTime);
        if (SIM.battle && SIM.battle.winnerSide !== null) break;
    }
    return {
        initial,
        tick: SIM.tick,
        hash: battleStateHash(),
        hashes: replayClone(BATTLE_REPLAY.hashes),
        divergence: replayClone(BATTLE_REPLAY_DRIVER.divergence)
    };
}

function verifyBattleReplayDeterminism(replay, tickLimit = null) {
    const first = runBattleReplayTicks(replay, tickLimit);
    const second = runBattleReplayTicks(replay, tickLimit);
    const firstTrace = first.hashes.map(item => `${item.tick}:${item.hash}`);
    const secondTrace = second.hashes.map(item => `${item.tick}:${item.hash}`);
    const matched = !first.divergence && !second.divergence &&
        first.hash === second.hash &&
        firstTrace.length === secondTrace.length &&
        firstTrace.every((value, index) => value === secondTrace[index]);
    return {
        matched,
        first,
        second,
        engineVersion: BATTLE_ENGINE_VERSION,
        tickMs: BATTLE_TICK_MS
    };
}

function resetBattleState() {
    if (typeof units !== 'undefined') units.length = 0;
    if (typeof trenches !== 'undefined') trenches.length = 0; if (typeof mines !== 'undefined') mines.length = 0;
    if (typeof particles !== 'undefined') particles.length = 0;
    if (typeof activeSupports !== 'undefined') activeSupports.length = 0;
    if (typeof pendingSupportSpawns !== 'undefined') pendingSupportSpawns.length = 0;
    if (typeof SIM !== 'undefined' && SIM.pendingHits) { SIM.pendingHits.length = 0; SIM.pendingHitSeq = 0; }   // DEFERRED-DAMAGE: bekleyen-vuruş kuyruğu + sıra-sayacı sıfır
    if (typeof SIM !== 'undefined' && SIM.ctrlPosture) { for (const k in SIM.ctrlPosture) delete SIM.ctrlPosture[k]; }   // kontrolör duruşu sıfır
    if (typeof craters !== 'undefined') craters.length = 0;
    if (typeof decals !== 'undefined') decals.length = 0;
    if (typeof supportCooldowns !== 'undefined') supportCooldowns.paradrop = 0;
    if (typeof SIM !== 'undefined') SIM.tick = 0;
    // MAÇ-İZOLASYONU (ölçüm-bütünlüğü): taze-maç birim-id'leri 1'den başlasın. Aksi halde art-arda maçlarda (turnuva) id-sayacı
    // önceki maçtan devralınır → 'u.id < best.id' tiebreak'leri kayar → maç N+1, maç N'in spawn-sayısına bağlı olur (cross-match sızıntı).
    // Replay zaten battleRestoreInitialState'te nextId'yi sıfırlar → bu, taze-yol için aynısını yapar (determinizm-nötr, replay-güvenli).
    if (typeof Unit !== 'undefined') Unit.nextId = 0;
    if (typeof resetBattleRules === 'function') resetBattleRules();
    if (typeof player !== 'undefined') { player.kills = 0; player.unitsSpawned = 0; }
    if (typeof enemy !== 'undefined') { enemy.kills = 0; enemy.unitsSpawned = 0; }
    if (typeof gameTime !== 'undefined') gameTime = 0;
    if (typeof simulationTime !== 'undefined') simulationTime = 0;
    if (typeof battleAccumulatorMs !== 'undefined') battleAccumulatorMs = 0;
    if (typeof phase !== 'undefined' && typeof PHASE !== 'undefined') phase = PHASE.DEPLOY;
    if (typeof selectedSpawnType !== 'undefined') selectedSpawnType = null;
    if (typeof deployCarried !== 'undefined') deployCarried = null;
    if (typeof warRoomResetBattleUI === 'function') warRoomResetBattleUI();
    if (typeof resetGroundCanvas === 'function') resetGroundCanvas();
    if (typeof resetBattleControllers === 'function') resetBattleControllers();
    BATTLE_SESSION.active = false;
    BATTLE_SESSION.mode = null;
    battleResetReplay();

    document.body.setAttribute('data-phase', 'deploy');
    document.getElementById('game-over-screen')?.classList.add('hidden');
    document.getElementById('start-btn')?.classList.remove('hidden');
    document.getElementById('mp-ready-btn')?.classList.add('hidden');
    document.getElementById('ui-support')?.classList.add('hidden');
    const spawn = document.getElementById('ui-spawn-bar');
    if (spawn) { spawn.style.opacity = '1'; spawn.style.pointerEvents = 'auto'; }
}

function openBattlefieldSession(config = {}) {
    const seed = Number.isFinite(config.seed) ? (config.seed >>> 0) || 1 : ((Date.now() >>> 0) || 1);
    const durationSec = Math.max(30, Number.isFinite(config.durationSec)
        ? config.durationSec
        : (typeof DEFAULT_BATTLE_DURATION_SEC !== 'undefined' ? DEFAULT_BATTLE_DURATION_SEC : 240));

    // "Tekrar Oyna" bunu kullanır: aynı ayarlarla AYNI maçı kurabilmek için son yapılandırma saklanır.
    // Tohum burada SABİTLENİR (config.seed boşsa Date.now() geliyordu) → tekrar gerçekten aynı maç olur.
    if (typeof LAST_BATTLE_CONFIG !== 'undefined') LAST_BATTLE_CONFIG = Object.assign({}, config, { seed });

    resetBattleState();

    BATTLE_SESSION.active = true;
    BATTLE_SESSION.engineVersion = BATTLE_ENGINE_VERSION;
    BATTLE_SESSION.interactive = config.show !== false;   // gerçek oyun (görünür) vs headless test — öğrenen-AI kancası buna bağlı
    BATTLE_SESSION.mode = config.mode || 'quick';
    BATTLE_SESSION.requestedMapId = Number.isFinite(config.mapId) ? config.mapId : -2;
    BATTLE_SESSION.mapId = BATTLE_SESSION.requestedMapId;
    BATTLE_SESSION.seed = seed;
    BATTLE_SESSION.attackerSide = config.attackerSide === true;
    BATTLE_SESSION.durationSec = durationSec;
    // İLAN EDİLMİŞ BÜTÇELER: maç kuralı, iki taraf da bilir (hile değil — puan sınırı gibi). intel4-pro
    // 'trueForceRatio' istihbarat-tabanını buradan kurar; eskiden AI kendi başlangıç değerini düşman
    // sanıyordu ve kuvvet-oranı fiilen "kendi sağkalım yüzdesi" oluyordu (docs/KUVVET-ORANI-HATASI.md).
    BATTLE_SESSION.blueBudget = Math.max(0, Number(config.playerMoney) || 0);
    BATTLE_SESSION.redBudget = Math.max(0, Number(config.enemyMoney) || 0);
    BATTLE_REPLAY.session = replayClone(BATTLE_SESSION);

    if (typeof QUICK_MATCH_ATTACKER_SIDE !== 'undefined') {
        QUICK_MATCH_ATTACKER_SIDE = BATTLE_SESSION.attackerSide;
    }
    if (typeof player !== 'undefined' && Number.isFinite(config.playerMoney)) player.money = config.playerMoney;
    if (typeof enemy !== 'undefined' && Number.isFinite(config.enemyMoney)) enemy.money = config.enemyMoney;
    if (typeof DEPLOY_RES !== 'undefined') DEPLOY_RES = config.deployRes ?? null;
    if (typeof DEPLOY_POOL !== 'undefined') DEPLOY_POOL = config.deployPool ?? null;
    if (typeof TECH_BONUS !== 'undefined') TECH_BONUS = config.techBonus ?? null;
    if (typeof TECH_BONUS_RED !== 'undefined') TECH_BONUS_RED = config.techBonusRed ?? null;

    if (typeof applyMap === 'function') applyMap(BATTLE_SESSION.requestedMapId);
    if (typeof currentMapId !== 'undefined' && Number.isFinite(currentMapId)) {
        BATTLE_SESSION.mapId = currentMapId;
    }
    if (typeof resetSimRng === 'function') resetSimRng(seed);

    const showTypedResources = !!(DEPLOY_RES && DEPLOY_RES.blue);
    ['res-oil', 'res-manpower', 'res-points'].forEach(id =>
        document.getElementById(id)?.classList.toggle('hidden', !showTypedResources));

    if (typeof configureBattleControllers === 'function') {
        const controllerConfigs = Array.isArray(config.controllers)
            ? config.controllers
            : (typeof battleDefaultControllerConfigs === 'function'
                ? battleDefaultControllerConfigs(config)
                : []);
        configureBattleControllers(controllerConfigs);
        BATTLE_SESSION.controllerProfile = controllerConfigs.length
            ? 'common-battle-ai-v1'
            : 'none';
    }
    if (typeof battleAutoDeploySession === 'function') {
        battleAutoDeploySession(config);
    }
    if (config.show !== false && typeof showScreen === 'function') showScreen('game');
    return BATTLE_SESSION;
}

function battlefieldRulesConfig() {
    return {
        attackerSide: BATTLE_SESSION.attackerSide === true,
        durationSec: BATTLE_SESSION.durationSec
    };
}
