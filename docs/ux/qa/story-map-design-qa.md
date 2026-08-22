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

## V2 canonical coastline pass — 2026-08-16

- Current renderer: `story-map-v2-flat-world-3`.
- Runtime evidence: `qa-runtime/story-map-v2-coast-pass-17/`.
- First normalized source/current comparison: `qa-runtime/story-map-v2-coast-pass-15-comparison.png`; pass 17 is the visually corrected contour result.

**Fixed in this pass**

- [FIXED] Coastline is no longer an incidental edge between separately drawn terrain and politics. A single cached contour is derived from `StoryMapRaster.landMask`, so terrain, ownership, hit-test and coast all share the same canonical geometry.
- [FIXED] Raster boundary edges are joined into closed island-safe contours. Diagonally touching land cells take a deterministic right-turn continuation and remain independent contours rather than becoming a figure-eight.
- [FIXED] One-cell raster stair steps are suppressed by a bounded two-pass contour filter. The filter stays within roughly one source cell; tiny islands bypass smoothing to preserve their silhouette.
- [FIXED] Coast presentation is screen-space and zoom-aware: navy separation shadow, warm shoreline edge and dashed pale water-side foam remain bounded instead of inflating with world zoom.
- [FIXED] Runtime stayed clean at all three map-test zooms: renderer `story-map-v2-flat-world-3`, `MAPTEST_PROBLEMS []`, hit-test average/max `0 / 0 px`.
- [FIXED] Automated coverage now includes coastline normals, closed contours, tiny-island preservation, diagonal-island separation and bounded monotonic stroke width.

**Still blocking full source fidelity**

- [P1] The target's coast is backed by continuous authored beaches, cliffs and coastal vegetation. The new contour fixes geometric/readability failure, but terrain pixels immediately inland/outboard still inherit the lower-detail overview raster.
- [P1] The inhabited fabric gap remains: target cities have connected districts, hedgerows and secondary landmarks; current minor nodes still alternate between atlas cities and strategic marks.
- [P2] Mountains now occupy the correct ranges but individual atlas footprints remain distinguishable in long chains.
- [P2] Roads remain graph curves and can cut across visual relief even though their endpoints and hit-test are correct.

**Next implementation order**

1. Add chain-aware mountain overlap/orientation from range tangents while retaining existing mountain art and traversal data.
2. Split minor nodes into `urban landmark` and `strategic marker` LOD; remove bars as a substitute for settlement art.
3. Add terrain-following visual trunk corridors and sparse rivers without altering the simulation graph.
4. Build authored coast-biome strips only after the contour contract stays stable; do not reintroduce a second land raster.

final result: blocked — canonical coast geometry is now stable and readable; inhabited density, mountain-chain composition and terrain-following infrastructure remain below the reference.

## V2 mountain-chain composition pass — 2026-08-16

- Runtime evidence: `qa-runtime/story-map-v2-mountain-pass-19/` (pass 19 is the final size/density correction after pass 18 exposed oversized desert chains).

**Fixed in this pass**

- [FIXED] One atlas stamp per raw range segment was replaced by deterministic distance-based placements. Long range segments now receive overlapping footprints; short segments still receive at least one.
- [FIXED] Placements follow the range tangent with bounded perpendicular variation, size variation, mirroring and a maximum `0.18 rad` rotation. Peaks remain upright while chains stop reading as evenly spaced identical stickers. Final footprints are reduced to `0.76×` of the former raster-scaled base and spaced at `0.58×` footprint width so continuity does not become a wall of mountains.
- [FIXED] All range placements are depth-sorted by map Y before compositing, so neighboring chains overlap consistently rather than according to source-array order.
- [FIXED] Placement density, rotation and size bounds are covered by the V2 renderer test. Runtime remained `MAPTEST_PROBLEMS []` with `0 / 0 px` hit-test error.

**Remaining visual debt**

