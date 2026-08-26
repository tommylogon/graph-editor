# task-013: Modularize monoliths (storage.js, visualization.js, ui.js)

**Status**: In Review, implemented 2026-08-26. Verified via node --check on all
28 js files plus browser boot and functional smoke tests (zero console errors).
Pending: manual pass through the full regression_test.md checklist.

## Goal

Break up the three monoliths using the virtual-world discipline ("move, don't
copy", thin delegation behind the old public symbols). Old entry points
(`js/storage.js`, `js/visualization.js`, `js/ui.js`) stay import-compatible;
internals moved into module directories composed onto class prototypes.

## Result

| Before | After |
|--------|-------|
| storage.js 738 ln | 4-line shim; `storage/` = index (composer+persistence), graph CRUD, templates, undo, merge, sprites, db |
| visualization.js 1474 ln | 4-line shim; `visualization/` = index (composer+events+helpers), nodes, edges, physics, highlight, search |
| ui.js 3795 ln | 4-line shim; `ui/` = index (composer+constructor), events, contextMenu, panels, actions, settings, modals + pre-existing exportImport/forms/tabs/utils |

Mechanism: fragments exported as plain method objects, `Object.assign`ed onto
the prototypes in each index.js. The `activeFilters` getter stays in the base
class (Object.assign would collapse getters to values).

Also removed ~800 lines of dead duplicated generators from ui.js
(`_generateMarkdownContent`, `_generateMDForNode`, `_generateSillyTavernLorebook`,
`_generateCypherMerge`, `_getNodesWithinHops`, `_generateMDStringForNode`);
the live copies live in `ui/exportImport.js`. Duplicate `saveGraph`/`loadGraph`
class methods collapsed to the modal versions that already won at runtime.
Stale placeholder stubs (`ui/core.js`, `visualization/core.js`) deleted.

## Verification

- [x] `node --check` passes on every file under js/
- [x] Boot via static server: all four entry shims load, both composers run,
      IndexedDB opens, default graph restores, zero console errors/warnings
- [x] Method presence audit: 42 GraphUI + 26 GraphVisualization methods across
      all fragments
- [x] Behavioral test through the event pipeline: create person/location
      (sprite generation, template schema), create/update edge (pair indexing,
      label texture), filters + search, merge no-op, undo/redo round trip
- [x] Real DOM flow: right-click context menu (node + empty-space variants),
      Add Item creates node and opens the universal editor panel
- [ ] Full manual regression_test.md pass (open)

## Notes

- Done yolo style per user: single big extraction pass, verification at the end,
  not after every move.
- Follow-up candidates: panels.js (966) / modals.js (809) still exceed a
  virtual-world-style 600-line rule if we ever want to adopt it here.
