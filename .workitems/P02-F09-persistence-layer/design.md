# P02-F09: Persistence Layer for Ideation Studio

## Technical Design

### Overview

This feature adds a PostgreSQL-based persistence layer to store ideation session data for the PRD Ideation Studio. Currently, session data (projects, messages, requirements, maturity state) is stored in-memory (mocks) or Redis, which is ephemeral and lost on container restarts. This feature provides durable storage using a clean architecture with the repository pattern.

**Goals:**
- Implement repository pattern with abstract interfaces for persistence abstraction
- Add PostgreSQL as the primary data store with SQLAlchemy ORM (async)
- Persist all Ideation Studio data: sessions, messages, requirements, maturity, PRD drafts
- Configure Docker Compose with PostgreSQL service and persistent volume
- Maintain backward compatibility with existing API contracts
- Enable easy swapping of database implementations (PostgreSQL, Redis, SQLite)

### Dependencies

**Internal:**
- P05-F11: PRD Ideation Studio (existing API and models) - Required
- P01-F01: Infrastructure (Docker, Redis) - Required

**External:**
- asyncpg>=0.29.0 - Async PostgreSQL driver
- sqlalchemy[asyncio]>=2.0.0 - SQLAlchemy with async support
- alembic>=1.13.0 - Database migrations
- psycopg2-binary>=2.9.0 - PostgreSQL driver for migrations

### Architecture Pattern

The architecture follows clean architecture principles with domain models in the core layer:

```
┌─────────────────────────────────────────────────────────┐
│  API Layer (routes/ideation_api.py)                     │
│    - Pydantic request/response models                   │
├─────────────────────────────────────────────────────────┤
│  Service Layer (services/ideation_service.py)           │
│    - Business logic, orchestrates repositories          │
├─────────────────────────────────────────────────────────┤
│  Repository Interface (repositories/interfaces.py)      │
│    - ISessionRepository, IMessageRepository, etc.       │
├─────────────────────────────────────────────────────────┤
│  Domain Models (src/core/models/ideation.py)            │
│    - Pure Python dataclasses, no ORM dependencies       │
├─────────────────────────────────────────────────────────┤
│  Mapper Layer (persistence/mappers.py)                  │
│    - Domain <-> ORM model conversion                    │
├─────────────────────────────────────────────────────────┤
│  Repository Impl (repositories/postgres/*.py)           │
│    - PostgresSessionRepository, etc.                    │
├─────────────────────────────────────────────────────────┤
│  ORM Models (persistence/orm_models.py)                 │
│    - SQLAlchemy table definitions                       │
├─────────────────────────────────────────────────────────┤
│  Database Layer (persistence/database.py, migrations/)  │
│    - Connection management, Alembic migrations          │
└─────────────────────────────────────────────────────────┘
```

### Layer Separation

**Domain Layer (`src/core/models/ideation.py`):**
- Pure Python dataclasses with no external dependencies
- Business rules and validation
- Used by service layer and repository interfaces

**Infrastructure Layer (`src/orchestrator/persistence/`):**
- ORM models with SQLAlchemy dependencies
- Mapper classes for domain <-> ORM conversion
- Database connection management

This separation ensures the domain layer can be tested without database dependencies.

### Interfaces Provided

All repository methods are async:

#### ISessionRepository
- `async create(session: IdeationSession) -> IdeationSession`
- `async get_by_id(session_id: str) -> Optional[IdeationSession]`
- `async update(session: IdeationSession) -> None`
- `async delete(session_id: str) -> None`
- `async list_by_user(user_id: str, limit: int, offset: int) -> List[IdeationSession]`

#### IMessageRepository
- `async create(message: ChatMessage) -> ChatMessage`
- `async get_by_session(session_id: str, limit: int, offset: int) -> List[ChatMessage]`
- `async delete_by_session(session_id: str) -> None`

#### IRequirementRepository
- `async create(requirement: ExtractedRequirement) -> ExtractedRequirement`
- `async get_by_session(session_id: str) -> List[ExtractedRequirement]`
- `async update(requirement: ExtractedRequirement) -> None`
- `async delete(requirement_id: str) -> None`

#### IMaturityRepository
- `async save(maturity: MaturityState) -> None`
- `async get_by_session(session_id: str) -> Optional[MaturityState]`

#### IPRDRepository
- `async save_draft(draft: PRDDraft) -> PRDDraft`
- `async get_draft(session_id: str) -> Optional[PRDDraft]`
- `async save_user_stories(session_id: str, stories: List[UserStory]) -> None`
- `async get_user_stories(session_id: str) -> List[UserStory]`

### Mapper Layer

Mappers convert between domain models and ORM models:

```python
# src/orchestrator/persistence/mappers.py

class SessionMapper:
    @staticmethod
    def to_orm(domain: IdeationSession) -> SessionORM:
        """Convert domain model to ORM model."""
        
    @staticmethod
    def from_orm(orm: SessionORM) -> IdeationSession:
        """Convert ORM model to domain model."""

class MessageMapper:
    @staticmethod
    def to_orm(domain: ChatMessage) -> MessageORM: ...
    @staticmethod
    def from_orm(orm: MessageORM) -> ChatMessage: ...

# Similar mappers for Requirement, Maturity, PRD, UserStory
```

### Database Schema

Uses `TIMESTAMPTZ` for timezone-aware timestamps and includes all necessary indexes:

