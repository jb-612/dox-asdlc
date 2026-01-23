/**
 * Diff formatting and processing utilities
 * Uses the 'diff' library for actual diffing
 */

import { diffLines, diffWords, Change } from 'diff';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

export interface ParsedDiff {
  lines: DiffLine[];
  stats: DiffStats;
}

/**
 * Generate a line-by-line diff between two strings
 */
export function generateLineDiff(oldText: string, newText: string): ParsedDiff {
  const changes = diffLines(oldText, newText);
  const lines: DiffLine[] = [];
  let oldLineNumber = 1;
  let newLineNumber = 1;
  const stats: DiffStats = { additions: 0, deletions: 0, unchanged: 0 };

  for (const change of changes) {
    const changeLines = change.value.split('\n');
    // Remove empty last line from split
    if (changeLines[changeLines.length - 1] === '') {
      changeLines.pop();
    }

    for (const line of changeLines) {
      if (change.added) {
        lines.push({
          type: 'added',
          content: line,
          newLineNumber: newLineNumber++,
        });
        stats.additions++;
      } else if (change.removed) {
        lines.push({
          type: 'removed',
          content: line,
          oldLineNumber: oldLineNumber++,
        });
        stats.deletions++;
      } else {
        lines.push({
          type: 'unchanged',
          content: line,
          oldLineNumber: oldLineNumber++,
          newLineNumber: newLineNumber++,
        });
        stats.unchanged++;
      }
    }
  }

  return { lines, stats };
}

/**
 * Generate a word-level diff for inline changes
 */
export interface WordDiff {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export function generateWordDiff(oldText: string, newText: string): WordDiff[] {
  const changes = diffWords(oldText, newText);
  return changes.map((change: Change) => ({
    type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
    value: change.value,
  }));
}

/**
 * Parse a unified diff string into structured format
 */
export interface UnifiedDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export function parseUnifiedDiff(diffString: string): UnifiedDiffHunk[] {
  const hunks: UnifiedDiffHunk[] = [];
  const lines = diffString.split('\n');
  let currentHunk: UnifiedDiffHunk | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;

  const hunkHeaderRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

  for (const line of lines) {
    const hunkMatch = line.match(hunkHeaderRegex);

    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      oldLineNumber = parseInt(hunkMatch[1], 10);
      newLineNumber = parseInt(hunkMatch[3], 10);
      currentHunk = {
        oldStart: oldLineNumber,
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: newLineNumber,
        newLines: parseInt(hunkMatch[4] || '1', 10),
        lines: [],
      };
    } else if (currentHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({
          type: 'added',
          content: line.slice(1),
          newLineNumber: newLineNumber++,
        });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({
          type: 'removed',
          content: line.slice(1),
          oldLineNumber: oldLineNumber++,
        });
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'unchanged',
          content: line.slice(1),
          oldLineNumber: oldLineNumber++,
          newLineNumber: newLineNumber++,
        });
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Calculate diff statistics from a parsed diff
 */
export function calculateDiffStats(lines: DiffLine[]): DiffStats {
  return lines.reduce(
    (stats, line) => {
      if (line.type === 'added') stats.additions++;
      else if (line.type === 'removed') stats.deletions++;
      else stats.unchanged++;
      return stats;
    },
    { additions: 0, deletions: 0, unchanged: 0 }
  );
}

/**
 * Format diff stats as a summary string
 */
export function formatDiffStats(stats: DiffStats): string {
  const parts: string[] = [];
  if (stats.additions > 0) {
    parts.push(`+${stats.additions}`);
  }
  if (stats.deletions > 0) {
    parts.push(`-${stats.deletions}`);
  }
  return parts.join(', ') || 'No changes';
}

/**
 * Check if a string appears to be a unified diff
 */
export function isUnifiedDiff(content: string): boolean {
  return (
    content.includes('@@') &&
    (content.includes('---') || content.includes('+++'))
  );
}

/**
 * Get the file paths from a unified diff header
 */
export interface DiffFilePaths {
  oldPath: string | null;
  newPath: string | null;
}

export function extractFilePaths(diffString: string): DiffFilePaths {
  const oldPathMatch = diffString.match(/^--- (?:a\/)?(.+)$/m);
  const newPathMatch = diffString.match(/^\+\+\+ (?:b\/)?(.+)$/m);

  return {
    oldPath: oldPathMatch ? oldPathMatch[1] : null,
    newPath: newPathMatch ? newPathMatch[1] : null,
  };
}

/**
 * Collapse unchanged lines in a diff for display
 * Shows context lines around changes
 */
export function collapseDiff(
  lines: DiffLine[],
  contextLines = 3
): (DiffLine | { type: 'collapsed'; count: number })[] {
  const result: (DiffLine | { type: 'collapsed'; count: number })[] = [];
  let unchangedBuffer: DiffLine[] = [];

  for (const line of lines) {
    if (line.type === 'unchanged') {
      unchangedBuffer.push(line);
    } else {
      // Flush unchanged buffer with context
      if (unchangedBuffer.length > contextLines * 2) {
        // Show first contextLines, collapse middle, show last contextLines
        result.push(...unchangedBuffer.slice(0, contextLines));
        result.push({
          type: 'collapsed',
          count: unchangedBuffer.length - contextLines * 2,
        });
        result.push(...unchangedBuffer.slice(-contextLines));
      } else {
        result.push(...unchangedBuffer);
      }
      unchangedBuffer = [];
      result.push(line);
    }
  }

  // Handle trailing unchanged lines
  if (unchangedBuffer.length > contextLines) {
    result.push(...unchangedBuffer.slice(0, contextLines));
    if (unchangedBuffer.length > contextLines) {
      result.push({
        type: 'collapsed',
        count: unchangedBuffer.length - contextLines,
      });
    }
  } else {
    result.push(...unchangedBuffer);
  }

  return result;
}
