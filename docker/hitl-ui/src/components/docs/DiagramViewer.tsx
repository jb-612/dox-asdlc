/**
 * DiagramViewer - Full-screen diagram viewer with zoom/pan controls
 *
 * Displays a Mermaid diagram with interactive controls for navigation,
 * zoom, and export functionality (SVG, PNG, copy source).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  XMarkIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowsPointingInIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { DiagramContent } from '../../api/types';
import MermaidDiagram from './MermaidDiagram';
import { categoryColors } from './constants';

export interface DiagramViewerProps {
  /** Diagram content to display */
  diagram: DiagramContent;
  /** Custom class name */
  className?: string;
  /** Show zoom and export controls */
  showControls?: boolean;
  /** Callback when close is requested */
  onClose?: () => void;
}

/**
 * DiagramViewer component
 *
 * Provides full-width diagram viewing with zoom, pan, export, and keyboard controls.
 */
export default function DiagramViewer({
  diagram,
  className,
  showControls = false,
  onClose,
}: DiagramViewerProps) {
  const [scale, setScale] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [exportingPng, setExportingPng] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Handle escape key
  useEffect(() => {
    if (!onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Clear copy success after delay
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 10, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 10, 50));
  }, []);

  const handleZoomFit = useCallback(() => {
    setScale(100);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleZoomReset = useCallback(() => {
    setScale(100);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;

      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      setPanOffset((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Mouse leave should also stop panning
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Export: Download SVG
  const handleDownloadSvg = useCallback(() => {
    const svgElement = diagramRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${diagram.meta.id}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [diagram.meta.id]);

  // Export: Download PNG
  const handleDownloadPng = useCallback(async () => {
    const svgElement = diagramRef.current?.querySelector('svg');
    if (!svgElement) return;

    setExportingPng(true);

    try {
      // Get SVG dimensions
      const svgRect = svgElement.getBoundingClientRect();
      const scaleFactor = 2; // 2x resolution for crisp output

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = svgRect.width * scaleFactor;
      canvas.height = svgRect.height * scaleFactor;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Convert SVG to data URL
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Load image and draw to canvas
      const img = new Image();
      img.onload = () => {
        ctx.scale(scaleFactor, scaleFactor);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(svgUrl);

        // Convert canvas to PNG and download
        canvas.toBlob((blob) => {
          if (!blob) return;

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${diagram.meta.id}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setExportingPng(false);
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        setExportingPng(false);
      };
      img.src = svgUrl;
    } catch {
      setExportingPng(false);
    }
  }, [diagram.meta.id]);

  // Export: Copy source
  const handleCopySource = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(diagram.content);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = diagram.content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
    } catch {
      console.warn('Failed to copy diagram source to clipboard');
    }
  }, [diagram.content]);

  const categoryClass = categoryColors[diagram.meta.category] || categoryColors.architecture;

  return (
    <div
      className={clsx(
        'flex flex-col bg-bg-primary rounded-lg border border-border-primary',
        className
      )}
      data-testid="diagram-viewer"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border-primary">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">
              {diagram.meta.title}
            </h2>
            <span
              className={clsx(
                'px-2 py-0.5 text-xs font-medium rounded border',
                categoryClass
              )}
              data-testid="category-badge"
            >
              {diagram.meta.category}
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {diagram.meta.description}
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-secondary rounded-lg transition-colors"
            aria-label="Close viewer"
            data-testid="close-button"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Zoom and Export controls */}
      {showControls && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b border-border-primary bg-bg-secondary"
          data-testid="zoom-controls"
        >
          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
            aria-label="Zoom out"
            data-testid="zoom-out"
            disabled={scale <= 50}
          >
            <MagnifyingGlassMinusIcon className="h-5 w-5" />
          </button>

          <span
            className="text-sm text-text-secondary min-w-[50px] text-center"
            data-testid="zoom-level"
          >
            {scale}%
          </span>

          <button
            onClick={handleZoomIn}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
            aria-label="Zoom in"
            data-testid="zoom-in"
            disabled={scale >= 200}
          >
            <MagnifyingGlassPlusIcon className="h-5 w-5" />
          </button>

          <div className="w-px h-4 bg-border-primary mx-2" />

          <button
            onClick={handleZoomFit}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
            aria-label="Fit to view"
            data-testid="zoom-fit"
          >
            <ArrowsPointingInIcon className="h-5 w-5" />
          </button>

          <button
            onClick={handleZoomReset}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
            aria-label="Reset zoom"
            data-testid="zoom-reset"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>

          {/* Export controls - separated by divider */}
          <div className="w-px h-4 bg-border-primary mx-2" />

          <div className="flex items-center gap-1" data-testid="export-controls">
            <button
              onClick={handleDownloadSvg}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
              aria-label="Download SVG"
              data-testid="download-svg"
              title="Download as SVG"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>

            <button
              onClick={handleDownloadPng}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors disabled:opacity-50"
              aria-label="Download PNG"
              data-testid="download-png"
              title="Download as PNG (2x resolution)"
              disabled={exportingPng}
            >
              <PhotoIcon className="h-5 w-5" />
            </button>

            <button
              onClick={handleCopySource}
              className={clsx(
                'p-1.5 rounded transition-colors',
                copySuccess
                  ? 'text-status-success bg-status-success/10'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
              )}
              aria-label="Copy source"
              data-testid="copy-source"
              title={copySuccess ? 'Copied!' : 'Copy mermaid source'}
            >
              <DocumentDuplicateIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Diagram container */}
      <div
        ref={containerRef}
        className={clsx(
          'flex-1 overflow-hidden p-4',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        data-testid="diagram-container"
      >
        <div
          ref={diagramRef}
          className="transition-transform duration-100"
          style={{
            transform: `scale(${scale / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          <MermaidDiagram
            content={diagram.content}
            ariaLabel={`${diagram.meta.title} diagram`}
          />
        </div>
      </div>
    </div>
  );
}
