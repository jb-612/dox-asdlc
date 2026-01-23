import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, DocumentIcon } from '@heroicons/react/24/outline';

export default function ArtifactDetailPage() {
  const { artifactId } = useParams<{ artifactId: string }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/artifacts"
          className="p-2 rounded-lg text-text-secondary hover:bg-bg-tertiary transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <DocumentIcon className="h-8 w-8 text-accent-teal" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Artifact Detail</h1>
            <p className="text-text-secondary text-sm">{artifactId}</p>
          </div>
        </div>
      </div>

      <div className="card p-8 text-center">
        <p className="text-text-secondary">
          View artifact content, history, and provenance.
        </p>
        <p className="text-text-muted text-sm mt-2">
          Content viewer, version history, and context pack tabs coming soon.
        </p>
      </div>
    </div>
  );
}
