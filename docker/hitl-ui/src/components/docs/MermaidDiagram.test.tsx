/**
 * Tests for MermaidDiagram component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import MermaidDiagram from './MermaidDiagram';

// Mock mermaid module
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

describe('MermaidDiagram', () => {
  let mermaidMock: {
    render: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    // Get fresh mock for each test
    const mermaid = await import('mermaid');
    mermaidMock = mermaid.default as typeof mermaidMock;

    // Default successful render
    mermaidMock.render.mockResolvedValue({
      svg: '<svg data-testid="rendered-svg"><g>Test SVG</g></svg>',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', async () => {
      render(<MermaidDiagram content="graph TD; A-->B" />);
      expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument();
    });

    it('renders valid mermaid to SVG', async () => {
      render(<MermaidDiagram content="graph TD; A-->B" />);

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

    it('calls mermaid.render with content', async () => {
      const content = 'graph TD; A-->B';
      render(<MermaidDiagram content={content} />);

      await waitFor(() => {
        expect(mermaidMock.render).toHaveBeenCalled();
        const call = mermaidMock.render.mock.calls[0];
        expect(call[1]).toBe(content);
      });
    });

    it('applies custom className', async () => {
      render(<MermaidDiagram content="graph TD; A-->B" className="my-custom-class" />);
      expect(screen.getByTestId('mermaid-diagram')).toHaveClass('my-custom-class');
    });
  });

  describe('Loading State', () => {
    it('shows loading state initially', () => {
      // Make render hang to test loading state
      mermaidMock.render.mockImplementation(() => new Promise(() => {}));

      render(<MermaidDiagram content="graph TD; A-->B" />);
      expect(screen.getByTestId('mermaid-loading')).toBeInTheDocument();
    });

    it('hides loading state after render completes', async () => {
      render(<MermaidDiagram content="graph TD; A-->B" />);

      await waitFor(() => {
        expect(screen.queryByTestId('mermaid-loading')).not.toBeInTheDocument();
      });
    });

    it('shows skeleton animation during loading', () => {
      mermaidMock.render.mockImplementation(() => new Promise(() => {}));

      render(<MermaidDiagram content="graph TD; A-->B" />);
      const loading = screen.getByTestId('mermaid-loading');
      expect(loading).toHaveClass('animate-pulse');
    });
  });

  describe('Error State', () => {
    it('shows error for invalid syntax', async () => {
      mermaidMock.render.mockRejectedValue(new Error('Parse error'));

      render(<MermaidDiagram content="invalid%%%" />);

      await waitFor(() => {
        expect(screen.getByTestId('mermaid-error')).toBeInTheDocument();
      });
    });

    it('displays error message', async () => {
      mermaidMock.render.mockRejectedValue(new Error('Syntax error in diagram'));

      render(<MermaidDiagram content="invalid" />);

      await waitFor(() => {
        expect(screen.getByText(/syntax error/i)).toBeInTheDocument();
      });
    });

    it('hides diagram container on error', async () => {
      mermaidMock.render.mockRejectedValue(new Error('Parse error'));

      render(<MermaidDiagram content="invalid%%%" />);

      await waitFor(() => {
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
      });
    });
  });

  describe('Callbacks', () => {
    it('calls onRender callback with SVG on success', async () => {
      const onRender = vi.fn();
      const svgContent = '<svg><g>Test</g></svg>';
      mermaidMock.render.mockResolvedValue({ svg: svgContent });

      render(<MermaidDiagram content="graph TD; A-->B" onRender={onRender} />);

      await waitFor(() => {
        expect(onRender).toHaveBeenCalledWith(svgContent);
      });
    });

    it('calls onError callback on failure', async () => {
      const onError = vi.fn();
      const error = new Error('Render failed');
      mermaidMock.render.mockRejectedValue(error);

      render(<MermaidDiagram content="invalid" onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Content Updates', () => {
    it('re-renders when content changes', async () => {
      const { rerender } = render(<MermaidDiagram content="graph TD; A-->B" />);

      await waitFor(() => {
        expect(mermaidMock.render).toHaveBeenCalledTimes(1);
      });

      rerender(<MermaidDiagram content="graph TD; C-->D" />);

      await waitFor(() => {
        expect(mermaidMock.render).toHaveBeenCalledTimes(2);
      });
    });

    it('does not re-render if content is unchanged', async () => {
      const content = 'graph TD; A-->B';
      const { rerender } = render(<MermaidDiagram content={content} />);

      await waitFor(() => {
        expect(mermaidMock.render).toHaveBeenCalledTimes(1);
      });

      rerender(<MermaidDiagram content={content} />);

      // Should still be 1 call (no additional render)
      expect(mermaidMock.render).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has aria-label for diagram', async () => {
      render(<MermaidDiagram content="graph TD; A-->B" ariaLabel="System architecture diagram" />);

      await waitFor(() => {
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('aria-label', 'System architecture diagram');
      });
    });

    it('uses default aria-label when not provided', async () => {
      render(<MermaidDiagram content="graph TD; A-->B" />);

      await waitFor(() => {
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('aria-label', 'Mermaid diagram');
      });
    });

    it('error state has alert role', async () => {
      mermaidMock.render.mockRejectedValue(new Error('Error'));

      render(<MermaidDiagram content="invalid" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Empty Content', () => {
    it('shows empty state for empty content', () => {
      render(<MermaidDiagram content="" />);
      expect(screen.getByTestId('mermaid-empty')).toBeInTheDocument();
    });

    it('shows empty state for whitespace-only content', () => {
      render(<MermaidDiagram content="   " />);
      expect(screen.getByTestId('mermaid-empty')).toBeInTheDocument();
    });
  });

  describe('Security', () => {
    it('sanitizes XSS in SVG output', async () => {
      // Simulate a malicious SVG with script injection
      const maliciousSvg = '<svg><script>alert("XSS")</script><g>Diagram</g></svg>';
      mermaidMock.render.mockResolvedValue({ svg: maliciousSvg });

      render(<MermaidDiagram content="graph TD; A-->B" />);

      await waitFor(() => {
        const img = screen.getByRole('img');
        // DOMPurify should remove the script tag
        expect(img.innerHTML).not.toContain('<script>');
        expect(img.innerHTML).not.toContain('alert');
      });
    });

    it('sanitizes event handlers in SVG output', async () => {
      // Simulate SVG with malicious event handler
      const maliciousSvg = '<svg><rect onload="alert(1)" onclick="alert(2)"></rect></svg>';
      mermaidMock.render.mockResolvedValue({ svg: maliciousSvg });

      render(<MermaidDiagram content="graph TD; A-->B" />);

      await waitFor(() => {
        const img = screen.getByRole('img');
        // DOMPurify should remove event handlers
        expect(img.innerHTML).not.toContain('onload');
        expect(img.innerHTML).not.toContain('onclick');
      });
    });

    it('preserves valid SVG elements after sanitization', async () => {
      const validSvg = '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="100" height="100"></rect><text>Label</text></g></svg>';
      mermaidMock.render.mockResolvedValue({ svg: validSvg });

      render(<MermaidDiagram content="graph TD; A-->B" />);

      await waitFor(() => {
        const img = screen.getByRole('img');
        // Valid SVG elements should be preserved
        expect(img.innerHTML).toContain('<rect');
        expect(img.innerHTML).toContain('<text>');
        expect(img.innerHTML).toContain('Label');
      });
    });
  });
});
