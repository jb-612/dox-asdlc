/**
 * Tests for MethodologyStepper component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MethodologyStepper, { type Stage } from './MethodologyStepper';

describe('MethodologyStepper', () => {
  const defaultStages: Stage[] = [
    {
      id: 'requirements',
      name: 'Requirements',
      description: 'Gather and document requirements',
      why: 'To understand what needs to be built',
      inputs: ['User needs', 'Business goals'],
      outputs: ['PRD Document'],
      approvals: ['Product Owner'],
      issues: ['Scope creep', 'Unclear requirements'],
    },
    {
      id: 'acceptance',
      name: 'Acceptance Criteria',
      description: 'Define acceptance criteria and test cases',
      why: 'To have clear success criteria',
      inputs: ['PRD Document'],
      outputs: ['Acceptance Criteria', 'Test Cases'],
      approvals: ['QA Lead'],
      issues: ['Missing edge cases'],
    },
    {
      id: 'survey',
      name: 'Codebase Survey',
      description: 'Analyze existing codebase',
      why: 'To understand the current state',
      inputs: ['Source code'],
      outputs: ['Context pack', 'Dependency map'],
      approvals: [],
      issues: ['Large codebase complexity'],
    },
    {
      id: 'design',
      name: 'Technical Design',
      description: 'Create technical design document',
      why: 'To plan the implementation approach',
      inputs: ['PRD', 'Context pack'],
      outputs: ['TDD Document'],
      approvals: ['Tech Lead'],
      issues: ['Architectural decisions'],
    },
    {
      id: 'unit-test',
      name: 'Unit Tests',
      description: 'Write unit tests first (TDD)',
      why: 'To define expected behavior',
      inputs: ['TDD Document'],
      outputs: ['Unit tests'],
      approvals: [],
      issues: ['Test coverage gaps'],
    },
    {
      id: 'coding',
      name: 'Implementation',
      description: 'Write code to pass tests',
      why: 'To implement the feature',
      inputs: ['Unit tests', 'TDD'],
      outputs: ['Source code', 'Patches'],
      approvals: [],
      issues: ['Technical debt'],
    },
    {
      id: 'review',
      name: 'Code Review',
      description: 'Review code changes',
      why: 'To ensure code quality',
      inputs: ['Patches', 'Tests'],
      outputs: ['Approved patches'],
      approvals: ['Reviewer'],
      issues: ['Review bottlenecks'],
    },
    {
      id: 'deploy',
      name: 'Deployment',
      description: 'Deploy to production',
      why: 'To release the feature',
      inputs: ['Approved patches'],
      outputs: ['Deployed feature'],
      approvals: ['Deploy Manager'],
      issues: ['Rollback scenarios'],
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('methodology-stepper')).toBeInTheDocument();
    });

    it('renders all stage indicators', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('stage-requirements')).toBeInTheDocument();
      expect(screen.getByTestId('stage-acceptance')).toBeInTheDocument();
      expect(screen.getByTestId('stage-survey')).toBeInTheDocument();
      expect(screen.getByTestId('stage-design')).toBeInTheDocument();
      expect(screen.getByTestId('stage-unit-test')).toBeInTheDocument();
      expect(screen.getByTestId('stage-coding')).toBeInTheDocument();
      expect(screen.getByTestId('stage-review')).toBeInTheDocument();
      expect(screen.getByTestId('stage-deploy')).toBeInTheDocument();
    });

    it('renders stage numbers', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<MethodologyStepper stages={defaultStages} className="my-custom-class" />);
      expect(screen.getByTestId('methodology-stepper')).toHaveClass('my-custom-class');
    });
  });

  describe('Current Stage', () => {
    it('shows first stage by default', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('stage-content')).toHaveTextContent('Requirements');
    });

    it('shows initialStage when provided', () => {
      render(<MethodologyStepper stages={defaultStages} initialStage="design" />);
      expect(screen.getByTestId('stage-content')).toHaveTextContent('Technical Design');
    });

    it('highlights current stage indicator', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('stage-requirements')).toHaveClass('bg-accent-teal');
    });
  });

  describe('Stage Details', () => {
    it('displays stage name', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      // Stage name appears in both indicator label and content heading
      expect(screen.getAllByText('Requirements').length).toBeGreaterThanOrEqual(1);
      // Check within stage content specifically
      const stageContent = screen.getByTestId('stage-content');
      expect(stageContent).toHaveTextContent('Requirements');
    });

    it('displays stage description', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByText('Gather and document requirements')).toBeInTheDocument();
    });

    it('displays why section', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByText('Why')).toBeInTheDocument();
      expect(screen.getByText('To understand what needs to be built')).toBeInTheDocument();
    });

    it('displays inputs', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByText('Inputs')).toBeInTheDocument();
      expect(screen.getByText('User needs')).toBeInTheDocument();
      expect(screen.getByText('Business goals')).toBeInTheDocument();
    });

    it('displays outputs', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByText('Outputs')).toBeInTheDocument();
      expect(screen.getByText('PRD Document')).toBeInTheDocument();
    });

    it('displays approvals', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByText('Approvals Required')).toBeInTheDocument();
      expect(screen.getByText('Product Owner')).toBeInTheDocument();
    });

    it('displays common issues', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByText('Common Issues')).toBeInTheDocument();
      expect(screen.getByText('Scope creep')).toBeInTheDocument();
    });

    it('hides approvals section when empty', () => {
      render(<MethodologyStepper stages={defaultStages} initialStage="survey" />);
      expect(screen.queryByText('Approvals Required')).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('shows prev/next buttons', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('prev-button')).toBeInTheDocument();
      expect(screen.getByTestId('next-button')).toBeInTheDocument();
    });

    it('navigates to next stage on next click', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      fireEvent.click(screen.getByTestId('next-button'));
      expect(screen.getByTestId('stage-content')).toHaveTextContent('Acceptance Criteria');
    });

    it('navigates to previous stage on prev click', () => {
      render(<MethodologyStepper stages={defaultStages} initialStage="design" />);
      fireEvent.click(screen.getByTestId('prev-button'));
      expect(screen.getByTestId('stage-content')).toHaveTextContent('Codebase Survey');
    });

    it('disables prev button on first stage', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('prev-button')).toBeDisabled();
    });

    it('disables next button on last stage', () => {
      render(<MethodologyStepper stages={defaultStages} initialStage="deploy" />);
      expect(screen.getByTestId('next-button')).toBeDisabled();
    });

    it('navigates to stage on indicator click', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      fireEvent.click(screen.getByTestId('stage-design'));
      expect(screen.getByTestId('stage-content')).toHaveTextContent('Technical Design');
    });

    it('calls onStageChange when stage changes', () => {
      const onStageChange = vi.fn();
      render(<MethodologyStepper stages={defaultStages} onStageChange={onStageChange} />);
      fireEvent.click(screen.getByTestId('next-button'));
      expect(onStageChange).toHaveBeenCalledWith('acceptance');
    });
  });

  describe('Progress Indicator', () => {
    it('shows progress indicator', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
    });

    it('displays current stage number of total', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Stage 1 of 8');
    });

    it('updates progress on navigation', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      fireEvent.click(screen.getByTestId('next-button'));
      expect(screen.getByTestId('progress-indicator')).toHaveTextContent('Stage 2 of 8');
    });

    it('shows progress bar', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });

    it('progress bar reflects current stage', () => {
      render(<MethodologyStepper stages={defaultStages} initialStage="design" />);
      const progressBar = screen.getByTestId('progress-bar-fill');
      // Stage 4 of 8 = 50%
      expect(progressBar).toHaveStyle({ width: '50%' });
    });
  });

  describe('Keyboard Navigation', () => {
    it('stage indicators are focusable', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('stage-requirements')).toHaveAttribute('tabIndex', '0');
    });

    it('navigates to stage on Enter key', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      const designStage = screen.getByTestId('stage-design');
      fireEvent.keyDown(designStage, { key: 'Enter' });
      expect(screen.getByTestId('stage-content')).toHaveTextContent('Technical Design');
    });

    it('navigates to stage on Space key', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      const designStage = screen.getByTestId('stage-design');
      fireEvent.keyDown(designStage, { key: ' ' });
      expect(screen.getByTestId('stage-content')).toHaveTextContent('Technical Design');
    });

    it('supports arrow key navigation', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      const stepper = screen.getByTestId('methodology-stepper');

      fireEvent.keyDown(stepper, { key: 'ArrowRight' });
      expect(screen.getByTestId('stage-content')).toHaveTextContent('Acceptance Criteria');

      fireEvent.keyDown(stepper, { key: 'ArrowLeft' });
      expect(screen.getByTestId('stage-content')).toHaveTextContent('Requirements');
    });
  });

  describe('Visual States', () => {
    it('shows completed stages as filled', () => {
      render(<MethodologyStepper stages={defaultStages} initialStage="design" />);
      // Stages before current should be filled/completed
      expect(screen.getByTestId('stage-requirements')).toHaveClass('bg-accent-teal');
      expect(screen.getByTestId('stage-acceptance')).toHaveClass('bg-accent-teal');
      expect(screen.getByTestId('stage-survey')).toHaveClass('bg-accent-teal');
    });

    it('shows future stages as empty', () => {
      render(<MethodologyStepper stages={defaultStages} initialStage="design" />);
      expect(screen.getByTestId('stage-unit-test')).not.toHaveClass('bg-accent-teal');
      expect(screen.getByTestId('stage-coding')).not.toHaveClass('bg-accent-teal');
    });

    it('shows connecting lines between stages', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getAllByTestId('stage-connector').length).toBe(7);
    });
  });

  describe('Accessibility', () => {
    it('has aria-current on current stage', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('stage-requirements')).toHaveAttribute('aria-current', 'step');
    });

    it('has aria-label on navigation buttons', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('prev-button')).toHaveAttribute('aria-label', 'Previous stage');
      expect(screen.getByTestId('next-button')).toHaveAttribute('aria-label', 'Next stage');
    });

    it('has role="tablist" on stage indicators', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('stage-indicators')).toHaveAttribute('role', 'tablist');
    });

    it('has role="tab" on each stage indicator', () => {
      render(<MethodologyStepper stages={defaultStages} />);
      expect(screen.getByTestId('stage-requirements')).toHaveAttribute('role', 'tab');
    });
  });

  describe('Empty State', () => {
    it('renders empty state when no stages', () => {
      render(<MethodologyStepper stages={[]} />);
      expect(screen.getByText(/no stages/i)).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('supports compact mode', () => {
      render(<MethodologyStepper stages={defaultStages} compact />);
      expect(screen.getByTestId('methodology-stepper')).toHaveClass('compact');
    });

    it('hides descriptions in compact mode', () => {
      render(<MethodologyStepper stages={defaultStages} compact />);
      expect(screen.queryByText('Gather and document requirements')).not.toBeInTheDocument();
    });
  });
});
