import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowPathIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { Menu } from '@headlessui/react';
import { useSessions } from '@/api/sessions';
import { SessionList } from '@/components/sessions';
import clsx from 'clsx';

type StatusFilter = 'active' | 'completed' | 'all';

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Sessions' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

export interface SessionsPageProps {
  /** Custom class name */
  className?: string;
}

export default function SessionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') as StatusFilter | null;
  const [filter, setFilter] = useState<StatusFilter>(statusParam || 'active');

  const { refetch, isFetching } = useSessions({ status: filter });

  const handleFilterChange = (status: StatusFilter) => {
    setFilter(status);
    if (status === 'active') {
      setSearchParams({});
    } else {
      setSearchParams({ status });
    }
  };

  const currentFilterLabel =
    filterOptions.find((f) => f.value === filter)?.label || 'Active';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Sessions
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Monitor aSDLC workflow sessions and their progress
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-bg-tertiary rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-accent-teal/30 transition-colors">
              <FunnelIcon className="h-4 w-4" />
              <span>{currentFilterLabel}</span>
            </Menu.Button>

            <Menu.Items className="absolute right-0 mt-2 w-40 origin-top-right rounded-lg bg-bg-secondary border border-bg-tertiary shadow-lg focus:outline-none z-50">
              <div className="p-1">
                {filterOptions.map((option) => (
                  <Menu.Item key={option.value}>
                    {({ active }) => (
                      <button
                        onClick={() => handleFilterChange(option.value)}
                        className={clsx(
                          'w-full rounded-md px-3 py-2 text-left text-sm',
                          active
                            ? 'bg-accent-teal text-text-primary'
                            : 'text-text-secondary',
                          filter === option.value && 'font-medium'
                        )}
                      >
                        {option.label}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </div>
            </Menu.Items>
          </Menu>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-bg-secondary border border-bg-tertiary rounded-lg text-text-secondary hover:text-text-primary hover:border-accent-teal/30 transition-colors disabled:opacity-50"
            title="Refresh sessions"
          >
            <ArrowPathIcon
              className={clsx('h-5 w-5', isFetching && 'animate-spin')}
            />
          </button>
        </div>
      </div>

      {/* Session List */}
      <SessionList params={{ status: filter }} />
    </div>
  );
}
