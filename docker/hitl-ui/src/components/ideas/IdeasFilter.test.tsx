/**
 * Tests for IdeasFilter component (P08-F03 T18)
 *
 * Tests classification filtering functionality including:
 * - Classification dropdown with counts
 * - Integration with existing filters (status, search)
 * - Clear filter functionality
 * - Count per classification display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdeasFilter } from './IdeasFilter';
import type { IdeaFilters } from '../../types/ideas';

// Mock classification counts
const mockCounts = {
  functional: 15,
  non_functional: 8,
  undetermined: 3,
  total: 26,
};

describe('IdeasFilter', () => {
  const defaultProps = {
    filters: {} as IdeaFilters,
    onFiltersChange: vi.fn(),
    onClearFilters: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with data-testid', () => {
      render(<IdeasFilter {...defaultProps} />);
      expect(screen.getByTestId('ideas-filter')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<IdeasFilter {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search ideas...')).toBeInTheDocument();
    });

    it('renders status filter dropdown', () => {
      render(<IdeasFilter {...defaultProps} />);
      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    });

    it('renders classification filter dropdown', () => {
      render(<IdeasFilter {...defaultProps} />);
      expect(screen.getByLabelText('Filter by classification')).toBeInTheDocument();
    });
  });

  describe('Classification Dropdown', () => {
    it('shows All Types option by default', () => {
      render(<IdeasFilter {...defaultProps} />);
      const select = screen.getByLabelText('Filter by classification');
      expect(select).toHaveValue('');
    });

    it('shows all classification options', () => {
      render(<IdeasFilter {...defaultProps} />);
      const select = screen.getByLabelText('Filter by classification');

      expect(select.querySelector('option[value=""]')).toHaveTextContent('All Types');
      expect(select.querySelector('option[value="functional"]')).toHaveTextContent('Functional');
      expect(
        select.querySelector('option[value="non_functional"]')
      ).toHaveTextContent('Non-Functional');
      expect(
        select.querySelector('option[value="undetermined"]')
      ).toHaveTextContent('Undetermined');
    });

    it('shows counts when classificationCounts provided', () => {
      render(<IdeasFilter {...defaultProps} classificationCounts={mockCounts} />);
      const select = screen.getByLabelText('Filter by classification');

      expect(select.querySelector('option[value=""]')).toHaveTextContent('All Types (26)');
      expect(select.querySelector('option[value="functional"]')).toHaveTextContent(
        'Functional (15)'
      );
      expect(select.querySelector('option[value="non_functional"]')).toHaveTextContent(
        'Non-Functional (8)'
      );
      expect(select.querySelector('option[value="undetermined"]')).toHaveTextContent(
        'Undetermined (3)'
      );
    });

    it('calls onFiltersChange when classification selected', () => {
      const onFiltersChange = vi.fn();
      render(<IdeasFilter {...defaultProps} onFiltersChange={onFiltersChange} />);

      const select = screen.getByLabelText('Filter by classification');
      fireEvent.change(select, { target: { value: 'functional' } });

      expect(onFiltersChange).toHaveBeenCalledWith({ classification: 'functional' });
    });

    it('clears classification when All Types selected', () => {
      const onFiltersChange = vi.fn();
      render(
        <IdeasFilter
          {...defaultProps}
          filters={{ classification: 'functional' }}
          onFiltersChange={onFiltersChange}
        />
      );

      const select = screen.getByLabelText('Filter by classification');
      fireEvent.change(select, { target: { value: '' } });

      expect(onFiltersChange).toHaveBeenCalledWith({ classification: undefined });
    });

    it('shows selected classification', () => {
      render(<IdeasFilter {...defaultProps} filters={{ classification: 'non_functional' }} />);
      const select = screen.getByLabelText('Filter by classification');
      expect(select).toHaveValue('non_functional');
    });
  });

  describe('Status Dropdown', () => {
    it('shows all status options', () => {
      render(<IdeasFilter {...defaultProps} />);
      const select = screen.getByLabelText('Filter by status');

      expect(select.querySelector('option[value=""]')).toHaveTextContent('All Status');
      expect(select.querySelector('option[value="active"]')).toHaveTextContent('Active');
      expect(select.querySelector('option[value="archived"]')).toHaveTextContent('Archived');
    });

    it('calls onFiltersChange when status selected', () => {
      const onFiltersChange = vi.fn();
      render(<IdeasFilter {...defaultProps} onFiltersChange={onFiltersChange} />);

      const select = screen.getByLabelText('Filter by status');
      fireEvent.change(select, { target: { value: 'active' } });

      expect(onFiltersChange).toHaveBeenCalledWith({ status: 'active' });
    });

    it('shows selected status', () => {
      render(<IdeasFilter {...defaultProps} filters={{ status: 'archived' }} />);
      const select = screen.getByLabelText('Filter by status');
      expect(select).toHaveValue('archived');
    });
  });

  describe('Search Input', () => {
    it('shows current search value', () => {
      render(<IdeasFilter {...defaultProps} filters={{ search: 'dark mode' }} />);
      const input = screen.getByPlaceholderText('Search ideas...');
      expect(input).toHaveValue('dark mode');
    });

    it('calls onFiltersChange when search changes', () => {
      const onFiltersChange = vi.fn();
      render(<IdeasFilter {...defaultProps} onFiltersChange={onFiltersChange} />);

      const input = screen.getByPlaceholderText('Search ideas...');
      fireEvent.change(input, { target: { value: 'test query' } });

      expect(onFiltersChange).toHaveBeenCalledWith({ search: 'test query' });
    });

    it('clears search when input emptied', () => {
      const onFiltersChange = vi.fn();
      render(
        <IdeasFilter
          {...defaultProps}
          filters={{ search: 'existing' }}
          onFiltersChange={onFiltersChange}
        />
      );

      const input = screen.getByPlaceholderText('Search ideas...');
      fireEvent.change(input, { target: { value: '' } });

      expect(onFiltersChange).toHaveBeenCalledWith({ search: undefined });
    });

    it('has search icon', () => {
      render(<IdeasFilter {...defaultProps} />);
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });
  });

  describe('Clear Filters Button', () => {
    it('does not show clear button when no filters active', () => {
      render(<IdeasFilter {...defaultProps} filters={{}} />);
      expect(screen.queryByTestId('clear-filters-button')).not.toBeInTheDocument();
    });

    it('shows clear button when classification filter active', () => {
      render(<IdeasFilter {...defaultProps} filters={{ classification: 'functional' }} />);
      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument();
    });

    it('shows clear button when status filter active', () => {
      render(<IdeasFilter {...defaultProps} filters={{ status: 'active' }} />);
      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument();
    });

    it('shows clear button when search filter active', () => {
      render(<IdeasFilter {...defaultProps} filters={{ search: 'query' }} />);
      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument();
    });

    it('calls onClearFilters when clear button clicked', () => {
      const onClearFilters = vi.fn();
      render(
        <IdeasFilter
          {...defaultProps}
          filters={{ classification: 'functional' }}
          onClearFilters={onClearFilters}
        />
      );

      fireEvent.click(screen.getByTestId('clear-filters-button'));
      expect(onClearFilters).toHaveBeenCalled();
    });

    it('has accessible label', () => {
      render(<IdeasFilter {...defaultProps} filters={{ search: 'test' }} />);
      expect(screen.getByLabelText('Clear filters')).toBeInTheDocument();
    });
  });

  describe('Filter Integration', () => {
    it('supports multiple active filters', () => {
      render(
        <IdeasFilter
          {...defaultProps}
          filters={{
            classification: 'functional',
            status: 'active',
            search: 'test',
          }}
        />
      );

      expect(screen.getByLabelText('Filter by classification')).toHaveValue('functional');
      expect(screen.getByLabelText('Filter by status')).toHaveValue('active');
      expect(screen.getByPlaceholderText('Search ideas...')).toHaveValue('test');
      expect(screen.getByTestId('clear-filters-button')).toBeInTheDocument();
    });

    it('preserves other filters when changing one', () => {
      const onFiltersChange = vi.fn();
      render(
        <IdeasFilter
          {...defaultProps}
          filters={{ classification: 'functional', status: 'active' }}
          onFiltersChange={onFiltersChange}
        />
      );

      const classificationSelect = screen.getByLabelText('Filter by classification');
      fireEvent.change(classificationSelect, { target: { value: 'non_functional' } });

      // Should only pass the changed filter value
      expect(onFiltersChange).toHaveBeenCalledWith({ classification: 'non_functional' });
    });
  });

  describe('Loading State', () => {
    it('disables inputs when loading', () => {
      render(<IdeasFilter {...defaultProps} isLoading />);

      expect(screen.getByPlaceholderText('Search ideas...')).toBeDisabled();
      expect(screen.getByLabelText('Filter by status')).toBeDisabled();
      expect(screen.getByLabelText('Filter by classification')).toBeDisabled();
    });

    it('shows loading indicator', () => {
      render(<IdeasFilter {...defaultProps} isLoading />);
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on inputs', () => {
      render(<IdeasFilter {...defaultProps} />);

      expect(screen.getByLabelText('Search ideas')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by classification')).toBeInTheDocument();
    });

    it('has focusable elements in correct order', () => {
      render(<IdeasFilter {...defaultProps} filters={{ search: 'test' }} />);

      const search = screen.getByPlaceholderText('Search ideas...');
      const status = screen.getByLabelText('Filter by status');
      const classification = screen.getByLabelText('Filter by classification');
      const clear = screen.getByTestId('clear-filters-button');

      expect(search).toHaveAttribute('tabIndex', '0');
      expect(status).not.toHaveAttribute('tabIndex', '-1');
      expect(classification).not.toHaveAttribute('tabIndex', '-1');
      expect(clear).not.toHaveAttribute('tabIndex', '-1');
    });
  });
});
