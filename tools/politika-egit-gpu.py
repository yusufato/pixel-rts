# POLITIKA AGI: durum + birim -> ARAMANIN SECTIGI ADAY SINIFI  (R1, GPU)
#
# NEDEN: arama mevcut politikayi olculmus bicimde yeniyor (+1262 marj, n=96, t 4.3) ama
# ~1 CPU-sn / oyun-sn harciyor -> canli oyuna SIGMIYOR ve ucuzlatmanin dort yolu da olculdu
# ve oldu. AlphaZero'nun cevabi: aramayi ucuzlatma, POLITIKAYA DAMIT. Cikarim ~1ms.
#
# CIKTI UZAYI: 25 sinif. 0 = yerinde kal, 1..24 = halka x yon (birime GORE).
# Sinif, aday uretilirken damgalanir (js/BattleLookahead.js) -> koordinattan geri hesap YOK.
#
# ═══ ASIL KAPI: COGUNLUK DEGIL, ELEYICI ═══
# Saf cogunluk tabani (~%31) yaniltici bir kolaylik. Elimizde ZATEN bedava bir politika var:
# aramanin analitik/ag eleyicisinin #1 adayi. Damitmanin degeri, ancak agin O TABANI gecmesiyle
# kanitlanir. Olculdu: rollout eleyiciyi kararlarin %62.6'sinda deviriyor, ve eleyici "yerinde
# kal"i HIC birinci siralamiyor (%0) oysa rollout %31 oraninda kal diyor. Ogrenilecek gercek
# sinyal iste bu farkta.
#
# SIZINTI KAPISI: bolme TOHUM (mac) bazinda. Ayni macin kararlari birbirine cok benzer;
# karar bazinda bolmek egitim ve testi ayni maclarla doldurur ve dogrulugu sahte yukseltir.
# Bu tuzagin kardesi hem deger aginda hem kompozisyon modelinde yasandi.
import json, sys, os, glob as _glob
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

VERI = arg('--veri', 'qa-runtime/politika')
DOSYALAR = []
for _p in VERI.split(','):
    _p = _p.strip()
    if os.path.isdir(_p):
        DOSYALAR.extend(sorted(_glob.glob(os.path.join(_p, '*.jsonl'))))
    elif '*' in _p or '?' in _p:
        DOSYALAR.extend(sorted(_glob.glob(_p)))
    else:
        DOSYALAR.append(_p)
DOSYALAR = [d for d in DOSYALAR if os.path.exists(d)]
if not DOSYALAR:
    print(f'veri bulunamadi: {VERI}'); sys.exit(1)

EPOK = int(arg('--epok', 200))
KAYDET = arg('--kaydet')
GX = int(arg('--gx', 16)); GY = int(arg('--gy', 10)); KANAL = 8
MAKS = int(arg('--maxsatir', 400000))
dev = 'cuda' if torch.cuda.is_available() else 'cpu'

_n = 0
for _d in DOSYALAR:
    with open(_d, encoding='utf-8') as f:
        for _ in f: _n += 1
