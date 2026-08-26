# WorldGraph Editor — browser-based 3D graph editor for worldbuilding

## Quick start

```powershell
.\start.bat        # py -m http.server 8000 + opens http://localhost:8000
```

No build step. No server-side code. Pure client-side ES6 modules + Three.js 0.128
(loaded from unpkg via importmap in `index.html`). Edit JS, refresh the browser.
A plain `py -m http.server` (or any static server) is required because ES module
imports do not work from `file://`.

## Architecture

- **Entrypoint**: `index.html` → importmap → four top-level modules:
  - `js/storage.js` — `GraphStorage extends EventTarget`. Data model (nodes Map,
    edges Map), person/event templates, undo/redo snapshots, IndexedDB persistence,
    import/export JSON. Singleton exported as `graphStorage`.
  - `js/visualization.js` — `GraphVisualization`. Three.js rendering, force-directed
    physics (`applyPhysics()`), groups/proxy edges, filters, search highlighting.
  - `js/ui.js` — `GraphUI`. Context menu, properties panel (tabbed for persons),
    global settings (Data / Physics / Style / AI tabs), selection, drag interaction,
    export/import modals (Markdown, SillyTavern lorebook, Cypher merge).
  - `js/main.js` — Three.js scene/camera/lights/OrbitControls, WASD+Space/X+arrows
    fly navigation, animation loop calling `vis.applyPhysics()`.
- **Wiring**: modules communicate through CustomEvents on the storage singleton:
  `nodeAdded`, `nodeUpdated`, `nodeRemoved`, `edgeAdded`, `edgeUpdated`,
  `edgeRemoved`, `graphCleared`, `typeStyleUpdated`. Visualization subscribes to
  all of them; never mutate visuals directly from UI code, go through storage.
- **Globals**: `window.__ui`, `window.__vis`, `window.__controls` are set in
  `main.js` and used for keyboard shortcuts/debugging.
- **Persistence**: IndexedDB database `WorldGraphDB`, store `saveData`, multiple
  named graphs plus a last-active pointer. Saves are debounced 500 ms
  (`storage.save()`). Old single-graph localStorage data is migrated on first load.
- **Modularized (task-013)**: the old monoliths are thin shims (`js/storage.js`,
  `js/visualization.js`, `js/ui.js` re-export their directory's `index.js`
  composer). Fragments are mixin objects assigned via `Object.assign`:
  - `js/storage/`: index (composer + persistence + importJSON), graph (CRUD/
    groups/search), templates, undo, merge, sprites, db (IndexedDB)
  - `js/visualization/`: index (composer + subscriptions + shared helpers),
    nodes, edges, physics, highlight, search
  - `js/ui/`: index (composer + constructor), events, contextMenu, panels,
    actions, settings, modals, plus pre-existing exportImport/forms/tabs/utils
  - When adding methods, put them in the matching fragment; getters must live in
    the base class (Object.assign collapses getters).

## Node types

`person`, `location`, `item`, `concept`, `group`, `event`, `file`, `folder`.
Default type colors live in `DEFAULT_SPRITE_COLORS` (storage.js) and
`typeStyles` (editable at runtime in Settings > Style).

## Em dash rule (hard)

NEVER use em dash (—) in user-facing text (docs, task files, commit messages, UI copy).
Use commas, periods, or parentheses instead. Same rule as the virtual-world repo.

## Task Tracking

Work is tracked as one `.md` per task in `docs/worldGraph/dev_tasks/`, grouped by
domain subfolder (core, ui, style, neo4j, bugs, ...) and moved between state dirs:

- `todo/` → `inprogress/` → `review/` → `done/` (`cancelled/` for dropped ideas).
- **Task/bug numbering**: `dev_Task_sequence.md` tracks the highest task and bug
  numbers and the next available one. Check it before creating a new file and bump it.
- Each task file has a `**Status**` line. Keep it truthful and dated. Update the file
  as you work, not after. Move to `review/` when implemented, to `done/` when verified.
- Backlog + thinking notes: `dev_tasks/developer ideas.md`.
- Legacy backlog: root `todo.md` (frozen snapshot from before the kanban existed;
  its open items were migrated into individual task files).

Keep wiki docs in sync when code changes: `docs/worldGraph/Core/`,
`Rendering/`, `UI/`, `Integrations/`.

## Known Gotchas

- **Undo history is snapshot-based** (`_pushState` serializes nodes+edges before each
  mutation, max 50 entries). Large graphs make undo expensive; `_suspendHistory`
  guards bulk operations like import.
- **Search has two modes**: typing highlights matches; pressing Enter creates a NEW
  node named after the query (legacy behavior). Escape must restore prior filter state
  (currently buggy, see bug-004).
- **Hidden nodes**: filters hide by type or inactive status, but click-selection of
  hidden items was not fully gated (see bug-002, regression_test.md edge cases).
- **Group proxy edges** are visualization-only dashed lines; collapsed group members
  stay in storage. Group creation is currently broken (bug-001).
- **Neo4j integration is NOT implemented yet.** `neo4j_schema.md` is the design
  baseline; tasks 008-010 track the work. Only a Cypher MERGE text export exists
  (`ui.js _generateCypherMerge`).
- **Three.js version is pinned** to 0.128.0 in the importmap; newer versions changed
  sprite/line APIs used here.
