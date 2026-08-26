# bug-001: Group creation produces nothing

**Status**: Todo

## Symptom

Shift-click select nodes > right-click empty canvas > "Create Group (N nodes)"
produces no group node, hides nothing, and logs nothing.

## Expected

A wireframe cube group node appears containing the selection; members hide when
collapsed; proxy edges appear to external connections.

## Debug hints

- Storage path: `createGroup(memberIds, position)` (storage.js) exists.
- Visual path: `_collapseGroup`, proxy edge helpers exist in visualization.js.
- Suspect ui.js `createGroupFromSelected()` (ui.js:997): check whether it reads
  the multi-selection correctly, passes positions, and that the resulting
  `nodeAdded` event payload matches what visualization `addNode` expects for
  type `group`.
- No console output at all suggests an early return or a swallowed exception;
  wrap with try/catch logging while debugging.

## References

- regression_test.md "Known Issues" table
- Related task: task-003 (grouping overhaul)
