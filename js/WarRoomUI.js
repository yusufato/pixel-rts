// ═══════════════════════════════════════════════════════════════════════════
// WarRoomUI — terminal kabuğu, ana menü ve yaşayan-dünya kurulum akışı.
// Meta mekaniği Story.js'te kalır; bu dosya yalnız UI state'i ve güvenli köprüdür.
// ═══════════════════════════════════════════════════════════════════════════

const WAR_ROOM_UI_KEY = 'pixelRtsWarRoomUI';
const WAR_ROOM_STATE_FLAVOR = [
    { code: 'TR', role: 'DENGELİ', mil: 72, eco: 64 },
    { code: 'IB', role: 'FIRSATÇI', mil: 61, eco: 76 },
    { code: 'BK', role: 'SAVUNMACI', mil: 68, eco: 70 },
    { code: 'CB', role: 'SALDIRGAN', mil: 82, eco: 58 },
    { code: 'KB', role: 'TEMKİNLİ', mil: 57, eco: 79 },
    { code: 'SF', role: 'KUŞATMACI', mil: 78, eco: 55 },
    { code: 'MB', role: 'FIRSATÇI', mil: 64, eco: 67 },
    { code: 'AB', role: 'DENGELİ', mil: 70, eco: 63 }
];

const WAR_ROOM_SETUP = {
    stateId: null,
    doctrine: 'combined',
    abundance: 1,
    fog: true
};
const WAR_ROOM_PERKS = [
    { id: 'schwerpunkt', rank: 1, name: 'Schwerpunkt', effect: 'Ana çaba kuvveti +%10' },
    { id: 'logistics', rank: 2, name: 'Lojistikçi', effect: '+200 konuşlandırma bütçesi' },
    { id: 'steel-wall', rank: 3, name: 'Çelik-Duvar', effect: 'Tüm birliklere +1 zırh' },
    { id: 'mobilization', rank: 4, name: 'Hızlı-Seferberlik', effect: '+150 insan-gücü bütçesi' },
    { id: 'ambusher', rank: 5, name: 'Pusucu', effect: 'İlk temas kanat hasarı +%15' },
    { id: 'morale', rank: 6, name: 'Kanaat-Önderi', effect: 'Panik direnci +%25' }
];
let WAR_ROOM_SELECTED_REWARD = null;

function warRoomLoadPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(WAR_ROOM_UI_KEY) || '{}');
        return { crt: saved.crt !== false, volume: Number.isFinite(+saved.volume) ? Math.max(0, Math.min(100, +saved.volume)) : 70 };
    } catch (_) {
        return { crt: true, volume: 70 };
    }
}

function warRoomSavePrefs() {
    const crt = !!document.getElementById('wr-crt-toggle')?.checked;
    const volume = +(document.getElementById('wr-volume')?.value || 70);
    try { localStorage.setItem(WAR_ROOM_UI_KEY, JSON.stringify({ crt, volume })); } catch (_) {}
    document.body.classList.toggle('wr-crt-off', !crt);
}

function warRoomRefreshMenu() {
    const btn = document.getElementById('btn-story-continue');
    const copy = document.getElementById('wr-continue-copy');
    const status = document.getElementById('wr-save-status');
    if (!btn || !copy || !status) return;
    const hasSave = typeof storyHasSave === 'function' && storyHasSave();
    btn.disabled = !hasSave;
    if (!hasSave) {
        copy.textContent = 'Kayıtlı harekât bulunamadı';
        status.innerHTML = '<span class="wr-status-dot"></span>KAMPANYA KAYDI BULUNAMADI';
        return;
    }

    let label = 'Kayıtlı harekât hazır';
    try {
        const raw = localStorage.getItem(typeof STORY_SAVE_KEY !== 'undefined' ? STORY_SAVE_KEY : 'pixelrts_story_v3');
        const data = raw ? JSON.parse(raw) : null;
        const state = data?.states?.find(s => s.id === (data.playerStateId | 0));
        const veterans = Array.isArray(data?.veterans) ? data.veterans.length : 0;
        if (state) label = `${state.name} · ${veterans} gazi · harekât hazır`;
    } catch (_) {}
    copy.textContent = label;
    status.innerHTML = '<span class="wr-status-dot ok"></span>KAMPANYA KAYDI DOĞRULANDI';
}

