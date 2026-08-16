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
    fog: true,
    // ZORLUK: sefer savaslarinda RAKIBIN beyni. 'easy' = intel3-pro (taban), 'hard' = intel4 (mezun).
    // Varsayilan 'hard' — Hizli Mac'in varsayilaniyla ayni, boylece iki mod ayni zorlugu vaat eder.
    difficulty: 'hard'
};
// FAZ-7: ARTIK CommanderTree.js/CMDR_TREE geçerli. Bu tablo yalnız eski kayıt
// göçü ve tarihsel referans için duruyor — UI onu kullanmıyor.
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
        // llm VARSAYILAN OLARAK KAPALI: model yalnız masaüstü sürümünde var, GPU'suz
        // makinede diyalog başına ~45 sn sürüyor ve 4.5 GB RAM tutuyor. Böyle bir
        // maliyeti kimseye sormadan yüklemek doğru değil — isteyen açar.
        return {
            crt: saved.crt !== false,
            // KUSUR 13: yoğunluk. Eski kayıtlarda alan yok → 100 (eski davranışın birebiri).
            crtAlpha: Number.isFinite(+saved.crtAlpha) ? Math.max(0, Math.min(100, +saved.crtAlpha)) : 100,
            volume: Number.isFinite(+saved.volume) ? Math.max(0, Math.min(100, +saved.volume)) : 70,
            llm: saved.llm === true,
        };
    } catch (_) {
        return { crt: true, crtAlpha: 100, volume: 70, llm: false };
    }
}

// ── KUSUR 13: CRT YOĞUNLUĞU (design-qa.md:36 · turun tek açık P3) ───────────
// "Canlı muharebe bazı arazi tohumlarında konsept çekimden parlak." İkili
// anahtar bunu çözemez; ya tam tarama ya hiç. Yoğunluk --wr-crt-alpha ile
// sürülür; ayar hem menüdeki panelden hem savaş içi duraklatma penceresinden
// değiştirilebilir, ikisi de AYNI tercihi yazar (iki ayrı ayar değil).
function warRoomApplyCrtAlpha(yuzde) {
    const v = Math.max(0, Math.min(100, Number.isFinite(+yuzde) ? +yuzde : 100));
    document.documentElement.style.setProperty('--wr-crt-alpha', String(v / 100));
    for (const id of ['wr-crt-alpha', 'battle-crt-alpha']) {
        const kaydirici = document.getElementById(id);
        if (kaydirici && +kaydirici.value !== v) kaydirici.value = String(v);
    }
    for (const id of ['wr-crt-alpha-value', 'battle-crt-alpha-value']) {
        const etiket = document.getElementById(id);
        if (etiket) etiket.value = `${v}%`;
    }
    return v;
}

function warRoomSavePrefs() {
    const crt = !!document.getElementById('wr-crt-toggle')?.checked;
    const crtAlpha = warRoomApplyCrtAlpha(document.getElementById('wr-crt-alpha')?.value ?? 100);
    const volume = +(document.getElementById('wr-volume')?.value || 70);
    const llm = !!document.getElementById('wr-llm-toggle')?.checked;
    try { localStorage.setItem(WAR_ROOM_UI_KEY, JSON.stringify({ crt, crtAlpha, volume, llm })); } catch (_) {}
    document.body.classList.toggle('wr-crt-off', !crt);
    warRoomApplyLLM(llm);
}

