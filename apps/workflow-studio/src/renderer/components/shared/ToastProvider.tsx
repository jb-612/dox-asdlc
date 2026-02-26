import { useEffect, useRef } from 'react';
import { useToastStore, type ToastVariant } from '../../stores/toastStore';

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-green-500 bg-green-900/50 text-green-300',
  error: 'border-red-500 bg-red-900/50 text-red-300',
  warning: 'border-yellow-500 bg-yellow-900/50 text-yellow-300',
  info: 'border-blue-500 bg-blue-900/50 text-blue-300',
};

export function ToastProvider(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const toast of toasts) {
      if (toast.duration > 0 && !timersRef.current.has(toast.id)) {
        const timer = setTimeout(() => {
          removeToast(toast.id);
          timersRef.current.delete(toast.id);
        }, toast.duration);
        timersRef.current.set(toast.id, timer);
      }
    }

    // Cleanup timers for removed toasts
    const currentIds = new Set(toasts.map((t) => t.id));
    for (const [id, timer] of timersRef.current.entries()) {
      if (!currentIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }
  }, [toasts, removeToast]);

  return (
    <div data-testid="toast-container" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-variant={toast.variant}
          className={`border rounded-lg px-4 py-3 flex items-start gap-2 shadow-lg ${VARIANT_CLASSES[toast.variant]}`}
        >
          <span className="flex-1 text-sm">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss"
            className="text-gray-400 hover:text-gray-200 text-xs font-bold shrink-0"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
