// ═══════════════════════════════════════════════════════════════
//  ÖĞRENEN AI (Karşı-Ordu / Counter-Picking ve Etki Haritası)
// ═══════════════════════════════════════════════════════════════
const GRID_SIZE = 100;
const COLS = Math.ceil(WORLD_W / GRID_SIZE);
const ROWS = Math.ceil(WORLD_H / GRID_SIZE);
let influenceGrid = [];

function aiDeploy() {
    let currentMoney = enemy.money;
    const aiDeployCounts = new Array(9).fill(0);
    
    // Geçmiş hafıza (Local Storage) + Şu anki haritadaki Mavi birimler
    let blueCounts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0 };
    for (const type in playerMeta) blueCounts[type] += playerMeta[type] * 0.4; // %40 Hafıza etkisi
    for (const u of units) {
        if (!u.isRed) blueCounts[u.type] += 1;
    }

    // Ağırlık Sistemi (Genetik Algoritma Counter Geni kullanarak)
    let aiWeights = { 0:1, 1:1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1, 8:1 };
    
    for (let myType = 0; myType < 9; myType++) {
        for (let enemyType = 0; enemyType < 9; enemyType++) {
            aiWeights[myType] += blueCounts[enemyType] * aiGenome.counterMatrix[enemyType][myType];
        }
    }
    
    const buyUnit = (type, rx, ry) => {
        if (type === T.ENGINEER && aiDeployCounts[T.ENGINEER] >= 1) return false;
        if (currentMoney >= STATS[type].cost) {
            placeUnit(type, rx, ry, true);
            aiDeployCounts[type]++;
            currentMoney -= STATS[type].cost;
            return true;
        }
        return false;
    };

    // Canlı fizik artık sınırlı mühimmat kullandığı için AI her orduda bir lojistik çekirdek taşır.
    buyUnit(T.ENGINEER, WORLD_W * 0.5 + (Math.random() * 80 - 40), 220);
    aiWeights[T.ENGINEER] *= 0.18;

    // Oyuncu tek tip zırha yüklendiyse öğrenilmiş matris ne derse desin temel bir karşı kuvvet kur.
    // Bu bir hile değil: AI konuşlanma sırasında oyuncunun sahaya koyduğu birlikleri zaten görüyor.
    const deployedBlue = units.filter(unit => !unit.isRed && !unit.dead);
    const deployedArmor = deployedBlue.filter(unit =>
        [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(unit.type)
    ).length;
    const deployedArtillery = deployedBlue.filter(unit => unit.type === T.ARTILLERY).length;
    const deployedSupport = deployedBlue.filter(unit =>
        [T.ARTILLERY, T.MEDIC, T.ENGINEER, T.ANTI_TANK].includes(unit.type)
    ).length;
    const armorRatio = deployedArmor / Math.max(1, deployedBlue.length);
    const tankBarrierWithGuns = deployedArmor >= 3 && deployedArtillery >= 1;
    if (tankBarrierWithGuns) {
        const hunterPackage = [
            T.RECON, T.ARTILLERY,
            T.ANTI_TANK, T.ANTI_TANK,
            T.MECH_INFANTRY, T.MECH_INFANTRY,
            T.ARMOR_INFANTRY, T.INFANTRY
        ];
        for (let index = 0; index < hunterPackage.length; index++) {
            const type = hunterPackage[index];
            const row = Math.floor(index / 4);
            const column = index % 4;
            const rx = WORLD_W * 0.5 + (column - 1.5) * 145 + (Math.random() * 28 - 14);
            const ry = 250 + row * 115 + (Math.random() * 28 - 14);
            buyUnit(type, rx, ry);
        }
        aiWeights[T.RECON] += 28;
        aiWeights[T.MECH_INFANTRY] += 24;
        aiWeights[T.ANTI_TANK] += 26;
        aiWeights[T.ARMOR_INFANTRY] += 12;
        aiWeights[T.ARTILLERY] += 30;
        aiWeights[T.ARMOR] *= 0.55;
    }
    if (deployedBlue.length >= 4 && armorRatio >= 0.65) {
        const antiTankCount = Math.min(
            deployedArmor + 1,
            Math.floor(currentMoney * (tankBarrierWithGuns ? 0.38 : 0.58) / STATS[T.ANTI_TANK].cost)
        );
        for (let index = 0; index < antiTankCount; index++) {
            const column = index % 5;
            const row = Math.floor(index / 5);
            const rx = WORLD_W * 0.5 + (column - 2) * 150 + (Math.random() * 30 - 15);
            const ry = 330 + row * 110 + (Math.random() * 30 - 15);
            buyUnit(T.ANTI_TANK, rx, ry);
        }
        aiWeights[T.ANTI_TANK] += 35;
        aiWeights[T.ARTILLERY] += 14;
        aiWeights[T.RECON] += 8;
    }
    if (deployedSupport >= 2) {
        aiWeights[T.RECON] += 18;
        aiWeights[T.MECH_INFANTRY] += 14;
        aiWeights[T.ARTILLERY] *= 0.75;
    }

    let attempts = 0;
    while(currentMoney > 40 && attempts < 100) {
        let bestType = null;
        let maxW = -1;
        for (let t=0; t<9; t++) {
            if (aiWeights[t] > maxW && currentMoney >= STATS[t].cost) {
                maxW = aiWeights[t];
                bestType = t;
            }
        }

        if (bestType !== null) {
            // Genomdan Konum (Deploy) Genlerini Çek
            let xRatio = aiGenome.deployMatrix[bestType][0];
            let yRatio = aiGenome.deployMatrix[bestType][1];
            
            // XRatio 0 ise en sol (50), 1 ise en sağ (WORLD_W - 50)
            let rx = 50 + (xRatio * (WORLD_W - 100));
            // YRatio 0 ise en ön safha (WORLD_H * 0.4 - 50), 1 ise en arka (50)
            let ry = (WORLD_H * 0.4 - 50) - (yRatio * (WORLD_H * 0.4 - 100));
            
            // Birliklerin üst üste binip patlamasını (çarpışma) engellemek için hafif rastgelelik (Jitter)
            rx += (Math.random() * 60) - 30;
            ry += (Math.random() * 60) - 30;
            
            buyUnit(bestType, rx, ry);
            aiWeights[bestType] *= 0.5; 
        } else {
            break;
        }
        attempts++;
    }
}

let lastAiTacticTime = 0;
let phaseTimer = 0;
let globalLastSeenX = null;
let globalLastSeenY = null;
let aiFocusTarget = null; // AI Focus Fire Target
let lastEnemySeenTime = -Infinity;
let searchWaypointIndex = 0;
let aiSearchMode = false;
let searchWaypointChangedTime = -Infinity;
const SEARCH_WAYPOINTS = [
    { x: WORLD_W * 0.50, y: WORLD_H * 0.64 },
    { x: WORLD_W * 0.30, y: WORLD_H * 0.71 },
    { x: WORLD_W * 0.70, y: WORLD_H * 0.71 },
    { x: WORLD_W * 0.14, y: WORLD_H * 0.84 },
    { x: WORLD_W * 0.86, y: WORLD_H * 0.84 },
    { x: WORLD_W * 0.50, y: WORLD_H * 0.90 }
];


function getSquadRole(type) {
    if (aiDoctrine === 1) { // Ağır Örs
        if ([T.INFANTRY, T.ARMOR, T.MECH_INFANTRY].includes(type)) return SQUAD.VANGUARD;
        if ([T.HELICOPTER, T.ANTI_TANK, T.ANTI_AIR].includes(type)) return SQUAD.FLANK;
        return SQUAD.SUPPORT;
    } else { // Zırhlı Çekiç
        if ([T.INFANTRY, T.ANTI_AIR].includes(type)) return SQUAD.VANGUARD;
        if ([T.ARMOR, T.MECH_INFANTRY, T.HELICOPTER].includes(type)) return SQUAD.FLANK;
        return SQUAD.SUPPORT;
    }
}

