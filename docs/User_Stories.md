# aSDLC User Stories

**Version:** 1.1  
**Date:** January 21, 2026  
**Status:** Draft  

## Epic 1: HTML Blueprint Diagram

### US 1.1 View blueprint diagram offline
As a stakeholder, I want to open the HTML blueprint diagram offline so that I can understand the aSDLC flow without running any services.

**Acceptance criteria**
- Diagram loads without network connectivity.
- Clusters, agents, artifacts, and HITL gates are visible.

### US 1.2 Navigate to referenced artifacts
As a reviewer, I want links from the diagram to specs and policies so that I can verify decisions and guardrails.

**Acceptance criteria**
- Links resolve to repository-relative markdown paths.
- Broken link detection is available as a build check.

### US 1.3 Toggle detail layers
As an engineer, I want to toggle visual layers (for example RLM-enabled badges) so that the diagram stays readable.

**Acceptance criteria**
- Toggling does not change layout unexpectedly.
- Legend explains the symbols.

## Epic 2: Spec artifacts and Git-first truth

### US 2.1 Create and register spec artifacts
As a product owner, I want PRD and acceptance artifacts created and registered so that the epic has a stable technical contract.

**Acceptance criteria**
- `product_reqs.md` and `test_specs.md` exist for the epic.
- `spec_index.md` references them by path and Git SHA.

### US 2.2 Track decisions as commits
As a governance lead, I want gate approvals recorded as commits so that decisions are auditable.

**Acceptance criteria**
- A gate decision updates `decision_log.md`.
- Decision commit includes gate id, approver, and timestamp.

## Epic 3: HITL governance

### US 3.1 Request Backlog approval
As the Manager Agent, I want to request HITL 1 approval so that backlog scope is confirmed.

**Acceptance criteria**
- Gate request contains artifact diff summary and links.
- Approval or rejection is persisted to Git and emitted as an event.

### US 3.2 Request Design sign-off
As the Manager Agent, I want to request HITL 2 approval so that the architecture direction is confirmed before development.

**Acceptance criteria**
- Request contains architecture artifact, constraints, and key decisions.
- Decision is committed and linked to the epic.

### US 3.3 Request Task plan approval
As the Manager Agent, I want to request HITL 3 approval so that task slicing is reviewed before code changes.

**Acceptance criteria**
- Request contains `tasks.md` and dependency notes.
- Approval triggers the Development workflow.

### US 3.4 Request Implementation review
As the Manager Agent, I want HITL 4 review so that code changes and evidence are inspected before merge.

**Acceptance criteria**
- Request includes patch diff, test results, and review report.
- Approval merges to the protected branch through the commit gateway.

### US 3.5 Request Quality Gate and Release authorization
As the Manager Agent, I want HITL 5 and HITL 6 approvals so that production release is controlled.

**Acceptance criteria**
- Gate 5 includes SAST, SCA, and e2e evidence.
- Gate 6 includes release notes and deployment plan.

## Epic 4: Context packs

### US 4.1 Build deterministic context pack per task
As the Repo Mapper Agent, I want a structured context pack so that the Coding Agent receives precise, relevant context.

**Acceptance criteria**
- Context pack lists files, symbols, and interfaces used.
- Pack size is bounded and reproducible.

### US 4.2 Verify context pack integrity
As the Reviewer Agent, I want to verify that the context pack matches the codebase so that hallucinated references are rejected.

**Acceptance criteria**
- Pack references are resolvable in repo.
- Missing references fail the gate.

## Epic 5: TDD engine

### US 5.1 Generate tests first
As the UTest Agent, I want to write tests before implementation so that the change is measurable.

**Acceptance criteria**
- New or updated tests exist before code patch.
- Tests fail before the patch and pass after.

### US 5.2 Produce minimal patch
As the Coding Agent, I want to produce a minimal patch so that merges are small and reversible.

**Acceptance criteria**
- Patch is emitted as a `.patch` file.
- Patch only modifies allowed paths.

### US 5.3 Trigger debugger on repeated failure
As the system, I want to trigger the Debugger Agent after repeated failures so that complex faults are escalated.

**Acceptance criteria**
- Fail counter increments on each red run.
- Debugger triggers when fail_count > 4.

### US 5.4 Enforce independent review
As the system, I want an independent Reviewer Agent so that confirmation bias is reduced.

**Acceptance criteria**
- Reviewer model differs from Coding model or uses a distinct heuristic profile.
- Reviewer produces a structured report artifact.

## Epic 6: Validation and deployment

### US 6.1 Run integration validation
As the Validation Agent, I want to run integration tests in staging so that regressions are detected.

**Acceptance criteria**
- Staging validation log is produced.
- Failures block the Quality Gate.

### US 6.2 Run security scans
As the Security Agent, I want to run SAST and SCA so that vulnerabilities are detected early.

**Acceptance criteria**
- SAST and SCA reports are produced as artifacts.
- Findings are surfaced in the HITL request.

### US 6.3 Deploy with monitoring
As the Deployment Agent, I want to deploy and monitor the release so that production health is confirmed.

**Acceptance criteria**
- Deployment log and health signal are captured.
- Rollback procedure is referenced.

## Epic 7: Observability

### US 7.1 Track run metrics
As the Data Insight Agent, I want run metrics so that bottlenecks and failure patterns are visible.

**Acceptance criteria**
- Metrics include per-agent runtime, tool calls, failures, and costs.
- Metrics are persisted to Git or durable storage.

### US 7.2 Replay runs
As an engineer, I want to replay a run so that failures can be reproduced.

**Acceptance criteria**
- Replay uses stored artifacts and event log.
- Output includes a diff of deviations from the original run.

## Epic 8: Tool abstraction and RAG integration

### US 8.1 Query knowledge store for context enrichment
As an agent requiring external knowledge, I want to query the RAG abstraction layer so that I can retrieve relevant documents without coupling to a specific implementation.

**Acceptance criteria**
- KnowledgeStore.search(query, top_k) returns ranked results.
- Results include source attribution and relevance scores.
- Interface is implementation-agnostic.

### US 8.2 Execute tools via bash abstraction
As a coding agent, I want to execute linting and testing via bash tool wrappers so that tool changes do not require prompt updates.

**Acceptance criteria**
- Tool invocation returns standardized JSON.
- Tool replacement requires only wrapper update.
- Agent prompts reference tool names and contracts, not implementation details.
