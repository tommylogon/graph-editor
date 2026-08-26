# bug-003: Edge lines desync from node positions over time

**Status**: Todo

## Symptom

After a while, lines stop updating their positions together with nodes; clicking
a node forces them to resync.

## Expected

Edges track node positions every frame while physics moves anything.

## Fix hints

- `updateEdgesForNode(nodeId)` and `updateEdgePair(idA, idB)` exist; suspect a
  debounced update path (`_debouncedScalesAndFilters`) or a cached endpoint
  vector that is only refreshed on selection events.
- Check the drag handler: it may move the mesh without notifying connected
  edges until pointerup.

## Acceptance criteria

- [ ] Continuous physics motion keeps all attached edges glued to their nodes
- [ ] Dragging a node keeps its edges live during the drag

## References

- Legacy todo.md: "Line synchronization"
