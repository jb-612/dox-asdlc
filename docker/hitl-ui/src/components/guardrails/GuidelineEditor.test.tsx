/**
 * Tests for GuidelineEditor component (P11-F01 T24)
 *
 * Verifies create/edit modes, form fields, validation,
 * mutation hook calls, error handling, and cancel behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuidelineEditor } from './GuidelineEditor';
import type { Guideline } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();

vi.mock('@/api/guardrails', () => ({
  useCreateGuideline: () => ({
    mutateAsync: mockCreateMutate,
    isPending: false,
  }),
  useUpdateGuideline: () => ({
    mutateAsync: mockUpdateMutate,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const existingGuideline: Guideline = {
  id: 'gl-001',
  name: 'TDD Required',
  description: 'Enforce test-driven development for all tasks.',
  category: 'tdd_protocol',
  priority: 800,
  enabled: true,
  condition: {
    agents: ['backend', 'frontend'],
    domains: null,
    actions: null,
    paths: null,
    events: null,
    gate_types: null,
  },
  action: {
    action_type: 'instruction',
    instruction: 'Write failing test before implementation code.',
  },
  version: 3,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-20T14:30:00Z',
  created_by: 'admin',
};

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

describe('GuidelineEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutate.mockResolvedValue({ id: 'gl-new' });
    mockUpdateMutate.mockResolvedValue({ id: 'gl-001' });
  });

  // -----------------------------------------------------------------------
  // 1. Renders in create mode
  // -----------------------------------------------------------------------
  describe('Create mode (no guideline prop)', () => {
    it('renders with "Create" in the title', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      expect(screen.getByTestId('editor-title')).toHaveTextContent(/create/i);
    });

    it('renders empty name input', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const input = screen.getByTestId('editor-name') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('renders empty description textarea', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const textarea = screen.getByTestId('editor-description') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('renders default category as custom', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const select = screen.getByTestId('editor-category') as HTMLSelectElement;
      expect(select.value).toBe('custom');
    });

    it('renders default priority as 100', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const input = screen.getByTestId('editor-priority') as HTMLInputElement;
      expect(input.value).toBe('100');
    });
  });

  // -----------------------------------------------------------------------
  // 2. Renders in edit mode
  // -----------------------------------------------------------------------
  describe('Edit mode (guideline prop provided)', () => {
    it('renders with "Edit" in the title', () => {
      renderWithQuery(<GuidelineEditor guideline={existingGuideline} />);

      expect(screen.getByTestId('editor-title')).toHaveTextContent(/edit/i);
    });

    it('pre-fills name from guideline', () => {
      renderWithQuery(<GuidelineEditor guideline={existingGuideline} />);

      const input = screen.getByTestId('editor-name') as HTMLInputElement;
      expect(input.value).toBe('TDD Required');
    });

    it('pre-fills description from guideline', () => {
      renderWithQuery(<GuidelineEditor guideline={existingGuideline} />);

      const textarea = screen.getByTestId('editor-description') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Enforce test-driven development for all tasks.');
    });

    it('pre-fills category from guideline', () => {
      renderWithQuery(<GuidelineEditor guideline={existingGuideline} />);

      const select = screen.getByTestId('editor-category') as HTMLSelectElement;
      expect(select.value).toBe('tdd_protocol');
    });

    it('pre-fills priority from guideline', () => {
      renderWithQuery(<GuidelineEditor guideline={existingGuideline} />);

      const input = screen.getByTestId('editor-priority') as HTMLInputElement;
      expect(input.value).toBe('800');
    });
  });

  // -----------------------------------------------------------------------
  // 3. Name input works
  // -----------------------------------------------------------------------
  describe('Name input', () => {
    it('updates name when typed', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const input = screen.getByTestId('editor-name') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New Guideline' } });
      expect(input.value).toBe('New Guideline');
    });
  });

  // -----------------------------------------------------------------------
  // 4. Description textarea works
  // -----------------------------------------------------------------------
  describe('Description textarea', () => {
    it('updates description when typed', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const textarea = screen.getByTestId('editor-description') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Some description.' } });
      expect(textarea.value).toBe('Some description.');
    });
  });

  // -----------------------------------------------------------------------
  // 5. Category dropdown changes
  // -----------------------------------------------------------------------
  describe('Category dropdown', () => {
    it('changes category when selected', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const select = screen.getByTestId('editor-category') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: 'hitl_gate' } });
      expect(select.value).toBe('hitl_gate');
    });

    it('shows all category options', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const select = screen.getByTestId('editor-category') as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toEqual([
        'cognitive_isolation',
        'tdd_protocol',
        'hitl_gate',
        'tool_restriction',
        'path_restriction',
        'commit_policy',
        'custom',
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Priority input changes
  // -----------------------------------------------------------------------
  describe('Priority input', () => {
    it('changes priority when typed', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const input = screen.getByTestId('editor-priority') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '750' } });
      expect(input.value).toBe('750');
    });
  });

  // -----------------------------------------------------------------------
  // 7. ConditionBuilder is rendered
  // -----------------------------------------------------------------------
  describe('ConditionBuilder integration', () => {
    it('renders ConditionBuilder', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      expect(screen.getByTestId('condition-builder')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // 8. ActionBuilder is rendered
  // -----------------------------------------------------------------------
  describe('ActionBuilder integration', () => {
    it('renders ActionBuilder', () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      expect(screen.getByTestId('action-builder')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // 9. Save calls create mutation in create mode
  // -----------------------------------------------------------------------
  describe('Save in create mode', () => {
    it('calls create mutation with form data', async () => {
      const onSave = vi.fn();
      renderWithQuery(<GuidelineEditor isCreating onSave={onSave} />);

      // Fill in required name
      fireEvent.change(screen.getByTestId('editor-name'), {
        target: { value: 'My New Guideline' },
      });

      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(mockCreateMutate).toHaveBeenCalledTimes(1);
      });

      const callArg = mockCreateMutate.mock.calls[0][0];
      expect(callArg.name).toBe('My New Guideline');
      expect(callArg.category).toBe('custom');
      expect(callArg.priority).toBe(100);
    });

    it('calls onSave after successful create', async () => {
      const onSave = vi.fn();
      renderWithQuery(<GuidelineEditor isCreating onSave={onSave} />);

      fireEvent.change(screen.getByTestId('editor-name'), {
        target: { value: 'Test Guideline' },
      });
      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
    });
  });

  // -----------------------------------------------------------------------
  // 10. Save calls update mutation in edit mode
  // -----------------------------------------------------------------------
  describe('Save in edit mode', () => {
    it('calls update mutation with id, body, and version', async () => {
      const onSave = vi.fn();
      renderWithQuery(
        <GuidelineEditor guideline={existingGuideline} onSave={onSave} />
      );

      // Change the name
      fireEvent.change(screen.getByTestId('editor-name'), {
        target: { value: 'Updated TDD Required' },
      });
      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
      });

      const callArg = mockUpdateMutate.mock.calls[0][0];
      expect(callArg.id).toBe('gl-001');
      expect(callArg.body.name).toBe('Updated TDD Required');
      expect(callArg.body.version).toBe(3);
    });

    it('calls onSave after successful update', async () => {
      const onSave = vi.fn();
      renderWithQuery(
        <GuidelineEditor guideline={existingGuideline} onSave={onSave} />
      );

      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
    });
  });

  // -----------------------------------------------------------------------
  // 11. Cancel button calls onCancel
  // -----------------------------------------------------------------------
  describe('Cancel button', () => {
    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      renderWithQuery(<GuidelineEditor isCreating onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId('editor-cancel-btn'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when close button is clicked', () => {
      const onCancel = vi.fn();
      renderWithQuery(<GuidelineEditor isCreating onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId('editor-close-btn'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // 12. Name validation
  // -----------------------------------------------------------------------
  describe('Name validation', () => {
    it('shows error when saving with empty name', async () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      // Name is empty by default, try to save
      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('editor-error')).toHaveTextContent(/name/i);
      });

      expect(mockCreateMutate).not.toHaveBeenCalled();
    });

    it('shows error when name exceeds 200 characters', async () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      const longName = 'a'.repeat(201);
      fireEvent.change(screen.getByTestId('editor-name'), {
        target: { value: longName },
      });
      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('editor-error')).toHaveTextContent(/200/);
      });

      expect(mockCreateMutate).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 13. Priority validation
  // -----------------------------------------------------------------------
  describe('Priority validation', () => {
    it('shows error when priority is negative', async () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      fireEvent.change(screen.getByTestId('editor-name'), {
        target: { value: 'Valid Name' },
      });
      fireEvent.change(screen.getByTestId('editor-priority'), {
        target: { value: '-1' },
      });
      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('editor-error')).toHaveTextContent(/0.*1000/);
      });

      expect(mockCreateMutate).not.toHaveBeenCalled();
    });

    it('shows error when priority exceeds 1000', async () => {
      renderWithQuery(<GuidelineEditor isCreating />);

      fireEvent.change(screen.getByTestId('editor-name'), {
        target: { value: 'Valid Name' },
      });
      fireEvent.change(screen.getByTestId('editor-priority'), {
        target: { value: '1001' },
      });
      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('editor-error')).toHaveTextContent(/0.*1000/);
      });

      expect(mockCreateMutate).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 14. Version conflict error
  // -----------------------------------------------------------------------
  describe('Version conflict error', () => {
    it('shows version conflict error when mutation returns 409', async () => {
      const conflictError = new Error('Version conflict');
      (conflictError as Record<string, unknown>).response = { status: 409 };
      mockUpdateMutate.mockRejectedValueOnce(conflictError);

      renderWithQuery(
        <GuidelineEditor guideline={existingGuideline} />
      );

      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('editor-error')).toHaveTextContent(/conflict/i);
      });
    });

    it('clears error when form field changes', async () => {
      const conflictError = new Error('Version conflict');
      (conflictError as Record<string, unknown>).response = { status: 409 };
      mockUpdateMutate.mockRejectedValueOnce(conflictError);

      renderWithQuery(
        <GuidelineEditor guideline={existingGuideline} />
      );

      fireEvent.click(screen.getByTestId('editor-save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('editor-error')).toBeInTheDocument();
      });

      // Change name should clear the error
      fireEvent.change(screen.getByTestId('editor-name'), {
        target: { value: 'Changed name' },
      });

      expect(screen.queryByTestId('editor-error')).not.toBeInTheDocument();
    });
  });
});
