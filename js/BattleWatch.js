// ═══════════════════════════════════════════════════════════════
//  MAÇ İZLEME — kaydı "kare-kare" 3.şahıs taktik-özete çevirir → koç (14B) okur, analiz eder.
//  Koça HAM JSON değil, ANLAMLI özet gider (garbage-in/out'u önler). Deterministik.
// ═══════════════════════════════════════════════════════════════
// STATS menzil aynası (+%25 uygulandı — globals.js UNIT_RANGE_MULTIPLIER=1.25 ile senkron; node bağlamı STATS okumaz)
const BW_RANGE = { 0: 138, 1: 163, 2: 138, 3: 163, 4: 100, 5: 113, 6: 344, 7: 400, 8: 438 };
const BW_TYPE = { 0: 'Piyade', 1: 'Mekanize', 2: 'ZırhlıPiyade', 3: 'Keşif', 4: 'İstihkam', 5: 'Sağlıkçı', 6: 'Tank', 7: 'Tanksavar', 8: 'Topçu' };

function bwComp(units) {
    const c = {};
    for (const u of units) { const n = BW_TYPE[u.type] || ('tip' + u.type); c[n] = (c[n] || 0) + 1; }
    return Object.entries(c).map(([k, v]) => v + ' ' + k).join(', ');
}
function bwCentroid(units) {
    let x = 0, y = 0; for (const u of units) { x += u.x; y += u.y; } const n = units.length || 1;
    return { x: x / n, y: y / n };
}
function bwSpread(units, c) {
    let s = 0; for (const u of units) s += Math.hypot(u.x - c.x, u.y - c.y); return Math.round(s / (units.length || 1));
}

