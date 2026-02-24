import type { ScrutinyLevel } from './execution';

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
  | 'release'
  | 'cursor';

export interface PortSchema {
  name: string;
  type: 'input' | 'output';
  dataType: string;
  required: boolean;
  description?: string;
}

/**
 * Controls whether execution pauses after this block for human review.
 * - 'auto_continue': block runs and moves on automatically (default)
 * - 'gate': execution pauses after block completes; user sees deliverables
 *   and chooses to Continue or Revise
 */
export type GateMode = 'auto_continue' | 'gate';

export interface AgentNodeConfig {
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  allowedTools?: string[];
  systemPrompt?: string;
  /** Prepended to systemPrompt at execution time (harness-level override) */
  systemPromptPrefix?: string;
  /** Checklist of expected outputs; shown in gate deliverables view */
  outputChecklist?: string[];
  timeoutSeconds?: number;
  extraFlags?: string[];
  backend?: 'claude' | 'cursor' | 'codex';
  /** Per-block gate mode for multi-step UX (P15-F04) */
  gateMode?: GateMode;
}

export interface AgentNode {
  id: string;
  type: AgentNodeType;
  label: string;
  config: AgentNodeConfig;
  inputs: PortSchema[];
  outputs: PortSchema[];
  position: { x: number; y: number };
  description?: string;
}

// ---------------------------------------------------------------------------
// Block types (P15-F01 Studio Block Composer)
// ---------------------------------------------------------------------------

/** High-level block type for the Studio block composer. */
export type BlockType = 'plan' | 'dev' | 'test' | 'review' | 'devops';

// ---------------------------------------------------------------------------
// Parallel execution (P15-F05)
// ---------------------------------------------------------------------------

/** A group of node IDs that execute in parallel fan-out / fan-in */
export interface ParallelGroup {
  id: string;
  /** Human-readable label for the group */
  label: string;
  /** Node IDs that run concurrently inside this group */
  laneNodeIds: string[];
  /**
   * Dormancy timeout in milliseconds for this specific group's containers.
   * Configurable per-template rather than globally in Settings.
   */
  dormancyTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export type TransitionConditionType = 'always' | 'on_success' | 'on_failure' | 'expression';

export interface TransitionCondition {
  type: TransitionConditionType;
  expression?: string;
}

export interface Transition {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition: TransitionCondition;
  label?: string;
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

export type GateType = 'approval' | 'review' | 'decision' | 'confirmation';

export interface GateOption {
  label: string;
  value: string;
  description?: string;
  isDefault?: boolean;
}

export interface HITLGateDefinition {
  id: string;
  nodeId: string;
  gateType: GateType;
  prompt: string;
  options: GateOption[];
  timeoutSeconds?: number;
  required: boolean;
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  defaultValue?: unknown;
  description?: string;
  required: boolean;
}

// ---------------------------------------------------------------------------
// Metadata & definition
// ---------------------------------------------------------------------------

export type WorkflowStatus = 'active' | 'paused';

export interface WorkflowMetadata {
  name: string;
  description?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags: string[];
  /** Whether the workflow appears in the Execute launcher (P15-F02/F03) */
  status?: WorkflowStatus;
  /** ISO timestamp of last execution (used for sorting in Execute tab) */
  lastUsedAt?: string;
}

export interface WorkflowDefinition {
  id: string;
  metadata: WorkflowMetadata;
  nodes: AgentNode[];
  transitions: Transition[];
  gates: HITLGateDefinition[];
  variables: WorkflowVariable[];
  /** Parallel fan-out groups (P15-F05) */
  parallelGroups?: ParallelGroup[];
  /** Workflow-level rules injected into all agent system prompts */
  rules?: string[];
  /** Default scrutiny level for gate deliverable views */
  defaultScrutinyLevel?: ScrutinyLevel;
}
