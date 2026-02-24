import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders status text', () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('applies success colors for "completed" status', () => {
    const { container } = render(<StatusBadge status="completed" />);
    const badge = container.firstChild as HTMLElement;
    // jsdom normalizes hex to rgb
    expect(badge.style.color).toBe('rgb(52, 211, 153)');
  });

  it('applies error colors for "failed" status', () => {
    const { container } = render(<StatusBadge status="failed" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.color).toBe('rgb(248, 113, 113)');
  });

  it('uses explicit variant over auto-detected', () => {
    const { container } = render(
      <StatusBadge status="completed" variant="error" />,
    );
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.color).toBe('rgb(248, 113, 113)');
  });

  it('defaults to neutral for unknown status', () => {
    const { container } = render(<StatusBadge status="mystery" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.color).toBe('rgb(156, 163, 175)');
  });

  it('applies md size styles', () => {
    const { container } = render(<StatusBadge status="active" size="md" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.fontSize).toBe('12px');
  });

  it('applies sm size styles by default', () => {
    const { container } = render(<StatusBadge status="active" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.style.fontSize).toBe('11px');
  });
});
