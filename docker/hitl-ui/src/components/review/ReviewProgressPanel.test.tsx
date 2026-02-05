/**
 * Tests for Review Progress Components (T09-T12)
 *
 * Tests for:
 * - ReviewProgressPanel (T09)
 * - ThreeLaneView (T10)
 * - CLIMimicView (T11)
 * - TokenCostCounter (T12)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ReviewProgressPanel } from './ReviewProgressPanel';
import { ThreeLaneView } from './ThreeLaneView';
import { CLIMimicView } from './CLIMimicView';
import { TokenCostCounter } from './TokenCostCounter';
import { useReviewStore } from '../../stores/reviewStore';
import type { ReviewerProgress, CLIEntry } from '../../stores/reviewStore';

// Mock the swarm API
vi.mock('../../api/swarm', () => ({
  useSwarmStatus: vi.fn(),
}));

import { useSwarmStatus } from '../../api/swarm';

// Create a wrapper with QueryClient for components that need it
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// TokenCostCounter Tests (T12)
// ============================================================================

describe('TokenCostCounter', () => {
  describe('Token Formatting', () => {
    it('formats tokens below 1K without suffix', () => {
      render(
        <TokenCostCounter tokensUsed={500} estimatedCost={0.001} isRunning={false} />
      );

      expect(screen.getByTestId('token-count')).toHaveTextContent('500 tokens');
    });

    it('formats tokens with K suffix', () => {
      render(
        <TokenCostCounter tokensUsed={1500} estimatedCost={0.001} isRunning={false} />
      );

      expect(screen.getByTestId('token-count')).toHaveTextContent('1.5K tokens');
    });

    it('formats tokens with M suffix', () => {
      render(
        <TokenCostCounter
          tokensUsed={1500000}
          estimatedCost={0.001}
          isRunning={false}
        />
      );

      expect(screen.getByTestId('token-count')).toHaveTextContent('1.5M tokens');
    });

    it('formats zero tokens', () => {
      render(
        <TokenCostCounter tokensUsed={0} estimatedCost={0} isRunning={false} />
      );

      expect(screen.getByTestId('token-count')).toHaveTextContent('0 tokens');
    });
  });

  describe('Cost Formatting', () => {
    it('formats cost with 4 decimal places', () => {
      render(
        <TokenCostCounter tokensUsed={1000} estimatedCost={0.0015} isRunning={false} />
      );

      expect(screen.getByTestId('cost-display')).toHaveTextContent('$0.0015');
    });

    it('formats zero cost', () => {
      render(
        <TokenCostCounter tokensUsed={0} estimatedCost={0} isRunning={false} />
      );

      expect(screen.getByTestId('cost-display')).toHaveTextContent('$0.0000');
    });

    it('formats larger costs', () => {
      render(
        <TokenCostCounter tokensUsed={1000000} estimatedCost={1.5} isRunning={false} />
      );

      expect(screen.getByTestId('cost-display')).toHaveTextContent('$1.5000');
    });
  });

  describe('Running Indicator', () => {
    it('shows running indicator when isRunning is true', () => {
      render(
        <TokenCostCounter tokensUsed={1000} estimatedCost={0.001} isRunning={true} />
      );

      expect(screen.getByTestId('running-indicator')).toBeInTheDocument();
    });

    it('hides running indicator when isRunning is false', () => {
      render(
        <TokenCostCounter tokensUsed={1000} estimatedCost={0.001} isRunning={false} />
      );

      expect(screen.queryByTestId('running-indicator')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// CLIMimicView Tests (T11)
// ============================================================================

describe('CLIMimicView', () => {
  const createEntry = (
    overrides: Partial<CLIEntry> = {}
  ): CLIEntry => ({
    timestamp: '2025-01-21T10:30:45Z',
    reviewer: 'security',
    message: 'Test message',
    type: 'info',
    ...overrides,
  });

  describe('Rendering', () => {
    it('shows empty message when no entries', () => {
      render(<CLIMimicView entries={[]} />);

      expect(screen.getByTestId('empty-message')).toHaveTextContent(
        'Waiting for output...'
      );
    });

    it('renders entries with correct formatting', () => {
      const entries = [createEntry({ message: 'Security check started' })];

      render(<CLIMimicView entries={entries} />);

      expect(screen.getByTestId('cli-entry')).toBeInTheDocument();
      expect(screen.getByText('[INFO]')).toBeInTheDocument();
      expect(screen.getByText('[security]')).toBeInTheDocument();
      expect(screen.getByText('Security check started')).toBeInTheDocument();
    });

    it('applies correct color classes for different reviewers', () => {
      const entries = [
        createEntry({ reviewer: 'security', message: 'Security' }),
        createEntry({ reviewer: 'performance', message: 'Performance' }),
        createEntry({ reviewer: 'style', message: 'Style' }),
      ];

      render(<CLIMimicView entries={entries} />);

      expect(screen.getByText('[security]')).toHaveClass('text-purple-400');
      expect(screen.getByText('[performance]')).toHaveClass('text-teal-400');
      expect(screen.getByText('[style]')).toHaveClass('text-blue-400');
    });

    it('applies error styling for error type', () => {
      const entries = [createEntry({ type: 'error', message: 'Error occurred' })];

      render(<CLIMimicView entries={entries} />);

      expect(screen.getByText('[ERR!]')).toHaveClass('text-red-400');
    });

    it('shows correct type prefixes', () => {
      const entries = [
        createEntry({ type: 'info' }),
        createEntry({ type: 'progress' }),
        createEntry({ type: 'finding' }),
        createEntry({ type: 'error' }),
      ];

      render(<CLIMimicView entries={entries} />);

      expect(screen.getByText('[INFO]')).toBeInTheDocument();
      expect(screen.getByText('[PROG]')).toBeInTheDocument();
      expect(screen.getByText('[FIND]')).toBeInTheDocument();
      expect(screen.getByText('[ERR!]')).toBeInTheDocument();
    });
  });

  describe('Max Lines', () => {
    it('limits entries to maxLines', () => {
      const entries = Array.from({ length: 150 }, (_, i) =>
        createEntry({ message: `Message ${i}` })
      );

      render(<CLIMimicView entries={entries} maxLines={100} />);

      const cliEntries = screen.getAllByTestId('cli-entry');
      expect(cliEntries).toHaveLength(100);
    });

    it('shows most recent entries when limiting', () => {
      const entries = Array.from({ length: 150 }, (_, i) =>
        createEntry({ message: `Message ${i}` })
      );

      render(<CLIMimicView entries={entries} maxLines={10} />);

      // Should show messages 140-149 (last 10)
      expect(screen.getByText('Message 149')).toBeInTheDocument();
      expect(screen.getByText('Message 140')).toBeInTheDocument();
      expect(screen.queryByText('Message 139')).not.toBeInTheDocument();
    });
  });

  describe('Auto-Scroll', () => {
    it('does not show resume button initially', () => {
      const entries = [createEntry()];

      render(<CLIMimicView entries={entries} />);

      expect(screen.queryByTestId('resume-scroll-button')).not.toBeInTheDocument();
    });

    it('shows resume button when user scrolls up', () => {
      const entries = Array.from({ length: 50 }, (_, i) =>
        createEntry({ message: `Message ${i}` })
      );

      render(<CLIMimicView entries={entries} />);

      const container = screen.getByTestId('cli-output-container');

      // Simulate scrolling up (not at bottom) using Object.defineProperty with configurable
      Object.defineProperty(container, 'scrollHeight', {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(container, 'scrollTop', {
        value: 0,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(container, 'clientHeight', {
        value: 200,
        configurable: true,
      });

      fireEvent.scroll(container);

      expect(screen.getByTestId('resume-scroll-button')).toBeInTheDocument();
    });

    it('resume button click re-enables auto-scroll', async () => {
      const entries = Array.from({ length: 50 }, (_, i) =>
        createEntry({ message: `Message ${i}` })
      );

      const { rerender } = render(<CLIMimicView entries={entries} />);

      const container = screen.getByTestId('cli-output-container');

      // Simulate scrolling up to show button - make properties writable
      Object.defineProperty(container, 'scrollHeight', {
        value: 1000,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(container, 'scrollTop', {
        value: 0,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(container, 'clientHeight', {
        value: 200,
        configurable: true,
        writable: true,
      });
      fireEvent.scroll(container);

      // Button should be visible
      expect(screen.getByTestId('resume-scroll-button')).toBeInTheDocument();

      // Simulate being at bottom before clicking
      Object.defineProperty(container, 'scrollTop', {
        value: 800,
        configurable: true,
        writable: true,
      });

      const resumeButton = screen.getByTestId('resume-scroll-button');
      fireEvent.click(resumeButton);

      // After clicking, button should be hidden because autoScroll is now true
      expect(screen.queryByTestId('resume-scroll-button')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// ThreeLaneView Tests (T10)
// ============================================================================

describe('ThreeLaneView', () => {
  const createReviewerProgress = (
    type: 'security' | 'performance' | 'style',
    overrides: Partial<ReviewerProgress> = {}
  ): ReviewerProgress => ({
    type,
    status: 'pending',
    progress: 0,
    filesReviewed: 0,
    findingsCount: 0,
    ...overrides,
  });

  describe('Rendering', () => {
    it('renders all three lanes when all reviewers provided', () => {
      const reviewers = [
        createReviewerProgress('security'),
        createReviewerProgress('performance'),
        createReviewerProgress('style'),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByTestId('reviewer-lane-security')).toBeInTheDocument();
      expect(screen.getByTestId('reviewer-lane-performance')).toBeInTheDocument();
      expect(screen.getByTestId('reviewer-lane-style')).toBeInTheDocument();
    });

    it('orders lanes as security, performance, style', () => {
      const reviewers = [
        createReviewerProgress('style'),
        createReviewerProgress('security'),
        createReviewerProgress('performance'),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      const lanes = screen.getAllByTestId(/reviewer-lane-/);
      expect(lanes[0]).toHaveAttribute('data-testid', 'reviewer-lane-security');
      expect(lanes[1]).toHaveAttribute('data-testid', 'reviewer-lane-performance');
      expect(lanes[2]).toHaveAttribute('data-testid', 'reviewer-lane-style');
    });

    it('renders only provided reviewers', () => {
      const reviewers = [createReviewerProgress('security')];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByTestId('reviewer-lane-security')).toBeInTheDocument();
      expect(screen.queryByTestId('reviewer-lane-performance')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reviewer-lane-style')).not.toBeInTheDocument();
    });

    it('displays correct labels', () => {
      const reviewers = [
        createReviewerProgress('security'),
        createReviewerProgress('performance'),
        createReviewerProgress('style'),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Style')).toBeInTheDocument();
    });
  });

  describe('Progress Bars', () => {
    it('shows correct progress width', () => {
      const reviewers = [
        createReviewerProgress('security', { progress: 50 }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      const progressFill = screen.getByTestId('progress-fill-security');
      expect(progressFill).toHaveStyle({ width: '50%' });
    });

    it('shows 0% for pending reviewers', () => {
      const reviewers = [
        createReviewerProgress('security', { status: 'pending', progress: 0 }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      const progressFill = screen.getByTestId('progress-fill-security');
      expect(progressFill).toHaveStyle({ width: '0%' });
    });

    it('shows 100% for complete reviewers', () => {
      const reviewers = [
        createReviewerProgress('security', { status: 'complete', progress: 100 }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      const progressFill = screen.getByTestId('progress-fill-security');
      expect(progressFill).toHaveStyle({ width: '100%' });
    });

    it('animates in_progress reviewers', () => {
      const reviewers = [
        createReviewerProgress('security', { status: 'in_progress', progress: 50 }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      const progressFill = screen.getByTestId('progress-fill-security');
      expect(progressFill).toHaveClass('animate-pulse');
    });
  });

  describe('Status Badges', () => {
    it('shows pending status', () => {
      const reviewers = [
        createReviewerProgress('security', { status: 'pending' }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByTestId('status-badge-pending')).toHaveTextContent('pending');
    });

    it('shows in_progress status with spinner', () => {
      const reviewers = [
        createReviewerProgress('security', { status: 'in_progress' }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByTestId('status-badge-in_progress')).toHaveTextContent('in progress');
      expect(screen.getByTestId('spinner-icon')).toBeInTheDocument();
    });

    it('shows complete status with check icon', () => {
      const reviewers = [
        createReviewerProgress('security', { status: 'complete' }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByTestId('status-badge-complete')).toHaveTextContent('complete');
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    });

    it('shows failed status with x icon', () => {
      const reviewers = [
        createReviewerProgress('security', { status: 'failed' }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByTestId('status-badge-failed')).toHaveTextContent('failed');
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });
  });

  describe('Stats Display', () => {
    it('displays files count', () => {
      const reviewers = [
        createReviewerProgress('security', { filesReviewed: 25 }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByTestId('files-count-security')).toHaveTextContent('25 files');
    });

    it('displays findings count', () => {
      const reviewers = [
        createReviewerProgress('security', { findingsCount: 5 }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByTestId('findings-count-security')).toHaveTextContent('5 findings');
    });

    it('displays duration when complete', () => {
      const reviewers = [
        createReviewerProgress('security', {
          status: 'complete',
          durationSeconds: 12.5,
        }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.getByTestId('duration-security')).toHaveTextContent(
        'Completed in 12.5s'
      );
    });

    it('does not display duration when undefined', () => {
      const reviewers = [
        createReviewerProgress('security', { status: 'in_progress' }),
      ];

      render(<ThreeLaneView reviewers={reviewers} />);

      expect(screen.queryByTestId('duration-security')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// ReviewProgressPanel Tests (T09)
// ============================================================================

describe('ReviewProgressPanel', () => {
  const mockOnComplete = vi.fn();
  const mockUseSwarmStatus = useSwarmStatus as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the store before each test
    act(() => {
      useReviewStore.getState().reset();
      // Initialize with reviewers
      useReviewStore.getState().startReview({
        target: 'test-repo',
        scope: 'full_repo',
        reviewers: { security: true, performance: true, style: true },
      });
    });
  });

  afterEach(() => {
    act(() => {
      useReviewStore.getState().reset();
    });
  });

  describe('Loading State', () => {
    it('shows loading state when fetching initial data', () => {
      mockUseSwarmStatus.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(
        <ReviewProgressPanel swarmId="test-swarm" onComplete={mockOnComplete} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('displays error message when fetch fails', () => {
      mockUseSwarmStatus.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
      });

      render(
        <ReviewProgressPanel swarmId="test-swarm" onComplete={mockOnComplete} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  describe('Normal Operation', () => {
    it('renders all child components', async () => {
      mockUseSwarmStatus.mockReturnValue({
        data: {
          swarm_id: 'test-swarm',
          status: 'in_progress',
          reviewers: {
            security: {
              status: 'in_progress',
              files_reviewed: 5,
              findings_count: 2,
              progress_percent: 50,
            },
            performance: {
              status: 'pending',
              files_reviewed: 0,
              findings_count: 0,
              progress_percent: 0,
            },
            style: {
              status: 'pending',
              files_reviewed: 0,
              findings_count: 0,
              progress_percent: 0,
            },
          },
        },
        isLoading: false,
        error: null,
      });

      await act(async () => {
        render(
          <ReviewProgressPanel swarmId="test-swarm" onComplete={mockOnComplete} />,
          { wrapper: createWrapper() }
        );
      });

      expect(screen.getByTestId('review-progress-panel')).toBeInTheDocument();
      expect(screen.getByTestId('three-lane-view')).toBeInTheDocument();
      expect(screen.getByTestId('cli-mimic-view')).toBeInTheDocument();
      expect(screen.getByTestId('token-cost-counter')).toBeInTheDocument();
    });

    it('displays title', async () => {
      mockUseSwarmStatus.mockReturnValue({
        data: {
          swarm_id: 'test-swarm',
          status: 'in_progress',
          reviewers: {},
        },
        isLoading: false,
        error: null,
      });

      await act(async () => {
        render(
          <ReviewProgressPanel swarmId="test-swarm" onComplete={mockOnComplete} />,
          { wrapper: createWrapper() }
        );
      });

      expect(screen.getByText('Review in Progress')).toBeInTheDocument();
    });
  });

  describe('Completion Handling', () => {
    it('calls onComplete when status is complete', async () => {
      mockUseSwarmStatus.mockReturnValue({
        data: {
          swarm_id: 'test-swarm',
          status: 'complete',
          reviewers: {
            security: {
              status: 'complete',
              files_reviewed: 10,
              findings_count: 3,
              progress_percent: 100,
              duration_seconds: 5.5,
            },
          },
        },
        isLoading: false,
        error: null,
      });

      await act(async () => {
        render(
          <ReviewProgressPanel swarmId="test-swarm" onComplete={mockOnComplete} />,
          { wrapper: createWrapper() }
        );
      });

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it('calls onComplete when status is failed', async () => {
      mockUseSwarmStatus.mockReturnValue({
        data: {
          swarm_id: 'test-swarm',
          status: 'failed',
          reviewers: {},
        },
        isLoading: false,
        error: null,
      });

      await act(async () => {
        render(
          <ReviewProgressPanel swarmId="test-swarm" onComplete={mockOnComplete} />,
          { wrapper: createWrapper() }
        );
      });

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Store Updates', () => {
    it('updates store with reviewer progress', async () => {
      mockUseSwarmStatus.mockReturnValue({
        data: {
          swarm_id: 'test-swarm',
          status: 'in_progress',
          reviewers: {
            security: {
              status: 'in_progress',
              files_reviewed: 5,
              findings_count: 2,
              progress_percent: 50,
            },
          },
        },
        isLoading: false,
        error: null,
      });

      await act(async () => {
        render(
          <ReviewProgressPanel swarmId="test-swarm" onComplete={mockOnComplete} />,
          { wrapper: createWrapper() }
        );
      });

      await waitFor(() => {
        const state = useReviewStore.getState();
        expect(state.reviewerProgress.security?.progress).toBe(50);
        expect(state.reviewerProgress.security?.filesReviewed).toBe(5);
        expect(state.reviewerProgress.security?.findingsCount).toBe(2);
      });
    });
  });

  describe('TokenCostCounter Integration', () => {
    it('shows running indicator when status is in_progress', async () => {
      mockUseSwarmStatus.mockReturnValue({
        data: {
          swarm_id: 'test-swarm',
          status: 'in_progress',
          reviewers: {},
        },
        isLoading: false,
        error: null,
      });

      await act(async () => {
        render(
          <ReviewProgressPanel swarmId="test-swarm" onComplete={mockOnComplete} />,
          { wrapper: createWrapper() }
        );
      });

      expect(screen.getByTestId('running-indicator')).toBeInTheDocument();
    });

    it('hides running indicator when status is complete', async () => {
      mockUseSwarmStatus.mockReturnValue({
        data: {
          swarm_id: 'test-swarm',
          status: 'complete',
          reviewers: {},
        },
        isLoading: false,
        error: null,
      });

      await act(async () => {
        render(
          <ReviewProgressPanel swarmId="test-swarm" onComplete={mockOnComplete} />,
          { wrapper: createWrapper() }
        );
      });

      expect(screen.queryByTestId('running-indicator')).not.toBeInTheDocument();
    });
  });
});
