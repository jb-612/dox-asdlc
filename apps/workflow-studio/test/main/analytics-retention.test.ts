// @vitest-environment node
// ---------------------------------------------------------------------------
// F16-T12: Retention + cleanup test
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readdir, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ExecutionCostSummary } from '../../src/shared/types/analytics';

describe('F16-T12: Analytics retention', { timeout: 30000 }, () => {
  let AnalyticsService: typeof import('../../src/main/services/analytics-service').AnalyticsService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'analytics-retention-'));
    const mod = await import('../../src/main/services/analytics-service');
    AnalyticsService = mod.AnalyticsService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('pruning removes files older than 90 days', async () => {
    const svc = new AnalyticsService(tempDir);

    // Create old file (120 days ago)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 120);
    const oldStr = oldDate.toISOString().slice(0, 10);
    await writeFile(
      join(tempDir, `${oldStr}.json`),
      JSON.stringify({ date: oldStr, executions: [], totalCostUsd: 0 }),
    );

    // Create recent file
    await svc.saveExecution(makeSummary());

    await svc.pruneOldData(90);

    const files = await readdir(tempDir);
    expect(files).not.toContain(`${oldStr}.json`);
    expect(files.length).toBe(1);
  });

  it('fresh install with no data works', async () => {
    const svc = new AnalyticsService(tempDir);

    const execs = await svc.getExecutions('2026-01-01', '2026-12-31');
    expect(execs).toEqual([]);

    const costs = await svc.getDailyCosts('2026-01-01', '2026-12-31');
    expect(costs).toEqual([]);

    // Prune on empty dir should not throw
    await svc.pruneOldData(90);
  });

  it('data persists after prune and is still readable', async () => {
    const svc = new AnalyticsService(tempDir);
    await svc.saveExecution(makeSummary({ totalCostUsd: 0.15 }));

    await svc.pruneOldData(90);

    const costs = await svc.getDailyCosts('2026-03-01', '2026-03-01');
    expect(costs.length).toBe(1);
    expect(costs[0].totalCostUsd).toBeCloseTo(0.15);
  });
});
