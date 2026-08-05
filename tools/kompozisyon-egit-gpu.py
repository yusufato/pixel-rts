# KOMPOZISYON -> MARJ VEKIL MODELI (GPU)
# Veri: turnuvanin KENDI ciktisi (ekstra CPU maliyeti YOK). Amac iki tane:
#   (1) ON-ELEME: kompozisyonu KOSMADAN tahmin et -> gelecekteki turnuvalar cok daha ucuz
#   (2) OZELLIK ONEMI: hangi birim paylari marji suruklyor (kor-nokta birimleri dahil)
#
# DURUSTLUK NOTU (rapora yazilir): mac-basi marj gurultusu std ~3114. Tek macin marjini
# tahmin etmenin TAVANI dusuk; asil olculmesi gereken sey ADAY ORTALAMASININ siralamasidir.
# Bu yuzden hem mac-duzeyi R^2 hem ADAY-duzeyi Spearman raporlanir; karar Spearman'a bakar.
import json, sys, math
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

VERI = arg('--veri', 'qa-runtime/kompozisyon-veri.jsonl')
EPOK = int(arg('--epok', 400))
dev = 'cuda' if torch.cuda.is_available() else 'cpu'

ad, seed, X, Y = [], [], [], []
with open(VERI, encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line: continue
        r = json.loads(line)
        ad.append(r['ad']); seed.append(r['seed']); X.append(r['x']); Y.append(r['y'])
X = np.array(X, dtype=np.float32); Y = np.array(Y, dtype=np.float32)
ad = np.array(ad); seed = np.array(seed)
print(f'veri: {len(Y)} mac, {len(set(ad))} aday, {len(set(seed))} tohum, ozellik {X.shape[1]}')
if len(set(ad)) < 40:
    print('UYARI: aday sayisi cok az, egitim anlamsiz. Turnuva ilerleyince tekrar kosun.'); sys.exit(0)

# TOHUM OFFSETI: marj buyuk olcude RAKIP ORDUSUNUN (tohum) fonksiyonu. Tohum-ortalamasi
# cikarilmazsa model kompozisyonu degil tohumu ogrenir. Bu, gurultuyu degil YANLILIGI kaldirir.
for s in set(seed.tolist()):
    m = seed == s
    Y[m] -= Y[m].mean()

# ADAY BAZLI AYIRMA (mac bazli DEGIL): ayni adayin maclari hem egitimde hem testte olursa sizinti olur
adaylar = sorted(set(ad.tolist()))
rng = np.random.default_rng(20260806); rng.shuffle(adaylar)
kes = int(len(adaylar) * 0.8)
tr_ad, te_ad = set(adaylar[:kes]), set(adaylar[kes:])
tr = np.array([a in tr_ad for a in ad]); te = ~tr

mu, sd = X[tr].mean(0), X[tr].std(0) + 1e-6
Xn = (X - mu) / sd
ys = Y[tr].std() + 1e-6

xt = torch.tensor(Xn[tr], device=dev); yt = torch.tensor(Y[tr] / ys, device=dev).unsqueeze(1)
xv = torch.tensor(Xn[te], device=dev); yv = torch.tensor(Y[te] / ys, device=dev).unsqueeze(1)

torch.manual_seed(20260806)
model = nn.Sequential(nn.Linear(X.shape[1], 128), nn.Tanh(), nn.Linear(128, 64), nn.Tanh(), nn.Linear(64, 1)).to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-3)
lossf = nn.MSELoss()
en_iyi, en_iyi_ep, bekle = 9e9, 0, 0
for ep in range(EPOK):
    model.train(); opt.zero_grad()
    l = lossf(model(xt), yt); l.backward(); opt.step()
    model.eval()
    with torch.no_grad(): vl = lossf(model(xv), yv).item()
    if vl < en_iyi - 1e-4: en_iyi, en_iyi_ep, bekle = vl, ep, 0
    else:
        bekle += 1
        if bekle > 60: break

with torch.no_grad():
    pv = model(xv).cpu().numpy().ravel() * ys
gercek = Y[te]
ss_res = ((gercek - pv) ** 2).sum(); ss_tot = ((gercek - gercek.mean()) ** 2).sum()
r2_mac = 1 - ss_res / ss_tot

# ADAY DUZEYI: tahmin ve gercek ortalamalari -> Spearman (asil karar metrigi)
def spearman(a, b):
    ra = np.argsort(np.argsort(a)).astype(float); rb = np.argsort(np.argsort(b)).astype(float)
    ra -= ra.mean(); rb -= rb.mean()
    d = (np.sqrt((ra**2).sum()) * np.sqrt((rb**2).sum()))
    return float((ra*rb).sum()/d) if d else 0.0

te_adlar = sorted(set(ad[te].tolist()))
gp, gg = [], []
for a in te_adlar:
    m = (ad == a) & te
    if m.sum() < 2: continue
    gp.append(pv[m[te]].mean() if False else pv[(ad[te] == a)].mean()); gg.append(gercek[(ad[te] == a)].mean())
rho = spearman(np.array(gp), np.array(gg)) if len(gp) > 5 else float('nan')

print(f'cihaz: {dev} | en iyi epok {en_iyi_ep}')
print(f'MAC duzeyi R^2      : {r2_mac:.3f}   (tavan dusuk - mac marji std ~3114)')
print(f'ADAY duzeyi Spearman: {rho:.3f}   ({len(gp)} tutulan aday)   <- KARAR METRIGI')
print('  yorum: rho>=0.45 ise vekil model ON-ELEME icin kullanilabilir (BEONAI-V2 kapisiyla ayni esik)')

# OZELLIK ONEMI: girdi gradyaninin mutlak ortalamasi (tum tutulan veri uzerinde)
xv.requires_grad_(True)
model(xv).sum().backward()
# ONEM = normalize girdiye gore gradyanin mutlak ortalamasi x hedef olcegi
# -> "ozellik 1 STANDART SAPMA degisirse marj kac TL degisir" (yorumlanabilir birim).
# ONCEKI HATA: ayrica /sd yapiliyordu; zorunlu-bayraklarin sd'si kucuk oldugu icin 1e9'luk
# anlamsiz sayilar cikiyordu.
onem = xv.grad.abs().mean(0).cpu().numpy() * ys
try:
    isim = json.load(open('qa-runtime/kompozisyon-ozellik-ad.json', encoding='utf-8'))
except Exception:
    isim = [f'#{i}' for i in range(len(onem))]
print('')
print('EN ETKILI 12 OZELLIK (1 std degisim -> marj etkisi, TL):')
for i in np.argsort(-onem)[:12]:
    print(f'  {isim[i]:<32} {onem[i]:8.0f}')
