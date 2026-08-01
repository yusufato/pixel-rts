// Savaş algısı ve temas hafızası.
// Controller yalnız sahip olduğu birliklerin gerçekten görebildiği düşmanları bilir.

const CONTACT_MEMORY_TTL_TICKS = Math.round(30 / BATTLE_TICK_SEC);

function perceptionHealthBand(unit) {
    const ratio = unit.hp / Math.max(1, unit.maxHp);
    if (ratio > 0.66) return 'HEALTHY';
    if (ratio > 0.33) return 'DAMAGED';
    return 'CRITICAL';
}

function perceptionObserverCanSee(observer, target) {
    if (!observer || !target || observer.dead || target.dead || observer.isRed === target.isRed) return false;
    const dx = target.x - observer.x;
    const dy = target.y - observer.y;
    const distance = Math.hypot(dx, dy);
    const elevationBonus = 1 + Math.max(0, (observer.elevation || 0.5) - 0.45) * 0.55;
    if (distance > observer.vision * elevationBonus) return false;

    if (target.isConcealed && target.isConcealed()) {
        const detection = observer.type === T.RECON ? AMBUSH_DETECT * 2 : AMBUSH_DETECT;
        if (distance > detection) return false;
    }
    if (typeof checkLineOfSight === 'function' &&
        !checkLineOfSight(observer.x, observer.y, target.x, target.y, observer, target)) {
        return false;
    }
    return true;
}

class BattlePerception {
    constructor(controller) {
        this.controller = controller;
        this.contacts = new Map();
        this.lastObservation = null;
        this.initialFriendlyValue = null;
    }

    reset() {
        this.contacts.clear();
        this.lastObservation = null;
        this.initialFriendlyValue = null;
    }

    observeContact(target, observers, tick) {
        let closestDistance = Infinity;
        for (const observer of observers) {
            closestDistance = Math.min(closestDistance, Math.hypot(target.x - observer.x, target.y - observer.y));
        }
        const previous = this.contacts.get(target.id);
        const dtTicks = previous ? Math.max(1, tick - previous.lastSeenTick) : 1;
        const velocityX = previous ? (target.x - previous.x) / dtTicks : 0;
        const velocityY = previous ? (target.y - previous.y) / dtTicks : 0;
        const band = perceptionHealthBand(target);
        const hf = band === 'HEALTHY' ? 1 : band === 'DAMAGED' ? 0.66 : 0.33;
        const contact = {
            id: target.id,
            typeEstimate: target.type,
            x: Math.round(target.x * 100) / 100,
            y: Math.round(target.y * 100) / 100,
            velocityX,
            velocityY,
            healthBand: band,
            // FAZ 2a: kuvvet tahmini (tip-maliyeti × sağlık). OPG/Oracle/Blackboard bunu okur (eskiden ||1 = sayı-bazlı).
            // Görünmezken (decay) band donuk kalır → hatırlanan tank hâlâ tank olarak değerlenir.
            estimatedStrength: Math.round((STATS[target.type]?.cost || 1) * hf * 100) / 100,
            lastSeenTick: tick,
            confidence: 1,
            uncertaintyRadius: 0,
            closestObserverDistance: Math.round(closestDistance * 100) / 100,
            visible: true
        };
        this.contacts.set(target.id, contact);
        return contact;
    }

    decayContacts(tick) {
        for (const [id, contact] of this.contacts) {
            const ageTicks = Math.max(0, tick - contact.lastSeenTick);
            if (ageTicks > CONTACT_MEMORY_TTL_TICKS) {
                this.contacts.delete(id);
                continue;
            }
            if (ageTicks === 0) continue;
            const ageSec = ageTicks * BATTLE_TICK_SEC;
            contact.visible = false;
            contact.confidence = Math.max(0, 1 - ageTicks / CONTACT_MEMORY_TTL_TICKS);
            contact.uncertaintyRadius = Math.round(Math.min(900, 25 + ageSec * 22) * 100) / 100;
            contact.x = Math.round((contact.x + contact.velocityX) * 100) / 100;
            contact.y = Math.round((contact.y + contact.velocityY) * 100) / 100;
        }
    }

