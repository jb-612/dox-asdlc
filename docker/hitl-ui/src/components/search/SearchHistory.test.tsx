/**
 * Tests for SearchHistory component (P05-F08 Task 2.6)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SearchHistory from './SearchHistory';
import type { SavedSearch } from '../../api/types';

describe('SearchHistory', () => {
  const mockRecent: SavedSearch[] = [
    {
      id: '1',
      query: 'test query',
      timestamp: new Date().toISOString(),
      isFavorite: false,
    },
    {
      id: '2',
      query: 'another query',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      isFavorite: false,
    },
  ];

  const mockFavorites: SavedSearch[] = [
    {
      id: '3',
      query: 'favorite query',
      timestamp: new Date().toISOString(),
      isFavorite: true,
    },
  ];

  const defaultProps = {
    recentSearches: mockRecent,
    favoriteSearches: mockFavorites,
    onSelect: vi.fn(),
    onToggleFavorite: vi.fn(),
    onClearHistory: vi.fn(),
  };

  describe('Basic Rendering', () => {
    it('renders search history panel', () => {
      render(<SearchHistory {...defaultProps} />);
      expect(screen.getByTestId('search-history')).toBeInTheDocument();
    });

    it('renders recent searches', () => {
      render(<SearchHistory {...defaultProps} />);
      expect(screen.getByText('test query')).toBeInTheDocument();
      expect(screen.getByText('another query')).toBeInTheDocument();
    });

    it('renders favorite searches', () => {
      render(<SearchHistory {...defaultProps} />);
      expect(screen.getByText('favorite query')).toBeInTheDocument();
    });
  });

  describe('Section Order', () => {
    it('renders favorites above recent', () => {
      render(<SearchHistory {...defaultProps} />);
      const sections = screen.getAllByRole('region');

      // Favorites should come before Recent
      expect(sections[0]).toHaveAttribute('aria-label', 'Favorites');
      expect(sections[1]).toHaveAttribute('aria-label', 'Recent');
    });

    it('hides favorites section when empty', () => {
      render(<SearchHistory {...defaultProps} favoriteSearches={[]} />);
      expect(screen.queryByRole('region', { name: 'Favorites' })).not.toBeInTheDocument();
    });

    it('hides recent section when empty', () => {
      render(<SearchHistory {...defaultProps} recentSearches={[]} />);
      expect(screen.queryByRole('region', { name: 'Recent' })).not.toBeInTheDocument();
    });
  });

  describe('Search Selection', () => {
    it('calls onSelect when recent item is clicked', () => {
      const onSelect = vi.fn();
      render(<SearchHistory {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('test query'));
      expect(onSelect).toHaveBeenCalledWith(mockRecent[0]);
    });

    it('calls onSelect when favorite item is clicked', () => {
      const onSelect = vi.fn();
      render(<SearchHistory {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('favorite query'));
      expect(onSelect).toHaveBeenCalledWith(mockFavorites[0]);
    });
  });

  describe('Favorite Toggle', () => {
    it('renders star buttons for each search', () => {
      render(<SearchHistory {...defaultProps} />);
      const starButtons = screen.getAllByTestId('star-button');
      // 2 recent + 1 favorite
      expect(starButtons).toHaveLength(3);
    });

    it('calls onToggleFavorite when star is clicked', () => {
      const onToggleFavorite = vi.fn();
      render(<SearchHistory {...defaultProps} onToggleFavorite={onToggleFavorite} />);

      const starButtons = screen.getAllByTestId('star-button');
      fireEvent.click(starButtons[0]);
      expect(onToggleFavorite).toHaveBeenCalledWith('3'); // First one is the favorite
    });

    it('shows filled star for favorites', () => {
      render(<SearchHistory {...defaultProps} />);
      const favoriteSection = screen.getByRole('region', { name: 'Favorites' });
      const starButton = within(favoriteSection).getByTestId('star-button');
      expect(starButton).toHaveAttribute('data-filled', 'true');
    });

    it('shows outline star for non-favorites', () => {
      render(<SearchHistory {...defaultProps} />);
      const recentSection = screen.getByRole('region', { name: 'Recent' });
      const starButtons = within(recentSection).getAllByTestId('star-button');
      expect(starButtons[0]).toHaveAttribute('data-filled', 'false');
    });
  });

  describe('Clear History', () => {
    it('shows clear history button', () => {
      render(<SearchHistory {...defaultProps} />);
      expect(screen.getByRole('button', { name: /clear history/i })).toBeInTheDocument();
    });

    it('calls onClearHistory when clear button is clicked', () => {
      const onClearHistory = vi.fn();
      render(<SearchHistory {...defaultProps} onClearHistory={onClearHistory} />);

      fireEvent.click(screen.getByRole('button', { name: /clear history/i }));
      expect(onClearHistory).toHaveBeenCalled();
    });

    it('hides clear button when no recent searches', () => {
      render(<SearchHistory {...defaultProps} recentSearches={[]} />);
      expect(screen.queryByRole('button', { name: /clear history/i })).not.toBeInTheDocument();
    });
  });

  describe('Timestamps', () => {
    it('shows relative timestamp for each search', () => {
      render(<SearchHistory {...defaultProps} />);
      // Should show relative times like "just now", "1 hour ago"
      // Note: Multiple items can have "just now" so use getAllByText
      const justNowElements = screen.getAllByText(/just now/i);
      expect(justNowElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/hour ago/i)).toBeInTheDocument();
    });
  });

  describe('Max Recent Limit', () => {
    it('respects maxRecent prop', () => {
      const manyRecent = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        query: `query ${i}`,
        timestamp: new Date().toISOString(),
        isFavorite: false,
      }));

      render(
        <SearchHistory
          {...defaultProps}
          recentSearches={manyRecent}
          maxRecent={5}
        />
      );

      const recentSection = screen.getByRole('region', { name: 'Recent' });
      const items = within(recentSection).getAllByTestId('history-item');
      expect(items).toHaveLength(5);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no searches', () => {
      render(
        <SearchHistory
          {...defaultProps}
          recentSearches={[]}
          favoriteSearches={[]}
        />
      );
      expect(screen.getByText(/no recent searches/i)).toBeInTheDocument();
    });
  });

  describe('Filter Display', () => {
    it('shows filter indicator for searches with filters', () => {
      const searchWithFilters: SavedSearch[] = [
        {
          id: '4',
          query: 'filtered query',
          filters: { fileTypes: ['.py'] },
          timestamp: new Date().toISOString(),
          isFavorite: false,
        },
      ];

      render(<SearchHistory {...defaultProps} recentSearches={searchWithFilters} />);
      expect(screen.getByTestId('filter-indicator')).toBeInTheDocument();
    });
  });
});
