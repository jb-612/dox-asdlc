# SP02-F01: Nano JetBot - User Stories

## US-01: Import Robot Sidecar Codebase

**As a** developer,
**I want** the Nano JetBot project imported from the external repository into the aSDLC monorepo,
**So that** I can manage and enhance it alongside other aSDLC projects.

### Acceptance Criteria
- [ ] Source code from `jb-612/nano-jetbot` (main branch) is cloned into `side-projects/SP02-nano-bot/`
- [ ] Frontend source (`ai-maturity-dashboard-source/`) is present with all components
- [ ] Backend source (`server/`) is present with all services
- [ ] Pre-built dist, Dockerfile, docker-compose.yml, and scripts are included
- [ ] PLAN-robot-sidecar.md is included as project documentation

## US-02: 3D Robot Viewer

**As a** user,
**I want** an interactive 3D viewer of the NVIDIA Jetson Nano JetBot,
**So that** I can visually explore the robot's components in a browser.

### Acceptance Criteria
- [ ] 3D model renders all 11 robot parts with procedural geometry
- [ ] OrbitControls allow rotate, zoom, and pan
- [ ] Clicking a part selects it (outline highlight)
- [ ] Double-clicking a removable part detaches/reattaches it with animation
- [ ] Hover shows emissive glow effect
- [ ] "Exploded View" staggers all removable parts outward
- [ ] Dark/light theme support in the 3D canvas

## US-03: Part Detail Panel

**As a** user,
**I want** to see detailed information about any selected robot part,
**So that** I can understand its materials, function, and criticality.

### Acceptance Criteria
- [ ] Right sidebar shows part name, description, category, and criticality badge
- [ ] Materials table displays conductivity (S/m), thermal conductivity (W/mK), and density
- [ ] Electrical resistance and function description are shown
- [ ] Connected parts are listed as clickable links
- [ ] Detach/Attach button is available for removable parts
- [ ] Bottom toolbar provides quick-select chips for all parts

## US-04: Connectivity Dashboard

**As a** user,
**I want** a mock connectivity screen showing robot network status,
**So that** I can simulate monitoring a real robot's connection.

### Acceptance Criteria
- [ ] Connection form with IP, port, and API key fields
- [ ] Status indicator grid shows WiFi signal, battery, latency, and uptime
- [ ] Terminal-style connection log with timestamped entries
- [ ] Quick action buttons (Restart, Firmware Update, Diagnostics, Export Logs)
- [ ] Connect/Disconnect toggles state

## US-05: Remote Control Panel

**As a** user,
**I want** a remote control interface with joystick and telemetry,
**So that** I can simulate controlling the robot's movement and camera.

### Acceptance Criteria
- [ ] Virtual joystick responds to WASD keyboard input
- [ ] Camera feed area displays mock video stream placeholder
- [ ] Telemetry gauges show speed, direction, battery, and temperature
- [ ] Emergency stop button is prominently displayed
- [ ] Command history log shows timestamped actions
- [ ] Speed slider controls movement intensity

## US-06: API Documentation Page

**As a** developer,
**I want** interactive API documentation with try-it-out panels,
**So that** I can test the robot's REST and WebSocket endpoints.

### Acceptance Criteria
- [ ] Two-column layout: endpoint navigation on left, details on right
- [ ] Each endpoint shows method, path, description, and example payloads
- [ ] Try-it-out panel sends real requests to the backend
- [ ] Response displayed with syntax highlighting
- [ ] WebSocket tester allows connecting, sending messages, and viewing telemetry stream
- [ ] All 8 API endpoints documented (7 REST + 1 WebSocket)

## US-07: Backend API Server

**As a** developer,
**I want** an Express.js backend serving the robot API and static frontend,
**So that** the entire application runs from a single process.

### Acceptance Criteria
- [ ] Express 5 server starts on port 4000
- [ ] All 7 REST endpoints respond with `ApiResponse<T>` envelope
- [ ] WebSocket endpoint streams telemetry at 5Hz
- [ ] X-API-Key authentication middleware validates requests
- [ ] In-memory repositories provide mock robot state and parts data
- [ ] EventBus decouples services from WebSocket gateway

## US-08: Docker Deployment

**As a** developer,
**I want** the application containerized with Docker,
**So that** I can run it with a single `docker compose up` command.

### Acceptance Criteria
- [ ] Multi-stage Dockerfile builds frontend and backend
- [ ] docker-compose.yml exposes port 4000
- [ ] Container starts with `node dist/index.js`
- [ ] Static frontend served from built dist directory
- [ ] Health check via `GET /api/robot/status`
