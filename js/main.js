canvas.addEventListener('mousemove', (e) => { mouseScreenX = e.clientX; mouseScreenY = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.clientY > canvas.height - 110) return;
    if (phase === PHASE.DEPLOY && selectedSpawnType !== null) {
        const world = screenToWorld(e.clientX, e.clientY);
        if (isInPlayerZone(world.x, world.y)) {
            // Check overlap
            let canPlace = true;
            for (const u of units) {
                if (Math.hypot(u.x - world.x, u.y - world.y) < 30) {
                    canPlace = false; break;
                }
            }
            if (canPlace) {
                placeUnit(selectedSpawnType, world.x, world.y, false);
            }
        }
        return;
    }
    if (phase === PHASE.BATTLE) {
        if (selectedSupportMode) {
            const world = screenToWorld(e.clientX, e.clientY);
            if (selectedSupportMode === 'paradrop') {
                if (triggerParadrop(world.x, world.y)) cancelSupportMode();
            } else if (selectedSupportMode === 'trench') {
                let nearestEng = null;
                let minDist = Infinity;
                for (const u of units) {
                    if (!u.dead && !u.isRed && u.type === T.ENGINEER && !u.buildTrenchTarget) {
                        const d = Math.hypot(u.x - world.x, u.y - world.y);
                        if (d < minDist) { minDist = d; nearestEng = u; }
                    }
                }
                if (nearestEng) {
                    nearestEng.buildTrenchTarget = { x: world.x, y: world.y };
                    nearestEng.manualTarget = null;
                    nearestEng.manualMoveTarget = null;
                    nearestEng.attackTarget = null;
                }
                cancelSupportMode();
            }
            return;
        }
    }
    
    // ÇİFT TIKLAMA İLE AYNI BİRİMLERİ SEÇME
    if (e.detail === 2) {
        const world = screenToWorld(e.clientX, e.clientY);
        let clickedType = null;
        for (const u of units) {
            if (!u.dead && !u.isRed && Math.hypot(u.x - world.x, u.y - world.y) < 30) {
                clickedType = u.type;
                break;
            }
        }
        if (clickedType !== null) {
            const viewW = canvas.width / zoom;
            const viewH = canvas.height / zoom;
            units.forEach(u => {
                if (!u.dead && !u.isRed && u.type === clickedType) {
                    if (u.x >= camera.x && u.x <= camera.x + viewW && u.y >= camera.y && u.y <= camera.y + viewH) {
                        u.selected = true;
                    }
                }
            });
            return;
        }
    }

    isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY;
    if (!e.shiftKey) units.forEach(u => { if (!u.isRed) u.selected = false; });
});
canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    
    if (phase === PHASE.DEPLOY && selectedSpawnType !== null && e.clientY <= canvas.height - 110) {
        // Drag placement is disabled, placement is handled in mousedown
        isDragging = false;
        return;
    }

    if (!isDragging) return;
    isDragging = false;
    const minSX = Math.min(dragStartX, mouseScreenX), maxSX = Math.max(dragStartX, mouseScreenX);
    const minSY = Math.min(dragStartY, mouseScreenY), maxSY = Math.max(dragStartY, mouseScreenY);
    if (maxSX - minSX < 5 && maxSY - minSY < 5) {
        const world = screenToWorld(e.clientX, e.clientY);
        let bestUnit = null, bestDist = 30;
        for (const u of units) {
            if (u.dead || u.isRed) continue;
            const d = Math.hypot(u.x - world.x, u.y - world.y);
            if (d < bestDist) { bestUnit = u; bestDist = d; }
        }
        if (bestUnit) bestUnit.selected = true;
    } else {
        const topLeft = screenToWorld(minSX, minSY), bottomRight = screenToWorld(maxSX, maxSY);
        for (const u of units) {
            if (u.dead || u.isRed) continue;
            if (u.x >= topLeft.x && u.x <= bottomRight.x && u.y >= topLeft.y && u.y <= bottomRight.y) u.selected = true;
        }
    }
});
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (phase === PHASE.DEPLOY) {
        selectedSpawnType = null;
        document.querySelectorAll('.spawn-btn').forEach(b => b.classList.remove('selected-btn'));
        canvas.classList.remove('ghost-cursor');
        return;
    }
    if (selectedSupportMode) {
        cancelSupportMode();
        return;
    }
    if (phase !== PHASE.BATTLE) return;
    const world = screenToWorld(e.clientX, e.clientY);
    const selectedUnits = units.filter(u => u.selected && !u.isRed && !u.dead);
    if (selectedUnits.length === 0) return;

    let targetEnemy = null;
    for (const u of units) {
        if (u.dead || !u.isRed || !canSee(false, u.x, u.y)) continue;
        if (Math.hypot(u.x - world.x, u.y - world.y) < 30) { targetEnemy = u; break; }
    }
    if (targetEnemy) {
        selectedUnits.forEach(u => { u.manualTarget = targetEnemy; u.manualMoveTarget = null; u.isMovingToManualTarget = false; });
    } else {
        const count = selectedUnits.length;
        const cols = Math.ceil(Math.sqrt(count)), spacing = UNIT_RADIUS * 2.5;
        selectedUnits.forEach((u, i) => {
            const row = Math.floor(i / cols), col = i % cols;
            const offsetX = (col - (cols - 1) / 2) * spacing, offsetY = (row - (Math.ceil(count / cols) - 1) / 2) * spacing;
            u.targetX = world.x + offsetX; u.targetY = world.y + offsetY;
            u.manualTarget = null; u.manualMoveTarget = { x: world.x + offsetX, y: world.y + offsetY };
            u.isMovingToManualTarget = true; u.attackTarget = null;
        });
    }
});


