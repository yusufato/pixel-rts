# POLITIKA AGI: durum + birim + SECENEKLER -> aramanin sectigi secenek  (R1, GPU)
#
# NEDEN: arama mevcut politikayi olculmus bicimde yeniyor (+1262 marj, n=96, t 4.3) ama
# ~1 CPU-sn / oyun-sn harciyor -> canli oyuna SIGMIYOR ve ucuzlatmanin dort yolu da olculdu
# ve oldu. AlphaZero'nun cevabi: aramayi ucuzlatma, POLITIKAYA DAMIT. Cikarim tek ileri-gecis.
#
# ═══ GOREV: 25 SINIF DEGIL, 3 SECENEK ARASINDA SECIM ═══
# Arama adaylari ucuz eleyici skoruna gore siralar, YALNIZ ilk ikisini (LA_DERIN=2) arti
# "yerinde kal"i oynatir. Yani nihai secim TANIM GEREGI su ucunden biridir:
#     0 = eleyici #1'i onayla    1 = eleyici #2'ye don    2 = yerinde kal
# Olculdu (9853 karar): %43.6 / %30.7 / %25.7 — toplam tam %100, kume kapali.
#
# ═══ ILK SURUM NEDEN COKTU (olculmus hata, tekrarlanmasin) ═══
# Once (durum, birim) -> "hangi kafes sinifi" diye kurmustum. OGRENILEMEZ bir kurgu:
# ag #1 ile #2 arasinda secim yapiyor ama girdisinde o iki noktanin NEREDE oldugu ya da
# ucuz skorun onlari NASIL puanladigi HIC YOKTU. Ayni durum + ayni birim + farkli aday
# geometrisi -> ag icin ayirt edilemez. Sonuc: tahminlerin %94'u tek secenege yigildi,
# yani bedava "hep #1" tabanina cokme (dogruluk %42.2 vs taban %43.4). Veri hacmi
# sorunu DEGILDI; girdi ayirt edici bilgiyi tasimiyordu.
# DUZELTME: her SECENEK kendi ozniteligiyle (geometri + ucuz skorlar + farklar) girdiye
# girer; ag her secenege bir puan verir, softmax uc secenek uzerinde alinir.
#
# ASIL KAPI: "HEP #1" tabani (~%43.6). Bu bedava politika zaten elimizde; ag onu
# gecmiyorsa damitmanin degeri YOKTUR. Cogunluk tabani yaniltici bir kolayliktir.
#
# SIZINTI KAPISI: bolme MAC bazinda. Ayni macin kararlari birbirine cok benzer; karar
# bazinda bolmek egitim ve testi ayni maclarla doldurur ve dogrulugu sahte yukseltir.
import json, sys, os, glob as _glob
import numpy as np
import torch, torch.nn as nn

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

VERI = arg('--veri', 'qa-runtime/politika')
DOSYALAR = []
for _p in VERI.split(','):
    _p = _p.strip()
    if os.path.isdir(_p):
        DOSYALAR.extend(sorted(_glob.glob(os.path.join(_p, '*.jsonl'))))
    elif '*' in _p or '?' in _p:
        DOSYALAR.extend(sorted(_glob.glob(_p)))
    else:
        DOSYALAR.append(_p)
DOSYALAR = [d for d in DOSYALAR if os.path.exists(d)]
if not DOSYALAR:
    print(f'veri bulunamadi: {VERI}'); sys.exit(1)

EPOK = int(arg('--epok', 200))
KAYDET = arg('--kaydet')
GX = int(arg('--gx', 16)); GY = int(arg('--gy', 10)); KANAL = 8
MAKS = int(arg('--maxsatir', 400000))
SECENEK = 3
AD = ['eleyici#1', 'eleyici#2', 'yerinde-kal']
dev = 'cuda' if torch.cuda.is_available() else 'cpu'

_n = 0
for _d in DOSYALAR:
    with open(_d, encoding='utf-8') as f:
        for _ in f: _n += 1
