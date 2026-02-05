# P04-F06: Code Review Page UI - Technical Design

## Overview

The Code Review Page UI provides a comprehensive interface for triggering parallel code reviews and visualizing results from the Parallel Review Swarm (P04-F05). It enables users to configure review parameters, monitor real-time progress of three parallel reviewers (Security, Performance, Style), and interact with findings through actions like GitHub issue creation.

## Goals

1. **Intuitive Review Configuration**: Simple input controls for target selection and reviewer toggles
2. **Real-Time Progress Visualization**: Three-lane progress view with CLI-mimic output
3. **Actionable Results**: Findings grouped by severity with per-finding and bulk actions
4. **GitHub Integration**: Seamless issue creation with repository picker and label assignment
5. **Consistent UX**: Match existing HITL UI patterns using established components

## Architecture

```
+------------------------------------------------------------------+
|                    Code Review Page                               |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------------+  +-----------------------------------+|
|  |    Review Input        |  |     Progress / Results           ||
|  +------------------------+  +-----------------------------------+|
|  | - Target Input         |  |  [ReviewProgress]                ||
|  | - Scope Selector       |  |    - Three-Lane View             ||
|  | - Reviewer Toggles     |  |    - CLI Mimic                   ||
|  | - Custom Path          |  |    - Token/Cost Counter          ||
|  | - Start Button         |  |                                  ||
|  +------------------------+  |  [ReviewResults] (after complete)||
|                              |    - Severity Summary             ||
|                              |    - Findings List                ||
|                              |    - Actions                      ||
|                              +-----------------------------------+|
|                                                                   |
+------------------------------------------------------------------+
                              |
                              v
                    [GitHub Integration Modal]
                    - Repository Picker
                    - Label Assignment
                    - Issue Preview
```

## Component Breakdown

### 1. Page Component (`src/pages/CodeReviewPage.tsx`)

Top-level page component that orchestrates the review workflow.

```typescript
interface CodeReviewPageState {
  phase: 'input' | 'progress' | 'results';
  swarmId: string | null;
}
```

### 2. Review Input Panel (`src/components/review/ReviewInputPanel.tsx`)

Collects review configuration from user.

```typescript
interface ReviewInputPanelProps {
  onStartReview: (config: ReviewConfig) => void;
  isLoading: boolean;
}

interface ReviewConfig {
  target: string;              // repo URL, PR number, or branch
  scope: 'full_repo' | 'changed_files' | 'custom_path';
  customPath?: string;
  reviewers: {
    security: boolean;
    performance: boolean;
    style: boolean;
  };
}
```

**Sub-components:**
- `TargetInput` - Text input with validation for repo/PR/branch
- `ScopeSelector` - Radio group or segmented control
- `ReviewerToggles` - Three toggle switches with descriptions
- `CustomPathInput` - Conditional text input

### 3. Review Progress Panel (`src/components/review/ReviewProgressPanel.tsx`)

Displays real-time progress during review execution.

```typescript
interface ReviewProgressPanelProps {
  swarmId: string;
  onComplete: () => void;
}
```

**Sub-components:**
- `ThreeLaneView` - Parallel progress indicators for each reviewer
- `CLIMimicView` - Terminal-style output display
- `TokenCostCounter` - Real-time token/cost metrics

### 4. Three-Lane View (`src/components/review/ThreeLaneView.tsx`)

Visual representation of parallel reviewer progress.

```typescript
interface ThreeLaneViewProps {
  reviewers: ReviewerProgress[];
}

interface ReviewerProgress {
  type: 'security' | 'performance' | 'style';
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  progress: number;  // 0-100
  filesReviewed: number;
  findingsCount: number;
  durationSeconds?: number;
}
```

### 5. CLI Mimic View (`src/components/review/CLIMimicView.tsx`)

Terminal-like output showing agent activity.

```typescript
interface CLIMimicViewProps {
  entries: CLIEntry[];
  maxLines?: number;
}

interface CLIEntry {
  timestamp: string;
  reviewer: 'security' | 'performance' | 'style' | 'system';
  message: string;
  type: 'info' | 'progress' | 'finding' | 'error';
}
```

### 6. Token/Cost Counter (`src/components/review/TokenCostCounter.tsx`)

Real-time metrics display.

```typescript
interface TokenCostCounterProps {
  tokensUsed: number;
  estimatedCost: number;
  isRunning: boolean;
}
```

### 7. Review Results Panel (`src/components/review/ReviewResultsPanel.tsx`)

Displays aggregated review findings after completion.

```typescript
interface ReviewResultsPanelProps {
  swarmId: string;
  onCreateIssue: (finding: ReviewFinding) => void;
  onBulkCreateIssues: (findings: ReviewFinding[]) => void;
  onDownloadReport: (format: 'markdown' | 'pdf') => void;
}
```

