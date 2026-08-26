# 📊 Neo4j Graph Schema

This document outlines the node labels, properties, and relationship types for the Neo4j integration.

## 🏷️ Node Labels and Properties

All nodes must have these properties automatically added:
- `UID` (string, generated with `randomUUID()`)
- `createdTimestamp` (datetime, generated with `datetime()`)
- `lastUpdatedTimestamp` (datetime, generated with `datetime()`)

### `Embeddable`
Added to other nodes to make them searchable by vector embedding.
- `vector` (vector)

### `Person`
- `name` (string)
- `type` (string: 'Real', 'Virtual', 'Fictive')
- `description` (string)

### `Location`
- `name` (string)
- `type` (string: 'Physical', 'Virtual', 'Fictive')
- `description` (string)

### `Event`
- `name` (string)
- `type` (string: 'Dialogue', 'Generic', 'Project', etc.)
- `startTime` (datetime)
- `endTime` (datetime)
- `description` (string)
- `status` (string: 'Ongoing', 'Completed')

### `Concept`
- `name` (string)
- `type` (string: 'Theme', 'Interest', 'Hobby', etc.)
- `description` (string)

### `Item`
- `name` (string)
- `type` (string: 'Physical', 'Virtual', 'Fictive')
- `description` (string)
- `category` (string)

### `Goal`
- `name` (string)
- `description` (string)
- `priority` (string: 'High', 'Medium', 'Low')
- `deadline` (datetime)
- `status` (string: 'Planned', 'InProgress', 'Completed')

### `Emotion`
- `name` (string)
- `cause_text` (string)
- `response_text` (string)
- `emotions_felt` (list of strings)
- `timestamp` (datetime)

### `LLM_Model`
- `id` (string)
- `publisher` (string)
- `architecture` (string)
- `quantization` (string)
- `avg_response_time` (float)

### `Evaluation`
- `id` (string)
- `input_prompt` (string)
- `response` (string)
- `score` (integer)
- `evaluation_text` (string)
- `domain` (string)
- `subtask` (string)

### `ChatSession`
- `session_id` (string, unique)
- `start_time` (datetime)

### `ChatMessageNode`
- `message_id` (string, unique)
- `role` (string: 'system', 'user', 'assistant', 'tool')
- `content` (string)
- `timestamp` (datetime)
- `tool_calls` (string, JSON)
- `tool_call_id` (string)
- `name` (string)

### `File`
- `name` (string)
- `path` (string, unique)
- `size` (integer)
- `file_type` (string)
- `summary` (string)
- `last_modified` (datetime)

### `ContentChunk`
- `chunk_id` (string, unique)
- `chunk_index` (integer)
- `content` (string)

---

## 🔗 Relationship Types

These are the ONLY valid types:

- `HAS_EVALUATION` (LLM_Model -> Evaluation)
- `AT` (Any node -> Location or Event)
- `IN` (Any node -> Concept, Location, or Emotion)
- `DURING` (Any node -> Event)
- `THINKS_ABOUT` (Person -> Concept, Person, or Event)
- `FEELS` (Person -> Emotion)
- `CAUSED` (Event, Person, or Concept -> Emotion or Event)
- `AFFECTED_BY` (Any node -> Emotion, Event, or Person)
- `KNOWS` (Person -> Person)
- `INTERACTED_WITH` (Person -> Person, Item, Location, or Event)
- `PART_OF` (Person or Item -> Event or Concept)
- `HAS_RELATIONSHIP_WITH` (Person -> Person) - Requires a `relationship_type` property on the edge.
- `HAS` (Person -> Item, Concept, Goal, or Emotion)
- `OWNS` (Person -> Item or Image)
- `USES` (Person -> Item)
- `NEEDS` (Person -> Goal, Item, or Emotion)
- `WANTS` (Person -> Goal, Item, or Person)
- `PURPOSE_OF` (Goal -> Event, Concept, or Item)
- `WORKS_ON` (Person -> Goal, Event)
- `TRACKS` (Person -> Goal)
- `BLOCKED_BY` (Goal -> Event, Concept, or Emotion)
- `RESULTED_IN` (Goal or Event -> Emotion, Concept, or Item)
- `RELATED_TO` (Any node -> Any node) - Use as a general fallback.
- `IS_A` (Any node -> Concept)
- `DESCRIBES` (Concept -> Any node)
- `HAS_SESSION` (Person -> ChatSession)
- `HAS_MESSAGE` (ChatSession -> ChatMessageNode)
- `FIRST_MESSAGE` (ChatSession -> ChatMessageNode)
- `NEXT_MESSAGE` (ChatMessageNode -> ChatMessageNode)
- `BRANCH_MESSAGE` (ChatMessageNode -> ChatMessageNode)
- `HAS_CHUNK` (File -> ContentChunk)
- `NEXT_CHUNK` (ContentChunk -> ContentChunk)
- `MENTIONS` (ContentChunk -> Person, Location, Event, Concept, Item, Goal)
