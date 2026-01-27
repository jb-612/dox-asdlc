/**
 * Tests for DevOpsStepList component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DevOpsStepList from './DevOpsStepList';
import type { DevOpsStep } from '../../api/types/devops';

describe('DevOpsStepList', () => {
  const mockSteps: DevOpsStep[] = [
    {
      name: 'Pull images',
      status: 'completed',
      startedAt: '2026-01-27T10:00:00Z',
      completedAt: '2026-01-27T10:01:00Z',
    },
    {
      name: 'Apply manifests',
      status: 'running',
      startedAt: '2026-01-27T10:01:00Z',
    },
    {
      name: 'Wait for rollout',
      status: 'pending',
    },
    {
      name: 'Health check',
      status: 'pending',
    },
  ];

  const failedSteps: DevOpsStep[] = [
    {
      name: 'Pull images',
      status: 'completed',
      startedAt: '2026-01-27T10:00:00Z',
      completedAt: '2026-01-27T10:01:00Z',
    },
    {
      name: 'Apply manifests',
      status: 'failed',
      startedAt: '2026-01-27T10:01:00Z',
      completedAt: '2026-01-27T10:01:30Z',
      error: 'Failed to apply deployment: ImagePullBackOff',
    },
    {
      name: 'Wait for rollout',
      status: 'pending',
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<DevOpsStepList steps={mockSteps} />);
      expect(screen.getByTestId('devops-step-list')).toBeInTheDocument();
    });

    it('renders all steps in order', () => {
      render(<DevOpsStepList steps={mockSteps} />);
      const steps = screen.getAllByTestId(/^step-/);
      expect(steps).toHaveLength(4);
    });

    it('displays step names', () => {
      render(<DevOpsStepList steps={mockSteps} />);
      expect(screen.getByText('Pull images')).toBeInTheDocument();
      expect(screen.getByText('Apply manifests')).toBeInTheDocument();
      expect(screen.getByText('Wait for rollout')).toBeInTheDocument();
      expect(screen.getByText('Health check')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DevOpsStepList steps={mockSteps} className="my-custom-class" />);
      expect(screen.getByTestId('devops-step-list')).toHaveClass('my-custom-class');
    });
  });

  describe('Step Status Icons', () => {
    it('shows checkmark icon for completed steps (green)', () => {
      render(<DevOpsStepList steps={mockSteps} />);
      const completedStep = screen.getByTestId('step-0');
      const icon = completedStep.querySelector('[data-testid="icon-completed"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-status-success');
    });

    it('shows spinner icon for running step (blue)', () => {
      render(<DevOpsStepList steps={mockSteps} />);
      const runningStep = screen.getByTestId('step-1');
      const icon = runningStep.querySelector('[data-testid="icon-running"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-accent-blue');
    });

    it('shows circle icon for pending steps (gray)', () => {
      render(<DevOpsStepList steps={mockSteps} />);
      const pendingStep = screen.getByTestId('step-2');
      const icon = pendingStep.querySelector('[data-testid="icon-pending"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-text-muted');
    });

    it('shows X icon for failed steps (red)', () => {
      render(<DevOpsStepList steps={failedSteps} />);
      const failedStep = screen.getByTestId('step-1');
      const icon = failedStep.querySelector('[data-testid="icon-failed"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-status-error');
    });
  });

  describe('Failed Step Error Message', () => {
    it('shows error message for failed step', () => {
      render(<DevOpsStepList steps={failedSteps} />);
      expect(screen.getByText(/Failed to apply deployment: ImagePullBackOff/)).toBeInTheDocument();
    });

    it('displays error message with error styling', () => {
      render(<DevOpsStepList steps={failedSteps} />);
      const errorMessage = screen.getByTestId('step-1-error');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass('text-status-error');
    });

    it('does not show error for non-failed steps', () => {
      render(<DevOpsStepList steps={mockSteps} />);
      expect(screen.queryByTestId('step-0-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('step-1-error')).not.toBeInTheDocument();
    });
  });

  describe('CSS Transitions', () => {
    it('has transition classes applied to step items', () => {
      render(<DevOpsStepList steps={mockSteps} />);
      const step = screen.getByTestId('step-0');
      expect(step).toHaveClass('transition-all');
    });

    it('has transition classes applied to icons', () => {
      render(<DevOpsStepList steps={mockSteps} />);
      const step = screen.getByTestId('step-0');
      const iconContainer = step.querySelector('[data-testid="icon-container-0"]');
      expect(iconContainer).toHaveClass('transition-all');
    });
  });

  describe('Empty State', () => {
    it('renders empty state when no steps provided', () => {
      render(<DevOpsStepList steps={[]} />);
      expect(screen.getByTestId('devops-step-list')).toBeInTheDocument();
      expect(screen.queryAllByTestId(/^step-/)).toHaveLength(0);
    });
  });

  describe('All States Together', () => {
    it('renders all step states correctly in one list', () => {
      const allStatesSteps: DevOpsStep[] = [
        { name: 'Completed step', status: 'completed', startedAt: '2026-01-27T10:00:00Z', completedAt: '2026-01-27T10:01:00Z' },
        { name: 'Running step', status: 'running', startedAt: '2026-01-27T10:01:00Z' },
        { name: 'Failed step', status: 'failed', startedAt: '2026-01-27T10:02:00Z', error: 'Error occurred' },
        { name: 'Pending step', status: 'pending' },
      ];

      render(<DevOpsStepList steps={allStatesSteps} />);

      // Verify each state has the correct icon
      expect(screen.getByTestId('step-0').querySelector('[data-testid="icon-completed"]')).toBeInTheDocument();
      expect(screen.getByTestId('step-1').querySelector('[data-testid="icon-running"]')).toBeInTheDocument();
      expect(screen.getByTestId('step-2').querySelector('[data-testid="icon-failed"]')).toBeInTheDocument();
      expect(screen.getByTestId('step-3').querySelector('[data-testid="icon-pending"]')).toBeInTheDocument();
    });
  });
});
