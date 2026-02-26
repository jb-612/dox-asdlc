// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { execSync } from 'child_process';
import { checkDockerAvailable } from '../../src/main/services/docker-utils';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('checkDockerAvailable', () => {
  it('returns true when docker version succeeds', async () => {
    vi.mocked(execSync).mockReturnValue('Docker version 24.0.0');
    expect(await checkDockerAvailable()).toBe(true);
  });

  it('returns false when docker version throws', async () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('not found'); });
    expect(await checkDockerAvailable()).toBe(false);
  });

  it('returns false when docker version times out', async () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('ETIMEDOUT'); });
    expect(await checkDockerAvailable()).toBe(false);
  });

  it('calls docker version with 5s timeout', async () => {
    vi.mocked(execSync).mockReturnValue('ok');
    await checkDockerAvailable();
    expect(execSync).toHaveBeenCalledWith('docker version', expect.objectContaining({ timeout: 5000 }));
  });
});