// ─── UI & BUTONLAR ───
let selectedSupportMode = null;

function cancelSupportMode() {
    selectedSupportMode = null;
    canvas.classList.remove('ghost-cursor');
    document.getElementById('btn-paradrop').style.borderColor = 'rgba(100, 200, 255, 0.4)';
    document.getElementById('btn-trench').style.borderColor = 'rgba(100, 200, 255, 0.4)';
}

document.getElementById('btn-paradrop').addEventListener('click', (e) => {
    e.stopPropagation();
    if (supportCooldowns.paradrop > 0 || player.money < PARADROP_COST) return;
    selectedSupportMode = selectedSupportMode === 'paradrop' ? null : 'paradrop';
    if (selectedSupportMode) {
        canvas.classList.add('ghost-cursor');
        document.getElementById('btn-paradrop').style.borderColor = '#4cff7c';
        document.getElementById('btn-trench').style.borderColor = 'rgba(100, 200, 255, 0.4)';
    } else {
        cancelSupportMode();
    }
});

document.getElementById('btn-trench').addEventListener('click', (e) => {
    e.stopPropagation();
    selectedSupportMode = selectedSupportMode === 'trench' ? null : 'trench';
    if (selectedSupportMode) {
        canvas.classList.add('ghost-cursor');
        document.getElementById('btn-trench').style.borderColor = '#ffcc00';
        document.getElementById('btn-paradrop').style.borderColor = 'rgba(100, 200, 255, 0.4)';
    } else {
        cancelSupportMode();
    }
});
document.querySelectorAll('.spawn-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (phase !== PHASE.DEPLOY) return;
        const type = parseInt(btn.dataset.type);
        if (selectedSpawnType === type) {
            selectedSpawnType = null;
            btn.classList.remove('selected-btn');
            canvas.classList.remove('ghost-cursor');
            return;
        }
        selectedSpawnType = type;
        document.querySelectorAll('.spawn-btn').forEach(b => b.classList.remove('selected-btn'));
        btn.classList.add('selected-btn');
        canvas.classList.add('ghost-cursor');
    });

    // Sürükle-Bırak hissiyatı için mousedown olayını da dinleyelim
    btn.addEventListener('mousedown', (e) => {
        if (phase !== PHASE.DEPLOY) return;
        const type = parseInt(btn.dataset.type);
        selectedSpawnType = type;
        document.querySelectorAll('.spawn-btn').forEach(b => b.classList.remove('selected-btn'));
        btn.classList.add('selected-btn');
        canvas.classList.add('ghost-cursor');
    });

    btn.addEventListener('mouseenter', () => {
        const type = parseInt(btn.dataset.type);
        const s = STATS[type];
        const strongNames = s.strong.map(t => STATS[t].name).join(', ') || '-';
        const weakNames = s.weak.map(t => STATS[t].name).join(', ') || '-';
        document.getElementById('info-content').innerHTML = `
            <b style="color:#aaddff">${s.name}</b><br>
            ${s.desc}<br><br>
            ❤️ HP: ${s.hp} | ⚔️ ATK: ${s.atk}<br>
            🏃 Hız: ${(s.speed*2).toFixed(2)} | 📏 Menzil: ${s.range}<br>
            👁️ Görüş: ${s.vision} | 🛡️ Zırh: ${s.armor} | 💰 ${s.cost}<br><br>
            <span style="color:#4cff7c">✅ Güçlü: ${strongNames}</span><br>
            <span style="color:#ff6666">❌ Zayıf: ${weakNames}</span>
        `;
    });
    btn.addEventListener('mouseleave', () => {
        document.getElementById('info-content').innerHTML = 'Bir birim seç veya üzerine gel';
    });
});

function startBattle() {
    if (phase !== PHASE.DEPLOY) return;
    
    savePlayerMeta(); // Yapay zeka öğrenmesi için oyuncu stratejisini kaydet
    aiDeploy();       // Öğrenilen meta + sahaya göre karşı orduyu bas
    
    phase = PHASE.BATTLE;
    battleTelemetry.start(simulationTime);
    layeredAI.reset(simulationTime);
    selectedSpawnType = null;
    canvas.classList.remove('ghost-cursor');

    document.getElementById('start-btn').classList.add('hidden');
    document.getElementById('train-ai-btn').classList.add('hidden');
    document.getElementById('phase-text').textContent = '⚔️ SAVAŞ! Sol tık: seç | Sağ tık: komut ver';
    document.getElementById('phase-text').style.color = '#ff4444';
    document.getElementById('ui-spawn-bar').style.opacity = '0.3';
    document.getElementById('ui-spawn-bar').style.pointerEvents = 'none';
    document.getElementById('ui-camera-hint').style.display = 'none';
    document.getElementById('ui-support').classList.remove('hidden');

    setTimeout(() => { document.getElementById('ui-phase').style.display = 'none'; }, 3000);
}

document.getElementById('start-btn').addEventListener('click', () => {
    if (units.filter(u => !u.isRed).length === 0) return;
    startBattle();
});
document.getElementById('restart-btn').addEventListener('click', () => location.reload());
document.getElementById('copy-battle-report-btn')?.addEventListener('click', async () => {
    const output = document.getElementById('battle-report-output');
    if (!output) return;
    output.select();
    try {
        await navigator.clipboard.writeText(output.value);
    } catch (error) {
        document.execCommand('copy');
    }
});
document.getElementById('download-battle-report-btn')?.addEventListener('click', () => {
    const output = document.getElementById('battle-report-output');
    if (!output) return;
    const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pixel-rts-canli-mac-raporu-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
});


