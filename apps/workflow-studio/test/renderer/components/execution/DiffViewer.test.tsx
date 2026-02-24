import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DiffViewer from '../../../../src/renderer/components/execution/DiffViewer';

describe('DiffViewer', () => {
  it('shows placeholder text when diffs array is empty', () => {
    render(<DiffViewer diffs={[]} mode="unified" />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('diff-placeholder')).toHaveTextContent(
      'No changes to display. Code diff viewer coming soon.',
    );
  });

  it('accepts onOpenInVSCode prop without error', () => {
    const onOpenInVSCode = vi.fn();
    const { container } = render(
      <DiffViewer
        diffs={[]}
        mode="side_by_side"
        onOpenInVSCode={onOpenInVSCode}
      />,
    );
    expect(container).toBeTruthy();
  });

  it('shows file paths when diffs are provided', () => {
    render(
      <DiffViewer
        diffs={[
          { path: 'src/main.ts', oldContent: 'old', newContent: 'new' },
          { path: 'src/util.ts' },
        ]}
        mode="unified"
      />,
    );
    expect(screen.getByText('src/main.ts')).toBeInTheDocument();
    expect(screen.getByText('src/util.ts')).toBeInTheDocument();
  });
});
