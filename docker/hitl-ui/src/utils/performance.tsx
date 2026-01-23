/**
 * Performance optimization utilities
 *
 * Provides lazy loading, virtual scrolling, memoization, and performance measurement.
 */

import {
  lazy,
  Suspense,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  ReactNode,
  ComponentType,
  CSSProperties,
} from 'react';
import { LoadingSpinner } from '@/components/common/LoadingStates';

// ============================================================================
// Lazy Loading
// ============================================================================

interface LazyComponentOptions {
  fallback?: ReactNode;
  preload?: boolean;
}

/**
 * Create a lazy-loaded component with custom fallback
 */
export function LazyComponent<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): T {
  const { fallback = <LoadingSpinner />, preload = false } = options;

  const LazyComp = lazy(loader);

  // Preload if requested
  if (preload) {
    loader();
  }

  // Return wrapped component with proper type casting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WrappedComponent = (props: any) => (
    <Suspense fallback={fallback}>
      <LazyComp {...props} />
    </Suspense>
  );

  return WrappedComponent as unknown as T;
}

/**
 * Preload a lazy component
 */
export function preloadComponent(loader: () => Promise<unknown>): void {
  loader();
}

// ============================================================================
// Memoization
// ============================================================================

/**
 * Memoized callback with stable reference
 */
export function useMemoizedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: unknown[]
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, deps);
}

/**
 * Deep memoization for complex objects
 */
export function useDeepMemo<T>(factory: () => T, deps: unknown[]): T {
  const prevDepsRef = useRef<unknown[]>();
  const prevValueRef = useRef<T>();

  const depsChanged =
    !prevDepsRef.current ||
    deps.length !== prevDepsRef.current.length ||
    deps.some((dep, i) => !Object.is(dep, prevDepsRef.current![i]));

  if (depsChanged) {
    prevDepsRef.current = deps;
    prevValueRef.current = factory();
  }

  return prevValueRef.current as T;
}

// ============================================================================
// Virtual Scrolling
// ============================================================================

interface VirtualScrollOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface VirtualScrollResult {
  visibleRange: { start: number; end: number };
  totalHeight: number;
  offsetY: number;
  containerProps: {
    style: CSSProperties;
    onScroll: (e: React.UIEvent<HTMLElement>) => void;
    ref: React.RefObject<HTMLDivElement>;
  };
  scrollToIndex: (index: number) => void;
}

export function useVirtualScroll({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 3,
}: VirtualScrollOptions): VirtualScrollResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const totalHeight = itemCount * itemHeight;

  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(
    itemCount,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const offsetY = start * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    },
    [itemHeight]
  );

  return {
    visibleRange: { start, end },
    totalHeight,
    offsetY,
    containerProps: {
      style: {
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      },
      onScroll: handleScroll,
      ref: containerRef,
    },
    scrollToIndex,
  };
}

// ============================================================================
// Debouncing and Throttling
// ============================================================================

/**
 * Debounced value hook
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttled callback hook
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastRanRef = useRef(0);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  callbackRef.current = callback;

  return useCallback(
    ((...args: unknown[]) => {
      const now = Date.now();
      if (now - lastRanRef.current >= delay) {
        lastRanRef.current = now;
        return callbackRef.current(...args);
      }
    }) as T,
    [delay]
  );
}

// ============================================================================
// Performance Measurement
// ============================================================================

interface MeasureResult<T> {
  result: T;
  duration: number;
}

/**
 * Measure render/execution time
 */
export function measureRender<T>(fn: () => T): MeasureResult<T> {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  return { result, duration };
}

/**
 * Log component render time in development
 */
export function useRenderTime(componentName: string): void {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(performance.now());

  useEffect(() => {
    renderCountRef.current += 1;
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[${componentName}] Render #${renderCountRef.current}, ` +
          `time since last: ${timeSinceLastRender.toFixed(2)}ms`
      );
    }
  });
}

// ============================================================================
// Code Splitting Helpers
// ============================================================================

/**
 * Lazy load multiple components in parallel
 */
export function lazyParallel<T extends Record<string, ComponentType<unknown>>>(
  loaders: { [K in keyof T]: () => Promise<{ default: T[K] }> }
): { [K in keyof T]: ReturnType<typeof lazy<ComponentType<unknown>>> } {
  const result = {} as { [K in keyof T]: ReturnType<typeof lazy<ComponentType<unknown>>> };

  for (const key in loaders) {
    result[key] = lazy(loaders[key]);
  }

  return result;
}

/**
 * Preload multiple components
 */
export async function preloadAll(loaders: Array<() => Promise<unknown>>): Promise<void> {
  await Promise.all(loaders.map((loader) => loader().catch(() => undefined)));
}

// ============================================================================
// Memory Management
// ============================================================================

/**
 * Cleanup function for large data structures
 */
export function useCleanup(cleanup: () => void): void {
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
}

/**
 * Track memory usage (development only)
 */
export function useMemoryWarning(threshold: number = 100_000_000): void {
  useEffect(() => {
    if (
      process.env.NODE_ENV === 'development' &&
      'memory' in performance
    ) {
      const checkMemory = () => {
        const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
        if (memory.usedJSHeapSize > threshold) {
          console.warn(
            `Memory usage high: ${(memory.usedJSHeapSize / 1_000_000).toFixed(2)}MB`
          );
        }
      };

      const interval = setInterval(checkMemory, 10000);
      return () => clearInterval(interval);
    }
  }, [threshold]);
}