// Maçı ~12 kareye böl, her kareyi taktik olarak betimle + genel istatistik + otomatik-teşhis.
function battleMatchDigest(recording) {
    const rep = recording.replay || recording;
    const t = rep.telemetry || {};
    const s = t.samples || [];
    if (!s.length) return 'KAYIT BOŞ (sample yok).';
    const cd = t.controllerDecisions || [];
    const ce = t.combatEvents || [];
    const f0 = s[0], last = s[s.length - 1];
    const aiDec = cd.find(d => d.side === 'red' && d.situation);
    const aiRole = (aiDec && aiDec.situation && aiDec.situation.role) || '?';

    const L = [];
    L.push('═══ MAÇ KAYDI (AI = KIRMIZI, rol: ' + aiRole + ') ═══');
    L.push('Başlangıç: KIRMIZI(AI) = ' + bwComp(f0.units.filter(u => u.side === 'red')));
    L.push('           MAVİ(insan) = ' + bwComp(f0.units.filter(u => u.side === 'blue')));
    L.push('Süre: ' + last.seconds + 'sn | Bitiş: KIRMIZI ' + last.units.filter(u => u.side === 'red').length +
        ' kaldı, MAVİ ' + last.units.filter(u => u.side === 'blue').length + ' kaldı | Kazanan: ' +
        (last.battle && last.battle.winnerSide === true ? 'KIRMIZI(AI)' : last.battle && last.battle.winnerSide === false ? 'MAVİ(insan)' : '?'));
    L.push('');
    L.push('── KARE-KARE (her ~' + Math.round((last.seconds) / 12) + 'sn) ──');
    const step = Math.max(1, Math.ceil(s.length / 12));
    let prevCE = 0;
    for (let i = 0; i < s.length; i += step) {
        const smp = s[i];
        const reds = smp.units.filter(u => u.side === 'red'), blues = smp.units.filter(u => u.side === 'blue');
        if (!reds.length || !blues.length) { L.push('t=' + smp.seconds + 's: bir taraf yok edildi.'); break; }
        const rc = bwCentroid(reds), bc = bwCentroid(blues);
        const dist = Math.round(Math.hypot(rc.x - bc.x, rc.y - bc.y));
        // ateş eden kırmızı + focus (en çok yüklenen tek hedefe kaç birim)
        const firing = reds.filter(u => u.attackTargetId);
        const byT = {}; for (const u of firing) byT[u.attackTargetId] = (byT[u.attackTargetId] || 0) + 1;
        const maxFocus = Object.values(byT).length ? Math.max(...Object.values(byT)) : 0;
        const blocked = reds.filter(u => u.combatState === 'Hat Kapalı').length;
        const fleeing = reds.filter(u => u.combatState === 'FLEE' || u.fleeing).length;
        // bu aralıkta ölen kırmızı/mavi (combatEvents lethal)
        let rDead = 0, bDead = 0;
        while (prevCE < ce.length && ce[prevCE].seconds <= smp.seconds) { const e = ce[prevCE]; if (e.lethal) { if (e.targetSide === 'red') rDead++; else bDead++; } prevCE++; }
        L.push('t=' + smp.seconds + 's: KIRMIZI ' + reds.length + ' birim (yayılım ' + bwSpread(reds, rc) + 'px), MAVİ ' + blues.length +
            ' | aradaki mesafe ' + dist + 'px | ateş eden KIRMIZI ' + firing.length + ', en-çok-odaklanan-hedefe ' + maxFocus + ' birlik' +
            (blocked ? ', ÖNÜ-KAPALI ' + blocked : '') + (fleeing ? ', KAÇAN ' + fleeing : '') +
            (rDead || bDead ? ' | bu aralıkta öldü: KIRMIZI ' + rDead + ', MAVİ ' + bDead : ''));
    }

    // İSTATİSTİK + OTOMATİK TEŞHİS
    let redDmg = 0, blueDmg = 0, redKill = 0, blueKill = 0;
    for (const e of ce) { const d = e.damage || 0; if (e.attackerSide === 'red') { redDmg += d; if (e.lethal) redKill++; } else if (e.attackerSide === 'blue') { blueDmg += d; if (e.lethal) blueKill++; } }
    let atkOrders = 0, atkUnits = 0;
    for (const d of cd) if (d.side === 'red') for (const o of ((d.execution && d.execution.orders) || [])) if (o.kind === 'ATTACK') { atkOrders++; atkUnits += (o.unitIds || []).length; }
    const stCount = {}; let stTot = 0;
    for (const smp of s) for (const u of smp.units) if (u.side === 'red') { stCount[u.combatState] = (stCount[u.combatState] || 0) + 1; stTot++; }
    const fleePct = (100 * (stCount['FLEE'] || 0) / (stTot || 1)).toFixed(1);
    const blockedTot = stCount['Hat Kapalı'] || 0;
    L.push('');
    L.push('── İSTATİSTİK ──');
    L.push('Hasar: KIRMIZI(AI) ' + Math.round(redDmg) + ' (öldürme ' + redKill + ') vs MAVİ ' + Math.round(blueDmg) + ' (öldürme ' + blueKill + ')  → oran ' + (blueDmg / (redDmg || 1)).toFixed(1) + ':1 insan lehine');
    L.push('AI ATEŞ-KONSANTRASYONU: bir anda tek hedefe ort ' + m.avgFocusedUnits + ' birlik yükleniyor (ateş edenlerin %' + m.focusConcentrationPct + '\'i TEK hedefte — YÜKSEK=iyi/konsantre, DÜŞÜK<%50=dağınık)');
    L.push('AI "önü-kapalı" örnek: ' + blockedTot + ' (yüksekse kendi birliğini blokluyor = blob) | KAÇMA: %' + fleePct);
    // FAZ 1 derin metrikler (kayıttan hesap):
    const m = battleMatchMetrics(recording);
    L.push('TTK (öldürme süresi): AI ' + m.ttkRed + 'sn vs insan ' + m.ttkBlue + 'sn (düşük=hızlı öldürür) | menzilde-AMA-ateş-etmeyen: %' + m.inRangeNotFiringPct);
    L.push('Plan-değişim: ' + m.planChanges + ' (yüksek=savrulma) | takılma: %' + m.stuckPct + ' | topçu ateş-oranı: ' + (m.artilleryFireVsMove == null ? 'yok' : m.artilleryFireVsMove) + (m.surroundedPct ? ' | SARILMA karesi: %' + m.surroundedPct + ' (cephe-gen ' + m.frontWidthAvg + 'px)' : ''));
    return L.join('\n');
}

