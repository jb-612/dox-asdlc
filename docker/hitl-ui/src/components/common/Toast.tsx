/**
 * Toast - Notification toast components and hook
 *
 * Provides toast notifications for success, error, warning, and info messages.
 */

import { useState, useCallback } from 'react';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-status-success',
  error: 'bg-status-error',
  warning: 'bg-status-warning',
  info: 'bg-accent-blue',
};

const TypeIcon: Record<ToastType, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

export function Toast({ message, type, onClose }: ToastProps) {
  const Icon = TypeIcon[type];

  return (
    <div
      data-testid="toast"
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] max-w-md',
        typeStyles[type]
      )}
      role="alert"
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="flex-1 text-sm">{message}</span>
      <button
        data-testid="toast-close"
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded transition-colors"
        aria-label="Close notification"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div
      data-testid="toast-container"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

/**
 * Hook for managing toast notifications
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 5000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const toast: ToastData = { id, message, type, duration };

      setToasts((prev) => [...prev, toast]);

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
    clearToasts,
  };
}

/**
 * Helper functions for common toast types
 */
export function createToastHelpers(showToast: ReturnType<typeof useToast>['showToast']) {
  return {
    success: (message: string, duration?: number) => showToast(message, 'success', duration),
    error: (message: string, duration?: number) => showToast(message, 'error', duration),
    warning: (message: string, duration?: number) => showToast(message, 'warning', duration),
    info: (message: string, duration?: number) => showToast(message, 'info', duration),
  };
}
