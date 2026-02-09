# P12-F04: DAG Orchestration & Cluster Formalization - Tasks

## Overview

This task breakdown covers implementing formal cluster definitions with internal DAGs, a small DAG engine, cluster managers, inter-cluster handshake protocol, failure firewalls, and the updated DAG-based workflow. Tasks are organized into 6 phases matching the feature's layered architecture.

## Dependencies

### External Dependencies

- Python 3.9+ (for `graphlib.TopologicalSorter`) - Already available
- PyYAML - Already in project requirements
- Redis (for state persistence) - Already deployed

### Phase Dependencies

```
Phase 1 (Cluster Specs) ──────────────────────────────────────┐
                                                               │
Phase 2 (DAG Engine) ─────────────────────────────────────────┤
          |                                                    │
          +──► Phase 3 (Cluster Manager + Firewall) ──────────┤
                        |                                      │
                        +──► Phase 4 (Handshake Protocol) ─────┤
                                                               │
Phase 5 (Workflow Integration) ◄──────────────────────────────┘
                        |
                        +──► Phase 6 (Documentation + Guardrails)
```

---

## Phase 1: Cluster Specifications (Rules/Meta)

### T01: Define Cluster Specification Schema and Loader

**Model**: sonnet
**Estimate**: 1.5hr
**Stories**: US-F04-01

**Description**: Create the Python module that defines the ClusterSpec schema and loads cluster definitions from YAML files.

**Subtasks**:
- [ ] Create `src/core/orchestration/__init__.py`
- [ ] Create `src/core/orchestration/cluster_spec.py`
- [ ] Define ClusterSpec dataclass with all fields (id, name, description, members, manager, inputs, outputs, dag, failure_firewall)
- [ ] Define MemberSpec, ManagerSpec, ArtifactSpec, FirewallSpec sub-dataclasses
- [ ] Implement `load_cluster_spec(path: Path) -> ClusterSpec` from YAML
- [ ] Implement `validate_cluster_spec(spec: ClusterSpec) -> list[str]` with error reporting
- [ ] Implement `load_all_clusters(directory: Path) -> dict[str, ClusterSpec]`
- [ ] Write unit tests for schema validation

**Acceptance Criteria**:
- [ ] ClusterSpec captures all fields from the design schema
- [ ] YAML loading handles missing optional fields with defaults
- [ ] Validation catches missing required fields, invalid agent roles
- [ ] Round-trip: load from YAML, serialize back, values match
- [ ] Unit tests cover valid and invalid cluster specs

**Test Cases**:
- [ ] Test loading a valid cluster spec YAML
- [ ] Test loading a cluster spec with missing required fields
- [ ] Test loading a cluster spec with unknown agent role
- [ ] Test loading a cluster spec with too many DAG nodes (> max_nodes)
- [ ] Test load_all_clusters with multiple YAML files
- [ ] Test validation error messages are descriptive

---

### T02: Create C3 Execution Cluster Definition

**Model**: haiku
**Estimate**: 45min
**Stories**: US-F04-02

**Description**: Write the YAML cluster definition for C3 (Execution/Development cluster).

**Subtasks**:
- [ ] Create `.claude/rules/clusters/` directory
- [ ] Create `.claude/rules/clusters/c3-execution.yaml`
- [ ] Define members: test-writer (backend), coder (backend), reviewer (reviewer)
- [ ] Define DAG: write-tests -> implement -> review
- [ ] Define inputs: design.md (C2, required), tasks.md (C2, required)
- [ ] Define outputs: implementation, test_suite, review_report
- [ ] Define manager: coordinator=coder, max_retries=3, escalation_target=pm
- [ ] Define failure_firewall: containment=cluster, retry_strategy=linear
- [ ] Verify the spec loads via T01 loader

**Acceptance Criteria**:
- [ ] YAML file passes schema validation
- [ ] DAG is acyclic (3 nodes, 2 edges)
- [ ] All member roles map to known agent definitions
- [ ] Spec loads successfully via cluster_spec.load_cluster_spec()

**Test Cases**:
- [ ] Test C3 spec loads without errors
- [ ] Test C3 DAG has correct topological order
- [ ] Test C3 inputs and outputs match design

---

### T03: Create C4 Validation Cluster Definition

