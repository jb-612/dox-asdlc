# P12-F04 DAG Orchestration & Cluster Formalization - Technical Design

**Version:** 1.0
**Date:** 2026-02-09
**Status:** Draft

## 1. Overview

Formalize the five logical clusters (C1-C5) described in the aSDLC architecture and replace the linear 11-step workflow with a DAG-based orchestration model. This addresses two gaps identified in the guardrails constitution:

- **HIGH (H3):** No DAG enforcement -- the current workflow is a linear 11-step sequence that cannot parallelize independent steps or enforce cycle prevention.
- **MEDIUM (M1):** No formal cluster definitions -- clusters are mentioned conceptually in `docs/Main_Features.md` (Feature 9: Logical Clusters, Feature 10: Cognitive Isolation) but are not implemented as runtime structures with failure firewalls, internal DAGs, or cluster managers.

### 1.1 Goals

1. Define formal cluster specifications (C1-C5) as structured rule files with member agents, input/output artifacts, and failure boundaries.
2. Implement a small DAG engine that defines, validates, and executes directed acyclic graphs within clusters (3-5 nodes each).
3. Introduce the Cluster Manager pattern for tactical orchestration within each cluster, with local retry and escalation logic.
4. Define an inter-cluster handshake protocol for artifact handover with validation.
5. Update the 11-step workflow to a DAG-based flow, enabling parallelism where steps are independent.
6. Implement failure firewalls that contain failures within cluster boundaries.

### 1.2 Non-Goals

- Replacing the existing Coordinator service (it evolves, not gets replaced).
- Building a full workflow engine (Temporal, Camunda, Airflow -- explicitly rejected per `coordinator_demystified.md`).
- Implementing all five clusters in the first iteration. Start with C3 (Execution) and C4 (Validation).
- Changing the Redis Streams event bus (it remains the coordination backbone).
- Building a UI for DAG visualization (future work).
- Running multiple clusters in truly independent K8s environments (conceptual isolation via existing worktree + agent-role model).

### 1.3 Design Principles

1. **Evolution, not revolution.** The existing 11-step workflow and Coordinator remain operational. DAG definitions are additive layers.
2. **Human-readable definitions.** Cluster specs and DAG definitions use YAML stored in `.claude/rules/clusters/`.
3. **Small DAGs.** Each cluster DAG has 3-5 nodes maximum, enforced at definition time.
4. **Fail local, escalate late.** Cluster managers handle retries locally before escalating to PM CLI.
5. **Deterministic execution.** DAG topological sort guarantees consistent execution order. No cycles by construction.

## 2. Dependencies

### 2.1 Internal Dependencies

| Dependency | Status | Description |
|------------|--------|-------------|
| Workflow rules | Complete | `.claude/rules/workflow.md` defines 11-step flow |
| Coordination protocol | Complete | `.claude/rules/coordination-protocol.md` Redis messaging |
| Parallel coordination | Complete | `.claude/rules/parallel-coordination.md` multi-CLI |
| Agent definitions | Complete | `.claude/agents/*.md` role definitions |
| Guardrails system | Complete | P11-F01 dynamic guidelines |
| Redis Streams | Complete | Event-driven state transitions |
| Worktree infrastructure | Complete | P00-F01 multi-session support |

### 2.2 External Dependencies

- No new Python packages required (standard library `graphlib` provides `TopologicalSorter` since Python 3.9).
- No new npm packages required.
- PyYAML already available in the project for YAML parsing.

## 3. Cluster Definitions

### 3.1 Cluster Specification Schema

Each cluster is defined as a YAML file in `.claude/rules/clusters/`. The schema follows:

