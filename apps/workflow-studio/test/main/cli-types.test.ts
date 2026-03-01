// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T01: EngineHost interface + HeadlessRunConfig types
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

describe('F17-T01: CLI types', { timeout: 30000 }, () => {
  it('EngineHost has send method signature', async () => {
    const mod = await import('../../src/cli/types');
    // EngineHost should be a type — verify the module exports exist
    expect(mod).toBeDefined();

    // Create a conforming EngineHost object
    const host: import('../../src/cli/types').EngineHost = {
      send: (_channel: string, ..._args: unknown[]) => {},
    };
    expect(typeof host.send).toBe('function');
  });

  it('HeadlessRunConfig has required fields', async () => {
    const mod = await import('../../src/cli/types');
    expect(mod).toBeDefined();

    const config: import('../../src/cli/types').HeadlessRunConfig = {
      workflowPath: '/path/to/workflow.json',
      mock: false,
      json: false,
      gateMode: 'auto',
      variables: {},
    };
    expect(config.workflowPath).toBe('/path/to/workflow.json');
    expect(config.gateMode).toBe('auto');
  });

  it('HeadlessRunConfig supports optional fields', async () => {
    const config: import('../../src/cli/types').HeadlessRunConfig = {
      workflowPath: 'wf.json',
      mock: true,
      json: true,
      gateMode: 'fail',
      variables: { key: 'value' },
      repoPath: '/repo',
      workflowDir: '/workflows',
    };
    expect(config.repoPath).toBe('/repo');
    expect(config.workflowDir).toBe('/workflows');
  });
});
