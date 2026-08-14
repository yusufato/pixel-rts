'use strict';

const path = require('node:path');
const { createLlmHostClient } = require('./story-dialogue-llm-host-client');

const ROOT = path.resolve(__dirname, '..');
const modelPath = path.join(ROOT, 'models', 'Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf');

async function main() {
    const host = createLlmHostClient({ root: ROOT, modelPath, contextSize: 1024,
        requireDiscreteGpu: true, loadTimeoutMs: 60000 });
    try {
        const result = await host.probe();
        process.stdout.write(`${JSON.stringify({ ok: true, backend: result.backend,
            devices: result.devices, vram: result.vram,
            diagnostics: host.backendDiagnostics() })}\n`);
    } catch (error) {
        process.stdout.write(`${JSON.stringify({ ok: false, error: error.message,
            backend: host.backend(), devices: host.backendDevices(), vram: host.backendVram(),
            diagnostics: host.backendDiagnostics() })}\n`);
        process.exitCode = 2;
    } finally {
        await host.stopAndWait();
    }
}

main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