function updateAITactics(now) {
    if (now - lastAiTacticTime < 100) return; // 100ms real-time (Gecikmesiz)
    lastAiTacticTime = now;

    const redUnits = units.filter(u => u.isRed && !u.dead);
    if (redUnits.length === 0) return;
    const genes = aiGenome.tacticGenes;
    
    const visibleBlueUnits = units.filter(u => !u.isRed && !u.dead && canSee(true, u.x, u.y));
    
    // Hafıza ve Hedef Güncellemesi
    if (visibleBlueUnits.length > 0) {
        let sumX = 0, sumY = 0;
        let bestTarget = null; let maxTScore = -Infinity;
        
        visibleBlueUnits.forEach(u => { 
            sumX += u.x; sumY += u.y; 
            // Focus Fire hedefi seç: En zayıf veya en tehlikeli birim
            let score = (1 - u.hp / u.maxHp) * 5000 * genes.focusFire;
            if ([T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(u.type)) score += 1800 * genes.targetArmorPriority;
            if (u.type === T.ARTILLERY || u.type === T.MEDIC) score += 3000 * genes.targetSupportPriority;
            if (score > maxTScore) { maxTScore = score; bestTarget = u; }
        });
        
        globalLastSeenX = sumX / visibleBlueUnits.length;
        globalLastSeenY = sumY / visibleBlueUnits.length;
        lastEnemySeenTime = now;
        aiFocusTarget = bestTarget;
        aiSearchMode = false;
    } else {
        aiFocusTarget = null;
    }

    // Düşman görünmüyorsa ordu kuzeyden güneye, oyuncu konuşlanma bölgesine ilerler.
    let enCx = globalLastSeenX !== null ? globalLastSeenX : WORLD_W / 2;
    let enCy = globalLastSeenY !== null ? globalLastSeenY : WORLD_H - 180;
    
    let myCx = 0, myCy = 0;
    let totalRedHp = 0, maxRedHp = 0;
    let armorCount = 0;

    redUnits.forEach(u => { 
        myCx += u.x; myCy += u.y; 
        totalRedHp += u.hp; maxRedHp += u.maxHp;
        if ([T.ARMOR, T.MECH_INFANTRY].includes(u.type)) armorCount++;
    });
    myCx /= redUnits.length;
    myCy /= redUnits.length;

    // Görüş kaybolduğunda kısa süre son konumu kontrol et, sonra oyuncu bölgesini tara.
    if (visibleBlueUnits.length === 0 && now - lastEnemySeenTime > 4500) {
        let waypoint = SEARCH_WAYPOINTS[searchWaypointIndex];
        const nearbySearchers = redUnits.filter(unit => Math.hypot(unit.x - waypoint.x, unit.y - waypoint.y) < 320).length;
        const requiredSearchers = Math.max(2, Math.ceil(redUnits.length * 0.35));
        const waypointSettled = now - searchWaypointChangedTime > 3000 &&
            (nearbySearchers >= requiredSearchers || Math.hypot(myCx - waypoint.x, myCy - waypoint.y) < 230);
        if (waypointSettled) {
            searchWaypointIndex = (searchWaypointIndex + 1) % SEARCH_WAYPOINTS.length;
            waypoint = SEARCH_WAYPOINTS[searchWaypointIndex];
            searchWaypointChangedTime = now;
        }
        enCx = waypoint.x;
        enCy = waypoint.y;
        aiSearchMode = true;
        globalLastSeenX = null;
        globalLastSeenY = null;
    }

    // ─── DİNAMİK KANAT AĞIRLIĞI (FLANK WEIGHT) ───
    let enemyArtyCount = visibleBlueUnits.filter(u => u.type === T.ARTILLERY || u.type === T.ANTI_TANK).length;
    // Eğer düşman tank avcısı veya topçu basmışsa, kanatlara yüklen (Örn %60). Yoksa normal (Örn %30).
    let targetFlankRatio = genes.flankRatio;
    if (enemyArtyCount > visibleBlueUnits.length * 0.25) targetFlankRatio += 0.12;
    targetFlankRatio = Math.min(0.75, targetFlankRatio);

    // ─── DİNAMİK DOKTRİN SEÇİMİ ───
    if (armorCount > redUnits.length * 0.3) aiDoctrine = 2; // Tank ağırlıklıysa Zırhlı Çekiç
    else aiDoctrine = 1; // Değilse Ağır Örs

    // ─── 1. SAVAŞ FAZI (STATE MACHINE) KONTROLÜ ───
    let armyHpRatio = totalRedHp / Math.max(1, maxRedHp);
    let distToEnemy = Math.hypot(myCx - enCx, myCy - enCy);
    let isBankrupt = enemy.money < 100; // Takviye yapacak parası kalmadı

    // Eğer kazanma ihtimali yoksa ve parası bitmişse -> LAST STAND (Faz 5)
    if (visibleBlueUnits.length === 0) {
        // Düşman saklanırken geri çekilme döngüsünde kalma; arama düzenine geç.
        battlePhase = 1;
    } else if (armyHpRatio < 0.3 && isBankrupt) {
        battlePhase = 5;
    } else if (armyHpRatio < genes.vanguardRetreat + 0.05 || redUnits.length < visibleBlueUnits.length * (0.25 + genes.vanguardRetreat * 0.5)) {
        battlePhase = 4; // Toparlanma
    } else if (battlePhase === 4 && armyHpRatio > 0.7) {
        battlePhase = 1; // Can toplandı, taarruza devam
    }

    if (battlePhase === 1) { // ADVANCE (Yaklaşma)
        if (distToEnemy < 600 * genes.vanguardAggression && visibleBlueUnits.length > 0) {
            battlePhase = 2; // Menzile girildi -> CLASH başlasın
            phaseTimer = now;
        }
    } else if (battlePhase === 2) { // CLASH (Çarpışma)
        if (now - phaseTimer > 3000) { 
            battlePhase = 3; // 3sn sonra kanatları çıkar -> FLANK
        }
        if (visibleBlueUnits.length === 0) battlePhase = 1; // Düşman bittiyse ilerlemeye dön
    } else if (battlePhase === 3) { // FLANK (Kuşatma)
        if (visibleBlueUnits.length === 0) battlePhase = 1;
    }

    // ─── 2. FORMASYON HESAPLAMALARI ───
    let vanguardX = myCx, vanguardY = myCy;
    let flankX = myCx, flankY = myCy;
    let supportX = myCx, supportY = myCy;

    // Regroup fazında merkeze değil, kendi üssüne dön!
    if (battlePhase === 4) {
        enCx = WORLD_W / 2;
        enCy = 180; // Kendi kuzey üssüne çekil
    }

    let dirX = enCx - myCx;
    let dirY = enCy - myCy;
    let len = Math.max(1, Math.hypot(dirX, dirY));
    dirX /= len; dirY /= len;

    let perpX = -dirY; // Sağ/Sol ekseni
    let perpY = dirX;

    if (battlePhase === 1) {
        let advanceSpeed = 100 * genes.vanguardAggression;
        vanguardX = myCx + dirX * advanceSpeed; vanguardY = myCy + dirY * advanceSpeed;
        flankX = vanguardX; flankY = vanguardY;
        supportX = vanguardX - dirX * 150; supportY = vanguardY - dirY * 150;
    } else if (battlePhase === 2) {
        vanguardX = enCx; vanguardY = enCy; // DÜŞMANA ÇARP
        // Kanatları doğrudan düşmanın hizasına gönder (Yanaşsınlar)
        flankX = enCx; flankY = enCy; 
        supportX = enCx - dirX * 250; supportY = enCy - dirY * 250;
    } else if (battlePhase === 3) {
        vanguardX = enCx; vanguardY = enCy; // Hattı tut
        // Kanatları düşmanın içine kırarak (Kuşatma) gönder
        flankX = enCx + dirX * 100; flankY = enCy + dirY * 100;
        supportX = enCx - dirX * 250; supportY = enCy - dirY * 250;
    } else if (battlePhase === 4) { // REGROUP (Toparlanma Formasyonu)
        vanguardX = enCx; vanguardY = enCy;
        flankX = enCx + 100; flankY = enCy + 100;
        supportX = enCx - 100; supportY = enCy - 100;
    } else if (battlePhase === 5) { // LAST STAND (Son Direniş)
        vanguardX = enCx; vanguardY = enCy;
        flankX = enCx + perpX * 150; flankY = enCy + perpY * 150;
        supportX = enCx; supportY = enCy;
    }

    // Formasyon Sırası için sayaçlar
    let vanguardCount = 0;
    let flankCount = 0;
    let supportCount = 0;

    // Squad Atamaları (Dinamik)
    let flankAssigned = 0;
    let maxFlank = Math.floor(redUnits.length * targetFlankRatio);
    for (const ru of redUnits) {
        if (ru.type === T.MEDIC || ru.type === T.ARTILLERY || ru.type === T.ENGINEER) {
            ru.squad = SQUAD.SUPPORT;
        } else if (ru.type === T.RECON || ru.type === T.MECH_INFANTRY) { 
            ru.squad = SQUAD.FLANK;
            flankAssigned++;
        } else if (flankAssigned < maxFlank && ru.type !== T.ARMOR_INFANTRY) {
            ru.squad = SQUAD.FLANK;
            flankAssigned++;
        } else {
            ru.squad = SQUAD.VANGUARD;
        }
    }

    // ─── 3. BİRLİK MİKRO-YÖNETİMİ ───
    for (const ru of redUnits) {
        let squad = ru.squad;
        const roleGenes = getRoleTacticGenes(genes, squad);
        ru.aiAction = 'ATTACK';

        // Moral bozulduğunda merkezi taktik, kaçış emrini iyileşene kadar ezemez.
        if (ru.isFleeing && !ru.lastStandMorale) {
            ru.aiAction = 'FLEE';
            if (ru.fleeTarget) {
                ru.targetX = ru.fleeTarget.x;
                ru.targetY = ru.fleeTarget.y;
            }
            continue;
        }

        // Düşman görünmüyorsa bütün ordu arama düzenine girer; destekler bile üste beklemez.
        if (aiSearchMode) {
            let searchX = enCx;
            let searchY = enCy;
            if (squad === SQUAD.FLANK) {
                const side = (flankCount++ % 2 === 0) ? -1 : 1;
                searchX += side * genes.flankWidth;
                searchY -= 80;
            } else if (squad === SQUAD.SUPPORT) {
                searchY -= 180;
                searchX += (supportCount++ % 3 - 1) * 90;
            } else {
                searchX += (vanguardCount++ % 5 - 2) * 70;
            }
            ru.targetX = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, searchX));
            ru.targetY = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, searchY));
            ru.aiAction = 'SEARCH';
            continue;
        }
        
        // A) SAĞLIKÇI (MEDIC) MEKANİĞİ - ÜS (BASE) MANTIĞI
        if (ru.type === T.MEDIC) {
            let aiBaseX = WORLD_W / 2;
            let aiBaseY = 180;
            
            let lowestHpUnit = null;
            let lowestRatio = 1;
            for(const u of redUnits) {
                if(u === ru || u.hp >= u.maxHp) continue;
                // Sadece üsse belli bir mesafede olanlara müdahale et (Ordunun geri kalanına ölüme koşma)
                if(Math.hypot(u.x - aiBaseX, u.y - aiBaseY) > 800) continue;
                
                if(u.hp / u.maxHp < lowestRatio) { lowestRatio = u.hp / u.maxHp; lowestHpUnit = u; }
            }
            if(lowestHpUnit && lowestRatio < 0.8) {
                ru.targetX = lowestHpUnit.x; ru.targetY = lowestHpUnit.y;
            } else {
                // Üste devriye at (Yapılanma)
                ru.targetX = aiBaseX + Math.cos(ru.x) * 150;
                ru.targetY = aiBaseY + Math.sin(ru.y) * 150;
            }
            continue; 
        }
        
        // B) SAVAŞARAK GERİ ÇEKİLME (KITE / RETREAT) & TOPARLANMA (REGROUP) & LAST STAND
        let hpRatioU = ru.hp / ru.maxHp;
        
        if (battlePhase === 4) {
            // Regroup modundaysa herkes çekilme merkezine (vanguardX/Y) koşsun
            ru.targetX = vanguardX + (Math.random()*200 - 100); 
            ru.targetY = vanguardY + (Math.random()*200 - 100);
            ru.aiAction = 'FLEE';
            continue;
        } else if (battlePhase === 5) {
            // LAST STAND! Geri çekilmek YOK.
            ru.aiAction = 'ATTACK';
        } else if (!ru.lastStandMorale && hpRatioU < roleGenes.retreat && ru.type !== T.MEDIC) {
            let aiBaseX = WORLD_W / 2;
            let aiBaseY = 180;
            
            ru.targetX = aiBaseX + (Math.random() * 200 - 100);
            ru.targetY = aiBaseY + (Math.random() * 200 - 100);
            ru.aiAction = 'FLEE'; // Tamamen kaç (Üsse dön)
            continue; 
        }

        // C) SKIRMISH (Öncü Vur-Kaçı): Öncüler eğer ana ordunun çok önündeyse ve düşman görmüşse geri çekilsin
        if ((battlePhase === 1 || battlePhase === 2) && visibleBlueUnits.length > 0) {
            if (ru.type === T.RECON || ru.type === T.MECH_INFANTRY) {
                let distToEnemyU = Math.hypot(ru.x - enCx, ru.y - enCy);
                let supportDistToEnemy = Math.hypot(supportX - enCx, supportY - enCy);
                
                // Eğer düşman ona çok yakınsa ama Support (ana ordu) ona çok uzaksa (Yem olmamak için)
                if (distToEnemyU < 600 / roleGenes.aggression && supportDistToEnemy - distToEnemyU > 400 * genes.cohesion) {
                    ru.targetX = supportX + (Math.random()*100 - 50); 
                    ru.targetY = supportY + (Math.random()*100 - 50);
                    ru.aiAction = 'KITE'; // Ateş ede ede kendi ana hattına kaç
                    continue; // Formasyon hedefini ez
                }
            }
        }

        // C) İSTİHKAM (ENGINEER) SİNERJİSİ
        if ([T.INFANTRY, T.ARMOR, T.ARTILLERY].includes(ru.type)) {
            let nearestEng = null, minDist = Infinity;
            for(const eng of redUnits) {
                if(eng.type === T.ENGINEER && eng !== ru) {
                    let d = Math.hypot(ru.x - eng.x, ru.y - eng.y);
                    if(d < minDist) { minDist = d; nearestEng = eng; }
                }
            }
            if (nearestEng && minDist > 150 && minDist < 350) {
                ru.targetX = nearestEng.x; ru.targetY = nearestEng.y;
                continue;
            }
        }

        // D) FORMASYON UYGULAMASI (Geniş Cephe / Line Formation)
        const formationSpacing = 90 - genes.cohesion * 50;
        if (squad === SQUAD.VANGUARD) {
            let offset = (vanguardCount - Math.floor(redUnits.length * 0.5)) * formationSpacing;
            ru.targetX = vanguardX + perpX * offset; 
            ru.targetY = vanguardY + perpY * offset;
            vanguardCount++;

            if (battlePhase === 1 && visibleBlueUnits.length > 0) {
                let ne = visibleBlueUnits[0]; 
                if(Math.hypot(ru.x - ne.x, ru.y - ne.y) < ru.range * (1.0 + roleGenes.aggression * 0.5)) {
                    ru.targetX = ne.x; ru.targetY = ne.y; // Kısmi kovalama
                }
            }
        } else if (squad === SQUAD.FLANK) {
            let offset = genes.flankWidth;
            let side = (flankCount % 2 === 0) ? 1 : -1; // Bir sağa, bir sola
            ru.targetX = flankX + perpX * offset * side;
            ru.targetY = flankY + perpY * offset * side;
            flankCount++;
        } else {
            let offset = (supportCount - Math.floor(redUnits.length * 0.3)) * formationSpacing * 0.85;
            ru.targetX = supportX + perpX * offset; 
            ru.targetY = supportY + perpY * offset;
            supportCount++;
        }
        
        ru.targetX = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, ru.targetX));
        ru.targetY = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, ru.targetY));
    }
}
// ═══════════════════════════════════════════════════════════════
//  ULTIMATE GENETİK ALGORİTMA (500 MAÇLIK 2D UZAYSAL SİMÜLASYON)
// ═══════════════════════════════════════════════════════════════
function cloneMatrix(mat) { return mat.map(row => [...row]); }

function cloneGenome(genome) {
    return {
        version: genome.version || 4,
        counterMatrix: cloneMatrix(genome.counterMatrix),
        deployMatrix: cloneMatrix(genome.deployMatrix),
        tacticGenes: normalizeTacticGenes(genome.tacticGenes)
    };
}

const TACTIC_FAMILIES = [
    {
        id: 'armor_hunter',
        name: 'Tank Avcısı',
        genes: ['targetArmorPriority', 'targetThreatWeight', 'executeTtk', 'decisiveForceRatio', 'focusFire', 'supportPreferredRange', 'vanguardPreferredRange']
    },
    {
        id: 'encirclement',
        name: 'Kuşatmacı',
        genes: ['flankAggression', 'flankPreferredRange', 'flankRetreat', 'flankRatio', 'flankWidth', 'steeringSeparation']
    },
    {
        id: 'fire_control',
        name: 'Ateş Kontrolü',
        genes: ['focusFire', 'targetSupportPriority', 'targetValueWeight', 'finishBias', 'supportPreferredRange', 'vanguardPreferredRange']
    },
    {
        id: 'survival',
        name: 'Hayatta Kalma',
        genes: ['vanguardRetreat', 'flankRetreat', 'supportRetreat', 'kiteHp', 'resupplyAmmo', 'threatAvoidance', 'tacticalRetreatForceRatio']
    }
];
const FAMILY_POPULATION_SIZE = 5;
const CROSSOVER_PAIRS = [
    ['armor_hunter', 'encirclement'],
    ['armor_hunter', 'fire_control'],
    ['encirclement', 'survival'],
    ['fire_control', 'survival']
];
const TOTAL_POPULATION_SIZE = TACTIC_FAMILIES.length * FAMILY_POPULATION_SIZE + CROSSOVER_PAIRS.length;

function crossoverGenomes(parentA, parentB) {
    const child = cloneGenome(parentA);
    const genesA = normalizeTacticGenes(parentA.tacticGenes);
    const genesB = normalizeTacticGenes(parentB.tacticGenes);
    for (let row = 0; row < child.counterMatrix.length; row++) {
        for (let col = 0; col < child.counterMatrix[row].length; col++) {
            const roll = Math.random();
            child.counterMatrix[row][col] = roll < 0.45
                ? parentA.counterMatrix[row][col]
                : roll < 0.90
                    ? parentB.counterMatrix[row][col]
                    : (parentA.counterMatrix[row][col] + parentB.counterMatrix[row][col]) / 2;
        }
    }
    for (let row = 0; row < child.deployMatrix.length; row++) {
        for (let col = 0; col < child.deployMatrix[row].length; col++) {
            child.deployMatrix[row][col] = Math.random() < 0.5
                ? parentA.deployMatrix[row][col]
                : parentB.deployMatrix[row][col];
        }
    }
    for (const geneName of Object.keys(TACTIC_GENE_LIMITS)) {
        const roll = Math.random();
        child.tacticGenes[geneName] = roll < 0.4
            ? genesA[geneName]
            : roll < 0.8
                ? genesB[geneName]
                : (genesA[geneName] + genesB[geneName]) / 2;
    }
    return child;
}

function loadChampionArchive() {
    try {
        const saved = JSON.parse(localStorage.getItem(CHAMPION_ARCHIVE_KEY));
        if (saved && saved.validationLeagueVersion === VALIDATION_LEAGUE_VERSION && saved.families) {
            if (saved.version === 2) return saved;
            if (saved.version === 1) {
                const migratedFamilies = {};
                for (const [familyId, entry] of Object.entries(saved.families)) {
                    migratedFamilies[familyId] = { champions: [entry] };
                }
                return {
                    version: 2,
                    validationLeagueVersion: VALIDATION_LEAGUE_VERSION,
                    generation: saved.generation || 0,
                    families: migratedFamilies
                };
            }
        }
    } catch (error) {
        console.warn('Şampiyon arşivi okunamadı.', error);
    }
    return { version: 2, validationLeagueVersion: VALIDATION_LEAGUE_VERSION, generation: 0, families: {} };
}

function saveChampionArchive(archive) {
    try {
        localStorage.setItem(CHAMPION_ARCHIVE_KEY, JSON.stringify(archive));
    } catch (error) {
        console.warn('Şampiyon arşivi kaydedilemedi.', error);
    }
}

function getAdaptiveMutationProfile(stagnationEpochs) {
    if (stagnationEpochs >= 2500) return { scale: 3.2, tacticChance: 0.72, bonusMutations: 5, level: 'sıçrama' };
    if (stagnationEpochs >= 1000) return { scale: 2.2, tacticChance: 0.62, bonusMutations: 3, level: 'yüksek' };
    if (stagnationEpochs >= 400) return { scale: 1.5, tacticChance: 0.50, bonusMutations: 1, level: 'orta' };
    return { scale: 1.0, tacticChance: 0.32, bonusMutations: 0, level: 'normal' };
}

