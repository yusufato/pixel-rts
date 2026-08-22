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
riski gerçekti (birkaç kez yaşandı). Bkz. `../docs/battle-ai/research/OLCUM-TUZAKLARI.md`.

---

## `hikaye-eski-planlar/` — yerini kanonik hikâye planına bırakmış belgeler (2026-08-07)

Bu klasördeki belgeler tarihî tasarım bağlamıdır; güncel uygulama sırasını veya çalışan
sistem durumunu belirlemez. Güncel kaynaklar kökteki
`../docs/story/plans/HIKAYE_MODU_KATMANLI_DUNYA_SIMULASYONU_PLANI.md`,
`../docs/story/status/HIKAYE_MODU_UYGULAMA_DURUMU.md` ve `../docs/story/status/MODERN_DUNYA_EKSIKLERI.md` dosyalarıdır.

| dosya | arşiv kanıtı |
|---|---|
| `ACIK_DUNYA_TASARIM.md` | “uygulama Faz-0'dan başlamadı”, “NODE/build/test/GPU YOK”, eski Linux çalışma yolu ve artık bulunmayan tek-dosya mimarisi gibi güncel depoyla çelişen durum beyanları taşıyor; canlı dosyalardan doğrudan atıf almıyor. |
| `PLAN-MODERN-DUNYA.md` | Eski 0–7 aşamalı modern dünya taslağı; karakter, fraksiyon, ekonomi, medya, şirket, hafıza ve kara kuğu kapsamı güncel 71 fazlı ana plana ayrıntılı biçimde aktarıldı; canlı dosyalardan doğrudan atıf almıyor. |

**Taşınmayanlar:** `../docs/story/qa/HIKAYE_LLM_YETERLILIK_RAPORU.md`, `../docs/story/research/DIS_ANALIZ_VERI_DEFTERI.md`,
`../docs/story/status/MODERN_DUNYA_EKSIKLERI.md` ve `../docs/story/qa/HIKAYE-TEST-PARALEL.md` güncel plan/README tarafından
hâlâ kaynak veya kabul kanıtı olarak kullanılıyor. `../docs/product/OYUN_TASARIM.md` ve
`../docs/product/GELISTIRME_PLANI.md` yalnız hikâye belgesi olmadığı ve savaş/genel ürün kararları da taşıdığı
için kesin ölü kanıtı olmadan taşınmadı.

---

## `Story3D-shelved-2026-08-21.zip` — 3B hikâye haritası prototipi

Ürün kararıyla hikâye modunun resmî haritası 2B olarak sabitlendi. ZIP; yedi
Story3D kaynak dosyasını, yedi odak testini, CC0 GLB/doku/lisans varlıklarını,
3B plan/doğrulama belgelerini, 32 QA kanıt dosyasını ve entegrasyon dosyalarının
3B çalışırken alınmış kopyalarını tek geri döndürülebilir pakette saklar.

**Rafa kaldırma kanıtı:** `index.html` artık Story3D script'i veya Three.js
import map yüklemiyor; `package.json` Three.js bağımlılığı ve 3B komutlarını
taşımıyor; Electron yalnız `2d` renderer bildiriyor. ZIP doğrulaması: 128 giriş,
15.205.517 bayt. Arşiv açılmadan içindeki hiçbir dosya çalışan oyunun parçası
değildir.

---

## `binary-dumps/` — yanlış uzantıyla tutulmuş ikili kayıtlar (2026-08-22)

| dosya | eski yol | arşiv kanıtı |
|---|---|---|
| `github.png` | `github.md` | İlk sekiz bayt `89504E470D0A1A0A` PNG imzasıdır; dosya 608.872 baytlık ikili görüntüdür ve Markdown metni değildir. İçerik değiştirilmeden doğru uzantıyla taşındı. |

Bu klasör yaşayan görsel varlık kataloğu değildir. Dosyalar yalnız geçmişi
korumak için tutulur; aktif UI veya renderer tarafından yüklenmez.
