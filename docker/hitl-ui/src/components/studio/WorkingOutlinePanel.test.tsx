/**
 * Tests for WorkingOutlinePanel component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkingOutlinePanel, { type OutlineSection } from './WorkingOutlinePanel';

describe('WorkingOutlinePanel', () => {
  const defaultSections: OutlineSection[] = [
    { id: 'sec-1', title: 'Executive Summary', status: 'complete', content: 'This is the executive summary.' },
    { id: 'sec-2', title: 'Problem Statement', status: 'complete', content: 'The problem we are solving.' },
    { id: 'sec-3', title: 'Goals & Objectives', status: 'in_progress', content: 'Goals are being defined...' },
    { id: 'sec-4', title: 'User Stories', status: 'pending', content: '' },
    { id: 'sec-5', title: 'Technical Requirements', status: 'pending', content: '' },
    { id: 'sec-6', title: 'Success Metrics', status: 'pending', content: '' },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByTestId('working-outline-panel')).toBeInTheDocument();
    });

    it('renders panel title', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByText(/outline/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<WorkingOutlinePanel sections={defaultSections} className="my-custom-class" />);
      expect(screen.getByTestId('working-outline-panel')).toHaveClass('my-custom-class');
    });
  });

  describe('Section Display', () => {
    it('displays all sections', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
      expect(screen.getByText('Problem Statement')).toBeInTheDocument();
      expect(screen.getByText('Goals & Objectives')).toBeInTheDocument();
      expect(screen.getByText('User Stories')).toBeInTheDocument();
    });

    it('shows complete status icon for complete sections', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      const section = screen.getByTestId('section-sec-1');
      expect(section.querySelector('[data-testid="status-complete"]')).toBeInTheDocument();
    });

    it('shows in-progress status icon for in-progress sections', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      const section = screen.getByTestId('section-sec-3');
      expect(section.querySelector('[data-testid="status-in_progress"]')).toBeInTheDocument();
    });

    it('shows pending status icon for pending sections', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      const section = screen.getByTestId('section-sec-4');
      expect(section.querySelector('[data-testid="status-pending"]')).toBeInTheDocument();
    });
  });

  describe('Progress Indicator', () => {
    it('displays completeness percentage', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      // 2 complete out of 6 = 33%
      expect(screen.getByTestId('completeness-percentage')).toHaveTextContent('33%');
    });

    it('shows progress bar', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });

    it('progress bar reflects completion', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      const progressFill = screen.getByTestId('progress-fill');
      expect(progressFill).toHaveStyle({ width: '33%' });
    });

    it('shows 100% when all complete', () => {
      const allComplete = defaultSections.map((s) => ({ ...s, status: 'complete' as const }));
      render(<WorkingOutlinePanel sections={allComplete} />);
      expect(screen.getByTestId('completeness-percentage')).toHaveTextContent('100%');
    });

    it('shows 0% when none complete', () => {
      const noneComplete = defaultSections.map((s) => ({ ...s, status: 'pending' as const }));
      render(<WorkingOutlinePanel sections={noneComplete} />);
      expect(screen.getByTestId('completeness-percentage')).toHaveTextContent('0%');
    });
  });

  describe('Section Interaction', () => {
    it('expands section on click', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);

      fireEvent.click(screen.getByTestId('section-sec-1'));

      expect(screen.getByTestId('section-content-sec-1')).toBeInTheDocument();
      expect(screen.getByText('This is the executive summary.')).toBeInTheDocument();
    });

    it('collapses section on second click', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);

      fireEvent.click(screen.getByTestId('section-sec-1'));
      expect(screen.getByTestId('section-content-sec-1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('section-sec-1'));
      expect(screen.queryByTestId('section-content-sec-1')).not.toBeInTheDocument();
    });

    it('allows multiple sections to be expanded', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);

      fireEvent.click(screen.getByTestId('section-sec-1'));
      fireEvent.click(screen.getByTestId('section-sec-2'));

      expect(screen.getByTestId('section-content-sec-1')).toBeInTheDocument();
      expect(screen.getByTestId('section-content-sec-2')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('shows Preview PRD button', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByRole('button', { name: /preview prd/i })).toBeInTheDocument();
    });

    it('shows Save Draft button', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    });

    it('calls onPreviewPRD when Preview PRD clicked', () => {
      const onPreview = vi.fn();
      render(<WorkingOutlinePanel sections={defaultSections} onPreviewPRD={onPreview} />);

      fireEvent.click(screen.getByRole('button', { name: /preview prd/i }));

      expect(onPreview).toHaveBeenCalled();
    });

    it('calls onSaveDraft when Save Draft clicked', () => {
      const onSave = vi.fn();
      render(<WorkingOutlinePanel sections={defaultSections} onSaveDraft={onSave} />);

      fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

      expect(onSave).toHaveBeenCalled();
    });

    it('disables Preview PRD when nothing complete', () => {
      const noneComplete = defaultSections.map((s) => ({ ...s, status: 'pending' as const }));
      render(<WorkingOutlinePanel sections={noneComplete} />);

      expect(screen.getByRole('button', { name: /preview prd/i })).toBeDisabled();
    });
  });

  describe('Section Counts', () => {
    it('shows complete count', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByTestId('count-complete')).toHaveTextContent('2');
    });

    it('shows in-progress count', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByTestId('count-in_progress')).toHaveTextContent('1');
    });

    it('shows pending count', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByTestId('count-pending')).toHaveTextContent('3');
    });
  });

  describe('Empty State', () => {
    it('shows message when no sections', () => {
      render(<WorkingOutlinePanel sections={[]} />);
      expect(screen.getByText(/no outline sections/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<WorkingOutlinePanel sections={defaultSections} isLoading />);
      expect(screen.getByTestId('outline-loading')).toBeInTheDocument();
    });

    it('shows skeleton sections when loading', () => {
      render(<WorkingOutlinePanel sections={defaultSections} isLoading />);
      expect(screen.getAllByTestId('section-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Callbacks', () => {
    it('calls onSectionClick when section is clicked', () => {
      const onClick = vi.fn();
      render(<WorkingOutlinePanel sections={defaultSections} onSectionClick={onClick} />);

      fireEvent.click(screen.getByTestId('section-sec-1'));

      expect(onClick).toHaveBeenCalledWith('sec-1');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('sections are keyboard accessible', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      const section = screen.getByTestId('section-sec-1');
      expect(section).toHaveAttribute('tabIndex', '0');
    });

    it('sections respond to Enter key', () => {
      render(<WorkingOutlinePanel sections={defaultSections} />);
      const section = screen.getByTestId('section-sec-1');

      fireEvent.keyDown(section, { key: 'Enter' });

      expect(screen.getByTestId('section-content-sec-1')).toBeInTheDocument();
    });
  });
});
