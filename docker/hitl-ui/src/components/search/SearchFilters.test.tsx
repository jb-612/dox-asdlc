/**
 * Tests for SearchFilters component (P05-F08 Task 2.4)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchFilters from './SearchFilters';
import type { SearchFilters as SearchFiltersType } from '../../api/types';

describe('SearchFilters', () => {
  const defaultProps = {
    filters: {} as SearchFiltersType,
    onChange: vi.fn(),
  };

  describe('Basic Rendering', () => {
    it('renders filter panel', () => {
      render(<SearchFilters {...defaultProps} />);
      expect(screen.getByTestId('search-filters')).toBeInTheDocument();
    });

    it('renders file type checkboxes', () => {
      render(<SearchFilters {...defaultProps} />);
      expect(screen.getByLabelText('.py')).toBeInTheDocument();
      expect(screen.getByLabelText('.ts')).toBeInTheDocument();
      expect(screen.getByLabelText('.md')).toBeInTheDocument();
    });

    it('renders all default file type options', () => {
      render(<SearchFilters {...defaultProps} />);
      expect(screen.getByLabelText('.py')).toBeInTheDocument();
      expect(screen.getByLabelText('.ts')).toBeInTheDocument();
      expect(screen.getByLabelText('.tsx')).toBeInTheDocument();
      expect(screen.getByLabelText('.md')).toBeInTheDocument();
      expect(screen.getByLabelText('.json')).toBeInTheDocument();
    });

    it('renders date range inputs', () => {
      render(<SearchFilters {...defaultProps} />);
      expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
    });
  });

  describe('File Type Selection', () => {
    it('calls onChange when file type is checked', () => {
      const onChange = vi.fn();
      render(<SearchFilters {...defaultProps} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('.py'));
      expect(onChange).toHaveBeenCalledWith({ fileTypes: ['.py'] });
    });

    it('adds to existing file types', () => {
      const onChange = vi.fn();
      render(
        <SearchFilters
          filters={{ fileTypes: ['.py'] }}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByLabelText('.ts'));
      expect(onChange).toHaveBeenCalledWith({ fileTypes: ['.py', '.ts'] });
    });

    it('removes file type when unchecked', () => {
      const onChange = vi.fn();
      render(
        <SearchFilters
          filters={{ fileTypes: ['.py', '.ts'] }}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByLabelText('.py'));
      expect(onChange).toHaveBeenCalledWith({ fileTypes: ['.ts'] });
    });

    it('shows checked state for selected file types', () => {
      render(<SearchFilters filters={{ fileTypes: ['.py', '.ts'] }} onChange={vi.fn()} />);

      expect(screen.getByLabelText('.py')).toBeChecked();
      expect(screen.getByLabelText('.ts')).toBeChecked();
      expect(screen.getByLabelText('.md')).not.toBeChecked();
    });
  });

  describe('Date Range', () => {
    it('calls onChange when date from is set', () => {
      const onChange = vi.fn();
      render(<SearchFilters {...defaultProps} onChange={onChange} />);

      const fromInput = screen.getByLabelText(/from/i);
      fireEvent.change(fromInput, { target: { value: '2026-01-01' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: '2026-01-01' })
      );
    });

    it('calls onChange when date to is set', () => {
      const onChange = vi.fn();
      render(<SearchFilters {...defaultProps} onChange={onChange} />);

      const toInput = screen.getByLabelText(/to/i);
      fireEvent.change(toInput, { target: { value: '2026-01-31' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ dateTo: '2026-01-31' })
      );
    });

    it('shows existing date values', () => {
      render(
        <SearchFilters
          filters={{ dateFrom: '2026-01-01', dateTo: '2026-01-31' }}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/from/i)).toHaveValue('2026-01-01');
      expect(screen.getByLabelText(/to/i)).toHaveValue('2026-01-31');
    });
  });

  describe('Filter Count Badge', () => {
    it('shows filter count badge when filters are active', () => {
      render(
        <SearchFilters
          filters={{ fileTypes: ['.py', '.ts'], dateFrom: '2026-01-01' }}
          onChange={vi.fn()}
        />
      );

      const badge = screen.getByTestId('filter-count');
      expect(badge).toHaveTextContent('3');
    });

    it('hides filter count when no filters active', () => {
      render(<SearchFilters {...defaultProps} />);
      expect(screen.queryByTestId('filter-count')).not.toBeInTheDocument();
    });

    it('counts file types individually', () => {
      render(
        <SearchFilters
          filters={{ fileTypes: ['.py', '.ts', '.md'] }}
          onChange={vi.fn()}
        />
      );

      const badge = screen.getByTestId('filter-count');
      expect(badge).toHaveTextContent('3');
    });
  });

  describe('Clear Filters', () => {
    it('shows clear button when filters are active', () => {
      render(
        <SearchFilters
          filters={{ fileTypes: ['.py'] }}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('clears all filters when clear button is clicked', () => {
      const onChange = vi.fn();
      render(
        <SearchFilters
          filters={{ fileTypes: ['.py', '.ts'], dateFrom: '2026-01-01' }}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /clear/i }));
      expect(onChange).toHaveBeenCalledWith({});
    });

    it('hides clear button when no filters active', () => {
      render(<SearchFilters {...defaultProps} />);
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });
  });

  describe('Collapsible Panel', () => {
    it('shows expanded state by default', () => {
      render(<SearchFilters {...defaultProps} />);
      // Check that filter options are visible
      expect(screen.getByLabelText('.py')).toBeVisible();
    });

    it('respects isExpanded prop', () => {
      render(<SearchFilters {...defaultProps} isExpanded={false} />);
      // When collapsed, the filter content should still be in the DOM but not visible
      const filtersContent = screen.getByTestId('filters-content');
      expect(filtersContent).toHaveClass('hidden');
    });
  });

  describe('Custom File Types', () => {
    it('uses availableFileTypes prop when provided', () => {
      render(
        <SearchFilters
          {...defaultProps}
          availableFileTypes={['.py', '.go', '.rs']}
        />
      );

      expect(screen.getByLabelText('.py')).toBeInTheDocument();
      expect(screen.getByLabelText('.go')).toBeInTheDocument();
      expect(screen.getByLabelText('.rs')).toBeInTheDocument();
      expect(screen.queryByLabelText('.ts')).not.toBeInTheDocument();
    });
  });
});
