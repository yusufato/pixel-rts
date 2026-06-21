// ═══════════════════════════════════════════════════════════════
//  ÖĞRENEN AI (Karşı-Ordu / Counter-Picking ve Etki Haritası)
// ═══════════════════════════════════════════════════════════════
const GRID_SIZE = 100;
const COLS = Math.ceil(WORLD_W / GRID_SIZE);
const ROWS = Math.ceil(WORLD_H / GRID_SIZE);
let influenceGrid = [];

function aiDeploy() {
    let currentMoney = enemy.money;
    
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
        if (currentMoney >= STATS[type].cost) {
            placeUnit(type, rx, ry, true);
            currentMoney -= STATS[type].cost;
            return true;
        }
        return false;
    };

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
    
    const visibleBlueUnits = units.filter(u => !u.isRed && !u.dead && canSee(true, u.x, u.y));
    
    // Hafıza ve Hedef Güncellemesi
    if (visibleBlueUnits.length > 0) {
        let sumX = 0, sumY = 0;
        let bestTarget = null; let maxTScore = -Infinity;
        
        visibleBlueUnits.forEach(u => { 
            sumX += u.x; sumY += u.y; 
            // Focus Fire hedefi seç: En zayıf veya en tehlikeli birim
            let score = (1 - u.hp / u.maxHp) * 5000;
            if (u.type === T.ARTILLERY || u.type === T.MEDIC) score += 3000;
            if (score > maxTScore) { maxTScore = score; bestTarget = u; }
        });
        
        globalLastSeenX = sumX / visibleBlueUnits.length;
        globalLastSeenY = sumY / visibleBlueUnits.length;
        aiFocusTarget = bestTarget;
    } else {
        aiFocusTarget = null;
    }

    // ARAMA MANTIĞI: Düşmanı görmüyorsa senin bölgene (X=150) kadar girer.
    let enCx = globalLastSeenX !== null ? globalLastSeenX : 150;
    let enCy = globalLastSeenY !== null ? globalLastSeenY : WORLD_H / 2;
    
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

    // ─── DİNAMİK KANAT AĞIRLIĞI (FLANK WEIGHT) ───
    let enemyArtyCount = visibleBlueUnits.filter(u => u.type === T.ARTILLERY || u.type === T.ANTI_TANK).length;
    // Eğer düşman tank avcısı veya topçu basmışsa, kanatlara yüklen (Örn %60). Yoksa normal (Örn %30).
    let targetFlankRatio = (enemyArtyCount > visibleBlueUnits.length * 0.25) ? 0.6 : 0.3;

    // ─── DİNAMİK DOKTRİN SEÇİMİ ───
    if (armorCount > redUnits.length * 0.3) aiDoctrine = 2; // Tank ağırlıklıysa Zırhlı Çekiç
    else aiDoctrine = 1; // Değilse Ağır Örs

    // ─── 1. SAVAŞ FAZI (STATE MACHINE) KONTROLÜ ───
    let armyHpRatio = totalRedHp / Math.max(1, maxRedHp);
    let distToEnemy = Math.hypot(myCx - enCx, myCy - enCy);
    let isBankrupt = enemy.money < 100; // Takviye yapacak parası kalmadı

    // Eğer kazanma ihtimali yoksa ve parası bitmişse -> LAST STAND (Faz 5)
    if (armyHpRatio < 0.3 && isBankrupt) {
        battlePhase = 5;
    } else if (armyHpRatio < 0.35 || redUnits.length < visibleBlueUnits.length * 0.4) {
        battlePhase = 4; // Toparlanma
    } else if (battlePhase === 4 && armyHpRatio > 0.7) {
        battlePhase = 1; // Can toplandı, taarruza devam
    }

    if (battlePhase === 1) { // ADVANCE (Yaklaşma)
        if (distToEnemy < 600 && visibleBlueUnits.length > 0) {
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
        enCx = WORLD_W * 0.7; // Kendi arka bölgesine çekil
        enCy = WORLD_H / 2;
    }

    let dirX = enCx - myCx;
    let dirY = enCy - myCy;
    let len = Math.max(1, Math.hypot(dirX, dirY));
    dirX /= len; dirY /= len;

    let perpX = -dirY; // Sağ/Sol ekseni
    let perpY = dirX;

    if (battlePhase === 1) {
        let advanceSpeed = 100; // İleri yürüme
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
        ru.aiAction = 'ATTACK';
        
        // A) SAĞLIKÇI (MEDIC) MEKANİĞİ - ÜS (BASE) MANTIĞI
        if (ru.type === T.MEDIC) {
            let aiBaseX = WORLD_W - 300;
            let aiBaseY = WORLD_H / 2;
            
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
        } else if (hpRatioU < 0.3 && ru.type !== T.MEDIC) {
            let aiBaseX = WORLD_W - 300;
            let aiBaseY = WORLD_H / 2;
            
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
                if (distToEnemyU < 600 && supportDistToEnemy - distToEnemyU > 400) {
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
        if (squad === SQUAD.VANGUARD) {
            let offset = (vanguardCount - Math.floor(redUnits.length * 0.5)) * 60; // 60px askerler arası boşluk
            ru.targetX = vanguardX + perpX * offset; 
            ru.targetY = vanguardY + perpY * offset;
            vanguardCount++;

            if (battlePhase === 1 && visibleBlueUnits.length > 0) {
                let ne = visibleBlueUnits[0]; 
                if(Math.hypot(ru.x - ne.x, ru.y - ne.y) < ru.range * 1.5) {
                    ru.targetX = ne.x; ru.targetY = ne.y; // Kısmi kovalama
                }
            }
        } else if (squad === SQUAD.FLANK) {
            let offset = 400; // Kanatları dışa aç
            let side = (flankCount % 2 === 0) ? 1 : -1; // Bir sağa, bir sola
            ru.targetX = flankX + perpX * offset * side;
            ru.targetY = flankY + perpY * offset * side;
            flankCount++;
        } else {
            let offset = (supportCount - Math.floor(redUnits.length * 0.3)) * 50;
            ru.targetX = supportX + perpX * offset; 
            ru.targetY = supportY + perpY * offset;
            supportCount++;
        }
        
        ru.targetX = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, ru.targetX));
        ru.targetY = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, ru.targetY));
    }
}
// ═══════════════════════════════════════════════════════════════
//  ULTIMATE GENETİK ALGORİTMA (10.000 MAÇLIK 2D UZAYSAL SİMÜLASYON)
// ═══════════════════════════════════════════════════════════════
function cloneMatrix(mat) { return mat.map(row => [...row]); }