// ── YAPAY ANLATICI ANAHTARI ────────────────────────────────────────────────
// Anahtar LLM.enabled'ı sürer. Açıldığında llmProbe() modeli TEMBEL yükler; bu
// birkaç saniye sürdüğü için not satırı durumu canlı gösterir, yoksa kullanıcı
// açar ve hiçbir şey olmuyor sanır.
function warRoomApplyLLM(on) {
    if (typeof LLM === 'undefined') return;
    LLM.enabled = !!on;
    const note = document.getElementById('wr-llm-note');
    const bridge = (typeof window !== 'undefined' && window.PIXEL && window.PIXEL.llm) ? window.PIXEL.llm : null;
    if (!note) return;
    if (!on) { note.textContent = 'Kapalı — komutan sohbetleri hazır metinlerden yazılıyor.'; return; }
    if (!bridge) { note.textContent = 'Tarayıcı sürümünde yapay anlatıcı yok; masaüstü sürümü gerekir. Hazır metinler kullanılıyor.'; return; }
    note.textContent = 'Model yükleniyor…';
    // BELLEK DÜZELTMESİ: yükleme artık YALNIZ buradan (kullanıcı anlatıcıyı açınca) ya da
    // ilk metin üretiminden tetiklenir. llmProbe() salt bilgi verir, model yüklemez.
    const _yukle = (typeof llmEnsure === 'function') ? llmEnsure : llmProbe;
    if (typeof _yukle === 'function') {
        Promise.resolve(_yukle()).then(() => {
            if (!LLM.enabled) return;                   // arada kapatılmış olabilir
            note.textContent = LLM.ready
                ? 'Açık — sohbetleri ' + (LLM.model || 'yerel model') + ' yazıyor.'
                : 'Model bulunamadı' + (LLM.error ? ' (' + LLM.error + ')' : '') + '; hazır metinler kullanılıyor.';
        });
    }
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
    WAR_ROOM_SETUP.difficulty = 'hard';
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
    const cfg = {
        playerStateId: WAR_ROOM_SETUP.stateId,
        abundance: WAR_ROOM_SETUP.abundance,
        doctrine: WAR_ROOM_SETUP.doctrine,
        fog: WAR_ROOM_SETUP.fog,
        difficulty: WAR_ROOM_SETUP.difficulty
    };
    // AŞAMA 1: kurulumdan sonra KARAKTER EKRANI araya girer (isim + zar + 12 soru).
    // Karakter ekranı yoksa (eski test yolu) doğrudan kampanya başlar.
    if (typeof charOpen === 'function') { charOpen(cfg); return; }
    storyNewCampaign(cfg);
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
            <span class="deploy-unit-sprite" style="background-position:${row.type * (100/24)}% 0%"></span>
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
    battleGroupsReset();          // KUSUR 4: yeni maça eski gruplarla girilmez
    WAR_ROOM_BATTLE_FEED.length = 0;
    warRoomUpdateBattle._counts = null;
    warRoomBattleEvent('MUHAREBE AĞI HAZIR');
}

function warRoomIssueOrder(order) {
    if (typeof units === 'undefined') return;
    const own = units.filter(unit => !unit.dead && !unit.isRed);
    const selected = own.filter(unit => unit.selected);
    const force = selected.length ? selected : own;
    if (!force.length) { warRoomBattleEvent('EMİR REDDEDİLDİ — DOST BİRLİK YOK', 'hostile'); return; }
    if (order === 'assault') {
        const foes = units.filter(unit => !unit.dead && unit.isRed);
        const tx = foes.length ? foes.reduce((sum, unit) => sum + unit.x, 0) / foes.length : (typeof WORLD_W !== 'undefined' ? WORLD_W * .8 : 2400);
        const ty = foes.length ? foes.reduce((sum, unit) => sum + unit.y, 0) / foes.length : (typeof WORLD_H !== 'undefined' ? WORLD_H * .5 : 900);
        const hasSchwerpunkt = typeof STORY !== 'undefined' && STORY.active && (STORY.commander.activePerks || []).includes('schwerpunkt');
        // schwerpunkt XP buff'ı hash-dışı ve tik-duyarsız → hemen uygula; hareket komutu ise tik-sınırı kuyruğuna.
        if (hasSchwerpunkt) force.forEach(unit => { if (!unit._schwerpunktApplied) { unit.xpBonus *= 1.10; unit._schwerpunktApplied = true; } });
        const safe = typeof terrainSafePoint === 'function' ? terrainSafePoint(tx, ty) : { x: tx, y: ty };
        const destinations = force.map(unit => ({ id: unit.id, x: Math.round(safe.x * 100) / 100, y: Math.round(safe.y * 100) / 100 }));
        if (typeof pendingPlayerCommands !== 'undefined') pendingPlayerCommands.push({ type: 'player-move', payload: { destinations } });
        warRoomBattleEvent(`TAARRUZ EMRİ — ${force.length} BİRLİK`, 'friendly');
    } else if (order === 'free-fire') {
        if (typeof pendingPlayerCommands !== 'undefined') pendingPlayerCommands.push({ type: 'player-free-fire', payload: { unitIds: force.map(unit => unit.id) } });
        warRoomBattleEvent(`ATEŞ SERBEST — ${force.length} BİRLİK`, 'friendly');
    } else if (order === 'trench') {
        document.getElementById('btn-trench')?.click();
        warRoomBattleEvent('ÜS KUR EMRİ AKTİF', 'info');
    } else if (order === 'paradrop') {
        document.getElementById('btn-paradrop')?.click();
        warRoomBattleEvent('PARAŞÜT HEDEFLEME AKTİF', 'info');
    }
}

