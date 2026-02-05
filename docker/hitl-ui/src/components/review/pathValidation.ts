/**
 * Path validation utilities for code review components
 */

/**
 * Validate path format
 * @param path - The path to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validatePath(path: string): string | undefined {
  if (!path) return undefined;

  if (path.startsWith('/')) {
    return 'Absolute paths are not allowed';
  }

  if (path.includes('..')) {
    return 'Path traversal is not allowed';
  }

  // Check for invalid characters (Windows-style)
  if (/[<>:"|?*]/.test(path)) {
    return 'Path contains invalid characters';
  }

  return undefined;
}