minimapCanvas.addEventListener('click', (e) => {
    const rect = minimapCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    camera.x = mx * WORLD_W - (canvas.width / zoom) / 2;
    camera.y = my * WORLD_H - (canvas.height / zoom) / 2;
});

function checkGameOver() {
    if (phase !== PHASE.BATTLE) return;
    const blueAlive = units.some(u => !u.dead && !u.isRed);
    const redAlive = units.some(u => !u.dead && u.isRed);

    let won = null;
    if (!blueAlive && !redAlive) won = 'draw';
    else if (!blueAlive) won = false;
    else if (!redAlive) won = true;
    else return;

    const telemetrySummary = battleTelemetry.finish(won, simulationTime);
    layeredAI.onBattleEnd(telemetrySummary);
    phase = PHASE.OVER;
    const title = document.getElementById('game-over-title');
    if (won === 'draw') { title.textContent = '🤝 BERABERE!'; title.style.color = '#ffaa00'; }
    else if (won) { title.textContent = '🏆 ZAFER!'; title.style.color = '#4cff7c'; }
    else { title.textContent = '💀 YENİLDİN!'; title.style.color = '#ff4444'; }

    const doctrineNames = {
        advance: 'İlerleme',
        hunt: 'Arama',
        encircle: 'Kuşatma',
        breakthrough: 'Yarma',
        attrition: 'Yıpratma',
        cleanup: 'Temizleme',
        last_hunt: 'Son Av',
        anti_artillery: 'Anti-Topçu',
        siege_break: 'Siper Kırma',
        regroup: 'Toparlanma',
        last_stand: 'Son Direniş'
    };
    const doctrineLine = Object.entries(telemetrySummary.doctrineDurations || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, seconds]) => `${doctrineNames[name] || name}: ${seconds.toFixed(1)} sn`)
        .join(' | ') || '-';
    const aiThought = (telemetrySummary.pressureBreakSeconds || 0) > 20
        ? 'Sıkıştırma sonuç vermeyince çemberi daralttı ve arka hat/destek hedeflerine baskın aradı.'
        : (telemetrySummary.compressionSeconds || 0) > 20
        ? 'Geri çekilen hattını sıkıştırmaya çalıştı; kanatları kaçış yönünün önüne gönderdi.'
        : telemetrySummary.dominantDoctrine === 'anti_artillery'
        ? 'Topçunu öncelikli tehdit gördü; keşif ve kanat baskısıyla arka hattı aradı.'
        : telemetrySummary.dominantDoctrine === 'siege_break'
            ? 'Siper/ikmal hattını kırmaya çalıştı; destek hedeflerini öne aldı.'
            : telemetrySummary.dominantDoctrine === 'last_hunt'
                ? 'Maç sonunu av moduna çevirdi; hızlı birliklerle kalanları kovalamaya çalıştı.'
                : telemetrySummary.dominantDoctrine === 'cleanup'
                    ? 'Üstünlüğü görünce temizleme moduna geçti ve geri çekilmeyi azalttı.'
                    : telemetrySummary.dominantDoctrine === 'regroup'
                        ? 'Güç oranını riskli gördü; toparlanıp menzil/ikmal aradı.'
                        : 'Genel savaş planı ile ilerledi; hedef değerine ve tehdit skoruna göre oynadı.';
    const readableReport = [
        'PIXEL RTS CANLI MAÇ RAPORU',
        '',
        `Sonuç: ${won === 'draw' ? 'Berabere' : won ? 'Oyuncu kazandı' : 'AI kazandı'}`,
        `Süre: ${telemetrySummary.durationSeconds.toFixed(1)} sn`,
        `AI Taktik Puanı: ${Math.round(telemetrySummary.reward)}`,
        `Hasar: AI ${Math.round(telemetrySummary.damageDealt)} / Oyuncu ${Math.round(telemetrySummary.damageTaken)}`,
        `Değer kaybı: Oyuncu ${telemetrySummary.enemyValueDestroyed} / AI ${telemetrySummary.aiValueLost}`,
        '',
        `AI Baskın Doktrin: ${doctrineNames[telemetrySummary.dominantDoctrine] || telemetrySummary.dominantDoctrine}`,
        `Doktrin Süreleri: ${doctrineLine}`,
        `Doktrin Değişimi: ${telemetrySummary.doctrineSwitches}`,
        `AI Yorumu: ${aiThought}`,
        '',
        `Keşif hedefi / keşif ölümü: ${telemetrySummary.scoutValuableSpots} / ${telemetrySummary.scoutDeaths}`,
        `Topçuya verilen hasar: ${Math.round(telemetrySummary.antiArtilleryDamage)}`,
        `Destek / siper içi öldürme: ${telemetrySummary.supportKills} / ${telemetrySummary.fieldKills}`,
        `Son av süresi: ${telemetrySummary.lastHuntSeconds.toFixed(1)} sn`,
        `Sıkıştırma süresi: ${(telemetrySummary.compressionSeconds || 0).toFixed(1)} sn`,
        `Ateş üssü bekleme: ${(telemetrySummary.fireBaseWaitSeconds || 0).toFixed(1)} sn`,
        `Baskı kırma süresi: ${(telemetrySummary.pressureBreakSeconds || 0).toFixed(1)} sn`,
        `Anti-topçu fallback: ${telemetrySummary.antiArtilleryFallbacks || 0}`,
        `Arkadan vuruş: ${telemetrySummary.rearHits} vuruş / ${Math.round(telemetrySummary.rearHitDamage)} hasar`,
        `Boşta geçen süre: ${telemetrySummary.idleSeconds.toFixed(1)} sn`,
        '',
        'Ham JSON:',
        JSON.stringify(telemetrySummary, null, 2)
    ].join('\n');

    document.getElementById('score-table').innerHTML = `
        <div class="score-row"><span>Sonuç</span><span class="score-val">${won === 'draw' ? 'Berabere' : won ? 'Kazandın' : 'Kaybettin'}</span></div>
        <div class="score-row"><span>Öldürdüğün Düşman</span><span class="score-val">${player.kills}</span></div>
        <div class="score-row"><span>Ürettiğin Birim</span><span class="score-val">${player.unitsSpawned}</span></div>
        <div class="score-row"><span>Kaybettiğin Birim</span><span class="score-val">${enemy.kills}</span></div>
        <div class="score-row"><span>AI Taktik Puanı (Tek Maç)</span><span class="score-val">${Math.round(telemetrySummary.reward)}</span></div>
        <div class="score-row"><span>AI Baskın Doktrin</span><span class="score-val">${doctrineNames[telemetrySummary.dominantDoctrine] || telemetrySummary.dominantDoctrine}</span></div>
        <div class="score-row"><span>Doktrin Süreleri</span><span class="score-val">${doctrineLine}</span></div>
        <div class="score-row"><span>Keşif hedefi / keşif ölümü</span><span class="score-val">${telemetrySummary.scoutValuableSpots} / ${telemetrySummary.scoutDeaths}</span></div>
        <div class="score-row"><span>Topçuya verilen hasar</span><span class="score-val">${Math.round(telemetrySummary.antiArtilleryDamage)}</span></div>
        <div class="score-row"><span>Destek / siper içi öldürme</span><span class="score-val">${telemetrySummary.supportKills} / ${telemetrySummary.fieldKills}</span></div>
        <div class="score-row"><span>Son av süresi</span><span class="score-val">${telemetrySummary.lastHuntSeconds.toFixed(1)} sn</span></div>
        <div class="score-row"><span>Sıkıştırma / ateş üssü / kırma</span><span class="score-val">${(telemetrySummary.compressionSeconds || 0).toFixed(1)} sn / ${(telemetrySummary.fireBaseWaitSeconds || 0).toFixed(1)} sn / ${(telemetrySummary.pressureBreakSeconds || 0).toFixed(1)} sn</span></div>
        <div class="score-row"><span>AI Yorumu</span><span class="score-val">${aiThought}</span></div>
    `;
    const reportOutput = document.getElementById('battle-report-output');
    if (reportOutput) reportOutput.value = readableReport;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function updateUI() {
    document.getElementById('money').textContent = Math.floor(player.money);
    if (phase === PHASE.DEPLOY) {
        document.querySelectorAll('.spawn-btn').forEach(btn => {
            const type = parseInt(btn.dataset.type);
            btn.classList.toggle('disabled', player.money < STATS[type].cost);
        });
    }

    if (phase === PHASE.BATTLE) {
        const sel = units.filter(u => u.selected && !u.isRed && !u.dead);
        if (sel.length === 1) {
            const u = sel[0];
            const s = STATS[u.type];
            document.getElementById('info-content').innerHTML = `
                <b style="color:#aaddff">${s.name}</b><br>
                ❤️ ${Math.floor(u.hp)}/${u.maxHp} | 🛡️ ${u.armor}<br>
                ⚔️ ATK: ${u.atk} | 📏 ${u.range}<br>
                👁️ ${s.vision} | ${u.attackTarget ? '<span style="color:#ff6666">Saldırıyor!</span>' : '<span style="color:#888">Bekleme</span>'}
            `;
        } else if (sel.length > 1) {
            document.getElementById('info-content').innerHTML = `<b style="color:#aaddff">${sel.length} birim seçili</b><br>Sağ tık: hareket / saldır`;
        }
        
        document.getElementById('cd-paradrop').style.height = `${(supportCooldowns.paradrop / MAX_CD_PARADROP) * 100}%`;
        document.getElementById('btn-paradrop').style.borderColor = selectedSupportMode === 'paradrop' ? '#fff' : '#555';
        document.getElementById('btn-paradrop').classList.toggle('disabled', player.money < PARADROP_COST || supportCooldowns.paradrop > 0);
        document.getElementById('btn-trench').style.borderColor = selectedSupportMode === 'trench' ? '#fff' : '#555';
    }
}

