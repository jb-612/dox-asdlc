/**
 * DocumentDetail - Full document view component
 *
 * Part of P05-F08 KnowledgeStore Search UI
 *
 * Displays full document content with syntax highlighting and metadata.
 */

import clsx from 'clsx';
import type { SearchBackendMode } from '../../api/types';
import { useDocument } from '../../api/searchHooks';

// ============================================================================
// Types
// ============================================================================

interface DocumentDetailProps {
  /** Document ID to display */
  docId: string;
  /** Callback when close button is clicked */
  onClose: () => void;
  /** Backend mode to use for fetching */
  backendMode?: SearchBackendMode;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Get language from file extension for syntax highlighting
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    py: 'python',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'bash',
    bash: 'bash',
    css: 'css',
    html: 'html',
    sql: 'sql',
  };
  return languageMap[ext ?? ''] ?? 'plaintext';
}

/**
 * Get file icon based on file type
 */
function getFileIcon(fileType: string): string {
  const iconMap: Record<string, string> = {
    '.py': 'py',
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.js': 'js',
    '.jsx': 'jsx',
    '.json': 'json',
    '.md': 'md',
  };
  return iconMap[fileType] ?? 'file';
}

// ============================================================================
// Component
// ============================================================================

export default function DocumentDetail({
  docId,
  onClose,
  backendMode = 'mock',
  className,
}: DocumentDetailProps) {
  // Fetch document
  const { data: document, isLoading, error } = useDocument(docId, { mode: backendMode });

  // Extract metadata
  const filePath = document?.metadata?.file_path as string | undefined;
  const fileType = document?.metadata?.file_type as string | undefined;
  const language = document?.metadata?.language as string | undefined;
  const lineStart = document?.metadata?.line_start as number | undefined;
  const lineEnd = document?.metadata?.line_end as number | undefined;
  const indexedAt = document?.metadata?.indexed_at as string | undefined;

  // Format indexed date
  const formattedDate = indexedAt
    ? new Date(indexedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx(
          'min-h-screen bg-bg-primary flex items-center justify-center',
          className
        )}
        data-testid="document-loading"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-teal" />
      </div>
    );
  }

  // Error state
  if (error || !document) {
    return (
      <div
        className={clsx('min-h-screen bg-bg-primary', className)}
        data-testid="document-error"
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Back button */}
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6"
            aria-label="Back to search"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Search
          </button>

          {/* Error message */}
          <div className="bg-status-error/10 border border-status-error/30 rounded-lg p-6 text-center">
            <svg
              className="h-12 w-12 mx-auto mb-4 text-status-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Document Not Found
            </h2>
            <p className="text-text-secondary mb-4">
              The document with ID "{docId}" could not be found.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent-teal text-white rounded-md hover:bg-accent-teal/90"
            >
              Return to Search
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('min-h-screen bg-bg-primary', className)}
      data-testid="document-detail"
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header with back button */}
        <div className="mb-6">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4"
            aria-label="Back to search"
            data-testid="back-button"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Search
          </button>

          {/* Breadcrumb */}
          <nav className="text-sm text-text-muted mb-2" aria-label="Breadcrumb">
            <span>Search</span>
            <span className="mx-2">/</span>
            <span className="text-text-secondary">{filePath ?? docId}</span>
          </nav>
        </div>

        {/* Document card */}
        <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
          {/* Metadata header */}
          <div className="px-6 py-4 border-b border-border-primary">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {/* File icon */}
                  <span className="text-lg font-mono text-accent-teal">
                    {getFileIcon(fileType ?? '')}
                  </span>
                  <h1 className="text-lg font-semibold text-text-primary">
                    {filePath ?? docId}
                  </h1>
                </div>

                {/* Metadata tags */}
                <div className="flex flex-wrap gap-2">
                  {language && (
                    <span className="px-2 py-0.5 bg-accent-purple/20 text-accent-purple text-xs rounded">
                      {language}
                    </span>
                  )}
                  {lineStart !== undefined && lineEnd !== undefined && (
                    <span className="px-2 py-0.5 bg-bg-tertiary text-text-muted text-xs rounded">
                      Lines {lineStart}-{lineEnd}
                    </span>
                  )}
                  {formattedDate && (
                    <span className="px-2 py-0.5 bg-bg-tertiary text-text-muted text-xs rounded">
                      Indexed: {formattedDate}
                    </span>
                  )}
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-md"
                aria-label="Close document"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Document content */}
          <div className="p-6">
            <pre
              className={clsx(
                'p-4 bg-bg-primary rounded-md overflow-x-auto',
                'text-sm font-mono text-text-primary',
                'border border-border-secondary'
              )}
              data-testid="document-content"
            >
              <code className={`language-${getLanguageFromPath(filePath ?? '')}`}>
                {document.content}
              </code>
            </pre>
          </div>

          {/* Footer with document ID */}
          <div className="px-6 py-3 border-t border-border-primary bg-bg-tertiary/50">
            <p className="text-xs text-text-muted font-mono truncate">
              Document ID: {document.docId}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