- [P1] Urban fabric is now the largest visible difference from the target: capitals are authored landmarks, but minor cities and their surroundings do not yet form connected inhabited districts.
- [P2] Mountain chains are continuous, but some very long desert ranges still expose the atlas's shared base silhouette. A future asset-variant pass can address that without reverting placement geometry.
- [P2] Strategic connection lines remain too prominent at regional/local zoom and compete with terrain.

**Next implementation order**

1. Split minor settlements into `urban landmark` and `strategic marker` LOD, using real settlement atlas art before bars/triangles.
2. Fade/cull non-actionable strategic links at local zoom while preserving selection and command routes.
3. Add terrain-following visual trunk corridors and sparse rivers without changing the simulation graph.

final result: blocked — coast and mountain-chain geometry now hold; settlement fabric and overlay hierarchy remain the dominant fidelity gap.

## V2 user three-scale correction pass — 2026-08-16

- Visual input: the user's close, regional and continental Pixel RTS captures compared directly with `mockup/story-map-visual-target-v1.png`.
- Final runtime evidence for this pass: `qa-runtime/story-map-v2-labels-pass-26/`.
- Renderer contract: `story-map-v2-flat-world-4`.

**Observed from the user's captures**

- [P1] City sprites scaled from `34 px` to `98–108 px` and became larger than their geographic context. Commander triangles, `CMD`, `SELECT`, owner bars and labels then occupied the same footprint.
- [P1] Regional rural marks were `92–109 px`, larger than many settlements, so separate round farm/forest atlas stamps became readable as repeated assets.
- [P1] The old baked sea-detail foam and pale shallow-water mix created a broad grey cloud around the coast, competing with the new canonical contour.
- [P2] Graph roads retained nearly constant opacity while zooming in, making the local view read as a node graph rather than terrain.
- [P2] City labels were materially smaller and flatter than the reference hierarchy.

**Fixed in this pass**

- [FIXED] Settlement scale is now bounded at tier 1 `10 → 16 → 19 px`, tier 2 `23 → 37 → 43 px`, and tier 3 `32 → 51 → 58 px` at far/mid/near. Growth remains monotonic without sixfold capital inflation.
- [FIXED] The selected commander city shows its real city name; the centered `CMD` plate and `SELECT` text were removed. The selection rectangle is lifted around the authored sprite rather than leaving a large empty box below it.
- [FIXED] Far-map commander triangles are suppressed. Regional/local tokens are limited to three and only appear in the active tactical neighborhood; the current commander city does not duplicate its selection state with triangles.
- [FIXED] Rural marks now remain `74–84 px`, use lower alpha and a denser but less repetitive grid. Cities remain visually dominant.
- [FIXED] V2 disables the legacy baked foam-fragment pass. The shallow shelf remains blue and the canonical coastline is the only bright shore treatment.
- [FIXED] Primary/secondary roads fade and narrow toward local zoom. Five-point bounded routes replace ruler-straight or single-bend graph edges.
- [FIXED] City labels use a stronger tier hierarchy and a two-pixel owner-color key without restoring heavy political tint.
- [FIXED] Runtime remained clean: `MAPTEST_PROBLEMS []`, hit-test average/max `0 / 0 px`; map renderer unit tests cover settlement/rural monotonicity and road endpoint/curvature bounds.

**Still blocking target fidelity**

- [P1] The reference's inhabited fabric is authored as connected forests, hedgerows, villages and roads. Current coverage is still a composition of reusable atlases over a broad base texture; reducing repetition does not create the missing continuous fabric.
- [P1] Source geography is more articulated around the Aegean, Adriatic and small islands. The canonical 820 px mask preserves consistency but cannot invent islands absent or sub-pixel in the source geometry.
- [P2] Long mountain chains are improved but retain recognizable shared atlas bases, especially in North Africa and the Levant.
- [P2] Roads are visually curved but do not yet solve elevation-aware routing or river-crossing placement.

**Next implementation order**

