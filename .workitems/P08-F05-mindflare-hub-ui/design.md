# P08-F05: Mindflare Hub UI - Technical Design

## Overview

Implement the Mindflare Hub frontend interface that provides a Twitter-style ideas list, comprehensive filtering, correlation display, and integration with the Ideation Studio "Bake" action. This feature assembles all UI components from the previous features into a cohesive user experience.

### Problem Statement

With the backend features complete (F01-F04), users need a cohesive UI to:
- Browse and discover ideas in an engaging Twitter-style format
- Filter ideas by labels, classification, and source
- View and manage correlations between ideas
- Initiate the "Bake in Studio" workflow to develop ideas into PRDs
- Accept/reject/refine correlation suggestions

### Solution

A comprehensive Mindflare Hub UI that:
1. Displays ideas in a Twitter-style card format
2. Provides powerful filtering and search capabilities
3. Shows correlation suggestions with accept/reject/refine workflow
4. Integrates with Ideation Studio for the "Bake" action
5. Visualizes idea relationships via graph view
6. Supports responsive design for mobile and desktop

## Dependencies

### Internal Dependencies

| Feature | Purpose | Status |
|---------|---------|--------|
| P08-F01 | Ideas Repository Core (API, store) | Required |
| P08-F02 | Slack Integration (source display) | Optional |
| P08-F03 | Auto-Classification (badges, labels) | Required |
| P08-F04 | Correlation Engine (similarity, graph) | Required |
| P05-F11 | Ideation Studio (bake target) | Complete |
| P05-F01 | HITL UI Foundation | Complete |

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| React | ^18.2.0 | UI framework |
| Zustand | ^4.4.0 | State management |
| Tailwind CSS | ^3.4.0 | Styling |
| @heroicons/react | ^2.0.0 | Icons |
| d3 | ^7.8.0 | Graph visualization |
| date-fns | ^3.0.0 | Date formatting |
| react-router-dom | ^6.x | Routing |

## Interfaces

### Provided Interfaces

#### Page Components

```typescript
// Main Mindflare Hub page
interface MindflareHubPageProps {
  className?: string;
}

// Ideas list with filtering
interface IdeasListViewProps {
  onSelectIdea: (ideaId: string) => void;
  selectedIdeaId?: string;
}

// Single idea detail panel
interface IdeaDetailPanelProps {
  ideaId: string;
  onClose: () => void;
  onBakeInStudio: (ideaId: string) => void;
}

// Correlation review panel
interface CorrelationReviewPanelProps {
  ideaId: string;
  onAccept: (correlationId: string) => void;
  onReject: (correlationId: string) => void;
  onRefine: (correlationId: string, newType: CorrelationType) => void;
}

// Graph visualization page
interface MindflareGraphPageProps {
  className?: string;
  initialFilter?: GraphFilter;
}
```

#### Store Interface (Zustand)