/* ── KUSUR 4: KONTROL GRUPLARI ──────────────────────────────────────────────
   Ctrl+1..9 seçili birlikleri gruba atar, 1..9 grubu geri çağırır.

   DETERMİNİZM: `unit.selected` tamamen yerel bir arayüz durumudur — emirler
   `pendingPlayerCommands`e birim id'siyle giriyor (bkz. warRoomIssueOrder),
   seçim simülasyona hiç girmiyor. Bu yüzden gruplar replay'i ve hash'i
   etkilemez; ağ üzerinden de gönderilmez.

   Ölü birim id'leri çağırma anında elenir, ama gruptan SİLİNMEZ: aynı grup
   takviye sonrası yeniden atanmadan da anlamını korusun diye değil — id'ler
   benzersiz olduğu için ölü id bir daha eşleşmez; temizlik yalnız gösterim
   sayısını doğru tutar. */
const BATTLE_CONTROL_GROUPS = Object.create(null);

function battleGroupAssign(n) {
    if (typeof units === 'undefined') return 0;
    const ids = units.filter(u => !u.dead && !u.isRed && u.selected &&
        (typeof playerCanControlBattleUnit !== 'function' || playerCanControlBattleUnit(u)))
        .map(u => u.id);
    if (!ids.length) { delete BATTLE_CONTROL_GROUPS[n]; return 0; }
    BATTLE_CONTROL_GROUPS[n] = ids;
    if (typeof warRoomBattleEvent === 'function') warRoomBattleEvent(`GRUP ${n} — ${ids.length} BİRLİK`, 'info');
    return ids.length;
}

function battleGroupRecall(n) {
    if (typeof units === 'undefined') return 0;
    const ids = BATTLE_CONTROL_GROUPS[n];
    if (!ids || !ids.length) return 0;
    const küme = new Set(ids);
    let sayi = 0;
    units.forEach(u => {
        const uygun = !u.dead && !u.isRed && küme.has(u.id);
        u.selected = uygun;
        if (uygun) sayi++;
    });
    if (!sayi && typeof warRoomBattleEvent === 'function') warRoomBattleEvent(`GRUP ${n} — BİRLİK KALMADI`, 'hostile');
    return sayi;
}

function battleGroupsReset() {
    Object.keys(BATTLE_CONTROL_GROUPS).forEach(k => delete BATTLE_CONTROL_GROUPS[k]);
}

function warRoomUpdateGroups() {
    const kutu = document.getElementById('battle-groups');
    if (!kutu) return;
    if (!kutu.children.length) {
        for (let n = 1; n <= 9; n++) {
            const s = document.createElement('span');
            s.setAttribute('data-g', String(n));
            s.innerHTML = `<b>${n}</b><i></i>`;
            kutu.appendChild(s);
        }
    }
    let imza = '';
    for (let n = 1; n <= 9; n++) {
        const ids = BATTLE_CONTROL_GROUPS[n];
        let canli = 0;
        if (ids && typeof units !== 'undefined') {
            const küme = new Set(ids);
            canli = units.reduce((t, u) => t + ((!u.dead && küme.has(u.id)) ? 1 : 0), 0);
        }
        imza += canli + ',';
    }
    if (kutu._grpImza === imza) return;
    kutu._grpImza = imza;
    const parcalar = imza.split(',');
    for (let n = 1; n <= 9; n++) {
        const el = kutu.children[n - 1];
        const canli = Number(parcalar[n - 1]) || 0;
        el.querySelector('i').textContent = canli ? String(canli) : '';
        el.setAttribute('data-dolu', canli ? '1' : '0');
        el.setAttribute('title', canli ? `Grup ${n}: ${canli} birlik (${n} tuşu çağırır)`
                                       : `Grup ${n} boş (Ctrl+${n} ile ata)`);
    }
}

