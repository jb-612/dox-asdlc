import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IpcErrorBoundary } from '../../../../src/renderer/components/shared/IpcErrorBoundary';

// Suppress React error boundary console.error noise in tests
beforeEach(() => {
  cleanup();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('IPC call failed');
  return <div>Child content</div>;
}

describe('IpcErrorBoundary (F10-T01)', () => {
  it('renders children when no error', () => {
    render(
      <IpcErrorBoundary>
        <div>Safe content</div>
      </IpcErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders default fallback when child throws', () => {
    render(
      <IpcErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </IpcErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText('IPC call failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retry button clears error and re-renders children', () => {
    let shouldThrow = true;
    function ConditionalChild() {
      if (shouldThrow) throw new Error('Fail once');
      return <div>Recovered</div>;
    }

    render(
      <IpcErrorBoundary>
        <ConditionalChild />
      </IpcErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('onError callback called with error and errorInfo', () => {
    const onError = vi.fn();
    render(
      <IpcErrorBoundary onError={onError}>
        <ThrowingChild shouldThrow={true} />
      </IpcErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('IPC call failed');
  });

  it('custom fallback render function receives error and reset', () => {
    render(
      <IpcErrorBoundary
        fallback={(error, reset) => (
          <div>
            <span>Custom: {error.message}</span>
            <button onClick={reset}>Custom Retry</button>
          </div>
        )}
      >
        <ThrowingChild shouldThrow={true} />
      </IpcErrorBoundary>,
    );
    expect(screen.getByText('Custom: IPC call failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom Retry' })).toBeInTheDocument();
  });
});

describe('IpcErrorBoundary edge cases (F10-T02)', () => {
  it('error after reset triggers boundary again', () => {
    function AlwaysThrows() {
      throw new Error('Persistent failure');
    }

    render(
      <IpcErrorBoundary>
        <AlwaysThrows />
      </IpcErrorBoundary>,
    );

    // First catch
    expect(screen.getByText('Persistent failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // Retry triggers the error again
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    // Boundary re-catches
    expect(screen.getByText('Persistent failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
