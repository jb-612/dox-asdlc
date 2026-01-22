# Contract Changelog

All notable changes to the API contracts will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-22

### Added

- **events.json**: Initial event schemas for Redis Streams coordination
  - `ASDLCEvent` model with session lifecycle, task lifecycle, HITL gate, agent execution, and patch events
  - `HandlerResult` for event processing responses
  - `EventType` enum covering all workflow events

- **hitl_api.json**: Initial HITL Web UI API contract
  - Gate management endpoints (`GET /gates/pending`, `GET /gates/{id}`, `POST /gates/{id}/decide`)
  - Worker pool status endpoint (`GET /workers/status`)
  - Session management endpoints (`GET /sessions`, `GET /sessions/{id}`)
  - Artifact retrieval endpoint (`GET /artifacts/{path}`)

- **knowledge_store.json**: KnowledgeStore interface contract
  - Document indexing and retrieval operations
  - Semantic search with filters
  - Health check interface

### Contract Ownership

| Contract | Owner | Consumers |
|----------|-------|-----------|
| events.json | agent | ui, orchestrator |
| hitl_api.json | agent | ui |
| knowledge_store.json | agent | ui, workers |

---

## Change Protocol

1. Create proposed change in `contracts/proposed/`
2. Send coordination message announcing change
3. Wait for consumer acknowledgment
4. After ACK: move to `contracts/versions/vX.Y.Z/`, update symlinks in `current/`
5. Update this CHANGELOG
