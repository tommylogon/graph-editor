# task-001: Map mode (locations on ground plane)

**Status**: Todo

## Goal

Add a "Map mode" where location-type nodes are laid out on the ground plane
(like a map) while character/person nodes hover above the location they are
connected to, using graph edges to determine placement.

## Design notes

- Location nodes pin to y=0; persons float at fixed altitude above their
  connected location (edge `at`/`lives in` style relations decide which).
- Likely implemented as an alternative physics profile in
  `visualization.js applyPhysics()`: skip y-forces in map mode and snap
  locations flat instead of relying on the global `is2D` flag.
- Needs UI toggle next to the existing 2D/3D button (Settings > Physics).

## Acceptance criteria

- [ ] Locations rest on the ground plane in map mode
- [ ] Person nodes hover above their connected location
- [ ] Persons without a location connection keep free physics
- [ ] Mode persists per graph

## References

- Legacy todo.md: "Core Graph Management"
- `js/visualization.js` (`physicsConfig`, `applyPhysics`)
