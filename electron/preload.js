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
    // LLM köprüsü (sonraki adım): generate({prompt, max}) → Promise<string>
    // Şimdilik yok; oyun typeof kontrolüyle birleşim üretecine düşer.
});
