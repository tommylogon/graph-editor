# WorldGraph: A 3D Graph Editor for Worldbuilding

WorldGraph is an interactive, browser‑based graph editor designed for worldbuilders, writers, game masters, and storytellers. It lets you visually construct and manage complex networks of characters, locations, items, concepts, and relationships—all in an immersive 3D environment. With rich property editing, physics‑based layout, and powerful grouping/filtering tools, WorldGraph turns your world’s data into a living, explorable graph.

---

## Key Features

- **Interactive 3D Visualization** – Nodes float in space; you can rotate, pan, and zoom freely. Physics simulation gently arranges nodes to reveal natural clusters.
- **Rich Node & Edge Editing** – Create, delete, and modify nodes (people, places, items, concepts, groups) and edges. Each node carries a detailed property set – for characters, this includes appearance, personality, biography, secrets, and more.
- **Grouping & Collapsing** – Bundle multiple nodes into a group; collapse the group to simplify the view and see proxy edges representing aggregated connections.
- **Filters & Search** – Hide node types (persons, locations, etc.) or inactive nodes. Search across labels and properties to highlight matching elements.
- **Undo / Redo** – Full undo/redo stack for all graph modifications.
- **Physics Engine** – Optional force‑directed layout with adjustable repulsion, attraction, and damping. Lock nodes in place to fix their positions.
- **Data Persistence** – Saves automatically to browser `localStorage`. Import/export graphs as JSON files; export a complete Markdown documentation of your world.
- **Character‑Focused Schema** – Persons have a deeply nested JSON schema covering everything from basic info to intimate details, kinks, and narrative arcs. You can selectively import/export character data.
- **Extensible** – The modular JavaScript code makes it easy to add new node types, visual styles, or integrations.

---

## Architecture Overview

WorldGraph is a single‑page application built with **Three.js** for 3D rendering and plain JavaScript for the application logic. It is split into four main modules:

- **`storage.js`** – Manages the graph data model, persistence (localStorage), undo/redo, and event dispatching.
- **`visualization.js`** – Renders nodes and edges in Three.js, handles physics simulation, grouping visuals (proxy edges), and applies filters.
- **`ui.js`** – Implements the user interface: context menus, property panels, settings, search, and all interaction logic (drag, select, create, edit).
- **`main.js`** – Initializes the Three.js scene, camera, lights, controls, and ties the modules together.

The application runs entirely in the browser; no server is required. All data is stored locally.

---

## Detailed Component Descriptions

### 1. Graph Storage (`storage.js`)

The `GraphStorage` class is the heart of the data model. It holds:

- `nodes`: a `Map` of node objects, each with an `id`, `type`, `label`, `position`, `visualType`, `imageUrl`, `status`, `isLocked`, and a `properties` object.
- `edges`: an array of edge objects, each with `id`, `source`, `target`, `type`, `label`, `description`, and an `attributes` object.

**Key methods**:
- `createNode(type, position)`, `updateNode(id, updates)`, `deleteNode(id)`
- `createEdge(sourceId, targetId)`, `updateEdge(edgeId, updates)`, `deleteEdge(edgeId)`, `swapEdgeDirection()`, `ensureBidirectional()`
- Group operations: `createGroup(memberIds, position)`, `setGroupCollapsed()`, `ungroup()`
- Persistence: `save()`, `load()`, `exportJSON()`, `importJSON()`
- Undo/redo: `_pushState()`, `undo()`, `redo()` – snapshots the entire graph before each mutation.

The storage also defines a comprehensive **person schema** (a deeply nested JSON structure) used as a template when creating person nodes. This schema is used in the UI to render editable fields and supports selective import/export of character data.

### 2. Graph Visualization (`visualization.js`)

The `GraphVisualization` class creates and manages Three.js objects for nodes and edges. It listens to events from `GraphStorage` to add, update, or remove visual elements.

- **Nodes** – Rendered as spheres (or as sprites with an image). Node size scales with degree (number of connections). Each node has a floating label.
- **Edges** – Rendered as curved lines (using quadratic Bézier curves when multiple edges connect the same pair). Edge labels float near the midpoint. Directional arrows are added when edges have a defined direction.
- **Groups** – A group is a wireframe cube. When collapsed, its member nodes are hidden and proxy edges (dashed lines) are drawn between the group and external nodes, with a count label.
- **Physics** – A simple force‑directed layout runs every frame (if enabled). Repulsion between nodes, spring forces along edges, and a gentle centering force move nodes. Nodes can be locked to disable physics on them.
- **Filters & Search** – Nodes and edges can be hidden based on type or status. A search term highlights matching nodes and edges (by label or property content).

### 3. User Interface (`ui.js`)

The `GraphUI` class handles all user interaction and overlays. It creates and manages:

- **Context menu** – Right‑click to add nodes, connect selected nodes, create groups, delete, etc.
- **Properties panel** – Appears when a node or edge is clicked (or from the context menu). For person nodes, it renders the entire nested character schema with collapsible sections, combo‑boxes for common values, and “extract” buttons to turn inline data (e.g., a family member) into a separate graph node.
- **Edge creation hint** – When connecting mode is active, a hint is displayed.
- **Global settings panel** – Toggle physics, adjust parameters, filter node types, rename the graph, and perform file operations (save, load, export JSON, export Markdown).
- **Search bar** – Search across labels and properties.
- **Selection badge** – Shows how many nodes are selected (Shift‑click to multi‑select).
- **Auto‑save indicator** – Briefly appears when the graph is saved.

