/**
 * Mock data for KnowledgeStore Search UI (P05-F08)
 *
 * Provides mock search results and service implementation
 * for development without a backend.
 */
import type {
  KSSearchResult,
  KSDocument,
  SearchResponse,
  KSHealthStatus,
  SearchQuery,
  ReindexRequest,
  ReindexResponse,
  ReindexStatus,
} from '../types';
import { registerSearchService, type SearchService } from '../searchService';

// ============================================================================
// Mock Search Results (15+ diverse entries)
// ============================================================================

export const mockSearchResults: KSSearchResult[] = [
  // Python files
  {
    docId: 'src/core/interfaces.py:0',
    content: 'class KnowledgeStore(Protocol):\n    """Protocol for knowledge store backends.\n\n    Defines the interface that all knowledge store implementations must follow.',
    metadata: {
      file_path: 'src/core/interfaces.py',
      file_type: '.py',
      language: 'python',
      line_start: 14,
      line_end: 42,
      indexed_at: '2026-01-25T10:00:00Z',
    },
    score: 0.95,
    source: 'mock',
  },
  {
    docId: 'src/infrastructure/knowledge_store/elasticsearch_store.py:0',
    content: 'class ElasticsearchStore:\n    """Elasticsearch implementation of KnowledgeStore protocol.\n\n    Provides vector storage and semantic search using Elasticsearch',
    metadata: {
      file_path: 'src/infrastructure/knowledge_store/elasticsearch_store.py',
      file_type: '.py',
      language: 'python',
      line_start: 28,
      line_end: 95,
      indexed_at: '2026-01-25T10:00:00Z',
    },
    score: 0.89,
    source: 'mock',
  },
  {
    docId: 'src/workers/agent_worker.py:0',
    content: 'class AgentWorker:\n    """Stateless worker that executes agent tasks.\n\n    Pulls tasks from Redis stream and executes them with Claude Agent SDK.',
    metadata: {
      file_path: 'src/workers/agent_worker.py',
      file_type: '.py',
      language: 'python',
      line_start: 1,
      line_end: 85,
      indexed_at: '2026-01-24T15:30:00Z',
    },
    score: 0.82,
    source: 'mock',
  },
  {
    docId: 'src/orchestrator/coordinator.py:0',
    content: 'class Coordinator:\n    """Main orchestrator that manages agent lifecycle.\n\n    Handles task distribution, HITL gates, and state management.',
    metadata: {
      file_path: 'src/orchestrator/coordinator.py',
      file_type: '.py',
      language: 'python',
      line_start: 1,
      line_end: 150,
      indexed_at: '2026-01-24T14:00:00Z',
    },
    score: 0.78,
    source: 'mock',
  },
  {
    docId: 'src/core/events.py:0',
    content: '@dataclass\nclass Event:\n    """Base event class for Redis streams.\n\n    All events must have an event_id and timestamp.',
    metadata: {
      file_path: 'src/core/events.py',
      file_type: '.py',
      language: 'python',
      line_start: 10,
      line_end: 45,
      indexed_at: '2026-01-23T09:00:00Z',
    },
    score: 0.75,
    source: 'mock',
  },
  // TypeScript files
  {
    docId: 'docker/hitl-ui/src/api/types.ts:0',
    content: 'export interface GateRequest {\n  id: string;\n  type: GateType;\n  session_id: string;\n  status: GateStatus;',
    metadata: {
      file_path: 'docker/hitl-ui/src/api/types.ts',
      file_type: '.ts',
      language: 'typescript',
      line_start: 29,
      line_end: 41,
      indexed_at: '2026-01-25T11:00:00Z',
    },
    score: 0.88,
    source: 'mock',
  },
  {
    docId: 'docker/hitl-ui/src/api/gates.ts:0',
    content: 'export async function fetchGates(params?: GatesQueryParams): Promise<GatesResponse> {\n  const response = await apiClient.get("/gates", { params });',
    metadata: {
      file_path: 'docker/hitl-ui/src/api/gates.ts',
      file_type: '.ts',
      language: 'typescript',
      line_start: 15,
      line_end: 30,
      indexed_at: '2026-01-25T11:00:00Z',
    },
    score: 0.84,
    source: 'mock',
  },
  {
    docId: 'docker/hitl-ui/src/stores/gateStore.ts:0',
    content: 'export const useGateStore = create<GateState>()(\n  persist(\n    (set, get) => ({\n      gates: [],',
    metadata: {
      file_path: 'docker/hitl-ui/src/stores/gateStore.ts',
      file_type: '.ts',
      language: 'typescript',
      line_start: 8,
      line_end: 55,
      indexed_at: '2026-01-24T16:00:00Z',
    },
    score: 0.79,
    source: 'mock',
  },
  // TSX files
  {
    docId: 'docker/hitl-ui/src/components/gates/GateCard.tsx:0',
    content: 'export default function GateCard({ gate, onApprove, onReject }: GateCardProps) {\n  return (\n    <Card className="hover:ring-2">',
    metadata: {
      file_path: 'docker/hitl-ui/src/components/gates/GateCard.tsx',
      file_type: '.tsx',
      language: 'typescript',
      line_start: 25,
      line_end: 80,
      indexed_at: '2026-01-25T12:00:00Z',
    },
    score: 0.86,
    source: 'mock',
  },
  {
    docId: 'docker/hitl-ui/src/components/common/Button.tsx:0',
    content: 'export default function Button({ variant = "primary", size = "md", children, ...props }: ButtonProps) {\n  return <button className={clsx(baseStyles, variants[variant])}>',
    metadata: {
      file_path: 'docker/hitl-ui/src/components/common/Button.tsx',
      file_type: '.tsx',
      language: 'typescript',
      line_start: 30,
      line_end: 65,
      indexed_at: '2026-01-24T10:00:00Z',
    },
    score: 0.72,
    source: 'mock',
  },
  {
    docId: 'docker/hitl-ui/src/pages/CockpitPage.tsx:0',
    content: 'export default function CockpitPage() {\n  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);\n  return (\n    <div className="flex flex-col gap-6">',
    metadata: {
      file_path: 'docker/hitl-ui/src/pages/CockpitPage.tsx',
      file_type: '.tsx',
      language: 'typescript',
      line_start: 12,
      line_end: 95,
      indexed_at: '2026-01-25T09:00:00Z',
    },
    score: 0.81,
    source: 'mock',
  },
  // Markdown files
  {
    docId: 'docs/System_Design.md:0',
    content: '# aSDLC System Design\n\n**Version:** 1.1\n**Date:** January 21, 2026\n\nThis document specifies the technical architecture for an agentic SDLC system.',
    metadata: {
      file_path: 'docs/System_Design.md',
      file_type: '.md',
      language: 'markdown',
      line_start: 1,
      line_end: 50,
      indexed_at: '2026-01-21T12:00:00Z',
    },
    score: 0.92,
    source: 'mock',
  },
  {
    docId: 'docs/Main_Features.md:0',
    content: '# aSDLC Main Features\n\n## A. Governance and traceability\n\n1. **Git-first truth** - All specs, plans, reviews, patches, and gate decisions are persisted in Git.',
    metadata: {
      file_path: 'docs/Main_Features.md',
      file_type: '.md',
      language: 'markdown',
      line_start: 1,
      line_end: 45,
      indexed_at: '2026-01-21T12:00:00Z',
    },
    score: 0.90,
    source: 'mock',
  },
  {
    docId: 'README.md:0',
    content: '# aSDLC Project\n\nAgentic Software Development Lifecycle using Claude Agent SDK, Redis coordination, and bash tools.',
    metadata: {
      file_path: 'README.md',
      file_type: '.md',
      language: 'markdown',
      line_start: 1,
      line_end: 30,
      indexed_at: '2026-01-20T08:00:00Z',
    },
    score: 0.70,
    source: 'mock',
  },
  // JSON files
  {
    docId: 'contracts/current/hitl_api.json:0',
    content: '{\n  "openapi": "3.0.0",\n  "info": {\n    "title": "HITL API",\n    "version": "1.0.0"\n  }',
    metadata: {
      file_path: 'contracts/current/hitl_api.json',
      file_type: '.json',
      language: 'json',
      line_start: 1,
      line_end: 100,
      indexed_at: '2026-01-22T14:00:00Z',
    },
    score: 0.77,
    source: 'mock',
  },
  {
    docId: 'package.json:0',
    content: '{\n  "name": "hitl-ui",\n  "version": "0.1.0",\n  "dependencies": {\n    "react": "^18.2.0"',
    metadata: {
      file_path: 'docker/hitl-ui/package.json',
      file_type: '.json',
      language: 'json',
      line_start: 1,
      line_end: 50,
      indexed_at: '2026-01-25T08:00:00Z',
    },
    score: 0.65,
    source: 'mock',
  },
];

