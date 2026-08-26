# Neo4j

Status: **planned, not implemented.** The only shipped pieces are the schema
design document and a Cypher text export. Tracking tasks live in
[[dev_tasks/todo/neo4j/]].

## What exists today

- Root `neo4j_schema.md`: the agreed schema baseline (labels, properties,
  relationship types, Embeddable pattern).
- `ui.js _generateCypherMerge(...)`: generates a `.cypher` file of MERGE
  statements from the current graph (optionally filter/hop limited). This is a
  one-way text export for manual import into Neo4j, not a driver integration.

## Schema baseline summary

Every node automatically gets:

- `UID` string from `randomUUID()`
- `createdTimestamp` / `lastUpdatedTimestamp` from `datetime()`

Optional **`Embeddable`** label adds vector search support (`vector` property).

Labels: `Person`, `Location`, `Event`, `Concept`, `Item`, `Goal`, `Emotion`,
plus AI-infrastructure labels (`LLM_Model`, `Evaluation`, `ChatSession`,
`ChatMessageNode`). See root `neo4j_schema.md` for full property lists.

## Mapping to editor model

| Editor | Neo4j target |
|--------|--------------|
| node.type (`person`, `location`, ...) | label (Person, Location, ...) |
| node.id (editor-local integer) | `UID` property (must become stable UUIDs) |
| edge.type / label | relationship type (standardized set: HAS, AT, IN, ...) |
| person template sections | Person properties / separate nodes |

## Planned work (tasks)

- task-008: support `:Embeddable` labels and vectors
- task-009: standardized relationship types (HAS, AT, IN, ...)
- task-010: automatic `UID` + timestamp properties on every node

These three are prerequisites for any real sync between the browser graph and a
Neo4j instance; none of them touches runtime code yet beyond the Cypher exporter.
