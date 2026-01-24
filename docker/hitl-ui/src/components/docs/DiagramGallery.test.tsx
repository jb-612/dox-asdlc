/**
 * Tests for DiagramGallery component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DiagramGallery from './DiagramGallery';
import type { DiagramMeta } from '../../api/types';

const mockDiagrams: DiagramMeta[] = [
  {
    id: '01-system-architecture',
    title: 'System Architecture',
    filename: '01-System-Architecture.mmd',
    category: 'architecture',
    description: 'System component overview',
  },
  {
    id: '02-container-topology',
    title: 'Container Topology',
    filename: '02-Container-Topology.mmd',
    category: 'architecture',
    description: 'Docker container deployment model',
  },
  {
    id: '03-discovery-flow',
    title: 'Discovery Flow',
    filename: '03-Discovery-Flow.mmd',
    category: 'flow',
    description: 'Discovery phase workflow',
  },
  {
    id: '08-hitl-gate-sequence',
    title: 'HITL Gate Sequence',
    filename: '08-HITL-Gate-Sequence.mmd',
    category: 'sequence',
    description: 'Human-in-the-loop approval sequence',
  },
  {
    id: '12-tool-execution',
    title: 'Tool Execution',
    filename: '12-Tool-Execution.mmd',
    category: 'decision',
    description: 'Bash tool execution model',
  },
];

describe('DiagramGallery', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      expect(screen.getByTestId('diagram-gallery')).toBeInTheDocument();
    });

    it('renders all diagrams', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      expect(screen.getAllByTestId(/^diagram-card-/)).toHaveLength(5);
    });

    it('renders diagram cards with correct test IDs', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      expect(screen.getByTestId('diagram-card-01-system-architecture')).toBeInTheDocument();
      expect(screen.getByTestId('diagram-card-02-container-topology')).toBeInTheDocument();
    });

    it('displays diagram titles', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      expect(screen.getByText('System Architecture')).toBeInTheDocument();
      expect(screen.getByText('Container Topology')).toBeInTheDocument();
    });

    it('displays diagram descriptions', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      expect(screen.getByText('System component overview')).toBeInTheDocument();
      expect(screen.getByText('Discovery phase workflow')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} className="my-custom-class" />);
      expect(screen.getByTestId('diagram-gallery')).toHaveClass('my-custom-class');
    });
  });

  describe('Category Badges', () => {
    it('displays category badges on cards', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      const architectureCards = screen.getAllByText('architecture');
      expect(architectureCards.length).toBeGreaterThanOrEqual(2);
    });

    it('shows correct category for each card', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      expect(screen.getByText('flow')).toBeInTheDocument();
      expect(screen.getByText('sequence')).toBeInTheDocument();
      expect(screen.getByText('decision')).toBeInTheDocument();
    });
  });

  describe('Category Filters', () => {
    it('shows filter buttons', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-architecture')).toBeInTheDocument();
      expect(screen.getByTestId('filter-flow')).toBeInTheDocument();
      expect(screen.getByTestId('filter-sequence')).toBeInTheDocument();
      expect(screen.getByTestId('filter-decision')).toBeInTheDocument();
    });

    it('filters by architecture category', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      fireEvent.click(screen.getByTestId('filter-architecture'));

      // Should only show architecture diagrams
      const cards = screen.getAllByTestId(/^diagram-card-/);
      expect(cards).toHaveLength(2);
      expect(screen.getByTestId('diagram-card-01-system-architecture')).toBeInTheDocument();
      expect(screen.getByTestId('diagram-card-02-container-topology')).toBeInTheDocument();
    });

    it('filters by flow category', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      fireEvent.click(screen.getByTestId('filter-flow'));

      const cards = screen.getAllByTestId(/^diagram-card-/);
      expect(cards).toHaveLength(1);
      expect(screen.getByTestId('diagram-card-03-discovery-flow')).toBeInTheDocument();
    });

    it('filters by sequence category', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      fireEvent.click(screen.getByTestId('filter-sequence'));

      const cards = screen.getAllByTestId(/^diagram-card-/);
      expect(cards).toHaveLength(1);
      expect(screen.getByTestId('diagram-card-08-hitl-gate-sequence')).toBeInTheDocument();
    });

    it('shows all diagrams when "All" filter is selected', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);

      // First filter by architecture
      fireEvent.click(screen.getByTestId('filter-architecture'));
      expect(screen.getAllByTestId(/^diagram-card-/)).toHaveLength(2);

      // Then click All
      fireEvent.click(screen.getByTestId('filter-all'));
      expect(screen.getAllByTestId(/^diagram-card-/)).toHaveLength(5);
    });

    it('highlights active filter', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      fireEvent.click(screen.getByTestId('filter-flow'));

      expect(screen.getByTestId('filter-flow')).toHaveClass('bg-accent-blue');
      expect(screen.getByTestId('filter-all')).not.toHaveClass('bg-accent-blue');
    });
  });

  describe('Selection', () => {
    it('calls onSelect when card clicked', () => {
      const onSelect = vi.fn();
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={onSelect} />);

      fireEvent.click(screen.getByTestId('diagram-card-01-system-architecture'));
      expect(onSelect).toHaveBeenCalledWith('01-system-architecture');
    });

    it('calls onSelect with correct ID for each card', () => {
      const onSelect = vi.fn();
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={onSelect} />);

      fireEvent.click(screen.getByTestId('diagram-card-03-discovery-flow'));
      expect(onSelect).toHaveBeenCalledWith('03-discovery-flow');
    });
  });

  describe('Keyboard Navigation', () => {
    it('cards are focusable', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      const card = screen.getByTestId('diagram-card-01-system-architecture');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('selects card on Enter key', () => {
      const onSelect = vi.fn();
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={onSelect} />);

      const card = screen.getByTestId('diagram-card-01-system-architecture');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith('01-system-architecture');
    });

    it('selects card on Space key', () => {
      const onSelect = vi.fn();
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={onSelect} />);

      const card = screen.getByTestId('diagram-card-01-system-architecture');
      fireEvent.keyDown(card, { key: ' ' });

      expect(onSelect).toHaveBeenCalledWith('01-system-architecture');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no diagrams', () => {
      render(<DiagramGallery diagrams={[]} onSelect={vi.fn()} />);
      expect(screen.getByText(/no diagrams/i)).toBeInTheDocument();
    });

    it('shows empty state when filter has no results', () => {
      const limitedDiagrams = mockDiagrams.filter((d) => d.category === 'architecture');
      render(<DiagramGallery diagrams={limitedDiagrams} onSelect={vi.fn()} />);

      fireEvent.click(screen.getByTestId('filter-sequence'));
      expect(screen.getByText(/no diagrams/i)).toBeInTheDocument();
    });
  });

  describe('Grid Layout', () => {
    it('uses grid layout', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      const container = screen.getByTestId('diagram-grid');
      expect(container).toHaveClass('grid');
    });

    it('applies responsive grid classes', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      const container = screen.getByTestId('diagram-grid');
      expect(container).toHaveClass('md:grid-cols-2');
      expect(container).toHaveClass('lg:grid-cols-3');
    });
  });

  describe('Accessibility', () => {
    it('cards have role button', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);
      const card = screen.getByTestId('diagram-card-01-system-architecture');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('filter buttons have aria-pressed', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={vi.fn()} />);

      // All is pressed by default
      expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('filter-architecture')).toHaveAttribute('aria-pressed', 'false');

      // After clicking architecture
      fireEvent.click(screen.getByTestId('filter-architecture'));
      expect(screen.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('filter-architecture')).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