function mutateGenome(genome, profile = getAdaptiveMutationProfile(0), family = null) {
    let newG = {
        counterMatrix: cloneMatrix(genome.counterMatrix),
        deployMatrix: cloneMatrix(genome.deployMatrix),
        tacticGenes: normalizeTacticGenes(genome.tacticGenes)
    };
    
    const mutations = Math.floor(Math.random() * 5) + 1 + profile.bonusMutations;
    const remainingChance = 1 - profile.tacticChance;
    const counterCutoff = remainingChance * 0.62;
    const deployCutoff = remainingChance;
    for(let i=0; i<mutations; i++) {
        let dice = Math.random();
        let r = Math.floor(Math.random() * 9);
        if (dice < counterCutoff) {
            let c = Math.floor(Math.random() * 9);
            newG.counterMatrix[r][c] += ((Math.random() * 1.0) - 0.5) * profile.scale;
            newG.counterMatrix[r][c] = Math.max(0.1, newG.counterMatrix[r][c]);
        } else if (dice < deployCutoff) {
            let c = Math.floor(Math.random() * 2);
            newG.deployMatrix[r][c] += ((Math.random() * 0.4) - 0.2) * profile.scale;
            newG.deployMatrix[r][c] = Math.max(0, Math.min(1, newG.deployMatrix[r][c])); 
        } else {
            const allGeneNames = Object.keys(TACTIC_GENE_LIMITS);
            const geneNames = family && Math.random() < 0.82 ? family.genes : allGeneNames;
            const geneName = geneNames[Math.floor(Math.random() * geneNames.length)];
            const limits = TACTIC_GENE_LIMITS[geneName];
            const mutationSize = (limits[1] - limits[0]) * 0.18 * profile.scale;
            newG.tacticGenes[geneName] += (Math.random() * 2 - 1) * mutationSize;
            newG.tacticGenes[geneName] = Math.max(limits[0], Math.min(limits[1], newG.tacticGenes[geneName]));
        }
    }
    // Her aile adayı, kendi doktrininden en az bir geni mutlaka değiştirir.
    if (family) {
        const geneName = family.genes[Math.floor(Math.random() * family.genes.length)];
        const limits = TACTIC_GENE_LIMITS[geneName];
        const mutationSize = (limits[1] - limits[0]) * 0.12 * profile.scale;
        newG.tacticGenes[geneName] += (Math.random() * 2 - 1) * mutationSize;
        newG.tacticGenes[geneName] = Math.max(limits[0], Math.min(limits[1], newG.tacticGenes[geneName]));
    }
    return newG;
}

const SIM_TICK_MS = 100;
const SIM_MOVE_PER_TICK = 60 * (SIM_TICK_MS / 1000);
const SIM_TICK_SECONDS = SIM_TICK_MS / 1000;
const SIM_BODY_BLOCK_RADIUS_SQ = (UNIT_RADIUS * 1.5) * (UNIT_RADIUS * 1.5);
const SIM_FORESTS = terrainFeatures.filter(terrain => terrain.type === TERRAIN.FOREST);
const SIM_MOUNTAINS = terrainFeatures.filter(terrain => terrain.type === TERRAIN.MOUNTAIN);

function distSq(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

function createSimUnit(type) {
    const stats = STATS[type];
    return {
        type,
        hp: stats.hp,
        maxHp: stats.hp,
        atk: stats.atk,
        baseArmor: stats.armor,
        armor: stats.armor,
        baseSpeed: stats.speed,
        speed: stats.speed,
        range: stats.range,
        vision: stats.vision,
        atkSpeed: stats.atkSpeed,
        maxAmmo: stats.maxAmmo,
        ammo: stats.maxAmmo,
        cooldownMs: 0,
        panic: 0,
        suppression: 0,
        facingAngle: 0,
        kills: 0,
        level: 0,
        xpBonus: 1,
        supplyProgress: 0,
        fieldBuilt: false,
        fieldBuiltAt: -Infinity,
        inForest: false,
        inTrench: false,
        isFleeing: false,
        hasFledOnce: false,
        lastStandMorale: false
    };
}

function generateMockArmy(money, qMat, enemyCounts) {
    let army = [];
    const armyCounts = new Array(9).fill(0);
    let weights = [1,1,1,1,1,1,1,1,1];
    for (let myType = 0; myType < 9; myType++) {
        for (let eType = 0; eType < 9; eType++) {
            weights[myType] += enemyCounts[eType] * qMat[eType][myType];
        }
    }
    let m = money;
    if (m >= STATS[T.ENGINEER].cost) {
        army.push(createSimUnit(T.ENGINEER));
        armyCounts[T.ENGINEER]++;
        m -= STATS[T.ENGINEER].cost;
        weights[T.ENGINEER] *= 0.18;
    }
    const enemyTotal = enemyCounts.reduce((sum, count) => sum + count, 0);
    const enemyArmor = enemyCounts[T.ARMOR] + enemyCounts[T.MECH_INFANTRY] + enemyCounts[T.ARMOR_INFANTRY];
    if (enemyTotal >= 4 && enemyArmor / enemyTotal >= 0.65) {
        const antiTankCount = Math.min(
            Math.ceil(enemyArmor + 1),
            Math.floor(m * 0.58 / STATS[T.ANTI_TANK].cost)
        );
        for (let index = 0; index < antiTankCount; index++) {
            army.push(createSimUnit(T.ANTI_TANK));
            m -= STATS[T.ANTI_TANK].cost;
        }
        weights[T.ANTI_TANK] += 35;
        weights[T.ARTILLERY] += 14;
        weights[T.RECON] += 8;
    }
    let attempts = 0;
    while(m > 40 && attempts < 50) {
        let bestT = null, maxW = -1;
        for (let t=0; t<9; t++) {
            if (weights[t] > maxW && m >= STATS[t].cost) { maxW = weights[t]; bestT = t; }
        }
        if (bestT !== null) {
            if (bestT === T.ENGINEER && armyCounts[T.ENGINEER] >= 1) {
                weights[T.ENGINEER] = 0;
                attempts++;
                continue;
            }
            army.push(createSimUnit(bestT));
            armyCounts[bestT]++;
            m -= STATS[bestT].cost;
            weights[bestT] *= 0.5;
        }
        attempts++;
    }
    return army;
}

function updateSimEnvironment(unit, allies, enemies, fields) {
    unit.cooldownMs = Math.max(0, unit.cooldownMs - SIM_TICK_MS);
    unit.suppression = Math.max(0, unit.suppression - 18 * SIM_TICK_SECONDS);
    unit.inForest = false;
    for (const terrain of SIM_FORESTS) {
        if (distSq(unit.x, unit.y, terrain.x, terrain.y) < terrain.r * terrain.r) {
            unit.inForest = true;
            break;
        }
    }
    const supplyField = fields.find(field =>
        field.team === unit.team && distSq(unit.x, unit.y, field.x, field.y) < field.r * field.r
    );
    unit.inTrench = Boolean(supplyField);
    unit.armor = unit.baseArmor + (unit.inForest ? 3 : 0) + (unit.inTrench ? 6 : 0);
    if (allies.some(ally => ally !== unit && ally.hp > 0 && ally.type === T.ENGINEER &&
        distSq(unit.x, unit.y, ally.x, ally.y) <= 32400)) {
        unit.armor += 2;
    }
    unit.armor = capUnitArmor(unit.type, unit.armor);

    if (supplyField && unit.ammo < unit.maxAmmo) {
        unit.supplyProgress += 2.1 * SIM_TICK_SECONDS;
        if (unit.supplyProgress >= 1) {
            const rounds = Math.floor(unit.supplyProgress);
            unit.ammo = Math.min(unit.maxAmmo, unit.ammo + rounds);
            unit.supplyProgress -= rounds;
        }
    } else if (!supplyField) {
        unit.supplyProgress = 0;
    }

    if (supplyField && isFieldRepairable(unit.type) && unit.hp < unit.maxHp) {
        unit.hp = Math.min(unit.maxHp, unit.hp + 10.8 * SIM_TICK_SECONDS);
    }

    const visionSq = unit.vision * unit.vision;
    const enemyVisible = enemies.some(enemy => enemy.hp > 0 && distSq(unit.x, unit.y, enemy.x, enemy.y) <= visionSq);
    const hpRatio = unit.hp / Math.max(1, unit.maxHp);
    if (unit.hasFledOnce && hpRatio <= 0.25) {
        unit.lastStandMorale = true;
        unit.isFleeing = false;
    } else if (hpRatio > 0.38) {
        unit.hasFledOnce = false;
        unit.lastStandMorale = false;
    }
    if (!unit.lastStandMorale && hpRatio < 0.3 && enemyVisible) unit.panic += 10 * SIM_TICK_SECONDS;
    else unit.panic -= (enemyVisible ? 5 : 25) * SIM_TICK_SECONDS;
    unit.panic = Math.max(0, Math.min(100, unit.panic));
    if (!unit.lastStandMorale && !unit.isFleeing && unit.panic > 70 && enemyVisible) {
        unit.isFleeing = true;
        unit.hasFledOnce = true;
    } else if (unit.isFleeing && (unit.panic < 35 || unit.lastStandMorale)) unit.isFleeing = false;

    unit.speed = unit.baseSpeed * (unit.inForest ? 0.7 : 1);
    if (!unit.lastStandMorale && unit.panic > 50 && !unit.isFleeing) unit.speed *= 0.7;
    if (unit.suppression > 50) unit.speed *= 0.5;
}

function buildSimFields(army, fields, tick) {
    for (let index = fields.length - 1; index >= 0; index--) {
        if (fields[index].expiresTick && tick >= fields[index].expiresTick) fields.splice(index, 1);
    }
    if (tick < 30) return;
    const team = army[0]?.team;
    if (team === undefined) return;
    if (fields.some(field => field.team === team)) return;
    for (const unit of army) {
        if (unit.hp <= 0 || unit.type !== T.ENGINEER || tick - unit.fieldBuiltAt < 140) continue;
        fields.push({ x: unit.x, y: unit.y, r: 72, team: unit.team, expiresTick: tick + SIM_FIELD_DURATION_TICKS });
        unit.fieldBuilt = true;
        unit.fieldBuiltAt = tick;
        break;
    }
}

function healSimArmy(army) {
    for (const medic of army) {
        if (medic.hp <= 0 || medic.type !== T.MEDIC || medic.cooldownMs > 0) continue;
        let target = null;
        let lowestRatio = 1;
        for (const ally of army) {
            if (ally === medic || ally.hp <= 0 || ally.hp >= ally.maxHp || !isMedicHealable(ally.type)) continue;
            const distanceSq = distSq(ally.x, ally.y, medic.x, medic.y);
            const ratio = ally.hp / ally.maxHp;
            if (distanceSq <= medic.range * medic.range && ratio < lowestRatio) {
                target = ally;
                lowestRatio = ratio;
            }
        }
        if (target) {
            const healAmount = target.type === T.ARMOR_INFANTRY ? 9 : 18;
            target.hp = Math.min(target.maxHp, target.hp + healAmount);
            medic.cooldownMs = medic.atkSpeed;
        }
    }
}

function simHasLineOfSight(attacker, target, allUnits) {
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 0.001) return true;
    for (const blocker of allUnits) {
        if (blocker === attacker || blocker === target || blocker.hp <= 0) continue;
        const projection = ((blocker.x - attacker.x) * dx + (blocker.y - attacker.y) * dy) / lengthSq;
        if (projection <= 0 || projection >= 1) continue;
        const px = attacker.x + projection * dx;
        const py = attacker.y + projection * dy;
        if (distSq(blocker.x, blocker.y, px, py) < SIM_BODY_BLOCK_RADIUS_SQ) return false;
    }
    return true;
}

function createSimLineOfSightChecker(allUnits) {
    const cache = new Map();
    return (attacker, target) => {
        if (attacker.type === T.ARTILLERY) return true;
        const key = attacker.simId < target.simId
            ? `${attacker.simId}:${target.simId}`
            : `${target.simId}:${attacker.simId}`;
        if (!cache.has(key)) cache.set(key, simHasLineOfSight(attacker, target, allUnits));
        return cache.get(key);
    };
}

function simAttackInterval(unit) {
    let interval = unit.atkSpeed;
    if (unit.panic > 50) interval *= 1.5;
    if (unit.suppression > 50) interval *= 1.5;
    return interval;
}

function applySimAttack(attacker, target, targetArmy) {
    if (attacker.ammo <= 0 || attacker.cooldownMs > 0 || attacker.isFleeing) {
        return { damage: 0, rearDamage: 0, killed: false, killedTypes: [], antiArtilleryDamage: 0 };
    }
    const killedTypes = [];
    let antiArtilleryDamage = 0;

    const grantSimKill = (victimType) => {
        killedTypes.push(victimType);
        attacker.kills++;
        if (attacker.kills === 3 && attacker.level === 0) {
            attacker.level = 1; attacker.xpBonus = 1.15; attacker.maxHp *= 1.15; attacker.hp += attacker.maxHp * 0.15;
        } else if (attacker.kills === 7 && attacker.level === 1) {
            attacker.level = 2; attacker.xpBonus = 1.30; attacker.maxHp *= 1.15; attacker.hp += attacker.maxHp * 0.15;
        }
    };

    if (attacker.type === T.ARTILLERY) {
        // TOPÇU: yalnızca geniş alan hasarı (gerçek oyunla birebir aynı)
        let totalDamage = 0;
        const cx = target.x, cy = target.y;
        const splashRadiusSq = ARTILLERY_SPLASH_RADIUS * ARTILLERY_SPLASH_RADIUS;
        for (const foe of targetArmy) {
            if (foe.hp <= 0 || distSq(foe.x, foe.y, cx, cy) > splashRadiusSq) continue;
            const distance = Math.hypot(foe.x - cx, foe.y - cy);
            const falloff = 1 - distance / ARTILLERY_SPLASH_RADIUS;
            const blastDmg = Math.max(1, Math.floor(
                calculateUnitDamage(attacker.type, foe.type, attacker.atk * attacker.xpBonus, foe.armor) *
                (0.5 + falloff * 0.5)
            ));
            const blastActual = Math.min(foe.hp, blastDmg);
            foe.hp -= blastDmg;
            foe.panic = Math.min(100, foe.panic + blastDmg / foe.maxHp * 120);
            foe.suppression += 30;
            totalDamage += blastActual;
            if (foe.type === T.ARTILLERY) antiArtilleryDamage += blastActual;
            if (foe.hp <= 0) grantSimKill(foe.type);
        }
        attacker.ammo--;
        attacker.cooldownMs = simAttackInterval(attacker);
        return { damage: totalDamage, rearDamage: 0, killed: target.hp <= 0, killedTypes, antiArtilleryDamage };
    }

    let damage = calculateUnitDamage(attacker.type, target.type, attacker.atk * attacker.xpBonus, target.armor);
    const angleToTarget = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    let angleDifference = Math.abs(angleToTarget - target.facingAngle);
    while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
    const rearHit = Math.abs(angleDifference) < Math.PI / 3;
    if (rearHit) damage *= 2;
    attacker.facingAngle = angleToTarget;

    const actualDamage = Math.min(target.hp, damage);
    target.hp -= damage;
    const totalDamage = actualDamage;
    const totalRearDamage = rearHit ? actualDamage : 0;
    if (target.type === T.ARTILLERY) antiArtilleryDamage += actualDamage;
    target.panic = Math.min(100, target.panic + damage / target.maxHp * 150);

    if (attacker.type === T.ARMOR) {
        const suppressionRadiusSq = 100 * 100;
        for (const ally of targetArmy) {
            if (ally.hp > 0 && distSq(ally.x, ally.y, target.x, target.y) <= suppressionRadiusSq) {
                ally.suppression += 40;
            }
        }
    } else {
        target.suppression += 15;
    }

    attacker.ammo--;
    attacker.cooldownMs = simAttackInterval(attacker);

    const killed = target.hp <= 0;
    if (killed) grantSimKill(target.type);
    return { damage: totalDamage, rearDamage: totalRearDamage, killed, killedTypes, antiArtilleryDamage };
}

