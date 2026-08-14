// ─── DEPLOY: TIKLA-TAŞI ───
// Yerleştirilmiş bir birliği yeniden konumlandırmak için sürükleme yok: bir tık alır,
// bir tık bırakır. Fare basılı tutmak gerekmediği için uzun mesafede el titremesi/
// buton bırakma sorunu yaşanmaz, birlik tam farenin durduğu noktaya oturur.
let deployCarried = null;

const DEPLOY_MIN_GAP = 30;   // iki birlik merkezi arası en az mesafe

function playerCanControlBattleUnit(unit) {
    if (!unit || unit.dead || unit.isRed !== myCanonicalSide) return false;
    if (typeof MP !== 'undefined' && MP.active) return true;
    return !unit.ally && unit.controlOwner === CONTROL_OWNER.PLAYER;
}

function deployUnitAt(wx, wy) {
    const mySide = (typeof myCanonicalSide !== 'undefined' ? myCanonicalSide : false);
    let best = null, bestDist = DEPLOY_MIN_GAP;
    for (const u of units) {
        if (u.dead || u.isRed !== mySide || u.ally) continue;
        const d = Math.hypot(u.x - wx, u.y - wy);
        if (d < bestDist) { best = u; bestDist = d; }
    }
    return best;
}

// Hedef nokta boş mu (taşınan birliğin kendisi sayılmaz)
function deploySpotFree(wx, wy, ignore) {
    for (const u of units) {
        if (u === ignore || u.dead) continue;
        if (Math.hypot(u.x - wx, u.y - wy) < DEPLOY_MIN_GAP) return false;
    }
    return true;
}

function deployDropCarried(wx, wy) {
    const u = deployCarried;
    if (!u) return;
    // Geçersiz nokta (kendi bölgen dışı, dolu ya da geçilmez arazi) → birlik yerinde kalır
    if (isInPlayerZone(wx, wy) && deploySpotFree(wx, wy, u)) {
        if (typeof terrainSafePoint === 'function') {
            const safe = terrainSafePoint(wx, wy, 30);
            wx = safe.x; wy = safe.y;
        }
        u.x = wx; u.y = wy;
        u.targetX = wx; u.targetY = wy;
    }
    u.selected = false;
    deployCarried = null;
    canvas.classList.remove('ghost-cursor');
}

