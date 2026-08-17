# POLITIKA MODELI -> JS. Egitilmis .pt agirliklarini motorun okuyabilecegi JS dosyasina cevirir.
#
# NEDEN AYRI ADIM: model PyTorch'ta egitiliyor ama OYUN JS tarafinda kosuyor. Kopru olmadan
# politika agi hicbir ise yaramaz. Bu, projede iki kez yasanmis "olculdu ama baglanmadi"
# hatasinin panzehiri.
#
# NORMALIZASYON DA TASINIR: rmu/rsd/smu/ssd/bmu/bsd olmadan agirliklar anlamsizdir.
# Deger aginda raster normalizasyonu JS'te YANLIS uygulanmisti (eleman basina, oysa kanal
# basina olmali) ve bunu ancak Python<->JS karsilastirmasi yakaladi. Ayni kapi burada da
# zorunlu: tools/politika-kopru-kapisi.js
#
#   python tools/politika-model-cikar.py --model qa-runtime/politika-model.pt --out js/BattlePolicyModel.js
import sys, json, torch

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

MODEL = arg('--model', 'qa-runtime/politika-model.pt')
OUT = arg('--out', 'js/BattlePolicyModel.js')
# BASAMAK 8 — OLCULEREK secildi, tahminle degil. Kopru kapisindaki max logit farki:
#     6 basamak -> 2.25e-03   (KAPI DUSUYOR, esik 1e-3)
#     8 basamak -> 6.67e-05   (34x iyi, +150KB)
#    10 basamak -> 4.18e-05   (plato: kalan fark float32 toplama SIRASINDAN, indirilemez)
# Sebep: 488 boyutlu ic carpim + 128 gizli birim, agirlik basina 1e-6'lik yuvarlama
# hatasini ~1e-3'e kadar biriktiriyor. Deger agi (BattleValueModel.js) hala 6 basamak;
# orada cikti siralama icin kullanildigindan tolere edilebilir ama bilinsin.
BASAMAK = int(arg('--basamak', 8))

ck = torch.load(MODEL, map_location='cpu', weights_only=False)
sd = ck['model']

def liste(t):
    return [round(float(x), BASAMAK) for x in t.flatten().tolist()]

paket = {
    'gx': int(ck['gx']), 'gy': int(ck['gy']),
    'sdim': int(ck['sdim']), 'bdim': int(ck['bdim']), 'cdim': int(ck['cdim']),
    'secenek': int(ck['secenek']),
    'rmu': liste(torch.as_tensor(ck['rmu'])), 'rsd': liste(torch.as_tensor(ck['rsd'])),
    'smu': liste(torch.as_tensor(ck['smu'])), 'ssd': liste(torch.as_tensor(ck['ssd'])),
    'bmu': liste(torch.as_tensor(ck['bmu'])), 'bsd': liste(torch.as_tensor(ck['bsd'])),
    'cmu': liste(torch.as_tensor(ck['cmu'])), 'csd': liste(torch.as_tensor(ck['csd'])),
    'dogruluk': float(ck.get('dogruluk', 0)), 'tabanEleyici': float(ck.get('taban', 0)),
    'karar': int(ck.get('karar', 0)), 'mac': int(ck.get('mac', 0)),
    'w': {}
}
for k, v in sd.items():
    paket['w'][k] = {'sekil': list(v.shape), 'v': liste(v)}

govde = json.dumps(paket, separators=(',', ':'))
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// OTOMATIK URETILDI - tools/politika-model-cikar.py. ELLE DUZENLEME.\n')
    f.write('// Durum + birim -> aramanin sectigi aday sinifi. Egitim: tools/politika-egit-gpu.py\n')
    f.write('// dogruluk %%%.1f (eleyici tabani %%%.1f) | %d karar | %d mac\n'
            % (paket['dogruluk'] * 100, paket['tabanEleyici'] * 100, paket['karar'], paket['mac']))
    f.write('const BATTLE_POLICY_MODEL = ' + govde + ';\n')
    f.write("if (typeof module !== 'undefined' && module.exports) module.exports = { BATTLE_POLICY_MODEL };\n")

print('yazildi: %s' % OUT)
print('  dogruluk %.3f (taban %.3f) | secenek %d | cdim %d | raster %dx%d | katman %d'
      % (paket['dogruluk'], paket['tabanEleyici'], paket['secenek'], paket['cdim'],
         paket['gy'], paket['gx'], len(paket['w'])))
for k, v in paket['w'].items():
    print('    %-20s %s' % (k, v['sekil']))
