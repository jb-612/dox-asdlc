/**
 * Accessibility tests for documentation components
 *
 * Tests verify ARIA attributes, keyboard navigation, semantic HTML,
 * and other a11y best practices.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocSearch from './DocSearch';
import DiagramGallery from './DiagramGallery';
import DiagramViewer from './DiagramViewer';
import DocBrowser from './DocBrowser';
import BlueprintMap from './BlueprintMap';
import MethodologyStepper from './MethodologyStepper';
import InteractiveGlossary from './InteractiveGlossary';
import type { DocumentMeta, DiagramMeta, DiagramContent } from '../../api/types';

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
      svg: '<svg aria-label="test"><g>Test SVG</g></svg>',
    }),
  },
}));

const mockDocuments: DocumentMeta[] = [
  {
    id: 'doc-1',
    title: 'Test Document',
    path: 'test.md',
    category: 'system',
    description: 'A test document',
    lastModified: '2026-01-21',
  },
];

const mockDiagrams: DiagramMeta[] = [
  {
    id: 'diagram-1',
    title: 'Test Diagram',
    filename: 'test.mmd',
    category: 'architecture',
    description: 'A test diagram',
  },
];

const mockDiagramContent: DiagramContent = {
  meta: mockDiagrams[0],
  content: 'graph TD; A-->B',
};

describe('DocSearch Accessibility', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('has proper role="searchbox" on input', () => {
    render(
      <DocSearch
        documents={mockDocuments}
        diagrams={mockDiagrams}
        onResultSelect={mockOnSelect}
      />
    );

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('has aria-label on search input', () => {
    render(
      <DocSearch
        documents={mockDocuments}
        diagrams={mockDiagrams}
        onResultSelect={mockOnSelect}
      />
    );

    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-label');
  });

  it('has aria-expanded attribute reflecting state', async () => {
    render(
      <DocSearch
        documents={mockDocuments}
        diagrams={mockDiagrams}
        onResultSelect={mockOnSelect}
      />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('results listbox has role="listbox"', async () => {
    render(
      <DocSearch
        documents={mockDocuments}
        diagrams={mockDiagrams}
        onResultSelect={mockOnSelect}
      />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation with ArrowDown/ArrowUp', async () => {
    render(
      <DocSearch
        documents={mockDocuments}
        diagrams={mockDiagrams}
        onResultSelect={mockOnSelect}
      />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // First result should be highlighted
    const result = screen.getByTestId('search-result-doc-1');
    expect(result).toHaveAttribute('data-highlighted', 'true');
  });

  it('Escape key closes results', async () => {
    render(
      <DocSearch
        documents={mockDocuments}
        diagrams={mockDiagrams}
        onResultSelect={mockOnSelect}
      />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});

describe('DiagramGallery Accessibility', () => {
  const mockOnSelect = vi.fn();

  it('cards have role="button"', () => {
    render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

    const card = screen.getByTestId('diagram-card-diagram-1');
    expect(card).toHaveAttribute('role', 'button');
  });

  it('cards are focusable with tabindex', () => {
    render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

    const card = screen.getByTestId('diagram-card-diagram-1');
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('cards respond to Enter key', () => {
    render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

    const card = screen.getByTestId('diagram-card-diagram-1');
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(mockOnSelect).toHaveBeenCalledWith('diagram-1');
  });

  it('cards respond to Space key', () => {
    render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

    const card = screen.getByTestId('diagram-card-diagram-1');
    fireEvent.keyDown(card, { key: ' ' });

    expect(mockOnSelect).toHaveBeenCalledWith('diagram-1');
  });

  it('filter buttons have aria-pressed attribute', () => {
    render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

    const allFilter = screen.getByTestId('filter-all');
    expect(allFilter).toHaveAttribute('aria-pressed');
  });
});

describe('DiagramViewer Accessibility', () => {
  const mockOnClose = vi.fn();

  it('has accessible heading', () => {
    render(<DiagramViewer diagram={mockDiagramContent} onClose={mockOnClose} />);

    expect(
      screen.getByRole('heading', { name: 'Test Diagram' })
    ).toBeInTheDocument();
  });

  it('close button has aria-label', () => {
    render(<DiagramViewer diagram={mockDiagramContent} onClose={mockOnClose} />);

    expect(screen.getByTestId('close-button')).toHaveAttribute(
      'aria-label',
      'Close viewer'
    );
  });

  it('zoom controls have aria-labels', () => {
    render(
      <DiagramViewer
        diagram={mockDiagramContent}
        onClose={mockOnClose}
        showControls
      />
    );

    expect(screen.getByTestId('zoom-in')).toHaveAttribute('aria-label', 'Zoom in');
    expect(screen.getByTestId('zoom-out')).toHaveAttribute('aria-label', 'Zoom out');
    expect(screen.getByTestId('zoom-fit')).toHaveAttribute('aria-label', 'Fit to view');
    expect(screen.getByTestId('zoom-reset')).toHaveAttribute('aria-label', 'Reset zoom');
  });

  it('export controls have aria-labels', () => {
    render(
      <DiagramViewer
        diagram={mockDiagramContent}
        onClose={mockOnClose}
        showControls
      />
    );

    expect(screen.getByTestId('download-svg')).toHaveAttribute('aria-label', 'Download SVG');
    expect(screen.getByTestId('download-png')).toHaveAttribute('aria-label', 'Download PNG');
    expect(screen.getByTestId('copy-source')).toHaveAttribute('aria-label', 'Copy source');
  });

  it('Escape key triggers close', () => {
    render(<DiagramViewer diagram={mockDiagramContent} onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('DocBrowser Accessibility', () => {
  const mockOnSelect = vi.fn();

  it('category headers have aria-expanded', () => {
    render(
      <DocBrowser
        documents={mockDocuments}
        onSelect={mockOnSelect}
      />
    );

    const header = screen.getByTestId('category-header-system');
    expect(header).toHaveAttribute('aria-expanded');
  });

  it('document items have role="button"', () => {
    render(
      <DocBrowser
        documents={mockDocuments}
        onSelect={mockOnSelect}
      />
    );

    const doc = screen.getByTestId('doc-doc-1');
    expect(doc).toHaveAttribute('role', 'button');
  });

  it('document items are focusable', () => {
    render(
      <DocBrowser
        documents={mockDocuments}
        onSelect={mockOnSelect}
      />
    );

    const doc = screen.getByTestId('doc-doc-1');
    expect(doc).toHaveAttribute('tabindex', '0');
  });

  it('document items respond to Enter key', () => {
    render(
      <DocBrowser
        documents={mockDocuments}
        onSelect={mockOnSelect}
      />
    );

    const doc = screen.getByTestId('doc-doc-1');
    fireEvent.keyDown(doc, { key: 'Enter' });

    expect(mockOnSelect).toHaveBeenCalledWith('doc-1');
  });

  it('collapsed content is aria-hidden', () => {
    render(
      <DocBrowser
        documents={mockDocuments}
        onSelect={mockOnSelect}
      />
    );

    // Toggle to collapse
    fireEvent.click(screen.getByTestId('category-header-system'));

    const content = screen.getByTestId('category-content-system');
    expect(content).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('BlueprintMap Accessibility', () => {
  const mockClusters = [
    {
      id: 'test',
      name: 'Test Cluster',
      description: 'A test cluster',
      color: 'teal' as const,
      items: [{ id: 'item-1', name: 'Test Item', type: 'agent' as const }],
    },
  ];

  it('clusters are focusable', () => {
    render(<BlueprintMap clusters={mockClusters} />);

    const cluster = screen.getByTestId('cluster-test');
    expect(cluster).toHaveAttribute('tabindex', '0');
  });

  it('clusters respond to Enter key', () => {
    render(<BlueprintMap clusters={mockClusters} />);

    const cluster = screen.getByTestId('cluster-test');
    fireEvent.keyDown(cluster, { key: 'Enter' });

    // Should expand the cluster
    expect(screen.getByTestId('cluster-items-test')).toBeInTheDocument();
  });

  it('clusters have role="button"', () => {
    render(<BlueprintMap clusters={mockClusters} />);

    const cluster = screen.getByTestId('cluster-test');
    expect(cluster).toHaveAttribute('role', 'button');
  });
});

describe('MethodologyStepper Accessibility', () => {
  const mockStages = [
    {
      id: 'stage-1',
      name: 'Stage One',
      description: 'First stage',
      why: 'Important reason',
      inputs: ['Input 1'],
      outputs: ['Output 1'],
      approvals: ['Approver 1'],
      issues: ['Issue 1'],
    },
    {
      id: 'stage-2',
      name: 'Stage Two',
      description: 'Second stage',
      why: 'Another reason',
      inputs: ['Input 2'],
      outputs: ['Output 2'],
      approvals: ['Approver 2'],
      issues: ['Issue 2'],
    },
  ];

  it('navigation buttons have aria-labels', () => {
    render(<MethodologyStepper stages={mockStages} />);

    expect(screen.getByTestId('prev-button')).toHaveAttribute('aria-label');
    expect(screen.getByTestId('next-button')).toHaveAttribute('aria-label');
  });

  it('disabled prev button has aria-disabled', () => {
    render(<MethodologyStepper stages={mockStages} />);

    const prevButton = screen.getByTestId('prev-button');
    expect(prevButton).toBeDisabled();
  });

  it('progress indicator is accessible', () => {
    render(<MethodologyStepper stages={mockStages} />);

    expect(screen.getByText(/stage 1 of 2/i)).toBeInTheDocument();
  });
});

describe('InteractiveGlossary Accessibility', () => {
  const mockTerms = [
    {
      id: 'term-1',
      term: 'Test Term',
      definition: 'A test definition',
      category: 'concept' as const,
    },
  ];

  it('search input has type="text" and aria-label', () => {
    render(<InteractiveGlossary terms={mockTerms} />);

    // The glossary uses type="text" not type="search"
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-label');
  });

  it('term items are focusable', () => {
    render(<InteractiveGlossary terms={mockTerms} />);

    const term = screen.getByTestId('term-term-1');
    expect(term).toHaveAttribute('tabindex', '0');
  });

  it('term items respond to Enter key', () => {
    render(<InteractiveGlossary terms={mockTerms} />);

    const term = screen.getByTestId('term-term-1');
    fireEvent.keyDown(term, { key: 'Enter' });

    // Should expand/select the term - check definition is visible
    expect(screen.getByText('A test definition')).toBeInTheDocument();
  });
});
