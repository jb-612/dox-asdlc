/**
 * PRDPreviewPanel - Display generated PRD draft with collapsible sections (P05-F11 T13)
 *
 * Features:
 * - Render PRD document with collapsible sections
 * - Section headers with expand/collapse
 * - Markdown content rendering
 * - Download button (markdown format)
 * - Empty state before PRD is generated
 * - Print-friendly styling
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import MarkdownRenderer from '../../common/MarkdownRenderer';
import Badge from '../../common/Badge';
import type { PRDDocument, PRDStatus } from '../../../types/ideation';

export interface PRDPreviewPanelProps {
  /** The PRD document to display, or null for empty state */
  prdDocument: PRDDocument | null;
  /** Custom class name */
  className?: string;
  /** Show download button */
  showDownload?: boolean;
  /** Show print button */
  showPrint?: boolean;
  /** Default expanded state for sections */
  defaultExpanded?: boolean;
}

const statusVariants: Record<PRDStatus, 'warning' | 'success' | 'default'> = {
  draft: 'default',
  pending_review: 'warning',
  approved: 'success',
};

const statusLabels: Record<PRDStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
};

export default function PRDPreviewPanel({
  prdDocument,
  className,
  showDownload = true,
  showPrint = true,
  defaultExpanded = true,
}: PRDPreviewPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => {
      if (!prdDocument || !defaultExpanded) return new Set();
      return new Set(prdDocument.sections.map((s) => s.id));
    }
  );

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!prdDocument) return;
    setExpandedSections(new Set(prdDocument.sections.map((s) => s.id)));
  }, [prdDocument]);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const generateMarkdown = useCallback((): string => {
    if (!prdDocument) return '';

    let md = `# ${prdDocument.title}\n\n`;
    md += `**Version:** ${prdDocument.version}\n`;
    md += `**Status:** ${statusLabels[prdDocument.status]}\n`;
    md += `**Created:** ${new Date(prdDocument.createdAt).toLocaleDateString()}\n\n`;
    md += `---\n\n`;

    const sortedSections = [...prdDocument.sections].sort((a, b) => a.order - b.order);
    for (const section of sortedSections) {
      md += `## ${section.heading}\n\n`;
      md += `${section.content}\n\n`;
    }

    return md;
  }, [prdDocument]);

  const handleDownload = useCallback(() => {
    if (!prdDocument) return;

    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${prdDocument.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();

    URL.revokeObjectURL(url);
  }, [prdDocument, generateMarkdown]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const sortedSections = useMemo(() => {
    if (!prdDocument) return [];
    return [...prdDocument.sections].sort((a, b) => a.order - b.order);
  }, [prdDocument]);

  // Empty state
  if (!prdDocument) {
    return (
      <div
        data-testid="empty-state"
        className={clsx(
          'flex flex-col items-center justify-center p-8 text-center',
          'bg-bg-secondary rounded-lg border border-border-secondary',
          className
        )}
      >
        <DocumentTextIcon
          data-testid="empty-state-icon"
          className="h-16 w-16 text-text-muted mb-4"
        />
        <h3 className="text-lg font-medium text-text-secondary mb-2">
          No PRD Generated Yet
        </h3>
        <p className="text-sm text-text-muted max-w-sm">
          Complete the ideation process to generate a PRD document.
          The PRD will appear here once your maturity score reaches 80%.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="prd-preview-panel"
      className={clsx(
        'bg-bg-secondary rounded-lg border border-border-primary',
        'print:bg-white print:border-none print:shadow-none',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border-secondary">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            {prdDocument.title}
          </h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
            <span>v{prdDocument.version}</span>
            <span data-testid="status-badge">
              <Badge
                variant={statusVariants[prdDocument.status]}
                size="sm"
              >
                {statusLabels[prdDocument.status]}
              </Badge>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 print:hidden">
          <button
            data-testid="expand-all-button"
            onClick={expandAll}
            className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-primary transition-colors"
            title="Expand all sections"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </button>
          <button
            data-testid="collapse-all-button"
            onClick={collapseAll}
            className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-primary transition-colors"
            title="Collapse all sections"
          >
            <ChevronUpIcon className="h-4 w-4" />
          </button>
          {showDownload && (
            <button
              data-testid="download-button"
              onClick={handleDownload}
              aria-label="Download PRD as markdown"
              className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-primary transition-colors"
              title="Download as Markdown"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
            </button>
          )}
          {showPrint && (
            <button
              data-testid="print-button"
              onClick={handlePrint}
              aria-label="Print PRD"
              className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-primary transition-colors"
              title="Print"
            >
              <PrinterIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="p-4 space-y-4">
        {sortedSections.map((section) => {
          const isExpanded = expandedSections.has(section.id);

          return (
            <div
              key={section.id}
              data-testid={`section-${section.id}`}
              role="region"
              aria-labelledby={`heading-${section.id}`}
              className="border border-border-secondary rounded-lg overflow-hidden"
            >
              {/* Section Header */}
              <button
                data-testid={`toggle-section-${section.id}`}
                onClick={() => toggleSection(section.id)}
                aria-expanded={isExpanded}
                aria-controls={`content-${section.id}`}
                className="w-full flex items-center justify-between p-3 bg-bg-tertiary hover:bg-bg-primary transition-colors"
              >
                <h3
                  id={`heading-${section.id}`}
                  className="text-base font-medium text-text-primary"
                >
                  {section.heading}
                </h3>
                <span data-testid={`chevron-${section.id}`}>
                  {isExpanded ? (
                    <ChevronUpIcon className="h-5 w-5 text-text-secondary" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-text-secondary" />
                  )}
                </span>
              </button>

              {/* Section Content */}
              <div
                id={`content-${section.id}`}
                data-testid={`section-content-${section.id}`}
                className={clsx(
                  'p-4 bg-bg-secondary',
                  !isExpanded && 'hidden'
                )}
              >
                <MarkdownRenderer content={section.content} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
