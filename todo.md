# 🌐 World Graph Editor – Feature TODO

> **Legacy snapshot.** Active planning moved to
> `docs/worldGraph/dev_tasks/` (kanban: todo → inprogress → review → done).
> The open items below were migrated into individual task/bug files there;
> this file is kept for history and should not be updated anymore.

## ✅ Core Graph Management
- [ ] **Map mode**: locations on ground plane, characters hover above connected location (using edges)

## 🖱️ UI / Interaction
- [x] Drag‑and‑drop nodes
- [x] Prevent context menu after drag
- [x] **Search Bar Enhancements**
  - [x] On 'Enter': Filter/hide non-highlighted nodes/edges instead of creating a new node
  - [x] Persist search highlights when clicking a node or the canvas (don't reset to full opacity)
- [x] **Tabbed Settings Menu**
  - [x] Implement tabs for: Physics, Style, Data Handling, AI (ComfyUI/LLM)
- [x] **Physics Controls**
  - [x] Add "Physics Speed" slider (0 to max) to control simulation steps/speed
- [x] **Line Styling**
  - [x] Add line thickness slider in Style tab
  - [x] Implement type-based default colors for nodes and edges
  - [ ] Support per-item style overrides (item color > type color)

## 🔧 Advanced Features
- [ ] **Node grouping** (currently broken)
  - [ ] Investigate group creation failure (shift-click → right-click → create group produces no result, no logs)
  - [ ] Create group from selected nodes
  - [ ] Collapse/expand group
  - [ ] Proxy edges when collapsed
  - [ ] Ungroup
- [ ] **Image handling**
  - [ ] URL of image to display on node as sprite
  - [ ] Default sprites for node types (locations, persons, concepts, items)
- [ ] **Status/Visibility System**
  - [ ] Add status property (active/inactive) for nodes and edges
  - [ ] Respect status in filtering, highlighting, and rendering
- [ ] **Ordering & Layout Systems**
  - [ ] Investigate alternative ordering formats (hierarchical, radial, grid, etc.)
  - [ ] Allow user to switch between layout algorithms
  - [ ] Save layout preference per graph
- [ ] **Background handling**
  - [ ] Support custom background images for graph canvas
  - [ ] Background image pan/zoom controls
  - [ ] Background image opacity control

## 🗄️ Neo4j Integration
- [/] **Schema Implementation**
  - [x] Create [Neo4j Schema](neo4j_schema.md) baseline
  - [ ] Support for `:Embeddable` labels and vectors
  - [ ] Standardized relationship types (HAS, AT, IN, etc.)
  - [ ] Automatic `UID` and timestamp properties

## 🧪 Bug Fixes / Polish
- [ ] Ensure edge creation respects hidden nodes (source/target must be visible)
- [ ] Fix group creation: no node appears, no hiding occurs, no logs when creating group from selection
- [ ] **Line synchronization** - lines don't update position with nodes after a while (require node click to resync)
- [ ] **Settings filter persistence** - filter settings not respected after search/escape (disabled node types reappear)
- [ ] **Shift-click selection highlighting**
  - [ ] Only highlight the selected nodes (not unrelated items)
  - [ ] Include connected edges in shift-click highlighting (currently no edges are highlighted)
- [ ] **Text editing UX**
  - [ ] Convert description fields on Location, Concept, Item to draggable/editable text fields (like node titles)
- [ ] **JSON export optimization**
  - [ ] Remove unnecessary coordinate data from JSON export if physics recalculates positions on load
  - [ ] OR: Fix loading logic to disable physics during load and restore speed after load completes

## 🚀 Future Ideas (Not Yet Started)
- [ ] **Hover tooltip search** - tooltip only shows search match context, not full node data
- [ ] **Text editor mode** - batch edit entire graph via form/text interface with all entries accessible
- [ ] **LLM integration** (auto‑generate descriptions, suggest relationships)
- [ ] **GraphRAG** (query graph with natural language)
- [ ] **Camera bookmarks** (save/restore views)
- [ ] **Markdown export** (enhance with more templates)
- [ ] **Export to other formats** (GraphML, CSV, Neo4j Cypher)
- [ ] **Tagging system** beyond type
- [ ] **Clustering / groups of groups**
- [ ] **Physics presets** (e.g., "spread out", "compact")
- [ ] **Node pinning** (already have "locked" but could be more visual)
- [ ] **Contextual tooltips** (showing why a node matched search)