// ═══ FAZ 1 ÖLÇÜM: kayıttan (davranış değiştirmeden) "AI neden kaybetti" metrikleri. Deterministik (RNG yok).
// Tüm sonraki fazların A/B ölçüm dili. Headless harness JSON olarak basar; digest birkaçını koça gösterir.
function battleMatchMetrics(recording) {
    const rep = recording.replay || recording;
    const t = rep.telemetry || {};
    const s = t.samples || [], cd = t.controllerDecisions || [], ce = t.combatEvents || [];
    const M = { samples: s.length };
    if (!s.length) return M;
    const dt = s.length > 1 ? (s[1].seconds - s[0].seconds) : 0.5;   // örnek aralığı (sn)

    // TTK (öldürme süresi): her hedef için ilk-hasar→lethal arası sn. Taraf-bazlı ort.
    const firstHit = {}, ttk = { red: [], blue: [] };
    for (const e of ce) {
        const tid = e.targetId; if (tid == null) continue;
        if (firstHit[tid] == null) firstHit[tid] = e.seconds;
        if (e.lethal) { const side = e.attackerSide; if (side === 'red' || side === 'blue') ttk[side].push(e.seconds - firstHit[tid]); delete firstHit[tid]; }
    }
    const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0;
    M.ttkRed = avg(ttk.red); M.ttkBlue = avg(ttk.blue);   // DÜŞÜK=hızlı öldürüyor

    // Hasar / öldürme / saldırı-grubu / focus / blok / kaçış (mevcut digest ile aynı temel)
    let redDmg = 0, blueDmg = 0, redKill = 0, blueKill = 0;
    for (const e of ce) { const d = e.damage || 0; if (e.attackerSide === 'red') { redDmg += d; if (e.lethal) redKill++; } else if (e.attackerSide === 'blue') { blueDmg += d; if (e.lethal) blueKill++; } }
    M.redDmg = Math.round(redDmg); M.blueDmg = Math.round(blueDmg); M.redKill = redKill; M.blueKill = blueKill;
    M.dmgRatio = +(blueDmg / (redDmg || 1)).toFixed(2);   // insan lehine oran (>1 = AI kötü)
    let atkOrders = 0, atkUnits = 0;
    for (const d of cd) if (d.side === 'red') for (const o of ((d.execution && d.execution.orders) || [])) if (o.kind === 'ATTACK') { atkOrders++; atkUnits += (o.unitIds || []).length; }
    M.avgAttackGroup = +(atkUnits / (atkOrders || 1)).toFixed(2);   // DİKKAT: emir-churn (hedef değişince çıkar), KONSANTRASYON DEĞİL — yanıltıcı, kullanma
    // GERÇEK ateş-konsantrasyonu: bir KAREDE en çok yüklenen tek hedefe kaç birim / ateş eden toplam (YÜKSEK=konsantre=iyi)
    let focMax = 0, focRatio = 0, focN = 0;
    for (const smp of s) {
        const fr = smp.units.filter(u => u.side === 'red' && u.attackTargetId != null);
        if (fr.length < 2) continue;
        const bt = {}; for (const u of fr) bt[u.attackTargetId] = (bt[u.attackTargetId] || 0) + 1;
        const mx = Math.max(...Object.values(bt));
        focMax += mx; focRatio += mx / fr.length; focN++;
    }
    M.avgFocusedUnits = focN ? +(focMax / focN).toFixed(1) : 0;                 // bir anda tek hedefe yüklenen ort birim
    M.focusConcentrationPct = focN ? +(100 * focRatio / focN).toFixed(0) : 0;   // ateş edenlerin % kaçı TEK hedefte (YÜKSEK=iyi)

    // Menzilde-ateş-etmeyen % + takılma % + topçu ateş/yürü — kırmızı birim-örnekleri üzerinden
    let inRangeTot = 0, inRangeNotFiring = 0, stuckTot = 0, stuck = 0, artFire = 0, artMove = 0, blocked = 0, flee = 0, redSamp = 0;
    for (let i = 0; i < s.length; i++) {
        const reds = s[i].units.filter(u => u.side === 'red'), foes = s[i].units.filter(u => u.side === 'blue');
        const prev = i > 0 ? s[i - 1] : null;
        for (const u of reds) {
            redSamp++;
            if (u.combatState === 'Hat Kapalı') blocked++;
            if (u.combatState === 'FLEE' || u.fleeing) flee++;
            const rng = BW_RANGE[u.type] || 110;
            let enemyInRange = false;
            for (const f of foes) { const dx = f.x - u.x, dy = f.y - u.y; if (dx * dx + dy * dy <= rng * rng) { enemyInRange = true; break; } }
            if (enemyInRange) { inRangeTot++; if (!(u.attackTargetId)) inRangeNotFiring++; }
            // takılma: hedef uzak ama kıpırdamamış (ya navBlocked)
            const distToTgt = Math.hypot((u.targetX ?? u.x) - u.x, (u.targetY ?? u.y) - u.y);
            if (distToTgt > 60) {
                stuckTot++;
                const pu = prev && prev.units.find(z => z.id === u.id);
                const moved = pu ? Math.hypot(u.x - pu.x, u.y - pu.y) : 99;
                if (u.navBlocked || moved < 5) stuck++;
            }
            // topçu (tip 8): ateş mi yürüyor mu
            if (u.type === 8) { if (u.attackTargetId) artFire++; else { const pu = prev && prev.units.find(z => z.id === u.id); if (pu && Math.hypot(u.x - pu.x, u.y - pu.y) > 4) artMove++; } }
        }
    }
    M.inRangeNotFiringPct = inRangeTot ? +(100 * inRangeNotFiring / inRangeTot).toFixed(0) : 0;
    M.stuckPct = stuckTot ? +(100 * stuck / stuckTot).toFixed(0) : 0;
    M.artilleryFireVsMove = (artFire + artMove) ? +(artFire / (artFire + artMove)).toFixed(2) : null;
    M.blockedPct = redSamp ? +(100 * blocked / redSamp).toFixed(1) : 0;
    M.fleePct = redSamp ? +(100 * flee / redSamp).toFixed(1) : 0;

    // Plan-değişim sayısı (kırmızı kontrolör committedPlan.id geçişleri) = savrulma vekili
    let planChanges = 0, lastPlan = null;
    for (const d of cd) { if (d.side !== 'red') continue; const p = d.committedPlan && (d.committedPlan.id || d.committedPlan.kind); if (p != null && p !== lastPlan) { if (lastPlan != null) planChanges++; lastPlan = p; } }
    M.planChanges = planChanges;

    // Cephe-genişliği (ort.) + sarılma-kare — kırmızının ilerleme eksenine göre
    let frontSum = 0, frontN = 0, surrounded = 0;
    for (const smp of s) {
        const reds = smp.units.filter(u => u.side === 'red'), foes = smp.units.filter(u => u.side === 'blue');
        if (reds.length < 2 || !foes.length) continue;
        let rcx = 0, rcy = 0; for (const u of reds) { rcx += u.x; rcy += u.y; } rcx /= reds.length; rcy /= reds.length;
        let bcx = 0, bcy = 0; for (const u of foes) { bcx += u.x; bcy += u.y; } bcx /= foes.length; bcy /= foes.length;
        const ax = bcx - rcx, ay = bcy - rcy; const al = Math.hypot(ax, ay) || 1; const ux = ax / al, uy = ay / al;
        const px = -uy, py = ux;   // ilerleme eksenine dik
        let minP = Infinity, maxP = -Infinity;
        for (const u of reds) { const proj = (u.x - rcx) * px + (u.y - rcy) * py; if (proj < minP) minP = proj; if (proj > maxP) maxP = proj; }
        frontSum += (maxP - minP); frontN++;
        // sarılma (gerçek kuşatma): düşman öz-merkezin GERİSİNDE (along<0) VE en az bir yanda → arka+yan kıskaç.
        // (yalnız iki-yan = baskı, kuşatma değil; yalnız arka = tek koldan sızma. İkisi birden = sarılma.)
        let back = 0, left = 0, right = 0;
        for (const f of foes) { const dx = f.x - rcx, dy = f.y - rcy; const along = dx * ux + dy * uy, side = dx * px + dy * py; if (along < -80) back++; if (side < -120) left++; else if (side > 120) right++; }
        if (back > 0 && (left > 0 || right > 0)) surrounded++;
    }
    M.frontWidthAvg = frontN ? Math.round(frontSum / frontN) : 0;
    M.surroundedFrames = surrounded;
    M.surroundedPct = frontN ? +(100 * surrounded / frontN).toFixed(0) : 0;

    const last = s[s.length - 1];
    M.durationSec = last.seconds;
    M.redSurvivors = last.units.filter(u => u.side === 'red').length;
    M.blueSurvivors = last.units.filter(u => u.side === 'blue').length;
    M.winner = last.battle && last.battle.winnerSide === true ? 'red' : (last.battle && last.battle.winnerSide === false ? 'blue' : null);
    return M;
}

