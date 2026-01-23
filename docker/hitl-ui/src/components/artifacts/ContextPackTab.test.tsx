/**
 * Tests for ContextPackTab component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ContextPackTab, { type ContextPackData } from './ContextPackTab';

describe('ContextPackTab', () => {
  const defaultContextPack: ContextPackData = {
    createdAt: '2026-01-23T10:00:00Z',
    totalTokens: 12500,
    costPerToken: 0.00001,
    files: [
      { path: 'src/core/interfaces.py', tokens: 3200, relevance: 0.95, type: 'code' },
      { path: 'docs/design.md', tokens: 2800, relevance: 0.88, type: 'markdown' },
      { path: 'config/settings.yaml', tokens: 450, relevance: 0.75, type: 'config' },
      { path: 'src/utils/helpers.py', tokens: 1800, relevance: 0.65, type: 'code' },
      { path: 'README.md', tokens: 1200, relevance: 0.55, type: 'markdown' },
      { path: 'requirements.txt', tokens: 150, relevance: 0.4, type: 'other' },
    ],
    breakdown: {
      code: 5000,
      markdown: 4000,
      config: 450,
      other: 3050,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('context-pack-tab')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ContextPackTab contextPack={defaultContextPack} className="my-custom-class" />);
      expect(screen.getByTestId('context-pack-tab')).toHaveClass('my-custom-class');
    });

    it('renders header title', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByText(/context pack/i)).toBeInTheDocument();
    });
  });

  describe('Creation Context', () => {
    it('displays snapshot timestamp', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('snapshot-time')).toBeInTheDocument();
    });

    it('shows creation context label', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByText(/snapshot/i)).toBeInTheDocument();
    });
  });

  describe('Token Summary', () => {
    it('displays total token count', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('total-tokens')).toHaveTextContent('12,500');
    });

    it('displays file count', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('file-count')).toHaveTextContent('6');
    });

    it('displays estimated cost', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('estimated-cost')).toHaveTextContent('$0.13');
    });
  });

  describe('Token Breakdown', () => {
    it('displays breakdown section', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('token-breakdown')).toBeInTheDocument();
    });

    it('shows tokens by type', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      const breakdown = screen.getByTestId('token-breakdown');
      expect(within(breakdown).getByTestId('breakdown-code')).toHaveTextContent('5,000');
      expect(within(breakdown).getByTestId('breakdown-markdown')).toHaveTextContent('4,000');
      expect(within(breakdown).getByTestId('breakdown-config')).toHaveTextContent('450');
      expect(within(breakdown).getByTestId('breakdown-other')).toHaveTextContent('3,050');
    });

    it('shows percentage for each type', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      const breakdown = screen.getByTestId('token-breakdown');
      // code: 5000/12500 = 40%
      expect(within(breakdown).getByTestId('percent-code')).toHaveTextContent('40%');
    });
  });

  describe('File List', () => {
    it('displays all files', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('file-src/core/interfaces.py')).toBeInTheDocument();
      expect(screen.getByTestId('file-docs/design.md')).toBeInTheDocument();
      expect(screen.getByTestId('file-config/settings.yaml')).toBeInTheDocument();
    });

    it('shows file paths', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByText('src/core/interfaces.py')).toBeInTheDocument();
    });

    it('shows token count per file', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      const file = screen.getByTestId('file-src/core/interfaces.py');
      expect(within(file).getByTestId('file-tokens')).toHaveTextContent('3,200');
    });

    it('shows relevance score per file', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      const file = screen.getByTestId('file-src/core/interfaces.py');
      expect(within(file).getByTestId('file-relevance')).toHaveTextContent('95%');
    });

    it('shows file type icon', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      const file = screen.getByTestId('file-src/core/interfaces.py');
      expect(within(file).getByTestId('file-icon')).toBeInTheDocument();
    });

    it('sorts files by relevance by default', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      const fileList = screen.getByTestId('file-list');
      const files = within(fileList).getAllByTestId(/^file-/);
      // First file should be highest relevance (interfaces.py at 95%)
      expect(files[0]).toHaveAttribute('data-testid', 'file-src/core/interfaces.py');
    });
  });

  describe('Sorting', () => {
    it('shows sort dropdown', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('sort-dropdown')).toBeInTheDocument();
    });

    it('can sort by tokens', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);

      fireEvent.click(screen.getByTestId('sort-dropdown'));
      fireEvent.click(screen.getByTestId('sort-tokens'));

      const fileList = screen.getByTestId('file-list');
      const files = within(fileList).getAllByTestId(/^file-/);
      // First file should be highest tokens (interfaces.py at 3200)
      expect(files[0]).toHaveAttribute('data-testid', 'file-src/core/interfaces.py');
    });

    it('can sort by path', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);

      fireEvent.click(screen.getByTestId('sort-dropdown'));
      fireEvent.click(screen.getByTestId('sort-path'));

      const fileList = screen.getByTestId('file-list');
      const files = within(fileList).getAllByTestId(/^file-/);
      // First file alphabetically with localeCompare is config/settings.yaml
      expect(files[0]).toHaveAttribute('data-testid', 'file-config/settings.yaml');
    });
  });

  describe('Regenerate Action', () => {
    it('shows regenerate button', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('regenerate-btn')).toBeInTheDocument();
    });

    it('calls onRegenerate when clicked', () => {
      const onRegenerate = vi.fn();
      render(<ContextPackTab contextPack={defaultContextPack} onRegenerate={onRegenerate} />);

      fireEvent.click(screen.getByTestId('regenerate-btn'));

      expect(onRegenerate).toHaveBeenCalled();
    });

    it('shows regenerate button text', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByText(/regenerate with current context/i)).toBeInTheDocument();
    });

    it('disables button when isRegenerating is true', () => {
      render(<ContextPackTab contextPack={defaultContextPack} isRegenerating />);
      expect(screen.getByTestId('regenerate-btn')).toBeDisabled();
    });

    it('shows loading state when regenerating', () => {
      render(<ContextPackTab contextPack={defaultContextPack} isRegenerating />);
      expect(screen.getByText(/regenerating/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no context pack', () => {
      render(<ContextPackTab contextPack={null} />);
      expect(screen.getByText(/no context pack/i)).toBeInTheDocument();
    });

    it('shows empty state when files array is empty', () => {
      const emptyPack = { ...defaultContextPack, files: [] };
      render(<ContextPackTab contextPack={emptyPack} />);
      expect(screen.getByText(/no files/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<ContextPackTab contextPack={defaultContextPack} isLoading />);
      expect(screen.getByTestId('context-pack-loading')).toBeInTheDocument();
    });

    it('shows skeleton items when loading', () => {
      render(<ContextPackTab contextPack={defaultContextPack} isLoading />);
      expect(screen.getAllByTestId('skeleton-item').length).toBeGreaterThan(0);
    });
  });

  describe('Collapsible File List', () => {
    it('shows expand/collapse toggle', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);
      expect(screen.getByTestId('toggle-files')).toBeInTheDocument();
    });

    it('collapses file list when toggled', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);

      // Initially expanded
      expect(screen.getByTestId('file-list')).toBeInTheDocument();

      // Toggle collapse
      fireEvent.click(screen.getByTestId('toggle-files'));

      expect(screen.queryByTestId('file-list')).not.toBeInTheDocument();
    });

    it('expands file list when toggled again', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);

      // Collapse
      fireEvent.click(screen.getByTestId('toggle-files'));
      expect(screen.queryByTestId('file-list')).not.toBeInTheDocument();

      // Expand
      fireEvent.click(screen.getByTestId('toggle-files'));
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('regenerate button is keyboard accessible', () => {
      const onRegenerate = vi.fn();
      render(<ContextPackTab contextPack={defaultContextPack} onRegenerate={onRegenerate} />);

      const btn = screen.getByTestId('regenerate-btn');
      fireEvent.keyDown(btn, { key: 'Enter' });

      expect(onRegenerate).toHaveBeenCalled();
    });

    it('sort dropdown is keyboard accessible', () => {
      render(<ContextPackTab contextPack={defaultContextPack} />);

      const dropdown = screen.getByTestId('sort-dropdown');
      fireEvent.keyDown(dropdown, { key: 'Enter' });

      expect(screen.getByTestId('sort-tokens')).toBeInTheDocument();
    });
  });
});
