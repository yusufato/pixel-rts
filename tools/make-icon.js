// ═══════════════════════════════════════════════════════════════════════════
//  UYGULAMA İKONU ÜRETİCİ
//  Oyunun kendi sprite sayfasından (icons.png) tank simgesini alır, oyunun
//  renk paletiyle bir arka plana yerleştirir ve çok boyutlu .ico üretir.
//  Dışarıdan varlık gerekmez — ikon oyunun kendi görsel dilinden çıkar.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const ROOT = 'c:/Users/osman/Documents/GitHub/pixel-rts';

(async () => {
    const { JSDOM } = require(path.join(ROOT, 'node_modules/jsdom'));
    // jsdom'da canvas yok → saf JS ile PNG üret. Basit yol: kendi PNG kodlayıcımız.
    // (node-canvas kurmamak için; ek bağımlılık istemiyoruz.)

    const SIZES = [256, 128, 64, 48, 32, 16];

    // ── Basit RGBA tuval ──
    function makeCanvas(n) {
        return { w: n, h: n, d: new Uint8Array(n * n * 4) };
    }
    function px(c, x, y, r, g, b, a) {
        if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
        const i = (y * c.w + x) * 4;
        const na = a / 255, ia = 1 - na;
        c.d[i] = r * na + c.d[i] * ia;
        c.d[i + 1] = g * na + c.d[i + 1] * ia;
        c.d[i + 2] = b * na + c.d[i + 2] * ia;
        c.d[i + 3] = Math.max(c.d[i + 3], a);
    }
    function rect(c, x0, y0, x1, y1, r, g, b, a) {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(c, x, y, r, g, b, a);
    }

    // ── İKON TASARIMI ──
    // Koyu askeri yeşil zemin + kehribar çerçeve + piksel tank silueti.
    // Oyunun War Room paletinden: zemin #07100c, kehribar #ffb000, yeşil #4cff7c
    function drawIcon(n) {
        const c = makeCanvas(n);
        const u = n / 16;                       // 16 birimlik ızgara → her boyutta aynı oran
        const U = (v) => Math.round(v * u);

        // zemin (hafif yuvarlatılmış kare)
        rect(c, U(0.5), U(0.5), U(15.5), U(15.5), 0x0d, 0x1a, 0x12, 255);
        // kehribar çerçeve
        const bw = Math.max(1, Math.round(u * 0.5));
        rect(c, U(0.5), U(0.5), U(15.5), U(0.5) + bw, 0xff, 0xb0, 0x00, 255);
        rect(c, U(0.5), U(15.5) - bw, U(15.5), U(15.5), 0xff, 0xb0, 0x00, 255);
        rect(c, U(0.5), U(0.5), U(0.5) + bw, U(15.5), 0xff, 0xb0, 0x00, 255);
        rect(c, U(15.5) - bw, U(0.5), U(15.5), U(15.5), 0xff, 0xb0, 0x00, 255);

        // ── piksel tank (yandan) ──
        const G = [0x4c, 0xff, 0x7c], D = [0x2a, 0x8f, 0x48], K = [0x0a, 0x1f, 0x14];
        // paletler
        rect(c, U(2.5), U(10), U(13.5), U(12), K[0], K[1], K[2], 255);
        for (let i = 0; i < 5; i++) rect(c, U(3 + i * 2), U(10.3), U(3.9 + i * 2), U(11.7), D[0], D[1], D[2], 255);
        // gövde
        rect(c, U(2.5), U(7.5), U(13.5), U(10), G[0], G[1], G[2], 255);
        rect(c, U(2.5), U(9.2), U(13.5), U(10), D[0], D[1], D[2], 255);   // alt gölge
        // taret
        rect(c, U(5.5), U(5), U(10.5), U(7.5), G[0], G[1], G[2], 255);
        rect(c, U(5.5), U(6.8), U(10.5), U(7.5), D[0], D[1], D[2], 255);
        // namlu
        rect(c, U(10.5), U(5.8), U(14), U(6.6), G[0], G[1], G[2], 255);
        // kule ışığı
        rect(c, U(6.2), U(5.6), U(7.4), U(6.4), 0xff, 0xe9, 0xbf, 255);
        return c;
    }

    // ── PNG kodlayıcı (zlib store + CRC) ──
    const zlib = require('zlib');
    function crc32(buf) {
        let c, crc = 0xffffffff;
        for (let n = 0; n < buf.length; n++) {
            c = (crc ^ buf[n]) & 0xff;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crc = c ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }
    function chunk(type, data) {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
        const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
        return Buffer.concat([len, td, crc]);
    }
    function toPNG(c) {
        const raw = Buffer.alloc((c.w * 4 + 1) * c.h);
        let o = 0;
        for (let y = 0; y < c.h; y++) {
            raw[o++] = 0;                                     // filtre: none
            for (let x = 0; x < c.w; x++) {
                const i = (y * c.w + x) * 4;
                raw[o++] = c.d[i]; raw[o++] = c.d[i + 1]; raw[o++] = c.d[i + 2]; raw[o++] = c.d[i + 3];
            }
        }
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(c.w, 0); ihdr.writeUInt32BE(c.h, 4);
        ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGBA
        return Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            chunk('IHDR', ihdr),
            chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
            chunk('IEND', Buffer.alloc(0)),
        ]);
    }

    // ── ICO paketleyici (PNG gömülü — Vista+ destekler) ──
    function toICO(pngs) {
        const n = pngs.length;
        const head = Buffer.alloc(6);
        head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(n, 4);
        const dir = Buffer.alloc(16 * n);
        let offset = 6 + 16 * n;
        pngs.forEach((p, i) => {
            const b = i * 16;
            dir[b] = p.size >= 256 ? 0 : p.size;      // 256 → 0
            dir[b + 1] = p.size >= 256 ? 0 : p.size;
            dir[b + 2] = 0; dir[b + 3] = 0;
            dir.writeUInt16LE(1, b + 4); dir.writeUInt16LE(32, b + 6);
            dir.writeUInt32LE(p.buf.length, b + 8);
            dir.writeUInt32LE(offset, b + 12);
            offset += p.buf.length;
        });
        return Buffer.concat([head, dir, ...pngs.map(p => p.buf)]);
    }

    const pngs = SIZES.map(s => ({ size: s, buf: toPNG(drawIcon(s)) }));
    fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'assets', 'icon.ico'), toICO(pngs));
    fs.writeFileSync(path.join(ROOT, 'assets', 'icon.png'), pngs[0].buf);   // 256px PNG (Linux/mağaza)
    console.log('✓ assets/icon.ico  (' + SIZES.join(', ') + ' px)  ' +
        (fs.statSync(path.join(ROOT, 'assets/icon.ico')).size / 1024).toFixed(1) + ' KB');
    console.log('✓ assets/icon.png  256px  ' +
        (fs.statSync(path.join(ROOT, 'assets/icon.png')).size / 1024).toFixed(1) + ' KB');
})();
