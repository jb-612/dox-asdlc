import { useState, useCallback, useEffect } from 'react';
import type { CLISpawnConfig, CLISpawnMode, CLISessionContext } from '../../../shared/types/cli';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpawnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSpawn: (config: CLISpawnConfig) => void;
  defaultCwd?: string;
  /** Pre-fill from a history entry "re-run" action. */
  prefillConfig?: Partial<CLISpawnConfig>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GITHUB_ISSUE_PATTERN = /^[\w.-]+\/[\w.-]+#\d+$|^https:\/\/github\.com\/.+\/issues\/\d+$/;

function isValidGithubIssue(value: string): boolean {
  if (!value.trim()) return true; // empty is valid (optional)
  return GITHUB_ISSUE_PATTERN.test(value.trim());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal dialog for spawning a new CLI session.
 *
 * Supports local and Docker modes with optional session context.
 * Includes quick-start presets (T08) and Docker status indicator (T07).
 */
export default function SpawnDialog({
  isOpen,
  onClose,
  onSpawn,
  defaultCwd = '',
  prefillConfig,
}: SpawnDialogProps): JSX.Element | null {
  // Form state
  const [mode, setMode] = useState<CLISpawnMode>('local');
  const [command, setCommand] = useState('claude');
  const [argsText, setArgsText] = useState('');
  const [cwd, setCwd] = useState(defaultCwd);
  const [instanceId, setInstanceId] = useState('');

  // Context fields
  const [repoPath, setRepoPath] = useState('');
  const [githubIssue, setGithubIssue] = useState('');
  const [workflowTemplate, setWorkflowTemplate] = useState('');
  const [showContext, setShowContext] = useState(false);

  // Docker status
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null);
  const [dockerVersion, setDockerVersion] = useState<string | undefined>();

  // Check Docker status when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setDockerAvailable(null);
    window.electronAPI.cli
      .getDockerStatus()
      .then(({ available, version }) => {
        setDockerAvailable(available);
        setDockerVersion(version);
      })
      .catch(() => {
        setDockerAvailable(false);
      });
  }, [isOpen]);

  // Apply prefill when it changes
  useEffect(() => {
    if (!prefillConfig) return;
    setMode(prefillConfig.mode ?? 'local');
    setCommand(prefillConfig.command ?? 'claude');
    setArgsText(prefillConfig.args?.join('\n') ?? '');
    setCwd(prefillConfig.cwd ?? defaultCwd);
    setInstanceId(prefillConfig.instanceId ?? '');
    if (prefillConfig.context) {
      setShowContext(true);
      setRepoPath(prefillConfig.context.repoPath ?? '');
      setGithubIssue(prefillConfig.context.githubIssue ?? '');
      setWorkflowTemplate(prefillConfig.context.workflowTemplate ?? '');
    }
  }, [prefillConfig, defaultCwd]);

  // -------------------------------------------------------------------------
  // Quick-start presets (T08)
  // -------------------------------------------------------------------------

  const applyPreset = useCallback(
    (preset: 'raw' | 'issue' | 'template') => {
      switch (preset) {
        case 'raw':
          setMode('local');
          setCommand('claude');
          setArgsText('');
          setCwd(defaultCwd);
          setInstanceId('');
          setShowContext(false);
          setRepoPath('');
          setGithubIssue('');
          setWorkflowTemplate('');
          break;
        case 'issue':
          setMode('docker');
          setCommand('claude');
          setArgsText('');
          setShowContext(true);
          setRepoPath('');
          setGithubIssue('');
          setWorkflowTemplate('');
          break;
        case 'template':
          setMode('docker');
          setCommand('claude');
          setArgsText('');
          setShowContext(true);
          setRepoPath('');
          setGithubIssue('');
          setWorkflowTemplate('');
          break;
      }
    },
    [defaultCwd],
  );

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handlePickDirectory = useCallback(async () => {
    const dir = await window.electronAPI.dialog.openDirectory();
    if (dir) setRepoPath(dir);
  }, []);

  const handleSpawn = useCallback(() => {
    const args = argsText
      .split('\n')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const context: CLISessionContext | undefined =
      repoPath || githubIssue || workflowTemplate
        ? {
            ...(repoPath ? { repoPath } : {}),
            ...(githubIssue ? { githubIssue: githubIssue.trim() } : {}),
            ...(workflowTemplate ? { workflowTemplate } : {}),
          }
        : undefined;

    const config: CLISpawnConfig = {
      command: command.trim() || 'claude',
      args,
      cwd: cwd.trim() || '.',
      mode,
      ...(instanceId.trim() ? { instanceId: instanceId.trim() } : {}),
      ...(context ? { context } : {}),
    };

    onSpawn(config);

    // Reset fields
    setMode('local');
    setCommand('claude');
    setArgsText('');
    setCwd(defaultCwd);
    setInstanceId('');
    setRepoPath('');
    setGithubIssue('');
    setWorkflowTemplate('');
    setShowContext(false);
    onClose();
  }, [command, argsText, cwd, instanceId, mode, repoPath, githubIssue, workflowTemplate, defaultCwd, onSpawn, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  const issueValid = isValidGithubIssue(githubIssue);
  const dockerDisabled = mode === 'docker' && dockerAvailable === false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-[520px] max-h-[90vh] overflow-y-auto bg-gray-800 rounded-xl border border-gray-600 shadow-2xl p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          Spawn CLI Session
        </h2>

        {/* Quick-start presets (T08) */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">
            Presets
          </span>
          <button
            type="button"
            onClick={() => applyPreset('raw')}
            className="px-2.5 py-1 text-[11px] font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Raw Session
          </button>
          <button
            type="button"
            onClick={() => applyPreset('issue')}
            className="px-2.5 py-1 text-[11px] font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Issue Focus
          </button>
          <button
            type="button"
            onClick={() => applyPreset('template')}
            className="px-2.5 py-1 text-[11px] font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Template Run
          </button>
        </div>

        <div className="space-y-3 mb-5">
          {/* Mode toggle (T07) */}
          <div className="flex items-center gap-4">
            <label className="block text-xs font-medium text-gray-400">Mode</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="spawn-mode"
                  value="local"
                  checked={mode === 'local'}
                  onChange={() => setMode('local')}
                  className="accent-blue-500"
                />
                <span className="text-xs text-gray-300">Local</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="spawn-mode"
                  value="docker"
                  checked={mode === 'docker'}
                  onChange={() => setMode('docker')}
                  disabled={dockerAvailable === false}
                  className="accent-blue-500"
                />
                <span className={`text-xs ${dockerAvailable === false ? 'text-gray-600' : 'text-gray-300'}`}>
                  Docker
                </span>
              </label>
              {/* Docker status indicator */}
              {dockerAvailable === null && (
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Checking Docker..." />
              )}
              {dockerAvailable === true && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" title="Docker available" />
                  {dockerVersion && (
                    <span className="text-[10px] text-gray-500">v{dockerVersion}</span>
                  )}
                </span>
              )}
              {dockerAvailable === false && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" title="Docker not available" />
                  <span className="text-[10px] text-gray-500">Not found</span>
                </span>
              )}
            </div>
          </div>

          {dockerDisabled && (
            <p className="text-[10px] text-red-400">
              Docker is not available. Install Docker or switch to Local mode.
            </p>
          )}

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

          {/* Session Context (collapsible) */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowContext(!showContext)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-gray-400 hover:bg-gray-700/50 transition-colors"
            >
              <span>Session Context</span>
              <span className="text-gray-500">{showContext ? '\u25B2' : '\u25BC'}</span>
            </button>

            {showContext && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-700">
                {/* Repo path */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Repository Path
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={repoPath}
                      onChange={(e) => setRepoPath(e.target.value)}
                      placeholder="/path/to/repo"
                      className="flex-1 text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={handlePickDirectory}
                      className="px-2.5 py-2 text-xs font-medium rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors shrink-0"
                    >
                      Browse
                    </button>
                  </div>
                  {mode === 'docker' && repoPath && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Will be mounted as /workspace in the container.
                    </p>
                  )}
                </div>

                {/* GitHub issue */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    GitHub Issue
                  </label>
                  <input
                    type="text"
                    value={githubIssue}
                    onChange={(e) => setGithubIssue(e.target.value)}
                    placeholder="owner/repo#123"
                    className={`w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border rounded-lg px-3 py-2 focus:ring-1 outline-none font-mono ${
                      issueValid
                        ? 'border-gray-600 focus:border-blue-500 focus:ring-blue-500/30'
                        : 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                    }`}
                  />
                  {!issueValid && (
                    <p className="text-[10px] text-red-400 mt-1">
                      Format: owner/repo#number or full GitHub issue URL
                    </p>
                  )}
                </div>

                {/* Workflow template */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Workflow Template (optional)
                  </label>
                  <input
                    type="text"
                    value={workflowTemplate}
                    onChange={(e) => setWorkflowTemplate(e.target.value)}
                    placeholder="Template ID or name"
                    className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-mono"
                  />
                </div>
              </div>
            )}
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
            disabled={dockerDisabled || !issueValid}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Spawn
          </button>
        </div>
      </div>
    </div>
  );
}