**Model**: haiku
**Estimate**: 45min
**Stories**: US-F04-03

**Description**: Write the YAML cluster definition for C4 (Validation cluster) with conditional retry node.

**Subtasks**:
- [ ] Create `.claude/rules/clusters/c4-validation.yaml`
- [ ] Define members: reviewer (reviewer), debugger-proxy (backend)
- [ ] Define DAG: review-code -> run-validation -> fix-retry (conditional)
- [ ] Mark fix-retry node as conditional: true
- [ ] Define inputs: implementation (C3, required), test_suite (C3, required)
- [ ] Define outputs: validation_report, issues_list
- [ ] Define manager: coordinator=reviewer, max_retries=2
- [ ] Verify the spec loads via T01 loader

**Acceptance Criteria**:
- [ ] YAML file passes schema validation
- [ ] DAG is acyclic (3 nodes, 2-3 edges)
- [ ] Conditional node properly marked
- [ ] Spec loads successfully

**Test Cases**:
- [ ] Test C4 spec loads without errors
- [ ] Test C4 DAG has correct topological order
- [ ] Test C4 conditional node is identified

---

### T04: Create Remaining Cluster Definitions (C1, C2, C5)

**Model**: haiku
**Estimate**: 1hr
**Stories**: US-F04-04

**Description**: Write YAML cluster definitions for C1 (Discovery), C2 (Design), and C5 (Governance).

**Subtasks**:
- [ ] Create `.claude/rules/clusters/c1-discovery.yaml`
- [ ] Create `.claude/rules/clusters/c2-design.yaml`
- [ ] Create `.claude/rules/clusters/c5-governance.yaml`
- [ ] Define C1 DAG: gather-reqs -> validate-reqs -> structure-stories
- [ ] Define C2 DAG: survey-codebase -> design-arch -> write-tasks
- [ ] Define C5 DAG: commit-prep -> e2e-verify -> publish
- [ ] Create `.claude/rules/clusters/README.md` with overview
- [ ] Verify all specs load and validate

**Acceptance Criteria**:
- [ ] All 5 cluster YAML files exist and validate
- [ ] README provides overview of the cluster system
- [ ] All DAGs are 3-5 nodes, acyclic
- [ ] All member roles are valid

**Test Cases**:
- [ ] Test all cluster specs load without errors
- [ ] Test all DAGs pass cycle detection
- [ ] Test load_all_clusters returns 5 clusters

---

## Phase 2: DAG Engine (Backend)

### T05: Implement DAG Data Models

**Model**: sonnet
**Estimate**: 1.5hr
**Stories**: US-F04-05

**Description**: Create the core data models for DAG definitions, nodes, edges, and runtime state.

**Subtasks**:
- [ ] Create `src/core/orchestration/dag.py`
- [ ] Define NodeStatus enum (PENDING, READY, IN_PROGRESS, COMPLETED, FAILED, SKIPPED, BLOCKED)
- [ ] Define DAGNode dataclass (id, role, description, timeout_minutes, retry_count, max_retries, conditional)
- [ ] Define DAGEdge dataclass (from_node, to_node, condition)
- [ ] Define DAGDefinition dataclass (id, cluster_id, nodes, edges, max_nodes)
- [ ] Define DAGState dataclass (dag_id, cluster_id, execution_id, node_states, node_outputs, timestamps)
- [ ] Implement DAGState.get_ready_nodes() -- returns nodes with all dependencies COMPLETED
- [ ] Implement DAGState.is_complete() -- all non-conditional nodes COMPLETED or SKIPPED
- [ ] Implement DAGState.is_failed() -- any non-conditional node FAILED with exhausted retries
- [ ] Implement DAGState.mark_node() for state transitions
- [ ] Add to_dict() and from_dict() for JSON serialization
- [ ] Write unit tests for all state transitions

**Acceptance Criteria**:
- [ ] All dataclasses are frozen where appropriate (DAGDefinition immutable, DAGState mutable)
- [ ] NodeStatus enum covers all required states
- [ ] get_ready_nodes() correctly identifies nodes with satisfied dependencies
- [ ] is_complete() handles conditional nodes
- [ ] JSON round-trip works correctly