```yaml
# .claude/rules/clusters/c3-execution.yaml
cluster:
  id: "C3"
  name: "Execution"
  description: "Development and implementation cluster"

  # Member agents and their roles within this cluster
  members:
    - role: "test-writer"
      agent: "backend"       # Maps to existing agent definition
      description: "Writes failing tests (TDD RED phase)"
    - role: "coder"
      agent: "backend"
      description: "Implements minimal code to pass tests (TDD GREEN phase)"
    - role: "reviewer"
      agent: "reviewer"
      description: "Reviews implementation within cluster"

  # Cluster manager configuration
  manager:
    coordinator: "coder"     # Which member role acts as tactical coordinator
    max_retries: 3           # Local retries before escalation
    escalation_target: "pm"  # Escalation goes to PM CLI
    timeout_minutes: 120     # Maximum cluster execution time

  # Input artifacts required to start this cluster
  inputs:
    - name: "design.md"
      source: "C2"           # Which cluster produces this
      required: true
    - name: "tasks.md"
      source: "C2"
      required: true
    - name: "user_stories.md"
      source: "C1"
      required: false

  # Output artifacts produced by this cluster
  outputs:
    - name: "implementation"
      description: "Source code files"
      validation: "files_exist"
    - name: "test_suite"
      description: "Test files with passing results"
      validation: "tests_pass"
    - name: "review_report"
      description: "Code review findings"
      validation: "schema_valid"

  # Internal DAG definition
  dag:
    nodes:
      - id: "write-tests"
        role: "test-writer"
        description: "Write failing tests for the task"
      - id: "implement"
        role: "coder"
        description: "Write minimal code to pass tests"
      - id: "review"
        role: "reviewer"
        description: "Review implementation quality"
    edges:
      - from: "write-tests"
        to: "implement"
      - from: "implement"
        to: "review"
    max_nodes: 5             # Enforce small DAG constraint

  # Failure firewall configuration
  failure_firewall:
    containment: "cluster"   # Failures don't propagate beyond cluster
    retry_strategy: "linear" # linear, exponential, or fixed
    retry_delay_seconds: 30
    on_exhausted: "escalate" # escalate, abort, or skip
```

### 3.2 Five Cluster Definitions

| Cluster | ID | Members | Internal DAG | Inputs | Outputs |
|---------|----|---------|--------------|--------|---------|
| Requirements/Discovery | C1 | planner, stakeholder-proxy | gather-reqs -> validate-reqs -> structure-stories | User intent | user_stories.md, acceptance_criteria |
| Architecture/Design | C2 | planner, architect-proxy | survey-codebase -> design-arch -> write-tasks | user_stories.md | design.md, tasks.md, diagrams |
| Execution/Development | C3 | test-writer, coder, reviewer | write-tests -> implement -> review | design.md, tasks.md | implementation, test_suite, review_report |
| Validation | C4 | reviewer, debugger-proxy | review-code -> run-validation -> (conditional) fix-retry | implementation | validation_report, issues_list |
| Governance | C5 | orchestrator, pm-proxy | commit-prep -> e2e-verify -> publish | validated_code | committed_code, release_notes |

**Priority for implementation:** C3 and C4 first (these are the most complex and benefit most from DAG enforcement). C1, C2, and C5 can be defined as specifications but implemented in a subsequent iteration.

### 3.3 Mapping to Existing 11-Step Workflow

```
11-Step Workflow              Cluster Mapping
-----------------             ----------------
Step 1: Workplan         -->  Pre-cluster (PM CLI)
Step 2: Planning         -->  C1: Requirements + C2: Design
Step 3: Diagrams         -->  C2: Design (sub-node)
Step 4: Design Review    -->  C2: Design (review node) + HITL gate
Step 5: Re-plan          -->  Pre-cluster (PM CLI)
Step 6: Parallel Build   -->  C3: Execution (internal DAG)
Step 7: Testing          -->  C3: Execution (test-writer node)
Step 8: Review           -->  C4: Validation (review-code node)
Step 9: Orchestration    -->  C5: Governance (commit-prep + e2e-verify)
Step 10: DevOps          -->  C5: Governance (publish node) + HITL gate
Step 11: Closure         -->  Post-cluster (PM CLI)
```

### 3.4 Global Workflow DAG (Inter-Cluster)

The global workflow becomes a DAG of clusters rather than a linear sequence:

