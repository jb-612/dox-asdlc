// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T04: CLI arg parser
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

describe('F17-T04: parseArgs', { timeout: 30000 }, () => {
  it('parses --workflow and defaults', async () => {
    const { parseArgs } = await import('../../src/cli/arg-parser');
    const result = parseArgs(['--workflow', '/path/to/wf.json']);

    expect(result.workflowPath).toBe('/path/to/wf.json');
    expect(result.mock).toBe(false);
    expect(result.json).toBe(false);
    expect(result.gateMode).toBe('auto');
    expect(result.variables).toEqual({});
  });

  it('parses --var K=V pairs', async () => {
    const { parseArgs } = await import('../../src/cli/arg-parser');
    const result = parseArgs([
      '--workflow', 'wf.json',
      '--var', 'FOO=bar',
      '--var', 'BAZ=qux',
    ]);

    expect(result.variables).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('parses --repo, --mock, --json, --gate-mode', async () => {
    const { parseArgs } = await import('../../src/cli/arg-parser');
    const result = parseArgs([
      '--workflow', 'wf.json',
      '--repo', '/my/repo',
      '--mock',
      '--json',
      '--gate-mode', 'fail',
    ]);

    expect(result.repoPath).toBe('/my/repo');
    expect(result.mock).toBe(true);
    expect(result.json).toBe(true);
    expect(result.gateMode).toBe('fail');
  });

  it('parses --workflow-dir', async () => {
    const { parseArgs } = await import('../../src/cli/arg-parser');
    const result = parseArgs([
      '--workflow', 'wf.json',
      '--workflow-dir', '/workflows',
    ]);

    expect(result.workflowDir).toBe('/workflows');
  });

  it('throws on missing --workflow', async () => {
    const { parseArgs } = await import('../../src/cli/arg-parser');
    expect(() => parseArgs([])).toThrow('--workflow');
  });

  it('throws on invalid --gate-mode', async () => {
    const { parseArgs } = await import('../../src/cli/arg-parser');
    expect(() => parseArgs([
      '--workflow', 'wf.json',
      '--gate-mode', 'invalid',
    ])).toThrow('--gate-mode');
  });
});
