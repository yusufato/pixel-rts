# KAPI DEFTERİ — bütün maç kapılarının sonucu tek yerde

**Bu dosya ÜRETİLİR, elle yazılmaz.** Yeniden üretmek için:

```

KAPI ÖZETİ — gece-faz2.log, gece-gpu.log, gece-kapi.log, gece-stdout.log

  kapı                                              n    fark    std      t  taban  hüküm
  ──────────────────────────────────────────────────────────────────────────────────────────────
  H1: LA_DERIN 2 vs 5 (oynatilan aday sayisi)     128     656   3052   2.43    755  olculemedi
  H2: LA_KAPI_CARPAN 1 vs 0.25 (yayilim kapisi    128     330   2827   1.32    700  olculemedi
  H3: LA_UFUK 100 vs 200 (taze tohum, havuz ici   128     874   3164   3.13    783  GECTI (+)
  K0: karsi-batarya MEKANIZMA (maviye 3 topcu z     —       —      —      —      —  A/B degil
  K1: BATTLE_KARSI_BATARYA_HERKES kapali vs aci   128     -32    366  -0.98     90  ETKI YOK
  M0: MENZILE GIR mekanizma                         —       —      —      —      —  A/B degil
  M1: BATTLE_MENZILE_GIR kapali vs acik (mac ka   128     748   3101   2.73    768  olculemedi
  U0: ufuk maliyeti 100/200/300 (bos makinede)      —       —      —      —      —  A/B degil
  K0b: karsi-batarya MEKANIZMA (duzeltilmis)        —       —      —      —      —  A/B degil
  H1b: LA_DERIN 2 vs 5 DOGRULAMA (taze tohum, h   128     557   3114   2.02    771  olculemedi
  H4: LA_UFUK 200 vs 300 (kazanani zorla)         128     980   3273   3.39    810  GECTI (+)
  P1: LA_PERIYOT_TIK 100 vs 50 (karar sikligi,    128    -808   3164  -2.89    783  GECTI (-)
  P2: LA_HALKA 3 vs 5 (aday genisligi 24->40)     128    -299   2689  -1.26    666  olculemedi
  C3: LA_KABA_ADIM 1 vs 4 (20Hz vs 5Hz rollout)   128   -2390   2963  -9.13    733  GECTI (-)
  C5: LA_AG_KAPI true vs false (aday siralamasi   128     812   2315   3.97    573  GECTI (+)
  C4: LA_PERIYOT_TIK 100 vs 50 @ tam guc (karar   128    -508   2409  -2.38    596  olculemedi
  C2b: LA_DERIN 2 vs 5 @ ufuk 300 (toplanma var     —       —      —      —      —  suruyor
  B: arama taban (arama kapali vs acik)           192     735   2872   3.55    580  GECTI (+)
  C: emir omru koruma 0 vs 1 (yalniz MOVE)        192     552   2812   2.72    568  olculemedi
  D: ufuk 100 vs 200 tik (5sn vs 10sn)            128     357   3009   1.34    745  olculemedi
  E: emir omru koruma 0 vs 15 DOGRULAMA (taze t   192     277   3415   1.12    690  olculemedi
  F: koruma 0 vs 1 DOGRULAMA (taze tohum 100192   192      64   3051   0.29    617  olculemedi
  G: koruma 1 vs 15 DOGRUDAN (taze tohum 100384     —       —      —      —      —  A/B degil
  H: LA_DERIN 2 vs 5 (oynatilan aday sayisi) —      —       —      —      —      —  A/B degil

  GECTI = |fark| saptama tabanının üstünde (karar verilebilir)
  ETKI YOK = taban altı VE std çok küçük → kol dünyayı kıpırdatmıyor (güvenle hayır)
  olculemedi = taban altı ama std normal → bu n ile GÖREMİYORUZ (etkisiz DEMEK DEĞİL)

  ═══ HAVUZ (ters-varyans) ═══
    LA_DERIN 2,5: n 256  havuz 607  se 193  t 3.15  taban 540  → TABANIN USTUNDE
    LA_UFUK 100,200: n 256  havuz 603  se 193  t 3.13  taban 540  → TABANIN USTUNDE
    LA_PERIYOT_TIK 100,50: n 256  havuz -618  se 169  t -3.65  taban 488  → TABANIN USTUNDE
    BATTLE_LA_EMIR_KORUMA 0,1: n 384  havuz 328  se 149  t 2.20  taban 419  → taban alti

```

## Makine 2 kapıları (docs/kayit-m2/m2.log)

```

KAPI ÖZETİ — m2.log

  kapı                                              n    fark    std      t  taban  hüküm
  ──────────────────────────────────────────────────────────────────────────────────────────────
  M2-1: BATTLE_MENZILE_GIR false vs true (M1 te   128    1222   3229   4.28    799  GECTI (+)
  M2-2: LA_PERIYOT_TIK 100 vs 50 @ tam guc        128    -687   2474  -3.14    612  GECTI (-)
  M2-3: LA_DERIN 2 vs 5 @ ufuk 300                128     954   2667   4.05    660  GECTI (+)
  M2-4: BATTLE_TOPCU_DURAGAN false vs true @ ta   128     349   2105   1.87    521  olculemedi
  M2-5: LA_UFUK 300 vs 400 @ derin 5 (ufuk hala   128     440   2131   2.34    527  olculemedi
  M2-6: LA_AG_KAPI true vs false @ tam guc (C5    128     976   2229   4.96    552  GECTI (+)
  M2-7: LA_HALKA 3 vs 5 @ tam guc (aday genisli   128    -189   2587  -0.83    640  olculemedi
  M2-8: LA_YARICAP 600 vs 900 @ tam guc (aday e     —       —      —      —      —  suruyor

  GECTI = |fark| saptama tabanının üstünde (karar verilebilir)
  ETKI YOK = taban altı VE std çok küçük → kol dünyayı kıpırdatmıyor (güvenle hayır)
  olculemedi = taban altı ama std normal → bu n ile GÖREMİYORUZ (etkisiz DEMEK DEĞİL)

```
