// ═══════════════════════════════════════════════════════════════════════════
//  SPRITE SAYFASI ÜRETİCİ — yeni birim görsellerinden icons.png kurar
//  ---------------------------------------------------------------------------
//  Oyunun beklediği biçim (js/globals.js:333 ölçüldü):
//      8780×730 · hücre 320×320 · pad 30 · 25 sütun
//      sx = 30 + sütun × 350   ·   sy = 30 (MAVİ) / 380 (KIRMIZI)
//
//  Kaynak görsel beyaz zeminli, satırları eşit olmayan bir tabaka olabilir
//  (örn. 9 + 8 + 8). Bu yüzden ızgara VARSAYILMAZ: zemin saydamlaştırılır,
//  bağlı bileşenler bulunur, satır/sütun sırasına dizilir. Böylece kaynak
//  düzeni değişse de araç çalışmaya devam eder.
//
//  KIRMIZI SATIR kaynakta yok; maviden üretilir (parlaklık korunur, renk
//  kırmızıya çevrilir) — iki takım ayırt edilebilir kalsın diye.
//
//  KULLANIM
//    npm run sprite -- --kaynak <tabaka.png> [--ek <kamikaze.png>] [--dene]
//    --dene  : icons.png'ye DOKUNMAZ, yalnız ne bulduğunu ve eşlemeyi yazar
//              (önce bununla çalıştır — yanlış eşleme yanlış ikon demektir)
// ═══════════════════════════════════════════════════════════════════════════
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

const arg = (ad, varsayilan) => {
    const i = process.argv.indexOf('--' + ad);
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
        ? process.argv[i + 1] : varsayilan;
};
const bayrak = ad => process.argv.includes('--' + ad);

const KAYNAK = arg('kaynak', null);
const EK = arg('ek', null);              // ayrı dosyadaki tek sprite (kamikaze drone)
const DENE = bayrak('dene');
const CIKTI = arg('cikti', path.join(ROOT, 'icons.png'));

/* SÜTUN SIRASI — js/UnitData.js roster sırasıyla BİREBİR aynı olmalı.
   Sıra bozulursa tank piyade ikonu alır; bu yüzden liste burada açıkça durur
   ve araç roster'la uyuşmazsa DURUR. */
const SUTUN_SIRASI = [
    'infantry', 'at_team', 'mortar_team', 'manpads_team', 'commando',
    'mbt', 'ifv', 'tank_destroyer', 'artillery',
    'mlrs', 'ballistic_missile', 'spaag', 'sam_battery',
    'attack_helo', 'transport_helo', 'recon_uav', 'armed_uav',
    'loitering_munition',
    'scout_vehicle', 'counter_battery_radar', 'ew_vehicle', 'medic',
    'engineer', 'supply_truck', 'command_vehicle'
];

const HUCRE = 320, PAD = 30, SUTUN = 25;
const GENIS = PAD + SUTUN * (HUCRE + PAD);      // 8780
const YUKSEK = PAD + HUCRE + PAD + HUCRE + PAD; // 730

