# BEDAVA ETIKET AGI: (durum, birim, GIDILEN YON) -> birimin KENDI kredi hanesindeki degisim
#
# ═══ NEDEN: bugun UC olcum "veri az" dedi ═══
#   · genislik x4 dogrulugu DUSURUYOR (61 bin ornekte ezberleme)
#   · birim-kosullu ag 33 mactan genelleyemedi (4 formulasyon, hepsi taban alti)
#   · kisa-ufuk agi rho 0.416'da plato
# Ucu de ayni kisit. Bedava etiket o kisiti dogrudan hedefler:
#     aramali toplama  42 mac  -> 121 bin ornek, ~55 dk
#     BEDAVA           540 mac -> 626 bin ornek, ~20 dk
#
# Ve bu bir veri hilesi degil: AlphaStar ARAMA KULLANMADI, 971.000 oynanmis mactan
# gozetimli ogrenmeyle basladi. Bu, o tarifin birinci asamasi.
#
# ═══ ASIL SINAV: BASKA VERI SETINDE ═══
# Ag bedava etiketle egitilir ama ROLLOUT veri setinde sinanir — bugun dort formulasyonun
# dustugu AYNI kapida: "ayni kararda en iyi adayi bulabiliyor mu?" (taban: eleyici %51.0)
# Bu, cross-dataset bir sinav: egitim ve test FARKLI dagilimlardan, yani genelleme
# gercekten olculuyor.
#
#   python tools/bedava-egit-gpu.py --veri qa-runtime/bedava --sinav qa-runtime/politika
import json, sys, os, glob as _glob
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

VERI = arg('--veri', 'qa-runtime/bedava')
SINAV = arg('--sinav', 'qa-runtime/politika')
EPOK = int(arg('--epok', 60))
KAYDET = arg('--kaydet')
GX, GY, KANAL = 16, 10, 8
MAKS = int(arg('--maxsatir', 260000))
G = float(arg('--genislik', 1))
dev = 'cuda' if torch.cuda.is_available() else 'cpu'

def dosyalar(p):
    return sorted(_glob.glob(os.path.join(p, '*.jsonl'))) if os.path.isdir(p) else _glob.glob(p)

# ── EGITIM: bedava etiketler ──
D = [d for d in dosyalar(VERI) if os.path.exists(d)]
if not D: print(f'veri yok: {VERI}'); sys.exit(1)
_n = 0
for d in D:
    with open(d, encoding='utf-8') as f:
        for _ in f: _n += 1
