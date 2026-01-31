# P08-F02: Slack HITL Bridge - User Stories

## Epic Summary

Implement a system-wide Slack HITL Bridge that enables humans to approve/reject HITL gates directly from Slack, with full RBAC enforcement and audit trailing. Additionally, support idea ingestion from Slack channels for the Mindflare Hub.

---

## Part A: Gate Notification (OUT Direction)

### US-01: Receive gate request notification in Slack

**As a** reviewer/approver,
**I want** to receive gate request notifications in the appropriate Slack channel,
**So that** I can respond to approval requests without monitoring the HITL UI.

**Acceptance Criteria:**
- [ ] GATE_REQUESTED events from Redis Streams trigger Slack messages
- [ ] Message appears in the channel configured for that gate type
- [ ] Message includes gate type, task ID, summary, and requester
- [ ] Message includes link to view evidence bundle
- [ ] Message has Approve and Reject buttons

**Test Scenarios:**
1. HITL_1_BACKLOG gate -> Message in #product-backlog channel
2. HITL_4_CODE gate -> Message in #code-review channel
3. Unknown gate type -> Logged warning, no crash
4. Slack API error -> Retry with backoff

---

### US-02: View evidence before deciding

**As a** reviewer,
**I want** to click through to the evidence bundle,
**So that** I can make an informed approval/rejection decision.

**Acceptance Criteria:**
- [ ] Evidence link opens HITL UI evidence view
- [ ] Link includes request_id for direct navigation
- [ ] Evidence never embedded directly in Slack (security)
- [ ] Link works from Slack desktop and mobile apps

**Test Scenarios:**
1. Click evidence link -> Opens HITL UI evidence page
2. Link with expired session -> Redirects to login
3. Evidence bundle not found -> Shows 404 with helpful message

---

### US-03: Route gates to environment-specific channels

**As an** operations team,
**I want** production gates routed to a different channel than staging,
**So that** critical production approvals get appropriate attention.

**Acceptance Criteria:**
- [ ] Environment can override default gate type routing
- [ ] Production gates can be routed to #prod-approvals
- [ ] Staging gates can be routed to #staging-approvals
- [ ] Missing environment config falls back to default routing

**Test Scenarios:**
1. HITL_6_RELEASE with env=production -> #prod-releases channel
2. HITL_6_RELEASE with env=staging -> #staging-releases channel
3. HITL_6_RELEASE with no env -> Default release channel

---

## Part B: Decision Capture (IN Direction)

### US-04: Approve gate via Slack button

**As a** reviewer with appropriate role,
**I want** to click Approve to approve a gate,
**So that** the workflow can continue without switching to the HITL UI.

**Acceptance Criteria:**
- [ ] Clicking Approve publishes GATE_APPROVED to Redis Streams
- [ ] RBAC validates user has required role for gate type
- [ ] Slack message updates to show "Approved by @user"
- [ ] Approve/Reject buttons are removed after decision
- [ ] Task in aSDLC system receives the approval

**Test Scenarios:**
1. Authorized user clicks Approve -> Gate approved, workflow continues
2. Unauthorized user clicks Approve -> Ephemeral error, gate unchanged
3. Double-click Approve -> Second click ignored (idempotent)
4. Approve already-decided gate -> Shows "Already decided" message

---

### US-05: Reject gate via Slack with reason

**As a** reviewer,
**I want** to reject a gate with an explanation,
**So that** the requester knows why and can address the issues.

**Acceptance Criteria:**
- [ ] Clicking Reject opens a modal for reason input
- [ ] Reason is required (cannot submit empty)
- [ ] Submitting publishes GATE_REJECTED with reason to stream
- [ ] Slack message updates to show "Rejected by @user: [reason]"
- [ ] RBAC validates user has required role

**Test Scenarios:**
1. Enter reason and submit -> Gate rejected with reason
2. Cancel modal -> Gate unchanged
3. Empty reason -> Validation error, cannot submit
4. Unauthorized user -> Ephemeral error before modal opens

---

### US-06: RBAC enforcement for gate decisions

**As a** security administrator,
**I want** only authorized users to approve/reject specific gate types,
**So that** the HITL process maintains proper authorization controls.

**Acceptance Criteria:**
- [ ] Config maps Slack user IDs to roles
- [ ] Each gate type requires a specific role to approve
- [ ] Unauthorized attempts logged for audit
- [ ] Ephemeral message explains why action was denied
- [ ] Authorized users can see who else can approve

**Test Scenarios:**
1. PM clicks Approve on HITL_1_BACKLOG -> Allowed (pm role)
2. Developer clicks Approve on HITL_6_RELEASE -> Denied (needs release_manager)
3. Admin with all roles -> Can approve any gate type
4. Unknown user clicks -> Denied, suggested to contact admin

---

### US-07: Audit trail for Slack decisions

**As a** compliance officer,
**I want** all Slack-based decisions logged with full context,
**So that** we have a complete audit trail for governance.

