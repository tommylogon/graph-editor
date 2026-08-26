# Storage & Data Model

Code: `js/storage.js` (`GraphStorage`, singleton export `graphStorage`) and
`js/storage/db.js` (IndexedDB layer).

## Persistence

- IndexedDB database **`WorldGraphDB`**, object store **`saveData`**, version 1.
- Every named graph is its own record keyed by graph name; a separate
  last-active record remembers what to restore on boot (`loadLastActive`).
- `save()` is **debounced 500 ms**; each write stores format version `1.3`,
  `graphName`, `nextNodeId`, nodes array, edges array, `typeStyles`, `savedAt`.
- Legacy migration: if IndexedDB is empty, data under localStorage key
  `worldGraph` is imported once and the key removed.
- Multiple graphs: `listStoredGraphs()`, `loadSpecificGraph(name)` (also bumps
  last-active), `createNewGraph()` / graph switching live in the UI layer.

## In-memory model

```text
graphStorage.nodes : Map<id, node>
graphStorage.edges : Map<id, edge>     // note: readme says array, code uses Map
graphStorage.nextNodeId : number       // id source for new entities
```

Node shape: `{ id, type, label, position {x,y,z}, visualType, imageUrl, status,
isLocked, properties }`. Edge shape: `{ id, source, target, type, label,
description, attributes }` (attributes include `bidirectional`).

## Node types and styling

Types: `person`, `location`, `item`, `concept`, `group`, plus newer `event`,
`file`, `folder` (see `DEFAULT_SPRITE_COLORS`). Default colors per type live in
`DEFAULT_SPRITE_COLORS` and `typeStyles`; runtime edits go through
`updateTypeStyle(category, type, style)` which fires `typeStyleUpdated`.

Default sprite = generated SVG circle (512px) with type initial, stored as data URL.

## Templates

- `getPersonTemplate(label)` returns the deep character schema (basic_info,
  appearance, personality, biography, relationships, secrets, capabilities,
  kinks_and_sexuality, narrative, media). Used to seed person nodes and to
  render the tabbed properties form.
- `getEventTemplate(label)` seeds event nodes.

## Core operations

- Nodes: `createNode(type, position)`, `updateNode(id, updates)`,
  `deleteNode(id)` (removes attached edges), `getNode(id)`,
  `searchNodes(query)` (label + property match).
- Edges: `createEdge(sourceId, targetId)`, `updateEdge(edgeId, updates)`,
  `deleteEdge(edgeId)`, `swapEdgeDirection(edgeId)`,
  `ensureBidirectional(edgeId)` (adds reverse copy).
- Groups: `createGroup(memberIds, position)` (group node + membership bookkeeping),
  `setGroupCollapsed(groupId, collapsed)`, `ungroup(groupId)` (restores original
  edges). Visual proxy edges are built by the visualization layer only.
- Queries: `getNeighborSubGraph(startNodeId, hops)` powers hop-limited exports;
  `_getNodesWithinHops` in ui.js does the traversal for Markdown/Cypher exports.
- Maintenance: `mergeDuplicateNodes(labelToMerge, nodeType)` with a guided
  resolution modal in the UI (`_showMergeResolutionModal`).
- Bulk: `importJSON(data)` (replace-all, suspends history),
  `exportJSON(activeFilters)` (can respect current filters), `clear()`.

## Undo / Redo

Snapshot-based: every mutation goes through `_pushState()` which serializes the
full graph onto `undoStack` (max 50, `redoStack` cleared on new action).
`_suspendHistory` suppresses snapshots during bulk operations such as import.
Undo/redo pops snapshots and re-imports them. Because snapshots are full-graph
serializations, memory grows with graph size; keep this in mind before raising
`maxHistory`.

## Save flow gotcha

Autosave debounce means a hard crash within 500 ms of an edit can lose it; the
save indicator ("Saved ✓") appears after the debounced write completes.
