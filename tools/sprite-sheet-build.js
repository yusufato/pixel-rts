// ═══════════════════════════════════════════════════════════════════════════
//  SPRITE SAYFASI ÜRETİCİ — yeni birim görsellerinden icons.png kurar
//  ---------------------------------------------------------------------------
//  Oyunun beklediği biçim (js/globals.js:333 ölçüldü):
//      hücre 320×320 · pad 30 · sütun = ROSTER İNDEKSİ (26 birim → 9130×730)
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
//    npm run sprite -- --kaynak art/birimler-kaynak.png --ek art/kamikaze-kaynak.png [--dene]
//    --dene  : icons.png'ye DOKUNMAZ, yalnız ne bulduğunu ve eşlemeyi yazar
//              (önce bununla çalıştır — yanlış eşleme yanlış ikon demektir)
//
//  Kaynak görseller `art/` altında durur, `assets/` altında DEĞİL: package.json
//  build.files `assets/**/*` içerdiği için orada dursalardı 1MB'lık kaynak
//  tabaka hiç kullanılmadan EXE'ye girerdi.
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

/* İKİ AYRI SIRA VAR — karıştırmak ilk sürümde hataya yol açtı, o yüzden
   burada açıkça ayrılmıştır:

   1) OKUMA SIRASI (aşağıdaki liste): kaynak tabakadaki sprite'lar soldan sağa,
      yukarıdan aşağıya hangi birime karşılık geliyor. Bu GÖRSEL bir olgudur,
      kullanıcı doğrulamıştır.

   2) SÜTUN NUMARASI: motor `sx = 30 + type × 350` diyor, yani sütun = birimin
      ROSTER İNDEKSİDİR (js/UnitData.js). Bu liste DEĞİL, roster belirler.

   İlk sürüm ikisini tek liste sanmıştı: radar 11. sıradayken 19. sütuna
   yazılacaktı — SPAAG, SAM ve helikopterler kaymış olurdu. */
const OKUMA_SIRASI = [
    // 1. satır (9)
    'infantry', 'at_team', 'mortar_team', 'manpads_team', 'commando',
    'mbt', 'ifv', 'tank_destroyer', 'artillery',
    // 2. satır (8)
    'mlrs', 'ballistic_missile', 'spaag', 'sam_battery',
    'attack_helo', 'transport_helo', 'recon_uav', 'armed_uav',
    // 3. satır (8)
    'drone_operator', 'scout_vehicle', 'counter_battery_radar', 'ew_vehicle',
    'medic', 'engineer', 'supply_truck', 'command_vehicle'
];
const EK_BIRIM = 'loitering_munition';   // ayrı dosyadan gelen kamikaze drone

