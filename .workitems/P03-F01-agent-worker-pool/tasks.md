# P03-F01: Agent Worker Pool Framework - Tasks

## Task Breakdown

### Configuration & Protocols
- [x] **T01: Worker Configuration** - `src/workers/config.py`
  - WorkerConfig dataclass (pool size, batch size, timeouts)
  - Environment variable loading
  - Validation

- [x] **T02: Agent Protocols** - `src/workers/agents/protocols.py`
  - AgentResult dataclass
  - AgentContext dataclass
  - BaseAgent protocol

### Event Processing
- [x] **T03: Event Consumer** - `src/workers/pool/event_consumer.py`
  - Read AGENT_STARTED from Redis Streams
  - Filter for relevant events
  - Acknowledge processed events
  - Tenant-aware stream names

- [x] **T04: Idempotency Tracker** - `src/workers/pool/idempotency.py`
  - Prevent duplicate event processing
  - Atomic check-and-mark operation
  - TTL for key expiration

### Agent Framework
- [x] **T05: Agent Dispatcher** - `src/workers/agents/dispatcher.py`
  - Route events to agents by type
  - Agent registration
  - Validation and cleanup hooks

- [x] **T06: Stub Agent** - `src/workers/agents/stub_agent.py`
  - Test agent with configurable behavior
  - Success/failure configuration
  - Delay simulation

### Artifacts
- [x] **T07: Context Loader** - `src/workers/artifacts/context_loader.py`
  - Load context packs from filesystem
  - Validate context pack structure
  - Handle missing files

- [x] **T08: Artifact Writer** - `src/workers/artifacts/writer.py`
  - Write patches and reports
  - Directory structure management
  - Multiple artifact types

### LLM Integration
- [x] **T09: LLM Client Stub** - `src/workers/llm/client.py`
  - Interface for Claude SDK (stub implementation)
  - LLMResponse dataclass
  - Configurable responses for testing

### Worker Pool Core
- [x] **T10: Worker Pool** - `src/workers/pool/worker_pool.py`
  - start(), stop(), concurrency semaphore
  - State management

- [x] **T11: Event Loop** - `src/workers/pool/worker_pool.py`
  - Main processing loop with error handling
  - Graceful shutdown

- [x] **T12: Event Publisher** - `src/workers/pool/worker_pool.py`
  - Publish AGENT_COMPLETED / AGENT_ERROR

### Integration
- [x] **T13: Main Entry Point** - `src/workers/main.py`
  - Integrate WorkerPool with health server
  - Signal handling
  - Startup sequence

- [x] **T14: Integration Tests** - `tests/integration/test_worker_event_cycle.py`
  - Full event cycle with real Redis
  - End-to-end verification

---

## Progress

- Started: 2026-01-22
- Tasks Complete: 14/14
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

---

## File Structure

```
src/workers/
├── main.py                     # UPDATE: Add WorkerPool startup
├── config.py                   # NEW: Worker configuration
├── pool/
│   ├── __init__.py
│   ├── worker_pool.py          # NEW: Concurrency management
│   ├── event_consumer.py       # NEW: Redis event reading
│   └── idempotency.py          # NEW: Duplicate detection
├── agents/
│   ├── __init__.py
│   ├── protocols.py            # NEW: BaseAgent protocol
│   ├── dispatcher.py           # NEW: Agent routing
│   └── stub_agent.py           # NEW: Test agent
├── artifacts/
│   ├── __init__.py
│   ├── writer.py               # NEW: Artifact output
│   └── context_loader.py       # NEW: Context pack reading
└── llm/
    ├── __init__.py
    └── client.py               # NEW: LLM client stub
```

---

## Verification

1. **Unit Tests:** Run `pytest tests/unit/workers/` - all pass
2. **Integration Tests:** Run `pytest tests/integration/test_worker_event_cycle.py` with Docker Redis
3. **Manual Test:**
   ```bash
   # Terminal 1: Start workers
   python -m src.workers.main

   # Terminal 2: Publish test event
   python -c "
   import asyncio
   from src.infrastructure.redis_streams import publish_event_model
   from src.core.events import ASDLCEvent, EventType
   from datetime import datetime, timezone

   event = ASDLCEvent(
       event_type=EventType.AGENT_STARTED,
       session_id='test-session',
       task_id='test-task',
       timestamp=datetime.now(timezone.utc),
       metadata={'agent_type': 'stub'}
   )
   asyncio.run(publish_event_model(event, 'default'))
   "

   # Verify AGENT_COMPLETED event published
   ```
4. **Linter:** `./tools/lint.sh src/workers/`
5. **Health Check:** `curl http://localhost:8081/health`
