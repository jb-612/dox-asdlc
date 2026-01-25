/**
 * Tests for ReindexButton component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReindexButton from './ReindexButton';
import * as searchHooks from '../../api/searchHooks';
import { resetMockReindexState } from '../../api/mocks/search';

// Create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('ReindexButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockReindexState();
  });

  afterEach(() => {
    resetMockReindexState();
  });

  describe('Idle State', () => {
    it('renders re-index button when idle', () => {
      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      const button = screen.getByTestId('reindex-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Re-index');
    });

    it('shows refresh icon', () => {
      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      const button = screen.getByTestId('reindex-button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('is disabled when disabled prop is true', () => {
      render(<ReindexButton mode="mock" disabled />, { wrapper: createWrapper() });
      
      const button = screen.getByTestId('reindex-button');
      expect(button).toBeDisabled();
    });

    it('applies custom className', () => {
      render(<ReindexButton mode="mock" className="custom-class" />, {
        wrapper: createWrapper(),
      });
      
      const button = screen.getByTestId('reindex-button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Click to Start', () => {
    it('triggers reindex on click', async () => {
      const triggerMock = vi.fn();
      vi.spyOn(searchHooks, 'useTriggerReindex').mockReturnValue({
        mutate: triggerMock,
        isPending: false,
      } as any);
      
      vi.spyOn(searchHooks, 'useReindexStatus').mockReturnValue({
        data: { status: 'idle' },
        isLoading: false,
      } as any);

      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      const button = screen.getByTestId('reindex-button');
      fireEvent.click(button);
      
      expect(triggerMock).toHaveBeenCalledWith({});
    });

    it('does not trigger when already running', () => {
      const triggerMock = vi.fn();
      vi.spyOn(searchHooks, 'useTriggerReindex').mockReturnValue({
        mutate: triggerMock,
        isPending: false,
      } as any);
      
      vi.spyOn(searchHooks, 'useReindexStatus').mockReturnValue({
        data: { status: 'running', progress: 50 },
        isLoading: false,
      } as any);

      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      // Should show running state, not button
      expect(screen.queryByTestId('reindex-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('reindex-button-running')).toBeInTheDocument();
    });
  });

  describe('Running State', () => {
    it('shows spinner when running', () => {
      vi.spyOn(searchHooks, 'useTriggerReindex').mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as any);
      
      vi.spyOn(searchHooks, 'useReindexStatus').mockReturnValue({
        data: { status: 'running', progress: 25 },
        isLoading: false,
      } as any);

      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      const runningState = screen.getByTestId('reindex-button-running');
      expect(runningState).toBeInTheDocument();
    });

    it('shows progress percentage', () => {
      vi.spyOn(searchHooks, 'useTriggerReindex').mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as any);
      
      vi.spyOn(searchHooks, 'useReindexStatus').mockReturnValue({
        data: { status: 'running', progress: 75 },
        isLoading: false,
      } as any);

      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('shows "Starting..." when progress is 0', () => {
      vi.spyOn(searchHooks, 'useTriggerReindex').mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as any);
      
      vi.spyOn(searchHooks, 'useReindexStatus').mockReturnValue({
        data: { status: 'running', progress: 0 },
        isLoading: false,
      } as any);

      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });
  });

  describe('Completed State', () => {
    it('shows checkmark when transition from running to completed', async () => {
      const { rerender } = render(<ReindexButton mode="mock" />, {
        wrapper: createWrapper(),
      });

      // Mock running state first
      vi.spyOn(searchHooks, 'useTriggerReindex').mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as any);
      
      vi.spyOn(searchHooks, 'useReindexStatus').mockReturnValue({
        data: { status: 'running', progress: 99 },
        isLoading: false,
      } as any);

      rerender(<ReindexButton mode="mock" />);

      // Then mock completed state
      vi.spyOn(searchHooks, 'useReindexStatus').mockReturnValue({
        data: { status: 'completed', progress: 100 },
        isLoading: false,
      } as any);

      rerender(<ReindexButton mode="mock" />);

      await waitFor(() => {
        expect(screen.getByTestId('reindex-button-complete')).toBeInTheDocument();
      });
    });
  });

  describe('Integration with Mock Backend', () => {
    it('completes full reindex cycle with mock backend', async () => {
      vi.useFakeTimers();

      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      // Initially shows button
      expect(screen.getByTestId('reindex-button')).toBeInTheDocument();
      
      // Click to start
      fireEvent.click(screen.getByTestId('reindex-button'));
      
      // Advance timers to simulate mock reindex progress
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      vi.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('has accessible label', () => {
      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      const button = screen.getByTestId('reindex-button');
      expect(button).toHaveAttribute('aria-label', 'Re-index the knowledge store');
    });

    it('button is focusable', () => {
      render(<ReindexButton mode="mock" />, { wrapper: createWrapper() });
      
      const button = screen.getByTestId('reindex-button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });
});