// Faz 0/1b: oyuncu komut kuyruğu — fare işleyicisi buraya iter, stepSim başında tik-sınırında uygulanır.
let pendingPlayerCommands = [];
// ÇOK OYUNCULU KÖPRÜSÜ: bu kuyruk YEREL'dir; stepSim onu yalnız bu bilgisayarda uygular. Lockstep'te
// sağ-tık (move/attack) ağa gidiyordu ama YETENEK yolları gitmiyordu — sol-panel yeteneği, M (mayın),
// U (indir) tetikleyen oyuncu maçı ANINDA ayrıştırıyordu (iki PC'de farklı dünya → desync uyarısı).
// Çözüm engellemek değil bağlamak: MP açıkken komut aynı tik-kuyruğundan AĞA yazılır, iki tarafta
// sabit sırayla (önce mavi, sonra kırmızı) uygulanır. Tek oyunculu yol DEĞİŞMEZ.
function queuePlayerCommand(type, payload) {
    if (typeof MP !== 'undefined' && MP.active) {
        if (typeof mpEmitEvent === 'function') mpEmitEvent(type, payload);
        return;
    }
    if (typeof pendingPlayerCommands !== 'undefined') pendingPlayerCommands.push({ type, payload });
}
canvas.addEventListener('mousemove', (e) => { const p = canvasPoint(e); mouseScreenX = p.x; mouseScreenY = p.y; });
canvas.addEventListener('mousedown', (e) => {
    const p = canvasPoint(e);
    if (e.button !== 0 || p.y > canvas.height - 110) return;
    if (phase === PHASE.DEPLOY) {
        const world = screenToWorld(p.x, p.y);
        // TIKLA-TAŞI: elde birim tipi yokken sahadaki bir birliğe tıklamak onu "eline alır";
        // ikinci tık onu bırakır. Sürükleme gerekmez, birlik tam farenin durduğu yere gider.
        if (selectedSpawnType === null) {
            if (deployCarried) { deployDropCarried(world.x, world.y); return; }
            const picked = deployUnitAt(world.x, world.y);
            if (picked) {
                deployCarried = picked; picked.selected = true; canvas.classList.add('ghost-cursor');
                // Sahadaki birliğe tıklamak da künyesini açar (barla aynı kaynak).
                if (typeof showDeployDossier === 'function') { _deployDossierPinned = picked.type; showDeployDossier(picked.type); }
            }
            return;
        }
        if (isInPlayerZone(world.x, world.y) && deploySpotFree(world.x, world.y, null)) {
            placeUnit(selectedSpawnType, world.x, world.y, (typeof myCanonicalSide !== 'undefined' ? myCanonicalSide : false));
        }
        return;
    }
    if (phase === PHASE.BATTLE) {
        if (selectedSupportMode) {
            const world = screenToWorld(p.x, p.y);
            if (selectedSupportMode === 'paradrop') {
                if (triggerParadrop(world.x, world.y)) cancelSupportMode();
            } else if (selectedSupportMode === 'trench') {
                let nearestEng = null;
                let minDist = Infinity;
                for (const u of units) {
                    if (playerCanControlBattleUnit(u) && u.type === T.ENGINEER && !u.buildTrenchTarget) {
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
            } else if (selectedSupportMode.indexOf('ability:') === 0) {
                // SOL-PANEL HEDEFLİ YETENEK: haritaya tık → seçili uygun birimler için player-ability kuyruğa (replay-güvenli)
                const abId = selectedSupportMode.slice(8);
                const meta = (typeof ABILITY_META !== 'undefined') ? ABILITY_META[abId] : null;
                const ids = units.filter(u => u.selected && playerCanControlBattleUnit(u) && (!meta || !meta.need || meta.need(u))).map(u => u.id);
                if (ids.length) {
                    queuePlayerCommand('player-ability', { ability: abId, unitIds: ids, x: Math.round(world.x * 100) / 100, y: Math.round(world.y * 100) / 100 });
                    if (typeof battleLearnMessage === 'function') battleLearnMessage((meta ? meta.icon + ' ' + meta.label : abId) + ' emri verildi', 1500);
                }
                cancelSupportMode();
            }
            return;
        }
    }
    
    // ÇİFT TIKLAMA İLE AYNI BİRİMLERİ SEÇME
    if (e.detail === 2) {
        const world = screenToWorld(p.x, p.y);
        let clickedType = null;
        for (const u of units) {
            if (playerCanControlBattleUnit(u) && Math.hypot(u.x - world.x, u.y - world.y) < 30) {
                clickedType = u.type;
                break;
            }
        }
        if (clickedType !== null) {
            const viewW = canvas.width / zoom;
            const viewH = canvas.height / zoom;
            units.forEach(u => {
                if (playerCanControlBattleUnit(u) && u.type === clickedType) {
                    if (u.x >= camera.x && u.x <= camera.x + viewW && u.y >= camera.y && u.y <= camera.y + viewH) {
                        u.selected = true;
                    }
                }
            });
            return;
        }
    }

    isDragging = true; dragStartX = p.x; dragStartY = p.y;
    if (!e.shiftKey) units.forEach(u => { if (u.isRed === myCanonicalSide) u.selected = false; });
});
canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    const p = canvasPoint(e);

    if (phase === PHASE.DEPLOY) {
        isDragging = false;   // yerleştirme ve taşıma mousedown'da bitiyor
        return;
    }

    if (!isDragging) return;
    isDragging = false;
    const minSX = Math.min(dragStartX, mouseScreenX), maxSX = Math.max(dragStartX, mouseScreenX);
    const minSY = Math.min(dragStartY, mouseScreenY), maxSY = Math.max(dragStartY, mouseScreenY);
    if (maxSX - minSX < 5 && maxSY - minSY < 5) {
        const world = screenToWorld(p.x, p.y);
        // KARE SINIR: tıklama testi de KUTU olur — çizilen çerçevenin içine tıklayan birimi seçer
        // (eski 30px'lik daire, 64px'lik kutunun köşelerini kaçırıyordu).
        const _box = (typeof battleBoxCollision === 'function') && battleBoxCollision();
        let bestUnit = null, bestDist = _box ? Infinity : 30;
        for (const u of units) {
            if (!playerCanControlBattleUnit(u)) continue;
            if (_box && (Math.abs(u.x - world.x) > UNIT_HALF_W || Math.abs(u.y - world.y) > UNIT_HALF_H)) continue;
            const d = Math.hypot(u.x - world.x, u.y - world.y);
            if (d < bestDist) { bestUnit = u; bestDist = d; }
        }
        if (bestUnit) bestUnit.selected = true;
    } else {
        const topLeft = screenToWorld(minSX, minSY), bottomRight = screenToWorld(maxSX, maxSY);
        for (const u of units) {
            if (!playerCanControlBattleUnit(u)) continue;
            if (u.x >= topLeft.x && u.x <= bottomRight.x && u.y >= topLeft.y && u.y <= bottomRight.y) u.selected = true;
        }
    }
});
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const p = canvasPoint(e);
    if (phase === PHASE.DEPLOY) {
        // HAVUZ MODU: elde birlik varken sağ tık = havuza İADE (yanlış yerleştirmeyi geri al).
        // Havuzda ödeme yok, o yüzden "geri satmak" yerine sayaç geri artırılır.
        if (deployCarried && typeof DEPLOY_POOL !== 'undefined' && DEPLOY_POOL) {
            const u = deployCarried;
            DEPLOY_POOL[u.type] = (DEPLOY_POOL[u.type] | 0) + 1;
            u.dead = true;
            const ix = units.indexOf(u); if (ix >= 0) units.splice(ix, 1);
            deployCarried = null;
            canvas.classList.remove('ghost-cursor');
            return;
        }
        // KUSUR (kullanici raporu 2026-08-09): "dizerken yanlislikla koydugum birligi geri alamiyorum."
        // Eskiden sag tik YALNIZ ELDEKI birimi iade ediyordu; SAHAYA KONMUS birimi geri almanin yolu yoktu.
        // Simdi: elde birim yokken sag tik, imlecin altindaki KENDI birimini havuza iade eder.
        // ⚠ VARSAYILAN KAPALI (2026-08-09): bu ozellik eklendikten sonraki macta "Mavi sag kalan 1,
        // oldurme 0/0" goruldu. Sag tik dizim sirasinda BASKA amaclarla da kullaniliyor (secim iptali)
        // ve o durumda birimler SESSIZCE havuza donuyor olabilir. Kanit yok ama risk gercek →
        // dogrulanana kadar bayrakla kapali. Acmak icin: BATTLE_DEPLOY_SAGTIK_IADE = true.
        if ((typeof BATTLE_DEPLOY_SAGTIK_IADE !== 'undefined' && BATTLE_DEPLOY_SAGTIK_IADE) &&
            !deployCarried && !selectedSpawnType) {
            const _w = screenToWorld(p.x, p.y);
            let _hedef = null, _en = Infinity;
            for (const u of units) {
                if (u.dead || u.isRed || (u.ally && typeof u.ally !== 'undefined' && u.ally === true && false)) continue;
                const d = Math.hypot(u.x - _w.x, u.y - _w.y);
                if (d <= Math.max(28, UNIT_RADIUS + 8) && d < _en) { _en = d; _hedef = u; }
            }
            // ⚠ KOK NEDEN (kullanici "hala silemiyorum" dedi): ilk surum YALNIZ `DEPLOY_POOL` varsa
            // calisiyordu. Havuz SADECE hikaye modunda dolu; Hizli Mac/MP'de `null` (Story.js:1362) →
            // Hizli Mac'ta kural HIC calismiyordu. Simdi iki yol da var: havuz varsa sayaca iade,
            // yoksa PARAYA iade (Hizli Mac'ta birim parayla aliniyor).
            if (_hedef) {
                const _st = STATS[_hedef.type];
                const _bedel = _st ? (_st.cost || 0) : 0;
                if (typeof DEPLOY_POOL !== 'undefined' && DEPLOY_POOL) {
                    DEPLOY_POOL[_hedef.type] = (DEPLOY_POOL[_hedef.type] | 0) + 1;
                } else if (typeof player !== 'undefined' && player) {
                    player.money = (player.money || 0) + _bedel;
                }
                _hedef.dead = true;
                const ix = units.indexOf(_hedef); if (ix >= 0) units.splice(ix, 1);
                if (typeof battleLearnMessage === 'function') battleLearnMessage('↩️ Birlik geri alındı', 1200);
                canvas.classList.remove('ghost-cursor');
                return;
            }
        }
        selectedSpawnType = null;
        if (deployCarried) { deployCarried.selected = false; deployCarried = null; }   // taşımayı iptal et
        document.querySelectorAll('.spawn-btn').forEach(b => b.classList.remove('selected-btn'));
        canvas.classList.remove('ghost-cursor');
        return;
    }
    if (selectedSupportMode) {
        cancelSupportMode();
        return;
    }
    if (phase !== PHASE.BATTLE) return;
    if (typeof MP !== 'undefined' && MP.active) {
        const w = screenToWorld(p.x, p.y);
        const sel = units.filter(u => u.selected && u.isRed === myCanonicalSide && !u.dead);
        if (!sel.length) return;
        // TAŞIMA BİNDİR (çok oyunculu): MP dalı her sağ-tıkı hareket/saldırı sayıyordu, bindirme
        // mantığına HİÇ ulaşılmıyordu — indirme (U) çalışırken bindirme online'da imkânsızdı.
        // Hedef seçimi YEREL sis'e bakmaz (dost birim, iki PC'de de görünür) → determinizm bozulmaz.
        const _loaders = sel.filter(u => u.transportSlots > 0 && u.cargo.length < u.transportSlots);
        if (_loaders.length) {
            let _lt = null;
            for (const u of units) {
                if (u.dead || u.loaded || u.isRed !== myCanonicalSide || u.transportSlots > 0) continue;
                const st = STATS[u.type];
                if (!st || st.armorType !== 'infantry') continue;
                if (Math.hypot(u.x - w.x, u.y - w.y) < 34) { _lt = u; break; }
            }
            if (_lt) {
                mpEmitEvent('player-load', { transportIds: _loaders.map(u => u.id), targetId: _lt.id });
                return;
            }
        }
        let isAttack = false;   // saldırı/hareket kararı BENİM sis'ime göre; hedef ise apply'da sis'siz çözülür (iki PC eşit)
        for (const u of units) {
            if (u.dead || u.isRed === myCanonicalSide || !canSee(myCanonicalSide, u.x, u.y, u.isAir)) continue;
            if (Math.hypot(u.x - w.x, u.y - w.y) < 30) { isAttack = true; break; }
        }
        mpEmitCommand(isAttack ? 'attack' : 'move', sel.map(u => u.id), w.x, w.y);
        return;
    }
    const world = screenToWorld(p.x, p.y);
    const selectedUnits = units.filter(u => u.selected && playerCanControlBattleUnit(u));
    if (selectedUnits.length === 0) return;

    // ── TAŞIMA BİNDİR: seçili boş-slotlu taşıyıcı + imleç altında DOST binebilir piyade → yükle emri ──
    const loaders = selectedUnits.filter(u => u.transportSlots > 0 && u.cargo.length < u.transportSlots);
    if (loaders.length) {
        const side = loaders[0].isRed;
        let loadTarget = null;
        for (const u of units) {
            if (u.dead || u.loaded || u.isRed !== side || u.transportSlots > 0) continue;
            const st = STATS[u.type];
            if (!st || st.armorType !== 'infantry') continue;   // yalnız yaya piyade binebilir
            if (Math.hypot(u.x - world.x, u.y - world.y) < 34) { loadTarget = u; break; }
        }
        if (loadTarget) {
            pendingPlayerCommands.push({ type: 'player-load', payload: {
                transportIds: loaders.map(u => u.id), targetId: loadTarget.id
            } });
            return;
        }
    }

    let targetEnemy = null;
    for (const u of units) {
        if (u.dead || !u.isRed || !canSee(false, u.x, u.y, u.isAir)) continue;
        if (Math.hypot(u.x - world.x, u.y - world.y) < 30) { targetEnemy = u; break; }
    }
    // DETERMİNİZM (Faz 0/1b): komutun ETKİSİNİ tık anında çöz (formasyon/hedef), ama birim-mutasyonu +
    // kaydı TİK SINIRINA ERTELE (stepSim başında flushPendingPlayerCommands). Fare işleyicisi asenkron
    // olduğundan doğrudan uygulamak canlı↔replay zamanlama sapması üretiyordu. Kuyruğa alınan komut,
    // replay ile AYNI kod yolundan (battleApplyRecordedEvent) uygulanır → canlı-oyuncu maçı bit-birebir.
    if (targetEnemy) {
        pendingPlayerCommands.push({ type: 'player-attack', payload: {
            unitIds: selectedUnits.map(unit => unit.id),
            targetId: targetEnemy.id
        } });
    } else {
        const count = selectedUnits.length;
        // KUSUR (kullanıcı raporu 2026-08-09): "birden fazla birlik tutup emir verdiğimde imlecin
        // uç noktasına değil SOL ÜST tarafına gidiyorlar." DOĞRULANDI (aritmetik):
        // ızgara KUTUNUN merkezine hizalanıyordu, DOLU HÜCRELERİN merkezine değil. Son satır eksik
        // dolduğunda kütle merkezi sola-yukarı kayıyor — 5 birimde (−0.2, −0.1)×spacing, birim
        // sayısı arttıkça büyür. DÜZELTME: ofsetlerin ORTALAMASI çıkarılır → merkez tam imleçte.
        const _ofs = formationOffsets(count);   // ONIZLEME ile AYNI kaynak
        const destinations = selectedUnits.map((unit, i) => {
            const desired = { x: world.x + _ofs[i].x, y: world.y + _ofs[i].y };
            const safe = typeof terrainSafePoint === 'function' ? terrainSafePoint(desired.x, desired.y) : desired;
            return { id: unit.id, x: Math.round(safe.x * 100) / 100, y: Math.round(safe.y * 100) / 100 };
        });
        pendingPlayerCommands.push({ type: 'player-move', payload: {
            unitIds: selectedUnits.map(unit => unit.id),
            x: Math.round(world.x * 100) / 100,
            y: Math.round(world.y * 100) / 100,
            destinations
        } });
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
// ═══ SOL-PANEL YETENEK-SEÇİCİ ═══
// Birime tıkla → sol-panel o birimin yeteneklerini gösterir → aktif olanı tıkla (hedefli ise haritaya tık) → tetikle.
// AKTİF = oyuncu-tetikli (player-ability kuyruğu, replay-güvenli). PASİF = motor otomatik tetikler (bilgi-çipi).
// need(u): birim bu yeteneği kullanabilir mi. targeted: haritada yer seçmeli mi.
const ABILITY_META = {
    // KEŞİF ARACI da mayın döşer (kullanıcı isteği): hızlı, gizli ve ileride olan birim — geçiş noktasını
    // erken kapatmak doğal işi. İstihkâm hâlâ mayın temizleyen tek birim.
    lay_mines:           { label: 'MAYIN DÖŞE', icon: '💣', active: true,  targeted: false, need: u => u.type === T.ENGINEER || u.type === T.RECON },
    build_fortification: { label: 'SİPER KAZ',  icon: '⛏',  active: true,  targeted: true,  need: u => u.type === T.ENGINEER },
    build_hospital:      { label: 'HASTANE KUR', icon: '🏥', active: true, targeted: true,  need: u => u.type === T.MEDIC },
    unload:              { label: 'İNDİR',      icon: '🪖', active: true,  targeted: false, need: u => u.transportSlots > 0 && u.cargo && u.cargo.length > 0 },
    launch_drone:        { label: 'DRONE SAL',  icon: '🛩', active: true,  targeted: true,  need: u => u.type === T.DRONE_OPERATOR && (u.payloadCount == null || u.payloadCount > 0) },
    // PASİF (otomatik) — panelde bilgi-çipi:
    dig_in:          { label: 'Siperlen',    icon: '⛏',  active: false },
    garrison:        { label: 'Mevzilen',    icon: '🏚',  active: false },
    ambush:          { label: 'Pusu',        icon: '🌿', active: false },
    stay_hidden:     { label: 'Gizlen',      icon: '🌿', active: false },
    infiltrate:      { label: 'Sız',         icon: '🥷', active: false },
    overrun:         { label: 'Ez-geç',      icon: '⚡', active: false },
    sabotage:        { label: 'Sabotaj',     icon: '💥', active: false },
    mark_target:     { label: 'Hedef-işaretle', icon: '🎯', active: false },
    shoot_and_scoot: { label: 'Vur-kaç',     icon: '🏃', active: false },
    deploy:          { label: 'Kurulum',     icon: '🔧', active: false },
    hold_fire:       { label: 'Ateş-disiplini', icon: '✋', active: false },
    barrage:         { label: 'Baraj',       icon: '💥', active: false },
    smoke_barrage:   { label: 'Duman',       icon: '🌫', active: false },
    clear_mines:     { label: 'Mayın-temizle', icon: '🧹', active: false },
    build_bridge:    { label: 'Köprü',       icon: '🌉', active: false }
};
let _abilityPanelSig = null;
function _abilitySelectedUnits() {
    return units.filter(u => u.selected && playerCanControlBattleUnit(u));
}
function renderAbilityPanel() {
    const panel = document.getElementById('ui-abilities');
    if (!panel) return;
    const sel = (typeof phase !== 'undefined' && phase === PHASE.BATTLE) ? _abilitySelectedUnits() : [];
    if (!sel.length) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
    const abilitySet = new Set();
    for (const u of sel) { const st = STATS[u.type]; if (st && st.abilities) for (const a of st.abilities) abilitySet.add(a); }
    const actives = [], passives = [];
    for (const a of abilitySet) {
        const m = ABILITY_META[a]; if (!m) continue;
        if (m.active) { if (sel.some(u => !m.need || m.need(u))) actives.push({ id: a, m }); }
        else passives.push({ id: a, m });
    }
    if (!actives.length && !passives.length) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
    let html = '<div class="ability-head">YETENEKLER · ' + sel.length + ' birim</div>';
    if (actives.length) {
        html += '<div class="ability-row">';
        for (const { id, m } of actives) {
            const on = (selectedSupportMode === 'ability:' + id) ? ' active' : '';
            html += '<button class="ability-btn' + on + '" data-ability="' + id + '"><b>' + m.icon + '</b><span>' + m.label + (m.targeted ? ' ▸yer' : '') + '</span></button>';
        }
        html += '</div>';
    }
    if (passives.length) {
        html += '<div class="ability-chips">';
        for (const { id, m } of passives) html += '<span class="ability-chip">' + m.icon + ' ' + m.label + '<em>oto</em></span>';
        html += '</div>';
    }
    panel.innerHTML = html;
    panel.style.display = 'flex';
}
// Seçim/mod değişince yeniden çiz (her karede imza kontrolü — DOM'u boşuna kurma, hedefleme-vurgusu kaybolmasın).
function refreshAbilityPanelIfChanged() {
    const inBattle = (typeof phase !== 'undefined' && phase === PHASE.BATTLE);
    const sel = inBattle ? _abilitySelectedUnits() : [];
    const sig = inBattle ? (sel.map(u => u.id).sort().join(',') + '|' + (selectedSupportMode || '')) : 'off';
    if (sig === _abilityPanelSig) return;
    _abilityPanelSig = sig;
    renderAbilityPanel();
}
document.getElementById('ui-abilities')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ability]'); if (!btn) return;
    e.stopPropagation();
    const id = btn.dataset.ability;
    const m = ABILITY_META[id]; if (!m || !m.active) return;
    if (m.targeted) {
        // Hedefli: hedefleme-moduna gir; haritaya tık mousedown'da kuyruğa yazar (trench deseni).
        selectedSupportMode = (selectedSupportMode === 'ability:' + id) ? null : ('ability:' + id);
        canvas.classList.toggle('ghost-cursor', !!selectedSupportMode);
        _abilityPanelSig = null; refreshAbilityPanelIfChanged();
    } else {
        // Anlık: seçili uygun birimler için hemen kuyruğa (M/U tuşlarının panel karşılığı).
        const ids = _abilitySelectedUnits().filter(u => !m.need || m.need(u)).map(u => u.id);
        if (ids.length) {
            queuePlayerCommand('player-ability', { ability: id, unitIds: ids });
            if (typeof battleLearnMessage === 'function') battleLearnMessage(m.icon + ' ' + m.label + ' emri verildi', 1500);
        }
        cancelSupportMode();
    }
});
// SPAWN-BAR: 25 tipi STATS'tan DİNAMİK üret (roster sırası, doğru indeks+sprite+isim+maliyet). Event-delegation ile wiring.
function renderSpawnIcons() {
    if (typeof spriteSheet === 'undefined' || !spriteSheet.complete || !spriteSheet.naturalWidth) return;
    document.querySelectorAll('.btn-icon').forEach(c => {
        const col = parseInt(c.dataset.col);
        c.width = 44; c.height = 32;
        const bctx = c.getContext('2d'); bctx.imageSmoothingEnabled = false; bctx.clearRect(0, 0, 44, 32);
        bctx.drawImage(spriteSheet, SP_PAD + (typeof battleSpriteCol === 'function' ? battleSpriteCol(col) : col) * (SP_W + SP_PAD), SP_PAD, SP_W, SP_H, 0, 0, 44, 32);
    });
}
// KATEGORİLİ SPAWN-BAR: 7 grup butonu; tıkla → o kategorinin birimleri flyout'ta açılır → seç+yerleştir.
const SPAWN_CATEGORIES = [
    { id: 'inf',     label: '👣 Piyade',    ids: ['infantry', 'at_team', 'mortar_team', 'manpads_team', 'commando'] },
    { id: 'armor',   label: '🛡️ Zırhlı',    ids: ['mbt', 'ifv', 'tank_destroyer'] },
    { id: 'arty',    label: '💥 Dolaylı',   ids: ['artillery', 'mlrs', 'ballistic_missile'] },
    { id: 'aa',      label: '🎯 Hava-Sav.', ids: ['spaag', 'sam_battery'] },
    { id: 'air',     label: '✈️ Hava',      ids: ['attack_helo', 'transport_helo', 'recon_uav', 'armed_uav', 'drone_operator'] },   // redesign: tek-tek kamikaze YERİNE drone-operatör (2 drone SALAR → DRONE SAL yeteneği)
    { id: 'recon',   label: '📡 Keşif/EH',  ids: ['scout_vehicle', 'counter_battery_radar', 'ew_vehicle'] },
    { id: 'support', label: '🚑 Destek',    ids: ['medic', 'engineer', 'supply_truck', 'command_vehicle'] }
];
let _openSpawnCat = null;
function _typeIdx(id) { return (typeof UNIT_ID_BY_INDEX !== 'undefined') ? UNIT_ID_BY_INDEX.indexOf(id) : -1; }
function _spawnUnitBtnHTML(i) {
    const s = STATS[i]; if (!s) return '';
    const RES_ICON = { manpower: '👣', oil: '⛽', points: '⭐' };
    const icon = RES_ICON[(typeof UNIT_RES_GROUP !== 'undefined' && UNIT_RES_GROUP[i]) || 'points'] || '⭐';
    return `<button class="spawn-btn" data-type="${i}" title="${s.name}"><canvas class="btn-icon" data-col="${i}"></canvas><div class="btn-label">${s.name}</div><div class="btn-cost">${icon}${s.cost}</div></button>`;
}
function buildSpawnBar() {
    const bar = document.getElementById('ui-spawn-bar'); if (!bar) return;
    let cats = '';
    for (const c of SPAWN_CATEGORIES) cats += `<button class="spawn-cat" data-cat="${c.id}">${c.label}</button>`;
    bar.innerHTML = `<div id="spawn-flyout" class="spawn-flyout hidden"></div><div class="spawn-cats">${cats}</div>`;
    _openSpawnCat = null;
}
function openSpawnCategory(catId) {
    const fly = document.getElementById('spawn-flyout'); if (!fly) return;
    if (_openSpawnCat === catId) { fly.classList.add('hidden'); _openSpawnCat = null; document.querySelectorAll('.spawn-cat').forEach(b => b.classList.remove('cat-open')); return; }
    const cat = SPAWN_CATEGORIES.find(c => c.id === catId); if (!cat) return;
    let html = '';
    for (const id of cat.ids) { const i = _typeIdx(id); if (i >= 0) html += _spawnUnitBtnHTML(i); }
    fly.innerHTML = html; fly.classList.remove('hidden'); _openSpawnCat = catId;
    document.querySelectorAll('.spawn-cat').forEach(b => b.classList.toggle('cat-open', b.dataset.cat === catId));
    renderSpawnIcons();
}
// ── DİZİM FAZI BİRİM KÜNYESİ (kullanıcı: "birim dizerken tıkladığımız birimin özelliklerini göstersin") ──
// Veri zaten vardı; tek sorun onu yazan `#ui-info` panelinin dizim fazında gizli olmasıydı. Artık aynı
// künye sağdaki kompozisyon paneline yazılıyor. TEK KAYNAK: hem barın üzerine gelme, hem tıklama, hem de
// sahadaki birliği eline alma bu fonksiyonu çağırır → üç yol asla farklı bilgi gösteremez.
function unitDossierHTML(type) {
    const s = STATS[type];
    if (!s) return '';
    const hava = s.domain === 'air';
    const satir = (k, v) => '<div class="duc-stat"><span>' + k + '</span><b>' + v + '</b></div>';
    let html = '<div class="duc-head"><h4>' + s.name + '</h4><em>' + (hava ? 'HAVA' : 'KARA') + ' · ' + s.cost + '₺</em></div>';
    const rol = (s.roleTags || []).join(' · ');
    if (rol) html += '<div class="duc-role">' + rol + '</div>';
    html += '<div class="duc-grid">'
        + satir('CAN', s.hp)
        + satir('VURUŞ', s.atk)
        + satir('MENZİL', s.range + (s.minRange ? ' (min ' + s.minRange + ')' : ''))
        + satir('GÖRÜŞ', s.vision)
        + satir('HIZ', (s.speed * 20) + ' px/sn')
        + satir('ZIRH', s.armorType + '/' + s.armorValue)
        + '</div>';
    html += '<div class="duc-line">vurabildiği: <b>' + s.targets + '</b>'
        + (s.aura ? ' · hale: <b>' + s.aura.type + '</b>' : '')
        + (s.transportSlots ? ' · taşır: <b>' + s.transportSlots + '</b>' : '') + '</div>';
    const ab = (s.abilities || []).map(a => {
        const m = (typeof ABILITY_META !== 'undefined') ? ABILITY_META[a] : null;
        return m ? (m.icon + ' ' + m.label) : a;
    });
    if (ab.length) html += '<div class="duc-abil">' + ab.map(a => '<span>' + a + '</span>').join('') + '</div>';
    return html;
}
function showDeployDossier(type) {
    const card = document.getElementById('deploy-unit-card');
    if (!card) return;
    if (type == null || !STATS[type]) {
        card.classList.add('is-empty');
        card.innerHTML = '<div class="duc-empty">Alttaki barda bir birime tıkla — künyesi burada çıkar.</div>';
        return;
    }
    card.classList.remove('is-empty');
    card.innerHTML = unitDossierHTML(type);
}
let _deployDossierPinned = null;   // TIKLANAN birim (üzerine gelme geçicidir, tıklama kalıcı)
function _spawnSelect(btn, toggle) {
    if (phase !== PHASE.DEPLOY) return;
    const type = parseInt(btn.dataset.type);
    if (toggle && selectedSpawnType === type) {
        selectedSpawnType = null; btn.classList.remove('selected-btn'); canvas.classList.remove('ghost-cursor');
        _deployDossierPinned = null; showDeployDossier(null);
        return;
    }
    selectedSpawnType = type;
    document.querySelectorAll('.spawn-btn').forEach(b => b.classList.remove('selected-btn'));
    btn.classList.add('selected-btn'); canvas.classList.add('ghost-cursor');
    _deployDossierPinned = type; showDeployDossier(type);
}
(function wireSpawnBar() {
    const bar = document.getElementById('ui-spawn-bar'); if (!bar) return;
    bar.addEventListener('click', e => {
        const cat = e.target.closest('.spawn-cat'); if (cat) { e.stopPropagation(); openSpawnCategory(cat.dataset.cat); return; }
        const b = e.target.closest('.spawn-btn'); if (b) { e.stopPropagation(); _spawnSelect(b, true); }
    });
    bar.addEventListener('mousedown', e => { const b = e.target.closest('.spawn-btn'); if (b) _spawnSelect(b, false); });
    bar.addEventListener('mouseover', e => {
        const b = e.target.closest('.spawn-btn'); if (!b) return; const s = STATS[parseInt(b.dataset.type)]; if (!s) return;
        showDeployDossier(parseInt(b.dataset.type));          // dizim panelindeki künye (geçici önizleme)
        const el = document.getElementById('info-content'); if (!el) return;
        el.innerHTML = `<b style="color:#aaddff">${s.name}</b><br>${(s.roleTags || []).join(', ')}<br><br>`
            + `❤️ HP: ${s.hp} | ⚔️ ATK: ${s.atk}<br>🏃 Hız: ${(s.speed * 20)}px/sn | 📏 Menzil: ${s.range}${s.minRange ? ' (min ' + s.minRange + ')' : ''}<br>`
            + `👁️ Görüş: ${s.vision} | 🛡️ ${s.armorType}/${s.armorValue} | 💰 ${s.cost}<br>`
            + `🎯 <b style="color:${s.domain === 'air' ? '#7cf' : '#cf9'}">${s.domain === 'air' ? 'HAVA' : 'KARA'}</b> · vurur: ${s.targets}${s.aura ? ' · aura: ' + s.aura.type : ''}`;
    });
    bar.addEventListener('mouseout', e => {
        if (!e.target.closest('.spawn-btn')) return;
        showDeployDossier(_deployDossierPinned);              // önizleme bitti → TIKLANAN birime geri dön
        const el = document.getElementById('info-content'); if (el) el.innerHTML = 'Bir birim seç veya üzerine gel';
    });
})();
buildSpawnBar();

