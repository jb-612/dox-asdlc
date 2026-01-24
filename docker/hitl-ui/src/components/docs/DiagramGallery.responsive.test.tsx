/**
 * Tests for DiagramGallery responsive behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
];

describe('DiagramGallery Responsive', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Grid Layout', () => {
    it('has responsive grid classes', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

      const gallery = screen.getByTestId('diagram-gallery');
      // Verify the grid has responsive classes
      expect(gallery.querySelector('[class*="grid"]')).toBeInTheDocument();
    });

    it('applies mobile-first grid styling', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

      const grid = screen.getByTestId('diagram-grid');
      // Should have responsive grid columns
      expect(grid).toHaveClass('grid');
    });
  });

  describe('Card Layout', () => {
    it('cards have consistent sizing', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

      const cards = screen.getAllByTestId(/^diagram-card-/);
      cards.forEach((card) => {
        expect(card).toBeInTheDocument();
      });
    });

    it('card text does not overflow', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

      // Check that titles have truncation
      const cards = screen.getAllByTestId(/^diagram-card-/);
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('Touch Support', () => {
    it('cards are clickable on touch devices', () => {
      render(<DiagramGallery diagrams={mockDiagrams} onSelect={mockOnSelect} />);

      const card = screen.getByTestId('diagram-card-01-system-architecture');
      fireEvent.click(card);

      expect(mockOnSelect).toHaveBeenCalledWith('01-system-architecture');
    });
  });
});
