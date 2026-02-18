# SP02-F01: Nano JetBot

## Overview

Side project managed within the aSDLC monorepo for planning and tracking, but implemented in its own dedicated repository at `jb-612/nano-jetbot`. This is an interactive 3D visualization of an NVIDIA Jetson Nano JetBot robot, packaged as a standalone SPA with a backend server, all running in a single Docker container.

**Source repository:** `github.com/jb-612/nano-jetbot`
**Source branch:** `main`

## Project Scope

This is a **side project** (SP02) with its own repository at `jb-612/nano-jetbot`. Planning and meta artifacts live in aSDLC under `.workitems/SP02-F01-nano-bot/`, while all implementation happens in the nano-jetbot repo. The initial import brings in the existing code as-is, then subsequent features can extend it.

## Architecture

### Container Architecture

```
+--------------------------------------------------+
|  Docker Container (node:22-alpine)               |
|                                                  |
|  Express Server (:4000)                          |
|  +--------------------------------------------+ |
|  | /api/robot/*   REST endpoints              | |
|  | /ws/telemetry  WebSocket real-time stream  | |
|  | /*             Static frontend (Vite dist) | |
|  +--------------------------------------------+ |
|                                                  |
|  Service Layer (fully decoupled)                 |
|  +--------------------------------------------+ |
|  | Controllers -> Services -> Repositories    | |
|  | EventBus for real-time decoupling          | |
|  +--------------------------------------------+ |
+--------------------------------------------------+
```

### Backend Layer Architecture

```
HTTP Request
     |
  [auth.middleware]  -- validates X-API-Key header
     |
  [logger.middleware]
     |
  [robot.routes]  --------> [RobotController]
                                |       |       |
                      [RobotService] [TelemetryService] [CameraService]
                          |       |              |
               [RobotStateRepo] [PartsRepo]     |
                                                |
                      [eventBus] <--------------+
                          |
                   [TelemetryGateway]  ----> WebSocket clients
```

### Part Dependency Graph

```
                            +---------+
                            | chassis |  (non-removable root)
                            +---------+
                           /  |  |  |  \
                          /   |  |  |   \
               +---------+ +--+--+--+-+  +---------------+
               | caster  | | battery  |  | wiring        |
               |  ball   | |  pack    |  |  harness      |
               +---------+ +----------+  +---------------+
                              |    |        |    |    |
                              v    v        v    v    v
                     +---------+  +--------+
                     | jetson  |  | motor  |
                     |  nano   |<-| driver |
                     +---------+  +--------+
                    /   |    \       |    \
                   v    v     v      v     v
            +------+ +------+ +-------+ +-------+
            |camera| |ant-L | |wheel-L| |wheel-R|
            |module| +------+ +-------+ +-------+
            +------+ |ant-R |
                      +------+
```

## Technology Stack

### Frontend
- React 19 + TypeScript 5.9 + Vite 7
- Tailwind CSS 4 (dark/light mode)
- React Router DOM 7
- Three.js via `@react-three/fiber` + `@react-three/drei` (3D rendering)
- `@react-three/postprocessing` (selection outlines)
- Zustand 5 (state management)
- maath (animation easing)
- Lucide React (icons)

### Backend
- Express.js 5 (REST API server)
- ws (WebSocket for real-time telemetry)
- TypeScript with ESM modules
- In-memory repositories (mock data, no database)

### Infrastructure
- Single Docker container (multi-stage build)
- docker-compose.yml for easy startup
- Node.js serves both API and static frontend assets

## Core Capabilities

1. **3D Interactive Viewer** - Rotate, zoom, pan the robot model with OrbitControls
2. **Part Interaction** - Click any part to inspect; detach/reattach wheels, antennas, camera, battery
3. **Part Detail Panel** - Materials, conductivity, resistance, function, criticality for every component
4. **Connectivity Mock Screen** - WiFi, battery, latency, IP config, connection logs
5. **Remote Control Panel** - Virtual joystick, camera feed, telemetry gauges, emergency stop
6. **API Documentation** - Interactive Swagger-like docs with try-it-out panels and WebSocket tester

## Robot Components (11 parts)

| # | Part | Category | Criticality | Removable |
|---|------|----------|-------------|-----------|
| 1 | Chassis / Cart | Structural | Critical | No |
| 2 | Left Drive Wheel | Locomotion | High | Yes |
| 3 | Right Drive Wheel | Locomotion | High | Yes |
| 4 | Left WiFi Antenna | Communication | Medium | Yes |
| 5 | Right WiFi Antenna | Communication | Low | Yes |
| 6 | NVIDIA Jetson Nano Board | Compute | Critical | Yes |
| 7 | CSI Camera Module | Sensor | Critical | Yes |
| 8 | Li-Ion Battery Pack | Power | Critical | Yes |
| 9 | Motor Driver Board (PCA9685) | Electrical | Critical | Yes |
| 10 | Front Caster Ball | Structural | High | Yes |
| 11 | Wiring Harness | Wiring | Critical | Yes |

## 3D Model Strategy

**Programmatic geometry** (not GLTF files):
- Zero external asset pipeline (no Blender, no .glb hosting)
- Every part is a discrete React component - clickable, removable, animatable
- Small bundle - geometry generates at runtime
- JetBot shapes (boxes, cylinders, tori) are well suited to procedural construction

## API Contract

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/robot/status` | Connection, battery, WiFi, system info |
| POST | `/api/robot/move` | Directional movement |
| POST | `/api/robot/camera` | Capture or toggle stream |
| GET | `/api/robot/telemetry` | Latest sensor snapshot |
| POST | `/api/robot/servo` | Individual actuator control |
| GET | `/api/robot/parts` | All parts inventory |
| PUT | `/api/robot/parts/:id` | Update part config |
| WS | `/ws/telemetry` | Real-time 5Hz stream |

## Directory Structure (Import Target)

```
side-projects/SP02-nano-bot/
  ai-maturity-dashboard-source/    (frontend)
  server/                          (backend)
  dist/                            (pre-built frontend)
  Dockerfile
  docker-compose.yml
  run-server.sh
  README_INSTALL.txt
  PLAN-robot-sidecar.md
```

## Integration with aSDLC

- This is a separate project at `jb-612/nano-jetbot` with its own repo
- Planning and tracking artifacts live in aSDLC under `.workitems/SP02-F01-nano-bot/`
- Implementation and code changes happen in the nano-jetbot repo
- Imported locally under `side-projects/SP02-nano-bot/` for convenience
- Docker container runs independently on port 4000
- No dependencies on aSDLC core infrastructure (Redis, ES, etc.)

## Key Architectural Decisions

1. **Programmatic 3D geometry** over GLTF - zero asset pipeline
2. **Zustand** over React Context - avoids re-rendering entire Canvas tree
3. **Pure function services** - tree-shakeable, testable without React
4. **Express in same container** - single Docker image serves API + static frontend
5. **EventBus for real-time** - services never call each other directly
6. **maath/easing.damp3** for animation - simpler than spring physics
