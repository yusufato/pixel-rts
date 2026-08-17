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
    const ai = +(document.getElementById('qm-ai')?.value || 6500);
    const pl = +(document.getElementById('qm-pl')?.value || 6500);
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
    return el ? (el.dataset.role || el.dataset.skill || el.dataset.control || el.dataset.brain) : fallback;
}

// ── RAKIP AI SECIMI (kullanici istegi: "hangi ai ile mac yapacagimi secebilecegim bir buton") ──
// Rakip KIRMIZI taraftir (controller `battle-red-ai`, owner ENEMY_AI); oyuncu mavidir.
// intel3-pro AYRI bir bayrak DEGIL: intel4 kapaliyken elde edilen TABAN beyindir.
// Secim telemetriye de yazilir (`rakipBeyin`) — ham JSON'dan hangi beyinle oynandigi anlasilsin.
// ── IKI AI (kullanici karari, 2026-08-10) ──
// intel4-pro LISTEDEN KALDIRILDI: ~10.000 macta olculdu, intel4'u GECEMEDI (pro ≡ intel4, %50; en iyi
// mudahale bile bagimsiz havuzlarda sifir). Iki surumu ayri secenek diye sunmak, olmayan bir zorluk
// farki vaat etmek olurdu. beonai PASIF: klon-v2 96 bagimsiz macta kod-AI'dan ANLAMLI KOTU (t −2.85).
// Anahtarlar GERIYE DONUK CALISIR (eski kayit/telemetri 'intel4pro'/'beonai' yazmis olabilir):
// ikisi de intel4'e duser, sessizce baska bir beyin oynamaz.
/* ── UCUNCU ZORLUK: ONGORU (2026-08-17) ──────────────────────────────────────
   Yeni beyin degil, intel4'un UZERINE binen bir ARAMA katmani: her 5 saniyede en
   degerli 20 birim icin aday mevziler URETILIR ve her biri fork alinip GERCEKTEN
   5 saniye oynatilir; sonuc deger agiyla puanlanip en iyisi emir olur.
   Yani birim "su noktaya gidersem ne olur"u tahmin etmez, SIMULE EDER.

   OLCULDU (tools/rol-dengesi-paralel.js, n=128, eslestirilmis, tohum 100000+):
     intel4 (aramasiz) : saldiran %37.5   marj -742
     ONGORU (arama)    : saldiran %49.2   marj  +97
     FARK +839   t 2.87   (saptama tabani 819) -> ANLAMLI
   Bu, listedeki iki beyin arasindaki farktan cok daha buyuk ve OLCULMUS bir fark;
   yani gercek bir zorluk kademesi (intel4-pro'nun aksine, o intel4'u gecemedigi
   icin listeden kaldirilmisti).

   MALIYET: bos makinede 1.90x gercek zaman, ve arama YALNIZ AI birimlerinde kosar
   (oyuncunun birimleri `controlOwner === 'PLAYER'` suzgeciyle disarida). */
