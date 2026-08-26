# Visualization & Physics

Code: `js/visualization.js` (`GraphVisualization`, ~1470 lines). Subscribes to
storage events in its constructor and owns every Three.js object.

## Scene objects

### Nodes

- Spheres, color-coded by type (`getNodeColor(type, id)` checks per-item override
  first, then `typeStyles`).
- **Size scales with degree** (`getNodeRadius(entry)`, recomputed by
  `updateNodeScales()` with debouncing).
- If a node has an `imageUrl` (upload as data URL or remote URL), it renders as a
  circular sprite via `_createCircularSpriteMap(imageUrl, callback)` instead of a
  solid sphere.
- Floating text labels: canvas textures from `_createLabelTexture(text, color,
  isEdge)`, size follows `physicsConfig.labelSizeMultiplier`.
- Hover state via `setHoverNode(id)` (emissive tint + tooltip hook used by UI).

### Edges

- Lines with arrowheads for directed edges; multiple edges between the same pair
  curve apart (quadratic offset, handled around `updateEdgePair(idA, idB)`).
- LineMaterial resolution must be updated on window resize (done in main.js).
- Labels float near the midpoint.
- Group collapse visuals: `_collapseGroup(groupId)` hides members,
  `_createProxyEdge(proxyId, sourceGroupId, targetExtId, count)` draws dashed
  aggregation lines with count labels; `_expandGroup` / `_removeProxyEdge` reverse it.

## Physics (`applyPhysics()`)

Configuration lives on `vis.physicsConfig` (bound to Settings > Physics sliders):

```js
{
  enabled: true,
  is2D: false,          // constrain nodes to y=0 plane
  repulsion: 10.0,      // inverse-square base magnitude
  attraction: 0.015,    // edge spring constant
  damping: 0.85,        // velocity damping per step
  minDist: 8.0,         // spring rest distance floor
  maxDist: 100.0,
  alpha: 1.0,           // cooling factor
  alphaTarget: 0.01,
  alphaDecay: 0.02,
  collisionRadiusPadding: 2,
  labelSizeMultiplier: 1.0,
  speed: 1.0,           // simulation speed multiplier slider
  edgeThickness: 1.0
}
```

Force passes each frame:

1. **Pairwise repulsion**: inverse-square, scaled by node radii `(rA + rB)`,
   capped at 5.0 magnitude, modulated by a same-type factor so type clusters form.
2. **Edge attraction**: spring force proportional to `(dist - restDist) * attraction`.
3. **Cluster attraction**: gentle pull of nodes toward their type centroid
   (centroid itself drifts, nodes follow).
4. Velocity integration multiplied by `speed`, damped by `damping`; `is2D` zeroes
   y position/velocity.

Locked nodes (`isLocked`) are excluded from movement. `heat(strength)` re-energizes
the simulation (bumps alpha) after structural changes or user drags.

## Highlight system

`highlightSettings = { depth: 1, dimming: 0.35, direction: 'both' }`

- `highlightNode(id)` / `highlightMultipleNodes(ids)` collect the active set via
  `_getNeighbors(nodeId)` up to `depth` hops; depth 5+ effectively selects whole
  chains/clusters.
- `_applyHighlightVisuals(activeNodes, activeEdges, primaryNodeId)` brightens the
  active set and dims everything else to `dimming` opacity.
- `direction` filters neighbor traversal: `'both' | 'outgoing' | 'incoming'`.

## Filters & search

- `filters = { hiddenTypes: Set, showInactive: bool }`;
  `setFilter(type, visible)` and `setShowInactive(bool)` then `applyFilters()`
  toggles mesh visibility (hidden nodes also hide attached edges and are meant to
  be unselectable, see bug-002).
- `applySearch(query, shouldHide)`: typing highlights matches (label or property
  content); with hide-mode enabled non-matching elements are hidden instead of
  dimmed. Search state interacts with filter persistence (bug-004).

## Known issues tracked in dev_tasks

- Line positions desync from nodes over time until clicked (bug-003)
- Group creation produces nothing (bug-001)
- Shift-click highlighting includes unrelated items and omits connected edges
  (bug-005)
