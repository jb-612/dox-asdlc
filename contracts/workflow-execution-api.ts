/**
 * Workflow Execution REST API Contract
 *
 * REST API for managing workflow executions between the Electron Workflow Studio
 * and the aSDLC orchestrator service.
 *
 * Base path: /api/execution
 * Owner: orchestrator
 * Consumers: workflow-studio (Electron app)
 * Version: 1.0.0
 *
 * All timestamps are ISO 8601 strings with timezone (e.g. "2026-02-21T10:00:00Z").
 * All IDs are opaque strings (UUIDs recommended).
 */

// ---------------------------------------------------------------------------
// Shared type references (re-declared for contract self-containment)
// Source: apps/workflow-studio/src/shared/types/
// ---------------------------------------------------------------------------

/** Status of a workflow execution lifecycle. */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'waiting_gate'
  | 'completed'
  | 'failed'
  | 'aborted';

/** Status of an individual node within an execution. */
export type NodeExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_gate';

/** Agent node types recognized by the workflow engine. */
export type AgentNodeType =
  | 'planner'
  | 'backend'
  | 'frontend'
  | 'reviewer'
  | 'orchestrator'
  | 'devops'
  | 'ideation'
  | 'architect'
  | 'surveyor'
  | 'prd'
  | 'acceptance'
  | 'coding'
  | 'utest'
  | 'debugger'
  | 'security'
  | 'validation'
  | 'deployment'
  | 'monitor'
  | 'release';

/** HITL gate types that can block an execution node. */
export type GateType = 'approval' | 'review' | 'decision' | 'confirmation';

/** Work item type reference (filesystem PRDs, GitHub issues, etc.). */
export type WorkItemType = 'prd' | 'issue' | 'idea' | 'manual';

/** Source system for a work item reference. */
export type WorkItemSource = 'filesystem' | 'github' | 'manual';

// ---------------------------------------------------------------------------
// Lightweight reference types used in request/response payloads
// ---------------------------------------------------------------------------

/**
 * Minimal reference to a work item, included when an execution is tied
 * to a specific PRD, issue, or idea.
 */
export interface WorkItemRef {
  /** Unique identifier for the work item. */
  id: string;
  /** Classification of the work item. */
  type: WorkItemType;
  /** Where the work item originated. */
  source: WorkItemSource;
  /** Human-readable title. */
  title: string;
  /** Optional longer description. */
  description?: string;
  /** Filesystem path (for filesystem-sourced items). */
  path?: string;
  /** URL (for GitHub-sourced items). */
  url?: string;
}

/**
 * Port schema describing an input or output connector on an agent node.
 */
export interface PortSchemaRef {
  /** Port name used for wiring transitions. */
  name: string;
  /** Whether this is an input or output port. */
  type: 'input' | 'output';
  /** Data type transported through this port. */
  dataType: string;
  /** Whether the port must be connected for the node to execute. */
  required: boolean;
  /** Human-readable description of the port. */
  description?: string;
}

/**
 * Runtime configuration for an agent node.
 */
export interface AgentNodeConfigRef {
  /** LLM model identifier (e.g. "claude-opus-4-6"). */
  model?: string;
  /** Maximum conversation turns before the agent is stopped. */
  maxTurns?: number;
  /** Spend cap in USD for this agent invocation. */
  maxBudgetUsd?: number;
  /** Explicit tool allowlist for the agent session. */
  allowedTools?: string[];
  /** System prompt injected at session start. */
  systemPrompt?: string;
  /** Wall-clock timeout in seconds. */
  timeoutSeconds?: number;
  /** Additional CLI flags passed to the agent runner. */
  extraFlags?: string[];
}

/**
 * Agent node as stored in a workflow definition.
 */
export interface AgentNodeRef {
  /** Unique node identifier within the workflow. */
  id: string;
  /** Agent specialization type. */
  type: AgentNodeType;
  /** Display label in the visual editor. */
  label: string;
  /** Runtime configuration. */
  config: AgentNodeConfigRef;
  /** Input port schemas. */
  inputs: PortSchemaRef[];
  /** Output port schemas. */
  outputs: PortSchemaRef[];
  /** Canvas position for the visual editor. */
  position: { x: number; y: number };
  /** Optional human-readable description. */
  description?: string;
}

/**
 * Condition governing when a transition fires.
 */
export interface TransitionConditionRef {
  /** Condition evaluation strategy. */
  type: 'always' | 'on_success' | 'on_failure' | 'expression';
  /** CEL or JS expression (required when type is 'expression'). */
  expression?: string;
}

/**
 * Directed edge between two agent nodes in the workflow graph.
 */
