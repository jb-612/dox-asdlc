// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T12: GHA YAML exporter
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

const makeWorkflow = (overrides?: Partial<WorkflowDefinition>): WorkflowDefinition => ({
  id: 'wf-export',
  metadata: { name: 'Export Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
  nodes: [
    { id: 'n1', type: 'backend' as const, label: 'Plan', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
    { id: 'n2', type: 'backend' as const, label: 'Build', config: {}, inputs: [], outputs: [], position: { x: 100, y: 0 } },
  ],
  transitions: [{ id: 't1', from: 'n1', to: 'n2', condition: '' }],
  gates: [],
  variables: [],
  ...overrides,
});

describe('F17-T12: GHA YAML exporter', { timeout: 30000 }, () => {
  it('produces valid YAML with workflow name', async () => {
    const { exportToGHA } = await import('../../src/cli/gha-exporter');
    const yaml = exportToGHA(makeWorkflow());
    expect(yaml).toContain('name:');
    expect(yaml).toContain('Export Test');
    expect(yaml).toContain('jobs:');
  });

  it('configurable trigger events', async () => {
    const { exportToGHA } = await import('../../src/cli/gha-exporter');
    const yaml = exportToGHA(makeWorkflow(), { triggers: ['push', 'pull_request'] });
    expect(yaml).toContain('push');
    expect(yaml).toContain('pull_request');
  });

  it('sequential nodes become steps', async () => {
    const { exportToGHA } = await import('../../src/cli/gha-exporter');
    const yaml = exportToGHA(makeWorkflow());
    expect(yaml).toContain('Plan');
    expect(yaml).toContain('Build');
    expect(yaml).toContain('steps:');
  });

  it('gate nodes get MANUAL comment', async () => {
    const { exportToGHA } = await import('../../src/cli/gha-exporter');
    const wf = makeWorkflow({
      nodes: [
        { id: 'n1', type: 'backend' as const, label: 'Plan', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'g1', type: 'gate' as const, label: 'Approval', config: {}, inputs: [], outputs: [], position: { x: 100, y: 0 } },
      ],
    });
    const yaml = exportToGHA(wf);
    expect(yaml).toContain('MANUAL');
  });

  it('supports runner label', async () => {
    const { exportToGHA } = await import('../../src/cli/gha-exporter');
    const yaml = exportToGHA(makeWorkflow(), { runner: 'self-hosted' });
    expect(yaml).toContain('self-hosted');
  });
});
