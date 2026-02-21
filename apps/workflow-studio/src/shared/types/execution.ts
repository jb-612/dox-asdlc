import type { WorkflowDefinition } from './workflow';
import type { WorkItemReference } from './workitem';

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
}

export type ExecutionEventType =
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_aborted'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'gate_reached'
  | 'gate_decided'
  | 'variable_set'
  | 'cli_spawned'
  | 'cli_output'
  | 'cli_exited';

export interface ExecutionEvent {
  id: string;
  type: ExecutionEventType;
  timestamp: string;
  nodeId?: string;
  data?: unknown;
  message: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  workflow: WorkflowDefinition;
  workItem?: WorkItemReference;
  status: ExecutionStatus;
  currentNodeId?: string;
  nodeStates: Record<string, NodeExecutionState>;
  events: ExecutionEvent[];
  variables: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}