function warRoomRenderStates() {
    const grid = document.getElementById('wr-state-grid');
    if (!grid || typeof STORY_STATE_DEFS === 'undefined') return;
    grid.innerHTML = STORY_STATE_DEFS.map((state, index) => {
        const flavor = WAR_ROOM_STATE_FLAVOR[index] || { code: `D${index + 1}`, role: 'DENGELİ', mil: 60, eco: 60 };
        const selected = WAR_ROOM_SETUP.stateId === index;
        return `
            <button class="wr-state-card${selected ? ' selected' : ''}" type="button" role="option" aria-selected="${selected}" data-state-id="${index}" style="--state-color:${state.color}">
                <span class="wr-state-head">
                    <span class="wr-state-code">${flavor.code}</span>
                    <span><span class="wr-state-name">${state.name}</span><span class="wr-state-role">${flavor.role}</span></span>
                </span>
                <span class="wr-state-stats">
                    <span>ASK<div class="wr-mini-bar" style="--bar-color:var(--wr-red)"><i style="width:${flavor.mil}%"></i></div></span>
                    <span>EKO<div class="wr-mini-bar" style="--bar-color:var(--wr-green)"><i style="width:${flavor.eco}%"></i></div></span>
                </span>
            </button>`;
    }).join('');
}

function warRoomSelectState(stateId) {
    if (typeof STORY_STATE_DEFS === 'undefined' || !STORY_STATE_DEFS[stateId]) return;
    WAR_ROOM_SETUP.stateId = stateId;
    warRoomRenderStates();
    const state = STORY_STATE_DEFS[stateId];
    const flavor = WAR_ROOM_STATE_FLAVOR[stateId];
    const selected = document.getElementById('wr-selected-state');
    if (selected) selected.innerHTML = `<b>${state.name}</b><br>${flavor.role} komuta profili · yaşayan dünya başlangıç bölgesi hazır.`;
    const start = document.getElementById('btn-story-start');
    if (start) start.disabled = false;
}

function warRoomSetupOpen() {
    WAR_ROOM_SETUP.stateId = null;
    WAR_ROOM_SETUP.doctrine = 'combined';
    WAR_ROOM_SETUP.abundance = 1;
    WAR_ROOM_SETUP.fog = true;
    warRoomRenderStates();
    document.querySelectorAll('#screen-story-setup .wr-option-row').forEach(row => {
        row.querySelectorAll('button').forEach(btn => {
            const setting = row.dataset.setting;
            if (!setting) return;
            const current = setting === 'fog' ? 'on' : String(WAR_ROOM_SETUP[setting]);
            btn.classList.toggle('selected', btn.dataset.value === current);
        });
    });
    const selected = document.getElementById('wr-selected-state');
    if (selected) selected.textContent = 'Bir devlet seçerek harekât emrini hazırla.';
    const start = document.getElementById('btn-story-start');
    if (start) start.disabled = true;
}

function warRoomStartCampaign() {
    if (WAR_ROOM_SETUP.stateId == null || typeof storyNewCampaign !== 'function') return;
    storyNewCampaign({
        playerStateId: WAR_ROOM_SETUP.stateId,
        abundance: WAR_ROOM_SETUP.abundance,
        doctrine: WAR_ROOM_SETUP.doctrine,
        fog: WAR_ROOM_SETUP.fog
    });
    if (typeof storyOpen === 'function') storyOpen();
}

function warRoomContinueCampaign() {
    if (typeof storyContinue === 'function') storyContinue();
    else if (typeof storyOpen === 'function') storyOpen();
}

function warRoomToggleSettings() {
    const panel = document.getElementById('wr-settings-panel');
    const button = document.getElementById('btn-settings');
    if (!panel || !button) return;
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    button.setAttribute('aria-expanded', String(opening));
}

