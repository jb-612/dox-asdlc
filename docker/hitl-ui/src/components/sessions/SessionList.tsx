import { useSessions } from '@/api/sessions';
import { LoadingOverlay, EmptyState } from '@/components/common';
import SessionCard from './SessionCard';
import type { SessionsQueryParams } from '@/api/types';

interface SessionListProps {
  params?: SessionsQueryParams;
}

export default function SessionList({ params }: SessionListProps) {
  const { data, isLoading, error, refetch } = useSessions(params);

  if (isLoading) {
    return <LoadingOverlay message="Loading sessions..." />;
  }

  if (error) {
    return (
      <EmptyState
        type="sessions"
        title="Failed to load sessions"
        description="There was an error loading the sessions. Please try again."
        action={
          <button onClick={() => refetch()} className="btn-primary">
            Retry
          </button>
        }
      />
    );
  }

  if (!data?.sessions.length) {
    return <EmptyState type="sessions" />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.sessions.map((session) => (
        <SessionCard key={session.session_id} session={session} />
      ))}
    </div>
  );
}
