# DURUM -> NIHAI SONUC DEGER AGI (GPU)
# Kullanici: "vekil modeli buyutelim, tum maci tarasin, GPU tum birimleri gozlerinden gorebilir."
#
# Kompozisyon modeli maci KOSMADAN tahmin ediyordu (rho 0.529). Bu onun ust seviyesi: macin
# HERHANGI BIR ANINDAN nihai marji tahmin etmek.
#
# GIRDI IKI PARCALI:
#   RASTER  8 x GY x GX  - sahanin cok kanalli "goruntusu" (kendi/dusman deger, HP, dolayli, hava)
#                          -> KUCUK CNN. GPU'nun gercekten parladigi bicim.
#   SKALER  ~38          - oran, temas, muhimmat, panik, kategori paylari -> MLP
#
# KRITIK: BOLME MAC BAZINDA. Ayni macin anlik goruntuleri birbirine COK benzer; goruntu bazinda
# bolmek egitim ve testi ayni maclarla doldurur (SIZINTI) ve rho'yu sahte sekilde yukseltir.
# Bu tuzagin kardesini kompozisyon modelinde de yasadik (orada ADAY bazinda bolunmustu).
#
# ASIL CIKTI: rho'nun ZAMANA gore kirilimi - "macin hangi aninda sonucu ne kadar biliyoruz".
# Erken durdurma ve beonai'nin odul sinyali bu egriden okunur.
import json, sys, os
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

# COKLU DOSYA (gece kosusu): 9 isci 9 ayri dosyaya yazar. Onlari TEK dosyada birlestirmek
# 3+ GB'lik senkron kopyalama demek ve orkestratoru OLDURDU (bellek). Egitim dosyalari
# DOGRUDAN okur: birlestirme adimi tamamen kaldirildi. Virgulle ayrilmis liste ya da glob.
import glob as _glob
VERI = arg('--veri', 'qa-runtime/durum-veri.jsonl')
DOSYALAR = []
for _p in VERI.split(','):
    _p = _p.strip()
    DOSYALAR.extend(sorted(_glob.glob(_p)) if ('*' in _p or '?' in _p) else [_p])
DOSYALAR = [d for d in DOSYALAR if os.path.exists(d)]
if not DOSYALAR:
    print(f'veri dosyasi bulunamadi: {VERI}'); sys.exit(1)
EPOK = int(arg('--epok', 300))
KAYDET = arg('--kaydet')
GX = int(arg('--gx', 16)); GY = int(arg('--gy', 10)); KANAL = 8
dev = 'cuda' if torch.cuda.is_available() else 'cpu'

# BELLEK KAPISI (gece kosusu): 6 isci 5+ saat toplayinca veri 7-11 GB olur ve TUM dosyayi
# belege okumak egitimi oldurur. ARALIKLI ORNEKLEME: dosya once sayilir, sonra her k'inci satir
# alinir. Ornekleme MAC-BAZLI degil satir-bazli oldugu icin mac-basli bolme yine gecerli kalir.
MAKS = int(arg('--maxsatir', 300000))
_n = 0
for _d in DOSYALAR:
    with open(_d, encoding='utf-8') as f:
        for _ in f: _n += 1