```typescript
// Main ideas store (from P08-F01)
interface IdeasState {
  // Data
  ideas: Idea[];
  selectedIdea: Idea | null;
  correlations: IdeaCorrelation[];
  pendingSuggestions: CorrelationSuggestion[];
  clusters: IdeaCluster[];

  // Loading states
  isLoading: boolean;
  isLoadingCorrelations: boolean;
  isLoadingGraph: boolean;

  // Filters
  filters: IdeasFilter;
  searchQuery: string;
  sortBy: SortOption;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;

  // Error
  error: string | null;

  // Actions
  fetchIdeas: () => Promise<void>;
  fetchIdea: (ideaId: string) => Promise<void>;
  createIdea: (content: string, labels?: string[]) => Promise<Idea>;
  updateIdea: (ideaId: string, updates: Partial<Idea>) => Promise<void>;
  deleteIdea: (ideaId: string) => Promise<void>;
  bakeIdea: (ideaId: string, projectName?: string) => Promise<BakeIdeaResponse>;

  // Filtering
  setFilter: (filter: Partial<IdeasFilter>) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: SortOption) => void;
  clearFilters: () => void;

  // Selection
  selectIdea: (ideaId: string) => void;
  clearSelection: () => void;

  // Correlations
  fetchCorrelations: (ideaId: string) => Promise<void>;
  findSimilar: (ideaId: string) => Promise<CorrelationSuggestion[]>;
  acceptCorrelation: (correlationId: string) => Promise<void>;
  rejectCorrelation: (correlationId: string) => Promise<void>;
  refineCorrelation: (correlationId: string, type: CorrelationType, notes?: string) => Promise<void>;

  // Graph
  fetchGraph: (filter?: GraphFilter) => Promise<{ nodes: GraphNode[], edges: GraphEdge[] }>;
  fetchClusters: () => Promise<void>;
}

interface IdeasFilter {
  status?: IdeaStatus[];
  classification?: IdeaClassification[];
  labels?: string[];
  source?: IdeaSource[];
  dateFrom?: string;
  dateTo?: string;
}

type SortOption = 'newest' | 'oldest' | 'most_correlated' | 'highest_similarity';
```

### Required Interfaces

#### API Client (from P08-F01)

```typescript
// Already defined in api/ideas.ts
// - createIdea()
// - listIdeas()
// - getIdea()
// - updateIdea()
// - deleteIdea()
// - bakeIdea()

// Already defined in api/correlations.ts
// - findSimilar()
// - getCorrelations()
// - createCorrelation()
// - updateCorrelation()
// - deleteCorrelation()
// - getGraph()
// - getClusters()
```

## Technical Approach

### Architecture

```
+------------------------------------------------------------------+
|                         Mindflare Hub UI                              |
+------------------------------------------------------------------+
|                                                                   |
|  Pages                                                            |
|  +------------------------------------------------------------+  |
|  | MindflareHubPage        | MindflareGraphPage   | IdeaDetailPage    |  |
|  | /mindflare              | /mindflare/graph     | /mindflare/:id        |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  Layout Components                                                |
|  +------------------------------------------------------------+  |
|  | IdeasListView | IdeasFilter | IdeaDetailPanel | Sidebar    |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  Shared Components                                                |
|  +------------------------------------------------------------+  |
|  | IdeaCard | ClassificationBadge | LabelEditor | IdeasGraph  |  |
|  | CorrelationReview | SimilarIdeasPanel | ClustersPanel      |  |
|  | IdeaForm | WordCountIndicator | CreateIdeaButton           |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  State Management                                                 |
|  +------------------------------------------------------------+  |
|  | ideasStore (Zustand)                                        |  |
|  | - ideas, filters, correlations, graph data                  |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|  API Layer                                                        |
|  +------------------------------------------------------------+  |
|  | ideas.ts | correlations.ts | classification.ts              |  |
|  +------------------------------------------------------------+  |
|                                                                   |
+------------------------------------------------------------------+
```

### Page Layout: MindflareHubPage

```
Desktop Layout (>1024px):
+------------------------------------------------------------------+
| Header: Mindflare Hub                               [+ New Idea]      |
+------------------------------------------------------------------+
| Search: [___________________________]           [Filters v]       |
+------------------------------------------------------------------+
| Filter Pills: [Functional x] [Performance x]   [Clear All]       |
+------------------------------------------------------------------+
|                                   |                               |
| Ideas List (Masonry/Grid)        | Detail Panel                  |
| +-------+  +-------+  +-------+  | +---------------------------+ |
| | Idea  |  | Idea  |  | Idea  |  | | Selected Idea Detail      | |
| | Card  |  | Card  |  | Card  |  | |                           | |
| +-------+  +-------+  +-------+  | | [Bake in Studio]          | |
| +-------+  +-------+  +-------+  | | [Find Similar]            | |
| | Idea  |  | Idea  |  | Idea  |  | |                           | |
| | Card  |  | Card  |  | Card  |  | | Correlations Tab          | |
| +-------+  +-------+  +-------+  | | [Suggestions] (3 pending) | |
|                                   | +---------------------------+ |
+------------------------------------------------------------------+
| Pagination: < 1 2 3 ... 10 >                                     |
+------------------------------------------------------------------+

Mobile Layout (<768px):
+------------------------------------------+
| [=] Mindflare Hub                [+ New]     |
+------------------------------------------+
| [Search...]                  [Filters]   |
+------------------------------------------+
| [Functional x] [Performance x]           |
+------------------------------------------+
| +--------------------------------------+ |
| | Idea Card                            | |
| +--------------------------------------+ |
| +--------------------------------------+ |
| | Idea Card                            | |
| +--------------------------------------+ |
| +--------------------------------------+ |
| | Idea Card                            | |
| +--------------------------------------+ |
+------------------------------------------+
| [Load More]                              |
+------------------------------------------+

(Detail opens as full-screen modal on mobile)
```

