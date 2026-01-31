import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  DocumentTextIcon,
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  FolderIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LightBulbIcon,
  HomeIcon,
  ServerIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  UserGroupIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  disabled?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  defaultCollapsed?: boolean;
}

const navigationSections: NavSection[] = [
  {
    title: 'Workflow',
    items: [
      { name: 'Dashboard', href: '/', icon: HomeIcon },
      { name: 'Documentation', href: '/docs', icon: DocumentTextIcon },
      { name: 'Knowledge Search', href: '/search', icon: MagnifyingGlassIcon },
      { name: 'Agent Cockpit', href: '/cockpit', icon: CpuChipIcon },
      { name: 'Agent Activity', href: '/agents', icon: UserGroupIcon },
      { name: 'Kubernetes', href: '/k8s', icon: ServerIcon },
      { name: 'Metrics', href: '/metrics', icon: ChartBarIcon },
      { name: 'Ideation Studio', href: '/studio/ideation', icon: LightBulbIcon },
      { name: 'Brainflare Hub', href: '/brainflare', icon: SparklesIcon },
      { name: 'HITL Gates', href: '/gates', icon: ShieldCheckIcon },
      { name: 'Artifacts', href: '/artifacts', icon: FolderIcon },
    ],
  },
  {
    title: 'Administration',
    defaultCollapsed: false,
    items: [
      { name: 'Rule Proposals', href: '/rules', icon: LightBulbIcon },
      { name: 'Budget', href: '/budget', icon: CurrencyDollarIcon, disabled: true },
      { name: 'LLM Config', href: '/admin/llm', icon: Cog6ToothIcon },
      { name: 'Admin', href: '/admin', icon: Cog6ToothIcon, disabled: true },
    ],
  },
];

interface CollapsibleSectionProps {
  section: NavSection;
}

function CollapsibleSection({ section }: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(section.defaultCollapsed ?? false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
      >
        <span>{section.title}</span>
        {collapsed ? (
          <ChevronRightIcon className="h-4 w-4" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" />
        )}
      </button>
      {!collapsed && (
        <div className="mt-1 space-y-1">
          {section.items.map((item) => (
            <NavLink
              key={item.name}
              to={item.disabled ? '#' : item.href}
              onClick={(e) => item.disabled && e.preventDefault()}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  item.disabled && 'opacity-50 cursor-not-allowed',
                  isActive && !item.disabled
                    ? 'bg-accent-teal text-text-primary'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
              {item.disabled && (
                <span className="ml-auto text-xs text-text-muted">Soon</span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

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
          <p className="text-xs text-text-secondary">Development Console</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigationSections.map((section) => (
          <CollapsibleSection key={section.title} section={section} />
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
