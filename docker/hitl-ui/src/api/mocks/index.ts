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

// Helper to check if mocks are enabled
export function useMocks(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}
