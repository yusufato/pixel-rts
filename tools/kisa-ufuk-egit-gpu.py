# KISA UFUKLU DEGER AGI: "onumuzdeki H saniyede marj NE KADAR DEGISIR?"
#
# ═══ NEDEN: bugun UC AYRI olcum ayni koke cikti ═══
# Mevcut deger agi "bu durumdan MAC NASIL BITER" diye egitildi (rho 0.864). Ama
# aramanin sordugu soru bu degil: "su noktaya gidersem ONUMUZDEKI 5 SANIYEDE ne
# kazanirim". Uc bagimsiz belirti:
#
#   1) Ag farklari analitik farklardan ~30 KAT KUCUK. Tek birimi 600px oynatmak
#      mac-sonu tahminini zar zor kipirdatiyor -> ag esigi 120'den 15'e indirilmek
#      zorunda kalindi (js/BattleLookahead.js LA_AG_ESIK).
#   2) `baski` kanalinin mac-duzeyi artik agirligi ~SIFIR (+0.0001) — cunku mac
#      bitene kadar baskinin degeri zaten marja donusmus oluyor. Mac-sonu hedefi
#      kisa vadeli uretimi GORMUYOR (tools/kredi-agirlik.py).
#   3) 25x25 ortak isinlama rollout'la yalnizca %43 ortusuyor ve tek tarafliyi
#      gecemiyor (z -0.28) — cunku minimax, agin duyarsizligindan dogan GURULTUnun
#      en karamsar ornegini seciyor (tools/ortak-isinlama.js).
#
# Ucunun de cevabi ayni: HEDEF YANLIS. Bu arac dogru hedefi egitir.
#
# ═══ YENI VERI GEREKMIYOR ═══
# durum-veri.js her mac icin 100 tik (5sn) araliklarla anlik goruntu tutuyor ve
# marj o goruntunun KENDI ozniteliklerinden geri hesaplanabiliyor:
#     marj(t) = (s[1] - s[2]) * 6500      (bkz. js/BattleStateFeatures.js)
# Yani hedef = marj(t+H) - marj(t), mevcut 1600 mactan turetilir.
#
# ═══ SIZINTI KAPISI ═══
# Bolme MAC bazinda. Ayni macin ardisik goruntuleri neredeyse ayni; goruntu bazinda
# bolmek egitim ve testi ayni maclarla doldurur ve rho'yu sahte yukseltir. Bu tuzak
# bu projede deger aginda ve kompozisyon modelinde YASANDI.
#
#   python tools/kisa-ufuk-egit-gpu.py --veri qa-runtime/durum --ufuk 200
import json, sys, os, glob as _glob
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

VERI = arg('--veri', 'qa-runtime/durum')
UFUK = int(arg('--ufuk', 200))          # tik (200 = 10sn)
EPOK = int(arg('--epok', 200))
KAYDET = arg('--kaydet')
GX = int(arg('--gx', 16)); GY = int(arg('--gy', 10)); KANAL = 8
MAKS = int(arg('--maxsatir', 200000))
dev = 'cuda' if torch.cuda.is_available() else 'cpu'

DOSYALAR = sorted(_glob.glob(os.path.join(VERI, '*.jsonl'))) if os.path.isdir(VERI) else _glob.glob(VERI)
DOSYALAR = [d for d in DOSYALAR if os.path.exists(d)]
if not DOSYALAR:
    print(f'veri bulunamadi: {VERI}'); sys.exit(1)

