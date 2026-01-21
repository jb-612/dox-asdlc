# aSDLC Main Features

**Version:** 1.1  
**Date:** January 21, 2026  
**Status:** Draft  

## A. Governance and traceability

1. **Git-first truth**
   - All specs, plans, reviews, patches, and gate decisions are persisted in Git.
   - Every runtime action references a Git SHA.

2. **Spec Index registry**
   - A canonical registry (for example `spec_index.md`) maps epics and tasks to required artifacts.

3. **HITL gate ladder**
   - Explicit gates from Intent through Release Authorization.
   - Every gate produces an auditable decision artifact.

4. **Exclusive commit gateway**
   - Only the governance runtime can write to protected branches.
   - Agents output artifacts and patches; a single gateway applies and commits.

5. **Evidence bundles**
   - Every gate is accompanied by evidence: diffs, tests, security scan outputs, and review reports.

## B. Event-driven orchestration

6. **State bus**
   - Event stream for cluster transitions and task execution routing.
   - Consumer groups for durability and recovery.

7. **Idempotent handlers**
   - Event processing is safe under retries and duplicate delivery.

8. **Task state model**
   - Standard lifecycle: PENDING → IN_PROGRESS → TESTING → REVIEW → BLOCKED_HITL → COMPLETE.

## C. Cluster-based specialization

9. **Logical clusters**
   - Discovery, Design, Development, Validation, Deployment are logical groupings for policy and routing.
   - Physical deployment may be consolidated or scaled horizontally.

10. **Cognitive isolation**
   - Separate agent sessions and isolated workspaces per role to prevent context contamination.

11. **Independent review**
   - Reviewer is never the creator.
   - Heuristic diversity supported via model routing.

## D. Deterministic context control

12. **Repo Mapper context packs**
   - Deterministic extraction of relevant symbols, interfaces, and dependency neighborhood per task.
   - Outputs structured artifacts such as `ast_context.json` and per-task context packs.

13. **Selective long-horizon reasoning via native REPL pattern**
   - Native implementation of recursive exploration, not an external dependency.
   - Enabled for: Repo Mapper, Arch Surveyor, Debugger, Validation agents.
   - Trigger: context requirement exceeds 100K tokens OR multi-file dependency tracing required.
   - Cost controls: sub-call budgets (default max 50 per task), tiered models (Sonnet root, Haiku sub-calls), batching for large payloads, hard wall-time limits.
   - All exploration trajectories are persisted as audit artifacts.

14. **RAG abstraction layer (KnowledgeStore interface)**
   - Single retrieval interface for prototype context enrichment.
   - Replaceable backends: Elasticsearch or OpenSearch, Google Vertex AI Search, Azure AI Search.
   - Prototype default: single-container ChromaDB or Qdrant.
   - Core operations: index_document, search, get_by_id, delete.

## E. Development acceleration and quality

15. **TDD engine workflow**
   - UTest writes tests first.
   - Coding produces minimal change set.
   - Debugger triggered by fail-count threshold.

16. **Quality gate automation**
   - Lint, tests, SAST, SCA and e2e checks are mandatory inputs for the Quality Gate.

## F. Tooling and replaceability

17. **Bash tool abstraction layer**
   - All agent tools implemented as bash wrappers with standardized JSON output.
   - Enables fast prototyping and straightforward replacement with MCP servers or enterprise tool services.
   - Agents reference tool names and contracts, not implementation details.

18. **Observability**
   - Per-agent counters, latency, failure reasons, and cost estimates.
   - Run logs and trajectories persisted for replay and audits.
