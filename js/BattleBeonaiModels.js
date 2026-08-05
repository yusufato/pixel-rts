// beonai SURUM KAYDI - bu dosya tools/beonai-egit.js tarafindan URETILIR.
// Su an kayitli surum YOK: beonai altyapisi hazir, egitilmis model henuz uretilmedi.
// Egitim akisi:
//   1) node tools/beonai-uret.js --maclar 12       -> oracle etiketli veri (JSONL)
//   2) node tools/beonai-egit.js --surum beonai-v1 -> bu dosyayi UZERINE yazar
//   3) node tools/caprazla.js --tarifler qa-runtime/tarifler-beonai.json
//        --sal H0-beonai --sav H0-kodAI --seeds 24 -> cok tohumlu degerlendirme;
//      nihai karar --final havuzunda (disorneklem).
//
// Surum kaydi motor surumunu kunyede tutar; motor degisince model BAYAT sayilir ve
// otomatik baglanmaz (BattleBeonai.js -> battleBeonaiUyumlu).
if (typeof module !== "undefined" && module.exports) module.exports = { model: null, kunye: null };
