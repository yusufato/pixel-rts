// ═══════════════════════════════════════════════════════════════════════════
//  OperationGrammar.v1 — kod-tabanlı taktik gramer (Faz 0/3c)
//  Durumdan 16–64 GEÇERLİ operasyon ADAYI üretir. Model bunları ÜRETMEZ, PUANLAR (§2.0).
//  Bir aday = zamana yayılan operasyon sözleşmesi: intent + mainSector + flankSector +
//  allocation(oranlar) + tempo + phases(fazlar) + abort + pursuitLimit.
//  Sektör modeli: 8×6 (WORLD_W×WORLD_H). Düşman gücü YALNIZ algılanan temaslardan (sis-güvenli).
//  Bağımsız/izole: canlı controller'a bağlı değil; ctx açıkça verilir → tek başına test edilir.
// ═══════════════════════════════════════════════════════════════════════════

const OPG_COLS = 8, OPG_ROWS = 6, OPG_SECTORS = OPG_COLS * OPG_ROWS;

function opgSectorOf(x, y) {
    const c = Math.max(0, Math.min(OPG_COLS - 1, Math.floor(x / WORLD_W * OPG_COLS)));
    const r = Math.max(0, Math.min(OPG_ROWS - 1, Math.floor(y / WORLD_H * OPG_ROWS)));
    return r * OPG_COLS + c;
}
function opgSectorCenter(i) {
    const c = i % OPG_COLS, r = (i / OPG_COLS) | 0;
    return { x: (c + 0.5) / OPG_COLS * WORLD_W, y: (r + 0.5) / OPG_ROWS * WORLD_H };
}
function opgSectorAdjacent(i) {
    const c = i % OPG_COLS, r = (i / OPG_COLS) | 0, out = [];
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc >= 0 && nc < OPG_COLS && nr >= 0 && nr < OPG_ROWS) out.push(nr * OPG_COLS + nc);
    }
    return out;
}
function _opgUnitPower(u) { return (u.atk || 0) * ((u.hp || 0) / Math.max(1, u.maxHp || 1)); }

// ── Bağlam: kendi birlikler (gerçek) + algılanan düşman temasları (sis-güvenli) → sektör özellikleri ──
// contacts: [{x, y, estimatedStrength, confidence}] — controller.lastObservation.contacts biçimi.
function opgBuildContext(side, ownUnits, contacts, role) {
    const own = new Float32Array(OPG_SECTORS), enemy = new Float32Array(OPG_SECTORS);
    let ownTotal = 0, homeR = side ? 0 : OPG_ROWS - 1;   // kırmızı(side=true) kuzey(r=0), mavi güney
    for (const u of ownUnits) { if (u.dead) continue; const s = opgSectorOf(u.x, u.y), p = _opgUnitPower(u); own[s] += p; ownTotal += p; }
    let enemyTotal = 0;
    for (const c of (contacts || [])) { if ((c.confidence ?? 1) < 0.15) continue; const s = opgSectorOf(c.x, c.y), p = c.estimatedStrength || 1; enemy[s] += p; enemyTotal += p; }
    // düşman ağırlık merkezi (mainSector adayları için)
    let ex = 0, ey = 0; for (const c of (contacts || [])) { const p = c.estimatedStrength || 1; ex += c.x * p; ey += c.y * p; }
    const enemyCoG = enemyTotal > 0 ? opgSectorOf(ex / enemyTotal, ey / enemyTotal) : null;
    const roleRaw = role || (typeof battleRoleForSide === 'function' ? battleRoleForSide(side) : null);
    const roleNorm = roleRaw ? String(roleRaw).toUpperCase() : 'ATTACKER';   // BATTLE_ROLE küçük harf olabilir → normalize
    // en zayıf / en güçlü DÜŞMAN sektörü (temas olan sektörler arasında)
    let weakest = null, strongest = null, wv = Infinity, sv = -1;
    for (let s = 0; s < OPG_SECTORS; s++) { if (enemy[s] <= 0) continue; if (enemy[s] < wv) { wv = enemy[s]; weakest = s; } if (enemy[s] > sv) { sv = enemy[s]; strongest = s; } }
    return { side, role: roleNorm,
        own, enemy, ownTotal, enemyTotal, enemyCoG, weakestEnemySector: weakest, strongestEnemySector: strongest, homeRow: homeR };
}

