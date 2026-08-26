# task-008: Neo4j Embeddable labels and vectors

**Status**: Todo

## Goal

Support the `:Embeddable` label pattern from neo4j_schema.md: mark nodes as
vector-searchable and carry an embedding vector property.

## Design notes

- Schema baseline: any label can additionally carry `Embeddable`; the vector
  property holds the embedding (see root `neo4j_schema.md`).
- Editor side needs: an "embeddable" flag per node (properties panel or type
  default), and an embedding source decision (local model, ComfyUI/LLM endpoint,
  external service). The empty AI settings tab (ui.js AI tab placeholder) is the
  natural home for endpoint configuration.
- Sync mechanics depend on task-009 and task-010 landing first (stable UIDs,
  standardized relations), otherwise exported data cannot round-trip.

## Acceptance criteria

- [ ] Per-node embeddable flag stored and exported
- [ ] Cypher export emits Embeddable label + vector placeholder property
- [ ] Endpoint config UI exists (AI tab)

## References

- [[Integrations/Neo4j]]
- Depends on: task-009, task-010
