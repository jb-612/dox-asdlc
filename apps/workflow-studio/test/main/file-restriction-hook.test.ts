// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Tests for file-restriction-hook.py
//
// Spawns the actual Python script with controlled stdin and env to verify
// exit codes. This is an integration test that requires Python 3.
// ---------------------------------------------------------------------------

const hookPath = join(__dirname, '..', '..', 'resources', 'hooks', 'file-restriction-hook.py');

function runHook(
  payload: Record<string, unknown>,
  restrictions?: string[],
): { exitCode: number; stdout: string; stderr: string } {
  const env = { ...process.env };
  if (restrictions) {
    env.FILE_RESTRICTIONS = JSON.stringify(restrictions);
  } else {
    delete env.FILE_RESTRICTIONS;
  }

  try {
    const stdout = execFileSync('python3', [hookPath], {
      input: JSON.stringify(payload),
      env,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { exitCode: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('file-restriction-hook.py', () => {
  it('allows Write when file matches a restriction pattern', () => {
    const result = runHook(
      { tool: 'Write', arguments: { file_path: 'src/main/index.ts' } },
      ['src/**/*.ts'],
    );
    expect(result.exitCode).toBe(0);
  });

  it('blocks Write when file does not match any restriction pattern', () => {
    const result = runHook(
      { tool: 'Write', arguments: { file_path: 'docs/README.md' } },
      ['src/**/*.ts'],
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('BLOCKED');
  });

  it('allows all when FILE_RESTRICTIONS is empty', () => {
    const result = runHook(
      { tool: 'Write', arguments: { file_path: 'anything.txt' } },
      [],
    );
    expect(result.exitCode).toBe(0);
  });

  it('allows all when FILE_RESTRICTIONS env var is not set', () => {
    const result = runHook(
      { tool: 'Write', arguments: { file_path: 'anything.txt' } },
    );
    expect(result.exitCode).toBe(0);
  });

  it('allows non-Write/Edit tools regardless of restrictions', () => {
    const result = runHook(
      { tool: 'Read', arguments: { file_path: 'docs/README.md' } },
      ['src/**/*.ts'],
    );
    expect(result.exitCode).toBe(0);
  });

  it('allows Edit when file matches a restriction pattern', () => {
    const result = runHook(
      { tool: 'Edit', arguments: { file_path: 'src/main/index.ts' } },
      ['src/**/*.ts'],
    );
    expect(result.exitCode).toBe(0);
  });

  it('blocks Edit when file does not match', () => {
    const result = runHook(
      { tool: 'Edit', arguments: { file_path: 'config.json' } },
      ['src/**/*.ts'],
    );
    expect(result.exitCode).toBe(2);
  });

  it('handles multiple restriction patterns (OR logic)', () => {
    const result = runHook(
      { tool: 'Write', arguments: { file_path: 'test/main/foo.test.ts' } },
      ['src/**/*.ts', 'test/**/*.ts'],
    );
    expect(result.exitCode).toBe(0);
  });
});
