import type { WorkflowDefinition } from './workflow';
import type { WorkItemReference } from './workitem';
import type { RepoMount } from './repo';

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'waiting_gate'
  | 'completed'
  | 'failed'
  | 'aborted';

export type NodeExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_gate';

export interface NodeExecutionState {
  nodeId: string;
  status: NodeExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
  cliSessionId?: string;
  /** Number of times this block has been revised (P15-F04) */
  revisionCount?: number;
  /** Per-block gate mode inherited from AgentNodeConfig (P15-F04) */
  gateMode?: 'auto_continue' | 'gate';
}

export type ExecutionEventType =
  | 'execution_started'
  | 'execution_paused'
  | 'execution_resumed'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_aborted'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'node_skipped'
  | 'gate_waiting'
  | 'gate_decided'
  | 'cli_output'
  | 'cli_error'
  | 'cli_exit'
  | 'variable_updated'
  // P15-F04: enhanced event types for multi-step UX
  | 'tool_call'
  | 'bash_command'
  | 'block_gate_open'
  | 'block_revision';

export interface ExecutionEvent {
  id: string;
  type: ExecutionEventType;
  timestamp: string;
  nodeId?: string;
  data?: unknown;
  message: string;
}

// ---------------------------------------------------------------------------
// Block deliverables (P15-F04)
// ---------------------------------------------------------------------------

/**
 * Controls how much output is shown in the gate deliverable view.
 * - 'summary': one-paragraph description of outputs
 * - 'file_list': list of files created/modified
 * - 'full_content': full file contents (may be large)
 * - 'full_detail': inline annotations per file
 */
export type ScrutinyLevel = 'summary' | 'file_list' | 'full_content' | 'full_detail';

export interface PlanBlockDeliverables {
  blockType: 'plan';
  markdownDocument?: string;
  taskList?: string[];
}

export interface CodeBlockDeliverables {
  blockType: 'code';
  filesChanged?: string[];
  diffSummary?: string;
}

export interface GenericBlockDeliverables {
  blockType: 'generic';
  summary?: string;
}

export type BlockDeliverables =
  | PlanBlockDeliverables
  | CodeBlockDeliverables
  | GenericBlockDeliverables;

// ---------------------------------------------------------------------------
// File entries for deliverables viewer (P15-F04)
// ---------------------------------------------------------------------------

export interface FileEntry {
  path: string;
  size?: number;
  lineCount?: number;
  status?: 'added' | 'modified' | 'deleted';
}

export interface FileDiff {
  path: string;
  oldContent?: string;
  newContent?: string;
  hunks?: string[];
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface Execution {
  id: string;
  workflowId: string;
  workflow: WorkflowDefinition;
  workItem?: WorkItemReference;
  /** Repo mounted for this execution run (P15-F03) */
  repoMount?: RepoMount;
  status: ExecutionStatus;
  currentNodeId?: string;
  nodeStates: Record<string, NodeExecutionState>;
  events: ExecutionEvent[];
  variables: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}
