import { ReactNode } from 'react';
import {
  InboxIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

type EmptyStateType = 'gates' | 'sessions' | 'workers' | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const iconMap: Record<EmptyStateType, typeof InboxIcon> = {
  gates: ShieldCheckIcon,
  sessions: DocumentTextIcon,
  workers: InboxIcon,
  generic: InboxIcon,
};

const defaultTitles: Record<EmptyStateType, string> = {
  gates: 'No pending gates',
  sessions: 'No active sessions',
  workers: 'No workers found',
  generic: 'No data',
};

const defaultDescriptions: Record<EmptyStateType, string> = {
  gates: 'All governance gates have been reviewed. Check back later for new requests.',
  sessions: 'There are no active sessions at the moment.',
  workers: 'Worker pool is currently empty.',
  generic: 'There is nothing to display.',
};

export default function EmptyState({
  type = 'generic',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon = iconMap[type];
  const displayTitle = title || defaultTitles[type];
  const displayDescription = description || defaultDescriptions[type];

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-tertiary mb-4">
        <Icon className="h-8 w-8 text-text-tertiary" />
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">
        {displayTitle}
      </h3>
      <p className="text-sm text-text-secondary max-w-sm mb-6">
        {displayDescription}
      </p>
      {action}
    </div>
  );
}
