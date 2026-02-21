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

  // Post-process SVG for dark mode - override light fills
  useEffect(() => {
    if (!svg || !containerRef.current || theme !== 'dark') return;

    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    // Helper to parse rgb(r, g, b) string
    const parseRgb = (rgbStr: string): number[] | null => {
      if (!rgbStr.startsWith('rgb(')) return null;
      const values = rgbStr.slice(4, -1).split(', ').map(Number);
      return values.length === 3 ? values : null;
    };

    // Find all rect elements with light fills and make them dark
    // Use setProperty with 'important' to override Mermaid's !important styles
    const rects = svgElement.querySelectorAll('rect');
    rects.forEach((rect) => {
      const fill = getComputedStyle(rect).fill;
      const rgb = parseRgb(fill);
      if (rgb) {
        const [r, g, b] = rgb;
        // If it's a light color (average > 180), make it dark
        if ((r + g + b) / 3 > 180) {
          (rect as HTMLElement).style.setProperty('fill', '#1e1e1e', 'important');
          (rect as HTMLElement).style.setProperty('stroke', '#444', 'important');
        }
      }
    });

    // Ensure SVG text is light colored
    const texts = svgElement.querySelectorAll('text, tspan');
    texts.forEach((text) => {
      const el = text as HTMLElement;
      el.style.setProperty('fill', '#e0e0e0', 'important');
    });

    // Handle foreignObject elements (HTML content in SVG)
    const foreignObjects = svgElement.querySelectorAll('foreignObject');
    foreignObjects.forEach((fo) => {
      (fo as HTMLElement).style.setProperty('color', '#e0e0e0', 'important');
      const children = fo.querySelectorAll('div, span, p');
      children.forEach((c) => (c as HTMLElement).style.setProperty('color', '#e0e0e0', 'important'));
    });
  }, [svg, theme]);

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
            'overflow-auto [&_svg]:overflow-visible [&_svg_text]:overflow-visible [&_svg_foreignObject]:overflow-visible [&_svg_foreignObject_div]:break-words [&_svg_foreignObject_div]:overflow-wrap-anywhere',
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
