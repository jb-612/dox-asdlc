import { useState } from 'react';
import type { MergeConflict, MergeResolution } from '../../../shared/types/execution';

export interface MergeConflictDialogProps {
  conflicts: MergeConflict[];
  onResolve: (resolutions: MergeResolution[]) => void;
}

export default function MergeConflictDialog({
  conflicts,
  onResolve,
}: MergeConflictDialogProps): JSX.Element {
  const [selections, setSelections] = useState<Record<string, string>>({});

  const allSelected = conflicts.every((c) => selections[c.filePath]);

  const handleSelect = (filePath: string, blockId: string) => {
    setSelections((prev) => ({ ...prev, [filePath]: blockId }));
  };

  const handleResolve = () => {
    const resolutions: MergeResolution[] = conflicts.map((c) => ({
      filePath: c.filePath,
      keepBlockId: selections[c.filePath],
    }));
    onResolve(resolutions);
  };

  const handleAbort = () => {
    const resolutions: MergeResolution[] = conflicts.map((c) => ({
      filePath: c.filePath,
      keepBlockId: 'abort',
    }));
    onResolve(resolutions);
  };

  return (
    <div
      data-testid="merge-conflict-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">Merge Conflicts Detected</h2>
        <p className="text-sm text-gray-400">
          {conflicts.length} file(s) have conflicting changes from parallel blocks
        </p>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          {conflicts.map((conflict) => (
            <div
              key={conflict.filePath}
              data-testid="conflict-item"
              className="p-3 bg-gray-700/50 rounded border border-gray-600"
            >
              <p className="text-sm font-mono text-gray-200 mb-2">{conflict.filePath}</p>
              <div role="radiogroup" aria-label={`Resolution for ${conflict.filePath}`} className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    name={conflict.filePath}
                    value={conflict.blockAId}
                    checked={selections[conflict.filePath] === conflict.blockAId}
                    onChange={() => handleSelect(conflict.filePath, conflict.blockAId)}
                  />
                  Keep {conflict.blockAId}
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    name={conflict.filePath}
                    value={conflict.blockBId}
                    checked={selections[conflict.filePath] === conflict.blockBId}
                    onChange={() => handleSelect(conflict.filePath, conflict.blockBId)}
                  />
                  Keep {conflict.blockBId}
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-700">
          <button
            type="button"
            onClick={handleAbort}
            className="px-4 py-2 text-sm rounded bg-gray-600 hover:bg-gray-500 text-gray-200"
          >
            Abort Execution
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={!allSelected}
            className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resolve All
          </button>
        </div>
      </div>
    </div>
  );
}
