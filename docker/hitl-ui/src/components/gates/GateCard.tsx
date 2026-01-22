import { useNavigate } from 'react-router-dom';
import {
  ClockIcon,
  DocumentTextIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import Card from '@/components/common/Card';
import { GateTypeBadge, GateStatusBadge } from './GateBadge';
import type { GateRequest } from '@/api/types';
import { formatRelativeTime } from '@/utils/formatters';

interface GateCardProps {
  gate: GateRequest;
}

export default function GateCard({ gate }: GateCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/gates/${gate.id}`);
  };

  return (
    <Card hover onClick={handleClick} className="group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <GateTypeBadge type={gate.type} />
        <GateStatusBadge status={gate.status} />
      </div>

      {/* Summary */}
      <h3 className="text-text-primary font-medium mb-2 line-clamp-2 group-hover:text-accent-teal-light transition-colors">
        {gate.summary}
      </h3>

      {/* Meta info */}
      <div className="flex items-center gap-4 text-sm text-text-secondary">
        <div className="flex items-center gap-1.5">
          <DocumentTextIcon className="h-4 w-4" />
          <span className="font-mono text-xs">{gate.session_id.slice(0, 12)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ClockIcon className="h-4 w-4" />
          <span>{formatRelativeTime(gate.created_at)}</span>
        </div>
      </div>

      {/* Artifacts count */}
      {gate.artifacts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-bg-tertiary flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            {gate.artifacts.length} artifact{gate.artifacts.length !== 1 ? 's' : ''}
          </span>
          <ArrowRightIcon className="h-4 w-4 text-text-tertiary group-hover:text-accent-teal transition-colors" />
        </div>
      )}
    </Card>
  );
}
