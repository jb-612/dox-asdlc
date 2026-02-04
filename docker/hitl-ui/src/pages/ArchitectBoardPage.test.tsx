/**
 * Tests for ArchitectBoardPage component
 * P10-F01 Architect Board Canvas - Phase 4 (T18)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock the architect store
const mockSetCanvasName = vi.fn();
const mockPerformExport = vi.fn();
const mockToggleToolsPanel = vi.fn();
const mockToggleOutputPanel = vi.fn();
let mockCanvasName = 'Untitled Architecture';
let mockIsToolsPanelOpen = false;
let mockIsOutputPanelOpen = false;
let mockIsExporting = false;

vi.mock('../stores/architectStore', () => ({
  useArchitectStore: vi.fn((selector) => {
    const state = {
      canvasName: mockCanvasName,
      setCanvasName: mockSetCanvasName,
      isToolsPanelOpen: mockIsToolsPanelOpen,
      isOutputPanelOpen: mockIsOutputPanelOpen,
      isExporting: mockIsExporting,
      performExport: mockPerformExport,
      toggleToolsPanel: mockToggleToolsPanel,
      toggleOutputPanel: mockToggleOutputPanel,
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// Mock Excalidraw to avoid loading the full library in tests
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: () => <div data-testid="excalidraw-mock">Excalidraw Mock</div>,
  exportToSvg: vi.fn(),
}));

import ArchitectBoardPage from './ArchitectBoardPage';

// Wrapper for router
function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('ArchitectBoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvasName = 'Untitled Architecture';
    mockIsToolsPanelOpen = false;
    mockIsOutputPanelOpen = false;
    mockIsExporting = false;
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderWithRouter(<ArchitectBoardPage />);
      expect(screen.getByTestId('architect-board-page')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      renderWithRouter(<ArchitectBoardPage className="my-custom-class" />);
      expect(screen.getByTestId('architect-board-page')).toHaveClass('my-custom-class');
    });
  });

  describe('Layout Structure', () => {
    it('renders session bar', () => {
      renderWithRouter(<ArchitectBoardPage />);
      expect(screen.getByTestId('session-bar')).toBeInTheDocument();
    });

    it('renders 3-panel layout', () => {
      renderWithRouter(<ArchitectBoardPage />);
      expect(screen.getByTestId('tools-panel')).toBeInTheDocument();
      expect(screen.getByTestId('architect-canvas')).toBeInTheDocument();
      expect(screen.getByTestId('output-panel')).toBeInTheDocument();
    });

    it('renders action bar', () => {
      renderWithRouter(<ArchitectBoardPage />);
      expect(screen.getByTestId('action-bar')).toBeInTheDocument();
    });
  });

  describe('Session Bar', () => {
    it('renders canvas name input', () => {
      renderWithRouter(<ArchitectBoardPage />);
      expect(screen.getByLabelText(/canvas name/i)).toBeInTheDocument();
    });

    it('displays current canvas name', () => {
      mockCanvasName = 'My Architecture';
      renderWithRouter(<ArchitectBoardPage />);
      const input = screen.getByLabelText(/canvas name/i) as HTMLInputElement;
      expect(input.value).toBe('My Architecture');
    });

    it('calls setCanvasName when input changes', async () => {
      renderWithRouter(<ArchitectBoardPage />);
      const input = screen.getByLabelText(/canvas name/i);
      fireEvent.change(input, { target: { value: 'New Canvas Name' } });

      await waitFor(() => {
        expect(mockSetCanvasName).toHaveBeenCalledWith('New Canvas Name');
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('Ctrl+Shift+E triggers export', async () => {
      renderWithRouter(<ArchitectBoardPage />);
      const page = screen.getByTestId('architect-board-page');

      fireEvent.keyDown(page, { key: 'e', ctrlKey: true, shiftKey: true });

      await waitFor(() => {
        expect(mockPerformExport).toHaveBeenCalled();
      });
    });

    it('Cmd+Shift+E triggers export on Mac', async () => {
      renderWithRouter(<ArchitectBoardPage />);
      const page = screen.getByTestId('architect-board-page');

      fireEvent.keyDown(page, { key: 'e', metaKey: true, shiftKey: true });

      await waitFor(() => {
        expect(mockPerformExport).toHaveBeenCalled();
      });
    });

    it('Ctrl+[ toggles tools panel', async () => {
      renderWithRouter(<ArchitectBoardPage />);
      const page = screen.getByTestId('architect-board-page');

      fireEvent.keyDown(page, { key: '[', ctrlKey: true });

      await waitFor(() => {
        expect(mockToggleToolsPanel).toHaveBeenCalled();
      });
    });

    it('Ctrl+] toggles output panel', async () => {
      renderWithRouter(<ArchitectBoardPage />);
      const page = screen.getByTestId('architect-board-page');

      fireEvent.keyDown(page, { key: ']', ctrlKey: true });

      await waitFor(() => {
        expect(mockToggleOutputPanel).toHaveBeenCalled();
      });
    });
  });

  describe('Panel Integration', () => {
    it('ToolsPanel receives correct open state', () => {
      mockIsToolsPanelOpen = true;
      renderWithRouter(<ArchitectBoardPage />);
      const toolsPanel = screen.getByTestId('tools-panel');
      expect(toolsPanel).toHaveClass('w-60');
    });

    it('OutputPanel receives correct open state', () => {
      mockIsOutputPanelOpen = true;
      renderWithRouter(<ArchitectBoardPage />);
      const outputPanel = screen.getByTestId('output-panel');
      expect(outputPanel).toHaveClass('w-80');
    });
  });

  describe('ActionBar Integration', () => {
    it('Export button in ActionBar triggers performExport', async () => {
      renderWithRouter(<ArchitectBoardPage />);
      const exportButton = screen.getByRole('button', { name: /export svg/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockPerformExport).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has main landmark', () => {
      renderWithRouter(<ArchitectBoardPage />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('canvas name input has accessible label', () => {
      renderWithRouter(<ArchitectBoardPage />);
      const input = screen.getByLabelText(/canvas name/i);
      expect(input).toBeInTheDocument();
    });
  });

  describe('Full Screen Layout', () => {
    it('has full height layout', () => {
      renderWithRouter(<ArchitectBoardPage />);
      const page = screen.getByTestId('architect-board-page');
      expect(page).toHaveClass('absolute');
    });

    it('has flex column layout', () => {
      renderWithRouter(<ArchitectBoardPage />);
      const page = screen.getByTestId('architect-board-page');
      expect(page).toHaveClass('flex');
      expect(page).toHaveClass('flex-col');
    });
  });
});
