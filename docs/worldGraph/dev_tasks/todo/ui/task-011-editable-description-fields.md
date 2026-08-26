# task-011: Editable description fields (draggable text UX)

**Status**: Todo

## Goal

Convert description fields on Location, Concept, and Item property panels into
the same draggable/editable inline treatment that node titles use, instead of
plain form textareas.

## Design notes

- Titles already support click-to-edit + drag interplay in ui.js; reuse that
  behavior for description blocks so long text stays readable directly on the
  panel.
- Careful: dragging text must not trigger node drag; check pointerdown routing
  in `setupEventListeners()` (ui.js) before styling.

## Acceptance criteria

- [ ] Location/Concept/Item descriptions editable inline
- [ ] Text selection and drag do not conflict
- [ ] Changes save through the normal debounced save path

## References

- Legacy todo.md: "Text editing UX"
