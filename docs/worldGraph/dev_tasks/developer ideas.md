# Developer Ideas (Backlog)

Unscheduled ideas. Promote one to `todo/<domain>/task-NNN-....md`
(check `dev_Task_sequence.md` for the next number) when work starts.

Migrated from the "Future Ideas" section of the legacy root `todo.md`:

- **Hover tooltip search**: tooltip shows only search match context today; show
  full node data instead.
- **Text editor mode**: batch edit the entire graph through a form/text interface
  with all entries accessible.
- **LLM integration**: auto-generate descriptions, suggest relationships,
  auto-populate character details from a prompt (pairs with the empty AI settings
  tab in ui.js:1527 and ComfyUI image prompts).
- **GraphRAG**: query the graph with natural language.
- **Camera bookmarks**: save/restore named views.
- **Markdown export templates**: more export variants beyond the world doc.
- **Export formats**: GraphML, CSV.
- **Tagging system** beyond node type.
- **Clustering / groups of groups**.
- **Physics presets** ("spread out", "compact").
- **Node pinning UX**: more visual treatment than the current locked checkbox.
- **Contextual tooltips**: explain WHY a node matched a search.

Older readme "future possibilities" worth keeping in mind:

- Real-time collaboration (WebRTC or small server)
- Import from CSV / TiddlyWiki / other worldbuilding tools
- Animation & storyboarding over graph evolution
- VR mode via Three.js WebXR

Related VirtualWorld synergy ideas (cross-project):

- The virtual-world engine keeps its own graph view; long-term the standalone
  editor could author scenarios that virtual-world imports.
