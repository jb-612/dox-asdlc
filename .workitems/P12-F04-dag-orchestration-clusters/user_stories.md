# User Stories: P12-F04 DAG Orchestration & Cluster Formalization

## Epic Reference

This feature formalizes the five logical clusters (C1-C5) from the aSDLC architecture and introduces a DAG-based orchestration model to replace the linear 11-step workflow. It addresses HIGH gap H3 (no DAG enforcement) and MEDIUM gap M1 (no formal cluster definitions).

## Epic Summary

As a project orchestrator, I want formal cluster definitions with internal DAGs and failure firewalls, so that workflow execution is parallelizable, cycle-free, and resilient to individual agent failures.

## User Stories

### US-F04-01: Define Cluster Specification Schema

**As a** system architect
**I want** a structured YAML schema for cluster definitions
**So that** clusters have consistent, machine-readable specifications

**Acceptance Criteria:**
- [ ] YAML schema supports cluster id, name, description
- [ ] Schema includes member agents with roles
- [ ] Schema includes cluster manager configuration (coordinator, max_retries, escalation_target, timeout)
- [ ] Schema includes input/output artifact specifications
- [ ] Schema includes internal DAG definition (nodes, edges, max_nodes)
- [ ] Schema includes failure firewall configuration
- [ ] Schema validates against a known set of agent roles
- [ ] Unit tests verify schema loading and validation

**Priority:** High

---

### US-F04-02: Create C3 Execution Cluster Definition

**As a** developer
**I want** a formal definition for the Execution cluster (C3)
**So that** TDD development follows a defined DAG: write-tests -> implement -> review

**Acceptance Criteria:**
- [ ] C3 cluster YAML file exists at `.claude/rules/clusters/c3-execution.yaml`
- [ ] Members include test-writer, coder, and reviewer roles
- [ ] Internal DAG defines three nodes: write-tests, implement, review
- [ ] Edges enforce write-tests before implement, implement before review
- [ ] Input artifacts specify design.md and tasks.md from C2
- [ ] Output artifacts specify implementation, test_suite, review_report
- [ ] Failure firewall configured with 3 local retries and escalation to PM CLI
- [ ] Cluster manager coordinator set to coder role

**Priority:** High

---

### US-F04-03: Create C4 Validation Cluster Definition

**As a** reviewer
**I want** a formal definition for the Validation cluster (C4)
**So that** code validation follows a defined DAG with conditional retry

**Acceptance Criteria:**
- [ ] C4 cluster YAML file exists at `.claude/rules/clusters/c4-validation.yaml`
- [ ] Members include reviewer and debugger-proxy roles
- [ ] Internal DAG defines nodes: review-code, run-validation, fix-retry (conditional)
- [ ] fix-retry is marked as conditional (may be skipped if validation passes)
- [ ] Input artifacts specify implementation and test_suite from C3
- [ ] Output artifacts specify validation_report and issues_list
- [ ] Failure firewall configured with 2 local retries
- [ ] Escalation target is PM CLI

**Priority:** High

---

### US-F04-04: Create Remaining Cluster Definitions (C1, C2, C5)

**As a** system architect
**I want** formal definitions for Discovery (C1), Design (C2), and Governance (C5) clusters
**So that** all five clusters in the aSDLC architecture have structured specifications

**Acceptance Criteria:**
- [ ] C1 discovery cluster YAML file exists at `.claude/rules/clusters/c1-discovery.yaml`
- [ ] C2 design cluster YAML file exists at `.claude/rules/clusters/c2-design.yaml`
- [ ] C5 governance cluster YAML file exists at `.claude/rules/clusters/c5-governance.yaml`
- [ ] Each cluster defines members, inputs, outputs, DAG, and failure firewall
- [ ] All DAGs have 3-5 nodes maximum
- [ ] All cluster specs pass schema validation
- [ ] Cluster README documents the cluster system overview

**Priority:** Medium

---

### US-F04-05: Implement DAG Data Models

**As a** developer
**I want** well-defined data models for DAG nodes, edges, and state
**So that** the DAG engine has a consistent type system

**Acceptance Criteria:**
- [ ] DAGDefinition dataclass defined with nodes, edges, max_nodes
- [ ] DAGNode dataclass defined with id, role, description, timeout, retry config
- [ ] DAGEdge dataclass defined with from_node, to_node, optional condition
- [ ] DAGState dataclass tracks node statuses, outputs, timestamps
- [ ] NodeStatus enum covers PENDING, READY, IN_PROGRESS, COMPLETED, FAILED, SKIPPED, BLOCKED
- [ ] get_ready_nodes() returns nodes whose dependencies are all COMPLETED
- [ ] is_complete() and is_failed() predicates work correctly
- [ ] All models support JSON serialization for Redis persistence
- [ ] Unit tests verify all state transitions

