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

const fs = require('fs'), path = require('path');
let llama = null, model = null, ctx = null, LlamaChatSession = null;
let busy = false;
const queue = [];

// CUDA (RTX 4060) KALICI + OTOMATİK: cuda-runtime/bin master (npm install silemez). Her başlangıçta:
//   1) CUDA_PATH + PATH ayarla (node-llama-cpp tespiti bunları arar)
//   2) DLL'leri çalıştırılabilir (electron.exe) dizinine kopyala (Windows DLL yüklemesi uygulama-dizinini arar;
//      PATH'i aramaz) → npm install DLL'leri silse bile buradan self-heal. Yoksa false → Vulkan/CPU.
function ensureCudaRuntime() {
    try {
        const home = path.join(__dirname, '..', 'cuda-runtime');
        const bin = path.join(home, 'bin');
        const dlls = ['cudart64_12.dll', 'cublas64_12.dll', 'cublasLt64_12.dll'];
        if (!fs.existsSync(path.join(bin, dlls[0]))) return false;
        process.env.CUDA_PATH = home;
        if (!(process.env.PATH || '').toLowerCase().includes(bin.toLowerCase()))
            process.env.PATH = bin + path.delimiter + (process.env.PATH || '');
        const exeDir = path.dirname(process.execPath);   // electron.exe dizini
        for (const dll of dlls) {
            const dst = path.join(exeDir, dll);
            try { if (!fs.existsSync(dst)) fs.copyFileSync(path.join(bin, dll), dst); } catch (_) {}
        }
        return true;
    } catch (_) { return false; }
}

function send(msg) { try { process.send && process.send(msg); } catch (_) {} }

async function ensureLoaded(modelPath, gpuLayers, contextSize) {
    if (model) return;
    const mod = await import('node-llama-cpp');
    LlamaChatSession = mod.LlamaChatSession;
    // BACKEND: CPU istendiyse kapat; aksi halde CUDA (cuda-runtime varsa, RTX 4060 → hızlı) → yoksa Vulkan → yoksa CPU.
    const cpuOnly = (gpuLayers === 0 || gpuLayers === 'cpu' || gpuLayers === '0');
    let backend = false;
    if (!cpuOnly) backend = ensureCudaRuntime() ? 'cuda' : 'vulkan';
    try {
        llama = await mod.getLlama({ gpu: backend });
    } catch (e) {
        // CUDA/Vulkan yüklenemezse sırayla düş — çökme yok, sadece yavaşlar.
        try { llama = await mod.getLlama({ gpu: backend === 'cuda' ? 'vulkan' : false }); }
        catch (e2) { llama = await mod.getLlama({ gpu: false }); }
    }
    send({ t: 'backend', gpu: (llama && llama.gpu) || 'cpu' });
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
    // Bağlam: anlatıcı için küçük (1024) yeter; koç uzun digest okur → çağıran büyük ister (contextSize).
    ctx = await model.createContext({ contextSize: contextSize || 1024 });
}

async function runOne(job) {
    // DİZİ (sequence) SINIRLI KAYNAK: her üretimden sonra session VE seq serbest
    // bırakılmalı. Bırakılmazsa ~4. üretimde "No sequences left" ile düşer — bench'te
    // birebir yaşandı. try/finally garantiler ki hata durumunda da sızmasın.
    const seq = ctx.getSequence();
    const session = new LlamaChatSession({ contextSequence: seq, systemPrompt: job.system });
    try {
        let firstChunkSent = false;
        job._generatedTokens = 0;
        const promptOptions = {
            maxTokens: job.maxTokens || 160,
            temperature: job.temperature == null ? 0.85 : job.temperature,
            topP: 0.9,
        };
        // Faz 3.1 tezgâhı aynı üretim yolunu ölçer. Normal oyun isteklerinde
        // callbacks eklenmez; çıktı ve zamanlama davranışı değişmez.
        if (job.metrics) {
            promptOptions.onTextChunk = chunk => {
                if (firstChunkSent || !String(chunk || '').length) return;
                firstChunkSent = true;
                send({ t: 'chunk', id: job.id, chars: String(chunk).length });
            };
            promptOptions.onToken = tokens => {
                job._generatedTokens += Array.isArray(tokens) ? tokens.length : 1;
            };
            if (Number.isInteger(job.seed)) promptOptions.seed = job.seed;
        }
        return await session.prompt(job.prompt, promptOptions);
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
        send({
            t: 'gen',
            id: job.id,
            text: String(text || '').trim(),
            generatedTokens: job.metrics ? job._generatedTokens : undefined,
            memory: job.metrics ? process.memoryUsage() : undefined
        });
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
            await ensureLoaded(msg.modelPath, msg.gpuLayers, msg.contextSize);
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