function moveSimUnit(unit, targetX, targetY) {
    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1) return;
    const step = Math.min(length, unit.speed * SIM_MOVE_PER_TICK);
    unit.x += dx / length * step;
    unit.y += dy / length * step;
    unit.facingAngle = Math.atan2(dy, dx);

    for (const terrain of SIM_MOUNTAINS) {
        const mountainDx = unit.x - terrain.x;
        const mountainDy = unit.y - terrain.y;
        const minimum = terrain.r + UNIT_RADIUS;
        const distanceSq = mountainDx * mountainDx + mountainDy * mountainDy;
        if (distanceSq < minimum * minimum) {
            const distance = Math.max(0.01, Math.sqrt(distanceSq));
            unit.x = terrain.x + mountainDx / distance * minimum;
            unit.y = terrain.y + mountainDy / distance * minimum;
        }
    }
    unit.x = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, unit.x));
    unit.y = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, unit.y));
}

function getSimSupplyTarget(unit, fields) {
    if (unit.type === T.MEDIC) return null;
    if (!unit.isResupplying && unit.ammo > Math.max(1, unit.maxAmmo * 0.15)) return null;
    if (unit.isResupplying && unit.ammo >= unit.maxAmmo * 0.8) {
        unit.isResupplying = false;
        return null;
    }
    let nearest = null;
    let bestDistance = Infinity;
    for (const field of fields) {
        if (field.team !== unit.team) continue;
        const distanceSq = distSq(field.x, field.y, unit.x, unit.y);
        if (distanceSq < bestDistance) {
            nearest = field;
            bestDistance = distanceSq;
        }
    }
    if (nearest) unit.isResupplying = true;
    return nearest;
}

