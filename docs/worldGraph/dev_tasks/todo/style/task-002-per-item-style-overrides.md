# task-002: Per-item style overrides

**Status**: Todo

## Goal

Allow individual nodes and edges to override their type-based default color /
style. Resolution order: item style > type style.

## Design notes

- `getNodeColor(type, id)` in visualization.js already accepts an id parameter,
  suggesting the lookup hook exists but has no data behind it yet.
- Add optional `style` object on node/edge ({color, ...}) set from the
  properties panel.
- `updateTypeStyle(category, type, style)` handles type level; add a sibling
  storage method for item level that fires an update event so visuals refresh.

## Acceptance criteria

- [ ] Per-node color override editable in properties panel
- [ ] Per-edge color override editable in edge panel
- [ ] Clearing override falls back to type style
- [ ] Override survives save/load/export/import

## References

- Legacy todo.md: "Line Styling > Support per-item style overrides"
- `js/storage.js` (`typeStyles`, `updateTypeStyle`), `js/visualization.js`
  (`getNodeColor`)
