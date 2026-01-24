/**
 * DocViewer - Document viewer with TOC and inline mermaid support
 *
 * Displays markdown documents with a collapsible table of contents,
 * syntax highlighting, and inline mermaid diagram rendering.
 */

import { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  CheckIcon,
  CalendarIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import type { DocumentContent } from '../../api/types';
import MermaidDiagram from './MermaidDiagram';
import ErrorBoundary from '../common/ErrorBoundary';

export interface DocViewerProps {
  /** Document to display */
  document: DocumentContent;
  /** Show table of contents sidebar */
  showToc?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when TOC section is clicked */
  onSectionClick?: (sectionId: string) => void;
}

/** Table of contents entry */
interface TocEntry {
  id: string;
  text: string;
  level: number;
}

/**
 * Extract table of contents from markdown content
 */
function extractToc(content: string): TocEntry[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const entries: TocEntry[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = generateHeadingId(text);
    entries.push({ id, text, level });
  }

  return entries;
}

/**
 * Generate heading ID from text
 */
function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Check if a string is mermaid content
 */
function isMermaidCode(language: string | undefined): boolean {
  return language === 'mermaid';
}

/**
 * DocViewer component
 *
 * Full document viewer with table of contents, metadata display,
 * and inline mermaid diagram rendering.
 */
export default function DocViewer({
  document,
  showToc = true,
  className,
  onSectionClick,
}: DocViewerProps) {
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Extract table of contents (always call, even if document is null)
  const toc = useMemo(
    () => (document?.content ? extractToc(document.content) : []),
    [document?.content]
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

  // Handle TOC link click
  const handleTocClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
      e.preventDefault();
      const element = window.document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      onSectionClick?.(sectionId);
    },
    [onSectionClick]
  );

  // Custom code block renderer
  const CodeBlock = useCallback(
    ({ language, code }: { language: string; code: string }) => {
      // Render mermaid diagrams inline
      if (isMermaidCode(language)) {
        return (
          <div className="my-4" data-testid="inline-mermaid">
            <ErrorBoundary
              fallback={
                <div className="text-red-500 p-4 bg-bg-secondary rounded-lg" data-testid="mermaid-boundary-error">
                  Failed to render diagram
                </div>
              }
            >
              <MermaidDiagram content={code} className="bg-bg-secondary rounded-lg p-4" />
            </ErrorBoundary>
          </div>
        );
      }

      // Regular code block
      return (
        <div className="relative group my-4">
          <div className="rounded-lg overflow-hidden bg-gray-900">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <span className="text-xs font-mono text-gray-400">{language}</span>
              <button
                onClick={() => copyCode(code)}
                className="p-1 rounded transition-colors hover:bg-gray-700 text-gray-400"
                aria-label="Copy code"
              >
                {copiedCode === code ? (
                  <CheckIcon className="h-4 w-4 text-status-success" />
                ) : (
                  <ClipboardIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-gray-100">
              <code className={`language-${language}`}>{code}</code>
            </pre>
          </div>
        </div>
      );
    },
    [copyCode, copiedCode]
  );

  // Handle null/undefined document - AFTER hooks
  if (!document) {
    return (
      <div className={clsx('flex items-center justify-center py-12', className)} data-testid="doc-viewer-loading">
        <div className="animate-pulse space-y-4 w-full max-w-2xl">
          <div className="h-8 bg-bg-secondary rounded w-1/3" />
          <div className="h-4 bg-bg-secondary rounded w-full" />
          <div className="h-4 bg-bg-secondary rounded w-5/6" />
          <div className="h-4 bg-bg-secondary rounded w-4/6" />
        </div>
      </div>
    );
  }

  // Handle empty content - AFTER hooks
  if (!document.content || document.content.trim() === '') {
    return (
      <div className={clsx('flex items-center justify-center py-12', className)} data-testid="doc-empty">
        <div className="text-center text-text-muted">
          <p>No content available</p>
        </div>
      </div>
    );
  }

  // Render table of contents
  const renderToc = () => {
    if (!showToc || toc.length === 0) return null;

    return (
      <nav
        className="mb-6 bg-bg-secondary rounded-lg border border-border-primary"
        role="navigation"
        aria-label="Table of Contents"
        data-testid="toc"
      >
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-text-primary"
          onClick={() => setTocCollapsed(!tocCollapsed)}
          aria-expanded={!tocCollapsed}
          data-testid="toc-toggle"
        >
          <span>Table of Contents</span>
          {tocCollapsed ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronUpIcon className="h-4 w-4" />
          )}
        </button>
        <div
          className={clsx(
            'overflow-hidden transition-all duration-200',
            tocCollapsed ? 'max-h-0' : 'max-h-[500px]'
          )}
          aria-hidden={tocCollapsed}
          data-testid="toc-content"
        >
          <ul className="px-4 pb-4 space-y-1">
            {toc.map((entry, index) => (
              <li
                key={index}
                style={{ paddingLeft: `${(entry.level - 1) * 12}px` }}
              >
                <a
                  href={`#${entry.id}`}
                  className="text-sm text-accent-blue hover:underline block py-0.5"
                  onClick={(e) => handleTocClick(e, entry.id)}
                >
                  {entry.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    );
  };

  return (
    <div className={clsx('doc-viewer', className)} data-testid="doc-viewer">
      {/* Document header */}
      <header className="mb-6 pb-4 border-b border-border-primary">
        <h1 className="text-2xl font-bold text-text-primary mb-2" data-testid="doc-title">
          {document.meta.title}
        </h1>
        <div
          className="flex flex-wrap items-center gap-4 text-sm text-text-muted"
          data-testid="doc-meta"
        >
          <span className="flex items-center gap-1.5">
            <FolderIcon className="h-4 w-4" />
            <span className="capitalize">{document.meta.category}</span>
          </span>
          {document.meta.lastModified && (
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              {document.meta.lastModified}
            </span>
          )}
        </div>
        {document.meta.description && (
          <p className="mt-2 text-text-secondary">{document.meta.description}</p>
        )}
      </header>

      {/* Table of contents */}
      {renderToc()}

      {/* Document content */}
      <article className="prose prose-invert max-w-none" data-testid="doc-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre({ children }) {
              return <>{children}</>;
            },
            code({ className: codeClassName, children, ...props }) {
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
              const text = String(children);
              const id = generateHeadingId(text);
              return (
                <h1
                  id={id}
                  className="text-2xl font-bold text-text-primary mt-8 mb-4 scroll-mt-4"
                  {...props}
                >
                  {children}
                </h1>
              );
            },
            h2({ children, ...props }) {
              const text = String(children);
              const id = generateHeadingId(text);
              return (
                <h2
                  id={id}
                  className="text-xl font-bold text-text-primary mt-6 mb-3 scroll-mt-4"
                  {...props}
                >
                  {children}
                </h2>
              );
            },
            h3({ children, ...props }) {
              const text = String(children);
              const id = generateHeadingId(text);
              return (
                <h3
                  id={id}
                  className="text-lg font-semibold text-text-primary mt-5 mb-2 scroll-mt-4"
                  {...props}
                >
                  {children}
                </h3>
              );
            },
            h4({ children, ...props }) {
              const text = String(children);
              const id = generateHeadingId(text);
              return (
                <h4
                  id={id}
                  className="text-base font-semibold text-text-primary mt-4 mb-2 scroll-mt-4"
                  {...props}
                >
                  {children}
                </h4>
              );
            },
            h5({ children, ...props }) {
              const text = String(children);
              const id = generateHeadingId(text);
              return (
                <h5
                  id={id}
                  className="text-sm font-semibold text-text-primary mt-3 mb-1 scroll-mt-4"
                  {...props}
                >
                  {children}
                </h5>
              );
            },
            h6({ children, ...props }) {
              const text = String(children);
              const id = generateHeadingId(text);
              return (
                <h6
                  id={id}
                  className="text-sm font-medium text-text-secondary mt-3 mb-1 scroll-mt-4"
                  {...props}
                >
                  {children}
                </h6>
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
                  className="border-l-4 border-accent-blue pl-4 py-2 my-4 bg-bg-secondary rounded-r text-text-secondary italic"
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
                  className="text-accent-blue hover:underline"
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
            strong({ children, ...props }) {
              return (
                <strong className="font-semibold text-text-primary" {...props}>
                  {children}
                </strong>
              );
            },
            em({ children, ...props }) {
              return (
                <em className="italic" {...props}>
                  {children}
                </em>
              );
            },
          }}
        >
          {document.content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
