// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from '../../src/main/services/diff-capture';

// ---------------------------------------------------------------------------
// parseUnifiedDiff — pure function tests (no git dependency)
// ---------------------------------------------------------------------------

describe('parseUnifiedDiff', () => {
  it('parses a modified file from unified diff output', () => {
    const diff = `diff --git a/src/app.ts b/src/app.ts
index abc1234..def5678 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 import express from 'express';
+import cors from 'cors';
 const app = express();
 app.listen(3000);
`;
    const result = parseUnifiedDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/app.ts');
    expect(result[0].status).toBe('modified');
  });

  it('parses a new file (added)', () => {
    const diff = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return 'world';
+}
`;
    const result = parseUnifiedDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/new-file.ts');
    expect(result[0].status).toBe('added');
  });

  it('parses a deleted file', () => {
    const diff = `diff --git a/src/old-file.ts b/src/old-file.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/old-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function goodbye() {
-  return 'world';
-}
`;
    const result = parseUnifiedDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/old-file.ts');
    expect(result[0].status).toBe('deleted');
  });

  it('returns empty array when no diff output', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(parseUnifiedDiff('  \n  \n')).toEqual([]);
  });

  it('handles multiple files in a single diff', () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
index abc..def 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
 line1
+line2
diff --git a/src/b.ts b/src/b.ts
new file mode 100644
index 0000000..abc 100644
--- /dev/null
+++ b/src/b.ts
@@ -0,0 +1 @@
+new file content
diff --git a/src/c.ts b/src/c.ts
deleted file mode 100644
index abc..000 100644
--- a/src/c.ts
+++ /dev/null
@@ -1 +0,0 @@
-deleted content
`;
    const result = parseUnifiedDiff(diff);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ filePath: 'src/a.ts', status: 'modified' });
    expect(result[1]).toEqual({ filePath: 'src/b.ts', status: 'added' });
    expect(result[2]).toEqual({ filePath: 'src/c.ts', status: 'deleted' });
  });

  it('skips binary files gracefully', () => {
    const diff = `diff --git a/image.png b/image.png
index abc..def 100644
Binary files a/image.png and b/image.png differ
diff --git a/src/app.ts b/src/app.ts
index abc..def 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1,2 @@
 line1
+line2
`;
    const result = parseUnifiedDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/app.ts');
    expect(result[0].status).toBe('modified');
  });

  it('handles renamed files', () => {
    const diff = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 95%
rename from src/old-name.ts
rename to src/new-name.ts
index abc..def 100644
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1 +1,2 @@
 line1
+line2
`;
    const result = parseUnifiedDiff(diff);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('src/new-name.ts');
    expect(result[0].status).toBe('modified');
  });
});
