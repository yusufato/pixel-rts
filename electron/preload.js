// ═══════════════════════════════════════════════════════════════════════════
//  PRELOAD — oyun sayfası ile Electron ana süreci arasındaki DAR köprü
//  ---------------------------------------------------------------------------
//  Oyun koduna Node verilmez; yalnız adı belli birkaç fonksiyon açılır.
//  Tarayıcıda çalışırken window.PIXEL tanımsızdır — oyun bunu kontrol edip
//  masaüstüne özel özellikleri (tam ekran, LLM) kapatır. Tek kod tabanı,
//  iki ortam.
// ═══════════════════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('PIXEL', {
    desktop: true,
    info: () => ipcRenderer.invoke('app:info'),
    llm: {
        // { ready, error, model } — model tembel yüklenir, ilk çağrıda başlar
        status: () => ipcRenderer.invoke('llm:status'),
        // { system, prompt, maxTokens, temperature } → Promise<string|null>
        // null = model yok/hazır değil/zaman aşımı → oyun birleşim üretecine düşer
        generate: req => ipcRenderer.invoke('llm:generate', req),
    },
});
