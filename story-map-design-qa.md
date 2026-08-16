# Story Map Visual Design QA

- Source visual truth: `mockup/story-map-visual-target-v1.png`
- Implementation screenshot: `qa-runtime/story-map-atlas-v18/map-saf.png`
- Combined comparison evidence: `qa-runtime/story-map-design-comparison-v6.png`
- Focused coast/terrain evidence: `qa-runtime/story-map-design-focused-coast-v3.png`
- State: story mode, far zoom, flat strategic view, dynamic political ownership active
- Runtime viewport: Electron map-test canvas 1065 × 711 px; visible map crop 1065 × 615 px
- Source pixels: 1619 × 969 px
- Comparison normalization: both views center-fit to 1065 × 638 px at density 1
- Runtime verification: `MAPTEST_PROBLEMS []`; 17 map hit-tests, average/max error 0 px. Isolated political-overlay contract passed with 0 invalid land alpha and 0 sea leaks; full `story-world` suite exceeded the 180 s local timeout.

## V2 projection and scale rebuild — 2026-08-16

- New implementation: `js/StoryMapRendererV2.js` (`story-map-v2-flat-world-1`).
- Current three-scale evidence: `qa-runtime/story-map-v2-density-v1/`.
- Reference/far/mid/near comparison: `qa-runtime/story-map-v2-scale-comparison-v1.png` (the comparison was captured immediately before the final minor-settlement density pass; projection and local scale are identical).
- Automated contract: `tests/story-map-renderer-v2.test.js` / `npm run story:map-v2-test`.
- Runtime contract: V2 is the default. The old strip-warp remains recoverable with local storage key `story.map.renderer=legacy-warp`; no generated atlas or terrain asset was deleted.

**V2 fixed findings**

- [FIXED] The hybrid coordinate system was removed. Terrain, political overlay, roads, ports and settlements now share a flat top-down world transform; labels remain a separate screen-space UI layer.
- [FIXED] Mid/near Mode-7 strip warp was removed from the default renderer. `storyPP()` remains `0` at far, mid and near zoom.
- [FIXED] Settlement size no longer reverses or stays visually constant while geography changes scale. Measured tier 1 sizes are `5 → 19 → 30 px`, tier 2 sizes `10 → 37 → 62 px`, and tier 3 sizes `16 → 60 → 100 px` at far/mid/near.
- [FIXED] Small towns remain as 5 px overview landmarks without labels or owner bars; they do not inflate to fill the far map.
- [FIXED] Roads and settlement marks are no longer baked into the physical terrain raster in V2. Primary roads are now a world-aligned vector layer with bounded screen widths; regional roads retain their own LOD.
- [FIXED] Flat world-to-screen-to-world hit testing remains exact: visible-node average/max error `0 / 0 px`; `MAPTEST_PROBLEMS []`.
- [FIXED] Physical terrain cache width increased from 1350 to 2400 px in V2, and a canonical-land-masked local detail layer reuses the existing ground atlas without deleting or replacing prior art.

**V2 remaining findings**

- [P1] The target still contains materially more above-ground detail at every scale: hedgerows, forests, rural clusters, coast articulation and medium landmarks. The projection is now correct, but the content density gap remains visible in `story-map-v2-scale-comparison-v1.png`.
- [P1] Maximum zoom still softens the physical base because the overview raster is being magnified. The local ground layer reduces emptiness but does not yet equal a real tiled/mipmapped terrain pyramid.
- [P2] Strategic commander connection lines dominate the local view. They are gameplay overlays rather than geography and need their own local-zoom opacity/density policy.
- [P2] City labels and selection/CMD markers remain War Room UI rather than source-faithful map typography.

**Findings**

- [P1] Terrain density still does not fully reach the target
  Location: entire land surface, especially northern/central Europe and North Africa.
  Evidence: V18 adds a new edge-to-edge 4×4 biome ground-texture atlas, composites it through the canonical land/height mask and blends it without visible cell seams. Field scars and ground variation are now continuous, but the focused comparison still shows denser tree lines and inhabited micro-landmarks in the source.
  Impact: the implementation reads as textured terrain rather than flat color; the remaining gap is above-ground vegetation/landmark continuity.
  Fix: keep the new seamless base and add region-scale hedgerow/tree-line corridors rather than increasing isolated forest sprites again.

