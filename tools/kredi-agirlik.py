# KREDI KANALLARININ ₺ KARSILIGI — "1 birim baski kac ₺ marj eder?"
#
# NEDEN: arama rollout'u TEK SAYIYLA puanliyor (deger agi -> nihai marj tahmini). Odul
# defteri kurulurken olculmustu ki tek getiri lensi UC KEZ yaniltti; en net orneği topcu:
# imha lensinde getirisi x0.04 ("ise yaramaz") ama urunu imha degil BASKI (415.6 olculdu).
# Arama su an tam o tek lensle bakiyor.
#
# ELLE AGIRLIK VERMEK YASAK: bu projede sekiz elle yazilmis hedef olcusu denendi ve
# HICBIRI global marji gecemedi. O yuzden agirliklar VERIDEN turetilir.
#
# YONTEM: her MAC icin (kirmizi - mavi) kanal farki -> nihai marj, dogrusal regresyon.
# Katsayilar dogrudan "kanal biriminde 1 fark = kac ₺ marj" demektir.
#
# ⚠ BU AGIRLIKLAR ILISKISELDIR, NEDENSEL DEGIL. Kazanan taraf HER kanaldan daha cok
# uretir; regresyon bunu "kanal kazandiriyor" diye okuyabilir. O yuzden:
#   · katsayilar TEK BASINA bir bulgu degildir, yalnizca tahminden iyi bir baslangictir
#   · gercek sinav maç kapisidir (tools/rol-dengesi-paralel.js)
# Ayrica ortak-dogrusallik raporlanir: kanallar birbirine cok benziyorsa katsayilar
# kararsizdir ve bunu bilmek gerekir.
#
#   python tools/kredi-agirlik.py --veri qa-runtime/durum --out qa-runtime/kredi-agirlik.json
import json, sys, os, glob as _glob
import numpy as np

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

VERI = arg('--veri', 'qa-runtime/durum')
OUT = arg('--out', 'qa-runtime/kredi-agirlik.json')
DOSYALAR = sorted(_glob.glob(os.path.join(VERI, '*.jsonl'))) if os.path.isdir(VERI) else _glob.glob(VERI)
DOSYALAR = [d for d in DOSYALAR if os.path.exists(d)]
if not DOSYALAR:
    print(f'veri bulunamadi: {VERI}'); sys.exit(1)

KANAL = ['hasar', 'panik', 'baski', 'imhaDeger', 'emilen', 'gorusTekil', 'tespit', 'jamTik',
         'iyilestirme', 'kurtarma', 'muhimmat', 'kuruEngel', 'siperTik', 'yakitDolum',
         'mayin', 'tasinan', 'droneHasar', 'haleTik', 'rally', 'havaCaydirma', 'havaHasar']

