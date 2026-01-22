import {
  DocumentIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import type { Artifact, ArtifactType } from '@/api/types';
import { formatBytes } from '@/utils/formatters';
import clsx from 'clsx';

const iconMap: Record<ArtifactType, typeof DocumentIcon> = {
  file: DocumentIcon,
  diff: CodeBracketIcon,
  log: CommandLineIcon,
  report: ChartBarIcon,
};

const typeColors: Record<ArtifactType, string> = {
  file: 'text-status-info',
  diff: 'text-gate-code',
  log: 'text-status-warning',
  report: 'text-gate-design',
};

interface ArtifactListProps {
  artifacts: Artifact[];
  selectedPath?: string;
  onSelect?: (artifact: Artifact) => void;
}

export default function ArtifactList({
  artifacts,
  selectedPath,
  onSelect,
}: ArtifactListProps) {
  if (!artifacts.length) {
    return (
      <div className="text-sm text-text-secondary py-4 text-center">
        No artifacts attached
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {artifacts.map((artifact) => {
        const Icon = iconMap[artifact.type];
        const isSelected = selectedPath === artifact.path;

        return (
          <button
            key={artifact.path}
            onClick={() => onSelect?.(artifact)}
            className={clsx(
              'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
              isSelected
                ? 'bg-accent-teal/20 border border-accent-teal/30'
                : 'bg-bg-tertiary/50 hover:bg-bg-tertiary border border-transparent'
            )}
          >
            <Icon
              className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', typeColors[artifact.type])}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={clsx(
                    'font-mono text-sm truncate',
                    isSelected ? 'text-text-primary' : 'text-text-secondary'
                  )}
                >
                  {artifact.path}
                </span>
                <span className="text-xs text-text-tertiary flex-shrink-0">
                  {formatBytes(artifact.size_bytes)}
                </span>
              </div>
              {artifact.preview && (
                <p className="text-xs text-text-tertiary mt-1 line-clamp-2 font-mono">
                  {artifact.preview}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