- [P2] Coast and sea treatment is improved but not yet equally rich
  Location: Atlantic, Mediterranean, Black Sea and all coastlines.
  Evidence: V14 adds coast-distance-driven foam fragments and extra ship activity only around tier-3 or high-industry coastal cities. The source still has more continuous articulated shore foam and denser harbor micro-detail.
  Impact: water now carries scale, trade and coastal activity information; the remaining drift is fine shoreline continuity.
  Fix: tune foam atlas orientation from local coast tangent rather than random rotation, then validate island/coastal silhouettes at focused zoom.

- [P2] Settlement hierarchy is coherent; major-city density still differs from the source
  Location: city layer.
  Evidence: V12 enlarges only tier-3 capitals and industrial tier-2 cities, and positions labels from the rendered sprite footprint. Capitals now dominate correctly; the source still distributes medium landmark settlements more continuously.
  Impact: political/economic centers are readable, but some regions jump from a large capital directly to tiny settlements.
  Fix: add a restrained tier-2 landmark variant only where city data marks industrial or coastal importance; do not enlarge all towns.

- [P2] Political tint still dominates physical geography
  Location: state interiors and borders.
  Evidence: V14 reduces canonical interior alpha from 0.20 to 0.12 and border alpha from 0.90 to 0.80, with the fallback path aligned. Terrain now reads first in western Europe and North Africa; strong faction blocks are still conspicuous across Turkey/Caucasus and eastern Europe.
  Impact: the world feels more physical than V12, but some regions still read as colored territories before inhabited terrain.
  Fix: preserve current ownership readability and defer any further reduction until a dedicated political-lens toggle exists.

- [P2] Road and river networks remain sparse at far zoom
  Location: land connections and river corridors.
  Evidence: V14 derives non-strategic, land-validated nearest-neighbor roads inside each region and exposes them only beyond 1.45× minimum zoom. This improves regional views without falsely adding strategic graph edges; the reference still carries more far-map road/river texture.
  Impact: closer geography now explains city placement, while the far map remains less infrastructurally dense than the reference.
  Fix: keep regional roads LOD-gated; add only a very small set of high-importance trunk routes to far zoom after visual testing.

- [P2] Label typography is readable but not yet source-faithful
  Location: strategic city labels.
  Evidence: the implementation uses very small monospace terminal labels; the source uses larger outlined map labels with stronger visual rank by city tier.
  Impact: labels are functional but reinforce the HUD/debug look.
  Fix: keep Turkish uppercase content but add tier-based sizes, stronger outline/backplate contrast and less aggressive far-map density.

**Required fidelity surfaces**

- Fonts/typography: functional, P2 drift remains in map-label style and hierarchy.
- Spacing/layout rhythm: map crop and continental composition are sound; settlement density is inconsistent by region.
- Colors/tokens: sea/land palette is directionally correct; political tint remains too dominant.
- Image quality/assets: mountain, settlement, terrain-detail, maritime and sea atlases are crisp and correctly transparent; fine-grain coverage remains insufficient.
- Copy/content: real Turkish city names are retained; no generated image text is used in the runtime.

**Comparison history**

1. V3: square city markers, dense labels, flat political tint and warp scanline seams. Fixes: runtime settlement atlas, importance-filtered labels, lower owner tint, far-view single-blit path.
2. V5: first atlas integration; mountain ranges visible and hit-test remained exact. Fixes: GEO-range mountain placement, larger city hierarchy, minor-city suppression.
3. V6: no console errors, 0 px hit-test error, cleaner far view. Remaining P1/P2 findings are listed above and visible in `qa-runtime/story-map-design-comparison-v1.png`.
4. V7–V8: field/scrub and sea-detail atlases added; obvious circular repetition reduced through rotation, mirroring, overlap and lower alpha.
5. V9–V11: coastal ports and water-validated curved maritime links added; all minor cities moved from debug dots to settlement LOD sprites; canonical roads changed to deterministic curves. Evidence: `qa-runtime/story-map-design-comparison-v2.png`.
6. V12: second fine-grain biome atlas pass added; capitals and industrial tier-2 cities strengthened; label placement now follows actual settlement footprint. Runtime stayed clean and hit-test remained exact. Evidence: `qa-runtime/story-map-design-comparison-v3.png`.
7. V13–V14: regional biome density weighting, coast-distance foam, capacity-driven port traffic and land-validated regional roads added. Canonical political interior/border alpha reduced and its adapter/test contract versioned. Runtime stayed clean, hit-test remained exact and the isolated overlay contract passed. Evidence: `qa-runtime/story-map-design-comparison-v4.png`.
8. V15–V16: forest LOD density, scale and opacity increased; canonical road casing/centerline contrast strengthened. Full and focused comparisons confirm better local activity without atlas-grid repetition, while continuous ground texture remains the blocking P1. Evidence: `qa-runtime/story-map-design-comparison-v5.png` and `qa-runtime/story-map-design-focused-coast-v2.png`.
9. V17–V18: a project-bound continuous biome atlas was generated and integrated through a real land/height mask; blend strength increased after the first conservative pass. No coast spill, mountain overwrite or tile-grid seams were visible at far/mid zoom. Evidence: `qa-runtime/story-map-design-comparison-v6.png` and `qa-runtime/story-map-design-focused-coast-v3.png`.

