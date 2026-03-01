// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ExecutionHistoryService } from '../../src/main/services/execution-history-service';
import type { ExecutionHistoryEntry } from '../../src/shared/types/execution';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

function makeEntry(id: string, overrides?: Partial<ExecutionHistoryEntry>): ExecutionHistoryEntry {
  return {
    id,
    workflowId: 'wf-1',
    workflowName: 'Test Workflow',
    workflow: { id: 'wf-1', metadata: { name: 'Test', version: '1', createdAt: '', updatedAt: '', tags: [] }, nodes: [], transitions: [], gates: [], variables: [] } as WorkflowDefinition,
    status: 'completed',
    startedAt: '2026-03-01T10:00:00Z',
    nodeStates: {},
    retryStats: {},
    ...overrides,
  };
}

describe('F14-T06: ExecutionHistoryService', () => {
  let tmpDir: string;
  let service: ExecutionHistoryService;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'exec-history-'));
    service = new ExecutionHistoryService(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('addEntry stores entry and persists to JSON', async () => {
    const entry = makeEntry('exec-1');
    await service.addEntry(entry);

    const filePath = join(tmpDir, 'execution-history.json');
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('exec-1');
  });

  it('ring buffer evicts oldest when > 100 entries', async () => {
    // Add 101 entries
    for (let i = 0; i < 101; i++) {
      await service.addEntry(makeEntry(`exec-${i}`));
    }

    const entries = service.list();
    expect(entries).toHaveLength(100);
    // Oldest (exec-0) should be evicted
    expect(entries.find(e => e.id === 'exec-0')).toBeUndefined();
    // Newest (exec-100) should be present
    expect(entries.find(e => e.id === 'exec-100')).toBeDefined();
  });

  it('list returns ExecutionHistorySummary[] (no workflow/nodeStates)', async () => {
    await service.addEntry(makeEntry('exec-1'));

    const summaries = service.list();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe('exec-1');
    expect(summaries[0].workflowId).toBe('wf-1');
    expect(summaries[0].workflowName).toBe('Test Workflow');
    expect(summaries[0].status).toBe('completed');
    // Should NOT have heavy fields
    expect((summaries[0] as any).workflow).toBeUndefined();
    expect((summaries[0] as any).nodeStates).toBeUndefined();
    expect((summaries[0] as any).retryStats).toBeUndefined();
  });

  it('getById returns full ExecutionHistoryEntry', async () => {
    const entry = makeEntry('exec-1', { retryStats: { 'node-a': 2 } });
    await service.addEntry(entry);

    const result = service.getById('exec-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('exec-1');
    expect(result!.workflow).toBeDefined();
    expect(result!.nodeStates).toBeDefined();
    expect(result!.retryStats).toEqual({ 'node-a': 2 });
  });

  it('getById returns null for missing id', () => {
    const result = service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('clear empties history and persists', async () => {
    await service.addEntry(makeEntry('exec-1'));
    await service.addEntry(makeEntry('exec-2'));
    expect(service.list()).toHaveLength(2);

    await service.clear();

    expect(service.list()).toHaveLength(0);
    const filePath = join(tmpDir, 'execution-history.json');
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(data).toHaveLength(0);
  });

  it('concurrent writes are serialized (write queue)', async () => {
    // Fire 5 writes concurrently
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(service.addEntry(makeEntry(`exec-${i}`)));
    }
    await Promise.all(promises);

    const entries = service.list();
    expect(entries).toHaveLength(5);
  });
});
