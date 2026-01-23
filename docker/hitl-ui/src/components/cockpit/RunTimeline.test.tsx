/**
 * Tests for RunTimeline component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RunTimeline, { type TimelineEvent } from './RunTimeline';

describe('RunTimeline', () => {
  const defaultEvents: TimelineEvent[] = [
    {
      id: 'evt-1',
      type: 'start',
      timestamp: '2026-01-23T10:00:00Z',
      message: 'Run started',
      details: { agent: 'PRD Agent', cluster: 'Discovery' },
    },
    {
      id: 'evt-2',
      type: 'tool_call',
      timestamp: '2026-01-23T10:00:30Z',
      message: 'Calling tool: read_file',
      details: { tool: 'read_file', args: { path: '/src/main.ts' } },
    },
    {
      id: 'evt-3',
      type: 'tool_call',
      timestamp: '2026-01-23T10:01:00Z',
      message: 'Calling tool: write_file',
      details: { tool: 'write_file', args: { path: '/src/new.ts' } },
    },
    {
      id: 'evt-4',
      type: 'artifact',
      timestamp: '2026-01-23T10:01:30Z',
      message: 'Artifact created: PRD.md',
      details: { artifact: 'PRD.md', type: 'document' },
    },
    {
      id: 'evt-5',
      type: 'completion',
      timestamp: '2026-01-23T10:02:00Z',
      message: 'Run completed successfully',
      details: { duration: 120, tokens: 5000 },
    },
  ];

  const failedEvents: TimelineEvent[] = [
    {
      id: 'evt-1',
      type: 'start',
      timestamp: '2026-01-23T10:00:00Z',
      message: 'Run started',
    },
    {
      id: 'evt-2',
      type: 'failure',
      timestamp: '2026-01-23T10:01:00Z',
      message: 'Run failed: Compilation error',
      details: { error: 'TypeError: undefined is not a function', code: 'ERR_COMPILE' },
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RunTimeline events={defaultEvents} />);
      expect(screen.getByTestId('run-timeline')).toBeInTheDocument();
    });

    it('renders timeline title', () => {
      render(<RunTimeline events={defaultEvents} />);
      expect(screen.getByText(/timeline/i)).toBeInTheDocument();
    });

    it('renders all events', () => {
      render(<RunTimeline events={defaultEvents} />);
      expect(screen.getByTestId('event-evt-1')).toBeInTheDocument();
      expect(screen.getByTestId('event-evt-2')).toBeInTheDocument();
      expect(screen.getByTestId('event-evt-3')).toBeInTheDocument();
      expect(screen.getByTestId('event-evt-4')).toBeInTheDocument();
      expect(screen.getByTestId('event-evt-5')).toBeInTheDocument();
    });

    it('displays event messages', () => {
      render(<RunTimeline events={defaultEvents} />);
      expect(screen.getByText('Run started')).toBeInTheDocument();
      expect(screen.getByText('Calling tool: read_file')).toBeInTheDocument();
      expect(screen.getByText('Run completed successfully')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<RunTimeline events={defaultEvents} className="my-custom-class" />);
      expect(screen.getByTestId('run-timeline')).toHaveClass('my-custom-class');
    });
  });

  describe('Event Types', () => {
    it('shows start marker', () => {
      render(<RunTimeline events={defaultEvents} />);
      const startEvent = screen.getByTestId('event-evt-1');
      expect(startEvent.querySelector('[data-testid="marker-start"]')).toBeInTheDocument();
    });

    it('shows tool call marker', () => {
      render(<RunTimeline events={defaultEvents} />);
      const toolEvent = screen.getByTestId('event-evt-2');
      expect(toolEvent.querySelector('[data-testid="marker-tool_call"]')).toBeInTheDocument();
    });

    it('shows artifact marker', () => {
      render(<RunTimeline events={defaultEvents} />);
      const artifactEvent = screen.getByTestId('event-evt-4');
      expect(artifactEvent.querySelector('[data-testid="marker-artifact"]')).toBeInTheDocument();
    });

    it('shows completion marker', () => {
      render(<RunTimeline events={defaultEvents} />);
      const completionEvent = screen.getByTestId('event-evt-5');
      expect(completionEvent.querySelector('[data-testid="marker-completion"]')).toBeInTheDocument();
    });

    it('shows failure marker', () => {
      render(<RunTimeline events={failedEvents} />);
      const failureEvent = screen.getByTestId('event-evt-2');
      expect(failureEvent.querySelector('[data-testid="marker-failure"]')).toBeInTheDocument();
    });

    it('failure marker has error styling', () => {
      render(<RunTimeline events={failedEvents} />);
      const marker = screen.getByTestId('marker-failure');
      expect(marker).toHaveClass('bg-status-error');
    });

    it('completion marker has success styling', () => {
      render(<RunTimeline events={defaultEvents} />);
      const marker = screen.getByTestId('marker-completion');
      expect(marker).toHaveClass('bg-status-success');
    });
  });

  describe('Event Details', () => {
    it('shows expandable event details', () => {
      render(<RunTimeline events={defaultEvents} />);
      const expandBtn = screen.getByTestId('expand-evt-1');
      fireEvent.click(expandBtn);

      expect(screen.getByTestId('details-evt-1')).toBeInTheDocument();
    });

    it('displays event details content', () => {
      render(<RunTimeline events={defaultEvents} />);
      fireEvent.click(screen.getByTestId('expand-evt-1'));

      expect(screen.getByText(/PRD Agent/)).toBeInTheDocument();
      expect(screen.getByText(/Discovery/)).toBeInTheDocument();
    });

    it('collapses details on second click', () => {
      render(<RunTimeline events={defaultEvents} />);
      fireEvent.click(screen.getByTestId('expand-evt-1'));
      expect(screen.getByTestId('details-evt-1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('expand-evt-1'));
      expect(screen.queryByTestId('details-evt-1')).not.toBeInTheDocument();
    });

    it('shows error details for failure events', () => {
      render(<RunTimeline events={failedEvents} />);
      fireEvent.click(screen.getByTestId('expand-evt-2'));

      expect(screen.getByText(/TypeError/)).toBeInTheDocument();
    });
  });

  describe('Timestamps', () => {
    it('displays timestamps', () => {
      render(<RunTimeline events={defaultEvents} />);
      // Timestamps should be shown in some format
      expect(screen.getByTestId('time-evt-1')).toBeInTheDocument();
    });

    it('shows relative time from start', () => {
      render(<RunTimeline events={defaultEvents} showRelativeTime />);
      // Second event is 30 seconds after start
      const time = screen.getByTestId('time-evt-2');
      expect(time).toHaveTextContent(/30s/);
    });
  });

  describe('Timeline Scrolling', () => {
    it('scrolls to latest event by default', () => {
      render(<RunTimeline events={defaultEvents} autoScroll />);
      const container = screen.getByTestId('timeline-container');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<RunTimeline events={[]} isLoading />);
      expect(screen.getByTestId('timeline-loading')).toBeInTheDocument();
    });

    it('shows skeleton events when loading', () => {
      render(<RunTimeline events={[]} isLoading />);
      expect(screen.getAllByTestId('event-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no events', () => {
      render(<RunTimeline events={[]} />);
      expect(screen.getByText(/no events/i)).toBeInTheDocument();
    });
  });

  describe('Event Click', () => {
    it('calls onEventClick when event is clicked', () => {
      const onClick = vi.fn();
      render(<RunTimeline events={defaultEvents} onEventClick={onClick} />);

      fireEvent.click(screen.getByTestId('event-evt-2'));

      expect(onClick).toHaveBeenCalledWith('evt-2');
    });

    it('events are clickable when onEventClick is provided', () => {
      render(<RunTimeline events={defaultEvents} onEventClick={vi.fn()} />);

      expect(screen.getByTestId('event-evt-1')).toHaveClass('cursor-pointer');
    });
  });

  describe('Filtering', () => {
    it('shows filter dropdown', () => {
      render(<RunTimeline events={defaultEvents} showFilter />);
      expect(screen.getByTestId('event-filter')).toBeInTheDocument();
    });

    it('filters by event type', () => {
      render(<RunTimeline events={defaultEvents} showFilter />);

      const filter = screen.getByTestId('event-filter');
      fireEvent.change(filter, { target: { value: 'tool_call' } });

      expect(screen.getByTestId('event-evt-2')).toBeInTheDocument();
      expect(screen.getByTestId('event-evt-3')).toBeInTheDocument();
      expect(screen.queryByTestId('event-evt-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('event-evt-5')).not.toBeInTheDocument();
    });

    it('shows "All Events" option', () => {
      render(<RunTimeline events={defaultEvents} showFilter />);
      const filter = screen.getByTestId('event-filter');

      // Check that "All" option exists
      const options = filter.querySelectorAll('option');
      const allOption = Array.from(options).find(opt => opt.textContent === 'All Events');
      expect(allOption).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse All', () => {
    it('shows "Expand All" button', () => {
      render(<RunTimeline events={defaultEvents} />);
      expect(screen.getByTestId('expand-all')).toBeInTheDocument();
    });

    it('expands all events when clicked', () => {
      render(<RunTimeline events={defaultEvents} />);
      fireEvent.click(screen.getByTestId('expand-all'));

      expect(screen.getByTestId('details-evt-1')).toBeInTheDocument();
      expect(screen.getByTestId('details-evt-2')).toBeInTheDocument();
    });

    it('shows "Collapse All" after expanding', () => {
      render(<RunTimeline events={defaultEvents} />);
      fireEvent.click(screen.getByTestId('expand-all'));

      expect(screen.getByTestId('collapse-all')).toBeInTheDocument();
    });

    it('collapses all events when "Collapse All" clicked', () => {
      render(<RunTimeline events={defaultEvents} />);
      fireEvent.click(screen.getByTestId('expand-all'));
      fireEvent.click(screen.getByTestId('collapse-all'));

      expect(screen.queryByTestId('details-evt-1')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper list role', () => {
      render(<RunTimeline events={defaultEvents} />);
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('events have listitem role', () => {
      render(<RunTimeline events={defaultEvents} />);
      const items = screen.getAllByRole('listitem');
      expect(items.length).toBe(5);
    });

    it('expand buttons have proper aria attributes', () => {
      render(<RunTimeline events={defaultEvents} />);
      const expandBtn = screen.getByTestId('expand-evt-1');
      expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('expands buttons have aria-expanded true when expanded', () => {
      render(<RunTimeline events={defaultEvents} />);
      const expandBtn = screen.getByTestId('expand-evt-1');
      fireEvent.click(expandBtn);
      expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
