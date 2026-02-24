import type { FileDiff } from '../../../shared/types/execution';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffViewerProps {
  diffs: FileDiff[];
  mode: 'side_by_side' | 'unified';
  onOpenInVSCode?: (path: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Stub diff viewer component. Displays file paths from diffs or a placeholder
 * when no diffs are available.
 *
 * TODO: Use react-diff-viewer-continued for the full implementation with
 * side-by-side and unified diff rendering.
 */
export default function DiffViewer({
  diffs,
  mode: _mode,
  onOpenInVSCode: _onOpenInVSCode,
}: DiffViewerProps): JSX.Element {
  if (diffs.length === 0) {
    return (
      <div data-testid="diff-viewer" className="p-4">
        <p
          data-testid="diff-placeholder"
          className="text-sm text-gray-500 text-center"
        >
          No changes to display. Code diff viewer coming soon.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="diff-viewer" className="p-4 space-y-2">
      {diffs.map((diff) => (
        <div
          key={diff.path}
          className="px-3 py-2 bg-gray-800 rounded text-xs text-gray-300 font-mono"
        >
          {diff.path}
        </div>
      ))}
    </div>
  );
}
