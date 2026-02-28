# Phase Descriptions: P08, P12, P15

## P08 — MindFlare Ideation Hub

**Goal**: Idea capture and intelligence platform — from raw 144-word ideas through classification, correlation, and graph visualization, with Slack as the primary input channel.

**Completed** (F03): Auto-classification engine categorizes ideas as functional vs non-functional requirements using LLM.

### Remaining Work

**F01 Ideas Repository Core**: Foundational storage for short-form ideas (<=144 words) with full-text search, vector embeddings, and CRUD operations.
- Acceptance: Ideas stored with embeddings, full-text search returns ranked results

**F02 Slack HITL Bridge**: System-wide Slack adapter for ALL HITL gates. Durable message delivery, approve/reject buttons, thread-based context.
- Depends on: P05-F01
- Acceptance: All gate types route through Slack, decisions flow back to workflow

**F04 Correlation Engine**: Vector similarity + graph relationships to find similar, complementary, or duplicate ideas. Powers the "related ideas" feature.
- Depends on: P08-F01
- Acceptance: Similar ideas ranked by relevance, duplicates detected

**F05 MindFlare Hub UI**: Twitter-style ideas list with filtering, correlation display, and idea submission.
- Depends on: P08-F01, P08-F04
- Acceptance: Ideas list with real-time updates, filter by category/status

**F06 Snowflake Graph MVP**: Force-directed graph visualization showing ideas and their correlations as interactive nodes/edges.
- Depends on: P08-F04
- Acceptance: Graph renders with drag, zoom, click-to-inspect

**F07 Snowflake Graph Enhanced**: FUTURE — advanced graph features (clustering, time animation, export). Not for immediate implementation.

**F08 Slack Bidirectional HITL**: Generalize Slack bridge from approve/reject into rich agent-human communication channel with threaded conversations.
- Depends on: P08-F02
- Acceptance: Agents can ask follow-up questions via Slack, humans respond in-thread

---

## P12 — Developer Experience

**Goal**: Close gaps from the Guardrails Constitution audit — enforce TDD separation, add cost controls, improve traceability, formalize workflow orchestration, and enhance HITL.

### Features

**F01 TDD Separation**: Agent-level separation of test-writing, code-writing, and debugging. Test-writer and code-writer must be different agents.
- Acceptance: Hook blocks wrong agent from writing wrong file type

**F02 Token Budget Circuit Breaker**: Prevent runaway agent behavior with token budget enforcement and circuit breaker that trips on excessive consumption.
- Acceptance: Agent halted when budget exceeded, circuit breaker resets after cooldown

**F03 CoT Persistence & Lineage**: Chain-of-thought persistence and artifact lineage tracking for forensic traceability across agent decisions.
- Acceptance: CoT stored per decision, lineage graph queryable

**F04 DAG Orchestration & Clusters**: Replace linear 11-step workflow with DAG-based orchestration. Formalize 5 logical clusters (C1-C5) for parallel execution.
- Acceptance: DAG engine executes clusters in parallel where deps allow

**F05 Spec-Driven Development**: Enhance work items to support SDD & GitOps for agents. Specs drive implementation, not ad-hoc prompts.
- Acceptance: Agent reads spec before writing code, spec violations flagged

**F06 Context Package & Repo Mapper**: Context assembly pipeline and repository structure mapping for agent grounding. Closes H6 gap from audit.
- Acceptance: Context packages assembled per task, repo map available

**F07 HITL Enhancement**: Close 3 HITL gaps from audit — richer gate context, escalation paths, decision audit trail.
- Acceptance: Gates show full context, escalation works, decisions logged

**F08 State Snapshotting & Review**: State-level snapshots, spec-based review protocol, Git-forensic PR descriptions.
- Acceptance: Snapshots restorable, PRs include forensic context

---

## P15 — Studio Phase 2

**Goal**: Complete the Workflow Studio from MVP (Plan block only) to full-featured IDE with all block types, container orchestration, shared components, and polished UX.

**Completed** (F01-F02, F04-F08): Block Composer (Plan block), template repository, multi-step execution UX, parallel execution engine with container pool, CLI session enhancement, monitoring dashboard, settings redesign.

### Remaining Work (Phase 2)

**F03 Execute Launcher**: Extend ExecutionPage from basic workflow selector into 4-step wizard launcher (select template, configure, review, execute).
- Acceptance: Wizard guides user through all 4 steps, execution starts

**F09 Container Pool Integration**: Wire Phase 1 container pool components into the live application. Connect ContainerPool to ExecutionEngine, add IPC handlers, lifecycle management.
- Depends on: P15-F05
- Acceptance: Containers pre-warmed, assigned at runtime, paused after use

**F10 Shared Component Library**: Complete the component library with error handling infrastructure (ErrorBoundary, toast notifications, retry patterns).
- Depends on: P15-F01
- Acceptance: Error boundaries catch component failures, toast system works

**F11 New Block Types**: Add Dev, Test, Review, DevOps block types (Phase 1 shipped Plan only). Each block needs metadata defaults, prompt harness, and agent backend config.
- Depends on: P15-F01
- Acceptance: All 5 block types draggable, configurable, executable

**F12 DiffViewer & GitHub Issues**: Complete stub implementations — real diff rendering and GitHub issue integration (list, create, link to reviews).
- Acceptance: Diffs render with syntax highlighting, issues created from UI

**F13 Monitoring & Settings Completion**: Minor gaps — 3 missing settings fields (workItemDirectory, telemetryReceiverPort, logLevel) + Docker connectivity test button.
- Depends on: P15-F07, P15-F08
- Acceptance: All settings configurable in UI, Docker test button works

### Build Order

```
F13 (3hr) -> F10 + F11 parallel (13hr + 6hr) -> F12 (9.5hr) -> F09 (24.5hr)
F03 can run anytime (independent)
```
