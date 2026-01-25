/**
 * SearchResultCard - Individual search result display with highlighting
 *
 * Part of P05-F08 KnowledgeStore Search UI
 */

import { useMemo } from 'react';
import {
  DocumentTextIcon,
  CodeBracketIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { KSSearchResult } from '../../api/types';

export interface SearchResultCardProps {
  /** Search result data */
  result: KSSearchResult;
  /** Terms to highlight in content */
  highlightTerms?: string[];
  /** Click handler */
  onClick?: () => void;
}

/**
 * Get file icon based on file type
 */
function getFileIcon(fileType: string | undefined) {
  switch (fileType) {
    case '.py':
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
    case '.go':
    case '.rs':
    case '.java':
    case '.c':
    case '.cpp':
    case '.cs':
      return CodeBracketIcon;
    case '.md':
    case '.mdx':
    case '.txt':
    case '.rst':
      return DocumentTextIcon;
    default:
      return DocumentIcon;
  }
}

/**
 * Get score color class based on score value
 */
function getScoreColor(score: number): { bg: string; text: string } {
  if (score >= 0.8) {
    return { bg: 'bg-green-500/20', text: 'text-green-400' };
  } else if (score >= 0.5) {
    return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' };
  } else {
    return { bg: 'bg-red-500/20', text: 'text-red-400' };
  }
}

/**
 * Highlight search terms in content
 */
function highlightContent(
  content: string,
  terms: string[],
  maxLength: number = 300
): React.ReactNode {
  // Truncate content first
  let displayContent = content;
  if (displayContent.length > maxLength) {
    displayContent = displayContent.slice(0, maxLength) + '...';
  }

  if (!terms || terms.length === 0) {
    return displayContent;
  }

  // Create regex for all terms (case-insensitive)
  const escapedTerms = terms.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

  // Split content by matches
  const parts = displayContent.split(regex);

  return parts.map((part, index) => {
    const isMatch = terms.some(
      (term) => part.toLowerCase() === term.toLowerCase()
    );
    if (isMatch) {
      return (
        <mark
          key={index}
          className="bg-accent-teal/30 text-inherit rounded px-0.5"
          data-testid="highlighted-term"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

export default function SearchResultCard({
  result,
  highlightTerms = [],
  onClick,
}: SearchResultCardProps) {
  const { docId, content, metadata, score } = result;
  const {
    file_path,
    file_type,
    language,
    line_start,
    line_end,
  } = metadata;

  const FileIcon = useMemo(() => getFileIcon(file_type), [file_type]);
  const scoreColor = useMemo(() => getScoreColor(score), [score]);
  const scorePercent = Math.round(score * 100);

  const hasLineRange = line_start !== undefined && line_end !== undefined;

  const highlightedContent = useMemo(
    () => highlightContent(content, highlightTerms),
    [content, highlightTerms]
  );

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left p-4 rounded-lg border border-border-primary bg-bg-secondary',
        'hover:bg-bg-tertiary hover:border-accent-teal/50',
        'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:ring-offset-2 focus:ring-offset-bg-primary',
        'transition-all duration-150 group'
      )}
      data-testid="search-result-card"
    >
      {/* Header: File path, line range, score */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileIcon
            className="h-5 w-5 text-text-muted flex-shrink-0"
            data-testid="file-icon"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-text-primary truncate group-hover:text-accent-teal transition-colors">
              {file_path || docId}
            </div>
            {hasLineRange && (
              <div className="text-xs text-text-muted">
                Lines {line_start}-{line_end}
              </div>
            )}
          </div>
        </div>

        {/* Score badge */}
        <div
          className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium flex-shrink-0',
            scoreColor.bg,
            scoreColor.text
          )}
          data-testid="score-badge"
        >
          {scorePercent}%
        </div>
      </div>

      {/* Content preview */}
      <div
        className="text-sm text-text-secondary font-mono bg-bg-primary/50 rounded p-2 mb-2 whitespace-pre-wrap break-words leading-relaxed"
        data-testid="content-preview"
      >
        {highlightedContent}
      </div>

      {/* Footer: Language and metadata tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {language && (
          <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-muted">
            {language}
          </span>
        )}
        {file_type && (
          <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-muted">
            {file_type}
          </span>
        )}
      </div>
    </button>
  );
}
