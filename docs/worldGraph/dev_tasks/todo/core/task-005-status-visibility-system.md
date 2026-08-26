# task-005: Status / visibility system (active/inactive)

**Status**: Todo

## Goal

Give nodes and edges an explicit `status` property (active/inactive) and make
filters, highlighting, and rendering respect it consistently.

## Current state (verify before coding)

- Node shape already documents `status`, and the visualization has
  `filters.showInactive` + `setShowInactive(bool)` + `applyFilters()` that hide
  inactive items unless "Show Inactive" is checked.
- Edges have no status handling yet.
- regression_test.md expects: hidden-by-inactive nodes disappear, reappear when
  Show Inactive is checked.

## Scope

- [ ] Verify node status flow works end to end (panel toggle > storage > filters)
- [ ] Add status to edges with the same filter behavior
- [ ] Include status in search/highlight decisions
- [ ] Document the property in [[Core/Storage & Data Model]]

## References

- Legacy todo.md: "Status/Visibility System"
- `js/visualization.js` (`filters`, `applyFilters`)