ADIM = max(1, _n // MAKS) if MAKS > 0 else 1
if ADIM > 1:
    print(f'veri {_n} satir -> her {ADIM}. satir (bellek kapisi {MAKS})')

R, S, B, O, K, MAC, TIK = [], [], [], [], [], [], []
_bozuk = 0; _eksik = 0; _i = -1
for _d in DOSYALAR:
    # Mac kimligi: dosya + o macin NIHAI marji. politika-veri.js tohumu satira yazmaz ama
    # nihai marj mac basina TEK degerdir -> pratikte mac vekili olarak calisir.
    with open(_d, encoding='utf-8') as f:
        for line in f:
            _i += 1
            if _i % ADIM: continue
            line = line.strip()
            if not line: continue
            try:
                d = json.loads(line)
            except Exception:
                _bozuk += 1; continue
            # ESKI BICIM KORUMASI: 'o'/'k' tasimayan satirlar secenek-kosullu egitime
            # giremez. Sessizce yanlis ogrenmektense ACIKCA sayilip atlanir.
            if d.get('b') is None or not d.get('o') or d.get('k') is None:
                _eksik += 1; continue
            if len(d['o']) != SECENEK: _eksik += 1; continue
            R.append(d['r']); S.append(d['s']); B.append(d['b'])
            O.append(d['o']); K.append(d['k'])
            MAC.append(os.path.basename(_d) + '#' + str(d.get('nihai', 0)))
            TIK.append(d['tik'])

if _eksik:
    print(f'atlanan (eski bicim / secenek sayisi != {SECENEK}): {_eksik}')
if _bozuk:
    print(f'atlanan bozuk satir: {_bozuk}')
# --min: yalnizca BICIM DOGRULAMA kosulari icin dusurulur; gercek egitimde elleme.
MIN = int(arg('--min', 500))
if len(K) < MIN:
    print(f'veri az ({len(K)} karar, esik {MIN}) - egitim anlamsiz.'); sys.exit(0)

R = np.array(R, dtype=np.float32).reshape(-1, KANAL, GY, GX)
S = np.array(S, dtype=np.float32)
B = np.array(B, dtype=np.float32)
Oham = np.array(O, dtype=np.float32)          # (N, 3, 5) = [sinif, analitik, ag, dx, dy]
K = np.array(K, dtype=np.int64)
MAC = np.array(MAC); TIK = np.array(TIK, dtype=np.float32)

# ── SECENEK OZNITELIGI ─────────────────────────────────────────────────────
# Ham [sinif, analitik, ag, dx, dy] -> ogrenmeye elverisli 8 alan.
#  · sinif ORDINAL DEGIL (21 > 12 hicbir sey ifade etmez) -> atilir; geometri zaten dx,dy'de.
#  · 'kal' bayragi ayri tutulur: eleyicinin HIC birinci siralamadigi, rollout'unsa %26
#    oraninda sectigi secenek odur - ayri bir alan hak eder.
#  · FARKLAR acikca verilir (skor - #1'in skoru). Ag bunu cikarabilirdi ama sinirli veriyle
#    hazir vermek ogrenmeyi kolaylastirir; karar zaten farklarla ilgili.
#  · sira indeksi korunur: siralama bilgisi (hangisi #1) kaybolmasin.
N = Oham.shape[0]
sira = np.tile(np.arange(SECENEK, dtype=np.float32), (N, 1)) / (SECENEK - 1)
isKal = (Oham[:, :, 0] == 0).astype(np.float32)
ana = Oham[:, :, 1]; ag = Oham[:, :, 2]
anaF = ana - ana[:, 0:1]
agF = ag - ag[:, 0:1]
C = np.stack([sira, isKal, ana, ag, anaF, agF, Oham[:, :, 3], Oham[:, :, 4]], axis=2).astype(np.float32)
CDIM = C.shape[2]

maclar = sorted(set(MAC.tolist()))
print(f'veri: {len(K)} karar, {len(maclar)} mac, raster {KANAL}x{GY}x{GX}, skaler {S.shape[1]}, birim {B.shape[1]}, secenek {CDIM}')
if len(maclar) < 20:
    print(f'UYARI: yalnizca {len(maclar)} mac - mac-bazli bolme zayif kalir.')

rng = np.random.default_rng(20260817); ml = maclar[:]; rng.shuffle(ml)
kes = max(1, int(len(ml) * 0.8))
tr_mac = set(ml[:kes])
tr = np.array([m in tr_mac for m in MAC]); te = ~tr
print(f'  egitim {tr.sum()} karar / {len(tr_mac)} mac   test {te.sum()} / {len(ml)-len(tr_mac)} mac')
# BOS TEST KAPISI: tek macli dosyada 80/20 bolme her seyi egitime atar, test bos kalir ve
# tum olculer NaN doner. NaN'i "sonuc" diye basmaktansa acikca durulur.
if te.sum() < 30 or (len(ml) - len(tr_mac)) < 2:
    print(f'  ! TEST KUMESI YETERSIZ ({int(te.sum())} karar, {len(ml)-len(tr_mac)} mac).')
    print('    Mac-bazli bolme en az 2 test maci ister. Daha cok mac toplayin.')
    sys.exit(0)

pay = np.bincount(K[tr], minlength=SECENEK) / max(1, int(tr.sum()))
cog = int(np.bincount(K[tr], minlength=SECENEK).argmax())
t_cog = float((K[te] == cog).mean())
t_ele = float((K[te] == 0).mean())
print('')
print('SECENEK DAGILIMI (egitim)')
for i in range(SECENEK):
    print(f'  {AD[i]:<14}: %{pay[i]*100:.1f}')
print('TABANLAR')
print(f'  cogunluk ({AD[cog]})       : %{t_cog*100:.1f}   (yaniltici kolay taban)')
print(f'  "HEP #1" bedava politika    : %{t_ele*100:.1f}   <- ASIL KAPI')

# Normalizasyon YALNIZ egitim kumesinden; raster KANAL BAZINDA (deger aginda bu
# per-element yapilmis ve JS<->Python sapmasina yol acmisti - kopru kapisi yakaladi).
rmu, rsd = R[tr].mean((0,2,3), keepdims=True), R[tr].std((0,2,3), keepdims=True) + 1e-6
smu, ssd = S[tr].mean(0), S[tr].std(0) + 1e-6
bmu, bsd = B[tr].mean(0), B[tr].std(0) + 1e-6
# Secenek ozniteligi SECENEK EKSENI BOYUNCA da ortalanir (0,1): uc secenek AYNI
# olcege oturmali, yoksa "sira 0" ile "sira 2" farkli birimlerde olurdu.
cmu, csd = C[tr].mean((0,1)), C[tr].std((0,1)) + 1e-6
Rn = (R - rmu) / rsd; Sn = (S - smu) / ssd; Bn = (B - bmu) / bsd; Cn = (C - cmu) / csd

class Model(nn.Module):
    """Baglam (durum+birim) bir kez kodlanir, her SECENEK o baglamla birlikte puanlanir.
       Cikti secenek basina TEK skalar -> softmax 3 secenek uzerinde. Bu kurgu secenek
       sayisindan bagimsizdir ve 'hangi noktayi secmeli' sorusunu dogru pozlar."""
    def __init__(self, sdim, bdim, cdim):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(KANAL, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, 32, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d((3, 4)), nn.Flatten())          # 32*3*4 = 384
        self.mlp = nn.Sequential(nn.Linear(sdim, 64), nn.ReLU())
        self.bir = nn.Sequential(nn.Linear(bdim, 32), nn.ReLU())
        self.bas = nn.Sequential(nn.Linear(384 + 64 + 32 + cdim, 128), nn.ReLU(),
                                 nn.Linear(128, 1))
    def forward(self, r, s, b, c):
        ctx = torch.cat([self.cnn(r), self.mlp(s), self.bir(b)], 1)   # (N, 480)
        n, k, cd = c.shape
        ctx = ctx.unsqueeze(1).expand(n, k, ctx.shape[1])             # her secenege ayni baglam
        return self.bas(torch.cat([ctx, c], 2)).squeeze(2)            # (N, 3) logit

torch.manual_seed(20260817)
model = Model(S.shape[1], B.shape[1], CDIM).to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
lossf = nn.CrossEntropyLoss()

rt = torch.tensor(Rn[tr], device=dev); st = torch.tensor(Sn[tr], device=dev)
bt = torch.tensor(Bn[tr], device=dev); ct = torch.tensor(Cn[tr], device=dev)
kt = torch.tensor(K[tr], device=dev)
rv = torch.tensor(Rn[te], device=dev); sv = torch.tensor(Sn[te], device=dev)
bv = torch.tensor(Bn[te], device=dev); cv = torch.tensor(Cn[te], device=dev)
kv = torch.tensor(K[te], device=dev)

NT = rt.shape[0]; PARTI = min(512, NT)
en_iyi, bekle, en_iyi_durum = 9e9, 0, None
for ep in range(EPOK):
    model.train()
    perm = torch.randperm(NT, device=dev)
    for i in range(0, NT, PARTI):
        ix = perm[i:i+PARTI]
        opt.zero_grad()
        lossf(model(rt[ix], st[ix], bt[ix], ct[ix]), kt[ix]).backward()
        opt.step()
    model.eval()
    with torch.no_grad():
        vl = lossf(model(rv, sv, bv, cv), kv).item()
    if vl < en_iyi - 1e-4:
        en_iyi, bekle = vl, 0
        en_iyi_durum = {k: v.detach().clone() for k, v in model.state_dict().items()}
    else:
        bekle += 1
        if bekle > 30: break
if en_iyi_durum: model.load_state_dict(en_iyi_durum)

model.eval()
with torch.no_grad():
    lg = model(rv, sv, bv, cv).cpu().numpy()
tah = lg.argmax(1)
dog = float((tah == K[te]).mean())
print('')
print(f'cihaz {dev} | en iyi dogrulama kaybi {en_iyi:.4f} | epok {ep+1}')
print(f'SONUC   dogruluk %{dog*100:.1f}')
print(f'  cogunluk tabanina gore : {(dog-t_cog)*100:+.1f} puan')
print(f'  "HEP #1" tabanina gore : {(dog-t_ele)*100:+.1f} puan   <- KARAR BU')

print('')
print('SECENEK KIRILIMI')
print('  secenek'.ljust(18) + 'gercek'.rjust(8) + 'tahmin'.rjust(8) + 'anma'.rjust(8) + 'kesinlik'.rjust(10))
for i in range(SECENEK):
    g = (K[te] == i); p = (tah == i)
    anma = float((tah[g] == i).mean()) if g.sum() else float('nan')
    kes = float((K[te][p] == i).mean()) if p.sum() else float('nan')
    print('  ' + AD[i].ljust(16) + str(int(g.sum())).rjust(8) + str(int(p.sum())).rjust(8) +
          f'%{anma*100:.0f}'.rjust(8) + f'%{kes*100:.0f}'.rjust(10))

# COKME KAPISI: butun kutle tek secenege yikildiysa dogruluk yuksek ciksa bile
# ogrenilmis bir sey yoktur - o taban zaten bedavaydi.
enCok = float(np.bincount(tah, minlength=SECENEK).max()) / max(1, len(tah))
print('')
if enCok > 0.90:
    print(f"  ! COKME: tahminlerin %{enCok*100:.0f}'i tek secenekte - ag taban politikaya cokmus.")
else:
    print(f'  tahmin dagilimi saglikli (en buyuk secenek payi %{enCok*100:.0f}).')
print('')
print('  UYARI: dogruluk NIHAI OLCU DEGIL. Asil kapi MAC SONUCUDUR (tools/rol-dengesi.js).')
print('  Etiketle tam uyusmayan bir politika yine de daha iyi oynayabilir; tersi de dogru.')

if KAYDET:
    os.makedirs(os.path.dirname(KAYDET) or '.', exist_ok=True)
    torch.save({'model': model.state_dict(), 'rmu': rmu, 'rsd': rsd, 'smu': smu, 'ssd': ssd,
                'bmu': bmu, 'bsd': bsd, 'cmu': cmu, 'csd': csd,
                'sdim': int(S.shape[1]), 'bdim': int(B.shape[1]), 'cdim': int(CDIM),
                'gx': GX, 'gy': GY, 'secenek': SECENEK, 'dogruluk': dog,
                'taban': t_ele, 'karar': int(len(K)), 'mac': len(maclar)}, KAYDET)
    print(f'\nmodel kaydedildi: {KAYDET}')
