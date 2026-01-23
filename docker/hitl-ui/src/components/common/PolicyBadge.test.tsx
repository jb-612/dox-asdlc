/**
 * Tests for PolicyBadge component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PolicyBadge, { type PolicyType, type PolicyStatus } from './PolicyBadge';

describe('PolicyBadge', () => {
  const defaultProps = {
    type: 'approval_required' as PolicyType,
    name: 'Approval Required',
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<PolicyBadge {...defaultProps} />);
      expect(screen.getByTestId('policy-badge')).toBeInTheDocument();
    });

    it('displays policy name', () => {
      render(<PolicyBadge {...defaultProps} />);
      expect(screen.getByTestId('policy-name')).toHaveTextContent('Approval Required');
    });

    it('shows icon by default', () => {
      render(<PolicyBadge {...defaultProps} />);
      expect(screen.getByTestId('policy-icon')).toBeInTheDocument();
    });

    it('hides icon when showIcon is false', () => {
      render(<PolicyBadge {...defaultProps} showIcon={false} />);
      expect(screen.queryByTestId('policy-icon')).not.toBeInTheDocument();
    });

    it('shows status indicator', () => {
      render(<PolicyBadge {...defaultProps} />);
      expect(screen.getByTestId('policy-status')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<PolicyBadge {...defaultProps} className="my-custom-class" />);
      expect(screen.getByTestId('policy-badge').firstChild).toHaveClass('my-custom-class');
    });
  });

  describe('Policy Types', () => {
    const policyTypes: PolicyType[] = [
      'approval_required',
      'security_scan',
      'review_mandatory',
      'audit_trail',
      'time_limit',
      'compliance',
    ];

    it.each(policyTypes)('renders %s policy type correctly', (type) => {
      render(<PolicyBadge type={type} name={`Policy ${type}`} />);
      expect(screen.getByTestId('policy-badge')).toBeInTheDocument();
      expect(screen.getByTestId('policy-name')).toHaveTextContent(`Policy ${type}`);
    });
  });

  describe('Status Variants', () => {
    const statuses: PolicyStatus[] = ['active', 'inactive', 'warning', 'violated'];

    it.each(statuses)('renders %s status correctly', (status) => {
      render(<PolicyBadge {...defaultProps} status={status} />);
      expect(screen.getByTestId('policy-status')).toBeInTheDocument();
    });

    it('defaults to active status', () => {
      render(<PolicyBadge {...defaultProps} />);
      const statusIndicator = screen.getByTestId('policy-status');
      expect(statusIndicator).toHaveClass('bg-status-success');
    });

    it('shows inactive status with gray color', () => {
      render(<PolicyBadge {...defaultProps} status="inactive" />);
      const statusIndicator = screen.getByTestId('policy-status');
      expect(statusIndicator).toHaveClass('bg-gray-500');
    });

    it('shows warning status with warning color', () => {
      render(<PolicyBadge {...defaultProps} status="warning" />);
      const statusIndicator = screen.getByTestId('policy-status');
      expect(statusIndicator).toHaveClass('bg-status-warning');
    });

    it('shows violated status with error color', () => {
      render(<PolicyBadge {...defaultProps} status="violated" />);
      const statusIndicator = screen.getByTestId('policy-status');
      expect(statusIndicator).toHaveClass('bg-status-error');
    });
  });

  describe('Size Variants', () => {
    it('renders sm size correctly', () => {
      render(<PolicyBadge {...defaultProps} size="sm" />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveClass('text-xs');
    });

    it('renders md size correctly', () => {
      render(<PolicyBadge {...defaultProps} size="md" />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveClass('text-sm');
    });

    it('renders lg size correctly', () => {
      render(<PolicyBadge {...defaultProps} size="lg" />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveClass('text-base');
    });

    it('defaults to md size', () => {
      render(<PolicyBadge {...defaultProps} />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveClass('text-sm');
    });
  });

  describe('Tooltip', () => {
    const detailsProps = {
      ...defaultProps,
      details: {
        description: 'This policy requires approval before proceeding.',
        enforcement: 'strict' as const,
        activatedBy: 'admin',
        activatedAt: '2026-01-20T10:00:00Z',
      },
    };

    it('shows tooltip on hover', () => {
      render(<PolicyBadge {...detailsProps} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);

      expect(screen.getByTestId('policy-tooltip')).toBeInTheDocument();
    });

    it('hides tooltip on mouse leave', () => {
      render(<PolicyBadge {...detailsProps} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);
      expect(screen.getByTestId('policy-tooltip')).toBeInTheDocument();

      fireEvent.mouseLeave(badge);
      expect(screen.queryByTestId('policy-tooltip')).not.toBeInTheDocument();
    });

    it('displays policy description in tooltip', () => {
      render(<PolicyBadge {...detailsProps} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);

      expect(screen.getByText('This policy requires approval before proceeding.')).toBeInTheDocument();
    });

    it('displays enforcement level in tooltip', () => {
      render(<PolicyBadge {...detailsProps} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);

      expect(screen.getByText('Strictly Enforced')).toBeInTheDocument();
    });

    it('displays activated by in tooltip', () => {
      render(<PolicyBadge {...detailsProps} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);

      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    it('displays activation date in tooltip', () => {
      render(<PolicyBadge {...detailsProps} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);

      // Date formatting may vary by locale, just check it's present
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it('displays current status in tooltip', () => {
      render(<PolicyBadge {...detailsProps} status="warning" />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);

      expect(screen.getByText('warning')).toBeInTheDocument();
    });

    it('does not show tooltip without details', () => {
      render(<PolicyBadge {...defaultProps} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);

      expect(screen.queryByTestId('policy-tooltip')).not.toBeInTheDocument();
    });

    it('shows advisory enforcement level', () => {
      render(
        <PolicyBadge
          {...defaultProps}
          details={{ description: 'Test', enforcement: 'advisory' }}
        />
      );

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);

      expect(screen.getByText('Advisory')).toBeInTheDocument();
    });

    it('shows optional enforcement level', () => {
      render(
        <PolicyBadge
          {...defaultProps}
          details={{ description: 'Test', enforcement: 'optional' }}
        />
      );

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.mouseEnter(badge);

      expect(screen.getByText('Optional')).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick when badge is clicked', () => {
      const onClick = vi.fn();
      render(<PolicyBadge {...defaultProps} onClick={onClick} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.click(badge);

      expect(onClick).toHaveBeenCalled();
    });

    it('applies cursor-pointer when onClick is provided', () => {
      render(<PolicyBadge {...defaultProps} onClick={() => {}} />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveClass('cursor-pointer');
    });

    it('has role=button when onClick is provided', () => {
      render(<PolicyBadge {...defaultProps} onClick={() => {}} />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveAttribute('role', 'button');
    });

    it('supports keyboard activation with Enter', () => {
      const onClick = vi.fn();
      render(<PolicyBadge {...defaultProps} onClick={onClick} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.keyDown(badge, { key: 'Enter' });

      expect(onClick).toHaveBeenCalled();
    });

    it('supports keyboard activation with Space', () => {
      const onClick = vi.fn();
      render(<PolicyBadge {...defaultProps} onClick={onClick} />);

      const badge = screen.getByTestId('policy-badge').firstChild!;
      fireEvent.keyDown(badge, { key: ' ' });

      expect(onClick).toHaveBeenCalled();
    });

    it('has tabIndex when onClick is provided', () => {
      render(<PolicyBadge {...defaultProps} onClick={() => {}} />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveAttribute('tabindex', '0');
    });
  });

  describe('Type-Specific Colors', () => {
    it('approval_required has teal color', () => {
      render(<PolicyBadge type="approval_required" name="Test" />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveClass('text-accent-teal');
    });

    it('security_scan has warning color', () => {
      render(<PolicyBadge type="security_scan" name="Test" />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveClass('text-status-warning');
    });

    it('review_mandatory has info color', () => {
      render(<PolicyBadge type="review_mandatory" name="Test" />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveClass('text-status-info');
    });

    it('compliance has success color', () => {
      render(<PolicyBadge type="compliance" name="Test" />);
      const badge = screen.getByTestId('policy-badge').firstChild;
      expect(badge).toHaveClass('text-status-success');
    });
  });
});
