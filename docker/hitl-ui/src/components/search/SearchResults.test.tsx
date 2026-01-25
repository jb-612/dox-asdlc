/**
 * Tests for SearchResults component (P05-F08 Task 2.3)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchResults from './SearchResults';
import type { KSSearchResult } from '../../api/types';

const mockResults: KSSearchResult[] = [
  {
    docId: 'test-1',
    content: 'First result content',
    metadata: { file_path: 'file1.py', file_type: '.py', language: 'python' },
    score: 0.95,
    source: 'mock',
  },
  {
    docId: 'test-2',
    content: 'Second result content',
    metadata: { file_path: 'file2.ts', file_type: '.ts', language: 'typescript' },
    score: 0.85,
    source: 'mock',
  },
  {
    docId: 'test-3',
    content: 'Third result content',
    metadata: { file_path: 'file3.md', file_type: '.md', language: 'markdown' },
    score: 0.75,
    source: 'mock',
  },
];

describe('SearchResults', () => {
  const defaultProps = {
    results: mockResults,
    total: 3,
    page: 1,
    pageSize: 10,
    isLoading: false,
    onPageChange: vi.fn(),
    onResultClick: vi.fn(),
  };

  describe('Basic Rendering', () => {
    it('renders result cards', () => {
      render(<SearchResults {...defaultProps} />);
      expect(screen.getAllByTestId('search-result-card')).toHaveLength(3);
    });

    it('renders with test id prefix for each result', () => {
      render(<SearchResults {...defaultProps} />);
      expect(screen.getByTestId('search-result-0')).toBeInTheDocument();
      expect(screen.getByTestId('search-result-1')).toBeInTheDocument();
      expect(screen.getByTestId('search-result-2')).toBeInTheDocument();
    });

    it('renders search results container', () => {
      render(<SearchResults {...defaultProps} />);
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<SearchResults {...defaultProps} isLoading results={[]} />);
      expect(screen.getByTestId('results-skeleton')).toBeInTheDocument();
    });

    it('hides results when loading', () => {
      render(<SearchResults {...defaultProps} isLoading />);
      expect(screen.queryAllByTestId('search-result-card')).toHaveLength(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no results', () => {
      render(<SearchResults {...defaultProps} results={[]} total={0} />);
      expect(screen.getByText(/no results/i)).toBeInTheDocument();
    });

    it('shows suggestions in empty state', () => {
      render(<SearchResults {...defaultProps} results={[]} total={0} />);
      expect(screen.getByText(/try different keywords/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error state with retry button', () => {
      render(<SearchResults {...defaultProps} error="Network error" onRetry={vi.fn()} />);
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      render(<SearchResults {...defaultProps} error="Error" onRetry={onRetry} />);

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('Result Count', () => {
    it('shows result count for single page', () => {
      render(<SearchResults {...defaultProps} />);
      expect(screen.getByText('Showing 1-3 of 3')).toBeInTheDocument();
    });

    it('shows result count for multiple pages', () => {
      render(<SearchResults {...defaultProps} total={25} />);
      expect(screen.getByText('Showing 1-3 of 25')).toBeInTheDocument();
    });

    it('calculates correct range for page 2', () => {
      render(
        <SearchResults
          {...defaultProps}
          page={2}
          total={25}
          results={mockResults}
          pageSize={10}
        />
      );
      expect(screen.getByText('Showing 11-13 of 25')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('shows pagination for multiple pages', () => {
      render(<SearchResults {...defaultProps} total={25} pageSize={10} />);
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('disables previous button on first page', () => {
      render(<SearchResults {...defaultProps} total={25} page={1} />);
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });

    it('disables next button on last page', () => {
      render(<SearchResults {...defaultProps} total={25} page={3} pageSize={10} />);
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('calls onPageChange when next is clicked', () => {
      const onPageChange = vi.fn();
      render(
        <SearchResults
          {...defaultProps}
          total={25}
          page={1}
          pageSize={10}
          onPageChange={onPageChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange when previous is clicked', () => {
      const onPageChange = vi.fn();
      render(
        <SearchResults
          {...defaultProps}
          total={25}
          page={2}
          pageSize={10}
          onPageChange={onPageChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /previous/i }));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('hides pagination for single page results', () => {
      render(<SearchResults {...defaultProps} total={3} pageSize={10} />);
      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    });
  });

  describe('Result Click', () => {
    it('calls onResultClick when result is clicked', () => {
      const onResultClick = vi.fn();
      render(<SearchResults {...defaultProps} onResultClick={onResultClick} />);

      fireEvent.click(screen.getByTestId('search-result-0').querySelector('button')!);
      expect(onResultClick).toHaveBeenCalledWith(mockResults[0]);
    });
  });

  describe('Term Highlighting', () => {
    it('passes highlightTerms to result cards', () => {
      render(<SearchResults {...defaultProps} highlightTerms={['content']} />);
      // If highlighting is working, the terms will be wrapped in <mark> tags
      expect(screen.getAllByTestId('highlighted-term')).toHaveLength(3);
    });
  });

  describe('Took Time', () => {
    it('displays search timing when provided', () => {
      render(<SearchResults {...defaultProps} tookMs={45} />);
      expect(screen.getByText(/45ms/)).toBeInTheDocument();
    });
  });
});