ADIM = max(1, _n // MAKS)
print(f'bedava etiket: {_n} satir -> her {ADIM}. satir (bellek kapisi {MAKS})')

R, S, B, DXY, Y, MACID = [], [], [], [], [], []
_i = -1
for d in D:
    with open(d, encoding='utf-8') as f:
        for line in f:
            _i += 1
            if _i % ADIM: continue
            line = line.strip()
            if not line: continue
            try: o = json.loads(line)
            except Exception: continue
            R.append(o['r']); S.append(o['s']); B.append(o['b']); DXY.append(o['d'])
            Y.append(float(o['y'])); MACID.append(o['seed'])

R = np.array(R, dtype=np.float32).reshape(-1, KANAL, GY, GX)
S = np.array(S, dtype=np.float32); B = np.array(B, dtype=np.float32)
C = np.array(DXY, dtype=np.float32); Y = np.array(Y, dtype=np.float32)
MACID = np.array(MACID)
print(f'egitim ornegi: {len(Y)}   mac: {len(set(MACID.tolist()))}')
print(f'  etiket: std {Y.std():.1f}   sifirdan farkli %{(np.abs(Y) > 1e-6).mean()*100:.1f}')

# MAC BAZINDA bolme (sizinti kapisi — ayni macin kayitlari birbirine cok benzer)
rng = np.random.default_rng(20260817)
ml = sorted(set(MACID.tolist())); rng.shuffle(ml)
tr_mac = set(ml[:max(1, int(len(ml) * 0.85))])
tr = np.array([m in tr_mac for m in MACID]); va = ~tr
print(f'  egitim {tr.sum()} / {len(tr_mac)} mac   dogrulama {va.sum()} / {len(ml)-len(tr_mac)} mac')

rmu, rsd = R[tr].mean((0,2,3), keepdims=True), R[tr].std((0,2,3), keepdims=True) + 1e-6
smu, ssd = S[tr].mean(0), S[tr].std(0) + 1e-6
bmu, bsd = B[tr].mean(0), B[tr].std(0) + 1e-6
cmu, csd = C[tr].mean(0), C[tr].std(0) + 1e-6
ys = Y[tr].std() + 1e-6
Rn = (R - rmu) / rsd; Sn = (S - smu) / ssd; Bn = (B - bmu) / bsd; Cn = (C - cmu) / csd

_C1 = max(8, int(32*G)); _MH = max(16, int(64*G)); _BH = max(32, int(128*G))
class Model(nn.Module):
    def __init__(self, sdim, bdim, cdim):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(KANAL, _C1, 3, padding=1), nn.ReLU(),
            nn.Conv2d(_C1, _C1, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d((3, 4)), nn.Flatten())
        self.mlp = nn.Sequential(nn.Linear(sdim, _MH), nn.ReLU())
        self.bir = nn.Sequential(nn.Linear(bdim + cdim, _MH), nn.ReLU())
        self.bas = nn.Sequential(nn.Linear(_C1*12 + _MH*2, _BH), nn.ReLU(), nn.Linear(_BH, 1))
    def forward(self, r, s, b, c):
        return self.bas(torch.cat([self.cnn(r), self.mlp(s), self.bir(torch.cat([b, c], 1))], 1))

torch.manual_seed(20260817)
model = Model(S.shape[1], B.shape[1], C.shape[1]).to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
lossf = nn.MSELoss()
T = lambda x, m: torch.tensor(x[m], device=dev)
rt, st, bt, ct = T(Rn,tr), T(Sn,tr), T(Bn,tr), T(Cn,tr)
yt = torch.tensor(Y[tr]/ys, device=dev).unsqueeze(1)
rv, sv, bv, cv = T(Rn,va), T(Sn,va), T(Bn,va), T(Cn,va)
yv = torch.tensor(Y[va]/ys, device=dev).unsqueeze(1)

N = rt.shape[0]; PARTI = min(512, N)
en_iyi, bekle, durum = 9e9, 0, None
for ep in range(EPOK):
    model.train()
    perm = torch.randperm(N, device=dev)
    for i in range(0, N, PARTI):
        ix = perm[i:i+PARTI]
        opt.zero_grad(); lossf(model(rt[ix], st[ix], bt[ix], ct[ix]), yt[ix]).backward(); opt.step()
    model.eval()
    with torch.no_grad(): vl = lossf(model(rv, sv, bv, cv), yv).item()
    if vl < en_iyi - 1e-4:
        en_iyi, bekle = vl, 0
        durum = {k: v.detach().clone() for k, v in model.state_dict().items()}
    else:
        bekle += 1
        if bekle > 12: break
if durum: model.load_state_dict(durum)
print(f'cihaz {dev} | epok {ep+1} | dogrulama kaybi {en_iyi:.4f}')

# ═══════════════ ASIL SINAV: ROLLOUT VERI SETINDE SIRALAMA ═══════════════
SD = [d for d in dosyalar(SINAV) if os.path.exists(d)]
if not SD:
    print(f'sinav verisi yok: {SINAV}'); sys.exit(0)
sR, sS, sB, sC, sAG, sY, sKARAR = [], [], [], [], [], [], []
for d in SD:
    with open(d, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try: o = json.loads(line)
            except Exception: continue
            if o.get('b') is None or not o.get('o'): continue
            k = (os.path.basename(d), o['tik'], tuple(o['b'][:3]))
            for c in o['o']:
                if len(c) < 6 or c[5] is None: continue
                sR.append(o['r']); sS.append(o['s']); sB.append(o['b'])
                sC.append([c[3], c[4]])      # dx, dy — bedava agin gordugu tek aday bilgisi
                sAG.append(c[2])             # eleyici skoru (TABAN)
                sY.append(float(c[5])); sKARAR.append(k)
if len(sY) < 500: print('sinav verisi az'); sys.exit(0)
sR = np.array(sR, dtype=np.float32).reshape(-1, KANAL, GY, GX)
sS = np.array(sS, dtype=np.float32); sB = np.array(sB, dtype=np.float32)
sC = np.array(sC, dtype=np.float32); sAG = np.array(sAG, dtype=np.float32)
sY = np.array(sY, dtype=np.float32)

sRn = (sR - rmu) / rsd; sSn = (sS - smu) / ssd
sBn = (sB - bmu) / bsd; sCn = (sC - cmu) / csd
with torch.no_grad():
    tah = model(torch.tensor(sRn, device=dev), torch.tensor(sSn, device=dev),
                torch.tensor(sBn, device=dev), torch.tensor(sCn, device=dev)).cpu().numpy().ravel()

grup = {}
for i, k in enumerate(sKARAR): grup.setdefault(k, []).append(i)
def siralama(p):
    d = t = 0
    for idx in grup.values():
        if len(idx) < 2: continue
        if int(np.argmax([p[i] for i in idx])) == int(np.argmax([sY[i] for i in idx])): d += 1
        t += 1
    return (d / t if t else float('nan')), t

a_ag, n = siralama(sAG)
a_net, _ = siralama(tah)
rasgele = np.mean([1.0 / len(idx) for idx in grup.values() if len(idx) >= 2])
print('')
print(f'ASIL SINAV — rollout veri setinde karar-ici siralama ({n} karar)')
print(f'  rastgele secim               : %{rasgele*100:.1f}')
print(f'  bugunku eleyici (TABAN)      : %{a_ag*100:.1f}')
print(f'  BEDAVA ETIKET AGI            : %{a_net*100:.1f}')
print(f'  tabana gore: {(a_net-a_ag)*100:+.1f} puan')
print('')
print('  NOT: bedava ag adayin YALNIZ yonunu (dx,dy) goruyor — eleyicinin skorunu,')
print('       araziyi, tehdidi GORMUYOR. Tabanla esitlenmesi bile guclu sonuc olurdu.')

if KAYDET:
    os.makedirs(os.path.dirname(KAYDET) or '.', exist_ok=True)
    torch.save({'model': model.state_dict(), 'rmu': rmu, 'rsd': rsd, 'smu': smu, 'ssd': ssd,
                'bmu': bmu, 'bsd': bsd, 'cmu': cmu, 'csd': csd, 'ys': float(ys),
                'sdim': int(S.shape[1]), 'bdim': int(B.shape[1]), 'cdim': int(C.shape[1]),
                'siralama': a_net, 'taban': a_ag, 'ornek': int(len(Y))}, KAYDET)
    print(f'\nmodel kaydedildi: {KAYDET}')