1. Build a higher-resolution canonical raster/mipmap contract and measure whether small-island/coast articulation improves without terrain/politics drift.
2. Add connected hedgerow/forest corridor placement using existing authored atlases; do not increase isolated stamp size.
3. Add elevation/coast-aware road control-point validation and sparse river crossings.
4. Revisit mountain atlas variation only after geographic and inhabited-network density are stable.

final result: blocked — the three zoom levels now preserve hierarchy and remove the worst overlay collisions; continuous inhabited fabric and fine coastline topology remain visibly below the target.

## V2 canonical detail + organic LOD pass — 2026-08-16

- Visual input: the user's close, regional and continental game captures compared with `mockup/story-map-visual-target-v1.png`.
- Renderer contract: `story-map-v2-flat-world-5`.
- Runtime evidence: `qa-runtime/story-map-v2-final-pass-33/`.

**Fixed in this pass**

- [FIXED] The shared canonical land/region raster increased from `820×645` to `1640×1290` (`canonical-map-raster-2`). Terrain ownership, political overlay, coastline extraction and hit-test still consume one raster; no second coastline source was introduced.
- [FIXED] Raster diagnostics no longer allocate a multi-million-number temporary `Array.from(...)`; region counting streams the typed array into a small `Set`.
- [FIXED] The build-time raster asset was regenerated deterministically: `2,115,600` raw cells, `21,660` RLE runs, `86,640` payload bytes.
- [FIXED] Regional rural LOD now keeps a near-constant screen rhythm. Broad overview habitats are replaced by smaller overlapping terrain/forest fragments rather than isolated circular stamps.
- [FIXED] Local LOD no longer switches to round rural-island art. It continues with authored terrain/forest cells at lower alpha and a denser screen-space rhythm.
- [FIXED] Ground-detail tiles gain a restrained source-over under-pass so authored hedgerows and field lines survive close zoom; soft-light and political tint still reconcile the palette.
- [FIXED] Mountain chains use smaller, denser overlapping fragments so a single atlas base is less dominant.
- [FIXED] Tier-2/3 cities reveal deterministic satellite districts at regional/local zoom. Districts are canonical-land checked, stay subordinate to the main city sprite and do not change hit-test geometry.

**Measured acceptance**

- Real Electron `--maptest`: far/mid/near captured; `MAPTEST_PROBLEMS []`.
- Hit-test round trip: 16 visible nodes, mean error `0 px`, max error `0 px`.
- Canonical raster probe: validation true, 152 regions, grid mismatch 0, terrain/coast difference ratio `0.00207627`, terrain+overlay wall time `559.901 ms`.
- Prebuilt raster probe: asset load `64.6 ms`, runtime fallback hashes equal, payload `86,640` bytes.
- Political overlay probe: validation true, first build `148.662 ms`, 0 `fillRect`, 1 `putImageData`, 0 sea-alpha leaks, 0 missing-land alpha.
- Isolated `mapRasterProbe`, `prebuiltRasterProbe` and `politicalOverlayProbe` completed successfully.
- The monolithic serial story suite did not finish inside the 15-minute command ceiling and emitted no partial assertion output. Its surviving test child was stopped explicitly. This is recorded as an infrastructure-duration limit, not reported as a pass.

**Still blocking target fidelity**

- [P1] The target has purpose-built continuous forest belts and city silhouettes. Current atlas blending is materially closer but cannot fully erase repetition from 4×4 source cells.
- [P1] Road curves are deterministic and less graph-like, but still do not route around elevation/shore obstacles.
- [P2] Local terrain detail is sharper, yet even the real V2 `2400 px` baked terrain remains visible under the live detail layer at maximum zoom. The headless rollback probe intentionally reports its legacy `1350 px` fallback.
- [P2] The target uses denser authored coastal settlement scenes; current satellite districts arrange existing real city assets and are not unique metropolis art.

**Next implementation order**

