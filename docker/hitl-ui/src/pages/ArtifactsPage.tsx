import { FolderIcon } from '@heroicons/react/24/outline';

export default function ArtifactsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FolderIcon className="h-8 w-8 text-accent-teal" />
        <h1 className="text-2xl font-bold text-text-primary">Artifacts</h1>
      </div>

      <div className="card p-8 text-center">
        <p className="text-text-secondary">
          Browse and manage generated artifacts.
        </p>
        <p className="text-text-muted text-sm mt-2">
          Artifact Explorer and Spec Index Browser coming soon.
        </p>
      </div>
    </div>
  );
}
