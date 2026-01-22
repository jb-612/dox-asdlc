# P03-F01: Agent Worker Pool Framework - Technical Design

## Overview

Implement the worker pool framework that consumes `AGENT_STARTED` events from Redis Streams, executes agents, and publishes completion/error events. This bridges the orchestrator (P02) to domain agents (P04).

## Architecture

```
Orchestrator → AGENT_STARTED → Redis Streams → WorkerPool → AgentDispatcher → Agent → AGENT_COMPLETED
```

## Components

### 1. WorkerPool (`src/workers/pool/worker_pool.py`)
- Manages concurrent agent execution with asyncio semaphore
- Handles lifecycle: start(), stop(), graceful shutdown
- Coordinates event consumption, dispatching, and publishing
- Tracks metrics (processed, succeeded, failed counts)

### 2. EventConsumer (`src/workers/pool/event_consumer.py`)
- Reads AGENT_STARTED events from Redis Streams consumer group
- Filters for events relevant to worker pool
- Supports tenant-aware stream names
- Handles event acknowledgment

### 3. WorkerIdempotencyTracker (`src/workers/pool/idempotency.py`)
- Prevents duplicate event processing
- Uses Redis SET NX for atomic check-and-mark
- Supports TTL for key expiration

### 4. AgentDispatcher (`src/workers/agents/dispatcher.py`)
- Routes events to appropriate agent by type
- Manages agent registration
- Calls validation and cleanup hooks if agents implement them

### 5. BaseAgent Protocol (`src/workers/agents/protocols.py`)
- Defines agent interface: agent_type, execute()
- AgentResult dataclass for execution results
- AgentContext dataclass for execution context

### 6. StubAgent (`src/workers/agents/stub_agent.py`)
- Test agent with configurable behavior
- Used for framework validation

### 7. ContextLoader (`src/workers/artifacts/context_loader.py`)
- Loads context packs from filesystem
- Validates context pack structure

### 8. ArtifactWriter (`src/workers/artifacts/writer.py`)
- Writes patches and reports to workspace
- Manages artifact directory structure

### 9. LLMClient (`src/workers/llm/client.py`)
- Interface for Claude SDK integration
- StubLLMClient for testing (full impl in P03-F03)

## Event Flow

1. WorkerPool.start() begins event loop
2. EventConsumer reads batch of events from Redis
3. For each AGENT_STARTED event:
   a. Check idempotency (skip if duplicate)
   b. Build AgentContext
   c. Dispatch to registered agent
   d. Publish AGENT_COMPLETED or AGENT_ERROR
   e. Acknowledge original event
4. Loop continues until stop() is called

## Configuration

WorkerConfig dataclass:
- pool_size: Max concurrent agents (default: 4)
- batch_size: Events per batch (default: 10)
- event_timeout_seconds: Agent timeout (default: 300)
- shutdown_timeout_seconds: Graceful shutdown wait (default: 30)
- consumer_group: Redis consumer group (default: development-handlers)
- consumer_name: Unique consumer instance name

## Dependencies

### Reuses from existing code:
- `src/core/events.py` - ASDLCEvent, EventType
- `src/infrastructure/redis_streams.py` - Stream operations
- `src/core/tenant.py` - TenantContext for multi-tenancy
- `src/infrastructure/health.py` - HealthChecker

### Consumer Group
Uses `development-handlers` group defined in `src/core/config.py`

## Error Handling

- Agent exceptions: Caught, logged, AGENT_ERROR published
- Unknown agent type: AgentNotFoundError, AGENT_ERROR published
- Redis errors: Logged, retried with backoff
- Shutdown: Wait for active tasks, timeout with cancellation

## Multi-Tenancy

- Stream names prefixed with tenant ID when enabled
- Idempotency keys prefixed with tenant ID
- Context includes tenant_id for agents to use