1. Add elevation/coast-aware road control-point validation and sparse river crossings.
2. Replace the remaining repeated forest/mountain silhouettes with chain/corridor-specific authored fragments.
3. Add a local terrain mip level so maximum zoom no longer depends on the 1350 px overview cache.
4. Re-run a full reference/current comparison after the road and local-mip passes.

final result: blocked — raster fidelity, three-scale hierarchy and local inhabited detail improved measurably; authored continuous forests, terrain-aware roads and high-zoom terrain mip fidelity remain below the target.

## HXD-6 city scale + interaction performance correction — 2026-08-17

- Visual input: the user's Ankara/İstanbul/İzmir, eastern Mediterranean, Rome, central Europe and mountain-range close captures.
- Runtime evidence: `qa-runtime/city-lod-perf-final-2/` (statik gemi hücreleri kaldırılmış son doğrulama), `qa-runtime/city-lod-perf-final/` (en ağır uzlaşma koşusu) ve `qa-runtime/city-lod-perf-fix-3/` (daha sakin karşı-koşu).

**Observed from the user's captures**

- [P0] The old square-root substitute was not actually world-legible: a capital grew only `32 → 58 px` while its containing hex grew more than twelvefold. Close zoom therefore made the city smaller relative to the map.
- [P0] Stable-camera profiling hid the interaction failure. Exact camera coordinates were part of three expensive screen-layer keys, rebuilding roads/ports, cities/labels and commanders on every pointer event.
- [P1] Open-water ships and port traffic were decorative atlas stamps. They visually asserted trade that had no shipment, vehicle, cargo or route record.
- [P1] Core-city variety remains limited by the current 4×4 settlement atlas. HXD-6 district kinds now choose different rows, but this does not yet equal unique technology-, building- and population-shaped city silhouettes.

**Fixed in this pass**

- [FIXED] City scale is monotonic and materially grows toward local LOD: tier 1 `10 / 25 / 36 px`, tier 2 `23 / 57 / 82 px`, tier 3 `32 / 80 / 114 px` at far/mid/near.
- [FIXED] The visible city tier uses live HXD-6 population and physical district count; legacy `node.level` is only a rollback fallback.
- [FIXED] District art grows with local LOD but stays smaller than the core. Industrial/civic/defense/logistics districts keep distinct atlas rows and canonical hex centers.
- [FIXED] Drag and wheel rendering is frame-coalesced. Coast, network, settlement and commander screen layers are transformed from their build camera during interaction instead of being rebuilt for every event.
- [FIXED] Canonical coastline is now screen-cached. Stable p95 fell from the first-run `33.7 / 38.4 / 26.5 ms` to `4.5–10.8 / 6.0–14.6 / 5.3–10.8 ms`; camera interaction p95 is `4.5–12.2 ms`, with all 36 samples reusing all three expensive layers in every run.
- [FIXED] Static open-water ships and synthetic port traffic were removed. A vehicle may return only through HXD-9/HXD-12 as a real transport agent.
- [FIXED] Hit-test remained exact: mean/max `0 / 0 px`; `MAPTEST_PROBLEMS []`.

**Open debt**

- [P1] Gesture-end exact reconciliation is still a visible one-frame hitch: `163.2–369.3 ms` depending on concurrent CPU load. The final run was led by network rebuild `230.0 ms`, then settlement `93.4 ms` and commander `30.6 ms`. HXD-7 must move the network to segment/tile-aware world caches or overscanned camera tiles rather than hiding this number.
- [P1] Trains, trucks, ships, aircraft and travelling characters do not exist visually yet because the physical segment/route/agent contracts are HXD-7–HXD-14 work. Adding decorative motion before those records exist is explicitly forbidden.
- [P1] City silhouettes still share a small atlas. The next HXD-6 slice must compose core art from district mix, installed buildings, technology era and population band without adding a second city truth.

final result: partially accepted — city scale direction and continuous camera performance are corrected and measured; exact post-gesture reconciliation, physical vehicles and city-art diversity remain explicit P1 work.

## HXD-6 modern visual cleanup — 2026-08-17

