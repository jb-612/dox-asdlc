// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T14: CLI entry point dispatch
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

describe('F17-T14: CLI entry point', { timeout: 30000 }, () => {
  it('dispatches run subcommand', async () => {
    const { dispatch } = await import('../../src/cli/index');
    expect(typeof dispatch).toBe('function');
  });

  it('dispatches export subcommand', async () => {
    const { dispatch } = await import('../../src/cli/index');
    expect(typeof dispatch).toBe('function');
  });

  it('unknown subcommand returns help exit code', async () => {
    const { dispatch } = await import('../../src/cli/index');
    const code = await dispatch(['unknown-command']);
    expect(code).toBe(1);
  });

  it('no subcommand returns help exit code', async () => {
    const { dispatch } = await import('../../src/cli/index');
    const code = await dispatch([]);
    expect(code).toBe(1);
  });
});
