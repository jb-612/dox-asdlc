import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, PlayIcon } from '@heroicons/react/24/outline';

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/cockpit"
          className="p-2 rounded-lg text-text-secondary hover:bg-bg-tertiary transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <PlayIcon className="h-8 w-8 text-accent-teal" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Run Detail</h1>
            <p className="text-text-secondary text-sm">{runId}</p>
          </div>
        </div>
      </div>

      <div className="card p-8 text-center">
        <p className="text-text-secondary">
          Run timeline, inputs, outputs, and evidence.
        </p>
        <p className="text-text-muted text-sm mt-2">
          RLM Trajectory Viewer and run details coming soon.
        </p>
      </div>
    </div>
  );
}
