// @vitest-environment node
// ---------------------------------------------------------------------------
// F16-T04: AnalyticsService — JSON persistence
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ExecutionCostSummary } from '../../src/shared/types/analytics';

describe('F16-T04: AnalyticsService', { timeout: 30000 }, () => {
  let AnalyticsService: typeof import('../../src/main/services/analytics-service').AnalyticsService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'analytics-test-'));
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

  it('saveExecution writes daily file', async () => {
    const svc = new AnalyticsService(tempDir);
    await svc.saveExecution(makeSummary());

    const files = await readdir(tempDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^2026-03-01\.json$/);

    const content = JSON.parse(await readFile(join(tempDir, files[0]), 'utf-8'));
    expect(content.executions.length).toBe(1);
    expect(content.executions[0].executionId).toBe('exec-1');
  });

  it('getExecutions returns by date range', async () => {
    const svc = new AnalyticsService(tempDir);
    await svc.saveExecution(makeSummary({ startedAt: '2026-03-01T12:00:00Z' }));
    await svc.saveExecution(makeSummary({ executionId: 'exec-2', startedAt: '2026-03-01T13:00:00Z' }));

    const results = await svc.getExecutions('2026-03-01', '2026-03-01');
    expect(results.length).toBe(2);
  });

  it('getDailyCosts aggregates', async () => {
    const svc = new AnalyticsService(tempDir);
    await svc.saveExecution(makeSummary({ totalCostUsd: 0.10 }));
    await svc.saveExecution(makeSummary({ executionId: 'exec-2', totalCostUsd: 0.20 }));

    const costs = await svc.getDailyCosts('2026-03-01', '2026-03-01');
    expect(costs.length).toBe(1);
    expect(costs[0].totalCostUsd).toBeCloseTo(0.30);
  });

  it('pruneOldData removes old files', async () => {
    // Create a file for 100 days ago
    const oldDate = '2025-11-20';
    const oldFile = join(tempDir, `${oldDate}.json`);
    await writeFile(oldFile, JSON.stringify({ date: oldDate, executions: [], totalCostUsd: 0 }));

    // Create today's file
    const svc = new AnalyticsService(tempDir);
    await svc.saveExecution(makeSummary());

    await svc.pruneOldData(90);

    const files = await readdir(tempDir);
    expect(files).not.toContain(`${oldDate}.json`);
    expect(files).toContain('2026-03-01.json');
  });

  it('200/day cap evicts oldest', async () => {
    const svc = new AnalyticsService(tempDir);
    for (let i = 0; i < 201; i++) {
      await svc.saveExecution(makeSummary({ executionId: `exec-${i}` }));
    }

    const results = await svc.getExecutions('2026-03-01', '2026-03-01');
    expect(results.length).toBe(200);
    // First entry should be exec-1 (exec-0 evicted)
    expect(results[0].executionId).toBe('exec-1');
  });
});
