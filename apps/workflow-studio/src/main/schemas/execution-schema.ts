import { z } from 'zod';
import { WorkflowDefinitionSchema } from './workflow-schema';

// ---------------------------------------------------------------------------
// Zod schemas that mirror the TypeScript interfaces in shared/types/execution.ts
// ---------------------------------------------------------------------------

export const EXECUTION_STATUSES = [
  'pending',
  'running',
  'paused',
  'waiting_gate',
  'completed',
  'failed',
  'aborted',
] as const;

export const ExecutionStatusSchema = z.enum(EXECUTION_STATUSES);

export const NODE_EXECUTION_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'waiting_gate',
] as const;

export const NodeExecutionStatusSchema = z.enum(NODE_EXECUTION_STATUSES);

export const NodeExecutionStateSchema = z.object({
  nodeId: z.string().uuid(),
  status: NodeExecutionStatusSchema,
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  cliSessionId: z.string().optional(),
});

export const EXECUTION_EVENT_TYPES = [
  'execution_started',
  'execution_completed',
  'execution_failed',
  'execution_aborted',
  'node_started',
  'node_completed',
  'node_failed',
  'gate_reached',
  'gate_decided',
  'variable_set',
  'cli_spawned',
  'cli_output',
  'cli_exited',
] as const;

export const ExecutionEventTypeSchema = z.enum(EXECUTION_EVENT_TYPES);

export const ExecutionEventSchema = z.object({
  id: z.string().uuid(),
  type: ExecutionEventTypeSchema,
  timestamp: z.string(),
  nodeId: z.string().uuid().optional(),
  data: z.unknown().optional(),
  message: z.string(),
});

export const WorkItemReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(['prd', 'issue', 'idea', 'manual']),
  source: z.enum(['filesystem', 'github', 'manual']),
  title: z.string().min(1),
  description: z.string().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export const ExecutionSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  workflow: WorkflowDefinitionSchema,
  workItem: WorkItemReferenceSchema.optional(),
  status: ExecutionStatusSchema,
  currentNodeId: z.string().uuid().optional(),
  nodeStates: z.record(z.string(), NodeExecutionStateSchema),
  events: z.array(ExecutionEventSchema),
  variables: z.record(z.string(), z.unknown()),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Request schemas for IPC handler validation
// ---------------------------------------------------------------------------

export const ExecutionStartRequestSchema = z.object({
  workflowId: z.string().uuid(),
  workItemId: z.string().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
});

export const GateDecisionRequestSchema = z.object({
  executionId: z.string().uuid(),
  gateId: z.string().uuid(),
  decision: z.string().min(1),
  comment: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Type inference helpers
// ---------------------------------------------------------------------------

export type ValidatedExecution = z.infer<typeof ExecutionSchema>;
export type ValidatedExecutionStartRequest = z.infer<typeof ExecutionStartRequestSchema>;
export type ValidatedGateDecisionRequest = z.infer<typeof GateDecisionRequestSchema>;