**Implementation checklist**

1. Add region-scale hedgerow/tree-line corridors over the seamless biome base.
2. Align coast foam to local shoreline tangent and run focused coast QA.
3. Add restrained tier-2 landmark variants for industrial/coastal centers.
4. Test a minimal far-zoom trunk-road subset without adding strategic edges.
5. Add a future physical/political lens contract before reducing ownership tint again.

**Follow-up polish**

- Add culture/era variants only after the base terrain density passes.
- Add seasonal palettes through the existing terrain cache invalidation contract.

final result: blocked

## V2 inhabited-world and terrain-scale pass — 2026-08-16

- Current renderer: `story-map-v2-flat-world-2`.
- Current runtime evidence: `qa-runtime/story-map-v2-reference-pass-14/`.
- Current normalized reference comparison: `qa-runtime/story-map-v2-reference-pass-14-comparison.png`.
- New authored asset: `assets/maps/rural-environment-atlas-v1.png` (4×4, genuine alpha; existing assets retained).

**Fixed in this pass**

- [FIXED] Both CRT scanline layers no longer stack over the story map. The story screen keeps only a restrained vignette.
- [FIXED] Political interior/border alpha was reduced again so relief reads before ownership color.
- [FIXED] The V2 renderer no longer draws the old procedural triangle trees/mountains or terminal grid over atlas art.
- [FIXED] Rural/ground details now use a deterministic, viewport-bounded world layer with canonical land-mask checks, coast rejection, strategic-city clearance, biome weighting and explicit overview/regional/local LOD.
- [FIXED] Rural assets are clipped to the projected world rectangle; they cannot spill into the black outside-map margin.
- [FIXED] The mountain atlas used the legacy hard-coded `.9` coordinate multiplier while V2 terrain was generated at `1.6`. Mountain positions and size now use the actual terrain raster scale `f`; Alps, Pyrenees, Carpathians, Balkans, Caucasus and Atlas chains align with the physical terrain again.
- [FIXED] Local zoom uses the continuous ground atlas at stronger soft-light contrast, retaining terrain color without square source-over tile seams.
- [FIXED] Settlement scale remains monotonic and now exposes urban hierarchy earlier: tier 1 `10 → 29 → 30 px`, tier 2 `24 → 69 → 70 px`, tier 3 `34 → 98 → 108 px` at far/mid/near.
- [FIXED] Secondary roads are geography links rather than same-owner links; they survive border changes and receive a restrained far-zoom presentation.
- [FIXED] Map-test full-window screenshots now wait two compositor frames after each canvas render. Full-page and raw-canvas evidence no longer disagree because of a stale Electron frame.
- [FIXED] Runtime contract remains clean: `MAPTEST_PROBLEMS []`, visible-node hit-test average/max `0 / 0 px`, and all three zooms report `pp=0`.

**Still blocking full source fidelity**

- [P1] The reference still has a denser continuous city/forest/hedgerow fabric. The game now has correct terrain belts and urban sprites, but minor settlements still read more like strategic marks than inhabited districts at continental scale.
- [P1] Coastlines are geometrically correct but more block-stepped and less continuously highlighted than the source; the next pass needs a canonical-raster coastline stroke/foam field rather than more isolated sprites.
- [P2] Primary and secondary roads now form a geographic network, but their paths remain graph curves. The source has terrain-following local roads and river corridors.
- [P2] Mountain chains are now correctly located and materially stronger, but repeated atlas silhouettes remain visible in long dry-region chains and need chain-aware overlap/variant staggering.

**Next implementation order**

1. Build a canonical coastline contour layer with zoom-aware stroke/foam and island-safe masking.
2. Add chain-aware mountain overlap and orientation using range tangents, without changing physical elevation or traversal.
3. Split minor settlements into `urban landmark` and `strategic marker` LOD so bars never substitute for a city sprite.
4. Add terrain-following trunk road corridors and a sparse river layer; keep simulation graph and visual geography separate.

final result: blocked — projection, scale and relief are now sound; coastline continuity and inhabited-network density remain visibly below the source.
