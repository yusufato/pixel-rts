'use strict';
// MINI DOM — govde js/MiniDom.js'e TASINDI (tek kopya kurali).
//
// NEDEN TASINDI: ayni shim'e tarayici Worker'i da ihtiyac duyuyor (Worker'da DOM yok).
// Iki kopya tutmak "worker ana is parcacigindan farkli davraniyor" sinifindan, bulunmasi
// cok zor hatalar uretirdi. Ayrica `package.json` `build.files` yalniz `js/**` iceriyor,
// `tools/**` DEGIL — shim js/ altinda olmak zorunda, yoksa EXE'de worker yuklenemez.
//
// ⚠ OLCULMUS NEGATIF SONUC (js/MiniDom.js basliginda ayrintili): Node tezgahinda
// mini-DOM jsdom'dan 3.6 KAT YAVAS. Bu dosya yalniz `--minidom` ile devreye girer.
// Worker'da o sorun YOK (orada vm yok).
module.exports = require('../js/MiniDom.js');
