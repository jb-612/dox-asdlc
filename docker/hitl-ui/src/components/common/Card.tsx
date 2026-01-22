import clsx from 'clsx';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export default function Card({
  children,
  className,
  hover = false,
  padding = 'md',
  onClick,
}: CardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={clsx(
        'card',
        paddingMap[padding],
        hover && 'card-hover cursor-pointer',
        onClick && 'text-left w-full',
        className
      )}
    >
      {children}
    </Component>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between pb-4 border-b border-bg-tertiary',
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={clsx('text-lg font-semibold text-text-primary', className)}>
      {children}
    </h3>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={clsx('pt-4', className)}>{children}</div>;
}
