import { useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import type { FileDiff } from '../../../shared/types/execution';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffViewerProps {
  diffs: FileDiff[];
  mode?: 'side_by_side' | 'unified';
  onOpenInVSCode?: (path: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DiffViewer({
  diffs,
  mode: initialMode = 'side_by_side',
  onOpenInVSCode,
}: DiffViewerProps): JSX.Element {
  const [mode, setMode] = useState(initialMode);

  if (diffs.length === 0) {
    return (
      <div data-testid="diff-viewer" className="p-4">
        <p className="text-sm text-gray-500 text-center">No changes</p>
      </div>
    );
  }

  const splitView = mode === 'side_by_side';

  return (
    <div data-testid="diff-viewer" className="p-4 space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-1 text-xs rounded ${
            splitView ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
          }`}
          onClick={() => setMode('side_by_side')}
        >
          Side by Side
        </button>
        <button
          type="button"
          className={`px-3 py-1 text-xs rounded ${
            !splitView ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
          }`}
          onClick={() => setMode('unified')}
        >
          Unified
        </button>
      </div>

      {/* File diffs */}
      {diffs.map((diff) => (
        <details key={diff.path} open role="group" className="border border-gray-700 rounded">
          <summary className="flex items-center justify-between px-3 py-2 bg-gray-800 cursor-pointer text-sm text-gray-200 hover:bg-gray-750">
            <span className="font-mono text-xs">{diff.path}</span>
            {onOpenInVSCode && (
              <button
                type="button"
                className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenInVSCode(diff.path);
                }}
              >
                Open in VSCode
              </button>
            )}
          </summary>
          <div className="overflow-x-auto">
            <ReactDiffViewer
              oldValue={diff.oldContent ?? ''}
              newValue={diff.newContent ?? ''}
              splitView={splitView}
              useDarkTheme
            />
          </div>
        </details>
      ))}
    </div>
  );
}
