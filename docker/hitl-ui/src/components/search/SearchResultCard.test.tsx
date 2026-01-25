/**
 * Tests for SearchResultCard component (P05-F08 Task 2.2)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchResultCard from './SearchResultCard';
import type { KSSearchResult } from '../../api/types';

describe('SearchResultCard', () => {
  const mockResult: KSSearchResult = {
    docId: 'src/core/interfaces.py:14',
    content: 'class KnowledgeStore(Protocol):',
    metadata: {
      file_path: 'src/core/interfaces.py',
      file_type: '.py',
      language: 'python',
      line_start: 14,
      line_end: 42,
      indexed_at: '2026-01-25T10:00:00Z',
    },
    score: 0.95,
    source: 'mock',
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<SearchResultCard result={mockResult} />);
      expect(screen.getByTestId('search-result-card')).toBeInTheDocument();
    });

    it('displays file path', () => {
      render(<SearchResultCard result={mockResult} />);
      expect(screen.getByText('src/core/interfaces.py')).toBeInTheDocument();
    });

    it('displays line range', () => {
      render(<SearchResultCard result={mockResult} />);
      expect(screen.getByText(/14-42/)).toBeInTheDocument();
    });

    it('displays score as percentage', () => {
      render(<SearchResultCard result={mockResult} />);
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('displays content preview', () => {
      render(<SearchResultCard result={mockResult} />);
      expect(screen.getByText(/class KnowledgeStore/)).toBeInTheDocument();
    });

    it('displays language tag', () => {
      render(<SearchResultCard result={mockResult} />);
      expect(screen.getByText('python')).toBeInTheDocument();
    });
  });

  describe('Term Highlighting', () => {
    it('highlights search terms in content', () => {
      render(
        <SearchResultCard
          result={mockResult}
          highlightTerms={['KnowledgeStore']}
        />
      );
      const highlightedText = screen.getByTestId('highlighted-term');
      expect(highlightedText).toHaveTextContent('KnowledgeStore');
      expect(highlightedText.tagName).toBe('MARK');
    });

    it('highlights multiple terms', () => {
      const multiWordResult: KSSearchResult = {
        ...mockResult,
        content: 'class KnowledgeStore implements Protocol for search',
      };
      render(
        <SearchResultCard
          result={multiWordResult}
          highlightTerms={['KnowledgeStore', 'Protocol']}
        />
      );
      const highlights = screen.getAllByTestId('highlighted-term');
      expect(highlights.length).toBeGreaterThanOrEqual(2);
    });

    it('highlights case-insensitively', () => {
      render(
        <SearchResultCard
          result={mockResult}
          highlightTerms={['knowledgestore']}
        />
      );
      expect(screen.getByTestId('highlighted-term')).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when card is clicked', () => {
      const onClick = vi.fn();
      render(<SearchResultCard result={mockResult} onClick={onClick} />);

      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalled();
    });

    it('is focusable', () => {
      render(<SearchResultCard result={mockResult} onClick={vi.fn()} />);
      const card = screen.getByRole('button');
      card.focus();
      expect(card).toHaveFocus();
    });
  });

  describe('File Type Icons', () => {
    it('shows Python icon for .py files', () => {
      render(<SearchResultCard result={mockResult} />);
      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    });

    it('shows TypeScript icon for .ts files', () => {
      const tsResult: KSSearchResult = {
        ...mockResult,
        metadata: { ...mockResult.metadata, file_type: '.ts', language: 'typescript' },
      };
      render(<SearchResultCard result={tsResult} />);
      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    });

    it('shows Markdown icon for .md files', () => {
      const mdResult: KSSearchResult = {
        ...mockResult,
        metadata: { ...mockResult.metadata, file_type: '.md', language: 'markdown' },
      };
      render(<SearchResultCard result={mdResult} />);
      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    });
  });

  describe('Score Badge', () => {
    it('shows high score with green color', () => {
      render(<SearchResultCard result={mockResult} />);
      const badge = screen.getByTestId('score-badge');
      expect(badge).toHaveClass('bg-green-500/20');
    });

    it('shows medium score with yellow color', () => {
      const mediumResult: KSSearchResult = { ...mockResult, score: 0.65 };
      render(<SearchResultCard result={mediumResult} />);
      const badge = screen.getByTestId('score-badge');
      expect(badge).toHaveClass('bg-yellow-500/20');
    });

    it('shows low score with red color', () => {
      const lowResult: KSSearchResult = { ...mockResult, score: 0.35 };
      render(<SearchResultCard result={lowResult} />);
      const badge = screen.getByTestId('score-badge');
      expect(badge).toHaveClass('bg-red-500/20');
    });
  });

  describe('Edge Cases', () => {
    it('handles missing line numbers', () => {
      const noLinesResult: KSSearchResult = {
        ...mockResult,
        metadata: { file_path: 'test.py', file_type: '.py' },
      };
      render(<SearchResultCard result={noLinesResult} />);
      expect(screen.queryByText(/\d+-\d+/)).not.toBeInTheDocument();
    });

    it('handles missing language', () => {
      const noLangResult: KSSearchResult = {
        ...mockResult,
        metadata: { file_path: 'test.py', file_type: '.py' },
      };
      render(<SearchResultCard result={noLangResult} />);
      expect(screen.queryByText('python')).not.toBeInTheDocument();
    });

    it('truncates long content', () => {
      const longResult: KSSearchResult = {
        ...mockResult,
        content: 'a'.repeat(500),
      };
      render(<SearchResultCard result={longResult} />);
      const content = screen.getByTestId('content-preview');
      expect(content.textContent?.length).toBeLessThan(400);
    });
  });
});
