// ═══════════════════════════════════════════════════════════════════════════
//  EKRAN YÖNETİCİSİ (PIXEL EUROPA — Faz 1)
//  Ana ekran (Yeni Hikaye / Hızlı Maç / Ayarlar) + Hızlı Maç akışı (puan→bütçe→düello).
//  Düello çekirdeğine DOKUNMAZ — sadece sahne yönetir + bütçe köprüsü kurar.
//  body[data-screen] CSS ile oyun-HUD'unu menüde gizler. showScreen tek otorite.
// ═══════════════════════════════════════════════════════════════════════════

let APP_SCREEN = 'menu';

// Tüm maç türleri için tek, geri-uyumlu savaş sıfırlama noktası.
// Harita/AI yapılandırmasını korur; önceki maçın hareketli state'ini temizler.
function resetBattleState() {
    if (typeof units !== 'undefined') units.length = 0;
    if (typeof trenches !== 'undefined') trenches.length = 0;
    if (typeof particles !== 'undefined') particles.length = 0;
    if (typeof activeSupports !== 'undefined') activeSupports.length = 0;
    if (typeof craters !== 'undefined') craters.length = 0;
    if (typeof decals !== 'undefined') decals.length = 0;
    if (typeof supportCooldowns !== 'undefined') supportCooldowns.paradrop = 0;
    if (typeof SIM !== 'undefined') {
        SIM.tick = 0;
    }
    if (typeof resetBattleRules === 'function') resetBattleRules();
    if (typeof player !== 'undefined') { player.kills = 0; player.unitsSpawned = 0; }
    if (typeof enemy !== 'undefined') { enemy.kills = 0; enemy.unitsSpawned = 0; }
    if (typeof gameTime !== 'undefined') gameTime = 0;
    if (typeof simulationTime !== 'undefined') simulationTime = 0;
    if (typeof phase !== 'undefined' && typeof PHASE !== 'undefined') phase = PHASE.DEPLOY;
    if (typeof selectedSpawnType !== 'undefined') selectedSpawnType = null;
    if (typeof deployCarried !== 'undefined') deployCarried = null;   // elde taşınan birlik ölü referans kalmasın
    if (typeof battleTelemetry !== 'undefined' && battleTelemetry.reset) battleTelemetry.reset();
    if (typeof warRoomResetBattleUI === 'function') warRoomResetBattleUI();
    if (typeof commanderReset === 'function') commanderReset();
    if (typeof resetGroundCanvas === 'function') resetGroundCanvas();
    document.body.setAttribute('data-phase', 'deploy');
    document.getElementById('game-over-screen')?.classList.add('hidden');
    document.getElementById('start-btn')?.classList.remove('hidden');
    document.getElementById('ui-support')?.classList.add('hidden');
    const spawn = document.getElementById('ui-spawn-bar');
    if (spawn) { spawn.style.opacity = '1'; spawn.style.pointerEvents = 'auto'; }
}

function showScreen(name) {
    document.body.setAttribute('data-screen', name);                       // CSS: oyun-HUD'u 'game' dışında gizlenir
    if (name === 'game' && typeof phase !== 'undefined') document.body.setAttribute('data-phase', phase);
    document.querySelectorAll('.app-screen').forEach(e => e.classList.add('hidden'));
    const ov = document.getElementById('screen-' + name);
    if (ov) ov.classList.remove('hidden');
    APP_SCREEN = name;
    if (name === 'menu' && typeof warRoomRefreshMenu === 'function') warRoomRefreshMenu();
}

// ── HIZLI MAÇ: puan = ordu bütçesi (asimetrik puan = zorluk ayarı) ──
function quickMatchUpdate() {
    const ai = +(document.getElementById('qm-ai')?.value || 1500);
    const pl = +(document.getElementById('qm-pl')?.value || 1500);
    const aiV = document.getElementById('qm-ai-val'), plV = document.getElementById('qm-pl-val');
    if (aiV) aiV.textContent = ai;
    if (plV) plV.textContent = pl;
    const r = pl / ai;
    let d = 'Eşit ⚖️';
    if (r >= 1.30) d = 'Sana Çok Kolay 😎'; else if (r >= 1.08) d = 'Sana Avantaj 🙂';
    else if (r <= 0.77) d = 'Çok Zor 🔥'; else if (r <= 0.92) d = 'Sana Dezavantaj 😬';
    const el = document.getElementById('qm-difficulty');
    if (el) el.textContent = 'Denge: ' + d;
    // Rol seçimi görevi değiştirir: saldıran süreyle yarışır, savunan hattı tutar.
    const roleHint = { attacker: 'Saldıran sensin: 4 dakika içinde düşmanı kır, yoksa savunan kazanır.',
                       defender: 'Savunan sensin: hattı tut, süre dolarsa kazanırsın.',
                       random:   'Rol maç başında rastgele belirlenir.' };
    const hint = document.querySelector('#screen-quickmatch .qm-hint');
    if (hint) hint.textContent = roleHint[qmSelected('qm-role', 'attacker')] || roleHint.attacker;
}

