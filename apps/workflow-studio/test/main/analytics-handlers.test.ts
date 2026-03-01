// @vitest-environment node
// ---------------------------------------------------------------------------
// F16-T07: Analytics IPC channels + handlers
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExecutionCostSummary } from '../../src/shared/types/analytics';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const handleMap = new Map<string, (...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handleMap.set(channel, handler);
    },
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

function makeSummary(overrides: Partial<ExecutionCostSummary> = {}): ExecutionCostSummary {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    workflowName: 'Test',
    status: 'completed',
    startedAt: '2026-03-01T12:00:00Z',
    completedAt: '2026-03-01T12:01:00Z',
    durationMs: 60000,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    totalCostUsd: 0.05,
    blockCosts: [],
    ...overrides,
  };
}

describe('F16-T07: Analytics IPC handlers', { timeout: 30000 }, () => {
  let registerAnalyticsHandlers: typeof import('../../src/main/ipc/analytics-handlers').registerAnalyticsHandlers;

  const mockAnalyticsService = {
    getExecutions: vi.fn(),
    getDailyCosts: vi.fn(),
    saveExecution: vi.fn(),
    pruneOldData: vi.fn(),
  };

  beforeEach(async () => {
    handleMap.clear();
    vi.clearAllMocks();
    const mod = await import('../../src/main/ipc/analytics-handlers');
    registerAnalyticsHandlers = mod.registerAnalyticsHandlers;
    registerAnalyticsHandlers(mockAnalyticsService as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ANALYTICS_GET_EXECUTIONS returns array from service', async () => {
    const expected = [makeSummary()];
    mockAnalyticsService.getExecutions.mockResolvedValue(expected);

    const handler = handleMap.get('analytics:get-executions');
    expect(handler).toBeDefined();

    const result = await handler!({}, '2026-03-01', '2026-03-01');
    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getExecutions).toHaveBeenCalledWith('2026-03-01', '2026-03-01');
  });

  it('ANALYTICS_GET_DAILY_COSTS returns aggregated costs', async () => {
    const expected = [{ date: '2026-03-01', totalCostUsd: 0.30 }];
    mockAnalyticsService.getDailyCosts.mockResolvedValue(expected);

    const handler = handleMap.get('analytics:get-daily-costs');
    expect(handler).toBeDefined();

    const result = await handler!({}, '2026-03-01', '2026-03-01');
    expect(result).toEqual(expected);
  });

  it('ANALYTICS_GET_EXECUTION returns single execution by id', async () => {
    const all = [makeSummary({ executionId: 'exec-1' }), makeSummary({ executionId: 'exec-2' })];
    mockAnalyticsService.getExecutions.mockResolvedValue(all);

    const handler = handleMap.get('analytics:get-execution');
    expect(handler).toBeDefined();

    const result = await handler!({}, 'exec-2', '2026-03-01', '2026-03-01');
    expect(result).toEqual(all[1]);
  });
});
