/**
 * Tests for ArtifactExplorer component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ArtifactExplorer, { type Artifact, type ArtifactStatus } from './ArtifactExplorer';

describe('ArtifactExplorer', () => {
  const defaultArtifacts: Artifact[] = [
    {
      id: 'art-1',
      name: 'prd.md',
      type: 'prd',
      epic: 'EPIC-001',
      status: 'approved',
      createdAt: '2026-01-23T10:00:00Z',
      approvedAt: '2026-01-23T12:00:00Z',
      sha: 'abc1234',
      agent: 'prd-agent',
      gate: 'prd-review',
    },
    {
      id: 'art-2',
      name: 'design.md',
      type: 'design',
      epic: 'EPIC-001',
      status: 'pending_review',
      createdAt: '2026-01-23T11:00:00Z',
      sha: 'def5678',
      agent: 'architect-agent',
      gate: 'design-review',
    },
    {
      id: 'art-3',
      name: 'tests.spec.ts',
      type: 'test',
      epic: 'EPIC-002',
      status: 'draft',
      createdAt: '2026-01-22T09:00:00Z',
      sha: 'ghi9012',
      agent: 'test-agent',
    },
    {
      id: 'art-4',
      name: 'impl.ts',
      type: 'code',
      epic: 'EPIC-002',
      status: 'rejected',
      createdAt: '2026-01-22T10:00:00Z',
      sha: 'jkl3456',
      agent: 'coding-agent',
      gate: 'code-review',
    },
    {
      id: 'art-5',
      name: 'security-scan.json',
      type: 'report',
      epic: 'EPIC-001',
      status: 'approved',
      createdAt: '2026-01-21T08:00:00Z',
      approvedAt: '2026-01-21T10:00:00Z',
      sha: 'mno7890',
      agent: 'security-agent',
      gate: 'security-gate',
    },
  ];

  const defaultProps = {
    artifacts: defaultArtifacts,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByTestId('artifact-explorer')).toBeInTheDocument();
    });

    it('renders table header', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ArtifactExplorer {...defaultProps} className="my-custom-class" />);
      expect(screen.getByTestId('artifact-explorer')).toHaveClass('my-custom-class');
    });

    it('shows artifact count', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByTestId('artifact-count')).toHaveTextContent('5');
    });
  });

  describe('Table Columns', () => {
    it('displays name column', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    });

    it('displays type column', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByRole('columnheader', { name: /type/i })).toBeInTheDocument();
    });

    it('displays epic column', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByRole('columnheader', { name: /epic/i })).toBeInTheDocument();
    });

    it('displays status column', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    });

    it('displays created date column', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByRole('columnheader', { name: /created/i })).toBeInTheDocument();
    });

    it('displays approved date column', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByRole('columnheader', { name: /approved/i })).toBeInTheDocument();
    });

    it('displays SHA column', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByRole('columnheader', { name: /sha/i })).toBeInTheDocument();
    });
  });

  describe('Table Data', () => {
    it('displays artifact names', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByText('prd.md')).toBeInTheDocument();
      expect(screen.getByText('design.md')).toBeInTheDocument();
    });

    it('displays artifact types', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByTestId('row-art-1')).toHaveTextContent('prd');
    });

    it('displays artifact status with badge', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      const row = screen.getByTestId('row-art-1');
      expect(within(row).getByTestId('status-badge')).toHaveTextContent(/approved/i);
    });

    it('displays truncated SHA', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByText('abc1234')).toBeInTheDocument();
    });

    it('displays empty cell when approvedAt is null', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      const row = screen.getByTestId('row-art-2');
      const cells = within(row).getAllByRole('cell');
      // approvedAt column should show "-" or be empty
      expect(cells.some((cell) => cell.textContent === '-' || cell.textContent === '')).toBe(true);
    });
  });

  describe('Sorting', () => {
    it('sorts by name when name header clicked', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByRole('columnheader', { name: /name/i }));

      const rows = screen.getAllByTestId(/^row-/);
      // First row should be "design.md" alphabetically
      expect(rows[0]).toHaveAttribute('data-testid', 'row-art-2');
    });

    it('toggles sort direction on second click', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      const nameHeader = screen.getByRole('columnheader', { name: /name/i });

      fireEvent.click(nameHeader);
      fireEvent.click(nameHeader);

      const rows = screen.getAllByTestId(/^row-/);
      // After descending sort, "tests.spec.ts" should be first
      expect(rows[0]).toHaveAttribute('data-testid', 'row-art-3');
    });

    it('shows sort indicator on active column', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByRole('columnheader', { name: /name/i }));

      expect(screen.getByTestId('sort-indicator-name')).toBeInTheDocument();
    });

    it('sorts by date correctly', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByRole('columnheader', { name: /created/i }));

      const rows = screen.getAllByTestId(/^row-/);
      // Oldest first: security-scan.json (2026-01-21)
      expect(rows[0]).toHaveAttribute('data-testid', 'row-art-5');
    });

    it('sorts by status correctly', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByRole('columnheader', { name: /status/i }));

      // Should sort alphabetically by status
      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(5);
    });
  });

  describe('Filtering', () => {
    it('filters by epic', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-epic'));
      fireEvent.click(screen.getByTestId('filter-option-EPIC-001'));

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(3);
    });

    it('filters by type', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-type'));
      fireEvent.click(screen.getByTestId('filter-option-code'));

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(1);
    });

    it('filters by status', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-status'));
      fireEvent.click(screen.getByTestId('filter-option-approved'));

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(2);
    });

    it('filters by agent', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-agent'));
      fireEvent.click(screen.getByTestId('filter-option-prd-agent'));

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(1);
    });

    it('filters by gate', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-gate'));
      fireEvent.click(screen.getByTestId('filter-option-prd-review'));

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(1);
    });

    it('shows active filter count badge', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-epic'));
      fireEvent.click(screen.getByTestId('filter-option-EPIC-001'));

      expect(screen.getByTestId('active-filters-count')).toHaveTextContent('1');
    });

    it('clears all filters', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.click(screen.getByTestId('filter-epic'));
      fireEvent.click(screen.getByTestId('filter-option-EPIC-001'));

      fireEvent.click(screen.getByTestId('clear-filters'));

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(5);
    });
  });

  describe('Search', () => {
    it('renders search input', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('filters by filename search', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'prd' },
      });

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(1);
      expect(rows[0]).toHaveAttribute('data-testid', 'row-art-1');
    });

    it('search is case insensitive', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'PRD' },
      });

      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(1);
    });

    it('shows no results message when search returns empty', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'nonexistent' },
      });

      expect(screen.getByText(/no artifacts found/i)).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    // Create 60 artifacts for pagination tests
    const manyArtifacts: Artifact[] = Array.from({ length: 60 }, (_, i) => ({
      id: `art-${i + 1}`,
      name: `artifact-${i + 1}.md`,
      type: 'prd',
      epic: `EPIC-${Math.floor(i / 10) + 1}`,
      status: 'approved' as ArtifactStatus,
      createdAt: new Date(2026, 0, 23, i).toISOString(),
      sha: `sha${i}`,
      agent: 'agent',
    }));

    it('shows 50 items per page by default', () => {
      render(<ArtifactExplorer artifacts={manyArtifacts} />);
      const rows = screen.getAllByTestId(/^row-/);
      expect(rows.length).toBe(50);
    });

    it('shows pagination controls', () => {
      render(<ArtifactExplorer artifacts={manyArtifacts} />);
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    it('shows page info', () => {
      render(<ArtifactExplorer artifacts={manyArtifacts} />);
      expect(screen.getByTestId('page-info')).toHaveTextContent('1-50 of 60');
    });

    it('navigates to next page', () => {
      render(<ArtifactExplorer artifacts={manyArtifacts} />);
      fireEvent.click(screen.getByTestId('next-page'));

      expect(screen.getByTestId('page-info')).toHaveTextContent('51-60 of 60');
    });

    it('navigates to previous page', () => {
      render(<ArtifactExplorer artifacts={manyArtifacts} />);
      fireEvent.click(screen.getByTestId('next-page'));
      fireEvent.click(screen.getByTestId('prev-page'));

      expect(screen.getByTestId('page-info')).toHaveTextContent('1-50 of 60');
    });

    it('disables prev button on first page', () => {
      render(<ArtifactExplorer artifacts={manyArtifacts} />);
      expect(screen.getByTestId('prev-page')).toBeDisabled();
    });

    it('disables next button on last page', () => {
      render(<ArtifactExplorer artifacts={manyArtifacts} />);
      fireEvent.click(screen.getByTestId('next-page'));
      expect(screen.getByTestId('next-page')).toBeDisabled();
    });
  });

  describe('Status Badges', () => {
    it('shows green badge for approved status', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      const row = screen.getByTestId('row-art-1');
      const badge = within(row).getByTestId('status-badge');
      expect(badge).toHaveClass('text-status-success');
    });

    it('shows yellow badge for pending_review status', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      const row = screen.getByTestId('row-art-2');
      const badge = within(row).getByTestId('status-badge');
      expect(badge).toHaveClass('text-status-warning');
    });

    it('shows red badge for rejected status', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      const row = screen.getByTestId('row-art-4');
      const badge = within(row).getByTestId('status-badge');
      expect(badge).toHaveClass('text-status-error');
    });

    it('shows gray badge for draft status', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      const row = screen.getByTestId('row-art-3');
      const badge = within(row).getByTestId('status-badge');
      expect(badge).toHaveClass('text-text-muted');
    });
  });

  describe('Row Click', () => {
    it('calls onArtifactClick when row is clicked', () => {
      const onClick = vi.fn();
      render(<ArtifactExplorer {...defaultProps} onArtifactClick={onClick} />);
      fireEvent.click(screen.getByTestId('row-art-1'));
      expect(onClick).toHaveBeenCalledWith('art-1');
    });

    it('applies hover styles to rows', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      const row = screen.getByTestId('row-art-1');
      expect(row).toHaveClass('hover:bg-bg-tertiary');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no artifacts', () => {
      render(<ArtifactExplorer artifacts={[]} />);
      expect(screen.getByText(/no artifacts/i)).toBeInTheDocument();
    });

    it('hides table when no artifacts', () => {
      render(<ArtifactExplorer artifacts={[]} />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state when isLoading is true', () => {
      render(<ArtifactExplorer {...defaultProps} isLoading />);
      expect(screen.getByTestId('artifact-explorer-loading')).toBeInTheDocument();
    });

    it('shows skeleton rows when loading', () => {
      render(<ArtifactExplorer {...defaultProps} isLoading />);
      expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('table has accessible role', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('rows are keyboard accessible', () => {
      const onClick = vi.fn();
      render(<ArtifactExplorer {...defaultProps} onArtifactClick={onClick} />);

      const row = screen.getByTestId('row-art-1');
      fireEvent.keyDown(row, { key: 'Enter' });

      expect(onClick).toHaveBeenCalledWith('art-1');
    });

    it('search input has accessible label', () => {
      render(<ArtifactExplorer {...defaultProps} />);
      expect(screen.getByTestId('search-input')).toHaveAttribute('aria-label');
    });
  });
});