// Koç sistem-promptu: 3.şahıs RTS savaş analisti — kayıttaki SAYILARA dayanır, somut düzeltme önerir.
const BATTLE_WATCH_SYSTEM = 'Sen deneyimli bir RTS (gerçek-zamanlı strateji) savaş analistisin. Sana bir maçın KARE-KARE kaydı ve istatistikleri verilir. KIRMIZI = yapay zeka (AI), MAVİ = insan oyuncu. 3.şahıs bir gözlemci gibi maçı analiz et: KIRMIZI (AI) NEDEN kaybetti? Sadece kayıttaki SAYILARA dayan (aradaki mesafe, ateş eden birim sayısı, en-çok-odaklanan-hedefe kaç birlik, önü-kapalı sayısı, kaçan, hasar oranı, ölüm sırası). Genel/klişe laf etme. Türkçe, madde madde, kısa.';

function battleWatchPrompt(digest) {
    return digest + '\n\n── GÖREV ──\nBu maçı 3.şahıs izledin. KIRMIZI (AI) neden kaybetti? SAYILARA dayanarak en kritik 3-5 hatayı sırala; her hata için tek cümlelik SOMUT düzeltme öner (formasyon / hedefleme / mesafe-tempo / kompozisyon). Kısa ve net, en fazla 5 madde.';
}

