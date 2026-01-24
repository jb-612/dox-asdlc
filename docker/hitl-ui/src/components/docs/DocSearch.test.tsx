/**
 * Tests for DocSearch component
 *
 * Client-side fuzzy search across documents and diagrams.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocSearch from './DocSearch';
import type { DocumentMeta, DiagramMeta } from '../../api/types';

const mockDocuments: DocumentMeta[] = [
  {
    id: 'system-design',
    title: 'System Design',
    path: 'System_Design.md',
    category: 'system',
    description: 'Core system architecture and design principles',
    lastModified: '2026-01-21',
  },
  {
    id: 'main-features',
    title: 'Main Features',
    path: 'Main_Features.md',
    category: 'feature',
    description: 'Feature specifications and capabilities',
    lastModified: '2026-01-21',
  },
  {
    id: 'development-workflow',
    title: 'Development Workflow',
    path: 'Development_Workflow.md',
    category: 'workflow',
    description: 'TDD workflow and development practices',
    lastModified: '2026-01-20',
  },
];

const mockDiagrams: DiagramMeta[] = [
  {
    id: '01-system-architecture',
    title: 'System Architecture',
    filename: '01-System-Architecture.mmd',
    category: 'architecture',
    description: 'System component overview',
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
];

describe('DocSearch', () => {
  const mockOnResultSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Basic Rendering', () => {
    it('renders search input', () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('renders with placeholder text', () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
          className="my-custom-class"
        />
      );

      expect(screen.getByTestId('doc-search')).toHaveClass('my-custom-class');
    });
  });

  describe('Search Functionality', () => {
    it('finds documents by title', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });
    });

    it('finds diagrams by title', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'architecture' } });

      await waitFor(() => {
        expect(screen.getByText('System Architecture')).toBeInTheDocument();
      });
    });

    it('finds items by description', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'TDD' } });

      await waitFor(() => {
        expect(screen.getByText('Development Workflow')).toBeInTheDocument();
      });
    });

    it('performs fuzzy search', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'syst des' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });
    });

    it('shows no results message when no matches', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'xyznonexistent' } });

      await waitFor(() => {
        expect(screen.getByText(/no results/i)).toBeInTheDocument();
      });
    });

    it('hides results when input is cleared', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.change(input, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.queryByText('System Design')).not.toBeInTheDocument();
      });
    });
  });

  describe('Results Grouping', () => {
    it('groups results by type (documents and diagrams)', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByTestId('results-group-documents')).toBeInTheDocument();
        expect(screen.getByTestId('results-group-diagrams')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates results with ArrowDown', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'ArrowDown' });

      await waitFor(() => {
        const firstResult = screen.getByTestId('search-result-system-design');
        expect(firstResult).toHaveAttribute('data-highlighted', 'true');
      });
    });

    it('navigates results with ArrowUp', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      await waitFor(() => {
        const firstResult = screen.getByTestId('search-result-system-design');
        expect(firstResult).toHaveAttribute('data-highlighted', 'true');
      });
    });

    it('selects result with Enter key', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system design' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnResultSelect).toHaveBeenCalledWith({
        type: 'document',
        id: 'system-design',
      });
    });

    it('closes results with Escape key', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();
      });
    });
  });

  describe('Result Selection', () => {
    it('calls onResultSelect when result clicked', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('search-result-system-design'));

      expect(mockOnResultSelect).toHaveBeenCalledWith({
        type: 'document',
        id: 'system-design',
      });
    });

    it('calls onResultSelect for diagram', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'architecture' } });

      await waitFor(() => {
        expect(screen.getByText('System Architecture')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('search-result-01-system-architecture'));

      expect(mockOnResultSelect).toHaveBeenCalledWith({
        type: 'diagram',
        id: '01-system-architecture',
      });
    });

    it('clears search after selection', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('search-result-system-design'));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('Recent Searches', () => {
    it('stores recent searches in localStorage', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByText('System Design')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('search-result-system-design'));

      expect(localStorage.getItem('doc-search-recent')).toContain('system');
    });

    it('shows recent searches when input is focused with empty value', async () => {
      localStorage.setItem('doc-search-recent', JSON.stringify(['system', 'workflow']));

      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByTestId('recent-searches')).toBeInTheDocument();
        expect(screen.getByText('system')).toBeInTheDocument();
        expect(screen.getByText('workflow')).toBeInTheDocument();
      });
    });

    it('populates search when recent search clicked', async () => {
      localStorage.setItem('doc-search-recent', JSON.stringify(['system']));

      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText('system')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('recent-search-system'));

      await waitFor(() => {
        expect(input).toHaveValue('system');
      });
    });

    it('limits recent searches to 5 items', async () => {
      localStorage.setItem(
        'doc-search-recent',
        JSON.stringify(['one', 'two', 'three', 'four', 'five', 'six'])
      );

      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByTestId('recent-searches')).toBeInTheDocument();
      });

      // Should only show 5 most recent
      const recentItems = screen.getAllByTestId(/^recent-search-/);
      expect(recentItems.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Accessibility', () => {
    it('has accessible search role', () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('has aria-label on search input', () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      expect(screen.getByRole('searchbox')).toHaveAttribute('aria-label');
    });

    it('results have proper aria roles', async () => {
      render(
        <DocSearch
          documents={mockDocuments}
          diagrams={mockDiagrams}
          onResultSelect={mockOnResultSelect}
        />
      );

      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'system' } });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });
  });
});