function startBattle() {
    if (phase !== PHASE.DEPLOY) return;

    // RNG ortak savaş oturumu açılırken yalnız bir kez tohumlanır.
    // Eski/harici bir çağrı oturum açmadan buraya gelirse güvenli bir tohum oluştur.
    if ((typeof BATTLE_SESSION === 'undefined' || !BATTLE_SESSION.active) &&
        typeof resetSimRng === 'function') {
        resetSimRng((Date.now() >>> 0) || 1);
    }

    // Yeni savaş denetleyicisi kurulana kadar boş kırmızı tarafla sahte zafer üretme.
    // Multiplayer veya ilerideki denetleyici kırmızı birlikleri önceden yerleştirirse maç normal başlar.
    if (!SIM.units.some(u => !u.dead && u.isRed)) {
        const phaseText = document.getElementById('phase-text');
        if (phaseText) {
            phaseText.textContent = 'RAKİP SAVAŞ DENETLEYİCİSİ BAĞLI DEĞİL';
            phaseText.style.color = '#ffaa00';
        }
        return;
    }

    // HİKÂYE: şehir seviyesi tahkimatı — iki taraf da dizildikten SONRA uygulanır
    if (typeof storyApplyCityFortification === 'function' &&
        typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.mode === 'story' &&
        typeof STORY !== 'undefined' && STORY.battleCtx) {
        storyApplyCityFortification();
    }

    phase = PHASE.BATTLE;
    document.body.setAttribute('data-phase', PHASE.BATTLE);
    // INTEL4-BEYİN: GERÇEK OYUNDA (interactive) rakip-AI + müttefik-AI intel4-deltalarını kullansın → kullanıcı intel4'e karşı oynar.
    // (Headless testler/turnuva flag'i kendileri set eder; snaptest default-kapalı byte-aynı kalır.)
    if (typeof BATTLE_INTEL4_RED !== 'undefined' && typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.interactive !== false &&
        !(typeof BATTLE_REPLAY !== 'undefined' && BATTLE_REPLAY.playback)) {
        BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
        // İZOLASYON-DOĞRULANMIŞ yeni-deltalar GERÇEK OYUNDA açık: defense(XWIDE+omurga-geri)/range(menzil-standoff)/drone(av-paketi-HVT)
        // ablation'da 1/4→2/4 YARDIM etti. backbone HARİÇ (5000'de 2/4→0/4 net-zararlı; bütçe-adaptif olana dek kapalı). Yalnız interaktif → headless-baseline'lar byte-aynı kalır.
        if (typeof BATTLE_INTEL4_DELTAS !== 'undefined') { BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true; }
    }
    if (typeof warRoomResetBattleUI === 'function') warRoomResetBattleUI();
    if (typeof resetGroundCanvas === 'function') resetGroundCanvas();   // önceki maçın savaş izlerini temizle
    if (typeof initBattleRules === 'function') initBattleRules(battleRulesConfigForCurrentMatch());
    if (typeof battleControllersSyncOwnership === 'function') battleControllersSyncOwnership();
    if (typeof battleCaptureInitialState === 'function') battleCaptureInitialState();
    if (typeof battleRecordEvent === 'function') battleRecordEvent('battle-start', battlefieldRulesConfig(), SIM.tick);
    // ÖĞRENEN AI: tek-oyunculu maçta kırmızı AI, temas-fazında lig-eğitimli seçici modeli kullanır
    // (kod-AI açılışı sürer; model tick≥MIN_TICK'te operasyon seçer). MP/replay'de KAPALI.
    // beonai (öğrenen beyin soyu) AÇIKÇA seçilmişse önceliklidir: taraf-başı sürüm bağlanır.
    // Replay/MP'de battleBeonaiBagla kendisi kapatır. Uyumsuz (bayat) sürüm bağlanmaz, uyarır.
    const _beonaiVar = (typeof BATTLE_BEONAI_RED !== 'undefined' && BATTLE_BEONAI_RED) ||
        (typeof BATTLE_BEONAI_BLUE !== 'undefined' && BATTLE_BEONAI_BLUE);
    if (_beonaiVar && typeof battleBeonaiBagla === 'function') {
        const _b = battleBeonaiBagla();
        if (_b.uyari && _b.uyari.length) console.warn('beonai: ' + _b.uyari.join(' | '));
    } else if (typeof BATTLE_SELECTOR_AUTO_ENABLE !== 'undefined' && BATTLE_SELECTOR_AUTO_ENABLE &&
        typeof BATTLE_SELECTOR_TRAINED_MODEL !== 'undefined' && typeof battleSelectorEnable === 'function' &&
        BATTLE_SESSION.interactive !== false &&   // yalnız gerçek oyun (headless testlerde kapalı — testler modeli kendi yönetir)
        BATTLE_SESSION.mode === 'quick' &&        // yalnız Hızlı Maç (hikâye modu farklı kuvvet dağılımı = OOD)
        !(typeof MP !== 'undefined' && MP.active) && !(BATTLE_REPLAY && BATTLE_REPLAY.playback)) {
        battleSelectorEnable(BATTLE_SELECTOR_TRAINED_MODEL, 'battle-red-ai');
        if (typeof BATTLE_SELECTOR_MIN_TICK !== 'undefined') BATTLE_SELECTOR_MIN_TICK =
            (typeof BATTLE_SELECTOR_AUTO_MIN_TICK !== 'undefined') ? BATTLE_SELECTOR_AUTO_MIN_TICK : 500;
        // FAZ 6: "bu maçtan öğren" açıksa kırmızının karar-durumlarını yakala (maç sonu etiketlenir → AI sana adapte olur)
        if (typeof BATTLE_LEARN_FROM_MATCH !== 'undefined' && BATTLE_LEARN_FROM_MATCH &&
            typeof battleTrainCaptureReset === 'function') {
            battleTrainCaptureReset(true);
            if (typeof battleLearnMessage === 'function') battleLearnMessage('🧠 AI bu maçtan öğrenecek — sonunda ~1 dk bekle (kapatmak için L)', 5000);
        }
    } else if (typeof battleSelectorDisable === 'function') {
        battleSelectorDisable();
    }
    selectedSpawnType = null;
    if (deployCarried) { deployCarried.selected = false; deployCarried = null; }   // elde birlik kalmışsa bırak
    canvas.classList.remove('ghost-cursor');

    document.getElementById('start-btn').classList.add('hidden');
    document.getElementById('phase-text').textContent = '⚔️ SAVAŞ! Sol tık: seç | Sağ tık: komut ver';
    document.getElementById('phase-text').style.color = '#ff4444';
    document.getElementById('ui-spawn-bar').style.opacity = '0.3';
    document.getElementById('ui-spawn-bar').style.pointerEvents = 'none';
    // Kamera ipucunun gizlenmesi CSS'e taşındı (kusur 6):
    // body[data-screen="game"][data-phase="battle"] #ui-camera-hint { display: none }
    // Buradaki satır içi stil geri açılmadığı için ipucu rematch'te de kayboluyordu,
    // ayrıca MP yolu bu satıra hiç uğramadığı için orada gizlenmiyordu.
    document.getElementById('ui-support').classList.remove('hidden');

    setTimeout(() => { document.getElementById('ui-phase').style.display = 'none'; }, 3000);
}

