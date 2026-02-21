import { useEffect, useCallback } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';

// ---------------------------------------------------------------------------
// Shortcut definitions
// ---------------------------------------------------------------------------

export interface ShortcutHandlers {
  /** Ctrl+S: Save current workflow */
  onSave?: () => void;
  /** Ctrl+O: Open / load a workflow */
  onOpen?: () => void;
  /** Ctrl+N: Create a new workflow */
  onNew?: () => void;
}

/**
 * Global keyboard shortcut handler.
 *
 * Registers window-level keydown handlers for common actions:
 *   - Ctrl+S       : save workflow
 *   - Ctrl+Z       : undo
 *   - Ctrl+Shift+Z : redo
 *   - Ctrl+O       : open workflow
 *   - Ctrl+N       : new workflow
 *   - Delete        : remove selected node/edge
 *   - Escape        : clear selection
 *
 * Call this hook once in a top-level component (e.g., DesignerPage or App).
 */
export function useKeyboardShortcuts(handlers?: ShortcutHandlers): void {
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Do not intercept shortcuts when the user is typing in an input field
      const tag = (e.target as HTMLElement)?.tagName;
      const isInputFocused =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl+S -- save
      if (ctrlOrMeta && e.key === 's') {
        e.preventDefault();
        handlers?.onSave?.();
        return;
      }

      // Ctrl+Shift+Z -- redo
      if (ctrlOrMeta && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+Z -- undo
      if (ctrlOrMeta && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+O -- open
      if (ctrlOrMeta && e.key === 'o') {
        e.preventDefault();
        handlers?.onOpen?.();
        return;
      }

      // Ctrl+N -- new workflow
      if (ctrlOrMeta && e.key === 'n') {
        e.preventDefault();
        if (handlers?.onNew) {
          handlers.onNew();
        } else {
          newWorkflow();
        }
        return;
      }

      // The remaining shortcuts should not fire when typing in inputs
      if (isInputFocused) return;

      // Delete -- remove selected node or edge
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          removeNode(selectedNodeId);
        } else if (selectedEdgeId) {
          removeEdge(selectedEdgeId);
        }
        return;
      }

      // Escape -- clear selection
      if (e.key === 'Escape') {
        clearSelection();
        return;
      }
    },
    [
      handlers,
      undo,
      redo,
      selectedNodeId,
      selectedEdgeId,
      removeNode,
      removeEdge,
      clearSelection,
      newWorkflow,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