- Runtime evidence: `qa-runtime/map-visual-cleanup-final/`.
- [FIXED] The medieval settlement sheet was retained as rollback data and replaced in the live renderer by `settlements-atlas-modern-v3.png`: residential blocks, civic/commercial campuses, transit, industry/logistics and metropolitan cores.
- [FIXED] Static terrain stamps now require shoreline clearance proportional to their actual sprite size. Live rural stamps sample centre, cardinal and diagonal footprint points; forest/field art no longer passes because only its centre is on land.
- [FIXED] Mountain placements reserve a city-scale exclusion radius around HXD settlement anchors. Cities and mountain sprites no longer compete for the same visual footprint.
- [FIXED] Coastal HXD city cores choose the safest non-logistics district anchor for presentation; satellite districts are omitted unless their full sampled footprint remains on land. Simulation coordinates and hit-test remain canonical.
- [FIXED] V2 no longer renders mountain ranges twice. The baked terrain keeps restrained colour variation while mountain height/silhouette is owned by the mountain atlas.
- [FIXED] Legacy baked river valleys and zoom-scaled double strokes are disabled in V2. Rivers are land-clipped and drawn live with bounded screen-space width.
- [FIXED] National borders are no longer baked into the political raster. The old 1.35-source-pixel stroke became a dark wall at local zoom; the live border now has a bounded `1.45–2.8 px` screen-space outline.

**Measured acceptance**

- Real Electron far/mid/near p95: `14.8 / 16.4 / 13.8 ms`; interaction p95 `13.9 ms`; `MAPTEST_PROBLEMS []`.
- Hit-test mean/max error: `0 / 0 px`.
- New settlement atlas: `1254×1254`, transparent corner alpha `0`.
- `story-map-renderer-v2` and `story-hex-world` regression tests pass. The combined multi-suite invocation exceeded its 120-second command ceiling; individual scoped tests are the claimed evidence.

**Open visual debt**

- [P1] Roads still ignore elevation and shoreline when choosing intermediate control points.
- [P1] Modern city silhouettes are now era-correct, but building mix and technology do not yet compose unique skylines; HXD-6 remains the owner of this variation.
- [P1] The terrain base still depends on a single overview raster at maximum zoom; local mip/tiles remain necessary for target-grade ground fidelity.
- [FIXED] The real Electron map harness now captures permanent İstanbul coast, Rome coast/mountain and Adana coast/border fixtures in addition to the Ankara-centred three zoom levels.

final result: accepted for the reported overflow/legacy-relief defects — no visible sea spill remained in the current three-scale capture and performance stayed inside budget; road routing, unique dynamic skylines and local terrain mip fidelity remain explicit follow-up work.

## HXD-6 Civilization-style hex ownership pass — 2026-08-17

- Runtime evidence: `qa-runtime/civ-hex-final/`.
- [FIXED] V2 no longer scatters forest, mountain, field and rural silhouettes in free world coordinates. Every natural/economic sprite is deterministically assigned to one canonical HXD cell.
- [FIXED] Urban footprint cells are reserved before natural placement; a forest, mountain, farm or resource can no longer occupy the same cell as a city/district.
- [FIXED] Only cells with at least `94%` canonical land coverage receive land content. Every square atlas cell is additionally hard-clipped to its pointy hex, preventing neighbour and sea leakage.
- [FIXED] Oil and mine records are mapped to canonical cells. The former free-floating coloured debug squares are disabled in V2.
- [FIXED] Legacy free-floating terrain-detail, forest and mountain passes are disabled in V2; continuous ground and sea texture remain base material rather than gameplay silhouettes.
- [FIXED] Settlement art has one fixed world-space size per physical tier (`12 / 19 / 27` world units). There is no independent zoom/LOD resize curve: screen size is now exactly `worldSize × cameraZoom`.
- [FIXED] Natural/economic cell contents are composed once into a world-space canvas and reused by camera blits instead of re-running thousands of placements per frame.

