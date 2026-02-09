/**
 * Tests for ConditionBuilder component (P11-F01 T22)
 *
 * Verifies rendering of condition fields, tag input behavior,
 * add/remove tag operations, disabled state, and onChange callback.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionBuilder } from './ConditionBuilder';
import type { GuidelineCondition } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const emptyCondition: GuidelineCondition = {};

const populatedCondition: GuidelineCondition = {
  agents: ['backend', 'frontend'],
  domains: ['planning', 'testing'],
  actions: ['implement'],
  paths: ['src/workers/'],
  events: null,
  gate_types: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConditionBuilder', () => {
  describe('Renders all field sections', () => {
    it('renders agents section', () => {
      render(
        <ConditionBuilder condition={emptyCondition} onChange={vi.fn()} />
      );
      expect(screen.getByTestId('condition-agents')).toBeInTheDocument();
    });

    it('renders domains section', () => {
      render(
        <ConditionBuilder condition={emptyCondition} onChange={vi.fn()} />
      );
      expect(screen.getByTestId('condition-domains')).toBeInTheDocument();
    });

    it('renders actions section', () => {
      render(
        <ConditionBuilder condition={emptyCondition} onChange={vi.fn()} />
      );
      expect(screen.getByTestId('condition-actions')).toBeInTheDocument();
    });

    it('renders paths section', () => {
      render(
        <ConditionBuilder condition={emptyCondition} onChange={vi.fn()} />
      );
      expect(screen.getByTestId('condition-paths')).toBeInTheDocument();
    });

    it('renders events section', () => {
      render(
        <ConditionBuilder condition={emptyCondition} onChange={vi.fn()} />
      );
      expect(screen.getByTestId('condition-events')).toBeInTheDocument();
    });

    it('renders gate types section', () => {
      render(
        <ConditionBuilder condition={emptyCondition} onChange={vi.fn()} />
      );
      expect(screen.getByTestId('condition-gate-types')).toBeInTheDocument();
    });
  });

  describe('Shows existing tags', () => {
    it('displays existing agent tags', () => {
      render(
        <ConditionBuilder condition={populatedCondition} onChange={vi.fn()} />
      );
      expect(screen.getByText('backend')).toBeInTheDocument();
      expect(screen.getByText('frontend')).toBeInTheDocument();
    });

    it('displays existing domain tags', () => {
      render(
        <ConditionBuilder condition={populatedCondition} onChange={vi.fn()} />
      );
      expect(screen.getByText('planning')).toBeInTheDocument();
      expect(screen.getByText('testing')).toBeInTheDocument();
    });

    it('displays existing action tags', () => {
      render(
        <ConditionBuilder condition={populatedCondition} onChange={vi.fn()} />
      );
      expect(screen.getByText('implement')).toBeInTheDocument();
    });

    it('displays existing path tags', () => {
      render(
        <ConditionBuilder condition={populatedCondition} onChange={vi.fn()} />
      );
      expect(screen.getByText('src/workers/')).toBeInTheDocument();
    });
  });

  describe('Adding a new tag via Enter key', () => {
    it('adds a new agent via Enter key', () => {
      const handleChange = vi.fn();
      render(
        <ConditionBuilder condition={populatedCondition} onChange={handleChange} />
      );

      const input = screen.getByTestId('input-agents');
      fireEvent.change(input, { target: { value: 'orchestrator' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(handleChange).toHaveBeenCalledWith({
        ...populatedCondition,
        agents: ['backend', 'frontend', 'orchestrator'],
      });
    });
  });

  describe('Adding a new tag via comma key', () => {
    it('adds a new domain via comma key', () => {
      const handleChange = vi.fn();
      render(
        <ConditionBuilder condition={populatedCondition} onChange={handleChange} />
      );

      const input = screen.getByTestId('input-domains');
      fireEvent.change(input, { target: { value: 'deployment' } });
      fireEvent.keyDown(input, { key: ',' });

      expect(handleChange).toHaveBeenCalledWith({
        ...populatedCondition,
        domains: ['planning', 'testing', 'deployment'],
      });
    });
  });

  describe('Removing a tag', () => {
    it('removes a tag when x button is clicked', () => {
      const handleChange = vi.fn();
      render(
        <ConditionBuilder condition={populatedCondition} onChange={handleChange} />
      );

      fireEvent.click(screen.getByTestId('remove-agents-1'));

      expect(handleChange).toHaveBeenCalledWith({
        ...populatedCondition,
        agents: ['backend'],
      });
    });
  });

  describe('Removing last tag sets field to null', () => {
    it('sets field to null when last tag is removed', () => {
      const singleActionCondition: GuidelineCondition = {
        ...populatedCondition,
        actions: ['implement'],
      };
      const handleChange = vi.fn();
      render(
        <ConditionBuilder condition={singleActionCondition} onChange={handleChange} />
      );

      fireEvent.click(screen.getByTestId('remove-actions-0'));

      expect(handleChange).toHaveBeenCalledWith({
        ...singleActionCondition,
        actions: null,
      });
    });
  });

  describe('onChange is called with updated condition', () => {
    it('passes the full condition object with only the changed field', () => {
      const handleChange = vi.fn();
      render(
        <ConditionBuilder condition={emptyCondition} onChange={handleChange} />
      );

      const input = screen.getByTestId('input-paths');
      fireEvent.change(input, { target: { value: 'src/core/' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalledWith({
        ...emptyCondition,
        paths: ['src/core/'],
      });
    });
  });

  describe('Duplicate tags are not added', () => {
    it('does not add a duplicate agent tag', () => {
      const handleChange = vi.fn();
      render(
        <ConditionBuilder condition={populatedCondition} onChange={handleChange} />
      );

      const input = screen.getByTestId('input-agents');
      fireEvent.change(input, { target: { value: 'backend' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should not call onChange because tag already exists
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Disabled state', () => {
    it('hides input fields when disabled', () => {
      render(
        <ConditionBuilder
          condition={populatedCondition}
          onChange={vi.fn()}
          disabled
        />
      );

      expect(screen.queryByTestId('input-agents')).not.toBeInTheDocument();
      expect(screen.queryByTestId('input-domains')).not.toBeInTheDocument();
      expect(screen.queryByTestId('input-actions')).not.toBeInTheDocument();
      expect(screen.queryByTestId('input-paths')).not.toBeInTheDocument();
      expect(screen.queryByTestId('input-events')).not.toBeInTheDocument();
      expect(screen.queryByTestId('input-gate-types')).not.toBeInTheDocument();
    });

    it('hides remove buttons when disabled', () => {
      render(
        <ConditionBuilder
          condition={populatedCondition}
          onChange={vi.fn()}
          disabled
        />
      );

      expect(screen.queryByTestId('remove-agents-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('remove-agents-1')).not.toBeInTheDocument();
    });

    it('still shows existing tag values when disabled', () => {
      render(
        <ConditionBuilder
          condition={populatedCondition}
          onChange={vi.fn()}
          disabled
        />
      );

      expect(screen.getByText('backend')).toBeInTheDocument();
      expect(screen.getByText('frontend')).toBeInTheDocument();
    });
  });

  describe('Empty input is not added', () => {
    it('does not add empty string tag', () => {
      const handleChange = vi.fn();
      render(
        <ConditionBuilder condition={emptyCondition} onChange={handleChange} />
      );

      const input = screen.getByTestId('input-agents');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(handleChange).not.toHaveBeenCalled();
    });

    it('does not add whitespace-only tag', () => {
      const handleChange = vi.fn();
      render(
        <ConditionBuilder condition={emptyCondition} onChange={handleChange} />
      );

      const input = screen.getByTestId('input-agents');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(handleChange).not.toHaveBeenCalled();
    });
  });
});