// ─── ÇİZİM VE SAVAŞ SİSİ (Fog of War) ───

function drawAIWaypoints() {
    if (phase !== PHASE.BATTLE) return;
    const redUnits = units.filter(u => u.isRed && !u.dead);
    if (redUnits.length === 0) return;

    ctx.save();
    
    // Her kırmızı askerden hedefine ince çizgi çiz
    for (const ru of redUnits) {
        let from = worldToScreen(ru.x, ru.y);
        let to = worldToScreen(ru.targetX, ru.targetY);
        
        ctx.strokeStyle = ru.attackTarget ? 'rgba(255,0,0,0.4)' : 'rgba(255,255,0,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Debug Paneli
    let panelX = 10, panelY = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(panelX, panelY, 200, 100);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(panelX, panelY, 200, 100);
    
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 13px Courier New';
    ctx.fillText('🧠 AI SAVAŞ DURUMU', panelX + 10, panelY + 18);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '11px Courier New';
    let y = panelY + 36;
    
    const phaseName = battlePhase === 1 ? 'İLERLE (ADVANCE)' : (battlePhase === 2 ? 'ÇARPIŞMA (CLASH)' : 'KUŞATMA (FLANK)');
    ctx.fillText(`FAZ: ${phaseName}`, panelX + 10, y); y += 16;
    
    let attacking = redUnits.filter(u => u.attackTarget && !u.attackTarget.dead).length;
    let retreating = redUnits.filter(u => u.aiAction === 'KITE' || u.aiAction === 'FLEE').length;
    
    ctx.fillText(`Savaşan Asker: ${attacking}`, panelX + 10, y); y += 16;
    ctx.fillText(`Kite (Çekilen): ${retreating}`, panelX + 10, y); y += 16;
    
    ctx.restore();
}

function drawMap() {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Katman 1: düz yeşil yerine blok blok değişen piksel arazi karoları.
    ctx.fillStyle = '#46583a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tilePalette = ['#425438', '#485c3b', '#4d603d', '#3f5035', '#526344'];
    for (const tile of groundTiles) {
        const s = worldToScreen(tile.x, tile.y);
        const tileSize = GROUND_TILE_SIZE * zoom + 1;
        if (s.x > canvas.width || s.y > canvas.height || s.x + tileSize < 0 || s.y + tileSize < 0) continue;
        const paletteIndex = Math.min(tilePalette.length - 1, Math.floor(tile.tone * tilePalette.length));
        ctx.fillStyle = tilePalette[paletteIndex];
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), Math.ceil(tileSize), Math.ceil(tileSize));
    }

    for (const detail of groundDetails) {
        const s = worldToScreen(detail.x, detail.y);
        const size = detail.size * zoom;
        if (s.x < -size || s.x > canvas.width + size || s.y < -size || s.y > canvas.height + size) continue;
        ctx.fillStyle = detail.tone > 0.72 ? 'rgba(105,126,73,0.24)' : 'rgba(20,48,28,0.20)';
        ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.max(1, size), Math.max(1, size * 0.45));
    }

    // Çamur, ot, taş, metal kırığı ve eski mermi izleri zemine savaş hikâyesi katar.
    for (const prop of battlefieldProps) {
        const s = worldToScreen(prop.x, prop.y);
        const size = Math.max(2, prop.size * zoom);
        if (s.x < -size * 2 || s.x > canvas.width + size * 2 || s.y < -size * 2 || s.y > canvas.height + size * 2) continue;
        const px = Math.round(s.x);
        const py = Math.round(s.y);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(prop.angle);
        if (prop.type === 'mud') {
            ctx.fillStyle = prop.variant > 0.5 ? '#554831' : '#493d2d';
            ctx.fillRect(-size, -size * 0.35, size * 2, size * 0.7);
            ctx.fillStyle = 'rgba(31,29,20,0.35)';
            ctx.fillRect(-size * 0.55, -size * 0.55, size * 0.8, size * 0.3);
        } else if (prop.type === 'grass') {
            ctx.fillStyle = prop.variant > 0.5 ? '#6f7b48' : '#2d482d';
            ctx.fillRect(-size * 0.1, -size, Math.max(1, size * 0.18), size * 1.7);
            ctx.fillRect(-size * 0.55, -size * 0.55, Math.max(1, size * 0.16), size * 1.2);
            ctx.fillRect(size * 0.42, -size * 0.42, Math.max(1, size * 0.14), size);
        } else if (prop.type === 'stone') {
            ctx.fillStyle = '#6d715f';
            ctx.fillRect(-size * 0.45, -size * 0.35, size * 0.9, size * 0.7);
            ctx.fillStyle = '#90937b';
            ctx.fillRect(-size * 0.3, -size * 0.28, size * 0.45, size * 0.2);
        } else if (prop.type === 'debris') {
            ctx.fillStyle = '#302d28';
            ctx.fillRect(-size, -size * 0.12, size * 2, size * 0.24);
            ctx.fillStyle = '#736348';
            ctx.fillRect(-size * 0.2, -size * 0.55, size * 0.3, size * 1.1);
        } else {
            ctx.fillStyle = 'rgba(34,31,23,0.42)';
            ctx.fillRect(-size, -size * 0.22, size * 2, size * 0.44);
            ctx.fillRect(-size * 0.25, -size, size * 0.5, size * 2);
        }
        ctx.restore();
    }

    // Katman 2: orduların karşılaşacağı ana ikmal yolu ve iki kanat patikası.
    const drawRoad = (points, width, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width * zoom;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'bevel';
        ctx.beginPath();
        points.forEach((point, index) => {
            const s = worldToScreen(point[0], point[1]);
            if (index === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
    };
    drawRoad([[1800, -80], [1710, 500], [1870, 980], [1800, 1500], [1900, 2480]], 112, 'rgba(70,54,35,0.42)');
    drawRoad([[1800, -80], [1710, 500], [1870, 980], [1800, 1500], [1900, 2480]], 72, 'rgba(137,112,72,0.38)');
    drawRoad([[-100, 1260], [650, 1330], [1320, 1200], [1800, 1260], [2400, 1210], [3050, 1300], [3700, 1190]], 52, 'rgba(105,84,55,0.24)');
    drawRoad([[1800, -80], [1710, 500], [1870, 980], [1800, 1500], [1900, 2480]], 5, 'rgba(49,39,28,0.46)');
    drawRoad([[1830, -80], [1740, 500], [1900, 980], [1830, 1500], [1930, 2480]], 5, 'rgba(49,39,28,0.38)');

    ctx.strokeStyle = 'rgba(8,22,12,0.10)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    const startGX = Math.floor(camera.x / gridSize) * gridSize;
    const startGY = Math.floor(camera.y / gridSize) * gridSize;
    const viewW = canvas.width / zoom;
    const viewH = canvas.height / zoom;
    
    for (let gx = startGX; gx < camera.x + viewW; gx += gridSize) {
        const sx = (gx - camera.x) * zoom;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); ctx.stroke();
    }
    for (let gy = startGY; gy < camera.y + viewH; gy += gridSize) {
        const sy = (gy - camera.y) * zoom;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy); ctx.stroke();
    }
    
    // Katman 3: savaş izleri.
    for (const c of craters) {
        const s = worldToScreen(c.x, c.y);
        if (s.x < -c.r * zoom || s.x > canvas.width + c.r * zoom || s.y < -c.r * zoom || s.y > canvas.height + c.r * zoom) continue;
        ctx.fillStyle = `rgba(10, 15, 10, ${c.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, c.r * zoom, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Decals'leri Çiz (Kan, Palet, Enkaz)
    for (const d of decals) {
        const s = worldToScreen(d.x, d.y);
        const zSize = d.size * zoom;
        if (s.x < -zSize || s.x > canvas.width + zSize || s.y < -zSize || s.y > canvas.height + zSize) continue;
        
        ctx.save();
        ctx.translate(s.x, s.y);
        if (d.angle) ctx.rotate(d.angle);
        ctx.globalAlpha = d.alpha;
        
        if (d.type === 'blood') {
            ctx.fillStyle = '#6b0000';
            ctx.beginPath(); ctx.arc(0, 0, zSize, 0, Math.PI*2); ctx.fill();
        } else if (d.type === 'track') {
            ctx.fillStyle = 'rgba(20, 15, 10, 0.4)';
            ctx.fillRect(-zSize, -zSize/2, zSize*2, zSize);
        } else if (d.type === 'wreck') {
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(-zSize, -zSize, zSize*2, zSize*2);
            ctx.strokeStyle = '#222'; ctx.lineWidth = 2*zoom; ctx.strokeRect(-zSize, -zSize, zSize*2, zSize*2);
        }
        ctx.restore();
    }

    // Katman 4: orman zemini. Ağaçlardan önce çizilir.
    for (const t of terrainFeatures) {
        if (t.type !== TERRAIN.FOREST) continue;
        const s = worldToScreen(t.x, t.y);
        const radius = t.r * zoom;
        if (s.x < -radius || s.x > canvas.width + radius || s.y < -radius || s.y > canvas.height + radius) continue;
        const forestFloor = ctx.createRadialGradient(s.x, s.y, radius * 0.15, s.x, s.y, radius);
        forestFloor.addColorStop(0, 'rgba(15,52,27,0.82)');
        forestFloor.addColorStop(0.72, 'rgba(24,68,35,0.70)');
        forestFloor.addColorStop(1, 'rgba(22,57,31,0)');
        ctx.fillStyle = forestFloor;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Katman 5: dağ kütleleri ve ağaç taçları.
    for (const t of terrainFeatures) {
        if (t.type === TERRAIN.MOUNTAIN) {
            const s = worldToScreen(t.x, t.y);
            if (s.x < -t.r * zoom || s.x > canvas.width + t.r * zoom || s.y < -t.r * zoom || s.y > canvas.height + t.r * zoom) continue;
            const radius = t.r * zoom;
            ctx.fillStyle = 'rgba(15,25,18,0.45)';
            ctx.beginPath();
            ctx.ellipse(s.x + radius * 0.16, s.y + radius * 0.22, radius * 1.05, radius * 0.78, 0, 0, Math.PI * 2);
            ctx.fill();

            const rockGradient = ctx.createRadialGradient(s.x - radius * 0.28, s.y - radius * 0.32, radius * 0.08, s.x, s.y, radius);
            rockGradient.addColorStop(0, '#8d927d');
            rockGradient.addColorStop(0.5, '#62695c');
            rockGradient.addColorStop(1, '#343b35');
            ctx.fillStyle = rockGradient;
            ctx.beginPath();
            ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#252b27';
            ctx.lineWidth = Math.max(2, 5 * zoom);
            ctx.stroke();

            for (const peak of t.peaks) {
                const p = worldToScreen(peak.x, peak.y);
                const pr = peak.r * zoom;
                ctx.fillStyle = 'rgba(190,194,172,0.18)';
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - pr);
                ctx.lineTo(p.x - pr * 0.78, p.y + pr * 0.62);
                ctx.lineTo(p.x + pr * 0.82, p.y + pr * 0.62);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(35,42,37,0.45)';
                ctx.lineWidth = Math.max(1, 2 * zoom);
                ctx.stroke();
            }
        } else if (t.type === TERRAIN.FOREST) {
            for (const tree of t.trees) {
                const s = worldToScreen(tree.x, tree.y);
                const tr = tree.r * zoom;
                if (s.x < -tr || s.x > canvas.width + tr || s.y < -tr || s.y > canvas.height + tr * 2) continue;

                ctx.fillStyle = 'rgba(7, 18, 10, 0.45)';
                ctx.beginPath();
                ctx.ellipse(s.x + tr * 0.4, s.y + tr * 0.6, tr, tr * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#493722';
                ctx.fillRect(s.x - tr * 0.13, s.y, tr * 0.26, tr * 0.85);
                ctx.fillStyle = tree.color;
                ctx.beginPath();
                ctx.arc(s.x, s.y, tr, 0, Math.PI * 2);
                ctx.fill();
                const grad = ctx.createRadialGradient(s.x - tr * 0.2, s.y - tr * 0.2, tr * 0.1, s.x, s.y, tr);
                grad.addColorStop(0, 'rgba(139,186,101,0.28)');
                grad.addColorStop(1, 'rgba(0,18,5,0.40)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(s.x, s.y, tr, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.16)';
                ctx.beginPath();
                ctx.arc(s.x + Math.cos(tree.offset)*tr*0.3, s.y + Math.sin(tree.offset)*tr*0.3, tr * 0.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    if (phase === PHASE.DEPLOY) {
        // Alt kısım (Oyuncu)
        const ls = worldToScreen(0, WORLD_H * 0.6); const le = worldToScreen(WORLD_W, WORLD_H);
        ctx.fillStyle = 'rgba(40, 100, 255, 0.06)'; ctx.fillRect(ls.x, ls.y, le.x - ls.x, le.y - ls.y);
        ctx.strokeStyle = 'rgba(80, 160, 255, 0.25)'; ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.strokeRect(ls.x, ls.y, le.x - ls.x, le.y - ls.y);

        // Üst kısım (Düşman AI)
        const rs = worldToScreen(0, 0); const re = worldToScreen(WORLD_W, WORLD_H * 0.4);
        ctx.fillStyle = 'rgba(255, 40, 40, 0.05)'; ctx.strokeRect(rs.x, rs.y, re.x - rs.x, re.y - rs.y);
        ctx.setLineDash([]);
    }

    const midS = worldToScreen(0, WORLD_H / 2);
    const midE = worldToScreen(WORLD_W, WORLD_H / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(midS.x, midS.y); ctx.lineTo(midE.x, midE.y); ctx.stroke(); ctx.setLineDash([]);
    
    // Siperleri Çiz (Trenches)
    for (const t of trenches) {
        const s = worldToScreen(t.x, t.y);
        const zr = t.r * zoom;
        if (s.x < -zr || s.x > canvas.width + zr || s.y < -zr || s.y > canvas.height + zr) continue;
        
        // Kum torbası ve mühimmat ikmal halkası.
        ctx.strokeStyle = t.isRed ? 'rgba(205, 105, 95, 0.9)' : 'rgba(178, 151, 84, 0.95)';
        ctx.lineWidth = 6 * zoom;
        ctx.beginPath();
        ctx.arc(s.x, s.y, zr, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = t.isRed ? 'rgba(75,28,24,0.30)' : 'rgba(38,68,47,0.38)';
        ctx.fill();

        ctx.setLineDash([8 * zoom, 6 * zoom]);
        ctx.strokeStyle = t.isRed ? 'rgba(255,130,110,0.5)' : 'rgba(92,220,150,0.62)';
        ctx.lineWidth = 2 * zoom;
        ctx.beginPath();
        ctx.arc(s.x, s.y, zr * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        const crate = 9 * zoom;
        ctx.fillStyle = '#70552d';
        ctx.fillRect(Math.round(s.x - crate * 1.4), Math.round(s.y - crate * 0.45), crate, crate * 0.8);
        ctx.fillRect(Math.round(s.x + crate * 0.4), Math.round(s.y - crate * 0.45), crate, crate * 0.8);
        ctx.strokeStyle = '#b69a58';
        ctx.lineWidth = Math.max(1, zoom);
        ctx.strokeRect(Math.round(s.x - crate * 1.4), Math.round(s.y - crate * 0.45), crate, crate * 0.8);
        ctx.strokeRect(Math.round(s.x + crate * 0.4), Math.round(s.y - crate * 0.45), crate, crate * 0.8);
        
        // HP Bar
        const fieldMaxHp = t.maxHp || 320;
        if (t.hp < fieldMaxHp) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(s.x - 15*zoom, s.y - zr - 10*zoom, 30*zoom, 4*zoom);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.fillRect(s.x - 15*zoom, s.y - zr - 10*zoom, (30*zoom) * (t.hp / fieldMaxHp), 4*zoom);
        }
    }

    // Haritanın fiziksel sınırı kameranın nerede olduğunu netleştirir.
    const topLeft = worldToScreen(0, 0);
    const bottomRight = worldToScreen(WORLD_W, WORLD_H);
    ctx.strokeStyle = 'rgba(211,225,190,0.28)';
    ctx.lineWidth = Math.max(2, 4 * zoom);
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    ctx.restore();
}

function drawFogOfWar() {
    // Deploy fazında fog of war yok - harita açık görünsün
    if (phase === PHASE.DEPLOY) return;
    
    // Savaş fazında fog of war aktif
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.fillStyle = 'rgba(10, 15, 10, 0.95)';
    fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

    fogCtx.globalCompositeOperation = 'destination-out';

    for (const u of units) {
        if (u.dead || u.isRed) continue;
        const s = worldToScreen(u.x, u.y);
        const vRadius = STATS[u.type].vision * zoom;
        
        if (s.x < -vRadius || s.x > canvas.width + vRadius || s.y < -vRadius || s.y > canvas.height + vRadius) continue;

        const grad = fogCtx.createRadialGradient(s.x, s.y, vRadius * 0.4, s.x, s.y, vRadius);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        fogCtx.fillStyle = grad;
        fogCtx.beginPath();
        fogCtx.arc(s.x, s.y, vRadius, 0, Math.PI * 2);
        fogCtx.fill();
    }
    
    ctx.drawImage(fogCanvas, 0, 0);
}

function drawGhost() {
    if (phase !== PHASE.DEPLOY || selectedSpawnType === null || mouseScreenY > canvas.height - 110) return;
    const world = screenToWorld(mouseScreenX, mouseScreenY);
    if (!isInPlayerZone(world.x, world.y)) return;

    const dw = drawW(), dh = drawH();
    ctx.globalAlpha = 0.45;
    const sx = SP_PAD + selectedSpawnType * (SP_W + SP_PAD);
    ctx.drawImage(spriteSheet, sx, SP_PAD, SP_W, SP_H, mouseScreenX - dw / 2, mouseScreenY - dh / 2, dw, dh);
    ctx.globalAlpha = 1.0;

    const range = STATS[selectedSpawnType].range;
    ctx.strokeStyle = 'rgba(0, 255, 120, 0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(mouseScreenX, mouseScreenY, range * zoom, 0, Math.PI * 2); ctx.stroke();
    
    // Vision preview
    const vision = STATS[selectedSpawnType].vision;
    ctx.strokeStyle = 'rgba(255, 255, 200, 0.1)'; ctx.lineWidth = 1; ctx.setLineDash([2, 8]);
    ctx.beginPath(); ctx.arc(mouseScreenX, mouseScreenY, vision * zoom, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
}

function drawSelectionBox() {
    if (!isDragging || phase !== PHASE.BATTLE) return;
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.5)'; ctx.fillStyle = 'rgba(0, 255, 80, 0.08)'; ctx.lineWidth = 1;
    ctx.fillRect(dragStartX, dragStartY, mouseScreenX - dragStartX, mouseScreenY - dragStartY);
    ctx.strokeRect(dragStartX, dragStartY, mouseScreenX - dragStartX, mouseScreenY - dragStartY);
}

function drawMinimap() {
    const mw = minimapCanvas.width = 200;
    const mh = minimapCanvas.height = 110;
    minimapCtx.fillStyle = '#1a221a';
    minimapCtx.fillRect(0, 0, mw, mh);

    for (const terrain of terrainFeatures) {
        const mx = terrain.x / WORLD_W * mw;
        const my = terrain.y / WORLD_H * mh;
        const rx = terrain.r / WORLD_W * mw;
        const ry = terrain.r / WORLD_H * mh;
        minimapCtx.fillStyle = terrain.type === TERRAIN.FOREST ? '#235c32' : '#70756a';
        minimapCtx.beginPath();
        minimapCtx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    minimapCtx.strokeStyle = 'rgba(255,255,255,0.2)'; minimapCtx.lineWidth = 1;
    minimapCtx.beginPath(); minimapCtx.moveTo(0, mh / 2); minimapCtx.lineTo(mw, mh / 2); minimapCtx.stroke();

    for (const u of units) {
        if (u.dead) continue;
        // Düşman sis içindeyse minimap'te de gözükmez
        if (u.isRed && phase === PHASE.BATTLE && !canSee(false, u.x, u.y)) continue;
        
        const mx = (u.x / WORLD_W) * mw, my = (u.y / WORLD_H) * mh;
        minimapCtx.fillStyle = u.isRed ? '#ff4444' : '#4488ff';
        minimapCtx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    const vx = (camera.x / WORLD_W) * mw, vy = (camera.y / WORLD_H) * mh;
    const vw = ((canvas.width / zoom) / WORLD_W) * mw, vh = (((canvas.height - 100) / zoom) / WORLD_H) * mh;
    minimapCtx.strokeStyle = 'rgba(255,255,255,0.5)'; minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(vx, vy, vw, vh);
}

spriteSheet.addEventListener('load', () => {
    document.querySelectorAll('.btn-icon').forEach(c => {
        const col = parseInt(c.dataset.col);
        c.width = 44; c.height = 32;
        const bctx = c.getContext('2d');
        bctx.imageSmoothingEnabled = false;
        bctx.drawImage(spriteSheet, SP_PAD + col * (SP_W + SP_PAD), SP_PAD, SP_W, SP_H, 0, 0, 44, 32);
    });
});

let lastFrameTime = 0;
let simulationTime = 0;

function updateTrenches(now) {
    for (let index = trenches.length - 1; index >= 0; index--) {
        const field = trenches[index];
        if ((field.expiresAt && now >= field.expiresAt) || field.hp <= 0) {
            trenches.splice(index, 1);
        }
    }
}

function gameLoop(timestamp) {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        resize();
    }
    
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = timestamp - lastFrameTime;
    const scaledDt = dt * GAME_SPEED;
    lastFrameTime = timestamp;
    simulationTime += scaledDt;

    if (screenShake > 0) {
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    updateCamera();

    if (phase === PHASE.BATTLE) {
        gameTime += scaledDt / 1000;
        updateTrenches(simulationTime);
        spatialGrid.clear();
        for (let i = units.length - 1; i >= 0; i--) {
            if (units[i].dead) {
                spawnExplosion(units[i].x, units[i].y);
                units.splice(i, 1);
            } else {
                spatialGrid.insert(units[i]);
            }
        }
        units.forEach(u => u.update(simulationTime));
        resolveCollisions();
        updateLayeredAI(simulationTime);
        updateParticles(scaledDt / 1000);
        updateSupport(scaledDt / 1000, simulationTime);
        battleTelemetry.update(scaledDt / 1000, simulationTime);
        checkGameOver();
    } else if (phase === PHASE.DEPLOY) {
        resolveCollisions();
    }

    drawMap();
    units.forEach(u => u.draw());
    drawParticles(ctx);
    drawSupport(ctx);
    drawAIWaypoints();
    drawFogOfWar();
    drawGhost();
    drawSelectionBox();
    drawMinimap();
    updateUI();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
