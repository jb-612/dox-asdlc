/**
 * Tests for ErrorBoundary and error handling components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';
import { ErrorFallback } from './ErrorFallback';
import { Toast, ToastContainer, useToast } from './Toast';

// Suppress console.error for error boundary tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

// Component that throws an error
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div data-testid="no-error">No error</div>;
}

describe('ErrorBoundary', () => {
  describe('Basic Rendering', () => {
    it('renders children when no error', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders error fallback when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
    });

    it('displays error message', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Custom Fallback', () => {
    it('renders custom fallback component', () => {
      const CustomFallback = () => <div data-testid="custom-fallback">Custom error</div>;

      render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    });

    it('passes error to fallback render prop', () => {
      render(
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <div data-testid="render-prop-fallback">{error.message}</div>
          )}
        >
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('render-prop-fallback')).toHaveTextContent('Test error');
    });
  });

  describe('Error Recovery', () => {
    it('shows retry button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    it('calls onReset when retry clicked', () => {
      const onReset = vi.fn();
      render(
        <ErrorBoundary onReset={onReset}>
          <ThrowError />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByTestId('retry-button'));

      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('Error Reporting', () => {
    it('calls onError when error occurs', () => {
      const onError = vi.fn();
      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });
});

describe('ErrorFallback', () => {
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      const error = new Error('Test error');
      render(<ErrorFallback error={error} resetErrorBoundary={() => {}} />);

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    });

    it('displays error message', () => {
      const error = new Error('Specific error message');
      render(<ErrorFallback error={error} resetErrorBoundary={() => {}} />);

      expect(screen.getByText(/specific error message/i)).toBeInTheDocument();
    });

    it('shows retry button', () => {
      const error = new Error('Test');
      render(<ErrorFallback error={error} resetErrorBoundary={() => {}} />);

      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('calls resetErrorBoundary on retry', () => {
      const resetErrorBoundary = vi.fn();
      const error = new Error('Test');
      render(<ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      fireEvent.click(screen.getByTestId('retry-button'));

      expect(resetErrorBoundary).toHaveBeenCalled();
    });

    it('shows details toggle', () => {
      const error = new Error('Test');
      render(<ErrorFallback error={error} resetErrorBoundary={() => {}} />);

      expect(screen.getByTestId('show-details')).toBeInTheDocument();
    });

    it('expands error details when clicked', () => {
      const error = new Error('Test');
      error.stack = 'Error stack trace';
      render(<ErrorFallback error={error} resetErrorBoundary={() => {}} />);

      fireEvent.click(screen.getByTestId('show-details'));

      expect(screen.getByTestId('error-details')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      const error = new Error('Test');
      render(<ErrorFallback error={error} resetErrorBoundary={() => {}} className="custom-class" />);

      expect(screen.getByTestId('error-fallback')).toHaveClass('custom-class');
    });
  });
});

describe('Toast', () => {
  describe('Basic Rendering', () => {
    it('renders toast message', () => {
      render(<Toast message="Test toast" type="info" onClose={() => {}} />);

      expect(screen.getByTestId('toast')).toBeInTheDocument();
    });

    it('displays message text', () => {
      render(<Toast message="Important message" type="info" onClose={() => {}} />);

      expect(screen.getByText('Important message')).toBeInTheDocument();
    });
  });

  describe('Types', () => {
    it('renders success toast', () => {
      render(<Toast message="Success" type="success" onClose={() => {}} />);

      expect(screen.getByTestId('toast')).toHaveClass('bg-status-success');
    });

    it('renders error toast', () => {
      render(<Toast message="Error" type="error" onClose={() => {}} />);

      expect(screen.getByTestId('toast')).toHaveClass('bg-status-error');
    });

    it('renders warning toast', () => {
      render(<Toast message="Warning" type="warning" onClose={() => {}} />);

      expect(screen.getByTestId('toast')).toHaveClass('bg-status-warning');
    });

    it('renders info toast', () => {
      render(<Toast message="Info" type="info" onClose={() => {}} />);

      expect(screen.getByTestId('toast')).toHaveClass('bg-accent-blue');
    });
  });

  describe('Close Action', () => {
    it('shows close button', () => {
      render(<Toast message="Test" type="info" onClose={() => {}} />);

      expect(screen.getByTestId('toast-close')).toBeInTheDocument();
    });

    it('calls onClose when close clicked', () => {
      const onClose = vi.fn();
      render(<Toast message="Test" type="info" onClose={onClose} />);

      fireEvent.click(screen.getByTestId('toast-close'));

      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('ToastContainer', () => {
  it('renders without crashing', () => {
    render(<ToastContainer toasts={[]} onRemove={() => {}} />);

    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    const toasts = [
      { id: '1', message: 'Toast 1', type: 'info' as const },
      { id: '2', message: 'Toast 2', type: 'success' as const },
    ];

    render(<ToastContainer toasts={toasts} onRemove={() => {}} />);

    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
  });

  it('calls onRemove with correct id', () => {
    const onRemove = vi.fn();
    const toasts = [{ id: 'toast-1', message: 'Test', type: 'info' as const }];

    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);
    fireEvent.click(screen.getByTestId('toast-close'));

    expect(onRemove).toHaveBeenCalledWith('toast-1');
  });
});

describe('useToast Hook', () => {
  function ToastHookTest() {
    const { toasts, showToast, removeToast, clearToasts } = useToast();

    return (
      <div>
        <button
          data-testid="show-info"
          onClick={() => showToast('Info message', 'info')}
        >
          Show Info
        </button>
        <button
          data-testid="show-error"
          onClick={() => showToast('Error message', 'error')}
        >
          Show Error
        </button>
        <button data-testid="clear" onClick={clearToasts}>
          Clear
        </button>
        <span data-testid="count">{toasts.length}</span>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  it('starts with no toasts', () => {
    render(<ToastHookTest />);

    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('adds toast on showToast', () => {
    render(<ToastHookTest />);

    fireEvent.click(screen.getByTestId('show-info'));

    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('adds multiple toasts', () => {
    render(<ToastHookTest />);

    fireEvent.click(screen.getByTestId('show-info'));
    fireEvent.click(screen.getByTestId('show-error'));

    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('clears all toasts', () => {
    render(<ToastHookTest />);

    fireEvent.click(screen.getByTestId('show-info'));
    fireEvent.click(screen.getByTestId('show-error'));
    fireEvent.click(screen.getByTestId('clear'));

    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('removes individual toast', () => {
    render(<ToastHookTest />);

    fireEvent.click(screen.getByTestId('show-info'));
    fireEvent.click(screen.getByTestId('toast-close'));

    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