**Acceptance Criteria:**
- [ ] Decision includes Slack user ID, timestamp, and channel
- [ ] Decision includes request_id and gate_type
- [ ] Rejection includes reason text
- [ ] Logs persisted to decision audit log
- [ ] Events flow through existing HITLDispatcher.record_decision()

**Test Scenarios:**
1. Approve gate -> Audit entry with user ID and timestamp
2. Reject gate -> Audit entry includes rejection reason
3. Query audit log -> Can filter by Slack user ID

---

## Part C: Ideas Ingestion (IN Direction)

### US-08: Submit idea via emoji reaction

**As a** Slack user,
**I want** to add a lightbulb emoji to capture a message as an idea,
**So that** good ideas from conversations are saved to Mindflare Hub.

**Acceptance Criteria:**
- [ ] Adding configured emoji (default: bulb) creates an idea
- [ ] Original message text becomes idea content
- [ ] Original author is attributed (not the reactor)
- [ ] Source shows "SLACK" with channel reference
- [ ] Deduplication prevents same message becoming multiple ideas

**Test Scenarios:**
1. React with bulb -> Idea created from message
2. React in non-configured channel -> Ignored
3. React to already-captured message -> No duplicate
4. React to message over word limit -> Truncated or error DM

---

### US-09: Submit idea from monitored channel

**As a** team member,
**I want** messages in #product-ideas channel automatically captured,
**So that** all ideas posted there are tracked in Mindflare Hub.

**Acceptance Criteria:**
- [ ] Messages in configured ideas channels are auto-captured
- [ ] Bot messages and thread replies can be excluded (configurable)
- [ ] Source attribution includes channel name
- [ ] Confirmation reaction added to captured messages

**Test Scenarios:**
1. Post in #product-ideas -> Idea created automatically
2. Post in #general -> Not captured (not configured)
3. Thread reply -> Depends on config (default: ignore)
4. Bot message -> Ignored

---

### US-10: Configure ideas channels

**As an** administrator,
**I want** to configure which channels are monitored for ideas,
**So that** only designated channels contribute to the ideas repository.

**Acceptance Criteria:**
- [ ] Config lists channel IDs for idea monitoring
- [ ] Can enable/disable channels without restart (if possible)
- [ ] Can configure trigger emoji per workspace
- [ ] Invalid channel ID logged at startup

**Test Scenarios:**
1. Add channel to config -> Messages captured
2. Remove channel from config -> Messages no longer captured
3. Invalid channel ID -> Warning logged, bridge continues

---

## Part D: Operations & Reliability

### US-11: Bridge startup and health

**As an** operator,
**I want** the bridge to start cleanly and report health,
**So that** I can monitor it alongside other services.

**Acceptance Criteria:**
- [ ] Bridge validates config on startup
- [ ] Creates consumer group if not exists
- [ ] Exposes /health endpoint (if HTTP server added)
- [ ] Logs startup status and connection info
- [ ] Reconnects automatically on Slack disconnect

**Test Scenarios:**
1. Valid config -> Bridge starts, logs ready message
2. Invalid Slack token -> Fails fast with clear error
3. Redis unavailable -> Retries with backoff
4. Slack disconnects -> Auto-reconnects via Socket Mode

---

### US-12: Recover pending events after restart

**As the** system,
**I want** to process any unacknowledged events after restart,
**So that** gate requests are not lost during bridge downtime.

**Acceptance Criteria:**
- [ ] Consumer group tracks delivered-but-not-acked messages
- [ ] On restart, claims and processes pending messages
- [ ] Duplicate detection prevents double-posting
- [ ] Recovery logged for observability

**Test Scenarios:**
1. Bridge crashes mid-processing -> Event processed on restart
2. Event already posted to Slack -> Not posted again
3. 100+ pending events -> Processed in order

---

## Acceptance Test Summary

| Story | Part | Test Count | Critical Path |
|-------|------|------------|---------------|
| US-01 | A | 4 | Yes |
| US-02 | A | 3 | Yes |
| US-03 | A | 3 | No |
| US-04 | B | 4 | Yes |
| US-05 | B | 4 | Yes |
| US-06 | B | 4 | Yes |
| US-07 | B | 3 | No |
| US-08 | C | 4 | No |
| US-09 | C | 4 | No |
| US-10 | C | 3 | No |
| US-11 | D | 4 | Yes |
| US-12 | D | 3 | No |

**Total Tests:** 43
**Critical Path Tests:** 20

---

## Definition of Done

- [ ] All acceptance criteria met for each story
- [ ] Unit tests pass with 80%+ coverage
- [ ] Integration tests with mocked Slack pass
- [ ] Security review completed (RBAC, token handling)
- [ ] Bridge runs as Docker container
- [ ] Configuration documented in setup guide
- [ ] No critical or high security vulnerabilities
- [ ] Consumer group properly tracks message acknowledgment