```sql
CREATE TABLE ideation_sessions (
    id VARCHAR(64) PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'draft',
    data_source VARCHAR(32) DEFAULT 'mock',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ideation_messages (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    maturity_delta INTEGER DEFAULT 0,
    metadata JSONB
);

CREATE TABLE ideation_requirements (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    type VARCHAR(32) NOT NULL,
    priority VARCHAR(32) NOT NULL,
    category_id VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ideation_maturity (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    level VARCHAR(32) NOT NULL,
    categories JSONB NOT NULL,
    can_submit BOOLEAN DEFAULT FALSE,
    gaps JSONB,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ideation_prd_drafts (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    version VARCHAR(32) NOT NULL,
    sections JSONB NOT NULL,
    status VARCHAR(32) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ideation_user_stories (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    as_a TEXT NOT NULL,
    i_want TEXT NOT NULL,
    so_that TEXT NOT NULL,
    acceptance_criteria JSONB NOT NULL,
    linked_requirements JSONB,
    priority VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query performance
CREATE INDEX idx_sessions_user_id ON ideation_sessions(user_id);
CREATE INDEX idx_sessions_updated_at ON ideation_sessions(updated_at);
CREATE INDEX idx_messages_session_id ON ideation_messages(session_id);
CREATE INDEX idx_messages_timestamp ON ideation_messages(timestamp);
CREATE INDEX idx_requirements_session_id ON ideation_requirements(session_id);
CREATE INDEX idx_prd_drafts_session_id ON ideation_prd_drafts(session_id);
CREATE INDEX idx_user_stories_session_id ON ideation_user_stories(session_id);
```

### Docker Compose Configuration

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: dox-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER is required}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: ${POSTGRES_DB:-asdlc_ideation}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB:-asdlc_ideation}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - asdlc-network

volumes:
  postgres-data:
```

**Note:** `POSTGRES_USER` and `POSTGRES_PASSWORD` are required and must be set in `.env` file or environment. Example `.env.example`:

```bash
POSTGRES_USER=asdlc
POSTGRES_PASSWORD=<generate-strong-password>
POSTGRES_DB=asdlc_ideation
```

### Configuration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| IDEATION_PERSISTENCE_BACKEND | postgres | Backend: postgres or redis |
| POSTGRES_HOST | postgres | PostgreSQL hostname |
| POSTGRES_PORT | 5432 | PostgreSQL port |
| POSTGRES_DB | asdlc_ideation | Database name |
| POSTGRES_USER | (required) | Database user |
| POSTGRES_PASSWORD | (required) | Database password |
| POSTGRES_POOL_SIZE | 5 | Connection pool size |
| POSTGRES_SSL_MODE | prefer | SSL mode (disable/prefer/require) |

### Migration Strategy (Redis -> PostgreSQL)

For existing deployments with data in Redis:

1. **Parallel Operation Phase:**
   - Deploy PostgreSQL alongside Redis
   - Set `IDEATION_PERSISTENCE_BACKEND=postgres` for new sessions
   - Existing sessions in Redis continue to work (read from Redis, write to both)

2. **Migration Script:**
   - `scripts/migrate_redis_to_postgres.py` exports Redis sessions to PostgreSQL
   - Run during maintenance window: `python -m scripts.migrate_redis_to_postgres`
   - Validates data integrity after migration

3. **Cutover:**
   - Set `IDEATION_PERSISTENCE_BACKEND=postgres` (remove Redis fallback)
   - Redis can be decommissioned after verification

4. **Rollback:**
   - If issues, set `IDEATION_PERSISTENCE_BACKEND=redis` to revert
   - Data written to PostgreSQL during migration remains for later retry

### Files to Create/Modify

| File | Action |
|------|--------|
| src/core/models/ideation.py | Create - Domain models |
| src/orchestrator/repositories/interfaces.py | Create - ABCs |
| src/orchestrator/persistence/orm_models.py | Create - SQLAlchemy |
| src/orchestrator/persistence/database.py | Create - Connection |
| src/orchestrator/persistence/mappers.py | Create - Domain<->ORM |
| src/orchestrator/repositories/postgres/*.py | Create - Implementations |
| src/orchestrator/repositories/redis/*.py | Create - Redis fallback |
| src/orchestrator/repositories/factory.py | Create - Factory |
| src/orchestrator/services/ideation_service.py | Modify - Use repos |
| docker/docker-compose.yml | Modify - Add postgres |
| docker/postgres/init.sql | Create - Schema |
| docker/.env.example | Create - Example env |
| src/orchestrator/alembic/ | Create - Migrations |
| scripts/migrate_redis_to_postgres.py | Create - Migration |

### Security Considerations

1. **Credentials:** Environment variables required (no defaults for passwords)
2. **SQL Injection:** SQLAlchemy parameterized queries prevent injection
3. **Network:** PostgreSQL only accessible within Docker network
4. **Production:** Use Kubernetes Secrets, not environment files
5. **SSL:** Enable `POSTGRES_SSL_MODE=require` for non-local deployments

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Data migration from Redis | Migration script with validation, parallel operation |
| Connection pool exhaustion | Configure pool size, add monitoring metrics |
| Schema changes break app | Use Alembic migrations with rollback capability |
| Production credential leak | Required env vars, no defaults, K8s Secrets |
