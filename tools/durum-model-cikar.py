# DURUM MODELI -> JS. Egitilmis .pt agirliklarini motorun okuyabilecegi JS dosyasina cevirir.
#
# NEDEN AYRI ADIM: model PyTorch'ta egitiliyor ama ARAMA JS tarafinda kosuyor. Kopru olmadan
# deger agi hicbir ise yaramaz (bu, aylardir eksik olan parcaydi: ro 0.830'luk eski model
# egitilmis ama motora HIC baglanmamisti).
#
# NORMALIZASYON DA TASINIR: rmu/rsd/smu/ssd ve ys olmadan agirliklar anlamsizdir. Egitimde
# girdi (x-mu)/sd ile normalize edilip cikti ys ile olceklendi; JS tarafi ayni donusumu
# uygulamak ZORUNDA, yoksa tahmin sessizce coper.
#
#   python tools/durum-model-cikar.py --model qa-runtime/durum-model.pt --out js/BattleValueModel.js
import sys, json, torch

def arg(a, d=None):
    return sys.argv[sys.argv.index(a) + 1] if a in sys.argv else d

MODEL = arg('--model', 'qa-runtime/durum-model.pt')
OUT = arg('--out', 'js/BattleValueModel.js')
BASAMAK = int(arg('--basamak', 6))

ck = torch.load(MODEL, map_location='cpu', weights_only=False)
sd = ck['model']

def liste(t):
    return [round(float(x), BASAMAK) for x in t.flatten().tolist()]

paket = {
    'gx': int(ck['gx']), 'gy': int(ck['gy']), 'sdim': int(ck['sdim']),
    'ys': float(ck['ys']),
    'rmu': liste(torch.as_tensor(ck['rmu'])), 'rsd': liste(torch.as_tensor(ck['rsd'])),
    'smu': liste(torch.as_tensor(ck['smu'])), 'ssd': liste(torch.as_tensor(ck['ssd'])),
    'rho': float(ck.get('rho', 0)), 'goruntu': int(ck.get('goruntu', 0)), 'mac': int(ck.get('mac', 0)),
    'w': {}
}
for k, v in sd.items():
    paket['w'][k] = {'sekil': list(v.shape), 'v': liste(v)}

govde = json.dumps(paket, separators=(',', ':'))
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// OTOMATIK URETILDI - tools/durum-model-cikar.py. ELLE DUZENLEME.\n')
    f.write('// Durum -> nihai marj deger agi. Egitim: tools/durum-egit-gpu.py\n')
    f.write('// rho %.3f | %d goruntu | %d mac\n' % (paket['rho'], paket['goruntu'], paket['mac']))
    f.write('const BATTLE_VALUE_MODEL = ' + govde + ';\n')
    f.write("if (typeof module !== 'undefined' && module.exports) module.exports = { BATTLE_VALUE_MODEL };\n")

print('yazildi: %s' % OUT)
print('  rho %.3f  |  sdim %d  |  raster %dx%d  |  katman %d' %
      (paket['rho'], paket['sdim'], paket['gy'], paket['gx'], len(paket['w'])))
for k, v in paket['w'].items():
    print('    %-20s %s' % (k, v['sekil']))
