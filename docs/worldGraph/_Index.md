# WorldGraph Wiki

This is the Obsidian vault for **WorldGraph**, the standalone 3D graph editor for
worldbuilding (Three.js + vanilla ES6, runs fully in the browser). This wiki
documents every system, how it works, how it's wired, and where the code lives.

> **Repo**: `C:\Projects\graph-editor`
> **Code conventions**: see the repo root `AGENTS.md`
> **Related project**: VirtualWorld lives in `C:\Projects\virtual-world` (same
> documentation and task-tracking style as this vault)

---

## [[Core/Architecture|🧱 Core]]

| Doc | What it covers |
|-----|---------------|
| [[Core/Architecture\|Architecture]] | Module map, event-driven wiring, globals, boot sequence, run instructions |
| [[Core/Storage & Data Model\|Storage & Data Model]] | IndexedDB persistence, named graphs, node/edge shapes, person/event templates, undo/redo |

## [[Rendering/Visualization & Physics|🎨 Rendering]]

| Doc | What it covers |
|-----|---------------|
| [[Rendering/Visualization & Physics\|Visualization & Physics]] | Three.js scene objects, sprites/labels, curved edges, force-directed physics config, cluster attraction, highlight system, filters/search |

## [[UI/UI & Interaction|🖥️ UI & Interaction]]

| Doc | What it covers |
|-----|---------------|
| [[UI/UI & Interaction\|UI & Interaction]] | Context menus, properties panel + person tabs, settings tabs (Data/Physics/Style/AI), selection model, camera + keyboard controls, hover preview |

## [[Integrations/Export & Import|📤 Export & Import]]

| Doc | What it covers |
|-----|---------------|
| [[Integrations/Export & Import\|Export & Import]] | Full/partial JSON, additive + selective/comparison node import, Markdown world doc, SillyTavern lorebook, Cypher MERGE export, extract-to-node, merge duplicates |

## [[Integrations/Neo4j|🗄️ Neo4j]]

| Doc | What it covers |
|-----|---------------|
| [[Integrations/Neo4j\|Neo4j]] | Planned integration, schema baseline (labels, Embeddable, UID/timestamps), what exists today (Cypher text export only), tracking tasks |

---

## 📋 Active Tasks

> [[dev_tasks/todo/|📥 Todo]] · [[dev_tasks/inprogress/|🔧 In Progress]] · [[dev_tasks/review/|👀 Review]] · [[dev_tasks/done/|✅ Done]]
>
> Tasks live in the `dev_tasks/` folder in this vault. Each task file is an `.md`
> with notes, design decisions, and code references. Tasks are grouped by category
> (core, ui, style, neo4j, bugs) within each status folder. Folder-move workflow:
> `todo/` → `inprogress/` → `review/` → `done/`.

---

## Quick Links

- **Run**: `start.bat` (serves on `http://localhost:8000`)
- **Schema baseline**: root `neo4j_schema.md`
- **Manual QA checklist**: root `regression_test.md`
- **History**: root `changelog.md`

*Last updated: 2026-08-26*