**Test Cases**:
- [ ] Test DAGDefinition creation
- [ ] Test DAGState initialization (all nodes PENDING)
- [ ] Test get_ready_nodes with no dependencies (root nodes)
- [ ] Test get_ready_nodes after first node completes
- [ ] Test get_ready_nodes with branching DAG
- [ ] Test is_complete with all nodes completed
- [ ] Test is_complete with conditional node skipped
- [ ] Test is_failed with one failed node
- [ ] Test mark_node state transitions
- [ ] Test JSON serialization round-trip

---

### T06: Create Orchestration Exceptions

**Model**: haiku
**Estimate**: 30min
**Stories**: US-F04-05

**Description**: Define exception classes for the orchestration module.

**Subtasks**:
- [ ] Create `src/core/orchestration/exceptions.py`
- [ ] Define OrchestrationError base exception
- [ ] Define DAGCycleError for cycle detection
- [ ] Define DAGValidationError for structural issues
- [ ] Define ClusterExecutionError for runtime failures
- [ ] Define HandshakeError for artifact validation failures
- [ ] Define EscalationError for exhausted retries
- [ ] Write unit tests for exception hierarchy

**Acceptance Criteria**:
- [ ] Exceptions inherit from a common base (ASDLCError if it exists, otherwise from Exception)
- [ ] Each exception includes descriptive message and relevant context
- [ ] Support to_dict() serialization

**Test Cases**:
- [ ] Test exception creation with message
- [ ] Test exception inheritance chain
- [ ] Test to_dict() output includes error type and details

---

### T07: Implement DAG Validator

**Model**: sonnet
**Estimate**: 1.5hr
**Stories**: US-F04-06

**Description**: Implement DAG validation using Python's graphlib.TopologicalSorter for cycle detection.

**Subtasks**:
- [ ] Create `src/core/orchestration/dag_validator.py`
- [ ] Implement validate(dag: DAGDefinition) -> list[str] method
- [ ] Check node count <= max_nodes
- [ ] Check no duplicate node IDs
- [ ] Check no duplicate edges
- [ ] Check all edge references resolve to defined nodes
- [ ] Check at least one root node exists
- [ ] Check at least one leaf node exists
- [ ] Implement detect_cycles() using graphlib.TopologicalSorter
- [ ] Implement topological_order() returning ordered node IDs
- [ ] Raise DAGCycleError when cycles found
- [ ] Raise DAGValidationError for structural issues
- [ ] Write comprehensive unit tests

**Acceptance Criteria**:
- [ ] Valid DAGs pass validation with empty error list
- [ ] Cycles detected and reported with involved nodes
- [ ] All structural checks produce descriptive error messages
- [ ] topological_order returns consistent ordering
- [ ] Uses Python stdlib graphlib (no custom graph algorithms)

**Test Cases**:
- [ ] Test valid 3-node linear DAG
- [ ] Test valid 4-node diamond DAG (branching and merging)
- [ ] Test cycle detection: A -> B -> A
- [ ] Test cycle detection: A -> B -> C -> A
- [ ] Test node count exceeds max_nodes
- [ ] Test duplicate node IDs
- [ ] Test duplicate edges
- [ ] Test edge referencing non-existent node
- [ ] Test DAG with no root node (all nodes have incoming edges -- impossible if acyclic, but test edge case)
- [ ] Test topological order for linear DAG
- [ ] Test topological order for diamond DAG

---

### T08: Implement DAG Executor

**Model**: sonnet
**Estimate**: 2hr
**Stories**: US-F04-07

**Description**: Implement the DAG executor that runs nodes in dependency order with retry support.

**Subtasks**:
- [ ] Create `src/core/orchestration/dag_executor.py`
- [ ] Implement DAGExecutor.__init__ with DAGDefinition and callbacks
- [ ] Implement execute(inputs) -> DAGState main loop
- [ ] Implement node scheduling: identify ready nodes, execute them
- [ ] Implement execute_node() as an async callback (delegates to agent)
- [ ] Implement handle_node_completion() -- update state, find new ready nodes
- [ ] Implement handle_node_failure() -- retry or mark failed
- [ ] Handle conditional node skipping
- [ ] Track execution time per node
- [ ] Emit events for node state changes (for observability)
- [ ] Write unit tests with mocked node execution

