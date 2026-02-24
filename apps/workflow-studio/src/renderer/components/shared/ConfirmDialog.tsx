import { useEffect, useRef, type KeyboardEvent } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_COLORS: Record<'danger' | 'warning', { bg: string; hover: string }> = {
  danger: { bg: '#dc2626', hover: '#b91c1c' },
  warning: { bg: '#d97706', hover: '#b45309' },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      onCancel();
    }
    if (e.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  if (!open) return null;

  const colors = VARIANT_COLORS[variant];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
      }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: 8,
          padding: 24,
          maxWidth: 420,
          width: '90%',
          outline: 'none',
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 600, color: '#e5e7eb' }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #4b5563',
              backgroundColor: 'transparent',
              color: '#d1d5db',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: colors.bg,
              color: '#ffffff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
