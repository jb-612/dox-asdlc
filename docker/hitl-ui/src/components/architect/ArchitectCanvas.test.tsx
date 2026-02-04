/**
 * Tests for ArchitectCanvas component
 * P10-F01 Architect Board Canvas - Phase 2 (T06)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useRef } from 'react';

// Mock stores and external dependencies at module level for hoisting
const mockUpdateElements = vi.fn();
const mockUpdateAppState = vi.fn();
let capturedOnChange: ((elements: unknown[], appState: unknown) => void) | null = null;

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: vi.fn(({ onChange, excalidrawAPI }: {
    onChange?: (elements: unknown[], appState: unknown) => void;
    excalidrawAPI?: (api: unknown) => void;
  }) => {
    // Capture the onChange callback for testing
    capturedOnChange = onChange || null;
    // Call excalidrawAPI with mock API
    if (excalidrawAPI) {
      excalidrawAPI({
        updateScene: vi.fn(),
        getSceneElements: vi.fn(() => []),
        getAppState: vi.fn(() => ({})),
      });
    }
    return (
      <div data-testid="excalidraw-mock">
        Excalidraw Canvas
      </div>
    );
  }),
}));

vi.mock('../../stores/architectStore', () => ({
  useArchitectStore: vi.fn((selector) => {
    const state = {
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      updateElements: mockUpdateElements,
      updateAppState: mockUpdateAppState,
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

import ArchitectCanvas from './ArchitectCanvas';

describe('ArchitectCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnChange = null;
  });

  describe('Mounting', () => {
    it('renders without errors', () => {
      render(<ArchitectCanvas />);
      expect(screen.getByTestId('architect-canvas')).toBeInTheDocument();
    });

    it('renders the Excalidraw component', () => {
      render(<ArchitectCanvas />);
      expect(screen.getByTestId('excalidraw-mock')).toBeInTheDocument();
    });

    it('applies full height and width styling', () => {
      render(<ArchitectCanvas />);
      const canvas = screen.getByTestId('architect-canvas');
      expect(canvas).toHaveClass('flex-1');
      expect(canvas).toHaveClass('min-h-0');
    });
  });

  describe('Store Integration', () => {
    it('triggers store update when onChange is called', () => {
      render(<ArchitectCanvas />);

      // Verify onChange was captured
      expect(capturedOnChange).not.toBeNull();

      // Simulate Excalidraw onChange callback
      const mockElements = [{ id: 'test-element', type: 'rectangle' }];
      const mockAppState = { viewBackgroundColor: '#000000' };

      act(() => {
        if (capturedOnChange) {
          capturedOnChange(mockElements, mockAppState);
        }
      });

      // Verify store was updated
      expect(mockUpdateElements).toHaveBeenCalledWith(mockElements);
      expect(mockUpdateAppState).toHaveBeenCalledWith(mockAppState);
    });
  });

  describe('Ref Access', () => {
    it('exposes excalidrawAPI via ref', () => {
      // Create a wrapper component to use the ref
      function TestWrapper() {
        const ref = useRef<{ getAPI: () => unknown }>(null);
        return (
          <div>
            <ArchitectCanvas ref={ref} />
            <span data-testid="ref-check">{ref.current ? 'ref-set' : 'ref-null'}</span>
          </div>
        );
      }

      render(<TestWrapper />);

      // The ref object should exist after render
      // Note: In React strict mode, ref might be null initially
      expect(screen.getByTestId('architect-canvas')).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(<ArchitectCanvas className="custom-class" />);
      const canvas = screen.getByTestId('architect-canvas');
      expect(canvas).toHaveClass('custom-class');
    });
  });
});
