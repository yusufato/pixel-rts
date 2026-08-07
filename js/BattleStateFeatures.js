// ── DURUM ÖZNİTELİKLERİ (değer fonksiyonunun GİRDİSİ) ──
//
// NEDEN AYRI DOSYA: bu öznitelikler iki ayrı yerde üretiliyor — (1) `tools/durum-veri.js` gece
// koşusunda EĞİTİM verisini toplarken, (2) `js/BattleOracle.js` aday yuvarlamalarının sonunda
// ΔV hesaplamak için. İki kopya birbirinden en ufak sapsa değer ağı ANLAMSIZ tahmin üretir ve
// bunu fark etmek çok zordur (sessiz bozulma). Tek kaynak: bu dosya.
//
// BİÇİM (model bu biçimde eğitildi — DEĞİŞTİRİLEMEZ):
//   raster : 8 kanal × GY(10) × GX(16) = 1280 sayı. Kanal çiftleri simetrik (kendi/düşman):
//            0/1 değer yoğunluğu · 2/3 HP · 4/5 dolaylı ateş · 6/7 hava
//   skaler : 18 temel + 10 kendi kategori payı + 10 düşman kategori payı + 21 kredi farkı = 59
//
// DETERMİNİZM: yalnız OKUR, sim durumuna dokunmaz, RNG kullanmaz.
const BATTLE_OZ_KAT = ['air', 'air_defense', 'armor', 'indirect', 'infantry',
    'logistics', 'recon', 'support', 'uav', 'command'];
const BATTLE_OZ_KANALLAR = ['hasar', 'panik', 'baski', 'imhaDeger', 'emilen', 'gorusTekil',
    'tespit', 'jamTik', 'iyilestirme', 'kurtarma', 'muhimmat', 'kuruEngel', 'siperTik',
    'yakitDolum', 'mayin', 'tasinan', 'droneHasar', 'haleTik', 'rally', 'havaCaydirma', 'havaHasar'];

function battleKrediOzet() {
    const k = { r: {}, m: {} };
    for (const c of BATTLE_OZ_KANALLAR) { k.r[c] = 0; k.m[c] = 0; }
    if (typeof BATTLE_CREDIT === 'undefined' || !BATTLE_CREDIT.birim) return k;
    for (const id in BATTLE_CREDIT.birim) {
        const b = BATTLE_CREDIT.birim[id];
        const t = b.isRed ? k.r : k.m;
        for (const c of BATTLE_OZ_KANALLAR) t[c] += (b[c] || 0);
    }
    return k;
}

// Dönüş: { r: number[1280], s: number[59] }  — kırmızı "kendi" tarafıdır (eğitim böyle toplandı).
function battleDurumOzellik(GX, GY) {
    GX = GX || 16; GY = GY || 10;
    const KANAL = 8;
    const R = new Array(KANAL * GY * GX).fill(0);
    let kDeger = 0, mDeger = 0, kHp = 0, mHp = 0, kSay = 0, mSay = 0;
    let kAmmo = 0, kAmmoMax = 0, mAmmo = 0, mAmmoMax = 0, kPanik = 0, mPanik = 0;
    const kKat = {}, mKat = {};
    let kx = 0, ky = 0, mx = 0, my = 0;
    for (const u of SIM.units) {
        if (u.dead || u.loaded || u.abandoned) continue;
        const s = STATS[u.type]; if (!s) continue;
        const v = s.cost || 0;
        const gx = Math.min(GX - 1, Math.max(0, Math.floor(u.x / WORLD_W * GX)));
        const gy = Math.min(GY - 1, Math.max(0, Math.floor(u.y / WORLD_H * GY)));
        const hucre = gy * GX + gx;
        const dolayli = !!(s.weapons && s.weapons[0] && s.weapons[0].indirect);
        const taban = u.isRed ? 0 : 1;
        R[(0 + taban) * GY * GX + hucre] += v;
        R[(2 + taban) * GY * GX + hucre] += Math.max(0, u.hp);
        if (dolayli) R[(4 + taban) * GY * GX + hucre] += v;
        if (u.isAir) R[(6 + taban) * GY * GX + hucre] += v;
        const kat = s.category || '?';
        if (u.isRed) {
            kDeger += v; kHp += Math.max(0, u.hp); kSay++; kx += u.x * v; ky += u.y * v;
            kAmmo += (u.ammo || 0); kAmmoMax += (u.maxAmmo || 0); kPanik += (u.panic || 0);
            kKat[kat] = (kKat[kat] || 0) + v;
        } else {
            mDeger += v; mHp += Math.max(0, u.hp); mSay++; mx += u.x * v; my += u.y * v;
            mAmmo += (u.ammo || 0); mAmmoMax += (u.maxAmmo || 0); mPanik += (u.panic || 0);
            mKat[kat] = (mKat[kat] || 0) + v;
        }
    }
    if (!kDeger || !mDeger) return null;   // taraflardan biri yoksa öznitelik tanımsız
    kx /= kDeger; ky /= kDeger; mx /= mDeger; my /= mDeger;
    let temas = 0;
    for (const u of SIM.units) {
        if (u.dead || u.loaded || !u.isRed) continue;
        for (const e of SIM.spatialGrid.getNearby(u.x, u.y, u.range)) {
            if (e.dead || e.loaded || e.isRed) continue;
            if (Math.hypot(e.x - u.x, e.y - u.y) <= u.range) { temas++; break; }
        }
    }
    const s = [
        SIM.tick / 7300, kDeger / 6500, mDeger / 6500, kDeger / (mDeger || 1),
        kHp / (kDeger * 3 || 1), mHp / (mDeger * 3 || 1), kSay / 48, mSay / 48,
        Math.hypot(kx - mx, ky - my) / WORLD_W, (kx / WORLD_W), (ky / WORLD_H), (mx / WORLD_W), (my / WORLD_H),
        kAmmoMax ? kAmmo / kAmmoMax : 0, mAmmoMax ? mAmmo / mAmmoMax : 0,
        kSay ? kPanik / kSay / 100 : 0, mSay ? mPanik / mSay / 100 : 0, temas / 48
    ];
    for (const k of BATTLE_OZ_KAT) s.push((kKat[k] || 0) / (kDeger || 1));
    for (const k of BATTLE_OZ_KAT) s.push((mKat[k] || 0) / (mDeger || 1));
    const _k = battleKrediOzet();
    for (const c of BATTLE_OZ_KANALLAR) s.push(((_k.r[c] || 0) - (_k.m[c] || 0)) / 5000);
    return { r: R, s };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { battleDurumOzellik, battleKrediOzet, BATTLE_OZ_KAT, BATTLE_OZ_KANALLAR };
}
