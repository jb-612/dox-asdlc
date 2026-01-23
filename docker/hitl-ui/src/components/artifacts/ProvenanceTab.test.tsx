/**
 * Tests for ProvenanceTab component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ProvenanceTab, { type ArtifactProvenance } from './ProvenanceTab';

describe('ProvenanceTab', () => {
  const defaultProvenance: ArtifactProvenance = {
    producingRun: {
      id: 'run-123',
      agent: 'prd-agent',
      cluster: 'discovery',
      startedAt: '2026-01-23T10:00:00Z',
      completedAt: '2026-01-23T10:05:00Z',
      status: 'success',
    },
    inputArtifacts: [
      { id: 'art-1', name: 'requirements.md', type: 'markdown' },
      { id: 'art-2', name: 'context-pack.json', type: 'json' },
    ],
    approvingGate: {
      id: 'gate-456',
      name: 'PRD Review',
      status: 'approved',
      decidedAt: '2026-01-23T11:00:00Z',
      reviewer: 'john@example.com',
    },
    feedback: [
      {
        id: 'fb-1',
        type: 'correction',
        summary: 'Minor formatting updates',
        createdAt: '2026-01-23T10:30:00Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByTestId('provenance-tab')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ProvenanceTab provenance={defaultProvenance} className="my-custom-class" />);
      expect(screen.getByTestId('provenance-tab')).toHaveClass('my-custom-class');
    });

    it('renders title', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByText(/provenance/i)).toBeInTheDocument();
    });
  });

  describe('Producing Run', () => {
    it('displays producing run section', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByTestId('producing-run')).toBeInTheDocument();
    });

    it('shows run ID', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByText('run-123')).toBeInTheDocument();
    });

    it('shows agent name', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByText('prd-agent')).toBeInTheDocument();
    });

    it('shows cluster', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByText('discovery')).toBeInTheDocument();
    });

    it('shows run status', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      const runSection = screen.getByTestId('producing-run');
      expect(within(runSection).getByTestId('run-status')).toHaveTextContent(/success/i);
    });

    it('shows run duration', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      const runSection = screen.getByTestId('producing-run');
      expect(within(runSection).getByTestId('run-duration')).toBeInTheDocument();
    });

    it('calls onRunClick when run link clicked', () => {
      const onClick = vi.fn();
      render(<ProvenanceTab provenance={defaultProvenance} onRunClick={onClick} />);

      fireEvent.click(screen.getByTestId('run-link'));

      expect(onClick).toHaveBeenCalledWith('run-123');
    });
  });

  describe('Input Artifacts', () => {
    it('displays input artifacts section', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByTestId('input-artifacts')).toBeInTheDocument();
    });

    it('shows input artifact count', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByTestId('input-count')).toHaveTextContent('2');
    });

    it('lists all input artifacts', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByText('requirements.md')).toBeInTheDocument();
      expect(screen.getByText('context-pack.json')).toBeInTheDocument();
    });

    it('shows artifact types', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      const artifact = screen.getByTestId('input-art-1');
      expect(within(artifact).getByTestId('artifact-type')).toHaveTextContent('markdown');
    });

    it('calls onArtifactClick when artifact clicked', () => {
      const onClick = vi.fn();
      render(<ProvenanceTab provenance={defaultProvenance} onArtifactClick={onClick} />);

      fireEvent.click(screen.getByTestId('input-art-1'));

      expect(onClick).toHaveBeenCalledWith('art-1');
    });

    it('shows empty state when no inputs', () => {
      const noInputs = { ...defaultProvenance, inputArtifacts: [] };
      render(<ProvenanceTab provenance={noInputs} />);
      expect(screen.getByText(/no input artifacts/i)).toBeInTheDocument();
    });
  });

  describe('Approving Gate', () => {
    it('displays approving gate section', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByTestId('approving-gate')).toBeInTheDocument();
    });

    it('shows gate name', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByText('PRD Review')).toBeInTheDocument();
    });

    it('shows gate status', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      const gateSection = screen.getByTestId('approving-gate');
      expect(within(gateSection).getByTestId('gate-status')).toHaveTextContent(/approved/i);
    });

    it('shows reviewer', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('shows decision time', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByTestId('gate-time')).toBeInTheDocument();
    });

    it('calls onGateClick when gate link clicked', () => {
      const onClick = vi.fn();
      render(<ProvenanceTab provenance={defaultProvenance} onGateClick={onClick} />);

      fireEvent.click(screen.getByTestId('gate-link'));

      expect(onClick).toHaveBeenCalledWith('gate-456');
    });

    it('shows pending state when gate not decided', () => {
      const pendingGate = {
        ...defaultProvenance,
        approvingGate: {
          id: 'gate-789',
          name: 'Design Review',
          status: 'pending',
        },
      };
      render(<ProvenanceTab provenance={pendingGate} />);
      const gateSection = screen.getByTestId('approving-gate');
      expect(within(gateSection).getByTestId('gate-status')).toHaveTextContent(/pending/i);
    });

    it('shows rejected status badge', () => {
      const rejectedGate = {
        ...defaultProvenance,
        approvingGate: {
          id: 'gate-789',
          name: 'Code Review',
          status: 'rejected',
          decidedAt: '2026-01-23T12:00:00Z',
          reviewer: 'alice@example.com',
        },
      };
      render(<ProvenanceTab provenance={rejectedGate} />);
      const gateSection = screen.getByTestId('approving-gate');
      expect(within(gateSection).getByTestId('gate-status')).toHaveTextContent(/rejected/i);
    });

    it('shows no gate message when no gate', () => {
      const noGate = { ...defaultProvenance, approvingGate: undefined };
      render(<ProvenanceTab provenance={noGate} />);
      expect(screen.getByText(/no gate approval/i)).toBeInTheDocument();
    });
  });

  describe('Feedback', () => {
    it('displays feedback section', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByTestId('feedback-section')).toBeInTheDocument();
    });

    it('shows feedback count', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByTestId('feedback-count')).toHaveTextContent('1');
    });

    it('lists feedback items', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getByText('Minor formatting updates')).toBeInTheDocument();
    });

    it('shows feedback type', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      const feedback = screen.getByTestId('feedback-fb-1');
      expect(within(feedback).getByTestId('feedback-type')).toHaveTextContent(/correction/i);
    });

    it('shows empty state when no feedback', () => {
      const noFeedback = { ...defaultProvenance, feedback: [] };
      render(<ProvenanceTab provenance={noFeedback} />);
      expect(screen.getByText(/no feedback/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no provenance', () => {
      render(<ProvenanceTab provenance={null} />);
      expect(screen.getByText(/no provenance data/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<ProvenanceTab provenance={defaultProvenance} isLoading />);
      expect(screen.getByTestId('provenance-loading')).toBeInTheDocument();
    });

    it('shows skeleton sections when loading', () => {
      render(<ProvenanceTab provenance={defaultProvenance} isLoading />);
      expect(screen.getAllByTestId('skeleton-section').length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('links are keyboard accessible', () => {
      const onRunClick = vi.fn();
      render(<ProvenanceTab provenance={defaultProvenance} onRunClick={onRunClick} />);

      const runLink = screen.getByTestId('run-link');
      fireEvent.keyDown(runLink, { key: 'Enter' });

      expect(onRunClick).toHaveBeenCalled();
    });

    it('sections have appropriate headings', () => {
      render(<ProvenanceTab provenance={defaultProvenance} />);
      expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    });
  });
});
