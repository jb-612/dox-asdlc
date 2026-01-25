# The Coordinator - Demystified

## What is the Coordinator?

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          THE COORDINATOR - DEMYSTIFIED                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   ❌ NOT Camunda (no BPMN, no workflow engine)                                       │
│   ❌ NOT a cron job (not scheduled, event-driven)                                    │
│   ❌ NOT an AI agent (no Claude, no LLM)                                             │
│   ❌ NOT Claude TodoList (that's for inside agents)                                  │
│   ❌ NOT Temporal/Airflow (no complex orchestration framework)                       │
│                                                                                      │
│   ✅ IT IS: A simple Python service with a while True loop                          │
│                                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────────────┐│
│   │                                                                                 ││
│   │   coordinator/main.py (~200 lines)                                             ││
│   │                                                                                 ││
│   │   while True:                                                                  ││
│   │       events = await redis.xread(streams, block=5000)  # WAIT for events       ││
│   │       for event in events:                                                     ││
│   │           if event.type == "PhaseCompleted":                                   ││
│   │               if WORKFLOW[phase].transition == AUTO:                           ││
│   │                   k8s.create_job(next_agent)  # ← IGNITE next agent           ││
│   │               else:                                                            ││
│   │                   redis.publish("hitl:request")  # Wait for human             ││
│   │                                                                                 ││
│   └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│   Deployed as: Kubernetes Deployment (1 replica, always running)                    │
│   Runtime: Python 3.11 + redis-py + kubernetes-client                               │
│   Resources: 256MB RAM, 0.1 CPU (tiny!)                                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## How It "Ignites" the Next Agent

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         HOW COORDINATOR IGNITES AGENTS                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Step 1: Dev Agent finishes and publishes to Redis                                  │
│   ─────────────────────────────────────────────────                                  │
│                                                                                      │
│   ┌─────────────────┐                                                               │
│   │  Dev Agent      │                                                               │
│   │  Container      │                                                               │
│   │                 │                                                               │
│   │  # On complete: │                                                               │
│   │  redis.xadd(    │─────────────────────────────────────────┐                    │
│   │    "asdlc:phase:development",                              │                    │
│   │    {"event": "PhaseCompleted", "status": "success"}        │                    │
│   │  )              │                                          │                    │
│   │                 │                                          │                    │
│   │  exit(0)        │                                          │                    │
│   └─────────────────┘                                          │                    │
│          ║                                                     │                    │
│          ║ Container exits                                     │                    │
│          ╚══════════════╗                                      │                    │
│                         ║                                      │                    │
│                         ▼                                      ▼                    │
│                    [GONE]                             ┌─────────────────┐           │
│                                                       │  Redis Stream   │           │
│                                                       │                 │           │
│                                                       │  development:   │           │
│                                                       │  PhaseCompleted │           │
│                                                       │  status: success│           │
│                                                       └─────────────────┘           │
│                                                                │                    │
│   Step 2: Coordinator receives event (was blocking on xread)   │                    │
│   ──────────────────────────────────────────────────────────   │                    │
│                                                                │                    │
│   ┌─────────────────────────────────────────────────────────┐  │                    │
│   │  Coordinator (always running)                            │  │                    │
│   │                                                          │  │                    │
│   │  events = await redis.xread(block=5000)  ◀───────────────┘                    │
│   │                                                          │                      │
│   │  # Event received!                                       │                      │
│   │  phase = "development"                                   │                      │
│   │  next_phase = WORKFLOW["development"]["next"]  # = "test"│                      │
│   │  transition = WORKFLOW["development"]["transition"]  # = AUTO                  │
│   │                                                          │                      │
│   │  if transition == AUTO:                                  │                      │
│   │      # IGNITE! ──────────────────────────────────────────│───────┐             │
│   │      k8s.create_job(phase="test", epic_id=...)           │       │             │
│   │                                                          │       │             │
│   └─────────────────────────────────────────────────────────┘       │             │
│                                                                      │             │
│   Step 3: Kubernetes creates the Test Agent container                │             │
│   ─────────────────────────────────────────────────────              │             │
│                                                                      │             │
│   ┌─────────────────┐                                                │             │
│   │  Kubernetes     │◀───────────────────────────────────────────────┘             │
│   │  API Server     │                                                              │
│   │                 │                                                              │
│   │  Receives:      │                                                              │
│   │  POST /apis/batch/v1/namespaces/asdlc/jobs                                    │
│   │  {                │                                                            │
│   │    name: "agent-test-abc123",                                                 │
│   │    image: "asdlc/agent:latest",                                               │
│   │    env: {AGENT_TYPE: "test", TASK_JSON: "..."}                               │
│   │  }              │                                                              │
│   │                 │                                                              │
│   │  Creates Job ───│─────────────────────────────────────────┐                    │
│   └─────────────────┘                                         │                    │
│                                                               │                    │
│   Step 4: Test Agent starts running                           │                    │
│   ─────────────────────────────────                           │                    │
│                                                               ▼                    │
│                                                    ┌─────────────────┐             │
│                                                    │  Test Agent     │             │
│                                                    │  Container      │             │
│                                                    │                 │             │
│                                                    │  Starting...    │             │
│                                                    │  Running tests  │             │
│                                                    │  ...            │             │
│                                                    └─────────────────┘             │
│                                                                                      │
│   TIME FROM DEV COMPLETE TO TEST START: ~2-5 seconds (K8s scheduling)              │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Complete System View

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  COMPLETE SYSTEM ARCHITECTURE                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   ALWAYS RUNNING (K8s Deployments)                                                                   │
│   ════════════════════════════════                                                                   │
│                                                                                                      │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│   │  Coordinator    │    │  HITL Gateway   │    │  Redis          │    │  SPA (Next.js)  │         │
│   │  (Python)       │    │  (FastAPI)      │    │  (Streams)      │    │                 │         │
│   │                 │    │                 │    │                 │    │                 │         │
│   │  while True:    │    │  REST API       │    │  Event bus      │    │  User interface │         │
│   │    xread()      │    │  WebSocket      │    │  Pub/Sub        │    │  HITL actions   │         │
│   │    spawn job    │    │                 │    │                 │    │                 │         │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                      │                      ▲                      │                    │
│           │                      │                      │                      │                    │
│           │   K8s API            │   Redis              │   Redis              │   REST/WS          │
│           │   create_job()       │   pub/sub            │   xadd()             │                    │
│           ▼                      ▼                      │                      ▼                    │
│   ┌─────────────────────────────────────────────────────┴──────────────────────────────────────┐   │
│   │                                                                                             │   │
│   │                          EPHEMERAL (K8s Jobs - spawn and die)                              │   │
│   │                                                                                             │   │
│   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │   │
│   │   │  Discovery  │───▶│   Design    │───▶│ Development │───▶│    Test     │───▶ ...        │   │
│   │   │  Agent Job  │HITL│  Agent Job  │HITL│  Agent Job  │AUTO│  Agent Job  │AUTO            │   │
│   │   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘                │   │
│   │                                                                                             │   │
│   │   Each Job:                                                                                │   │
│   │   • Runs Claude Code CLI (Agent SDK)                                                       │   │
│   │   • Streams progress to Redis                                                              │   │
│   │   • Publishes "PhaseCompleted" on finish                                                   │   │
│   │   • Exits (container dies)                                                                 │   │
│   │                                                                                             │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                      │
│   ═══════════════════════════════════════════════════════════════════════════════════════════════   │
│                                                                                                      │
│   A2A FLOW (Automatic):                                                                              │
│   Dev completes → Redis event → Coordinator receives → Coordinator spawns Test Job                  │
│                                                                                                      │
│   HITL FLOW (Human approval):                                                                        │
│   Design completes → Redis event → Coordinator publishes HITL request →                             │
│   HITL Gateway shows in SPA → Human approves → Redis event →                                        │
│   Coordinator receives → Coordinator spawns Dev Job                                                  │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Summary

| Question | Answer |
|----------|--------|
| **What is the Coordinator?** | A Python service (~200 lines) with `while True` + `redis.xread()` |
| **How does it ignite agents?** | Calls `k8s_client.create_namespaced_job()` to create K8s Job |
| **Is it Camunda?** | No, way simpler - just Python code |
| **Is it a cron?** | No, it's event-driven (blocks on Redis) |
| **Is it Claude/AI?** | No, it's regular Python, no LLM involved |
| **How is it deployed?** | K8s Deployment, 1 replica, always running |
| **Resources needed?** | Tiny: 256MB RAM, 0.1 CPU |

## The Core Loop

The Coordinator is literally just:

```python
while True:
    events = await redis.xread(block=5000)  # Wait for events
    for event in events:
        if should_auto_transition(event):
            k8s.create_job(next_agent)  # This is the "ignite"
```

## Why Not Use Camunda/Temporal/Airflow?

| Framework | Overhead | Our Need |
|-----------|----------|----------|
| Camunda | BPMN modeling, process engine, database | Simple event routing |
| Temporal | Workflow definitions, replay, persistence | Just spawn containers |
| Airflow | DAG scheduling, web UI, metadata DB | Event-driven, not scheduled |

**Our workflow is simple:**
1. Agent completes → publishes event
2. Coordinator reads event → spawns next agent
3. Repeat

No need for complex workflow engines. A `while True` loop with Redis is sufficient.

## Key Design Principles

### 1. Event-Driven, Not Scheduled
```python
# NOT this (cron-style):
schedule.every(5).minutes.do(check_for_work)

# THIS (event-driven):
events = await redis.xread(block=5000)  # Blocks until event arrives
```

### 2. Stateless Coordinator
- No database needed in Coordinator
- All state is in Redis streams
- Coordinator can restart anytime without losing work

### 3. Ephemeral Agents
- Agents are K8s Jobs, not Deployments
- They run, complete, and die
- New context = new container (no session management complexity)

### 4. Redis as Event Bus
- Streams for ordered events (`xadd`, `xread`)
- Pub/Sub for real-time notifications
- No need for Kafka, RabbitMQ, etc.

## Deployment

```yaml
# Coordinator: Always running, tiny footprint
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coordinator
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: coordinator
          image: asdlc/coordinator:latest
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
```

```yaml
# Agents: Ephemeral Jobs, spawned on demand
apiVersion: batch/v1
kind: Job
metadata:
  name: agent-test-abc123
spec:
  ttlSecondsAfterFinished: 3600  # Auto-cleanup
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: agent
          image: asdlc/agent:latest
          env:
            - name: AGENT_TYPE
              value: "test"
            - name: TASK_JSON
              value: '{"epic_id": "...", "spec": "..."}'
```
