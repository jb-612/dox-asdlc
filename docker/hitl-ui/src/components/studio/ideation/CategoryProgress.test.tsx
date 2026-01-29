/**
 * Tests for CategoryProgress component (P05-F11 T07)
 *
 * Tests:
 * - Category name with score percentage
 * - Progress bar per category
 * - Expandable section showing captured details
 * - Visual status indicator (empty/partial/complete icons)
 * - Click to expand/collapse
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryProgress from './CategoryProgress';
import type { CategoryMaturity } from '../../../types/ideation';

// Helper to create a category at a specific score
function createCategory(
  id: string,
  name: string,
  score: number,
  sections: { id: string; name: string; score: number; captured: string[] }[] = []
): CategoryMaturity {
  return {
    id,
    name,
    score,
    weight: 15,
    requiredForSubmit: true,
    sections: sections.map((s) => ({
      id: s.id,
      name: s.name,
      score: s.score,
      captured: s.captured,
    })),
  };
}

describe('CategoryProgress', () => {
  describe('Category Display', () => {
    it('displays category name', () => {
      const category = createCategory('problem', 'Problem Statement', 50);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('category-name')).toHaveTextContent('Problem Statement');
    });

    it('displays score percentage', () => {
      const category = createCategory('users', 'Target Users', 75);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('category-score')).toHaveTextContent('75%');
    });

    it('displays 0% for empty category', () => {
      const category = createCategory('functional', 'Functional Requirements', 0);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('category-score')).toHaveTextContent('0%');
    });

    it('displays 100% for complete category', () => {
      const category = createCategory('scope', 'Scope', 100);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('category-score')).toHaveTextContent('100%');
    });
  });

  describe('Progress Bar', () => {
    it('renders progress bar with correct width', () => {
      const category = createCategory('problem', 'Problem Statement', 60);
      render(<CategoryProgress category={category} />);

      const progressFill = screen.getByTestId('category-progress-fill');
      expect(progressFill).toHaveStyle({ width: '60%' });
    });

    it('shows 0 width for empty category', () => {
      const category = createCategory('problem', 'Problem Statement', 0);
      render(<CategoryProgress category={category} />);

      const progressFill = screen.getByTestId('category-progress-fill');
      expect(progressFill).toHaveStyle({ width: '0%' });
    });

    it('shows full width for complete category', () => {
      const category = createCategory('problem', 'Problem Statement', 100);
      render(<CategoryProgress category={category} />);

      const progressFill = screen.getByTestId('category-progress-fill');
      expect(progressFill).toHaveStyle({ width: '100%' });
    });
  });

  describe('Status Indicators', () => {
    it('shows empty icon for 0% score', () => {
      const category = createCategory('problem', 'Problem Statement', 0);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('status-icon-empty')).toBeInTheDocument();
    });

    it('shows partial icon for scores between 1-99%', () => {
      const category = createCategory('problem', 'Problem Statement', 50);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('status-icon-partial')).toBeInTheDocument();
    });

    it('shows complete icon for 100% score', () => {
      const category = createCategory('problem', 'Problem Statement', 100);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('status-icon-complete')).toBeInTheDocument();
    });

    it('shows partial icon at 99%', () => {
      const category = createCategory('problem', 'Problem Statement', 99);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('status-icon-partial')).toBeInTheDocument();
    });

    it('shows partial icon at 1%', () => {
      const category = createCategory('problem', 'Problem Statement', 1);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('status-icon-partial')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('starts collapsed by default', () => {
      const category = createCategory('problem', 'Problem Statement', 50, [
        { id: 's1', name: 'Core Problem', score: 80, captured: ['User pain point identified'] },
      ]);
      render(<CategoryProgress category={category} />);

      expect(screen.queryByTestId('category-details')).not.toBeInTheDocument();
    });

    it('expands on click', () => {
      const category = createCategory('problem', 'Problem Statement', 50, [
        { id: 's1', name: 'Core Problem', score: 80, captured: ['User pain point identified'] },
      ]);
      render(<CategoryProgress category={category} />);

      const header = screen.getByTestId('category-header');
      fireEvent.click(header);

      expect(screen.getByTestId('category-details')).toBeInTheDocument();
    });

    it('collapses on second click', () => {
      const category = createCategory('problem', 'Problem Statement', 50, [
        { id: 's1', name: 'Core Problem', score: 80, captured: ['User pain point identified'] },
      ]);
      render(<CategoryProgress category={category} />);

      const header = screen.getByTestId('category-header');
      fireEvent.click(header);
      expect(screen.getByTestId('category-details')).toBeInTheDocument();

      fireEvent.click(header);
      expect(screen.queryByTestId('category-details')).not.toBeInTheDocument();
    });

    it('expands on Enter key', () => {
      const category = createCategory('problem', 'Problem Statement', 50, [
        { id: 's1', name: 'Core Problem', score: 80, captured: ['User pain point identified'] },
      ]);
      render(<CategoryProgress category={category} />);

      const header = screen.getByTestId('category-header');
      fireEvent.keyDown(header, { key: 'Enter', code: 'Enter' });

      expect(screen.getByTestId('category-details')).toBeInTheDocument();
    });

    it('expands on Space key', () => {
      const category = createCategory('problem', 'Problem Statement', 50, [
        { id: 's1', name: 'Core Problem', score: 80, captured: ['User pain point identified'] },
      ]);
      render(<CategoryProgress category={category} />);

      const header = screen.getByTestId('category-header');
      fireEvent.keyDown(header, { key: ' ', code: 'Space' });

      expect(screen.getByTestId('category-details')).toBeInTheDocument();
    });

    it('shows chevron down when expanded', () => {
      const category = createCategory('problem', 'Problem Statement', 50, [
        { id: 's1', name: 'Core Problem', score: 80, captured: ['User pain point identified'] },
      ]);
      render(<CategoryProgress category={category} />);

      fireEvent.click(screen.getByTestId('category-header'));

      expect(screen.getByTestId('chevron-down')).toBeInTheDocument();
    });

    it('shows chevron right when collapsed', () => {
      const category = createCategory('problem', 'Problem Statement', 50);
      render(<CategoryProgress category={category} />);

      expect(screen.getByTestId('chevron-right')).toBeInTheDocument();
    });
  });

  describe('Expanded Content', () => {
    it('shows captured details when expanded', () => {
      const category = createCategory('problem', 'Problem Statement', 50, [
        {
          id: 's1',
          name: 'Core Problem',
          score: 80,
          captured: ['User pain point identified', 'Business impact documented'],
        },
      ]);
      render(<CategoryProgress category={category} />);

      fireEvent.click(screen.getByTestId('category-header'));

      expect(screen.getByText('User pain point identified')).toBeInTheDocument();
      expect(screen.getByText('Business impact documented')).toBeInTheDocument();
    });

    it('shows section names in expanded view', () => {
      const category = createCategory('problem', 'Problem Statement', 50, [
        { id: 's1', name: 'Core Problem', score: 80, captured: ['Detail 1'] },
        { id: 's2', name: 'Impact Analysis', score: 60, captured: ['Detail 2'] },
      ]);
      render(<CategoryProgress category={category} />);

      fireEvent.click(screen.getByTestId('category-header'));

      expect(screen.getByText('Core Problem')).toBeInTheDocument();
      expect(screen.getByText('Impact Analysis')).toBeInTheDocument();
    });

    it('shows empty state when no captured content', () => {
      const category = createCategory('problem', 'Problem Statement', 0);
      render(<CategoryProgress category={category} />);

      fireEvent.click(screen.getByTestId('category-header'));

      expect(screen.getByText(/no details captured/i)).toBeInTheDocument();
    });
  });

  describe('Callback', () => {
    it('calls onToggle callback when expanded', () => {
      const onToggle = vi.fn();
      const category = createCategory('problem', 'Problem Statement', 50);
      render(<CategoryProgress category={category} onToggle={onToggle} />);

      fireEvent.click(screen.getByTestId('category-header'));

      expect(onToggle).toHaveBeenCalledWith('problem', true);
    });

    it('calls onToggle callback when collapsed', () => {
      const onToggle = vi.fn();
      const category = createCategory('problem', 'Problem Statement', 50);
      render(<CategoryProgress category={category} onToggle={onToggle} />);

      fireEvent.click(screen.getByTestId('category-header'));
      fireEvent.click(screen.getByTestId('category-header'));

      expect(onToggle).toHaveBeenCalledWith('problem', false);
    });
  });

  describe('Required Indicator', () => {
    it('shows required indicator for required categories', () => {
      const category = createCategory('problem', 'Problem Statement', 50);
      category.requiredForSubmit = true;
      render(<CategoryProgress category={category} showRequired />);

      expect(screen.getByTestId('required-indicator')).toBeInTheDocument();
    });

    it('does not show required indicator for optional categories', () => {
      const category = createCategory('risks', 'Risks & Assumptions', 50);
      category.requiredForSubmit = false;
      render(<CategoryProgress category={category} showRequired />);

      expect(screen.queryByTestId('required-indicator')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has button role for header', () => {
      const category = createCategory('problem', 'Problem Statement', 50);
      render(<CategoryProgress category={category} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has aria-expanded attribute', () => {
      const category = createCategory('problem', 'Problem Statement', 50);
      render(<CategoryProgress category={category} />);

      const header = screen.getByTestId('category-header');
      expect(header).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(header);
      expect(header).toHaveAttribute('aria-expanded', 'true');
    });

    it('is focusable', () => {
      const category = createCategory('problem', 'Problem Statement', 50);
      render(<CategoryProgress category={category} />);

      const header = screen.getByTestId('category-header');
      expect(header).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      const category = createCategory('problem', 'Problem Statement', 50);
      render(<CategoryProgress category={category} className="custom-class" />);

      const container = screen.getByTestId('category-progress');
      expect(container).toHaveClass('custom-class');
    });

    it('can start expanded with defaultExpanded prop', () => {
      const category = createCategory('problem', 'Problem Statement', 50, [
        { id: 's1', name: 'Core Problem', score: 80, captured: ['Detail'] },
      ]);
      render(<CategoryProgress category={category} defaultExpanded />);

      expect(screen.getByTestId('category-details')).toBeInTheDocument();
    });
  });
});