document.getElementById('start-btn').addEventListener('click', () => {
    if (typeof MP !== 'undefined' && MP.active) { mpReadyDeploy(); return; }   // ÇOK OYUNCULU: Hazır (start-btn yedek)
    if (units.filter(u => !u.isRed).length === 0) return;
    startBattle();
});
// "Tekrar Oyna" ESKİDEN menüye dönüyordu (etiketiyle çelişiyordu). Kullanıcı isteği: düğme küçülsün,
// yanına "Menüye Dön" gelsin. Artık her düğme adını yapar:
//   Tekrar Oyna → AYNI ayar ve AYNI tohumla maçı baştan kurar (aynı ordu/harita, temiz sayfa).
//   Menüye Dön  → savaşı bırakıp ana menü.
function battleReturnToMenu() {
    document.getElementById('game-over-screen')?.classList.add('hidden');
    if (typeof resetBattleState === 'function') resetBattleState();
    if (typeof showScreen === 'function') showScreen('menu');
}
function battleRematch() {
    // LAST_BATTLE_CONFIG openBattlefieldSession tarafından yazılır. Yoksa (hikâye/MP gibi kendi
    // akışı olan modlar) güvenli davranış menüye dönmektir — sessizce hiçbir şey yapmamak değil.
    if (typeof LAST_BATTLE_CONFIG === 'undefined' || !LAST_BATTLE_CONFIG) { battleReturnToMenu(); return; }
    document.getElementById('game-over-screen')?.classList.add('hidden');
    openBattlefieldSession(LAST_BATTLE_CONFIG);   // aynı tohum → aynı ordu/harita (gerçek tekrar)
    if (typeof showScreen === 'function') showScreen('game');
}
document.getElementById('restart-btn').addEventListener('click', battleRematch);
document.getElementById('menu-return-btn')?.addEventListener('click', battleReturnToMenu);
let lastBattleDiagnosticReport = null;

// FAZ 6: "bu maçtan öğren" — tek-oyunculu Hızlı Maç'ta AI, senin maçlarından öğrenir (varsayılan AÇIK).
// Maç sonu ~1 dk etiketleme olur. 'L' tuşu aç/kapat. Kapatırsan o maç öğrenilmez (bekleme yok).
let BATTLE_LEARN_FROM_MATCH = true;
// ── FORMASYON YERLESIMI (TEK KAYNAK) ──
// Emir verme ve ONIZLEME bu AYNI fonksiyonu kullanir. Ayri hesap yapilsaydi onizleme yalan
// soyleyebilirdi; kullanicinin gordugu ile birimin gittigi yer birbirinden ayrilirdi.
// Merkez TAM IMLECTE: ofsetlerin ortalamasi cikarilir. (Eski kod izgarayi KUTUNUN merkezine
// hizaliyordu; son satir eksik dolunca merkez sola-yukari kayiyordu — 7 birimde yarim aralik.)
function formationOffsets(count) {
    const cols = Math.ceil(Math.sqrt(count)), spacing = UNIT_RADIUS * 2.5;
    const ofs = [];
    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols), col = i % cols;
        ofs.push({ x: (col - (cols - 1) / 2) * spacing, y: (row - (Math.ceil(count / cols) - 1) / 2) * spacing });
    }
    const mx = ofs.reduce((a, o) => a + o.x, 0) / Math.max(1, count);
    const my = ofs.reduce((a, o) => a + o.y, 0) / Math.max(1, count);
    return ofs.map(o => ({ x: o.x - mx, y: o.y - my }));
}

// ── ESC DURAKLATMA PENCERESI (kullanici kusur raporu 2026-08-09) ──
// "esc bastigimda oyun dursun ve pencere ciksin: mactan cik / maca devam et".
// Pencere DOM'a bir kez kurulur; duraklatma bayragi sim dongusunu keser (determinizm etkilenmez).
function battlePauseOverlay() {
    let el = document.getElementById('battle-pause');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'battle-pause';
    el.style.cssText = 'position:fixed;inset:0;z-index:9000;display:none;align-items:center;' +
        'justify-content:center;background:rgba(0,0,0,0.62);backdrop-filter:blur(2px)';
    el.innerHTML =
        '<div style="min-width:280px;padding:26px 30px;border-radius:12px;background:#12161c;' +
        'border:1px solid #2b3442;box-shadow:0 12px 40px rgba(0,0,0,.5);text-align:center;font-family:inherit">' +
        '<div style="font-size:19px;color:#e6edf5;margin-bottom:4px">⏸️ Maç duraklatıldı</div>' +
        '<div style="font-size:12px;color:#7f8b9c;margin-bottom:18px">ESC ile devam edebilirsin</div>' +
        '<button id="btn-pause-resume" style="display:block;width:100%;margin:8px 0;padding:11px;' +
        'border-radius:8px;border:1px solid #2f6f4f;background:#1c3d2c;color:#cfe9d8;cursor:pointer;font-size:14px">' +
        'Maça devam et</button>' +
        '<button id="btn-pause-quit" style="display:block;width:100%;margin:8px 0;padding:11px;' +
        'border-radius:8px;border:1px solid #6f3030;background:#3d1c1c;color:#e9cfcf;cursor:pointer;font-size:14px">' +
        'Maçtan çık</button></div>';
    document.body.appendChild(el);
    el.querySelector('#btn-pause-resume').addEventListener('click', () => battleTogglePause(false));
    el.querySelector('#btn-pause-quit').addEventListener('click', () => {
        battleTogglePause(false);
        if (typeof showScreen === 'function') showScreen('menu');
    });
    return el;
}

function battleTogglePause(zorla) {
    if (typeof BATTLE_PAUSED === 'undefined') return;
    BATTLE_PAUSED = (zorla === undefined) ? !BATTLE_PAUSED : !!zorla;
    const el = battlePauseOverlay();
    el.style.display = BATTLE_PAUSED ? 'flex' : 'none';
}

function battleLearnMessage(text, autoHideMs) {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('learn-msg');
    if (!el) {
        el = document.createElement('div'); el.id = 'learn-msg';
        el.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99999;' +
            'background:rgba(18,20,32,0.94);color:#8ecbff;padding:10px 20px;border:1px solid #49f;' +
            'border-radius:9px;font:14px system-ui,sans-serif;pointer-events:none;box-shadow:0 4px 18px rgba(0,0,0,0.5)';
        document.body.appendChild(el);
    }
    if (!text) { el.style.display = 'none'; return; }
    el.textContent = text; el.style.display = 'block';
    if (autoHideMs) setTimeout(() => { if (document.getElementById('learn-msg')) document.getElementById('learn-msg').style.display = 'none'; }, autoHideMs);
}
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', e => {
        // ── ESC: MACI DURAKLAT + MENU (kullanici kusur raporu 2026-08-09) ──
        // Onceden ESC savasta HICBIR SEY yapmiyordu. Duraklatma yalnizca zaman biriktirmeyi keser;
        // sim durumu, replay ve hash etkilenmez (bkz. gameLoop icindeki _duraklat).
        if (e.key === 'Escape' && typeof phase !== 'undefined' && phase === PHASE.BATTLE) {
            e.preventDefault();
            battleTogglePause();
            return;
        }
        /* ── KUSUR 4: EMİR KISAYOLLARI + KONTROL GRUPLARI ──────────────────
           Tuşlar WASD (kamera, js/globals.js:260) ve mevcut L/U/M ile
           ÇAKIŞMAYACAK şekilde seçildi: Q taarruz, F ateş serbest, T siper,
           P paraşüt. Rozetler index.html'de `data-key` ile duruyor, CSS
           yazdırıyor — tuş ile etiket tek kaynaktan gelmiyor ama ikisi de
           burada yorumla bağlandı.
           Yazı alanına odaklıyken kısayol çalışmaz; yoksa sohbet kutusuna
           "p" yazmak paraşüt moduna sokardı. */
        const _yaziAlani = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        if (!_yaziAlani && typeof phase !== 'undefined' && phase === PHASE.BATTLE) {
            const _k = (e.key || '').toLowerCase();
            const _emir = { q: 'assault', f: 'free-fire', t: 'trench', p: 'paradrop' }[_k];
            if (_emir && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                if (typeof warRoomIssueOrder === 'function') warRoomIssueOrder(_emir);
                return;
            }
            if (/^[1-9]$/.test(e.key)) {
                e.preventDefault();
                const n = Number(e.key);
                if (e.ctrlKey || e.metaKey) {
                    if (typeof battleGroupAssign === 'function') battleGroupAssign(n);
                } else if (typeof battleGroupRecall === 'function') {
                    battleGroupRecall(n);
                }
                if (typeof updateUI === 'function') updateUI();
                return;
            }
        }
        if (e.key === 'l' || e.key === 'L') {
            if (typeof phase !== 'undefined' && phase === PHASE.BATTLE) return;   // savaşta 'L' başka işe karışmasın
            BATTLE_LEARN_FROM_MATCH = !BATTLE_LEARN_FROM_MATCH;
            battleLearnMessage(BATTLE_LEARN_FROM_MATCH ? '🧠 AI bu maçtan öğrenecek (L: kapat)' : '⏸️ Öğrenme kapalı (L: aç)', 2500);
        }
        if ((e.key === 'u' || e.key === 'U') && typeof phase !== 'undefined' && phase === PHASE.BATTLE) {
            // TAŞIMA İNDİR: seçili dolu taşıyıcı(lar) bulunduğu yere yolcuları indirsin
            const sel = units.filter(u => u.selected && playerCanControlBattleUnit(u) && u.transportSlots > 0 && u.cargo.length > 0);
            if (sel.length) {
                queuePlayerCommand('player-unload', { transportIds: sel.map(u => u.id) });
                if (typeof battleLearnMessage === 'function') battleLearnMessage('🪂 İndir emri verildi', 1500);
            }
        }
        if ((e.key === 'm' || e.key === 'M') && typeof phase !== 'undefined' && phase === PHASE.BATTLE) {
            // MAYIN DÖŞE: seçili istihkam(lar) bulunduğu yere mayın koysun
            const eng = units.filter(u => u.selected && playerCanControlBattleUnit(u) && u.type === T.ENGINEER);
            if (eng.length) {
                queuePlayerCommand('player-mine', { engineerIds: eng.map(u => u.id) });
                if (typeof battleLearnMessage === 'function') battleLearnMessage('💣 Mayın döşendi', 1500);
            }
        }
    });
}