/* ── KUSUR 2: EMİR BUTONLARINDA DURUM ───────────────────────────────────────
   Ölçülen arıza: PARAŞÜT butonu bekleme süresi dolmamışsa veya bütçe yetmiyorsa
   `js/main.js:348`'de sessizce `return` ediyordu. Buton tıklanıyor, hiçbir şey
   olmuyor, hiçbir yerde sebep yazmıyor — oyuncu arayüzü bozuk sanıyor. Bekleme
   göstergesi (`#cd-paradrop`) vardı ama `#ui-support` savaşta gizli olduğu için
   (style.css:1919) hiç görünmüyordu.

   Artık her emir butonu ne yapacağını ve neden yapamayacağını kendisi yazıyor.
   TAARRUZ/ATEŞ SERBEST'te "kaç birlik" gösterilir: seçim yoksa emir TÜM orduya
   gider (warRoomIssueOrder: `selected.length ? selected : own`) — bu, oyuncunun
   çoğu zaman fark etmediği bir davranış.

   Her karede çağrılır; bu yüzden imza karşılaştırmasıyla gereksiz DOM yazması
   engellenir (aynı hata sınıfı kusur 1'de ölçülmüştü). */
function warRoomUpdateOrderStates(blue) {
    const kutu = document.getElementById('battle-orders');
    if (!kutu) return;
    const secili = blue.filter(u => u.selected).length;
    const hedefAdet = secili || blue.length;
    const para = (typeof player !== 'undefined' && player) ? Math.floor(player.money || 0) : 0;
    const pdCd = (typeof supportCooldowns !== 'undefined') ? Math.ceil(supportCooldowns.paradrop || 0) : 0;
    const pdMax = (typeof MAX_CD_PARADROP !== 'undefined') ? MAX_CD_PARADROP : 30;
    const pdUcret = (typeof PARADROP_COST !== 'undefined') ? PARADROP_COST : 150;

    const durum = (emir) => {
        if (emir === 'paradrop') {
            if (pdCd > 0) return { metin: `BEKLEME ${pdCd}s`, hal: 'wait', dolum: pdCd / pdMax };
            if (para < pdUcret) return { metin: `${pdUcret}₺ GEREK · ${para}₺ VAR`, hal: 'poor', dolum: 0 };
            return { metin: `HAZIR · ${pdUcret}₺`, hal: 'ready', dolum: 0 };
        }
        if (emir === 'trench') return { metin: 'HAZIR', hal: 'ready', dolum: 0 };
        // taarruz / ateş serbest
        if (!blue.length) return { metin: 'DOST BİRLİK YOK', hal: 'poor', dolum: 0 };
        return { metin: secili ? `${hedefAdet} SEÇİLİ BİRLİK` : `TÜM ORDU · ${hedefAdet} BİRLİK`,
                 hal: 'ready', dolum: 0 };
    };

    kutu.querySelectorAll('button[data-battle-order]').forEach(btn => {
        const d = durum(btn.getAttribute('data-battle-order'));
        const imza = d.hal + '|' + d.metin + '|' + Math.round(d.dolum * 100);
        if (btn._ordImza === imza) return;          // değişmediyse DOM'a dokunma
        btn._ordImza = imza;
        const em = btn.querySelector('em');
        if (em) em.textContent = d.metin;
        const i = btn.querySelector('i');
        if (i) i.style.width = d.dolum > 0 ? `${Math.min(100, d.dolum * 100)}%` : '0';
        btn.setAttribute('data-ord', d.hal);
        // Erişilebilirlik: durum yalnız renkle değil metinle de anlatılır.
        const b = btn.querySelector('b');
        btn.setAttribute('aria-label', `${b ? b.textContent : ''} — ${d.metin}`);
        btn.setAttribute('aria-disabled', d.hal === 'ready' ? 'false' : 'true');
    });
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

    const battle = SIM.battle || null;
    const blueWill = Math.max(0, Math.min(100, battle?.blue?.will ?? 100));
    const redWill = Math.max(0, Math.min(100, battle?.red?.will ?? 100));
    const blueBar = document.getElementById('battle-vp-blue');
    const redBar = document.getElementById('battle-vp-red');
    if (blueBar) blueBar.style.width = `${blueWill * 0.5}%`;
    if (redBar) redBar.style.width = `${redWill * 0.5}%`;
    const blueValue = document.getElementById('battle-vp-blue-value');
    const redValue = document.getElementById('battle-vp-red-value');
    if (blueValue) blueValue.textContent = `MAVİ İRADE %${blueWill}`;
    if (redValue) redValue.textContent = `KIRMIZI İRADE %${redWill}`;
    const remaining = Math.max(0, Math.ceil(battle?.remainingSec || 0));
    const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    const sectorCount = document.getElementById('battle-vp-sector-count');
    if (sectorCount) sectorCount.textContent = clock;
    const timeLabel = document.getElementById('battle-time-label');
    if (timeLabel) timeLabel.textContent = clock;
    const roleLabel = document.getElementById('battle-role-label');
    if (roleLabel && battle) roleLabel.textContent = battle.attackerSide ? 'KIRMIZI SALDIRIYOR' : 'MAVİ SALDIRIYOR';

    warRoomUpdateOrderStates(blue);
    warRoomUpdateGroups();

    /* ── KUSUR 1 (açık yarısı): ÇOKLU SEÇİM DURUMU ──────────────────────────
       Kart `units.find(...)` ile yalnız İLK seçili birimi gösteriyordu: kontrol
       grupları (Ctrl+1..9) tam da çok birim seçmek için varken 12 birlik seçen
       oyuncu tek birimin kartını görüyordu.

       Bilgi AYRI bir şeride değil bu karta kondu: kart zaten `aria-live`
       taşıyor (index.html) ve "ne seçili" sorusunun tek yüzeyi o. İkinci bir
       panel aynı bilgiyi iki yerde gösterirdi — kusur 20'de sökülen desen.

       Toplamlar SEÇİLEREK alındı, körlemesine toplanmadı: menzil ve hız
       birliğin EN KISITLAYICI üyesine göre anlamlı (grup en yavaşı kadar hızlı,
       en kısa menzillisi kadar yakın durmalı), o yüzden onlar minimum. */
    const secililer = units.filter(unit => unit.selected && !unit.dead);
    const coklu = secililer.length > 1;
    const selected = secililer[0] || null;
    const stat = selected ? STATS[selected.type] : null;
    const friendly = !!(selected && !selected.isRed);
    const contact = document.getElementById('battle-target-card');
    contact?.classList.toggle('hostile', coklu ? secililer.some(u => u.isRed) : (!!selected && !friendly));
    contact?.classList.toggle('coklu', coklu);
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
        sprite.style.backgroundPosition = selected ? `${selected.type * (100 / 24)}% ${selected.isRed ? '100%' : '0%'}` : '0% 0%';
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
    if (coklu) warRoomRenderMultiSelect(secililer);
    const feed = document.getElementById('battle-feed-list');
    if (feed) feed.innerHTML = WAR_ROOM_BATTLE_FEED.map(item => `<div class="${item.tone}"><time>${item.time}</time><span>${item.message}</span></div>`).join('');
}