**Sub-components:**
- `SeveritySummary` - Traffic light display
- `FindingsList` - Grouped findings with actions
- `BulkActionsBar` - Top bar with bulk operations

### 8. Severity Summary (`src/components/review/SeveritySummary.tsx`)

Traffic light visualization of finding severity distribution.

```typescript
interface SeveritySummaryProps {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}
```

### 9. Finding Card (`src/components/review/FindingCard.tsx`)

Individual finding display with actions.

```typescript
interface FindingCardProps {
  finding: ReviewFinding;
  onCreateIssue: () => void;
  onCopy: () => void;
  onIgnore: () => void;
  isSelected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

// From P04-F05 design
interface ReviewFinding {
  id: string;
  reviewer_type: 'security' | 'performance' | 'style';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  code_snippet: string | null;
  recommendation: string;
  confidence: number;
}
```

### 10. Code Snippet Display (`src/components/review/CodeSnippetDisplay.tsx`)

Syntax-highlighted code snippet with line numbers.

```typescript
interface CodeSnippetDisplayProps {
  code: string;
  language?: string;
  lineStart?: number;
  highlightLines?: number[];
}
```

### 11. GitHub Integration Modal (`src/components/review/GitHubIssueModal.tsx`)

Modal for creating GitHub issues from findings.

```typescript
interface GitHubIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  findings: ReviewFinding[];
  mode: 'single' | 'bulk';
}

interface GitHubIssueConfig {
  repository: string;
  labels: string[];
  titleTemplate: string;
  bodyTemplate: string;
}
```

**Sub-components:**
- `RepositoryPicker` - Dropdown with repo search
- `LabelSelector` - Multi-select for labels
- `IssuePreview` - Preview of issue content

## State Management

### Review Store (`src/stores/reviewStore.ts`)

Zustand store for managing review state.

```typescript
interface ReviewState {
  // Current review
  currentSwarmId: string | null;
  phase: 'idle' | 'configuring' | 'running' | 'complete' | 'error';
  config: ReviewConfig | null;

  // Progress tracking
  reviewerProgress: Record<string, ReviewerProgress>;
  cliEntries: CLIEntry[];
  tokensUsed: number;
  estimatedCost: number;

  // Results
  results: UnifiedReport | null;
  selectedFindings: Set<string>;
  ignoredFindings: Set<string>;

  // Actions
  startReview: (config: ReviewConfig) => Promise<string>;
  updateProgress: (progress: ReviewerProgress) => void;
  addCLIEntry: (entry: CLIEntry) => void;
  setResults: (results: UnifiedReport) => void;
  toggleFindingSelection: (findingId: string) => void;
  selectAllFindings: () => void;
  clearSelection: () => void;
  ignoreFinding: (findingId: string) => void;
  reset: () => void;
}
```

## API Integration

### API Client (`src/api/swarm.ts`)

TanStack Query hooks for swarm API.

```typescript
// Query keys
export const swarmKeys = {
  all: ['swarm'] as const,
  status: (id: string) => [...swarmKeys.all, 'status', id] as const,
  results: (id: string) => [...swarmKeys.all, 'results', id] as const,
};

// Hooks
export function useSwarmReview(): UseMutationResult<SwarmResponse, Error, ReviewConfig>;
export function useSwarmStatus(swarmId: string | null): UseQueryResult<SwarmStatusResponse>;
export function useSwarmResults(swarmId: string): UseQueryResult<UnifiedReport>;
```

### API Types

```typescript
// Request to POST /api/swarm/review
interface SwarmReviewRequest {
  target_path: string;
  reviewer_types: string[];
  timeout_seconds?: number;
}

// Response from POST /api/swarm/review
interface SwarmReviewResponse {
  swarm_id: string;
  status: 'pending' | 'in_progress';
  poll_url: string;
}

// Response from GET /api/swarm/review/{swarm_id}
interface SwarmStatusResponse {
  swarm_id: string;
  status: 'pending' | 'in_progress' | 'aggregating' | 'complete' | 'failed';
  reviewers: Record<string, ReviewerStatus>;
  unified_report?: UnifiedReport;
  duration_seconds?: number;
  error_message?: string;
}

interface ReviewerStatus {
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  files_reviewed: number;
  findings_count: number;
  progress_percent: number;
  duration_seconds?: number;
}
```

### Polling Strategy

```typescript
// Poll swarm status while running
useQuery({
  queryKey: swarmKeys.status(swarmId),
  queryFn: () => fetchSwarmStatus(swarmId),
  enabled: !!swarmId && phase === 'running',
  refetchInterval: 2000,  // Poll every 2 seconds during execution
  refetchIntervalInBackground: true,
});
```

## GitHub Integration

### GitHub API Client (`src/api/github.ts`)

```typescript
interface GitHubService {
  listRepositories(): Promise<Repository[]>;
  listLabels(repo: string): Promise<Label[]>;
  createIssue(repo: string, issue: IssueCreate): Promise<Issue>;
  createBulkIssues(repo: string, issues: IssueCreate[]): Promise<Issue[]>;
}
```