ADIM = max(1, _n // MAKS) if MAKS > 0 else 1
if ADIM > 1:
    print(f'veri {_n} satir -> her {ADIM}. satir (bellek kapisi {MAKS})')

R, S, B, Y, E, MAC, TIK = [], [], [], [], [], [], []
_bozuk = 0; _i = -1
for _d in DOSYALAR:
    # dosya adi parca kimligi; mac kimligi = dosya + nihai marj + bitis degil, TOHUM olmali.
    # politika-veri.js tohumu satira yazmadigi icin dosya+nihai marj cifti mac vekilidir:
    # ayni mac icindeki tum kararlar AYNI nihai marji tasir (mac basina tek deger).
    with open(_d, encoding='utf-8') as f:
        for line in f:
            _i += 1
            if _i % ADIM: continue
            line = line.strip()
            if not line: continue
            try:
                d = json.loads(line)
            except Exception:
                _bozuk += 1; continue
            if d.get('b') is None: continue
            R.append(d['r']); S.append(d['s']); B.append(d['b'])
            Y.append(d['y']); E.append(d.get('e', -1))
            MAC.append(os.path.basename(_d) + '#' + str(d.get('nihai', 0)))
            TIK.append(d['tik'])

if len(Y) < 500:
    print(f'veri az ({len(Y)} karar) - egitim anlamsiz.'); sys.exit(0)

R = np.array(R, dtype=np.float32).reshape(-1, KANAL, GY, GX)
S = np.array(S, dtype=np.float32)
B = np.array(B, dtype=np.float32)
Y = np.array(Y, dtype=np.int64)
E = np.array(E, dtype=np.int64)
MAC = np.array(MAC); TIK = np.array(TIK, dtype=np.float32)
SINIF = 25
maclar = sorted(set(MAC.tolist()))
if _bozuk: print(f'atlanan bozuk satir: {_bozuk}')
print(f'veri: {len(Y)} karar, {len(maclar)} mac, raster {KANAL}x{GY}x{GX}, skaler {S.shape[1]}, birim {B.shape[1]}')
if len(maclar) < 20:
    print(f'UYARI: yalnizca {len(maclar)} mac - mac-bazli bolme zayif kalir.')

rng = np.random.default_rng(20260817); ml = maclar[:]; rng.shuffle(ml)
kes = max(1, int(len(ml) * 0.8))
tr_mac = set(ml[:kes])
tr = np.array([m in tr_mac for m in MAC]); te = ~tr
print(f'  egitim {tr.sum()} karar / {len(tr_mac)} mac   test {te.sum()} / {len(ml)-len(tr_mac)} mac')

# ── TABANLAR (agin gecmesi gereken esikler) ────────────────────────────────
say = np.bincount(Y[tr], minlength=SINIF)
cog = int(say.argmax())
t_cog = float((Y[te] == cog).mean())
gecerli_e = E[te] >= 0
t_ele = float((Y[te][gecerli_e] == E[te][gecerli_e]).mean()) if gecerli_e.sum() else float('nan')
print('')
print('TABANLAR')
print(f'  cogunluk sinifi ({cog})        : %{t_cog*100:.1f}   (yaniltici kolay taban)')
print(f'  ELEYICI #1 (bedava politika)  : %{t_ele*100:.1f}   <- ASIL KAPI, ag bunu gecmeli')
print(f'  rollout eleyiciyi deviriyor   : %{(1-t_ele)*100:.1f} oraninda')

# Normalizasyon YALNIZ egitim kumesinden; raster KANAL BAZINDA (deger aginda bu
# per-element yapilmis ve JS<->Python sapmasina yol acmisti - orada yakalandi).
rmu, rsd = R[tr].mean((0,2,3), keepdims=True), R[tr].std((0,2,3), keepdims=True) + 1e-6
smu, ssd = S[tr].mean(0), S[tr].std(0) + 1e-6
bmu, bsd = B[tr].mean(0), B[tr].std(0) + 1e-6
Rn = (R - rmu) / rsd; Sn = (S - smu) / ssd; Bn = (B - bmu) / bsd

class Model(nn.Module):
    def __init__(self, sdim, bdim):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(KANAL, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, 32, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d((3, 4)), nn.Flatten())          # 32*3*4 = 384
        self.mlp = nn.Sequential(nn.Linear(sdim, 64), nn.ReLU())
        self.bir = nn.Sequential(nn.Linear(bdim, 32), nn.ReLU())
        self.bas = nn.Sequential(nn.Linear(384 + 64 + 32, 128), nn.ReLU(), nn.Linear(128, SINIF))
    def forward(self, r, s, b):
        return self.bas(torch.cat([self.cnn(r), self.mlp(s), self.bir(b)], 1))

torch.manual_seed(20260817)
model = Model(S.shape[1], B.shape[1]).to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
lossf = nn.CrossEntropyLoss()

rt = torch.tensor(Rn[tr], device=dev); st = torch.tensor(Sn[tr], device=dev)
bt = torch.tensor(Bn[tr], device=dev); yt = torch.tensor(Y[tr], device=dev)
rv = torch.tensor(Rn[te], device=dev); sv = torch.tensor(Sn[te], device=dev)
bv = torch.tensor(Bn[te], device=dev); yv = torch.tensor(Y[te], device=dev)

N = rt.shape[0]; PARTI = min(512, N)
en_iyi, bekle, en_iyi_durum = 9e9, 0, None
for ep in range(EPOK):
    model.train()
    perm = torch.randperm(N, device=dev)
    for i in range(0, N, PARTI):
        ix = perm[i:i+PARTI]
        opt.zero_grad()
        lossf(model(rt[ix], st[ix], bt[ix]), yt[ix]).backward()
        opt.step()
    model.eval()
    with torch.no_grad():
        vl = lossf(model(rv, sv, bv), yv).item()
    if vl < en_iyi - 1e-4:
        en_iyi, bekle = vl, 0
        en_iyi_durum = {k: v.detach().clone() for k, v in model.state_dict().items()}
    else:
        bekle += 1
        if bekle > 30: break
if en_iyi_durum: model.load_state_dict(en_iyi_durum)

model.eval()
with torch.no_grad():
    lg = model(rv, sv, bv).cpu().numpy()
tah = lg.argmax(1)
dog = float((tah == Y[te]).mean())
sira = np.argsort(-lg, axis=1)
top3 = float(np.mean([Y[te][i] in sira[i, :3] for i in range(len(tah))]))
print('')
print(f'cihaz {dev} | en iyi dogrulama kaybi {en_iyi:.4f} | epok {ep+1}')
print(f'SONUC   dogruluk %{dog*100:.1f}   top-3 %{top3*100:.1f}')
print(f'  cogunluk tabanina gore : {(dog-t_cog)*100:+.1f} puan')
print(f'  ELEYICI tabanina gore  : {(dog-t_ele)*100:+.1f} puan   <- KARAR BU')

# AYRIM — ag gercekten rollout'u mu ogrendi, yoksa ucuz eleyiciyi mi taklit ediyor?
# Cevap, rollout'un eleyiciyi DEVIRDIGI alt-kumede gorulur: orada eleyici tanim geregi
# %0 dogru, dolayisiyla oradaki her puan yalniz rollout'tan ogrenilmis olabilir.
print('')
print("AYRIM — ag rollout'u mu ogrendi, eleyiciyi mi taklit ediyor?")
_z = gecerli_e & (Y[te] != E[te])
_k = gecerli_e & (Y[te] == E[te])
if _z.sum() > 20:
    print(f'  rollout eleyiciyi DEVIRDIGINDE dogruluk : %{float((tah[_z]==Y[te][_z]).mean())*100:.1f}  (n={int(_z.sum())})')
    print(f'  eleyici zaten HAKLIYKEN dogruluk        : %{float((tah[_k]==Y[te][_k]).mean())*100:.1f}  (n={int(_k.sum())})')
    print('  ilki dusukse ag yalnizca ucuz eleyiciyi kopyalamis demektir.')

# "Yerinde kal" ayrimi: eleyicinin HIC uretemedigi sinif. Damitmanin en ozgun katkisi.
_kal = Y[te] == 0
if _kal.sum() > 10:
    kesinlik = float((Y[te][tah == 0] == 0).mean()) if (tah == 0).sum() else float('nan')
    print('')
    print(f'  "yerinde kal" (sinif 0) anma  : %{float((tah[_kal]==0).mean())*100:.1f}  (n={int(_kal.sum())})')
    print(f'  "yerinde kal" kesinlik        : %{kesinlik*100:.1f}')
    print('  eleyici bu sinifi %0 uretiyordu -> buradaki her puan SAF damitma kazanci.')

if KAYDET:
    os.makedirs(os.path.dirname(KAYDET) or '.', exist_ok=True)
    torch.save({'model': model.state_dict(), 'rmu': rmu, 'rsd': rsd, 'smu': smu, 'ssd': ssd,
                'bmu': bmu, 'bsd': bsd, 'sdim': int(S.shape[1]), 'bdim': int(B.shape[1]),
                'gx': GX, 'gy': GY, 'sinif': SINIF, 'dogruluk': dog, 'taban_eleyici': t_ele,
                'karar': int(len(Y)), 'mac': len(maclar)}, KAYDET)
    print(f'\nmodel kaydedildi: {KAYDET}')