function warRoomHandleFunctionKey(event) {
    if (!/^F[1-4]$/.test(event.key) || /INPUT|SELECT|TEXTAREA/.test(event.target?.tagName || '')) return;
    event.preventDefault();
    if (event.key === 'F1') showScreen('menu');
    if (event.key === 'F2') { showScreen('story-setup'); warRoomSetupOpen(); }
    if (event.key === 'F3' && !document.getElementById('btn-story-continue')?.disabled) warRoomContinueCampaign();
    if (event.key === 'F4') { showScreen('quickmatch'); if (typeof quickMatchUpdate === 'function') quickMatchUpdate(); }
}

function warRoomUpdateDeploy() {
    const list = document.getElementById('deploy-comp-list');
    if (!list || typeof units === 'undefined' || typeof STATS === 'undefined') return;
    const own = units.filter(unit => !unit.dead && !unit.isRed && !unit.ally);
    const typeIds = Object.keys(STATS).map(Number).sort((a, b) => a - b);
    const counts = Object.fromEntries(typeIds.map(type => [type, 0]));
    own.forEach(unit => { if (counts[unit.type] != null) counts[unit.type]++; });
    const wallet = (typeof DEPLOY_RES !== 'undefined' && DEPLOY_RES?.blue)
        ? DEPLOY_RES.blue.oil + DEPLOY_RES.blue.manpower + DEPLOY_RES.blue.points
        : ((typeof player !== 'undefined' && player.money) || 0);
    const operationNode = (typeof STORY !== 'undefined' && STORY.active && STORY.battleCtx) ? storyNode(STORY.battleCtx.nodeId) : null;
    const doctrineKey = (typeof STORY !== 'undefined' && STORY.active && STORY.cfg?.doctrine) || 'combined';
    const doctrineNames = { armor: 'ZIRHLI MIZRAK', combined: 'BİRLEŞİK SİLAHLAR', defense: 'DERİN SAVUNMA' };
    const signature = `${typeIds.map(type => counts[type]).join(',')}|${Math.floor(wallet)}|${operationNode?.id ?? '-'}|${doctrineKey}`;
    if (warRoomUpdateDeploy._signature === signature) return;
    warRoomUpdateDeploy._signature = signature;

    const rows = typeIds.map(type => ({ count: counts[type], type, stat: STATS[type] })).filter(row => row.count > 0);
    list.innerHTML = rows.length ? rows.map(row => `
        <div class="deploy-comp-row">
            <span class="deploy-unit-sprite" style="background-position:${row.type * 12.5}% 0%"></span>
            <span>${row.stat.name}</span><b>×${row.count}</b><em>${row.stat.cost * row.count}</em>
        </div>`).join('') : '<div class="deploy-empty">HENÜZ BİRLİK YERLEŞTİRİLMEDİ</div>';
    const count = own.length;
    const unitCount = document.getElementById('deploy-unit-count');
    const fieldCount = document.getElementById('deploy-field-count');
    const budget = document.getElementById('deploy-budget-total');
    const operation = document.getElementById('deploy-operation-name');
    const doctrine = document.getElementById('deploy-doctrine');
    if (unitCount) unitCount.textContent = `${count} BİRLİK`;
    if (fieldCount) fieldCount.textContent = count;
    if (budget) budget.textContent = Math.floor(wallet);
    if (operation) operation.textContent = operationNode ? operationNode.name.toUpperCase() : 'SERBEST DÜELLO';
    if (doctrine) doctrine.textContent = doctrineNames[doctrineKey] || doctrineNames.combined;
}

const WAR_ROOM_BATTLE_FEED = [];

function warRoomBattleEvent(message, tone = 'info') {
    const stamp = typeof gameTime !== 'undefined' ? Math.max(0, gameTime) : 0;
    const mm = String(Math.floor(stamp / 60)).padStart(2, '0');
    const ss = String(Math.floor(stamp % 60)).padStart(2, '0');
    WAR_ROOM_BATTLE_FEED.unshift({ message, tone, time: `${mm}:${ss}` });
    if (WAR_ROOM_BATTLE_FEED.length > 8) WAR_ROOM_BATTLE_FEED.length = 8;
}

function warRoomResetBattleUI() {
    WAR_ROOM_BATTLE_FEED.length = 0;
    warRoomUpdateBattle._counts = null;
    warRoomBattleEvent('MUHAREBE AĞI HAZIR');
}

