# P02-F09: User Stories

## Epic Summary

Add a PostgreSQL persistence layer to the Ideation Studio so that session data (projects, chat messages, extracted requirements, maturity state) survives Docker container restarts. The implementation uses clean architecture with the repository pattern, allowing easy swapping of database backends.

---

## US-01: Session Data Survives Container Restarts

**As a** product manager using Ideation Studio
**I want** my ideation sessions to persist across Docker restarts
**So that** I do not lose my work when containers are rebuilt

### Acceptance Criteria

- [ ] Sessions created before restart are available after restart
- [ ] All session data is restored: messages, requirements, maturity
- [ ] Session list shows previously created sessions
- [ ] Resuming a session restores full conversation history
- [ ] No manual data export/import required

### Test Scenarios

**Given** a user has created an ideation session with messages
**When** Docker containers are restarted
**Then** the session appears in the saved drafts list

**Given** a user resumes a previously saved session
**When** the session loads
**Then** all chat messages are displayed in order

---

## US-02: Repository Pattern Abstraction

**As a** developer
**I want** persistence abstracted via repository interfaces
**So that** I can easily swap database implementations

### Acceptance Criteria

- [ ] All persistence operations use repository interfaces
- [ ] No direct database calls in service or API layers
- [ ] PostgreSQL and Redis implementations available
- [ ] Configuration selects backend without code changes
- [ ] New backend requires only implementing interfaces

### Test Scenarios

**Given** IDEATION_PERSISTENCE_BACKEND=postgres
**When** the service starts
**Then** PostgresRepositoryFactory is used

**Given** IDEATION_PERSISTENCE_BACKEND=redis
**When** the service starts
**Then** RedisRepositoryFactory is used

---

## US-03: Session CRUD Operations

**As a** system component
**I want** to create, read, update, and delete ideation sessions
**So that** session lifecycle is fully managed

### Acceptance Criteria

- [ ] Create session returns unique ID
- [ ] Get by ID returns session or None
- [ ] Update modifies existing session
- [ ] Delete removes session and all related data
- [ ] List by user returns user's sessions ordered by updated_at

### Test Scenarios

**Given** a new session is created
**When** create() is called
**Then** a unique session ID is returned

**Given** a session exists
**When** delete() is called
**Then** the session and all related data are removed

---

## US-04: Chat Message Persistence

**As a** user resuming an ideation session
**I want** the full chat history restored
**So that** I can continue from where I left off

### Acceptance Criteria

- [ ] Messages saved with role, content, timestamp
- [ ] Messages retrieved in chronological order
- [ ] Maturity delta preserved per message
- [ ] Pagination supported for long histories
- [ ] Delete session removes all messages

### Test Scenarios

**Given** a session with 10 messages
**When** get_by_session() is called
**Then** all 10 messages are returned in timestamp order

---

## US-05: Requirements Persistence

**As a** product manager
**I want** extracted requirements saved to the database
**So that** I can review and refine them across sessions

### Acceptance Criteria

- [ ] Requirements saved with type, priority, category
- [ ] Requirements editable (update operation)
- [ ] Requirements deletable individually
- [ ] Session deletion removes all requirements

### Test Scenarios

**Given** a requirement is extracted during chat
**When** the session is saved
**Then** the requirement is persisted to the database

---

## US-06: Maturity State Persistence

**As a** user tracking ideation progress
**I want** maturity scores persisted
**So that** I see accurate progress on resume

### Acceptance Criteria

- [ ] Overall score and level saved
- [ ] Per-category scores saved as JSON
- [ ] can_submit flag persisted
- [ ] Gaps list persisted
- [ ] Upsert behavior (save creates or updates)

### Test Scenarios

**Given** maturity score increases during a session
**When** the draft is saved
**Then** the maturity state is persisted

---

## US-07: PRD Draft Persistence

**As a** user who submitted for PRD generation
**I want** the PRD draft saved
**So that** I can access it later

### Acceptance Criteria

- [ ] PRD draft saved with title, version, sections
- [ ] Sections stored as JSON array
- [ ] Latest draft retrievable by session ID
- [ ] Status tracked (draft, pending_review, approved)

### Test Scenarios

**Given** a PRD is generated
**When** save_draft() is called
**Then** the PRD is persisted with all sections

---

## US-08: User Stories Persistence

**As a** user who generated user stories
**I want** them saved to the database
**So that** I can export or review them later

### Acceptance Criteria

- [ ] User stories saved with as_a, i_want, so_that
- [ ] Acceptance criteria stored as JSON array
- [ ] Linked requirements tracked
- [ ] Priority persisted

### Test Scenarios

**Given** user stories are generated
**When** save_user_stories() is called
**Then** all stories are persisted with acceptance criteria

---

## US-09: PostgreSQL Docker Configuration

**As a** developer
**I want** PostgreSQL configured in docker-compose
**So that** I can run the full stack locally

### Acceptance Criteria

- [ ] postgres service added to docker-compose.yml
- [ ] Persistent volume configured
- [ ] Health check enables depends_on
- [ ] Init script creates schema
- [ ] Environment variables configure connection

### Test Scenarios

**Given** docker-compose up is run
**When** postgres service starts
**Then** the database is created with all tables

---

## US-10: Backward Compatible API

**As an** existing Ideation Studio user
**I want** the API unchanged
**So that** my frontend code still works

### Acceptance Criteria

- [ ] All existing endpoints unchanged
- [ ] Request/response schemas unchanged
- [ ] Mock fallback still works (VITE_USE_MOCKS=true)
- [ ] No frontend changes required
- [ ] Existing tests still pass

### Test Scenarios

**Given** the frontend calls POST /api/studio/ideation/chat
**When** the backend uses PostgreSQL persistence
**Then** the response format is unchanged

---

## US-11: Database Migrations

**As a** developer
**I want** Alembic migrations for schema changes
**So that** I can evolve the schema safely

### Acceptance Criteria

- [ ] Alembic configured for the project
- [ ] Initial migration creates all tables
- [ ] Migrations are reversible (downgrade)
- [ ] Autogenerate works from ORM models

### Test Scenarios

**Given** alembic upgrade head is run
**When** the database is empty
**Then** all tables are created
