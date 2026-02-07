# P08-F08: Slack Bidirectional HITL - User Stories

## Epic Summary

Generalize the Slack HITL Bridge to support rich bidirectional agent-human communication. Agents can ask questions, present choices, send notifications, and request acknowledgements through Slack, with responses routed back to the waiting agent.

This extends Epic 8 (Tool abstraction and RAG integration) by turning Slack into a general-purpose human communication channel for the aSDLC agent system, beyond simple gate approve/reject.

---

## US 8.8.1: Agent Asks a Free-Text Question

**As a** backend agent working on a task,
**I want to** post a question to Slack and block until a human types a response,
**So that** I can get clarification on ambiguous requirements without a full HITL gate.

### Acceptance Criteria

1. Agent calls `InteractionDispatcher.request_interaction(type="question", prompt="...", ...)`.
2. An `INTERACTION_REQUESTED` event is published to the Redis event stream with `interaction_type=question`.
3. The InteractionConsumer picks up the event and posts a Slack message with the question text and an "Answer" button.
4. When a human clicks "Answer", a modal opens with a multi-line text input.
5. On modal submission, the response text is captured and an `INTERACTION_RESPONSE` event is published.
6. The Slack message is updated to show the response and remove the "Answer" button.
7. The agent's `get_response()` call returns the `InteractionResponse` with `response_text` populated.
8. The full interaction (request + response) is logged to the audit stream.

### Acceptance Tests

- **AT-1**: Given an agent requests a question interaction, when the event is published, then `asdlc:interaction:{id}` exists in Redis with status `pending`.
- **AT-2**: Given a question event is on the stream, when InteractionConsumer processes it, then a Slack message is posted with the correct prompt text and an "Answer" button.
- **AT-3**: Given a human clicks "Answer" and submits text in the modal, then an `INTERACTION_RESPONSE` event is published with the response text.
- **AT-4**: Given a response event is published, when the agent polls `get_response()`, then the response is returned with the human's text.
- **AT-5**: Given a question has been answered, when inspecting the Slack message, then the "Answer" button is removed and the response text is shown.

---

## US 8.8.2: Agent Presents Multiple Choices

**As a** backend agent evaluating multiple approaches,
**I want to** present options to a human in Slack and receive their selection,
**So that** the human can guide my technical decision without writing a detailed response.

### Acceptance Criteria

1. Agent calls `request_interaction(type="choice", prompt="...", options=["A", "B", "C"])`.
2. An `INTERACTION_REQUESTED` event is published with `interaction_type=choice` and the options list.
3. The InteractionConsumer posts a Slack message with the prompt and one button per option.
4. When a human clicks an option button, an `INTERACTION_RESPONSE` event is published with `selected_option` matching the clicked option.
5. The Slack message is updated to show which option was selected and by whom.
6. The agent's `get_response()` call returns the `InteractionResponse` with `selected_option` populated.
7. Maximum of 5 options are supported (Slack Block Kit actions block limit).

### Acceptance Tests

- **AT-1**: Given a choice interaction with 3 options, when InteractionConsumer processes the event, then 3 buttons are rendered in the Slack message.
- **AT-2**: Given a human clicks option "B", then the `INTERACTION_RESPONSE` event metadata contains `selected_option="B"`.
- **AT-3**: Given an option is selected, then the Slack message is updated to show "Selected: B by @username".
- **AT-4**: Given a choice interaction with more than 5 options, then the request is rejected with a validation error.
- **AT-5**: Given two users click different options simultaneously, then only the first click is accepted and the second user sees an ephemeral "Already answered" message.

---

## US 8.8.3: Agent Sends a Non-Blocking Notification

**As a** backend agent completing a phase of work,
**I want to** push a status notification to Slack without blocking,
**So that** humans are informed of progress without the agent pausing execution.

### Acceptance Criteria