### Twitter-Style IdeaCard Design

```typescript
// IdeaCard component design
const IdeaCard: React.FC<IdeaCardProps> = ({ idea, onSelect, onBake }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Avatar name={idea.author_name} size="sm" />
        <div>
          <span className="font-medium text-gray-900">{idea.author_name}</span>
          <span className="text-gray-500 text-sm ml-2">
            {formatRelativeTime(idea.created_at)}
          </span>
        </div>
        <SourceBadge source={idea.source} className="ml-auto" />
      </div>

      {/* Content */}
      <p className="text-gray-800 mb-3 line-clamp-4">{idea.content}</p>

      {/* Metadata Row */}
      <div className="flex items-center gap-2 mb-3">
        <ClassificationBadge classification={idea.classification} size="sm" />
        {idea.labels.slice(0, 3).map(label => (
          <LabelBadge key={label} label={label} size="sm" />
        ))}
        {idea.labels.length > 3 && (
          <span className="text-gray-500 text-sm">+{idea.labels.length - 3}</span>
        )}
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-4 text-gray-500">
          <button className="flex items-center gap-1 hover:text-blue-600">
            <LinkIcon className="h-4 w-4" />
            <span className="text-sm">{idea.correlation_count || 0}</span>
          </button>
          <span className="text-sm">{idea.word_count} words</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onBake(idea.id); }}
          className="text-yellow-600 hover:text-yellow-700 flex items-center gap-1"
        >
          <LightBulbIcon className="h-4 w-4" />
          <span className="text-sm">Bake</span>
        </button>
      </div>
    </div>
  );
};
```

### "Bake in Studio" Integration

```typescript
const handleBakeIdea = async (ideaId: string) => {
  try {
    // Call bake API
    const result = await bakeIdea(ideaId);

    // Navigate to Ideation Studio with session
    navigate(`/studio/ideation?session=${result.session_id}`);

    // Show success toast
    showToast('Idea sent to Ideation Studio', 'success');
  } catch (error) {
    showToast('Failed to bake idea', 'error');
  }
};
```

### Correlation Review Workflow

```typescript
// CorrelationReviewPanel component
const CorrelationReviewPanel: React.FC<Props> = ({
  ideaId,
  suggestions,
  onAccept,
  onReject,
  onRefine,
}) => {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [refineType, setRefineType] = useState<CorrelationType | null>(null);
  const [refineNotes, setRefineNotes] = useState('');

  const handleRefineSubmit = async () => {
    if (!selectedSuggestion || !refineType) return;
    await onRefine(selectedSuggestion, refineType, refineNotes);
    setSelectedSuggestion(null);
    setRefineType(null);
    setRefineNotes('');
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        Suggestions
        {suggestions.length > 0 && (
          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
            {suggestions.length} pending
          </span>
        )}
      </h3>

      {suggestions.map(suggestion => (
        <SuggestionCard
          key={suggestion.correlation.id}
          suggestion={suggestion}
          onAccept={() => onAccept(suggestion.correlation.id)}
          onReject={() => onReject(suggestion.correlation.id)}
          onRefine={() => setSelectedSuggestion(suggestion.correlation.id)}
        />
      ))}

      {/* Refine Modal */}
      {selectedSuggestion && (
        <RefineModal
          onClose={() => setSelectedSuggestion(null)}
          correlationType={refineType}
          onTypeChange={setRefineType}
          notes={refineNotes}
          onNotesChange={setRefineNotes}
          onSubmit={handleRefineSubmit}
        />
      )}
    </div>
  );
};
```