// ── Şema (versiyonlu makine sözleşmesi) ──────────────────────────────────────
const OPERATION_GRAMMAR_V1 = Object.freeze({
    version: 1,
    // FIRE_PREPARATION (2026-08-07): kod-AI bunu KULLANIYOR (kararlarin %3'u) ama aday sozlugunde
    // YOKTU -> davranis klonlamasi o kararlarda zorunlu olarak yanlis etiket uretiyordu (405 "zayif").
    // Karar uzayi darliginin en somut kaniti; eklenmesi bedava.
    intents: ['HOLD', 'ADVANCE', 'MAIN_ATTACK', 'FIX_AND_FLANK', 'COUNTERATTACK', 'REGROUP', 'DISENGAGE', 'FIRE_PREPARATION'],
    tempos: ['cautious', 'normal', 'aggressive'],
    groups: ['main', 'fixing', 'flank', 'reserve'],
    // rol kısıtı: hangi intent hangi rolde geçerli
    intentRoles: {
        HOLD: ['ATTACKER', 'DEFENDER'], ADVANCE: ['ATTACKER'], MAIN_ATTACK: ['ATTACKER', 'DEFENDER'],
        FIX_AND_FLANK: ['ATTACKER', 'DEFENDER'], COUNTERATTACK: ['DEFENDER'], REGROUP: ['ATTACKER', 'DEFENDER'], DISENGAGE: ['ATTACKER', 'DEFENDER'],
        FIRE_PREPARATION: ['ATTACKER', 'DEFENDER']
    },
    // intent → izinli faz dizisi (safha makinesi)
    phasesByIntent: {
        HOLD: ['HOLD'], ADVANCE: ['ADVANCE', 'ACTION'], REGROUP: ['REGROUP'], DISENGAGE: ['WITHDRAW'],
        MAIN_ATTACK: ['ASSEMBLE', 'FIRE_WINDOW', 'ASSAULT', 'EXPLOIT'],
        FIX_AND_FLANK: ['PROBE', 'FIX', 'FLANK', 'EXPLOIT'],
        COUNTERATTACK: ['ASSEMBLE', 'ASSAULT', 'EXPLOIT'],
        // ates hazirligi: kutleyi yaklastirmadan ONCE dolayli ateşle yumusat, sonra harekete gec
        FIRE_PREPARATION: ['ASSEMBLE', 'FIRE_WINDOW']
    },
    phaseTriggers: ['enemy_reserve_revealed', 'enemy_center_committed', 'rear_access', 'flank_failed', 'objective_taken', 'assembled', 'fire_effect_achieved', 'timeout'],
    abortConditions: ['flank_group_losses>35%', 'enemy_counterattack_on_main_objective', 'force_ratio<0.5', 'ammo<0.25', 'group_isolated',
        // v2: tempo'ya GERCEK sonuc — agresif kotu oranda da doguser, temkinli erken cekilir.
        'force_ratio<0.35', 'force_ratio<0.7', 'ammo<0.15', 'ammo<0.4'],
    allocationBounds: { main: [0.30, 0.70], fixing: [0.00, 0.35], flank: [0.00, 0.55], reserve: [0.10, 0.35] },
    // v2 GENIS SINIRLAR — ASIL DARLIK BURADAYDI. Eski kutu "her seyi ana eksene ver" (main>0.70) ve
    // "yedek tutma" (reserve<0.10) gibi secenekleri TANIM GEREGI yasakliyordu; uc onayar da zaten
    // bu kucuk kutunun icindeydi. Olculdu: allocation ekseni varyansin %34.4'unu tasiyor, yani
    // en cok is goren knob en dar kutuya hapsedilmis.
    allocationBoundsV2: { main: [0.20, 0.85], fixing: [0.00, 0.50], flank: [0.00, 0.60], reserve: [0.00, 0.40] },
    allocationSumTolerance: 0.001,
    maxPhases: 5,
    maxDurationTicks: 1200,        // 60 sn
    pursuitLimits: [150, 300, 500],
    sectors: OPG_SECTORS
});

