# BIRIM-KOSULLU DEGER AGI: (durum, BIRIM, ADAY) -> rollout'un o adaya verdigi skor
#
# ═══ NEDEN: mevcut deger agi HANGI BIRIMI sordugumuzu BILMIYOR ═══
# Ag girdisi 10x16 izgaraya ezilmis toplam deger/HP. Harita ~4000px ise bir hucre
# ~250px; 45 birimlik orduda TEK birim bir hucrenin kutlesinin ~%2'si. Arama o birimi
# 600px oynatip "deger ne oldu" diye sordugunda agin gordugu degisim iki hucrede
# %2'lik kayma. Yani soru girdide YOK.
#
# OLCULEN IZLER (hepsi ayni koke cikiyor):
#   · ag farklari analitikten ~30 KAT kucuk -> LA_AG_ESIK 120'den 15'e inmek zorunda kaldi
#   · 25x25 ortak isinlama rollout'la yalniz %43 ortusuyor, tek tarafliyi gecemiyor
#   · genislik supurmesi: x1 rho 0.408 · x2 0.414 · x4 0.385 (KOTULESIYOR)
#     -> sinir KAPASITE DEGIL. Parametre eklemek girdide olmayan bilgiyi uretmez.
#
# KANIT KI DUZELTME ISE YARIYOR: politika aginda TAM AYNI hata vardi (secenekler
# girdide yoktu, tahminlerin %94'u tek cevaba coktu). Secenekler girdiye konunca
# taban %45 -> %58.1.
#
# ═══ HEDEF SECIMI (kritik) ═══
# "10sn sonraki marj degisimi" KULLANILAMAZ: o sayi, o andaki TUM birimler icin
# AYNIDIR. Ona "hangi birim" girdisi eklenirse ag onu GURULTU olarak ogrenir.
# Dogru hedef ROLLOUT SKORU: hem birime hem adaya bagli, ve zaten hesaplaniyordu —
# yalnizca atiliyordu (js/BattleLookahead.js, `a._skor`).
#
# BASARI = isinlama rollout'un YERINE gecebilir. GPU'nun 1600x carpanini
# harcanabilir kilan doviz kuru budur: GPU simulasyon satin alamaz, degerlendirme
# satin alir — ve ancak degerlendirme simulasyonun yerini tutarsa ise yarar.
#
# ═══ KAPI ═══
# TABAN = bugunku eleyici (`_ag`, tek tarafli isinlama). Onunla rollout skoru
# arasindaki korelasyon zaten olculebilir; ag ONU acik ara gecmeli.
#
#   python tools/birim-deger-egit-gpu.py --veri qa-runtime/politika
import json, sys, os, glob as _glob
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

VERI = arg('--veri', 'qa-runtime/politika')
EPOK = int(arg('--epok', 200))
KAYDET = arg('--kaydet')
GX = int(arg('--gx', 16)); GY = int(arg('--gy', 10)); KANAL = 8
MAKS = int(arg('--maxsatir', 400000))
G = float(arg('--genislik', 1))
dev = 'cuda' if torch.cuda.is_available() else 'cpu'

DOSYALAR = sorted(_glob.glob(os.path.join(VERI, '*.jsonl'))) if os.path.isdir(VERI) else _glob.glob(VERI)
DOSYALAR = [d for d in DOSYALAR if os.path.exists(d)]
if not DOSYALAR:
    print(f'veri bulunamadi: {VERI}'); sys.exit(1)

