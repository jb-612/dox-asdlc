/**
 * CodeDiff - Displays code diffs with syntax highlighting
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { diffLines, Change } from 'diff';
import Prism from 'prismjs';
import {
  DocumentDuplicateIcon,
  Bars3BottomLeftIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

// Load Prism languages
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-diff';

export type DiffViewMode = 'unified' | 'side-by-side';

export interface CodeDiffProps {
  /** Original (old) content */
  oldContent: string;
  /** New (modified) content */
  newContent: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** View mode */
  mode?: DiffViewMode;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Show mode toggle */
  showModeToggle?: boolean;
  /** Old content label */
  oldLabel?: string;
  /** New content label */
  newLabel?: string;
  /** Custom class name */
  className?: string;
  /** Callback when mode changes */
  onModeChange?: (mode: DiffViewMode) => void;
}

interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export default function CodeDiff({
  oldContent,
  newContent,
  language = 'text',
  mode: initialMode = 'unified',
  showLineNumbers = true,
  showModeToggle = true,
  oldLabel = 'Original',
  newLabel = 'Modified',
  className,
  onModeChange,
}: CodeDiffProps) {
  const [mode, setMode] = useState<DiffViewMode>(initialMode);
  const contentRef = useRef<HTMLDivElement>(null);

  // Compute diff lines
  const diffResult = useMemo(() => {
    const changes = diffLines(oldContent, newContent);
    const lines: DiffLine[] = [];
    let oldLineNum = 1;
    let newLineNum = 1;

    changes.forEach((change: Change) => {
      const changeLines = change.value.split('\n');
      // Remove empty last element if the value ends with newline
      if (changeLines[changeLines.length - 1] === '') {
        changeLines.pop();
      }

      changeLines.forEach((line) => {
        if (change.added) {
          lines.push({
            type: 'add',
            content: line,
            newLineNumber: newLineNum++,
          });
        } else if (change.removed) {
          lines.push({
            type: 'remove',
            content: line,
            oldLineNumber: oldLineNum++,
          });
        } else {
          lines.push({
            type: 'unchanged',
            content: line,
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++,
          });
        }
      });
    });

    return lines;
  }, [oldContent, newContent]);

  // Compute stats
  const stats = useMemo(() => {
    const additions = diffResult.filter((l) => l.type === 'add').length;
    const deletions = diffResult.filter((l) => l.type === 'remove').length;
    return { additions, deletions };
  }, [diffResult]);

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: DiffViewMode) => {
      setMode(newMode);
      onModeChange?.(newMode);
    },
    [onModeChange]
  );

  // Apply Prism highlighting after render
  useEffect(() => {
    if (contentRef.current && language !== 'text') {
      Prism.highlightAllUnder(contentRef.current);
    }
  }, [oldContent, newContent, mode, language]);

  // Get line background class
  const getLineBackground = (type: DiffLine['type']) => {
    switch (type) {
      case 'add':
        return 'bg-green-900/30';
      case 'remove':
        return 'bg-red-900/30';
      default:
        return '';
    }
  };

  // Get line number class
  const getLineNumberClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'add':
        return 'text-green-500';
      case 'remove':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  // Get prefix symbol
  const getPrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'add':
        return '+';
      case 'remove':
        return '-';
      default:
        return ' ';
    }
  };

  // Get prefix class
  const getPrefixClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'add':
        return 'text-green-500';
      case 'remove':
        return 'text-red-500';
      default:
        return 'text-gray-600';
    }
  };

  // Render header with stats and mode toggle
  const renderHeader = () => (
    <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary">
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-secondary">
          <span className="text-green-500" data-testid="additions">
            +{stats.additions}
          </span>
          <span className="mx-2">/</span>
          <span className="text-red-500" data-testid="deletions">
            -{stats.deletions}
          </span>
        </span>
        {language !== 'text' && (
          <span className="text-xs text-text-muted font-mono">{language}</span>
        )}
      </div>

      {showModeToggle && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleModeChange('unified')}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              mode === 'unified'
                ? 'bg-accent-teal text-white'
                : 'text-text-secondary hover:bg-bg-tertiary'
            )}
            aria-label="Unified view"
          >
            <Bars3BottomLeftIcon className="h-4 w-4" />
            Unified
          </button>
          <button
            onClick={() => handleModeChange('side-by-side')}
            className={clsx(
              'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
              mode === 'side-by-side'
                ? 'bg-accent-teal text-white'
                : 'text-text-secondary hover:bg-bg-tertiary'
            )}
            aria-label="Side by side view"
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
            Split
          </button>
        </div>
      )}
    </div>
  );

  // Render unified view
  const renderUnifiedView = () => (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-sm">
        <tbody>
          {diffResult.map((line, index) => (
            <tr key={index} className={getLineBackground(line.type)}>
              {showLineNumbers && (
                <>
                  <td
                    className={clsx(
                      'px-2 py-0.5 text-right select-none border-r border-border-secondary w-12',
                      getLineNumberClass(line.type)
                    )}
                    data-testid="old-line-number"
                  >
                    {line.oldLineNumber || ''}
                  </td>
                  <td
                    className={clsx(
                      'px-2 py-0.5 text-right select-none border-r border-border-secondary w-12',
                      getLineNumberClass(line.type)
                    )}
                    data-testid="new-line-number"
                  >
                    {line.newLineNumber || ''}
                  </td>
                </>
              )}
              <td
                className={clsx(
                  'px-1 py-0.5 select-none w-4',
                  getPrefixClass(line.type)
                )}
                data-testid="diff-prefix"
              >
                {getPrefix(line.type)}
              </td>
              <td className="px-2 py-0.5 whitespace-pre text-text-primary">
                <code className={`language-${language}`}>{line.content}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Prepare side-by-side data
  const sideBySideData = useMemo(() => {
    const left: (DiffLine | null)[] = [];
    const right: (DiffLine | null)[] = [];

    let i = 0;
    while (i < diffResult.length) {
      const line = diffResult[i];

      if (line.type === 'unchanged') {
        left.push(line);
        right.push(line);
        i++;
      } else if (line.type === 'remove') {
        // Collect consecutive removes
        const removes: DiffLine[] = [];
        while (i < diffResult.length && diffResult[i].type === 'remove') {
          removes.push(diffResult[i]);
          i++;
        }
        // Collect consecutive adds
        const adds: DiffLine[] = [];
        while (i < diffResult.length && diffResult[i].type === 'add') {
          adds.push(diffResult[i]);
          i++;
        }
        // Pair them up
        const maxLen = Math.max(removes.length, adds.length);
        for (let j = 0; j < maxLen; j++) {
          left.push(removes[j] || null);
          right.push(adds[j] || null);
        }
      } else if (line.type === 'add') {
        // Standalone add (not after remove)
        left.push(null);
        right.push(line);
        i++;
      }
    }

    return { left, right };
  }, [diffResult]);

  // Render side-by-side view
  const renderSideBySideView = () => (
    <div className="grid grid-cols-2 divide-x divide-border-primary">
      {/* Left side (old) */}
      <div>
        <div className="px-3 py-1.5 bg-bg-tertiary text-xs text-text-muted font-medium border-b border-border-secondary">
          {oldLabel}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <tbody>
              {sideBySideData.left.map((line, index) => (
                <tr
                  key={index}
                  className={line ? getLineBackground(line.type) : ''}
                >
                  {showLineNumbers && (
                    <td
                      className={clsx(
                        'px-2 py-0.5 text-right select-none border-r border-border-secondary w-12',
                        line ? getLineNumberClass(line.type) : 'text-gray-500'
                      )}
                    >
                      {line?.oldLineNumber || ''}
                    </td>
                  )}
                  <td
                    className={clsx(
                      'px-1 py-0.5 select-none w-4',
                      line ? getPrefixClass(line.type) : ''
                    )}
                  >
                    {line ? getPrefix(line.type) : ''}
                  </td>
                  <td className="px-2 py-0.5 whitespace-pre text-text-primary min-h-[1.5rem]">
                    {line && (
                      <code className={`language-${language}`}>
                        {line.content}
                      </code>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right side (new) */}
      <div>
        <div className="px-3 py-1.5 bg-bg-tertiary text-xs text-text-muted font-medium border-b border-border-secondary">
          {newLabel}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <tbody>
              {sideBySideData.right.map((line, index) => (
                <tr
                  key={index}
                  className={line ? getLineBackground(line.type) : ''}
                >
                  {showLineNumbers && (
                    <td
                      className={clsx(
                        'px-2 py-0.5 text-right select-none border-r border-border-secondary w-12',
                        line ? getLineNumberClass(line.type) : 'text-gray-500'
                      )}
                    >
                      {line?.newLineNumber || ''}
                    </td>
                  )}
                  <td
                    className={clsx(
                      'px-1 py-0.5 select-none w-4',
                      line ? getPrefixClass(line.type) : ''
                    )}
                  >
                    {line ? getPrefix(line.type) : ''}
                  </td>
                  <td className="px-2 py-0.5 whitespace-pre text-text-primary min-h-[1.5rem]">
                    {line && (
                      <code className={`language-${language}`}>
                        {line.content}
                      </code>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={clsx(
        'code-diff rounded-lg border border-border-primary overflow-hidden',
        className
      )}
      ref={contentRef}
    >
      {renderHeader()}
      {mode === 'unified' ? renderUnifiedView() : renderSideBySideView()}
    </div>
  );
}
