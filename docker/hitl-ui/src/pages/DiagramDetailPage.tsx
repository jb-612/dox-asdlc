/**
 * DiagramDetailPage - Full diagram view page
 *
 * Route: /docs/diagrams/:diagramId
 * Displays a single diagram with full controls, back navigation, and 404 handling.
 */

import { useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import DiagramViewer from '../components/docs/DiagramViewer';
import { useDiagram } from '../api/docs';

export default function DiagramDetailPage() {
  const { diagramId } = useParams<{ diagramId: string }>();
  const navigate = useNavigate();
  const { data: diagram, isLoading, error } = useDiagram(diagramId);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/docs?tab=diagrams');
  }, [navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="h-full flex items-center justify-center bg-bg-primary"
        data-testid="diagram-loading"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue mx-auto" />
          <p className="mt-4 text-text-secondary">Loading diagram...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (error || !diagram) {
    return (
      <div
        className="h-full flex items-center justify-center bg-bg-primary"
        data-testid="diagram-not-found"
      >
        <div className="text-center max-w-md">
          <svg
            className="h-16 w-16 mx-auto text-text-muted opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-text-primary">
            Diagram Not Found
          </h2>
          <p className="mt-2 text-text-secondary">
            The diagram you are looking for does not exist or has been removed.
          </p>
          <Link
            to="/docs?tab=diagrams"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors"
            data-testid="back-to-diagrams"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Diagrams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary" data-testid="diagram-detail-page">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          data-testid="back-button"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to Diagrams</span>
        </button>
      </div>

      {/* Diagram Viewer */}
      <div className="flex-1 p-6">
        <DiagramViewer
          diagram={diagram}
          showControls
          className="h-full"
        />
      </div>
    </div>
  );
}
