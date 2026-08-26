

# 🧪 Regression Test Checklist

| Feature | Description | How to Test |
|--------|-------------|-------------|
| **Core Graph** | | |
| Create node | Right‑click empty area → choose node type | Right‑click on canvas → select "Add Person" → a new node appears at camera position |
| Edit node (properties) | Left‑click node → edit in properties panel | Click a person node → change label, description, etc. → click "Save" → node updates |
| Delete node | Right‑click node → Delete, or via properties panel | Right‑click node → "Delete" → confirm → node and its edges disappear |
| Create edge | Right‑click node → "Connect to..." then click another node | Right‑click node A → "Connect to..." → click node B → edge appears with label |
| Edit edge | Left‑click edge → edit label/description in properties panel | Click an edge → change label → "Update" → edge label changes |
| Delete edge | Right‑click edge → "Delete Edge" | Right‑click edge → "Delete Edge" → confirm → edge disappears |
| Flip edge direction | Properties panel of edge → "Flip Direction" | Select edge → click "Flip Direction" → arrow reverses |
| Make bidirectional | Properties panel of edge → "Make Bidirectional" | Select edge → click "Make Bidirectional" → a second edge in opposite direction appears |
| **Selection** | | |
| Single select | Left‑click on node/edge | Click node → node highlights (emissive), properties panel opens |
| Multi‑select (Shift+click) | Hold Shift + click additional nodes | Select first node → Shift+click second → both nodes highlighted, selection badge shows count |
| Deselect | Click empty canvas | Click background → all highlights removed, properties panel closes |
| Context menu on node | Right‑click node | Right‑click node → menu appears with edit/connect/delete options |
| Context menu on edge | Right‑click edge | Right‑click edge → menu with edit/delete edge options |
| Context menu empty area | Right‑click empty canvas | Right‑click background → menu with "Add ..." options (plus group creation if nodes selected) |
| **Manipulation** | | |
| Drag node (3D) | Left‑click and drag a node | Click and drag a sphere node → node follows mouse; release → position saved; **currently buggy – should move smoothly** |
| Drag node (2D) | Toggle 2D mode, then drag | Switch to 2D (Settings → "2D") → drag node → movement constrained to horizontal plane |
| Locked node | Check "Locked in place" in properties | Lock a node → try to drag it → node should not move |
| **Grouping** | | |
| Create group | Select ≥2 nodes → right‑click empty canvas → "Create Group" | Shift+click 2 nodes → right‑click empty area → choose "Create Group (2 nodes)" → wireframe cube appears |
| Edit group label | Left‑click group → change label in properties | Click group → edit label → "Update" → label changes |
| Collapse group | Right‑click group → "Toggle Collapse" | Create group with external connections → collapse → members hide, proxy edges (dashed) appear |
| Expand group | Right‑click collapsed group → "Toggle Collapse" | Expand → members reappear, proxy edges vanish |
| Ungroup | Right‑click group → "Ungroup" | Ungroup → group node removed, members become independent (original edges restored) |
| **Undo / Redo** | | |
| Undo | Ctrl+Z (or Undo button) | Create a node → press Ctrl+Z → node disappears |
| Redo | Ctrl+Y (or Redo button) | After undo, press Ctrl+Y → node reappears |
| Undo after multiple actions | Perform several edits, then undo repeatedly | Add node, move it, delete edge → undo three times → each step reverts correctly |
| **Visualisation** | | |
| Physics toggle | Settings → "Physics" checkbox | Uncheck → nodes stop moving; check → movement resumes |
| Repulsion slider | Settings → "Repulsion" slider | Increase → nodes spread apart; decrease → nodes clump |
| Attraction slider | Settings → "Attraction" slider | Increase → connected nodes pull together |
| Min Distance slider | Settings → "Min Distance" slider | Increase → minimum distance between connected nodes grows |
| 2D / 3D toggle | Settings → "2D"/"3D" button | Toggle → camera repositions, nodes forced to/from y=0 plane |
| Node color by type | Person = peach, Location = green, etc. | Create nodes of different types → each has distinct colour |
| Node size scaling | Nodes with more connections are larger | Create a node, connect many edges to it → node grows |
| Edge arrows | Directed edges show arrowheads | Create edge → arrow points from source to target |
| Edge curvature | Multiple edges between same nodes curve | Create two edges between same nodes (bidirectional) → they curve apart |
| **Filters** | | |
| Filter by type | Settings → uncheck "Person" | All person nodes become invisible; their edges also hide |
| Show inactive | Settings → check "Show Inactive" | Nodes with status "inactive" appear (otherwise hidden) |
| **Search** | | |
| Search node labels | Type in top search bar | Type part of a node name → matching nodes glow, non‑matching dim |
| Search properties | Type a word that appears in properties | Enter text found in a node's description → that node glows |
| Clear search | Delete search text | All nodes return to normal appearance |
| **Camera Controls** | | |
| WASD pan | Press W/A/S/D | Camera moves forward/left/back/right |
| Space / X up/down | Press Space (up) / X (down) | Camera moves up/down (disabled in 2D for down) |
| Arrow rotate | Press arrow keys | View rotates around target |
| Orbit (mouse) | Right‑click + drag | Camera orbits around target |
| Zoom | Scroll wheel | Camera zooms in/out |
| **Data Persistence** | | |
| Auto‑save | Any change triggers save | Make edit → "Saved ✓" indicator briefly appears |
| Save manually | Settings → "Save" button | Click → graph saved to localStorage |
| Load manually | Settings → "Load" | After making changes, reload page → graph should restore |
| Export JSON | Settings → "Export JSON" | Click → downloads JSON file with all nodes/edges |
| Import JSON | Settings → "Import JSON" | Import previously exported file → graph replaced |
| Export Markdown | Settings → "Export Doc (.md)" | Click → downloads Markdown document with formatted character profiles |
| Export node JSON | Character properties panel → "Export JSON" | Open person node → click "Export JSON" → downloads character‑only JSON |
| Import node JSON | Character properties panel → "Import JSON" | Import character JSON → selective import modal appears |
| **UI Elements** | | |
| Selection badge | Shows when >1 nodes selected | Select 2+ nodes → badge appears with count |
| Edge hint | Shows when connecting | Right‑click node → "Connect to..." → hint appears "Click another node..." |
| Save indicator | Shows "Saved ✓" briefly | Make edit → indicator fades in/out |
| Settings collapse | Click settings header | Settings panel collapses/expands |
| **Advanced Node Properties (Person)** | | |
| Character form rendering | Open person node → see structured form | Expand sections (Basic Info, Appearance, etc.) – all fields should be visible |
| Combo‑box with "Other" | Field with preset options | e.g., Gender dropdown – select "Other…" → custom text field appears |
| Array fields | e.g., Traits – enter comma‑separated | Enter "brave, kind" → saved as array |
| Object arrays | e.g., Family members – can add/remove | In Family section, click "+ Add Entry" → new entry form appears |
| Extract to node | Click "⤴" button next to a text field | In a text field, click extract → popup to create/connect a new node |
| Image upload | Choose file in properties | Upload image → preview appears; after save, node becomes sprite |
| Image URL | Enter URL in properties | Enter image URL → preview; after save, node becomes sprite |
| Image prompt | Enter AI prompt text | Text saved with node (no generation yet) |
| **Edge Cases** | | |
| Hidden nodes not selectable | Filter out a type, then try to click | Hide persons → try to click a person node → nothing happens |
| Right‑click after drag | Drag a node, then right‑click | Drag, release, then right‑click → context menu appears (should not be blocked) |
| Delete selected | Select multiple nodes → right‑click → "Delete Selected" | Select 2 nodes → right‑click → "Delete Selected" → both vanish |
| Connect all to | Select multiple + right‑click one → "Connect Selected to This" | Select nodes A,B,C → right‑click C → choose "Connect Selected (2) to This" → edges A‑C and B‑C created |
| Quick connect (C key) | Select chain of nodes → press C | Select A,B,C in order → press C → edges A‑B and B‑C created |
| Escape key | During edge creation, press Esc | Start edge connection → press Esc → hint disappears, edge source cleared |

---

## ⚠️ Known Issues to Watch

| Issue | Status |
|-------|--------|
| Drag‑and‑drop does not work | To be fixed – currently nodes don't move when dragged |
| Context menu may appear during/after drag | Should be fixed by resetting `isDragging` on mouseup |
| Hidden nodes can still be selected via click | Should be fixed by adding `c.visible` filter in click handler |
| Shift+click on hidden node still selects | Should be fixed by same filter |

Use this table to systematically verify each feature after making changes. If any test fails, you'll know exactly what broke.