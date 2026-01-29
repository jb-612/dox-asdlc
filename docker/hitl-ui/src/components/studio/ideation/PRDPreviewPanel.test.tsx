/**
 * Tests for PRDPreviewPanel component (P05-F11 T13)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PRDPreviewPanel from './PRDPreviewPanel';
import type { PRDDocument } from '../../../types/ideation';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

describe('PRDPreviewPanel', () => {
  const mockPRDDocument: PRDDocument = {
    id: 'prd-001',
    title: 'Test PRD Document',
    version: '1.0',
    sections: [
      {
        id: 'overview',
        heading: 'Overview',
        content: 'This is the overview section with **bold** text.',
        order: 1,
      },
      {
        id: 'problem',
        heading: 'Problem Statement',
        content: 'This describes the problem we are solving.\n\n- Point 1\n- Point 2',
        order: 2,
      },
      {
        id: 'requirements',
        heading: 'Requirements',
        content: '## Functional Requirements\n\n1. Feature A\n2. Feature B',
        order: 3,
      },
    ],
    createdAt: '2026-01-28T10:00:00Z',
    status: 'pending_review',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('renders empty state when no PRD document provided', () => {
      render(<PRDPreviewPanel prdDocument={null} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('shows helpful message in empty state', () => {
      render(<PRDPreviewPanel prdDocument={null} />);

      expect(screen.getByText(/no prd generated/i)).toBeInTheDocument();
    });

    it('shows icon in empty state', () => {
      render(<PRDPreviewPanel prdDocument={null} />);

      expect(screen.getByTestId('empty-state-icon')).toBeInTheDocument();
    });
  });

  describe('Document Rendering', () => {
    it('renders document title', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByText('Test PRD Document')).toBeInTheDocument();
    });

    it('renders document version', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByText(/v1\.0/)).toBeInTheDocument();
    });

    it('renders document status badge', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByTestId('status-badge')).toHaveTextContent(/pending/i);
    });

    it('renders all sections', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Problem Statement')).toBeInTheDocument();
      expect(screen.getByText('Requirements')).toBeInTheDocument();
    });

    it('sections are ordered correctly', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      // Match only section containers (not section-content-*)
      const sections = screen.getAllByTestId(/^section-(?!content)[\w]+$/);
      expect(sections).toHaveLength(3);
      expect(sections[0]).toHaveAttribute('data-testid', 'section-overview');
      expect(sections[1]).toHaveAttribute('data-testid', 'section-problem');
      expect(sections[2]).toHaveAttribute('data-testid', 'section-requirements');
    });
  });

  describe('Collapsible Sections', () => {
    it('renders section headers with expand/collapse buttons', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      const toggleButtons = screen.getAllByTestId(/^toggle-section-/);
      expect(toggleButtons.length).toBeGreaterThan(0);
    });

    it('sections start expanded by default', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      const content = screen.getByTestId('section-content-overview');
      expect(content).toBeVisible();
    });

    it('clicking toggle collapses section', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      const toggle = screen.getByTestId('toggle-section-overview');
      fireEvent.click(toggle);

      const content = screen.getByTestId('section-content-overview');
      expect(content).toHaveClass('hidden');
    });

    it('clicking toggle again expands section', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      const toggle = screen.getByTestId('toggle-section-overview');
      fireEvent.click(toggle); // collapse
      fireEvent.click(toggle); // expand

      const content = screen.getByTestId('section-content-overview');
      expect(content).not.toHaveClass('hidden');
    });

    it('shows chevron icon for collapse state', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      const chevron = screen.getByTestId('chevron-overview');
      expect(chevron).toBeInTheDocument();
    });
  });

  describe('Markdown Rendering', () => {
    it('renders markdown content correctly', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      // Check for rendered bold text
      expect(screen.getByText('bold')).toBeInTheDocument();
    });

    it('renders lists in markdown', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByText('Point 1')).toBeInTheDocument();
      expect(screen.getByText('Point 2')).toBeInTheDocument();
    });

    it('renders nested headings in markdown', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByText('Functional Requirements')).toBeInTheDocument();
    });
  });

  describe('Download Functionality', () => {
    it('renders download button', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByTestId('download-button')).toBeInTheDocument();
    });

    it('downloads markdown file when button clicked', () => {
      // Store original createElement
      const originalCreateElement = document.createElement.bind(document);
      const mockClick = vi.fn();
      const mockAnchor = { click: mockClick, download: '', href: '' };

      // Mock only for 'a' elements
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return mockAnchor as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      });

      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);
      fireEvent.click(screen.getByTestId('download-button'));

      expect(mockCreateObjectURL).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('download filename includes document title', () => {
      // Store original createElement
      const originalCreateElement = document.createElement.bind(document);
      const mockClick = vi.fn();
      const mockAnchor = { click: mockClick, download: '', href: '' };

      // Mock only for 'a' elements
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return mockAnchor as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      });

      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);
      fireEvent.click(screen.getByTestId('download-button'));

      expect(mockAnchor.download).toContain('Test_PRD_Document');
      vi.restoreAllMocks();
    });

    it('download button has accessible label', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      const button = screen.getByTestId('download-button');
      expect(button).toHaveAttribute('aria-label');
    });
  });

  describe('Print-Friendly Styling', () => {
    it('renders print button', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByTestId('print-button')).toBeInTheDocument();
    });

    it('triggers print when print button clicked', () => {
      const mockPrint = vi.fn();
      vi.spyOn(window, 'print').mockImplementation(mockPrint);

      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      fireEvent.click(screen.getByTestId('print-button'));

      expect(mockPrint).toHaveBeenCalled();
    });

    it('has print-friendly class on container', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByTestId('prd-preview-panel')).toHaveClass('print:bg-white');
    });
  });

  describe('Expand/Collapse All', () => {
    it('renders expand all button', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByTestId('expand-all-button')).toBeInTheDocument();
    });

    it('renders collapse all button', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      expect(screen.getByTestId('collapse-all-button')).toBeInTheDocument();
    });

    it('collapse all collapses all sections', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      fireEvent.click(screen.getByTestId('collapse-all-button'));

      const contents = screen.getAllByTestId(/^section-content-/);
      contents.forEach((content) => {
        expect(content).toHaveClass('hidden');
      });
    });

    it('expand all expands all sections', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      // First collapse
      fireEvent.click(screen.getByTestId('collapse-all-button'));
      // Then expand
      fireEvent.click(screen.getByTestId('expand-all-button'));

      const contents = screen.getAllByTestId(/^section-content-/);
      contents.forEach((content) => {
        expect(content).not.toHaveClass('hidden');
      });
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} className="my-custom-class" />);

      expect(screen.getByTestId('prd-preview-panel')).toHaveClass('my-custom-class');
    });

    it('can hide download button', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} showDownload={false} />);

      expect(screen.queryByTestId('download-button')).not.toBeInTheDocument();
    });

    it('can hide print button', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} showPrint={false} />);

      expect(screen.queryByTestId('print-button')).not.toBeInTheDocument();
    });

    it('can set sections to start collapsed', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} defaultExpanded={false} />);

      const content = screen.getByTestId('section-content-overview');
      expect(content).toHaveClass('hidden');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA role for sections', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      const sections = screen.getAllByRole('region');
      expect(sections.length).toBeGreaterThan(0);
    });

    it('toggle buttons have aria-expanded attribute', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      const toggle = screen.getByTestId('toggle-section-overview');
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('toggle buttons update aria-expanded on click', () => {
      render(<PRDPreviewPanel prdDocument={mockPRDDocument} />);

      const toggle = screen.getByTestId('toggle-section-overview');
      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