export interface TransitionRef {
  /** Unique transition identifier. */
  id: string;
  /** ID of the source node. */
  sourceNodeId: string;
  /** ID of the target node. */
  targetNodeId: string;
  /** When this transition should fire. */
  condition: TransitionConditionRef;
  /** Optional display label on the edge. */
  label?: string;
}

/**
 * One selectable option presented at a HITL gate.
 */
export interface GateOptionRef {
  /** Button or choice label. */
  label: string;
  /** Machine-readable value returned on selection. */
  value: string;
  /** Tooltip or extended description. */
  description?: string;
  /** Whether this option is pre-selected. */
  isDefault?: boolean;
}

/**
 * Definition of a human-in-the-loop gate attached to a workflow node.
 */
export interface HITLGateDefinitionRef {
  /** Unique gate identifier within the workflow. */
  id: string;
  /** Node this gate is attached to. */
  nodeId: string;
  /** Gate classification. */
  gateType: GateType;
  /** Prompt text shown to the human reviewer. */
  prompt: string;
  /** Available response options. */
  options: GateOptionRef[];
  /** Seconds before the gate auto-expires (null = no timeout). */
  timeoutSeconds?: number;
  /** Whether the gate must be decided before execution continues. */
  required: boolean;
}

/**
 * Variable definition declared in the workflow schema.
 */
export interface WorkflowVariableRef {
  /** Variable name (used as key in the variables record). */
  name: string;
  /** Runtime data type. */
  type: 'string' | 'number' | 'boolean' | 'json';
  /** Default value if not supplied at execution start. */
  defaultValue?: unknown;
  /** Human-readable description. */
  description?: string;
  /** Whether a value must be provided before execution starts. */
  required: boolean;
}

/**
 * Metadata envelope for a workflow definition.
 */
export interface WorkflowMetadataRef {
  /** Display name of the workflow. */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** Semantic version string (e.g. "1.0.0"). */
  version: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
  /** Creator identity (user or agent ID). */
  createdBy?: string;
  /** Freeform tags for filtering and search. */
  tags: string[];
}

/**
 * Full workflow definition as submitted for execution.
 */
export interface WorkflowDefinitionRef {
  /** Unique workflow identifier. */
  id: string;
  /** Workflow metadata envelope. */
  metadata: WorkflowMetadataRef;
  /** Agent nodes in the workflow graph. */
  nodes: AgentNodeRef[];
  /** Transitions (edges) connecting nodes. */
  transitions: TransitionRef[];
  /** HITL gate definitions attached to nodes. */
  gates: HITLGateDefinitionRef[];
  /** Variable declarations for the workflow. */
  variables: WorkflowVariableRef[];
}

/**
 * Runtime state of a single node within an active execution.
 */
export interface NodeExecutionStateRef {
  /** ID of the workflow node this state tracks. */
  nodeId: string;
  /** Current execution status of this node. */
  status: NodeExecutionStatus;
  /** ISO 8601 timestamp when execution of this node began. */
  startedAt?: string;
  /** ISO 8601 timestamp when execution of this node ended. */
  completedAt?: string;
  /** Output data produced by the node (shape varies by agent type). */
  output?: unknown;
  /** Error message if the node failed. */
  error?: string;
  /** CLI session ID if this node spawned a Claude CLI session. */
  cliSessionId?: string;
}

// ---------------------------------------------------------------------------
// Error response
// ---------------------------------------------------------------------------

/**
 * Standard error response returned by all endpoints on failure.
 *
 * HTTP status codes:
 * - 400: Validation error (missing fields, invalid workflow)
 * - 404: Execution not found
 * - 409: Conflict (e.g. execution already running, invalid state transition)
 * - 500: Internal server error
 * - 503: Orchestrator unavailable
 */
export interface ApiErrorResponse {
  /** Human-readable error message. */
  error: string;
  /** Machine-readable error code for programmatic handling. */
  code: ExecutionErrorCode;
  /** Additional structured details about the error. */
  details?: Record<string, unknown>;
}

/** Enumeration of machine-readable error codes. */
export type ExecutionErrorCode =
  | 'VALIDATION_ERROR'
  | 'EXECUTION_NOT_FOUND'
  | 'WORKFLOW_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'GATE_NOT_PENDING'
  | 'EXECUTION_ALREADY_RUNNING'
  | 'EXECUTION_NOT_PAUSABLE'
  | 'EXECUTION_NOT_RESUMABLE'
  | 'EXECUTION_NOT_ABORTABLE'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

// ---------------------------------------------------------------------------
// POST /api/execution/start
// ---------------------------------------------------------------------------