**Acceptance Criteria**:
- [ ] Executor runs nodes in topological order
- [ ] Completed nodes unlock dependent nodes
- [ ] Failed nodes trigger retry up to max_retries
- [ ] Exhausted retries mark node as FAILED
- [ ] Failed non-conditional node marks dependents as BLOCKED
- [ ] Conditional nodes can be skipped
- [ ] Execution completes when all required nodes done
- [ ] Unit tests verify execution order and failure handling

**Test Cases**:
- [ ] Test linear DAG execution (A -> B -> C)
- [ ] Test execution respects dependency order
- [ ] Test node failure triggers retry
- [ ] Test exhausted retries marks node FAILED
- [ ] Test dependent nodes marked BLOCKED on failure
- [ ] Test conditional node skipped when condition not met
- [ ] Test is_complete() after successful execution
- [ ] Test is_failed() after node failure with exhausted retries
- [ ] Test execution with mocked async callbacks

---

### T09: Implement DAG State Persistence

**Model**: haiku
**Estimate**: 1hr
**Stories**: US-F04-08

**Description**: Implement DAG state persistence to Redis and fallback to YAML file.

**Subtasks**:
- [ ] Create `src/core/orchestration/dag_state.py`
- [ ] Define DAGStateStore interface (save, load, list_history)
- [ ] Implement RedisDAGStateStore using Redis SET/GET with JSON
- [ ] Redis key pattern: `asdlc:dag:state:{execution_id}`
- [ ] Redis history key: `asdlc:dag:history:{cluster_id}` (list of recent IDs)
- [ ] Implement FileDAGStateStore fallback (writes dag_state.yaml to work item folder)
- [ ] Implement state update notification (Redis PUBLISH for cross-session visibility)
- [ ] Write unit tests for both stores

**Acceptance Criteria**:
- [ ] DAGState saved to and loaded from Redis correctly
- [ ] History maintained as a capped list (last 50 executions)
- [ ] File fallback works when Redis unavailable
- [ ] State updates trigger notifications
- [ ] JSON serialization handles datetime and enum fields

**Test Cases**:
- [ ] Test save and load DAGState via Redis
- [ ] Test history tracking
- [ ] Test file-based fallback
- [ ] Test state update notification
- [ ] Test loading non-existent state returns None

---

## Phase 3: Cluster Manager & Failure Firewall (Backend)

### T10: Implement Cluster Manager

**Model**: sonnet
**Estimate**: 2hr
**Stories**: US-F04-09

**Description**: Implement the ClusterManager that orchestrates internal DAG execution with retry and escalation.

**Subtasks**:
- [ ] Create `src/core/orchestration/cluster_manager.py`
- [ ] Implement ClusterManager.__init__ with ClusterSpec and DAGExecutor
- [ ] Implement start(inputs) -> ClusterResult
- [ ] Validate inputs against cluster spec input requirements
- [ ] Initialize DAG executor and state
- [ ] Execute DAG and collect results
- [ ] Validate outputs against cluster spec output requirements
- [ ] Implement handle_escalation(node_id, error) -> EscalationDecision
- [ ] Define EscalationDecision enum: RETRY_WITH_FEEDBACK, SKIP_NODE, ABORT_CLUSTER, ESCALATE_TO_HITL
- [ ] Implement get_status() -> ClusterStatus
- [ ] Define ClusterResult dataclass
- [ ] Write unit tests with mocked DAG executor

**Acceptance Criteria**:
- [ ] Cluster manager validates inputs before starting
- [ ] Cluster manager runs internal DAG to completion
- [ ] Cluster manager validates outputs after completion
- [ ] Retry logic stays local (up to max_retries)
- [ ] Escalation triggers when retries exhausted
- [ ] Status reports include DAG progress and node-level detail

**Test Cases**:
- [ ] Test successful cluster execution
- [ ] Test input validation failure
- [ ] Test output validation failure
- [ ] Test retry within cluster
- [ ] Test escalation after exhausted retries
- [ ] Test cluster abort
- [ ] Test status reporting accuracy

---

### T11: Implement Failure Firewall

**Model**: sonnet
**Estimate**: 1.5hr
**Stories**: US-F04-11

**Description**: Implement failure containment logic that prevents failures from cascading between clusters.

