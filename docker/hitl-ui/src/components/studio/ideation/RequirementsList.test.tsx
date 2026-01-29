/**
 * Tests for RequirementsList component (P05-F11 T11)
 *
 * RequirementsList displays a scrollable list of requirements with:
 * - Filter dropdown by category or type
 * - Sort dropdown (by priority, by date)
 * - Count indicator showing total requirements
 * - Empty state when no requirements extracted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import RequirementsList from './RequirementsList';
import type { Requirement } from '../../../types/ideation';

describe('RequirementsList', () => {
  const mockRequirements: Requirement[] = [
    {
      id: 'req-001',
      description: 'System must support OAuth2 authentication with Google',
      type: 'functional',
      priority: 'must_have',
      categoryId: 'functional',
      createdAt: '2026-01-23T10:00:00Z',
    },
    {
      id: 'req-002',
      description: 'System must support OAuth2 authentication with GitHub',
      type: 'functional',
      priority: 'should_have',
      categoryId: 'functional',
      createdAt: '2026-01-23T10:05:00Z',
    },
    {
      id: 'req-003',
      description: 'Authentication must complete within 2 seconds',
      type: 'non_functional',
      priority: 'must_have',
      categoryId: 'nfr',
      createdAt: '2026-01-23T10:10:00Z',
    },
    {
      id: 'req-004',
      description: 'System must scale to 500,000 users',
      type: 'non_functional',
      priority: 'should_have',
      categoryId: 'nfr',
      createdAt: '2026-01-23T10:15:00Z',
    },
    {
      id: 'req-005',
      description: 'Must use existing database schema',
      type: 'constraint',
      priority: 'could_have',
      categoryId: 'scope',
      createdAt: '2026-01-23T10:20:00Z',
    },
  ];

  const defaultProps = {
    requirements: mockRequirements,
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RequirementsList {...defaultProps} />);
      expect(screen.getByTestId('requirements-list')).toBeInTheDocument();
    });

    it('displays all requirement cards', () => {
      render(<RequirementsList {...defaultProps} />);
      expect(screen.getAllByTestId(/^requirement-card-/)).toHaveLength(5);
    });

    it('applies custom className', () => {
      render(<RequirementsList {...defaultProps} className="my-custom-class" />);
      expect(screen.getByTestId('requirements-list')).toHaveClass('my-custom-class');
    });
  });

  describe('Count Indicator', () => {
    it('displays total requirements count', () => {
      render(<RequirementsList {...defaultProps} />);
      expect(screen.getByTestId('requirements-count')).toHaveTextContent('5 requirements');
    });

    it('uses singular when only one requirement', () => {
      render(<RequirementsList {...defaultProps} requirements={[mockRequirements[0]]} />);
      expect(screen.getByTestId('requirements-count')).toHaveTextContent('1 requirement');
    });

    it('shows filtered count when filter is active', () => {
      render(<RequirementsList {...defaultProps} />);

      // Apply filter - click on the dropdown option (first matching "Functional" in listbox)
      fireEvent.click(screen.getByTestId('filter-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Functional'));

      expect(screen.getByTestId('requirements-count')).toHaveTextContent('2 of 5');
    });
  });

  describe('Filter by Type', () => {
    it('renders filter dropdown', () => {
      render(<RequirementsList {...defaultProps} />);
      expect(screen.getByTestId('filter-dropdown-trigger')).toBeInTheDocument();
    });

    it('shows filter options when clicked', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');

      expect(within(dropdown).getByText('All Types')).toBeInTheDocument();
      expect(within(dropdown).getByText('Functional')).toBeInTheDocument();
      expect(within(dropdown).getByText('Non-Functional')).toBeInTheDocument();
      expect(within(dropdown).getByText('Constraint')).toBeInTheDocument();
    });

    it('filters by functional type', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Functional'));

      expect(screen.getAllByTestId(/^requirement-card-/)).toHaveLength(2);
      expect(screen.getByTestId('requirement-card-req-001')).toBeInTheDocument();
      expect(screen.getByTestId('requirement-card-req-002')).toBeInTheDocument();
    });

    it('filters by non-functional type', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Non-Functional'));

      expect(screen.getAllByTestId(/^requirement-card-/)).toHaveLength(2);
      expect(screen.getByTestId('requirement-card-req-003')).toBeInTheDocument();
      expect(screen.getByTestId('requirement-card-req-004')).toBeInTheDocument();
    });

    it('filters by constraint type', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Constraint'));

      expect(screen.getAllByTestId(/^requirement-card-/)).toHaveLength(1);
      expect(screen.getByTestId('requirement-card-req-005')).toBeInTheDocument();
    });

    it('shows all when All Types selected', () => {
      render(<RequirementsList {...defaultProps} />);

      // First filter
      fireEvent.click(screen.getByTestId('filter-dropdown-trigger'));
      let dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Functional'));
      expect(screen.getAllByTestId(/^requirement-card-/)).toHaveLength(2);

      // Then select All
      fireEvent.click(screen.getByTestId('filter-dropdown-trigger'));
      dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('All Types'));
      expect(screen.getAllByTestId(/^requirement-card-/)).toHaveLength(5);
    });
  });

  describe('Filter by Category', () => {
    it('shows category filter options', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('category-filter-trigger'));
      const dropdown = screen.getByRole('listbox');

      expect(within(dropdown).getByText('All Categories')).toBeInTheDocument();
      expect(within(dropdown).getByText('Functional Requirements')).toBeInTheDocument();
      expect(within(dropdown).getByText('Non-Functional Requirements')).toBeInTheDocument();
      expect(within(dropdown).getByText('Scope & Constraints')).toBeInTheDocument();
    });

    it('filters by category', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('category-filter-trigger'));
      const dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Non-Functional Requirements'));

      expect(screen.getAllByTestId(/^requirement-card-/)).toHaveLength(2);
      expect(screen.getByTestId('requirement-card-req-003')).toBeInTheDocument();
      expect(screen.getByTestId('requirement-card-req-004')).toBeInTheDocument();
    });
  });

  describe('Sort Functionality', () => {
    it('renders sort dropdown', () => {
      render(<RequirementsList {...defaultProps} />);
      expect(screen.getByTestId('sort-dropdown-trigger')).toBeInTheDocument();
    });

    it('shows sort options when clicked', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('sort-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');

      expect(within(dropdown).getByText('Newest First')).toBeInTheDocument();
      expect(within(dropdown).getByText('Oldest First')).toBeInTheDocument();
      expect(within(dropdown).getByText('Priority (High to Low)')).toBeInTheDocument();
      expect(within(dropdown).getByText('Priority (Low to High)')).toBeInTheDocument();
    });

    it('sorts by newest first (default)', () => {
      render(<RequirementsList {...defaultProps} />);
      const cards = screen.getAllByTestId(/^requirement-card-/);
      // Newest (req-005) should be first
      expect(cards[0]).toHaveAttribute('data-testid', 'requirement-card-req-005');
    });

    it('sorts by oldest first', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('sort-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Oldest First'));

      const cards = screen.getAllByTestId(/^requirement-card-/);
      // Oldest (req-001) should be first
      expect(cards[0]).toHaveAttribute('data-testid', 'requirement-card-req-001');
    });

    it('sorts by priority high to low', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('sort-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Priority (High to Low)'));

      const cards = screen.getAllByTestId(/^requirement-card-/);
      // must_have requirements should be first
      expect(cards[0]).toHaveAttribute('data-testid', 'requirement-card-req-001');
    });

    it('sorts by priority low to high', () => {
      render(<RequirementsList {...defaultProps} />);
      fireEvent.click(screen.getByTestId('sort-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Priority (Low to High)'));

      const cards = screen.getAllByTestId(/^requirement-card-/);
      // could_have requirements should be first
      expect(cards[0]).toHaveAttribute('data-testid', 'requirement-card-req-005');
    });
  });

  describe('Combined Filter and Sort', () => {
    it('applies both filter and sort together', () => {
      render(<RequirementsList {...defaultProps} />);

      // Filter by functional
      fireEvent.click(screen.getByTestId('filter-dropdown-trigger'));
      let dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Functional'));

      // Sort by priority
      fireEvent.click(screen.getByTestId('sort-dropdown-trigger'));
      dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Priority (High to Low)'));

      const cards = screen.getAllByTestId(/^requirement-card-/);
      expect(cards).toHaveLength(2);
      // must_have functional (req-001) should be first
      expect(cards[0]).toHaveAttribute('data-testid', 'requirement-card-req-001');
      // should_have functional (req-002) should be second
      expect(cards[1]).toHaveAttribute('data-testid', 'requirement-card-req-002');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no requirements', () => {
      render(<RequirementsList {...defaultProps} requirements={[]} />);
      expect(screen.getByTestId('requirements-empty-state')).toBeInTheDocument();
    });

    it('shows appropriate empty message', () => {
      render(<RequirementsList {...defaultProps} requirements={[]} />);
      expect(screen.getByText(/no requirements extracted yet/i)).toBeInTheDocument();
    });

    it('shows custom empty message when provided', () => {
      render(
        <RequirementsList
          {...defaultProps}
          requirements={[]}
          emptyMessage="Start chatting to extract requirements"
        />
      );
      expect(screen.getByText(/start chatting to extract requirements/i)).toBeInTheDocument();
    });

    it('shows empty state when filter matches nothing', () => {
      const functionalOnly = mockRequirements.filter((r) => r.type === 'functional');
      render(<RequirementsList {...defaultProps} requirements={functionalOnly} />);

      fireEvent.click(screen.getByTestId('filter-dropdown-trigger'));
      const dropdown = screen.getByRole('listbox');
      fireEvent.click(within(dropdown).getByText('Constraint'));

      expect(screen.getByTestId('requirements-filter-empty')).toBeInTheDocument();
      expect(screen.getByText(/no requirements match the current filter/i)).toBeInTheDocument();
    });
  });

  describe('Scrollable Container', () => {
    it('has scrollable container', () => {
      render(<RequirementsList {...defaultProps} />);
      const container = screen.getByTestId('requirements-scroll-container');
      expect(container).toHaveClass('overflow-y-auto');
    });

    it('respects maxHeight prop', () => {
      render(<RequirementsList {...defaultProps} maxHeight="400px" />);
      const container = screen.getByTestId('requirements-scroll-container');
      expect(container).toHaveStyle({ maxHeight: '400px' });
    });
  });

  describe('RequirementCard Integration', () => {
    it('passes onUpdate to RequirementCard', () => {
      render(<RequirementsList {...defaultProps} />);

      // Expand a card
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      // Click edit
      fireEvent.click(screen.getByRole('button', { name: /edit requirement/i }));
      // Make a change and save
      fireEvent.change(screen.getByLabelText(/description/i), {
        target: { value: 'Updated' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      expect(defaultProps.onUpdate).toHaveBeenCalled();
    });

    it('passes onDelete to RequirementCard', () => {
      render(<RequirementsList {...defaultProps} />);

      // Expand a card
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));
      // Click delete
      fireEvent.click(screen.getByRole('button', { name: /delete requirement/i }));
      // Confirm
      fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

      expect(defaultProps.onDelete).toHaveBeenCalledWith('req-001');
    });

    it('passes readOnly prop to RequirementCards', () => {
      render(<RequirementsList {...defaultProps} readOnly />);

      // Expand a card
      fireEvent.click(screen.getByTestId('requirement-card-req-001'));

      // Edit and delete buttons should not be present
      expect(screen.queryByRole('button', { name: /edit requirement/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete requirement/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('list has proper role', () => {
      render(<RequirementsList {...defaultProps} />);
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('filter dropdown is keyboard accessible', () => {
      render(<RequirementsList {...defaultProps} />);
      const trigger = screen.getByTestId('filter-dropdown-trigger');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('sort dropdown is keyboard accessible', () => {
      render(<RequirementsList {...defaultProps} />);
      const trigger = screen.getByTestId('sort-dropdown-trigger');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('announces filter changes to screen readers', () => {
      render(<RequirementsList {...defaultProps} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading is true', () => {
      render(<RequirementsList {...defaultProps} isLoading />);
      expect(screen.getByTestId('requirements-loading')).toBeInTheDocument();
    });

    it('shows skeleton cards when loading', () => {
      render(<RequirementsList {...defaultProps} isLoading />);
      expect(screen.getAllByTestId('requirement-skeleton').length).toBeGreaterThan(0);
    });
  });
});