/**
 * Request body for starting a new workflow execution.
 *
 * The caller provides the full workflow definition so the orchestrator
 * has a self-contained snapshot of the workflow at execution time,
 * decoupled from any subsequent edits in the Workflow Studio.
 *
 * HTTP: POST /api/execution/start
 */
export interface StartExecutionRequest {
  /** ID of the workflow definition being executed. */
  workflowId: string;
  /** Full workflow definition snapshot. */
  workflow: WorkflowDefinitionRef;
  /** Optional work item (PRD, issue, idea) this execution targets. */
  workItem?: WorkItemRef;
  /** Initial variable values, keyed by variable name. */
  variables?: Record<string, unknown>;
}

/**
 * Response after successfully starting an execution.
 *
 * HTTP: 201 Created
 */
export interface StartExecutionResponse {
  /** Unique identifier for the new execution. */
  executionId: string;
  /** Initial status (will be 'pending' or 'running'). */
  status: ExecutionStatus;
  /** ISO 8601 timestamp when the execution was created. */
  startedAt: string;
  /** ID of the first node that will execute (if workflow is non-empty). */
  currentNodeId?: string;
}

// ---------------------------------------------------------------------------
// GET /api/execution/:id
// ---------------------------------------------------------------------------

/**
 * Full execution state returned when querying a specific execution.
 *
 * HTTP: GET /api/execution/:id
 *
 * Path params:
 * - id: string (execution ID)
 *
 * Response: 200 OK
 */
export interface GetExecutionResponse {
  /** Unique execution identifier. */
  id: string;
  /** ID of the workflow definition this execution was started from. */
  workflowId: string;
  /** Snapshot of the workflow definition at execution start time. */
  workflow: WorkflowDefinitionRef;
  /** Work item reference, if this execution is tied to one. */
  workItem?: WorkItemRef;
  /** Current overall execution status. */
  status: ExecutionStatus;
  /** ID of the node currently executing, if any. */
  currentNodeId?: string;
  /** Per-node execution states, keyed by node ID. */
  nodeStates: Record<string, NodeExecutionStateRef>;
  /** Chronological list of execution events. */
  events: ExecutionEventRef[];
  /** Current variable values. */
  variables: Record<string, unknown>;
  /** ISO 8601 timestamp when the execution started. */
  startedAt: string;
  /** ISO 8601 timestamp when the execution ended (null if still running). */
  completedAt?: string;
}

/**
 * Compact event record embedded in the execution response.
 */
export interface ExecutionEventRef {
  /** Unique event identifier. */
  id: string;
  /** Event type discriminator. */
  type: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Node ID associated with this event (if node-scoped). */
  nodeId?: string;
  /** Type-specific event payload. */
  data?: unknown;
  /** Human-readable event summary. */
  message: string;
}

// ---------------------------------------------------------------------------
// GET /api/execution (list executions)
// ---------------------------------------------------------------------------

/**
 * Query parameters for listing executions.
 *
 * HTTP: GET /api/execution
 */
export interface ListExecutionsParams {
  /** Filter by execution status. */
  status?: ExecutionStatus;
  /** Filter by workflow ID. */
  workflowId?: string;
  /** Page number (1-based). Default: 1. */
  page?: number;
  /** Results per page (1-100). Default: 20. */
  pageSize?: number;
}

/**
 * Summary of a single execution in a list response.
 */
export interface ExecutionSummary {
  /** Unique execution identifier. */
  id: string;
  /** Workflow ID this execution was started from. */
  workflowId: string;
  /** Workflow name (from metadata.name). */
  workflowName: string;
  /** Current execution status. */
  status: ExecutionStatus;
  /** ID of the currently active node, if any. */
  currentNodeId?: string;
  /** Number of nodes that have completed. */
  completedNodes: number;
  /** Total number of nodes in the workflow. */
  totalNodes: number;
  /** ISO 8601 start timestamp. */
  startedAt: string;
  /** ISO 8601 completion timestamp (null if still active). */
  completedAt?: string;
}

/**
 * Paginated list of executions.
 *
 * HTTP: 200 OK
 */
export interface ListExecutionsResponse {
  /** Execution summaries for the current page. */
  executions: ExecutionSummary[];
  /** Total number of executions matching the filter. */
  total: number;
  /** Current page number. */
  page: number;
  /** Number of results per page. */
  pageSize: number;
}

// ---------------------------------------------------------------------------
// POST /api/execution/:id/pause
// ---------------------------------------------------------------------------

