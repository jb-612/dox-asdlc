/**
 * Simple toast notification utility
 *
 * This is a lightweight implementation. In production, consider using
 * a library like react-hot-toast or sonner.
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Show a toast notification
 * In this simple implementation, we just log to console.
 * For a real implementation, integrate with a toast library.
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  // For now, just log to console
  // eslint-disable-next-line no-console
  console.log(`[Toast ${type}]: ${message}`);

  // In a real implementation, this would dispatch to a toast manager
  // e.g., toast[type](message) with react-hot-toast
}
