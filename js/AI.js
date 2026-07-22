// ═══════════════════════════════════════════════════════════════
//  KONUŞLANMA AI (Karşı-Ordu / Counter-Picking ve Etki Haritası)
//  aiGenome.counterMatrix/deployMatrix artık SABİT elle-ayarlı tablodur
//  (globals.js). Eğitim/evrim yoktur — davranış deterministik ve okunur.
// ═══════════════════════════════════════════════════════════════
const GRID_SIZE = 100;
const COLS = Math.ceil(WORLD_W / GRID_SIZE);
const ROWS = Math.ceil(WORLD_H / GRID_SIZE);
let influenceGrid = [];

function aiDeploy() {
    let currentMoney = enemy.money;
    const aiDeployCounts = new Array(9).fill(0);
    
    // Şu anki haritadaki CANLI mavi birimler (oyuncunun gerçek ordusu — hilesiz, deploy anında görünür)
    let blueCounts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0 };
    let liveBlue = 0;
    for (const u of units) {
        if (!u.isRed) { blueCounts[u.type] += 1; liveBlue++; }
    }
    // KONSEY BATCH 2: monoculture (tek-tip) tespiti → tek-tip netken hafızayı SULANDIRMA
    // (sahadaki saf sinyal bulanmasın, sert counter devreye girsin). Kullanıcı isteği: tek-tip→counter.
    let domCount = 0; for (let t = 0; t < 9; t++) if (blueCounts[t] > domCount) domCount = blueCounts[t];
    const dominantRatio = liveBlue > 0 ? domCount / liveBlue : 0;
    const metaFactor = dominantRatio >= 0.7 ? 0.1 : 0.4;        // tek-tip → hafıza %10, çeşitli → %40
    for (const type in playerMeta) blueCounts[type] += playerMeta[type] * metaFactor;

    // Ağırlık Sistemi (Genetik Algoritma Counter Geni kullanarak)
    let aiWeights = { 0:1, 1:1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1, 8:1 };
    
    for (let myType = 0; myType < 9; myType++) {
        for (let enemyType = 0; enemyType < 9; enemyType++) {
            aiWeights[myType] += blueCounts[enemyType] * aiGenome.counterMatrix[enemyType][myType];
        }
    }
    
    const buyUnit = (type, rx, ry) => {
        if (type === T.ENGINEER && aiDeployCounts[T.ENGINEER] >= 1) return false;
        const cost = STATS[type].cost;
        if (currentMoney < cost) return false;
        if (!placeUnit(type, rx, ry, true)) return false;   // HİKAYE: tipli havuz (DEPLOY_RES.red) yetmezse atla → anti-tank=puan SINIRLI; QM/MP'de enemy.money kontrolü (değişmez)
        aiDeployCounts[type]++;
        currentMoney -= cost;
        return true;
    };

    // Canlı fizik artık sınırlı mühimmat kullandığı için AI her orduda bir lojistik çekirdek taşır.
    buyUnit(T.ENGINEER, WORLD_W * 0.5 + (srand() * 80 - 40), 220);
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
            const rx = WORLD_W * 0.5 + (column - 1.5) * 145 + (srand() * 28 - 14);
            const ry = 250 + row * 115 + (srand() * 28 - 14);
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
            const rx = WORLD_W * 0.5 + (column - 2) * 150 + (srand() * 30 - 15);
            const ry = 330 + row * 110 + (srand() * 30 - 15);
            buyUnit(T.ANTI_TANK, rx, ry);
        }
        aiWeights[T.ANTI_TANK] += 35;
        aiWeights[T.ARTILLERY] += 14;
        aiWeights[T.RECON] += 8;
    }
    // ── KONSEY BATCH 2: TOPÇU-AĞIRLIKLI AVCI PAKETİ (oransal + kompozisyon-farkında) ──
    // Topçu yakın-dövüşte cam (vision300<range350, speed0.27, 10s reload, weak:RECON). Onu RUSH'layacak
    // HIZLI+SPOTTER ordu kur. ŞİDDET oranyla ölçeklenir (eşik DEĞİL → "tam eşik-altı kal" sömürüsü kapalı).
    // Koruma varsa dengele: zırh→AT ekle, AT→zırhlı-piyade ekle (adversarial rafine). Kullanıcı: tek-tip→counter.
    const deployedAT = deployedBlue.filter(u => u.type === T.ANTI_TANK).length;
    const totalBlue = Math.max(1, deployedBlue.length);
    const artilleryRatio = deployedArtillery / totalBlue;
    const antiTankRatio = deployedAT / totalBlue;
    const huntArtyStrength = artilleryRatio - 0.9 * armorRatio - 0.9 * antiTankRatio;  // topçu açıkta mı
    if (deployedArtillery >= 2 && huntArtyStrength > 0.1) {
        const s = Math.min(2.2, 0.6 + huntArtyStrength * 2.4);                          // orantılı şiddet
        const reconN = Math.min(4, Math.max(2, Math.round(deployedArtillery * (0.3 + huntArtyStrength * 0.5))));  // 2-4 SPOTTER yeter (görüş takım-geneli)
        for (let i = 0; i < reconN; i++) {                                              // spotter: topçu görüşünü kır
            const rx = WORLD_W * 0.5 + (i % 5 - 2) * 150 + (srand() * 40 - 20);
            buyUnit(T.RECON, rx, 250 + Math.floor(i / 5) * 70);
        }
        // ASIL ÖLDÜRÜCÜ = MECH/PİYADE sürüsü (dayanıklı, splash'ta erimez). RECON sadece spotter (az).
        aiWeights[T.RECON]         += 16 * s;                                           // az ek recon (kırılgan)
        aiWeights[T.MECH_INFANTRY] += 52 * s;                                           // ASIL kapatıcı sürü (hızlı + dayanıklı)
        aiWeights[T.INFANTRY]      += 32 * s;                                           // ucuz kitle (sayı üstünlüğü)
        if (armorRatio > 0.1)    aiWeights[T.ANTI_TANK]      += 30 * armorRatio * 3;    // koruyan zırh duvarını kır
        if (antiTankRatio > 0.1) aiWeights[T.ARMOR_INFANTRY] += 26 * antiTankRatio * 3; // koruyan AT'yi ez
        aiWeights[T.ARTILLERY] *= 0.30;                                                 // kendi yavaş topçunu kıs
        aiWeights[T.ARMOR]     *= 0.60;
        aiWeights[T.ENGINEER]  *= 0.50;
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
            rx += (srand() * 60) - 30;
            ry += (srand() * 60) - 30;
            
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
            ru.targetX = vanguardX + (srand()*200 - 100);
            ru.targetY = vanguardY + (srand()*200 - 100);
            ru.aiAction = 'FLEE';
            continue;
        } else if (battlePhase === 5) {
            // LAST STAND! Geri çekilmek YOK.
            ru.aiAction = 'ATTACK';
        } else if (!ru.lastStandMorale && hpRatioU < roleGenes.retreat && ru.type !== T.MEDIC) {
            let aiBaseX = WORLD_W / 2;
            let aiBaseY = 180;
            
            ru.targetX = aiBaseX + (srand() * 200 - 100);
            ru.targetY = aiBaseY + (srand() * 200 - 100);
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
                    ru.targetX = supportX + (srand()*100 - 50);
                    ru.targetY = supportY + (srand()*100 - 50);
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
