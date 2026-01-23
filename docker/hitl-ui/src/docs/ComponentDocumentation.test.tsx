/**
 * Tests for component documentation and usage examples
 *
 * These tests serve as living documentation for key UI components.
 * Each test demonstrates a valid usage pattern.
 *
 * For components with complex props or dependencies (Router, complex state),
 * refer to their individual test files.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Core common components (stable, minimal dependencies)
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import StatsCard from '../components/common/StatsCard';
import MarkdownRenderer from '../components/common/MarkdownRenderer';

// Loading components
import { LoadingSpinner, LoadingOverlay, SkeletonCard, SkeletonLine } from '../components/common/LoadingStates';

// Error components
import ErrorBoundary from '../components/common/ErrorBoundary';
import { Toast, ToastContainer } from '../components/common/Toast';

// Gate components (stable exports)
import { GateTypeBadge, GateStatusBadge } from '../components/gates/GateBadge';
import FeedbackCapture from '../components/gates/FeedbackCapture';
import RuleProposalCard from '../components/gates/RuleProposalCard';

describe('Component Documentation', () => {
  describe('Common Components', () => {
    describe('Badge', () => {
      it('renders with default variant', () => {
        render(<Badge>Default Badge</Badge>);
        expect(screen.getByText('Default Badge')).toBeInTheDocument();
      });

      it('renders with all variants', () => {
        const variants = ['default', 'success', 'warning', 'error', 'info'] as const;
        variants.forEach((variant) => {
          const { unmount } = render(<Badge variant={variant}>{variant}</Badge>);
          expect(screen.getByText(variant)).toBeInTheDocument();
          unmount();
        });
      });

      it('supports custom className', () => {
        render(<Badge className="custom-class">Custom</Badge>);
        const badge = screen.getByText('Custom');
        expect(badge.className).toContain('custom-class');
      });
    });

    describe('Button', () => {
      it('renders with default props', () => {
        render(<Button>Click Me</Button>);
        expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
      });

      it('renders all variants', () => {
        const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;
        variants.forEach((variant) => {
          const { unmount } = render(<Button variant={variant}>{variant}</Button>);
          expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
          unmount();
        });
      });

      it('supports disabled state', () => {
        render(<Button disabled>Disabled</Button>);
        expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
      });

      it('supports loading state', () => {
        render(<Button loading>Loading</Button>);
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });

    describe('Card', () => {
      it('renders content', () => {
        render(
          <Card>
            <p>Card content</p>
          </Card>
        );
        expect(screen.getByText('Card content')).toBeInTheDocument();
      });

      it('applies custom className', () => {
        render(
          <Card className="custom-class">
            <p>Content</p>
          </Card>
        );
        expect(screen.getByText('Content').parentElement).toHaveClass('custom-class');
      });
    });

    describe('Spinner', () => {
      it('renders spinner', () => {
        render(<Spinner />);
        // Spinner renders an SVG element
        expect(document.querySelector('svg')).toBeInTheDocument();
      });
    });

    describe('EmptyState', () => {
      it('renders default message', () => {
        render(<EmptyState />);
        // EmptyState has fixed "No data" title
        expect(screen.getByText('No data')).toBeInTheDocument();
      });

      it('renders with action', () => {
        render(
          <EmptyState
            action={<Button>Add Item</Button>}
          />
        );
        expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
      });
    });

    describe('StatsCard', () => {
      it('renders stat value', () => {
        render(<StatsCard label="Total" value={42} />);
        expect(screen.getByText('42')).toBeInTheDocument();
      });
    });

    describe('MarkdownRenderer', () => {
      it('renders markdown content', () => {
        render(<MarkdownRenderer content="# Heading" />);
        expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument();
      });

      it('renders paragraphs', () => {
        render(<MarkdownRenderer content="This is a paragraph." />);
        expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    describe('LoadingSpinner', () => {
      it('renders with default size', () => {
        render(<LoadingSpinner />);
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      });

      it('renders with different sizes', () => {
        const sizes = ['sm', 'md', 'lg'] as const;
        sizes.forEach((size) => {
          const { unmount } = render(<LoadingSpinner size={size} />);
          expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
          unmount();
        });
      });
    });

    describe('LoadingOverlay', () => {
      it('renders with message', () => {
        render(<LoadingOverlay message="Loading data..." />);
        expect(screen.getByText('Loading data...')).toBeInTheDocument();
      });
    });

    describe('SkeletonLine', () => {
      it('renders skeleton line', () => {
        render(<SkeletonLine />);
        expect(screen.getByTestId('skeleton-line')).toBeInTheDocument();
      });
    });

    describe('SkeletonCard', () => {
      it('renders skeleton lines', () => {
        render(<SkeletonCard lines={3} />);
        const skeletons = screen.getAllByTestId('skeleton-line');
        expect(skeletons.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Error Handling', () => {
    describe('ErrorBoundary', () => {
      const ThrowingComponent = () => {
        throw new Error('Test error');
      };

      it('catches errors and renders fallback', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
          <ErrorBoundary fallback={<div>Error occurred</div>}>
            <ThrowingComponent />
          </ErrorBoundary>
        );

        expect(screen.getByText('Error occurred')).toBeInTheDocument();
        spy.mockRestore();
      });

      it('renders children when no error', () => {
        render(
          <ErrorBoundary fallback={<div>Error occurred</div>}>
            <div>Normal content</div>
          </ErrorBoundary>
        );

        expect(screen.getByText('Normal content')).toBeInTheDocument();
        expect(screen.queryByText('Error occurred')).not.toBeInTheDocument();
      });
    });

    describe('Toast', () => {
      it('renders toast message', () => {
        render(
          <Toast
            id="toast-1"
            type="success"
            message="Operation successful"
            onDismiss={() => {}}
          />
        );
        expect(screen.getByText('Operation successful')).toBeInTheDocument();
      });

      it('renders all toast types', () => {
        const types = ['success', 'error', 'warning', 'info'] as const;
        types.forEach((type) => {
          const { unmount } = render(
            <Toast
              id={`toast-${type}`}
              type={type}
              message={`${type} message`}
              onDismiss={() => {}}
            />
          );
          expect(screen.getByText(`${type} message`)).toBeInTheDocument();
          unmount();
        });
      });
    });

    describe('ToastContainer', () => {
      it('renders multiple toasts', () => {
        const toasts = [
          { id: '1', type: 'success' as const, message: 'Toast 1' },
          { id: '2', type: 'error' as const, message: 'Toast 2' },
        ];
        render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
        expect(screen.getByText('Toast 1')).toBeInTheDocument();
        expect(screen.getByText('Toast 2')).toBeInTheDocument();
      });
    });
  });

  describe('Gate Components', () => {
    describe('GateTypeBadge', () => {
      it('renders all gate types', () => {
        const types = ['approval', 'review', 'decision', 'validation'] as const;
        types.forEach((type) => {
          const { container, unmount } = render(<GateTypeBadge type={type} />);
          expect(container.querySelector('.badge')).toBeInTheDocument();
          unmount();
        });
      });
    });

    describe('GateStatusBadge', () => {
      it('renders all gate statuses', () => {
        const statuses = ['pending', 'approved', 'rejected', 'expired'] as const;
        statuses.forEach((status) => {
          const { container, unmount } = render(<GateStatusBadge status={status} />);
          expect(container.querySelector('.badge')).toBeInTheDocument();
          unmount();
        });
      });
    });

    describe('FeedbackCapture', () => {
      it('renders feedback form', () => {
        render(<FeedbackCapture gateId="gate-1" onSubmit={() => {}} />);
        expect(screen.getByTestId('feedback-capture')).toBeInTheDocument();
      });
    });

    describe('RuleProposalCard', () => {
      const mockProposal = {
        id: 'rule-1',
        title: 'New Rule Proposal',
        description: 'Rule description',
        proposedBy: 'agent-1',
        proposedAt: '2026-01-23T10:00:00Z',
        affectedAgents: ['agent-1', 'agent-2'],
        evidenceCount: 3,
        evidence: [],
        impact: {
          affected_agents: 2,
          estimated_change_rate: 10,
          confidence: 0.85,
        },
      };

      it('renders proposal information', () => {
        render(
          <RuleProposalCard
            proposal={mockProposal}
            onDecision={() => {}}
          />
        );
        expect(screen.getByText('New Rule Proposal')).toBeInTheDocument();
      });
    });
  });
});

/**
 * Components with complex dependencies (covered in their individual test files):
 *
 * Gates:
 * - GateCard (requires Router) - see GateCard.test.tsx
 * - SimilarRejectionPanel (requires patterns array) - see SimilarRejectionPanel.test.tsx
 *
 * Artifacts:
 * - ArtifactExplorer - see ArtifactExplorer.test.tsx
 * - SpecIndexBrowser (requires specIndex) - see SpecIndexBrowser.test.tsx
 *
 * Cockpit:
 * - KPIHeader - see KPIHeader.test.tsx
 * - RunsTable - see RunsTable.test.tsx
 * - WorkflowGraphView - see WorkflowGraphView.test.tsx
 *
 * Studio:
 * - ChatInterface (requires messages) - see ChatInterface.test.tsx
 * - WorkingOutlinePanel - see WorkingOutlinePanel.test.tsx
 * - ContextPackPreview (requires files) - see ContextPackPreview.test.tsx
 *
 * Docs:
 * - BlueprintMap (requires clusters) - see BlueprintMap.test.tsx
 * - MethodologyStepper (requires stages) - see MethodologyStepper.test.tsx
 * - InteractiveGlossary (requires terms) - see InteractiveGlossary.test.tsx
 */
