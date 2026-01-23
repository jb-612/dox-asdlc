import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon, HomeIcon } from '@heroicons/react/24/outline';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <ExclamationTriangleIcon className="h-16 w-16 text-status-warning mb-6" />
      <h1 className="text-4xl font-bold text-text-primary mb-2">404</h1>
      <h2 className="text-xl text-text-secondary mb-6">Page Not Found</h2>
      <p className="text-text-muted max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="flex items-center gap-2 px-6 py-3 bg-accent-teal text-text-primary rounded-lg hover:bg-accent-teal/80 transition-colors"
      >
        <HomeIcon className="h-5 w-5" />
        Return to Dashboard
      </Link>
    </div>
  );
}
