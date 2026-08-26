# task-009: Neo4j standardized relationship types

**Status**: Todo

## Goal

Standardize edge relationship types to the planned set (HAS, AT, IN, ...) so
editor edges map cleanly onto Neo4j relationships.

## Current state

Edges carry free-text `type` and optional `label` ("knows", "lives in", ...).
`_generateCypherMerge` exports whatever the user typed. Free text is fine for
Markdown but useless for consistent graph queries.

## Design notes

- Define the canonical relationship list (extend neo4j_schema.md, which lists
  HAS / AT / IN as examples).
- UI: relationship dropdown with presets + custom option, mirroring how the
  person form combo-boxes work.
- Migration for existing graphs: keep stored values, add a mapping table from
  common free-text forms to canonical types at export time.

## Acceptance criteria

- [ ] Canonical type list documented in neo4j_schema.md
- [ ] Edge editor offers preset types
- [ ] Cypher export emits canonical types
- [ ] Legacy free-text values still export via mapping

## References

- [[Integrations/Neo4j]]