```
                       PM CLI (Workplan)
                             |
                     +-------+-------+
                     |               |
                    C1              C2 (C2 depends on C1 outputs)
                 (Discovery)     (Design)
                     |               |
                     +-------+-------+
                             |
                          HITL Gate
                          (Design Review)
                             |
                     +-------+-------+
                     |               |
                    C3              C4 (C4 depends on C3 outputs)
                 (Execution)    (Validation)
                     |               |
                     +-------+-------+
                             |
                          HITL Gate
                          (Quality Gate)
                             |
                            C5
                        (Governance)
                             |
                          HITL Gate
                          (Release Auth)
                             |
                       PM CLI (Closure)
```

**Parallelization opportunity:** In the future, when multiple user stories are being worked on, different stories can be in different clusters simultaneously. Story A could be in C3 while Story B is in C4.

## 4. Small DAG Engine

### 4.1 DAG Data Model

```python
# src/core/orchestration/dag.py

from dataclasses import dataclass, field
from enum import Enum

class NodeStatus(str, Enum):
    PENDING = "pending"
    READY = "ready"          # All dependencies satisfied
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    BLOCKED = "blocked"      # Dependency failed

class DAGDefinition:
    """Immutable DAG definition loaded from YAML.

    Validates structure at load time:
    - No cycles (topological sort must succeed)
    - Max node count enforced
    - All edge references resolve to defined nodes
    - At least one root node (no incoming edges)
    - At least one leaf node (no outgoing edges)
    """
    id: str
    cluster_id: str
    nodes: list[DAGNode]
    edges: list[DAGEdge]
    max_nodes: int = 5

class DAGNode:
    """A node in the DAG representing a unit of work."""
    id: str
    role: str                  # Agent role to execute this node
    description: str
    timeout_minutes: int = 60
    retry_count: int = 0       # Current retry count
    max_retries: int = 3       # Max retries for this node
    conditional: bool = False  # If true, may be skipped

class DAGEdge:
    """A directed edge from one node to another."""
    from_node: str
    to_node: str
    condition: str | None = None  # Optional condition for traversal

class DAGState:
    """Mutable runtime state of a DAG execution.

    Tracks node statuses, start/end times, retry counts,
    and artifact outputs per node.
    """
    dag_id: str
    cluster_id: str
    execution_id: str          # Unique per execution
    node_states: dict[str, NodeStatus]
    node_outputs: dict[str, dict]  # Artifacts produced by each node
    started_at: datetime | None
    completed_at: datetime | None

    def get_ready_nodes(self) -> list[str]:
        """Return nodes whose dependencies are all COMPLETED."""
        ...

    def is_complete(self) -> bool:
        """Return True if all non-conditional nodes are COMPLETED or SKIPPED."""
        ...

    def is_failed(self) -> bool:
        """Return True if any non-conditional node is FAILED with exhausted retries."""
        ...
```

### 4.2 DAG Validation

```python
# src/core/orchestration/dag_validator.py

class DAGValidator:
    """Validates DAG definitions at load time.

    Uses Python's graphlib.TopologicalSorter for cycle detection.
    """

    def validate(self, dag: DAGDefinition) -> list[str]:
        """Validate a DAG definition. Returns list of errors (empty if valid).

        Checks:
        1. Node count <= max_nodes
        2. No cycles (topological sort succeeds)
        3. All edge references resolve to defined nodes
        4. At least one root node
        5. At least one leaf node
        6. No duplicate node IDs
        7. No duplicate edges
        8. All roles map to known agent definitions
        """

    def detect_cycles(self, nodes: list[DAGNode], edges: list[DAGEdge]) -> list[list[str]]:
        """Return list of cycles found, or empty list if acyclic."""

    def topological_order(self, dag: DAGDefinition) -> list[str]:
        """Return nodes in topological order. Raises CycleError if cycles exist."""
```

### 4.3 DAG Executor