# MAC BASINA TEK SATIR: kredi ozeti mac sonunda hesaplanip o macin TUM anlik goruntulerine
# ayni sekilde yaziliyor. Hepsini almak ayni maci yuzlerce kez saymak olurdu (sahte n).
gorulen = set()
X, Y = [], []
for d in DOSYALAR:
    with open(d, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try: o = json.loads(line)
            except Exception: continue
            k = o.get('kredi')
            if not k: continue
            kim = (o.get('ad'), o.get('seed'))
            if kim in gorulen: continue
            gorulen.add(kim)
            X.append([float(k['r'].get(c, 0)) - float(k['m'].get(c, 0)) for c in KANAL])
            Y.append(float(o['y']))

X = np.array(X, dtype=np.float64); Y = np.array(Y, dtype=np.float64)
print(f'mac sayisi: {len(Y)}   kanal: {len(KANAL)}')
if len(Y) < 50:
    print('mac az - regresyon anlamsiz.'); sys.exit(0)

# Olcekleri cok farkli (hasar on binler, mayin tek haneler) -> standartlastir, sonra geri cevir.
mu, sd = X.mean(0), X.std(0) + 1e-9
Xs = (X - mu) / sd
olu = sd < 1e-6

# EGITIM/TEST BOLMESI: R^2 ayni veride hesaplanirsa sisirilir.
rng = np.random.default_rng(20260817)
idx = rng.permutation(len(Y))
kes = int(len(Y) * 0.8)
tr, te = idx[:kes], idx[kes:]

# Ridge: kanallar birbiriyle guclu korele (kazanan her seyi cok uretir) -> duz en-kucuk-kareler
# katsayilari devasa ve isaretleri kararsiz cikar. Ridge onlari sinirlar.
def ridge(A, b, lam):
    n = A.shape[1]
    return np.linalg.solve(A.T @ A + lam * np.eye(n), A.T @ b)

A = np.hstack([Xs[tr], np.ones((len(tr), 1))])
At = np.hstack([Xs[te], np.ones((len(te), 1))])
en_iyi = None
for lam in [0.1, 1, 10, 100, 1000]:
    w = ridge(A, Y[tr], lam)
    p = At @ w
    ss = 1 - ((Y[te] - p) ** 2).sum() / max(1e-9, ((Y[te] - Y[te].mean()) ** 2).sum())
    if en_iyi is None or ss > en_iyi[1]: en_iyi = (lam, ss, w)
lam, r2, w = en_iyi
print(f'ridge lambda {lam}   TEST R^2 {r2:.3f}   (egitim {len(tr)} / test {len(te)} mac)')

# Standartlastirilmis katsayi -> ham birim katsayisi
ham = np.where(olu, 0.0, w[:len(KANAL)] / sd)

# ORTAK-DOGRUSALLIK: kanallar birbirine ne kadar benziyor (katsayi kararliligi icin)
kor = np.corrcoef(Xs[:, ~olu].T)
np.fill_diagonal(kor, 0)
print(f'kanallar arasi en yuksek |korelasyon|: {np.abs(kor).max():.2f}'
      + ('   -> YUKSEK: tek tek katsayilara guvenme, toplam skora bak' if np.abs(kor).max() > 0.8 else ''))

print('')
print('  kanal'.ljust(18) + 'std katsayi'.rjust(12) + 'TL/birim'.rjust(14) + 'std(fark)'.rjust(12))
sirali = sorted(range(len(KANAL)), key=lambda i: -abs(w[i]))
for i in sirali:
    print('  ' + KANAL[i].ljust(16) + f'{w[i]:+.1f}'.rjust(12) +
          (f'{ham[i]:+.4f}'.rjust(14) if not olu[i] else 'ÖLÜ'.rjust(14)) +
          f'{sd[i]:.1f}'.rjust(12))

# ═══ TOTOLOJI KAPISI ═══
# imhaDeger - emilen ~ MARJIN TANIMI (yok ettigin deger eksi kaybettigin deger).
# Onlarla yuksek R^2 elde etmek marji marjdan tahmin etmektir; hicbir sey ogretmez.
# ASIL SORU: bu ikisi ZATEN hesaba katildiktan sonra diger kanallar EK bilgi veriyor mu?
TOTOLOJIK = ['imhaDeger', 'emilen', 'hasar', 'droneHasar', 'havaHasar']
tot = [i for i, c in enumerate(KANAL) if c in TOTOLOJIK]
dig = [i for i, c in enumerate(KANAL) if c not in TOTOLOJIK and not olu[i]]

def r2_of(cols, lam=10.0):
    if not cols: 
        p = np.full(len(te), Y[tr].mean())
    else:
        A_ = np.hstack([Xs[tr][:, cols], np.ones((len(tr), 1))])
        At_ = np.hstack([Xs[te][:, cols], np.ones((len(te), 1))])
        w_ = ridge(A_, Y[tr], lam)
        p = At_ @ w_
    return 1 - ((Y[te] - p) ** 2).sum() / max(1e-9, ((Y[te] - Y[te].mean()) ** 2).sum())

r2_tot = r2_of(tot)
r2_dig = r2_of(dig)
r2_hep = r2_of(tot + dig)
print('')
print('TOTOLOJI KAPISI — kanallar marjin TANIMINI mi tekrarliyor?')
print(f'  yalniz totolojik (imha/emilen/hasar...) : R^2 {r2_tot:.3f}')
print(f'  yalniz DIGER kanallar                   : R^2 {r2_dig:.3f}')
print(f'  hepsi                                   : R^2 {r2_hep:.3f}')
print(f'  DIGER kanallarin EK katkisi             : {r2_hep - r2_tot:+.4f}')
if (r2_hep - r2_tot) < 0.01:
    print('')
    print('  ! EK KATKI YOK. Yuksek R^2 totolojiden geliyor: marj zaten imha-eksi-kayip.')
    print('    Cok kanalli puanlamanin MAC DUZEYINDE ek bilgi tasidigi GOSTERILEMEDI.')
    print('    Bu, kanallarin degersiz oldugunu degil, NIHAI MARJ hedefinin onlari')
    print('    gormedigini soyler (baskinin urunu zaten imhaya donusmus olarak sayiliyor).')

if r2 < 0.2:
    print('')
    print('  ! R^2 DUSUK - kredi kanallari nihai marji zayif acikliyor.')
    print('    Bu agirliklarla puanlama, tek-lens puanlamayi gecmeyebilir. Kapi karar verir.')

# ═══ ARTIK (RESIDUAL) AGIRLIKLAR — aramanin KULLANACAGI sayilar ═══
# Deger agi zaten "nihai marj"i tahmin ediyor; imha/kayip onun ICINDE. Onlari skora bir
# daha eklemek CIFT SAYMA olurdu. Aranan sey: marjin ACIKLAYAMADIGI artik ne kadari
# diger kanallardan geliyor. Bu yuzden once totolojiklerle regresyon kurulur, ARTIK
# alinir, ve diger kanallar ARTIGA gore fitlenir.
A_t = np.hstack([Xs[:, tot], np.ones((len(Y), 1))])
w_t = ridge(np.hstack([Xs[tr][:, tot], np.ones((len(tr), 1))]), Y[tr], 10.0)
artik = Y - A_t @ w_t
A_d = np.hstack([Xs[tr][:, dig], np.ones((len(tr), 1))])
At_d = np.hstack([Xs[te][:, dig], np.ones((len(te), 1))])
w_d = ridge(A_d, artik[tr], 10.0)
p_d = At_d @ w_d
r2_artik = 1 - ((artik[te] - p_d) ** 2).sum() / max(1e-9, ((artik[te] - artik[te].mean()) ** 2).sum())
print('')
print(f'ARTIK MODEL: diger kanallar, marjin aciklanmayan kismini R^2 {r2_artik:.3f} aciklıyor')
artikAgirlik = {}
for j, i in enumerate(dig):
    artikAgirlik[KANAL[i]] = float(w_d[j] / sd[i])
print('  kanal'.ljust(18) + 'std katsayi'.rjust(12) + 'TL/birim'.rjust(14))
for j, i in sorted(enumerate(dig), key=lambda t: -abs(w_d[t[0]])):
    print('  ' + KANAL[i].ljust(16) + f'{w_d[j]:+.1f}'.rjust(12) + f'{w_d[j]/sd[i]:+.4f}'.rjust(14))
print('')
print('  NOT: bunlar ILISKISEL agirliklardir. Isaretleri mantikli gorunse bile kanit degil;')
print('       tek sinav MAC KAPISIDIR (tools/rol-dengesi-paralel.js --kol BATTLE_LA_KANAL).')

os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({'kanal': KANAL, 'agirlik': [float(x) for x in ham],
               'artikKanal': [KANAL[i] for i in dig],
               'artikAgirlik': artikAgirlik,
               'artikR2': float(r2_artik),
               'ekKatki': float(r2_hep - r2_tot),
               'totolojik': TOTOLOJIK,
               'stdKatsayi': [float(x) for x in w[:len(KANAL)]],
               'sd': [float(x) for x in sd], 'lambda': float(lam), 'r2': float(r2),
               'mac': int(len(Y)), 'maxKorelasyon': float(np.abs(kor).max())}, f, indent=1)
print(f'\nyazildi: {OUT}')
