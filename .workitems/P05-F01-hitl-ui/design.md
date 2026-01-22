# P05-F01: HITL Web UI - Technical Design

## Overview

Build a modern dark-themed HITL (Human-in-the-Loop) governance dashboard for the aSDLC system. This dashboard enables human reviewers to inspect gate requests, view artifacts, and submit approve/reject decisions that flow back into the aSDLC workflow.

## Design Inspiration

The UI design is inspired by the Dribbble "Logistics Shipment Dashboard" - a dark-themed, card-based layout with subtle accent colors and clear visual hierarchy.

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | React 18 + Vite + TypeScript | Fast dev, strong typing, modern tooling |
| Styling | Tailwind CSS | Utility-first, customizable dark theme |
| Components | Headless UI | Accessible primitives, unstyled for customization |
| State | Zustand | Lightweight, TypeScript-friendly |
| API Client | TanStack Query | Caching, polling, mutation handling |
| Icons | Heroicons | Matches Headless UI ecosystem |
| Charts | Recharts | Worker/session visualizations |

## Architecture

### Component Architecture

```
App
├── Layout (sidebar + header + content area)
│   ├── Sidebar (navigation)
│   ├── Header (tenant selector, user menu)
│   └── <Outlet /> (page content)
│
├── Dashboard (stats overview + recent gates)
├── GatesPage (list all pending gates)
├── GateDetailPage (single gate + artifacts + decision form)
├── WorkersPage (worker pool status)
└── SessionsPage (session overview)
```

### Data Flow

```
API (Orchestrator) → TanStack Query → React Components
                           ↓
                     Polling (10s gates, 30s workers)
                           ↓
                     Cache invalidation on mutations
```

### State Management

- **Server State**: Managed by TanStack Query (gates, workers, sessions)
- **UI State**: Managed by Zustand (sidebar, modals, tenant selection)
- **URL State**: Managed by React Router (current page, gate ID)

## Design System

### Color Palette

```css
/* Backgrounds */
--bg-primary: #030303;      /* Near black - main background */
--bg-secondary: #0a0a0a;    /* Slightly lighter - cards */
--bg-tertiary: #141414;     /* Card hover/active states */

/* Accents */
--accent-teal: #1E5160;     /* Primary accent */
--accent-teal-light: #2A7A8C; /* Hover state */

/* Text */
--text-primary: #FBFCFC;    /* Main text */
--text-secondary: #A09E9D;  /* Muted text */
--text-tertiary: #4A4A4A;   /* Disabled/subtle */

/* Status */
--success: #22C55E;         /* Approved */
--warning: #F59E0B;         /* Pending */
--error: #EF4444;           /* Rejected */
--info: #3B82F6;            /* Info badges */
```

### Gate Type Colors