function pickSimFocusTarget(enemyArmy, genes) {
    let best = null;
    let bestScore = -Infinity;
    for (const enemy of enemyArmy) {
        if (enemy.hp <= 0) continue;
        const tacticalPower = typeof TacticalAI !== 'undefined'
            ? TacticalAI.CombatMath.unitCombatPower(enemy)
            : STATS[enemy.type].atk;
        let score = STATS[enemy.type].cost * (genes.targetValueWeight ?? 1);
        score += tacticalPower * 0.75 * (genes.targetThreatWeight ?? 1);
        score += (1 - enemy.hp / Math.max(1, enemy.maxHp)) * 1450 *
            Math.max(0.45, genes.focusFire) * Math.min(1.15, genes.finishBias ?? 1);
        if ([T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(enemy.type)) score += 1300 * genes.targetArmorPriority;
        if ([T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(enemy.type)) score += 1700 * genes.targetSupportPriority;
        if (score > bestScore) {
            bestScore = score;
            best = enemy;
        }
    }
    return best;
}

function pickSimTacticalTarget(attacker, enemies, hasSimLos, genes, focusTarget = null) {
    let best = null;
    let bestScore = -Infinity;
    let bestDistanceSq = Infinity;
    const visionSq = attacker.vision * attacker.vision;
    for (const target of enemies) {
        if (target.hp <= 0) continue;
        const distanceSq = distSq(attacker.x, attacker.y, target.x, target.y);
        if (distanceSq > visionSq) continue;
        if (!hasSimLos(attacker, target)) continue;
        const score = typeof TacticalAI !== 'undefined'
            ? TacticalAI.TargetScoring.score(attacker, target, {
                genes,
                focusTarget,
                focusFire: Math.max(0.45, genes.focusFire),
                armorPriority: genes.targetArmorPriority,
                supportPriority: genes.targetSupportPriority,
                lineOfSight: true
            })
            : -Math.sqrt(distanceSq) +
                (1 - target.hp / target.maxHp) * 1200 * genes.focusFire +
                ([T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(target.type) ? 350 * genes.targetArmorPriority : 0) +
                ((target.type === T.ARTILLERY || target.type === T.MEDIC) ? 500 * genes.targetSupportPriority : 0);
        if (score > bestScore) {
            best = target;
            bestScore = score;
            bestDistanceSq = distanceSq;
        }
    }
    return { target: best, score: bestScore, distanceSq: bestDistanceSq };
}

function calculateSimArmyPower(army, enemyArmy) {
    if (typeof TacticalAI !== 'undefined') {
        return TacticalAI.CombatMath.lanchesterPower(army, enemyArmy).square;
    }
    return army.reduce((sum, unit) => {
        if (unit.hp <= 0) return sum;
        return sum + unit.hp * Math.max(1, unit.atk) / Math.max(250, unit.atkSpeed) * (1 + unit.armor * 0.08);
    }, 0);
}

function adjudicateSimDeadlock(myArmy, enemyArmy, initialAiValue, initialEnemyValue, damageDealt, damageTaken) {
    const aiPower = calculateSimArmyPower(myArmy, enemyArmy);
    const enemyPower = calculateSimArmyPower(enemyArmy, myArmy);
    const survivingAiValue = myArmy.reduce((sum, unit) => sum + STATS[unit.type].cost * Math.max(0.15, unit.hp / unit.maxHp), 0);
    const survivingEnemyValue = enemyArmy.reduce((sum, unit) => sum + STATS[unit.type].cost * Math.max(0.15, unit.hp / unit.maxHp), 0);
    const aiValueRatio = survivingAiValue / Math.max(1, initialAiValue);
    const enemyValueRatio = survivingEnemyValue / Math.max(1, initialEnemyValue);
    const damageMargin = (damageDealt - damageTaken) / Math.max(1, initialEnemyValue);
    const powerRatio = aiPower / Math.max(1, enemyPower);
    const valueMargin = aiValueRatio - enemyValueRatio;

    let winner = null;
    if (powerRatio >= 1.22 || (powerRatio >= 1.08 && valueMargin >= 0.12) || damageMargin >= 0.45) {
        winner = 'ai';
    } else if (powerRatio <= 0.82 || (powerRatio <= 0.93 && valueMargin <= -0.12) || damageMargin <= -0.45) {
        winner = 'enemy';
    }

    return {
        winner,
        aiPower,
        enemyPower,
        powerRatio,
        valueMargin,
        damageMargin
    };
}

function classifySimStall(myArmy, enemyArmy, damageWindow, averageDistance, fields) {
    const aiAmmo = myArmy.reduce((sum, unit) => sum + Math.max(0, unit.ammo), 0);
    const aiMaxAmmo = myArmy.reduce((sum, unit) => sum + Math.max(0, unit.maxAmmo), 0);
    const enemyAmmo = enemyArmy.reduce((sum, unit) => sum + Math.max(0, unit.ammo), 0);
    const enemyMaxAmmo = enemyArmy.reduce((sum, unit) => sum + Math.max(0, unit.maxAmmo), 0);
    const aiAmmoRatio = aiAmmo / Math.max(1, aiMaxAmmo);
    const enemyAmmoRatio = enemyAmmo / Math.max(1, enemyMaxAmmo);
    const enemyInFields = enemyArmy.filter(enemy =>
        fields.some(field => field.team === enemy.team && distSq(enemy.x, enemy.y, field.x, field.y) < field.r * field.r)
    ).length;
    const artilleryAlive = enemyArmy.some(unit => unit.type === T.ARTILLERY && unit.hp > 0);

    if (damageWindow <= 0 && aiAmmoRatio < 0.10) return 'mühimmat kilidi';
    if (damageWindow <= 0 && averageDistance > 650) return 'mesafe/görüş kilidi';
    if (enemyInFields >= Math.max(1, enemyArmy.length * 0.45) || artilleryAlive) return 'siper-topçu kilidi';
    if (aiAmmoRatio < 0.20 && enemyAmmoRatio < 0.20) return 'karşılıklı mühimmat bitişi';
    return 'son birlik temizleme';
}

const META_ARMIES = [
    [10, 0, 0, 0, 0, 0, 0, 0, 0], // Sadece Piyade
    [0, 0, 0, 0, 0, 0, 7, 0, 0], // Sadece Tank
    [0, 0, 0, 5, 0, 0, 0, 0, 5], // Keşif + Topçu
    [2, 2, 2, 2, 1, 1, 1, 1, 1], // Dengeli
    [0, 0, 0, 0, 0, 0, 4, 7, 0]  // Tank + Tanksavar
];

// Eğitimde kullanılmayan 8 ordu arketipi, iki farklı dizilimle sınanır.
const VALIDATION_LEAGUE_VERSION = 11;
const VALIDATION_ARCHETYPES = [
    { name: 'Mekanize Hücum', counts: [4, 6, 2, 2, 0, 1, 1, 1, 1] },
    { name: 'Ağır Savunma', counts: [0, 0, 6, 2, 1, 1, 2, 2, 1] },
    { name: 'Avcı Grupları', counts: [3, 2, 0, 5, 1, 1, 1, 4, 1] },
    { name: 'Siper ve Topçu', counts: [6, 0, 2, 0, 3, 2, 2, 0, 2] },
    { name: 'Karma Taarruz', counts: [1, 4, 1, 3, 1, 2, 3, 2, 1] },
    { name: 'Piyade Sürüsü', counts: [18, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: 'Zırhlı Mızrak', counts: [2, 2, 2, 1, 0, 1, 5, 2, 0] },
    { name: 'Hareketli Topçu', counts: [2, 5, 0, 4, 0, 1, 1, 1, 3] }
];
const VALIDATION_SEEDS = [101, 857];
const VALIDATION_LEAGUE = VALIDATION_ARCHETYPES.flatMap((archetype, archetypeIndex) =>
    VALIDATION_SEEDS.map((seed, seedIndex) => ({
        name: `${archetype.name} ${seedIndex + 1}`,
        counts: archetype.counts,
        seed: seed + archetypeIndex * 37
    }))
);
const MAX_SIMULATION_TICKS = 2000;
const DECISIVE_ASSAULT_TICK = 900;
const DECISIVE_IDLE_TICKS = 180;
const EARLY_DEADLOCK_IDLE_TICKS = 260;
const SIM_FIELD_DURATION_TICKS = 600;
const CLEANUP_ENEMY_COUNT = 3;
const CLEANUP_FORCE_RATIO = 1.35;

function simulateSpatialMetaMatch(genome, metaCounts, scenarioSeed = 0, returnDetails = false) {
    let rngState = metaCounts.reduce((seed, count, index) => seed + (index + 17) * (count + 3) * 7919, 123456789 + scenarioSeed * 104729) >>> 0;
    const simRandom = () => {
        rngState = (rngState * 1664525 + 1013904223) >>> 0;
        return rngState / 4294967296;
    };
    let myArmy = generateMockArmy(1500, genome.counterMatrix, metaCounts);
    const initialAiValue = myArmy.reduce((sum, unit) => sum + STATS[unit.type].cost, 0);
    const genes = genome.tacticGenes;
    
    // Genomdaki Deploy(Konum) genlerini askere yükle
    myArmy.forEach(u => {
        let xR = genome.deployMatrix[u.type][0];
        let yR = genome.deployMatrix[u.type][1];
        u.x = 80 + xR * (WORLD_W - 160);
        u.y = 80 + yR * (WORLD_H * 0.35 - 160);
        u.cooldownMs = 0;
        u.team = true;
        u.facingAngle = Math.PI / 2;
    });

    let enemyArmy = [];
    for(let t=0; t<9; t++) {
        for(let i=0; i<metaCounts[t]; i++) {
            // Oyuncu Standart Dizilimi (Rastgele dağılım)
            const unit = createSimUnit(t);
            unit.x = 100 + simRandom() * (WORLD_W - 200);
            unit.y = WORLD_H * 0.68 + simRandom() * (WORLD_H * 0.25);
            unit.team = false;
            unit.facingAngle = -Math.PI / 2;
            enemyArmy.push(unit);
        }
    }
    let nextSimId = 1;
    for (const unit of myArmy) unit.simId = nextSimId++;
    for (const unit of enemyArmy) unit.simId = nextSimId++;
    
    let ticks = 0;
    let simBattlePhase = 1;
    let simPhaseTimer = 0;
    let simDamageDealt = 0;
    let simDamageTaken = 0;
    let simIdleTicks = 0;
    let simConsecutiveIdleTicks = 0;
    let simDeadlockBreak = false;
    let simDecisiveAssault = false;
    let simCleanupMode = false;
    let simCleanupActivations = 0;
    let simRearHitDamageDealt = 0;
    let simRearHitDamageTaken = 0;
    let simAntiArtilleryDamage = 0;
    let simSupportKills = 0;
    let simFieldKills = 0;
    let simLastHuntTicks = 0;
    let lastAverageDistance = Infinity;
    const damageWindow = [];
    const simFields = [];
    const simScoutSpottedTargets = new Set();
    const initialAiReconCount = myArmy.filter(unit => unit.type === T.RECON).length;
    
    while(myArmy.length > 0 && enemyArmy.length > 0 && ticks < MAX_SIMULATION_TICKS) {
        ticks++;
        let damageThisTick = 0;
        buildSimFields(myArmy, simFields, ticks);
        buildSimFields(enemyArmy, simFields, ticks);
        for (const unit of myArmy) updateSimEnvironment(unit, myArmy, enemyArmy, simFields);
        for (const unit of enemyArmy) updateSimEnvironment(unit, enemyArmy, myArmy, simFields);
        healSimArmy(myArmy);
        healSimArmy(enemyArmy);
        for (const scout of myArmy) {
            if (scout.hp <= 0 || scout.type !== T.RECON) continue;
            const visionSq = scout.vision * scout.vision;
            for (const enemy of enemyArmy) {
                if (![T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(enemy.type)) continue;
                if (distSq(scout.x, scout.y, enemy.x, enemy.y) <= visionSq) {
                    simScoutSpottedTargets.add(enemy.simId);
                }
            }
        }
        if (!simDecisiveAssault && ticks > DECISIVE_ASSAULT_TICK && simConsecutiveIdleTicks > DECISIVE_IDLE_TICKS) {
            simDecisiveAssault = true;
            simBattlePhase = 5;
        }
        
        let totalMyHp = 0, maxMyHp = 0;
        let myCx = 0, myCy = 0; myArmy.forEach(u => { myCx += u.x; myCy += u.y; totalMyHp += u.hp; maxMyHp += u.maxHp; }); myCx /= myArmy.length; myCy /= myArmy.length;
        let enCx = 0, enCy = 0; enemyArmy.forEach(u => { enCx += u.x; enCy += u.y; }); enCx /= enemyArmy.length; enCy /= enemyArmy.length;

        // Arama mantığı
        if (enemyArmy.length === 0) { enCx = 150; enCy = WORLD_H / 2; }

        let distanceToEnemySq = distSq(myCx, myCy, enCx, enCy);
        lastAverageDistance = Math.sqrt(distanceToEnemySq);
        let myHpRatio = totalMyHp / Math.max(1, maxMyHp);
        const simCombatAnalysis = typeof TacticalAI !== 'undefined'
            ? TacticalAI.analyzeBattle(myArmy, enemyArmy)
            : { forceRatio: 1 };
        const cleanupShouldActivate = enemyArmy.length <= CLEANUP_ENEMY_COUNT ||
            (simCombatAnalysis.forceRatio > (genes.decisiveForceRatio ?? CLEANUP_FORCE_RATIO) &&
                enemyArmy.length <= Math.max(5, myArmy.length * 0.55)) ||
            (ticks > DECISIVE_ASSAULT_TICK && simConsecutiveIdleTicks > DECISIVE_IDLE_TICKS);
        if (!simCleanupMode && cleanupShouldActivate) {
            simCleanupMode = true;
            simCleanupActivations++;
        }
        if (simCleanupMode && enemyArmy.length <= 2) simLastHuntTicks++;
        
        // Simüle Kanat Ağırlığı
        let enArtyCount = enemyArmy.filter(u => u.type === T.ARTILLERY || u.type === T.ANTI_TANK).length;
        const enemyArtilleryCount = enemyArmy.filter(u => u.type === T.ARTILLERY).length;
        let simTargetFlankRatio = genes.flankRatio;
        if (enArtyCount > enemyArmy.length * 0.25) simTargetFlankRatio += 0.12;
        simTargetFlankRatio = Math.min(0.75, simTargetFlankRatio);

        if (simDecisiveAssault || simCleanupMode) {
            simBattlePhase = 5;
        } else if (myHpRatio < 0.2) { // Simülasyonda iflas kontrolü yerine hep Last Stand yap %20 altındaysa
            simBattlePhase = 5; // LAST STAND
        } else if (myHpRatio < genes.vanguardRetreat + 0.05 && simCombatAnalysis.forceRatio < 1.18) {
            simBattlePhase = 4; // Regroup
        } else if (simBattlePhase === 4 && myHpRatio > 0.7) {
            simBattlePhase = 1;
        } else if (simCombatAnalysis.forceRatio > (genes.decisiveForceRatio ?? 1.35) && distanceToEnemySq < 900 * 900) {
            simBattlePhase = 5;
        } else if (simBattlePhase === 1 && distanceToEnemySq < (600 * genes.vanguardAggression) * (600 * genes.vanguardAggression)) { 
            simBattlePhase = 2; simPhaseTimer = ticks; 
        } else if (simBattlePhase === 2 && ticks - simPhaseTimer > 30) { 
            simBattlePhase = 3; 
        }

        if (simBattlePhase === 4) {
            enCx = WORLD_W / 2;
            enCy = 180;
        }

        let dirX = enCx - myCx, dirY = enCy - myCy;
        let len = Math.max(1, Math.hypot(dirX, dirY)); dirX /= len; dirY /= len;
        let perpX = -dirY, perpY = dirX;

        let vX = myCx, vY = myCy, fX = myCx, fY = myCy, sX = myCx, sY = myCy;
        if (simBattlePhase === 1) {
            vX = myCx + dirX * 100 * genes.vanguardAggression; vY = myCy + dirY * 100 * genes.vanguardAggression;
            fX = vX; fY = vY;
            sX = vX - dirX * 150; sY = vY - dirY * 150;
        } else if (simBattlePhase === 2) {
            vX = enCx; vY = enCy; // DÜŞMANA ÇARP
            fX = enCx + perpX * 300; fY = enCy + perpY * 300;
            sX = enCx - dirX * 250; sY = enCy - dirY * 250;
        } else if (simBattlePhase === 3) {
            vX = enCx; vY = enCy; // Hattı tut
            fX = enCx + dirX * 200; fY = enCy + perpY * 500;
            sX = enCx - dirX * 250; sY = enCy - dirY * 250;
        } else if (simBattlePhase === 4) {
            vX = enCx; vY = enCy;
            fX = enCx + 100; fY = enCy + 100;
            sX = enCx - 100; sY = enCy - 100;
        } else if (simBattlePhase === 5) {
            vX = enCx; vY = enCy;
            const decisiveWidth = simDecisiveAssault || simCleanupMode ? 60 : 150;
            fX = enCx + perpX * decisiveWidth; fY = enCy + perpY * decisiveWidth;
            sX = enCx; sY = enCy;
        }

        // Line Formation Simülasyonu için sayaçlar
        let simVanCount = 0;
        let simFlankCount = 0;
        let simSupCount = 0;

        // Simüle Squad Atamaları
        let simFlankAssigned = 0;
        let simMaxFlank = Math.floor(myArmy.length * simTargetFlankRatio);
        for (const ua of myArmy) {
            if (ua.type === T.MEDIC || ua.type === T.ARTILLERY || ua.type === T.ENGINEER) {
                ua.squad = SQUAD.SUPPORT;
            } else if (ua.type === T.RECON || ua.type === T.MECH_INFANTRY) { 
                ua.squad = SQUAD.FLANK; simFlankAssigned++;
            } else if (simFlankAssigned < simMaxFlank && ua.type !== T.ARMOR_INFANTRY) {
                ua.squad = SQUAD.FLANK; simFlankAssigned++;
            } else {
                ua.squad = SQUAD.VANGUARD;
            }
        }

        // 1. YAPAY ZEKA (MY ARMY)
        const allSimUnits = myArmy.concat(enemyArmy);
        const hasSimLos = createSimLineOfSightChecker(allSimUnits);
        const simEnemyInFields = enemyArmy.filter(enemy =>
            simFields.some(field => field.team === enemy.team && distSq(enemy.x, enemy.y, field.x, field.y) < field.r * field.r)
        ).length;
        const simAntiArtilleryMode = !simCleanupMode && enemyArmy.some(unit => unit.type === T.ARTILLERY);
        const simSiegeBreakMode = !simCleanupMode &&
            (simEnemyInFields >= Math.max(1, enemyArmy.length * 0.30) ||
                enemyArtilleryCount > 0 && enemyArtilleryCount / Math.max(1, enemyArmy.length) > 0.25);
        const simFocusTarget = simAntiArtilleryMode
            ? enemyArmy.find(unit => unit.type === T.ARTILLERY && unit.hp > 0) || pickSimFocusTarget(enemyArmy, genes)
            : simSiegeBreakMode
                ? enemyArmy.find(unit => [T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(unit.type) && unit.hp > 0) || pickSimFocusTarget(enemyArmy, genes)
                : pickSimFocusTarget(enemyArmy, genes);
        const simDecisionStates = typeof TacticalAI !== 'undefined' ? TacticalAI.UNIT_DECISION_STATE : {};
        const simVisibleArmor = enemyArmy.filter(unit =>
            [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(unit.type)
        );
        const simArmorScreenThreat = simVisibleArmor.length >= 2 &&
            simVisibleArmor.length / Math.max(1, enemyArmy.length) >= 0.45;
        const simAntiArmorReady = myArmy.filter(unit =>
            [T.ANTI_TANK, T.ARTILLERY, T.ARMOR].includes(unit.type)
        ).length >= Math.max(1, Math.ceil(simVisibleArmor.length * 0.45));
        for (const ua of myArmy) {
            const roleGenes = getRoleTacticGenes(genes, ua.squad);
            
            const tacticalPick = pickSimTacticalTarget(ua, enemyArmy, hasSimLos, genes, simFocusTarget);
            let nearestEnemy = tacticalPick.target;
            let minDistSq = tacticalPick.distanceSq;
            const decisionState = typeof TacticalAI !== 'undefined'
                ? TacticalAI.DecisionSystems.decideUnitState(ua, {
                    forceRatio: simCombatAnalysis.forceRatio,
                    target: nearestEnemy,
                    genes
                })
                : null;
            
            let tx = vX, ty = vY;
            let squad = ua.squad;
            const simScoutAgainstArmor = !simCleanupMode && ua.type === T.RECON && simArmorScreenThreat && nearestEnemy;
            const simUnitIsAntiArmor = [T.ANTI_TANK, T.ARTILLERY, T.ARMOR].includes(ua.type);
            const simHoldForCounters = !simCleanupMode && simArmorScreenThreat && !simAntiArmorReady && !simUnitIsAntiArmor &&
                ![T.MEDIC, T.ENGINEER].includes(ua.type);
            const simArtilleryTarget = simAntiArtilleryMode
                ? enemyArmy.find(unit => unit.type === T.ARTILLERY && unit.hp > 0) || nearestEnemy
                : null;
            if (squad === SQUAD.FLANK) { 
                let offset = genes.flankWidth; let side = (simFlankCount % 2 === 0) ? 1 : -1;
                tx = fX + perpX * offset * side; ty = fY + perpY * offset * side; 
                simFlankCount++;
            } else if (squad === SQUAD.SUPPORT) { 
                let offset = (simSupCount - Math.floor(myArmy.length*0.3)) * (90 - genes.cohesion * 50) * 0.85;
                tx = sX + perpX * offset; ty = sY + perpY * offset; 
                simSupCount++;
            } else {
                let offset = (simVanCount - Math.floor(myArmy.length*0.5)) * (90 - genes.cohesion * 50);
                tx = vX + perpX * offset; ty = vY + perpY * offset;
                simVanCount++;
            }

            // KITE (Geri Çekilme) / REGROUP
            let hpRatioU = ua.hp / ua.maxHp;
            if (simCleanupMode && enemyArmy.length <= 2 && nearestEnemy && [T.RECON, T.MECH_INFANTRY, T.ARMOR].includes(ua.type)) {
                tx = nearestEnemy.x;
                ty = nearestEnemy.y;
            } else if (simAntiArtilleryMode && simArtilleryTarget && ua.type === T.RECON) {
                const distance = Math.max(1, Math.hypot(ua.x - simArtilleryTarget.x, ua.y - simArtilleryTarget.y));
                const observeDistance = Math.min(ua.vision * 0.72, Math.max(460, simArtilleryTarget.range + 180));
                tx = simArtilleryTarget.x + (ua.x - simArtilleryTarget.x) / distance * observeDistance;
                ty = simArtilleryTarget.y + (ua.y - simArtilleryTarget.y) / distance * observeDistance;
                nearestEnemy = simArtilleryTarget;
                minDistSq = distSq(ua.x, ua.y, nearestEnemy.x, nearestEnemy.y);
            } else if (simAntiArtilleryMode && simArtilleryTarget && [T.RECON, T.MECH_INFANTRY].includes(ua.type)) {
                const side = ua.simId % 2 === 0 ? 1 : -1;
                const dxA = simArtilleryTarget.x - myCx;
                const dyA = simArtilleryTarget.y - myCy;
                const lengthA = Math.max(1, Math.hypot(dxA, dyA));
                tx = simArtilleryTarget.x + (-dyA / lengthA) * side * 240;
                ty = simArtilleryTarget.y + (dxA / lengthA) * side * 240;
                nearestEnemy = simArtilleryTarget;
                minDistSq = distSq(ua.x, ua.y, nearestEnemy.x, nearestEnemy.y);
            } else if (simSiegeBreakMode && nearestEnemy && ![T.ARTILLERY, T.ANTI_TANK, T.ARMOR].includes(ua.type)) {
                tx = vX;
                ty = vY;
            } else if (simScoutAgainstArmor) {
                const distance = Math.max(1, Math.sqrt(minDistSq));
                const observeDistance = Math.min(ua.vision * 0.78, Math.max(420, nearestEnemy.range + 230));
                tx = nearestEnemy.x + (ua.x - nearestEnemy.x) / distance * observeDistance;
                ty = nearestEnemy.y + (ua.y - nearestEnemy.y) / distance * observeDistance;
            } else if (simHoldForCounters) {
                tx = sX;
                ty = sY;
            } else if (ua.isFleeing && !ua.lastStandMorale) {
                tx = WORLD_W / 2;
                ty = 180;
            } else if (simBattlePhase === 4) {
                tx = vX + (simRandom()*100 - 50); ty = vY + (simRandom()*100 - 50);
            } else if (simBattlePhase === 5) {
                // Last stand, don't flee
                if (simCleanupMode && nearestEnemy) {
                    tx = nearestEnemy.x;
                    ty = nearestEnemy.y;
                }
            } else if (!ua.lastStandMorale && hpRatioU < roleGenes.retreat && ua.type !== T.MEDIC) {
                if (squad === SQUAD.FLANK) {
                    tx = ua.x; ty = ua.y; // Hold
                } else {
                    tx = ua.x - dirX * 250; ty = ua.y - dirY * 250; // Ters yöne koş
                }
            } else if (decisionState === simDecisionStates.EXECUTE && nearestEnemy) {
                tx = nearestEnemy.x;
                ty = nearestEnemy.y;
            } else if (decisionState === simDecisionStates.KITE && nearestEnemy && minDistSq < Infinity) {
                const distance = Math.max(1, Math.sqrt(minDistSq));
                tx = ua.x + (ua.x - nearestEnemy.x) / distance * ua.range * 0.45;
                ty = ua.y + (ua.y - nearestEnemy.y) / distance * ua.range * 0.45;
            } else if (squad === SQUAD.VANGUARD && nearestEnemy &&
                minDistSq <= (ua.range * (1.0 + roleGenes.aggression * 0.5)) * (ua.range * (1.0 + roleGenes.aggression * 0.5))) {
                tx = nearestEnemy.x; ty = nearestEnemy.y; // Öncüler kovalar
            }

            const wantsResupply = (simDecisiveAssault || simCleanupMode)
                ? ua.ammo <= 0
                : decisionState === simDecisionStates.RESUPPLY || ua.ammo <= Math.max(1, ua.maxAmmo * 0.15);
            const supplyTarget = wantsResupply
                ? getSimSupplyTarget(ua, simFields)
                : null;
            if (supplyTarget) {
                tx = supplyTarget.x;
                ty = supplyTarget.y;
            }

            const simSpottingOnly = simAntiArtilleryMode && ua.type === T.RECON && nearestEnemy === simArtilleryTarget;
            const simSiegeHolding = simSiegeBreakMode && ![T.ARTILLERY, T.ANTI_TANK, T.ARMOR].includes(ua.type);
            if (!supplyTarget && !ua.isFleeing && !simScoutAgainstArmor && !simHoldForCounters &&
                !simSpottingOnly && !simSiegeHolding && simBattlePhase !== 4 && nearestEnemy &&
                minDistSq <= ua.range * ua.range && ua.type !== T.MEDIC && hasSimLos(ua, nearestEnemy)) {
                const targetInField = simFields.some(field =>
                    field.team === nearestEnemy.team && distSq(nearestEnemy.x, nearestEnemy.y, field.x, field.y) < field.r * field.r
                );
                const hit = applySimAttack(ua, nearestEnemy, enemyArmy);
                simDamageDealt += hit.damage;
                simRearHitDamageDealt += hit.rearDamage;
                simAntiArtilleryDamage += hit.antiArtilleryDamage || 0;
                simSupportKills += (hit.killedTypes || []).filter(type => [T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(type)).length;
                if (targetInField && hit.killed) simFieldKills++;
                damageThisTick += hit.damage;
                // Kite/infaz dışında menzilde kal.
                if (hpRatioU >= roleGenes.retreat &&
                    decisionState !== simDecisionStates.KITE &&
                    decisionState !== simDecisionStates.EXECUTE) {
                    tx = ua.x;
                    ty = ua.y;
                }
            }

            if (typeof TacticalAI !== 'undefined') {
                const steered = TacticalAI.SteeringBehaviors.steerPoint(ua, { x: tx, y: ty }, myArmy, enemyArmy, {
                    separationRadius: simBattlePhase === 5 ? 72 : 92,
                    separationWeight: (simBattlePhase === 5 ? 60 : 125) * (genes.steeringSeparation ?? 1),
                    threatWeight: (simBattlePhase === 5 ? 10 : 60) * (genes.threatAvoidance ?? 1),
                    terrainWeight: 250,
                    maxStep: simBattlePhase === 5 ? 240 : 180
                });
                tx = steered.x;
                ty = steered.y;
            }
            moveSimUnit(ua, tx, ty);
        }
        enemyArmy = enemyArmy.filter(u => u.hp > 0);
        if (enemyArmy.length === 0) break;
        
        // 2. OYUNCU TEMSİLCİSİ (ENEMY ARMY) - Basit Attack Move
        for (const ub of enemyArmy) {
            let nearestAI = null, minDistSq = Infinity;
            const visionSq = ub.vision * ub.vision;
            for(const ta of myArmy) {
                if (ta.hp <= 0) continue;
                let dSq = distSq(ub.x, ub.y, ta.x, ta.y);
                if (dSq < minDistSq && dSq <= visionSq && hasSimLos(ub, ta)) {
                    minDistSq = dSq;
                    nearestAI = ta;
                }
            }
            
            let tx = myCx, ty = myCy;
            if (ub.isFleeing && !ub.lastStandMorale) {
                tx = WORLD_W / 2;
                ty = WORLD_H - 180;
            } else if (nearestAI) {
                tx = nearestAI.x; ty = nearestAI.y;
                if (minDistSq <= ub.range * ub.range && ub.type !== T.MEDIC && hasSimLos(ub, nearestAI)) {
                    const hit = applySimAttack(ub, nearestAI, myArmy);
                    simDamageTaken += hit.damage;
                    simRearHitDamageTaken += hit.rearDamage;
                    damageThisTick += hit.damage;
                    tx = ub.x; ty = ub.y; // Dur
                }
            }
            const allowEnemyResupply = !simDecisiveAssault && !simCleanupMode || ub.ammo <= 0;
            const supplyTarget = allowEnemyResupply ? getSimSupplyTarget(ub, simFields) : null;
            if (supplyTarget) {
                tx = supplyTarget.x;
                ty = supplyTarget.y;
            }
            moveSimUnit(ub, tx, ty);
        }
        if (damageThisTick === 0) {
            simIdleTicks++;
            simConsecutiveIdleTicks++;
        } else {
            simConsecutiveIdleTicks = 0;
        }
        damageWindow.push(damageThisTick);
        if (damageWindow.length > 300) damageWindow.shift();
        if (ticks > DECISIVE_ASSAULT_TICK && simConsecutiveIdleTicks > EARLY_DEADLOCK_IDLE_TICKS && myArmy.length > 0 && enemyArmy.length > 0) {
            simDeadlockBreak = true;
            break;
        }
        myArmy = myArmy.filter(u => u.hp > 0);
    }

    const initialEnemyValue = metaCounts.reduce((sum, count, type) => sum + count * STATS[type].cost, 0);
    const survivingEnemyValue = enemyArmy.reduce((sum, unit) => sum + STATS[unit.type].cost, 0);
    const survivingAiValue = myArmy.reduce((sum, unit) => sum + STATS[unit.type].cost, 0);
    const scoutDeaths = Math.max(0, initialAiReconCount - myArmy.filter(unit => unit.type === T.RECON).length);
    const needsAdjudication = myArmy.length > 0 && enemyArmy.length > 0 &&
        (simDeadlockBreak || ticks >= MAX_SIMULATION_TICKS);
    const physicalFinish = !needsAdjudication && (myArmy.length === 0 || enemyArmy.length === 0);
    const damageWindowTotal = damageWindow.reduce((sum, damage) => sum + damage, 0);
    const stallReason = needsAdjudication
        ? classifySimStall(myArmy, enemyArmy, damageWindowTotal, lastAverageDistance, simFields)
        : null;
    const adjudication = needsAdjudication
        ? adjudicateSimDeadlock(myArmy, enemyArmy, initialAiValue, initialEnemyValue, simDamageDealt, simDamageTaken)
        : null;
    const adjudicatedAiWin = adjudication?.winner === 'ai';
    const adjudicatedAiLoss = adjudication?.winner === 'enemy';

    const metrics = {
        damageDealt: simDamageDealt,
        damageTaken: simDamageTaken,
        enemyValueDestroyed: initialEnemyValue - survivingEnemyValue,
        aiValueLost: initialAiValue - survivingAiValue,
        rearHitDamage: simRearHitDamageDealt,
        rearHitDamageTaken: simRearHitDamageTaken,
        durationSeconds: ticks / 10,
        idleSeconds: simIdleTicks / 10,
        aiWon: (enemyArmy.length === 0 && myArmy.length > 0) || adjudicatedAiWin,
        aiLost: (myArmy.length === 0 && enemyArmy.length > 0) || adjudicatedAiLoss,
        deadlock: needsAdjudication && !adjudication?.winner,
        adjudicated: Boolean(adjudication?.winner),
        adjudication,
        physicalFinish,
        cleanupActivated: simCleanupMode,
        cleanupActivations: simCleanupActivations,
        scoutValuableSpots: simScoutSpottedTargets.size,
        scoutDeaths,
        antiArtilleryDamage: simAntiArtilleryDamage,
        supportKills: simSupportKills,
        fieldKills: simFieldKills,
        lastHuntSeconds: simLastHuntTicks / 10,
        stallReason
    };
    metrics.score = calculateTacticalReward(metrics);
    metrics.damageEfficiency = metrics.damageDealt / Math.max(1, metrics.damageTaken);
    return returnDetails ? metrics : metrics.score;
}


function evaluateLeague(genome, scenarios) {
    const summary = {
        matches: scenarios.length,
        totalScore: 0,
        averageScore: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        deadlocks: 0,
        winRate: 0,
        damageDealt: 0,
        damageTaken: 0,
        damageEfficiency: 0,
        averageDuration: 0,
        adjudicated: 0,
        physicalFinishes: 0,
        cleanupMatches: 0,
        cleanupActivations: 0,
        scoutValuableSpots: 0,
        scoutDeaths: 0,
        antiArtilleryDamage: 0,
        supportKills: 0,
        fieldKills: 0,
        lastHuntSeconds: 0,
        stallReasons: {},
        worstMatch: null,
        matchResults: [],
        armoredSpearWins: 0
    };

    scenarios.forEach((scenario, index) => {
        const counts = Array.isArray(scenario) ? scenario : scenario.counts;
        const seed = Array.isArray(scenario) ? index + 1 : scenario.seed;
        const result = simulateSpatialMetaMatch(genome, counts, seed, true);
        summary.totalScore += result.score;
        summary.damageDealt += result.damageDealt;
        summary.damageTaken += result.damageTaken;
        summary.averageDuration += result.durationSeconds;
        if (result.aiWon) summary.wins++;
        else if (result.aiLost) summary.losses++;
        else summary.draws++;
        if (result.deadlock) summary.deadlocks++;
        if (result.adjudicated) summary.adjudicated++;
        if (result.physicalFinish) summary.physicalFinishes++;
        if (result.cleanupActivated) summary.cleanupMatches++;
        summary.cleanupActivations += result.cleanupActivations || 0;
        summary.scoutValuableSpots += result.scoutValuableSpots || 0;
        summary.scoutDeaths += result.scoutDeaths || 0;
        summary.antiArtilleryDamage += result.antiArtilleryDamage || 0;
        summary.supportKills += result.supportKills || 0;
        summary.fieldKills += result.fieldKills || 0;
        summary.lastHuntSeconds += result.lastHuntSeconds || 0;
        if (result.stallReason) {
            summary.stallReasons[result.stallReason] = (summary.stallReasons[result.stallReason] || 0) + 1;
        }
        const matchSummary = {
            name: Array.isArray(scenario) ? `Eğitim ${index + 1}` : scenario.name,
            score: result.score,
            won: result.aiWon,
            lost: result.aiLost,
            deadlock: result.deadlock,
            adjudicated: result.adjudicated,
            adjudication: result.adjudication,
            physicalFinish: result.physicalFinish,
            cleanupActivated: result.cleanupActivated,
            scoutValuableSpots: result.scoutValuableSpots,
            scoutDeaths: result.scoutDeaths,
            antiArtilleryDamage: result.antiArtilleryDamage,
            supportKills: result.supportKills,
            fieldKills: result.fieldKills,
            lastHuntSeconds: result.lastHuntSeconds,
            stallReason: result.stallReason,
            damageEfficiency: result.damageEfficiency,
            durationSeconds: result.durationSeconds
        };
        if (!summary.worstMatch || matchSummary.score < summary.worstMatch.score) {
            summary.worstMatch = matchSummary;
        }
        summary.matchResults.push(matchSummary);
        if (matchSummary.name.startsWith('Zırhlı Mızrak') && matchSummary.won) summary.armoredSpearWins++;
    });

    summary.averageScore = summary.totalScore / Math.max(1, summary.matches);
    summary.winRate = summary.wins / Math.max(1, summary.matches);
    summary.damageEfficiency = summary.damageDealt / Math.max(1, summary.damageTaken);
    summary.averageDuration /= Math.max(1, summary.matches);
    return summary;
}

const SCOUT_MATCHES_PER_CANDIDATE = 2;

function getScoutScenarios(epoch, familyIndex) {
    const scenarios = [];
    for (let index = 0; index < SCOUT_MATCHES_PER_CANDIDATE; index++) {
        const scenarioIndex = (epoch + familyIndex * 2 + index * 3) % META_ARMIES.length;
        scenarios.push({
            name: `Hızlı Eleme ${scenarioIndex + 1}`,
            counts: META_ARMIES[scenarioIndex],
            seed: 3000 + epoch * 11 + familyIndex * 37 + index
        });
    }
    return scenarios;
}

function evaluateGenome(genome) {
    return evaluateLeague(genome, META_ARMIES).totalScore;
}

function validationPassed(champion, challenger) {
    champion.physicalFinishes ??= 0;
    challenger.physicalFinishes ??= 0;
    champion.adjudicated ??= 0;
    challenger.adjudicated ??= 0;
    const cleanWinImprovement = challenger.wins > champion.wins &&
        challenger.losses <= champion.losses &&
        challenger.deadlocks <= champion.deadlocks &&
        challenger.totalScore >= champion.totalScore * 0.82;
    const lossReduction = challenger.losses < champion.losses &&
        challenger.winRate >= champion.winRate &&
        challenger.deadlocks <= champion.deadlocks + 1 &&
        challenger.totalScore >= champion.totalScore * 0.78;
    const deadlockBreakthrough = challenger.deadlocks <= Math.max(0, champion.deadlocks - 3) &&
        challenger.winRate >= Math.max(0, champion.winRate - 0.08) &&
        challenger.totalScore > champion.totalScore * 0.92;
    const finishBreakthrough = challenger.adjudicated <= Math.max(0, champion.adjudicated - 3) &&
        challenger.physicalFinishes >= champion.physicalFinishes &&
        challenger.winRate >= Math.max(0, champion.winRate - 0.08) &&
        challenger.totalScore > champion.totalScore * 0.88;
    const physicalBreakthrough = challenger.physicalFinishes >= champion.physicalFinishes + 3 &&
        challenger.losses <= champion.losses + 1 &&
        challenger.totalScore > champion.totalScore * 0.86;
    const speedBreakthrough = challenger.averageDuration <= champion.averageDuration * 0.78 &&
        challenger.deadlocks < champion.deadlocks &&
        challenger.damageEfficiency >= champion.damageEfficiency * 1.03 &&
        challenger.totalScore > champion.totalScore * 0.95;
    const noCriticalRegression = challenger.winRate >= champion.winRate &&
        challenger.deadlocks <= champion.deadlocks &&
        challenger.adjudicated <= champion.adjudicated + 1 &&
        challenger.physicalFinishes >= champion.physicalFinishes - 1 &&
        challenger.armoredSpearWins >= champion.armoredSpearWins &&
        challenger.damageEfficiency >= champion.damageEfficiency * 0.95 &&
        challenger.averageDuration <= champion.averageDuration * 1.08;
    const meaningfulImprovement = challenger.winRate > champion.winRate ||
        challenger.armoredSpearWins > champion.armoredSpearWins ||
        challenger.physicalFinishes > champion.physicalFinishes ||
        challenger.adjudicated < champion.adjudicated ||
        challenger.totalScore > champion.totalScore;
    return (noCriticalRegression && meaningfulImprovement) || cleanWinImprovement || lossReduction ||
        deadlockBreakthrough || finishBreakthrough || physicalBreakthrough || speedBreakthrough;
}

function validationDominatesChampion(champion, challenger) {
    return challenger.wins > champion.wins &&
        challenger.losses <= champion.losses &&
        challenger.deadlocks <= champion.deadlocks &&
        challenger.winRate >= champion.winRate &&
        challenger.totalScore >= champion.totalScore * 0.78;
}

function trainingGatePassed(trainingChampion, trainingChallenger, validationChampion, validationChallenger) {
    validationChampion.physicalFinishes ??= 0;
    validationChallenger.physicalFinishes ??= 0;
    validationChampion.adjudicated ??= 0;
    validationChallenger.adjudicated ??= 0;
    const withinRegressionBudget = trainingChallenger.totalScore >= trainingChampion.totalScore * 0.97;
    const validationBreakthrough = validationChallenger.winRate > validationChampion.winRate ||
        validationChallenger.armoredSpearWins > validationChampion.armoredSpearWins ||
        validationChallenger.deadlocks <= Math.max(0, validationChampion.deadlocks - 3) ||
        validationChallenger.adjudicated <= Math.max(0, validationChampion.adjudicated - 3) ||
        validationChallenger.physicalFinishes > validationChampion.physicalFinishes;
    return withinRegressionBudget || validationBreakthrough;
}

function compactLeagueSummary(summary) {
    return {
        matches: summary.matches,
        totalScore: summary.totalScore,
        averageScore: summary.averageScore,
        wins: summary.wins,
        losses: summary.losses,
        draws: summary.draws,
        deadlocks: summary.deadlocks,
        winRate: summary.winRate,
        damageEfficiency: summary.damageEfficiency,
        averageDuration: summary.averageDuration,
        adjudicated: summary.adjudicated,
        physicalFinishes: summary.physicalFinishes,
        cleanupMatches: summary.cleanupMatches,
        cleanupActivations: summary.cleanupActivations,
        scoutValuableSpots: summary.scoutValuableSpots,
        scoutDeaths: summary.scoutDeaths,
        antiArtilleryDamage: summary.antiArtilleryDamage,
        supportKills: summary.supportKills,
        fieldKills: summary.fieldKills,
        lastHuntSeconds: summary.lastHuntSeconds,
        stallReasons: { ...summary.stallReasons },
        worstMatch: summary.worstMatch,
        armoredSpearWins: summary.armoredSpearWins
    };
}

function compareFamilyChampions(a, b) {
    if (a.validation.deadlocks !== b.validation.deadlocks) return a.validation.deadlocks - b.validation.deadlocks;
    if ((a.validation.adjudicated ?? 0) !== (b.validation.adjudicated ?? 0)) return (a.validation.adjudicated ?? 0) - (b.validation.adjudicated ?? 0);
    if ((a.validation.physicalFinishes ?? 0) !== (b.validation.physicalFinishes ?? 0)) return (b.validation.physicalFinishes ?? 0) - (a.validation.physicalFinishes ?? 0);
    if (a.validation.winRate !== b.validation.winRate) return b.validation.winRate - a.validation.winRate;
    return b.validation.totalScore - a.validation.totalScore;
}

function insertFamilyChampion(familyArchive, candidateEntry) {
    const champions = familyArchive?.champions ? [...familyArchive.champions] : [];
    champions.push(candidateEntry);
    champions.sort(compareFamilyChampions);
    const retained = champions.slice(0, 2);
    const inserted = retained.includes(candidateEntry);
    return { inserted, archive: { champions: retained } };
}

function summarizeChampionArchive(archive) {
    return TACTIC_FAMILIES.map(family => {
        const familyArchive = archive.families[family.id];
        const entry = familyArchive?.champions?.[0];
        return entry ? {
            id: family.id,
            name: family.name,
            validation: entry.validation,
            training: entry.training,
            updatedAt: entry.updatedAt,
            championCount: familyArchive.champions.length,
            runnerUpValidation: familyArchive.champions[1]?.validation || null
        } : { id: family.id, name: family.name, validation: null, training: null };
    });
}

function loadHallOfFame() {
    try {
        const saved = JSON.parse(localStorage.getItem(HALL_OF_FAME_KEY));
        if (saved && saved.version === 1 && saved.validationLeagueVersion === VALIDATION_LEAGUE_VERSION && Array.isArray(saved.champions)) {
            return saved;
        }
    } catch (error) {
        console.warn('Şampiyonlar Salonu okunamadı.', error);
    }
    return { version: 1, validationLeagueVersion: VALIDATION_LEAGUE_VERSION, champions: [] };
}

function saveHallOfFame(hall) {
    try {
        localStorage.setItem(HALL_OF_FAME_KEY, JSON.stringify(hall));
    } catch (error) {
        console.warn('Şampiyonlar Salonu kaydedilemedi.', error);
    }
}

function insertHallOfFame(hall, genome, validationSummary) {
    const signature = JSON.stringify(genome);
    const exists = hall.champions.some(entry => entry.signature === signature);
    if (!exists) {
        hall.champions.push({
            signature,
            genome: cloneGenome(genome),
            validation: compactLeagueSummary(validationSummary),
            addedAt: new Date().toISOString()
        });
    }
    hall.champions.sort((a, b) =>
        b.validation.winRate - a.validation.winRate ||
        (b.validation.physicalFinishes ?? 0) - (a.validation.physicalFinishes ?? 0) ||
        (a.validation.adjudicated ?? 0) - (b.validation.adjudicated ?? 0) ||
        b.validation.armoredSpearWins - a.validation.armoredSpearWins ||
        b.validation.totalScore - a.validation.totalScore
    );
    hall.champions = hall.champions.slice(0, 6);
    return hall;
}

function genomeArmyCounts(genome, referenceCounts) {
    const army = generateMockArmy(1500, genome.counterMatrix, referenceCounts);
    const counts = new Array(9).fill(0);
    for (const unit of army) counts[unit.type]++;
    return counts;
}

function evaluateHallChallenge(genome, hall) {
    const probeArmy = [2, 2, 2, 2, 1, 1, 2, 2, 2];
    const result = { opponents: hall.champions.length, wins: 0, losses: 0, draws: 0, totalMargin: 0 };
    hall.champions.forEach((entry, index) => {
        const archivedCounts = genomeArmyCounts(entry.genome, probeArmy);
        const candidateCounts = genomeArmyCounts(genome, probeArmy);
        const candidateScore = simulateSpatialMetaMatch(genome, archivedCounts, 5000 + index * 17);
        const archivedScore = simulateSpatialMetaMatch(entry.genome, candidateCounts, 7000 + index * 19);
        const margin = candidateScore - archivedScore;
        result.totalMargin += margin;
        if (margin > 1) result.wins++;
        else if (margin < -1) result.losses++;
        else result.draws++;
    });
    return result;
}

function hallChallengePassed(championResult, challengerResult, validationChampion = null, validationChallenger = null) {
    if (challengerResult.opponents === 0) return true;
    if (validationChampion && validationChallenger &&
        validationDominatesChampion(validationChampion, validationChallenger)) {
        return true;
    }
    return challengerResult.wins >= championResult.wins &&
        challengerResult.losses <= championResult.losses &&
        challengerResult.totalMargin >= championResult.totalMargin * 0.85;
}

document.getElementById('train-ai-btn').addEventListener('click', () => {
    document.getElementById('train-ai-btn').textContent = "🧠 AI Eğit (500 Maç)";
    document.getElementById('ai-training-screen').classList.remove('hidden');
    let epoch = 0;
    const TOTAL_EPOCHS = 500;
    const championArchive = loadChampionArchive();
    const hallOfFame = loadHallOfFame();
    let trainingChampion = evaluateLeague(aiGenome, META_ARMIES);
    let validationChampion = evaluateLeague(aiGenome, VALIDATION_LEAGUE);
    insertHallOfFame(hallOfFame, aiGenome, validationChampion);
    saveHallOfFame(hallOfFame);
    let hallChampion = evaluateHallChallenge(aiGenome, hallOfFame);
    const baselineHall = { ...hallChampion };
    const baselineTraining = compactLeagueSummary(trainingChampion);
    const baselineValidation = compactLeagueSummary(validationChampion);
    let acceptedMutations = 0;
    let trainingQualifiedMutations = 0;
    let gateRejectedMutations = 0;
    let validationRejectedMutations = 0;
    let scoutRejectedMutations = 0;
    let stagnationEpochs = 0;
    let maxStagnationEpochs = 0;
    let adaptiveMutationAttempts = 0;
    let generationsRun = 0;
    let familyArchiveUpdates = 0;
    let crossoverCandidates = 0;
    let crossoverAccepted = 0;
    let hallRejectedMutations = 0;
    let hallBypassAccepted = 0;
    const familyUpdateCounts = Object.fromEntries(TACTIC_FAMILIES.map(family => [family.id, 0]));
    const rejectionReasons = { scout: 0, gate: 0, validation: 0, hall: 0 };
    let bestRejectedCandidate = null;

    function rememberRejectedCandidate(reason, genome, training, validation = null, scout = null, hall = null) {
        const diagnostic = {
            reason,
            training: compactLeagueSummary(training),
            validation: validation ? compactLeagueSummary(validation) : null,
            scout: scout ? compactLeagueSummary(scout) : null,
            hall,
            tacticGenes: { ...normalizeTacticGenes(genome.tacticGenes) }
        };
        diagnostic.rankScore = (diagnostic.validation?.totalScore ?? diagnostic.training.totalScore) +
            (diagnostic.validation?.winRate ?? diagnostic.training.winRate) * 3500 -
            (diagnostic.validation?.deadlocks ?? diagnostic.training.deadlocks) * 800;
        if (!bestRejectedCandidate || diagnostic.rankScore > bestRejectedCandidate.rankScore) {
            bestRejectedCandidate = diagnostic;
        }
    }

    function runGeneration() {
        const familyWinners = [];
        let archiveChanged = false;

        for (let familyIndex = 0; familyIndex < TACTIC_FAMILIES.length; familyIndex++) {
            const family = TACTIC_FAMILIES[familyIndex];
            const archivedChampions = championArchive.families[family.id]?.champions || [];
            const parentGenome = archivedChampions.length > 0
                ? archivedChampions[Math.floor(Math.random() * archivedChampions.length)].genome
                : aiGenome;
            let familyWinner = null;

            for (let member = 0; member < FAMILY_POPULATION_SIZE && epoch < TOTAL_EPOCHS; member++) {
                const mutationProfile = getAdaptiveMutationProfile(stagnationEpochs);
                if (mutationProfile.scale > 1) adaptiveMutationAttempts++;
                const candidateGenome = mutateGenome(parentGenome, mutationProfile, family);
                const candidateScout = evaluateLeague(candidateGenome, getScoutScenarios(epoch, familyIndex));

                if (!familyWinner || candidateScout.averageScore > familyWinner.scout.averageScore) {
                    familyWinner = { family, genome: candidateGenome, scout: candidateScout };
                }

                epoch++;
                stagnationEpochs++;
                maxStagnationEpochs = Math.max(maxStagnationEpochs, stagnationEpochs);
            }

            if (familyWinner) {
                familyWinner.training = evaluateLeague(familyWinner.genome, META_ARMIES);
                familyWinners.push(familyWinner);
            }
        }

        for (const winner of familyWinners) {
            const explorationPass = stagnationEpochs > 1200 && Math.random() < 0.16;
            const trainingLooksPromising =
                winner.training.totalScore >= trainingChampion.totalScore * 0.90 ||
                winner.training.winRate > trainingChampion.winRate ||
                winner.training.deadlocks < trainingChampion.deadlocks ||
                winner.training.averageDuration < trainingChampion.averageDuration * 0.88 ||
                winner.scout.averageScore >= trainingChampion.averageScore * 0.92 ||
                explorationPass;
            if (!trainingLooksPromising) {
                scoutRejectedMutations++;
                rejectionReasons.scout++;
                rememberRejectedCandidate('ön eleme', winner.genome, winner.training, null, winner.scout);
                continue;
            }
            const winnerValidation = evaluateLeague(winner.genome, VALIDATION_LEAGUE);
            const candidateEntry = {
                    familyId: winner.family.id,
                    familyName: winner.family.name,
                    genome: cloneGenome(winner.genome),
                    training: compactLeagueSummary(winner.training),
                    validation: compactLeagueSummary(winnerValidation),
                    updatedAt: new Date().toISOString()
            };
            const archiveResult = insertFamilyChampion(championArchive.families[winner.family.id], candidateEntry);

            if (archiveResult.inserted) {
                championArchive.families[winner.family.id] = archiveResult.archive;
                familyArchiveUpdates++;
                familyUpdateCounts[winner.family.id]++;
                archiveChanged = true;
            }

            if (trainingGatePassed(trainingChampion, winner.training, validationChampion, winnerValidation)) {
                trainingQualifiedMutations++;
                if (validationPassed(validationChampion, winnerValidation)) {
                    const winnerHall = evaluateHallChallenge(winner.genome, hallOfFame);
                    const hallBypass = validationDominatesChampion(validationChampion, winnerValidation);
                    if (hallChallengePassed(hallChampion, winnerHall, validationChampion, winnerValidation)) {
                        insertHallOfFame(hallOfFame, aiGenome, validationChampion);
                        aiGenome = cloneGenome(winner.genome);
                        trainingChampion = winner.training;
                        validationChampion = winnerValidation;
                        insertHallOfFame(hallOfFame, aiGenome, validationChampion);
                        hallChampion = evaluateHallChallenge(aiGenome, hallOfFame);
                        acceptedMutations++;
                        if (hallBypass) hallBypassAccepted++;
                        stagnationEpochs = 0;
                        localStorage.setItem(GENOME_KEY, JSON.stringify(aiGenome));
                        saveHallOfFame(hallOfFame);
                    } else {
                        hallRejectedMutations++;
                        rejectionReasons.hall++;
                        rememberRejectedCandidate('şampiyonlar salonu', winner.genome, winner.training, winnerValidation, winner.scout, winnerHall);
                    }
                } else {
                    validationRejectedMutations++;
                    rejectionReasons.validation++;
                    rememberRejectedCandidate('doğrulama ligi', winner.genome, winner.training, winnerValidation, winner.scout);
                }
            } else {
                gateRejectedMutations++;
                rejectionReasons.gate++;
                rememberRejectedCandidate('eğitim kapısı', winner.genome, winner.training, winnerValidation, winner.scout);
            }
        }

        const winnerByFamily = Object.fromEntries(familyWinners.map(winner => [winner.family.id, winner]));
        for (const [familyAId, familyBId] of CROSSOVER_PAIRS) {
            if (epoch >= TOTAL_EPOCHS) break;
            const parentA = winnerByFamily[familyAId]?.genome || championArchive.families[familyAId]?.champions?.[0]?.genome || aiGenome;
            const parentB = winnerByFamily[familyBId]?.genome || championArchive.families[familyBId]?.champions?.[0]?.genome || aiGenome;
            const mutationProfile = getAdaptiveMutationProfile(stagnationEpochs);
            if (mutationProfile.scale > 1) adaptiveMutationAttempts++;
            const crossedGenome = crossoverGenomes(parentA, parentB);
            const hybridGenome = mutateGenome(crossedGenome, {
                ...mutationProfile,
                scale: Math.max(0.65, mutationProfile.scale * 0.65),
                bonusMutations: Math.max(0, mutationProfile.bonusMutations - 1)
            });
            const hybridScout = evaluateLeague(hybridGenome, getScoutScenarios(epoch, familyAId.charCodeAt(0) + familyBId.charCodeAt(0)));
            const hybridExplorationPass = stagnationEpochs > 1600 && Math.random() < 0.20;
            const hybridLooksPromising =
                hybridScout.averageScore >= trainingChampion.averageScore * 0.84 ||
                hybridScout.winRate > trainingChampion.winRate ||
                hybridExplorationPass;
            crossoverCandidates++;
            epoch++;
            stagnationEpochs++;
            maxStagnationEpochs = Math.max(maxStagnationEpochs, stagnationEpochs);
            if (!hybridLooksPromising) {
                scoutRejectedMutations++;
                rejectionReasons.scout++;
                rememberRejectedCandidate('çapraz ön eleme', hybridGenome, hybridScout, null, hybridScout);
                continue;
            }
            const hybridTraining = evaluateLeague(hybridGenome, META_ARMIES);
            const hybridNeedsValidation =
                hybridTraining.totalScore >= trainingChampion.totalScore * 0.90 ||
                hybridTraining.winRate > trainingChampion.winRate ||
                hybridTraining.deadlocks < trainingChampion.deadlocks ||
                hybridTraining.averageDuration < trainingChampion.averageDuration * 0.88 ||
                hybridExplorationPass;
            if (!hybridNeedsValidation) {
                scoutRejectedMutations++;
                rejectionReasons.scout++;
                rememberRejectedCandidate('çapraz eğitim ön eleme', hybridGenome, hybridTraining, null, hybridScout);
                continue;
            }
            const hybridValidation = evaluateLeague(hybridGenome, VALIDATION_LEAGUE);

            if (trainingGatePassed(trainingChampion, hybridTraining, validationChampion, hybridValidation)) {
                trainingQualifiedMutations++;
                if (validationPassed(validationChampion, hybridValidation)) {
                    const hybridHall = evaluateHallChallenge(hybridGenome, hallOfFame);
                    const hallBypass = validationDominatesChampion(validationChampion, hybridValidation);
                    if (hallChallengePassed(hallChampion, hybridHall, validationChampion, hybridValidation)) {
                        insertHallOfFame(hallOfFame, aiGenome, validationChampion);
                        aiGenome = cloneGenome(hybridGenome);
                        trainingChampion = hybridTraining;
                        validationChampion = hybridValidation;
                        insertHallOfFame(hallOfFame, aiGenome, validationChampion);
                        hallChampion = evaluateHallChallenge(aiGenome, hallOfFame);
                        acceptedMutations++;
                        crossoverAccepted++;
                        if (hallBypass) hallBypassAccepted++;
                        stagnationEpochs = 0;
                        localStorage.setItem(GENOME_KEY, JSON.stringify(aiGenome));
                        saveHallOfFame(hallOfFame);
                    } else {
                        hallRejectedMutations++;
                        rejectionReasons.hall++;
                        rememberRejectedCandidate('çapraz şampiyonlar salonu', hybridGenome, hybridTraining, hybridValidation, hybridScout, hybridHall);
                    }
                } else {
                    validationRejectedMutations++;
                    rejectionReasons.validation++;
                    rememberRejectedCandidate('çapraz doğrulama ligi', hybridGenome, hybridTraining, hybridValidation, hybridScout);
                }
            } else {
                gateRejectedMutations++;
                rejectionReasons.gate++;
                rememberRejectedCandidate('çapraz eğitim kapısı', hybridGenome, hybridTraining, hybridValidation, hybridScout);
            }
        }

        championArchive.generation++;
        generationsRun++;
        if (archiveChanged) saveChampionArchive(championArchive);

        const pct = (epoch / TOTAL_EPOCHS) * 100;
        document.getElementById('train-progress-bar').style.width = pct + '%';
        document.getElementById('train-progress-text').textContent =
            `%${pct.toFixed(1)} (${epoch} / ${TOTAL_EPOCHS}) | ` +
            `Nesil: ${generationsRun} | ` +
            `Eğitim: ${Math.round(trainingChampion.averageScore)} | ` +
            `Lig: %${Math.round(validationChampion.winRate * 100)} | ` +
            `Mutasyon: ${getAdaptiveMutationProfile(stagnationEpochs).level}`;

        if (epoch < TOTAL_EPOCHS) {
            requestAnimationFrame(runGeneration);
        } else {
            const archiveSummary = summarizeChampionArchive(championArchive);
            const rankedFamilies = archiveSummary
                .filter(entry => entry.validation)
                .sort((a, b) => b.validation.totalScore - a.validation.totalScore);
            const report = {
            version: 19,
            physicsModel: 'live-parity-v1-realistic-fire-rate-armor-wall-pressure-restored',
            optimization: {
                scoutMatchesPerCandidate: SCOUT_MATCHES_PER_CANDIDATE,
                lineOfSightCache: true,
                squaredDistanceChecks: true,
                earlyDeadlockCutoff: true,
                tacticalBrainInTraining: true,
                learnableTacticalGenes: true,
                rearHitScoringFixed: true,
                deadlockAdjudication: true,
                hallAsGuardrail: true,
                cleanupDoctrine: true,
                physicalFinishReward: true,
                stallReasonDiagnostics: true,
                scoutArmorScreen: true,
                singleEngineerWithExpiringSupplyField: true,
                fieldRepairParity: true,
                armorStackingCap: true,
                artillerySplashDamage: true,
                armoredInfantryMedicPenalty: true,
                lastHuntDoctrine: true,
                antiArtilleryDoctrine: true,
                siegeBreakDoctrine: true,
                tacticalDiagnostics: true,
                decisiveAssaultTick: DECISIVE_ASSAULT_TICK,
                decisiveIdleTicks: DECISIVE_IDLE_TICKS,
                stagnationExplorationRate: 0.16,
                crossoverExplorationRate: 0.20
            },
                timestamp: new Date().toISOString(),
                epochs: TOTAL_EPOCHS,
                validationLeagueVersion: VALIDATION_LEAGUE_VERSION,
                acceptedMutations,
                trainingQualifiedMutations,
                gateRejectedMutations,
                validationRejectedMutations,
                scoutRejectedMutations,
                hallRejectedMutations,
                hallBypassAccepted,
                rejectionDiagnostics: {
                    reasons: rejectionReasons,
                    bestRejected: bestRejectedCandidate
                },
                adaptiveMutation: {
                    attempts: adaptiveMutationAttempts,
                    maxStagnationEpochs,
                    finalStagnationEpochs: stagnationEpochs,
                    finalLevel: getAdaptiveMutationProfile(stagnationEpochs).level
                },
                population: {
                    size: TOTAL_POPULATION_SIZE,
                    familySize: FAMILY_POPULATION_SIZE,
                    generationsRun,
                    archiveGeneration: championArchive.generation,
                    archiveUpdates: familyArchiveUpdates,
                    familyUpdateCounts,
                    crossoverCandidates,
                    crossoverAccepted,
                    bestFamily: rankedFamilies[0] || null,
                    families: archiveSummary
                },
                hallOfFame: {
                    size: hallOfFame.champions.length,
                    baseline: baselineHall,
                    final: hallChampion
                },
                training: {
                    baseline: baselineTraining,
                    final: compactLeagueSummary(trainingChampion),
                    scoreImprovement: trainingChampion.totalScore - baselineTraining.totalScore
                },
                validation: {
                    baseline: baselineValidation,
                    final: compactLeagueSummary(validationChampion),
                    scoreImprovement: validationChampion.totalScore - baselineValidation.totalScore
                },
                tacticGenes: { ...aiGenome.tacticGenes },
                rewardWeights: { ...TACTICAL_REWARD_WEIGHTS }
            };
            localStorage.setItem(GENOME_KEY, JSON.stringify(aiGenome));
            saveChampionArchive(championArchive);
            saveHallOfFame(hallOfFame);
            localStorage.setItem(TRAINING_REPORT_KEY, JSON.stringify(report));
            console.log('PIXEL_RTS_TRAINING_REPORT', JSON.stringify(report, null, 2));
            console.table(report.tacticGenes);
            setTimeout(() => {
                document.getElementById('ai-training-screen').classList.add('hidden');
                const g = report.tacticGenes;
                const league = report.validation.final;
                const stallReasonLine = league.stallReasons && Object.keys(league.stallReasons).length > 0
                    ? `Bitmeme nedeni: ${Object.entries(league.stallReasons).map(([name, count]) => `${name} ${count}`).join(', ')}\n`
                    : '';
                const bestFamilyName = report.population.bestFamily ? report.population.bestFamily.name : '-';
                const bestRejected = report.rejectionDiagnostics.bestRejected;
                const bestRejectedLine = bestRejected
                    ? `En iyi red: ${bestRejected.reason} | ${bestRejected.validation ? `${bestRejected.validation.wins}G/${bestRejected.validation.losses}M/${bestRejected.validation.draws}B` : `${bestRejected.training.wins}G/${bestRejected.training.losses}M/${bestRejected.training.draws}B`}\n`
                    : '';
                alert(
                    `Nüfus tabanlı şampiyon eğitimi tamamlandı!\n\n` +
                    `Eğitim gelişimi: +${Math.round(report.training.scoreImprovement)}\n` +
                    `Doğrulama gelişimi: +${Math.round(report.validation.scoreImprovement)}\n` +
                    `Doğrulama ligi: ${league.wins}G / ${league.losses}M / ${league.draws}B\n` +
                    `Kazanma oranı: %${Math.round(league.winRate * 100)}\n` +
                    `Hasar verimliliği: ${league.damageEfficiency.toFixed(2)}\n` +
                    `Ortalama süre: ${league.averageDuration.toFixed(1)} sn\n` +
                    `Kilitlenen maç: ${league.deadlocks} | Hakem kararı: ${league.adjudicated}\n` +
                    `Fiziksel bitiş: ${league.physicalFinishes} | Cleanup: ${league.cleanupMatches}\n` +
                    `Keşif hedefi/ölümü: ${league.scoutValuableSpots} / ${league.scoutDeaths}\n` +
                    `Topçu hasarı: ${Math.round(league.antiArtilleryDamage)} | Destek/Siper öldürme: ${league.supportKills} / ${league.fieldKills}\n` +
                    `Son av süresi: ${league.lastHuntSeconds.toFixed(1)} sn\n` +
                    stallReasonLine +
                    `En zayıf senaryo: ${league.worstMatch.name}\n` +
                    `Kabul: ${report.acceptedMutations} | Kapı reddi: ${report.gateRejectedMutations} | Lig reddi: ${report.validationRejectedMutations}\n` +
                    `Ön eleme reddi: ${report.scoutRejectedMutations}\n` +
                    bestRejectedLine +
                    `Salon reddi: ${report.hallRejectedMutations} | Salon baypas: ${report.hallBypassAccepted} | Salon şampiyonu: ${report.hallOfFame.size}\n` +
                    `Nüfus: ${report.population.size} | Nesil: ${report.population.generationsRun}\n` +
                    `Ön eleme: ${report.optimization.scoutMatchesPerCandidate} maç/adayı | Taktik beyin: eğitimde\n` +
                    `Çapraz çocuk: ${report.population.crossoverCandidates} | Kabul: ${report.population.crossoverAccepted}\n` +
                    `Arşiv güncellemesi: ${report.population.archiveUpdates} | En iyi aile: ${bestFamilyName}\n` +
                    `Adaptif deneme: ${report.adaptiveMutation.attempts} | En uzun durgunluk: ${report.adaptiveMutation.maxStagnationEpochs}\n\n` +
                    `Öncü S/M/G: ${g.vanguardAggression.toFixed(3)} / ${g.vanguardPreferredRange.toFixed(3)} / ${g.vanguardRetreat.toFixed(3)}\n` +
                    `Kanat S/M/G: ${g.flankAggression.toFixed(3)} / ${g.flankPreferredRange.toFixed(3)} / ${g.flankRetreat.toFixed(3)}\n` +
                    `Destek S/M/G: ${g.supportAggression.toFixed(3)} / ${g.supportPreferredRange.toFixed(3)} / ${g.supportRetreat.toFixed(3)}\n` +
                    `Kanat oranı: ${g.flankRatio.toFixed(3)}\n` +
                    `Kanat genişliği: ${g.flankWidth.toFixed(1)}\n` +
                    `Birlik bütünlüğü: ${g.cohesion.toFixed(3)}\n` +
                    `Odak ateşi: ${g.focusFire.toFixed(3)}\n` +
                    `Zırhlı/Destek önceliği: ${g.targetArmorPriority.toFixed(3)} / ${g.targetSupportPriority.toFixed(3)}\n` +
                    `TTK/Kaç/İkmal: ${g.executeTtk.toFixed(1)} / ${g.kiteHp.toFixed(3)} / ${g.resupplyAmmo.toFixed(3)}\n` +
                    `Değer/Tehdit/Bitir: ${g.targetValueWeight.toFixed(3)} / ${g.targetThreatWeight.toFixed(3)} / ${g.finishBias.toFixed(3)}`
                );
            }, 500);
        }
    }

    requestAnimationFrame(runGeneration);
});

window.getPixelRtsTrainingReport = function() {
    try {
        return JSON.parse(localStorage.getItem(TRAINING_REPORT_KEY));
    } catch (error) {
        return null;
    }
};
