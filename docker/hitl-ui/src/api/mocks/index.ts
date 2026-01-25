/**
 * Mock data layer exports
 *
 * This module provides mock data for development without a backend.
 * Enable with VITE_USE_MOCKS=true in .env.local
 */

// Agent Cockpit mocks
export {
  mockRuns,
  getMockRunDetail,
  mockKPIMetrics,
  mockWorkflowGraph,
  mockGitStates,
} from './runs';

// Discovery Studio mocks
export {
  mockChatHistory,
  mockWorkingOutline,
  mockContextPack,
  generateMockChatResponse,
  mockPRDPreview,
} from './studio';

// Artifact Management mocks
export {
  mockArtifacts,
  getMockArtifact,
  getMockVersionHistory,
  getMockProvenance,
  mockSpecIndex,
  filterMockArtifacts,
} from './artifacts';

// Event Stream mocks
export {
  mockEventHistory,
  generateMockEvent,
  filterEventsByType,
  getEventDescription,
  getEventColor,
  MockEventStream,
  mockEventStream,
} from './events';

export type { StreamEvent, EventType } from './events';

// Documentation mocks
export {
  mockDocuments,
  mockDiagrams,
  getMockDocumentContent,
  getMockDiagramContent,
  listMockDocuments,
  listMockDiagrams,
  filterMockDocumentsByCategory,
  filterMockDiagramsByCategory,
} from './docs';

// KnowledgeStore Search mocks (P05-F08)
export {
  mockSearchResults,
  mockSearchService,
  availableFileTypes,
  delay,
  randomDelay,
} from './search';

export type { SearchService } from './search';

// Kubernetes Visibility Dashboard mocks (P05-F09)
export {
  mockClusterHealth,
  mockNodes,
  mockPods,
  mockServices,
  mockIngresses,
  mockNamespaces,
  mockClusterMetrics,
  getMockMetricsHistory,
  getMockCommandResponse,
  mockHealthCheckResults,
  getMockHealthCheckResult,
  mockK8sEvents,
  filterPods,
  getNodeByName,
  getPodByName,
} from './kubernetes';

// Metrics Dashboard mocks (P05-F10)
export {
  mockServices as mockMetricsServices,
  getMockServices,
  getMockCPUMetrics,
  getMockMemoryMetrics,
  getMockRequestRateMetrics,
  getMockLatencyMetrics,
  getMockActiveTasks,
  generateMetricsTimeSeries,
  simulateDelay,
} from './metrics';

// Helper to check if mocks are enabled
export function useMocks(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}
