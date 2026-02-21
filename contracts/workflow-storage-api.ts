/**
 * Workflow Storage REST API Contract
 *
 * REST API for persisting and retrieving workflow definitions between
 * the Electron Workflow Studio and the aSDLC orchestrator service.
 *
 * Base path: /api/workflows
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

/** HITL gate types. */
export type GateType = 'approval' | 'review' | 'decision' | 'confirmation';

/** Condition evaluation strategy for transitions. */
export type TransitionConditionType = 'always' | 'on_success' | 'on_failure' | 'expression';

/** Variable data types supported in workflow definitions. */
export type WorkflowVariableType = 'string' | 'number' | 'boolean' | 'json';

// ---------------------------------------------------------------------------
// Embedded sub-types (mirrors of the Workflow Studio shared types)
// ---------------------------------------------------------------------------

/**
 * Port schema describing an input or output connector on an agent node.
 */
export interface PortSchema {
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
export interface AgentNodeConfig {
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
 * Agent node within a workflow definition.
 */
export interface AgentNode {
  /** Unique node identifier within the workflow. */
  id: string;
  /** Agent specialization type. */
  type: AgentNodeType;
  /** Display label in the visual editor. */
  label: string;
  /** Runtime configuration for this agent. */
  config: AgentNodeConfig;
  /** Input port schemas. */
  inputs: PortSchema[];
  /** Output port schemas. */
  outputs: PortSchema[];
  /** Canvas position for the visual editor (pixels). */
  position: { x: number; y: number };
  /** Optional human-readable description of what this node does. */
  description?: string;
}

/**
 * Condition governing when a transition fires.
 */
export interface TransitionCondition {
  /** Condition evaluation strategy. */
  type: TransitionConditionType;
  /** CEL or JS expression (required when type is 'expression'). */
  expression?: string;
}

/**
 * Directed edge between two agent nodes in the workflow graph.
 */
export interface Transition {
  /** Unique transition identifier. */
  id: string;
  /** ID of the source node. */
  sourceNodeId: string;
  /** ID of the target node. */
  targetNodeId: string;
  /** When this transition should fire. */
  condition: TransitionCondition;
  /** Optional display label on the edge. */
  label?: string;
}

/**
 * One selectable option presented at a HITL gate.
 */
export interface GateOption {
  /** Button or choice label. */
  label: string;
  /** Machine-readable value returned on selection. */
  value: string;
  /** Tooltip or extended description. */
  description?: string;
  /** Whether this option is pre-selected by default. */
  isDefault?: boolean;
}

/**
 * Definition of a human-in-the-loop gate attached to a workflow node.
 */
export interface HITLGateDefinition {
  /** Unique gate identifier within the workflow. */
  id: string;
  /** Node this gate is attached to (must reference a valid node ID). */
  nodeId: string;
  /** Gate classification. */
  gateType: GateType;
  /** Prompt text shown to the human reviewer. */
  prompt: string;
  /** Available response options. */
  options: GateOption[];
  /** Seconds before the gate auto-expires (null = no timeout). */
  timeoutSeconds?: number;
  /** Whether the gate must be decided before execution continues. */
  required: boolean;
}

/**
 * Variable definition declared in the workflow schema.
 */
export interface WorkflowVariable {
  /** Variable name (used as key in the variables record). */
  name: string;
  /** Runtime data type. */
  type: WorkflowVariableType;
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
export interface WorkflowMetadata {
  /** Display name of the workflow. */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** Semantic version string (e.g. "1.0.0"). */
  version: string;
  /** ISO 8601 creation timestamp (set by server). */
  createdAt: string;
  /** ISO 8601 last-updated timestamp (set by server). */
  updatedAt: string;
  /** Creator identity (user or agent ID). */
  createdBy?: string;
  /** Freeform tags for filtering and search. */
  tags: string[];
}

/**
 * Full workflow definition, the primary data model for workflow storage.
 */
export interface WorkflowDefinition {
  /** Unique workflow identifier (UUID). */
  id: string;
  /** Workflow metadata envelope. */
  metadata: WorkflowMetadata;
  /** Agent nodes in the workflow graph. */
  nodes: AgentNode[];
  /** Transitions (edges) connecting nodes. */
  transitions: Transition[];
  /** HITL gate definitions attached to nodes. */
  gates: HITLGateDefinition[];
  /** Variable declarations for the workflow. */
  variables: WorkflowVariable[];
}

// ---------------------------------------------------------------------------
// Error response
// ---------------------------------------------------------------------------

/**
 * Standard error response returned by all endpoints on failure.
 *
 * HTTP status codes:
 * - 400: Validation error (malformed workflow, missing fields)
 * - 404: Workflow not found
 * - 409: Conflict (e.g. concurrent update, duplicate name)
 * - 500: Internal server error
 * - 503: Storage backend unavailable
 */
export interface ApiErrorResponse {
  /** Human-readable error message. */
  error: string;
  /** Machine-readable error code for programmatic handling. */
  code: StorageErrorCode;
  /** Additional structured details about the error. */
  details?: Record<string, unknown>;
}

/** Enumeration of machine-readable error codes. */
export type StorageErrorCode =
  | 'VALIDATION_ERROR'
  | 'WORKFLOW_NOT_FOUND'
  | 'TEMPLATE_NOT_FOUND'
  | 'DUPLICATE_NAME'
  | 'VERSION_CONFLICT'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

// ---------------------------------------------------------------------------
// GET /api/workflows
// ---------------------------------------------------------------------------

/**
 * Query parameters for listing workflows.
 *
 * HTTP: GET /api/workflows
 */
export interface ListWorkflowsParams {
  /** Full-text search across name, description, and tags. */
  search?: string;
  /** Filter by tag (multiple tags = AND logic). */
  tags?: string[];
  /** Filter by creator identity. */
  createdBy?: string;
  /** Sort field. Default: 'updatedAt'. */
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  /** Sort direction. Default: 'desc'. */
  sortOrder?: 'asc' | 'desc';
  /** Page number (1-based). Default: 1. */
  page?: number;
  /** Results per page (1-100). Default: 20. */
  pageSize?: number;
}

/**
 * Compact workflow summary for list views (omits full node/transition data).
 */
export interface WorkflowSummary {
  /** Unique workflow identifier. */
  id: string;
  /** Workflow display name. */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** Semantic version string. */
  version: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
  /** Creator identity. */
  createdBy?: string;
  /** Freeform tags. */
  tags: string[];
  /** Number of agent nodes in the workflow. */
  nodeCount: number;
  /** Number of transitions in the workflow. */
  transitionCount: number;
  /** Number of HITL gates in the workflow. */
  gateCount: number;
}

/**
 * Paginated list of workflow summaries.
 *
 * HTTP: 200 OK
 */
export interface ListWorkflowsResponse {
  /** Workflow summaries for the current page. */
  workflows: WorkflowSummary[];
  /** Total number of workflows matching the filter. */
  total: number;
  /** Current page number. */
  page: number;
  /** Number of results per page. */
  pageSize: number;
}

// ---------------------------------------------------------------------------
// GET /api/workflows/:id
// ---------------------------------------------------------------------------

/**
 * Retrieve the full workflow definition by ID.
 *
 * HTTP: GET /api/workflows/:id
 *
 * Path params:
 * - id: string (workflow ID)
 *
 * Response: 200 OK with WorkflowDefinition
 * Error: 404 if not found
 */
export type GetWorkflowResponse = WorkflowDefinition;

// ---------------------------------------------------------------------------
// POST /api/workflows
// ---------------------------------------------------------------------------

/**
 * Request body for creating a new workflow.
 * The server generates the `id`, `createdAt`, and `updatedAt` fields.
 *
 * HTTP: POST /api/workflows
 */
export interface CreateWorkflowRequest {
  /** Workflow metadata. The `createdAt` and `updatedAt` fields are
   *  ignored if provided; the server sets them. */
  metadata: {
    /** Display name (required, must be non-empty). */
    name: string;
    /** Human-readable description. */
    description?: string;
    /** Semantic version string. Default: "1.0.0". */
    version?: string;
    /** Creator identity. */
    createdBy?: string;
    /** Freeform tags for filtering and search. */
    tags?: string[];
  };
  /** Agent nodes in the workflow graph. */
  nodes: AgentNode[];
  /** Transitions (edges) connecting nodes. */
  transitions: Transition[];
  /** HITL gate definitions attached to nodes. */
  gates: HITLGateDefinition[];
  /** Variable declarations for the workflow. */
  variables: WorkflowVariable[];
}

/**
 * Response: 201 Created with full WorkflowDefinition (including server-generated fields).
 */
export type CreateWorkflowResponse = WorkflowDefinition;

// ---------------------------------------------------------------------------
// PUT /api/workflows/:id
// ---------------------------------------------------------------------------

/**
 * Request body for updating an existing workflow.
 * All fields are optional; only provided fields are updated.
 * The server bumps `updatedAt` automatically.
 *
 * HTTP: PUT /api/workflows/:id
 *
 * Path params:
 * - id: string (workflow ID)
 */
export interface UpdateWorkflowRequest {
  /** Metadata fields to update (partial update supported). */
  metadata?: {
    /** Updated display name. */
    name?: string;
    /** Updated description. */
    description?: string;
    /** Updated version string. */
    version?: string;
    /** Updated tags (replaces existing tags). */
    tags?: string[];
  };
  /** Updated agent nodes (replaces entire nodes array). */
  nodes?: AgentNode[];
  /** Updated transitions (replaces entire transitions array). */
  transitions?: Transition[];
  /** Updated HITL gates (replaces entire gates array). */
  gates?: HITLGateDefinition[];
  /** Updated variable declarations (replaces entire variables array). */
  variables?: WorkflowVariable[];
}

/**
 * Response: 200 OK with the updated full WorkflowDefinition.
 * Error: 404 if not found, 409 on version conflict.
 */
export type UpdateWorkflowResponse = WorkflowDefinition;

// ---------------------------------------------------------------------------
// DELETE /api/workflows/:id
// ---------------------------------------------------------------------------

/**
 * Delete a workflow definition by ID.
 *
 * HTTP: DELETE /api/workflows/:id
 *
 * Path params:
 * - id: string (workflow ID)
 *
 * Response: 204 No Content on success.
 * Error: 404 if not found.
 *
 * Note: Deleting a workflow does not affect existing executions that
 * were started from it (they hold a snapshot of the definition).
 */

// ---------------------------------------------------------------------------
// GET /api/workflows/templates
// ---------------------------------------------------------------------------

/**
 * Query parameters for listing built-in workflow templates.
 *
 * HTTP: GET /api/workflows/templates
 */
export interface ListTemplatesParams {
  /** Filter by tag. */
  tags?: string[];
  /** Full-text search across name and description. */
  search?: string;
}

/**
 * A built-in workflow template that can be cloned into a user workflow.
 */
export interface WorkflowTemplate {
  /** Unique template identifier. */
  id: string;
  /** Template display name. */
  name: string;
  /** Detailed description of what this template does. */
  description: string;
  /** Tags for categorization (e.g. "tdd", "review", "full-cycle"). */
  tags: string[];
  /** Number of agent nodes in the template. */
  nodeCount: number;
  /** Number of transitions in the template. */
  transitionCount: number;
  /** Number of HITL gates in the template. */
  gateCount: number;
  /** The full workflow definition of the template. */
  workflow: WorkflowDefinition;
}

/**
 * List of available built-in templates.
 *
 * HTTP: 200 OK
 */
export interface ListTemplatesResponse {
  /** Available workflow templates. */
  templates: WorkflowTemplate[];
  /** Total number of templates. */
  total: number;
}

// ---------------------------------------------------------------------------
// POST /api/workflows/:id/clone
// ---------------------------------------------------------------------------

/**
 * Request body for cloning an existing workflow.
 * Creates a new workflow that is a deep copy of the source, with
 * a new ID and optionally overridden metadata fields.
 *
 * HTTP: POST /api/workflows/:id/clone
 *
 * Path params:
 * - id: string (source workflow ID to clone from)
 */
export interface CloneWorkflowRequest {
  /** Name for the cloned workflow. If omitted, defaults to
   *  "Copy of {original name}". */
  name?: string;
  /** Description for the cloned workflow. If omitted, inherits
   *  the original description. */
  description?: string;
  /** Tags for the cloned workflow. If omitted, inherits the
   *  original tags. */
  tags?: string[];
}

/**
 * Response: 201 Created with the full cloned WorkflowDefinition.
 * The cloned workflow has a new ID, new timestamps, and version "1.0.0".
 *
 * Error: 404 if source workflow not found.
 */
export type CloneWorkflowResponse = WorkflowDefinition;
