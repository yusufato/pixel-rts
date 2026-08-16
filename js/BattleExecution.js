// Görev sözleşmelerini safhalı ve tarafsız savaş emirlerine çevirir.
// Hedef doğrulaması yalnızca controller observation snapshot'ından yapılır.

const TASK_EXECUTION_PHASE = Object.freeze({
    ASSEMBLE: 'ASSEMBLE',
    ADVANCE: 'ADVANCE',
    ACTION: 'ACTION',
    HOLD: 'HOLD',
    WITHDRAW: 'WITHDRAW',
    COMPLETE: 'COMPLETE'
});

const TASK_ORDER_REFRESH_TICKS = 60;
const TASK_ACTION_REFRESH_TICKS = 30;
const TASK_ARRIVAL_RADIUS = 95;
const DEFENSE_RESPREAD_TICKS = 200;   // INTEL4 anti-blob: savunan-re-spread throttle ~10s (>8s dig_in-siperlenme → pulse entrench'i sıfırlamasın; DISPERSED_LINE asıl yayan)
const DEFENSE_RESPREAD_RADIUS = 100;  // yalnız CİDDİ yumakta (bounding-radius<100) re-spread; yayılınca dur → sabit-kal → siperlen
const FOCUS_HYST_MARGIN = 12;         // INTEL4 hedef-histerezisi: yeni-hedef eskisini bu kadar geçmezse ODAĞI KORU (savrulma önle)
const OPERATION_EXECUTION_PHASE = Object.freeze({
    ASSEMBLE: 'ASSEMBLE',
    FIRE_WINDOW: 'FIRE_WINDOW',
    ASSAULT: 'ASSAULT',
    EXPLOIT: 'EXPLOIT'
});
const OPERATION_ASSEMBLE_TIMEOUT_TICKS = Math.round(18 / BATTLE_TICK_SEC);
const OPERATION_FIRE_MIN_TICKS = Math.round(8 / BATTLE_TICK_SEC);
const OPERATION_FIRE_MAX_TICKS = Math.round(14 / BATTLE_TICK_SEC);
const OPERATION_ASSAULT_TO_EXPLOIT_TICKS = Math.round(18 / BATTLE_TICK_SEC);
const OPERATION_COMBAT_ROLES = new Set([
    TASK_GROUP_ROLE.MAIN,
    TASK_GROUP_ROLE.FIXING,
    TASK_GROUP_ROLE.FLANK
]);

function executionRound(value) {
    return Math.round(value * 100) / 100;
}

function executionSafePoint(point) {
    const x = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, point.x));
    const y = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, point.y));
    if (typeof nearestPassable !== 'function') return { x: executionRound(x), y: executionRound(y) };
    const safe = nearestPassable(x, y, 30);
    return {
        x: executionRound(Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, safe.x))),
        y: executionRound(Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, safe.y)))
    };
}

function executionUnits(contract, observation) {
    const ids = new Set(contract.unitIds || []);
    return (observation?.ownUnits || [])
        .filter(unit => ids.has(unit.id))
        .sort((a, b) => a.id - b.id);
}

function executionCentroid(units) {
    if (!units.length) return null;
    return {
        x: units.reduce((sum, unit) => sum + unit.x, 0) / units.length,
        y: units.reduce((sum, unit) => sum + unit.y, 0) / units.length
    };
}

function executionArrived(units, point, radius = TASK_ARRIVAL_RADIUS) {
    if (!units.length || !point) return false;
    const centroid = executionCentroid(units);
    return Math.hypot(centroid.x - point.x, centroid.y - point.y) <= radius;
}

// INTEL4 ANTI-BLOB: grup dağılımı = centroid'e en-uzak-birim mesafesi (bounding-radius). Küçük=yumak. Deterministik (RNG yok).
function executionGroupDispersion(units) {
    if (!units || units.length < 2) return Infinity;
    const c = executionCentroid(units);
    let r = 0;
    for (const u of units) { const d = Math.hypot(u.x - c.x, u.y - c.y); if (d > r) r = d; }
    return r;
}

function executionFormationOffset(index, count, formation, forwardX, forwardY) {
    const sideX = -forwardY;
    const sideY = forwardX;
    const centered = index - (count - 1) / 2;
    if (formation === 'COLUMN') {
        return { x: -forwardX * index * 48, y: -forwardY * index * 48 };
    }
    if (formation === 'WEDGE') {
        const row = Math.ceil(index / 2);
        const sign = index === 0 ? 0 : (index % 2 ? -1 : 1);
        return {
            x: -forwardX * row * 45 + sideX * sign * row * 42,
            y: -forwardY * row * 45 + sideY * sign * row * 42
        };
    }
    if (formation === 'ECHELON') {
        return {
            x: -forwardX * index * 32 + sideX * index * 48,
            y: -forwardY * index * 32 + sideY * index * 48
        };
    }
    if (formation === 'DEFENSE_GRID' || formation === 'DEFENSE_GRID_WIDE') {
        // INTEL4 (analist #4-metrik): YEREL-YOĞUNLUK karşıtı geniş ızgara. Yaygın alan-silahına (topçu 300/ÇNRA 250/havan 200px)
        // aoe-güvenli. _WIDE = TEHDİT-PROFİLİ areaAlpha-teyit reaksiyonu: 340→480px → balistik-600px-çemberde bile ≤2-3 birim.
        const cols = Math.max(2, Math.round(Math.sqrt(Math.max(1, count) * 1.6)));   // hafif geniş-cephe
        const col = index % cols, rowN = Math.floor(index / cols);
        const S = (formation === 'DEFENSE_GRID_WIDE') ? 480 : 340;
        const cx = col - (cols - 1) / 2;
        return { x: sideX * cx * S - forwardX * rowN * S, y: sideY * cx * S - forwardY * rowN * S };
    }
    if (formation === 'DEFENSE_GRID_XWIDE') {
        // FAZ3 (analist Suçlu-2, 'defense'-delta): TAM-CEPHE GARNİZON. Analist t=20'de L=22 (22 birim tek aoe600-çemberinde) gördü.
        // aoe600'ü KIRMAK için yerel-ayrım ≥600px (600px'de komşu çemberin DIŞINDA → L≤~6). GENİŞ-SIĞ: çok kolon (cephe-boyu), az sıra.
        const cols = Math.max(3, Math.round(Math.sqrt(Math.max(1, count) * 2.4)));   // DEFENSE_GRID'den geniş-cephe (sığ derinlik)
        const col = index % cols, rowN = Math.floor(index / cols);
        const S = 600;
        const cx = col - (cols - 1) / 2;
        return { x: sideX * cx * S - forwardX * rowN * S, y: sideY * cx * S - forwardY * rowN * S };
    }
    const spacing = formation === 'DISPERSED_LINE' ? 82 : formation === 'SCREEN' ? 68 : 50;
    return { x: sideX * centered * spacing, y: sideY * centered * spacing };
}

function executionDistinctDestination(point, occupied, seed = 0) {
    const first = executionSafePoint(point);
    const free = candidate => occupied.every(other =>
        Math.hypot(candidate.x - other.x, candidate.y - other.y) >= 44
    );
    if (free(first)) return first;

    // nearestPassable, engel kenarında birden fazla formasyon yuvasını aynı
    // geçilebilir hücreye katlayabilir. Deterministik halka araması her birliğe
    // ayrı bir yuva vererek yığılmayı emir aşamasında engeller.
    for (let ring = 1; ring <= 8; ring++) {
        const radius = ring * 46;
        for (let step = 0; step < 12; step++) {
            const angle = ((step + seed) % 12) * (Math.PI * 2 / 12);
            const candidate = executionSafePoint({
                x: point.x + Math.cos(angle) * radius,
                y: point.y + Math.sin(angle) * radius
            });
            if (free(candidate)) return candidate;
        }
    }
    return first;
}

// ── KÜTLE-İÇİ ANTİ DİZİLİM ('massMatch') — KÜTLEYİ BÖLMEDEN eşleşmeyi düzelt ──
// İKİ DENEME BAŞARISIZ OLDU ve ikisi de HAREKET katmanındaydı: birim freni (`antiMatch`, 22/48) ve
// grup nişanı (`armCommand`, 26/48 — üstelik yayılımı +49 artırıp etki-oranını 6.56→2.73 düşürdü).
// ÖLÇÜLEN DERS: bu motorda BİRLEŞİK-SİLAH KÜTLESİ, eşleşme-optimize edilmiş PARÇALARI yener.
// Bu yüzden burada kütle BÖLÜNMEZ: hedef noktası, formasyon geometrisi ve menzil-katmanı (kısa öne,
// uzun arkaya) AYNEN kalır — yalnız AYNI DERİNLİK BANDINDAKİ birimler kendi aralarında YANAL olarak
// yeniden dizilir. Tanksavar kütlenin zırha bakan yüzüne, piyade piyadeye bakan yüzüne düşer.
// Kütle merkezi, cephe genişliği ve derinlik DEĞİŞMEZ → yoğunlaşma kaybı yok.
let _execAntiCtx = null;   // { contacts, side } — decide() başında kurulur, sonunda temizlenir