**Measured acceptance**

- Real Electron far/mid/near p95: `13.7 / 17.9 / 14.3 ms`; interaction p95 `14.7 ms`; `MAPTEST_PROBLEMS []`.
- Hex-content layer p95: `1.8–2.0 ms`.
- Settlement sizes at far/mid/near for tier 3: `9.58 / 59.4 / 121.5 px`, exactly following camera zoom.
- Hit-test mean/max error: `0 / 0 px`.
- `story-map-renderer-v2` and `story-hex-world` regression tests pass.

**Open visual debt**

- [P1] The source atlases are still only 4×4, so wide views expose repeated forest/mountain/farm motifs. Hex ownership is correct; asset variety is not yet target-grade.
- [P1] City art now obeys world scale, but unique building/technology/population composition remains HXD-6 debt.
- [P1] Exact post-gesture reconciliation remains `410.3 ms` in this CPU-loaded run; network and settlement screen-layer architecture still needs world/tile caches.

final result: accepted for this requested slice — silhouettes and resources now belong to canonical hexes and city art no longer self-resizes by LOD; art diversity and post-gesture rebuild remain explicit next work.

## Legacy river removal — 2026-08-17

- Runtime evidence: `qa-runtime/rivers-removed-final/`.
- [FIXED] The V2 live river renderer and its cached `GEO.rivers` conversion were removed.
- [FIXED] Legacy terrain-raster river strokes and river-valley carving were removed; changing renderer mode can no longer restore the old lines.
- [FIXED] River renderer exports and obsolete regression assertions were deleted.
- Real Electron far/mid/near p95: `13.6 / 18.6 / 14.1 ms`; interaction p95 `15.1 ms`; `MAPTEST_PROBLEMS []`.
- Source scan finds no `GEO.rivers`, `rivers0`, `storyMapV2DrawRivers` or `storyMapV2BuildRiverLines` reference under live `js/` and `tests/`.

final result: accepted — the inherited river system is absent from both current and rollback rendering paths.

## HXD-6 hex surface + zoom cache correction — 2026-08-17

- Runtime evidence: `qa-runtime/hex-surface-cache-final/`.
- [FIXED] Ports now own a fixed world footprint (`8 / 10` world units for tier 2/3). Their size is exactly `worldSize × cameraZoom`; the former far/near size switch and perspective multiplier were removed.
- [FIXED] The screen-space ground-detail pass, which cleared and repainted a viewport canvas on every render, was deleted.
- [FIXED] The canonical hex surface is rendered once at `2×` world resolution (`6000×4720`) and reused by source-window blits. Zoom does not rebuild geography.
- [FIXED] Land texture now fills the canonical hex rather than appearing as a small floating badge. Forest, mountain, farm and terrain art use the same cell clip and fill the cell footprint.
- [FIXED] Coast cells are composed first and then clipped once by the canonical land raster. Water retains a continuous base texture; the rejected first pass's bright repeated sea-tile mosaic and empty coastal hex belt were removed.
- [FIXED] Network, settlement, commander and coastline caches no longer use exact camera `x/y/zoom` values. They use four semantic zoom bands plus a coarse world bucket; movement inside a band transforms the existing cache.

**Measured acceptance**

- Before this correction: far/mid/near `13.6 / 18.6 / 14.1 ms p95`, interaction `15.1 ms p95`, exact gesture-end reconciliation `349.4 ms`.
- Final: far/mid/near `8.1 / 13.7 / 10.6 ms p95`, interaction `11.2 ms p95`, gesture-end reconciliation `5.9 ms`.
- Repeated interaction reused network/settlement/commander caches in all `36/36` samples.
- Hit-test mean/max error remained `0 / 0 px`; `MAPTEST_PROBLEMS []`.
- Port fixed-world-size, city fixed-world-size, zoom-band, renderer and hex-world regression tests pass.

**Open visual debt**

