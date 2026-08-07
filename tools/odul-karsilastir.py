# ODUL KARSILASTIRMASI — beonai'nin oracle'ini degistirmeden ONCE olc.
#
# SORU: oracle'in su anki miyop odulu mu, yoksa deger fonksiyonunun farki mi (DeltaV) macin
# NIHAI sonucunu daha iyi tahmin ediyor?
#   mevcut:  scalar = tradeDiff + forceLead*0.5 + terminal*800   (30sn'lik yuvarlama penceresi)
#   aday  :  DeltaV = V(t+30sn) - V(t)                            (ayni pencere, deger agi)
#
# NEDEN OLCUYORUZ: deger aginin ERKEN oyundaki dogrulugu dusuk (rho 0.397 @0-30sn). Kisa bir
# pencerede DeltaV gurultude bogulabilir. "Yeni ve parlak" olmasi daha iyi oldugu anlamina gelmez.
#
# HEDEF IKI TURLU:
#   (A) y          : macin nihai marji
#   (B) y - V(t)   : "su andan sonrasi" — artik sonuc. Asil dogru hedef budur, cunku bir KARARIN
#                    degeri, zaten bilinen konumun uzerine ne KATTIGIDIR.
#
# BOLME: yalniz AYRILMIS (test) maclar — model egitim maclarini ezberlemis olabilir.
import json, sys, os, glob
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

MODEL = arg('--model', 'qa-runtime/gece/durum-model.pt')
VERI = arg('--veri', 'qa-runtime/gece/durum-*.jsonl')
MAKS = int(arg('--maxsatir', 200000))
PENCERE = int(arg('--pencere', 600))     # tik (oracle rolloutSec=30 -> 600 tik)
ARALIK = int(arg('--aralik', 100))       # ornekleme araligi (tik)
ADIM = PENCERE // ARALIK                 # kac anlik goruntu ileri

dev = 'cuda' if torch.cuda.is_available() else 'cpu'
ck = torch.load(MODEL, map_location=dev, weights_only=False)
GX, GY, KANAL = ck['gx'], ck['gy'], 8
SDIM, YS = ck['sdim'], ck['ys']

class Model(nn.Module):
    def __init__(self, sdim):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(KANAL, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, 32, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d((3, 4)), nn.Flatten())
        self.mlp = nn.Sequential(nn.Linear(sdim, 64), nn.ReLU())
        self.bas = nn.Sequential(nn.Linear(384 + 64, 128), nn.ReLU(), nn.Linear(128, 1))
    def forward(self, r, s):
        return self.bas(torch.cat([self.cnn(r), self.mlp(s)], 1))

model = Model(SDIM).to(dev); model.load_state_dict(ck['model']); model.eval()

