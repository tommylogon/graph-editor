# bug-005: Shift-click highlighting scope wrong

**Status**: Todo

## Symptom

With multiple nodes selected via Shift+click:

1. Unrelated items get highlighted too (highlighting is not limited to the
   selected set)
2. Connected edges are NOT highlighted at all

## Expected

Only the selected nodes glow, plus the edges directly connecting members of the
selection.

## Fix hints

- `highlightMultipleNodes(nodeIds)` builds an active set via neighbor expansion;
  for multi-select it should use depth 0 for members plus explicit member-to-
  member edges instead of neighborhood expansion.
- `_applyHighlightVisuals(activeNodes, activeEdges, primaryNodeId)` already
  accepts an edge set; feed it the induced subgraph of the selection.

## Acceptance criteria

- [ ] Exactly the selected nodes highlighted
- [ ] Edges between two selected nodes highlighted
- [ ] Single-select highlight behavior unchanged (neighbor depth setting still applies)

## References

- Legacy todo.md: "Shift-click selection highlighting"
