/* ═══════════════════════════════════════════════════════════════════════════
   MİNİ DOM — muharebe zincirinin ihtiyacı kadar DOM, İKİ YERDE kullanılır

   1) Node tezgâhı (`tools/mini-dom.js` bunu yeniden dışa verir) — `--minidom` kipi
   2) TARAYICI WORKER'ı (`js/lookahead-worker.js`) — Worker'da DOM YOKTUR ama muharebe
      zinciri `document.getElementById`, canvas `getContext` vb. çağırıyor

   ⚠ NEDEN TEK DOSYA: iki ayrı shim yazmak, "worker ana iş parçacığından farklı
   davranıyor" sınıfından, bulunması çok zor hatalar üretir. Shim tek kopya olmalı;
   `tools/mini-dom.js` artık yalnız bunu yeniden dışa veriyor.

   ⚠ PAKETLEME: `package.json` `build.files` yalnız `js/**` içeriyor, `tools/**` DEĞİL.
   Shim `js/` altında olmak ZORUNDA, yoksa EXE'de worker yüklenemez.

   ⚠ ANA SAYFADA YÜKLENMEZ: `index.html` bu dosyayı ÇAĞIRMAZ. Yüklenirse gerçek
   `document`'ı gölgelemeye çalışır. Aşağıdaki kurulum yalnız Worker bağlamında
   (document YOK + importScripts VAR) çalışır.

   ── Node tezgâhında ölçülmüş NEGATİF sonuç (tekrar denenmesin diye kayıtta):
      mini-DOM : zirve 348MB, 12 maç 147sn   ·   jsdom : zirve 338MB, 12 maç 40sn
      Sonuçlar birebir aynıydı (kod doğru) ama 3.6 KAT yavaş — çünkü
      `vm.createContext(düz nesne)` her global erişimi yavaşlatıyor.
      WORKER'DA BU SORUN YOK: orada vm yok, globaller gerçek global nesnede.
   ═══════════════════════════════════════════════════════════════════════════ */

function sahteContext(canvas) {
    const bos = () => {};
    return new Proxy({
        canvas,
        measureText: t => ({ width: String(t || '').length * 8 }),
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)) }),
        getImageData: (_x, _y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)) }),
        createLinearGradient: () => ({ addColorStop: bos }),
        createRadialGradient: () => ({ addColorStop: bos }),
        createPattern: () => null,
        getContextAttributes: () => ({ alpha: true })
    }, { get: (t, p) => (p in t ? t[p] : bos), set: (t, p, v) => { t[p] = v; return true; } });
}

// Her eleman bir Proxy: bilinmeyen özellik okunursa no-op fonksiyon, yazılırsa saklanır.
// Böylece oyun kodu style/classList/dataset/innerHTML ne kullanırsa kullansın patlamaz.
function eleman(etiket, belge) {
    const bos = () => {};
    const cocuklar = [];
    const hedef = {
        tagName: String(etiket || 'div').toUpperCase(),
        nodeName: String(etiket || 'div').toUpperCase(),
        id: '', className: '', textContent: '', innerHTML: '', value: '',
        width: 0, height: 0, offsetWidth: 0, offsetHeight: 0,
        clientWidth: 0, clientHeight: 0, checked: false, disabled: false,
        style: new Proxy({}, { get: (t, p) => (p in t ? t[p] : ''), set: (t, p, v) => { t[p] = v; return true; } }),
        dataset: {},
        children: cocuklar, childNodes: cocuklar,
        classList: { add: bos, remove: bos, toggle: bos, contains: () => false },
        appendChild: (c) => { cocuklar.push(c); return c; },
        removeChild: (c) => { const i = cocuklar.indexOf(c); if (i >= 0) cocuklar.splice(i, 1); return c; },
        insertBefore: (c) => { cocuklar.push(c); return c; },
        remove: bos, addEventListener: bos, removeEventListener: bos, dispatchEvent: () => true,
        setAttribute: bos, removeAttribute: bos, getAttribute: () => null, hasAttribute: () => false,
        getBoundingClientRect: () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
        focus: bos, blur: bos, click: bos, scrollIntoView: bos,
        querySelector: () => null, querySelectorAll: () => [],
        // getContext HER elemanda tanımlı: id'den tür tahmini güvenilmez (ör. 'minimap'
        // adında "canvas" geçmiyor ama canvas'tır). Sahte bağlam zararsız, eksik olması
        // ise "getContext is not a function" ile yükleme çökertiyordu.
        getContext() { return sahteContext(this); },
        toDataURL: () => 'data:,',
        appendData: bos, cloneNode() { return eleman(etiket, belge); }
    };
    if (hedef.tagName === 'CANVAS' || hedef.tagName === 'IMG') { hedef.width = 1024; hedef.height = 768; }
    return new Proxy(hedef, {
        get: (t, p) => {
            if (p in t) return t[p];
            if (typeof p === 'symbol') return undefined;
            return bos;                      // bilinmeyen metot → no-op
        },
        set: (t, p, v) => { t[p] = v; return true; }
    });
}