The UI is highly interactive: dragging nodes updates their position in real time, double‑click opens the properties panel, and keyboard shortcuts (e.g., `C` to connect selected nodes, `Esc` to cancel) speed up editing.

### 4. Main Entry (`main.js`)

Sets up the Three.js scene, camera, lights, and grid. Initializes the visualization and UI modules. Listens for keyboard input to enable free‑flight navigation (WASD + Space/X for up/down, arrow keys to rotate the view). The animation loop applies physics and renders the scene.

---

## How to Use WorldGraph

### Installation & Running

1. Ensure you have the following files in a directory:
   - `index.html`
   - `css/styles.css` (the provided CSS block)
   - `js/storage.js`
   - `js/visualization.js`
   - `js/ui.js`
   - `js/main.js`
2. Open `index.html` in a modern web browser (Chrome, Firefox, Edge).
3. The graph editor appears with a default graph containing two persons (Jake and Miki) and one location (“The Pines”).

### Basic Interactions

- **Navigate** – Left‑click and drag to rotate the view; right‑click and drag to pan; scroll to zoom. Use WASD + Space/X to move the camera.
- **Select** – Left‑click a node or edge to open its properties panel. Hold Shift and click to multi‑select nodes.
- **Add Nodes** – Right‑click on empty space to open the context menu; choose a node type. The new node appears in front of the camera.
- **Connect Nodes** – Right‑click a node, choose “Connect to…”, then click another node. Or select two nodes and press `C`.
- **Edit Properties** – Click a node, then use the right‑side panel to modify its fields. For person nodes, sections are collapsible; combo‑boxes offer common values. Use the “Extract” button (⤴) to turn inline data (e.g., a parent’s name) into a separate graph node.
- **Groups** – Select several nodes, right‑click, and choose “Create Group”. Use the group’s properties panel to name it, collapse/expand it, or ungroup.
- **Undo/Redo** – Use the buttons in the settings panel or press Ctrl+Z / Ctrl+Y.
- **Search** – Type in the top‑center search bar; matching nodes and edges are highlighted, others are dimmed. Press Enter with a search term to create a new node with that label.
- **Export** – In the settings panel, click “Export JSON” to download the entire graph, or “Export Doc (.md)” to generate a Markdown document with all characters and locations.

---

## Data Model

### Node Types

- `person` – Detailed character with a rich schema.
- `location` – Places; properties include description, address, etc.
- `item` – Objects; properties include description, maybe state, quantity.
- `concept` – Abstract ideas, themes, lore.
- `group` – A container for other nodes; can be collapsed.

### Person Schema (Abridged)

```json
{
  "metadata": { "version": "1.0", "last_updated": "..." },
  "basic_info": {
    "name": { "full": "", "first": "", "last": "", "nicknames": [], "aliases": [] },
    "age": 25,
    "gender": "", "pronouns": "", "sexuality": "", "species": "Human",
    "occupation": "",
    "family": { "parents": [], "siblings": [], "children": [], "other_relations": [] },
    "marital_status": "Single", "partner": null
  },
  "appearance": { "height": {}, "build": "", "hair": {}, "eyes": {}, "style": {}, "voice": {}, ... },
  "personality": { "traits": [], "mbti": "", "likes": [], "dislikes": [], ... },
  "biography": { "early_life": {}, "adulthood": {}, "current_situation": "" },
  "relationships": { "connections": [], "friends": [], "enemies": [], ... },
  "secrets": { "deepest_secret": "", "hidden_facts": [] },
  "capabilities": { "skills": [], "languages": [], "weaknesses": [] },
  "kinks_and_sexuality": { "orientation": "", "turn_ons": [], "turn_offs": [], ... },
  "narrative": { "arc": "", "role_in_town": "" },
  "media": { "favorite_movies": [], "favorite_music": [], "favorite_books": [] }
}
```

### Edges

Edges represent relationships or connections between nodes. They have:

- `id` (string)
- `source`, `target` (node IDs)
- `type` (e.g., "knows", "lives in", "related to")
- `label` (optional, e.g., "friends with")
- `description` (optional text)
- `attributes` (object, e.g., `{ strength: 0.5, bidirectional: true }`)

---

## Exporting a World Document

Click “Export Doc (.md)” in the settings panel to generate a comprehensive Markdown file containing:

- A header with the graph name and export date.
- A list of all locations with descriptions and connections.
- All concepts (if any).
- Detailed profiles for every person, including basic info, appearance, personality, biography, relationships, secrets, etc., formatted as a readable text block.

This document can be used as a worldbuilding reference, printed, or shared.

---

## Future Possibilities

- **LLM Integration** – Connect to a local LLM (like LM Studio) to generate descriptions, suggest relationships, or auto‑populate character details from a prompt.
- **Real‑Time Collaboration** – Use WebRTC or a simple server to allow multiple users to edit the same graph simultaneously.
- **Import from Existing Formats** – Import from CSV, TiddlyWiki, or other worldbuilding tools.
- **Animation & Storytelling** – Play back the graph evolution over time, or use it as a storyboarding tool.
- **VR Mode** – Leverage Three.js’s VR capabilities to explore the world graph in virtual reality.

---

WorldGraph transforms your abstract ideas into a tangible, explorable universe. Whether you’re building a fantasy realm, a sci‑fi setting, or a complex character network, WorldGraph gives you the tools to organise, visualise, and evolve your creation.

---

*WorldGraph is open‑source and welcomes contributions. Feel free to adapt it to your own needs or extend it with new features.*