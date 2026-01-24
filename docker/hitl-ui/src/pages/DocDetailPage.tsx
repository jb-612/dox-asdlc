/**
 * DocDetailPage - Document detail view page
 *
 * Route: /docs/:docPath
 * Displays a single document with breadcrumb navigation, hash navigation support,
 * and 404 handling.
 */

import { useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { ArrowLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import DocViewer from '../components/docs/DocViewer';
import { useDocument } from '../api/docs';

export default function DocDetailPage() {
  const { docPath } = useParams<{ docPath: string }>();
  const location = useLocation();
  const { data: document, isLoading, error } = useDocument(docPath);

  // Handle hash navigation (scroll to section)
  useEffect(() => {
    if (!document || !location.hash) return;

    // Give the DOM time to render before scrolling
    const timeoutId = setTimeout(() => {
      const sectionId = location.hash.slice(1); // Remove the # prefix
      const element = window.document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [document, location.hash]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="h-full flex items-center justify-center bg-bg-primary"
        data-testid="doc-loading"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue mx-auto" />
          <p className="mt-4 text-text-secondary">Loading document...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (error || !document) {
    return (
      <div
        className="h-full flex items-center justify-center bg-bg-primary"
        data-testid="doc-not-found"
      >
        <div className="text-center max-w-md">
          <svg
            className="h-16 w-16 mx-auto text-text-muted opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-text-primary">
            Document Not Found
          </h2>
          <p className="mt-2 text-text-secondary">
            The document you are looking for does not exist or has been removed.
          </p>
          <Link
            to="/docs?tab=reference"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors"
            data-testid="back-to-docs"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Documentation
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary" data-testid="doc-detail-page">
      {/* Header with Breadcrumb */}
      <div className="bg-bg-secondary border-b border-border-primary px-6 py-4">
        {/* Back button */}
        <Link
          to="/docs?tab=reference"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-3"
          data-testid="back-button"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to Reference</span>
        </Link>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm" data-testid="breadcrumb">
          <Link
            to="/docs"
            className="text-text-secondary hover:text-text-primary transition-colors"
            data-testid="breadcrumb-docs"
          >
            Docs
          </Link>
          <ChevronRightIcon className="h-4 w-4 text-text-muted" />
          <Link
            to="/docs?tab=reference"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            Reference
          </Link>
          <ChevronRightIcon className="h-4 w-4 text-text-muted" />
          <span
            className="text-text-primary font-medium"
            data-testid="breadcrumb-current"
          >
            {document.meta.title}
          </span>
        </nav>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto bg-bg-secondary rounded-lg border border-border-primary p-8">
          <DocViewer document={document} showToc />
        </div>
      </div>
    </div>
  );
}