### Issue Template

```typescript
const defaultIssueTemplate = {
  title: '[{severity}] {title} - {file_path}',
  body: `
## Description
{description}

## Location
- **File**: {file_path}
- **Lines**: {line_start}-{line_end}

## Code
\`\`\`{language}
{code_snippet}
\`\`\`

## Recommendation
{recommendation}

---
*Detected by {reviewer_type} reviewer (confidence: {confidence}%)*
*Review ID: {swarm_id}*
  `.trim(),
};
```

## File Structure

```
docker/hitl-ui/src/
+-- api/
|   +-- swarm.ts                    # Swarm API hooks
|   +-- github.ts                   # GitHub API client
|   +-- mocks/
|       +-- swarmMocks.ts           # Mock data for development
+-- components/
|   +-- review/
|       +-- index.ts                # Barrel exports
|       +-- ReviewInputPanel.tsx
|       +-- ReviewInputPanel.test.tsx
|       +-- ReviewProgressPanel.tsx
|       +-- ReviewProgressPanel.test.tsx
|       +-- ThreeLaneView.tsx
|       +-- ThreeLaneView.test.tsx
|       +-- CLIMimicView.tsx
|       +-- CLIMimicView.test.tsx
|       +-- TokenCostCounter.tsx
|       +-- TokenCostCounter.test.tsx
|       +-- ReviewResultsPanel.tsx
|       +-- ReviewResultsPanel.test.tsx
|       +-- SeveritySummary.tsx
|       +-- SeveritySummary.test.tsx
|       +-- FindingCard.tsx
|       +-- FindingCard.test.tsx
|       +-- FindingsList.tsx
|       +-- FindingsList.test.tsx
|       +-- CodeSnippetDisplay.tsx
|       +-- CodeSnippetDisplay.test.tsx
|       +-- BulkActionsBar.tsx
|       +-- BulkActionsBar.test.tsx
|       +-- GitHubIssueModal.tsx
|       +-- GitHubIssueModal.test.tsx
|       +-- RepositoryPicker.tsx
|       +-- LabelSelector.tsx
|       +-- IssuePreview.tsx
+-- pages/
|   +-- CodeReviewPage.tsx
|   +-- CodeReviewPage.test.tsx
+-- stores/
|   +-- reviewStore.ts
|   +-- reviewStore.test.ts
+-- utils/
    +-- reviewUtils.ts              # Helpers for review data
    +-- clipboardUtils.ts           # Copy to clipboard
    +-- reportExport.ts             # Markdown/PDF export
```

## Dependencies

### Existing (reuse)
- React 18
- TypeScript
- TanStack Query
- Zustand
- Tailwind CSS
- clsx
- @headlessui/react
- @heroicons/react

### New (add if needed)
- prism-react-renderer (syntax highlighting for code snippets)
- date-fns (duration formatting)

## Design Tokens

Use existing design system from `tailwind.config.js`:

| Purpose | Token |
|---------|-------|
| Critical severity | `bg-status-error` |
| High severity | `bg-status-warning` |
| Medium severity | `bg-status-info` |
| Low/Info severity | `bg-status-success` |
| Reviewer: Security | `bg-gate-code` (purple) |
| Reviewer: Performance | `bg-accent-teal` (teal) |
| Reviewer: Style | `bg-gate-prd` (blue) |

## Mock Strategy

For development without backend:

1. `VITE_USE_MOCKS=true` enables mock mode
2. Mock swarm status returns simulated progress over time
3. Mock results include representative findings
4. Mock GitHub API returns sample repositories and labels

## Error Handling

| Error Scenario | UI Behavior |
|----------------|-------------|
| API request failure | Toast notification with retry option |
| Swarm timeout | Show timeout message with partial results if any |
| All reviewers failed | Show failure summary with error details |
| GitHub issue creation failed | Show error in modal with retry |
| Network disconnect during poll | Pause polling, show reconnecting indicator |

## Accessibility

- All interactive elements have focus states
- Severity colors have text alternatives
- Code snippets are scrollable with keyboard
- Modal traps focus appropriately
- Progress updates announced via aria-live

## Performance Considerations

1. **Virtualize findings list** for large result sets (>100 findings)
2. **Debounce polling** to avoid rate limiting
3. **Lazy load** code syntax highlighting
4. **Memoize** finding card renders
5. **Batch** bulk issue creation requests

## Integration Points

| Component | Integration |
|-----------|-------------|
| P04-F05 Backend | POST/GET /api/swarm/review endpoints |
| GitHub API | Issue creation via authenticated API |
| Existing UI | Reuse Card, Badge, Button, Spinner components |
| Router | Add /review route to App.tsx |
| Sidebar | Add navigation link to Code Review |
