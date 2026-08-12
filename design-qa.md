# War Room Design QA

**Comparison Target**

- Source visual truth: `Oyun tasarımı planı/design_handoff_war_room/Pixel RTS - Komuta Terminali.dc.html` and `Oyun tasarımı planı/design_handoff_war_room/shots/02-kurulum.png` through `07-komutan-perk.png`.
- Source caveat: `shots/01-ana-menu.png` is byte-identical to `shots/04-deploy.png`; the menu state rendered from the `.dc.html` prototype is the menu authority.
- Implementation target: `http://127.0.0.1:8765/`.
- Implementation evidence: `qa-screenshots/01-menu.png` through `qa-screenshots/07-commander.png`.
- Viewport/state: 916×572 desktop captures for all seven matching states; additional resilience checks at 760×700 and 1280×800.

**Comparison Evidence**

- Full-view: every source and implementation pair was opened together at native resolution in one comparison input. The terminal frame, hierarchy, two-column setup, map/briefing split, deploy sidebar, battle telemetry, reward draft, and commander grid preserve the source composition.
- Focused regions: the native 916×572 comparisons kept setup controls, battle target telemetry, result cards, and commander perks readable without rescaling, so separate crops were not needed. These dense regions were checked for wrapping, alignment, token color, borders, and state styling.
- Responsive evidence: `qa-screenshots/responsive-760x700.png` and `qa-screenshots/wide-map-1280x800.png`; both had zero horizontal page/stage overflow.

**Findings**

- No actionable P0/P1/P2 findings remain.
- Fonts and typography: Share Tech Mono and Press Start 2P loaded successfully; condensed labels, pixel display headings, weights, letter spacing, and hierarchy match the terminal direction. Long Turkish labels wrap without clipping.
- Spacing and layout: the bezel, setup split, right-side briefing/deploy panels, battle overlays, result grid, and commander grid retain the source rhythm at the target viewport. The 760×700 and 1280×800 checks produced no horizontal overflow.
- Colors and tokens: amber command chrome, green friendly/confirmation states, red hostile states, dark CRT surfaces, border opacity, and scanline treatment are consistent with the source.
- Image quality and assets: the implementation uses the game's real terrain canvases and existing unit sprite sheet. The living 82-city terrain is intentionally more legible than the static concept image; this preserves the current campaign rather than replacing it with the concept's smaller node set.
- Copy and content: all seven states use coherent Turkish operational copy and live campaign/battle data. Setup, commander, rewards, resources, force estimates, and target telemetry are not placeholders.
- Interaction/accessibility: menu → setup → campaign and map → commander → map were exercised through real clicks. Start disabled/enabled state, visible focus treatment, semantic buttons, reduced-motion handling, and save-aware continuation are present.

**Patches Made Since Previous QA Pass**

- Prevented the setup screen from collapsing to one column solely because of short desktop height; it now matches the source's side-by-side setup at 916×572.
- Removed the duplicate `game-over-title` DOM id that caused the result screen to update the AI-training heading instead of the campaign result heading.
- Rebuilt the campaign result layout as an explicit grid, eliminating score/reward overlap and keeping the return action full-width.
- Recaptured the battle HUD with a selected tank and live opposing formations to verify target telemetry and command overlays.

**Follow-up Polish**

- [P3] The live battlefield is slightly brighter than the concept capture on some terrain seeds; a future optional CRT intensity slider could tune this without reducing playability.

**Implementation Checklist**

- [x] Seven desktop states captured and compared against source visuals.
- [x] Dense UI regions checked at native resolution.
- [x] P0/P1/P2 issues fixed and recaptured.
- [x] 760×700 and 1280×800 overflow checks passed.
- [x] Fonts loaded and duplicate DOM ids eliminated.

War Room result: passed
→ **Kısmen geri çekildi.** İki maddesi 2026-08-12 ölçümüyle yanlışlandı; aşağıdaki
"Üçüncü QA turu" bölümüne bakın.

---

# Üçüncü QA turu — 2026-08-12 (düzeltme kaydı)

Bu bölüm yukarıdaki War Room turunun **iki iddiasını geri çeker**. Geçmiş bölüm
silinmedi; hangi ölçütün neyi kaçırdığı görünsün diye yerinde bırakıldı.

**Geri çekilen 1 — "916×572'de kaynak düzenini koruyor" (satır 29).**
O viewport'ta `#btn-story-start`in alt kenarı **632 px**, görünür alan **572 px**:
kampanyayı başlatan buton ekranın 60 px altındaydı ve o ekranda kaydırma yoktu
(`.app-screen` `overflow:hidden`). Yani **916×572'de kampanya hiç başlatılamıyordu** —
ve bu, turun kendi taban viewport'u. 1024×640'ta yalnız 7 px payla kurtuluyordu.
Kurtarıcı kural `style.css`'te vardı ama `@media (max-width:900px)` altında; arıza
genişlikten değil **yükseklikten** doğduğu için 916 px'te devreye girmiyordu.
Düzeltildi: commit `67a403c`. 916×572'de buton alt kenarı 632 → **488**.

**Geri çekilen 2 — "760×700 ve 1280×800 taşma kontrolleri geçti" (satır 15, 21, 43).**
Kontrol gerçekten geçti, ama **yanlış şeyi ölçüyordu**: yalnız *sayfa* yatay taşmasına
bakıyordu (`documentElement.scrollWidth > clientWidth`). Hikaye komuta çubuğundaki
9 kaynak çipi 1070 px istiyor, kutu 1280×800'de 701 px; fazlalık sayfayı taşırmıyor,
**kutunun dışına, başlığın üstüne** akıyor. Sayfa ölçütü buna kördü.
Düzeltildi: commit `ee81aaa`. 1280 px'te içerik 1070 → **633**, örtüşme yok.

