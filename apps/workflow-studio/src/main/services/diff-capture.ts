import { execSync } from 'child_process';
import type { FileDiff } from '../../shared/types/execution';

/**
 * Parse unified diff output into an array of file entries with status.
 *
 * This is a pure function with no git dependency — suitable for unit testing.
 */
export function parseUnifiedDiff(
  diffOutput: string,
): Array<{ filePath: string; status: 'added' | 'modified' | 'deleted' }> {
  if (!diffOutput.trim()) return [];

  const results: Array<{ filePath: string; status: 'added' | 'modified' | 'deleted' }> = [];

  // Split on diff headers
  const fileSections = diffOutput.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    // Skip binary files
    if (/^Binary files/.test(section) || section.includes('\nBinary files ')) {
      continue;
    }

    // Extract file path from the "b/" side of the diff header: "a/path b/path"
    const headerMatch = section.match(/^a\/\S+\s+b\/(\S+)/);
    if (!headerMatch) continue;

    const filePath = headerMatch[1];

    // Check for --- /dev/null (new file) or +++ /dev/null (deleted file)
    const hasOldNull = /^---\s+\/dev\/null/m.test(section);
    const hasNewNull = /^\+\+\+\s+\/dev\/null/m.test(section);

    let status: 'added' | 'modified' | 'deleted';
    if (hasOldNull) {
      status = 'added';
    } else if (hasNewNull) {
      status = 'deleted';
    } else {
      status = 'modified';
    }

    results.push({ filePath, status });
  }

  return results;
}

/**
 * Capture git diffs between a base SHA and the current working tree HEAD.
 *
 * For each changed file, retrieves the full old and new content using
 * `git show` so the DiffViewer can render a side-by-side comparison.
 *
 * @param cwd   Working directory (must be inside a git repo).
 * @param baseSha  The commit SHA captured before execution started.
 * @returns Array of FileDiff entries.
 */
export async function captureGitDiff(cwd: string, baseSha: string): Promise<FileDiff[]> {
  // Get the unified diff to identify changed files
  const diffOutput = execSync(`git diff ${baseSha} HEAD --unified=3`, {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024, // 10 MB
  });

  const entries = parseUnifiedDiff(diffOutput);
  const fileDiffs: FileDiff[] = [];

  for (const entry of entries) {
    const diff: FileDiff = {
      path: entry.filePath,
      hunks: extractHunks(diffOutput, entry.filePath),
    };

    // Retrieve full file content for old and new versions
    if (entry.status !== 'added') {
      diff.oldContent = gitShow(cwd, baseSha, entry.filePath);
    }
    if (entry.status !== 'deleted') {
      diff.newContent = gitShow(cwd, 'HEAD', entry.filePath);
    }

    fileDiffs.push(diff);
  }

  return fileDiffs;
}

/** Retrieve file content at a given ref using git show. */
function gitShow(cwd: string, ref: string, filePath: string): string | undefined {
  try {
    return execSync(`git show ${ref}:${filePath}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 5 * 1024 * 1024,
    });
  } catch {
    return undefined;
  }
}

/** Extract the hunk lines for a specific file from the full diff output. */
function extractHunks(fullDiff: string, filePath: string): string[] {
  // Find the section for this file
  const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filePattern = new RegExp(
    `diff --git a/\\S+ b/${escapedPath}\\n([\\s\\S]*?)(?=diff --git |$)`,
  );
  const match = fullDiff.match(filePattern);
  if (!match) return [];

  const section = match[1];
  // Extract @@ hunk headers and their content
  const hunkPattern = /^(@@[^@]*@@.*(?:\n(?!@@|diff --git ).*)*)/gm;
  const hunks: string[] = [];
  let hunkMatch: RegExpExecArray | null;
  while ((hunkMatch = hunkPattern.exec(section)) !== null) {
    hunks.push(hunkMatch[1].trim());
  }
  return hunks;
}