DOSYALAR = sorted(glob.glob(VERI)) if ('*' in VERI) else [VERI]
DOSYALAR = [d for d in DOSYALAR if os.path.exists(d)]
_n = sum(1 for d in DOSYALAR for _ in open(d, encoding='utf-8'))
STRIDE = max(1, _n // MAKS)
print(f'veri {_n} satir -> her {STRIDE}. satir ({len(DOSYALAR)} dosya)')

# ORNEKLEME MAC BAZINDA OLMALI (yakalandi): satir-bazli ornekleme mac ICINDEKI tik dizisini
# kopariyor ve t+PENCERE hicbir zaman bulunamiyor (ilk kosuda 0 cift cikti). Secilen maclarin
# TUM anlik goruntuleri korunur.
def _anahtar(line):
    # hizli alan cikarma (tam JSON parse etmeden): {"ad":"X","seed":NNNN,...
    try:
        a = line.index('"ad":"') + 6; b = line.index('"', a)
        c = line.index('"seed":', b) + 7; e = line.index(',', c)
        return line[a:b] + '#' + line[c:e]
    except Exception:
        return None

# PASS 1: tum mac anahtarlari (modelin bolmesini BIREBIR yeniden kurmak icin gerekli)
tum_set = set()
for d in DOSYALAR:
    for line in open(d, encoding='utf-8'):
        k = _anahtar(line)
        if k: tum_set.add(k)
tum = sorted(tum_set)
rng = np.random.default_rng(20260806); ml = tum[:]; rng.shuffle(ml)
kes = max(1, int(len(ml) * 0.8))
test_mac = set(ml[kes:])
# olcum icin test maclarindan bir ornek (hepsi gereksiz; bellek)
ORNEK_MAC = int(arg('--macsayi', 600))
sec = set(sorted(test_mac)[:ORNEK_MAC])
print(f'mac: {len(tum)}   ayrilmis: {len(test_mac)}   olculen ornek: {len(sec)}')

# PASS 2: yalniz secilen maclarin TUM satirlari
maclar = {}
for d in DOSYALAR:
    for line in open(d, encoding='utf-8'):
        k = _anahtar(line)
        if k not in sec: continue
        try: o = json.loads(line)
        except Exception: continue
        maclar.setdefault(k, []).append(o)

kayitlar = [(k, sorted(v, key=lambda z: z['tik'])) for k, v in maclar.items()]

R = np.array([o['r'] for _, ol in kayitlar for o in ol], dtype=np.float32).reshape(-1, KANAL, GY, GX)
S = np.array([o['s'] for _, ol in kayitlar for o in ol], dtype=np.float32)
Rn = (R - ck['rmu']) / ck['rsd']; Sn = (S - ck['smu']) / ck['ssd']
V = np.zeros(len(R), dtype=np.float32)
with torch.no_grad():
    for i in range(0, len(R), 4096):
        rt = torch.tensor(Rn[i:i+4096], device=dev); st = torch.tensor(Sn[i:i+4096], device=dev)
        V[i:i+4096] = model(rt, st).cpu().numpy().ravel() * YS

# ── pencere ciftleri: t -> t+PENCERE ──
dv, oracle, hedefY, hedefArtik, hedefKuvvet, anlar = [], [], [], [], [], []
p = 0
for k, ol in kayitlar:
    n = len(ol)
    idx = {o['tik']: p + j for j, o in enumerate(ol)}
    for j, o in enumerate(ol):
        t2 = o['tik'] + PENCERE
        if t2 not in idx: continue
        i1, i2 = p + j, idx[t2]
        o2 = ol[[z['tik'] for z in ol].index(t2)]
        # oracle skalari anlik goruntu skalerlerinden yeniden kurulur:
        #   skaler[1] = kDeger/6500, skaler[2] = mDeger/6500  (kalan DEGER paylari)
        k1, m1 = o['s'][1] * 6500, o['s'][2] * 6500
        k2, m2 = o2['s'][1] * 6500, o2['s'][2] * 6500
        ownLost, enemyLost = max(0.0, k1 - k2), max(0.0, m1 - m2)
        tradeDiff = enemyLost - ownLost
        forceLead = k2 - m2
        oracle.append(tradeDiff + forceLead * 0.5)     # terminal*800 pencere ICINDE 0
        dv.append(float(V[i2] - V[i1]))
        hedefY.append(float(o['y']))
        hedefArtik.append(float(o['y']) - float(V[i1]))
        # (C) MODEL-BAGIMSIZ TABAN: itiraz hakli — (B)'nin tabani V(t)'nin KENDISI, yani DeltaV
        # kendi tabanina karsi olculuyor. Bu hedef tabani modelden DEGIL, sahadaki kalan kuvvet
        # farkindan alir; hicbir model bilgisi icermez.
        hedefKuvvet.append(float(o['y']) - (k1 - m1))
        anlar.append(o['tik'])
    p += n

dv = np.array(dv); oracle = np.array(oracle)
hedefY = np.array(hedefY); hedefArtik = np.array(hedefArtik)
hedefKuvvet = np.array(hedefKuvvet); anlar = np.array(anlar)
print(f'pencere cifti: {len(dv)}')

def spearman(a, b):
    if len(a) < 3: return float('nan')
    ra = np.argsort(np.argsort(a)).astype(float); rb = np.argsort(np.argsort(b)).astype(float)
    ra -= ra.mean(); rb -= rb.mean()
    d = np.sqrt((ra**2).sum()) * np.sqrt((rb**2).sum())
    return float((ra*rb).sum()/d) if d else 0.0

print('')
print('  ' + 'hedef'.ljust(26) + 'oracle (tradeDiff)'.rjust(20) + 'DeltaV'.rjust(12) + '   kazanan')
for ad, h in [('(A) nihai marj y', hedefY), ('(B) ARTIK  y - V(t)', hedefArtik),
              ('(C) ARTIK  y - kuvvetFarki(t)', hedefKuvvet)]:
    a, b = spearman(oracle, h), spearman(dv, h)
    print('  ' + ad.ljust(26) + f'{a:.3f}'.rjust(20) + f'{b:.3f}'.rjust(12) +
          '   ' + ('DeltaV' if abs(b) > abs(a) else 'oracle'))

print('')
print('  ZAMANA GORE (hedef: (C) MODEL-BAGIMSIZ artik y - kuvvetFarki) — kararin en cok onem tasidigi yer ERKEN oyundur')
print('  ' + 'an'.ljust(12) + 'cift'.rjust(8) + 'oracle'.rjust(10) + 'DeltaV'.rjust(10) + '   kazanan')
for alt, ust, ad in [(0,600,'0-30sn'),(600,1400,'30-70sn'),(1400,2400,'70-120sn'),
                     (2400,4000,'120-200sn'),(4000,99999,'200sn+')]:
    m = (anlar >= alt) & (anlar < ust)
    if m.sum() < 50: continue
    a, b = spearman(oracle[m], hedefKuvvet[m]), spearman(dv[m], hedefKuvvet[m])
    print('  ' + ad.ljust(12) + str(int(m.sum())).rjust(8) + f'{a:.3f}'.rjust(10) + f'{b:.3f}'.rjust(10) +
          '   ' + ('DeltaV' if abs(b) > abs(a) else 'oracle'))

# ── KARISIM TARAMASI: iki sinyal de tek basina yetmiyor (oracle erken-orta, DeltaV gec oyunda
# kazaniyor ve oracle 200sn+ NEGATIFE dusuyor). Agirligi TAHMIN etmeyip TARIYORUZ.
# Olcekleri cok farkli oldugu icin once z-skorlanir; Spearman siralama-bazli oldugu icin
# karisim ancak standardizasyondan sonra anlamlidir.
def _z(x):
    sd = x.std()
    return (x - x.mean()) / (sd if sd else 1.0)
zo, zd = _z(oracle), _z(dv)
print('')
print('  KARISIM TARAMASI  (hedef: (C) model-bagimsiz artik)   karisim = w*DeltaV + (1-w)*oracle')
print('  ' + 'w'.rjust(5) + 'genel'.rjust(9) + '0-30sn'.rjust(9) + '30-70'.rjust(8) + '70-120'.rjust(8) +
      '120-200'.rjust(9) + '200sn+'.rjust(9))
bantlar = [(0,600),(600,1400),(1400,2400),(2400,4000),(4000,99999)]
enIyi = (None, -9)
for w in [0.0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0]:
    kar = w * zd + (1 - w) * zo
    genel = spearman(kar, hedefKuvvet)
    if genel > enIyi[1]: enIyi = (w, genel)
    satir = '  ' + f'{w:.1f}'.rjust(5) + f'{genel:.3f}'.rjust(9)
    for alt, ust in bantlar:
        m = (anlar >= alt) & (anlar < ust)
        satir += (f'{spearman(kar[m], hedefKuvvet[m]):.3f}'.rjust(9 if (alt,ust) in [(0,600),(2400,4000),(4000,99999)] else 8))
    print(satir)
print('')
print(f'  EN IYI SABIT AGIRLIK: w={enIyi[0]:.1f}  (genel rho {enIyi[1]:.3f})')
print(f'    w=0 (yalniz oracle) {spearman(zo, hedefKuvvet):.3f}   w=1 (yalniz DeltaV) {spearman(zd, hedefKuvvet):.3f}')

# ZAMANA GORE DEGISEN AGIRLIK: her bandin kendi en iyisi
print('')
print('  BANT BASINA EN IYI AGIRLIK (zamana gore degisen odul mumkun mu):')
for alt, ust, ad in [(0,600,'0-30sn'),(600,1400,'30-70sn'),(1400,2400,'70-120sn'),
                     (2400,4000,'120-200sn'),(4000,99999,'200sn+')]:
    m = (anlar >= alt) & (anlar < ust)
    if m.sum() < 50: continue
    en = max(((w, spearman(w*zd[m] + (1-w)*zo[m], hedefKuvvet[m])) for w in
              [0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0]), key=lambda z: z[1])
    print('    ' + ad.ljust(12) + f'w={en[0]:.1f}'.rjust(7) + f'   rho {en[1]:.3f}')

print('')
print('  OKUMA: DeltaV her bantta kazanmiyorsa KORU-VE-KARISTIR dogru olabilir (iki sinyalin')
print('         agirlikli toplami). "Yeni olan daha iyidir" varsayimi bu projede 3 kez yanildi.')
