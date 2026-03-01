// @vitest-environment node
// ---------------------------------------------------------------------------
// F16-T01: Analytics and trace types
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import type {
  TraceSpan,
  BlockCost,
  ExecutionCostSummary,
  DailyAnalytics,
} from '../../src/shared/types/analytics';
import type { ExecutionEvent } from '../../src/shared/types/execution';
import type { TelemetryEvent } from '../../src/shared/types/monitoring';

describe('F16-T01: Analytics types', () => {
  it('TraceSpan requires traceId, spanId, nodeId', () => {
    const span: TraceSpan = {
      traceId: 'trace-1',
      spanId: 'span-1',
      nodeId: 'node-1',
      startedAt: '2026-03-01T00:00:00Z',
    };
    expect(span.traceId).toBe('trace-1');
    expect(span.spanId).toBe('span-1');
    expect(span.nodeId).toBe('node-1');
  });

  it('BlockCost requires blockId and token counts', () => {
    const cost: BlockCost = {
      blockId: 'block-1',
      nodeId: 'node-1',
      inputTokens: 1000,
      outputTokens: 500,
      estimatedCostUsd: 0.05,
    };
    expect(cost.blockId).toBe('block-1');
    expect(cost.inputTokens).toBe(1000);
  });

  it('ExecutionCostSummary requires executionId and totalCostUsd', () => {
    const summary: ExecutionCostSummary = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      workflowName: 'Test',
      status: 'completed',
      startedAt: '2026-03-01T00:00:00Z',
      completedAt: '2026-03-01T00:01:00Z',
      durationMs: 60000,
      totalInputTokens: 5000,
      totalOutputTokens: 2000,
      totalCostUsd: 0.25,
      blockCosts: [],
    };
    expect(summary.executionId).toBe('exec-1');
    expect(summary.totalCostUsd).toBe(0.25);
  });

  it('DailyAnalytics groups executions by date', () => {
    const daily: DailyAnalytics = {
      date: '2026-03-01',
      executions: [],
      totalCostUsd: 0,
    };
    expect(daily.date).toBe('2026-03-01');
  });

  it('ExecutionEvent accepts optional traceId and spanId', () => {
    const event: ExecutionEvent = {
      id: 'e1',
      type: 'node_started',
      timestamp: '2026-03-01T00:00:00Z',
      message: 'started',
      traceId: 'trace-1',
      spanId: 'span-1',
    };
    expect(event.traceId).toBe('trace-1');
    expect(event.spanId).toBe('span-1');
  });

  it('TelemetryEvent accepts optional traceId and spanId', () => {
    const event: TelemetryEvent = {
      id: 't1',
      type: 'agent_start',
      agentId: 'agent-1',
      timestamp: '2026-03-01T00:00:00Z',
      data: {},
      traceId: 'trace-1',
      spanId: 'span-1',
    };
    expect(event.traceId).toBe('trace-1');
    expect(event.spanId).toBe('span-1');
  });
});
