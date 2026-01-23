/**
 * Tests for RunOutputsTab component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RunOutputsTab, { type RunOutputs } from './RunOutputsTab';

describe('RunOutputsTab', () => {
  const defaultOutputs: RunOutputs = {
    artifacts: [
      { id: 'art-1', name: 'PRD.md', type: 'document', size: 4096, status: 'created' },
      { id: 'art-2', name: 'architecture.md', type: 'document', size: 2048, status: 'updated' },
    ],
    patches: [
      {
        id: 'patch-1',
        file: 'src/main.ts',
        additions: 25,
        deletions: 10,
        diff: '+ const foo = "bar";\n- const old = "value";',
      },
      {
        id: 'patch-2',
        file: 'src/utils.ts',
        additions: 5,
        deletions: 0,
        diff: '+ export function helper() {}',
      },
    ],
    testResults: {
      total: 50,
      passed: 48,
      failed: 2,
      skipped: 0,
      duration: 12500,
      failures: [
        { name: 'test_login', error: 'Expected true but got false', file: 'tests/auth.test.ts' },
        { name: 'test_validation', error: 'Timeout exceeded', file: 'tests/form.test.ts' },
      ],
    },
    metrics: {
      tokens: 15000,
      cost: 0.45,
      duration: 120,
    },
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('run-outputs-tab')).toBeInTheDocument();
    });

    it('renders section title', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByText(/outputs/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<RunOutputsTab outputs={defaultOutputs} className="my-custom-class" />);
      expect(screen.getByTestId('run-outputs-tab')).toHaveClass('my-custom-class');
    });
  });

  describe('Output Artifacts Section', () => {
    it('shows artifacts section', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('output-artifacts-section')).toBeInTheDocument();
    });

    it('lists all artifacts', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByText('PRD.md')).toBeInTheDocument();
      expect(screen.getByText('architecture.md')).toBeInTheDocument();
    });

    it('shows artifact status', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByText('created')).toBeInTheDocument();
      expect(screen.getByText('updated')).toBeInTheDocument();
    });

    it('shows artifact size', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      const artifact = screen.getByTestId('output-art-1');
      expect(artifact).toHaveTextContent('4 KB');
    });

    it('calls onArtifactClick when artifact is clicked', () => {
      const onClick = vi.fn();
      render(<RunOutputsTab outputs={defaultOutputs} onArtifactClick={onClick} />);

      fireEvent.click(screen.getByTestId('output-art-1'));

      expect(onClick).toHaveBeenCalledWith('art-1');
    });
  });

  describe('Patches Section', () => {
    it('shows patches section', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('patches-section')).toBeInTheDocument();
    });

    it('lists all patches', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByText('src/main.ts')).toBeInTheDocument();
      expect(screen.getByText('src/utils.ts')).toBeInTheDocument();
    });

    it('shows additions and deletions', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      const patch = screen.getByTestId('patch-patch-1');
      expect(patch).toHaveTextContent('+25');
      expect(patch).toHaveTextContent('-10');
    });

    it('shows diff when expanded', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);

      fireEvent.click(screen.getByTestId('expand-patch-1'));

      expect(screen.getByTestId('diff-patch-1')).toBeInTheDocument();
    });

    it('displays diff content', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      fireEvent.click(screen.getByTestId('expand-patch-1'));

      expect(screen.getByText(/const foo/)).toBeInTheDocument();
    });
  });

  describe('Test Results Section', () => {
    it('shows test results section', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('test-results-section')).toBeInTheDocument();
    });

    it('shows total tests', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('tests-total')).toHaveTextContent('50');
    });

    it('shows passed count', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('tests-passed')).toHaveTextContent('48');
    });

    it('shows failed count', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('tests-failed')).toHaveTextContent('2');
    });

    it('shows pass rate', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('tests-rate')).toHaveTextContent('96%');
    });

    it('shows test duration', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('tests-duration')).toHaveTextContent('12.5s');
    });

    it('lists test failures', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByText('test_login')).toBeInTheDocument();
      expect(screen.getByText('test_validation')).toBeInTheDocument();
    });

    it('shows failure details', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByText(/Expected true/)).toBeInTheDocument();
    });
  });

  describe('Metrics Section', () => {
    it('shows metrics section', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('metrics-section')).toBeInTheDocument();
    });

    it('displays token count', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('metric-tokens')).toHaveTextContent('15,000');
    });

    it('displays cost', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('metric-cost')).toHaveTextContent('$0.45');
    });

    it('displays duration', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getByTestId('metric-duration')).toHaveTextContent('2m 0s');
    });
  });

  describe('Empty States', () => {
    it('shows empty message when no artifacts', () => {
      const noArtifacts = { ...defaultOutputs, artifacts: [] };
      render(<RunOutputsTab outputs={noArtifacts} />);

      expect(screen.getByText(/no output artifacts/i)).toBeInTheDocument();
    });

    it('shows empty message when no patches', () => {
      const noPatches = { ...defaultOutputs, patches: [] };
      render(<RunOutputsTab outputs={noPatches} />);

      expect(screen.getByText(/no patches/i)).toBeInTheDocument();
    });

    it('shows empty message when no test results', () => {
      const noTests = { ...defaultOutputs, testResults: undefined };
      render(<RunOutputsTab outputs={noTests} />);

      expect(screen.getByText(/no test results/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<RunOutputsTab outputs={defaultOutputs} isLoading />);
      expect(screen.getByTestId('outputs-loading')).toBeInTheDocument();
    });

    it('shows skeleton sections when loading', () => {
      render(<RunOutputsTab outputs={defaultOutputs} isLoading />);
      expect(screen.getAllByTestId('section-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper section headings', () => {
      render(<RunOutputsTab outputs={defaultOutputs} />);
      expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    });

    it('artifacts are keyboard accessible', () => {
      render(<RunOutputsTab outputs={defaultOutputs} onArtifactClick={vi.fn()} />);
      const artifact = screen.getByTestId('output-art-1');
      expect(artifact).toHaveAttribute('tabIndex', '0');
    });
  });
});
