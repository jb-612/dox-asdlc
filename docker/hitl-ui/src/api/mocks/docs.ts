/**
 * Mock data for Documentation SPA
 *
 * Provides mock documents and diagrams for development without
 * static files in public directory.
 */
import type {
  DocumentMeta,
  DiagramMeta,
  DocumentContent,
  DiagramContent,
} from '../types';

// ============================================================================
// Document Metadata
// ============================================================================

export const mockDocuments: DocumentMeta[] = [
  {
    id: 'system-design',
    title: 'System Design',
    path: 'System_Design.md',
    category: 'system',
    description: 'Core system architecture and design principles',
    lastModified: '2026-01-21',
  },
  {
    id: 'main-features',
    title: 'Main Features',
    path: 'Main_Features.md',
    category: 'feature',
    description: 'Feature specifications and capabilities',
    lastModified: '2026-01-21',
  },
  {
    id: 'development-workflow',
    title: 'Development Workflow',
    path: 'Development_Workflow.md',
    category: 'workflow',
    description: 'TDD workflow and development practices',
    lastModified: '2026-01-20',
  },
  {
    id: 'architecture-overview',
    title: 'Architecture Overview',
    path: 'Architecture_Overview.md',
    category: 'architecture',
    description: 'High-level architecture and component interactions',
    lastModified: '2026-01-18',
  },
];

// ============================================================================
// Diagram Metadata (14 diagrams from public/docs/diagrams/)
// ============================================================================

export const mockDiagrams: DiagramMeta[] = [
  {
    id: '00-reference-pipeline',
    title: 'Reference Pipeline',
    filename: '00-reference-pipeline.mmd',
    category: 'architecture',
    description: 'High-level aSDLC pipeline overview',
  },
  {
    id: '01-system-architecture',
    title: 'System Architecture',
    filename: '01-system-architecture.mmd',
    category: 'architecture',
    description: 'System component overview',
  },
  {
    id: '02-coordinator-event-loop',
    title: 'Coordinator Event Loop',
    filename: '02-coordinator-event-loop.mmd',
    category: 'architecture',
    description: 'Coordinator event processing loop',
  },
  {
    id: '03-a2a-orchestration-flow',
    title: 'A2A Orchestration Flow',
    filename: '03-a2a-orchestration-flow.mmd',
    category: 'flow',
    description: 'Agent-to-agent orchestration workflow',
  },
  {
    id: '04-agent-container-internals',
    title: 'Agent Container Internals',
    filename: '04-agent-container-internals.mmd',
    category: 'architecture',
    description: 'Internal structure of agent containers',
  },
  {
    id: '05-hitl-flow',
    title: 'HITL Flow',
    filename: '05-hitl-flow.mmd',
    category: 'flow',
    description: 'Human-in-the-loop approval workflow',
  },
  {
    id: '06-rlm-vs-rag-decision',
    title: 'RLM vs RAG Decision',
    filename: '06-rlm-vs-rag-decision.mmd',
    category: 'decision',
    description: 'Decision tree for RLM vs RAG selection',
  },
  {
    id: '07-redis-streams-eventbus',
    title: 'Redis Streams Eventbus',
    filename: '07-redis-streams-eventbus.mmd',
    category: 'architecture',
    description: 'Redis streams event bus architecture',
  },
  {
    id: '08-development-tdd-workflow',
    title: 'Development TDD Workflow',
    filename: '08-development-tdd-workflow.mmd',
    category: 'flow',
    description: 'Test-driven development workflow',
  },
  {
    id: '09-kubernetes-topology',
    title: 'Kubernetes Topology',
    filename: '09-kubernetes-topology.mmd',
    category: 'architecture',
    description: 'Kubernetes deployment topology',
  },
  {
    id: '10-mcp-integration',
    title: 'MCP Integration',
    filename: '10-mcp-integration.mmd',
    category: 'architecture',
    description: 'Model Context Protocol integration',
  },
  {
    id: '11-sequence-a2a-transition',
    title: 'A2A Transition Sequence',
    filename: '11-sequence-a2a-transition.mmd',
    category: 'sequence',
    description: 'Agent-to-agent transition sequence diagram',
  },
  {
    id: '12-sequence-hitl-flow',
    title: 'HITL Flow Sequence',
    filename: '12-sequence-hitl-flow.mmd',
    category: 'sequence',
    description: 'HITL approval sequence diagram',
  },
  {
    id: '13-sequence-mcp-calls',
    title: 'MCP Calls Sequence',
    filename: '13-sequence-mcp-calls.mmd',
    category: 'sequence',
    description: 'MCP tool call sequence diagram',
  },
  {
    id: '14-victoriametrics-monitoring',
    title: 'VictoriaMetrics Monitoring',
    filename: '14-victoriametrics-monitoring.mmd',
    category: 'architecture',
    description: 'Metrics collection and monitoring architecture',
  },
  {
    id: '15-k8s-cluster-complete',
    title: 'K8s Cluster Complete',
    filename: '15-k8s-cluster-complete.mmd',
    category: 'architecture',
    description: 'Complete Kubernetes cluster topology',
  },
  {
    id: '16-mcp-sidecar-pod-internals',
    title: 'MCP Sidecar Pod Internals',
    filename: '16-mcp-sidecar-pod-internals.mmd',
    category: 'architecture',
    description: 'MCP sidecar container internals',
  },
  {
    id: '17-sequence-mcp-sidecar-lifecycle',
    title: 'MCP Sidecar Lifecycle',
    filename: '17-sequence-mcp-sidecar-lifecycle.mmd',
    category: 'sequence',
    description: 'MCP sidecar container lifecycle sequence',
  },
  {
    id: '18-prometheus-annotation-scrape',
    title: 'Prometheus Annotation Scrape',
    filename: '18-prometheus-annotation-scrape.mmd',
    category: 'architecture',
    description: 'Prometheus scrape configuration via annotations',
  },
  {
    id: '19-mcp-sidecar-helm-toggle',
    title: 'MCP Sidecar Helm Toggle',
    filename: '19-mcp-sidecar-helm-toggle.mmd',
    category: 'architecture',
    description: 'Helm values for MCP sidecar toggle',
  },
  {
    id: '20-service-health-dashboard',
    title: 'Service Health Dashboard',
    filename: '20-service-health-dashboard.mmd',
    category: 'architecture',
    description: 'Service health monitoring dashboard components',
  },
  {
    id: '21-devops-activity-coordination',
    title: 'DevOps Activity Coordination',
    filename: '21-devops-activity-coordination.mmd',
    category: 'flow',
    description: 'DevOps activity and deployment coordination flow',
  },
];

