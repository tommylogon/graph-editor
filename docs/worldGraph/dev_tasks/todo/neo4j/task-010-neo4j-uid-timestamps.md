# task-010: Neo4j automatic UID and timestamps

**Status**: Todo

## Goal

Give every node a stable `UID` plus `createdTimestamp` / `lastUpdatedTimestamp`
as defined in neo4j_schema.md.

## Design notes

- Editor ids today are integers from `nextNodeId`, reassigned per graph; they
  are NOT stable across export/import round trips. UID must be generated once
  at node creation (`crypto.randomUUID()`) and persisted on the node.
- Timestamps: set created at creation, update lastUpdated on every
  `updateNode`/`updateEdge`. Keep them out of undo snapshots or accept history
  noise (decide during implementation).
- Backfill: existing saved graphs get UIDs lazily on load when missing.

## Acceptance criteria

- [ ] New nodes/edges get UID + both timestamps automatically
- [ ] Existing graphs backfilled on load without data loss
- [ ] Cypher export uses UID as the merge key
- [ ] Selective import preserves original UID rather than regenerating

## References

- [[Integrations/Neo4j]]
