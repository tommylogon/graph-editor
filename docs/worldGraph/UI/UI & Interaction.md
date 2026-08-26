# UI & Interaction

Code: `js/ui.js` (`GraphUI`, ~186 KB monolith) plus extracted helpers in
`ui/forms.js`, `ui/tabs.js`, `ui/utils.js`, `ui/exportImport.js`.

## Layout of overlays

All DOM is injected by ui.js into `document.body`: top search bar, hover preview
tooltip (`#hover-preview`), context menu container, right-side properties panel
(draggable via header handle, resize logic in `_initResize`), collapsible global
settings panel (bottom left), selection badge, save indicator, edge-creation hint.

## Properties panel

`buildPropertiesPanel(id, type)` renders per selection:

- Generic fields for label, description, image URL/upload + preview, image AI
  prompt (stored only, no generation yet), "Locked in place" checkbox, status.
- **Person nodes render tabbed**: Overview / Appearance / Personality /
  Biography / Relationships / Kinks & Media (tab buttons at ui.js:200-205).
  Forms are generated from the person template schema with:
  - combo-boxes offering preset values plus an "Other..." free-text option
  - array fields edited as comma-separated input
  - object arrays with "+ Add Entry" rows (`_renderObjectArray`)
- `_collectFormData(container)` walks the DOM back into the nested properties
  object on save.
- Connected nodes list rendered via `_renderConnectedNodes(nodeId, container)`
  with quick actions.
- **Extract-to-node**: the ⤴ button next to a field opens
  `_showExtractPopup(fieldValue, sourceNodeId, fieldPath)` (or
  `_showObjectExtractPopup` for structured entries) to split inline data
  (a parent, a friend) into its own node, optionally auto-connected.

## Global settings tabs

Tab bar at ui.js:1445-1448:

| Tab | Contents |
|-----|----------|
| Data | Save/Load buttons, graph name, stored-graph list (`refreshGraphList`, `loadGraph(name)`, `createNewGraph()`), Export JSON, Import JSON, Export Doc (.md), SillyTavern lorebook, Cypher export |
| Physics | enable toggle, repulsion / attraction / min distance / speed sliders, 2D-3D toggle, label size, edge thickness |
| Style | per-type color pickers backed by `typeStyles` (`refreshTypeStylesList()`), line thickness |
| AI | placeholder ("Future capabilities for ComfyUI and LLM processing will appear here") |

## Selection model

- Left click selects node or edge (opens panel); Shift+click adds to selection;
  click empty space deselects and closes panels.
- Selection badge shows multi-select count (`_updateSelectionBadge`).
- Multi-select actions: Delete Selected, Connect Selected to This
  (`connectAllTo(targetId)`), chain connect with `C` (`quickConnect(sourceId,
  targetId, bidirectional)` between consecutive picks).

## Context menu

`buildContextMenu()` builds entries depending on target: empty area (Add <type>
for each type, Create Group when >1 selected), node (Edit, Connect to..., group
actions, Delete), edge (Edit, Flip Direction, Make Bidirectional, Delete Edge),
group (Toggle Collapse, Ungroup, Rename). `startEdgeConnection(forcedId)` enters
connect mode with the hint overlay; Esc cancels.

## Camera & keyboard

- Fly keys: WASD horizontal (camera + orbit target move together, speed 0.5),
  Space up, X down (down disabled while 2D mode is on), arrows rotate view
  (axis-angle rotation around target, 0.03 rad/frame).
- OrbitControls: RIGHT drag rotate, MIDDLE dolly, wheel zoom (1..100 range).
- Shortcuts are ignored while an input/textarea/contenteditable has focus
  (`isInputActive()` in main.js).
- Ctrl+Z / Ctrl+Y (+ Ctrl+Shift+Z) call `window.__ui.undo()/redo()`.

## Hover preview

`updateHoverPreview(id, type)` fills `#hover-preview` near the cursor with label,
type and description excerpt for the hovered element.
