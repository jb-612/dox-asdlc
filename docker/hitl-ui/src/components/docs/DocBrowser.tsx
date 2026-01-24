/**
 * DocBrowser - Sidebar document browser with category grouping
 *
 * Displays documents in collapsible categories with selection highlighting
 * and localStorage persistence for expansion state.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import type { DocumentMeta, DocumentCategory } from '../../api/types';

export interface DocBrowserProps {
  /** Documents to display */
  documents: DocumentMeta[];
  /** Currently selected document ID */
  selectedId?: string;
  /** Callback when document is selected */
  onSelect: (docId: string) => void;
  /** Custom class name */
  className?: string;
}

/** Storage key for collapsed categories */
const STORAGE_KEY = 'doc-browser-collapsed';

/** Category display labels */
const categoryLabels: Record<DocumentCategory, string> = {
  system: 'System',
  feature: 'Feature',
  architecture: 'Architecture',
  workflow: 'Workflow',
};

/** Category ordering for display */
const categoryOrder: DocumentCategory[] = ['system', 'architecture', 'feature', 'workflow'];

/**
 * Load collapsed categories from localStorage
 */
function loadCollapsedState(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return new Set(parsed);
    }
  } catch {
    // Ignore localStorage errors
  }
  return new Set();
}

/**
 * Save collapsed categories to localStorage
 */
function saveCollapsedState(collapsed: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * DocBrowser component
 *
 * Sidebar navigation for documents with collapsible category sections.
 */
export default function DocBrowser({
  documents,
  selectedId,
  onSelect,
  className,
}: DocBrowserProps) {
  // Track collapsed categories
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsedState());

  // Group documents by category
  const groupedDocuments = useMemo(() => {
    const groups: Partial<Record<DocumentCategory, DocumentMeta[]>> = {};

    for (const doc of documents) {
      if (!groups[doc.category]) {
        groups[doc.category] = [];
      }
      groups[doc.category]!.push(doc);
    }

    // Return sorted by category order
    return categoryOrder
      .filter((cat) => groups[cat] && groups[cat]!.length > 0)
      .map((cat) => ({
        category: cat,
        label: categoryLabels[cat],
        documents: groups[cat]!,
      }));
  }, [documents]);

  // Save collapsed state when it changes
  useEffect(() => {
    saveCollapsedState(collapsed);
  }, [collapsed]);

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Handle document click
  const handleDocClick = useCallback(
    (docId: string) => {
      onSelect(docId);
    },
    [onSelect]
  );

  // Handle document keyboard
  const handleDocKeyDown = useCallback(
    (e: React.KeyboardEvent, docId: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(docId);
      }
    },
    [onSelect]
  );

  // Handle category header keyboard
  const handleCategoryKeyDown = useCallback(
    (e: React.KeyboardEvent, category: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCategory(category);
      }
    },
    [toggleCategory]
  );

  // Empty state
  if (documents.length === 0) {
    return (
      <div className={clsx('py-8 text-center text-text-muted', className)} data-testid="doc-browser">
        <svg
          className="h-12 w-12 mx-auto mb-3 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No documents available</p>
      </div>
    );
  }

  return (
    <nav className={clsx('space-y-1', className)} data-testid="doc-browser">
      {groupedDocuments.map(({ category, label, documents: categoryDocs }) => {
        const isCollapsed = collapsed.has(category);

        return (
          <div key={category} data-testid={`category-${category}`}>
            {/* Category header */}
            <button
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2',
                'text-sm font-semibold text-text-secondary uppercase tracking-wide',
                'hover:bg-bg-secondary rounded-lg transition-colors'
              )}
              onClick={() => toggleCategory(category)}
              onKeyDown={(e) => handleCategoryKeyDown(e, category)}
              aria-expanded={!isCollapsed}
              data-testid={`category-header-${category}`}
            >
              <span>{label}</span>
              <svg
                className={clsx(
                  'h-4 w-4 transform transition-transform',
                  isCollapsed ? '-rotate-90' : 'rotate-0'
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                data-testid="expand-icon"
              >
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Category content */}
            <div
              className={clsx(
                'overflow-hidden transition-all duration-200',
                isCollapsed ? 'max-h-0' : 'max-h-[1000px]'
              )}
              aria-hidden={isCollapsed}
              data-testid={`category-content-${category}`}
            >
              <div className="pl-2 space-y-0.5">
                {categoryDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={clsx(
                      'group px-3 py-2 rounded-lg cursor-pointer transition-colors',
                      'hover:bg-bg-secondary',
                      selectedId === doc.id
                        ? 'bg-accent-blue/10 border-l-2 border-accent-blue selected'
                        : 'border-l-2 border-transparent'
                    )}
                    onClick={() => handleDocClick(doc.id)}
                    onKeyDown={(e) => handleDocKeyDown(e, doc.id)}
                    tabIndex={0}
                    role="button"
                    data-testid={`doc-${doc.id}`}
                    style={{ visibility: isCollapsed ? 'hidden' : 'visible' }}
                  >
                    <div className="font-medium text-text-primary group-hover:text-accent-blue transition-colors text-sm">
                      {doc.title}
                    </div>
                    <div className="text-xs text-text-muted line-clamp-1 mt-0.5">
                      {doc.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
