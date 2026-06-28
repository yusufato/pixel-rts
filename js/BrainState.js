// ═══════════════════════════════════════════════════════════════════════════
//  BrainState.js — ÖĞRENEN BEYİN v2 GİRDİ KODLAYICI (HİBRİT: özellik + algı)
//  ----------------------------------------------------------------------------
//  encode(u, now) → { scalars: Float32Array(SCALAR_DIM), spatial: Float32Array(SPATIAL_DIM) }
//   • scalars  : 240 el-işçiliği taktik özelliği (ego/düşman8/dost5/saha/bağlam/SU-KÖPRÜ/T3/STRATEJİK/MOMENTUM)
//     KONSEY-FIX: ölü 0-kanallar dolduruldu (görüş-belleği, intent-yaşı, keşif-boşluğu, yükselti-grad)
//     + BLOK A (CP cap/contested+3CP+VP-skoru+maç-ilerleme+global-kuvvet) + frame-stack momentum
//   • spatial  : 8 kanal × 16×16 ego-merkezli, DÜNYA-EKSENLİ ham harita (conv kolu için)
//  Determinist: trig sadece var-olanlar (atan2 sim'de zaten), RNG yok, sabit ölçek.
//  En-yakın-K sıralaması d2 + (x,y) tie-break → MP/headless bit-stabil.
//  Headless-güvenli: render/DOM yok. globals(T/STATS/canSee/checkLineOfSight),
//  MapImage(terrainTypeAt/isPassableAt/isBridgeAt/findPath/bridgeSet/gridElevationAt),
//  SIM.units/controlPoints/spatialGrid kullanır.
// ═══════════════════════════════════════════════════════════════════════════
const BrainState = (function () {
    const K_ENEMY = 8, ENEMY_F = 9;     // 72
    const K_ALLY = 5, ALLY_F = 4;       // 20
    const EGO_F = 22, FIELD_F = 16, CTX_F = 13, WATER_F = 44, T3_F = 32, STRAT_F = 17, MOM_F = 4;   // konsey: posture 1→3 one-hot (+2); T3 8 duplikat silindi (−8)
    const SCALAR_DIM = EGO_F + K_ENEMY * ENEMY_F + K_ALLY * ALLY_F + FIELD_F + CTX_F + WATER_F + T3_F + STRAT_F + MOM_F; // 240
    const GRID_N = 16, CHANNELS = 8, SPATIAL_DIM = CHANNELS * GRID_N * GRID_N; // 2048
    const EXT = 760;                    // uzaysal pencere yarı-genişliği (ego-merkez, ±760px)
    const R_REF = 900;                  // göreli konum/mesafe referans yarıçapı
    // global ölçek üst-sınırları (normalizasyon)
    const MAXHP = 936, MAXATK = 25, MAXRANGE = 350, MAXVIS = 800, MAXARMOR = 12, MAXSPD = 1.35;   // konsey: tank siper/orman'da 12'ye çıkar → 8'de doyuyordu

    const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
    const c01 = v => v < 0 ? 0 : (v > 1 ? 1 : v);
    const cN1 = v => v < -1 ? -1 : (v > 1 ? 1 : v);
    function typeGroup(t) {             // 0=piyade-sınıfı, 0.5=destek, 1=zırh
        if (t === T.ARMOR) return 1;
        if (t === T.ANTI_TANK || t === T.ARTILLERY || t === T.MEDIC || t === T.ENGINEER) return 0.5;
        return 0;
    }
    // motorun ÜRETTİĞİ 3 posture sınıfı (one-hot): atak / tut / çekil — 7-postür haritalaması
    const ENGINE_POSTURE = { ATTACK: 0, COMMIT: 0, FLANK: 0, ENVELOP: 0, HOLD: 1, SIEGE: 1, WITHDRAW: 2, DISENGAGE: 2 };

    // ANTİ-OMNİSCİENCE: birimin bir düşmanı MEŞRU olarak nasıl algıladığı (sis+gizlilik+ghost).
    // Görünür → canlı; görünmüyor ama son-görülen → ghost(son konum/hp); hiç görülmedi → null.
    function knownEnemyView(u, o) {
        // GÖRÜNÜRLÜK O(1): o.ghVisible = u'nun tarafı o'yu görüyor mu (updateBrainMemory'de canSee ile önceden hesaplı).
        // Fallback: bellek hiç koşmadıysa kendi-görüş yarıçapı.
        let visible;
        if (o.ghVisible === true) visible = true;
        else if (o.ghVisible === false) visible = false;
        else { const dx = o.x - u.x, dy = o.y - u.y; const vis = u.vision || (STATS[u.type] ? STATS[u.type].vision : 350); visible = (dx * dx + dy * dy) <= vis * vis; }
        if (visible && o.isConcealed && o.isConcealed()) {                 // ormanda-gizli: menzil dışında fark edilmez
            const dx = o.x - u.x, dy = o.y - u.y; const det = (u.type === T.RECON ? AMBUSH_DETECT * 2 : AMBUSH_DETECT);
            if (dx * dx + dy * dy > det * det) visible = false;
        }
        if (visible) return { x: o.x, y: o.y, hp: o.hp, maxHp: o.maxHp || 1, visible: true };
        if (o.ghVisible === false && o.ghX != null) return { x: o.ghX, y: o.ghY, hp: (o.ghHp != null ? o.ghHp : o.hp), maxHp: o.maxHp || 1, visible: false, age: (((typeof SIM !== 'undefined' ? SIM.tick : 0) || 0) - (o.ghT || 0)) };
        return null;                                                       // hiç görülmedi → beyin bilmez
    }

    // en yakın K düşman/dost (deterministik: d2 sonra x sonra y). Düşmanlar SİS/GİZLİLİK-saygılı (ghost).
    function nearestK(u, wantEnemy, K) {
        const out = [];
        for (const o of SIM.units) {                          // tam tarama: ghost konumu canlıdan farklı olabilir
            if (o.dead || o === u) continue;
            if (wantEnemy ? (o.isRed === u.isRed) : (o.isRed !== u.isRed)) continue;
            if (wantEnemy) {
                const v = knownEnemyView(u, o);
                if (!v) continue;                             // bilinmeyen düşman → girdiye GİRMEZ (hile yok)
                const dx = v.x - u.x, dy = v.y - u.y;
                out.push({ o, d2: dx * dx + dy * dy, dx, dy, view: v });
            } else {
                const dx = o.x - u.x, dy = o.y - u.y;
                out.push({ o, d2: dx * dx + dy * dy, dx, dy });
            }
        }
        out.sort((a, b) => a.d2 - b.d2 || a.o.x - b.o.x || a.o.y - b.o.y);
        return out.slice(0, K);
    }

    // ── SKALER KODLAYICI ──
    function encodeScalars(u, now, out) {
        let i = 0;
        const P = v => { out[i++] = (v === v) ? v : 0; };   // NaN-güvenli yaz
        const st = STATS[u.type] || {};
        const maxHp = u.maxHp || st.hp || 1;
        const maxAmmo = u.maxAmmo || st.maxAmmo || 0;

        // EGO (20)
        P(c01(u.hp / maxHp));
        for (let t = 0; t < 9; t++) P(u.type === t ? 1 : 0);                  // tip one-hot (9)
        P(maxAmmo > 0 ? c01(u.ammo / maxAmmo) : 1);   // konsey: silahsız (medic)=1 'cephane derdi yok' (T3 ammoFrac ile hizalı; 0 yanlış sinyaldi)
        P(c01((st.range || u.range || 0) / MAXRANGE));
        P(c01((st.speed || 0) / MAXSPD));
        P(c01((u.armor || 0) / MAXARMOR));
        P(c01((now - (u.lastAttackTime || 0)) / Math.max(1, st.atkSpeed || 1000)));  // atış-hazır
        P(c01((u.level || 0) / 2));
        P(c01(u.x / WORLD_W));
        P(c01(u.y / WORLD_H));
        const _pe = (u.intent && ENGINE_POSTURE[u.intent.posture] != null) ? ENGINE_POSTURE[u.intent.posture] : 0;
        for (let k = 0; k < 3; k++) P(_pe === k ? 1 : 0);                     // posture 3-sınıf one-hot (atak/tut/çekil)
        P((u.intent && u.intent.preferredRange != null) ? u.intent.preferredRange : 0.62);

        // EN-YAKIN 8 DÜŞMAN ×9 (72)
        const en = nearestK(u, true, K_ENEMY);
        for (let k = 0; k < K_ENEMY; k++) {
            const e = en[k];
            if (!e) { for (let f = 0; f < ENEMY_F; f++) P(0); continue; }
            const o = e.o, vw = e.view || { hp: o.hp, maxHp: o.maxHp || 1, visible: true }, oMax = vw.maxHp || 1;
            P(cN1(e.dx / R_REF)); P(cN1(e.dy / R_REF)); P(c01(Math.sqrt(e.d2) / R_REF));
            P(c01(vw.hp / oMax)); P(typeGroup(o.type)); P(c01((STATS[o.type] ? STATS[o.type].atk : 0) / MAXATK));
            P(vw.visible && o.attackTarget === u ? 1 : 0);                                  // canlı bilgi yalnız GÖRÜNÜRken
            P(vw.visible ? c01((now - (o.lastAttackTime || 0)) / Math.max(1, (STATS[o.type] ? STATS[o.type].atkSpeed : 1000))) : 0);
            P(vw.visible && (o.inForest || o.inTrench) ? 1 : 0);
        }

        // EN-YAKIN 5 DOST ×4 (20)
        const al = nearestK(u, false, K_ALLY);
        for (let k = 0; k < K_ALLY; k++) {
            const a = al[k];
            if (!a) { for (let f = 0; f < ALLY_F; f++) P(0); continue; }
            P(cN1(a.dx / R_REF)); P(cN1(a.dy / R_REF)); P(c01(a.o.hp / (a.o.maxHp || 1))); P(typeGroup(a.o.type));
        }

        // SAHA-OKUMA 8 yön × (tehdit + dost) (16)
        const thr = new Float64Array(8), frd = new Float64Array(8);
        for (const e of en) { const s = (Math.floor((Math.atan2(e.dy, e.dx) + Math.PI) / (Math.PI / 4)) & 7); thr[s] += (STATS[e.o.type] ? STATS[e.o.type].atk : 0) * ((e.view ? e.view.hp : e.o.hp) / (e.o.maxHp || 1)); }
        for (const a of al) { const s = (Math.floor((Math.atan2(a.dy, a.dx) + Math.PI) / (Math.PI / 4)) & 7); frd[s] += (STATS[a.o.type] ? STATS[a.o.type].atk : 0) * (a.o.hp / (a.o.maxHp || 1)); }
        for (let s = 0; s < 8; s++) { P(thr[s] / (thr[s] + 50)); P(frd[s] / (frd[s] + 50)); }   // konsey: rasyonel soft-saturate (/60 ile 3 birimde 1.0 doyuyordu, yığın ayrışmıyordu)

        // BAĞLAM (13)
        const cp = nearestCP(u);
        P(c01((u.localForceRatio || 1) / 2));
        P((typeof phase !== 'undefined' && phase === (typeof PHASE !== 'undefined' ? PHASE.BATTLE : 1)) ? 1 : 0);
        P(c01((u.panic || 0) / 100));
        P(u.enemyInVision ? 1 : 0);
        P(u.inSupply ? 1 : 0);
        P(u.leaderNearby ? 1 : 0);
        if (cp) { P(cN1((cp.x - u.x) / R_REF)); P(cN1((cp.y - u.y) / R_REF)); P(c01(cp.dist / R_REF)); P(cpOwnerVal(cp, u)); }
        else { P(0); P(0); P(1); P(0); }
        P(c01(u.elevation != null ? u.elevation : 0.5));
        P(c01((u.suppression || 0) / 100));
        P(c01((u.fleeingNearby || 0) / 5));

        // SU/KÖPRÜ (44) — MapImage API'sinden
        i = encodeWater(u, out, i);

        // T3 (40)
        i = encodeT3(u, now, out, i, en);

        // STRATEJİK / BLOK A (17): CP detay + 3 CP global + VP-skoru + maç-ilerleme + global kuvvet
        i = encodeStrategic(u, out, i);

        // FRAME-STACK / MOMENTUM (4): Δcan / Δbaskı / hedefe-Δmesafe / düşman-yaklaşıyor
        i = encodeMomentum(u, out, i);

        return i;
    }

    function encodeWater(u, out, i) {
        const P = v => { out[i++] = (v === v) ? c01OrN(v) : 0; };
        const grid = (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid' && typeof terrainTypeAt === 'function');
        const passable = (x, y) => grid ? (typeof isPassableAt === 'function' ? isPassableAt(x, y) : true) : true;
        // köprüdeyim / suya bitişik
        P(grid && typeof isBridgeAt === 'function' && isBridgeAt(u.x, u.y) ? 1 : 0);
        let adjWater = 0;
        if (grid) { const d = 30; if (terrainTypeAt(u.x + d, u.y) === TERRAIN.WATER || terrainTypeAt(u.x - d, u.y) === TERRAIN.WATER || terrainTypeAt(u.x, u.y + d) === TERRAIN.WATER || terrainTypeAt(u.x, u.y - d) === TERRAIN.WATER) adjWater = 1; }
        P(adjWater);
        // en yakın köprü yön+mesafe
        let bdx = 0, bdy = 0, bdist = 1;
        if (grid && typeof bridgeSet !== 'undefined' && bridgeSet && bridgeSet.size) {
            let best = 1e9, bx = 0, by = 0;
            for (const key of bridgeSet) { const p = key.split(','); const wx = (+p[0] + 0.5) * CELL_W, wy = (+p[1] + 0.5) * CELL_H; const dx = wx - u.x, dy = wy - u.y, d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; bx = dx; by = dy; } }
            const dd = Math.sqrt(best); bdx = cN1(bx / R_REF); bdy = cN1(by / R_REF); bdist = c01(dd / R_REF);
        }
        P(bdx); P(bdy); P(bdist);
        // A* yol ilk-bacak yönü + düz-hat kapalı + sapma oranı
        let pfx = 0, pfy = 0, blocked = 0, detour = 0;
        const tx = u.targetX != null ? u.targetX : u.x, ty = u.targetY != null ? u.targetY : u.y;
        if (grid && typeof pathBlockedBetween === 'function' && pathBlockedBetween(u.x, u.y, tx, ty)) {
            blocked = 1;
            if (typeof findPath === 'function') {
                const path = findPath(u.x, u.y, tx, ty);
                if (path && path.length > 1) {
                    const w = path[1]; pfx = cN1((w.x - u.x) / R_REF); pfy = cN1((w.y - u.y) / R_REF);
                    let plen = 0; for (let k = 0; k < path.length - 1; k++) plen += Math.hypot(path[k + 1].x - path[k].x, path[k + 1].y - path[k].y);
                    const straight = Math.hypot(tx - u.x, ty - u.y) || 1; detour = c01((plen / straight - 1));
                }
            }
        }
        P(pfx); P(pfy); P(blocked); P(detour);
        // köprü kontrol: en yakın köprü çevresinde dost/düşman/boş (3)
        let bMine = 0, bEnemy = 0, bNeutral = 1;
        if (grid && bdist < 0.6 && SIM.spatialGrid) {
            const bwx = u.x + bdx * R_REF, bwy = u.y + bdy * R_REF;
            const near = SIM.spatialGrid.getNearby(bwx, bwy, 200); let mine = 0, foe = 0;
            for (const o of near) { if (o.dead) continue; if (Math.hypot(o.x - bwx, o.y - bwy) > 200) continue; if (o.isRed === u.isRed) mine++; else foe++; }
            if (mine + foe > 0) { bNeutral = 0; bMine = c01(mine / 5); bEnemy = c01(foe / 5); }
        }
        P(bMine); P(bEnemy); P(bNeutral);
        // 5×5 geçilebilirlik ızgarası (25), ego-merkez, hücre 90px
        const step = 90;
        for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) P(passable(u.x + c * step, u.y + r * step) ? 1 : 0);
        // LOS en yakın düşmana su/dağ ile kesik (1)
        let losBlk = 0;
        if (grid && typeof gridLOSBlocked === 'function') { const e0 = nearestEnemyQuick(u); if (e0 && gridLOSBlocked(u.x, u.y, e0.x, e0.y)) losBlk = 1; }
        P(losBlk);
        // geçit-darlığı: 3×3 açık-yön sayısı + min-genişlik (2)
        let openDirs = 0; for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) { if (r === 0 && c === 0) continue; if (passable(u.x + c * 90, u.y + r * 90)) openDirs++; }
        // konsey: ikinci kanal copy-paste'ti → gerçek darboğaz-sıkılığı (en dar yönde açıklık)
        let minOpen = 5;
        for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4, cx = Math.cos(ang), cy = Math.sin(ang); let dd = 0; for (; dd < 5; dd++) { if (!passable(u.x + cx * (dd + 1) * 40, u.y + cy * (dd + 1) * 40)) break; } if (dd < minOpen) minOpen = dd; }
        P(c01(openDirs / 8)); P(c01(minOpen / 5));   // açık-yön sayısı + EN-DAR yön açıklığı (farklı sinyaller)
        // su-korumalı kanat (yan tarafımda su bariyeri) (1)
        let waterFlank = 0;
        if (grid) { if (terrainTypeAt(u.x + 120, u.y) === TERRAIN.WATER || terrainTypeAt(u.x - 120, u.y) === TERRAIN.WATER) waterFlank = 1; }
        P(waterFlank);
        // köprü-yaklaşım açıklığı (yol boyu açık-arazi) (1) — basit: köprü mesafesi ters
        P(grid ? c01(1 - bdist) : 0);
        // en yakın suya mesafe (1)
        let waterDist = 1;
        if (grid) { for (let rad = 1; rad <= 6; rad++) { let hit = false; for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; if (terrainTypeAt(u.x + Math.cos(ang) * rad * 80, u.y + Math.sin(ang) * rad * 80) === TERRAIN.WATER) { hit = true; break; } } if (hit) { waterDist = rad / 6; break; } } }
        P(waterDist);
        // yakın çevre su-oranı (3×3) (1)
        let wf = 0, wc = 0;
        if (grid) { for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) { wc++; if (terrainTypeAt(u.x + c * 90, u.y + r * 90) === TERRAIN.WATER) wf++; } }
        P(wc ? wf / wc : 0);
        return i;   // 1+1+3+4+3+25+1+2+1+1+1+1 = 44
    }

    function encodeT3(u, now, out, i, en) {
        const P = v => { out[i++] = (v === v) ? c01OrN(v) : 0; };
        const st = STATS[u.type] || {};
        // 1 gizli / 2 gizli-düşman-şüphesi (görüş-belleği: en-son-görülen ama ŞU AN kayıp düşman) / 1 açıkta
        P(u.isConcealed && u.isConcealed() ? 1 : 0);
        {
            let gBest = Infinity, gDx = 0, gDy = 0, gAge = 0;
            const tk = (typeof SIM !== 'undefined' ? SIM.tick : 0) || 0;
            for (const o of SIM.units) { if (o.dead || o.isRed === u.isRed) continue; if (o.ghVisible !== false || o.ghX == null) continue; const dx = o.ghX - u.x, dy = o.ghY - u.y, d2 = dx * dx + dy * dy; if (d2 < gBest) { gBest = d2; gDx = dx; gDy = dy; gAge = tk - (o.ghT || 0); } }
            const fresh = gBest < Infinity ? Math.max(0, 1 - gAge / 200) : 0;   // bayat ghost → sinyal söner (ghT okunur)
            P(cN1(gDx / R_REF * fresh)); P(cN1(gDy / R_REF * fresh));
        }
        P((u.revealTimer || 0) > 0 ? 1 : 0);
        // kanat-açık + sol/sağ dost örtüsü (yön sektörlerinden)
        const al = nearestK(u, false, K_ALLY);
        let leftAlly = 0, rightAlly = 0; const face = u.facingAngle || 0;
        for (const a of al) { const rel = Math.atan2(a.dy, a.dx) - face; const s = Math.sin(rel); if (s > 0.3) rightAlly++; else if (s < -0.3) leftAlly++; }
        P((leftAlly === 0 || rightAlly === 0) ? 1 : 0);        // bir yanım açık
        P(c01(leftAlly / 3)); P(c01(rightAlly / 3));
        // aşırı-yayılma: en yakın dosta mesafe
        P(al[0] ? c01(Math.sqrt((al[0].dx) ** 2 + (al[0].dy) ** 2) / R_REF) : 1);
        // flanked: bana arka/yandan ateş/tehdit (2) — yüzümün arkasındaki düşman
        let rearFoe = 0, sideFoe = 0;
        for (const e of (en || [])) { const rel = Math.atan2(e.dy, e.dx) - face; const cdv = Math.cos(rel); if (cdv < -0.5) rearFoe++; else if (Math.abs(cdv) <= 0.5) sideFoe++; }
        P(c01(rearFoe / 3)); P(c01(sideFoe / 3));
        // hedef-flanked fırsatı (1)
        let tgtFlank = 0; const at = u.attackTarget;
        if (at && !at.dead) { const ang = Math.atan2(u.y - at.y, u.x - at.x) - (at.facingAngle || 0); if (Math.cos(ang) > 0.4) tgtFlank = 1; }
        P(tgtFlank);
        // kuşatılma (1) + PINNED-bayrağı (1; supp-self BAGLAM'da var → silindi) + hedef bastırma (1)
        P(c01(u.encirclement || 0));
        P((u.suppression || 0) > (typeof PINNED_SUPPRESSION !== 'undefined' ? PINNED_SUPPRESSION : 80) ? 1 : 0);
        P(at && !at.dead ? c01((at.suppression || 0) / 100) : 0);
        // tempo/C2 (1): intent-yaşı (c2Linked=!!leaderNearby duplikat → silindi)
        P(c01(((typeof SIM !== 'undefined' ? (SIM.tick || 0) : 0) - (u._intentStamp || 0)) / 200));   // konsey: /40 ile ~%100 doyuyordu → /200
        // lojistik (2): supplyDist, supplyCut
        P(c01(u.supplyDist || 0)); P(u.supplyCut ? 1 : 0);
        // mühimmat (2): frac + düşük-bayrak
        const maxAmmo = u.maxAmmo || st.maxAmmo || 0;
        const ammoFrac = maxAmmo > 0 ? c01(u.ammo / maxAmmo) : 1; P(ammoFrac); P(ammoFrac < 0.25 ? 1 : 0);
        // keşif-oranı (1) — gördüğüm düşman / toplam düşman
        P(reconRatio(u));
        // keşif-boşluğu yön×büyüklük (2) — dost görüşünün EN ZAYIF olduğu yön (kör-nokta)
        {
            const cov = new Float64Array(8);
            for (const a of al) { const s = (Math.floor((Math.atan2(a.dy, a.dx) + Math.PI) / (Math.PI / 4)) & 7); cov[s] += (STATS[a.o.type] ? STATS[a.o.type].vision : 300) / MAXVIS; }
            let mb = 0, mbv = cov[0]; for (let s = 1; s < 8; s++) if (cov[s] < mbv) { mbv = cov[s]; mb = s; }
            const ang = (mb + 0.5) * (Math.PI / 4) - Math.PI, blind = c01(1 - mbv);
            P(cN1(Math.cos(ang) * blind)); P(cN1(Math.sin(ang) * blind));
        }
        // parça-parça-yenme (localForceRatio keskinleştirilmiş) (1)
        P(c01(1 - (u.localForceRatio || 1)));
        // yükselti avantajı (2): hedef + gradyan (self-elevation BAGLAM'da var → silindi)
        P(at && !at.dead ? c01(at.elevation != null ? at.elevation : 0.5) : 0.5);
        {
            let myE = u.elevation != null ? u.elevation : 0.5, maxE = myE;
            if (typeof elevationAt === 'function') for (let s = 0; s < 8; s++) { const ang = s * (Math.PI / 4); const e = elevationAt(u.x + Math.cos(ang) * 150, u.y + Math.sin(ang) * 150); if (e > maxE) maxE = e; }
            P(c01((maxE - myE) * 2));                           // yakında ne kadar yüksek-zemin kazanabilirim
        }
        // (veteranlık/moral level+panic+leader ve bozgun-fleeing BAGLAM/EGO'da var → silindi)
        // şarj/temas (1): en yakın düşman temas-eşiğinde
        P((en && en[0] && Math.sqrt(en[0].d2) < (st.range || 120) * 0.5) ? 1 : 0);
        // durum bayrakları (5): isFleeing, isPanicking, inTrench, dostGücü, düşmanGücü
        P(u.isFleeing ? 1 : 0); P(u.isPanicking ? 1 : 0); P(u.inTrench ? 1 : 0);
        P(c01((u.nearbyAllyStrength || 0) / 120)); P(c01((u.nearbyEnemyStrength || 0) / 120));
        // veteran (1): öldürme sayısı (xpBonus=level türevi duplikat → silindi)
        P(c01((u.kills || 0) / 10));
        return i;   // 32
    }

    // ── STRATEJİK / BLOK A (17): VP-yarışı bağlamı — beyin "ne zaman risk/tut" öğrensin ──
    function encodeStrategic(u, out, i) {
        const P = v => { out[i++] = (v === v) ? c01OrN(v) : 0; };
        const VPT = (typeof VP_TARGET !== 'undefined') ? VP_TARGET : 3000;
        const capMine = cp => u.isRed ? -(cp.cap || 0) : (cp.cap || 0);   // +1 benim-lehime ele-geçirme
        // en yakın CP: cap(my-favor) + contested (2)
        const ncp = nearestCP(u);
        if (ncp) { P(cN1(capMine(ncp))); P(ncp.contested ? 1 : 0); } else { P(0); P(0); }
        // 3 CP global (x'e göre sabit-sıra): owner + cap(my-favor) + contested (9)
        const cps = (SIM.controlPoints || []).slice().sort((a, b) => a.x - b.x || a.y - b.y);
        for (let k = 0; k < 3; k++) { const cp = cps[k]; if (cp) { P(cpOwnerVal(cp, u)); P(cN1(capMine(cp))); P(cp.contested ? 1 : 0); } else { P(0); P(0); P(0); } }
        // VP skoru: self / enemy / lead (3)
        const vs = (typeof SIM !== 'undefined' && SIM.vpScore) ? SIM.vpScore : { red: 0, blue: 0 };
        const mineVp = u.isRed ? vs.red : vs.blue, foeVp = u.isRed ? vs.blue : vs.red;
        P(c01(mineVp / VPT)); P(c01(foeVp / VPT)); P(cN1((mineVp - foeVp) / VPT));
        // maç-ilerleme: karara yakınlık (1)
        P(c01(Math.max(vs.red, vs.blue) / VPT));
        // global kuvvet: effHP-oranı + sayı-oranı (2) — yerel localForceRatio yetmez
        let myEff = 0, foeEff = 0, myN = 0, foeN = 0;
        for (const o of SIM.units) {
            if (o.dead) continue;
            const a = (STATS[o.type] ? STATS[o.type].atk : 0);
            if (o.isRed === u.isRed) { myEff += a * (o.hp / (o.maxHp || 1)); myN++; }
            else { const v = knownEnemyView(u, o); if (!v) continue; foeEff += a * (v.hp / (o.maxHp || 1)); foeN++; }   // yalnız BİLİNEN düşman (komuta-istihbaratı hilesi yok)
        }
        P(c01(myEff / (myEff + foeEff + 1))); P(c01(myN / (myN + foeN + 1)));
        return i;   // 2+9+3+1+2 = 17
    }

    // ── FRAME-STACK / MOMENTUM (4): trend görünürlüğü (anlık değil eğilim) ──
    function encodeMomentum(u, out, i) {
        const P = v => { out[i++] = (v === v) ? c01OrN(v) : 0; };
        const maxHp = u.maxHp || 1;
        P(cN1((u._fsDHp || 0) / (maxHp * 0.25)));     // can değişimi (− = hasar alıyorum)
        P(cN1((u._fsDSupp || 0) / 30));               // baskı değişimi
        P(cN1(-(u._fsDTargD || 0) / 200));            // hedefe yaklaşma (+ = yaklaşıyorum, − = takıldım/uzaklaşıyorum)
        P(cN1(-(u._fsDNearD || 0) / 200));            // düşman yaklaşıyor (+ = üstüme geliyor)
        return i;   // 4
    }

    // ── UZAYSAL TENSÖR (8 kanal × 16×16, ego-merkez, dünya-eksenli) ──
    function encodeSpatial(u, out) {
        out.fill(0);
        const cell = (2 * EXT) / GRID_N;                       // 95px
        const ox = u.x - EXT, oy = u.y - EXT;                  // sol-üst dünya köşesi
        const idx = (ch, gx, gy) => ch * GRID_N * GRID_N + gy * GRID_N + gx;
        const grid = (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid' && typeof terrainTypeAt === 'function');
        // birim kanalları (0 düşman-güç, 1 dost-güç, 2 düşman-sayı)
        for (const o of SIM.units) {
            if (o.dead || o === u) continue;
            let px = o.x, py = o.y, ph = o.hp;
            if (o.isRed !== u.isRed) { const v = knownEnemyView(u, o); if (!v) continue; px = v.x; py = v.y; ph = v.hp; }   // sis/gizlilik: bilinmeyen düşman ızgaraya GİRMEZ
            const gx = Math.floor((px - ox) / cell), gy = Math.floor((py - oy) / cell);
            if (gx < 0 || gy < 0 || gx >= GRID_N || gy >= GRID_N) continue;
            const str = c01(((STATS[o.type] ? STATS[o.type].atk : 0) * (ph / (o.maxHp || 1))) / 25);   // konsey: /40→/25 (tek-birim ~1.0)
            if (o.isRed !== u.isRed) { out[idx(0, gx, gy)] = Math.min(1, out[idx(0, gx, gy)] + str); out[idx(2, gx, gy)] = Math.min(1, out[idx(2, gx, gy)] + 0.34); }
            else { out[idx(1, gx, gy)] = Math.min(1, out[idx(1, gx, gy)] + str); }
        }
        // arazi kanalları (3 geçilebilir, 4 orman, 5 yükselti, 6 CP, 7 köprü) — hücre merkezinden örnek
        for (let gy = 0; gy < GRID_N; gy++) for (let gx = 0; gx < GRID_N; gx++) {
            const wx = ox + (gx + 0.5) * cell, wy = oy + (gy + 0.5) * cell;
            if (wx < 0 || wy < 0 || wx >= WORLD_W || wy >= WORLD_H) { out[idx(3, gx, gy)] = 0; continue; }
            let pass = 1, forest = 0, brg = 0;
            if (grid) { const tt = terrainTypeAt(wx, wy); if (tt === TERRAIN.MOUNTAIN) pass = 0; else if (tt === TERRAIN.WATER) pass = (typeof isBridgeAt === 'function' && isBridgeAt(wx, wy)) ? 1 : 0; if (tt === TERRAIN.FOREST) forest = 1; if (typeof isBridgeAt === 'function' && isBridgeAt(wx, wy)) brg = 1; }
            out[idx(3, gx, gy)] = pass; out[idx(4, gx, gy)] = forest; out[idx(7, gx, gy)] = brg;
            out[idx(5, gx, gy)] = c01(typeof elevationAt === 'function' ? elevationAt(wx, wy) : 0.5);
        }
        // CP kanalı (6): sahip işaretli
        if (SIM.controlPoints) for (const cp of SIM.controlPoints) {
            const gx = Math.floor((cp.x - ox) / cell), gy = Math.floor((cp.y - oy) / cell);
            if (gx < 0 || gy < 0 || gx >= GRID_N || gy >= GRID_N) continue;
            const own = cpOwnerVal(cp, u);                     // 1 benim, -1 düşman, 0 nötr
            out[idx(6, gx, gy)] = (own + 1) / 2;               // 0..1
        }
        return out;
    }

    // yardımcılar
    function c01OrN(v) { return v < -1 ? -1 : (v > 1 ? 1 : v); }   // -1..1 izinli (yön bileşenleri için)
    function nearestCP(u) {
        if (!SIM.controlPoints || !SIM.controlPoints.length) return null;
        let best = null, bd = 1e18;
        for (const cp of SIM.controlPoints) { const dx = cp.x - u.x, dy = cp.y - u.y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = cp; } }
        if (best) best.dist = Math.sqrt(bd);
        return best;
    }
    function cpOwnerVal(cp, u) {
        const owner = cp.owner;
        if (owner == null || owner === 'neutral' || owner === 0) return 0;
        const ownerRed = (owner === 'red' || owner === true || owner === 1);
        return ownerRed === u.isRed ? 1 : -1;
    }
    function nearestEnemyQuick(u) {                            // yalnız GÖRÜNÜR düşman (hile yok)
        let best = null, bd = 1e18;
        for (const o of SIM.units) { if (o.dead || o.isRed === u.isRed) continue; const v = knownEnemyView(u, o); if (!v || !v.visible) continue; const dx = o.x - u.x, dy = o.y - u.y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = o; } }
        return best;
    }
    function reconRatio(u) {
        let seen = 0, total = 0;
        for (const o of SIM.units) { if (o.dead || o.isRed === u.isRed) continue; total++; if (typeof canSee === 'function' && canSee(u.isRed, o.x, o.y)) seen++; }
        return total > 0 ? seen / total : 1;
    }

    let _warned = false;
    function encode(u, now) {
        if (now == null) now = (typeof simulationTime !== 'undefined') ? simulationTime : 0;
        const scalars = new Float32Array(SCALAR_DIM);
        const used = encodeScalars(u, now, scalars);
        if (used !== SCALAR_DIM && !_warned) { _warned = true; if (typeof console !== 'undefined') console.warn('BrainState SCALAR_DIM uyumsuz: yazılan=' + used + ' beklenen=' + SCALAR_DIM); }
        const spatial = new Float32Array(SPATIAL_DIM);
        encodeSpatial(u, spatial);
        return { scalars, spatial, scalarUsed: used };
    }

    return { encode, SCALAR_DIM, SPATIAL_DIM, GRID_N, CHANNELS, EXT,
        dims: { ego: EGO_F, enemies: K_ENEMY * ENEMY_F, allies: K_ALLY * ALLY_F, field: FIELD_F, context: CTX_F, water: WATER_F, t3: T3_F, strategic: STRAT_F, momentum: MOM_F, scalar: SCALAR_DIM, spatial: SPATIAL_DIM } };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BrainState;
