import { execSync } from 'child_process';

/**
 * Check if Docker is available on the host machine.
 *
 * Runs `docker version` with a 5-second timeout.
 * Returns false on any error -- does not throw.
 */
export async function checkDockerAvailable(): Promise<boolean> {
  try {
    execSync('docker version', { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
