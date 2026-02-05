/**
 * Swarm Review Mock Data (P04-F06)
 *
 * Mock implementation for swarm review API for development and testing.
 * Simulates realistic progress over time.
 */

import type {
  SwarmReviewRequest,
  SwarmReviewResponse,
  SwarmStatusResponse,
  UnifiedReport,
  ReviewFinding,
  ReviewerStatus,
  ReviewerType,
  Severity,
} from '../types';

// ============================================================================
// State Management
// ============================================================================

interface MockSwarmState {
  startTime: number;
  request: SwarmReviewRequest;
  reviewerTypes: ReviewerType[];
}

// Track mock swarm state
const mockSwarms = new Map<string, MockSwarmState>();

// ============================================================================
// Mock API Functions
// ============================================================================

/**
 * Mock implementation of triggering a swarm review
 */
export function mockTriggerSwarmReview(
  request: SwarmReviewRequest
): SwarmReviewResponse {
  const swarmId = `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const reviewerTypes: ReviewerType[] = request.reviewer_types || [
    'security',
    'performance',
    'style',
  ];

  mockSwarms.set(swarmId, {
    startTime: Date.now(),
    request,
    reviewerTypes,
  });

  return {
    swarm_id: swarmId,
    status: 'pending',
    poll_url: `/api/swarm/review/${swarmId}`,
  };
}

/**
 * Mock implementation of fetching swarm status
 * Simulates realistic progress over ~10 seconds
 */
export function mockFetchSwarmStatus(swarmId: string): SwarmStatusResponse {
  const swarm = mockSwarms.get(swarmId);
  if (!swarm) {
    throw new Error(`Swarm not found: ${swarmId}`);
  }

  const elapsedMs = Date.now() - swarm.startTime;
  const elapsedSeconds = elapsedMs / 1000;

  // Determine overall status based on elapsed time
  let overallStatus: SwarmStatusResponse['status'];
  if (elapsedSeconds < 1) {
    overallStatus = 'pending';
  } else if (elapsedSeconds < 8) {
    overallStatus = 'in_progress';
  } else if (elapsedSeconds < 10) {
    overallStatus = 'aggregating';
  } else {
    overallStatus = 'complete';
  }

  // Build reviewer statuses
  const reviewers: Record<string, ReviewerStatus> = {};

  swarm.reviewerTypes.forEach((type, index) => {
    // Each reviewer finishes at a slightly different time
    const reviewerOffset = index * 1.5;
    const reviewerElapsed = Math.max(0, elapsedSeconds - reviewerOffset);

    reviewers[type] = buildReviewerStatus(type, reviewerElapsed);
  });

  const response: SwarmStatusResponse = {
    swarm_id: swarmId,
    status: overallStatus,
    reviewers,
    duration_seconds: elapsedSeconds,
  };

  // Add unified report when complete
  if (overallStatus === 'complete') {
    response.unified_report = buildMockUnifiedReport(
      swarmId,
      swarm.request.target_path,
      swarm.reviewerTypes
    );
  }

  return response;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build reviewer status based on elapsed time
 */
function buildReviewerStatus(
  type: ReviewerType,
  elapsedSeconds: number
): ReviewerStatus {
  // Each reviewer takes about 6 seconds to complete
  const completionTime = 6;
  const progress = Math.min(100, (elapsedSeconds / completionTime) * 100);

  let status: ReviewerStatus['status'];
  if (elapsedSeconds < 0.5) {
    status = 'pending';
  } else if (progress < 100) {
    status = 'in_progress';
  } else {
    status = 'complete';
  }

  // Simulate finding counts based on reviewer type
  const baseFindingCount = type === 'style' ? 5 : type === 'security' ? 2 : 3;
  const findingsCount = status === 'complete' ? baseFindingCount : 0;

  return {
    status,
    files_reviewed: Math.floor((progress / 100) * 12),
    findings_count: findingsCount,
    progress_percent: Math.round(progress),
    duration_seconds: status === 'complete' ? completionTime : undefined,
  };
}

/**
 * Build mock unified report
 */
function buildMockUnifiedReport(
  swarmId: string,
  targetPath: string,
  reviewerTypes: ReviewerType[]
): UnifiedReport {
  const findings = generateMockFindings(reviewerTypes);

  // Group findings by severity
  const criticalFindings = findings.filter((f) => f.severity === 'critical');
  const highFindings = findings.filter((f) => f.severity === 'high');
  const mediumFindings = findings.filter((f) => f.severity === 'medium');
  const lowFindings = findings.filter((f) => f.severity === 'low');
  const infoFindings = findings.filter((f) => f.severity === 'info');

  // Count findings by reviewer
  const findingsByReviewer: Record<string, number> = {};
  reviewerTypes.forEach((type) => {
    findingsByReviewer[type] = findings.filter(
      (f) => f.reviewer_type === type
    ).length;
  });

  // Count findings by category
  const findingsByCategory: Record<string, number> = {};
  findings.forEach((f) => {
    findingsByCategory[f.category] = (findingsByCategory[f.category] || 0) + 1;
  });

  return {
    swarm_id: swarmId,
    target_path: targetPath,
    created_at: new Date().toISOString(),
    reviewers_completed: reviewerTypes,
    reviewers_failed: [],
    critical_findings: criticalFindings,
    high_findings: highFindings,
    medium_findings: mediumFindings,
    low_findings: lowFindings,
    info_findings: infoFindings,
    total_findings: findings.length,
    findings_by_reviewer: findingsByReviewer,
    findings_by_category: findingsByCategory,
    duplicates_removed: 1,
  };
}

/**
 * Generate mock findings for enabled reviewers
 */
function generateMockFindings(reviewerTypes: ReviewerType[]): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  let idCounter = 1;

  if (reviewerTypes.includes('security')) {
    findings.push(
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'security',
        severity: 'critical',
        category: 'security/injection',
        title: 'SQL Injection Vulnerability',
        description:
          'User input is directly interpolated into SQL query without sanitization. An attacker could execute arbitrary SQL commands.',
        file_path: 'src/api/users.py',
        line_start: 42,
        line_end: 45,
        code_snippet:
          'query = f"SELECT * FROM users WHERE id = {user_id}"\ncursor.execute(query)',
        recommendation:
          'Use parameterized queries instead of string interpolation. Example: cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))',
        confidence: 0.95,
      }),
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'security',
        severity: 'high',
        category: 'security/xss',
        title: 'Cross-Site Scripting (XSS) Risk',
        description:
          'User-provided content is rendered without proper escaping, potentially allowing script injection.',
        file_path: 'src/components/UserProfile.tsx',
        line_start: 78,
        line_end: 78,
        code_snippet:
          '<div dangerouslySetInnerHTML={{ __html: user.bio }} />',
        recommendation:
          'Sanitize HTML content before rendering using a library like DOMPurify, or avoid using dangerouslySetInnerHTML.',
        confidence: 0.88,
      })
    );
  }

  if (reviewerTypes.includes('performance')) {
    findings.push(
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'performance',
        severity: 'medium',
        category: 'performance/query',
        title: 'N+1 Query Pattern Detected',
        description:
          'Database queries are executed inside a loop, causing N+1 query performance issues.',
        file_path: 'src/api/orders.py',
        line_start: 100,
        line_end: 105,
        code_snippet:
          'for order in orders:\n    items = fetch_order_items(order.id)\n    order.items = items',
        recommendation:
          'Use eager loading or batch the queries. Consider using JOIN or prefetch_related to load all items in a single query.',
        confidence: 0.92,
      }),
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'performance',
        severity: 'low',
        category: 'performance/memory',
        title: 'Large List Materialization',
        description:
          'Using list() on a potentially large queryset loads all objects into memory at once.',
        file_path: 'src/services/export.py',
        line_start: 45,
        line_end: 45,
        code_snippet: 'all_records = list(Record.objects.all())',
        recommendation:
          'Use iterator() or chunked processing for large datasets to reduce memory usage.',
        confidence: 0.75,
      }),
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'performance',
        severity: 'info',
        category: 'performance/caching',
        title: 'Consider Caching Expensive Computation',
        description:
          'This function performs an expensive computation that could benefit from caching.',
        file_path: 'src/utils/calculations.py',
        line_start: 120,
        line_end: 140,
        code_snippet: 'def calculate_complex_metrics(data):\n    ...',
        recommendation:
          'Consider using functools.lru_cache or Redis caching for frequently accessed results.',
        confidence: 0.65,
      })
    );
  }

  if (reviewerTypes.includes('style')) {
    findings.push(
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'style',
        severity: 'low',
        category: 'style/naming',
        title: 'Inconsistent Naming Convention',
        description:
          'Variable name does not follow the project naming conventions. Expected snake_case for Python variables.',
        file_path: 'src/api/handlers.py',
        line_start: 55,
        line_end: 55,
        code_snippet: 'userData = get_user_data(user_id)',
        recommendation:
          'Rename variable to user_data to follow Python naming conventions (PEP 8).',
        confidence: 0.98,
      }),
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'style',
        severity: 'info',
        category: 'style/complexity',
        title: 'High Cyclomatic Complexity',
        description:
          'This function has a cyclomatic complexity of 12, which exceeds the recommended maximum of 10.',
        file_path: 'src/services/processor.py',
        line_start: 80,
        line_end: 130,
        code_snippet:
          'def process_order(order):\n    if order.type == "A":\n        ...',
        recommendation:
          'Consider refactoring into smaller functions or using a strategy pattern to reduce complexity.',
        confidence: 0.85,
      }),
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'style',
        severity: 'info',
        category: 'style/documentation',
        title: 'Missing Docstring',
        description: 'Public function lacks documentation describing its purpose, parameters, and return value.',
        file_path: 'src/api/endpoints.py',
        line_start: 25,
        line_end: 35,
        code_snippet:
          'def update_user_settings(user_id, settings):\n    ...',
        recommendation:
          'Add a docstring following the project documentation style (Google style or NumPy style).',
        confidence: 0.95,
      }),
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'style',
        severity: 'low',
        category: 'style/imports',
        title: 'Unused Import',
        description: 'Module is imported but never used in this file.',
        file_path: 'src/utils/helpers.py',
        line_start: 3,
        line_end: 3,
        code_snippet: 'from datetime import timedelta',
        recommendation:
          'Remove the unused import to keep the code clean.',
        confidence: 0.99,
      }),
      createFinding({
        id: `finding-${idCounter++}`,
        reviewer_type: 'style',
        severity: 'info',
        category: 'style/formatting',
        title: 'Line Too Long',
        description: 'Line exceeds the maximum recommended length of 100 characters.',
        file_path: 'src/config/settings.py',
        line_start: 88,
        line_end: 88,
        code_snippet:
          'DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://localhost:5432/mydb?sslmode=require&connect_timeout=30")',
        recommendation:
          'Break the line into multiple lines or use a configuration variable.',
        confidence: 0.95,
      })
    );
  }

  return findings;
}

/**
 * Helper to create a finding with all required fields
 */
function createFinding(
  partial: Partial<ReviewFinding> & { id: string; reviewer_type: ReviewerType }
): ReviewFinding {
  return {
    severity: 'medium',
    category: 'general',
    title: 'Finding',
    description: 'Description',
    file_path: 'file.py',
    line_start: null,
    line_end: null,
    code_snippet: null,
    recommendation: 'Recommendation',
    confidence: 0.8,
    ...partial,
  } as ReviewFinding;
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Reset all mock swarm state (for testing)
 */
export function resetMockSwarms(): void {
  mockSwarms.clear();
}

/**
 * Get the current mock swarm state (for testing)
 */
export function getMockSwarmState(swarmId: string): MockSwarmState | undefined {
  return mockSwarms.get(swarmId);
}

/**
 * Simulate delay for mock API calls
 */
export function simulateSwarmDelay(
  minMs: number = 50,
  maxMs: number = 150
): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}
