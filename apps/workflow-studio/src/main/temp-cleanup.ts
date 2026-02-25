import { readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Clean up temporary repository directories (wf-repo-*) from the system
 * temp directory. Called on app quit to avoid accumulating stale clones.
 *
 * Best-effort: individual failures are silently ignored so one stuck
 * directory does not prevent the rest from being cleaned.
 *
 * @see P15-F03, T22
 */
export function cleanupTempRepoDirs(): void {
  try {
    const tempDir = tmpdir();
    const entries = readdirSync(tempDir);
    let cleaned = 0;

    for (const entry of entries) {
      if (entry.startsWith('wf-repo-')) {
        try {
          rmSync(join(tempDir, entry), { recursive: true, force: true });
          cleaned++;
        } catch {
          // Best effort cleanup -- ignore individual failures
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[Cleanup] Removed ${cleaned} temporary repo directories`);
    }
  } catch {
    // Do not crash on cleanup failure
  }
}
