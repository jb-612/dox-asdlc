// ---------------------------------------------------------------------------
// Merge strategies for parallel block outputs (P15-F05, T31)
//
// Strategies:
//   - 'concatenate': joins outputs as an array
//   - 'workspace': detects file conflicts, returns merged file list
//   - 'custom': invokes user-provided merge function (pass-through default)
// ---------------------------------------------------------------------------

import type { ParallelBlockResult } from '../../shared/types/execution';
import type { MergeStrategy } from '../../shared/types/workflow';

/**
 * Custom merge function signature.
 * Takes the array of parallel block results and returns a merged value.
 */
export type CustomMergeFn = (results: ParallelBlockResult[]) => unknown;

/**
 * Merge results from parallel block executions according to the given strategy.
 *
 * @param strategy      The merge strategy to apply.
 * @param results       Array of parallel block results to merge.
 * @param customMergeFn Optional user-provided merge function (only for 'custom').
 * @returns The merged output, shape depends on strategy.
 */
export function mergeResults(
  strategy: MergeStrategy | string,
  results: ParallelBlockResult[],
  customMergeFn?: CustomMergeFn,
): unknown {
  switch (strategy) {
    case 'concatenate':
      return mergeConcatenate(results);

    case 'workspace':
      return mergeWorkspace(results);

    case 'custom':
      return mergeCustom(results, customMergeFn);

    default:
      // Unknown strategy -- fall back to concatenate
      return mergeConcatenate(results);
  }
}

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

/**
 * Concatenate strategy: collects all outputs into a flat array.
 */
function mergeConcatenate(results: ParallelBlockResult[]): unknown[] {
  return results.map((r) => r.output);
}

/**
 * Workspace strategy: detects file conflicts across parallel block outputs.
 *
 * Each block output is expected to optionally contain a `filesChanged` array
 * of file paths. The strategy merges all files and identifies paths that were
 * modified by more than one block (conflicts).
 *
 * @returns An object with `files` (all unique files) and `conflicts` (duplicates).
 */
function mergeWorkspace(
  results: ParallelBlockResult[],
): { files: string[]; conflicts: string[] } {
  const fileCount = new Map<string, number>();

  for (const result of results) {
    const output = result.output as Record<string, unknown> | undefined;
    const filesChanged = output?.filesChanged;

    if (Array.isArray(filesChanged)) {
      for (const file of filesChanged) {
        if (typeof file === 'string') {
          fileCount.set(file, (fileCount.get(file) ?? 0) + 1);
        }
      }
    }
  }

  const files: string[] = [...fileCount.keys()];
  const conflicts: string[] = [];

  for (const [file, count] of fileCount) {
    if (count > 1) {
      conflicts.push(file);
    }
  }

  return { files, conflicts };
}

/**
 * Custom strategy: invokes a user-provided merge function if given,
 * otherwise returns the raw results array as a pass-through.
 */
function mergeCustom(
  results: ParallelBlockResult[],
  customFn?: CustomMergeFn,
): unknown {
  if (customFn) {
    return customFn(results);
  }
  // Pass-through: return results as-is for downstream processing
  return results;
}
