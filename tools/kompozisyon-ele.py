# VEKIL MODELLE ON-ELEME — "kuyrugu kes", "ilk N'i al" DEGIL.
#
# NEDEN KUYRUK: model tek bir rakibe (REF-H0) karsi KISA MAC marjini ogreniyor. Olculdu ki tek
# rakibe gore SIRALAMA gecersiz (ayni aday bir rakibe karsi sonuncu, digerine birinci). "Ilk N'i al"
# demek o yanliligi geri getirmek olurdu. Buna karsilik "acikca kotuleri at" cok daha dayanikli:
# kuyruktaki aday HER rakibe karsi kotudur.
# Bu, turnuvanin kendi eleme kuralinin (guven araligi) vekil-model karsiligidir.
import json, sys, os
import numpy as np, torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

MODEL = arg('--model', 'qa-runtime/kompozisyon-model.pt')
ADAYLAR = arg('--adaylar', 'qa-runtime/adaylar-panel.json')
OUT = arg('--out', 'qa-runtime/adaylar-elenmis.json')
KES = float(arg('--kes', 0.5))        # en kotu bu KESIR atilir (0.5 = alt yari)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'

ck = torch.load(MODEL, map_location=dev, weights_only=False)
model = nn.Sequential(nn.Linear(ck['boyut'], 128), nn.Tanh(), nn.Linear(128, 64), nn.Tanh(), nn.Linear(64, 1)).to(dev)
model.load_state_dict(ck['model']); model.eval()
mu, sd, ys = ck['mu'], ck['sd'], ck['ys']

adlar = json.load(open('qa-runtime/kompozisyon-ozellik-ad.json', encoding='utf-8'))
TIPLER = [a[4:] for a in adlar if a.startswith('pay:')]
KATLAR = [a[4:] for a in adlar if a.startswith('kat:')]

adaylar = json.load(open(ADAYLAR, encoding='utf-8'))
yarisan = [a for a in adaylar if not a.get('heuristik') and a.get('aile') != 'rakip']
digerleri = [a for a in adaylar if a.get('heuristik') or a.get('aile') == 'rakip']

def vektor(a):
    tp, kp, zor = a.get('tipPaylari') or {}, a.get('paylar') or {}, a.get('zorunlu') or {}
    return [tp.get(k, 0) for k in TIPLER] + [kp.get(k, 0) for k in KATLAR] + [1 if zor.get(k) else 0 for k in TIPLER]

X = np.array([vektor(a) for a in yarisan], dtype=np.float32)
with torch.no_grad():
    skor = (model(torch.tensor((X - mu) / sd, device=dev)).cpu().numpy().ravel() * ys)

sira = np.argsort(-skor)
tut = int(round(len(yarisan) * (1 - KES)))
secilen = [yarisan[i] for i in sira[:tut]]

json.dump(secilen + digerleri, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'ON-ELEME  model rho {ck["rho"]:.3f} ({ck["mac"]} mac ile egitildi)')
print(f'  yarisan aday : {len(yarisan)}  ->  {len(secilen)}   (alt %{int(KES*100)} atildi)')
print(f'  skor araligi : {skor.min():.0f} .. {skor.max():.0f}   (kesim noktasi {skor[sira[tut-1]]:.0f})')
print(f'  rakip/referans korundu: {len(digerleri)}')
print(f'-> {OUT}')
print('  NOT: "kuyrugu kes" kipi. Model tek rakibe karsi KISA MAC ogreniyor; "ilk N" secmek')
print('       tek-rakip yanliligini geri getirirdi. Kuyruktaki aday her rakibe karsi kotudur.')
