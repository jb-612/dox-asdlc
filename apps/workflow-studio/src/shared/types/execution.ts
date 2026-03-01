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
  /** Number of retry attempts for this node (P15-F14) */
  retryCount?: number;
  /** ISO timestamp of the last retry attempt (P15-F14) */
  lastRetryAt?: string;
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
  | 'block_revision'
  // P15-F14: retry and timeout events
  | 'node_retry'
  | 'node_retry_exhausted'
  | 'node_timeout_warning';

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
  fileDiffs?: FileDiff[];
}

export interface TestBlockDeliverables {
  blockType: 'test';
  testResults?: { passed: number; failed: number; skipped: number };
  summary?: string;
}

export interface ReviewBlockDeliverables {
  blockType: 'review';
  findings?: string[];
  approved?: boolean;
  summary?: string;
}

export interface DevopsBlockDeliverables {
  blockType: 'devops';
  operations?: string[];
  status?: string;
  summary?: string;
}

export interface GenericBlockDeliverables {
  blockType: 'generic';
  summary?: string;
}

export type BlockDeliverables =
  | PlanBlockDeliverables
  | CodeBlockDeliverables
  | TestBlockDeliverables
  | ReviewBlockDeliverables
  | DevopsBlockDeliverables
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
// Block results (P15-F04 / F05)
// ---------------------------------------------------------------------------

/** Outcome of a single block execution within a workflow run. */
export interface BlockResult {
  blockId: string;
  nodeId: string;
  status: 'success' | 'failed' | 'skipped';
  deliverables?: BlockDeliverables;
  /** Path to the serialised output file, e.g. .output/block-<id>.json */
  outputPath?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Container tracking (P15-F05 parallel execution)
// ---------------------------------------------------------------------------

/** Lifecycle state of a Docker container managed by the parallel execution engine. */
export type ContainerState =
  | 'starting'
  | 'idle'
  | 'running'
  | 'dormant'
  | 'terminated';

/** Record tracking a single Docker container used during parallel execution. */
export interface ContainerRecord {
  /** Docker container ID */
  id: string;
  state: ContainerState;
  /** Currently assigned block (null when idle/dormant) */
  blockId: string | null;
  /** Host port mapped to the container agent */
  port: number;
  /** Agent endpoint URL, e.g. http://localhost:<port> */
  agentUrl: string;
  /** Timestamp (Date.now()) when container was created */
  createdAt: number;
  /** Timestamp when container entered dormant state, null otherwise */
  dormantSince: number | null;
}

// ---------------------------------------------------------------------------
// Parallel block result (P15-F05)
// ---------------------------------------------------------------------------

/**
 * Outcome of a single block execution inside a parallel lane.
 * Distinguished from {@link BlockResult} which tracks deliverables for the
 * gate/review workflow (P15-F04).
 */
export interface ParallelBlockResult {
  blockId: string;
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Merge conflict resolution (P15-F09)
// ---------------------------------------------------------------------------

export interface MergeConflict {
  filePath: string;
  blockAId: string;
  blockBId: string;
}

export interface MergeResolution {
  filePath: string;
  keepBlockId: string | 'abort';
}

// ---------------------------------------------------------------------------
// Execution History (P15-F14)
// ---------------------------------------------------------------------------

export interface ExecutionHistoryEntry {
  id: string;
  workflowId: string;
  workflowName: string;
  workflow: WorkflowDefinition;
  workItem?: WorkItemReference;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  nodeStates: Record<string, NodeExecutionState>;
  retryStats: Record<string, number>;
}

export type ExecutionHistorySummary = Pick<
  ExecutionHistoryEntry,
  'id' | 'workflowId' | 'workflowName' | 'status' | 'startedAt' | 'completedAt'
>;

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