app.whenReady().then(async () => {
    if (!KAYNAK) {
        console.log('HATA: --kaynak <tabaka.png> gerekli.');
        console.log('Kullanim: npm run sprite -- --kaynak assets/yeni-birimler.png --dene');
        app.exit(1); return;
    }
    for (const p of [KAYNAK, EK].filter(Boolean)) {
        if (!fs.existsSync(p)) { console.log('HATA: dosya yok -> ' + p); app.exit(1); return; }
    }

    // roster ile sutun sirasini DOGRULA
    const rosterKaynak = fs.readFileSync(path.join(ROOT, 'js', 'UnitData.js'), 'utf8');
    const roster = [];
    const re = /"id":\s*"([a-z_]+)",\s*"name":/g;
    let m; while ((m = re.exec(rosterKaynak))) roster.push(m[1]);
    const eksik = SUTUN_SIRASI.filter(id => !roster.includes(id));
    if (eksik.length) { console.log('HATA: roster\'da olmayan id: ' + eksik.join(', ')); app.exit(1); return; }
    console.log('roster ' + roster.length + ' birim · sutun listesi ' + SUTUN_SIRASI.length + ' · eslesme tamam');

    const win = new BrowserWindow({ width: 900, height: 600, show: false,
        webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true } });
    await win.loadURL('data:text/html,<html><body></body></html>');

    const b64 = p => fs.readFileSync(p).toString('base64');
    const girdi = {
        kaynak: 'data:image/png;base64,' + b64(KAYNAK),
        ek: EK ? ('data:image/png;base64,' + b64(EK)) : null,
        HUCRE, PAD, SUTUN, GENIS, YUKSEK, dene: DENE
    };

    const sonuc = await win.webContents.executeJavaScript(`(async (G) => {
        const yukle = src => new Promise((ok, no) => {
            const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('yuklenemedi')); im.src = src;
        });
        const tuval = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

        // ── 1) zemini saydamlastir: beyaza yakin ve doygunlugu dusuk pikseller ──
        const ayikla = (im) => {
            const c = tuval(im.width, im.height), x = c.getContext('2d');
            x.drawImage(im, 0, 0);
            const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
            for (let i = 0; i < p.length; i += 4) {
                const r = p[i], g = p[i+1], b = p[i+2];
                const enB = Math.max(r,g,b), enK = Math.min(r,g,b);
                if (enK > 228 && (enB - enK) < 22) p[i+3] = 0;
            }
            x.putImageData(d, 0, 0);
            return { c, x, d };
        };

        // ── 2) bagli bilesenler (once genislet ki tufek/anten govdeden kopmasin) ──
        const bloklar = (d, w, h) => {
            const a = new Uint8Array(w * h);
            for (let i = 0, j = 3; i < a.length; i++, j += 4) a[i] = d.data[j] > 8 ? 1 : 0;
            const R = 6, g = new Uint8Array(w * h);           // genisletme yaricapi
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                if (!a[y*w+x]) continue;
                for (let dy = -R; dy <= R; dy++) { const yy = y+dy; if (yy < 0 || yy >= h) continue;
                    for (let dx = -R; dx <= R; dx++) { const xx = x+dx; if (xx < 0 || xx >= w) continue; g[yy*w+xx] = 1; } }
            }
            const et = new Int32Array(w * h).fill(-1), kutular = [];
            const yig = new Int32Array(w * h);
            for (let s = 0; s < w*h; s++) {
                if (!g[s] || et[s] >= 0) continue;
                const id = kutular.length; let n = 0; yig[n++] = s; et[s] = id;
                let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, say = 0;
                while (n) {
                    const q = yig[--n], qx = q % w, qy = (q / w) | 0;
                    if (a[q]) { say++; if (qx<x0)x0=qx; if (qy<y0)y0=qy; if (qx>x1)x1=qx; if (qy>y1)y1=qy; }
                    for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
                        const nx=qx+dx, ny=qy+dy; if (nx<0||ny<0||nx>=w||ny>=h) continue;
                        const ns=ny*w+nx; if (g[ns] && et[ns]<0) { et[ns]=id; yig[n++]=ns; }
                    }
                }
                if (say > 220 && x1 >= x0) kutular.push({ x0, y0, x1, y1, say });
            }
            return kutular;
        };

        const im = await yukle(G.kaynak);
        const { c: kc, d: kd } = ayikla(im);
        let kutular = bloklar(kd, kc.width, kc.height);
        // satirlara ayir (y merkezine gore), her satiri x'e gore sirala
        kutular.forEach(k => { k.cy = (k.y0 + k.y1) / 2; k.h = k.y1 - k.y0; });
        const ortH = kutular.reduce((a,k)=>a+k.h,0) / Math.max(1, kutular.length);
        kutular.sort((a,b) => a.cy - b.cy);
        const satirlar = [];
        for (const k of kutular) {
            const s = satirlar.find(r => Math.abs(r.cy - k.cy) < ortH * 0.75);
            if (s) { s.uye.push(k); s.cy = s.uye.reduce((a,u)=>a+u.cy,0)/s.uye.length; }
            else satirlar.push({ cy: k.cy, uye: [k] });
        }
        satirlar.sort((a,b) => a.cy - b.cy);
        satirlar.forEach(r => r.uye.sort((a,b) => a.x0 - b.x0));
        const sirali = satirlar.flatMap(r => r.uye);

        const rapor = { kaynakOlcu: [im.width, im.height], bulunan: sirali.length,
            satirlar: satirlar.map(r => r.uye.length),
            kutular: sirali.map(k => [k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0]) };

        if (G.dene) return rapor;

        // ── 3) hedef tabakaya ciz ──
        const hed = tuval(G.GENIS, G.YUKSEK), hx = hed.getContext('2d');
        hx.imageSmoothingEnabled = false;
        const kirmiziYap = (kaynakTuval) => {
            const w = kaynakTuval.width, h = kaynakTuval.height;
            const t = tuval(w, h), c2 = t.getContext('2d');
            c2.drawImage(kaynakTuval, 0, 0);
            const dd = c2.getImageData(0, 0, w, h), p = dd.data;
            for (let i = 0; i < p.length; i += 4) {
                if (!p[i+3]) continue;
                const l = (p[i]*0.299 + p[i+1]*0.587 + p[i+2]*0.114) / 255;
                p[i]   = Math.min(255, Math.round(60 + l * 195));
                p[i+1] = Math.round(l * 74);
                p[i+2] = Math.round(l * 62);
            }
            c2.putImageData(dd, 0, 0);
            return t;
        };
        const cizHucre = (kaynakTuval, sx, sy, sw, sh, sutun) => {
            const kenar = 18, ic = G.HUCRE - kenar * 2;
            const o = Math.min(ic / sw, ic / sh);
            const dw = Math.round(sw * o), dh = Math.round(sh * o);
            const dx = G.PAD + sutun * (G.HUCRE + G.PAD) + Math.round((G.HUCRE - dw) / 2);
            for (const [satir, tuv] of [[0, kaynakTuval], [1, kirmiziYap(kaynakTuval)]]) {
                const dy = G.PAD + satir * (G.HUCRE + G.PAD) + Math.round((G.HUCRE - dh) / 2);
                hx.drawImage(tuv, sx, sy, sw, sh, dx, dy, dw, dh);
            }
        };

        // ana tabakadaki sprite'lar sirayla; --ek verilmisse 18. sutuna o girer
        let sutun = 0;
        const ekSutun = ${JSON.stringify(SUTUN_SIRASI.indexOf('loitering_munition'))};
        for (const k of sirali) {
            if (G.ek && sutun === ekSutun) sutun++;                 // yeri bos birak
            if (sutun >= G.SUTUN) break;
            cizHucre(kc, k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0, sutun);
            sutun++;
        }
        if (G.ek) {
            const eim = await yukle(G.ek);
            const { c: ec, d: ed } = ayikla(eim);
            const ek = bloklar(ed, ec.width, ec.height).sort((a,b) => b.say - a.say)[0];
            if (ek) cizHucre(ec, ek.x0, ek.y0, ek.x1 - ek.x0, ek.y1 - ek.y0, ekSutun);
            rapor.ekYerlesti = !!ek;
        }
        rapor.yazilanSutun = sutun;
        rapor.png = hed.toDataURL('image/png');
        return rapor;
    })(${JSON.stringify(girdi)})`);

    console.log('kaynak olcu      : ' + sonuc.kaynakOlcu.join('×'));
    console.log('bulunan sprite   : ' + sonuc.bulunan + '  (satirlar: ' + sonuc.satirlar.join(' + ') + ')');
    if (sonuc.bulunan !== SUTUN_SIRASI.length - (EK ? 1 : 0)) {
        console.log('UYARI: beklenen ' + (SUTUN_SIRASI.length - (EK ? 1 : 0)) + ', bulunan ' + sonuc.bulunan +
            ' — esleme kayabilir. Once --dene ile kutulari gozden gecir.');
    }
    console.log('');
    console.log('ESLEME (bulunan sira -> sutun -> birim):');
    let s = 0;
    const ekIdx = SUTUN_SIRASI.indexOf('loitering_munition');
    for (let i = 0; i < sonuc.bulunan; i++) {
        if (EK && s === ekIdx) s++;
        if (s >= SUTUN) break;
        const k = sonuc.kutular[i];
        console.log('  ' + String(i).padStart(2) + '  kutu ' + String(k[2]).padStart(4) + '×' + String(k[3]).padStart(4) +
            '  ->  sutun ' + String(s).padStart(2) + '  ' + SUTUN_SIRASI[s]);
        s++;
    }
    if (EK) console.log('  ek dosya           ->  sutun ' + ekIdx + '  loitering_munition');

    if (DENE) { console.log('\n--dene: icons.png DEGISMEDI.'); win.destroy(); app.exit(0); return; }

    const yedek = path.join(ROOT, 'icons.onceki.png');
    if (fs.existsSync(CIKTI) && !fs.existsSync(yedek)) fs.copyFileSync(CIKTI, yedek);
    fs.writeFileSync(CIKTI, Buffer.from(sonuc.png.split(',')[1], 'base64'));
    console.log('\nyazildi: ' + CIKTI + '  (yedek: icons.onceki.png)');
    console.log('olcu    : ' + GENIS + '×' + YUKSEK + ' — oyunun bekledigi bicim');
    win.destroy(); app.exit(0);
}).catch(e => { console.log('HATA: ' + e.message); app.exit(1); });
