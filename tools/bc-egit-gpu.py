# DAVRANIS KLONLAMA EGITIMI — beonai, kod-AI'in KARARINI taklit etsin.
#
# FARK (odul egitiminden): hedef odul degil, KOD-AI'IN SECTIGI ADAY (bcIndex).
#   odul egitimi : her adaya z-skorlu odul, MSE
#   klonlama     : karar icindeki adaylar uzerinde SOFTMAX + capraz entropi, hedef = bcIndex
# Mimari AYNI (Linear-Tanh-Linear, tek skor) — boylece JS tarafindaki `selForward` degismeden
# calisir ve determinizm etkilenmez (cikarim saf JS, agirliklar sabit).
#
# ETIKET NEREDEN: tools/bc-etiket.js — ayni intent + kod-AI'in MAIN hedefine en yakin aday noktasi.
# DURUSTLUK: bir kararda yalniz ~3 ayrik aday noktasi var; etiket "kod-AI'in yapacagina EN YAKIN
# ifade edilebilir aday"dir. Taklidin tavani ogretmendir — bu egitim intel4-pro'yu GECMEZ, esitler.
#
# BOLME: MAC (tohum) duzeyinde. Ayni macin kararlari hem egitime hem dev'e girerse dev sizar.
import argparse, json, math, os, random, sys, time
import torch

