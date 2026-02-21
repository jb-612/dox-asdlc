/**
 * ExportPreview - SVG export preview with copy and download actions
 * P10-F01 Architect Board Canvas - Phase 3 (T11)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import DOMPurify from 'dompurify';
import { useArchitectStore } from '../../stores/architectStore';

export interface ExportPreviewProps {
  /** Custom class name */
  className?: string;
}

/**
 * ExportPreview displays the exported SVG with controls for copying and downloading.
 * Shows empty state when no export is available and loading state during export.
 */
export default function ExportPreview({ className }: ExportPreviewProps) {
  const exportedSvg = useArchitectStore((state) => state.exportedSvg);
  const isExporting = useArchitectStore((state) => state.isExporting);
  const performExport = useArchitectStore((state) => state.performExport);

  const [copySuccess, setCopySuccess] = useState(false);

  // Clear copy success after delay
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  // Handle export action
  const handleExport = useCallback(() => {
    performExport();
  }, [performExport]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!exportedSvg) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(exportedSvg);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = exportedSvg;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
    } catch {
      console.warn('Failed to copy SVG to clipboard');
    }
  }, [exportedSvg]);

  // Handle download SVG
  const handleDownload = useCallback(() => {
    if (!exportedSvg) return;

    const blob = new Blob([exportedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'architecture-diagram.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exportedSvg]);

  return (
    <div
      className={clsx('flex flex-col h-full', className)}
      data-testid="export-preview"
    >
      {/* Action buttons */}
      <div className="flex items-center gap-2 p-2 border-b border-border-primary">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className={clsx(
            'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors',
            'bg-accent-blue text-white hover:bg-accent-blue/90',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label={exportedSvg ? 'Re-export SVG' : 'Export to SVG'}
          data-testid="export-button"
        >
          {isExporting ? (
            <>
              <div
                className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                data-testid="export-spinner"
              />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <ArrowPathIcon className="h-3 w-3" />
              <span>{exportedSvg ? 'Re-export' : 'Export'}</span>
            </>
          )}
        </button>

        {exportedSvg && (
          <>
            <button
              onClick={handleCopy}
              className={clsx(
                'p-1.5 rounded transition-colors',
                copySuccess
                  ? 'text-status-success bg-status-success/10'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
              )}
              aria-label="Copy SVG to clipboard"
              title={copySuccess ? 'Copied!' : 'Copy to clipboard'}
              data-testid="copy-button"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
              aria-label="Download SVG"
              title="Download SVG"
              data-testid="download-button"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-2">
        {exportedSvg ? (
          <div
            className="max-w-full h-auto"
            role="img"
            aria-label="Exported SVG preview"
            data-testid="svg-preview"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(exportedSvg, { USE_PROFILES: { svg: true } }) }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-text-muted">
            <p className="text-sm">No export yet</p>
            <p className="text-xs mt-1">Click Export to generate SVG</p>
          </div>
        )}
      </div>
    </div>
  );
}
