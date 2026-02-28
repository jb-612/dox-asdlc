# Phase Descriptions: P04, P05, P06

## P04 — Agent Specialization

**Goal**: Implement the full agent lifecycle — from discovery through deployment — with human governance at every critical gate.

**Completed** (F01-F04): Discovery agents transform raw requirements into PRDs, design agents produce technical specs, development agents implement with TDD, validation agents run security scans and quality gates.

### Remaining Work

**F05 Parallel Review Swarm**: Multi-agent code review spawning 3 specialist reviewers in parallel (security, performance, style). Demonstrates true parallel coordination via Task tool + Redis result collection.
- Depends on: P04-F03 (development agents)
- Acceptance: 3 reviewers run concurrently, results aggregated into unified report

**F06 Code Review UI**: Frontend for triggering review swarms and visualizing results. Configure review parameters, monitor real-time progress, create GitHub issues from findings.
- Depends on: P04-F05
- Acceptance: Review page renders all 3 reviewer results, issue creation works

---

## P05 — HITL UI & Dashboards

**Goal**: User-facing governance layer where humans review gate decisions, configure LLM backends, explore knowledge, and monitor infrastructure.

**Completed** (F01, F06, F11-F13): Core HITL web UI (React 18 + Tailwind), PRD Ideation Studio (LLM interview tool, maturity tracking), LLM Admin Configuration (provider + model assignment), agent activity dashboard, HITL UI v2 redesign.

### Remaining Work

**F04 Feedback Learning**: Evaluator agent captures HITL feedback, classifies as generalizable vs edge case, proposes system improvements (rules, prompt refinements) requiring meta-HITL approval.
- Acceptance: Feedback loop classifies decisions, proposals require human approval

**F05 CLI Interface**: Command-line interface for automation, scripting, CI/CD. Programmatic access to all core workflows.
- Acceptance: CLI covers all SPA workflows, scriptable, JSON output

**F07 Documentation SPA**: Integrate real documentation and Mermaid diagrams into HITL UI, replacing mock data in DocsPage.
- Acceptance: Docs render from repo content, diagrams display correctly

**F08 ELK Search UI**: KnowledgeStore semantic search interface. Supports REST, GraphQL, MCP backend modes with mock-first development.
- Acceptance: Search returns ranked results, 3 backend modes work

**F09 K8s Visibility Dashboard**: Real-time cluster monitoring — pod/node/service status, diagnostic commands, resource utilization trends.
- Depends on: P06-F01
- Acceptance: Live cluster data, pod logs viewable, resource charts render

**F10 Metrics Dashboard**: Time series visualization from VictoriaMetrics — system health, resource utilization, request patterns across all services.
- Depends on: P06-F06
- Acceptance: Charts render live metrics, time range selection works

**F14 Electron Workflow Studio**: SUPERSEDED — extracted to P14. Retained for historical reference.

---

## P06 — Kubernetes Infrastructure

**Goal**: Production-ready cloud-native infrastructure with multi-tenant isolation, observability, and MCP-native service access.

**Completed** (F01-F05): Helm-based K8s migration, Redis and ChromaDB StatefulSets, stateless service deployments, multi-tenancy (Redis key prefixing, KnowledgeStore namespacing, event routing).

### Remaining Work

**F06 VictoriaMetrics Infrastructure**: Add VictoriaMetrics TSDB for Prometheus-compatible metrics collection. Single-binary, efficient.
- Acceptance: VM pod running, scraping all services, Prometheus queries work

**F07 Service Health Dashboard**: Focused dashboard monitoring 5 aSDLC services (HITL-UI, Orchestrator, Workers, Redis, ES) with real-time DevOps agent operation visibility.
- Depends on: P06-F06
- Acceptance: All 5 services show health status, alerts on degradation

**F08 MCP Sidecars**: Add MCP sidecars to Redis and ES StatefulSets for direct Claude CLI access. Add Prometheus scrape annotations to backend services.
- Depends on: P06-F01
- Acceptance: MCP tools reach Redis/ES through sidecars, metrics scraped

**F09 Metrics Query Fix**: Fix metric name and label mismatches between service exports and dashboard queries. Metrics page shows no data in VM mode despite working in mock mode.
- Depends on: P06-F06, P06-F07
- Acceptance: Dashboard queries match exported metric names, charts populate