// ── HEDEF KİLİDİ ('destLock') — KARAR DÖNGÜSÜ ÇALKANTISINI KES ──
// ÖLÇÜLDÜ (tools/karar-dongusu.js, 24 maç): her birim dakikada 6.4 kez 220px+ hedef değiştiriyor ve net
// yer değiştirmesinin ~4 KATI yol yürüyor; ilk temasta muharip kuvvetin yalnız %12'si olay yerinde.
// ÇALKANTI ATFI (tools/hedef-calkanti-atfi.js): %54 `applyBattleOrder` — yani kontrolörün emri.
// SLOT HİPOTEZİ ÇÜRÜTÜLDÜ (%1): aynı noktaya yeniden emir birim hedefini oynatmıyor; nokta GERÇEKTEN
// oynuyor (tek maçta 102 kez). Yani kuvvet, varmadan önce yeniden yönlendiriliyor.
// ÇARE (bu kod tabanının kendi kalıbı — STANCE_LOCK / odak-histerezisi / ana-çaba 70s kilidi ile aynı):
// grup hedefi bir KİLİT ile tutulur; küçük sürüklenme yok sayılır, büyük değişiklik en az bir bekleme
// süresi geçmeden uygulanmaz. GÜVENLİK KAPILARI: (a) çok büyük yeniden-yönelim (>1200px) anında geçer,
// (b) grup hedefe vardıysa kilit düşer. Böylece "gerçek yeni bilgi" engellenmez, yalnız titreşim kesilir.
const DEST_LOCK_PX = 420;        // bu kadar altındaki nokta kayması YOK SAYILIR (aynı yere gidiyoruz)
const DEST_LOCK_TICKS = 200;     // ~10s: büyük değişiklik için asgari bekleme
const DEST_LOCK_HARD_PX = 1200;  // bundan büyük yeniden-yönelim kilidi DELER (gerçek yön değişikliği)
const DEST_LOCK_ARRIVED = 240;   // grup merkezi hedefe bu kadar yaklaştıysa kilit düşer (görev bitti)
const _destLock = new Map();     // contractId -> { x, y, tick }
/* FORK KOPRUSU (2026-08-16): _destLock MODUL SEVIYESINDE ve karar girdisi — hangi noktaya
   yurunecegini kilitliyor. Fork'a yazilmayinca ayni durumdan yapilan IKINCI rollout,
   BIRINCININ kilitleriyle basliyor ve FARKLI hareket kararlari uretiyordu. Olculdu: ayni
   fork'tan 3 rollout 3 farkli hash (saf fizik 3/3 ayni). Arama icin olumcul, tek-atislik
   fork'ta gorunmuyordu. */
function battleExecLockCapture() { return [..._destLock.entries()].map(([k, v]) => [k, { x: v.x, y: v.y, tick: v.tick }]); }
function battleExecLockRestore(saved) {
    _destLock.clear();
    for (const [k, v] of (saved || [])) _destLock.set(k, { x: v.x, y: v.y, tick: v.tick });
}
function executionLockedPoint(contract, units, point) {
    if (!_execAntiCtx || typeof battleProDelta !== 'function' ||
        !battleProDelta(_execAntiCtx.side, 'destLock')) return point;
    const simdi = (typeof SIM !== 'undefined' && SIM.tick) || 0;
    const onceki = _destLock.get(contract.id);
    if (!onceki) { _destLock.set(contract.id, { x: point.x, y: point.y, tick: simdi }); return point; }
    const kayma = Math.hypot(point.x - onceki.x, point.y - onceki.y);
    if (kayma <= 1) return { x: onceki.x, y: onceki.y };
    const merkez = executionCentroid(units);
    const vardi = merkez && Math.hypot(merkez.x - onceki.x, merkez.y - onceki.y) <= DEST_LOCK_ARRIVED;
    const zorunlu = kayma >= DEST_LOCK_HARD_PX;
    const beklendi = (simdi - onceki.tick) >= DEST_LOCK_TICKS;
    if (zorunlu || vardi || (kayma >= DEST_LOCK_PX && beklendi)) {
        _destLock.set(contract.id, { x: point.x, y: point.y, tick: simdi });
        return point;
    }
    if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
        BATTLE_BALANCE.destLockHold = (BATTLE_BALANCE.destLockHold || 0) + 1;
    }
    return { x: onceki.x, y: onceki.y };   // kilitli: eski hedefe devam et (kuvvet oraya VARSIN)
}
function executionAntiLateral(unitType, point, sideX, sideY, contacts) {
    let wx = 0, wy = 0, w = 0;
    for (const c of contacts) {
        if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.typeEstimate == null) continue;
        const g = battleTypeDps(unitType, c.typeEstimate) * (Number.isFinite(c.confidence) ? c.confidence : 1);
        if (g <= 0) continue;
        wx += c.x * g; wy += c.y * g; w += g;
    }
    if (w <= 0) return 0;
    return ((wx / w) - point.x) * sideX + ((wy / w) - point.y) * sideY;
}

function executionMoveOrder(contract, units, point, reason) {
    point = executionLockedPoint(contract, units, point);   // KARAR DÖNGÜSÜ: hedef kilidi (bkz. yukarısı)
    const centroid = executionCentroid(units) || point;
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const distance = Math.hypot(dx, dy) || 1;
    const forwardX = dx / distance;
    const forwardY = dy / distance;
    const occupied = [];
    // MENZİL-KATMANLI KOL (kombine kol): KISA-menzil ÖNE (düşük index=ön slot), UZUN-menzil ARKAYA.
    // → MBT/piyade önde temas eder, AT/TD/topçu arkadan üzerinden ateşler. Deterministik (id-tiebreak).
    const ordered = units.slice().sort((a, b) => {
        const ra = (typeof STATS !== 'undefined' && STATS[a.type]) ? (STATS[a.type].range || 0) : 0;
        const rb = (typeof STATS !== 'undefined' && STATS[b.type]) ? (STATS[b.type].range || 0) : 0;
        return ra - rb || a.id - b.id;
    });
    // KÜTLE-İÇİ ANTİ DİZİLİM: slotlar aynı, yalnız aynı derinlikteki birimler yanal olarak yer değişir.
    let yerlesim = ordered;
    if (_execAntiCtx && _execAntiCtx.contacts && _execAntiCtx.contacts.length &&
        typeof battleProDelta === 'function' && battleProDelta(_execAntiCtx.side, 'massMatch')) {
        const sideX = -forwardY, sideY = forwardX;
        const slot = ordered.map((_, i) => executionFormationOffset(i, units.length, contract.formation, forwardX, forwardY));
        const derin = s => Math.round((-(s.x * forwardX + s.y * forwardY)) / 40);   // 40px bantlar
        const yan = s => s.x * sideX + s.y * sideY;
        const bant = new Map();
        for (let i = 0; i < slot.length; i++) {
            const d = derin(slot[i]);
            if (!bant.has(d)) bant.set(d, []);
            bant.get(d).push(i);
        }
        yerlesim = ordered.slice();
        for (const d of [...bant.keys()].sort((a, b) => a - b)) {
            const idx = bant.get(d);
            if (idx.length < 2) continue;
            const slotSirali = idx.slice().sort((a, b) => (yan(slot[a]) - yan(slot[b])) || (a - b));
            const birimler = idx.map(i => ordered[i]).sort((a, b) =>
                (executionAntiLateral(a.type, point, sideX, sideY, _execAntiCtx.contacts) -
                 executionAntiLateral(b.type, point, sideX, sideY, _execAntiCtx.contacts)) || (a.id - b.id));
            for (let k = 0; k < slotSirali.length; k++) yerlesim[slotSirali[k]] = birimler[k];
        }
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.massMatchOrder = (BATTLE_BALANCE.massMatchOrder || 0) + 1;
        }
    }
    const destinations = yerlesim.map((unit, index) => {
        const offset = executionFormationOffset(
            index,
            units.length,
            contract.formation,
            forwardX,
            forwardY
        );
        const destination = executionDistinctDestination({
            x: point.x + offset.x,
            y: point.y + offset.y
        }, occupied, unit.id);
        occupied.push(destination);
        return { id: unit.id, x: destination.x, y: destination.y };
    });
    return {
        kind: BATTLE_ORDER_KIND.MOVE,
        unitIds: units.map(unit => unit.id),
        destinations,
        reason
    };
}

function executionHoldOrder(contract, units, reason) {
    return {
        kind: BATTLE_ORDER_KIND.HOLD,
        unitIds: units.map(unit => unit.id),
        reason: `${reason}:${contract.groupRole}`
    };
}

function executionContactDistanceToUnits(contact, units) {
    let distance = Infinity;
    for (const unit of units || []) {
        distance = Math.min(distance, Math.hypot(contact.x - unit.x, contact.y - unit.y));
    }
    return distance;
}

