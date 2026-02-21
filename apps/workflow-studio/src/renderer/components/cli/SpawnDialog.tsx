import { useState, useCallback } from 'react';
import type { CLISpawnConfig } from '../../../shared/types/cli';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpawnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSpawn: (config: CLISpawnConfig) => void;
  defaultCwd?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal dialog for spawning a new CLI session.
 *
 * Fields:
 *  - Command (default: "claude")
 *  - Args (textarea, one per line)
 *  - Working directory
 *  - Instance ID (optional)
 */
export default function SpawnDialog({
  isOpen,
  onClose,
  onSpawn,
  defaultCwd = '',
}: SpawnDialogProps): JSX.Element | null {
  const [command, setCommand] = useState('claude');
  const [argsText, setArgsText] = useState('');
  const [cwd, setCwd] = useState(defaultCwd);
  const [instanceId, setInstanceId] = useState('');

  const handleSpawn = useCallback(() => {
    const args = argsText
      .split('\n')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const config: CLISpawnConfig = {
      command: command.trim() || 'claude',
      args,
      cwd: cwd.trim() || '.',
      ...(instanceId.trim() ? { instanceId: instanceId.trim() } : {}),
    };

    onSpawn(config);
    // Reset fields
    setCommand('claude');
    setArgsText('');
    setCwd(defaultCwd);
    setInstanceId('');
    onClose();
  }, [command, argsText, cwd, instanceId, defaultCwd, onSpawn, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-[480px] bg-gray-800 rounded-xl border border-gray-600 shadow-2xl p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          Spawn CLI Session
        </h2>

        <div className="space-y-3 mb-5">
          {/* Command */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Command
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="claude"
              className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
              autoFocus
            />
          </div>

          {/* Args */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Arguments (one per line)
            </label>
            <textarea
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              placeholder="--model&#10;claude-sonnet-4-20250514"
              rows={3}
              className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none resize-none font-mono"
            />
          </div>

          {/* Working Directory */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Working Directory
            </label>
            <input
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="/home/user/project"
              className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
            />
          </div>

          {/* Instance ID */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Instance ID (optional)
            </label>
            <input
              type="text"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="p11-guardrails"
              className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Sets CLAUDE_INSTANCE_ID for the session.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSpawn}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Spawn
          </button>
        </div>
      </div>
    </div>
  );
}