// ============================================================================
// Mock Documents (full content)
// ============================================================================

export const mockDocuments: Record<string, KSDocument> = {
  'src/core/interfaces.py:0': {
    docId: 'src/core/interfaces.py:0',
    content: `"""Core interfaces and protocols for the aSDLC system.

This module defines the abstract interfaces that all implementations must follow.
"""

from typing import Protocol, Any
from dataclasses import dataclass


@dataclass
class SearchResult:
    """Result from a knowledge store search."""
    doc_id: str
    content: str
    metadata: dict[str, Any]
    score: float
    source: str


@dataclass
class Document:
    """A document in the knowledge store."""
    doc_id: str
    content: str
    metadata: dict[str, Any]
    embedding: list[float] | None = None


class KnowledgeStore(Protocol):
    """Protocol for knowledge store backends.

    Defines the interface that all knowledge store implementations must follow.
    Implementations may use Elasticsearch, ChromaDB, or other vector stores.
    """

    async def search(
        self,
        query: str,
        top_k: int = 10,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """Search for documents matching the query."""
        ...

    async def get_by_id(self, doc_id: str) -> Document | None:
        """Retrieve a document by its ID."""
        ...

    async def health_check(self) -> dict[str, Any]:
        """Check the health of the knowledge store."""
        ...
`,
    metadata: {
      file_path: 'src/core/interfaces.py',
      file_type: '.py',
      language: 'python',
      indexed_at: '2026-01-25T10:00:00Z',
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simulate network latency
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get random delay between min and max milliseconds
 */
export function randomDelay(min: number = 100, max: number = 500): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return delay(ms);
}

// ============================================================================
// Mock Search Service Implementation
// ============================================================================

export const mockSearchService: SearchService = {
  async search(query: SearchQuery): Promise<SearchResponse> {
    await randomDelay(200, 400); // Simulate network latency

    if (!query.query.trim()) {
      return {
        results: [],
        total: 0,
        query: query.query,
        took_ms: 5,
      };
    }

    const startTime = Date.now();
    const lowerQuery = query.query.toLowerCase();

    // Filter results based on query
    let filtered = mockSearchResults.filter((result) => {
      // Check content match
      const contentMatch = result.content.toLowerCase().includes(lowerQuery);

      // Check file path match
      const pathMatch = result.metadata.file_path?.toLowerCase().includes(lowerQuery) ?? false;

      return contentMatch || pathMatch;
    });

    // Apply file type filters
    if (query.filters?.fileTypes?.length) {
      filtered = filtered.filter((result) =>
        query.filters!.fileTypes!.includes(result.metadata.file_type ?? '')
      );
    }

    // Apply date filters
    if (query.filters?.dateFrom) {
      const fromDate = new Date(query.filters.dateFrom);
      filtered = filtered.filter((result) => {
        const indexedAt = result.metadata.indexed_at;
        if (!indexedAt) return true;
        return new Date(indexedAt) >= fromDate;
      });
    }

    if (query.filters?.dateTo) {
      const toDate = new Date(query.filters.dateTo);
      filtered = filtered.filter((result) => {
        const indexedAt = result.metadata.indexed_at;
        if (!indexedAt) return true;
        return new Date(indexedAt) <= toDate;
      });
    }

    // Sort by score
    filtered.sort((a, b) => b.score - a.score);

    // Apply topK limit
    const topK = query.topK ?? 10;
    const results = filtered.slice(0, topK);

    return {
      results,
      total: filtered.length,
      query: query.query,
      took_ms: Date.now() - startTime,
    };
  },

  async getDocument(docId: string): Promise<KSDocument | null> {
    await randomDelay(50, 150); // Simulate network latency

    // Check mock documents first
    if (mockDocuments[docId]) {
      return mockDocuments[docId];
    }

    // Try to find in search results and create a document
    const result = mockSearchResults.find((r) => r.docId === docId);
    if (!result) return null;

    return {
      docId: result.docId,
      content: result.content,
      metadata: result.metadata,
    };
  },

  async healthCheck(): Promise<KSHealthStatus> {
    await delay(50);

    return {
      status: 'healthy',
      backend: 'mock',
      index_count: 1,
      document_count: mockSearchResults.length,
    };
  },
};

// ============================================================================
// Available file types for filter UI
// ============================================================================

export const availableFileTypes = ['.py', '.ts', '.tsx', '.md', '.json'];

// ============================================================================
// Register mock service with factory
// ============================================================================

registerSearchService('mock', mockSearchService);

// ============================================================================
// Mock Reindex Functions
// ============================================================================

// Mock state for reindex simulation
let mockReindexState: ReindexStatus = {
  status: 'idle',
  job_id: undefined,
  progress: undefined,
  files_indexed: undefined,
  total_files: undefined,
  error: undefined,
  started_at: undefined,
  completed_at: undefined,
};

let mockReindexTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Mock trigger reindex - simulates background indexing
 */
export async function mockTriggerReindex(_request: ReindexRequest = {}): Promise<ReindexResponse> {
  await randomDelay(100, 200);

  if (mockReindexState.status === 'running') {
    return {
      status: 'already_running',
      job_id: mockReindexState.job_id,
      message: 'Reindexing is already in progress',
    };
  }

  // Start mock reindex
  const jobId = `mock-${Date.now().toString(36)}`;
  mockReindexState = {
    status: 'running',
    job_id: jobId,
    progress: 0,
    files_indexed: 0,
    total_files: mockSearchResults.length,
    error: undefined,
    started_at: new Date().toISOString(),
    completed_at: undefined,
  };

  // Simulate progress updates
  let progress = 0;
  const updateProgress = () => {
    if (mockReindexState.status !== 'running') return;

    progress += 10;
    if (progress >= 100) {
      mockReindexState = {
        ...mockReindexState,
        status: 'completed',
        progress: 100,
        files_indexed: mockSearchResults.length,
        completed_at: new Date().toISOString(),
      };
    } else {
      mockReindexState = {
        ...mockReindexState,
        progress,
        files_indexed: Math.floor((progress / 100) * mockSearchResults.length),
      };
      mockReindexTimeout = setTimeout(updateProgress, 500);
    }
  };

  mockReindexTimeout = setTimeout(updateProgress, 500);

  return {
    status: 'started',
    job_id: jobId,
    message: 'Mock reindexing started',
  };
}

/**
 * Mock get reindex status
 */
export async function mockGetReindexStatus(): Promise<ReindexStatus> {
  await delay(50);
  return { ...mockReindexState };
}

/**
 * Reset mock reindex state (for testing)
 */
export function resetMockReindexState(): void {
  if (mockReindexTimeout) {
    clearTimeout(mockReindexTimeout);
    mockReindexTimeout = null;
  }
  mockReindexState = {
    status: 'idle',
    job_id: undefined,
    progress: undefined,
    files_indexed: undefined,
    total_files: undefined,
    error: undefined,
    started_at: undefined,
    completed_at: undefined,
  };
}