function warRoomIssueOrder(order) {
    if (typeof units === 'undefined') return;
    const own = units.filter(unit => !unit.dead && !unit.isRed && !unit.ally);
    const selected = own.filter(unit => unit.selected);
    const force = selected.length ? selected : own;
    if (!force.length) { warRoomBattleEvent('EMİR REDDEDİLDİ — DOST BİRLİK YOK', 'hostile'); return; }

    if (order === 'assault') {
        const foes = units.filter(unit => !unit.dead && unit.isRed);
        const tx = foes.length ? foes.reduce((sum, unit) => sum + unit.x, 0) / foes.length : (typeof WORLD_W !== 'undefined' ? WORLD_W * .8 : 2400);
        const ty = foes.length ? foes.reduce((sum, unit) => sum + unit.y, 0) / foes.length : (typeof WORLD_H !== 'undefined' ? WORLD_H * .5 : 900);
        const hasSchwerpunkt = typeof STORY !== 'undefined' && STORY.active && (STORY.commander.activePerks || []).includes('schwerpunkt');
        force.forEach(unit => {
            unit.manualTarget = null; unit.manualMoveTarget = { x: tx, y: ty }; unit.isMovingToManualTarget = true;
            if (hasSchwerpunkt && !unit._schwerpunktApplied) { unit.xpBonus *= 1.10; unit._schwerpunktApplied = true; }
        });
        warRoomBattleEvent(`TAARRUZ EMRİ — ${force.length} BİRLİK`, 'friendly');
    } else if (order === 'free-fire') {
        force.forEach(unit => { unit.manualTarget = null; unit.manualMoveTarget = null; unit.isMovingToManualTarget = false; });
        warRoomBattleEvent(`ATEŞ SERBEST — ${force.length} BİRLİK`, 'friendly');
    } else if (order === 'trench') {
        document.getElementById('btn-trench')?.click();
        warRoomBattleEvent('SİPER KAZ EMRİ AKTİF', 'info');
    } else if (order === 'paradrop') {
        document.getElementById('btn-paradrop')?.click();
        warRoomBattleEvent('PARAŞÜT HEDEFLEME AKTİF', 'info');
    }
}

