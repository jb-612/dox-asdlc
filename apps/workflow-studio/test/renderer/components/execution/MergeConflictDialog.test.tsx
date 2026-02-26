import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MergeConflictDialog from '../../../../src/renderer/components/execution/MergeConflictDialog';
import type { MergeConflict } from '../../../../src/shared/types/execution';

const SAMPLE_CONFLICTS: MergeConflict[] = [
  { filePath: 'src/utils.ts', blockAId: 'block-1', blockBId: 'block-2' },
  { filePath: 'src/index.ts', blockAId: 'block-1', blockBId: 'block-3' },
];

describe('MergeConflictDialog', () => {
  it('renders dialog with conflict count', () => {
    const onResolve = vi.fn();
    render(<MergeConflictDialog conflicts={SAMPLE_CONFLICTS} onResolve={onResolve} />);
    expect(screen.getByTestId('merge-conflict-dialog')).toBeInTheDocument();
    expect(screen.getByText(/2 file/i)).toBeInTheDocument();
  });

  it('renders each conflicting file path', () => {
    render(<MergeConflictDialog conflicts={SAMPLE_CONFLICTS} onResolve={vi.fn()} />);
    expect(screen.getByText('src/utils.ts')).toBeInTheDocument();
    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
  });

  it('has radio options for each conflict with block IDs', () => {
    render(<MergeConflictDialog conflicts={SAMPLE_CONFLICTS} onResolve={vi.fn()} />);
    const radioGroups = screen.getAllByRole('radiogroup');
    expect(radioGroups).toHaveLength(2);
  });

  it('Resolve All button is disabled until all conflicts have selections', () => {
    render(<MergeConflictDialog conflicts={SAMPLE_CONFLICTS} onResolve={vi.fn()} />);
    const resolveBtn = screen.getByRole('button', { name: /resolve all/i });
    expect(resolveBtn).toBeDisabled();
  });

  it('Resolve All calls onResolve with selected resolutions', () => {
    const onResolve = vi.fn();
    render(<MergeConflictDialog conflicts={SAMPLE_CONFLICTS} onResolve={onResolve} />);

    // Select block-1 for first file, block-3 for second file
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]); // Keep block-1 for src/utils.ts
    fireEvent.click(radios[3]); // Keep block-3 for src/index.ts

    const resolveBtn = screen.getByRole('button', { name: /resolve all/i });
    expect(resolveBtn).not.toBeDisabled();
    fireEvent.click(resolveBtn);

    expect(onResolve).toHaveBeenCalledWith([
      { filePath: 'src/utils.ts', keepBlockId: 'block-1' },
      { filePath: 'src/index.ts', keepBlockId: 'block-3' },
    ]);
  });

  it('Abort button calls onResolve with all abort', () => {
    const onResolve = vi.fn();
    render(<MergeConflictDialog conflicts={SAMPLE_CONFLICTS} onResolve={onResolve} />);

    const abortBtn = screen.getByRole('button', { name: /abort/i });
    fireEvent.click(abortBtn);

    expect(onResolve).toHaveBeenCalledWith([
      { filePath: 'src/utils.ts', keepBlockId: 'abort' },
      { filePath: 'src/index.ts', keepBlockId: 'abort' },
    ]);
  });
});
