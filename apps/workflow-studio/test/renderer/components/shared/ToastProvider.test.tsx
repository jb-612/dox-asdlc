import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastProvider } from '../../../../src/renderer/components/shared/ToastProvider';
import { useToastStore } from '../../../../src/renderer/stores/toastStore';

beforeEach(() => {
  cleanup();
  vi.useFakeTimers();
  useToastStore.getState().clearAll();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider (F10-T03)', () => {
  it('renders toasts from store', () => {
    useToastStore.getState().addToast('success', 'Saved successfully');
    render(<ToastProvider />);
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('auto-dismiss after duration', () => {
    useToastStore.getState().addToast('info', 'Temporary', 3000);
    render(<ToastProvider />);

    expect(screen.getByText('Temporary')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(screen.queryByText('Temporary')).not.toBeInTheDocument();
  });

  it('does not auto-dismiss with duration 0', () => {
    useToastStore.getState().addToast('error', 'Sticky', 0);
    render(<ToastProvider />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('Sticky')).toBeInTheDocument();
  });

  it('variant styling: success=green, error=red, warning=yellow, info=blue', () => {
    useToastStore.getState().addToast('success', 'Green toast');
    useToastStore.getState().addToast('error', 'Red toast');
    useToastStore.getState().addToast('warning', 'Yellow toast');
    useToastStore.getState().addToast('info', 'Blue toast');

    const { container } = render(<ToastProvider />);

    const toastEls = container.querySelectorAll('[data-variant]');
    expect(toastEls).toHaveLength(4);

    const variants = Array.from(toastEls).map((el) => el.getAttribute('data-variant'));
    expect(variants).toEqual(['success', 'error', 'warning', 'info']);
  });

  it('clicking dismiss removes toast', () => {
    useToastStore.getState().addToast('info', 'Dismissable');
    render(<ToastProvider />);

    expect(screen.getByText('Dismissable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByText('Dismissable')).not.toBeInTheDocument();
  });
});
