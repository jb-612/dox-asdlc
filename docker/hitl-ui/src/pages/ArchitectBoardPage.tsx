/**
 * ArchitectBoardPage - Main page for Architect Board Canvas
 * P10-F01 Architect Board Canvas - Phase 4 (T17)
 *
 * Layout:
 * - Session Bar: Canvas name input
 * - 3-panel layout: ToolsPanel | ArchitectCanvas | OutputPanel
 * - ActionBar at bottom
 *
 * Keyboard shortcuts:
 * - Ctrl+Shift+E (Cmd on Mac): Export to SVG
 * - Ctrl+[: Toggle tools panel
 * - Ctrl+]: Toggle output panel
 */

import { useCallback, useEffect } from 'react';
import { PaintBrushIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useArchitectStore } from '../stores/architectStore';
import {
  ArchitectCanvas,
  ToolsPanel,
  OutputPanel,
  ActionBar,
} from '../components/architect';

export interface ArchitectBoardPageProps {
  /** Custom class name */
  className?: string;
}

/**
 * ArchitectBoardPage - Assembles the full Architect Board experience
 * Export as default for React.lazy() compatibility
 */
export default function ArchitectBoardPage({ className }: ArchitectBoardPageProps) {
  // Store subscriptions
  const canvasName = useArchitectStore((state) => state.canvasName);
  const setCanvasName = useArchitectStore((state) => state.setCanvasName);
  const performExport = useArchitectStore((state) => state.performExport);
  const toggleToolsPanel = useArchitectStore((state) => state.toggleToolsPanel);
  const toggleOutputPanel = useArchitectStore((state) => state.toggleOutputPanel);

  // Handle canvas name change
  const handleCanvasNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCanvasName(e.target.value);
    },
    [setCanvasName]
  );

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
      const hasModifier = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+E or Cmd+Shift+E: Export to SVG
      if (hasModifier && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        performExport();
        return;
      }

      // Ctrl+[ : Toggle tools panel
      if (hasModifier && e.key === '[') {
        e.preventDefault();
        toggleToolsPanel();
        return;
      }

      // Ctrl+] : Toggle output panel
      if (hasModifier && e.key === ']') {
        e.preventDefault();
        toggleOutputPanel();
        return;
      }
    },
    [performExport, toggleToolsPanel, toggleOutputPanel]
  );

  // Set up keyboard shortcuts
  useEffect(() => {
    const pageElement = document.querySelector('[data-testid="architect-board-page"]');
    if (pageElement) {
      pageElement.addEventListener('keydown', handleKeyDown as EventListener);
    }
    return () => {
      if (pageElement) {
        pageElement.removeEventListener('keydown', handleKeyDown as EventListener);
      }
    };
  }, [handleKeyDown]);

  return (
    <div
      className={clsx('absolute inset-0 top-16 flex flex-col bg-bg-primary', className)}
      data-testid="architect-board-page"
      role="main"
      tabIndex={0}
    >
      {/* Session Bar */}
      <div
        className="h-12 flex items-center px-4 bg-bg-secondary border-b border-border-primary"
        data-testid="session-bar"
      >
        <div className="flex items-center gap-3">
          <PaintBrushIcon className="h-5 w-5 text-accent-blue" />
          <h1 className="text-sm font-semibold text-text-primary">Architect Board</h1>
        </div>
        <div className="ml-4 flex-1 max-w-md">
          <input
            type="text"
            value={canvasName}
            onChange={handleCanvasNameChange}
            className={clsx(
              'w-full px-3 py-1.5 text-sm',
              'bg-bg-primary border border-border-primary rounded',
              'text-text-primary placeholder-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent'
            )}
            placeholder="Canvas name..."
            aria-label="Canvas name"
          />
        </div>
        <div className="ml-auto text-xs text-text-muted">
          <span>Ctrl+Shift+E: Export</span>
          <span className="mx-2">|</span>
          <span>Ctrl+[/]: Toggle panels</span>
        </div>
      </div>

      {/* 3-panel layout area - min-h-0 prevents flexbox overflow */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <ToolsPanel />
        <ArchitectCanvas />
        <OutputPanel />
      </div>

      {/* Action Bar */}
      <ActionBar />
    </div>
  );
}