// Buton grubu seçimi (rol / zorluk) — seçili değeri döndürür
function qmSelected(groupId, fallback) {
    const el = document.querySelector(`#${groupId} button.selected`);
    return el ? (el.dataset.role || el.dataset.skill) : fallback;
}

function quickMatchStart() {
    const ai = +(document.getElementById('qm-ai')?.value || 1500);
    const pl = +(document.getElementById('qm-pl')?.value || 1500);
    resetBattleState();

    // SAVAŞ ROLÜ: attackerSide true = KIRMIZI(AI) saldırır (oyuncu savunur).
    // Oyuncu "saldıran" seçerse AI savunmaya geçer; rastgele ise maç başında atılır.
    let role = qmSelected('qm-role', 'attacker');
    if (role === 'random') role = (Math.random() < 0.5) ? 'attacker' : 'defender';
    QUICK_MATCH_ATTACKER_SIDE = (role === 'defender');   // oyuncu savunuyorsa saldıran AI'dır

    // AI ZORLUĞU: komutan parametrelerini keskinleştirir/yumuşatır
    QUICK_MATCH_SKILL = qmSelected('qm-skill', 'normal');
    if (typeof commanderSetDifficulty === 'function') commanderSetDifficulty(QUICK_MATCH_SKILL);

    // PUAN → BÜTÇE: oyuncu pl ile birlik dizer; AI ai ile (aiDeploy enemy.money okur).
    if (typeof player !== 'undefined') player.money = pl;
    if (typeof enemy !== 'undefined') enemy.money = ai;
    // 10-HARİTA: seçili haritayı uygula (ya da 🎲 rastgele) — deploy/savaş bu terrain'de geçer
    if (typeof applyMap === 'function') {
        let mid = +(document.getElementById('qm-map')?.value);
        if (mid !== -2 && (isNaN(mid) || mid < 0)) mid = (typeof MAPS !== 'undefined') ? Math.floor(Math.random() * MAPS.length) : 0;   // -2=çizilen harita pas geçer
        applyMap(mid);
    }
    if (typeof resetSimRng === 'function') resetSimRng((Date.now() >>> 0) || 1);
    // Hikaye-dışı maç → tek-para modu (kaynak-bazlı deploy KAPALI) + kaynak satırlarını gizle
    if (typeof DEPLOY_RES !== 'undefined') DEPLOY_RES = null;
    if (typeof DEPLOY_POOL !== 'undefined') DEPLOY_POOL = null;   // havuz modu yalnız hikayede — Hızlı Maç tek-para
    if (typeof TECH_BONUS !== 'undefined') TECH_BONUS = null;   // teknoloji bonusu sadece hikaye → Quick Match'te kapalı
    if (typeof TECH_BONUS_RED !== 'undefined') TECH_BONUS_RED = null;
    ['res-oil', 'res-manpower', 'res-points'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    showScreen('game');   // deploy fazına gir (HUD görünür); oyuncu dizer → Savaşı Başlat
}

// ── Çok Oyunculu lobi bağlantıları (idempotent) ──
function mpResetLobbyUI() {
    const show = document.getElementById('mp-code-show');
    if (show) { show.classList.add('hidden'); show.style.display = 'none'; }
    const enter = document.getElementById('mp-code-enter');
    if (enter) { enter.classList.remove('hidden'); enter.style.display = 'block'; }
    if (typeof netSetWaiting === 'function') netSetWaiting(false);
    if (typeof netStatus === 'function') netStatus('● Hazır', '');
}

// İnternet / Aynı-Ağ modu seç (sekme) — placeholder + etiket güncellenir, panel sıfırlanır
function mpSetMode(mode) {
    if (typeof NET_MODE !== 'undefined') NET_MODE = mode;
    document.getElementById('mp-tab-cloud')?.classList.toggle('active', mode === 'cloud');
    document.getElementById('mp-tab-lan')?.classList.toggle('active', mode === 'lan');
    const inp = document.getElementById('mp-code-input');
    if (inp) inp.placeholder = (mode === 'cloud') ? 'ODA KODU (4 hane)' : 'ŞİFRE';
    const lbl = document.querySelector('#mp-code-enter .mp-code-label');
    if (lbl) lbl.textContent = (mode === 'cloud') ? 'Arkadaşının ODA KODUNU gir → "Oyuna Katıl":' : 'Arkadaşının şifresini gir → "Oyuna Katıl":';
    mpResetLobbyUI();
}

function mpInit() {
    if (!mpInit._bound) {
        mpInit._bound = true;
        // HOST: Oyun Kur → relay'e bağlan → oda kur → KOD üret
        document.getElementById('btn-mp-create')?.addEventListener('click', () => { if (typeof mpCreateGame === 'function') mpCreateGame(); });
        // GUEST: kodu gir → Oyuna Katıl
        document.getElementById('btn-mp-join')?.addEventListener('click', () => {
            const code = document.getElementById('mp-code-input')?.value || '';
            if (!code.trim()) { alert('Önce arkadaşının verdiği kodu gir.'); return; }
            if (typeof mpJoinByCode === 'function') mpJoinByCode(code);
        });
        document.getElementById('mp-code-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('btn-mp-join')?.click();
        });
        document.getElementById('mp-code-copy')?.addEventListener('click', () => {
            const c = (document.getElementById('mp-code')?.textContent || '').trim();
            try { navigator.clipboard.writeText(c); } catch (_) {}
            const b = document.getElementById('mp-code-copy'); if (b) { b.textContent = '✓ Kopyalandı'; setTimeout(() => { b.textContent = '📋 Kopyala'; }, 1500); }
        });
        document.getElementById('mp-tab-cloud')?.addEventListener('click', () => mpSetMode('cloud'));
        document.getElementById('mp-tab-lan')?.addEventListener('click', () => mpSetMode('lan'));
        document.getElementById('btn-mp-back')?.addEventListener('click', () => { try { if (Net.ws) Net.ws.close(); } catch (_) {} showScreen('menu'); });
    }
    mpSetMode(typeof NET_MODE !== 'undefined' ? NET_MODE : 'cloud');   // her açılışta UI'yı moda göre kur + paneli sıfırla
}

