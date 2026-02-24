import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TagInput } from './TagInput';

describe('TagInput', () => {
  it('renders existing tags', () => {
    render(<TagInput tags={['react', 'typescript']} onChange={vi.fn()} />);
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('adds a tag on Enter', () => {
    const onChange = vi.fn();
    render(<TagInput tags={[]} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'newtag' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['newtag']);
  });

  it('adds a tag on comma', () => {
    const onChange = vi.fn();
    render(<TagInput tags={[]} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hello,' } });
    expect(onChange).toHaveBeenCalledWith(['hello']);
  });

  it('removes a tag when x is clicked', () => {
    const onChange = vi.fn();
    render(<TagInput tags={['a', 'b']} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Remove a'));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('ignores duplicate tags', () => {
    const onChange = vi.fn();
    render(<TagInput tags={['existing']} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'existing' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respects maxTags limit', () => {
    const onChange = vi.fn();
    render(<TagInput tags={['a', 'b']} onChange={onChange} maxTags={2} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('ignores whitespace-only input', () => {
    const onChange = vi.fn();
    render(<TagInput tags={[]} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
