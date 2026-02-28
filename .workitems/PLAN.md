# aSDLC Master Plan

Phase details: `PLAN-phases.md` (P04, P05, P06) and `PLAN-phases-2.md` (P08, P12, P15).

## Project Index

| Project | Description | Features | Done | Gate |
|---------|-------------|----------|------|------|
| P00 | Multi-session infrastructure | 1 | 0/1 | — |
| P01 | Foundation & tooling | 7 | 4/7 | — |
| P02 | Coordination & persistence | 9 | 8/9 | — |
| P03 | Agent workers | 3 | 1/3 | — |
| P04 | Agent specialization | 6 | 4/6 | — |
| P05 | HITL UI & dashboards | 14 | 5/14 | — |
| P06 | Kubernetes infrastructure | 9 | 5/9 | — |
| P07 | External integrations | 1 | 1/1 | PASSED |
| P08 | MindFlare ideation | 8 | 1/8 | — |
| P09 | Security | 1 | 0/1 | — |
| P10 | Architect board | 3 | 0/3 | — |
| P11 | Guardrails | 1 | 0/1 | — |
| P12 | Developer experience | 8 | 0/8 | — |
| P14 | Workflow Studio (Electron) | 7 | 6/7 | — |
| P15 | Studio Phase 2 | 13 | 8/13 | — |

---

## P00 — Multi-Session Infrastructure
- [ ] F01 multi-session-infrastructure

## P01 — Foundation & Tooling
- [x] F01 infra-setup
- [ ] F02 bash-tools
- [ ] F03 knowledge-store
- [ ] F04 cli-coordination-redis
- [x] F05 a2a-push-notifications
- [x] F06 trunk-based-dev
- [x] F07 cli-subagents

## P02 — Coordination & Persistence
- [x] F01 redis-streams
- [x] F02 manager-agent
- [x] F03 hitl-dispatcher
- [x] F04 elk-knowledgestore
- [ ] F05 repo-ingestion-mcp
- [x] F06 coordination-sender-identity
- [x] F07 metrics-collection
- [x] F08 agent-telemetry-api
- [x] F09 persistence-layer

## P03 — Agent Workers
- [x] F01 agent-worker-pool
- [ ] F02 repo-mapper
- [ ] F03 rlm-native

## P04 — Agent Specialization
- [x] F01 discovery-agents
- [x] F02 design-agents
- [x] F03 development-agents
- [x] F04 validation-deployment
- [~] F05 parallel-review-swarm
- [~] F06 code-review-ui

## P05 — HITL UI & Dashboards
- [x] F01 hitl-ui
- [~] F04 feedback-learning
- [ ] F05 cli-interface
- [x] F06 hitl-ui-v2
- [ ] F07 documentation-spa
- [ ] F08 elk-search-ui
- [~] F09 k8s-visibility-dashboard
- [ ] F10 metrics-dashboard
- [x] F11 prd-ideation-studio
- [x] F12 agent-activity-dashboard
- [x] F13 llm-admin-configuration
- [ ] F14 electron-workflow-studio

## P06 — Kubernetes Infrastructure
- [x] F01 kubernetes-base
- [x] F02 redis-k8s
- [x] F03 chromadb-k8s
- [x] F04 stateless-services-k8s
- [x] F05 multi-tenancy
- [ ] F06 victoriametrics-infra
- [~] F07 k8s-cluster-monitoring
- [ ] F08 mcp-sidecars
- [ ] F09 metrics-query-fix

## P07 — External Integrations
- [x] F01 plane-ce-deployment

## P08 — MindFlare Ideation
- [ ] F01 ideas-repository-core
- [~] F02 slack-integration
- [x] F03 auto-classification-engine
- [~] F04 correlation-engine
- [ ] F05 mindflare-hub-ui
- [ ] F06 snowflake-graph-mvp
- [ ] F07 snowflake-graph-enhanced
- [ ] F08 slack-bidirectional-hitl

## P09 — Security
- [ ] F01 secrets-management

## P10 — Architect Board
- [ ] F01 architect-board-canvas
- [ ] F02 diagram-translation
- [ ] F03 draft-history-manager

## P11 — Guardrails
- [~] F01 guardrails-config

## P12 — Developer Experience
- [ ] F01 tdd-separation
- [ ] F02 token-budget-circuit-breaker
- [ ] F03 cot-persistence-lineage
- [~] F04 dag-orchestration-clusters
- [ ] F05 spec-driven-enhancement
- [ ] F06 context-package-repo-mapper
- [ ] F07 hitl-enhancement
- [ ] F08 state-snapshot-review-protocol

## P14 — Workflow Studio (Electron)
- [x] F01 electron-shared-types
- [x] F02 electron-shell
- [x] F03 workflow-designer-canvas
- [x] F04 execution-walkthrough
- [x] F05 cli-backend-wiring
- [ ] F06 templates-polish-packaging
- [x] F07 cursor-cli-backend

## P15 — Studio Phase 2
- [x] F01 studio-block-composer
- [x] F02 template-repository
- [ ] F03 execute-launcher
- [x] F04 execute-multistep-ux
- [x] F05 parallel-execution-engine
- [x] F06 cli-session-enhancement
- [x] F07 monitoring-dashboard
- [x] F08 settings-redesign
- [~] F09 container-pool-integration
- [~] F10 shared-component-library
- [~] F11 new-block-types
- [~] F12 diffviewer-github-issues
- [~] F13 monitoring-settings-completion

---

## Legend

- `[x]` Complete
- `[~]` In progress
- `[ ]` Not started / pending
