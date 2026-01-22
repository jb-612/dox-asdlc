import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ClockIcon,
  DocumentTextIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { useGateDetail } from '@/api/gates';
import { GateTypeBadge, GateStatusBadge, DecisionForm } from '@/components/gates';
import { ArtifactList, ArtifactViewer } from '@/components/artifacts';
import { Card, CardHeader, CardTitle, CardContent, LoadingOverlay, EmptyState } from '@/components/common';
import { formatRelativeTime, formatDateTime } from '@/utils/formatters';
import type { Artifact } from '@/api/types';

export default function GateDetailPage() {
  const { gateId } = useParams<{ gateId: string }>();
  const { data: gate, isLoading, error } = useGateDetail(gateId);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  if (isLoading) {
    return <LoadingOverlay message="Loading gate details..." />;
  }

  if (error || !gate) {
    return (
      <EmptyState
        type="gates"
        title="Gate not found"
        description="The requested gate could not be found or may have been processed."
        action={
          <Link to="/gates" className="btn-primary">
            Back to Gates
          </Link>
        }
      />
    );
  }

  const isPending = gate.status === 'pending';

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Link
        to="/gates"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Gates
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <GateTypeBadge type={gate.type} />
            <GateStatusBadge status={gate.status} />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Gate Review
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary leading-relaxed">
                {gate.summary}
              </p>
            </CardContent>
          </Card>

          {/* Artifacts Card */}
          <Card>
            <CardHeader>
              <CardTitle>
                Artifacts ({gate.artifacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ArtifactList
                artifacts={gate.artifacts}
                selectedPath={selectedArtifact?.path}
                onSelect={setSelectedArtifact}
              />

              {/* Artifact Preview */}
              {selectedArtifact && (
                <div className="mt-4 pt-4 border-t border-bg-tertiary">
                  <ArtifactViewer artifact={selectedArtifact} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Decision Form (only for pending gates) */}
          {isPending && (
            <Card>
              <CardHeader>
                <CardTitle>Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <DecisionForm gateId={gate.id} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Session ID */}
              <div className="flex items-start gap-3">
                <DocumentTextIcon className="h-5 w-5 text-text-tertiary flex-shrink-0" />
                <div>
                  <p className="text-xs text-text-tertiary uppercase tracking-wide">
                    Session
                  </p>
                  <p className="font-mono text-sm text-text-secondary">
                    {gate.session_id}
                  </p>
                </div>
              </div>

              {/* Task ID */}
              {gate.task_id && (
                <div className="flex items-start gap-3">
                  <TagIcon className="h-5 w-5 text-text-tertiary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-text-tertiary uppercase tracking-wide">
                      Task
                    </p>
                    <p className="font-mono text-sm text-text-secondary">
                      {gate.task_id}
                    </p>
                  </div>
                </div>
              )}

              {/* Created At */}
              <div className="flex items-start gap-3">
                <ClockIcon className="h-5 w-5 text-text-tertiary flex-shrink-0" />
                <div>
                  <p className="text-xs text-text-tertiary uppercase tracking-wide">
                    Created
                  </p>
                  <p className="text-sm text-text-secondary">
                    {formatRelativeTime(gate.created_at)}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {formatDateTime(gate.created_at)}
                  </p>
                </div>
              </div>

              {/* Expires At */}
              {gate.expires_at && (
                <div className="flex items-start gap-3">
                  <ClockIcon className="h-5 w-5 text-status-warning flex-shrink-0" />
                  <div>
                    <p className="text-xs text-text-tertiary uppercase tracking-wide">
                      Expires
                    </p>
                    <p className="text-sm text-status-warning">
                      {formatRelativeTime(gate.expires_at)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Context Card */}
          {Object.keys(gate.context).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Context</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {Object.entries(gate.context).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs text-text-tertiary uppercase tracking-wide">
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd className="text-sm text-text-secondary font-mono mt-0.5">
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