// NOT: "Raporu Kopyala" + sağdaki ham metin dökümü kaldırıldı (kullanıcı isteği, 2026-08-09).
// Tam veri "Ham JSON İndir" ile alınır — hiçbir bilgi kaybı yok, yalnız ekran sadeleşti.
document.getElementById('download-battle-report-btn')?.addEventListener('click', () => {
    if (!lastBattleDiagnosticReport) return;
    const json = JSON.stringify(lastBattleDiagnosticReport, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const session = lastBattleDiagnosticReport.replay?.session || {};
    link.download = [
        'pixel-rts-ham-savas-kaydi',
        session.seed ?? 'seed-yok',
        new Date().toISOString().replace(/[:.]/g, '-')
    ].join('-') + '.json';
    link.click();
    URL.revokeObjectURL(url);
});


minimapCanvas.addEventListener('click', (e) => {
    const rect = minimapCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    camera.x = mx * WORLD_W - (canvas.width / zoom) / 2;
    camera.y = my * WORLD_H - (canvas.height / zoom) / 2;
    if (typeof clampCamera === 'function') clampCamera();
});

function checkGameOver() {
    if (phase !== PHASE.BATTLE) return;
    let won = typeof battleOutcomeBluePerspective === 'function'
        ? battleOutcomeBluePerspective()
        : null;
    if (won === null) return;

    const battleSummary = {
        engineVersion: typeof BATTLE_SESSION !== 'undefined' ? BATTLE_SESSION.engineVersion : 'legacy',
        sessionMode: typeof BATTLE_SESSION !== 'undefined' ? BATTLE_SESSION.mode : null,
        seed: typeof BATTLE_SESSION !== 'undefined' ? BATTLE_SESSION.seed : null,
        mapId: typeof BATTLE_SESSION !== 'undefined' ? BATTLE_SESSION.mapId : null,
        durationSeconds: Math.max(0, SIM.battle?.elapsedSec || 0),
        outcomeReason: SIM.battle?.outcomeReason || null,
        attackerSide: SIM.battle?.attackerSide ? 'red' : 'blue',
        timeRemaining: Math.max(0, SIM.battle?.remainingSec || 0),
        blueSurvivors: SIM.units.filter(u => !u.dead && !u.isRed).length,
        redSurvivors: SIM.units.filter(u => !u.dead && u.isRed).length,
        blueKills: player.kills,
        redKills: enemy.kills
    };
    battleSummary.outcomeLabel = typeof battleOutcomeLabel === 'function'
        ? battleOutcomeLabel(battleSummary.outcomeReason)
        : 'Savaş sona erdi';
    battleSummary.recording = {
        samples: BATTLE_REPLAY.telemetry?.samples?.length || 0,
        combatEvents: BATTLE_REPLAY.telemetry?.combatEvents?.length || 0,
        controllerDecisions: BATTLE_REPLAY.telemetry?.controllerDecisions?.length || 0,
        playerAndAIEvents: BATTLE_REPLAY.events?.length || 0,
        stateHashes: BATTLE_REPLAY.hashes?.length || 0
    };
    lastBattleDiagnosticReport = typeof exportBattleDiagnosticReport === 'function'
        ? exportBattleDiagnosticReport(battleSummary)
        : {
            format: 'pixel-rts-battle-diagnostic',
            schemaVersion: 1,
            createdAt: new Date().toISOString(),
            engineVersion: battleSummary.engineVersion,
            summary: battleSummary
        };
    const _mp = (typeof MP !== 'undefined' && MP.active);
    phase = PHASE.OVER;
    document.body.setAttribute('data-phase', PHASE.OVER);
    // #5: her maçın TAM kaydını (birim yörüngeleri + kontrolör kararları) diske yaz → Claude GERÇEK maçı izleyip
    // donma/yana-açılma/flank'ı veriyle teşhis eder (headless vekil ≠ gerçek insan). qa-runtime/last-match.json.
    if (typeof window !== 'undefined' && window.PIXEL && window.PIXEL.train && window.PIXEL.train.saveMatchRecording &&
        typeof exportBattleDiagnosticReport === 'function') {
        try { window.PIXEL.train.saveMatchRecording(exportBattleDiagnosticReport()); } catch (e) {}
    }
    // FAZ 6: "bu maçtan öğren" açıktıysa → kırmızının karar-durumlarını etiketle + disk'e kaydet.
    // Etiketleme (Oracle rollout) kısa dondurur → önce mesaj göster, setTimeout ile ertele (mesaj render olsun).
    if (typeof BATTLE_TRAIN_CAPTURE !== 'undefined' && BATTLE_TRAIN_CAPTURE &&
        typeof BATTLE_DECISION_SNAPSHOTS !== 'undefined' && BATTLE_DECISION_SNAPSHOTS.length &&
        typeof battleLabelDecisionSnapshots === 'function') {
        const nSnap = BATTLE_DECISION_SNAPSHOTS.length;
        battleLearnMessage('🧠 AI senden öğreniyor... (' + nSnap + ' karar, ~1 dk bekle)');
        setTimeout(() => {
            let labeled = { count: 0, examples: [] };
            try { labeled = battleLabelDecisionSnapshots({ rolloutSec: 10 }); } catch (e) {}
            // Her örneği MOTOR-SÜRÜMÜYLE etiketle → INSAN-EGIT yalnız GÜNCEL-motor durumlarını adapte eder.
            // Eski-motor durumları farklı dinamik + farklı Oracle-ödülüyle yakalandı → dağılım kayması; sürüm
            // değişince otomatik dışlanır (kullanıcı: "eski oyun ile şimdiki oyun çok farklı boyutta").
            try { const _ev = (typeof BATTLE_ENGINE_VERSION !== 'undefined') ? BATTLE_ENGINE_VERSION : null; if (labeled && labeled.examples) labeled.examples.forEach(e => { e.engineVersion = _ev; }); } catch (e) {}
            BATTLE_TRAIN_CAPTURE = false; BATTLE_DECISION_SNAPSHOTS = [];
            if (labeled.count && typeof window !== 'undefined' && window.PIXEL && window.PIXEL.train) {
                window.PIXEL.train.saveHumanData(labeled.examples)
                    .then(r => battleLearnMessage('✅ AI ' + ((r && r.total) || labeled.count) + ' durumdan öğrendi. Pekiştirmek için INSAN-EGIT.bat çalıştır.', 7000))
                    .catch(() => battleLearnMessage('', 0));
            } else battleLearnMessage(labeled.count ? '✅ ' + labeled.count + ' durum etiketlendi (kayıt için masaüstü sürümü gerekir).' : '', 5000);
        }, 90);
    }
    // ÇOK OYUNCULU: 'won' MAVİ-perspektifli; ekranı BENİM tarafıma göre çevir (guest=kırmızı)
    let shownWon = won;
    if (_mp && won !== 'draw') shownWon = (won === !myCanonicalSide);
    const title = document.getElementById('game-over-title');
    if (shownWon === 'draw') { title.textContent = '🤝 BERABERE!'; title.style.color = '#ffaa00'; }
    else if (shownWon) { title.textContent = '🏆 ZAFER!'; title.style.color = '#4cff7c'; }
    else { title.textContent = '💀 YENİLDİN!'; title.style.color = '#ff4444'; }

    const resultLabel = won === 'draw' ? 'Berabere' : won ? 'Oyuncu kazandı' : 'Oyuncu kaybetti';
    const roleLabel = SIM.battle?.attackerSide === false ? 'SALDIRAN' : 'SAVUNAN';
    // KALDIRILDI (kullanıcı isteği, 2026-08-09): sağdaki ham metin raporu ve "Raporu Kopyala".
    // Aynı bilgi ve fazlası "Ham JSON İndir" çıktısında (lastBattleDiagnosticReport) duruyor.

    document.getElementById('score-table').innerHTML = `
        <div class="score-row"><span>Sonuç</span><span class="score-val">${resultLabel}</span></div>
        <div class="score-row"><span>Rolün</span><span class="score-val">${roleLabel}</span></div>
        <div class="score-row"><span>Mavi sağ kalan</span><span class="score-val">${battleSummary.blueSurvivors}</span></div>
        <div class="score-row"><span>Kırmızı sağ kalan</span><span class="score-val">${battleSummary.redSurvivors}</span></div>
        <div class="score-row"><span>Mavi öldürme</span><span class="score-val">${battleSummary.blueKills}</span></div>
        <div class="score-row"><span>Kırmızı öldürme</span><span class="score-val">${battleSummary.redKills}</span></div>
    `;
    document.getElementById('restart-btn')?.classList.remove('hidden');
    document.getElementById('menu-return-btn')?.classList.remove('hidden');
    document.getElementById('story-return-btn')?.classList.add('hidden');
    document.getElementById('campaign-result-panel')?.classList.add('hidden');
    if (typeof BATTLE_SESSION !== 'undefined' && BATTLE_SESSION.mode === 'story' &&
        typeof STORY !== 'undefined' && STORY.active && STORY.battleCtx &&
        typeof storyOnBattleEnd === 'function') {
        storyOnBattleEnd(won, battleSummary);
    }
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function updateUI() {
    if (document.body.getAttribute('data-screen') === 'game') document.body.setAttribute('data-phase', phase);
    if (phase === PHASE.DEPLOY && typeof warRoomUpdateDeploy === 'function') warRoomUpdateDeploy();
    if (phase === PHASE.BATTLE && typeof warRoomUpdateBattle === 'function') warRoomUpdateBattle();
    const _mp = (typeof MP !== 'undefined' && MP.active);
    const myWallet = (_mp && myCanonicalSide) ? enemy : player;   // MP guest = enemy bütçesi
    // FAZ-2 KAYNAK-BAZLI (hikaye düellosu): 3 kaynak bütçesini göster, harca-azalt; yoksa tek-para
    const dres = (!_mp && typeof DEPLOY_RES !== 'undefined' && DEPLOY_RES && DEPLOY_RES.blue) ? DEPLOY_RES.blue : null;
    // FAZ-3: havuz modunda para değil ADET gösterilir (kaynak zaten şehirde harcandı)
    const dpool = (!_mp && typeof DEPLOY_POOL !== 'undefined' && DEPLOY_POOL) ? DEPLOY_POOL : null;
    if (dpool) {
        let left = 0; for (const k in dpool) left += dpool[k] | 0;
        const onField = units.filter(u => !u.isRed && !u.ally && !u.dead).length;
        document.getElementById('money').textContent = `${left} ⚔️ (sahada ${onField})`;
    } else if (dres) {
        document.getElementById('money').textContent = Math.floor(dres.oil + dres.manpower + dres.points);
        const mo = document.getElementById('money-oil'); if (mo) mo.textContent = Math.floor(dres.oil);
        const mm = document.getElementById('money-manpower'); if (mm) mm.textContent = Math.floor(dres.manpower);
        const mp = document.getElementById('money-points'); if (mp) mp.textContent = Math.floor(dres.points);
    } else {
        document.getElementById('money').textContent = Math.floor(myWallet.money);
    }
    if (phase === PHASE.DEPLOY) {
        document.querySelectorAll('.spawn-btn').forEach(btn => {
            const type = parseInt(btn.dataset.type);
            const costEl = btn.querySelector('.btn-cost');
            if (costEl && btn.dataset.origCost == null) btn.dataset.origCost = costEl.textContent;   // Hızlı Maç'a dönünce geri yazılsın
            if (dpool) {
                const left = dpool[type] | 0;
                btn.classList.toggle('disabled', left <= 0);
                if (costEl) costEl.textContent = '×' + left;
            } else {
                if (costEl && btn.dataset.origCost != null) costEl.textContent = btn.dataset.origCost;
                const afford = dres ? ((dres[UNIT_RES_GROUP[type]] || 0) >= STATS[type].cost) : (myWallet.money >= STATS[type].cost);
                btn.classList.toggle('disabled', !afford);
            }
        });
    }

    if (phase === PHASE.BATTLE) {
        /* KUSUR 1 (daraltıldı — ölçüm önceki iddiayı çürüttü):
           Buradaki iki innerHTML yazması `#info-content`e gidiyordu, ama `#ui-info`
           savaş fazında `display:none !important` (style.css:1919). Yani metin her
           karede üretilip GÖRÜNMEYEN bir düğüme yazılıyordu — hem boşa iş, hem de
           "N birim seçili" bilgisi oyuncuya hiç ulaşmıyordu.
           DİKKAT: panel ÖLÜ DEĞİL — dizim fazında görünür ve çalışıyor (ölçüldü:
           display:block, "Bir birim seç veya üzerine gel"). Bu yüzden panel
           silinmedi, yalnız savaş fazındaki ölü yazma kaldırıldı.
           Bilginin savaşta NEREDE görüneceği (hedef kartı mı, ayrı bir şerit mi)
           bir tasarım kararı; mockup'ta kusur 1 olarak açık duruyor. */

        document.getElementById('cd-paradrop').style.height = `${(supportCooldowns.paradrop / MAX_CD_PARADROP) * 100}%`;
        document.getElementById('btn-paradrop').style.borderColor = selectedSupportMode === 'paradrop' ? '#fff' : '#555';
        document.getElementById('btn-paradrop').classList.toggle('disabled', player.money < PARADROP_COST || supportCooldowns.paradrop > 0);
        document.getElementById('btn-trench').style.borderColor = selectedSupportMode === 'trench' ? '#fff' : '#555';
    }
}

// ─── ÇİZİM VE SAVAŞ SİSİ (Fog of War) ───

function drawMap() {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Katman 1: düz yeşil yerine blok blok değişen piksel arazi karoları.
    ctx.fillStyle = '#46583a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // GRID MODU: çizilen harita zemini tek blit ile (groundTiles/orman/dağ daireleri atlanır)
    const _gridMap = (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid');
    if (_gridMap && typeof drawGridTerrain === 'function') drawGridTerrain();
    if (!_gridMap) {

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

    }   // _gridMap değilse: eski daire-tabanlı zemin/yol bloğu sonu

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
    
    // T2 YÜKSELTİ: harita-geneli topografik kontur çizgileri (offscreen, bir kez bake → tek blit)
    if (_elevDirty && typeof bakeTerrainElevation === 'function') bakeTerrainElevation();
    if (elevCanvas) {
        const oe = worldToScreen(camera.x, camera.y);
        ctx.drawImage(elevCanvas, camera.x, camera.y, viewW, viewH, oe.x, oe.y, canvas.width, canvas.height);
    }

    // Katman 3: savaş izleri — BAKED-GROUND (ceset/kan/scorch tek offscreen canvas'a damgalı; görünür bölge tek blit)
    if (typeof bakeGround === 'function') bakeGround();
    if (groundCanvas) {
        const o = worldToScreen(camera.x, camera.y);          // sol-üst köşe (shake dahil)
        ctx.drawImage(groundCanvas, camera.x, camera.y, viewW, viewH, o.x, o.y, canvas.width, canvas.height);
    }

    // Katman 4: orman zemini — organik poligon (asimetrik kenar, daire değil) — grid modunda bake ile çizildi
    if (!_gridMap) for (const t of terrainFeatures) {
        if (t.type !== TERRAIN.FOREST) continue;
        const s = worldToScreen(t.x, t.y);
        const radius = t.r * zoom;
        if (s.x < -radius * 1.3 || s.x > canvas.width + radius * 1.3 || s.y < -radius * 1.3 || s.y > canvas.height + radius * 1.3) continue;
        const poly = t.orgPoly;
        if (!poly) continue;
        ctx.save();
        ctx.beginPath();
        for (let k = 0; k <= poly.length; k++) {
            const v = poly[k % poly.length];
            if (k === 0) ctx.moveTo(s.x + v.dx * zoom, s.y + v.dy * zoom);
            else         ctx.lineTo(s.x + v.dx * zoom, s.y + v.dy * zoom);
        }
        ctx.closePath();
        ctx.clip();
        const forestFloor = ctx.createRadialGradient(s.x, s.y, radius * 0.15, s.x, s.y, radius * 1.25);
        forestFloor.addColorStop(0, 'rgba(15,52,27,0.84)');
        forestFloor.addColorStop(0.68, 'rgba(24,68,35,0.72)');
        forestFloor.addColorStop(1, 'rgba(22,57,31,0)');
        ctx.fillStyle = forestFloor;
        ctx.fillRect(s.x - radius * 1.3, s.y - radius * 1.3, radius * 2.6, radius * 2.6);
        ctx.restore();
    }

    // Katman 5: dağ kütleleri, tepeler ve ağaç taçları — grid modunda bake ile çizildi
    if (!_gridMap) for (const t of terrainFeatures) {
        if (t.type === TERRAIN.MOUNTAIN) {
            const s = worldToScreen(t.x, t.y);
            if (s.x < -t.r * zoom || s.x > canvas.width + t.r * zoom || s.y < -t.r * zoom || s.y > canvas.height + t.r * zoom) continue;
            const radius = t.r * zoom;
            const poly = t.orgPoly;

            // Gölge (hafif aşağı-sağ kaydırılmış organik polygon)
            ctx.fillStyle = 'rgba(15,25,18,0.45)';
            ctx.beginPath();
            if (poly) {
                for (let k = 0; k <= poly.length; k++) {
                    const v = poly[k % poly.length];
                    if (k === 0) ctx.moveTo(s.x + radius * 0.18 + v.dx * zoom, s.y + radius * 0.22 + v.dy * zoom);
                    else         ctx.lineTo(s.x + radius * 0.18 + v.dx * zoom, s.y + radius * 0.22 + v.dy * zoom);
                }
            } else { ctx.ellipse(s.x + radius * 0.16, s.y + radius * 0.22, radius * 1.05, radius * 0.78, 0, 0, Math.PI * 2); }
            ctx.closePath(); ctx.fill();

            // Kaya gövdesi — organik polygon
            const rockGradient = ctx.createRadialGradient(s.x - radius * 0.28, s.y - radius * 0.32, radius * 0.08, s.x, s.y, radius);
            rockGradient.addColorStop(0, '#8d927d');
            rockGradient.addColorStop(0.5, '#62695c');
            rockGradient.addColorStop(1, '#343b35');
            ctx.fillStyle = rockGradient;
            ctx.beginPath();
            if (poly) {
                for (let k = 0; k <= poly.length; k++) {
                    const v = poly[k % poly.length];
                    if (k === 0) ctx.moveTo(s.x + v.dx * zoom, s.y + v.dy * zoom);
                    else         ctx.lineTo(s.x + v.dx * zoom, s.y + v.dy * zoom);
                }
            } else { ctx.arc(s.x, s.y, radius, 0, Math.PI * 2); }
            ctx.closePath(); ctx.fill();
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

    // ── GEÇİCİ TEŞHİS: grid harita durumu (DEBUG_TERRAIN=false yapınca kapanır) ──
    if (typeof DEBUG_TERRAIN !== 'undefined' && DEBUG_TERRAIN) {
        const _w2s = (typeof worldToScreen === 'function') ? worldToScreen(0, 0) : { x: '?', y: '?' };
        const lines = [
            'MAP_MODE=' + (typeof MAP_MODE !== 'undefined' ? MAP_MODE : 'undefined'),
            'terrainGrid=' + (typeof terrainGrid !== 'undefined' && terrainGrid ? terrainGrid.length : 'NULL'),
            'bakeCanvas=' + (typeof terrainBakeCanvas !== 'undefined' && terrainBakeCanvas ? (terrainBakeCanvas.width + 'x' + terrainBakeCanvas.height) : 'NULL'),
            'drawGridTerrain=' + (typeof drawGridTerrain === 'function' ? 'var' : 'YOK'),
            'SIM.headless=' + (typeof SIM !== 'undefined' ? SIM.headless : '?'),
            'coarse=' + (typeof terrainFeatures !== 'undefined' ? terrainFeatures.length : '?'),
            'zoom=' + (typeof zoom !== 'undefined' ? zoom.toFixed(3) : '?'),
            'cam=' + (typeof camera !== 'undefined' ? (Math.round(camera.x) + ',' + Math.round(camera.y)) : '?'),
            'w2s(0,0)=' + (typeof _w2s.x === 'number' ? (Math.round(_w2s.x) + ',' + Math.round(_w2s.y)) : '?'),
            'phase=' + (typeof phase !== 'undefined' ? phase : '?'),
            'canvas=' + canvas.width + 'x' + canvas.height
        ];
        const bx = 12, bh = 18 * lines.length + 10, by = Math.round(canvas.height / 2 - bh / 2);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(bx, by, 250, bh);
        ctx.strokeStyle = '#5f6'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, 250, bh);
        ctx.font = '14px monospace'; ctx.fillStyle = '#5f6'; ctx.textAlign = 'left';
        lines.forEach((l, i) => ctx.fillText(l, bx + 8, by + 22 + i * 18));
        // bake canvas önizlemesi (renkli görünürse bake DOLU → sorun ana blit'te)
        if (typeof terrainBakeCanvas !== 'undefined' && terrainBakeCanvas) {
            const ty = by + bh + 8;
            ctx.fillStyle = '#000'; ctx.fillRect(bx, ty, 200, 135);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(terrainBakeCanvas, 0, 0, WORLD_W, WORLD_H, bx, ty, 200, 135);
            ctx.strokeStyle = '#5f6'; ctx.strokeRect(bx, ty, 200, 135);
            ctx.fillStyle = '#5f6'; ctx.fillText('↑ bake önizleme', bx + 8, ty + 135 + 16);
        }
        ctx.restore();
    }

    // ── FORMASYON ONIZLEMESI (kullanici istegi 2026-08-09) ──
    // "3 birim secip bir nokta gosterdigimde, o noktaya geldiklerinde nasil duracaklarini gosteren
    //  YESIL KESIK CIZGILER ciksin, birimlerle AYNI BUYUKLUKTE — ve sectigim nokta KESINLIKLE
    //  imlecin uc noktasinda gozuksun."
    // Onizleme, emirle AYNI `formationOffsets` fonksiyonunu kullanir → gordugun yer, gidilen yerdir.
    // Imlecin TAM ucuna ayrica bir hedef isareti cizilir (formasyon orada ORTALANIR).
    if (typeof phase !== 'undefined' && phase === PHASE.BATTLE && !isDragging) {
        const _sel = units.filter(u => u.selected && (typeof playerCanControlBattleUnit !== 'function' || playerCanControlBattleUnit(u)));
        // KAPATILDI (kullanici 2026-08-09: "o yesil onizleme olmasin, vazgectim").
        // Kod DURUYOR — bayragi true yapmak yeterli; emirle AYNI `formationOffsets` kaynagini kullanir.
        const _onizlemeAcik = (typeof BATTLE_FORMASYON_ONIZLEME !== 'undefined') && BATTLE_FORMASYON_ONIZLEME;
        if (_onizlemeAcik && _sel.length >= 1) {
            const _w = screenToWorld(mouseScreenX, mouseScreenY);
            const _of = formationOffsets(_sel.length);
            const _r = UNIT_RADIUS * zoom;
            ctx.save();
            ctx.setLineDash([6 * zoom, 5 * zoom]);
            ctx.lineWidth = Math.max(1, 1.6 * zoom);
            ctx.strokeStyle = 'rgba(92,220,150,0.75)';
            for (const o of _of) {
                const _p = worldToScreen(_w.x + o.x, _w.y + o.y);
                ctx.beginPath(); ctx.arc(_p.x, _p.y, _r, 0, Math.PI * 2); ctx.stroke();
            }
            // SECILEN NOKTA: imlecin tam ucunda, kesiksiz kucuk arti
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(120,255,180,0.95)';
            ctx.lineWidth = Math.max(1, 1.4 * zoom);
            const _c = worldToScreen(_w.x, _w.y), _k = 7 * zoom;
            ctx.beginPath();
            ctx.moveTo(_c.x - _k, _c.y); ctx.lineTo(_c.x + _k, _c.y);
            ctx.moveTo(_c.x, _c.y - _k); ctx.lineTo(_c.x, _c.y + _k);
            ctx.stroke();
            ctx.restore();
        }
    }

    if (phase === PHASE.DEPLOY) {
        const mpGuest = (typeof myCanonicalSide !== 'undefined' && myCanonicalSide);   // true = MP guest (KIRMIZI/kuzey)
        // BENİM bölgem (belirgin mavi) — host güney, guest kuzey
        const myY0 = mpGuest ? 0 : WORLD_H * 0.6, myY1 = mpGuest ? WORLD_H * 0.4 : WORLD_H;
        const ls = worldToScreen(0, myY0); const le = worldToScreen(WORLD_W, myY1);
        ctx.fillStyle = 'rgba(40, 100, 255, 0.06)'; ctx.fillRect(ls.x, ls.y, le.x - ls.x, le.y - ls.y);

        ctx.strokeStyle = 'rgba(80, 160, 255, 0.25)'; ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.strokeRect(ls.x, ls.y, le.x - ls.x, le.y - ls.y);

        // RAKİP bölgesi (soluk kırmızı)
        const eY0 = mpGuest ? WORLD_H * 0.6 : 0, eY1 = mpGuest ? WORLD_H : WORLD_H * 0.4;
        const rs = worldToScreen(0, eY0); const re = worldToScreen(WORLD_W, eY1);
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
        
        // ── SAHRA HASTANESİ: siperden AYRI görünür (beyaz halka + kızılhaç). Mühimmat vermez, iyileştirir.
        if (t.isHospital) {
            ctx.strokeStyle = t.isRed ? 'rgba(235,180,180,0.9)' : 'rgba(235,235,245,0.9)';
            ctx.lineWidth = 5 * zoom;
            ctx.beginPath(); ctx.arc(s.x, s.y, zr, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = t.isRed ? 'rgba(90,40,40,0.22)' : 'rgba(210,225,235,0.16)';
            ctx.fill();
            const c = 10 * zoom;
            ctx.fillStyle = 'rgba(225,60,60,0.95)';
            ctx.fillRect(Math.round(s.x - c * 0.28), Math.round(s.y - c), Math.round(c * 0.56), Math.round(c * 2));
            ctx.fillRect(Math.round(s.x - c), Math.round(s.y - c * 0.28), Math.round(c * 2), Math.round(c * 0.56));
            continue;
        }

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

    // ── HALE YARIÇAPLARI GÖRÜNÜR (kullanıcı: "ikmal aracının ne kadar alana ikmal verdiğini görmek
    // istiyorum, şu an tahmini yaklaştırıp ikmal yaptırıyorum") ──
    // KENDİ destek araçlarının etki alanı çizilir: ikmal (mühimmat/yakıt), sağlıkçı (iyileştirme),
    // istihkâm (tamir). Yarıçap VERİDEN okunur (STATS.aura.radius × TILE_PX) — sabit kopyalanmaz,
    // veri değişirse çizim de değişir. Yalnız görsel: simülasyona dokunmaz, determinizmi etkilemez.
    {
        const _TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 100;
        const _renk = { resupply: 'rgba(120,200,255,', heal: 'rgba(120,255,170,', repair: 'rgba(255,200,110,' };
        for (const u of SIM.units) {
            if (u.dead || u.loaded || u.isRed) continue;              // yalnız KENDİ birimlerin
            const a = STATS[u.type] && STATS[u.type].aura;
            if (!a || !_renk[a.type]) continue;
            const R = (a.radius || 3) * _TP;
            const _rp = unitRenderPos(u);                            // sprite ile aynı ara-değer → hale birimden kopmaz
            const p = worldToScreen(_rp.x, _rp.y);
            const zr2 = R * zoom;
            if (p.x < -zr2 || p.x > canvas.width + zr2 || p.y < -zr2 || p.y > canvas.height + zr2) continue;
            ctx.setLineDash([10 * zoom, 8 * zoom]);
            ctx.strokeStyle = _renk[a.type] + '0.40)';
            ctx.lineWidth = Math.max(1, 1.6 * zoom);
            ctx.beginPath(); ctx.arc(p.x, p.y, zr2, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = _renk[a.type] + '0.05)';
            ctx.fill();
        }
    }

    // MAYIN: sahip her zaman görür; düşman mayını yalnız yakında yüksek-detect dost varsa görünür (bilgi-savaşı)
    const _mySide = (typeof myCanonicalSide !== 'undefined' ? myCanonicalSide : false);
    for (const m of mines) {
        const s = worldToScreen(m.x, m.y);
        if (s.x < -20 || s.x > canvas.width + 20 || s.y < -20 || s.y > canvas.height + 20) continue;
        const own = (m.isRed === _mySide);
        let visible = own;
        if (!own) {
            for (const u of units) {
                if (u.dead || u.isRed !== _mySide) continue;
                const det = (STATS[u.type] && STATS[u.type].detect) || 0;
                if (det >= 0.4 && Math.hypot(u.x - m.x, u.y - m.y) < 220 * (1 + det)) { visible = true; break; }
            }
        }
        if (!visible) continue;
        const r = 6 * zoom;
        ctx.fillStyle = own ? 'rgba(120,200,255,0.9)' : 'rgba(255,90,70,0.95)';
        ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r, s.y + r * 0.7); ctx.lineTo(s.x - r, s.y + r * 0.7); ctx.closePath(); ctx.fill();
        if (!m.armed) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = zoom; ctx.stroke(); }   // kurulum sürüyor
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
    // SEYİRCİ KİPİ (`--izle`): iki AI'yı da tam görmek için sis çizilmez. YALNIZ görsel katman —
    // AI'ların kendi algısı (BattlePerception) bundan etkilenmez, sim'e dokunmaz.
    if (typeof BATTLE_SPECTATE !== 'undefined' && BATTLE_SPECTATE) return;
    if (typeof STORY !== 'undefined' && STORY.active && STORY.cfg && STORY.cfg.fog === false) return;
    // Deploy fazında fog of war yok - harita açık görünsün
    if (phase === PHASE.DEPLOY) return;
    
    // Savaş fazında fog of war aktif
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.fillStyle = 'rgba(10, 15, 10, 0.95)';
    fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

    fogCtx.globalCompositeOperation = 'destination-out';

    for (const u of units) {
        if (u.dead || u.isRed !== myCanonicalSide) continue;
        // HAVA-ARAMA RADARI KARAYI AÇMAZ (kullanıcı kusur raporu, 2026-08-09 — doğrulandı).
        // Hedefleme tarafı ZATEN doğruydu: `canSee` (globals.js:1501) radar birimini kara hedefi için
        // atlar. Ama sis katmanı ayrı bir yoldan, HER dost birimin `vision`'ıyla açılıyordu — radarın
        // 2500px'lik dairesi kara sisini de siliyordu. Radar yalnız HAVA algılar; sis kara katmanıdır.
        if (u.airRadar || (STATS[u.type] && STATS[u.type].airRadar)) continue;
        const _rp = unitRenderPos(u);                                 // sis deliği de sprite ile aynı karede ilerlesin
        const s = worldToScreen(_rp.x, _rp.y);
        const vRadius = (Number.isFinite(u.vision) ? u.vision : STATS[u.type].vision) * zoom;
        
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
    if (phase !== PHASE.DEPLOY || mouseScreenY > canvas.height - 110) return;
    // Elde taşınan birlik varsa hayaleti ONUN tipiyle çizilir → nereye bırakacağın net görünür
    const ghostType = deployCarried ? deployCarried.type : selectedSpawnType;
    if (ghostType === null || ghostType === undefined) return;
    const world = screenToWorld(mouseScreenX, mouseScreenY);
    if (!isInPlayerZone(world.x, world.y)) return;

    const dw = drawW(), dh = drawH();
    // Bırakılamaz nokta (dolu) kırmızı, geçerli nokta normal → tık öncesi geri bildirim
    const blocked = !deploySpotFree(world.x, world.y, deployCarried);
    ctx.globalAlpha = blocked ? 0.28 : 0.45;
    const sx = SP_PAD + (typeof battleSpriteCol === 'function' ? battleSpriteCol(ghostType) : ghostType) * (SP_W + SP_PAD);
    spriteReady() && ctx.drawImage(spriteSheet, sx, SP_PAD, SP_W, SP_H, mouseScreenX - dw / 2, mouseScreenY - dh / 2, dw, dh);
    ctx.globalAlpha = 1.0;
    if (blocked) {
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.75)'; ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(mouseScreenX, mouseScreenY, DEPLOY_MIN_GAP * zoom * 0.5, 0, Math.PI * 2); ctx.stroke();
    }

    const range = STATS[ghostType].range;
    ctx.strokeStyle = 'rgba(0, 255, 120, 0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(mouseScreenX, mouseScreenY, range * zoom, 0, Math.PI * 2); ctx.stroke();
    
    // Vision preview
    const vision = STATS[ghostType].vision;
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

    if (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid' && terrainGrid) {
        // grid: hücreleri minimap'e ölçekle
        const cw = mw / GRID_W, ch = mh / GRID_H;
        for (let gy = 0; gy < GRID_H; gy++) for (let gx = 0; gx < GRID_W; gx++) {
            const t = terrainGrid[gy * GRID_W + gx];
            if (t === TERRAIN.NONE) continue;
            minimapCtx.fillStyle = t === TERRAIN.WATER ? '#3f5fb0' : t === TERRAIN.MOUNTAIN ? '#70756a' : '#235c32';
            minimapCtx.fillRect(gx * cw, gy * ch, cw + 0.6, ch + 0.6);
        }
    } else for (const terrain of terrainFeatures) {
        const mx = terrain.x / WORLD_W * mw;
        const my = terrain.y / WORLD_H * mh;
        const rx = terrain.r / WORLD_W * mw;
        const ry = terrain.r / WORLD_H * mh;
        minimapCtx.fillStyle = terrain.type === TERRAIN.FOREST ? '#235c32' : terrain.type === TERRAIN.HILL ? '#9a8b5c' : '#70756a';
        minimapCtx.beginPath();
        minimapCtx.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    minimapCtx.strokeStyle = 'rgba(255,255,255,0.2)'; minimapCtx.lineWidth = 1;
    minimapCtx.beginPath(); minimapCtx.moveTo(0, mh / 2); minimapCtx.lineTo(mw, mh / 2); minimapCtx.stroke();

    for (const u of units) {
        if (u.dead) continue;
        // Düşman sis içindeyse minimap'te de gözükmez
        if (typeof battleUnitVisibleToViewer === 'function' &&
            !battleUnitVisibleToViewer(u, myCanonicalSide, phase)) continue;
        // T3 PUSU: gizli düşman (ormanda saklı, yakından fark edilmemiş) minimapta da yok
        if (u.isRed !== myCanonicalSide && phase === PHASE.BATTLE && u.isConcealed && u.isConcealed() && typeof enemyDetectsConcealed === 'function' && !enemyDetectsConcealed(u, myCanonicalSide)) continue;
        
        const mx = (u.x / WORLD_W) * mw, my = (u.y / WORLD_H) * mh;
        minimapCtx.fillStyle = u.isRed ? '#ff4444' : '#4488ff';
        minimapCtx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    const vx = (camera.x / WORLD_W) * mw, vy = (camera.y / WORLD_H) * mh;
    const vw = ((canvas.width / zoom) / WORLD_W) * mw, vh = (((canvas.height - 100) / zoom) / WORLD_H) * mh;
    minimapCtx.strokeStyle = 'rgba(255,255,255,0.5)'; minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(vx, vy, vw, vh);
}

spriteSheet.addEventListener('load', () => { if (typeof renderSpawnIcons === 'function') renderSpawnIcons(); });

let lastFrameTime = 0;
let simulationTime = 0;
let battleAccumulatorMs = 0;
let battlePerformanceWindow = {
    startedAt: 0,
    frames: 0,
    totalFrameMs: 0,
    maxFrameMs: 0,
    simulationSteps: 0,
    cappedFrames: 0
};

function updateTrenches(now) {
    for (let index = SIM.trenches.length - 1; index >= 0; index--) {
        const field = SIM.trenches[index];
        if ((field.expiresAt && now >= field.expiresAt) || field.hp <= 0) {
            SIM.trenches.splice(index, 1);
        }
    }
}

// ═══ BİRLEŞİK SİMÜLASYON ADIMI ════════════════════════════════════════════════
// Tek fizik adımı: canlı gameLoop ve çok-oyunculu lockstep aynı fonksiyonu koşar
// → iki taraf sapmaz. İsteğe bağlı denetleyici step'in dışından verilir.
//   now           : sim saati (ms)
//   dtSec         : bu adımın saniye süresi (savaş süresi/irade/oran hesapları)
//   driveController(now): isteğe bağlı savaş denetleyicisi
//   spawnDeathVfx : canlıda ölümde patlama efekti (render); headless'te false
// Faz 0/1b: bekleyen oyuncu komutlarını tik sınırında (stepSim başı) uygula + kaydet — replay ile aynı
// kod yolundan (battleApplyRecordedEvent). Böylece asenkron fare girdisi determinizmi bozmaz.
function flushPendingPlayerCommands() {
    if (!pendingPlayerCommands.length) return;
    const cmds = pendingPlayerCommands;
    pendingPlayerCommands = [];
    for (const c of cmds) {
        if (typeof battleApplyRecordedEvent === 'function') battleApplyRecordedEvent({ type: c.type, payload: c.payload });
        if (typeof battleRecordEvent === 'function') battleRecordEvent(c.type, c.payload);
    }
}

function stepSim(now, dtSec, driveController, spawnDeathVfx) {
    updateTrenches(now);
    flushPendingPlayerCommands();          // oyuncu komutları: tik-sınırı, replay ile aynı nokta
    if (driveController) driveController(now);
    // FAZ 6: "bu maçtan öğren" açıksa kırmızının karar-durumlarını yakala (insan-maçı DAgger; opt-in, gate'li)
    if (typeof battleMaybeCaptureDecisionSnapshot === 'function') battleMaybeCaptureDecisionSnapshot(true);
    SIM.spatialGrid.clear();
    for (let i = SIM.units.length - 1; i >= 0; i--) {
        if (SIM.units[i].dead) {
            if (spawnDeathVfx) {
                const _du = SIM.units[i];
                spawnExplosion(_du.x, _du.y, _du.type === T.ARMOR ? 1.5 : 1);     // tank ölümü = büyük boom
                if (_du.type === T.ARMOR && typeof triggerCinematic === 'function') {
                    const ss = worldToScreen(_du.x, _du.y);                       // SADECE ekrandaysa slow-mo
                    if (ss.x > 0 && ss.x < canvas.width && ss.y > 0 && ss.y < canvas.height) triggerCinematic();
                }
            }
            SIM.units.splice(i, 1);
        } else if (!SIM.units[i].loaded) {
            SIM.spatialGrid.insert(SIM.units[i]);   // TAŞINAN piyade grid'e girmez (hedeflenmez/çarpışmaz)
        }
    }
    // Hasar anlık uygulandığı için sabit dizi sırası, önce oluşturulan tarafa
    // kalıcı "ilk ateş" avantajı veriyordu (normalde mavi birlikler önce spawn olur).
    // Dizi durumunu değiştirmeden yürütme yönünü her tick ters çevirerek iki tarafa
    // eşit sayıda ilk icra hakkı ver. Canlı, headless, hikâye ve hızlı maç aynı
    // stepSim yolunu kullandığından bu adalet düzeltmesi bütün motorlarda ortaktır.
    // RENDER ARA-DEĞERİ: tik BAŞINDAKİ konumu sakla (çizim bununla u.x arasında lerp eder → 60 fps pürüzsüz).
    // Yalnız canlı çizimde; headless tezgâhta hiç yazılmaz. Sim alanı DEĞİL (hash'e girmez).
    if (!SIM.headless && typeof BATTLE_RENDER_INTERP !== 'undefined' && BATTLE_RENDER_INTERP) {
        for (let i = 0; i < SIM.units.length; i++) {
            SIM.units[i]._rpx = SIM.units[i].x;
            SIM.units[i]._rpy = SIM.units[i].y;
        }
    }
    if (((SIM.tick || 0) & 1) === 0) {
        for (let i = 0; i < SIM.units.length; i++) {
            SIM.units[i].update(now, dtSec);
        }
    } else {
        for (let i = SIM.units.length - 1; i >= 0; i--) {
            SIM.units[i].update(now, dtSec);
        }
    }
    // DEFERRED-DAMAGE: bekleyen-vuruşları (arriveTick gelenleri) uygula — onDeath-sweep'ten ÖNCE (varışta-ölen aynı-tik command_shock/patlama alsın)
    if (typeof battleProcessPendingHits === 'function') battleProcessPendingHits(now);
    // ONDEATH-EFEKTLERİ (command_shock): tüm birimler güncellendikten sonra yeni-ölenlerin ölüm-efektlerini uygula (tek-seferlik)
    if (typeof battleApplyDeathEffects === 'function') battleApplyDeathEffects(now);
    // Birlikler hareket ettikten sonra çarpışma komşuluğunu güncelle. Eski
    // konumlarla çözüm yapmak dar geçitlerde görünmez kuyruk ve yanlış itme üretir.
    SIM.spatialGrid.clear();
    for (const unit of SIM.units) {
        if (!unit.dead && !unit.loaded) SIM.spatialGrid.insert(unit);   // TAŞINAN piyade grid dışı
    }
    resolveCollisions();
    if (typeof updateMines === 'function') updateMines(now);   // MAYIN: düşman basınca patla (grid güncel — hedefleme sonrası)
    if (typeof updateBattleRules === 'function') updateBattleRules(dtSec, now);
    SIM.tick = (SIM.tick || 0) + 1;
    if (typeof battleMaybeRecordHash === 'function') battleMaybeRecordHash();
    if (typeof battleBalanceSample === 'function') battleBalanceSample();   // kabul-bataryası per-tik örnekleyici (gate'li)
}

function gameLoop(timestamp) {
    // HİKAYE: dünya-haritası ekranı aktifse düello render'ını atla, dünyayı çiz/işle (kendi canvas'ı)
    if (typeof APP_SCREEN !== 'undefined' && APP_SCREEN === 'story') {
        if (typeof storyWorldFrame === 'function') storyWorldFrame(timestamp);
        requestAnimationFrame(gameLoop);
        return;
    }
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        resize();
    }
    
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = Math.max(0, Math.min(250, timestamp - lastFrameTime));
    if (typeof updateCinematic === 'function') updateCinematic(dt / 1000);
    lastFrameTime = timestamp;

    const _mpActive = (typeof MP !== 'undefined' && MP.active);
    if (hitStopVisualMs > 0) hitStopVisualMs = Math.max(0, hitStopVisualMs - dt);

    if (screenShake > 0) {
        screenShake *= 0.9;                          // trauma decay
        if (screenShake < 0.02) screenShake = 0;
    }

    updateCamera();

    if (phase === PHASE.BATTLE) {
        if (!battlePerformanceWindow.startedAt) battlePerformanceWindow.startedAt = timestamp;
        battlePerformanceWindow.frames++;
        battlePerformanceWindow.totalFrameMs += dt;
        battlePerformanceWindow.maxFrameMs = Math.max(battlePerformanceWindow.maxFrameMs, dt);
        if (_mpActive) {
            mpStep(timestamp);                       // ÇOK OYUNCULU: sabit-tick lockstep (kendi içinde stepSim çağırır)
            RENDER_ALPHA = 1;                        // MP akümülatörü içeride; ara-değer yok (konum tik-sonu)
        } else {
            // KOMUTAN MODU: dış-komutan turu gelince sim DURUR (adım atma, zaman biriktirme) — emir bekle.
            // ESC DURAKLATMA: zaman BIRIKTIRILMEZ ve tik ATILMAZ → determinizm/replay etkilenmez.
            const _duraklat = (typeof BATTLE_PAUSED !== 'undefined') && BATTLE_PAUSED;
            const _cmdrMayStep = !_duraklat && ((typeof commanderPreStep !== 'function') || commanderPreStep());
            battleAccumulatorMs += _cmdrMayStep ? dt * GAME_SPEED : 0;
            let steps = 0;
            while (_cmdrMayStep && battleAccumulatorMs >= BATTLE_TICK_MS && steps < BATTLE_MAX_STEPS_PER_FRAME
                   && !(typeof commanderShouldStopStepping === 'function' && commanderShouldStopStepping())) {
                simulationTime += BATTLE_TICK_MS;
                gameTime += BATTLE_TICK_SEC;
                const driveController = BATTLE_REPLAY_DRIVER.active ? battleReplayDrive : battleControllersDrive;
                stepSim(simulationTime, BATTLE_TICK_SEC, driveController, true);
                updateSupport(BATTLE_TICK_SEC, simulationTime);
                battleAccumulatorMs -= BATTLE_TICK_MS;
                steps++;
            }
            // Kalan akümülatör = bir sonraki tike ne kadar kaldığı → çizim o oranda ileri taşır.
            // Duraklatmada/adım atılmayan karede de doğru: prev==son adım öncesi, alpha sabit kalır.
            RENDER_ALPHA = Math.max(0, Math.min(1, battleAccumulatorMs / BATTLE_TICK_MS));
            battlePerformanceWindow.simulationSteps += steps;
            if (steps >= BATTLE_MAX_STEPS_PER_FRAME &&
                battleAccumulatorMs >= BATTLE_TICK_MS) {
                battlePerformanceWindow.cappedFrames++;
            }
        }
        if (timestamp - battlePerformanceWindow.startedAt >= 1000) {
            const elapsedMs = Math.max(1, timestamp - battlePerformanceWindow.startedAt);
            if (typeof battleRecordPerformanceSample === 'function') {
                battleRecordPerformanceSample({
                    windowMs: Math.round(elapsedMs),
                    fps: Math.round(
                        battlePerformanceWindow.frames * 100000 / elapsedMs
                    ) / 100,
                    averageFrameMs: Math.round(
                        battlePerformanceWindow.totalFrameMs /
                        Math.max(1, battlePerformanceWindow.frames) * 100
                    ) / 100,
                    maxFrameMs: Math.round(battlePerformanceWindow.maxFrameMs * 100) / 100,
                    simulationSteps: battlePerformanceWindow.simulationSteps,
                    cappedFrames: battlePerformanceWindow.cappedFrames,
                    accumulatorMs: Math.round(battleAccumulatorMs * 100) / 100
                });
            }
            battlePerformanceWindow = {
                startedAt: timestamp,
                frames: 0,
                totalFrameMs: 0,
                maxFrameMs: 0,
                simulationSteps: 0,
                cappedFrames: 0
            };
        }
        // Render efektleri gerçek frame süresini kullanır; savaş durumuna geri yazamaz.
        updateParticles(dt / 1000);
        if (typeof updateFloatTexts === 'function') updateFloatTexts(dt / 1000);   // hasar sayıları (gerçek dt)
        checkGameOver();
    } else if (phase === PHASE.DEPLOY) {
        resolveCollisions();
    }

    // Sinematik zoom (render-only, ekran-merkezli; oyuncunun zoom/kamera'sı kalıcı DEĞİŞMEZ)
    let _cz = false, _sZoom, _sCamX, _sCamY;
    if (typeof cinemaZoom !== 'undefined' && cinemaZoom > 1.001 && phase === PHASE.BATTLE) {
        _cz = true; _sZoom = zoom; _sCamX = camera.x; _sCamY = camera.y;
        const cw = screenToWorld(canvas.width / 2, canvas.height / 2);
        zoom = zoom * cinemaZoom;
        camera.x = cw.x - (canvas.width / 2) / zoom;
        camera.y = cw.y - (canvas.height / 2) / zoom;
    }
    drawMap();
    units.forEach(u => u.draw());
    if (typeof warRoomDrawBattleAxis === 'function') warRoomDrawBattleAxis(ctx);
    drawParticles(ctx);
    if (typeof drawFloatTexts === 'function') drawFloatTexts(ctx);   // hasar sayıları (partiküllerin üstünde)
    drawSupport(ctx);
    drawFogOfWar();
    drawGhost();
    if (_cz) { zoom = _sZoom; camera.x = _sCamX; camera.y = _sCamY; }   // sinematik zoom geri al → HUD/minimap doğru kalır
    drawSelectionBox();
    drawMinimap();
    updateUI();
    if (typeof refreshAbilityPanelIfChanged === 'function') refreshAbilityPanelIfChanged();   // sol-panel yetenek-seçici (seçim/mod değişince)

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
