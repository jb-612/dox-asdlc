/**
 * ArchitectCanvas - Excalidraw wrapper for architecture diagrams
 * P10-F01 Architect Board Canvas - Phase 2 (T05)
 */

import { useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import clsx from 'clsx';
import { useArchitectStore } from '../../stores/architectStore';
import type { ArchitectElement, ArchitectAppState } from '../../api/types/architect';

export interface ArchitectCanvasProps {
  /** Custom class name */
  className?: string;
}

export interface ArchitectCanvasRef {
  /** Get the Excalidraw API instance */
  getAPI: () => ExcalidrawImperativeAPI | null;
}

/**
 * ArchitectCanvas wraps the Excalidraw component and connects it to the architect store.
 * Use React.lazy() for code splitting - this component is exported as default.
 */
const ArchitectCanvas = forwardRef<ArchitectCanvasRef, ArchitectCanvasProps>(
  function ArchitectCanvas({ className }, ref) {
    const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);

    // Get store actions
    const updateElements = useArchitectStore((state) => state.updateElements);
    const updateAppState = useArchitectStore((state) => state.updateAppState);

    // Expose API via ref for parent components
    useImperativeHandle(ref, () => ({
      getAPI: () => excalidrawAPIRef.current,
    }));

    // Handle Excalidraw changes
    const handleChange = useCallback(
      (elements: readonly unknown[], appState: unknown) => {
        // Update store with new elements and app state
        updateElements(elements as ArchitectElement[]);
        updateAppState(appState as Partial<ArchitectAppState>);
      },
      [updateElements, updateAppState]
    );

    return (
      <div
        className={clsx('flex-1 min-h-0 relative overflow-hidden', className)}
        data-testid="architect-canvas"
      >
        {/* Absolute positioned inner wrapper to constrain Excalidraw height */}
        <div className="absolute inset-0">
          <Excalidraw
            theme="dark"
            onChange={handleChange}
            excalidrawAPI={(api) => {
              excalidrawAPIRef.current = api;
            }}
          />
        </div>
      </div>
    );
  }
);

export default ArchitectCanvas;