- [P1] Four source variants per biome still repeat across large land areas; the 2× surface fixes sampling resolution, not authored variety.
- [P1] Hard biome transitions need neighbour-aware edge blending/autotiles. Current half-opacity surface reduces seams but does not provide six-direction transition art.
- [P2] A semantic zoom-band or 360-world-unit bucket crossing may rebuild one presentation cache once. Continuous wheel steps inside the same band no longer do so.

final result: accepted for the four requested defects — fixed-size ports, non-rebuilding geography, higher-resolution sampling and cell-filling geography are live and measured.

## City-first startup + 60 FPS render gate — 2026-08-17

- Runtime evidence: `qa-runtime/map-60fps-city-first-v2/`.
- [FIXED] Story rendering was still throttled to 50 ms (20 FPS); the live target is now 16.67 ms (60 FPS).
- [FIXED] The 10,584-cell, 6000×4720 natural surface no longer blocks the first city frame. It is built in <=4 ms animation-frame slices and swapped atomically when complete.
- [FIXED] City art is preloaded with high priority and decoded asynchronously during menu/character setup.
- [FIXED] Individual atlas load events no longer discard the completed hex surface or repeatedly regenerate the procedural terrain base under V2.
- [FIXED] Political borders and the visible hex grid now use semantic camera caches instead of rebuilding screen geometry every full render.
- First 16.7 ms gate attempt correctly failed at far/mid/near `21.4 / 23.2 / 20.1 ms p95`.
- Final far/mid/near: `12.2 / 11.6 / 12.0 ms p95`; interaction: `12.5 ms p95`; settle: `6.7 ms`.
- Hit-test mean/max error: `0 / 0`; `MAPTEST_PROBLEMS []`; `MAPTEST_OK`.

final result: accepted — cities are no longer held behind full-world composition and all measured camera/render paths pass the 60 FPS frame budget.

## LLM memory isolation + true first-city-frame gate — 2026-08-17

- Runtime evidence: `qa-runtime/map-fast-start-memory-gate-final/`.
- Diagnosis under the user's live workload: eight battle-AI Node workers occupied about `3.3 GB`; only `4.87–5.85 GiB` of `15.71 GiB` physical RAM remained. The existing 8B host had previously measured about `4.9 GB` before renderer/canvas allocations. The RTX 4060 had `7956 MiB` VRAM free, so the immediate failure mode was system-RAM pressure/paging, not lack of GPU capacity.
- [FIXED] The saved “LLM enabled” preference no longer loads the model in the menu or while entering the world.
- [FIXED] The ten-second character-action tick no longer silently warms the 5 GB LLM. It uses the live arbiter only if a real player conversation has already loaded it; otherwise the deterministic selector remains authoritative.
- [FIXED] Model startup now requires `6.25 GiB` free physical RAM. It selects `8192` context with at least `8 GiB` free and a `4096` context under the full-context threshold; insufficient memory produces an explicit recoverable fallback instead of paging the game.
- [FIXED] Disabling the setting unloads the host; five idle minutes also release model/context memory. Stale host exit events cannot clear a newly started replacement.
- [FIXED] V2 first-frame terrain now uses a compact canonical raster base. The detailed 6000×4720 surface remains incremental above it, so the city frame is no longer blocked by a second multi-million-pixel procedural terrain build.
- [FIXED] Incremental hex composition has both a 4 ms time target and a hard 24-cell ceiling. Under Canvas command buffering this reduced the observed first slice from `133.1 ms` to `0.5 ms`.
- Story-entry click under the same memory pressure: `4788 ms → 966 ms`; settlement atlas ready on the first frame: `true`; settlement layer ready on the first frame: `true`.
- Final far/mid/near p95: `3.9 / 4.6 / 3.8 ms`; interaction p95: `5.8 ms`; hit-test mean/max: `0 / 0`; `MAPTEST_OK`.

final result: accepted — system-RAM contention is isolated from map startup, the LLM cannot silently page the game, and cities are present on the first rendered world frame.
