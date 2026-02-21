/**
 * SearchPage - Route wrapper for Knowledge Search
 *
 * This page provides the KnowledgeStore search interface for
 * semantic search across indexed codebase documents.
 *
 * Part of P05-F08 ELK Search UI
 */

import { SearchPage as SearchPageComponent } from '../components/search';

export interface SearchPageProps {
  /** Custom class name */
  className?: string;
}

export default function SearchPage() {
  return <SearchPageComponent />;
}
