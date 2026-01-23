import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

export default function StudioDiscoveryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ChatBubbleLeftRightIcon className="h-8 w-8 text-accent-teal" />
        <h1 className="text-2xl font-bold text-text-primary">Discovery Studio</h1>
      </div>

      <div className="card p-8 text-center">
        <p className="text-text-secondary">
          Chat-driven PRD and requirements discovery.
        </p>
        <p className="text-text-muted text-sm mt-2">
          Chat Interface, Working Outline Panel, and Output Quickview coming soon.
        </p>
      </div>
    </div>
  );
}
