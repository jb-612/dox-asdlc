import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { rm } from 'fs/promises';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { ChildProcess } from 'child_process';

// ---------------------------------------------------------------------------
// Repo IPC handlers (P15-F03)
//
// Handles repository browsing, validation, cloning, and clone cancellation.
// Security: Only HTTPS URLs are accepted for clone operations. Git hooks
// are disabled via --config core.hooksPath=/dev/null to prevent malicious
// hook execution from cloned repos.
// ---------------------------------------------------------------------------

/** Active clone process reference for cancellation support. */
let activeClone: {
  childProcess: ChildProcess;
  targetDir: string;
} | null = null;

/**
 * Validate that a URL uses the HTTPS scheme. Rejects file://, ssh://, git://
 * and any other scheme to prevent local file access or SSRF attacks.
 */
export function isHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Generate a deterministic temp directory path for a clone URL.
 */
export function cloneTempDir(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 8);
  return join(tmpdir(), `wf-repo-${hash}-${Date.now()}`);
}

export function registerRepoHandlers(): void {
  // --- Validate path -------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.REPO_VALIDATE_PATH,
    async (_event, path: string): Promise<{ valid: boolean; hasGit?: boolean; error?: string }> => {
      try {
        const pathStat = await stat(path);
        if (!pathStat.isDirectory()) {
          return { valid: false, error: 'Path is not a directory' };
        }

        try {
          const gitStat = await stat(join(path, '.git'));
          return { valid: true, hasGit: gitStat.isDirectory() || gitStat.isFile() };
        } catch {
          return { valid: true, hasGit: false };
        }
      } catch {
        return { valid: false, error: 'Path does not exist' };
      }
    },
  );

  // --- Clone repo ----------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.REPO_CLONE,
    async (
      _event,
      url: string,
      _branch?: string,
      _depth?: number,
    ): Promise<{ success: boolean; localPath?: string; error?: string }> => {
      // Security: Only allow HTTPS URLs
      if (!isHttpsUrl(url)) {
        return { success: false, error: 'Only HTTPS URLs are supported' };
      }

      const targetDir = cloneTempDir(url);

      return new Promise((resolve) => {
        const args = [
          'clone',
          '--depth=1',
          '--config',
          'core.hooksPath=/dev/null',
          url,
          targetDir,
        ];

        const child = execFile('git', args, { timeout: 120000 }, (error, _stdout, stderr) => {
          activeClone = null;

          if (error) {
            // Clean up partial clone directory on failure
            rm(targetDir, { recursive: true, force: true }).catch(() => {});

            if (error.killed || error.signal === 'SIGTERM') {
              resolve({ success: false, error: 'Clone was cancelled' });
            } else {
              const errorMsg = stderr?.trim() || error.message || 'Clone failed';
              resolve({ success: false, error: errorMsg.slice(0, 500) });
            }
            return;
          }

          resolve({ success: true, localPath: targetDir });
        });

        activeClone = { childProcess: child, targetDir };
      });
    },
  );

  // --- Cancel clone --------------------------------------------------------
  ipcMain.handle(
    IPC_CHANNELS.REPO_CLONE_CANCEL,
    async (): Promise<{ success: boolean; error?: string }> => {
      if (!activeClone) {
        return { success: false, error: 'No active clone to cancel' };
      }

      const { childProcess, targetDir } = activeClone;

      try {
        childProcess.kill('SIGTERM');
        // Clean up partial clone directory
        await rm(targetDir, { recursive: true, force: true });
        activeClone = null;
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );
}
