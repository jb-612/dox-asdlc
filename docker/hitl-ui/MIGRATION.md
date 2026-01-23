# Migration Guide: P05-F01 to P05-F06 (HITL UI v2)

## Overview

This guide documents the migration from the original HITL UI (P05-F01) to the new HITL UI v2 (P05-F06). The v2 release introduces significant new features while maintaining backwards compatibility with existing functionality.

## What's New in v2

### New Pages
- **Discovery Studio** (`/studio`) - AI-assisted PRD creation with chat interface
- **Agent Cockpit** (`/cockpit`) - Monitor agent runs and performance metrics
- **Documentation** (`/docs`) - Browse aSDLC documentation
- **Artifacts** (`/artifacts`) - Browse and manage generated artifacts

### New Features
- **Feature Flags** - Incrementally enable/disable new pages
- **WebSocket Events** - Real-time event streaming via Socket.IO
- **Zustand Stores** - Enhanced state management (session, studio, event stores)
- **API Contract Validation** - Runtime validation using Zod schemas
- **RLM Trajectory Visualization** - Visualize agent reasoning paths

## Breaking Changes

### None

P05-F06 is designed as an additive release. All existing functionality from P05-F01 remains intact:
- Gates page (`/`) continues to work unchanged
- All existing components preserved
- API endpoints unchanged
- Environment variables unchanged

## New Dependencies

The following dependencies were added in v2:

```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "prismjs": "^1.29.0",
    "diff": "^5.1.0",
    "socket.io-client": "^4.6.0",
    "react-d3-tree": "^3.6.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/prismjs": "^1.26.0",
    "@types/diff": "^5.0.9"
  }
}
```

## New Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket server URL |
| `VITE_FEATURE_DISCOVERY_STUDIO` | `true` | Enable Discovery Studio page |
| `VITE_FEATURE_COCKPIT` | `true` | Enable Agent Cockpit page |
| `VITE_FEATURE_DOCS` | `true` | Enable Documentation page |
| `VITE_FEATURE_ARTIFACTS` | `true` | Enable Artifacts page |
| `VITE_FEATURE_RLM_TRAJECTORY` | `false` | Enable RLM Trajectory visualization |

## Feature Flags

New pages can be enabled/disabled via:
1. Environment variables (set at build time)
2. localStorage overrides (set at runtime)

localStorage keys:
- `feature_discovery_studio`
- `feature_cockpit`
- `feature_docs`
- `feature_artifacts`
- `feature_rlm_trajectory`

Values: `"true"` or `"false"` (strings, not booleans)

## New File Structure

```
src/
├── api/
│   ├── runs.ts         # New: Cockpit API
│   ├── studio.ts       # New: Studio API
│   ├── artifacts.ts    # New: Artifacts API
│   └── websocket.ts    # New: WebSocket wrapper
├── stores/
│   ├── gatesStore.ts   # Existing
│   ├── sessionStore.ts # New: Session state
│   ├── studioStore.ts  # New: Studio state
│   └── eventStore.ts   # New: Event stream state
├── utils/
│   ├── featureFlags.ts # New: Feature flag system
│   ├── websocket.ts    # New: WebSocket client
│   ├── contracts.ts    # New: Zod schemas
│   └── env.ts          # New: Environment utilities
├── components/
│   ├── admin/
│   │   └── FeatureFlagsPanel.tsx  # New
│   └── documentation/
│       └── ComponentDocumentation.test.tsx  # New: Living docs
├── pages/
│   ├── GatesPage.tsx     # Existing
│   ├── DocsPage.tsx      # New
│   ├── CockpitPage.tsx   # New (placeholder)
│   ├── StudioPage.tsx    # New (placeholder)
│   └── ArtifactsPage.tsx # New
└── ...
```

## Migration Steps

### Step 1: Update Dependencies

```bash
npm install
```

### Step 2: Update Environment (Optional)

Add new environment variables to `.env`:

```bash
VITE_WS_URL=ws://your-websocket-server:8000
```

### Step 3: Enable Features (Optional)

By default, all new features are enabled. To disable:

```bash
VITE_FEATURE_DISCOVERY_STUDIO=false
VITE_FEATURE_COCKPIT=false
```

Or set localStorage at runtime:
```javascript
localStorage.setItem('feature_discovery_studio', 'false');
```

### Step 4: Build and Deploy

```bash
npm run build
# Deploy dist/ folder
```

## Rollback Plan

If issues arise with v2 features:

### Option 1: Disable via Feature Flags (Recommended)

Set localStorage flags to disable problematic features:
```javascript
localStorage.setItem('feature_discovery_studio', 'false');
localStorage.setItem('feature_cockpit', 'false');
localStorage.setItem('feature_docs', 'false');
localStorage.setItem('feature_artifacts', 'false');
```

### Option 2: Environment Variable Rollback

Rebuild with features disabled:
```bash
VITE_FEATURE_DISCOVERY_STUDIO=false \
VITE_FEATURE_COCKPIT=false \
VITE_FEATURE_DOCS=false \
VITE_FEATURE_ARTIFACTS=false \
npm run build
```

### Option 3: Git Revert

If complete rollback needed:
```bash
git revert HEAD  # Revert the P05-F06 merge commit
npm install
npm run build
```

## Testing the Migration

1. Run unit tests:
   ```bash
   npm test
   ```

2. Run E2E tests (if available):
   ```bash
   npm run e2e
   ```

3. Manual verification:
   - [ ] Gates page loads and works
   - [ ] New navigation items visible (if features enabled)
   - [ ] Feature flags toggle pages on/off
   - [ ] No console errors

## Support

For issues related to this migration, check:
- `.workitems/P05-F06-hitl-ui-v2/` for design documentation
- `src/components/documentation/ComponentDocumentation.test.tsx` for living API docs
- Test files (`*.test.tsx`) for usage examples

## Version History

| Version | Feature ID | Description |
|---------|-----------|-------------|
| 1.0.0 | P05-F01 | Initial HITL UI with Gates |
| 2.0.0 | P05-F06 | Full SPA with Studio, Cockpit, Docs, Artifacts |
