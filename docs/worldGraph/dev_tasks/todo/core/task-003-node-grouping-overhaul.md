# task-003: Node grouping overhaul

**Status**: Todo

Blocked by / related: bug-001 (group creation currently produces nothing).

## Goal

Make groups fully functional end to end.

## Scope

- [ ] Fix group creation failure first (see bug-001)
- [ ] Create group from selected nodes (Shift+click multi-select > right-click)
- [ ] Collapse / expand group (members hidden, wireframe cube represents them)
- [ ] Proxy edges when collapsed (dashed lines + connection count labels)
- [ ] Ungroup restores original independent nodes and edges
- [ ] Group label editing via group properties panel

## Implementation notes

Storage side appears complete (`createGroup`, `setGroupCollapsed`,
`ungroup` in storage.js) and visualization side has `_collapseGroup`,
`_expandGroup`, `_createProxyEdge`, `_removeProxyEdge`. The failure is most
likely in ui.js `createGroupFromSelected()` wiring or event payload mismatch;
debug there first.

## References

- regression_test.md rows "Create group" / "Collapse group" / "Expand group" /
  "Ungroup" describe intended behavior
- [[Core/Storage & Data Model]], [[Rendering/Visualization & Physics]]
