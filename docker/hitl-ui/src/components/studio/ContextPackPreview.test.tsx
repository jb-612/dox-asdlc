/**
 * Tests for ContextPackPreview component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContextPackPreview, { type ContextPackFile } from './ContextPackPreview';

describe('ContextPackPreview', () => {
  const defaultFiles: ContextPackFile[] = [
    { path: 'src/main.ts', tokens: 500, relevance: 0.95, type: 'code' },
    { path: 'docs/README.md', tokens: 200, relevance: 0.85, type: 'markdown' },
    { path: 'package.json', tokens: 100, relevance: 0.75, type: 'config' },
    { path: 'tests/main.test.ts', tokens: 300, relevance: 0.70, type: 'code' },
    { path: 'src/utils.ts', tokens: 150, relevance: 0.65, type: 'code' },
  ];

  const defaultCostPerToken = 0.00003;

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      expect(screen.getByTestId('context-pack-preview')).toBeInTheDocument();
    });

    it('renders panel title', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      expect(screen.getByText(/context pack/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <ContextPackPreview
          files={defaultFiles}
          costPerToken={defaultCostPerToken}
          className="my-custom-class"
        />
      );
      expect(screen.getByTestId('context-pack-preview')).toHaveClass('my-custom-class');
    });
  });

  describe('File List', () => {
    it('displays all files', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      expect(screen.getByText('src/main.ts')).toBeInTheDocument();
      expect(screen.getByText('docs/README.md')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    it('displays file count', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      expect(screen.getByTestId('file-count')).toHaveTextContent('5');
    });

    it('shows token count per file', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      const file = screen.getByTestId('file-src/main.ts');
      expect(file).toHaveTextContent('500');
    });

    it('shows relevance score per file', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      const file = screen.getByTestId('file-src/main.ts');
      expect(file).toHaveTextContent('95%');
    });

    it('shows file type icon', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      const file = screen.getByTestId('file-src/main.ts');
      expect(file.querySelector('[data-testid="file-icon-code"]')).toBeInTheDocument();
    });
  });

  describe('Token Count Breakdown', () => {
    it('displays total token count', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      // 500 + 200 + 100 + 300 + 150 = 1250
      expect(screen.getByTestId('total-tokens')).toHaveTextContent('1,250');
    });

    it('shows breakdown by file type', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} showBreakdown />);
      expect(screen.getByTestId('tokens-code')).toBeInTheDocument();
      expect(screen.getByTestId('tokens-markdown')).toBeInTheDocument();
    });

    it('calculates code tokens correctly', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} showBreakdown />);
      // 500 + 300 + 150 = 950
      expect(screen.getByTestId('tokens-code')).toHaveTextContent('950');
    });
  });

  describe('Cost Estimate', () => {
    it('displays cost estimate', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      expect(screen.getByTestId('cost-estimate')).toBeInTheDocument();
    });

    it('calculates cost correctly', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      // 1250 * 0.00003 = 0.0375
      expect(screen.getByTestId('cost-estimate')).toHaveTextContent('$0.04');
    });

    it('updates cost when files change', () => {
      const { rerender } = render(
        <ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />
      );

      const moreFiles = [...defaultFiles, { path: 'extra.ts', tokens: 750, relevance: 0.5, type: 'code' }];
      rerender(<ContextPackPreview files={moreFiles} costPerToken={defaultCostPerToken} />);

      // 2000 * 0.00003 = 0.06
      expect(screen.getByTestId('cost-estimate')).toHaveTextContent('$0.06');
    });
  });

  describe('Sort Options', () => {
    it('shows sort dropdown', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      expect(screen.getByTestId('sort-dropdown')).toBeInTheDocument();
    });

    it('sorts by relevance by default', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      // Use regex that excludes file-count and file-icon-* and file-skeleton
      const fileItems = screen.getAllByTestId(/^file-[a-z]+\//);
      expect(fileItems[0]).toHaveAttribute('data-testid', 'file-src/main.ts'); // 95% relevance
    });

    it('can sort by tokens', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);

      fireEvent.click(screen.getByTestId('sort-dropdown'));
      fireEvent.click(screen.getByTestId('sort-tokens'));

      const fileItems = screen.getAllByTestId(/^file-[a-z]+\//);
      expect(fileItems[0]).toHaveAttribute('data-testid', 'file-src/main.ts'); // 500 tokens
    });

    it('can sort by path', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);

      fireEvent.click(screen.getByTestId('sort-dropdown'));
      fireEvent.click(screen.getByTestId('sort-path'));

      const fileItems = screen.getAllByTestId(/^file-[a-z]+\//);
      expect(fileItems[0]).toHaveAttribute('data-testid', 'file-docs/README.md'); // alphabetically first
    });
  });

  describe('Add to Session Action', () => {
    it('shows Add to session button', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      expect(screen.getByRole('button', { name: /add to session/i })).toBeInTheDocument();
    });

    it('calls onAddToSession when clicked', () => {
      const onAdd = vi.fn();
      render(
        <ContextPackPreview
          files={defaultFiles}
          costPerToken={defaultCostPerToken}
          onAddToSession={onAdd}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /add to session/i }));

      expect(onAdd).toHaveBeenCalled();
    });

    it('button is disabled when no files', () => {
      render(<ContextPackPreview files={[]} costPerToken={defaultCostPerToken} />);
      expect(screen.getByRole('button', { name: /add to session/i })).toBeDisabled();
    });
  });

  describe('File Selection', () => {
    it('allows selecting individual files', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} selectable />);
      expect(screen.getByTestId('select-src/main.ts')).toBeInTheDocument();
    });

    it('toggles file selection on click', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} selectable />);

      // Files start selected by default
      expect(screen.getByTestId('select-src/main.ts')).toBeChecked();

      // Clicking unchecks
      fireEvent.click(screen.getByTestId('select-src/main.ts'));
      expect(screen.getByTestId('select-src/main.ts')).not.toBeChecked();

      // Clicking again re-checks
      fireEvent.click(screen.getByTestId('select-src/main.ts'));
      expect(screen.getByTestId('select-src/main.ts')).toBeChecked();
    });

    it('updates token count when files deselected', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} selectable />);

      // Deselect file with 500 tokens
      fireEvent.click(screen.getByTestId('select-src/main.ts'));

      // New total should be 1250 - 500 = 750
      expect(screen.getByTestId('total-tokens')).toHaveTextContent('750');
    });

    it('calls onSelectionChange when selection changes', () => {
      const onChange = vi.fn();
      render(
        <ContextPackPreview
          files={defaultFiles}
          costPerToken={defaultCostPerToken}
          selectable
          onSelectionChange={onChange}
        />
      );

      fireEvent.click(screen.getByTestId('select-src/main.ts'));

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('shows message when no files', () => {
      render(<ContextPackPreview files={[]} costPerToken={defaultCostPerToken} />);
      expect(screen.getByText(/no files/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} isLoading />);
      expect(screen.getByTestId('context-pack-loading')).toBeInTheDocument();
    });

    it('shows skeleton rows when loading', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} isLoading />);
      expect(screen.getAllByTestId('file-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper heading', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} />);
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('checkboxes have accessible labels', () => {
      render(<ContextPackPreview files={defaultFiles} costPerToken={defaultCostPerToken} selectable />);
      const checkbox = screen.getByTestId('select-src/main.ts');
      expect(checkbox).toHaveAttribute('aria-label');
    });
  });
});
