import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Listbox } from '@headlessui/react';
import {
  ChevronDownIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ServerIcon,
  FolderOpenIcon,
  DocumentIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { useTenantStore } from '@/stores/tenantStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useUIStore } from '@/stores/uiStore';
import clsx from 'clsx';

const environments = ['dev', 'staging', 'prod'] as const;
const mockRepos = ['dox-asdlc', 'frontend-app', 'api-service'];
const mockEpics = ['EPIC-001', 'EPIC-002', 'EPIC-003'];

const pageTitle: Record<string, string> = {
  '/': 'Dashboard',
  '/docs': 'Documentation',
  '/cockpit': 'Agent Cockpit',
  '/studio/discovery': 'Discovery Studio',
  '/gates': 'HITL Gates',
  '/artifacts': 'Artifacts',
  '/budget': 'Budget',
  '/admin': 'Admin',
  '/workers': 'Workers',
  '/sessions': 'Sessions',
};

export default function Header() {
  const location = useLocation();
  const { currentTenant, setTenant, availableTenants, multiTenancyEnabled } =
    useTenantStore();
  const { environment, setEnvironment, repo, setRepo, epicId, setEpic } =
    useSessionStore();
  const { theme, toggleTheme } = useUIStore();
  const [userName] = useState('Operator');

  const currentPageTitle = pageTitle[location.pathname] || 'aSDLC';

  return (
    <header className="flex h-16 items-center justify-between border-b border-bg-tertiary bg-bg-secondary px-6">
      {/* Left side - Page title and session selectors */}
      <div className="flex items-center gap-6">
        <h2 className="text-lg font-medium text-text-primary">
          {currentPageTitle}
        </h2>

        {/* Session Selectors */}
        <div className="flex items-center gap-3">
          {/* Environment Selector */}
          <Listbox value={environment} onChange={(v) => setEnvironment(v as 'dev' | 'staging' | 'prod')}>
            <div className="relative">
              <Listbox.Button className="flex items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary hover:bg-bg-tertiary/80 transition-colors">
                <ServerIcon className="h-4 w-4 text-text-secondary" />
                <span className={clsx(
                  'font-medium',
                  environment === 'prod' && 'text-status-error',
                  environment === 'staging' && 'text-status-warning',
                  environment === 'dev' && 'text-accent-teal'
                )}>
                  {environment}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-text-secondary" />
              </Listbox.Button>

              <Listbox.Options className="absolute left-0 mt-2 w-36 origin-top-left rounded-lg bg-bg-secondary border border-bg-tertiary shadow-lg focus:outline-none z-50">
                <div className="p-1">
                  {environments.map((env) => (
                    <Listbox.Option
                      key={env}
                      value={env}
                      className={({ active, selected }) =>
                        clsx(
                          'cursor-pointer rounded-md px-3 py-2 text-sm',
                          active ? 'bg-bg-tertiary' : '',
                          selected ? 'text-text-primary font-medium' : 'text-text-secondary'
                        )
                      }
                    >
                      {env}
                    </Listbox.Option>
                  ))}
                </div>
              </Listbox.Options>
            </div>
          </Listbox>

          {/* Repo Selector */}
          <Listbox value={repo || ''} onChange={setRepo}>
            <div className="relative">
              <Listbox.Button className="flex items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary hover:bg-bg-tertiary/80 transition-colors">
                <FolderOpenIcon className="h-4 w-4 text-text-secondary" />
                <span className="font-medium max-w-[120px] truncate">
                  {repo || 'Select repo'}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-text-secondary" />
              </Listbox.Button>

              <Listbox.Options className="absolute left-0 mt-2 w-48 origin-top-left rounded-lg bg-bg-secondary border border-bg-tertiary shadow-lg focus:outline-none z-50">
                <div className="p-1">
                  {mockRepos.map((r) => (
                    <Listbox.Option
                      key={r}
                      value={r}
                      className={({ active, selected }) =>
                        clsx(
                          'cursor-pointer rounded-md px-3 py-2 text-sm',
                          active ? 'bg-bg-tertiary' : '',
                          selected ? 'text-text-primary font-medium' : 'text-text-secondary'
                        )
                      }
                    >
                      {r}
                    </Listbox.Option>
                  ))}
                </div>
              </Listbox.Options>
            </div>
          </Listbox>

          {/* Epic Selector */}
          <Listbox value={epicId || ''} onChange={setEpic}>
            <div className="relative">
              <Listbox.Button className="flex items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary hover:bg-bg-tertiary/80 transition-colors">
                <DocumentIcon className="h-4 w-4 text-text-secondary" />
                <span className="font-medium max-w-[100px] truncate">
                  {epicId || 'All epics'}
                </span>
                <ChevronDownIcon className="h-4 w-4 text-text-secondary" />
              </Listbox.Button>

              <Listbox.Options className="absolute left-0 mt-2 w-40 origin-top-left rounded-lg bg-bg-secondary border border-bg-tertiary shadow-lg focus:outline-none z-50">
                <div className="p-1">
                  <Listbox.Option
                    value=""
                    className={({ active }) =>
                      clsx(
                        'cursor-pointer rounded-md px-3 py-2 text-sm',
                        active ? 'bg-bg-tertiary' : '',
                        !epicId ? 'text-text-primary font-medium' : 'text-text-secondary'
                      )
                    }
                  >
                    All epics
                  </Listbox.Option>
                  {mockEpics.map((epic) => (
                    <Listbox.Option
                      key={epic}
                      value={epic}
                      className={({ active, selected }) =>
                        clsx(
                          'cursor-pointer rounded-md px-3 py-2 text-sm',
                          active ? 'bg-bg-tertiary' : '',
                          selected ? 'text-text-primary font-medium' : 'text-text-secondary'
                        )
                      }
                    >
                      {epic}
                    </Listbox.Option>
                  ))}
                </div>
              </Listbox.Options>
            </div>
          </Listbox>
        </div>
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

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </button>

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
