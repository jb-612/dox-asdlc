import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScrutinyLevelSelector from '../../../../src/renderer/components/execution/ScrutinyLevelSelector';
import type { ScrutinyLevel } from '../../../../src/shared/types/execution';

describe('ScrutinyLevelSelector', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders four segment options', () => {
    render(<ScrutinyLevelSelector value="summary" onChange={onChange} />);
    expect(screen.getByTestId('scrutiny-selector')).toBeInTheDocument();
    expect(screen.getByTestId('scrutiny-option-summary')).toBeInTheDocument();
    expect(screen.getByTestId('scrutiny-option-file_list')).toBeInTheDocument();
    expect(screen.getByTestId('scrutiny-option-full_content')).toBeInTheDocument();
    expect(screen.getByTestId('scrutiny-option-full_detail')).toBeInTheDocument();
  });

  it('highlights the active option', () => {
    render(<ScrutinyLevelSelector value="file_list" onChange={onChange} />);
    const active = screen.getByTestId('scrutiny-option-file_list');
    expect(active.className).toContain('bg-blue-500');
  });

  it('calls onChange with "summary" when Summary clicked', () => {
    render(<ScrutinyLevelSelector value="file_list" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('scrutiny-option-summary'));
    expect(onChange).toHaveBeenCalledWith('summary');
  });

  it('calls onChange with "file_list" when File List clicked', () => {
    render(<ScrutinyLevelSelector value="summary" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('scrutiny-option-file_list'));
    expect(onChange).toHaveBeenCalledWith('file_list');
  });

  it('calls onChange with "full_content" when Full Content clicked', () => {
    render(<ScrutinyLevelSelector value="summary" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('scrutiny-option-full_content'));
    expect(onChange).toHaveBeenCalledWith('full_content');
  });

  it('calls onChange with "full_detail" when Full Detail clicked', () => {
    render(<ScrutinyLevelSelector value="summary" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('scrutiny-option-full_detail'));
    expect(onChange).toHaveBeenCalledWith('full_detail');
  });
});
