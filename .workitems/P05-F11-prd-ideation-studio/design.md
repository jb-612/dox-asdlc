# P05-F11: PRD Ideation Studio - Technical Design

## Overview

Implement an interactive PRD Ideation Studio in the HITL UI that enables users to collaboratively develop Product Requirements Documents through LLM-powered interviews. The agent guides users through structured discovery, tracks maturity progress, and produces formal PRD documents with user stories when requirements reach sufficient clarity.

### Problem Statement

Currently, PRD creation is a manual process without guided structure. Users may:
- Miss critical requirement areas
- Provide insufficient detail for development teams
- Lack visibility into PRD completeness
- Have no clear path from ideation to formal documentation

### Solution

A conversational ideation interface where:
1. An LLM agent interviews the user using structured prompts
2. Progress is tracked via a maturity score (0-100%)
3. Requirements are categorized and validated as the conversation progresses
4. At 80%+ maturity, users can submit for PRD generation
5. Generated PRDs enter a HITL gate for review
6. User stories are extracted as a separate deliverable

## Dependencies

### Internal Dependencies

| Feature | Purpose | Status |
|---------|---------|--------|
| P05-F01 | HITL UI Foundation (routing, layout, stores) | Complete |
| P03-F01 | Worker Pool Framework (agent dispatch) | Complete |
| P04-F01 | Discovery Agents (PRDAgent, AcceptanceAgent) | Complete |
| P02-F03 | HITL Gate System (gate requests, approvals) | Complete |

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| React | ^18.2.0 | UI framework |
| Zustand | ^4.4.0 | State management |
| Tailwind CSS | ^3.4.0 | Styling |
| @heroicons/react | ^2.0.0 | Icons |
| recharts | ^2.8.0 | Progress visualization |

## Interfaces

### Provided Interfaces

#### MaturityTracker Component

```typescript
interface MaturityLevel {
  level: 'concept' | 'exploration' | 'defined' | 'refined' | 'complete';
  minScore: number;
  maxScore: number;
  label: string;
  description: string;
}

interface MaturityState {
  score: number;           // 0-100
  level: MaturityLevel;
  categories: CategoryMaturity[];
  canSubmit: boolean;      // true when score >= 80
  gaps: string[];          // Missing or weak areas
}

interface CategoryMaturity {
  id: string;
  name: string;
  score: number;
  requiredForSubmit: boolean;
  sections: SectionMaturity[];
}

interface MaturityTrackerProps {
  maturity: MaturityState;
  onCategoryClick?: (categoryId: string) => void;
  showGaps?: boolean;
}
```

#### IdeationChat Component

```typescript
interface IdeationChatProps {
  sessionId: string;
  onMaturityUpdate: (maturity: MaturityState) => void;
  onArtifactGenerated: (artifact: GeneratedArtifact) => void;
  initialContext?: string;
}

// IdeationMessage is a standalone interface (not extending ChatMessage)
// to avoid type conflicts with existing ChatMessage definitions
interface IdeationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;                     // ISO 8601 format (matches api/types.ts convention)
  maturityDelta?: number;                // Change in maturity score
  extractedRequirements?: Requirement[];
  suggestedFollowups?: string[];         // Agent's suggested next questions
}
```

#### PRD Submission Flow

```typescript
interface PRDSubmission {
  sessionId: string;
  maturityScore: number;
  extractedRequirements: Requirement[];
  conversationSummary: string;
  requestedBy: string;
}

interface PRDSubmissionResult {
  success: boolean;
  gateId?: string;
  prdDraft?: PRDDocument;
  userStories?: UserStory[];
  error?: string;
}

interface UserStory {
  id: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  linkedRequirements: string[];
  priority: 'must_have' | 'should_have' | 'could_have';
}
```

#### PRDDocument Interface

```typescript
interface PRDDocument {
  id: string;
  title: string;
  version: string;
  sections: PRDSection[];
  createdAt: string;
  status: 'draft' | 'pending_review' | 'approved';
}

interface PRDSection {
  id: string;
  heading: string;
  content: string;
  order: number;
}
```