1. Agent calls `InteractionDispatcher.send_notification(message="...", level="info")`.
2. An `AGENT_NOTIFICATION` event is published to the event stream.
3. The NotificationConsumer posts an informational Slack message with no interactive buttons.
4. The agent continues execution immediately after calling `send_notification()` (does not block).
5. Notification messages include a visual indicator of the level (info/success/warning/error).
6. Notifications are not tracked in the pending interactions set (no timeout needed).

### Acceptance Tests

- **AT-1**: Given an agent sends a notification, then `send_notification()` returns immediately (within 100ms, excluding Redis publish time).
- **AT-2**: Given a notification event is on the stream, when NotificationConsumer processes it, then a Slack message is posted without action buttons.
- **AT-3**: Given a notification with level `error`, then the Slack message includes a red visual indicator.
- **AT-4**: Given a notification with level `success`, then the Slack message includes a green visual indicator.
- **AT-5**: Given a notification is sent, then no entry is added to `asdlc:pending_interactions`.

---

## US 8.8.4: Agent Requests an Acknowledgement

**As a** devops agent completing a deployment,
**I want to** notify the human and block until they acknowledge receipt,
**So that** I know the human has seen and verified the result before I proceed.

### Acceptance Criteria

1. Agent calls `request_interaction(type="acknowledgement", prompt="Deployment complete. Please verify.")`.
2. An `INTERACTION_REQUESTED` event is published with `interaction_type=acknowledgement`.
3. The InteractionConsumer posts a Slack message with the prompt and an "Acknowledged" button.
4. When a human clicks "Acknowledged", an `INTERACTION_RESPONSE` event is published.
5. The Slack message is updated to show who acknowledged and when.
6. The agent's `get_response()` call returns, confirming the acknowledgement.

### Acceptance Tests

- **AT-1**: Given an acknowledgement interaction, when posted to Slack, then exactly one "Acknowledged" button is shown.
- **AT-2**: Given a human clicks "Acknowledged", then `INTERACTION_RESPONSE` is published with the responder's identity.
- **AT-3**: Given the acknowledgement is received, then the agent's `get_response()` returns a response with `responder` set.
- **AT-4**: Given a second user clicks "Acknowledged" after the first, then the second user sees an ephemeral message.

---

## US 8.8.5: Interaction Times Out with Fallback

**As a** backend agent asking a question with a time constraint,
**I want** the interaction to automatically time out with a fallback value if the human does not respond,
**So that** my execution is not blocked indefinitely.

### Acceptance Criteria

1. Agent creates an interaction with `timeout_seconds=1800` and `fallback_value="200ms"`.
2. The interaction's `expires_at` timestamp is calculated and stored.
3. The `TimeoutMonitor` detects the expiration and publishes an `INTERACTION_TIMEOUT` event.
4. If a `fallback_value` was provided, the interaction status is set to `timeout` and the fallback is stored as the response.
5. The Slack message is updated to show "Timed out - using fallback: 200ms".
6. The agent's `get_response()` call returns with the fallback value.
7. If no `fallback_value` was set, the agent's `get_response()` returns `None`.

### Acceptance Tests

- **AT-1**: Given an interaction with 5-second timeout and a fallback value, when 5 seconds elapse without response, then an `INTERACTION_TIMEOUT` event is published with `fallback_used=true`.
- **AT-2**: Given a timed-out interaction with fallback, then `get_response()` returns a response with `response_text` equal to the fallback value.
- **AT-3**: Given an interaction with timeout but no fallback, then `get_response()` returns `None` after timeout.
- **AT-4**: Given a human responds after the timeout has been processed, then the late response is rejected with an ephemeral "Interaction has expired" message.
- **AT-5**: Given an interaction without timeout_seconds (null), then it remains pending indefinitely until manually responded to or cancelled.

---

## US 8.8.6: Multiple Agents Ask Questions Concurrently

**As a** PM CLI coordinating multiple parallel agents,
**I want** each agent's questions to be independently tracked and routed,
**So that** responses go to the correct waiting agent without cross-talk.

### Acceptance Criteria

