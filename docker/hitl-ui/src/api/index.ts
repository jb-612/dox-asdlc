// API client and types
export { apiClient } from './client';
export * from './types';

// React Query hooks
export {
  usePendingGates,
  useGateDetail,
  useGateDecision,
  useArtifactContent,
  gateKeys,
} from './gates';

export { useWorkerPoolStatus, workerKeys } from './workers';

export { useSessions, useSessionDetail, sessionKeys } from './sessions';

// Search hooks and services
export {
  useSearch,
  useDocument,
  useKnowledgeHealth,
  searchKeys,
} from './searchHooks';
export {
  getSearchService,
  getDefaultBackendMode,
  type SearchService,
} from './searchService';

// Mocks (for development)
export { gateTypeBadgeVariant } from './mocks';
export { mockSearchService, mockSearchResults } from './mocks/search';
