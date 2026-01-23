import { describe, it, expect } from 'vitest';
import {
  generateLineDiff,
  generateWordDiff,
  parseUnifiedDiff,
  calculateDiffStats,
  formatDiffStats,
  isUnifiedDiff,
  extractFilePaths,
  collapseDiff,
  DiffLine,
} from './diff';

describe('diff utilities', () => {
  describe('generateLineDiff', () => {
    it('identifies added lines', () => {
      const oldText = 'line1\nline2\n';
      const newText = 'line1\nline2\nline3\n';
      const { lines, stats } = generateLineDiff(oldText, newText);

      expect(stats.additions).toBe(1);
      expect(stats.deletions).toBe(0);
      expect(lines.some((l) => l.type === 'added' && l.content === 'line3')).toBe(true);
    });

    it('identifies removed lines', () => {
      const oldText = 'line1\nline2\nline3\n';
      const newText = 'line1\nline2\n';
      const { lines, stats } = generateLineDiff(oldText, newText);

      expect(stats.deletions).toBe(1);
      expect(stats.additions).toBe(0);
      expect(lines.some((l) => l.type === 'removed' && l.content === 'line3')).toBe(true);
    });

    it('identifies unchanged lines', () => {
      const oldText = 'line1\nline2';
      const newText = 'line1\nline2';
      const { lines, stats } = generateLineDiff(oldText, newText);

      expect(stats.unchanged).toBe(2);
      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBe(0);
    });

    it('tracks line numbers correctly', () => {
      const oldText = 'a\nb\nc';
      const newText = 'a\nx\nc';
      const { lines } = generateLineDiff(oldText, newText);

      const unchangedA = lines.find((l) => l.content === 'a' && l.type === 'unchanged');
      expect(unchangedA?.oldLineNumber).toBe(1);
      expect(unchangedA?.newLineNumber).toBe(1);

      const removedB = lines.find((l) => l.content === 'b' && l.type === 'removed');
      expect(removedB?.oldLineNumber).toBe(2);

      const addedX = lines.find((l) => l.content === 'x' && l.type === 'added');
      expect(addedX?.newLineNumber).toBe(2);
    });
  });

  describe('generateWordDiff', () => {
    it('identifies changed words', () => {
      const oldText = 'hello world';
      const newText = 'hello universe';
      const diff = generateWordDiff(oldText, newText);

      expect(diff.some((d) => d.type === 'unchanged' && d.value === 'hello ')).toBe(true);
      expect(diff.some((d) => d.type === 'removed' && d.value === 'world')).toBe(true);
      expect(diff.some((d) => d.type === 'added' && d.value === 'universe')).toBe(true);
    });

    it('handles identical text', () => {
      const text = 'same text';
      const diff = generateWordDiff(text, text);

      expect(diff.every((d) => d.type === 'unchanged')).toBe(true);
    });
  });

  describe('parseUnifiedDiff', () => {
    it('parses unified diff format', () => {
      const diffString = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line1
-old line
+new line
+added line
 line3`;

      const hunks = parseUnifiedDiff(diffString);
      expect(hunks).toHaveLength(1);
      expect(hunks[0].oldStart).toBe(1);
      expect(hunks[0].newStart).toBe(1);

      const lines = hunks[0].lines;
      expect(lines.filter((l) => l.type === 'unchanged')).toHaveLength(2);
      expect(lines.filter((l) => l.type === 'removed')).toHaveLength(1);
      expect(lines.filter((l) => l.type === 'added')).toHaveLength(2);
    });

    it('handles multiple hunks', () => {
      const diffString = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,2 @@
 line1
-old1
+new1
@@ -10,2 +10,2 @@
 line10
-old10
+new10`;

      const hunks = parseUnifiedDiff(diffString);
      expect(hunks).toHaveLength(2);
      expect(hunks[0].oldStart).toBe(1);
      expect(hunks[1].oldStart).toBe(10);
    });
  });

  describe('calculateDiffStats', () => {
    it('counts line types correctly', () => {
      const lines: DiffLine[] = [
        { type: 'added', content: 'a', newLineNumber: 1 },
        { type: 'added', content: 'b', newLineNumber: 2 },
        { type: 'removed', content: 'c', oldLineNumber: 1 },
        { type: 'unchanged', content: 'd', oldLineNumber: 2, newLineNumber: 3 },
      ];

      const stats = calculateDiffStats(lines);
      expect(stats.additions).toBe(2);
      expect(stats.deletions).toBe(1);
      expect(stats.unchanged).toBe(1);
    });
  });

  describe('formatDiffStats', () => {
    it('formats additions and deletions', () => {
      expect(formatDiffStats({ additions: 5, deletions: 3, unchanged: 10 })).toBe('+5, -3');
    });

    it('formats only additions', () => {
      expect(formatDiffStats({ additions: 5, deletions: 0, unchanged: 10 })).toBe('+5');
    });

    it('formats only deletions', () => {
      expect(formatDiffStats({ additions: 0, deletions: 3, unchanged: 10 })).toBe('-3');
    });

    it('handles no changes', () => {
      expect(formatDiffStats({ additions: 0, deletions: 0, unchanged: 10 })).toBe('No changes');
    });
  });

  describe('isUnifiedDiff', () => {
    it('returns true for unified diff', () => {
      const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,2 @@
 line
-old
+new`;
      expect(isUnifiedDiff(diff)).toBe(true);
    });

    it('returns false for regular text', () => {
      expect(isUnifiedDiff('Just some regular text')).toBe(false);
    });
  });

  describe('extractFilePaths', () => {
    it('extracts file paths from diff header', () => {
      const diff = `--- a/src/old.ts
+++ b/src/new.ts
@@ -1 +1 @@`;
      const paths = extractFilePaths(diff);
      expect(paths.oldPath).toBe('src/old.ts');
      expect(paths.newPath).toBe('src/new.ts');
    });

    it('handles paths without a/ b/ prefix', () => {
      const diff = `--- old.ts
+++ new.ts
@@ -1 +1 @@`;
      const paths = extractFilePaths(diff);
      expect(paths.oldPath).toBe('old.ts');
      expect(paths.newPath).toBe('new.ts');
    });

    it('returns null for missing paths', () => {
      const diff = '@@ -1 +1 @@\n+new line';
      const paths = extractFilePaths(diff);
      expect(paths.oldPath).toBeNull();
      expect(paths.newPath).toBeNull();
    });
  });

  describe('collapseDiff', () => {
    it('collapses long runs of unchanged lines', () => {
      const lines: DiffLine[] = [
        { type: 'unchanged', content: '1', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'unchanged', content: '2', oldLineNumber: 2, newLineNumber: 2 },
        { type: 'unchanged', content: '3', oldLineNumber: 3, newLineNumber: 3 },
        { type: 'unchanged', content: '4', oldLineNumber: 4, newLineNumber: 4 },
        { type: 'unchanged', content: '5', oldLineNumber: 5, newLineNumber: 5 },
        { type: 'unchanged', content: '6', oldLineNumber: 6, newLineNumber: 6 },
        { type: 'unchanged', content: '7', oldLineNumber: 7, newLineNumber: 7 },
        { type: 'unchanged', content: '8', oldLineNumber: 8, newLineNumber: 8 },
        { type: 'unchanged', content: '9', oldLineNumber: 9, newLineNumber: 9 },
        { type: 'unchanged', content: '10', oldLineNumber: 10, newLineNumber: 10 },
        { type: 'added', content: 'new', newLineNumber: 11 },
        { type: 'unchanged', content: '11', oldLineNumber: 11, newLineNumber: 12 },
      ];

      const collapsed = collapseDiff(lines, 3);

      // Should have: 3 context + collapsed + 3 context + 1 added + 1 unchanged
      const collapsedItem = collapsed.find((item) => 'count' in item && item.type === 'collapsed');
      expect(collapsedItem).toBeTruthy();
      if (collapsedItem && 'count' in collapsedItem) {
        expect(collapsedItem.count).toBe(4); // 10 - 3 - 3 = 4 collapsed
      }
    });

    it('does not collapse short runs', () => {
      const lines: DiffLine[] = [
        { type: 'unchanged', content: '1', oldLineNumber: 1, newLineNumber: 1 },
        { type: 'unchanged', content: '2', oldLineNumber: 2, newLineNumber: 2 },
        { type: 'added', content: 'new', newLineNumber: 3 },
      ];

      const collapsed = collapseDiff(lines, 3);
      const hasCollapsed = collapsed.some((item) => 'count' in item);
      expect(hasCollapsed).toBe(false);
    });
  });
});