/* Çoklu seçim kartı. Tek-birim yolundaki yazmaların ÜSTÜNE geçer; ayrı bir
   render hattı açılmadı ki kartın iki hâli birbirinden ayrı bakıma muhtaç
   olmasın. Yalnız okuma yapar, hiçbir sim alanına dokunmaz. */
function warRoomRenderMultiSelect(liste) {
    const yaz = (id, metin) => { const el = document.getElementById(id); if (el) el.textContent = metin; };
    const topla = (f) => liste.reduce((a, u) => a + (f(u) || 0), 0);

    const hp = topla(u => u.hp), maxHp = topla(u => u.maxHp);
    const ammo = topla(u => u.ammo), maxAmmo = topla(u => u.maxAmmo || 0);
    const temas = liste.filter(u => u.attackTarget).length;
    const panik = liste.filter(u => u.isPanicking).length;
    const kuru = liste.filter(u => (u.maxAmmo || 0) > 0 && u.ammo <= 0).length;

    // kompozisyon: tür sayıları, çoktan aza
    const sayim = new Map();
    for (const u of liste) sayim.set(u.type, (sayim.get(u.type) || 0) + 1);
    const sirali = [...sayim.entries()].sort((a, b) => b[1] - a[1]);
    const ad = t => (STATS[t] && STATS[t].name ? STATS[t].name.toUpperCase() : 'BİRİM');
    const kompozisyon = sirali.slice(0, 3).map(([t, n]) => `${n} ${ad(t)}`).join(' · ') +
        (sirali.length > 3 ? ` · +${sirali.length - 3} TÜR` : '');

    yaz('battle-contact-label', 'GRUP KOMUTA');
    yaz('battle-contact-state', temas ? `${temas}/${liste.length} TEMAS` : 'TRACK');
    yaz('battle-target-name', `${liste.length} BİRLİK SEÇİLİ`);
    yaz('battle-target-role', kompozisyon || 'SAHA BİRLİĞİ');

    const sprite = document.getElementById('battle-target-sprite');
    if (sprite && sirali.length) {
        const bas = sirali[0][0];
        sprite.style.backgroundPosition = `${bas * (100 / 24)}% ${liste[0].isRed ? '100%' : '0%'}`;
        sprite.style.opacity = '1';
    }

    const oran = (a, b) => Math.max(0, Math.min(100, b > 0 ? (a / b) * 100 : 0));
    const hullBar = document.getElementById('battle-hull-bar');
    const ammoBar = document.getElementById('battle-ammo-bar');
    if (hullBar) hullBar.style.width = `${oran(hp, maxHp)}%`;
    if (ammoBar) ammoBar.style.width = `${oran(ammo, maxAmmo)}%`;
    yaz('battle-hull-value', `${Math.ceil(hp)}/${Math.round(maxHp)}`);
    yaz('battle-ammo-value', maxAmmo > 0 ? `${Math.round(ammo)}/${Math.round(maxAmmo)}` : '—');

    // ATK toplanır (birlikte ateş ederler); RNG ve HIZ MİNİMUM alınır — grup en
    // kısa menzillisi kadar yaklaşmak, en yavaşı kadar yavaş gitmek zorunda.
    const enAz = (f) => liste.reduce((m, u) => Math.min(m, f(u)), Infinity);
    const zirhOrt = topla(u => u.armor) / liste.length;
    const stats = document.getElementById('battle-target-stats');
    if (stats) {
        stats.innerHTML =
            `<span>ATK<b>${Math.round(topla(u => u.atk))}</b></span>` +
            `<span>EN KISA RNG<b>${Math.round(enAz(u => u.range))}</b></span>` +
            `<span>ORT ZIRH<b>${zirhOrt.toFixed(1)}</b></span>` +
            `<span>EN YAVAŞ<b>${enAz(u => u.speed).toFixed(2)}</b></span>`;
    }

    const uyari = [];
    if (panik) uyari.push(`${panik} PANİK`);
    if (kuru) uyari.push(`${kuru} MÜHİMMAT BİTTİ`);
    yaz('battle-target-matchup', uyari.length
        ? '⚠ ' + uyari.join(' · ')
        : `${liste.length} birlik tek emirle hareket eder.`);
}

