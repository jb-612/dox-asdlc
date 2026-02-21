/**
 * ContentTab - Displays artifact content with markdown rendering
 */

import { useState, useCallback } from 'react';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  EyeIcon,
  CodeBracketIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import MarkdownRenderer from '../common/MarkdownRenderer';

/** Validation rule result */
export interface ValidationRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Did rule pass */
  passed: boolean;
  /** Error message if failed */
  error?: string;
}

/** Validation result */
export interface ValidationResult {
  /** Is content valid */
  isValid: boolean;
  /** When validation was performed */
  checkedAt: string;
  /** Rule results */
  rules: ValidationRule[];
}

export interface ContentTabProps {
  /** Content to display */
  content: string;
  /** Show table of contents */
  showToc?: boolean;
  /** Validation result */
  validation?: ValidationResult;
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when content is copied */
  onCopy?: () => void;
}

/** View mode */
type ViewMode = 'rendered' | 'raw';

// Format timestamp
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ContentTab({
  content,
  showToc: initialShowToc = true,
  validation,
  isLoading = false,
  className,
  onCopy,
}: ContentTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('rendered');
  const [showToc, setShowToc] = useState(initialShowToc);
  const [copied, setCopied] = useState(false);
  const [validationExpanded, setValidationExpanded] = useState(false);

  // Handle copy
  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  }, [content, onCopy]);

  // Toggle TOC
  const handleToggleToc = useCallback(() => {
    setShowToc((prev) => !prev);
  }, []);

  // Toggle validation expansion
  const handleToggleValidation = useCallback(() => {
    setValidationExpanded((prev) => !prev);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className={clsx('p-4', className)} data-testid="content-loading">
        <div className="h-10 w-full bg-bg-tertiary rounded animate-pulse mb-4" />
        <div
          className="h-96 bg-bg-tertiary rounded animate-pulse"
          data-testid="content-skeleton"
        />
      </div>
    );
  }

  // Empty state
  if (!content) {
    return (
      <div className={clsx('p-4', className)} data-testid="content-tab">
        <div className="flex items-center justify-center h-64 text-text-muted">
          No content available
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full', className)} data-testid="content-tab">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-primary">
        {/* View mode toggle */}
        <div
          className="flex rounded-lg border border-border-primary p-0.5"
          data-testid="view-mode-toggle"
        >
          <button
            onClick={() => setViewMode('rendered')}
            className={clsx(
              'flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors',
              viewMode === 'rendered'
                ? 'bg-accent-blue text-white'
                : 'text-text-muted hover:text-text-primary'
            )}
            aria-label="Rendered view"
            data-testid="view-mode-rendered"
          >
            <EyeIcon className="h-4 w-4" />
            Rendered
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={clsx(
              'flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors',
              viewMode === 'raw'
                ? 'bg-accent-blue text-white'
                : 'text-text-muted hover:text-text-primary'
            )}
            aria-label="Raw view"
            data-testid="view-mode-raw"
          >
            <CodeBracketIcon className="h-4 w-4" />
            Raw
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {viewMode === 'rendered' && (
            <button
              onClick={handleToggleToc}
              className={clsx(
                'flex items-center gap-1 px-2 py-1 rounded text-sm',
                'hover:bg-bg-tertiary transition-colors',
                showToc ? 'text-accent-blue' : 'text-text-muted'
              )}
              data-testid="toggle-toc"
            >
              <ListBulletIcon className="h-4 w-4" />
              TOC
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-sm text-text-muted hover:bg-bg-tertiary transition-colors"
            aria-label="Copy content"
            data-testid="copy-content"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 text-status-success" />
                <span className="text-status-success">Copied</span>
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Validation status */}
      {validation && (
        <div
          className="p-4 border-b border-border-primary"
          data-testid="validation-status"
        >
          <button
            type="button"
            onClick={handleToggleValidation}
            className="flex items-center gap-2 cursor-pointer w-full text-left"
            aria-expanded={validationExpanded}
            data-testid="expand-validation"
          >
            {validationExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-text-muted" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-text-muted" />
            )}
            <span
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                validation.isValid
                  ? 'bg-status-success/10 text-status-success'
                  : 'bg-status-error/10 text-status-error'
              )}
              data-testid="validation-badge"
            >
              {validation.isValid ? (
                <>
                  <CheckCircleIcon className="h-3 w-3" />
                  Valid
                </>
              ) : (
                <>
                  <XCircleIcon className="h-3 w-3" />
                  Invalid
                </>
              )}
            </span>
            <span className="text-xs text-text-muted" data-testid="validation-time">
              Checked {formatTimestamp(validation.checkedAt)}
            </span>
          </button>

          {validationExpanded && (
            <div className="mt-3 ml-6 space-y-2">
              {validation.rules.map((rule) => (
                <div key={rule.id} className="flex items-start gap-2">
                  {rule.passed ? (
                    <CheckCircleIcon className="h-4 w-4 text-status-success flex-shrink-0" />
                  ) : (
                    <XCircleIcon className="h-4 w-4 text-status-error flex-shrink-0" />
                  )}
                  <div>
                    <span className="text-sm text-text-primary">{rule.name}</span>
                    {rule.error && (
                      <p className="text-xs text-status-error mt-0.5">{rule.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'rendered' ? (
          <MarkdownRenderer content={content} showToc={showToc} />
        ) : (
          <pre
            className="p-4 rounded-lg bg-bg-tertiary overflow-x-auto text-sm text-text-primary font-mono whitespace-pre-wrap"
            data-testid="raw-content"
          >
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