# ── MAC BAZINDA topla: hedef, AYNI macin ileri tikindaki marjindan turetilir ──
maclar = {}
_n = 0
for d in DOSYALAR:
    with open(d, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try: o = json.loads(line)
            except Exception: continue
            _n += 1
            if _n > MAKS * 4: break
            kim = (o.get('ad'), o.get('seed'))
            maclar.setdefault(kim, []).append(o)

print(f'mac: {len(maclar)}   ham goruntu: {_n}')
R, S, Y, MAC, TIK, YSON = [], [], [], [], [], []
atlanan_kuyruk = 0
for kim, liste in maclar.items():
    liste.sort(key=lambda o: o['tik'])
    # tik -> marj haritasi (marj = (s1-s2)*6500)
    tikMarj = {o['tik']: (o['s'][1] - o['s'][2]) * 6500.0 for o in liste}
    for o in liste:
        hedefTik = o['tik'] + UFUK
        if hedefTik not in tikMarj:
            atlanan_kuyruk += 1     # macin SONUNA yakin goruntuler: ileri tik YOK
            continue
        R.append(o['r']); S.append(o['s'])
        Y.append(tikMarj[hedefTik] - tikMarj[o['tik']])   # HEDEF: marj DEGISIMI
        YSON.append(float(o['y']))                        # karsilastirma icin nihai marj
        MAC.append(str(kim)); TIK.append(o['tik'])

if len(Y) < 500:
    print(f'ornek az ({len(Y)}) - egitim anlamsiz.'); sys.exit(0)
print(f'ornek: {len(Y)}   (mac sonuna yakin {atlanan_kuyruk} goruntu atlandi: ileri tik yok)')

R = np.array(R, dtype=np.float32).reshape(-1, KANAL, GY, GX)
S = np.array(S, dtype=np.float32)
Y = np.array(Y, dtype=np.float32)
YSON = np.array(YSON, dtype=np.float32)
MAC = np.array(MAC); TIK = np.array(TIK, dtype=np.float32)

rng = np.random.default_rng(20260817)
ml = sorted(set(MAC.tolist())); rng.shuffle(ml)
kes = max(1, int(len(ml) * 0.8))
tr_mac = set(ml[:kes])
tr = np.array([m in tr_mac for m in MAC]); te = ~tr
print(f'  egitim {tr.sum()} / {len(tr_mac)} mac   test {te.sum()} / {len(ml)-len(tr_mac)} mac')

def spearman(a, b):
    if len(a) < 3: return float('nan')
    ra = np.argsort(np.argsort(a)).astype(float); rb = np.argsort(np.argsort(b)).astype(float)
    ra -= ra.mean(); rb -= rb.mean()
    d = np.sqrt((ra**2).sum()) * np.sqrt((rb**2).sum())
    return float((ra*rb).sum()/d) if d else 0.0

# ── TABAN: NIHAI MARJ, kisa vadeli degisimi ne kadar aciklar? ──
# Iddia buydu: "mac-sonu hedefi kisa vadeyi GORMUYOR". Once olculur, sonra iddia edilir.
rho_nihai = spearman(YSON[te], Y[te])
print('')
print(f'TABAN: nihai marj ile kisa-vadeli degisim arasindaki Spearman = {rho_nihai:.3f}')
print('  (dusukse: mevcut deger aginin hedefi bu soruyu GERCEKTEN cevaplamiyor)')

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
            nn.AdaptiveAvgPool2d((3, 4)), nn.Flatten())
        self.mlp = nn.Sequential(nn.Linear(sdim, 64), nn.ReLU())
        self.bas = nn.Sequential(nn.Linear(384 + 64, 128), nn.ReLU(), nn.Linear(128, 1))
    def forward(self, r, s):
        return self.bas(torch.cat([self.cnn(r), self.mlp(s)], 1))

torch.manual_seed(20260817)
model = Model(S.shape[1]).to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
lossf = nn.MSELoss()
rt = torch.tensor(Rn[tr], device=dev); st = torch.tensor(Sn[tr], device=dev)
yt = torch.tensor(Y[tr] / ys, device=dev).unsqueeze(1)
rv = torch.tensor(Rn[te], device=dev); sv = torch.tensor(Sn[te], device=dev)
yv = torch.tensor(Y[te] / ys, device=dev).unsqueeze(1)

N = rt.shape[0]; PARTI = min(256, N)
en_iyi, bekle, durum = 9e9, 0, None
for ep in range(EPOK):
    model.train()
    perm = torch.randperm(N, device=dev)
    for i in range(0, N, PARTI):
        ix = perm[i:i+PARTI]
        opt.zero_grad(); lossf(model(rt[ix], st[ix]), yt[ix]).backward(); opt.step()
    model.eval()
    with torch.no_grad(): vl = lossf(model(rv, sv), yv).item()
    if vl < en_iyi - 1e-4:
        en_iyi, bekle = vl, 0
        durum = {k: v.detach().clone() for k, v in model.state_dict().items()}
    else:
        bekle += 1
        if bekle > 30: break
if durum: model.load_state_dict(durum)

model.eval()
with torch.no_grad(): pv = model(rv, sv).cpu().numpy().ravel() * ys
gercek = Y[te]
rho = spearman(pv, gercek)
isaret = float(((pv > 0) == (gercek > 0)).mean())
print('')
print(f'cihaz {dev} | epok {ep+1} | dogrulama kaybi {en_iyi:.4f}')
print(f'KISA UFUK ({UFUK} tik = {UFUK/20:.0f}sn) AGI')
print(f'  Spearman {rho:.3f}   isaret dogrulugu %{isaret*100:.0f}')
print(f'  nihai-marj tabanina gore: {rho - rho_nihai:+.3f}')
print('')
print('ZAMANA GORE')
print('  an'.ljust(12) + 'ornek'.rjust(8) + 'Spearman'.rjust(10))
tt = TIK[te]
for alt, ust, ad in [(0,600,'0-30sn'),(600,1400,'30-70sn'),(1400,2400,'70-120sn'),(2400,9999,'120sn+')]:
    m = (tt >= alt) & (tt < ust)
    if m.sum() < 20: continue
    print('  ' + ad.ljust(10) + str(int(m.sum())).rjust(8) + f'{spearman(pv[m], gercek[m]):.3f}'.rjust(10))
print('')
print('  KAPI: rho, nihai-marj tabanini ACIK ARA gecmeli. Gecmezse "hedef yanlisti"')
print('        teshisi COKER ve arama icin daha iyi bir sinyal yok demektir.')

if KAYDET:
    os.makedirs(os.path.dirname(KAYDET) or '.', exist_ok=True)
    torch.save({'model': model.state_dict(), 'rmu': rmu, 'rsd': rsd, 'smu': smu, 'ssd': ssd,
                'ys': float(ys), 'sdim': int(S.shape[1]), 'gx': GX, 'gy': GY,
                'ufuk': UFUK, 'rho': rho, 'rhoNihaiTaban': rho_nihai,
                'ornek': int(len(Y)), 'mac': len(ml)}, KAYDET)
    print(f'\nmodel kaydedildi: {KAYDET}')
