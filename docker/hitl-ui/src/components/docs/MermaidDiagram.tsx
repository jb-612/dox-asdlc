/**
 * MermaidDiagram - Renders Mermaid syntax to SVG
 *
 * Provides loading state, error handling, and accessibility
 * for rendering Mermaid diagrams in the documentation SPA.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import clsx from 'clsx';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useUIStore } from '@/stores/uiStore';

export interface MermaidDiagramProps {
  /** Mermaid syntax content */
  content: string;
  /** Custom class name */
  className?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Callback when render completes */
  onRender?: (svg: string) => void;
  /** Callback when render fails */
  onError?: (error: Error) => void;
}

/** Unique ID counter for mermaid elements */
let diagramIdCounter = 0;

/**
 * MermaidDiagram component
 *
 * Renders Mermaid diagram syntax to an inline SVG with loading
 * and error states.
 */
function MermaidDiagram({
  content,
  className,
  ariaLabel = 'Mermaid diagram',
  onRender,
  onError,
}: MermaidDiagramProps) {
  const theme = useUIStore((state) => state.theme);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);
  const themeRef = useRef(theme);
  const idRef = useRef<string>(`mermaid-${++diagramIdCounter}`);

  // Render mermaid diagram
  const renderDiagram = useCallback(async () => {
    const trimmedContent = content.trim();

    // Handle empty content
    if (!trimmedContent) {
      setLoading(false);
      setSvg(null);
      setError(null);
      return;
    }

    // Skip if content and theme haven't changed
    if (contentRef.current === content && themeRef.current === theme && svg) {
      return;
    }
    contentRef.current = content;
    themeRef.current = theme;

    setLoading(true);
    setError(null);

    try {
      // Generate unique ID for this render
      const elementId = `${idRef.current}-${Date.now()}`;
      const result = await mermaid.render(elementId, trimmedContent);
      setSvg(result.svg);
      onRender?.(result.svg);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setSvg(null);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [content, svg, onRender, onError, theme]);

  // Render on mount and content change
  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  // Empty content state
  if (!content.trim()) {
    return (
      <div
        className={clsx('flex items-center justify-center p-8 text-text-muted', className)}
        data-testid="mermaid-empty"
      >
        <p>No diagram content</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={clsx('relative', className)}
      data-testid="mermaid-diagram"
    >
      {/* Loading skeleton */}
      {loading && (
        <div
          className="animate-pulse bg-bg-secondary rounded-lg p-8 flex items-center justify-center min-h-[200px]"
          data-testid="mermaid-loading"
        >
          <div className="space-y-3 w-full max-w-md">
            <div className="h-4 bg-bg-tertiary rounded w-3/4 mx-auto" />
            <div className="h-4 bg-bg-tertiary rounded w-1/2 mx-auto" />
            <div className="h-4 bg-bg-tertiary rounded w-2/3 mx-auto" />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          className="bg-status-error/10 border border-status-error rounded-lg p-4"
          data-testid="mermaid-error"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-status-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-status-error">Failed to render diagram</p>
              <p className="text-sm text-text-secondary mt-1">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Rendered SVG */}
      {svg && !loading && !error && (
        <div
          role="img"
          aria-label={ariaLabel}
          className={clsx(
            'overflow-auto',
            // In dark mode, invert light backgrounds to dark while preserving colors
            theme === 'dark' && 'diagram-dark-mode'
          )}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true }, ADD_TAGS: ['foreignObject'] }) }}
        />
      )}
    </div>
  );
}

export default memo(MermaidDiagram);