#### Requirement Interface

```typescript
interface Requirement {
  id: string;
  description: string;
  type: 'functional' | 'non_functional' | 'constraint';
  priority: 'must_have' | 'should_have' | 'could_have';
  categoryId: string;
  sourceMessageId?: string;
  createdAt: string;
}
```

### Required Interfaces

#### Backend API Endpoints

```typescript
// POST /api/studio/ideation/chat
interface IdeationChatRequest {
  sessionId: string;
  message: string;
  currentMaturity: number;
  model?: 'sonnet' | 'opus' | 'haiku';
  rlmEnabled?: boolean;
}

interface IdeationChatResponse {
  message: ChatMessage;
  maturityUpdate: MaturityState;
  extractedRequirements: Requirement[];
  suggestedFollowups: string[];
}

// POST /api/studio/ideation/submit-prd
interface SubmitPRDRequest {
  sessionId: string;
  maturityState: MaturityState;
  includeUserStories: boolean;
}

interface SubmitPRDResponse {
  gateId: string;
  prdDraft: PRDDocument;
  userStories: UserStory[];
  status: 'pending_review';
}

// GET /api/studio/ideation/{sessionId}/maturity
// Returns current maturity calculation
```

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRD Ideation Studio                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Ideation Chat   │  │  Maturity    │  │  Output Panel    │   │
│  │                 │  │  Tracker     │  │                  │   │
│  │ - Agent Q&A     │  │              │  │ - PRD Preview    │   │
│  │ - Streaming     │  │ - Progress   │  │ - User Stories   │   │
│  │ - Follow-ups    │  │ - Categories │  │ - Submit Button  │   │
│  │                 │  │ - Gaps       │  │ - Gate Status    │   │
│  └────────┬────────┘  └──────┬───────┘  └────────┬─────────┘   │
│           │                  │                    │             │
│           └──────────────────┴────────────────────┘             │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │  ideationStore    │                        │
│                    │  (Zustand)        │                        │
│                    └─────────┬─────────┘                        │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Backend API        │
                    │  /api/studio/...    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼────────┐ ┌─────▼─────┐ ┌───────▼───────┐
     │ IdeationAgent   │ │ PRDAgent  │ │ GateService   │
     │ (Interview)     │ │ (Generate)│ │ (HITL)        │
     └─────────────────┘ └───────────┘ └───────────────┘
```

### Maturity Calculation Algorithm

```typescript
const MATURITY_LEVELS: MaturityLevel[] = [
  { level: 'concept', minScore: 0, maxScore: 20,
    label: 'General Concept', description: 'Basic idea captured' },
  { level: 'exploration', minScore: 20, maxScore: 40,
    label: 'Exploration', description: 'Key areas identified' },
  { level: 'defined', minScore: 40, maxScore: 60,
    label: 'Firm Understanding', description: 'Core requirements clear' },
  { level: 'refined', minScore: 60, maxScore: 80,
    label: 'Refined', description: 'Details mostly complete' },
  { level: 'complete', minScore: 80, maxScore: 100,
    label: 'Tightly Defined', description: 'Ready for PRD generation' },
];

const REQUIRED_CATEGORIES = [
  { id: 'problem', name: 'Problem Statement', weight: 15 },
  { id: 'users', name: 'Target Users', weight: 10 },
  { id: 'functional', name: 'Functional Requirements', weight: 25 },
  { id: 'nfr', name: 'Non-Functional Requirements', weight: 15 },
  { id: 'scope', name: 'Scope & Constraints', weight: 15 },
  { id: 'success', name: 'Success Criteria', weight: 10 },
  { id: 'risks', name: 'Risks & Assumptions', weight: 10 },
];