// ═══ ÇOKLU-MAÇ İZLEME: koç TEK maç değil SON N maçı birden görür (kullanıcı: "koç sadece son maçı izliyor").
// Bağlam sınırı (2560) için: her maç tek-satır + TOPLAM ortalama + tekrarlayan-örüntü + EN KÖTÜ maçın kare-kare açılımı.
// Böylece koç 5 maçtaki KALICI zaafı (tek maçın gürültüsü değil) yakalar, en öğretici maçı derinleştirir.
function battleMultiMatchDigest(recordings) {
    const list = (recordings || []).filter(Boolean);
    if (!list.length) return 'KAYIT YOK.';
    if (list.length === 1) return battleMatchDigest(list[0]);
    const rows = list.map((rec, i) => ({ i, rec, m: battleMatchMetrics(rec) })).filter(r => r.m.samples);
    if (!rows.length) return 'KAYITLAR BOŞ.';

    const L = [];
    L.push('═══ SON ' + rows.length + ' MAÇ — TOPLU ANALİZ (AI = KIRMIZI) ═══');
    L.push('');
    L.push('── MAÇ MAÇ (özet) ──');
    let losses = 0;
    for (const r of rows) {
        const m = r.m;
        const win = m.winner === 'red' ? 'AI KAZANDI' : (m.winner === 'blue' ? 'AI KAYBETTİ' : 'berabere');
        if (m.winner === 'blue') losses++;
        L.push('Maç ' + (r.i + 1) + ': ' + win + ' (' + m.durationSec + 'sn, kalan KIRMIZI ' + m.redSurvivors + ' vs MAVİ ' + m.blueSurvivors + ')' +
            ' | hasar-oran ' + m.dmgRatio + ':1 | sarılma %' + (m.surroundedPct || 0) + ' | plan-değişim ' + m.planChanges +
            ' | TTK ' + m.ttkRed + 'sn | menzilde-ateşsiz %' + m.inRangeNotFiringPct + ' | konsantrasyon %' + m.focusConcentrationPct);
    }

    // TOPLAM ortalamalar (kalıcı zaaf = tek maçın gürültüsü değil, N maçın ortalaması)
    const A = k => +(rows.reduce((s, r) => s + (r.m[k] || 0), 0) / rows.length).toFixed(2);
    const wins = rows.filter(r => r.m.winner === 'red').length;
    const draws = rows.length - wins - losses;
    L.push('');
    L.push('── ' + rows.length + ' MAÇ ORTALAMASI ──');
    L.push('AI: ' + wins + ' galibiyet / ' + losses + ' yenilgi' + (draws ? ' / ' + draws + ' berabere' : '') + ' | ort. hasar-oran ' + A('dmgRatio') + ':1 (insan lehine, >1 kötü)');
    L.push('ort. SARILMA karesi %' + A('surroundedPct') + ' (cephe-gen ' + A('frontWidthAvg') + 'px) | ort. plan-değişim ' + A('planChanges') + ' | ort. ateş-konsantrasyonu %' + A('focusConcentrationPct') + ' (YÜKSEK=iyi)');
    L.push('ort. TTK ' + A('ttkRed') + 'sn | menzilde-AMA-ateş-etmeyen %' + A('inRangeNotFiringPct') + ' | takılma %' + A('stuckPct') + ' | önü-kapalı %' + A('blockedPct'));

    // TEKRARLAYAN ÖRÜNTÜ: hangi zaaf çoğu maçta var? (koça "tek maç değil, DESEN" sinyali)
    const rec = [];
    const cnt = (pred) => rows.filter(pred).length;
    if (cnt(r => r.m.surroundedPct >= 15) >= Math.ceil(rows.length / 2)) rec.push('SARILMA: ' + cnt(r => r.m.surroundedPct >= 15) + '/' + rows.length + ' maçta AI arka+yan kıskaca girdi');
    if (cnt(r => r.m.focusConcentrationPct < 50) >= Math.ceil(rows.length / 2)) rec.push('DAĞINIK ATEŞ: ' + cnt(r => r.m.focusConcentrationPct < 50) + '/' + rows.length + ' maçta ateş-konsantrasyonu <%50 (birlikler farklı hedeflere dağıldı)');
    if (cnt(r => r.m.inRangeNotFiringPct >= 25) >= Math.ceil(rows.length / 2)) rec.push('ATEŞ ETMEME: ' + cnt(r => r.m.inRangeNotFiringPct >= 25) + '/' + rows.length + ' maçta menzilde %25+ birlik ateş etmedi');
    if (cnt(r => r.m.planChanges >= 20) >= Math.ceil(rows.length / 2)) rec.push('PLAN SAVRULMASI: ' + cnt(r => r.m.planChanges >= 20) + '/' + rows.length + ' maçta 20+ plan değişimi');
    if (cnt(r => r.m.blockedPct >= 8) >= Math.ceil(rows.length / 2)) rec.push('BLOB (önü-kapalı): ' + cnt(r => r.m.blockedPct >= 8) + '/' + rows.length + ' maçta %8+ birim kendi hattını blokladı');
    if (cnt(r => r.m.dmgRatio >= 1.2) >= Math.ceil(rows.length / 2)) rec.push('HASAR AÇIĞI: ' + cnt(r => r.m.dmgRatio >= 1.2) + '/' + rows.length + ' maçta insan hasar-üstünlüğü kurdu');
    if (rec.length) { L.push(''); L.push('── ' + rows.length + ' MAÇTA TEKRARLAYAN ZAAF ──'); rec.forEach(x => L.push('• ' + x)); }

    // EN KÖTÜ maç (en öğretici) → kare-kare aç. Kötülük = kaybetti + sarılma + hasar-açığı.
    const badness = r => (r.m.winner === 'blue' ? 100 : 0) + (r.m.surroundedPct || 0) + (r.m.dmgRatio || 0) * 20 + (r.m.blueSurvivors - r.m.redSurvivors);
    let worst = rows[0]; for (const r of rows) if (badness(r) > badness(worst)) worst = r;
    L.push('');
    L.push('══════════════════════════════════════════');
    L.push('EN ÖĞRETİCİ MAÇ = Maç ' + (worst.i + 1) + ' (aşağıda kare-kare) — deseni burada göreceksin:');
    L.push('══════════════════════════════════════════');
    L.push(battleMatchDigest(worst.rec));
    return L.join('\n');
}

function battleMultiMatchPrompt(digest) {
    return digest + '\n\n── GÖREV ──\nBu SON MAÇLARI 3.şahıs izledin. Tek maça değil, MAÇLAR-BOYUNCA TEKRARLAYAN desene odaklan: KIRMIZI (AI) hangi hatayı SÜREKLİ yapıyor? Ortalamalar + tekrarlayan-zaaf listesine ve en-öğretici maçın kare-kare akışına dayanarak en kritik 3-5 KALICI zaafı sırala; her biri için tek cümlelik SOMUT düzeltme öner (formasyon / hedefleme / mesafe-tempo / kompozisyon / kuşatma-tepkisi). Kısa ve net, en fazla 5 madde.';
}

if (typeof module !== 'undefined') module.exports = { battleMatchDigest, battleMatchMetrics, battleWatchPrompt, BATTLE_WATCH_SYSTEM, battleMultiMatchDigest, battleMultiMatchPrompt };