    update(tick = SIM.tick) {
        const ownUnits = this.controller.units().slice().sort((a, b) => a.id - b.id);
        this.decayContacts(tick);

        const enemies = SIM.units
            .filter(unit => !unit.dead && unit.isRed !== this.controller.side)
            .sort((a, b) => a.id - b.id);
        if (!this._seenEnemyRefs) { this._seenEnemyRefs = new Map(); this._confirmedKilledValue = 0; this._killedCounted = new Set(); }
        for (const target of enemies) {
            const observers = ownUnits.filter(observer => perceptionObserverCanSee(observer, target));
            if (observers.length) { this.observeContact(target, observers, tick); this._seenEnemyRefs.set(target.id, target); }   // TEYİT-İSTİHBARAT: gördüğümüz düşmanları hatırla
        }
        // TEYİTLİ İMHA: gördüğümüz düşmanlardan ölenlerin ₺'sini say (görülmeyen düşman ölü DEĞİL, görünmeyendir).
        for (const [id, ref] of this._seenEnemyRefs) {
            if (ref.dead && !this._killedCounted.has(id)) { this._killedCounted.add(id); this._confirmedKilledValue += (STATS[ref.type]?.cost || 0); }
        }

        let friendlyValue = 0;
        for (const unit of ownUnits) {
            friendlyValue += (STATS[unit.type]?.cost || 0) * (unit.hp / Math.max(1, unit.maxHp));
        }
        if (this.initialFriendlyValue == null) this.initialFriendlyValue = friendlyValue;
        let observedEnemyValue = 0;
        for (const contact of this.contacts.values()) {
            // Sağlık bandı kesin HP değildir. Tehdit değerlendirmesinde bandın üst
            // sınırını kullan; aksi halde tamamen sağlıklı ve görünür eşit kuvvet
            // bile sistematik olarak %15 zayıf sayılıyordu.
            const healthFactor = contact.healthBand === 'HEALTHY' ? 1 :
                contact.healthBand === 'DAMAGED' ? 0.66 : 0.33;
            observedEnemyValue += (STATS[contact.typeEstimate]?.cost || 0) *
                healthFactor * contact.confidence;
        }
        // ANALİST-FIX (a): görülmeyen düşman ölü DEĞİLDİR. Taban ZAMANLA çürümez (eski bug: 90s'de sıfır →
        // AI görmediğini unutup sahte-avantaj sanıp mevziden çıkıyordu). Taban = başlangıç-tahmini(parite) − TEYİTLİ imha ₺.
        // Yalnız gördüğümüz-ve-ölen düşmanı düşeriz; görünmeyen kuvvet tabanda kalır → savunan hazır-mevzide oturur.
        const intelligenceFloor = Math.max(0, (this.initialFriendlyValue || 0) - (this._confirmedKilledValue || 0));
        const estimatedEnemyValue = Math.max(observedEnemyValue, intelligenceFloor);

        this.lastObservation = {
            tick,
            side: this.controller.side,
            ownUnits: ownUnits.map(unit => ({
                id: unit.id,
                type: unit.type,
                x: unit.x,
                y: unit.y,
                hpRatio: unit.hp / Math.max(1, unit.maxHp),
                ammoRatio: unit.maxAmmo > 0 ? unit.ammo / unit.maxAmmo : 1
            })),
            contacts: [...this.contacts.values()].map(replayClone).sort((a, b) => a.id - b.id),
            friendlyValue: Math.round(friendlyValue * 100) / 100,
            observedEnemyValue: Math.round(observedEnemyValue * 100) / 100,
            intelligenceFloor: Math.round(intelligenceFloor * 100) / 100,
            estimatedEnemyValue: Math.round(estimatedEnemyValue * 100) / 100
        };
        return this.lastObservation;
    }

    snapshot() {
        return replayClone(this.lastObservation);
    }
}
