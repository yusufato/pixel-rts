#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
beonai GPU EGITIMI  —  ayni model, ayni kayip, CUDA uzerinde

NEDEN GPU (olculdu): JS/CPU egitimi 200 karar (12.800 ornek) x 300 epok = 100 sn;
2000 karar 10 dakikada bitmedi. Egitim = 38M ileri/geri gecis -> tam olarak GPU isi.
(Simulasyonun kendisi GPU'ya UYGUN DEGIL: sirali tikler, dallanmali JS, byte-ayni
replay garantisi. Ama EGITIM oyle degil.)

DETERMINIZM ETKILENMEZ: model egitimden sonra DONDURULUR; oyunda calisan sey saf-JS
cikarimdir (agirliklar sabit sayilardir). Yani GPU'nun kayan-nokta sirasi replay
garantisini HIC ilgilendirmez. Bu, mumkun olan en temiz GPU entegrasyonu.

BIREBIR AYNI MATEMATIK (js/BattleSelector.js):
  girdi   : stateFeatures (105) + candidateFeatures (23) = 128
  model   : Linear(128->H) -> tanh -> Linear(H->1)        [selForward ile ayni]
  hedef   : karar icindeki odullerin z-skoru  (selBuildExample)
  kayip   : MSE
  cikti   : W1 (H x 128), b1 (H), W2 (H), b2  -> JS model bicimi

Kullanim:
  python tools/beonai-egit-gpu.py --veri qa-runtime/beonai-veri.jsonl --surum beonai-v1