/**
 * Pause a running execution. Only valid when status is 'running'.
 *
 * HTTP: POST /api/execution/:id/pause
 *
 * Path params:
 * - id: string (execution ID)
 *
 * Request body: none
 *
 * Response: 200 OK
 * Error: 409 if execution is not in a pausable state
 */
export interface PauseExecutionResponse {
  /** Execution ID. */
  executionId: string;
  /** Updated status (will be 'paused'). */
  status: ExecutionStatus;
  /** ISO 8601 timestamp of the pause event. */
  pausedAt: string;
}

// ---------------------------------------------------------------------------
// POST /api/execution/:id/resume
// ---------------------------------------------------------------------------

/**
 * Resume a paused execution. Only valid when status is 'paused'.
 *
 * HTTP: POST /api/execution/:id/resume
 *
 * Path params:
 * - id: string (execution ID)
 *
 * Request body: none
 *
 * Response: 200 OK
 * Error: 409 if execution is not in a resumable state
 */
export interface ResumeExecutionResponse {
  /** Execution ID. */
  executionId: string;
  /** Updated status (will be 'running'). */
  status: ExecutionStatus;
  /** ISO 8601 timestamp of the resume event. */
  resumedAt: string;
}

// ---------------------------------------------------------------------------
// POST /api/execution/:id/abort
// ---------------------------------------------------------------------------

/**
 * Abort an execution. Valid when status is 'running', 'paused', or
 * 'waiting_gate'. Terminates any active CLI sessions and marks all
 * pending nodes as skipped.
 *
 * HTTP: POST /api/execution/:id/abort
 *
 * Path params:
 * - id: string (execution ID)
 *
 * Request body: optional
 */
export interface AbortExecutionRequest {
  /** Optional reason for the abort (recorded in the audit trail). */
  reason?: string;
}

/**
 * Response: 200 OK
 * Error: 409 if execution is already in a terminal state
 */
export interface AbortExecutionResponse {
  /** Execution ID. */
  executionId: string;
  /** Updated status (will be 'aborted'). */
  status: ExecutionStatus;
  /** ISO 8601 timestamp of the abort event. */
  abortedAt: string;
}

// ---------------------------------------------------------------------------
// POST /api/execution/:id/gate-decision
// ---------------------------------------------------------------------------

/**
 * Submit a human decision for a pending HITL gate.
 * Only valid when the execution status is 'waiting_gate' and the
 * specified gate is in a pending state.
 *
 * HTTP: POST /api/execution/:id/gate-decision
 *
 * Path params:
 * - id: string (execution ID)
 */
export interface GateDecisionRequest {
  /** ID of the HITL gate definition being decided. */
  gateId: string;
  /** ID of the node the gate is attached to. */
  nodeId: string;
  /** The value selected from the gate's options. */
  selectedOption: string;
  /** Identity of the human making the decision. */
  decidedBy: string;
  /** Optional free-text reason or feedback. */
  reason?: string;
}

/**
 * Response: 200 OK
 * Error: 404 if gate not found, 409 if gate is not pending
 */
export interface GateDecisionResponse {
  /** Execution ID. */
  executionId: string;
  /** Gate ID that was decided. */
  gateId: string;
  /** The option value that was selected. */
  selectedOption: string;
  /** Updated execution status after the gate decision. */
  status: ExecutionStatus;
  /** ID of the next node that will execute after the gate, if any. */
  nextNodeId?: string;
}

// ---------------------------------------------------------------------------
// GET /api/execution/:id/gates
// ---------------------------------------------------------------------------

/**
 * List all HITL gates for an execution, with their current state.
 *
 * HTTP: GET /api/execution/:id/gates
 *
 * Path params:
 * - id: string (execution ID)
 *
 * Response: 200 OK
 */
export interface ListExecutionGatesResponse {
  /** All gates in this execution. */
  gates: ExecutionGateState[];
}

/**
 * Runtime state of a single HITL gate within an execution.
 */
export interface ExecutionGateState {
  /** Gate definition ID. */
  gateId: string;
  /** Node this gate is attached to. */
  nodeId: string;
  /** Gate classification. */
  gateType: GateType;
  /** Prompt text shown to the reviewer. */
  prompt: string;
  /** Available options. */
  options: GateOptionRef[];
  /** Current gate state. */
  status: 'pending' | 'decided' | 'expired' | 'skipped';
  /** The decision, if one has been made. */
  decision?: {
    /** Selected option value. */
    selectedOption: string;
    /** Who made the decision. */
    decidedBy: string;
    /** Optional reason. */
    reason?: string;
    /** ISO 8601 timestamp of the decision. */
    decidedAt: string;
  };
}
