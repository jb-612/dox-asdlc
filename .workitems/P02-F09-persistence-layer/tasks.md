# P02-F09: Tasks

## Progress

- Started: 2026-01-31
- Tasks Complete: 22/22
- Percentage: 100%
- Status: COMPLETE

---

## Phase 1: Infrastructure Setup

### T01: Add PostgreSQL Dependencies
- [x] Estimate: 30min
- [x] Tests: tests/unit/persistence/test_infrastructure_setup.py (5 tests passing)
- [x] Dependencies: None

Add to requirements.txt:
- asyncpg>=0.29.0
- sqlalchemy[asyncio]>=2.0.0
- alembic>=1.13.0
- psycopg2-binary>=2.9.0

**Completed:** 2026-01-31
- Added all 4 PostgreSQL dependencies to requirements.txt
- All imports verified working

---

### T02: Add PostgreSQL to Docker Compose
- [x] Estimate: 1hr
- [x] Tests: tests/unit/persistence/test_infrastructure_setup.py (11 tests passing)
- [x] Dependencies: None

Modify docker/docker-compose.yml:
- Add postgres service with postgres:16-alpine
- Configure required environment variables (no defaults for credentials)
- Add named volume postgres-data
- Add health check with pg_isready
- Update orchestrator depends_on
- Create docker/.env.example with sample values

**Completed:** 2026-01-31
- Added postgres service to docker-compose.yml with all required configuration
- Created docker/.env.example with PostgreSQL environment variables
- Orchestrator now depends on postgres with service_healthy condition
- Added postgres-data named volume

---

### T03: Create PostgreSQL Init Script
- [x] Estimate: 1hr
- [x] Tests: tests/unit/persistence/test_infrastructure_setup.py (8 tests passing)
- [x] Dependencies: T02

Create docker/postgres/init.sql:
- Create all 6 tables with TIMESTAMPTZ
- Create all indexes (including prd_drafts and user_stories)
- Add foreign key constraints with CASCADE
- Add version column for optimistic locking

**Completed:** 2026-01-31
- Created docker/postgres/init.sql with full schema
- All 6 tables: ideation_sessions, ideation_messages, ideation_requirements, ideation_maturity, ideation_prd_drafts, ideation_user_stories
- All 7 indexes for query performance
- Foreign keys with ON DELETE CASCADE
- version column for optimistic locking on sessions table

---

## Phase 2: Domain Models and Interfaces

### T04: Create Domain Models
- [x] Estimate: 1hr
- [x] Tests: tests/unit/test_ideation_domain_models.py (28 tests passing)
- [x] Dependencies: None

Create src/core/models/ideation.py (in CORE layer, not orchestrator):
- IdeationSession dataclass
- ChatMessage dataclass
- ExtractedRequirement dataclass
- MaturityCategory dataclass
- MaturityState dataclass
- PRDDraft dataclass
- UserStory dataclass

Note: Pure Python dataclasses with no external dependencies.

**Completed:** 2026-01-31
- Created src/core/models/__init__.py
- Created src/core/models/ideation.py with all domain models
- All enums (ProjectStatus, DataSource, MessageRole, RequirementType, RequirementPriority) inherit from str for JSON serialization

---

### T05: Create Repository Interfaces
- [x] Estimate: 1hr
- [x] Tests: tests/unit/test_repository_interfaces.py (37 tests passing)
- [x] Dependencies: T04

Create src/orchestrator/repositories/interfaces.py:
- ISessionRepository ABC with async methods
- IMessageRepository ABC with async methods
- IRequirementRepository ABC with async methods
- IMaturityRepository ABC with async methods
- IPRDRepository ABC with async methods

**Completed:** 2026-01-31
- Created src/orchestrator/repositories/__init__.py
- Created src/orchestrator/repositories/interfaces.py with all repository ABCs
- All methods are abstract and async
- Includes pagination support (limit, offset) where appropriate

---

## Phase 3: Database Layer

### T06: Create SQLAlchemy ORM Models
- [x] Estimate: 1.5hr
- [x] Tests: tests/unit/persistence/test_orm_models.py (26 tests passing)
- [x] Dependencies: T04

Create src/orchestrator/persistence/orm_models.py:
- SessionORM with relationships
- MessageORM
- RequirementORM
- MaturityORM
- PRDDraftORM
- UserStoryORM

**Completed:** 2026-01-31
- Created src/orchestrator/persistence/__init__.py
- Created src/orchestrator/persistence/orm_models.py with all 6 ORM models
- All models have proper relationships (back_populates, cascade delete-orphan)
- Note: MessageORM uses `message_metadata` attribute name to avoid SQLAlchemy reserved name, maps to `metadata` column