// Muharebe kodunun dokunduğu id'ler ÖNCEDEN oluşturulmaz: istenen id yoksa üretilir.
// index.html'de hepsi var, dolayısıyla üretmek null döndürmekten Electron'a daha yakın.
function belgeKur() {
    const kayit = new Map();
    const uretilen = new Set();
    const belge = {};
    const yap = (etiket) => eleman(etiket, belge);
    belge.createElement = yap;
    belge.createElementNS = (_ns, etiket) => yap(etiket);
    belge.createTextNode = (t) => ({ nodeValue: t, textContent: t });
    belge.documentElement = yap('html');
    belge.body = yap('body');
    belge.head = yap('head');
    belge.readyState = 'complete';
    belge.addEventListener = () => {};
    belge.removeEventListener = () => {};
    belge.getElementById = (id) => {
        const ad = String(id);
        if (kayit.has(ad)) return kayit.get(ad);
        const tur = /canvas/i.test(ad) ? 'canvas' : (/sprite|image|img|sheet/i.test(ad) ? 'img' : 'div');
        const el = yap(tur);
        el.id = ad;
        kayit.set(ad, el);
        uretilen.add(ad + ':' + tur);
        return el;
    };
    belge.querySelector = (sec) => {
        const m = /^#([\w-]+)$/.exec(String(sec));
        return m ? belge.getElementById(m[1]) : null;
    };
    belge.querySelectorAll = () => [];
    belge.getElementsByTagName = () => [];
    belge.getElementsByClassName = () => [];
    belge.__uretilenDugumler = uretilen;
    return belge;
}

// vm bağlamı için global nesne (window === globalThis)
function pencereKur() {
    const bos = () => {};
    const depo = new Map();
    const belge = belgeKur();
    class SahteImage {
        constructor() { this.width = 1; this.height = 1; this.complete = true; }
        set src(v) { this._src = v; if (typeof this.onload === 'function') this.onload(); }
        get src() { return this._src; }
        addEventListener(tip, fn) { if (tip === 'load') fn(); }
        removeEventListener() {}
    }
    const g = {
        document: belge,
        navigator: { userAgent: 'mini-dom', language: 'tr-TR', hardwareConcurrency: 4 },
        location: { href: 'https://pixel-rts.invalid/', search: '', hash: '', protocol: 'https:' },
        Image: SahteImage,
        HTMLCanvasElement: function () {},
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: bos,
        setTimeout, clearTimeout, setInterval, clearInterval,
        queueMicrotask,
        performance: { now: () => 0, memory: { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 } },
        console,
        alert: bos, confirm: () => false, prompt: () => null,
        addEventListener: bos, removeEventListener: bos, dispatchEvent: () => true,
        matchMedia: () => ({ matches: false, addListener: bos, addEventListener: bos, removeEventListener: bos }),
        fetch: () => Promise.reject(new Error('tezgahta ag YOK')),
        localStorage: {
            getItem: k => (depo.has(String(k)) ? depo.get(String(k)) : null),
            setItem: (k, v) => { depo.set(String(k), String(v)); },
            removeItem: k => { depo.delete(String(k)); }, clear: () => depo.clear()
        },
        devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900,
        // Node yerleşikleri — oyun kodu bunları global bekliyor
        Math, JSON, Date, Array, Object, Number, String, Boolean, RegExp, Error,
        Map, Set, WeakMap, WeakSet, Promise, Symbol, Proxy, Reflect, BigInt,
        Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array,
        Int8Array, Int16Array, Int32Array, Float32Array, Float64Array,
        ArrayBuffer, DataView, isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
        structuredClone: (x) => JSON.parse(JSON.stringify(x))
    };
    g.window = g;
    g.globalThis = g;
    g.self = g;
    g.top = g;
    return g;
}

/* ── WORKER KURULUMU: shim'i gerçek global nesneye yaz ─────────────────────
   Node'da `pencereKur()` bir NESNE döndürür ve vm bağlamı olur. Worker'da böyle bir
   dolaylılık yok — eksik globaller doğrudan `self` üzerine yazılır. Zaten var olanlara
   (Math, JSON, setTimeout, console, performance...) DOKUNULMAZ. */
function miniDomKurWorker(hedef) {
    const g = pencereKur();
    for (const k of Object.keys(g)) {
        if (k === 'window' || k === 'globalThis' || k === 'self' || k === 'top') continue;
        if (k in hedef) continue;              // Worker'ın kendi gerçek API'sini EZME
        try { hedef[k] = g[k]; } catch (e) { /* salt-okunur global: atla */ }
    }
    // `document` Worker'da yoktur → her hâlükârda kurulur
    hedef.document = g.document;
    hedef.window = hedef;
    return hedef;
}

// TARAYICI WORKER'ı: document YOK + importScripts VAR → kendiliğinden kur.
// Ana sayfada `document` vardır → kurulum ÇALIŞMAZ (gerçek DOM korunur).
// Node'da `importScripts` yoktur → kurulum ÇALIŞMAZ (yalnız dışa verir).
if (typeof document === 'undefined' && typeof importScripts === 'function' && typeof self !== 'undefined') {
    miniDomKurWorker(self);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { pencereKur, sahteContext, belgeKur, miniDomKurWorker };
}