/* ── KUSUR 3: EMİR GERİ BİLDİRİMİ ────────────────────────────────────────────
   Sağ tık sonrası hiçbir onay yoktu: birim uzaksa veya yol kapalıysa oyuncu
   emrin kaydedilip kaydedilmediğini anlayamıyordu. Hedef noktada 420 ms işaret:
   hareket = büzülen daire, taarruz = kırmızı çapraz, bindirme = kare.

   DETERMİNİZM: bu dizi YALNIZCA çizimde okunur; sim hiçbir yerde ona bakmaz ve
   zamanlaması `performance.now()`, sim tikine bağlı değil. Yani canlı↔replay
   hash'ini etkileyemez — bu dosyadaki emir yolunun kendisi (pendingPlayerCommands)
   bilerek tik sınırına ertelenmiş durumda, işaret ona hiç karışmıyor. */
const WAR_ROOM_ORDER_MARKS = [];
const WAR_ROOM_ORDER_MARK_MS = 420;

function warRoomMarkOrder(x, y, kind, bilgi) {
    if (typeof performance === 'undefined') return;
    WAR_ROOM_ORDER_MARKS.push({ x: x, y: y, kind: kind || 'move', t: performance.now() });
    // sınırsız büyümeyi engelle: süresi dolanlar zaten çizimde eleniyor, bu yalnız tavan
    if (WAR_ROOM_ORDER_MARKS.length > 24) WAR_ROOM_ORDER_MARKS.splice(0, WAR_ROOM_ORDER_MARKS.length - 24);
    warRoomEchoOrder(kind, bilgi);
}