---

### T07: Create Domain-ORM Mappers
- [x] Estimate: 1hr
- [x] Tests: tests/unit/persistence/test_ideation_mappers.py (19 tests passing)
- [x] Dependencies: T04, T06

Create src/orchestrator/persistence/mappers.py:
- SessionMapper.to_orm() / from_orm()
- MessageMapper.to_orm() / from_orm()
- RequirementMapper.to_orm() / from_orm()
- MaturityMapper.to_orm() / from_orm()
- PRDMapper.to_orm() / from_orm()
- UserStoryMapper.to_orm() / from_orm()

**Completed:** 2026-01-31
- Created src/orchestrator/persistence/mappers.py with all 6 mapper classes
- Proper enum conversion (ProjectStatus, DataSource, MessageRole, RequirementType, RequirementPriority)
- JSONB serialization for MaturityCategory and PRDSection lists

---

### T08: Create Database Configuration
- [x] Estimate: 1hr
- [x] Tests: tests/unit/persistence/test_database.py (18 tests passing)
- [x] Dependencies: T06

Create src/orchestrator/persistence/database.py:
- DatabaseConfig class with required env vars
- Database class with connect/disconnect
- Async engine creation with SSL support
- Session factory
- Session context manager

**Completed:** 2026-01-31
- Created src/orchestrator/persistence/database.py
- DatabaseConfig reads from POSTGRES_* environment variables
- Database class with async connect/disconnect and session context manager
- get_database() singleton function

---

### T09: Setup Alembic Migrations
- [x] Estimate: 1hr
- [x] Tests: alembic history (verified)
- [x] Dependencies: T06, T08

Create src/orchestrator/alembic/:
- Initialize with alembic init
- Configure alembic.ini for async PostgreSQL
- Configure env.py with ORM models
- Create initial migration

**Completed:** 2026-01-31
- Created src/orchestrator/alembic.ini
- Created src/orchestrator/alembic/env.py with async SQLAlchemy support
- Created src/orchestrator/alembic/script.py.mako template
- Created initial migration: 20260131_000000_initial_ideation_tables.py
- Migration creates all 6 tables with TIMESTAMPTZ, indexes, and foreign keys

---

## Phase 4: Repository Implementations

### T10: Implement PostgresSessionRepository
- [x] Estimate: 1.5hr
- [x] Tests: tests/unit/test_postgres_session_repository.py (15 tests passing)
- [x] Dependencies: T05, T06, T07, T08

Create src/orchestrator/repositories/postgres/session_repository.py:
- create() with ORM insert, returns full object
- get_by_id() with select
- update() with merge
- delete() with cascade
- list_by_user() with pagination

**Completed:** 2026-01-31
- Created src/orchestrator/repositories/postgres/__init__.py package
- Created src/orchestrator/repositories/postgres/session_repository.py
- Implements ISessionRepository using SessionMapper and SessionORM
- All 15 unit tests pass with mocked AsyncSession

---

### T11: Implement PostgresMessageRepository
- [x] Estimate: 1hr
- [x] Tests: tests/unit/test_postgres_message_repository.py (12 tests passing)
- [x] Dependencies: T05, T06, T07, T08

Create src/orchestrator/repositories/postgres/message_repository.py:
- create() for message insert
- get_by_session() with ordering
- delete_by_session()
- Pagination support

**Completed:** 2026-01-31
- Created src/orchestrator/repositories/postgres/message_repository.py
- Messages ordered by timestamp ASC for chronological display
- All 12 unit tests pass

---

### T12: Implement PostgresRequirementRepository
- [x] Estimate: 1hr
- [x] Tests: tests/unit/test_postgres_requirement_repository.py (12 tests passing)
- [x] Dependencies: T05, T06, T07, T08

Create src/orchestrator/repositories/postgres/requirement_repository.py:
- create()
- get_by_session()
- update()
- delete()

**Completed:** 2026-01-31
- Created src/orchestrator/repositories/postgres/requirement_repository.py
- Handles optional category_id field
- All 12 unit tests pass

---

### T13: Implement PostgresMaturityRepository
- [x] Estimate: 1hr
- [x] Tests: tests/unit/test_postgres_maturity_repository.py (11 tests passing)
- [x] Dependencies: T05, T06, T07, T08

Create src/orchestrator/repositories/postgres/maturity_repository.py:
- save() with upsert behavior
- get_by_session()
- JSON serialization for categories

