# BEONAI ODUL YENIDEN HESAPLAMA — oracle etiketlerini KARISIM oduluyle degistirir.
#
# NEDEN (tools/odul-karsilastir.py, 2976 ayrilmis mac, model-bagimsiz hedef):
#   yalniz oracle rho 0.363  |  yalniz DeltaV 0.447  |  KARISIM (w=0.7) 0.463
#   ve bant basina en iyi agirlik ZAMANLA ARTIYOR — erken oyunda takas somut/V belirsiz,
#   gec oyunda V sonucu bilir/takas gurultu. Oracle 200sn+ bandinda NEGATIFE dusuyor (-0.191).
# Bu yuzden oracle ATILMAZ, zamana gore agirlikli karistirilir.
#
# STANDARDIZASYON KAPSAMI: karar-ICI. Secici bir kararin adaylarini SIRALAR; olcek karsilastirmasi
# kararlar arasi degil karar icindedir. (Olcumde global z kullanilmisti; siralama sonucunu
# degistirmez ama listwise egitim icin dogru kapsam budur.)
import json, sys, os, glob
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

MODEL = arg('--model', 'qa-runtime/gece/durum-model.pt')
GIRDI = arg('--girdi', 'qa-runtime/beonai-veri.jsonl')
CIKTI = arg('--cikti', 'qa-runtime/beonai-veri-karisim.jsonl')

# OLCULEN AGIRLIKLAR (bant basina en iyi w, tools/odul-karsilastir.py)
BANTLAR = [(0, 600, 0.4), (600, 1400, 0.3), (1400, 2400, 0.4), (2400, 4000, 0.7), (4000, 10**9, 1.0)]
def agirlik(tik):
    for alt, ust, w in BANTLAR:
        if alt <= tik < ust: return w
    return 1.0

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

def V(ozler):
    """ozler: [{'r':[...], 's':[...]}] -> np.array degerler (marj birimi)"""
    R = np.array([o['r'] for o in ozler], dtype=np.float32).reshape(-1, KANAL, GY, GX)
    S = np.array([o['s'] for o in ozler], dtype=np.float32)
    Rn = (R - ck['rmu']) / ck['rsd']; Sn = (S - ck['smu']) / ck['ssd']
    out = np.zeros(len(R), dtype=np.float32)
    with torch.no_grad():
        for i in range(0, len(R), 2048):
            rt = torch.tensor(Rn[i:i+2048], device=dev); st = torch.tensor(Sn[i:i+2048], device=dev)
            out[i:i+2048] = model(rt, st).cpu().numpy().ravel() * YS
    return out

def z(x):
    sd = x.std()
    return (x - x.mean()) / (sd if sd else 1.0)

giris, cikis = 0, 0
atlanan = 0
istat = {'dv': [], 'or': [], 'degisen_lider': 0, 'karar': 0}
with open(CIKTI, 'w', encoding='utf-8') as w:
    for line in open(GIRDI, encoding='utf-8'):
        line = line.strip()
        if not line: continue
        giris += 1
        try: o = json.loads(line)
        except Exception: continue
        v = o.get('veri')
        # ESKI SATIR KORUMASI: oznitelik tasimayan satirlar (eski uretimler) ATLANIR — sessizce
        # eski etiketle egitime girmeleri iki farkli odul karisimi demek olurdu.
        if not v or not v.get('durumBas') or not v.get('rows'):
            atlanan += 1; continue
        satirlar = [r for r in v['rows'] if r.get('durumSon')]
        if len(satirlar) < 2:
            atlanan += 1; continue
        vb = V([v['durumBas']])[0]
        vs = V([r['durumSon'] for r in satirlar])
        dv = vs - vb
        orc = np.array([float(r.get('reward', 0.0)) for r in satirlar], dtype=np.float32)
        w_ = agirlik(int(v.get('decisionTick', 0)))
        karisim = w_ * z(dv) + (1.0 - w_) * z(orc)
        # istatistik: karisim liderinin oracle liderinden FARKLI olma orani
        istat['karar'] += 1
        if int(np.argmax(karisim)) != int(np.argmax(orc)): istat['degisen_lider'] += 1
        istat['dv'].append(float(np.std(dv))); istat['or'].append(float(np.std(orc)))
        # chosenReward (kod-AI kolu) AYNI olcege cevrilmeli. Aksi halde egitim raporundaki
        # `kodRegret` z-olcek ile puan-olcegi karsilastirir ve "kod-AI'yi yendim mi" kapisi
        # SESSIZCE bozulur (olculdu: kodRegret 306 vs modelRegret 1.5 — anlamsiz).
        # chosen'in kendi DeltaV'si de var (chosenDurumSon); ayni karisim ona da uygulanir.
        _co = v.get('chosenReward')
        if _co is not None:
            _cdv = None
            if v.get('chosenDurumSon'):
                _cdv = float(V([v['chosenDurumSon']])[0] - vb)
            # z-donusumu adaylarin ort/std'si ile yapilir (ayni referans cerceve)
            _zo = (float(_co) - float(orc.mean())) / (float(orc.std()) or 1.0)
            if _cdv is not None:
                _zd = (_cdv - float(dv.mean())) / (float(dv.std()) or 1.0)
                v['chosenReward'] = round(float(w_ * _zd + (1.0 - w_) * _zo), 4)
            else:
                v['chosenReward'] = round(float(_zo), 4)
            v['chosenRewardOracle'] = _co
        for r, d, k in zip(satirlar, dv, karisim):
            r['rewardOracle'] = r.get('reward')      # orijinal KORUNUR (geri donulebilir)
            r['deltaV'] = round(float(d), 2)
            r['reward'] = round(float(k), 4)          # egitimin okudugu alan
        v['rows'] = satirlar
        v['odulKarisim'] = {'w': w_, 'kaynak': 'w*z(deltaV)+(1-w)*z(oracle)', 'model': os.path.basename(MODEL)}
        # oznitelikler ARTIK GEREKSIZ (odul hesaplandi) -> dosyayi 100x kucultur
        v.pop('durumBas', None); v.pop('chosenDurumSon', None)
        for r in v['rows']: r.pop('durumSon', None)
        w.write(json.dumps(o, ensure_ascii=False) + '\n')
        cikis += 1

print(f'girdi {giris} satir -> cikti {cikis} satir   (atlanan: {atlanan})')
if istat['karar']:
    print(f"karar sayisi: {istat['karar']}")
    print(f"  ort. std  DeltaV {np.mean(istat['dv']):.1f}   oracle {np.mean(istat['or']):.1f}")
    print(f"  karisim LIDERI oracle'dan FARKLI: {istat['degisen_lider']}/{istat['karar']} "
          f"(%{istat['degisen_lider']/istat['karar']*100:.0f})")
    print('  -> bu oran 0 ise karisimin hicbir etkisi yok demektir (etiket degismemis).')
print(f'-> {CIKTI}')
