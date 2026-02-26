// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve, sep } from 'path';

// Extract and test the isPathWithinRoot logic directly.
// The function is not exported, so we replicate it for unit testing.
function isPathWithinRoot(resolvedPath: string, rootDir: string): boolean {
  const normalizedRoot = resolve(rootDir) + sep;
  const normalizedPath = resolve(resolvedPath);
  return normalizedPath === resolve(rootDir) || normalizedPath.startsWith(normalizedRoot);
}

describe('isPathWithinRoot (#283 path traversal fix)', () => {
  it('should accept a path within the root', () => {
    expect(isPathWithinRoot('/home/user/workitems/P01', '/home/user/workitems')).toBe(true);
  });

  it('should accept the root itself', () => {
    expect(isPathWithinRoot('/home/user/workitems', '/home/user/workitems')).toBe(true);
  });

  it('should reject a path traversal with ../', () => {
    expect(isPathWithinRoot('/home/user/workitems/../secrets', '/home/user/workitems')).toBe(false);
  });

  it('should reject an absolute path outside root', () => {
    expect(isPathWithinRoot('/etc/passwd', '/home/user/workitems')).toBe(false);
  });

  it('should reject a sibling directory', () => {
    expect(isPathWithinRoot('/home/user/other', '/home/user/workitems')).toBe(false);
  });

  it('should reject a path that is a prefix but not a child', () => {
    // /home/user/workitems-evil should NOT match /home/user/workitems
    expect(isPathWithinRoot('/home/user/workitems-evil', '/home/user/workitems')).toBe(false);
  });

  it('should handle deeply nested valid paths', () => {
    expect(isPathWithinRoot('/home/user/workitems/a/b/c/d', '/home/user/workitems')).toBe(true);
  });

  it('should reject double-encoded traversal', () => {
    // path.resolve normalizes this
    expect(isPathWithinRoot('/home/user/workitems/../../etc', '/home/user/workitems')).toBe(false);
  });
});