function warRoomUpdateBattle() {
    if (typeof units === 'undefined' || typeof STATS === 'undefined' || typeof SIM === 'undefined') return;
    const blue = units.filter(unit => !unit.dead && !unit.isRed);
    const red = units.filter(unit => !unit.dead && unit.isRed);
    if (!WAR_ROOM_BATTLE_FEED.length) warRoomBattleEvent('TEMAS BAŞLADI');
    const countSig = `${blue.length}:${red.length}`;
    if (warRoomUpdateBattle._counts && warRoomUpdateBattle._counts !== countSig) {
        const [oldBlue, oldRed] = warRoomUpdateBattle._counts.split(':').map(Number);
        if (blue.length < oldBlue) warRoomBattleEvent(`DOST KAYIP — ${oldBlue - blue.length} BİRLİK`, 'hostile');
        if (red.length < oldRed) warRoomBattleEvent(`DÜŞMAN KAYBI — ${oldRed - red.length} BİRLİK`, 'friendly');
    }
    warRoomUpdateBattle._counts = countSig;

    const blueScore = Math.floor(SIM.vpScore?.blue || 0);
    const redScore = Math.floor(SIM.vpScore?.red || 0);
    const target = typeof VP_TARGET !== 'undefined' ? VP_TARGET : 3000;
    const blueBar = document.getElementById('battle-vp-blue');
    const redBar = document.getElementById('battle-vp-red');
    if (blueBar) blueBar.style.width = `${Math.min(50, blueScore / target * 50)}%`;
    if (redBar) redBar.style.width = `${Math.min(50, redScore / target * 50)}%`;
    const blueValue = document.getElementById('battle-vp-blue-value');
    const redValue = document.getElementById('battle-vp-red-value');
    if (blueValue) blueValue.textContent = blueScore;
    if (redValue) redValue.textContent = redScore;
    const sectors = typeof vpCounts === 'function' ? vpCounts() : { blue: 0, red: 0 };
    const sectorCount = document.getElementById('battle-vp-sector-count');
    if (sectorCount) sectorCount.textContent = `${sectors.blue} : ${sectors.red}`;

    const selected = units.find(unit => unit.selected && !unit.dead) || null;
    const stat = selected ? STATS[selected.type] : null;
    const friendly = !!(selected && !selected.isRed);
    const contact = document.getElementById('battle-target-card');
    contact?.classList.toggle('hostile', !!selected && !friendly);
    const label = document.getElementById('battle-contact-label');
    const state = document.getElementById('battle-contact-state');
    const name = document.getElementById('battle-target-name');
    const role = document.getElementById('battle-target-role');
    const sprite = document.getElementById('battle-target-sprite');
    if (label) label.textContent = selected ? (friendly ? 'TARGET LOCK' : 'HOSTILE CONTACT') : 'TARGET LOCK';
    if (state) state.textContent = selected ? (selected.attackTarget ? 'TEMAS' : 'TRACK') : 'BEKLEME';
    if (name) name.textContent = stat?.name?.toUpperCase() || 'BİRİM SEÇ';
    if (role) role.textContent = selected ? (selected.isPanicking ? 'PANİK' : selected.inTrench ? 'TAHKİMLİ' : 'SAHA BİRLİĞİ') : 'SAHA TEMASI YOK';
    if (sprite) {
        sprite.style.backgroundPosition = selected ? `${selected.type * 12.5}% ${selected.isRed ? '100%' : '0%'}` : '0% 0%';
        sprite.style.opacity = selected ? '1' : '.2';
    }
    const hullPct = selected ? Math.max(0, Math.min(100, selected.hp / Math.max(1, selected.maxHp) * 100)) : 0;
    const ammoPct = selected ? Math.max(0, Math.min(100, selected.ammo / Math.max(1, selected.maxAmmo || 1) * 100)) : 0;
    const hullBar = document.getElementById('battle-hull-bar');
    const ammoBar = document.getElementById('battle-ammo-bar');
    if (hullBar) hullBar.style.width = `${hullPct}%`;
    if (ammoBar) ammoBar.style.width = `${ammoPct}%`;
    const hullValue = document.getElementById('battle-hull-value');
    const ammoValue = document.getElementById('battle-ammo-value');
    if (hullValue) hullValue.textContent = selected ? `${Math.ceil(selected.hp)}/${selected.maxHp}` : '—';
    if (ammoValue) ammoValue.textContent = selected ? `${selected.ammo}/${selected.maxAmmo}` : '—';
    const stats = document.getElementById('battle-target-stats');
    if (stats) stats.innerHTML = selected ? `<span>ATK<b>${selected.atk}</b></span><span>RNG<b>${selected.range}</b></span><span>ZIRH<b>${selected.armor}</b></span><span>HIZ<b>${selected.speed.toFixed(2)}</b></span>` : '';
    const matchup = document.getElementById('battle-target-matchup');
    if (matchup) {
        const unitName = type => STATS[type]?.name || type;
        matchup.textContent = selected ? `GÜÇLÜ: ${(stat.strong || []).slice(0, 2).map(unitName).join(', ') || '—'} · ZAYIF: ${(stat.weak || []).slice(0, 2).map(unitName).join(', ') || '—'}` : 'Bir dost birim seçerek savaş verisini aç.';
    }
    const feed = document.getElementById('battle-feed-list');
    if (feed) feed.innerHTML = WAR_ROOM_BATTLE_FEED.map(item => `<div class="${item.tone}"><time>${item.time}</time><span>${item.message}</span></div>`).join('');
}

function warRoomDrawBattleAxis(context) {
    if (typeof phase === 'undefined' || typeof PHASE === 'undefined' || phase !== PHASE.BATTLE || typeof units === 'undefined') return;
    const force = units.filter(unit => unit.selected && !unit.dead && !unit.isRed && !unit.ally);
    if (!force.length) return;
    const lead = force[0];
    const target = lead.manualMoveTarget || lead.manualTarget || lead.attackTarget;
    if (!target || typeof worldToScreen !== 'function') return;
    const cx = force.reduce((sum, unit) => sum + unit.x, 0) / force.length;
    const cy = force.reduce((sum, unit) => sum + unit.y, 0) / force.length;
    const from = worldToScreen(cx, cy), to = worldToScreen(target.x, target.y);
    context.save();
    context.strokeStyle = 'rgba(255,176,0,.82)';
    context.fillStyle = '#ffd27a';
    context.lineWidth = 2;
    context.setLineDash([10, 7]);
    context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
    context.setLineDash([]);
    context.beginPath(); context.arc(to.x, to.y, 12, 0, Math.PI * 2); context.stroke();
    context.font = '10px monospace'; context.textAlign = 'center'; context.fillText('SCHWERPUNKT', (from.x + to.x) / 2, (from.y + to.y) / 2 - 8);
    context.restore();
}

