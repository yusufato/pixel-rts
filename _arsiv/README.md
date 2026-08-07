# _arsiv — bayat / geçersiz dosyalar

Buradaki hiçbir şey ÇALIŞAN kodun parçası değildir. Silinmek yerine taşındılar ki geçmiş
kaybolmasın, ama `grep` sonuçlarında canlı kodla karışmasınlar.

**Kural:** buraya taşımadan önce ölü olduğu KANITLANIR (kim yüklüyor / kim atıf veriyor).
Kanıt aşağıya yazılır. Şüphedeyse taşınmaz.

---

## `kok-olu-kopyalar/` — repo kökündeki yüklenmeyen .js dosyaları (2026-08-07)

`index.html` YALNIZ `js/` altındaki dosyaları yükler (94 script etiketinin tamamı `js/` önekli;
kök-seviyesi script etiketi yok). `package.json` girişi `electron/main.js`.

| dosya | ölü olma kanıtı |
|---|---|
| `globals.js` | `js/globals.js`'in ESKİ kopyası (29 Tem), içerik farklı — canlı olan `js/` altındaki |
| `main.js` | `js/main.js`'in ESKİ kopyası (26 Tem), içerik farklı |
| `test.js` | 18 Tem; hiçbir html/js/json atıf vermiyor |
| `split.js` | atıf yok |
| `support.js` | tasarım klasörünün KENDİ `support.js`'i var (`Oyun tasarımı planı/design_handoff_war_room/support.js`); kökteki kullanılmıyor |
| `StoryGeoRender.js` | `js/` altında karşılığı YOK ve hiçbir yerden yüklenmiyor; yalnız `gercekci-harita.html` içinde "drop-in" olarak ANILIYOR (bağlanmamış tasarım ürünü) |

**Neden taşındı:** `grep` her aramada iki dosya birden döndürüyordu → yanlış dosyayı düzenleme
riski gerçekti (birkaç kez yaşandı). Bkz. `docs/OLCUM-TUZAKLARI.md`.

---

## `hikaye-eski-planlar/` — yerini kanonik hikâye planına bırakmış belgeler (2026-08-07)

Bu klasördeki belgeler tarihî tasarım bağlamıdır; güncel uygulama sırasını veya çalışan
sistem durumunu belirlemez. Güncel kaynaklar kökteki
`HIKAYE_MODU_KATMANLI_DUNYA_SIMULASYONU_PLANI.md`,
`HIKAYE_MODU_UYGULAMA_DURUMU.md` ve `MODERN_DUNYA_EKSIKLERI.md` dosyalarıdır.

| dosya | arşiv kanıtı |
|---|---|
| `ACIK_DUNYA_TASARIM.md` | “uygulama Faz-0'dan başlamadı”, “NODE/build/test/GPU YOK”, eski Linux çalışma yolu ve artık bulunmayan tek-dosya mimarisi gibi güncel depoyla çelişen durum beyanları taşıyor; canlı dosyalardan doğrudan atıf almıyor. |
| `PLAN-MODERN-DUNYA.md` | Eski 0–7 aşamalı modern dünya taslağı; karakter, fraksiyon, ekonomi, medya, şirket, hafıza ve kara kuğu kapsamı güncel 71 fazlı ana plana ayrıntılı biçimde aktarıldı; canlı dosyalardan doğrudan atıf almıyor. |

**Taşınmayanlar:** `HIKAYE_LLM_YETERLILIK_RAPORU.md`, `DIS_ANALIZ_VERI_DEFTERI.md`,
`MODERN_DUNYA_EKSIKLERI.md` ve `docs/HIKAYE-TEST-PARALEL.md` güncel plan/README tarafından
hâlâ kaynak veya kabul kanıtı olarak kullanılıyor. `OYUN_TASARIM.md` ve
`GELISTIRME_PLANI.md` yalnız hikâye belgesi olmadığı ve savaş/genel ürün kararları da taşıdığı
için kesin ölü kanıtı olmadan taşınmadı.