// ============================================================================
// Mock Content
// ============================================================================

const mockSystemDesignContent = `# aSDLC System Design

**Version:** 1.1
**Date:** January 21, 2026
**Status:** Draft

## 1. Overview

This document specifies the technical architecture for an agentic SDLC system aligned to the aSDLC Master Blueprint:
- Spec Driven Development with Git-first truth
- Explicit HITL gates
- Event-driven orchestration
- Deterministic context injection via Repo Mapper
- Selective RLM execution mode for long-context tasks
- Bash-first tool abstraction with a replacement path to MCP or enterprise tool services

## 2. Core principles

1. **Git is authoritative**
   - Specs, decisions, patches, and evidence are committed.
   - Runtime state references Git SHA.

2. **Governance is isolated**
   - Only the orchestrator and governance runtime can write to protected branches.

3. **Agents are specialized and isolated**
   - Each agent invocation runs with a fresh session.
   - Workspaces are isolated per role to prevent context bleed.

## 3. High-level component model

- **Orchestrator and Governance**
  - Manager Agent (exclusive commit gateway and state machine owner)
  - HITL dispatcher and decision logger
  - Repo Mapper service (deterministic context packs)

- **Agent Worker Pool**
  - Stateless execution of domain agents
  - Horizontal scaling by adding more workers

- **Infrastructure Services**
  - Redis for event streams and task state caches
  - KnowledgeStore for retrieval augmentation
  - Tool execution sandbox
`;

const mockMainFeaturesContent = `# aSDLC Main Features

**Version:** 1.1
**Date:** January 21, 2026
**Status:** Draft

## A. Governance and traceability

1. **Git-first truth**
   - All specs, plans, reviews, patches, and gate decisions are persisted in Git.
   - Every runtime action references a Git SHA.

2. **Spec Index registry**
   - A canonical registry maps epics and tasks to required artifacts.

3. **HITL gate ladder**
   - Explicit gates from Intent through Release Authorization.
   - Every gate produces an auditable decision artifact.

## B. Event-driven orchestration

6. **State bus**
   - Event stream for cluster transitions and task execution routing.
   - Consumer groups for durability and recovery.

7. **Idempotent handlers**
   - Event processing is safe under retries and duplicate delivery.

## C. Cluster-based specialization

9. **Logical clusters**
   - Discovery, Design, Development, Validation, Deployment are logical groupings.

10. **Cognitive isolation**
    - Separate agent sessions and isolated workspaces per role.

## D. Deterministic context control

12. **Repo Mapper context packs**
    - Deterministic extraction of relevant symbols, interfaces, and dependency neighborhood.

13. **Selective long-horizon reasoning via native REPL pattern**
    - Native implementation of recursive exploration.
    - Enabled for: Repo Mapper, Arch Surveyor, Debugger, Validation agents.
`;

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get mock document content by ID
 */
export function getMockDocumentContent(docId: string): DocumentContent | null {
  const meta = mockDocuments.find((d) => d.id === docId);
  if (!meta) return null;

  let content = '';
  switch (docId) {
    case 'system-design':
      content = mockSystemDesignContent;
      break;
    case 'main-features':
      content = mockMainFeaturesContent;
      break;
    default:
      content = `# ${meta.title}\n\nContent for ${meta.title} would be loaded from ${meta.path}.`;
  }

  return { meta, content };
}

/**
 * Get mock diagram content by ID
 * Fetches the actual .mmd file from public/docs/diagrams/
 */
export async function getMockDiagramContent(
  diagramId: string
): Promise<DiagramContent | null> {
  const meta = mockDiagrams.find((d) => d.id === diagramId);
  if (!meta) return null;

  try {
    // Fetch the actual .mmd file from the public directory
    const response = await fetch(`/docs/diagrams/${meta.filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${meta.filename}`);
    }
    const content = await response.text();
    return { meta, content };
  } catch (error) {
    // Fallback to placeholder if fetch fails
    const content = `graph TD
    A[${meta.title}] --> B[Loading Failed]
    B --> C[Check console for errors]`;
    return { meta, content };
  }
}

/**
 * Get all document metadata
 */
export function listMockDocuments(): DocumentMeta[] {
  return mockDocuments;
}

/**
 * Get all diagram metadata
 */
export function listMockDiagrams(): DiagramMeta[] {
  return mockDiagrams;
}

/**
 * Filter documents by category
 */
export function filterMockDocumentsByCategory(
  category: DocumentMeta['category']
): DocumentMeta[] {
  return mockDocuments.filter((d) => d.category === category);
}

/**
 * Filter diagrams by category
 */
export function filterMockDiagramsByCategory(
  category: DiagramMeta['category']
): DiagramMeta[] {
  return mockDiagrams.filter((d) => d.category === category);
}
