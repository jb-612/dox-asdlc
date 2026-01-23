/**
 * MarkdownRenderer - Renders markdown with syntax highlighting and multiple view modes
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Prism from 'prismjs';
import {
  ClipboardIcon,
  CheckIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { extractTableOfContents, type TocEntry } from '../../utils/markdown';

// Load Prism languages
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-diff';

export type ViewMode = 'view' | 'diff' | 'side-by-side';

export interface MarkdownRendererProps {
  /** Primary markdown content */
  content: string;
  /** Secondary content for diff/side-by-side modes */
  compareContent?: string;
  /** View mode */
  mode?: ViewMode;
  /** Show table of contents */
  showToc?: boolean;
  /** Show mode toggle buttons */
  showModeToggle?: boolean;
  /** Enable dark mode for code blocks */
  darkCodeBlocks?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when mode changes */
  onModeChange?: (mode: ViewMode) => void;
  /** Labels for side-by-side view */
  sideBySideLabels?: { left: string; right: string };
}

export default function MarkdownRenderer({
  content,
  compareContent,
  mode: initialMode = 'view',
  showToc = false,
  showModeToggle = false,
  darkCodeBlocks = true,
  className,
  onModeChange,
  sideBySideLabels = { left: 'Before', right: 'After' },
}: MarkdownRendererProps) {
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Extract table of contents
  const toc = useMemo(() => {
    if (!showToc) return [];
    return extractTableOfContents(content);
  }, [content, showToc]);

  // Handle mode change
  const handleModeChange = useCallback(
    (newMode: ViewMode) => {
      setMode(newMode);
      onModeChange?.(newMode);
    },
    [onModeChange]
  );

  // Copy code to clipboard
  const copyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, []);

  // Highlight code blocks after render
  useEffect(() => {
    if (contentRef.current) {
      Prism.highlightAllUnder(contentRef.current);
    }
  }, [content, compareContent, mode]);

  // Custom code block renderer
  const CodeBlock = useCallback(
    ({
      language,
      code,
    }: {
      language: string;
      code: string;
    }) => {
      return (
        <div className="relative group my-4">
          <div
            className={clsx(
              'rounded-lg overflow-hidden',
              darkCodeBlocks ? 'bg-gray-900' : 'bg-gray-100'
            )}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <span
                className={clsx(
                  'text-xs font-mono',
                  darkCodeBlocks ? 'text-gray-400' : 'text-gray-600'
                )}
                data-testid="code-language"
              >
                {language}
              </span>
              <button
                onClick={() => copyCode(code)}
                className={clsx(
                  'p-1 rounded transition-colors',
                  darkCodeBlocks
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-200 text-gray-600'
                )}
                aria-label="Copy code"
              >
                {copiedCode === code ? (
                  <CheckIcon className="h-4 w-4 text-status-success" />
                ) : (
                  <ClipboardIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            <pre
              className={clsx(
                'p-4 overflow-x-auto',
                darkCodeBlocks ? 'text-gray-100' : 'text-gray-900'
              )}
            >
              <code className={`language-${language}`} data-testid="code-content">{code}</code>
            </pre>
          </div>
        </div>
      );
    },
    [darkCodeBlocks, copyCode, copiedCode]
  );

  // Render table of contents
  const renderToc = () => {
    if (!showToc || toc.length === 0) return null;

    return (
      <nav className="mb-6 p-4 bg-bg-secondary rounded-lg border border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Table of Contents
        </h3>
        <ul className="space-y-1">
          {toc.map((entry, index) => (
            <li
              key={index}
              style={{ paddingLeft: `${(entry.level - 1) * 12}px` }}
            >
              <a
                href={`#${entry.id}`}
                className="text-sm text-accent-teal hover:underline"
              >
                {entry.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  };

  // Render mode toggle
  const renderModeToggle = () => {
    if (!showModeToggle || !compareContent) return null;

    const modes: { value: ViewMode; icon: React.ElementType; label: string }[] =
      [
        { value: 'view', icon: EyeIcon, label: 'View' },
        { value: 'diff', icon: DocumentTextIcon, label: 'Diff' },
        { value: 'side-by-side', icon: DocumentDuplicateIcon, label: 'Side by Side' },
      ];

    return (
      <div className="flex items-center gap-1 mb-4">
        {modes.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => handleModeChange(value)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              mode === value
                ? 'bg-accent-teal text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    );
  };

  // Render markdown content
  const renderMarkdown = (text: string, key?: string) => (
    <ReactMarkdown
      key={key}
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children }) {
          return <>{children}</>;
        },
        code({ className: codeClassName, children, ...props }) {
          // Check if this is a code block (has language class) vs inline code
          const match = /language-(\w+)/.exec(codeClassName || '');
          const isCodeBlock = match !== null;

          if (!isCodeBlock) {
            return (
              <code
                className="px-1.5 py-0.5 bg-bg-tertiary rounded text-accent-purple font-mono text-sm"
                {...props}
              >
                {children}
              </code>
            );
          }

          const language = match[1];
          const code = String(children).replace(/\n$/, '');
          return <CodeBlock language={language} code={code} />;
        },
        h1({ children, ...props }) {
          const id = generateHeadingId(String(children));
          return (
            <h1
              id={id}
              className="text-2xl font-bold text-text-primary mt-6 mb-4"
              {...props}
            >
              {children}
            </h1>
          );
        },
        h2({ children, ...props }) {
          const id = generateHeadingId(String(children));
          return (
            <h2
              id={id}
              className="text-xl font-bold text-text-primary mt-5 mb-3"
              {...props}
            >
              {children}
            </h2>
          );
        },
        h3({ children, ...props }) {
          const id = generateHeadingId(String(children));
          return (
            <h3
              id={id}
              className="text-lg font-semibold text-text-primary mt-4 mb-2"
              {...props}
            >
              {children}
            </h3>
          );
        },
        p({ children, ...props }) {
          return (
            <p className="text-text-secondary mb-4 leading-relaxed" {...props}>
              {children}
            </p>
          );
        },
        ul({ children, ...props }) {
          return (
            <ul
              className="list-disc list-inside text-text-secondary mb-4 space-y-1"
              {...props}
            >
              {children}
            </ul>
          );
        },
        ol({ children, ...props }) {
          return (
            <ol
              className="list-decimal list-inside text-text-secondary mb-4 space-y-1"
              {...props}
            >
              {children}
            </ol>
          );
        },
        li({ children, ...props }) {
          return (
            <li className="text-text-secondary" {...props}>
              {children}
            </li>
          );
        },
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="border-l-4 border-accent-teal pl-4 py-2 my-4 bg-bg-secondary rounded-r"
              {...props}
            >
              {children}
            </blockquote>
          );
        },
        a({ children, href, ...props }) {
          return (
            <a
              href={href}
              className="text-accent-teal hover:underline"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              {...props}
            >
              {children}
            </a>
          );
        },
        table({ children, ...props }) {
          return (
            <div className="overflow-x-auto mb-4">
              <table
                className="min-w-full border border-border-primary rounded-lg"
                {...props}
              >
                {children}
              </table>
            </div>
          );
        },
        th({ children, ...props }) {
          return (
            <th
              className="px-4 py-2 bg-bg-secondary text-text-primary font-semibold text-left border-b border-border-primary"
              {...props}
            >
              {children}
            </th>
          );
        },
        td({ children, ...props }) {
          return (
            <td
              className="px-4 py-2 text-text-secondary border-b border-border-secondary"
              {...props}
            >
              {children}
            </td>
          );
        },
        hr() {
          return <hr className="my-6 border-border-primary" />;
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );

  // Render diff view
  const renderDiffView = () => {
    if (!compareContent) return renderMarkdown(content);

    // Simple line-based diff visualization
    const oldLines = content.split('\n');
    const newLines = compareContent.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);

    return (
      <div className="font-mono text-sm">
        {Array.from({ length: maxLines }).map((_, i) => {
          const oldLine = oldLines[i];
          const newLine = newLines[i];
          const isDiff = oldLine !== newLine;

          if (isDiff) {
            return (
              <div key={i}>
                {oldLine !== undefined && (
                  <div className="bg-red-900/30 text-red-300 px-2 py-0.5">
                    <span className="text-red-500 mr-2">-</span>
                    {oldLine}
                  </div>
                )}
                {newLine !== undefined && (
                  <div className="bg-green-900/30 text-green-300 px-2 py-0.5">
                    <span className="text-green-500 mr-2">+</span>
                    {newLine}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={i} className="px-2 py-0.5 text-text-secondary">
              <span className="mr-2">&nbsp;</span>
              {oldLine}
            </div>
          );
        })}
      </div>
    );
  };

  // Render side-by-side view
  const renderSideBySideView = () => {
    if (!compareContent) return renderMarkdown(content);

    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-text-muted mb-2 px-2">
            {sideBySideLabels.left}
          </div>
          <div className="border border-border-primary rounded-lg p-4 bg-bg-secondary min-h-[200px]">
            {renderMarkdown(content, 'left')}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-text-muted mb-2 px-2">
            {sideBySideLabels.right}
          </div>
          <div className="border border-border-primary rounded-lg p-4 bg-bg-secondary min-h-[200px]">
            {renderMarkdown(compareContent, 'right')}
          </div>
        </div>
      </div>
    );
  };

  // Render content based on mode
  const renderContent = () => {
    switch (mode) {
      case 'diff':
        return renderDiffView();
      case 'side-by-side':
        return renderSideBySideView();
      default:
        return renderMarkdown(content);
    }
  };

  return (
    <div className={clsx('markdown-renderer', className)}>
      {renderModeToggle()}
      {mode === 'view' && renderToc()}
      <div ref={contentRef} className="prose prose-invert max-w-none">
        {renderContent()}
      </div>
    </div>
  );
}

// Helper to generate heading IDs
function generateHeadingId(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-|-$/g, '');
}
