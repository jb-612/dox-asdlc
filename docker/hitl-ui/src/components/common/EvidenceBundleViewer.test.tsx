/**
 * Tests for EvidenceBundleViewer component
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EvidenceBundleViewer, {
  type Evidence,
  type TestResultsEvidence,
  type DiffEvidence,
  type ReportEvidence,
  type LogEvidence,
  type SecurityScanEvidence,
} from './EvidenceBundleViewer';

// Mock evidence data
const mockTestResults: TestResultsEvidence = {
  type: 'test_results',
  summary: {
    total: 10,
    passed: 8,
    failed: 1,
    skipped: 1,
  },
  results: [
    { name: 'test_addition', status: 'passed', duration: 50 },
    { name: 'test_subtraction', status: 'passed', duration: 45 },
    { name: 'test_division_by_zero', status: 'failed', duration: 30, message: 'Expected error', details: 'AssertionError: Expected ZeroDivisionError' },
    { name: 'test_pending_feature', status: 'skipped' },
  ],
};

const mockDiff: DiffEvidence = {
  type: 'diff',
  filename: 'src/utils.py',
  language: 'python',
  oldContent: 'def add(a, b):\n    return a + b',
  newContent: 'def add(a, b):\n    """Add two numbers."""\n    return a + b',
};

const mockReport: ReportEvidence = {
  type: 'report',
  title: 'Coverage Report',
  format: 'json',
  content: '{"coverage": 85.5, "lines": 200}',
};

const mockTextReport: ReportEvidence = {
  type: 'report',
  title: 'Summary',
  format: 'text',
  content: 'All tests passed successfully.',
};

const mockLog: LogEvidence = {
  type: 'log',
  source: 'build.log',
  entries: [
    { timestamp: '2026-01-23T10:00:00Z', level: 'info', message: 'Build started' },
    { timestamp: '2026-01-23T10:00:05Z', level: 'warn', message: 'Deprecated API' },
    { timestamp: '2026-01-23T10:00:10Z', level: 'error', message: 'Build failed' },
  ],
};

const mockSecurityScan: SecurityScanEvidence = {
  type: 'security_scan',
  scanner: 'Bandit',
  findings: [
    {
      severity: 'high',
      title: 'SQL Injection',
      description: 'Possible SQL injection vulnerability',
      location: 'src/db.py:42',
    },
    {
      severity: 'low',
      title: 'Hardcoded Password',
      description: 'Hardcoded password detected',
    },
  ],
};

describe('EvidenceBundleViewer', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} />);
      expect(screen.getByTestId('evidence-viewer')).toBeInTheDocument();
    });

    it('shows empty state when no evidence', () => {
      render(<EvidenceBundleViewer evidence={[]} />);
      expect(screen.getByTestId('evidence-empty')).toBeInTheDocument();
      expect(screen.getByText('No evidence available')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} className="my-custom-class" />);
      expect(screen.getByTestId('evidence-viewer')).toHaveClass('my-custom-class');
    });
  });

  describe('Tabs', () => {
    const mixedEvidence: Evidence[] = [mockTestResults, mockDiff, mockReport];

    it('shows tabs when multiple evidence types', () => {
      render(<EvidenceBundleViewer evidence={mixedEvidence} />);
      expect(screen.getByTestId('evidence-tabs')).toBeInTheDocument();
    });

    it('does not show tabs for single evidence type', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} />);
      expect(screen.queryByTestId('evidence-tabs')).not.toBeInTheDocument();
    });

    it('displays correct tab labels', () => {
      render(<EvidenceBundleViewer evidence={mixedEvidence} />);
      expect(screen.getByTestId('tab-test_results')).toHaveTextContent('Test Results');
      expect(screen.getByTestId('tab-diff')).toHaveTextContent('Diff');
      expect(screen.getByTestId('tab-report')).toHaveTextContent('Report');
    });

    it('switches tabs when clicked', () => {
      render(<EvidenceBundleViewer evidence={mixedEvidence} />);

      // Initially shows test results
      expect(screen.getByTestId('test-summary')).toBeInTheDocument();

      // Click diff tab
      fireEvent.click(screen.getByTestId('tab-diff'));
      expect(screen.getByTestId('diff-view-0')).toBeInTheDocument();
      expect(screen.queryByTestId('test-summary')).not.toBeInTheDocument();
    });

    it('respects defaultTab prop', () => {
      render(<EvidenceBundleViewer evidence={mixedEvidence} defaultTab="diff" />);
      expect(screen.getByTestId('diff-view-0')).toBeInTheDocument();
    });

    it('active tab has correct styling', () => {
      render(<EvidenceBundleViewer evidence={mixedEvidence} />);
      const activeTab = screen.getByTestId('tab-test_results');
      expect(activeTab).toHaveClass('border-accent-teal');
    });
  });

  describe('Test Results', () => {
    it('displays test summary', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} />);
      const summary = screen.getByTestId('test-summary');
      expect(summary).toHaveTextContent('10');
      expect(summary).toHaveTextContent('8');
      expect(summary).toHaveTextContent('1');
    });

    it('displays test results list', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} />);
      expect(screen.getByTestId('test-results-list')).toBeInTheDocument();
      expect(screen.getByTestId('test-result-0')).toBeInTheDocument();
    });

    it('shows test names', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} />);
      expect(screen.getByText('test_addition')).toBeInTheDocument();
      expect(screen.getByText('test_subtraction')).toBeInTheDocument();
    });

    it('shows duration for tests', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} />);
      expect(screen.getByText('50ms')).toBeInTheDocument();
    });

    it('expands failed test to show details', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} />);

      // Find the failed test and click it
      const failedTest = screen.getByText('test_division_by_zero').closest('button');
      fireEvent.click(failedTest!);

      // Should show details
      expect(screen.getByTestId('test-details-2')).toBeInTheDocument();
      expect(screen.getByText('Expected error')).toBeInTheDocument();
      expect(screen.getByText(/AssertionError/)).toBeInTheDocument();
    });

    it('collapses test details when clicked again', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} />);

      const failedTest = screen.getByText('test_division_by_zero').closest('button');
      fireEvent.click(failedTest!);
      expect(screen.getByTestId('test-details-2')).toBeInTheDocument();

      fireEvent.click(failedTest!);
      expect(screen.queryByTestId('test-details-2')).not.toBeInTheDocument();
    });

    it('shows skipped count when present', () => {
      render(<EvidenceBundleViewer evidence={[mockTestResults]} />);
      expect(screen.getByText('1 skipped')).toBeInTheDocument();
    });
  });

  describe('Diff', () => {
    it('displays diff view', () => {
      render(<EvidenceBundleViewer evidence={[mockDiff]} />);
      expect(screen.getByTestId('diff-view-0')).toBeInTheDocument();
    });

    it('shows filename', () => {
      render(<EvidenceBundleViewer evidence={[mockDiff]} />);
      expect(screen.getByText('src/utils.py')).toBeInTheDocument();
    });

    it('renders CodeDiff component', () => {
      render(<EvidenceBundleViewer evidence={[mockDiff]} />);
      // CodeDiff shows Unified button
      expect(screen.getByText('Unified')).toBeInTheDocument();
    });
  });

  describe('Report', () => {
    it('displays report view', () => {
      render(<EvidenceBundleViewer evidence={[mockReport]} />);
      expect(screen.getByTestId('report-view-0')).toBeInTheDocument();
    });

    it('shows report title', () => {
      render(<EvidenceBundleViewer evidence={[mockReport]} />);
      expect(screen.getByText('Coverage Report')).toBeInTheDocument();
    });

    it('formats JSON content', () => {
      render(<EvidenceBundleViewer evidence={[mockReport]} />);
      expect(screen.getByText(/"coverage": 85.5/)).toBeInTheDocument();
    });

    it('displays text report as-is', () => {
      render(<EvidenceBundleViewer evidence={[mockTextReport]} />);
      expect(screen.getByText('All tests passed successfully.')).toBeInTheDocument();
    });
  });

  describe('Log', () => {
    it('displays log view', () => {
      render(<EvidenceBundleViewer evidence={[mockLog]} />);
      expect(screen.getByTestId('log-view-0')).toBeInTheDocument();
    });

    it('shows log source', () => {
      render(<EvidenceBundleViewer evidence={[mockLog]} />);
      expect(screen.getByText('build.log')).toBeInTheDocument();
    });

    it('shows entry count', () => {
      render(<EvidenceBundleViewer evidence={[mockLog]} />);
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });

    it('expands to show log entries', () => {
      render(<EvidenceBundleViewer evidence={[mockLog]} />);

      const logButton = screen.getByText('build.log').closest('button');
      fireEvent.click(logButton!);

      expect(screen.getByTestId('log-entries-0')).toBeInTheDocument();
      expect(screen.getByText('Build started')).toBeInTheDocument();
      expect(screen.getByText('Deprecated API')).toBeInTheDocument();
      expect(screen.getByText('Build failed')).toBeInTheDocument();
    });

    it('shows log levels', () => {
      render(<EvidenceBundleViewer evidence={[mockLog]} />);

      const logButton = screen.getByText('build.log').closest('button');
      fireEvent.click(logButton!);

      expect(screen.getByText('info')).toBeInTheDocument();
      expect(screen.getByText('warn')).toBeInTheDocument();
      expect(screen.getByText('error')).toBeInTheDocument();
    });
  });

  describe('Security Scan', () => {
    it('displays security view', () => {
      render(<EvidenceBundleViewer evidence={[mockSecurityScan]} />);
      expect(screen.getByTestId('security-view-0')).toBeInTheDocument();
    });

    it('shows scanner name', () => {
      render(<EvidenceBundleViewer evidence={[mockSecurityScan]} />);
      expect(screen.getByText('Scanner: Bandit')).toBeInTheDocument();
    });

    it('shows finding count', () => {
      render(<EvidenceBundleViewer evidence={[mockSecurityScan]} />);
      // Text is split across elements, use regex
      expect(screen.getByText(/2.*findings/)).toBeInTheDocument();
    });

    it('displays findings', () => {
      render(<EvidenceBundleViewer evidence={[mockSecurityScan]} />);
      expect(screen.getByTestId('security-findings')).toBeInTheDocument();
      expect(screen.getByText('SQL Injection')).toBeInTheDocument();
      expect(screen.getByText('Hardcoded Password')).toBeInTheDocument();
    });

    it('shows severity badges', () => {
      render(<EvidenceBundleViewer evidence={[mockSecurityScan]} />);
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('low')).toBeInTheDocument();
    });

    it('expands finding to show details', () => {
      render(<EvidenceBundleViewer evidence={[mockSecurityScan]} />);

      const finding = screen.getByText('SQL Injection').closest('button');
      fireEvent.click(finding!);

      expect(screen.getByTestId('security-details-0')).toBeInTheDocument();
      expect(screen.getByText('Possible SQL injection vulnerability')).toBeInTheDocument();
      expect(screen.getByText('Location: src/db.py:42')).toBeInTheDocument();
    });
  });

  describe('Multiple Evidence of Same Type', () => {
    it('renders multiple diffs', () => {
      const multipleDiffs: DiffEvidence[] = [
        { ...mockDiff, filename: 'file1.py' },
        { ...mockDiff, filename: 'file2.py' },
      ];

      render(<EvidenceBundleViewer evidence={multipleDiffs} />);
      expect(screen.getByTestId('diff-view-0')).toBeInTheDocument();
      expect(screen.getByTestId('diff-view-1')).toBeInTheDocument();
      expect(screen.getByText('file1.py')).toBeInTheDocument();
      expect(screen.getByText('file2.py')).toBeInTheDocument();
    });
  });
});
