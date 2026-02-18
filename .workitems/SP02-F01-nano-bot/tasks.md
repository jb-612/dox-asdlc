# SP02-F01: Nano JetBot - Tasks

## Phase 1: Import & Setup [3 tasks]

- [ ] **T01** Clone nano-jetbot repo from `jb-612/nano-jetbot` (main branch) into `side-projects/SP02-nano-bot/`
  - Files: `side-projects/SP02-nano-bot/*`
  - Depends on: none
  - Scope: Clone repo contents, verify directory structure matches plan

- [ ] **T02** Install frontend dependencies and verify build
  - Files: `side-projects/SP02-nano-bot/ai-maturity-dashboard-source/package.json`
  - Depends on: T01
  - Scope: `npm install`, `npm run build`, verify dist output

- [ ] **T03** Install server dependencies and verify build
  - Files: `side-projects/SP02-nano-bot/server/package.json`
  - Depends on: T01
  - Scope: `npm install`, `tsc` build, verify dist output

## Phase 2: Verify Frontend (3D Viewer) [4 tasks]

- [ ] **T04** Verify domain models and mock data
  - Files: `ai-maturity-dashboard-source/src/models/*.ts`, `src/data/*.ts`
  - Depends on: T02
  - Scope: Confirm 4 model files, 3 data files, 10 materials, 11 parts, 22 dependency edges

- [ ] **T05** Verify 3D components render
  - Files: `ai-maturity-dashboard-source/src/components/Robot3D/**`
  - Depends on: T02
  - Scope: Confirm RobotViewer, SceneSetup, JetBotModel, all 9 part geometries, PostProcessing

- [ ] **T06** Verify Part UI components
  - Files: `ai-maturity-dashboard-source/src/components/RobotUI/**`
  - Depends on: T02
  - Scope: Confirm PartInfoPanel, PartToolbar, CriticalityBadge, PartBadge

- [ ] **T07** Verify Zustand store, services, and hooks
  - Files: `ai-maturity-dashboard-source/src/stores/`, `src/services/`, `src/hooks/`
  - Depends on: T02
  - Scope: Confirm robotStore, 3 services, 2 hooks (assembly + selection)

## Phase 3: Verify Backend [3 tasks]

- [ ] **T08** Verify server types and config
  - Files: `server/src/types/*.ts`, `server/src/config.ts`
  - Depends on: T03
  - Scope: Confirm robot.types.ts, api.types.ts, config.ts, event-bus.ts

- [ ] **T09** Verify REST API endpoints
  - Files: `server/src/controllers/`, `server/src/routes/`, `server/src/services/`
  - Depends on: T03
  - Scope: Confirm 7 REST endpoints (status, move, camera, telemetry, servo, parts, parts/:id)

- [ ] **T10** Verify WebSocket telemetry gateway
  - Files: `server/src/websocket/telemetry.gateway.ts`
  - Depends on: T03
  - Scope: Confirm WebSocket server, 5Hz telemetry stream, event bus integration

## Phase 4: Verify Pages & Routing [4 tasks]

- [ ] **T11** Verify Robot Viewer page (`/robot/viewer`)
  - Files: `ai-maturity-dashboard-source/src/pages/RobotViewer.tsx`
  - Depends on: T05, T06
  - Scope: 3D canvas + part detail panel + toolbar assembled

- [ ] **T12** Verify Connectivity page (`/robot/connectivity`)
  - Files: `ai-maturity-dashboard-source/src/pages/RobotConnectivity.tsx`
  - Depends on: T02
  - Scope: ConnectionForm, StatusIndicatorGrid, ConnectionLog, QuickActions

- [ ] **T13** Verify Control page (`/robot/control`)
  - Files: `ai-maturity-dashboard-source/src/pages/RobotControl.tsx`
  - Depends on: T02
  - Scope: VirtualJoystick, CameraFeed, TelemetryGauges, EmergencyStop, CommandHistory

- [ ] **T14** Verify API Docs page (`/robot/api`)
  - Files: `ai-maturity-dashboard-source/src/pages/RobotApi.tsx`
  - Depends on: T02
  - Scope: EndpointCard, TryItPanel, WebSocketTester, CodeBlock

## Phase 5: Docker & Integration [3 tasks]

- [ ] **T15** Verify Dockerfile and docker-compose.yml
  - Files: `Dockerfile`, `docker-compose.yml`, `.dockerignore`
  - Depends on: T02, T03
  - Scope: Multi-stage build, port 4000, health check

- [ ] **T16** Run Docker container end-to-end
  - Depends on: T15
  - Scope: `docker compose up`, verify frontend loads, API responds, WebSocket streams

- [ ] **T17** Add SP02 entry to project documentation
  - Files: project-level docs referencing SP02
  - Depends on: T16
  - Scope: Note in relevant docs that SP02 exists as a side project

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Import & Setup | T01-T03 | Clone and build |
| 2. Verify Frontend | T04-T07 | 3D viewer, models, UI components |
| 3. Verify Backend | T08-T10 | REST API, WebSocket, services |
| 4. Verify Pages | T11-T14 | All 4 robot pages and routing |
| 5. Docker & Integration | T15-T17 | Container build and docs |

**Total: 5 phases, 17 tasks**

### Parallelization

- Phase 2 (frontend) and Phase 3 (backend) can run in parallel after Phase 1
- Phase 4 tasks are independent of each other
- Phase 5 depends on Phases 2 and 3 completing
