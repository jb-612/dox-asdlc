/**
 * FormatTabContent - Format-specific content rendering for Output Panel
 * P10-F02 Diagram Translation - Phase 4 (T14)
 *
 * Renders content based on the export format:
 * - SVG: Inline rendering with sanitization
 * - PNG: Base64 image display
 * - Mermaid: Syntax highlighted code block
 * - Draw.io: Syntax highlighted XML code block
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import DOMPurify from 'dompurify';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-yaml';
import type { ExportFormat } from '../../api/types/architect';

export interface FormatTabContentProps {
  /** The content to display (base64 for PNG, raw string for others) */
  content: string | null;
  /** The format of the content */
  format: ExportFormat;
  /** Whether translation is in progress */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Callback when copy button is clicked */
  onCopy?: () => void;
  /** Callback when download button is clicked */
  onDownload?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Get MIME type for a format
 */
function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'mmd':
      return 'text/plain';
    case 'drawio':
      return 'application/xml';
    default:
      return 'text/plain';
  }
}

/**
 * Get file extension for a format
 */
function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'svg':
      return '.svg';
    case 'png':
      return '.png';
    case 'mmd':
      return '.mmd';
    case 'drawio':
      return '.drawio.xml';
    default:
      return '.txt';
  }
}

/**
 * FormatTabContent displays content in the appropriate format with copy/download actions.
 */
export default function FormatTabContent({
  content,
  format,
  loading = false,
  error = null,
  onCopy,
  onDownload,
  className,
}: FormatTabContentProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  // Clear copy success after delay
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  // Apply syntax highlighting for code formats
  useEffect(() => {
    if (codeRef.current && content && (format === 'mmd' || format === 'drawio')) {
      Prism.highlightElement(codeRef.current);
    }
  }, [content, format]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!content) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
      onCopy?.();
    } catch {
      console.warn('Failed to copy content to clipboard');
    }
  }, [content, onCopy]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (!content) return;

    let blob: Blob;
    const mimeType = getMimeType(format);

    if (format === 'png') {
      // Decode base64 to binary
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: mimeType });
    } else {
      blob = new Blob([content], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `architecture-diagram${getFileExtension(format)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onDownload?.();
  }, [content, format, onDownload]);

  // Loading state
  if (loading) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center h-full min-h-[200px] p-4', className)}
        data-testid="format-content-loading"
      >
        <div
          className="h-8 w-8 border-4 border-accent-blue border-t-transparent rounded-full animate-spin"
          data-testid="loading-spinner"
        />
        <p className="mt-4 text-sm text-text-muted">Translating diagram...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center h-full min-h-[200px] p-4', className)}
        data-testid="format-content-error"
      >
        <div className="text-center">
          <p className="text-sm text-status-error font-medium">Translation failed</p>
          <p className="mt-2 text-xs text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!content) {
    return (
      <div
        className={clsx('flex flex-col items-center justify-center h-full min-h-[200px] p-4', className)}
        data-testid="format-content-empty"
      >
        <p className="text-sm text-text-muted">
          {format === 'svg' ? 'No export yet' : 'Not translated yet'}
        </p>
        <p className="text-xs text-text-muted mt-1">
          {format === 'svg'
            ? 'Click Export to generate SVG'
            : 'Click Translate to convert your diagram'}
        </p>
      </div>
    );
  }

  // Render content based on format
  return (
    <div className={clsx('flex flex-col h-full', className)} data-testid="format-content">
      {/* Action buttons */}
      <div className="flex items-center gap-2 p-2 border-b border-border-primary">
        <button
          onClick={handleCopy}
          className={clsx(
            'p-1.5 rounded transition-colors',
            copySuccess
              ? 'text-status-success bg-status-success/10'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
          )}
          aria-label={`Copy ${format.toUpperCase()} to clipboard`}
          title={copySuccess ? 'Copied!' : 'Copy to clipboard'}
          data-testid="copy-button"
        >
          <DocumentDuplicateIcon className="h-4 w-4" />
        </button>

        <button
          onClick={handleDownload}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
          aria-label={`Download ${format.toUpperCase()}`}
          title={`Download ${getFileExtension(format)}`}
          data-testid="download-button"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-2">
        {format === 'svg' && (
          <div
            className="max-w-full h-auto"
            role="img"
            aria-label="Exported SVG preview"
            data-testid="svg-preview"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(content, { USE_PROFILES: { svg: true } }),
            }}
          />
        )}

        {format === 'png' && (
          <div className="flex justify-center" data-testid="png-preview">
            <img
              src={`data:image/png;base64,${content}`}
              alt="Translated PNG diagram"
              className="max-w-full h-auto border border-border-primary rounded"
            />
          </div>
        )}

        {format === 'mmd' && (
          <div className="bg-bg-tertiary rounded overflow-auto" data-testid="mmd-preview">
            <pre className="p-3 text-xs leading-relaxed">
              <code ref={codeRef} className="language-yaml">
                {content}
              </code>
            </pre>
          </div>
        )}

        {format === 'drawio' && (
          <div className="bg-bg-tertiary rounded overflow-auto" data-testid="drawio-preview">
            <pre className="p-3 text-xs leading-relaxed">
              <code ref={codeRef} className="language-markup">
                {content}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
