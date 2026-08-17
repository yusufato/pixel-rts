# POLITIKA KOPRU KAPISI — PyTorch ciktisi ile JS ileri-gecisi AYNI MI?
#
# NEDEN ZORUNLU: deger agi koprusunde raster normalizasyonu JS'te YANLIS uygulanmisti
# (eleman basina, oysa egitimde kanal basina). Ag sessizce coper tahmin uretiyordu ve
# bunu hicbir maç sonucu ele vermedi - yalnizca bu karsilastirma yakaladi.
# Ayni sinif hata burada da mumkun (uc ayri normalizasyon: raster/skaler/birim +
# uc dalli birlestirme sirasi). Kapi gecmeden politika agi motora BAGLANMAZ.
#
# KAPI: max mutlak logit farki < 1e-3 VE argmax uyusmasi %100.
#
#   python tools/politika-kopru-kapisi.py --model qa-runtime/politika-model.pt \
#          --veri qa-runtime/politika/veri-0.jsonl --n 64
import sys, os, json, subprocess
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

MODEL = arg('--model', 'qa-runtime/politika-model.pt')
VERI = arg('--veri', 'qa-runtime/politika/veri-0.jsonl')
N = int(arg('--n', 64))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ck = torch.load(MODEL, map_location='cpu', weights_only=False)
GX, GY, KANAL = int(ck['gx']), int(ck['gy']), 8
SDIM, BDIM, CDIM = int(ck['sdim']), int(ck['bdim']), int(ck['cdim'])
SECENEK = int(ck['secenek'])

class Model(nn.Module):
    def __init__(self, sdim, bdim, cdim):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(KANAL, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, 32, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d((3, 4)), nn.Flatten())
        self.mlp = nn.Sequential(nn.Linear(sdim, 64), nn.ReLU())
        self.bir = nn.Sequential(nn.Linear(bdim, 32), nn.ReLU())
        self.bas = nn.Sequential(nn.Linear(384 + 64 + 32 + cdim, 128), nn.ReLU(),
                                 nn.Linear(128, 1))
    def forward(self, r, s, b, c):
        ctx = torch.cat([self.cnn(r), self.mlp(s), self.bir(b)], 1)
        n, k, cd = c.shape
        ctx = ctx.unsqueeze(1).expand(n, k, ctx.shape[1])
        return self.bas(torch.cat([ctx, c], 2)).squeeze(2)

model = Model(SDIM, BDIM, CDIM)
model.load_state_dict(ck['model'])
model.eval()

# ── JS tarafini kostur ──
js = subprocess.run([('node'), os.path.join(ROOT, 'tools', 'politika-kopru-js.js'),
                     '--veri', VERI, '--n', str(N)],
                    cwd=ROOT, capture_output=True, text=True)
if js.returncode != 0:
    print('JS tarafi coktu:\n' + (js.stderr or '')[:2000]); sys.exit(1)
jd = json.loads(js.stdout)
idx = {o['i']: np.array(o['logit'], dtype=np.float64) for o in jd['ornek']}
print(f"JS ornegi: {jd['n']} karar")

satirlar = open(VERI, encoding='utf-8').read().split('\n')
R, S, B, O, KEYS = [], [], [], [], []
for i in sorted(idx):
    d = json.loads(satirlar[i])
    R.append(d['r']); S.append(d['s']); B.append(d['b']); O.append(d['o']); KEYS.append(i)

# NOT: normalizasyon .pt icindeki istatistiklerle yapilir - egitimdeki AYNI degerler.
rmu = np.asarray(ck['rmu'], dtype=np.float32); rsd = np.asarray(ck['rsd'], dtype=np.float32)
smu = np.asarray(ck['smu'], dtype=np.float32); ssd = np.asarray(ck['ssd'], dtype=np.float32)
bmu = np.asarray(ck['bmu'], dtype=np.float32); bsd = np.asarray(ck['bsd'], dtype=np.float32)
cmu = np.asarray(ck['cmu'], dtype=np.float32); csd = np.asarray(ck['csd'], dtype=np.float32)

Rn = (np.array(R, dtype=np.float32).reshape(-1, KANAL, GY, GX) - rmu) / rsd
Sn = (np.array(S, dtype=np.float32) - smu) / ssd
Bn = (np.array(B, dtype=np.float32) - bmu) / bsd

# SECENEK OZNITELIGI — egitimdeki `C` blogunun AYNISI (sira, kal?, ana, ag, farklar, dx, dy)
Oh = np.array(O, dtype=np.float32)
_n = Oh.shape[0]
_sira = np.tile(np.arange(SECENEK, dtype=np.float32), (_n, 1)) / (SECENEK - 1)
_kal = (Oh[:, :, 0] == 0).astype(np.float32)
_ana = Oh[:, :, 1]; _ag = Oh[:, :, 2]
C = np.stack([_sira, _kal, _ana, _ag, _ana - _ana[:, 0:1], _ag - _ag[:, 0:1],
              Oh[:, :, 3], Oh[:, :, 4]], axis=2).astype(np.float32)
Cn = (C - cmu) / csd

with torch.no_grad():
    py = model(torch.tensor(Rn), torch.tensor(Sn), torch.tensor(Bn),
               torch.tensor(Cn)).numpy().astype(np.float64)

jsl = np.stack([idx[k] for k in KEYS])
fark = np.abs(py - jsl)
maxf = float(fark.max())
ortf = float(fark.mean())
uyum = float((py.argmax(1) == jsl.argmax(1)).mean())

print('')
print(f'  max mutlak logit farki : {maxf:.3e}')
print(f'  ortalama fark          : {ortf:.3e}')
print(f'  argmax uyusmasi        : %{uyum*100:.1f}')
print('')
gecti = (maxf < 1e-3) and (uyum >= 1.0)
if gecti:
    print('  KAPI GECTI — JS ileri-gecisi PyTorch ile ayni. Motora baglanabilir.')
    sys.exit(0)
else:
    print('  KAPI DUSTU — JS ve PyTorch AYRISIYOR. Politika agi motora BAGLANMAMALI.')
    k = int(np.unravel_index(fark.argmax(), fark.shape)[0])
    print(f'  en kotu ornek satir {KEYS[k]}:')
    print(f'    py : {np.round(py[k][:8], 4)}')
    print(f'    js : {np.round(jsl[k][:8], 4)}')
    sys.exit(1)
