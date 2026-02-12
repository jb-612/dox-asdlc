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

// DevOps Activity mocks (P06-F07)
export {
  mockCurrentActivity as mockDevOpsCurrentActivity,
  mockRecentActivities as mockDevOpsRecentActivities,
  getMockDevOpsActivity,
  getMockEmptyDevOpsActivity,
  simulateDevOpsDelay,
} from './devops';

// Service Health Dashboard mocks (P06-F07)
export {
  mockServiceHealthData,
  mockServiceConnections,
  mockSparklineData,
  getMockServicesHealth,
  getMockServiceSparkline,
  simulateDelay as simulateServiceDelay,
} from './services';

// PRD Ideation Studio mocks (P05-F11)
export {
  mockChatHistory as mockIdeationChatHistory,
  mockMaturityStates,
  mockRequirements as mockIdeationRequirements,
  mockUserStories,
  mockPRDDocument,
  generateMockIdeationResponse,
  submitMockPRD,
  getMockSessionMaturity,
  saveMockDraft,
  loadMockDraft,
  deleteMockDraft,
  listMockDrafts,
  delay as ideationDelay,
} from './ideation';

// Agent Activity Dashboard mocks (P05-F12)
export {
  mockAgents,
  getMockAgents,
  getMockAgentById,
  getMockAgentLogs,
  getMockAgentMetrics,
  getMockAgentTimeline,
  simulateAgentDelay,
} from './agents';

// Helper to check if mocks are enabled
export function areMocksEnabled(): boolean {
  return import.meta.env.VITE_USE_MOCKS === 'true';
}

// LLM Admin Configuration mocks (P05-F13)
export {
  mockProviders,
  getMockProviders,
  mockModels,
  getMockModels,
  getMockAllModels,
  getMockKeyModels,
  getMockAPIKeys,
  getMockAPIKeyById,
  getMockAPIKeysByProvider,
  addMockAPIKey,
  deleteMockAPIKey,
  testMockAPIKey,
  getMockAgentConfigs,
  getMockAgentConfig,
  updateMockAgentConfig,
  resetMockAgentConfigs,
  resetAllLLMConfigMocks,
  simulateLLMConfigDelay,
  // Integration credentials
  getMockIntegrationCredentials,
  getMockIntegrationCredentialsByType,
  getMockIntegrationCredentialById,
  addMockIntegrationCredential,
  deleteMockIntegrationCredential,
  testMockIntegrationCredential,
} from './llmConfig';

// Brainflare Hub Ideas mocks (P08-F05)
export {
  mockIdeas,
  generateMockIdea,
  simulateIdeaDelay,
} from './ideas';

// Architect Board Translation mocks (P10-F02)
export {
  mockTranslateDiagram,
  getMockPngBase64,
  getMockMermaidContent,
  getMockDrawioContent,
  delay as architectDelay,
  randomDelay as architectRandomDelay,
} from './architect';

// Swarm Review mocks (P04-F06)
export {
  mockTriggerSwarmReview,
  mockFetchSwarmStatus,
  resetMockSwarms,
  getMockSwarmState,
  simulateSwarmDelay,
} from './swarm';

// Guardrails Configuration mocks (P11-F01)
export {
  mockGuidelines,
  mockAuditEntries as mockGuardrailsAuditEntries,
  mockEvaluatedContext,
  simulateGuardrailsDelay,
  getMockGuidelinesListResponse,
  getMockAuditLogResponse,
} from './guardrailsData';

// Agent Cost Tracker mocks (P13-F01)
export {
  getMockCostSummary,
  getMockCostRecords,
  getMockSessionCosts,
  getMockPricing,
  simulateCostDelay,
} from './costs';
