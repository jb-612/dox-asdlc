/**
 * Tests for performance optimization utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Suspense, lazy } from 'react';
import {
  LazyComponent,
  useMemoizedCallback,
  useVirtualScroll,
  useDebouncedValue,
  useThrottledCallback,
  measureRender,
} from './performance';

// Test component for lazy loading
const TestLazyComponent = () => <div data-testid="lazy-loaded">Lazy Loaded</div>;

// Test component for virtual scroll
function VirtualScrollTest({ itemCount }: { itemCount: number }) {
  const { visibleRange, containerProps, scrollToIndex } = useVirtualScroll({
    itemCount,
    itemHeight: 40,
    containerHeight: 200,
    overscan: 2,
  });

  return (
    <div {...containerProps} data-testid="virtual-container">
      <div data-testid="visible-start">{visibleRange.start}</div>
      <div data-testid="visible-end">{visibleRange.end}</div>
      <button data-testid="scroll-to" onClick={() => scrollToIndex(50)}>
        Scroll to 50
      </button>
    </div>
  );
}

// Test component for debounced value
function DebouncedValueTest({ value }: { value: string }) {
  const debouncedValue = useDebouncedValue(value, 300);
  return <div data-testid="debounced">{debouncedValue}</div>;
}

// Test component for throttled callback
function ThrottledCallbackTest({ onCallback }: { onCallback: () => void }) {
  const throttledCallback = useThrottledCallback(onCallback, 100);
  return <button data-testid="throttled-btn" onClick={throttledCallback}>Click</button>;
}

describe('LazyComponent', () => {
  describe('Basic Rendering', () => {
    it('renders fallback while loading', () => {
      const loader = vi.fn(() => new Promise(() => {})); // Never resolves
      const LazyTest = lazy(loader);

      render(
        <Suspense fallback={<div data-testid="fallback">Loading...</div>}>
          <LazyTest />
        </Suspense>
      );

      expect(screen.getByTestId('fallback')).toBeInTheDocument();
    });

    it('renders component after loading', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: TestLazyComponent }));
      const LazyTest = lazy(loader);

      render(
        <Suspense fallback={<div data-testid="fallback">Loading...</div>}>
          <LazyTest />
        </Suspense>
      );

      await waitFor(() => {
        expect(screen.getByTestId('lazy-loaded')).toBeInTheDocument();
      });
    });
  });
});

describe('useMemoizedCallback', () => {
  it('returns stable function reference', () => {
    const fn = vi.fn();
    const callbacks: Array<() => void> = [];

    function TestComponent() {
      const cb = useMemoizedCallback(fn, []);
      callbacks.push(cb);
      return null;
    }

    const { rerender } = render(<TestComponent />);
    rerender(<TestComponent />);

    // Same deps = same reference
    expect(callbacks[0]).toBe(callbacks[1]);
  });

  it('updates function when deps change', () => {
    const callbacks: Array<(val: number) => number> = [];

    function TestComponent({ multiplier }: { multiplier: number }) {
      const cb = useMemoizedCallback((val: number) => val * multiplier, [multiplier]);
      callbacks.push(cb);
      return null;
    }

    const { rerender } = render(<TestComponent multiplier={1} />);
    rerender(<TestComponent multiplier={2} />);

    // Different deps = different function behavior
    expect(callbacks[0](5)).toBe(5);  // 5 * 1
    expect(callbacks[1](5)).toBe(10); // 5 * 2
  });
});

describe('useVirtualScroll', () => {
  it('calculates visible range correctly', () => {
    render(<VirtualScrollTest itemCount={100} />);

    // With container height 200, item height 40, and overscan 2
    // visible items = 200/40 = 5, plus overscan = 7
    expect(screen.getByTestId('visible-start')).toHaveTextContent('0');
  });

  it('provides container props', () => {
    render(<VirtualScrollTest itemCount={100} />);

    const container = screen.getByTestId('virtual-container');
    expect(container).toHaveStyle({ overflow: 'auto' });
  });

  it('provides scroll to index function', () => {
    render(<VirtualScrollTest itemCount={100} />);

    expect(screen.getByTestId('scroll-to')).toBeInTheDocument();
  });
});

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    render(<DebouncedValueTest value="initial" />);

    expect(screen.getByTestId('debounced')).toHaveTextContent('initial');
  });

  it('debounces value updates', () => {
    const { rerender } = render(<DebouncedValueTest value="initial" />);

    rerender(<DebouncedValueTest value="updated" />);

    // Value should still be initial (debounced)
    expect(screen.getByTestId('debounced')).toHaveTextContent('initial');

    // Advance timers past debounce delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now value should be updated
    expect(screen.getByTestId('debounced')).toHaveTextContent('updated');
  });
});

describe('useThrottledCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls callback on first invocation', () => {
    const callback = vi.fn();
    render(<ThrottledCallbackTest onCallback={callback} />);

    screen.getByTestId('throttled-btn').click();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('throttles subsequent calls', () => {
    const callback = vi.fn();
    render(<ThrottledCallbackTest onCallback={callback} />);

    const btn = screen.getByTestId('throttled-btn');

    // Multiple rapid clicks
    btn.click();
    btn.click();
    btn.click();

    // Should only be called once (throttled)
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('allows next call after throttle period', () => {
    const callback = vi.fn();
    render(<ThrottledCallbackTest onCallback={callback} />);

    const btn = screen.getByTestId('throttled-btn');

    btn.click();
    expect(callback).toHaveBeenCalledTimes(1);

    // Advance past throttle period
    vi.advanceTimersByTime(100);

    btn.click();
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe('measureRender', () => {
  it('measures render time', () => {
    const result = measureRender(() => {
      // Simulate some work
      const arr = Array.from({ length: 1000 }, (_, i) => i);
      return arr.reduce((a, b) => a + b, 0);
    });

    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('duration');
    expect(typeof result.duration).toBe('number');
  });

  it('returns correct result', () => {
    const result = measureRender(() => 42);

    expect(result.result).toBe(42);
  });
});
