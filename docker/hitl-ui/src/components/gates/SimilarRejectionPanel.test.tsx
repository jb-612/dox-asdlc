/**
 * Tests for SimilarRejectionPanel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SimilarRejectionPanel, { type RejectionPattern } from './SimilarRejectionPanel';

describe('SimilarRejectionPanel', () => {
  const defaultPatterns: RejectionPattern[] = [
    {
      id: 'pat-1',
      description: 'Missing acceptance criteria in PRD',
      occurrences: 5,
      lastSeen: '2026-01-22T10:00:00Z',
      examples: [
        { artifactName: 'prd-auth.md', rejectReason: 'No acceptance criteria defined' },
        { artifactName: 'prd-dashboard.md', rejectReason: 'Acceptance criteria incomplete' },
      ],
      severity: 'high',
    },
    {
      id: 'pat-2',
      description: 'Code coverage below threshold',
      occurrences: 3,
      lastSeen: '2026-01-21T14:00:00Z',
      examples: [
        { artifactName: 'test-auth.json', rejectReason: 'Coverage 65%, required 80%' },
      ],
      severity: 'medium',
    },
    {
      id: 'pat-3',
      description: 'Security vulnerabilities detected',
      occurrences: 2,
      lastSeen: '2026-01-20T09:00:00Z',
      examples: [
        { artifactName: 'code-review.json', rejectReason: 'SQL injection vulnerability' },
      ],
      severity: 'high',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      expect(screen.getByTestId('similar-rejection-panel')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} className="my-custom-class" />);
      expect(screen.getByTestId('similar-rejection-panel')).toHaveClass('my-custom-class');
    });

    it('displays panel title', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      expect(screen.getByText(/similar rejection/i)).toBeInTheDocument();
    });

    it('displays pattern count', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      expect(screen.getByTestId('pattern-count')).toHaveTextContent('3');
    });
  });

  describe('Pattern List', () => {
    it('displays all patterns', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      expect(screen.getByTestId('pattern-pat-1')).toBeInTheDocument();
      expect(screen.getByTestId('pattern-pat-2')).toBeInTheDocument();
      expect(screen.getByTestId('pattern-pat-3')).toBeInTheDocument();
    });

    it('shows pattern description', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      expect(screen.getByText('Missing acceptance criteria in PRD')).toBeInTheDocument();
    });

    it('shows occurrence count', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      const pattern = screen.getByTestId('pattern-pat-1');
      expect(within(pattern).getByTestId('occurrence-count')).toHaveTextContent('5');
    });

    it('shows severity indicator', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      const pattern = screen.getByTestId('pattern-pat-1');
      expect(within(pattern).getByTestId('severity-badge')).toHaveTextContent(/high/i);
    });

    it('shows high severity with error styling', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      const pattern = screen.getByTestId('pattern-pat-1');
      const badge = within(pattern).getByTestId('severity-badge');
      expect(badge).toHaveClass('text-status-error');
    });

    it('shows medium severity with warning styling', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      const pattern = screen.getByTestId('pattern-pat-2');
      const badge = within(pattern).getByTestId('severity-badge');
      expect(badge).toHaveClass('text-status-warning');
    });
  });

  describe('Pattern Expansion', () => {
    it('patterns start collapsed', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      expect(screen.queryByTestId('examples-pat-1')).not.toBeInTheDocument();
    });

    it('expands pattern on click', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);

      fireEvent.click(screen.getByTestId('expand-pat-1'));

      expect(screen.getByTestId('examples-pat-1')).toBeInTheDocument();
    });

    it('shows examples when expanded', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);

      fireEvent.click(screen.getByTestId('expand-pat-1'));

      expect(screen.getByText('prd-auth.md')).toBeInTheDocument();
      expect(screen.getByText('prd-dashboard.md')).toBeInTheDocument();
    });

    it('shows reject reason in examples', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);

      fireEvent.click(screen.getByTestId('expand-pat-1'));

      expect(screen.getByText(/no acceptance criteria defined/i)).toBeInTheDocument();
    });

    it('collapses pattern when clicked again', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);

      fireEvent.click(screen.getByTestId('expand-pat-1'));
      expect(screen.getByTestId('examples-pat-1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('expand-pat-1'));
      expect(screen.queryByTestId('examples-pat-1')).not.toBeInTheDocument();
    });
  });

  describe('Ignore Action', () => {
    it('shows ignore button for each pattern', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      expect(screen.getByTestId('ignore-pat-1')).toBeInTheDocument();
    });

    it('calls onIgnore when ignore button clicked', () => {
      const onIgnore = vi.fn();
      render(<SimilarRejectionPanel patterns={defaultPatterns} onIgnorePattern={onIgnore} />);

      fireEvent.click(screen.getByTestId('ignore-pat-1'));

      expect(onIgnore).toHaveBeenCalledWith('pat-1');
    });

    it('shows ignore button text', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      const ignoreBtn = screen.getByTestId('ignore-pat-1');
      expect(ignoreBtn).toHaveTextContent(/ignore/i);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no patterns', () => {
      render(<SimilarRejectionPanel patterns={[]} />);
      expect(screen.getByText(/no similar rejections/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} isLoading />);
      expect(screen.getByTestId('panel-loading')).toBeInTheDocument();
    });

    it('shows skeleton items when loading', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} isLoading />);
      expect(screen.getAllByTestId('skeleton-pattern').length).toBeGreaterThan(0);
    });
  });

  describe('Last Seen', () => {
    it('shows last seen date', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      const pattern = screen.getByTestId('pattern-pat-1');
      expect(within(pattern).getByTestId('last-seen')).toBeInTheDocument();
    });
  });

  describe('Collapsible Panel', () => {
    it('shows collapse toggle', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);
      expect(screen.getByTestId('collapse-toggle')).toBeInTheDocument();
    });

    it('collapses entire panel when toggled', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);

      fireEvent.click(screen.getByTestId('collapse-toggle'));

      expect(screen.queryByTestId('pattern-list')).not.toBeInTheDocument();
    });

    it('expands panel when toggled again', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);

      fireEvent.click(screen.getByTestId('collapse-toggle'));
      fireEvent.click(screen.getByTestId('collapse-toggle'));

      expect(screen.getByTestId('pattern-list')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('expand buttons are keyboard accessible', () => {
      render(<SimilarRejectionPanel patterns={defaultPatterns} />);

      const expandBtn = screen.getByTestId('expand-pat-1');
      fireEvent.keyDown(expandBtn, { key: 'Enter' });

      expect(screen.getByTestId('examples-pat-1')).toBeInTheDocument();
    });

    it('ignore buttons are keyboard accessible', () => {
      const onIgnore = vi.fn();
      render(<SimilarRejectionPanel patterns={defaultPatterns} onIgnorePattern={onIgnore} />);

      const ignoreBtn = screen.getByTestId('ignore-pat-1');
      fireEvent.keyDown(ignoreBtn, { key: 'Enter' });

      expect(onIgnore).toHaveBeenCalled();
    });
  });
});
