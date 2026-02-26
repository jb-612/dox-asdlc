import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '../../../src/renderer/stores/toastStore';

describe('toastStore (F10-T03)', () => {
  beforeEach(() => {
    useToastStore.getState().clearAll();
  });

  it('addToast adds toast with generated id', () => {
    const id = useToastStore.getState().addToast('success', 'Saved!');
    expect(typeof id).toBe('string');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      id,
      variant: 'success',
      message: 'Saved!',
    });
  });

  it('removeToast removes by id', () => {
    const id = useToastStore.getState().addToast('info', 'Hello');
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('clearAll empties array', () => {
    useToastStore.getState().addToast('success', 'A');
    useToastStore.getState().addToast('error', 'B');
    useToastStore.getState().addToast('warning', 'C');
    expect(useToastStore.getState().toasts).toHaveLength(3);

    useToastStore.getState().clearAll();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('max 5 toasts — oldest removed when exceeding', () => {
    for (let i = 0; i < 6; i++) {
      useToastStore.getState().addToast('info', `Toast ${i}`);
    }
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(5);
    expect(toasts[0].message).toBe('Toast 1'); // Toast 0 was evicted
    expect(toasts[4].message).toBe('Toast 5');
  });

  it('addToast sets default duration of 5000', () => {
    useToastStore.getState().addToast('success', 'Test');
    expect(useToastStore.getState().toasts[0].duration).toBe(5000);
  });

  it('addToast accepts custom duration', () => {
    useToastStore.getState().addToast('error', 'Sticky', 0);
    expect(useToastStore.getState().toasts[0].duration).toBe(0);
  });
});
