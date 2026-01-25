/**
 * DiagramThumbnail - Lazy-loading thumbnail for Mermaid diagrams
 *
 * Uses IntersectionObserver to defer rendering until the thumbnail
 * becomes visible in the viewport. Renders at a scaled-down size
 * for gallery previews.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import clsx from 'clsx';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useUIStore } from '@/stores/uiStore';

export interface DiagramThumbnailProps {
  /** Mermaid syntax content */
  content: string;
  /** Unique ID for the diagram */
  diagramId: string;
  /** Scale factor for the thumbnail (default: 0.5) */
  scale?: number;
  /** Custom class name */
  className?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Callback when render fails */
  onError?: (error: Error) => void;
}

/**
 * DiagramThumbnail component
 *
 * Lazy-loads and renders a scaled-down version of a Mermaid diagram
 * for use in gallery views. Only renders when visible in the viewport.
 */
function DiagramThumbnail({
  content,
  diagramId,
  scale = 0.5,
  className,
  ariaLabel = 'Diagram thumbnail',
  onError,
}: DiagramThumbnailProps) {
  const theme = useUIStore((state) => state.theme);
  const [isVisible, setIsVisible] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Set up IntersectionObserver
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observerRef.current?.unobserve(element);
        }
      },
      { rootMargin: '50px', threshold: 0 }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Render mermaid when visible or theme changes
  const renderDiagram = useCallback(async () => {
    if (!isVisible || !content.trim()) return;

    setLoading(true);
    setError(null);
    setSvg(null); // Clear cached SVG to force re-render with new theme

    try {
      const timestamp = Date.now();
      const elementId = `thumbnail-${diagramId}-${timestamp}`;
      const result = await mermaid.render(elementId, content.trim());
      setSvg(result.svg);
    } catch (err) {
      const renderError = err instanceof Error ? err : new Error(String(err));
      setError(renderError);
      setSvg(null);
      onError?.(renderError);
    } finally {
      setLoading(false);
    }
  }, [isVisible, content, diagramId, onError, theme]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  return (
    <div
      ref={containerRef}
      className={clsx('relative overflow-hidden', className)}
      data-testid="diagram-thumbnail"
      aria-label={ariaLabel}
    >
      {/* Placeholder - shown before intersection */}
      {!isVisible && (
        <div
          className="animate-pulse bg-bg-tertiary rounded flex items-center justify-center h-full w-full"
          data-testid="thumbnail-placeholder"
        >
          <div className="text-text-muted opacity-50">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <rect x="3" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="8.5" y="16" width="7" height="5" rx="1" />
              <line x1="6.5" y1="8" x2="6.5" y2="11" />
              <line x1="17.5" y1="8" x2="17.5" y2="11" />
              <line x1="6.5" y1="11" x2="17.5" y2="11" />
              <line x1="12" y1="11" x2="12" y2="16" />
            </svg>
          </div>
        </div>
      )}

      {/* Loading state - shown while rendering */}
      {isVisible && loading && (
        <div
          className="animate-pulse bg-bg-secondary rounded flex items-center justify-center h-full w-full"
          data-testid="thumbnail-loading"
        >
          <div className="space-y-2 w-full max-w-[80%]">
            <div className="h-2 bg-bg-tertiary rounded w-3/4 mx-auto" />
            <div className="h-2 bg-bg-tertiary rounded w-1/2 mx-auto" />
          </div>
        </div>
      )}

      {/* Error state */}
      {isVisible && error && !loading && (
        <div
          className="flex items-center justify-center h-full w-full bg-status-error/5 rounded"
          data-testid="thumbnail-error"
        >
          <ExclamationTriangleIcon className="h-6 w-6 text-status-error opacity-50" />
        </div>
      )}

      {/* Rendered SVG */}
      {isVisible && svg && !loading && !error && (
        <div
          className={clsx(
            'origin-top-left',
            // In dark mode, invert light backgrounds to dark
            theme === 'dark' && 'diagram-dark-mode'
          )}
          style={{ transform: `scale(${scale})` }}
          data-testid="thumbnail-content"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } }),
          }}
        />
      )}
    </div>
  );
}

export default memo(DiagramThumbnail);