**Completed:** 2026-01-31
- Created src/orchestrator/repositories/postgres/maturity_repository.py
- Uses merge() for upsert since session_id is primary key
- Categories serialized to JSONB via MaturityMapper
- All 11 unit tests pass

---

### T14: Implement PostgresPRDRepository
- [x] Estimate: 1.5hr
- [x] Tests: tests/unit/test_postgres_prd_repository.py (16 tests passing)
- [x] Dependencies: T05, T06, T07, T08

Create src/orchestrator/repositories/postgres/prd_repository.py:
- save_draft()
- get_draft()
- save_user_stories()
- get_user_stories()

**Completed:** 2026-01-31
- Created src/orchestrator/repositories/postgres/prd_repository.py
- get_draft() returns latest draft ordered by created_at DESC
- save_user_stories() replaces existing stories (delete then add)
- All 16 unit tests pass

---

## Phase 5: Factory and Redis Fallback

### T15: Create Repository Factory
- [x] Estimate: 1hr
- [x] Tests: tests/unit/test_repository_factory.py (15 tests passing)
- [x] Dependencies: T10-T14

Create src/orchestrator/repositories/factory.py:
- RepositoryFactory protocol
- PostgresRepositoryFactory
- get_repository_factory() with env selection
- get_database() singleton

**Completed:** 2026-01-31
- Created src/orchestrator/repositories/factory.py
- RepositoryFactory Protocol with 5 repository getter methods
- PostgresRepositoryFactory implementation
- get_repository_factory() selects backend from IDEATION_PERSISTENCE_BACKEND env var
- Default backend is "postgres", also supports "redis"

---

### T16: Implement Redis Repository Fallback
- [x] Estimate: 2hr
- [x] Tests: tests/unit/test_redis_repository.py (36 tests passing)
- [x] Dependencies: T05

Create src/orchestrator/repositories/redis/:
- RedisSessionRepository (wrap existing Redis calls)
- RedisMessageRepository
- RedisRequirementRepository
- RedisMaturityRepository
- RedisPRDRepository
- RedisRepositoryFactory

Ensures IDEATION_PERSISTENCE_BACKEND=redis still works.

**Completed:** 2026-01-31
- Created src/orchestrator/repositories/redis/ package with all 5 repositories
- RedisSessionRepository with user session index
- RedisMessageRepository using Redis lists
- RedisRequirementRepository using Redis hashes
- RedisMaturityRepository storing JSON
- RedisPRDRepository for drafts and user stories
- RedisRepositoryFactory managing shared Redis client

---

### T17: Update IdeationService for Repositories
- [x] Estimate: 3hr
- [x] Tests: tests/unit/test_ideation_service_repositories.py (10 tests passing)
- [x] Dependencies: T15, T16

Modify src/orchestrator/services/ideation_service.py:
- Add repository factory injection
- Replace direct Redis calls with repository calls
- Maintain backward compatibility with Redis fallback
- Handle Pydantic field aliasing (camelCase <-> snake_case)

Note: Increased estimate from 2hr to 3hr given service complexity.

**Completed:** 2026-01-31
- Added repository_factory parameter to IdeationServiceImpl.__init__
- Added _get_repository_factory(), _get_message_repository(), _get_maturity_repository()
- Updated get_session_maturity() to use maturity repository
- Updated save_draft() to use maturity repository
- Updated _get_conversation_history() to use message repository
- Updated _save_conversation_message() to use message repository
- Updated _get_session_maturity_dict() and _save_session_maturity() to use repositories
- Backward compatible: works with both postgres and redis backends

---

## Phase 6: Integration Testing and Migration

### T18: Integration Tests - Session Repository
- [x] Estimate: 1.5hr
- [x] Tests: tests/integration/persistence/test_postgres_session_repository.py (12 tests passing)
- [x] Dependencies: T10

Setup pytest fixture for PostgreSQL:
- Test create and retrieve
- Test update
- Test delete with cascade
- Test list with pagination

**Completed:** 2026-01-31
- Created tests/integration/persistence/__init__.py
- Created tests/integration/persistence/conftest.py with testcontainers PostgreSQL fixtures
- Created tests/integration/persistence/test_postgres_session_repository.py
- Auto-detection of Docker socket for macOS/Linux compatibility
- All 12 integration tests pass with real PostgreSQL

---

### T19: Integration Tests - Message Repository
- [x] Estimate: 1hr
- [x] Tests: tests/integration/persistence/test_postgres_message_repository.py (10 tests passing)
- [x] Dependencies: T11

