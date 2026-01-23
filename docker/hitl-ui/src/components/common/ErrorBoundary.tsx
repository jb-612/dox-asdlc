/**
 * ErrorBoundary - Catches and handles React errors
 *
 * Wraps components to catch JavaScript errors and display a fallback UI.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackRender?: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, fallbackRender } = this.props;

    if (hasError && error) {
      // Custom fallback render prop
      if (fallbackRender) {
        return fallbackRender({ error, resetErrorBoundary: this.resetErrorBoundary });
      }

      // Custom fallback element
      if (fallback) {
        return fallback;
      }

      // Default fallback
      return (
        <div data-testid="error-boundary-fallback">
          <ErrorFallback
            error={error}
            resetErrorBoundary={this.resetErrorBoundary}
          />
        </div>
      );
    }

    return children;
  }
}

export { ErrorBoundary };