```python
# src/core/orchestration/dag_executor.py

class DAGExecutor:
    """Executes a DAG within a cluster context.

    The executor:
    1. Loads the DAG definition from the cluster spec
    2. Creates a DAGState for tracking
    3. Identifies ready nodes (all dependencies satisfied)
    4. Delegates ready nodes to the appropriate agent
    5. Handles completion, failure, and retry
    6. Reports status to the cluster manager

    This runs as part of the PM CLI or Coordinator, not as a separate service.
    """

    def __init__(
        self,
        dag: DAGDefinition,
        cluster_spec: ClusterSpec,
        state_store: DAGStateStore,
    ):
        ...

    async def execute(self, inputs: dict[str, Any]) -> DAGState:
        """Execute the DAG from start to completion.

        Args:
            inputs: Input artifacts from previous cluster or PM CLI.

        Returns:
            Final DAGState with all node outputs.
        """

    async def execute_node(self, node_id: str, inputs: dict) -> dict:
        """Execute a single node by delegating to the appropriate agent.

        This maps to the existing delegation pattern:
        - PM CLI delegates to subagent (same session)
        - Or publishes task to worktree session (separate CLI)
        """

    async def handle_node_failure(self, node_id: str, error: str) -> bool:
        """Handle a node failure. Returns True if retry scheduled, False if exhausted.

        Retry logic:
        1. Increment retry count
        2. If retries < max_retries: schedule retry with delay
        3. If retries >= max_retries: mark FAILED, escalate to cluster manager
        """

    async def handle_node_completion(self, node_id: str, outputs: dict) -> list[str]:
        """Handle node completion. Returns list of newly ready nodes."""
```

### 4.4 DAG State Persistence

DAG state is persisted to Redis for durability and cross-session visibility:

```
Redis Key Structure:
  asdlc:dag:state:{execution_id}     -> JSON DAGState
  asdlc:dag:history:{cluster_id}     -> List of recent execution IDs
  asdlc:dag:node:{execution_id}:{node_id} -> Node-level details
```

For the CLI-first model (current implementation), DAG state can also be persisted as a YAML file in the work item folder:

```
.workitems/Pnn-Fnn-name/
  dag_state.yaml              # Current DAG execution state
```

## 5. Cluster Manager Pattern

### 5.1 Cluster Manager Interface

```python
# src/core/orchestration/cluster_manager.py

class ClusterManager:
    """Tactical orchestrator within a cluster.

    The ClusterManager:
    - Owns the internal DAG execution for its cluster
    - Handles local retries before escalating to PM CLI
    - Reports cluster-level status
    - Manages artifact handover between internal nodes
    - Enforces the failure firewall boundary

    In the CLI model, the ClusterManager is a logical concept
    implemented as a skill or prompt pattern within the PM CLI session.
    In the K8s model, it could be a separate coordinator per cluster.
    """

    def __init__(
        self,
        cluster_spec: ClusterSpec,
        dag_executor: DAGExecutor,
    ):
        ...

    async def start(self, inputs: dict[str, Any]) -> ClusterResult:
        """Start cluster execution with input artifacts.

        1. Validate inputs against cluster spec
        2. Initialize DAG state
        3. Execute DAG
        4. Validate outputs against cluster spec
        5. Return cluster result
        """

    async def handle_escalation(self, node_id: str, error: str) -> EscalationDecision:
        """Handle escalation from exhausted retries.

        Returns decision:
        - RETRY_WITH_FEEDBACK: Re-run node with additional context
        - SKIP_NODE: Skip this node (if conditional)
        - ABORT_CLUSTER: Stop cluster execution
        - ESCALATE_TO_HITL: Present to human for decision
        """

    def get_status(self) -> ClusterStatus:
        """Get current cluster execution status.

        Returns:
            ClusterStatus with DAG progress, node statuses,
            elapsed time, retry counts.
        """
```

### 5.2 Cluster Result

```python
class ClusterResult:
    """Result of a cluster execution."""
    cluster_id: str
    execution_id: str
    status: str                     # "completed", "failed", "aborted"
    outputs: dict[str, Any]         # Output artifacts
    duration_seconds: float
    node_results: dict[str, dict]   # Per-node results
    retries_used: int
    escalations: list[dict]         # Any escalations that occurred
```

## 6. Inter-Cluster Handshake Protocol