function executionVisibleTarget(contract, units, observation, options = {}) {
    const visible = (observation?.contacts || []).filter(contact => contact.visible);
    if (!visible.length) return null;
    const centroid = executionCentroid(units);
    if (!centroid) return null;
    const candidates = visible.map(contact => ({
        contact,
        unitDistance: executionContactDistanceToUnits(contact, units),
        centroidDistance: Math.hypot(contact.x - centroid.x, contact.y - centroid.y),
        objectiveDistance: Math.hypot(
            contact.x - contract.objective.x,
            contact.y - contract.objective.y
        )
    })).filter(item =>
        item.unitDistance <= (options.maxUnitDistance ?? Infinity)
    );
    if (!candidates.length) return null;

    // ORTAK FOCUS-FIRE: operasyon tek bir öncelikli hedef seçtiyse ve o hedef bu grubun menzilindeyse, HERKES ona
    // yüklensin → dağınık tek-tek vuruş yerine konsantre yıkım (insanın kazanma tarzı; "kağıtta değil mermide konsantrasyon").
    if (options.focusTargetId != null) {
        const focus = candidates.find(item => item.contact.id === options.focusTargetId);
        if (focus) return focus.contact;
    }

    const nearestDistance = Math.min(...candidates.map(item => item.unitDistance));
    const localBand = options.localBand ?? Math.max(140, contract.pursuitLimit || 0);
    const localCandidates = candidates.filter(item =>
        item.unitDistance <= nearestDistance + localBand
    );
    const healthPriority = contact =>
        contact.healthBand === 'CRITICAL' ? 32 :
            contact.healthBand === 'DAMAGED' ? 14 : 0;
    candidates.sort((a, b) =>
        (
            a.unitDistance +
            a.centroidDistance * 0.12 +
            a.objectiveDistance * 0.04 -
            (a.contact.id === contract.objective.contactId ? 35 : 0) -
            healthPriority(a.contact)
        ) -
        (
            b.unitDistance +
            b.centroidDistance * 0.12 +
            b.objectiveDistance * 0.04 -
            (b.contact.id === contract.objective.contactId ? 35 : 0) -
            healthPriority(b.contact)
        ) ||
        (b.contact.confidence - a.contact.confidence) ||
        a.contact.id - b.contact.id
    );
    localCandidates.sort((a, b) =>
        candidates.indexOf(a) - candidates.indexOf(b)
    );
    return localCandidates[0]?.contact || null;
}

function executionSelfDefenseTarget(contract, units, observation, options = {}) {
    const engagementFactor = Math.max(1, options.engagementFactor || 1.08);
    const defensiveRange = Math.max(
        105,
        (contract.preferredRange || 100) * engagementFactor
    );
    return executionVisibleTarget(contract, units, observation, {
        maxUnitDistance: defensiveRange,
        localBand: 90,
        focusTargetId: options.focusTargetId   // ortak focus'u ilet (menzildeyse herkes aynı hedefe)
    });
}

function executionAttackOrder(contract, units, target) {
    return {
        kind: BATTLE_ORDER_KIND.ATTACK,
        unitIds: units.map(unit => unit.id),
        targetId: target.id,
        reason: `TASK:${contract.id}:VISIBLE_CONTACT`
    };
}

function executionSelfDefenseAttackOrder(contract, units, target, options = {}) {
    const engagementFactor = Math.max(1, options.engagementFactor || 1.08);
    const firingUnits = units.filter(unit => {
        const range = STATS[unit.type]?.range || contract.preferredRange || 100;
        return Math.hypot(target.x - unit.x, target.y - unit.y) <=
            range * engagementFactor;
    });
    return firingUnits.length
        ? executionAttackOrder(contract, firingUnits, target)
        : null;
}

function executionExploitSearchPoint(contract, side, sweepIndex = 0) {
    // Eski temasın koordinatını tarama merkezi yapmak kuvvetin öldürdüğü ilk
    // hedefin etrafında sonsuza kadar dönmesine yol açıyordu. Temas yoksa
    // aranan şey tek bir birlik değil, savunma bölgesinin tamamıdır.
    const base = typeof battleObjectiveForSide === 'function'
        ? battleObjectiveForSide(side)
        : { x: WORLD_W * 0.5, y: side ? WORLD_H * 0.76 : WORLD_H * 0.24 };
    const forward = side ? 1 : -1;
    const patterns = {
        [TASK_GROUP_ROLE.MAIN]: [
            [0, 150], [-420, 240], [420, 240],
            [-700, 340], [700, 340], [0, 460]
        ],
        [TASK_GROUP_ROLE.FIXING]: [
            [-620, 130], [-260, 250], [260, 350], [620, 430]
        ],
        [TASK_GROUP_ROLE.FLANK]: [
            [620, 130], [760, 270], [360, 420],
            [-360, 420], [-760, 270]
        ],
        [TASK_GROUP_ROLE.RECON]: [
            [-820, 230], [820, 230], [0, 520]
        ],
        [TASK_GROUP_ROLE.RESERVE]: [
            [0, 80], [-360, 260], [360, 260], [0, 440]
        ]
    };
    const rolePattern = patterns[contract.groupRole] || patterns[TASK_GROUP_ROLE.MAIN];
    const index = Math.max(0, sweepIndex | 0) % rolePattern.length;
    const offset = rolePattern[index];
    return executionSafePoint({
        x: base.x + offset[0],
        y: base.y + offset[1] * forward
    });
}

function executionGroupReadiness(contract, units, friendlyCentroid) {
    const currentValue = units.reduce((sum, unit) =>
        sum + (STATS[unit.type]?.cost || 0) * Math.max(0, Math.min(1, unit.hpRatio)), 0);
    const initialValue = Math.max(1, contract.initialStrengthValue || currentValue);
    const ammo = units.length
        ? units.reduce((sum, unit) => sum + unit.ammoRatio, 0) / units.length
        : 0;
    const centroid = executionCentroid(units);
    const isolation = centroid && friendlyCentroid
        ? Math.hypot(centroid.x - friendlyCentroid.x, centroid.y - friendlyCentroid.y)
        : 0;
    return {
        strengthRatio: currentValue / initialValue,
        ammoRatio: ammo,
        isolation
    };
}

function executionAbortReason(contract, units, observation) {
    if (!units.length) return 'GROUP_ELIMINATED';
    if (contract.task === TASK_CONTRACT_KIND.WITHDRAW ||
        contract.task === TASK_CONTRACT_KIND.COVER_WITHDRAWAL) return null;
    const friendlyCentroid = executionCentroid(observation?.ownUnits || []);
    const readiness = executionGroupReadiness(contract, units, friendlyCentroid);
    const condition = contract.abortCondition || {};
    if (readiness.strengthRatio < (condition.minStrengthRatio || 0)) return 'STRENGTH_COLLAPSE';
    if (readiness.ammoRatio < (condition.minAmmoRatio || 0)) return 'AMMUNITION_LOW';
    // Köprü/boğaz geçişinde öncü grup doğal olarak ordunun geometrik
    // merkezinden uzaklaşır. Salt mesafe yüzünden sağlıklı bir taarruzu iptal
    // etmek, geçidi bulan bütün birlikleri başlangıç hattına geri gönderiyordu.
    // İzolasyon ancak grup aynı zamanda anlamlı ölçüde yıpranmışsa aborttur.
    if (readiness.isolation > (condition.maxIsolationDistance || Infinity) &&
        readiness.strengthRatio < 0.72) return 'GROUP_ISOLATED';
    return null;
}

class TaskExecutionManager {
    constructor(controller) {
        this.controller = controller;
        this.states = new Map();
        this.transitionHistory = [];
        this.operation = null;
        this.operationHistory = [];
        this.lastFireWindowTick = -Infinity;
        this.lastTelemetry = null;
    }

    coordinatedPlan(operationalPlan) {
        const role = this.controller?.lastSituation?.role;
        return role === BATTLE_ROLE.ATTACKER && [
            BATTLE_PLAN_KIND.FIRE_PREPARATION,
            BATTLE_PLAN_KIND.MAIN_ATTACK,
            BATTLE_PLAN_KIND.FIX_AND_FLANK
        ].includes(operationalPlan?.kind);
    }

    startOperation(operationalPlan, observation, tick) {
        this.operation = {
            planId: operationalPlan.planId,
            planKind: operationalPlan.kind,
            phase: OPERATION_EXECUTION_PHASE.ASSEMBLE,
            phaseStartedTick: tick,
            startedTick: tick,
            enemyValueAtStart: observation.estimatedEnemyValue || 0,
            fireEnemyValue: null,
            preparationOnly: operationalPlan.kind === BATTLE_PLAN_KIND.FIRE_PREPARATION,
            readyRatio: 0,
            transitionReason: 'OPERATION_STARTED'
        };
        this.operationHistory.push({
            tick,
            planId: operationalPlan.planId,
            previous: null,
            current: OPERATION_EXECUTION_PHASE.ASSEMBLE,
            reason: 'OPERATION_STARTED'
        });
        if (this.operationHistory.length > 120) this.operationHistory.shift();
    }