// ── Doğrulayıcı: aday şemaya + duruma göre geçerli mi ────────────────────────
function operationGrammarValidate(c, ctx) {
    const G = OPERATION_GRAMMAR_V1, errs = [];
    if (!c || typeof c !== 'object') return { valid: false, errors: ['aday nesne değil'] };
    if (!G.intents.includes(c.intent)) errs.push('geçersiz intent: ' + c.intent);
    if (ctx && ctx.role && G.intentRoles[c.intent] && !G.intentRoles[c.intent].includes(ctx.role)) errs.push(c.intent + ' bu rolde (' + ctx.role + ') geçersiz');
    if (!G.tempos.includes(c.tempo)) errs.push('geçersiz tempo: ' + c.tempo);
    if (!Number.isInteger(c.mainSector) || c.mainSector < 0 || c.mainSector >= G.sectors) errs.push('mainSector aralık dışı');
    if (c.flankSector != null && (!Number.isInteger(c.flankSector) || c.flankSector < 0 || c.flankSector >= G.sectors)) errs.push('flankSector aralık dışı');
    if (!G.pursuitLimits.includes(c.pursuitLimit)) errs.push('geçersiz pursuitLimit');
    const a = c.allocation || {}; let sum = 0;
    for (const g of G.groups) { const v = a[g]; if (typeof v !== 'number' || v < 0) { errs.push('allocation.' + g + ' geçersiz'); continue; } const _v2b = ((typeof BATTLE_GRAMMAR_V2 !== 'undefined') && BATTLE_GRAMMAR_V2 && G.allocationBoundsV2) ? G.allocationBoundsV2 : G.allocationBounds;
        const [lo, hi] = _v2b[g]; if (v < lo - 1e-6 || v > hi + 1e-6) errs.push('allocation.' + g + '=' + v + ' [' + lo + ',' + hi + '] dışında'); sum += v; }
    if (Math.abs(sum - 1) > G.allocationSumTolerance) errs.push('allocation toplamı 1 değil: ' + sum.toFixed(3));
    const phases = c.phases || [];
    if (!phases.length || phases.length > G.maxPhases) errs.push('faz sayısı 1..' + G.maxPhases + ' değil: ' + phases.length);
    const allowed = G.phasesByIntent[c.intent] || [];
    for (const ph of phases) { if (!allowed.includes(ph.name)) errs.push('faz "' + (ph && ph.name) + '" ' + c.intent + ' için geçersiz'); if (ph.until && !ph.until.split(/\s+OR\s+/i).every(t => G.phaseTriggers.includes(t.trim()) || /^\d+t$/.test(t.trim()))) errs.push('geçersiz tetikleyici: ' + ph.until); }
    if (c.abort) for (const ab of c.abort) if (!G.abortConditions.includes(ab)) errs.push('geçersiz abort: ' + ab);
    if (c.maxDurationTicks != null && (c.maxDurationTicks <= 0 || c.maxDurationTicks > G.maxDurationTicks)) errs.push('maxDurationTicks aralık dışı');
    return { valid: errs.length === 0, errors: errs };
}