def log(*a): print(*a, flush=True)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--veri", default="qa-runtime/bc-etiketli.jsonl")
    p.add_argument("--out", default="js/BattleBeonaiModelBC.js")
    p.add_argument("--surum", default="beonai-klon")
    p.add_argument("--epok", type=int, default=400)
    p.add_argument("--lr", type=float, default=0.02)
    p.add_argument("--wd", type=float, default=1e-4)
    p.add_argument("--h", type=int, default=48)
    p.add_argument("--devoran", type=float, default=0.2)
    p.add_argument("--zayifsuz", action="store_true", help="intent eslesmeyen (zayif) etiketleri ELE")
    a = p.parse_args()

    kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    yol = a.veri if os.path.isabs(a.veri) else os.path.join(kok, a.veri)
    cihaz = "cuda" if torch.cuda.is_available() else "cpu"
    log("BC EGITIMI — cihaz: %s" % cihaz)
    log("  veri: %s" % yol)

    ornekler, elenen = [], {"etiketsiz": 0, "az_aday": 0, "bozuk": 0, "zayif": 0, "surum_uyusmaz": 0}
    s_ver = c_ver = None
    with open(yol, "r", encoding="utf-8") as f:
        for satir in f:
            satir = satir.strip()
            if not satir: continue
            try: o = json.loads(satir)
            except Exception: elenen["bozuk"] += 1; continue
            v = o.get("veri")
            if not v or not v.get("rows"): elenen["bozuk"] += 1; continue
            if v.get("bcIndex") is None: elenen["etiketsiz"] += 1; continue
            if len(v["rows"]) < 2: elenen["az_aday"] += 1; continue
            if a.zayifsuz and v.get("bcZayif"): elenen["zayif"] += 1; continue
            if s_ver is None: s_ver, c_ver = v.get("stateVersion"), v.get("candidateVersion")
            elif v.get("stateVersion") != s_ver or v.get("candidateVersion") != c_ver:
                elenen["surum_uyusmaz"] += 1; continue
            ornekler.append({"seed": o.get("seed"), "state": v["stateFeatures"],
                             "rows": [r["features"] for r in v["rows"]],
                             "hedef": int(v["bcIndex"]), "mesafe": v.get("bcMesafe", 0)})
    log("  karar: %d   elenen: %s" % (len(ornekler), json.dumps(elenen)))
    if len(ornekler) < 50:
        log("EGITIM KUMESI COK KUCUK."); sys.exit(1)

    # MAC DUZEYINDE BOLME (tuzak: karar duzeyinde bolersen ayni macin komsu kararlari dev'e sizar)
    tohumlar = sorted({o["seed"] for o in ornekler})
    random.Random(12345).shuffle(tohumlar)
    n_dev = max(1, int(len(tohumlar) * a.devoran))
    dev_tohum = set(tohumlar[:n_dev])
    egitim = [o for o in ornekler if o["seed"] not in dev_tohum]
    dev = [o for o in ornekler if o["seed"] in dev_tohum]
    log("  mac: %d (egitim %d / dev %d)   karar: egitim %d / dev %d"
        % (len(tohumlar), len(tohumlar) - n_dev, n_dev, len(egitim), len(dev)))

    # VEKTORLESTIRME (sart): aday sayisi kararlar arasi degisiyor. Python'da karar karar donmek
    # 15.014 karar x 400 epok = 6M yineleme demekti ve egitim ilerlemedi.
    # Cozum: skorlari TEK seferde hesapla, sonra [karar x azami_aday] PADLI matrise dagit,
    # bos yuvalari -inf yap (softmax'ta sifir agirlik). Boylece capraz entropi tek cagri olur.
    def tensorle(kume):
        X, satirKarar, satirYuva, hedefler = [], [], [], []
        for i, o in enumerate(kume):
            for j, r in enumerate(o["rows"]):
                X.append(o["state"] + r); satirKarar.append(i); satirYuva.append(j)
            hedefler.append(o["hedef"])
        azami = max(len(o["rows"]) for o in kume)
        return {
            "X": torch.tensor(X, dtype=torch.float32, device=cihaz),
            "kar": torch.tensor(satirKarar, dtype=torch.long, device=cihaz),
            "yuva": torch.tensor(satirYuva, dtype=torch.long, device=cihaz),
            "hedef": torch.tensor(hedefler, dtype=torch.long, device=cihaz),
            "n": len(kume), "azami": azami,
            "aday": torch.tensor([len(o["rows"]) for o in kume], dtype=torch.float32, device=cihaz),
        }

    E = tensorle(egitim)
    DV = tensorle(dev) if dev else None
    D = E["X"].shape[1]
    log("  boyut: D=%d  H=%d  aday-satiri=%d  azami aday=%d" % (D, a.h, E["X"].shape[0], E["azami"]))

    torch.manual_seed(12345)
    model = torch.nn.Sequential(torch.nn.Linear(D, a.h), torch.nn.Tanh(), torch.nn.Linear(a.h, 1)).to(cihaz)
    opt = torch.optim.Adam(model.parameters(), lr=a.lr, weight_decay=a.wd)

    NEG = torch.finfo(torch.float32).min
    def kayip_ve_isabet(K):
        """Karar ICINDE softmax + capraz entropi — TEK cagri (padli matris + -inf maske)."""
        skor = model(K["X"]).squeeze(1)
        M = torch.full((K["n"], K["azami"]), NEG, device=cihaz)
        M[K["kar"], K["yuva"]] = skor
        kayip = torch.nn.functional.cross_entropy(M, K["hedef"])
        isabet = (M.argmax(1) == K["hedef"]).float().mean().item()
        return kayip, isabet

    t0 = time.time()
    en_iyi = {"ep": -1, "dev": float("inf"), "isabet": 0.0, "agirlik": None}
    for ep in range(a.epok):
        opt.zero_grad(set_to_none=True)
        k, isabet = kayip_ve_isabet(E)
        k.backward(); opt.step()
        if DV is not None:
            with torch.no_grad():
                dk, d_isabet = kayip_ve_isabet(DV)
                dk = dk.item()
            if dk < en_iyi["dev"]:
                en_iyi = {"ep": ep, "dev": dk, "isabet": d_isabet,
                          "agirlik": {kk: vv.detach().clone() for kk, vv in model.state_dict().items()}}
        else:
            dk, d_isabet = float("nan"), float("nan")
        if ep % max(1, a.epok // 8) == 0 or ep == a.epok - 1:
            log("    epok %4d  egitim kayip %.4f isabet %.3f | dev kayip %.4f isabet %.3f"
                % (ep, k.item(), isabet, dk, d_isabet))
    sure = time.time() - t0
    if en_iyi["agirlik"] is not None:
        model.load_state_dict(en_iyi["agirlik"])
        log("  ERKEN DURDURMA: en iyi dev epok %d (kayip %.4f, isabet %.3f)"
            % (en_iyi["ep"], en_iyi["dev"], en_iyi["isabet"]))

    # TABAN: rastgele secim = 1/aday_sayisi ortalamasi. Model bunu ACIK ARA gecmeli.
    def taban(K): return float((1.0 / K["aday"]).mean().item())
    with torch.no_grad():
        _, e_isabet = kayip_ve_isabet(E)
        d_isabet = kayip_ve_isabet(DV)[1] if DV is not None else float("nan")
    e_taban, d_taban = taban(E), (taban(DV) if DV is not None else float("nan"))
    log("")
    log("  KOD-AI'I TUTTURMA (top-1):")
    log("    egitim: %.1f%%   (rastgele taban %.1f%%)" % (e_isabet * 100, e_taban * 100))
    log("    DEV   : %.1f%%   (rastgele taban %.1f%%)" % (d_isabet * 100, d_taban * 100))
    log("  NOT: bu KARAR SECME olcusudur, MAC SONUCU DEGIL. Mac kapisi ayri kosulur.")

    l1, l2 = model[0], model[2]
    jsmodel = {"stateVersion": s_ver, "candidateVersion": c_ver, "D": D, "H": a.h,
               "W1": l1.weight.detach().cpu().tolist(), "b1": l1.bias.detach().cpu().tolist(),
               "W2": l2.weight.detach().cpu().squeeze(0).tolist(),
               "b2": float(l2.bias.detach().cpu().item()),
               "trainedOn": {"decisions": len(egitim), "epochs": a.epok, "devTop1": d_isabet}}
    motor = None
    try:
        with open(os.path.join(kok, "js/BattleSession.js"), "r", encoding="utf-8") as f: icerik = f.read()
        i = icerik.find("BATTLE_ENGINE_VERSION")
        if i >= 0:
            j = icerik.find("'", i); kk = icerik.find("'", j + 1); motor = icerik[j + 1:kk]
    except Exception: pass
    if not motor: log("  ! UYARI: motor surumu okunamadi — bayatlik korumasi CALISMAZ")

    kunye = {"surum": a.surum, "uretildi": "bc-egit-gpu", "motorSurumu": motor, "cihaz": cihaz,
             "sureSn": round(sure, 1), "kararEgitim": len(egitim), "kararDev": len(dev),
             "devTohumlari": sorted(dev_tohum), "epok": a.epok, "lr": a.lr, "H": a.h,
             "hedef": "davranis-klonlama (kod-AI karari)",
             "egitimTop1": round(e_isabet, 4), "devTop1": round(d_isabet, 4),
             "rastgeleTaban": round(d_taban, 4), "elenen": elenen}
    ad = "".join(ch if ch.isalnum() else "_" for ch in a.surum).upper()
    govde = (
        "// OTOMATIK URETIM — tools/bc-egit-gpu.py (davranis klonlama). ELLE DUZENLEME.\n"
        "// Egitim GPU'da; CIKARIM saf JS (agirliklar sabit) -> determinizm etkilenmez.\n"
        "const BATTLE_BEONAI_MODEL_%s = %s;\n"
        "const BATTLE_BEONAI_KUNYE_%s = %s;\n"
        "if (typeof battleBeonaiKaydet === \"function\") battleBeonaiKaydet(%s, BATTLE_BEONAI_MODEL_%s, BATTLE_BEONAI_KUNYE_%s);\n"
        "if (typeof module !== \"undefined\" && module.exports) module.exports = { model: BATTLE_BEONAI_MODEL_%s, kunye: BATTLE_BEONAI_KUNYE_%s };\n"
    ) % (ad, json.dumps(jsmodel), ad, json.dumps(kunye), json.dumps(a.surum), ad, ad, ad, ad)
    with open(os.path.join(kok, a.out), "w", encoding="utf-8") as f: f.write(govde)
    log("")
    log("BC_EGIT_OK  surum %s  -> %s" % (a.surum, a.out))

if __name__ == "__main__":
    main()
