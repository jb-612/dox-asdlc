import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Gates', href: '/gates', icon: ShieldCheckIcon },
  { name: 'Workers', href: '/workers', icon: CpuChipIcon },
  { name: 'Sessions', href: '/sessions', icon: DocumentTextIcon },
];

export default function Sidebar() {
  return (
    <div className="flex w-64 flex-col bg-bg-secondary border-r border-bg-tertiary">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-bg-tertiary">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-teal">
          <ShieldCheckIcon className="h-5 w-5 text-text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">aSDLC</h1>
          <p className="text-xs text-text-secondary">HITL Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-teal text-text-primary'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-bg-tertiary p-4">
        <div className="rounded-lg bg-bg-tertiary/50 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-status-success animate-pulse" />
            <span className="text-xs text-text-secondary">System Healthy</span>
          </div>
        </div>
      </div>
    </div>
  );
}
