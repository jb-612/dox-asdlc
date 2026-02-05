/**
 * Modal for creating GitHub issues from code review findings
 */

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { ReviewFinding } from '../../api/types';
import {
  Repository,
  Label,
  Issue,
  listRepositories,
  listLabels,
  createIssueFromFinding,
  createIssuesFromFindings,
} from '../../api/github';
import { generateIssueTitle, generateIssueBody } from '../../utils/issueTemplates';

interface GitHubIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  findings: ReviewFinding[];
  swarmId: string;
  mode: 'single' | 'bulk';
}

type ModalState = 'configure' | 'creating' | 'success' | 'error';

export function GitHubIssueModal({
  isOpen,
  onClose,
  findings,
  swarmId,
  mode,
}: GitHubIssueModalProps) {
  const [state, setState] = useState<ModalState>('configure');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [createdIssues, setCreatedIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string>('');

  // Load repositories on mount
  useEffect(() => {
    if (isOpen) {
      loadRepositories();
    }
  }, [isOpen]);

  // Load labels when repo changes
  useEffect(() => {
    if (selectedRepo) {
      loadLabels(selectedRepo);
    }
  }, [selectedRepo]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setState('configure');
      setProgress({ current: 0, total: 0 });
      setCreatedIssues([]);
      setError('');
    }
  }, [isOpen]);

  const loadRepositories = async () => {
    try {
      const repos = await listRepositories();
      setRepositories(repos);
      if (repos.length > 0 && !selectedRepo) {
        setSelectedRepo(repos[0].full_name);
      }
    } catch (err) {
      setError('Failed to load repositories');
    }
  };

  const loadLabels = async (repo: string) => {
    try {
      const repoLabels = await listLabels(repo);
      setLabels(repoLabels);
    } catch (err) {
      console.error('Failed to load labels:', err);
    }
  };

  const handleCreate = async () => {
    if (!selectedRepo) return;

    setState('creating');
    setProgress({ current: 0, total: findings.length });

    try {
      if (mode === 'single' && findings.length === 1) {
        const issue = await createIssueFromFinding(
          selectedRepo,
          findings[0],
          swarmId,
          selectedLabels.length > 0 ? selectedLabels : undefined
        );
        setCreatedIssues([issue]);
        setState('success');
      } else {
        const result = await createIssuesFromFindings(
          selectedRepo,
          findings,
          swarmId,
          selectedLabels.length > 0 ? selectedLabels : undefined,
          (current, total) => setProgress({ current, total })
        );
        setCreatedIssues(result.created);
        if (result.failed.length > 0) {
          setError(`${result.failed.length} issue(s) failed to create`);
        }
        setState('success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issues');
      setState('error');
    }
  };

  const toggleLabel = (labelName: string) => {
    setSelectedLabels(prev =>
      prev.includes(labelName)
        ? prev.filter(l => l !== labelName)
        : [...prev, labelName]
    );
  };

  const previewTitle = findings.length === 1 ? generateIssueTitle(findings[0]) : '';
  const previewBody = findings.length === 1 ? generateIssueBody(findings[0], swarmId) : '';

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl rounded-lg bg-bg-primary border border-border-primary shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-primary">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              {mode === 'single' ? 'Create GitHub Issue' : `Create ${findings.length} GitHub Issues`}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {state === 'configure' && (
              <>
                {/* Repository Picker */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Repository
                  </label>
                  <select
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border-primary bg-bg-secondary text-text-primary"
                  >
                    {repositories.map(repo => (
                      <option key={repo.id} value={repo.full_name}>
                        {repo.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Label Selector */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Labels
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {labels.map(label => (
                      <button
                        key={label.id}
                        onClick={() => toggleLabel(label.name)}
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-medium border',
                          selectedLabels.includes(label.name)
                            ? 'border-accent-primary bg-accent-primary/20 text-accent-primary'
                            : 'border-border-primary bg-bg-secondary text-text-secondary hover:border-border-secondary'
                        )}
                      >
                        {label.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview (single mode only) */}
                {mode === 'single' && findings.length === 1 && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Preview
                    </label>
                    <div className="rounded border border-border-primary bg-bg-secondary p-3 space-y-2">
                      <p className="font-medium text-text-primary">{previewTitle}</p>
                      <pre className="text-xs text-text-tertiary whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {previewBody}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Bulk summary */}
                {mode === 'bulk' && (
                  <div className="rounded border border-border-primary bg-bg-secondary p-3">
                    <p className="text-sm text-text-secondary">
                      This will create <span className="font-semibold text-text-primary">{findings.length}</span> issues
                      in <span className="font-semibold text-text-primary">{selectedRepo}</span>.
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Issues will be created sequentially with a 1 second delay to avoid rate limiting.
                    </p>
                  </div>
                )}
              </>
            )}

            {state === 'creating' && (
              <div className="py-8 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-text-primary">
                  Creating issues... {progress.current} / {progress.total}
                </p>
              </div>
            )}

            {state === 'success' && (
              <div className="py-8 text-center">
                <CheckCircleIcon className="h-12 w-12 text-status-success mx-auto mb-4" />
                <p className="text-lg font-semibold text-text-primary mb-2">
                  {createdIssues.length} issue{createdIssues.length !== 1 ? 's' : ''} created!
                </p>
                <div className="space-y-1">
                  {createdIssues.slice(0, 5).map(issue => (
                    <a
                      key={issue.id}
                      href={issue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-accent-primary hover:underline"
                    >
                      #{issue.number} - {issue.title}
                    </a>
                  ))}
                  {createdIssues.length > 5 && (
                    <p className="text-xs text-text-tertiary">
                      And {createdIssues.length - 5} more...
                    </p>
                  )}
                </div>
                {error && (
                  <p className="mt-4 text-sm text-status-warning">{error}</p>
                )}
              </div>
            )}

            {state === 'error' && (
              <div className="py-8 text-center">
                <ExclamationCircleIcon className="h-12 w-12 text-status-error mx-auto mb-4" />
                <p className="text-lg font-semibold text-text-primary mb-2">
                  Failed to create issues
                </p>
                <p className="text-sm text-status-error">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t border-border-primary">
            {state === 'configure' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded border border-border-primary text-text-secondary hover:bg-bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!selectedRepo}
                  className="px-4 py-2 rounded bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-50"
                >
                  Create Issue{mode === 'bulk' ? 's' : ''}
                </button>
              </>
            )}
            {(state === 'success' || state === 'error') && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-accent-primary text-white hover:bg-accent-primary/90"
              >
                Close
              </button>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