function screensInit() {
    document.getElementById('btn-quick-match')?.addEventListener('click', () => { showScreen('quickmatch'); quickMatchUpdate(); });
    document.getElementById('btn-new-story')?.addEventListener('click', () => {
        showScreen('story-setup');
        if (typeof warRoomSetupOpen === 'function') warRoomSetupOpen();
    });
    document.getElementById('btn-multiplayer')?.addEventListener('click', () => { showScreen('multiplayer'); if (typeof mpInit === 'function') mpInit(); });
    document.getElementById('qm-ai')?.addEventListener('input', quickMatchUpdate);
    document.getElementById('qm-pl')?.addEventListener('input', quickMatchUpdate);
    // Rol / zorluk buton grupları: tıklanan seçili olur (tek seçim)
    ['qm-role', 'qm-skill'].forEach(groupId => {
        document.getElementById(groupId)?.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            document.querySelectorAll(`#${groupId} button`).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            quickMatchUpdate();
        });
    });
    // 10-HARİTA seçiciyi doldur — DESIGN v2 gerçekçi arena adları (varsa), varsayılan v2 arena 0.
    // (applyMap zaten ARENAS_V2'den okur; eski MAPS adları yanıltıcıydı.) Çizilen/Rastgele opsiyonel.
    const qmMap = document.getElementById('qm-map');
    if (qmMap) {
        const hasV2 = (typeof ARENAS_V2 !== 'undefined' && ARENAS_V2.length);
        const names = hasV2 ? ARENAS_V2.map((a, i) => ({ id: i, name: a.name }))
                            : (typeof MAPS !== 'undefined' ? MAPS.map(m => ({ id: m.id, name: m.name })) : []);
        qmMap.innerHTML =
            names.map((m, i) => '<option value="' + m.id + '"' + (i === 0 ? ' selected' : '') + '>' + m.name + '</option>').join('') +
            '<option value="-1">🎲 Rastgele</option>' +
            '<option value="-2">🗺️ Çizilen Harita</option>';
    }
    document.getElementById('btn-qm-start')?.addEventListener('click', quickMatchStart);
    document.getElementById('btn-qm-back')?.addEventListener('click', () => showScreen('menu'));
    // Oyun-bitti ekranındaki "Ana Menü" (varsa) → menüye dön (Faz 1.5'te resetBattleState; şimdilik reload)
    document.getElementById('btn-go-menu')?.addEventListener('click', () => { try { location.reload(); } catch (_) {} });
    showScreen('menu');   // AÇILIŞ: ana ekran (oyun arka planda DEPLOY'da ama menü kapatır)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', screensInit);
else screensInit();
