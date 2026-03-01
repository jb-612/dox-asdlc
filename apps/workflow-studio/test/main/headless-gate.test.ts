// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T06: Headless gate handling
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

const gatedWorkflow: WorkflowDefinition = {
  id: 'wf-gate',
  metadata: { name: 'Gate Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
  nodes: [
    { id: 'n1', type: 'backend' as const, label: 'Build', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
    { id: 'g1', type: 'gate' as const, label: 'Approval', config: {}, inputs: [], outputs: [], position: { x: 100, y: 0 } },
    { id: 'n2', type: 'backend' as const, label: 'Deploy', config: {}, inputs: [], outputs: [], position: { x: 200, y: 0 } },
  ],
  transitions: [
    { id: 't1', from: 'n1', to: 'g1', condition: '' },
    { id: 't2', from: 'g1', to: 'n2', condition: '' },
  ],
  gates: [
    { id: 'gate-g1', nodeId: 'g1', gateType: 'approval', prompt: 'Approve deployment?', options: [], required: true },
  ],
  variables: [],
};

describe('F17-T06: Headless gate handling', { timeout: 30000 }, () => {
  let tmpDir: string;
  let wfPath: string;

  beforeEach(() => {
    uuidCounter = 0;
    tmpDir = mkdtempSync(join(tmpdir(), 'dox-gate-'));
    wfPath = join(tmpDir, 'gated-workflow.json');
    writeFileSync(wfPath, JSON.stringify(gatedWorkflow));
  });

  it('auto mode auto-approves gates', async () => {
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

  it('fail mode exits 4 at gate', async () => {
    const { runHeadless } = await import('../../src/cli/run');
    const exitCode = await runHeadless({
      workflowPath: wfPath,
      mock: true,
      json: true,
      gateMode: 'fail',
      variables: {},
    });

    expect(exitCode).toBe(4);
  });
});
