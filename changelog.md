# 🌐 World Graph Editor – Changelog

## Recently Completed

### Modularization (2026-08-26, task-013)
- **Monoliths eliminated**: `storage.js` (738 ln), `visualization.js` (1474 ln)
  and `ui.js` (3795 ln) are now 4-line compatibility shims. Implementation lives
  in `js/storage/`, `js/visualization/`, `js/ui/` module directories composed
  onto class prototypes via mixins.
- storage: index (persistence/composer), graph CRUD, templates, undo, merge,
  sprites
- visualization: index (events/helpers), nodes, edges, physics, highlight, search
- ui: index (constructor), events, contextMenu, panels, actions, settings,
  modals (+ existing exportImport/forms/tabs/utils)
- Removed ~800 lines of dead duplicated export generators from ui.js (live
  copies already in `ui/exportImport.js`); collapsed duplicate
  `saveGraph`/`loadGraph` definitions to the modal versions that already won.
- Verified: node --check on all files, browser boot with zero console errors,
  create/connect/filter/search/undo/redo and context-menu flows exercised.

### Core Graph Management
- Create nodes (person, location, item, concept)
- Delete nodes
- Edit node properties (label, description, custom fields for persons)
- Create edges (directed)
- Delete edges
- Edit edge properties (label, description)
- Flip edge direction
- Make edge bidirectional (add reverse edge)
- Select single node/edge
- Multi‑select with Shift+click
- Deselect by clicking empty canvas
- Context menu on nodes/edges/empty area
- Keyboard shortcuts: `C` to chain‑connect selected nodes
- Escape key cancels edge creation / closes panels

### Visualization
- 3D spheres for nodes (colour‑coded by type)
- Sprite nodes with circular images (upload/URL)
- Node labels (always face camera)
- Edge lines with arrowheads
- Curved edges for multiple connections
- Node size scales with degree (number of connections)
- Physics simulation (repulsion, attraction, damping)
- 2D mode toggle (nodes constrained to y=0)
- Physics sliders (repulsion, attraction, min distance)
- Filter nodes by type (person, location, etc.)
- Show/hide inactive nodes
- Search highlights matching nodes/properties

### UI / Interaction
- Properties panel (right side)
- Context menu (right‑click)
- Selection badge (shows count when multiple selected)
- Edge creation hint (“Click another node…”)
- Auto‑save indicator
- Collapsible settings panel (bottom left)
- Top search bar
- Hover highlight on nodes
- Keyboard shortcuts: WASD (pan), Space/X (up/down), arrow keys (rotate)
- OrbitControls with right‑click drag
- Prevent selection of hidden nodes

### Data Persistence
- Auto‑save to localStorage after every change
- Manual Save / Load buttons
- Export full graph as JSON
- Import graph from JSON
- Export selected node(s) as JSON (character export)
- Selective import for person nodes (merge sections)
- Export world as Markdown document (formatted profiles)

### Advanced Features
- **Undo / Redo** (Ctrl+Z / Ctrl+Y) with snapshot‑based history
- **Extract to node** (create new node from text field, optionally connect)
- **Image handling**: Upload images (converted to data URL), Image preview in properties, Image prompt field (for future AI generation)
- **Batch Addition API**: Support for importing both new nodes and new relationships in a single operation via JSON.

### Bug Fixes / Polish
- **Search Persistence**: Search highlights are no longer cleared when clicking the 3D view; they now revert back to search state when a specific node highlight is dismissed.
- **Multi-Select Visuals**: Shift-clicking now correctly highlights all selected nodes (and their neighbors) simultaneously.
- **Unsaved Changes Guard**: The property panel now tracks dirty state and prompts the user before closing if changes haven't been saved.
- Right‑click after drag – context menu appears (fixed by resetting `isDragging`)
- Drag‑and‑drop not working – requires raycaster threshold adjustment
- Shift+click on hidden nodes – should not select
