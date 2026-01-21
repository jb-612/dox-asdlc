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

### 4.1 Production topology (four containers)

1. **Container 1: Orchestrator and Governance**
   - Runs Manager Agent and governance services
   - Has exclusive Git write access to protected branches
   - Consumes Redis Streams and dispatches work
   - Writes gate decisions and merges patches

2. **Container 2: Agent Workers**
   - Stateless worker pool running Claude Agent SDK queries
   - Each request includes a role, allowed tools, and a context pack
   - No protected branch write access

3. **Container 3: Infrastructure Services**
   - Redis (Streams, Hashes, optional JSON caches)
   - KnowledgeStore prototype backend (ChromaDB or Qdrant)
   - Tool execution sandbox if separated from workers

4. **Container 4: HITL Web UI**
   - Gate request viewer and evidence explorer
   - Approval pushes responses back to Redis Streams
   - Authentication and audit logging

### 4.2 Prototype option

For a local prototype, Container 1 and Container 2 may be merged if Git branch protections and credentials are enforced by local policy. Production should keep Governance isolated.

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

**Prototype backend**
- Single-container ChromaDB or Qdrant.
- All access routed through the KnowledgeStore interface, not direct backend calls.

**Enterprise replacement path**
- Elasticsearch or OpenSearch
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
