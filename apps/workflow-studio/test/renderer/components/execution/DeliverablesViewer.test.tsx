import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeliverablesViewer from '../../../../src/renderer/components/execution/DeliverablesViewer';
import type {
  PlanBlockDeliverables,
  CodeBlockDeliverables,
  GenericBlockDeliverables,
  TestBlockDeliverables,
  ReviewBlockDeliverables,
  DevopsBlockDeliverables,
  ScrutinyLevel,
} from '../../../../src/shared/types/execution';

describe('DeliverablesViewer', () => {
  it('renders the container', () => {
    render(
      <DeliverablesViewer
        deliverables={null}
        scrutinyLevel="summary"
        blockType="generic"
      />,
    );
    expect(screen.getByTestId('deliverables-viewer')).toBeInTheDocument();
  });

  it('shows fallback when deliverables is null', () => {
    render(
      <DeliverablesViewer
        deliverables={null}
        scrutinyLevel="summary"
        blockType="generic"
      />,
    );
    expect(screen.getByText('No deliverables available')).toBeInTheDocument();
  });

  // ---- Summary scrutiny level ----

  it('shows summary text for generic block at summary level', () => {
    const deliverables: GenericBlockDeliverables = {
      blockType: 'generic',
      summary: 'All tasks completed successfully.',
    };
    render(
      <DeliverablesViewer
        deliverables={deliverables}
        scrutinyLevel="summary"
        blockType="generic"
      />,
    );
    expect(screen.getByTestId('deliverables-summary')).toHaveTextContent(
      'All tasks completed successfully.',
    );
  });

  it('shows "No summary available" when summary is missing', () => {
    const deliverables: GenericBlockDeliverables = {
      blockType: 'generic',
    };
    render(
      <DeliverablesViewer
        deliverables={deliverables}
        scrutinyLevel="summary"
        blockType="generic"
      />,
    );
    expect(screen.getByTestId('deliverables-summary')).toHaveTextContent(
      'No summary available',
    );
  });

  // ---- File list scrutiny level ----

  it('shows file list for code block at file_list level', () => {
    const deliverables: CodeBlockDeliverables = {
      blockType: 'code',
      filesChanged: ['src/main.ts', 'src/util.ts'],
    };
    render(
      <DeliverablesViewer
        deliverables={deliverables}
        scrutinyLevel="file_list"
        blockType="code"
      />,
    );
    expect(screen.getByTestId('deliverables-file-list')).toBeInTheDocument();
    expect(screen.getByText('src/main.ts')).toBeInTheDocument();
    expect(screen.getByText('src/util.ts')).toBeInTheDocument();
  });

  // ---- Plan block at full_detail ----

  it('shows plan deliverables at full_detail level with markdown', () => {
    const deliverables: PlanBlockDeliverables = {
      blockType: 'plan',
      markdownDocument: '# Design Document\n\nThis is the design.',
      taskList: ['Task 1', 'Task 2'],
    };
    render(
      <DeliverablesViewer
        deliverables={deliverables}
        scrutinyLevel="full_detail"
        blockType="plan"
      />,
    );
    // Should display the markdown content (as plain text since we have no react-markdown)
    expect(screen.getByText(/Design Document/)).toBeInTheDocument();
  });

  // ---- Full content level ----

  it('shows diff summary for code block at full_content level', () => {
    const deliverables: CodeBlockDeliverables = {
      blockType: 'code',
      filesChanged: ['src/app.ts'],
      diffSummary: '+10 -5 lines changed',
    };
    render(
      <DeliverablesViewer
        deliverables={deliverables}
        scrutinyLevel="full_content"
        blockType="code"
      />,
    );
    expect(screen.getByText('+10 -5 lines changed')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F11-T03: Test block rendering
// ---------------------------------------------------------------------------

describe('DeliverablesViewer — Test block (F11-T03)', () => {
  it('renders pass/fail/skip counters', () => {
    const deliverables: TestBlockDeliverables = {
      blockType: 'test',
      testResults: { passed: 42, failed: 3, skipped: 1 },
    };
    render(
      <DeliverablesViewer deliverables={deliverables} scrutinyLevel="summary" blockType="test" />,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders summary text', () => {
    const deliverables: TestBlockDeliverables = {
      blockType: 'test',
      testResults: { passed: 10, failed: 0, skipped: 0 },
      summary: 'Unit test run complete',
    };
    render(
      <DeliverablesViewer deliverables={deliverables} scrutinyLevel="summary" blockType="test" />,
    );
    expect(screen.getByText('Unit test run complete')).toBeInTheDocument();
  });

  it('handles missing testResults gracefully', () => {
    render(
      <DeliverablesViewer
        deliverables={{ blockType: 'test' } as TestBlockDeliverables}
        scrutinyLevel="summary"
        blockType="test"
      />,
    );
    // Should render zeros for missing results
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// F11-T04: Review block rendering
// ---------------------------------------------------------------------------

describe('DeliverablesViewer — Review block (F11-T04)', () => {
  it('renders approved badge', () => {
    const deliverables: ReviewBlockDeliverables = {
      blockType: 'review',
      approved: true,
      findings: ['Minor naming issue'],
    };
    render(
      <DeliverablesViewer deliverables={deliverables} scrutinyLevel="summary" blockType="review" />,
    );
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders rejected badge when not approved', () => {
    const deliverables: ReviewBlockDeliverables = {
      blockType: 'review',
      approved: false,
    };
    render(
      <DeliverablesViewer deliverables={deliverables} scrutinyLevel="summary" blockType="review" />,
    );
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders findings list at full_content', () => {
    const deliverables: ReviewBlockDeliverables = {
      blockType: 'review',
      approved: true,
      findings: ['Minor naming inconsistency', 'Missing error handling'],
    };
    render(
      <DeliverablesViewer deliverables={deliverables} scrutinyLevel="full_content" blockType="review" />,
    );
    expect(screen.getByText('Minor naming inconsistency')).toBeInTheDocument();
    expect(screen.getByText('Missing error handling')).toBeInTheDocument();
  });

  it('handles empty findings array', () => {
    const deliverables: ReviewBlockDeliverables = {
      blockType: 'review',
      approved: true,
      findings: [],
    };
    render(
      <DeliverablesViewer deliverables={deliverables} scrutinyLevel="full_content" blockType="review" />,
    );
    expect(screen.getByText('No findings')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F11-T04: DevOps block rendering
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// F12-T03: DiffViewer integration in code block
// ---------------------------------------------------------------------------

// Mock DiffViewer so we can detect it's rendered without full react-diff-viewer
vi.mock(
  '../../../../src/renderer/components/execution/DiffViewer',
  () => ({
    default: ({ diffs }: { diffs: unknown[] }) => (
      <div data-testid="diff-viewer-integration">
        {diffs.length} file diff(s)
      </div>
    ),
  }),
);

describe('DeliverablesViewer — DiffViewer integration (F12-T03)', () => {
  it('renders DiffViewer when code block has fileDiffs at full_content', () => {
    const deliverables: CodeBlockDeliverables = {
      blockType: 'code',
      filesChanged: ['src/app.ts'],
      fileDiffs: [
        { path: 'src/app.ts', oldContent: 'old', newContent: 'new' },
      ],
    };
    render(
      <DeliverablesViewer
        deliverables={deliverables}
        scrutinyLevel="full_content"
        blockType="code"
      />,
    );
    expect(screen.getByTestId('diff-viewer-integration')).toBeInTheDocument();
    expect(screen.getByText('1 file diff(s)')).toBeInTheDocument();
  });

  it('renders DiffViewer when code block has fileDiffs at full_detail', () => {
    const deliverables: CodeBlockDeliverables = {
      blockType: 'code',
      filesChanged: ['src/a.ts', 'src/b.ts'],
      fileDiffs: [
        { path: 'src/a.ts', oldContent: 'a1', newContent: 'a2' },
        { path: 'src/b.ts', oldContent: 'b1', newContent: 'b2' },
      ],
    };
    render(
      <DeliverablesViewer
        deliverables={deliverables}
        scrutinyLevel="full_detail"
        blockType="code"
      />,
    );
    expect(screen.getByTestId('diff-viewer-integration')).toBeInTheDocument();
    expect(screen.getByText('2 file diff(s)')).toBeInTheDocument();
  });

  it('falls back to diffSummary text when fileDiffs is absent', () => {
    const deliverables: CodeBlockDeliverables = {
      blockType: 'code',
      filesChanged: ['src/app.ts'],
      diffSummary: '+10 -5 lines changed',
    };
    render(
      <DeliverablesViewer
        deliverables={deliverables}
        scrutinyLevel="full_content"
        blockType="code"
      />,
    );
    expect(screen.queryByTestId('diff-viewer-integration')).not.toBeInTheDocument();
    expect(screen.getByText('+10 -5 lines changed')).toBeInTheDocument();
  });
});

describe('DeliverablesViewer — DevOps block (F11-T04)', () => {
  it('renders status text', () => {
    const deliverables: DevopsBlockDeliverables = {
      blockType: 'devops',
      status: 'deployed',
      operations: ['docker build'],
    };
    render(
      <DeliverablesViewer deliverables={deliverables} scrutinyLevel="summary" blockType="devops" />,
    );
    expect(screen.getByText('deployed')).toBeInTheDocument();
  });

  it('renders operations list at full_content', () => {
    const deliverables: DevopsBlockDeliverables = {
      blockType: 'devops',
      operations: ['docker build -t app:latest', 'kubectl apply -f deployment.yaml'],
    };
    render(
      <DeliverablesViewer deliverables={deliverables} scrutinyLevel="full_content" blockType="devops" />,
    );
    expect(screen.getByText('docker build -t app:latest')).toBeInTheDocument();
    expect(screen.getByText('kubectl apply -f deployment.yaml')).toBeInTheDocument();
  });

  it('handles empty operations array', () => {
    const deliverables: DevopsBlockDeliverables = {
      blockType: 'devops',
      operations: [],
    };
    render(
      <DeliverablesViewer deliverables={deliverables} scrutinyLevel="full_content" blockType="devops" />,
    );
    expect(screen.getByText('No operations')).toBeInTheDocument();
  });
});
