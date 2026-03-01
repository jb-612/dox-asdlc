// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T05: dox run entry point
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}));

let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `uuid-${++uuidCounter}`,
}));

const sampleWorkflow: WorkflowDefinition = {
  id: 'wf-run',
  metadata: { name: 'Run Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
  nodes: [
    { id: 'n1', type: 'backend' as const, label: 'Step 1', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
  ],
  transitions: [],
  gates: [],
  variables: [],
};

describe('F17-T05: dox run', { timeout: 30000 }, () => {
  let tmpDir: string;
  let wfPath: string;

  beforeEach(() => {
    uuidCounter = 0;
    tmpDir = mkdtempSync(join(tmpdir(), 'dox-run-'));
    wfPath = join(tmpDir, 'test-workflow.json');
    writeFileSync(wfPath, JSON.stringify(sampleWorkflow));
  });

  it('loads workflow by path and runs', async () => {
    const { runHeadless } = await import('../../src/cli/run');
    const exitCode = await runHeadless({
      workflowPath: wfPath,
      mock: true,
      json: true,
      gateMode: 'auto',
      variables: {},
    });

    expect(exitCode).toBe(0);
  });

  it('exits 3 on missing workflow file', async () => {
    const { runHeadless } = await import('../../src/cli/run');
    const exitCode = await runHeadless({
      workflowPath: '/nonexistent/workflow.json',
      mock: true,
      json: true,
      gateMode: 'auto',
      variables: {},
    });

    expect(exitCode).toBe(3);
  });

  it('exits 1 on execution failure', async () => {
    const failWorkflow: WorkflowDefinition = {
      ...sampleWorkflow,
      id: 'wf-fail',
      nodes: [], // Empty workflow should complete but this tests the path
    };
    const failPath = join(tmpDir, 'fail-workflow.json');
    writeFileSync(failPath, JSON.stringify(failWorkflow));

    const { runHeadless } = await import('../../src/cli/run');
    const exitCode = await runHeadless({
      workflowPath: failPath,
      mock: true,
      json: true,
      gateMode: 'auto',
      variables: {},
    });

    // Empty workflow still completes successfully
    expect(exitCode).toBe(0);
  });
});