/* Görsel işaretin metin karşılığı. Hedef kartına yazılır çünkü kart zaten
   `aria-live="polite"` taşıyor (index.html) → emir ekran okuyucuya da duyurulur.
   Satır index.html'de DEĞİL burada üretiliyor: o dosyaya dokunmadan eklenebiliyor
   ve kart HTML'i değişse bile bu kod kırılmıyor. */
function warRoomEchoOrder(kind, bilgi) {
    const card = document.getElementById('battle-target-card');
    if (!card) return;
    let satir = document.getElementById('battle-order-echo');
    if (!satir) {
        satir = document.createElement('div');
        satir.id = 'battle-order-echo';
        card.appendChild(satir);
    }
    const ad = kind === 'attack' ? 'TAARRUZ' : (kind === 'load' ? 'BİNDİR' : 'HAREKET');
    satir.textContent = 'EMİR ALINDI · ' + ad + (bilgi ? ' → ' + bilgi : '');
    satir.setAttribute('data-kind', kind || 'move');
    satir.classList.remove('yeni');
    void satir.offsetWidth;          // animasyonu her emirde yeniden tetikle
    satir.classList.add('yeni');
}

function warRoomDrawOrderMarks(context) {
    if (!WAR_ROOM_ORDER_MARKS.length || typeof worldToScreen !== 'function') return;
    const now = performance.now();
    context.save();
    for (let i = WAR_ROOM_ORDER_MARKS.length - 1; i >= 0; i--) {
        const m = WAR_ROOM_ORDER_MARKS[i];
        const yas = (now - m.t) / WAR_ROOM_ORDER_MARK_MS;
        if (yas >= 1) { WAR_ROOM_ORDER_MARKS.splice(i, 1); continue; }
        const p = worldToScreen(m.x, m.y);
        const solma = 1 - yas;
        context.globalAlpha = solma;
        context.lineWidth = 2;
        if (m.kind === 'attack') {
            const r = 7 + 13 * yas;
            context.strokeStyle = '#ff6b6b';
            context.beginPath();
            context.moveTo(p.x - r, p.y - r); context.lineTo(p.x + r, p.y + r);
            context.moveTo(p.x + r, p.y - r); context.lineTo(p.x - r, p.y + r);
            context.stroke();
        } else if (m.kind === 'load') {
            const r = 6 + 10 * yas;
            context.strokeStyle = '#8ecbff';
            context.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
        } else {
            const r = 20 - 13 * yas;   // büzülerek hedefe "oturur"
            context.strokeStyle = '#4ade80';
            context.beginPath(); context.arc(p.x, p.y, Math.max(2, r), 0, Math.PI * 2); context.stroke();
        }
    }
    context.restore();
}