| Gate Type | Color | Badge Variant |
|-----------|-------|---------------|
| HITL_1_BACKLOG (prd_review) | Blue (#3B82F6) | prd |
| HITL_2_DESIGN (design_review) | Purple (#8B5CF6) | design |
| HITL_4_CODE (code_review) | Green (#22C55E) | code |
| HITL_5_VALIDATION (test_review) | Cyan (#06B6D4) | test |
| HITL_6_RELEASE (deployment_approval) | Red (#EF4444) | deploy |

## API Integration

### Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/gates/pending` | GET | List pending gates (with filtering) |
| `/api/gates/{gate_id}` | GET | Get single gate details |
| `/api/gates/{gate_id}/decide` | POST | Submit approve/reject decision |
| `/api/workers/status` | GET | Worker pool status |
| `/api/sessions` | GET | List sessions |
| `/api/sessions/{session_id}` | GET | Single session details |
| `/api/artifacts/{path}` | GET | Artifact content |

### Polling Strategy

| Resource | Interval | Rationale |
|----------|----------|-----------|
| Gates list | 10 seconds | New gates should appear quickly |
| Gate detail | 5 seconds | User viewing, want fresh data |
| Workers | 30 seconds | Status changes less frequently |
| Sessions | 15 seconds | Moderate frequency |

### Error Handling

- Network errors: Show toast notification, retry automatically
- 404 errors: Show empty state with refresh action
- 401 errors: Future - redirect to auth flow

## File Structure

```
docker/hitl-ui/
├── src/
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Root component with router
│   ├── index.css                # Tailwind imports + custom vars
│   ├── api/
│   │   ├── client.ts            # Axios instance
│   │   ├── types.ts             # TypeScript types from contract
│   │   ├── gates.ts             # Gate API hooks
│   │   ├── workers.ts           # Worker pool API hooks
│   │   ├── sessions.ts          # Session API hooks
│   │   └── mocks.ts             # Mock data for development
│   ├── components/
│   │   ├── layout/              # Sidebar, Header, Layout
│   │   ├── gates/               # Gate-related components
│   │   ├── artifacts/           # Artifact viewers
│   │   ├── workers/             # Worker status components
│   │   ├── sessions/            # Session components
│   │   └── common/              # Shared components
│   ├── pages/                   # Route pages
│   ├── stores/                  # Zustand stores
│   └── utils/                   # Formatters, constants
├── public/favicon.svg
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── Dockerfile
```

## Dependencies

### Runtime Dependencies

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "@headlessui/react": "^1.7.17",
  "@heroicons/react": "^2.0.18",
  "@tanstack/react-query": "^5.8.0",
  "axios": "^1.6.0",
  "zustand": "^4.4.7",
  "recharts": "^2.10.0",
  "clsx": "^2.0.0",
  "date-fns": "^2.30.0"
}
```

### Dev Dependencies

```json
{
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@vitejs/plugin-react": "^4.2.0",
  "autoprefixer": "^10.4.16",
  "postcss": "^8.4.31",
  "tailwindcss": "^3.3.5",
  "typescript": "^5.3.0",
  "vite": "^5.0.0",
  "vitest": "^1.0.0"
}
```

## Environment Variables

```bash
VITE_API_BASE_URL=http://orchestrator:8080/api  # API endpoint
VITE_MULTI_TENANCY_ENABLED=false                # Enable tenant selector
VITE_ALLOWED_TENANTS=default                    # Comma-separated tenants
VITE_POLLING_INTERVAL=10000                     # Default polling interval
VITE_USE_MOCKS=false                            # Use mock data (dev only)
```

## Deployment

### Dockerfile Strategy

1. **Build stage**: Use Node image to run `npm run build`
2. **Serve stage**: Use nginx to serve static files
3. **Health endpoint**: Preserve `/health` from server.js for K8s probes

### Kubernetes Integration

- Service: ClusterIP on port 3000
- Probes: `/health` endpoint for liveness/readiness
- ConfigMap: Environment variables for API URL, multi-tenancy

## Security Considerations

- No direct database access (API-only)
- No sensitive data stored in localStorage
- XSS prevention via React's built-in escaping
- CORS handled by orchestrator service
- Future: JWT-based authentication

## Testing Strategy

- **Unit tests**: Vitest for component logic
- **Integration tests**: Mock API responses, test workflows
- **E2E tests**: Playwright for full user journeys (future phase)

## Interfaces

### Contract Dependencies

- `contracts/current/hitl_api.json` - API contract for all endpoints
- Must validate TypeScript types match contract schemas

### Component Props Interfaces

```typescript
// GateCard
interface GateCardProps {
  gate: GateRequest;
  onClick?: () => void;
}

// DecisionForm
interface DecisionFormProps {
  gateId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ArtifactViewer
interface ArtifactViewerProps {
  artifact: Artifact;
  content?: string;
}
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| API not ready | Mock data layer for parallel development |
| Large artifacts | Lazy loading, pagination, size limits |
| Stale data | Aggressive polling + manual refresh |
| Mobile support | Responsive design from start |
