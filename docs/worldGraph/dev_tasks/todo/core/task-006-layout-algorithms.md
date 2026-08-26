# task-006: Alternative ordering / layout algorithms

**Status**: Todo

## Goal

Offer layout algorithms beyond force-directed physics and let the user switch.

## Candidate layouts

Hierarchical (tree by edge direction), radial, grid.

## Design notes

- Physics lives in `visualization.js applyPhysics()`. A layout abstraction is
  needed: a layout computes target positions, physics optionally relaxes from
  there. Simplest first cut: deterministic position assignment + `heat()` +
  temporary physics suspension.
- Persist the chosen layout preference per graph (add a field next to
  `typeStyles` in the save payload; bump format version carefully).

## Acceptance criteria

- [ ] Layout picker in Settings > Physics
- [ ] At least hierarchical and grid implemented
- [ ] Preference saved per graph and restored on load
- [ ] Switching back to physics mode works without residue

## References

- Legacy todo.md: "Ordering & Layout Systems"
