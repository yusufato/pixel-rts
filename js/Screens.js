// ═══════════════════════════════════════════════════════════════════════════
//  EKRAN YÖNETİCİSİ (PIXEL EUROPA — Faz 1)
//  Ana ekran (Yeni Hikaye / Hızlı Maç / Ayarlar) + Hızlı Maç akışı (puan→bütçe→düello).
//  Düello çekirdeğine DOKUNMAZ — sadece sahne yönetir + bütçe köprüsü kurar.
//  body[data-screen] CSS ile oyun-HUD'unu menüde gizler. showScreen tek otorite.
// ═══════════════════════════════════════════════════════════════════════════

let APP_SCREEN = 'menu';

function showScreen(name) {
    document.body.setAttribute('data-screen', name);                       // CSS: oyun-HUD'u 'game' dışında gizlenir
    document.querySelectorAll('.app-screen').forEach(e => e.classList.add('hidden'));
    const ov = document.getElementById('screen-' + name);
    if (ov) ov.classList.remove('hidden');
    APP_SCREEN = name;
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
    // PUAN → BÜTÇE: oyuncu pl ile birlik dizer; AI ai ile (aiDeploy enemy.money okur).
    if (typeof player !== 'undefined') player.money = pl;
    if (typeof enemy !== 'undefined') enemy.money = ai;
    // Çeşitlilik için bu maça özel harita-tohumu (10-harita sistemi sonraki adım; şimdilik seed çeşidi)
    if (typeof resetSimRng === 'function') resetSimRng((Date.now() >>> 0) || 1);
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

function mpInit() {
    mpResetLobbyUI();                       // her açılışta paneli sıfırla
    if (mpInit._bound) return;
    mpInit._bound = true;
    // HOST: Oyun Kur → kendi sunucusuna bağlan → oda kur → ŞİFRE üret
    document.getElementById('btn-mp-create')?.addEventListener('click', () => { if (typeof mpCreateGame === 'function') mpCreateGame(); });
    // GUEST: şifreyi gir → Oyuna Katıl → host'un sunucusuna bağlan
    document.getElementById('btn-mp-join')?.addEventListener('click', () => {
        const code = document.getElementById('mp-code-input')?.value || '';
        if (!code.trim()) { alert('Önce arkadaşının verdiği şifreyi gir.'); return; }
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
    document.getElementById('btn-mp-back')?.addEventListener('click', () => { try { if (Net.ws) Net.ws.close(); } catch (_) {} showScreen('menu'); });
}

function screensInit() {
    document.getElementById('btn-quick-match')?.addEventListener('click', () => { showScreen('quickmatch'); quickMatchUpdate(); });
    document.getElementById('btn-new-story')?.addEventListener('click', () => alert('📜 Yeni Hikaye (açık-dünya / kalıcı imparatorluk) yakında — Faz 2.'));
    document.getElementById('btn-multiplayer')?.addEventListener('click', () => { showScreen('multiplayer'); if (typeof mpInit === 'function') mpInit(); });
    document.getElementById('btn-settings')?.addEventListener('click', () => alert('⚙️ Ayarlar yakında (devlet sayısı, kaynak bolluğu, zorluk).'));
    document.getElementById('qm-ai')?.addEventListener('input', quickMatchUpdate);
    document.getElementById('qm-pl')?.addEventListener('input', quickMatchUpdate);
    document.getElementById('btn-qm-start')?.addEventListener('click', quickMatchStart);
    document.getElementById('btn-qm-back')?.addEventListener('click', () => showScreen('menu'));
    // Oyun-bitti ekranındaki "Ana Menü" (varsa) → menüye dön (Faz 1.5'te resetBattleState; şimdilik reload)
    document.getElementById('btn-go-menu')?.addEventListener('click', () => { try { location.reload(); } catch (_) {} });
    showScreen('menu');   // AÇILIŞ: ana ekran (oyun arka planda DEPLOY'da ama menü kapatır)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', screensInit);
else screensInit();