const QM_BEYIN = {
    intel3pro: { intel4: false, pro: false, beonai: null,  arama: false, ad: 'intel3-pro' },
    intel4:    { intel4: true,  pro: false, beonai: null,  arama: false, ad: 'intel4' },
    ongoru:    { intel4: true,  pro: false, beonai: null,  arama: true,  ad: 'ONGORU' },
    // ── ARTIK SECILEMEZ (geriye donuk esleme) ──
    intel4pro: { intel4: true,  pro: false, beonai: null,  arama: false, ad: 'intel4' },
    beonai:    { intel4: true,  pro: false, beonai: null,  arama: false, ad: 'intel4' },
};
function quickMatchApplyBrain(anahtar) {
    const b = QM_BEYIN[anahtar] || QM_BEYIN.intel4;   // varsayilan artik intel4 (en guclu kalan beyin)
    if (typeof BATTLE_INTEL4_RED !== 'undefined') BATTLE_INTEL4_RED = b.intel4;
    if (typeof BATTLE_INTEL4PRO_RED !== 'undefined') BATTLE_INTEL4PRO_RED = b.pro;
    if (typeof BATTLE_BEONAI_RED !== 'undefined') BATTLE_BEONAI_RED = b.beonai;
    /* ARAMA KATMANI — zorluk secimine bagli. `BATTLE_LOOKAHEAD_LIVE` startBattle'da
       okunur; burada kapatirsak ONGORU disindaki kademeler aramasiz oynar.
       ONEMLI: arama yalnizca RAKIP icin degil, AI olan HER birim icin acilir; oyuncunun
       birimleri zaten suzgecle disarida. Boylece muttefik AI de kademeye uyar. */
    if (typeof BATTLE_LOOKAHEAD_LIVE !== 'undefined') BATTLE_LOOKAHEAD_LIVE = !!b.arama;
    // Oyuncu tarafi (mavi) hicbir beyin almaz — dost AI kendi varsayilaniyla kalir.
    if (typeof BATTLE_INTEL4PRO_BLUE !== 'undefined') BATTLE_INTEL4PRO_BLUE = false;
    if (typeof BATTLE_BEONAI_BLUE !== 'undefined') BATTLE_BEONAI_BLUE = null;
    // beonai modelinin gercekten kayitli olup olmadigini DOGRULA — yoksa sessizce kod-AI oynar
    // ve kullanici "beonai ile oynadim" sanir (bu oturumda ayni sinif hata iki kez yasandi).
    // UYUMLULUK DA KONTROL EDILIR: surum kayitli ama BAYAT olabilir (baska motor surumunde
    // egitilmis). O durumda battleBeonaiBagla sessizce baglamaz ve yalniz konsola yazar —
    // kullanici "beonai ile oynadim" sanir. Burada GORULUR bir uyari veririz.
    let uyari = null;
    if (b.beonai) {
        if (typeof battleBeonaiUyumlu === 'function') {
            const u = battleBeonaiUyumlu(b.beonai);
            if (!u.uyumlu) uyari = u.sebep;
        } else if (typeof BATTLE_BEONAI_SURUMLER !== 'undefined' && !BATTLE_BEONAI_SURUMLER[b.beonai]) {
            uyari = 'model bulunamadi: ' + b.beonai;
        }
        if (uyari && typeof BATTLE_BEONAI_RED !== 'undefined') BATTLE_BEONAI_RED = null;
    }
    return { ad: b.ad, uyari };
}

function quickMatchStart() {
    const ai = +(document.getElementById('qm-ai')?.value || 6500);
    const pl = +(document.getElementById('qm-pl')?.value || 6500);

    // SAVAŞ ROLÜ: attackerSide true = KIRMIZI saldırır (oyuncu savunur).
    // Oyuncu "saldıran" seçerse kırmızı savunur; rastgele ise maç başında atılır.
    let role = qmSelected('qm-role', 'attacker');
    if (role === 'random') role = (Math.random() < 0.5) ? 'attacker' : 'defender';
    // RAKIP AI: oturum ACILMADAN once kurulur (openBattlefieldSession beyin-bayraklarini okur)
    const beyin = quickMatchApplyBrain(qmSelected('qm-brain', 'intel4pro'));
    // Etiket KALICI bayrakta tutulur; telemetri her sifirlamada bunu yeniden okur.
    if (typeof BATTLE_RAKIP_BEYIN !== 'undefined') BATTLE_RAKIP_BEYIN = beyin.ad;
    // Kullanilan tohumu ekranda goster (rastgele ise de) — tekrar oynanabilirlik icin.
    setTimeout(() => {
        const t = (typeof BATTLE_SESSION !== 'undefined') ? BATTLE_SESSION.seed : null;
        if (t != null) console.log('[hizli mac] rakip beyin: ' + beyin.ad + '   TOHUM: ' + t);
    }, 0);
    if (beyin.uyari) alert('UYARI: ' + beyin.uyari + '\nMaç kod-AI ile oynanacak.');
    // TOHUM: bos birakilirsa motor Date.now() kullanir (her mac FARKLI ordu/harita). Dort AI'yi
    // "ayni birliklerle" kiyaslamak icin ayni tohum girilmelidir — kullanici istegi.
    const _tohumHam = document.getElementById('qm-seed')?.value;
    const _tohum = (_tohumHam !== undefined && _tohumHam !== null && String(_tohumHam).trim() !== '')
        ? (Number(_tohumHam) >>> 0) : null;
    openBattlefieldSession({
        mode: 'quick',
        mapId: -2,
        seed: _tohum != null && _tohum > 0 ? _tohum : undefined,
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
    // RAKIP AI buton grubu: tek secim (rol grubuyla ayni davranis)
    document.querySelectorAll('#qm-brain button').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('#qm-brain button').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
    }));
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
