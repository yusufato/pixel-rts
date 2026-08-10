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
        // { ready, error, model, yuklendi, modelVar } — SALT BİLGİ, model YÜKLEMEZ.
        // (Eskiden bu çağrı modeli yüklüyordu → oyun açılışta 4.9GB alıyordu.)
        status: () => ipcRenderer.invoke('llm:status'),
        // Kullanıcı yapay anlatıcıyı açtığında çağrılır → modeli ŞİMDİ yükle.
        start: () => ipcRenderer.invoke('llm:start'),
        // { system, prompt, maxTokens, temperature, jsonSchema? } → Promise<string|null>
        // null = model yok/hazır değil/zaman aşımı → oyun birleşim üretecine düşer
        generate: req => ipcRenderer.invoke('llm:generate', req),
    },
    // FAZ 6: insan-maçı öğrenme — oyun, maç sonu etiketlenmiş karar-durumlarını disk'e ekler.
    // main süreç qa-runtime/human-data.json'a APPEND eder (örnekler birikir). → Promise<{count}>
    train: {
        saveHumanData: examples => ipcRenderer.invoke('train:saveHumanData', examples),
        humanDataCount: () => ipcRenderer.invoke('train:humanDataCount'),
        // #5: her maçın TAM kaydını (samples+controllerDecisions) qa-runtime/last-match.json'a yaz → Claude izler.
        saveMatchRecording: rec => ipcRenderer.invoke('train:saveMatchRecording', rec),
    },
    // KOMUTAN MODU: COMMANDER=1 env ile açılır → oyun kırmızıyı dış-komutana (dosya alışverişi) bırakır.
    commanderMode: process.env.COMMANDER === '1',
    commander: {
        writeState: state => ipcRenderer.invoke('commander:writeState', state),   // canlı sahayı qa-runtime/commander-state.json'a yaz
        readOrders: turn => ipcRenderer.invoke('commander:readOrders', turn),      // qa-runtime/commander-orders.json'dan (tur eşleşirse) emirleri oku
    },
});