function warRoomDrawBattleAxis(context) {
    if (typeof phase === 'undefined' || typeof PHASE === 'undefined' || phase !== PHASE.BATTLE || typeof units === 'undefined') return;
    const force = units.filter(unit => unit.selected && !unit.dead && !unit.isRed);
    if (!force.length) return;
    const lead = force[0];
    const target = lead.manualMoveTarget || lead.manualTarget || lead.attackTarget;
    if (!target || typeof worldToScreen !== 'function') return;
    const cx = force.reduce((sum, unit) => sum + unit.x, 0) / force.length;
    const cy = force.reduce((sum, unit) => sum + unit.y, 0) / force.length;
    const from = worldToScreen(cx, cy), to = worldToScreen(target.x, target.y);
    // KALDIRILDI (kullanici istegi 2026-08-09): turuncu "SCHWERPUNKT" ekseni.
    // Cizgi birimden DEGIL kuvvetin KUTLE MERKEZINDEN cikiyordu; bu yuzden hedefi yanlis
    // gosteriyor ve "birimler imlecin sol-ustune gidiyor" izlenimi veriyordu. Yerini,
    // emirle AYNI matematigi kullanan formasyon onizlemesi aldi (main.js formationOffsets).
    // Bayrakla geri acilabilir; varsayilan KAPALI.
    if (typeof BATTLE_SCHWERPUNKT_EKSENI === 'undefined' || !BATTLE_SCHWERPUNKT_EKSENI) return;
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
    if (summary) {
        const actorId = `character:${STORY.playerStateId | 0}:${commander.id}`;
        const origin = typeof storyCharacterCreationSummary === 'function'
            ? storyCharacterCreationSummary(actorId) : null;
        const originHtml = origin
            ? `<div title="${origin.factCount} kanonik geçmiş olgusu · ${origin.beliefCount} kaynaklı aktör inancı"><span>GEÇMİŞ İZİ</span><b>${origin.decisionCount} KARAR</b></div>`
            : '';
        summary.innerHTML = `<div><span>SEFER SKORU</span><b>${commander.score}</b></div><div><span>ZAFER</span><b>${commander.victories}</b></div><div><span>VETERAN</span><b>${(STORY.veterans || []).length}</b></div><div><span>AKTİF KAYNAK</span><b>${Math.floor(commander.res.oil + commander.res.manpower + commander.res.points)}</b></div>${originHtml}`;
    }

    // FAZ-7: 3-slotlu perk ızgarası yerine KOMUTAN GELİŞİM AĞACI (CommanderTree.js)
    const slotCount = document.getElementById('commander-slot-count');
    if (slotCount) slotCount.textContent = (typeof cmdrFreeLP === 'function')
        ? `LİYAKAT ${cmdrFreeLP(commander)}` : '';
    const grid = document.getElementById('commander-perk-grid');
    if (grid && typeof cmdrTreeHtml === 'function') grid.innerHTML = cmdrTreeHtml();
}

function warRoomOpenCommander() {
    if (typeof STORY === 'undefined' || !STORY.active) return;
    showScreen('commander');
    warRoomRenderCommander();
}

// FAZ-7: perkler ağaca eritildi — aç/kapa yok, LİYAKAT ile kalıcı açılıyor.
// Eski çağrı yolu korunur (dış bir yerden çağrılırsa ağaç açma denemesine döner).
function warRoomTogglePerk(perkId) {
    if (typeof cmdrUnlock === 'function') cmdrUnlock(perkId);
}

function warRoomInit() {
    if (warRoomInit._bound) return;
    warRoomInit._bound = true;

    const prefs = warRoomLoadPrefs();
    const crt = document.getElementById('wr-crt-toggle');
    const volume = document.getElementById('wr-volume');
    const volumeValue = document.getElementById('wr-volume-value');
    const llmToggle = document.getElementById('wr-llm-toggle');
    if (crt) crt.checked = prefs.crt;
    if (volume) volume.value = prefs.volume;
    if (volumeValue) volumeValue.value = `${prefs.volume}%`;
    if (llmToggle) llmToggle.checked = prefs.llm;
    warRoomApplyCrtAlpha(prefs.crtAlpha);
    document.body.classList.toggle('wr-crt-off', !prefs.crt);
    warRoomApplyLLM(prefs.llm);

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
    document.getElementById('wr-crt-alpha')?.addEventListener('input', warRoomSavePrefs);
    llmToggle?.addEventListener('change', warRoomSavePrefs);
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
