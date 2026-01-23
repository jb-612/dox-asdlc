import { DocumentTextIcon } from '@heroicons/react/24/outline';

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DocumentTextIcon className="h-8 w-8 text-accent-teal" />
        <h1 className="text-2xl font-bold text-text-primary">Documentation</h1>
      </div>

      <div className="card p-8 text-center">
        <p className="text-text-secondary">
          Interactive aSDLC methodology documentation.
        </p>
        <p className="text-text-muted text-sm mt-2">
          Blueprint Map, Methodology Stepper, and Interactive Glossary coming soon.
        </p>
      </div>
    </div>
  );
}