**Priority:** High

---

### US-F04-06: Implement DAG Validation

**As a** system architect
**I want** DAG definitions validated at load time
**So that** cycles and structural errors are caught before execution

**Acceptance Criteria:**
- [ ] Cycle detection uses Python's graphlib.TopologicalSorter
- [ ] Node count validated against max_nodes constraint
- [ ] All edge references resolve to defined node IDs
- [ ] At least one root node (no incoming edges) required
- [ ] At least one leaf node (no outgoing edges) required
- [ ] No duplicate node IDs allowed
- [ ] No duplicate edges allowed
- [ ] Topological ordering returned for valid DAGs
- [ ] Descriptive error messages for each validation failure
- [ ] Unit tests cover all validation rules including cycle detection

**Priority:** High

---

### US-F04-07: Implement DAG Executor

**As a** orchestrator
**I want** an executor that runs DAG nodes in dependency order
**So that** cluster work proceeds correctly through the internal DAG

**Acceptance Criteria:**
- [ ] Executor loads DAG definition from cluster spec
- [ ] Executor creates DAGState for tracking
- [ ] Ready nodes (all dependencies satisfied) are identified correctly
- [ ] Node execution delegates to the appropriate agent role
- [ ] Node completion triggers identification of newly ready nodes
- [ ] Node failure triggers retry logic
- [ ] Conditional nodes can be skipped when not needed
- [ ] Executor reports progress via DAGState updates
- [ ] Unit tests with mocked agent delegation

**Priority:** High

---

### US-F04-08: Implement DAG State Persistence

**As a** system operator
**I want** DAG execution state persisted to Redis
**So that** state survives process restarts and is visible across sessions

**Acceptance Criteria:**
- [ ] DAGState serialized to JSON and stored in Redis
- [ ] Redis key pattern: `asdlc:dag:state:{execution_id}`
- [ ] State updates are atomic (Redis SET with JSON)
- [ ] State can be loaded from Redis by execution ID
- [ ] Execution history stored as list: `asdlc:dag:history:{cluster_id}`
- [ ] Fallback to YAML file in work item folder when Redis unavailable
- [ ] Integration tests verify Redis round-trip

**Priority:** Medium

---

### US-F04-09: Implement Cluster Manager

**As a** PM CLI operator
**I want** a cluster manager that handles internal orchestration
**So that** clusters are self-contained with local retry and escalation

**Acceptance Criteria:**
- [ ] ClusterManager class validates inputs against cluster spec
- [ ] ClusterManager initializes and runs the internal DAG
- [ ] Local retries handled within the cluster (up to max_retries)
- [ ] Exhausted retries escalate to PM CLI with error context
- [ ] Escalation decision types: RETRY_WITH_FEEDBACK, SKIP_NODE, ABORT_CLUSTER, ESCALATE_TO_HITL
- [ ] Cluster status reportable: DAG progress, node statuses, elapsed time
- [ ] ClusterResult captures outputs, duration, retries used, escalations
- [ ] Unit tests verify retry and escalation logic

**Priority:** High

---

### US-F04-10: Implement Inter-Cluster Handshake Protocol

**As a** system architect
**I want** artifact transfers between clusters validated automatically
**So that** invalid or incomplete artifacts are caught before the next cluster starts

**Acceptance Criteria:**
- [ ] ArtifactHandshake validates artifact transfer between clusters
- [ ] Validation checks: file exists, non-empty, checksum matches
- [ ] Schema validation for structured artifacts (e.g., tasks.md has required sections)
- [ ] Handshake accepted: next cluster starts with validated inputs
- [ ] Handshake rejected: escalation to PM CLI with validation errors
- [ ] Handshake results logged for audit trail
- [ ] Unit tests verify accept/reject scenarios

**Priority:** Medium

---

### US-F04-11: Implement Failure Firewall

**As a** system operator
**I want** failures contained within cluster boundaries
**So that** a failing agent in one cluster does not affect other clusters

**Acceptance Criteria:**
- [ ] Agent failure within cluster triggers local retry (not propagated)
- [ ] Cluster-level failure does not affect already-running clusters
- [ ] Error details from failed cluster NOT automatically injected into other clusters
- [ ] PM CLI decides what information to pass after failure
- [ ] Failure state machine: FAILED -> retry or ESCALATED -> HITL_PENDING -> resolved
- [ ] Context isolation verified: failed cluster's error context stays within cluster
- [ ] Unit tests verify containment rules

**Priority:** High

---

### US-F04-12: Define Global Workflow DAG

**As a** PM CLI operator
**I want** a global DAG defining inter-cluster dependencies and HITL gates
**So that** the workflow supports parallelization of independent clusters

