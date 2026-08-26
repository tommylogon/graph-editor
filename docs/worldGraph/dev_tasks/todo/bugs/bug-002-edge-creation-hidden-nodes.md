# bug-002: Edge creation / selection must respect hidden nodes

**Status**: Todo

## Symptom

Nodes hidden by filters can still be selected by click (and shift-click), and
edge creation can target them. regression_test.md flags both.

## Expected

Hidden nodes are fully inert: not clickable, not selectable, not usable as
edge endpoints. Edge creation between a visible and a hidden node must be
refused with feedback.

## Fix hints

- Raycast hit testing needs a visibility gate (`c.visible`) before treating a
  hit as a selection candidate (click handler around ui.js:831).
- `startEdgeConnection` / `quickConnect` should validate both endpoints against
  current `filters` state.
- Keep Show Inactive semantics intact (inactive-but-shown nodes stay
  interactive).

## Acceptance criteria

- [ ] Hidden nodes cannot be clicked/selected
- [ ] Edge creation refuses hidden endpoints
- [ ] Visible behavior unchanged

## References

- regression_test.md rows "Hidden nodes not selectable", "Edge Cases"