    transitionOperation(phase, tick, reason, observation) {
        if (!this.operation || this.operation.phase === phase) return;
        const previous = this.operation.phase;
        this.operation.phase = phase;
        this.operation.phaseStartedTick = tick;
        this.operation.transitionReason = reason;
        if (phase === OPERATION_EXECUTION_PHASE.FIRE_WINDOW) {
            this.operation.fireEnemyValue = observation.estimatedEnemyValue || 0;
        }
        if (phase === OPERATION_EXECUTION_PHASE.ASSAULT) {
            for (const state of this.states.values()) {
                if (state.phase === TASK_EXECUTION_PHASE.WITHDRAW ||
                    state.phase === TASK_EXECUTION_PHASE.COMPLETE) continue;
                state.phase = TASK_EXECUTION_PHASE.ADVANCE;
                state.waypointIndex = Math.max(1, state.waypointIndex || 0);
                state.lastOrderTick = -Infinity;
                state.lastOrderKind = null;
            }
        }
        this.operationHistory.push({
            tick,
            planId: this.operation.planId,
            previous,
            current: phase,
            reason
        });
        if (this.operationHistory.length > 120) this.operationHistory.shift();
    }

    assemblyReadyRatio(operationalPlan, observation) {
        const contracts = operationalPlan.taskContracts.filter(contract =>
            OPERATION_COMBAT_ROLES.has(contract.groupRole)
        );
        if (!contracts.length) return 1;
        let ready = 0;
        let total = 0;
        for (const contract of contracts) {
            const units = executionUnits(contract, observation);
            const weight = Math.max(1, contract.initialStrengthValue || units.length);
            total += weight;
            if (executionArrived(units, contract.route?.[0], 135)) ready += weight;
        }
        return total > 0 ? ready / total : 1;
    }

    // ── ANGAJMAN KABUL/RET (kullanici doktrini) ──
    // KULLANICI: "AI taarruzu SADECE ustun oldugunu goruyorsa yapmali."
    // OLCULDU (kullanicinin 3 savunma maci): AI hazir savunmaya taarruz etti, oldurmelerinin %78'i
    // KUTLE ICINDE oldu, maclar 27-0 / 26-11 / 26-7 bitti. Hucum karari yerel orana BAKMIYORDU.
    // Ustunluk yoksa ATES PENCERESINDE kalinir — kullanicinin "iki taraf da yumaksa dolayli atislar
    // is yapar" noktasinin karsiligi.
    // HEDEF NOKTASI: `operation` nesnesinde `objective` YOKTUR (ilk surumde uydurulmustu ve kural
    // sessizce hic calismadi — bagli sayac yakaladi). Dogru kaynak PLANIN MAIN sozlesmesidir.
    // ADIL: yalniz algilanan temaslar sayilir (SIM.units taranmaz). Determinist.
    angajmanUygun(operationalPlan, observation) {
        if (typeof battleAngajman !== 'function' ||
            !battleAngajman(this.controller && this.controller.side)) return true;
        const sozlesmeler = (operationalPlan && operationalPlan.taskContracts) || [];
        const ana = sozlesmeler.find(c => c && c.groupRole === TASK_GROUP_ROLE.MAIN) || sozlesmeler[0];
        const hedef = ana && (ana.objective || ana.destination);
        if (!hedef || hedef.x == null) return true;
        let dost = 0, dusman = 0;
        for (const u of (observation.ownUnits || []))
            if (Math.hypot(u.x - hedef.x, u.y - hedef.y) <= ANGAJMAN_R) dost++;
        for (const c of (observation.contacts || []))
            if (c && c.visible && Math.hypot(c.x - hedef.x, c.y - hedef.y) <= ANGAJMAN_R) dusman++;
        if (dusman <= 0) return true;                       // savunan gorunmuyor -> serbest
        const oran = dost / dusman;
        if (typeof BATTLE_ANGAJMAN_SAYAC !== 'undefined') {
            BATTLE_ANGAJMAN_SAYAC.bakilan++;
            if (oran < ANGAJMAN_ESIK) BATTLE_ANGAJMAN_SAYAC.reddedilen++;
        }
        return oran >= ANGAJMAN_ESIK;
    }

    updateOperation(operationalPlan, observation, tick) {
        if (!this.coordinatedPlan(operationalPlan)) {
            this.operation = null;
            return null;
        }
        if (!this.operation || this.operation.planId !== operationalPlan.planId) {
            this.startOperation(operationalPlan, observation, tick);
        }
        const operation = this.operation;
        const phaseAge = tick - operation.phaseStartedTick;
        if (operation.phase === OPERATION_EXECUTION_PHASE.ASSEMBLE) {
            operation.readyRatio = this.assemblyReadyRatio(operationalPlan, observation);
            const ready = operation.readyRatio >= 0.67;
            const timedOut = phaseAge >= OPERATION_ASSEMBLE_TIMEOUT_TICKS;
            if (ready || timedOut) {
                const recentlyPrepared =
                    tick - this.lastFireWindowTick <= OPERATION_FIRE_MAX_TICKS * 2;
                // ASSEMBLE -> ASSAULT KISAYOLU da kapiya baglanir: olculdu ki faz cogunlukla
                // ASSEMBLE'da kaliyor (188 ASSEMBLE / 2 FIRE_WINDOW), yani yalniz FIRE_WINDOW
                // gecisini kapatmak kurali is goremez hale getirirdi.
                if (!operation.preparationOnly && recentlyPrepared &&
                    this.angajmanUygun(operationalPlan, observation)) {
                    this.transitionOperation(
                        OPERATION_EXECUTION_PHASE.ASSAULT,
                        tick,
                        ready ? 'ASSEMBLED_AFTER_PREPARATION' : 'ASSEMBLY_TIMEOUT_AFTER_PREPARATION',
                        observation
                    );
                } else {
                    this.transitionOperation(
                        OPERATION_EXECUTION_PHASE.FIRE_WINDOW,
                        tick,
                        ready ? 'COMBAT_GROUPS_READY' : 'ASSEMBLY_TIMEOUT',
                        observation
                    );
                }
            }
        } else if (operation.phase === OPERATION_EXECUTION_PHASE.FIRE_WINDOW) {
            this.lastFireWindowTick = tick;
            if (!operation.preparationOnly) {
                const baseline = Math.max(1, operation.fireEnemyValue || 0);
                const enemyDamageRatio = Math.max(
                    0,
                    1 - (observation.estimatedEnemyValue || baseline) / baseline
                );
                // ── ANGAJMAN KABUL/RET (kullanıcı doktrini) ──
                // KULLANICI: "AI savunması taarruzu SADECE üstün olduğunu görüyorsa yapmalı."
                // ÖLÇÜLDÜ (kullanıcının 3 savunma maçı, güncel motor): AI hazır savunmaya taarruz etti,
                // öldürmelerinin %78'i KÜTLE İÇİNDE oldu ve maçlar 27-0 / 26-11 / 26-7 bitti.
                // Yani hücum kararı yerel orana BAKMIYORDU — süre dolunca ya da %8 hasar görünce
                // kalkıyordu. Bu kural onu kapıya bağlar: üstünlük yoksa ATEŞ PENCERESİNDE KAL.
                // Bu, kullanıcının ikinci noktasının da karşılığı: "iki taraf da yumaksa dolaylı
                // atışlar iş yapar" — hücum etmeyip dövmeye devam etmek tam olarak budur.
                // ADİL: yalnız algılanan temaslar (observation.contacts) sayılır.
                const _angajmanOK = () => this.angajmanUygun(operationalPlan, observation);
                if (((phaseAge >= OPERATION_FIRE_MIN_TICKS && enemyDamageRatio >= 0.08) ||
                    phaseAge >= OPERATION_FIRE_MAX_TICKS) && _angajmanOK()) {
                    this.transitionOperation(
                        OPERATION_EXECUTION_PHASE.ASSAULT,
                        tick,
                        enemyDamageRatio >= 0.08 ? 'FIRE_EFFECT_ACHIEVED' : 'FIRE_WINDOW_EXPIRED',
                        observation
                    );
                }
            }
        } else if (operation.phase === OPERATION_EXECUTION_PHASE.ASSAULT) {
            const baseline = Math.max(1, operation.enemyValueAtStart || 0);
            const enemyLossRatio = Math.max(
                0,
                1 - (observation.estimatedEnemyValue || baseline) / baseline
            );
            const urgent = (this.controller?.lastSituation?.timePressure || 0) >= 0.9;
            if (enemyLossRatio >= 0.3 || urgent ||
                phaseAge >= OPERATION_ASSAULT_TO_EXPLOIT_TICKS) {
                this.transitionOperation(
                    OPERATION_EXECUTION_PHASE.EXPLOIT,
                    tick,
                    enemyLossRatio >= 0.3 ? 'ENEMY_COHESION_BROKEN' :
                        urgent ? 'MISSION_TIME_CRITICAL' : 'ASSAULT_MOMENTUM',
                    observation
                );
            }
        }
        return this.operation;
    }