function warRoomShowCampaignResult(result) {
    const panel = document.getElementById('campaign-result-panel');
    if (!panel || !result) return;
    WAR_ROOM_SELECTED_REWARD = null;
    panel.classList.remove('hidden');
    panel.querySelectorAll('[data-reward]').forEach(card => card.classList.remove('selected'));
    const claim = document.getElementById('story-claim-reward');
    if (claim) claim.disabled = true;
    const xp = document.getElementById('campaign-xp-earned');
    const rank = document.getElementById('campaign-rank-progress');
    const survivors = document.getElementById('campaign-survivor-count');
    if (xp) xp.textContent = `+${result.xpEarned || 0} XP`;
    if (rank && typeof STORY !== 'undefined') rank.textContent = `RÜTBE ${STORY.commander.rank} · ${STORY.commander.xp} XP`;
    if (survivors) survivors.textContent = `${result.survivors || 0} birlik taşınıyor`;
}

function warRoomRenderCommander() {
    if (typeof STORY === 'undefined' || !STORY.commander) return;
    if (typeof storyCommanderBackfill === 'function') storyCommanderBackfill(STORY.commander);
    const commander = STORY.commander;
    const ranks = typeof STORY_RANKS !== 'undefined' ? STORY_RANKS : [{ name: 'Teğmen', xp: 0 }];
    const rankIndex = Math.max(0, Math.min(ranks.length - 1, commander.rank - 1));
    const current = ranks[rankIndex], next = ranks[rankIndex + 1] || current;
    const startXp = current.xp, span = Math.max(1, next.xp - startXp);
    const progress = rankIndex === ranks.length - 1 ? 100 : Math.max(0, Math.min(100, (commander.xp - startXp) / span * 100));
    const mark = document.getElementById('commander-rank-mark');
    const name = document.getElementById('commander-rank-name');
    const bar = document.getElementById('commander-xp-bar');
    const text = document.getElementById('commander-xp-text');
    const summary = document.getElementById('commander-summary');
    if (mark) mark.textContent = `R${commander.rank}`;
    if (name) name.textContent = current.name.toUpperCase();
    if (bar) bar.style.width = `${progress}%`;
    if (text) text.textContent = rankIndex === ranks.length - 1 ? `${commander.xp} XP · AZAMİ RÜTBE` : `${commander.xp} / ${next.xp} XP`;
    if (summary) summary.innerHTML = `<div><span>SEFER SKORU</span><b>${commander.score}</b></div><div><span>ZAFER</span><b>${commander.victories}</b></div><div><span>VETERAN</span><b>${(STORY.veterans || []).length}</b></div><div><span>AKTİF KAYNAK</span><b>${Math.floor(commander.res.oil + commander.res.manpower + commander.res.points)}</b></div>`;

    const active = commander.activePerks || [];
    const slotCount = document.getElementById('commander-slot-count');
    if (slotCount) slotCount.textContent = `AKTİF ${active.length}/3`;
    const grid = document.getElementById('commander-perk-grid');
    if (grid) grid.innerHTML = WAR_ROOM_PERKS.map(perk => {
        const owned = commander.rank >= perk.rank, on = active.includes(perk.id);
        return `<button data-perk="${perk.id}" class="${on ? 'active ' : ''}${owned ? '' : 'locked'}" ${owned ? '' : 'disabled'}><span>R${perk.rank}</span><b>${perk.name}</b><small>${perk.effect}</small><em>${owned ? (on ? 'AKTİF' : 'PASİF') : `RÜTBE ${perk.rank} GEREKLİ`}</em></button>`;
    }).join('');
}