function calculateMaturity(categories: CategoryMaturity[]): number {
  return categories.reduce((total, cat) => {
    const config = REQUIRED_CATEGORIES.find(c => c.id === cat.id);
    return total + (cat.score * (config?.weight || 0) / 100);
  }, 0);
}
```

### Interview Agent Behavior

The IdeationAgent follows a structured interview flow:

1. **Opening**: Capture high-level concept
2. **Problem Space**: Deep dive into problems being solved
3. **User Identification**: Who are the users?
4. **Functional Requirements**: What should the system do?
5. **Non-Functional Requirements**: Performance, security, scalability
6. **Scope Boundaries**: What's in/out of scope?
7. **Success Metrics**: How will we measure success?
8. **Risk Assessment**: What could go wrong?

The agent:
- Asks probing follow-up questions
- Extracts requirements from natural language
- Updates maturity scores based on coverage and depth
- Suggests areas needing more detail

### State Management

```typescript
// stores/ideationStore.ts
interface IdeationState {
  sessionId: string | null;
  messages: IdeationMessage[];
  maturity: MaturityState;
  extractedRequirements: Requirement[];
  userStories: UserStory[];

  // PRD submission state
  isSubmitting: boolean;
  submittedGateId: string | null;
  prdDraft: PRDDocument | null;

  // Actions
  startSession: (projectName: string) => void;
  sendMessage: (content: string) => Promise<void>;
  updateMaturity: (update: Partial<MaturityState>) => void;
  addRequirement: (req: Requirement) => void;
  submitForPRD: () => Promise<PRDSubmissionResult>;
  resetSession: () => void;
}
```

### Error Handling

| Error Type | Handling Strategy |
|------------|-------------------|
| Network failure | Retry with exponential backoff, show toast |
| LLM timeout | Show "thinking" state, offer retry |
| Invalid maturity | Recalculate from extracted requirements |
| Gate submission fail | Show error, allow manual retry |
| Session expired | Prompt to save draft and restart |
| Session save failed | Retry 3x, then show warning toast, keep in memory |
| Storage quota exceeded | Prompt user to delete old drafts |

## File Structure

```
docker/hitl-ui/src/
├── pages/
│   └── StudioIdeationPage.tsx         # Main page component
├── components/
│   └── studio/
│       ├── ideation/
│       │   ├── MaturityTracker.tsx    # Progress visualization
│       │   ├── MaturityTracker.test.tsx
│       │   ├── CategoryProgress.tsx   # Individual category progress
│       │   ├── CategoryProgress.test.tsx
│       │   ├── IdeationChat.tsx       # Chat with agent
│       │   ├── IdeationChat.test.tsx
│       │   ├── RequirementCard.tsx    # Extracted requirement display
│       │   ├── RequirementCard.test.tsx
│       │   ├── UserStoryCard.tsx      # User story display
│       │   ├── UserStoryCard.test.tsx
│       │   ├── SubmitPRDButton.tsx    # Submit with maturity gate
│       │   ├── SubmitPRDButton.test.tsx
│       │   ├── PRDPreviewPanel.tsx    # Generated PRD preview
│       │   └── PRDPreviewPanel.test.tsx
│       └── index.ts                    # Re-exports
├── stores/
│   ├── ideationStore.ts               # Ideation state management
│   └── ideationStore.test.ts
├── api/
│   ├── ideation.ts                    # API client functions
│   └── mocks/
│       └── ideation.ts                # Mock data for development
└── types/
    └── ideation.ts                    # TypeScript interfaces
```

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| LLM produces inconsistent maturity assessments | Medium | Medium | Define strict rubrics; use structured output parsing |
| Users submit at 80% but PRD quality is low | High | Low | Add quality checks beyond maturity score |
| Long conversations lose context | Medium | Medium | Implement conversation summarization |
| Interview feels robotic | Medium | Medium | Design natural prompts; allow free-form discussion |
| Gate review creates bottleneck | Low | Medium | Allow draft export while pending review |

## Success Metrics

1. **Maturity Accuracy**: PRDs generated at 80%+ maturity pass review 90%+ of the time
2. **User Engagement**: Average 15+ messages per ideation session
3. **Requirement Coverage**: 80%+ of PRD requirements traced to conversation
4. **Time to PRD**: Reduce time from idea to formal PRD by 50%
