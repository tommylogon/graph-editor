# Architecture

WorldGraph is a single-page, server-less browser app. All state lives in the
browser (IndexedDB), all rendering is local Three.js. The only network dependency
is the Three.js CDN import.

## Boot sequence

1. `index.html` declares an **importmap** pinning `three` and `three/addons/` to
   `https://unpkg.com/three@0.128.0`.
2. Four ES modules load: `js/storage.js`, `js/visualization.js`, `js/ui.js`,
   `js/main.js` (in that order).
3. `main.js` builds the Three.js scaffolding up front:
   - `Scene` with background `0x111122`
   - `PerspectiveCamera(75)` at `(10, 5, 10)`
   - `WebGLRenderer` with PCFSoft shadows
   - `OrbitControls`: LEFT disabled (left mouse is selection/drag), MIDDLE dolly,
     RIGHT rotate, damping on, max polar angle PI/2
   - ambient light `0x404060` + directional light with a 1024px shadow map
4. On window `load`: `Raycaster` (Line threshold 0.05) → `GraphVisualization(scene)`
   → `GraphUI(camera, scene, raycaster, domElement)` → `graphStorage.init()` →
   `graphStorage.load()`. Instances are exposed as `window.__vis`, `window.__ui`,
   `window.__controls`.
5. `animate()` loop: keyboard fly movement, `controls.update()`,
   `vis.applyPhysics()`, render. Resize handler updates camera aspect and
   LineMaterial resolutions for all edges.

## Module layout

The former monoliths are thin compatibility shims; implementation lives in
module directories composed onto class prototypes via `Object.assign` mixins
(task-013).

| Entry shim | Composer | Fragments |
|------------|----------|-----------|
| `js/storage.js` | `storage/index.js` (class + persistence + importJSON) | `graph.js` (CRUD/groups/search/clear), `templates.js`, `undo.js`, `merge.js`, `sprites.js`, `db.js` (IndexedDB) |
| `js/visualization.js` | `visualization/index.js` (class + storage subscriptions + shared helpers, `activeFilters` getter) | `nodes.js` (meshes/sprites/labels/groups/proxy edges), `edges.js` (Line2 curves/arrows/pair index), `physics.js` (`applyPhysics`), `highlight.js`, `search.js` (filters/search) |
| `js/ui.js` | `ui/index.js` (class + constructor + `setupMenu` + `FIELD_OPTIONS` static) | `events.js` (pointer/drag/context routing/keys), `contextMenu.js`, `panels.js` (properties panel/forms/extract popups), `actions.js` (operations/selection/delegates), `settings.js` (settings tabs/save/load modals), `modals.js` (import/merge modals), plus pre-existing `exportImport.js` (generators), `forms.js`, `tabs.js`, `utils.js` |

Composition rules:

- Fragment = plain object of methods; assigned with
  `Object.assign(Class.prototype, ...fragments)` inside each index.js.
- **Getters must stay in the base class** (`activeFilters`): Object.assign reads
  getters as values.
- Statics stay on the class (`GraphUI.FIELD_OPTIONS`, read by forms.js via
  `window.__ui.constructor.FIELD_OPTIONS`).
- The entry shims keep `main.js` / `index.html` untouched.

## Event-driven wiring

Storage is the single source of truth. It broadcasts CustomEvents and both other
layers react:

| Event | Fired by | Consumed by |
|-------|----------|-------------|
| `nodeAdded` / `nodeUpdated` / `nodeRemoved` | storage CRUD methods | visualization (create/update/remove meshes) |
| `edgeAdded` / `edgeUpdated` / `edgeRemoved` | storage CRUD methods | visualization |
| `graphCleared` | `clear()` | visualization (dispose everything) |
| `typeStyleUpdated` | `updateTypeStyle()` | visualization (recolor) |

Rule: never mutate Three.js objects directly from UI code. UI calls storage
methods; events drive the visuals. Event payloads ride in `e.detail`
(for example `e.detail.node`).

## Input model summary

- Left click: select (Shift+click multi-select), drag moves node
- Right click: context menu; right-drag orbits camera
- Middle drag: dolly; wheel: zoom
- WASD: fly pan, Space/X: up/down (X disabled in 2D mode), arrows: rotate view
- `C`: chain-connect selected nodes, `Esc`: cancel edge creation / close panels
- Ctrl+Z / Ctrl+Y: undo / redo (guarded against typing inside inputs via
  `isInputActive()`)

See [[UI/UI & Interaction]] for details.
