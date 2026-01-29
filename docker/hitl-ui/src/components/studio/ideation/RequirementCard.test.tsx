/**
 * Tests for RequirementCard component (P05-F11 T10)
 *
 * RequirementCard displays extracted requirements with:
 * - Requirement ID, description, type badge, priority badge
 * - Edit mode with inline form
 * - Delete button with confirmation dialog
 * - Category indicator
 * - Compact display that expands on click
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RequirementCard from './RequirementCard';
import type { Requirement } from '../../../types/ideation';

describe('RequirementCard', () => {
  const defaultRequirement: Requirement = {
    id: 'req-001',
    description: 'System must support OAuth2 authentication with Google',
    type: 'functional',
    priority: 'must_have',
    categoryId: 'functional',
    sourceMessageId: 'msg-001',
    createdAt: '2026-01-23T10:00:00Z',
  };

  const defaultProps = {
    requirement: defaultRequirement,
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RequirementCard {...defaultProps} />);
      expect(screen.getByTestId('requirement-card-req-001')).toBeInTheDocument();
    });

    it('displays requirement ID', () => {
      render(<RequirementCard {...defaultProps} />);
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
    });

    it('displays requirement description', () => {
      render(<RequirementCard {...defaultProps} />);
      expect(screen.getByText(/oauth2 authentication with google/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<RequirementCard {...defaultProps} className="my-custom-class" />);
      expect(screen.getByTestId('requirement-card-req-001')).toHaveClass('my-custom-class');
    });
  });

  describe('Type Badge', () => {
    it('displays functional type badge', () => {
      render(<RequirementCard {...defaultProps} />);
      expect(screen.getByTestId('type-badge-req-001')).toHaveTextContent('Functional');
    });

    it('displays non-functional type badge', () => {
      render(
        <RequirementCard
          {...defaultProps}
          requirement={{ ...defaultRequirement, type: 'non_functional' }}
        />
      );
      expect(screen.getByTestId('type-badge-req-001')).toHaveTextContent('Non-Functional');
    });

    it('displays constraint type badge', () => {
      render(
        <RequirementCard
          {...defaultProps}
          requirement={{ ...defaultRequirement, type: 'constraint' }}
        />
      );
      expect(screen.getByTestId('type-badge-req-001')).toHaveTextContent('Constraint');
    });

    it('type badge has appropriate styling for functional', () => {
      render(<RequirementCard {...defaultProps} />);
      expect(screen.getByTestId('type-badge-req-001')).toHaveClass('bg-accent-blue');
    });

    it('type badge has appropriate styling for non-functional', () => {
      render(
        <RequirementCard
          {...defaultProps}
          requirement={{ ...defaultRequirement, type: 'non_functional' }}
        />
      );
      expect(screen.getByTestId('type-badge-req-001')).toHaveClass('bg-accent-purple');
    });
  });

  describe('Priority Badge', () => {
    it('displays must_have priority badge', () => {
      render(<RequirementCard {...defaultProps} />);
      expect(screen.getByTestId('priority-badge-req-001')).toHaveTextContent('Must Have');
    });

    it('displays should_have priority badge', () => {
      render(
        <RequirementCard
          {...defaultProps}
          requirement={{ ...defaultRequirement, priority: 'should_have' }}
        />
      );
      expect(screen.getByTestId('priority-badge-req-001')).toHaveTextContent('Should Have');
    });

    it('displays could_have priority badge', () => {
      render(
        <RequirementCard
          {...defaultProps}
          requirement={{ ...defaultRequirement, priority: 'could_have' }}
        />
      );
      expect(screen.getByTestId('priority-badge-req-001')).toHaveTextContent('Could Have');
    });

    it('must_have priority has high priority styling', () => {
      render(<RequirementCard {...defaultProps} />);
      expect(screen.getByTestId('priority-badge-req-001')).toHaveClass('bg-status-error');
    });

    it('should_have priority has medium priority styling', () => {
      render(
        <RequirementCard
          {...defaultProps}
          requirement={{ ...defaultRequirement, priority: 'should_have' }}
        />
      );
      expect(screen.getByTestId('priority-badge-req-001')).toHaveClass('bg-status-warning');
    });

    it('could_have priority has low priority styling', () => {
      render(
        <RequirementCard
          {...defaultProps}
          requirement={{ ...defaultRequirement, priority: 'could_have' }}
        />
      );
      expect(screen.getByTestId('priority-badge-req-001')).toHaveClass('bg-status-info');
    });
  });

  describe('Category Indicator', () => {
    it('displays category indicator when expanded', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      expect(screen.getByTestId('category-indicator-req-001')).toBeInTheDocument();
    });

    it('shows correct category name when expanded', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      expect(screen.getByTestId('category-indicator-req-001')).toHaveTextContent('Functional');
    });
  });

  describe('Expand/Collapse Behavior', () => {
    it('shows compact view by default', () => {
      render(<RequirementCard {...defaultProps} />);
      expect(screen.queryByTestId('requirement-details-req-001')).not.toBeInTheDocument();
    });

    it('expands on click to show details', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      expect(screen.getByTestId('requirement-details-req-001')).toBeInTheDocument();
    });

    it('collapses when clicking again', () => {
      render(<RequirementCard {...defaultProps} />);
      const card = screen.getByTestId('requirement-card-req-001');
      fireEvent.click(card);
      expect(screen.getByTestId('requirement-details-req-001')).toBeInTheDocument();

      // Click the header to collapse
      fireEvent.click(screen.getByTestId('requirement-header-req-001'));
      expect(screen.queryByTestId('requirement-details-req-001')).not.toBeInTheDocument();
    });

    it('shows full description in expanded view', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      // Description appears in both header (truncated) and details (full)
      const descriptions = screen.getAllByText(/oauth2 authentication with google/i);
      expect(descriptions.length).toBeGreaterThanOrEqual(2);
    });

    it('shows created date in expanded view', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      expect(screen.getByTestId('requirement-details-req-001')).toHaveTextContent(/created/i);
    });
  });

  describe('Edit Mode', () => {
    it('shows edit button when expanded', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      expect(screen.getByRole('button', { name: /edit requirement/i })).toBeInTheDocument();
    });

    it('enters edit mode when edit button clicked', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /edit requirement/i }));
      expect(screen.getByTestId('requirement-edit-form-req-001')).toBeInTheDocument();
    });

    it('shows description input in edit mode', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /edit requirement/i }));
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('shows type dropdown in edit mode', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /edit requirement/i }));
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    });

    it('shows priority dropdown in edit mode', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /edit requirement/i }));
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    });

    it('populates form with current values', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /edit requirement/i }));

      expect(screen.getByLabelText(/description/i)).toHaveValue(
        'System must support OAuth2 authentication with Google'
      );
    });

    it('calls onUpdate when save button clicked', async () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /edit requirement/i }));

      fireEvent.change(screen.getByLabelText(/description/i), {
        target: { value: 'Updated description' },
      });
      const editForm = screen.getByTestId('requirement-edit-form-req-001');
      fireEvent.click(within(editForm).getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(defaultProps.onUpdate).toHaveBeenCalledWith('req-001', {
          description: 'Updated description',
          type: 'functional',
          priority: 'must_have',
        });
      });
    });

    it('exits edit mode after saving', async () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /edit requirement/i }));
      const editForm = screen.getByTestId('requirement-edit-form-req-001');
      fireEvent.click(within(editForm).getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('requirement-edit-form-req-001')).not.toBeInTheDocument();
      });
    });

    it('cancels edit mode without saving when cancel clicked', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /edit requirement/i }));

      fireEvent.change(screen.getByLabelText(/description/i), {
        target: { value: 'Updated description' },
      });
      const editForm = screen.getByTestId('requirement-edit-form-req-001');
      fireEvent.click(within(editForm).getByRole('button', { name: /^cancel$/i }));

      expect(defaultProps.onUpdate).not.toHaveBeenCalled();
      expect(screen.queryByTestId('requirement-edit-form-req-001')).not.toBeInTheDocument();
    });
  });

  describe('Delete Functionality', () => {
    it('shows delete button when expanded', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      expect(screen.getByRole('button', { name: /delete requirement/i })).toBeInTheDocument();
    });

    it('shows confirmation dialog when delete clicked', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /delete requirement/i }));
      expect(screen.getByTestId('delete-confirmation-req-001')).toBeInTheDocument();
    });

    it('confirmation dialog shows requirement description', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /delete requirement/i }));
      expect(screen.getByTestId('delete-confirmation-req-001')).toHaveTextContent(
        /are you sure/i
      );
    });

    it('calls onDelete when confirm is clicked', async () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /delete requirement/i }));
      fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

      await waitFor(() => {
        expect(defaultProps.onDelete).toHaveBeenCalledWith('req-001');
      });
    });

    it('closes confirmation dialog when cancel is clicked', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /delete requirement/i }));

      const dialog = screen.getByTestId('delete-confirmation-req-001');
      fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }));

      expect(screen.queryByTestId('delete-confirmation-req-001')).not.toBeInTheDocument();
    });

    it('does not call onDelete when cancel is clicked', () => {
      render(<RequirementCard {...defaultProps} />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      fireEvent.click(screen.getByRole('button', { name: /delete requirement/i }));

      const dialog = screen.getByTestId('delete-confirmation-req-001');
      fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }));

      expect(defaultProps.onDelete).not.toHaveBeenCalled();
    });
  });

  describe('Read-Only Mode', () => {
    it('hides edit button in read-only mode', () => {
      render(<RequirementCard {...defaultProps} readOnly />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      expect(screen.queryByRole('button', { name: /edit requirement/i })).not.toBeInTheDocument();
    });

    it('hides delete button in read-only mode', () => {
      render(<RequirementCard {...defaultProps} readOnly />);
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      expect(screen.queryByRole('button', { name: /delete requirement/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('card is keyboard accessible', () => {
      render(<RequirementCard {...defaultProps} />);
      const card = screen.getByTestId('requirement-card-req-001');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('expands on Enter key press', () => {
      render(<RequirementCard {...defaultProps} />);
      const card = screen.getByTestId('requirement-card-req-001');
      fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
      expect(screen.getByTestId('requirement-details-req-001')).toBeInTheDocument();
    });

    it('has proper ARIA attributes', () => {
      render(<RequirementCard {...defaultProps} />);
      const card = screen.getByTestId('requirement-card-req-001');
      expect(card).toHaveAttribute('aria-expanded', 'false');
    });

    it('updates aria-expanded when expanded', () => {
      render(<RequirementCard {...defaultProps} />);
      const card = screen.getByTestId('requirement-card-req-001');
      fireEvent.click(card);
      expect(card).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
