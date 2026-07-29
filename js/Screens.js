// ═══════════════════════════════════════════════════════════════════════════
//  EKRAN YÖNETİCİSİ (PIXEL EUROPA — Faz 1)
//  Ana ekran (Yeni Hikaye / Hızlı Maç / Ayarlar) + Hızlı Maç akışı (puan→bütçe→düello).
//  Düello çekirdeğine DOKUNMAZ — sadece sahne yönetir + bütçe köprüsü kurar.
//  body[data-screen] CSS ile oyun-HUD'unu menüde gizler. showScreen tek otorite.
// ═══════════════════════════════════════════════════════════════════════════

let APP_SCREEN = 'menu';

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
    const role = qmSelected('qm-role', 'attacker');
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
    if (hint) hint.textContent = `Ortak savaş AI denetleyicisi etkin. ${roleHint[role] || roleHint.attacker}`;
}

// Buton grubu seçimi (rol / zorluk) — seçili değeri döndürür
function qmSelected(groupId, fallback) {
    const el = document.querySelector(`#${groupId} button.selected`);
    return el ? (el.dataset.role || el.dataset.skill || el.dataset.control) : fallback;
}

function quickMatchStart() {
    const ai = +(document.getElementById('qm-ai')?.value || 1500);
    const pl = +(document.getElementById('qm-pl')?.value || 1500);

    // SAVAŞ ROLÜ: attackerSide true = KIRMIZI saldırır (oyuncu savunur).
    // Oyuncu "saldıran" seçerse kırmızı savunur; rastgele ise maç başında atılır.
    let role = qmSelected('qm-role', 'attacker');
    if (role === 'random') role = (Math.random() < 0.5) ? 'attacker' : 'defender';
    openBattlefieldSession({
        mode: 'quick',
        mapId: -2,
        attackerSide: role === 'defender',
        durationSec: DEFAULT_BATTLE_DURATION_SEC,
        playerMoney: pl,
        enemyMoney: ai,
        deployRes: null,
        deployPool: null,
        techBonus: null,
        techBonusRed: null
    });
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
    ['qm-role'].forEach(groupId => {
        document.getElementById(groupId)?.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            document.querySelectorAll(`#${groupId} button`).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            quickMatchUpdate();
        });
    });
    // TEK HARİTA: artık yalnız çizilen harita var → seçici satırını gizle.
    const qmMapRow = document.getElementById('qm-map')?.closest('.qm-row');
    if (qmMapRow) qmMapRow.style.display = 'none';
    document.getElementById('btn-qm-start')?.addEventListener('click', quickMatchStart);
    document.getElementById('btn-qm-back')?.addEventListener('click', () => showScreen('menu'));
    // Oyun-bitti ekranındaki "Ana Menü" (varsa) → menüye dön (Faz 1.5'te resetBattleState; şimdilik reload)
    document.getElementById('btn-go-menu')?.addEventListener('click', () => { try { location.reload(); } catch (_) {} });
    showScreen('menu');   // AÇILIŞ: ana ekran (oyun arka planda DEPLOY'da ama menü kapatır)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', screensInit);
else screensInit();
