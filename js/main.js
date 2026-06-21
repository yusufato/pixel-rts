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
            if (selectedSupportMode === 'airstrike') {
                if (triggerAirstrike(world.x, world.y)) cancelSupportMode();
            } else if (selectedSupportMode === 'paradrop') {
                if (triggerParadrop(world.x, world.y)) cancelSupportMode();
            } else if (selectedSupportMode === 'supplydrop') {
                if (triggerSupply(world.x, world.y)) cancelSupportMode();
            } else if (selectedSupportMode === 'trench') {
                if (player.money >= 50) {
                    // En yakın istihkamcıyı bul
                    let nearestEng = null;
                    let minDist = Infinity;
                    for (const u of units) {
                        if (!u.dead && !u.isRed && u.type === T.ENGINEER) {
                            const d = Math.hypot(u.x - world.x, u.y - world.y);
                            if (d < minDist) { minDist = d; nearestEng = u; }
                        }
                    }
                    if (nearestEng) {
                        player.money -= 50;
                        nearestEng.buildTrenchTarget = { x: world.x, y: world.y };
                        nearestEng.manualTarget = null;
                        nearestEng.manualMoveTarget = null;
                    }
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
let selectedSupportMode = null; // 'airstrike' veya 'paradrop'

function cancelSupportMode() {
    selectedSupportMode = null;
    canvas.classList.remove('ghost-cursor');
    document.getElementById('btn-airstrike').style.borderColor = 'rgba(100, 200, 255, 0.4)';
    document.getElementById('btn-paradrop').style.borderColor = 'rgba(100, 200, 255, 0.4)';
    document.getElementById('btn-trench').style.borderColor = 'rgba(100, 200, 255, 0.4)';
}

document.getElementById('btn-airstrike').addEventListener('click', (e) => {
    e.stopPropagation();
    if (supportCooldowns.airstrike > 0) return;
    selectedSupportMode = selectedSupportMode === 'airstrike' ? null : 'airstrike';
    if (selectedSupportMode) {
        canvas.classList.add('ghost-cursor');
        document.getElementById('btn-airstrike').style.borderColor = '#ff4444';
        document.getElementById('btn-paradrop').style.borderColor = 'rgba(100, 200, 255, 0.4)';
        document.getElementById('btn-trench').style.borderColor = 'rgba(100, 200, 255, 0.4)';
    } else {
        cancelSupportMode();
    }
});

document.getElementById('btn-paradrop').addEventListener('click', (e) => {
    e.stopPropagation();
    if (supportCooldowns.paradrop > 0) return;
    selectedSupportMode = selectedSupportMode === 'paradrop' ? null : 'paradrop';
    if (selectedSupportMode) {
        canvas.classList.add('ghost-cursor');
        document.getElementById('btn-paradrop').style.borderColor = '#4cff7c';
        document.getElementById('btn-airstrike').style.borderColor = 'rgba(100, 200, 255, 0.4)';
        document.getElementById('btn-trench').style.borderColor = 'rgba(100, 200, 255, 0.4)';
    } else {
        cancelSupportMode();
    }
});

document.getElementById('btn-trench').addEventListener('click', (e) => {
    e.stopPropagation();
    if (player.money < 50) return;
    selectedSupportMode = selectedSupportMode === 'trench' ? null : 'trench';
    if (selectedSupportMode) {
        canvas.classList.add('ghost-cursor');
        document.getElementById('btn-trench').style.borderColor = '#ffcc00';
        document.getElementById('btn-airstrike').style.borderColor = 'rgba(100, 200, 255, 0.4)';
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

    phase = PHASE.OVER;
    const title = document.getElementById('game-over-title');
    if (won === 'draw') { title.textContent = '🤝 BERABERE!'; title.style.color = '#ffaa00'; }
    else if (won) { title.textContent = '🏆 ZAFER!'; title.style.color = '#4cff7c'; }
    else { title.textContent = '💀 YENİLDİN!'; title.style.color = '#ff4444'; }

    document.getElementById('score-table').innerHTML = `
        <div class="score-row"><span>Sonuç</span><span class="score-val">${won === 'draw' ? 'Berabere' : won ? 'Kazandın' : 'Kaybettin'}</span></div>
        <div class="score-row"><span>Öldürdüğün Düşman</span><span class="score-val">${player.kills}</span></div>
        <div class="score-row"><span>Ürettiğin Birim</span><span class="score-val">${player.unitsSpawned}</span></div>
        <div class="score-row"><span>Kaybettiğin Birim</span><span class="score-val">${enemy.kills}</span></div>
    `;
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
        
        document.getElementById('cd-airstrike').style.height = `${(supportCooldowns.airstrike / MAX_CD_AIRSTRIKE) * 100}%`;
        document.getElementById('cd-paradrop').style.height = `${(supportCooldowns.paradrop / MAX_CD_PARADROP) * 100}%`;
        document.getElementById('cd-supply').style.height = `${(supportCooldowns.supplydrop / MAX_CD_SUPPLY) * 100}%`;
        
        document.getElementById('btn-airstrike').style.borderColor = selectedSupportMode === 'airstrike' ? '#fff' : '#555';
        document.getElementById('btn-paradrop').style.borderColor = selectedSupportMode === 'paradrop' ? '#fff' : '#555';
        document.getElementById('btn-supply').style.borderColor = selectedSupportMode === 'supplydrop' ? '#fff' : '#555';
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
    ctx.fillStyle = '#3a5f3a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
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
    
    // Kraterleri Çiz
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

    for (const t of terrainFeatures) {
        if (t.type === TERRAIN.MOUNTAIN) {
            const s = worldToScreen(t.x, t.y);
            if (s.x < -t.r * zoom || s.x > canvas.width + t.r * zoom || s.y < -t.r * zoom || s.y > canvas.height + t.r * zoom) continue;
            ctx.fillStyle = '#4a4a4a';
            ctx.beginPath(); ctx.arc(s.x, s.y, t.r * zoom, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#222'; ctx.lineWidth = 2 * zoom; ctx.stroke();
            ctx.fillStyle = '#888'; ctx.font = `${30 * zoom}px Arial`; ctx.fillText('⛰️', s.x, s.y + 10*zoom);
        } else if (t.type === TERRAIN.FOREST) {
            // Ormanı çok daha yoğun çizeceğiz
            for (const tree of t.trees) {
                const s = worldToScreen(tree.x, tree.y);
                const tr = tree.r * zoom;
                if (s.x < -tr || s.x > canvas.width + tr || s.y < -tr || s.y > canvas.height + tr * 2) continue;
                
                // Ağacın yere düşen gölgesi (güneş sol üstten)
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.beginPath();
                ctx.ellipse(s.x + tr * 0.4, s.y + tr * 0.6, tr, tr * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();

                // Ağacın gövdesi / hacmi (alt katman, karanlık)
                const baseColor = tree.color;
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.arc(s.x, s.y, tr, 0, Math.PI * 2);
                ctx.fill();

                // Ağacın tepe aydınlatması (güneş vuran yerler)
                const grad = ctx.createRadialGradient(s.x - tr * 0.2, s.y - tr * 0.2, tr * 0.1, s.x, s.y, tr);
                grad.addColorStop(0, 'rgba(100, 255, 100, 0.15)'); // Hafif ışık
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)'); // Alt kenar karanlık
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(s.x, s.y, tr, 0, Math.PI * 2);
                ctx.fill();
                
                // Doğallık için ağaç üstüne nokta detayı
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
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
        
        // Kum torbası çemberi
        ctx.strokeStyle = t.isRed ? 'rgba(200, 100, 100, 0.8)' : 'rgba(150, 130, 80, 0.8)';
        ctx.lineWidth = 6 * zoom;
        ctx.beginPath();
        ctx.arc(s.x, s.y, zr, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        
        // HP Bar
        if (t.hp < 250) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(s.x - 15*zoom, s.y - zr - 10*zoom, 30*zoom, 4*zoom);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.fillRect(s.x - 15*zoom, s.y - zr - 10*zoom, (30*zoom) * (t.hp / 250), 4*zoom);
        }
    }
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

    minimapCtx.strokeStyle = 'rgba(255,255,255,0.2)'; minimapCtx.lineWidth = 1;
    minimapCtx.beginPath(); minimapCtx.moveTo(mw / 2, 0); minimapCtx.lineTo(mw / 2, mh); minimapCtx.stroke();

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
function gameLoop(timestamp) {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        resize();
    }
    
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (screenShake > 0) {
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    updateCamera();

    if (phase === PHASE.BATTLE) {
        gameTime += dt / 1000;
        spatialGrid.clear();
        for (let i = units.length - 1; i >= 0; i--) {
            if (units[i].dead) {
                spawnExplosion(units[i].x, units[i].y);
                units.splice(i, 1);
            } else {
                spatialGrid.insert(units[i]);
            }
        }
        units.forEach(u => u.update(timestamp));
        resolveCollisions();
        updateAITactics(timestamp);
        updateParticles(dt / 1000);
        updateSupport(dt / 1000, timestamp);
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
