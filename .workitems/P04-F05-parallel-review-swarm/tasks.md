# P04-F05: Parallel Review Swarm - Task Breakdown

## Task Summary

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Data Models | T01-T03 | 3 hours |
| Phase 2: Redis Storage | T04-T06 | 4 hours |
| Phase 3: Specialized Reviewers | T07-T10 | 5 hours |
| Phase 4: Swarm Dispatcher | T11-T14 | 5 hours |
| Phase 5: Result Aggregator | T15-T17 | 4 hours |
| Phase 6: API Endpoints | T18-T20 | 4 hours |
| Phase 7: Integration Testing | T21-T23 | 4 hours |
| **Total** | **23 tasks** | **29 hours** |

---

## Phase 1: Data Models (Foundation)

### T01: Create Swarm Data Models

**Estimate:** 1 hour
**Dependencies:** None
**User Story:** US-06, US-08

Create data models for swarm sessions, findings, and reports.

**Files:**
- Create `src/workers/swarm/__init__.py`
- Create `src/workers/swarm/models.py`

**Acceptance Criteria:**
- [ ] `SwarmSession` dataclass with all fields
- [ ] `SwarmStatus` enum (PENDING, IN_PROGRESS, AGGREGATING, COMPLETE, FAILED)
- [ ] `ReviewFinding` dataclass with attribution fields
- [ ] `Severity` enum (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- [ ] `ReviewerResult` dataclass
- [ ] `UnifiedReport` dataclass with aggregated fields
- [ ] All models have `to_dict()` and `from_dict()` methods
- [ ] Unit tests for serialization/deserialization

**TDD:**
```python
# Red: Write test first
def test_review_finding_serialization():
    finding = ReviewFinding(
        id="finding-abc123",
        reviewer_type="security",
        severity=Severity.HIGH,
        ...
    )
    data = finding.to_dict()
    restored = ReviewFinding.from_dict(data)
    assert finding == restored
```

---

### T02: Add Swarm Message Types

**Estimate:** 0.5 hours
**Dependencies:** None
**User Story:** US-02

Extend coordination message types for swarm events.

**Files:**
- Modify `src/infrastructure/coordination/types.py`

**Acceptance Criteria:**
- [ ] Add `SWARM_STARTED` message type
- [ ] Add `SWARM_REVIEWER_COMPLETE` message type
- [ ] Add `SWARM_COMPLETE` message type
- [ ] Add `SWARM_FAILED` message type
- [ ] Existing tests still pass

---

### T03: Create Swarm Configuration

**Estimate:** 1.5 hours
**Dependencies:** T01
**User Story:** US-01

Create configuration dataclass for swarm settings.

**Files:**
- Create `src/workers/swarm/config.py`

**Acceptance Criteria:**
- [ ] `SwarmConfig` dataclass with documented fields
- [ ] Default values for all settings
- [ ] `task_timeout_seconds` (default: 300)
- [ ] `aggregate_timeout_seconds` (default: 60)
- [ ] `max_concurrent_swarms` (default: 5)
- [ ] `default_reviewers` (default: ["security", "performance", "style"])
- [ ] `key_prefix` (default: "swarm")
- [ ] `result_ttl_seconds` (default: 86400)
- [ ] `duplicate_similarity_threshold` (default: 0.8)
- [ ] Factory function `get_swarm_config()` with env var overrides
- [ ] Unit tests for configuration loading

---

## Phase 2: Redis Storage Layer

### T04: Implement SwarmRedisStore Core Operations

**Estimate:** 1.5 hours
**Dependencies:** T01, T03
**User Story:** US-08

Implement core Redis storage operations for swarm data.

**Files:**
- Create `src/workers/swarm/redis_store.py`
- Create `tests/unit/workers/swarm/test_redis_store.py`

**Acceptance Criteria:**
- [ ] `SwarmRedisStore` class with Redis client injection
- [ ] `create_session()` stores session hash with TTL
- [ ] `get_session()` retrieves and deserializes session
- [ ] `update_session_status()` atomic status update
- [ ] Key patterns: `swarm:session:{id}`, `swarm:results:{id}`, `swarm:progress:{id}`
- [ ] All operations use pipelines for atomicity
- [ ] Unit tests with mock Redis

**TDD:**
```python
# Red: Write test first
async def test_create_session():
    store = SwarmRedisStore(mock_redis, config)
    session = SwarmSession(id="swarm-abc123", ...)
    await store.create_session(session)

    assert mock_redis.hset.called_with("swarm:session:swarm-abc123", ...)
    assert mock_redis.expire.called_with(..., config.result_ttl_seconds)
```

---

### T05: Implement Result Storage Operations

**Estimate:** 1.5 hours
**Dependencies:** T04
**User Story:** US-08

Implement reviewer result storage and retrieval.

**Files:**
- Modify `src/workers/swarm/redis_store.py`
- Modify `tests/unit/workers/swarm/test_redis_store.py`

**Acceptance Criteria:**
- [ ] `store_reviewer_result()` stores JSON result in hash
- [ ] `get_reviewer_result()` retrieves single result
- [ ] `get_all_results()` retrieves all results for session
- [ ] Progress set updated when result stored
- [ ] `get_completed_reviewers()` returns set of completed types
- [ ] Unit tests for result operations

---

### T06: Implement Completion Waiting

**Estimate:** 1 hour
**Dependencies:** T05
**User Story:** US-02

Implement efficient waiting for swarm completion.

**Files:**
- Modify `src/workers/swarm/redis_store.py`
- Modify `tests/unit/workers/swarm/test_redis_store.py`

**Acceptance Criteria:**
- [ ] `wait_for_completion()` polls progress set
- [ ] Returns True when all expected reviewers complete
- [ ] Returns False on timeout
- [ ] Polling interval is configurable (default: 1s)
- [ ] Uses asyncio.sleep for non-blocking wait
- [ ] Unit tests for completion scenarios

---

## Phase 3: Specialized Reviewers

### T07: Create Reviewer Base Protocol

**Estimate:** 1 hour
**Dependencies:** T01
**User Story:** US-03, US-04, US-05

Define the protocol for specialized reviewers.

**Files:**
- Create `src/workers/swarm/reviewers/__init__.py`
- Create `src/workers/swarm/reviewers/base.py`

**Acceptance Criteria:**
- [ ] `SpecializedReviewer` Protocol class
- [ ] Required properties: `reviewer_type`, `focus_areas`, `severity_weights`
- [ ] Required methods: `get_system_prompt()`, `get_checklist()`
- [ ] `ReviewerRegistry` for registering/retrieving reviewers
- [ ] Unit tests for protocol compliance

---

### T08: Implement Security Reviewer

**Estimate:** 1.5 hours
**Dependencies:** T07
**User Story:** US-03

Implement the security-focused reviewer variant.

**Files:**
- Create `src/workers/swarm/reviewers/security.py`
- Create `tests/unit/workers/swarm/reviewers/test_security.py`

**Acceptance Criteria:**
- [ ] `SecurityReviewer` implements `SpecializedReviewer`
- [ ] `reviewer_type = "security"`
- [ ] `focus_areas` includes: authentication, authorization, input_validation, secrets_exposure, injection_vulnerabilities, cryptography
- [ ] `get_system_prompt()` returns security-focused instructions
- [ ] `get_checklist()` returns security review checklist
- [ ] Severity weights emphasize critical security issues
- [ ] Unit tests for prompt and checklist content

---

### T09: Implement Performance Reviewer

**Estimate:** 1.5 hours
**Dependencies:** T07
**User Story:** US-04

Implement the performance-focused reviewer variant.

**Files:**
- Create `src/workers/swarm/reviewers/performance.py`
- Create `tests/unit/workers/swarm/reviewers/test_performance.py`

**Acceptance Criteria:**
- [ ] `PerformanceReviewer` implements `SpecializedReviewer`
- [ ] `reviewer_type = "performance"`
- [ ] `focus_areas` includes: algorithmic_complexity, memory_usage, database_queries, caching, async_patterns, resource_leaks
- [ ] `get_system_prompt()` returns performance-focused instructions
- [ ] `get_checklist()` returns performance review checklist
- [ ] Severity weights emphasize high-impact issues
- [ ] Unit tests for prompt and checklist content

---

### T10: Implement Style Reviewer

**Estimate:** 1 hour
**Dependencies:** T07
**User Story:** US-05

Implement the style-focused reviewer variant.

**Files:**
- Create `src/workers/swarm/reviewers/style.py`
- Create `tests/unit/workers/swarm/reviewers/test_style.py`

**Acceptance Criteria:**
- [ ] `StyleReviewer` implements `SpecializedReviewer`
- [ ] `reviewer_type = "style"`
- [ ] `focus_areas` includes: naming_conventions, code_organization, documentation, type_hints, error_handling_patterns, test_coverage
- [ ] `get_system_prompt()` returns style-focused instructions
- [ ] `get_checklist()` returns style review checklist
- [ ] Severity weights emphasize maintainability
- [ ] Unit tests for prompt and checklist content

---

## Phase 4: Swarm Dispatcher

### T11: Create Swarm Session Manager

**Estimate:** 1 hour
**Dependencies:** T01, T04
**User Story:** US-01

Implement session lifecycle management.

**Files:**
- Create `src/workers/swarm/session.py`
- Create `tests/unit/workers/swarm/test_session.py`

**Acceptance Criteria:**
- [ ] `SwarmSessionManager` class
- [ ] `create_session()` generates ID and persists to Redis
- [ ] `get_session()` retrieves session by ID
- [ ] `update_status()` transitions session state
- [ ] ID format: `swarm-{uuid8}`
- [ ] Unit tests for session operations

---

### T12: Implement Parallel Task Spawning

**Estimate:** 2 hours
**Dependencies:** T07, T11
**User Story:** US-02

Implement the core parallel dispatch mechanism.

**Files:**
- Create `src/workers/swarm/dispatcher.py`
- Create `tests/unit/workers/swarm/test_dispatcher.py`

**Acceptance Criteria:**
- [ ] `SwarmDispatcher` class
- [ ] `dispatch_swarm()` creates session and spawns tasks
- [ ] Uses `asyncio.gather()` for true parallel execution
- [ ] Each task calls reviewer with specialized prompt
- [ ] Tasks write results to Redis on completion
- [ ] Exception handling preserves other tasks on failure
- [ ] Unit tests with mock reviewers

**TDD:**
```python
# Red: Write test first
async def test_dispatch_spawns_parallel_tasks():
    dispatcher = SwarmDispatcher(...)
    session_id = await dispatcher.dispatch_swarm("src/workers/")

    # Verify all 3 reviewers started within 500ms
    assert len(captured_tasks) == 3
    start_times = [t.start_time for t in captured_tasks]
    assert max(start_times) - min(start_times) < 0.5
```

---

### T13: Implement Result Collection

**Estimate:** 1 hour
**Dependencies:** T12
**User Story:** US-02

Implement result collection after parallel execution.

**Files:**
- Modify `src/workers/swarm/dispatcher.py`
- Modify `tests/unit/workers/swarm/test_dispatcher.py`

**Acceptance Criteria:**
- [ ] `collect_results()` waits for all reviewers
- [ ] Uses `SwarmRedisStore.wait_for_completion()`
- [ ] Returns dict of reviewer_type -> ReviewerResult
- [ ] Handles timeout gracefully (returns partial results)
- [ ] Updates session status to AGGREGATING
- [ ] Unit tests for collection scenarios

---

### T14: Add Coordination Messages

**Estimate:** 1 hour
**Dependencies:** T02, T12
**User Story:** US-02

Publish coordination messages at swarm lifecycle events.

**Files:**
- Modify `src/workers/swarm/dispatcher.py`
- Modify `tests/unit/workers/swarm/test_dispatcher.py`

**Acceptance Criteria:**
- [ ] Publish `SWARM_STARTED` when swarm begins
- [ ] Publish `SWARM_REVIEWER_COMPLETE` when each reviewer finishes
- [ ] Publish `SWARM_COMPLETE` when aggregation finishes
- [ ] Publish `SWARM_FAILED` on failure
- [ ] Messages include swarm_id and relevant metadata
- [ ] Unit tests for message publishing

---

## Phase 5: Result Aggregator

### T15: Implement Basic Aggregation

**Estimate:** 1.5 hours
**Dependencies:** T01
**User Story:** US-06

Implement basic result aggregation without deduplication.

**Files:**
- Create `src/workers/swarm/aggregator.py`
- Create `tests/unit/workers/swarm/test_aggregator.py`

**Acceptance Criteria:**
- [ ] `ResultAggregator` class
- [ ] `aggregate()` combines findings from all reviewers
- [ ] Findings sorted by severity (Critical first)
- [ ] Generates summary statistics (total, by reviewer, by category)
- [ ] Tracks which reviewers completed/failed
- [ ] Returns `UnifiedReport`
- [ ] Unit tests for aggregation

---

### T16: Implement Duplicate Detection

**Estimate:** 1.5 hours
**Dependencies:** T15
**User Story:** US-06

Implement duplicate finding detection and merging.

**Files:**
- Modify `src/workers/swarm/aggregator.py`
- Modify `tests/unit/workers/swarm/test_aggregator.py`

**Acceptance Criteria:**
- [ ] `_detect_duplicates()` identifies similar findings
- [ ] Duplicates detected by: same file + overlapping lines + similar category
- [ ] Text similarity threshold configurable (default 0.8)
- [ ] Merged findings keep highest severity
- [ ] Merged findings list all source reviewers
- [ ] `duplicates_removed` count in report
- [ ] Unit tests for deduplication logic

**TDD:**
```python
# Red: Write test first
def test_merge_duplicate_findings():
    findings = [
        ReviewFinding(reviewer_type="security", file_path="a.py", line_start=10, ...),
        ReviewFinding(reviewer_type="style", file_path="a.py", line_start=10, ...),
    ]
    unique, removed = aggregator._detect_duplicates(findings)
    assert len(unique) == 1
    assert removed == 1
    assert "security" in unique[0].reviewer_type
    assert "style" in unique[0].reviewer_type
```

---

### T17: Integrate Aggregator with Dispatcher

**Estimate:** 1 hour
**Dependencies:** T13, T15, T16
**User Story:** US-06

Wire aggregator into dispatcher flow.

**Files:**
- Modify `src/workers/swarm/dispatcher.py`
- Create `tests/unit/workers/swarm/test_dispatcher_aggregation.py`

**Acceptance Criteria:**
- [ ] Dispatcher calls aggregator after collecting results
- [ ] Updates session with unified_report
- [ ] Updates session status to COMPLETE
- [ ] Handles aggregation errors gracefully
- [ ] Integration tests for full flow

---

## Phase 6: API Endpoints

### T18: Implement Swarm Trigger Endpoint

**Estimate:** 1.5 hours
**Dependencies:** T12
**User Story:** US-01

Create REST endpoint to trigger swarm review.

**Files:**
- Create `src/orchestrator/routes/swarm.py`
- Modify `src/orchestrator/main.py` (register router)
- Create `tests/unit/orchestrator/test_swarm_routes.py`

**Acceptance Criteria:**
- [ ] `POST /api/swarm/review` endpoint
- [ ] Request body: `target_path`, optional `reviewer_types`, optional `timeout_seconds`
- [ ] Response 202: `swarm_id`, `status`, `poll_url`
- [ ] Path validation (must be within project)
- [ ] Rate limiting (max concurrent swarms)
- [ ] OpenAPI documentation
- [ ] Unit tests for endpoint

---

### T19: Implement Swarm Status Endpoint

**Estimate:** 1.5 hours
**Dependencies:** T04, T18
**User Story:** US-07

Create REST endpoint to poll swarm status.

**Files:**
- Modify `src/orchestrator/routes/swarm.py`
- Modify `tests/unit/orchestrator/test_swarm_routes.py`

**Acceptance Criteria:**
- [ ] `GET /api/swarm/review/{swarm_id}` endpoint
- [ ] Response includes status, completed reviewers, pending reviewers
- [ ] When complete: includes unified_report and duration_seconds
- [ ] When failed: includes error_details
- [ ] 404 for unknown swarm_id
- [ ] OpenAPI documentation
- [ ] Unit tests for status scenarios

---

### T20: Add Input Validation and Rate Limiting

**Estimate:** 1 hour
**Dependencies:** T18, T19
**User Story:** US-01

Implement security controls for API endpoints.

**Files:**
- Modify `src/orchestrator/routes/swarm.py`
- Create `src/orchestrator/middleware/rate_limit.py` (if not exists)
- Modify `tests/unit/orchestrator/test_swarm_routes.py`

**Acceptance Criteria:**
- [ ] Path validation: reject paths outside project root
- [ ] Path validation: reject absolute paths
- [ ] Reviewer type validation: only allow known types
- [ ] Rate limit: 5 concurrent swarms per tenant
- [ ] Rate limit response: 429 Too Many Requests
- [ ] Unit tests for validation and rate limiting

---

## Phase 7: Integration Testing

### T21: Integration Test: Redis Operations

**Estimate:** 1 hour
**Dependencies:** T04, T05, T06
**User Story:** US-08

Integration tests for Redis storage layer.

**Files:**
- Create `tests/integration/workers/swarm/test_redis_integration.py`

**Acceptance Criteria:**
- [x] Test session CRUD with real Redis
- [x] Test result storage and retrieval
- [x] Test TTL expiration
- [x] Test atomic operations under concurrent access
- [x] Uses pytest-redis fixture

---

### T22: Integration Test: Parallel Dispatch

**Estimate:** 1.5 hours
**Dependencies:** T12, T13, T14
**User Story:** US-02

Integration tests for parallel task execution.

**Files:**
- Create `tests/integration/workers/swarm/test_parallel_dispatch.py`

**Acceptance Criteria:**
- [x] Test parallel execution timing
- [x] Test partial failure handling
- [x] Test timeout handling
- [x] Test coordination message publishing
- [x] Uses stub reviewers for deterministic behavior

---

### T23: E2E Test: Full Swarm Flow

**Estimate:** 1.5 hours
**Dependencies:** T18, T19, T17
**User Story:** US-01, US-06, US-07

End-to-end test of complete swarm flow.

**Files:**
- Create `tests/integration/workers/swarm/test_swarm_e2e.py`

**Acceptance Criteria:**
- [x] Test: trigger swarm -> poll -> get results
- [x] Test: API response formats
- [x] Test: unified report structure
- [x] Test: failure scenarios via API
- [x] Uses TestClient for FastAPI

---

## Progress Tracking

### Checklist by Phase

**Phase 1: Data Models**
- [x] T01: Create Swarm Data Models
- [x] T02: Add Swarm Message Types
- [x] T03: Create Swarm Configuration

**Phase 2: Redis Storage**
- [x] T04: Implement SwarmRedisStore Core Operations
- [x] T05: Implement Result Storage Operations
- [x] T06: Implement Completion Waiting

**Phase 3: Specialized Reviewers**
- [x] T07: Create Reviewer Base Protocol
- [x] T08: Implement Security Reviewer
- [x] T09: Implement Performance Reviewer
- [x] T10: Implement Style Reviewer

**Phase 4: Swarm Dispatcher**
- [x] T11: Create Swarm Session Manager
- [x] T12: Implement Parallel Task Spawning
- [x] T13: Implement Result Collection
- [x] T14: Add Coordination Messages

**Phase 5: Result Aggregator**
- [x] T15: Implement Basic Aggregation
- [x] T16: Implement Duplicate Detection
- [x] T17: Integrate Aggregator with Dispatcher

**Phase 6: API Endpoints**
- [x] T18: Implement Swarm Trigger Endpoint
- [x] T19: Implement Swarm Status Endpoint
- [x] T20: Add Input Validation and Rate Limiting

**Phase 7: Integration Testing**
- [x] T21: Integration Test: Redis Operations
- [x] T22: Integration Test: Parallel Dispatch
- [x] T23: E2E Test: Full Swarm Flow

---

## Dependency Graph

```
T01 ──► T03 ──► T04 ──► T05 ──► T06
 │              │
 │              └──► T11 ──► T12 ──► T13 ──► T17 ──► T18 ──► T19 ──► T20
 │                           │                │
 └──► T07 ──► T08           └──► T14         └──► T21
      │                                             │
      ├──► T09                                     └──► T22 ──► T23
      │
      └──► T10

T02 ──► T14

T01 ──► T15 ──► T16 ──► T17
```

---

## Notes

- All tasks follow TDD: write failing test first
- Each task produces working, tested code
- Tasks are designed to be completable in < 2 hours
- Phase 1-2 can be done by backend agent
- Phase 3-5 can be parallelized with Phase 6
- Phase 7 depends on all prior phases