Test:
- Message creation
- Chronological ordering
- Pagination
- Cascade delete

**Completed:** 2026-01-31
- Created tests/integration/persistence/test_postgres_message_repository.py
- Tests chronological ordering, pagination, cascade delete
- Tests all message role types and metadata handling
- All 10 integration tests pass

---

### T20: Integration Tests - Full Workflow
- [x] Estimate: 2hr
- [x] Tests: tests/integration/persistence/test_ideation_persistence.py (8 tests passing)
- [x] Dependencies: T17

Test:
- Full chat flow with persistence
- Session resume with history
- Maturity state persistence
- PRD generation and storage
- Restart simulation

**Completed:** 2026-01-31
- Created tests/integration/persistence/test_ideation_persistence.py
- Tests complete workflow: create session -> add messages -> update maturity -> save draft
- Tests session resume with history restoration
- Tests cascade delete removes all related data
- Tests PRD draft and user story workflow
- All 8 integration tests pass

---

### T21: Create Redis to PostgreSQL Migration Script
- [x] Estimate: 2hr
- [x] Tests: Manual testing (dry-run mode available)
- [x] Dependencies: T17

Create scripts/migrate_redis_to_postgres.py:
- Export sessions from Redis
- Import to PostgreSQL
- Validate data integrity
- Support dry-run mode
- Document in README

**Completed:** 2026-01-31
- Created scripts/__init__.py
- Created scripts/migrate_redis_to_postgres.py
- Supports --dry-run flag to preview without changes
- Supports --skip-existing flag for incremental migration
- Supports --verbose flag for detailed progress
- Validates data integrity after migration
- Logs progress and errors with statistics summary

---

### T22: Update Orchestrator Environment Config
- [x] Estimate: 30min
- [x] Tests: docker-compose config verified
- [x] Dependencies: T02, T17

Update docker-compose.yml orchestrator service:
- Add POSTGRES_HOST, POSTGRES_PORT
- Add POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
- Add IDEATION_PERSISTENCE_BACKEND=postgres
- Add POSTGRES_SSL_MODE=prefer

**Completed:** 2026-01-31
- Updated docker/docker-compose.yml orchestrator environment section
- Added all 7 PostgreSQL environment variables
- Set IDEATION_PERSISTENCE_BACKEND=postgres as default
- Orchestrator now configured to use PostgreSQL for persistence

---

### T01 (addendum): Add testcontainers dependency
- [x] Added testcontainers[postgres]>=3.7.0 to requirements.txt for integration tests

---

## Dependency Graph

```
Phase 1 (Infrastructure):
T01 ─────────────────────────────────────────────────────────┐
T02 ──> T03 ──────────────────────────────────────> T22 ─────┤
                                                             │
Phase 2 (Models):                                            │
T04 ──> T05 ──────────────────────────────────────────┬──────┤
                                                      │      │
Phase 3 (Database):                                   │      │
T04 ──> T06 ──┬──> T07                               │      │
              └──> T08 ──> T09                        │      │
                    │                                 │      │
                    └────────────────────────────────┬┤      │
                                                     ▼│      │
Phase 4 (PostgreSQL Repos):                           │      │
T05 + T06 + T07 + T08 ──> T10 ──────────────────> T18│      │
                      ──> T11 ──────────────────> T19│      │
                      ──> T12                        │      │
                      ──> T13                        │      │
                      ──> T14                        │      │
                                  │                  │      │
                                  ▼                  │      │
Phase 5 (Factory + Redis):                           │      │
T10-T14 ──> T15 ──┐                                 │      │
T05 ──────> T16 ──┴──> T17 ──> T20, T21 <───────────┘──────┘
```

## Estimates Summary

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1: Infrastructure | T01-T03 | 2.5h |
| Phase 2: Domain Models | T04-T05 | 2h |
| Phase 3: Database Layer | T06-T09 | 4.5h |
| Phase 4: PostgreSQL Repos | T10-T14 | 6h |
| Phase 5: Factory + Redis | T15-T17 | 6h |
| Phase 6: Integration/Migration | T18-T22 | 7h |

**Total Estimated Effort:** 28 hours (~4-5 days)

## Parallel Execution Strategy

1. **Infrastructure Track:** T01, T02, T03, T22
2. **Models Track:** T04, T05, T06, T07, T08, T09
3. **PostgreSQL Repos Track:** T10-T14 (after T05-T08 done)
4. **Redis Fallback Track:** T16 (after T05 done, can run parallel with T10-T14)
5. **Integration Track:** T15, T17, T18-T21 (after repos done)
