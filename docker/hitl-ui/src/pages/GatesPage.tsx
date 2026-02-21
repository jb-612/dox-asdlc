import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FunnelIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Menu } from '@headlessui/react';
import { GateList } from '@/components/gates';
import { usePendingGates } from '@/api/gates';
import type { GateType } from '@/api/types';
import { gateTypeLabels } from '@/api/types';
import { ALL_GATE_TYPES } from '@/utils/constants';
import clsx from 'clsx';

export interface GatesPageProps {
  /** Custom class name */
  className?: string;
}

export default function GatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('type') as GateType | null;
  const [filter, setFilter] = useState<GateType | undefined>(filterParam || undefined);

  const { refetch, isFetching } = usePendingGates({ type: filter });

  const handleFilterChange = (type: GateType | undefined) => {
    setFilter(type);
    if (type) {
      setSearchParams({ type });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Pending Gates
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Review and approve governance gate requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-bg-tertiary rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-accent-teal/30 transition-colors">
              <FunnelIcon className="h-4 w-4" />
              <span>{filter ? gateTypeLabels[filter] : 'All Types'}</span>
            </Menu.Button>

            <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg bg-bg-secondary border border-bg-tertiary shadow-lg focus:outline-none z-50">
              <div className="p-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => handleFilterChange(undefined)}
                      className={clsx(
                        'w-full rounded-md px-3 py-2 text-left text-sm',
                        active
                          ? 'bg-accent-teal text-text-primary'
                          : 'text-text-secondary',
                        !filter && 'font-medium'
                      )}
                    >
                      All Types
                    </button>
                  )}
                </Menu.Item>
                {ALL_GATE_TYPES.map((type) => (
                  <Menu.Item key={type}>
                    {({ active }) => (
                      <button
                        onClick={() => handleFilterChange(type)}
                        className={clsx(
                          'w-full rounded-md px-3 py-2 text-left text-sm',
                          active
                            ? 'bg-accent-teal text-text-primary'
                            : 'text-text-secondary',
                          filter === type && 'font-medium'
                        )}
                      >
                        {gateTypeLabels[type]}
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
            title="Refresh gates"
          >
            <ArrowPathIcon
              className={clsx('h-5 w-5', isFetching && 'animate-spin')}
            />
          </button>
        </div>
      </div>

      {/* Active Filter Badge */}
      {filter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Filtered by:</span>
          <button
            onClick={() => handleFilterChange(undefined)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-teal/20 text-accent-teal-light text-sm hover:bg-accent-teal/30 transition-colors"
          >
            {gateTypeLabels[filter]}
            <span className="text-xs">&times;</span>
          </button>
        </div>
      )}

      {/* Gate List */}
      <GateList filter={filter} />
    </div>
  );
}
