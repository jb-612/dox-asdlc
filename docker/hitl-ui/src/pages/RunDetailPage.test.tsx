/**
 * Tests for RunDetailPage component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RunDetailPage from './RunDetailPage';

// Mock child components
vi.mock('../components/cockpit/RunTimeline', () => ({
  default: ({ events }: { events: unknown[] }) => (
    <div data-testid="run-timeline">Timeline ({events.length} events)</div>
  ),
}));

vi.mock('../components/cockpit/RunInputsTab', () => ({
  default: () => <div data-testid="run-inputs-tab">Inputs Tab</div>,
}));

vi.mock('../components/cockpit/RunOutputsTab', () => ({
  default: () => <div data-testid="run-outputs-tab">Outputs Tab</div>,
}));

vi.mock('../components/cockpit/EvidenceTab', () => ({
  default: () => <div data-testid="evidence-tab">Evidence Tab</div>,
}));

vi.mock('../components/cockpit/RLMTrajectoryViewer', () => ({
  default: () => <div data-testid="rlm-trajectory-viewer">RLM Trajectory Viewer</div>,
}));

// Wrapper with router
const renderWithRouter = (route = '/cockpit/runs/run-123') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/cockpit/runs/:runId" element={<RunDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('RunDetailPage', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderWithRouter();
      expect(screen.getByTestId('run-detail-page')).toBeInTheDocument();
    });

    it('renders run ID from URL params in header', () => {
      renderWithRouter('/cockpit/runs/run-123');
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('run-123');
    });

    it('renders different run ID from URL', () => {
      renderWithRouter('/cockpit/runs/test-run-abc');
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('test-run-abc');
    });

    it('renders epic name', () => {
      renderWithRouter();
      expect(screen.getByText(/user authentication/i)).toBeInTheDocument();
    });

    it('renders agent name', () => {
      renderWithRouter();
      expect(screen.getByText(/prd agent/i)).toBeInTheDocument();
    });

    it('renders run status', () => {
      renderWithRouter();
      expect(screen.getByTestId('run-status')).toHaveTextContent(/completed/i);
    });
  });

  describe('Tab Navigation', () => {
    it('renders all 5 tabs for RLM runs (mock data is RLM)', () => {
      renderWithRouter();
      expect(screen.getByRole('tab', { name: /timeline/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /inputs/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /outputs/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /evidence/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /trajectory/i })).toBeInTheDocument();
    });

    it('timeline tab is active by default', () => {
      renderWithRouter();
      const timelineTab = screen.getByRole('tab', { name: /timeline/i });
      expect(timelineTab).toHaveAttribute('aria-selected', 'true');
    });

    it('switches to inputs tab on click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByRole('tab', { name: /inputs/i }));

      const inputsTab = screen.getByRole('tab', { name: /inputs/i });
      expect(inputsTab).toHaveAttribute('aria-selected', 'true');
    });

    it('switches to outputs tab on click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByRole('tab', { name: /outputs/i }));

      expect(screen.getByRole('tab', { name: /outputs/i })).toHaveAttribute('aria-selected', 'true');
    });

    it('switches to evidence tab on click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByRole('tab', { name: /evidence/i }));

      expect(screen.getByRole('tab', { name: /evidence/i })).toHaveAttribute('aria-selected', 'true');
    });

    it('switches to trajectory tab on click', () => {
      renderWithRouter();

      fireEvent.click(screen.getByRole('tab', { name: /trajectory/i }));

      expect(screen.getByRole('tab', { name: /trajectory/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Tab Content', () => {
    it('shows timeline content by default', () => {
      renderWithRouter();
      expect(screen.getByTestId('timeline-tab-panel')).toBeInTheDocument();
      expect(screen.getByTestId('run-timeline')).toBeInTheDocument();
    });

    it('shows inputs content when inputs tab clicked', () => {
      renderWithRouter();

      fireEvent.click(screen.getByRole('tab', { name: /inputs/i }));

      expect(screen.getByTestId('inputs-tab-panel')).toBeInTheDocument();
      expect(screen.getByTestId('run-inputs-tab')).toBeInTheDocument();
    });

    it('shows outputs content when outputs tab clicked', () => {
      renderWithRouter();

      fireEvent.click(screen.getByRole('tab', { name: /outputs/i }));

      expect(screen.getByTestId('outputs-tab-panel')).toBeInTheDocument();
      expect(screen.getByTestId('run-outputs-tab')).toBeInTheDocument();
    });

    it('shows evidence content when evidence tab clicked', () => {
      renderWithRouter();

      fireEvent.click(screen.getByRole('tab', { name: /evidence/i }));

      expect(screen.getByTestId('evidence-tab-panel')).toBeInTheDocument();
      expect(screen.getByTestId('evidence-tab')).toBeInTheDocument();
    });

    it('shows trajectory content when trajectory tab clicked', () => {
      renderWithRouter();

      fireEvent.click(screen.getByRole('tab', { name: /trajectory/i }));

      expect(screen.getByTestId('trajectory-tab-panel')).toBeInTheDocument();
      expect(screen.getByTestId('rlm-trajectory-viewer')).toBeInTheDocument();
    });
  });

  describe('Run Actions', () => {
    it('shows Rerun button', () => {
      renderWithRouter();
      expect(screen.getByRole('button', { name: /rerun/i })).toBeInTheDocument();
    });

    it('shows Export button', () => {
      renderWithRouter();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });

    it('shows Escalate button', () => {
      renderWithRouter();
      expect(screen.getByRole('button', { name: /escalate/i })).toBeInTheDocument();
    });

    it('rerun button is clickable', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      renderWithRouter();

      fireEvent.click(screen.getByRole('button', { name: /rerun/i }));

      expect(consoleSpy).toHaveBeenCalledWith('Rerun requested for:', 'run-123');
      consoleSpy.mockRestore();
    });

    it('export button is clickable', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      renderWithRouter();

      fireEvent.click(screen.getByRole('button', { name: /export/i }));

      expect(consoleSpy).toHaveBeenCalledWith('Export requested for:', 'run-123');
      consoleSpy.mockRestore();
    });

    it('escalate button is clickable', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      renderWithRouter();

      fireEvent.click(screen.getByRole('button', { name: /escalate/i }));

      expect(consoleSpy).toHaveBeenCalledWith('Escalate requested for:', 'run-123');
      consoleSpy.mockRestore();
    });
  });

  describe('Run Metadata', () => {
    it('displays cluster', () => {
      renderWithRouter();
      expect(screen.getByText(/development/i)).toBeInTheDocument();
    });

    it('displays start time', () => {
      renderWithRouter();
      expect(screen.getByTestId('run-started-at')).toBeInTheDocument();
    });

    it('displays duration', () => {
      renderWithRouter();
      expect(screen.getByTestId('run-duration')).toHaveTextContent('5m 0s');
    });

    it('displays status with appropriate color', () => {
      renderWithRouter();
      const status = screen.getByTestId('run-status');
      expect(status).toHaveClass('text-status-success');
    });

    it('displays RLM badge for RLM runs', () => {
      renderWithRouter();
      expect(screen.getByText('RLM')).toBeInTheDocument();
    });
  });

  describe('Breadcrumbs', () => {
    it('shows breadcrumb navigation', () => {
      renderWithRouter();
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    });

    it('shows link to cockpit', () => {
      renderWithRouter();
      expect(screen.getByRole('link', { name: /cockpit/i })).toBeInTheDocument();
    });

    it('shows link to runs list', () => {
      renderWithRouter();
      expect(screen.getByRole('link', { name: /runs/i })).toBeInTheDocument();
    });

    it('shows current run ID in breadcrumb', () => {
      renderWithRouter();
      // The run ID should appear in the breadcrumb as non-link text
      const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumbNav).toHaveTextContent('run-123');
    });
  });

  describe('Accessibility', () => {
    it('has proper page heading', () => {
      renderWithRouter();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('tab panel has proper role', () => {
      renderWithRouter();
      const tabPanel = screen.getByTestId('timeline-tab-panel');
      expect(tabPanel).toHaveAttribute('role', 'tabpanel');
    });

    it('tabs have proper role', () => {
      renderWithRouter();
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
    });

    it('tabs have proper aria-selected state', () => {
      renderWithRouter();

      // Timeline selected by default
      expect(screen.getByRole('tab', { name: /timeline/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /inputs/i })).toHaveAttribute('aria-selected', 'false');

      // Click inputs
      fireEvent.click(screen.getByRole('tab', { name: /inputs/i }));

      // Inputs now selected
      expect(screen.getByRole('tab', { name: /timeline/i })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: /inputs/i })).toHaveAttribute('aria-selected', 'true');
    });
  });
});
