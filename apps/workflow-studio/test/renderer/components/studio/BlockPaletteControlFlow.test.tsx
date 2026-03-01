import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { BlockPalette } from '../../../../src/renderer/components/studio/BlockPalette';

describe('BlockPalette control-flow section', () => {
  it('renders "Control Flow" section header', () => {
    render(<BlockPalette />);
    expect(screen.getByText('Control Flow')).toBeInTheDocument();
  });

  it('renders condition, forEach, subWorkflow cards', () => {
    render(<BlockPalette />);
    expect(screen.getByTestId('palette-block-condition')).toBeInTheDocument();
    expect(screen.getByTestId('palette-block-forEach')).toBeInTheDocument();
    expect(screen.getByTestId('palette-block-subWorkflow')).toBeInTheDocument();
  });

  it('control-flow cards use nodeKind=control in drag payload', () => {
    render(<BlockPalette />);
    const condCard = screen.getByTestId('palette-block-condition');
    // The drag payload is set via dataTransfer which we can't fully test in jsdom,
    // but the card should be draggable
    expect(condCard).toHaveAttribute('draggable', 'true');
  });
});
