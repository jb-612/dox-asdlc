/**
 * Tests for EvidenceTab component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EvidenceTab, { type Evidence } from './EvidenceTab';

describe('EvidenceTab', () => {
  const defaultEvidence: Evidence = {
    testReports: [
      {
        id: 'report-1',
        name: 'Unit Tests',
        type: 'unit',
        passed: 48,
        failed: 2,
        total: 50,
        content: 'Test suite results...',
      },
      {
        id: 'report-2',
        name: 'Integration Tests',
        type: 'integration',
        passed: 15,
        failed: 0,
        total: 15,
        content: 'Integration test results...',
      },
    ],
    diffs: [
      {
        id: 'diff-1',
        file: 'src/main.ts',
        content: '+ new line\n- old line',
        additions: 5,
        deletions: 3,
      },
    ],
    securityScans: [
      {
        id: 'scan-1',
        name: 'Dependency Audit',
        status: 'passed',
        findings: 0,
        details: 'No vulnerabilities found',
      },
      {
        id: 'scan-2',
        name: 'SAST Scan',
        status: 'warning',
        findings: 2,
        details: 'Found 2 medium severity issues',
      },
    ],
    logs: [
      { id: 'log-1', type: 'stdout', content: 'Build completed successfully' },
      { id: 'log-2', type: 'stderr', content: 'Warning: deprecated function' },
    ],
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByTestId('evidence-tab')).toBeInTheDocument();
    });

    it('renders section title', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByText(/evidence/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<EvidenceTab evidence={defaultEvidence} className="my-custom-class" />);
      expect(screen.getByTestId('evidence-tab')).toHaveClass('my-custom-class');
    });
  });

  describe('Test Reports Section', () => {
    it('shows test reports section', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByTestId('test-reports-section')).toBeInTheDocument();
    });

    it('lists all test reports', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByText('Unit Tests')).toBeInTheDocument();
      expect(screen.getByText('Integration Tests')).toBeInTheDocument();
    });

    it('shows pass/fail count', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      const report = screen.getByTestId('report-report-1');
      expect(report).toHaveTextContent('48/50');
    });

    it('expands to show content', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);

      fireEvent.click(screen.getByTestId('expand-report-1'));

      expect(screen.getByTestId('content-report-1')).toBeInTheDocument();
      expect(screen.getByText('Test suite results...')).toBeInTheDocument();
    });
  });

  describe('Diffs Section', () => {
    it('shows diffs section', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByTestId('diffs-section')).toBeInTheDocument();
    });

    it('lists all diffs', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByText('src/main.ts')).toBeInTheDocument();
    });

    it('shows additions and deletions', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      const diff = screen.getByTestId('diff-diff-1');
      expect(diff).toHaveTextContent('+5');
      expect(diff).toHaveTextContent('-3');
    });

    it('expands to show diff content', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);

      fireEvent.click(screen.getByTestId('expand-diff-1'));

      expect(screen.getByTestId('content-diff-1')).toBeInTheDocument();
    });
  });

  describe('Security Scans Section', () => {
    it('shows security scans section', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByTestId('security-scans-section')).toBeInTheDocument();
    });

    it('lists all scans', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByText('Dependency Audit')).toBeInTheDocument();
      expect(screen.getByText('SAST Scan')).toBeInTheDocument();
    });

    it('shows scan status', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      const passedScan = screen.getByTestId('scan-scan-1');
      expect(passedScan).toHaveTextContent(/passed/i);

      const warningScan = screen.getByTestId('scan-scan-2');
      expect(warningScan).toHaveTextContent(/warning/i);
    });

    it('shows findings count', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      const warningScan = screen.getByTestId('scan-scan-2');
      expect(warningScan).toHaveTextContent('2 findings');
    });

    it('expands to show details', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);

      fireEvent.click(screen.getByTestId('expand-scan-1'));

      expect(screen.getByText('No vulnerabilities found')).toBeInTheDocument();
    });
  });

  describe('Logs Section', () => {
    it('shows logs section', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByTestId('logs-section')).toBeInTheDocument();
    });

    it('shows log entries', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getByText('Build completed successfully')).toBeInTheDocument();
    });

    it('differentiates log types', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      const stderrLog = screen.getByTestId('log-log-2');
      expect(stderrLog).toHaveClass('text-status-warning');
    });
  });

  describe('Empty States', () => {
    it('shows empty message when no test reports', () => {
      const noReports = { ...defaultEvidence, testReports: [] };
      render(<EvidenceTab evidence={noReports} />);

      expect(screen.getByText(/no test reports/i)).toBeInTheDocument();
    });

    it('shows empty message when no diffs', () => {
      const noDiffs = { ...defaultEvidence, diffs: [] };
      render(<EvidenceTab evidence={noDiffs} />);

      expect(screen.getByText(/no diffs/i)).toBeInTheDocument();
    });

    it('shows empty message when no security scans', () => {
      const noScans = { ...defaultEvidence, securityScans: [] };
      render(<EvidenceTab evidence={noScans} />);

      expect(screen.getByText(/no security scans/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<EvidenceTab evidence={defaultEvidence} isLoading />);
      expect(screen.getByTestId('evidence-loading')).toBeInTheDocument();
    });

    it('shows skeleton sections when loading', () => {
      render(<EvidenceTab evidence={defaultEvidence} isLoading />);
      expect(screen.getAllByTestId('section-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper section headings', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    });

    it('expand buttons have aria-expanded', () => {
      render(<EvidenceTab evidence={defaultEvidence} />);
      const expandBtn = screen.getByTestId('expand-report-1');
      expect(expandBtn).toHaveAttribute('aria-expanded');
    });
  });
});