function mutateGenome(genome) {
    let newG = {
        counterMatrix: cloneMatrix(genome.counterMatrix),
        deployMatrix: cloneMatrix(genome.deployMatrix)
    };
    
    const mutations = Math.floor(Math.random() * 5) + 1; 
    for(let i=0; i<mutations; i++) {
        let dice = Math.random();
        let r = Math.floor(Math.random() * 9);
        if (dice < 0.5) {
            let c = Math.floor(Math.random() * 9);
            newG.counterMatrix[r][c] += (Math.random() * 1.0) - 0.5;
            newG.counterMatrix[r][c] = Math.max(0.1, newG.counterMatrix[r][c]);
        } else {
            let c = Math.floor(Math.random() * 2);
            newG.deployMatrix[r][c] += (Math.random() * 0.4) - 0.2; 
            newG.deployMatrix[r][c] = Math.max(0, Math.min(1, newG.deployMatrix[r][c])); 
        }
    }
    return newG;
}

function generateMockArmy(money, qMat, enemyCounts) {
    let army = [];
    let weights = [1,1,1,1,1,1,1,1,1];
    for (let myType = 0; myType < 9; myType++) {
        for (let eType = 0; eType < 9; eType++) {
            weights[myType] += enemyCounts[eType] * qMat[eType][myType];
        }
    }
    let m = money;
    let attempts = 0;
    while(m > 40 && attempts < 50) {
        let bestT = null, maxW = -1;
        for (let t=0; t<9; t++) {
            if (weights[t] > maxW && m >= STATS[t].cost) { maxW = weights[t]; bestT = t; }
        }
        if (bestT !== null) {
            army.push({ type: bestT, hp: STATS[bestT].hp, maxHp: STATS[bestT].hp, atk: STATS[bestT].atk, armor: STATS[bestT].armor, speed: STATS[bestT].speed, range: STATS[bestT].range, vision: STATS[bestT].vision });
            m -= STATS[bestT].cost;
            weights[bestT] *= 0.5;
        }
        attempts++;
    }
    return army;
}

