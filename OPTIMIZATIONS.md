# Optimization Audit

## 1) Optimization Summary
The game’s rendering and simulation engines currently manage CPU load quite well thanks to recent time-slicing and V2 map caching techniques. However, the background systems responsible for checking state invalidations (`storyWorldVisualStateKey`) and drawing transport agents (`storyDrawTransportAgents`) are generating excessive garbage collection (GC) overhead. At 60 FPS, these string joining and object-allocation operations within inner loops cause micro-stutters over time as the garbage collector scrambles to clean up thousands of short-lived objects. By transitioning from string-based hashes to simple integer revision counters, and by utilizing object pooling for particle/agent rendering, the game can achieve a completely smooth, stutter-free 60 FPS experience with virtually zero memory bloat.

The cost of changing nothing is that players will continue to experience intermittent UI hiccups and battery drain, particularly in late-game scenarios where hundreds of transport agents and 80+ cities are active simultaneously.

## 2) Findings (Prioritized)

### World Visual State Key Hashing (Excessive GC)
- **Category**: Memory
- **Severity**: High
- **Confidence**: Confirmed
- **Location**: `StoryRender.js` (function `storyWorldVisualStateKey`)
- **Evidence**: `const nodes = (STORY.nodes || []).map(node => ...).join(':') ... .join(',')`
- **Why it matters**: This function executes every 500ms, mapping over all nodes and commanders, and joining large arrays of strings into a massive composite string just to determine if the map needs a redraw. This constant string allocation forces the Garbage Collector to work overtime.
- **Recommended fix**: Remove string serialization. Instead, add a `STORY._worldRevision` integer. Whenever a city changes level, ownership, or constructs a building, increment `STORY._worldRevision`. Then `storyWorldVisualStateKey` simply returns `STORY._worldRevision`.
- **Tradeoffs / Risks**: Requires identifying every state mutation that should trigger a redraw and explicitly incrementing the revision. Overlooking a mutation could lead to the map failing to update visually.
- **Expected impact**: Complete elimination of map-check GC pauses (approx. 50-80% reduction in periodic memory spikes).
- **Effort**: M

### Transport Agent Frame Allocations
- **Category**: Memory
- **Severity**: Medium
- **Confidence**: Confirmed
- **Location**: `StoryRender.js` (function `storyDrawTransportAgents`)
- **Evidence**: `presentationSamples.push({ id: trackId, x: ..., y: ..., targetX: ..., targetY: ..., active: ... });` and `const trackId = String(...) + ':' + String(...)`
- **Why it matters**: This function runs every single frame (60 times a second). For every single transport agent (which can be hundreds), it concatenates strings for IDs and allocates new objects via `push()`. This leads to thousands of short-lived objects being generated per second.
- **Recommended fix**: Use a pre-allocated object pool for `presentationSamples` or structure of arrays (SOA) instead of pushing new objects. Cache `presentationTrackId` directly on the agent when it's spawned so the ID string doesn't need to be dynamically concatenated every frame.
- **Tradeoffs / Risks**: Very safe, but slightly more verbose code for managing object pools.
- **Expected impact**: Smoother rendering at 60fps with no micro-stutters from GC during heavy logistics rendering.
- **Effort**: S

### Regional Economy Object Churn
- **Category**: Memory
- **Severity**: Low
- **Confidence**: Confirmed
- **Location**: `StoryRegionalEconomy.js` (function `storyRegionalEconomyTick`)
- **Evidence**: `const producedByResource = storyRegionalResourceMap(0);`
- **Why it matters**: During the sliced economy tick, multiple resource map objects are initialized per region. While sliced processing mitigates CPU blocking, it still generates short-lived map objects for every region on every slice.
- **Recommended fix**: Pre-allocate a single global temporary `Float64Array` or reusable map structure for tracking these totals during the tick loop instead of creating new objects per iteration.
- **Tradeoffs / Risks**: Shared state arrays must be carefully zeroed out before each use to prevent data bleed between regions.
- **Expected impact**: Minor reduction in background memory churn.
- **Effort**: S

## 3) Quick Wins
1. **Cache `presentationTrackId` on transport agents**: Prevents string concatenation inside the rendering loop.
2. **Convert `storyWorldVisualStateKey` to an integer revision**: Increment `STORY.worldRevision` during city/commander updates instead of joining strings.

## 4) Deeper Optimizations
- **Data-Oriented Design for Vehicles**: If the transport agent count exceeds 1,000, converting the vehicle list from an Array of Objects to Typed Arrays (Float32Array for X/Y positions) will eliminate object iteration overhead and significantly improve CPU cache locality during render steps.

## 5) Validation Plan
- **Benchmarks**: Monitor memory heap snapshots in Chrome DevTools before and after the fixes. 
- **Profiling strategy**: Record a 10-second performance trace during late-game play (Story mode, >60 days in, fast forward speed) and inspect the Garbage Collection (Minor GC) events.
- **Metrics**: The volume of memory allocated and collected per second should drop by at least 60%. GC pause times should remain under 2ms.
- **Correctness**: The map must still instantly reflect color changes when a territory is conquered, and vehicles must continue animating smoothly.

## 6) Proposed Patches

### Patch 1: Integer-based Map Revision
Change in `Story.js` (or wherever properties change):
```javascript
// Whenever node owner or level changes
node.owner = newOwner;
STORY._mapRevision = (STORY._mapRevision || 0) + 1;
```

Change in `StoryRender.js` (`storyWorldVisualStateKey`):
```javascript
function storyWorldVisualStateKey() {
    return [
        'world-visual-state-3', 
        STORY._mapRevision || 0,
        STORY.selectedNodeId,
        STORY.hexConstruction && STORY.hexConstruction.version || 0,
        // ... (keep non-expensive integer checks)
    ].join('|');
}
```

### Patch 2: Cache Track ID on Transport Agents
Change where agents are spawned (e.g. `StoryTrade.js`):
```javascript
agent.presentationTrackId = String(agent.authorityType || 'TRANSPORT') + ':' + String(agent.authorityId || agent.agentId);
```
Change in `storyDrawTransportAgents`:
```javascript
const trackId = agent.presentationTrackId; // Pre-calculated, no string concatenation!
```
