/* ═══════════════════════════════════════════════════════════════════════════
   MOCKUP LABORATUVAR ÇALIŞMA ZAMANI  —  OYUNA TAŞINMAZ
   ═══════════════════════════════════════════════════════════════════════════
   Görevleri:
     1. Viewport çerçevesi   — 916×572 / 1280×800 / 1903×974 (design-qa.md:9, :58)
     2. Katman anahtarı      — A (bilgi mimarisi) / B (görsel dil)
     3. Redline pinleri      — data-kusur="2,3" → numaralı rozet + lejant
     4. Kapsama kapısı       — bu yüzeye ait her kusur numarası sahnede var mı
     5. Taşma kapısı         — üç viewport'ta da yatay taşma sıfır mı
     6. CRT yoğunluk kaydırıcısı — design-qa.md:36'daki tek açık P3 bulgusu
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    /* ── KUSUR DEFTERİ — TEK KAYNAK ────────────────────────────────────────
       Lejant tablosu, pin tooltip'leri ve kapsama kapısı hep buradan okur.
       Her satır: numara → { y: yüzey, k: katman, t: başlık, kod: kanıt yeri }
       Kanıt yerleri gerçek dosya:satır referanslarıdır; iddia değil ölçüm. */
    var KUSURLAR = {
        /* ── 02 SAVAŞ HUD — Katman A (yapısal) ──────────────────────────── */
        1: { y: '02', k: 'a', t: 'Seçili birim özeti hiç görünmüyor; çoklu seçim durumu yok',
             kod: 'js/main.js:976-989 her karede yazıyor · style.css:1834-1836 display:none !important · js/WarRoomUI.js:321 daima tek birim' },
        2: { y: '02', k: 'a', t: 'PARAŞÜT butonu cooldown/bütçe yetersizken sessizce hiçbir şey yapmıyor',
             kod: 'js/WarRoomUI.js:283 gizli butona .click() · js/main.js:348 erken return · js/main.js:991-994 cooldown gizli panele yazılıyor' },
        3: { y: '02', k: 'a', t: 'Komut geri bildirimi yok: tıklama işareti, hedef onayı, ses yok',
             kod: 'js/main.js:186-333 sağ tık tek kanal · js/WarRoomUI.js:360 yalnız eksen çizgisi' },
        4: { y: '02', k: 'a', t: 'Kısayol etiketleri butonlarda görünmüyor; kontrol grubu (Ctrl+1..9) hiç yok',
             kod: 'js/main.js:771-801 M/U/Esc bağlı ama etiketsiz' },
        5: { y: '02', k: 'a', t: 'Savaşta spawn bar kalıntı olarak yer kaplıyor (üretim yok)',
             kod: 'js/main.js:665-666 opacity .3 + pointerEvents none' },
        6: { y: '02', k: 'a', t: 'Kamera ipucu yalnız startBattle yolunda gizleniyor → rematch/MP\'de panel altına giriyor',
             kod: 'js/main.js:667 JS ile gizleniyor, CSS savaş-fazı kuralı yok' },
        7: { y: '02', k: 'a', t: 'Muharebe kaydı aria-live taşımıyor',
             kod: 'index.html:434 · yalnız #battle-target-card aria-live taşıyor' },
        /* ── 02 SAVAŞ HUD — Katman B (görsel) ───────────────────────────── */
        8: { y: '02', k: 'b', t: 'Legacy kalıntılar: .spawn-cat HİÇ ezilmemiş (yeşil), savaşta .spawn-btn:hover mavi, kamera ipucu savaşta token\'sız',
             kod: 'style.css:235-237 .spawn-cat rgba(120,200,140,.35)/12px/r5 — war-room override YOK · :277 hover rgba(60,140,255,.3) savaşta geçerli · :130-142 ipucu 7px/#888, yalnız :1777 deploy\'da ezilmiş' },
        9: { y: '02', k: 'b', t: 'Duraklatma modalı ve öğrenme bildirimi tamamen inline stil; modalın KENDİ İÇİNDE iki font var',
             kod: 'js/main.js:727-739 inline #12161c/r12, başlık font-family:inherit→Press Start 2P ama butonlarda font-family YOK→sistem sans · js/main.js:761-763 bildirim #8ecbff/14px system-ui/z-index 99999 · gerçek çekim: qa-runtime/mockup-baseline/kusur-09-duraklatma-modali.png' },
        10: { y: '02', k: 'b', t: '7-9px yazı boyutları — HUD\'un yarısı okunamıyor',
              kod: 'style.css:1845 8px · :1870 7px · :1884 9px · :1893 7px' },
        11: { y: '02', k: 'b', t: ':focus-visible hover ile birebir aynı → klavye odağı görünmüyor',
              kod: 'style.css:1877-1878, 1887-1888' },
        12: { y: '02', k: 'b', t: 'Yetim CSS: #train-ai-btn ve #ai-training-screen HTML/JS\'te yok',
              kod: 'style.css:188-218, :404' },
        13: { y: '02', k: 'b', t: 'CRT yoğunluğu bazı arazi tohumlarında fazla parlak (tek açık P3)',
              kod: 'design-qa.md:36' },
        /* ── 03 HİKAYE DÜNYASI — Katman A ───────────────────────────────── */
        14: { y: '03', k: 'a', t: 'Rol seçimi navigasyonu süzmüyor: 8 düğme + 7 drawer + 3 modal herkese aynı',
              kod: 'MODERN_DUNYA_EKSIKLERI.md MW-014 / MW-020 · index.html:230 sabit 8 araç' },
        15: { y: '03', k: 'a', t: 'Gündem yalnız yönlendiriyor, karar verdirmiyor',
              kod: 'js/StoryUI.js:237-251 storyAgendaNavigate yalnız panel açıyor · MW-003' },
        16: { y: '03', k: 'a', t: 'AKIŞ son 6 kayıtla sınırlı; oyuncu geriye dönüp okuyamıyor',
              kod: 'js/Story.js:124 log.length > 6 kırpılıyor · gazete 30 kayıt' },
        17: { y: '03', k: 'a', t: 'Uzun aday listelerinde arama/filtre yok (ilk 8 gösteriliyor, 25 var)',
              kod: 'HIKAYE_MODU_UYGULAMA_DURUMU.md Faz 38.1 açık borç' },
        18: { y: '03', k: 'a', t: '"NEDEN DEĞİŞTİ?" neden-izi bazı alanlarda yok (diplomasi, sadakat, itibar, kuyruk, ordu)',
              kod: 'HIKAYE_MODU_UYGULAMA_DURUMU.md:271-298 kapsam sınırı' },
        /* ── 03 HİKAYE DÜNYASI — Katman B ───────────────────────────────── */
        19: { y: '03', k: 'b', t: 'Eski mavi hikaye bloğu duruyor; #story-hud/#story-news/#story-tools İKİ KEZ tanımlı',
              kod: 'style.css:1005-1185 eski · :1181+ war-room ezmesi' },
        24: { y: '03', k: 'a', t: 'Komuta çubuğu kaynak çipleri kutuyu taşırıp başlığın üstüne akıyor (1650px altındaki HER masaüstü genişliğinde)',
              kod: 'style.css:1206 #story-stats justify-content:flex-end + overflow yok · :1207 .story-stat-chip min-width:92px · ÖLÇÜLDÜ (9 çip, içerik 1070px): 1100→549px taşma · 1280→369px · 1440→209px · 1600→49px · kanıt qa-runtime/mockup-baseline/kusur-16-akis-sekmesi.png' },
        /* ── 04 GÖRÜŞME ─────────────────────────────────────────────────── */
        20: { y: '04', k: 'a', t: 'İlişki merceği yok: geçmiş/borç/verilen söz zinciri tek yerde görünmüyor',
              kod: 'MODERN_DUNYA_EKSIKLERI.md MW-014 · js/Talks.js:1270 profil yalnız statik' },
        21: { y: '04', k: 'a', t: 'Kayıtlı oturum sayısı artınca geçmiş sütununda arama/filtre yok',
              kod: 'js/Talks.js:1549 storyTalkConversationHistoryHtml düz liste' },
        /* ── 01 MENÜ + KURULUM ──────────────────────────────────────────── */
        22: { y: '01', k: 'a', t: '12 soruluk akışta GERİ ALMA yok, ilerleme başlığa gömülü, adım göstergesi iki ekranda tutarsız',
              kod: 'js/Character.js:601-625 seçenek tıklanınca decisions\'a yazılıp ilerliyor, dönüş yolu yok · :596 sayaç başlık satırının içinde (tema geçişi ve rol-başı dağılım :392-399 görünmüyor) · index.html:81 adım 2 = "BRİFİNG" ama :73 aynı adım = "KARAKTER"' },
        23: { y: '01', k: 'b', t: 'Yeni tipografi ölçeği uzun Türkçe etiketlerde kırpma yapmamalı',
              kod: 'design-qa.md:20 mevcut kabul ölçütü' },
        25: { y: '01', k: 'a', t: 'KAMPANYAYI BAŞLATAN BUTON 916×572\'de EKRAN DIŞINDA ve kaydırma yok — oyun başlatılamıyor',
              kod: 'ÖLÇÜLDÜ (gerçek giriş yolu, 8 devlet kartı dolu): #btn-story-start alt kenarı 632px / viewport 572px → 60px altta · style.css:919 .wr-setup-layout overflow YOK, height:calc(100% - 92px) sabit · .app-screen overflow:hidden (style.css:589) → kırpıyor · kurtarıcı kural style.css:994 yalnız @media(max-width:900px) altında, 916px\'te uygulanmıyor · kanıt qa-runtime/mockup-baseline/kusur-25-baslat-butonu-916x572.png' }
    };

    var VIEWPORTS = [
        { w: 916,  h: 572,  ad: '916×572',   not: 'QA masaüstü tabanı (design-qa.md:9)' },
        { w: 1280, h: 800,  ad: '1280×800',  not: 'geniş kontrol (design-qa.md:9)' },
        { w: 1903, h: 974,  ad: '1903×974',  not: 'compositor çekimi (design-qa.md:58)' }
    ];

    var params = new URLSearchParams(global.location.search);
    var state = {
        katman: params.get('katman') === 'b' ? 'b' : 'a',
        vp: parseInt(params.get('vp'), 10) || 0,   /* 0 → sayfanın kendi varsayılanı */
        pins: params.get('pin') !== 'off',
        crt: parseFloat(params.get('crt'))
    };

    function el(tag, cls, txt) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (txt != null) n.textContent = txt;
        return n;
    }

    /* URL'i güncel tut ki "şu anki görünümü" kopyala-yapıştır ile paylaşabilelim.
       file:// altında replaceState SecurityError atar (Chrome ve jsdom) — sessizce
       yutulur, çünkü mockup'ın birincil açılış yolu tam da file://. */
    function setUrl() {
        var p = new URLSearchParams();
        p.set('katman', state.katman);
        p.set('vp', String(state.vp));
        if (!state.pins) p.set('pin', 'off');
        try {
            history.replaceState(null, '', location.pathname + '?' + p.toString());
        } catch (e) { /* file:// — adres çubuğu güncellenmez, işlev etkilenmez */ }
    }

    /* ── SAHNE ÖLÇEKLEME ──────────────────────────────────────────────────
       Sahne GERÇEK piksel ölçüsünde kurulur, pencereye sığmıyorsa transform
       ile küçültülür. İçerideki hiçbir px değeri değişmez → mockup'ta okunan
       ölçü, oyunda uygulanacak ölçüdür. */
    function layoutScenes() {
        var vp = VIEWPORTS.filter(function (v) { return v.w === state.vp; })[0] || VIEWPORTS[0];
        Array.prototype.forEach.call(document.querySelectorAll('.lab-frame'), function (frame) {
            var stage = frame.querySelector('.stage');
            if (!stage) return;
            stage.style.width = vp.w + 'px';
            stage.style.height = vp.h + 'px';
            var avail = frame.parentNode.clientWidth || document.body.clientWidth;
            var scale = Math.min(1, (avail - 2) / vp.w);
            stage.style.transform = 'scale(' + scale + ')';
            frame.style.width = Math.round(vp.w * scale) + 2 + 'px';
            frame.style.height = Math.round(vp.h * scale) + 2 + 'px';
            var note = frame.parentNode.querySelector('.stage-scale-note');
            if (note) {
                note.textContent = vp.ad + ' gerçek piksel · ekranda %' +
                    Math.round(scale * 100) + ' ölçek · ' + vp.not;
            }
        });
    }

    /* ── REDLINE PİNLERİ ─────────────────────────────────────────────────
       data-kusur="2,3" taşıyan her öğeye numaralı rozet basar. Rozeti olmayan
       görsel değişiklik, BULGULAR.md'de karşılığı olmayan kozmetik değişiklik
       demektir ve kapsama kapısından geçmez. */
    function renderPins() {
        Array.prototype.forEach.call(document.querySelectorAll('.lab-pin'), function (p) {
            p.parentNode.removeChild(p);
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-kusur]'), function (host) {
            var nums = host.getAttribute('data-kusur').split(',').map(function (s) { return s.trim(); });
            var cs = global.getComputedStyle(host);
            if (cs.position === 'static') host.style.position = 'relative';
            var pin = el('span', 'lab-pin', nums.join(','));
            var first = KUSURLAR[nums[0]];
            pin.setAttribute('data-katman', first ? first.k : 'a');
            pin.title = nums.map(function (n) {
                var k = KUSURLAR[n];
                return k ? ('KUSUR ' + n + ' — ' + k.t + '\n  kanıt: ' + k.kod) : ('KUSUR ' + n + ' (defterde yok!)');
            }).join('\n\n');
            var pos = host.getAttribute('data-pin-pos') || 'tr';
            pin.style.position = 'absolute';
            if (pos.indexOf('t') >= 0) pin.style.top = '2px'; else pin.style.bottom = '2px';
            if (pos.indexOf('r') >= 0) pin.style.right = '2px'; else pin.style.left = '2px';
            host.appendChild(pin);
        });
    }

    /* ── LEJANT TABLOSU ──────────────────────────────────────────────────── */
    function renderLegend(yuzey) {
        var mount = document.querySelector('.lab-legend');
        if (!mount) return;
        var rows = Object.keys(KUSURLAR)
            .filter(function (n) { return KUSURLAR[n].y === yuzey; })
            .sort(function (a, b) { return a - b; });
        var seen = collectSeen();
        var html = '<table><caption>Bu yüzeyin kusur defteri — pin numaraları sahnedeki karşılıklarına işaret eder</caption>' +
            '<tr><th>#</th><th>Katman</th><th>Kusur</th><th>Kanıt (kod/doküman)</th><th>Sahnede</th></tr>';
        rows.forEach(function (n) {
            var k = KUSURLAR[n];
            html += '<tr data-katman="' + k.k + '">' +
                '<td class="n">' + n + '</td>' +
                '<td>' + (k.k === 'a' ? 'A · yapı' : 'B · görsel') + '</td>' +
                '<td>' + k.t + '</td>' +
                '<td><code>' + k.kod + '</code></td>' +
                '<td>' + (seen[n] ? '✓ ' + seen[n] + ' pin' : '—') + '</td>' +
                '</tr>';
        });
        mount.innerHTML = html + '</table>';
    }

    function collectSeen() {
        var seen = {};
        Array.prototype.forEach.call(document.querySelectorAll('[data-kusur]'), function (host) {
            /* Gizli katmandaki pinler sayılmaz — yoksa kapsama kapısı, o an
               ekranda olmayan bir sahneyle kandırılabilir. */
            if (host.closest('[hidden]')) return;
            host.getAttribute('data-kusur').split(',').forEach(function (s) {
                var n = s.trim();
                seen[n] = (seen[n] || 0) + 1;
            });
        });
        return seen;
    }

    /* ── KAPI 1: KAPSAMA ─────────────────────────────────────────────────
       Bu yüzeye ait her kusur numarası, bu katmanda sahnede en az bir pin
       almış olmalı. Almadıysa kusur kapatılmamıştır. */
    function gateCoverage(yuzey) {
        var seen = collectSeen();
        var eksik = Object.keys(KUSURLAR).filter(function (n) {
            return KUSURLAR[n].y === yuzey && KUSURLAR[n].k === state.katman && !seen[n];
        });
        return { ok: eksik.length === 0, eksik: eksik };
    }

    /* ── KAPI 2: YATAY TAŞMA ─────────────────────────────────────────────
       design-qa.md:15'teki mevcut kabul ölçütünün aynısı: hiçbir viewport'ta
       yatay taşma olmayacak. Sahne overflow:hidden olduğu için scrollWidth
       yerine her çocuğun sahne kutusunu aşıp aşmadığına bakılır.

       YALNIZ ÖNERİ SAHNELERİ ölçülür (data-gate="on"). "ŞU AN" sahneleri
       mevcut kusurları bilerek yeniden ürettiği için onları ölçmek kapıyı
       sürekli kırmızıda tutar ve sinyali yok eder. */
    function gateOverflow() {
        var kotu = [];
        Array.prototype.forEach.call(document.querySelectorAll('[data-gate="on"] .stage'), function (stage) {
            if (stage.closest('[hidden]')) return;
            var sw = stage.clientWidth, sh = stage.clientHeight;
            /* Kaydırılabilir bir ata içindeki öğe TAŞMA sayılmaz: içerik
               erişilebilir durumda. Ama overflow:hidden bir ata içindeyse
               içerik KESİLİYOR ve oyuncu ona hiç ulaşamıyor — o gerçek kusur.
               Bu ayrım gerçek Chromium ölçümünde şart oldu: hikaye gündem
               listesi zaten kaydırmalı (style.css:1298), oysa karakter ekranı
               kaydırmasız kesiliyor. */
            function kaydirilabilirAtaVar(n) {
                for (var p = n.parentNode; p && p !== stage; p = p.parentNode) {
                    if (p.nodeType !== 1) break;
                    var o = global.getComputedStyle(p);
                    var ov = o.overflowY + ' ' + o.overflowX;
                    if (ov.indexOf('auto') >= 0 || ov.indexOf('scroll') >= 0) return true;
                }
                return false;
            }
            Array.prototype.forEach.call(stage.querySelectorAll('*'), function (n) {
                if (n.classList.contains('lab-pin')) return;
                if (n.offsetParent === null) return;
                if (kaydirilabilirAtaVar(n)) return;
                var r = n.getBoundingClientRect();
                var sr = stage.getBoundingClientRect();
                var scale = sr.width / sw || 1;
                var right = (r.right - sr.left) / scale;
                var bottom = (r.bottom - sr.top) / scale;
                if (right > sw + 1 || bottom > sh + 1) {
                    kotu.push((n.id || n.className || n.tagName) + ' → ' +
                        Math.round(right) + '×' + Math.round(bottom) + ' (sahne ' + sw + '×' + sh + ')');
                }
            });
        });
        return { ok: kotu.length === 0, kotu: kotu };
    }

    /* ── KAPI 3: FONT ────────────────────────────────────────────────────
       assets/fonts/*.woff2 file:// altında çözülmezse mockup sistem fontuna
       düşer ve ölçtüğün her satır yalan olur.

       DİKKAT: yalnız check() yetmez. font-display:swap ile tanımlı bir font,
       sayfada henüz KULLANILMADIYSA yüklenmez ve check() false döner — gerçek
       Chromium'da bu yanlış alarm ölçüldü (Press Start 2P yalnız katman B'deki
       bir başlıkta kullanılıyordu). Kapı önce load() ile yüklemeyi dener,
       sonra bakar: sorduğumuz şey "dosya çözülüyor mu", "şu an boyanıyor mu"
       değil. */
    var fontDurum = { ok: null, stm: null, ps2p: null, yukleniyor: false };
    function fontYukle(sonra) {
        if (!document.fonts || !document.fonts.load) { fontDurum.ok = null; return; }
        if (fontDurum.yukleniyor) return;
        fontDurum.yukleniyor = true;
        Promise.all([
            document.fonts.load('12px "Share Tech Mono"', 'ABC'),
            document.fonts.load('12px "Press Start 2P"', 'ABC')
        ]).then(function (yuzler) {
            fontDurum.stm = yuzler[0].length > 0;
            fontDurum.ps2p = yuzler[1].length > 0;
            fontDurum.ok = fontDurum.stm && fontDurum.ps2p;
            fontDurum.yukleniyor = false;
            if (sonra) sonra();
        }, function () {
            fontDurum.ok = false; fontDurum.yukleniyor = false;
            if (sonra) sonra();
        });
    }
    function gateFont() { return fontDurum; }

    function runGates(yuzey) {
        var out = [];
        var cov = gateCoverage(yuzey);
        out.push({ ad: 'KAPSAMA', ok: cov.ok,
                   msg: cov.ok ? 'katman ' + state.katman.toUpperCase() + ' kusurlarının hepsi pinli'
                               : 'pinsiz kusur: ' + cov.eksik.join(', ') });
        var ov = gateOverflow();
        out.push({ ad: 'TAŞMA', ok: ov.ok,
                   msg: ov.ok ? state.vp + 'px öneri sahnelerinde taşma yok' : ov.kotu.slice(0, 4).join(' | ') });
        var f = gateFont();
        out.push({ ad: 'FONT', ok: f.ok,
                   msg: f.ok === null ? (f.yukleniyor ? 'yükleniyor…' : 'tarayıcı desteklemiyor')
                        : (f.ok ? 'Share Tech Mono + Press Start 2P çözüldü (file://)'
                                : 'EKSİK → STM:' + f.stm + ' PS2P:' + f.ps2p) });
        return out;
    }

    function paintGates(yuzey) {
        var mount = document.querySelector('.lab-gates');
        if (!mount) return;
        mount.innerHTML = '';
        runGates(yuzey).forEach(function (g) {
            var n = el('span', 'lab-gate', g.ad + ': ' + g.msg);
            n.setAttribute('data-state', g.ok === null ? '' : (g.ok ? 'pass' : 'fail'));
            mount.appendChild(n);
        });
    }

    /* ── ARAÇ ÇUBUĞU ─────────────────────────────────────────────────────── */
    function buildBar(cfg) {
        var bar = el('div', 'lab-bar');

        var back = el('a', 'lab-btn', '← lab');
        back.href = 'index.html';
        bar.appendChild(back);

        var h = el('h1');
        h.appendChild(document.createTextNode(cfg.baslik));
        var sub = el('small', null, cfg.altBaslik || '');
        h.appendChild(sub);
        bar.appendChild(h);

        var badge = el('span', 'lab-layer-badge');
        bar.appendChild(badge);

        /* Katman anahtarı */
        var gK = el('div', 'lab-group');
        gK.appendChild(el('label', null, 'katman'));
        [['a', 'A · bilgi mimarisi'], ['b', 'B · görsel dil']].forEach(function (o) {
            var b = el('button', null, o[1]);
            b.onclick = function () { state.katman = o[0]; apply(cfg); };
            b.setAttribute('data-katman-btn', o[0]);
            gK.appendChild(b);
        });
        bar.appendChild(gK);

        /* Viewport anahtarı */
        var gV = el('div', 'lab-group');
        gV.appendChild(el('label', null, 'viewport'));
        VIEWPORTS.forEach(function (v) {
            var b = el('button', null, v.ad);
            b.onclick = function () { state.vp = v.w; apply(cfg); };
            b.setAttribute('data-vp-btn', String(v.w));
            gV.appendChild(b);
        });
        bar.appendChild(gV);

        /* Pin anahtarı */
        var gP = el('div', 'lab-group');
        var bp = el('button', null, 'pinler');
        bp.onclick = function () { state.pins = !state.pins; apply(cfg); };
        bp.setAttribute('data-pin-btn', '1');
        gP.appendChild(bp);
        bar.appendChild(gP);

        /* CRT kaydırıcısı — KUSUR 13 */
        var gC = el('div', 'lab-group');
        gC.appendChild(el('label', null, 'CRT'));
        var sl = document.createElement('input');
        sl.type = 'range'; sl.min = '0'; sl.max = '0.6'; sl.step = '0.02';
        sl.value = String(isNaN(state.crt) ? 0.26 : state.crt);
        var val = el('label', null, sl.value);
        sl.oninput = function () {
            document.documentElement.style.setProperty('--wr-crt-alpha', sl.value);
            document.documentElement.style.setProperty('--wr-crt-vignette', String(Math.min(0.8, sl.value * 2.1)));
            val.textContent = sl.value;
            /* Sahnede bu ayarı GÖSTEREN bir kontrol varsa onu da sürer — mockup'taki
               kaydırıcı gerçek bir ayar gibi davransın diye. */
            Array.prototype.forEach.call(document.querySelectorAll('[data-crt-value]'), function (n) {
                n.textContent = (+sl.value).toFixed(2);
            });
            Array.prototype.forEach.call(document.querySelectorAll('[data-crt-fill]'), function (n) {
                n.style.width = Math.round((sl.value / +sl.max) * 100) + '%';
            });
        };
        gC.appendChild(sl); gC.appendChild(val);
        bar.appendChild(gC);

        bar.appendChild(el('div', 'lab-spacer'));
        bar.appendChild(el('div', 'lab-gates'));

        var re = el('button', null, 'kapıları çalıştır');
        re.onclick = function () { paintGates(cfg.yuzey); };
        bar.appendChild(re);

        document.body.insertBefore(bar, document.body.firstChild);
        return { badge: badge, slider: sl };
    }

    var refs = null;

    function apply(cfg) {
        document.body.setAttribute('data-katman', state.katman);
        document.body.setAttribute('data-pins', state.pins ? 'on' : 'off');
        if (refs) {
            refs.badge.textContent = state.katman === 'a' ? 'KATMAN A — bilgi mimarisi' : 'KATMAN B — görsel dil';
        }
        Array.prototype.forEach.call(document.querySelectorAll('[data-katman-btn]'), function (b) {
            b.setAttribute('aria-pressed', String(b.getAttribute('data-katman-btn') === state.katman));
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-vp-btn]'), function (b) {
            b.setAttribute('aria-pressed', String(+b.getAttribute('data-vp-btn') === state.vp));
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-pin-btn]'), function (b) {
            b.setAttribute('aria-pressed', String(state.pins));
        });
        /* Sahneler katmana göre farklı içerik gösterebilir. */
        Array.prototype.forEach.call(document.querySelectorAll('[data-only-katman]'), function (n) {
            n.hidden = n.getAttribute('data-only-katman') !== state.katman;
        });
        layoutScenes();
        renderPins();
        renderLegend(cfg.yuzey);
        setUrl();
        /* Kapılar yerleşim oturduktan sonra ölçülmeli. */
        requestAnimationFrame(function () { paintGates(cfg.yuzey); });
    }

    global.LAB = {
        KUSURLAR: KUSURLAR,
        VIEWPORTS: VIEWPORTS,
        init: function (cfg) {
            /* URL'de vp yoksa sayfanın kendi doğal ölçüsü kullanılır: savaş HUD'u
               916'da, hikaye 1280'de, görüşme modalı 1903'te tasarlandı. */
            if (!state.vp) state.vp = cfg.vp || 916;
            function boot() {
                refs = buildBar(cfg);
                apply(cfg);
                fontYukle(function () { paintGates(cfg.yuzey); });
                global.addEventListener('resize', function () {
                    layoutScenes();
                    paintGates(cfg.yuzey);
                });
                /* Fontlar geç yüklenirse kapı yanlış kırmızı yanar. */
                if (document.fonts && document.fonts.ready) {
                    document.fonts.ready.then(function () { paintGates(cfg.yuzey); });
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', boot);
            } else { boot(); }
        }
    };
})(window);
