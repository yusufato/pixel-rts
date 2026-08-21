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

- [P3] ~~The live battlefield is slightly brighter than the concept capture on some terrain seeds; a future optional CRT intensity slider could tune this without reducing playability.~~ **CLOSED** `9d037ac` — scanline and vignette now scale via `--wr-crt-alpha`; slider available both in the menu settings panel and in the in-battle pause window, both writing the same preference. Defaults are byte-identical to the previous look at `alpha = 1`. See `mockup/BULGULAR.md` kusur 13.

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
---

# Story World 2D Shipping Candidate — 2026-08-21

**Decision**

- Active product renderer: 2D only.
- Shelved 3D source, dependencies, assets and 32 QA artefacts:
  `_arsiv/Story3D-shelved-2026-08-21.zip` (128 entries).
- The active tree no longer loads Three.js or a Story3D module.

**Implementation evidence**

- Canonical hex geography, 152 settlements, political ownership, physical
  road/rail/sea chains, ports, districts, facilities and land use share one
  world authority.
- City, district, port and network surfaces are persistent RAM bitmap layers;
  camera drag/zoom caused zero live city rebuilds.
- 2010–2100 selection now requires an installed visual stage. Calendar year or
  research alone cannot visually advance a city, road, rail or vehicle.
- Missing period art is counted as `PERIOD_ASSET_MISSING`; it cannot silently
  masquerade as a completed future pack.
- `DAMAGED`, `BURNING`, `BURNED` and `ABANDONED` use distinct states.
  Real Electron QA moved a placed advanced-technology facility to `BURNING`,
  resolved the real fire overlay and restored both facility and site to
  `OPERATING`.
- Character travel is drawn only when a canonical physical journey and
  TransportAgentV2 exist. No decorative passenger vehicle is invented.

**Measured acceptance**

- Real Electron p95 (far/mid/near/interaction):
  12.2 / 14.6 / 12.1 / 13.7 ms, all below 16.7 ms.
- Multi-resolution matrix: 1280×720, 1920×1080 and 2560×1440 at far/mid/near;
  all nine captures had ready atlases.
- Hover/click: 24 camera perturbations, 0 region misses, 0 hex misses and
  0 px round-trip error.
- RAM contract: network, political border and coastline layers each built once;
  district raster 8× and port raster 4×.
- Evidence directory:
  `qa-runtime/story-map-2d-final-candidate` (19 captures including nine
  resolution/LOD frames, pure-map frames, Istanbul/Rome/Adana focus, logistics
  and burning-facility states).
- Camera drag revealed incoming Dublin before pointer release, created zero new
  settlement sprites, caused zero live city rebuilds and retained `0 px`
  hit-test error.
- Infrastructure regression suite: all 19 contracts passed.
- 30-minute real Electron/GPU map soak: passed (`1,826 s`, `60` samples,
  JavaScript heap growth `10,800,000 B` followed by a stable `50.4 MB` plateau,
  Chromium working-set growth `8,908,800 B`, worst stable render p95 `12.0 ms`,
  settlement/natural-layer identity count `1`, no reported problems). Durable
  result: `qa-runtime/story-map-soak-30m-final.json`.

**Final candidate visual audit**

- The ground atlas is now actually composed into every full land hex; latitude
  and cover produce continuous green/dry regional differentiation instead of a
  flat green field.
- Mountain and forest landmarks use independent deterministic distribution,
  preventing the previous empty-forest correlation while preserving the
  canonical hex surface.
- Roads and rails use full-resolution persistent world layers; cities use a
  2x core / 8x district / 4x port hierarchy. Viewport composites remove repeated
  static tile cropping without hiding newly exposed content during drag.
- Current distant, middle, Istanbul-coast and burning-site captures were
  inspected together. Coast/settlement placement, LOD hierarchy, terrain
  differentiation, network continuity and state overlays are cohesive enough
  to present for the user's target-style decision.
- This is renderer and base visual-language completion, not a claim that every
  2010–2100 art variant has already been authored. Future selectable period
  packs extend the catalog without reopening the 2D renderer.

**Remaining human visual gate**

The engineering candidate is ready, but final 2D visual acceptance is
deliberately not self-approved. The user must inspect the same-state captures
against the supplied Civilization-style targets. If accepted, this section can
be marked `passed`; if not, the visible differences become the next bounded
2D art pass without reopening the renderer architecture.

final result: pending user visual acceptance

---

# Story World 2D — Player Acceptance Reopen, 2026-08-21

**Decision**

The previous shipping candidate is not final. User screenshots exposed visible
and interactive defects that engineering metrics did not cover. Final result
returns to `in progress`.

**Actual Electron flow exercised**

1. Entered story mode and waited for the persistent terrain/city/network layers.
2. Started campaign time with the visible pause control, observed clock advance,
   and paused again.
3. Opened Ankara's region dossier, created a one-unit physical shipment through
   the logistics form, and verified a new ShipmentV2 record.
4. Selected a free forest hex, opened a forestry survey and verified the
   persistent open land-management record.
5. Selected a coastal mixed hex and a mineral/petroleum deposit hex; verified
   cover, resource, attached city, extraction capacity and evidence boundaries.
6. Captured Istanbul coastline, logistics, forest action, deposit dossier and
   all three LODs at 720p/1080p/1440p.

**Fixed in this pass**

- Port anchors now solve against the visible raster coast rather than the water
  hex centre or a guessed inland offset.
- Modern terminal art replaces historic ship/harbour imagery.
- Mixed coast cells retain authored ground biome.
- Seasonal presentation is calendar keyed and latitude weighted; boreal city
  art is winter-only.
- Duplicate legacy road passes were removed; one canonical physical segment is
  painted once.
- Forest cells are forbidden to new road/rail routing unless a later canonical
  clearing/corridor decision changes the land state. Candidate approval and
  commissioned physical routes use the same natural-cover input.
- Road convoy, freight train and cargo ship use distinct source-art forward-axis
  calibration; reverse-route projection is required to differ by 180 degrees.
- Forest/open/deposit cells expose persistent, non-magical survey/assessment
  actions instead of text-only promises.

**Open findings**

- P1: land-management records do not yet execute institution approval,
  financing, construction and ecological/economic transformation.
- P1: the 2010–2100 building/technology art catalogue remains materially too
  small for the simulation's intended variety.
- P2: seasonal ground still needs user visual approval at north/mid/south
  latitudes through a full annual cycle.
- P2: final 60 FPS acceptance must be rerun on an idle machine. The first full
  live pass cleared all bands; a later functionally correct run began about 2×
  slower system-wide and failed only frame-time thresholds.

**Evidence**

- `qa-runtime/story-map-acceptance-land-actions/map-4-istanbul-kiyi.png`
- `qa-runtime/story-map-acceptance-land-actions/map-7-lojistik-panel.png`
- `qa-runtime/story-map-acceptance-land-actions/map-9-orman-yonetimi.png`
- `qa-runtime/story-map-acceptance-land-actions/map-9-maden-dosyasi.png`
- `qa-runtime/story-map-acceptance-forest-block/map-9-orman-yonetimi.png`

final result: in progress
