import { useState } from 'react';
import { useArtifactContent } from '@/api/gates';
import { Spinner } from '@/components/common';
import DiffViewer from './DiffViewer';
import type { Artifact } from '@/api/types';
import clsx from 'clsx';

interface ArtifactViewerProps {
  artifact: Artifact;
  className?: string;
}

export default function ArtifactViewer({ artifact, className }: ArtifactViewerProps) {
  const [expanded, setExpanded] = useState(true);

  // Only fetch content if not already available in preview
  const shouldFetch = !artifact.preview;
  const { data, isLoading, error } = useArtifactContent(
    shouldFetch ? artifact.path : undefined
  );

  const content = artifact.preview || data?.content || '';

  if (isLoading) {
    return (
      <div className={clsx('flex items-center justify-center py-8', className)}>
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx('rounded-lg bg-status-error/10 border border-status-error/20 p-4', className)}>
        <p className="text-sm text-status-error">
          Failed to load artifact content
        </p>
      </div>
    );
  }

  // Render based on artifact type
  if (artifact.type === 'diff') {
    return (
      <div className={className}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-bg-tertiary rounded-t-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <span className="font-mono">{artifact.path}</span>
          <span>{expanded ? 'Collapse' : 'Expand'}</span>
        </button>
        {expanded && <DiffViewer content={content} />}
      </div>
    );
  }

  if (artifact.type === 'report') {
    // Try to parse as JSON and pretty print
    let formattedContent = content;
    try {
      const parsed = JSON.parse(content);
      formattedContent = JSON.stringify(parsed, null, 2);
    } catch {
      // Not JSON, use as-is
    }

    return (
      <div className={className}>
        <div className="px-3 py-2 bg-bg-tertiary rounded-t-lg text-sm text-text-secondary font-mono">
          {artifact.path}
        </div>
        <pre className="p-4 bg-bg-primary rounded-b-lg border border-bg-tertiary overflow-x-auto text-sm text-text-secondary font-mono">
          {formattedContent}
        </pre>
      </div>
    );
  }

  if (artifact.type === 'log') {
    return (
      <div className={className}>
        <div className="px-3 py-2 bg-bg-tertiary rounded-t-lg text-sm text-text-secondary font-mono">
          {artifact.path}
        </div>
        <pre className="p-4 bg-bg-primary rounded-b-lg border border-bg-tertiary overflow-x-auto text-sm text-text-tertiary font-mono whitespace-pre-wrap">
          {content}
        </pre>
      </div>
    );
  }

  // Default file viewer
  return (
    <div className={className}>
      <div className="px-3 py-2 bg-bg-tertiary rounded-t-lg text-sm text-text-secondary font-mono">
        {artifact.path}
      </div>
      <pre className="p-4 bg-bg-primary rounded-b-lg border border-bg-tertiary overflow-x-auto text-sm text-text-primary font-mono whitespace-pre-wrap">
        {content}
      </pre>
    </div>
  );
}
