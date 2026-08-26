# bug-004: Filter settings not respected after search + escape

**Status**: Todo

## Symptom

Disabled node types reappear after using search and pressing Escape; filter
settings are not respected.

## Expected

Escape clears search highlights but restores exactly the prior visibility state
(types disabled in Settings stay hidden).

## Fix hints

- `applySearch(query, shouldHide)` mutates mesh visibility directly; Escape
  likely restores "everything visible" instead of re-running `applyFilters()`
  from the canonical `filters` object.
- Rule: search/highlight code must never be the source of truth for visibility;
  always reconcile through `applyFilters()`.

## Acceptance criteria

- [ ] Escaping search re-applies stored filters
- [ ] Search highlight mode does not permanently change visibility
- [ ] Hide-mode search also restores correctly on escape/clear

## References

- Legacy todo.md: "Settings filter persistence"
