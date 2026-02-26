import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DiffViewer from '../../../../src/renderer/components/execution/DiffViewer';

// Mock react-diff-viewer-continued — jsdom cannot render the real canvas-based component
vi.mock('react-diff-viewer-continued', () => ({
  default: ({
    oldValue,
    newValue,
    splitView,
  }: {
    oldValue: string;
    newValue: string;
    splitView: boolean;
  }) => (
    <div data-testid="mock-react-diff-viewer">
      <span data-testid="rdv-old">{oldValue}</span>
      <span data-testid="rdv-new">{newValue}</span>
      <span data-testid="rdv-split">{splitView ? 'split' : 'unified'}</span>
    </div>
  ),
}));

describe('DiffViewer', () => {
  const sampleDiffs = [
    { path: 'src/main.ts', oldContent: 'const a = 1;', newContent: 'const a = 2;' },
    { path: 'src/util.ts', oldContent: 'export {}', newContent: 'export { foo }' },
  ];

  it('renders "No changes" when diffs array is empty', () => {
    render(<DiffViewer diffs={[]} />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
  });

  it('renders diff for single file with side-by-side mode (default)', () => {
    render(
      <DiffViewer
        diffs={[{ path: 'src/app.ts', oldContent: 'old code', newContent: 'new code' }]}
      />,
    );
    expect(screen.getByTestId('mock-react-diff-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('rdv-old')).toHaveTextContent('old code');
    expect(screen.getByTestId('rdv-new')).toHaveTextContent('new code');
    expect(screen.getByTestId('rdv-split')).toHaveTextContent('split');
  });

  it('renders diff for single file with unified mode', () => {
    render(
      <DiffViewer
        diffs={[{ path: 'src/app.ts', oldContent: 'old', newContent: 'new' }]}
        mode="unified"
      />,
    );
    expect(screen.getByTestId('rdv-split')).toHaveTextContent('unified');
  });

  it('mode toggle switches between views', () => {
    render(<DiffViewer diffs={sampleDiffs} />);
    // Default is side-by-side
    const splits = screen.getAllByTestId('rdv-split');
    expect(splits[0]).toHaveTextContent('split');

    // Click toggle to switch to unified
    const toggleBtn = screen.getByRole('button', { name: /unified/i });
    fireEvent.click(toggleBtn);

    const updatedSplits = screen.getAllByTestId('rdv-split');
    expect(updatedSplits[0]).toHaveTextContent('unified');
  });

  it('multiple files render as collapsible sections', () => {
    render(<DiffViewer diffs={sampleDiffs} />);
    const details = screen.getAllByRole('group');
    expect(details.length).toBe(sampleDiffs.length);
    expect(screen.getByText('src/main.ts')).toBeInTheDocument();
    expect(screen.getByText('src/util.ts')).toBeInTheDocument();
  });

  it('"Open in VSCode" button calls onOpenInVSCode callback', () => {
    const onOpen = vi.fn();
    render(
      <DiffViewer
        diffs={[{ path: 'src/app.ts', oldContent: 'a', newContent: 'b' }]}
        onOpenInVSCode={onOpen}
      />,
    );
    const btn = screen.getByRole('button', { name: /open in vscode/i });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledWith('src/app.ts');
  });
});