### Responsive Design Strategy

| Breakpoint | Layout | Behavior |
|------------|--------|----------|
| < 640px (sm) | Single column, stacked cards | Detail as full-screen modal |
| 640-1024px (md) | 2-column grid | Detail as slide-over panel |
| > 1024px (lg) | 3-column grid + detail panel | Side-by-side layout |

### Error Handling

| Error Type | UI Handling |
|------------|-------------|
| Network error | Toast notification with retry button |
| Idea not found | Redirect to list with error message |
| Bake failed | Toast with error details |
| Correlation update failed | Toast with retry option |

## File Structure

```
docker/hitl-ui/src/
├── pages/
│   ├── MindflareHubPage.tsx              # Main ideas page
│   ├── MindflareHubPage.test.tsx
│   ├── MindflareGraphPage.tsx            # Graph visualization
│   ├── MindflareGraphPage.test.tsx
│   └── IdeaDetailPage.tsx            # Full-page detail (mobile)
├── components/
│   └── mindflare/
│       ├── IdeaCard.tsx              # Twitter-style card
│       ├── IdeaCard.test.tsx
│       ├── IdeasListView.tsx         # List with grid layout
│       ├── IdeasListView.test.tsx
│       ├── IdeaDetailPanel.tsx       # Right panel detail
│       ├── IdeaDetailPanel.test.tsx
│       ├── IdeasFilter.tsx           # Filter controls
│       ├── IdeasFilter.test.tsx
│       ├── IdeaForm.tsx              # Create/edit form
│       ├── IdeaForm.test.tsx
│       ├── CreateIdeaButton.tsx      # FAB for new idea
│       ├── WordCountIndicator.tsx    # Word count display
│       ├── SourceBadge.tsx           # Slack/Manual badge
│       ├── ClassificationBadge.tsx   # F/NF badge (from F03)
│       ├── LabelEditor.tsx           # Label management (from F03)
│       ├── SimilarIdeasPanel.tsx     # Similar ideas (from F04)
│       ├── CorrelationsList.tsx      # All correlations (from F04)
│       ├── CorrelationReview.tsx     # Accept/reject/refine (from F04)
│       ├── IdeasGraph.tsx            # D3 graph (from F04)
│       └── ClustersPanel.tsx         # Clusters list (from F04)
├── stores/
│   └── mindflareStore.ts             # Unified Mindflare Hub store
├── api/
│   ├── ideas.ts                      # Ideas API (from F01)
│   ├── correlations.ts               # Correlation API (from F04)
│   └── classification.ts             # Classification API (from F03)
└── types/
    ├── ideas.ts                      # Idea types (from F01)
    ├── correlation.ts                # Correlation types (from F04)
    └── classification.ts             # Classification types (from F03)
```

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Slow list rendering | Medium | Medium | Virtualized list, pagination |
| Graph complexity | Medium | Medium | Limit visible nodes, progressive loading |
| Mobile usability | Medium | Low | Dedicated mobile layouts, touch optimization |
| State synchronization | Medium | Medium | Optimistic updates, error recovery |

## Success Metrics

1. **Page Load Time**: < 2 seconds for initial ideas list
2. **Interaction Response**: < 200ms for filter changes
3. **Bake Conversion**: 10%+ of ideas proceed to Ideation Studio
4. **Review Completion**: 60%+ of suggestions reviewed within 7 days
