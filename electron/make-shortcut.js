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

const ROOT = path.join(__dirname, '..');
const desktop = path.join(os.homedir(), 'Desktop');
const linkPath = path.join(desktop, 'Pixel RTS.lnk');

if (process.platform !== 'win32') {
    console.log('Bu betik Windows içindir. Linux/macOS için Pixel RTS.desktop dosyasına bakın.');
    process.exit(0);
}
if (!fs.existsSync(desktop)) {
    console.error('Masaüstü klasörü bulunamadı: ' + desktop);
    process.exit(1);
}

// 1) Derlenmiş sürüm var mı?
const builtExe = path.join(ROOT, 'dist', 'win-unpacked', 'Pixel RTS.exe');
let target, args, workDir, note;
if (fs.existsSync(builtExe)) {
    target = builtExe; args = ''; workDir = path.dirname(builtExe);
    note = 'derlenmiş sürüm (dist/win-unpacked)';
} else {
    // 2) Geliştirme modu: electron.exe + proje klasörü
    const devExe = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
    if (!fs.existsSync(devExe)) {
        console.error('Ne derlenmiş sürüm ne Electron bulundu.\n' +
                      '  Önce:  npm install   (ve istersen  npm run dist:dir)');
        process.exit(1);
    }
    target = devExe; args = '"' + ROOT + '"'; workDir = ROOT;
    note = 'geliştirme modu (npm start ile aynı)';
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
