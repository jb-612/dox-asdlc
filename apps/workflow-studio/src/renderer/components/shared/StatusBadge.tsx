import { statusToVariant, type StatusVariant } from './statusUtils';

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  size?: 'sm' | 'md';
}

const VARIANT_COLORS: Record<StatusVariant, { bg: string; text: string }> = {
  success: { bg: '#065f4620', text: '#34d399' },
  warning: { bg: '#78350f20', text: '#fbbf24' },
  error: { bg: '#7f1d1d20', text: '#f87171' },
  info: { bg: '#1e3a5f20', text: '#60a5fa' },
  neutral: { bg: '#37415120', text: '#9ca3af' },
};

const SIZE_STYLES: Record<'sm' | 'md', React.CSSProperties> = {
  sm: { fontSize: 11, padding: '1px 8px' },
  md: { fontSize: 12, padding: '2px 10px' },
};

export function StatusBadge({
  status,
  variant,
  size = 'sm',
}: StatusBadgeProps): JSX.Element {
  const resolved = variant ?? statusToVariant(status);
  const colors = VARIANT_COLORS[resolved];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <span
      style={{
        display: 'inline-block',
        borderRadius: 9999,
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        backgroundColor: colors.bg,
        color: colors.text,
        ...sizeStyle,
      }}
    >
      {status}
    </span>
  );
}