const HUCRE = 320, PAD = 30;
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

    // SÜTUN = ROSTER İNDEKSİ. Roster tek doğruluk kaynağıdır.
    const rosterKaynak = fs.readFileSync(path.join(ROOT, 'js', 'UnitData.js'), 'utf8');
    const roster = [];
    const re = /"id":\s*"([a-z_]+)",\s*"name":/g;
    let m; while ((m = re.exec(rosterKaynak))) roster.push(m[1]);
    if (!roster.length) { console.log('HATA: roster okunamadi (js/UnitData.js).'); app.exit(1); return; }

    const beklenen = OKUMA_SIRASI.concat(EK ? [EK_BIRIM] : []);
    const eksik = beklenen.filter(id => !roster.includes(id));
    if (eksik.length) { console.log('HATA: roster\'da olmayan id: ' + eksik.join(', ')); app.exit(1); return; }
    const kapsanmayan = roster.filter(id => !beklenen.includes(id));
    if (kapsanmayan.length) {
        console.log('UYARI: gorseli olmayan birim (bos ikon olur): ' + kapsanmayan.join(', '));
    }
    const SUTUN = roster.length;                      // 26
    const GENIS = PAD + SUTUN * (HUCRE + PAD);        // 9130
    console.log('roster ' + roster.length + ' birim · okuma sirasi ' + OKUMA_SIRASI.length +
        (EK ? ' + ek 1' : '') + ' · tabaka ' + GENIS + '×' + YUKSEK);

    const win = new BrowserWindow({ width: 900, height: 600, show: false,
        webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true } });
    await win.loadURL('data:text/html,<html><body></body></html>');

    const b64 = p => fs.readFileSync(p).toString('base64');
    const sutunlar = OKUMA_SIRASI.map(id => roster.indexOf(id));
    const ekSutun = EK ? roster.indexOf(EK_BIRIM) : -1;
    const girdi = {
        kaynak: 'data:image/png;base64,' + b64(KAYNAK),
        ek: EK ? ('data:image/png;base64,' + b64(EK)) : null,
        HUCRE, PAD, SUTUN, GENIS, YUKSEK, dene: DENE, sutunlar, ekSutun
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
            /* YOZLASMIS BLOK SUZGECI. Kaynak gorselin ust kenarinda 233×0'lik bir
               siyah cubuk vardi; piksel sayisi esigi (220) onu gecirdi ve TUM
               esleme bir kaydi (spaag 12'ye, drone_operator 25'e). Esik sabit
               degil: kutu boyutlarinin MEDYANINA gore, boylece farkli olcekli
               kaynaklarda da calisir. */
            if (kutular.length > 2) {
                const med = dizi => { const s = dizi.slice().sort((a,b)=>a-b); return s[s.length >> 1]; };
                const mw = med(kutular.map(k => k.x1 - k.x0));
                const mh = med(kutular.map(k => k.y1 - k.y0));
                const ayikli = kutular.filter(k =>
                    (k.x1 - k.x0) >= mw * 0.2 && (k.y1 - k.y0) >= mh * 0.2);
                if (ayikli.length) return ayikli;
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

        /* Okuma sirasindaki her sprite, KENDI biriminin ROSTER SUTUNUNA yazilir.
           i'inci sprite i'inci sutuna DEGIL — bu ayrim ilk surumdeki hataydi. */
        const yazilan = [];
        for (let i = 0; i < sirali.length && i < G.sutunlar.length; i++) {
            const k = sirali[i], hedefSutun = G.sutunlar[i];
            if (hedefSutun == null || hedefSutun < 0) continue;
            cizHucre(kc, k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0, hedefSutun);
            yazilan.push(hedefSutun);
        }
        if (G.ek && G.ekSutun >= 0) {
            const eim = await yukle(G.ek);
            const { c: ec, d: ed } = ayikla(eim);
            const ek = bloklar(ed, ec.width, ec.height).sort((a,b) => b.say - a.say)[0];
            if (ek) { cizHucre(ec, ek.x0, ek.y0, ek.x1 - ek.x0, ek.y1 - ek.y0, G.ekSutun); yazilan.push(G.ekSutun); }
            rapor.ekYerlesti = !!ek;
        }
        rapor.yazilanSutun = yazilan.length;
        rapor.bosSutun = Array.from({length: G.SUTUN}, (_, i) => i).filter(i => !yazilan.includes(i));
        rapor.png = hed.toDataURL('image/png');
        return rapor;
    })(${JSON.stringify(girdi)})`);

    console.log('kaynak olcu      : ' + sonuc.kaynakOlcu.join('×'));
    console.log('bulunan sprite   : ' + sonuc.bulunan + '  (satirlar: ' + sonuc.satirlar.join(' + ') + ')');
    if (sonuc.bulunan !== OKUMA_SIRASI.length) {
        console.log('UYARI: okuma sirasi ' + OKUMA_SIRASI.length + ' birim bekliyor, ' + sonuc.bulunan +
            ' sprite bulundu — ESLEME KAYAR. Kutulari asagida gozden gecir, gerekirse');
        console.log('       kaynak gorseldeki bosluklari/artefaktlari temizle ve tekrar dene.');
    }
    console.log('');
    console.log('ESLEME (okuma sirasi -> birim -> roster sutunu):');
    for (let i = 0; i < sonuc.bulunan && i < OKUMA_SIRASI.length; i++) {
        const k = sonuc.kutular[i], id = OKUMA_SIRASI[i];
        console.log('  ' + String(i).padStart(2) + '  kutu ' + String(k[2]).padStart(4) + '×' + String(k[3]).padStart(4) +
            '  ->  ' + id.padEnd(24) + 'sutun ' + String(roster.indexOf(id)).padStart(2));
    }
    if (EK) console.log('  ek dosya              ->  ' + EK_BIRIM.padEnd(24) + 'sutun ' + roster.indexOf(EK_BIRIM));
    if (sonuc.bosSutun && sonuc.bosSutun.length) {
        console.log('  BOS KALAN SUTUN: ' + sonuc.bosSutun.map(i => i + ' (' + roster[i] + ')').join(', '));
    }

    if (DENE) { console.log('\n--dene: icons.png DEGISMEDI.'); win.destroy(); app.exit(0); return; }

    const yedek = path.join(ROOT, 'icons.onceki.png');
    if (fs.existsSync(CIKTI) && !fs.existsSync(yedek)) fs.copyFileSync(CIKTI, yedek);
    fs.writeFileSync(CIKTI, Buffer.from(sonuc.png.split(',')[1], 'base64'));
    console.log('\nyazildi: ' + CIKTI + '  (yedek: icons.onceki.png)');
    console.log("olcu    : " + GENIS + "×" + YUKSEK + "  (" + SUTUN + " sutun)");
    win.destroy(); app.exit(0);
}).catch(e => { console.log('HATA: ' + e.message); app.exit(1); });
