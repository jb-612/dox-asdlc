/**
 * Tests for AuditLogViewer component (P11-F01 T25)
 *
 * Verifies table rendering of audit entries, expandable rows, event type
 * and guideline filters, pagination, CSV export, and pre-filtering by
 * guidelineId prop.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditLogViewer } from './AuditLogViewer';
import type { AuditLogResponse } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Mock useAuditLogs
// ---------------------------------------------------------------------------

const mockUseAuditLogs = vi.fn();

vi.mock('../../api/guardrails', () => ({
  useAuditLogs: (...args: unknown[]) => mockUseAuditLogs(...args),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockEntries: AuditLogResponse = {
  entries: [
    {
      id: 'audit-001',
      event_type: 'guideline_created',
      guideline_id: 'gl-abc',
      timestamp: '2026-01-20T14:30:00Z',
      decision: null,
      context: null,
      changes: { name: 'Test Guideline', category: 'custom' },
    },
    {
      id: 'audit-002',
      event_type: 'guideline_updated',
      guideline_id: 'gl-xyz',
      timestamp: '2026-01-19T10:00:00Z',
      decision: null,
      context: null,
      changes: { version: { old: 1, new: 2 } },
    },
    {
      id: 'audit-003',
      event_type: 'guideline_toggled',
      guideline_id: 'gl-abc',
      timestamp: '2026-01-19T08:00:00Z',
      decision: null,
      context: null,
      changes: { enabled: { old: true, new: false } },
    },
    {
      id: 'audit-004',
      event_type: 'guideline_deleted',
      guideline_id: 'gl-del',
      timestamp: '2026-01-18T12:00:00Z',
      decision: null,
      context: null,
      changes: { reason: 'No longer needed' },
    },
    {
      id: 'audit-005',
      event_type: 'context_evaluated',
      guideline_id: 'gl-abc',
      timestamp: '2026-01-17T09:00:00Z',
      decision: { action: 'allowed', reason: 'Matched rule' },
      context: { agent: 'planner', domain: 'planning' },
      changes: null,
    },
  ],
  total: 25,
};

const emptyResponse: AuditLogResponse = {
  entries: [],
  total: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupMock(
  overrides: Partial<ReturnType<typeof mockUseAuditLogs>> = {},
  data: AuditLogResponse | undefined = mockEntries,
) {
  mockUseAuditLogs.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Renders table with audit entries
  // =========================================================================

  describe('Table Rendering', () => {
    it('renders table with audit entries', () => {
      setupMock();
      render(<AuditLogViewer />);

      expect(screen.getByTestId('audit-log-viewer')).toBeInTheDocument();
      expect(screen.getByText('Audit Log')).toBeInTheDocument();

      // Should render all 5 entries
      expect(screen.getByTestId('audit-row-audit-001')).toBeInTheDocument();
      expect(screen.getByTestId('audit-row-audit-002')).toBeInTheDocument();
      expect(screen.getByTestId('audit-row-audit-003')).toBeInTheDocument();
      expect(screen.getByTestId('audit-row-audit-004')).toBeInTheDocument();
      expect(screen.getByTestId('audit-row-audit-005')).toBeInTheDocument();
    });

    it('renders column headers', () => {
      setupMock();
      render(<AuditLogViewer />);

      expect(screen.getByText('Timestamp')).toBeInTheDocument();
      expect(screen.getByText('Event Type')).toBeInTheDocument();
      expect(screen.getByText('Guideline ID')).toBeInTheDocument();
    });

    it('displays guideline IDs in the table rows', () => {
      setupMock();
      render(<AuditLogViewer />);

      // gl-abc appears in multiple rows (audit-001, audit-003, audit-005)
      expect(screen.getAllByText('gl-abc').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('gl-xyz')).toBeInTheDocument();
      expect(screen.getByText('gl-del')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Loading state
  // =========================================================================

  describe('Loading State', () => {
    it('shows loading state when data is being fetched', () => {
      setupMock({ isLoading: true }, undefined);
      render(<AuditLogViewer />);

      expect(screen.getByTestId('audit-log-loading')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Empty state
  // =========================================================================

  describe('Empty State', () => {
    it('shows empty state when no entries exist', () => {
      setupMock({}, emptyResponse);
      render(<AuditLogViewer />);

      expect(screen.getByTestId('audit-log-empty')).toBeInTheDocument();
      expect(screen.getByText(/no audit log entries/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Expandable row toggle
  // =========================================================================

  describe('Expandable Rows', () => {
    it('expands a row when clicked to show details', () => {
      setupMock();
      render(<AuditLogViewer />);

      // Ensure details not visible initially
      expect(screen.queryByTestId('audit-detail-audit-001')).not.toBeInTheDocument();

      // Click the expand toggle
      fireEvent.click(screen.getByTestId('audit-expand-audit-001'));

      // Details should now be visible
      expect(screen.getByTestId('audit-detail-audit-001')).toBeInTheDocument();
    });

    it('collapses a row when clicked again', () => {
      setupMock();
      render(<AuditLogViewer />);

      // Expand then collapse
      fireEvent.click(screen.getByTestId('audit-expand-audit-001'));
      expect(screen.getByTestId('audit-detail-audit-001')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('audit-expand-audit-001'));
      expect(screen.queryByTestId('audit-detail-audit-001')).not.toBeInTheDocument();
    });

    it('shows JSON details for changes', () => {
      setupMock();
      render(<AuditLogViewer />);

      fireEvent.click(screen.getByTestId('audit-expand-audit-001'));
      const detail = screen.getByTestId('audit-detail-audit-001');
      expect(detail.textContent).toContain('Test Guideline');
    });

    it('shows JSON details for decision and context', () => {
      setupMock();
      render(<AuditLogViewer />);

      fireEvent.click(screen.getByTestId('audit-expand-audit-005'));
      const detail = screen.getByTestId('audit-detail-audit-005');
      expect(detail.textContent).toContain('allowed');
      expect(detail.textContent).toContain('planner');
    });

    it('allows multiple rows to be expanded simultaneously', () => {
      setupMock();
      render(<AuditLogViewer />);

      fireEvent.click(screen.getByTestId('audit-expand-audit-001'));
      fireEvent.click(screen.getByTestId('audit-expand-audit-002'));

      expect(screen.getByTestId('audit-detail-audit-001')).toBeInTheDocument();
      expect(screen.getByTestId('audit-detail-audit-002')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. Event type filter
  // =========================================================================

  describe('Event Type Filter', () => {
    it('renders the event type filter dropdown', () => {
      setupMock();
      render(<AuditLogViewer />);

      expect(screen.getByTestId('audit-event-filter')).toBeInTheDocument();
    });

    it('passes event_type param to useAuditLogs when filter changes', () => {
      setupMock();
      render(<AuditLogViewer />);

      fireEvent.change(screen.getByTestId('audit-event-filter'), {
        target: { value: 'guideline_created' },
      });

      // The hook should have been called with the event_type filter
      const lastCall = mockUseAuditLogs.mock.calls[mockUseAuditLogs.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({ event_type: 'guideline_created' });
    });

    it('clears event_type param when "All" is selected', () => {
      setupMock();
      render(<AuditLogViewer />);

      // First set a filter
      fireEvent.change(screen.getByTestId('audit-event-filter'), {
        target: { value: 'guideline_created' },
      });

      // Then clear it
      fireEvent.change(screen.getByTestId('audit-event-filter'), {
        target: { value: '' },
      });

      const lastCall = mockUseAuditLogs.mock.calls[mockUseAuditLogs.mock.calls.length - 1];
      expect(lastCall[0].event_type).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. Guideline filter input
  // =========================================================================

  describe('Guideline Filter', () => {
    it('renders the guideline filter input', () => {
      setupMock();
      render(<AuditLogViewer />);

      expect(screen.getByTestId('audit-guideline-filter')).toBeInTheDocument();
    });

    it('passes guideline_id param to useAuditLogs when filter changes', () => {
      setupMock();
      render(<AuditLogViewer />);

      fireEvent.change(screen.getByTestId('audit-guideline-filter'), {
        target: { value: 'gl-abc' },
      });

      const lastCall = mockUseAuditLogs.mock.calls[mockUseAuditLogs.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({ guideline_id: 'gl-abc' });
    });

    it('clears guideline_id when input is emptied', () => {
      setupMock();
      render(<AuditLogViewer />);

      // Set filter
      fireEvent.change(screen.getByTestId('audit-guideline-filter'), {
        target: { value: 'gl-abc' },
      });

      // Clear filter
      fireEvent.change(screen.getByTestId('audit-guideline-filter'), {
        target: { value: '' },
      });

      const lastCall = mockUseAuditLogs.mock.calls[mockUseAuditLogs.mock.calls.length - 1];
      expect(lastCall[0].guideline_id).toBeUndefined();
    });
  });

  // =========================================================================
  // 7. Pagination
  // =========================================================================

  describe('Pagination', () => {
    it('shows pagination controls when total exceeds page size', () => {
      setupMock();
      render(<AuditLogViewer />);

      expect(screen.getByTestId('audit-pagination')).toBeInTheDocument();
      expect(screen.getByTestId('audit-prev-page')).toBeInTheDocument();
      expect(screen.getByTestId('audit-next-page')).toBeInTheDocument();
    });

    it('Previous button is disabled on first page', () => {
      setupMock();
      render(<AuditLogViewer />);

      expect(screen.getByTestId('audit-prev-page')).toBeDisabled();
    });

    it('Next button navigates to next page', () => {
      setupMock();
      render(<AuditLogViewer />);

      fireEvent.click(screen.getByTestId('audit-next-page'));

      const lastCall = mockUseAuditLogs.mock.calls[mockUseAuditLogs.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({ page: 2 });
    });

    it('displays page info text', () => {
      setupMock();
      render(<AuditLogViewer />);

      // With 25 total and default page_size of 10, 3 pages
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    it('does not show pagination when total fits in one page', () => {
      setupMock({}, { entries: mockEntries.entries.slice(0, 2), total: 2 });
      render(<AuditLogViewer />);

      expect(screen.queryByTestId('audit-pagination')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 8. Export CSV button
  // =========================================================================

  describe('CSV Export', () => {
    it('renders the Export CSV button', () => {
      setupMock();
      render(<AuditLogViewer />);

      expect(screen.getByTestId('audit-export-csv')).toBeInTheDocument();
      expect(screen.getByTestId('audit-export-csv')).toHaveTextContent('Export CSV');
    });

    it('triggers CSV download when Export CSV is clicked', () => {
      setupMock();

      // Mock URL.createObjectURL and revokeObjectURL
      const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      render(<AuditLogViewer />);

      fireEvent.click(screen.getByTestId('audit-export-csv'));

      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 9. Pre-filter by guidelineId prop
  // =========================================================================

  describe('GuidelineId Prop Pre-filter', () => {
    it('uses guidelineId prop as default guideline filter', () => {
      setupMock();
      render(<AuditLogViewer guidelineId="gl-prop-id" />);

      // The hook should have been called with the guideline_id from the prop
      const firstCall = mockUseAuditLogs.mock.calls[0];
      expect(firstCall[0]).toMatchObject({ guideline_id: 'gl-prop-id' });
    });

    it('pre-populates the guideline filter input', () => {
      setupMock();
      render(<AuditLogViewer guidelineId="gl-prop-id" />);

      const input = screen.getByTestId('audit-guideline-filter') as HTMLInputElement;
      expect(input.value).toBe('gl-prop-id');
    });
  });

  // =========================================================================
  // 10. Event type badge colors
  // =========================================================================

  describe('Event Type Badge Colors', () => {
    it('renders created events with green badge', () => {
      setupMock();
      render(<AuditLogViewer />);

      const badge = screen.getByTestId('audit-badge-audit-001');
      expect(badge).toHaveClass('bg-green-100');
    });

    it('renders updated events with blue badge', () => {
      setupMock();
      render(<AuditLogViewer />);

      const badge = screen.getByTestId('audit-badge-audit-002');
      expect(badge).toHaveClass('bg-blue-100');
    });

    it('renders toggled events with amber badge', () => {
      setupMock();
      render(<AuditLogViewer />);

      const badge = screen.getByTestId('audit-badge-audit-003');
      expect(badge).toHaveClass('bg-amber-100');
    });

    it('renders deleted events with red badge', () => {
      setupMock();
      render(<AuditLogViewer />);

      const badge = screen.getByTestId('audit-badge-audit-004');
      expect(badge).toHaveClass('bg-red-100');
    });

    it('renders context_evaluated events with purple badge', () => {
      setupMock();
      render(<AuditLogViewer />);

      const badge = screen.getByTestId('audit-badge-audit-005');
      expect(badge).toHaveClass('bg-purple-100');
    });
  });
});
