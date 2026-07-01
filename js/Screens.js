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
        SIM.controlPoints = [];
        SIM.vpScore = { red: 0, blue: 0 };
        SIM.vpWinner = null;
        SIM.tick = 0;
    }
    if (typeof player !== 'undefined') { player.kills = 0; player.unitsSpawned = 0; }
    if (typeof enemy !== 'undefined') { enemy.kills = 0; enemy.unitsSpawned = 0; }
    if (typeof gameTime !== 'undefined') gameTime = 0;
    if (typeof simulationTime !== 'undefined') simulationTime = 0;
    if (typeof phase !== 'undefined' && typeof PHASE !== 'undefined') phase = PHASE.DEPLOY;
    if (typeof selectedSpawnType !== 'undefined') selectedSpawnType = null;
    if (typeof battleTelemetry !== 'undefined' && battleTelemetry.reset) battleTelemetry.reset();
    if (typeof warRoomResetBattleUI === 'function') warRoomResetBattleUI();
    if (typeof commanderReset === 'function') commanderReset();
    if (typeof layeredAI !== 'undefined' && layeredAI.reset) layeredAI.reset(0);
    if (typeof resetGroundCanvas === 'function') resetGroundCanvas();
    if (typeof initControlPoints === 'function') initControlPoints();
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
}

function quickMatchStart() {
    const ai = +(document.getElementById('qm-ai')?.value || 1500);
    const pl = +(document.getElementById('qm-pl')?.value || 1500);
    resetBattleState();
    // PUAN → BÜTÇE: oyuncu pl ile birlik dizer; AI ai ile (aiDeploy enemy.money okur).
    if (typeof player !== 'undefined') player.money = pl;
    if (typeof enemy !== 'undefined') enemy.money = ai;
    // 10-HARİTA: seçili haritayı uygula (ya da 🎲 rastgele) — deploy/savaş bu terrain'de geçer
    if (typeof applyMap === 'function') {
        let mid = +(document.getElementById('qm-map')?.value);
        if (mid !== -2 && (isNaN(mid) || mid < 0)) mid = (typeof MAPS !== 'undefined') ? Math.floor(Math.random() * MAPS.length) : 0;   // -2=çizilen harita pas geçer
        applyMap(mid);
        if (typeof initControlPoints === 'function') initControlPoints();
    }
    if (typeof resetSimRng === 'function') resetSimRng((Date.now() >>> 0) || 1);
    // Hikaye-dışı maç → tek-para modu (kaynak-bazlı deploy KAPALI) + kaynak satırlarını gizle
    if (typeof DEPLOY_RES !== 'undefined') DEPLOY_RES = null;
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
    // 10-HARİTA seçiciyi doldur (🎲 Rastgele + 10 harita adı)
    const qmMap = document.getElementById('qm-map');
    if (qmMap && typeof MAPS !== 'undefined') {
        qmMap.innerHTML = '<option value="-2" selected>🗺️ Çizilen Harita</option>' +
            '<option value="-1">🎲 Rastgele</option>' +
            MAPS.map(m => '<option value="' + m.id + '">' + m.name + '</option>').join('');
    }
    document.getElementById('btn-qm-start')?.addEventListener('click', quickMatchStart);
    document.getElementById('btn-qm-back')?.addEventListener('click', () => showScreen('menu'));
    // Oyun-bitti ekranındaki "Ana Menü" (varsa) → menüye dön (Faz 1.5'te resetBattleState; şimdilik reload)
    document.getElementById('btn-go-menu')?.addEventListener('click', () => { try { location.reload(); } catch (_) {} });
    showScreen('menu');   // AÇILIŞ: ana ekran (oyun arka planda DEPLOY'da ama menü kapatır)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', screensInit);
else screensInit();
