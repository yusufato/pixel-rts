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
function mpInit() {
    if (mpInit._bound) { if (Net.connected) netSend({ type: 'list' }); return; }
    mpInit._bound = true;
    document.getElementById('mp-conn')?.addEventListener('click', () => {
        const ip = (document.getElementById('mp-server')?.value || '').trim() || 'localhost';
        netConnect(ip);
    });
    document.getElementById('btn-mp-create')?.addEventListener('click', () => {
        if (!Net.connected) { alert('Önce "Bağlan" (Host IP gir).'); return; }
        netSend({ type: 'create', name: 'Oyun' });
    });
    document.getElementById('btn-mp-join')?.addEventListener('click', () => {
        if (!Net.connected) { alert('Önce "Bağlan".'); return; }
        if (!Net.selectedRoom) { alert('Listeden bir oyun seç.'); return; }
        netSend({ type: 'join', room: Net.selectedRoom });
    });
    document.getElementById('btn-mp-back')?.addEventListener('click', () => { try { if (Net.ws) Net.ws.close(); } catch (_) {} showScreen('menu'); });
    // lobi açıkken oda listesini periyodik tazele
    setInterval(() => { if (APP_SCREEN === 'multiplayer' && Net.connected && !Net.room) netSend({ type: 'list' }); }, 3000);
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
