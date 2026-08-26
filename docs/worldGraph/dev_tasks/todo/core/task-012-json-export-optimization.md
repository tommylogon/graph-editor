# task-012: JSON export optimization (coordinates vs physics)

**Status**: Todo

## Goal

Stop exporting meaningless coordinate data, OR make loading honor coordinates.

## Problem

Physics recalculates positions on load, so exported x/y/z are mostly noise.
But if physics is disabled or speed is low, imported coordinates DO matter,
and today loading ignores them anyway.

## Two acceptable resolutions (pick one)

1. **Strip coordinates from JSON export** when physics is expected to recompute
   layout; keep them behind an "export positions" checkbox.
2. **Load with physics suspended**: on import, disable physics (or set speed 0),
   place nodes at stored coordinates, restore prior speed after the first frames.

## Acceptance criteria

- [ ] Chosen behavior implemented and documented in [[Integrations/Export & Import]]
- [ ] Round trip (export > import) reproduces the same visual layout under option 2
- [ ] No regression in autosave size

## References

- Legacy todo.md: "JSON export optimization"
- `js/storage.js` (`exportJSON`, `importJSON`), `js/visualization.js`
  (`physicsConfig.speed`)