**Subtasks**:
- [ ] Create `src/core/orchestration/failure_firewall.py`
- [ ] Implement FailureFirewall class with cluster-scoped containment
- [ ] Implement contain_failure(cluster_id, node_id, error) -> ContainmentResult
- [ ] ContainmentResult tracks: retry_possible, escalation_needed, context_to_share
- [ ] Implement context isolation: error details NOT shared across clusters
- [ ] Implement escalation_info() -- creates sanitized error summary for PM CLI (without raw stack traces)
- [ ] Implement failure state machine transitions
- [ ] Track failure metrics: retry_count, escalation_count, time_in_failure_state
- [ ] Write unit tests for containment and isolation

**Acceptance Criteria**:
- [ ] Agent failure triggers local containment (not propagated)
- [ ] Cluster failure does not affect other clusters
- [ ] Error context stays within cluster boundary
- [ ] Escalation to PM CLI includes sanitized summary
- [ ] Failure metrics tracked per cluster

**Test Cases**:
- [ ] Test agent failure contained within cluster
- [ ] Test cluster failure does not propagate
- [ ] Test error context isolation between clusters
- [ ] Test escalation info is sanitized
- [ ] Test failure state machine transitions
- [ ] Test retry counting

---

## Phase 4: Handshake Protocol (Backend)

### T12: Implement Inter-Cluster Handshake

**Model**: sonnet
**Estimate**: 1.5hr
**Stories**: US-F04-10

**Description**: Implement the artifact validation protocol for transfers between clusters.

**Subtasks**:
- [ ] Create `src/core/orchestration/handshake.py`
- [ ] Define ArtifactRef dataclass (name, path, checksum, version, schema)
- [ ] Define ArtifactHandshake dataclass (source_cluster, target_cluster, artifacts, validated, errors)
- [ ] Implement validate_artifacts(source_spec, target_spec, artifacts) -> ArtifactHandshake
- [ ] Implement file existence check
- [ ] Implement non-empty check
- [ ] Implement SHA-256 checksum computation and verification
- [ ] Implement schema validation for known artifact types (e.g., tasks.md structure)
- [ ] Implement handshake_accept() and handshake_reject() result builders
- [ ] Log handshake results for audit trail
- [ ] Write unit tests for all validation paths

**Acceptance Criteria**:
- [ ] All required artifacts validated before cluster start
- [ ] Missing artifacts produce clear error messages
- [ ] Checksum verification catches corrupted artifacts
- [ ] Schema validation checks required sections in structured files
- [ ] Handshake results logged with timestamps

**Test Cases**:
- [ ] Test valid handshake with all artifacts present
- [ ] Test handshake with missing required artifact
- [ ] Test handshake with empty file
- [ ] Test checksum mismatch detection
- [ ] Test schema validation for tasks.md
- [ ] Test handshake rejection with descriptive errors
- [ ] Test handshake logging

---

## Phase 5: Workflow Integration (Rules/Meta)

### T13: Define Global Workflow DAG

**Model**: haiku
**Estimate**: 1hr
**Stories**: US-F04-12

**Description**: Create the global workflow YAML that defines inter-cluster dependencies and HITL gates.

**Subtasks**:
- [ ] Create `.claude/rules/clusters/global-workflow.yaml`
- [ ] Define pre-cluster phase (workplan step)
- [ ] Define cluster execution order with dependencies
- [ ] Define HITL gates between clusters (design_review, quality_gate, release_auth)
- [ ] Define post-cluster phase (closure step)
- [ ] Implement GlobalWorkflow loader in cluster_spec.py
- [ ] Validate global DAG (no cycles between clusters)
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Global workflow YAML defines all 5 clusters with dependencies
- [ ] HITL gates properly placed between clusters
- [ ] Global DAG passes cycle detection
- [ ] Loader returns structured GlobalWorkflow object

**Test Cases**:
- [ ] Test global workflow loads correctly
- [ ] Test cluster dependencies are valid
- [ ] Test HITL gates reference valid clusters
- [ ] Test global DAG is acyclic

---

### T14: Write DAG-Based Workflow Rule

**Model**: sonnet
**Estimate**: 1.5hr
**Stories**: US-F04-13

**Description**: Create the `workflow-dag.md` rule file that instructs PM CLI to use DAG-based cluster execution.

