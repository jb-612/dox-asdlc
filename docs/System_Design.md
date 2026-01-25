# aSDLC System Design

**Version:** 1.1  
**Date:** January 21, 2026  
**Status:** Draft  

## 1. Overview

This document specifies the technical architecture for an agentic SDLC system aligned to the aSDLC Master Blueprint:
- Spec Driven Development with Git-first truth
- Explicit HITL gates
- Event-driven orchestration
- Deterministic context injection via Repo Mapper
- Selective RLM execution mode for long-context tasks
- Bash-first tool abstraction with a replacement path to MCP or enterprise tool services

## 2. Core principles

1. **Git is authoritative**
   - Specs, decisions, patches, and evidence are committed.
   - Runtime state references Git SHA.

2. **Governance is isolated**
   - Only the orchestrator and governance runtime can write to protected branches.

3. **Agents are specialized and isolated**
   - Each agent invocation runs with a fresh session.
   - Workspaces are isolated per role to prevent context bleed.

4. **Tools are mediated**
   - Agents can only act through approved tools (bash wrappers, Git operations, KnowledgeStore).

5. **Evidence required**
   - No gate advancement without artifacts and evidence bundles.

## 3. High-level component model

- **Orchestrator and Governance**
  - Manager Agent (exclusive commit gateway and state machine owner)
  - HITL dispatcher and decision logger
  - Repo Mapper service (deterministic context packs)
  - Data Insight metrics aggregator

- **Agent Worker Pool**
  - Stateless execution of domain agents (Discovery, Design, Development, Validation, Deployment).
  - Horizontal scaling by adding more workers.

- **Infrastructure Services**
  - Redis for event streams and task state caches
  - KnowledgeStore for retrieval augmentation
  - Tool execution sandbox

- **HITL Web UI**
  - Displays gate requests and evidence
  - Records approvals and rejections

## 4. Container topology

### 4.1 Production topology (five containers)

1. **Container 1: Orchestrator and Governance**
   - Runs Manager Agent and governance services
   - Has exclusive Git write access to protected branches
   - Consumes Redis Streams and dispatches work
   - Writes gate decisions and merges patches

2. **Container 2: Agent Workers**
   - Stateless worker pool running Claude Agent SDK queries
   - Each request includes a role, allowed tools, and a context pack
   - No protected branch write access

3. **Container 3: Redis State Manager**
   - Redis for event streams (asdlc:events)
   - Task and session state caches (hashes)
   - Coordination and pub/sub

4. **Container 4: KnowledgeStore (RAG)**
   - Elasticsearch for vector search with kNN
   - Abstract KnowledgeStore interface
   - Replaceable with enterprise services (OpenSearch, Azure AI Search)

5. **Container 5: HITL Web UI**
   - Gate request viewer and evidence explorer
   - Approval pushes responses back to Redis Streams
   - Authentication and audit logging

### 4.2 Prototype option

For a local prototype, Container 1 and Container 2 may be merged if Git branch protections and credentials are enforced by local policy. Production should keep Governance isolated.

### 4.3 Kubernetes deployment model

The system can be deployed to Kubernetes using Helm charts. This deployment model provides:
- Namespace isolation (`dox-asdlc`)
- StatefulSets for stateful services (Redis, Elasticsearch)
- Deployments for stateless services (Orchestrator, Workers, HITL-UI)
- HorizontalPodAutoscaler for worker scaling
- ConfigMaps for environment configuration
- Secrets for credentials management

**Namespace:** `dox-asdlc`

All resources are deployed in a single namespace for logical isolation and simplified RBAC.

**StatefulSets:**
- `redis` - Event streaming and state cache (1 replica)
- `elasticsearch` - KnowledgeStore backend with kNN vector search (1 replica)

Both use PersistentVolumeClaims for data durability.

**Deployments:**
- `orchestrator` - Governance services (1 replica, exclusive Git credentials)
- `workers` - Agent execution pool (2-10 replicas via HPA)
- `hitl-ui` - Approval interface (1 replica, NodePort for external access)

**Services:**
- ClusterIP services for internal communication
- NodePort for HITL-UI external access (minikube)
- HTTP only; TLS termination handled externally

**Helm chart structure:**
```
helm/dox-asdlc/
├── Chart.yaml
├── values.yaml
├── values-minikube.yaml
└── charts/
    ├── redis/
    ├── elasticsearch/
    ├── orchestrator/
    ├── workers/
    └── hitl-ui/
```

## 5. Data and artifact model

### 5.1 Git repository layout

Recommended layout:

- `/spec/`
  - `spec_index.md`
  - `/epics/<epic_id>/product_reqs.md`
  - `/epics/<epic_id>/test_specs.md`
  - `/epics/<epic_id>/architecture.md`
  - `/epics/<epic_id>/tasks.md`
  - `/epics/<epic_id>/decision_log.md`
