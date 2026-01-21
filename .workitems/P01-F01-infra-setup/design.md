# Feature Design: P01-F01 Infrastructure Setup

## Overview

This feature establishes the foundational infrastructure for the aSDLC system, including the Docker container topology, Redis configuration, directory structure, and development tooling. It provides the base upon which all other features are built.

## Dependencies

This feature has no internal dependencies as it is the first feature. External dependencies include Docker 24+, Python 3.11+, and Redis 7+.

## Interfaces

### Provided Interfaces

**Docker Compose Configuration**
The feature provides a `docker-compose.yml` that starts all four containers defined in the system design, specifically the Orchestrator/Governance container, the Agent Workers container, the Infrastructure Services container with Redis and ChromaDB, and the HITL Web UI container.

**Directory Structure**
The feature establishes the canonical project structure documented in CLAUDE.md, including `src/`, `tests/`, `tools/`, `docs/`, and `.workitems/` directories.

**Redis Connection Factory**
```python
async def get_redis_client() -> redis.Redis:
    """Returns configured Redis client for event streams and state."""
```

**Health Check Endpoints**
Each container exposes a health check endpoint at `/health` returning JSON status.

### Required Interfaces

No required interfaces for this foundational feature.

## Technical Approach

The implementation creates a Docker Compose configuration that defines the four-container topology. Container 1 (Orchestrator) runs the governance services with exclusive access to Git credentials. Container 2 (Workers) provides a stateless agent execution environment. Container 3 (Infrastructure) runs Redis for event streams and ChromaDB for the KnowledgeStore prototype. Container 4 (HITL UI) serves a minimal web interface.

Redis is configured with persistence enabled for durability across restarts. Consumer groups are pre-created for the event streams defined in the system design. The KnowledgeStore container initializes with an empty collection ready for document indexing.

Development tooling includes the bash tool wrapper infrastructure with a common library for JSON output formatting. Initial tool wrappers are created as stubs that will be implemented in P01-F02.

## File Structure

```
docker/
├── docker-compose.yml
├── orchestrator/
│   └── Dockerfile
├── workers/
│   └── Dockerfile
├── infrastructure/
│   └── Dockerfile
└── hitl-ui/
    └── Dockerfile

src/
├── __init__.py
├── core/
│   ├── __init__.py
│   ├── config.py
│   ├── redis_client.py
│   └── exceptions.py
└── infrastructure/
    ├── __init__.py
    └── health.py

tools/
├── lib/
│   └── common.sh
├── lint.sh (stub)
├── test.sh (stub)
└── health.sh

scripts/
├── new-feature.sh
├── check-planning.sh
└── check-completion.sh
```

## Open Questions

The specific Redis persistence strategy (RDB vs AOF vs both) requires tuning based on recovery requirements. For the prototype, RDB snapshots every 60 seconds may be sufficient.

## Risks

The primary risk is Docker networking complexity across containers. Mitigation involves using Docker Compose networking with explicit service names and health check dependencies to ensure services start in order.
