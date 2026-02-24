import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeliverablesViewer from '../../../../src/renderer/components/execution/DeliverablesViewer';
import type {
  PlanBlockDeliverables,
  CodeBlockDeliverables,
  GenericBlockDeliverables,
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
