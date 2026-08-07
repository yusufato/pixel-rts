'use strict';

// Pixel RTS'nin gerçek Electron renderer'ını CDP üzerinden dolaşan küçük QA
// yardımcısı. Oyuna kod enjekte etmez; görünür DOM'a gerçek fare/klavye olayı
// yollar ve renderer'ın kendi ürettiği ekran görüntüsünü kaydeder.

const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PIXEL_UI_AUDIT_PORT || 9333);
const command = process.argv[2];
const args = process.argv.slice(3);

async function target() {
    const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    if (!response.ok) throw new Error(`CDP hedef listesi okunamadı: HTTP ${response.status}`);
    const targets = await response.json();
    const pages = Array.isArray(targets) ? targets : [targets];
    const page = pages.find(item => item.type === 'page' && /pixel-rts[\\/]index\.html/i.test(item.url || ''))
        || pages.find(item => item.type === 'page');
    if (!page || !page.webSocketDebuggerUrl) throw new Error('Pixel RTS renderer hedefi bulunamadı.');
    return page;
}

async function connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });
    let id = 0;
    const pending = new Map();
    socket.addEventListener('message', event => {
        const message = JSON.parse(String(event.data));
        if (!message.id || !pending.has(message.id)) return;
        const entry = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) entry.reject(new Error(`${message.error.code}: ${message.error.message}`));
        else entry.resolve(message.result || {});
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const messageId = ++id;
        pending.set(messageId, { resolve, reject });
        socket.send(JSON.stringify({ id: messageId, method, params }));
    });
    return { socket, send };
}

async function evaluate(send, expression) {
    const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true
    });
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Renderer evaluate hatası');
    }
    return result.result ? result.result.value : undefined;
}

async function nodeCenter(send, selector) {
    // Hikâye panelleri içeriklerini sık sık yeniden oluşturuyor. DOM nodeId ile
    // iki ayrı CDP çağrısı yapmak, arada render olursa "node not found" verir.
    // Dikdörtgeni renderer içinde tek atomik değerlendirmede al.
    const point = await evaluate(send, `(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) return null;
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    if (!point) throw new Error(`Görünür hedef bulunamadı: ${selector}`);
    return point;
}

async function main() {
    if (!command) throw new Error('Kullanım: ui-audit-cdp.js <state|eval|viewport|screenshot|click|hover|key> ...');
    const page = await target();
    const { socket, send } = await connect(page.webSocketDebuggerUrl);
    try {
        await send('Runtime.enable');
        await send('Page.enable');
        await send('DOM.enable');
        if (command === 'state') {
            console.log(JSON.stringify(await evaluate(send, `({
                title: document.title,
                screen: document.body.dataset.screen || null,
                phase: document.body.dataset.phase || null,
                viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
                visibleScreens: [...document.querySelectorAll('.app-screen:not(.hidden), .wr-screen:not(.hidden)')].map(node => node.id),
                openPanels: [...document.querySelectorAll('aside.open, [role="dialog"]:not(.hidden)')].map(node => node.id)
            })`), null, 2));
        } else if (command === 'eval') {
            console.log(JSON.stringify(await evaluate(send, args.join(' ')), null, 2));
        } else if (command === 'viewport') {
            const width = Math.max(320, Number(args[0]) || 1440);
            const height = Math.max(320, Number(args[1]) || 900);
            await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
            await new Promise(resolve => setTimeout(resolve, 250));
            console.log(JSON.stringify({ width, height }));
        } else if (command === 'screenshot') {
            const output = path.resolve(args[0] || 'qa-runtime/ui-audit/screenshot.png');
            fs.mkdirSync(path.dirname(output), { recursive: true });
            const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
            fs.writeFileSync(output, Buffer.from(shot.data, 'base64'));
            console.log(output);
        } else if (command === 'click' || command === 'hover') {
            await send('Page.bringToFront');
            const point = await nodeCenter(send, args[0]);
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
            if (command === 'click') {
                await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
                await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
            }
            await new Promise(resolve => setTimeout(resolve, 300));
            console.log(JSON.stringify(point));
        } else if (command === 'key') {
            const key = args[0] || 'Escape';
            await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key });
            await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key });
            await new Promise(resolve => setTimeout(resolve, 200));
            console.log(key);
        } else {
            throw new Error(`Bilinmeyen komut: ${command}`);
        }
    } finally {
        socket.close();
    }
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
