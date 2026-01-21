# User Stories: P01-F01 Infrastructure Setup

## US-01: Start Development Environment

**As a** developer  
**I want** to start all aSDLC containers with a single command  
**So that** I can begin development without manual service configuration

### Acceptance Criteria

The command `docker compose up` starts all four containers successfully. All containers report healthy status within 60 seconds. Redis is accessible from the orchestrator and worker containers. The HITL UI is accessible at `http://localhost:3000`. Stopping with `docker compose down` cleanly shuts down all services.

### Test Scenarios

**Scenario 1: Fresh start**
Given no containers are running and Docker is available, when I run `docker compose up -d`, then all four containers start and health checks pass within 60 seconds.

**Scenario 2: Restart after failure**
Given containers were stopped unexpectedly, when I run `docker compose up -d`, then containers recover and Redis state is preserved from the last checkpoint.

---

## US-02: Access Redis for Event Coordination

**As a** service component  
**I want** a configured Redis client factory  
**So that** I can connect to Redis without hardcoding connection details

### Acceptance Criteria

The `get_redis_client()` function returns a connected Redis client. Connection parameters are read from environment variables. The client can write to and read from streams. Consumer groups defined in the system design are pre-created.

### Test Scenarios

**Scenario 1: Basic connectivity**
Given Redis is running, when I call `get_redis_client()`, then I receive a client that can execute `PING` successfully.

**Scenario 2: Stream operations**
Given a Redis client, when I write an event to `asdlc:events`, then I can read it back using a consumer group.

---

## US-03: Verify Container Health

**As an** operator  
**I want** health check endpoints on each container  
**So that** I can monitor system status and detect failures

### Acceptance Criteria

Each container exposes `GET /health` returning JSON with status, container name, and timestamp. A healthy container returns HTTP 200. An unhealthy container returns HTTP 503 with diagnostic information. Docker Compose uses these endpoints for dependency ordering.

### Test Scenarios

**Scenario 1: Healthy state**
Given all dependencies are available, when I request `/health`, then I receive HTTP 200 with `{"status": "healthy"}`.

**Scenario 2: Dependency failure**
Given Redis is unavailable, when I request `/health` on the orchestrator, then I receive HTTP 503 with error details.

---

## US-04: Establish Project Directory Structure

**As a** developer  
**I want** the canonical directory structure created  
**So that** all code and artifacts have designated locations

### Acceptance Criteria

The directories `src/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tools/`, `docs/`, `scripts/`, and `.workitems/` exist. Each Python package directory contains an `__init__.py` file. The `tools/lib/` directory contains `common.sh` for bash utilities.

### Test Scenarios

**Scenario 1: Structure verification**
Given the project is initialized, when I list the directory structure, then all expected directories exist with correct hierarchy.

---

## US-05: Use Development Scripts

**As a** developer  
**I want** helper scripts for common workflow tasks  
**So that** I can follow the spec-driven workflow efficiently

### Acceptance Criteria

The script `./scripts/new-feature.sh P01 F02 "feature-name"` creates the work item folder with template files. The script `./scripts/check-planning.sh P01-F02-feature-name` validates planning completeness. The script `./scripts/check-completion.sh P01-F02-feature-name` validates feature readiness for commit.

### Test Scenarios

**Scenario 1: Create new feature**
Given no work item exists, when I run `./scripts/new-feature.sh P01 F02 "test-feature"`, then the folder `.workitems/P01-F02-test-feature/` is created with `design.md`, `user_stories.md`, and `tasks.md` templates.
