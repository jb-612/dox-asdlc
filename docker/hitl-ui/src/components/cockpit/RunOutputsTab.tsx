/**
 * RunOutputsTab - Displays run outputs, patches, and test results
 */

import { useState, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  DocumentDuplicateIcon,
  BeakerIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Output artifact */
export interface OutputArtifact {
  /** Artifact ID */
  id: string;
  /** Artifact name */
  name: string;
  /** Artifact type */
  type: string;
  /** Size in bytes */
  size: number;
  /** Status */
  status: 'created' | 'updated' | 'unchanged';
}

/** Patch */
export interface Patch {
  /** Patch ID */
  id: string;
  /** File path */
  file: string;
  /** Lines added */
  additions: number;
  /** Lines deleted */
  deletions: number;
  /** Diff content */
  diff: string;
}

/** Test failure */
export interface TestFailure {
  /** Test name */
  name: string;
  /** Error message */
  error: string;
  /** File path */
  file: string;
}

/** Test results */
export interface TestResults {
  /** Total tests */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Duration in ms */
  duration: number;
  /** Test failures */
  failures: TestFailure[];
}

/** Run metrics */
export interface RunMetrics {
  /** Tokens used */
  tokens: number;
  /** Cost in USD */
  cost: number;
  /** Duration in seconds */
  duration: number;
}

/** Run outputs */
export interface RunOutputs {
  /** Output artifacts */
  artifacts: OutputArtifact[];
  /** Patches */
  patches: Patch[];
  /** Test results */
  testResults?: TestResults;
  /** Metrics */
  metrics: RunMetrics;
}

export interface RunOutputsTabProps {
  /** Output data */
  outputs: RunOutputs;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when artifact is clicked */
  onArtifactClick?: (artifactId: string) => void;
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

// Format number with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Format duration
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// Format test duration
function formatTestDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

// Format cost
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

// Status colors
const statusColors: Record<string, string> = {
  created: 'text-status-success',
  updated: 'text-accent-teal',
  unchanged: 'text-text-muted',
};

export default function RunOutputsTab({
  outputs,
  isLoading = false,
  className,
  onArtifactClick,
}: RunOutputsTabProps) {
  const [expandedPatches, setExpandedPatches] = useState<Set<string>>(new Set());

  // Toggle patch expansion
  const togglePatch = useCallback((patchId: string) => {
    setExpandedPatches((prev) => {
      const next = new Set(prev);
      if (next.has(patchId)) {
        next.delete(patchId);
      } else {
        next.add(patchId);
      }
      return next;
    });
  }, []);

  // Handle artifact click
  const handleArtifactClick = useCallback(
    (artifactId: string) => {
      onArtifactClick?.(artifactId);
    },
    [onArtifactClick]
  );

  // Calculate pass rate
  const passRate = outputs.testResults
    ? Math.round((outputs.testResults.passed / outputs.testResults.total) * 100)
    : 0;

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('space-y-4', className)}
        data-testid="outputs-loading"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-border-primary bg-bg-secondary p-4"
            data-testid="section-skeleton"
          >
            <div className="h-5 w-32 bg-bg-tertiary rounded animate-pulse mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-64 bg-bg-tertiary rounded animate-pulse" />
              <div className="h-4 w-48 bg-bg-tertiary rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)} data-testid="run-outputs-tab">
      <h3 className="text-lg font-semibold text-text-primary">Run Outputs</h3>

      {/* Output Artifacts Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-4"
        data-testid="output-artifacts-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <DocumentIcon className="h-5 w-5 text-text-muted" />
          <h4 className="font-medium text-text-primary">Output Artifacts</h4>
          <span className="text-xs text-text-muted">({outputs.artifacts.length})</span>
        </div>

        {outputs.artifacts.length === 0 ? (
          <p className="text-sm text-text-muted">No output artifacts</p>
        ) : (
          <div className="space-y-2">
            {outputs.artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className={clsx(
                  'flex items-center justify-between p-2 rounded-lg bg-bg-tertiary',
                  onArtifactClick && 'cursor-pointer hover:bg-bg-primary transition-colors'
                )}
                data-testid={`output-${artifact.id}`}
                tabIndex={onArtifactClick ? 0 : undefined}
                onClick={() => onArtifactClick && handleArtifactClick(artifact.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onArtifactClick) {
                    handleArtifactClick(artifact.id);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <DocumentIcon className="h-4 w-4 text-text-muted" />
                  <span className="text-sm text-text-primary">{artifact.name}</span>
                  <span className={clsx('text-xs capitalize', statusColors[artifact.status])}>
                    {artifact.status}
                  </span>
                </div>
                <span className="text-xs text-text-muted">{formatSize(artifact.size)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Patches Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-4"
        data-testid="patches-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <DocumentDuplicateIcon className="h-5 w-5 text-text-muted" />
          <h4 className="font-medium text-text-primary">Patches</h4>
          <span className="text-xs text-text-muted">({outputs.patches.length})</span>
        </div>

        {outputs.patches.length === 0 ? (
          <p className="text-sm text-text-muted">No patches generated</p>
        ) : (
          <div className="space-y-2">
            {outputs.patches.map((patch) => (
              <div
                key={patch.id}
                className="rounded-lg bg-bg-tertiary overflow-hidden"
                data-testid={`patch-${patch.id}`}
              >
                <button
                  onClick={() => togglePatch(patch.id)}
                  className="w-full p-2 flex items-center justify-between hover:bg-bg-primary transition-colors"
                  data-testid={`expand-${patch.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-text-primary">{patch.file}</span>
                    <span className="text-xs text-status-success">+{patch.additions}</span>
                    <span className="text-xs text-status-error">-{patch.deletions}</span>
                  </div>
                  {expandedPatches.has(patch.id) ? (
                    <ChevronDownIcon className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-text-muted" />
                  )}
                </button>

                {expandedPatches.has(patch.id) && (
                  <div
                    className="p-2 border-t border-border-secondary"
                    data-testid={`diff-${patch.id}`}
                  >
                    <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap text-text-secondary">
                      {patch.diff}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Test Results Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-4"
        data-testid="test-results-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <BeakerIcon className="h-5 w-5 text-text-muted" />
          <h4 className="font-medium text-text-primary">Test Results</h4>
        </div>

        {!outputs.testResults ? (
          <p className="text-sm text-text-muted">No test results available</p>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-text-primary" data-testid="tests-total">
                  {outputs.testResults.total}
                </div>
                <div className="text-xs text-text-muted">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-status-success" data-testid="tests-passed">
                  {outputs.testResults.passed}
                </div>
                <div className="text-xs text-text-muted">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-status-error" data-testid="tests-failed">
                  {outputs.testResults.failed}
                </div>
                <div className="text-xs text-text-muted">Failed</div>
              </div>
              <div className="text-center">
                <div
                  className={clsx(
                    'text-2xl font-bold',
                    passRate >= 90 ? 'text-status-success' : passRate >= 70 ? 'text-status-warning' : 'text-status-error'
                  )}
                  data-testid="tests-rate"
                >
                  {passRate}%
                </div>
                <div className="text-xs text-text-muted">Pass Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-text-primary" data-testid="tests-duration">
                  {formatTestDuration(outputs.testResults.duration)}
                </div>
                <div className="text-xs text-text-muted">Duration</div>
              </div>
            </div>

            {/* Failures */}
            {outputs.testResults.failures.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-text-muted">Failures:</div>
                {outputs.testResults.failures.map((failure, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-status-error/10 border border-status-error/20"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <XCircleIcon className="h-4 w-4 text-status-error" />
                      <span className="text-sm font-mono text-text-primary">{failure.name}</span>
                    </div>
                    <p className="text-xs text-text-muted pl-6">{failure.file}</p>
                    <p className="text-xs text-status-error pl-6 mt-1">{failure.error}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Metrics Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-4"
        data-testid="metrics-section"
      >
        <div className="flex items-center gap-2 mb-3">
          <ChartBarIcon className="h-5 w-5 text-text-muted" />
          <h4 className="font-medium text-text-primary">Metrics</h4>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-bg-tertiary text-center">
            <div className="text-xl font-bold text-text-primary" data-testid="metric-tokens">
              {formatNumber(outputs.metrics.tokens)}
            </div>
            <div className="text-xs text-text-muted">Tokens</div>
          </div>
          <div className="p-3 rounded-lg bg-bg-tertiary text-center">
            <div className="text-xl font-bold text-text-primary" data-testid="metric-cost">
              {formatCost(outputs.metrics.cost)}
            </div>
            <div className="text-xs text-text-muted">Cost</div>
          </div>
          <div className="p-3 rounded-lg bg-bg-tertiary text-center">
            <div className="text-xl font-bold text-text-primary" data-testid="metric-duration">
              {formatDuration(outputs.metrics.duration)}
            </div>
            <div className="text-xs text-text-muted">Duration</div>
          </div>
        </div>
      </section>
    </div>
  );
}