"""
import argparse, json, math, os, sys, time

def log(*a): print(*a, flush=True)

def veri_yukle(yol):
    """JSONL -> (durum, aday-ozellikleri, hedefler). beonai-egit.js ile AYNI filtreler."""
    ornekler = []
    elenen = {"aktif_degil": 0, "varyans_sifir": 0, "surum_uyusmaz": 0, "bozuk": 0}
    s_ver = c_ver = None
    with open(yol, "r", encoding="utf-8") as f:
        for satir in f:
            satir = satir.strip()
            if not satir:
                continue
            try:
                o = json.loads(satir)
            except Exception:
                elenen["bozuk"] += 1
                continue
            v = o.get("veri")
            if not v or not v.get("stateFeatures") or not v.get("rows"):
                elenen["bozuk"] += 1
                continue
            if s_ver is None:
                s_ver, c_ver = v.get("stateVersion"), v.get("candidateVersion")
            if v.get("stateVersion") != s_ver or v.get("candidateVersion") != c_ver:
                elenen["surum_uyusmaz"] += 1
                continue
            if o.get("aktif") is False or v.get("active") is False:
                elenen["aktif_degil"] += 1
                continue
            od = [r["reward"] for r in v["rows"]]
            ort = sum(od) / len(od)
            vary = sum((x - ort) ** 2 for x in od) / len(od)
            if not vary > 0:
                elenen["varyans_sifir"] += 1
                continue
            ornekler.append({"seed": o.get("seed"), "tick": o.get("tick"),
                             "state": v["stateFeatures"], "rows": v["rows"]})
    return ornekler, elenen, s_ver, c_ver

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--veri", default="qa-runtime/beonai-veri.jsonl")
    ap.add_argument("--surum", default="beonai-v1")
    ap.add_argument("--epok", type=int, default=300)
    ap.add_argument("--lr", type=float, default=0.02)
    ap.add_argument("--h", type=int, default=48)
    ap.add_argument("--wd", type=float, default=1e-4)
    ap.add_argument("--dev", type=float, default=0.2)
    ap.add_argument("--out", default="js/BattleBeonaiModels.js")
    ap.add_argument("--cihaz", default="auto")
    a = ap.parse_args()

    kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    veri_yolu = os.path.join(kok, a.veri)
    if not os.path.exists(veri_yolu):
        log("veri yok: " + a.veri + "  (once tools/beonai-toplu.js kosun)")
        sys.exit(1)

    try:
        import torch
    except ImportError:
        log("torch YOK. Kurulum: python -m pip install torch --index-url https://download.pytorch.org/whl/cu126")
        sys.exit(1)

    cihaz = a.cihaz
    if cihaz == "auto":
        cihaz = "cuda" if torch.cuda.is_available() else "cpu"
    if cihaz == "cuda" and not torch.cuda.is_available():
        log("! CUDA istendi ama yok -> CPU'ya dusuluyor")
        cihaz = "cpu"
    log("beonai GPU EGITIMI")
    log("  cihaz : " + cihaz + ("  (" + torch.cuda.get_device_name(0) + ")" if cihaz == "cuda" else ""))

    ornekler, elenen, s_ver, c_ver = veri_yukle(veri_yolu)
    log("  veri  : " + a.veri)
    log("  kullanilan: %d karar   ELENEN -> aktif degil %d, varyans sifir %d, surum uyusmaz %d, bozuk %d"
        % (len(ornekler), elenen["aktif_degil"], elenen["varyans_sifir"], elenen["surum_uyusmaz"], elenen["bozuk"]))
    if not ornekler:
        log("EGITILECEK ORNEK YOK.")
        sys.exit(1)

    # TOHUM bazinda bolme (ayni macin kararlari ayni tarafa -> sizinti yok) — JS ile ayni kural
    tohumlar = sorted({o["seed"] for o in ornekler})
    dev_say = max(1, round(len(tohumlar) * a.dev))
    dev_tohum = set(tohumlar[-dev_say:])
    egitim = [o for o in ornekler if o["seed"] not in dev_tohum]
    dev = [o for o in ornekler if o["seed"] in dev_tohum]
    log("  bolme : %d egitim / %d dev   (dev tohumlari: %s)" % (len(egitim), len(dev), sorted(dev_tohum)))
    if not egitim:
        log("EGITIM KUMESI BOS — daha cok tohumdan veri uretin.")
        sys.exit(1)

    def tensorle(kume):
        X, Y, gruplar = [], [], []
        bas = 0
        for o in kume:
            od = [r["reward"] for r in o["rows"]]
            ort = sum(od) / len(od)
            std = math.sqrt(sum((x - ort) ** 2 for x in od) / len(od)) or 1.0
            for r in o["rows"]:
                X.append(o["state"] + r["features"])
                Y.append((r["reward"] - ort) / std)
            gruplar.append((bas, bas + len(o["rows"])))
            bas += len(o["rows"])
        return (torch.tensor(X, dtype=torch.float32, device=cihaz),
                torch.tensor(Y, dtype=torch.float32, device=cihaz).unsqueeze(1), gruplar)

    Xe, Ye, Ge = tensorle(egitim)
    Xd, Yd, Gd = tensorle(dev) if dev else (None, None, [])
    D = Xe.shape[1]
    log("  boyut : D=%d  H=%d  ornek=%d (egitim) / %s (dev)" % (D, a.h, Xe.shape[0], Xd.shape[0] if Xd is not None else 0))

    torch.manual_seed(12345)
    model = torch.nn.Sequential(
        torch.nn.Linear(D, a.h), torch.nn.Tanh(), torch.nn.Linear(a.h, 1)
    ).to(cihaz)
    opt = torch.optim.Adam(model.parameters(), lr=a.lr, weight_decay=a.wd)
    kayip_f = torch.nn.MSELoss()

    t0 = time.time()
    for ep in range(a.epok):
        opt.zero_grad(set_to_none=True)
        kayip = kayip_f(model(Xe), Ye)
        kayip.backward()
        opt.step()
        if ep % max(1, a.epok // 5) == 0 or ep == a.epok - 1:
            with torch.no_grad():
                dk = kayip_f(model(Xd), Yd).item() if Xd is not None else float("nan")
            log("    epok %4d  egitim %.4f  dev %.4f" % (ep, kayip.item(), dk))
    sure = time.time() - t0
    log("  egitim suresi: %.1f sn  (%d epok)" % (sure, a.epok))

    # DEV OLCUSU: karar basina top-1 isabet + regret (JS selEvaluate ile ayni fikir).
    # NOT: bunlar KARAR SECME olculeridir, MAC SONUCU DEGIL.
    def degerlendir(X, gruplar, kume):
        if X is None or not gruplar:
            return None
        with torch.no_grad():
            skor = model(X).squeeze(1).cpu().tolist()
        top1 = 0
        model_regret = 0.0
        for (bas, son), o in zip(gruplar, kume):
            od = [r["reward"] for r in o["rows"]]
            sk = skor[bas:son]
            secilen = max(range(len(sk)), key=lambda i: sk[i])
            en_iyi = max(range(len(od)), key=lambda i: od[i])
            if secilen == en_iyi:
                top1 += 1
            model_regret += od[en_iyi] - od[secilen]
        n = len(gruplar)
        return {"n": n, "top1": round(top1 / n, 3), "ortRegret": round(model_regret / n, 2)}

    e_skor = degerlendir(Xe, Ge, egitim)
    d_skor = degerlendir(Xd, Gd, dev)
    log("  egitim skoru: " + json.dumps(e_skor))
    log("  DEV skoru   : " + json.dumps(d_skor))
    log("  NOT: bunlar KARAR SECME olculeridir, MAC SONUCU DEGIL.")
    log("       Gercek karar: node tools/caprazla.js ... (cok tohumlu, disorneklem)")

    # JS BICIMINE DONUSTUR: selForward -> h = tanh(W1 . x + b1); out = W2 . h + b2
    l1, l2 = model[0], model[2]
    W1 = l1.weight.detach().cpu().tolist()          # H x D
    b1 = l1.bias.detach().cpu().tolist()            # H
    W2 = l2.weight.detach().cpu().squeeze(0).tolist()   # H
    b2 = float(l2.bias.detach().cpu().item())

    motor = None
    try:
        with open(os.path.join(kok, "js/BattleSession.js"), "r", encoding="utf-8") as f:
            icerik = f.read()
        i = icerik.find("BATTLE_ENGINE_VERSION")
        if i >= 0:
            j = icerik.find("'", i); k = icerik.find("'", j + 1)
            motor = icerik[j + 1:k]
    except Exception:
        pass
    if not motor:
        log("  ! UYARI: motor surumu okunamadi — bayatlik korumasi bu surumde CALISMAZ")

    jsmodel = {"stateVersion": s_ver, "candidateVersion": c_ver, "D": D, "H": a.h,
               "W1": W1, "b1": b1, "W2": W2, "b2": b2,
               "trainedOn": {"examples": int(Xe.shape[0]), "epochs": a.epok, "dev": d_skor}}
    kunye = {"surum": a.surum, "uretildi": "beonai-egit-gpu", "motorSurumu": motor,
             "cihaz": cihaz, "sureSn": round(sure, 1), "kararEgitim": len(egitim), "kararDev": len(dev),
             "devTohumlari": sorted(dev_tohum), "epok": a.epok, "lr": a.lr, "H": a.h,
             "egitimSkor": e_skor, "devSkor": d_skor, "elenen": elenen}

    ad = "".join(ch if ch.isalnum() else "_" for ch in a.surum).upper()
    govde = (
        "// OTOMATIK URETIM — tools/beonai-egit-gpu.py (CUDA). ELLE DUZENLEME.\n"
        "// Egitim GPU'da yapildi; CIKARIM saf JS'tir (agirliklar sabit) -> determinizm etkilenmez.\n"
        "const BATTLE_BEONAI_MODEL_%s = %s;\n"
        "const BATTLE_BEONAI_KUNYE_%s = %s;\n"
        "if (typeof battleBeonaiKaydet === \"function\") battleBeonaiKaydet(%s, BATTLE_BEONAI_MODEL_%s, BATTLE_BEONAI_KUNYE_%s);\n"
        "if (typeof module !== \"undefined\" && module.exports) module.exports = { model: BATTLE_BEONAI_MODEL_%s, kunye: BATTLE_BEONAI_KUNYE_%s };\n"
    ) % (ad, json.dumps(jsmodel), ad, json.dumps(kunye), json.dumps(a.surum), ad, ad, ad, ad)
    with open(os.path.join(kok, a.out), "w", encoding="utf-8") as f:
        f.write(govde)
    log("")
    log("BEONAI_EGIT_GPU_OK  surum %s  -> %s" % (a.surum, a.out))

if __name__ == "__main__":
    main()
