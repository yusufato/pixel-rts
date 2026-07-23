// ═══════════════════════════════════════════════════════════════════════════
//  LLM SUNUCUSU — AYRI SÜREÇ
//  ---------------------------------------------------------------------------
//  Neden ayrı süreç: llama.cpp çıkarımı çalıştığı iş parçacığını BLOKE eder.
//  Electron'un ana sürecinde çalıştırılsa pencere olayları donar; render
//  sürecinde çalıştırılsa oyun kare atlar. Bu yüzden fork edilmiş bir Node
//  sürecinde durur ve IPC ile konuşur.
//
//  Protokol (process.send / process.on('message')):
//    ← { t:'load', modelPath, gpuLayers }        → { t:'loaded' } | { t:'error' }
//    ← { t:'gen', id, system, prompt, maxTokens } → { t:'gen', id, text } | { t:'gen', id, error }
//    ← { t:'stop' }
// ═══════════════════════════════════════════════════════════════════════════

let llama = null, model = null, ctx = null, LlamaChatSession = null;
let busy = false;
const queue = [];

function send(msg) { try { process.send && process.send(msg); } catch (_) {} }

async function ensureLoaded(modelPath, gpuLayers) {
    if (model) return;
    const mod = await import('node-llama-cpp');
    LlamaChatSession = mod.LlamaChatSession;
    llama = await mod.getLlama();
    // GPU KATMANI: 'auto' → node-llama-cpp VRAM'e sığdığı kadar katmanı GPU'ya koyar,
    // gerisini CPU'da bırakır. Böylece tek varsayılan üç makineyi de idare eder:
    //   8 GB GPU → tüm katmanlar GPU'da (~30-50 jeton/sn)
    //   2 GB GPU → birkaç katman GPU, gerisi CPU (orta hız)
    //   GPU yok  → hepsi CPU (~0.8 jeton/sn ama çalışır)
    // Sayı verilirse ona uyar (test/ayar için). GPU sığdırma başarısız olursa host
    // 'error' yollar, oyun şablona düşer — çökme değil, sessiz geri çekilme.
    const opts = { modelPath };
    if (gpuLayers !== 'auto' && gpuLayers != null) opts.gpuLayers = gpuLayers | 0;
    model = await llama.loadModel(opts);
    // Küçük bağlam: sahneler kısa, bellek ve hız önemli.
    ctx = await model.createContext({ contextSize: 1024 });
}

async function runOne(job) {
    // DİZİ (sequence) SINIRLI KAYNAK: her üretimden sonra session VE seq serbest
    // bırakılmalı. Bırakılmazsa ~4. üretimde "No sequences left" ile düşer — bench'te
    // birebir yaşandı. try/finally garantiler ki hata durumunda da sızmasın.
    const seq = ctx.getSequence();
    const session = new LlamaChatSession({ contextSequence: seq, systemPrompt: job.system });
    try {
        return await session.prompt(job.prompt, {
            maxTokens: job.maxTokens || 160,
            temperature: job.temperature == null ? 0.85 : job.temperature,
            topP: 0.9,
        });
    } finally {
        try { session.dispose(); } catch (_) {}
        try { seq.dispose(); } catch (_) {}
    }
}

async function pump() {
    if (busy || !queue.length || !model) return;
    busy = true;
    const job = queue.shift();
    try {
        const text = await runOne(job);
        send({ t: 'gen', id: job.id, text: String(text || '').trim() });
    } catch (e) {
        send({ t: 'gen', id: job.id, error: String(e && e.message || e) });
    }
    busy = false;
    setImmediate(pump);
}

process.on('message', async msg => {
    if (!msg || !msg.t) return;
    if (msg.t === 'load') {
        try {
            await ensureLoaded(msg.modelPath, msg.gpuLayers);
            send({ t: 'loaded', modelPath: msg.modelPath });
            pump();
        } catch (e) {
            send({ t: 'error', error: String(e && e.message || e) });
        }
        return;
    }
    if (msg.t === 'gen') {
        // Kuyruk taşmasın: oyun beklemiyor zaten, eski istekler değersizleşir.
        if (queue.length > 6) queue.shift();
        queue.push(msg);
        pump();
        return;
    }
    if (msg.t === 'stop') process.exit(0);
});

process.on('uncaughtException', e => send({ t: 'error', error: 'uncaught: ' + (e && e.message) }));