- `/context/`
  - `ast_context.json`
  - `/packs/<task_id>.json`
- `/engineering/`
  - `/patches/<task_id>.patch`
  - `/reports/review_<task_id>.md`
  - `/reports/security_<task_id>.md`
  - `/reports/validation_<task_id>.md`
- `/telemetry/`
  - `/runs/<run_id>.json`
  - `/rlm/<run_id>.json`
  - `metrics.csv`

### 5.2 RLM-enabled exploration (native implementation)

RLM is enabled for tasks that exceed practical context limits or require multi-file dependency reasoning.

**Enabled agents**
- Repo Mapper
- Arch Surveyor
- Debugger
- Validation

**Trigger conditions**
- Context requirement exceeds 100K tokens equivalent, or
- Multi-file dependency tracing required, or
- Debugger is triggered by fail_count > 4

**REPL tool surface**
RLM runs against a restricted environment exposing filesystem and analysis primitives, for example:
- list_files, grep, read_file ranges
- extract_symbols, parse_ast (language-specific)
- llm_query for sub-model calls with strict budgets

**Cost and safety controls**
- max_subcalls per task (default 50)
- max_subcalls per iteration (default 8)
- hard wall time limit
- caching subcall results by prompt hash
- no network access
- allowlist of imports and commands

**Audit trail**
Every RLM run produces an audit artifact:
- query, context stats, tool usage
- subcall count, cached hits
- exploration trajectory
- citations to files and line ranges

### 5.3 Knowledge Store abstraction (RAG)

The prototype includes a retrieval layer for:
- semantic search over specs and decisions
- lookup of legacy docs and reference material
- optional augmentation for agent prompts

**Interface contract**
- `index_document(doc_id, content, metadata) -> bool`
- `search(query, top_k, filters) -> list[SearchResult]`
- `get_by_id(doc_id) -> Document | None`
- `delete(doc_id) -> bool`

**Default backend**
- Single-container Elasticsearch with kNN vector search.
- All access routed through the KnowledgeStore interface, not direct backend calls.

**Enterprise replacement path**
- OpenSearch (AWS-managed)
- Google Vertex AI Search
- Azure AI Search

Migration requires only implementing the interface; agent prompts and orchestrator contracts remain stable.

## 6. Eventing and state (Redis)

### 6.1 Streams

- `asdlc:events` stream with consumer groups per handler class.
- Events include: `session_id`, `epic_id`, `task_id`, `event_type`, `git_sha`, `artifact_paths`, `mode`.

### 6.2 Hashes and caches

- `asdlc:task:<task_id>` hash stores runtime counters and state, including `fail_count`.
- `asdlc:session:<session_id>` stores pointers to current Git SHA and in-flight epics.

Redis data is considered a cache and coordination layer. Git is authoritative.

## 7. Tool execution

### 7.1 Tool execution layer (bash-first)

All engineering tools are bash wrappers with a standardized contract:
- stdout is JSON: `{"success": true|false, "results": [...], "errors": [...]}`
- exit code 0 indicates wrapper execution success, not necessarily a pass result

Examples:
- `./tools/lint.sh <path>`
- `./tools/test.sh <path>`
- `./tools/sast.sh`
- `./tools/sca.sh`
- `./tools/ast.sh <path>`

Agents reference tool names and contracts. Implementation can change (eslint to biome, pytest flags, semgrep config) without prompt changes.

### 7.2 Migration path to MCP

When moving to typed tool services:
- Keep tool names stable.
- Replace bash wrappers with MCP servers implementing equivalent contracts.
- Orchestrator switches tool registry configuration, not agent logic.

## 8. Recovery and idempotency

### 8.1 Redis recovery protocol

On orchestrator restart:

1. Read `spec_index.md` and relevant epic artifacts from Git HEAD to establish ground truth.
2. Inspect pending events in Redis consumer groups (XPENDING).
3. For each pending event:
   - Check if the expected Git artifact already exists for the event.
   - If yes: acknowledge and skip (idempotency).
   - If no: re-dispatch the work to the appropriate agent and continue.
4. Rehydrate task hashes from Git artifacts:
   - fail_count defaults to 0 unless a run log indicates otherwise.
   - task state inferred from presence of patches, reports, and decisions.
5. Resume normal consumption.

This ensures correctness even if Redis loses data.

### 8.2 Idempotent processing

Handlers must be idempotent:
- Never apply the same patch twice.
- Never advance a gate twice for the same Git SHA.
- Deduplicate events by `event_id`.

## 9. Security and permissions

