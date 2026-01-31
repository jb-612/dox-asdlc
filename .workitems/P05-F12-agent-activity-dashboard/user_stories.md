# P05-F12: Agent Activity Dashboard - User Stories

## US-01: View Agent Status Grid
**As a** developer **I want** to see all agents in a grid **So that** I can quickly assess system state

**Acceptance Criteria:**
- Grid shows all agents with status cards
- Cards show: type icon, status badge, progress bar, current task
- Color-coded by status (green=idle, blue=running, red=failed)
- Click card to select agent

## US-02: View Real-time Updates
**As a** developer **I want** real-time status updates **So that** I see changes immediately

**Acceptance Criteria:**
- WebSocket connection indicator in header
- Status cards update without refresh
- Progress bars animate smoothly
- Connection auto-reconnects on disconnect

## US-03: View Agent Logs
**As a** developer **I want** to view agent logs **So that** I can debug issues

**Acceptance Criteria:**
- Log panel shows when agent selected
- Filter by log level (debug, info, warn, error)
- Newest logs at top, auto-scroll option
- Search within logs

## US-04: View Metrics Charts
**As a** PM **I want** to see metrics visualized **So that** I understand performance

**Acceptance Criteria:**
- Bar chart: executions by agent type
- Line chart: success rate over time
- Stats: avg duration, total tokens
- Time range selector (1h, 24h, 7d)

## US-05: View Execution Timeline
**As a** developer **I want** a Gantt-style timeline **So that** I see parallel execution

**Acceptance Criteria:**
- Horizontal timeline with agent rows
- Task blocks show duration
- Color by status
- Hover for task details