const META_ARMIES = [
    [10, 0, 0, 0, 0, 0, 0, 0, 0], // Sadece Piyade
    [0, 0, 0, 0, 0, 0, 7, 0, 0], // Sadece Tank
    [0, 0, 0, 5, 0, 0, 0, 0, 5], // Keşif + Topçu
    [2, 2, 2, 2, 1, 1, 1, 1, 1], // Dengeli
    [0, 0, 0, 0, 0, 0, 4, 7, 0]  // Tank + Tanksavar
];

function simulateSpatialMetaMatch(genome, metaCounts) {
    let myArmy = generateMockArmy(1500, genome.counterMatrix, metaCounts);
    
    // Genomdaki Deploy(Konum) genlerini askere yükle
    myArmy.forEach(u => {
        let xR = genome.deployMatrix[u.type][0];
        let yR = genome.deployMatrix[u.type][1];
        u.x = 2000 + (xR * 800); // Temsili AI Spawn Bölgesi
        u.y = yR * 1000;
        u.cooldown = 0;
    });

    let enemyArmy = [];
    for(let t=0; t<9; t++) {
        for(let i=0; i<metaCounts[t]; i++) {
            // Oyuncu Standart Dizilimi (Rastgele dağılım)
            enemyArmy.push({ 
                type: t, hp: STATS[t].hp, maxHp: STATS[t].hp, atk: STATS[t].atk, armor: STATS[t].armor,
                speed: STATS[t].speed, range: STATS[t].range, vision: STATS[t].vision,
                x: 200 + Math.random()*600, y: Math.random()*1000, cooldown: 0
            });
        }
    }
    
    let ticks = 0;
    let simBattlePhase = 1;
    let simPhaseTimer = 0;
    
    while(myArmy.length > 0 && enemyArmy.length > 0 && ticks < 400) {
        ticks++;
        
        let totalMyHp = 0, maxMyHp = 0;
        let myCx = 0, myCy = 0; myArmy.forEach(u => { myCx += u.x; myCy += u.y; totalMyHp += u.hp; maxMyHp += u.maxHp; }); myCx /= myArmy.length; myCy /= myArmy.length;
        let enCx = 0, enCy = 0; enemyArmy.forEach(u => { enCx += u.x; enCy += u.y; }); enCx /= enemyArmy.length; enCy /= enemyArmy.length;

        // Arama mantığı
        if (enemyArmy.length === 0) { enCx = 150; enCy = WORLD_H / 2; }

        let dist = Math.hypot(myCx - enCx, myCy - enCy);
        let myHpRatio = totalMyHp / Math.max(1, maxMyHp);
        
        // Simüle Kanat Ağırlığı
        let enArtyCount = enemyArmy.filter(u => u.type === T.ARTILLERY || u.type === T.ANTI_TANK).length;
        let simTargetFlankRatio = (enArtyCount > enemyArmy.length * 0.25) ? 0.6 : 0.3;

        if (myHpRatio < 0.2) { // Simülasyonda iflas kontrolü yerine hep Last Stand yap %20 altındaysa
            simBattlePhase = 5; // LAST STAND
        } else if (myHpRatio < 0.35) {
            simBattlePhase = 4; // Regroup
        } else if (simBattlePhase === 4 && myHpRatio > 0.7) {
            simBattlePhase = 1;
        } else if (simBattlePhase === 1 && dist < 600) { 
            simBattlePhase = 2; simPhaseTimer = ticks; 
        } else if (simBattlePhase === 2 && ticks - simPhaseTimer > 30) { 
            simBattlePhase = 3; 
        }

        if (simBattlePhase === 4) {
            enCx = WORLD_W * 0.7; // Kendi bölgesine çekil
            enCy = WORLD_H / 2;
        }

        let dirX = enCx - myCx, dirY = enCy - myCy;
        let len = Math.max(1, Math.hypot(dirX, dirY)); dirX /= len; dirY /= len;
        let perpX = -dirY, perpY = dirX;

        let vX = myCx, vY = myCy, fX = myCx, fY = myCy, sX = myCx, sY = myCy;
        if (simBattlePhase === 1) {
            vX = myCx + dirX * 100; vY = myCy + dirY * 100;
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
            fX = enCx + perpX * 150; fY = enCy + perpY * 150;
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
        for (const ua of myArmy) {
            if(ua.cooldown > 0) ua.cooldown--;
            
            let nearestEnemy = null, minDist = Infinity;
            for(const tb of enemyArmy) {
                let d = Math.hypot(ua.x - tb.x, ua.y - tb.y);
                if (d < minDist && d <= ua.vision) { minDist = d; nearestEnemy = tb; }
            }
            
            let tx = vX, ty = vY;
            let squad = ua.squad;
            if (squad === SQUAD.FLANK) { 
                let offset = 400; let side = (simFlankCount % 2 === 0) ? 1 : -1;
                tx = fX + perpX * offset * side; ty = fY + perpY * offset * side; 
                simFlankCount++;
            } else if (squad === SQUAD.SUPPORT) { 
                let offset = (simSupCount - Math.floor(myArmy.length*0.3))*50;
                tx = sX + perpX * offset; ty = sY + perpY * offset; 
                simSupCount++;
            } else {
                let offset = (simVanCount - Math.floor(myArmy.length*0.5))*60;
                tx = vX + perpX * offset; ty = vY + perpY * offset;
                simVanCount++;
            }

            // KITE (Geri Çekilme) / REGROUP
            let hpRatioU = ua.hp / ua.maxHp;
            if (simBattlePhase === 4) {
                tx = vX + (Math.random()*100 - 50); ty = vY + (Math.random()*100 - 50);
            } else if (simBattlePhase === 5) {
                // Last stand, don't flee
            } else if (hpRatioU < 0.3 && ua.type !== T.MEDIC) {
                if (squad === SQUAD.FLANK) {
                    tx = ua.x; ty = ua.y; // Hold
                } else {
                    tx = ua.x - dirX * 250; ty = ua.y - dirY * 250; // Ters yöne koş
                }
            } else if (squad === SQUAD.VANGUARD && nearestEnemy && minDist <= ua.range * 1.5) {
                tx = nearestEnemy.x; ty = nearestEnemy.y; // Öncüler kovalar
            }

            if (simBattlePhase !== 4 && nearestEnemy && minDist <= ua.range && ua.type !== T.MEDIC) {
                if (ua.cooldown <= 0) {
                    let dmg = ua.atk;
                    if (STATS[ua.type].strong.includes(nearestEnemy.type)) dmg *= 1.5;
                    if (STATS[ua.type].weak.includes(nearestEnemy.type)) dmg *= 0.5;
                    dmg = Math.max(1, dmg - nearestEnemy.armor);
                    nearestEnemy.hp -= dmg;
                    ua.cooldown = 15;
                }
                // Kite yapmıyorsa dur, Kite yapıyorsa tx'e yürümeye devam et
                if (hpRatioU >= 0.3) { tx = ua.x; ty = ua.y; } 
            }

            let dx = tx - ua.x; let dy = ty - ua.y;
            let moveLen = Math.max(1, Math.hypot(dx, dy));
            ua.x += (dx / moveLen) * ua.speed * 15.0;
            ua.y += (dy / moveLen) * ua.speed * 15.0;
        }
        enemyArmy = enemyArmy.filter(u => u.hp > 0);
        if (enemyArmy.length === 0) break;
        
        // 2. OYUNCU TEMSİLCİSİ (ENEMY ARMY) - Basit Attack Move
        for (const ub of enemyArmy) {
            if(ub.cooldown > 0) ub.cooldown--;
            
            let nearestAI = null, minDist = Infinity;
            for(const ta of myArmy) {
                let d = Math.hypot(ub.x - ta.x, ub.y - ta.y);
                if (d < minDist && d <= ub.vision) { minDist = d; nearestAI = ta; }
            }
            
            let tx = myCx, ty = myCy;
            if (nearestAI) {
                tx = nearestAI.x; ty = nearestAI.y;
                if (minDist <= ub.range && ub.type !== T.MEDIC) {
                    if (ub.cooldown <= 0) {
                        let dmg = ub.atk;
                        if (STATS[ub.type].strong.includes(nearestAI.type)) dmg *= 1.5;
                        if (STATS[ub.type].weak.includes(nearestAI.type)) dmg *= 0.5;
                        dmg = Math.max(1, dmg - nearestAI.armor);
                        nearestAI.hp -= dmg;
                        ub.cooldown = 15;
                    }
                    tx = ub.x; ty = ub.y; // Dur
                }
            }
            let dx = tx - ub.x; let dy = ty - ub.y;
            let moveLen = Math.max(1, Math.hypot(dx, dy));
            ub.x += (dx / moveLen) * ub.speed * 15.0;
            ub.y += (dy / moveLen) * ub.speed * 15.0;
        }
        myArmy = myArmy.filter(u => u.hp > 0);
        ticks++;
    }

    // FITNESS FUNCTION: Bloodthirsty Alpha-Evo
    let initialEnemyScore = 0;
    metaCounts.forEach((c, t) => initialEnemyScore += c * STATS[t].cost);
    let survivingEnemyScore = enemyArmy.reduce((sum, u) => sum + (u.hp / u.maxHp) * STATS[u.type].cost, 0);
    
    // Öldürülen düşmanın net değeri
    let killedEnemyValue = initialEnemyScore - survivingEnemyScore;
    
    // Kendi kaybettiği birliklerin değeri
    let initialAiScore = 1500;
    let survivingAiScore = myArmy.reduce((sum, u) => sum + (u.hp / u.maxHp) * STATS[u.type].cost, 0);
    let lostAiValue = initialAiScore - survivingAiScore;
    
    // Devrimsel Kural: "Sadece Öldür". Hayatta kalmanın kendisi puan kazandırmaz!
    let score = (killedEnemyValue * 10.0) - lostAiValue;
    return score; 
}

function evaluateGenome(genome) {
    let totalScore = 0;
    for (const enemyCounts of META_ARMIES) {
        totalScore += simulateSpatialMetaMatch(genome, enemyCounts);
    }
    return totalScore;
}

document.getElementById('train-ai-btn').addEventListener('click', () => {
    document.getElementById('train-ai-btn').textContent = "🧠 AI Eğit (2.000 Maç)";
    document.getElementById('ai-training-screen').classList.remove('hidden');
    let epoch = 0;
    const TOTAL_EPOCHS = 2000;
    
    let scoreCurrent = evaluateGenome(aiGenome); // Base score'u cache'le
    
    function runBatch() {
        for(let i=0; i<10; i++) { // Batch size 10 (tarayıcı çökmesini engeller)
            if (epoch >= TOTAL_EPOCHS) break;
            
            let mutatedGenome = mutateGenome(aiGenome);
            let scoreMutant = evaluateGenome(mutatedGenome);
            
            if (scoreMutant > scoreCurrent) {
                aiGenome = mutatedGenome;
                scoreCurrent = scoreMutant; // Yeni skoru cache'le
            }
            epoch++;
        }
        
        const pct = (epoch / TOTAL_EPOCHS) * 100;
        document.getElementById('train-progress-bar').style.width = pct + '%';
        document.getElementById('train-progress-text').textContent = `%${pct.toFixed(1)} (${epoch} / ${TOTAL_EPOCHS})`;
        
        if (epoch < TOTAL_EPOCHS) {
            requestAnimationFrame(runBatch);
        } else {
            localStorage.setItem(GENOME_KEY, JSON.stringify(aiGenome));
            setTimeout(() => {
                document.getElementById('ai-training-screen').classList.add('hidden');
                alert("2.000 Maçlık Taktiksel Evrim Tamamlandı! \\n\\nYapay zeka sadece karşı-birlik üretmeyi değil, savaş alanında kusursuz dizilişi ve konumlanma taktiklerini de öğrendi!");
            }, 500);
        }
    }
    
    requestAnimationFrame(runBatch);
});