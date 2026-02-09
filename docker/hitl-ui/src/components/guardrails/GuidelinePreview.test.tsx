/**
 * Tests for GuidelinePreview component (P11-F01 T27)
 *
 * Verifies context input fields, evaluate button, loading state,
 * results display, matched guidelines list, and empty state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuidelinePreview } from './GuidelinePreview';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();
let mockIsPending = false;
let mockData: ReturnType<typeof makeMockResult> | undefined;

function makeMockResult() {
  return {
    matched_count: 3,
    combined_instruction:
      'Only modify .workitems/ files. Write failing tests first.',
    tools_allowed: ['Read(*)', 'Grep(*)'],
    tools_denied: ['Bash(rm -rf:*)', 'Bash(docker system prune:*)'],
    hitl_gates: ['destructive_operation'],
    guidelines: [
      {
        guideline_id: 'gl-001',
        guideline_name: 'Planner Isolation',
        priority: 900,
        match_score: 1.0,
        matched_fields: ['agents', 'domains'],
      },
      {
        guideline_id: 'gl-002',
        guideline_name: 'TDD Required',
        priority: 800,
        match_score: 0.5,
        matched_fields: ['agents'],
      },
      {
        guideline_id: 'gl-003',
        guideline_name: 'Path Restriction',
        priority: 850,
        match_score: 0.75,
        matched_fields: ['agents', 'paths'],
      },
    ],
  };
}

vi.mock('@/api/guardrails', () => ({
  useEvaluateContext: () => ({
    mutateAsync: mockMutate,
    isPending: mockIsPending,
    data: mockData,
  }),
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GuidelinePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockData = undefined;
    mockMutate.mockResolvedValue(makeMockResult());
  });

  // -------------------------------------------------------------------------
  // 1. Renders context input fields
  // -------------------------------------------------------------------------
  describe('Context input fields', () => {
    it('renders agent input field', () => {
      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-agent')).toBeInTheDocument();
    });

    it('renders domain input field', () => {
      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-domain')).toBeInTheDocument();
    });

    it('renders action input field', () => {
      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-action')).toBeInTheDocument();
    });

    it('renders event input field', () => {
      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-event')).toBeInTheDocument();
    });

    it('renders gate_type input field', () => {
      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-gate-type')).toBeInTheDocument();
    });

    it('renders evaluate button', () => {
      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-evaluate-btn')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Evaluate button triggers mutation
  // -------------------------------------------------------------------------
  describe('Evaluate button triggers mutation', () => {
    it('calls mutateAsync with context values', async () => {
      renderWithQuery(<GuidelinePreview />);

      fireEvent.change(screen.getByTestId('preview-agent'), {
        target: { value: 'planner' },
      });
      fireEvent.change(screen.getByTestId('preview-domain'), {
        target: { value: 'planning' },
      });
      fireEvent.change(screen.getByTestId('preview-action'), {
        target: { value: 'create' },
      });
      fireEvent.change(screen.getByTestId('preview-event'), {
        target: { value: 'pre_tool_use' },
      });
      fireEvent.change(screen.getByTestId('preview-gate-type'), {
        target: { value: 'destructive_operation' },
      });

      fireEvent.click(screen.getByTestId('preview-evaluate-btn'));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledTimes(1);
      });

      const callArg = mockMutate.mock.calls[0][0];
      expect(callArg.agent).toBe('planner');
      expect(callArg.domain).toBe('planning');
      expect(callArg.action).toBe('create');
      expect(callArg.event).toBe('pre_tool_use');
      expect(callArg.gate_type).toBe('destructive_operation');
    });

    it('sends null for empty fields', async () => {
      renderWithQuery(<GuidelinePreview />);

      // Only fill agent, leave others empty
      fireEvent.change(screen.getByTestId('preview-agent'), {
        target: { value: 'backend' },
      });

      fireEvent.click(screen.getByTestId('preview-evaluate-btn'));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledTimes(1);
      });

      const callArg = mockMutate.mock.calls[0][0];
      expect(callArg.agent).toBe('backend');
      expect(callArg.domain).toBeNull();
      expect(callArg.action).toBeNull();
      expect(callArg.event).toBeNull();
      expect(callArg.gate_type).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Loading state during evaluation
  // -------------------------------------------------------------------------
  describe('Loading state', () => {
    it('shows loading indicator when pending', () => {
      mockIsPending = true;

      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-loading')).toBeInTheDocument();
    });

    it('disables evaluate button when pending', () => {
      mockIsPending = true;

      renderWithQuery(<GuidelinePreview />);

      const btn = screen.getByTestId('preview-evaluate-btn');
      expect(btn).toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Results displayed after evaluation
  // -------------------------------------------------------------------------
  describe('Results displayed after evaluation', () => {
    it('shows matched count', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-matched-count')).toHaveTextContent('3');
    });

    it('shows results section when data is present', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-results')).toBeInTheDocument();
    });

    it('does not show results when no data', () => {
      mockData = undefined;

      renderWithQuery(<GuidelinePreview />);

      expect(screen.queryByTestId('preview-results')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Combined instruction shown
  // -------------------------------------------------------------------------
  describe('Combined instruction', () => {
    it('displays the combined instruction text', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-combined-instruction')).toHaveTextContent(
        'Only modify .workitems/ files. Write failing tests first.'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. Matched guidelines listed
  // -------------------------------------------------------------------------
  describe('Matched guidelines listed', () => {
    it('lists all matched guidelines', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-guideline-gl-001')).toBeInTheDocument();
      expect(screen.getByTestId('preview-guideline-gl-002')).toBeInTheDocument();
      expect(screen.getByTestId('preview-guideline-gl-003')).toBeInTheDocument();
    });

    it('shows guideline name and priority', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      const row = screen.getByTestId('preview-guideline-gl-001');
      expect(row).toHaveTextContent('Planner Isolation');
      expect(row).toHaveTextContent('900');
    });

    it('shows match score', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      const row = screen.getByTestId('preview-guideline-gl-001');
      expect(row).toHaveTextContent('1');
    });

    it('shows matched fields', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      const row = screen.getByTestId('preview-guideline-gl-001');
      expect(row).toHaveTextContent('agents');
      expect(row).toHaveTextContent('domains');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Empty results state (no matches)
  // -------------------------------------------------------------------------
  describe('Empty results state', () => {
    it('shows no-matches message when matched_count is 0', () => {
      mockData = {
        matched_count: 0,
        combined_instruction: '',
        tools_allowed: [],
        tools_denied: [],
        hitl_gates: [],
        guidelines: [],
      };

      renderWithQuery(<GuidelinePreview />);

      expect(screen.getByTestId('preview-no-matches')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Tool denied/allowed and HITL gates shown
  // -------------------------------------------------------------------------
  describe('Tools and HITL gates display', () => {
    it('shows tools denied list', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      const denied = screen.getByTestId('preview-tools-denied');
      expect(denied).toHaveTextContent('Bash(rm -rf:*)');
      expect(denied).toHaveTextContent('Bash(docker system prune:*)');
    });

    it('shows tools allowed list', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      const allowed = screen.getByTestId('preview-tools-allowed');
      expect(allowed).toHaveTextContent('Read(*)');
      expect(allowed).toHaveTextContent('Grep(*)');
    });

    it('shows HITL gates', () => {
      mockData = makeMockResult();

      renderWithQuery(<GuidelinePreview />);

      const gates = screen.getByTestId('preview-hitl-gates');
      expect(gates).toHaveTextContent('destructive_operation');
    });

    it('shows "(none)" when tools denied is empty', () => {
      mockData = {
        ...makeMockResult(),
        tools_denied: [],
      };

      renderWithQuery(<GuidelinePreview />);

      const denied = screen.getByTestId('preview-tools-denied');
      expect(denied).toHaveTextContent('(none)');
    });

    it('shows "(none)" when tools allowed is empty', () => {
      mockData = {
        ...makeMockResult(),
        tools_allowed: [],
      };

      renderWithQuery(<GuidelinePreview />);

      const allowed = screen.getByTestId('preview-tools-allowed');
      expect(allowed).toHaveTextContent('(none)');
    });

    it('shows "(none)" when HITL gates is empty', () => {
      mockData = {
        ...makeMockResult(),
        hitl_gates: [],
      };

      renderWithQuery(<GuidelinePreview />);

      const gates = screen.getByTestId('preview-hitl-gates');
      expect(gates).toHaveTextContent('(none)');
    });
  });
});