# Her ADAY ayri bir ornek: (durum, birim, aday) -> skor
R, S, B, C, Y, MAC, TIK = [], [], [], [], [], [], []
_atlanan = 0
for d in DOSYALAR:
    with open(d, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try: o = json.loads(line)
            except Exception: continue
            if o.get('b') is None or not o.get('o'): continue
            mac = os.path.basename(d) + '#' + str(o.get('nihai', 0))
            for c in o['o']:
                # c = [sinif, analitik, ag, dx, dy, ROLLOUT_SKOR]
                if len(c) < 6 or c[5] is None:
                    _atlanan += 1; continue     # oynatilmamis aday: ETIKETI YOK
                R.append(o['r']); S.append(o['s']); B.append(o['b'])
                # c = [sinif, analitik, ag, dx, dy, SKOR, orman, siper, ikmal, yukselti,
                #      tehditDeger, tehditSay]
                C.append([1.0 if (c[0] == 0) else 0.0,   # "yerinde kal" bayragi
                          c[1], c[2], c[3], c[4]]        # analitik, ag, dx, dy
                         + [float(x) for x in (c[6:12] if len(c) >= 12 else [0]*6)])
                Y.append(float(c[5]))
                MAC.append(mac); TIK.append(o['tik'])
            if len(Y) > MAKS: break

if _atlanan: print(f'etiketsiz aday atlandi: {_atlanan}')
# --min: yalniz BICIM DOGRULAMA kosulari icin dusurulur; gercek egitimde elleme.
MIN = int(arg('--min', 1000))
if len(Y) < MIN:
    print(f'ornek az ({len(Y)}, esik {MIN}) - egitim anlamsiz.'); sys.exit(0)

R = np.array(R, dtype=np.float32).reshape(-1, KANAL, GY, GX)
S = np.array(S, dtype=np.float32); B = np.array(B, dtype=np.float32)
C = np.array(C, dtype=np.float32); Y = np.array(Y, dtype=np.float32)
MAC = np.array(MAC); TIK = np.array(TIK, dtype=np.float32)
maclar = sorted(set(MAC.tolist()))
print(f'ornek: {len(Y)} aday / {len(maclar)} mac   (durum {KANAL}x{GY}x{GX} + skaler {S.shape[1]} + birim {B.shape[1]} + aday {C.shape[1]})')

rng = np.random.default_rng(20260817)
ml = maclar[:]; rng.shuffle(ml)
tr_mac = set(ml[:max(1, int(len(ml) * 0.8))])
tr = np.array([m in tr_mac for m in MAC]); te = ~tr
print(f'  egitim {tr.sum()} / {len(tr_mac)} mac   test {te.sum()} / {len(ml)-len(tr_mac)} mac')
if te.sum() < 200: print('  ! TEST KUMESI YETERSIZ'); sys.exit(0)

def spearman(a, b):
    if len(a) < 3: return float('nan')
    ra = np.argsort(np.argsort(a)).astype(float); rb = np.argsort(np.argsort(b)).astype(float)
    ra -= ra.mean(); rb -= rb.mean()
    d = np.sqrt((ra**2).sum()) * np.sqrt((rb**2).sum())
    return float((ra*rb).sum()/d) if d else 0.0

# ── TABAN: bugunku eleyici (tek tarafli isinlama skoru `_ag`, C[:,2]) ──
rho_taban = spearman(C[te][:, 2], Y[te])
print('')
print(f'TABAN (bugunku eleyici `_ag`) ile rollout skoru: Spearman {rho_taban:.3f}')

# ── ASIL KAPI: KARAR ICI SIRALAMA ──
# Genel korelasyon yaniltici olabilir (maclar arasi seviye farki onu sisirir). Aramanin
# ihtiyaci AYNI KARARDA adaylari dogru siralamak. O yuzden karar-ici sira uyusmasi olculur.
# Test satirlarinin GLOBAL indisi -> tahmin dizisindeki YERI. Bir kez kurulur:
# ic ice dogrusal arama 100k ornekte O(n^2) olup egitimi asardi.
_te_idx = np.where(te)[0]
_yer = {int(g): j for j, g in enumerate(_te_idx)}
_gruplar = {}
for g in _te_idx:
    # Ayni KARAR = ayni mac + ayni tik + ayni birim. Birim kimligi olarak ozniteligi
    # kullaniyoruz (kayitta id yok); ayni tikte iki birimin ozniteligi birebir ayni
    # olma ihtimali pratikte sifir (konum float).
    _gruplar.setdefault((MAC[g], TIK[g], tuple(B[g])), []).append(int(g))

def karar_ici(pred):
    dogru = 0; toplam = 0
    for idx in _gruplar.values():
        if len(idx) < 2: continue
        p = [pred[_yer[i]] for i in idx]
        gg = [Y[i] for i in idx]
        if int(np.argmax(p)) == int(np.argmax(gg)): dogru += 1
        toplam += 1
    return (dogru / toplam if toplam else float('nan')), toplam

# ── ABLASYON: hangi oznitelik grubu GERCEKTEN katki yapiyor? ──
# Toplama pahali (saat), egitim bedava (saniye). O yuzden ZENGIN toplanir ve
# atfetme egitimde yapilir — her grubu ayri ayri kapatip farki olcerek.
# "Bir ton girdi ekle" tuzagina karsi tek savunma budur: eklenen her alanin
# KENDI katkisi gorunur olur, aksi halde olu alanlar sessizce gurultu tasir.
KAPAT = set((arg('--kapat', '') or '').split(',')) - {''}
_C_AD = ['kal', 'analitik', 'ag', 'dx', 'dy', 'orman', 'siper', 'ikmal', 'yukselti', 'tehditDeger', 'tehditSay']
_GRUP = {
    'aday-geometri': ['dx', 'dy'],
    'ucuz-skor':     ['analitik', 'ag'],
    'arazi':         ['orman', 'siper', 'ikmal', 'yukselti'],
    'tehdit':        ['tehditDeger', 'tehditSay'],
}
if KAPAT:
    _kapali = set()
    for g in KAPAT:
        if g in _GRUP: _kapali.update(_GRUP[g])
        elif g == 'birim-hazirlik': pass          # B icinde, asagida
        else: print(f'  ! bilinmeyen grup: {g}')
    for ad in _kapali:
        if ad in _C_AD: C[:, _C_AD.index(ad)] = 0.0
    if 'birim-hazirlik' in KAPAT and B.shape[1] >= 12:
        B[:, 7:12] = 0.0                          # mermi, bastirilma, kacis, orman, siper
    print(f'  ABLASYON: kapatilan grup(lar) = {sorted(KAPAT)}')

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
rv, sv, bv, cv = T(Rn,te), T(Sn,te), T(Bn,te), T(Cn,te)
yv = torch.tensor(Y[te]/ys, device=dev).unsqueeze(1)

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
        if bekle > 30: break
if durum: model.load_state_dict(durum)

model.eval()
with torch.no_grad(): pv = model(rv, sv, bv, cv).cpu().numpy().ravel() * ys
rho = spearman(pv, Y[te])
_par = sum(p.numel() for p in model.parameters())
print('')
print(f'cihaz {dev} | epok {ep+1} | kayip {en_iyi:.4f} | genislik x{G} | parametre {_par}')
print(f'BIRIM-KOSULLU AG ile rollout skoru: Spearman {rho:.3f}   (taban {rho_taban:.3f}, fark {rho-rho_taban:+.3f})')

a_ag, n_ag = karar_ici(C[te][:, 2])
a_net, n_net = karar_ici(pv)
print('')
print(f'KARAR ICI SIRALAMA — aramanin GERCEKTEN ihtiyaci olan olcu ({n_net} karar)')
print(f'  bugunku eleyici en iyi adayi buluyor : %{a_ag*100:.1f}')
print(f'  BIRIM-KOSULLU ag                     : %{a_net*100:.1f}')
print(f'  fark: {(a_net-a_ag)*100:+.1f} puan')
print('')
print('  KAPI: karar-ici siralamada eleyiciyi ACIK ARA gecmeli. Gecerse isinlama')
print('        rollout\'un yerine gecebilir ve GPU carpani harcanabilir hale gelir.')

if KAYDET:
    os.makedirs(os.path.dirname(KAYDET) or '.', exist_ok=True)
    torch.save({'model': model.state_dict(), 'rmu': rmu, 'rsd': rsd, 'smu': smu, 'ssd': ssd,
                'bmu': bmu, 'bsd': bsd, 'cmu': cmu, 'csd': csd, 'ys': float(ys),
                'sdim': int(S.shape[1]), 'bdim': int(B.shape[1]), 'cdim': int(C.shape[1]),
                'gx': GX, 'gy': GY, 'rho': rho, 'rhoTaban': rho_taban,
                'kararIciAg': a_net, 'kararIciTaban': a_ag,
                'ornek': int(len(Y)), 'mac': len(maclar)}, KAYDET)
    print(f'\nmodel kaydedildi: {KAYDET}')
