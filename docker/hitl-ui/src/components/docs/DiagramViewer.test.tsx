/**
 * Tests for DiagramViewer component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiagramViewer from './DiagramViewer';
import type { DiagramContent } from '../../api/types';

// Mock mermaid module
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
      svg: '<svg data-testid="rendered-svg"><g>Test SVG</g></svg>',
    }),
  },
}));

const mockDiagram: DiagramContent = {
  meta: {
    id: '01-system-architecture',
    title: 'System Architecture',
    filename: '01-System-Architecture.mmd',
    category: 'architecture',
    description: 'System component overview',
  },
  content: 'graph TD; A-->B; B-->C',
};

describe('DiagramViewer', () => {
  let mermaidMock: {
    render: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const mermaid = await import('mermaid');
    mermaidMock = mermaid.default as typeof mermaidMock;
    mermaidMock.render.mockResolvedValue({
      svg: '<svg data-testid="rendered-svg"><g>Test SVG</g></svg>',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', async () => {
      render(<DiagramViewer diagram={mockDiagram} />);
      expect(screen.getByTestId('diagram-viewer')).toBeInTheDocument();
    });

    it('displays diagram title', async () => {
      render(<DiagramViewer diagram={mockDiagram} />);
      expect(screen.getByText('System Architecture')).toBeInTheDocument();
    });

    it('displays diagram description', async () => {
      render(<DiagramViewer diagram={mockDiagram} />);
      expect(screen.getByText('System component overview')).toBeInTheDocument();
    });

    it('renders mermaid diagram', async () => {
      render(<DiagramViewer diagram={mockDiagram} />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
      });
    });

    it('applies custom className', async () => {
      render(<DiagramViewer diagram={mockDiagram} className="my-custom-class" />);
      expect(screen.getByTestId('diagram-viewer')).toHaveClass('my-custom-class');
    });
  });

  describe('Close Button', () => {
    it('shows close button when onClose is provided', async () => {
      const onClose = vi.fn();
      render(<DiagramViewer diagram={mockDiagram} onClose={onClose} />);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', async () => {
      const onClose = vi.fn();
      render(<DiagramViewer diagram={mockDiagram} onClose={onClose} />);

      fireEvent.click(screen.getByTestId('close-button'));
      expect(onClose).toHaveBeenCalled();
    });

    it('closes on Escape key', async () => {
      const onClose = vi.fn();
      render(<DiagramViewer diagram={mockDiagram} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('does not close on other keys', async () => {
      const onClose = vi.fn();
      render(<DiagramViewer diagram={mockDiagram} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Zoom Controls', () => {
    it('shows zoom controls when showControls is true', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);
      expect(screen.getByTestId('zoom-controls')).toBeInTheDocument();
    });

    it('hides zoom controls when showControls is false', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls={false} />);
      expect(screen.queryByTestId('zoom-controls')).not.toBeInTheDocument();
    });

    it('zoom in button increases scale', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
      });

      const zoomIn = screen.getByTestId('zoom-in');
      fireEvent.click(zoomIn);

      // Scale should increase (check zoom level display)
      await waitFor(() => {
        expect(screen.getByTestId('zoom-level')).toHaveTextContent(/1[12]\d%/);
      });
    });

    it('zoom out button decreases scale', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
      });

      const zoomOut = screen.getByTestId('zoom-out');
      fireEvent.click(zoomOut);

      // Scale should decrease
      await waitFor(() => {
        expect(screen.getByTestId('zoom-level')).toHaveTextContent(/[89]\d%/);
      });
    });

    it('fit button resets to fit view', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
      });

      // Zoom in first
      fireEvent.click(screen.getByTestId('zoom-in'));
      fireEvent.click(screen.getByTestId('zoom-in'));

      // Then fit
      fireEvent.click(screen.getByTestId('zoom-fit'));

      await waitFor(() => {
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('100%');
      });
    });

    it('reset button sets to 100%', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
      });

      // Zoom in first
      fireEvent.click(screen.getByTestId('zoom-in'));

      // Then reset
      fireEvent.click(screen.getByTestId('zoom-reset'));

      await waitFor(() => {
        expect(screen.getByTestId('zoom-level')).toHaveTextContent('100%');
      });
    });
  });

  describe('Category Badge', () => {
    it('displays category badge', async () => {
      render(<DiagramViewer diagram={mockDiagram} />);
      expect(screen.getByTestId('category-badge')).toBeInTheDocument();
      expect(screen.getByTestId('category-badge')).toHaveTextContent(/architecture/i);
    });
  });

  describe('Accessibility', () => {
    it('has accessible title', async () => {
      render(<DiagramViewer diagram={mockDiagram} />);
      expect(screen.getByRole('heading', { name: 'System Architecture' })).toBeInTheDocument();
    });

    it('close button has aria-label', async () => {
      const onClose = vi.fn();
      render(<DiagramViewer diagram={mockDiagram} onClose={onClose} />);
      expect(screen.getByTestId('close-button')).toHaveAttribute('aria-label', 'Close viewer');
    });

    it('zoom buttons have aria-labels', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);
      expect(screen.getByTestId('zoom-in')).toHaveAttribute('aria-label', 'Zoom in');
      expect(screen.getByTestId('zoom-out')).toHaveAttribute('aria-label', 'Zoom out');
      expect(screen.getByTestId('zoom-fit')).toHaveAttribute('aria-label', 'Fit to view');
      expect(screen.getByTestId('zoom-reset')).toHaveAttribute('aria-label', 'Reset zoom');
    });
  });

  describe('Pan Support', () => {
    it('diagram container supports panning', async () => {
      render(<DiagramViewer diagram={mockDiagram} />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
      });

      const container = screen.getByTestId('diagram-container');
      expect(container).toHaveClass('cursor-grab');
    });
  });

  describe('Loading State', () => {
    it('shows loading while diagram renders', async () => {
      mermaidMock.render.mockImplementation(() => new Promise(() => {}));

      render(<DiagramViewer diagram={mockDiagram} />);
      expect(screen.getByTestId('mermaid-loading')).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and URL.revokeObjectURL
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      // Mock navigator.clipboard
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      // Mock HTMLCanvasElement.toBlob
      HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
        callback(new Blob(['mock-png'], { type: 'image/png' }));
      });

      // Mock document.createElement for anchor
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === 'a') {
          element.click = vi.fn();
        }
        return element;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('shows export controls when showControls is true', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);
      expect(screen.getByTestId('export-controls')).toBeInTheDocument();
    });

    it('hides export controls when showControls is false', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls={false} />);
      expect(screen.queryByTestId('export-controls')).not.toBeInTheDocument();
    });

    it('downloads SVG on button click', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('download-svg'));

      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('downloads PNG button is clickable', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
      });

      const pngButton = screen.getByTestId('download-png');
      expect(pngButton).not.toBeDisabled();

      // Click the button - the actual PNG conversion won't work without a real SVG
      // but we verify the button is interactive and present
      fireEvent.click(pngButton);
    });

    it('copies source to clipboard', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('copy-source'));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockDiagram.content);
    });

    it('export buttons have aria-labels', async () => {
      render(<DiagramViewer diagram={mockDiagram} showControls />);
      expect(screen.getByTestId('download-svg')).toHaveAttribute('aria-label', 'Download SVG');
      expect(screen.getByTestId('download-png')).toHaveAttribute('aria-label', 'Download PNG');
      expect(screen.getByTestId('copy-source')).toHaveAttribute('aria-label', 'Copy source');
    });
  });
});
