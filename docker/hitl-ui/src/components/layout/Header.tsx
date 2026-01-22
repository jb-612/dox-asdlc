import { useState } from 'react';
import { Menu } from '@headlessui/react';
import {
  ChevronDownIcon,
  UserCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useTenantStore } from '@/stores/tenantStore';
import clsx from 'clsx';

export default function Header() {
  const { currentTenant, setTenant, availableTenants, multiTenancyEnabled } =
    useTenantStore();
  const [userName] = useState('Operator');

  return (
    <header className="flex h-16 items-center justify-between border-b border-bg-tertiary bg-bg-secondary px-6">
      {/* Left side - Breadcrumb area (can be extended) */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-medium text-text-primary">
          Governance Dashboard
        </h2>
      </div>

      {/* Right side - Tenant selector and user menu */}
      <div className="flex items-center gap-4">
        {/* Tenant Selector */}
        {multiTenancyEnabled && (
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary/80 transition-colors">
              <span className="text-text-secondary">Tenant:</span>
              <span className="font-medium">{currentTenant}</span>
              <ChevronDownIcon className="h-4 w-4 text-text-secondary" />
            </Menu.Button>

            <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg bg-bg-secondary border border-bg-tertiary shadow-lg focus:outline-none z-50">
              <div className="p-1">
                {availableTenants.map((tenant) => (
                  <Menu.Item key={tenant}>
                    {({ active }) => (
                      <button
                        onClick={() => setTenant(tenant)}
                        className={clsx(
                          'w-full rounded-md px-3 py-2 text-left text-sm',
                          active
                            ? 'bg-accent-teal text-text-primary'
                            : 'text-text-secondary',
                          currentTenant === tenant && 'font-medium'
                        )}
                      >
                        {tenant}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </div>
            </Menu.Items>
          </Menu>
        )}

        {/* Settings Button */}
        <button className="p-2 rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors">
          <Cog6ToothIcon className="h-5 w-5" />
        </button>

        {/* User Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors">
            <UserCircleIcon className="h-6 w-6 text-text-secondary" />
            <span className="font-medium">{userName}</span>
            <ChevronDownIcon className="h-4 w-4 text-text-secondary" />
          </Menu.Button>

          <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg bg-bg-secondary border border-bg-tertiary shadow-lg focus:outline-none z-50">
            <div className="p-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={clsx(
                      'w-full rounded-md px-3 py-2 text-left text-sm',
                      active
                        ? 'bg-accent-teal text-text-primary'
                        : 'text-text-secondary'
                    )}
                  >
                    Profile
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={clsx(
                      'w-full rounded-md px-3 py-2 text-left text-sm',
                      active
                        ? 'bg-accent-teal text-text-primary'
                        : 'text-text-secondary'
                    )}
                  >
                    Settings
                  </button>
                )}
              </Menu.Item>
            </div>
          </Menu.Items>
        </Menu>
      </div>
    </header>
  );
}