**Subtasks**:
- [ ] Create `.claude/rules/workflow-dag.md` with DAG-based workflow description
- [ ] Document mapping from 11-step workflow to cluster model
- [ ] Document feature flag `WORKFLOW_DAG_ENABLED`
- [ ] Document cluster execution flow for PM CLI
- [ ] Document escalation handling
- [ ] Document HITL gate integration
- [ ] Ensure backward compatibility notes included
- [ ] Validate content is consistent with design.md

**Acceptance Criteria**:
- [ ] Rule file provides clear instructions for PM CLI
- [ ] Mapping from 11 steps to clusters is explicit
- [ ] Feature flag documented with default (disabled)
- [ ] Backward compatibility guaranteed
- [ ] Consistent with existing workflow.md vocabulary

**Test Cases**:
- [ ] Verify rule file parses as valid markdown
- [ ] Verify all 5 clusters referenced
- [ ] Verify feature flag documented

---

### T15: Integrate DAG Engine with PM CLI Workflow

**Model**: sonnet
**Estimate**: 2hr
**Stories**: US-F04-13

**Description**: Wire the DAG engine and cluster managers into the PM CLI workflow, behind a feature flag.

**Subtasks**:
- [ ] Add `WORKFLOW_DAG_ENABLED` environment variable check
- [ ] When enabled: PM CLI loads cluster specs at startup
- [ ] When enabled: PM CLI uses ClusterManager for delegation instead of linear steps
- [ ] When enabled: PM CLI creates TaskCreate/TaskUpdate per cluster (not per step)
- [ ] When disabled: PM CLI follows existing linear workflow (no change)
- [ ] Implement cluster delegation flow: validate inputs -> start cluster -> handle result
- [ ] Implement inter-cluster handshake between cluster completions
- [ ] Write integration tests for the feature flag toggle

**Acceptance Criteria**:
- [ ] Feature flag controls which workflow model is used
- [ ] Enabled: PM CLI delegates to cluster managers
- [ ] Disabled: PM CLI follows existing 11-step workflow unchanged
- [ ] TaskCreate/TaskUpdate shows cluster-level progress
- [ ] Handshake validation runs between clusters

**Test Cases**:
- [ ] Test PM CLI with feature flag disabled (linear workflow)
- [ ] Test PM CLI with feature flag enabled (cluster workflow)
- [ ] Test cluster delegation creates correct tasks
- [ ] Test handshake between C3 and C4

---

## Phase 6: Documentation & Guardrails Integration

### T16: Create Cluster System Documentation

**Model**: haiku
**Estimate**: 1hr
**Stories**: US-F04-15

**Description**: Write comprehensive documentation for the cluster and DAG system.

**Subtasks**:
- [ ] Create `.claude/rules/clusters/README.md` with cluster system overview
- [ ] Document the five clusters (C1-C5) with purpose and members
- [ ] Document internal DAGs and their execution model
- [ ] Document the mapping from 11-step workflow to cluster model
- [ ] Document failure firewall and escalation paths
- [ ] Document handshake protocol
- [ ] Add examples of cluster execution scenarios

**Acceptance Criteria**:
- [ ] README is comprehensive and clear
- [ ] All five clusters documented
- [ ] Mapping from 11 steps to clusters is explicit
- [ ] Examples are realistic and accurate

**Test Cases**:
- [ ] Verify all links in README resolve
- [ ] Verify cluster names match YAML files

---

### T17: Add Cluster-Level Guardrails

**Model**: haiku
**Estimate**: 1hr
**Stories**: US-F04-14

**Description**: Add cluster-specific guidelines to the guardrails bootstrap script.

**Subtasks**:
- [ ] Add cluster IDs (C1-C5) as valid domains in guardrails condition matching
- [ ] Create cluster-specific default guidelines in bootstrap script
- [ ] C3 guideline: enforce TDD protocol for execution agents
- [ ] C4 guideline: restrict agents from modifying source code
- [ ] C5 guideline: enforce commit protocol for governance agents
- [ ] Verify guardrails evaluate correctly with cluster context
- [ ] Write unit tests for cluster-scoped guidelines

**Acceptance Criteria**:
- [ ] Cluster IDs work as domains in guardrails conditions
- [ ] Bootstrap script adds cluster guidelines
- [ ] Guidelines match when cluster context provided
- [ ] No impact on existing guardrails when clusters not in use