// ── Üreteç: durumdan 16–64 geçerli aday ──────────────────────────────────────
function _opgPhases(intent) { return (OPERATION_GRAMMAR_V1.phasesByIntent[intent] || ['HOLD']).map((name, i, arr) => ({ name, until: i < arr.length - 1 ? 'timeout' : 'objective_taken OR timeout' })); }
// ── GRAMER v2: KARAR UZAYINI GENISLET (varsayilan KAPALI, BATTLE_GRAMMAR_V2) ──
// OLCULDU (1641 karar, tools/beonai-* hatti): aday-ici odul varyansinin kaynagi
//   intent %43.3 (6 deger) · allocation %34.4 (YALNIZ 3 onayar) · mainSector %17.3 (karar basina 1-3)
//   · tempo %2.7 (3 deger) -> OLU
// Ve TAVAN olculdu: her karar noktasinda 64 adayi gercekten yuvarlayip en iyisini oynayan
// MUKEMMEL secici bile kod-AI'yi ancak +771 geciyor (t 1.80, anlamsiz). Yani sorun ogrenmede
// degil, secilecek sey azliginda. v2 dort seyi degistirir:
//   (1) tempo'ya GERCEK sonuc: yalniz pursuitLimit degil ABORT esikleri de degisir
//       (agresif kotu oranda da doguser, temkinli erken cekilir) — bu oturumda cekilme/durusun
//       maci degistirdigi olculmustu.
//   (2) allocation 3 -> 7 onayar: sürekli bir buyuklugun uc noktaya sikistirilmasi tavanı kirpiyordu.
//   (3) mainSector kaynaklari genisler: dusman CoG + en zayif/guclu + CoG komsulari + dusman gerisi.
//   (4) 64 kotasi ADIL dagitilir: eski kod ic ice dongude erken donuyordu ve SON intent'ler hic
//       aday uretemiyordu (kodun kendi yorumu da bunu soyluyordu). Artik intent'ler sirayla dolar.
const OPG_ALLOC_V2 = [
    { main: 0.55, fixing: 0.20, flank: 0.15, reserve: 0.10 },   // dengeli (v1)
    { main: 0.65, fixing: 0.15, flank: 0.05, reserve: 0.15 },   // ana-agir (v1)
    { main: 0.35, fixing: 0.25, flank: 0.30, reserve: 0.10 },   // kanat-agir (v1)
    { main: 0.85, fixing: 0.10, flank: 0.05, reserve: 0.00 },   // TEK-YUMRUK (yedek YOK — v1'de yasakti)
    { main: 0.30, fixing: 0.50, flank: 0.10, reserve: 0.10 },   // SABITLEME-agir (tut, kanattan bekle)
    { main: 0.40, fixing: 0.10, flank: 0.10, reserve: 0.40 },   // YEDEK-agir (gec taahhut — v1'de yasakti)
    { main: 0.20, fixing: 0.15, flank: 0.60, reserve: 0.05 },   // DERIN KANAT (v1'de yasakti)
];
const OPG_TEMPO_V2 = {
    aggressive: { pursuit: 500, abort: ['force_ratio<0.35', 'ammo<0.15'] },   // kotu oranda da doguser
    normal:     { pursuit: 300, abort: ['force_ratio<0.5', 'ammo<0.25'] },
    cautious:   { pursuit: 150, abort: ['force_ratio<0.7', 'ammo<0.4'] },     // erken cekilir
};

