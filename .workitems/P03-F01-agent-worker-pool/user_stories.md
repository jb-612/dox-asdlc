# P03-F01: Agent Worker Pool Framework - User Stories

## Epic Summary
As an aSDLC system operator, I need a worker pool framework that consumes agent events and executes agents reliably, so that the orchestrator can delegate work to specialized agents.

---

## User Stories

### US01: Worker Pool Lifecycle
**As a** system operator
**I want** the worker pool to start and stop gracefully
**So that** I can manage the service lifecycle without losing work

**Acceptance Criteria:**
- [x] Worker pool starts consuming events when start() is called
- [x] Worker pool stops accepting new events when stop() is called
- [x] In-progress agent executions complete before shutdown
- [x] Shutdown timeout cancels long-running tasks

### US02: Event Consumption
**As a** worker pool
**I want** to consume AGENT_STARTED events from Redis Streams
**So that** I can execute the appropriate agent

**Acceptance Criteria:**
- [x] Reads events from configured consumer group
- [x] Filters for AGENT_STARTED events only
- [x] Acknowledges processed events
- [x] Handles empty stream gracefully

### US03: Idempotent Processing
**As a** worker pool
**I want** to skip duplicate events
**So that** agents don't execute twice for the same request

**Acceptance Criteria:**
- [x] Checks idempotency key before processing
- [x] Atomically marks events as processing
- [x] Skips events already being processed
- [x] Keys expire after TTL

### US04: Agent Dispatch
**As a** worker pool
**I want** to route events to the correct agent
**So that** specialized agents handle their specific tasks

**Acceptance Criteria:**
- [x] Agents registered by type
- [x] Events dispatched by agent_type in metadata
- [x] Unknown agent types produce AGENT_ERROR
- [x] Agent receives context with session/task info

### US05: Completion Events
**As a** worker pool
**I want** to publish AGENT_COMPLETED or AGENT_ERROR events
**So that** the orchestrator knows the execution result

**Acceptance Criteria:**
- [x] AGENT_COMPLETED published on success
- [x] AGENT_ERROR published on failure
- [x] Result includes artifact paths
- [x] Result includes error message when failed

### US06: Concurrency Control
**As a** system operator
**I want** to limit concurrent agent executions
**So that** the system doesn't overload

**Acceptance Criteria:**
- [x] pool_size limits concurrent executions
- [x] Events queue when pool is at capacity
- [x] Metrics show active worker count

### US07: Multi-Tenancy Support
**As a** multi-tenant deployment
**I want** tenant isolation in event processing
**So that** tenants don't interfere with each other

**Acceptance Criteria:**
- [x] Stream names prefixed with tenant ID
- [x] Idempotency keys prefixed with tenant ID
- [x] Context includes tenant_id for agents

### US08: Health and Metrics
**As a** system operator
**I want** to monitor worker pool health
**So that** I can detect and respond to issues

**Acceptance Criteria:**
- [x] Stats show processed/succeeded/failed counts
- [x] Stats show active worker count
- [x] Health check integration works

---

## Definition of Done

- [x] All unit tests pass (124 tests)
- [x] Integration tests pass with mocked Redis (8 tests)
- [x] Manual verification with stub agent
- [x] Linter passes
- [x] Documentation updated
