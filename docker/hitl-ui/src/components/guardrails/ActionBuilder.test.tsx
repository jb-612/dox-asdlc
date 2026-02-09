/**
 * Tests for ActionBuilder component (P11-F01 T23)
 *
 * Verifies action type selection, conditional field rendering,
 * tool list management, and disabled state behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionBuilder } from './ActionBuilder';
import type { GuidelineAction } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const instructionAction: GuidelineAction = {
  action_type: 'instruction',
  instruction: 'Write tests before code.',
};

const toolAllowAction: GuidelineAction = {
  action_type: 'tool_allow',
  tools_allowed: ['Bash(git:*)', 'Read'],
};

const toolDenyAction: GuidelineAction = {
  action_type: 'tool_deny',
  tools_denied: ['Bash(rm:*)', 'Bash(git push --force:*)'],
};

const hitlRequireAction: GuidelineAction = {
  action_type: 'hitl_require',
  instruction: 'Require approval for production deploys.',
  gate_type: 'deployment_approval',
};

const customAction: GuidelineAction = {
  action_type: 'custom',
  instruction: 'Custom behavior description.',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActionBuilder', () => {
  describe('Action Type Dropdown', () => {
    it('renders action type dropdown with current value', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={instructionAction} onChange={onChange} />);

      const select = screen.getByTestId('action-type-select') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('instruction');
    });

    it('shows all five action type options', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={instructionAction} onChange={onChange} />);

      const select = screen.getByTestId('action-type-select') as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.value);
      expect(options).toEqual([
        'instruction',
        'tool_allow',
        'tool_deny',
        'hitl_require',
        'custom',
      ]);
    });

    it('type change calls onChange with reset fields', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={instructionAction} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('action-type-select'), {
        target: { value: 'tool_allow' },
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      const newAction = onChange.mock.calls[0][0] as GuidelineAction;
      expect(newAction.action_type).toBe('tool_allow');
      expect(newAction.tools_allowed).toEqual([]);
      // Instruction should be cleared for tool_allow
      expect(newAction.instruction).toBeNull();
      expect(newAction.tools_denied).toBeNull();
      expect(newAction.gate_type).toBeNull();
    });

    it('type change from tool_allow to instruction preserves instruction if available', () => {
      const onChange = vi.fn();
      // tool_allow has no instruction
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('action-type-select'), {
        target: { value: 'instruction' },
      });

      const newAction = onChange.mock.calls[0][0] as GuidelineAction;
      expect(newAction.action_type).toBe('instruction');
      expect(newAction.instruction).toBe('');
      expect(newAction.tools_allowed).toBeNull();
    });
  });

  describe('Instruction Textarea', () => {
    it('shown for instruction type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={instructionAction} onChange={onChange} />);

      const textarea = screen.getByTestId('action-instruction');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('Write tests before code.');
    });

    it('shown for hitl_require type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={hitlRequireAction} onChange={onChange} />);

      const textarea = screen.getByTestId('action-instruction');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('Require approval for production deploys.');
    });

    it('shown for custom type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={customAction} onChange={onChange} />);

      const textarea = screen.getByTestId('action-instruction');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('Custom behavior description.');
    });

    it('NOT shown for tool_allow type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      expect(screen.queryByTestId('action-instruction')).not.toBeInTheDocument();
    });

    it('NOT shown for tool_deny type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolDenyAction} onChange={onChange} />);

      expect(screen.queryByTestId('action-instruction')).not.toBeInTheDocument();
    });

    it('instruction change calls onChange', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={instructionAction} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('action-instruction'), {
        target: { value: 'Updated instruction text.' },
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      const newAction = onChange.mock.calls[0][0] as GuidelineAction;
      expect(newAction.instruction).toBe('Updated instruction text.');
      expect(newAction.action_type).toBe('instruction');
    });
  });

  describe('Tools Allowed Input (tool_allow)', () => {
    it('shown for tool_allow type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      expect(screen.getByTestId('action-tools-allowed')).toBeInTheDocument();
    });

    it('NOT shown for instruction type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={instructionAction} onChange={onChange} />);

      expect(screen.queryByTestId('action-tools-allowed')).not.toBeInTheDocument();
    });

    it('renders existing tool tags', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      expect(screen.getByText('Bash(git:*)')).toBeInTheDocument();
      expect(screen.getByText('Read')).toBeInTheDocument();
    });

    it('adding a tool calls onChange with updated list', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      const input = screen.getByTestId('action-tools-allowed-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Write' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledTimes(1);
      const newAction = onChange.mock.calls[0][0] as GuidelineAction;
      expect(newAction.tools_allowed).toEqual(['Bash(git:*)', 'Read', 'Write']);
    });

    it('removing a tool calls onChange with updated list', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      // Click the remove button for the first tag
      const removeButtons = screen.getAllByTestId(/^action-tools-allowed-remove-/);
      fireEvent.click(removeButtons[0]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newAction = onChange.mock.calls[0][0] as GuidelineAction;
      expect(newAction.tools_allowed).toEqual(['Read']);
    });
  });

  describe('Tools Denied Input (tool_deny)', () => {
    it('shown for tool_deny type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolDenyAction} onChange={onChange} />);

      expect(screen.getByTestId('action-tools-denied')).toBeInTheDocument();
    });

    it('NOT shown for tool_allow type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      expect(screen.queryByTestId('action-tools-denied')).not.toBeInTheDocument();
    });

    it('renders existing denied tool tags', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolDenyAction} onChange={onChange} />);

      expect(screen.getByText('Bash(rm:*)')).toBeInTheDocument();
      expect(screen.getByText('Bash(git push --force:*)')).toBeInTheDocument();
    });

    it('adding a denied tool calls onChange with updated list', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolDenyAction} onChange={onChange} />);

      const input = screen.getByTestId('action-tools-denied-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Bash(curl:*)' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledTimes(1);
      const newAction = onChange.mock.calls[0][0] as GuidelineAction;
      expect(newAction.tools_denied).toEqual([
        'Bash(rm:*)',
        'Bash(git push --force:*)',
        'Bash(curl:*)',
      ]);
    });

    it('removing a denied tool calls onChange with updated list', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolDenyAction} onChange={onChange} />);

      const removeButtons = screen.getAllByTestId(/^action-tools-denied-remove-/);
      fireEvent.click(removeButtons[1]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const newAction = onChange.mock.calls[0][0] as GuidelineAction;
      expect(newAction.tools_denied).toEqual(['Bash(rm:*)']);
    });
  });

  describe('Gate Type Input (hitl_require)', () => {
    it('shown for hitl_require type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={hitlRequireAction} onChange={onChange} />);

      const input = screen.getByTestId('action-gate-type') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('deployment_approval');
    });

    it('NOT shown for instruction type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={instructionAction} onChange={onChange} />);

      expect(screen.queryByTestId('action-gate-type')).not.toBeInTheDocument();
    });

    it('NOT shown for tool_allow type', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      expect(screen.queryByTestId('action-gate-type')).not.toBeInTheDocument();
    });

    it('gate type change calls onChange', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={hitlRequireAction} onChange={onChange} />);

      fireEvent.change(screen.getByTestId('action-gate-type'), {
        target: { value: 'security_review' },
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      const newAction = onChange.mock.calls[0][0] as GuidelineAction;
      expect(newAction.gate_type).toBe('security_review');
      expect(newAction.action_type).toBe('hitl_require');
    });
  });

  describe('Disabled State', () => {
    it('disables the action type dropdown', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={instructionAction} onChange={onChange} disabled />);

      expect(screen.getByTestId('action-type-select')).toBeDisabled();
    });

    it('disables the instruction textarea', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={instructionAction} onChange={onChange} disabled />);

      expect(screen.getByTestId('action-instruction')).toBeDisabled();
    });

    it('disables the tool input for tool_allow', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} disabled />);

      expect(screen.getByTestId('action-tools-allowed-input')).toBeDisabled();
    });

    it('disables tool remove buttons for tool_allow', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} disabled />);

      const removeButtons = screen.getAllByTestId(/^action-tools-allowed-remove-/);
      removeButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });

    it('disables the gate type input for hitl_require', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={hitlRequireAction} onChange={onChange} disabled />);

      expect(screen.getByTestId('action-gate-type')).toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('handles action with null instruction gracefully', () => {
      const action: GuidelineAction = {
        action_type: 'instruction',
        instruction: null,
      };
      const onChange = vi.fn();
      render(<ActionBuilder action={action} onChange={onChange} />);

      const textarea = screen.getByTestId('action-instruction') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('handles action with null tools_allowed gracefully', () => {
      const action: GuidelineAction = {
        action_type: 'tool_allow',
        tools_allowed: null,
      };
      const onChange = vi.fn();
      render(<ActionBuilder action={action} onChange={onChange} />);

      // Should render the tools area without any tags
      expect(screen.getByTestId('action-tools-allowed')).toBeInTheDocument();
      expect(screen.queryAllByTestId(/^action-tools-allowed-remove-/)).toHaveLength(0);
    });

    it('does not add empty string as a tool tag', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      const input = screen.getByTestId('action-tools-allowed-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not add duplicate tool tag', () => {
      const onChange = vi.fn();
      render(<ActionBuilder action={toolAllowAction} onChange={onChange} />);

      const input = screen.getByTestId('action-tools-allowed-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Read' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
