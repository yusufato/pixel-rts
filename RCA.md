# 1) Verdict

- **Root cause:** `ASSESS_ACTION_REQUEST_SCOPE` diyalog hamlesi politikası `claimTypes: []` ile tanımlı. Bu nedenle aynı turda doğru çıkarılmış `PLAYER_REPORTED_MILITARY_THREAT` iddiası, hamle sözleşmesi kurulurken eleniyor.
- **Confidence:** Confirmed.
- **Chain:** Oyuncu Halep'te düşman gücü bildirip destek istiyor → deterministik NLU askerî tehdidi doğru çıkarıyor → yanıt genel eylem kapsamı hamlesini seçiyor → hamle politikası mevcut tur iddialarını reddediyor → `claimRefs=[]` → doğrulama durumunu koruma yükümlülüğü sözleşmeye girmiyor.
- Hata devam ediyor; tam pakette ve tek worker `dialogueMoveContractProbe` koşusunda yeniden üretildi.

# 2) Failure Definition

- Görünen belirti: `dialogueMoveContractProbe` içinde `militaryClaimBound=false`; beklenen değer `true`.
- Yeniden üretim: `node tools/story-test-parallel.js --task dialogueMoveContractProbe --workers 1`.
- Etki alanı: Bir eylem veya destek talebiyle aynı cümlede sunulan doğrulanmamış oyuncu iddiaları. Karar metni iddiadan söz etse bile karar sözleşmesi kaynağı bağlamıyor.
- Korunması gereken karşı sözleşme: Ardından gelen ilişkisiz “Bugün nasılsın?” turu önceki askerî iddiayı taşımamalı.

# 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 2026-08-23 | Tam paket 77/88'de askerî iddia bağlama assertion'ında durdu | `npm test` | Dokümantasyon planı kapanışı engellendi. |
| 2026-08-23 | Tek görev/tek worker aynı sonucu verdi | İzole harness koşusu | Paralel worker yarışı dışlandı. |
| 2026-08-23 | Seed 2032 çalışma zamanı dökümü alındı | Doğrudan runtime incelemesi | İddianın NLU'da var, diyalog hamlesinde yok olduğu doğrulandı. |

# 4) Hypotheses (ranked)

## H1 — Genel eylem hamlesinin kaynak politikası mevcut tur iddiasını eliyor

- **If true, we would also see:** Analizde askerî claim bulunur; yanıt act'i `ASSESS_ACTION_REQUEST_SCOPE`, source policy `CURRENT_TURN_ONLY` ve `claimRefs=[]` olur.
- **Discriminating test:** Seed 2032'de askerî takip turunun analysis, response ve dialogueMove alanlarını birlikte yazdırmak.
- **Status:** Supported. Analizde `claim:player-reported-threat:region:141` var; hamlede claim yok.

## H2 — Deterministik NLU askerî raporu çıkaramıyor

- **If true, we would also see:** `analysis.claims=[]` veya claim türü politika kataloğuyla uyuşmaz.
- **Discriminating test:** Aynı cümlenin tam analysis dökümü.
- **Status:** Refuted. Claim türü tam olarak `PLAYER_REPORTED_MILITARY_THREAT`, durum `UNVERIFIED_PLAYER_REPORT`.

## H3 — Claim oturuma, hamle oluşturulduktan sonra ekleniyor

- **If true, we would also see:** Hamle kurulurken current analysis boş, son session dökümünde dolu olur.
- **Discriminating test:** Dönen follow-up nesnesindeki analysis ile response.dialogueMove'u aynı anda incelemek.
- **Status:** Refuted. Aynı follow-up nesnesinin analysis alanında claim mevcut; filtre `storyDialogueMoveRelevantClaims` içinde oluşuyor.

## H4 — Paralel worker veya LLM zenginleştirme yarışı hamleyi sonradan bozuyor

- **If true, we would also see:** Tek worker deterministik koşuda hata kaybolur veya LLM kullanılmadan hamle doğru olur.
- **Discriminating test:** Tek görev/tek worker ve `llmUsed=false` dökümü.
- **Status:** Refuted. Tek worker başarısız; kaynak deterministik ve `llmUsed=false`.

# 5) Mechanism

1. NLU, Halep'i `region:141` ile çözüp `PLAYER_REPORTED_MILITARY_THREAT` claim'i üretir.
2. Cümlede destek talebi ağır bastığı için speech act `REQUEST_ACTION`; grounded response act'i `ASSESS_ACTION_REQUEST_SCOPE` olur.
3. `storyConversationSessionAttachDecisionContracts` mevcut analysis'i doğru biçimde `storyDialogueMoveBuild` fonksiyonuna verir.
4. `STORY_DIALOGUE_MOVE_ACT_POLICIES`, `ASSESS_ACTION_REQUEST_SCOPE` için `claimTypes: []` tanımlar.
5. `storyDialogueMoveRelevantClaims` yıldız politikası bulunmadığı için mevcut turdaki claim'i siler; inherited claim de kabul etmez.
6. `claimRefs` boş kaldığından `PRESERVE_CLAIM_VERIFICATION_STATUS` gerekli noktası eklenmez.

- **Root cause:** “Geçmiş iddia taşıma” ile “mevcut turdaki iddiayı kaynak gösterme” aynı `claimTypes` filtresinde aşırı daraltılmış.
- **Detection failure:** Genel eylem yanıtının metinsel doğruluğu test edilmiş, fakat claim kaynak zinciri tam paket sonlarına kadar kapılanmamış.
- **Weakest link:** İddia çıkarımı ve hamle kaynağı birlikte gözlenmeden sorun NLU hatası gibi görünebiliyor.

# 6) Remediation Options

## Fix

- **Title:** Genel eylem kapsamı hamlesine yalnız mevcut tur claim'lerini bağlamak
- **Category:** Fix
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/StoryDialogueMove.js`, `ASSESS_ACTION_REQUEST_SCOPE` politikası
- **Recommended fix:** Politikayı `CURRENT_TURN_CLAIMS_ONLY` ve `claimTypes: ['*']` yap. Mevcut `storyDialogueMoveRelevantClaims` davranışı yıldız politikasında inherited claim eklemediği için ilişkisiz sonraki tura sızıntı oluşmaz.
- **Tradeoffs / Risks:** Aynı turda sunulan bütün claim türleri kaynak olur; bu istenen genel eylem sözleşmesidir, ancak claim çıkarım katmanının yalnız gerçek iddialar üretmesi gerekir.

## Prevention

- **Title:** Mevcut tur bağlama ve geçmiş tur taşımama sözleşmesini birlikte kapılamak
- **Category:** Prevention
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `dialogueMoveContractProbe`
- **Recommended fix:** Var olan iki assertion'ı birlikte koru: askerî eylem turu claim ve doğrulama yükümlülüğü taşımalı; ilişkisiz sosyal tur sıfır claim taşımalı.
- **Tradeoffs / Risks:** Yok; bu iki yönlü kapı aşırı bağlama regresyonunu da yakalar.

# 7) Verification Plan

- `node tools/story-test-parallel.js --task dialogueMoveContractProbe --workers 1` başarıyla bitmeli.
- Askerî hamlenin `claimRefs` listesinde Halep tehdit claim'i olmalı.
- Askerî hamlede `PRESERVE_CLAIM_VERIFICATION_STATUS` bulunmalı.
- Ardından gelen `CONTINUE_SOCIAL` hamlesinin `claimRefs` listesi boş kalmalı.
- Bütün hamlelerde `worldCommand=null` ve dünya mutasyonu yasakları korunmalı.
- Son olarak `npm test` baştan sona geçmeli.
