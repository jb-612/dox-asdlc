import type { ExecutionStatus } from './execution';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  nodeId: string;
  startedAt: string;
  completedAt?: string;
}

export interface BlockCost {
  blockId: string;
  nodeId: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
}

export interface ExecutionCostSummary {
  executionId: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  blockCosts: BlockCost[];
}

export interface DailyCostPoint {
  date: string;
  totalCostUsd: number;
}

export interface DailyAnalytics {
  date: string;
  executions: ExecutionCostSummary[];
  totalCostUsd: number;
}