    coordinatedContractOrder(contract, operationalPlan, observation, tick) {
        const state = this.stateFor(contract, tick);
        const units = executionUnits(contract, observation);
        if (!units.length) {
            this.transition(state, TASK_EXECUTION_PHASE.COMPLETE, tick, 'GROUP_ELIMINATED');
            return null;
        }
        const phase = this.operation?.phase;
        if (phase === OPERATION_EXECUTION_PHASE.ASSEMBLE) {
            if (OPERATION_COMBAT_ROLES.has(contract.groupRole) ||
                contract.groupRole === TASK_GROUP_ROLE.RECON) {
                const engagementFactor = OPERATION_COMBAT_ROLES.has(contract.groupRole)
                    ? 1.45
                    : 1.08;
                const threat = executionSelfDefenseTarget(
                    contract,
                    units,
                    observation,
                    { engagementFactor, focusTargetId: this.focusForContract(contract) }
                );
                if (threat && (state.lastTargetId !== threat.id ||
                    this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                    const order = executionSelfDefenseAttackOrder(
                        contract,
                        units,
                        threat,
                        { engagementFactor }
                    );
                    if (order) return this.markOrder(state, order, tick);
                }
            }
            const point = contract.groupRole === TASK_GROUP_ROLE.FIRE_SUPPORT
                ? contract.destination
                : contract.route?.[0];
            if (!point) return null;
            if (executionArrived(units, point, 115)) {
                if (state.lastOrderKind === BATTLE_ORDER_KIND.HOLD) return null;
                return this.markOrder(
                    state,
                    executionHoldOrder(contract, units, `TASK:${contract.id}:ASSEMBLED`),
                    tick
                );
            }
            if (!this.shouldRefresh(state, tick)) return null;
            return this.markOrder(
                state,
                executionMoveOrder(contract, units, point, `TASK:${contract.id}:OPERATION_ASSEMBLE`),
                tick
            );
        }
        if (phase === OPERATION_EXECUTION_PHASE.FIRE_WINDOW) {
            if (contract.groupRole === TASK_GROUP_ROLE.FIRE_SUPPORT) {
                const target = executionVisibleTarget(contract, units, observation);
                if (target && (state.lastTargetId !== target.id ||
                    this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                    return this.markOrder(state, executionAttackOrder(contract, units, target), tick);
                }
                if (!executionArrived(units, contract.destination, 115) &&
                    this.shouldRefresh(state, tick)) {
                    return this.markOrder(
                        state,
                        executionMoveOrder(
                            contract,
                            units,
                            contract.destination,
                            `TASK:${contract.id}:FIRE_POSITION`
                        ),
                        tick
                    );
                }
                return null;
            }
            if (contract.groupRole === TASK_GROUP_ROLE.RECON) {
                // ═══ GÖZLEM GÖREVİ, KENDİNİ-SAVUNMADAN ÖNCE GELİR (2026-08-08, ölçümle) ═══
                // ESKİ SIRA: önce kendini-savunma bakılıyor ve tehdit varsa `return` ile çıkılıyordu →
                // gözlem noktasına gitme emri HİÇ üretilmiyordu. Keşif kendi kütlesinin yanında durduğu
                // için tehdit sürekli menzildeydi, yani birim kalıcı olarak "savunma" kipinde kalıp
                // ASLA keşfe çıkmıyordu.
                // ÖLÇÜLDÜ (kullanıcının 6 maçı, 6 grup kıyaslandı): RECON emir oranı %9.6 — boşta beklemesi
                // gereken RESERVE ile aynı, tüm aktif rollerin en altı. Aldığı emirlerin %50'si ATTACK.
                // Bedeli: AI keşif birimlerinin %90'ı ölüyor (insanınki %50), recon_uav 9 birim 0 HASAR
                // veriyor (silahı yok — ona ATTACK emri vermek tamamen israf), ve AI kararlarının %35'i
                // sıfır görünür kontakla alınıyor.
                // YENİ SIRA: gözlem noktasına varılmadıysa HAREKET öncelikli; savunma ateşi yalnız birim
                // yerine ulaştıktan sonra. Keşfin işi görüş kurmak, dövüşmek değil.
                const hasVisibleContact = (observation.contacts || [])
                    .some(contact => contact.visible);
                const observationPoint = hasVisibleContact
                    ? contract.route?.[0]
                    : contract.destination;
                const yerinde = !observationPoint || executionArrived(units, observationPoint, 115);
                if (!yerinde && this.shouldRefresh(state, tick)) {
                    return this.markOrder(
                        state,
                        executionMoveOrder(
                            contract,
                            units,
                            observationPoint,
                            `TASK:${contract.id}:OBSERVATION_POSITION`
                        ),
                        tick
                    );
                }
                if (yerinde) {
                    const threat = executionSelfDefenseTarget(contract, units, observation);
                    if (threat && (state.lastTargetId !== threat.id ||
                        this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                        const order = executionSelfDefenseAttackOrder(contract, units, threat);
                        if (order) return this.markOrder(state, order, tick);
                    }
                }
                return null;
            }
            if (contract.groupRole === TASK_GROUP_ROLE.SUPPORT) {
                // ═══ DESTEK: İHTİYACI OLANIN YANINA GİT (2026-08-08, ölçümle) ═══
                // KAPSAMA MATRİSİ (tools/kapsama-matrisi.js) SUPPORT rolünün yürütmede HİÇ özel dalı
                // olmadığını gösterdi (planlamada 10 referans, yürütmede 0) → destek grubu buradaki
                // dalların hiçbirine girmeyip en sondaki HOLD'a düşüyor, yani sabit bir noktada oturuyordu.
                // ÖLÇÜLDÜ (kullanıcının 2 canlı maçı): mühimmatı %50'nin altına düşen birimlerin
                // İKMAL ALANINDA olma oranı **%0** (AI n=24, insan n=26); yaralıların sağlık alanında
                // olma oranı AI %3. Yarıçaplar küçük (sıhhiye/istihkam 200px, ikmal 300px), ordu ise
                // 625px derinliğe yayılıyor → destek ordunun İÇİNDE ama ihtiyacı olanın YANINDA değil.
                // KURAL: ihtiyaç sahiplerinin (mühimmat<%50 veya can<%60) ağırlık merkezine git.
                // İhtiyaç yoksa sözleşme hedefine dön. Deterministik (RNG yok, snapshot okur).
                const own = observation?.ownUnits || [];
                const kendiId = new Set(units.map(u => u.id));
                const muhtac = own.filter(u => !kendiId.has(u.id) &&
                    (((u.ammoRatio !== undefined) && u.ammoRatio < 0.5) ||
                     ((u.hpRatio !== undefined) && u.hpRatio < 0.6)));
                let hedef = contract.destination;
                if (muhtac.length) {
                    // AĞIRLIK MERKEZİ DEĞİL, EN ÇOK İŞE YARAYAN NOKTA (2026-08-08).
                    // İlk sürüm ihtiyaç sahiplerinin merkezine gidiyordu; merkez iki ayrı kümenin
                    // ORTASINDAKİ BOŞLUĞA düşebiliyor ve aura (200-300px) kimseye değmiyor.
                    // KULLANICI KARARI: aura yarıçapları AYNI KALSIN ("ben iyi kullanıyorsam AI da
                    // kullanabilir") → çare yarıçapı büyütmek değil, DOĞRU NOKTAYA park etmek.
                    // Kural: adaylar = ihtiyaç sahiplerinin konumları; kendi aura yarıçapı içinde
                    // EN ÇOK ihtiyaç sahibini kapsayanı seç. Deterministik (eşitlikte en küçük id).
                    let R = 0;
                    for (const u of units) {
                        const st = (typeof STATS !== 'undefined') ? STATS[u.type] : null;
                        const a = st && st.aura;
                        const r = a ? (a.radius || a.range || 0) * 100 : 0;
                        if (r > R) R = r;
                    }
                    if (!(R > 0)) R = 250;
                    let enIyi = null, enSkor = -1;
                    for (const aday of muhtac) {
                        let skor = 0;
                        for (const v of muhtac) if (Math.hypot(v.x - aday.x, v.y - aday.y) <= R) skor++;
                        if (skor > enSkor || (skor === enSkor && enIyi && aday.id < enIyi.id)) { enSkor = skor; enIyi = aday; }
                    }
                    if (enIyi) hedef = { x: enIyi.x, y: enIyi.y };
                }
                if (hedef && !executionArrived(units, hedef, 115) && this.shouldRefresh(state, tick)) {
                    return this.markOrder(
                        state,
                        executionMoveOrder(contract, units, hedef,
                            `TASK:${contract.id}:SUPPORT_TO_NEED`),
                        tick
                    );
                }
                return null;
            }
            if (OPERATION_COMBAT_ROLES.has(contract.groupRole)) {
                const threat = executionSelfDefenseTarget(
                    contract,
                    units,
                    observation,
                    { engagementFactor: 1.45, focusTargetId: this.focusForContract(contract) }
                );
                if (threat && (state.lastTargetId !== threat.id ||
                    this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                    const order = executionSelfDefenseAttackOrder(
                        contract,
                        units,
                        threat,
                        { engagementFactor: 1.45 }
                    );
                    if (order) return this.markOrder(state, order, tick);
                }
            }
            if (state.lastOrderKind === BATTLE_ORDER_KIND.HOLD) return null;
            return this.markOrder(
                state,
                executionHoldOrder(contract, units, `TASK:${contract.id}:FIRE_WINDOW_HOLD`),
                tick
            );
        }

        let activeContract = contract;
        const reserveActivated = contract.groupRole === TASK_GROUP_ROLE.RESERVE &&
            (phase === OPERATION_EXECUTION_PHASE.EXPLOIT ||
             (this.controller?.lastSituation?.timePressure || 0) >= 0.72);
        if (reserveActivated) {
            activeContract = {
                ...contract,
                task: TASK_CONTRACT_KIND.SEIZE_OBJECTIVE,
                engagementRule: 'ENGAGE_CONFIRMED_CONTACT',
                formation: 'WEDGE',
                route: [
                    contract.route?.[1] || contract.phaseLine,
                    executionSafePoint(contract.objective)
                ].filter(Boolean)
            };
        }
        if (phase === OPERATION_EXECUTION_PHASE.EXPLOIT &&
            [
                TASK_GROUP_ROLE.MAIN,
                TASK_GROUP_ROLE.FIXING,
                TASK_GROUP_ROLE.FLANK,
                TASK_GROUP_ROLE.RECON,
                TASK_GROUP_ROLE.RESERVE
            ].includes(contract.groupRole) &&
            !(observation.contacts || []).some(contact => contact.visible)) {
            let searchPoint = executionExploitSearchPoint(
                activeContract,
                this.controller.side,
                state.exploitSweepIndex
            );
            if (executionArrived(units, searchPoint, 130)) {
                state.exploitSweepIndex = (state.exploitSweepIndex || 0) + 1;
                state.lastOrderTick = -Infinity;
                searchPoint = executionExploitSearchPoint(
                    activeContract,
                    this.controller.side,
                    state.exploitSweepIndex
                );
            }
            if (this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS)) {
                return this.markOrder(
                    state,
                    executionMoveOrder(
                        activeContract,
                        units,
                        searchPoint,
                        `TASK:${contract.id}:EXPLOIT_SECTOR_SWEEP`
                    ),
                    tick
                );
            }
            return null;
        }
        return this.decideContract(activeContract, observation, tick);
    }

    stateFor(contract, tick) {
        let state = this.states.get(contract.id);
        if (!state) {
            state = {
                contractId: contract.id,
                phase: TASK_EXECUTION_PHASE.ASSEMBLE,
                waypointIndex: 0,
                lastOrderTick: -Infinity,
                lastOrderKind: null,
                lastTargetId: null,
                exploitSweepIndex: 0,
                abortReason: null,
                createdAtTick: tick
            };
            this.states.set(contract.id, state);
            this.recordTransition(state, null, TASK_EXECUTION_PHASE.ASSEMBLE, tick, 'CONTRACT_STARTED');
        }
        return state;
    }

    recordTransition(state, previous, current, tick, reason) {
        this.transitionHistory.push({
            tick,
            contractId: state.contractId,
            previous,
            current,
            reason
        });
        if (this.transitionHistory.length > 300) this.transitionHistory.shift();
    }

    transition(state, phase, tick, reason) {
        if (state.phase === phase) return;
        const previous = state.phase;
        state.phase = phase;
        this.recordTransition(state, previous, phase, tick, reason);
    }

    shouldRefresh(state, tick, interval = TASK_ORDER_REFRESH_TICKS) {
        return tick - state.lastOrderTick >= interval;
    }

    markOrder(state, order, tick) {
        state.lastOrderTick = tick;
        state.lastOrderKind = order.kind;
        state.lastTargetId = order.targetId ?? null;
        return order;
    }

    decideContract(contract, observation, tick) {
        const state = this.stateFor(contract, tick);
        const units = executionUnits(contract, observation);
        if (!units.length) {
            this.transition(state, TASK_EXECUTION_PHASE.COMPLETE, tick, 'GROUP_ELIMINATED');
            return null;
        }

        const abortReason = executionAbortReason(contract, units, observation);
        if (abortReason && state.phase !== TASK_EXECUTION_PHASE.WITHDRAW &&
            state.phase !== TASK_EXECUTION_PHASE.COMPLETE) {
            state.abortReason = abortReason;
            this.transition(state, TASK_EXECUTION_PHASE.WITHDRAW, tick, abortReason);
            state.lastOrderTick = -Infinity;
        }

        if (state.phase === TASK_EXECUTION_PHASE.WITHDRAW) {
            if (executionArrived(units, contract.fallbackPosition)) {
                this.transition(state, TASK_EXECUTION_PHASE.HOLD, tick, 'FALLBACK_REACHED');
                const order = executionHoldOrder(contract, units, `TASK:${contract.id}:FALLBACK`);
                return this.markOrder(state, order, tick);
            }
            if (!this.shouldRefresh(state, tick)) return null;
            return this.markOrder(
                state,
                executionMoveOrder(
                    contract,
                    units,
                    contract.fallbackPosition,
                    `TASK:${contract.id}:ABORT:${state.abortReason}`
                ),
                tick
            );
        }

        if (state.phase === TASK_EXECUTION_PHASE.ASSEMBLE ||
            state.phase === TASK_EXECUTION_PHASE.ADVANCE) {
            const route = contract.route || [];
            let waypoint = route[Math.min(state.waypointIndex, Math.max(0, route.length - 1))];
            if (!waypoint) {
                this.transition(state, TASK_EXECUTION_PHASE.ACTION, tick, 'NO_ROUTE');
            } else if (executionArrived(units, waypoint)) {
                state.waypointIndex += 1;
                if (state.waypointIndex >= route.length) {
                    this.transition(state, TASK_EXECUTION_PHASE.ACTION, tick, 'DESTINATION_REACHED');
                } else {
                    this.transition(state, TASK_EXECUTION_PHASE.ADVANCE, tick, 'PHASE_LINE_REACHED');
                    waypoint = route[state.waypointIndex];
                }
            }
            if (state.phase === TASK_EXECUTION_PHASE.ASSEMBLE ||
                state.phase === TASK_EXECUTION_PHASE.ADVANCE) {
                const threat = contract.engagementRule === 'HOLD_FIRE'
                    ? null
                    : executionSelfDefenseTarget(contract, units, observation);
                if (threat && (state.lastTargetId !== threat.id ||
                    this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                    const order = executionSelfDefenseAttackOrder(contract, units, threat);
                    if (order) return this.markOrder(state, order, tick);
                }
                if (!this.shouldRefresh(state, tick)) return null;
                return this.markOrder(
                    state,
                    executionMoveOrder(
                        contract,
                        units,
                        waypoint,
                        `TASK:${contract.id}:${state.phase}:WP${state.waypointIndex}`
                    ),
                    tick
                );
            }
        }

        if (state.phase === TASK_EXECUTION_PHASE.ACTION) {
            const selfDefenseOnly = [
                'SELF_DEFENSE',
                'SELF_DEFENSE_AND_REPORT'
            ].includes(contract.engagementRule);
            const canAttack = contract.engagementRule !== 'HOLD_FIRE';
            const target = !canAttack ? null :
                selfDefenseOnly
                    ? executionSelfDefenseTarget(contract, units, observation, { focusTargetId: this.focusForContract(contract) })
                    : executionVisibleTarget(contract, units, observation, { focusTargetId: this.focusForContract(contract) });
            if (target && (state.lastTargetId !== target.id ||
                this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                const order = selfDefenseOnly
                    ? executionSelfDefenseAttackOrder(contract, units, target)
                    : executionAttackOrder(contract, units, target);
                if (order) return this.markOrder(state, order, tick);
            }
            // INTEL4 (flag-kapılı) ANTI-BLOB: SAVUNAN grubu TEMAS-ALTINDA yumaklandıysa (odak-ateş tek-noktaya yığıyor) periyodik
            // olarak dispersed sektör-hedefine geri YAY. MOVE attackTarget'ı siler ama menzile-giren düşmana self-defense-ateşi sürer
            // (ateş-gücü korunur). Throttle+yumak-şartı → sürekli-iptal değil, pulse (aç → sektör-içi odak yeniden kurulur).
            const _defRespread = this.controller && typeof battleDelta === 'function' && battleDelta(this.controller.side, 'deblob') &&
                this.controller.lastSituation && this.controller.lastSituation.role === BATTLE_ROLE.DEFENDER &&
                typeof battleSectorCommand === 'function' && battleSectorCommand(this.controller && this.controller.side) &&
                contract.destination && executionGroupDispersion(units) < DEFENSE_RESPREAD_RADIUS &&
                !executionArrived(units, contract.destination, 150) &&
                (tick - (state._lastRespreadTick || 0)) >= DEFENSE_RESPREAD_TICKS;
            if (_defRespread) {
                state._lastRespreadTick = tick;
                return this.markOrder(state, executionMoveOrder(contract, units, contract.destination, `TASK:${contract.id}:DEFENSE_RESPREAD`), tick);
            }
            if (!target && state.lastOrderKind !== BATTLE_ORDER_KIND.HOLD) {
                this.transition(state, TASK_EXECUTION_PHASE.HOLD, tick, 'NO_VISIBLE_TARGET');
                return this.markOrder(
                    state,
                    executionHoldOrder(contract, units, `TASK:${contract.id}:NO_VISIBLE_TARGET`),
                    tick
                );
            }
        }
        if (state.phase === TASK_EXECUTION_PHASE.HOLD) {
            const selfDefenseOnly = [
                'SELF_DEFENSE',
                'SELF_DEFENSE_AND_REPORT'
            ].includes(contract.engagementRule);
            const canAttack = contract.engagementRule !== 'HOLD_FIRE';
            const target = !canAttack ? null :
                selfDefenseOnly
                    ? executionSelfDefenseTarget(contract, units, observation, { focusTargetId: this.focusForContract(contract) })
                    : executionVisibleTarget(contract, units, observation, { focusTargetId: this.focusForContract(contract) });
            if (target) {
                this.transition(state, TASK_EXECUTION_PHASE.ACTION, tick, 'VISIBLE_TARGET_ACQUIRED');
                const order = selfDefenseOnly
                    ? executionSelfDefenseAttackOrder(contract, units, target)
                    : executionAttackOrder(contract, units, target);
                if (order) return this.markOrder(state, order, tick);
            }
            const mustSearch = [
                BATTLE_PLAN_KIND.SEARCH,
                BATTLE_PLAN_KIND.ADVANCE
            ].includes(contract.planKind) || (
                this.controller?.lastSituation?.role === BATTLE_ROLE.ATTACKER &&
                contract.task === TASK_CONTRACT_KIND.SEIZE_OBJECTIVE
            );
            const searchCapable = [
                TASK_GROUP_ROLE.MAIN,
                TASK_GROUP_ROLE.FIXING,
                TASK_GROUP_ROLE.FLANK,
                TASK_GROUP_ROLE.RECON
            ].includes(contract.groupRole);
            if (!target && mustSearch && searchCapable &&
                this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS)) {
                let searchPoint = executionExploitSearchPoint(
                    contract,
                    this.controller.side,
                    state.exploitSweepIndex
                );
                if (executionArrived(units, searchPoint, 130)) {
                    state.exploitSweepIndex = (state.exploitSweepIndex || 0) + 1;
                    searchPoint = executionExploitSearchPoint(
                        contract,
                        this.controller.side,
                        state.exploitSweepIndex
                    );
                }
                return this.markOrder(
                    state,
                    executionMoveOrder(
                        contract,
                        units,
                        searchPoint,
                        `TASK:${contract.id}:CONTACT_SEARCH`
                    ),
                    tick
                );
            }
            // ANALİST-FIX (savunan-yayılma icra): mustSearch değil ama SAVUNAN grubu sektör-savunma-pozisyonuna VARMADIYSA
            // oraya YAY (yumak→geniş hat; ÇNRA/havan alan-ateşi mezarı çözülür). Varınca durur → dig_in oto-siperlenir.
            if (!target && searchCapable && contract.destination &&
                this.controller?.lastSituation?.role === BATTLE_ROLE.DEFENDER &&
                !executionArrived(units, contract.destination, 150) &&
                this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS)) {
                return this.markOrder(
                    state,
                    executionMoveOrder(contract, units, contract.destination, `TASK:${contract.id}:DEFENSE_SPREAD`),
                    tick
                );
            }
        }
        return null;
    }

    // ══ AKIN — "tek başına gezeni gafil avlamak" (kullanıcı doktrini, ölçümle doğrulandı) ══
    // KULLANICI: "hızlı hareket edip tek başına gezen birliği gafil avlamak; önce hedef seç,
    // doğru anı bekle, kısa bir taarruzla indir, geri çekil veya devam et."
    // ÖLÇÜLDÜ (tools/gafil-avlama-teshis.js, 291 ölüm): AI ölümlerinin %52'si KÜTLE-KÜTLEYE
    // (kurbanın ≥4 dostu var), gafil avlama yalnız %14. Oyuncunun temas anında 1.2 düşman görmesi
    // yayıldığı için değil YALNIZ KALANI seçtiği için (dost sayısı benzer: 8.9 vs 6.9).
    // NEDEN YIĞILMA DEĞİL: geçmişte "aktif toplanma" denendi ve oran SABİT kaldı — ana kütleye
    // yığınca düşmanın ana kütlesiyle karşılaşıyorsun. Bu yüzden müdahale HEDEF SEÇİMİDİR.
    // ADİL: yalnızca `observation.contacts` (algılanan) kullanılır, SIM.units taranmaz.
    // DETERMİNİST: tüm sıralamalar id ile bozulur, RNG yok.
    akinKarari(observation, tick) {
        if (typeof battleAkin !== 'function' || !battleAkin(this.controller && this.controller.side)) return null;
        // DIKKAT (yasandi): `observation.ownUnits` SNAPSHOT'tir — yalniz id/type/x/y/hpRatio/ammoRatio
        // tasir. `u.speed` YOKTUR; ona bakan filtre listeyi bosaltir ve akin SESSIZCE hic calismaz.
        // Hiz STATS'ten okunur.
        const _hiz = (u) => ((typeof STATS !== 'undefined' && STATS[u.type]) ? (STATS[u.type].speed || 0) : 0);
        const kendi = (observation.ownUnits || []).filter(u => _hiz(u) > 0);
        const temas = (observation.contacts || []).filter(c => c && c.visible);
        if (kendi.length < AKIN_ASGARI_AKINCI + 2 || !temas.length) { this.akin = null; return null; }

        // 1) HEDEF SEÇ — İZOLE düşman: R içinde en fazla AKIN_IZOLE_DOST kadar kendi dostu olan
        const izole = temas.filter(c => {
            let dost = 0;
            for (const o of temas) {
                if (o === c) continue;
                if (Math.hypot(o.x - c.x, o.y - c.y) <= AKIN_R) dost++;
            }
            return dost <= AKIN_IZOLE_DOST;
        });

        // mevcut akın hedefi hâlâ geçerli mi (histerezis: her tik hedef değiştirme)
        let hedef = null;
        if (this.akin && this.akin.hedefId != null) {
            hedef = izole.find(c => c.id === this.akin.hedefId) || null;
            if (!hedef) this.akin = null;   // hedef öldü / görünmez oldu / artık yalnız değil → AKIN BİTTİ
        }
        if (!hedef) {
            if (!izole.length) { this.akin = null; return null; }
            const merkez = executionCentroid(kendi);
            let enYakin = null, ed = Infinity;
            for (const c of izole) {
                const d = merkez ? Math.hypot(c.x - merkez.x, c.y - merkez.y) : 0;
                if (d > AKIN_AZAMI_MESAFE) continue;
                if (d < ed || (d === ed && enYakin && c.id < enYakin.id)) { ed = d; enYakin = c; }
            }
            if (!enYakin) { this.akin = null; return null; }
            hedef = enYakin;
            this.akin = { hedefId: hedef.id, faz: 'TOPLANMA', baslangic: tick, akinci: [] };
        }

        // 2) AKINCI SEÇ — EN HIZLI birimler (kullanıcı: "hızlı hareket etmem"); kütleyi bozmamak için
        // sınırlı sayı. Determinist: hız büyükten küçüğe, eşitlikte id.
        const adaylar = kendi.slice()
            .sort((a, b) => (_hiz(b) - _hiz(a)) || (a.id - b.id))
            .filter(u => Math.hypot(u.x - hedef.x, u.y - hedef.y) <= AKIN_AZAMI_MESAFE);
        const akinci = adaylar.slice(0, AKIN_AZAMI_AKINCI);
        if (akinci.length < AKIN_ASGARI_AKINCI) { this.akin = null; return null; }
        this.akin.akinci = akinci.map(u => u.id);

        // 3) ANI BEKLE — yeterli akıncı VURUŞ mesafesine girene dek TAARRUZ başlamaz.
        const hazir = akinci.filter(u => Math.hypot(u.x - hedef.x, u.y - hedef.y) <= AKIN_VURUS_MESAFE).length;
        if (this.akin.faz === 'TOPLANMA' && hazir >= AKIN_ASGARI_AKINCI) this.akin.faz = 'TAARRUZ';

        // 4) ÇEKİL — düşman desteği geldiyse (hedef artık yalnız değil) akın biter; üstteki `izole`
        // kontrolü bunu zaten yakalar. Süre sınırı: takılıp kalmasın.
        if (tick - this.akin.baslangic > AKIN_AZAMI_TIK) { this.akin = null; return null; }

        // BAGLANMA SAYACI (tuzak B2): kural sessizce hic calismasin diye her akin emri sayilir.
        if (typeof BATTLE_AKIN_SAYAC !== 'undefined') {
            BATTLE_AKIN_SAYAC.emir++;
            if (this.akin.faz === 'TAARRUZ') BATTLE_AKIN_SAYAC.taarruz++;
        }
        const sozde = { id: 'AKIN', groupRole: 'AKIN', formation: 'WEDGE' };
        if (this.akin.faz === 'TAARRUZ') {
            return executionAttackOrder(sozde, akinci, hedef);
        }
        // TOPLANMA: hedefe yaklaş ama üstüne binme (vuruş mesafesinin hemen dışında topla)
        const dx = hedef.x - (executionCentroid(akinci) || hedef).x;
        const dy = hedef.y - (executionCentroid(akinci) || hedef).y;
        const d = Math.hypot(dx, dy) || 1;
        const nokta = executionSafePoint({
            x: hedef.x - (dx / d) * AKIN_VURUS_MESAFE * 0.8,
            y: hedef.y - (dy / d) * AKIN_VURUS_MESAFE * 0.8
        });
        return executionMoveOrder(sozde, akinci, nokta, 'AKIN:TOPLANMA');
    }

    decide(operationalPlan, observation, tick = SIM.tick) {
        if (!operationalPlan?.taskContracts?.length || !observation) return null;
        // KÜTLE-İÇİ ANTİ DİZİLİM bağlamı: emir üretimi boyunca algı temasları erişilebilir olsun.
        // Yalnız `observation.contacts` (algı katmanı) — SIM taranmaz, sis dürüstlüğü korunur.
        _execAntiCtx = { contacts: observation.contacts || [], side: this.controller && this.controller.side };
        try {
        return this._decide(operationalPlan, observation, tick);
        } finally { _execAntiCtx = null; }
    }

    _decide(operationalPlan, observation, tick = SIM.tick) {
        const activeIds = new Set(operationalPlan.taskContracts.map(contract => contract.id));
        for (const id of this.states.keys()) {
            if (!activeIds.has(id)) this.states.delete(id);
        }
        const operation = this.updateOperation(operationalPlan, observation, tick);
        this.focusContactId = this.updateFocusContact(observation);   // ORTAK FOCUS: tüm muharip gruplar aynı hedefe
        const orders = operationalPlan.taskContracts
            .slice()
            .sort((a, b) => a.groupRole.localeCompare(b.groupRole))
            .map(contract => operation
                ? this.coordinatedContractOrder(
                    contract,
                    operationalPlan,
                    observation,
                    tick
                )
                : this.decideContract(contract, observation, tick))
            .filter(Boolean);
        // AKIN emri EN SONA eklenir: aynı birim hem grup emri hem akın emri alırsa akın KAZANIR
        // (emirler sırayla uygulanır). Akıncılar zaten sınırlı sayıda ve hızlı birimlerdir; ana
        // kütlenin emri bozulmaz. Bayrak kapalıyken bu satır hiçbir şey yapmaz.
        const _akin = this.akinKarari(observation, tick);
        if (_akin) orders.push(_akin);
        this.lastTelemetry = {
            tick,
            planId: operationalPlan.planId,
            operation: operation ? replayClone(operation) : null,
            states: [...this.states.values()].map(replayClone)
                .sort((a, b) => a.contractId.localeCompare(b.contractId)),
            orderCount: orders.length
        };
        return orders.length ? {
            kind: 'TASK_EXECUTION',
            planId: operationalPlan.planId,
            orders,
            telemetry: replayClone(this.lastTelemetry)
        } : null;
    }

    // ORTAK FOCUS-FIRE hedefi: tüm muharip gruplar aynı önceliği döver → konsantre yıkım.
    // Sadece PERCEPTION (görünür contacts) — adil, sis-savaşına saygılı. Histerezis: mevcut focus görünür+canlı ise
    // koru (odak savrulmasını önle); ölünce/kaybolunca hepsi AYNI ANDA yeni önceliğe döner. Öncelik: kendi kütle-
    // merkezine EN YAKIN (ulaşılabilir) görünür düşman + yaralıya bonus (bitirici darbe).
    // SEKTÖR-KOMUTA: grup kendi sektörünün odağını kullanır (mainSector'daki KÜTLE aynı düşmana odaklanır = kazanan
    // konsantrasyon sektör-İÇİNDE korunur; FLANK kendi sektörüne). Sektör-off veya sektör yoksa global focus'a düşer.
    focusForContract(contract) {
        if (typeof battleSectorCommand === 'function' && battleSectorCommand(this.controller && this.controller.side) && contract && contract.sector && this.focusBySector) {
            const f = this.focusBySector[contract.sector];
            if (f != null) return f;
            // INTEL4 (flag-kapılı) ANTI-BLOB: SAVUNAN boş-sektör grubu GLOBAL focus'a düşmesin (birden çok grup tek-contact'a
            // piling = tam-blob). null → grup kendi en-yakın-menzildeki contact'ını seçer (sektör-içi kazanan-odak korunur).
            const ctrl = this.controller;
            const DEF = (typeof BATTLE_ROLE !== 'undefined') ? BATTLE_ROLE.DEFENDER : 'defender';
            if (ctrl && typeof battleDelta === 'function' && battleDelta(ctrl.side, 'deblob') &&
                ctrl.lastSituation && ctrl.lastSituation.role === DEF) return null;
        }
        return this.focusContactId;
    }
    updateFocusContact(observation) {
        const visible = (observation.contacts || []).filter(c => c.visible);
        // SEKTÖR-KOMUTA: sektör-başına odak (contact'ın x-band'ına göre). Her sektörde en iyi hedef (scoreTarget / en-yakın).
        if (typeof battleSectorCommand === 'function' && battleSectorCommand(this.controller && this.controller.side)) {
            const own0 = observation.ownUnits || [];
            const bb0 = this.controller && this.controller.blackboard;
            const tw0 = (this.controller && this.controller.profile) ? this.controller.profile.targetingWeights : null;
            const byS = { left: null, center: null, right: null };
            const scoreS = { left: -Infinity, center: -Infinity, right: -Infinity };
            const prevByS = this.focusBySector || null;   // INTEL4 'micro': önceki-eval sektör-odağı (histerezis için)
            const prevScore = { left: -Infinity, center: -Infinity, right: -Infinity };
            for (const c of visible) {
                const sec = (typeof situationSectorForX === 'function') ? situationSectorForX(c.x) : 'center';
                const s = (typeof scoreTarget === 'function') ? scoreTarget(c, own0, bb0, tw0) : -Math.hypot(c.x, c.y);
                if (s > scoreS[sec] || (s === scoreS[sec] && byS[sec] != null && c.id < byS[sec])) { scoreS[sec] = s; byS[sec] = c.id; }
                if (prevByS && c.id === prevByS[sec]) prevScore[sec] = s;   // önceki-odağın GÜNCEL skoru (hâlâ görünür mü)
            }
            // INTEL4-delta 'micro' HEDEF-HİSTEREZİSİ (analist #3): sektör-odağı her eval'de sıfırlanıp hedef-savruluyordu (savunan
            // şok-karşı-taarruzunda %85 hedef-değişimi). Önceki-odak hâlâ görünür VE yeni-en-iyi onu MARJİN kadar geçmiyorsa KORU.
            if (typeof battleDelta === 'function' && this.controller && battleDelta(this.controller.side, 'micro')) {
                for (const sec of ['left', 'center', 'right']) {
                    if (prevByS && prevByS[sec] != null && Number.isFinite(prevScore[sec]) &&
                        scoreS[sec] < prevScore[sec] + FOCUS_HYST_MARGIN) byS[sec] = prevByS[sec];   // eski-odağı koru
                }
            }
            this.focusBySector = byS;
        } else {
            this.focusBySector = null;
        }
        if (!visible.length) return null;
        if (this.focusContactId != null && visible.some(c => c.id === this.focusContactId)) return this.focusContactId;   // histerezis: mevcut odak görünürse koru
        const own = observation.ownUnits || [];
        // FAZ 4: tam hedef-skorlama (TTK + sınıf + yaralı + menzildeki-dost + korunma). Yüksek=iyi. Bayrakla A/B.
        if ((typeof BATTLE_TARGET_SCORING === 'undefined' || BATTLE_TARGET_SCORING) && typeof scoreTarget === 'function') {
            const bb = this.controller && this.controller.blackboard;
            const tw = (this.controller && this.controller.profile) ? this.controller.profile.targetingWeights : null;   // FAZ 7: profil ağırlıkları
            let best = null, bestScore = -Infinity;
            for (const c of visible) { const s = scoreTarget(c, own, bb, tw); if (s > bestScore || (s === bestScore && best && c.id < best.id)) { bestScore = s; best = c; } }
            return best ? best.id : null;
        }
        // Eski (en-yakın öz-merkeze + yaralı bonusu):
        let cx = 0, cy = 0;
        for (const u of own) { cx += u.x; cy += u.y; }
        if (own.length) { cx /= own.length; cy /= own.length; }
        let best = null, bestScore = Infinity;
        for (const c of visible) {
            const d = Math.hypot(c.x - cx, c.y - cy);
            const woundedBonus = c.healthBand === 'CRITICAL' ? 260 : c.healthBand === 'DAMAGED' ? 130 : 0;
            const score = d - woundedBonus;
            if (score < bestScore) { bestScore = score; best = c; }
        }
        return best ? best.id : null;
    }
}