### 6.1 Handshake Schema

When artifacts cross cluster boundaries, a handshake validates the transfer:

```python
class ArtifactHandshake:
    """Validates artifact transfer between clusters."""

    source_cluster: str        # Producing cluster ID
    target_cluster: str        # Consuming cluster ID
    artifacts: list[ArtifactRef]
    timestamp: datetime
    validated: bool
    validation_errors: list[str]

class ArtifactRef:
    """Reference to an artifact being transferred."""
    name: str                  # Artifact name (e.g., "design.md")
    path: str                  # File path or Redis key
    checksum: str              # SHA-256 for integrity verification
    version: int               # Version number for tracking
    schema: str | None         # Optional schema name for validation
```

### 6.2 Validation Rules

| Source | Target | Artifacts | Validation |
|--------|--------|-----------|------------|
| C1 -> C2 | Discovery -> Design | user_stories.md, acceptance_criteria | File exists, non-empty, contains required sections |
| C2 -> C3 | Design -> Execution | design.md, tasks.md | File exists, tasks parseable, each task < 2hr |
| C3 -> C4 | Execution -> Validation | implementation files, test_suite | Files exist, tests run without import errors |
| C4 -> C5 | Validation -> Governance | validated_code, review_report | All tests pass, no critical review findings |

### 6.3 Handshake Protocol Flow

```
Source Cluster (C3)                  Handshake Layer                  Target Cluster (C4)
       |                                    |                                |
       |-- ClusterCompleted(outputs) ------>|                                |
       |                                    |-- validate_artifacts() ------->|
       |                                    |   (check files exist,          |
       |                                    |    verify checksums,           |
       |                                    |    validate schemas)           |
       |                                    |                                |
       |                          [if valid]|-- HandshakeAccepted ---------->|
       |                                    |                                |-- start(inputs)
       |                                    |                                |
       |                      [if invalid]  |-- HandshakeRejected --------->|
       |<-- EscalateToHITL ----------------|                                |
       |   (present to user)                |                                |
```

## 7. Failure Firewall Mechanism

### 7.1 Containment Rules

Each cluster defines a failure firewall that prevents failures from cascading:

1. **Agent failure within cluster:** Retry locally (up to cluster's `max_retries`). If exhausted, mark node as FAILED but do not propagate to other clusters.
2. **Cluster-level failure:** If the DAG cannot complete (non-conditional node failed with exhausted retries), the cluster reports failure to the global orchestrator. Other clusters already running are NOT affected.
3. **Escalation path:** Failed node -> Cluster manager retry -> PM CLI notification -> HITL gate (if configured).

### 7.2 Failure State Machine

```
Node States:
  PENDING --> READY --> IN_PROGRESS --> COMPLETED
                          |    ^
                          |    | (retry)
                          v    |
                        FAILED -----> BLOCKED (dependents)
                          |
                          v (retries exhausted)
                        ESCALATED --> HITL_PENDING --> COMPLETED | ABORTED
```

### 7.3 Context Isolation

Failures in one cluster do not contaminate the context of another cluster:

- Each cluster has its own DAG state.
- Each cluster's agents receive only the artifacts from the cluster's input spec.
- Error details from a failed cluster are NOT automatically injected into other clusters' agent context.
- The PM CLI (global manager) decides what information to pass between clusters after a failure.

## 8. Updated Workflow Rule

### 8.1 DAG-Based Workflow Definition

The updated workflow rule file will be `.claude/rules/workflow-dag.md` (coexists with the existing `workflow.md` during migration):

```yaml
# .claude/rules/clusters/global-workflow.yaml
workflow:
  id: "asdlc-v2"
  name: "aSDLC DAG Workflow"
  description: "DAG-based workflow replacing linear 11-step sequence"

  # Pre-cluster phase (PM CLI)
  pre_cluster:
    - step: "workplan"
      executor: "pm"
      outputs: ["work_plan"]

  # Cluster execution phase
  clusters:
    - id: "C1"
      depends_on: []                # No cluster dependencies
      gate_after: null              # No HITL gate after C1
    - id: "C2"
      depends_on: ["C1"]           # Needs C1 outputs
      gate_after: "design_review"  # HITL gate after C2
    - id: "C3"
      depends_on: ["C2"]           # Needs C2 outputs
      gate_after: null
    - id: "C4"
      depends_on: ["C3"]           # Needs C3 outputs
      gate_after: "quality_gate"   # HITL gate after C4
    - id: "C5"
      depends_on: ["C4"]           # Needs C4 outputs
      gate_after: "release_auth"   # HITL gate after C5

  # Post-cluster phase (PM CLI)
  post_cluster:
    - step: "closure"
      executor: "pm"
      inputs: ["C5.outputs"]

  # HITL gates between clusters
  gates:
    design_review:
      type: "advisory"
      trigger_after: "C2"
      required_artifacts: ["design.md", "tasks.md"]
    quality_gate:
      type: "mandatory"
      trigger_after: "C4"
      required_artifacts: ["validation_report", "test_results"]
    release_auth:
      type: "mandatory"
      trigger_after: "C5"
      required_artifacts: ["release_notes", "deployment_plan"]
```

### 8.2 Backward Compatibility

The DAG-based workflow coexists with the linear 11-step workflow:

1. The existing `workflow.md` remains unchanged and continues to be the primary reference.
2. The new `workflow-dag.md` provides the DAG overlay.
3. A feature flag `WORKFLOW_DAG_ENABLED` (default: false) controls which workflow model is active.
4. When enabled, the PM CLI uses the DAG model for cluster-based execution.
5. When disabled, the PM CLI follows the existing linear 11-step model.

## 9. File Structure

```
.claude/rules/
  clusters/
    README.md                          # Overview of cluster system
    c1-discovery.yaml                  # C1 cluster definition
    c2-design.yaml                     # C2 cluster definition
    c3-execution.yaml                  # C3 cluster definition
    c4-validation.yaml                 # C4 cluster definition
    c5-governance.yaml                 # C5 cluster definition
    global-workflow.yaml               # Inter-cluster DAG
  workflow.md                          # Existing 11-step (unchanged)
  workflow-dag.md                      # New DAG-based workflow rule

src/core/orchestration/
  __init__.py
  dag.py                              # DAG data models
  dag_validator.py                     # DAG validation (cycles, structure)
  dag_executor.py                      # DAG execution engine
  dag_state.py                         # DAG state management
  cluster_spec.py                      # Cluster specification loader
  cluster_manager.py                   # Cluster manager pattern
  handshake.py                         # Inter-cluster handshake protocol
  failure_firewall.py                  # Failure containment logic
  exceptions.py                        # Orchestration exceptions

tests/
  unit/
    core/
      orchestration/
        test_dag.py                    # DAG model tests
        test_dag_validator.py          # Validation tests (cycles, constraints)
        test_dag_executor.py           # Execution tests
        test_dag_state.py              # State management tests
        test_cluster_spec.py           # Cluster spec loading tests
        test_cluster_manager.py        # Cluster manager tests
        test_handshake.py              # Handshake protocol tests
        test_failure_firewall.py       # Failure containment tests
  integration/
    test_dag_redis.py                  # DAG state persistence to Redis
    test_cluster_e2e.py                # End-to-end cluster execution
```

## 10. Integration Points

### 10.1 With Existing Coordinator

The existing Coordinator (the `while True` + `redis.xread()` service) gains awareness of clusters:

- Phase completion events now include `cluster_id` and `node_id` fields.
- The Coordinator's WORKFLOW dictionary is extended with cluster-aware routing.
- AUTO transitions within a cluster are handled by the DAG executor, not the Coordinator.
- The Coordinator handles inter-cluster transitions and HITL gates.

### 10.2 With PM CLI

The PM CLI gains cluster-level delegation:

- `workflow-dag.md` rule instructs PM CLI to use cluster-based execution when enabled.
- PM CLI creates TaskCreate/TaskUpdate entries per cluster (not per step).
- PM CLI can view cluster DAG progress via the DAGState.

### 10.3 With Guardrails System

New guardrails can be defined at the cluster level:

```json
{
  "id": "cluster-c3-isolation",
  "condition": {
    "domains": ["C3"],
    "agents": ["backend", "frontend"]
  },
  "action": {
    "type": "constraint",
    "instruction": "You are operating within Cluster C3 (Execution). Follow TDD protocol. Do not modify design artifacts."
  }
}
```

### 10.4 With Multi-CLI Sessions

Clusters map naturally to worktree sessions:

- A worktree for `p12-execution` represents C3 work.
- Multiple agents within the worktree follow the internal DAG.
- Cluster completion triggers handshake validation before the next worktree can consume outputs.

## 11. Security Considerations

1. **DAG definitions are meta files.** Owned by the orchestrator agent. Changes require HITL confirmation (protected path: `.claude/rules/clusters/`).
2. **Cluster boundary enforcement.** Agents within a cluster cannot access artifacts from other clusters unless explicitly defined in the handshake.
3. **Retry limits.** Max retries prevent infinite loops. Configurable per node and per cluster.
4. **Escalation audit.** All escalations from cluster manager to PM CLI are logged for audit trail.

## 12. Performance Considerations

1. **DAG validation is fast.** Topological sort is O(V+E) where V and E are small (3-5 nodes, 2-4 edges).
2. **State persistence is lightweight.** DAG state is a small JSON document in Redis.
3. **No additional services.** The DAG executor runs within the existing PM CLI or Coordinator process.
4. **Cluster specs loaded once.** YAML files parsed at startup and cached.

## 13. Testing Strategy

### 13.1 Unit Tests

- DAG model creation and serialization
- Cycle detection (positive and negative cases)
- Node count enforcement
- Topological ordering
- State transitions (ready, in_progress, completed, failed)
- Retry logic
- Failure firewall containment
- Handshake validation
- Cluster spec loading from YAML

### 13.2 Integration Tests

- DAG state persistence to Redis
- End-to-end cluster execution with mocked agents
- Inter-cluster handshake with real file artifacts
- Failure escalation flow
- Feature flag toggling between linear and DAG workflows

### 13.3 Behavioral Tests

- Verify that a cycle in a DAG definition is rejected at load time
- Verify that a node failure does not propagate beyond the cluster
- Verify that handshake rejection prevents the next cluster from starting
- Verify backward compatibility with the linear 11-step workflow

## 14. Migration Path

1. **Phase 1:** Define cluster YAML specs (no runtime impact).
2. **Phase 2:** Implement DAG engine with validation (library, no integration).
3. **Phase 3:** Implement cluster manager and handshake (library, no integration).
4. **Phase 4:** Implement failure firewall (library, no integration).
5. **Phase 5:** Write the `workflow-dag.md` rule and integrate with PM CLI behind feature flag.
6. **Phase 6:** Enable for C3 and C4 clusters in test/staging.
7. **Phase 7:** Define C1, C2, C5 cluster specs (future iteration).

## 15. Open Questions

1. Should cluster specs support conditional edges (e.g., skip debugger if tests pass on first try)?
2. Should the handshake protocol support partial artifact delivery (some artifacts ready, others pending)?
3. Should we define a cluster-level cost budget (maximum API spend per cluster execution)?
4. How should the DAG visualization in the HITL UI be prioritized relative to this feature?

## 16. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-engineering the DAG engine | High | Keep DAGs to 3-5 nodes. Use Python stdlib `graphlib`. No custom graph algorithms. |
| Breaking existing 11-step workflow | High | Feature flag. Both workflows coexist. Linear remains default. |
| Cluster definitions too rigid | Medium | YAML format allows iteration. Cluster specs are human-editable. |
| Failure firewall too strict (blocks valid retries) | Medium | Configurable retry limits per node and per cluster. Escalation path to human. |
| Handshake validation too slow | Low | Validation is file existence + checksum. Sub-second. |
| Adoption friction (users must learn cluster model) | Medium | Document mapping from 11-step to clusters. Keep existing vocabulary. |