function operationGrammarGenerate(ctx) {
    const G = OPERATION_GRAMMAR_V1;
    const V2 = (typeof BATTLE_GRAMMAR_V2 !== 'undefined') && BATTLE_GRAMMAR_V2;
    const KOTA = (typeof BATTLE_GRAMMAR_KOTA !== 'undefined') ? BATTLE_GRAMMAR_KOTA : 64;
    const role = ctx.role || 'ATTACKER';
    // SIRA = adil kotada cekilis sirasi (asagida sirayla cekiliyor). FIRE_PREPARATION buraya da
    // yazilmaliydi: `G.intents`e eklemek TEK BASINA yetmiyor, uretec bu listeden geciyor.
    // Kod-AI bu plani kararlarinin %3'unde kullaniyordu ve aday listesinde karsiligi yoktu.
    const order = ['HOLD', 'REGROUP', 'DISENGAGE', 'FIRE_PREPARATION', 'COUNTERATTACK', 'ADVANCE', 'FIX_AND_FLANK', 'MAIN_ATTACK'];
    const intents = order.filter(k => G.intents.includes(k) && (!G.intentRoles[k] || G.intentRoles[k].includes(role)));

    let targets = [...new Set([ctx.enemyCoG, ctx.weakestEnemySector, ctx.strongestEnemySector].filter(s => s != null))];
    if (V2 && ctx.enemyCoG != null) {
        // (3) CoG komsulari + dusman gerisi -> sektor ekseni karar basina 1-3'ten cikar
        for (const k of opgSectorAdjacent(ctx.enemyCoG)) if (k != null) targets.push(k);
        const geriSatir = ctx.side ? OPG_ROWS - 1 : 0;
        const cogSut = ctx.enemyCoG % OPG_COLS;
        targets.push(geriSatir * OPG_COLS + cogSut);
    }
    targets = [...new Set(targets)];
    if (!targets.length) {
        const fwdRow = ctx.side ? OPG_ROWS - 2 : 1;
        for (let cc = 1; cc < OPG_COLS - 1; cc += 2) targets.push(fwdRow * OPG_COLS + cc);
    }
    const allocs = V2 ? OPG_ALLOC_V2 : [
        { main: 0.55, fixing: 0.20, flank: 0.15, reserve: 0.10 },
        { main: 0.65, fixing: 0.15, flank: 0.05, reserve: 0.15 },
        { main: 0.35, fixing: 0.25, flank: 0.30, reserve: 0.10 },
    ];

    // (4) ADIL KOTA: her intent icin kendi aday listesi kurulur, sonra SIRAYLA cekilir.
    const kovalar = [];
    for (const intent of intents) {
        const staticIntent = (intent === 'HOLD' || intent === 'REGROUP' || intent === 'DISENGAGE');
        const tgtList = staticIntent ? [targets[0] ?? 0] : targets;
        const allocList = staticIntent ? [{ main: 0.40, fixing: 0.20, flank: 0.10, reserve: 0.30 }] : allocs;
        const tempoList = staticIntent ? ['normal'] : G.tempos;
        // CESITLILIK-ONCE SIRALAMA: ic ice dongu once hedefi sabitleyip allocation'lari tuketiyordu,
        // bu yuzden 64'luk kota TEK hedefle doluyordu (olculdu: sektor cesidi 2 -> 1). Capraz carpim
        // "indis toplamina" gore siralanir: (0,0,0) sonra (0,0,1)/(0,1,0)/(1,0,0) ... boylece kotanin
        // ILK slotlari UC EKSENI birden tarar.
        // GERCEK CAPRAZ TARAMA. Onceki surum "indis toplamina" gore siraliyordu; bu DUSUK indisleri
        // kayiriyor ve 64'luk kota EN CESUR onayarlari (derin kanat, yedek-agir, sabitleme-agir)
        // tamamen kesiyordu — olculdu: bir onayar 27 adayla listeyi dolduruyor, uc onayar SIFIR
        // aday aliyordu. Yani "genis uzay" olcumu aslinda genis uzayi hic denememisti.
        // Dogrusu: her turda UC EKSENI birden bir adim ilerlet (r%T, r%A, r%P) -> ilk turlar tum
        // allocation'lari, tum hedefleri ve tum tempolari kapsar. Sonra kalan kombinasyonlar eklenir.
        const _kombin = []; const _gorK = new Set();
        const T = tgtList.length, A = allocList.length, P = tempoList.length;
        for (let r = 0; r < T * A * P; r++) {
            const it = r % T, ia = r % A, ip = r % P, kk = it + ':' + ia + ':' + ip;
            if (_gorK.has(kk)) continue; _gorK.add(kk);
            _kombin.push({ it, ia, ip });
        }
        for (let it = 0; it < T; it++) for (let ia = 0; ia < A; ia++) for (let ip = 0; ip < P; ip++) {
            const kk = it + ':' + ia + ':' + ip;
            if (_gorK.has(kk)) continue; _gorK.add(kk);
            _kombin.push({ it, ia, ip });
        }
        const kova = [], gorulen = new Set();
        for (const _c of _kombin) {
            const mainSector = tgtList[_c.it], alloc = allocList[_c.ia], tempo = tempoList[_c.ip];
            const flankSector = staticIntent ? null : (opgSectorAdjacent(mainSector).sort((a, b) => (ctx.enemy[a] || 0) - (ctx.enemy[b] || 0))[0] ?? null);
            // (1) tempo artik ABORT esiklerini de degistirir — yalniz takip mesafesini degil
            const tv = (V2 && OPG_TEMPO_V2[tempo]) ? OPG_TEMPO_V2[tempo] : null;
            const pursuitLimit = tv ? tv.pursuit : (tempo === 'aggressive' ? 500 : tempo === 'cautious' ? 150 : 300);
            const abort = tv ? tv.abort.slice() : ['force_ratio<0.5', 'ammo<0.25'];
            const cand = { intent, mainSector, flankSector, allocation: alloc, tempo, pursuitLimit,
                phases: _opgPhases(intent), abort, maxDurationTicks: G.maxDurationTicks };
            const key = intent + ':' + mainSector + ':' + flankSector + ':' + tempo + ':' + alloc.main + ':' + alloc.flank;
            if (gorulen.has(key)) continue; gorulen.add(key);
            if (operationGrammarValidate(cand, ctx).valid) kova.push(cand);
        }
        if (kova.length) kovalar.push(kova);
    }
    const out = [];
    for (let i = 0; out.length < KOTA; i++) {
        let eklendi = false;
        for (const kova of kovalar) {
            if (i >= kova.length) continue;
            out.push(kova[i]); eklendi = true;
            if (out.length >= KOTA) break;
        }
        if (!eklendi) break;
    }
    return out;
}

if (typeof module !== 'undefined') module.exports = { OPERATION_GRAMMAR_V1, opgSectorOf, opgSectorCenter, opgBuildContext, operationGrammarGenerate, operationGrammarValidate };
