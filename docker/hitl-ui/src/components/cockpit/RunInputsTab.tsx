/**
 * RunInputsTab - Displays run input artifacts, context packs, and configuration
 */

import { useState, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  FolderIcon,
  CogIcon,
  CloudIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Input artifact */
export interface InputArtifact {
  /** Artifact ID */
  id: string;
  /** Artifact name */
  name: string;
  /** Artifact type */
  type: string;
  /** Size in bytes */
  size: number;
}

/** Context pack */
export interface ContextPack {
  /** Context pack ID */
  id: string;
  /** Context pack name */
  name: string;
  /** Token count */
  tokenCount: number;
  /** Included files */
  files: string[];
}

/** Run configuration */
export interface RunConfiguration {
  /** Model name */
  model: string;
  /** Max tokens */
  maxTokens: number;
  /** Temperature */
  temperature: number;
  /** System prompt */
  systemPrompt: string;
  /** Additional parameters */
  [key: string]: unknown;
}

/** Environment info */
export interface EnvironmentInfo {
  /** Environment name */
  name: string;
  /** Git branch */
  branch: string;
  /** Git SHA */
  sha: string;
}

/** Run inputs */
export interface RunInputs {
  /** Input artifacts */
  artifacts: InputArtifact[];
  /** Context pack */
  contextPack?: ContextPack;
  /** Configuration */
  configuration: RunConfiguration;
  /** Environment */
  environment: EnvironmentInfo;
}

export interface RunInputsTabProps {
  /** Input data */
  inputs: RunInputs;
  /** Loading state */
  isLoading?: boolean;
  /** Token warning threshold */
  tokenWarningThreshold?: number;
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

// Truncate text
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Short SHA
function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export default function RunInputsTab({
  inputs,
  isLoading = false,
  tokenWarningThreshold = 100000,
  className,
  onArtifactClick,
}: RunInputsTabProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [expandedPrompt, setExpandedPrompt] = useState(false);

  // Toggle section collapse
  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
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

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx('space-y-4', className)}
        data-testid="inputs-loading"
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

  const isPromptLong = inputs.configuration.systemPrompt.length > 200;
  const tokenWarning = inputs.contextPack && inputs.contextPack.tokenCount > tokenWarningThreshold;

  return (
    <div className={clsx('space-y-4', className)} data-testid="run-inputs-tab">
      <h3 className="text-lg font-semibold text-text-primary">Run Inputs</h3>

      {/* Artifacts Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary overflow-hidden"
        data-testid="artifacts-section"
      >
        <button
          onClick={() => toggleSection('artifacts')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors"
          data-testid="collapse-artifacts"
          aria-expanded={!collapsedSections.has('artifacts')}
        >
          <div className="flex items-center gap-2">
            <DocumentIcon className="h-5 w-5 text-text-muted" />
            <h4 className="font-medium text-text-primary">Input Artifacts</h4>
            <span className="text-xs text-text-muted">({inputs.artifacts.length})</span>
          </div>
          {collapsedSections.has('artifacts') ? (
            <ChevronRightIcon className="h-5 w-5 text-text-muted" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-text-muted" />
          )}
        </button>

        {!collapsedSections.has('artifacts') && (
          <div className="px-4 pb-4">
            {inputs.artifacts.length === 0 ? (
              <p className="text-sm text-text-muted">No input artifacts</p>
            ) : (
              <div className="space-y-2">
                {inputs.artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className={clsx(
                      'flex items-center justify-between p-2 rounded-lg bg-bg-tertiary',
                      onArtifactClick && 'cursor-pointer hover:bg-bg-primary transition-colors'
                    )}
                    data-testid={`artifact-${artifact.id}`}
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
                      <span className="text-xs text-text-muted px-1.5 py-0.5 rounded bg-bg-primary">
                        {artifact.type}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted">{formatSize(artifact.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Context Pack Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary overflow-hidden"
        data-testid="context-pack-section"
      >
        <button
          onClick={() => toggleSection('context')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors"
          data-testid="collapse-context"
          aria-expanded={!collapsedSections.has('context')}
        >
          <div className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5 text-text-muted" />
            <h4 className="font-medium text-text-primary">Context Pack</h4>
          </div>
          {collapsedSections.has('context') ? (
            <ChevronRightIcon className="h-5 w-5 text-text-muted" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-text-muted" />
          )}
        </button>

        {!collapsedSections.has('context') && (
          <div className="px-4 pb-4">
            {!inputs.contextPack ? (
              <p className="text-sm text-text-muted">No context pack</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">{inputs.contextPack.name}</span>
                  <span
                    className="text-xs text-text-muted px-1.5 py-0.5 rounded bg-bg-primary"
                    data-testid="file-count"
                  >
                    {inputs.contextPack.files.length} files
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">Tokens:</span>
                  <span
                    className={clsx(
                      'text-sm font-mono',
                      tokenWarning ? 'text-status-warning' : 'text-text-primary'
                    )}
                    data-testid="token-count"
                  >
                    {formatNumber(inputs.contextPack.tokenCount)}
                  </span>
                  {tokenWarning && (
                    <ExclamationTriangleIcon
                      className="h-4 w-4 text-status-warning"
                      data-testid="token-warning"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-text-muted">Files:</span>
                  <div className="flex flex-wrap gap-1">
                    {inputs.contextPack.files.map((file) => (
                      <span
                        key={file}
                        className="text-xs font-mono px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Configuration Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary overflow-hidden"
        data-testid="config-section"
      >
        <button
          onClick={() => toggleSection('config')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors"
          data-testid="collapse-config"
          aria-expanded={!collapsedSections.has('config')}
        >
          <div className="flex items-center gap-2">
            <CogIcon className="h-5 w-5 text-text-muted" />
            <h4 className="font-medium text-text-primary">Configuration</h4>
          </div>
          {collapsedSections.has('config') ? (
            <ChevronRightIcon className="h-5 w-5 text-text-muted" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-text-muted" />
          )}
        </button>

        {!collapsedSections.has('config') && (
          <div className="px-4 pb-4">
            <dl className="space-y-2">
              <div className="flex items-center gap-2">
                <dt className="text-sm text-text-muted">Model:</dt>
                <dd className="text-sm font-mono text-text-primary">{inputs.configuration.model}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-sm text-text-muted">Max Tokens:</dt>
                <dd
                  className="text-sm font-mono text-text-primary"
                  data-testid="config-maxTokens"
                >
                  {inputs.configuration.maxTokens}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-sm text-text-muted">Temperature:</dt>
                <dd
                  className="text-sm font-mono text-text-primary"
                  data-testid="config-temperature"
                >
                  {inputs.configuration.temperature}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm text-text-muted">System Prompt:</dt>
                <dd>
                  {!expandedPrompt ? (
                    <div className="flex items-start gap-2">
                      <p
                        className="text-sm text-text-secondary flex-1"
                        data-testid="system-prompt-preview"
                      >
                        {truncate(inputs.configuration.systemPrompt, 200)}
                      </p>
                      {isPromptLong && (
                        <button
                          onClick={() => setExpandedPrompt(true)}
                          className="text-xs text-accent-teal hover:underline shrink-0"
                          data-testid="expand-prompt"
                        >
                          Show more
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p
                        className="text-sm text-text-secondary whitespace-pre-wrap"
                        data-testid="system-prompt-full"
                      >
                        {inputs.configuration.systemPrompt}
                      </p>
                      <button
                        onClick={() => setExpandedPrompt(false)}
                        className="text-xs text-accent-teal hover:underline"
                      >
                        Show less
                      </button>
                    </div>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </section>

      {/* Environment Section */}
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary overflow-hidden"
        data-testid="environment-section"
      >
        <button
          onClick={() => toggleSection('environment')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors"
          data-testid="collapse-environment"
          aria-expanded={!collapsedSections.has('environment')}
        >
          <div className="flex items-center gap-2">
            <CloudIcon className="h-5 w-5 text-text-muted" />
            <h4 className="font-medium text-text-primary">Environment</h4>
          </div>
          {collapsedSections.has('environment') ? (
            <ChevronRightIcon className="h-5 w-5 text-text-muted" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-text-muted" />
          )}
        </button>

        {!collapsedSections.has('environment') && (
          <div className="px-4 pb-4">
            <dl className="space-y-2">
              <div className="flex items-center gap-2">
                <dt className="text-sm text-text-muted">Environment:</dt>
                <dd className="text-sm text-text-primary">{inputs.environment.name}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-sm text-text-muted">Branch:</dt>
                <dd className="text-sm font-mono px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary">
                  {inputs.environment.branch}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-sm text-text-muted">SHA:</dt>
                <dd className="text-sm font-mono text-text-secondary">{shortSha(inputs.environment.sha)}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}
