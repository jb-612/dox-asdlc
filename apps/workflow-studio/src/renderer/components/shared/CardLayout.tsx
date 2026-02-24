import type { ReactNode } from 'react';

export interface CardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}

export function CardLayout({
  title,
  subtitle,
  actions,
  badge,
  children,
}: CardLayoutProps): JSX.Element {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        border: '1px solid #374151',
        backgroundColor: '#1f2937',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>
            {title}
          </h3>
          {badge}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      {subtitle && (
        <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#9ca3af' }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}
