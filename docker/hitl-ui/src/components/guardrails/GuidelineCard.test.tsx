/**
 * Tests for GuidelineCard component (P11-F01 T20)
 *
 * Verifies rendering of guideline data, category badges, toggle behavior,
 * selection state, and disabled guideline styling.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuidelineCard } from './GuidelineCard';
import type { Guideline } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseMockGuideline: Guideline = {
  id: 'gl-test-001',
  name: 'Test Guideline',
  description: 'A test guideline for verifying component behavior.',
  category: 'cognitive_isolation',
  priority: 900,
  enabled: true,
  condition: { agents: ['backend', 'frontend'], domains: ['development'] },
  action: {
    action_type: 'instruction',
    instruction: 'Follow the rule carefully.',
  },
  version: 1,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  created_by: 'admin',
};

const disabledGuideline: Guideline = {
  ...baseMockGuideline,
  id: 'gl-disabled-001',
  name: 'Disabled Guideline',
  enabled: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GuidelineCard', () => {
  describe('Basic Rendering', () => {
    it('renders guideline name and description', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);

      expect(screen.getByText('Test Guideline')).toBeInTheDocument();
      expect(
        screen.getByText('A test guideline for verifying component behavior.')
      ).toBeInTheDocument();
    });

    it('renders with data-testid', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);
      expect(screen.getByTestId('guideline-card-gl-test-001')).toBeInTheDocument();
    });

    it('renders category badge with correct text', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);
      expect(screen.getByText('Cognitive Isolation')).toBeInTheDocument();
    });

    it('renders priority value', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);
      expect(screen.getByText(/Priority: 900/)).toBeInTheDocument();
    });

    it('shows condition summary with agents', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);
      // Should display agent names from condition
      expect(screen.getByText(/backend, frontend/)).toBeInTheDocument();
    });

    it('shows condition summary with domains when no agents', () => {
      const guideline: Guideline = {
        ...baseMockGuideline,
        condition: { domains: ['planning', 'review'] },
      };
      render(<GuidelineCard guideline={guideline} />);
      expect(screen.getByText(/planning, review/)).toBeInTheDocument();
    });

    it('shows action type', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);
      expect(screen.getByText(/Instruction/)).toBeInTheDocument();
    });
  });

  describe('Category Badge Colors', () => {
    const categories: Array<{ category: Guideline['category']; label: string }> = [
      { category: 'cognitive_isolation', label: 'Cognitive Isolation' },
      { category: 'tdd_protocol', label: 'TDD Protocol' },
      { category: 'hitl_gate', label: 'HITL Gate' },
      { category: 'tool_restriction', label: 'Tool Restriction' },
      { category: 'path_restriction', label: 'Path Restriction' },
      { category: 'commit_policy', label: 'Commit Policy' },
      { category: 'custom', label: 'Custom' },
    ];

    categories.forEach(({ category, label }) => {
      it(`renders ${category} badge with label "${label}"`, () => {
        const guideline: Guideline = { ...baseMockGuideline, category };
        render(<GuidelineCard guideline={guideline} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe('Toggle Button', () => {
    it('toggle button click calls onToggle with guideline id', () => {
      const handleToggle = vi.fn();
      render(<GuidelineCard guideline={baseMockGuideline} onToggle={handleToggle} />);

      fireEvent.click(screen.getByTestId('toggle-gl-test-001'));
      expect(handleToggle).toHaveBeenCalledWith('gl-test-001');
      expect(handleToggle).toHaveBeenCalledTimes(1);
    });

    it('toggle click does not trigger onSelect', () => {
      const handleSelect = vi.fn();
      const handleToggle = vi.fn();
      render(
        <GuidelineCard
          guideline={baseMockGuideline}
          onSelect={handleSelect}
          onToggle={handleToggle}
        />
      );

      fireEvent.click(screen.getByTestId('toggle-gl-test-001'));
      expect(handleToggle).toHaveBeenCalled();
      expect(handleSelect).not.toHaveBeenCalled();
    });

    it('shows enabled state styling when guideline is enabled', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);
      const toggle = screen.getByTestId('toggle-gl-test-001');
      expect(toggle).toHaveClass('bg-blue-600');
    });

    it('shows disabled state styling when guideline is disabled', () => {
      render(<GuidelineCard guideline={disabledGuideline} />);
      const toggle = screen.getByTestId('toggle-gl-disabled-001');
      expect(toggle).toHaveClass('bg-gray-300');
    });

    it('has correct aria-label for enabled guideline', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);
      const toggle = screen.getByTestId('toggle-gl-test-001');
      expect(toggle).toHaveAttribute('aria-label', 'Disable guideline');
    });

    it('has correct aria-label for disabled guideline', () => {
      render(<GuidelineCard guideline={disabledGuideline} />);
      const toggle = screen.getByTestId('toggle-gl-disabled-001');
      expect(toggle).toHaveAttribute('aria-label', 'Enable guideline');
    });
  });

  describe('Selection State', () => {
    it('card click calls onSelect with guideline id', () => {
      const handleSelect = vi.fn();
      render(<GuidelineCard guideline={baseMockGuideline} onSelect={handleSelect} />);

      fireEvent.click(screen.getByTestId('guideline-card-gl-test-001'));
      expect(handleSelect).toHaveBeenCalledWith('gl-test-001');
      expect(handleSelect).toHaveBeenCalledTimes(1);
    });

    it('selected state adds blue border styling', () => {
      render(<GuidelineCard guideline={baseMockGuideline} isSelected />);
      const card = screen.getByTestId('guideline-card-gl-test-001');
      expect(card).toHaveClass('border-blue-500');
    });

    it('unselected state has default border', () => {
      render(<GuidelineCard guideline={baseMockGuideline} isSelected={false} />);
      const card = screen.getByTestId('guideline-card-gl-test-001');
      expect(card).toHaveClass('border-gray-200');
    });
  });

  describe('Disabled Guideline', () => {
    it('disabled guideline has reduced opacity', () => {
      render(<GuidelineCard guideline={disabledGuideline} />);
      const card = screen.getByTestId('guideline-card-gl-disabled-001');
      expect(card).toHaveClass('opacity-60');
    });

    it('enabled guideline does not have reduced opacity', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);
      const card = screen.getByTestId('guideline-card-gl-test-001');
      expect(card).not.toHaveClass('opacity-60');
    });
  });

  describe('Action Type Formatting', () => {
    const actionTypes: Array<{
      action_type: Guideline['action']['action_type'];
      label: string;
    }> = [
      { action_type: 'instruction', label: 'Instruction' },
      { action_type: 'tool_allow', label: 'Tool Allow' },
      { action_type: 'tool_deny', label: 'Tool Deny' },
      { action_type: 'hitl_require', label: 'HITL Require' },
      { action_type: 'custom', label: 'Custom' },
    ];

    actionTypes.forEach(({ action_type, label }) => {
      it(`formats action type "${action_type}" as "${label}"`, () => {
        const guideline: Guideline = {
          ...baseMockGuideline,
          action: { ...baseMockGuideline.action, action_type },
        };
        render(<GuidelineCard guideline={guideline} />);
        expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('renders without onSelect or onToggle callbacks', () => {
      render(<GuidelineCard guideline={baseMockGuideline} />);
      // Should not throw when clicking
      fireEvent.click(screen.getByTestId('guideline-card-gl-test-001'));
      fireEvent.click(screen.getByTestId('toggle-gl-test-001'));
    });

    it('handles guideline with empty condition', () => {
      const guideline: Guideline = {
        ...baseMockGuideline,
        condition: {},
      };
      render(<GuidelineCard guideline={guideline} />);
      expect(screen.getByText('Test Guideline')).toBeInTheDocument();
    });
  });
});
