// ═══════════════════════════════════════════════════════════════════════════
//  MASAÜSTÜ KISAYOLU (Windows)
//  ---------------------------------------------------------------------------
//  `npm run shortcut` → Masaüstüne "Pixel RTS" kısayolu koyar.
//  Derlenmiş exe varsa ona, yoksa geliştirme moduna (electron .) bağlar.
//  NSIS kurulumu zaten kısayol oluşturur; bu, kurulum yapmadan oynamak içindir.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// Bazı geliştirme/sandbox çalıştırıcıları `__dirname` ve `os.homedir()` için
// sanal kullanıcı yolu döndürüyor. Komut proje kökünden çalıştırılıyorsa gerçek
// çalışma dizinini, masaüstü için de Windows USERPROFILE değerini esas al.
const invocationRoot = process.cwd();
const ROOT = fs.existsSync(path.join(invocationRoot, 'package.json'))
    ? invocationRoot
    : path.join(__dirname, '..');
const desktop = path.join(process.env.USERPROFILE || os.homedir(), 'Desktop');
const linkPath = path.join(desktop, 'Pixel RTS.lnk');

if (process.platform !== 'win32') {
    console.log('Bu betik Windows içindir. Linux/macOS için Pixel RTS.desktop dosyasına bakın.');
    process.exit(0);
}
if (!fs.existsSync(desktop)) {
    console.error('Masaüstü klasörü bulunamadı: ' + desktop);
    process.exit(1);
}

// TEK KANONİK ÇALIŞTIRMA YERİ: CANLI KAYNAK (dev mod). Paketli exe yerine electron.exe + proje kökü çalıştırır
// → her kod değişikliği ANINDA canlı (build YOK, bayat sürüm YOK, kilit sorunu YOK). Kullanıcı oyunu kapatıp
// kısayoldan açar, en güncel kod gelir. (Aktif geliştirme için doğru akış; "release" istenince dist'e dönülebilir.)
const devExe = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
let target, args, workDir, note;
if (fs.existsSync(devExe)) {
    target = devExe; args = '"' + ROOT + '"'; workDir = ROOT;
    note = 'CANLI KAYNAK (dev mod) — hep en güncel kod, build gerekmez';
} else {
    // Yedek: derlenmiş paket (electron kurulu değilse)
    const builtExe = path.join(ROOT, 'dist', 'win-unpacked', 'Pixel RTS.exe');
    if (!fs.existsSync(builtExe)) {
        console.error('Ne Electron ne derlenmiş sürüm bulundu.\n  Önce:  npm install');
        process.exit(1);
    }
    target = path.join(process.env.WINDIR || 'C:\\Windows', 'explorer.exe');
    args = '"' + builtExe + '"';
    workDir = path.dirname(builtExe);
    note = 'derlenmiş paket (dist/win-unpacked) — Electron bulunamadı, yedek';
}

const icon = fs.existsSync(path.join(ROOT, 'assets', 'icon.ico'))
    ? path.join(ROOT, 'assets', 'icon.ico') : target;

// PowerShell + WScript.Shell ile .lnk üret (ek bağımlılık yok)
const ps = [
    '$W = New-Object -ComObject WScript.Shell',
    '$S = $W.CreateShortcut(' + q(linkPath) + ')',
    '$S.TargetPath = ' + q(target),
    args ? '$S.Arguments = ' + q(args) : '',
    '$S.WorkingDirectory = ' + q(workDir),
    '$S.IconLocation = ' + q(icon),
    '$S.Description = "Pixel RTS — yaşayan Avrupa seferi"',
    '$S.Save()',
].filter(Boolean).join('; ');

function q(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'pipe' });
    console.log('✓ Masaüstü kısayolu oluşturuldu: ' + linkPath);
    console.log('  hedef: ' + note);
} catch (e) {
    console.error('Kısayol oluşturulamadı: ' + (e.stderr ? e.stderr.toString() : e.message));
    process.exit(1);
}
