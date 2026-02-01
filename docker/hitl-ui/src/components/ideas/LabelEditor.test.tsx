/**
 * Tests for LabelEditor component (P08-F03 T14)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabelEditor } from './LabelEditor';
import type { LabelDefinition } from '../../types/classification';

const mockLabels: LabelDefinition[] = [
  {
    id: 'feature',
    name: 'Feature',
    description: 'New functionality',
    keywords: ['add', 'new'],
    color: '#22c55e',
  },
  {
    id: 'bug',
    name: 'Bug',
    description: 'Something broken',
    keywords: ['fix', 'broken'],
    color: '#ef4444',
  },
  {
    id: 'enhancement',
    name: 'Enhancement',
    description: 'Improvement',
    keywords: ['improve', 'better'],
    color: '#3b82f6',
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Speed concerns',
    keywords: ['slow', 'fast'],
    color: '#f59e0b',
  },
];

describe('LabelEditor', () => {
  let handleChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handleChange = vi.fn();
  });

  describe('Rendering', () => {
    it('renders with data-testid', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);
      expect(screen.getByTestId('label-editor')).toBeInTheDocument();
    });

    it('renders existing labels as badges', () => {
      render(
        <LabelEditor
          labels={['feature', 'bug']}
          onChange={handleChange}
          availableLabels={mockLabels}
        />
      );
      expect(screen.getByTestId('label-feature')).toBeInTheDocument();
      expect(screen.getByTestId('label-bug')).toBeInTheDocument();
      expect(screen.getByText('Feature')).toBeInTheDocument();
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    it('shows placeholder when no labels', () => {
      render(
        <LabelEditor
          labels={[]}
          onChange={handleChange}
          availableLabels={mockLabels}
          placeholder="No labels assigned"
        />
      );
      expect(screen.getByText('No labels assigned')).toBeInTheDocument();
    });

    it('renders add button when not read-only', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);
      expect(screen.getByTestId('add-label-button')).toBeInTheDocument();
    });

    it('hides add button when read-only', () => {
      render(
        <LabelEditor
          labels={['feature']}
          onChange={handleChange}
          availableLabels={mockLabels}
          readOnly
        />
      );
      expect(screen.queryByTestId('add-label-button')).not.toBeInTheDocument();
    });
  });

  describe('Auto-assigned Labels', () => {
    it('shows sparkle icon for auto-assigned labels', () => {
      render(
        <LabelEditor
          labels={['feature', 'bug']}
          autoAssignedLabels={['feature']}
          onChange={handleChange}
          availableLabels={mockLabels}
        />
      );
      expect(screen.getByTestId('label-auto-feature')).toBeInTheDocument();
      expect(screen.queryByTestId('label-auto-bug')).not.toBeInTheDocument();
    });
  });

  describe('Label Picker', () => {
    it('opens picker when add button is clicked', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));
      expect(screen.getByTestId('label-picker')).toBeInTheDocument();
    });

    it('closes picker when clicking outside', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));
      expect(screen.getByTestId('label-picker')).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('label-picker')).not.toBeInTheDocument();
    });

    it('shows available labels in picker', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByTestId('label-option-feature')).toBeInTheDocument();
      expect(screen.getByTestId('label-option-bug')).toBeInTheDocument();
      expect(screen.getByTestId('label-option-enhancement')).toBeInTheDocument();
    });

    it('filters out already selected labels from picker', () => {
      render(
        <LabelEditor
          labels={['feature']}
          onChange={handleChange}
          availableLabels={mockLabels}
        />
      );

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.queryByTestId('label-option-feature')).not.toBeInTheDocument();
      expect(screen.getByTestId('label-option-bug')).toBeInTheDocument();
    });

    it('focuses search input when picker opens', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByTestId('label-search-input')).toHaveFocus();
    });
  });

  describe('Search Functionality', () => {
    it('filters labels based on search query', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-search-input'), { target: { value: 'feat' } });

      expect(screen.getByTestId('label-option-feature')).toBeInTheDocument();
      expect(screen.queryByTestId('label-option-bug')).not.toBeInTheDocument();
    });

    it('searches by keywords', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-search-input'), { target: { value: 'broken' } });

      expect(screen.getByTestId('label-option-bug')).toBeInTheDocument();
      expect(screen.queryByTestId('label-option-feature')).not.toBeInTheDocument();
    });

    it('shows "No matching labels" when no results', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-search-input'), { target: { value: 'xyz123' } });

      expect(screen.getByText('No matching labels')).toBeInTheDocument();
    });
  });

  describe('Adding Labels', () => {
    it('adds label when option is clicked', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.click(screen.getByTestId('label-option-feature'));

      expect(handleChange).toHaveBeenCalledWith(['feature']);
    });

    it('closes picker after adding label', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.click(screen.getByTestId('label-option-feature'));

      expect(screen.queryByTestId('label-picker')).not.toBeInTheDocument();
    });

    it('respects maxLabels limit', () => {
      render(
        <LabelEditor
          labels={['feature', 'bug']}
          onChange={handleChange}
          availableLabels={mockLabels}
          maxLabels={2}
        />
      );

      // Add button should not be visible when at max
      expect(screen.queryByTestId('add-label-button')).not.toBeInTheDocument();
    });
  });

  describe('Custom Labels', () => {
    it('allows adding custom label when enabled', () => {
      render(
        <LabelEditor
          labels={[]}
          onChange={handleChange}
          availableLabels={mockLabels}
          allowCustomLabels
        />
      );

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-search-input'), { target: { value: 'custom-label' } });

      expect(screen.getByTestId('add-custom-label')).toBeInTheDocument();
      expect(screen.getByText('Create "custom-label"')).toBeInTheDocument();
    });

    it('adds custom label when clicked', () => {
      render(
        <LabelEditor
          labels={[]}
          onChange={handleChange}
          availableLabels={mockLabels}
          allowCustomLabels
        />
      );

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-search-input'), { target: { value: 'my-custom' } });
      fireEvent.click(screen.getByTestId('add-custom-label'));

      expect(handleChange).toHaveBeenCalledWith(['my-custom']);
    });

    it('does not show custom label option when matching existing label', () => {
      render(
        <LabelEditor
          labels={[]}
          onChange={handleChange}
          availableLabels={mockLabels}
          allowCustomLabels
        />
      );

      fireEvent.click(screen.getByTestId('add-label-button'));
      fireEvent.change(screen.getByTestId('label-search-input'), { target: { value: 'feature' } });

      expect(screen.queryByTestId('add-custom-label')).not.toBeInTheDocument();
    });
  });

  describe('Removing Labels', () => {
    it('removes label when x button is clicked', () => {
      render(
        <LabelEditor
          labels={['feature', 'bug']}
          onChange={handleChange}
          availableLabels={mockLabels}
        />
      );

      fireEvent.click(screen.getByTestId('remove-label-feature'));

      expect(handleChange).toHaveBeenCalledWith(['bug']);
    });

    it('hides remove button in read-only mode', () => {
      render(
        <LabelEditor
          labels={['feature']}
          onChange={handleChange}
          availableLabels={mockLabels}
          readOnly
        />
      );

      expect(screen.queryByTestId('remove-label-feature')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('opens picker on Enter key', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      const addButton = screen.getByTestId('add-label-button');
      fireEvent.keyDown(addButton, { key: 'Enter' });

      expect(screen.getByTestId('label-picker')).toBeInTheDocument();
    });

    it('navigates options with arrow keys', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));

      const searchInput = screen.getByTestId('label-search-input');

      // First option should be highlighted by default
      expect(screen.getByTestId('label-option-feature')).toHaveAttribute('aria-selected', 'true');

      // Arrow down
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      expect(screen.getByTestId('label-option-bug')).toHaveAttribute('aria-selected', 'true');

      // Arrow up
      fireEvent.keyDown(searchInput, { key: 'ArrowUp' });
      expect(screen.getByTestId('label-option-feature')).toHaveAttribute('aria-selected', 'true');
    });

    it('selects highlighted option on Enter', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));

      const searchInput = screen.getByTestId('label-search-input');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' }); // Highlight 'bug'
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      expect(handleChange).toHaveBeenCalledWith(['bug']);
    });

    it('closes picker on Escape', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));

      const searchInput = screen.getByTestId('label-search-input');
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      expect(screen.queryByTestId('label-picker')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('add button has aria-haspopup', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);
      expect(screen.getByTestId('add-label-button')).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('add button has aria-expanded', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      const addButton = screen.getByTestId('add-label-button');
      expect(addButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(addButton);
      expect(addButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('picker has role="listbox"', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByTestId('label-picker')).toHaveAttribute('role', 'listbox');
    });

    it('options have role="option"', () => {
      render(<LabelEditor labels={[]} onChange={handleChange} availableLabels={mockLabels} />);

      fireEvent.click(screen.getByTestId('add-label-button'));

      expect(screen.getByTestId('label-option-feature')).toHaveAttribute('role', 'option');
    });

    it('remove button has aria-label', () => {
      render(
        <LabelEditor
          labels={['feature']}
          onChange={handleChange}
          availableLabels={mockLabels}
        />
      );

      expect(screen.getByTestId('remove-label-feature')).toHaveAttribute(
        'aria-label',
        'Remove Feature label'
      );
    });
  });

  describe('Label Colors', () => {
    it('applies label color to badge', () => {
      render(
        <LabelEditor
          labels={['feature']}
          onChange={handleChange}
          availableLabels={mockLabels}
        />
      );

      const badge = screen.getByTestId('label-feature');
      expect(badge).toHaveStyle({ color: '#22c55e' });
    });

    it('uses default gray for unknown labels', () => {
      render(
        <LabelEditor
          labels={['unknown-label']}
          onChange={handleChange}
          availableLabels={mockLabels}
        />
      );

      const badge = screen.getByTestId('label-unknown-label');
      expect(badge).toHaveStyle({ color: '#6b7280' });
    });
  });
});