**Acceptance Criteria:**
- [ ] Global workflow YAML defines cluster execution order
- [ ] Dependencies between clusters explicitly stated (C2 depends on C1, etc.)
- [ ] HITL gates defined between clusters (design_review after C2, quality_gate after C4)
- [ ] Pre-cluster and post-cluster steps defined (workplan, closure)
- [ ] Global DAG passes cycle detection validation
- [ ] Unit tests verify global workflow structure

**Priority:** Medium

---

### US-F04-13: Write DAG-Based Workflow Rule

**As a** PM CLI operator
**I want** a workflow rule that uses DAG-based cluster execution
**So that** the PM CLI can orchestrate work through clusters instead of linear steps

**Acceptance Criteria:**
- [ ] `workflow-dag.md` rule file created in `.claude/rules/`
- [ ] Rule maps existing 11 steps to cluster-based execution
- [ ] Feature flag `WORKFLOW_DAG_ENABLED` controls activation (default: false)
- [ ] When enabled, PM CLI delegates to cluster managers
- [ ] When disabled, PM CLI follows existing linear workflow
- [ ] Backward-compatible: existing workflow.md unchanged
- [ ] Documentation explains mapping from steps to clusters

**Priority:** Medium

---

### US-F04-14: Integrate with Guardrails System

**As a** platform engineer
**I want** cluster-level guardrails configurable in the existing guardrails system
**So that** agents within clusters receive cluster-specific behavioral guidelines

**Acceptance Criteria:**
- [ ] Cluster ID can be used as a domain in guardrails conditions
- [ ] Bootstrap script adds cluster-specific default guidelines
- [ ] Example guideline: C3 agents must follow TDD protocol
- [ ] Example guideline: C4 agents must not modify source code
- [ ] Guardrails evaluation works with cluster context
- [ ] Unit tests verify cluster-scoped guideline matching

**Priority:** Low

---

### US-F04-15: Create Cluster System Documentation

**As a** project maintainer
**I want** comprehensive documentation for the cluster and DAG system
**So that** developers understand how to work with the new orchestration model

**Acceptance Criteria:**
- [ ] Cluster README at `.claude/rules/clusters/README.md`
- [ ] Documentation explains the five clusters (C1-C5)
- [ ] Documentation explains internal DAGs and their purpose
- [ ] Documentation maps 11-step workflow to cluster model
- [ ] Documentation explains failure firewall and escalation
- [ ] Documentation explains handshake protocol
- [ ] Examples of common cluster execution scenarios

**Priority:** Low

---

## Non-Functional Requirements

### Performance

- DAG validation completes in < 10ms for 5-node DAGs
- DAG state persistence round-trip < 50ms via Redis
- Cluster spec loading < 100ms (YAML parse + validation)
- No measurable impact on existing workflow when feature flag disabled

### Reliability

- DAG executor recovers from process restart via persisted state
- Cluster manager retries are idempotent
- Handshake validation is deterministic (same inputs always produce same result)
- Feature flag toggle does not require service restart

### Maintainability

- Cluster specs are human-editable YAML
- DAG engine uses Python standard library (graphlib) -- no custom graph algorithms
- All public interfaces have comprehensive docstrings
- Test coverage > 80% for core orchestration module

### Backward Compatibility

- Existing 11-step workflow unchanged
- Feature flag defaults to disabled
- No changes to existing Redis stream keys
- No changes to existing agent definitions

## Story Dependencies

```
US-F04-01 (Schema)
    |
    +---> US-F04-02 (C3 Cluster)
    |         |
    +---> US-F04-03 (C4 Cluster)
    |         |
    +---> US-F04-04 (C1, C2, C5)
    |
    +---> US-F04-05 (DAG Models)
              |
              +---> US-F04-06 (DAG Validation)
              |         |
              |         +---> US-F04-07 (DAG Executor)
              |                   |
              |                   +---> US-F04-08 (State Persistence)
              |                   |
              |                   +---> US-F04-09 (Cluster Manager)
              |                             |
              |                             +---> US-F04-10 (Handshake)
              |                             |
              |                             +---> US-F04-11 (Failure Firewall)
              |
              +---> US-F04-12 (Global Workflow DAG)

US-F04-09 + US-F04-12 ---> US-F04-13 (Workflow Rule)

US-F04-13 ---> US-F04-14 (Guardrails Integration)

All ---> US-F04-15 (Documentation)
```

## Priority Summary

| Priority | Stories |
|----------|---------|
| High | US-F04-01, 02, 03, 05, 06, 07, 09, 11 |
| Medium | US-F04-04, 08, 10, 12, 13 |
| Low | US-F04-14, 15 |