**Test Cases**:
- [ ] Test guardrails match with cluster domain context
- [ ] Test C3 guideline enforces TDD
- [ ] Test C4 guideline blocks source modification
- [ ] Test existing guardrails unaffected

---

## Progress

- **Started**: Not started
- **Tasks Complete**: 0/17
- **Percentage**: 0%
- **Status**: PLANNED
- **Blockers**: None

## Task Summary

| Phase | Tasks | Estimate | Status |
|-------|-------|----------|--------|
| Phase 1: Cluster Specs | T01-T04 | 4hr | [ ] |
| Phase 2: DAG Engine | T05-T09 | 6.5hr | [ ] |
| Phase 3: Cluster Manager & Firewall | T10-T11 | 3.5hr | [ ] |
| Phase 4: Handshake Protocol | T12 | 1.5hr | [ ] |
| Phase 5: Workflow Integration | T13-T15 | 4.5hr | [ ] |
| Phase 6: Documentation & Guardrails | T16-T17 | 2hr | [ ] |

**Total Estimated Time**: ~22 hours

## Completion Checklist

- [ ] All tasks in Task List are marked complete
- [ ] All unit tests pass: `./tools/test.sh tests/unit/core/orchestration/`
- [ ] All integration tests pass: `./tools/test.sh tests/integration/`
- [ ] Linter passes: `./tools/lint.sh src/core/orchestration/`
- [ ] No type errors: `mypy src/core/orchestration/`
- [ ] Documentation updated
- [ ] Interface contracts verified against design.md
- [ ] Progress marked as 100% in tasks.md

## Notes

### Task Dependencies

```
T01 ──► T02 ──┐
   ├──► T03 ──┤
   └──► T04 ──┘
              │
T05 ──► T06 ──┤
   └──► T07 ──┤
         └──► T08 ──► T09
                        │
              T10 ◄─────┘
              T11 ◄─────┘
                        │
              T12 ◄─────┘
                        │
              T13 ◄─────┤
              T14 ◄─────┤
              T15 ◄─────┘
                        │
              T16 ◄─────┤
              T17 ◄─────┘
```

### Implementation Order (Recommended Build Sequence)

```
Week 1: Foundation
  1. T01 (Cluster Spec Schema)
  2. T05, T06 (DAG Models, Exceptions) -- can parallel with T02-T04
  3. T02, T03 (C3, C4 Cluster YAML)
  4. T04 (C1, C2, C5 Cluster YAML)

Week 2: DAG Engine
  5. T07 (DAG Validator)
  6. T08 (DAG Executor)
  7. T09 (State Persistence)

Week 3: Manager, Firewall, Handshake, Integration
  8. T10 (Cluster Manager)
  9. T11 (Failure Firewall)
  10. T12 (Handshake Protocol)
  11. T13 (Global Workflow DAG)
  12. T14 (Workflow Rule)
  13. T15 (PM CLI Integration)

Week 4: Documentation & Polish
  14. T16 (Documentation)
  15. T17 (Guardrails Integration)
```

### Parallelization Opportunities

| Tasks | Can Run In Parallel |
|-------|---------------------|
| T02, T03, T04 | Yes (all depend on T01 only) |
| T05, T06 | Yes (independent foundation tasks) |
| T10, T11 | Yes (both depend on T08/T09 but are independent of each other) |
| T16, T17 | Yes (documentation and guardrails are independent) |

### Testing Strategy

- Unit tests mock all external dependencies (Redis, file system, agent delegation)
- Integration tests use real Redis (Docker) for state persistence
- Cluster specs loaded from actual YAML files in tests
- DAG validation tests cover both positive (valid DAGs) and negative (cycles, too many nodes) cases
- Feature flag tests verify both enabled and disabled code paths
- No E2E tests required (this is an infrastructure/rules feature, not user-facing)

### Risk Mitigation

1. **Over-engineering:** Keep DAGs to 3-5 nodes. Use stdlib graphlib. No custom graph algorithms.
2. **Breaking linear workflow:** Feature flag defaults to disabled. Both workflows coexist.
3. **Cluster spec complexity:** Start with C3 and C4 only. Other clusters are spec-only for now.
4. **Integration friction:** Wire PM CLI behind feature flag in T15. Test both paths.
5. **Redis dependency:** File-based fallback for DAG state when Redis unavailable (T09).
