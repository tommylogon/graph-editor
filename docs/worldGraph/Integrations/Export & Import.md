# Export & Import

Code: mostly `ui.js` (export/import modals and generators) with file plumbing in
`ui/exportImport.js` (`saveFile(content, defaultName, extension)` triggers a
browser download). Storage-side: `exportJSON(activeFilters)` / `importJSON(data)`.

## Graph-level export

| Format | Entry point | Notes |
|--------|-------------|-------|
| JSON (full graph) | Settings > Data > Export JSON | `graphStorage.exportJSON()`, optionally respects active type filters |
| Markdown world doc | Export Doc (.md) | `exportMarkdown()` → `_generateMarkdownContent(activeFilters)`; per-node sections from `_generateMDForNode(nodeId)` with hop-limited context via `_getNodesWithinHops` |
| SillyTavern lorebook | Data tab | `_generateSillyTavernLorebook(activeFilters, startNodeId, hops)`, reuses the markdown generator because its output is LLM-friendly |
| Cypher MERGE script | Data tab | `_generateCypherMerge(activeFilters, startNodeId, hops)` emits `MERGE` statements matching the planned Neo4j schema (see [[Integrations/Neo4j]]) |

## Node-level (character) export

The properties panel of a node offers Export JSON which downloads just that node
(within an optional hop radius for connected context).

## Import paths

1. **Full replace**: Settings > Import JSON replaces the whole graph
   (`importJSON` with history suspended).
2. **Additive import** (`_showAdditiveImportModal(data)`): merge an exported file
   into the current graph, remapping id collisions.
3. **Selective / comparison import for a single node**
   (`_showImportModal(nodeId)` → `_showImportComparisonModal(nodeId, incoming)`
   → `_applySelectiveImport(nodeId, updates)`): pick per-section what to accept
   when importing character JSON into an existing person, used together with the
   selective character export.
4. **Merge duplicates**: `showMergeDuplicatesModal()` finds same-label same-type
   nodes, then `_showMergeResolutionModal(nodes, type, label)` +
   `_mergeNodesWithCustomProperties(primaryId, otherIds, mergedProperties)`
   resolve conflicting fields interactively.

## Helper utilities

- `_flattenObject(obj, prefix)`, `_getValueByPath`, `_setValueByPath`: dot-path
  access used by the comparison/merge UIs.
- `_allEqual(arr)`: detects whether a field differs across merged candidates.

## Open work

- JSON export still stores physics-recalculated coordinates; either strip coords
  or load with physics suspended (task-012).
- Markdown export templates could gain more variants (developer ideas backlog).
