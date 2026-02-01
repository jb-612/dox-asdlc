/**
 * Mock data for Classification API (P08-F03)
 *
 * Provides mock taxonomy, labels, and classification results for development.
 */

import type {
  LabelDefinition,
  LabelTaxonomy,
  ClassificationResult,
  ClassificationJob,
  ClassificationJobStatus,
} from '../../types/classification';
import { DEFAULT_LABELS } from '../../types/classification';

// ============================================================================
// Mock Taxonomy
// ============================================================================

let mockTaxonomy: LabelTaxonomy = {
  id: 'default-taxonomy',
  name: 'Default Taxonomy',
  description: 'Standard labels for idea classification',
  labels: [...DEFAULT_LABELS],
  version: '1.0.0',
  created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Simulate network delay
 */
export async function simulateClassificationDelay(minMs = 100, maxMs = 300): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================================================
// Taxonomy Operations
// ============================================================================

export function getMockTaxonomy(): LabelTaxonomy {
  return { ...mockTaxonomy, labels: [...mockTaxonomy.labels] };
}

export function getMockLabels(): LabelDefinition[] {
  return [...mockTaxonomy.labels];
}

export function getMockLabelById(id: string): LabelDefinition | undefined {
  return mockTaxonomy.labels.find((l) => l.id === id);
}

export function addMockLabel(label: Omit<LabelDefinition, 'id'> & { id?: string }): LabelDefinition {
  const newLabel: LabelDefinition = {
    id: label.id || `label-${Date.now()}`,
    name: label.name,
    description: label.description,
    keywords: label.keywords,
    color: label.color,
  };
  mockTaxonomy = {
    ...mockTaxonomy,
    labels: [...mockTaxonomy.labels, newLabel],
    updated_at: new Date().toISOString(),
  };
  return newLabel;
}

export function updateMockLabel(id: string, updates: Partial<LabelDefinition>): LabelDefinition | undefined {
  const index = mockTaxonomy.labels.findIndex((l) => l.id === id);
  if (index === -1) return undefined;

  const updated: LabelDefinition = {
    ...mockTaxonomy.labels[index],
    ...updates,
    id, // Ensure ID cannot be changed
  };

  mockTaxonomy = {
    ...mockTaxonomy,
    labels: [
      ...mockTaxonomy.labels.slice(0, index),
      updated,
      ...mockTaxonomy.labels.slice(index + 1),
    ],
    updated_at: new Date().toISOString(),
  };

  return updated;
}

export function deleteMockLabel(id: string): boolean {
  const initialLength = mockTaxonomy.labels.length;
  mockTaxonomy = {
    ...mockTaxonomy,
    labels: mockTaxonomy.labels.filter((l) => l.id !== id),
    updated_at: new Date().toISOString(),
  };
  return mockTaxonomy.labels.length < initialLength;
}

export function updateMockTaxonomy(updates: Partial<LabelTaxonomy>): LabelTaxonomy {
  mockTaxonomy = {
    ...mockTaxonomy,
    ...updates,
    id: mockTaxonomy.id, // ID cannot be changed
    updated_at: new Date().toISOString(),
  };
  return getMockTaxonomy();
}

// ============================================================================
// Classification Operations
// ============================================================================

const mockClassificationResults: Map<string, ClassificationResult> = new Map([
  [
    'idea-001',
    {
      idea_id: 'idea-001',
      classification: 'functional',
      confidence: 0.92,
      labels: ['feature', 'enhancement'],
      reasoning: 'This idea describes a user-facing feature improvement.',
      model_version: '1.0.0',
    },
  ],
  [
    'idea-002',
    {
      idea_id: 'idea-002',
      classification: 'non_functional',
      confidence: 0.87,
      labels: ['performance'],
      reasoning: 'This idea focuses on backend performance optimization.',
      model_version: '1.0.0',
    },
  ],
  [
    'idea-003',
    {
      idea_id: 'idea-003',
      classification: 'functional',
      confidence: 0.95,
      labels: ['feature'],
      reasoning: 'This idea proposes new functionality for users.',
      model_version: '1.0.0',
    },
  ],
]);

export function getMockClassificationResult(ideaId: string): ClassificationResult | undefined {
  return mockClassificationResults.get(ideaId);
}

export function classifyMockIdea(ideaId: string): ClassificationResult {
  // Simulate classification
  const classifications: Array<'functional' | 'non_functional' | 'undetermined'> = [
    'functional',
    'non_functional',
    'undetermined',
  ];
  const labels = mockTaxonomy.labels;
  const randomLabels = labels
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(Math.random() * 3) + 1)
    .map((l) => l.id);

  const result: ClassificationResult = {
    idea_id: ideaId,
    classification: classifications[Math.floor(Math.random() * classifications.length)],
    confidence: 0.7 + Math.random() * 0.25,
    labels: randomLabels,
    reasoning: 'Classification based on content analysis.',
    model_version: '1.0.0',
  };

  mockClassificationResults.set(ideaId, result);
  return result;
}

// ============================================================================
// Batch Classification Jobs
// ============================================================================

const mockJobs: Map<string, ClassificationJob> = new Map();

export function createMockBatchJob(ideaIds: string[]): ClassificationJob {
  const job: ClassificationJob = {
    job_id: `job-${Date.now()}`,
    status: 'pending',
    total: ideaIds.length,
    completed: 0,
    failed: 0,
    created_at: new Date().toISOString(),
  };

  mockJobs.set(job.job_id, job);

  // Simulate processing
  setTimeout(() => {
    const currentJob = mockJobs.get(job.job_id);
    if (currentJob) {
      mockJobs.set(job.job_id, {
        ...currentJob,
        status: 'processing',
      });
    }
  }, 500);

  setTimeout(() => {
    const currentJob = mockJobs.get(job.job_id);
    if (currentJob) {
      // Classify each idea
      ideaIds.forEach((id) => classifyMockIdea(id));

      mockJobs.set(job.job_id, {
        ...currentJob,
        status: 'completed',
        completed: ideaIds.length,
      });
    }
  }, 2000);

  return job;
}

export function getMockJob(jobId: string): ClassificationJob | undefined {
  return mockJobs.get(jobId);
}

// ============================================================================
// Reset Mock Data
// ============================================================================

export function resetMockClassificationData(): void {
  mockTaxonomy = {
    id: 'default-taxonomy',
    name: 'Default Taxonomy',
    description: 'Standard labels for idea classification',
    labels: [...DEFAULT_LABELS],
    version: '1.0.0',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockClassificationResults.clear();
  mockJobs.clear();
}