- Only Container 1 holds credentials for protected branch merge.
- Tool allowlist per agent role.
- No network access in tool sandbox by default.
- Secrets injection restricted to orchestrator container and CI.

## 10. Observability

- `telemetry/runs/<run_id>.json` records: agent, inputs, outputs, tool calls, timings.
- `telemetry/rlm/<run_id>.json` records RLM trajectory and costs.
- `telemetry/metrics.csv` aggregates per-agent counters and failure reasons.

## 11. End-to-end workflow summary

1. Intent arrives and an epic is created.
2. Discovery agents produce PRD and acceptance specs.
3. HITL 1 approves backlog.
4. Design agents survey and define architecture, then HITL 2 approves.
5. Planner produces task plan, HITL 3 approves.
6. Development TDD loop runs: tests first, patch, run tests, review, HITL 4.
7. Validation runs integration and security scans, then HITL 5.
8. Release Mgmt produces release notes and deployment plan, HITL 6.
9. Deployment executes and monitoring validates health.

## 12. Open design decisions

- Standard schema for context packs across languages.
- Strategy for merge conflicts across parallel patches.
- RLM trigger thresholds tuned per repo size and language.

## 13. Multi-tenancy model

The system supports multi-tenancy for shared deployments serving multiple organizations.

### 13.1 Tenant identification

Tenants are identified via:
- HTTP header `X-Tenant-ID` on incoming requests
- Event payload `tenant_id` field for async processing
- Environment variable `DEFAULT_TENANT_ID` for single-tenant deployments

### 13.2 Data isolation

**Redis key prefixing:**
```
tenant:{tenant_id}:asdlc:events
tenant:{tenant_id}:asdlc:task:{task_id}
tenant:{tenant_id}:asdlc:session:{session_id}
```

**KnowledgeStore collection naming:**
```
{tenant_id}_asdlc_documents
{tenant_id}_asdlc_specs
```

### 13.3 Context propagation

Tenant context is propagated using Python's `contextvars`:
- Middleware extracts tenant from `X-Tenant-ID` header
- Context is set before request processing
- All downstream operations use current tenant context
- Event consumers extract tenant from event payload

### 13.4 Security

- Tenant IDs are validated against an allowlist (`ALLOWED_TENANTS`)
- Invalid tenant requests are rejected with HTTP 403
- Audit logging tracks all tenant context switches
- No cross-tenant data access is possible at the application layer

### 13.5 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MULTI_TENANCY_ENABLED` | `false` | Enable multi-tenancy |
| `DEFAULT_TENANT_ID` | `default` | Default tenant for single-tenant mode |
| `ALLOWED_TENANTS` | `*` | Comma-separated tenant allowlist or `*` for any |

### 13.6 HITL-UI tenant selector

The HITL Web UI includes a tenant selector:
- Dropdown populated from allowed tenants list
- Selection persisted in browser session
- All API requests include `X-Tenant-ID` header
- Gate requests filtered to current tenant only

## 14. Plane CE Integration

Plane Community Edition is deployed as a companion service for project and task management.

### 14.1 Deployment architecture

Plane CE runs in a separate namespace (`plane-ce`) from the main aSDLC system (`dox-asdlc`):

```
Kubernetes Cluster
├── dox-asdlc namespace
│   ├── orchestrator
│   ├── workers
│   ├── hitl-ui
│   ├── redis
│   └── elasticsearch
└── plane-ce namespace
    ├── plane-app-web
    ├── plane-app-api
    ├── plane-app-worker
    ├── plane-app-beat-worker
    ├── postgresql
    ├── redis
    ├── minio
    └── rabbitmq
```

### 14.2 Rationale for separate namespace

1. **Independent dependencies**: Plane CE has its own PostgreSQL, Redis, MinIO, and RabbitMQ
2. **Lifecycle isolation**: Upgrade/rollback Plane without affecting aSDLC runtime
3. **Resource isolation**: Separate resource quotas and limits
4. **Official Helm chart**: Uses tested configurations from Plane maintainers

### 14.3 Deployment commands

```bash
# Deploy Plane CE only
./scripts/k8s/deploy-plane.sh

# Deploy aSDLC with Plane CE
./scripts/k8s/deploy.sh --with-plane

# Remove Plane CE
./scripts/k8s/teardown-plane.sh
```

### 14.4 Access

For minikube deployments, Plane CE is accessed via NodePort:

```bash
minikube service plane-app-web -n plane-ce --url
```

### 14.5 Resource requirements

Plane CE adds the following resource requirements to minikube:
- Additional 2 CPUs recommended
- Additional 2GB RAM recommended
- ~5GB persistent storage (PostgreSQL, Redis, MinIO)

Minimum minikube configuration with Plane CE: 4 CPUs, 8GB RAM