ADIM = max(1, _n // MAKS) if MAKS > 0 else 1
if ADIM > 1:
    print(f'veri {_n} satir -> her {ADIM}. satir alinacak (bellek kapisi {MAKS})')

_bozuk = 0
R, S, Y, W, MAC, TIK, BITIS = [], [], [], [], [], [], []
_i = -1
for _d in DOSYALAR:
  with open(_d, encoding='utf-8') as f:
    for line in f:
        _i += 1
        if _i % ADIM: continue
        line = line.strip()
        if not line: continue
        # BOZUK SATIR KORUMASI: isciler oldurulunce son satir YARIM kalabilir; tek bir bozuk
        # satir tum egitimi dusurmemeli (gece kosusu sabaha bos donmesin).
        try:
            d = json.loads(line)
        except Exception:
            _bozuk += 1
            continue
        R.append(d['r']); S.append(d['s']); Y.append(d['y']); W.append(d['kazandi'])
        MAC.append(d['ad'] + '#' + str(d['seed'])); TIK.append(d['tik']); BITIS.append(d['bitisTik'])

if len(Y) < 200:
    print(f'veri az ({len(Y)} goruntu) - egitim anlamsiz. tools/durum-veri.js ile daha cok mac toplayin.')
    sys.exit(0)

R = np.array(R, dtype=np.float32).reshape(-1, KANAL, GY, GX)
S = np.array(S, dtype=np.float32)
Y = np.array(Y, dtype=np.float32)
W = np.array(W, dtype=np.float32)
MAC = np.array(MAC); TIK = np.array(TIK, dtype=np.float32); BITIS = np.array(BITIS, dtype=np.float32)
maclar = sorted(set(MAC.tolist()))
if _bozuk: print(f'atlanan bozuk satir: {_bozuk}')
print(f'veri: {len(Y)} anlik goruntu, {len(maclar)} mac, raster {KANAL}x{GY}x{GX}, skaler {S.shape[1]}')
if len(maclar) < 20:
    print(f'UYARI: yalnizca {len(maclar)} mac - mac-bazli bolme anlamli olmaz, daha cok mac toplayin.')

# MAC BAZINDA bolme (SIZINTI korumasi)
rng = np.random.default_rng(20260806); ml = maclar[:]; rng.shuffle(ml)
kes = max(1, int(len(ml) * 0.8))
tr_mac = set(ml[:kes])
tr = np.array([m in tr_mac for m in MAC]); te = ~tr
print(f'  egitim {tr.sum()} goruntu / {len(tr_mac)} mac   test {te.sum()} / {len(ml)-len(tr_mac)} mac')

# Normalizasyon YALNIZ egitim kumesinden
rmu, rsd = R[tr].mean((0,2,3), keepdims=True), R[tr].std((0,2,3), keepdims=True) + 1e-6
smu, ssd = S[tr].mean(0), S[tr].std(0) + 1e-6
ys = Y[tr].std() + 1e-6
Rn = (R - rmu) / rsd; Sn = (S - smu) / ssd

class Model(nn.Module):
    def __init__(self, sdim):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(KANAL, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, 32, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d((3, 4)), nn.Flatten())          # 32*3*4 = 384
        self.mlp = nn.Sequential(nn.Linear(sdim, 64), nn.ReLU())
        self.bas = nn.Sequential(nn.Linear(384 + 64, 128), nn.ReLU(), nn.Linear(128, 1))
    def forward(self, r, s):
        return self.bas(torch.cat([self.cnn(r), self.mlp(s)], 1))

torch.manual_seed(20260806)
model = Model(S.shape[1]).to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
lossf = nn.MSELoss()

rt = torch.tensor(Rn[tr], device=dev); stt = torch.tensor(Sn[tr], device=dev)
yt = torch.tensor(Y[tr] / ys, device=dev).unsqueeze(1)
rv = torch.tensor(Rn[te], device=dev); sv = torch.tensor(Sn[te], device=dev)
yv = torch.tensor(Y[te] / ys, device=dev).unsqueeze(1)

N = rt.shape[0]; PARTI = min(256, N)
en_iyi, bekle, en_iyi_durum = 9e9, 0, None
for ep in range(EPOK):
    model.train()
    perm = torch.randperm(N, device=dev)
    for i in range(0, N, PARTI):
        ix = perm[i:i+PARTI]
        opt.zero_grad()
        lossf(model(rt[ix], stt[ix]), yt[ix]).backward()
        opt.step()
    model.eval()
    with torch.no_grad(): vl = lossf(model(rv, sv), yv).item()
    if vl < en_iyi - 1e-4:
        en_iyi, bekle = vl, 0
        en_iyi_durum = {k: v.detach().clone() for k, v in model.state_dict().items()}
    else:
        bekle += 1
        if bekle > 40: break
if en_iyi_durum: model.load_state_dict(en_iyi_durum)

with torch.no_grad():
    pv = model(rv, sv).cpu().numpy().ravel() * ys
gercek = Y[te]

def spearman(a, b):
    if len(a) < 3: return float('nan')
    ra = np.argsort(np.argsort(a)).astype(float); rb = np.argsort(np.argsort(b)).astype(float)
    ra -= ra.mean(); rb -= rb.mean()
    d = np.sqrt((ra**2).sum()) * np.sqrt((rb**2).sum())
    return float((ra*rb).sum()/d) if d else 0.0

rho_hepsi = spearman(pv, gercek)
isaret = float(((pv > 0) == (gercek > 0)).mean())
print(f'cihaz {dev} | en iyi epok kaybi {en_iyi:.4f}')
print(f'TUM GORUNTULER  Spearman {rho_hepsi:.3f}   isaret dogrulugu %{isaret*100:.0f}')
print('')
print('ZAMANA GORE KIRILIM  — "macin hangi aninda sonucu ne kadar biliyoruz"')
print('  an'.ljust(12) + 'goruntu'.rjust(9) + 'Spearman'.rjust(10) + '  isaret%'.rjust(9))
tik_te = TIK[te]
for alt, ust, ad in [(0,600,'0-30sn'),(600,1400,'30-70sn'),(1400,2400,'70-120sn'),
                     (2400,4000,'120-200sn'),(4000,9999,'200sn+')]:
    m = (tik_te >= alt) & (tik_te < ust)
    if m.sum() < 10: continue
    print('  ' + ad.ljust(10) + str(int(m.sum())).rjust(9) +
          f'{spearman(pv[m], gercek[m]):.3f}'.rjust(10) +
          f'%{((pv[m] > 0) == (gercek[m] > 0)).mean()*100:.0f}'.rjust(9))
print('')
print('  KAPI (../docs/battle-ai/plans/PLAN-BEONAI-V2-ODUL.md): rho >= 0.45 ve kazanan ayrimi >= %70')
print('  -> saglanirsa (1) beonai icin gercek odul sinyali, (2) kalibre erken durdurma')

if KAYDET:
    os.makedirs(os.path.dirname(KAYDET) or '.', exist_ok=True)
    torch.save({'model': model.state_dict(), 'rmu': rmu, 'rsd': rsd, 'smu': smu, 'ssd': ssd,
                'ys': float(ys), 'sdim': int(S.shape[1]), 'gx': GX, 'gy': GY,
                'rho': rho_hepsi, 'goruntu': int(len(Y)), 'mac': len(maclar)}, KAYDET)
    print(f'model kaydedildi: {KAYDET}')
