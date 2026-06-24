// ═══════════════════════════════════════════════════════════════
//  İNSAN REPLAY KAYDI  (Step 1 — kayıt altyapısı)
//  Oyuncu normal oynar; her savaş otomatik kaydedilir:
//    • deploy  : savaş başındaki oyuncu ordusu (tip + konum)
//    • commands: zaman damgalı emirler (git / saldır → dünya konumu)
//  Amaç: AI'yı sonradan bu kayda (gerçek bir "usta"ya) karşı eğitmek.
//  Son REPLAY_MAX maç localStorage'da 'pixelRtsReplays' altında tutulur.
// ═══════════════════════════════════════════════════════════════
const REPLAY_KEY = 'pixelRtsReplays';
const REPLAY_MAX = 10;

const playerReplay = {
    recording: false,
    battleStart: 0,
    deploy: [],      // [{type, x, y}]
    commands: [],    // [{t, ids:[recId...], kind:'move'|'attack', x, y}]
};

// Savaş başında çağrılır (startBattle içinden). Oyuncu birimlerine stabil recId verir.
function replayStartRecording() {
    playerReplay.recording = true;
    playerReplay.battleStart = (typeof simulationTime !== 'undefined') ? simulationTime : 0;
    playerReplay.deploy = [];
    playerReplay.commands = [];
    let i = 0;
    for (const u of units) {
        if (u.isRed || u.dead) continue;
        u.recId = i++;
        playerReplay.deploy.push({ type: u.type, x: Math.round(u.x), y: Math.round(u.y) });
    }
    console.log(`🎬 Replay kaydı başladı · ${playerReplay.deploy.length} birim`);
}

// Her oyuncu emrinde çağrılır (contextmenu handler içinden).
function replayRecordCommand(selectedUnits, kind, x, y) {
    if (!playerReplay.recording) return;
    const ids = [];
    for (const u of selectedUnits) if (u.recId !== undefined) ids.push(u.recId);
    if (!ids.length) return;
    playerReplay.commands.push({
        t: Math.round(((typeof simulationTime !== 'undefined') ? simulationTime : 0) - playerReplay.battleStart),
        ids, kind, x: Math.round(x), y: Math.round(y)
    });
}

// Savaş bitince çağrılır (game-over içinden). won === true → oyuncu kazandı.
function replayStopRecording(won) {
    if (!playerReplay.recording) return;
    playerReplay.recording = false;
    const rec = {
        deploy: playerReplay.deploy.slice(),
        commands: playerReplay.commands.slice(),
        duration: Math.round(((typeof simulationTime !== 'undefined') ? simulationTime : 0) - playerReplay.battleStart),
        playerWon: (won === true),
        commandCount: playerReplay.commands.length,
        unitCount: playerReplay.deploy.length
    };
    const lib = replayLoadAll();
    lib.push(rec);
    while (lib.length > REPLAY_MAX) lib.shift();   // sadece son REPLAY_MAX maçı tut
    try { localStorage.setItem(REPLAY_KEY, JSON.stringify(lib)); } catch (e) {}
    console.log(`🎬 Replay kaydedildi → ${rec.unitCount} birim · ${rec.commandCount} emir · ${(rec.duration / 1000).toFixed(0)} sn · oyuncu ${rec.playerWon ? 'KAZANDI' : 'kaybetti'} · kütüphane ${lib.length}/${REPLAY_MAX}`);
    return rec;
}

// ── Kütüphane yardımcıları (konsoldan kullan) ──
function replayLoadAll() {
    try { return JSON.parse(localStorage.getItem(REPLAY_KEY)) || []; } catch (e) { return []; }
}
function replayInfo() {
    const lib = replayLoadAll();
    if (!lib.length) { console.log('Kayıtlı replay yok. Bir maç oyna, otomatik kaydedilir.'); return lib; }
    console.log(`=== ${lib.length} kayıtlı replay ===`);
    lib.forEach((r, i) => console.log(
        `#${i}: ${r.unitCount} birim · ${r.commandCount} emir · ${(r.duration / 1000).toFixed(0)} sn · oyuncu ${r.playerWon ? 'KAZANDI ✅' : 'kaybetti'}`
    ));
    return lib;
}
function replayClear() { try { localStorage.removeItem(REPLAY_KEY); } catch (e) {} console.log('Replay kütüphanesi temizlendi.'); }
function replayDownload() {
    const lib = replayLoadAll();
    const content = JSON.stringify(lib, null, 2);
    try {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'replays.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {}
    return content;
}
