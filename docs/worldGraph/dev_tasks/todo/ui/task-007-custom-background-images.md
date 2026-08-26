# task-007: Custom background images for the graph canvas

**Status**: Todo

## Goal

Support a user-supplied background image behind the 3D canvas with pan/zoom and
opacity controls.

## Design notes

- Scene background is currently a flat color set in main.js
  (`scene.background = 0x111122`).
- Options: THREE.Texture on scene.background (static) or a large textured plane
  below y=0 if the image should pan with the camera. Plane fits the map-mode
  direction of task-001 better.
- Controls live in Settings > Style: file/URL input, opacity slider, optional
  scale/offset sliders.

## Acceptance criteria

- [ ] Background image selectable via upload or URL
- [ ] Opacity control works
- [ ] Pan/zoom relationship defined and documented (moves with world or fixed)
- [ ] Setting persists per graph

## References

- Legacy todo.md: "Background handling"