function warRoomOpenCommander() {
    if (typeof STORY === 'undefined' || !STORY.active) return;
    showScreen('commander');
    warRoomRenderCommander();
}

function warRoomTogglePerk(perkId) {
    if (typeof STORY === 'undefined' || !STORY.commander) return;
    const perk = WAR_ROOM_PERKS.find(item => item.id === perkId);
    if (!perk || STORY.commander.rank < perk.rank) return;
    const active = STORY.commander.activePerks || (STORY.commander.activePerks = []);
    const index = active.indexOf(perkId);
    if (index >= 0) active.splice(index, 1);
    else if (active.length < 3) active.push(perkId);
    if (typeof storySave === 'function') storySave();
    warRoomRenderCommander();
}

function warRoomInit() {
    if (warRoomInit._bound) return;
    warRoomInit._bound = true;

    const prefs = warRoomLoadPrefs();
    const crt = document.getElementById('wr-crt-toggle');
    const volume = document.getElementById('wr-volume');
    const volumeValue = document.getElementById('wr-volume-value');
    if (crt) crt.checked = prefs.crt;
    if (volume) volume.value = prefs.volume;
    if (volumeValue) volumeValue.value = `${prefs.volume}%`;
    document.body.classList.toggle('wr-crt-off', !prefs.crt);

    document.getElementById('btn-story-continue')?.addEventListener('click', warRoomContinueCampaign);
    document.getElementById('btn-settings')?.addEventListener('click', warRoomToggleSettings);
    document.getElementById('btn-setup-back')?.addEventListener('click', () => showScreen('menu'));
    document.getElementById('btn-story-start')?.addEventListener('click', warRoomStartCampaign);
    document.getElementById('wr-state-grid')?.addEventListener('click', event => {
        const card = event.target.closest('[data-state-id]');
        if (card) warRoomSelectState(+card.dataset.stateId);
    });
    document.querySelectorAll('#screen-story-setup .wr-option-row[data-setting]').forEach(row => {
        row.addEventListener('click', event => {
            const button = event.target.closest('button[data-value]');
            if (!button) return;
            row.querySelectorAll('button').forEach(item => item.classList.toggle('selected', item === button));
            const setting = row.dataset.setting;
            WAR_ROOM_SETUP[setting] = setting === 'abundance' ? +button.dataset.value : (setting === 'fog' ? button.dataset.value === 'on' : button.dataset.value);
        });
    });
    crt?.addEventListener('change', warRoomSavePrefs);
    volume?.addEventListener('input', () => {
        if (volumeValue) volumeValue.value = `${volume.value}%`;
        warRoomSavePrefs();
    });
    window.addEventListener('keydown', warRoomHandleFunctionKey);
    document.getElementById('battle-orders')?.addEventListener('click', event => {
        const button = event.target.closest('[data-battle-order]');
        if (button) warRoomIssueOrder(button.dataset.battleOrder);
    });
    document.getElementById('story-commander-btn')?.addEventListener('click', warRoomOpenCommander);
    document.getElementById('commander-back-btn')?.addEventListener('click', () => {
        if (typeof storyEnterWorld === 'function') storyEnterWorld();
    });
    document.getElementById('commander-perk-grid')?.addEventListener('click', event => {
        const button = event.target.closest('[data-perk]');
        if (button && !button.disabled) warRoomTogglePerk(button.dataset.perk);
    });
    document.getElementById('campaign-draft-grid')?.addEventListener('click', event => {
        const card = event.target.closest('[data-reward]');
        if (!card) return;
        WAR_ROOM_SELECTED_REWARD = card.dataset.reward;
        document.querySelectorAll('#campaign-draft-grid [data-reward]').forEach(item => item.classList.toggle('selected', item === card));
        const claim = document.getElementById('story-claim-reward');
        if (claim) claim.disabled = false;
    });
    document.getElementById('story-claim-reward')?.addEventListener('click', () => {
        if (WAR_ROOM_SELECTED_REWARD && typeof storyClaimReward === 'function') storyClaimReward(WAR_ROOM_SELECTED_REWARD);
    });
    warRoomRefreshMenu();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', warRoomInit);
else warRoomInit();