1. Two agents (e.g., `backend` in `p11-guardrails` and `frontend` in `p05-hitl-ui`) each create separate interaction requests.
2. Both interactions are stored as separate Redis hashes with unique `interaction_id` values.
3. Both interactions are posted as separate Slack messages, each identifying the requesting agent and session.
4. A human responds to agent A's question; agent B's question remains pending.
5. Agent A receives its response; agent B continues to poll without receiving agent A's response.
6. A human then responds to agent B's question; agent B receives its response.

### Acceptance Tests

- **AT-1**: Given two concurrent question interactions from different agents, then two separate entries exist in `asdlc:pending_interactions`.
- **AT-2**: Given two pending questions in Slack, when a human responds to one, then only that interaction's status changes to `responded`.
- **AT-3**: Given agent A's question is answered, then agent A's `get_response()` returns the answer while agent B's `get_response()` continues to block.
- **AT-4**: Given 10 concurrent interactions from different agents, then all 10 have unique `interaction_id` values and can be independently responded to.

---

## US 8.8.7: Agent Uses Bash Tool to Ask Questions

**As a** Claude Agent SDK agent running a bash tool,
**I want to** call `ask_human.sh` to ask a question and receive the response as JSON,
**So that** I can integrate human input into my workflow without Python imports.

### Acceptance Criteria

1. A `tools/ask_human.sh` script exists with a standard CLI interface.
2. The tool accepts `--type`, `--prompt`, `--options` (comma-separated for choices), `--timeout`, and `--fallback` arguments.
3. The tool creates an interaction, blocks until response, and prints JSON to stdout.
4. The JSON output conforms to the bash tool standard: `{ "success": true, "data": { "response_text": "...", "responder": "..." } }`.
5. On timeout with fallback, the tool returns `{ "success": true, "data": { "response_text": "200ms", "timed_out": true } }`.
6. On timeout without fallback, the tool returns `{ "success": false, "error": "Interaction timed out without fallback" }`.

### Acceptance Tests

- **AT-1**: Given `ask_human.sh --type question --prompt "Target latency?"`, when a human responds "100ms" via Slack, then stdout contains `"response_text": "100ms"`.
- **AT-2**: Given `ask_human.sh --type choice --prompt "Strategy?" --options "A,B,C"`, when a human clicks "B", then stdout contains `"selected_option": "B"`.
- **AT-3**: Given `ask_human.sh --type question --prompt "..." --timeout 5 --fallback "default"`, when no response comes within 5 seconds, then stdout contains `"timed_out": true` and `"response_text": "default"`.
- **AT-4**: Given `ask_human.sh` is called with no `--type` argument, then it prints usage instructions to stderr and exits with code 1.

---

## US 8.8.8: Interaction Routing by Session Context

**As an** administrator configuring the Slack Bridge,
**I want to** route interactions from different agent sessions to different Slack channels,
**So that** each team or feature context has its own dedicated communication channel.

### Acceptance Criteria

1. `SlackBridgeConfig` includes an `interaction_routing` section with `default_channel_id` and `session_overrides`.
2. Interactions from session `p11-guardrails` are posted to the configured override channel.
3. Interactions from sessions without overrides are posted to the `default_channel_id`.
4. Urgent-priority interactions are posted to `urgent_channel_id` if configured.
5. The routing decision is logged for audit purposes.

### Acceptance Tests

- **AT-1**: Given `session_overrides: { "p11-guardrails": "C-GUARDRAILS" }`, when an interaction from `p11-guardrails` is processed, then the Slack message is posted to `C-GUARDRAILS`.
- **AT-2**: Given no session override for `p04-review-swarm`, when an interaction from that session is processed, then the Slack message is posted to `default_channel_id`.
- **AT-3**: Given `urgent_channel_id: "C-URGENT"` and a priority=urgent interaction, then the message is posted to `C-URGENT` regardless of session overrides.
- **AT-4**: Given no `interaction_routing` in config, then the bridge logs a warning and skips interaction routing (interactions are not posted).