**Ölçüt güncellendi.** Bundan sonra taşma kabulü iki kademelidir:

1. *sayfa* taşması: `documentElement.scrollWidth <= clientWidth` (eski ölçüt, korunur)
2. *kutu içi* taşma: her yerleşim kabında son çocuğun sağ kenarı kabın sağ kenarını,
   ilk çocuğun sol kenarı kabın sol kenarını aşmamalı; ayrıca komşu kutuyla
   (ör. `.story-command-title`) çakışma sıfır olmalı

**Ölçüm aleti uyarısı.** Kırpmayı `element.scrollWidth > clientWidth` ile aramayın:
`.detail-hover::after` gibi mutlak konumlu sözde-öge tooltip'leri `scrollWidth`'e
karışıp **her varyantta** yalancı alarm üretiyor. Metin kırpması `Range` ile
yalnız değer ve etiket düğümü üzerinden ölçülmeli.

**Bu turda kapsanan viewport'lar:** 980 · 1000 · 1100 · 1259 · 1261 · 1280 · 1366 ·
1440 · 1600 · 1660 · 1920 (kusur 24) ve 916×572 · 1280×800 (kusur 25). Hepsi temiz.
`electron . --uitest` altı adımda `OK`, `UITEST_PROBLEMS []`, konsol hatası yok.

Kanıt: `qa-runtime/mockup-baseline/kusur-24-komuta-cubugu-{ONCE,SONRA}-1280.png`,
`kusur-25-baslat-butonu-916x572.png`, `kusur-25-DUZELTILDI-{916x572,1280x800}.png`.
Tam defter: `mockup/BULGULAR.md`.

Üçüncü tur sonucu: iki P0 kapatıldı; kalan 23 madde `mockup/BULGULAR.md`'de `AÇIK`.

---

# Character Conversation Workspace Design QA

**Comparison Target**

- Source visual truth: user-provided Pixel RTS character-conversation screenshots, including the latest 1480×970 state.
- Intended state: the selected character's dedicated conversation window open above the existing story map and chat drawer.
- Implementation target: local Electron application in this repository.
- Implementation screenshots: `qa-runtime/conversation-ui-final/09-karakter-gorusmesi-compositor.png` and the long-session/multi-participant acceptance capture `qa-runtime/conversation-ui-scroll-final/10-karakter-gorusmesi-kaydirma-coklu-profil.png`.
- Viewport: 1903×974 compositor capture (desktop scale); measured center-column width 875 px.

**Evidence Available**

- Source and implementation screenshots were visually inspected for palette, typography, panel density, borders, hierarchy, and conversation focus.
- DOM interaction probe passed opening the separate modal, rendering a public profile, listing two saved sessions, resuming the older session, showing a PlayerKnowledge-filtered action record, submitting a new WASD-containing sentence, and preserving two sessions through save/load.
- The real Electron path completed menu → setup → character creation → story map → populated character conversation with no UI-test problem or error-level console report.
- Runtime geometry confirmed the shell remained inside the viewport, the fixed composer remained inside the main column, and the main column retained 875 px width while the transcript was scrollable.
- The real renderer then produced 12 follow-ups and three explicit participants. The transcript reached `scrollMax=2367`; wheel-up and wheel-down over the fixed composer both moved the transcript, and the participant rail independently overflowed.
- JavaScript syntax checks, the focused conversation regression, and `git diff --check` passed.

**Findings**

- No actionable P0/P1/P2 visual finding remains in the captured desktop state.
- Fonts and typography: Share Tech Mono renders consistently with the command-terminal hierarchy; primary speech remains clearly dominant over metadata.
- Spacing and layout rhythm: the center column is now dominant, the new-conversation action is compact, and transcript scrolling is separated from the always-reachable follow-up composer.
- Colors and visual tokens: amber/green/dark terminal tokens are consistent; the follow-up editor was changed from a large white slab to the dark terminal surface after the first compositor review.
- Image quality and asset fidelity: the new window introduces no new image assets or placeholder imagery and leaves the existing terrain/sprites untouched.
- Copy and content: DOM evidence confirms profile, active conversation, previous conversations, agreements/records, safety state, and resume labels are present.
- Multi-participant disclosure: known participants receive separate public-profile cards; an unresolved participant is shown as `Bilinmeyen katılımcı / KİMLİK DOĞRULANMADI` without invented country, role, or relationship data.

**Implementation Checklist**

- [x] Dedicated modal and close/backdrop/Escape behavior implemented.
- [x] Public profile and directional relationship view implemented.
- [x] Previous sessions and resume behavior implemented.
- [x] PlayerKnowledge-filtered agreements/records implemented.
- [x] WASD input isolation implemented and probed.
- [x] Real Electron compositor capture produced and inspected.
- [x] Full modal composition compared against the supplied conversation screenshot.
- [x] Transcript/composer containment and center-column width measured in the real renderer.
- [x] Long transcript wheel scrolling verified in both directions over transcript and composer regions.
- [x] Multi-participant profile rail and unknown-participant information boundary captured and inspected.

**Patches Made Since Previous QA Pass**

- The first long-session probe exposed `overflow-y: scroll` with `scrollMax=0`: the active composer wrapper had no constrained grid height, so the transcript expanded below the clipped shell. The wrapper now owns a `minmax(0, 1fr)` transcript row and a fixed composer row.
- Wheel events over the fixed composer are routed to the transcript unless the textarea itself has scroll range. Render refreshes preserve the prior offset; new/resumed messages intentionally move to the end.
- The single-profile renderer was replaced by an explicit participant list that can display several known or unknown actors without treating unrelated crisis actors as conversation participants.

final result: passed
