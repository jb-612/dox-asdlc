import { useState, useCallback, useEffect } from 'react';
import type { RepoMount, RepoSource } from '../../../shared/types/repo';

// ---------------------------------------------------------------------------
// RepoMountSection (P15-F03)
//
// Lets the user pick a local directory or clone a GitHub repo, then
// optionally specify file restriction glob patterns.
//
// Tabs:
//   - "Local Directory": browse button + path display + validation status
//   - "GitHub Repo": HTTPS URL input + clone button + progress/error display
//
// Below the tabs (once a path is set), a file restrictions editor allows
// adding glob patterns as chips.
// ---------------------------------------------------------------------------

export interface RepoMountSectionProps {
  value: RepoMount | null;
  onChange: (mount: RepoMount | null) => void;
}

type ValidationStatus = 'idle' | 'validating' | 'valid-git' | 'valid-no-git' | 'invalid';

export default function RepoMountSection({ value, onChange }: RepoMountSectionProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<RepoSource>(value?.source ?? 'local');
  const [localPath, setLocalPath] = useState(value?.localPath ?? '');
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
  const [githubUrl, setGithubUrl] = useState(value?.githubUrl ?? '');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [restrictionInput, setRestrictionInput] = useState('');

  // Sync local state from value prop changes
  useEffect(() => {
    if (value) {
      setActiveTab(value.source);
      if (value.localPath) setLocalPath(value.localPath);
      if (value.githubUrl) setGithubUrl(value.githubUrl);
    }
  }, [value]);

  // ------ Local directory tab ------

  const handleBrowse = useCallback(async () => {
    const path = await window.electronAPI.dialog.openDirectory();
    if (!path) return;

    setLocalPath(path);
    setValidationStatus('validating');

    try {
      const result = await window.electronAPI.repo.validate(path);
      if (result.valid && result.hasGit) {
        setValidationStatus('valid-git');
      } else if (result.valid) {
        setValidationStatus('valid-no-git');
      } else {
        setValidationStatus('invalid');
      }
    } catch {
      setValidationStatus('invalid');
    }

    onChange({
      source: 'local',
      localPath: path,
      fileRestrictions: value?.fileRestrictions ?? [],
    });
  }, [onChange, value?.fileRestrictions]);

  // ------ GitHub tab ------

  const handleClone = useCallback(async () => {
    if (!githubUrl.trim()) return;

    setIsCloning(true);
    setCloneError(null);

    try {
      const result = await window.electronAPI.repo.clone(githubUrl.trim());
      if (result.success && result.localPath) {
        setLocalPath(result.localPath);
        setValidationStatus('valid-git');
        onChange({
          source: 'github',
          githubUrl: githubUrl.trim(),
          localPath: result.localPath,
          fileRestrictions: value?.fileRestrictions ?? [],
        });
      } else {
        setCloneError(result.error ?? 'Clone failed');
      }
    } catch (err: unknown) {
      setCloneError(err instanceof Error ? err.message : 'Clone failed');
    } finally {
      setIsCloning(false);
    }
  }, [githubUrl, onChange, value?.fileRestrictions]);

  const handleCancelClone = useCallback(async () => {
    try {
      await window.electronAPI.repo.cancelClone();
    } catch {
      // Best effort
    }
    setIsCloning(false);
  }, []);

  // ------ File restrictions ------

  const addRestriction = useCallback(
    (pattern: string) => {
      const trimmed = pattern.trim();
      if (!trimmed) return;

      const current = value?.fileRestrictions ?? [];
      if (current.includes(trimmed)) return;

      const updated = [...current, trimmed];
      onChange({
        ...(value ?? { source: activeTab }),
        localPath: value?.localPath ?? localPath,
        githubUrl: value?.githubUrl ?? githubUrl,
        fileRestrictions: updated,
      });
      setRestrictionInput('');
    },
    [value, onChange, activeTab, localPath, githubUrl],
  );

  const removeRestriction = useCallback(
    (pattern: string) => {
      const current = value?.fileRestrictions ?? [];
      const updated = current.filter((p) => p !== pattern);
      onChange({
        ...(value ?? { source: activeTab }),
        localPath: value?.localPath ?? localPath,
        githubUrl: value?.githubUrl ?? githubUrl,
        fileRestrictions: updated,
      });
    },
    [value, onChange, activeTab, localPath, githubUrl],
  );

  const handleRestrictionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addRestriction(restrictionInput);
      }
    },
    [addRestriction, restrictionInput],
  );

  // ------ Validation chip display ------

  const validationChip = (() => {
    switch (validationStatus) {
      case 'valid-git':
        return (
          <span
            data-testid="repo-validate-status"
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700/50"
          >
            Valid git repo
          </span>
        );
      case 'valid-no-git':
        return (
          <span
            data-testid="repo-validate-status"
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-700/50"
          >
            No .git found
          </span>
        );
      case 'invalid':
        return (
          <span
            data-testid="repo-validate-status"
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/50"
          >
            Invalid path
          </span>
        );
      case 'validating':
        return (
          <span
            data-testid="repo-validate-status"
            className="text-xs text-gray-500"
          >
            Validating...
          </span>
        );
      default:
        return null;
    }
  })();

  const hasPath = !!(value?.localPath);

  return (
    <div data-testid="repo-mount-section" className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1">
        <button
          type="button"
          data-testid="repo-tab-local"
          onClick={() => setActiveTab('local')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'local'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          Local Directory
        </button>
        <button
          type="button"
          data-testid="repo-tab-github"
          onClick={() => setActiveTab('github')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            activeTab === 'github'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          GitHub Repo
        </button>
      </div>

      {/* Tab panels */}
      {activeTab === 'local' ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              data-testid="repo-path-input"
              value={localPath}
              placeholder="No directory selected"
              className="flex-1 text-xs bg-gray-900 text-gray-300 border border-gray-600 rounded px-2.5 py-1.5 outline-none cursor-default"
            />
            <button
              type="button"
              data-testid="repo-browse-btn"
              onClick={handleBrowse}
              className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors whitespace-nowrap"
            >
              Browse...
            </button>
          </div>
          {validationChip && <div>{validationChip}</div>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              data-testid="repo-github-url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repo.git"
              disabled={isCloning}
              className="flex-1 text-xs bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded px-2.5 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none disabled:opacity-50"
            />
            {isCloning ? (
              <button
                type="button"
                onClick={handleCancelClone}
                className="px-3 py-1.5 text-xs font-medium bg-red-700 hover:bg-red-600 text-white rounded transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                data-testid="repo-clone-btn"
                onClick={handleClone}
                disabled={!githubUrl.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clone
              </button>
            )}
          </div>
          {isCloning && (
            <div data-testid="repo-clone-status" className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Cloning...
            </div>
          )}
          {cloneError && (
            <p data-testid="repo-clone-status" className="text-xs text-red-400">
              {cloneError}
            </p>
          )}
          {!isCloning && !cloneError && value?.source === 'github' && value?.localPath && (
            <p data-testid="repo-clone-status" className="text-xs text-green-400">
              Cloned to: {value.localPath}
            </p>
          )}
        </div>
      )}

      {/* File restrictions editor -- shown once a path is set */}
      {hasPath && (
        <div className="pt-2 border-t border-gray-700/50 space-y-2">
          <label className="block text-xs font-medium text-gray-400">
            File Restrictions (glob patterns)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              data-testid="file-restrictions-input"
              value={restrictionInput}
              onChange={(e) => setRestrictionInput(e.target.value)}
              onKeyDown={handleRestrictionKeyDown}
              placeholder="e.g. src/**/*.ts"
              className="flex-1 text-xs bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded px-2.5 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
            />
            <button
              type="button"
              onClick={() => addRestriction(restrictionInput)}
              disabled={!restrictionInput.trim()}
              className="px-2.5 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          {(value?.fileRestrictions?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value?.fileRestrictions?.map((pattern) => (
                <span
                  key={pattern}
                  data-testid="file-restriction-chip"
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300"
                >
                  {pattern}
                  <button
                    type="button"
                    onClick={() => removeRestriction(pattern)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
