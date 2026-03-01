// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T07: Env var injection
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('F17-T07: env var injection', { timeout: 30000 }, () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv['DOX_VAR_FOO'] = process.env['DOX_VAR_FOO'];
    savedEnv['DOX_VAR_BAR_BAZ'] = process.env['DOX_VAR_BAR_BAZ'];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('DOX_VAR_FOO=bar -> {FOO:"bar"}', async () => {
    process.env['DOX_VAR_FOO'] = 'bar';
    const { collectEnvVars } = await import('../../src/cli/arg-parser');
    const vars = collectEnvVars();
    expect(vars['FOO']).toBe('bar');
  });

  it('prefix is stripped', async () => {
    process.env['DOX_VAR_BAR_BAZ'] = 'qux';
    const { collectEnvVars } = await import('../../src/cli/arg-parser');
    const vars = collectEnvVars();
    expect(vars['BAR_BAZ']).toBe('qux');
    expect(vars['DOX_VAR_BAR_BAZ']).toBeUndefined();
  });

  it('--var overrides env', async () => {
    process.env['DOX_VAR_FOO'] = 'from-env';
    const { parseArgs, collectEnvVars } = await import('../../src/cli/arg-parser');
    const envVars = collectEnvVars();
    const config = parseArgs(['--workflow', 'wf.json', '--var', 'FOO=from-cli']);
    // CLI takes precedence: merge env first, then CLI overwrites
    const merged = { ...envVars, ...config.variables };
    expect(merged['FOO']).toBe('from-cli');
  });
});
